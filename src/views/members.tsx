import { Layout } from "./layout";
import type { Flash } from "./layout";
import type { SessionUser } from "../session";
import type { OptionRow } from "../lookup";
import { ageFromDate, optionLabel, optionText, qs } from "../util";
import { BLOOD_TYPES, GENDERS, GENDERS_EN, GENDERS_KR, MARITAL_STATUSES, MARITAL_STATUSES_EN, MARITAL_STATUSES_KR, STATUSES, STATUSES_EN, STATUSES_KR } from "../enums";
import { getDict, type Lang } from "../i18n";
import { positionLabels } from "../positions";
import { defsForScope, positionDefLabel, positionLabelForCode, positionLabelsForCsv, type PositionDefRow } from "../position-catalog";
import { clusterName, regionalChurchName, type RegionalChurchRow, type SupervisionClusterRow } from "../org-units";
import { departmentName, type DepartmentRow } from "../departments";
import { EditIcon, TrashIcon } from "./action-icons";

export type MemberListItem = {
  id: number;
  member_code: string | null;
  name_myanmar: string | null;
  name_english: string | null;
  gender: string;
  phone: string | null;
  state_name: string;
  state_name_en?: string | null;
  home_cell: string | null;
  home_cell_id?: number | null;
  positions?: string | null;
  group_label: string | null;
  status: string;
  date_of_birth: string | null;
  marital_status: string;
  township: string | null;
  family_group: string | null;
  family_group_code?: string | null;
  fellowship: string | null;
  sector: string | null;
  has_photo?: number | boolean;
  updated_at?: number;
};

export type Filters = {
  q: string;
  state: number | null;
  gender: string;
  status: string;
  homeCell: number | null;
  department: number | null;
  group: number | null;
  fellowship: number | null;
  /** Dashboard Age Group drill-down; narrows to that group's age range. */
  ageGroup: number | null;
};

type Common = { user: SessionUser; perms: Set<string>; flash?: Flash; lang?: Lang };
type ListProps = Common & {
  rows: MemberListItem[];
  total: number;
  page: number;
  pages: number;
  filters: Filters;
  sort: string;
  dir: "asc" | "desc";
  regions: { id: number; name: string }[];
  homeCells: OptionRow[];
  departments: DepartmentRow[];
  groups: OptionRow[];
  fellowships: OptionRow[];
  positionDefs?: PositionDefRow[];
  /** Resolved Age Group behind the age_group filter, for the chip label. */
  ageGroup?: { name: string; min_age: number; max_age: number } | null;
};

function filterQs(f: Filters, page?: number): string {
  return qs({
    q: f.q, state: f.state, gender: f.gender, status: f.status,
    home_cell: f.homeCell, department: f.department, group: f.group, fellowship: f.fellowship,
    age_group: f.ageGroup, page: page ?? null,
  });
}

/** True when any list filter is narrowing the result set. */
function hasFilters(f: Filters): boolean {
  return Boolean(f.q.trim() || f.state || f.gender || f.status || f.homeCell || f.department || f.group || f.fellowship || f.ageGroup);
}

/** Filter/pagination query plus the current sort, for header sort links. */
function sortQs(f: Filters, sort: string, dir: string): string {
  const base = filterQs(f);
  const extra = `sort=${sort}&dir=${dir}`;
  return base ? `${base}&${extra}` : `?${extra}`;
}

/** Member list columns (data-col keys shared by <th>/<td> and the chooser JS). */
const SORTABLE = new Set([
  "id", "name", "gender", "age", "phone", "state", "township", "marital",
  "homeCell", "role", "group", "familyGroup", "fellowship", "sector", "status",
]);
const LIST_COLS = (t: (k: string) => string) => [
  { key: "id", label: t("members.thId") },
  { key: "name", label: t("members.thName") },
  { key: "gender", label: t("members.gender") },
  { key: "age", label: t("members.thAge") },
  { key: "phone", label: t("members.thPhone") },
  { key: "state", label: t("members.state") },
  { key: "township", label: t("members.township") },
  { key: "marital", label: t("members.thMarital") },
  { key: "homeCell", label: t("members.thHomeCell") },
  { key: "role", label: t("org.position") },
  { key: "group", label: t("members.thGroup") },
  { key: "familyGroup", label: t("members.thFamilyGroup") },
  { key: "fellowship", label: t("form.fellowship") },
  { key: "sector", label: t("form.sector") },
  { key: "status", label: t("members.status") },
];

