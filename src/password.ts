/** Password quality policy — new passwords must clear this to be accepted
 * server-side (the client-side strength meter only *shows* how strong a
 * password is; it cannot enforce anything). */
export type PasswordPolicyResult = { ok: true } | { ok: false; reason: "length" | "classes" | "common" };

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890",
  "qwerty123", "abc12345", "letmein1!", "welcome1!", "admin1234", "church123",
  "iloveyou1", "sunshine7", "princess1", "football1", "trustno1!", "monkey123",
]);

/** Character pools for a generated temporary password. Look-alike glyphs
 *  (0/O, 1/l/I) are left out so a password that is read over the phone or
 *  copied by hand is not mistyped. */
const TEMP_LOWER = "abcdefghjkmnpqrstuvwxyz";
const TEMP_UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const TEMP_DIGIT = "23456789";
const TEMP_SYMBOL = "!@#$%^&*-_=+";

/** Uniform random index in [0, max): bytes past the last full multiple of max
 *  are drawn again instead of folded, which keeps the distribution flat. */
function randomIndex(max: number): number {
  const limit = 256 - (256 % max);
  const byte = new Uint8Array(1);
  for (;;) {
    crypto.getRandomValues(byte);
    if (byte[0]! < limit) return byte[0]! % max;
  }
}

/** A temporary password an administrator can hand out once. It clears the
 *  policy below, but the account is flagged to choose its own password at the
 *  next sign-in, so this value is only ever a one-time key. */
export function generateTempPassword(length = 12): string {
  const pools = [TEMP_LOWER, TEMP_UPPER, TEMP_DIGIT, TEMP_SYMBOL];
  const chars: string[] = pools.map((pool) => pool[randomIndex(pool.length)]!);
  const all = pools.join("");
  while (chars.length < Math.max(length, 12)) chars.push(all[randomIndex(all.length)]!);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    const swap = chars[j]!;
    chars[j] = chars[i]!;
    chars[i] = swap;
  }
  return chars.join("");
}

/** minLength 10 + at least 3 of 4 character classes + not a known common one.
 * Returns the i18n key of the reason, or null when the password is accepted. */
export function checkPasswordPolicy(pw: string): "pw.tooShort" | "pw.tooFewClasses" | "pw.tooCommon" | null {
  if (pw.length < 10) return "pw.tooShort";
  let classes = 0;
  if (/[a-z]/.test(pw)) classes++;
  if (/[A-Z]/.test(pw)) classes++;
  if (/[0-9]/.test(pw)) classes++;
  if (/[^A-Za-z0-9]/.test(pw)) classes++;
  if (classes < 3) return "pw.tooFewClasses";
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) return "pw.tooCommon";
  void 0 as unknown as PasswordPolicyResult; // (type kept for documentation)
  return null;
}
