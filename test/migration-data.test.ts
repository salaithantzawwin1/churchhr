import { applyD1Migrations, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

/** Data-moving migrations are the only irreversible part of a release, and the
 *  normal test setup applies every migration to an empty database, so their
 *  UPDATE/INSERT logic never sees a row. This file starts from the schema as it
 *  stood before 0040, seeds the legacy shapes those migrations were written
 *  for, and then applies the real migration files.
 *
 *  It runs in its own vitest project (see vitest.config.ts) so the shared
 *  apply-migrations setup does not pre-apply everything. */

type Migration = { name: string; queries: string[] };

const all = [...(env.TEST_MIGRATIONS as unknown as Migration[])].sort((a, b) =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
);

function at(needle: string): number {
  const index = all.findIndex((m) => m.name.includes(needle));
  if (index < 0) throw new Error(`no migration matching ${needle}`);
  return index;
}

/** Applies a slice of the real migration files, in order. */
async function applyRange(from: number, to: number): Promise<void> {
  await applyD1Migrations(env.DB, all.slice(from, to + 1));
}

const db = env.DB;

const sql = (text: string) => db.prepare(text);

describe("0040 moves regional leadership to the region scope", () => {
  it("moves assignments, reuses a pastor, and keeps conflicts out of the slot index", async () => {
    // Schema as of 0039: regional leadership still hangs off a church.
    await applyD1Migrations(
      db,
      all.slice(0, at("0039_region_scope_priority") + 1),
    );

    await sql(
      `INSERT INTO members (id, name_myanmar, name_english, region_id) VALUES
         (1, 'ဦးတစ်', 'Member One', 1),
         (2, 'ဦးနှစ်', 'Member Two', 1),
         (3, 'ဦးသုံး', 'Member Three', 1),
         (4, 'ဦးလေး', 'Member Four', 1),
         (6, 'ဦးခြောက်', 'Member Six', 1)`,
    ).run();

    await sql(
      `INSERT INTO regional_churches (id, name, region_id) VALUES
         (1, 'Church A', 1),
         (2, 'Church B', 1),
         (3, 'Other State Church', 2)`,
    ).run();

    // Member 4 is already a pastor through 0027's cluster assignment, so 0040
    // must reuse that profile instead of creating a second one.
    await sql(
      `INSERT INTO supervision_clusters (id, name, region_id) VALUES (1, 'Cluster One', 1)`,
    ).run();
    await sql(
      `INSERT INTO pastors (id, name, region_id, source_member_id) VALUES (10, 'Pastor Four', 1, 4)`,
    ).run();
    await sql(
      `INSERT INTO cluster_pastor_assignments (cluster_id, pastor_id) VALUES (1, 10)`,
    ).run();

    // Legacy assignments, including one two-secretary conflict in region 1, one
    // left-behind role 0040 does not know, and one church role it must not touch.
    await sql(
      `INSERT INTO member_positions
         (id, member_id, position, scope_type, regional_church_id)
       VALUES
         (1, 1, 'regional_pastor',     'regional_church', 1),
         (2, 2, 'regional_secretary',  'regional_church', 1),
         (3, 3, 'regional_secretary',  'regional_church', 2),
         (4, 4, 'regional_pastor',     'regional_church', 2),
         (5, 6, 'regional_youth_leader', 'regional_church', 1),
         (6, 2, 'church_secretary',    'church',           1)`,
    ).run();

    await applyD1Migrations(db, [all[at("0040_move_regional_positions")]!]);

    const rows = await sql(
      `SELECT id, member_id, pastor_id, scope_type, region_id, regional_church_id, slot_unique
         FROM member_positions WHERE id BETWEEN 1 AND 4 ORDER BY id`,
    ).all<{
      id: number;
      member_id: number | null;
      pastor_id: number | null;
      scope_type: string;
      region_id: number | null;
      regional_church_id: number | null;
      slot_unique: number;
    }>();

    // Every row moved to the region; the church link is cleared.
    expect(rows.results.map((r) => r.scope_type)).toEqual(["region", "region", "region", "region"]);
    expect(rows.results.every((r) => r.region_id === 1 && r.regional_church_id === null)).toBe(true);

    // Regional pastors are now pastor profiles, not member rows.
    const [pastorOne, secretaryOne, secretaryTwo, pastorFour] = rows.results;
    expect(pastorOne!.member_id).toBeNull();
    expect(pastorOne!.pastor_id).not.toBeNull();
    expect(secretaryOne!.member_id).toBe(2);
    expect(secretaryOne!.pastor_id).toBeNull();
    // Only the first secretary of a region keeps the single-holder slot.
    expect(secretaryOne!.slot_unique).toBe(1);
    expect(secretaryTwo!.slot_unique).toBe(0);
    // The existing pastor profile is reused, not duplicated.
    expect(pastorFour!.member_id).toBeNull();
    expect(pastorFour!.pastor_id).toBe(10);

    const created = await sql(
      `SELECT COUNT(*) AS n FROM pastors WHERE source_member_id IN (1, 4)`,
    ).first<{ n: number }>();
    expect(created!.n).toBe(2); // one created for member 1, one reused for member 4

    // Roles 0040 does not recognise stay exactly where they were.
    const leftBehind = await sql(
      `SELECT scope_type, regional_church_id FROM member_positions WHERE id = 5`,
    ).first<{ scope_type: string; regional_church_id: number | null }>();
    expect(leftBehind).toEqual({ scope_type: "regional_church", regional_church_id: 1 });

    const churchRow = await sql(
      `SELECT scope_type, regional_church_id FROM member_positions WHERE id = 6`,
    ).first<{ scope_type: string; regional_church_id: number | null }>();
    expect(churchRow).toEqual({ scope_type: "church", regional_church_id: 1 });

    // The move log keeps one row per moved assignment and flags the conflict.
    const log = await sql(
      `SELECT assignment_id, new_region_id, conflict FROM region_position_migration ORDER BY assignment_id`,
    ).all<{ assignment_id: number; new_region_id: number; conflict: number }>();
    expect(log.results.map((r) => r.assignment_id)).toEqual([1, 2, 3, 4]);
    expect(log.results.every((r) => r.new_region_id === 1)).toBe(true);
    expect(log.results.filter((r) => r.conflict === 1).map((r) => r.assignment_id)).toEqual([3]);

    // Catalogue: the church-scope rows are gone, region rows exist, and the
    // multi-holder flags match the documented policy.
    const defs = await sql(
      `SELECT scope_type, code, allow_multiple, min_holders FROM position_defs
        WHERE code IN ('regional_pastor','regional_secretary','regional_treasurer',
                       'church_senior_pastor','church_assistant_pastor')`,
    ).all<{ scope_type: string; code: string; allow_multiple: number; min_holders: number }>();
    expect(defs.results.filter((d) => d.scope_type === "regional_church")).toHaveLength(0);
    const byCode = new Map(defs.results.map((d) => [d.code, d]));
    expect(byCode.get("regional_pastor")).toMatchObject({ allow_multiple: 1, min_holders: 1 });
    expect(byCode.get("regional_secretary")).toMatchObject({ allow_multiple: 0, min_holders: 1 });
    expect(byCode.get("church_senior_pastor")).toMatchObject({ allow_multiple: 0, min_holders: 1 });
    expect(byCode.get("church_assistant_pastor")).toMatchObject({ allow_multiple: 1, min_holders: 0 });
  });
});

describe("0049 normalises grade labels", () => {
  it("maps the spellings it understands and leaves anything else alone", async () => {
    // Everything after 0040 up to 0049, so pastor_children and student_enrolments exist.
    await applyRange(at("0041_state_leadership_roles"), at("0048_household_photos"));

    await sql(
      `INSERT INTO pastor_children (id, pastor_id, name, grade) VALUES
         (1, 10, 'Child A', 'kg'),
         (2, 10, 'Child B', 'Grade 5'),
         (3, 10, 'Child C', 'Year 13')`,
    ).run();
    await sql(
      `INSERT INTO student_enrolments (id, member_id, academic_year, grade) VALUES
         (1, 1, '2026-27', 'g5'),
         (2, 2, '2026-27', ' 12 '),
         (3, 3, '2026-27', 'K.G.')`,
    ).run();

    await applyD1Migrations(db, [all[at("0049_normalize_grades")]!]);

    const children = await sql(
      `SELECT id, grade FROM pastor_children ORDER BY id`,
    ).all<{ id: number; grade: string }>();
    expect(children.results.map((r) => r.grade)).toEqual(["KG", "G5", "Year 13"]);

    const enrolments = await sql(
      `SELECT id, grade FROM student_enrolments ORDER BY id`,
    ).all<{ id: number; grade: string }>();
    expect(enrolments.results.map((r) => r.grade)).toEqual(["G5", "G12", "KG"]);
  });
});
