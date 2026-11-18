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
/** Region-1 data entry: writes reports and members, no admin permissions. */
const ENTRY_ID = 4;
/** Region-1 report reviewer: reviews/edits/deletes reports in its own state. */
const REVIEWER_ID = 5;
/** Region-2 author: owns the out-of-scope report and household used below. */
const OTHER_AUTHOR_ID = 6;
/** Region-1 records manager: full member CRUD, for household scope checks. */
const RECORDS_ID = 7;
/** Region-1 structure manager: churches/clusters in its state, and options.manage
 *  to prove church-wide departments and positions stay all-state only. */
const STRUCT_ID = 8;

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

/** A report date in Myanmar time, so seeded rows land inside the app's default
 *  "last 7 days" window. */
function reportDay(daysAgo: number): string {
  return new Date(Date.now() + 6.5 * 3_600_000 - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

async function idOf(sqlText: string, value: string): Promise<number> {
  const row = await env.DB.prepare(sqlText).bind(value).first<{ id: number }>();
  if (!row) throw new Error(`missing seeded row: ${value}`);
  return row.id;
}
const reportId = (title: string) => idOf("SELECT id FROM activity_reports WHERE title = ?", title);
const familyId = (name: string) => idOf("SELECT id FROM families WHERE name = ?", name);
const memberId = (name: string) => idOf("SELECT id FROM members WHERE name_english = ?", name);
const churchId = (name: string) => idOf("SELECT id FROM regional_churches WHERE name = ?", name);
const clusterId = (name: string) => idOf("SELECT id FROM supervision_clusters WHERE name = ?", name);

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

    // Report and household scope fixtures: a region-1 reviewer, a region-2
    // author, a region-1 records manager and a region-1 data entry account.
    db.prepare("INSERT INTO roles (id, name, description, is_system) VALUES (6, 'Scoped Report Reviewer', 'test', 0)"),
    db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (6, 'members.view')"),
    db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (6, 'reports.view')"),
    db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (6, 'reports.review')"),
    db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (6, 'reports.update')"),
    db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (6, 'reports.delete')"),
    db.prepare("INSERT INTO roles (id, name, description, is_system) VALUES (7, 'Scoped Records Manager', 'test', 0)"),
    db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (7, 'dashboard.view')"),
    db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (7, 'members.view')"),
    db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (7, 'members.create')"),
    db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (7, 'members.update')"),
    db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (7, 'members.delete')"),
    db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (7, 'members.export')"),
    db.prepare("INSERT INTO users (id, username, password_hash, active, must_change_password) VALUES (4, 'scopedentry', 'x', 1, 0)"),
    db.prepare("INSERT INTO users (id, username, password_hash, active, must_change_password) VALUES (5, 'scopedreviewer', 'x', 1, 0)"),
    db.prepare("INSERT INTO users (id, username, password_hash, active, must_change_password) VALUES (6, 'otherauthor', 'x', 1, 0)"),
    db.prepare("INSERT INTO users (id, username, password_hash, active, must_change_password) VALUES (7, 'scopedrecords', 'x', 1, 0)"),
    db.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (4, 3)"),
    db.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (5, 6)"),
    db.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (6, 3)"),
    db.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (7, 7)"),
    db.prepare("INSERT INTO user_state_assignments (user_id, region_id) VALUES (4, 1)"),
    db.prepare("INSERT INTO user_state_assignments (user_id, region_id) VALUES (5, 1)"),
    db.prepare("INSERT INTO user_state_assignments (user_id, region_id) VALUES (6, 2)"),
    db.prepare("INSERT INTO user_state_assignments (user_id, region_id) VALUES (7, 1)"),
    // Reports: A is in scope, B is another state's, C is filed in region 1 by a
    // region-2 author, D exists to be deleted by the scoped reviewer.
    db.prepare("INSERT INTO activity_reports (report_date, author_id, region_id, title, body, status) VALUES (?, 4, 1, 'Report In Scope A', 'body', 'submitted')").bind(reportDay(1)),
    db.prepare("INSERT INTO activity_reports (report_date, author_id, region_id, title, body, status) VALUES (?, 6, 2, 'Report Out Of Scope B', 'body', 'submitted')").bind(reportDay(1)),
    db.prepare("INSERT INTO activity_reports (report_date, author_id, region_id, title, body, status) VALUES (?, 6, 1, 'Report In Scope C', 'body', 'submitted')").bind(reportDay(2)),
    db.prepare("INSERT INTO activity_reports (report_date, author_id, region_id, title, body, status) VALUES (?, 4, 1, 'Report To Delete D', 'body', 'submitted')").bind(reportDay(3)),
    // Households: one in region 1, one in region 2 that also owns a member.
    db.prepare("INSERT INTO families (name, region_id, created_by) VALUES ('In-Scope Household', 1, 7)"),
    db.prepare("INSERT INTO families (name, region_id, created_by) VALUES ('Out-of-Scope Household', 2, 7)"),
    db.prepare("INSERT INTO members (name_english, region_id, family_id, relationship, created_by) VALUES ('Out Member', 2, (SELECT id FROM families WHERE name = 'Out-of-Scope Household'), 'other', 7)"),
    db.prepare("INSERT INTO members (name_english, region_id, relationship, created_by) VALUES ('In Member', 1, '', 7)"),
    db.prepare("INSERT INTO members (name_english, region_id, relationship, created_by) VALUES ('Delete Me Member', 1, '', 7)"),

    // Organization scope fixtures: region-1 and region-2 churches and clusters.
    db.prepare("INSERT INTO roles (id, name, description, is_system) VALUES (8, 'Scoped Structure Manager', 'test', 0)"),
    db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (8, 'members.view')"),
    db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (8, 'structures.view')"),
    db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (8, 'structures.create')"),
    db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (8, 'structures.update')"),
    db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (8, 'structures.delete')"),
    db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (8, 'options.manage')"),
    db.prepare("INSERT INTO users (id, username, password_hash, active, must_change_password) VALUES (8, 'scopedstructures', 'x', 1, 0)"),
    db.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (8, 8)"),
    db.prepare("INSERT INTO user_state_assignments (user_id, region_id) VALUES (8, 1)"),
    db.prepare("INSERT INTO regional_churches (name, region_id) VALUES ('In-Scope Church', 1)"),
    db.prepare("INSERT INTO regional_churches (name, region_id) VALUES ('Out-of-Scope Church', 2)"),
    db.prepare("INSERT INTO regional_churches (name, region_id) VALUES ('Delete Me Church', 1)"),
    db.prepare("INSERT INTO supervision_clusters (name, region_id) VALUES ('In-Scope Cluster', 1)"),
    db.prepare("INSERT INTO supervision_clusters (name, region_id) VALUES ('Out-of-Scope Cluster', 2)"),
    db.prepare("INSERT INTO supervision_clusters (name, region_id) VALUES ('Delete Me Cluster', 1)"),
    // A role that never received the granular structures.* rows: options.manage
    // alone still lets it manage structure (canManageStructure), so the account
    // dialog has to show those permissions as granted, not denied.
    db.prepare("INSERT INTO roles (id, name, description, is_system) VALUES (10, 'Legacy Options Manager', 'test', 0)"),
    db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (10, 'options.manage')"),
    db.prepare("INSERT INTO users (id, username, password_hash, active, must_change_password) VALUES (9, 'optionsmgr', 'x', 1, 0)"),
    db.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (9, 10)"),
    db.prepare("INSERT INTO user_state_assignments (user_id, region_id) VALUES (9, 1)"),
  ]);
  for (const id of [ADMIN_ID, SCOPED_ADMIN_ID, VIEWER_ID, ENTRY_ID, REVIEWER_ID, OTHER_AUTHOR_ID, RECORDS_ID, STRUCT_ID]) {
    sessions.set(id, await createSession(id));
  }
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

  it("shows one account's allowed and missing permissions in its edit modal", async () => {
    const res = await getAs("/admin/users/3/edit?modal=1", ADMIN_ID);
    expect(res.status).toBe(200);
    const html = await res.text();
    // The Viewer holds dashboard.view and members.view, nothing that writes.
    expect(html).toContain('class="perm-row is-on" data-perm-row="members.view"');
    expect(html).toContain('class="perm-row is-off" data-perm-row="members.create"');
    expect(html).toContain('class="perm-row is-off" data-perm-row="users.manage"');
    // The pane names the role that grants the permission, so a tick is traceable.
    expect(html).toContain('data-perm-row="members.view"');
    expect(html).toContain("Viewer");
  });

  it("reads options.manage as granting every structure permission", async () => {
    const res = await getAs("/admin/users/9/edit?modal=1", ADMIN_ID);
    expect(res.status).toBe(200);
    const html = await res.text();
    // The role holds options.manage only; canManageStructure still lets it edit
    // structures, so the pane must not report those as denied.
    expect(html).toContain('class="perm-row is-on" data-perm-row="options.manage"');
    expect(html).toContain('class="perm-row is-on" data-perm-row="structures.create"');
    expect(html).toContain('class="perm-row is-on" data-perm-row="structures.delete"');
    expect(html).toContain("via options.manage");
  });

  it("keeps the password rule in a tooltip with the meter beside Generate", async () => {
    const html = await (await getAs("/admin/users/3/edit?modal=1", ADMIN_ID)).text();
    // The rule is available on the info dot instead of a permanent hint line.
    expect(html).toContain('class="field-tip"');
    expect(html).toContain("Leave blank to keep the current password");
    expect(html).not.toContain('<span class="hint">Leave blank');
    // app.js renders the strength meter into this slot, next to Generate.
    expect(html).toContain("data-strength-slot");
  });

  it("shows options.manage's structure rights on the roles list and editor", async () => {
    const list = await (await getAs("/admin/roles", ADMIN_ID)).text();
    // The list names the permissions the role can use through options.manage.
    expect(list).toContain("via options.manage");
    const modal = await (await getAs("/admin/roles/10/edit?modal=1", ADMIN_ID)).text();
    // The editor ticks them but keeps them read-only, so saving does not write
    // redundant explicit grants the role never had.
    expect(modal).toMatch(/value="structures.create"[^>]*checked[^>]*disabled/);
    expect(modal).toContain("via options.manage");
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

describe("report scope for a state-limited reviewer", () => {
  it("reads reports inside its state and refuses another state's report", async () => {
    const inScope = await getAs(`/reports/${await reportId("Report In Scope A")}`, REVIEWER_ID);
    expect(inScope.status).toBe(200);
    const outOfScope = await getAs(`/reports/${await reportId("Report Out Of Scope B")}`, REVIEWER_ID);
    expect(outOfScope.status).toBe(403);
  });

  it("cannot review a report from another state", async () => {
    const id = await reportId("Report Out Of Scope B");
    const res = await postAs(`/reports/${id}/review`, REVIEWER_ID, { review_note: "looks fine" });
    expect(res.status).toBe(403);
    const row = await env.DB.prepare("SELECT status FROM activity_reports WHERE id = ?")
      .bind(id).first<{ status: string }>();
    expect(row?.status).toBe("submitted");
  });

  it("reviews a report filed in its own state even when the author is elsewhere", async () => {
    const id = await reportId("Report In Scope C");
    const res = await postAs(`/reports/${id}/review`, REVIEWER_ID, { review_note: "checked" });
    expect(res.status).toBe(302);
    const row = await env.DB.prepare("SELECT status, reviewer_id FROM activity_reports WHERE id = ?")
      .bind(id).first<{ status: string; reviewer_id: number }>();
    expect(row?.status).toBe("reviewed");
    expect(row?.reviewer_id).toBe(REVIEWER_ID);
  });

  it("refuses to edit a report written by someone else", async () => {
    const id = await reportId("Report In Scope A");
    const res = await postAs(`/reports/${id}/edit`, REVIEWER_ID, {
      report_date: reportDay(1), region_id: "1", title: "Hijacked report", body: "x",
    });
    expect(res.status).toBe(403);
    const row = await env.DB.prepare("SELECT title FROM activity_reports WHERE id = ?")
      .bind(id).first<{ title: string }>();
    expect(row?.title).toBe("Report In Scope A");
  });

  it("refuses a delete without the author right or reports.delete", async () => {
    const id = await reportId("Report Out Of Scope B");
    const res = await postAs(`/reports/${id}/delete`, ENTRY_ID);
    expect(res.status).toBe(403);
    const row = await env.DB.prepare("SELECT id FROM activity_reports WHERE id = ?").bind(id).first();
    expect(row).not.toBeNull();
  });

  it("limits the team list and CSV export to the reviewer's states", async () => {
    const list = await getAs("/reports?scope=team", REVIEWER_ID);
    expect(list.status).toBe(200);
    const html = await list.text();
    expect(html).toContain("Report In Scope A");
    expect(html).not.toContain("Report Out Of Scope B");

    const csv = await getAs("/reports/export?scope=team", REVIEWER_ID);
    expect(csv.status).toBe(200);
    const text = await csv.text();
    expect(text).toContain("Report In Scope A");
    expect(text).not.toContain("Report Out Of Scope B");
  });

  it("lets a scoped manager delete a report inside its state", async () => {
    const id = await reportId("Report To Delete D");
    const res = await postAs(`/reports/${id}/delete`, REVIEWER_ID);
    expect(res.status).toBe(302);
    const row = await env.DB.prepare("SELECT id FROM activity_reports WHERE id = ?").bind(id).first();
    expect(row).toBeNull();
  });
});

describe("household scope", () => {
  it("shows only households inside the account's states", async () => {
    const res = await getAs("/admin/households", RECORDS_ID);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("In-Scope Household");
    expect(html).not.toContain("Out-of-Scope Household");
  });

  it("hides a household from another state", async () => {
    const id = await familyId("Out-of-Scope Household");
    const res = await getAs(`/admin/households/${id}`, RECORDS_ID);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("err-notfound");
  });

  it("refuses edits and deletes of another state's household", async () => {
    const id = await familyId("Out-of-Scope Household");
    const edit = await postAs(`/admin/households/${id}`, RECORDS_ID, {
      name: "Hijacked Household", region_id: "2", township: "", phone: "", address: "", notes: "",
    });
    expect(edit.status).toBe(302);
    expect(edit.headers.get("location")).toContain("err-notfound");

    const del = await postAs(`/admin/households/${id}/delete`, RECORDS_ID);
    expect(del.status).toBe(302);
    expect(del.headers.get("location")).toContain("err-notfound");

    const row = await env.DB.prepare("SELECT name FROM families WHERE id = ?")
      .bind(id).first<{ name: string }>();
    expect(row?.name).toBe("Out-of-Scope Household");
  });

  it("refuses attaching a member from another state", async () => {
    const family = await familyId("In-Scope Household");
    const member = await memberId("Out Member");
    const res = await postAs(`/admin/households/${family}/attach`, RECORDS_ID, {
      member_id: String(member), relationship: "spouse",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("err-notfound");
    const row = await env.DB.prepare("SELECT family_id FROM members WHERE id = ?")
      .bind(member).first<{ family_id: number | null }>();
    expect(row?.family_id).not.toBe(family);
  });

  it("still attaches and detaches an in-scope member", async () => {
    const family = await familyId("In-Scope Household");
    const member = await memberId("In Member");

    const attach = await postAs(`/admin/households/${family}/attach`, RECORDS_ID, {
      member_id: String(member), relationship: "spouse",
    });
    expect(attach.status).toBe(302);
    expect(attach.headers.get("location")).toContain("hh.attached");
    const attached = await env.DB.prepare("SELECT family_id FROM members WHERE id = ?")
      .bind(member).first<{ family_id: number | null }>();
    expect(attached?.family_id).toBe(family);

    const detach = await postAs(`/admin/households/${family}/detach`, RECORDS_ID, {
      member_id: String(member),
    });
    expect(detach.status).toBe(302);
    expect(detach.headers.get("location")).toContain("hh.detached");
    const detached = await env.DB.prepare("SELECT family_id FROM members WHERE id = ?")
      .bind(member).first<{ family_id: number | null }>();
    expect(detached?.family_id).toBeNull();
  });
});

describe("member scope", () => {
  it("reads an in-scope member and hides another state's member", async () => {
    const inScope = await getAs(`/members/${await memberId("In Member")}`, RECORDS_ID);
    expect(inScope.status).toBe(200);
    expect(await inScope.text()).toContain("In Member");

    const outOfScope = await getAs(`/members/${await memberId("Out Member")}`, RECORDS_ID);
    expect(outOfScope.status).toBe(302);
    expect(outOfScope.headers.get("location")).toContain("err-notfound");
  });

  it("refuses an edit to another state's member and stores nothing", async () => {
    const id = await memberId("Out Member");
    const res = await postAs(`/members/${id}`, RECORDS_ID, {
      name_english: "Hijacked Member", region_id: "2", status: "active",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("err-notfound");
    const row = await env.DB.prepare("SELECT name_english FROM members WHERE id = ?")
      .bind(id).first<{ name_english: string }>();
    expect(row?.name_english).toBe("Out Member");
  });

  it("edits an in-scope member", async () => {
    const id = await memberId("In Member");
    const res = await postAs(`/members/${id}`, RECORDS_ID, {
      name_english: "In Member Renamed", region_id: "1", status: "active",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("ok=member-updated");
    const row = await env.DB.prepare("SELECT name_english FROM members WHERE id = ?")
      .bind(id).first<{ name_english: string }>();
    expect(row?.name_english).toBe("In Member Renamed");
  });

  it("refuses deleting another state's member and keeps the row", async () => {
    const id = await memberId("Out Member");
    const res = await postAs(`/members/${id}/delete`, RECORDS_ID);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("err-notfound");
    const row = await env.DB.prepare("SELECT id FROM members WHERE id = ?").bind(id).first();
    expect(row).not.toBeNull();
  });

  it("deletes an in-scope member", async () => {
    const id = await memberId("Delete Me Member");
    const res = await postAs(`/members/${id}/delete`, RECORDS_ID);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("ok=member-deleted");
    const row = await env.DB.prepare("SELECT id FROM members WHERE id = ?").bind(id).first();
    expect(row).toBeNull();
  });

  it("exports only the account's states even when asked for another state", async () => {
    const res = await getAs("/members/export", RECORDS_ID);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const csv = await res.text();
    expect(csv).toContain("In Member");
    expect(csv).not.toContain("Out Member");

    // A foreign state filter cannot widen the export past the account scope.
    const forced = await getAs("/members/export?state=2", RECORDS_ID);
    expect(forced.status).toBe(200);
    const forcedCsv = await forced.text();
    expect(forcedCsv).not.toContain("Out Member");
    expect(forcedCsv.trim().split("\n")).toHaveLength(1);
  });
});

describe("organization structure scope", () => {
  it("lists only regional churches inside the account's states", async () => {
    const res = await getAs("/organization/regional-churches", STRUCT_ID);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("In-Scope Church");
    expect(html).not.toContain("Out-of-Scope Church");
  });

  it("refuses the edit form for another state's church", async () => {
    const id = await churchId("Out-of-Scope Church");
    const res = await getAs(`/organization/regional-churches/${id}/edit`, STRUCT_ID);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("err-notfound");
  });

  it("refuses updates and deletes of another state's church", async () => {
    const id = await churchId("Out-of-Scope Church");
    const upd = await postAs(`/organization/regional-churches/${id}`, STRUCT_ID, {
      name: "Hijacked Church", region_id: "2", active: "1", sort_order: "0",
    });
    expect(upd.status).toBe(303);
    expect(upd.headers.get("location")).toContain("err-notfound");

    const del = await postAs(`/organization/regional-churches/${id}/delete`, STRUCT_ID);
    expect(del.status).toBe(303);
    expect(del.headers.get("location")).toContain("err-notfound");

    const row = await env.DB.prepare("SELECT name FROM regional_churches WHERE id = ?")
      .bind(id).first<{ name: string }>();
    expect(row?.name).toBe("Out-of-Scope Church");
  });

  it("updates and deletes a church inside its own state", async () => {
    const id = await churchId("In-Scope Church");
    const upd = await postAs(`/organization/regional-churches/${id}`, STRUCT_ID, {
      name: "In-Scope Church Renamed", region_id: "1", active: "1", sort_order: "0",
    });
    expect(upd.status).toBe(303);
    expect(upd.headers.get("location")).toContain("ok=regional-updated");
    const renamed = await env.DB.prepare("SELECT name FROM regional_churches WHERE id = ?")
      .bind(id).first<{ name: string }>();
    expect(renamed?.name).toBe("In-Scope Church Renamed");

    const doomed = await churchId("Delete Me Church");
    const del = await postAs(`/organization/regional-churches/${doomed}/delete`, STRUCT_ID);
    expect(del.status).toBe(303);
    expect(del.headers.get("location")).toContain("ok=regional-deleted");
    expect(await env.DB.prepare("SELECT id FROM regional_churches WHERE id = ?").bind(doomed).first()).toBeNull();
  });

  it("lists only clusters inside the account's states", async () => {
    const res = await getAs("/organization/clusters", STRUCT_ID);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("In-Scope Cluster");
    expect(html).not.toContain("Out-of-Scope Cluster");
  });

  it("refuses updates and deletes of another state's cluster", async () => {
    const id = await clusterId("Out-of-Scope Cluster");
    const upd = await postAs(`/organization/clusters/${id}`, STRUCT_ID, {
      name: "Hijacked Cluster", region_id: "2", active: "1", sort_order: "0",
    });
    expect(upd.status).toBe(303);
    expect(upd.headers.get("location")).toContain("err-notfound");

    const del = await postAs(`/organization/clusters/${id}/delete`, STRUCT_ID);
    expect(del.status).toBe(303);
    expect(del.headers.get("location")).toContain("err-notfound");

    const row = await env.DB.prepare("SELECT name FROM supervision_clusters WHERE id = ?")
      .bind(id).first<{ name: string }>();
    expect(row?.name).toBe("Out-of-Scope Cluster");
  });

  it("updates and deletes a cluster inside its own state", async () => {
    const id = await clusterId("In-Scope Cluster");
    const upd = await postAs(`/organization/clusters/${id}`, STRUCT_ID, {
      name: "In-Scope Cluster Renamed", region_id: "1", active: "1", sort_order: "0",
    });
    expect(upd.status).toBe(303);
    expect(upd.headers.get("location")).toContain("ok=cluster-updated");

    const doomed = await clusterId("Delete Me Cluster");
    const del = await postAs(`/organization/clusters/${doomed}/delete`, STRUCT_ID);
    expect(del.status).toBe(303);
    expect(del.headers.get("location")).toContain("ok=cluster-deleted");
    expect(await env.DB.prepare("SELECT id FROM supervision_clusters WHERE id = ?").bind(doomed).first()).toBeNull();
  });

  it("keeps church-wide departments and positions on all-state accounts", async () => {
    expect((await getAs("/organization/departments/new", STRUCT_ID)).status).toBe(403);
    const created = await postAs("/organization/departments", STRUCT_ID, { name: "Hijacked Department" });
    expect(created.status).toBe(403);
    const dept = await env.DB.prepare("SELECT id FROM church_departments WHERE name = ?")
      .bind("Hijacked Department").first();
    expect(dept).toBeNull();

    expect((await getAs("/organization/positions", STRUCT_ID)).status).toBe(403);
    expect((await postAs("/organization/positions/1", STRUCT_ID, { name_english: "Hijacked" })).status).toBe(403);
  });
});
