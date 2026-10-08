import { Layout } from "./layout";
import type { Flash } from "./layout";
import type { SessionUser } from "../session";
import type { OptionRow } from "../lookup";
import { BLOOD_TYPES, GENDERS, GENDERS_EN, MARITAL_STATUSES, MARITAL_STATUSES_EN, STATUSES, STATUSES_EN } from "../enums";
import { getDict, type Lang } from "../i18n";
import { ageFromDate, qs } from "../util";

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
  group_label: string | null;
  status: string;
};

export type Filters = {
  q: string;
  state: number | null;
  gender: string;
  status: string;
  homeCell: number | null;
  group: number | null;
  fellowship: number | null;
};

type Common = { user: SessionUser; perms: Set<string>; flash?: Flash; lang?: Lang };
type ListProps = Common & {
  rows: MemberListItem[];
  total: number;
  page: number;
  pages: number;
  filters: Filters;
  regions: { id: number; name: string }[];
  homeCells: OptionRow[];
  groups: OptionRow[];
  fellowships: OptionRow[];
};

function filterQs(f: Filters, page?: number): string {
  return qs({
    q: f.q, state: f.state, gender: f.gender, status: f.status,
    home_cell: f.homeCell, group: f.group, fellowship: f.fellowship, page: page ?? null,
  });
}

