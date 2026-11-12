import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const regions = sqliteTable("regions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull(),
  slug: text("slug").notNull().unique(),
  /** Short code (REG-001…) used in export/filter labels. */
  code: text("code"),
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  active: integer("active").notNull().default(1),
  mustChangePassword: integer("must_change_password").notNull().default(0),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: integer("locked_until").notNull().default(0),
  /** UI language chosen by this account (mm | en | kr); NULL until they switch. */
  language: text("language"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  },
  (t) => ({
    userIdx: index("sessions_user_idx").on(t.userId),
    expiresIdx: index("sessions_expires_idx").on(t.expiresAt),
  }),
);

export const roles = sqliteTable(
  "roles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull().unique(),
    description: text("description"),
    isSystem: integer("is_system").notNull().default(0),
  },
);

export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.roleId, t.permission] }) }),
);

export const userRoles = sqliteTable(
  "user_roles",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.roleId] }) }),
);

/** region_id = ALL_STATES_WILDCARD (0) means every state -> intentionally no FK. */
export const userStateAssignments = sqliteTable(
  "user_state_assignments",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    regionId: integer("region_id").notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.regionId] }) }),
);

/** Dashboard age-group categories; ranges adjustable on /admin/options?type=age_group. */
export const ageGroups = sqliteTable("age_groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  minAge: integer("min_age").notNull(),
  maxAge: integer("max_age").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const lookupOptions = sqliteTable(
  "lookup_options",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type").notNull(),
    label: text("label").notNull(),
    active: integer("active").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    /** State this option belongs to; 0 = available in every state (all-states wildcard, no FK). */
    regionId: integer("region_id").notNull().default(0),
    /** Optional parent option: Home Cell -> Township, Family Group -> Home Cell. */
    parentId: integer("parent_id"),
    /** Optional Regional Church for Home Cell options. */
    regionalChurchId: integer("regional_church_id").references(() => regionalChurches.id),
    /** Optional supervision cluster; a cluster can span townships in one state. */
    supervisionClusterId: integer("supervision_cluster_id").references(() => supervisionClusters.id),
    /** Short code (TWP-001, CEL-014, …) shown in dropdowns/export; unique per type+region. */
    code: text("code"),
    /** Township prefix for Family Group codes (INS -> INS_FG001); unique per type+region. */
    shortCode: text("short_code"),
  },
  (t) => ({
    typeIdx: index("lookup_options_type_idx").on(t.type),
    typeLabelUq: uniqueIndex("lookup_options_type_label_uq").on(t.type, t.label, t.regionId),
    regionIdx: index("lookup_options_region_idx").on(t.regionId),
    parentIdx: index("lookup_options_parent_idx").on(t.parentId),
    supervisionClusterIdx: index("lookup_options_supervision_cluster_idx").on(t.supervisionClusterId),
  }),
);

export const OPTION_TYPES = [
  "ethnicity",
  "education",
  "home_cell",
  "family_group",
  "fellowship_category",
  "sector",
  "group",
  "township",
  "blood_type",
] as const;
export type OptionType = (typeof OPTION_TYPES)[number];

/** Option types that can be limited to one State/Region (member form cascade). */
export const REGION_SCOPED_TYPES = ["township", "home_cell", "group", "family_group"] as const;
export function isRegionScopedType(type: string): boolean {
  return (REGION_SCOPED_TYPES as readonly string[]).includes(type);
}

export const OPTION_TYPE_LABELS: Record<OptionType, string> = {
  ethnicity: "လူမျိုး (Ethnicity)",
  education: "ပညာရည် (Education)",
  home_cell: "Home Cell",
  family_group: "Family Group",
  fellowship_category: "Fellowship",
  sector: "ကဏ္ဍ",
  group: "Group",
  township: "မြို့နယ် (Township)",
  blood_type: "သွေးအမျိုးအစား (Blood Type)",
};

