/** Single-file stylesheet served at /styles.css (no bundler needed). */

/* Dark palette, defined once and emitted under both the OS-preference media query
   (no-JS fallback) and the explicit [data-theme] attribute (user toggle). */
const DARK_VARS = `
    --bg: #10151f; --card: #1a2030; --ink: #e7eaf3; --muted: #98a1b6;
    --line: #2a3245; --line-strong: #3d4763; --brand: #1f4e8c; --brand-ink: #ffffff;
    --link: #8ab0f0;
    --ok-bg: #14301f; --ok-ink: #82d8a4; --err-bg: #3a161a; --err-ink: #f0a3a3;
    --warn-bg: #38280f; --warn-ink: #eec27e;
    --male: #6da0e0; --female: #d989b1;
    --th-bg: #202839; --row-hover: #222b3f;
    --chip-bg: #253048; --chip-brand-bg: #223350;
    --chip-purple-bg: #332b4d; --chip-purple-ink: #b79aec;
    --track: #263149; --sep: #5b6783;
    --btn2-bg: #253048; --btn2-hover: #2d3952;
    --field-bg: #131a29; --count-bg: rgba(231,234,243,.12);
    --hover-shadow: 0 4px 14px rgba(0,0,0,.45);
  `;

export const CSS = `
:root {
  /* Slightly darker page tint than the cards, so the centered content column
     reads as a deliberate "sheet" on wide desktops instead of dead white space. */
  --bg: #e9edf4; --card: #ffffff; --ink: #1c2333; --muted: #667085;
  --line: #e4e7ec; --line-strong: #ccd6e6; --brand: #1f4e8c; --brand-ink: #ffffff;
  --link: #1f4e8c;
  --ok-bg: #e7f6ec; --ok-ink: #14683a; --err-bg: #fdecec; --err-ink: #a11b1b;
  --warn-bg: #fff4e0; --warn-ink: #8a5300;
  --male: #2f6fb5; --female: #c2558f;
  --th-bg: #f8f9fc; --row-hover: #f4f6fb;
  --chip-bg: #eef1f6; --chip-brand-bg: #e8effa;
  --chip-purple-bg: #f1e9fb; --chip-purple-ink: #6d3fb4;
  --track: #eef1f6; --sep: #a8b3c4;
  --btn2-bg: #eef1f6; --btn2-hover: #e3e8f0;
  --field-bg: #ffffff; --count-bg: rgba(28,35,51,.08);
  --hover-shadow: 0 4px 14px rgba(28,35,51,.07);
}
/* Dark palette: default follows the OS preference; a saved manual choice on <html>
   data-theme wins (see the inline script in layout.tsx and public/app.js). Every
   component reads the vars above, so flipping them re-themes the whole app. */
:root[data-theme="dark"] {${DARK_VARS}}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {${DARK_VARS}}
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
  border: 1px solid rgba(255,255,255,.45); border-radius: 999px;
  background: transparent; color: var(--brand-ink); cursor: pointer; flex: none;
}
.topbar .theme-toggle:hover { background: rgba(255,255,255,.14); }
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
  background: var(--brand); color: var(--brand-ink);
  display: flex; flex-wrap: wrap; align-items: center; gap: 14px;
  padding: 10px 18px;
  position: sticky; top: 0; z-index: 20;
  box-shadow: 0 1px 3px rgba(0,0,0,.18);
}
.topbar .brand { font-weight: 700; text-decoration: none; color: inherit; white-space: nowrap;
  display: inline-flex; align-items: center; gap: 10px; }
.topbar .brand img { width: 34px; height: 34px; border-radius: 8px; background: #fff; padding: 3px; display: block; }
.topbar .langswitch { display: inline-flex; align-items: center; gap: 2px; font-size: 13px;
  border: 1px solid rgba(255,255,255,.45); border-radius: 999px; padding: 2px 4px; }
.topbar .langswitch a { color: var(--brand-ink); text-decoration: none; padding: 2px 9px; border-radius: 999px; opacity: .65; }
.topbar .langswitch a:hover { opacity: 1; background: rgba(255,255,255,.14); }
.topbar .langswitch a.on { background: #fff; color: var(--brand); opacity: 1; font-weight: 700; }
.topbar nav { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; flex: 1; }
.topbar nav a, .topbar nav .sep {
  color: var(--brand-ink); text-decoration: none; padding: 5px 9px; border-radius: 6px; opacity: .92;
}
.topbar nav a:hover, .topbar nav a.active { background: rgba(255,255,255,.16); opacity: 1; }
.topbar nav .sep { opacity: .35; padding: 5px 2px; }
/* Administration: one dropdown at every width. On narrow screens app.js keeps
   the menu in fixed coordinates so the nav's row cannot clip it. */
.nav-admin { position: relative; display: block; }
.nav-admin > summary {
  display: flex; align-items: center; gap: 6px; cursor: pointer; list-style: none;
  color: var(--brand-ink); padding: 6px 11px; border-radius: 8px;
  font-size: 14.5px; line-height: 1.9; opacity: .88; white-space: nowrap;
}
.nav-admin > summary::-webkit-details-marker { display: none; }
.nav-admin > summary:hover { opacity: 1; background: rgba(255,255,255,.12); }
.nav-admin[open] > summary { background: rgba(255,255,255,.16); opacity: 1; }
.nav-admin.active > summary { background: rgba(255,255,255,.2); opacity: 1; font-weight: 600; }
.nav-admin .chev { font-size: 10px; line-height: 1; transition: transform .15s ease; }
.nav-admin[open] .chev { transform: rotate(180deg); }
.nav-admin .nav-menu {
  position: absolute; top: calc(100% + 8px); right: 0; z-index: 30;
  min-width: 200px; padding: 6px; display: flex; flex-direction: column; gap: 2px;
  background: var(--card); border: 1px solid var(--line); border-radius: 10px;
  box-shadow: 0 14px 34px rgba(2, 8, 23, .25);
}
.topbar nav .nav-menu a { color: var(--ink); opacity: 1; padding: 8px 10px; border-radius: 7px; font-size: 14px; line-height: 1.9; text-decoration: none; }
.topbar nav .nav-menu a:hover { background: var(--chip-bg); color: var(--ink); }
.topbar nav .nav-menu a.active { background: var(--chip-brand-bg); color: var(--link); font-weight: 600; }
.topbar .who { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.topbar .who form { margin: 0; }
.container { max-width: 1100px; margin: 22px auto; padding: 0 16px; }
.footer { text-align: center; color: var(--muted); font-size: 12.5px; padding: 26px 10px 34px; }
.card {
  background: var(--card); border: 1px solid var(--line); border-radius: 10px;
  padding: 18px 20px; margin-bottom: 18px;
}
.card h1, .card h2 { margin: 0 0 12px; font-size: 19px; }
.card h2 { font-size: 16px; }
.page-head { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.page-head h1 { margin: 0; font-size: 21px; }
/* Toolbar: tab pills with count badges. The page's primary action lives in the
   page head (top right), keeping this row to the tabs alone. */
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
.flash { padding: 10px 14px; border-radius: 8px; margin-bottom: 14px; }
.flash.ok { background: var(--ok-bg); color: var(--ok-ink); }
.flash.err { background: var(--err-bg); color: var(--err-ink); }
.flash.warn { background: var(--warn-bg); color: var(--warn-ink); }
table { width: 100%; border-collapse: collapse; background: var(--card); }
.tbl-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; background: var(--card); }
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
  display: inline-block; border: 1px solid transparent; border-radius: 8px; cursor: pointer;
  background: var(--brand); color: #fff; padding: 9px 16px; font-size: 14.5px;
  font-family: inherit; text-decoration: none;
  line-height: 1.35; min-height: 40px;
}
.btn:hover { filter: brightness(1.08); }
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
.topbar :focus-visible { outline-color: #fff; }
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
.head-picker.is-ready [data-head-search] { display: block; padding-right: 34px; }
.head-picker.is-ready select[data-head-select] { display: none; }
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
  border: 1px solid var(--line-strong); border-radius: 10px; box-shadow: var(--hover-shadow);
}
.head-list[hidden] { display: none; }
.head-option {
  display: block; width: 100%; padding: 8px 10px; border: 0; border-radius: 7px;
  background: transparent; color: var(--ink); font: inherit; text-align: left; cursor: pointer;
}
.head-option:hover, .head-option.active { background: var(--chip-brand-bg); }
.head-option.selected { font-weight: 600; }
.head-option[hidden] { display: none; }
.head-picker [data-head-search]::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; display: none; }
.head-empty { padding: 10px; color: var(--muted); font-size: 13px; }
.head-empty[hidden] { display: none; }
.member-avatar-head { display: inline-grid; place-items: center; width: 46px; height: 46px; margin-right: 10px; border-radius: 50%; overflow: hidden; vertical-align: middle; background: var(--chip-brand-bg); color: var(--brand); font-size: 20px; font-weight: 700; box-shadow: 0 0 0 1px var(--line); }
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
input[type=number], input[type=file], select, textarea {
  width: 100%; padding: 9px 10px; border: 1px solid var(--line); border-radius: 8px;
  font: inherit; background: var(--field-bg); color: var(--ink);
}
/* Uniform control height everywhere (forms + filters): Chromium sizes a bare
   select ~10px taller than a text input, and date inputs have their own
   intrinsic height, so fields in one .form-grid row end up uneven. A fixed
   height with vertical centering keeps inputs, selects and date pickers equal. */
input[type=text], input[type=search], input[type=password], input[type=date],
input[type=number], select {
  height: 40px; padding: 0 10px; box-sizing: border-box; vertical-align: middle;
}
input[type=file] { padding: 6px 10px; }
input[type=file]::file-selector-button {
  height: 28px; margin: 0 10px 0 0; padding: 0 10px; border: none; border-radius: 6px;
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
  border: 1px solid var(--line); border-radius: 16px; overflow: hidden;
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
  width: 32px; height: 32px; padding: 0; border: 0; border-radius: 7px;
  background: transparent; color: var(--muted); cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.pw-toggle:hover { background: var(--chip-bg); color: var(--ink); }
.pw-toggle svg { width: 17px; height: 17px; display: block; }
.pw-toggle .ico-eye-off { display: none; }
.pw-toggle[aria-pressed="true"] .ico-eye { display: none; }
.pw-toggle[aria-pressed="true"] .ico-eye-off { display: block; }
.caps-hint {
  display: block; margin-top: 6px; padding: 5px 9px; border-radius: 7px;
  background: var(--warn-bg); color: var(--warn-ink); font-size: 12px; font-weight: 600;
}
.caps-hint[hidden] { display: none; }
.auth-secure { display: flex; align-items: center; gap: 6px; margin: 18px 0 0; font-size: 12px; color: var(--muted); }
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
  .auth-mark { width: 68px; height: 68px; border-radius: 16px; }
  .auth-card { border-radius: 14px; }
}
/* ---------- dashboard / KPI stat cards ---------- */
.stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(158px, 1fr)); gap: 12px; }
/* ---------- member list column chooser ---------- */
.col-chooser { position: relative; display: inline-block; margin-bottom: 10px; }
.col-chooser summary { list-style: none; }
.col-chooser summary::-webkit-details-marker { display: none; }
.col-menu {
  position: absolute; z-index: 40; top: calc(100% + 6px); left: 0; min-width: 330px;
  background: var(--card); border: 1px solid var(--line); border-radius: 10px;
  padding: 10px 14px; display: grid; grid-template-columns: repeat(2, minmax(140px, 1fr));
  gap: 6px 16px; box-shadow: var(--hover-shadow);
}
.col-menu label { display: flex; align-items: center; gap: 7px; font-size: 13.5px; color: var(--ink); white-space: nowrap; cursor: pointer; }
.col-menu input { width: auto; }
.stat {
  background: var(--card); border: 1px solid var(--line); border-radius: 12px;
  padding: 14px 16px; display: flex; flex-direction: column; gap: 7px;
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
.stat .ico { width: 30px; height: 30px; border-radius: 8px; flex: none; display: inline-flex; align-items: center; justify-content: center; background: var(--chip-bg); color: var(--link); }
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
.modal-card { position: relative; background: var(--card); border-radius: 12px; width: min(720px, 100%); max-height: min(88dvh, 940px); display: flex; flex-direction: column; box-shadow: 0 24px 70px rgba(2,8,23,.35); }
.modal-card.sm { width: min(440px, 100%); }
.modal-card.md { width: min(620px, 100%); }
.modal-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 15px 20px; border-bottom: 1px solid var(--line); }
.modal-head h3 { margin: 0; font-size: 17px; }
.modal-x { background: none; border: 0; font-size: 24px; line-height: 1; cursor: pointer; color: var(--muted); padding: 2px 9px; border-radius: 8px; font-family: inherit; }
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
.form-section { margin: 0; padding: 0; border: 0; min-width: 0; }
.form-section + .form-section { margin-top: 2px; }
.form-section legend {
  padding: 0; margin-bottom: 8px; font-size: 13.5px;
  font-weight: 600; color: var(--ink);
}
.check-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(158px, 1fr)); gap: 8px; }
.check-chip {
  display: flex; align-items: center; gap: 8px; min-width: 0;
  padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px;
  background: var(--field-bg); color: var(--ink); font-size: 13.5px;
  line-height: 1.45; cursor: pointer;
  transition: border-color .12s ease, background-color .12s ease;
}
.check-chip:hover { border-color: var(--line-strong); background: var(--btn2-hover); }
.check-chip:has(input:checked) { border-color: var(--brand); background: var(--chip-brand-bg); }
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
  .card { padding: 14px; border-radius: 9px; }
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
  .modal { padding: 10px; align-items: stretch; }
  .modal-card { width: 100%; max-height: none; height: calc(100dvh - 20px); border-radius: 12px; }
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
  border-radius: 8px; border: 1px solid var(--line-strong); font-weight: 600;
  text-decoration: none; transition: top .15s ease;
}
.skip-link:focus { top: 12px; }

/* ---------- topbar ---------- */
.topbar { padding: 9px 18px; gap: 8px 14px; }
.topbar nav { gap: 2px; }
.topbar nav a { padding: 6px 11px; border-radius: 8px; font-size: 14.5px; line-height: 1.9; opacity: .88; }
.topbar nav a:hover { opacity: 1; background: rgba(255,255,255,.12); }
.topbar nav a.active { background: rgba(255,255,255,.2); opacity: 1; font-weight: 600; }
.topbar .who { gap: 10px; }
.topbar .who-link {
  color: var(--brand-ink); text-decoration: none; font-weight: 600;
  padding: 4px 7px; border-radius: 7px; max-width: 140px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.topbar .who-link:hover { background: rgba(255,255,255,.14); }
.topbar .who form .btn {
  background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.42);
  color: var(--brand-ink); min-height: 34px; padding: 5px 12px;
}
.topbar .who form .btn:hover { background: rgba(255,255,255,.24); filter: none; }
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
.card {
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(16,24,40,.04);
}
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
  padding: 12px 16px; margin: 0; border-radius: 12px;
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
    background: var(--card); border: 1px solid var(--line); border-radius: 12px;
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
  .kpi { padding: 13px 13px 12px; border-radius: 12px; }
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
.edit-diff { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; }
.edit-diff summary { cursor: pointer; font-weight: 600; font-size: 13.5px; }
.edit-pair { margin-top: 6px; }
.edit-pair .k { display: block; font-size: 11.5px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.edit-pair .report-body { font-size: 13.5px; }
/* Dashboard daily-report summary: three compact counters above the state table. */
.rep-sum { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 12px; }
.rep-sum > div { background: var(--chip-bg); border-radius: 10px; padding: 10px 12px; }
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
  width: 150px; max-width: 100%; height: 36px; padding: 0 30px 0 10px;
  font-size: 13.5px; border-radius: 9px;
}
.filter-toolbar input[type="search"] {
  width: 240px; max-width: 100%; height: 36px; padding: 0 10px;
  font-size: 13.5px; border-radius: 9px;
}
.filter-clear {
  padding: 6px 4px; font-size: 13px; color: var(--muted);
  text-decoration: none; white-space: nowrap;
}
.filter-clear:hover { color: var(--ink); text-decoration: underline; }
.quick-ranges { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; }
.quick-chip {
  display: inline-flex; align-items: center; min-height: 38px; padding: 6px 13px;
  border: 1px solid var(--line); border-radius: 999px; background: var(--card);
  color: var(--ink); font-size: 13.5px; font-weight: 600; text-decoration: none;
}
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
  .filter-toolbar { grid-template-columns: 1fr; }
}
.dash-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
.kpi {
  position: relative; overflow: hidden; background: var(--card);
  border: 1px solid var(--line); border-radius: 14px; padding: 15px 16px 14px;
  display: flex; flex-direction: column; gap: 8px; --accent: var(--link);
}
.kpi::before { content: ""; position: absolute; inset: 0 0 auto; height: 3px; background: var(--accent); opacity: .85; }
.kpi.ok { --accent: var(--ok-ink); }
.kpi.warn { --accent: var(--warn-ink); }
.kpi.err { --accent: var(--err-ink); }
.kpi .k-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.kpi .ico {
  width: 34px; height: 34px; border-radius: 10px; flex: none;
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
.kpi .k-num { font-size: 30px; font-weight: 700; line-height: 1.05; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.kpi .k-lbl { color: var(--muted); font-size: 13px; line-height: 1.4; }
.kpi .k-bar { height: 6px; border-radius: 999px; background: var(--track); overflow: hidden; margin-top: auto; }
.kpi .k-bar span { display: block; height: 100%; border-radius: 999px; background: var(--accent); }
/* hero (total) card */
.kpi.hero {
  --accent: #fff;
  border-color: transparent; color: #fff;
  background: linear-gradient(145deg, var(--brand) 0%, #14355f 100%);
  box-shadow: 0 8px 22px rgba(16, 40, 74, .22);
}
.kpi.hero::before { background: rgba(255,255,255,.55); }
.kpi.hero .ico { background: rgba(255,255,255,.18); color: #fff; }
.kpi.hero .k-pct { background: rgba(255,255,255,.18); color: #fff; font-weight: 500; }
.kpi.hero .k-lbl { color: rgba(255,255,255,.82); }
@media (prefers-reduced-motion: no-preference) {
  .kpi { transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease; }
  .kpi:hover { transform: translateY(-2px); border-color: var(--line-strong); box-shadow: var(--hover-shadow); }
  .kpi.hero:hover { box-shadow: 0 12px 26px rgba(16, 40, 74, .3); }
}

/* Paired cards share a row height: the region list and the gender panel line up
   as two equal-height panels. */
.dash-cols { display: grid; grid-template-columns: 1.55fr 1fr; gap: 14px; align-items: stretch; margin-bottom: 14px; }
.dash-card { margin: 0; padding: 16px 18px; border-radius: 14px; display: flex; flex-direction: column; min-width: 0; }
.dash-card .dc-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.dash-card .dc-head h2 { margin: 0; font-size: 15px; }
.dash-card .dc-head a { font-size: 12.5px; text-decoration: none; white-space: nowrap; }

/* ranked state/region list: the five busiest regions; /regions has the rest. */
.rank-list {
  list-style: none; margin: 0; padding: 0 6px 0 0; display: flex; flex-direction: column; gap: 11px;
}
.rank-list:focus-visible { outline: 2px solid var(--link); outline-offset: 4px; border-radius: 6px; }
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
.region-panel { padding: 16px 18px; border-radius: 14px; }
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
  padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px;
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
.dash-note .ico { width: 32px; height: 32px; border-radius: 9px; flex: none; display: inline-flex; align-items: center; justify-content: center; background: var(--chip-purple-bg); color: var(--chip-purple-ink); }
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
  border-radius: 12px; box-shadow: 0 18px 40px rgba(2, 8, 23, .2);
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
  border: 1px solid var(--line); border-radius: 10px; background: var(--card);
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
  background: var(--card); border: 1px solid var(--line); border-radius: 9px;
}
.hh-view-toggle button {
  display: inline-flex; align-items: center; gap: 5px; min-height: 30px;
  padding: 4px 9px; border: 0; border-radius: 6px;
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
.hh-grid.is-list .hh-avatar { width: 32px; height: 32px; border-radius: 9px; }
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
  background: var(--card); border: 1px solid var(--line); border-radius: 12px;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.hh-card:hover { border-color: var(--line-strong); box-shadow: var(--hover-shadow); }
.hh-card-head { display: flex; align-items: center; gap: 10px; min-width: 0; }
.hh-avatar {
  width: 38px; height: 38px; border-radius: 11px; flex: none; overflow: hidden;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--chip-brand-bg); color: var(--link); font-weight: 700;
}
.hh-avatar svg { width: 20px; height: 20px; display: block; }
.hh-avatar.sm { width: 32px; height: 32px; border-radius: 50%; font-size: 13px; }
.hh-avatar.lg { width: 52px; height: 52px; border-radius: 14px; margin: 0 auto 10px; }
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
  padding: 9px 11px; border: 1px solid var(--line); border-radius: 10px;
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
  border-radius: 8px; background: var(--row-alt, rgba(15,23,42,.025));
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
  border: 1px solid var(--line); border-radius: 10px; background: var(--row-alt, rgba(15,23,42,.025));
}
.org-lead a { color: var(--ink); font-weight: 600; text-decoration: none; overflow-wrap: anywhere; }
.org-lead a:hover { color: var(--link); text-decoration: underline; }
.org-lead-role { color: var(--muted); font-size: 11.5px; }
.org-lead.org-vacant { border-style: dashed; }
.org-departments { margin: 0 0 18px; }
.org-dept-grid { margin-top: 0; }
.org-dept-card { gap: 10px; }
.org-dept-card .org-card-head h3 { margin: 0; }
/* Position assignment modal: a compact identity summary followed by three
   clearly numbered role areas. */
.position-hero {
  display: flex; align-items: flex-start; gap: 11px; margin-bottom: 10px;
  padding: 12px 13px; border: 1px solid var(--line); border-radius: 11px;
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
.position-role-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
.position-role-chips .badge { font-size: 11.5px; }
.position-intro { margin: 0 0 12px; }
.position-section {
  margin: 0 0 11px; padding: 12px 13px;
  border: 1px solid var(--line); border-radius: 11px; background: var(--field-bg);
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
  padding: 9px 11px; border-radius: 8px;
  background: var(--warn-bg); color: var(--warn-ink); font-size: 12.5px; line-height: 1.6;
}
.position-notice p { margin: 0 0 8px; }
.position-notice .btn { background: var(--card); color: var(--ink); border: 1px solid var(--line); }
.dept-add { margin-bottom: 18px; padding: 18px 20px; }
.dept-add h2 { margin: 0 0 2px; }
.dept-list { display: grid; gap: 14px; }
.dept-row { padding: 16px 18px; }
.dept-row-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.dept-row-head h3 { margin: 0 0 2px; font-size: 16px; }
.dept-row-head p { margin: 0; }
.dept-roles { display: grid; gap: 4px; margin: 10px 0; }
.dept-roles > div { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.dept-roles dt { color: var(--muted); font-size: 12px; }
.dept-roles dd { margin: 0; font-size: 13px; font-weight: 600; text-align: right; overflow-wrap: anywhere; }
.dept-fields { gap: 10px 14px; }
.dept-active { display: flex; align-items: center; gap: 8px; align-self: end; min-height: 38px; font-size: 13px; }
.dept-active input { width: auto; }
.dept-inactive { opacity: .75; }
.dept-row .actions { margin-top: 12px; }
/* ---------- organization chart ---------- */
.org-chart { margin-bottom: 18px; padding: 22px 20px 26px; overflow: hidden; }
.org-chart-level { position: relative; display: flex; align-items: flex-start; justify-content: center; gap: 18px; flex-wrap: wrap; }
.org-chart-level-top { margin-top: 4px; }
.org-chart-connector { width: 2px; height: 24px; margin: 0 auto; background: var(--line); }
.org-chart-level-team { max-width: 780px; margin: 0 auto; padding-top: 22px; }
.org-chart-level-team::before {
  content: ""; position: absolute; top: 0; left: 16%; right: 16%; height: 2px; background: var(--line);
}
.org-chart-level-team .org-node::before {
  content: ""; position: absolute; top: -22px; left: 50%; width: 2px; height: 22px; background: var(--line);
}
.org-node {
  position: relative; display: flex; flex-direction: column; align-items: center; gap: 5px;
  width: 190px; min-width: 150px; padding: 10px 8px; text-align: center;
}
.org-node-lead { width: 240px; }
.org-node-role { color: var(--muted); font-size: 11px; font-weight: 600; letter-spacing: .03em; text-transform: uppercase; }
.org-node-name { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.org-node-name a { color: var(--ink); text-decoration: none; }
.org-node-name a:hover { color: var(--link); text-decoration: underline; }
.org-node-vacant { opacity: .82; }
.org-avatar {
  display: inline-grid; place-items: center; flex: none; border-radius: 50%; overflow: hidden;
  background: var(--chip-brand-bg); color: var(--brand); font-weight: 700;
  box-shadow: 0 0 0 2px var(--card), 0 0 0 4px var(--line);
}
.org-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.org-avatar.lg { width: 88px; height: 88px; font-size: 30px; }
.org-avatar.md { width: 62px; height: 62px; font-size: 22px; }
.org-avatar.sm { width: 38px; height: 38px; font-size: 14px; box-shadow: 0 0 0 1px var(--card), 0 0 0 2px var(--line); }
.org-avatar.vacant { color: var(--muted); background: var(--row-alt, rgba(15,23,42,.04)); }
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
  .org-node { width: calc(33.333% - 8px); min-width: 0; padding: 8px 4px; }
  .org-node-lead { width: 220px; }
  .org-avatar.lg { width: 76px; height: 76px; font-size: 26px; }
  .org-avatar.md { width: 54px; height: 54px; font-size: 19px; }
}
@media (max-width: 520px) {
  .org-chart-level-team { padding-top: 16px; }
  .org-chart-level-team::before,
  .org-chart-level-team .org-node::before { display: none; }
  .org-chart-level-team { display: grid; grid-template-columns: 1fr; gap: 4px; }
  .org-node { width: 100%; flex-direction: row; justify-content: flex-start; text-align: left; gap: 10px; }
  .org-node .org-avatar { order: 0; }
  .org-node .org-node-role { order: 1; }
  .org-node .org-node-name { order: 2; margin-left: auto; text-align: right; }
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
  .quick-chip { min-height: 44px; }
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
    border: 1px solid var(--line); border-radius: 12px;
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
    background: var(--card); border: 1px solid var(--line); border-radius: 12px;
  }
  .reports-tbl tr.empty-row td::before { display: none; }
  .empty-action { margin-top: 12px; }

  /* Keep form controls comfortable to tap. The action row stays in the normal
     flow: a sticky bar covered the Township/title fields while the long form
     was being filled on a phone. */
  .report-form input, .report-form select { min-height: 44px; }
  .report-form-actions {
    margin-top: 18px; padding: 10px; background: var(--card);
    border: 1px solid var(--line); border-radius: 12px;
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
  .quick-chip { padding: 6px 7px; font-size: 12px; }
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
  width: auto; height: auto; border-radius: 12px; background: var(--card);
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
`; // end of stylesheet
