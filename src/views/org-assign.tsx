import { getDict, type Lang } from "../i18n";
import { positionDefLabel, type PositionDefRow } from "../position-catalog";

export type AssignCandidate = { id: number; name: string; home_cell: string | null };

/** Bare form fetched into the shared dialog by app.js. The filter input has no
 *  name, so typing never posts; the radio list is what the handler reads. */
export function AssignLeaderModal(props: {
  lang: Lang;
  churchId: number;
  churchName: string;
  def: PositionDefRow;
  candidates: AssignCandidate[];
  currentId: number | null;
  error?: string | null;
}) {
  const { lang, churchId, churchName, def, candidates, currentId, error } = props;
  const t = getDict(lang);
  const label = positionDefLabel(def, lang);
  return (
    <form method="post" action="/organization/assign" data-modal-ajax>
      <input type="hidden" name="church" value={String(churchId)} />
      <input type="hidden" name="position" value={def.code} />
      {error && <p class="flash err modal-error">{error}</p>}
      <div class="position-hero">
        <span class="position-avatar" aria-hidden="true">{churchName.trim().charAt(0) || "?"}</span>
        <div class="position-hero-main">
          <div class="position-hero-title"><h4>{label}</h4></div>
          <div class="position-hero-home">{t("org.assignFor")} <strong>{churchName}</strong></div>
        </div>
      </div>

      <label class="field assign-search">
        <span class="lbl">{t("org.assignSearch")}</span>
        <input type="search" data-filter-list=".assign-list" placeholder={t("org.assignSearch")} autocomplete="off" />
      </label>

      {candidates.length === 0 ? (
        <p class="assign-empty">{t("org.assignEmpty")}</p>
      ) : (
        <div class="assign-list">
          {candidates.map((m) => (
            <label class={`assign-row${m.id === currentId ? " is-current" : ""}`} data-name={`${m.name} ${m.home_cell ?? ""}`}>
              <input type="radio" name="member_id" value={String(m.id)} checked={m.id === currentId} />
              <span class="assign-name">{m.name}</span>
              {m.home_cell && <span class="assign-meta">{m.home_cell}</span>}
            </label>
          ))}
          {currentId != null && (
            <label class="assign-row">
              <input type="radio" name="member_id" value="" />
              <span class="assign-name muted">{t("org.assignClear")}</span>
            </label>
          )}
        </div>
      )}

      <div class="actions">
        <button class="btn" type="submit">{t("form.save")}</button>
        <button class="btn secondary" type="button" data-close="1">{t("form.cancel")}</button>
      </div>
    </form>
  );
}
