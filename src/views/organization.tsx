import { Layout, type Flash } from "./layout";
import type { SessionUser } from "../session";
import { getDict, type Lang } from "../i18n";
import { CHURCH_POSITIONS, DEPARTMENT_POSITIONS, HOME_CELL_POSITIONS, positionLabel } from "../positions";
import { departmentName } from "../departments";

export type OrgCell = {
  id: number;
  label: string;
  code: string | null;
  region_id: number;
  state_name: string;
  state_name_en: string | null;
  township: string | null;
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
  member_id: number;
  member_name: string | null;
  has_photo: number | boolean;
  updated_at: number;
};

type Common = { user: SessionUser; perms: Set<string>; flash?: Flash; lang?: Lang };

type TownshipGroup = { name: string; cells: OrgCell[] };
type StateGroup = { id: number; name: string; cells: OrgCell[]; townships: TownshipGroup[] };

function groupCells(cells: OrgCell[], lang: Lang): StateGroup[] {
  const states = new Map<number, StateGroup>();
  for (const cell of cells) {
    let state = states.get(cell.region_id);
    if (!state) {
      state = {
        id: cell.region_id,
        name: lang !== "mm" && cell.state_name_en ? cell.state_name_en : cell.state_name,
        cells: [],
        townships: [],
      };
      states.set(cell.region_id, state);
    }
    state.cells.push(cell);
  }
  for (const state of states.values()) {
    const towns = new Map<string, OrgCell[]>();
    for (const cell of state.cells) {
      const name = cell.township || "—";
      const list = towns.get(name) ?? [];
      list.push(cell);
      towns.set(name, list);
    }
    state.townships = [...towns.entries()].map(([name, list]) => ({ name, cells: list }));
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
  opts: { scopeId?: number | null; departmentId?: number | null } = {},
): OrgLeader | null {
  return leaders.find((l) =>
    l.scope_type === scopeType && l.position === position &&
    (opts.scopeId === undefined || l.scope_id === opts.scopeId) &&
    (opts.departmentId === undefined || l.department_id === opts.departmentId)
  ) ?? null;
}

export function OrganizationPage(props: Common & {
  tab: "church" | "home-cells";
  cells: OrgCell[];
  departments: OrgDepartment[];
  leaders: OrgLeader[];
  canManageDepartments: boolean;
  unassignedMembers: number;
}) {
  const { user, perms, flash, lang, tab, cells, departments, leaders, canManageDepartments, unassignedMembers } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const states = groupCells(cells, L);
  const members = cells.reduce((sum, c) => sum + c.member_count, 0);
  const withLeader = cells.filter((c) => leaderFor(leaders, "home_cell", "home_cell_leader", { scopeId: c.id })).length;
  const canEdit = perms.has("members.update");
  const canManageOptions = perms.has("options.manage");
  const cellHref = (id: number) => `/members?home_cell=${id}`;

  const churchRole = (position: string) => leaderFor(leaders, "church", position);
  const departmentRole = (departmentId: number, position: string) =>
    leaderFor(leaders, "department", position, { departmentId });
  const homeRole = (cellId: number, position: string) =>
    leaderFor(leaders, "home_cell", position, { scopeId: cellId });

  return (
    <Layout title={t("org.title")} lang={lang} user={user} perms={perms} active="/organization" flash={flash ?? null}>
      <div class="page-head">
        <h1>{t("org.title")}<span class="count-pill">{cells.length} {t("org.cells")}</span></h1>
        <a class="btn secondary" href="/members">{t("org.membersLink")}</a>
      </div>
      <p class="muted small">{t("org.intro")}</p>

      <div class="page-toolbar">
        <div class="tabs">
          <a class={`btn sm ${tab === "church" ? "" : "secondary"}`} href="/organization"
            aria-current={tab === "church" ? "page" : undefined}>{t("org.churchTab")}</a>
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
            </div>

            <div class="org-chart-level org-chart-level-top">
              {(() => {
                const leader = churchRole("church_senior_pastor");
                return (
                  <div class="org-node org-node-lead">
                    <LeaderAvatar leader={leader} size="lg" />
                    <span class="org-node-role">{positionLabel("church_senior_pastor", L)}</span>
                    <span class="org-node-name"><LeaderLink leader={leader} empty={t("org.vacant")} /></span>
                  </div>
                );
              })()}
            </div>

            <div class="org-chart-connector" aria-hidden="true" />
            <div class="org-chart-level org-chart-level-team">
              {CHURCH_POSITIONS.filter((p) => p.value !== "church_senior_pastor").map((p) => {
                const leader = churchRole(p.value);
                return (
                  <div class={`org-node${leader ? "" : " org-node-vacant"}`}>
                    <LeaderAvatar leader={leader} size="md" />
                    <span class="org-node-role">{positionLabel(p.value, L)}</span>
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
                  const head = departmentRole(d.id, "department_head");
                  const departmentLeaders = DEPARTMENT_POSITIONS
                    .filter((p) => p.value !== "department_head")
                    .map((p) => ({ position: p.value, leader: departmentRole(d.id, p.value) }));
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
                        <span class="org-node-role">{positionLabel("department_head", L)}</span>
                        <LeaderLink leader={head} empty={t("org.vacant")} />
                      </div>
                      <div class="org-mini-list">
                        {departmentLeaders.map((p) => (
                          <div class={`org-mini${p.leader ? "" : " org-vacant"}`}>
                            <LeaderAvatar leader={p.leader} size="sm" />
                            <div>
                              <span class="org-mini-role">{positionLabel(p.position, L)}</span>
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
                const stateLeaders = state.cells.filter((c) => homeRole(c.id, "home_cell_leader")).length;
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
                        <div class="org-cell-list">
                          {town.cells.map((cell) => {
                            const leader = homeRole(cell.id, "home_cell_leader");
                            return (
                              <div class="org-cell-row">
                                <div class="org-cell-name">
                                  <LeaderAvatar leader={leader} size="sm" />
                                  <a href={cellHref(cell.id)}>{cell.label}</a>
                                  {cell.code && <span class="org-code">{cell.code}</span>}
                                </div>
                                <div class="org-cell-leader">
                                  {leader ? (
                                    <>
                                      <span class="org-role-label">{t("org.leader")}</span>
                                      <LeaderLink leader={leader} empty={t("org.noLeader")} />
                                    </>
                                  ) : (
                                    <span class="badge inactive">{t("org.noLeader")}</span>
                                  )}
                                </div>
                                <a class="org-cell-count" href={cellHref(cell.id)}>
                                  {cell.member_count} {t("org.membersShort")}
                                </a>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    ))}
                  </section>
                );
              })}
            </div>
          )}
        </>
      ) : cells.length === 0 ? (
        <div class="card org-empty">
          <h2>{t("org.emptyTitle")}</h2>
          <p class="muted">{t("org.emptyBody")}</p>
          {canManageOptions && <a class="btn secondary" href="/admin/options?type=home_cell">{t("org.manageCells")}</a>}
        </div>
      ) : (
        <div class="org-grid">
          {cells.map((cell) => {
            const leader = homeRole(cell.id, "home_cell_leader");
            return (
              <article class="card org-card org-cell-card">
                <div class="org-cell-card-head">
                  <LeaderAvatar leader={leader} size="lg" />
                  <div>
                    <h3><a href={cellHref(cell.id)}>{cell.label}</a></h3>
                    <p class="muted small">
                      {L !== "mm" && cell.state_name_en ? cell.state_name_en : cell.state_name}
                      {cell.township ? ` · ${cell.township}` : ""}
                    </p>
                    <span class="org-member-count">
                      {cell.member_count} {t("org.membersShort")}
                    </span>
                  </div>
                </div>
                <div class="org-cell-lead">
                  <span class="org-role-label">{positionLabel("home_cell_leader", L)}</span>
                  <LeaderLink leader={leader} empty={t("org.noLeader")} />
                </div>
                <div class="org-mini-list">
                  {HOME_CELL_POSITIONS.filter((p) => p.value !== "home_cell_leader").map((p) => {
                    const member = homeRole(cell.id, p.value);
                    return (
                      <div class={`org-mini${member ? "" : " org-vacant"}`}>
                        <LeaderAvatar leader={member} size="sm" />
                        <div>
                          <span class="org-mini-role">{positionLabel(p.value, L)}</span>
                          <LeaderLink leader={member} empty={t("org.vacant")} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div class="org-card-foot">
                  <a class="org-cell-count" href={cellHref(cell.id)}>
                    {cell.member_count} {t("org.membersShort")} →
                  </a>
                  {canEdit && <a class="small" href={cellHref(cell.id)}>{t("org.viewMembers")}</a>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
