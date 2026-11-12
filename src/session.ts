import { and, eq, gt, lte } from "drizzle-orm";
import type { DB } from "./db/client";
import { sessions, users } from "./db/schema";

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export type SessionUser = {
  id: number;
  username: string;
  mustChangePassword: boolean;
  /** UI language saved on the account (null until the user picks one). */
  language: string | null;
};

type SessionRow = {
  id: number;
  username: string;
  mustChangePassword: number;
  active: number;
  language?: string | null;
};

/** Warn once per isolate if the language migration has not been applied yet. */
let warnedMissingLanguage = false;

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** Creates a server-side session; returns the raw cookie token (never stored). */
export async function createSession(db: DB, userId: number, ttlSeconds = SESSION_TTL_SECONDS): Promise<string> {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  await db.insert(sessions).values({
    tokenHash,
    userId,
    expiresAt: nowSeconds() + ttlSeconds,
  });
  return token;
}

export async function destroySession(db: DB, token: string): Promise<void> {
  const tokenHash = await sha256Hex(token);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

/** Resolves a cookie token to a live (non-expired, active-user) session, or null. */
export async function getSessionUser(db: DB, token: string): Promise<SessionUser | null> {
  const tokenHash = await sha256Hex(token);
  const live = and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, nowSeconds()));
  const base = {
    id: users.id,
    username: users.username,
    mustChangePassword: users.mustChangePassword,
    active: users.active,
  };
  let rows: SessionRow[];
  try {
    rows = await db
      .select({ ...base, language: users.language })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(live)
      .limit(1);
  } catch (err) {
    // Deploy-before-migration safety: keep sessions working on a database that
    // does not have users.language yet, just without account-level language.
    if (!warnedMissingLanguage) {
      console.warn("account language unavailable (run D1 migrations):", err);
      warnedMissingLanguage = true;
    }
    rows = await db
      .select(base)
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(live)
      .limit(1);
  }
  const row = rows[0];
  if (!row || row.active !== 1) return null;
  return {
    id: row.id,
    username: row.username,
    mustChangePassword: row.mustChangePassword === 1,
    language: row.language ?? null,
  };
}

export async function purgeExpiredSessions(db: DB): Promise<void> {
  await db.delete(sessions).where(lte(sessions.expiresAt, nowSeconds()));
}
