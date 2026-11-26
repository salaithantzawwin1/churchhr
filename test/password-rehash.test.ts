import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { hashIterations, hashPassword } from "../src/auth";

/** The Worker is reached through its own origin so the host and CSRF middleware
 *  accept the form post, exactly like a browser sign-in. */
const HOST = "https://www.mmgoodnewshr.online";

/** PBKDF2_ITERATIONS in wrangler.jsonc — the cost new hashes are written with. */
const TARGET_ITERATIONS = 10_000;

async function insertUser(id: number, username: string, passwordHash: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO users (id, username, password_hash, active, must_change_password) VALUES (?, ?, ?, 1, 0)",
  )
    .bind(id, username, passwordHash)
    .run();
}

function signIn(username: string, password: string): Promise<Response> {
  return SELF.fetch(`${HOST}/login`, {
    method: "POST",
    headers: { Origin: HOST, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }).toString(),
    redirect: "manual",
  });
}

async function storedHash(id: number): Promise<string> {
  const row = await env.DB.prepare("SELECT password_hash FROM users WHERE id = ?")
    .bind(id)
    .first<{ password_hash: string }>();
  if (!row) throw new Error(`user ${id} missing`);
  return row.password_hash;
}

describe("sign-in upgrades an old password hash", () => {
  const OLD_COST_ID = 900;
  const OLD_COST_USER = "legacy-cost-user";
  const OLD_COST_PASSWORD = "CorrectHorse1!";

  const CURRENT_COST_ID = 901;
  const CURRENT_COST_USER = "current-cost-user";
  const CURRENT_COST_PASSWORD = "CorrectHorse2!";

  beforeAll(async () => {
    // 1,000 iterations is the weakest hash verifyPassword accepts, which stands
    // in for an account created before the configured cost was raised.
    await insertUser(
      OLD_COST_ID,
      OLD_COST_USER,
      await hashPassword(OLD_COST_PASSWORD, 1_000),
    );
    await insertUser(
      CURRENT_COST_ID,
      CURRENT_COST_USER,
      await hashPassword(CURRENT_COST_PASSWORD, TARGET_ITERATIONS),
    );
  });

  it("re-hashes at the configured cost after a correct password", async () => {
    expect(hashIterations(await storedHash(OLD_COST_ID))).toBe(1_000);

    const response = await signIn(OLD_COST_USER, OLD_COST_PASSWORD);
    expect(response.status).toBe(302);

    const upgraded = await storedHash(OLD_COST_ID);
    expect(hashIterations(upgraded)).toBe(TARGET_ITERATIONS);
    // The password still verifies against the new hash (the same plaintext, re-derived).
    expect(upgraded).not.toBe(await hashPassword(OLD_COST_PASSWORD, 1_000));
  });

  it("leaves a hash written at the configured cost untouched", async () => {
    const before = await storedHash(CURRENT_COST_ID);

    const response = await signIn(CURRENT_COST_USER, CURRENT_COST_PASSWORD);
    expect(response.status).toBe(302);

    expect(await storedHash(CURRENT_COST_ID)).toBe(before);
  });
});
