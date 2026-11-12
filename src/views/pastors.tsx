import { Layout, type Flash } from "./layout";
import type { SessionUser } from "../session";
import { getDict, type Lang } from "../i18n";
import { pastorName, type PastorRow } from "../pastors";

type Common = { user: SessionUser; perms: Set<string>; flash?: Flash; lang?: Lang };
type ChurchOption = { id: number; name: string; regionId: number };

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
  };
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
  lang: Lang;
  editing: boolean;
  photoUrl?: string;
}) {
  const { values, regions, churches, lang, editing, photoUrl } = props;
  const t = getDict(lang);
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
            <input type="date" name="date_of_birth" value={values.dateOfBirth} />
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
            <input type="date" name="ordination_date" value={values.ordinationDate} />
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
  values?: PastorValues;
  error?: string | null;
  lang?: Lang;
}) {
  const { pastor, regions, churches, error } = props;
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
          regions={regions} churches={churches} lang={L} editing={Boolean(pastor)}
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
  q?: string;
  status?: "all" | "active" | "inactive";
}) {
  const { user, perms, flash, lang, pastors } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const q = props.q ?? "";
  const status = props.status ?? "all";
  const visible = pastors.filter((p) =>
    (status === "all" || (status === "active" ? p.active === 1 : p.active === 0)) &&
    matchesQuery(q, [p.name, p.nameEn, p.title, p.position, p.stateName, p.stateNameEn,
      p.churchName, p.churchNameEn, p.phone, p.email]));
  const activeCount = pastors.filter((p) => p.active === 1).length;
  const churchCount = new Set(pastors.map((p) => p.regionalChurchId).filter((id): id is number => id != null)).size;
  const filtered = q.trim().length > 0 || status !== "all";
  const canUpdate = perms.has("options.manage");

  return (
    <Layout title={t("org.pastorsTitle")} lang={lang} user={user} perms={perms} active="/organization" flash={flash ?? null}>
      <div class="page-head">
        <div>
          <h1>{t("org.pastorsTitle")}<span class="count-pill">{visible.length}</span></h1>
          <p class="page-sub">{t("org.pastorsIntro")}</p>
        </div>
        <div class="page-head-actions">
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
        <div class="actions"><button class="btn sm secondary" type="submit">{t("members.search")}</button></div>
      </form>

      {visible.length === 0 ? (
        <div class="card org-empty org-empty-small">
          <p class="muted">{filtered ? t("org.filterEmpty") : t("org.noPastors")}</p>
          {filtered && <p class="small"><a href="/organization/pastors">{t("members.clearFilters")}</a></p>}
        </div>
      ) : (
        <div class="pastor-list">
          {visible.map((pastor) => {
            const photo = pastorPhotoUrl(pastor);
            const initial = Array.from((pastor.name || pastor.nameEn || "?").trim())[0] ?? "?";
            return (
              <article class={`card pastor-card${pastor.active ? "" : " is-inactive"}`}>
                <div class="pastor-main">
                  <div class="pastor-avatar" aria-hidden="true">
                    {photo ? <img src={photo} alt="" /> : <span>{initial}</span>}
                  </div>
                  <div class="pastor-title">
                    <h3><a href={`/organization/pastors/${pastor.id}`}>{displayName(pastor, L)}</a></h3>
                    <p class="muted small">
                      {pastor.position || t("org.pastor")}
                      {" · "}
                      {L !== "mm" && pastor.stateNameEn ? pastor.stateNameEn : pastor.stateName}
                      {" · "}
                      {L !== "mm" && pastor.churchNameEn ? pastor.churchNameEn : pastor.churchName || t("org.noPastorChurch")}
                    </p>
                    <p class="muted small">
                      {pastor.phone || pastor.email || "—"}
                    </p>
                  </div>
                  <div class="role-card-actions pastor-actions">
                    <span class={`badge ${pastor.active ? "active" : "inactive"}`}>
                      {pastor.active ? t("dept.active") : t("dept.inactive")}
                    </span>
                    <a class="btn sm secondary" href={`/organization/pastors/${pastor.id}`}>{t("org.viewPastor")}</a>
                    {canUpdate && (
                      <a class="btn sm secondary js-edit-modal" href={`/organization/pastors/${pastor.id}/edit`}
                        data-modal-title={t("org.editPastor")}>
                        {t("members.edit")}
                      </a>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Layout>
  );
}

export function PastorDetailPage(props: Common & { pastor: PastorRow }) {
  const { user, perms, flash, lang, pastor } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const photo = pastorPhotoUrl(pastor);
  const canUpdate = perms.has("options.manage");
  const church = L !== "mm" && pastor.churchNameEn ? pastor.churchNameEn : pastor.churchName;
  const state = L !== "mm" && pastor.stateNameEn ? pastor.stateNameEn : pastor.stateName;
  const initials = Array.from((pastor.name || pastor.nameEn || "?").trim())[0] ?? "?";
  const rows: [string, string | null][] = [
    [t("org.pastorTitle"), pastor.title],
    [t("org.pastorPosition"), pastor.position],
    [t("detail.state"), state],
    [t("org.pastorChurch"), church],
    [t("form.gender"), pastor.gender],
    [t("form.marital"), pastor.maritalStatus],
    [t("form.dob"), pastor.dateOfBirth],
    [t("org.ordinationDate"), pastor.ordinationDate],
    [t("detail.phone"), pastor.phone],
    [t("form.email"), pastor.email],
    [t("detail.address"), pastor.address],
    [t("detail.notes"), pastor.notes],
  ];

  return (
    <Layout title={displayName(pastor, L)} lang={lang} user={user} perms={perms} active="/organization" flash={flash ?? null}>
      <div class="breadcrumb">
        <a href="/organization">{t("org.title")}</a>
        <span>/</span>
        <a href="/organization/pastors">{t("org.pastorsTitle")}</a>
      </div>
      <div class="page-head">
        <div class="member-head">
          <div class="member-avatar">
            {photo ? <img src={photo} alt="" /> : <span>{initials}</span>}
          </div>
          <div>
            <h1>{displayName(pastor, L)}</h1>
            <p class="page-sub">
              {pastor.position || t("org.pastor")}
              {church ? ` · ${church}` : ""}
              {state ? ` · ${state}` : ""}
            </p>
            <span class={`badge ${pastor.active ? "active" : "inactive"}`}>
              {pastor.active ? t("dept.active") : t("dept.inactive")}
            </span>
          </div>
        </div>
        <div class="page-head-actions">
          {canUpdate && (
            <a class="btn js-edit-modal" href={`/organization/pastors/${pastor.id}/edit`}
              data-modal-title={t("org.editPastor")}>
              {t("members.edit")}
            </a>
          )}
          {canUpdate && (
            <form method="post" action={`/organization/pastors/${pastor.id}/delete`}
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
        </div>
      </div>
    </Layout>
  );
}
