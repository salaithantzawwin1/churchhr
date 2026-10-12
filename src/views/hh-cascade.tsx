import type { OptionRow } from "../lookup";

/** Shared cascade selects for household forms, mirroring members.tsx:
 * State (data-region-select) narrows Township (data-region-filter) →
 * Home Cell (data-parent-filter=township) → Family Group. */

export function regionCascadeSelects(opts: {
  lang: "mm" | "en";
  regions: { id: number; name: string; code?: string | null }[];
  regionId: string;
  township: string;
  townshipOpts: OptionRow[];
  homeCellId: string;
  homeCellOpts: OptionRow[];
  groupId: string;
  groupOpts: OptionRow[];
  familyGroupId: string;
  familyGroupOpts: OptionRow[];
}) {
  const t = (en: string, mm: string) => (opts.lang === "en" ? en : mm);
  const blank = t("Select…", "ရွေးချယ်ပါ");
  const townshipLabelById = new Map(opts.townshipOpts.map((o) => [o.id, o.label] as const));

  const filteredOpts = (list: OptionRow[], selected: string, useParentOfTownship = false) => (
    <>
      <option value="">{blank}</option>
      {list
        .filter((o) => o.active === 1 || String(o.id) === selected)
        .map((o) => {
          let parent = o.parentId ?? "";
          if (useParentOfTownship && parent && o.parentId !== null) {
            parent = townshipLabelById.get(o.parentId) ?? "";
          }
          return (
            <option
              value={String(o.id)}
              selected={selected === String(o.id)}
              data-region={o.regionId === 0 ? "" : String(o.regionId)}
              data-parent={useParentOfTownship ? parent : undefined}
            >
              {withCode(o)}
            </option>
          );
        })}
    </>
  );

  const withCode = (o: OptionRow) => (o.code ? `${o.code} · ${o.label}` : o.label);

  return (
    <>
      <label class="field">
        <span class="lbl">{t("State / Region", "တိုင်း/ပြည်နယ်")}</span>
        <select name="region_id" required data-region-select="1">
          <option value="">{blank}</option>
          {opts.regions.map((r) => (
            <option value={String(r.id)} selected={opts.regionId === String(r.id)}>
              {r.code ? `${r.code} · ${r.name}` : r.name}
            </option>
          ))}
        </select>
      </label>
      <label class="field">
        <span class="lbl">{t("Township", "မြို့နယ်")}</span>
        <select name="township" data-region-filter="1">
          {/* township stores the label string; filters by data-region */}
          <option value="">{blank}</option>
          {opts.townshipOpts
            .filter((o) => o.active === 1 || o.label === opts.township)
            .map((o) => (
              <option
                value={o.label}
                selected={opts.township === o.label}
                data-region={o.regionId === 0 ? "" : String(o.regionId)}
                data-parent=""
              >
                {withCode(o)}
              </option>
            ))}
          {opts.township && !opts.townshipOpts.some((o) => o.label === opts.township) && (
            <option value={opts.township} selected>{opts.township}</option>
          )}
        </select>
      </label>
      <label class="field">
        <span class="lbl">{t("Home Cell", "Home Cell")}</span>
        <select name="home_cell_id" data-region-filter="1" data-parent-filter="township">
          {filteredOpts(opts.homeCellOpts, opts.homeCellId, true)}
        </select>
      </label>
      <label class="field">
        <span class="lbl">{t("Group", "Group")}</span>
        <select name="group_id" data-region-filter="1">
          {filteredOpts(opts.groupOpts, opts.groupId)}
        </select>
      </label>
      <label class="field">
        <span class="lbl">{t("Family Group", "မိသားစုအဖွဲ့")}</span>
        <select name="family_group_id" data-region-filter="1" data-parent-filter="home_cell">
          {filteredOpts(opts.familyGroupOpts, opts.familyGroupId, true)}
        </select>
      </label>
    </>
  );
}
