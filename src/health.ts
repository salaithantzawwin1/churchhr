import type { Bindings } from "./env";
import { APP_VERSION } from "./version";

export type HealthResult = {
  ok: boolean;
  service: string;
  version: string;
  migration: string | null;
  db: "ok" | "error";
  checkedAt: string;
  latencyMs: number;
};

/** Deploy probe shared by GET /healthz and the dashboard status chip: verifies
 * the Worker, D1 and the schema this build expects (0014 added short_code,
 * 0015 members.photo, 0016 activity_reports, 0017 report_edits, 0018 families
 * placement, 0019 member_positions, 0021 church_departments, 0022 member
 * departments, 0023 position catalogue and regional churches, 0024 position
 * change history). */
export async function checkHealth(env: Bindings): Promise<HealthResult> {
  const started = Date.now();
  let db: "ok" | "error" = "ok";
  let migration: string | null = null;
  try {
    const applied = await env.DB
      .prepare("SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 1")
      .first<{ name: string }>();
    migration = applied?.name ?? null;
    await env.DB.prepare("SELECT short_code FROM lookup_options LIMIT 1").all();
    await env.DB.prepare("SELECT photo FROM members LIMIT 1").all();
    await env.DB.prepare("SELECT home_cell_id, family_group_id FROM families LIMIT 1").all();
    await env.DB.prepare("SELECT title FROM activity_reports LIMIT 1").all();
    await env.DB.prepare("SELECT report_id FROM report_edits LIMIT 1").all();
    await env.DB.prepare("SELECT position, department_id FROM member_positions LIMIT 1").all();
    await env.DB.prepare("SELECT name FROM church_departments LIMIT 1").all();
    await env.DB.prepare("SELECT department_id FROM members LIMIT 1").all();
    await env.DB.prepare("SELECT scope_type, code FROM position_defs LIMIT 1").all();
    await env.DB.prepare("SELECT name, region_id FROM regional_churches LIMIT 1").all();
    await env.DB.prepare("SELECT regional_church_id FROM member_positions LIMIT 1").all();
    await env.DB.prepare("SELECT regional_church_id FROM lookup_options LIMIT 1").all();
    await env.DB.prepare("SELECT entity, action, actor_id FROM position_history LIMIT 1").all();
    await env.DB.prepare("SELECT name, region_id FROM supervision_clusters LIMIT 1").all();
    await env.DB.prepare("SELECT supervision_cluster_id FROM lookup_options LIMIT 1").all();
    await env.DB.prepare("SELECT supervision_cluster_id FROM member_positions LIMIT 1").all();
    await env.DB.prepare("SELECT spouse_pastor_id FROM pastors LIMIT 1").all();
  } catch (err) {
    console.error("health check failed:", err);
    db = "error";
  }
  return {
    ok: db === "ok",
    service: "church-member-registry",
    version: APP_VERSION,
    migration,
    db,
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
  };
}
