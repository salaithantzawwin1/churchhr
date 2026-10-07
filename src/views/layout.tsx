import type { Permission } from "../rbac";
import type { SessionUser } from "../session";
import { getDict, type Lang } from "../i18n";

export type Flash = { kind: "ok" | "err" | "warn"; text: string } | null;

type LayoutProps = {
  title: string;
  lang?: Lang;
  user?: SessionUser;
  perms?: Set<string>;
  active?: string;
  flash?: Flash;
  children?: any;
};

export function Layout({ title, lang, user, perms, active, flash, children }: LayoutProps) {
  const L = lang ?? "mm";
  const t = getDict(L);
  const NAV: { href: string; label: string; perm: Permission }[] = [
    { href: "/", label: t("nav.dashboard"), perm: "dashboard.view" },
    { href: "/members", label: t("nav.members"), perm: "members.view" },
    { href: "/members/import", label: t("nav.import"), perm: "members.import" },
    { href: "/admin/users", label: t("nav.users"), perm: "users.manage" },
    { href: "/admin/roles", label: t("nav.roles"), perm: "roles.manage" },
    { href: "/admin/options", label: t("nav.options"), perm: "options.manage" },
  ];
  const items = NAV.filter((n) => !perms || perms.has(n.perm));
  return (
    <html lang={L === "mm" ? "my" : "en"}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>
          {title} — Church Member Registry
        </title>
        <link rel="icon" type="image/png" href="/logo.png" />
        <link rel="stylesheet" href="/styles.css" />
        <script>
          {`try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}`}
        </script>
        <script src="/app.js" defer></script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Myanmar:wght@400;600;700&display=swap" />
      </head>
      <body>
        <header class="topbar">
          <a class="brand" href="/">
            <img src="/logo.png" alt="" />
            {t("app.name")}
          </a>
          {user && (
            <nav>
              {items.map((n, i) => (
                <>
                  {i > 0 && <span class="sep">|</span>}
                  <a href={n.href} class={active === n.href ? "active" : ""}>
                    {n.label}
                  </a>
                </>
              ))}
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
              <a href="?lang=mm" class={L === "mm" ? "on" : ""}>MM</a>
              <a href="?lang=en" class={L === "en" ? "on" : ""}>ENG</a>
            </span>
            {user && (
              <>
                <a href="/profile" style="color:#fff">{user.username}</a>
                <form method="post" action="/logout">
                  <button class="btn sm secondary" type="submit">{t("nav.logout")}</button>
                </form>
              </>
            )}
          </div>
        </header>
        <main class="container">
          {flash && <div class={`flash ${flash.kind}`}>{flash.text}</div>}
          {children}
        </main>
        <footer class="footer">{t("app.name")} — {t("app.tagline")}</footer>
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
