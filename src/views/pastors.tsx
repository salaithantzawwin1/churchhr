import { Layout, type Flash } from "./layout";
import type { SessionUser } from "../session";
import { getDict, type Lang } from "../i18n";
import { pastorName, type PastorRow } from "../pastors";
import type { PastorHistoryRow, PastorHistoryValues } from "../pastor-history";
import { CardViewToggle } from "./view-toggle";

type Common = { user: SessionUser; perms: Set<string>; flash?: Flash; lang?: Lang };
type ChurchOption = { id: number; name: string; regionId: number };
export type SpouseOption = { id: number; name: string; nameEn: string | null; title: string | null };

export type PastorValues = {
  name: string;
  nameEn: string;
  title: string;
  position: string;
  gender: string;
  maritalStatus: string;
  dateOfBirth: string;
  regionId: number | "";
  regionalChurchId: number | "";
  phone: string;
  email: string;
  address: string;
  ordinationDate: string;
  notes: string;
  sortOrder: number;
  active: boolean;
  spouseId: number | "";
};

function pastorValues(pastor?: PastorRow): PastorValues {
  return {
    name: pastor?.name ?? "",
    nameEn: pastor?.nameEn ?? "",
    title: pastor?.title ?? "",
    position: pastor?.position ?? "",
    gender: pastor?.gender ?? "",
    maritalStatus: pastor?.maritalStatus ?? "",
    dateOfBirth: pastor?.dateOfBirth ?? "",
    regionId: pastor?.regionId ?? "",
    regionalChurchId: pastor?.regionalChurchId ?? "",
    phone: pastor?.phone ?? "",
    email: pastor?.email ?? "",
    address: pastor?.address ?? "",
    ordinationDate: pastor?.ordinationDate ?? "",
    notes: pastor?.notes ?? "",
    sortOrder: pastor?.sortOrder ?? 0,
    active: pastor ? pastor.active === 1 : true,
    spouseId: pastor?.spousePastorId ?? "",
  };
}

function spouseLabel(spouse: SpouseOption, L: Lang): string {
  const name = L !== "mm" && spouse.nameEn ? spouse.nameEn : spouse.name;
  return spouse.title ? `${spouse.title} ${name}` : name;
}

export function pastorPhotoUrl(pastor: Pick<PastorRow, "id" | "hasPhoto">): string | undefined {
  return pastor.hasPhoto ? `/organization/pastors/${pastor.id}/photo` : undefined;
}

function option(value: string, label: string, selected: string) {
  return <option value={value} selected={selected === value}>{label}</option>;
}

