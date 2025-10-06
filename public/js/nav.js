(function () {
  const btn = document.getElementById('hamburger');
  const nav = document.getElementById('site-nav');
  if (!btn || !nav) return;

  const isDesktop = () => matchMedia('(min-width:901px)').matches;

  function closeAllSubmenus() {
    nav.querySelectorAll('.menu-group.expanded').forEach(g => g.classList.remove('expanded'));
  }

  function toggleNav() {
    const open = !nav.classList.contains('open');
    nav.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    if (!open) closeAllSubmenus();
  }

  btn.addEventListener('click', toggleNav);

  // Accordion behaviour for submenus on mobile
  nav.addEventListener('click', (e) => {
    if (isDesktop()) return;
    const link = e.target.closest('.menu-link.has-sub');
    if (!link) return;
    e.preventDefault();
    const group = link.closest('.menu-group');
    if (group) group.classList.toggle('expanded');
  });

  // Reset when growing to desktop
  window.addEventListener('resize', () => {
    if (isDesktop()) {
      nav.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      closeAllSubmenus();
    }
  }, { passive: true });
})();
