/* ==========================================================================
   HOOPS DYNASTY — Career Statistics section (player profile)
   Four season-by-season tables (Per Game, Totals, Per 36, Advanced) in the
   Basketball-Reference organisation, styled as Hoops Dynasty. All numbers
   come from scripts/career-stats.js. Styles: styles/career-stats.css.
   ========================================================================== */
(function () {
  'use strict';

  var dom = window.HDDom;
  var el = dom.el;
  function CS() { return window.HDCareerStats; }

  var PREF_KEY = 'hoopsDynasty.statsHighlightHighs';
  function readPref() { try { return window.localStorage.getItem(PREF_KEY) === '1'; } catch (e) { return false; } }
  function writePref(v) { try { window.localStorage.setItem(PREF_KEY, v ? '1' : '0'); } catch (e) { /* not stored */ } }

  /* --- formatting (display only; values keep full precision) -------------- */
  var DASH = '—';
  function ok(v) { return typeof v === 'number' && isFinite(v); }
  function pct3(v) { if (!ok(v)) return DASH; var s = v.toFixed(3); return s.charAt(0) === '0' ? s.slice(1) : s; }   // .485 / 1.000
  function dec1(v) { return ok(v) ? v.toFixed(1) : DASH; }
  function int(v) { return ok(v) ? Math.round(v).toLocaleString('en-US') : DASH; }
  function intMin(v) { return ok(v) ? Math.round(v).toLocaleString('en-US') : DASH; }

  /* --- columns --------------------------------------------------------------- */
  // [key, label, title, get(line, row), format, leaderKey(table)]
  function shootingCols(scope) {
    function v(f) { return function (L) { return scope === 'totals' ? L.totals[f] : L[scope][f]; }; }
    function lead(k) { return scope === 'perGame' ? 'pg.' + k : scope === 'totals' ? 'tot.' + k : null; }
    var fmt = scope === 'totals' ? int : dec1;
    return [
      ['fg', 'FG', 'Field Goals', v('fg'), fmt, lead('fg')],
      ['fga', 'FGA', 'Field Goal Attempts', v('fga'), fmt, lead('fga')],
      ['fgPct', 'FG%', 'Field Goal Percentage', function (L) { return L.derived.fgPct; }, pct3, 'pct.fg'],
      ['tp', '3P', '3-Point Field Goals', v('tp'), fmt, lead('tp')],
      ['tpa', '3PA', '3-Point Field Goal Attempts', v('tpa'), fmt, lead('tpa')],
      ['tpPct', '3P%', '3-Point Field Goal Percentage', function (L) { return L.derived.tpPct; }, pct3, 'pct.tp'],
      ['twoP', '2P', '2-Point Field Goals', scope === 'totals' ? function (L) { return L.derived.twoP; } : v('twoP'), fmt, null],
      ['twoPA', '2PA', '2-Point Field Goal Attempts', scope === 'totals' ? function (L) { return L.derived.twoPA; } : v('twoPA'), fmt, null],
      ['twoPct', '2P%', '2-Point Field Goal Percentage', function (L) { return L.derived.twoPct; }, pct3, 'pct.twoP'],
      ['efg', 'eFG%', 'Effective Field Goal Percentage: (FG + 0.5 × 3P) / FGA', function (L) { return L.derived.efg; }, pct3, 'pct.efg'],
      ['ft', 'FT', 'Free Throws', v('ft'), fmt, lead('ft')],
      ['fta', 'FTA', 'Free Throw Attempts', v('fta'), fmt, lead('fta')],
      ['ftPct', 'FT%', 'Free Throw Percentage', function (L) { return L.derived.ftPct; }, pct3, 'pct.ft'],
      ['orb', 'ORB', 'Offensive Rebounds', v('orb'), fmt, lead('orb')],
      ['drb', 'DRB', 'Defensive Rebounds', v('drb'), fmt, lead('drb')],
      ['trb', 'TRB', 'Total Rebounds', scope === 'totals' ? function (L) { return L.derived.trb; } : v('trb'), fmt, lead('trb')],
      ['ast', 'AST', 'Assists', v('ast'), fmt, lead('ast')],
      ['stl', 'STL', 'Steals', v('stl'), fmt, lead('stl')],
      ['blk', 'BLK', 'Blocks', v('blk'), fmt, lead('blk')],
      ['tov', 'TOV', 'Turnovers', v('tov'), fmt, null],
      ['pf', 'PF', 'Personal Fouls', v('pf'), fmt, null],
      ['pts', 'PTS', 'Points', v('pts'), fmt, lead('pts')]
    ];
  }
  function mpCol(perGame) {
    return perGame
      ? ['mp', 'MP', 'Minutes Played Per Game', function (L) { return L.perGame.mp; }, dec1, 'pg.mp']
      : ['mp', 'MP', 'Minutes Played', function (L) { return L.totals.mp; }, intMin, 'tot.mp'];
  }
  var GGS = [
    ['g', 'G', 'Games', function (L) { return L.totals.g; }, int, null],
    ['gs', 'GS', 'Games Started', function (L) { return L.totals.gs; }, int, null]
  ];
  function adv(k, lbl, title, fmt, lead) { return [k, lbl, title, function (L) { return L.advanced[k]; }, fmt, lead === false ? null : 'adv.' + k]; }

  var TABLES = [
    { id: 'per-game', title: 'Per Game', cols: function () { return GGS.concat([mpCol(true)], shootingCols('perGame')); } },
    { id: 'totals', title: 'Totals', cols: function () { return GGS.concat([mpCol(false)], shootingCols('totals')); } },
    { id: 'per-36', title: 'Per 36 Minutes', cols: function () { return GGS.concat([mpCol(false)], shootingCols('per36')); } },
    { id: 'advanced', title: 'Advanced', cols: function () {
      var U = CS().UNAVAILABLE;
      return GGS.concat([mpCol(false)], [
        adv('per', 'PER', 'Player Efficiency Rating (league average 15.0)', dec1),
        adv('ts', 'TS%', 'True Shooting Percentage: PTS / (2 × (FGA + 0.44 × FTA))', pct3),
        adv('tpar', '3PAr', '3-Point Attempt Rate: 3PA / FGA', pct3, false),
        adv('ftr', 'FTr', 'Free Throw Attempt Rate: FTA / FGA', pct3, false),
        adv('orbPct', 'ORB%', 'Offensive Rebound Percentage', dec1),
        adv('drbPct', 'DRB%', 'Defensive Rebound Percentage', dec1),
        adv('trbPct', 'TRB%', 'Total Rebound Percentage', dec1),
        adv('astPct', 'AST%', 'Assist Percentage', dec1),
        adv('stlPct', 'STL%', 'Steal Percentage', dec1),
        adv('blkPct', 'BLK%', 'Block Percentage', dec1),
        adv('tovPct', 'TOV%', 'Turnover Percentage: 100 × TOV / (FGA + 0.44 × FTA + TOV)', dec1, false),
        adv('usgPct', 'USG%', 'Usage Percentage', dec1)
      ], ['ows', 'dws', 'ws', 'ws48', 'obpm', 'dbpm', 'bpm', 'vorp'].map(function (k) {
        var lbl = { ows: 'OWS', dws: 'DWS', ws: 'WS', ws48: 'WS/48', obpm: 'OBPM', dbpm: 'DBPM', bpm: 'BPM', vorp: 'VORP' }[k];
        return [k, lbl, U[k] + ' — not yet available: requires the full Basketball-Reference method, which the game does not calculate yet', function () { return null; }, dec1, null];
      }));
    } }
  ];

  var LEAD_COLS = [
    ['season', 'Season', 'Season'], ['age', 'Age', 'Age on February 1 of the season'], ['team', 'Team', 'Team'],
    ['lg', 'Lg', 'League'], ['pos', 'Pos', 'Position']
  ];

  function leagueAbbr(save) {
    var words = String(save.league.name).replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    return words.length > 1 ? words.map(function (w) { return w[0]; }).join('').toUpperCase().slice(0, 4) : words.join('').slice(0, 4).toUpperCase();
  }

  /* --- one table ------------------------------------------------------------- */
  function renderTable(spec, data, ctx) {
    var cols = spec.cols();
    var teamName = function (teamId) { var t = ctx.save.teams.filter(function (x) { return x.id === teamId; })[0]; return t ? t.fullName : ''; };
    var sortState = ctx.sort[spec.id] || null;

    // rows: season groups (combined + splits stay together), career rows last
    var groups = [], tail = [];
    data.rows.forEach(function (r) {
      if (r.kind === 'career' || r.kind === 'franchise') { tail.push(r); return; }
      var g = groups.filter(function (x) { return x.key === r.group; })[0];
      if (!g) { g = { key: r.group, rows: [] }; groups.push(g); }
      g.rows.push(r);
    });
    if (sortState) {
      var col = cols.filter(function (c) { return c[0] === sortState.key; })[0];
      var get = function (g) {
        var head = g.rows[0];
        if (sortState.key === 'season') return head.seasonYear;
        if (sortState.key === 'age') return head.age;
        return col ? col[3](head.line) : null;
      };
      groups.sort(function (a, b) {
        var va = get(a), vb = get(b);
        if (va == null && vb == null) return a.key - b.key;
        if (va == null) return 1;
        if (vb == null) return -1;
        return (va - vb) * (sortState.dir === 'asc' ? 1 : -1) || a.key - b.key;
      });
    }

    // personal career highs (season / combined rows only)
    var highs = {};
    if (ctx.highlightHighs) {
      cols.forEach(function (c) {
        var best = null;
        groups.forEach(function (g) { var v = c[3](g.rows[0].line); if (ok(v) && (best == null || v > best)) best = v; });
        highs[c[0]] = best;
      });
    }

    function th(key, label, title, sortable) {
      var dir = sortState && sortState.key === key ? sortState.dir : null;
      return el('th', { scope: 'col', class: 'cs-th' + (key === 'season' ? ' cs-sticky' : '') + (['season', 'team', 'lg', 'pos'].indexOf(key) !== -1 ? ' is-text' : ''),
        'aria-sort': dir ? (dir === 'asc' ? 'ascending' : 'descending') : null }, [
        sortable ? el('button', { class: 'cs-sort', type: 'button', 'data-sort': key, 'data-table': spec.id, title: title + ' — sort' }, [el('abbr', { title: title, text: label })])
          : el('abbr', { title: title, text: label })
      ]);
    }

    var head = el('tr', null, LEAD_COLS.map(function (c) { return th(c[0], c[1], c[2], c[0] === 'season' || c[0] === 'age'); })
      .concat(cols.map(function (c) { return th(c[0], c[1], c[2], true); }))
      .concat([th('awards', 'Awards', 'Awards earned that season', false)]));

    function rowEl(r) {
      var cls = 'cs-row is-' + r.kind + (r.current && r.kind !== 'split' ? ' is-current' : '');
      var leaders = (r.kind === 'season' || r.kind === 'combined') ? (ctx.leaders[r.seasonYear] || {}) : {};
      var seasonCell = r.kind === 'career' ? 'Career' : r.kind === 'franchise' ? r.label : r.label;
      var cells = [
        el('th', { scope: 'row', class: 'cs-sticky is-text', text: seasonCell }),
        el('td', { text: r.age != null ? String(r.age) : '' }),
        el('td', { class: 'is-text', title: r.kind === 'combined' ? 'Played for ' + r.teamNote : r.teamId ? teamName(r.teamId) : null, text: r.team || '' }),
        el('td', { class: 'is-text', title: ctx.save.league.name, text: r.kind === 'career' || r.kind === 'franchise' ? '' : ctx.lgAbbr }),
        el('td', { class: 'is-text', text: r.position || '' })
      ];
      cols.forEach(function (c) {
        var v = c[3](r.line);
        var isLead = c[5] && leaders[c[5]] && leaders[c[5]].indexOf(ctx.playerId) !== -1;
        var isHigh = ctx.highlightHighs && (r.kind === 'season' || r.kind === 'combined') && ok(v) && highs[c[0]] != null && v === highs[c[0]] && groups.length > 1;
        cells.push(el('td', { class: (isLead ? 'cs-lead' : '') + (isHigh ? ' cs-high' : '') || null,
          title: isLead ? 'Led the league' : isHigh ? 'Career high' : null, text: c[4](v) }));
      });
      cells.push(el('td', { class: 'is-text cs-awards' }, (r.awards || []).map(function (a, i) {
        return el('span', null, [i ? document.createTextNode(', ') : null, el('abbr', { title: CS().AWARDS[a] || a, text: a })]);
      })));
      return el('tr', { class: cls }, cells);
    }

    var body = el('tbody', null, [].concat.apply([], groups.map(function (g) { return g.rows.map(rowEl); })));
    var foot = el('tfoot', null, tail.map(rowEl));
    return el('section', { class: 'cs-block', 'aria-labelledby': ctx.uid + '-' + spec.id }, [
      el('h4', { class: 'cs-title', id: ctx.uid + '-' + spec.id, tabindex: '-1', text: spec.title }),
      el('div', { class: 'cs-wrap', tabindex: '0', role: 'region', 'aria-label': spec.title + ' table (scrolls sideways)' }, [
        el('table', { class: 'cs-table' }, [
          el('caption', { class: 'hd-visually-hidden', text: spec.title + ' — ' + CS().COMP_LABELS[ctx.mode] }),
          el('thead', null, [head]), body, foot
        ])
      ])
    ]);
  }

  /* --- section ---------------------------------------------------------------- */
  var uidCounter = 0;
  function section(ctx0) {
    var save = ctx0.save, player = ctx0.player;
    var uid = 'cs' + (++uidCounter);
    var state = { mode: 'regular', sort: {}, highlightHighs: readPref() };
    var root = el('section', { class: 'pp-section pp-stats', 'aria-labelledby': uid + '-title' });

    function preseasonExists() {
      var list = (save.careerStats && save.careerStats.players[player.id]) || [];
      return list.some(function (s) { return s.competition === 'preseason'; });
    }

    function render() {
      root.textContent = '';
      var data = CS().playerRows(save, player.id, state.mode);
      var startYear = save.calendar.startYear;
      var preDynasty = player.draft && Number.isInteger(player.draft.year) && player.draft.year < startYear && (player.experience || 0) > 0;
      var leaders = {};
      data.rows.forEach(function (r) {
        if ((r.kind === 'season' || r.kind === 'combined') && !leaders[r.seasonYear]) leaders[r.seasonYear] = CS().leagueLeaders(save, r.seasonYear, state.mode);
      });
      var ctx = { save: save, playerId: player.id, mode: state.mode, sort: state.sort, uid: uid, leaders: leaders,
        highlightHighs: state.highlightHighs, lgAbbr: leagueAbbr(save) };

      var modes = ['regular', 'playoffs'].concat(preseasonExists() ? ['preseason'] : []);
      root.appendChild(el('div', { class: 'cs-head' }, [
        el('h3', { class: 'hd-eyebrow pp-section-title', id: uid + '-title', text: 'Career Statistics' }),
        el('div', { class: 'hd-segmented cs-modes', role: 'radiogroup', 'aria-label': 'Statistics' }, modes.map(function (m) {
          return el('label', null, [
            el('input', { type: 'radio', name: uid + '-mode', value: m, checked: state.mode === m, 'data-mode': m }),
            el('span', { text: CS().COMP_LABELS[m] })
          ]);
        }))
      ]));
      root.appendChild(el('div', { class: 'cs-tools' }, [
        el('nav', { class: 'cs-nav', 'aria-label': 'Jump to table' }, TABLES.map(function (t) {
          return el('a', { href: '#' + uid + '-' + t.id, 'data-jump': uid + '-' + t.id, text: t.title });
        })),
        el('label', { class: 'cs-toggle' }, [
          el('input', { type: 'checkbox', checked: state.highlightHighs, 'data-highs': '' }),
          el('span', { text: 'Highlight career highs' })
        ])
      ]));
      if (preDynasty) {
        root.appendChild(el('p', { class: 'cs-note', role: 'note', text: 'Historical statistics are not available for seasons before the dynasty began.' }));
      }
      if (!data.hasData) {
        root.appendChild(el('p', { class: 'cs-empty', text: state.mode === 'playoffs' ? 'No playoff games played yet.' : state.mode === 'preseason' ? 'No preseason games played yet.'
          : 'No regular-season games played yet. Statistics are recorded after every completed game.' }));
        return;
      }
      root.appendChild(el('p', { class: 'cs-legend', text: 'Bold: led the league (qualified). Career rows total every team stint; combined season rows (2TM, 3TM…) are recalculated from all stints.' }));
      TABLES.forEach(function (t) { root.appendChild(renderTable(t, data, ctx)); });
    }

    root.addEventListener('change', function (e) {
      var t = e.target;
      if (t.getAttribute('data-mode')) { state.mode = t.value; render(); root.querySelector('[data-mode="' + state.mode + '"]').focus(); }
      else if (t.hasAttribute('data-highs')) { state.highlightHighs = t.checked; writePref(t.checked); render(); root.querySelector('[data-highs]').focus(); }
    });
    root.addEventListener('click', function (e) {
      var jump = e.target.closest('[data-jump]');
      if (jump) {
        e.preventDefault();
        var h = root.querySelector('#' + jump.getAttribute('data-jump'));
        if (h) { h.scrollIntoView({ block: 'start', behavior: 'smooth' }); h.focus({ preventScroll: true }); }
        return;
      }
      var b = e.target.closest('[data-sort]');
      if (b) {
        var tid = b.getAttribute('data-table'), key = b.getAttribute('data-sort');
        var cur = state.sort[tid];
        state.sort[tid] = !cur || cur.key !== key ? { key: key, dir: key === 'season' || key === 'age' ? 'asc' : 'desc' }
          : cur.dir === 'desc' ? { key: key, dir: 'asc' } : null;
        render();
        var again = root.querySelector('[data-sort="' + key + '"][data-table="' + tid + '"]');
        if (again) again.focus();
      }
    });
    render();
    return root;
  }

  window.HDCareerStatsUI = { section: section, format: { pct3: pct3, dec1: dec1, int: int } };
})();
