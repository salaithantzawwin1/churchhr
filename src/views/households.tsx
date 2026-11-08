import { Layout, type Flash } from "./layout";
import type { SessionUser } from "../session";
import type { OptionRow } from "../lookup";
import { getDict, type Lang } from "../i18n";
import { regionCascadeSelects } from "./hh-cascade";
import { qs } from "../util";
import { GENDERS, GENDERS_EN, GENDERS_KR, MARITAL_STATUSES, MARITAL_STATUSES_EN, MARITAL_STATUSES_KR, STATUSES, STATUSES_EN, STATUSES_KR } from "../enums";

/** Household relationships: stored key -> label per UI language. */
const RELATIONSHIPS: Record<string, { mm: string; en: string; ko: string }> = {
  head: { mm: "အိမ်ထောင်ဦးစီး", en: "Head", ko: "가장" },
  spouse: { mm: "ဇနီး/ခင်ပွန်း", en: "Spouse", ko: "배우자" },
  son: { mm: "သား", en: "Son", ko: "아들" },
  daughter: { mm: "သမီး", en: "Daughter", ko: "딸" },
  father: { mm: "အဖ", en: "Father", ko: "아버지" },
  mother: { mm: "အမိ", en: "Mother", ko: "어머니" },
  brother: { mm: "ညီအကို", en: "Brother", ko: "형제" },
  sister: { mm: "အစ်မ/ညီမ", en: "Sister", ko: "자매" },
  grandchild: { mm: "မြေး", en: "Grandchild", ko: "손자녀" },
  other: { mm: "အခြား", en: "Other", ko: "기타" },
};

function relationshipOptions(lang?: Lang): Record<string, string> {
  const L = lang ?? "en";
  const key: "mm" | "en" | "ko" = L === "kr" ? "ko" : L;
  return Object.fromEntries(Object.entries(RELATIONSHIPS).map(([k, v]) => [k, v[key]]));
}

type Common = { user: SessionUser; perms: Set<string>; flash?: Flash; lang?: Lang };

export type FormValues = Record<string, string | undefined>;

export function HouseholdFormPage(props: Common & {
  values: FormValues; errors: string[]; family: { id: number } | null;
  regions: { id: number; name: string }[];
}) {
  const { user, perms, lang } = props;
  const t = getDict(lang ?? "en");
  const edit = props.family !== null;
  return (
    <Layout title={edit ? t("hh.editTitle") : t("hh.newTitle")} lang={lang} user={user} perms={perms} active="/admin/households">
      <div class="page-head"><h1>{edit ? t("hh.editHeading") : t("hh.newHeading")}</h1>
        <a class="btn secondary" href={edit ? `/admin/households/${props.family!.id}` : "/admin/households"}>{t("members.back")}</a></div>
      <HouseholdFormFragment {...props} />
    </Layout>
  );
}

export function HouseholdFormFragment(props: Common & {
  values: FormValues; errors: string[]; family: { id: number } | null;
  regions: { id: number; name: string }[]; modal?: boolean;
  options?: Record<string, OptionRow[]>;
}) {
  const { values: v, errors, family, regions, modal } = props;
  const t = getDict(props.lang ?? "en");
  const action = family ? `/admin/households/${family.id}` : "/admin/households";
  return (
    <>
      {errors.length > 0 && (
        <div class="flash err"><strong>{t("form.invalid")}</strong>
          <ul class="err-list">{errors.map((e) => <li>{e}</li>)}</ul></div>
      )}
      <form method="post" action={action} data-flash-ok={modal ? "hh.updated" : undefined}>
        {modal && <input type="hidden" name="from_modal" value="1" />}
        <div class="card">
          <h2>{t("hh.cardHeading")}</h2>
          <div class="form-grid">
            <label class="field"><span class="lbl">{t("hh.name")} <span class="hint">{t("hh.nameHint")}</span></span>
              <input type="text" name="name" required value={v.name ?? ""} /></label>
            {regionCascadeSelects({
              lang: props.lang ?? "en",
              regions,
              regionId: v.region_id ?? "",
              township: v.township ?? "",
              townshipOpts: props.options?.township ?? [],
              homeCellId: v.home_cell_id ?? "",
              homeCellOpts: props.options?.home_cell ?? [],
              groupId: v.group_id ?? "",
              groupOpts: props.options?.group ?? [],
              familyGroupId: v.family_group_id ?? "",
              familyGroupOpts: props.options?.family_group ?? [],
            })}

            <label class="field"><span class="lbl">{t("hh.phone")}</span><input type="text" name="phone" value={v.phone ?? ""} /></label>
            <label class="field" style="grid-column:1/-1"><span class="lbl">{t("form.address")}</span><textarea name="address">{v.address ?? ""}</textarea></label>
            <label class="field" style="grid-column:1/-1"><span class="lbl">{t("form.notes")}</span><textarea name="notes">{v.notes ?? ""}</textarea></label>
          </div>
        </div>
        <div class="actions">
          <button class="btn" type="submit">{family ? t("form.save") : t("hh.createNext")}</button>
          <a class="btn secondary" href={family ? `/admin/households/${family.id}` : "/admin/households"}>{t("form.cancel")}</a>
        </div>
      </form>
    </>
  );
}

