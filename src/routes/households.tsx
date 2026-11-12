import { Hono } from "hono";
import { and, eq, sql } from "drizzle-orm";
import type { AppEnv } from "../env";
import { getDb, type DB } from "../db/client";
import { families, lookupOptions, memberHistory, members, regions } from "../db/schema";
import { requirePermission } from "../middleware";
import { flashFromQuery } from "../flash";
import { loadAllOptions, nextFamilyGroupCode, townshipOf, type OptionRow } from "../lookup";
import { asInt, intParam, isFutureDate, normKey, parseDateFlexible, s } from "../util";
import { getDict, type Lang } from "../i18n";
import {
  HouseholdAddMemberPage, HouseholdFormFragment, HouseholdFormPage, HouseholdsListPage, HouseholdDetailPage,
  HouseholdSearchMemberPage,
  type FormValues as HFormValues,
} from "../views/households";

export const householdsRoutes = new Hono<AppEnv>();

type Scope = { scopeAll: boolean; stateIds: number[] };

function scopeOf(c: { get: (k: "scopeAll" | "stateIds") => any }): Scope {
  return { scopeAll: c.get("scopeAll"), stateIds: c.get("stateIds") };
}

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
  const rows = (await db.all(sql`
    SELECT f.id, f.name, f.address, f.township, f.phone, f.created_at,
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
    WHERE ${scopeCondF(scope)} ${q ? sql`AND (f.name LIKE ${like} OR f.address LIKE ${like} OR f.phone LIKE ${like})` : sql``} ${townshipCond} ${regionCond}
    ORDER BY f.id DESC
    LIMIT 200`)) as any[];
  const lang = c.get("lang");
  // Township dropdown options for the filter, scoped like the list itself.
  const allOptions = await loadAllOptions(db);
  const townshipsInScope = scope.scopeAll
    ? allOptions.filter((o) => o.type === "township" && o.active === 1)
    : allOptions.filter((o) => o.type === "township" && o.active === 1 &&
        (o.regionId === 0 || scope.stateIds.includes(o.regionId)));
  const regionOptions = (await loadRegions(db))
    .filter((r) => scope.scopeAll || scope.stateIds.includes(r.id))
    .map((r) => ({ id: r.id, name: lang !== "mm" && r.nameEn ? r.nameEn : r.name }));
  return c.html(
    <HouseholdsListPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), lang)}
      rows={rows} q={q} township={township} townshipOptions={townshipsInScope} lang={lang}
      region={region} regions={regionOptions}
    />,
  );
});

// ---------- GET /admin/households/new ----------

householdsRoutes.get("/new", requirePermission("members.create"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const lang = c.get("lang");
  const allRegions = await loadRegions(db);
  const allOptions = await loadAllOptions(db);
  // Pre-select the member when arriving from Member detail → "New household".
  const preMemberId = intParam(c.req.query("member"));
  let values = defaultValues(scope);
  if (preMemberId) {
    const [m] = (await db.all(sql`SELECT * FROM members m WHERE m.id = ${preMemberId}`)) as any[];
    if (m && (scope.scopeAll || scope.stateIds.includes(m.region_id))) {
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
  }
  const headList = await headCandidates(db, scope, preMemberId);
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
  if (!data) return render(400);

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
    SELECT f.*, r.name AS state_name, r.name_en AS state_name_en,
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
  return c.html(
    <HouseholdDetailPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), c.get("lang"))}
      family={row} members={mems} rows={[]} lang={c.get("lang")}
    />,
  );
});

// ---------- GET /admin/households/:id/edit ----------

