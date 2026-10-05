import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { eq, inArray } from "drizzle-orm";
import type { AppEnv } from "./env";
import { getDb } from "./db/client";
import { rolePermissions, userRoles, userStateAssignments } from "./db/schema";
import { ALL_STATES_WILDCARD, type Permission } from "./rbac";
import { getSessionUser } from "./session";
import { ForbiddenPage } from "./views/errors";

export type Access = {
  perms: Set<string>;
  scopeAll: boolean;
  stateIds: number[];
};

/** Loads effective permissions (union of the user's roles) and state scope. */
export async function loadAccess(db: ReturnType<typeof getDb>, userId: number): Promise<Access> {
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

  return { perms: new Set(permRows.map((r) => r.permission)), scopeAll, stateIds };
}

/** Redirects to /login when no live session; loads perms + scope into context vars. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const db = getDb(c.env);
  const token = getCookie(c, "session");
  const user = token ? await getSessionUser(db, token) : null;
  if (!user) return c.redirect("/login", 302);

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