export function HouseholdsListPage(props: Common & { rows: any[]; q: string; township?: string; townshipOptions?: { id: number; label: string }[] }) {
  const { user, perms, flash, rows, lang, q } = props;
  const t = getDict(lang ?? "en");
  // Korean reads the English data labels (region/township names).
  const isEn = (lang ?? "en") !== "mm";
  const filtered = Boolean(q.trim() || props.township);
  const activeParams = { q: q.trim(), township: props.township ?? null };
  const withoutFilter = (key: keyof typeof activeParams) => `/admin/households${qs({ ...activeParams, [key]: null })}`;
  const chips: { label: string; href: string }[] = [];
  if (q.trim()) chips.push({ label: `“${q.trim()}”`, href: withoutFilter("q") });
  if (props.township) chips.push({ label: props.township, href: withoutFilter("township") });
  return (
    <Layout title={t("hh.pageTitle")} lang={lang} user={user} perms={perms} active="/admin/households" flash={flash ?? null}>
      <div class="page-head">
        <h1>{t("hh.pageHeading")}<span class="count-pill">{rows.length}</span></h1>
        <div class="actions">
          {perms.has("members.create") && (
            <a class="btn js-add-modal" href="/admin/households/new" data-modal-title={t("hh.newHeading")}>+ {t("hh.newHeading")}</a>
          )}
        </div>
      </div>

      <details class="filter-box filter-toolbar-box" open>
        <summary>
          <span>{t("members.filters")}{chips.length > 0 && <span class="filter-count">{chips.length}</span>}</span>
          <span class="chev" aria-hidden="true">▾</span>
        </summary>
        <form class="filter-toolbar" method="get" action="/admin/households" data-auto-submit="1">
          <input type="search" name="q" value={q} placeholder={t("hh.searchPlaceholder")}
            aria-label={t("hh.searchLabel")} enterkeyhint="search" />
          <select name="township" aria-label={t("hh.townshipLabel")}>
            <option value="">{t("dash.allTownships")}</option>
            {(props.townshipOptions ?? []).map((o) => (
              <option value={o.label} selected={props.township === o.label}>{o.label}</option>
            ))}
          </select>
          {filtered && <a class="filter-clear" href="/admin/households">{t("members.clear")}</a>}
        </form>
      </details>

      {chips.length > 0 && (
        <div class="filter-chips" aria-label={t("dash.activeFilters")}>
          {chips.map((c) => (
            <a class="filter-chip" href={c.href} aria-label={`${t("dash.removeFilter")}: ${c.label}`}>
              {c.label}<span class="chip-x" aria-hidden="true">×</span>
            </a>
          ))}
          <a class="filter-clear-all" href="/admin/households">{t("dash.clearAll")}</a>
        </div>
      )}

      <div class="tbl-wrap">
        <table class="list-tbl">
          <thead><tr>
            <th>ID</th><th>{t("hh.name")}</th><th>{t("hh.head")}</th>
            <th class="num">{t("hh.memberCount")}</th>
            <th>{t("detail.state")}</th><th>{t("hh.townshipLabel")}</th>
            <th>{t("form.homeCell")}</th><th></th>
          </tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} class="empty-state">
                  {filtered ? (
                    <>
                      <strong>{t("hh.emptyFiltered")}</strong>
                      <div class="small"><a href="/admin/households">{t("members.clearFilters")}</a></div>
                    </>
                  ) : (
                    <>
                      <strong>{t("hh.empty")}</strong>
                      {perms.has("members.create") && (
                        <div class="small">
                          <a class="js-add-modal" href="/admin/households/new" data-modal-title={t("hh.newHeading")}>{t("hh.emptyHint")}</a>
                        </div>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ) : rows.map((f) => (
              <tr key={f.id}>
                <td>{f.id}</td>
                <td><a href={`/admin/households/${f.id}`}>{f.name}</a></td>
                <td>{f.head_name_mm || f.head_name_en || <span class="muted">—</span>}</td>
                <td class="num">{f.member_count ?? 0}</td>
                <td>{isEn && f.state_name_en ? f.state_name_en : f.state_name}</td>
                <td>{f.township ?? ""}</td>
                <td>{f.home_cell_label || <span class="muted">—</span>}</td>
                <td>{perms.has("members.update") && <a class="btn sm js-edit-modal" href={`/admin/households/${f.id}/edit`}>{t("members.edit")}</a>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

export function HouseholdDetailPage(props: Common & { family: any; members: any[]; rows?: any[] }) {
  const { user, perms, flash, family, members: mems, lang } = props;
  const t = getDict(lang ?? "en");
  const L = lang ?? "en";
  const isEn = L !== "mm";
  const headName = family.head_name_mm || family.head_name_en || "";
  return (
    <Layout title={family.name} lang={lang} user={user} perms={perms} active="/admin/households" flash={flash ?? null}>
      <div class="page-head">
        <h1>{family.name} <span class="muted small">#{family.id}</span></h1>
        <div class="actions" style="margin:0">
          <a class="btn secondary" href="/admin/households">{t("hh.toList")}</a>
          {perms.has("members.update") && <a class="btn js-edit-modal" href={`/admin/households/${family.id}/edit`} data-modal-title={t("hh.editTitle")} data-modal-size="md">{t("members.edit")}</a>}
        </div>
      </div>

      <div class="tbl-wrap">
        <table><tbody>
          <tr><th style="width:220px">{t("hh.name")}</th><td>{family.name}</td></tr>
          <tr><th>{t("hh.head")}</th><td>{headName || <span class="muted">—</span>}</td></tr>
          <tr><th>{t("detail.state")}</th><td>{isEn && family.state_name_en ? family.state_name_en : family.state_name}</td></tr>
          <tr><th>{t("hh.townshipLabel")}</th><td>{family.township}</td></tr>
          <tr><th>{t("form.homeCell")}</th><td>{family.home_cell_label || <span class="muted">—</span>}</td></tr>
          <tr><th>{t("detail.address")}</th><td>{family.address}</td></tr>
          <tr><th>{t("detail.phone")}</th><td>{family.phone}</td></tr>
          <tr><th>{t("detail.notes")}</th><td>{family.notes}</td></tr>
        </tbody></table>
      </div>

      <div class="card" style="margin-top:18px">
        <h2>{t("hh.members")} {mems.length > 0 && <span class="muted small">({mems.length})</span>}</h2>
        {perms.has("members.create") && (
          <p style="margin-bottom:8px">
            <a class="btn sm" href={`/admin/households/${family.id}/add-member`}>+ {t("hh.addMember.title")}</a>
          </p>
        )}
        {mems.length === 0 ? (
          <p class="muted small">{t("hh.noMembers")}</p>
        ) : (
          <div class="tbl-wrap">
            <table>
              <thead><tr><th>ID</th><th>{t("detail.name")}</th><th>{t("hh.relationship")}</th><th>{t("detail.status")}</th><th></th></tr></thead>
              <tbody>
                {mems.map((m) => (
                  <tr>
                    <td>{m.id}</td>
                    <td><a href={`/members/${m.id}`}>{m.name_myanmar || m.name_english}</a></td>
                    <td>{RELATIONSHIPS[m.relationship]?.[L === "kr" ? "ko" : L] ?? m.relationship}</td>
                    <td><span class={`badge ${m.status}`}>{m.status}</span></td>
                    {perms.has("members.update") && (
                      <td><a class="btn sm secondary js-edit-modal" href={`/members/${m.id}/edit`} data-modal-title={t("form.editTitle")}>{t("members.edit")}</a></td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}

export function HouseholdSearchMemberPage(props: Common & {
  family: any; q: string; results: any[]; searched: boolean;
}) {
  const { user, perms, family, q, results, searched, lang } = props;
  const t = getDict(lang ?? "en");
  const L = lang ?? "en";
  const isEn = L !== "mm";
  const REL = relationshipOptions(lang);
  const headExists = Boolean(family.head_member_id);
  const relOptions = Object.entries(REL).filter(([k]) => k !== "head" || !headExists);
  const defaultRel = headExists ? "spouse" : "head";
  return (
    <Layout title={t("hh.addMember.title")} lang={lang} user={user} perms={perms} active="/admin/households">
      <div class="page-head">
        <h1>{t("hh.addMember.heading")} — {family.name}</h1>
        <div class="page-actions">
          <a class="btn secondary" href={`/admin/households/${family.id}`}>{t("hh.toList")}</a>
          <a class="btn" href={`/admin/households/${family.id}/add-member?new=1`}>+ {t("hh.pick.createNew")}</a>
        </div>
      </div>

      <div class="card">
        <p class="muted small" style="margin-top:0">{t("hh.pick.hint")}</p>
        <form method="get" action={`/admin/households/${family.id}/add-member`} class="hh-pick-search">
          <label class="field">
            <span class="lbl">{t("hh.pick.searchLabel")}</span>
            <input type="search" name="q" value={q} placeholder={t("hh.pick.placeholder")} />
          </label>
          <button class="btn" type="submit">{t("members.searchBtn")}</button>
        </form>
      </div>

      {!searched ? (
        <p class="muted small">{t("hh.pick.noQuery")}</p>
      ) : results.length === 0 ? (
        <div class="card"><p class="muted small" style="margin:0">{t("hh.pick.empty")}</p></div>
      ) : (
        <div>
          {results.map((m) => {
            const primary = L === "mm"
              ? (m.name_myanmar || m.name_english)
              : (m.name_english || m.name_myanmar);
            const secondary = primary === m.name_myanmar ? m.name_english : m.name_myanmar;
            return (
              <div class="hh-pick">
                <div class="hh-pick-main">
                  <div>
                    <a class="hh-pick-name" href={`/members/${m.id}`}>{primary}</a>
                    {m.member_code && <span class="muted small" style="margin-left:6px">{m.member_code}</span>}
                  </div>
                  <div class="hh-pick-meta">
                    {secondary && secondary !== primary && <span>{secondary} · </span>}
                    {isEn && m.state_name_en ? m.state_name_en : m.state_name}
                    {m.phone && <span> · {m.phone}</span>}
                  </div>
                  <div style="margin-top:4px">
                    {m.family_id
                      ? <span class="badge moved">{t("hh.pick.current")}: {m.family_name}</span>
                      : <span class="muted small">{t("hh.pick.none")}</span>}
                  </div>
                </div>
                <form method="post" action={`/admin/households/${family.id}/attach`} class="hh-pick-actions">
                  <input type="hidden" name="member_id" value={String(m.id)} />
                  <select name="relationship" aria-label={t("hh.relationship")}>
                    {relOptions.map(([k, label]) => (
                      <option value={k} selected={k === defaultRel}>{label}</option>
                    ))}
                  </select>
                  <button class="btn sm" type="submit" aria-label={`${m.family_id ? t("hh.pick.move") : t("form.add")}: ${primary}`}>
                    {m.family_id ? t("hh.pick.move") : t("form.add")}
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}

export function HouseholdAddMemberPage(props: Common & {
  family: any; values: Record<string, string>; errors: string[]; relationship: string;
  options?: Record<string, OptionRow[]>;
  regions?: { id: number; name: string }[];
}) {
  const { user, perms, family, values: v, errors, lang } = props;
  const t = getDict(lang ?? "en");
  const L = lang ?? "en";
  const REL = relationshipOptions(lang);
  const G = L === "mm" ? GENDERS : L === "kr" ? GENDERS_KR : GENDERS_EN;
  const M = L === "mm" ? MARITAL_STATUSES : L === "kr" ? MARITAL_STATUSES_KR : MARITAL_STATUSES_EN;
  const S = L === "mm" ? STATUSES : L === "kr" ? STATUSES_KR : STATUSES_EN;
  return (
    <Layout title={t("hh.addMember.title")} lang={lang} user={user} perms={perms} active="/admin/households">
      <div class="page-head">
        <h1>{t("hh.addMember.heading")} — {family.name}</h1>
        <div class="page-actions">
          <a class="btn secondary" href={`/admin/households/${family.id}/add-member`}>{t("hh.pick.searchExisting")}</a>
          <a class="btn secondary" href={`/admin/households/${family.id}`}>{t("hh.toList")}</a>
        </div>
      </div>
      {errors.length > 0 && (
        <div class="flash err"><strong>{t("form.invalid")}</strong>
          <ul class="err-list">{errors.map((e) => <li>{e}</li>)}</ul></div>
      )}
      <form method="post" action={`/admin/households/${family.id}/add-member`}>
        <div class="card">
          <h2>{t("form.basic")}</h2>
          <div class="form-grid">
            <label class="field">
              <span class="lbl">{t("hh.relationshipTo")}</span>
              <select name="relationship" value={props.relationship}>
                {Object.entries(REL)
                  .filter(([k]) => k !== "head" || !family.head_member_id)
                  .map(([k, label]) => <option value={k} selected={props.relationship === k}>{label}</option>)}
              </select>
              <span class="hint">{t("hh.addMember.relHint")}</span>
            </label>
            <label class="field"><span class="lbl">{t("form.nameMm")}</span><input type="text" name="name_myanmar" value={v.name_myanmar ?? ""} /></label>
            <label class="field"><span class="lbl">{t("form.nameEn")}</span><input type="text" name="name_english" value={v.name_english ?? ""} /></label>
            <label class="field"><span class="lbl">{t("form.gender")}</span>
              <select name="gender">
                <option value="">{t("form.choose")}</option>
                <option value="male" selected={v.gender === "male"}>{G.male}</option>
                <option value="female" selected={v.gender === "female"}>{G.female}</option>
              </select></label>
            <label class="field"><span class="lbl">{t("form.dob")}</span><input type="date" name="date_of_birth" value={v.date_of_birth ?? ""} /></label>
            <label class="field"><span class="lbl">{t("form.phone")}</span><input type="text" name="phone" value={v.phone ?? ""} /></label>
            <label class="field"><span class="lbl">{t("form.nrc")}</span><input type="text" name="nrc_number" value={v.nrc_number ?? ""} /></label>
            <label class="field"><span class="lbl">{t("form.marital")}</span>
              <select name="marital_status">
                <option value="">{t("form.choose")}</option>
                <option value="single" selected={v.marital_status === "single"}>{M.single}</option>
                <option value="married" selected={v.marital_status === "married"}>{M.married}</option>
              </select></label>
          </div>
        </div>
        <div class="card">
          <h2>{t("form.contact")}</h2>
          <div class="form-grid">
            <label class="field" style="grid-column:1/-1"><span class="lbl">{t("form.address")}</span><textarea name="address">{v.address ?? ""}</textarea></label>
          </div>
        </div>
        <div class="card">
          <h2>{t("form.church")}</h2>
          <p class="muted small" style="margin-top:0">
            {t("hh.headAssignHint")}
          </p>
          <div class="form-grid">
            {regionCascadeSelects({
              lang: props.lang ?? "en",
              regions: props.regions ?? [],
              regionId: v.region_id ?? "",
              township: v.township ?? "",
              townshipOpts: props.options?.township ?? [],
              homeCellId: v.home_cell_id ?? "",
              homeCellOpts: props.options?.home_cell ?? [],
              groupId: v.group_id ?? "",
              groupOpts: props.options?.group ?? [],
              familyGroupId: v.family_group_id ?? "",
              familyGroupOpts: props.options?.family_group ?? [],
            })}
            <label class="field"><span class="lbl">{t("form.fellowship")}</span>
              <select name="fellowship_category_id">
                <option value="">{t("form.choose")}</option>
                {(props.options?.fellowship_category ?? []).map((o) => (
                  <option value={String(o.id)} selected={v.fellowship_category_id === String(o.id)}>{o.label}</option>
                ))}
              </select>
            </label>
            <label class="field"><span class="lbl">{t("form.statusLabel")}</span>
              <select name="status">
                <option value="active" selected={(v.status || "active") === "active"}>{S.active}</option>
                <option value="inactive" selected={v.status === "inactive"}>{S.inactive}</option>
              </select>
            </label>
          </div>
        </div>
        <div class="actions">
          <button class="btn" type="submit">{t("hh.addToHousehold")}</button>
          <a class="btn secondary" href={`/admin/households/${family.id}`}>{t("form.cancel")}</a>
        </div>
      </form>
    </Layout>
  );
}
