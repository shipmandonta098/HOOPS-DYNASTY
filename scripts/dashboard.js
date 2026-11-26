/* ==========================================================================
   HOOPS DYNASTY — GM Dashboard (default in-game section)
   Pure render functions: everything is read from the active dynasty save.
   Values that depend on systems that don't exist yet (games, contracts)
   render as dashes with an explanation, never as invented numbers.

   HDDashboard.render(container, save, { go(sectionId) })
   HDDashboard.panels: header / overview / lineup / teamStats / leaders /
                       finances — reused by other sections
   ========================================================================== */
(function () {
  'use strict';

  var dom = window.HDDom;
  var el = dom.el;

  function D() { return window.HDDynasty; }

  function ctxFor(save) {
    var team = D().userTeam(save);
    var conf = (save.league.conferences || []).filter(function (c) { return c.id === team.conference; })[0];
    var market = window.HDFranchises.marketSize(team.marketSize);
    var roster = D().teamRoster(save, team.id);
    return {
      team: team,
      owner: D().userOwner(save),
      conferenceName: conf ? conf.name : team.conference,
      marketLabel: market ? market.label : team.marketSize,
      roster: roster,
      standing: save.standings[team.id],
      jersey: { primary: team.colors.primary, secondary: team.colors.secondary }
    };
  }

  function panel(title, attrs, children, action) {
    var id = 'db-' + title.toLowerCase().replace(/[^a-z]+/g, '-');
    return el('section', Object.assign({ class: 'hd-panel db-panel', 'aria-labelledby': id }, attrs || {}), [
      el('div', { class: 'db-panel-head' }, [
        el('h2', { class: 'db-panel-title', id: id, text: title }),
        action || null
      ])
    ].concat(children));
  }

  function emptyNote(text) {
    return el('p', { class: 'db-empty' }, [dom.icon('chart', 'db-empty-icon'), el('span', { text: text })]);
  }

  /* --- Franchise header ------------------------------------------------ */
  function header(save, c) {
    var team = c.team;
    var swatches = el('span', { class: 'hd-swatches db-swatches', role: 'img',
      'aria-label': 'Team colors ' + team.colors.primary + ', ' + team.colors.secondary + ', ' + team.colors.tertiary },
      ['primary', 'secondary', 'tertiary'].map(function (k) { return el('span', { class: 'hd-swatch', style: { '--swatch': dom.hex(team.colors[k]) } }); }));
    return el('section', { class: 'hd-panel db-header', 'aria-labelledby': 'db-title' }, [
      el('div', { class: 'hd-team-accent', 'aria-hidden': 'true' }, [el('span'), el('span'), el('span')]),
      el('div', { class: 'db-header-body' }, [
        el('img', { class: 'db-logo', src: team.logo, alt: team.fullName + ' logo', width: 84, height: 84 }),
        el('div', { class: 'db-ident' }, [
          el('p', { class: 'hd-eyebrow db-league', text: save.league.name }),
          el('h1', { class: 'db-title', id: 'db-title', tabindex: '-1', text: team.fullName }),
          el('ul', { class: 'db-meta' }, [
            el('li', null, [el('span', { class: 'db-meta-k', text: 'GM' }), el('span', { text: save.gm.name })]),
            el('li', null, [el('span', { class: 'db-meta-k', text: 'Conf' }), el('span', { text: c.conferenceName })]),
            el('li', null, [el('span', { class: 'db-meta-k', text: 'Market' }), el('span', { text: c.marketLabel })]),
            el('li', null, [swatches])
          ])
        ]),
        el('div', { class: 'db-when' }, [
          el('p', { class: 'db-date' }, [dom.icon('calendar'), el('time', { datetime: save.calendar.currentDate, text: dom.gameDate(save.calendar.currentDate) })]),
          el('p', { class: 'db-season', text: save.calendar.seasonLabel + ' · ' + D().phaseLabel(save.calendar.phase) })
        ])
      ])
    ]);
  }

  /* --- Overview cards -------------------------------------------------- */
  function overview(save, c) {
    var st = c.standing;
    var gp = st.wins + st.losses;
    var pct = gp ? (st.wins / gp) : null;
    var streak = st.streak && st.streak.type && st.streak.count ? st.streak.type + st.streak.count : null;
    var tierKey = window.HDOwnership.tierFor(D().teamOverall(c.team));
    function card(label, value, sub, extra) {
      return el('div', { class: 'db-card' }, [
        el('span', { class: 'db-card-label', text: label }),
        el('span', { class: 'db-card-value', text: value }),
        sub ? el('span', { class: 'db-card-sub', text: sub }) : null,
        extra || null
      ]);
    }
    var conf = c.owner.confidence;
    return el('section', { class: 'db-overview', 'aria-label': 'Team overview' }, [
      card('Record', st.wins + '–' + st.losses, gp ? gp + ' games played' : 'No games played'),
      card('Win %', pct == null ? '—' : pct.toFixed(3).replace(/^0/, ''), gp ? null : 'Season not started'),
      card('Team Overall', String(D().teamOverall(c.team)), window.HDOwnership.TIERS[tierKey].label),
      card('Conference', st.conferenceRank ? window.HDStats.ordinal(st.conferenceRank) : '—', st.conferenceRank ? c.conferenceName : 'Not yet ranked'),
      card('Streak', streak || '—', streak ? null : 'No games played'),
      card('Owner Confidence', String(conf), window.HDOwnership.confidenceLabel(conf),
        el('span', { class: 'db-card-bar', 'aria-hidden': 'true' }, [el('span', { style: { width: conf + '%' } })]))
    ]);
  }

  /* --- Starting lineup ------------------------------------------------- */
  function lineup(save, c, go) {
    var lu = save.lineups[c.team.id] || {};
    var byId = {};
    c.roster.forEach(function (p) { byId[p.id] = p; });
    var rows = window.HDRoster.POSITIONS.map(function (pos) {
      var p = byId[lu[pos]];
      if (!p) return null;
      return el('li', { class: 'db-player' }, [
        el('span', { class: 'db-slot', text: pos }),
        dom.portrait(p.portrait, { className: 'db-player-portrait', jersey: c.jersey }),
        el('span', { class: 'db-jersey', text: '#' + p.jerseyNumber }),
        el('span', { class: 'db-player-name' }, [
          el('button', { class: 'db-player-full pp-trigger', type: 'button', 'data-player-id': p.id, 'aria-haspopup': 'dialog',
            'aria-label': 'View profile: ' + window.HDPlayerIdentity.fullName(p), text: window.HDPlayerIdentity.fullName(p) }),
          el('span', { class: 'db-player-sub', text: window.HDRoster.POSITION_NAMES[p.position] + ' · Age ' + p.age })
        ]),
        el('span', { class: 'db-ovr', 'aria-label': 'Overall ' + p.overall }, [el('strong', { text: String(p.overall) }), el('span', { text: 'OVR' })])
      ]);
    });
    var more = go ? el('button', { class: 'hd-btn is-quiet db-link', type: 'button', text: 'Full Roster', on: { click: function () { go('roster'); } } }) : null;
    return panel('Starting Lineup', null, [el('ol', { class: 'db-lineup' }, rows)], more);
  }

  /* --- Team statistics -------------------------------------------------- */
  function teamStats(save, c) {
    var S = window.HDStats;
    var sum = S.teamSummary(save.stats && save.stats.season, c.team.id);
    var table = el('table', { class: 'db-stats' }, [
      el('thead', null, [el('tr', null, [
        el('th', { scope: 'col', text: 'Category' }),
        el('th', { scope: 'col', class: 'is-num', text: 'Value' }),
        el('th', { scope: 'col', class: 'is-num', text: 'Rank' })
      ])]),
      el('tbody', null, sum.rows.map(function (r) {
        return el('tr', null, [
          el('th', { scope: 'row' }, [el('span', { text: r.label }), el('abbr', { class: 'db-stat-abbr', title: r.label, text: r.short })]),
          el('td', { class: 'is-num', text: S.format(r.value, r.format) }),
          el('td', { class: 'is-num db-rank', text: r.rank ? S.ordinal(r.rank) : '—' })
        ]);
      }))
    ]);
    return panel('Team Statistics', null, [
      sum.gamesPlayed ? null : emptyNote('Statistics appear after your first game. League ranks are calculated once games have been played.'),
      table
    ]);
  }

  /* --- Team leaders ----------------------------------------------------- */
  function leaders(save, c) {
    var S = window.HDStats;
    var rows = S.teamLeaders(save.stats && save.stats.season, c.roster);
    var any = rows.some(function (r) { return r.player; });
    var list = el('ul', { class: 'db-leaders' }, rows.map(function (r) {
      var p = r.player;
      return el('li', { class: 'db-leader' + (p ? '' : ' is-empty') }, [
        p ? dom.portrait(p.portrait, { className: 'db-player-portrait', jersey: c.jersey }) : el('span', { class: 'db-portrait-empty', 'aria-hidden': 'true' }),
        el('span', { class: 'db-player-name' }, [
          el('span', { class: 'db-leader-cat', text: r.label + ' per game' }),
          el('span', { class: 'db-player-full', text: p ? window.HDPlayerIdentity.fullName(p) + ' · ' + p.position : 'No leader yet' })
        ]),
        el('span', { class: 'db-leader-value' }, [el('strong', { text: r.value == null ? '—' : r.value.toFixed(1) }), el('span', { text: r.short })])
      ]);
    }));
    return panel('Team Leaders', null, [any ? null : emptyNote('Team leaders are determined from recorded player statistics once games are played.'), list]);
  }

  /* --- Finances ---------------------------------------------------------- */
  function finances(save, c, opts) {
    opts = opts || {};
    var Fn = window.HDFinance;
    var f = Fn.teamSummary(save.finances, c.roster);
    var scaleMax = f.luxuryTax * 1.15;
    var pctOf = function (v) { return Math.max(0, Math.min(100, (v / scaleMax) * 100)); };
    var spending = c.owner.traits.spending;

    var gauge = el('div', { class: 'db-gauge' + (f.payroll == null ? ' is-unavailable' : '') }, [
      el('div', { class: 'db-gauge-track', role: 'img',
        'aria-label': f.payroll == null
          ? 'Payroll unavailable. Salary cap ' + Fn.money(f.salaryCap) + ', luxury tax ' + Fn.money(f.luxuryTax) + '.'
          : 'Payroll ' + Fn.money(f.payroll) + ' against a ' + Fn.money(f.salaryCap) + ' cap and ' + Fn.money(f.luxuryTax) + ' tax line.' }, [
        f.payroll == null ? null : el('span', { class: 'db-gauge-fill is-' + f.taxStatus, style: { width: pctOf(f.payroll) + '%' } }),
        el('span', { class: 'db-gauge-mark', style: { left: pctOf(f.salaryCap) + '%' } }),
        el('span', { class: 'db-gauge-mark is-tax', style: { left: pctOf(f.luxuryTax) + '%' } })
      ]),
      el('div', { class: 'db-gauge-labels', 'aria-hidden': 'true' }, [
        el('span', { class: 'db-gauge-label', style: { left: pctOf(f.salaryCap) + '%' }, text: 'Cap' }),
        el('span', { class: 'db-gauge-label is-tax', style: { left: pctOf(f.luxuryTax) + '%' }, text: 'Tax' })
      ])
    ]);

    var rows = [
      ['Team Payroll', Fn.money(f.payroll)],
      ['Salary Cap', Fn.money(f.salaryCap)],
      ['Cap Space', Fn.money(f.capSpace)],
      ['Luxury Tax Threshold', Fn.money(f.luxuryTax)],
      ['Luxury Tax Status', Fn.STATUS_LABELS[f.taxStatus]],
      ['Estimated Tax Payment', f.taxStatus === 'taxpayer' ? Fn.money(f.taxBill) : (f.payroll == null ? '—' : 'None')],
      ['Owner Spending', window.HDOwnership.spendingLabel(spending) + ' · ' + spending + '/100']
    ];
    return panel(opts.title || 'Team Finances', null, [
      gauge,
      f.payroll == null ? emptyNote('Payroll, cap space and tax figures are calculated from player contracts, which arrive in a future update. League thresholds are shown.') : null,
      el('dl', { class: 'db-fin' }, rows.map(function (r) {
        return el('div', null, [el('dt', { text: r[0] }), el('dd', { text: r[1] })]);
      }))
    ]);
  }

  function render(container, save, ctx) {
    ctx = ctx || {};
    var c = ctxFor(save);
    container.textContent = '';
    container.appendChild(header(save, c));
    container.appendChild(overview(save, c));
    container.appendChild(el('div', { class: 'db-columns' }, [
      el('div', { class: 'db-col' }, [lineup(save, c, ctx.go), teamStats(save, c)]),
      el('div', { class: 'db-col' }, [leaders(save, c), finances(save, c)])
    ]));
  }

  window.HDDashboard = {
    render: render,
    context: ctxFor,
    panels: { header: header, overview: overview, lineup: lineup, teamStats: teamStats, leaders: leaders, finances: finances, panel: panel, emptyNote: emptyNote }
  };
})();
