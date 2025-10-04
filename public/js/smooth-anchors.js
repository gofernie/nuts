// public/js/smooth-anchors.js
(function () {
  try {
    try { history.scrollRestoration = 'manual'; } catch (e) {}
    var hadInitialHash = !!location.hash;
    if (hadInitialHash) { window.scrollTo(0, 0); }

    function measureHeader() {
      var header = document.querySelector('header, .site-header');
      var h = header ? Math.max(52, Math.round(header.getBoundingClientRect().height)) : 52;
      document.documentElement.style.setProperty('--header-h', h + 'px');
    }
    measureHeader();
    window.addEventListener('resize', function () { requestAnimationFrame(measureHeader); }, { passive: true });

    function slugify(s) {
      return String(s).toLowerCase().replace(/&/g, '-and-').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
    function findTarget(id) {
      if (!id) return null;
      var el = document.getElementById(id); if (el) return el;
      var lower = id.toLowerCase();
      var withIds = document.querySelectorAll('[id]');
      for (var i = 0; i < withIds.length; i++) if (withIds[i].id.toLowerCase() === lower) return withIds[i];
      var hs = document.querySelectorAll('h1,h2,h3,h4,h5,h6');
      for (var j = 0; j < hs.length; j++) if (slugify(hs[j].textContent || '') === lower) return hs[j];
      if (window.CSS && CSS.escape) { var named = document.querySelector('a[name="' + CSS.escape(id) + '"]'); if (named) return named; }
      return null;
    }
    function smoothScrollTo(el) {
      if (!el) return;
      if ('scrollBehavior' in document.documentElement.style) {
        requestAnimationFrame(function(){ el.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
        return;
      }
      var start = window.pageYOffset;
      var targetTop = el.getBoundingClientRect().top + start;
      var header = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 52;
      var to = Math.max(0, targetTop - header - 12);
      var t0 = performance.now(), dur = 300;
      function tick(now){ var t=Math.min(1,(now-t0)/dur); var e=t<.5?2*t*t:-1+(4-2*t)*t; window.scrollTo(0, Math.round(start + (to-start)*e)); if(t<1)requestAnimationFrame(tick); }
      requestAnimationFrame(tick);
    }
    function handleHash(raw){ var id = decodeURIComponent(String(raw||'').replace(/^#/,'')); if(!id)return; var el=findTarget(id); if(!el)return; smoothScrollTo(el); }

    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
      var id = decodeURIComponent(a.getAttribute('href').slice(1));
      var el = findTarget(id); if (!el) return;
      e.preventDefault(); history.pushState(null, '', '#' + id); smoothScrollTo(el);
    }, { passive: false });

    window.addEventListener('hashchange', function (e) { e.preventDefault(); handleHash(location.hash); });

    if (hadInitialHash) { window.addEventListener('load', function(){ setTimeout(function(){ handleHash(location.hash); }, 60); }); }

    console.log('[smooth-anchors] ready');
  } catch (err) {
    console.error('[smooth-anchors] init error:', err);
  }
})();
