import { Hono } from "hono";
import { and, eq, sql } from "drizzle-orm";
import type { AppEnv } from "../env";
import { getDb, type DB } from "../db/client";
import { families, lookupOptions, memberHistory, members, regions } from "../db/schema";
import { requirePermission } from "../middleware";
import { flashFromQuery } from "../flash";
import { loadAllOptions, type OptionRow } from "../lookup";
import { asInt, intParam, normKey, s } from "../util";
import { getDict } from "../i18n";
import {
  HouseholdAddMemberPage, HouseholdFormFragment, HouseholdFormPage, HouseholdsListPage, HouseholdDetailPage,
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
    .select({ id: regions.id, name: regions.name, nameEn: regions.nameEn, slug: regions.slug })
    .from(regions)
    .orderBy(regions.id)) as { id: number; name: string; nameEn: string; slug: string }[];
}

function scopedRegions(all: { id: number; name: string; nameEn: string }[], scope: Scope, lang: "mm" | "en") {
  return all
    .filter((r) => scope.scopeAll || scope.stateIds.includes(r.id))
    .map((r) => ({ id: r.id, name: lang === "en" && r.nameEn ? r.nameEn : r.name }));
}

const FORM_KEYS = ["name", "head_name", "address", "township", "phone", "region_id", "notes"] as const;

