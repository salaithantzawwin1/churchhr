/** Single-file stylesheet served at /styles.css (no bundler needed). */

/* Geometry and rhythm are theme-independent on purpose: a card, a dialog and a
   table frame all read from the same scale, so the two themes cannot drift. */
const SHARED_VARS = `
    --radius-xs: 6px; --radius-sm: 8px; --radius: 12px; --radius-lg: 16px;
    --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
    --space-5: 20px; --space-6: 24px; --space-7: 32px;
    --card-pad-y: var(--space-5); --card-pad-x: var(--space-6);
    --card-gap: var(--space-5);
  `;

/* Dark palette, defined once and emitted under both the OS-preference media query
   (no-JS fallback) and the explicit [data-theme] attribute (user toggle). */
const DARK_VARS = `
    /* Surfaces step up from the page: bg → surface (cards) → surface-2 (rows,
       chips) → surface-3 (inset wells). --card stays as the card-surface alias. */
    --bg: #0d1727; --surface: #16223a; --surface-2: #1b2a45; --surface-3: #111d30;
    --card: var(--surface);
    --ink: #edf2fb; --muted: #94a3b8;
    --hairline: #22314a;
    /* Chart detail: the connector rail, the empty-slot dot and the ring around
       a node card sit on different backgrounds per theme, so they get tokens. */
    --connector: #2f4260; --vacant-dot: #fbbf24; --node-ring: rgba(255,255,255,.09);
    --line: #2a3a55; --line-strong: #3d5070; --brand: #2563eb; --brand-ink: #ffffff;
    --link: #7db2ff;
    --ok-bg: #123123; --ok-ink: #86efac; --err-bg: #3b171d; --err-ink: #fda4af;
    --warn-bg: #38280f; --warn-ink: #fcd34d;
    --male: #60a5fa; --female: #f472b6;
    --th-bg: #1b2538; --row-hover: var(--surface-2);   /* row/tab hover uses the raised surface */
    --chip-bg: #22314b; --chip-brand-bg: #1d335c;
    --chip-purple-bg: #34284f; --chip-purple-ink: #c4b5fd;
    --track: #26344d; --sep: #60708c;
    --btn2-bg: #1e2b40; --btn2-hover: #28384f;
    --field-bg: #0e1726; --count-bg: rgba(237,242,251,.13);
    --elev-1: 0 1px 2px rgba(0,0,0,.28);
    --hover-shadow: 0 10px 28px rgba(0,0,0,.32);
  `;

const LIGHT_VARS = `
    --bg: #eef2f8; --surface: #ffffff; --surface-2: #f7f9fd; --surface-3: #f1f5fa;
    --card: var(--surface);
    --ink: #182134; --muted: #64748b;
    --hairline: #e8edf5;
    --connector: #d2dbe9; --vacant-dot: #b45309; --node-ring: rgba(15,23,42,.07);
    --line: #e2e8f0; --line-strong: #cbd5e1; --brand: #2563eb; --brand-ink: #ffffff;
    --link: #1d4ed8;
    --ok-bg: #e7f6ec; --ok-ink: #14683a; --err-bg: #fdecec; --err-ink: #a11b1b;
    --warn-bg: #fff4e0; --warn-ink: #8a5300;
    --male: #2563eb; --female: #db2777;
    --th-bg: #f8fafc; --row-hover: var(--surface-2);
    --chip-bg: #eef2f7; --chip-brand-bg: #e8efff;
    --chip-purple-bg: #f1e9fb; --chip-purple-ink: #6d3fb4;
    --track: #eef1f6; --sep: #94a3b8;
    --btn2-bg: #eef2f7; --btn2-hover: #e2e8f0;
    --field-bg: #ffffff; --count-bg: rgba(24,33,52,.08);
    --elev-1: 0 1px 2px rgba(15,23,42,.06);
    --hover-shadow: 0 10px 26px rgba(15,23,42,.10);
  `;

