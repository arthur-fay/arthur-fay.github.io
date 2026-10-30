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
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b1020' : '#f5f8fd');
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
  const selectFilter = (button) => {
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
  };
  filters.forEach((button) => button.addEventListener('click', () => selectFilter(button)));

  // A direct project link must still work after a category has hidden its target.
  const revealLinkedProject = (hash) => {
    if (!hash || !hash.startsWith('#')) return null;
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch (_) { return null; }
    const target = document.getElementById(id);
    const project = target?.closest('.project[data-category]');
    const all = filters.find((button) => button.dataset.filter === 'all');
    if (!project?.hidden || !all) return null;
    selectFilter(all);
    return target;
  };
  // Unhide before the browser performs its default fragment scroll, including
  // repeated links to the same hash (which do not dispatch hashchange).
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href^="#"]');
    if (link) revealLinkedProject(link.getAttribute('href'));
  });
  window.addEventListener('hashchange', () => {
    const target = revealLinkedProject(window.location.hash);
    if (target) target.scrollIntoView({ block: 'start' });
  });

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

  /* Reading copy is visible immediately; only diagrams need motion observers. */
  document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
  /* The active navigation link still follows the section in view. */
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

  /* Interactive system model: a bounded SVG camera, direct layer inspection and optional ambient motion. */
  const hero = document.querySelector('.hero');
  const iso = hero && hero.querySelector('.iso');
  const systemFigure = hero && hero.querySelector('.system-figure');
  const motionButton = document.getElementById('system-motion');
  if (systemFigure && iso && motionButton) {
    const explorer = document.getElementById('system-explorer');
    const inspector = document.getElementById('system-inspector');
    const viewport = systemFigure.querySelector('.system-viewport');
    const layerButtons = [...systemFigure.querySelectorAll('[data-system-layer]')];
    const layerTitle = document.getElementById('system-layer-title');
    const layerCopy = document.getElementById('system-layer-copy');
    const relatedWork = document.getElementById('system-related-work');
    const viewbar = document.getElementById('system-viewbar');
    const viewLabel = document.getElementById('system-view-label');
    const viewHint = document.getElementById('system-view-hint');
    const resetButton = document.getElementById('system-reset');
    const partsList = document.getElementById('system-layer-parts');
    const camera = iso.querySelector('.iso-camera');
    const scene = iso.querySelector('.iso-plates');
    const plates = [...iso.querySelectorAll('[data-depth]')];
    const layers = {
      '1': ['01 / Data', 'Start with trustworthy inputs. Versioned files, seeded scenarios and integrity checks make each experiment repeatable.', '#plate-commerce', ['Versioned inputs', 'Seeded scenarios', 'Integrity checks']],
      '2': ['02 / Models', 'Turn inputs into results. Forecasting models, route searches and detection rules are inspectable in the project source.', '#plate-atlas', ['Forecasting', 'Pathfinding', 'Detection rules']],
      '3': ['03 / Evaluation', 'Check the results before trusting them. Backtests, calibration checks, precision and recall make errors and limitations visible.', '#atlas-detail', ['Backtests', 'Calibration', 'Precision / recall']],
      '4': ['04 / Interface', 'Make the system usable. APIs, dashboards and keyboard-operable browser labs let people explore the underlying behavior.', '#plate-pathfinding', ['REST APIs', 'Dashboards', 'Browser labs']],
      '5': ['05 / Evidence', 'Show how the work can be verified. Source code, automated tests, documentation and release gates support a careful review.', '#hiring', ['Source code', 'Automated tests', 'Release gates']],
    };
    let selectedLayer = null;
    let keyboardLayer = '1';
    let userPaused = false;
    let inView = true;
    try { userPaused = window.localStorage.getItem('af-system-motion') === 'paused'; } catch (_) { /* optional preference */ }
    const updateMotion = () => {
      const enabled = !userPaused && !reduceMotion.matches;
      const running = enabled && inView && !document.hidden;
      systemFigure.dataset.motion = running ? 'playing' : 'paused';
      motionButton.disabled = reduceMotion.matches;
      motionButton.textContent = reduceMotion.matches ? 'Motion reduced' : (userPaused ? 'Play animation' : 'Pause animation');
      if (reduceMotion.matches) motionButton.setAttribute('title', 'Your device requests reduced motion. Layer controls still work.');
      else motionButton.removeAttribute('title');
      if (!enabled) systemFigure.classList.add('is-built');
      if (!running) { iso.style.setProperty('--px', '0'); iso.style.setProperty('--py', '0'); }
    };
    systemFigure.classList.add('is-enhanced');
    systemFigure.dataset.view = 'overview';
    explorer.hidden = false;
    inspector.hidden = false;
    viewbar.hidden = false;
    // The static SVG is one image. Enhanced, it is a labelled group with keyboard-operable plates.
    iso.setAttribute('role', 'group');
    iso.setAttribute('aria-describedby', 'system-view-hint');
    updateMotion();
    motionButton.addEventListener('click', () => {
      userPaused = !userPaused;
      try { window.localStorage.setItem('af-system-motion', userPaused ? 'paused' : 'playing'); } catch (_) { /* optional preference */ }
      updateMotion();
    });
    const selectLayer = (id) => {
      const detail = layers[id];
      const focusedPlate = plates.find((plate) => plate === document.activeElement);
      selectedLayer = detail ? id : null;
      if (detail) keyboardLayer = id;
      systemFigure.classList.add('is-built');
      systemFigure.dataset.view = detail ? 'layer' : 'overview';
      systemFigure.dataset.layer = selectedLayer || '';
      iso.style.setProperty('--px', '0');
      iso.style.setProperty('--py', '0');
      layerButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.systemLayer === selectedLayer)));
      plates.forEach((plate) => {
        const active = plate.dataset.depth === selectedLayer;
        plate.classList.toggle('is-selected', active);
        plate.setAttribute('aria-pressed', String(active));
        plate.setAttribute('tabindex', plate.dataset.depth === keyboardLayer ? '0' : '-1');
        // Restore the original painter order before bringing the focused plate to the foreground.
        scene.appendChild(plate);
      });
      if (detail) {
        const plate = plates.find((item) => item.dataset.depth === id);
        const bounds = plate.querySelector('.iso-slab').getBBox();
        // Fit the actual slab, leaving a 50-unit margin on either side. The camera never crops it.
        const scale = Math.min(1.5, 500 / bounds.width, 360 / bounds.height);
        const x = 300 - (bounds.x + bounds.width / 2) * scale;
        const y = 280 - (bounds.y + bounds.height / 2) * scale;
        camera.style.transform = `translate(${x.toFixed(3)}px, ${y.toFixed(3)}px) scale(${scale.toFixed(5)})`;
        scene.appendChild(plate);
        layerTitle.textContent = detail[0];
        layerCopy.textContent = detail[1];
        [...partsList.children].forEach((part, index) => { part.textContent = detail[3][index]; });
        relatedWork.setAttribute('href', detail[2]);
      } else {
        camera.style.transform = 'none';
        layerTitle.textContent = 'Five layers. One system.';
        layerCopy.textContent = 'Click a plate or choose a layer to zoom in and inspect its role. Switch layers to explore, or return to the full system.';
        relatedWork.setAttribute('href', '#systems');
      }
      partsList.hidden = !detail;
      viewLabel.textContent = detail ? detail[0] : 'Full system';
      viewHint.textContent = detail ? 'Select again to zoom out' : 'Click or tap a layer to zoom';
      resetButton.setAttribute('aria-pressed', String(!detail));
      // Moving an SVG group in the painter order must not lose keyboard focus.
      if (focusedPlate) focusedPlate.focus({ preventScroll: true });
    };
    const frameSelection = () => {
      // Keep the controls and the focused surface together, even when a phone has scrolled down to a button.
      const box = viewport.getBoundingClientRect();
      const safeTop = (parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 72) + 16;
      const safeBottom = window.innerHeight - 16;
      const bottom = box.top + box.height * (selectedLayer ? 0.8 : 1);
      let top = viewbar.getBoundingClientRect().top;
      if (bottom - top > safeBottom - safeTop) top = explorer.getBoundingClientRect().top;
      const delta = top < safeTop ? top - safeTop : (bottom > safeBottom ? Math.min(top - safeTop, bottom - safeBottom) : 0);
      if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    };
    const toggleLayer = (id) => {
      selectLayer(selectedLayer === id ? null : id);
      frameSelection();
    };
    layerButtons.forEach((button) => button.addEventListener('click', () => toggleLayer(button.dataset.systemLayer)));
    resetButton.addEventListener('click', () => { selectLayer(null); frameSelection(); });
    plates.forEach((plate, index) => {
      const id = plate.dataset.depth;
      plate.setAttribute('role', 'button');
      plate.setAttribute('aria-label', `Inspect ${layers[id][0].split(' / ')[1]} layer`);
      plate.setAttribute('aria-controls', 'system-layer-detail');
      plate.setAttribute('aria-pressed', 'false');
      plate.setAttribute('tabindex', id === keyboardLayer ? '0' : '-1');
      plate.addEventListener('click', () => toggleLayer(id));
      plate.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleLayer(id);
          return;
        }
        const keys = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
        let target;
        if (keys[event.key]) target = plates[(index + keys[event.key] + plates.length) % plates.length];
        else if (event.key === 'Home') target = plates[0];
        else if (event.key === 'End') target = plates[plates.length - 1];
        if (target) {
          event.preventDefault();
          selectLayer(target.dataset.depth);
          target.focus({ preventScroll: true });
          frameSelection();
        }
      });
    });
    systemFigure.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && selectedLayer) {
        event.preventDefault();
        selectLayer(null);
        frameSelection();
      }
    });
    iso.addEventListener('animationend', (event) => {
      if (event.animationName === 'iso-draw' && event.target.classList.contains('iso-dim')) systemFigure.classList.add('is-built');
    });
    document.addEventListener('visibilitychange', updateMotion);
    if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', updateMotion);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => entries.forEach((entry) => {
        inView = entry.isIntersecting;
        hero.classList.toggle('is-offscreen', !inView);
        updateMotion();
      })).observe(systemFigure);
    }
  }
  // Pointer movement adds depth without competing with the nested floating groups.
  if (hero && iso && finePointer.matches && !reduceMotion.matches) {
    let frame = false;
    let next = [0, 0];
    const apply = () => {
      if (reduceMotion.matches || (systemFigure && (systemFigure.dataset.motion !== 'playing' || systemFigure.dataset.view === 'layer'))) next = [0, 0];
      iso.style.setProperty('--px', next[0].toFixed(2));
      iso.style.setProperty('--py', next[1].toFixed(2));
      frame = false;
    };
    hero.addEventListener('pointermove', (event) => {
      if (reduceMotion.matches || (systemFigure && (systemFigure.dataset.motion !== 'playing' || systemFigure.dataset.view === 'layer'))) return;
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
