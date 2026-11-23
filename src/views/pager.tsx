import { getDict, type Lang } from "../i18n";

/** Prev / "Page x / y" / Next, shared by every collection page. The page builds
 *  the link itself, so each keeps its own filters, sort and query params. */
export function Pager(props: {
  page: number;
  pages: number;
  href: (page: number) => string;
  lang?: Lang;
  labels?: { prev: string; next: string; page: string };
}) {
  if (props.pages <= 1) return null;
  const t = getDict(props.lang ?? "en");
  const labels = props.labels ?? {
    prev: t("members.prev"), next: t("members.next"), page: t("members.page"),
  };
  return (
    <div class="actions" style="justify-content:center">
      {props.page > 1 && <a class="btn secondary" href={props.href(props.page - 1)}>{labels.prev}</a>}
      <span class="muted">{labels.page} {props.page} / {props.pages}</span>
      {props.page < props.pages && <a class="btn secondary" href={props.href(props.page + 1)}>{labels.next}</a>}
    </div>
  );
}
