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
 * the Worker, D1 and the schema this build expects (0014 added short_code). */
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
