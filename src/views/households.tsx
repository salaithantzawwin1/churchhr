import { Layout, type Flash } from "./layout";
import type { SessionUser } from "../session";
import type { OptionRow } from "../lookup";
import { getDict, type Lang } from "../i18n";
import { regionCascadeSelects } from "./hh-cascade";

type Common = { user: SessionUser; perms: Set<string>; flash?: Flash; lang?: Lang };

export type FormValues = Record<string, string | undefined>;

export function HouseholdFormPage(props: Common & {
  values: FormValues; errors: string[]; family: { id: number } | null;
  regions: { id: number; name: string }[];
}) {
  const { user, perms, lang } = props;
  const t = getDict(lang ?? "mm");
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
  const t = getDict(props.lang ?? "mm");
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
              lang: props.lang ?? "mm",
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

export function HouseholdsListPage(props: Common & { rows: any[]; q: string }) {
  const { user, perms, flash, rows, lang, q } = props;
  const t = getDict(lang ?? "mm");
  const isEn = (lang ?? "mm") === "en";
  return (
    <Layout title={t("hh.pageTitle")} lang={lang} user={user} perms={perms} active="/admin/households" flash={flash ?? null}>
      <div class="page-head">
        <h1>{t("hh.pageHeading")}</h1>
        <div class="actions">
          {perms.has("members.create") && (
            <a class="btn js-add-modal" href="/admin/households/new" data-modal-title={t("hh.newHeading")}>+ {t("hh.newHeading")}</a>
          )}
        </div>
      </div>

      <form method="get" action="/admin/households" class="filters card">
        <input type="text" name="q" value={q} placeholder={t("hh.searchPlaceholder")} style="max-width:280px" />
        <button class="btn secondary" type="submit">{t("members.search")}</button>
      </form>

      <div class="tbl-wrap">
        <table class="list-tbl">
          <thead><tr>
            <th>ID</th><th>{t("hh.name")}</th><th>{isEn ? "Head" : "အိမ်ထောင်ဦးစီး"}</th>
            <th class="num">{isEn ? "Members" : "အဆူရေ"}</th>
            <th>{t("detail.state")}</th><th>{t("hh.townshipLabel")}</th><th></th>
          </tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} style="text-align:center" class="muted">{t("hh.empty")}</td></tr>
            ) : rows.map((f) => (
              <tr key={f.id}>
                <td>{f.id}</td>
                <td><a href={`/admin/households/${f.id}`}>{f.name}</a></td>
                <td>{f.head_name_mm || f.head_name_en || <span class="muted">—</span>}</td>
                <td class="num">{f.member_count ?? 0}</td>
                <td>{isEn && f.state_name_en ? f.state_name_en : f.state_name}</td>
                <td>{f.township ?? ""}</td>
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
  const t = getDict(lang ?? "mm");
  const isEn = (lang ?? "mm") === "en";
  const headName = family.head_name_mm || family.head_name_en || "";
  const REL: Record<string, { mm: string; en: string }> = {
    head: { mm: "အိမ်ထောင်ဦးစီး", en: "Head" },
    spouse: { mm: "ဇनီ/မောင်", en: "Spouse" },
    son: { mm: "သား", en: "Son" },
    daughter: { mm: "သမီး", en: "Daughter" },
    father: { mm: "အဖ", en: "Father" },
    mother: { mm: "အမိ", en: "Mother" },
    brother: { mm: "ညီအကို/မောင်", en: "Brother" },
    sister: { mm: "အစ်မ/အစ်မိ", en: "Sister" },
    grandchild: { mm: "မြေး", en: "Grandchild" },
    other: { mm: "အခြား", en: "Other" },
  };
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
          <tr><th>{isEn ? "Head" : "အိမ်ထောင်ဦးစီး"}</th><td>{headName || <span class="muted">—</span>}</td></tr>
          <tr><th>{t("detail.state")}</th><td>{isEn && family.state_name_en ? family.state_name_en : family.state_name}</td></tr>
          <tr><th>{t("hh.townshipLabel")}</th><td>{family.township}</td></tr>
          <tr><th>{t("detail.address")}</th><td>{family.address}</td></tr>
          <tr><th>{t("detail.phone")}</th><td>{family.phone}</td></tr>
          <tr><th>{t("detail.notes")}</th><td>{family.notes}</td></tr>
        </tbody></table>
      </div>

      <div class="card" style="margin-top:18px">
        <h2>{isEn ? "Household members" : "မိသားစုဝင်များ"} {mems.length > 0 && <span class="muted small">({mems.length})</span>}</h2>
        {perms.has("members.create") && (
          <p style="margin-bottom:8px">
            <a class="btn sm" href={`/admin/households/${family.id}/add-member`}>+ {isEn ? "Add family member" : "မိသားစုဝင် ထည့်ရန်"}</a>
          </p>
        )}
        {mems.length === 0 ? (
          <p class="muted small">{isEn ? "No members in this household yet." : "မိသားစုဝင် မရှိသေးပါ။"}</p>
        ) : (
          <div class="tbl-wrap">
            <table>
              <thead><tr><th>ID</th><th>{t("detail.name")}</th><th>{isEn ? "Relationship" : "ဆွဲဆွဲအပြစ်"}</th><th>{isEn ? "Status" : "အခြေအနေ"}</th><th></th></tr></thead>
              <tbody>
                {mems.map((m) => (
                  <tr>
                    <td>{m.id}</td>
                    <td><a href={`/members/${m.id}`}>{m.name_myanmar || m.name_english}</a></td>
                    <td>{REL[m.relationship]?.[isEn ? "en" : "mm"] ?? m.relationship}</td>
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

export function HouseholdAddMemberPage(props: Common & {
  family: any; values: Record<string, string>; errors: string[]; relationship: string;
  options?: Record<string, OptionRow[]>;
  regions?: { id: number; name: string }[];
}) {
  const { user, perms, family, values: v, errors, lang } = props;
  const t = getDict(lang ?? "mm");
  const isEn = (lang ?? "mm") === "en";
  const REL = HouseholdDetailPageRel(isEn);
  return (
    <Layout title={t("hh.addMember.title")} lang={lang} user={user} perms={perms} active="/admin/households">
      <div class="page-head">
        <h1>{t("hh.addMember.heading")} — {family.name}</h1>
        <a class="btn secondary" href={`/admin/households/${family.id}`}>{t("hh.toList")}</a>
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
              <span class="lbl">{isEn ? "Relationship to household" : "အိမ်ထောင်နှင့် ဆွဲဆွဲအပြစ်"}</span>
              <select name="relationship" value={props.relationship}>
                {Object.entries(REL).map(([k, label]) => <option value={k} selected={props.relationship === k}>{label}</option>)}
              </select>
              <span class="hint">{t("hh.addMember.relHint")}</span>
            </label>
            <label class="field"><span class="lbl">{t("form.nameMm")}</span><input type="text" name="name_myanmar" value={v.name_myanmar ?? ""} /></label>
            <label class="field"><span class="lbl">{t("form.nameEn")}</span><input type="text" name="name_english" value={v.name_english ?? ""} /></label>
            <label class="field"><span class="lbl">{t("form.gender")}</span>
              <select name="gender">
                <option value="">{t("form.choose")}</option>
                <option value="male" selected={v.gender === "male"}>{isEn ? "Male" : "အမျိုးသား"}</option>
                <option value="female" selected={v.gender === "female"}>{isEn ? "Female" : "အမျိုးသမီး"}</option>
              </select></label>
            <label class="field"><span class="lbl">{t("form.dob")}</span><input type="date" name="date_of_birth" value={v.date_of_birth ?? ""} /></label>
            <label class="field"><span class="lbl">{t("form.phone")}</span><input type="text" name="phone" value={v.phone ?? ""} /></label>
            <label class="field"><span class="lbl">{t("form.nrc")}</span><input type="text" name="nrc_number" value={v.nrc_number ?? ""} /></label>
            <label class="field"><span class="lbl">{isEn ? "Marital status" : "အိမ်ထောင်ရေး"}</span>
              <select name="marital_status">
                <option value="">{t("form.choose")}</option>
                <option value="single" selected={v.marital_status === "single"}>{isEn ? "Single" : "အိမ်ထောင်မရှိ"}</option>
                <option value="married" selected={v.marital_status === "married"}>{isEn ? "Married" : "အိမ်ထောင်ရှိ"}</option>
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
            {isEn
              ? "For the household head: pick the Family Group / Group / Home Cell — every other member added to this household copies these automatically."
              : "အိမ်ထောင်ဦးစီးအတွက် Family Group / Group / Home Cell ရွေးပါ — ဒီမိသားစုထဲ နောက်ထည့်မယ့် အဖွဲ့ဝင်အားလုံးက အလိုအလျောက် ကူးယူပါမည်။"}
          </p>
          <div class="form-grid">
            {regionCascadeSelects({
              lang: props.lang ?? "mm",
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
                <option value="active" selected={(v.status || "active") === "active"}>{isEn ? "Active" : "ပုံမှန်"}</option>
                <option value="inactive" selected={v.status === "inactive"}>{isEn ? "Inactive" : "ရပ်တန့်"}</option>
              </select>
            </label>
          </div>
        </div>
        <div class="actions">
          <button class="btn" type="submit">{isEn ? "Add to household" : "မိသားစုထဲသို့ ထည့်ရန်"}</button>
          <a class="btn secondary" href={`/admin/households/${family.id}`}>{t("form.cancel")}</a>
        </div>
      </form>
    </Layout>
  );
}

function HouseholdDetailPageRel(isEn: boolean): Record<string, string> {
  return isEn
    ? { head: "Head", spouse: "Spouse", son: "Son", daughter: "Daughter", father: "Father", mother: "Mother", brother: "Brother", sister: "Sister", grandchild: "Grandchild", other: "Other" }
    : { head: "အိမ်ထောင်ဦးစီး", spouse: "ဇနီး/ခင်ပွန်း", son: "သား", daughter: "သမီး", father: "အဖ", mother: "အမိ", brother: "ညီအကို", sister: "အစ်မ/ညီမ", grandchild: "မြေး", other: "အခြား" };
}