function PastorFields(props: {
  values: PastorValues;
  regions: { id: number; name: string }[];
  churches: ChurchOption[];
  spouses: SpouseOption[];
  selfId?: number;
  lang: Lang;
  editing: boolean;
  photoUrl?: string;
}) {
  const { values, regions, churches, spouses, selfId, lang, editing, photoUrl } = props;
  const t = getDict(lang);
  const spouseChoices = spouses.filter((s) => s.id !== selfId);
  const spouseSelected = spouseChoices.find((s) => s.id === values.spouseId);
  const spouseText = spouseSelected ? spouseLabel(spouseSelected, lang) : "";
  const initial = Array.from((values.name || values.nameEn || "Ps").trim())[0] ?? "Ps";
  return (
    <>
      <div class="photo-field pastor-photo-field" data-photo-field data-initial={initial}
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

      <fieldset class="form-section pastor-section">
        <legend>{t("form.basic")}</legend>
        <div class="form-grid">
          <label class="field">
            <span class="lbl">{t("org.pastorName")} <span class="req">*</span></span>
            <input type="text" name="name" value={values.name} maxlength={100} required
              autocomplete="name" />
          </label>
          <label class="field">
            <span class="lbl">{t("org.pastorNameEn")}</span>
            <input type="text" name="name_en" value={values.nameEn} maxlength={100}
              placeholder="e.g. John Doe" autocomplete="name" />
          </label>
          <label class="field">
            <span class="lbl">{t("org.pastorTitle")}</span>
            <input type="text" name="title" value={values.title} maxlength={40}
              placeholder="Rev / Ps / Dr" />
          </label>
          <label class="field">
            <span class="lbl">{t("org.pastorPosition")}</span>
            <input type="text" name="position" value={values.position} maxlength={80}
              placeholder={t("org.pastorPositionHint")} />
          </label>
          <label class="field">
            <span class="lbl">{t("form.gender")}</span>
            <select name="gender">
              {option("", t("form.choose"), values.gender)}
              {option("male", t("org.male"), values.gender)}
              {option("female", t("org.female"), values.gender)}
            </select>
          </label>
          <label class="field">
            <span class="lbl">{t("form.marital")}</span>
            <select name="marital_status">
              {option("", t("form.choose"), values.maritalStatus)}
              {option("single", t("org.single"), values.maritalStatus)}
              {option("married", t("org.married"), values.maritalStatus)}
              {option("widowed", t("org.widowed"), values.maritalStatus)}
            </select>
          </label>
          <label class="field">
            <span class="lbl">{t("form.dob")}</span>
            <input type="text" name="date_of_birth" value={values.dateOfBirth}
              placeholder="YYYY-MM-DD" inputmode="numeric" autocomplete="off" data-datepicker="1" />
          </label>
          <label class="field">
            <span class="lbl">{t("org.pastorSpouse")}</span>
            {/* The directory can be long, so this is the same searchable picker
                used for a cluster's pastor: type to filter, × to unlink. */}
            <div class="head-picker pastor-picker" data-search-picker
              data-no-match={t("org.pastorNoMatch")}>
              <input type="search" data-search-input value={spouseText}
                placeholder={t("org.pastorSearch")} aria-label={t("org.pastorSpouse")}
                autocomplete="off" role="combobox" aria-expanded="false" />
              <button type="button" class="head-clear" data-search-clear
                aria-label={t("org.pastorClear")} hidden={!spouseSelected}>×</button>
              <select name="spouse_pastor_id" data-search-select>
                <option value="">{t("org.pastorNoSpouse")}</option>
                {spouseChoices.map((spouse) => (
                  <option value={String(spouse.id)} selected={values.spouseId === spouse.id}>
                    {spouseLabel(spouse, lang)}
                  </option>
                ))}
              </select>
            </div>
            <span class="hint">{t("org.pastorSpouseHint")}</span>
          </label>
        </div>
      </fieldset>

      <fieldset class="form-section pastor-section">
        <legend>{t("form.church")}</legend>
        <div class="form-grid">
          <label class="field">
            <span class="lbl">{t("org.clusterState")} <span class="req">*</span></span>
            <select name="region_id" required data-region-select>
              <option value="">{t("form.choose")}</option>
              {regions.map((r) => (
                <option value={String(r.id)} selected={values.regionId === r.id}>{r.name}</option>
              ))}
            </select>
          </label>
          <label class="field">
            <span class="lbl">{t("org.pastorChurch")}</span>
            <select name="regional_church_id" data-region-filter="1">
              <option value="" data-region="">{t("org.noPastorChurch")}</option>
              {churches.map((church) => (
                <option value={String(church.id)} selected={values.regionalChurchId === church.id}
                  data-region={String(church.regionId)}>{church.name}</option>
              ))}
            </select>
            <span class="hint">{t("org.pastorChurchHint")}</span>
          </label>
          <label class="field">
            <span class="lbl">{t("org.ordinationDate")}</span>
            <input type="text" name="ordination_date" value={values.ordinationDate}
              placeholder="YYYY-MM-DD" inputmode="numeric" autocomplete="off" data-datepicker="1" />
          </label>
          <label class="field">
            <span class="lbl">{t("org.positionSort")}</span>
            <input name="sort_order" type="number" min="0" max="9999" value={String(values.sortOrder)} />
            <span class="hint">{t("org.positionSortHint")}</span>
          </label>
          {editing && (
            <label class="dept-active span-2">
              <input type="checkbox" name="active" value="1" checked={values.active} />
              <span>{t("dept.active")}</span>
            </label>
          )}
        </div>
      </fieldset>

      <fieldset class="form-section pastor-section">
        <legend>{t("form.contact")}</legend>
        <div class="form-grid">
          <label class="field">
            <span class="lbl">{t("form.phone")}</span>
            <input type="text" name="phone" value={values.phone} maxlength={40} inputmode="tel"
              placeholder="09..." autocomplete="tel" />
          </label>
          <label class="field">
            <span class="lbl">{t("form.email")}</span>
            <input type="email" name="email" value={values.email} maxlength={120}
              placeholder="name@example.com" autocomplete="email" />
          </label>
          <label class="field span-2">
            <span class="lbl">{t("form.address")}</span>
            <textarea name="address" rows={2} maxlength={300} placeholder={t("form.address")}
              autocomplete="street-address">{values.address}</textarea>
          </label>
        </div>
      </fieldset>

      <fieldset class="form-section pastor-section">
        <legend>{t("form.notes")}</legend>
        <div class="form-grid">
          <label class="field span-2">
            <textarea name="notes" rows={3} maxlength={1000}
              placeholder={t("org.pastorNotesHint")}>{values.notes}</textarea>
          </label>
        </div>
      </fieldset>
    </>
  );
}