export const OPTION_TYPE_LABELS_KR: Record<OptionType, string> = {
  ethnicity: "민족",
  education: "학력",
  home_cell: "홈셀",
  family_group: "가족 그룹",
  fellowship_category: "친교",
  sector: "부문",
  group: "그룹",
  township: "타운십",
  blood_type: "혈액형",
};

export const OPTION_TYPE_LABELS_EN: Record<OptionType, string> = {
  ethnicity: "Ethnicity",
  education: "Education",
  home_cell: "Home Cell",
  family_group: "Family Group",
  fellowship_category: "Fellowship",
  sector: "Sector",
  group: "Group",
  township: "Township",
  blood_type: "Blood Type",
};

/** Households: one row per family; the head member anchors it. head_member_id
 * has no FK so the registry record survives head deletion. */
export const families = sqliteTable("families", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  headMemberId: integer("head_member_id"),
  address: text("address"),
  township: text("township"),
  phone: text("phone"),
  homeCellId: integer("home_cell_id").references(() => lookupOptions.id),
  groupId: integer("group_id").references(() => lookupOptions.id),
  familyGroupId: integer("family_group_id").references(() => lookupOptions.id),
  regionId: integer("region_id")
    .notNull()
    .references(() => regions.id),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
}, (t) => ({
  regionIdx: index("families_region_idx").on(t.regionId),
  headIdx: index("families_head_idx").on(t.headMemberId),
}));

export const members = sqliteTable(
  "members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    memberCode: text("member_code").unique(),
    nameEnglish: text("name_english"),
    nameMyanmar: text("name_myanmar"),
    gender: text("gender").notNull().default(""),
    maritalStatus: text("marital_status").notNull().default(""),
    dateOfBirth: text("date_of_birth"),
    bloodType: text("blood_type").notNull().default(""),
    phone: text("phone"),
    nrcNumber: text("nrc_number"),
    ethnicityId: integer("ethnicity_id").references(() => lookupOptions.id),
    languages: text("languages"),
    educationId: integer("education_id").references(() => lookupOptions.id),
    job: text("job"),
    workSkills: text("work_skills"),
    income: integer("income"),
    address: text("address"),
    township: text("township"),
    fatherName: text("father_name"),
    motherName: text("mother_name"),
    salvationDate: text("salvation_date"),
    familyGroupId: integer("family_group_id").references(() => lookupOptions.id),
    fellowshipCategoryId: integer("fellowship_category_id").references(() => lookupOptions.id),
    sectorId: integer("sector_id").references(() => lookupOptions.id),
    groupId: integer("group_id").references(() => lookupOptions.id),
    homeCellId: integer("home_cell_id").references(() => lookupOptions.id),
    departmentId: integer("department_id").references(() => churchDepartments.id),
    householdId: integer("family_id"),
    relationship: text("relationship").notNull().default(""),
    regionId: integer("region_id")
      .notNull()
      .references(() => regions.id),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    createdBy: integer("created_by").references(() => users.id),
    updatedBy: integer("updated_by").references(() => users.id),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
  },
  (t) => ({
    regionIdx: index("members_region_idx").on(t.regionId),
    statusIdx: index("members_status_idx").on(t.status),
    familyIdx: index("members_family_idx").on(t.householdId),
    groupIdx: index("members_group_idx").on(t.groupId),
    sectorIdx: index("members_sector_idx").on(t.sectorId),
    homeCellIdx: index("members_home_cell_idx").on(t.homeCellId),
    departmentIdx: index("members_department_idx").on(t.departmentId),
    townshipIdx: index("members_township_idx").on(t.township),
  }),
);

/** Church departments live above Home Cells and are managed independently of
 * member records, so a department can exist before it has leaders. */
export const churchDepartments = sqliteTable(
  "church_departments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    nameEn: text("name_en"),
    active: integer("active").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  },
  (t) => ({ nameUq: uniqueIndex("church_departments_name_uq").on(t.name) }),
);

