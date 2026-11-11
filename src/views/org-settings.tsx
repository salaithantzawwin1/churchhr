import { Layout, type Flash } from "./layout";
import type { SessionUser } from "../session";
import { getDict, type Lang } from "../i18n";
import {
  CONFIGURABLE_POSITION_SCOPES,
  positionDefLabel,
  type ConfigurablePositionScope,
  type PositionDefRow,
} from "../position-catalog";
import type { RegionalChurchRow } from "../org-units";

type Common = { user: SessionUser; perms: Set<string>; flash?: Flash; lang?: Lang };

const SCOPE_KEYS: Record<ConfigurablePositionScope, string> = {
  church: "org.scopeChurch",
  regional_church: "org.scopeRegional",
  home_cell: "org.scopeHomeCell",
  township: "org.scopeSupervision",
  department: "org.scopeDepartment",
};

type PositionValues = {
  nameMyanmar: string;
  nameEnglish: string;
  nameKorean: string;
  sortOrder: number;
  active: boolean;
};

function positionValues(def?: PositionDefRow): PositionValues {
  return {
    nameMyanmar: def?.nameMyanmar ?? "",
    nameEnglish: def?.nameEnglish ?? "",
    nameKorean: def?.nameKorean ?? "",
    sortOrder: def?.sortOrder ?? 0,
    active: def ? def.active === 1 : true,
  };
}

function PositionFields(props: { values: PositionValues; lang: Lang; editing: boolean }) {
  const { values, lang, editing } = props;
  const t = getDict(lang);
  return (
    <div class="form-grid">
      <label class="field">
        <span class="lbl">{t("org.positionNameMm")}</span>
        <input type="text" name="name_myanmar" value={values.nameMyanmar} maxlength={100} required />
      </label>
      <label class="field">
        <span class="lbl">{t("org.positionNameEn")}</span>
        <input type="text" name="name_english" value={values.nameEnglish} maxlength={100} required={!editing} />
      </label>
      <label class="field">
        <span class="lbl">{t("org.positionNameKr")}</span>
        <input type="text" name="name_korean" value={values.nameKorean} maxlength={100} />
      </label>
      <label class="field">
        <span class="lbl">{t("org.positionSort")}</span>
        <input name="sort_order" type="number" min="0" max="9999" value={String(values.sortOrder)} />
      </label>
      {editing && (
        <label class="dept-active">
          <input type="checkbox" name="active" value="1" checked={values.active} />
          <span>{t("dept.active")}</span>
        </label>
      )}
    </div>
  );
}

/** Bare position form served for the add/edit modal; it submits natively so
 *  server flashes and validation errors land on the list after the reload. */
export function PositionModal(props: {
  scope: ConfigurablePositionScope;
  def?: PositionDefRow;
  values?: PositionValues;
  error?: string | null;
  lang?: Lang;
}) {
  const { scope, def, error } = props;
  const L = props.lang ?? "en";
  const t = getDict(L);
  const inUse = (def?.usageCount ?? 0) > 0;
  return (
    <>
      {error && <div class="modal-error" role="alert">{error}</div>}
      <form method="post" action={def ? `/organization/positions/${def.id}` : "/organization/positions"} data-modal-ajax>
        {!def && <input type="hidden" name="scope" value={scope} />}
        <PositionFields values={props.values ?? positionValues(def)} lang={L} editing={Boolean(def)} />
        <div class={`actions${def && !inUse ? " modal-actions-split" : ""}`}>
          {def && !inUse && (
            <button class="btn sm outline-danger" type="submit" form={`delete-position-${def.id}`}>
              {t("members.delete")}
            </button>
          )}
          <button class="btn" type="submit">{def ? t("dept.save") : t("form.add")}</button>
        </div>
      </form>
      {def && !inUse && (
        <form
          id={`delete-position-${def.id}`}
          method="post"
          action={`/organization/positions/${def.id}/delete`}
          class="modal-danger"
          data-confirm={t("org.deletePositionConfirm")}
          data-confirm-title={t("members.delete")}
          data-confirm-yes={t("members.delete")}
          hidden
        />
      )}
      {def && inUse && <p class="muted small modal-note">{t("org.deleteRoleHint")}</p>}
    </>
  );
}

export type ListStatus = "all" | "active" | "inactive";

/** Case-insensitive substring match over the labels a row can be found by. */
function matchesQuery(q: string, fields: (string | null | undefined)[]): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => (f ?? "").toLowerCase().includes(needle));
}

function statusMatches(status: ListStatus, active: boolean): boolean {
  return status === "all" || (status === "active" ? active : !active);
}

