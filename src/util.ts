/** Form field value -> trimmed string (non-strings become ""). */
export function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function intParam(v: string | undefined | null): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function asInt(v: string): number | null {
  if (v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

/** Age in whole years from a YYYY-MM-DD date, null when unknown/invalid. */
export function ageFromDate(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const then = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(then.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - then.getFullYear();
  const md = now.getMonth() - then.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < then.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

/** Accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, D/M/YYYY -> YYYY-MM-DD or null. */
export function parseDateFlexible(v: string): string | null {
  const t = v.trim();
  if (t === "") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const d = new Date(t + "T00:00:00");
    return Number.isNaN(d.getTime()) ? null : t;
  }
  const m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(t);
  if (m) {
    const [_, dd, mm, yyyy] = m;
    const day = Number(dd), mon = Number(mm), year = Number(yyyy);
    if (mon < 1 || mon > 12 || day < 1 || day > 31) return null;
    const d = new Date(year, mon - 1, day);
    if (Number.isNaN(d.getTime()) || d.getDate() !== day || d.getMonth() !== mon - 1) return null;
    return `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

export function b64encode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function b64decode(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function normKey(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Builds "?a=1&b=2" from an object, skipping empty values (safe URL encoding). */
export function qs(params: Record<string, string | number | null | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}
