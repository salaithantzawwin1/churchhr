/** Password quality policy — new passwords must clear this to be accepted
 * server-side (the client-side strength meter only *shows* how strong a
 * password is; it cannot enforce anything). */
export type PasswordPolicyResult = { ok: true } | { ok: false; reason: "length" | "classes" | "common" };

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890",
  "qwerty123", "abc12345", "letmein1!", "welcome1!", "admin1234", "church123",
  "iloveyou1", "sunshine7", "princess1", "football1", "trustno1!", "monkey123",
]);

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
