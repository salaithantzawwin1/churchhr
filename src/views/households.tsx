import { Layout, type Flash } from "./layout";
import type { SessionUser } from "../session";
import type { OptionRow } from "../lookup";
import { getDict, type Lang } from "../i18n";
import type { EnrolmentSummary } from "../student-enrolments";
import { CardViewToggle } from "./view-toggle";
import { regionCascadeSelects } from "./hh-cascade";
import { formatPhone, optionLabel, optionText, qs } from "../util";
import { GENDERS, GENDERS_EN, GENDERS_KR, MARITAL_STATUSES, MARITAL_STATUSES_EN, MARITAL_STATUSES_KR, STATUSES, STATUSES_EN, STATUSES_KR } from "../enums";
import { EditIcon, RemoveUserIcon, TrashIcon } from "./action-icons";
import { auditActionLabel, stamp as auditStamp, type ActivityRow } from "./audit";

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

/** Small line icon used on household cards and empty states. */
function HouseGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

export type FormValues = Record<string, string | undefined>;

/** Existing member that can be picked as the head of a new household. */
export type HeadCandidate = {
  id: number; member_code: string | null;
  name_myanmar: string | null; name_english: string | null;
  township?: string | null;
  phone?: string | null;
  address?: string | null;
  /** The member's current placement, offered as the new household's starting
   * values when this member is picked as head (see the head-picker JS). */
  region_id: number;
  home_cell_id: number | null;
  group_id: number | null;
  family_group_id: number | null;
};

