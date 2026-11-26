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

/** Chevrons for the custom stepper. The number input keeps its native step
 * semantics; the buttons only drive stepUp()/stepDown() from app.js, so keyboard
 * and screen-reader users still change the value the usual way. */
function StepIcon(props: { up?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={props.up ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"} />
    </svg>
  );
}

/** One priority control: label box, bare number, and the up/down buttons. */
function PriorityStepper(props: { lang: Lang; value: number; label?: string; describedBy?: string }) {
  const t = getDict(props.lang);
  return (
    <div class="priority-stepper">
      <span class="priority-stepper-label">{props.label ?? t("org.priority")}</span>
      <div class="priority-stepper-controls">
        <button type="button" class="stepper-btn" data-step="-1" aria-label={t("org.priorityLower")}>
          <StepIcon />
        </button>
        <input class="priority-value" type="number" name="priority" min="1" max="99"
          value={String(props.value)} aria-label={t("org.priority")}
          aria-describedby={props.describedBy} />
        <button type="button" class="stepper-btn" data-step="1" aria-label={t("org.priorityRaise")}>
          <StepIcon up />
        </button>
      </div>
    </div>
  );
}

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
      {/* Info band: what the post is and where it applies, then the one rule
          that matters when several people share the region. */}
      <div class="assign-info">
        <span class="assign-info-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        </span>
        <div class="assign-info-body">
          <div class="assign-info-line">
            <strong>{label}</strong>
            <span>{t("org.assignFor")} <strong>{regionName}</strong></span>
          </div>
          <p>{t("org.regionTeamHint")}</p>
        </div>
      </div>

      {error && <p class="flash err modal-error">{error}</p>}

      <div class="region-holder-list">
        <h4 class="assign-section-title">
          {t("org.regionCurrentTeam")}
          <span class="assign-count" aria-hidden="true">{holders.length}</span>
        </h4>
        {holders.length === 0 ? (
          <p class="muted small region-holder-empty">{t("org.vacant")}</p>
        ) : (
          holders.map((holder) => (
            <div class="region-holder-row">
              <span class="assign-dot is-holder" aria-hidden="true"></span>
              <strong class="region-holder-name">{holder.name}</strong>
              {/* Each holder keeps their own priority control, so changing one
                  person's rank never means clearing the whole team. */}
              <div class="region-holder-actions">
                <form method="post" action="/organization/region-assign" data-modal-ajax class="region-holder-priority">
                  <input type="hidden" name="region" value={String(regionId)} />
                  <input type="hidden" name="position" value={def.code} />
                  <input type="hidden" name="pastor_id" value={String(holder.pastorId)} />
                  <PriorityStepper lang={lang} value={holder.priority} />
                  <button class="btn sm" type="submit">{t("form.save")}</button>
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

        {/* The placeholder carries the label, so the filter does not cost a
            heading row in an already tall form. */}
        <label class="field assign-search">
          <span class="lbl sr-only">{t("org.assignSearchPastors")}</span>
          <input type="search" data-filter-list=".assign-list"
            placeholder={t("org.assignSearchPastors")} aria-label={t("org.assignSearchPastors")}
            autocomplete="off" />
        </label>
        <p class="assign-hint" id="assign-pastor-hint">{t("org.assignPastorHint")}</p>

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
                  <span class="assign-dot" aria-hidden="true"></span>
                  <span class="assign-text">
                    <span class="assign-name">{candidate.name}</span>
                    {warning && <span class="assign-row-note">{warning}</span>}
                  </span>
                  {candidate.churchName && (
                    <span class="assign-badge" title={candidate.churchName}>{candidate.churchName}</span>
                  )}
                </label>
              );
            })}
          </div>
        )}

        <div class="actions assign-actions">
          <span class="assign-footer-priority">
            <PriorityStepper lang={lang} value={1} describedBy="assign-priority-help" />
            <span class="field-tip" data-tip={t("org.priorityHint")} id="assign-priority-help">
              <button type="button" class="field-tip-btn" aria-label={t("org.priorityHint")}>i</button>
            </span>
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
