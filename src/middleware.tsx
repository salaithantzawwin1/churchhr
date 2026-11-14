import { createMiddleware } from "hono/factory";
import { getCookie, setCookie } from "hono/cookie";
import { eq, inArray, sql } from "drizzle-orm";
import type { AppEnv } from "./env";
import { getDb, type DB } from "./db/client";
import { rolePermissions, userHomeCellAssignments, userRoles, userStateAssignments, users } from "./db/schema";
import { ALL_STATES_WILDCARD, type Permission } from "./rbac";
import { nowSeconds, sessionTokenHash, type SessionUser } from "./session";
import { LANG_COOKIE, langFromQuery, normalizeLang } from "./i18n";
import { ForbiddenPage } from "./views/errors";

export type Access = {
  perms: Set<string>;
  scopeAll: boolean;
  stateIds: number[];
  homeCellIds: number[];
};

/** Session, permissions and scope come back in a single statement, cached per
 * isolate for a short window. Production D1 round-trips cost ~200ms each and
 * this path used to run five of them before any page handler started, which is
 * what made moving between pages feel slow. Edits clear the cache explicitly. */
const ACCESS_TTL_MS = 15_000;
type SessionAccess = { user: SessionUser; access: Access };
const sessionCache = new Map<string, { at: number; value: SessionAccess }>();
const SESSION_CACHE_MAX = 500;

/** Forgets cached sessions/permissions after a role or account change. */
export function clearAccessCache(): void {
  sessionCache.clear();
}

/** Drops one cached session the moment it is destroyed (logout), so the cookie
 * cannot keep working from this isolate's cache. */
export function forgetSession(token: string | null | undefined): void {
  if (token) sessionCache.delete(token);
}

type SessionAccessRow = {
  id: number;
  username: string;
  mustChangePassword: number;
  active: number;
  language: string | null;
  perms: string | null;
  states: string | null;
  cells: string | null;
};

/** One statement: the live session's user plus its permission and scope sets. */
async function querySessionAccess(
  db: DB, tokenHash: string, opts: { language: boolean; cells: boolean },
): Promise<SessionAccessRow | undefined> {
  const language = opts.language ? sql`u.language` : sql`NULL`;
  const cells = opts.cells
    ? sql`(SELECT GROUP_CONCAT(home_cell_id) FROM user_home_cell_assignments WHERE user_id = u.id)`
    : sql`NULL`;
  const rows = await db.all<SessionAccessRow>(sql`
    SELECT u.id, u.username, u.must_change_password AS mustChangePassword, u.active,
      ${language} AS language,
      (SELECT GROUP_CONCAT(rp.permission) FROM role_permissions rp
         WHERE rp.role_id IN (SELECT role_id FROM user_roles WHERE user_id = u.id)) AS perms,
      (SELECT GROUP_CONCAT(region_id) FROM user_state_assignments WHERE user_id = u.id) AS states,
      ${cells} AS cells
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash} AND s.expires_at > ${nowSeconds()}
    LIMIT 1`);
  return rows[0];
}

async function loadSessionAccess(db: DB, token: string): Promise<SessionAccess | null> {
  const started = Date.now();
  const hit = sessionCache.get(token);
  if (hit && started - hit.at < ACCESS_TTL_MS) return hit.value;

  const tokenHash = await sessionTokenHash(token);
  let row: SessionAccessRow | undefined;
  // Deploy-before-migration safety: drop columns/tables this database may not
  // have yet instead of failing every request.
  let withLanguage = true;
  let withCells = true;
  for (;;) {
    try {
      row = await querySessionAccess(db, tokenHash, { language: withLanguage, cells: withCells });
      break;
    } catch (err) {
      if (withCells) { withCells = false; continue; }
      if (withLanguage) { withLanguage = false; continue; }
      throw err;
    }
  }
  if (!row || row.active !== 1) return null;

  const stateList = (row.states ?? "").split(",").filter(Boolean).map(Number);
  const value: SessionAccess = {
    user: {
      id: row.id,
      username: row.username,
      mustChangePassword: row.mustChangePassword === 1,
      language: row.language ?? null,
    },
    access: {
      perms: new Set((row.perms ?? "").split(",").filter(Boolean)),
      scopeAll: stateList.includes(ALL_STATES_WILDCARD),
      stateIds: stateList.filter((id) => Number.isInteger(id) && id !== ALL_STATES_WILDCARD),
      homeCellIds: (row.cells ?? "").split(",").filter(Boolean).map(Number).filter((id) => Number.isInteger(id)),
    },
  };
  if (sessionCache.size > SESSION_CACHE_MAX) sessionCache.clear();
  sessionCache.set(token, { at: started, value });
  return value;
}

/** Redirects to /login when no live session; loads perms + scope into context vars. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const db = getDb(c.env);
  const token = getCookie(c, "session");
  const resolved = token ? await loadSessionAccess(db, token) : null;
  if (!resolved) return c.redirect("/login", 302);
  const user = resolved.user;

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

  const access = resolved.access;
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
