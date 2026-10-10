import { Layout } from "./layout";
import type { Flash } from "./layout";
import { getDict, type Lang } from "../i18n";

export function LoginPage({ error, username, lang }: { error?: string | null; username?: string; lang?: Lang }) {
  const t = getDict(lang ?? "mm");
  return (
    <Layout title={t("login.title")} lang={lang}>
      <div class="login-wrap">
        <div class="card">
          <div class="login-logo">
            <img src="/logo.png" alt="" />
            <div>
              <div class="t1">Church Member Registry</div>
              <div class="t2">{t("login.systemNote")}</div>
            </div>
          </div>
          {error && <div class="flash err">{error}</div>}
          <form method="post" action="/login">
            <label class="field">
              <span class="lbl">{t("login.username")}</span>
              <input type="text" name="username" value={username ?? ""} autocomplete="username" autofocus required />
            </label>
            <label class="field" style="margin-top:12px">
              <span class="lbl">{t("login.password")}</span>
              <input type="password" name="password" autocomplete="current-password" required />
            </label>
            <div class="actions">
              <button class="btn full" type="submit">{t("login.submit")}</button>
            </div>
          </form>
        </div>
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
  const t = getDict(lang ?? "mm");
  return (
    <Layout title={t("profile.title")} lang={lang} flash={flash ?? null}>
      <div class="card" style="max-width:520px">
        <h1>{t("profile.heading")}</h1>
        <p class="muted small">
          Username: <strong>{username}</strong>
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
              <a class="btn secondary" href="/">Dashboard</a>
            )}
          </div>
        </form>
      </div>
    </Layout>
  );
}
