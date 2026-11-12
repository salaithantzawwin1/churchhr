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
    var narrow = window.matchMedia ? window.matchMedia("(max-width: 1180px)") : null;

    function menuFor(d) { return d.querySelector(".nav-menu"); }
    function clearPosition(d) {
      var menu = menuFor(d);
      if (!menu) return;
      menu.style.position = "";
      menu.style.top = "";
      menu.style.left = "";
      menu.style.right = "";
      menu.style.width = "";
      menu.style.minWidth = "";
      menu.style.maxHeight = "";
      menu.style.overflowY = "";
    }
    function position(d) {
      if (!narrow || !narrow.matches || !d.open) return;
      var summary = d.querySelector("summary");
      var menu = menuFor(d);
      if (!summary || !menu) return;
      var r = summary.getBoundingClientRect();
      var width = Math.min(320, window.innerWidth - 20);
      var left = Math.max(10, Math.min(r.left, window.innerWidth - width - 10));
      menu.style.position = "fixed";
      menu.style.top = Math.round(r.bottom + 6) + "px";
      menu.style.left = Math.round(left) + "px";
      menu.style.right = "auto";
      menu.style.width = Math.round(width) + "px";
      menu.style.minWidth = "0";
      menu.style.maxHeight = Math.max(120, window.innerHeight - r.bottom - 18) + "px";
      menu.style.overflowY = "auto";
    }

    menus.forEach(function (d) {
      d.addEventListener("toggle", function () {
        if (d.open) position(d);
        else if (narrow && !narrow.matches) clearPosition(d);
      });
    });
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
    if (narrow) {
      var onChange = function () {
        menus.forEach(function (d) {
          if (narrow.matches) position(d);
          else clearPosition(d);
        });
      };
      if (narrow.addEventListener) narrow.addEventListener("change", onChange);
      else if (narrow.addListener) narrow.addListener(onChange);
    }
    window.addEventListener("resize", function () { menus.forEach(position); });
    window.addEventListener("scroll", function () {
      menus.forEach(function (d) { if (d.open) d.open = false; });
    }, { passive: true });
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

  // Manual dark/light toggle — dark is the product default, and the explicit
  // choice is persisted so every page opens in the same theme.
  var themeBtn = document.querySelector(".theme-toggle");
  if (themeBtn) {
    var t = null;
    try { t = localStorage.getItem("theme"); } catch (e) {}
    var eff = t === "light" ? "light" : "dark";
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

  // Household head picker: the native select stays as the no-JS fallback, but
  // when JS runs it becomes a type-to-search combobox. Picking a head copies
  // that member's placement (state, township, home cell, group, family group)
  // into the new household form and fills the household name with theirs. The
  // server repeats the placement fallback on submit.
  function initHeadPicker(root) {
    Array.prototype.forEach.call(root.querySelectorAll("[data-head-picker]"), function (picker) {
      if (picker.getAttribute("data-head-bound")) return;
      picker.setAttribute("data-head-bound", "1");
      var sel = picker.querySelector("select[data-head-select]");
      var search = picker.querySelector("[data-head-search]");
      var clear = picker.querySelector("[data-head-clear]");
      if (!sel || !search) return;

      var list = document.createElement("div");
      list.className = "head-list";
      list.setAttribute("role", "listbox");
      list.hidden = true;
      list.addEventListener("mousedown", function (e) { e.preventDefault(); });
      var noMatch = document.createElement("div");
      noMatch.className = "head-empty";
      noMatch.textContent = picker.getAttribute("data-no-match") || "No matching member";
      noMatch.hidden = true;

      var items = [];
      Array.prototype.forEach.call(sel.options, function (opt) {
        if (!opt.value) return;
        var item = document.createElement("button");
        item.type = "button";
        item.className = "head-option";
        item.setAttribute("role", "option");
        item.textContent = opt.textContent;
        item._opt = opt;
        item.addEventListener("click", function () { choose(opt); });
        list.appendChild(item);
        items.push(item);
      });
      list.appendChild(noMatch);
      picker.appendChild(list);
      picker.classList.add("is-ready");

      function labelOf(opt) { return (opt && opt.textContent || "").trim(); }
      function open() {
        filter();
        list.hidden = false;
        search.setAttribute("aria-expanded", "true");
      }
      function close() {
        list.hidden = true;
        search.setAttribute("aria-expanded", "false");
        items.forEach(function (b) { b.classList.remove("active"); });
      }
      function filter() {
        var q = search.value.trim().toLowerCase();
        var shown = 0;
        items.forEach(function (b) {
          var match = !q || b.textContent.toLowerCase().indexOf(q) > -1;
          var visible = match && shown < 60;
          b.hidden = !visible;
          if (visible) shown++;
          b.classList.toggle("selected", b._opt.value === sel.value);
        });
        noMatch.hidden = shown > 0;
      }
      function choose(opt) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        search.value = labelOf(opt);
        if (clear) clear.hidden = false;
        close();
      }
      function resetSelection() {
        sel.value = "";
        var form = sel.form;
        if (!form) return;
        var nameInput = form.querySelector('input[name="name"]');
        var prev = form.getAttribute("data-head-name");
        if (nameInput && prev && nameInput.value === prev) nameInput.value = "";
        form.removeAttribute("data-head-name");
      }

      // Placement + household name follow the picked head.
      sel.addEventListener("change", function () {
        var opt = sel.options[sel.selectedIndex];
        var form = sel.form;
        if (!form) return;
        if (!opt || !opt.value) {
          resetSelection();
          return;
        }
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

        // Contact details travel with the picked head so the household form is
        // complete before it is submitted.
        function fill(name, attr) {
          var el = form.querySelector('[name="' + name + '"]');
          if (el) el.value = opt.getAttribute(attr) || "";
        }
        fill("phone", "data-phone");
        fill("address", "data-address");

        var nameInput = form.querySelector('input[name="name"]');
        var headName = opt.getAttribute("data-name") || "";
        var prev = form.getAttribute("data-head-name") || "";
        if (nameInput && headName && (!nameInput.value.trim() || nameInput.value === prev)) {
          nameInput.value = headName;
          form.setAttribute("data-head-name", headName);
        }
      });

      search.addEventListener("focus", open);
      search.addEventListener("input", function () {
        var current = sel.options[sel.selectedIndex];
        if (sel.value && (!current || search.value.trim() !== labelOf(current))) {
          resetSelection();
          if (clear) clear.hidden = false;
        }
        if (clear) clear.hidden = !search.value;
        open();
      });
      search.addEventListener("blur", function () {
        setTimeout(function () {
          close();
          // Typing without picking an option must not leave a value-looking
          // search string next to an empty native select.
          if (!sel.value && search.value.trim()) {
            search.value = "";
            if (clear) clear.hidden = true;
          }
        }, 120);
      });
      search.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { close(); return; }
        if (e.key === "Enter") {
          var active = list.querySelector(".head-option.active");
          if (active) { e.preventDefault(); active.click(); }
          return;
        }
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
        e.preventDefault();
        var visible = items.filter(function (b) { return !b.hidden; });
        if (!visible.length) return;
        var current = visible.indexOf(list.querySelector(".head-option.active"));
        var next = e.key === "ArrowDown" ? Math.min(current + 1, visible.length - 1) : Math.max(current - 1, 0);
        items.forEach(function (b) { b.classList.remove("active"); });
        visible[next].classList.add("active");
        visible[next].scrollIntoView({ block: "nearest" });
      });
      if (clear) clear.addEventListener("click", function () {
        search.value = "";
        resetSelection();
        clear.hidden = true;
        close();
        search.focus();
      });

      // Preselected head (e.g. arrived from a member page).
      var initial = sel.options[sel.selectedIndex];
      if (initial && initial.value) {
        search.value = labelOf(initial);
        if (clear) clear.hidden = false;
      }
    });
  }
  initHeadPicker(document);

  // Generic type-to-search select. Unlike the household head picker it only
  // writes the native select value; it never copies placement or contact data
  // into sibling fields.
  // Assign dialog: picking a member who already holds a church position warns
  // that saving moves that role, before the form is submitted.
  function initAssignWarn(root) {
    var warn = root.querySelector("[data-assign-warn]");
    if (!warn) return;
    var radios = root.querySelectorAll('input[name="member_id"]');
    var update = function () {
      var checked = root.querySelector('input[name="member_id"]:checked');
      var msg = checked ? checked.getAttribute("data-warn") || "" : "";
      warn.textContent = msg;
      warn.hidden = !msg;
    };
    Array.prototype.forEach.call(radios, function (radio) {
      radio.addEventListener("change", update);
    });
    update();
  }

  // In-dialog list filter: typing narrows a rendered radio list without a round
  // trip, which keeps the assign dialog usable on a church with many members.
  function initListFilter(root) {
    Array.prototype.forEach.call(root.querySelectorAll("[data-filter-list]"), function (input) {
      if (input.getAttribute("data-filter-bound")) return;
      input.setAttribute("data-filter-bound", "1");
      var list = root.querySelector(input.getAttribute("data-filter-list"));
      if (!list) return;
      input.addEventListener("input", function () {
        var q = input.value.trim().toLowerCase();
        Array.prototype.forEach.call(list.querySelectorAll("[data-name]"), function (row) {
          row.hidden = !!q && row.getAttribute("data-name").toLowerCase().indexOf(q) < 0;
        });
      });
    });
  }

  function initSearchPicker(root) {
    Array.prototype.forEach.call(root.querySelectorAll("[data-search-picker]"), function (picker) {
      if (picker.getAttribute("data-search-bound")) return;
      picker.setAttribute("data-search-bound", "1");
      var sel = picker.querySelector("select[data-search-select]");
      var search = picker.querySelector("input[data-search-input]");
      var clear = picker.querySelector("[data-search-clear]");
      if (!sel || !search) return;

      var list = document.createElement("div");
      list.className = "head-list";
      list.setAttribute("role", "listbox");
      list.hidden = true;
      list.addEventListener("mousedown", function (e) { e.preventDefault(); });
      var noMatch = document.createElement("div");
      noMatch.className = "head-empty";
      noMatch.textContent = picker.getAttribute("data-no-match") || "No matching option";
      noMatch.hidden = true;

      var items = [];
      Array.prototype.forEach.call(sel.options, function (opt) {
        if (!opt.value) return;
        var item = document.createElement("button");
        item.type = "button";
        item.className = "head-option";
        item.setAttribute("role", "option");
        item.textContent = opt.textContent;
        item._opt = opt;
        item.addEventListener("click", function () { choose(opt); });
        list.appendChild(item);
        items.push(item);
      });
      list.appendChild(noMatch);
      picker.appendChild(list);
      picker.classList.add("is-ready");

      function labelOf(opt) { return (opt && opt.textContent || "").trim(); }
      function open() { filter(); list.hidden = false; search.setAttribute("aria-expanded", "true"); }
      function close() {
        list.hidden = true;
        search.setAttribute("aria-expanded", "false");
        items.forEach(function (b) { b.classList.remove("active"); });
      }
      function filter() {
        var q = search.value.trim().toLowerCase();
        var shown = 0;
        items.forEach(function (b) {
          var available = !b._opt.hidden;
          var match = available && (!q || b.textContent.toLowerCase().indexOf(q) > -1);
          var visible = match && shown < 80;
          b.hidden = !visible;
          if (visible) shown++;
          b.classList.toggle("selected", b._opt.value === sel.value);
        });
        noMatch.hidden = shown > 0;
      }
      function syncText() {
        var opt = sel.options[sel.selectedIndex];
        search.value = opt && opt.value ? labelOf(opt) : "";
        if (clear) clear.hidden = !search.value;
      }
      function choose(opt) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        syncText();
        close();
      }
      function clearSelection() {
        sel.value = "";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        search.value = "";
        if (clear) clear.hidden = true;
      }

      search.addEventListener("focus", open);
      search.addEventListener("input", function () {
        var current = sel.options[sel.selectedIndex];
        if (sel.value && (!current || search.value.trim() !== labelOf(current))) {
          sel.value = "";
        }
        if (clear) clear.hidden = !search.value;
        open();
      });
      search.addEventListener("blur", function () {
        setTimeout(function () {
          close();
          // Typing without picking an option must not leave a value-looking
          // search string next to an empty native select.
          if (!sel.value && search.value.trim()) {
            search.value = "";
            if (clear) clear.hidden = true;
          }
        }, 120);
      });
      search.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { close(); return; }
        if (e.key === "Enter") {
          var active = list.querySelector(".head-option.active");
          if (active) { e.preventDefault(); active.click(); }
          return;
        }
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
        e.preventDefault();
        var visible = items.filter(function (b) { return !b.hidden; });
        if (!visible.length) return;
        var current = visible.indexOf(list.querySelector(".head-option.active"));
        var next = e.key === "ArrowDown" ? Math.min(current + 1, visible.length - 1) : Math.max(current - 1, 0);
        items.forEach(function (b) { b.classList.remove("active"); });
        visible[next].classList.add("active");
        visible[next].scrollIntoView({ block: "nearest" });
      });
      if (clear) clear.addEventListener("click", function () {
        clearSelection();
        close();
        search.focus();
      });
      sel.addEventListener("change", function () {
        var opt = sel.options[sel.selectedIndex];
        search.value = opt && opt.value ? labelOf(opt) : search.value;
        if (clear) clear.hidden = !sel.value;
      });
      // The region cascade may clear this select when the state changes; keep
      // the visible search text in step with the real value.
      var form = sel.form;
      var region = form && form.querySelector("select[data-region-select]");
      if (region) region.addEventListener("change", function () { setTimeout(syncText, 0); });

      var initial = sel.options[sel.selectedIndex];
      if (initial && initial.value) syncText();
      else if (clear) clear.hidden = true;
    });
  }
  initSearchPicker(document);

  // Type-ahead for the household "Add existing member" page. The server already
  // renders the full result list for ?q=, so typing just fetches that page and
  // drops its result block under the field. This keeps every result form,
  // relationship choice and translated label identical to the no-JS page.
  (function initHouseholdMemberSearch() {
    var wrap = document.querySelector("[data-live-search]");
    if (!wrap) return;
    var form = wrap.querySelector("form.hh-pick-search");
    var input = wrap.querySelector("[data-live-search-input]");
    var panel = wrap.querySelector(".hh-live-results");
    var msg = wrap.querySelector("[data-live-search-msg]");
    var items = wrap.querySelector("[data-live-search-items]");
    if (!form || !input || !panel || !msg || !items) return;
    if (!window.fetch || !window.DOMParser || !window.URL || !window.AbortController) return;

    var timer = null;
    var controller = null;
    var seq = 0;
    var active = -1;
    var searching = wrap.getAttribute("data-searching") || "Searching…";
    var failed = wrap.getAttribute("data-search-error") || "Could not search members.";
    items.setAttribute("role", "listbox");
    var label = wrap.querySelector("label .lbl");
    if (label) items.setAttribute("aria-label", label.textContent.trim());

    function rows() {
      return items.querySelectorAll(".hh-pick");
    }
    function expanded(open) {
      input.setAttribute("aria-expanded", open ? "true" : "false");
    }
    function setActive(index) {
      var nodes = rows();
      if (!nodes.length) { active = -1; return; }
      if (index < 0) index = nodes.length - 1;
      if (index >= nodes.length) index = 0;
      for (var i = 0; i < nodes.length; i++) {
        var on = i === index;
        nodes[i].classList.toggle("is-active", on);
        nodes[i].setAttribute("aria-selected", on ? "true" : "false");
      }
      active = index;
      input.setAttribute("aria-activedescendant", nodes[index].id);
      nodes[index].scrollIntoView({ block: "nearest" });
    }
    function clearActive() {
      active = -1;
      input.removeAttribute("aria-activedescendant");
      Array.prototype.forEach.call(rows(), function (row) {
        row.classList.remove("is-active");
        row.setAttribute("aria-selected", "false");
      });
    }
    function prepareResults() {
      Array.prototype.forEach.call(rows(), function (row, i) {
        row.id = "hh-live-option-" + i;
        row.setAttribute("role", "option");
        row.setAttribute("aria-selected", "false");
      });
      clearActive();
    }
    function choose(row) {
      if (!row) return;
      // Enter on a highlighted result performs that row's Add/Move action with
      // the relationship already selected in the row.
      var button = row.querySelector('form.hh-pick-actions button[type="submit"]');
      if (button) button.click();
    }
    function close() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (controller) { controller.abort(); controller = null; }
      seq++;
      panel.hidden = true;
      panel.removeAttribute("aria-busy");
      msg.hidden = true;
      msg.textContent = "";
      items.innerHTML = "";
      clearActive();
      expanded(false);
    }
    function open() {
      panel.hidden = false;
      expanded(true);
    }
    function showMessage(text) {
      msg.textContent = text;
      msg.hidden = false;
      items.innerHTML = "";
      clearActive();
      open();
    }
    function load(q) {
      var target = new URL(form.getAttribute("action") || location.pathname, location.href);
      target.searchParams.set("q", q);
      var mine = ++seq;
      if (controller) controller.abort();
      controller = new AbortController();
      panel.setAttribute("aria-busy", "true");
      showMessage(searching);
      fetch(target.toString(), {
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Accept": "text/html" },
        signal: controller.signal,
      })
        .then(function (r) {
          if (!r.ok) throw new Error("http " + r.status);
          return r.text();
        })
        .then(function (html) {
          if (mine !== seq) return;
          var doc = new DOMParser().parseFromString(html, "text/html");
          var results = doc.querySelector("[data-hh-results]");
          if (!results) throw new Error("no results");
          msg.hidden = true;
          msg.textContent = "";
          items.innerHTML = results.innerHTML;
          prepareResults();
          panel.removeAttribute("aria-busy");
          open();
        })
        .catch(function (e) {
          if (mine !== seq || (e && e.name === "AbortError")) return;
          panel.removeAttribute("aria-busy");
          showMessage(failed);
        });
    }
    function schedule() {
      var q = input.value.trim();
      if (!q) { close(); return; }
      // Stop an older request from painting results for a previous query.
      if (controller) { controller.abort(); controller = null; seq++; }
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { timer = null; load(q); }, 220);
    }

    input.addEventListener("input", schedule);
    input.addEventListener("search", schedule);
    input.addEventListener("focus", function () {
      if (input.value.trim() && panel.hidden) schedule();
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) { e.preventDefault(); close(); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        var nodes = rows();
        if (!nodes.length) return;
        e.preventDefault();
        if (panel.hidden) open();
        if (e.key === "ArrowDown") setActive(active < 0 ? 0 : active + 1);
        else setActive(active < 0 ? nodes.length - 1 : active - 1);
        return;
      }
      if (e.key === "Home" || e.key === "End") {
        var all = rows();
        if (!all.length || panel.hidden) return;
        e.preventDefault();
        setActive(e.key === "Home" ? 0 : all.length - 1);
        return;
      }
      if (e.key === "Enter" && active >= 0 && !panel.hidden) {
        var row = rows()[active];
        if (row) { e.preventDefault(); choose(row); }
      }
    });
    form.addEventListener("submit", close);
    document.addEventListener("click", function (e) {
      if (!panel.hidden && !wrap.contains(e.target)) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) { close(); input.focus(); }
    });
  })();

  // Member profile photo: centre-crop the chosen image, resize it to 500×500
  // and encode WebP at quality 0.85 before the form submits.
  function initPhotoInputs(root) {
    Array.prototype.forEach.call(root.querySelectorAll("[data-photo-field]"), function (field) {
      var input = field.querySelector("[data-photo-input]");
      var hidden = field.querySelector("[data-photo-data]");
      var img = field.querySelector("[data-photo-img]");
      var fallback = field.querySelector("[data-photo-fallback]");
      var remove = field.querySelector("[data-photo-remove]");
      var status = field.querySelector("[data-photo-status]");
      if (!input || !hidden) return;
      var initial = field.getAttribute("data-initial") || "?";
      function setStatus(text, bad) {
        if (!status) return;
        status.textContent = text || "";
        status.className = "photo-status" + (bad ? " bad" : "");
      }
      function showFallback() {
        if (img) { img.hidden = true; img.removeAttribute("src"); }
        if (fallback) { fallback.hidden = false; fallback.textContent = initial; }
      }
      function showImage(url) {
        if (img) { img.src = url; img.hidden = false; }
        if (fallback) fallback.hidden = true;
      }
      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        if (!file) return;
        var errorText = field.getAttribute("data-error") || "Could not process this image.";
        if (file.type.indexOf("image/") !== 0) { setStatus(errorText, true); return; }
        setStatus(field.getAttribute("data-processing") || "Processing…", false);
        var objectUrl = URL.createObjectURL(file);
        var source = new Image();
        source.onload = function () {
          var side = Math.min(source.naturalWidth, source.naturalHeight);
          var sx = (source.naturalWidth - side) / 2;
          var sy = (source.naturalHeight - side) / 2;
          var canvas = document.createElement("canvas");
          canvas.width = 500;
          canvas.height = 500;
          var ctx = canvas.getContext("2d");
          if (!ctx) { URL.revokeObjectURL(objectUrl); setStatus(errorText, true); return; }
          ctx.drawImage(source, sx, sy, side, side, 0, 0, 500, 500);
          URL.revokeObjectURL(objectUrl);
          canvas.toBlob(function (blob) {
            if (!blob || blob.type !== "image/webp") { setStatus(errorText, true); return; }
            var reader = new FileReader();
            reader.onload = function () {
              hidden.value = String(reader.result || "");
              showImage(hidden.value);
              if (remove) remove.checked = false;
              setStatus(field.getAttribute("data-ready") || "Ready", false);
            };
            reader.onerror = function () { setStatus(errorText, true); };
            reader.readAsDataURL(blob);
          }, "image/webp", 0.85);
        };
        source.onerror = function () {
          URL.revokeObjectURL(objectUrl);
          setStatus(errorText, true);
        };
        source.src = objectUrl;
      });
      if (remove) remove.addEventListener("change", function () {
        if (!remove.checked) return;
        hidden.value = "";
        input.value = "";
        showFallback();
        setStatus("", false);
      });
    });
  }
  initPhotoInputs(document);

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

  // Card/list preference for collection pages. Both views use the same server
  // markup; the choice is stored locally so it survives navigation.
  (function initCollectionViews() {
    var grids = document.querySelectorAll("[data-view-grid]");
    Array.prototype.forEach.call(document.querySelectorAll("[data-view-switch]"), function (toggle) {
      var buttons = toggle.querySelectorAll("[data-view]");
      var key = toggle.getAttribute("data-view-key") || "collection";
      var saved = "card";
      try { if (localStorage.getItem("view:" + key) === "list") saved = "list"; } catch (e) {}
      function apply(view, persist) {
        var list = view === "list";
        Array.prototype.forEach.call(grids, function (grid) {
          grid.classList.toggle("is-list", list);
        });
        Array.prototype.forEach.call(buttons, function (b) {
          b.setAttribute("aria-pressed", b.getAttribute("data-view") === view ? "true" : "false");
        });
        if (persist) {
          try { localStorage.setItem("view:" + key, view); } catch (e) {}
        }
      }
      Array.prototype.forEach.call(buttons, function (b) {
        b.addEventListener("click", function () { apply(b.getAttribute("data-view"), true); });
      });
      apply(saved, false);
    });
  })();

  // Department role depends on a chosen department; keep the second select
  // disabled until there is a department to attach the role to.
  function initDepartmentPosition(root) {
    Array.prototype.forEach.call(root.querySelectorAll("[data-dept-position]"), function (scope) {
      if (scope.getAttribute("data-dept-bound")) return;
      scope.setAttribute("data-dept-bound", "1");
      var dept = scope.querySelector('select[name="department_id"]');
      var pos = scope.querySelector('select[name="department_position"]');
      if (!dept || !pos) return;
      function sync() {
        var hasDepartment = Boolean(dept.value);
        pos.disabled = !hasDepartment;
        if (!hasDepartment) pos.value = "";
      }
      dept.addEventListener("change", sync);
      sync();
    });
  }
  initDepartmentPosition(document);

  // Tabbed forms (e.g. Assign position). Without JS every pane stays visible
  // and usable; this only hides the panes that are not selected.
  function initTabs(root) {
    Array.prototype.forEach.call(root.querySelectorAll("[data-tabs]"), function (bar) {
      if (bar.getAttribute("data-tabs-bound")) return;
      bar.setAttribute("data-tabs-bound", "1");
      var wrap = bar.parentNode;
      var buttons = bar.querySelectorAll("[data-tab-target]");
      var panes = wrap.querySelectorAll("[data-tab-pane]");
      if (!buttons.length) return;
      function show(key) {
        Array.prototype.forEach.call(buttons, function (b) {
          var on = b.getAttribute("data-tab-target") === key;
          b.classList.toggle("active", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
          b.setAttribute("tabindex", on ? "0" : "-1");
        });
        Array.prototype.forEach.call(panes, function (p) {
          p.hidden = p.getAttribute("data-tab-pane") !== key;
        });
      }
      Array.prototype.forEach.call(buttons, function (b, i) {
        b.addEventListener("click", function () { show(b.getAttribute("data-tab-target")); });
        b.addEventListener("keydown", function (e) {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          var next = buttons[(i + (e.key === "ArrowRight" ? 1 : buttons.length - 1)) % buttons.length];
          next.focus();
          show(next.getAttribute("data-tab-target"));
        });
      });
      var initial = bar.querySelector("[data-tab-target].active") || buttons[0];
      show(initial.getAttribute("data-tab-target"));
    });
  }
  initTabs(document);

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
    var text = f.getAttribute("data-confirm");
    var yesLabel = f.getAttribute("data-confirm-yes") || modal.getAttribute("data-yes") || "OK";
    // A form inside the modal (e.g. deleting the record being edited) keeps
    // its place: replacing the body would detach it and submit() would do
    // nothing. Show the prompt under it with the form hidden instead.
    if (bodyEl.contains(f)) {
      // A delete form can be hidden from the start (its Delete button lives in
      // the main form footer); remember that so Cancel restores the right state.
      f.setAttribute("data-confirm-was-hidden", f.hidden ? "1" : "0");
      f.hidden = true;
      var box = document.createElement("div");
      box.className = "modal-confirm";
      box.innerHTML =
        '<p style="margin:0 0 4px">' + text + "</p>" +
        '<div class="actions" style="margin-top:14px">' +
        '<button type="button" class="btn danger" data-confirm-yes="1">' + yesLabel + "</button>" +
        '<button type="button" class="btn secondary" data-confirm-no="1">' + (modal.getAttribute("data-cancel") || "Cancel") + "</button>" +
        "</div>";
      bodyEl.appendChild(box);
      var inlineYes = box.querySelector("[data-confirm-yes]");
      if (inlineYes) inlineYes.focus();
      return;
    }
    openModal(f.getAttribute("data-confirm-title") || modal.getAttribute("data-confirm-title") || "", "sm");
    bodyEl.innerHTML =
      '<p style="margin:0 0 4px">' + text + "</p>" +
      '<div class="actions" style="margin-top:14px">' +
      '<button type="button" class="btn danger" data-confirm-yes="1">' + yesLabel + "</button>" +
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
    initSearchPicker(bodyEl);
    initListFilter(bodyEl);
    initAssignWarn(bodyEl);
    initDepartmentPosition(bodyEl);
    initTabs(bodyEl);
    initPhotoInputs(bodyEl);
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

  // Confirm / cancel buttons of the delete prompt
  bodyEl.addEventListener("click", function (e) {
    var el = e.target;
    if (!el || !el.closest) return;
    var no = el.closest("[data-confirm-no]");
    if (no) {
      var box = no.closest(".modal-confirm");
      if (box) box.remove();
      if (pendingForm) {
        pendingForm.hidden = pendingForm.getAttribute("data-confirm-was-hidden") === "1";
        pendingForm.removeAttribute("data-confirm-was-hidden");
        pendingForm = null;
      }
      return;
    }
    var b = el.closest("[data-confirm-yes]");
    if (!b || !pendingForm) return;
    var f = pendingForm;
    pendingForm = null;
    f.submit();
  });

  // Submit the edit form inside the modal via fetch
  bodyEl.addEventListener("submit", function (e) {
    var form = e.target;
    if (!form || form.tagName !== "FORM") return;
    // Settings forms keep the dialog open when the server rejects the input:
    // the reply is the form again with an error line; a valid save returns
    // only the address to land on so the list reloads with its flash.
    if (form.hasAttribute("data-modal-ajax")) {
      e.preventDefault();
      var ajaxBtn = form.querySelector('button[type="submit"]');
      if (ajaxBtn) ajaxBtn.disabled = true;
      fetch(form.getAttribute("action") || location.href, {
        method: "POST",
        body: new FormData(form),
        headers: { "X-Requested-With": "modal" },
      })
        .then(function (r) {
          if (r.ok && (r.headers.get("content-type") || "").indexOf("application/json") > -1) {
            return r.json().then(function (data) {
              if (data && data.redirect) location.assign(data.redirect);
              else location.reload();
            });
          }
          return r.text().then(function (html) {
            var doc = new DOMParser().parseFromString(html, "text/html");
            if (!doc.querySelector("form")) {
              if (ajaxBtn) ajaxBtn.disabled = false;
              form.submit();
              return;
            }
            setModalHtml(doc);
            var alertEl = bodyEl.querySelector(".modal-error");
            var first = bodyEl.querySelector("input:not([type=hidden]), select, textarea");
            if (alertEl) { alertEl.setAttribute("tabindex", "-1"); alertEl.focus(); }
            else if (first) first.focus();
          });
        })
        .catch(function () { form.submit(); });
      return;
    }
    // Settings forms submit natively so the server redirect (and its ok/err
    // flash) replaces the page; confirm-marked forms are handled below.
    if (form.hasAttribute("data-plain-submit") || form.hasAttribute("data-confirm")) return;
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

  // Long forms (daily reports) ask before a reload or tab close discards
  // unsaved input; submitting the form clears the guard first.
  (function initUnsavedGuards() {
    Array.prototype.forEach.call(document.querySelectorAll("form[data-unsaved-guard]"), function (form) {
      var dirty = false;
      form.addEventListener("input", function () { dirty = true; });
      form.addEventListener("change", function () { dirty = true; });
      form.addEventListener("submit", function () { dirty = false; });
      window.addEventListener("beforeunload", function (e) {
        if (!dirty) return;
        e.preventDefault();
        e.returnValue = "";
      });
    });
  })();

  // Enlarged member-photo preview on hover. Works for member photos and for
  // name links that expose a data-photo-preview URL (Home Cell role names);
  // fixed positioning keeps it outside table scroll containers and it is
  // skipped on touch/coarse pointers.
  (function initPhotoPreview() {
    if (!window.matchMedia || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    var box = document.createElement("div");
    box.className = "photo-preview-float";
    box.setAttribute("aria-hidden", "true");
    var big = document.createElement("img");
    big.alt = "";
    box.appendChild(big);
    document.body.appendChild(box);
    var active = null;
    var photoSelector = 'img[src*="/photo"], [data-photo-preview]';

    function place(x, y) {
      var size = box.offsetWidth || 240;
      var gap = 18;
      var margin = 12;
      var left = x + gap;
      if (left + size > window.innerWidth - margin) left = x - size - gap;
      left = Math.max(margin, Math.min(left, window.innerWidth - size - margin));
      var top = y - size / 2;
      top = Math.max(margin, Math.min(top, window.innerHeight - size - margin));
      box.style.left = Math.round(left) + "px";
      box.style.top = Math.round(top) + "px";
    }

    function show(source, url, x, y) {
      if (active === source) return;
      if (active) active.classList.remove("photo-previewing");
      active = source;
      big.src = url;
      active.classList.add("photo-previewing");
      place(x, y);
      box.classList.add("on");
    }

    function hide() {
      if (active) active.classList.remove("photo-previewing");
      active = null;
      box.classList.remove("on");
    }

    document.addEventListener("pointerover", function (e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      var target = e.target && e.target.closest ? e.target.closest(photoSelector) : null;
      if (!target) return;
      var url = target.tagName === "IMG"
        ? (target.currentSrc || target.src)
        : target.getAttribute("data-photo-preview");
      if (!url) return;
      show(target, url, e.clientX, e.clientY);
    });

    document.addEventListener("pointermove", function (e) {
      if (active && e.pointerType === "mouse") place(e.clientX, e.clientY);
    });

    document.addEventListener("pointerout", function (e) {
      if (!active || e.target !== active) return;
      var to = e.relatedTarget;
      if (to && to.closest && to.closest(photoSelector)) return;
      hide();
    });

    window.addEventListener("scroll", hide, { passive: true });
  })();

  // Touch has no hover, so a tap opens a full-screen photo preview. Member-list
  // thumbnails sit next to the name link, not inside it, so this does not take
  // away navigation. Linked photos are left alone.
  (function initPhotoLightbox() {
    if (!window.matchMedia || !window.matchMedia("(pointer: coarse)").matches) return;
    var box = document.createElement("div");
    box.className = "photo-lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Photo preview");

    var close = document.createElement("button");
    close.type = "button";
    close.className = "photo-lightbox-close";
    close.setAttribute("aria-label", "Close photo preview");
    close.textContent = "\u00d7";

    var big = document.createElement("img");
    big.alt = "";
    box.appendChild(close);
    box.appendChild(big);
    document.body.appendChild(box);

    var lastFocus = null;

    function open(source) {
      lastFocus = document.activeElement;
      big.src = source.currentSrc || source.src;
      box.classList.add("on");
      document.body.classList.add("photo-lightbox-open");
      close.focus();
    }

    function dismiss() {
      box.classList.remove("on");
      document.body.classList.remove("photo-lightbox-open");
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
      lastFocus = null;
    }

    document.addEventListener("click", function (e) {
      var target = e.target;
      if (!target || !target.closest) return;
      if (target.closest(".photo-lightbox")) return;
      var img = target.closest('img[src*="/photo"]');
      if (!img || img.closest("a")) return;
      e.preventDefault();
      open(img);
    });

    box.addEventListener("click", function (e) {
      if (e.target === box || e.target === close) dismiss();
    });

    document.addEventListener("keydown", function (e) {
      if (!box.classList.contains("on")) return;
      if (e.key === "Escape") dismiss();
      if (e.key === "Tab") { e.preventDefault(); close.focus(); }
    });
  })();

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

  // Confirmation banners are transient: fade them out, then drop the flash key
  // from the URL so a reload does not replay an old "saved" message.
  (function initFlash() {
    var flash = document.querySelector(".flash");
    if (!flash) return;
    try {
      var url = new URL(location.href);
      if (url.searchParams.has("ok") || url.searchParams.has("err")) {
        url.searchParams.delete("ok");
        url.searchParams.delete("err");
        history.replaceState(null, "", url.pathname + url.search + url.hash);
      }
    } catch (e) { /* older browser: keep the query, the message still fades */ }
    setTimeout(function () {
      flash.classList.add("flash-out");
      setTimeout(function () { if (flash.parentNode) flash.parentNode.removeChild(flash); }, 400);
    }, 5000);
  })();

  // Home Cell structure: expand or collapse every cluster branch at once.
  (function initClusterToggles() {
    document.addEventListener("click", function (e) {
      var toggle = e.target && e.target.closest ? e.target.closest("[data-cluster-toggle]") : null;
      if (!toggle) return;
      var open = toggle.getAttribute("data-cluster-toggle") === "open";
      Array.prototype.forEach.call(document.querySelectorAll("details.org-flow-cluster"), function (cluster) {
        cluster.open = open;
      });
    });
  })();
})();
