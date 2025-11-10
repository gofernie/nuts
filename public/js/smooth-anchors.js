// public/js/smooth-anchors.js  (v5)
(function () {
  try {
    /* ---------- baseline hardening ---------- */
    try { history.scrollRestoration = "manual"; } catch {}
    var hadInitialHash = !!location.hash;
    if (hadInitialHash) window.scrollTo(0, 0);

    function isEl(n){ return !!(n && n.nodeType === 1); }
    function upToEl(n){ while(n && !isEl(n)) n = n.parentNode; return n || null; }

    /* ---------- header measurement ---------- */
    function measureHeader() {
      var header = document.querySelector("header, .site-header");
      var h = header ? Math.max(52, Math.round(header.getBoundingClientRect().height)) : 52;
      document.documentElement.style.setProperty("--header-h", h + "px");
      return h;
    }
    measureHeader();
    var resizeQueued = false;
    window.addEventListener("resize", function () {
      if (resizeQueued) return;
      resizeQueued = true;
      requestAnimationFrame(function () { resizeQueued = false; measureHeader(); });
    }, { passive: true });

    /* ---------- target resolution (feature-rich) ---------- */
    function slugify(s) {
      return String(s).toLowerCase()
        .replace(/&/g, "-and-").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    }
    function findTarget(id) {
      if (!id) return null;
      // 1) exact ID
      var el = document.getElementById(id);
      if (el) return el;
      // 2) case-insensitive ID
      var lower = id.toLowerCase();
      var withIds = document.querySelectorAll("[id]");
      for (var i = 0; i < withIds.length; i++) {
        if ((withIds[i].id || "").toLowerCase() === lower) return withIds[i];
      }
      // 3) heading text slug
      var hs = document.querySelectorAll("h1,h2,h3,h4,h5,h6");
      for (var j = 0; j < hs.length; j++) {
        if (slugify(hs[j].textContent || "") === lower) return hs[j];
      }
      // 4) named anchors
      try {
        var named = document.querySelector('a[name="' + (CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
        if (named) return named;
      } catch {}
      return null;
    }

    /* ---------- smooth scroll with offset (eased) ---------- */
    function smoothScrollTo(el) {
      if (!el) return;
      var start = window.pageYOffset;
      var targetTop = el.getBoundingClientRect().top + start;
      var header = parseInt(getComputedStyle(document.documentElement)
                   .getPropertyValue("--header-h")) || 52;
      var to = Math.max(0, targetTop - header - 12);
      var t0 = performance.now();
      var dur = 320;
      function ease(t){ return t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t; }
      function tick(now){
        var t = Math.min(1, (now - t0) / dur);
        window.scrollTo(0, Math.round(start + (to - start) * ease(t)));
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    function handleHash(raw) {
      var id = decodeURIComponent(String(raw || "").replace(/^#/, ""));
      if (!id) return;
      var el = findTarget(id);
      if (!el) return;
      smoothScrollTo(el);
    }

    /* ---------- click delegation (fully guarded) ---------- */
    document.addEventListener("click", function (e) {
      var tgt = upToEl(e.target);               // guard text nodes
      if (!tgt) return;
      var a = tgt.closest && tgt.closest('a[href^="#"]:not([href="#"]):not([data-no-smooth])');
      if (!a) return;

      var href = a.getAttribute("href") || "";
      if (!href) return;

      var id = decodeURIComponent(href.slice(1));
      var el = findTarget(id);
      if (!el) return;

      e.preventDefault();
      try { history.pushState(null, "", "#" + id); } catch {}
      smoothScrollTo(el);
    }, { passive: false, capture: true });

    /* ---------- respond to back/forward ---------- */
    window.addEventListener("hashchange", function (e) {
      e.preventDefault();
      handleHash(location.hash);
    });

    /* ---------- handle initial hash after layout ---------- */
    if (hadInitialHash) {
      window.addEventListener("load", function () {
        setTimeout(function () { handleHash(location.hash); }, 60);
      });
    }
  } catch (_) {
    /* silent fail */
  }
})();
