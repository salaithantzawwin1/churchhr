import { Hono } from "hono";
import { and, eq, sql } from "drizzle-orm";
import type { AppEnv } from "../env";
import { getDb, type DB } from "../db/client";
import { parsePhoto } from "../photo";
import { families, lookupOptions, memberHistory, members, regions } from "../db/schema";
import { requirePermission } from "../middleware";
import { flashFromQuery } from "../flash";
import { loadEnrolmentSummaries, type EnrolmentSummary } from "../student-enrolments";
import { loadAllOptions, nextFamilyGroupCode, townshipOf, type OptionRow } from "../lookup";
import { asInt, intParam, normKey, s } from "../util";
import { MEMBER_FORM_KEYS, readMemberForm } from "../member-form";
import type { DuplicateCandidate } from "../views/members";
import { findPossibleDuplicates } from "./members";
import { getDict, type Lang } from "../i18n";
import {
  HouseholdAddMemberPage, HouseholdFormFragment, HouseholdFormPage, HouseholdsListPage, HouseholdDetailPage,
  HouseholdSearchMemberPage,
  type FormValues as HFormValues,
} from "../views/households";

export const householdsRoutes = new Hono<AppEnv>();

type Scope = { scopeAll: boolean; stateIds: number[]; homeCellIds: number[] };

function scopeOf(c: { get: (k: "scopeAll" | "stateIds" | "homeCellIds") => any }): Scope {
  return {
    scopeAll: c.get("scopeAll"),
    stateIds: c.get("stateIds"),
    // Carried for the shared member duplicate lookup, which honours the
    // account's Home Cell limit like the member list does.
    homeCellIds: (c.get("homeCellIds") ?? []) as number[],
  };
}

/** Household cards per page; the other collection lists page at the same size. */
const PER_PAGE = 24;

function scopeCondF(scope: Scope) {
  if (scope.scopeAll) return sql`1=1`;
  if (scope.stateIds.length === 0) return sql`1=0`;
  return sql`f.region_id IN (${sql.join(scope.stateIds.map((id) => sql`${id}`), sql`, `)})`;
}

const RELATIONSHIPS = [
  "head", "spouse", "son", "daughter", "father", "mother",
  "brother", "sister", "grandchild", "other",
] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

async function savePhoto(db: DB, familyId: number, bytes: Uint8Array | null): Promise<void> {
  // D1 binds ArrayBuffer for BLOB values (a bare Uint8Array is not portable).
  const value = bytes ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : null;
  await db.run(sql`UPDATE families SET photo = ${value} WHERE id = ${familyId}`);
}

/** Small checksum for the photo ETag: families has no updated_at column, and
 *  the browser re-encodes on every save, so the bytes are the validator. */
function photoHash(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i]!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16);
}

const photoUrlOf = (family: { id: number; has_photo?: number | boolean }) =>
  family.has_photo ? `/admin/households/${family.id}/photo` : undefined;

/** The household columns the routes read. The photo BLOB is deliberately left
 *  out: pages only need has_photo, and /:id/photo serves the bytes. */
const FAMILY_COLS = sql`f.id, f.name, f.head_member_id, f.address, f.township, f.phone,
    f.home_cell_id, f.group_id, f.family_group_id, f.region_id, f.notes,
    f.created_by, f.created_at, (f.photo IS NOT NULL) AS has_photo`;

/** nrc-like helpers borrowed pattern from members.tsx; kept local to route. */
async function loadRegions(db: DB) {
  return (await db
    .select({ id: regions.id, name: regions.name, nameEn: regions.nameEn, slug: regions.slug, code: regions.code })
    .from(regions)
    .orderBy(regions.id)) as { id: number; name: string; nameEn: string; slug: string; code: string | null }[];
}

function scopedRegions(all: { id: number; name: string; nameEn: string; code: string | null }[], scope: Scope, lang: Lang) {
  return all
    .filter((r) => scope.scopeAll || scope.stateIds.includes(r.id))
    .map((r) => ({
      id: r.id,
      name: lang !== "mm" && r.nameEn ? r.nameEn : r.name,
      code: r.code ?? null,
    }));
}

/** member scope condition (m. prefix, for head-member lookups). */
function scopeCondM(scope: Scope) {
  if (scope.scopeAll) return sql`1=1`;
  if (scope.stateIds.length === 0) return sql`1=0`;
  return sql`m.region_id IN (${sql.join(scope.stateIds.map((id) => sql`${id}`), sql`, `)})`;
}

/** Members that can become the head of a new household: unassigned members in
 * scope, plus the one being pre-selected from a member page. */
async function headCandidates(db: DB, scope: Scope, includeId: number | null) {
  return (await db.all(sql`
    SELECT m.id, m.member_code, m.name_myanmar, m.name_english, m.township,
           m.phone, m.address,
           m.region_id, m.home_cell_id, m.group_id, m.family_group_id
    FROM members m
    WHERE ${scopeCondM(scope)}
      AND (m.family_id IS NULL ${includeId ? sql`OR m.id = ${includeId}` : sql``})
    ORDER BY COALESCE(NULLIF(m.name_myanmar, ''), m.name_english, '')
    LIMIT 300`)) as {
      id: number; member_code: string | null; name_myanmar: string | null; name_english: string | null;
      township: string | null; phone: string | null; address: string | null;
      region_id: number; home_cell_id: number | null;
      group_id: number | null; family_group_id: number | null;
    }[];
}

const FORM_KEYS = ["name", "head_member_id", "address", "township", "phone", "region_id", "home_cell_id", "group_id", "notes"] as const;

