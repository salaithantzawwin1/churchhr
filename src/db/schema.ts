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
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  active: integer("active").notNull().default(1),
  mustChangePassword: integer("must_change_password").notNull().default(0),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: integer("locked_until").notNull().default(0),
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
  },
  (t) => ({
    typeIdx: index("lookup_options_type_idx").on(t.type),
    typeLabelUq: uniqueIndex("lookup_options_type_label_uq").on(t.type, t.label),
  }),
);

export const OPTION_TYPES = [
  "ethnicity",
  "education",
  "home_cell",
  "family_group",
  "fellowship_category",
  "group",
] as const;
export type OptionType = (typeof OPTION_TYPES)[number];

export const OPTION_TYPE_LABELS: Record<OptionType, string> = {
  ethnicity: "လူမျိုး (Ethnicity)",
  education: "ပညာရည် (Education)",
  home_cell: "Home Cell",
  family_group: "Family Group",
  fellowship_category: "Fellowship Categories",
  group: "Group",
};

export const OPTION_TYPE_LABELS_EN: Record<OptionType, string> = {
  ethnicity: "Ethnicity",
  education: "Education",
  home_cell: "Home Cell",
  family_group: "Family Group",
  fellowship_category: "Fellowship Categories",
  group: "Group",
};

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
    fatherName: text("father_name"),
    motherName: text("mother_name"),
    salvationDate: text("salvation_date"),
    familyGroupId: integer("family_group_id").references(() => lookupOptions.id),
    fellowshipCategoryId: integer("fellowship_category_id").references(() => lookupOptions.id),
    groupId: integer("group_id").references(() => lookupOptions.id),
    homeCellId: integer("home_cell_id").references(() => lookupOptions.id),
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
    groupIdx: index("members_group_idx").on(t.groupId),
    homeCellIdx: index("members_home_cell_idx").on(t.homeCellId),
  }),
);