export function PastorModal(props: {
  pastor?: PastorRow;
  regions: { id: number; name: string }[];
  churches: ChurchOption[];
  spouses?: SpouseOption[];
  values?: PastorValues;
  error?: string | null;
  lang?: Lang;
}) {
  const { pastor, regions, churches, error } = props;
  const spouses = props.spouses ?? [];
  const L = props.lang ?? "en";
  const t = getDict(L);
  return (
    <>
      {error && <div class="modal-error" role="alert">{error}</div>}
      <form method="post" class="pastor-form"
        action={pastor ? `/organization/pastors/${pastor.id}` : "/organization/pastors"}
        data-modal-ajax>
        <PastorFields
          values={props.values ?? pastorValues(pastor)}
          regions={regions} churches={churches} spouses={spouses} selfId={pastor?.id}
          lang={L} editing={Boolean(pastor)}
          photoUrl={pastor ? pastorPhotoUrl(pastor) : undefined}
        />
        <div class="actions">
          <button class="btn" type="submit">{pastor ? t("dept.save") : t("form.add")}</button>
          <button class="btn secondary" type="button" data-close="1">{t("form.cancel")}</button>
        </div>
      </form>
    </>
  );
}

function matchesQuery(q: string, fields: (string | null | undefined)[]): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => (f ?? "").toLowerCase().includes(needle));
}

function displayName(pastor: PastorRow, L: Lang): string {
  const name = pastorName(pastor, L);
  return pastor.title ? `${pastor.title} ${name}` : name;
}

