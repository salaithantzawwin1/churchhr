import { Layout, type Flash } from "./layout";
import type { SessionUser } from "../session";
import { getDict, type Lang } from "../i18n";
import { positionDefLabel, defsForScope, type PositionDefRow } from "../position-catalog";
import { clusterName, regionalChurchName, type RegionalChurchRow, type SupervisionClusterRow } from "../org-units";
import { departmentName } from "../departments";

export type OrgCell = {
  id: number;
  label: string;
  code: string | null;
  region_id: number;
  township_id: number | null;
  regional_church_id: number | null;
  state_name: string;
  state_name_en: string | null;
  township: string | null;
  supervision_cluster_id: number | null;
  member_count: number;
};

export type OrgDepartment = {
  id: number;
  name: string;
  name_en: string | null;
  sort_order: number;
  member_count: number;
};

export type OrgLeader = {
  position: string;
  scope_type: string;
  scope_id: number | null;
  department_id: number | null;
  regional_church_id: number | null;
  supervision_cluster_id: number | null;
  member_id: number;
  member_name: string | null;
  has_photo: number | boolean;
  updated_at: number;
};

type Common = { user: SessionUser; perms: Set<string>; flash?: Flash; lang?: Lang };

type TownshipGroup = { id: number | null; name: string; cells: OrgCell[] };
type SupervisionGroup = {
  kind: "cluster" | "township"; id: number | null; name: string; cells: OrgCell[];
  cluster: SupervisionClusterRow | null;
};
type StateGroup = { id: number; name: string; cells: OrgCell[]; townships: TownshipGroup[]; groups: SupervisionGroup[] };

/** Group cells by township; cells without a township keep their own unnamed
 * cluster so supervisors and their cells stay together inside a regional church. */
function groupByTownship(cells: OrgCell[], fallbackName: string): TownshipGroup[] {
  const groups = new Map<string, TownshipGroup>();
  for (const cell of cells) {
    const key = String(cell.township_id ?? "none");
    let group = groups.get(key);
    if (!group) {
      group = { id: cell.township_id, name: cell.township || fallbackName, cells: [] };
      groups.set(key, group);
    }
    group.cells.push(cell);
  }
  return [...groups.values()];
}

