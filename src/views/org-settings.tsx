import { Layout, type Flash } from "./layout";
import type { SessionUser } from "../session";
import { countLabel, getDict, type Lang } from "../i18n";
import {
  CONFIGURABLE_POSITION_SCOPES,
  positionDefLabel,
  type ConfigurablePositionScope,
  type PositionDefRow,
} from "../position-catalog";
import type { RegionalChurchRow } from "../org-units";
import { CardViewToggle } from "./view-toggle";

type Common = { user: SessionUser; perms: Set<string>; flash?: Flash; lang?: Lang };

function ChurchGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 21h18M5 21V10l7-4 7 4v11M9 21v-4h6v4M12 3v3M10.5 4.5h3" />
    </svg>
  );
}

const SCOPE_KEYS: Record<ConfigurablePositionScope, string> = {
  church: "org.scopeChurch",
  region: "org.scopeRegional",
  cluster: "org.scopeCluster",
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
  /** Code of the position this one reports to ("" = top level). */
  parentCode: string | null;
  /** Churches this position is limited to (empty = every church in its state). */
  regionalChurchIds: number[];
};

function positionValues(def?: PositionDefRow): PositionValues {
  return {
    nameMyanmar: def?.nameMyanmar ?? "",
    nameEnglish: def?.nameEnglish ?? "",
    nameKorean: def?.nameKorean ?? "",
    sortOrder: def?.sortOrder ?? 0,
    active: def ? def.active === 1 : true,
    parentCode: def?.parentCode ?? null,
    regionalChurchIds: def?.regionalChurchIds ?? [],
  };
}

