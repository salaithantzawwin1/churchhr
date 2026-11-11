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

function PositionFields(props: { def?: PositionDefRow; lang: Lang; editing: boolean }) {
  const { def, lang } = props;
  const t = getDict(lang);
  return (
    <div class="form-grid">
      <label class="field">
        <span class="lbl">{t("org.positionNameMm")}</span>
        <input name="name_myanmar" value={def?.nameMyanmar ?? ""} maxlength={100} required />
      </label>
      <label class="field">
        <span class="lbl">{t("org.positionNameEn")}</span>
        <input name="name_english" value={def?.nameEnglish ?? ""} maxlength={100} required={!props.editing} />
      </label>
      <label class="field">
        <span class="lbl">{t("org.positionNameKr")}</span>
        <input name="name_korean" value={def?.nameKorean ?? ""} maxlength={100} />
      </label>
      <label class="field">
        <span class="lbl">{t("org.positionSort")}</span>
        <input name="sort_order" type="number" min="0" max="9999" value={String(def?.sortOrder ?? 0)} />
      </label>
      {def && (
        <label class="dept-active">
          <input type="checkbox" name="active" value="1" checked={def.active === 1} />
          <span>{t("dept.active")}</span>
        </label>
      )}
    </div>
  );
}

export function PositionsPage(props: Common & {
  scope: ConfigurablePositionScope;
  defs: PositionDefRow[];
}) {
  const { user, perms, flash, lang, scope, defs } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const current = defs
    .filter((d) => d.scopeType === scope)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const counts = Object.fromEntries(
    CONFIGURABLE_POSITION_SCOPES.map((s) => [s, defs.filter((d) => d.scopeType === s).length]),
  ) as Record<ConfigurablePositionScope, number>;

  return (
    <Layout title={t("org.positionsTitle")} lang={lang} user={user} perms={perms} active="/organization" flash={flash ?? null}>
      <div class="page-head">
        <div>
          <h1>{t("org.positionsTitle")}<span class="count-pill">{current.length}</span></h1>
          <p class="page-sub">{t("org.positionsIntro")}</p>
        </div>
        <div class="page-head-actions">
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

      <details class="card settings-add" open={current.length === 0}>
        <summary>
          <span class="settings-add-title">+ {t("org.addPosition")}</span>
          <span class="muted small">{t("org.addPositionHint")}</span>
        </summary>
        <div class="settings-add-body">
          <form method="post" action="/organization/positions">
            <input type="hidden" name="scope" value={scope} />
            <PositionFields lang={L} editing={false} />
            <div class="actions"><button class="btn" type="submit">{t("form.add")}</button></div>
          </form>
        </div>
      </details>

      {current.length === 0 ? (
        <div class="card org-empty org-empty-small">
          <p class="muted">{t("org.noPositions")}</p>
        </div>
      ) : (
        <div class="role-list">
          {current.map((def) => {
            const inUse = (def.usageCount ?? 0) > 0;
            return (
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
                  <span class={`badge ${def.active ? "active" : "inactive"}`}>
                    {def.active ? t("dept.active") : t("dept.inactive")}
                  </span>
                </header>

                <details class="settings-details">
                  <summary>{t("org.editRole")}</summary>
                  <form method="post" action={`/organization/positions/${def.id}`}>
                    <PositionFields def={def} lang={L} editing />
                    <div class="actions">
                      <button class="btn sm" type="submit">{t("dept.save")}</button>
                    </div>
                  </form>

                  {!inUse ? (
                    <form method="post" action={`/organization/positions/${def.id}/delete`} class="role-danger"
                      data-confirm={t("org.deletePositionConfirm")} data-confirm-title={t("members.delete")}
                      data-confirm-yes={t("members.delete")}>
                      <button class="btn sm outline-danger" type="submit">{t("members.delete")}</button>
                    </form>
                  ) : (
                    <p class="muted small role-inuse">{t("org.deleteRoleHint")}</p>
                  )}
                </details>
              </article>
            );
          })}
        </div>
      )}
    </Layout>
  );
}

