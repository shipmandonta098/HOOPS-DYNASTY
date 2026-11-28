/* ==========================================================================
   HOOPS DYNASTY — player profile (dialog)
   Opened from any player name in the game (roster, lineup...). Reads only
   from the active dynasty save; for a past season it reads that season's
   archived roster snapshot.

   Sections are a registry so stats, contract, game log... can be added
   later without touching the shell. Today: Bio and Ratings (attributes,
   colored with scripts/ratings.js).

   HDPlayerProfile.init({ dialog }) -> { open(save, playerId, opts), close() }
   opts: { seasonYear, returnFocus }
   ========================================================================== */
(function () {
  'use strict';

  var dom = window.HDDom;
  var el = dom.el;

  function D() { return window.HDDynasty; }

  // Game dates of any supported year (scripts/season.js)
  function dateLabel(iso) { return window.HDSeason.formatDate(iso, 'long'); }
  function ageOn(birthIso, onIso) { return window.HDSeason.ageOn(birthIso, onIso); }

  function heightLabel(inches) {
    return window.HDRoster.heightLabel(inches) + ' (' + (inches * 2.54 / 100).toFixed(2) + ' m)';
  }

  function weightLabel(lb) {
    return lb + ' lb (' + Math.round(lb * 0.45359237) + ' kg)';
  }

  /* --- Sections ----------------------------------------------------------- */

  function bioSection(ctx) {
    var p = ctx.player, save = ctx.save;
    var Bio = window.HDPlayerBio;
    var Career = window.HDPlayerCareer;

    var age = ctx.current ? ageOn(p.birthDate, save.calendar.currentDate) : p.age;

    var relatives;
    if (!p.relatives || !p.relatives.length) {
      relatives = el('span', { class: 'pp-none', text: 'None' });
    } else {
      relatives = el('ul', { class: 'pp-relatives' }, p.relatives.map(function (r) {
        var other = r.playerId ? ctx.findPlayer(r.playerId) : null;
        var otherTeam = other ? ctx.teamById[other.teamId] : null;
        var name = other
          ? el('button', { class: 'pp-link', type: 'button', 'data-player-id': other.id, text: r.name })
          : r.coachId && window.HDCoaches && window.HDCoaches.get(save, r.coachId)
            ? el('button', { class: 'pp-link', type: 'button', 'data-coach-id': r.coachId, text: r.name })
            : el('span', { text: r.name });
        return el('li', null, [
          el('span', { text: r.relation + ' of ' }), name,
          r.note ? el('span', { class: 'pp-muted', text: ' (' + r.note + ')' }) : null,
          otherTeam ? el('span', { class: 'pp-muted', text: ' · ' + otherTeam.fullName }) : null
        ]);
      }));
    }

    var debut;
    if (p.debut) {
      debut = el('span', null, [
        el('time', { datetime: p.debut.date, text: dateLabel(p.debut.date) }),
        el('span', { class: 'pp-muted', text: ' · ' + p.debut.teamName + ' vs. ' + p.debut.opponentName })
      ]);
    } else {
      debut = el('span', null, [
        el('span', { text: 'Has not debuted' }),
        el('span', { class: 'pp-muted', text: ' · expected when the regular season begins' })
      ]);
    }

    var rows = [
      ['Position', window.HDRoster.POSITION_NAMES[p.position] + ' (' + p.position + ')'],
      p.archetype ? ['Archetype', window.HDPlayerRatings.archetypeLabel(p.archetype) +
        (p.archetypeSecondary ? ' / ' + window.HDPlayerRatings.archetypeLabel(p.archetypeSecondary) : '')] : null,
      ['Height', heightLabel(p.heightIn)],
      ['Weight', weightLabel(p.weightLb)],
      ['Born', el('time', { datetime: p.birthDate, text: dateLabel(p.birthDate) })],
      ['Age', String(age)],
      ['Birthplace', window.HDPlayerIdentity.birthplaceLabel(p)],
      ['Nationality', el('span', { class: 'pp-nationality' }, [
        el('span', { class: 'pp-country' }, [
          el('span', { class: 'hd-flag', html: window.HDFlags.svg(p.nationality) }),
          el('span', { text: Bio.countryName(p.nationality) })
        ]),
        p.secondaryNationality ? el('span', { class: 'pp-country pp-secondary' }, [
          el('span', { class: 'pp-muted', text: 'also' }),
          el('span', { class: 'hd-flag', html: window.HDFlags.svg(p.secondaryNationality) }),
          el('span', { text: Bio.countryName(p.secondaryNationality) })
        ]) : null
      ])],
      ['Relatives', relatives],
      ['College', p.college ? p.college : el('span', { class: 'pp-none', 'aria-label': 'No college', text: '—' })],
      ['Development', window.HDPlayerIdentity.pathwayLabel(p)],
      ['Draft', Career.draftLabel(p.draft, save.league.name)],
      ['Debut', debut],
      ['Experience', p.experience === 0 ? 'Rookie' : p.experience + (p.experience === 1 ? ' season' : ' seasons')]
    ];

    return el('section', { class: 'pp-section', 'aria-labelledby': 'pp-bio-title' }, [
      el('h3', { class: 'hd-eyebrow pp-section-title', id: 'pp-bio-title', text: 'Bio' }),
      el('dl', { class: 'pp-bio' }, rows.filter(Boolean).map(function (r) {
        return el('div', { class: 'pp-row' }, [
          el('dt', { text: r[0] }),
          el('dd', null, [typeof r[1] === 'string' ? document.createTextNode(r[1]) : r[1]])
        ]);
      }))
    ]);
  }

  function ratingsSection(ctx) {
    var p = ctx.player;
    var A = window.HDPlayerAttributes;
    var Rt = window.HDRatings;
    var section = el('section', { class: 'pp-section pp-ratings', 'aria-labelledby': 'pp-ratings-title' }, [
      el('h3', { class: 'hd-eyebrow pp-section-title', id: 'pp-ratings-title', text: 'Ratings' })
    ]);
    if (!p.attributes) {
      section.appendChild(el('p', { class: 'pp-none', text: 'Ratings aren’t available for this player.' }));
      return section;
    }
    var grid = el('div', { class: 'pp-attr-groups' });
    A.GROUPS.forEach(function (g) {
      var attrs = A.ATTRIBUTES.filter(function (a) { return a.group === g.id; });
      grid.appendChild(el('div', { class: 'pp-attr-group', role: 'group', 'aria-labelledby': 'pp-attr-' + g.id }, [
        el('h4', { class: 'pp-attr-group-title', id: 'pp-attr-' + g.id, text: g.label }),
        el('ul', { class: 'pp-attrs' }, attrs.map(function (a) {
          var v = p.attributes[a.key];
          var valid = Rt.tier(v) !== null;
          return el('li', { class: 'pp-attr' }, [
            el('span', { class: 'pp-attr-name', text: a.label }),
            el('span', { class: 'pp-attr-bar', 'aria-hidden': 'true' }, [
              el('span', { class: 'pp-attr-fill ' + Rt.className(v), style: { width: (valid ? v : 0) + '%' } })
            ]),
            Rt.el(v, { className: 'pp-attr-value', tag: 'strong' })
          ]);
        }))
      ]));
    });
    // Mental attributes (on-court IQ): multipliers on the skills above
    var PM = window.HDPlayerMental;
    if (PM && p.mental) {
      var eff = ctx.current ? PM.effectiveMental(ctx.save, p) : null;
      grid.appendChild(el('div', { class: 'pp-attr-group pp-mental', role: 'group', 'aria-labelledby': 'pp-attr-mental' }, [
        el('h4', { class: 'pp-attr-group-title', id: 'pp-attr-mental', text: 'Mental' }),
        el('ul', { class: 'pp-attrs' }, PM.MENTAL.map(function (m) {
          var v = p.mental[m.key];
          var boosted = eff && eff[m.key] > v;
          return el('li', { class: 'pp-attr', title: m.summary }, [
            el('span', { class: 'pp-attr-name' }, [
              document.createTextNode(m.label),
              boosted ? el('span', { class: 'pp-boost', title: 'Leadership boost from ' + window.HDPlayerIdentity.fullName(eff.leader), text: ' +' + (eff[m.key] - v) }) : null
            ]),
            el('span', { class: 'pp-attr-bar', 'aria-hidden': 'true' }, [
              el('span', { class: 'pp-attr-fill ' + Rt.className(v), style: { width: v + '%' } })
            ]),
            Rt.el(v, { className: 'pp-attr-value', tag: 'strong' })
          ]);
        })),
        eff && eff.boost ? el('p', { class: 'pp-boost-note', text: 'Playing with ' + window.HDPlayerIdentity.fullName(eff.leader) + ' adds +' + eff.boost + ' to IQ and composure.' }) : null
      ]));
    }
    section.appendChild(grid);
    return section;
  }

  function personalitySection(ctx) {
    var p = ctx.player, PM = window.HDPlayerMental;
    if (!PM || !p.traits) return null;
    var t = p.traits;
    var fa = PM.freeAgencyDemand(t, {});
    var prog = PM.progressionModifiers(t);
    var aura = ctx.current ? PM.leadershipAura(ctx.save, p.teamId) : null;
    var isLeader = aura && aura.leader && aura.leader.id === p.id;
    function row(key, effect) {
      var v = t[key], tr = PM.TRAITS.filter(function (x) { return x.key === key; })[0];
      var twoEnded = !!tr.low;
      return el('li', { class: 'pt-row' }, [
        el('div', { class: 'pt-head' }, [
          el('span', { class: 'pt-label', text: tr.label }),
          el('span', { class: 'pt-desc', text: PM.traitLabel(key, v) + ' · ' + v })
        ]),
        el('div', { class: 'pt-scale' + (twoEnded ? ' is-two' : ''), role: 'img', 'aria-label': tr.label + ' ' + v + ' of 100' }, [
          twoEnded ? el('span', { class: 'pt-end', text: tr.low }) : null,
          el('span', { class: 'pt-track' }, [el('span', { class: 'pt-fill', style: { width: v + '%' } }), el('span', { class: 'pt-dot', style: { left: v + '%' } })]),
          twoEnded ? el('span', { class: 'pt-end', text: tr.high }) : null
        ]),
        el('p', { class: 'pt-effect', text: effect })
      ]);
    }
    var streakNote = t.volatility >= 65 ? 'Losing streaks hit hard; may demand a trade or cause friction in the locker room.'
      : t.volatility >= 35 ? 'Feels losing streaks but keeps it together.' : 'Stays level through losing streaks.';
    return el('section', { class: 'pp-section pp-personality', 'aria-labelledby': 'pp-personality-title' }, [
      el('h3', { class: 'hd-eyebrow pp-section-title', id: 'pp-personality-title', text: 'Personality' }),
      el('ul', { class: 'pt-list' }, [
        row('loyalty', fa.summary),
        row('workEthic', 'Offseason training ×' + prog.trainingPoints.toFixed(2) + (prog.peakExtensionYears > 0 ? '; holds the physical peak ~' + prog.peakExtensionYears + ' yr longer.' : prog.peakExtensionYears < 0 ? '; physical decline starts ~' + Math.abs(prog.peakExtensionYears) + ' yr earlier.' : '.')),
        row('volatility', streakNote),
        row('leadership', isLeader && aura.boost ? 'The team’s leading voice: young teammates get +' + aura.boost + ' IQ and composure.' : t.leadership >= 70 ? 'A respected voice in the locker room.' : 'Leads by example at most.')
      ])
    ]);
  }

  // Future: game log...
  function moraleSection(ctx) {
    if (!ctx.current || !window.HDMorale || !ctx.save.morale) return null;   // morale is about now
    return window.HDMoraleUI.profileSection(ctx.save, ctx.player);
  }

  var SECTIONS = [
    { id: 'bio', label: 'Bio', render: bioSection },
    { id: 'ratings', label: 'Ratings', render: ratingsSection },
    { id: 'personality', label: 'Personality', render: personalitySection },
    { id: 'morale', label: 'Morale', render: moraleSection },
    { id: 'stats', label: 'Career Statistics', render: function (ctx) {     // full width, below everything else
      return window.HDCareerStatsUI && ctx.save.careerStats ? window.HDCareerStatsUI.section(ctx) : null;
    } },
    { id: 'finances', label: 'Finances', render: function (ctx) {    // full width, below Career Statistics
      return window.HDFinancesUI && ctx.save.contracts ? window.HDFinancesUI.section(ctx) : null;
    } },
    { id: 'transactions', label: 'Transactions', render: function (ctx) {    // full width, below Finances
      return window.HDTransactionsUI && ctx.save.transactions ? window.HDTransactionsUI.section(ctx) : null;
    } }
  ];

  /* --- Dialog ------------------------------------------------------------- */

  function init(options) {
    var dialog = options.dialog;
    var body = dialog.querySelector('[data-pp-body]');
    var returnFocus = null;
    var state = null;

    function render() {
      var save = state.save;
      if (state.coachId) { window.HDCoachProfile.render(body, dialog, save, state.coachId); return; }
      var seasonYear = state.seasonYear == null ? save.calendar.seasonYear : state.seasonYear;
      var current = seasonYear === save.calendar.seasonYear;
      var pool = current ? save.players.concat(save.retiredPlayers || [])
        : ((save.rosterHistory || []).filter(function (h) { return h.seasonYear === seasonYear; })[0] || { players: [] }).players;
      var player = pool.filter(function (p) { return p.id === state.playerId; })[0];
      var teamById = {};
      save.teams.forEach(function (t) { teamById[t.id] = t; });
      body.textContent = '';
      if (!player) {
        body.appendChild(el('p', { class: 'pp-none', text: 'This player couldn’t be found.' }));
        return;
      }
      var team = teamById[player.teamId];
      var colors = team ? team.colors : { primary: '#555555', secondary: '#DDDDDD', tertiary: '#999999' };
      dialog.style.setProperty('--c1', dom.hex(colors.primary));
      dialog.style.setProperty('--c2', dom.hex(colors.secondary));
      dialog.style.setProperty('--c3', dom.hex(colors.tertiary));
      var season = D().rosterSeasons(save).filter(function (s) { return s.seasonYear === seasonYear; })[0];

      var lineup = current ? (save.lineups || {})[player.teamId] : ((save.rosterHistory || []).filter(function (h) { return h.seasonYear === seasonYear; })[0] || { lineups: {} }).lineups[player.teamId];
      var starterAt = null;
      if (lineup) Object.keys(lineup).forEach(function (pos) { if (lineup[pos] === player.id) starterAt = pos; });

      body.appendChild(el('header', { class: 'pp-head' }, [
        el('div', { class: 'hd-team-accent', 'aria-hidden': 'true' }, [el('span'), el('span'), el('span')]),
        el('div', { class: 'pp-head-body' }, [
          dom.portrait(player.portrait, { className: 'pp-portrait', jersey: { primary: colors.primary, secondary: colors.secondary } }),
          el('div', { class: 'pp-ident' }, [
            el('p', { class: 'hd-eyebrow pp-team' }, [
              team ? el('img', { src: team.logo, alt: '', width: 18, height: 18 }) : null,
              el('span', { text: (team ? team.fullName : '') + (season && !current ? ' · ' + season.seasonLabel : '') })
            ]),
            el('h2', { class: 'pp-name', id: 'pp-name', tabindex: '-1', text: window.HDPlayerIdentity.fullName(player) }),
            el('p', { class: 'pp-sub', text: player.retired ? window.HDRoster.POSITION_NAMES[player.position] + ' · Retired ' + dateLabel(player.retiredDate)
              : '#' + player.jerseyNumber + ' · ' + window.HDRoster.POSITION_NAMES[player.position] + (starterAt ? ' · Starter' : ' · Bench') })
          ]),
          el('div', { class: 'pp-badges' }, [
            el('span', { class: 'pp-badge' }, [window.HDRatings.el(player.overall, { tag: 'strong', label: 'Overall' }), el('span', { text: 'OVR', 'aria-hidden': 'true' })]),
            el('span', { class: 'pp-badge' }, [window.HDRatings.el(player.potential, { tag: 'strong', label: 'Potential' }), el('span', { text: 'POT', 'aria-hidden': 'true' })])
          ])
        ])
      ]));

      var ctx = {
        save: save, player: player, current: current, teamById: teamById,
        findPlayer: function (id) { return pool.filter(function (p) { return p.id === id; })[0] || null; }
      };
      var sections = el('div', { class: 'pp-sections' });
      SECTIONS.forEach(function (s) { var node = s.render(ctx); if (node) sections.appendChild(node); });
      body.appendChild(sections);
    }

    function open(save, playerId, opts) {
      opts = opts || {};
      state = opts.coach ? { save: save, coachId: playerId, seasonYear: null }
        : { save: save, playerId: playerId, seasonYear: opts.seasonYear == null ? null : opts.seasonYear };
      if (!dialog.open) returnFocus = opts.returnFocus || document.activeElement;
      render();
      if (!dialog.open) dialog.showModal();
      dialog.querySelector('.pp-sheet').scrollTop = 0;
      var name = dialog.querySelector('#pp-name');
      if (name) name.focus({ preventScroll: true });
    }

    function close() { if (dialog.open) dialog.close(); }

    dialog.addEventListener('close', function () {
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
      returnFocus = null;
    });
    dialog.querySelector('[data-pp-close]').addEventListener('click', close);
    // Click on the backdrop (the dialog element itself, outside the sheet)
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) close();
      var coachLink = e.target.closest('[data-coach-id]');
      if (coachLink && state) { open(state.save, coachLink.getAttribute('data-coach-id'), { coach: true }); return; }
      var link = e.target.closest('[data-player-id]');
      if (link && state) open(state.save, link.getAttribute('data-player-id'), { seasonYear: state.seasonYear });
    });

    return { open: open, close: close, isOpen: function () { return dialog.open; } };
  }

  window.HDPlayerProfile = { init: init, SECTIONS: SECTIONS };
})();
