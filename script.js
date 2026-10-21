/*
 * Arthur Fay — The Architect Lab. Shared behaviour for the portfolio and both labs.
 * Dependency-free and CSP-safe: no inline scripts, no dynamic code, no markup injection, no network access,
 * no analytics. Every element is optional because the labs share this file.
 */
(() => {
  "use strict";
  const root = document.documentElement;
  root.classList.add('js');
  const reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const finePointer = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : { matches: false };

  /* Theme: a stored override wins; otherwise follow the system preference. */
  const themeButton = document.getElementById('theme-toggle');
  let storedTheme = null;
  try { storedTheme = window.localStorage.getItem('af-portfolio-theme'); } catch (_) { /* storage may be blocked */ }
  const initialTheme = storedTheme === 'dark' || storedTheme === 'light'
    ? storedTheme
    : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  const setTheme = (theme) => {
    root.setAttribute('data-theme', theme);
    if (themeButton) {
      const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
      themeButton.setAttribute('aria-label', label);
      themeButton.setAttribute('title', label);
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b0e13' : '#f4f2ec');
  };
  setTheme(initialTheme);
  if (themeButton) {
    themeButton.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      setTheme(next);
      try { window.localStorage.setItem('af-portfolio-theme', next); } catch (_) { /* optional preference */ }
    });
  }

  /* Mobile navigation: toggle button, Escape to close, focus returned to the button. */
  const menuButton = document.getElementById('menu-toggle');
  const mobileNav = document.getElementById('mobile-nav');
  if (menuButton && mobileNav) {
    const closeMenu = () => {
      mobileNav.hidden = true;
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Open navigation');
    };
    menuButton.addEventListener('click', () => {
      const shouldOpen = mobileNav.hidden;
      mobileNav.hidden = !shouldOpen;
      menuButton.setAttribute('aria-expanded', String(shouldOpen));
      menuButton.setAttribute('aria-label', shouldOpen ? 'Close navigation' : 'Open navigation');
      if (shouldOpen) {
        const first = mobileNav.querySelector('a');
        if (first) first.focus();
      }
    });
    mobileNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !mobileNav.hidden) {
        closeMenu();
        menuButton.focus();
      }
    });
    document.addEventListener('focusin', (event) => {
      // Tabbing out of the open menu (past its last link) closes it so focus never lands behind the panel.
      if (!mobileNav.hidden && !mobileNav.contains(event.target) && event.target !== menuButton && !menuButton.parentElement.contains(event.target)) closeMenu();
    });
    // The stylesheet shows the full header from 1001px up (six primary links); close the menu once it is no longer needed.
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1000 && !mobileNav.hidden) closeMenu();
    }, { passive: true });
  }

  /* Project filters: a card may belong to several space-separated categories. */
  const filters = [...document.querySelectorAll('[data-filter]')];
  const projects = [...document.querySelectorAll('.project[data-category]')];
  const liveStatus = document.getElementById('filter-status');
  filters.forEach((button) => button.addEventListener('click', () => {
    const selected = button.dataset.filter;
    let visible = 0;
    filters.forEach((b) => {
      const active = b === button;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    projects.forEach((project) => {
      const categories = (project.dataset.category || '').split(/\s+/);
      const show = selected === 'all' || categories.includes(selected);
      project.hidden = !show;
      if (show) visible += 1;
    });
    if (liveStatus) liveStatus.textContent = `Showing ${visible} ${visible === 1 ? 'project' : 'projects'}.`;
  }));

  /* Reading progress line. */
  const progress = document.getElementById('reading-progress');
  if (progress) {
    let pending = false;
    const updateProgress = () => {
      const total = root.scrollHeight - window.innerHeight;
      const fraction = total > 0 ? Math.max(0, Math.min(1, window.scrollY / total)) : 0;
      progress.style.width = `${(fraction * 100).toFixed(2)}%`;
      pending = false;
    };
    window.addEventListener('scroll', () => {
      if (!pending) { pending = true; requestAnimationFrame(updateProgress); }
    }, { passive: true });
    window.addEventListener('resize', updateProgress, { passive: true });
    updateProgress();
  }

  /* Section cut: an accessible tab interface over the four project panels (arrow keys, Home/End). */
  const cut = document.getElementById('section-cut');
  if (cut) {
    const tabs = [...cut.querySelectorAll('[role="tab"]')];
    const panels = [...cut.querySelectorAll('[role="tabpanel"]')];
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const active = t === tab;
        t.setAttribute('aria-selected', String(active));
        t.setAttribute('tabindex', active ? '0' : '-1');
      });
      panels.forEach((panel) => {
        const active = panel.id === tab.getAttribute('aria-controls');
        panel.classList.toggle('is-active', active);
        panel.hidden = !active;
      });
      cut.setAttribute('data-selected', tab.dataset.cut || '');
      if (focus) tab.focus();
    };
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => select(tab, false));
      tab.addEventListener('keydown', (event) => {
        const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        let target = null;
        if (keys[event.key]) target = tabs[(index + keys[event.key] + tabs.length) % tabs.length];
        else if (event.key === 'Home') target = tabs[0];
        else if (event.key === 'End') target = tabs[tabs.length - 1];
        if (target) { event.preventDefault(); select(target, true); }
      });
    });
    const initial = tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0];
    if (initial) select(initial, false);
    // The rail is vertical beside the stage on wide screens and a horizontal strip above it otherwise.
    const tablist = cut.querySelector('[role="tablist"]');
    const wide = window.matchMedia ? window.matchMedia('(min-width: 981px)') : null;
    if (tablist && wide) {
      const orient = () => tablist.setAttribute('aria-orientation', wide.matches ? 'vertical' : 'horizontal');
      orient();
      if (wide.addEventListener) wide.addEventListener('change', orient);
    }
    // Deep links such as #cut-security select the matching panel.
    const fromHash = () => {
      const match = tabs.find((t) => `#${t.getAttribute('aria-controls')}` === window.location.hash);
      if (!match) return;
      select(match, false);
      // Hiding the other panels moves the target; bring the selected cut back into view (scroll-padding keeps it under the header).
      requestAnimationFrame(() => cut.scrollIntoView({ block: 'start' }));
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
  }

  /* Scroll reveals and the active navigation link, both via IntersectionObserver with safe fallbacks. */
  const revealed = [...document.querySelectorAll('[data-reveal]')];
  if ('IntersectionObserver' in window && !reduceMotion.matches && revealed.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealed.forEach((el) => observer.observe(el));
  } else {
    revealed.forEach((el) => el.classList.add('is-visible'));
  }
  const navLinks = [...document.querySelectorAll('.desktop-nav a[href^="#"]')];
  const sections = navLinks.map((link) => document.getElementById(link.getAttribute('href').slice(1))).filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    const ratios = new Map();
    const setCurrent = () => {
      let best = null;
      for (const [section, ratio] of ratios) if (ratio > 0 && (!best || ratio > ratios.get(best))) best = section;
      navLinks.forEach((link) => {
        const active = best && link.getAttribute('href') === `#${best.id}`;
        if (active) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current');
      });
    };
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => ratios.set(entry.target, entry.intersectionRatio));
      setCurrent();
    }, { rootMargin: '-35% 0px -45% 0px', threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
    sections.forEach((section) => spy.observe(section));
  }

  /* Hero drawing: a restrained pointer parallax for fine pointers when motion is allowed. */
  const hero = document.querySelector('.hero');
  const iso = hero && hero.querySelector('.iso');
  if (hero && iso && 'IntersectionObserver' in window) {
    // The drawing's flow line loops forever; pause it while the hero is scrolled out of view.
    new IntersectionObserver((entries) => entries.forEach((entry) => hero.classList.toggle('is-offscreen', !entry.isIntersecting))).observe(hero);
  }
  if (hero && iso && finePointer.matches && !reduceMotion.matches) {
    let frame = false;
    let next = [0, 0];
    const apply = () => { iso.style.setProperty('--px', next[0].toFixed(2)); iso.style.setProperty('--py', next[1].toFixed(2)); frame = false; };
    hero.addEventListener('pointermove', (event) => {
      const rect = hero.getBoundingClientRect();
      next = [((event.clientX - rect.left) / rect.width - 0.5) * 2, ((event.clientY - rect.top) / rect.height - 0.5) * 2];
      if (!frame) { frame = true; requestAnimationFrame(apply); }
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { next = [0, 0]; if (!frame) { frame = true; requestAnimationFrame(apply); } });
  }

  const year = document.getElementById('copyright-year');
  if (year) year.textContent = String(new Date().getFullYear());
  // The portfolio intentionally contains no analytics/tracking, paid integrations or user-input forms.
})();
