/* ==========================================================================
   HOOPS DYNASTY — title screen behaviour
   Sections:
     1. Config (edit headlines, save key, etc. here)
     2. Menu actions  <-- plug in real screens here
     3. Toasts
     4. Menu setup (save lookup, stagger, click + keyboard navigation)
     5. News ticker
     6. Background dust particles
     7. Init
   ========================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------------------
     1. CONFIG
     ------------------------------------------------------------------------ */

  // Headlines shown in the LEAGUE NEWS ticker. Edit freely.
  const HEADLINES = [
    'Front offices prepare for the 2026 Draft',
    'Free agency opens next week',
    'Veteran point guard weighs a return to the league’s top contender',
    'Rookie scale talks heat up as the salary cap climbs',
    'Trade deadline buzz: three contenders eye a star wing',
    'Scouts flock to the combine as the draft board takes shape',
    'Coaching carousel spins: two franchises begin their searches'
  ];

  // localStorage key for the saved dynasty. The "Continue" button appears when
  // this holds JSON like: { "teamName": "Chicago Bulls", "season": 3 }
  const SAVE_KEY = 'hoopsDynasty.save';

  const TICKER_SPEED_PX_PER_SEC = 55; // lower = slower scroll
  const TOAST_DURATION_MS = 2800;
  const MAX_TOASTS = 3;
  const PARTICLE_COUNT = 26;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const $ = (selector, root = document) => root.querySelector(selector);


  /* ------------------------------------------------------------------------
     3. TOASTS  (defined first because the actions below use it)
     ------------------------------------------------------------------------ */

  const toastRoot = $('#toasts');

  const INFO_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 11v6"/><circle cx="12" cy="7.2" r="0.6" fill="currentColor"/></svg>';

  // Shows "[label] — coming soon" and removes itself after a moment.
  function showToast(label) {
    // Keep the stack tidy: drop the oldest toast if we're at the limit.
    while (toastRoot.children.length >= MAX_TOASTS) dismissToast(toastRoot.firstElementChild);

    const toast = document.createElement('div');
    toast.className = 'toast';

    const icon = document.createElement('div');
    icon.className = 'toast-icon';
    icon.innerHTML = INFO_ICON;

    const text = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = label;                 // textContent keeps it injection-safe
    const rest = document.createElement('span');
    rest.textContent = ' — coming soon';
    text.append(strong, rest);

    toast.append(icon, text);
    toastRoot.appendChild(toast);

    setTimeout(() => dismissToast(toast), TOAST_DURATION_MS);
  }

  function dismissToast(toast) {
    if (!toast || toast.classList.contains('leaving')) return;
    toast.classList.add('leaving');
    // Remove after the exit animation (or right away when animations are off).
    setTimeout(() => toast.remove(), prefersReducedMotion.matches ? 0 : 300);
  }


  /* ------------------------------------------------------------------------
     2. MENU ACTIONS
     One handler per button, keyed by the button's data-action in index.html.
     To add a real screen, replace a soon(...) entry with your own function,
     e.g.  'new-dynasty': () => showScreen('new-dynasty')
     ------------------------------------------------------------------------ */

  const soon = (label) => () => showToast(label);

  const ACTIONS = {
    'continue':     soon('Continue'),
    'new-dynasty':  soon('New Dynasty'),
    'load-dynasty': soon('Load Dynasty'),
    'quick-game':   soon('Quick Game'),
    'settings':     soon('Settings'),
    'how-to-play':  soon('How to Play')
  };


  /* ------------------------------------------------------------------------
     4. MENU SETUP
     ------------------------------------------------------------------------ */

  const menu = $('#menu');
  const buttons = () => [...menu.querySelectorAll('.menu-btn')];
  const visibleButtons = () => buttons().filter((b) => !b.hidden);

  // Returns { teamName, season } if a valid save exists, otherwise null.
  function readSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const save = JSON.parse(raw);
      if (save && typeof save.teamName === 'string' && save.teamName.trim()) {
        return { teamName: save.teamName.trim(), season: save.season ?? 1 };
      }
    } catch (err) {
      /* Storage blocked or corrupt JSON: behave as if there is no save. */
    }
    return null;
  }

  // Show "Continue" (with team + season) only when a save exists.
  function setupContinue() {
    const btn = $('#continue-btn');
    const save = readSave();
    if (!save) {
      btn.hidden = true;
      return;
    }
    $('.sub', btn).textContent = `${save.teamName} · Season ${save.season}`;
    btn.hidden = false;
  }

  // Number the visible buttons so the CSS can stagger their entrance (~80ms apart).
  function staggerButtons() {
    visibleButtons().forEach((btn, i) => btn.style.setProperty('--i', i));
  }

  // One click listener for every button (mouse, touch and Enter/Space all land here).
  menu.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;
    const handler = ACTIONS[btn.dataset.action];
    if (handler) handler({ button: btn, action: btn.dataset.action });
  });

  // Arrow Up/Down (plus Home/End) move focus through the visible buttons.
  // Enter activates the focused button natively.
  document.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;

    const items = visibleButtons();
    if (!items.length) return;
    event.preventDefault();

    const current = items.indexOf(document.activeElement);
    let next;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else if (current === -1) next = event.key === 'ArrowDown' ? 0 : items.length - 1;
    else next = (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;

    items[next].focus();
  });


  /* ------------------------------------------------------------------------
     5. NEWS TICKER
     ------------------------------------------------------------------------ */

  const tickerViewport = $('#ticker-viewport');
  const tickerTrack = $('#ticker-track');

  function buildTicker() {
    if (!HEADLINES.length) return;
    tickerTrack.replaceChildren();

    const addHeadlines = (list, hidden) => {
      HEADLINES.forEach((text) => {
        const li = document.createElement('li');
        li.textContent = text;
        if (hidden) li.setAttribute('aria-hidden', 'true');
        list.appendChild(li);
      });
    };

    const first = document.createElement('ul');
    first.className = 'ticker-list';
    addHeadlines(first, false);
    tickerTrack.appendChild(first);

    // Repeat the headlines until one list is wider than the screen, so there is never a gap.
    for (let i = 0; i < 10 && first.offsetWidth < tickerViewport.clientWidth; i++) {
      addHeadlines(first, true);
    }

    // A second identical list makes the CSS -50% loop seamless.
    const second = first.cloneNode(true);
    second.setAttribute('aria-hidden', 'true');
    tickerTrack.appendChild(second);

    // Constant scroll speed regardless of how many headlines there are.
    const seconds = Math.max(20, first.offsetWidth / TICKER_SPEED_PX_PER_SEC);
    tickerTrack.style.setProperty('--ticker-duration', `${seconds}s`);
  }

  // Rebuild after resizes (debounced) so the loop always covers the viewport.
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildTicker, 250);
  });


  /* ------------------------------------------------------------------------
     6. BACKGROUND DUST
     ------------------------------------------------------------------------ */

  function createParticles() {
    if (prefersReducedMotion.matches) return;
    const root = $('#particles');
    const rand = (min, max) => min + Math.random() * (max - min);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = document.createElement('span');
      p.className = 'particle';
      p.style.setProperty('--x', `${rand(0, 100)}%`);
      p.style.setProperty('--s', `${rand(1.5, 3.5)}px`);
      p.style.setProperty('--o', rand(0.25, 0.6).toFixed(2));
      p.style.setProperty('--dx', `${rand(-60, 60)}px`);
      p.style.setProperty('--d', `${rand(22, 44)}s`);
      p.style.setProperty('--delay', `${-rand(0, 44)}s`); // negative = already mid-flight at load
      root.appendChild(p);
    }
  }


  /* ------------------------------------------------------------------------
     7. INIT
     ------------------------------------------------------------------------ */

  setupContinue();
  staggerButtons();
  buildTicker();
  createParticles();
})();
