import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../env";
import { getDb } from "../db/client";
import { users } from "../db/schema";
import { hashPassword, parseIterations, verifyPassword } from "../auth";
import {
  getSessionUser,
  SESSION_TTL_SECONDS,
  createSession,
  destroySession,
  nowSeconds,
  purgeExpiredSessions,
} from "../session";
import { LoginPage, ProfilePage } from "../views/auth";
import type { Flash } from "../views/layout";
import { getDict } from "../i18n";

const MAX_FAILED_ATTEMPTS = 10;
const LOCK_SECONDS = 600;

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
  return c.html(<LoginPage lang={lang} />);
});

publicAuthRoutes.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const db = getDb(c.env);
  const now = nowSeconds();
  const t = getDict(c.get("lang"));

  const fail = (msg: string, status: 401 | 429 = 401) =>
    c.html(<LoginPage error={msg} username={username} lang={c.get("lang")} />, status);

  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!user || user.active !== 1) return fail(t("login.error"));
  if (user.lockedUntil > now) return fail(t("login.locked"), 429);

  const ok = password.length > 0 && (await verifyPassword(password, user.passwordHash));
  if (!ok) {
    const attempts = user.failedAttempts + 1;
    const lockedUntil = attempts >= MAX_FAILED_ATTEMPTS ? now + LOCK_SECONDS : user.lockedUntil;
    await db
      .update(users)
      .set({ failedAttempts: attempts, lockedUntil })
      .where(eq(users.id, user.id));
    return fail(t("login.error"));
  }

  await db.update(users).set({ failedAttempts: 0, lockedUntil: 0 }).where(eq(users.id, user.id));
  const token = await createSession(db, user.id);
  setCookie(c, "session", token, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    maxAge: SESSION_TTL_SECONDS,
    secure: new URL(c.req.url).protocol === "https:",
  });
  await purgeExpiredSessions(db);
  return c.redirect(user.mustChangePassword === 1 ? "/profile?msg=change" : "/", 302);
});

/** Protected profile/logout routes; registered after requireAuth. */
export const profileRoutes = new Hono<AppEnv>();

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
  return redirect();
});
