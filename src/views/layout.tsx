import type { Permission } from "../rbac";

import { ASSET_V } from "../assets";
import type { SessionUser } from "../session";
import { getDict, type Lang } from "../i18n";
import { html } from "hono/html";

export type Flash = { kind: "ok" | "err" | "warn"; text: string } | null;

/** Idle auto-logout: after this many seconds of no clicks/keys/scroll the
 * browser posts /logout?auto=1 (public/app.js). Server-side, the session TTL
 * still caps total life. Do not make it tiny — 20 min default. */
const IDLE_TIMEOUT_SECONDS = Number(typeof process !== "undefined" && process.env?.IDLE_TIMEOUT_SECONDS) || 20 * 60;

type LayoutProps = {
  title: string;
  lang?: Lang;
  user?: SessionUser;
  perms?: Set<string>;
  active?: string;
  flash?: Flash;
  /** Extra class on <body>, e.g. the vertically centred login page. */
  bodyClass?: string;
  /** Replaces the whole footer line (login shows just the organisation name). */
  footerNote?: string;
  children?: any;
};

export function Layout({ title, lang, user, perms, active, flash, bodyClass, footerNote, children }: LayoutProps) {
  const L = lang ?? "en";
  const t = getDict(L);
  const PRIMARY_NAV: { href: string; label: string; perm: Permission }[] = [
    { href: "/", label: t("nav.dashboard"), perm: "dashboard.view" },
    { href: "/organization", label: t("nav.organization"), perm: "members.view" },
    { href: "/reports", label: t("nav.reports"), perm: "reports.view" },
  ];
  // People records sit under one "Members" heading: the list, households and
  // the pastor directory (each gated by its own permission).
  const MEMBER_NAV: { href: string; label: string; perm: Permission[] }[] = [
    { href: "/members", label: t("nav.members"), perm: ["members.view"] },
    { href: "/admin/households", label: t("nav.households"), perm: ["members.view"] },
    { href: "/organization/pastors", label: t("nav.pastors"), perm: ["pastors.view", "pastors.manage"] },
  ];
  const ADMIN_NAV: { href: string; label: string; perm: Permission; section?: string }[] = [
    { href: "/members/import", label: t("nav.import"), perm: "members.import" },
    { href: "/admin/users", label: t("nav.users"), perm: "users.manage" },
    { href: "/admin/roles", label: t("nav.roles"), perm: "roles.manage" },
    { href: "/admin/options", label: t("nav.options"), perm: "options.manage" },
    { href: "/admin/audit", label: t("nav.audit"), perm: "audit.view" },
    { href: "/organization/positions", label: t("nav.positions"), perm: "options.manage", section: "structure" },
    { href: "/organization/departments", label: t("nav.departments"), perm: "options.manage", section: "structure" },
    { href: "/organization/regional-churches", label: t("nav.regionalChurches"), perm: "options.manage", section: "structure" },
    { href: "/organization/clusters", label: t("nav.clusters"), perm: "options.manage", section: "structure" },
    { href: "/organization/vacancies", label: t("vacancy.link"), perm: "members.view", section: "structure" },
  ];
  const allowed = (n: { perm: Permission }) => !perms || perms.has(n.perm);
  const allowedAny = (n: { perm: Permission[] }) => !perms || n.perm.some((p) => perms.has(p));
  const primaryItems = PRIMARY_NAV.filter(allowed);
  const memberItems = MEMBER_NAV.filter(allowedAny);
  const adminItems = ADMIN_NAV.filter(allowed);
  const memberActive = memberItems.some((n) => n.href === active);
  const adminActive = adminItems.some((n) => n.href === active);
  return (
    <html lang={L === "mm" ? "my" : L === "kr" ? "ko" : "en"}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="dark light" />
        <meta name="theme-color" content="#172554" />
        <title>
          {title} — {t("app.name")}
        </title>
        <link rel="icon" type="image/png" href="/logo.png" />
        <link rel="stylesheet" href={`/styles.css?v=${ASSET_V}`} />
        <script>
          {/* Raw JS (no double quotes / &-entities) so Hono's HTML escaper cannot
              rewrite it — inside <script>, `&quot;` is a literal SyntaxError. */}
          {html`try{var t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){}`}
        </script>
        <script src={`/app.js?v=${ASSET_V}`} defer></script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Myanmar:wght@400;600;700&family=Noto+Sans+KR:wght@400;500;600;700&display=swap" />
      </head>
      <body class={bodyClass} data-idle-seconds={String(IDLE_TIMEOUT_SECONDS)}>
        <a class="skip-link" href="#main">{t("nav.skip")}</a>
        <header class="topbar">
          <a class="brand" href="/" aria-label={t("app.name")}>
            <img src="/logo.png" alt="" />
            <span class="brand-name">{t("app.name")}</span>
          </a>
          {user && (
            <nav aria-label={t("nav.main")}>
              {primaryItems.map((n, i) => (
                <>
                  <a
                    href={n.href}
                    class={active === n.href ? "active" : ""}
                    aria-current={active === n.href ? "page" : undefined}
                  >
                    {n.label}
                  </a>
                  {/* People records sit right after Dashboard. */}
                  {i === 0 && memberItems.length > 0 && (
                    <details class={`nav-admin${memberActive ? " active" : ""}`}>
                      <summary aria-current={memberActive ? "page" : undefined}>
                        {t("nav.memberGroup")} <span class="chev" aria-hidden="true">▾</span>
                      </summary>
                      <div class="nav-menu">
                        {memberItems.map((n2) => (
                          <a
                            href={n2.href}
                            class={active === n2.href ? "active" : ""}
                            aria-current={active === n2.href ? "page" : undefined}
                          >
                            {n2.label}
                          </a>
                        ))}
                      </div>
                    </details>
                  )}
                </>
              ))}
              {adminItems.length > 0 && (
                <>
                  {/* One Administration dropdown at every width. */}
                  <details class={`nav-admin${adminActive ? " active" : ""}`}>
                    <summary aria-current={adminActive ? "page" : undefined}>
                      {t("nav.admin")} <span class="chev" aria-hidden="true">▾</span>
                    </summary>
                    <div class="nav-menu">
                      {adminItems.map((n, i) => (
                        <>
                          {n.section === "structure" && adminItems[i - 1]?.section !== "structure" && (
                            <span class="nav-menu-label">{t("nav.structureSettings")}</span>
                          )}
                          <a
                            href={n.href}
                            class={active === n.href ? "active" : ""}
                            aria-current={active === n.href ? "page" : undefined}
                          >
                            {n.label}
                          </a>
                        </>
                      ))}
                    </div>
                  </details>
                </>
              )}
            </nav>
          )}
          <div class="who">
            <button
              class="theme-toggle"
              type="button"
              title={t("nav.theme")}
              aria-label={t("nav.theme")}
              data-to-dark={t("nav.themeDark")}
              data-to-light={t("nav.themeLight")}
            >
              <svg class="ico-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
              <svg class="ico-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            </button>
            <span class="langswitch" title={t("nav.language")}>
              <a href="?lang=mm" class={L === "mm" ? "on" : ""} lang="my">MM</a>
              <a href="?lang=en" class={L === "en" ? "on" : ""} lang="en">EN</a>
              <a href="?lang=kr" class={L === "kr" ? "on" : ""} lang="ko">KR</a>
            </span>
            {user && (
              <>
                <a class="who-link" href="/profile" title={t("nav.profile")}>{user.username}</a>
                <form method="post" action="/logout">
                  <button class="btn sm secondary" type="submit">{t("nav.logout")}</button>
                </form>
              </>
            )}
          </div>
        </header>
        <main class="container" id="main">
          {flash && <div class={`flash ${flash.kind}`} role="status">{flash.text}</div>}
          {children}
        </main>
        <footer class="footer">{footerNote ?? `${t("app.name")} — ${t("app.tagline")}`}</footer>
        <div
          id="app-modal"
          class="modal"
          hidden
          data-confirm-title={t("modal.confirmTitle")}
          data-yes={t("modal.confirmYes")}
          data-cancel={t("form.cancel")}
          data-loading={t("modal.loading")}
        >
          <div class="modal-backdrop" data-close="1"></div>
          <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="app-modal-title">
            <div class="modal-head">
              <h3 id="app-modal-title"></h3>
              <button class="modal-x" type="button" data-close="1" aria-label={t("modal.close")}>×</button>
            </div>
            <div class="modal-body" id="app-modal-body"></div>
          </div>
        </div>
      </body>
    </html>
  );
}
