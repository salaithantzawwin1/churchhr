/* Client-side enhancements: language switch links, edit-in-modal, delete confirm modal. */
(function () {
  // Preserve current query params on language switch links
  var links = document.querySelectorAll(".langswitch a");
  if (links.length) {
    var params = new URLSearchParams(window.location.search);
    links.forEach(function (a) {
      var to = a.getAttribute("href").replace("?", "").split("=")[1];
      params.set("lang", to);
      a.setAttribute("href", window.location.pathname + "?" + params.toString());
    });
  }

  var modal = document.getElementById("app-modal");
  if (!modal) return;
  var card = modal.querySelector(".modal-card");
  var titleEl = document.getElementById("app-modal-title");
  var bodyEl = document.getElementById("app-modal-body");
  var lastFocus = null;
  var pendingForm = null;

  function openModal(title, small) {
    lastFocus = document.activeElement;
    titleEl.textContent = title || "";
    card.classList.toggle("sm", !!small);
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    modal.hidden = true;
    bodyEl.innerHTML = "";
    pendingForm = null;
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }
  modal.addEventListener("click", function (e) {
    var el = e.target;
    if (el && el.closest && el.closest("[data-close]")) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });

  function flashUrl(key) {
    var u = new URL(location.href);
    u.searchParams.delete("err");
    u.searchParams.set("ok", key);
    return u.toString();
  }

  // Delete confirm modal (replaces window.confirm for data-confirm forms)
  document.addEventListener("submit", function (e) {
    var f = e.target;
    if (!f || !f.getAttribute || !f.getAttribute("data-confirm")) return;
    e.preventDefault();
    pendingForm = f;
    openModal(modal.getAttribute("data-confirm-title") || "", true);
    bodyEl.innerHTML =
      '<p style="margin:0 0 4px">' + f.getAttribute("data-confirm") + "</p>" +
      '<div class="actions" style="margin-top:14px">' +
      '<button type="button" class="btn danger" data-confirm-yes="1">' + (modal.getAttribute("data-yes") || "OK") + "</button>" +
      '<button type="button" class="btn secondary" data-close="1">' + (modal.getAttribute("data-cancel") || "Cancel") + "</button>" +
      "</div>";
  });

  function setModalHtml(doc) {
    bodyEl.innerHTML = "";
    Array.prototype.forEach.call(doc.body.children, function (n) {
      bodyEl.appendChild(document.importNode(n, true));
    });
  }

  // Edit-in-modal: any link with class js-edit-modal
  document.addEventListener("click", function (e) {
    var link = e.target && e.target.closest ? e.target.closest("a.js-edit-modal") : null;
    if (!link) return;
    e.preventDefault();
    var href = link.getAttribute("href");
    if (!href) return;
    var url = href + (href.indexOf("?") > -1 ? "&" : "?") + "modal=1";
    openModal(link.getAttribute("data-modal-title") || "", false);
    bodyEl.innerHTML = '<p class="muted">' + (modal.getAttribute("data-loading") || "…") + "</p>";
    fetch(url, { headers: { "X-Requested-With": "modal" } })
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        if (!doc.querySelector("form")) throw new Error("no form");
        setModalHtml(doc);
        var first = bodyEl.querySelector("input:not([type=hidden]), select, textarea");
        if (first) first.focus();
      })
      .catch(function () { location.href = href; });
  });

  // Confirm button inside the delete modal
  bodyEl.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("[data-confirm-yes]") : null;
    if (!b || !pendingForm) return;
    var f = pendingForm;
    pendingForm = null;
    f.submit();
  });

  // Submit the edit form inside the modal via fetch
  bodyEl.addEventListener("submit", function (e) {
    var form = e.target;
    if (!form || form.tagName !== "FORM") return;
    e.preventDefault();
    var btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    fetch(form.getAttribute("action") || location.href, {
      method: "POST",
      body: new FormData(form),
      headers: { "X-Requested-With": "modal" },
    })
      .then(function (r) {
        if (r.ok) {
          location.assign(flashUrl(form.getAttribute("data-flash-ok") || "member-updated"));
          return;
        }
        return r.text().then(function (html) {
          var doc = new DOMParser().parseFromString(html, "text/html");
          if (doc.querySelector("form")) {
            setModalHtml(doc);
            var first = bodyEl.querySelector("input:not([type=hidden]), select, textarea");
            if (first) first.focus();
          } else bodyEl.textContent = "Error";
        });
      })
      .catch(function () { form.submit(); });
  });
})();
