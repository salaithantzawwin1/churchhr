import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

/** Same origin the browser uses, so the CSRF/host middleware accepts the post. */
const HOST = "https://www.mmgoodnewshr.online";
const ADMIN_ID = 1;

let token: string;
let homeCellId: number;

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function createSession(userId: number): Promise<string> {
  const raw = `test-${userId}-${crypto.randomUUID()}`;
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256Hex(raw), userId, Math.floor(Date.now() / 1000) + 3600)
    .run();
  return raw;
}

function getAs(path: string): Promise<Response> {
  return SELF.fetch(`${HOST}${path}`, {
    headers: { Cookie: `session=${token}` },
    redirect: "manual",
  });
}

function postAs(path: string, form: Record<string, string>): Promise<Response> {
  return SELF.fetch(`${HOST}${path}`, {
    method: "POST",
    headers: {
      Cookie: `session=${token}`,
      Origin: HOST,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form).toString(),
    redirect: "manual",
  });
}

/** A minimal valid WebP data URL, the shape the browser resizer sends. */
function webpDataUrl(): string {
  const bytes = new Uint8Array(40);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return `data:image/webp;base64,${btoa(bin)}`;
}

async function memberId(name: string): Promise<number> {
  const row = await env.DB.prepare("SELECT id FROM members WHERE name_english = ?")
    .bind(name).first<{ id: number }>();
  if (!row) throw new Error(`missing member: ${name}`);
  return row.id;
}

async function memberCount(): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM members").first<{ n: number }>();
  return row?.n ?? 0;
}

async function familyId(name: string): Promise<number> {
  const row = await env.DB.prepare("SELECT id FROM families WHERE name = ?")
    .bind(name).first<{ id: number }>();
  if (!row) throw new Error(`missing household: ${name}`);
  return row.id;
}

beforeAll(async () => {
  const db = env.DB;
  // The seeded admin still has "must change password" set.
  await db.prepare("UPDATE users SET must_change_password = 0 WHERE id = 1").run();
  await db.prepare(
    "INSERT INTO lookup_options (type, label, active, sort_order, region_id) VALUES ('home_cell', 'Guard Cell', 1, 1, 1)",
  ).run();
  await db.prepare(
    "INSERT INTO lookup_options (type, label, active, sort_order, region_id) VALUES ('home_cell', 'Other State Cell', 1, 2, 2)",
  ).run();
  const cell = await db.prepare(
    "SELECT id FROM lookup_options WHERE type = 'home_cell' AND label = 'Guard Cell'",
  ).first<{ id: number }>();
  homeCellId = cell!.id;

  // One member to collide with, and one that only the self-edit test touches.
  await db.prepare(
    "INSERT INTO members (name_english, region_id, relationship, created_by, phone) VALUES ('Dup Target', 1, '', 1, '0911111111')",
  ).run();
  await db.prepare(
    "INSERT INTO members (name_english, region_id, relationship, created_by) VALUES ('Edit Only', 1, '', 1)",
  ).run();
  token = await createSession(ADMIN_ID);
});

