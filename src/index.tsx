import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { AppEnv } from "./env";
import { requireAuth, requirePermission } from "./middleware";
import { profileRoutes, publicAuthRoutes } from "./routes/auth";
import { membersRoutes } from "./routes/members";
import { adminRoutes } from "./routes/admin";
import { householdsRoutes } from "./routes/households";
import { reportsRoutes } from "./routes/reports";
import { organizationRoutes } from "./routes/organization";
import { getDb } from "./db/client";
import { loadDashboard, type DashboardFilter } from "./dashboard";
import { flashFromQuery } from "./flash";
import { GENDERS } from "./enums";
import { intParam, isHttpsRequest } from "./util";
import { getDict, langFromQuery, normalizeLang, LANG_COOKIE } from "./i18n";
import { DashboardPage } from "./views/dashboard";
import { RegionsPage } from "./views/regions";
import { GenericErrorPage, NotFoundPage } from "./views/errors";
import { CSS } from "./styles";
import { ASSET_V } from "./assets";
import { checkHealth, type HealthResult } from "./health";
import { auditMutations } from "./audit";

const app = new Hono<AppEnv>();

const CANONICAL_HOST = "www.mmgoodnewshr.online";
const APEX_HOST = "mmgoodnewshr.online";

/** SHA-256 of the one inline <script> in layout.tsx (the theme bootstrap that
 *  must run before paint). Pinned so CSP can stay strict; if that script text
 *  changes, recompute this or the browser drops the script (and the page simply
 *  falls back to the dark theme until app.js reads the saved choice). */
const INLINE_THEME_HASH = "sha256-bsIc6P//SoFYo1DS1od1VPsWhvFCRt+s/elRqEMHSZU=";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "img-src 'self' data: blob:", // member photos + the client-side resize preview
  `script-src 'self' '${INLINE_THEME_HASH}'`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // inline style attributes are used throughout
  "font-src https://fonts.gstatic.com",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

// Security headers for every response, including redirects.
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Cross-Origin-Resource-Policy", "same-origin");
  c.header("X-Permitted-Cross-Domain-Policies", "none");
  const url = new URL(c.req.url);
  if ((url.hostname === CANONICAL_HOST || url.hostname === APEX_HOST) && isHttpsRequest(c)) {
    c.header("Strict-Transport-Security", "max-age=15552000");
  }
});

// One canonical origin: HTTPS on www. Local dev and workers.dev are left alone.
app.use("*", async (c, next) => {
  // Cloudflare always adds CF-Ray; Wrangler dev does not, so dev keeps its local URL.
  if (!c.req.header("cf-ray")) {
    await next();
    return;
  }
  const url = new URL(c.req.url);
  const host = url.hostname.toLowerCase();
  const isProdHost = host === CANONICAL_HOST || host === APEX_HOST;
  if (isProdHost && (host !== CANONICAL_HOST || !isHttpsRequest(c))) {
    return c.redirect(`https://${CANONICAL_HOST}${url.pathname}${url.search}`, 301);
  }
  await next();
});

// Resolve UI language: ?lang=mm|en wins and persists to a cookie; else cookie; else en.
app.use("*", async (c, next) => {
  const fromQuery = langFromQuery(c.req.query());
  const lang = fromQuery ?? normalizeLang(getCookie(c, LANG_COOKIE));
  if (fromQuery) {
    c.header("Set-Cookie", `${LANG_COOKIE}=${lang}; Path=/; Max-Age=31536000; SameSite=Lax`);
  }
  c.set("lang", lang);
  await next();
});

