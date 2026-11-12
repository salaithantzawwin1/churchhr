import { Layout, type Flash } from "./layout";
import type { SessionUser } from "../session";
import { getDict, type Lang } from "../i18n";
import { pastorName, type PastorRow } from "../pastors";

type Common = { user: SessionUser; perms: Set<string>; flash?: Flash; lang?: Lang };
type ChurchOption = { id: number; name: string; regionId: number };

export type PastorValues = {
  name: string;
  nameEn: string;
  regionId: number | "";
  regionalChurchId: number | "";
  phone: string;
  sortOrder: number;
  active: boolean;
};

function pastorValues(pastor?: PastorRow): PastorValues {
  return {
    name: pastor?.name ?? "",
    nameEn: pastor?.nameEn ?? "",
    regionId: pastor?.regionId ?? "",
    regionalChurchId: pastor?.regionalChurchId ?? "",
    phone: pastor?.phone ?? "",
    sortOrder: pastor?.sortOrder ?? 0,
    active: pastor ? pastor.active === 1 : true,
  };
}

function PastorFields(props: {
  values: PastorValues;
  regions: { id: number; name: string }[];
  churches: ChurchOption[];
  lang: Lang;
  editing: boolean;
}) {
  const { values, regions, churches, lang, editing } = props;
  const t = getDict(lang);
  return (
    <div class="form-grid">
      <label class="field">
        <span class="lbl">{t("org.pastorName")}</span>
        <input type="text" name="name" value={values.name} maxlength={100} required />
      </label>
      <label class="field">
        <span class="lbl">{t("org.pastorNameEn")}</span>
        <input type="text" name="name_en" value={values.nameEn} maxlength={100} />
      </label>
      <label class="field">
        <span class="lbl">{t("org.clusterState")}</span>
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
        <span class="lbl">{t("form.phone")}</span>
        <input type="text" name="phone" value={values.phone} maxlength={40} inputmode="tel" />
      </label>
      <label class="field">
        <span class="lbl">{t("org.positionSort")}</span>
        <input name="sort_order" type="number" min="0" max="9999" value={String(values.sortOrder)} />
      </label>
      {editing && (
        <label class="dept-active span-2">
          <input type="checkbox" name="active" value="1" checked={values.active} />
          <span>{t("dept.active")}</span>
        </label>
      )}
    </div>
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
        />
        <div class="actions">
          <button class="btn" type="submit">{pastor ? t("dept.save") : t("form.add")}</button>
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
    matchesQuery(q, [p.name, p.nameEn, p.stateName, p.stateNameEn, p.churchName, p.churchNameEn, p.phone]));
  const activeCount = pastors.filter((p) => p.active === 1).length;
  const churchCount = new Set(pastors.map((p) => p.regionalChurchId).filter((id): id is number => id != null)).size;
  const filtered = q.trim().length > 0 || status !== "all";

  return (
    <Layout title={t("org.pastorsTitle")} lang={lang} user={user} perms={perms} active="/organization" flash={flash ?? null}>
      <div class="page-head">
        <div>
          <h1>{t("org.pastorsTitle")}<span class="count-pill">{visible.length}</span></h1>
          <p class="page-sub">{t("org.pastorsIntro")}</p>
        </div>
        <div class="page-head-actions">
          <a class="btn js-add-modal" href="/organization/pastors/new"
            data-modal-title={t("org.addPastor")} data-modal-size="md">
            + {t("org.addPastor")}
          </a>
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
        <div class="actions"><button class="btn sm" type="submit">{t("members.search")}</button></div>
      </form>

      {visible.length === 0 ? (
        <div class="card org-empty org-empty-small">
          <p class="muted">{filtered ? t("org.filterEmpty") : t("org.noPastors")}</p>
          {filtered && <p class="small"><a href="/organization/pastors">{t("members.clearFilters")}</a></p>}
        </div>
      ) : (
        <div class="pastor-list">
          {visible.map((pastor) => (
            <article class={`card pastor-card${pastor.active ? "" : " is-inactive"}`}>
              <div class="pastor-main">
                <div class="pastor-title">
                  <h3>{pastorName(pastor, L)}</h3>
                  <p class="muted small">
                    {L !== "mm" && pastor.stateNameEn ? pastor.stateNameEn : pastor.stateName}
                    {" · "}
                    {L !== "mm" && pastor.churchNameEn ? pastor.churchNameEn : pastor.churchName || t("org.noPastorChurch")}
                  </p>
                </div>
                <div class="pastor-phone">
                  <span class="cluster-kicker">{t("form.phone")}</span>
                  <span class={pastor.phone ? "" : "muted"}>{pastor.phone || "—"}</span>
                </div>
                <div class="role-card-actions pastor-actions">
                  <span class={`badge ${pastor.active ? "active" : "inactive"}`}>
                    {pastor.active ? t("dept.active") : t("dept.inactive")}
                  </span>
                  <a class="btn sm secondary js-edit-modal" href={`/organization/pastors/${pastor.id}/edit`}
                    data-modal-title={t("org.editPastor")} data-modal-size="md">
                    {t("members.edit")}
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </Layout>
  );
}