describe("member duplicate warning", () => {
  it("warns on the same name spelling and saves nothing yet", async () => {
    const before = await memberCount();
    const res = await postAs("/members", {
      name_english: "dup  target.",
      region_id: "1",
      home_cell_id: String(homeCellId),
      phone: "0999999999",
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("A member with the same details may already exist");
    expect(html).toContain("Save anyway");
    expect(html).toContain(`/members/${await memberId("Dup Target")}`);
    expect(await memberCount()).toBe(before);
  });

  it("does not warn about the member being edited", async () => {
    const id = await memberId("Edit Only");
    const res = await postAs(`/members/${id}`, {
      name_english: "Edit Only",
      region_id: "1",
      home_cell_id: String(homeCellId),
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("ok=member-updated");
  });

  it("keeps the uploaded photo through the warning and stores it on Save anyway", async () => {
    const photo = webpDataUrl();
    const form = {
      name_english: "Dup Target",
      region_id: "1",
      home_cell_id: String(homeCellId),
      phone: "0999999999",
      photo_data: photo,
    };
    const warned = await postAs("/members", form);
    expect(warned.status).toBe(200);
    const html = await warned.text();
    // The hidden field and the preview both carry the upload again, so the
    // second submit still has the image.
    expect(html).toContain(`value="${photo}"`);
    expect(html).toContain(`src="${photo}"`);

    const saved = await postAs("/members", { ...form, confirm_duplicate: "1" });
    expect(saved.status).toBe(302);
    expect(saved.headers.get("location")).toContain("ok=member-created");
    const row = await env.DB.prepare(
      "SELECT length(photo) AS n FROM members WHERE name_english = 'Dup Target' ORDER BY id DESC LIMIT 1",
    ).first<{ n: number | null }>();
    expect(row?.n).toBeGreaterThan(0);
  });
});

describe("household quick-add Home Cell guard", () => {
  it("refuses a new member when neither the household nor the form has a cell", async () => {
    await env.DB.prepare(
      "INSERT INTO families (name, region_id, created_by) VALUES ('No Cell Household', 1, 1)",
    ).run();
    const id = await familyId("No Cell Household");
    const before = await memberCount();

    const res = await postAs(`/admin/households/${id}/add-member`, {
      name_english: "Homeless Member",
      region_id: "1",
      relationship: "other",
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Please choose a Home Cell");
    expect(await memberCount()).toBe(before);
  });

  it("saves once the form supplies a cell", async () => {
    const id = await familyId("No Cell Household");
    const res = await postAs(`/admin/households/${id}/add-member`, {
      name_english: "Placed Member",
      region_id: "1",
      home_cell_id: String(homeCellId),
      relationship: "other",
    });
    expect(res.status).toBe(302);
    const row = await env.DB.prepare(
      "SELECT home_cell_id FROM members WHERE name_english = 'Placed Member'",
    ).first<{ home_cell_id: number | null }>();
    expect(row?.home_cell_id).toBe(homeCellId);
  });

  it("serves the new-member form on its own page", async () => {
    const id = await familyId("No Cell Household");
    const res = await getAs(`/admin/households/${id}/add-member/new`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(`action="/admin/households/${id}/add-member"`);
    expect(html).toContain('name="name_english"');
    expect(html).toContain('name="home_cell_id"');
  });

  it("applies the member form's option ownership rule", async () => {
    const id = await familyId("No Cell Household");
    const other = await env.DB.prepare(
      "SELECT id FROM lookup_options WHERE label = 'Other State Cell'",
    ).first<{ id: number }>();
    const res = await postAs(`/admin/households/${id}/add-member`, {
      name_english: "Cross State Member",
      region_id: "1",
      home_cell_id: String(other!.id),
      relationship: "other",
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Invalid dropdown value");
    const row = await env.DB.prepare(
      "SELECT id FROM members WHERE name_english = 'Cross State Member'",
    ).first();
    expect(row).toBeNull();
  });

  it("applies the member form's enum checks", async () => {
    const id = await familyId("No Cell Household");
    const res = await postAs(`/admin/households/${id}/add-member`, {
      name_english: "Bad Gender Member",
      region_id: "1",
      home_cell_id: String(homeCellId),
      gender: "robot",
      relationship: "other",
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Invalid gender");
  });

  it("warns about a likely duplicate and saves only on Save anyway", async () => {
    await env.DB.prepare(
      "INSERT INTO families (name, region_id, home_cell_id, created_by) VALUES ('Dup Household', 1, ?, 1)",
    ).bind(homeCellId).run();
    const id = await familyId("Dup Household");
    const existing = await memberId("Dup Target");
    const before = await memberCount();
    const form = {
      name_english: "dup  target",
      region_id: "1",
      home_cell_id: String(homeCellId),
      relationship: "other",
    };

    const warned = await postAs(`/admin/households/${id}/add-member`, form);
    expect(warned.status).toBe(200);
    const html = await warned.text();
    expect(html).toContain("A member with the same details may already exist");
    expect(html).toContain("Save anyway");
    expect(html).toContain(`/members/${existing}`);
    // The warning re-renders the form with what was typed and saves nothing.
    expect(html).toContain('value="dup  target"');
    expect(await memberCount()).toBe(before);

    const saved = await postAs(`/admin/households/${id}/add-member`, {
      ...form, confirm_duplicate: "1",
    });
    expect(saved.status).toBe(302);
    expect(await memberCount()).toBe(before + 1);
  });

  it("uses the household's own cell when the form leaves it blank", async () => {
    await env.DB.prepare(
      "INSERT INTO families (name, region_id, home_cell_id, created_by) VALUES ('Cell Household', 1, ?, 1)",
    ).bind(homeCellId).run();
    const id = await familyId("Cell Household");
    const res = await postAs(`/admin/households/${id}/add-member`, {
      name_english: "Inherited Member",
      region_id: "1",
      relationship: "other",
    });
    expect(res.status).toBe(302);
    const row = await env.DB.prepare(
      "SELECT home_cell_id FROM members WHERE name_english = 'Inherited Member'",
    ).first<{ home_cell_id: number | null }>();
    expect(row?.home_cell_id).toBe(homeCellId);
  });
});
