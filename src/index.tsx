import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { AppEnv } from "./env";
import { requireAuth, requirePermission } from "./middleware";
import { profileRoutes, publicAuthRoutes } from "./routes/auth";
import { membersRoutes } from "./routes/members";
import { adminRoutes } from "./routes/admin";
import { householdsRoutes } from "./routes/households";
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
import { APP_VERSION } from "./version";

const app = new Hono<AppEnv>();

const CANONICAL_HOST = "www.mmgoodnewshr.online";
const APEX_HOST = "mmgoodnewshr.online";

// Security headers for every response, including redirects.
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("Content-Security-Policy", "frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
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
    }
  }
  await next();
});

app.get("/styles.css", (c) =>
  c.body(CSS, 200, { "Content-Type": "text/css; charset=utf-8" }),
);

/** Public deploy probe: verifies the Worker, D1 connection and the migrations
 * this build needs, so a release can be checked without signing in. */
app.get("/healthz", async (c) => {
  const started = Date.now();
  let db: "ok" | "schema-outdated" | "error" = "ok";
  let migration: string | null = null;
  try {
    const applied = await c.env.DB
      .prepare("SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 1")
      .first<{ name: string }>();
    migration = applied?.name ?? null;
    // 0014 added short_code; selecting it fails loudly if the remote DB is behind.
    await c.env.DB.prepare("SELECT short_code FROM lookup_options LIMIT 1").all();
  } catch (err) {
    console.error("health check failed:", err);
    db = "error";
  }
  const ok = db === "ok";
  return c.json(
    {
      ok,
      service: "church-member-registry",
      version: APP_VERSION,
      migration,
      db,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    },
    ok ? 200 : 503,
    { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  );
});

// Public routes first so requireAuth (below) never intercepts them.
app.route("/", publicAuthRoutes);
app.use("*", requireAuth);
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
  const data = await loadDashboard(db, {
    scopeAll: c.get("scopeAll"),
    stateIds: c.get("stateIds"),
  }, filters);
  return c.html(
    <DashboardPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), c.get("lang"))}
      data={data} lang={c.get("lang")}
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
app.route("/admin/households", householdsRoutes);
app.route("/admin", adminRoutes);

app.notFound((c) => c.html(<NotFoundPage lang={c.get("lang")} />));
app.onError((err, c) => {
  console.error("unhandled error:", err);
  const t = getDict(c.get("lang") ?? "en");
  return c.html(<GenericErrorPage message={t("err.genericBody")} lang={c.get("lang")} />, 500);
});

export default app;
