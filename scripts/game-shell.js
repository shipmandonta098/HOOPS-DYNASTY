/* ==========================================================================
   HOOPS DYNASTY — in-game shell (front office layout)
   Sidebar navigation on desktop, slide-out drawer on phones, a top bar
   with simulation controls, and the section router. Sections render from
   the active dynasty save only.

   HDGameShell.init({
     root,                 // #dashboard-screen
     onExit(save),         // Save & Exit -> Promise (persist, go to title)
     onSettings(),         // open the global Settings screen
     onSectionChange(id)   // let the page router record the section
   }) -> { open(save, sectionId), currentId(), currentSave(), clear() }

   Adding a section = one entry in SECTIONS with a render(container, save).
   ========================================================================== */
(function () {
  'use strict';

  var dom = window.HDDom;
  var el = dom.el;

  function D() { return window.HDDynasty; }

  /* --- Section renderers -------------------------------------------------- */

  function sectionHeader(save, title, sub) {
    var team = D().userTeam(save);
    return el('header', { class: 'gs-section-head' }, [
      el('p', { class: 'hd-eyebrow', text: team.fullName + ' · ' + save.calendar.seasonLabel }),
      el('h1', { class: 'gs-section-title', tabindex: '-1', text: title }),
      sub ? el('p', { class: 'gs-section-sub', text: sub }) : null
    ]);
  }

  function renderRoster(container, save) {
    var c = window.HDDashboard.context(save);
    var R = window.HDRoster;
    var lu = save.lineups[c.team.id] || {};
    var starterPos = {};
    R.POSITIONS.forEach(function (pos) { if (lu[pos]) starterPos[lu[pos]] = pos; });
    var order = R.POSITIONS;
    var players = c.roster.slice().sort(function (a, b) {
      var sa = starterPos[a.id], sb = starterPos[b.id];
      if (sa && sb) return order.indexOf(sa) - order.indexOf(sb);
      if (sa) return -1;
      if (sb) return 1;
      return b.overall - a.overall || a.lastName.localeCompare(b.lastName);
    });

    var table = el('table', { class: 'gs-roster' }, [
      el('thead', null, [el('tr', null, [
        el('th', { scope: 'col', text: 'Player' }),
        el('th', { scope: 'col', text: 'Pos' }),
        el('th', { scope: 'col', class: 'is-num', text: 'Age' }),
        el('th', { scope: 'col', class: 'is-num gs-col-ht', text: 'Ht' }),
        el('th', { scope: 'col', class: 'is-num', text: 'OVR' }),
        el('th', { scope: 'col', class: 'is-num gs-col-pot', text: 'POT' }),
        el('th', { scope: 'col', class: 'gs-col-role', text: 'Role' })
      ])]),
      el('tbody', null, players.map(function (p) {
        var starter = starterPos[p.id];
        return el('tr', { class: starter ? 'is-starter' : null }, [
          el('th', { scope: 'row' }, [el('span', { class: 'gs-player' }, [
            dom.portrait(p.portrait, { className: 'gs-player-portrait', jersey: c.jersey }),
            el('span', { class: 'gs-player-text' }, [
              el('span', { class: 'gs-player-name', text: p.firstName + ' ' + p.lastName }),
              el('span', { class: 'gs-player-num', text: '#' + p.jerseyNumber + (starter ? ' · Starter' : '') })
            ])
          ])]),
          el('td', { text: p.position }),
          el('td', { class: 'is-num', text: String(p.age) }),
          el('td', { class: 'is-num gs-col-ht', text: R.heightLabel(p.heightIn) }),
          el('td', { class: 'is-num gs-ovr', text: String(p.overall) }),
          el('td', { class: 'is-num gs-col-pot', text: String(p.potential) }),
          el('td', { class: 'gs-col-role', text: starter ? 'Starter · ' + starter : 'Bench' })
        ]);
      }))
    ]);
    container.appendChild(sectionHeader(save, 'Roster', c.roster.length + ' players · Team overall ' + D().teamOverall(c.team)));
    container.appendChild(el('section', { class: 'hd-panel gs-panel', 'aria-label': 'Roster' }, [el('div', { class: 'gs-table-wrap' }, [table])]));
  }

  function renderFinances(container, save) {
    var c = window.HDDashboard.context(save);
    var cfg = save.finances.config;
    var Fn = window.HDFinance;
    container.appendChild(sectionHeader(save, 'Finances', 'League financial rules and your team’s position against them.'));
    container.appendChild(el('div', { class: 'gs-grid' }, [
      window.HDDashboard.panels.finances(save, c, { title: 'Payroll Overview' }),
      window.HDDashboard.panels.panel('League Rules · ' + save.calendar.seasonLabel, null, [
        el('dl', { class: 'db-fin' }, [
          ['Salary Cap', Fn.money(cfg.salaryCap)],
          ['Luxury Tax Threshold', Fn.money(cfg.luxuryTax)],
          ['Tax Brackets', Fn.money(cfg.taxBracketSize) + ' increments'],
          ['Tax Rates', cfg.taxRates.map(function (r) { return '$' + r.toFixed(2); }).join(' · ') + ' per $1']
        ].map(function (r) { return el('div', null, [el('dt', { text: r[0] }), el('dd', { text: r[1] })]); }))
      ])
    ]));
  }

  function traitBar(label, value) {
    return el('div', { class: 'gs-trait' }, [
      el('div', { class: 'gs-trait-head' }, [el('span', { text: label }), el('strong', { text: String(value) })]),
      el('span', { class: 'gs-trait-track', role: 'meter', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(value) }, [
        el('span', { style: { width: value + '%' } })
      ])
    ]);
  }

  function renderOwner(container, save) {
    var owner = D().userOwner(save);
    var UI = window.HDOwnerUI;
    var p = UI.personality(owner);
    container.appendChild(sectionHeader(save, 'Ownership', p.summary));
    container.appendChild(el('div', { class: 'gs-grid' }, [
      el('section', { class: 'hd-panel gs-panel', 'aria-label': 'Owner profile' }, [
        UI.ownerCard(owner),
        el('div', { class: 'gs-traits' }, [
          traitBar('Competitive Ambition', owner.traits.ambition),
          traitBar('Patience', owner.traits.patience),
          traitBar('Spending Willingness', owner.traits.spending)
        ])
      ]),
      el('section', { class: 'hd-panel gs-panel', 'aria-label': 'Owner confidence' }, [
        UI.confidenceMeter(owner.confidence),
        el('p', { class: 'gs-muted', text: 'Confidence will respond to results, spending and progress toward these objectives in a future update.' })
      ])
    ]));
    container.appendChild(UI.expectations(owner));
    if (owner.welcomeMessage) {
      container.appendChild(el('section', { class: 'hd-panel gs-panel gs-letter', 'aria-label': 'Welcome message' }, [
        el('h2', { class: 'hd-eyebrow', text: 'Original Welcome Message' }),
        el('p', { text: owner.welcomeMessage })
      ]));
    }
  }

  function placeholder(title, icon, text) {
    return function (container, save) {
      container.appendChild(sectionHeader(save, title));
      container.appendChild(el('section', { class: 'hd-panel gs-placeholder', 'aria-label': title + ' (coming soon)' }, [
        dom.icon(icon, 'gs-placeholder-icon'),
        el('p', { class: 'gs-placeholder-tag', text: 'Coming in a future update' }),
        el('p', { class: 'gs-placeholder-text', text: text })
      ]));
    };
  }

  var SECTIONS = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', render: function (c, save, ctx) { window.HDDashboard.render(c, save, ctx); } },
    { id: 'roster', label: 'Roster', icon: 'roster', render: renderRoster },
    { id: 'schedule', label: 'Schedule', icon: 'schedule', render: placeholder('Schedule', 'schedule', 'The full season schedule, results and upcoming games will appear here once the season calendar is introduced.') },
    { id: 'standings', label: 'Standings', icon: 'standings', render: placeholder('Standings', 'standings', 'Conference and league standings will appear here once regular-season games are played.') },
    { id: 'league', label: 'League', icon: 'league', render: placeholder('League', 'league', 'League-wide leaders, team comparisons and transactions will appear here.') },
    { id: 'front-office', label: 'Front Office', icon: 'office', render: placeholder('Front Office', 'office', 'Trades, free agency, the draft and staff management will live here.') },
    { id: 'finances', label: 'Finances', icon: 'finances', render: renderFinances },
    { id: 'owner', label: 'Owner', icon: 'owner', render: renderOwner },
    { id: 'settings', label: 'Settings', icon: 'settings', action: 'settings' }
  ];

  function sectionById(id) {
    for (var i = 0; i < SECTIONS.length; i++) if (SECTIONS[i].id === id && !SECTIONS[i].action) return SECTIONS[i];
    return SECTIONS[0];
  }

  /* --- Shell ------------------------------------------------------------- */

  function init(options) {
    var root = options.root;
    var $ = function (s) { return root.querySelector(s); };
    var nav = $('#gs-nav');
    var navList = $('[data-gs-nav-list]');
    var content = $('[data-gs-content]');
    var main = $('.gs-main');
    var scrim = $('[data-gs-scrim]');
    var menuBtn = $('[data-gs-menu]');
    var exitBtn = $('[data-gs-exit]');
    var save = null;
    var active = 'dashboard';
    var mobile = window.matchMedia('(max-width: 1023px)');

    // Nav items (built once)
    SECTIONS.forEach(function (s) {
      navList.appendChild(el('li', null, [
        el('button', { class: 'gs-nav-item', type: 'button', 'data-section': s.id }, [dom.icon(s.icon), el('span', { text: s.label })])
      ]));
    });

    function setDrawer(open) {
      root.classList.toggle('is-nav-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      scrim.hidden = !open;
      // Off-canvas nav is hidden from AT and focus while closed on phones.
      nav.inert = mobile.matches && !open;
      if (open) { var first = nav.querySelector('[aria-current="page"]') || nav.querySelector('button'); if (first) first.focus(); }
    }
    mobile.addEventListener('change', function () { setDrawer(false); });

    menuBtn.addEventListener('click', function () { setDrawer(!root.classList.contains('is-nav-open')); });
    scrim.addEventListener('click', function () { setDrawer(false); menuBtn.focus(); });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('is-nav-open')) { setDrawer(false); menuBtn.focus(); }
    });

    navList.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-section]');
      if (!btn) return;
      var s = SECTIONS.filter(function (x) { return x.id === btn.getAttribute('data-section'); })[0];
      setDrawer(false);
      if (s.action === 'settings') { options.onSettings(); return; }
      show(s.id, true);
    });

    exitBtn.addEventListener('click', function () {
      exitBtn.disabled = true;
      Promise.resolve(options.onExit(save)).catch(function () { /* router reports */ }).then(function () { exitBtn.disabled = false; });
    });

    function renderChrome() {
      var D_ = D();
      var team = D_.userTeam(save);
      root.style.setProperty('--c1', dom.hex(team.colors.primary));
      root.style.setProperty('--c2', dom.hex(team.colors.secondary));
      root.style.setProperty('--c3', dom.hex(team.colors.tertiary));
      var teamBox = $('[data-gs-team]');
      teamBox.textContent = '';
      teamBox.appendChild(el('img', { src: team.logo, alt: '', width: 40, height: 40 }));
      teamBox.appendChild(el('span', { class: 'gs-nav-team-text' }, [
        el('span', { class: 'gs-nav-team-name', text: team.fullName }),
        el('span', { class: 'gs-nav-team-sub', text: 'GM ' + save.gm.name })
      ]));
      $('[data-gs-date]').textContent = dom.gameDate(save.calendar.currentDate);
      $('[data-gs-date]').setAttribute('datetime', save.calendar.currentDate);
      $('[data-gs-phase]').textContent = save.calendar.seasonLabel + ' · ' + D_.phaseLabel(save.calendar.phase);
    }

    function show(id, focus) {
      var section = sectionById(id);
      active = section.id;
      navList.querySelectorAll('[data-section]').forEach(function (b) {
        if (b.getAttribute('data-section') === active) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      });
      $('[data-gs-section-label]').textContent = section.label;
      content.textContent = '';
      section.render(content, save, { go: function (s) { show(s, true); } });
      main.scrollTop = 0;
      if (focus) {
        var h = content.querySelector('h1');
        if (h) h.focus({ preventScroll: true });
      }
      if (options.onSectionChange) options.onSectionChange(active);
    }

    function open(nextSave, sectionId) {
      save = nextSave;          // a fresh copy from storage: never shared between dynasties
      setDrawer(false);
      renderChrome();
      show(sectionId || 'dashboard', true);
    }

    function clear() {
      save = null;
      content.textContent = '';
    }

    nav.inert = mobile.matches;

    return {
      open: open,
      show: show,
      clear: clear,
      currentId: function () { return save && save.id; },
      currentSave: function () { return save; },
      currentSection: function () { return active; }
    };
  }

  window.HDGameShell = { init: init, SECTIONS: SECTIONS };
})();
