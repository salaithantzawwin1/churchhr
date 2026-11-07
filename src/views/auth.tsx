import { Layout } from "./layout";
import type { Flash } from "./layout";
import { getDict, type Lang } from "../i18n";

export function LoginPage({ error, username, lang, flash }: { error?: string | null; username?: string; lang?: Lang; flash?: Flash }) {
  const t = getDict(lang ?? "en");
  return (
    <Layout title={t("login.title")} lang={lang} flash={null}>
      <div class="auth-wrap">
        <section class="auth-card">
          <aside class="auth-aside">
            <img class="auth-mark" src="/logo.png" alt="" />
            <div>
              <h1>{t("login.welcome")}</h1>
              <p class="auth-lead">{t("login.systemNote")}</p>
            </div>
            <ul class="auth-points">
              {(["login.point1", "login.point2", "login.point3"] as const).map((k) => (
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                  <span>{t(k)}</span>
                </li>
              ))}
            </ul>
          </aside>

          <div class="auth-main">
            <h2>{t("login.heading")}</h2>
            <p class="muted small auth-sub">{t("login.subtitle")}</p>
            {(error || flash) && (
              <div class={`flash ${flash ? flash.kind : "err"}`}>{flash ? flash.text : error}</div>
            )}
            <form method="post" action="/login">
              <label class="field">
                <span class="lbl">{t("login.username")}</span>
                <input type="text" name="username" value={username ?? ""} autocomplete="username" autofocus required />
              </label>
              <label class="field" style="margin-top:12px">
                <span class="lbl">{t("login.password")}</span>
                <span class="pw-wrap">
                  <input type="password" name="password" id="login-password" autocomplete="current-password" required />
                  <button
                    type="button"
                    class="pw-toggle"
                    data-pw-toggle
                    aria-controls="login-password"
                    aria-pressed="false"
                    aria-label={t("login.showPassword")}
                    data-label-show={t("login.showPassword")}
                    data-label-hide={t("login.hidePassword")}
                  >
                    <svg class="ico-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
                    <svg class="ico-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18" /><path d="M10.6 10.7a3 3 0 0 0 4.2 4.2" /><path d="M9.9 5.2A9.8 9.8 0 0 1 12 5c6.4 0 10 7 10 7a17.5 17.5 0 0 1-3.4 4.3" /><path d="M6.1 6.1A17.6 17.6 0 0 0 2 12s3.6 7 10 7a9.8 9.8 0 0 0 4-.8" /></svg>
                  </button>
                </span>
              </label>
              <div class="actions">
                <button class="btn full" type="submit">{t("login.submit")}</button>
              </div>
            </form>
            <p class="auth-secure">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3" /></svg>
              {t("login.secureNote")}
            </p>
          </div>
        </section>
      </div>
    </Layout>
  );
}

export function ProfilePage({
  username,
  mustChange,
  flash,
  lang,
}: {
  username: string;
  mustChange: boolean;
  flash?: Flash;
  lang?: Lang;
}) {
  const t = getDict(lang ?? "en");
  return (
    <Layout title={t("profile.title")} lang={lang} flash={flash ?? null}>
      <div class="card" style="max-width:520px">
        <h1>{t("profile.heading")}</h1>
        <p class="muted small">
          {t("profile.username")}: <strong>{username}</strong>
        </p>
        {mustChange && (
          <div class="flash warn">
            {t("profile.mustChange")}
          </div>
        )}
        <h2>{t("profile.changePassword")}</h2>
        <form method="post" action="/profile">
          <label class="field">
            <span class="lbl">{t("profile.currentPassword")}</span>
            <input type="password" name="current_password" autocomplete="current-password" required />
          </label>
          <label class="field" style="margin-top:12px">
            <span class="lbl">{t("profile.newPassword")}</span>
            <input type="password" name="new_password" autocomplete="new-password" minlength={8} required
              data-strength="1"
              data-labels={[t("pw.0"), t("pw.1"), t("pw.2"), t("pw.3"), t("pw.4")]} />
          </label>
          <label class="field" style="margin-top:12px">
            <span class="lbl">{t("profile.confirmPassword")}</span>
            <input type="password" name="confirm_password" autocomplete="new-password" minlength={8} required />
          </label>
          <p class="muted small">{t("profile.minChars")}</p>
          <div class="actions">
            <button class="btn" type="submit">{t("profile.save")}</button>
            {!mustChange && (
              <a class="btn secondary" href="/">{t("nav.dashboard")}</a>
            )}
          </div>
        </form>
      </div>
    </Layout>
  );
}
