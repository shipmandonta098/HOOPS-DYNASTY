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

  /* --- Roster: any team, any season with data ----------------------------- */

  // Which roster is being viewed; resets when a different dynasty opens.
  var rosterView = { saveId: null, teamId: null, seasonYear: null };

  function bornLabel(iso) { return window.HDSeason.formatDate(iso, 'medium'); }

  // Flag of the PRIMARY nationality; full names (incl. a second
  // nationality) in the tooltip and accessible label.
  function flag(p) {
    var Bio = window.HDPlayerBio;
    var name = Bio.countryName(p.nationality);
    var full = name + (p.secondaryNationality ? ' (also ' + Bio.countryName(p.secondaryNationality) + ')' : '');
    return el('span', { class: 'gs-country', title: full, 'aria-label': 'Nationality: ' + full }, [
      el('span', { class: 'hd-flag', html: window.HDFlags.svg(p.nationality) }),
      el('span', { 'aria-hidden': 'true', text: name })
    ]);
  }

  function renderRoster(container, save, ctx) {
    if (rosterView.saveId !== save.id) {
      rosterView = { saveId: save.id, teamId: save.userTeamId, seasonYear: save.calendar.seasonYear };
    }
    var seasons = D().rosterSeasons(save);
    if (!seasons.some(function (x) { return x.seasonYear === rosterView.seasonYear; })) rosterView.seasonYear = save.calendar.seasonYear;

    container.appendChild(sectionHeader(save, 'Roster'));

    // Team picker: grouped by conference, your team first and labelled.
    var teamSelect = el('select', { class: 'hd-select', id: 'gs-roster-team' });
    (save.league.conferences || []).forEach(function (conf) {
      var group = el('optgroup', { label: conf.name });
      save.teams.filter(function (t) { return t.conference === conf.id; })
        .sort(function (a, b) { return a.fullName.localeCompare(b.fullName); })
        .forEach(function (t) {
          group.appendChild(el('option', { value: t.id, text: t.fullName + (t.id === save.userTeamId ? ' (Your Team)' : '') }));
        });
      teamSelect.appendChild(group);
    });
    teamSelect.value = rosterView.teamId;

    var seasonSelect = el('select', { class: 'hd-select', id: 'gs-roster-season', 'aria-describedby': 'gs-roster-season-hint' });
    seasons.forEach(function (x) {
      seasonSelect.appendChild(el('option', { value: String(x.seasonYear), text: x.seasonLabel + (x.current ? ' (Current)' : '') }));
    });
    seasonSelect.value = String(rosterView.seasonYear);

    var mine = el('button', { class: 'hd-btn is-quiet gs-roster-mine', type: 'button', text: 'My Team' });

    container.appendChild(el('div', { class: 'gs-roster-tools' }, [
      el('div', { class: 'gs-roster-field gs-roster-field-team' }, [
        el('label', { class: 'gs-roster-label', for: 'gs-roster-team', text: 'Team' }),
        el('div', { class: 'hd-select-wrap' }, [teamSelect])
      ]),
      el('div', { class: 'gs-roster-field' }, [
        el('label', { class: 'gs-roster-label', for: 'gs-roster-season', text: 'Season' }),
        el('div', { class: 'hd-select-wrap' }, [seasonSelect])
      ]),
      mine
    ]));
    container.appendChild(el('p', { class: 'gs-roster-hint', id: 'gs-roster-season-hint',
      text: seasons.length > 1 ? 'Past seasons show each roster as it stood at season’s end.' : 'Past seasons will appear here as your dynasty moves through each season.' }));

    var body = el('div', { class: 'gs-roster-body', 'aria-live': 'polite' });
    container.appendChild(body);

    function update() {
      rosterView.teamId = teamSelect.value;
      rosterView.seasonYear = Number(seasonSelect.value);
      mine.hidden = rosterView.teamId === save.userTeamId;
      renderRosterBody(body, save, ctx);
    }
    teamSelect.addEventListener('change', update);
    seasonSelect.addEventListener('change', update);
    mine.addEventListener('click', function () { teamSelect.value = save.userTeamId; update(); teamSelect.focus(); });
    update();
  }

  function renderRosterBody(body, save, ctx) {
    var R = window.HDRoster;
    var Bio = window.HDPlayerBio;
    var team = save.teams.filter(function (t) { return t.id === rosterView.teamId; })[0];
    var data = D().rosterFor(save, team.id, rosterView.seasonYear);
    var season = D().rosterSeasons(save).filter(function (x) { return x.seasonYear === rosterView.seasonYear; })[0];
    var jersey = { primary: dom.hex(team.colors.primary), secondary: dom.hex(team.colors.secondary) };
    var conf = (save.league.conferences || []).filter(function (x) { return x.id === team.conference; })[0];
    var overall = data.current ? D().teamOverall(team) : R.teamOverall(data.players);

    var starterPos = {};
    R.POSITIONS.forEach(function (pos) { if (data.lineup[pos]) starterPos[data.lineup[pos]] = pos; });
    var players = data.players.slice().sort(function (a, b) {
      var sa = starterPos[a.id], sb = starterPos[b.id];
      if (sa && sb) return R.POSITIONS.indexOf(sa) - R.POSITIONS.indexOf(sb);
      if (sa) return -1;
      if (sb) return 1;
      return b.overall - a.overall || a.lastName.localeCompare(b.lastName);
    });

    body.textContent = '';
    body.style.setProperty('--team-c1', dom.hex(team.colors.primary));
    body.appendChild(el('div', { class: 'gs-roster-team' }, [
      el('img', { src: team.logo, alt: '', width: 48, height: 48 }),
      el('div', { class: 'gs-roster-team-text' }, [
        el('p', { class: 'gs-roster-team-name' }, [
          el('span', { text: team.fullName }),
          team.id === save.userTeamId ? el('span', { class: 'gs-roster-you', text: 'Your Team' }) : null
        ]),
        el('p', { class: 'gs-roster-team-meta' }, [
          [(season ? season.seasonLabel : ''), players.length + ' players'].filter(Boolean).join(' · ') + ' · Team overall ',
          window.HDRatings.el(overall, { className: 'gs-team-ovr' }),
          conf ? ' · ' + conf.name : null
        ])
      ])
    ]));

    if (!players.length) {
      body.appendChild(el('p', { class: 'db-empty', text: 'No roster on record for this team in the selected season.' }));
      return;
    }

    // Morale (current season only): Locker Room panel + a smiley per player
    var morale = null, captainId = null;
    if (data.current && window.HDMorale && save.morale) {
      morale = window.HDMorale.evaluateTeam(save, team.id).players;
      captainId = save.morale.captains[team.id];
      var mine = team.id === save.userTeamId && ctx && ctx.replaceSave;
      body.appendChild(window.HDMoraleUI.lockerRoomPanel(save, team.id, mine ? {
        onCaptainChange: function (playerId) {
          var copy = JSON.parse(JSON.stringify(save));
          window.HDMorale.setCaptain(copy, team.id, playerId);
          window.HDSaves.update(copy).then(function () {
            ctx.replaceSave(copy);
            renderRosterBody(body, copy, ctx);
            var sel = body.querySelector('#lr-captain');
            if (sel) sel.focus();
          });
        }
      } : null));
    }

    // Head coach for the viewed season (archived seasons keep their coach)
    var Co = window.HDCoaches;
    var coachId = !Co || !save.coaches ? null : data.current ? save.coaches.byTeam[team.id]
      : ((save.rosterHistory || []).filter(function (h) { return h.seasonYear === rosterView.seasonYear; })[0] || {}).coaches;
    if (coachId && typeof coachId === 'object') coachId = coachId[team.id];
    var coach = coachId ? Co.get(save, coachId) : null;
    if (coach) {
      var lob = data.current && team.id === save.userTeamId ? Co.lobbying(save, team.id) : null;
      body.appendChild(el('section', { class: 'hd-panel gs-panel gs-coach', 'aria-label': 'Head coach' }, [
        dom.portrait(coach.portrait, { className: 'gs-coach-portrait' }),
        el('div', { class: 'gs-coach-text' }, [
          el('p', { class: 'hd-eyebrow gs-coach-role', text: 'Head Coach' }),
          el('button', { class: 'gs-player-name gs-coach-name', type: 'button', 'data-coach-id': coach.id, 'aria-haspopup': 'dialog',
            'aria-label': 'View coach profile: ' + Co.fullName(coach), text: Co.fullName(coach) }),
          el('p', { class: 'gs-coach-sub', text: Co.summary(coach) }),
          lob ? el('p', { class: 'gs-coach-lobby', text: lob.text }) : null
        ]),
        el('span', { class: 'gs-coach-ovr' }, [window.HDRatings.el(Co.overall(coach), { tag: 'strong', label: 'Coaching overall' }), el('span', { text: 'OVR', 'aria-hidden': 'true' })])
      ]));
    }

    var head = [
      ['Player', 'gs-sticky'], ['Pos'], ['OVR', 'is-num'], ['POT', 'is-num'], ['Age', 'is-num'],
      ['Born'], ['Ht', 'is-num'], ['Wt', 'is-num'], ['Exp', 'is-num', 'Seasons of league experience (R = rookie)'],
      ['Country'], ['College'], ['Salary', 'is-num', 'Salary for the season (player contract)'], ['Thru', null, 'Last season of the contract']
    ];
    // Contract money for the viewed season (scripts/contracts.js)
    var K = window.HDContracts;
    function salaryCells(p) {
      if (!K || !save.contracts) return [el('td', { class: 'is-num gs-muted-cell', text: '—' }), el('td', { class: 'gs-muted-cell', text: '—' })];
      var hit = null, thru = null;
      K.contractsOf(save, p.id).forEach(function (c) {
        var y = K.yearFor(c, rosterView.seasonYear);
        if (y && y.optionStatus !== 'declined') { hit = (hit || 0) + y.salary; thru = c; }
      });
      var last = thru ? thru.years.filter(function (y) { return y.optionStatus !== 'declined'; }).slice(-1)[0] : null;
      var tags = last && window.HDFinancesUI ? window.HDFinancesUI.tagsFor(last).filter(function (t) { return t !== 'EXT'; }) : [];
      return [
        el('td', { class: 'is-num', text: hit == null ? '—' : window.HDFinance.money(hit) }),
        el('td', { title: last ? 'Contract runs through ' + window.HDSeason.label(last.seasonYear) + (tags.length ? ' (' + tags.join(', ') + ' in the final season)' : '') : null,
          text: last ? window.HDSeason.label(last.seasonYear) + (tags.length ? ' ' + tags.join('/') : '') : '—' })
      ];
    }
    var table = el('table', { class: 'gs-roster' }, [
      el('caption', { class: 'hd-visually-hidden', text: team.fullName + ' roster, ' + (season ? season.seasonLabel : '') }),
      el('thead', null, [el('tr', null, head.map(function (h) {
        return el('th', { scope: 'col', class: h[1] || null, title: h[2] || null, text: h[0] });
      }))]),
      el('tbody', null, players.map(function (p) {
        var starter = starterPos[p.id];
        return el('tr', { class: starter ? 'is-starter' : null }, [
          el('th', { scope: 'row', class: 'gs-sticky' }, [el('span', { class: 'gs-player' }, [
            dom.portrait(p.portrait, { className: 'gs-player-portrait', jersey: jersey }),
            el('span', { class: 'gs-player-text' }, [
              el('span', { class: 'gs-player-name-row' }, [
                el('button', { class: 'gs-player-name pp-trigger', type: 'button', 'data-player-id': p.id,
                  'data-season': String(rosterView.seasonYear), 'aria-haspopup': 'dialog',
                  'aria-label': 'View profile: ' + window.HDPlayerIdentity.fullName(p), text: window.HDPlayerIdentity.fullName(p) }),
                morale ? window.HDMoraleUI.icon(morale[p.id], { className: 'gs-morale' }) : null,
                captainId === p.id ? el('span', { class: 'lr-c-badge', title: 'Team captain', 'aria-label': 'Team captain', text: 'C' }) : null
              ]),
              el('span', { class: 'gs-player-num', text: '#' + p.jerseyNumber + (starter ? ' · Starter ' + starter : ' · Bench') })
            ])
          ])]),
          el('td', { text: p.position }),
          el('td', { class: 'is-num gs-ovr' }, [window.HDRatings.el(p.overall)]),
          el('td', { class: 'is-num gs-pot' }, [window.HDRatings.el(p.potential)]),
          el('td', { class: 'is-num', text: String(p.age) }),
          el('td', null, [el('time', { datetime: p.birthDate, text: bornLabel(p.birthDate) })]),
          el('td', { class: 'is-num', text: R.heightLabel(p.heightIn) }),
          el('td', { class: 'is-num', text: p.weightLb ? p.weightLb + ' lb' : '—' }),
          el('td', { class: 'is-num', title: p.experience === 0 ? 'Rookie' : p.experience + ' seasons', text: Bio.experienceLabel(p.experience) }),
          el('td', null, [flag(p)]),
          el('td', { class: p.college ? null : 'gs-muted-cell', title: p.college ? null : 'Did not play U.S. college basketball', text: p.college || '—' })
        ].concat(salaryCells(p)));
      }))
    ]);
    body.appendChild(el('section', { class: 'hd-panel gs-panel gs-roster-panel', 'aria-label': team.fullName + ' roster' }, [
      el('div', { class: 'gs-table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Roster table (scrolls sideways)' }, [table])
    ]));
  }

  // Every contract on the team's books this season (the payroll's parts)
  function teamContracts(save, team) {
    var K = window.HDContracts, Fn = window.HDFinance;
    if (!K || !save.contracts) return null;
    var season = save.calendar.seasonYear;
    var rows = save.players.filter(function (p) { return p.teamId === team.id; }).map(function (p) {
      var c = K.activeContract(save, p.id);
      var y = c && K.yearFor(c, season);
      return { p: p, c: c, y: y && y.optionStatus !== 'declined' ? y : null };
    }).filter(function (r) { return r.y; }).sort(function (a, b) { return b.y.capHit - a.y.capHit; });
    var dead = Object.keys(save.contracts.contracts).reduce(function (sum, id) {
      return sum + (save.contracts.contracts[id].dead || []).filter(function (d) { return d.teamId === team.id && d.seasonYear === season; })
        .reduce(function (s, d) { return s + d.amount; }, 0);
    }, 0);
    var total = K.teamPayroll(save, team.id, season);
    var types = window.HDContractRules.TYPES;
    return window.HDDashboard.panels.panel('Team Contracts · ' + save.calendar.seasonLabel, { class: 'hd-panel db-panel gs-contracts-panel' }, [
      el('div', { class: 'gs-table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Team contracts (scrolls sideways)' }, [
        el('table', { class: 'gs-roster gs-contracts' }, [
          el('caption', { class: 'hd-visually-hidden', text: team.fullName + ' contracts, ' + save.calendar.seasonLabel }),
          el('thead', null, [el('tr', null, [['Player'], ['Type'], ['Salary', 'is-num'], ['Cap Hit', 'is-num'], ['Thru'], ['Rem. Guaranteed', 'is-num']].map(function (h) {
            return el('th', { scope: 'col', class: h[1] || null, text: h[0] });
          }))]),
          el('tbody', null, rows.map(function (r) {
            return el('tr', null, [
              el('th', { scope: 'row' }, [el('button', { class: 'gs-player-name pp-trigger', type: 'button', 'data-player-id': r.p.id, 'aria-haspopup': 'dialog',
                text: window.HDPlayerIdentity.fullName(r.p) })]),
              el('td', { text: types[r.c.type] ? types[r.c.type].label : r.c.type }),
              el('td', { class: 'is-num', text: Fn.money(r.y.salary) }),
              el('td', { class: 'is-num', text: Fn.money(r.y.capHit) }),
              el('td', { text: window.HDSeason.label(r.c.endSeason) }),
              el('td', { class: 'is-num', text: Fn.money(K.remainingGuaranteed(r.c, season)) })
            ]);
          }).concat(dead ? [el('tr', null, [el('th', { scope: 'row', text: 'Dead money' }), el('td'), el('td'), el('td', { class: 'is-num', text: Fn.money(dead) }), el('td'), el('td')])] : [])),
          el('tfoot', null, [el('tr', { class: 'gs-contracts-total' }, [el('th', { scope: 'row', text: 'Team payroll' }), el('td'), el('td'),
            el('td', { class: 'is-num', 'data-payroll': String(total), text: Fn.money(total) }), el('td'), el('td')])])
        ])
      ])
    ]);
  }

  function renderFinances(container, save) {
    var c = window.HDDashboard.context(save);
    var cfg = save.finances.config;
    var Fn = window.HDFinance;
    container.appendChild(sectionHeader(save, 'Finances', 'League financial rules and your team’s position against them.'));
    container.appendChild(el('div', { class: 'gs-grid' }, [
      window.HDDashboard.panels.finances(save, c, { title: 'Payroll Overview' }),
      teamContracts(save, c.team),
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
    { id: 'settings', label: 'Settings', icon: 'settings', render: function (c, save, ctx) { window.HDGameSettings.render(c, save, ctx); } }
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
    var profile = window.HDPlayerProfile.init({ dialog: document.getElementById('player-profile') });

    // League News ticker along the bottom of every section: this dynasty's
    // news only (scripts/news.js). A young dynasty has few real headlines,
    // so a handful of gameplay tips fill in until there are enough.
    var ticker = window.HDNewsTicker.create($('[data-gs-ticker]'), { label: 'League News' });
    var IN_GAME_TIPS = window.HDNews.AMBIENT.filter(function (t) { return t.indexOf('Tip:') === 0 && t.indexOf('during setup') === -1; });
    function renderNews() {
      if (!save) { ticker.setItems([]); return; }
      var real = window.HDNews.latest(save, 15).map(function (n) { return n.headline; });
      ticker.setItems(real.length >= 5 ? real : real.concat(IN_GAME_TIPS));
    }

    // Any player name anywhere in the game content opens their profile.
    content.addEventListener('click', function (e) {
      var coachTrigger = e.target.closest('[data-coach-id]');
      if (coachTrigger && save) { profile.open(save, coachTrigger.getAttribute('data-coach-id'), { coach: true, returnFocus: coachTrigger }); return; }
      var trigger = e.target.closest('[data-player-id]');
      if (!trigger || !save) return;
      var season = trigger.getAttribute('data-season');
      profile.open(save, trigger.getAttribute('data-player-id'), {
        seasonYear: season ? Number(season) : null,
        returnFocus: trigger
      });
    });
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
      section.render(content, save, {
        go: function (s) { show(s, true); },
        // Settings saved a modified copy: adopt it and refresh the chrome
        replaceSave: function (next) { save = next; renderChrome(); renderNews(); },
        openAppSettings: function () { options.onSettings(); }
      });
      main.scrollTop = 0;
      if (focus) {
        var h = content.querySelector('h1');
        if (h) h.focus({ preventScroll: true });
      }
      if (options.onSectionChange) options.onSectionChange(active);
    }

    function open(nextSave, sectionId) {
      profile.close();
      save = nextSave;          // a fresh copy from storage: never shared between dynasties
      // Rule changes scheduled for a season that has now begun take effect.
      if (D().applyPendingRules(save).length) {
        window.HDSaves.update(save).catch(function () { /* saved again on exit */ });
      }
      setDrawer(false);
      renderChrome();
      renderNews();
      show(sectionId || 'dashboard', true);
    }

    function clear() {
      profile.close();
      save = null;
      content.textContent = '';
      ticker.setItems([]);
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
