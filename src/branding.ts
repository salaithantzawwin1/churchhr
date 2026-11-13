import { sql } from "drizzle-orm";
import type { DB } from "./db/client";

/** Login-page branding stored in the single app_branding row. */
export type Branding = {
  churchName: string;
  hasPhoto: boolean;
  updatedAt: number;
};

export const EMPTY_BRANDING: Branding = { churchName: "", hasPhoto: false, updatedAt: 0 };

/** Never throws for a fresh database that has no row yet. */
export async function loadBranding(db: DB): Promise<Branding> {
  const row = (await db.all<{ churchName: string | null; hasPhoto: number; updatedAt: number }>(sql`
    SELECT church_name AS churchName, (photo IS NOT NULL) AS hasPhoto, updated_at AS updatedAt
    FROM app_branding WHERE id = 1 LIMIT 1`))[0];
  if (!row) return EMPTY_BRANDING;
  return {
    churchName: (row.churchName ?? "").trim(),
    hasPhoto: row.hasPhoto === 1,
    updatedAt: row.updatedAt ?? 0,
  };
}

/** Public URL for the uploaded brand photo, or the bundled mark. */
export function brandMarkSrc(branding: Branding | null | undefined): string {
  return branding?.hasPhoto ? `/branding/photo?v=${branding.updatedAt}` : "/logo.png";
}
