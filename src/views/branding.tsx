import { Layout } from "./layout";
import type { Flash } from "./layout";
import type { SessionUser } from "../session";
import { getDict, type Lang } from "../i18n";
import type { Branding } from "../branding";

type Common = { user: SessionUser; perms: Set<string>; flash?: Flash; lang?: Lang };

/** Administration → Login branding: church name and optional brand photo. */
export function BrandingPage(props: Common & { branding: Branding }) {
  const { user, perms, flash, lang, branding } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const photoUrl = branding.hasPhoto ? `/branding/photo?v=${branding.updatedAt}` : "";
  return (
    <Layout title={t("brand.title")} lang={lang} user={user} perms={perms} active="/admin/branding" flash={flash ?? null}>
      <div class="page-head">
        <div>
          <h1>{t("brand.title")}</h1>
          <p class="page-sub">{t("brand.intro")}</p>
        </div>
        <div class="page-head-actions">
          <a class="btn secondary" href="/">{t("nav.dashboard")}</a>
        </div>
      </div>

      <form method="post" action="/admin/branding" class="card brand-form">
        <h2>{t("brand.panelTitle")}</h2>
        <p class="muted small">{t("brand.panelHint")}</p>
        <div class="form-grid">
          <label class="field">
            <span class="lbl">{t("brand.churchName")}</span>
            <input type="text" name="church_name" value={branding.churchName}
              maxlength={80} placeholder={t("brand.churchNamePlaceholder")} />
            <span class="field-hint">{t("brand.churchNameHint")}</span>
          </label>
        </div>

        <div class="photo-field brand-photo-field" data-photo-field data-initial="G"
          data-processing={t("form.photoProcessing")} data-ready={t("form.photoReady")}
          data-error={t("form.photoError")}>
          <div class="photo-preview">
            <img data-photo-img src={photoUrl} alt="" hidden={!photoUrl} />
            <span data-photo-fallback hidden={Boolean(photoUrl)}>G</span>
          </div>
          <div class="photo-controls">
            <span class="lbl">{t("brand.photo")}</span>
            <div class="photo-actions">
              <label class="btn sm secondary photo-pick">
                {t("form.photoChoose")}
                <input type="file" accept="image/jpeg,image/png,image/webp" data-photo-input hidden />
              </label>
              {branding.hasPhoto && (
                <label class="check-chip">
                  <input type="checkbox" name="photo_remove" value="1" data-photo-remove />
                  {t("form.photoRemove")}
                </label>
              )}
            </div>
            <p class="hint">{t("brand.photoHint")}</p>
            <p class="photo-status" data-photo-status role="status"></p>
            <input type="hidden" name="photo_data" data-photo-data />
          </div>
        </div>

        <div class="actions">
          <button class="btn" type="submit">{t("dept.save")}</button>
        </div>
      </form>
    </Layout>
  );
}
