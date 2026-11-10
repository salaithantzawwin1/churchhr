import { asc, eq } from "drizzle-orm";
import type { DB } from "./db/client";
import { churchDepartments } from "./db/schema";

export type DepartmentRow = {
  id: number;
  name: string;
  nameEn: string | null;
  active: number;
  sortOrder: number;
};

/** Active departments by default; management pages can include inactive rows. */
export async function loadDepartments(db: DB, activeOnly = true): Promise<DepartmentRow[]> {
  const rows = await db
    .select({
      id: churchDepartments.id,
      name: churchDepartments.name,
      nameEn: churchDepartments.nameEn,
      active: churchDepartments.active,
      sortOrder: churchDepartments.sortOrder,
    })
    .from(churchDepartments)
    .where(activeOnly ? eq(churchDepartments.active, 1) : undefined)
    .orderBy(asc(churchDepartments.sortOrder), asc(churchDepartments.name));
  return rows;
}

export function departmentName(
  department: { name: string; nameEn?: string | null; name_en?: string | null },
  lang: string,
): string {
  const english = department.nameEn ?? department.name_en;
  return lang !== "mm" && english ? english : department.name;
}