export const CSS = `
:root {
  color-scheme: dark;
  ${SHARED_VARS}
  ${DARK_VARS}
}
/* The product ships dark-first; the header toggle stores an explicit light choice. */
:root[data-theme="light"] {
  color-scheme: light;
  ${LIGHT_VARS}
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--ink);
  font-family: "Noto Sans Myanmar", "Padauk", "Myanmar Text", "Noto Sans KR", "Segoe UI", system-ui, sans-serif;
  font-size: 15px; line-height: 1.6;
}
a { color: var(--link); }
/* Manual theme toggle (topbar): moon icon while light, sun while dark —
   appearance driven purely by the effective theme so no extra JS state. */
.topbar .theme-toggle {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; min-height: 32px; padding: 0;
  border: 1px solid var(--line); border-radius: 999px;
  background: transparent; color: var(--ink); cursor: pointer; flex: none;
}
.topbar .theme-toggle:hover { background: var(--surface-2); }
.topbar .theme-toggle svg { width: 14px; height: 14px; display: block; }
.topbar .theme-toggle .ico-sun { display: none; }
.topbar .theme-toggle .ico-moon { display: inline-block; }
:root[data-theme="dark"] .topbar .theme-toggle .ico-sun { display: inline-block; }
:root[data-theme="dark"] .topbar .theme-toggle .ico-moon { display: none; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .topbar .theme-toggle .ico-sun { display: inline-block; }
  :root:not([data-theme="light"]) .topbar .theme-toggle .ico-moon { display: none; }
}
.topbar {
  background: var(--surface); color: var(--ink);
  border-bottom: 1px solid var(--hairline);
  display: flex; flex-wrap: wrap; align-items: center; gap: 14px;
  padding: 10px 18px;
  position: sticky; top: 0; z-index: 20;
  box-shadow: var(--elev-1);
}
.topbar .brand { font-weight: 700; text-decoration: none; color: inherit; white-space: nowrap;
  display: inline-flex; align-items: center; gap: 10px; }
.topbar .brand img { width: 34px; height: 34px; border-radius: var(--radius-sm); background: #fff; padding: 3px; display: block; }
.topbar .langswitch { display: inline-flex; align-items: center; gap: 2px; font-size: 13px;
  border: 1px solid var(--line); border-radius: 999px; padding: 2px 4px; }
.topbar .langswitch a { color: var(--muted); text-decoration: none; padding: 2px 9px; border-radius: 999px; opacity: .9; }
.topbar .langswitch a:hover { opacity: 1; background: var(--surface-2); color: var(--ink); }
.topbar .langswitch a.on { background: var(--chip-brand-bg); color: var(--link); opacity: 1; font-weight: 700; }
.topbar nav { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; flex: 1; }
.topbar nav a, .topbar nav .sep {
  color: var(--ink); text-decoration: none; padding: 5px 9px; border-radius: var(--radius-xs); opacity: .82;
}
.topbar nav a:hover { background: var(--surface-2); opacity: 1; color: var(--ink); }
.topbar nav .sep { opacity: .35; padding: 5px 2px; }
/* Administration: one dropdown at every width. On narrow screens app.js keeps
   the menu in fixed coordinates so the nav's row cannot clip it. */
.nav-admin { position: relative; display: block; }
.nav-admin > summary {
  display: flex; align-items: center; gap: 6px; cursor: pointer; list-style: none;
  color: var(--ink); padding: 6px 11px; border-radius: var(--radius-sm);
  font-size: 14.5px; line-height: 1.9; opacity: .88; white-space: nowrap;
}
.nav-admin > summary::-webkit-details-marker { display: none; }
.nav-admin > summary:hover { opacity: 1; background: var(--surface-2); }
.nav-admin[open] > summary { background: var(--surface-2); opacity: 1; }
.nav-admin.active > summary { background: var(--chip-brand-bg); color: var(--link); opacity: 1; font-weight: 600; }
.nav-admin .chev { font-size: 10px; line-height: 1; transition: transform .15s ease; }
.nav-admin[open] .chev { transform: rotate(180deg); }
.nav-admin .nav-menu {
  position: absolute; top: calc(100% + 8px); right: 0; z-index: 30;
  min-width: 200px; padding: 6px; display: flex; flex-direction: column; gap: 2px;
  background: var(--card); border: 1px solid var(--line); border-radius: var(--radius);
  box-shadow: 0 14px 34px rgba(2, 8, 23, .25);
}
.topbar nav .nav-menu a { color: var(--ink); opacity: 1; padding: 8px 10px; border-radius: var(--radius-sm); font-size: 14px; line-height: 1.9; text-decoration: none; }
.topbar nav .nav-menu a:hover { background: var(--chip-bg); color: var(--ink); }
.topbar nav .nav-menu a.active { background: var(--chip-brand-bg); color: var(--link); font-weight: 600; }
.nav-menu-label {
  padding: 9px 10px 3px; border-top: 1px solid var(--line); margin-top: 4px;
  color: var(--muted); font-size: 10.5px; font-weight: 700;
  letter-spacing: .06em; text-transform: uppercase;
}
.topbar .who { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.topbar .who form { margin: 0; }
.container { max-width: 1100px; margin: 22px auto; padding: 0 16px; }
.footer { text-align: center; color: var(--muted); font-size: 12.5px; padding: 26px 10px 34px; }
.card {
  background: var(--card); border: 1px solid var(--hairline); border-radius: var(--radius-lg);
  padding: var(--card-pad-y) var(--card-pad-x); margin-bottom: var(--card-gap);
  box-shadow: var(--elev-1);
}
.card h1, .card h2 { margin: 0 0 12px; font-size: 19px; }
.card h2 { font-size: 16px; }
.page-head { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.page-head h1 { margin: 0; font-size: 21px; }
/* Toolbar: tab pills with count badges. The page's primary action lives in the
   page head (top right), keeping this row to the tabs alone. */
/* Breadcrumb above a detail title: without this it sat flush against the h1. */
.breadcrumb {
  display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px;
  margin: 0 0 12px; font-size: 12.5px; line-height: 1.6;
}
.breadcrumb a { color: var(--muted); text-decoration: none; }
.breadcrumb a:hover { color: var(--link); text-decoration: underline; }
.breadcrumb > span { color: var(--line-strong); }
.page-head .member-head { align-items: flex-start; }
.page-head .member-head h1 { margin: 0 0 3px; }
.page-toolbar { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: center; margin-bottom: 14px; }
.page-toolbar .tabs { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
/* The options page has many tab pills: on narrow screens keep them on one
   swipeable row instead of stacking several rows above the table. */
@media (max-width: 900px) {
  .page-toolbar .tabs {
    flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch;
    scrollbar-width: none; padding-bottom: 2px;
  }
  .page-toolbar .tabs::-webkit-scrollbar { display: none; }
  .page-toolbar .tabs .btn { flex: 0 0 auto; }
}
@media (max-width: 640px) {
  .page-toolbar .tabs .tab-off { display: none; }
}
.page-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.page-toolbar .count {
  display: inline-block; min-width: 20px; margin-left: 6px; padding: 0 6px;
  border-radius: 999px; font-size: 11.5px; line-height: 16px; text-align: center;
  background: var(--count-bg); color: var(--ink); font-weight: 600;
}
.btn:not(.secondary) .count { background: rgba(255,255,255,.28); color: #fff; }
.field-hint { display: block; margin-top: 4px; font-size: 12.5px; font-weight: 400; color: var(--muted); }
th.num, td.num { text-align: right; }
td.empty-state { text-align: center; padding: 30px 12px; color: var(--muted); }
td.empty-state .small { margin-top: 4px; }
.flash {
  padding: 10px 14px; border-radius: var(--radius-sm); margin-bottom: 14px;
  transition: opacity .35s ease, transform .35s ease;
}
.flash-out { opacity: 0; transform: translateY(-4px); }
@media (prefers-reduced-motion: reduce) {
  .flash, .flash-out { transition: none; transform: none; }
}
.flash.ok { background: var(--ok-bg); color: var(--ok-ink); }
.flash.err { background: var(--err-bg); color: var(--err-ink); }
.flash.warn { background: var(--warn-bg); color: var(--warn-ink); }
table { width: 100%; border-collapse: collapse; background: var(--card); }
.tbl-wrap { overflow-x: auto; border: 1px solid var(--hairline); border-radius: var(--radius-lg); background: var(--card); }
th, td { text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--line); font-size: 14px; vertical-align: top; font-variant-numeric: tabular-nums; }
th { background: var(--th-bg); font-weight: 600; white-space: nowrap; }
/* Sortable list headers: the whole label is the link; arrow marks the active sort. */
th .th-sort { color: inherit; text-decoration: none; }
th .th-sort:hover { text-decoration: underline; }
th.sorted { color: var(--link); }
th .sort-ind { font-size: 11px; }
/* Wide tables (member list has 14 columns): keep short values on one line so a
   row's height is driven by the name column, not by township/status labels
   wrapping mid-syllable. Long text columns opt out via .cell-wrap. */
.list-tbl td { white-space: nowrap; }
.list-tbl td.cell-wrap { white-space: normal; }
/* Admin tables keep their Edit/Delete buttons on one line; on phones the
   self-edit note is allowed to wrap inside the pinned action column. */
.admin-tbl .row-actions { white-space: nowrap; }
tr:last-child td { border-bottom: 0; }
tbody tr:hover { background: var(--row-hover); }
.muted { color: var(--muted); }
.small { font-size: 13px; }
.btn {
  display: inline-block; border: 1px solid transparent; border-radius: var(--radius-sm); cursor: pointer;
  background: var(--brand); color: #fff; padding: 9px 16px; font-size: 14.5px;
  font-family: inherit; text-decoration: none;
  line-height: 1.35; min-height: 40px;
}
.btn:hover { filter: brightness(1.08); }
/* Easy date entry (app.js): day / month / year selects in front of the native
   input, which stays in the form as the submitted value. */
.dp { display: inline-flex; gap: 6px; width: 100%; min-width: 0; }
/* A date field in a filter row needs room for three parts; the shared
   "flex: 1 1 170px" would squeeze the month down to an arrow. */
.filters label.field:has(.dp),
.filters label.range-field { flex: 1 1 250px; min-width: 214px; max-width: 320px; }
.dp .dp-part { flex: 0 0 auto; width: auto; padding: 0 4px 0 8px; }
.dp .dp-part:first-child { width: 58px; } /* day */
.dp .dp-part:nth-child(2) { flex: 1 1 0; min-width: 66px; } /* month name */
.dp .dp-part:last-child { width: 78px; } /* year */
/* Optional "Today" shortcut: the picker needs the full field width, so the
   button sits under it, right-aligned, rather than squeezing the year select. */
.dp-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; width: 100%; min-width: 0; }
.dp-row .dp { flex: 1 1 100%; }
.dp-today {
  flex: 0 0 auto; margin-left: auto; height: 32px; min-height: 32px;
  padding: 0 11px; font-size: 12.5px; white-space: nowrap;
}
@media (max-width: 640px) {
  .dp-today { min-height: 40px; height: 40px; }
}
.dp-native {
  position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px;
  border: 0; opacity: 0; pointer-events: none; overflow: hidden;
}
.filter-toolbar .dp { width: 100%; max-width: 262px; }
.filter-toolbar .dp .dp-part { height: 36px; font-size: 13.5px; }
/* Sent forms lock their button until the response arrives (app.js). */
.btn.is-submitting { pointer-events: none; opacity: .65; }
.btn.secondary { background: var(--btn2-bg); color: var(--ink); border: 1px solid var(--line); }
.btn.secondary:hover { filter: none; background: var(--btn2-hover); }
.btn.danger { background: #b42318; }
.btn.danger:hover { filter: brightness(1.1); }
.btn:disabled { opacity: .45; cursor: not-allowed; }
.btn:disabled:hover { filter: none; }
.btn.sm { padding: 5px 10px; font-size: 13px; min-height: 0; }
.btn .dim { opacity: .78; font-weight: 400; }
.btn.full { width: 100%; text-align: center; }
:focus-visible { outline: 2px solid #7aa7e0; outline-offset: 2px; }
.topbar :focus-visible { outline-color: var(--link); }
.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px 18px; }
.form-grid > .span-2 { grid-column: 1 / -1; }
.photo-field { display: flex; align-items: flex-start; gap: 16px; padding: 0 0 16px; margin: 0 0 16px; border-bottom: 1px solid var(--line); }
.photo-preview { flex: none; width: 96px; height: 96px; border-radius: 50%; overflow: hidden; display: grid; place-items: center; background: var(--chip-bg); color: var(--muted); font-size: 32px; font-weight: 700; border: 1px solid var(--line); }
.photo-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
.photo-preview img[hidden] { display: none; }
.photo-preview [data-photo-fallback] { line-height: 1; }
.photo-controls { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.photo-controls > .lbl { color: var(--ink); font-weight: 600; }
.photo-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.photo-pick { position: relative; overflow: hidden; cursor: pointer; }
.photo-pick input[type=file] { position: absolute; inset: 0; width: 100%; height: 100%; padding: 0; border: 0; opacity: 0; cursor: pointer; }
.photo-status { margin: 0; min-height: 17px; font-size: 12.5px; color: var(--muted); }
.photo-status.bad { color: var(--err-ink); }
.head-picker { position: relative; }
.head-picker [data-head-search], .head-picker .head-clear { display: none; }
.head-picker [data-search-input], .head-picker [data-search-clear] { display: none; }
.head-picker.is-ready [data-head-search],
.head-picker.is-ready [data-search-input] { display: block; padding-right: 34px; }
.head-picker.is-ready select[data-head-select],
.head-picker.is-ready select[data-search-select] { display: none; }
.head-picker.is-ready [data-search-clear]:not([hidden]) { display: grid; }
.head-picker .head-clear {
  position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
  width: 26px; height: 26px; padding: 0; border: 0; border-radius: 50%;
  background: var(--btn2-bg); color: var(--muted); font-size: 17px; line-height: 1;
  cursor: pointer; place-items: center;
}
.head-picker.is-ready .head-clear:not([hidden]) { display: grid; }
.head-list {
  position: absolute; z-index: 40; left: 0; right: 0; top: calc(100% + 4px);
  max-height: 260px; overflow: auto; padding: 4px; background: var(--card);
  border: 1px solid var(--line-strong); border-radius: var(--radius); box-shadow: var(--hover-shadow);
}
.head-list[hidden] { display: none; }
.head-option {
  display: block; width: 100%; padding: 8px 10px; border: 0; border-radius: var(--radius-sm);
  background: transparent; color: var(--ink); font: inherit; text-align: left; cursor: pointer;
}
.head-option:hover, .head-option.active { background: var(--chip-brand-bg); }
.head-option.selected { font-weight: 600; }
.head-option[hidden] { display: none; }
.head-picker [data-head-search]::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; display: none; }
.head-empty { padding: 10px; color: var(--muted); font-size: 13px; }
.head-empty[hidden] { display: none; }
.member-avatar-head { display: inline-grid; place-items: center; width: 46px; height: 46px; margin-right: 10px; border-radius: 50%; overflow: hidden; vertical-align: middle; background: var(--chip-brand-bg); color: var(--brand); font-size: 20px; font-weight: 700; box-shadow: 0 0 0 1px var(--line); }
.member-head { display: flex; align-items: center; gap: 14px; }
.member-avatar { display: grid; place-items: center; width: 82px; height: 82px; border-radius: 50%; overflow: hidden; background: var(--chip-brand-bg); color: var(--brand); font-size: 28px; font-weight: 700; box-shadow: 0 0 0 1px var(--line); flex: 0 0 auto; }
.member-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.member-avatar-head img { width: 100%; height: 100%; object-fit: cover; display: block; }
.list-avatar { width: 28px; height: 28px; margin-right: 8px; border-radius: 50%; object-fit: cover; vertical-align: middle; box-shadow: 0 0 0 1px var(--line); }
@media (max-width: 560px) {
  .photo-field { flex-direction: column; align-items: center; text-align: center; }
  .photo-actions { justify-content: center; }
}
input[type=checkbox], input[type=radio] { accent-color: var(--brand); }
label.field { display: block; font-size: 13.5px; color: var(--muted); }
label.field span.lbl { display: block; margin-bottom: 4px; color: var(--ink); font-weight: 600; }
label.field .hint { font-weight: 400; color: var(--muted); }
.field { display: block; font-size: 13.5px; color: var(--muted); }
.field > label.lbl { display: block; margin-bottom: 4px; color: var(--ink); font-weight: 600; }
input[type=text], input[type=search], input[type=password], input[type=date],
input[type=email], input[type=tel], input[type=url],
input[type=number], input[type=file], select, textarea {
  width: 100%; padding: 9px 10px; border: 1px solid var(--line); border-radius: var(--radius-sm);
  font: inherit; background: var(--field-bg); color: var(--ink);
}
/* Uniform control height everywhere (forms + filters): Chromium sizes a bare
   select ~10px taller than a text input, and date inputs have their own
   intrinsic height, so fields in one .form-grid row end up uneven. A fixed
   height with vertical centering keeps inputs, selects and date pickers equal. */
input[type=text], input[type=search], input[type=password], input[type=date],
input[type=email], input[type=tel], input[type=url],
input[type=number], select {
  height: 40px; padding: 0 10px; box-sizing: border-box; vertical-align: middle;
}
input[type=file] { padding: 6px 10px; }
input[type=file]::file-selector-button {
  height: 28px; margin: 0 10px 0 0; padding: 0 10px; border: none; border-radius: var(--radius-xs);
  background: var(--btn2-bg); color: var(--ink); border: 1px solid var(--line); font: inherit; font-size: 13px;
}
input:focus, select:focus, textarea:focus { outline: 2px solid #bcd2f0; border-color: var(--brand); }
textarea { min-height: 84px; resize: vertical; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; align-items: center; }
/* Button rows often wrap a button in a bare <form> (delete/confirm). A block-level
   form inherits the UA margin-bottom, which stretches the flex row and knocks the
   button out of alignment — reset it and let the button size itself. */
.actions form { display: inline-flex; margin: 0; align-items: center; }
/* In table cells, inline buttons sit on the text baseline, which tall Myanmar
   line boxes push down; top-align them so buttons in a row share one line. */
.tbl-wrap td .btn.sm { vertical-align: top; }
.filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; margin-bottom: 14px; }
/* Uniform filter cells: grow to fill the row, capped so the last line does not
   stretch one lonely field across the full width. */
.filters label.field { flex: 1 1 170px; min-width: 150px; max-width: 300px; }
/* One fixed control height so inputs, selects and buttons on the same line
   never disagree (Chromium renders a bare select ~10px taller than an input). */
/* Kept for the filters row: same fixed height as the global form rule above. */
.filters input, .filters select { height: 40px; padding: 0 10px; }
.filters .actions { margin-left: auto; }
.badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 12.5px; background: var(--chip-bg); }
.badge.active { background: var(--ok-bg); color: var(--ok-ink); }
.badge.moved { background: var(--warn-bg); color: var(--warn-ink); }
.badge.inactive { background: var(--err-bg); color: var(--err-ink); }
/* ---------- login: branded split card ---------- */
/* Centre the card in the space between the top bar and the footer. */
body.auth-page { min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; }
body.auth-page .container {
  flex: 1 0 auto; width: 100%; max-width: 1100px; margin: 0 auto;
  padding: 28px 16px; display: flex; align-items: center; justify-content: center;
}
body.auth-page .footer { padding-top: 0; }
.auth-wrap { width: 100%; max-width: 940px; margin: 0 auto; }
.auth-card {
  display: grid; grid-template-columns: 1.05fr 1fr; background: var(--card);
  border: 1px solid var(--line); border-radius: var(--radius-lg); overflow: hidden;
  box-shadow: 0 18px 44px rgba(16, 40, 74, .12);
}
.auth-aside {
  position: relative; overflow: hidden; color: #fff; padding: 32px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; text-align: center;
  background: linear-gradient(150deg, var(--brand) 0%, #14355f 72%, #0f2a4c 100%);
}
.auth-aside::after {
  content: ""; position: absolute; right: -70px; bottom: -90px; width: 260px; height: 260px;
  border-radius: 50%; background: rgba(255,255,255,.07); pointer-events: none;
}
.auth-mark {
  width: 112px; height: 112px; border-radius: 24px; background: #fff; padding: 7px; flex: none;
  box-shadow: 0 12px 28px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.16);
}
.auth-aside h1 { margin: 0; font-size: 27px; line-height: 1.3; letter-spacing: -.01em; }
.auth-lead { margin: 8px auto 0; max-width: 300px; color: rgba(255,255,255,.8); font-size: 13.5px; line-height: 1.6; }
.auth-points {
  list-style: none; margin: 0 auto; padding: 18px 0 0; width: 100%; max-width: 258px;
  display: flex; flex-direction: column; gap: 11px; text-align: left;
  font-size: 13.5px; color: rgba(255,255,255,.92); position: relative; z-index: 1;
  border-top: 1px solid rgba(255,255,255,.16);
}
.auth-points li { display: flex; align-items: flex-start; gap: 10px; }
.auth-points svg {
  width: 14px; height: 14px; flex: none; margin-top: 1px; padding: 3px; box-sizing: content-box;
  color: #d5e7fb; background: rgba(255,255,255,.12); border-radius: 50%;
}
/* Myanmar glyphs need extra leading in the narrow brand column. */
html[lang="my"] .auth-aside h1 { line-height: 1.7; }
html[lang="my"] .auth-lead,
html[lang="my"] .auth-points li { line-height: 1.9; }
.auth-main { padding: 34px 32px 30px; display: flex; flex-direction: column; justify-content: center; }
.auth-main h2 { margin: 0 0 4px; font-size: 21px; letter-spacing: -.01em; }
.auth-sub { margin: 0 0 18px; line-height: 1.5; }
.auth-main form { margin-top: 2px; }
.auth-main .actions { margin-top: 18px; }
/* Password visibility toggle: the button sits inside the field, so the input
   keeps its normal width and focus ring; only the right padding grows. */
.pw-wrap { position: relative; display: block; }
.pw-wrap input { padding-right: 44px; }
.pw-toggle {
  position: absolute; right: 5px; top: 50%; transform: translateY(-50%);
  width: 32px; height: 32px; padding: 0; border: 0; border-radius: var(--radius-sm);
  background: transparent; color: var(--muted); cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.pw-toggle:hover { background: var(--chip-bg); color: var(--ink); }
.pw-toggle svg { width: 17px; height: 17px; display: block; }
.pw-toggle .ico-eye-off { display: none; }
.pw-toggle[aria-pressed="true"] .ico-eye { display: none; }
.pw-toggle[aria-pressed="true"] .ico-eye-off { display: block; }
.caps-hint {
  display: block; margin-top: 6px; padding: 5px 9px; border-radius: var(--radius-sm);
  background: var(--warn-bg); color: var(--warn-ink); font-size: 12px; font-weight: 600;
}
.caps-hint[hidden] { display: none; }
.auth-secure { display: flex; align-items: center; justify-content: center; text-align: center; gap: 6px; margin: 18px 0 0; font-size: 12px; color: var(--muted); }
.auth-remember { margin: 14px 0 0; }
.auth-remember-note { margin: 6px 0 0; }
.auth-secure svg { width: 13px; height: 13px; flex: none; }
.auth-card + * { margin-top: 18px; }
@media (max-width: 820px) {
  body.auth-page .container { padding: 16px 12px; }
  .auth-card { grid-template-columns: 1fr; }
  .auth-aside { padding: 22px; gap: 12px; }
  .auth-aside h1 { font-size: 21px; }
  .auth-mark { width: 84px; height: 84px; border-radius: 19px; padding: 5px; }
  .auth-points { display: none; }
  .auth-main { padding: 22px; }
}
@media (max-width: 420px) {
  .auth-main { padding: 18px; }
  .auth-aside { padding: 18px; }
  .auth-mark { width: 68px; height: 68px; border-radius: var(--radius-lg); }
  .auth-card { border-radius: var(--radius-lg); }
}
/* ---------- dashboard / KPI stat cards ---------- */
.stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(158px, 1fr)); gap: var(--space-3); }
/* ---------- member list column chooser ---------- */
.col-chooser { position: relative; display: inline-block; margin-bottom: 10px; }
.col-chooser summary { list-style: none; }
.col-chooser summary::-webkit-details-marker { display: none; }
.col-menu {
  position: absolute; z-index: 40; top: calc(100% + 6px); left: 0; min-width: 330px;
  background: var(--card); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 10px 14px; display: grid; grid-template-columns: repeat(2, minmax(140px, 1fr));
  gap: 6px 16px; box-shadow: var(--hover-shadow);
}
.col-menu label { display: flex; align-items: center; gap: 7px; font-size: 13.5px; color: var(--ink); white-space: nowrap; cursor: pointer; }
.col-menu input { width: auto; }
.stat {
  background: var(--card); border: 1px solid var(--hairline); border-radius: var(--radius-lg);
  padding: var(--space-5) var(--space-6); display: flex; flex-direction: column; gap: var(--space-2);
}
.stat:hover { border-color: var(--line-strong); box-shadow: var(--hover-shadow); }
@media (prefers-reduced-motion: no-preference) {
  .stat { transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease; }
  .stat:hover { transform: translateY(-2px); }
}
.stat .n { font-size: 27px; font-weight: 700; line-height: 1.15; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.stat .n .sep { color: var(--sep); font-weight: 400; padding: 0 2px; }
.stat .t { color: var(--muted); font-size: 13px; line-height: 1.45; }
.stat .t .rng { font-size: 12px; opacity: .85; }
.stat .sub { display: flex; flex-wrap: wrap; gap: 4px 8px; font-size: 12.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
.stat .ico { width: 30px; height: 30px; border-radius: var(--radius-sm); flex: none; display: inline-flex; align-items: center; justify-content: center; background: var(--chip-bg); color: var(--link); }
.stat .ico svg { width: 16px; height: 16px; }
.stat .ico.brand { background: var(--chip-brand-bg); color: var(--link); }
.stat .ico.ok { background: var(--ok-bg); color: var(--ok-ink); }
.stat .ico.warn { background: var(--warn-bg); color: var(--warn-ink); }
.stat .ico.err { background: var(--err-bg); color: var(--err-ink); }
.stat .ico.purple { background: var(--chip-purple-bg); color: var(--chip-purple-ink); }
/* male/female proportion bar (gender + age-group cards) */
.splitbar { display: flex; height: 6px; border-radius: 999px; overflow: hidden; background: var(--track); }
.splitbar .m { background: var(--male); }
.splitbar .f { background: var(--female); }
.gm { color: var(--male); }
.gf { color: var(--female); }
/* state/region count bars (dashboard table) */
.hbar-track { height: 8px; background: var(--track); border-radius: 999px; overflow: hidden; }
.hbar { height: 100%; border-radius: 999px; background: var(--link); }
th.bar-col { width: 42%; }
.matrix td, .matrix th { text-align: center; }
.matrix td:first-child, .matrix th:first-child { text-align: left; }
.err-list { color: var(--err-ink); margin: 6px 0; padding-left: 18px; }
/* ---------- modals ---------- */
.modal { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 22px; }
.modal[hidden] { display: none; }
.modal-backdrop { position: absolute; inset: 0; background: rgba(15,23,42,.55); }
.modal-card { position: relative; background: var(--card); border-radius: var(--radius-lg); width: min(720px, 100%); max-height: min(88dvh, 940px); display: flex; flex-direction: column; box-shadow: 0 24px 70px rgba(2,8,23,.35); }
.modal-card.sm { width: min(440px, 100%); }
.modal-card.md { width: min(620px, 100%); }
.modal-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 15px 20px; border-bottom: 1px solid var(--line); }
.modal-head h3 { margin: 0; font-size: 17px; }
.modal-x { background: none; border: 0; font-size: 24px; line-height: 1; cursor: pointer; color: var(--muted); padding: 2px 9px; border-radius: var(--radius-sm); font-family: inherit; }
.modal-x:hover { background: var(--chip-bg); color: var(--ink); }
.modal-body { padding: 18px 20px; overflow-y: auto; display: flex; flex-direction: column; }
.modal-body .card { margin-bottom: 14px; }
/* Modal forms share one rhythm: fields stack with a steady gap, section
   headings group related choices, and the submit bar sticks to the bottom. */
.modal-body form { display: flex; flex-direction: column; gap: 14px; flex: 1 1 auto; }
.modal-body form .form-grid { gap: 14px 16px; }
.modal-body form > .actions { margin-top: 0; }
.modal-body form > .actions:last-child {
  position: sticky; bottom: -18px; z-index: 1; margin-top: auto;
  margin-left: -20px; margin-right: -20px; margin-bottom: -18px; padding: 12px 20px;
  background: var(--card); border-top: 1px solid var(--line);
  justify-content: flex-end;
}
/* Cancel sits left of the primary action in the sticky bar. */
.modal-body form > .actions:last-child .btn.secondary { order: -1; }
/* Delete on the left, Save on the right, in one footer row. */
.modal-body form > .actions.modal-actions-split { justify-content: space-between; }
.form-section { margin: 0; padding: 0; border: 0; min-width: 0; }
.form-section + .form-section { margin-top: 2px; }
.form-section legend {
  padding: 0; margin-bottom: 8px; font-size: 13.5px;
  font-weight: 600; color: var(--ink);
}
/* Pastor profile editor: a compact portrait strip above grouped fieldsets, so
   the long profile reads as three short sections instead of one flat column. */
.pastor-photo-field { padding-bottom: 14px; margin-bottom: 0; }
.pastor-photo-field .photo-preview { width: 80px; height: 80px; font-size: 26px; }
.pastor-photo-field .hint { max-width: 52ch; font-size: 12.5px; }
.pastor-section { padding-top: 14px; border-top: 1px dashed var(--line); }
.pastor-section:first-of-type { padding-top: 0; border-top: 0; }
.pastor-section legend {
  display: flex; align-items: center; width: 100%; padding: 0;
  margin-bottom: 10px; font-size: 11.5px; font-weight: 700;
  letter-spacing: .06em; text-transform: uppercase; color: var(--muted);
}
.pastor-section legend::after {
  content: ""; flex: 1; height: 1px; margin-left: 10px; background: var(--line);
}
.req { color: var(--err-ink); }
.check-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(158px, 1fr)); gap: 8px; }
.check-chip {
  display: flex; align-items: center; gap: 8px; min-width: 0;
  padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--radius-sm);
  background: var(--field-bg); color: var(--ink); font-size: 13.5px;
  line-height: 1.45; cursor: pointer;
  transition: border-color .12s ease, background-color .12s ease;
}
.check-chip:hover { border-color: var(--line-strong); background: var(--btn2-hover); }
.check-chip:has(input:checked) { border-color: var(--brand); background: var(--chip-brand-bg); }
/* Chips the account form hides when their state is out of scope. */
.check-chip[hidden] { display: none; }
.hint[hidden] { display: none; }
.check-chip input { accent-color: var(--brand); margin: 0; flex: none; }
.check-chip span { overflow-wrap: anywhere; }
.check-chip-all { margin-bottom: 8px; }

@media (prefers-reduced-motion: no-preference) {
  .modal-card { animation: modalIn .16s ease-out; }
  @keyframes modalIn { from { transform: translateY(10px); opacity: .55; } }
}
/* ---------- responsive: small laptop / tablet (≤900px) ---------- */
@media (max-width: 900px) {
  .topbar { padding: 8px 12px; gap: 8px 10px; }
  .topbar .brand { font-size: 14.5px; min-width: 0; }
  .topbar .brand-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .topbar .brand img { width: 28px; height: 28px; flex: none; }
  .topbar nav { order: 3; flex-basis: 100%; flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch;
    scrollbar-width: none; }
  .topbar nav::-webkit-scrollbar { display: none; }
  .topbar nav a, .topbar nav .sep { white-space: nowrap; }
  .container { margin: 16px auto; }
  .form-grid { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
}
/* ---------- responsive: large desktop (≥1200px) ---------- */
@media (min-width: 1200px) {
  /* 1600px so the 14-column member list fits without horizontal scrolling.
     Breakpoint lowered from 1400px: common 1366px laptops were stuck with the
     1100px container and wide dead margins either side of the table. Cells
     tighten a little so all columns fit inside a 1366px viewport. */
  .container { max-width: 1600px; }
  .list-tbl th, .list-tbl td { padding: 8px 5px; font-size: 13px; }
  .list-tbl td:nth-child(2) { max-width: 210px; overflow: hidden; text-overflow: ellipsis; }
  /* Long double-word headers wrap instead of widening the whole table. */
  .list-tbl th[data-col="sector"] { max-width: 100px; }
  .list-tbl th[data-col="sector"] .th-sort { white-space: normal; }
}
/* ---------- responsive: phones (≤640px) ---------- */
@media (max-width: 640px) {
  body { font-size: 14px; }
  .container { margin-top: 12px; padding: 0 10px; }
  .card { padding: 14px; border-radius: var(--radius-sm); }
  .page-head h1 { font-size: 18px; }
  .page-head .actions { width: 100%; margin: 0; }
  .page-head .actions .btn { flex: 1 1 auto; text-align: center; }
  .page-actions { width: 100%; }
  .page-actions .btn { flex: 1 1 auto; text-align: center; }
  .filters { gap: 8px; }
  .filters label.field { flex: 1 1 46%; min-width: 0; max-width: none; }
  .filters .actions { width: 100%; margin-top: 2px; }
  .filters .actions .btn { flex: 1; }
  th, td { padding: 8px 10px; font-size: 13px; }
  table.list-tbl { min-width: 760px; }
  .tbl-wrap { -webkit-overflow-scrolling: touch; }
  /* Keep cell content on one line inside the horizontal scroller — wrapping a
     name one syllable per line is unreadable. Scoped to the member list: on
     admin tables (users, roles) nowrap made long descriptions and permission
     badges push the action buttons far off-screen. */
  .list-tbl td:not(.empty-state) { white-space: nowrap; }
  .list-tbl td.cell-wrap { white-space: normal; }
  .list-tbl td:nth-child(2) { min-width: 130px; }
  /* Admin tables (users, roles) keep compact rows and pin their action
     column to the right, so Edit/Delete is reachable without a long swipe. */
  .admin-tbl th, .admin-tbl td { white-space: nowrap; }
  .admin-tbl th:last-child, .admin-tbl td:last-child {
    position: sticky; right: 0; z-index: 2; background: var(--card);
    box-shadow: -8px 0 10px -8px rgba(16,24,40,.28);
  }
  .admin-tbl thead th:last-child { background: var(--th-bg); z-index: 3; }
  .admin-tbl tbody tr:hover td:last-child { background: var(--row-hover); }
  /* A centred empty-state cell sits in the middle of a wide table, which is
     off-screen when the table scrolls; keep its message at the visible edge. */
  .tbl-wrap td.empty-state { text-align: left; }
  .form-grid { grid-template-columns: 1fr; gap: 12px; }
  .btn { min-height: 40px; }
  .btn.sm { min-height: 34px; }
  .actions { gap: 8px; }
  .stat { padding: 12px 13px; gap: 6px; }
  .stat .n { font-size: 22px; }
  .stat .ico { width: 26px; height: 26px; }
  .stat .ico svg { width: 14px; height: 14px; }
  .modal { padding: 10px; align-items: center; }
  /* Content-sized sheets on phones: a short form no longer leaves a mostly
     empty full-height panel, and tall ones still scroll inside the viewport. */
  .modal-card { width: 100%; height: auto; max-height: calc(100dvh - 20px); border-radius: var(--radius); }
  .modal-head { position: sticky; top: 0; background: var(--card); z-index: 2; }
  /* Keep the sheet inside the viewport even when the underlying scrollbar removal
     relayouts the page (iOS Safari body-lock quirk). */
  .modal-card { max-width: calc(100vw - 20px); }
  .topbar .theme-toggle { width: 34px; min-height: 34px; }
  .topbar .theme-toggle svg { width: 15px; height: 15px; }
}
@media (max-width: 400px) {
  .filters label.field { flex: 1 1 100%; }
}
/* Password strength meter under a password input (public/app.js fills bars). */
.pw-strength {
  display: flex; align-items: center; gap: 8px; margin-top: 6px;
}
.pw-strength .pw-bars {
  display: flex; gap: 3px; flex: 0 0 auto;
}
.pw-strength .pw-bars span {
  width: 26px; height: 5px; border-radius: 3px;
  background: var(--line, #e4e7ec); transition: background .15s ease;
}
.pw-strength.s1 .pw-bars span:nth-child(-n+1) { background: var(--err-ink, #a11b1b); }
.pw-strength.s2 .pw-bars span:nth-child(-n+2) { background: var(--warn-ink, #8a5300); }
.pw-strength.s3 .pw-bars span:nth-child(-n+3) { background: var(--ok-ink, #14683a); }
.pw-strength.s4 .pw-bars span { background: var(--ok-ink, #14683a); }
.pw-strength .pw-label {
  font-size: 12px; color: var(--muted, #667085); line-height: 1.2; min-width: 0;
}

/* ============================================================
   UI refresh — hierarchy, mobile ergonomics and dark-mode polish.
   These rules refine the base styles above; keep tokens at :root.
   ============================================================ */
/* Let native widgets (scrollbars, date pickers, checkboxes) follow the theme. */
:root { color-scheme: light; }
:root[data-theme="dark"] { color-scheme: dark; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { color-scheme: dark; }
}
* { scrollbar-color: var(--line-strong) transparent; scrollbar-width: thin; }

/* Keyboard users can jump the header/nav. Hidden until focused. */
.skip-link {
  position: absolute; left: 12px; top: -60px; z-index: 100;
  background: var(--card); color: var(--ink); padding: 9px 14px;
  border-radius: var(--radius-sm); border: 1px solid var(--line-strong); font-weight: 600;
  text-decoration: none; transition: top .15s ease;
}
.skip-link:focus { top: 12px; }

/* ---------- topbar ---------- */
.topbar { padding: 9px 18px; gap: 8px 14px; }
.topbar nav { gap: 2px; }
.topbar nav a { padding: 6px 11px; border-radius: var(--radius-sm); font-size: 14.5px; line-height: 1.9; opacity: .88; }
.topbar nav a:hover { opacity: 1; background: rgba(255,255,255,.12); }
.topbar nav a.active { background: rgba(255,255,255,.2); opacity: 1; font-weight: 600; }
.topbar .who { gap: 10px; }
.topbar .who-link {
  color: var(--ink); text-decoration: none; font-weight: 600;
  padding: 4px 7px; border-radius: var(--radius-sm); max-width: 140px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.topbar .who-link:hover { background: var(--surface-2); }
.topbar .who form .btn {
  background: var(--btn2-bg); border: 1px solid var(--line);
  color: var(--ink); min-height: 34px; padding: 5px 12px;
}
.topbar .who form .btn:hover { background: var(--btn2-hover); filter: none; }
.topbar .langswitch a { min-height: 30px; display: inline-flex; align-items: center; }

/* Between tablet and desktop the nav needs its own row; keeping it inline
   would wrap a few items under the brand and leave an awkward gap. */
@media (max-width: 1180px) {
  .topbar nav {
    order: 3; flex-basis: 100%; flex-wrap: nowrap; overflow-x: auto;
    -webkit-overflow-scrolling: touch; scrollbar-width: none;
  }
  .topbar nav::-webkit-scrollbar { display: none; }
  .topbar .who { margin-left: auto; }
}

/* ---------- page/card polish ---------- */
.page-head { margin-bottom: 16px; }
.page-head h1 { font-size: 22px; letter-spacing: -.01em; }
.page-head .count-pill {
  display: inline-block; vertical-align: middle; margin-left: 8px; padding: 1px 9px;
  border-radius: 999px; background: var(--chip-bg); color: var(--muted);
  font-size: 12.5px; font-weight: 600; letter-spacing: 0;
}
.btn:not(.secondary):not(.danger):not(.outline-danger) { box-shadow: 0 1px 2px rgba(16,24,40,.12); }
.btn.outline-danger {
  background: transparent; color: #b42318; border: 1px solid #e6b4b0;
}
.btn.outline-danger:hover { background: var(--err-bg); filter: none; }
:root[data-theme="dark"] .btn.outline-danger { color: var(--err-ink); border-color: #6b3134; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .btn.outline-danger { color: var(--err-ink); border-color: #6b3134; }
}

/* ---------- collapsible filter panel (mobile) ---------- */
.filter-box { margin-bottom: 14px; }
.filter-box > summary { display: none; }
.filter-box > form.filters { margin-bottom: 0; }

/* ---------- table: scroll affordance + sticky identity ---------- */
.scroll-hint { display: none; }
@media (max-width: 1180px) {
  .topbar { padding: 8px 12px; }
  .topbar nav { padding-right: 18px; }
  .list-tbl th:first-child, .list-tbl td:first-child {
    position: sticky; left: 0; z-index: 3; background: var(--card);
  }
  .list-tbl th[data-col="name"], .list-tbl td[data-col="name"] {
    position: sticky; left: 28px; z-index: 2; background: var(--card);
    box-shadow: 8px 0 10px -8px rgba(16,24,40,.28);
  }
  .list-tbl thead th:first-child, .list-tbl thead th[data-col="name"] { background: var(--th-bg); z-index: 5; }
  .list-tbl tbody tr:hover td:first-child, .list-tbl tbody tr:hover td[data-col="name"] { background: var(--row-hover); }
  .scroll-hint {
    display: flex; align-items: center; gap: 6px; margin: 2px 0 8px;
    color: var(--muted); font-size: 12.5px;
  }
}

/* ---------- floating bulk action bar ---------- */
#bulk-bar {
  position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%);
  z-index: 45; width: min(760px, calc(100% - 24px));
  padding: 12px 16px; margin: 0; border-radius: var(--radius);
  box-shadow: 0 14px 34px rgba(2,8,23,.3);
}
#bulk-bar .bulk-count { font-weight: 700; white-space: nowrap; }
#bulk-bar select { flex: 1 1 170px; min-width: 0; }
#bulk-bar .btn { flex: none; }
@media (max-width: 640px) {
  #bulk-bar { bottom: 10px; width: calc(100% - 16px); padding: 10px 12px; gap: 8px; }
  #bulk-bar select { flex: 1 1 100%; }
  #bulk-bar .btn { flex: 1 1 100%; }
  .topbar nav { mask-image: linear-gradient(to right, #000 88%, transparent); -webkit-mask-image: linear-gradient(to right, #000 88%, transparent); }
  .filter-box > summary {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    list-style: none; cursor: pointer; padding: 11px 14px;
    background: var(--card); border: 1px solid var(--line); border-radius: var(--radius);
    font-weight: 600; font-size: 14px; color: var(--ink);
  }
  .filter-box > summary::-webkit-details-marker { display: none; }
  .filter-box > summary .chev { transition: transform .15s ease; color: var(--muted); }
  .filter-box[open] > summary { border-bottom-left-radius: 0; border-bottom-right-radius: 0; border-bottom-color: transparent; }
  .filter-box[open] > summary .chev { transform: rotate(180deg); }
  .filter-box > form.filters { border-top-left-radius: 0; border-top-right-radius: 0; }
  .filter-box > form.filters .actions { margin-top: 4px; }
  .who-link { max-width: 70px; }
  .topbar .who form .btn { white-space: nowrap; padding: 0 10px; }
  .page-head .actions .primary-action { order: -1; }
  .dash-kpis { gap: 10px; }
  .kpi { padding: 13px 13px 12px; border-radius: var(--radius); }
  .kpi .k-num { font-size: 25px; }
  .dc-foot { font-size: 12px; }
}

/* ---------- member detail sections ---------- */
.detail-card { margin-bottom: 18px; }
.detail-card h2 { margin: 0 0 4px; }
.detail-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 0 24px;
}
.detail-item { padding: 10px 0; border-bottom: 1px solid var(--line); min-width: 0; }
.detail-item:last-child { border-bottom: 0; }
.detail-item .k {
  display: block; font-size: 12px; font-weight: 600; color: var(--muted);
  text-transform: uppercase; letter-spacing: .04em; margin-bottom: 2px;
}
.detail-item .v { font-size: 14.5px; overflow-wrap: anywhere; }
.detail-item .v.empty { color: var(--muted); }
/* Daily reports keep the writer's line breaks without rendering HTML. */
.report-body { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.6; font-size: 14.5px; }
/* Edit history: one row per save, with old → new for short fields. */
.edit-hist { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.edit-hist > li { border-top: 1px solid var(--line); padding-top: 10px; }
.edit-hist > li:first-child { border-top: 0; padding-top: 0; }
.edit-meta { font-size: 12.5px; color: var(--muted); margin-bottom: 6px; }
.edit-changes { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.edit-change { display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; font-size: 14px; }
.edit-change .k { font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; min-width: 90px; }
.edit-old { color: var(--muted); text-decoration: line-through; overflow-wrap: anywhere; }
.edit-new { font-weight: 600; overflow-wrap: anywhere; }
.edit-arrow { color: var(--muted); }
.edit-diff { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 8px 10px; }
.edit-diff summary { cursor: pointer; font-weight: 600; font-size: 13.5px; }
.edit-pair { margin-top: 6px; }
.edit-pair .k { display: block; font-size: 11.5px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.edit-pair .report-body { font-size: 13.5px; }
/* Dashboard daily-report summary: three compact counters above the state table. */
.rep-sum { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 12px; }
.rep-sum > div { background: var(--chip-bg); border-radius: var(--radius); padding: 10px 12px; }
.rep-sum .n { font-size: 22px; font-weight: 700; line-height: 1.15; }
.rep-sum .t { font-size: 12.5px; color: var(--muted); }
.rep-sum .ok .n { color: var(--ok-ink); }
.rep-sum .warn .n { color: var(--warn-ink); }

/* ---------- empty state ---------- */
td.empty-state { padding: 38px 16px; }
td.empty-state strong { font-size: 15px; color: var(--ink); }
td.empty-state .small { margin-top: 4px; }

/* ---------- dashboard: card layout ---------- */
.page-sub { margin: 2px 0 0; color: var(--muted); font-size: 13.5px; }
/* Deploy/schema status chip beside the dashboard title (links to /healthz). */
.health-chip {
  display: inline-flex; align-items: center; gap: 6px; margin-left: 8px;
  padding: 2px 9px; border-radius: 999px; border: 1px solid transparent;
  font-size: 11.5px; font-weight: 600; line-height: 1.7; white-space: nowrap;
  vertical-align: middle; text-decoration: none;
}
.health-chip.ok { background: var(--ok-bg); color: var(--ok-ink); }
.health-chip.err { background: var(--err-bg); color: var(--err-ink); }
.health-chip:hover { filter: brightness(1.04); }
.health-chip .hc-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex: none; }
.health-chip .hc-ver { font-weight: 400; opacity: .78; font-variant-numeric: tabular-nums; }

/* Compact filter toolbar shared by the dashboard and the members list. Selects
   auto-submit and the active choices are echoed as removable chips below. */
.dash-head { align-items: flex-start; gap: 12px 24px; margin-bottom: 10px; }
.dash-head-title { flex: 1 1 240px; min-width: 0; }
.filter-toolbar-box { margin: 0 0 12px; }
.dash-head .filter-toolbar-box { margin: 0; flex: 0 1 auto; max-width: 100%; }
.filter-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 0; }
.filter-toolbar select {
  /* Wide enough for the longest option label ("All departments"); at 150px it
     was clipped to "All departmen" on desktop. */
  width: 172px; max-width: 100%; height: 36px; padding: 0 28px 0 10px;
  font-size: 13.5px; border-radius: var(--radius-sm);
}
.filter-toolbar input[type="search"] {
  width: 240px; max-width: 100%; height: 36px; padding: 0 10px;
  font-size: 13.5px; border-radius: var(--radius-sm);
}
.filter-clear {
  padding: 6px 4px; font-size: 13px; color: var(--muted);
  text-decoration: none; white-space: nowrap;
}
.filter-clear:hover { color: var(--ink); text-decoration: underline; }
/* Quick ranges are a secondary shortcut, so they stay a compact row of pills
   rather than competing with the primary actions above them. */
.quick-ranges { display: flex; flex-wrap: wrap; gap: 4px; margin: 0 0 12px; }
.quick-chip {
  display: inline-flex; align-items: center; min-height: 30px; padding: 3px 11px;
  border: 1px solid var(--line); border-radius: 999px; background: var(--card);
  color: var(--muted); font-size: 12.5px; font-weight: 600; text-decoration: none;
}
.quick-chip.active { color: var(--link); }
.quick-chip:hover { border-color: var(--muted); text-decoration: none; }
.quick-chip.active { border-color: var(--link); background: var(--accent-soft, #e8f0fb); color: var(--link); }
.filter-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: -2px 0 12px; }
.filter-chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px 4px;
  border: 1px solid var(--line); border-radius: 999px; background: var(--chip-bg);
  color: var(--ink); font-size: 12.5px; font-weight: 600; line-height: 1.9;
  text-decoration: none;
}
.filter-chip:hover { border-color: var(--muted); }
.filter-chip .chip-x { color: var(--muted); font-size: 15px; line-height: 1; }
.filter-chip:hover .chip-x { color: var(--err-ink); }
.filter-clear-all { margin-left: 2px; font-size: 12.5px; color: var(--muted); }
.filter-clear-all:hover { color: var(--ink); }
.filter-count {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; margin-left: 6px; padding: 0 5px;
  border-radius: 999px; background: var(--link); color: #fff;
  font-size: 11px; font-weight: 700;
}
@media (max-width: 640px) {
  /* On phones the toolbar collapses behind the "Filters" summary. */
  .dash-head { align-items: stretch; }
  .dash-head .filter-toolbar-box { flex: 1 1 100%; }
  .filter-toolbar {
    display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 12px;
    background: var(--card); border: 1px solid var(--line); border-top: 0;
    border-radius: 0 0 12px 12px;
  }
  .filter-toolbar select, .filter-toolbar input[type="search"] { width: 100%; height: 40px; }
  .filter-toolbar input[type="search"] { grid-column: 1 / -1; }
  .filter-clear { grid-column: 1 / -1; text-align: left; }
}
@media (max-width: 400px) {
  /* Two columns still fit a 360px phone; one column made the panel taller than
     the list it filters. The date picker keeps a full row of its own. */
  .filter-toolbar { grid-template-columns: 1fr 1fr; }
  .filter-toolbar .dp { grid-column: 1 / -1; max-width: none; }
}
@media (max-width: 340px) {
  .filter-toolbar { grid-template-columns: 1fr; }
}
.dash-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
.kpi {
  position: relative; overflow: hidden; background: var(--card);
  border: 1px solid var(--line); border-radius: var(--radius-lg); padding: 12px 14px 11px;
  display: flex; flex-direction: column; gap: 6px; --accent: var(--link);
}
.kpi::before { content: ""; position: absolute; inset: 0 0 auto; height: 3px; background: var(--accent); opacity: .85; }
.kpi.ok { --accent: var(--ok-ink); }
.kpi.warn { --accent: var(--warn-ink); }
.kpi.err { --accent: var(--err-ink); }
.kpi .k-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.kpi .ico {
  width: 30px; height: 30px; border-radius: var(--radius); flex: none;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--chip-bg); color: var(--accent);
}
.kpi .ico svg { width: 17px; height: 17px; }
.kpi.ok .ico { background: var(--ok-bg); }
.kpi.warn .ico { background: var(--warn-bg); }
.kpi.err .ico { background: var(--err-bg); }
.kpi .k-pct {
  font-size: 11.5px; font-weight: 600; color: var(--muted); white-space: nowrap;
  background: var(--chip-bg); border-radius: 999px; padding: 2px 8px;
  max-width: 60%; overflow: hidden; text-overflow: ellipsis;
}
.kpi .k-num { font-size: 25px; font-weight: 700; line-height: 1.05; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.kpi .k-lbl { color: var(--muted); font-size: 12.5px; line-height: 1.35; }
.kpi .k-bar { height: 5px; border-radius: 999px; background: var(--track); overflow: hidden; margin-top: auto; }
.kpi .k-bar span { display: block; height: 100%; border-radius: 999px; background: var(--accent); }
/* hero (total) card: same dark surface as the rest of the dashboard,
   with the blue accent line carrying the emphasis. */
.kpi.hero {
  --accent: var(--link);
  border-color: var(--line); color: var(--ink);
  background: var(--card);
  box-shadow: 0 1px 2px rgba(2,6,18,.14);
}
.kpi.hero::before { background: var(--link); opacity: .85; }
.kpi.hero .ico { background: var(--chip-brand-bg); color: var(--link); }
.kpi.hero .k-pct { background: var(--chip-bg); color: var(--ink); font-weight: 600; }
.kpi.hero .k-lbl { color: var(--muted); }
@media (prefers-reduced-motion: no-preference) {
  .kpi { transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease; }
  .kpi:hover { transform: translateY(-2px); border-color: var(--line-strong); box-shadow: var(--hover-shadow); }
  .kpi.hero:hover { box-shadow: var(--hover-shadow); }
}

/* Paired cards share a row height: the region list and the gender panel line up
   as two equal-height panels. */
.dash-cols { display: grid; grid-template-columns: 1.55fr 1fr; gap: 14px; align-items: stretch; margin-bottom: 14px; }
.dash-card { margin: 0; padding: 16px 18px; border-radius: var(--radius-lg); display: flex; flex-direction: column; min-width: 0; }
.dash-card .dc-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.dash-card .dc-head h2 { margin: 0; font-size: 15px; }
.dash-card .dc-head a { font-size: 12.5px; text-decoration: none; white-space: nowrap; }

/* ranked state/region list: the five busiest regions; /regions has the rest. */
.rank-list {
  list-style: none; margin: 0; padding: 0 6px 0 0; display: flex; flex-direction: column; gap: 11px;
}
.rank-list:focus-visible { outline: 2px solid var(--link); outline-offset: 4px; border-radius: var(--radius-xs); }
.dc-foot {
  display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap;
  gap: 4px 10px; margin-top: auto; padding-top: 12px; border-top: 1px solid var(--line);
  font-size: 12.5px; color: var(--muted);
}
.dc-foot b { color: var(--ink); font-variant-numeric: tabular-nums; }
/* Regional coverage: a slim footer read-out, not a nested mini-card. */
.dc-cov { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
.dc-cov-track {
  width: 64px; height: 5px; flex: none; border-radius: 999px;
  background: var(--track); overflow: hidden;
}
.dc-cov-track > span { display: block; height: 100%; border-radius: 999px; background: var(--link); }
.dc-cov b { color: var(--ink); font-variant-numeric: tabular-nums; }

/* full state/region breakdown page */
.region-panel { padding: 16px 18px; border-radius: var(--radius-lg); }
.region-panel-head {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;
  gap: 10px 18px; margin-bottom: 14px;
}
.region-total { font-size: 13px; color: var(--muted); }
.region-total b { margin-right: 4px; font-size: 22px; color: var(--ink); font-variant-numeric: tabular-nums; }
.region-cov { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--muted); }
.region-cov b { color: var(--ink); font-variant-numeric: tabular-nums; }
.region-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
.region-tile {
  display: flex; flex-direction: column; gap: 7px; min-width: 0;
  padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--radius);
  background: var(--card); color: var(--ink); text-decoration: none;
}
.region-tile:hover { border-color: var(--line-strong); background: var(--chip-bg); }
.rt-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.rt-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13.5px; font-weight: 500; }
.rt-n { flex: none; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
.rt-bar { height: 5px; border-radius: 999px; background: var(--track); overflow: hidden; }
.rt-bar span { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--link), var(--brand)); }
.rt-pct { font-size: 11.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
.region-tile.is-empty { color: var(--muted); }
.region-tile.is-empty .rt-bar { opacity: .5; }
@media (max-width: 640px) {
  .region-grid { grid-template-columns: 1fr 1fr; }
  .region-tile { padding: 9px 10px; }
}
@media (max-width: 400px) {
  .region-grid { grid-template-columns: 1fr; }
}
.rank-row { display: grid; grid-template-columns: 16px minmax(0, 1fr); gap: 10px; align-items: start; }
.rank-row .rk { color: var(--muted); font-size: 11.5px; line-height: 1.5; text-align: right; font-variant-numeric: tabular-nums; }
.rank-row .rn { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.rank-row .vals { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; font-size: 13.5px; }
.rank-row .vals b { font-weight: 500; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-row .vals .rv { color: var(--ink); font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; flex: none; }
.rank-row .vals .rp { color: var(--muted); font-weight: 400; font-size: 11.5px; }
.rk-bar { height: 6px; border-radius: 999px; background: var(--track); overflow: hidden; }
.rk-bar span { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--link), var(--brand)); }

/* gender donut + legend */
.donut-wrap { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; flex: 1 1 auto; }
.donut {
  width: 132px; height: 132px; border-radius: 50%; flex: none;
  display: grid; place-items: center; position: relative;
}
.donut::after { content: ""; position: absolute; inset: 15px; border-radius: 50%; background: var(--card); }
.donut .d-center { position: relative; z-index: 1; text-align: center; line-height: 1.2; }
.donut .d-center b { display: block; font-size: 23px; font-variant-numeric: tabular-nums; }
.donut .d-center span { font-size: 11px; color: var(--muted); }
.legend { display: flex; flex-direction: column; gap: 9px; font-size: 13px; flex: 0 1 180px; min-width: 150px; }
.legend .lg { display: grid; grid-template-columns: 9px 1fr auto auto; gap: 8px; align-items: center; }
.legend .dot { width: 9px; height: 9px; border-radius: 50%; }
.legend .dot.m { background: var(--male); }
.legend .dot.f { background: var(--female); }
.legend .lg b { font-variant-numeric: tabular-nums; }
.legend .lg-pct { color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; min-width: 38px; text-align: right; }
.dash-note { display: flex; align-items: center; gap: 10px; margin-top: auto; padding-top: 12px; border-top: 1px solid var(--line); font-size: 13px; }
.dash-note > div { min-width: 0; }
.dash-note .ico { width: 32px; height: 32px; border-radius: var(--radius-sm); flex: none; display: inline-flex; align-items: center; justify-content: center; background: var(--chip-purple-bg); color: var(--chip-purple-ink); }
.dash-note .ico svg { width: 16px; height: 16px; }

/* age-group distribution */
.age-list { display: flex; flex-direction: column; gap: 12px; }
.age-row .a-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; font-size: 13.5px; margin-bottom: 5px; }
.age-row .a-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.age-row .a-rng { color: var(--muted); font-size: 12px; }
.age-row .a-val { font-weight: 600; font-variant-numeric: tabular-nums; flex: none; }
.age-row .a-bar { display: flex; height: 8px; border-radius: 999px; overflow: hidden; background: var(--track); }
.age-row .a-bar .m { background: var(--male); height: 100%; }
.age-row .a-bar .f { background: var(--female); height: 100%; }
.age-row .a-sub { display: flex; gap: 10px; margin-top: 4px; font-size: 11.5px; font-variant-numeric: tabular-nums; }
/* Age group rows double as a drill-down into the member list. */
.age-row-link {
  display: block; color: inherit; text-decoration: none; padding: 5px 7px; margin: -5px -7px;
  border-radius: var(--radius-sm);
}
@media (prefers-reduced-motion: no-preference) {
  .age-row-link { transition: background .15s ease; }
}
.age-row-link:hover { background: var(--chip-bg); }
.age-row-link:hover .a-name { color: var(--link); }
.age-row-link:focus-visible { outline: 2px solid var(--brand); outline-offset: 1px; }

/* recent members list */
.recent-list { list-style: none; margin: 0; padding: 0; }
.recent-list li { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--line); }
.recent-list li:last-child { border-bottom: 0; padding-bottom: 0; }
.recent-list .avatar {
  width: 32px; height: 32px; border-radius: 50%; flex: none; overflow: hidden;
  display: grid; place-items: center; font-size: 13px; font-weight: 700;
  background: var(--chip-brand-bg); color: var(--link);
}
.recent-list .avatar img, .hh-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.recent-list .rn {
  min-width: 0; display: flex; flex-direction: column; line-height: 1.6;
}
.recent-list .rn a, .recent-list .rn > span:first-child {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  /* Myanmar stacked marks need a taller line box than Latin text or they clip. */
  line-height: 2.2;
}

@media (max-width: 900px) {
  .dash-cols { grid-template-columns: 1fr; }
  .donut-wrap { justify-content: center; }
}
@media (max-width: 640px) {
  .dash-members { display: none; }
}
@media (max-width: 760px) {
  .dash-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 560px) {
  .kpi .k-num { font-size: 26px; }
  .donut { width: 116px; height: 116px; }
  .donut .d-center b { font-size: 20px; }
}
/* ---------- phones/tablets: whole nav visible, no sideways scrolling ---------- */
@media (max-width: 1180px) {
  /* The nav gets its own full-width row (see above); let it wrap instead of
     scrolling so the Administration dropdown is never pushed out of view. */
  .topbar nav {
    flex-wrap: wrap; overflow: visible; padding-right: 0; gap: 2px;
    -webkit-mask-image: none; mask-image: none;
  }
  .topbar nav a { padding: 5px 8px; }
}
@media (max-width: 640px) {
  .nav-admin .nav-menu { min-width: 180px; }
  /* Phone nav: keep the five primary links on one row and put the admin group
     on its own clearly-labelled row below them. */
  .topbar nav { column-gap: 1px; }
  .topbar nav a { padding: 5px 6px; font-size: 13px; line-height: 1.6; }
  /* Logo only: the language switch now has three options, so the brand text
     would push the controls past the viewport on a phone. */
  .topbar .brand-name { display: none; }
  .topbar .brand img { width: 30px; height: 30px; }
  .topbar .who { gap: 6px; margin-left: auto; }
  .topbar .langswitch { font-size: 12px; }
  .topbar .langswitch a { padding: 2px 6px; min-height: 28px; }
}
/* ---------- household member picker: search existing members ---------- */
.hh-pick-search-wrap { position: relative; }
.hh-pick-search { display: flex; gap: 8px; align-items: flex-end; }
.hh-pick-search label.field { flex: 1 1 auto; min-width: 0; margin: 0; }
.hh-pick-search .btn { flex: none; }
.hh-live-results {
  position: absolute; left: 0; right: 0; top: calc(100% + 6px); z-index: 50;
  max-height: min(62vh, 440px); overflow-y: auto; overscroll-behavior: contain;
  padding: 6px; background: var(--card); border: 1px solid var(--line-strong);
  border-radius: var(--radius); box-shadow: 0 18px 40px rgba(2, 8, 23, .2);
}
.hh-live-msg { margin: 8px 6px; }
.hh-live-results .hh-pick { margin-bottom: 8px; }
.hh-live-results .hh-pick:last-child { margin-bottom: 0; }
.hh-live-results .hh-empty.card {
  margin: 0; padding: 18px 10px; border: 0; background: transparent; box-shadow: none;
}
.hh-pick {
  display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: center;
  justify-content: space-between; padding: 12px 14px; margin-bottom: 10px;
  border: 1px solid var(--line); border-radius: var(--radius); background: var(--card);
}
.hh-pick-main { flex: 1 1 230px; min-width: 0; }
.hh-pick.is-active {
  border-color: var(--brand);
  box-shadow: 0 0 0 2px var(--chip-brand-bg);
}
.hh-pick-name { font-weight: 600; }
.hh-pick-meta { color: var(--muted); font-size: 12.5px; line-height: 1.5; }
.hh-pick-actions { display: flex; gap: 8px; align-items: center; margin: 0; }
.hh-pick-actions select { min-width: 132px; }
@media (max-width: 640px) {
  .hh-pick-search { flex-wrap: wrap; }
  .hh-pick-search .btn { width: 100%; }
  .hh-pick-actions { width: 100%; }
  .hh-pick-actions select { flex: 1; min-width: 0; }
}

/* ---------- households: responsive cards, detail panels, member roster ---------- */
.back-link { display: inline-block; margin: 0 0 2px; color: var(--muted); font-size: 13px; text-decoration: none; }
.back-link:hover { color: var(--link); text-decoration: underline; }
.hh-list-actions { gap: 8px; }
.hh-view-toggle {
  display: inline-flex; gap: 2px; padding: 3px;
  background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-sm);
}
.hh-view-toggle button {
  display: inline-flex; align-items: center; gap: 5px; min-height: 30px;
  padding: 4px 9px; border: 0; border-radius: var(--radius-xs);
  background: transparent; color: var(--muted);
  font: inherit; font-size: 12.5px; font-weight: 600; white-space: nowrap; cursor: pointer;
}
.hh-view-toggle button:hover { color: var(--ink); background: var(--btn2-hover); }
.hh-view-toggle button[aria-pressed="true"] { color: var(--link); background: var(--chip-brand-bg); }
.hh-view-toggle svg { width: 14px; height: 14px; flex: none; }
.hh-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; margin-bottom: 18px; }
/* List view reuses the card markup: a wide row with identity, facts and actions.
   The preference is stored by app.js, so no server round-trip is needed. */
.hh-grid.is-list { grid-template-columns: 1fr; gap: 9px; }
.hh-grid.is-list .hh-card {
  display: grid; grid-template-columns: minmax(170px, 1.15fr) minmax(0, 2.2fr) auto;
  align-items: center; gap: 10px 16px; padding: 10px 12px;
}
.hh-grid.is-list .hh-card-head { gap: 9px; }
.hh-grid.is-list .hh-avatar { width: 32px; height: 32px; border-radius: var(--radius-sm); }
.hh-grid.is-list .hh-avatar svg { width: 17px; height: 17px; }
.hh-grid.is-list .hh-card-title a { font-size: 14.5px; }
.hh-grid.is-list .hh-facts { grid-template-columns: repeat(auto-fit, minmax(88px, 1fr)); gap: 6px 12px; }
.hh-grid.is-list .hh-fact-label { font-size: 10.5px; }
.hh-grid.is-list .hh-fact-value {
  font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.hh-grid.is-list .hh-card-actions { margin: 0; padding: 0; flex-wrap: nowrap; justify-content: flex-end; gap: 6px; }
.hh-grid.is-list .hh-card-actions .btn { flex: 0 0 auto; }
.hh-grid.is-list .hh-card-actions form { flex: 0 0 auto; }
.hh-grid.is-list .hh-card-actions form .btn { width: auto; }
@media (max-width: 1180px) {
  .hh-grid.is-list .hh-card { grid-template-columns: minmax(0, 1fr) auto; }
  .hh-grid.is-list .hh-card-head { grid-column: 1; }
  .hh-grid.is-list .hh-card-actions { grid-column: 2; grid-row: 1; align-self: center; }
  .hh-grid.is-list .hh-facts {
    grid-column: 1 / -1; padding-top: 8px; border-top: 1px dashed var(--line);
  }
}
.hh-card {
  display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 15px 16px;
  background: var(--card); border: 1px solid var(--line); border-radius: var(--radius);
  transition: border-color .15s ease, box-shadow .15s ease;
}
.hh-card:hover { border-color: var(--line-strong); box-shadow: var(--hover-shadow); }
.hh-card-head { display: flex; align-items: center; gap: 10px; min-width: 0; }
.hh-avatar {
  width: 38px; height: 38px; border-radius: var(--radius); flex: none; overflow: hidden;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--chip-brand-bg); color: var(--link); font-weight: 700;
}
.hh-avatar svg { width: 20px; height: 20px; display: block; }
.hh-avatar img { width: 100%; height: 100%; object-fit: cover; }
.hh-card-name {
  display: block; color: var(--ink); font-size: 16px; font-weight: 600;
  line-height: 1.45; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.hh-avatar.sm { width: 32px; height: 32px; border-radius: 50%; font-size: 13px; }
.hh-avatar.lg { width: 52px; height: 52px; border-radius: var(--radius-lg); margin: 0 auto 10px; }
.hh-card-title { flex: 1; min-width: 0; }
.hh-card-title a {
  display: block; color: var(--ink); font-size: 16px; font-weight: 600;
  line-height: 1.45; text-decoration: none;
  /* Household names stay on one line; very long ones end in an ellipsis and
     the full name is in the link's title attribute. */
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.hh-card-title a:hover { color: var(--link); text-decoration: underline; }
.hh-card-meta { display: flex; align-items: center; gap: 8px; margin-top: 2px; min-width: 0; }
.hh-card-meta .muted { line-height: 1.4; }
.hh-count {
  flex: none; display: inline-flex; align-items: baseline; gap: 3px;
  padding: 2px 9px; border-radius: 999px; background: var(--chip-bg);
  color: var(--ink); font-size: 11.5px; white-space: nowrap;
}
.hh-count b { font-size: 13.5px; font-variant-numeric: tabular-nums; }
.hh-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px 14px; }
.hh-fact { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.hh-fact.wide { grid-column: 1 / -1; }
.hh-fact-label { color: var(--muted); font-size: 11.5px; line-height: 1.4; }
.hh-fact-value { font-size: 13.5px; line-height: 1.5; overflow-wrap: anywhere; }
.hh-fact-value a { color: var(--link); text-decoration: none; }
.hh-fact-value a:hover { text-decoration: underline; }
.hh-card-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: auto; padding-top: 2px; }
.hh-card-actions .btn { flex: 1 1 auto; min-width: 0; text-align: center; }
.hh-card-actions form { display: flex; flex: 1 1 auto; min-width: 0; margin: 0; }
.hh-card-actions form .btn { width: 100%; }
.cluster-card-v2 .cluster-cell-strip,
.regional-card-v2 .regional-attached {
  border-top: 1px dashed var(--line); background: transparent;
  padding: 9px 0 0;
}
.cluster-card-v2 .cluster-empty-line,
.regional-card-v2 .regional-attached-empty { margin: 0; padding: 1px 0 0; border-top: 0; }
.cluster-card-v2.is-inactive,
.regional-card-v2.is-inactive,
.pastor-card-v2.is-inactive { opacity: .72; }
.hh-grid.is-list .cluster-card-v2 .hh-card-actions,
.hh-grid.is-list .regional-card-v2 .hh-card-actions,
.hh-grid.is-list .pastor-card-v2 .hh-card-actions {
  grid-column: 3; grid-row: 1; align-self: center; justify-content: flex-end;
  margin: 0; padding: 0;
}
.hh-grid.is-list .cluster-card-v2 .cluster-cell-strip,
.hh-grid.is-list .regional-card-v2 .regional-attached { grid-column: 1 / -1; }
@media (max-width: 1180px) {
  .hh-grid.is-list .cluster-card-v2 .hh-card-actions,
  .hh-grid.is-list .regional-card-v2 .hh-card-actions,
  .hh-grid.is-list .pastor-card-v2 .hh-card-actions { grid-column: 2; grid-row: 1; }
}
.hh-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 2px; padding: 34px 20px; margin-bottom: 18px; text-align: center;
}
.hh-empty h2 { margin: 0 0 4px; }
.hh-empty-sm { padding: 22px 16px; }
.hh-empty-sm .hh-avatar { display: none; }
.hh-detail-grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 16px; }
.hh-detail-grid .card { height: 100%; margin-bottom: 0; }
.hh-panel h2 { margin-bottom: 12px; }
.hh-members-panel { margin-top: 16px; }
.section-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.section-head h2 { display: flex; align-items: center; gap: 7px; margin: 0; }
.hh-member-list { display: flex; flex-direction: column; gap: 8px; }
.hh-member {
  display: flex; align-items: center; gap: 10px; min-width: 0;
  padding: 9px 11px; border: 1px solid var(--line); border-radius: var(--radius);
  background: var(--card);
}
.hh-member-main { flex: 1 1 140px; min-width: 0; }
.hh-member-main a { color: var(--ink); font-weight: 600; text-decoration: none; overflow-wrap: anywhere; }
.hh-member-main a:hover { color: var(--link); text-decoration: underline; }
.hh-member-main .small { line-height: 1.5; }
.hh-rel {
  flex: none; padding: 2px 9px; border-radius: 999px;
  background: var(--chip-bg); color: var(--ink); font-size: 12px; white-space: nowrap;
}
.hh-member-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.hh-member-actions form { margin: 0; }
@media (max-width: 760px) {
  .hh-grid { grid-template-columns: 1fr; }
  .hh-detail-grid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .hh-card { padding: 14px; }
  .hh-facts { gap: 8px 12px; }
  .hh-list-actions { justify-content: space-between; }
  .hh-view-toggle button { min-height: 34px; }
  .hh-grid.is-list .hh-card { padding: 12px; }
  .hh-grid.is-list .hh-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .page-head .actions.hh-page-actions { width: auto; }
  .hh-page-actions .btn { flex: 0 0 auto; min-height: 34px; padding: 5px 14px; }
  .hh-member { flex-wrap: wrap; }
  .hh-member-actions { width: 100%; margin-left: 0; }
  .hh-member-actions .btn { flex: 1; }
}
/* ---------- organization structure ---------- */
.org-stats { margin: 0 0 18px; }
.org-church { display: grid; gap: 14px; }
.org-state { padding: 18px 20px; }
.org-state-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.org-state-head h2 { margin: 0 0 2px; }
.org-state-head p { margin: 0 0 12px; }
/* Home Cells group State/Region → Church → Township. */
.org-church-block { margin-top: var(--space-3); }
.org-church-block-head {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 10px; padding: 6px 0;
}
.org-church-block-head h3 { margin: 0; font-size: 14px; color: var(--ink); }
.org-township { border-top: 1px solid var(--line); }
.org-township > summary {
  display: flex; align-items: center; gap: 10px; min-height: 46px;
  cursor: pointer; list-style: none; font-weight: 600;
}
.org-township > summary::-webkit-details-marker { display: none; }
.org-township > summary .chev { margin-left: auto; color: var(--muted); }
.org-township-name { font-size: 14px; }
.org-cell-list { display: grid; gap: 2px; padding: 0 0 12px; }
.org-cell-row {
  display: grid; grid-template-columns: minmax(150px, 1.3fr) minmax(120px, 1fr) auto;
  align-items: center; gap: 10px 14px; padding: 9px 10px;
  border-radius: var(--radius-sm); background: var(--row-alt, rgba(15,23,42,.025));
}
.org-cell-name { display: flex; align-items: center; gap: 7px; min-width: 0; }
.org-cell-name a { color: var(--link); font-weight: 600; text-decoration: none; overflow-wrap: anywhere; }
.org-cell-name a:hover { text-decoration: underline; }
.org-code {
  flex: none; padding: 1px 7px; border-radius: 999px; background: var(--chip-bg);
  color: var(--muted); font-size: 11px; white-space: nowrap;
}
.org-cell-leader { display: flex; align-items: center; gap: 7px; min-width: 0; font-size: 13px; }
.org-role-label { flex: none; color: var(--muted); font-size: 11.5px; }
.org-cell-count { color: var(--muted); font-size: 12.5px; white-space: nowrap; text-decoration: none; }
.org-cell-count:hover { color: var(--link); text-decoration: underline; }
.org-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
.org-card { display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 16px; }
.org-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.org-card-head h3 { margin: 0 0 2px; font-size: 16px; line-height: 1.4; }
.org-card-head h3 a { color: var(--ink); text-decoration: none; }
.org-card-head h3 a:hover { color: var(--link); text-decoration: underline; }
.org-card-head p { margin: 0; }
.org-roles { display: grid; gap: 6px; margin: 0; }
.org-roles > div { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.org-roles dt { color: var(--muted); font-size: 12px; }
.org-roles dd { margin: 0; text-align: right; font-size: 13.5px; font-weight: 600; overflow-wrap: anywhere; }
.org-roles .org-vacant dd { color: var(--muted); font-weight: 400; }
.org-card-foot {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  margin-top: auto; padding-top: 10px; border-top: 1px dashed var(--line);
}
.org-empty { text-align: center; padding: 34px 20px; }
.org-empty h2 { margin-top: 0; }
.org-empty-small { padding: 20px; }
.org-section-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 12px; flex-wrap: wrap; margin-bottom: 14px;
}
.org-section-head h2 { margin: 0 0 2px; }
.org-section-head p { margin: 0; }
.org-leadership { margin-bottom: 18px; padding: 18px 20px; }
.org-lead-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;
}
.org-lead {
  display: flex; flex-direction: column; gap: 3px; padding: 10px 12px;
  border: 1px solid var(--line); border-radius: var(--radius); background: var(--row-alt, rgba(15,23,42,.025));
}
.org-lead a { color: var(--ink); font-weight: 600; text-decoration: none; overflow-wrap: anywhere; }
.org-lead a:hover { color: var(--link); text-decoration: underline; }
.org-lead-role { color: var(--muted); font-size: 11.5px; }
.org-lead.org-vacant { border-style: dashed; }
.org-departments { margin: 0 0 18px; }
.org-dept-grid { margin-top: 0; }
.org-section-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.org-structure-bar {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  margin: -4px 0 16px; padding: 8px 10px; border: 1px dashed var(--line);
  border-radius: var(--radius); background: var(--row-alt, rgba(15,23,42,.025));
}
.org-structure-bar .org-manage-links { display: flex; flex-wrap: wrap; gap: 8px; }
.org-card-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: auto; padding-top: 8px; }
.org-card-actions .org-card-link { margin-top: 0; padding-top: 0; }
.org-collapse { border: 1px solid var(--line); border-radius: var(--radius); background: var(--card); overflow: hidden; }
.org-collapse-summary {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  min-height: 44px; padding: 10px 14px; cursor: pointer; list-style: none;
  font-size: 13px; font-weight: 600; color: var(--muted);
}
.org-collapse-summary::-webkit-details-marker { display: none; }
.org-collapse-summary .chev { font-size: 12px; transition: transform .15s ease; }
.org-collapse[open] > .org-collapse-summary .chev { transform: rotate(180deg); }
.org-collapse-body { padding: 0 14px 14px; }
.org-collapse-hint { font-weight: 400; }
.org-main-church .org-chart-level { margin-top: 6px; }
.org-main-church .org-collapse { margin-top: 16px; }
.org-main-cells .org-collapse-body { padding-bottom: 4px; }
.org-main-township + .org-main-township { margin-top: 8px; }
.org-region-groups { display: grid; gap: 16px; }
.org-region-group-head {
  display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  margin: 0 0 10px; padding-bottom: 8px; border-bottom: 1px solid var(--line);
}
.org-region-group-head h3 { margin: 0; font-size: 16px; }
.org-dept-card { gap: 10px; }
.org-dept-card .org-card-head h3 { margin: 0; }
/* Position assignment modal: a compact identity summary followed by three
   clearly numbered role areas. */
.position-hero {
  display: flex; align-items: flex-start; gap: 11px; margin-bottom: 10px;
  padding: 12px 13px; border: 1px solid var(--line); border-radius: var(--radius);
  background: linear-gradient(135deg, var(--chip-brand-bg), transparent 78%);
}
.position-avatar {
  width: 38px; height: 38px; flex: none; display: grid; place-items: center;
  border-radius: 50%; background: var(--card); color: var(--link);
  font-size: 16px; font-weight: 700; box-shadow: inset 0 0 0 1px var(--line);
}
.position-hero-main { flex: 1; min-width: 0; }
.position-hero-title { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
.position-hero-title h4 { margin: 0; font-size: 15px; line-height: 1.4; overflow-wrap: anywhere; }
.position-hero-home { color: var(--muted); font-size: 12px; }
.position-hero-home strong { color: var(--ink); font-weight: 600; }
.position-hero-profile { color: var(--link); font-size: 12px; font-weight: 600; text-decoration: none; }
.position-hero-profile:hover { text-decoration: underline; }
.position-hero-link {
  display: inline-flex; align-items: center; gap: 4px; margin-top: 4px;
  color: var(--link); font-size: 12px; font-weight: 600; text-decoration: none;
}
.position-hero-link:hover { text-decoration: underline; }
.position-role-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
.position-role-chips .badge { font-size: 11.5px; }
.position-intro { margin: 0 0 12px; }
.position-section {
  margin: 0 0 11px; padding: 12px 13px;
  border: 1px solid var(--line); border-radius: var(--radius); background: var(--field-bg);
}
.position-section-head { display: flex; align-items: flex-start; gap: 9px; margin-bottom: 10px; }
.position-step {
  width: 22px; height: 22px; flex: none; display: grid; place-items: center;
  border-radius: 50%; background: var(--chip-brand-bg); color: var(--link);
  font-size: 11.5px; font-weight: 700; line-height: 1;
}
.position-section h3 { margin: 1px 0 0; font-size: 14px; }
.position-section-head .hint { margin: 2px 0 0; }
.position-section .field { margin-bottom: 0; }
.position-section .form-grid { margin-top: 0; }
.position-section select:disabled { opacity: .55; cursor: not-allowed; }
.position-notice {
  padding: 9px 11px; border-radius: var(--radius-sm);
  background: var(--warn-bg); color: var(--warn-ink); font-size: 12.5px; line-height: 1.6;
}
.position-notice p { margin: 0 0 8px; }
.position-notice .btn { background: var(--card); color: var(--ink); border: 1px solid var(--line); }
.position-scope { margin: 0 0 10px; font-size: 12.5px; color: var(--muted); }
.position-scope strong { color: var(--ink); }

/* Tabbed assignment form: one swipeable row on phones, wrapping on desktop. */
.position-tabs {
  display: flex; gap: 4px; margin: 0 0 12px; padding: 4px;
  border: 1px solid var(--line); border-radius: var(--radius); background: var(--field-bg);
  overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none;
}
.position-tabs::-webkit-scrollbar { display: none; }
.position-tab {
  flex: 1 1 auto; min-width: max-content; padding: 8px 10px;
  border: 0; border-radius: var(--radius-sm); background: transparent;
  color: var(--muted); font: inherit; font-size: 12.5px; font-weight: 600;
  white-space: nowrap; cursor: pointer;
}
.position-tab:hover { color: var(--ink); background: var(--chip-bg); }
.position-tab.active { background: var(--card); color: var(--link); box-shadow: 0 1px 3px rgba(2, 8, 23, .12); }
.position-tab:focus-visible { outline: 2px solid var(--link); outline-offset: 1px; }
.position-panes [data-tab-pane][hidden] { display: none; }
@media (min-width: 720px) { .position-tab { flex: 1 1 0; } }
/* Settings editors use the same tab bar at the top of a modal sheet. */
.modal-form-tabs { margin: 0 0 16px; }
.modal-form-panes { min-width: 0; }
.modal-form-pane[hidden] { display: none; }
.modal-form-pane .cluster-section-head { margin-bottom: 10px; }
.modal-form-pane .cluster-cell-groups { margin-top: 0; }
.pastor-picker { margin-top: 0; }
.pastor-picker [data-search-input] { background: var(--card); }

/* ---------- organization settings (positions / regional churches) ---------- */
.page-head-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.org-manage-links { display: flex; flex-wrap: wrap; gap: 8px; }
.org-settings-add { padding: 16px 18px; }
.org-settings-add h2 { margin: 0 0 2px; }
.org-settings-add form { margin-top: 12px; }
.org-settings-list { display: grid; gap: 14px; }
.org-settings-row { padding: 16px 18px; }
.org-settings-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.org-settings-head h3 { margin: 0 0 2px; font-size: 16px; overflow-wrap: anywhere; }
.org-settings-head p { margin: 0; }
.org-settings-row form + form { margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--line); }
.org-settings-row .actions { margin-top: 12px; }
.regional-cells-form .regional-cells-head { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; margin-bottom: 8px; }
.check-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.check-chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px;
  border: 1px solid var(--line); border-radius: 999px; background: var(--card);
  font-size: 12.5px; cursor: pointer;
}
.check-chip:has(input:checked) { border-color: var(--link); background: var(--chip-brand-bg); color: var(--link); }
.check-chip input { width: auto; margin: 0; }
/* A Home Cell that still belongs to a sibling church: naming the church makes
   the move obvious before the sheet is saved. */
.check-chip-owner { display: block; color: var(--muted); font-size: 10.5px; font-style: italic; line-height: 1.35; }
/* Administration option lists (Home Cell, Home Cell supervision) as cards. */
.opt-card-v2.is-inactive { opacity: .72; }
.opt-card-v2 .hh-card-actions .btn { min-height: 32px; }
.opt-card-v2 .hh-card-actions form .btn { min-height: 32px; }

/* ---------- position + regional settings screens ---------- */
.tab-count { margin-left: 6px; font-size: 11.5px; opacity: .75; }
.role-list, .regional-list { display: grid; gap: 12px; }
.role-card, .regional-card { padding: 16px 18px; }
.role-card.is-inactive, .regional-card.is-inactive { opacity: .72; }
.role-card-head, .regional-card-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;
}
.role-card-text h3 { margin: 0 0 3px; font-size: 16px; overflow-wrap: anywhere; }
.role-card-meta {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px;
  margin: 0; font-size: 12.5px; color: var(--muted);
}
.role-card-meta code { font-size: 12px; }
.regional-card-head h3 { margin: 0 0 3px; font-size: 17px; overflow-wrap: anywhere; }
.regional-card-head p { margin: 0; }

.role-card-actions { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.role-card-actions .btn { white-space: nowrap; }

/* Modal sheets for the settings screens: body copy between forms, a quiet
   danger section that is not a sticky action bar, and inline error text. */
.modal-note { margin: 2px 0 0; }
.modal-confirm { margin-top: 4px; padding-top: 14px; border-top: 1px dashed var(--line); }
.modal-error {
  margin: 0 0 12px; padding: 10px 12px; border-radius: var(--radius-sm);
  background: var(--err-bg, #fdecec); color: var(--err-ink); font-size: 13px;
}
.modal-body .regional-cells-form {
  padding-top: 14px; border-top: 1px dashed var(--line);
}
.modal-body .regional-cells-form .regional-cells-head { margin-bottom: 4px; }
.modal-body form.modal-danger {
  flex: 0 0 auto; margin-top: 4px; padding-top: 14px;
  border-top: 1px dashed var(--line);
}
/* The delete form can be present only as a submit target for the footer
   button; the modal form display rule must not reveal its empty border. */
.modal-body form[hidden] { display: none; }
.modal-body form.modal-danger > .actions {
  position: static; margin: 0; padding: 0; border: 0; background: none;
  justify-content: flex-start;
}

.role-card-text { min-width: 0; }
.role-card-actions { flex-wrap: nowrap; }

.settings-filters { margin-top: 12px; }
.settings-filters input[type="search"] { flex: 1 1 240px; min-width: 0; max-width: 360px; }
.settings-filters select { flex: 0 1 180px; }
.settings-filters .actions { margin-left: 0; }
.settings-filters .btn { min-height: 40px; }
/* Church switcher: the selected church, its state and leadership progress live
   in one compact strip above the chart. Selecting a church applies immediately. */
.org-church-switcher {
  display: flex; flex-wrap: wrap; align-items: center; gap: 12px 18px;
  margin: 0 0 18px; padding: 12px 14px;
  border: 1px solid var(--hairline); border-radius: var(--radius);
  background: var(--surface-3);
}
.org-church-switcher form { margin: 0; flex: 0 1 340px; min-width: 220px; }
.org-church-control { display: block; min-width: 0; }
.org-church-kicker {
  display: block; margin: 0 0 4px; color: var(--muted);
  font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
}
.org-church-control select {
  height: 44px; font-size: 15px; font-weight: 600; background: var(--field-bg);
}
.org-church-facts { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-left: auto; }
.org-church-fact {
  display: inline-flex; align-items: baseline; gap: 4px;
  padding: 5px 10px; border-radius: 999px; border: 1px solid var(--line);
  background: var(--card); color: var(--muted); font-size: 12.5px; white-space: nowrap;
}
.org-church-fact b { color: var(--ink); font-size: 13px; font-variant-numeric: tabular-nums; }
.org-church-state { border-color: transparent; background: var(--chip-brand-bg); color: var(--link); font-weight: 600; }
@media (max-width: 640px) {
  .org-church-switcher form { flex-basis: 100%; }
  .org-church-facts { margin-left: 0; }
}
/* Position rows are short records; keep the list dense and easy to scan. */
.role-list { gap: 8px; }
/* Positions: card view tiles the roles, list view keeps one dense row. Both
   render the same markup; app.js only flips the is-list class. */
.role-list[data-view-grid] { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
.role-list .role-card {
  display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 16px 18px;
}
.role-list .role-card-head { display: block; }
.role-card-title { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.role-list .role-card-text h3 { margin: 0; font-size: 16px; line-height: 1.3; }
.role-list .role-card-meta { margin: 8px 0 0; gap: 6px; }
.role-list .role-card-meta code {
  padding: 2px 8px; border-radius: 999px; background: var(--field-bg);
  color: var(--ink); font-size: 11.5px;
}
.role-chip {
  padding: 2px 8px; border-radius: 999px; border: 1px solid var(--line);
  color: var(--muted); font-size: 11.5px; font-variant-numeric: tabular-nums;
}
.role-chip.church {
  border-color: transparent; background: var(--chip-brand-bg);
  color: var(--link); font-weight: 600;
}
/* The action row sits on the card floor, so tiles of different heights still
   read as one grid instead of leaving their button floating mid-card. */
.role-list .role-card-actions {
  margin-top: auto; padding-top: 12px; border-top: 1px solid var(--hairline);
  justify-content: flex-end; flex-wrap: nowrap;
}
.role-list .role-card-actions .btn { flex: 0 0 auto; }
/* List view: identity and chips share one line, actions stay on the right. */
.role-list.is-list { grid-template-columns: 1fr; gap: 8px; }
.role-list.is-list .role-card { flex-direction: row; align-items: center; gap: 12px; padding: 10px 14px; }
.role-list.is-list .role-card-head { flex: 1 1 auto; display: block; }
.role-list.is-list .role-card-text { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; }
.role-list.is-list .role-card-title { gap: 8px; }
.role-list.is-list .role-card-text h3 { font-size: 15px; }
.role-list.is-list .role-card-meta { margin: 0; }
.role-list.is-list .role-card-actions { margin: 0; padding: 0; border: 0; flex: 0 0 auto; }
/* Header actions read as one row: same height for every control, the view
   switch as one segmented pill, and the primary action left to stand out. */
.page-head-actions { gap: 8px; }
.page-head-actions .btn { min-height: 36px; padding: 7px 14px; font-size: 13.5px; }
.page-head-actions .btn.js-add-modal:not(.secondary) { font-weight: 600; }
.page-head-actions .hh-view-toggle { flex: none; padding: 2px; }
.page-head-actions .hh-view-toggle button { min-height: 32px; padding: 4px 10px; }
@media (max-width: 640px) {
  .role-list.is-list .role-card { flex-direction: column; align-items: stretch; gap: 10px; }
}
.role-card { padding: 12px 16px; transition: border-color .12s ease, box-shadow .12s ease; }
.role-card:hover { border-color: var(--line-strong); box-shadow: 0 3px 10px rgba(2, 8, 23, .06); }
.role-card-head { align-items: center; }
.role-card-text h3 { font-size: 15.5px; }
.role-card-meta code {
  padding: 1px 6px; border-radius: var(--radius-xs);
  background: var(--field-bg); color: var(--ink);
}

@media (max-width: 640px) {
  .role-card, .regional-card { padding: 14px 16px; }
  .role-card-actions .btn { min-height: 36px; padding: 5px 12px; }
  .settings-filters {
    display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center;
    gap: 8px; margin-top: 10px;
  }
  .settings-filters input[type="search"] { grid-column: 1 / -1; width: 100%; max-width: none; }
  .settings-filters select { width: 100%; }
  .settings-filters .actions { margin: 0; }
  .settings-filters .actions .btn { width: 100%; }
}

.regional-attached { display: grid; gap: 6px; margin-top: 10px; }
.regional-attached-empty { margin: 8px 0 0; }
.regional-township-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 5px 8px; font-size: 12.5px; }
.regional-township-line .town { font-weight: 600; }
.regional-cell-chip {
  display: inline-block; padding: 3px 9px; border-radius: 999px;
  background: var(--chip-bg); color: inherit; font-size: 12px; text-decoration: none;
}
.regional-cell-chip:hover { background: var(--chip-brand-bg); color: var(--link); }
.regional-cell-groups { display: grid; gap: 12px; margin-top: 4px; }
.regional-candidate-group h4 {
  margin: 0 0 6px; font-size: 11.5px; font-weight: 700; letter-spacing: .02em;
  text-transform: uppercase; color: var(--muted);
}

/* Supervision clusters use a compact row: the cluster, its pastor and the
   actions share one line, while the attached cells sit on a quiet strip below.
   This keeps a one-cluster list from turning into a mostly-empty wide card. */
.pastor-list { display: grid; gap: 10px; }
.pastor-card { padding: 0; overflow: hidden; }
.pastor-card.is-inactive { opacity: .72; }
.pastor-main {
  display: grid; grid-template-columns: auto minmax(0, 1.5fr) auto;
  align-items: center; gap: 8px 16px; padding: 13px 18px;
}
.pastor-avatar {
  display: grid; place-items: center; width: 52px; height: 52px; border-radius: 50%;
  overflow: hidden; background: var(--chip-brand-bg); color: var(--brand);
  font-size: 20px; font-weight: 700; box-shadow: 0 0 0 1px var(--line);
}
.pastor-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pastor-title { min-width: 0; }
.pastor-title h3 { margin: 0 0 2px; font-size: 16.5px; overflow-wrap: anywhere; }
.pastor-title p { margin: 0; }
.pastor-phone { display: flex; flex-direction: column; gap: 1px; min-width: 0; font-size: 13.5px; }
.pastor-actions { justify-content: flex-end; }
.cluster-list { display: grid; gap: 10px; }
.cluster-card { padding: 0; overflow: hidden; }
.cluster-card.is-inactive { opacity: .72; }
.cluster-card-main {
  display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(170px, 1fr) auto;
  gap: 8px 20px; align-items: center; padding: 13px 18px;
}
.cluster-card-title { min-width: 0; }
.cluster-card-title h3 { margin: 0 0 2px; font-size: 16.5px; overflow-wrap: anywhere; }
.cluster-card-title p { margin: 0; }
.cluster-card-pastor { display: flex; flex-direction: column; gap: 1px; min-width: 0; font-size: 13.5px; }
.cluster-kicker {
  font-size: 10.5px; font-weight: 700; letter-spacing: .06em;
  text-transform: uppercase; color: var(--muted);
}
.cluster-card-actions { justify-content: flex-end; }
.cluster-cell-strip {
  display: grid; gap: 5px; padding: 9px 18px 10px;
  border-top: 1px solid var(--line); background: var(--field-bg);
}
.cluster-township-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 7px; font-size: 12.5px; }
.cluster-township-line .town { font-weight: 600; }
.cluster-empty-line { margin: 0; padding: 9px 18px 11px; border-top: 1px solid var(--line); }

/* Cluster editor: one form and one Save. The Home Cell picker is a bounded
   grid of township columns, so a state with many cells scrolls inside its own
   panel instead of stretching the dialog. */
.modal-body .cluster-main-form > .actions:last-child {
  position: static; margin: 0; padding: 0; border: 0; background: none;
}
.modal-body .cluster-main-form { flex: 0 0 auto; gap: 12px; }
.modal-body .cluster-main-form .form-grid { gap: 10px 16px; }
.cluster-cells-section { display: grid; gap: 10px; padding-top: 10px; border-top: 1px dashed var(--line); }
.cluster-cells-section .modal-error { margin: 0; }
.cluster-section-head { display: grid; gap: 2px; }
.cluster-section-title { display: flex; align-items: center; gap: 8px; }
.cluster-section-title strong { font-size: 14px; }
.cluster-section-head p { margin: 0; }
.cluster-cell-groups {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px; max-height: 240px; overflow-y: auto; overscroll-behavior: contain;
  padding: 8px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--field-bg);
}
.cluster-cell-group {
  min-width: 0; padding: 8px 9px; border: 1px solid var(--line);
  border-radius: var(--radius-sm); background: var(--card);
}
.cluster-cell-group h4 {
  margin: 0 0 6px; font-size: 11px; font-weight: 700; letter-spacing: .03em;
  text-transform: uppercase; color: var(--muted); overflow-wrap: anywhere;
}
.cluster-cell-group .check-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 5px;
}
.cluster-cell-group .check-chip { padding: 5px 7px; border-radius: var(--radius-sm); font-size: 12px; gap: 6px; }
.cluster-modal-foot { margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--line); }
.modal-body .cluster-modal-foot form.modal-danger { margin: 0; padding: 0; border: 0; }
.modal-body .cluster-modal-foot form.modal-danger > .actions { margin: 0; padding: 0; border: 0; }

@media (max-width: 640px) {
  .pastor-main { grid-template-columns: auto minmax(0, 1fr); align-items: start; padding: 12px 14px; }
  .pastor-actions { grid-column: 1 / -1; justify-content: flex-start; }
  .pastor-phone { grid-column: 1 / -1; flex-direction: row; align-items: baseline; gap: 6px; }
  .pastor-actions { align-self: start; }
  .cluster-card-main { grid-template-columns: minmax(0, 1fr) auto; align-items: start; padding: 12px 14px; }
  .cluster-card-pastor { grid-column: 1 / -1; flex-direction: row; align-items: baseline; gap: 6px; }
  .cluster-card-actions { align-self: start; }
  .cluster-cell-strip { padding: 8px 14px 10px; }
  .cluster-empty-line { padding: 8px 14px 10px; }
  .cluster-cell-groups { grid-template-columns: 1fr; max-height: 220px; }
}

/* ---------- supervision + regional cards on the organization page ---------- */
.org-supervision { margin: 8px 0 4px; padding: 9px 11px; border-radius: var(--radius-sm); background: var(--field-bg); border: 1px dashed var(--line); }
.org-supervision-title { display: block; margin-bottom: 6px; font-size: 11.5px; font-weight: 700; letter-spacing: .02em; text-transform: uppercase; color: var(--muted); }
.org-supervision .org-mini-list { margin: 0; }
.org-card-supervision { margin-top: 10px; }
.org-cell-regional { margin: 0 0 8px; font-size: 12px; color: var(--muted); }
.org-regional-card .org-regional-cells { display: grid; gap: 4px; margin-top: 10px; }
.org-regional-cell { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; padding: 6px 0; border-top: 1px dashed var(--line); font-size: 13px; }
.org-regional-cell a { font-weight: 600; overflow-wrap: anywhere; }
.org-regional-cell-lead { grid-column: 1 / -1; font-size: 12px; color: var(--muted); }
.org-regional-empty { margin: 10px 0 0; }
.org-unassigned { margin-top: 4px; }

/* townships inside a regional church card */
.org-regional-groups { display: grid; gap: 12px; margin-top: 10px; }
.org-regional-township { padding-top: 10px; border-top: 1px dashed var(--line); }
.org-regional-township-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.org-regional-township-head .org-township-name { font-weight: 700; }
.org-regional-township .org-supervision { margin: 8px 0 6px; }
.org-regional-township .org-regional-cells { margin-top: 4px; }
.org-regional-township .org-regional-cell:first-child { border-top: 0; }

/* ---------- position change history ---------- */
.badge.warn { background: var(--warn-bg); color: var(--warn-ink); }
.history-list { display: grid; gap: 10px; }
.history-item { padding: 14px 16px; }
.history-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; font-size: 12px; color: var(--muted); }
.history-main { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; margin-top: 6px; }
.history-main strong { font-size: 15px; overflow-wrap: anywhere; }
.history-main code { font-size: 12px; }
.history-detail { margin: 6px 0 0; font-size: 13px; }
.history-changes { margin: 8px 0 0; padding: 0; list-style: none; display: grid; gap: 3px; font-size: 12.5px; }
.history-changes li { display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; }
.history-changes .org-role-label { min-width: 96px; }
.history-old { color: var(--muted); text-decoration: line-through; }

/* ---------- vacancy report ---------- */
.vacancy-progress { padding: 14px 16px; margin-bottom: 16px; }
.vacancy-progress-head { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
.vacancy-bar { height: 8px; border-radius: 999px; background: var(--field-bg); overflow: hidden; }
.vacancy-bar > span { display: block; height: 100%; background: var(--brand); border-radius: inherit; }
.vacancy-group { margin-bottom: 16px; }
.vacancy-rows { display: grid; gap: 4px; }
.vacancy-row { padding: 12px 0; border-top: 1px solid var(--line); }
.vacancy-row:first-child { border-top: 0; padding-top: 4px; }
.vacancy-row-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.vacancy-row-head h3 { margin: 0 0 2px; font-size: 15px; overflow-wrap: anywhere; }
.vacancy-row-head p { margin: 0; }
.vacancy-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.vacancy-chip { display: inline-block; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--line); background: var(--warn-bg); color: var(--warn-ink); font-size: 12px; }
.vacancy-foot { margin-top: 6px; }

.dept-add { margin-bottom: 18px; padding: 18px 20px; }
.dept-add h2 { margin: 0 0 2px; }
.dept-list { display: grid; gap: 14px; }
.dept-row { padding: 16px 18px; }
.dept-row-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.dept-row-head h3 { margin: 0 0 2px; font-size: 16px; }
.dept-row-head p { margin: 0; }
.dept-roles { display: grid; gap: 4px; margin: 10px 0; }
.dept-card-v2 .dept-roles { margin: 0; padding-top: 9px; border-top: 1px dashed var(--line); }
.dept-card-v2.is-inactive { opacity: .72; }
/* Department list view: identity, facts, roles and actions read as one row. */
.hh-grid.is-list .dept-card-v2 {
  grid-template-columns: minmax(190px, 1.1fr) minmax(0, 1.5fr) minmax(0, 1.7fr) auto;
  align-items: center;
}
.hh-grid.is-list .dept-card-v2 .hh-card-head { grid-column: 1; }
.hh-grid.is-list .dept-card-v2 .hh-facts {
  grid-column: 2; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px 14px;
}
.hh-grid.is-list .dept-card-v2 .dept-roles { grid-column: 3; padding-top: 0; border-top: 0; }
.hh-grid.is-list .dept-card-v2 .hh-card-actions {
  grid-column: 4; grid-row: 1; align-self: center; margin: 0; padding: 0; flex-wrap: nowrap;
}
@media (max-width: 1180px) {
  .hh-grid.is-list .dept-card-v2 { grid-template-columns: minmax(0, 1fr) auto; }
  .hh-grid.is-list .dept-card-v2 .hh-facts,
  .hh-grid.is-list .dept-card-v2 .dept-roles { grid-column: 1 / -1; }
  .hh-grid.is-list .dept-card-v2 .hh-card-actions { grid-column: 2; grid-row: 1; }
}
.dept-roles > div { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.dept-roles dt { color: var(--muted); font-size: 12px; }
.dept-roles dd { margin: 0; font-size: 13px; font-weight: 600; text-align: right; overflow-wrap: anywhere; }
.dept-fields { gap: 10px 14px; }
.dept-active { display: flex; align-items: center; gap: 8px; align-self: end; min-height: 38px; font-size: 13px; }
.dept-active input { width: auto; }
.dept-inactive { opacity: .75; }
.dept-row .actions { margin-top: 12px; }
/* ---------- organization chart ---------- */
.org-chart { margin-bottom: var(--card-gap); padding: var(--card-pad-y) var(--card-pad-x) var(--space-6); overflow: hidden; }
.org-chart-level { position: relative; display: flex; align-items: flex-start; justify-content: center; gap: 18px; flex-wrap: wrap; }
.org-chart-level-top { margin-top: 4px; }
.org-chart-connector { width: 2px; height: 24px; margin: 0 auto; background: var(--connector); }
.org-chart-level-team { max-width: 780px; margin: 0 auto; padding-top: 22px; }
.org-chart-level-team::before {
  content: ""; position: absolute; top: 0; left: 16%; right: 16%; height: 2px; background: var(--connector);
}
.org-chart-level-team .org-node::before {
  content: ""; position: absolute; top: -22px; left: 50%; width: 2px; height: 22px; background: var(--connector);
}

/* Home Cell hierarchy: supervisor team, then cell leaders, grouped by state
   and by cluster (or township when a cell has no cluster). */
.org-state-list { display: grid; gap: 14px; margin-bottom: 18px; }
.org-state-hierarchy { padding: 18px 20px; }
.org-supervision-group { margin-top: 14px; padding: 14px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--row-alt, rgba(15,23,42,.025)); }
.org-supervision-group + .org-supervision-group { margin-top: 12px; }
.org-supervision-group-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.org-supervision-group-head h3 { margin: 2px 0 0; font-size: 15px; }
.org-supervision-team { display: flex; flex-wrap: wrap; align-items: stretch; gap: 8px; margin-bottom: 12px; }
.org-supervision-person { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--card); }
.org-supervision-person.is-lead { flex: 1 1 210px; border-color: var(--line-strong, var(--line)); }
.org-supervision-person > div { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.org-supervision-cells { display: grid; gap: 2px; border-top: 1px dashed var(--line); padding-top: 8px; }
.org-supervision-cell { display: grid; grid-template-columns: auto minmax(140px, 1fr) minmax(160px, 1.2fr); align-items: center; gap: 8px 12px; padding: 8px 4px; }
.org-supervision-cell + .org-supervision-cell { border-top: 1px solid var(--line); }
.org-supervision-cell-main { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.org-supervision-cell-main a { color: var(--link); font-weight: 600; text-decoration: none; overflow-wrap: anywhere; }
.org-supervision-cell-main a:hover { text-decoration: underline; }
.org-supervision-cell-roles { display: flex; flex-wrap: wrap; gap: 4px 12px; justify-content: flex-end; }
/* Full leadership flow on Home Cell Structure: church-wide leaders flow down
   into state/cluster supervisor teams and their Home Cell leader nodes. */
.org-flow { padding-bottom: 18px; }
.org-flow-line { width: 2px; height: 22px; margin: 0 auto; background: var(--line); }
.org-flow-state { margin-top: 6px; }
.org-flow-state + .org-flow-state { margin-top: 20px; padding-top: 20px; border-top: 1px dashed var(--line); }
.org-flow-state-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: center; gap: 5px 12px; margin-bottom: 16px; text-align: center; }
.org-flow-state-name { padding: 5px 16px; border-radius: 999px; background: var(--chip-brand-bg); color: var(--link); font-weight: 700; font-size: 15px; }
.org-flow-clusters { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; align-items: start; }
.org-flow-cluster { min-width: 0; padding: 14px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--row-alt, rgba(15,23,42,.025)); }
.org-flow-cluster > summary { list-style: none; cursor: pointer; }
.org-flow-cluster > summary::-webkit-details-marker { display: none; }
.org-flow-cluster-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 0; }
.org-flow-cluster-head:hover .org-flow-cluster-name { color: var(--link); }
.org-flow-cluster-title { display: flex; flex-direction: column; min-width: 0; }
.org-flow-cluster-name { margin: 2px 0 0; font-size: 15px; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }
.org-flow-cluster-meta { display: flex; align-items: center; gap: 8px; flex: none; }
.org-flow-chev { color: var(--muted); font-size: 12px; line-height: 1; transition: transform .15s ease; }
.org-flow-cluster[open] .org-flow-chev { transform: rotate(180deg); }
.org-flow-cluster-body { padding-top: 6px; }
.org-flow-pastor { display: flex; justify-content: center; }
.org-flow-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.org-flow-cluster-team { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: center; gap: 4px 8px; }
.org-flow-cluster-team .org-node { width: 168px; min-width: 140px; padding: 8px 5px; }
.org-flow-cluster-team .org-node-lead { width: 190px; }
.org-flow-cells { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px; position: relative; padding-top: 14px; }
.org-flow-cells::before { content: ""; position: absolute; top: 0; left: 6%; right: 6%; height: 2px; background: var(--line); }
.org-flow-cell { position: relative; min-width: 0; display: flex; flex-direction: column; gap: 8px; padding: 11px 12px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--card); }
.org-flow-cell::before { content: ""; position: absolute; top: -14px; left: 50%; width: 2px; height: 14px; background: var(--line); }
.org-flow-cell-head { display: flex; align-items: center; gap: 9px; min-width: 0; }
.org-flow-cell-main { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.org-flow-cell-main a { color: var(--link); font-weight: 600; text-decoration: none; overflow-wrap: anywhere; }
.org-flow-cell-main a:hover { text-decoration: underline; }
.org-flow-cell-roles { display: grid; gap: 4px; padding-top: 7px; border-top: 1px dashed var(--line); }
.org-flow-role { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; font-size: 12.5px; min-width: 0; }
.org-flow-role .org-role-label { flex: none; }
.org-flow-role a { text-align: right; color: var(--ink); font-weight: 600; text-decoration: none; overflow-wrap: anywhere; }
.org-flow-role a:hover { color: var(--link); text-decoration: underline; }
@media (max-width: 760px) {
  .org-flow-clusters { grid-template-columns: 1fr; }
  .org-flow-cluster-team .org-node { width: 190px; }
  .org-flow-cluster-team .org-node-lead { width: 205px; }
}
@media (max-width: 520px) {
  .org-flow-cluster-team { display: grid; grid-template-columns: 1fr; }
  .org-flow-cluster-team .org-node,
  .org-flow-cluster-team .org-node-lead { width: 100%; flex-direction: row; justify-content: flex-start; text-align: left; gap: 10px; }
  .org-flow-cluster-team .org-node .org-node-role { order: 1; }
  .org-flow-cluster-team .org-node .org-node-name { order: 2; margin-left: auto; text-align: right; }
  .org-flow-cells { grid-template-columns: 1fr; }
  .org-flow-cells::before,
  .org-flow-cell::before { display: none; }
}
.position-subsection { margin: 0 0 12px; padding: 10px 11px; border: 1px dashed var(--line); border-radius: var(--radius-sm); background: var(--card); }
.position-subsection h4 { margin: 0 0 3px; font-size: 13px; }
.position-subsection .form-grid { margin-top: 8px; }
.org-manage-links, .page-head-actions { align-items: stretch; }
.org-manage-links .btn, .page-head-actions .btn { min-height: 34px; display: inline-flex; align-items: center; justify-content: center; }
.org-page-head { align-items: flex-start; }
.org-page-head .page-head-actions { flex: 1 1 100%; width: 100%; justify-content: flex-start; gap: 6px; flex-wrap: nowrap; }
.org-page-head .org-manage-links { flex: 0 0 auto; flex-wrap: nowrap; gap: 6px; }
.org-page-head .page-head-actions .btn { padding: 6px 9px; font-size: 12.5px; }
@media (max-width: 700px) {
  .org-page-head .page-head-actions, .org-page-head .org-manage-links { flex-wrap: wrap; }
}
@media (max-width: 640px) {
  .org-supervision-cell { grid-template-columns: auto minmax(0, 1fr); }
  .org-supervision-cell-roles { grid-column: 1 / -1; justify-content: flex-start; }
  .org-supervision-team { display: grid; grid-template-columns: 1fr; }
}

.org-node {
  position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px;
  width: 208px; min-width: 160px; padding: 16px 14px 14px; text-align: center;
  background: var(--card); border: 1px solid var(--hairline);
  border-radius: calc(var(--radius) + 4px);
  box-shadow: 0 0 0 1px var(--node-ring), var(--elev-1);
}
.org-node-lead {
  width: 248px;
  box-shadow: inset 0 3px 0 var(--brand), 0 0 0 1px var(--node-ring), var(--elev-1);
}
/* Vacant slots read as an outline; filled ones are solid cards. */
.org-node-vacant { border-style: dashed; background: transparent; box-shadow: none; }
/* Leadership tree: any depth. The parent drops a short stem into a bus that runs
   between its children's centres, and every child hangs from that bus. */
.org-forest {
  display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-start;
  gap: var(--space-7);
  padding: var(--space-5) var(--space-2) var(--space-4);
}
.org-branch { display: flex; flex-direction: column; align-items: center; position: relative; }
.org-branch-kids {
  display: flex; align-items: flex-start; justify-content: center;
  gap: 22px; padding-top: 28px; position: relative;
}
.org-branch-kids::before {
  content: ""; position: absolute; top: 0; left: 50%; margin-left: -1px;
  width: 2px; height: 14px; background: var(--connector); border-radius: 2px;
}
.org-branch-kids > .org-branch { position: relative; }
.org-branch-kids > .org-branch::before {
  content: ""; position: absolute; top: -14px; left: 50%; margin-left: -1px;
  width: 2px; height: 14px; background: var(--connector); border-radius: 2px;
}
.org-branch-kids > .org-branch::after {
  content: ""; position: absolute; top: -14px; height: 2px; left: -11px; right: -11px;
  background: var(--connector); border-radius: 2px;
}
.org-branch-kids > .org-branch:first-child::after { left: 50%; }
.org-branch-kids > .org-branch:last-child::after { right: 50%; }
.org-branch-kids > .org-branch:only-child::after { display: none; }
@media (max-width: 760px) {
  .org-forest { padding: var(--space-4) var(--space-2); gap: var(--space-5); }
  .org-branch-kids {
    flex-direction: column; align-items: flex-start; gap: 14px;
    padding: 16px 0 0 16px;
  }
  .org-branch-kids::before { height: 16px; }
  .org-branch-kids > .org-branch { align-items: flex-start; }
  .org-branch-kids > .org-branch::before,
  .org-branch-kids > .org-branch::after { display: none; }
  .org-node, .org-node-lead { width: min(260px, 100%); }
}

/* A vacant node is the place to act: the whole card opens the assign dialog. */
.org-node-action {
  color: inherit; text-decoration: none; cursor: pointer;
  transition: border-color .12s ease, box-shadow .12s ease, transform .12s ease;
}
.org-node-action:hover {
  border-color: var(--link); box-shadow: 0 0 0 1px var(--node-ring), var(--hover-shadow);
  transform: translateY(-1px);
}
.org-node-action:focus-visible { outline: 2px solid var(--link); outline-offset: 3px; }
.org-node-lead { width: 240px; }
.org-node-role {
  color: var(--muted); font-size: 10.5px; font-weight: 650; letter-spacing: .045em;
  line-height: 1.45; text-transform: uppercase;
}
.org-node-name {
  font-size: 15.5px; font-weight: 650; line-height: 1.5;
  letter-spacing: .01em; overflow-wrap: anywhere;
}
.org-node-name a { color: var(--ink); text-decoration: none; }
.org-node-name a:hover { color: var(--link); text-decoration: underline; }
.org-node-vacant { opacity: .88; }
/* Vacancy marker: a dot plus the word, never colour alone. */
.org-node-vacant .org-node-name .muted::before {
  content: ""; display: inline-block; width: 6px; height: 6px; margin-right: 6px;
  border-radius: 50%; background: var(--vacant-dot); vertical-align: middle;
}
.org-avatar {
  display: inline-grid; place-items: center; flex: none; border-radius: 50%; overflow: hidden;
  background: var(--chip-brand-bg); color: var(--brand); font-weight: 700;
  box-shadow: 0 0 0 2px var(--card), 0 0 0 4px var(--line);
}
.org-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.org-avatar.lg { width: 88px; height: 88px; font-size: 30px; }
.org-avatar.md { width: 62px; height: 62px; font-size: 22px; }
.org-avatar.sm { width: 38px; height: 38px; font-size: 14px; box-shadow: 0 0 0 1px var(--card), 0 0 0 2px var(--line); }
/* Photo could not load: fall back to the initial rather than an empty circle. */
.org-avatar.no-photo img { display: none; }
.org-avatar.no-photo::before { content: attr(data-initial); }
.org-avatar.vacant {
  color: var(--muted); background: var(--surface-3);
  box-shadow: 0 0 0 2px var(--card), 0 0 0 4px var(--node-ring);
}
.org-dept-card { gap: 11px; }
.org-dept-head { display: flex; align-items: center; gap: 12px; min-width: 0; }
.org-dept-title { min-width: 0; }
.org-dept-title h3 { margin: 0 0 2px; font-size: 16px; line-height: 1.35; overflow-wrap: anywhere; }
.org-dept-title h3 a { color: var(--ink); text-decoration: none; }
.org-dept-title h3 a:hover { color: var(--link); text-decoration: underline; }
.org-dept-lead { display: flex; flex-direction: column; gap: 2px; padding: 9px 0 0; border-top: 1px solid var(--line); font-size: 13.5px; font-weight: 600; }
.org-dept-lead a { color: var(--ink); text-decoration: none; }
.org-dept-lead a:hover { color: var(--link); text-decoration: underline; }
.org-mini-list { display: grid; gap: 7px; }
.org-mini { display: flex; align-items: center; gap: 9px; min-width: 0; font-size: 12.5px; }
.org-mini > div { display: flex; flex-direction: column; min-width: 0; }
.org-mini-role { color: var(--muted); font-size: 10.5px; line-height: 1.3; }
.org-mini a { color: var(--ink); text-decoration: none; overflow-wrap: anywhere; }
.org-mini a:hover { color: var(--link); text-decoration: underline; }
.org-mini.org-vacant { opacity: .72; }
.org-card-link { margin-top: auto; padding-top: 8px; color: var(--link); font-size: 12.5px; font-weight: 600; text-decoration: none; }
.org-card-link:hover { text-decoration: underline; }
.org-cell-card-head { display: flex; align-items: center; gap: 12px; }
.org-cell-card-head h3 { margin: 0 0 2px; font-size: 16px; }
.org-cell-card-head h3 a { color: var(--ink); text-decoration: none; }
.org-cell-card-head h3 a:hover { color: var(--link); text-decoration: underline; }
.org-cell-card-head p { margin: 0 0 4px; }
.org-member-count { display: inline-block; padding: 1px 8px; border-radius: 999px; background: var(--chip-bg); color: var(--muted); font-size: 11.5px; }
.org-cell-lead { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 9px 0 0; border-top: 1px solid var(--line); font-size: 13.5px; font-weight: 600; }
.org-cell-lead a { color: var(--ink); text-decoration: none; }
.org-cell-lead a:hover { color: var(--link); text-decoration: underline; }
.org-cell-row .org-avatar { margin-right: 2px; }
.dept-detail-leaders { margin-bottom: 16px; padding: 18px 20px; }
.dept-leader { align-items: center; text-align: center; }
.dept-leader a { color: var(--ink); font-weight: 600; text-decoration: none; }
.dept-leader a:hover { color: var(--link); text-decoration: underline; }
.dept-members-card { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; padding: 18px 20px; }
.dept-members-card > div:first-child { flex: 1 1 240px; }
.dept-members-card h2 { margin: 0 0 2px; }
.dept-members-card p { margin: 0; }
.dept-members-count { display: flex; align-items: baseline; gap: 5px; }
.dept-members-count strong { font-size: 30px; line-height: 1; color: var(--brand); }
.dept-members-count span { color: var(--muted); font-size: 12px; }
@media (max-width: 760px) {
  .org-chart { padding: 16px 14px 20px; }
  .org-chart-level { gap: 8px; }
  .org-chart-level-team::before { left: 8%; right: 8%; }
  .org-avatar.lg { width: 76px; height: 76px; font-size: 26px; }
  .org-avatar.md { width: 54px; height: 54px; font-size: 19px; }
}
@media (max-width: 520px) {
  .org-chart-level-team { padding-top: 16px; }
  .org-chart-level-team::before,
  .org-chart-level-team .org-node::before { display: none; }
  .org-chart-level-team { display: grid; grid-template-columns: 1fr; gap: 4px; }
  .org-chart-level .org-node { width: 100%; flex-direction: row; justify-content: flex-start; text-align: left; gap: 10px; }
  .org-chart-level .org-node .org-avatar { order: 0; }
  .org-chart-level .org-node .org-node-role { order: 1; }
  .org-chart-level .org-node .org-node-name { order: 2; margin-left: auto; text-align: right; }
  .org-node-lead { width: 100%; flex-direction: column; text-align: center; }
  .org-node-lead .org-node-name { margin-left: 0; text-align: center; }
  .dept-members-card { align-items: flex-start; }
}
@media (max-width: 640px) {
  .org-leadership, .dept-add, .dept-row { padding: 14px 16px; }
  .org-lead-grid { grid-template-columns: 1fr 1fr; }
  .dept-row .form-grid { grid-template-columns: 1fr; }
  .dept-active { align-self: start; }
}
.member-role-inline { display: none; }
@media (max-width: 760px) {
  /* The member table scrolls sideways on phones; surface the role under the
     name so assigning it never needs a horizontal swipe. */
  .member-role-inline { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
  .member-role-inline .position-edit { margin-left: 0; }
}
.position-cell { white-space: nowrap; }
.position-cell .position-edit { margin-left: 6px; font-size: 12px; }
.position-member { margin: 0 0 10px; font-size: 15px; }
.position-form .actions { margin-top: 14px; }
.badge.position { background: var(--chip-brand-bg); color: var(--link); }
@media (max-width: 760px) {
  .org-grid { grid-template-columns: 1fr; }
  .org-cell-row { grid-template-columns: 1fr auto; }
  .org-cell-leader { grid-column: 1 / -1; grid-row: 2; }
  .org-cell-count { grid-column: 2; grid-row: 1; }
}
@media (max-width: 640px) {
  .org-state { padding: 14px 16px; }
  .org-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .org-card { padding: 14px; }
  .quick-ranges { margin-bottom: 10px; }
  .quick-chip { min-height: 34px; padding: 5px 12px; }
}

/* ---------- reports: phone layout ---------- */
/* Five table columns are hard to scan on a phone, so each report becomes a
   card with labelled facts. Desktop keeps the compact table. */
@media (max-width: 640px) {
  .reports-filter-box { margin-bottom: 10px; }
  .reports-filter-box > form.filters {
    padding: 12px; margin: 0; background: var(--card);
    border: 1px solid var(--line); border-top: 0;
    border-radius: 0 0 12px 12px;
  }
  .reports-filter-box > form.filters .actions { margin-top: 0; }
  .reports-filter-box > form.filters input,
  .reports-filter-box > form.filters .actions .btn { min-height: 44px; }
  .reports-filter-box > summary .range {
    margin-left: 4px; color: var(--muted); font-size: 12.5px; font-weight: 500;
  }

  .reports-wrap { border: 0; border-radius: 0; background: transparent; overflow: visible; }
  table.list-tbl.reports-tbl { min-width: 0; border: 0; background: transparent; }
  .reports-tbl thead { display: none; }
  .reports-tbl tbody { display: grid; gap: 10px; }
  .reports-tbl tr {
    display: block; padding: 12px 14px; background: var(--card);
    border: 1px solid var(--line); border-radius: var(--radius);
    box-shadow: 0 1px 2px rgba(16,24,40,.04);
  }
  .reports-tbl td {
    display: flex; align-items: baseline; justify-content: space-between;
    gap: 14px; padding: 3px 0; border: 0; white-space: normal;
    text-align: right; font-size: 13px; overflow-wrap: anywhere;
  }
  .reports-tbl td::before {
    content: attr(data-label); flex: none; text-align: left;
    color: var(--muted); font-size: 12px; font-weight: 600;
  }
  /* The first-column sticky treatment is only for wide member tables. */
  .reports-tbl td:first-child { position: static; background: transparent; box-shadow: none; }
  .reports-tbl td.report-date, .reports-tbl td.report-title { display: block; padding: 0; text-align: left; }
  .reports-tbl td.report-date::before, .reports-tbl td.report-title::before { display: none; }
  .reports-tbl td.report-date { color: var(--muted); font-size: 12px; }
  .reports-tbl td.report-title { margin: 2px 0 8px; font-size: 15.5px; font-weight: 600; line-height: 1.45; }
  .reports-tbl td.report-title a { color: var(--link); text-decoration: none; }
  .reports-tbl td.report-title a:hover { color: var(--link); text-decoration: underline; }
  .reports-tbl td.report-status { margin-top: 7px; padding-top: 8px; border-top: 1px dashed var(--line); }
  .reports-tbl tr.empty-row { padding: 0; background: transparent; border: 0; box-shadow: none; }
  .reports-tbl tr.empty-row td {
    display: block; padding: 30px 16px; text-align: center;
    background: var(--card); border: 1px solid var(--line); border-radius: var(--radius);
  }
  .reports-tbl tr.empty-row td::before { display: none; }
  .empty-action { margin-top: 12px; }

  /* Keep form controls comfortable to tap. The action row stays in the normal
     flow: a sticky bar covered the Township/title fields while the long form
     was being filled on a phone. */
  .report-form input, .report-form select { min-height: 44px; }
  .report-form-actions {
    margin-top: 18px; padding: 10px; background: var(--card);
    border: 1px solid var(--line); border-radius: var(--radius);
  }
  .report-form-actions .btn { flex: 1 1 0; min-height: 44px; }
}

/* On narrow phones the five English nav labels no longer fit at 13px. Keep
   the primary row intact, compact the report range chips so they do not leave
   one chip stranded, and drop the long generated Home Cell code from the row. */
@media (max-width: 420px) {
  .topbar nav { column-gap: 0; }
  .topbar nav a { padding: 5px 4px; font-size: 12px; }
  .quick-ranges { gap: 4px; }
  .quick-chip { padding: 5px 9px; font-size: 11.5px; }
  .org-code { display: none; }
}

/* On tablets and phones app.js places the menu with viewport coordinates, so
   neither the scrolling nav nor its mask can clip it. */
@media (max-width: 1180px) {
  .nav-admin .nav-menu {
    position: fixed; top: 0; left: 0; right: auto; z-index: 90; min-width: 0;
  }
}

/* On phones the Administration row sits below the five primary links. */
@media (max-width: 640px) {
  .nav-admin {
    display: block; flex-basis: 100%; order: 20;
    margin: 3px 0 0 7px; padding-left: 7px;
    border-left: 1px solid rgba(255,255,255,.3);
  }
  .nav-admin > summary { display: inline-flex; padding: 4px 6px; font-size: 12px; line-height: 1.6; }
  .nav-admin .chev { font-size: 9px; }
}

/* ---------- touch photo lightbox ---------- */
.photo-lightbox {
  position: fixed; inset: 0; z-index: 120; display: none; place-items: center;
  padding: 18px; background: rgba(2, 8, 23, .78);
}
.photo-lightbox.on { display: grid; }
.photo-lightbox img {
  display: block; max-width: 100%; max-height: calc(100vh - 96px);
  width: auto; height: auto; border-radius: var(--radius); background: var(--card);
  box-shadow: 0 22px 54px rgba(2, 8, 23, .4);
}
.photo-lightbox-close {
  position: absolute; top: max(12px, env(safe-area-inset-top)); right: 12px;
  display: grid; place-items: center; width: 44px; height: 44px;
  border: 1px solid rgba(255,255,255,.45); border-radius: 999px;
  background: rgba(0,0,0,.35); color: #fff; font-size: 26px; line-height: 1;
  cursor: pointer;
}
body.photo-lightbox-open { overflow: hidden; }

/* ---------- hover preview for member photos ---------- */
.photo-preview-float {
  position: fixed; left: 0; top: 0; z-index: 90;
  width: 240px; height: 240px; overflow: hidden; pointer-events: none;
  background: var(--card); border: 3px solid var(--card); border-radius: 18px;
  box-shadow: 0 0 0 1px var(--line), 0 22px 54px rgba(2, 8, 23, .3);
  opacity: 0; transform: scale(.92);
  transition: opacity .14s ease, transform .14s ease;
}
.photo-preview-float.on { opacity: 1; transform: scale(1); }
.photo-preview-float img { display: block; width: 100%; height: 100%; object-fit: cover; }
img.photo-previewing { outline: 2px solid var(--brand); outline-offset: 2px; }
@media (hover: none), (pointer: coarse) {
  .photo-preview-float { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .photo-preview-float { transition: none; }
}

/* ---------- product-wide visual language ----------
   Shared finish for every page: deep navy surfaces, a blue gradient header,
   larger page titles and calmer, roomier cards. Component styles above still
   own their layout; this layer only unifies colour, radius, spacing and type. */
body { background: var(--bg); }
::selection { background: rgba(37,99,235,.4); color: var(--ink); }
.topbar {
  min-height: 64px; padding: 10px 22px; gap: 18px;
  background: var(--surface); border-bottom: 1px solid var(--hairline);
  box-shadow: var(--elev-1);
}
.topbar .brand { gap: 11px; }
.topbar .brand img { width: 36px; height: 36px; border-radius: var(--radius-sm); }
.topbar .brand-name { font-size: 16.5px; font-weight: 800; letter-spacing: -.015em; }
.topbar nav { gap: 3px; }
.topbar nav a, .topbar nav .nav-admin > summary {
  padding: 8px 14px; border-radius: var(--radius-sm); font-size: 14.5px; font-weight: 500;
}
/* Active nav reads as a brand-accent pill on the surface header, not as a
   lighter patch of a blue bar. */
.topbar nav a.active, .topbar nav a:hover.active {
  background: var(--chip-brand-bg); color: var(--link); font-weight: 600;
  box-shadow: inset 0 0 0 1px var(--line); opacity: 1;
}
.topbar .who { gap: 10px; }
.container { max-width: 1320px; margin: 28px auto 8px; padding: 0 24px; }
/* Wide desktops: use the room for card grids, while tables get a little more
   width so the 14-column member list stops hugging the middle of the screen. */
@media (min-width: 1280px) {
  .container { max-width: 1480px; }
  .container:has(.tbl-wrap) { max-width: 1600px; }
}
/* 1280–1400px laptops: the member list's role column held several badge rows
   on one line and made the table wider than the viewport. Let those badges
   wrap and tighten the cell gutters so all columns fit without a horizontal
   scrollbar, while keeping the sticky-name behaviour for narrower screens. */
@media (min-width: 1181px) and (max-width: 1500px) {
  .list-tbl th, .list-tbl td { padding: 8px 4px; font-size: 12.5px; }
  .list-tbl th[data-col="role"],
  .list-tbl td[data-col="role"] { width: 185px; max-width: 185px; }
  .list-tbl td[data-col="role"] { white-space: normal; }
  .list-tbl td[data-col="role"] .position-edit { white-space: nowrap; }
  .list-tbl td[data-col="name"] { max-width: 190px; overflow: hidden; text-overflow: ellipsis; }
  .list-tbl td[data-col="group"],
  .list-tbl td[data-col="familyGroup"],
  .list-tbl td[data-col="fellowship"],
  .list-tbl td[data-col="sector"] { white-space: normal; overflow-wrap: anywhere; }
}
@media (min-width: 1760px) {
  .container { max-width: 1560px; }
  .container:has(.tbl-wrap) { max-width: 1680px; }
}
.page-head { align-items: flex-start; gap: 16px; margin-bottom: 20px; }
.page-head h1 { font-size: 30px; font-weight: 800; letter-spacing: -.035em; line-height: 1.24; }
.page-head h1 .count-pill { margin-left: 10px; font-size: 12px; font-weight: 700; vertical-align: middle; }
.page-sub { margin-top: 5px; font-size: 14px; line-height: 1.6; }
.page-head-actions { gap: 10px; align-items: center; }
.card h1 { font-size: 24px; }
.card h2 { font-size: 17px; }
/* A lone count does not need a tall tile: keep every stat strip (structure
   pages, settings, pastors, vacancies) as one compact row of numbers. */
.stat-grid { gap: 12px; }
.stat { min-height: 0; padding: 13px 16px; gap: 3px; }
.stat .n { font-size: 25px; font-weight: 700; letter-spacing: -.02em; }
.stat .t { font-size: 12.5px; line-height: 1.35; }
.hh-grid { gap: 16px; }
.hh-card {
  padding: 18px 20px; border-radius: var(--radius-lg); gap: 14px;
  background: linear-gradient(180deg, rgba(255,255,255,.02), transparent 46%), var(--card);
}
.hh-card-name, .hh-card-title a { font-size: 17px; font-weight: 700; }
.hh-avatar { border-radius: var(--radius); }
.btn {
  border-radius: var(--radius-sm); padding: 9px 18px; font-weight: 600; letter-spacing: .005em;
  min-height: 42px;
}
.btn.sm { min-height: 34px; padding: 6px 12px; font-size: 13px; }
/* Compact icon actions for dense list rows: label stays in title/aria-label. */
.row-actions-cell { width: 1%; white-space: nowrap; }
.row-icon-actions { display: inline-flex; align-items: center; gap: 6px; }
.row-icon-actions form { display: inline-flex; margin: 0; }
.btn.icon-btn {
  width: 36px; min-width: 36px; height: 36px; min-height: 36px; padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
}
.btn.icon-btn svg { width: 16px; height: 16px; display: block; }
.hh-card-actions .row-icon-actions { flex: 0 0 auto; }
.hh-card-actions .row-icon-actions .btn.icon-btn { flex: 0 0 36px; }
.hh-card-actions .row-icon-actions form { flex: 0 0 auto; }
@media (max-width: 640px) {
  .btn.icon-btn { width: 44px; min-width: 44px; height: 44px; min-height: 44px; }
  .row-icon-actions { gap: 8px; }
  .hh-card-actions .row-icon-actions .btn.icon-btn { flex: 0 0 44px; }
  .hh-member-actions .btn.icon-btn { flex: 0 0 44px; width: 44px; }
}
.btn:not(.secondary):not(.danger):not(.outline-danger) {
  background: linear-gradient(180deg, #3478f6, var(--brand));
  box-shadow: 0 2px 7px rgba(37,99,235,.28);
}
.btn.secondary { border-color: var(--line-strong); }
input[type=text], input[type=search], input[type=password], input[type=date],
input[type=email], input[type=tel], input[type=url],
input[type=number], input[type=file], select, textarea {
  border-radius: var(--radius-sm);
}
input[type=text], input[type=search], input[type=password], input[type=date],
input[type=email], input[type=tel], input[type=url],
input[type=number], select { height: 42px; }
input:focus, select:focus, textarea:focus {
  outline: 3px solid rgba(37,99,235,.22); border-color: #4f8bf7;
}
.filters { gap: 12px; margin-bottom: 18px; }
.filters input, .filters select { height: 42px; }
th, td { padding: 11px 14px; }
th { font-size: 13px; }
.modal-backdrop { background: rgba(2,6,18,.78); }
.modal-card { border: 1px solid var(--hairline); }
.modal-head { padding: 18px 24px; }
.modal-head h3 { font-size: 19px; font-weight: 700; }
.modal-body { padding: 22px 24px; }
.modal-body form > .actions:last-child {
  margin-left: -24px; margin-right: -24px; margin-bottom: -22px; padding: 14px 24px;
}
.flash { border-radius: var(--radius); }
.footer { padding: 30px 16px 38px; font-size: 12.5px; }
@media (max-width: 760px) {
  .topbar { padding: 8px 12px; gap: 8px; }
  .topbar nav {
    order: 3; flex: 1 1 100%; flex-wrap: nowrap; overflow-x: auto;
    scrollbar-width: none; padding: 2px 0;
  }
  .topbar nav::-webkit-scrollbar { display: none; }
  .topbar nav a, .topbar nav .nav-admin > summary {
    padding: 6px 10px; font-size: 13.5px; white-space: nowrap;
  }
  .topbar .brand img { width: 32px; height: 32px; }
  .topbar .who { margin-left: auto; gap: 6px; }
  .container { margin-top: 22px; padding: 0 16px; }
  .page-head h1 { font-size: 25px; }
  .card { padding: 18px 18px; }
  .stat { padding: 18px 20px; min-height: 108px; }
  .stat .n { font-size: 31px; }
  .modal-body form > .actions:last-child {
    margin-left: -18px; margin-right: -18px; margin-bottom: -22px; padding: 13px 18px;
  }
}
/* ---------- label typography per language ----------
   Uppercase and letter-spacing are Latin-only devices: they destroy Myanmar
   syllable clusters (the base font shapes them as one unit) and Korean has no
   case at all, so tracked micro-labels are kept for English UI only. */
/* ---------- vacant leadership: compact state + assign dialog ----------
   A chart of empty boxes says nothing, so an all-vacant church collapses to
   one prompt that names the problem and opens the assign dialog. */
.org-vacant-state {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
  gap: var(--space-3) var(--space-5);
  padding: var(--space-4) var(--space-5);
  border: 1px dashed var(--line); border-radius: var(--radius);
  background: var(--surface-3);
}
.org-vacant-state h3 { margin: 0 0 2px; font-size: 15px; }
.org-vacant-state p { margin: 0; }
.org-vacant-count {
  display: inline-flex; align-items: center; gap: 6px;
  color: var(--muted); font-size: 12.5px; font-variant-numeric: tabular-nums;
}
.org-vacant-count::before {
  content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--vacant-dot);
}

/* Assign-leader dialog: a filter over a scrollable radio list of this
   church's members, so one church never renders the whole registry. */
.assign-search { margin-bottom: var(--space-3); }
.assign-list {
  display: grid; gap: 4px; max-height: 300px; overflow-y: auto; overscroll-behavior: contain;
  padding: var(--space-2); border: 1px solid var(--line); border-radius: var(--radius);
  background: var(--surface-3);
}
.assign-row {
  display: flex; align-items: center; gap: var(--space-3);
  padding: 8px 10px; border: 1px solid transparent; border-radius: var(--radius-sm);
  background: var(--card); cursor: pointer;
}
.assign-row:hover { border-color: var(--line-strong); }
.assign-row input { margin: 0; }
.assign-row.is-current { border-color: var(--link); }
.assign-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.assign-name { font-weight: 600; min-width: 0; overflow-wrap: anywhere; }
.assign-meta { margin-left: auto; color: var(--muted); font-size: 12.5px; white-space: nowrap; }
.assign-empty { padding: var(--space-4); text-align: center; color: var(--muted); }
.assign-hint { margin: 0 0 var(--space-2); color: var(--muted); font-size: 12px; }
.assign-list-clear { margin-top: var(--space-2); }

/* Nested roles in the Home Cell and Department charts: children hang off their
   parent on a connector rail, the same reading as the church tree. */
.org-role-kids {
  margin-left: 12px; padding-left: 10px;
  border-left: 2px solid var(--connector);
  display: grid; gap: 2px;
}
.org-role-branch { display: grid; gap: 2px; }
.org-role-kids .org-mini { margin-top: 0; }
/* Replace notice: shown in the row that owns the conflict and repeated under the
   list once that member is selected, so the consequence is visible at Save time. */
.assign-row-note { color: var(--warn-ink); font-size: 12px; line-height: 1.5; }
.assign-warn {
  margin: var(--space-3) 0 0; padding: 9px 11px; border-radius: var(--radius-sm);
  background: var(--warn-bg); color: var(--warn-ink); font-size: 12.5px; line-height: 1.6;
}
.assign-warn[hidden] { display: none; }
/* The all-vacant prompt still lists its slots, so the structure never disappears. */
.org-vacant-roles {
  display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 0; padding: 0; list-style: none;
}
.org-vacant-roles li {
  padding: 3px 10px; border: 1px dashed var(--line); border-radius: 999px;
  color: var(--muted); font-size: 12px;
}

:not(:lang(en)) :is(
  .org-node-role, .org-church-kicker, .org-supervision-title, .nav-menu-label,
  .pastor-section legend, .detail-item .k, .edit-change .k, .edit-pair .k,
  .regional-candidate-group h4, .cluster-kicker, .cluster-cell-group h4
) { text-transform: none; letter-spacing: 0; }

/* ---------- members list on a phone ----------
   Fifteen columns are unreadable on a phone and force a long sideways scroll,
   so the secondary columns step aside and the list keeps the columns that
   identify a member and tell you what you came for: name, age, home cell, status
   and the row actions. Wider screens (and the column chooser) still show them. */
@media (max-width: 900px) {
  .list-tbl :is(th, td):is(
    [data-col="id"], [data-col="phone"], [data-col="state"], [data-col="township"],
    [data-col="marital"], [data-col="role"], [data-col="group"],
    [data-col="familyGroup"], [data-col="fellowship"], [data-col="sector"]
  ) { display: none; }
  /* The remaining columns fit, so drop the forced scroll width. */
  table.list-tbl.members-tbl { min-width: 0; }
}
@media (max-width: 520px) {
  .list-tbl :is(th, td):is([data-col="gender"], [data-col="homeCell"]) { display: none; }
  .list-tbl :is(th, td) { padding: 10px 10px; }
  .list-tbl td[data-col="name"] { max-width: none; }
  /* Three columns left, so they have to wrap instead of forcing a sideways
     swipe: the name may take two lines and the badge may break after the word. */
  .members-tbl :is(th, td) { padding: 9px 8px; }
  .members-tbl td[data-col="name"],
  .members-tbl td[data-col="status"] { white-space: normal; overflow-wrap: anywhere; }
  .members-tbl td:nth-child(2) { min-width: 0; }
  .members-tbl .row-icon-actions { gap: 4px; }
  /* Role badges and their Change link turn a two-line row into six lines on a
     phone; roles are on the member page, which the row already links to. */
  .members-tbl .member-role-inline { display: none; }
  .members-tbl td[data-col="status"] .badge { white-space: nowrap; }
  /* One row action on a phone: Edit stays, Delete is on the member page and in
     the bulk bar, where it is harder to hit by accident. */
  .members-tbl .row-icon-actions form { display: none; }
}
@media (max-width: 380px) {
  .members-tbl :is(th, td)[data-col="age"] { display: none; }
  .members-tbl .list-avatar { display: none; }
}
/* Touch targets: the header pills and the "View all" links were sized for a
   mouse pointer; on a phone they are the smallest things on the screen. */
@media (max-width: 640px) {
  .topbar .langswitch a { min-height: 34px; padding: 2px 11px; }
  .topbar .who-link { display: inline-flex; align-items: center; min-height: 34px; }
  .dc-head a { display: inline-flex; align-items: center; min-height: 34px; padding: 0 2px; }
  .members-tbl input[type="checkbox"],
  .bulk-check-all { width: 18px; height: 18px; }
}
@media (max-width: 380px) {
  /* The account block (language pills, username, Sign out) must still fit on a
     320px screen; the taller touch targets pushed it 8px past the edge. */
  .topbar .langswitch a { padding: 2px 7px; min-height: 30px; }
  .topbar .who { gap: 4px; }
  .topbar .who-link { max-width: 72px; padding: 4px 4px; }
  .topbar .who form .btn { padding: 5px 8px; }
}
@media (max-width: 400px) {
  .members-tbl .list-avatar { display: none; }
  .members-tbl td[data-col="age"], .members-tbl th[data-col="age"] { padding-left: 4px; padding-right: 4px; }
}
/* ---------- audit log ----------
   One row per change: when, who, what, device/IP, and the raw request behind
   it. On a phone each row becomes a labelled card. */
.audit-tbl td { vertical-align: top; }
.audit-when { white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--muted); font-size: 12.5px; }
.audit-user { font-weight: 600; white-space: nowrap; }
.audit-action { font-weight: 600; }
.audit-action.is-warn { color: var(--err-ink); }
.audit-entity {
  margin-left: 6px; padding: 1px 7px; border-radius: 999px;
  background: var(--chip-bg); color: var(--muted); font-size: 11.5px;
}
.audit-summary { display: block; margin-top: 2px; }
.audit-device { font-size: 12.5px; color: var(--muted); white-space: nowrap; }
.audit-ip { display: block; font-size: 11.5px; }
.audit-detail details > summary { cursor: pointer; color: var(--muted); font-size: 12px; }
.audit-detail details > summary:hover { color: var(--ink); }
.audit-ua { margin-top: 6px; font-size: 11.5px; line-height: 1.55; color: var(--muted); overflow-wrap: anywhere; }
@media (max-width: 900px) {
  .audit-wrap { overflow: visible; border: 0; background: transparent; }
  /* Beats the shared "table.list-tbl { min-width: 760px }" phone rule. */
  table.list-tbl.audit-tbl { display: block; min-width: 0; border: 0; background: transparent; }
  .audit-tbl thead { display: none; }
  .audit-tbl tbody { display: grid; gap: 10px; }
  .audit-tbl tr {
    display: block; padding: 12px 14px; background: var(--card);
    border: 1px solid var(--line); border-radius: var(--radius);
  }
  .audit-tbl td {
    display: flex; align-items: baseline; justify-content: space-between; gap: 14px;
    padding: 3px 0; border: 0; text-align: right; white-space: normal; font-size: 13px;
    overflow-wrap: anywhere;
  }
  .audit-tbl td::before {
    content: attr(data-label); flex: none; text-align: left;
    color: var(--muted); font-size: 12px; font-weight: 600;
  }
  .audit-tbl td.audit-action-cell, .audit-tbl td.audit-detail { display: block; text-align: left; }
  .audit-tbl td.audit-action-cell::before, .audit-tbl td.audit-detail::before { display: none; }
  .audit-tbl td.audit-when { justify-content: flex-start; }
}

/* ---------- pastor ministry history (timeline) ---------- */
.history-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: wrap; margin-bottom: 4px;
}
.history-head h2 { margin: 0; }
.timeline { list-style: none; margin: 14px 0 0; padding: 0; }
.timeline-item {
  position: relative; display: grid; grid-template-columns: 132px minmax(0, 1fr);
  gap: 6px 16px; padding: 0 0 16px 18px; border-left: 2px solid var(--line);
}
.timeline-item:last-child { padding-bottom: 2px; }
.timeline-item::before {
  content: ""; position: absolute; left: -6px; top: 5px; width: 10px; height: 10px;
  border-radius: 50%; background: var(--card); border: 2px solid var(--line-strong);
}
.timeline-item.is-current::before { border-color: var(--link); background: var(--link); }
.timeline-years {
  font-weight: 700; font-size: 13.5px; color: var(--ink);
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.timeline-role { font-weight: 600; overflow-wrap: anywhere; }
.timeline-church { font-weight: 500; color: var(--muted); }
.timeline-meta { margin-top: 2px; color: var(--muted); font-size: 12.5px; }
.timeline-notes { margin: 6px 0 0; font-size: 13px; white-space: pre-wrap; overflow-wrap: anywhere; }
.timeline-actions { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
@media (max-width: 560px) {
  .timeline-item { grid-template-columns: minmax(0, 1fr); }
  .timeline-item { padding-left: 16px; }
}

/* ---------- reports: review flag, drafts ---------- */
.review-flag {
  display: inline-flex; align-items: center; gap: 6px; margin: 0 0 12px;
  padding: 8px 14px; border-radius: 999px;
  background: var(--warn-bg); color: var(--warn-ink);
  font-size: 13px; text-decoration: none; border: 1px solid transparent;
}
.review-flag:hover { border-color: var(--warn-ink); }
.review-flag.is-on { background: var(--card); border-color: var(--warn-ink); }
.draft-banner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 14px; flex-wrap: wrap;
}
.draft-banner p { margin: 3px 0 0; }
.report-draft-hint { margin-top: 8px; }
@media (max-width: 640px) {
  .report-form-actions { flex-wrap: wrap; }
  .report-form-actions .btn { flex: 1 1 44%; }
}

`; // end of stylesheet