type Validated = {
  values: HFormValues;
  errors: string[];
  data: {
    name: string; address: string | null; township: string | null; phone: string | null;
    region_id: number; notes: string | null; head_name: string;
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
  const headName = (v.head_name ?? "").trim();
  if (headName && headName.length > 120) errors.push(translate("hh.val.headLong"));
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
      head_name: headName,
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
    SELECT m.id, m.name_myanmar, m.name_english, m.gender, m.status, m.relationship, m.date_of_birth
    FROM members m WHERE m.family_id = ${familyId}
    ORDER BY CASE WHEN m.relationship = 'head' THEN 0 ELSE 1 END, m.id ASC`)) as any[];
}

// ---------- GET /admin/households ----------

householdsRoutes.get("/", requirePermission("members.view"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const q = (c.req.query("q") ?? "").trim().slice(0, 100);
  const like = `%${q}%`;
  const search = q ? sql` AND (f.name LIKE ${like} OR f.address LIKE ${like} OR f.phone LIKE ${like})` : sql``;
  void search;
  const rows = (await db.all(sql`
    SELECT f.id, f.name, f.address, f.township, f.phone, f.created_at,
           r.name AS state_name, r.name_en AS state_name_en,
           head.name_myanmar AS head_name_mm, head.name_english AS head_name_en,
           hm.cnt AS member_count
    FROM families f
    JOIN regions r ON r.id = f.region_id
    LEFT JOIN members head ON head.id = f.head_member_id
    LEFT JOIN (SELECT family_id, COUNT(*) AS cnt FROM members WHERE family_id IS NOT NULL GROUP BY family_id) hm
      ON hm.family_id = f.id
    WHERE ${scopeCondF(scope)} ${q ? sql`AND (f.name LIKE ${like} OR f.address LIKE ${like} OR f.phone LIKE ${like})` : sql``}
    ORDER BY f.id DESC
    LIMIT 200`)) as any[];
  const lang = c.get("lang");
  return c.html(
    <HouseholdsListPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), lang)}
      rows={rows} q={q} lang={lang}
    />,
  );
});

// ---------- GET /admin/households/new ----------

householdsRoutes.get("/new", requirePermission("members.create"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const allRegions = await loadRegions(db);
  const allOptions = await loadAllOptions(db);
  const opts = {
    user: c.get("user"), perms: c.get("perms"), values: defaultValues(scope), errors: [] as string[],
    family: null as null | { id: number }, regions: scopedRegions(allRegions, scope, c.get("lang")), lang: c.get("lang"),
    options: hhFormOptions(allOptions),
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
  const { values, errors, data } = readAndValidate(body, scope, (k) => getDict(c.get("lang"))(k));
  const allOptions = await loadAllOptions(db);
  const render = (status: 400 | 200) => {
    const opts = {
      user: c.get("user"), perms: c.get("perms"), values, errors,
      family: null as null | { id: number }, regions: scopedRegions(allRegions, scope, c.get("lang")), lang: c.get("lang"),
      options: hhFormOptions(allOptions),
    };
    if (fromModal) return c.html(<HouseholdFormFragment {...opts} modal />, status);
    return c.html(<HouseholdFormPage {...opts} />, status);
  };
  if (!data) return render(400);

  const inserted = await db
    .insert(families)
    .values({
      name: data.name, address: data.address, township: data.township, phone: data.phone,
      regionId: data.region_id, notes: data.notes, createdBy: c.get("user").id,
    })
    .returning({ id: families.id });
  const familyId = inserted[0]!.id;

  const next = `/admin/households/${familyId}/add-member?new=1`;
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
      head.name_myanmar AS head_name_mm, head.name_english AS head_name_en
    FROM families f JOIN regions r ON r.id = f.region_id
    LEFT JOIN members head ON head.id = f.head_member_id
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
  const [row] = (await db.all(sql`SELECT f.* FROM families f WHERE f.id = ${id}`)) as any[];
  if (!row || !(scope.scopeAll || scope.stateIds.includes(row.region_id))) {
    return c.redirect("/admin/households?err=err-notfound", 302);
  }
  const allRegions = await loadRegions(db);
  const values: HFormValues = {
    name: row.name, address: row.address ?? "", township: row.township ?? "",
    phone: row.phone ?? "", region_id: String(row.region_id), notes: row.notes ?? "", head_name: "",
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
  await db
    .update(families)
    .set({
      name: data.name, address: data.address, township: data.township, phone: data.phone,
      regionId: data.region_id, notes: data.notes,
    })
    .where(eq(families.id, id));
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
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect("/admin/households?err=err-notfound", 302);
  const [family] = (await db.all(sql`SELECT f.*, r.name AS state_name FROM families f JOIN regions r ON r.id=f.region_id WHERE f.id = ${id}`)) as any[];
  if (!family) return c.redirect("/admin/households?err=err-notfound", 302);
  const lang = c.get("lang");
  const allOptions = await loadAllOptions(db);
  const allRegions = await loadRegions(db);
  return c.html(
    <HouseholdAddMemberPage
      user={c.get("user")} perms={c.get("perms")}
      family={family} values={defaultAddValues(family)} errors={[]} relationship={s(c.req.query("rel")) || "spouse"}
      options={hhFormOptions(allOptions)}
      regions={scopedRegions(allRegions, scopeOf(c), lang)}
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

/** Pre-fill address/township/region from the household; relationship selectable. */
function defaultAddValues(family: any): Record<string, string> {
  return {
    address: family.address ?? "",
    township: family.township ?? "",
    region_id: String(family.region_id ?? ""),
    status: "active",
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
  if (!values.name_myanmar && !values.name_english) errors.push(getDict(lang)("val.name"));
  const regionId = asInt(values.region_id);
  if (regionId === null || (!scope.scopeAll && !scope.stateIds.includes(regionId))) {
    errors.push(getDict(lang)("val.state"));
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

  // Auto-assign: an existing head's family_group / group / home_cell are copied
  // onto the new member so dropdown assignments follow the household.
  let familyGroupId: number | null = null;
  let groupId: number | null = null;
  let homeCellId: number | null = null;
  if (isHead) {
    familyGroupId = asInt(values.family_group_id);
    groupId = asInt(values.group_id);
    homeCellId = asInt(values.home_cell_id);
  } else {
    const [head] = (await db.all(sql`
      SELECT m.* FROM members m
      WHERE m.family_id = ${id} AND m.relationship = 'head' LIMIT 1`)) as any[];
    if (head) {
      familyGroupId = head.family_group_id;
      groupId = head.group_id;
      homeCellId = head.home_cell_id;
    }
  }

  const inserted = await db
    .insert(members)
    .values({
      nameMyanmar: values.name_myanmar || null,
      nameEnglish: values.name_english || null,
      gender: values.gender ?? "",
      maritalStatus: values.marital_status ?? "",
      dateOfBirth: values.date_of_birth || null,
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
      salvationDate: values.salvation_date || null,
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
  const relSafe = (RELATIONSHIPS as readonly string[]).includes(rel) ? rel : "other";
  await db.update(members)
    .set({ householdId: id, relationship: relSafe, updatedBy: c.get("user").id, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(members.id, memberId));

  // Auto-assign from head when attaching non-head members.
  const [head] = (await db.all(sql`
    SELECT m.* FROM members m WHERE m.family_id = ${id} AND m.relationship = 'head' LIMIT 1`)) as any[];
  if (head && relSafe !== "head" && relSafe !== "spouse" && relSafe !== "son" && relSafe !== "daughter") {
    // non-descriptor relationships leave assignments alone
  } else {
    const set: Record<string, unknown> = {};
    if (head) {
      if (!m.familyGroupId && head.familyGroupId) set.familyGroupId = head.familyGroupId;
      if (!m.groupId && head.groupId) set.groupId = head.groupId;
      if (!m.homeCellId && head.homeCellId) set.homeCellId = head.homeCellId;
    }
    if (relSafe === "head") {
      await db.update(families).set({ headMemberId: memberId }).where(eq(families.id, id));
    }
    if (Object.keys(set).length > 0) {
      await db.update(members).set(set as any).where(eq(members.id, memberId));
    }
  }
  await db.insert(memberHistory).values({
    memberId, actorId: c.get("user").id, action: "update",
    snapshotJson: JSON.stringify({ family_id: id, relationship: relSafe, attached: true }),
  });
  return c.redirect(`/admin/households/${id}?ok=hh.attached`, 302);
});
