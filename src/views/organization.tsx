import { Layout, type Flash } from "./layout";
import type { SessionUser } from "../session";
import { getDict, type Lang } from "../i18n";
import { positionDefLabel, defsForScope, leadDef, type PositionDefRow } from "../position-catalog";
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
  church_ids?: string | null;
};

export type OrgLeader = {
  position: string;
  scope_type: string;
  scope_id: number | null;
  department_id: number | null;
  regional_church_id: number | null;
  supervision_cluster_id: number | null;
  member_id: number | null;
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
      {leader.has_photo && leader.member_id
        ? <img src={`/members/${leader.member_id}/photo?v=${leader.updated_at}`} alt="" loading="lazy" />
        : initialOf(leader.member_name)}
    </span>
  );
}

function LeaderLink(props: { leader: OrgLeader | null; empty: string; photoPreview?: boolean; link?: boolean }) {
  const { leader, empty, photoPreview, link = true } = props;
  if (!leader) return <span class="muted">{empty}</span>;
  const previewUrl = photoPreview && leader.has_photo && leader.member_id
    ? `/members/${leader.member_id}/photo?v=${leader.updated_at}`
    : undefined;
  // A pastor from the separate directory has no member record to open.
  if (!leader.member_id) return <span>{leader.member_name || "—"}</span>;
  // Inside a clickable chart card a nested link is invalid HTML: the card wins.
  if (!link) return <span>{leader.member_name || "—"}</span>;
  return (
    <a href={`/members/${leader.member_id}`} data-photo-preview={previewUrl}>
      {leader.member_name || "—"}
    </a>
  );
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

/**
 * Role rows for a scope, lead position first. The lead is the first position that
 * is not nested under another one, so a newly added sub-role can never take the
 * top slot just because it sorts early.
 */
function positionRows(defs: PositionDefRow[], scope: Parameters<typeof defsForScope>[1], lang: Lang) {
  const rows = defsForScope(defs, scope);
  const lead = leadDef(rows);
  return { lead, rest: rows.filter((r) => r !== lead), all: rows };
}

export function OrganizationPage(props: Common & {
  tab: "church" | "main" | "home-cells" | "regional";
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
  /** Church selected for the Church Leadership panel (query ?church=). */
  selectedChurchId?: number | null;
  /** State/Region filter for the Regional Churches tab (query ?region=). */
  region?: number | null;
}) {
  const {
    user, perms, flash, lang, tab, cells, departments, leaders,
    regionalChurches, clusters, positionDefs, canManageDepartments, canManageStructure,
    canManageClusters, canManagePositions, unassignedMembers, selectedChurchId, region,
  } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const mainChurches = regionalChurches.filter((c) => c.isMain === 1);
  const allRegional = regionalChurches.filter((c) => c.isMain !== 1);
  const regionalOnly = region == null ? allRegional : allRegional.filter((c) => c.regionId === region);
  const regionalStateOptions = (() => {
    const seen = new Map<number, string>();
    for (const church of allRegional) {
      if (!seen.has(church.regionId)) {
        seen.set(church.regionId, L !== "mm" && church.stateNameEn ? church.stateNameEn : church.stateName);
      }
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  })();
  const selectedChurch = regionalOnly.find((c) => c.id === selectedChurchId)
    ?? regionalOnly[0] ?? null;
  const churchScoped = tab === "church" && selectedChurch != null;
  const scopedCells = churchScoped
    ? cells.filter((c) => c.regional_church_id === selectedChurch.id)
    : cells;
  const scopedDepartments = churchScoped
    ? departments.filter((d) => (d.church_ids ?? "").split(",").includes(String(selectedChurch.id)))
    : departments;
  const states = groupCells(scopedCells, clusters, L);
  const clusterCount = states.reduce((sum, state) => sum + state.groups.length, 0);
  const orderedChurches = regionalOnly;
  const regionalStates = (() => {
    const groups = new Map<number, { id: number; name: string; churches: RegionalChurchRow[] }>();
    for (const church of regionalOnly) {
      let group = groups.get(church.regionId);
      if (!group) {
        group = {
          id: church.regionId,
          name: L !== "mm" && church.stateNameEn ? church.stateNameEn : church.stateName,
          churches: [],
        };
        groups.set(church.regionId, group);
      }
      group.churches.push(church);
    }
    return [...groups.values()];
  })();
  const members = cells.reduce((sum, c) => sum + c.member_count, 0);
  const leadCode = positionRows(positionDefs, "home_cell", L).lead?.code ?? "";
  const withLeader = leadCode
    ? cells.filter((c) => leaderFor(leaders, "home_cell", leadCode, { scopeId: c.id })).length
    : 0;
  const canEdit = perms.has("members.update");
  const canManageOptions = perms.has("options.manage");
  const cellHref = (id: number) => `/members?home_cell=${id}`;

  const churchRows = positionRows(positionDefs, "church", L);
  const selectedChurchCellCount = selectedChurch
    ? cells.filter((c) => c.regional_church_id === selectedChurch.id).length
    : 0;
  const selectedChurchFilled = selectedChurch
    ? churchRows.all.filter((p) =>
      leaderFor(leaders, "church", p.code, { regionalChurchId: selectedChurch.id })).length
    : 0;
  const cellRows = positionRows(positionDefs, "home_cell", L);
  const regionalRows = positionRows(positionDefs, "regional_church", L);
  const deptRows = positionRows(positionDefs, "department", L);

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

  const renderPersonNode = (role: string, leader: OrgLeader | null, size: "lg" | "md" | "sm", lead = false) => (
    <div class={`org-node${lead ? " org-node-lead" : ""}${leader ? "" : " org-node-vacant"}`}>
      <LeaderAvatar leader={leader} size={size} />
      <span class="org-node-role">{role}</span>
      <span class="org-node-name"><LeaderLink leader={leader} empty={t("org.vacant")} /></span>
    </div>
  );

  const renderSupervisionGroup = (group: SupervisionGroup) => {
    const defs = defsForScope(positionDefs, group.kind === "cluster" ? "cluster" : "township");
    const role = (position: string) => group.kind === "cluster"
      ? clusterRole(group.id, position)
      : townshipRole(group.id, position);
    const pastor = group.kind === "cluster" ? clusterRole(group.id, "cluster_pastor") : null;
    const supervisor = leadDef(defs);
    const assistants = defs.filter((d) => d !== supervisor);
    return (
      <details class="org-flow-cluster">
        <summary class="org-flow-cluster-head">
          <span class="org-flow-cluster-title">
            <span class="org-supervision-title">{group.kind === "cluster" ? t("org.clusterLabel") : t("org.townshipSupervision")}</span>
            <span class="org-flow-cluster-name">{group.name}</span>
          </span>
          <span class="org-flow-cluster-meta">
            <span class="muted small">{group.cells.length} {t("org.cells")}</span>
            <span class="org-flow-chev" aria-hidden="true">▾</span>
          </span>
        </summary>
        <div class="org-flow-cluster-body">
          <div class="org-flow-pastor">
            {renderPersonNode(t("org.clusterPastor"), pastor, "md", true)}
          </div>
          <div class="org-flow-line" aria-hidden="true" />
          <div class="org-flow-cluster-team">
            {supervisor && renderPersonNode(positionDefLabel(supervisor, L), role(supervisor.code), "md", true)}
            {assistants.map((def) => renderPersonNode(positionDefLabel(def, L), role(def.code), "sm"))}
          </div>
          <div class="org-flow-line" aria-hidden="true" />
          <div class="org-flow-cells">
          {group.cells.map((cell) => (
            <article class="org-flow-cell">
              <div class="org-flow-cell-head">
                <LeaderAvatar leader={cellRows.lead ? homeRole(cell.id, cellRows.lead.code) : null} size="sm" />
                <div class="org-flow-cell-main">
                  <a href={cellHref(cell.id)}>{cell.label}</a>
                  <span class="muted small">
                    {cell.township ? `${cell.township} · ` : ""}{cell.member_count} {t("org.membersShort")}
                  </span>
                </div>
              </div>
              <div class="org-flow-cell-roles">
                {cellRows.all.map((p) => (
                  <span class="org-flow-role">
                    <span class="org-role-label">{positionDefLabel(p, L)}</span>
                    <LeaderLink
                      leader={homeRole(cell.id, p.code)}
                      empty={p.code === cellRows.lead?.code ? t("org.noLeader") : t("org.vacant")}
                      photoPreview
                    />
                  </span>
                ))}
              </div>
            </article>
          ))}
          </div>
        </div>
      </details>
    );
  };

  const renderChurchChart = (church: RegionalChurchRow, tab: "church" | "main") => {
    const role = (position: string) =>
      leaderFor(leaders, "church", position, { regionalChurchId: church.id });
    const assignHref = (position: string) => {
      const params = new URLSearchParams({ tab, church: String(church.id), position });
      return `/organization/assign?${params.toString()}`;
    };
    const assignTitle = (p: PositionDefRow, leader: OrgLeader | null) =>
      `${leader ? t("org.changeLeader") : t("org.assignLeader")} · ${positionDefLabel(p, L)}`;

    // Every slot opens the dialog when the user may edit: vacant to assign, filled
    // to change or clear. The dialog itself decides what to offer.
    const node = (p: PositionDefRow, leader: OrgLeader | null, size: "lg" | "md", isLead = false) => {
      const cls = `org-node${isLead ? " org-node-lead" : ""}${leader ? "" : " org-node-vacant"}`;
      const body = (
        <>
          <LeaderAvatar leader={leader} size={size} />
          <span class="org-node-role">{positionDefLabel(p, L)}</span>
          <span class="org-node-name">
            <LeaderLink leader={leader} empty={t("org.vacant")} link={!canEdit} />
          </span>
        </>
      );
      if (canEdit) {
        return (
          <a class={`${cls} org-node-action js-edit-modal`} href={assignHref(p.code)}
            data-modal-title={assignTitle(p, leader)} data-modal-size="md"
            aria-label={assignTitle(p, leader)}>{body}</a>
        );
      }
      return <div class={cls}>{body}</div>;
    };

    // Positions nest by parent_code. A position with no parent still sits under
    // the lead slot, so the familiar lead-plus-team chart stays intact and only
    // an explicit parent moves a slot deeper.
    const byCode = new Map(churchRows.all.map((d) => [d.code, d]));
    const leadCode = churchRows.lead?.code ?? null;
    const parentOf = (def: PositionDefRow): string | null => {
      if (def.code === leadCode) return null;
      if (def.parentCode && byCode.has(def.parentCode) && def.parentCode !== def.code) return def.parentCode;
      return leadCode && byCode.has(leadCode) ? leadCode : null;
    };
    const kids = new Map<string, PositionDefRow[]>();
    const roots: PositionDefRow[] = [];
    for (const def of churchRows.all) {
      const parent = parentOf(def);
      if (parent) {
        const list = kids.get(parent) ?? [];
        list.push(def);
        kids.set(parent, list);
      } else {
        roots.push(def);
      }
    }
    const branch = (def: PositionDefRow) => {
      const children = kids.get(def.code) ?? [];
      const isLead = def.code === churchRows.lead?.code;
      return (
        <div class="org-branch">
          {node(def, role(def.code), isLead ? "lg" : "md", isLead)}
          {children.length > 0 && (
            <div class="org-branch-kids">{children.map((child) => branch(child))}</div>
          )}
        </div>
      );
    };

    const filled = churchRows.all.filter((p) => role(p.code)).length;
    // Nothing assigned: four empty cards say less than one prompt with the action.
    if (churchRows.all.length > 0 && filled === 0) {
      return (
        <div class="org-vacant-state">
          <div>
            <h3>{t("org.allVacant")}</h3>
            <p class="muted small">{t("org.allVacantHint")}</p>
            {/* Keep the slots themselves visible so the hierarchy still reads as a structure. */}
            <ul class="org-vacant-roles">
              {churchRows.all.map((p) => (
                <li>{positionDefLabel(p, L)}</li>
              ))}
            </ul>
          </div>
          <div class="org-section-actions">
            <span class="org-vacant-count">{churchRows.all.length} {t("org.positionsVacant")}</span>
            {canEdit && churchRows.lead ? (
              <a class="btn sm js-edit-modal" href={assignHref(churchRows.lead.code)}
                data-modal-title={assignTitle(churchRows.lead, null)} data-modal-size="md">
                {t("org.assignLeader")}
              </a>
            ) : canManagePositions ? (
              <a class="btn sm secondary" href="/organization/positions?scope=church">{t("org.managePositions")}</a>
            ) : null}
          </div>
        </div>
      );
    }

    return <div class="org-forest">{roots.map((root) => branch(root))}</div>;
  };

  const renderStateHierarchy = (state: StateGroup) => {
    const stateMembers = state.cells.reduce((sum, cell) => sum + cell.member_count, 0);
    return (
      <section class="org-flow-state">
        <div class="org-flow-state-head">
          <span class="org-flow-state-name">{state.name}</span>
          <span class="muted small">
            {state.cells.length} {t("org.cells")} · {stateMembers} {t("org.membersShort")}
          </span>
        </div>
        <div class="org-flow-clusters">
          {state.groups.map(renderSupervisionGroup)}
        </div>
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
      </div>

      <div class="page-toolbar">
        <div class="tabs">
          <a class={`btn sm ${tab === "church" ? "" : "secondary"}`} href="/organization"
            aria-current={tab === "church" ? "page" : undefined}>{t("org.churchTab")}</a>
          <a class={`btn sm ${tab === "main" ? "" : "secondary"}`} href="/organization?tab=main"
            aria-current={tab === "main" ? "page" : undefined}>{t("org.mainChurch")}</a>
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

            {orderedChurches.length > 0 && selectedChurch && (
              <div class="org-church-switcher">
                <form method="get" action="/organization" data-auto-submit="1">
                  <input type="hidden" name="tab" value="church" />
                  <label class="org-church-control">
                    <span class="org-church-kicker">{t("org.selectChurch")}</span>
                    <select name="church" aria-label={t("org.selectChurch")}>
                      {regionalStates.map((state) => (
                        <optgroup label={state.name}>
                          {state.churches.map((church) => (
                            <option value={String(church.id)} selected={selectedChurch.id === church.id}>
                              {regionalChurchName(church, L)}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                </form>
                <div class="org-church-facts">
                  <span class="org-church-fact org-church-state">
                    {L !== "mm" && selectedChurch.stateNameEn ? selectedChurch.stateNameEn : selectedChurch.stateName}
                  </span>
                  <span class="org-church-fact"><b>{selectedChurchCellCount}</b> {t("org.cells")}</span>
                  {churchRows.all.length > 0 && (
                    <span class="org-church-fact">
                      <b>{selectedChurchFilled}</b> / {churchRows.all.length} {t("dept.rolesFilled")}
                    </span>
                  )}
                </div>
              </div>
            )}

            {!selectedChurch ? (
              <p class="muted">{t("org.noRegional")}</p>
            ) : renderChurchChart(selectedChurch, "church")}
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

            {scopedDepartments.length === 0 ? (
              <div class="card org-empty org-empty-small">
                <p class="muted">
                  {churchScoped ? t("org.noChurchDepartments") : t("org.noDepartments")}
                </p>
                {canManageDepartments && (
                  <a class="btn secondary sm" href="/organization/departments">{t("org.addDepartment")}</a>
                )}
              </div>
            ) : (
              <details class="org-collapse">
                <summary class="org-collapse-summary">
                  <span>{scopedDepartments.length} {t("org.departmentsShort")} <span class="org-collapse-hint">· {t("org.viewDetails")}</span></span>
                  <span class="chev" aria-hidden="true">▾</span>
                </summary>
                <div class="org-collapse-body">
              <div class="org-grid org-dept-grid">
                {scopedDepartments.map((d) => {
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
                      <div class="org-card-actions">
                        <a class="org-card-link" href={`/organization/departments/${d.id}`}>
                          {t("org.viewDepartment")} <span aria-hidden="true">→</span>
                        </a>
                        {canManageDepartments && (
                          <a class="org-card-link" href="/organization/departments">{t("org.editStructure")}</a>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
                </div>
              </details>
            )}
          </section>

          {scopedCells.length === 0 ? (
            <div class="card org-empty">
              <h2>{t("org.emptyTitle")}</h2>
              <p class="muted">{churchScoped ? t("org.noChurchCells") : t("org.emptyBody")}</p>
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
                      <details class="org-township">
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
      ) : tab === "main" ? (
        mainChurches.length === 0 ? (
          <div class="card org-empty">
            <h2>{t("org.mainChurch")}</h2>
            <p class="muted">{t("org.mainChurchEmpty")}</p>
            {canManageStructure && (
              <a class="btn secondary" href="/organization/regional-churches">{t("org.addRegional")}</a>
            )}
          </div>
        ) : mainChurches.map((church) => {
          const churchCells = cells.filter((c) => c.regional_church_id === church.id);
          const churchMembers = churchCells.reduce((sum, c) => sum + c.member_count, 0);
          return (
            <section class="card org-chart org-main-church">
              <div class="org-section-head">
                <div>
                  <h2>{regionalChurchName(church, L)}</h2>
                  <p class="muted small">
                    {t("org.mainChurchHint")} · {churchCells.length} {t("org.cells")} · {churchMembers} {t("org.membersShort")}
                  </p>
                </div>
                <div class="org-section-actions">
                  {canManagePositions && (
                    <a class="btn secondary sm" href="/organization/positions?scope=church">{t("org.managePositions")}</a>
                  )}
                  {canManageStructure && (
                    <a class="btn secondary sm" href="/organization/regional-churches">{t("org.editStructure")}</a>
                  )}
                </div>
              </div>
              {renderChurchChart(church, "main")}
              {churchCells.length > 0 && (
                <details class="org-collapse org-main-cells">
                  <summary class="org-collapse-summary">
                    <span>{t("org.homeCells")} · {churchCells.length}</span>
                    <span class="chev" aria-hidden="true">▾</span>
                  </summary>
                  <div class="org-collapse-body org-cell-list">
                    {groupByTownship(churchCells, t("org.townshipUnassigned")).map((town) => (
                      <div class="org-main-township">
                        <div class="org-regional-township-head">
                          <span class="org-township-name">{town.name}</span>
                          <span class="muted small">{town.cells.length} {t("org.cells")}</span>
                        </div>
                        {town.cells.map((cell) => (
                          <div class="org-cell-row">
                            <div class="org-cell-name">
                              <LeaderAvatar leader={cellRows.lead ? homeRole(cell.id, cellRows.lead.code) : null} size="sm" />
                              <a href={cellHref(cell.id)}>{cell.label}</a>
                              {cell.code && <span class="org-code">{cell.code}</span>}
                            </div>
                            <a class="org-cell-count" href={cellHref(cell.id)}>
                              {cell.member_count} {t("org.membersShort")}
                            </a>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </section>
          );
        })
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

            <form class="filters settings-filters" method="get" action="/organization" data-auto-submit="1">
              <input type="hidden" name="tab" value="regional" />
              <select name="region" aria-label={t("detail.state")}>
                <option value="" selected={region == null}>{t("org.allStates")}</option>
                {regionalStateOptions.map((r) => (
                  <option value={String(r.id)} selected={region === r.id}>{r.name}</option>
                ))}
              </select>
              <div class="actions">
                <button class="btn sm secondary" type="submit">{t("members.search")}</button>
              </div>
            </form>

            {regionalOnly.length === 0 ? (
              <div class="card org-empty org-empty-small">
                <p class="muted">{t("org.noRegional")}</p>
                {region != null ? (
                  <p class="small"><a href="/organization?tab=regional">{t("members.clearFilters")}</a></p>
                ) : canManageStructure && (
                  <a class="btn secondary sm" href="/organization/regional-churches">{t("org.addRegional")}</a>
                )}
              </div>
            ) : (
              <div class="org-region-groups">
                {regionalStates.map((state) => (
                  <section class="org-region-group">
                    <div class="org-region-group-head">
                      <h3>{state.name}</h3>
                      <span class="muted small">{state.churches.length} {t("org.churchesShort")}</span>
                    </div>
                    <div class="org-grid org-dept-grid">
                {state.churches.map((church) => {
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
                      {canManageStructure && (
                        <a class="org-card-link" href="/organization/regional-churches">
                          {t("org.editStructure")} <span aria-hidden="true">→</span>
                        </a>
                      )}
                    </article>
                  );
                })}
                    </div>
                  </section>
                ))}
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
        <section class="card org-chart org-flow">
          <div class="org-section-head">
            <div>
              <h2>{t("org.homeCellLeadership")}</h2>
              <p class="muted small">{t("org.homeCellFlowHint")}</p>
            </div>
            {clusterCount > 1 && (
              <div class="org-flow-actions">
                <button class="btn secondary sm" type="button" data-cluster-toggle="open">{t("org.expandAll")}</button>
                <button class="btn secondary sm" type="button" data-cluster-toggle="close">{t("org.collapseAll")}</button>
              </div>
            )}
          </div>

          {states.map(renderStateHierarchy)}
        </section>
      )}
    </Layout>
  );
}
