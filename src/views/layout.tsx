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
        <script>{`document.addEventListener("submit", function (e) {
            var f = e.target;
            if (f && f.getAttribute("data-confirm") && !window.confirm(f.getAttribute("data-confirm"))) {
              e.preventDefault();
            }
          });
          (function () {
            var links = document.querySelectorAll(".langswitch a");
            if (!links.length) return;
            var params = new URLSearchParams(window.location.search);
            links.forEach(function (a) {
              var to = a.getAttribute("href").replace("?", "").split("=")[1];
              params.set("lang", to);
              a.setAttribute("href", window.location.pathname + "?" + params.toString());
            });
          })();`}</script>
      </body>
    </html>
  );
}
