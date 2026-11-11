import { Layout, type Flash } from "./layout";
import type { SessionUser } from "../session";
import { getDict, type Lang } from "../i18n";
import { clusterName, type SupervisionClusterRow } from "../org-units";

type Common = { user: SessionUser; perms: Set<string>; flash?: Flash; lang?: Lang };

export type ClusterHomeCell = {
  id: number;
  label: string;
  regionId: number;
  township: string | null;
  supervisionClusterId: number | null;
};

export type ClusterValues = {
  name: string;
  nameEn: string;
  regionId: number | "";
  sortOrder: number;
  active: boolean;
  pastorMemberId: number | "";
};

function clusterValues(cluster?: SupervisionClusterRow): ClusterValues {
  return {
    name: cluster?.name ?? "",
    nameEn: cluster?.nameEn ?? "",
    regionId: cluster?.regionId ?? "",
    sortOrder: cluster?.sortOrder ?? 0,
    active: cluster ? cluster.active === 1 : true,
    pastorMemberId: cluster?.pastorId ?? "",
  };
}

function ClusterFields(props: {
  values: ClusterValues;
  regions: { id: number; name: string }[];
  pastorCandidates: { id: number; name: string }[];
  lang: Lang;
  editing: boolean;
}) {
  const { values, regions, pastorCandidates, lang, editing } = props;
  const t = getDict(lang);
  return (
    <div class="form-grid">
      <label class="field">
        <span class="lbl">{t("org.clusterName")}</span>
        <input type="text" name="name" value={values.name} maxlength={80} required />
      </label>
      <label class="field">
        <span class="lbl">{t("org.clusterNameEn")}</span>
        <input type="text" name="name_en" value={values.nameEn} maxlength={120} />
      </label>
      <label class="field">
        <span class="lbl">{t("org.clusterState")}</span>
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
        <label class="field span-2">
          <span class="lbl">{t("org.clusterPastor")}</span>
          <select name="pastor_member_id">
            <option value="">{t("org.noPastor")}</option>
            {pastorCandidates.map((member) => (
              <option value={String(member.id)} selected={values.pastorMemberId === member.id}>
                {member.name}
              </option>
            ))}
          </select>
          <span class="hint">{t("org.clusterPastorHint")}</span>
        </label>
      )}
      {editing && (
        <label class="dept-active span-2">
          <input type="checkbox" name="active" value="1" checked={values.active} />
          <span>{t("dept.active")}</span>
        </label>
      )}
    </div>
  );
}

