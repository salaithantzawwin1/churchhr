import type { Context } from "hono";
import { sql } from "drizzle-orm";
import type { AppEnv } from "./env";
import { getDb, type DB } from "./db/client";

/** Best-effort device description: kind · browser · platform. Phones and
 * tablets are what the trail is usually asked about ("who edited this from a
 * phone?"), so the kind is derived first and the raw UA is kept separately. */
export function deviceLabel(ua: string): string {
  if (!ua) return "";
  const kind = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)
    ? "Tablet"
    : /Mobile|iPhone|iPod|Android|Windows Phone/i.test(ua)
      ? "Phone"
      : "Desktop";
  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /OPR\/|Opera/i.test(ua)
      ? "Opera"
      : /Chrome\//i.test(ua) && !/Chromium/i.test(ua)
        ? "Chrome"
        : /Firefox\//i.test(ua)
          ? "Firefox"
          : /Safari\//i.test(ua) && !/Chrome/i.test(ua)
            ? "Safari"
            : "";
  const platform = /iPhone|iPad|iPod/i.test(ua)
    ? "iOS"
    : /Android/i.test(ua)
      ? "Android"
      : /Windows/i.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/i.test(ua)
          ? "macOS"
          : /Linux/i.test(ua)
            ? "Linux"
            : "";
  return [kind, browser, platform].filter(Boolean).join(" · ");
}

export function clientIp(c: Context<AppEnv>): string {
  return (
    c.req.header("CF-Connecting-IP") ||
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "local"
  );
}

export type MutationInfo = { action: string; entity: string; entityId: string | null };

const num = (value: string | undefined): string | null => (value && /^\d+$/.test(value) ? value : null);

/** Maps a state-changing request to a stable action key. The page renders the
 * label from the dictionary, so a new route falls back to its raw key rather
 * than disappearing from the trail. */
export function classify(method: string, path: string): MutationInfo | null {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  const m = method.toLowerCase();
  const [root, second, third, fourth] = parts;

  if (root === "logout") return { action: "session.logout", entity: "session", entityId: null };
  if (root === "profile") return { action: "account.update", entity: "user", entityId: null };
  if (root === "login") return { action: "login.success", entity: "session", entityId: null };

  if (root === "members") {
    if (second === "import") return { action: "member.import", entity: "member", entityId: null };
    if (second === "bulk") return { action: "member.bulk", entity: "member", entityId: null };
    if (second === "new") return { action: "member.create", entity: "member", entityId: null };
    if (!second) return { action: "member.create", entity: "member", entityId: null };
    const id = num(second);
    if (id && third === "delete") return { action: "member.delete", entity: "member", entityId: id };
    if (id && third === "position") return { action: "member.position", entity: "member", entityId: id };
    if (id && third === "photo") return { action: "member.photo", entity: "member", entityId: id };
    if (id && !third) return { action: "member.update", entity: "member", entityId: id };
  }

  if (root === "reports") {
    if (!second) return { action: "report.create", entity: "report", entityId: null };
    const id = num(second);
    if (id && third === "review") return { action: "report.review", entity: "report", entityId: id };
    if (id && third === "submit") return { action: "report.submit", entity: "report", entityId: id };
    if (id && third === "edit") return { action: "report.update", entity: "report", entityId: id };
    if (id && third === "delete") return { action: "report.delete", entity: "report", entityId: id };
  }

  if (root === "admin") {
    const family = second ?? "";
    const familyEntity: Record<string, string> = {
      users: "user", roles: "role", options: "option", settings: "settings",
      households: "household", regions: "region", "age-groups": "age_group",
      trash: "trash",
    };
    const entity = familyEntity[family];
    if (entity) {
      const id = num(third);
      if (!third) return { action: `${entity}.create`, entity, entityId: null };
      if (third === "new") return { action: `${entity}.create`, entity, entityId: null };
      if (id && fourth === "delete") return { action: `${entity}.delete`, entity, entityId: id };
      if (id && (fourth === "reset" || fourth === "password")) return { action: `${entity}.password`, entity, entityId: id };
      if (id && !fourth) return { action: `${entity}.update`, entity, entityId: id };
      if (!id && third) return { action: `${entity}.update`, entity, entityId: null };
    }
  }

  if (root === "organization") {
    const family = second ?? "";
    if (family === "pastors") {
      const id = num(third);
      if (!third) return { action: "pastor.create", entity: "pastor", entityId: null };
      if (id && third && fourth === "delete") return { action: "pastor.delete", entity: "pastor", entityId: id };
      if (id && fourth === "photo") return { action: "pastor.photo", entity: "pastor", entityId: id };
      if (id && fourth === "history") {
        const hid = num(parts[4]);
        const tail = parts[5];
        if (!hid) return { action: "pastor.history.create", entity: "pastor", entityId: id };
        if (tail === "delete") return { action: "pastor.history.delete", entity: "pastor", entityId: id };
        return { action: "pastor.history.update", entity: "pastor", entityId: id };
      }
      if (id) return { action: "pastor.update", entity: "pastor", entityId: id };
    }
    const entity = {
      regions: "region", "regional-churches": "regional_church", clusters: "cluster",
      departments: "department", positions: "position", "home-cells": "home_cell",
      "age-groups": "age_group", fellowships: "fellowship", groups: "group",
    }[family];
    if (entity) {
      const id = num(third);
      if (!third) return { action: `${entity}.create`, entity, entityId: null };
      if (id && fourth === "delete") return { action: `${entity}.delete`, entity, entityId: id };
      if (id && !fourth) return { action: `${entity}.update`, entity, entityId: id };
      return { action: `${entity}.update`, entity, entityId: null };
    }
  }

  return { action: `${root}.${m === "post" ? "update" : m}`, entity: root, entityId: num(second) };
}

