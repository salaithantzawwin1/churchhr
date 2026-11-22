import { getDict, type Lang } from "../i18n";
import { positionDefLabel, type PositionDefRow } from "../position-catalog";

export type RegionCandidate = {
  id: number;
  name: string;
  churchName: string | null;
  regionPosition: string | null;
  regionName: string | null;
};

export type RegionHolder = {
  assignmentId: number;
  pastorId: number;
  name: string;
  priority: number;
};

/** Region-level team editor. A region can have several Regional Pastors, and a
 * tie in priority is allowed, so this dialog adds people instead of replacing a
 * single slot. Each holder is removed from its own row. */
export function RegionPastorModal(props: {
  lang: Lang;
  regionId: number;
  regionName: string;
  def: PositionDefRow;
  candidates: RegionCandidate[];
  holders: RegionHolder[];
  error?: string | null;
}) {
  const { lang, regionId, regionName, def, candidates, holders, error } = props;
  const t = getDict(lang);
  const label = positionDefLabel(def, lang);

  return (
    <>
      {/* Same compact summary as the church dialog: the post and its region on
          one line, so the dialog title is not repeated as a stacked heading and
          a long Myanmar region name cannot collide with the line above it. */}
      <div class="position-hero assign-hero">
        <span class="position-avatar" aria-hidden="true">{regionName.trim().charAt(0) || "?"}</span>
        <div class="position-hero-main">
          <div class="assign-hero-line">
            <strong class="assign-hero-role">{label}</strong>
            <span class="position-hero-home">{t("org.assignFor")} <strong>{regionName}</strong></span>
          </div>
          <p class="hint">{t("org.regionTeamHint")}</p>
        </div>
      </div>

      {error && <p class="flash err modal-error">{error}</p>}

      <div class="region-holder-list">
        <h4>{t("org.regionCurrentTeam")}</h4>
        {holders.length === 0 ? (
          <p class="muted small region-holder-empty">{t("org.vacant")}</p>
        ) : (
          holders.map((holder) => (
            <div class="region-holder-row">
              <strong class="region-holder-name">{holder.name}</strong>
              {/* Priority and removal sit together on the right, so the row reads
                  "who · their rank · remove" instead of scattering four controls. */}
              <div class="region-holder-actions">
                {/* Saving a holder again updates their priority in place. */}
                <form method="post" action="/organization/region-assign" data-modal-ajax class="region-holder-priority">
                  <input type="hidden" name="region" value={String(regionId)} />
                  <input type="hidden" name="position" value={def.code} />
                  <input type="hidden" name="pastor_id" value={String(holder.pastorId)} />
                  <label class="region-holder-priority-field">
                    <span class="muted small">{t("org.priority")}</span>
                    <input type="number" name="priority" min="1" max="99" value={String(holder.priority)} />
                  </label>
                  <button class="btn sm secondary" type="submit">{t("form.save")}</button>
                </form>
                <form method="post" action="/organization/region-assign/remove" data-confirm={t("org.removeHolderConfirm")}>
                  <input type="hidden" name="assignment_id" value={String(holder.assignmentId)} />
                  <input type="hidden" name="region" value={String(regionId)} />
                  <button class="btn sm outline-danger" type="submit">{t("members.delete")}</button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>

      <form method="post" action="/organization/region-assign" data-modal-ajax>
        <input type="hidden" name="region" value={String(regionId)} />
        <input type="hidden" name="position" value={def.code} />

        {/* The placeholder carries the label, matching the church dialog, so the
            filter does not cost a heading row in an already tall form. */}
        <label class="field assign-search">
          <span class="lbl sr-only">{t("org.assignSearchPastors")}</span>
          <input type="search" data-filter-list=".assign-list"
            placeholder={t("org.assignSearchPastors")} aria-label={t("org.assignSearchPastors")}
            autocomplete="off" />
        </label>
        <p class="assign-hint">{t("org.assignPastorHint")}</p>

        {candidates.length === 0 ? (
          <p class="assign-empty">{t("org.assignEmpty")}</p>
        ) : (
          <div class="assign-list">
            {candidates.map((candidate) => {
              const warning = candidate.regionPosition && candidate.regionPosition !== def.code
                ? `${t("org.assignCurrentAt")} ${candidate.regionPosition}${candidate.regionName ? ` · ${candidate.regionName}` : ""}`
                : "";
              return (
                <label class="assign-row" data-name={`${candidate.name} ${candidate.churchName ?? ""}`}>
                  <input type="radio" name="pastor_id" value={String(candidate.id)} />
                  <span class="assign-text">
                    <span class="assign-name">{candidate.name}</span>
                    {warning && <span class="assign-row-note">{warning}</span>}
                  </span>
                  {candidate.churchName && <span class="assign-meta">{candidate.churchName}</span>}
                </label>
              );
            })}
          </div>
        )}

        <div class="actions assign-actions">
          <span class="assign-priority-inline">
            <span class="lbl-row">
              <span class="lbl">{t("org.priority")}</span>
              <span class="field-tip" data-tip={t("org.priorityHint")}>
                <button type="button" class="field-tip-btn" aria-label={t("org.priorityHint")}
                  title={t("org.priorityHint")}>i</button>
              </span>
            </span>
            <input type="number" name="priority" min="1" max="99" value="1"
              aria-label={t("org.priority")} />
          </span>
          <span class="assign-actions-buttons">
            <button class="btn secondary" type="button" data-close="1">{t("form.cancel")}</button>
            <button class="btn" type="submit">{t("form.save")}</button>
          </span>
        </div>
      </form>
    </>
  );
}
