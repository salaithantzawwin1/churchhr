/* Client-side enhancements: theme toggle, language switch links, password strength meter, edit-in-modal, delete confirm modal. */
(function () {
  // Password strength meter — attaches to any input[data-strength]. Scores
  // length + character classes + penalties for repeats/common sequences and
  // renders a 4-bar meter with a label from the input's data-labels attribute.
  var COMMON_CHUNKS = ["password", "123456", "qwerty", "abc123", "letmein", "admin", "welcome", "church", "password1", "iloveyou", "sunshine", "princess", "football", "monkey", "dragon"];
  function scorePassword(v) {
    if (!v) return { score: -1, ratio: 0, label: null, cls: "" };
    var score = 0;
    if (v.length >= 8) score++;
    if (v.length >= 12) score++;
    var classes = 0;
    if (/[a-z]/.test(v)) classes++;
    if (/[A-Z]/.test(v)) classes++;
    if (/[0-9]/.test(v)) classes++;
    if (/[^A-Za-z0-9]/.test(v)) classes++;
    score += classes >= 3 ? 1 : 0;          // variety bonus
    if (classes === 1 && v.length < 20) score = Math.max(0, score - 1); // single class is weak
    var lower = v.toLowerCase();
    for (var i = 0; i < COMMON_CHUNKS.length; i++) {
      if (lower.indexOf(COMMON_CHUNKS[i]) !== -1) { score = 0; break; }
    }
    if (/^(.)\\1+$/.test(v)) score = 0;      // all same char
    if (/(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|asdf|zxcv)/.test(lower)) score = Math.min(score, 1);
    score = Math.max(0, Math.min(4, score));  // 0..4 -> 4 bars (3 filled max)
    var bars = Math.max(1, Math.min(4, score));
    return { score: score, ratio: bars / 4, label: null, cls: "s" + bars };
  }
  function attachStrength(input) {
    var wrap = input.closest(".field") || input.parentNode;
    var meter = document.createElement("div");
    meter.className = "pw-strength";
    var labels = [];
    var raw = input.getAttribute("data-labels") || "";
    try { labels = JSON.parse(raw); } catch (e) { labels = raw ? raw.split(",") : []; }
    meter.innerHTML = '<div class="pw-bars"><span></span><span></span><span></span><span></span></div>' +
      '<span class="pw-label"></span>';
    wrap.appendChild(meter);
    var labelsEl = meter.querySelector(".pw-label");
    function update() {
      var r = scorePassword(input.value);
      meter.className = "pw-strength" + (r.cls ? " " + r.cls : "");
      var txt = input.value ? (labels[r.score] || "") : "";
      labelsEl.textContent = txt;
    }
    input.addEventListener("input", update);
    update();
  }
  function initStrengthMeters(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll("input[data-strength]"), attachStrength);
  }
  initStrengthMeters(document);

  // Password visibility toggle (login form): flips the input type and keeps
  // the button's label/pressed state in sync for screen readers.
  // Administration dropdown: close it on outside click or Escape, so it does
  // not stay open while the page is used elsewhere.
  (function initAdminMenus() {
    var menus = Array.prototype.slice.call(document.querySelectorAll("details.nav-admin"));
    if (!menus.length) return;
    document.addEventListener("click", function (e) {
      menus.forEach(function (d) {
        if (d.open && !d.contains(e.target)) d.open = false;
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      menus.forEach(function (d) {
        if (!d.open) return;
        d.open = false;
        var summary = d.querySelector("summary");
        if (summary) summary.focus();
      });
    });
  })();

  // Caps Lock warning under password fields. The browser only exposes the
  // Caps Lock state on keyboard events, so sync it while typing and hide it
  // again when the field loses focus.
  (function initCapsLockHints() {
    function sync(e) {
      var input = e.target;
      if (!input || input.tagName !== "INPUT" || !input.closest(".pw-wrap")) return;
      var on = false;
      try { on = !!(e.getModifierState && e.getModifierState("CapsLock")); } catch (err) { on = false; }
      var field = input.closest(".field") || input.parentNode;
      var hint = field && field.querySelector(".caps-hint");
      if (hint) hint.hidden = !on;
    }
    document.addEventListener("keydown", sync, true);
    document.addEventListener("keyup", sync, true);
    document.addEventListener("focusout", function (e) {
      var input = e.target;
      if (!input || input.tagName !== "INPUT" || !input.closest(".pw-wrap")) return;
      var field = input.closest(".field") || input.parentNode;
      var hint = field && field.querySelector(".caps-hint");
      if (hint) hint.hidden = true;
    }, true);
  })();

  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest ? e.target.closest("[data-pw-toggle]") : null;
    if (!btn) return;
    var wrap = btn.closest(".pw-wrap");
    var input = wrap && wrap.querySelector("input");
    if (!input) return;
    var show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.setAttribute("aria-pressed", show ? "true" : "false");
    var label = btn.getAttribute(show ? "data-label-hide" : "data-label-show");
    if (label) btn.setAttribute("aria-label", label);
    input.focus();
  });

  // Members list bulk actions: checkboxes fill the hidden ids field and show
  // the floating bulk bar; the header checkbox toggles the page.
  (function initBulkBar() {
    var form = document.getElementById("bulk-form");
    if (!form) return;
    var idsField = document.getElementById("bulk-ids");
    var bar = document.getElementById("bulk-bar");
    var countEl = document.getElementById("bulk-count");
    var checkAll = document.getElementById("bulk-check-all");
    var boxes = Array.prototype.slice.call(document.querySelectorAll("input.bulk-check"));
    function sync() {
      var sel = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
      if (idsField) idsField.value = sel.join(",");
      if (bar) bar.style.display = sel.length ? "flex" : "none";
      if (countEl) {
        var tpl = (bar && bar.getAttribute("data-selected-label")) || "{{n}} selected";
        countEl.textContent = tpl.replace("{{n}}", sel.length);
      }
      if (checkAll && boxes.length) checkAll.checked = sel.length === boxes.length;
    }
    boxes.forEach(function (b) { b.addEventListener("change", sync); });
    var clearBtn = form.querySelector("[data-bulk-clear]");
    if (clearBtn) clearBtn.addEventListener("click", function () {
      boxes.forEach(function (b) { b.checked = false; });
      sync();
    });
    if (checkAll) checkAll.addEventListener("change", function () {
      boxes.forEach(function (b) { b.checked = checkAll.checked; });
      sync();
    });
    sync();
  })();

  // Idle auto-logout — after data-idle-seconds without any user activity
  // (click/key/scroll) anywhere, redirect to /logout?auto=1. The server also
  // caps the session, so a stale client cannot outlive the real timeout.
  // Deliberately NOT listening to mousemove: sub-pixel jitter from a resting
  // mouse or an idle driver keeps resetting the timer forever, so the tab
  // never logs out. Only deliberate input (click/key/touch/scroll/wheel)
  // counts as activity. While the tab is hidden the countdown is paused and
  // resumed/checked on return, since browsers throttle background timers.
  (function initIdleLogout() {
    var secs = parseInt(document.body.getAttribute("data-idle-seconds") || "0", 10);
    if (!secs || secs < 30) return;
    var last = Date.now();
    var timer = null;
    function logout() {
      timer = null;
      location.assign("/logout?auto=1");
    }
    function arm() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(logout, secs * 1000);
    }
    function activity() {
      last = Date.now();
      if (!document.hidden) arm();
    }
    if (typeof document.addEventListener === "function") {
      ["click", "keydown", "scroll", "wheel", "touchstart"].forEach(function (evt) {
        document.addEventListener(evt, activity, { passive: true });
      });
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) {
          // Just came back: any activity before the idle window closed resets it.
          if (Date.now() - last < secs * 1000) arm();
          else location.assign("/logout?auto=1");
        }
      });
    }
    arm();
  })();

  // Manual dark/light toggle — persists the explicit choice; without one the
  // CSS media query follows the OS preference.
  var themeBtn = document.querySelector(".theme-toggle");
  if (themeBtn) {
    var t = null;
    try { t = localStorage.getItem("theme"); } catch (e) {}
    var eff = t === "dark" || t === "light"
      ? t
      : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    var title = themeBtn.getAttribute(eff === "dark" ? "data-to-light" : "data-to-dark");
    if (title) themeBtn.setAttribute("title", title);
    themeBtn.addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme") || eff;
      var next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      var nt = themeBtn.getAttribute(next === "dark" ? "data-to-light" : "data-to-dark");
      if (nt) themeBtn.setAttribute("title", nt);
      try { localStorage.setItem("theme", next); } catch (e) {}
    });
  }

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

  // State/Region cascade: Township / Home Cell / Group dropdowns only show
  // options that belong to the selected state (no data-region = all states).
  // Chained pickers (data-parent-filter) additionally narrow by the selected
  // parent option: Home Cell under Township, Family Group under Home Cell.
  function applyRegionFilters(form, keepSelection) {
    var regionSel = form.querySelector("select[data-region-select]");
    if (!regionSel) return;
    var region = regionSel.value;
    var filtered = form.querySelectorAll("select[data-region-filter]");
    Array.prototype.forEach.call(filtered, function (sel) {
      var current = sel.value;
      var matched = false;
      Array.prototype.forEach.call(sel.options, function (o) {
        if (!o.value) return; // blank "choose" option always stays
        var r = o.getAttribute("data-region");
        // On load, keep the saved selection visible even if its region differs;
        // on a state change, hide it so the value gets reset below.
        var show = !r || !region || r === region || (o.value === current && !keepSelection);
        o.hidden = !show;
        if (show && o.value === current) matched = true;
      });
      // Reset a selection that no longer belongs to the chosen state.
      if (keepSelection && current && !matched) sel.value = "";
    });
    applyParentFilters(form, keepSelection);
  }

  /** Narrow data-parent-filter selects by the currently visible parent selection,
   * while respecting the state filter so region-hidden options stay hidden. */
  function applyParentFilters(form, keepSelection) {
    var regionSel = form.querySelector("select[data-region-select]");
    var region = regionSel ? regionSel.value : "";
    Array.prototype.forEach.call(form.querySelectorAll("select[data-parent-filter]"), function (sel) {
      var parentType = sel.getAttribute("data-parent-filter");
      var parentSel = form.querySelector('select[name="' + parentType + '"]');
      var parentId = parentSel ? parentSel.value : "";
      var current = sel.value;
      var matched = false;
      Array.prototype.forEach.call(sel.options, function (o) {
        if (!o.value) return;
        var p = o.getAttribute("data-parent");
        var r = o.getAttribute("data-region");
        // State filter: data-region="" = all states. Parent filter: data-parent=""
        // = unassigned -> always visible; otherwise matches the picked parent.
        var regionOk = !r || !region || r === region;
        var parentOk = !p || !parentId || p === parentId;
        var show = regionOk && parentOk;
        o.hidden = !show;
        if (show && o.value === current) matched = true;
      });
      if (keepSelection && current && !matched) sel.value = "";
    });
  }

  function initRegionCascade(root) {
    Array.prototype.forEach.call(root.querySelectorAll("select[data-region-select]"), function (regionSel) {
      var form = regionSel.form;
      if (!form || form.getAttribute("data-cascade")) return;
      form.setAttribute("data-cascade", "1");
      applyRegionFilters(form, false);
      regionSel.addEventListener("change", function () { applyRegionFilters(form, true); });
      // Chained pickers re-filter when their parent changes.
      var township = form.querySelector('select[name="township"]');
      if (township) township.addEventListener("change", function () { applyParentFilters(form, true); });
      var cell = form.querySelector('select[name="home_cell_id"]');
      if (cell) cell.addEventListener("change", function () { applyParentFilters(form, true); });
    });
  }
  initRegionCascade(document);

  // Household head picker: using an existing member as head copies that
  // member's placement (state, township, home cell, group, family group)
  // into the new household form. The server repeats this fallback on submit.
  function initHeadPicker(root) {
    Array.prototype.forEach.call(root.querySelectorAll('select[name="head_member_id"]'), function (sel) {
      if (sel.getAttribute("data-head-bound")) return;
      sel.setAttribute("data-head-bound", "1");
      sel.addEventListener("change", function () {
        var opt = sel.options[sel.selectedIndex];
        var form = sel.form;
        if (!opt || !opt.value || !form) return;
        function pick(name, attr) {
          var el = form.querySelector('select[name="' + name + '"]');
          var val = opt.getAttribute(attr);
          if (!el || !val) return;
          el.value = val;
          // Re-run the cascades so dependent options become visible.
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
        pick("region_id", "data-region");
        pick("township", "data-township");
        pick("home_cell_id", "data-home-cell");
        pick("group_id", "data-group");
        pick("family_group_id", "data-family-group");
      });
    });
  }
  initHeadPicker(document);

  // Member list column chooser: each checkbox shows/hides the matching th+td
  // (data-col) and the choice persists in localStorage so it survives reloads.
  (function initColChooser() {
    var table = document.querySelector("table.list-tbl");
    var chooser = document.querySelector(".col-chooser");
    if (!table || !chooser) return;
    var KEY = "member-cols";
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) {}
    var boxes = chooser.querySelectorAll("input[data-col]");
    function apply() {
      var off = {};
      Array.prototype.forEach.call(boxes, function (b) {
        off[b.getAttribute("data-col")] = !b.checked;
      });
      Array.prototype.forEach.call(table.querySelectorAll("[data-col]"), function (cell) {
        cell.style.display = off[cell.getAttribute("data-col")] ? "none" : "";
      });
      var st = {};
      Array.prototype.forEach.call(boxes, function (b) {
        st[b.getAttribute("data-col")] = b.checked;
      });
      try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
    }
    Array.prototype.forEach.call(boxes, function (b) {
      var k = b.getAttribute("data-col");
      // Restore the saved choice when there is one; otherwise the markup default
      // (everything except ID visible) applies.
      b.checked = saved[k] === undefined ? k !== "id" : !!saved[k];
      b.addEventListener("change", apply);
    });
    apply();
    // Match the rest of the page: clicking outside a popover dismisses it.
    var details = chooser.querySelector("details");
    document.addEventListener("click", function (e) {
      if (details && details.open && !chooser.contains(e.target)) details.open = false;
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && details && details.open) details.open = false;
    });
  })();

  // Collapsible filter panels: open on desktop, collapsed on phones. Once the
  // user toggles one, resize only forces it open for wide viewports.
  (function initFilterBoxes() {
    var boxes = document.querySelectorAll("details.filter-box");
    if (!boxes.length) return;
    var mq = window.matchMedia("(max-width: 640px)");
    Array.prototype.forEach.call(boxes, function (d) {
      if (mq.matches) d.open = false;
      mq.addEventListener("change", function () {
        if (!mq.matches) d.open = true;
      });
    });
  })();

  // Auto-apply filter toolbars: choosing any select submits the GET form so the
  // results update without a separate Filter button. The timeout lets the
  // state/region cascade reset dependent selections before submitting.
  (function initAutoSubmit() {
    Array.prototype.forEach.call(document.querySelectorAll("form[data-auto-submit]"), function (form) {
      form.addEventListener("change", function (e) {
        var el = e.target;
        if (!el || el.tagName !== "SELECT") return;
        window.setTimeout(function () {
          if (form.requestSubmit) form.requestSubmit();
          else form.submit();
        }, 0);
      });
    });
  })();

  var modal = document.getElementById("app-modal");
  if (!modal) return;
  var card = modal.querySelector(".modal-card");
  var titleEl = document.getElementById("app-modal-title");
  var bodyEl = document.getElementById("app-modal-body");
  var lastFocus = null;
  var pendingForm = null;

  function openModal(title, size) {
    lastFocus = document.activeElement;
    titleEl.textContent = title || "";
    card.classList.toggle("sm", size === "sm");
    card.classList.toggle("md", size === "md");
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
    if (modal.hidden) return;
    if (e.key === "Escape") { closeModal(); return; }
    if (e.key !== "Tab") return;
    // Keep keyboard focus inside the dialog while it is open.
    var items = card.querySelectorAll('a[href], button:not([disabled]), input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
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
    openModal(f.getAttribute("data-confirm-title") || modal.getAttribute("data-confirm-title") || "", "sm");
    bodyEl.innerHTML =
      '<p style="margin:0 0 4px">' + f.getAttribute("data-confirm") + "</p>" +
      '<div class="actions" style="margin-top:14px">' +
      '<button type="button" class="btn danger" data-confirm-yes="1">' + (f.getAttribute("data-confirm-yes") || modal.getAttribute("data-yes") || "OK") + "</button>" +
      '<button type="button" class="btn secondary" data-close="1">' + (modal.getAttribute("data-cancel") || "Cancel") + "</button>" +
      "</div>";
    var yes = bodyEl.querySelector("[data-confirm-yes]");
    if (yes) yes.focus();
  });

  function setModalHtml(doc) {
    bodyEl.innerHTML = "";
    Array.prototype.forEach.call(doc.body.children, function (n) {
      bodyEl.appendChild(document.importNode(n, true));
    });
    initRegionCascade(bodyEl);
    initHeadPicker(bodyEl);
    initStrengthMeters(bodyEl);
  }

  // Open-in-modal: any link with class js-edit-modal (edit forms) or js-add-modal (add forms)
  document.addEventListener("click", function (e) {
    var link = e.target && e.target.closest ? e.target.closest("a.js-add-modal, a.js-edit-modal") : null;
    if (!link) return;
    e.preventDefault();
    var href = link.getAttribute("href");
    if (!href) return;
    var url = href + (href.indexOf("?") > -1 ? "&" : "?") + "modal=1";
    openModal(link.getAttribute("data-modal-title") || "", link.getAttribute("data-modal-size") || "");
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
          // Server may tell us where to land (e.g. household detail after
          // create); honor it, else refresh with the flash key as before.
          var redirect = r.headers.get("X-Redirect-To");
          if (redirect) { location.assign(redirect); return; }
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

  // Swipeable tab strip (Options page): bring the active tab into view so a
  // deep-linked tab (?type=...) is not hidden off the right edge on phones.
  (function revealActiveTab() {
    var strip = document.querySelector(".page-toolbar .tabs");
    if (!strip || strip.scrollWidth <= strip.clientWidth) return;
    var active = strip.querySelector('[aria-current="page"]');
    if (!active) return;
    var s = strip.getBoundingClientRect();
    var a = active.getBoundingClientRect();
    if (a.left < s.left || a.right > s.right) {
      strip.scrollLeft += a.left - s.left - (s.width - a.width) / 2;
    }
  })();
})();