function groupHomeCells(cells: ClusterHomeCell[], noTownship: string) {
  const groups = new Map<string, { name: string; cells: ClusterHomeCell[] }>();
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

/** Bare form for the add/edit modal. Native submission keeps redirects and
 *  validation errors on the list, like the regional-church editor. */
export function SupervisionClusterModal(props: {
  cluster?: SupervisionClusterRow;
  regions: { id: number; name: string }[];
  homeCells: ClusterHomeCell[];
  pastorCandidates?: { id: number; name: string }[];
  values?: ClusterValues;
  error?: string | null;
  cellError?: string | null;
  selectedCellIds?: number[];
  lang?: Lang;
}) {
  const { cluster, regions, homeCells, error, cellError } = props;
  const L = props.lang ?? "en";
  const t = getDict(L);
  const values = props.values ?? clusterValues(cluster);
  const cells = cluster
    ? homeCells.filter((c) => c.supervisionClusterId === cluster.id)
    : [];
  // When a failed save proposed a different state, show that state's cells
  // so the corrected form can still be submitted without reopening it.
  const selectedRegion = values.regionId === "" ? cluster?.regionId : values.regionId;
  const candidates = cluster && selectedRegion != null
    ? homeCells.filter((c) => c.regionId === selectedRegion)
    : [];
  const isPicked = (cell: ClusterHomeCell) =>
    props.selectedCellIds
      ? props.selectedCellIds.includes(cell.id)
      : cell.supervisionClusterId === cluster?.id;

  return (
    <>
      {error && <div class="modal-error" role="alert">{error}</div>}
      <form method="post" class="cluster-main-form"
        action={cluster ? `/organization/clusters/${cluster.id}` : "/organization/clusters"} data-modal-ajax>
        <ClusterFields
          values={values}
          regions={regions}
          pastorCandidates={props.pastorCandidates ?? []}
          lang={L}
          editing={Boolean(cluster)}
        />
        <div class="actions">
          <button class="btn" type="submit">{cluster ? t("dept.save") : t("form.add")}</button>
        </div>
      </form>

      {cluster && (
        <>
          <form method="post" action={`/organization/clusters/${cluster.id}/cells`}
            class="cluster-cells-form" data-modal-ajax>
            <div class="cluster-section-head">
              <div class="cluster-section-title">
                <strong>{t("org.clusterCellAssignment")}</strong>
                <span class="count-pill">{cells.length}</span>
              </div>
              <p class="muted small">{t("org.clusterCellHint")}</p>
            </div>
            {cellError && <div class="modal-error" role="alert">{cellError}</div>}
            {candidates.length === 0 ? (
              <p class="muted small">{t("org.clusterCandidatesEmpty")}</p>
            ) : (
              <div class="regional-cell-groups">
                {groupHomeCells(candidates, t("org.townshipUnassigned")).map((group) => (
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
              <button class="btn sm secondary" type="submit">{t("org.clusterSaveCells")}</button>
            </div>
          </form>

          <div class="cluster-modal-foot">
            {cells.length === 0 ? (
              <form
                method="post"
                action={`/organization/clusters/${cluster.id}/delete`}
                class="modal-danger"
                data-confirm={t("org.clusterDeleteConfirm")}
                data-confirm-title={t("members.delete")}
                data-confirm-yes={t("members.delete")}
              >
                <div class="actions">
                  <button class="btn sm outline-danger" type="submit">{t("members.delete")}</button>
                </div>
              </form>
            ) : (
              <p class="muted small modal-note">{t("org.clusterDeleteHint")}</p>
            )}
          </div>
        </>
      )}
    </>
  );
}

function matchesQuery(q: string, fields: (string | null | undefined)[]): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => (f ?? "").toLowerCase().includes(needle));
}

export function SupervisionClustersPage(props: Common & {
  clusters: SupervisionClusterRow[];
  regions: { id: number; name: string }[];
  homeCells: ClusterHomeCell[];
  q?: string;
  status?: "all" | "active" | "inactive";
}) {
  const { user, perms, flash, lang, clusters, regions, homeCells } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const q = props.q ?? "";
  const status = props.status ?? "all";
  const visible = clusters.filter((c) =>
    (status === "all" || (status === "active" ? c.active === 1 : c.active === 0)) &&
    matchesQuery(q, [c.name, c.nameEn, c.stateName, c.stateNameEn]));
  const filtered = q.trim().length > 0 || status !== "all";
  const attached = homeCells.filter((c) => c.supervisionClusterId != null).length;
  const unattached = homeCells.length - attached;

  return (
    <Layout title={t("org.clustersTitle")} lang={lang} user={user} perms={perms} active="/organization" flash={flash ?? null}>
      <div class="page-head">
        <div>
          <h1>{t("org.clustersTitle")}<span class="count-pill">{visible.length}</span></h1>
          <p class="page-sub">{t("org.clustersIntro")}</p>
        </div>
        <div class="page-head-actions">
          <a class="btn js-add-modal" href="/organization/clusters/new"
            data-modal-title={t("org.addCluster")} data-modal-size="md">
            + {t("org.addCluster")}
          </a>
          <a class="btn secondary" href="/organization?tab=home-cells">{t("dept.back")}</a>
        </div>
      </div>

      <div class="stat-grid org-stats">
        <div class="stat"><div class="n">{clusters.length}</div><div class="t">{t("org.clustersStat")}</div></div>
        <div class="stat"><div class="n">{attached}</div><div class="t">{t("org.attachedClusterCells")}</div></div>
        <div class="stat"><div class="n">{unattached}</div><div class="t">{t("org.unattachedClusterCells")}</div></div>
      </div>

      <form class="filters settings-filters" method="get" action="/organization/clusters" data-auto-submit="1">
        <input type="search" name="q" value={q} placeholder={t("org.searchClusters")}
          aria-label={t("members.search")} enterkeyhint="search" />
        <select name="status" aria-label={t("members.status")}>
          <option value="" selected={status === "all"}>{t("members.allStatuses")}</option>
          <option value="active" selected={status === "active"}>{t("dept.active")}</option>
          <option value="inactive" selected={status === "inactive"}>{t("dept.inactive")}</option>
        </select>
        <div class="actions"><button class="btn sm" type="submit">{t("members.search")}</button></div>
      </form>

      {visible.length === 0 ? (
        <div class="card org-empty org-empty-small">
          <p class="muted">{filtered ? t("org.filterEmpty") : t("org.noClusters")}</p>
          {filtered && <p class="small"><a href="/organization/clusters">{t("members.clearFilters")}</a></p>}
        </div>
      ) : (
        <div class="cluster-list">
          {visible.map((cluster) => {
            const cells = homeCells.filter((c) => c.supervisionClusterId === cluster.id);
            return (
              <article class={`card cluster-card${cluster.active ? "" : " is-inactive"}`}>
                <div class="cluster-card-main">
                  <div class="cluster-card-title">
                    <h3>{clusterName(cluster, L)}</h3>
                    <p class="muted small">
                      {L !== "mm" && cluster.stateNameEn ? cluster.stateNameEn : cluster.stateName}
                      {" · "}{cells.length} {t("org.cells")}
                    </p>
                  </div>
                  <div class="cluster-card-pastor">
                    <span class="cluster-kicker">{t("org.clusterPastor")}</span>
                    <span class={cluster.pastorName ? "" : "muted"}>
                      {cluster.pastorName || t("org.noPastor")}
                    </span>
                  </div>
                  <div class="role-card-actions cluster-card-actions">
                    <span class={`badge ${cluster.active ? "active" : "inactive"}`}>
                      {cluster.active ? t("dept.active") : t("dept.inactive")}
                    </span>
                    <a class="btn sm secondary js-edit-modal" href={`/organization/clusters/${cluster.id}/edit`}
                      data-modal-title={t("org.editCluster")} data-modal-size="md">
                      {t("members.edit")}
                    </a>
                  </div>
                </div>

                {cells.length === 0 ? (
                  <p class="muted small cluster-empty-line">{t("org.clusterNoCells")}</p>
                ) : (
                  <div class="cluster-cell-strip">
                    {groupHomeCells(cells, t("org.townshipUnassigned")).map((group) => (
                      <div class="cluster-township-line">
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
