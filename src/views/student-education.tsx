import { getDict, type Lang } from "../i18n";
import { HOPE_SCHOOL } from "../pastor-children";
import {
  ENROLMENT_STATUSES,
  SCHOOL_KINDS,
  type EnrolmentRow,
  type EnrolmentValues,
} from "../student-enrolments";

function statusLabel(status: string, t: (key: string) => string): string {
  if (status === "graduated") return t("edu.statusGraduated");
  if (status === "left") return t("edu.statusLeft");
  return t("edu.statusActive");
}

/** Education card on a member page: one row per school year. A child stays a
 *  member (relationship = son/daughter); this card only answers "where do they
 *  study that year", so Hope School and outside schools are counted the same. */
export function MemberEducationCard(props: {
  memberId: number;
  rows: EnrolmentRow[];
  canManage: boolean;
  lang: Lang;
}) {
  const { memberId, rows, canManage, lang } = props;
  const t = getDict(lang);
  const hope = rows.filter((r) => r.schoolKind === "hope" && r.status !== "left").length;

  return (
    <div class="card detail-card">
      <div class="history-head">
        <h2>{t("edu.title")}</h2>
        {canManage && (
          <a class="btn sm secondary js-add-modal" href={`/members/${memberId}/education/new`}
            data-modal-title={t("edu.add")} data-modal-size="sm">
            + {t("edu.add")}
          </a>
        )}
      </div>
      <p class="muted small">{t("edu.intro")}</p>

      {rows.length > 0 && (
        <div class="child-stats">
          <span class="pastor-tag">{t("org.childAcademicYear")}: <strong>{rows[0]!.academicYear}</strong></span>
          <span class={`pastor-tag${hope > 0 ? " is-accent" : ""}`}>
            {HOPE_SCHOOL}: <strong>{hope}</strong>
          </span>
        </div>
      )}

      {rows.length === 0 ? (
        <p class="muted">{t("edu.empty")}</p>
      ) : (
        <div class="tbl-wrap">
          <table class="report-table edu-table">
            <thead>
              <tr>
                <th>{t("org.childAcademicYear")}</th>
                <th>{t("org.childGrade")}</th>
                <th>{t("org.childSchool")}</th>
                <th>{t("edu.status")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr>
                  <td class="nowrap"><strong>{row.academicYear}</strong></td>
                  <td>{row.grade || "—"}</td>
                  <td>
                    {row.schoolKind === "hope" ? (
                      <span class="badge active">{HOPE_SCHOOL}</span>
                    ) : (row.schoolName || "—")}
                  </td>
                  <td>{statusLabel(row.status, t)}</td>
                  <td class="row-actions-cell">
                    {canManage && (
                      <div class="row-icon-actions">
                        <a class="btn sm secondary js-edit-modal"
                          href={`/members/${memberId}/education/${row.id}/edit`}
                          data-modal-title={t("edu.editTitle")} data-modal-size="sm">
                          {t("members.edit")}
                        </a>
                        <form method="post" action={`/members/${memberId}/education/${row.id}/delete`}
                          data-confirm={t("edu.deleteConfirm")}>
                          <button class="btn sm secondary" type="submit">{t("members.delete")}</button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Add / edit one school year. The school type picks the name: Hope School is
 *  stored canonically, an outside school keeps the typed name. */
export function EnrolmentModal(props: {
  memberId: number;
  enrolmentId?: number;
  values: EnrolmentValues;
  errors?: string[];
  lang: Lang;
}) {
  const { memberId, enrolmentId, values: v, errors = [], lang } = props;
  const t = getDict(lang);
  const editing = enrolmentId != null;
  const action = editing
    ? `/members/${memberId}/education/${enrolmentId}`
    : `/members/${memberId}/education`;
  return (
    <>
      {errors.length > 0 && (
        <div class="modal-error" role="alert">
          <ul class="err-list">{errors.map((e) => <li>{e}</li>)}</ul>
        </div>
      )}
      <form method="post" class="pastor-form" action={action} data-modal-ajax>
        <div class="form-grid">
          <label class="field">
            <span class="lbl">{t("org.childAcademicYear")} <span class="req">*</span></span>
            <input type="text" name="academic_year" value={v.academicYear} maxlength={20}
              placeholder="2026-2027" required />
          </label>
          <label class="field">
            <span class="lbl">{t("org.childGrade")}</span>
            <input type="text" name="grade" value={v.grade} maxlength={40} placeholder="KG / G5 / Year 1" />
          </label>
          <label class="field">
            <span class="lbl">{t("edu.schoolKind")} <span class="req">*</span></span>
            <select name="school_kind">
              {SCHOOL_KINDS.map((kind) => (
                <option value={kind} selected={v.schoolKind === kind}>
                  {kind === "hope" ? t("edu.hope") : t("edu.other")}
                </option>
              ))}
            </select>
          </label>
          <label class="field">
            <span class="lbl">{t("edu.status")}</span>
            <select name="status">
              {ENROLMENT_STATUSES.map((status) => (
                <option value={status} selected={v.status === status}>{statusLabel(status, t)}</option>
              ))}
            </select>
          </label>
          <label class="field span-2">
            <span class="lbl">{t("org.childSchool")}</span>
            <input type="text" name="school_name" value={v.schoolName} maxlength={120} />
            <span class="field-hint">{t("edu.errSchoolName")}</span>
          </label>
          <label class="field span-2">
            <span class="lbl">{t("org.childNotes")}</span>
            <textarea name="notes" rows={2} maxlength={500}>{v.notes}</textarea>
          </label>
        </div>
        <div class="actions">
          <button class="btn secondary" type="button" data-close="1">{t("form.cancel")}</button>
          <button class="btn" type="submit">{editing ? t("dept.save") : t("form.add")}</button>
        </div>
      </form>
    </>
  );
}
