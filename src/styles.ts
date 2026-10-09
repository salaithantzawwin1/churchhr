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
  font-family: "Noto Sans Myanmar", "Padauk", "Myanmar Text", "Segoe UI", system-ui, sans-serif;
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
label.field { display: block; font-size: 13.5px; color: var(--muted); }
label.field span.lbl { display: block; margin-bottom: 4px; color: var(--ink); font-weight: 600; }
label.field .hint { font-weight: 400; color: var(--muted); }
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
.login-wrap { max-width: 400px; margin: 8vh auto 0; }
.login-logo { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 16px; text-align: center; }
.login-logo img { width: 84px; height: 84px; border-radius: 16px; background: #fff; border: 1px solid var(--line); padding: 6px; }
.login-logo .t1 { font-size: 19px; font-weight: 700; }
.login-logo .t2 { color: var(--muted); font-size: 13px; margin-top: 2px; }
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
.modal-card { position: relative; background: var(--card); border-radius: 12px; width: min(760px, 100%); max-height: min(88dvh, 940px); display: flex; flex-direction: column; box-shadow: 0 24px 70px rgba(2,8,23,.35); }
.modal-card.sm { width: min(440px, 100%); }
.modal-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 13px 18px; border-bottom: 1px solid var(--line); }
.modal-head h3 { margin: 0; font-size: 16.5px; }
.modal-x { background: none; border: 0; font-size: 24px; line-height: 1; cursor: pointer; color: var(--muted); padding: 2px 9px; border-radius: 8px; font-family: inherit; }
.modal-x:hover { background: var(--chip-bg); color: var(--ink); }
.modal-body { padding: 16px 18px 16px; overflow-y: auto; }
.modal-body .card { margin-bottom: 14px; }
.modal-body .actions { position: sticky; bottom: -16px; margin: 14px -18px -16px; padding: 12px 18px; background: var(--card); border-top: 1px solid var(--line); }
@media (prefers-reduced-motion: no-preference) {
  .modal-card { animation: modalIn .16s ease-out; }
  @keyframes modalIn { from { transform: translateY(10px); opacity: .55; } }
}
/* ---------- responsive: small laptop / tablet (≤900px) ---------- */
@media (max-width: 900px) {
  .topbar { padding: 8px 12px; gap: 8px 10px; }
  .topbar .brand { font-size: 14.5px; }
  .topbar .brand img { width: 28px; height: 28px; }
  .topbar nav { order: 3; flex-basis: 100%; flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch;
    scrollbar-width: none; }
  .topbar nav::-webkit-scrollbar { display: none; }
  .topbar nav a, .topbar nav .sep { white-space: nowrap; }
  .container { margin: 16px auto; }
  .form-grid { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
}
/* ---------- responsive: large desktop (≥1400px) ---------- */
@media (min-width: 1400px) {
  /* 1600px so the 14-column member list fits without horizontal scrolling. */
  .container { max-width: 1600px; }
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
     name one syllable per line is unreadable. (Wide-table nowrap now lives in
     the base .list-tbl rules; only the name column needs a floor here.) */
  .tbl-wrap td:not(.empty-state) { white-space: nowrap; }
  .tbl-wrap td.cell-wrap { white-space: normal; }
  .tbl-wrap td:nth-child(2) { min-width: 130px; }
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
`;
