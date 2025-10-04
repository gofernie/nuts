// public/js/smooth-anchors.js
(function () {
  // Keep header height in a CSS var for :target scroll-margin-top
  function measureHeader() {
    var header = document.querySelector('header, .site-header');
    var h = header ? Math.max(52, Math.round(header.getBoundingClientRect().height)) : 52;
    document.documentElement.style.setProperty('--header-h', h + 'px');
  }
  measureHeader();
  window.addEventListener('resize', function () {
    requestAnimationFrame(measureHeader);
  }, { passive: true });

  function scrollToId(id) {
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    requestAnimationFrame(function () {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // Intercept same-page anchor clicks to avoid the instant jump
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = decodeURIComponent(a.getAttribute('href').slice(1));
    var el = document.getElementById(id);
    if (!el) return; // let the browser handle if target isn't on this page
    e.preventDefault();
    history.pushState(null, '', '#' + id);
    scrollToId(id);
  }, { passive: false });

  // Back/forward between hash states
  window.addEventListener('hashchange', function (e) {
    e.preventDefault();
    scrollToId(decodeURIComponent(location.hash.replace(/^#/, '')));
  });

  // If landing on /page#section, scroll smoothly after load/layout
  if (location.hash) {
    window.addEventListener('load', function () {
      setTimeout(function () {
        scrollToId(decodeURIComponent(location.hash.replace(/^#/, '')));
      }, 60);
    });
  }
})();
