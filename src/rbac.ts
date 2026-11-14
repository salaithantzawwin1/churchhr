/** Code-defined permission catalogue (seeded into role_permissions by migration). */
export const PERMISSIONS = [
  "dashboard.view",
  "members.view",
  "members.create",
  "members.update",
  "members.delete",
  "members.export",
  "members.import",
  "reports.view",
  "reports.create",
  "reports.review",
  "users.manage",
  "roles.manage",
  "options.manage",
  "pastors.view",
  "pastors.manage",
  "audit.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Editor grouping for the role form. Every permission belongs to exactly one
 * group; the form appends anything unlisted to the last group, so a permission
 * added to the catalogue above can never silently drop out of the UI. */
export const PERMISSION_GROUPS: { labelKey: string; permissions: Permission[] }[] = [
  {
    labelKey: "adm.permGroupRecords",
    permissions: [
      "dashboard.view",
      "members.view",
      "members.create",
      "members.update",
      "members.delete",
      "members.export",
      "members.import",
      "pastors.view",
      "pastors.manage",
    ],
  },
  {
    labelKey: "adm.permGroupReports",
    permissions: ["reports.view", "reports.create", "reports.review"],
  },
  {
    labelKey: "adm.permGroupAdmin",
    permissions: ["users.manage", "roles.manage", "options.manage", "audit.view"],
  },
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  "dashboard.view": "Dashboard ကြည့်ခွင့်",
  "members.view": "Member စာရင်း ကြည့်ခွင့်",
  "members.create": "Member အသစ် ထည့်ခွင့်",
  "members.update": "Member ပြင်ခွင့်",
  "members.delete": "Member ဖျက်ခွင့်",
  "members.export": "CSV Export ခွင့်",
  "members.import": "CSV Import ခွင့်",
  "reports.view": "နေ့စဉ် အစီရင်ခံစာ ကြည့်ခွင့်",
  "reports.create": "နေ့စဉ် အစီရင်ခံစာ ရေးခွင့်",
  "reports.review": "အစီရင်ခံစာ စစ်ဆေးခွင့်",
  "users.manage": "User Account စီမံခွင့်",
  "roles.manage": "Role / Permission စီမံခွင့်",
  "options.manage": "Dropdown စာရင်း စီမံခွင့်",
  "pastors.view": "သင်းအုပ်ဆရာ စာရင်း ကြည့်ခွင့်",
  "pastors.manage": "သင်းအုပ်ဆရာ စာရင်း စီမံခွင့်",
  "audit.view": "မှတ်တမ်း (Audit Log) ကြည့်ခွင့်",
};

export const PERMISSION_LABELS_KR: Record<Permission, string> = {
  "dashboard.view": "대시보드 보기",
  "members.view": "성도 목록 보기",
  "members.create": "성도 추가",
  "members.update": "성도 수정",
  "members.delete": "성도 삭제",
  "members.export": "CSV 내보내기",
  "members.import": "CSV 가져오기",
  "reports.view": "일일 보고서 보기",
  "reports.create": "일일 보고서 작성",
  "reports.review": "일일 보고서 검토",
  "users.manage": "사용자 계정 관리",
  "roles.manage": "역할 / 권한 관리",
  "options.manage": "드롭다운 옵션 관리",
  "pastors.view": "목회자 목록 보기",
  "pastors.manage": "목회자 목록 관리",
  "audit.view": "감사 로그 보기",
};

export const PERMISSION_LABELS_EN: Record<Permission, string> = {
  "dashboard.view": "View dashboard",
  "members.view": "View member list",
  "members.create": "Create members",
  "members.update": "Edit members",
  "members.delete": "Delete members",
  "members.export": "Export CSV",
  "members.import": "Import CSV",
  "reports.view": "View daily reports",
  "reports.create": "Write daily reports",
  "reports.review": "Review daily reports",
  "users.manage": "Manage user accounts",
  "roles.manage": "Manage roles / permissions",
  "options.manage": "Manage dropdown options",
  "pastors.view": "View pastor list",
  "pastors.manage": "Manage pastor list",
  "audit.view": "View audit log",
};

/** Special region_id row meaning "every state". Kept out of FK constraints on purpose. */
export const ALL_STATES_WILDCARD = 0;
