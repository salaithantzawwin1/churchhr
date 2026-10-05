import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { AppEnv } from "./env";
import { requireAuth, requirePermission } from "./middleware";
import { profileRoutes, publicAuthRoutes } from "./routes/auth";
import { membersRoutes } from "./routes/members";
import { adminRoutes } from "./routes/admin";
import { getDb } from "./db/client";
import { loadDashboard } from "./dashboard";
import { flashFromQuery } from "./flash";
import { getDict, langFromQuery, normalizeLang, LANG_COOKIE } from "./i18n";
import { DashboardPage } from "./views/dashboard";
import { GenericErrorPage, NotFoundPage } from "./views/errors";
import { CSS } from "./styles";

const app = new Hono<AppEnv>();

// Resolve UI language: ?lang=mm|en wins and persists to a cookie; else cookie; else mm.
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

// Public routes first so requireAuth (below) never intercepts them.
app.route("/", publicAuthRoutes);
app.use("*", requireAuth);
app.route("/", profileRoutes);

app.get("/", requirePermission("dashboard.view"), async (c) => {
  const db = getDb(c.env);
  const data = await loadDashboard(db, {
    scopeAll: c.get("scopeAll"),
    stateIds: c.get("stateIds"),
  });
  return c.html(
    <DashboardPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), c.get("lang"))}
      data={data} lang={c.get("lang")}
    />,
  );
});

app.route("/members", membersRoutes);
app.route("/admin", adminRoutes);

app.notFound((c) => c.html(<NotFoundPage lang={c.get("lang")} />));
app.onError((err, c) => {
  console.error("unhandled error:", err);
  const t = getDict(c.get("lang") ?? "mm");
  return c.html(<GenericErrorPage message={t("err.genericBody")} lang={c.get("lang")} />, 500);
});

export default app;
