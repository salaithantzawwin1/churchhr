export const GENDERS: Record<string, string> = {
  male: "ကျား (Male)",
  female: "မ (Female)",
};

export const GENDERS_EN: Record<string, string> = {
  male: "Male",
  female: "Female",
};

export const MARITAL_STATUSES: Record<string, string> = {
  single: "အလွတ် (Single)",
  married: "အိမ်ထောင်သည် (Married)",
  widowed: "မုဆုံးရှင် (Widowed)",
  divorced: "ကွာရှင်းသည် (Divorced)",
};

export const MARITAL_STATUSES_EN: Record<string, string> = {
  single: "Single",
  married: "Married",
  widowed: "Widowed",
  divorced: "Divorced",
};

export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export const STATUSES: Record<string, string> = {
  active: "အသက်ရှင် (Active)",
  moved: "ပြောင်းသွား (Moved)",
  inactive: "ရပ်ထား (Inactive)",
};

export const STATUSES_EN: Record<string, string> = {
  active: "Active",
  moved: "Moved",
  inactive: "Inactive",
};

/** Short single-language label for badges/lists: strips the "(English)" tail in MM. */
export function shortLabel(value: string, map: Record<string, string>): string {
  return map[value]?.split(" (")[0] ?? value;
}

/** CSV import / form value -> canonical value (returns null when unknown). */
export function normEnum(raw: string, map: Record<string, string>): string | null {
  const t = raw.trim().toLowerCase();
  if (t === "") return "";
  for (const [key, label] of Object.entries(map)) {
    if (t === key) return key;
    if (t === label.split(" (")[0].trim().toLowerCase()) return key;
    if (t === label.split("(")[1]?.replace(")", "").trim().toLowerCase()) return key;
  }
  // extra import aliases
  if (map === GENDERS) {
    if (["m", "ကျား"].includes(t)) return "male";
    if (["f", "မ"].includes(t)) return "female";
  }
  if (map === MARITAL_STATUSES) {
    if (["single", " unmarried", "unmarried"].includes(t)) return "single";
    if (["married"].includes(t)) return "married";
    if (["widowed", "widow"].includes(t)) return "widowed";
    if (["divorced", "divorce"].includes(t)) return "divorced";
  }
  return null;
}
