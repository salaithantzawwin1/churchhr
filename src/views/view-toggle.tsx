import { getDict, type Lang } from "../i18n";

/** Card / list switch used by collection pages. Both views render the same
 * server markup; app.js toggles the `is-list` class and remembers the choice. */
export function CardViewToggle(props: { lang?: Lang; viewKey: string }) {
  const t = getDict(props.lang ?? "en");
  return (
    <div class="hh-view-toggle" role="group" aria-label={t("hh.viewLabel")}
      data-view-switch data-view-key={props.viewKey}>
      <button type="button" data-view="card" aria-pressed="true" title={t("hh.cardView")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
          stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7.5" height="7.5" rx="1.2" />
          <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.2" />
          <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.2" />
          <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.2" />
        </svg>
        <span>{t("hh.cardView")}</span>
      </button>
      <button type="button" data-view="list" aria-pressed="false" title={t("hh.listView")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
          stroke-linecap="round" aria-hidden="true">
          <path d="M9 6h12M9 12h12M9 18h12" />
          <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
          <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
        </svg>
        <span>{t("hh.listView")}</span>
      </button>
    </div>
  );
}