type Validated = {
  values: HFormValues;
  errors: string[];
  data: {
    name: string; address: string | null; township: string | null; phone: string | null;
    region_id: number; notes: string | null; head_member_id: number | null;
    home_cell_id: number | null; group_id: number | null;
  } | null;
};

function readAndValidate(body: Record<string, unknown>, scope: Scope, translate: (k: string) => string): Validated {
  const v: HFormValues = {};
  for (const k of FORM_KEYS) v[k] = s(body[k]);
  const errors: string[] = [];
  if (!v.name) errors.push(translate("hh.val.name"));
  const regionId = asInt(v.region_id ?? "");
  let regionOk = false;
  if (regionId === null) errors.push(translate("hh.val.state"));
  else regionOk = scope.scopeAll || scope.stateIds.includes(regionId);
  if (regionId !== null && !regionOk) errors.push(translate("hh.val.scope"));
  const headRaw = (v.head_member_id ?? "").trim();
  const headMemberId = headRaw ? asInt(headRaw) : null;
  if (headRaw && headMemberId === null) errors.push(translate("hh.val.head"));
  if (errors.length > 0) return { values: v, errors, data: null };
  return {
    values: v,
    errors,
    data: {
      name: v.name!,
      address: v.address || null,
      township: v.township || null,
      phone: v.phone || null,
      region_id: regionId!,
      notes: v.notes || null,
      head_member_id: headMemberId,
      home_cell_id: asInt(v.home_cell_id ?? ""),
      group_id: asInt(v.group_id ?? ""),
    },
  };
}

function defaultValues(scope: Scope): HFormValues {
  const v: HFormValues = {};
  if (!scope.scopeAll && scope.stateIds.length === 1) v.region_id = String(scope.stateIds[0]);
  return v;
}

/** Members of a household, head first; used by detail card. */
async function householdMembers(db: DB, familyId: number) {
  return (await db.all(sql`
    SELECT m.id, m.member_code, m.name_myanmar, m.name_english, m.gender, m.status, m.relationship, m.date_of_birth,
           m.updated_at, (m.photo IS NOT NULL) AS has_photo
    FROM members m WHERE m.family_id = ${familyId}
    ORDER BY CASE WHEN m.relationship = 'head' THEN 0 ELSE 1 END, m.id ASC`)) as any[];
}

type HouseholdPlacement = { homeCellId: number | null; groupId: number | null; familyGroupId: number | null };

/** Household placement, preferring the household's own columns and falling
 * back to the head for rows created before those columns existed. */
async function householdPlacement(db: DB, family: any): Promise<HouseholdPlacement> {
  const [head] = (await db.all(sql`
    SELECT home_cell_id, group_id, family_group_id FROM members
    WHERE family_id = ${family.id} AND relationship = 'head' LIMIT 1`)) as any[];
  return {
    homeCellId: family.home_cell_id ?? head?.home_cell_id ?? null,
    groupId: family.group_id ?? head?.group_id ?? null,
    familyGroupId: family.family_group_id ?? head?.family_group_id ?? null,
  };
}

/** Creates a Family Group named after its Home Cell: YGN_INS3_FG03 with the
 * township-prefixed code YGN_INS_FG003. */
async function createFamilyGroupForCell(
  db: DB, regionId: number, homeCell: OptionRow, allOptions: OptionRow[],
): Promise<number | null> {
  const byId = new Map(allOptions.map((o) => [o.id, o] as const));
  const township = townshipOf(homeCell, byId);
  const existing = allOptions.filter((o) => o.type === "family_group" && o.regionId === regionId);
  const labels = new Set(existing.map((o) => o.label.trim().toLowerCase()));
  const nextCode = nextFamilyGroupCode(existing.map((o) => o.code ?? ""), township);
  let seq = Number(/_FG(\d+)$/.exec(nextCode ?? "")?.[1] ?? existing.length + 1);
  let label = `${homeCell.label}_FG${String(seq).padStart(2, "0")}`;
  while (labels.has(label.toLowerCase())) {
    seq += 1;
    label = `${homeCell.label}_FG${String(seq).padStart(2, "0")}`;
  }
  const code = nextCode && /_FG\d+$/.test(nextCode)
    ? nextCode.replace(/_FG\d+$/, `_FG${String(seq).padStart(3, "0")}`)
    : nextCode;
  const maxSort = Math.max(0, ...existing.map((o) => o.sortOrder));
  const inserted = await db.insert(lookupOptions).values({
    type: "family_group", label, code, active: 1, sortOrder: maxSort + 1,
    regionId, parentId: homeCell.id,
  }).returning({ id: lookupOptions.id });
  return inserted[0]?.id ?? null;
}

/** Makes sure a household has the Family Group for its Home Cell. Reuses the
 * household's existing group when it still belongs to that cell, otherwise
 * creates one and assigns it to every household member. */
async function ensureHouseholdFamilyGroup(
  db: DB, familyId: number, regionId: number,
  homeCellId: number | null, preferredId: number | null,
  groupId: number | null, allOptions: OptionRow[],
): Promise<number | null> {
  if (!homeCellId) return preferredId;
  const byId = new Map(allOptions.map((o) => [o.id, o] as const));
  const cell = byId.get(homeCellId);
  if (!cell || cell.type !== "home_cell") return preferredId;
  const preferred = preferredId ? byId.get(preferredId) : undefined;
  let familyGroupId = preferred && preferred.type === "family_group"
    && (preferred.parentId == null || preferred.parentId === homeCellId)
    ? preferred.id : null;
  if (!familyGroupId) familyGroupId = await createFamilyGroupForCell(db, regionId, cell, allOptions);
  await db.update(families)
    .set({ homeCellId, groupId, familyGroupId })
    .where(eq(families.id, familyId));
  if (familyGroupId) {
    await db.run(sql`
      UPDATE members SET family_group_id = ${familyGroupId},
        home_cell_id = ${homeCellId},
        group_id = COALESCE(${groupId}, group_id)
      WHERE family_id = ${familyId}`);
  }
  return familyGroupId;
}