function PositionFields(props: {
  values: PositionValues;
  lang: Lang;
  editing: boolean;
  /** Same-scope positions this one can report to. */
  parents: { code: string; label: string }[];
  /** Churches this position can be limited to. */
  churches?: { id: number; name: string }[];
}) {
  const { values, lang, editing, parents, churches = [] } = props;
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
      <label class="field">
        <span class="lbl">{t("org.positionParent")}</span>
        <select name="parent_code">
          <option value="" selected={!values.parentCode}>{t("org.positionParentNone")}</option>
          {parents.map((p) => (
            <option value={p.code} selected={values.parentCode === p.code}>{p.label}</option>
          ))}
        </select>
        <span class="field-hint">{t("org.positionParentHint")}</span>
      </label>
      <div class="field span-2 position-church-field">
        <span class="lbl">{t("org.positionChurch")}</span>
        {churches.length === 0 ? (
          <p class="muted small">{t("org.positionChurchAll")}</p>
        ) : (
          <div class="check-grid position-church-grid">
            {churches.map((church) => (
              <label class="check-chip">
                <input type="checkbox" name="church_ids" value={String(church.id)}
                  checked={values.regionalChurchIds.includes(church.id)} />
                <span>{church.name}</span>
              </label>
            ))}
          </div>
        )}
        <span class="field-hint">{t("org.positionChurchHint")}</span>
      </div>
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
  parents?: { code: string; label: string }[];
  churches?: { id: number; name: string }[];
  error?: string | null;
  lang?: Lang;
}) {
  const { scope, def, error, parents = [], churches = [] } = props;
  const L = props.lang ?? "en";
  const t = getDict(L);
  const inUse = (def?.usageCount ?? 0) > 0;
  return (
    <>
      {error && <div class="modal-error" role="alert">{error}</div>}
      <form method="post" action={def ? `/organization/positions/${def.id}` : "/organization/positions"} data-modal-ajax>
        {!def && <input type="hidden" name="scope" value={scope} />}
        <PositionFields values={props.values ?? positionValues(def)} lang={L} editing={Boolean(def)} parents={parents} churches={churches} />
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

export type PositionHolderRow = {
  assignmentId: number;
  id: number;
  kind: "member" | "pastor";
  nameMyanmar: string | null;
  nameEnglish: string | null;
  churchName: string | null;
  churchNameEn: string | null;
  contextName: string | null;
};

/** Read-only list behind a role card's View button. */
export function PositionHoldersModal(props: {
  label: string;
  holders: PositionHolderRow[];
  positionId?: number;
  canRemove?: boolean;
  lang?: Lang;
}) {
  const L = props.lang ?? "en";
  const t = getDict(L);
  const personName = (row: PositionHolderRow) =>
    L !== "mm" && row.nameEnglish ? row.nameEnglish : (row.nameMyanmar || row.nameEnglish || "—");
  const churchName = (row: PositionHolderRow) =>
    (L !== "mm" && row.churchNameEn ? row.churchNameEn : row.churchName) ?? "";
  const initials = (name: string) =>
    name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase();
  const rows = props.holders;
  const canRemove = Boolean(props.canRemove && props.positionId);
  return (
    <div class="position-holders-modal" data-modal-static>
      <div class="ph-head">
        <div class="ph-head-text">
          <h4 class="ph-title">{props.label}</h4>
          <p class="muted small">{t("org.positionHoldersHint")}</p>
        </div>
        <span class="ph-count">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p class="empty-state">{t("org.positionHoldersEmpty")}</p>
      ) : (
        <>
          {rows.length > 5 && (
            <input class="ph-search" type="search" data-filter-list=".ph-tbl tbody"
              placeholder={t("members.search")} aria-label={t("members.search")} enterkeyhint="search" />
          )}
          <div class="tbl-wrap ph-wrap">
            <table class="list-tbl ph-tbl">
              <thead>
                <tr>
                  <th>{t("members.thName")}</th>
                  <th class="ph-col">{t("org.church")}</th>
                  <th class="ph-col">{t("org.holderContext")}</th>
                  {canRemove && <th aria-label={t("org.holderRemove")} />}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const person = personName(row);
                  const church = churchName(row);
                  return (
                    <tr data-name={`${person} ${church} ${row.contextName ?? ""}`.toLowerCase()}>
                      <td>
                        <span class="ph-person">
                          <span class="ph-avatar" aria-hidden="true">{initials(person)}</span>
                          <span class="ph-person-text">
                            <a href={row.kind === "pastor" ? `/pastors/${row.id}` : `/members/${row.id}`}>{person}</a>
                            <span class="small muted">
                              {row.kind === "pastor" ? t("nav.pastors") : t("nav.members")}
                            </span>
                            {/* On a phone the two columns fold under the name. */}
                            <span class="small muted ph-meta">
                              {[church, row.contextName].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td class="ph-col">{church || <span class="muted">—</span>}</td>
                      <td class="ph-col">{row.contextName || <span class="muted">—</span>}</td>
                      {canRemove && (
                        <td class="row-actions-cell">
                          <form method="post" class="position-holder-remove"
                            action={`/organization/positions/${props.positionId}/holders/remove`}
                            data-confirm={t("org.holderRemoveConfirm")}
                            data-confirm-title={t("org.holderRemove")}
                            data-confirm-yes={t("org.holderRemove")}>
                            <input type="hidden" name="assignment_id" value={String(row.assignmentId)} />
                            <button class="btn sm outline-danger" type="submit">{t("org.holderRemove")}</button>
                          </form>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
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
  churches?: { id: number; name: string }[];
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
          <CardViewToggle lang={lang} viewKey="positions" />
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
        <div class="tabs tabs-wrap" role="tablist" aria-label={t("org.positionsTitle")}>
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
          <button class="btn sm secondary" type="submit">{t("members.search")}</button>
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
        <div class="role-list" data-view-grid>
          {visible.map((def) => (
            <article class={`card role-card${def.active ? "" : " is-inactive"}`}>
              <header class="role-card-head">
                <div class="role-card-text">
                  <div class="role-card-title">
                    <h3>{positionDefLabel(def, L)}</h3>
                    <span class={`badge ${def.active ? "active" : "inactive"}`}>
                      {def.active ? t("dept.active") : t("dept.inactive")}
                    </span>
                  </div>
                  <p class="role-card-meta">
                    <code>{def.code}</code>
                    <span class="role-chip">{def.usageCount ?? 0} {t("org.positionUsage")}</span>
                    {(def.regionalChurchIds ?? []).map((id) => {
                      const church = (props.churches ?? []).find((c) => c.id === id);
                      return church ? <span class="role-chip church">{church.name}</span> : null;
                    })}
                  </p>
                </div>
              </header>
              <div class="role-card-actions">
                <a
                  class="btn sm secondary js-edit-modal"
                  href={`/organization/positions/${def.id}/holders`}
                  data-modal-title={t("org.positionHolders")}
                  data-modal-size="md"
                >{t("org.viewPosition")}</a>
                <a
                  class="btn sm secondary js-edit-modal"
                  href={`/organization/positions/${def.id}/edit`}
                  data-modal-title={t("org.editRole")}
                  data-modal-size="md"
                >{t("members.edit")}</a>
              </div>
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
  /** Churches the Home Cells can be moved between, for the owner labels. */
  churches?: { id: number; name: string }[];
  values?: RegionalValues;
  error?: string | null;
  cellError?: string | null;
  /** Rejected Home Cell picks, so a failed attach keeps what was chosen. */
  selectedCellIds?: number[];
  lang?: Lang;
}) {
  const { church, regions, homeCells, error, cellError } = props;
  const churchNames = new Map((props.churches ?? []).map((c) => [c.id, c.name]));
  const L = props.lang ?? "en";
  const t = getDict(L);
  const values = props.values ?? regionalValues(church);
  const cells = church ? homeCells.filter((c) => c.regionalChurchId === church.id) : [];
  const selectedRegion = values.regionId === "" ? church?.regionId : values.regionId;
  // Every Home Cell of the state is offered, including ones filed under a
  // sibling church: ticking one moves it here when the sheet is saved, and the
  // chip names the church it is leaving so the move is visible before saving.
  const candidates = church && selectedRegion != null
    ? homeCells.filter((c) => c.regionId === selectedRegion)
    : [];
  const isPicked = (cell: HomeCellOption) =>
    props.selectedCellIds ? props.selectedCellIds.includes(cell.id) : cell.regionalChurchId === church?.id;

  return (
    <>
      {error && <div class="modal-error" role="alert">{error}</div>}
      {cellError && <div class="modal-error" role="alert">{cellError}</div>}
      {/* One form and one Save, matching the cluster editor: details and Home
          Cell attachment are written together instead of two separate saves. */}
      <form method="post" class="cluster-main-form"
        action={church ? `/organization/regional-churches/${church.id}` : "/organization/regional-churches"} data-modal-ajax>
        {church ? (
          <>
            <div class="position-tabs modal-form-tabs" data-tabs role="tablist"
              aria-label={t("org.editRegional")}>
              <button type="button" role="tab" class={`position-tab${cellError ? "" : " active"}`}
                data-tab-target="details" aria-selected={cellError ? "false" : "true"}>{t("org.detailsTab")}</button>
              <button type="button" role="tab" class={`position-tab${cellError ? " active" : ""}`}
                data-tab-target="cells" aria-selected={cellError ? "true" : "false"}>
                {t("org.regionalCellAssignment")}
                <span class="tab-count">{cells.length}</span>
              </button>
            </div>
            <div class="modal-form-panes" data-tabs-body>
              <section class="modal-form-pane" data-tab-pane="details" role="tabpanel">
                <RegionalFields values={values} regions={regions} lang={L} editing />
              </section>
              <section class="modal-form-pane" data-tab-pane="cells" role="tabpanel">
                <input type="hidden" name="cells_present" value="1" />
                <div class="cluster-section-head">
                  <p class="muted small">{t("org.regionalCellHint")}</p>
                </div>
                {candidates.length === 0 ? (
                  <p class="muted small">{t("org.regionalNoCells")}</p>
                ) : (
                  <div class="cluster-cell-groups">
                    {groupCellsByTownship(candidates, t("org.townshipUnassigned")).map((group) => (
                      <div class="cluster-cell-group">
                        <h4>{group.name}</h4>
                        <div class="check-grid">
                          {group.cells.map((cell) => (
                            <label class="check-chip">
                              <input type="checkbox" name="home_cell_ids" value={String(cell.id)}
                                checked={isPicked(cell)} />
                              <span>
                                {cell.label}
                                {cell.regionalChurchId != null && cell.regionalChurchId !== church?.id && (
                                  <span class="check-chip-owner">
                                    {churchNames.get(cell.regionalChurchId) ?? ""}
                                  </span>
                                )}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        ) : (
          <RegionalFields values={values} regions={regions} lang={L} editing={false} />
        )}

        <div class="actions">
          <button class="btn" type="submit">{church ? t("dept.save") : t("form.add")}</button>
        </div>
      </form>

      {church && (
        <div class="cluster-modal-foot">
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
        </div>
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
  region?: number | null;
}) {
  const { user, perms, flash, lang, churches, regions, homeCells } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const q = props.q ?? "";
  const status = props.status ?? "all";
  const region = props.region ?? null;
  const visible = churches.filter((c) =>
    (region == null || c.regionId === region) &&
    statusMatches(status, c.active === 1) &&
    matchesQuery(q, [c.name, c.nameEn, c.stateName, c.stateNameEn]));
  const filtered = q.trim().length > 0 || status !== "all" || region != null;
  const attachedCount = homeCells.filter((c) => c.regionalChurchId != null).length;
  const unattachedCount = homeCells.length - attachedCount;
  const mainChurches = churches.filter((c) => c.isMain === 1);
  const regionalChurches = churches.filter((c) => c.isMain !== 1);
  const visibleMain = visible.filter((c) => c.isMain === 1);
  const visibleRegional = visible.filter((c) => c.isMain !== 1);

  const renderChurchCard = (church: RegionalChurchRow) => {
    const cells = homeCells.filter((c) => c.regionalChurchId === church.id);
    const attachedGroups = groupCellsByTownship(cells, t("org.townshipUnassigned"));
    return (
      <article class={`hh-card regional-card-v2${church.active ? "" : " is-inactive"}`}>
        <div class="hh-card-head">
          <span class="hh-avatar" aria-hidden="true"><ChurchGlyph /></span>
          <div class="hh-card-title">
            <span class="hh-card-name" title={L !== "mm" && church.nameEn ? church.nameEn : church.name}>
              {L !== "mm" && church.nameEn ? church.nameEn : church.name}
              {church.isMain === 1 && <span class="badge position"> {t("org.mainChurch")}</span>}
            </span>
            <span class="hh-card-meta">
              <span class="muted small">
                {L !== "mm" && church.stateNameEn ? church.stateNameEn : church.stateName}
              </span>
              <span class="hh-count"><b>{cells.length}</b> {t("org.cells")}</span>
            </span>
          </div>
        </div>

        <div class="hh-facts">
          <div class="hh-fact">
            <span class="hh-fact-label">{t("detail.state")}</span>
            <span class="hh-fact-value">
              {L !== "mm" && church.stateNameEn ? church.stateNameEn : church.stateName}
            </span>
          </div>
          <div class="hh-fact">
            <span class="hh-fact-label">{t("members.status")}</span>
            <span class="hh-fact-value">
              <span class={`badge ${church.active ? "active" : "inactive"}`}>
                {church.active ? t("dept.active") : t("dept.inactive")}
              </span>
            </span>
          </div>
        </div>

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

        <div class="hh-card-actions">
          <a
            class="btn sm secondary js-edit-modal"
            href={`/organization/regional-churches/${church.id}/edit`}
            data-modal-title={t("org.editRegional")}
          >{t("members.edit")}</a>
        </div>
      </article>
    );
  };

  return (
    <Layout title={t("org.churchesTitle")} lang={lang} user={user} perms={perms} active="/organization" flash={flash ?? null}>
      <div class="page-head">
        <div>
          <h1>{t("org.churchesTitle")}<span class="count-pill">{visible.length}</span></h1>
          <p class="page-sub">{t("org.regionalIntro")}</p>
        </div>
        <div class="page-head-actions">
          <CardViewToggle lang={lang} viewKey="regional-churches" />
          <a
            class="btn js-add-modal"
            href="/organization/regional-churches/new"
            data-modal-title={t("org.addRegional")}
          >+ {t("org.addRegional")}</a>
          <a class="btn secondary" href="/organization?tab=regional">{t("dept.back")}</a>
        </div>
      </div>

      <div class="stat-grid org-stats">
        <div class="stat"><div class="n">{mainChurches.length}</div><div class="t">{t("org.mainChurchStat")}</div></div>
        <div class="stat"><div class="n">{regionalChurches.length}</div><div class="t">{t("org.regionalChurchesStat")}</div></div>
        <div class="stat"><div class="n">{attachedCount}</div><div class="t">{t("org.attachedCells")}</div></div>
        <div class="stat"><div class="n">{unattachedCount}</div><div class="t">{t("org.unattachedCells")}</div></div>
      </div>

      <form class="filters settings-filters" method="get" action="/organization/regional-churches" data-auto-submit="1">
        <input type="search" name="q" value={q} placeholder={t("org.searchRegional")}
          aria-label={t("members.search")} enterkeyhint="search" />
        <select name="region" aria-label={t("detail.state")}>
          <option value="" selected={region == null}>{t("org.allStates")}</option>
          {regions.map((r) => (
            <option value={String(r.id)} selected={region === r.id}>{r.name}</option>
          ))}
        </select>
        <select name="status" aria-label={t("members.status")}>
          <option value="" selected={status === "all"}>{t("members.allStatuses")}</option>
          <option value="active" selected={status === "active"}>{t("dept.active")}</option>
          <option value="inactive" selected={status === "inactive"}>{t("dept.inactive")}</option>
        </select>
        <div class="actions">
          <button class="btn sm secondary" type="submit">{t("members.search")}</button>
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
        <>
          {(() => {
            const groups = new Map<number, { name: string; churches: RegionalChurchRow[] }>();
            for (const church of visible) {
              let group = groups.get(church.regionId);
              if (!group) {
                group = {
                  name: L !== "mm" && church.stateNameEn ? church.stateNameEn : church.stateName,
                  churches: [],
                };
                groups.set(church.regionId, group);
              }
              group.churches.push(church);
            }
            return [...groups.entries()].map(([regionId, group]) => (
              <section class="org-departments">
                <div class="org-section-head">
                  <div>
                    <h2>{group.name}</h2>
                    <p class="muted small">{countLabel(t, "org.churchesShort", group.churches.length)}</p>
                  </div>
                </div>
                <div class="hh-grid" data-view-grid>{group.churches.map(renderChurchCard)}</div>
              </section>
            ));
          })()}
        </>
      )}
    </Layout>
  );
}
