/* ==========================================================================
   HOOPS DYNASTY — career statistics (recording + calculation engine)
   Basketball-Reference-style organisation and formulas. Shared by player
   profiles, and future team stats / league leaders screens.

   DATA (in the dynasty save, save.careerStats)
     games:    { gameId: true }                      processed games (no double counting)
     players:  { playerId: [stint] }                 one record per season x competition x team
       stint = { playerId, seasonYear, seasonLabel, age (on Feb 1 of the season's
                 final year), teamId, teamAbbr (as it was then), position,
                 competition: 'regular'|'playoffs'|'preseason', firstDate,
                 g, gs, mp, fg, fga, tp, tpa, ft, fta, orb, drb, ast, stl, blk, tov, pf, pts }
     teams:    { 'season|comp|teamId': { g, mp, team{...}, opp{...} } }   advanced-stat context
     leagues:  { 'season|comp': { g, mp, poss, totals{...} } }           league context (PER)
     awards:   { playerId: [{ seasonYear, code }] }
   Records are keyed by the permanent player id and franchise id, so they
   survive trades, relocations, retirement and season changes.

   The game simulation calls recordGame() after each completed game.
   Nothing here invents games or statistics.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var node = typeof module === 'object' && module.exports;
  var api = factory(node ? require('./season.js') : root.HDSeason);
  if (node) module.exports = api;
  else root.HDCareerStats = api;
})(typeof self !== 'undefined' ? self : this, function (Season) {
  'use strict';

  var COUNT = ['fg', 'fga', 'tp', 'tpa', 'ft', 'fta', 'orb', 'drb', 'ast', 'stl', 'blk', 'tov', 'pf', 'pts'];
  var COMPETITIONS = ['regular', 'playoffs', 'preseason'];
  var COMP_LABELS = { regular: 'Regular Season', playoffs: 'Playoffs', preseason: 'Preseason' };

  var AWARDS = {
    MVP: 'Most Valuable Player', DPOY: 'Defensive Player of the Year', ROY: 'Rookie of the Year',
    SMOY: 'Sixth Man of the Year', MIP: 'Most Improved Player', AS: 'All-Star',
    ALL1: 'All-League First Team', ALL2: 'All-League Second Team', ALL3: 'All-League Third Team',
    DEF1: 'All-Defensive First Team', DEF2: 'All-Defensive Second Team', FMVP: 'Finals Most Valuable Player',
    CHAMP: 'League Champion'
  };

  function zeros() { var o = {}; COUNT.forEach(function (k) { o[k] = 0; }); return o; }
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }

  function ensure(save) {
    if (!save.careerStats || typeof save.careerStats !== 'object') save.careerStats = {};
    var c = save.careerStats;
    ['games', 'players', 'teams', 'leagues', 'awards'].forEach(function (k) { if (!c[k] || typeof c[k] !== 'object') c[k] = {}; });
    return c;
  }

  /* --- recording ------------------------------------------------------------ */

  // Age on Feb 1 of the season's final calendar year (Basketball-Reference convention)
  function seasonAge(birthDate, seasonYear) {
    if (!birthDate) return null;
    return Season.ageOn(birthDate, Season.isoDate(seasonYear + 1, 2, 1));
  }

  // Validate and complete one player's box score line; returns null if unusable
  function cleanLine(l) {
    var o = { playerId: l.playerId, started: !!l.started, mp: Math.max(0, num(l.mp)) };
    COUNT.forEach(function (k) { if (k !== 'pts') o[k] = Math.max(0, Math.round(num(l[k]))); });
    if (o.fg > o.fga || o.tp > o.tpa || o.tp > o.fg || o.tpa > o.fga || o.ft > o.fta) return null;
    o.pts = 2 * (o.fg - o.tp) + 3 * o.tp + o.ft;           // points always follow the shots
    return o;
  }

  function teamTotals(lines) {
    var t = zeros();
    lines.forEach(function (l) { COUNT.forEach(function (k) { t[k] += l[k]; }); });
    t.mp = lines.reduce(function (s, l) { return s + l.mp; }, 0);
    return t;
  }

  // Basketball-Reference possession estimate (team and opponent totals)
  function possessions(tm, opp) {
    function one(a, b) {
      var orbShare = (a.orb + b.drb) > 0 ? a.orb / (a.orb + b.drb) : 0;
      return a.fga + 0.4 * a.fta - 1.07 * orbShare * (a.fga - a.fg) + a.tov;
    }
    return 0.5 * (one(tm, opp) + one(opp, tm));
  }

  /**
   * Record one completed game. Idempotent: a game id is only ever counted once.
   * @param game { id, seasonYear, competition, date,
   *               home: { teamId, players: [line] }, away: { teamId, players: [line] } }
   *        line { playerId, started, mp, fg, fga, tp, tpa, ft, fta, orb, drb, ast, stl, blk, tov, pf }
   * @returns { recorded: bool, reason? }
   */
  function recordGame(save, game) {
    var c = ensure(save);
    if (!game || typeof game.id !== 'string') return { recorded: false, reason: 'missing game id' };
    if (c.games[game.id]) return { recorded: false, reason: 'already recorded' };
    var comp = COMPETITIONS.indexOf(game.competition) !== -1 ? game.competition : 'regular';
    var year = Number.isInteger(game.seasonYear) ? game.seasonYear : save.calendar.seasonYear;
    var sides = [game.home, game.away].map(function (side) {
      var lines = (side.players || []).map(cleanLine);
      if (lines.some(function (l) { return !l; })) return null;
      return { teamId: side.teamId, lines: lines, totals: teamTotals(lines) };
    });
    if (sides.some(function (s) { return !s; })) return { recorded: false, reason: 'invalid box score' };

    var lgKey = year + '|' + comp;
    var lg = c.leagues[lgKey] || (c.leagues[lgKey] = { g: 0, mp: 0, poss: 0, totals: zeros() });
    sides.forEach(function (side, i) {
      var other = sides[1 - i];
      var key = year + '|' + comp + '|' + side.teamId;
      var ts = c.teams[key] || (c.teams[key] = { g: 0, mp: 0, team: zeros(), opp: zeros() });
      ts.g += 1;
      ts.mp += side.totals.mp;
      COUNT.forEach(function (k) { ts.team[k] += side.totals[k]; ts.opp[k] += other.totals[k]; lg.totals[k] += side.totals[k]; });
      lg.g += 1;
      lg.mp += side.totals.mp;
      lg.poss += possessions(side.totals, other.totals);
      var team = save.teams.filter(function (t) { return t.id === side.teamId; })[0] || {};
      side.lines.forEach(function (l) {
        if (!(l.mp > 0)) return;                               // DNP / inactive: not a game played
        var p = save.players.filter(function (x) { return x.id === l.playerId; })[0] || {};
        var list = c.players[l.playerId] || (c.players[l.playerId] = []);
        var st = list.filter(function (r) { return r.seasonYear === year && r.competition === comp && r.teamId === side.teamId; })[0];
        if (!st) {
          st = { playerId: l.playerId, seasonYear: year, seasonLabel: Season.label(year), age: seasonAge(p.birthDate, year),
            teamId: side.teamId, teamAbbr: team.abbreviation || '—', position: p.position || null, competition: comp,
            firstDate: game.date || save.calendar.currentDate, g: 0, gs: 0, mp: 0 };
          COUNT.forEach(function (k) { st[k] = 0; });
          list.push(st);
        }
        st.g += 1;
        if (l.started) st.gs += 1;
        st.mp += l.mp;
        COUNT.forEach(function (k) { st[k] += l[k]; });
      });
    });
    c.games[game.id] = true;
    return { recorded: true };
  }

  function addAward(save, playerId, seasonYear, code) {
    var c = ensure(save);
    if (!AWARDS[code]) return false;
    var list = c.awards[playerId] || (c.awards[playerId] = []);
    if (list.some(function (a) { return a.seasonYear === seasonYear && a.code === code; })) return false;
    list.push({ seasonYear: seasonYear, code: code });
    return true;
  }

  /* --- formulas (full precision; rounding happens only on display) ----------- */

  function div(a, b) { return b > 0 && isFinite(a) ? a / b : null; }

  // Basic shooting and derived counting values
  function derive(t) {
    var twoP = t.fg - t.tp, twoPA = t.fga - t.tpa;
    return {
      trb: t.orb + t.drb, twoP: twoP, twoPA: twoPA,
      fgPct: div(t.fg, t.fga), tpPct: div(t.tp, t.tpa), twoPct: div(twoP, twoPA), ftPct: div(t.ft, t.fta),
      efg: div(t.fg + 0.5 * t.tp, t.fga),
      ts: div(t.pts, 2 * (t.fga + 0.44 * t.fta)),
      tpar: div(t.tpa, t.fga), ftr: div(t.fta, t.fga),
      tovPct: div(100 * t.tov, t.fga + 0.44 * t.fta + t.tov)
    };
  }

  /**
   * Team-context rates (Basketball-Reference glossary), aggregated over one
   * or more stints by summing numerators and denominators — never by
   * averaging rates.
   */
  function contextRates(stints, c) {
    var n = { orb: 0, drb: 0, trb: 0, ast: 0, stl: 0, blk: 0, usg: 0 };
    var d = { orb: 0, drb: 0, trb: 0, ast: 0, stl: 0, blk: 0, usg: 0 };
    var ok = true;
    stints.forEach(function (s) {
      var ts = c.teams[s.seasonYear + '|' + s.competition + '|' + s.teamId];
      if (!ts || !(s.mp > 0) || !(ts.mp > 0)) { ok = false; return; }
      var T = ts.team, O = ts.opp, f = ts.mp / 5;
      var oppPoss = possessionsOne(O, T);
      n.orb += s.orb * f; d.orb += s.mp * (T.orb + O.drb);
      n.drb += s.drb * f; d.drb += s.mp * (T.drb + O.orb);
      n.trb += (s.orb + s.drb) * f; d.trb += s.mp * (T.orb + T.drb + O.orb + O.drb);
      n.ast += s.ast; d.ast += (s.mp / f) * T.fg - s.fg;
      n.stl += s.stl * f; d.stl += s.mp * oppPoss;
      n.blk += s.blk * f; d.blk += s.mp * (O.fga - O.tpa);
      n.usg += (s.fga + 0.44 * s.fta + s.tov) * f; d.usg += s.mp * (T.fga + 0.44 * T.fta + T.tov);
    });
    if (!ok) return null;
    var out = {};
    Object.keys(n).forEach(function (k) { var v = div(100 * n[k], d[k]); out[k] = v; });
    return out;
  }
  function possessionsOne(a, b) {
    var orbShare = (a.orb + b.drb) > 0 ? a.orb / (a.orb + b.drb) : 0;
    return a.fga + 0.4 * a.fta - 1.07 * orbShare * (a.fga - a.fg) + a.tov;
  }

  // Hollinger's unadjusted PER for one stint (Basketball-Reference formula)
  function uPER(s, ts, lg) {
    var L = lg.totals, T = ts.team;
    if (!(s.mp > 0) || !(L.fg > 0) || !(L.ft > 0) || !(L.pf > 0) || !(T.fg > 0)) return null;
    var lgTRB = L.orb + L.drb;
    if (!(lgTRB > 0)) return null;
    var factor = (2 / 3) - (0.5 * (L.ast / L.fg)) / (2 * (L.fg / L.ft));
    var vopDen = L.fga - L.orb + L.tov + 0.44 * L.fta;
    if (!(vopDen > 0)) return null;
    var VOP = L.pts / vopDen;
    var DRBp = (lgTRB - L.orb) / lgTRB;
    var tmAstFg = T.ast / T.fg;
    var trb = s.orb + s.drb;
    return (1 / s.mp) * (
      s.tp
      + (2 / 3) * s.ast
      + (2 - factor * tmAstFg) * s.fg
      + s.ft * 0.5 * (1 + (1 - tmAstFg) + (2 / 3) * tmAstFg)
      - VOP * s.tov
      - VOP * DRBp * (s.fga - s.fg)
      - VOP * 0.44 * (0.44 + 0.56 * DRBp) * (s.fta - s.ft)
      + VOP * (1 - DRBp) * (trb - s.orb)
      + VOP * DRBp * s.orb
      + VOP * s.stl
      + VOP * DRBp * s.blk
      - s.pf * ((L.ft / L.pf) - 0.44 * (L.fta / L.pf) * VOP)
    );
  }

  function teamPace(ts) {
    var tm = possessionsOne(ts.team, ts.opp), op = possessionsOne(ts.opp, ts.team);
    return ts.mp > 0 ? 48 * ((tm + op) / 2) / (ts.mp / 5) : null;
  }
  function leaguePace(lg) { return lg.mp > 0 ? 48 * lg.poss / (lg.mp / 5) : null; }

  // aPER for every stint of a league season, then the league's MP-weighted average (normalises to 15)
  var perCache = {};
  function leaguePER(c, seasonYear, comp) {
    var lgKey = seasonYear + '|' + comp;
    var lg = c.leagues[lgKey];
    if (!lg) return null;
    var stamp = lg.g + ':' + lg.mp;
    var cached = perCache[lgKey];
    if (cached && cached.stamp === stamp && cached.c === c) return cached;
    var lp = leaguePace(lg);
    var aper = {}, sum = 0, mins = 0;
    Object.keys(c.players).forEach(function (pid) {
      c.players[pid].forEach(function (s) {
        if (s.seasonYear !== seasonYear || s.competition !== comp) return;
        var ts = c.teams[seasonYear + '|' + comp + '|' + s.teamId];
        var u = ts ? uPER(s, ts, lg) : null;
        var tp = ts ? teamPace(ts) : null;
        if (u == null || !tp || !lp) return;
        var a = (lp / tp) * u;
        aper[pid + '|' + s.teamId] = a;
        sum += a * s.mp; mins += s.mp;
      });
    });
    var out = { stamp: stamp, c: c, aper: aper, lgAPER: mins > 0 ? sum / mins : null };
    perCache[lgKey] = out;
    return out;
  }

  function stintPER(c, s) {
    var L = leaguePER(c, s.seasonYear, s.competition);
    if (!L || !(L.lgAPER > 0)) return null;
    var a = L.aper[s.playerId + '|' + s.teamId];
    return a == null ? null : a * (15 / L.lgAPER);
  }

  // PER over several stints: minutes-weighted (PER is a per-minute rating)
  function aggregatePER(c, stints) {
    var sum = 0, mins = 0;
    for (var i = 0; i < stints.length; i++) {
      var v = stintPER(c, stints[i]);
      if (v == null) return null;
      sum += v * stints[i].mp; mins += stints[i].mp;
    }
    return div(sum, mins);
  }

  /* --- lines & tables -------------------------------------------------------- */

  function sum(stints) {
    var t = { g: 0, gs: 0, mp: 0 };
    COUNT.forEach(function (k) { t[k] = 0; });
    stints.forEach(function (s) { t.g += s.g; t.gs += s.gs; t.mp += s.mp; COUNT.forEach(function (k) { t[k] += s[k]; }); });
    return t;
  }

  // Every displayed value of a line (one stint, a combined season or a career)
  function line(c, stints) {
    var t = sum(stints);
    var d = derive(t);
    var ctx = contextRates(stints, c);
    return {
      totals: t, derived: d,
      perGame: perScale(t, t.g, 1), per36: perScale(t, t.mp, 36),
      advanced: {
        per: aggregatePER(c, stints),
        ts: d.ts, tpar: d.tpar, ftr: d.ftr,
        orbPct: ctx && ctx.orb, drbPct: ctx && ctx.drb, trbPct: ctx && ctx.trb,
        astPct: ctx && ctx.ast, stlPct: ctx && ctx.stl, blkPct: ctx && ctx.blk,
        tovPct: d.tovPct, usgPct: ctx && ctx.usg,
        // Not yet calculable to Basketball-Reference's definitions (see UNAVAILABLE)
        ows: null, dws: null, ws: null, ws48: null, obpm: null, dbpm: null, bpm: null, vorp: null
      }
    };
  }

  function perScale(t, denom, k) {
    var o = {};
    ['fg', 'fga', 'tp', 'tpa', 'ft', 'fta', 'orb', 'drb', 'ast', 'stl', 'blk', 'tov', 'pf', 'pts'].forEach(function (f) { o[f] = denom > 0 ? t[f] / denom * k : null; });
    o.trb = denom > 0 ? (t.orb + t.drb) / denom * k : null;
    o.twoP = denom > 0 ? (t.fg - t.tp) / denom * k : null;
    o.twoPA = denom > 0 ? (t.fga - t.tpa) / denom * k : null;
    o.mp = t.g > 0 ? t.mp / t.g : null;            // per-game minutes (per-36 tables show total MP)
    return o;
  }

  var UNAVAILABLE = {
    ows: 'Offensive Win Shares', dws: 'Defensive Win Shares', ws: 'Win Shares', ws48: 'Win Shares per 48 minutes',
    obpm: 'Offensive Box Plus/Minus', dbpm: 'Defensive Box Plus/Minus', bpm: 'Box Plus/Minus', vorp: 'Value Over Replacement Player'
  };

  /**
   * Rows for a player's tables in one competition.
   * @returns { rows: [{ kind: 'season'|'combined'|'split'|'career'|'franchise', seasonYear, label, age,
   *                    team, teamId, position, awards[], current, line, group }], hasData }
   */
  function playerRows(save, playerId, competition) {
    var c = ensure(save);
    var stints = (c.players[playerId] || []).filter(function (s) { return s.competition === competition; });
    var awards = (c.awards[playerId] || []);
    var rows = [];
    var years = [];
    stints.forEach(function (s) { if (years.indexOf(s.seasonYear) === -1) years.push(s.seasonYear); });
    years.sort(function (a, b) { return a - b; });
    years.forEach(function (y) {
      var ss = stints.filter(function (s) { return s.seasonYear === y; })
        .sort(function (a, b) { return Season.compareDates(a.firstDate, b.firstDate); });
      var aw = competition === 'preseason' ? [] : awards.filter(function (a) { return a.seasonYear === y; }).map(function (a) { return a.code; });
      var base = { seasonYear: y, label: ss[0].seasonLabel, age: ss[0].age, position: ss[ss.length - 1].position, current: y === save.calendar.seasonYear, group: y };
      if (ss.length === 1) {
        rows.push(Object.assign({ kind: 'season', team: ss[0].teamAbbr, teamId: ss[0].teamId, awards: aw, line: line(c, ss) }, base));
      } else {
        rows.push(Object.assign({ kind: 'combined', team: ss.length + 'TM', teamId: null, awards: aw, line: line(c, ss),
          teamNote: ss.map(function (s) { return s.teamAbbr; }).join(', ') }, base));
        ss.forEach(function (s) {
          rows.push(Object.assign({}, base, { kind: 'split', team: s.teamAbbr, teamId: s.teamId, awards: [], line: line(c, [s]) }));
        });
      }
    });
    var hasData = stints.length > 0;
    if (hasData) {
      rows.push({ kind: 'career', label: 'Career', line: line(c, stints), awards: [], group: Infinity });
      var franchises = [];
      stints.forEach(function (s) { if (franchises.indexOf(s.teamId) === -1) franchises.push(s.teamId); });
      if (franchises.length > 1) {
        franchises.forEach(function (fid) {
          var fs = stints.filter(function (s) { return s.teamId === fid; });
          var latest = fs.slice().sort(function (a, b) { return b.seasonYear - a.seasonYear; })[0];
          rows.push({ kind: 'franchise', label: latest.teamAbbr + ' career', team: latest.teamAbbr, teamId: fid,
            line: line(c, fs), awards: [], group: Infinity, seasons: fs.length });
        });
      }
    }
    return { rows: rows, hasData: hasData };
  }

  /* --- league leaders (with qualification) ---------------------------------- */

  // Basketball-Reference minimums (82-game basis), scaled to games played so far
  var QUALIFY = { games: 58 / 82, fg: 300, tp: 82, ft: 125, mp: 1500 };

  function leagueLeaders(save, seasonYear, competition) {
    var c = ensure(save);
    var teamGames = Object.keys(c.teams).filter(function (k) { return k.indexOf(seasonYear + '|' + competition + '|') === 0; })
      .map(function (k) { return c.teams[k].g; });
    var maxG = teamGames.length ? Math.max.apply(null, teamGames) : 0;
    if (!maxG) return {};
    var scale = maxG / 82;
    var lines = Object.keys(c.players).map(function (pid) {
      var ss = c.players[pid].filter(function (s) { return s.seasonYear === seasonYear && s.competition === competition; });
      return ss.length ? { pid: pid, line: line(c, ss) } : null;
    }).filter(Boolean);
    var best = {};
    lines.forEach(function (x) {
      var t = x.line.totals, pg = x.line.perGame, d = x.line.derived, a = x.line.advanced;
      var gOk = t.g >= Math.ceil(QUALIFY.games * maxG);
      function c2(key, v, ok) {
        if (v == null || !ok || !(v > 0)) return;          // nobody "leads" with zero
        if (!best[key] || v > best[key].v + 1e-12) best[key] = { v: v, pids: [x.pid] };
        else if (Math.abs(v - best[key].v) <= 1e-12) best[key].pids.push(x.pid);
      }
      ['pts', 'trb', 'ast', 'stl', 'blk', 'fg', 'fga', 'tp', 'tpa', 'ft', 'fta', 'orb', 'drb', 'mp'].forEach(function (k) {
        c2('pg.' + k, k === 'trb' ? pg.trb : pg[k], gOk);
        c2('tot.' + k, k === 'trb' ? d.trb : t[k], true);
      });
      c2('pct.fg', d.fgPct, t.fg >= QUALIFY.fg * scale);
      c2('pct.tp', d.tpPct, t.tp >= QUALIFY.tp * scale);
      c2('pct.ft', d.ftPct, t.ft >= QUALIFY.ft * scale);
      c2('pct.efg', d.efg, t.fg >= QUALIFY.fg * scale);
      c2('pct.twoP', d.twoPct, t.fg >= QUALIFY.fg * scale);
      var mpOk = t.mp >= QUALIFY.mp * scale;
      ['per', 'ts', 'orbPct', 'drbPct', 'trbPct', 'astPct', 'stlPct', 'blkPct', 'usgPct'].forEach(function (k) { c2('adv.' + k, a[k], mpOk); });
    });
    var out = {};
    Object.keys(best).forEach(function (k) { out[k] = best[k].pids; });
    return out;
  }

  /* --- validation ------------------------------------------------------------- */

  function isValid(save) {
    var c = save.careerStats;
    if (c === undefined) return true;
    if (!c || typeof c.games !== 'object' || typeof c.players !== 'object' || typeof c.teams !== 'object' || typeof c.leagues !== 'object' || typeof c.awards !== 'object') return false;
    return Object.keys(c.players).every(function (pid) {
      return Array.isArray(c.players[pid]) && c.players[pid].every(function (s) {
        return s && s.playerId === pid && Number.isInteger(s.seasonYear) && COMPETITIONS.indexOf(s.competition) !== -1 &&
          Number.isInteger(s.g) && s.g >= 0 && Number.isInteger(s.gs) && s.gs <= s.g && s.mp >= 0 &&
          COUNT.every(function (k) { return Number.isInteger(s[k]) && s[k] >= 0; }) &&
          s.fg <= s.fga && s.tp <= s.tpa && s.tp <= s.fg && s.ft <= s.fta &&
          s.pts === 2 * (s.fg - s.tp) + 3 * s.tp + s.ft;
      });
    }) && Object.keys(c.awards).every(function (pid) {
      return Array.isArray(c.awards[pid]) && c.awards[pid].every(function (a) { return a && Number.isInteger(a.seasonYear) && AWARDS[a.code]; });
    });
  }

  return {
    COUNT: COUNT, COMPETITIONS: COMPETITIONS, COMP_LABELS: COMP_LABELS, AWARDS: AWARDS, UNAVAILABLE: UNAVAILABLE, QUALIFY: QUALIFY,
    ensure: ensure, recordGame: recordGame, addAward: addAward, seasonAge: seasonAge,
    derive: derive, possessions: possessions, contextRates: contextRates, uPER: uPER,
    line: line, playerRows: playerRows, leagueLeaders: leagueLeaders, isValid: isValid
  };
});
