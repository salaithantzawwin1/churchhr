import { getDict, type Lang } from "../i18n";

/** A member that may be the same person as the one being saved. Soft warning
 *  only: the form still saves once the clerk confirms. */
export type DuplicateCandidate = {
  id: number;
  name: string;
  dateOfBirth: string | null;
  phone: string | null;
  homeCell: string | null;
  /** i18n keys of the details that matched (name, phone, NRC, birth date). */
  reasons: string[];
};

/** The duplicate warning shown above a member form. Both the member form and
 *  the household quick-add form render this inside their own <form>, so the
 *  "Save anyway" button submits that form with confirm_duplicate=1. */
export function DuplicateWarning(props: { duplicates: DuplicateCandidate[]; lang?: Lang }) {
  const { duplicates } = props;
  if (duplicates.length === 0) return null;
  const t = getDict(props.lang ?? "en");
  return (
    <div class="flash warn dup-warning" role="status">
      <strong>{t("dup.warning")}</strong>
      <ul class="err-list small">
        {duplicates.map((d) => {
          const meta = [d.homeCell, d.dateOfBirth, d.phone].filter(Boolean).join(" · ");
          return (
            <li>
              <a href={`/members/${d.id}`} target="_blank" rel="noopener">
                {d.name || `#${d.id}`}
              </a>
              {meta && <span class="muted small"> · {meta}</span>}
              {d.reasons.length > 0 && (
                <span class="muted"> · {d.reasons.map((r) => t(r)).join(", ")}</span>
              )}
            </li>
          );
        })}
      </ul>
      <p>{t("dup.note")}</p>
      <button class="btn sm secondary" type="submit" name="confirm_duplicate" value="1">
        {t("dup.saveAnyway")}
      </button>
      <a class="btn sm secondary" href={duplicates[0] ? `/members/${duplicates[0].id}` : "/members"}>
        {t("dup.open")}
      </a>
    </div>
  );
}