householdsRoutes.get("/:id/edit", requirePermission("members.update"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect("/admin/households?err=err-notfound", 302);
  const [row] = (await db.all(sql`
    SELECT f.*, head.home_cell_id AS head_home_cell_id, head.group_id AS head_group_id
    FROM families f LEFT JOIN members head ON head.id = f.head_member_id
    WHERE f.id = ${id}`)) as any[];
  if (!row || !(scope.scopeAll || scope.stateIds.includes(row.region_id))) {
    return c.redirect("/admin/households?err=err-notfound", 302);
  }
  const allRegions = await loadRegions(db);
  const values: HFormValues = {
    name: row.name, address: row.address ?? "", township: row.township ?? "",
    phone: row.phone ?? "", region_id: String(row.region_id), notes: row.notes ?? "",
    home_cell_id: row.home_cell_id != null ? String(row.home_cell_id)
      : row.head_home_cell_id != null ? String(row.head_home_cell_id) : "",
    group_id: row.group_id != null ? String(row.group_id)
      : row.head_group_id != null ? String(row.head_group_id) : "",
  };
  const allOptions = await loadAllOptions(db);
  const opts = {
    user: c.get("user"), perms: c.get("perms"), values, errors: [] as string[],
    family: { id }, regions: scopedRegions(allRegions, scope, c.get("lang")), lang: c.get("lang"),
    options: hhFormOptions(allOptions),
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
  const [row] = (await db.all(sql`SELECT f.* FROM families f WHERE f.id = ${id}`)) as any[];
  if (!row || !(scope.scopeAll || scope.stateIds.includes(row.region_id))) {
    return c.redirect("/admin/households?err=err-notfound", 302);
  }
  const body = await c.req.parseBody();
  const allRegions = await loadRegions(db);
  const fromModal = s(body.from_modal) === "1";
  const { values, errors, data } = readAndValidate(body, scope, (k) => getDict(c.get("lang"))(k));
  const allOptions = await loadAllOptions(db);
  const render = (status: 400 | 200) => {
    const opts = {
      user: c.get("user"), perms: c.get("perms"), values, errors,
      family: { id }, regions: scopedRegions(allRegions, scope, c.get("lang")), lang: c.get("lang"),
      options: hhFormOptions(allOptions),
    };
    if (fromModal) return c.html(<HouseholdFormFragment {...opts} modal />, status);
    return c.html(<HouseholdFormPage {...opts} />, status);
  };
  if (!data) return render(400);
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
  const [row] = (await db.all(sql`SELECT f.* FROM families f WHERE f.id = ${id}`)) as any[];
  if (!row || !(scope.scopeAll || scope.stateIds.includes(row.region_id))) {
    return c.redirect("/admin/households?err=err-notfound", 302);
  }
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
  const [family] = (await db.all(sql`SELECT f.*, r.name AS state_name FROM families f JOIN regions r ON r.id=f.region_id WHERE f.id = ${id}`)) as any[];
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

const MEMBER_FORM_KEYS = [
  "name_myanmar", "name_english", "gender", "marital_status", "date_of_birth", "blood_type",
  "phone", "nrc_number", "languages", "address", "father_name", "mother_name",
  "ethnicity_id", "education_id", "family_group_id", "job", "work_skills", "income",
  "region_id", "township", "home_cell_id", "group_id", "fellowship_category_id",
  "salvation_date", "status", "notes", "relationship",
] as const;

householdsRoutes.post("/:id/add-member", requirePermission("members.create"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const lang = c.get("lang");
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect("/admin/households?err=err-notfound", 302);
  const [family] = (await db.all(sql`SELECT f.* FROM families f WHERE f.id = ${id}`)) as any[];
  if (!family || !(scope.scopeAll || scope.stateIds.includes(family.region_id))) {
    return c.redirect("/admin/households?err=err-notfound", 302);
  }
  const body = await c.req.parseBody();
  const relationship = s(body.relationship);
  const rel = (RELATIONSHIPS as readonly string[]).includes(relationship) ? relationship : "other";
  const values: Record<string, string> = {};
  for (const k of MEMBER_FORM_KEYS) values[k] = s(body[k]);
  values.address = values.address || family.address || "";
  values.township = values.township || family.township || "";
  values.region_id = values.region_id || String(family.region_id);
  const errors: string[] = [];
  const td = getDict(lang);
  if (!values.name_myanmar && !values.name_english) errors.push(td("val.name"));
  const regionId = asInt(values.region_id);
  if (regionId === null || (!scope.scopeAll && !scope.stateIds.includes(regionId))) {
    errors.push(td("val.state"));
  }
  // Same date rules as the full member form: normalise the input and refuse
  // impossible or future dates instead of storing them verbatim.
  let dateOfBirth: string | null = null;
  if (values.date_of_birth) {
    dateOfBirth = parseDateFlexible(values.date_of_birth);
    if (!dateOfBirth) errors.push(td("val.dob"));
    else if (isFutureDate(dateOfBirth)) errors.push(td("val.dobFuture"));
  }
  let salvationDate: string | null = null;
  if (values.salvation_date) {
    salvationDate = parseDateFlexible(values.salvation_date);
    if (!salvationDate) errors.push(td("val.salvation"));
    else if (isFutureDate(salvationDate)) errors.push(td("val.salvationFuture"));
  }
  if (errors.length > 0) {
    const allOptions = await loadAllOptions(db);
    const allRegions = await loadRegions(db);
    return c.html(
      <HouseholdAddMemberPage user={c.get("user")} perms={c.get("perms")} family={family}
        values={values} errors={errors} relationship={rel}
        options={hhFormOptions(allOptions)}
        regions={scopedRegions(allRegions, scope, lang)}
        lang={lang} />, 400,
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const isHead = rel === "head";

  // The household's Home Cell and Family Group win; a new head may seed them
  // when the household was created before those columns existed.
  const allOptions = await loadAllOptions(db);
  const placement = await householdPlacement(db, family);
  const postedHome = asInt(values.home_cell_id);
  const postedGroup = asInt(values.group_id);
  const homeCellId = family.home_cell_id ?? placement.homeCellId ?? postedHome;
  const groupId = family.group_id ?? placement.groupId ?? postedGroup;
  let familyGroupId = family.family_group_id ?? placement.familyGroupId;
  if (!familyGroupId && homeCellId) {
    familyGroupId = await ensureHouseholdFamilyGroup(
      db, id, family.region_id, homeCellId, null, groupId, allOptions,
    );
  } else if (!familyGroupId && isHead) {
    familyGroupId = asInt(values.family_group_id);
  }
  if (isHead && !family.home_cell_id && postedHome) {
    await db.update(families).set({ homeCellId: postedHome, groupId: postedGroup })
      .where(eq(families.id, id));
  }

  const inserted = await db
    .insert(members)
    .values({
      nameMyanmar: values.name_myanmar || null,
      nameEnglish: values.name_english || null,
      gender: values.gender ?? "",
      maritalStatus: values.marital_status ?? "",
      dateOfBirth,
      bloodType: values.blood_type ?? "",
      phone: values.phone || null,
      nrcNumber: values.nrc_number || null,
      languages: values.languages || null,
      address: values.address || null,
      township: values.township || null,
      fatherName: values.father_name || null,
      motherName: values.mother_name || null,
      ethnicityId: asInt(values.ethnicity_id),
      educationId: asInt(values.education_id),
      job: values.job || null,
      workSkills: values.work_skills || null,
      income: values.income ? Number(values.income.replace(/[,\s]/g, "")) || null : null,
      salvationDate,
      notes: values.notes || null,
      status: values.status === "inactive" ? "inactive" : "active",
      regionId: regionId!,
      householdId: id,
      relationship: rel,
      familyGroupId, groupId, homeCellId,
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
  const [family] = (await db.all(sql`SELECT f.* FROM families f WHERE f.id = ${id}`)) as any[];
  if (!family || !(scope.scopeAll || scope.stateIds.includes(family.region_id))) {
    return c.redirect("/admin/households?err=err-notfound", 302);
  }
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
  const [family] = (await db.all(sql`SELECT f.* FROM families f WHERE f.id = ${id}`)) as any[];
  if (!family || !(scope.scopeAll || scope.stateIds.includes(family.region_id))) {
    return c.redirect("/admin/households?err=err-notfound", 302);
  }
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
