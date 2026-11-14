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
    // One D1 batch instead of twenty sequential statements: each round-trip
    // costs ~200ms in production, which made this probe take about four seconds.
    const statements = [
      "SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 1",
      "SELECT short_code FROM lookup_options LIMIT 1",
      "SELECT photo FROM members LIMIT 1",
      "SELECT home_cell_id, family_group_id FROM families LIMIT 1",
      "SELECT title FROM activity_reports LIMIT 1",
      "SELECT report_id FROM report_edits LIMIT 1",
      "SELECT position, department_id FROM member_positions LIMIT 1",
      "SELECT name FROM church_departments LIMIT 1",
      "SELECT department_id FROM members LIMIT 1",
      "SELECT scope_type, code FROM position_defs LIMIT 1",
      "SELECT name, region_id FROM regional_churches LIMIT 1",
      "SELECT regional_church_id, region_id, priority FROM member_positions LIMIT 1",
      "SELECT regional_church_id FROM lookup_options LIMIT 1",
      "SELECT entity, action, actor_id FROM position_history LIMIT 1",
      "SELECT name, region_id FROM supervision_clusters LIMIT 1",
      "SELECT supervision_cluster_id FROM lookup_options LIMIT 1",
      "SELECT supervision_cluster_id FROM member_positions LIMIT 1",
      "SELECT spouse_pastor_id FROM pastors LIMIT 1",
      "SELECT action, device FROM audit_log LIMIT 1",
      "SELECT start_year, end_year FROM pastor_history LIMIT 1",
    ];
    const [migrationResult] = await env.DB.batch<{ name: string }>(
      statements.map((sqlText) => env.DB.prepare(sqlText)),
    );
    migration = migrationResult?.results?.[0]?.name ?? null;
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