export function PastorsPage(props: Common & {
  pastors: PastorRow[];
  regions: { id: number; name: string }[];
  q?: string;
  status?: "all" | "active" | "inactive";
  region?: number | null;
}) {
  const { user, perms, flash, lang, pastors, regions } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const q = props.q ?? "";
  const status = props.status ?? "all";
  const region = props.region ?? null;
  const visible = pastors.filter((p) =>
    (status === "all" || (status === "active" ? p.active === 1 : p.active === 0)) &&
    (region == null || p.regionId === region) &&
    matchesQuery(q, [p.name, p.nameEn, p.title, p.position, p.stateName, p.stateNameEn,
      p.churchName, p.churchNameEn, p.spouseName, p.spouseNameEn, p.phone, p.email]));
  const activeCount = pastors.filter((p) => p.active === 1).length;
  const churchCount = new Set(pastors.map((p) => p.regionalChurchId).filter((id): id is number => id != null)).size;
  const filtered = q.trim().length > 0 || status !== "all" || region != null;
  const canUpdate = perms.has("options.manage");

  return (
    <Layout title={t("org.pastorsTitle")} lang={lang} user={user} perms={perms} active="/organization/pastors" flash={flash ?? null}>
      <div class="page-head">
        <div>
          <h1>{t("org.pastorsTitle")}<span class="count-pill">{visible.length}</span></h1>
          <p class="page-sub">{t("org.pastorsIntro")}</p>
        </div>
        <div class="page-head-actions">
          <CardViewToggle lang={lang} viewKey="pastors" />
          {canUpdate && (
            <a class="btn js-add-modal" href="/organization/pastors/new"
              data-modal-title={t("org.addPastor")}>
              + {t("org.addPastor")}
            </a>
          )}
          <a class="btn secondary" href="/organization">{t("dept.back")}</a>
        </div>
      </div>

      <div class="stat-grid org-stats">
        <div class="stat"><div class="n">{pastors.length}</div><div class="t">{t("org.pastorsStat")}</div></div>
        <div class="stat"><div class="n">{activeCount}</div><div class="t">{t("org.activePastors")}</div></div>
        <div class="stat"><div class="n">{churchCount}</div><div class="t">{t("org.pastorChurches")}</div></div>
      </div>

      <form class="filters settings-filters" method="get" action="/organization/pastors" data-auto-submit="1">
        <input type="search" name="q" value={q} placeholder={t("org.searchPastors")}
          aria-label={t("members.search")} enterkeyhint="search" />
        <select name="status" aria-label={t("members.status")}>
          <option value="" selected={status === "all"}>{t("members.allStatuses")}</option>
          <option value="active" selected={status === "active"}>{t("dept.active")}</option>
          <option value="inactive" selected={status === "inactive"}>{t("dept.inactive")}</option>
        </select>
        <select name="region" aria-label={t("detail.state")}>
          <option value="">{t("org.allStates")}</option>
          {regions.map((r) => (
            <option value={String(r.id)} selected={region === r.id}>{r.name}</option>
          ))}
        </select>
        <div class="actions"><button class="btn sm secondary" type="submit">{t("members.search")}</button></div>
      </form>

      {visible.length === 0 ? (
        <div class="card org-empty org-empty-small">
          <p class="muted">{filtered ? t("org.filterEmpty") : t("org.noPastors")}</p>
          {filtered && <p class="small"><a href="/organization/pastors">{t("members.clearFilters")}</a></p>}
        </div>
      ) : (
        <div class="hh-grid" data-view-grid>
          {visible.map((pastor) => {
            const photo = pastorPhotoUrl(pastor);
            const initial = Array.from((pastor.name || pastor.nameEn || "?").trim())[0] ?? "?";
            const state = L !== "mm" && pastor.stateNameEn ? pastor.stateNameEn : pastor.stateName;
            const church = L !== "mm" && pastor.churchNameEn ? pastor.churchNameEn : pastor.churchName;
            return (
              <article class={`hh-card pastor-card-v2${pastor.active ? "" : " is-inactive"}`}>
                <div class="hh-card-head">
                  <span class="hh-avatar" aria-hidden="true">
                    {photo ? <img src={photo} alt="" /> : <span>{initial}</span>}
                  </span>
                  <div class="hh-card-title">
                    <a href={`/organization/pastors/${pastor.id}`} title={displayName(pastor, L)}>
                      {displayName(pastor, L)}
                    </a>
                    <span class="hh-card-meta">
                      <span class="muted small">{pastor.position || t("org.pastor")}</span>
                    </span>
                  </div>
                </div>

                <div class="hh-facts">
                  <div class="hh-fact">
                    <span class="hh-fact-label">{t("detail.state")}</span>
                    <span class="hh-fact-value">{state || "—"}</span>
                  </div>
                  <div class="hh-fact">
                    <span class="hh-fact-label">{t("org.pastorChurch")}</span>
                    <span class="hh-fact-value">{church || t("org.noPastorChurch")}</span>
                  </div>
                  <div class="hh-fact wide">
                    <span class="hh-fact-label">{t("detail.phone")}</span>
                    <span class="hh-fact-value">{pastor.phone || pastor.email || "—"}</span>
                  </div>
                  {pastor.spousePastorId != null && (
                    <div class="hh-fact wide">
                      <span class="hh-fact-label">{t("org.pastorSpouse")}</span>
                      <span class="hh-fact-value">
                        <a href={`/organization/pastors/${pastor.spousePastorId}`}>
                          {(L !== "mm" && pastor.spouseNameEn) ? pastor.spouseNameEn : pastor.spouseName || "—"}
                        </a>
                      </span>
                    </div>
                  )}
                </div>

                <div class="hh-card-actions">
                  <a class="btn sm secondary" href={`/organization/pastors/${pastor.id}`}>{t("org.viewPastor")}</a>
                  {canUpdate && (
                    <a class="btn sm secondary js-edit-modal" href={`/organization/pastors/${pastor.id}/edit`}
                      data-modal-title={t("org.editPastor")}>
                      {t("members.edit")}
                    </a>
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

export function PastorDetailPage(props: Common & {
  pastor: PastorRow;
  history?: PastorHistoryRow[];
  historyRegions?: { id: number; name: string }[];
}) {
  const { user, perms, flash, lang, pastor, history = [], historyRegions = [] } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const photo = pastorPhotoUrl(pastor);
  const canUpdate = perms.has("options.manage");
  const church = L !== "mm" && pastor.churchNameEn ? pastor.churchNameEn : pastor.churchName;
  const state = L !== "mm" && pastor.stateNameEn ? pastor.stateNameEn : pastor.stateName;
  const initials = Array.from((pastor.name || pastor.nameEn || "?").trim())[0] ?? "?";
  const gender = pastor.gender === "male" ? t("org.male")
    : pastor.gender === "female" ? t("org.female") : pastor.gender;
  const marital = pastor.maritalStatus === "single" ? t("org.single")
    : pastor.maritalStatus === "married" ? t("org.married")
      : pastor.maritalStatus === "widowed" ? t("org.widowed")
        : pastor.maritalStatus === "divorced" ? t("org.divorced") : pastor.maritalStatus;
  const rows: [string, string | null][] = [
    [t("org.pastorTitle"), pastor.title],
    [t("org.pastorPosition"), pastor.position],
    [t("detail.state"), state],
    [t("org.pastorChurch"), church],
    [t("form.gender"), gender],
    [t("form.marital"), marital],
    [t("form.dob"), pastor.dateOfBirth],
    [t("org.ordinationDate"), pastor.ordinationDate],
    [t("detail.phone"), pastor.phone],
    [t("form.email"), pastor.email],
    [t("detail.address"), pastor.address],
    [t("detail.notes"), pastor.notes],
  ];

  return (
    <Layout title={displayName(pastor, L)} lang={lang} user={user} perms={perms} active="/organization/pastors" flash={flash ?? null}>
      <div class="breadcrumb">
        <a href="/organization">{t("org.title")}</a>
        <span>/</span>
        <a href="/organization/pastors">{t("org.pastorsTitle")}</a>
      </div>
      <div class="page-head pastor-head">
        <div class="member-head pastor-head-main">
          <div class="member-avatar pastor-avatar">
            {photo ? <img src={photo} alt="" /> : <span>{initials}</span>}
          </div>
          <div class="pastor-head-text">
            <h1>{displayName(pastor, L)}</h1>
            <div class="pastor-tags">
              <span class="pastor-tag">{pastor.position || t("org.pastor")}</span>
              {church && <span class="pastor-tag">{church}</span>}
              {state && <span class="pastor-tag">{state}</span>}
              <span class={`badge ${pastor.active ? "active" : "inactive"}`}>
                {pastor.active ? t("dept.active") : t("dept.inactive")}
              </span>
            </div>
          </div>
        </div>
        <div class="page-head-actions pastor-actions">
          {canUpdate && (
            <a class="btn js-edit-modal" href={`/organization/pastors/${pastor.id}/edit`}
              data-modal-title={t("org.editPastor")}>
              {t("members.edit")}
            </a>
          )}
          {canUpdate && (
            <form method="post" class="pastor-delete" action={`/organization/pastors/${pastor.id}/delete`}
              data-confirm={t("org.deletePastorConfirm")}>
              <button class="btn outline-danger" type="submit">{t("members.delete")}</button>
            </form>
          )}
          <a class="btn secondary" href="/organization/pastors">{t("dept.back")}</a>
        </div>
      </div>

      <div class="card detail-card">
        <h2>{t("org.pastorProfile")}</h2>
        <div class="detail-grid">
          {rows.map(([label, value]) => (
            <div class="detail-item">
              <span class="k">{label}</span>
              <span class={`v${value ? "" : " empty"}`}>{value || "—"}</span>
            </div>
          ))}
          <div class="detail-item">
            <span class="k">{t("org.pastorSpouse")}</span>
            {pastor.spousePastorId != null ? (
              <span class="v">
                <a href={`/organization/pastors/${pastor.spousePastorId}`}>
                  {(L !== "mm" && pastor.spouseNameEn) ? pastor.spouseNameEn : pastor.spouseName || "—"}
                </a>
              </span>
            ) : (
              <span class="v empty">—</span>
            )}
          </div>
        </div>
      </div>

      <PastorHistoryCard
        pastorId={pastor.id}
        rows={history}
        canManage={canUpdate}
        regions={historyRegions}
        lang={L}
      />
    </Layout>
  );
}

/** Service history card on the pastor page: one line per posting, newest first,
 * with back-dated years so records can be entered from old appointment books. */
export function PastorHistoryCard(props: {
  pastorId: number;
  rows: PastorHistoryRow[];
  canManage: boolean;
  regions: { id: number; name: string }[];
  lang: Lang;
}) {
  const { pastorId, rows, canManage, regions, lang } = props;
  const t = getDict(lang);
  const regionName = (id: number | null) => {
    if (id == null) return "";
    const found = regions.find((r) => r.id === id);
    return found?.name ?? "";
  };
  return (
    <div class="card detail-card">
      <div class="history-head">
        <h2>{t("org.history")}</h2>
        {canManage && (
          <a class="btn sm secondary js-add-modal" href={`/organization/pastors/${pastorId}/history/new`}
            data-modal-title={t("org.historyAdd")}>
            {t("org.historyAdd")}
          </a>
        )}
      </div>
      <p class="muted small">{t("org.historyIntro")}</p>
      {rows.length === 0 ? (
        <p class="muted">{t("org.historyEmpty")}</p>
      ) : (
        <ol class="timeline">
          {rows.map((h) => (
            <li class={`timeline-item${h.endYear == null ? " is-current" : ""}`}>
              <div class="timeline-years">
                {h.startYear} – {h.endYear == null ? t("org.historyPresent") : h.endYear}
              </div>
              <div class="timeline-body">
                <div class="timeline-role">
                  {h.position || t("org.historyPosition")}
                  {h.churchName ? <span class="timeline-church"> · {h.churchName}</span> : null}
                </div>
                {(h.township || h.regionId != null) && (
                  <div class="timeline-meta">
                    {[h.township, regionName(h.regionId)].filter(Boolean).join(" · ")}
                  </div>
                )}
                {h.notes && <p class="timeline-notes">{h.notes}</p>}
                {canManage && (
                  <div class="timeline-actions">
                    <a class="btn sm secondary js-edit-modal"
                      href={`/organization/pastors/${pastorId}/history/${h.id}/edit`}
                      data-modal-title={t("org.history")}>{t("members.edit")}</a>
                    <form method="post" action={`/organization/pastors/${pastorId}/history/${h.id}/delete`}
                      data-confirm={t("org.historyDeleteConfirm")}>
                      <button class="btn sm secondary" type="submit">{t("members.delete")}</button>
                    </form>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function PastorHistoryModal(props: {
  pastorId: number;
  historyId?: number;
  values: PastorHistoryValues;
  regions: { id: number; name: string }[];
  errors?: string[];
  lang: Lang;
}) {
  const { pastorId, historyId, values: v, regions, errors = [], lang } = props;
  const t = getDict(lang);
  const thisYear = new Date().getUTCFullYear();
  const editing = historyId != null;
  const editId = historyId;
  return (
    <>
      {errors.length > 0 && (
        <div class="modal-error" role="alert">
          <ul class="err-list">{errors.map((e) => <li>{e}</li>)}</ul>
        </div>
      )}
      <form method="post" class="pastor-form"
        action={editing
          ? `/organization/pastors/${pastorId}/history/${editId}/edit`
          : `/organization/pastors/${pastorId}/history`}
        data-modal-ajax>
        <div class="form-grid">
          <label class="field">
            <span class="lbl">{t("org.historyStart")} <span class="req">*</span></span>
            <input type="number" name="start_year" inputmode="numeric" min={1900} max={thisYear}
              value={v.startYear} required />
          </label>
          <label class="field">
            <span class="lbl">{t("org.historyEnd")}</span>
            <input type="number" name="end_year" inputmode="numeric" min={1900} max={thisYear + 1}
              value={v.endYear} placeholder={t("org.historyPresent")} />
          </label>
          <label class="field">
            <span class="lbl">{t("org.historyPosition")}</span>
            <input type="text" name="position" maxlength={80} value={v.position}
              placeholder={t("org.pastorPositionHint")} />
          </label>
          <label class="field">
            <span class="lbl">{t("org.historyChurch")}</span>
            <input type="text" name="church_name" maxlength={120} value={v.churchName} />
          </label>
          <label class="field">
            <span class="lbl">{t("org.clusterState")}</span>
            <select name="region_id">
              <option value="">{t("form.choose")}</option>
              {regions.map((r) => (
                <option value={String(r.id)} selected={v.regionId === String(r.id)}>{r.name}</option>
              ))}
            </select>
          </label>
          <label class="field">
            <span class="lbl">{t("org.historyTownship")}</span>
            <input type="text" name="township" maxlength={80} value={v.township} />
          </label>
          <label class="field span-2">
            <span class="lbl">{t("org.historyNotes")}</span>
            <textarea name="notes" rows={3} maxlength={500}>{v.notes}</textarea>
          </label>
        </div>
        <div class="actions">
          <button class="btn" type="submit">{t("org.historySave")}</button>
          <button class="btn secondary" type="button" data-close="1">{t("form.cancel")}</button>
        </div>
      </form>
    </>
  );
}