export function PositionsPage(props: Common & {
  scope: ConfigurablePositionScope;
  defs: PositionDefRow[];
  q?: string;
  status?: ListStatus;
}) {
  const { user, perms, flash, lang, scope, defs } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const q = props.q ?? "";
  const status = props.status ?? "all";
  const current = defs
    .filter((d) => d.scopeType === scope)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const visible = current.filter((d) =>
    statusMatches(status, d.active === 1) &&
    matchesQuery(q, [d.nameMyanmar, d.nameEnglish, d.nameKorean, d.code]));
  const filtered = q.trim().length > 0 || status !== "all";
  const counts = Object.fromEntries(
    CONFIGURABLE_POSITION_SCOPES.map((s) => [s, defs.filter((d) => d.scopeType === s).length]),
  ) as Record<ConfigurablePositionScope, number>;

  return (
    <Layout title={t("org.positionsTitle")} lang={lang} user={user} perms={perms} active="/organization" flash={flash ?? null}>
      <div class="page-head">
        <div>
          <h1>{t("org.positionsTitle")}<span class="count-pill">{visible.length}</span></h1>
          <p class="page-sub">{t("org.positionsIntro")}</p>
        </div>
        <div class="page-head-actions">
          <a
            class="btn js-add-modal"
            href={`/organization/positions/new?scope=${scope}`}
            data-modal-title={`${t("org.addPosition")} · ${t(SCOPE_KEYS[scope])}`}
            data-modal-size="md"
          >+ {t("org.addPosition")}</a>
          <a class="btn secondary" href="/organization/positions/history">{t("history.link")}</a>
          <a class="btn secondary" href="/organization">{t("dept.back")}</a>
        </div>
      </div>

      <div class="page-toolbar">
        <div class="tabs" role="tablist" aria-label={t("org.positionsTitle")}>
          {CONFIGURABLE_POSITION_SCOPES.map((s) => (
            <a class={`btn sm ${scope === s ? "" : "secondary"}`} href={`/organization/positions?scope=${s}`}
              aria-current={scope === s ? "page" : undefined}>
              {t(SCOPE_KEYS[s])}
              <span class="tab-count">{counts[s]}</span>
            </a>
          ))}
        </div>
      </div>

      <form class="filters settings-filters" method="get" action="/organization/positions" data-auto-submit="1">
        <input type="hidden" name="scope" value={scope} />
        <input type="search" name="q" value={q} placeholder={t("org.searchPositions")}
          aria-label={t("members.search")} enterkeyhint="search" />
        <select name="status" aria-label={t("members.status")}>
          <option value="" selected={status === "all"}>{t("members.allStatuses")}</option>
          <option value="active" selected={status === "active"}>{t("dept.active")}</option>
          <option value="inactive" selected={status === "inactive"}>{t("dept.inactive")}</option>
        </select>
        <div class="actions">
          <button class="btn sm" type="submit">{t("members.search")}</button>
        </div>
      </form>

      {visible.length === 0 ? (
        <div class="card org-empty org-empty-small">
          <p class="muted">{filtered ? t("org.filterEmpty") : t("org.noPositions")}</p>
          {filtered && (
            <p class="small"><a href={`/organization/positions?scope=${scope}`}>{t("members.clearFilters")}</a></p>
          )}
        </div>
      ) : (
        <div class="role-list">
          {visible.map((def) => (
            <article class={`card role-card${def.active ? "" : " is-inactive"}`}>
              <header class="role-card-head">
                <div class="role-card-text">
                  <h3>{positionDefLabel(def, L)}</h3>
                  <p class="role-card-meta">
                    <code>{def.code}</code>
                    <span aria-hidden="true">·</span>
                    <span>{def.usageCount ?? 0} {t("org.positionUsage")}</span>
                  </p>
                </div>
                <div class="role-card-actions">
                  <span class={`badge ${def.active ? "active" : "inactive"}`}>
                    {def.active ? t("dept.active") : t("dept.inactive")}
                  </span>
                  <a
                    class="btn sm secondary js-edit-modal"
                    href={`/organization/positions/${def.id}/edit`}
                    data-modal-title={t("org.editRole")}
                    data-modal-size="md"
                  >{t("members.edit")}</a>
                </div>
              </header>
            </article>
          ))}
        </div>
      )}
    </Layout>
  );
}

export type RegionalValues = {
  name: string;
  nameEn: string;
  regionId: number | "";
  sortOrder: number;
  active: boolean;
};

function regionalValues(church?: RegionalChurchRow): RegionalValues {
  return {
    name: church?.name ?? "",
    nameEn: church?.nameEn ?? "",
    regionId: church?.regionId ?? "",
    sortOrder: church?.sortOrder ?? 0,
    active: church ? church.active === 1 : true,
  };
}

