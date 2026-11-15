import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

/** The Worker is reached through its own origin so the canonical-host and CSRF
 *  middleware see the same request a browser would send. */
const HOST = "https://www.mmgoodnewshr.online";

/** Seeded by migrations: Super Admin over every state. */
const ADMIN_ID = 1;
/** Custom role: users.manage + roles.manage, but only assigned region 1. */
const SCOPED_ADMIN_ID = 2;
/** Seeded Viewer role, assigned region 1: no admin permissions at all. */
const VIEWER_ID = 3;

/** user id -> the raw session token used in the Cookie header. */
const sessions = new Map<number, string>();

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Creates a live server-side session the same way the app does (only the raw
 *  token lives in the cookie; the database keeps its SHA-256). */
async function createSession(userId: number, ttlSeconds = 3600): Promise<string> {
  const token = `test-${userId}-${crypto.randomUUID()}`;
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
  )
    .bind(await sha256Hex(token), userId, Math.floor(Date.now() / 1000) + ttlSeconds)
    .run();
  return token;
}

function fetchAs(path: string, token: string | undefined, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token) headers.set("Cookie", `session=${token}`);
  return SELF.fetch(`${HOST}${path}`, { ...init, headers, redirect: "manual" });
}

function getAs(path: string, userId?: number): Promise<Response> {
  return fetchAs(path, userId ? sessions.get(userId) : undefined);
}

