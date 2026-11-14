import { getDict, type Lang } from "../i18n";
import { positionDefLabel, type PositionDefRow } from "../position-catalog";

export type ChurchHolder = {
  assignmentId: number;
  personId: number;
  name: string;
  priority: number;
};

export type AssignCandidate = {
  id: number;
  name: string;
  home_cell: string | null;
  /** Church position this member already holds, if any. */
  church_position: string | null;
  church_id: number | null;
  church_name: string | null;
};

/** Bare form fetched into the shared dialog by app.js. The filter input has no
 *  name, so typing never posts; the radio list is what the handler reads. */
export function AssignLeaderModal(props: {
  lang: Lang;
  /** Tab the dialog was opened from; the save returns to it. */
  tab: "church" | "main" | "home-cells";
  /** Id of the scope the role belongs to (a church, or a Home Cell). */
  churchId: number;
  /** Name of that scope, shown in the dialog and posted back with the save. */
  churchName: string;
  /** Hidden field carrying the scope id; Home Cell roles post `cell`. */
  scopeField?: "church" | "cell";
  /** Where the form saves; Home Cell roles have their own endpoint. */
  action?: string;
  removeAction?: string;
  def: PositionDefRow;
  candidates: AssignCandidate[];
  /** Form field the radio list posts: members, unless this is a pastoral post. */
  personField?: "member_id" | "pastor_id";
  /** Pastoral posts list the pastor directory instead of this church's members. */
  pastorDirectory?: boolean;
  /** Current holder when they appear in this list, so their row starts checked. */
  currentId: number | null;
  /** All active holders of a multi-holder role. */
  holders?: ChurchHolder[];
  /** Several people may hold this role. */
  allowMultiple?: boolean;
  /** The slot is filled, even when the holder is not in this list. */
  hasHolder?: boolean;
  /** Name of the current holder (shown even when they are not a candidate here). */
  currentName?: string | null;
  /** Profile page of the current holder, when one exists and the user may open it. */
  currentHref?: string | null;
  /** code → localized label for church positions a candidate may already hold. */
  labels: Record<string, string>;
  error?: string | null;
}) {
  const {
    lang, tab, churchId, churchName, def, candidates,
    personField = "member_id", pastorDirectory, currentId, hasHolder, currentName, currentHref, labels, error,
    holders = [], allowMultiple,
    scopeField = "church",
    action = "/organization/assign",
    removeAction = "/organization/assign/remove",
  } = props;
  const t = getDict(lang);
  const label = positionDefLabel(def, lang);

  // Only warn when the save really moves the role: a member already sitting in
  // this exact slot keeps it.
  const replaceWarning = (m: AssignCandidate): string => {
    if (!m.church_position) return "";
    if (m.church_position === def.code && m.church_id === churchId) return "";
    const role = labels[m.church_position] ?? m.church_position;
    const where = m.church_name ? ` · ${m.church_name}` : "";
    return `${t("org.assignCurrentAt")} ${role}${where} — ${t("org.assignWillReplace")}`;
  };

  return (
    <>
      {error && <p class="flash err modal-error">{error}</p>}
      <div class="position-hero">
        <span class="position-avatar" aria-hidden="true">{churchName.trim().charAt(0) || "?"}</span>
        <div class="position-hero-main">
          <div class="position-hero-title"><h4>{label}</h4></div>
          <div class="position-hero-home">{t("org.assignFor")} <strong>{churchName}</strong></div>
          {currentName && (
            <div class="position-hero-home">
              {t("org.assignCurrently")}{" "}
              {currentHref ? (
                <a href={currentHref} class="position-hero-profile" title={t("org.viewProfile")}>
                  {currentName}
                </a>
              ) : (
                <strong>{currentName}</strong>
              )}
            </div>
          )}
          {/* The card itself opens this dialog, so the profile gets its own
              explicit way out. */}
          {currentHref && (
            <a href={currentHref} class="position-hero-link">
              {t("org.viewProfile")} <span aria-hidden="true">→</span>
            </a>
          )}
        </div>
      </div>

      {/* Every holder keeps its own delete form, so this list sits outside the
          assignment form below: nested forms would close it early and orphan
          the Save button and the candidate radios. */}
      {allowMultiple && holders.length > 0 && (
        <div class="region-holder-list">
          <h4>{t("org.regionCurrentTeam")}</h4>
          {holders.map((holder) => (
            <div class="region-holder-row">
              <span class="badge position">{t("org.priority")} {holder.priority}</span>
              <strong>{holder.name}</strong>
              <form method="post" action={removeAction}
                data-confirm={t("org.removeHolderConfirm")}>
                <input type="hidden" name="assignment_id" value={String(holder.assignmentId)} />
                <input type="hidden" name="tab" value={tab} />
                <input type="hidden" name={scopeField} value={String(churchId)} />
                <button class="btn sm outline-danger" type="submit">{t("members.delete")}</button>
              </form>
            </div>
          ))}
        </div>
      )}

      <form method="post" action={action} data-modal-ajax>
        <input type="hidden" name="tab" value={tab} />
        <input type="hidden" name={scopeField} value={String(churchId)} />
        <input type="hidden" name="position" value={def.code} />

        <label class="field assign-search">
          <span class="lbl">{pastorDirectory ? t("org.assignSearchPastors") : t("org.assignSearch")}</span>
          <input type="search" data-filter-list=".assign-list"
            placeholder={pastorDirectory ? t("org.assignSearchPastors") : t("org.assignSearch")} autocomplete="off" />
        </label>

        {pastorDirectory && <p class="assign-hint">{t("org.assignPastorHint")}</p>}
        {scopeField === "cell" && <p class="assign-hint">{t("org.assignCellHint")}</p>}

        {candidates.length === 0 ? (
          <p class="assign-empty">{t("org.assignEmpty")}</p>
        ) : (
          <div class="assign-list">
            {candidates.map((m) => {
              const warning = replaceWarning(m);
              return (
                <label class={`assign-row${m.id === currentId ? " is-current" : ""}`} data-name={`${m.name} ${m.home_cell ?? ""}`}>
                  <input type="radio" name={personField} value={String(m.id)} checked={m.id === currentId}
                    data-warn={warning || undefined} />
                  <span class="assign-text">
                    <span class="assign-name">{m.name}</span>
                    {warning && <span class="assign-row-note">{warning}</span>}
                  </span>
                  {m.home_cell && <span class="assign-meta">{m.home_cell}</span>}
                </label>
              );
            })}
          </div>
        )}

        {/* Shown even when the holder is not in this list, so any filled slot can
            be cleared from the same dialog. */}
        {!allowMultiple && (hasHolder ?? currentId != null) && (
          <div class="assign-list assign-list-clear">
            <label class="assign-row">
              <input type="radio" name={personField} value="" />
              <span class="assign-name muted">{t("org.assignClear")}</span>
            </label>
          </div>
        )}

        {allowMultiple && (
          <label class="field">
            <span class="lbl">{t("org.priority")}</span>
            <input type="number" name="priority" min="1" max="99" value="1" />
            <span class="hint">{t("org.priorityHint")}</span>
          </label>
        )}

        <p class="assign-warn" data-assign-warn hidden></p>

        <div class="actions">
          <button class="btn secondary" type="button" data-close="1">{t("form.cancel")}</button>
          <button class="btn" type="submit">{t("form.save")}</button>
        </div>
      </form>
    </>
  );
}