export type AuditEntry = {
  action: string;
  entity: string | null;
  entityId: string | null;
  summary?: string | null;
  userId?: number | null;
  username?: string | null;
  status?: number | null;
  method?: string | null;
  path?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

/** Writes one audit row. Never throws: an audit failure must not fail the
 * request it is describing. */
export async function logAudit(db: DB, entry: AuditEntry): Promise<void> {
  try {
    const ua = entry.userAgent ?? "";
    await db.run(sql`
      INSERT INTO audit_log
        (user_id, username, action, entity, entity_id, summary, ip, user_agent, device, method, path, status)
      VALUES
        (${entry.userId ?? null}, ${entry.username ?? null}, ${entry.action},
         ${entry.entity ?? null}, ${entry.entityId ?? null}, ${entry.summary ?? null},
         ${entry.ip ?? null}, ${ua || null}, ${deviceLabel(ua) || null},
         ${entry.method ?? null}, ${entry.path ?? null}, ${entry.status ?? null})`);
  } catch (err) {
    console.warn("audit log write failed:", err);
  }
}

/** Logs every successful state-changing request after the handler ran. */
export function auditMutations() {
  return async (c: Context<AppEnv>, next: () => Promise<void>) => {
    const method = c.req.method;
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      await next();
      return;
    }
    const path = new URL(c.req.url).pathname;
    await next();
    // A rejected request changed nothing: error statuses and the app's own
    // "bounce back with ?err=" redirects are not recorded as successful work.
    const location = c.res.headers.get("location") ?? "";
    if (c.res.status >= 400 || /[?&]err=/.test(location)) return;
    const info = classify(method, path);
    if (!info) return;
    // Create routes redirect to the new record; keep its id in the entry so the
    // trail says which row was added, not just that something was.
    let entityId = info.entityId;
    if (!entityId && location) {
      const created = /^\/(?:reports|members|organization\/pastors|admin\/households)\/(\d+)/.exec(location);
      if (created) entityId = created[1]!;
    }
    const user = c.get("user");
    await logAudit(getDb(c.env), {
      ...info,
      entityId,
      userId: user?.id ?? null,
      username: user?.username ?? null,
      status: c.res.status,
      method,
      path,
      ip: clientIp(c),
      userAgent: c.req.header("user-agent") ?? "",
    });
  };
}