export function MembersListPage(props: ListProps) {
  const { user, perms, flash, rows, total, page, pages, filters: f, regions, homeCells, groups, fellowships, lang } = props;
  const t = getDict(lang ?? "mm");
  const isEn = (lang ?? "mm") === "en";
  const G = isEn ? GENDERS_EN : GENDERS;
  const S = isEn ? STATUSES_EN : STATUSES;
  const canCreate = perms.has("members.create");
  const canDelete = perms.has("members.delete");
  const canExport = perms.has("members.export");
  const canImport = perms.has("members.import");
  return (
    <Layout title={t("members.title")} lang={lang} user={user} perms={perms} active="/members" flash={flash ?? null}>
      <div class="page-head">
        <h1>{t("members.title")} <span class="muted small">({total}{(lang ?? "mm") === "mm" ? ` ${t("members.count")}` : " members"})</span></h1>
        <div class="actions" style="margin:0">
          {canImport && <a class="btn secondary" href="/members/import">CSV Import</a>}
          {canExport && <a class="btn secondary" href={`/members/export${filterQs(f)}`}>CSV Export</a>}
          {canCreate && <a class="btn" href="/members/new">{t("members.addNew")}</a>}
        </div>
      </div>

      <form class="card filters" method="get" action="/members">
        <label class="field">
          <span class="lbl">{t("members.search")}</span>
          <input type="search" name="q" value={f.q} placeholder={t("members.searchPlaceholder")} />
        </label>
        <label class="field">
          <span class="lbl">{t("members.state")}</span>
          <select name="state">
            <option value="">{t("members.all")}</option>
            {regions.map((r) => (
              <option value={String(r.id)} selected={f.state === r.id}>{r.name}</option>
            ))}
          </select>
        </label>
        <label class="field">
          <span class="lbl">{t("members.gender")}</span>
          <select name="gender">
            <option value="">{t("members.all")}</option>
            {Object.entries(G).map(([k, v]) => (
              <option value={k} selected={f.gender === k}>{v}</option>
            ))}
          </select>
        </label>
        <label class="field">
          <span class="lbl">{t("members.status")}</span>
          <select name="status">
            <option value="">{t("members.all")}</option>
            {Object.entries(S).map(([k, v]) => (
              <option value={k} selected={f.status === k}>{v}</option>
            ))}
          </select>
        </label>
        <label class="field">
          <span class="lbl">{t("members.thHomeCell")}</span>
          <select name="home_cell">
            <option value="">{t("members.all")}</option>
            {homeCells.map((o) => (
              <option value={String(o.id)} selected={f.homeCell === o.id}>{o.label}</option>
            ))}
          </select>
        </label>
        <label class="field">
          <span class="lbl">{t("members.thGroup")}</span>
          <select name="group">
            <option value="">{t("members.all")}</option>
            {groups.map((o) => (
              <option value={String(o.id)} selected={f.group === o.id}>{o.label}</option>
            ))}
          </select>
        </label>
        <label class="field">
          <span class="lbl">{t("form.fellowship")}</span>
          <select name="fellowship">
            <option value="">{t("members.all")}</option>
            {fellowships.map((o) => (
              <option value={String(o.id)} selected={f.fellowship === o.id}>{o.label}</option>
            ))}
          </select>
        </label>
        <div class="actions" style="margin:0">
          <button class="btn" type="submit">{t("members.searchBtn")}</button>
          <a class="btn secondary" href="/members">{t("members.clear")}</a>
        </div>
      </form>

      <div class="tbl-wrap">
        <table class="list-tbl">
          <thead>
            <tr>
              <th>{t("members.thId")}</th><th>{t("members.thName")}</th><th>{t("members.gender")}</th><th>{t("members.thPhone")}</th><th>{t("members.state")}</th>
              <th>{t("members.thHomeCell")}</th><th>{t("members.thGroup")}</th><th>{t("members.status")}</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} class="empty-state">
                  <strong>{t("members.empty")}</strong>
                  {canCreate && <div class="small">{t("members.emptyHint")}</div>}
                </td>
              </tr>
            )}
            {rows.map((m) => (
              <tr>
                <td>{m.member_code ?? `#${m.id}`}</td>
                <td>
                  <a href={`/members/${m.id}`}>{m.name_myanmar || m.name_english || t("members.noName")}</a>
                  {m.name_myanmar && m.name_english && <div class="muted small">{m.name_english}</div>}
                </td>
                <td>{m.gender ? (G[m.gender] ?? m.gender) : ""}</td>
                <td>{m.phone ?? ""}</td>
                <td>{isEn && m.state_name_en ? m.state_name_en : m.state_name}</td>
                <td>{m.home_cell ?? ""}</td>
                <td>{m.group_label ?? ""}</td>
                <td><span class={`badge ${m.status}`}>{S[m.status] ?? m.status}</span></td>
                <td style="white-space:nowrap">
                  {perms.has("members.update") && (
                    <a class="btn sm secondary js-edit-modal" href={`/members/${m.id}/edit`} data-modal-title={t("form.editTitle")}>{t("members.edit")}</a>
                  )}{" "}
                  {canDelete && (
                    <form method="post" action={`/members/${m.id}/delete`} data-confirm={t("detail.confirmDelete")} style="display:inline"
                     >
                      <button class="btn sm danger" type="submit">{t("members.delete")}</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div class="actions" style="justify-content:center">
          {page > 1 && <a class="btn secondary" href={`/members${filterQs(f, page - 1)}`}>{t("members.prev")}</a>}
          <span class="muted">{t("members.page")} {page} / {pages}</span>
          {page < pages && <a class="btn secondary" href={`/members${filterQs(f, page + 1)}`}>{t("members.next")}</a>}
        </div>
      )}
    </Layout>
  );
}

export type FormValues = Record<string, string>;
type FormProps = Common & {
  values: FormValues;
  errors: string[];
  member: { id: number } | null;
  regions: { id: number; name: string }[];
  options: Record<string, OptionRow[]>;
};

function opts(options: OptionRow[], selected: string, blank: string) {
  return (
    <>
      <option value="">{blank}</option>
      {options.map((o) => (
        <option value={String(o.id)} selected={selected === String(o.id)} data-region={o.regionId ?? ""}>{o.label}</option>
      ))}
    </>
  );
}

/** Township select — stores the label as free text (members.township is TEXT). */
function townshipOpts(options: OptionRow[], selected: string, blank: string) {
  return (
    <>
      <option value="">{blank}</option>
      {options.map((o) => (
        <option value={o.label} selected={selected === o.label} data-region={o.regionId ?? ""}>{o.label}</option>
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
  const t = getDict(lang ?? "mm");
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
  const { values: v, errors, member, regions, options, lang, modal } = props;
  const t = getDict(lang ?? "mm");
  const isEn = (lang ?? "mm") === "en";
  const G = isEn ? GENDERS_EN : GENDERS;
  const M = isEn ? MARITAL_STATUSES_EN : MARITAL_STATUSES;
  const S = isEn ? STATUSES_EN : STATUSES;
  const action = member ? `/members/${member.id}` : "/members";
  const edit = member !== null;
  const dob = v.date_of_birth || "";
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
          <div class="form-grid">
            <label class="field">
              <span class="lbl">{t("form.nameMm")} <span class="hint">Name Myanmar</span></span>
              <input type="text" name="name_myanmar" value={v.name_myanmar ?? ""} />
            </label>
            <label class="field">
              <span class="lbl">{t("form.nameEn")} <span class="hint">Name English</span></span>
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
                {BLOOD_TYPES.map((b) => <option value={b} selected={v.blood_type === b}>{b}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div class="card">
          <h2>{t("form.contact")}</h2>
          <div class="form-grid">
            <label class="field"><span class="lbl">{t("form.phone")}</span><input type="text" name="phone" value={v.phone ?? ""} /></label>
            <label class="field"><span class="lbl">{t("form.nrc")}</span><input type="text" name="nrc_number" value={v.nrc_number ?? ""} /></label>
            <label class="field"><span class="lbl">{t("form.language")}</span><input type="text" name="languages" value={v.languages ?? ""} placeholder="မြန်မာ၊ ကရင်..." /></label>
            <label class="field" style="grid-column:1/-1"><span class="lbl">{t("form.address")}</span><textarea name="address">{v.address ?? ""}</textarea></label>
          </div>
        </div>

        <div class="card">
          <h2>{t("form.family")}</h2>
          <div class="form-grid">
            <label class="field"><span class="lbl">{t("form.father")}</span><input type="text" name="father_name" value={v.father_name ?? ""} /></label>
            <label class="field"><span class="lbl">{t("form.mother")}</span><input type="text" name="mother_name" value={v.mother_name ?? ""} /></label>
            <label class="field"><span class="lbl">{t("form.familyGroup")}</span><select name="family_group_id">{opts(options.family_group ?? [], v.family_group_id ?? "", t("form.choose"))}</select></label>
            <label class="field"><span class="lbl">{t("form.ethnicity")}</span><select name="ethnicity_id">{opts(options.ethnicity ?? [], v.ethnicity_id ?? "", t("form.choose"))}</select></label>
            <label class="field"><span class="lbl">{t("form.education")}</span><select name="education_id">{opts(options.education ?? [], v.education_id ?? "", t("form.choose"))}</select></label>
            <label class="field"><span class="lbl">{t("form.job")}</span><input type="text" name="job" value={v.job ?? ""} /></label>
            <label class="field"><span class="lbl">{t("form.skills")}</span><input type="text" name="work_skills" value={v.work_skills ?? ""} /></label>
            <label class="field"><span class="lbl">{t("form.income")}</span><input type="text" name="income" value={v.income ?? ""} placeholder="ဥပမာ 300000" /></label>
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
                  <option value={String(r.id)} selected={v.region_id === String(r.id)}>{r.name}</option>
                ))}
              </select>
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
            <label class="field"><span class="lbl">{t("form.homeCell")}</span><select name="home_cell_id" data-region-filter="1">{opts(options.home_cell ?? [], v.home_cell_id ?? "", t("form.choose"))}</select></label>
            <label class="field"><span class="lbl">{t("form.group")}</span><select name="group_id" data-region-filter="1">{opts(options.group ?? [], v.group_id ?? "", t("form.choose"))}</select></label>
            <label class="field"><span class="lbl">{t("form.fellowship")}</span><select name="fellowship_category_id">{opts(options.fellowship_category ?? [], v.fellowship_category_id ?? "", t("form.choose"))}</select></label>
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
  fellowship: string | null;
  group_label: string | null;
  home_cell: string | null;
  ethnicity_id: number | null;
  education_id: number | null;
  family_group_id: number | null;
  fellowship_category_id: number | null;
  group_id: number | null;
  home_cell_id: number | null;
};

export function MemberDetailPage(props: Common & { m: MemberDetail }) {
  const { user, perms, flash, m, lang } = props;
  const t = getDict(lang ?? "mm");
  const isEn = (lang ?? "mm") === "en";
  const G = isEn ? GENDERS_EN : GENDERS;
  const M = isEn ? MARITAL_STATUSES_EN : MARITAL_STATUSES;
  const S = isEn ? STATUSES_EN : STATUSES;
  const rows: [string, string][] = [
    ["ID", m.member_code ?? `#${m.id}`],
    [t("detail.name"), m.name_myanmar ?? ""],
    [t("detail.nameEn"), m.name_english ?? ""],
    [t("detail.gender"), m.gender ? G[m.gender] ?? m.gender : ""],
    [t("detail.marital"), m.marital_status ? M[m.marital_status] ?? m.marital_status : ""],
    [t("detail.dob"), m.date_of_birth ?? ""],
    [t("detail.age"), m.date_of_birth ? String(ageFromDate(m.date_of_birth) ?? "—") : ""],
    [t("detail.blood"), m.blood_type],
    [t("detail.phone"), m.phone ?? ""],
    [t("detail.nrc"), m.nrc_number ?? ""],
    [t("detail.ethnicity"), m.ethnicity ?? ""],
    [t("detail.languages"), m.languages ?? ""],
    [t("detail.education"), m.education ?? ""],
    [t("detail.job"), m.job ?? ""],
    [t("detail.skills"), m.work_skills ?? ""],
    [t("detail.income"), m.income !== null ? String(m.income) : ""],
    [t("detail.address"), m.address ?? ""],
    [t("detail.father"), m.father_name ?? ""],
    [t("detail.mother"), m.mother_name ?? ""],
    [t("detail.salvation"), m.salvation_date ?? ""],
    [t("detail.familyGroup"), m.family_group ?? ""],
    ["Fellowship", m.fellowship ?? ""],
    ["Group", m.group_label ?? ""],
    ["Home Cell", m.home_cell ?? ""],
    [t("detail.state"), isEn && m.state_name_en ? m.state_name_en : m.state_name],
    [t("detail.township"), m.township ?? ""],
    [t("detail.status"), S[m.status] ?? m.status],
    [t("detail.notes"), m.notes ?? ""],
    [t("detail.updatedAt"), new Date(m.updated_at * 1000).toLocaleString("en-GB")],
  ];
  return (
    <Layout title={m.name_myanmar || m.name_english || "Member"} lang={lang} user={user} perms={perms} active="/members" flash={flash ?? null}>
      <div class="page-head">
        <h1>{m.name_myanmar || m.name_english || `#${m.id}`} <span class="muted small">{m.member_code}</span></h1>
        <div class="actions" style="margin:0">
          <a class="btn secondary" href="/members">{t("members.toList")}</a>
          {perms.has("members.update") && (
            <a class="btn js-edit-modal" href={`/members/${m.id}/edit`} data-modal-title={t("form.editTitle")}>{t("members.edit")}</a>
          )}
          {perms.has("members.delete") && (
            <form method="post" action={`/members/${m.id}/delete`} data-confirm={t("detail.confirmDelete")} style="display:inline"
             >
              <button class="btn danger" type="submit">{t("members.delete")}</button>
            </form>
          )}
        </div>
      </div>
      <div class="tbl-wrap">
        <table>
          <tbody>
            {rows.map(([label, value]) => (
              <tr>
                <th style="width:220px">{label}</th>
                <td>{value || <span class="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
  const t = getDict(lang ?? "mm");
  return (
    <Layout title="CSV Import" lang={lang} user={user} perms={perms} active="/members/import" flash={flash ?? null}>
      <div class="page-head">
        <h1>CSV Import (Bulk Upload)</h1>
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
              <button class="btn" type="submit">Upload &amp; Preview</button>
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
              <strong class="small">Row errors:</strong>
              <ul class="err-list small">
                {report.errors.map((e) => <li>Row {e.line}: {e.msg}</li>)}
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
