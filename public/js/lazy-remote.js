// public/js/lazy-remote.js
(function () {
  if (window.__lazyRemoteLoaded) return;
  window.__lazyRemoteLoaded = true;

  var loaded = new Set();

  function injectCSS(href) {
    if (!href || loaded.has(href)) return Promise.resolve();
    return new Promise(function (res, rej) {
      var el = document.createElement('link');
      el.rel = 'stylesheet';
      el.href = href;
      el.onload = function () { loaded.add(href); res(null); };
      el.onerror = rej;
      document.head.appendChild(el);
    });
  }

  function injectJS(src) {
    if (!src || loaded.has(src)) return Promise.resolve();
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src;
      s.defer = true;
      s.onload = function () { loaded.add(src); res(null); };
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  function activate(el) {
    if (el.__activated) return;
    el.__activated = true;

    var css = el.getAttribute('data-css');
    var js = el.getAttribute('data-js');
    var iframeSrc = el.getAttribute('data-src');

    var afterDeps = Promise.resolve();
    if (css || js) {
      afterDeps = Promise.all([injectCSS(css), injectJS(js)]);
    }

    afterDeps.then(function () {
      // swap in the iframe
      var iframe = document.createElement('iframe');
      iframe.src = iframeSrc;
      iframe.loading = 'lazy';
      iframe.style.width = '100%';
      iframe.style.border = '0';
      iframe.setAttribute('title', el.getAttribute('data-title') || 'Listings');
      var h = el.getAttribute('data-height') || '720';
      iframe.style.height = (/^\d+$/.test(h) ? h + 'px' : h);

      el.innerHTML = '';
      el.appendChild(iframe);
      el.classList.add('rv-active');
    }).catch(function () {
      el.classList.add('rv-error');
      el.innerHTML = '<div class="rv-error-msg">Unable to load listings. Please try again.</div>';
    });
  }

  function bind(el) {
    // Click-to-load fallback
    el.addEventListener('click', function () { activate(el); }, { once: true });

    // On-view load
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            activate(el);
            io.disconnect();
          }
        });
      });
      io.observe(el);
    }
  }

  // Auto-bind any placeholders on DOM ready
  function init() {
    document.querySelectorAll('.rv-lazy[data-src]').forEach(bind);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