export function HouseholdFormPage(props: Common & {
  values: FormValues; errors: string[]; family: { id: number } | null;
  regions: { id: number; name: string }[]; members?: HeadCandidate[];
  photoUrl?: string;
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
  options?: Record<string, OptionRow[]>; members?: HeadCandidate[];
  /** Existing family photo, shown with the member-photo picker markup. */
  photoUrl?: string;
}) {
  const { values: v, errors, family, regions, modal } = props;
  const photoUrl = props.photoUrl;
  const initial = (v.name ?? "").trim().charAt(0) || "H";
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
          <div class="photo-field hh-photo-field" data-photo-field data-initial={initial}
            data-processing={t("form.photoProcessing")} data-ready={t("form.photoReady")}
            data-error={t("form.photoError")}>
            <div class="photo-preview">
              <img data-photo-img src={photoUrl} alt="" hidden={!photoUrl} />
              <span data-photo-fallback hidden={!!photoUrl}>{initial}</span>
            </div>
            <div class="photo-controls">
              <span class="lbl">{t("hh.photo")}</span>
              <div class="photo-actions">
                <label class="btn sm secondary photo-pick">
                  {t("form.photoChoose")}
                  <input type="file" accept="image/jpeg,image/png,image/webp" data-photo-input hidden />
                </label>
                {photoUrl && (
                  <label class="muted small">
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
            {family === null && (
              <label class="field" style="grid-column:1/-1">
                <span class="lbl">{t("hh.headPick")} <span class="hint">{t("hh.headPickHint")}</span></span>
                <div class="head-picker" data-head-picker data-no-match={t("hh.headNoMatch")}>
                  <input type="search" data-head-search placeholder={t("hh.headSearch")}
                    aria-label={t("hh.headSearch")} autocomplete="off" role="combobox" aria-expanded="false" />
                  <button type="button" class="head-clear" data-head-clear aria-label={t("hh.headClear")} hidden>×</button>
                  <select name="head_member_id" data-head-select>
                    <option value="">{t("hh.headPickNone")}</option>
                    {(props.members ?? []).map((m) => {
                      const nm = (props.lang ?? "en") === "mm"
                        ? (m.name_myanmar || m.name_english)
                        : (m.name_english || m.name_myanmar);
                      return (
                        <option
                          value={String(m.id)}
                          selected={v.head_member_id === String(m.id)}
                          data-name={nm ?? ""}
                          data-phone={m.phone ?? ""}
                          data-address={m.address ?? ""}
                          data-region={String(m.region_id)}
                          data-township={m.township ?? ""}
                          data-home-cell={m.home_cell_id ? String(m.home_cell_id) : ""}
                          data-group={m.group_id ? String(m.group_id) : ""}
                          data-family-group={m.family_group_id ? String(m.family_group_id) : ""}
                        >
                          {(nm || `#${m.id}`) + (m.member_code ? ` · ${m.member_code}` : "") + (m.township ? ` · ${m.township}` : "")}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </label>
            )}
            {/* The hint sits under the input: inside the label it wrapped to a
                second line and pushed this column's input below its neighbour. */}
            <label class="field"><span class="lbl">{t("hh.name")}</span>
              <input type="text" name="name" required value={v.name ?? ""} />
              <span class="field-hint">{t("hh.nameHint")}</span></label>
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
              showFamilyGroup: false,
            })}
            <p class="hint" style="grid-column:1/-1;margin:0">{t("hh.familyGroupAuto")}</p>

            <label class="field" style="grid-column:1/-1"><span class="lbl">{t("hh.phone")}</span><input type="text" name="phone" value={v.phone ?? ""} /></label>
            <label class="field" style="grid-column:1/-1"><span class="lbl">{t("form.address")}</span><textarea name="address">{v.address ?? ""}</textarea></label>
            <label class="field" style="grid-column:1/-1"><span class="lbl">{t("form.notes")}</span><textarea name="notes">{v.notes ?? ""}</textarea></label>
          </div>
        </div>
        {/* Sticky like the member form: the submit is reachable without scrolling
            a whole form first, Cancel sits before the primary action. */}
        <div class="actions form-actions-sticky">
          <a class="btn secondary" href={family ? `/admin/households/${family.id}` : "/admin/households"}>{t("form.cancel")}</a>
          <button class="btn" type="submit">{family ? t("form.save") : t("hh.createNext")}</button>
        </div>
      </form>
    </>
  );
}

export function HouseholdsListPage(props: Common & {
  rows: any[]; q: string; township?: string;
  townshipOptions?: { id: number; label: string }[];
  region?: number | null; regions?: { id: number; name: string }[];
}) {
  const { user, perms, flash, rows, lang, q } = props;
  const t = getDict(lang ?? "en");
  // Korean reads the English data labels (region/township names).
  const isEn = (lang ?? "en") !== "mm";
  const region = props.region ?? null;
  const filtered = Boolean(q.trim() || props.township || region);
  const activeParams = { q: q.trim(), township: props.township ?? null, region: region ? String(region) : null };
  const withoutFilter = (key: keyof typeof activeParams) => `/admin/households${qs({ ...activeParams, [key]: null })}`;
  const chips: { label: string; href: string }[] = [];
  if (q.trim()) chips.push({ label: `“${q.trim()}”`, href: withoutFilter("q") });
  if (props.township) chips.push({ label: props.township, href: withoutFilter("township") });
  if (region) {
    const state = (props.regions ?? []).find((r) => r.id === region);
    chips.push({ label: state?.name ?? String(region), href: withoutFilter("region") });
  }
  return (
    <Layout title={t("hh.pageTitle")} lang={lang} user={user} perms={perms} active="/admin/households" flash={flash ?? null}>
      <div class="page-head">
        <div>
          <h1>{t("hh.pageHeading")}<span class="count-pill">{rows.length}</span></h1>
          <p class="page-sub">{t("hh.listSub")}</p>
        </div>
        <div class="actions hh-list-actions">
          <CardViewToggle lang={lang} viewKey="households" />
          {perms.has("members.create") && (
            <a class="btn js-add-modal" href="/admin/households/new" data-modal-title={t("hh.newHeading")}>+ {t("hh.newHeading")}</a>
          )}
        </div>
      </div>

      <details class={chips.length > 0 ? "filter-box filter-toolbar-box has-filters" : "filter-box filter-toolbar-box"} open>
        <summary>
          <span>{t("members.filters")}{chips.length > 0 && <span class="filter-count">{chips.length}</span>}</span>
              {chips.length > 0 && (                <span class="filter-peek" title={chips.map((c) => c.label).join(" · ")}>                  {chips.map((c) => c.label).join(" · ")}                </span>              )}          <span class="chev" aria-hidden="true">▾</span>
        </summary>
        <form class="filter-toolbar" method="get" action="/admin/households" data-auto-submit="1">
          <input type="search" name="q" value={q} placeholder={t("hh.searchPlaceholder")}
            aria-label={t("hh.searchLabel")} enterkeyhint="search" />
          <select name="region" aria-label={t("detail.state")}>
            <option value="" selected={region == null}>{t("org.allStates")}</option>
            {(props.regions ?? []).map((r) => (
              <option value={String(r.id)} selected={region === r.id}>{r.name}</option>
            ))}
          </select>
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

      {rows.length === 0 ? (
        <div class="card hh-empty">
          <span class="hh-avatar lg" aria-hidden="true"><HouseGlyph /></span>
          <h2>{filtered ? t("hh.emptyFiltered") : t("hh.empty")}</h2>
          {filtered ? (
            <p class="muted small"><a href="/admin/households">{t("members.clearFilters")}</a></p>
          ) : perms.has("members.create") ? (
            <p class="muted small"><a class="js-add-modal" href="/admin/households/new" data-modal-title={t("hh.newHeading")}>{t("hh.emptyHint")}</a></p>
          ) : null}
        </div>
      ) : (
        <div class="hh-grid" data-view-grid>
          {rows.map((f) => {
            const headName = isEn
              ? (f.head_name_en || f.head_name_mm)
              : (f.head_name_mm || f.head_name_en);
            return (
              <article class="hh-card">
                <div class="hh-card-head">
                  <span class="hh-avatar" aria-hidden="true">
                    {f.has_photo
                      ? <img src={`/admin/households/${f.id}/photo`} alt="" loading="lazy" />
                      : <HouseGlyph />}
                  </span>
                  <div class="hh-card-title">
                    <a href={`/admin/households/${f.id}`} title={f.name}>{f.name}</a>
                    <span class="hh-card-meta">
                      <span class="muted small">#{f.id}</span>
                      <span class="hh-count"><b>{f.member_count ?? 0}</b> {(f.member_count ?? 0) === 1 ? t("hh.memberCountOne") : t("hh.memberCount")}</span>
                    </span>
                  </div>
                </div>
                <div class="hh-facts">
                  <div class="hh-fact"><span class="hh-fact-label">{t("hh.head")}</span><span class="hh-fact-value">{headName || "—"}</span></div>
                  <div class="hh-fact"><span class="hh-fact-label">{t("detail.state")}</span><span class="hh-fact-value">{isEn && f.state_name_en ? f.state_name_en : f.state_name}</span></div>
                  <div class="hh-fact"><span class="hh-fact-label">{t("hh.townshipLabel")}</span><span class="hh-fact-value">{f.township || "—"}</span></div>
                  <div class="hh-fact"><span class="hh-fact-label">{t("form.homeCell")}</span><span class="hh-fact-value">{f.home_cell_label || "—"}</span></div>
                  <div class="hh-fact"><span class="hh-fact-label">{t("detail.familyGroup")}</span><span class="hh-fact-value">{optionLabel(f.family_group_code, f.family_group_label) || "—"}</span></div>
                </div>
                <div class="hh-card-actions">
                  <a class="btn sm secondary" href={`/admin/households/${f.id}`}>{t("members.open")}</a>
                  {(perms.has("members.update") || perms.has("members.delete")) && (
                    <div class="row-icon-actions">
                      {perms.has("members.update") && (
                        <a class="btn sm secondary icon-btn js-edit-modal" href={`/admin/households/${f.id}/edit`}
                          data-modal-title={t("hh.editTitle")} title={t("members.edit")} aria-label={t("members.edit")}><EditIcon /></a>
                      )}
                      {perms.has("members.delete") && (
                        <form method="post" action={`/admin/households/${f.id}/delete`}
                          data-confirm={t("hh.deleteConfirm")} data-confirm-title={t("hh.deleteTitle")}
                          data-confirm-yes={t("hh.delete")}>
                          <button class="btn sm outline-danger icon-btn" type="submit"
                            title={t("hh.deleteShort")} aria-label={t("hh.deleteShort")}><TrashIcon /></button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Layout>
  );
}

export function HouseholdDetailPage(props: Common & {
  family: any; members: any[]; rows?: any[]; enrolments?: EnrolmentSummary[]; photoUrl?: string;
  audit?: ActivityRow[];
}) {
  const { user, perms, flash, family, members: mems, lang, enrolments = [], audit = [] } = props;
  const eduByMember = new Map(enrolments.map((e) => [e.memberId, e] as const));
  const t = getDict(lang ?? "en");
  const L = lang ?? "en";
  const isEn = L !== "mm";
  const S = L === "mm" ? STATUSES : L === "kr" ? STATUSES_KR : STATUSES_EN;
  const headName = isEn
    ? (family.head_name_en || family.head_name_mm || "")
    : (family.head_name_mm || family.head_name_en || "");
  const stateName = isEn && family.state_name_en ? family.state_name_en : family.state_name;
  const nameOf = (m: any) => isEn
    ? (m.name_english || m.name_myanmar || "")
    : (m.name_myanmar || m.name_english || "");
  return (
    <Layout title={family.name} lang={lang} user={user} perms={perms} active="/admin/households" flash={flash ?? null}>
      <div class="page-head">
        <div>
          <a class="back-link" href="/admin/households">{t("hh.toList")}</a>
          <h1>{family.name}<span class="muted small"> #{family.id}</span></h1>
          <p class="page-sub">
            {stateName}
            {family.township ? ` · ${family.township}` : ""}
            {` · ${mems.length} ${mems.length === 1 ? t("hh.memberCountOne") : t("hh.memberCount")}`}
          </p>
        </div>
        <div class="actions hh-page-actions">
          {perms.has("members.update") && (
            <a class="btn secondary js-edit-modal" href={`/admin/households/${family.id}/edit`} data-modal-title={t("hh.editTitle")}>{t("members.edit")}</a>
          )}
          {perms.has("members.delete") && (
            <form method="post" action={`/admin/households/${family.id}/delete`}
              data-confirm={t("hh.deleteConfirm")} data-confirm-title={t("hh.deleteTitle")}
              data-confirm-yes={t("hh.delete")} style="display:inline">
              <button class="btn outline-danger" type="submit">{t("hh.delete")}</button>
            </form>
          )}
        </div>
      </div>

      <div class="hh-detail-grid">
        <section class="card hh-panel">
          <h2>{t("hh.cardHeading")}</h2>
          {/* The stored photo is a 500×500 square, so a square frame shows it
              whole — a portrait, a group or a landscape shot alike. */}
          <div class={props.photoUrl ? "hh-summary has-photo" : "hh-summary"}>
            {props.photoUrl && (
              <img class="hh-photo" src={props.photoUrl} alt={family.name} loading="lazy" />
            )}
            <div class="hh-facts">
              <div class="hh-fact">
                <span class="hh-fact-label">{t("hh.head")}</span>
                <span class="hh-fact-value">
                  {headName
                    ? (family.head_member_id ? <a href={`/members/${family.head_member_id}`}>{headName}</a> : headName)
                    : "—"}
                </span>
              </div>
              <div class="hh-fact">
                <span class="hh-fact-label">{t("detail.state")}</span>
                <span class="hh-fact-value">{stateName}</span>
              </div>
              <div class="hh-fact">
                <span class="hh-fact-label">{t("hh.townshipLabel")}</span>
                <span class="hh-fact-value">{family.township || "—"}</span>
              </div>
              <div class="hh-fact">
                <span class="hh-fact-label">{t("form.homeCell")}</span>
                <span class="hh-fact-value">{family.home_cell_label || "—"}</span>
              </div>
              <div class="hh-fact">
                <span class="hh-fact-label">{t("detail.familyGroup")}</span>
                <span class="hh-fact-value">{optionLabel(family.family_group_code, family.family_group_label) || "—"}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="card hh-panel">
          <h2>{t("form.contact")}</h2>
          <div class="hh-facts">
            <div class="hh-fact wide">
              <span class="hh-fact-label">{t("detail.phone")}</span>
              <span class="hh-fact-value">{family.phone
                ? <a href={`tel:${family.phone.replace(/[^\d+]/g, "")}`}>{formatPhone(family.phone)}</a>
                : "—"}</span>
            </div>
            <div class="hh-fact wide">
              <span class="hh-fact-label">{t("detail.address")}</span>
              <span class="hh-fact-value">{family.address || "—"}</span>
            </div>
            <div class="hh-fact wide">
              <span class="hh-fact-label">{t("detail.notes")}</span>
              <span class="hh-fact-value">{family.notes || "—"}</span>
            </div>
          </div>
        </section>
      </div>

      <section class="card hh-panel hh-members-panel">
        <div class="section-head">
          <h2>{t("hh.members")}<span class="count-pill">{mems.length}</span></h2>
          {perms.has("members.create") && (
            <a class="btn sm" href={`/admin/households/${family.id}/add-member`}>+ {t("hh.addExisting")}</a>
          )}
        </div>
        {mems.length === 0 ? (
          <p class="muted small" style="margin:0">{t("hh.noMembers")}</p>
        ) : (
          <div class="hh-member-list">
            {mems.map((m) => {
              const nm = nameOf(m);
              const initial = nm.trim().charAt(0) || "?";
              return (
                <div class="hh-member">
                  <span class="hh-avatar sm" aria-hidden="true">
                    {m.has_photo
                      ? <img src={`/members/${m.id}/photo?v=${m.updated_at ?? ""}`} alt="" loading="lazy" />
                      : initial}
                  </span>
                  <div class="hh-member-main">
                    <a href={`/members/${m.id}`}>{nm}</a>
                    <div class="small muted">
                      {m.member_code ? `${m.member_code} · ` : ""}
                      {S[m.status] ?? m.status}
                    </div>
                  </div>
                  {eduByMember.get(m.id) ? (
                    <span class="hh-edu" title={eduByMember.get(m.id)!.academicYear}>
                      {[eduByMember.get(m.id)!.grade, eduByMember.get(m.id)!.schoolKind === "hope"
                        ? t("edu.hopeShort")
                        : (eduByMember.get(m.id)!.schoolName || t("edu.other"))].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                  <span class="hh-rel">{RELATIONSHIPS[m.relationship]?.[L === "kr" ? "ko" : L] ?? m.relationship}</span>
                  {perms.has("members.update") && (
                    <div class="hh-member-actions">
                      <a class="btn sm secondary icon-btn js-edit-modal" href={`/members/${m.id}/edit`}
                        data-modal-title={t("form.editTitle")} title={t("members.edit")} aria-label={t("members.edit")}><EditIcon /></a>
                      <form method="post" action={`/admin/households/${family.id}/detach`}
                        data-confirm={t("hh.removeConfirm")}
                        data-confirm-title={t("hh.removeTitle")}
                        data-confirm-yes={t("hh.removeMember")}>
                        <input type="hidden" name="member_id" value={String(m.id)} />
                        <button class="btn sm outline-danger icon-btn" type="submit"
                          title={t("hh.removeMember")} aria-label={`${t("hh.removeMember")}: ${nm}`}><RemoveUserIcon /></button>
                      </form>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Last, after the members: the trail is reference material, not the
          household's day-to-day content. */}
      {perms.has("audit.view") && (
        <section class="card hh-panel hh-activity-panel">
          <div class="section-head">
            <h2>{t("activity.recent")}</h2>
            {/* entity + id, not the name: two households can share a name. */}
            <a class="btn sm secondary"
              href={`/admin/audit?entity=household&entity_id=${family.id}`}>{t("activity.all")}</a>
          </div>
          {audit.length === 0 ? (
            <p class="muted small" style="margin:0">{t("activity.empty")}</p>
          ) : (
            <ul class="activity-list">
              {audit.map((r) => (
                <li>
                  <span class="activity-when">{auditStamp(r.at)}</span>
                  <span class="activity-what">{auditActionLabel(t, r.action)}</span>
                  {r.summary && <span class="activity-summary">{r.summary}</span>}
                  <span class="activity-who">{r.username || "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </Layout>
  );
}

export function HouseholdSearchMemberPage(props: Common & {
  family: any; q: string; results: any[]; searched: boolean;
}) {
  const { user, perms, flash, family, q, results, searched, lang } = props;
  const t = getDict(lang ?? "en");
  const L = lang ?? "en";
  const isEn = L !== "mm";
  const REL = relationshipOptions(lang);
  const headExists = Boolean(family.head_member_id);
  const relOptions = Object.entries(REL).filter(([k]) => k !== "head" || !headExists);
  const defaultRel = headExists ? "spouse" : "head";
  return (
    <Layout title={t("hh.addExisting")} lang={lang} user={user} perms={perms} active="/admin/households" flash={flash ?? null}>
      <div class="page-head">
        <div>
          <a class="back-link" href={`/admin/households/${family.id}`}>{t("hh.toList")}</a>
          <h1>{t("hh.addExisting")}<span class="muted small"> · {family.name}</span></h1>
        </div>
      </div>

      <div class="card">
        <p class="muted small" style="margin-top:0">{t("hh.pick.hint")}</p>
        <div class="hh-pick-search-wrap"
          data-live-search
          data-searching={t("hh.pick.searching")}
          data-search-error={t("hh.pick.searchError")}>
          <form method="get" action={`/admin/households/${family.id}/add-member`} class="hh-pick-search">
            <label class="field">
              <span class="lbl">{t("hh.pick.searchLabel")}</span>
              <input type="search" name="q" value={q} placeholder={t("hh.pick.placeholder")}
                autocomplete="off" data-live-search-input role="combobox" aria-autocomplete="list"
                aria-haspopup="listbox" aria-controls="hh-live-results-items" aria-expanded="false" />
            </label>
            <button class="btn" type="submit">{t("members.searchBtn")}</button>
          </form>
          <div class="hh-live-results" id="hh-live-results" role="region"
            aria-label={t("hh.pick.searchLabel")} aria-live="polite" hidden>
            <p class="muted small hh-live-msg" data-live-search-msg hidden></p>
            <div id="hh-live-results-items" data-live-search-items></div>
          </div>
        </div>
      </div>

      <div data-hh-results>
        {!searched ? (
          <div class="card hh-empty hh-empty-sm">
            <p class="muted small" style="margin:0">{t("hh.pick.noQuery")}</p>
            <p class="small" style="margin:6px 0 0"><a href="/members">{t("hh.membersLink")}</a></p>
          </div>
        ) : results.length === 0 ? (
          <div class="card hh-empty hh-empty-sm">
            <p class="muted small" style="margin:0">{t("hh.pick.empty")}</p>
            <p class="small" style="margin:6px 0 0"><a href="/members">{t("hh.membersLink")}</a></p>
          </div>
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
                      {m.phone && <span> · {formatPhone(m.phone)}</span>}
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
            <label class="field"><span class="lbl">{t("form.dob")}</span><input type="text" name="date_of_birth" value={v.date_of_birth ?? ""} placeholder="YYYY-MM-DD" inputmode="numeric" autocomplete="off" data-datepicker="1" /></label>
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
              showFamilyGroup: false,
            })}
            <p class="hint" style="grid-column:1/-1;margin:0">{t("hh.familyGroupAuto")}</p>
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
        <div class="actions form-actions-sticky">
          <a class="btn secondary" href={`/admin/households/${family.id}`}>{t("form.cancel")}</a>
          <button class="btn" type="submit">{t("hh.addToHousehold")}</button>
        </div>
      </form>
    </Layout>
  );
}