function RegionalFields(props: { values: RegionalValues; regions: { id: number; name: string }[]; lang: Lang; editing: boolean }) {
  const { values, regions, lang, editing } = props;
  const t = getDict(lang);
  return (
    <div class="form-grid">
      <label class="field">
        <span class="lbl">{t("org.regionalName")}</span>
        <input type="text" name="name" value={values.name} maxlength={80} required />
      </label>
      <label class="field">
        <span class="lbl">{t("org.regionalNameEn")}</span>
        <input type="text" name="name_en" value={values.nameEn} maxlength={120} />
      </label>
      <label class="field">
        <span class="lbl">{t("org.regionalState")}</span>
        <select name="region_id" required>
          <option value="">{t("form.choose")}</option>
          {regions.map((r) => (
            <option value={String(r.id)} selected={values.regionId === r.id}>{r.name}</option>
          ))}
        </select>
      </label>
      <label class="field">
        <span class="lbl">{t("org.positionSort")}</span>
        <input name="sort_order" type="number" min="0" max="9999" value={String(values.sortOrder)} />
      </label>
      {editing && (
        <label class="dept-active">
          <input type="checkbox" name="active" value="1" checked={values.active} />
          <span>{t("dept.active")}</span>
        </label>
      )}
    </div>
  );
}

type HomeCellOption = { id: number; label: string; regionId: number; regionalChurchId: number | null; township: string | null };

