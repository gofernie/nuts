// public/js/smooth-anchors.js
(function () {
  // Keep header height in a CSS var for sticky-offset
  function measureHeader() {
    var header = document.querySelector('header, .site-header');
    var h = header ? Math.max(52, Math.round(header.getBoundingClientRect().height)) : 52;
    document.documentElement.style.setProperty('--header-h', h + 'px');
  }
  measureHeader();
  window.addEventListener('resize', () => requestAnimationFrame(measureHeader), { passive: true });

  // Robust target finder: id match, case-insensitive id match, or heading text->slug match
  function findTarget(id) {
    if (!id) return null;

    // 1) exact id
    var el = document.getElementById(id);
    if (el) return el;

    // 2) case-insensitive id
    var lower = id.toLowerCase();
    var withIds = document.querySelectorAll('[id]');
    for (var i = 0; i < withIds.length; i++) {
      if (withIds[i].id.toLowerCase() === lower) return withIds[i];
    }

    // 3) headings whose text slugifies to the id (handles CMS changing/stripping ids)
    function slugify(s) {
      return String(s)
        .toLowerCase()
        .replace(/&/g, '-and-')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }
    var headings = document.querySelectorAll('h1,h2,h3,h4,h5,h6');
    for (var j = 0; j < headings.length; j++) {
      if (slugify(headings[j].textContent || '') === lower) return headings[j];
    }

    // 4) legacy <a name="...">
    var named = document.querySelector('a[name="' + CSS.escape(id) + '"]');
    if (named) return named;

    return null;
  }

  function smoothScrollTo(el) {
    if (!el) return;
    // If the browser refuses to smooth (CSS override or prefs), do a tiny manual easing
    var supportsSmooth = 'scrollBehavior' in document.documentElement.style;
    if (supportsSmooth) {
      requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      return;
    }
    // Manual scroll (very short, ~300ms)
    var start = window.pageYOffset;
    var targetTop = el.getBoundingClientRect().top + start;
    var header = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 52;
    var to = Math.max(0, targetTop - header - 12);
    var startTime = performance.now();
    var duration = 300;

    function tick(now) {
      var t = Math.min(1, (now - startTime) / duration);
      // easeInOutQuad
      var eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      window.scrollTo(0, Math.round(start + (to - start) * eased));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function handleHash(raw) {
    var id = decodeURIComponent(String(raw || '').replace(/^#/, ''));
    if (!id) return;
    var el = findTarget(id);
    if (!el) return;
    smoothScrollTo(el);
  }

  // Intercept same-page #anchor clicks
  document.addEventListener('click', (e) => {
    var a = e.target && e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = decodeURIComponent(a.getAttribute('href').slice(1));
    var el = findTarget(id);
    if (!el) return; // let browser do its thing if target isn't on this page
    e.preventDefault();
    history.pushState(null, '', '#' + id);
    smoothScrollTo(el);
  }, { passive: false });

  // Back/forward between hashes
  window.addEventListener('hashchange', (e) => {
    e.preventDefault();
    handleHash(location.hash);
  });

  // If landing on /page#section, run after layout settles
  if (location.hash) {
    window.addEventListener('load', () => setTimeout(() => handleHash(location.hash), 60));
  }
})();