// ---------- GET /admin/households ----------

householdsRoutes.get("/", requirePermission("members.view"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const q = (c.req.query("q") ?? "").trim().slice(0, 100);
  const like = `%${q}%`;
  // Township filter — f.township stores the option LABEL (free text).
  const township = (c.req.query("township") ?? "").trim().slice(0, 120);
  const townshipCond = township ? sql`AND f.township = ${township}` : sql``;
  const region = intParam(c.req.query("region"));
  const regionCond = region ? sql`AND f.region_id = ${region}` : sql``;
  const where = sql`${scopeCondF(scope)} ${q ? sql`AND (f.name LIKE ${like} OR f.address LIKE ${like} OR f.phone LIKE ${like})` : sql``} ${townshipCond} ${regionCond}`;
  const countRows = await db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM families f WHERE ${where}`);
  const total = countRows[0]?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(Math.max(1, intParam(c.req.query("page")) ?? 1), pages);
  const rowsP = db.all(sql`
    SELECT f.id, f.name, f.address, f.township, f.phone, f.created_at,
           (f.photo IS NOT NULL) AS has_photo,
           r.name AS state_name, r.name_en AS state_name_en,
           head.name_myanmar AS head_name_mm, head.name_english AS head_name_en,
           head.phone AS head_phone,
           hc.label AS home_cell_label,
           fg.label AS family_group_label, fg.code AS family_group_code,
           hm.cnt AS member_count
    FROM families f
    JOIN regions r ON r.id = f.region_id
    LEFT JOIN members head ON head.id = f.head_member_id
    LEFT JOIN lookup_options hc ON hc.id = COALESCE(f.home_cell_id, head.home_cell_id)
    LEFT JOIN lookup_options fg ON fg.id = COALESCE(f.family_group_id, head.family_group_id)
    LEFT JOIN (SELECT family_id, COUNT(*) AS cnt FROM members WHERE family_id IS NOT NULL GROUP BY family_id) hm
      ON hm.family_id = f.id
    WHERE ${where}
    ORDER BY f.id DESC
    LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}`);
  const lang = c.get("lang");
  // The list, the township filter options and the state filter options are
  // independent reads: one query window instead of three.
  const [rowsRaw, allOptions, allRegions] = await Promise.all([
    rowsP,
    loadAllOptions(db),
    loadRegions(db),
  ]);
  const rows = rowsRaw as any[];
  // Township dropdown options for the filter, scoped like the list itself.
  const townshipsInScope = scope.scopeAll
    ? allOptions.filter((o) => o.type === "township" && o.active === 1)
    : allOptions.filter((o) => o.type === "township" && o.active === 1 &&
        (o.regionId === 0 || scope.stateIds.includes(o.regionId)));
  const regionOptions = allRegions
    .filter((r) => scope.scopeAll || scope.stateIds.includes(r.id))
    .map((r) => ({ id: r.id, name: lang !== "mm" && r.nameEn ? r.nameEn : r.name }));
  return c.html(
    <HouseholdsListPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), lang)}
      rows={rows} q={q} township={township} townshipOptions={townshipsInScope} lang={lang}
      region={region} regions={regionOptions}
      total={total} page={page} pages={pages}
    />,
  );
});

// ---------- GET /admin/households/new ----------

householdsRoutes.get("/new", requirePermission("members.create"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const lang = c.get("lang");
  // Pre-select the member when arriving from Member detail → "New household".
  const preMemberId = intParam(c.req.query("member"));
  // Regions, options, the pre-selected member and the head dropdown are
  // independent reads: one query window instead of four.
  const [allRegions, allOptions, preMemberRows, headList] = await Promise.all([
    loadRegions(db),
    loadAllOptions(db),
    // Scoped like the form itself: a hand-made ?member= for another state must
    // not fill the household form with that member's address and phone.
    preMemberId
      ? db.all(sql`SELECT * FROM members m WHERE m.id = ${preMemberId} AND ${scopeCondM(scope)}`)
      : Promise.resolve([] as any[]),
    headCandidates(db, scope, preMemberId),
  ]);
  let values = defaultValues(scope);
  const preMember = (preMemberRows as any[])[0];
  if (preMember && (scope.scopeAll || scope.stateIds.includes(preMember.region_id))) {
    const m = preMember;
    values = {
      name: m.name_myanmar || m.name_english || "",
      region_id: String(m.region_id),
      township: m.township ?? "",
      phone: m.phone ?? "",
      address: m.address ?? "",
      head_member_id: String(m.id),
      home_cell_id: m.home_cell_id ? String(m.home_cell_id) : "",
      group_id: m.group_id ? String(m.group_id) : "",
      family_group_id: m.family_group_id ? String(m.family_group_id) : "",
    };
  }
  const opts = {
    user: c.get("user"), perms: c.get("perms"), values, errors: [] as string[],
    family: null as null | { id: number }, regions: scopedRegions(allRegions, scope, lang), lang,
    options: hhFormOptions(allOptions), members: headList,
  };
  if (c.req.query("modal") === "1") return c.html(<HouseholdFormFragment {...opts} modal />);
  return c.html(<HouseholdFormPage {...opts} />);
});

// ---------- POST /admin/households (create family + head member auto-assign) ----------

householdsRoutes.post("/", requirePermission("members.create"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const body = await c.req.parseBody();
  const allRegions = await loadRegions(db);
  const fromModal = s(body.from_modal) === "1";
  // Picking an existing head fills the household's placement from that member,
  // so the form does not need the same state/township entered twice.
  const pickedHeadId = asInt(s(body.head_member_id));
  if (pickedHeadId != null) {
    const [m] = (await db.all(sql`
      SELECT region_id, township, phone, address, home_cell_id, group_id FROM members WHERE id = ${pickedHeadId}`)) as any[];
    if (m) {
      if (!s(body.region_id)) body.region_id = String(m.region_id);
      if (!s(body.township)) body.township = m.township ?? "";
      if (!s(body.phone)) body.phone = m.phone ?? "";
      if (!s(body.address)) body.address = m.address ?? "";
      if (!s(body.home_cell_id) && m.home_cell_id) body.home_cell_id = String(m.home_cell_id);
      if (!s(body.group_id) && m.group_id) body.group_id = String(m.group_id);
    }
  }
  const { values, errors, data } = readAndValidate(body, scope, (k) => getDict(c.get("lang"))(k));
  const photo = parsePhoto(body, (k) => getDict(c.get("lang"))(k));
  if (photo.error) errors.push(photo.error);
  const allOptions = await loadAllOptions(db);
  const headList = await headCandidates(db, scope, null);
  const render = (status: 400 | 200) => {
    const opts = {
      user: c.get("user"), perms: c.get("perms"), values, errors,
      family: null as null | { id: number }, regions: scopedRegions(allRegions, scope, c.get("lang")), lang: c.get("lang"),
      options: hhFormOptions(allOptions), members: headList,
    };
    if (fromModal) return c.html(<HouseholdFormFragment {...opts} modal />, status);
    return c.html(<HouseholdFormPage {...opts} />, status);
  };
  if (!data || photo.error) return render(400);

  // Optional existing member becomes the head and is attached to the new family.
  let head: any = null;
  if (data.head_member_id != null) {
    const [m] = (await db.all(sql`SELECT m.* FROM members m WHERE m.id = ${data.head_member_id}`)) as any[];
    if (!m || !(scope.scopeAll || scope.stateIds.includes(m.region_id))) {
      errors.push(getDict(c.get("lang"))("hh.val.head"));
      return render(400);
    }
    head = m;
  }

  const inserted = await db
    .insert(families)
    .values({
      name: data.name,
      address: data.address ?? head?.address ?? null,
      township: data.township ?? head?.township ?? null,
      phone: data.phone ?? head?.phone ?? null,
      homeCellId: data.home_cell_id ?? head?.home_cell_id ?? null,
      groupId: data.group_id ?? head?.group_id ?? null,
      regionId: data.region_id, notes: data.notes, createdBy: c.get("user").id,
    })
    .returning({ id: families.id });
  const familyId = inserted[0]!.id;
  if (photo.touched) await savePhoto(db, familyId, photo.bytes);
  c.set("auditNote", { summary: data.name });

  if (head) {
    const now = Math.floor(Date.now() / 1000);
    // If the member was head of another family, that family loses its head.
    if (head.family_id) {
      await db.update(families).set({ headMemberId: null })
        .where(and(eq(families.id, head.family_id), eq(families.headMemberId, head.id)));
    }
    await db.update(members)
      .set({ householdId: familyId, relationship: "head", updatedBy: c.get("user").id, updatedAt: now })
      .where(eq(members.id, head.id));
    await db.update(families).set({ headMemberId: head.id }).where(eq(families.id, familyId));
    await db.insert(memberHistory).values({
      memberId: head.id, actorId: c.get("user").id, action: "update",
      snapshotJson: JSON.stringify({ family_id: familyId, relationship: "head", created_household: true }),
    });
  }

  await ensureHouseholdFamilyGroup(
    db, familyId, data.region_id,
    data.home_cell_id ?? head?.home_cell_id ?? null,
    null,
    data.group_id ?? head?.group_id ?? null,
    allOptions,
  );

  const next = head
    ? `/admin/households/${familyId}?ok=hh.created`
    : `/admin/households/${familyId}/add-member?ok=hh.created`;
  if (fromModal) return c.html(<></>, 201, { "X-Redirect-To": next });
  return c.redirect(next, 302);
});

// ---------- GET /admin/households/:id ----------

householdsRoutes.get("/:id", requirePermission("members.view"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect("/admin/households?err=err-notfound", 302);
  const [row] = await db.all(sql`
    SELECT ${FAMILY_COLS}, r.name AS state_name, r.name_en AS state_name_en,
      head.name_myanmar AS head_name_mm, head.name_english AS head_name_en,
      hc.label AS home_cell_label,
      fg.label AS family_group_label, fg.code AS family_group_code
    FROM families f JOIN regions r ON r.id = f.region_id
    LEFT JOIN members head ON head.id = f.head_member_id
    LEFT JOIN lookup_options hc ON hc.id = COALESCE(f.home_cell_id, head.home_cell_id)
    LEFT JOIN lookup_options fg ON fg.id = COALESCE(f.family_group_id, head.family_group_id)
    WHERE f.id = ${id}`) as any[];
  if (!row || !(scope.scopeAll || scope.stateIds.includes(row.region_id))) {
    return c.redirect("/admin/households?err=err-notfound", 302);
  }
  const mems = await householdMembers(db, id);
  // One extra read so each child shows its current class and school.
  const [enrolments, auditRows] = await Promise.all([
    loadEnrolmentSummaries(db, mems.map((m: any) => Number(m.id))),
    // The trail for this household, written by the request middleware. Only
    // readers of the audit page see who changed it.
    c.get("perms").has("audit.view")
      ? db.all<{ at: number; username: string | null; action: string; summary: string | null }>(sql`
          SELECT at, username, action, summary FROM audit_log
          WHERE entity = 'household' AND entity_id = ${String(id)}
          ORDER BY at DESC, id DESC LIMIT 8`)
      : Promise.resolve([] as { at: number; username: string | null; action: string; summary: string | null }[]),
  ]);
  return c.html(
    <HouseholdDetailPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), c.get("lang"))}
      family={row} members={mems} rows={[]} enrolments={enrolments} lang={c.get("lang")}
      photoUrl={photoUrlOf(row)} audit={auditRows}
    />,
  );
});

// ---------- GET /admin/households/:id/photo ----------

householdsRoutes.get("/:id/photo", requirePermission("members.view"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.notFound();
  const rows = await db.all<{ photo: ArrayBuffer | number[] | null; region_id: number }>(sql`
    SELECT photo, region_id FROM families WHERE id = ${id}`);
  const row = rows[0];
  if (!row?.photo || !(scope.scopeAll || scope.stateIds.includes(row.region_id))) return c.notFound();
  // D1 returns BLOBs as byte arrays through the driver; wrap them for Response.
  const photo = Array.isArray(row.photo) ? Uint8Array.from(row.photo) : new Uint8Array(row.photo);
  const etag = `W/"household-${id}-${photo.byteLength}-${photoHash(photo)}"`;
  const headers: Record<string, string> = {
    "Content-Type": "image/webp",
    "Content-Length": String(photo.byteLength),
    "Cache-Control": "private, no-cache",
    "ETag": etag,
    "X-Content-Type-Options": "nosniff",
  };
  if (c.req.header("If-None-Match") === etag) return new Response(null, { status: 304, headers });
  return new Response(photo, { headers });
});

// ---------- GET /admin/households/:id/edit ----------

householdsRoutes.get("/:id/edit", requirePermission("members.update"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect("/admin/households?err=err-notfound", 302);
  // The household row and both lookup lists are independent: one query window.
  const [rowRows, allRegions, allOptions] = await Promise.all([
    db.all(sql`
      SELECT ${FAMILY_COLS}, head.home_cell_id AS head_home_cell_id, head.group_id AS head_group_id
      FROM families f LEFT JOIN members head ON head.id = f.head_member_id
      WHERE f.id = ${id}`),
    loadRegions(db),
    loadAllOptions(db),
  ]);
  const [row] = rowRows as any[];
  if (!row || !(scope.scopeAll || scope.stateIds.includes(row.region_id))) {
    return c.redirect("/admin/households?err=err-notfound", 302);
  }
  const values: HFormValues = {
    name: row.name, address: row.address ?? "", township: row.township ?? "",
    phone: row.phone ?? "", region_id: String(row.region_id), notes: row.notes ?? "",
    home_cell_id: row.home_cell_id != null ? String(row.home_cell_id)
      : row.head_home_cell_id != null ? String(row.head_home_cell_id) : "",
    group_id: row.group_id != null ? String(row.group_id)
      : row.head_group_id != null ? String(row.head_group_id) : "",
  };
  const opts = {
    user: c.get("user"), perms: c.get("perms"), values, errors: [] as string[],
    family: { id }, regions: scopedRegions(allRegions, scope, c.get("lang")), lang: c.get("lang"),
    options: hhFormOptions(allOptions), photoUrl: photoUrlOf(row),
  };
  if (c.req.query("modal") === "1") return c.html(<HouseholdFormFragment {...opts} modal />);
  return c.html(<HouseholdFormPage {...opts} />);
});

// ---------- POST /admin/households/:id ----------

householdsRoutes.post("/:id", requirePermission("members.update"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect("/admin/households?err=err-notfound", 302);
  const [row] = (await db.all(sql`SELECT ${FAMILY_COLS} FROM families f WHERE f.id = ${id}`)) as any[];
  if (!row || !(scope.scopeAll || scope.stateIds.includes(row.region_id))) {
    return c.redirect("/admin/households?err=err-notfound", 302);
  }
  const body = await c.req.parseBody();
  const allRegions = await loadRegions(db);
  const fromModal = s(body.from_modal) === "1";
  const { values, errors, data } = readAndValidate(body, scope, (k) => getDict(c.get("lang"))(k));
  const td = (k: string) => getDict(c.get("lang"))(k);
  const photo = parsePhoto(body, td);
  if (photo.error) errors.push(photo.error);
  const allOptions = await loadAllOptions(db);
  const render = (status: 400 | 200) => {
    const opts = {
      user: c.get("user"), perms: c.get("perms"), values, errors,
      family: { id }, regions: scopedRegions(allRegions, scope, c.get("lang")), lang: c.get("lang"),
      options: hhFormOptions(allOptions), photoUrl: photoUrlOf(row),
    };
    if (fromModal) return c.html(<HouseholdFormFragment {...opts} modal />, status);
    return c.html(<HouseholdFormPage {...opts} />, status);
  };
  if (!data || photo.error) return render(400);
  const placement = await householdPlacement(db, row);
  const homeCellId = data.home_cell_id ?? placement.homeCellId;
  const groupId = data.group_id ?? placement.groupId;
  await db
    .update(families)
    .set({
      name: data.name, address: data.address, township: data.township, phone: data.phone,
      homeCellId, groupId,
      regionId: data.region_id, notes: data.notes,
    })
    .where(eq(families.id, id));
  await ensureHouseholdFamilyGroup(
    db, id, data.region_id, homeCellId, placement.familyGroupId, groupId, allOptions,
  );
  if (photo.touched) await savePhoto(db, id, photo.bytes);
  // The edit form saves the photo too, so the route says which kind of save
  // this was; the trail keeps "household.photo" apart from "household.update".
  c.set("auditNote", photo.touched
    ? { action: "household.photo", summary: data.name }
    : { summary: data.name });
  const next = `/admin/households/${id}?ok=hh.updated`;
  if (fromModal) return c.html(<></>, 201, { "X-Redirect-To": next });
  return c.redirect(next, 302);
});

// ---------- POST /admin/households/:id/delete ----------

householdsRoutes.post("/:id/delete", requirePermission("members.delete"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect("/admin/households?err=err-notfound", 302);
  const [row] = (await db.all(sql`SELECT ${FAMILY_COLS} FROM families f WHERE f.id = ${id}`)) as any[];
  if (!row || !(scope.scopeAll || scope.stateIds.includes(row.region_id))) {
    return c.redirect("/admin/households?err=err-notfound", 302);
  }
  // Read before the row goes: the trail names the household that was removed.
  c.set("auditNote", { summary: row.name });
  await db.update(members).set({ householdId: null, relationship: "" }).where(eq(members.householdId, id));
  await db.delete(families).where(eq(families.id, id));
  return c.redirect("/admin/households?ok=hh.deleted", 302);
});

// ---------- Add member to household -> auto-assign family fields ----------

householdsRoutes.get("/:id/add-member", requirePermission("members.create"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect("/admin/households?err=err-notfound", 302);
  const [family] = (await db.all(sql`SELECT ${FAMILY_COLS}, r.name AS state_name FROM families f JOIN regions r ON r.id=f.region_id WHERE f.id = ${id}`)) as any[];
  if (!family || !(scope.scopeAll || scope.stateIds.includes(family.region_id))) {
    return c.redirect("/admin/households?err=err-notfound", 302);
  }
  const lang = c.get("lang");

  const q = s(c.req.query("q")).trim().slice(0, 100);
  let results: any[] = [];
  if (q) {
    const like = `%${q}%`;
    const inScope = scope.scopeAll
      ? sql`1=1`
      : scope.stateIds.length
        ? sql`m.region_id IN (${sql.join(scope.stateIds.map((sid) => sql`${sid}`), sql`, `)})`
        : sql`1=0`;
    results = (await db.all(sql`
      SELECT m.id, m.member_code, m.name_myanmar, m.name_english, m.phone,
             m.family_id, f.name AS family_name,
             r.name AS state_name, r.name_en AS state_name_en
      FROM members m
      JOIN regions r ON r.id = m.region_id
      LEFT JOIN families f ON f.id = m.family_id
      WHERE ${inScope}
        AND (m.family_id IS NULL OR m.family_id <> ${id})
        AND (m.name_myanmar LIKE ${like} OR m.name_english LIKE ${like}
             OR m.member_code LIKE ${like} OR m.phone LIKE ${like})
      ORDER BY COALESCE(NULLIF(m.name_english, ''), m.name_myanmar, '')
      LIMIT 20
    `)) as any[];
  }

  return c.html(
    <HouseholdSearchMemberPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), lang)}
      family={family} q={q} results={results} searched={Boolean(q)}
      lang={lang}
    />,
  );
});

/** The new-member form. It was only reachable as the POST error page before,
 *  so the quick-add form itself had no URL in the app; this is that URL. */
householdsRoutes.get("/:id/add-member/new", requirePermission("members.create"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect("/admin/households?err=err-notfound", 302);
  const [family] = (await db.all(sql`SELECT ${FAMILY_COLS} FROM families f WHERE f.id = ${id}`)) as any[];
  if (!family || !(scope.scopeAll || scope.stateIds.includes(family.region_id))) {
    return c.redirect("/admin/households?err=err-notfound", 302);
  }
  const lang = c.get("lang");
  const [allOptions, allRegions, placement] = await Promise.all([
    loadAllOptions(db), loadRegions(db), householdPlacement(db, family),
  ]);
  // Pre-fill what the household already decides so the required Home Cell is
  // usually not a fresh choice for the clerk.
  const cell = family.home_cell_id ?? placement.homeCellId;
  const group = family.group_id ?? placement.groupId;
  const values: Record<string, string> = {
    region_id: String(family.region_id),
    township: family.township ?? "",
    address: family.address ?? "",
    home_cell_id: cell ? String(cell) : "",
    group_id: group ? String(group) : "",
  };
  return c.html(
    <HouseholdAddMemberPage
      user={c.get("user")} perms={c.get("perms")} family={family}
      values={values} errors={[]}
      relationship={family.head_member_id ? "spouse" : "head"}
      options={hhFormOptions(allOptions)}
      regions={scopedRegions(allRegions, scope, lang)}
      lang={lang}
    />,
  );
});

/** Option lists shared by household forms (region cascade fields). */
function hhFormOptions(all: OptionRow[]): Record<string, OptionRow[]> {
  return {
    township: all.filter((o) => o.type === "township"),
    home_cell: all.filter((o) => o.type === "home_cell"),
    group: all.filter((o) => o.type === "group"),
    family_group: all.filter((o) => o.type === "family_group"),
    fellowship_category: all.filter((o) => o.type === "fellowship_category"),
  };
}


householdsRoutes.post("/:id/add-member", requirePermission("members.create"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const lang = c.get("lang");
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect("/admin/households?err=err-notfound", 302);
  const [family] = (await db.all(sql`SELECT ${FAMILY_COLS} FROM families f WHERE f.id = ${id}`)) as any[];
  if (!family || !(scope.scopeAll || scope.stateIds.includes(family.region_id))) {
    return c.redirect("/admin/households?err=err-notfound", 302);
  }
  // Adding a member is a household change; the URL alone would be classified
  // as an admin.* mutation instead.
  c.set("auditNote", {
    action: "household.update", entity: "household", entityId: String(id), summary: family.name,
  });
  const body = await c.req.parseBody();
  const relationship = s(body.relationship);
  const rel = (RELATIONSHIPS as readonly string[]).includes(relationship) ? relationship : "other";

  // The household's state, address, Home Cell and Group fill the form where the
  // clerk left them blank; after that the shared member validator applies the
  // same rules as the member form (Home Cell required, state scope, enums and
  // option ownership), so the two screens cannot drift apart.
  const input: Record<string, unknown> = {};
  for (const k of MEMBER_FORM_KEYS) input[k] = body[k];
  input.address = input.address || family.address || "";
  input.township = input.township || family.township || "";
  input.region_id = input.region_id || String(family.region_id);
  const allOptions = await loadAllOptions(db);
  const allRegions = await loadRegions(db);
  const placement = await householdPlacement(db, family);
  const postedHome = asInt(s(body.home_cell_id));
  const postedGroup = asInt(s(body.group_id));
  const homeCellId = family.home_cell_id ?? placement.homeCellId ?? postedHome;
  const groupId = family.group_id ?? placement.groupId ?? postedGroup;
  if (!input.home_cell_id && homeCellId) input.home_cell_id = String(homeCellId);
  if (!input.group_id && groupId) input.group_id = String(groupId);

  const { values, errors, data } = readMemberForm(input, {
    scope, options: allOptions, regions: allRegions, t: getDict(lang),
  });
  const render = (status: 400 | 200, duplicates: DuplicateCandidate[] = []) =>
    c.html(
      <HouseholdAddMemberPage user={c.get("user")} perms={c.get("perms")} family={family}
        values={values} errors={errors} relationship={rel}
        duplicates={duplicates}
        options={hhFormOptions(allOptions)}
        regions={scopedRegions(allRegions, scope, lang)}
        lang={lang} />, status,
    );
  if (!data) return render(400);
  // Same soft duplicate warning as the member form: the likely duplicate is
  // shown, and the clerk decides whether to save anyway. Adding a household
  // member is a member save, so it must not skip the check.
  if (s(body.confirm_duplicate) !== "1") {
    const duplicates = await findPossibleDuplicates(db, data, scope, null);
    if (duplicates.length > 0) return render(200, duplicates);
  }

  const now = Math.floor(Date.now() / 1000);
  const isHead = rel === "head";

  let familyGroupId = family.family_group_id ?? placement.familyGroupId;
  if (!familyGroupId && homeCellId) {
    familyGroupId = await ensureHouseholdFamilyGroup(
      db, id, family.region_id, homeCellId, null, groupId, allOptions,
    );
  } else if (!familyGroupId && isHead) {
    familyGroupId = data.family_group_id as number | null;
  }
  if (isHead && !family.home_cell_id && postedHome) {
    await db.update(families).set({ homeCellId: postedHome, groupId: postedGroup })
      .where(eq(families.id, id));
  }

  const inserted = await db
    .insert(members)
    .values({
      nameMyanmar: data.name_myanmar,
      nameEnglish: data.name_english,
      gender: data.gender,
      maritalStatus: data.marital_status,
      dateOfBirth: data.date_of_birth,
      bloodType: data.blood_type,
      phone: data.phone,
      nrcNumber: data.nrc_number,
      languages: data.languages,
      address: data.address,
      township: data.township,
      fatherName: data.father_name,
      motherName: data.mother_name,
      ethnicityId: data.ethnicity_id,
      educationId: data.education_id,
      job: data.job,
      workSkills: data.work_skills,
      income: data.income,
      salvationDate: data.salvation_date,
      notes: data.notes,
      status: data.status,
      regionId: data.region_id as number,
      householdId: id,
      relationship: rel,
      familyGroupId,
      groupId: (data.group_id as number | null) ?? groupId,
      homeCellId: (data.home_cell_id as number | null) ?? homeCellId,
      createdBy: c.get("user").id,
      updatedBy: c.get("user").id,
    } as any)
    .returning({ id: members.id });
  const memberId = inserted[0]!.id;
  await db.update(members).set({ memberCode: `CH-${String(memberId).padStart(5, "0")}` }).where(eq(members.id, memberId));

  if (isHead) {
    // One head per household: a newly added head replaces the previous one,
    // which becomes a plain member (matching the attach path below).
    await db.update(members).set({ relationship: "other" }).where(and(
      eq(members.householdId, id), eq(members.relationship, "head"), sql`${members.id} <> ${memberId}`,
    ));
    await db.update(families).set({ headMemberId: memberId }).where(eq(families.id, id));
  }
  await db.insert(memberHistory).values({
    memberId, actorId: c.get("user").id, action: "create",
    snapshotJson: JSON.stringify({ ...values, family_id: id, relationship: rel, source: "household" }),
  });

  return c.redirect(`/admin/households/${id}?ok=hh.memberAdded&member=${memberId}`, 302);
});

// ---------- attach/detach existing member ----------

householdsRoutes.post("/:id/attach", requirePermission("members.update"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect("/admin/households?err=err-notfound", 302);
  const [family] = (await db.all(sql`SELECT ${FAMILY_COLS} FROM families f WHERE f.id = ${id}`)) as any[];
  if (!family || !(scope.scopeAll || scope.stateIds.includes(family.region_id))) {
    return c.redirect("/admin/households?err=err-notfound", 302);
  }
  c.set("auditNote", { summary: family.name });
  const body = await c.req.parseBody();
  const memberId = intParam(s(body.member_id));
  const rel = s(body.relationship);
  if (!memberId) return c.redirect(`/admin/households/${id}?err=hh.noMember`, 302);
  const [m] = await db.select().from(members).where(eq(members.id, memberId)).limit(1);
  if (!m || !(scope.scopeAll || scope.stateIds.includes(m.regionId))) {
    return c.redirect(`/admin/households/${id}?err=err-notfound`, 302);
  }
  if (m.householdId === id) return c.redirect(`/admin/households/${id}?err=hh.alreadyMember`, 302);

  // Moving a household head leaves the old household without a head; clear the
  // stale pointer so it does not reference a member who is no longer inside.
  if (m.householdId) {
    await db.update(families).set({ headMemberId: null })
      .where(and(eq(families.id, m.householdId), eq(families.headMemberId, memberId)));
  }

  const relSafe = (RELATIONSHIPS as readonly string[]).includes(rel) ? rel : "other";
  await db.update(members)
    .set({ householdId: id, relationship: relSafe, updatedBy: c.get("user").id, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(members.id, memberId));

  // Auto-assign from the household placement; promoting a new head demotes the old one.
  const allOptions = await loadAllOptions(db);
  const placement = await householdPlacement(db, family);
  let familyGroupId = family.family_group_id ?? placement.familyGroupId;
  if (!familyGroupId && placement.homeCellId) {
    familyGroupId = await ensureHouseholdFamilyGroup(
      db, id, family.region_id, placement.homeCellId, null, placement.groupId, allOptions,
    );
  }
  const [head] = (await db.all(sql`
    SELECT m.* FROM members m WHERE m.family_id = ${id} AND m.relationship = 'head' AND m.id <> ${memberId} LIMIT 1`)) as any[];
  if (relSafe === "head") {
    if (head) {
      await db.update(members).set({ relationship: "other" }).where(eq(members.id, head.id));
    }
    await db.update(families).set({ headMemberId: memberId }).where(eq(families.id, id));
  } else if (head) {
    const set: Record<string, unknown> = {};
    if (!m.familyGroupId && head.familyGroupId) set.familyGroupId = head.familyGroupId;
    if (!m.groupId && head.groupId) set.groupId = head.groupId;
    if (!m.homeCellId && head.homeCellId) set.homeCellId = head.homeCellId;
    if (Object.keys(set).length > 0) {
      await db.update(members).set(set as any).where(eq(members.id, memberId));
    }
  }
  if (familyGroupId) {
    await db.update(members).set({
      familyGroupId,
      ...(placement.homeCellId ? { homeCellId: placement.homeCellId } : {}),
      ...(placement.groupId ? { groupId: placement.groupId } : {}),
    }).where(eq(members.id, memberId));
  }
  await db.insert(memberHistory).values({
    memberId, actorId: c.get("user").id, action: "update",
    snapshotJson: JSON.stringify({ family_id: id, relationship: relSafe, attached: true }),
  });
  return c.redirect(`/admin/households/${id}?ok=hh.attached`, 302);
});

// ---------- remove a member from a household (keeps the member record) ----------

householdsRoutes.post("/:id/detach", requirePermission("members.update"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect("/admin/households?err=err-notfound", 302);
  const [family] = (await db.all(sql`SELECT ${FAMILY_COLS} FROM families f WHERE f.id = ${id}`)) as any[];
  if (!family || !(scope.scopeAll || scope.stateIds.includes(family.region_id))) {
    return c.redirect("/admin/households?err=err-notfound", 302);
  }
  c.set("auditNote", { summary: family.name });
  const body = await c.req.parseBody();
  const memberId = intParam(s(body.member_id));
  if (!memberId) return c.redirect(`/admin/households/${id}?err=hh.noMember`, 302);
  const [m] = await db.select().from(members).where(eq(members.id, memberId)).limit(1);
  if (!m || m.householdId !== id || !(scope.scopeAll || scope.stateIds.includes(m.regionId))) {
    return c.redirect(`/admin/households/${id}?err=err-notfound`, 302);
  }

  if (family.head_member_id === memberId) {
    await db.update(families).set({ headMemberId: null }).where(eq(families.id, id));
  }
  await db.update(members)
    .set({ householdId: null, relationship: "", updatedBy: c.get("user").id, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(members.id, memberId));
  await db.insert(memberHistory).values({
    memberId, actorId: c.get("user").id, action: "update",
    snapshotJson: JSON.stringify({ family_id: null, detached_from: id }),
  });
  return c.redirect(`/admin/households/${id}?ok=hh.detached`, 302);
});
