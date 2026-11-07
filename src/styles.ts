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
.auth-wrap { max-width: 940px; margin: 5vh auto 0; }
.auth-card {
  display: grid; grid-template-columns: 1.05fr 1fr; background: var(--card);
  border: 1px solid var(--line); border-radius: 16px; overflow: hidden;
  box-shadow: 0 18px 44px rgba(16, 40, 74, .12);
}
.auth-aside {
  position: relative; overflow: hidden; color: #fff; padding: 34px 32px;
  display: flex; flex-direction: column; gap: 22px;
  background: linear-gradient(150deg, var(--brand) 0%, #14355f 72%, #0f2a4c 100%);
}
.auth-aside::after {
  content: ""; position: absolute; right: -70px; bottom: -90px; width: 260px; height: 260px;
  border-radius: 50%; background: rgba(255,255,255,.07); pointer-events: none;
}
.auth-mark { width: 60px; height: 60px; border-radius: 13px; background: #fff; padding: 4px; flex: none; box-shadow: 0 4px 14px rgba(0,0,0,.18); }
.auth-aside h1 { margin: 0; font-size: 26px; line-height: 1.25; letter-spacing: -.01em; }
.auth-lead { margin: 8px 0 0; color: rgba(255,255,255,.78); font-size: 13.5px; line-height: 1.55; }
.auth-points { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 11px; font-size: 13.5px; color: rgba(255,255,255,.92); position: relative; z-index: 1; }
.auth-points li { display: flex; align-items: flex-start; gap: 9px; }
.auth-points svg { width: 16px; height: 16px; flex: none; margin-top: 2px; color: #a9c9f0; }
.auth-main { padding: 34px 32px 30px; display: flex; flex-direction: column; }
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
  .auth-wrap { margin-top: 16px; }
  .auth-card { grid-template-columns: 1fr; }
  .auth-aside { padding: 22px; gap: 14px; }
  .auth-aside h1 { font-size: 21px; }
  .auth-points { display: none; }
  .auth-main { padding: 22px; }
}
@media (max-width: 420px) {
  .auth-main { padding: 18px; }
  .auth-aside { padding: 18px; }
  .auth-mark { width: 44px; height: 44px; border-radius: 10px; }
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
/* ---------- responsive: large desktop (≥1200px) ---------- */
@media (min-width: 1200px) {
  /* 1600px so the 14-column member list fits without horizontal scrolling.
     Breakpoint lowered from 1400px: common 1366px laptops were stuck with the
     1100px container and wide dead margins either side of the table. Cells
     tighten a little so all columns fit inside a 1366px viewport. */
  .container { max-width: 1600px; }
  .list-tbl th, .list-tbl td { padding: 8px 7px; font-size: 13.5px; }
  .list-tbl td:nth-child(2) { max-width: 210px; overflow: hidden; text-overflow: ellipsis; }
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
.topbar nav a { padding: 6px 11px; border-radius: 8px; font-size: 14.5px; opacity: .88; }
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

/* ---------- empty state ---------- */
td.empty-state { padding: 38px 16px; }
td.empty-state strong { font-size: 15px; color: var(--ink); }
td.empty-state .small { margin-top: 4px; }

/* ---------- dashboard: card layout ---------- */
.page-sub { margin: 2px 0 0; color: var(--muted); font-size: 13.5px; }
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

/* ranked state/region list: internally scrollable once there are many rows,
   so the card keeps a predictable height next to the gender card. */
.rank-list {
  list-style: none; margin: 0; padding: 0 6px 0 0; display: flex; flex-direction: column; gap: 11px;
  flex: 0 1 auto; min-height: 0; max-height: 200px; overflow-y: auto; scrollbar-width: thin;
  scrollbar-color: var(--line-strong) transparent;
}
.rank-list:focus-visible { outline: 2px solid var(--link); outline-offset: 4px; border-radius: 6px; }
.rank-list::-webkit-scrollbar { width: 8px; }
.rank-list::-webkit-scrollbar-track { background: transparent; }
.rank-list::-webkit-scrollbar-thumb { background: var(--line-strong); border-radius: 999px; }
.dc-foot {
  display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  margin-top: auto; padding-top: 12px; border-top: 1px solid var(--line);
  font-size: 12.5px; color: var(--muted);
}
.dc-foot b { color: var(--ink); font-variant-numeric: tabular-nums; }
.dc-scroll-hint { margin: 8px 0 0; font-size: 11.5px; color: var(--muted); }
.dc-coverage {
  margin-top: 14px; padding: 11px 12px; border: 1px solid var(--line);
  border-radius: 10px; background: var(--th-bg);
}
.dc-coverage .cov-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; font-size: 12px; color: var(--muted); }
.dc-coverage .cov-top b { color: var(--ink); font-variant-numeric: tabular-nums; }
.dc-coverage .cov-bar { height: 6px; border-radius: 999px; background: var(--track); overflow: hidden; margin: 7px 0 6px; }
.dc-coverage .cov-bar span { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--link), var(--brand)); }
.dc-coverage p { margin: 0; font-size: 11.5px; line-height: 1.5; color: var(--muted); }
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
  width: 32px; height: 32px; border-radius: 50%; flex: none;
  display: grid; place-items: center; font-size: 13px; font-weight: 700;
  background: var(--chip-brand-bg); color: var(--link);
}
.recent-list .rn { min-width: 0; display: flex; flex-direction: column; line-height: 1.4; }
.recent-list .rn a, .recent-list .rn > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

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
`; // end of stylesheet