export function MembersListPage(props: ListProps) {
  const { user, perms, flash, rows, total, page, pages, filters: f, sort, dir, regions, homeCells, departments, groups, fellowships, lang, positionDefs } = props;
  const t = getDict(lang ?? "en");
  const L = lang ?? "en";
  // Korean uses the English data labels (region names etc.); only MM differs.
  const isEn = L !== "mm";
  const G = L === "mm" ? GENDERS : L === "kr" ? GENDERS_KR : GENDERS_EN;
  const S = L === "mm" ? STATUSES : L === "kr" ? STATUSES_KR : STATUSES_EN;
  const M = L === "mm" ? MARITAL_STATUSES : L === "kr" ? MARITAL_STATUSES_KR : MARITAL_STATUSES_EN;
  const canCreate = perms.has("members.create");
  const canUpdate = perms.has("members.update");
  const canDelete = perms.has("members.delete");
  const canExport = perms.has("members.export");
  const canImport = perms.has("members.import");
  const cols = LIST_COLS(t);
  const roleLabels = (csv: string | null | undefined) =>
    positionDefs ? positionLabelsForCsv(positionDefs, csv, L) : positionLabels(csv, L);
  const roleBadges = (csv: string | null | undefined) => roleLabels(csv).map((label) => (
    <span class="badge position">{label}</span>
  ));
  const filtered = hasFilters(f);
  /** Current list query, used to build "remove this filter" links. */
  const activeParams = {
    q: f.q, state: f.state, gender: f.gender, status: f.status,
    home_cell: f.homeCell, department: f.department, group: f.group, fellowship: f.fellowship,
    age_group: f.ageGroup,
    sort: sort || null, dir: sort ? dir : null,
  };
  const withoutFilter = (key: keyof typeof activeParams) => `/members${qs({ ...activeParams, [key]: null })}`;
  const chips: { label: string; href: string }[] = [];
  if (f.q.trim()) chips.push({ label: `“${f.q.trim()}”`, href: withoutFilter("q") });
  if (f.state) {
    const region = regions.find((r) => r.id === f.state);
    if (region) chips.push({ label: region.name, href: withoutFilter("state") });
  }
  if (f.gender && G[f.gender]) chips.push({ label: G[f.gender]!, href: withoutFilter("gender") });
  if (f.status && S[f.status]) chips.push({ label: S[f.status]!, href: withoutFilter("status") });
  if (f.homeCell) {
    const cell = homeCells.find((o) => o.id === f.homeCell);
    if (cell) chips.push({ label: cell.label, href: withoutFilter("home_cell") });
  }
  if (f.department) {
    const department = departments.find((d) => d.id === f.department);
    if (department) chips.push({ label: departmentName(department, L), href: withoutFilter("department") });
  }
  if (f.group) {
    const group = groups.find((o) => o.id === f.group);
    if (group) chips.push({ label: group.label, href: withoutFilter("group") });
  }
  if (f.fellowship) {
    const fellowship = fellowships.find((o) => o.id === f.fellowship);
    if (fellowship) chips.push({ label: fellowship.label, href: withoutFilter("fellowship") });
  }
  if (f.ageGroup && props.ageGroup) {
    const g = props.ageGroup;
    chips.push({
      label: `${g.name} (${g.min_age}–${g.max_age})`,
      href: withoutFilter("age_group"),
    });
  }
  return (
    <Layout title={t("members.title")} lang={lang} user={user} perms={perms} active="/members" flash={flash ?? null}>
      <div class="page-head">
        <h1>{t("members.title")}<span class="count-pill">{total}</span></h1>
        <div class="actions" style="margin:0">
          {canImport && <a class="btn secondary" href="/members/import">{t("members.importCsv")}</a>}
          {canExport && <a class="btn secondary" href={`/members/export${filterQs(f)}`}>{t("members.exportCsv")}</a>}
          {canCreate && <a class="btn primary-action" href="/members/new">{t("members.addNew")}</a>}
        </div>
      </div>

      <details class="filter-box filter-toolbar-box" open>
      <summary>
        <span>{t("members.filters")}{chips.length > 0 && <span class="filter-count">{chips.length}</span>}</span>
        <span class="chev" aria-hidden="true">▾</span>
      </summary>
      <form class="filter-toolbar" method="get" action="/members" data-auto-submit="1">
        <input type="search" name="q" value={f.q} placeholder={t("members.searchPlaceholder")}
          aria-label={t("members.search")} enterkeyhint="search" />
        <select name="state" data-region-select="1" aria-label={t("members.state")}>
          <option value="">{t("dash.allStatesOpt")}</option>
          {regions.map((r) => (
            <option value={String(r.id)} selected={f.state === r.id}>{r.name}</option>
          ))}
        </select>
        <select name="gender" aria-label={t("members.gender")}>
          <option value="">{t("dash.allGenders")}</option>
          {Object.entries(G).map(([k, v]) => (
            <option value={k} selected={f.gender === k}>{v}</option>
          ))}
        </select>
        <select name="status" aria-label={t("members.status")}>
          <option value="">{t("members.allStatuses")}</option>
          {Object.entries(S).map(([k, v]) => (
            <option value={k} selected={f.status === k}>{v}</option>
          ))}
        </select>
        <select name="home_cell" data-region-filter="1" aria-label={t("members.thHomeCell")}>
          <option value="">{t("dash.allCells")}</option>
          {homeCells.map((o) => (
            <option value={String(o.id)} selected={f.homeCell === o.id}
              data-region={o.regionId === 0 ? "" : String(o.regionId)}>{o.label}</option>
          ))}
        </select>
        <select name="department" aria-label={t("members.department")}>
          <option value="">{t("members.allDepartments")}</option>
          {departments.map((d) => (
            <option value={String(d.id)} selected={f.department === d.id}>{departmentName(d, L)}</option>
          ))}
        </select>
        <select name="group" data-region-filter="1" aria-label={t("members.thGroup")}>
          <option value="">{t("members.allGroups")}</option>
          {groups.map((o) => (
            <option value={String(o.id)} selected={f.group === o.id}
              data-region={o.regionId === 0 ? "" : String(o.regionId)}>{o.label}</option>
          ))}
        </select>
        <select name="fellowship" aria-label={t("form.fellowship")}>
          <option value="">{t("members.allFellowships")}</option>
          {fellowships.map((o) => (
            <option value={String(o.id)} selected={f.fellowship === o.id}>{o.label}</option>
          ))}
        </select>
        {f.ageGroup && <input type="hidden" name="age_group" value={String(f.ageGroup)} />}
        {sort && <input type="hidden" name="sort" value={sort} />}
        {sort && <input type="hidden" name="dir" value={dir} />}
        {filtered && <a class="filter-clear" href="/members">{t("members.clear")}</a>}
      </form>
      </details>

      {chips.length > 0 && (
        <div class="filter-chips" aria-label={t("dash.activeFilters")}>
          {chips.map((c) => (
            <a class="filter-chip" href={c.href} aria-label={`${t("dash.removeFilter")}: ${c.label}`}>
              {c.label}<span class="chip-x" aria-hidden="true">×</span>
            </a>
          ))}
          <a class="filter-clear-all" href="/members">{t("dash.clearAll")}</a>
        </div>
      )}

      <div class="col-chooser">
        <details>
          <summary class="btn secondary sm">{t("members.cols")}</summary>
          <div class="col-menu">
            {cols.map((c) => (
              <label>
                <input type="checkbox" data-col={c.key} checked={c.key !== "id"} /> {c.label}
              </label>
            ))}
          </div>
        </details>
      </div>

      {(canDelete || canUpdate) && (
        <form method="post" action="/members/bulk" id="bulk-form">
          <input type="hidden" name="ids" value="" id="bulk-ids" />
          <div class="card" id="bulk-bar" data-selected-label={t("bulk.selected")} style="display:none;align-items:center;gap:10px;flex-wrap:wrap">
            <strong class="small bulk-count" id="bulk-count">0</strong>
            <select name="bulk_action" aria-label={t("bulk.action")}>
              <option value="">{t("bulk.action")}</option>
              <option value="status_active">{t("bulk.statusActive")}</option>
              <option value="status_inactive">{t("bulk.statusInactive")}</option>
              <option value="delete">{t("members.delete")}</option>
            </select>
            <select name="group_id" aria-label={t("bulk.assignGroupOpt")}>
              <option value="">{t("bulk.assignGroupOpt")}</option>
              {groups.map((o) => <option value={String(o.id)}>{o.label}</option>)}
            </select>
            <select name="department_id" aria-label={t("bulk.assignDepartmentOpt")}>
              <option value="">{t("bulk.assignDepartmentOpt")}</option>
              {departments.map((d) => <option value={String(d.id)}>{departmentName(d, L)}</option>)}
            </select>
            <button class="btn sm" type="submit" data-confirm={t("bulk.confirm")}>{t("bulk.apply")}</button>
            <button class="btn sm secondary" type="button" data-bulk-clear="1">{t("members.clear")}</button>
          </div>
      <p class="scroll-hint" aria-hidden="true"><span>↔</span> {t("members.scrollHint")}</p>
      <div class="tbl-wrap">
        <table class="list-tbl">
          <thead>
            <tr>
              <th style="width:28px"><input type="checkbox" id="bulk-check-all" aria-label={t("members.selectAll")} /></th>
              {cols.map((c) => {
                // Server-side sort: header links toggle asc/desc and keep the
                // filters; the active column shows a direction arrow.
                const active = sort === c.key;
                const nextDir: "asc" | "desc" = active && dir === "asc" ? "desc" : "asc";
                return (
                  <th
                    data-col={c.key}
                    class={active ? "sorted" : ""}
                    aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <a class="th-sort" href={`/members${sortQs(f, c.key, nextDir)}`}>
                      {c.label}{active && <span class="sort-ind" aria-hidden="true">{dir === "asc" ? " ▲" : " ▼"}</span>}
                    </a>
                  </th>
                );
              })}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols.length + 2} class="empty-state">
                  {filtered ? (
                    <>
                      <strong>{t("members.emptyFiltered")}</strong>
                      <div class="small"><a href="/members">{t("members.clearFilters")}</a></div>
                    </>
                  ) : (
                    <>
                      <strong>{t("members.empty")}</strong>
                      {canCreate && <div class="small">{t("members.emptyHint")}</div>}
                    </>
                  )}
                </td>
              </tr>
            )}
            {rows.map((m) => (
              <tr>
                <td style="width:28px"><input type="checkbox" class="bulk-check" value={String(m.id)} aria-label={m.name_myanmar || m.name_english || `#${m.id}`} /></td>
                <td data-col="id">{m.member_code ?? `#${m.id}`}</td>
                <td data-col="name">
                  {m.has_photo ? (
                    <img class="list-avatar" src={`/members/${m.id}/photo?v=${m.updated_at ?? ""}`} alt="" width="28" height="28" loading="lazy" />
                  ) : null}
                  <a href={`/members/${m.id}`}>{m.name_myanmar || m.name_english || t("members.noName")}</a>
                  {m.name_myanmar && m.name_english && <span class="muted small" style="margin-left:6px">{m.name_english}</span>}
                  {(m.positions || canUpdate) && (
                    <span class="member-role-inline">
                      {roleBadges(m.positions)}
                      {canUpdate && (
                        <a class="position-edit js-edit-modal" href={`/members/${m.id}/position`}
                          data-modal-title={t("org.assignTitle")} data-modal-size="md">
                          {m.positions ? t("org.change") : t("org.assign")}
                        </a>
                      )}
                    </span>
                  )}
                </td>
                <td data-col="gender">{m.gender ? (G[m.gender] ?? m.gender) : ""}</td>
                <td data-col="age">{ageFromDate(m.date_of_birth) ?? ""}</td>
                <td data-col="phone">{m.phone ?? ""}</td>
                <td data-col="state">{isEn && m.state_name_en ? m.state_name_en : m.state_name}</td>
                <td data-col="township">{m.township ?? ""}</td>
                <td data-col="marital">{m.marital_status ? (M[m.marital_status] ?? m.marital_status) : ""}</td>
                <td data-col="homeCell">{m.home_cell ?? ""}</td>
                <td data-col="role" class="position-cell">
                  {m.positions ? roleBadges(m.positions) : <span class="muted small">—</span>}
                  {canUpdate && (
                    <a
                      class="position-edit js-edit-modal"
                      href={`/members/${m.id}/position`}
                      data-modal-title={t("org.assignTitle")}
                      data-modal-size="sm"
                    >{m.positions ? t("org.change") : t("org.assign")}</a>
                  )}
                </td>
                <td data-col="group">{m.group_label ?? ""}</td>
                <td data-col="familyGroup">{optionLabel(m.family_group_code, m.family_group)}</td>
                <td data-col="fellowship">{m.fellowship ?? ""}</td>
                <td data-col="sector">{m.sector ?? ""}</td>
                <td data-col="status"><span class={`badge ${m.status}`}>{S[m.status] ?? m.status}</span></td>
                <td class="row-actions-cell">
                  <div class="row-icon-actions">
                    {perms.has("members.update") && (
                      <a class="btn sm secondary icon-btn js-edit-modal" href={`/members/${m.id}/edit`}
                        data-modal-title={t("form.editTitle")} title={t("members.edit")} aria-label={t("members.edit")}>
                        <EditIcon />
                      </a>
                    )}
                    {canDelete && (
                      <form method="post" action={`/members/${m.id}/delete`} data-confirm={t("detail.confirmDelete")}>
                        <button class="btn sm danger icon-btn" type="submit" title={t("members.delete")} aria-label={t("members.delete")}>
                          <TrashIcon />
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        </form>
      )}

      {pages > 1 && (
        <div class="actions" style="justify-content:center">
          {page > 1 && <a class="btn secondary" href={`/members${filterQs(f, page - 1)}${sort && SORTABLE.has(sort) ? `&sort=${sort}&dir=${dir}` : ""}`}>{t("members.prev")}</a>}
          <span class="muted">{t("members.page")} {page} / {pages}</span>
          {page < pages && <a class="btn secondary" href={`/members${filterQs(f, page + 1)}${sort && SORTABLE.has(sort) ? `&sort=${sort}&dir=${dir}` : ""}`}>{t("members.next")}</a>}
        </div>
      )}
    </Layout>
  );
}

export type FormValues = Record<string, string>;
type FormProps = Common & {
  values: FormValues;
  errors: string[];
  member: { id: number; photoUrl?: string } | null;
  regions: { id: number; name: string }[];
  options: Record<string, OptionRow[]>;
  departments: DepartmentRow[];
};

function opts(
  options: OptionRow[], selected: string, blank: string,
  /** township id -> label, so Home Cell options carry their township's label. */
  townshipLabelById?: Map<number, string>,
  /** Family Groups show their label only; the generated code is long/redundant. */
  labelOnly = false,
) {
  return (
    <>
      <option value="">{blank}</option>
      {options.map((o) => {
        // Home Cell parents are townships, whose select value is the label —
        // store the label so the client-side cascade can compare directly.
        let parent = o.parentId ?? "";
        if (o.type === "home_cell" && parent && townshipLabelById && o.parentId !== null) {
          parent = townshipLabelById.get(o.parentId) ?? "";
        }
        return (
          <option value={String(o.id)} selected={selected === String(o.id)}
            data-region={o.regionId === 0 ? "" : String(o.regionId)}
            data-parent={parent}>{labelOnly ? optionLabel(o.code, o.label) : optionText(o.code, o.label)}</option>
        );
      })}
    </>
  );
}

/** Township select — stores the label as free text (members.township is TEXT). */
function townshipOpts(options: OptionRow[], selected: string, blank: string) {
  return (
    <>
      <option value="">{blank}</option>
      {options.map((o) => (
        <option value={o.label} selected={selected === o.label}
          data-region={o.regionId === 0 ? "" : String(o.regionId)}
          data-parent="">{optionText(o.code, o.label)}</option>
      ))}
    </>
  );
}

function select(name: string, map: Record<string, string>, selected: string, blank: string) {
  return (
    <select name={name}>
      <option value="">{blank}</option>
      {Object.entries(map).map(([k, label]) => (
        <option value={k} selected={selected === k}>{label}</option>
      ))}
    </select>
  );
}

export function MemberFormPage(props: FormProps) {
  const { user, perms, member, lang } = props;
  const t = getDict(lang ?? "en");
  const edit = member !== null;
  return (
    <Layout title={edit ? t("form.editTitle") : t("form.newTitle")} lang={lang} user={user} perms={perms} active="/members">
      <div class="page-head">
        <h1>{edit ? t("form.editHeading") : t("form.newHeading")}</h1>
        <a class="btn secondary" href={edit ? `/members/${member.id}` : "/members"}>{t("members.back")}</a>
      </div>
      <MemberFormFragment {...props} />
    </Layout>
  );
}

/** Bare form (no Layout) — used by the full page and by the ?modal=1 edit modal. */
export function MemberFormFragment(props: FormProps & { modal?: boolean }) {
  const { values: v, errors, member, regions, options, departments, lang, modal } = props;
  const t = getDict(lang ?? "en");
  const L = lang ?? "en";
  const isEn = L !== "mm";
  const G = L === "mm" ? GENDERS : L === "kr" ? GENDERS_KR : GENDERS_EN;
  const M = L === "mm" ? MARITAL_STATUSES : L === "kr" ? MARITAL_STATUSES_KR : MARITAL_STATUSES_EN;
  const S = L === "mm" ? STATUSES : L === "kr" ? STATUSES_KR : STATUSES_EN;
  const action = member ? `/members/${member.id}` : "/members";
  const edit = member !== null;
  const photoUrl = member?.photoUrl;
  const initial = Array.from((v.name_myanmar || v.name_english || "?").trim())[0] ?? "?";
  const dob = v.date_of_birth || "";
  const townshipLabelById = new Map(
    (options.township ?? []).map((o) => [o.id, o.label] as const),
  );
  return (
    <>
      {errors.length > 0 && (
        <div class="flash err">
          <strong>{t("form.invalid")}</strong>
          <ul class="err-list">{errors.map((e) => <li>{e}</li>)}</ul>
        </div>
      )}
      <form method="post" action={action} data-flash-ok="member-updated">
        {modal && <input type="hidden" name="from_modal" value="1" />}
        <div class="card">
          <h2>{t("form.basic")}</h2>
          <div class="photo-field" data-photo-field data-initial={initial}
            data-processing={t("form.photoProcessing")} data-ready={t("form.photoReady")}
            data-error={t("form.photoError")}>
            <div class="photo-preview">
              <img data-photo-img src={photoUrl} alt="" hidden={!photoUrl} />
              <span data-photo-fallback hidden={!!photoUrl}>{initial}</span>
            </div>
            <div class="photo-controls">
              <span class="lbl">{t("form.photo")}</span>
              <div class="photo-actions">
                <label class="btn sm secondary photo-pick">
                  {t("form.photoChoose")}
                  <input type="file" accept="image/jpeg,image/png,image/webp" data-photo-input hidden />
                </label>
                {photoUrl && (
                  <label class="check-chip">
                    <input type="checkbox" name="photo_remove" value="1" data-photo-remove />
                    {t("form.photoRemove")}
                  </label>
                )}
              </div>
              <p class="hint">{t("form.photoHint")}</p>
              <p class="photo-status" data-photo-status role="status"></p>
              <input type="hidden" name="photo_data" data-photo-data />
            </div>
          </div>
          <div class="form-grid">
            <label class="field">
              <span class="lbl">{t("form.nameMm")}</span>
              <input type="text" name="name_myanmar" value={v.name_myanmar ?? ""} />
            </label>
            <label class="field">
              <span class="lbl">{t("form.nameEn")}</span>
              <input type="text" name="name_english" value={v.name_english ?? ""} />
            </label>
            <label class="field"><span class="lbl">{t("form.gender")}</span>{select("gender", G, v.gender ?? "", t("form.choose"))}</label>
            <label class="field"><span class="lbl">{t("form.marital")}</span>{select("marital_status", M, v.marital_status ?? "", t("form.choose"))}</label>
            <label class="field">
              <span class="lbl">{t("form.dob")}</span>
              <input type="date" name="date_of_birth" value={dob} />
              {dob && <span class="hint">{t("form.age")}: {ageFromDate(dob) ?? "—"}</span>}
            </label>
            <label class="field">
              <span class="lbl">{t("form.blood")}</span>
              <select name="blood_type">
                <option value="">{t("form.choose")}</option>
                {(() => {
                  // Managed options first (code · label); fall back to the
                  // std eight when none are active, merging so both show.
                  const opts = options.blood_type ?? [];
                  const rows = opts.length > 0
                    ? opts.map((o) => ({ value: o.label, text: optionText(o.code, o.label) }))
                    : BLOOD_TYPES.map((b) => ({ value: b, text: b }));
                  if (v.blood_type && !rows.some((r) => r.value === v.blood_type)) {
                    rows.push({ value: v.blood_type, text: v.blood_type });
                  }
                  return rows.map((r) => <option value={r.value} selected={v.blood_type === r.value}>{r.text}</option>);
                })()}
              </select>
            </label>
          </div>
        </div>

        <div class="card">
          <h2>{t("form.contact")}</h2>
          <div class="form-grid">
            <label class="field"><span class="lbl">{t("form.phone")}</span><input type="text" name="phone" value={v.phone ?? ""} /></label>
            <label class="field"><span class="lbl">{t("form.nrc")}</span><input type="text" name="nrc_number" value={v.nrc_number ?? ""} /></label>
            <label class="field"><span class="lbl">{t("form.language")}</span><input type="text" name="languages" value={v.languages ?? ""} placeholder={t("form.languagePlaceholder")} /></label>
            <label class="field" style="grid-column:1/-1"><span class="lbl">{t("form.address")}</span><textarea name="address">{v.address ?? ""}</textarea></label>
          </div>
        </div>

        <div class="card">
          <h2>{t("form.family")}</h2>
          <div class="form-grid">
            <label class="field"><span class="lbl">{t("form.father")}</span><input type="text" name="father_name" value={v.father_name ?? ""} /></label>
            <label class="field"><span class="lbl">{t("form.mother")}</span><input type="text" name="mother_name" value={v.mother_name ?? ""} /></label>
            <label class="field"><span class="lbl">{t("form.ethnicity")}</span><select name="ethnicity_id">{opts(options.ethnicity ?? [], v.ethnicity_id ?? "", t("form.choose"))}</select></label>
            <label class="field"><span class="lbl">{t("form.education")}</span><select name="education_id">{opts(options.education ?? [], v.education_id ?? "", t("form.choose"))}</select></label>
            <label class="field"><span class="lbl">{t("form.job")}</span><input type="text" name="job" value={v.job ?? ""} /></label>
            <label class="field"><span class="lbl">{t("form.skills")}</span><input type="text" name="work_skills" value={v.work_skills ?? ""} /></label>
            <label class="field"><span class="lbl">{t("form.income")}</span><input type="text" name="income" value={v.income ?? ""} placeholder={t("form.incomePlaceholder")} /></label>
          </div>
        </div>

        <div class="card">
          <h2>{t("form.church")}</h2>
          <div class="form-grid">
            <label class="field">
              <span class="lbl">{t("form.state")}</span>
              <select name="region_id" required data-region-select="1">
                <option value="">{t("form.choose")}</option>
                {regions.map((r) => (
                  <option value={String(r.id)} selected={v.region_id === String(r.id)}>
                    {optionText("code" in r ? (r as any).code : null, r.name)}
                  </option>
                ))}
              </select>
              <span class="hint">{t("form.stateHint")}</span>
            </label>
            <label class="field">
              <span class="lbl">{t("form.township")}</span>
              <select name="township" data-region-filter="1">
                {townshipOpts(options.township ?? [], v.township ?? "", t("form.choose"))}
                {v.township && !(options.township ?? []).some((o) => o.label === v.township) && (
                  <option value={v.township} selected>{v.township}</option>
                )}
              </select>
            </label>
            <label class="field"><span class="lbl">{t("form.homeCell")}</span><select name="home_cell_id" data-region-filter="1" data-parent-filter="township">{opts(options.home_cell ?? [], v.home_cell_id ?? "", t("form.choose"), townshipLabelById)}</select></label>
            <label class="field">
              <span class="lbl">{t("form.department")}</span>
              <select name="department_id">
                <option value="">{t("form.choose")}</option>
                {departments.map((d) => (
                  <option value={String(d.id)} selected={v.department_id === String(d.id)}>{departmentName(d, L)}</option>
                ))}
              </select>
            </label>
            <label class="field"><span class="lbl">{t("form.group")}</span><select name="group_id" data-region-filter="1">{opts(options.group ?? [], v.group_id ?? "", t("form.choose"))}</select></label>
            <label class="field"><span class="lbl">{t("form.familyGroup")}</span><select name="family_group_id" data-region-filter="1" data-parent-filter="home_cell">{opts(options.family_group ?? [], v.family_group_id ?? "", t("form.choose"), undefined, true)}</select></label>
            <label class="field"><span class="lbl">{t("form.fellowship")}</span><select name="fellowship_category_id">{opts(options.fellowship_category ?? [], v.fellowship_category_id ?? "", t("form.choose"))}</select></label>
            <label class="field"><span class="lbl">{t("form.sector")}</span><select name="sector_id">{opts(options.sector ?? [], v.sector_id ?? "", t("form.choose"))}</select></label>
            <label class="field"><span class="lbl">{t("form.salvation")}</span><input type="date" name="salvation_date" value={v.salvation_date ?? ""} /></label>
            <label class="field"><span class="lbl">{t("form.statusLabel")}</span>{select("status", S, v.status || "active", "")}</label>
            <label class="field" style="grid-column:1/-1"><span class="lbl">{t("form.notes")}</span><textarea name="notes">{v.notes ?? ""}</textarea></label>
          </div>
        </div>

        <div class="actions">
          <button class="btn" type="submit">{edit ? t("form.save") : t("form.add")}</button>
          {modal
            ? <button class="btn secondary" type="button" data-close="1">{t("form.cancel")}</button>
            : <a class="btn secondary" href={edit ? `/members/${member!.id}` : "/members"}>{t("form.cancel")}</a>}
        </div>
      </form>
    </>
  );
}

export type PositionFormAssignments = {
  homeCell: string;
  township: string;
  cluster: string;
  clusterId: number | null;
  regionalChurch: string;
  regionalChurchId: number | null;
  department: string;
  departmentId: number | null;
  memberDepartmentId: number | null;
  church: string;
  churchId: number | null;
};

export type PositionMember = {
  id: number;
  name: string;
  homeCell: string | null;
  homeCellId: number | null;
  townshipId?: number | null;
  townshipName?: string | null;
  regionalChurchId?: number | null;
  departmentId?: number | null;
};

type PositionFormProps = {
  member: PositionMember;
  assignments: PositionFormAssignments;
  departments: DepartmentRow[];
  positionDefs: PositionDefRow[];
  regionalChurches: RegionalChurchRow[];
  clusters: SupervisionClusterRow[];
  canManageDepartments: boolean;
  canManagePositions: boolean;
  canManageRegional: boolean;
  error?: string | null;
  lang?: Lang;
};

export function MemberPositionPage(props: Common & PositionFormProps) {
  const { user, perms, flash, lang, member, assignments, departments, positionDefs, regionalChurches, clusters, canManageDepartments, canManagePositions, canManageRegional } = props;
  const t = getDict(lang ?? "en");
  return (
    <Layout title={t("org.assignTitle")} lang={lang} user={user} perms={perms} active="/members" flash={flash ?? null}>
      <div class="page-head">
        <h1>{t("org.assignTitle")}</h1>
        <a class="btn secondary" href={`/members/${member.id}`}>{t("members.back")}</a>
      </div>
      <div class="card">
        <MemberPositionForm
          member={member} assignments={assignments} departments={departments}
          positionDefs={positionDefs} regionalChurches={regionalChurches} clusters={clusters}
          canManageDepartments={canManageDepartments} canManagePositions={canManagePositions}
          canManageRegional={canManageRegional} lang={lang}
        />
      </div>
    </Layout>
  );
}

export function MemberPositionForm(props: PositionFormProps) {
  const { member, assignments, departments, positionDefs, regionalChurches, clusters, canManageDepartments, canManagePositions, canManageRegional, error, lang } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const initial = member.name.trim().charAt(0) || "?";
  const department = departments.find((d) => d.id === assignments.departmentId);
  // A department role also implies membership, so show that department in the
  // membership field even for records created before membership was tracked.
  const memberDepartmentId = member.departmentId ?? assignments.departmentId ?? null;
  const memberDepartment = departments.find((d) => d.id === memberDepartmentId);
  const roleDepartmentId = assignments.departmentId ?? member.departmentId ?? null;
  const homeDefs = defsForScope(positionDefs, "home_cell");
  const townshipDefs = defsForScope(positionDefs, "township");
  const clusterDefs = defsForScope(positionDefs, "cluster");
  const regionalDefs = defsForScope(positionDefs, "regional_church");
  const departmentDefs = defsForScope(positionDefs, "department");
  const churchDefs = defsForScope(positionDefs, "church");
  const label = (code: string) => positionLabelForCode(positionDefs, code, L);
  const regionalId = assignments.regionalChurchId ?? member.regionalChurchId ?? null;
  const churchId = assignments.churchId ?? member.regionalChurchId ?? null;
  const orderedChurches = [...regionalChurches].sort((a, b) => (b.isMain ?? 0) - (a.isMain ?? 0));
  const currentRoles = [
    memberDepartment && `${departmentName(memberDepartment, L)}`,
    assignments.homeCell && label(assignments.homeCell),
    assignments.township && `${label(assignments.township)} · ${member.townshipName ?? t("org.supervision")}`,
    assignments.regionalChurch && label(assignments.regionalChurch),
    assignments.department && department && label(assignments.department),
    assignments.church && label(assignments.church),
  ].filter(Boolean) as string[];

  const tabs = [
    { key: "home", label: t("org.tabHomeCell"), available: true },
    { key: "supervision", label: t("org.tabSupervision"), available: Boolean(member.townshipId || clusters.length > 0 || assignments.cluster) },
    { key: "regional", label: t("org.tabRegional"), available: regionalDefs.length > 0 || regionalChurches.length > 0 },
    { key: "department", label: t("org.tabDepartment"), available: departmentDefs.length > 0 || departments.length > 0 },
    { key: "church", label: t("org.tabChurch"), available: churchDefs.length > 0 },
  ].filter((x) => x.available);
  const firstTab = tabs[0]?.key ?? "home";

  const managePositions = (scope: string) => canManagePositions && (
    <p class="hint">
      <a href={`/organization/positions?scope=${scope}`}>{t("org.managePositions")}</a>
    </p>
  );

  const positionOptions = (defs: PositionDefRow[], selected: string) => (
    <>
      <option value="">{t("org.noPosition")}</option>
      {defs.map((p) => (
        <option value={p.code} selected={selected === p.code}>{positionDefLabel(p, L)}</option>
      ))}
    </>
  );

  return (
    <div class="position-form">
      <div class="position-hero">
        <span class="position-avatar" aria-hidden="true">{initial}</span>
        <div class="position-hero-main">
          <div class="position-hero-title">
            <h4>{member.name}</h4>
            <span class="position-hero-home">
              {t("org.homeCell")}: <strong>{member.homeCellId ? member.homeCell : t("org.vacant")}</strong>
            </span>
          </div>
          <div class="position-role-chips" aria-label={t("org.currentRoles")}>
            {currentRoles.length === 0
              ? <span class="muted small">{t("org.noPosition")}</span>
              : currentRoles.map((role) => (
                <span class="badge position">{role}</span>
              ))}
          </div>
        </div>
      </div>
      <p class="hint position-intro">{t("org.positionIntro")}</p>
      {error && <div class="flash err">{error}</div>}
      <form method="post" action={`/members/${member.id}/position`} data-flash-ok="member-position">
        <div class="position-tabs" data-tabs role="tablist" aria-label={t("org.assignTitle")}>
          {tabs.map((tab) => (
            <button type="button" role="tab" class={`position-tab${tab.key === firstTab ? " active" : ""}`}
              data-tab-target={tab.key} aria-selected={tab.key === firstTab ? "true" : "false"}>
              {tab.label}
            </button>
          ))}
        </div>

        <div class="position-panes" data-tabs-body>
          <section class="position-section" data-tab-pane="home" role="tabpanel">
            <div class="position-section-head">
              <span class="position-step" aria-hidden="true">1</span>
              <div>
                <h3>{t("org.homeCellSection")}</h3>
                {member.homeCellId && <p class="hint">{t("org.homeCell")}: <strong>{member.homeCell}</strong></p>}
              </div>
            </div>
            {!member.homeCellId ? (
              <div class="position-notice">
                <p>{t("org.noHomeCell")}</p>
                <a class="btn sm secondary" href={`/members/${member.id}/edit`}>{t("org.changeHomeCell")}</a>
              </div>
            ) : homeDefs.length === 0 ? (
              managePositions("home_cell")
            ) : (
              <label class="field">
                <span class="lbl">{t("org.position")}</span>
                <select name="home_cell_position">
                  {positionOptions(homeDefs, assignments.homeCell)}
                </select>
              </label>
            )}
          </section>

          <section class="position-section" data-tab-pane="supervision" role="tabpanel">
            <div class="position-section-head">
              <span class="position-step" aria-hidden="true">2</span>
              <div>
                <h3>{t("org.supervisionSection")}</h3>
                <p class="hint">{t("org.supervisionSectionHint")}</p>
              </div>
            </div>
            {clusters.length > 0 && clusterDefs.length > 0 && (
              <div class="position-subsection">
                <h4>{t("org.clusterSection")}</h4>
                <p class="hint">{t("org.clusterHint")}</p>
                <div class="form-grid">
                  <label class="field">
                    <span class="lbl">{t("org.clusterLabel")}</span>
                    <select name="supervision_cluster_id">
                      <option value="">{t("org.noCluster")}</option>
                      {clusters.map((cluster) => (
                        <option value={String(cluster.id)} selected={assignments.clusterId === cluster.id}>
                          {clusterName(cluster, L)} · {L !== "mm" && cluster.stateNameEn ? cluster.stateNameEn : cluster.stateName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label class="field">
                    <span class="lbl">{t("org.position")}</span>
                    <select name="cluster_position">
                      {positionOptions(clusterDefs, assignments.cluster)}
                    </select>
                  </label>
                </div>
              </div>
            )}
            {!member.townshipId ? (
              <div class="position-notice">
                <p>{t("org.noSupervision")}</p>
                <a class="btn sm secondary" href={`/members/${member.id}/edit`}>{t("org.changeHomeCell")}</a>
              </div>
            ) : townshipDefs.length === 0 ? (
              managePositions("township")
            ) : (
              <>
                <p class="position-scope">
                  {t("org.townshipSupervision")}: <strong>{member.townshipName ?? `#${member.townshipId}`}</strong>
                </p>
                <label class="field">
                  <span class="lbl">{t("org.position")}</span>
                  <select name="township_position">
                    {positionOptions(townshipDefs, assignments.township)}
                  </select>
                </label>
              </>
            )}
          </section>

          <section class="position-section" data-tab-pane="regional" role="tabpanel">
            <div class="position-section-head">
              <span class="position-step" aria-hidden="true">3</span>
              <div><h3>{t("org.regionalSection")}</h3></div>
            </div>
            {regionalDefs.length === 0 || regionalChurches.length === 0 ? (
              <>
                <p class="hint">{regionalChurches.length === 0 ? t("org.noRegional") : t("org.noPositions")}</p>
                {managePositions("regional_church")}
                {canManageRegional && <p class="hint"><a href="/organization/regional-churches">{t("org.manageRegional")}</a></p>}
              </>
            ) : (
              <div class="form-grid">
                <label class="field">
                  <span class="lbl">{t("org.regionalChurch")}</span>
                  <select name="regional_church_id">
                    <option value="">{t("org.noRegionalChurch")}</option>
                    {regionalChurches.map((r) => (
                      <option value={String(r.id)} selected={regionalId === r.id}>
                        {regionalChurchName(r, L)}
                      </option>
                    ))}
                  </select>
                </label>
                <label class="field">
                  <span class="lbl">{t("org.position")}</span>
                  <select name="regional_church_position">
                    {positionOptions(regionalDefs, assignments.regionalChurch)}
                  </select>
                </label>
              </div>
            )}
          </section>

          <section class="position-section" data-tab-pane="department" role="tabpanel">
            <div class="position-section-head">
              <span class="position-step" aria-hidden="true">4</span>
              <div><h3>{t("org.departmentSection")}</h3></div>
            </div>
            {departments.length === 0 ? (
              <p class="hint">
                {t("org.noDepartments")}
                {canManageDepartments && <> <a href="/organization/departments">{t("org.manageDepartments")}</a></>}
              </p>
            ) : (
              <>
                <label class="field">
                  <span class="lbl">{t("org.departmentMembership")}</span>
                  <select name="department_member_id">
                    <option value="">{t("org.noDepartment")}</option>
                    {departments.map((d) => (
                      <option value={String(d.id)} selected={memberDepartmentId === d.id}>
                        {departmentName(d, L)}
                      </option>
                    ))}
                  </select>
                  <span class="hint">{t("org.departmentMemberHint")}</span>
                </label>
                <div class="form-grid" data-dept-position>
                  <label class="field">
                    <span class="lbl">{t("org.department")}</span>
                    <select name="department_id">
                      <option value="">{t("org.noDepartment")}</option>
                      {departments.map((d) => (
                        <option value={String(d.id)} selected={roleDepartmentId === d.id}>
                          {departmentName(d, L)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label class="field">
                    <span class="lbl">{t("org.departmentPosition")}</span>
                    <select name="department_position" disabled={!roleDepartmentId}>
                      {positionOptions(departmentDefs, assignments.department)}
                    </select>
                  </label>
                </div>
              </>
            )}
            {departmentDefs.length === 0 && managePositions("department")}
          </section>

          <section class="position-section" data-tab-pane="church" role="tabpanel">
            <div class="position-section-head">
              <span class="position-step" aria-hidden="true">5</span>
              <div><h3>{t("org.churchSection")}</h3></div>
            </div>
            {churchDefs.length === 0 ? managePositions("church") : (
              <div class="form-grid">
                <label class="field">
                  <span class="lbl">{t("org.church")}</span>
                  <select name="church_id">
                    <option value="">{t("org.noChurch")}</option>
                    {orderedChurches.map((church) => (
                      <option value={String(church.id)} selected={churchId === church.id}>
                        {regionalChurchName(church, L)}{church.isMain === 1 ? ` · ${t("org.mainChurchBadge")}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label class="field">
                  <span class="lbl">{t("org.churchLeadership")}</span>
                  <select name="church_position">
                    {positionOptions(churchDefs, assignments.church)}
                  </select>
                </label>
              </div>
            )}
          </section>
        </div>

        <div class="actions">
          <button class="btn" type="submit">{t("org.savePosition")}</button>
        </div>
      </form>
    </div>
  );
}

export type MemberDetail = {
  id: number;
  member_code: string | null;
  name_english: string | null;
  name_myanmar: string | null;
  gender: string;
  marital_status: string;
  date_of_birth: string | null;
  blood_type: string;
  phone: string | null;
  nrc_number: string | null;
  languages: string | null;
  address: string | null;
  township: string | null;
  father_name: string | null;
  mother_name: string | null;
  job: string | null;
  work_skills: string | null;
  income: number | null;
  salvation_date: string | null;
  notes: string | null;
  status: string;
  region_id: number;
  state_name: string;
  state_name_en?: string | null;
  created_at: number;
  updated_at: number;
  ethnicity: string | null;
  education: string | null;
  family_group: string | null;
  family_group_code?: string | null;
  fellowship: string | null;
  sector: string | null;
  group_label: string | null;
  home_cell: string | null;
  ethnicity_id: number | null;
  education_id: number | null;
  family_group_id: number | null;
  fellowship_category_id: number | null;
  sector_id: number | null;
  group_id: number | null;
  home_cell_id: number | null;
  home_cell_township_id?: number | null;
  home_cell_township?: string | null;
  home_cell_regional_church_id?: number | null;
  department_id?: number | null;
  department?: string | null;
  positions?: string | null;
  household_id?: number | null;
  household_name?: string | null;
  relationship?: string;
  has_photo?: number | boolean;
};

export type MemberHistoryRow = {
  id: number;
  action: string;
  actor_name: string;
  created_at: number;
};

export function MemberDetailPage(props: Common & { m: MemberDetail; history?: MemberHistoryRow[]; positionDefs?: PositionDefRow[] }) {
  const { user, perms, flash, m, lang, history = [], positionDefs } = props;
  const t = getDict(lang ?? "en");
  const ACTION_LABELS: Record<string, { mm: string; en: string; ko: string; cls: string }> = {
    create: { mm: "ထည့်သွင်း", en: "Created", ko: "생성", cls: "active" },
    update: { mm: "ပြင်ဆင်", en: "Updated", ko: "수정", cls: "" },
    delete: { mm: "ဖျက်သိမ်း", en: "Deleted", ko: "삭제", cls: "inactive" },
    bulk_status: { mm: "Bulk status", en: "Bulk status", ko: "일괄 상태 변경", cls: "" },
    bulk_delete: { mm: "Bulk delete", en: "Bulk delete", ko: "일괄 삭제", cls: "inactive" },
    bulk_group: { mm: "Bulk assign", en: "Bulk assign", ko: "일괄 지정", cls: "" },
    position: { mm: "ရာထူး သတ်မှတ်", en: "Position assigned", ko: "직책 지정", cls: "active" },
  };
  const L = lang ?? "en";
  const isEn = L !== "mm";
  const G = L === "mm" ? GENDERS : L === "kr" ? GENDERS_KR : GENDERS_EN;
  const M = L === "mm" ? MARITAL_STATUSES : L === "kr" ? MARITAL_STATUSES_KR : MARITAL_STATUSES_EN;
  const S = L === "mm" ? STATUSES : L === "kr" ? STATUSES_KR : STATUSES_EN;
  /** Stored dates are ISO already; render timestamps the same unambiguous way. */
  const stamp = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 16).replace("T", " ");
  const initial = Array.from((m.name_myanmar || m.name_english || "?").trim())[0] ?? "?";
  const sections: { title: string; rows: [string, string][] }[] = [
    {
      title: t("form.basic"),
      rows: [
        ["ID", m.member_code ?? `#${m.id}`],
        [t("detail.name"), m.name_myanmar ?? ""],
        [t("detail.nameEn"), m.name_english ?? ""],
        [t("detail.gender"), m.gender ? G[m.gender] ?? m.gender : ""],
        [t("detail.marital"), m.marital_status ? M[m.marital_status] ?? m.marital_status : ""],
        [t("detail.dob"), m.date_of_birth ?? ""],
        [t("detail.age"), m.date_of_birth ? String(ageFromDate(m.date_of_birth) ?? "—") : ""],
        [t("detail.blood"), m.blood_type],
      ],
    },
    {
      title: t("form.contact"),
      rows: [
        [t("detail.phone"), m.phone ?? ""],
        [t("detail.nrc"), m.nrc_number ?? ""],
        [t("detail.languages"), m.languages ?? ""],
        [t("detail.address"), m.address ?? ""],
      ],
    },
    {
      title: t("form.family"),
      rows: [
        [t("detail.father"), m.father_name ?? ""],
        [t("detail.mother"), m.mother_name ?? ""],
        [t("detail.ethnicity"), m.ethnicity ?? ""],
        [t("detail.education"), m.education ?? ""],
        [t("detail.job"), m.job ?? ""],
        [t("detail.skills"), m.work_skills ?? ""],
        [t("detail.income"), m.income !== null ? String(m.income) : ""],
      ],
    },
    {
      title: t("form.church"),
      rows: [
        [t("detail.state"), isEn && m.state_name_en ? m.state_name_en : m.state_name],
        [t("detail.township"), m.township ?? ""],
        [t("hh.household"), m.household_name ?? ""],
        [t("detail.salvation"), m.salvation_date ?? ""],
        [t("detail.familyGroup"), optionLabel(m.family_group_code, m.family_group)],
        [t("form.fellowship"), m.fellowship ?? ""],
        [t("form.sector"), m.sector ?? ""],
        [t("form.group"), m.group_label ?? ""],
        [t("form.homeCell"), m.home_cell ?? ""],
        [t("form.department"), m.department ?? ""],
        [t("org.position"), (positionDefs ? positionLabelsForCsv(positionDefs, m.positions, L) : positionLabels(m.positions, L)).join(" · ")],
        [t("detail.status"), S[m.status] ?? m.status],
        [t("detail.notes"), m.notes ?? ""],
      ],
    },
  ];
  return (
    <Layout title={m.name_myanmar || m.name_english || "Member"} lang={lang} user={user} perms={perms} active="/members" flash={flash ?? null}>
      <div class="page-head">
        <h1>
          <span class="member-avatar-head" aria-hidden="true">
            {m.has_photo
              ? <img src={`/members/${m.id}/photo?v=${m.updated_at}`} alt="" />
              : initial}
          </span>
          {m.name_myanmar || m.name_english || `#${m.id}`}
          {m.name_english && m.name_myanmar && <span class="muted small" style="margin-left:8px;font-weight:400">{m.name_english}</span>}
          <span class="count-pill">{m.member_code}</span>
        </h1>
        <div class="actions" style="margin:0">
          <a class="btn secondary" href="/members">{t("members.toList")}</a>
          {m.household_id ? (
            <a class="btn secondary" href={`/admin/households/${m.household_id}`}>{t("hh.viewHousehold")}</a>
          ) : perms.has("members.create") ? (
            <a class="btn secondary" href={`/admin/households/new?member=${m.id}`}>{t("hh.newFromMember")}</a>
          ) : null}
          {perms.has("members.update") && (
            <a class="btn secondary js-edit-modal" href={`/members/${m.id}/position`} data-modal-title={t("org.assignTitle")} data-modal-size="md">
              {m.positions ? t("org.changePosition") : t("org.assignPosition")}
            </a>
          )}
          {perms.has("members.update") && (
            <a class="btn js-edit-modal" href={`/members/${m.id}/edit`} data-modal-title={t("form.editTitle")}>{t("members.edit")}</a>
          )}
          {perms.has("members.delete") && (
            <form method="post" action={`/members/${m.id}/delete`} data-confirm={t("detail.confirmDelete")} style="display:inline"
             >
              <button class="btn outline-danger" type="submit">{t("members.delete")}</button>
            </form>
          )}
        </div>
      </div>
      {sections.map((s) => (
        <div class="card detail-card">
          <h2>{s.title}</h2>
          <div class="detail-grid">
            {s.rows.map(([label, value]) => (
              <div class="detail-item">
                <span class="k">{label}</span>
                <span class={`v${value ? "" : " empty"}`}>{value || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <p class="muted small">{t("detail.updatedAt")}: {stamp(m.updated_at)}</p>

      <div class="card" style="margin-top:18px">
        <h2>{t("detail.history")}</h2>
        {history.length === 0 ? (
          <p class="muted small">{t("detail.historyEmpty")}</p>
        ) : (
          <div class="tbl-wrap">
            <table>
              <thead><tr><th>{t("detail.historyWhen")}</th><th>{t("detail.historyAction")}</th><th>{t("detail.historyBy")}</th></tr></thead>
              <tbody>
                {history.map((h) => {
                  const a = ACTION_LABELS[h.action] ?? { mm: h.action, en: h.action, ko: h.action, cls: "" };
                  return (
                    <tr>
                      <td class="muted small">{new Date(h.created_at * 1000).toISOString().slice(0, 16).replace("T", " ")}</td>
                      <td><span class={`badge ${a.cls}`}>{(L === "mm" ? a.mm : L === "kr" ? a.ko : a.en) || h.action}</span></td>
                      <td>{h.actor_name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}

export type ImportReport = {
  done: boolean;
  total: number;
  valid: number;
  inserted: number;
  duplicates: number;
  errorCount: number;
  errors: { line: number; msg: string }[];
  newOptions: string[];
  csvB64?: string;
};

export function ImportPage(props: Common & { report: ImportReport | null; error: string | null }) {
  const { user, perms, flash, report, error, lang } = props;
  const t = getDict(lang ?? "en");
  return (
    <Layout title={t("nav.import")} lang={lang} user={user} perms={perms} active="/members/import" flash={flash ?? null}>
      <div class="page-head">
        <h1>{t("import.heading")}</h1>
        <a class="btn secondary" href="/members">{t("members.toList")}</a>
      </div>
      {error && <div class="flash err">{error}</div>}

      <div class="card">
        <h2>{t("import.howto")}</h2>
        <ol class="small">
          <li>{t("import.step1")}</li>
          <li>{t("import.headers")}</li>
          <li>{t("import.step3")}</li>
        </ol>
        <p><a class="btn secondary" href="/members/import/template">{t("import.template")}</a></p>
      </div>

      {!report && (
        <div class="card">
          <h2>{t("import.upload")}</h2>
          <form method="post" action="/members/import" encType="multipart/form-data">
            <label class="field">
              <span class="lbl">{t("import.file")}</span>
              <input type="file" name="file" accept=".csv,text/csv" required />
            </label>
            <div class="actions">
              <button class="btn" type="submit">{t("import.uploadPreview")}</button>
            </div>
          </form>
        </div>
      )}

      {report && (
        <div class="card">
          <h2>{report.done ? t("import.result") : t("import.preview")}</h2>
          <div class="stat-grid">
            <div class="stat"><div class="n">{report.total}</div><div class="t">{t("import.totalRows")}</div></div>
            <div class="stat"><div class="n">{report.valid}</div><div class="t">{t("import.valid")}</div></div>
            <div class="stat"><div class="n">{report.duplicates}</div><div class="t">{t("import.duplicates")}</div></div>
            <div class="stat"><div class="n">{report.errorCount}</div><div class="t">{t("import.errors")}</div></div>
            {report.done && <div class="stat"><div class="n">{report.inserted}</div><div class="t">{t("import.inserted")}</div></div>}
          </div>

          {report.errors.length > 0 && (
            <div style="margin-top:14px">
              <strong class="small">{t("import.rowErrors")}</strong>
              <ul class="err-list small">
                {report.errors.map((e) => <li>{t("import.row")} {e.line}: {e.msg}</li>)}
              </ul>
            </div>
          )}
          {report.newOptions.length > 0 && (
            <p class="small muted" style="margin-top:10px">
              {t("import.newOptions")}{report.newOptions.join(", ")}
            </p>
          )}

          {!report.done && report.valid > 0 && report.csvB64 && (
            <form method="post" action="/members/import">
              <input type="hidden" name="action" value="commit" />
              <input type="hidden" name="csv_b64" value={report.csvB64} />
              <div class="actions">
                <button class="btn" type="submit">{t("import.commit1")} {report.valid} {t("import.commit2")}</button>
                <a class="btn secondary" href="/members/import">{t("form.cancel")}</a>
              </div>
              <p class="muted small">{t("import.keptOut")}</p>
            </form>
          )}
          {!report.done && report.valid === 0 && (
            <div class="actions"><a class="btn secondary" href="/members/import">{t("import.retry")}</a></div>
          )}
          {report.done && (
            <div class="actions">
              <a class="btn" href="/members">{t("import.viewList")}</a>
              <a class="btn secondary" href="/members/import">{t("import.uploadNext")}</a>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
