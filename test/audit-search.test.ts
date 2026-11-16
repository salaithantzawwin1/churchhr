import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

/** The Worker is reached through its own origin so the canonical-host middleware
 *  sees the request a browser would send. */
const HOST = "https://www.mmgoodnewshr.online";

/** Seeded by migrations: Super Admin over every state, with audit.view. */
const ADMIN_ID = 1;

let cookie = "";

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function createSession(userId: number): Promise<string> {
  const token = `test-audit-search-${crypto.randomUUID()}`;
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
  )
    .bind(await sha256Hex(token), userId, Math.floor(Date.now() / 1000) + 3600)
    .run();
  return token;
}

/** Rows whose summaries differ only in the characters LIKE treats as wildcards. */
async function seedTrail(): Promise<void> {
  const insert = env.DB.prepare(
    "INSERT INTO audit_log (username, action, entity, entity_id, summary, path) VALUES (?, ?, ?, ?, ?, ?)",
  );
  await env.DB.batch([
    insert.bind("admin", "member.update", "member", "1", "100% paid", "/members/1"),
    insert.bind("admin", "member.update", "member", "2", "100x paid", "/members/2"),
    insert.bind("admin", "member.update", "member", "3", "a_b note", "/members/3"),
    insert.bind("admin", "member.update", "member", "4", "axb note", "/members/4"),
  ]);
}

/** Runs one search and returns the rendered page. */
async function search(term: string): Promise<string> {
  const res = await SELF.fetch(`${HOST}/admin/audit?q=${encodeURIComponent(term)}`, {
    headers: { Cookie: `session=${cookie}` },
    redirect: "manual",
  });
  expect(res.status, `searching ${JSON.stringify(term)} should render the page`).toBe(200);
  return res.text();
}

beforeAll(async () => {
  // The seeded admin still has "must change password" set, which would redirect
  // every page to the profile form.
  await env.DB.prepare("UPDATE users SET must_change_password = 0 WHERE id = 1").run();
  cookie = await createSession(ADMIN_ID);
  await seedTrail();
});

describe("audit search", () => {
  it("matches a typed % as the character, not as a wildcard", async () => {
    const html = await search("100%");
    expect(html).toContain("100% paid");
    // The regression: % was passed straight into LIKE, so this row matched too.
    expect(html).not.toContain("100x paid");
  });

  it("matches a typed _ as the character, not as a single-character wildcard", async () => {
    const html = await search("a_b");
    expect(html).toContain("a_b note");
    expect(html).not.toContain("axb note");
  });

  it("still matches ordinary fragments", async () => {
    const html = await search("100");
    expect(html).toContain("100% paid");
    expect(html).toContain("100x paid");
  });

  it("does not match a fragment that only a wildcard would reach", async () => {
    // "100_ paid" used to match "100x paid"; escaped, it matches neither row.
    const html = await search("100_ paid");
    expect(html).not.toContain("100x paid");
    expect(html).not.toContain("100% paid");
  });
});