function RegionalFields(props: { row?: RegionalChurchRow; regions: { id: number; name: string }[]; lang: Lang }) {
  const { row, regions, lang } = props;
  const t = getDict(lang);
  return (
    <div class="form-grid">
      <label class="field">
        <span class="lbl">{t("org.regionalName")}</span>
        <input name="name" value={row?.name ?? ""} maxlength={80} required />
      </label>
      <label class="field">
        <span class="lbl">{t("org.regionalNameEn")}</span>
        <input name="name_en" value={row?.nameEn ?? ""} maxlength={120} />
      </label>
      <label class="field">
        <span class="lbl">{t("org.regionalState")}</span>
        <select name="region_id" required>
          <option value="">{t("form.choose")}</option>
          {regions.map((r) => (
            <option value={String(r.id)} selected={row?.regionId === r.id}>{r.name}</option>
          ))}
        </select>
      </label>
      <label class="field">
        <span class="lbl">{t("org.positionSort")}</span>
        <input name="sort_order" type="number" min="0" max="9999" value={String(row?.sortOrder ?? 0)} />
      </label>
      {row && (
        <label class="dept-active">
          <input type="checkbox" name="active" value="1" checked={row.active === 1} />
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

export function RegionalChurchesPage(props: Common & {
  churches: RegionalChurchRow[];
  regions: { id: number; name: string }[];
  homeCells: HomeCellOption[];
}) {
  const { user, perms, flash, lang, churches, regions, homeCells } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const attachedCount = homeCells.filter((c) => c.regionalChurchId != null).length;
  const unattachedCount = homeCells.length - attachedCount;

  return (
    <Layout title={t("org.regionalTitle")} lang={lang} user={user} perms={perms} active="/organization" flash={flash ?? null}>
      <div class="page-head">
        <div>
          <h1>{t("org.regionalTitle")}<span class="count-pill">{churches.length}</span></h1>
          <p class="page-sub">{t("org.regionalIntro")}</p>
        </div>
        <a class="btn secondary" href="/organization?tab=regional">{t("dept.back")}</a>
      </div>

      <div class="stat-grid org-stats">
        <div class="stat"><div class="n">{churches.length}</div><div class="t">{t("org.regionalChurchesStat")}</div></div>
        <div class="stat"><div class="n">{attachedCount}</div><div class="t">{t("org.attachedCells")}</div></div>
        <div class="stat"><div class="n">{unattachedCount}</div><div class="t">{t("org.unattachedCells")}</div></div>
      </div>

      <details class="card settings-add" open={churches.length === 0}>
        <summary>
          <span class="settings-add-title">+ {t("org.addRegional")}</span>
          <span class="muted small">{t("org.addRegionalHint")}</span>
        </summary>
        <div class="settings-add-body">
          <form method="post" action="/organization/regional-churches">
            <RegionalFields regions={regions} lang={L} />
            <div class="actions"><button class="btn" type="submit">{t("form.add")}</button></div>
          </form>
        </div>
      </details>

      {churches.length === 0 ? (
        <div class="card org-empty org-empty-small">
          <p class="muted">{t("org.noRegional")}</p>
        </div>
      ) : (
        <div class="regional-list">
          {churches.map((church) => {
            const cells = homeCells.filter((c) => c.regionalChurchId === church.id);
            const candidates = homeCells.filter((c) =>
              c.regionId === church.regionId && (c.regionalChurchId == null || c.regionalChurchId === church.id));
            const attachedGroups = groupCellsByTownship(cells, t("org.townshipUnassigned"));
            const candidateGroups = groupCellsByTownship(candidates, t("org.townshipUnassigned"));

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
                  <span class={`badge ${church.active ? "active" : "inactive"}`}>
                    {church.active ? t("dept.active") : t("dept.inactive")}
                  </span>
                </header>

                {cells.length === 0 ? (
                  <p class="muted small regional-attached-empty">{t("org.regionalNoCells")}</p>
                ) : (
                  <div class="regional-attached">
                    <span class="org-role-label">{t("org.attachedCells")}</span>
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

                <details class="settings-details">
                  <summary>{t("org.editRegional")}</summary>

                  <form method="post" action={`/organization/regional-churches/${church.id}`}>
                    <RegionalFields row={church} regions={regions} lang={L} />
                    <div class="actions">
                      <button class="btn sm" type="submit">{t("dept.save")}</button>
                    </div>
                  </form>

                  <form method="post" action={`/organization/regional-churches/${church.id}/cells`} class="regional-cells-form">
                    <div class="regional-cells-head">
                      <strong>{t("org.regionalCellAssignment")}</strong>
                      <span class="muted small">{t("org.regionalCellHint")}</span>
                    </div>
                    {candidates.length === 0 ? (
                      <p class="muted small">{t("org.regionalNoCells")}</p>
                    ) : (
                      <div class="regional-cell-groups">
                        {candidateGroups.map((group) => (
                          <div class="regional-candidate-group">
                            <h4>{group.name}</h4>
                            <div class="check-grid">
                              {group.cells.map((cell) => (
                                <label class="check-chip">
                                  <input type="checkbox" name="home_cell_ids" value={String(cell.id)}
                                    checked={cell.regionalChurchId === church.id} />
                                  <span>{cell.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div class="actions"><button class="btn sm secondary" type="submit">{t("org.saveCells")}</button></div>
                  </form>

                  {cells.length === 0 ? (
                    <form method="post" action={`/organization/regional-churches/${church.id}/delete`} class="role-danger"
                      data-confirm={t("org.deleteRegionalConfirm")} data-confirm-title={t("members.delete")}
                      data-confirm-yes={t("members.delete")}>
                      <button class="btn sm outline-danger" type="submit">{t("members.delete")}</button>
                    </form>
                  ) : (
                    <p class="muted small role-inuse">{t("org.deleteRegionalHint")}</p>
                  )}
                </details>
              </article>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
