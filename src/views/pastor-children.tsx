import { getDict, type Lang } from "../i18n";
import { ageFromDate } from "../util";
import {
  HOPE_SCHOOL,
  type ChildLinkSuggestion,
  type PastorChildRow,
  type PastorChildValues,
} from "../pastor-children";

/** One parent line above the child form: the pastor and, when linked, the
 *  spouse, so the record is attached to the right couple. */
export type ChildParents = { father: string; mother: string };

function childName(row: PastorChildRow, L: Lang): string {
  return L !== "mm" && row.nameEn ? row.nameEn : row.name;
}

function suggestedName(suggestion: ChildLinkSuggestion, L: Lang): string {
  return L !== "mm" && suggestion.memberNameEn ? suggestion.memberNameEn : suggestion.memberName;
}

/** Children card on the pastor page: one row per child, with the Hope School
 *  total called out because the church counts those places every year. */
export function PastorChildrenCard(props: {
  pastorId: number;
  rows: PastorChildRow[];
  canManage: boolean;
  /** Suggested member matches for children that are not linked yet. */
  suggestions?: Map<number, ChildLinkSuggestion>;
  lang: Lang;
}) {
  const { pastorId, rows, canManage, lang, suggestions } = props;
  const t = getDict(lang);
  const activeRows = rows.filter((r) => r.active === 1);
  const hopeCount = activeRows.filter((r) => r.atHopeSchool === 1).length;

  return (
    <div class="card detail-card">
      <div class="history-head">
        <h2>{t("org.children")}</h2>
        {canManage && (
          <a class="btn sm secondary js-add-modal" href={`/organization/pastors/${pastorId}/children/new`}
            data-modal-title={t("org.addChild")} data-modal-size="sm">
            + {t("org.addChild")}
          </a>
        )}
      </div>
      <p class="muted small">{t("org.childrenIntro")}</p>

      <div class="child-stats">
        <span class="pastor-tag">
          {t("org.childrenTotal")}: <strong>{activeRows.length}</strong>
        </span>
        <span class={`pastor-tag${hopeCount > 0 ? " is-accent" : ""}`}>
          {t("org.hopeSchoolChildren")}: <strong>{hopeCount}</strong>
        </span>
      </div>

      {activeRows.length === 0 ? (
        <p class="muted">{t("org.childrenEmpty")}</p>
      ) : (
        <div class="tbl-wrap">
          <table class="child-table">
            <thead>
              <tr>
                <th>{t("org.childName")}</th>
                <th>{t("org.childGender")} · {t("org.childAge")}</th>
                <th>{t("org.childDob")}</th>
                <th>{t("org.childGrade")}</th>
                <th>{t("org.childSchool")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {activeRows.map((row) => {
                const age = ageFromDate(row.dateOfBirth);
                const grade = [row.grade, row.academicYear].filter(Boolean).join(" · ");
                const gender = row.gender === "male" ? t("org.male")
                  : row.gender === "female" ? t("org.female") : "";
                return (
                  <tr>
                    <td>
                      <strong>{childName(row, lang)}</strong>
                      {row.nameEn && lang !== "mm" && row.name !== row.nameEn ? (
                        <span class="muted small"> ({row.name})</span>
                      ) : null}
                      {row.memberId != null && (
                        <a class="pastor-tag child-member-tag" href={`/members/${row.memberId}`}>
                          {t("org.childLinked")}
                        </a>
                      )}
                      {canManage && row.memberId == null && suggestions?.get(row.id) && (
                        <form method="post" class="child-link-suggest"
                          action={`/organization/pastors/${pastorId}/children/${row.id}/link`}>
                          <input type="hidden" name="member_id" value={String(suggestions.get(row.id)!.memberId)} />
                          <span class="muted small">
                            {t("org.childLinkSuggest")}: {suggestedName(suggestions.get(row.id)!, lang)}
                            {suggestions.get(row.id)!.memberDob ? ` · ${suggestions.get(row.id)!.memberDob}` : ""}
                          </span>
                          <button class="btn sm secondary" type="submit">{t("org.childLinkAction")}</button>
                        </form>
                      )}
                      {row.notes && <div class="muted small">{row.notes}</div>}
                    </td>
                    <td>{[gender, age == null ? "" : `${age}`].filter(Boolean).join(" · ") || "—"}</td>
                    <td>{row.dateOfBirth || "—"}</td>
                    <td>{grade || "—"}</td>
                    <td>
                      {row.atHopeSchool === 1 ? (
                        <span class="badge active">{HOPE_SCHOOL}</span>
                      ) : (row.school || "—")}
                    </td>
                    <td class="row-actions-cell">
                      {canManage && (
                        <div class="row-icon-actions">
                          <a class="btn sm secondary js-edit-modal"
                            href={`/organization/pastors/${pastorId}/children/${row.id}/edit`}
                            data-modal-title={t("org.editChild")} data-modal-size="sm">
                            {t("members.edit")}
                          </a>
                          <form method="post"
                            action={`/organization/pastors/${pastorId}/children/${row.id}/delete`}
                            data-confirm={t("org.childDeleteConfirm")}>
                            <button class="btn sm secondary" type="submit">{t("members.delete")}</button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p class="scroll-hint" aria-hidden="true"><span>↔</span> {t("members.scrollHint")}</p>
    </div>
  );
}

/** Add / edit one child. Father and mother names are read-only: they come from
 *  the pastor (and the linked spouse), never typed again here. */
export function PastorChildrenModal(props: {
  pastorId: number;
  childId?: number;
  values: PastorChildValues;
  parents: ChildParents;
  /** Members of the pastor's state that this child could be (son / daughter). */
  memberOptions?: { id: number; name: string }[];
  errors?: string[];
  lang: Lang;
}) {
  const { pastorId, childId, values: v, parents, memberOptions = [], errors = [], lang } = props;
  const t = getDict(lang);
  const editing = childId != null;
  const memberSelected = memberOptions.find((m) => String(m.id) === v.memberId);
  const action = editing
    ? `/organization/pastors/${pastorId}/children/${childId}/edit`
    : `/organization/pastors/${pastorId}/children`;
  return (
    <>
      {errors.length > 0 && (
        <div class="modal-error" role="alert">
          <ul class="err-list">{errors.map((e) => <li>{e}</li>)}</ul>
        </div>
      )}
      <form method="post" class="pastor-form" action={action} data-modal-ajax>
        <p class="muted small child-parents">
          {t("org.childFather")}: <strong>{parents.father}</strong>
          {parents.mother ? <> · {t("org.childMother")}: <strong>{parents.mother}</strong></> : null}
        </p>
        <div class="form-grid">
          <label class="field">
            <span class="lbl">{t("org.childName")} <span class="req">*</span></span>
            <input type="text" name="name" value={v.name} maxlength={100} required />
          </label>
          <label class="field">
            <span class="lbl">{t("org.childNameEn")}</span>
            <input type="text" name="name_en" value={v.nameEn} maxlength={100} placeholder="e.g. Grace" />
          </label>
          <label class="field span-2">
            <span class="lbl">{t("org.childMemberLink")}</span>
            <div class="head-picker pastor-picker" data-search-picker
              data-no-match={t("org.pastorNoMatch")}>
              <input type="search" data-search-input value={memberSelected?.name ?? ""}
                placeholder={t("org.childMemberSearch")} autocomplete="off" role="combobox"
                aria-expanded="false" aria-label={t("org.childMemberLink")} />
              <button type="button" class="head-clear" data-search-clear
                aria-label={t("org.pastorClear")} hidden={!memberSelected}>×</button>
              <select name="member_id" data-search-select>
                <option value="">{t("org.childMemberNone")}</option>
                {memberOptions.map((member) => (
                  <option value={String(member.id)} selected={v.memberId === String(member.id)}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            <span class="field-hint">{t("org.childMemberHint")}</span>
          </label>
          <label class="field">
            <span class="lbl">{t("org.childGender")}</span>
            <select name="gender">
              <option value="" selected={v.gender === ""}>{t("form.choose")}</option>
              <option value="male" selected={v.gender === "male"}>{t("org.male")}</option>
              <option value="female" selected={v.gender === "female"}>{t("org.female")}</option>
            </select>
          </label>
          <label class="field">
            <span class="lbl">{t("org.childDob")}</span>
            <input type="text" name="date_of_birth" value={v.dateOfBirth} placeholder="YYYY-MM-DD"
              inputmode="numeric" autocomplete="off" data-datepicker="1" />
            <span class="field-hint">{t("org.childAgeHint")}</span>
          </label>
          <label class="field">
            <span class="lbl">{t("org.childGrade")}</span>
            <input type="text" name="grade" value={v.grade} maxlength={40} placeholder="KG / G5 / Year 1" />
            <span class="field-hint">{t("org.childGradeHint")}</span>
          </label>
          <label class="field">
            <span class="lbl">{t("org.childAcademicYear")}</span>
            <input type="text" name="academic_year" value={v.academicYear} maxlength={20} placeholder="2026-2027" />
          </label>
          <label class="dept-active span-2">
            <input type="checkbox" name="at_hope_school" value="1" checked={v.atHopeSchool} />
            <span>{t("org.childHopeSchool")}</span>
          </label>
          <label class="field span-2">
            <span class="lbl">{t("org.childSchool")}</span>
            <input type="text" name="school" value={v.school} maxlength={120} />
            <span class="field-hint">{t("org.childSchoolHint")}</span>
          </label>
          <label class="field span-2">
            <span class="lbl">{t("org.childNotes")}</span>
            <textarea name="notes" rows={2} maxlength={500}>{v.notes}</textarea>
          </label>
          {editing && (
            <label class="dept-active span-2">
              <input type="checkbox" name="active" value="1" checked={v.active} />
              <span>{t("org.childActive")}</span>
            </label>
          )}
        </div>
        <div class="actions">
          <button class="btn secondary" type="button" data-close="1">{t("form.cancel")}</button>
          <button class="btn" type="submit">{editing ? t("dept.save") : t("form.add")}</button>
        </div>
      </form>
    </>
  );
}
