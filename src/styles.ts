/** Single-file stylesheet served at /styles.css (no bundler needed). */
export const CSS = `
:root {
  --bg: #f5f6fa; --card: #ffffff; --ink: #1c2333; --muted: #667085;
  --line: #e4e7ec; --brand: #1f4e8c; --brand-ink: #ffffff;
  --ok-bg: #e7f6ec; --ok-ink: #14683a; --err-bg: #fdecec; --err-ink: #a11b1b;
  --warn-bg: #fff4e0; --warn-ink: #8a5300;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--ink);
  font-family: "Noto Sans Myanmar", "Padauk", "Myanmar Text", "Segoe UI", system-ui, sans-serif;
  font-size: 15px; line-height: 1.6;
}
a { color: var(--brand); }
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
.flash { padding: 10px 14px; border-radius: 8px; margin-bottom: 14px; }
.flash.ok { background: var(--ok-bg); color: var(--ok-ink); }
.flash.err { background: var(--err-bg); color: var(--err-ink); }
.flash.warn { background: var(--warn-bg); color: var(--warn-ink); }
table { width: 100%; border-collapse: collapse; background: var(--card); }
.tbl-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; background: var(--card); }
th, td { text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--line); font-size: 14px; vertical-align: top; }
th { background: #f8f9fc; font-weight: 600; white-space: nowrap; }
tr:last-child td { border-bottom: 0; }
tbody tr:hover { background: #fafbfe; }
.muted { color: var(--muted); }
.small { font-size: 13px; }
.btn {
  display: inline-block; border: 0; border-radius: 8px; cursor: pointer;
  background: var(--brand); color: #fff; padding: 9px 16px; font-size: 14.5px;
  font-family: inherit; text-decoration: none;
}
.btn:hover { filter: brightness(1.08); }
.btn.secondary { background: #eef1f6; color: var(--ink); border: 1px solid var(--line); }
.btn.secondary:hover { filter: none; background: #e3e8f0; }
.btn.danger { background: #b42318; }
.btn.danger:hover { filter: brightness(1.1); }
.btn.sm { padding: 5px 10px; font-size: 13px; }
.btn.full { width: 100%; text-align: center; }
:focus-visible { outline: 2px solid #7aa7e0; outline-offset: 2px; }
.topbar :focus-visible { outline-color: #fff; }
.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px 18px; }
label.field { display: block; font-size: 13.5px; color: var(--muted); }
label.field span.lbl { display: block; margin-bottom: 4px; color: var(--ink); font-weight: 600; }
label.field .hint { font-weight: 400; color: var(--muted); }
input[type=text], input[type=password], input[type=date], input[type=number],
input[type=file], select, textarea {
  width: 100%; padding: 9px 10px; border: 1px solid var(--line); border-radius: 8px;
  font: inherit; background: #fff; color: var(--ink);
}
input:focus, select:focus, textarea:focus { outline: 2px solid #bcd2f0; border-color: var(--brand); }
textarea { min-height: 84px; resize: vertical; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; align-items: center; }
.filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; margin-bottom: 14px; }
.filters label.field { min-width: 150px; }
.badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 12.5px; background: #eef1f6; }
.badge.active { background: var(--ok-bg); color: var(--ok-ink); }
.badge.moved { background: var(--warn-bg); color: var(--warn-ink); }
.badge.inactive { background: var(--err-bg); color: var(--err-ink); }
.login-wrap { max-width: 400px; margin: 8vh auto 0; }
.login-logo { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 16px; text-align: center; }
.login-logo img { width: 84px; height: 84px; border-radius: 16px; background: #fff; border: 1px solid var(--line); padding: 6px; }
.login-logo .t1 { font-size: 19px; font-weight: 700; }
.login-logo .t2 { color: var(--muted); font-size: 13px; margin-top: 2px; }
.stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.stat { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; }
.stat .n { font-size: 26px; font-weight: 700; }
.stat .t { color: var(--muted); font-size: 13px; }
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
.modal-x:hover { background: #eef1f6; color: var(--ink); }
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
  .topbar nav { order: 3; flex-basis: 100%; flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .topbar nav a, .topbar nav .sep { white-space: nowrap; }
  .container { margin: 16px auto; }
  .form-grid { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
}
/* ---------- responsive: large desktop (≥1400px) ---------- */
@media (min-width: 1400px) {
  .container { max-width: 1240px; }
}
/* ---------- responsive: phones (≤640px) ---------- */
@media (max-width: 640px) {
  body { font-size: 14px; }
  .container { margin-top: 12px; padding: 0 10px; }
  .card { padding: 14px; border-radius: 9px; }
  .page-head h1 { font-size: 18px; }
  .page-head .actions { width: 100%; margin: 0; }
  .page-head .actions .btn { flex: 1 1 auto; text-align: center; }
  .filters { gap: 8px; }
  .filters label.field { flex: 1 1 46%; min-width: 0; }
  .filters .actions { width: 100%; margin-top: 2px; }
  .filters .actions .btn { flex: 1; }
  th, td { padding: 8px 10px; font-size: 13px; }
  table.list-tbl { min-width: 760px; }
  .tbl-wrap { -webkit-overflow-scrolling: touch; }
  .form-grid { grid-template-columns: 1fr; gap: 12px; }
  .btn { min-height: 40px; }
  .btn.sm { min-height: 34px; }
  .actions { gap: 8px; }
  .stat .n { font-size: 22px; }
  .modal { padding: 0; align-items: stretch; }
  .modal-card { width: 100%; max-height: none; height: 100dvh; border-radius: 0; }
  .modal-head { position: sticky; top: 0; background: var(--card); z-index: 2; }
}
@media (max-width: 400px) {
  .filters label.field { flex: 1 1 100%; }
}
`;