// CSRF guard for state-changing requests (backed by SameSite=Lax session cookie).
app.use("*", async (c, next) => {
  const method = c.req.method;
  if (method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE") {
    const origin = c.req.header("Origin");
    if (origin) {
      const host = c.req.header("Host");
      let originHost = "";
      try {
        originHost = new URL(origin).host;
      } catch {
        return c.text("Bad request", 400);
      }
      if (host && originHost !== host) return c.text("Bad request (origin)", 403);
    } else {
      // Older clients may omit Origin on form posts; Sec-Fetch-Site is sent by
      // every modern browser and still separates a cross-site post from ours.
      const site = c.req.header("Sec-Fetch-Site")?.toLowerCase();
      if (site && site !== "same-origin" && site !== "none") {
        return c.text("Bad request (origin)", 403);
      }
    }
  }
  await next();
});

/** The whole stylesheet (~185 KB) was re-sent on every page load. The link
 * carries ASSET_V, so it can be immutable for a year: a release changes the URL
 * instead of making browsers fetch the same CSS again. */
const STYLES_ETAG = `"css-${ASSET_V}"`;
app.get("/styles.css", (c) => {
  const headers = {
    "Content-Type": "text/css; charset=utf-8",
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: STYLES_ETAG,
  };
  if (c.req.header("if-none-match") === STYLES_ETAG) return new Response(null, { status: 304, headers });
  return c.body(CSS, 200, headers);
});

/** Public deploy probe: verifies the Worker, D1 connection and the migrations
 * this build needs, so a release can be checked without signing in. */
app.get("/healthz", async (c) => {
  const health = await checkHealth(c.env);
  return c.json(health, health.ok ? 200 : 503, {
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex",
  });
});

/** The dashboard's status chip ran the full 20-statement schema probe on every
 * page view. It reports infrastructure state, so a minute of staleness is fine:
 * /healthz still probes for real on every call. */
let healthCache: { at: number; value: HealthResult } | null = null;
async function dashboardHealth(env: Parameters<typeof checkHealth>[0]): Promise<HealthResult> {
  if (healthCache && Date.now() - healthCache.at < 60_000) return healthCache.value;
  const value = await checkHealth(env);
  healthCache = { at: Date.now(), value };
  return value;
}

// Public routes first so requireAuth (below) never intercepts them.
app.route("/", publicAuthRoutes);
app.use("*", requireAuth);
// Every successful state-changing request is recorded for the audit trail; it
// runs after requireAuth so the entry can name the signed-in user.
app.use("*", auditMutations());
app.route("/", profileRoutes);

app.get("/", requirePermission("dashboard.view"), async (c) => {
  const db = getDb(c.env);
  const q = c.req.query();
  const filters: DashboardFilter = {
    state: intParam(q.state),
    gender: q.gender && q.gender in GENDERS ? q.gender : "",
    homeCell: intParam(q.home_cell),
    township: (q.township ?? "").trim().slice(0, 80),
  };
  const [data, health] = await Promise.all([
    loadDashboard(db, {
      scopeAll: c.get("scopeAll"),
      stateIds: c.get("stateIds"),
    }, filters),
    dashboardHealth(c.env),
  ]);
  return c.html(
    <DashboardPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), c.get("lang"))}
      data={data} health={health} lang={c.get("lang")}
    />,
  );
});

app.get("/regions", requirePermission("dashboard.view"), async (c) => {
  const db = getDb(c.env);
  const data = await loadDashboard(db, {
    scopeAll: c.get("scopeAll"),
    stateIds: c.get("stateIds"),
  });
  return c.html(
    <RegionsPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), c.get("lang"))}
      data={data} lang={c.get("lang")}
    />,
  );
});

app.route("/members", membersRoutes);
app.route("/organization", organizationRoutes);
app.route("/reports", reportsRoutes);
app.route("/admin/households", householdsRoutes);
app.route("/admin", adminRoutes);

app.notFound((c) => c.html(<NotFoundPage lang={c.get("lang")} />, 404));
app.onError((err, c) => {
  console.error("unhandled error:", err);
  const t = getDict(c.get("lang") ?? "en");
  return c.html(<GenericErrorPage message={t("err.genericBody")} lang={c.get("lang")} />, 500);
});

export default app;