function groupCellsByTownship(cells: HomeCellOption[], noTownship: string): { name: string; cells: HomeCellOption[] }[] {
  const groups = new Map<string, { name: string; cells: HomeCellOption[] }>();
  for (const cell of cells) {
    const name = cell.township || noTownship;
    let group = groups.get(name);
    if (!group) {
      group = { name, cells: [] };
      groups.set(name, group);
    }
    group.cells.push(cell);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Bare regional-church editor for the modal: details, Home Cell attachment
 *  and deletion share one sheet so nothing is expanded inline on the list. */
export function RegionalChurchModal(props: {
  church?: RegionalChurchRow;
  regions: { id: number; name: string }[];
  homeCells: HomeCellOption[];
  values?: RegionalValues;
  error?: string | null;
  cellError?: string | null;
  /** Rejected Home Cell picks, so a failed attach keeps what was chosen. */
  selectedCellIds?: number[];
  lang?: Lang;
}) {
  const { church, regions, homeCells, error, cellError } = props;
  const L = props.lang ?? "en";
  const t = getDict(L);
  const values = props.values ?? regionalValues(church);
  const cells = church ? homeCells.filter((c) => c.regionalChurchId === church.id) : [];
  const candidates = church
    ? homeCells.filter((c) => c.regionId === church.regionId && (c.regionalChurchId == null || c.regionalChurchId === church.id))
    : [];
  const isPicked = (cell: HomeCellOption) =>
    props.selectedCellIds ? props.selectedCellIds.includes(cell.id) : cell.regionalChurchId === church?.id;

  return (
    <>
      {error && <div class="modal-error" role="alert">{error}</div>}
      <form method="post" action={church ? `/organization/regional-churches/${church.id}` : "/organization/regional-churches"} data-modal-ajax>
        <RegionalFields values={values} regions={regions} lang={L} editing={Boolean(church)} />
        <div class="actions">
          <button class="btn" type="submit">{church ? t("dept.save") : t("form.add")}</button>
        </div>
      </form>

      {church && (
        <>
          <form method="post" action={`/organization/regional-churches/${church.id}/cells`} class="regional-cells-form" data-modal-ajax>
            <div class="regional-cells-head">
              <strong>{t("org.regionalCellAssignment")}</strong>
              <span class="muted small">{t("org.regionalCellHint")}</span>
            </div>
            {cellError && <div class="modal-error" role="alert">{cellError}</div>}
            {candidates.length === 0 ? (
              <p class="muted small">{t("org.regionalNoCells")}</p>
            ) : (
              <div class="regional-cell-groups">
                {groupCellsByTownship(candidates, t("org.townshipUnassigned")).map((group) => (
                  <div class="regional-candidate-group">
                    <h4>{group.name}</h4>
                    <div class="check-grid">
                      {group.cells.map((cell) => (
                        <label class="check-chip">
                          <input type="checkbox" name="home_cell_ids" value={String(cell.id)}
                            checked={isPicked(cell)} />
                          <span>{cell.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div class="actions">
              <button class="btn sm secondary" type="submit">{t("org.saveCells")}</button>
            </div>
          </form>

          {cells.length === 0 ? (
            <form
              method="post"
              action={`/organization/regional-churches/${church.id}/delete`}
              class="modal-danger"
              data-confirm={t("org.deleteRegionalConfirm")}
              data-confirm-title={t("members.delete")}
              data-confirm-yes={t("members.delete")}
            >
              <div class="actions">
                <button class="btn sm outline-danger" type="submit">{t("members.delete")}</button>
              </div>
            </form>
          ) : (
            <p class="muted small modal-note">{t("org.deleteRegionalHint")}</p>
          )}
        </>
      )}
    </>
  );
}

export function RegionalChurchesPage(props: Common & {
  churches: RegionalChurchRow[];
  regions: { id: number; name: string }[];
  homeCells: HomeCellOption[];
  q?: string;
  status?: ListStatus;
}) {
  const { user, perms, flash, lang, churches, regions, homeCells } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const q = props.q ?? "";
  const status = props.status ?? "all";
  const visible = churches.filter((c) =>
    statusMatches(status, c.active === 1) &&
    matchesQuery(q, [c.name, c.nameEn, c.stateName, c.stateNameEn]));
  const filtered = q.trim().length > 0 || status !== "all";
  const attachedCount = homeCells.filter((c) => c.regionalChurchId != null).length;
  const unattachedCount = homeCells.length - attachedCount;

  return (
    <Layout title={t("org.regionalTitle")} lang={lang} user={user} perms={perms} active="/organization" flash={flash ?? null}>
      <div class="page-head">
        <div>
          <h1>{t("org.regionalTitle")}<span class="count-pill">{visible.length}</span></h1>
          <p class="page-sub">{t("org.regionalIntro")}</p>
        </div>
        <div class="page-head-actions">
          <a
            class="btn js-add-modal"
            href="/organization/regional-churches/new"
            data-modal-title={t("org.addRegional")}
            data-modal-size="md"
          >+ {t("org.addRegional")}</a>
          <a class="btn secondary" href="/organization?tab=regional">{t("dept.back")}</a>
        </div>
      </div>

      <div class="stat-grid org-stats">
        <div class="stat"><div class="n">{churches.length}</div><div class="t">{t("org.regionalChurchesStat")}</div></div>
        <div class="stat"><div class="n">{attachedCount}</div><div class="t">{t("org.attachedCells")}</div></div>
        <div class="stat"><div class="n">{unattachedCount}</div><div class="t">{t("org.unattachedCells")}</div></div>
      </div>

      <form class="filters settings-filters" method="get" action="/organization/regional-churches" data-auto-submit="1">
        <input type="search" name="q" value={q} placeholder={t("org.searchRegional")}
          aria-label={t("members.search")} enterkeyhint="search" />
        <select name="status" aria-label={t("members.status")}>
          <option value="" selected={status === "all"}>{t("members.allStatuses")}</option>
          <option value="active" selected={status === "active"}>{t("dept.active")}</option>
          <option value="inactive" selected={status === "inactive"}>{t("dept.inactive")}</option>
        </select>
        <div class="actions">
          <button class="btn sm" type="submit">{t("members.search")}</button>
        </div>
      </form>

      {visible.length === 0 ? (
        <div class="card org-empty org-empty-small">
          <p class="muted">{filtered ? t("org.filterEmpty") : t("org.noRegionalChurch")}</p>
          {filtered && (
            <p class="small"><a href="/organization/regional-churches">{t("members.clearFilters")}</a></p>
          )}
        </div>
      ) : (
        <div class="regional-list">
          {visible.map((church) => {
            const cells = homeCells.filter((c) => c.regionalChurchId === church.id);
            const attachedGroups = groupCellsByTownship(cells, t("org.townshipUnassigned"));

            return (
              <article class={`card regional-card${church.active ? "" : " is-inactive"}`}>
                <header class="regional-card-head">
                  <div>
                    <h3>{L !== "mm" && church.nameEn ? church.nameEn : church.name}</h3>
                    <p class="muted small">
                      {(L !== "mm" && church.stateNameEn ? church.stateNameEn : church.stateName)}
                      {" · "}{cells.length} {t("org.cells")}
                    </p>
                  </div>
                  <div class="role-card-actions">
                    <span class={`badge ${church.active ? "active" : "inactive"}`}>
                      {church.active ? t("dept.active") : t("dept.inactive")}
                    </span>
                    <a
                      class="btn sm secondary js-edit-modal"
                      href={`/organization/regional-churches/${church.id}/edit`}
                      data-modal-title={t("org.editRegional")}
                      data-modal-size="md"
                    >{t("members.edit")}</a>
                  </div>
                </header>

                {cells.length === 0 ? (
                  <p class="muted small regional-attached-empty">{t("org.regionalNoCells")}</p>
                ) : (
                  <div class="regional-attached">
                    {attachedGroups.map((group) => (
                      <div class="regional-township-line">
                        <span class="town">{group.name}</span>
                        {group.cells.map((cell) => (
                          <a class="regional-cell-chip" href={`/members?home_cell=${cell.id}`}>{cell.label}</a>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
