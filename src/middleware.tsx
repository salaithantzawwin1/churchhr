import { createMiddleware } from "hono/factory";
import { getCookie, setCookie } from "hono/cookie";
import { eq, inArray } from "drizzle-orm";
import type { AppEnv } from "./env";
import { getDb } from "./db/client";
import { rolePermissions, userHomeCellAssignments, userRoles, userStateAssignments, users } from "./db/schema";
import { ALL_STATES_WILDCARD, type Permission } from "./rbac";
import { getSessionUser } from "./session";
import { LANG_COOKIE, langFromQuery, normalizeLang } from "./i18n";
import { ForbiddenPage } from "./views/errors";

export type Access = {
  perms: Set<string>;
  scopeAll: boolean;
  stateIds: number[];
  homeCellIds: number[];
};

/** Resolving who may do what costs several D1 round-trips per request, and it
 * only changes when an administrator edits a role. A short per-isolate cache
 * keeps page navigation at roughly one query; edits clear it explicitly. */
const ACCESS_TTL_MS = 15_000;
const accessCache = new Map<number, { at: number; access: Access }>();

/** Forgets cached permissions after a role or account change. */
export function clearAccessCache(): void {
  accessCache.clear();
}

/** Effective permissions (union of the user's roles), state scope and Home Cell limit. */
export async function loadAccess(db: ReturnType<typeof getDb>, userId: number): Promise<Access> {
  const cached = accessCache.get(userId);
  if (cached && Date.now() - cached.at < ACCESS_TTL_MS) return cached.access;
  const access = await computeAccess(db, userId);
  if (accessCache.size > 1000) accessCache.clear();
  accessCache.set(userId, { at: Date.now(), access });
  return access;
}

async function computeAccess(db: ReturnType<typeof getDb>, userId: number): Promise<Access> {
  const roleRows = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));
  const roleIds = roleRows.map((r) => r.roleId);

  const permRows = roleIds.length
    ? await db
        .select({ permission: rolePermissions.permission })
        .from(rolePermissions)
        .where(inArray(rolePermissions.roleId, roleIds))
    : [];

  const assignmentRows = await db
    .select({ regionId: userStateAssignments.regionId })
    .from(userStateAssignments)
    .where(eq(userStateAssignments.userId, userId));

  const scopeAll = assignmentRows.some((r) => r.regionId === ALL_STATES_WILDCARD);
  const stateIds = assignmentRows
    .filter((r) => r.regionId !== ALL_STATES_WILDCARD)
    .map((r) => r.regionId);

  // Optional per-account member-list limit by Home Cell (0033).
  let homeCellIds: number[] = [];
  try {
    const homeCellRows = await db
      .select({ homeCellId: userHomeCellAssignments.homeCellId })
      .from(userHomeCellAssignments)
      .where(eq(userHomeCellAssignments.userId, userId));
    homeCellIds = homeCellRows.map((r) => r.homeCellId);
  } catch (err) {
    // Deploy-before-migration safety: the table may not exist yet.
    homeCellIds = [];
  }

  return { perms: new Set(permRows.map((r) => r.permission)), scopeAll, stateIds, homeCellIds };
}

/** Redirects to /login when no live session; loads perms + scope into context vars. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const db = getDb(c.env);
  const token = getCookie(c, "session");
  const user = token ? await getSessionUser(db, token) : null;
  if (!user) return c.redirect("/login", 302);

  // Account language: an explicit ?lang= switch wins and is saved to the
  // account, otherwise the saved language applies on every device. Without a
  // saved preference the cookie/default from the global language middleware
  // stays in effect.
  const fromQuery = langFromQuery(c.req.query());
  if (fromQuery) {
    c.set("lang", fromQuery);
    if (user.language !== fromQuery) {
      try {
        await db.update(users).set({ language: fromQuery }).where(eq(users.id, user.id));
      } catch (err) {
        // Pre-migration safety: the cookie still remembers it in this browser.
        console.warn("could not save account language:", err);
      }
    }
  } else if (user.language) {
    const accountLang = normalizeLang(user.language);
    if (accountLang !== c.get("lang")) {
      c.set("lang", accountLang);
      if (getCookie(c, LANG_COOKIE) !== accountLang) {
        setCookie(c, LANG_COOKIE, accountLang, { path: "/", maxAge: 31536000, sameSite: "Lax" });
      }
    }
  }

  const path = new URL(c.req.url).pathname;
  const allowedWhileForced = path === "/profile" || path === "/logout";
  if (user.mustChangePassword && !allowedWhileForced) {
    return c.redirect("/profile?msg=change", 302);
  }

  const access = await loadAccess(db, user.id);
  c.set("user", user);
  c.set("perms", access.perms);
  c.set("scopeAll", access.scopeAll);
  c.set("stateIds", access.stateIds);
  c.set("homeCellIds", access.homeCellIds);
  await next();
});

/** Server-side permission gate (nav hiding is cosmetic; this is the enforcement). */
export function requirePermission(perm: Permission) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const perms = c.get("perms");
    if (!perms || !perms.has(perm)) {
      return c.html(<ForbiddenPage path={new URL(c.req.url).pathname} lang={c.get("lang")} />, 403);
    }
    await next();
  });
}

/** Gate that accepts any one of the given permissions (e.g. view OR manage). */
export function requireAnyPermission(...perms: Permission[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const granted = c.get("perms");
    if (!granted || !perms.some((p) => granted.has(p))) {
      return c.html(<ForbiddenPage path={new URL(c.req.url).pathname} lang={c.get("lang")} />, 403);
    }
    await next();
  });
}
