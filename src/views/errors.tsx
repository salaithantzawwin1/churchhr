import { Layout } from "./layout";
import { getDict, type Lang } from "../i18n";

export function ForbiddenPage({ path, lang }: { path?: string; lang?: Lang }) {
  const t = getDict(lang ?? "mm");
  return (
    <Layout title="403" lang={lang}>
      <div class="card">
        <h1>{t("err.403")}</h1>
        <p class="muted">
          {t("err.403body")}{path ? ` (${path})` : ""}။
        </p>
        <div class="actions">
          <a class="btn" href="/">{t("err.403back")}</a>
        </div>
      </div>
    </Layout>
  );
}

export function NotFoundPage({ lang }: { lang?: Lang }) {
  const t = getDict(lang ?? "mm");
  return (
    <Layout title="404" lang={lang}>
      <div class="card">
        <h1>{t("err.404")}</h1>
        <p class="muted">{t("err.404body")}</p>
        <div class="actions">
          <a class="btn" href="/">{t("err.403back")}</a>
        </div>
      </div>
    </Layout>
  );
}

export function GenericErrorPage({ message, lang }: { message: string; lang?: Lang }) {
  const t = getDict(lang ?? "mm");
  return (
    <Layout title="Error" lang={lang}>
      <div class="card">
        <h1>{t("err.generic")}</h1>
        <p class="muted">{message}</p>
        <div class="actions">
          <a class="btn" href="/">{t("err.403back")}</a>
        </div>
      </div>
    </Layout>
  );
}
