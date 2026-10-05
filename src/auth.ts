/** PBKDF2-SHA256 password hashing via Web Crypto (no native deps, Workers-compatible).
 * Hash format: `pbkdf2-sha256$<iterations>$<b64 salt>$<b64 dk>` — the iteration count is
 * stored per-hash so the cost can be raised later without breaking old passwords.
 * Default 10000 iterations ≈ 4.5ms CPU, inside the Workers Free 10ms/request budget. */

const DEFAULT_ITERATIONS = 10_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export function defaultIterations(): number {
  return DEFAULT_ITERATIONS;
}

export function parseIterations(envValue: string | undefined): number {
  const n = Number(envValue);
  return Number.isInteger(n) && n >= 1_000 && n <= 10_000_000 ? n : DEFAULT_ITERATIONS;
}

export async function hashPassword(password: string, iterations: number = DEFAULT_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const dk = await derive(password, salt, iterations);
  return `pbkdf2-sha256$${iterations}$${toB64(salt)}$${toB64(dk)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1_000 || iterations > 10_000_000) return false;
  try {
    const salt = fromB64(parts[2]!);
    const expected = fromB64(parts[3]!);
    const actual = await derive(password, salt, iterations);
    return equalBytes(actual, expected);
  } catch {
    return false;
  }
}
