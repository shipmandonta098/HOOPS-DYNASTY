/* ==========================================================================
   HOOPS DYNASTY — statistics model
   Stores raw season TOTALS per team and per player (in the dynasty save);
   every displayed number (per-game, percentages, ratings, ranks, leaders)
   is computed from those totals here. With zero games played everything
   resolves to null, so the UI shows dashes rather than invented numbers.

   A future game simulation only has to add box-score totals via
   addTeamGame() / addPlayerGame().
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HDStats = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TEAM_FIELDS = ['gp', 'min', 'pts', 'oppPts', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta',
    'reb', 'ast', 'stl', 'blk', 'tov', 'poss', 'oppPoss'];
  var PLAYER_FIELDS = ['gp', 'gs', 'min', 'pts', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta',
    'reb', 'ast', 'stl', 'blk', 'tov'];

  function zeros(fields) {
    var o = {};
    fields.forEach(function (f) { o[f] = 0; });
    return o;
  }

  function initSeason(seasonYear, teams, players) {
    var s = { seasonYear: seasonYear, teams: {}, players: {} };
    teams.forEach(function (t) { s.teams[t.id] = zeros(TEAM_FIELDS); });
    players.forEach(function (p) { s.players[p.id] = zeros(PLAYER_FIELDS); });
    return s;
  }

  function add(target, box, fields) {
    fields.forEach(function (f) { target[f] = (target[f] || 0) + (box[f] || 0); });
  }
  function addTeamGame(season, teamId, box) { add(season.teams[teamId], Object.assign({ gp: 1 }, box), TEAM_FIELDS); }
  function addPlayerGame(season, playerId, box) { add(season.players[playerId], Object.assign({ gp: 1 }, box), PLAYER_FIELDS); }

  function per(n, d) { return d > 0 ? n / d : null; }

  // Team categories shown on the dashboard. `lowerIsBetter` drives ranking.
  var TEAM_CATEGORIES = [
    { id: 'ppg',  label: 'Points',               short: 'PPG',  format: 'num', calc: function (t) { return per(t.pts, t.gp); } },
    { id: 'oppg', label: 'Opponent Points',      short: 'OPPG', format: 'num', lowerIsBetter: true, calc: function (t) { return per(t.oppPts, t.gp); } },
    { id: 'rpg',  label: 'Rebounds',             short: 'RPG',  format: 'num', calc: function (t) { return per(t.reb, t.gp); } },
    { id: 'apg',  label: 'Assists',              short: 'APG',  format: 'num', calc: function (t) { return per(t.ast, t.gp); } },
    { id: 'spg',  label: 'Steals',               short: 'SPG',  format: 'num', calc: function (t) { return per(t.stl, t.gp); } },
    { id: 'bpg',  label: 'Blocks',               short: 'BPG',  format: 'num', calc: function (t) { return per(t.blk, t.gp); } },
    { id: 'topg', label: 'Turnovers',            short: 'TOV',  format: 'num', lowerIsBetter: true, calc: function (t) { return per(t.tov, t.gp); } },
    { id: 'fgp',  label: 'Field Goal %',         short: 'FG%',  format: 'pct', calc: function (t) { return t.gp ? per(t.fgm, t.fga) : null; } },
    { id: 'tpp',  label: 'Three-Point %',        short: '3P%',  format: 'pct', calc: function (t) { return t.gp ? per(t.tpm, t.tpa) : null; } },
    { id: 'ftp',  label: 'Free Throw %',         short: 'FT%',  format: 'pct', calc: function (t) { return t.gp ? per(t.ftm, t.fta) : null; } },
    { id: 'ortg', label: 'Offensive Rating',     short: 'ORTG', format: 'num', calc: function (t) { return t.gp && t.poss ? 100 * t.pts / t.poss : null; } },
    { id: 'drtg', label: 'Defensive Rating',     short: 'DRTG', format: 'num', lowerIsBetter: true, calc: function (t) { return t.gp && t.oppPoss ? 100 * t.oppPts / t.oppPoss : null; } },
    { id: 'net',  label: 'Net Rating',           short: 'NET',  format: 'signed', calc: function (t) {
      if (!t.gp || !t.poss || !t.oppPoss) return null;
      return 100 * t.pts / t.poss - 100 * t.oppPts / t.oppPoss;
    } },
    { id: 'pace', label: 'Pace',                 short: 'PACE', format: 'num', calc: function (t) {
      return t.gp && t.min ? ((t.poss + t.oppPoss) / 2) / (t.min / 240) : null;
    } }
  ];

  var LEADER_CATEGORIES = [
    { id: 'ppg', label: 'Points',   short: 'PPG', field: 'pts' },
    { id: 'rpg', label: 'Rebounds', short: 'RPG', field: 'reb' },
    { id: 'apg', label: 'Assists',  short: 'APG', field: 'ast' },
    { id: 'spg', label: 'Steals',   short: 'SPG', field: 'stl' },
    { id: 'bpg', label: 'Blocks',   short: 'BPG', field: 'blk' }
  ];

  /**
   * Team stat lines with league ranks.
   * -> { gamesPlayed, rows: [{ id, label, short, value|null, rank|null, of|null, format }] }
   */
  function teamSummary(season, teamId) {
    var mine = (season && season.teams && season.teams[teamId]) || zeros(TEAM_FIELDS);
    var others = season && season.teams ? Object.keys(season.teams) : [];
    var rows = TEAM_CATEGORIES.map(function (cat) {
      var value = cat.calc(mine);
      var rank = null, of = null;
      if (value != null) {
        var values = others.map(function (id) { return cat.calc(season.teams[id]); }).filter(function (v) { return v != null; });
        of = values.length;
        rank = 1 + values.filter(function (v) { return cat.lowerIsBetter ? v < value : v > value; }).length;
      }
      return { id: cat.id, label: cat.label, short: cat.short, value: value, rank: rank, of: of, format: cat.format };
    });
    return { gamesPlayed: mine.gp, rows: rows };
  }

  /**
   * Leading player per category among `roster`, from recorded totals.
   * -> [{ id, label, short, player|null, value|null }]
   */
  function teamLeaders(season, roster) {
    return LEADER_CATEGORIES.map(function (cat) {
      var best = null, bestValue = null;
      roster.forEach(function (p) {
        var t = season && season.players && season.players[p.id];
        if (!t || !t.gp) return;
        var v = t[cat.field] / t.gp;
        if (bestValue == null || v > bestValue) { best = p; bestValue = v; }
      });
      return { id: cat.id, label: cat.label, short: cat.short, player: best, value: bestValue };
    });
  }

  function format(value, kind) {
    if (value == null || !isFinite(value)) return '—';
    if (kind === 'pct') return (value * 100).toFixed(1) + '%';
    if (kind === 'signed') return (value > 0 ? '+' : '') + value.toFixed(1);
    return value.toFixed(1);
  }

  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  return {
    TEAM_FIELDS: TEAM_FIELDS,
    PLAYER_FIELDS: PLAYER_FIELDS,
    TEAM_CATEGORIES: TEAM_CATEGORIES,
    LEADER_CATEGORIES: LEADER_CATEGORIES,
    initSeason: initSeason,
    addTeamGame: addTeamGame,
    addPlayerGame: addPlayerGame,
    teamSummary: teamSummary,
    teamLeaders: teamLeaders,
    format: format,
    ordinal: ordinal
  };
});