/** Editable position catalogue. `scope_type` is church, regional_church,
 * home_cell, township (Home Cell supervision) or department. Codes are stable
 * because member_positions stores the code, not the display label. */
export const positionDefs = sqliteTable(
  "position_defs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scopeType: text("scope_type").notNull(),
    code: text("code").notNull(),
    nameMyanmar: text("name_myanmar").notNull(),
    nameEnglish: text("name_english"),
    nameKorean: text("name_korean"),
    active: integer("active").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
  },
  (t) => ({
    scopeCodeUq: uniqueIndex("position_defs_scope_code_uq").on(t.scopeType, t.code),
    scopeIdx: index("position_defs_scope_idx").on(t.scopeType, t.active, t.sortOrder),
  }),
);

/** Optional organisational layer above Home Cells. A regional church belongs
 * to one state/region and can own several Home Cells. */
export const regionalChurches = sqliteTable(
  "regional_churches",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    nameEn: text("name_en"),
    regionId: integer("region_id").notNull().references(() => regions.id),
    active: integer("active").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  },
  (t) => ({
    nameUq: uniqueIndex("regional_churches_name_uq").on(t.name),
    regionIdx: index("regional_churches_region_idx").on(t.regionId, t.active, t.sortOrder),
  }),
);

/** A state-scoped supervision cluster can group Home Cells from several
 * townships, so one supervisor team can cover four or five cells. */
export const supervisionClusters = sqliteTable(
  "supervision_clusters",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    nameEn: text("name_en"),
    regionId: integer("region_id").notNull().references(() => regions.id),
    active: integer("active").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  },
  (t) => ({
    nameRegionUq: uniqueIndex("supervision_clusters_name_region_uq").on(t.name, t.regionId),
    regionIdx: index("supervision_clusters_region_idx").on(t.regionId, t.active, t.sortOrder),
  }),
);

/** Separate pastor directory. A pastor belongs to one State/Region and can
 * optionally be tied to one of its Regional Churches, without creating a
 * member record. */
export const pastors = sqliteTable(
  "pastors",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    nameEn: text("name_en"),
    regionId: integer("region_id").notNull().references(() => regions.id),
    regionalChurchId: integer("regional_church_id").references(() => regionalChurches.id),
    phone: text("phone"),
    active: integer("active").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    sourceMemberId: integer("source_member_id"),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
  },
  (t) => ({
    regionIdx: index("pastors_region_idx").on(t.regionId, t.active, t.sortOrder),
    churchIdx: index("pastors_church_idx").on(t.regionalChurchId, t.active, t.sortOrder),
  }),
);

/** Pastoral oversight for a supervision cluster. Kept separate from
 * member_positions because one pastor may cover several clusters. */
export const clusterPastorAssignments = sqliteTable(
  "cluster_pastor_assignments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clusterId: integer("cluster_id")
      .notNull()
      .unique()
      .references(() => supervisionClusters.id, { onDelete: "cascade" }),
    pastorId: integer("pastor_id")
      .notNull()
      .references(() => pastors.id, { onDelete: "cascade" }),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
  },
  (t) => ({
    pastorIdx: index("cluster_pastor_assignments_pastor_idx").on(t.pastorId),
  }),
);

/** Service position held by a member (Home Cell Leader, Department Head, …).
 * scope_type/scope_id/department_id are generic so church-level roles can
 * reuse the table without another schema change. */
export const memberPositions = sqliteTable(
  "member_positions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    position: text("position").notNull(),
    scopeType: text("scope_type").notNull().default("home_cell"),
    scopeId: integer("scope_id").references(() => lookupOptions.id),
    departmentId: integer("department_id").references(() => churchDepartments.id),
    regionalChurchId: integer("regional_church_id").references(() => regionalChurches.id),
    supervisionClusterId: integer("supervision_cluster_id").references(() => supervisionClusters.id),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
  },
  (t) => ({
    memberIdx: index("member_positions_member_idx").on(t.memberId),
    scopeIdx: index("member_positions_scope_idx").on(t.scopeType, t.scopeId),
    supervisionClusterIdx: index("member_positions_supervision_cluster_idx").on(t.supervisionClusterId),
    memberScopeUq: uniqueIndex("member_positions_member_scope_uq").on(t.memberId, t.scopeType),
  }),
);

