import { Layout, type Flash } from "./layout";
import type { SessionUser } from "../session";
import { getDict, type Lang } from "../i18n";

export type TownshipCodeRow = {
  id: number;
  label: string;
  code: string | null;
  shortCode: string | null;
  regionId: number;
  state: string;
  groups: number;
};

/** Bulk editor for township short codes: each prefix drives its township's
 * Family Group numbering (INS -> INS_FG001, INS_FG002…). */
export function TownshipCodesPage(props: {
  user: SessionUser; perms: Set<string>; lang?: Lang; flash?: Flash;
  rows: TownshipCodeRow[];
  errors?: string[];
  values?: Record<number, string>;
}) {
  const t = getDict(props.lang ?? "en");
  const errors = props.errors ?? [];
  return (
    <Layout title={t("adm.shortCodesTitle")} lang={props.lang} user={props.user} perms={props.perms}
      active="/admin/options" flash={props.flash ?? null}>
      <div class="page-head">
        <div>
          <a class="back-link" href="/admin/options?type=township">← {t("form.township")}</a>
          <h1>{t("adm.shortCodesHeading")}</h1>
          <p class="page-sub">{t("adm.shortCodesSub")}</p>
        </div>
      </div>

      {errors.length > 0 && (
        <div class="flash err">
          <strong>{t("form.invalid")}</strong>
          <ul class="err-list">{errors.map((e) => <li>{e}</li>)}</ul>
        </div>
      )}

      {props.rows.length === 0 ? (
        <div class="card">
          <p class="muted small" style="margin:0">{t("adm.shortCodesEmpty")}</p>
        </div>
      ) : (
        <form method="post" action="/admin/options/township-codes" data-flash-ok="option-updated">
          <div class="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("detail.state")}</th>
                  <th>{t("form.township")}</th>
                  <th class="num">{t("adm.shortCodeGroups")}</th>
                  <th>{t("adm.shortCodeCol")}</th>
                </tr>
              </thead>
              <tbody>
                {props.rows.map((r) => (
                  <tr>
                    <td>{r.state || "—"}</td>
                    <td><code>{r.code || "—"}</code> {r.label}</td>
                    <td class="num">{r.groups}</td>
                    <td>
                      <input type="text" name={`short_${r.id}`}
                        value={props.values?.[r.id] ?? r.shortCode ?? ""}
                        maxLength={8} pattern="[A-Za-z0-9]{0,8}" placeholder="INS"
                        style="max-width:120px" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p class="muted small">{t("adm.shortCodeHint")}</p>
          <div class="actions">
            <button class="btn" type="submit">{t("form.save")}</button>
            <a class="btn secondary" href="/admin/options?type=township">{t("form.cancel")}</a>
          </div>
        </form>
      )}
    </Layout>
  );
}
