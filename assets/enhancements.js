/* Theme is applied before styles load; UI enhancements start after the JSON data is ready. */
(function (root) {
  'use strict';
  const documentRoot = document.documentElement;
  const storageKey = 'plottwist:theme';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let theme = 'dark';
  try {
    const saved = localStorage.getItem(storageKey);
    if (['light', 'dark'].includes(saved)) theme = saved;
  } catch {
    /* Keep theme switching available for this page. */
  }
  let translate;
  let notify;
  let initialized = false;
  let scrollFrame = 0;
  let revealObserver;
  let counterObserver;
  const countersSeen = new WeakSet();
  const counterFrames = new Map();

  function applyTheme() {
    documentRoot.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'light' ? '#faf4ec' : '#1c1719';
    const toggle = document.querySelector('#theme-toggle');
    if (toggle && translate) {
      toggle.setAttribute('aria-pressed', String(theme === 'light'));
      toggle.title = translate(theme === 'light' ? 'theme.toDark' : 'theme.toLight');
      toggle.querySelector('[data-theme-icon]').textContent = theme === 'light' ? '☾' : '☀';
    }
  }
  applyTheme();

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    let saved = true;
    try {
      localStorage.setItem(storageKey, theme);
    } catch {
      saved = false;
    }
    applyTheme();
    notify(translate(saved ? 'theme.' + theme : 'theme.session'));
  }

  async function copy(text) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      notify(translate('copy.success'));
      return true;
    } catch {
      notify(translate('copy.error'));
      return false;
    }
  }

  function reveal(element, animate = true) {
    element.classList.remove('reveal-pending');
    element.classList.add('reveal-visible');
    if (animate && !motion.matches && root.jQuery) {
      root.jQuery(element).stop(true, true).css('opacity', 0).animate({ opacity: 1 }, 360);
    } else element.style.opacity = '1';
  }

  function animateCounter(element) {
    const target = Number(element.dataset.count);
    if (!Number.isFinite(target) || target < 0) return;
    if (motion.matches || !target) {
      element.textContent = String(target);
      return;
    }
    const start = performance.now();
    function tick(now) {
      const fraction = Math.min(1, (now - start) / 650);
      element.textContent = String(Math.round(target * (1 - Math.pow(1 - fraction, 3))));
      if (fraction < 1 && !motion.matches && element.isConnected) {
        counterFrames.set(element, requestAnimationFrame(tick));
      } else {
        element.textContent = String(target);
        counterFrames.delete(element);
      }
    }
    element.textContent = '0';
    counterFrames.set(element, requestAnimationFrame(tick));
  }

  function updateScroll() {
    scrollFrame = 0;
    const header = document.querySelector('#site-header');
    const headerHeight = header?.getBoundingClientRect().height || 0;
    documentRoot.style.setProperty('--header-height', headerHeight + 'px');
    const scrolled = scrollY > 24;
    header?.classList.toggle('is-scrolled', scrolled);
    const topButton = document.querySelector('#back-to-top');
    if (topButton) topButton.hidden = scrollY < 500;
    const links = Array.from(document.querySelectorAll('[data-section-link]'));
    let current = '';
    for (const link of links) {
      const section = document.getElementById(link.dataset.sectionLink);
      if (section && section.getBoundingClientRect().top <= headerHeight + 65) current = section.id;
    }
    // The final section may be shorter than the viewport.
    if (links.length && scrollY > 100 && innerHeight + scrollY >= documentRoot.scrollHeight - 4) {
      current = links[links.length - 1].dataset.sectionLink;
    }
    for (const link of links) {
      const active = link.dataset.sectionLink === current;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }
  function scheduleScroll() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
  }

  function init({ t, toast }) {
    translate = t;
    notify = toast;
    if (initialized) return;
    initialized = true;
    const topButton = document.createElement('button');
    topButton.id = 'back-to-top';
    topButton.className = 'back-to-top';
    topButton.hidden = true;
    topButton.textContent = '↑';
    topButton.onclick = () => {
      window.scrollTo({ top: 0, behavior: motion.matches ? 'instant' : 'smooth' });
      document.querySelector('.brand')?.focus({ preventScroll: true });
    };
    document.body.append(topButton);
    window.addEventListener('scroll', scheduleScroll, { passive: true });
    window.addEventListener('resize', scheduleScroll);
    if ('ResizeObserver' in root)
      new ResizeObserver(scheduleScroll).observe(document.querySelector('#site-header'));
    document.addEventListener('focusin', (event) => {
      const hiddenSection = event.target.closest('.reveal-pending');
      if (hiddenSection) reveal(hiddenSection, false);
    });
    motion.addEventListener('change', () => {
      if (!motion.matches) return;
      document.querySelectorAll('.reveal-pending').forEach((element) => reveal(element, false));
      for (const [element, frame] of counterFrames) {
        cancelAnimationFrame(frame);
        element.textContent = element.dataset.count;
      }
      counterFrames.clear();
    });
  }

  function refresh() {
    if (!initialized) return;
    document.querySelector('#back-to-top').setAttribute('aria-label', translate('scroll.top'));
    document.querySelector('#back-to-top').title = translate('scroll.top');
    applyTheme();
    revealObserver?.disconnect();
    counterObserver?.disconnect();
    for (const [element, frame] of counterFrames)
      if (!element.isConnected) {
        cancelAnimationFrame(frame);
        counterFrames.delete(element);
      }
    const canAnimate = !motion.matches && 'IntersectionObserver' in root;
    if (canAnimate && !revealObserver) {
      revealObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries)
            if (entry.isIntersecting) {
              reveal(entry.target);
              revealObserver.unobserve(entry.target);
            }
        },
        { threshold: 0.08 },
      );
      counterObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries)
            if (entry.isIntersecting) {
              countersSeen.add(entry.target);
              animateCounter(entry.target);
              counterObserver.unobserve(entry.target);
            }
        },
        { threshold: 0.6 },
      );
    }
    document
      .querySelectorAll(
        'main .section-head, main .callout, main .result-card, main .kit-block, main .stats',
      )
      .forEach((element) => {
        if (!canAnimate) reveal(element, false);
        else {
          if (
            !element.classList.contains('reveal-visible') &&
            element.getBoundingClientRect().top > innerHeight - 20
          ) {
            element.classList.add('reveal-pending');
          }
          if (element.classList.contains('reveal-pending')) revealObserver.observe(element);
        }
      });
    document.querySelectorAll('[data-count]').forEach((element) => {
      if (canAnimate && !countersSeen.has(element)) counterObserver.observe(element);
      else element.textContent = element.dataset.count;
    });
    scheduleScroll();
  }

  root.PlotEnhancements = {
    init,
    refresh,
    toggleTheme,
    copy,
    get theme() {
      return theme;
    },
  };
})(globalThis);