/** Member change history — one row per mutating action on a member.
 * Kept without an FK on member_id so history survives member deletion. */
export const memberHistory = sqliteTable(
  "member_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    memberId: integer("member_id").notNull(),
    actorId: integer("actor_id")
      .notNull()
      .references(() => users.id),
    action: text("action").notNull(),
    snapshotJson: text("snapshot_json").notNull(),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  },
  (t) => ({
    memberIdx: index("member_history_member_idx").on(t.memberId, t.createdAt),
    actorIdx: index("member_history_actor_idx").on(t.actorId),
  }),
);

/** Audit trail for position definitions and member assignments. Member and
 * definition ids are plain integers so history survives their deletion, and
 * `changes_json` keeps the before/after values for each edited field. */
export const positionHistory = sqliteTable(
  "position_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entity: text("entity").notNull(),
    action: text("action").notNull(),
    scopeType: text("scope_type"),
    code: text("code"),
    positionDefId: integer("position_def_id"),
    memberId: integer("member_id"),
    actorId: integer("actor_id").notNull().references(() => users.id),
    summary: text("summary"),
    changesJson: text("changes_json"),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  },
  (t) => ({
    createdIdx: index("position_history_created_idx").on(t.createdAt),
    entityIdx: index("position_history_entity_idx").on(t.entity, t.createdAt),
    memberIdx: index("position_history_member_idx").on(t.memberId, t.createdAt),
  }),
);

/** Daily activity reports: one row per author per day (unique index), with an
 * optional review pass by a leader who can see the author's state. */
export const activityReports = sqliteTable("activity_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reportDate: text("report_date").notNull(),
  authorId: integer("author_id").notNull().references(() => users.id),
  regionId: integer("region_id").notNull().references(() => regions.id),
  township: text("township"),
  homeCellId: integer("home_cell_id").references(() => lookupOptions.id),
  groupId: integer("group_id").references(() => lookupOptions.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  attendance: integer("attendance"),
  newContacts: integer("new_contacts"),
  followUps: integer("follow_ups"),
  challenges: text("challenges"),
  prayerRequests: text("prayer_requests"),
  nextSteps: text("next_steps"),
  /** submitted | reviewed (draft is reserved for the save-draft flow). */
  status: text("status").notNull().default("submitted"),
  reviewerId: integer("reviewer_id").references(() => users.id),
  reviewNote: text("review_note"),
  reviewedAt: integer("reviewed_at"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
}, (t) => ({
  authorDateUq: uniqueIndex("activity_reports_author_date_uq").on(t.authorId, t.reportDate),
  regionDateIdx: index("activity_reports_region_date_idx").on(t.regionId, t.reportDate),
  statusIdx: index("activity_reports_status_idx").on(t.status),
}));

/** One row per successful report edit; `changes` is a JSON array of field diffs. */
export const reportEdits = sqliteTable("report_edits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reportId: integer("report_id").notNull().references(() => activityReports.id),
  editorId: integer("editor_id").notNull().references(() => users.id),
  editedAt: integer("edited_at").notNull().default(sql`(unixepoch())`),
  changes: text("changes").notNull(),
}, (t) => ({
  reportIdx: index("report_edits_report_idx").on(t.reportId, t.editedAt),
}));

/** Per-IP login attempt log for the sliding-window rate limiter. */
export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    ip: text("ip").notNull(),
    at: integer("at").notNull().default(sql`(unixepoch())`),
  },
  (t) => ({
    ipIdx: index("login_attempts_ip_idx").on(t.ip, t.at),
  }),
);