/** A same-origin form post, which is what the CSRF guard expects. */
function postAs(path: string, userId: number, form: Record<string, string> = {}): Promise<Response> {
  return fetchAs(path, sessions.get(userId), {
    method: "POST",
    headers: { Origin: HOST, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
  });
}

beforeAll(async () => {
  const db = env.DB;
  // The seeded admin still has "must change password" set; clear it so the
  // dashboard/admin pages are reachable in tests.
  await db.prepare("UPDATE users SET must_change_password = 0 WHERE id = 1").run();
  await db.batch([
    // A scoped manager: holds the admin permissions but only for region 1.
    db.prepare("INSERT INTO roles (id, name, description, is_system) VALUES (5, 'Scoped User Manager', 'test', 0)"),
    db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (5, 'dashboard.view')"),
    db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (5, 'members.view')"),
    db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (5, 'users.manage')"),
    db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (5, 'roles.manage')"),
    db.prepare("INSERT INTO users (id, username, password_hash, active, must_change_password) VALUES (2, 'scopedadmin', 'x', 1, 0)"),
    db.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (2, 5)"),
    db.prepare("INSERT INTO user_state_assignments (user_id, region_id) VALUES (2, 1)"),
    // A plain state-scoped viewer (seeded role 4).
    db.prepare("INSERT INTO users (id, username, password_hash, active, must_change_password) VALUES (3, 'scopedviewer', 'x', 1, 0)"),
    db.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (3, 4)"),
    db.prepare("INSERT INTO user_state_assignments (user_id, region_id) VALUES (3, 1)"),
    // Structures in the viewer's state, another state, and shared with all.
    db.prepare("INSERT INTO lookup_options (type, label, active, sort_order, region_id) VALUES ('home_cell', 'Scoped Cell A', 1, 1, 1)"),
    db.prepare("INSERT INTO lookup_options (type, label, active, sort_order, region_id) VALUES ('home_cell', 'Other Cell B', 1, 2, 2)"),
    db.prepare("INSERT INTO lookup_options (type, label, active, sort_order, region_id) VALUES ('home_cell', 'Shared Cell C', 1, 3, 0)"),
    db.prepare("INSERT INTO lookup_options (type, label, active, sort_order, region_id) VALUES ('township', 'Scoped Township A', 1, 1, 1)"),
    db.prepare("INSERT INTO lookup_options (type, label, active, sort_order, region_id) VALUES ('township', 'Other Township B', 1, 2, 2)"),
  ]);
  sessions.set(ADMIN_ID, await createSession(ADMIN_ID));
  sessions.set(SCOPED_ADMIN_ID, await createSession(SCOPED_ADMIN_ID));
  sessions.set(VIEWER_ID, await createSession(VIEWER_ID));
});

describe("anonymous and expired sessions", () => {
  it("redirects a visitor without a session to the login page", async () => {
    const res = await fetchAs("/admin/users", undefined);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("treats an expired session as signed out", async () => {
    const expired = await createSession(VIEWER_ID, -60);
    const res = await fetchAs("/admin/users", expired);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/login");
  });
});

describe("app-wide account and role settings", () => {
  it("lets an all-state administrator open account management", async () => {
    expect((await getAs("/admin/users", ADMIN_ID)).status).toBe(200);
    expect((await getAs("/admin/roles", ADMIN_ID)).status).toBe(200);
    expect((await getAs("/admin/branding", ADMIN_ID)).status).toBe(200);
  });

  it("refuses account management to a state-scoped manager", async () => {
    const res = await getAs("/admin/users", SCOPED_ADMIN_ID);
    expect(res.status).toBe(403);
  });

  it("refuses role management to a state-scoped manager", async () => {
    expect((await getAs("/admin/roles", SCOPED_ADMIN_ID)).status).toBe(403);
    expect((await getAs("/admin/roles/1/edit", SCOPED_ADMIN_ID)).status).toBe(403);
  });

  it("refuses login branding changes to a state-scoped manager", async () => {
    expect((await getAs("/admin/branding", SCOPED_ADMIN_ID)).status).toBe(403);
  });

  it("refuses account creation from a state-scoped manager and writes nothing", async () => {
    const before = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
    const res = await postAs("/admin/users", SCOPED_ADMIN_ID, {
      username: "escalated",
      password: "Str0ng!Passw0rd",
      roles: "1",
      all_states: "1",
      active: "1",
    });
    expect(res.status).toBe(403);
    const after = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
    expect(after?.n).toBe(before?.n);
  });

  it("refuses password resets on other accounts from a state-scoped manager", async () => {
    const res = await postAs("/admin/users/1", SCOPED_ADMIN_ID, {
      username: "admin",
      new_password: "Str0ng!Passw0rd",
      roles: "1",
      all_states: "1",
      active: "1",
    });
    expect(res.status).toBe(403);
    const row = await env.DB.prepare("SELECT username FROM users WHERE id = 1").first<{ username: string }>();
    expect(row?.username).toBe("admin");
  });

  it("refuses admin pages to an account without admin permissions", async () => {
    expect((await getAs("/admin/users", VIEWER_ID)).status).toBe(403);
  });

  it("still serves ordinary pages to the scoped manager", async () => {
    expect((await getAs("/members", SCOPED_ADMIN_ID)).status).toBe(200);
  });
});

describe("role and account safety", () => {
  it("keeps account and role management on the seeded Super Admin role", async () => {
    const res = await postAs("/admin/roles/1", ADMIN_ID, {
      name: "Super Admin",
      description: "",
      permissions: "members.view",
    });
    expect(res.status).toBe(302);
    const rows = await env.DB.prepare(
      "SELECT permission FROM role_permissions WHERE role_id = 1",
    ).all<{ permission: string }>();
    const granted = new Set(rows.results.map((r) => r.permission));
    expect(granted.has("users.manage")).toBe(true);
    expect(granted.has("roles.manage")).toBe(true);
  });

  it("hides app-wide admin links from a state-scoped manager", async () => {
    const scopedHtml = await (await getAs("/members", SCOPED_ADMIN_ID)).text();
    expect(scopedHtml).not.toContain('href="/admin/users"');
    const adminHtml = await (await getAs("/members", ADMIN_ID)).text();
    expect(adminHtml).toContain('href="/admin/users"');
  });

  it("advertises prerender rules on HTML pages only", async () => {
    const page = await fetchAs("/login", undefined);
    expect(page.headers.get("speculation-rules")).toBe('"/speculation-rules.json"');
    const rules = await SELF.fetch(`${HOST}/speculation-rules.json`);
    expect(rules.status).toBe(200);
    expect(rules.headers.get("content-type")).toContain("application/speculationrules+json");
    const body = (await rules.json()) as { prerender?: unknown[] };
    expect(Array.isArray(body.prerender)).toBe(true);
  });
});

describe("dashboard structure scope", () => {
  it("only offers Home Cells and Townships inside the account's states", async () => {
    const res = await getAs("/", VIEWER_ID);
    expect(res.status).toBe(200);
    const html = await res.text();
    // Inside the assigned state, and shared across all states.
    expect(html).toContain("Scoped Cell A");
    expect(html).toContain("Shared Cell C");
    expect(html).toContain("Scoped Township A");
    // Another state's structures must not leak into the filter pickers.
    expect(html).not.toContain("Other Cell B");
    expect(html).not.toContain("Other Township B");
  });
});