function groupCells(cells: OrgCell[], clusters: SupervisionClusterRow[], lang: Lang): StateGroup[] {
  const states = new Map<number, StateGroup>();
  for (const cell of cells) {
    let state = states.get(cell.region_id);
    if (!state) {
      state = {
        id: cell.region_id,
        name: lang !== "mm" && cell.state_name_en ? cell.state_name_en : cell.state_name,
        cells: [],
        townships: [],
        groups: [],
      };
      states.set(cell.region_id, state);
    }
    state.cells.push(cell);
  }
  for (const state of states.values()) {
    const towns = new Map<string, TownshipGroup>();
    for (const cell of state.cells) {
      const key = String(cell.township_id ?? `none:${cell.township ?? "-"}`);
      let group = towns.get(key);
      if (!group) {
        group = { id: cell.township_id, name: cell.township || "—", cells: [] };
        towns.set(key, group);
      }
      group.cells.push(cell);
    }
    state.townships = [...towns.values()];
    const clusterById = new Map(clusters.map((c) => [c.id, c]));
    const groups = new Map<string, SupervisionGroup>();
    for (const cell of state.cells) {
      const cluster = cell.supervision_cluster_id
        ? clusterById.get(cell.supervision_cluster_id) ?? null
        : null;
      const key = cluster
        ? `cluster:${cluster.id}`
        : `township:${cell.township_id ?? "none"}:${cell.township ?? "-"}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          kind: cluster ? "cluster" : "township",
          id: cluster ? cluster.id : cell.township_id,
          name: cluster ? clusterName(cluster, lang) : cell.township || "—",
          cells: [], cluster,
        };
        groups.set(key, group);
      }
      group.cells.push(cell);
    }
    state.groups = [...groups.values()];
  }
  return [...states.values()];
}

function initialOf(name: string | null | undefined): string {
  return Array.from((name ?? "").trim())[0] ?? "?";
}

function LeaderAvatar(props: { leader: OrgLeader | null; size: "lg" | "md" | "sm" }) {
  const { leader, size } = props;
  if (!leader) return <span class={`org-avatar ${size} vacant`} aria-hidden="true">?</span>;
  return (
    <span class={`org-avatar ${size}`} aria-hidden="true">
      {leader.has_photo
        ? <img src={`/members/${leader.member_id}/photo?v=${leader.updated_at}`} alt="" loading="lazy" />
        : initialOf(leader.member_name)}
    </span>
  );
}

function LeaderLink(props: { leader: OrgLeader | null; empty: string }) {
  const { leader, empty } = props;
  if (!leader) return <span class="muted">{empty}</span>;
  return <a href={`/members/${leader.member_id}`}>{leader.member_name || "—"}</a>;
}

function leaderFor(
  leaders: OrgLeader[], scopeType: string, position: string,
  opts: { scopeId?: number | null; departmentId?: number | null; regionalChurchId?: number | null; supervisionClusterId?: number | null } = {},
): OrgLeader | null {
  return leaders.find((l) =>
    l.scope_type === scopeType && l.position === position &&
    (opts.scopeId === undefined || l.scope_id === opts.scopeId) &&
    (opts.departmentId === undefined || l.department_id === opts.departmentId) &&
    (opts.regionalChurchId === undefined || l.regional_church_id === opts.regionalChurchId) &&
    (opts.supervisionClusterId === undefined || l.supervision_cluster_id === opts.supervisionClusterId)
  ) ?? null;
}

/** Role rows for a scope, lead position first. */
function positionRows(defs: PositionDefRow[], scope: Parameters<typeof defsForScope>[1], lang: Lang) {
  const rows = defsForScope(defs, scope);
  return { lead: rows[0] ?? null, rest: rows.slice(1), all: rows };
}

export function OrganizationPage(props: Common & {
  tab: "church" | "home-cells" | "regional";
  cells: OrgCell[];
  departments: OrgDepartment[];
  leaders: OrgLeader[];
  regionalChurches: RegionalChurchRow[];
  clusters: SupervisionClusterRow[];
  positionDefs: PositionDefRow[];
  canManageDepartments: boolean;
  canManageStructure: boolean;
  canManageClusters: boolean;
  canManagePositions: boolean;
  unassignedMembers: number;
}) {
  const {
    user, perms, flash, lang, tab, cells, departments, leaders,
    regionalChurches, clusters, positionDefs, canManageDepartments, canManageStructure,
    canManageClusters, canManagePositions, unassignedMembers,
  } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const states = groupCells(cells, clusters, L);
  const members = cells.reduce((sum, c) => sum + c.member_count, 0);
  const leadCode = positionRows(positionDefs, "home_cell", L).lead?.code ?? "";
  const withLeader = leadCode
    ? cells.filter((c) => leaderFor(leaders, "home_cell", leadCode, { scopeId: c.id })).length
    : 0;
  const canEdit = perms.has("members.update");
  const canManageOptions = perms.has("options.manage");
  const cellHref = (id: number) => `/members?home_cell=${id}`;

  const churchRows = positionRows(positionDefs, "church", L);
  const cellRows = positionRows(positionDefs, "home_cell", L);
  const regionalRows = positionRows(positionDefs, "regional_church", L);
  const deptRows = positionRows(positionDefs, "department", L);

  const churchRole = (position: string) => leaderFor(leaders, "church", position);
  const departmentRole = (departmentId: number, position: string) =>
    leaderFor(leaders, "department", position, { departmentId });
  const homeRole = (cellId: number, position: string) =>
    leaderFor(leaders, "home_cell", position, { scopeId: cellId });
  const townshipRole = (townshipId: number | null, position: string) =>
    townshipId == null ? null : leaderFor(leaders, "township", position, { scopeId: townshipId });
  const clusterRole = (clusterId: number | null, position: string) =>
    clusterId == null ? null : leaderFor(leaders, "cluster", position, { supervisionClusterId: clusterId });
  const regionalRole = (churchId: number, position: string) =>
    leaderFor(leaders, "regional_church", position, { regionalChurchId: churchId });

  const manageLinks = (canManagePositions || canManageStructure) && (
    <div class="org-manage-links">
      {canManagePositions && (
        <a class="btn secondary sm" href="/organization/positions?scope=church">{t("org.managePositions")}</a>
      )}
      {canManageStructure && (
        <a class="btn secondary sm" href="/organization/regional-churches">{t("org.manageRegional")}</a>
      )}
      {canManageClusters && (
        <a class="btn secondary sm" href="/organization/clusters">{t("org.manageClusters")}</a>
      )}
    </div>
  );

  const cellRoles = (cell: OrgCell, variant: "card" | "row") => {
    const lead = cellRows.lead ? homeRole(cell.id, cellRows.lead.code) : null;
    if (variant === "row") {
      return (
        <div class="org-cell-leader">
          {lead ? (
            <>
              <span class="org-role-label">{cellRows.lead ? positionDefLabel(cellRows.lead, L) : ""}</span>
              <LeaderLink leader={lead} empty={t("org.noLeader")} />
            </>
          ) : (
            <span class="badge inactive">{t("org.noLeader")}</span>
          )}
        </div>
      );
    }
    return (
      <>
        <div class="org-cell-lead">
          <span class="org-role-label">{cellRows.lead ? positionDefLabel(cellRows.lead, L) : ""}</span>
          <LeaderLink leader={lead} empty={t("org.noLeader")} />
        </div>
        <div class="org-mini-list">
          {cellRows.rest.map((p) => {
            const member = homeRole(cell.id, p.code);
            return (
              <div class={`org-mini${member ? "" : " org-vacant"}`}>
                <LeaderAvatar leader={member} size="sm" />
                <div>
                  <span class="org-mini-role">{positionDefLabel(p, L)}</span>
                  <LeaderLink leader={member} empty={t("org.vacant")} />
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const townshipSupervision = (township: TownshipGroup) => {
    const supervisionDefs = defsForScope(positionDefs, "township");
    if (township.id == null || supervisionDefs.length === 0) return null;
    return (
      <div class="org-supervision">
        <span class="org-supervision-title">{t("org.supervision")}</span>
        <div class="org-mini-list">
          {supervisionDefs.map((def) => {
            const member = townshipRole(township.id, def.code);
            return (
              <div class={`org-mini${member ? "" : " org-vacant"}`}>
                <LeaderAvatar leader={member} size="sm" />
                <div>
                  <span class="org-mini-role">{positionDefLabel(def, L)}</span>
                  <LeaderLink leader={member} empty={t("org.vacant")} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSupervisionGroup = (group: SupervisionGroup) => {
    const defs = defsForScope(positionDefs, group.kind === "cluster" ? "cluster" : "township");
    const role = (position: string) => group.kind === "cluster"
      ? clusterRole(group.id, position)
      : townshipRole(group.id, position);
    const supervisor = defs[0] ?? null;
    const assistants = defs.slice(1);
    return (
      <div class="org-supervision-group">
        <div class="org-supervision-group-head">
          <div>
            <span class="org-supervision-title">{group.kind === "cluster" ? t("org.clusterLabel") : t("org.townshipSupervision")}</span>
            <h3>{group.name}</h3>
          </div>
          <span class="muted small">{group.cells.length} {t("org.cells")}</span>
        </div>
        <div class="org-supervision-team">
          {supervisor && (
            <div class="org-supervision-person is-lead">
              <LeaderAvatar leader={role(supervisor.code)} size="md" />
              <div>
                <span class="org-node-role">{positionDefLabel(supervisor, L)}</span>
                <LeaderLink leader={role(supervisor.code)} empty={t("org.vacant")} />
              </div>
            </div>
          )}
          {assistants.map((def) => (
            <div class="org-supervision-person">
              <LeaderAvatar leader={role(def.code)} size="sm" />
              <div>
                <span class="org-node-role">{positionDefLabel(def, L)}</span>
                <LeaderLink leader={role(def.code)} empty={t("org.vacant")} />
              </div>
            </div>
          ))}
        </div>
        <div class="org-supervision-cells">
          {group.cells.map((cell) => (
            <div class="org-supervision-cell">
              <LeaderAvatar leader={cellRows.lead ? homeRole(cell.id, cellRows.lead.code) : null} size="sm" />
              <div class="org-supervision-cell-main">
                <a href={cellHref(cell.id)}>{cell.label}</a>
                <span class="muted small">
                  {cell.township ? `${cell.township} · ` : ""}{cell.member_count} {t("org.membersShort")}
                </span>
              </div>
              <div class="org-supervision-cell-roles">
                {cellRows.lead && (
                  <span class="org-cell-leader">
                    <span class="org-role-label">{positionDefLabel(cellRows.lead, L)}</span>
                    <LeaderLink leader={homeRole(cell.id, cellRows.lead.code)} empty={t("org.noLeader")} />
                  </span>
                )}
                {cellRows.all.slice(1).map((p) => (
                  <span class="org-cell-leader">
                    <span class="org-role-label">{positionDefLabel(p, L)}</span>
                    <LeaderLink leader={homeRole(cell.id, p.code)} empty={t("org.vacant")} />
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStateHierarchy = (state: StateGroup) => {
    const stateMembers = state.cells.reduce((sum, cell) => sum + cell.member_count, 0);
    return (
      <section class="card org-state org-state-hierarchy">
        <div class="org-state-head">
          <div>
            <h2>{state.name}</h2>
            <p class="muted small">
              {state.cells.length} {t("org.cells")} · {stateMembers} {t("org.membersShort")}
            </p>
          </div>
        </div>
        {state.groups.map(renderSupervisionGroup)}
      </section>
    );
  };

  return (
    <Layout title={t("org.title")} lang={lang} user={user} perms={perms} active="/organization" flash={flash ?? null}>
      <div class="page-head org-page-head">
        <div>
          <h1>{t("org.title")}<span class="count-pill">{cells.length} {t("org.cells")}</span></h1>
          <p class="page-sub">{t("org.intro")}</p>
        </div>
        <div class="page-head-actions">
          {manageLinks}
          <a class="btn secondary sm" href="/organization/vacancies">{t("vacancy.link")}</a>
          <a class="btn secondary sm" href="/members">{t("org.membersLink")}</a>
        </div>
      </div>

      <div class="page-toolbar">
        <div class="tabs">
          <a class={`btn sm ${tab === "church" ? "" : "secondary"}`} href="/organization"
            aria-current={tab === "church" ? "page" : undefined}>{t("org.churchTab")}</a>
          <a class={`btn sm ${tab === "regional" ? "" : "secondary"}`} href="/organization?tab=regional"
            aria-current={tab === "regional" ? "page" : undefined}>{t("org.regionalTab")}</a>
          <a class={`btn sm ${tab === "home-cells" ? "" : "secondary"}`} href="/organization?tab=home-cells"
            aria-current={tab === "home-cells" ? "page" : undefined}>{t("org.cellsTab")}</a>
        </div>
      </div>

      <div class="stat-grid org-stats">
        <div class="stat"><div class="n">{cells.length}</div><div class="t">{t("org.cells")}</div></div>
        <div class="stat"><div class="n">{withLeader}</div><div class="t">{t("org.leadersAssigned")}</div></div>
        <div class="stat"><div class="n">{members}</div><div class="t">{t("org.membersInCells")}</div></div>
        <div class="stat"><div class="n">{unassignedMembers}</div><div class="t">{t("org.unassignedMembers")}</div></div>
      </div>

      {tab === "church" ? (
        <>
          <section class="card org-chart">
            <div class="org-section-head">
              <div>
                <h2>{t("org.churchLeadership")}</h2>
                <p class="muted small">{t("org.churchLeadershipHint")}</p>
              </div>
              {canManagePositions && (
                <a class="btn secondary sm" href="/organization/positions?scope=church">{t("org.managePositions")}</a>
              )}
            </div>

            <div class="org-chart-level org-chart-level-top">
              {churchRows.lead && (() => {
                const leader = churchRole(churchRows.lead.code);
                return (
                  <div class="org-node org-node-lead">
                    <LeaderAvatar leader={leader} size="lg" />
                    <span class="org-node-role">{positionDefLabel(churchRows.lead, L)}</span>
                    <span class="org-node-name"><LeaderLink leader={leader} empty={t("org.vacant")} /></span>
                  </div>
                );
              })()}
            </div>

            <div class="org-chart-connector" aria-hidden="true" />
            <div class="org-chart-level org-chart-level-team">
              {churchRows.rest.map((p) => {
                const leader = churchRole(p.code);
                return (
                  <div class={`org-node${leader ? "" : " org-node-vacant"}`}>
                    <LeaderAvatar leader={leader} size="md" />
                    <span class="org-node-role">{positionDefLabel(p, L)}</span>
                    <span class="org-node-name"><LeaderLink leader={leader} empty={t("org.vacant")} /></span>
                  </div>
                );
              })}
            </div>
          </section>

          <section class="org-departments">
            <div class="org-section-head">
              <div>
                <h2>{t("org.departments")}</h2>
                <p class="muted small">{t("org.departmentsHint")}</p>
              </div>
              {canManageDepartments && (
                <a class="btn secondary sm" href="/organization/departments">{t("org.manageDepartments")}</a>
              )}
            </div>

            {departments.length === 0 ? (
              <div class="card org-empty org-empty-small">
                <p class="muted">{t("org.noDepartments")}</p>
                {canManageDepartments && (
                  <a class="btn secondary sm" href="/organization/departments">{t("org.addDepartment")}</a>
                )}
              </div>
            ) : (
              <div class="org-grid org-dept-grid">
                {departments.map((d) => {
                  const head = departmentRole(d.id, deptRows.lead?.code ?? "department_head");
                  const departmentLeaders = deptRows.rest
                    .map((p) => ({ position: p, leader: departmentRole(d.id, p.code) }));
                  return (
                    <article class="card org-dept-card">
                      <div class="org-dept-head">
                        <LeaderAvatar leader={head} size="md" />
                        <div class="org-dept-title">
                          <h3><a href={`/organization/departments/${d.id}`}>{departmentName(d, L)}</a></h3>
                          <span class="muted small">
                            {d.member_count} {t("org.membersShort")}
                          </span>
                        </div>
                      </div>
                      <div class="org-dept-lead">
                        <span class="org-node-role">
                          {deptRows.lead ? positionDefLabel(deptRows.lead, L) : t("org.departmentHead")}
                        </span>
                        <LeaderLink leader={head} empty={t("org.vacant")} />
                      </div>
                      <div class="org-mini-list">
                        {departmentLeaders.map((p) => (
                          <div class={`org-mini${p.leader ? "" : " org-vacant"}`}>
                            <LeaderAvatar leader={p.leader} size="sm" />
                            <div>
                              <span class="org-mini-role">{positionDefLabel(p.position, L)}</span>
                              <LeaderLink leader={p.leader} empty={t("org.vacant")} />
                            </div>
                          </div>
                        ))}
                      </div>
                      <a class="org-card-link" href={`/organization/departments/${d.id}`}>
                        {t("org.viewDepartment")} <span aria-hidden="true">→</span>
                      </a>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {cells.length === 0 ? (
            <div class="card org-empty">
              <h2>{t("org.emptyTitle")}</h2>
              <p class="muted">{t("org.emptyBody")}</p>
              {canManageOptions && <a class="btn secondary" href="/admin/options?type=home_cell">{t("org.manageCells")}</a>}
            </div>
          ) : (
            <div class="org-church">
              {states.map((state) => {
                const stateMembers = state.cells.reduce((sum, c) => sum + c.member_count, 0);
                const stateLeaders = leadCode
                  ? state.cells.filter((c) => homeRole(c.id, leadCode)).length
                  : 0;
                return (
                  <section class="card org-state">
                    <div class="org-state-head">
                      <div>
                        <h2>{state.name}</h2>
                        <p class="muted small">
                          {state.cells.length} {t("org.cells")} · {stateMembers} {t("org.membersShort")} · {stateLeaders} {t("org.leadersShort")}
                        </p>
                      </div>
                    </div>
                    {state.townships.map((town) => (
                      <details class="org-township" open={town.cells.length <= 4}>
                        <summary>
                          <span class="org-township-name">{town.name}</span>
                          <span class="muted small">{town.cells.length} {t("org.cells")}</span>
                          <span class="chev" aria-hidden="true">▾</span>
                        </summary>
                        {townshipSupervision(town)}
                        <div class="org-cell-list">
                          {town.cells.map((cell) => (
                            <div class="org-cell-row">
                              <div class="org-cell-name">
                                <LeaderAvatar leader={leadCode ? homeRole(cell.id, leadCode) : null} size="sm" />
                                <a href={cellHref(cell.id)}>{cell.label}</a>
                                {cell.code && <span class="org-code">{cell.code}</span>}
                              </div>
                              {cellRoles(cell, "row")}
                              <a class="org-cell-count" href={cellHref(cell.id)}>
                                {cell.member_count} {t("org.membersShort")}
                              </a>
                            </div>
                          ))}
                        </div>
                      </details>
                    ))}
                  </section>
                );
              })}
            </div>
          )}
        </>
      ) : tab === "regional" ? (
        <>
          <section class="org-departments">
            <div class="org-section-head">
              <div>
                <h2>{t("org.regionalTitle")}</h2>
                <p class="muted small">{t("org.regionalIntro")}</p>
              </div>
              {canManageStructure && (
                <a class="btn secondary sm" href="/organization/regional-churches">{t("org.manageRegional")}</a>
              )}
            </div>

            {regionalChurches.length === 0 ? (
              <div class="card org-empty org-empty-small">
                <p class="muted">{t("org.noRegional")}</p>
                {canManageStructure && (
                  <a class="btn secondary sm" href="/organization/regional-churches">{t("org.addRegional")}</a>
                )}
              </div>
            ) : (
              <div class="org-grid org-dept-grid">
                {regionalChurches.map((church) => {
                  const churchCells = cells.filter((c) => c.regional_church_id === church.id);
                  const churchMembers = churchCells.reduce((sum, c) => sum + c.member_count, 0);
                  const lead = regionalRows.lead ? regionalRole(church.id, regionalRows.lead.code) : null;
                  return (
                    <article class="card org-dept-card org-regional-card">
                      <div class="org-dept-head">
                        <LeaderAvatar leader={lead} size="md" />
                        <div class="org-dept-title">
                          <h3>{regionalChurchName(church, L)}</h3>
                          <span class="muted small">
                            {churchCells.length} {t("org.cells")} · {churchMembers} {t("org.membersShort")}
                          </span>
                        </div>
                      </div>
                      {regionalRows.lead && (
                        <div class="org-dept-lead">
                          <span class="org-node-role">{positionDefLabel(regionalRows.lead, L)}</span>
                          <LeaderLink leader={lead} empty={t("org.vacant")} />
                        </div>
                      )}
                      <div class="org-mini-list">
                        {regionalRows.rest.map((p) => {
                          const member = regionalRole(church.id, p.code);
                          return (
                            <div class={`org-mini${member ? "" : " org-vacant"}`}>
                              <LeaderAvatar leader={member} size="sm" />
                              <div>
                                <span class="org-mini-role">{positionDefLabel(p, L)}</span>
                                <LeaderLink leader={member} empty={t("org.vacant")} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {churchCells.length === 0 ? (
                        <p class="muted small org-regional-empty">{t("org.regionalNoCells")}</p>
                      ) : (
                        <div class="org-regional-groups">
                          {groupByTownship(churchCells, t("org.townshipUnassigned")).map((town) => (
                            <div class="org-regional-township">
                              <div class="org-regional-township-head">
                                <span class="org-township-name">{town.name}</span>
                                <span class="muted small">{town.cells.length} {t("org.cells")}</span>
                              </div>
                              {townshipSupervision(town)}
                              <div class="org-regional-cells">
                                {town.cells.map((cell) => (
                                  <div class="org-regional-cell">
                                    <a href={cellHref(cell.id)}>{cell.label}</a>
                                    {cellRows.lead && (
                                      <span class="org-regional-cell-lead">
                                        <LeaderLink leader={homeRole(cell.id, cellRows.lead.code)} empty={t("org.noLeader")} />
                                      </span>
                                    )}
                                    <span class="muted small">
                                      {cell.member_count} {t("org.membersShort")}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {(() => {
            const unassigned = cells.filter((c) => c.regional_church_id == null);
            if (unassigned.length === 0) return null;
            return (
              <section class="card org-unassigned">
                <div class="org-section-head">
                  <div>
                    <h2>{t("org.regionalUnassigned")}</h2>
                    <p class="muted small">{t("org.regionalUnassignedHint")}</p>
                  </div>
                </div>
                <div class="org-cell-list">
                  {unassigned.map((cell) => (
                    <div class="org-cell-row">
                      <div class="org-cell-name">
                        <a href={cellHref(cell.id)}>{cell.label}</a>
                        {cell.code && <span class="org-code">{cell.code}</span>}
                      </div>
                      <span class="muted small">
                        {L !== "mm" && cell.state_name_en ? cell.state_name_en : cell.state_name}
                        {cell.township ? ` · ${cell.township}` : ""}
                      </span>
                      <a class="org-cell-count" href={cellHref(cell.id)}>
                        {cell.member_count} {t("org.membersShort")}
                      </a>
                    </div>
                  ))}
                </div>
              </section>
            );
          })()}
        </>
      ) : cells.length === 0 ? (
        <div class="card org-empty">
          <h2>{t("org.emptyTitle")}</h2>
          <p class="muted">{t("org.emptyBody")}</p>
          {canManageOptions && <a class="btn secondary" href="/admin/options?type=home_cell">{t("org.manageCells")}</a>}
        </div>
      ) : (
          <div class="org-state-list">{states.map(renderStateHierarchy)}</div>
      )}
    </Layout>
  );
}
