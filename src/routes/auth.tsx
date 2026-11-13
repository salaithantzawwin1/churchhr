import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { eq, sql } from "drizzle-orm";
import type { AppEnv } from "../env";
import { getDb, type DB } from "../db/client";
import { users, loginAttempts } from "../db/schema";
import { hashPassword, parseIterations, verifyPassword } from "../auth";
import { checkPasswordPolicy } from "../password";
import { logAudit } from "../audit";
import { isHttpsRequest } from "../util";
import {
  getSessionUser,
  SESSION_TTL_SECONDS,
  createSession,
  destroySession,
  nowSeconds,
  purgeExpiredSessions,
  destroyOtherSessions,
} from "../session";
import { LoginPage, ProfilePage } from "../views/auth";
import { getDict } from "../i18n";
import type { Flash } from "../views/layout";
import { loadBranding } from "../branding";

const MAX_FAILED_ATTEMPTS = 10;
const LOCK_SECONDS = 600;
const LAST_USER_COOKIE = "last_user";
const LAST_USER_MAX_AGE = 60 * 60 * 24 * 365;
/** "Save password" keeps the session on this device; otherwise the cookie dies
 * with the browser so reopening it requires signing in again. */
const REMEMBER_TTL_SECONDS = 60 * 60 * 24 * 30;

// Per-IP sliding window: at most 10 attempts inside 10 minutes, else 15-min wait.
const IP_WINDOW_SECONDS = 600;
const IP_MAX_ATTEMPTS = 10;
const IP_WAIT_SECONDS = 900;

/** Counted inside the sliding window; prunes old rows opportunistically. */
async function ipRateLimited(db: DB, ip: string, now: number): Promise<boolean> {
  const rows = await db.all<{ n: number }>(
    sql`SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ${ip} AND at > ${now - IP_WINDOW_SECONDS}`,
  );
  return Number(rows[0]?.n ?? 0) >= IP_MAX_ATTEMPTS;
}

async function recordAttempt(db: DB, ip: string, now: number): Promise<void> {
  await db.insert(loginAttempts).values({ ip, at: now });
  // Keep the log bounded: drop window-adjacent old rows occasionally.
  if (Math.random() < 0.05) {
    await db.all(sql`DELETE FROM login_attempts WHERE at < ${now - IP_WINDOW_SECONDS * 3}`);
  }
}

/** Public routes: reachable without a session, registered before requireAuth. */
export const publicAuthRoutes = new Hono<AppEnv>();

publicAuthRoutes.get("/login", async (c) => {
  const lang = c.get("lang");
  const token = getCookie(c, "session");
  if (token) {
    const db = getDb(c.env);
    const user = await getSessionUser(db, token);
    if (user) return c.redirect(user.mustChangePassword ? "/profile?msg=change" : "/", 302);
  }
  // Bounced back by the client-side idle timer?
  const t = getDict(c.get("lang"));
  const flash = c.req.query("msg") === "auto-logout"
    ? { kind: "warn" as const, text: t("login.autoLogout") }
    : undefined;
  // Remember only a username that actually signed in (set on success below).
  const rawLastUser = getCookie(c, LAST_USER_COOKIE);
  let lastUser: string | undefined;
  if (rawLastUser) {
    try { lastUser = decodeURIComponent(rawLastUser); } catch { lastUser = rawLastUser; }
  }
  const branding = await loadBranding(getDb(c.env));
  return c.html(<LoginPage lang={lang} flash={flash} username={lastUser} branding={branding} />);
});

