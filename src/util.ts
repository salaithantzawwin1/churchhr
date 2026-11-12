import type { Context } from "hono";
import type { AppEnv } from "./env";

/** True when the request reached us over TLS (Cloudflare forwards the original scheme). */
export function isHttpsRequest(c: Context<AppEnv>): boolean {
  const forwarded = c.req.header("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  return new URL(c.req.url).protocol === "https:" || forwarded === "https";
}

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
    // Reject roll-over dates such as 2026-02-31, which Date would normalize.
    const [y, m, d] = t.split("-").map(Number);
    const dt = new Date(Date.UTC(y!, m! - 1, d!));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d ? t : null;
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

/** Today in Myanmar time (UTC+6:30). Workers run in UTC, where the date is
 * still yesterday between local midnight and 06:30. */
export function todayInYangon(): string {
  return new Date(Date.now() + 6.5 * 3600 * 1000).toISOString().slice(0, 10);
}

/** True when an ISO date (YYYY-MM-DD) lands after today in Myanmar time. */
export function isFutureDate(iso: string): boolean {
  return iso > todayInYangon();
}

/** YYYY-MM-DD plus/minus whole days (calendar dates only, UTC arithmetic). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/** "CODE · label" for a lookup option, collapsed to a single value when the
 * label already is the code (imported groups are often named by their code). */
export function optionText(code: string | null | undefined, label: string | null | undefined): string {
  const l = (label ?? "").trim();
  const c = (code ?? "").trim();
  if (!l) return c;
  return !c || c === l ? l : `${c} · ${l}`;
}

/** Label-only formatter for lookup options whose generated code is redundant
 * and long on phones (Family Groups already carry their township code in the
 * label). Falls back to the code when an older option has no label. */
export function optionLabel(code: string | null | undefined, label: string | null | undefined): string {
  return (label ?? "").trim() || (code ?? "").trim();
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
