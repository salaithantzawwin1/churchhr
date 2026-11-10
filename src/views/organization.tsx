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
  leader_name: string | null;
  assistant_name: string | null;
  secretary_name: string | null;
  treasurer_name: string | null;
};

export type OrgDepartment = {
  id: number;
  name: string;
  name_en: string | null;
  sort_order: number;
  head_name: string | null;
  assistant_name: string | null;
  secretary_name: string | null;
  treasurer_name: string | null;
};

export type OrgChurchLeader = {
  position: string;
  member_id: number;
  member_name: string | null;
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

function departmentRoleName(department: OrgDepartment, position: string): string | null {
  if (position === "department_head") return department.head_name;
  if (position === "department_assistant") return department.assistant_name;
  if (position === "department_secretary") return department.secretary_name;
  if (position === "department_treasurer") return department.treasurer_name;
  return null;
}

function roleName(cell: OrgCell, position: string): string | null {
  if (position === "home_cell_leader") return cell.leader_name;
  if (position === "home_cell_assistant") return cell.assistant_name;
  if (position === "home_cell_secretary") return cell.secretary_name;
  if (position === "home_cell_treasurer") return cell.treasurer_name;
  return null;
}

export function OrganizationPage(props: Common & {
  tab: "church" | "home-cells";
  cells: OrgCell[];
  departments: OrgDepartment[];
  churchLeaders: OrgChurchLeader[];
  canManageDepartments: boolean;
  unassignedMembers: number;
}) {
  const { user, perms, flash, lang, tab, cells, departments, churchLeaders, canManageDepartments, unassignedMembers } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const states = groupCells(cells, L);
  const members = cells.reduce((sum, c) => sum + c.member_count, 0);
  const withLeader = cells.filter((c) => Boolean(c.leader_name)).length;
  const canEdit = perms.has("members.update");
  const canManageOptions = perms.has("options.manage");
  const cellHref = (id: number) => `/members?home_cell=${id}`;

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
          <section class="card org-leadership">
            <div class="org-section-head">
              <div>
                <h2>{t("org.churchLeadership")}</h2>
                <p class="muted small">{t("org.churchLeadershipHint")}</p>
              </div>
            </div>
            <div class="org-lead-grid">
              {CHURCH_POSITIONS.map((p) => {
                const leader = churchLeaders.find((l) => l.position === p.value);
                return (
                  <div class={`org-lead${leader ? "" : " org-vacant"}`}>
                    <span class="org-lead-role">{positionLabel(p.value, L)}</span>
                    {leader
                      ? <a href={`/members/${leader.member_id}`}>{leader.member_name || "—"}</a>
                      : <span class="muted">{t("org.vacant")}</span>}
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
                {departments.map((d) => (
                  <article class="card org-card org-dept-card">
                    <div class="org-card-head">
                      <h3>{departmentName(d, L)}</h3>
                      <span class="org-code">{t("org.department")}</span>
                    </div>
                    <dl class="org-roles">
                      {DEPARTMENT_POSITIONS.map((p) => {
                        const name = departmentRoleName(d, p.value);
                        return (
                          <div class={name ? "" : "org-vacant"}>
                            <dt>{positionLabel(p.value, L)}</dt>
                            <dd>{name || "—"}</dd>
                          </div>
                        );
                      })}
                    </dl>
                  </article>
                ))}
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
                const stateLeaders = state.cells.filter((c) => Boolean(c.leader_name)).length;
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
                          {town.cells.map((cell) => (
                            <div class="org-cell-row">
                              <div class="org-cell-name">
                                <a href={cellHref(cell.id)}>{cell.label}</a>
                                {cell.code && <span class="org-code">{cell.code}</span>}
                              </div>
                              <div class="org-cell-leader">
                                {cell.leader_name ? (
                                  <>
                                    <span class="org-role-label">{t("org.leader")}</span>
                                    <span>{cell.leader_name}</span>
                                  </>
                                ) : (
                                  <span class="badge inactive">{t("org.noLeader")}</span>
                                )}
                              </div>
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
      ) : cells.length === 0 ? (
        <div class="card org-empty">
          <h2>{t("org.emptyTitle")}</h2>
          <p class="muted">{t("org.emptyBody")}</p>
          {canManageOptions && <a class="btn secondary" href="/admin/options?type=home_cell">{t("org.manageCells")}</a>}
        </div>
      ) : (
        <div class="org-grid">
          {cells.map((cell) => (
            <article class="card org-card">
              <div class="org-card-head">
                <div>
                  <h3><a href={cellHref(cell.id)}>{cell.label}</a></h3>
                  <p class="muted small">
                    {L !== "mm" && cell.state_name_en ? cell.state_name_en : cell.state_name}
                    {cell.township ? ` · ${cell.township}` : ""}
                  </p>
                </div>
                {cell.code && <span class="org-code">{cell.code}</span>}
              </div>
              <dl class="org-roles">
                {HOME_CELL_POSITIONS.map((p) => {
                  const name = roleName(cell, p.value);
                  return (
                    <div class={name ? "" : "org-vacant"}>
                      <dt>{positionLabel(p.value, L)}</dt>
                      <dd>{name || "—"}</dd>
                    </div>
                  );
                })}
              </dl>
              <div class="org-card-foot">
                <a class="org-cell-count" href={cellHref(cell.id)}>
                  {cell.member_count} {t("org.membersShort")} →
                </a>
                {canEdit && <a class="small" href={cellHref(cell.id)}>{t("org.viewMembers")}</a>}
              </div>
            </article>
          ))}
        </div>
      )}
    </Layout>
  );
}