/** Public brand mark: the photo set in Administration → Login branding. */
publicAuthRoutes.get("/branding/photo", async (c) => {
  const db = getDb(c.env);
  const row = (await db.all<{ photo: ArrayBuffer | number[] | null; updatedAt: number }>(sql`
    SELECT photo, updated_at AS updatedAt FROM app_branding WHERE id = 1 LIMIT 1`))[0];
  if (!row?.photo) return c.notFound();
  const bytes = Array.isArray(row.photo) ? Uint8Array.from(row.photo) : new Uint8Array(row.photo);
  const etag = `W/"brand-${row.updatedAt}-${bytes.byteLength}"`;
  const headers = {
    "Content-Type": "image/webp",
    "Content-Length": String(bytes.byteLength),
    "Cache-Control": "public, max-age=300",
    ETag: etag,
  };
  if (c.req.header("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(bytes, { headers });
});

publicAuthRoutes.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const db = getDb(c.env);
  const now = nowSeconds();
  const t = getDict(c.get("lang"));

  const remember = String(body.remember ?? "") === "1";
  const branding = await loadBranding(db);
  const fail = (msg: string, status: 401 | 429 = 401) =>
    c.html(<LoginPage error={msg} username={username} remember={remember} lang={c.get("lang")} branding={branding} />, status);

  // ---- per-IP sliding-window rate limit (independent of the account checks,
  // so it stops brute-forcing different usernames from one address) ----
  const ip =
    c.req.header("CF-Connecting-IP") ||
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "local";
  if (await ipRateLimited(db, ip, now)) return fail(t("login.rateLimited"), 429);

  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!user || user.active !== 1) {
    // Spend the same PBKDF2 work as a real check so response timing does not
    // reveal whether a username exists.
    await hashPassword(password || "x", parseIterations(c.env.PBKDF2_ITERATIONS));
    await recordAttempt(db, ip, now);
    return fail(t("login.error"));
  }
  if (user.lockedUntil > now) return fail(t("login.locked"), 429);

  const ok = password.length > 0 && (await verifyPassword(password, user.passwordHash));
  if (!ok) {
    await recordAttempt(db, ip, now);
    const attempts = user.failedAttempts + 1;
    const lockedUntil = attempts >= MAX_FAILED_ATTEMPTS ? now + LOCK_SECONDS : user.lockedUntil;
    await db
      .update(users)
      .set({ failedAttempts: attempts, lockedUntil })
      .where(eq(users.id, user.id));
    await logAudit(db, {
      action: lockedUntil > now ? "login.locked" : "login.failed",
      entity: "session", entityId: null,
      userId: user.id, username: user.username,
      ip, userAgent: c.req.header("user-agent") ?? "",
      method: "POST", path: new URL(c.req.url).pathname, status: 401,
    });
    return fail(t("login.error"));
  }

  await db.update(users).set({ failedAttempts: 0, lockedUntil: 0 }).where(eq(users.id, user.id));
  const token = await createSession(db, user.id, remember ? REMEMBER_TTL_SECONDS : SESSION_TTL_SECONDS);
  setCookie(c, "session", token, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    // No maxAge unless the user asked to save it: a browser-session cookie
    // stops the app from silently signing in when the browser is reopened.
    ...(remember ? { maxAge: REMEMBER_TTL_SECONDS } : {}),
    secure: isHttpsRequest(c),
  });
  setCookie(c, LAST_USER_COOKIE, encodeURIComponent(user.username), {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    maxAge: LAST_USER_MAX_AGE,
    secure: isHttpsRequest(c),
  });
  await purgeExpiredSessions(db);
  await logAudit(db, {
    action: "login.success",
    entity: "session", entityId: null,
    userId: user.id, username: user.username,
    summary: remember ? "remember" : null,
    ip, userAgent: c.req.header("user-agent") ?? "",
    method: "POST", path: new URL(c.req.url).pathname, status: 302,
  });
  return c.redirect(user.mustChangePassword === 1 ? "/profile?msg=change" : "/", 302);
});

/** Protected profile/logout routes; registered after requireAuth. */
export const profileRoutes = new Hono<AppEnv>();

/** GET support for the idle auto-logout link (browser navigates, not posts). */
profileRoutes.get("/logout", async (c) => {
  const db = getDb(c.env);
  const token = getCookie(c, "session");
  if (token) await destroySession(db, token);
  deleteCookie(c, "session", { path: "/" });
  return c.redirect(c.req.query("auto") ? "/login?msg=auto-logout" : "/login", 302);
});

profileRoutes.post("/logout", async (c) => {
  const db = getDb(c.env);
  const token = getCookie(c, "session");
  if (token) await destroySession(db, token);
  deleteCookie(c, "session", { path: "/" });
  return c.redirect("/login", 302);
});

profileRoutes.get("/profile", (c) => {
  const user = c.get("user");
  const t = getDict(c.get("lang"));
  const q = c.req.query();
  let flash: Flash = null;
  if (q.ok) flash = { kind: "ok", text: t("profile.changed") };
  else if (q.msg === "change") flash = { kind: "warn", text: t("profile.mustChange") };
  else if (q.err === "wrong") flash = { kind: "err", text: t("profile.errWrong") };
  else if (q.err === "weak") flash = { kind: "err", text: t("profile.errWeak") };
  else if (q.err === "policy") flash = { kind: "err", text: `${t("profile.errPolicy")}` };
  else if (q.err === "mismatch") flash = { kind: "err", text: t("profile.errMismatch") };
  return c.html(
    <ProfilePage username={user.username} mustChange={user.mustChangePassword} flash={flash} lang={c.get("lang")} />,
  );
});

profileRoutes.post("/profile", async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();
  const current = String(body.current_password ?? "");
  const next = String(body.new_password ?? "");
  const confirm = String(body.confirm_password ?? "");
  const redirect = (err?: string) =>
    c.redirect(err ? `/profile?err=${err}` : "/profile?ok=1", 302);

  if (next.length < 8) return redirect("weak");
  const pwFail = checkPasswordPolicy(next);
  if (pwFail) return redirect("policy");
  if (next !== confirm) return redirect("mismatch");

  const db = getDb(c.env);
  const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!row) return redirect("wrong");
  const ok = await verifyPassword(current, row.passwordHash);
  if (!ok) return redirect("wrong");

  const iterations = parseIterations(c.env.PBKDF2_ITERATIONS);
  const passwordHash = await hashPassword(next, iterations);
  await db
    .update(users)
    .set({ passwordHash, mustChangePassword: 0 })
    .where(eq(users.id, user.id));
  // A changed password signs out the account's other devices but keeps this one.
  await destroyOtherSessions(db, user.id, getCookie(c, "session") ?? null);
  return redirect();
});
