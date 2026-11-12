import { sql } from "drizzle-orm";
import type { DB } from "./db/client";

/** One row of a pastor's service record: where, in which post, and the years. */
export type PastorHistoryRow = {
  id: number;
  pastorId: number;
  startYear: number;
  endYear: number | null;
  regionId: number | null;
  stateName: string | null;
  stateNameEn: string | null;
  township: string | null;
  churchName: string | null;
  position: string | null;
  notes: string | null;
};

export type PastorHistoryValues = {
  startYear: string;
  endYear: string;
  regionId: string;
  township: string;
  churchName: string;
  position: string;
  notes: string;
};

export function historyValues(row?: PastorHistoryRow): PastorHistoryValues {
  return {
    startYear: row ? String(row.startYear) : "",
    endYear: row && row.endYear != null ? String(row.endYear) : "",
    regionId: row && row.regionId != null ? String(row.regionId) : "",
    township: row?.township ?? "",
    churchName: row?.churchName ?? "",
    position: row?.position ?? "",
    notes: row?.notes ?? "",
  };
}

/** Newest first; the current post (no end year) sorts to the top of its year. */
export async function loadPastorHistory(db: DB, pastorId: number): Promise<PastorHistoryRow[]> {
  return db.all<PastorHistoryRow>(sql`
    SELECT h.id, h.pastor_id AS pastorId, h.start_year AS startYear, h.end_year AS endYear,
           h.region_id AS regionId, r.name AS stateName, r.name_en AS stateNameEn,
           h.township, h.church_name AS churchName, h.position, h.notes
    FROM pastor_history h
    LEFT JOIN regions r ON r.id = h.region_id
    WHERE h.pastor_id = ${pastorId}
    ORDER BY h.start_year DESC, h.id DESC`);
}

export async function loadPastorHistoryRow(
  db: DB,
  pastorId: number,
  id: number,
): Promise<PastorHistoryRow | null> {
  const rows = await db.all<PastorHistoryRow>(sql`
    SELECT h.id, h.pastor_id AS pastorId, h.start_year AS startYear, h.end_year AS endYear,
           h.region_id AS regionId, r.name AS stateName, r.name_en AS stateNameEn,
           h.township, h.church_name AS churchName, h.position, h.notes
    FROM pastor_history h
    LEFT JOIN regions r ON r.id = h.region_id
    WHERE h.pastor_id = ${pastorId} AND h.id = ${id}`);
  return rows[0] ?? null;
}

/** Years may be back-dated, but not into the future: the earliest plausible
 * appointment is 1900 and the end year cannot be later than next year. */
export const HISTORY_MIN_YEAR = 1900;

export function readHistoryForm(
  body: Record<string, unknown>,
  allowedRegions: number[],
  t: (key: string) => string,
): { values: PastorHistoryValues; errors: string[]; data: {
  startYear: number; endYear: number | null; regionId: number | null;
  township: string | null; churchName: string | null; position: string | null; notes: string | null;
} | null } {
  const pick = (key: string) => String(body[key] ?? "").trim();
  const values: PastorHistoryValues = {
    startYear: pick("start_year"),
    endYear: pick("end_year"),
    regionId: pick("region_id"),
    township: pick("township"),
    churchName: pick("church_name"),
    position: pick("position"),
    notes: pick("notes"),
  };
  const thisYear = new Date().getUTCFullYear();
  const errors: string[] = [];

  const start = /^\d{4}$/.test(values.startYear) ? Number(values.startYear) : NaN;
  if (!Number.isInteger(start) || start < HISTORY_MIN_YEAR || start > thisYear) {
    errors.push(t("org.historyErrYear"));
  }
  let end: number | null = null;
  if (values.endYear) {
    const parsed = /^\d{4}$/.test(values.endYear) ? Number(values.endYear) : NaN;
    if (!Number.isInteger(parsed) || parsed < HISTORY_MIN_YEAR || parsed > thisYear + 1) {
      errors.push(t("org.historyErrYear"));
    } else if (Number.isInteger(start) && parsed < start) {
      errors.push(t("org.historyErrRange"));
    }
    end = Number.isInteger(parsed) ? parsed : null;
  }

  let regionId: number | null = null;
  if (values.regionId) {
    const parsed = Number(values.regionId);
    if (!Number.isInteger(parsed) || !allowedRegions.includes(parsed)) {
      errors.push(t("rep.errState"));
    } else {
      regionId = parsed;
    }
  }
  if (values.township.length > 80) errors.push(t("rep.errTownship"));
  if (values.churchName.length > 120) errors.push(t("rep.errTitle"));
  if (values.position.length > 80) errors.push(t("rep.errText"));
  if (values.notes.length > 500) errors.push(t("rep.errText"));

  if (errors.length > 0) return { values, errors, data: null };
  return {
    values,
    errors,
    data: {
      startYear: start,
      endYear: end,
      regionId,
      township: values.township || null,
      churchName: values.churchName || null,
      position: values.position || null,
      notes: values.notes || null,
    },
  };
}
