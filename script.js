(() => {
  "use strict";
  const root = document.documentElement;
  const themeButton = document.getElementById('theme-toggle');
  const menuButton = document.getElementById('menu-toggle');
  const mobileNav = document.getElementById('mobile-nav');
  const filters = [...document.querySelectorAll('[data-filter]')];
  const projects = [...document.querySelectorAll('.project[data-category]')];
  const liveStatus = document.getElementById('filter-status');
  const progress = document.getElementById('reading-progress');

  // A user override persists; absent an override, respect the system theme.
  let storedTheme = null;
  try { storedTheme = window.localStorage.getItem('af-portfolio-theme'); } catch (_) { /* storage may be blocked */ }
  const initialTheme = storedTheme === 'dark' || storedTheme === 'light'
    ? storedTheme
    : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  const setTheme = (theme) => {
    root.setAttribute('data-theme', theme);
    themeButton.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    themeButton.setAttribute('title', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b1017' : '#f6f7f2');
  };
  setTheme(initialTheme);
  themeButton.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { window.localStorage.setItem('af-portfolio-theme', next); } catch (_) { /* optional preference */ }
  });

  function closeMenu() {
    mobileNav.hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
  }
  menuButton.addEventListener('click', () => {
    const shouldOpen = mobileNav.hidden;
    mobileNav.hidden = !shouldOpen;
    menuButton.setAttribute('aria-expanded', String(shouldOpen));
    menuButton.setAttribute('aria-label', shouldOpen ? 'Close navigation' : 'Open navigation');
  });
  mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !mobileNav.hidden) {
      closeMenu();
      menuButton.focus();
    }
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 780 && !mobileNav.hidden) closeMenu();
  });

  filters.forEach(button => button.addEventListener('click', () => {
    const selected = button.dataset.filter;
    let visible = 0;
    filters.forEach(b => {
      const active = b === button;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    projects.forEach(project => {
      const show = selected === 'all' || project.dataset.category === selected;
      project.hidden = !show;
      if (show) visible += 1;
    });
    liveStatus.textContent = `Showing ${visible} ${visible === 1 ? 'project' : 'projects'}.`;
  }));

  let pending = false;
  function updateProgress() {
    const total = root.scrollHeight - window.innerHeight;
    const fraction = total > 0 ? Math.max(0, Math.min(1, window.scrollY / total)) : 0;
    progress.style.width = `${(fraction * 100).toFixed(2)}%`;
    pending = false;
  }
  window.addEventListener('scroll', () => {
    if (!pending) { pending = true; requestAnimationFrame(updateProgress); }
  }, { passive: true });
  window.addEventListener('resize', updateProgress, { passive: true });
  updateProgress();
  // The portfolio intentionally contains no analytics/tracking, paid integrations or user-input forms.
})();
