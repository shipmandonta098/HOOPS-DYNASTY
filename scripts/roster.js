/* ==========================================================================
   HOOPS DYNASTY — roster initialization (minimal, extensible)

   generateLeague(teams, seed) builds 15 fictional players per team and a
   valid starting lineup (one distinct player per position). It runs ONCE,
   when a dynasty is created (or migrated from a save without rosters);
   the result is stored in the save and never regenerated.

   Ratings are calibrated so teamOverall(roster) equals the franchise's
   starting strength exactly, keeping contenders / rebuilders consistent.

   Player record:
   { id, teamId, position, age, overall, potential, jerseyNumber, heightIn,
     portrait } + identity (name, nationality, birthplace, college, pathway)
   from scripts/player-identity.js. Ratings, height and age are generated
   here with NO knowledge of nationality or naming background; identities
   are assigned afterwards by an independent seeded generator.
   Future systems (contracts, attributes, injuries, morale...) add fields.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var node = typeof module === 'object' && module.exports;
  var api = factory(
    node ? require('./random.js') : root.HDRandom,
    node ? require('./portraits.js') : root.HDPortraits,
    node ? require('./player-identity.js') : root.HDPlayerIdentity
  );
  if (node) module.exports = api;
  else root.HDRoster = api;
})(typeof self !== 'undefined' ? self : this, function (R, Portraits, Identity) {
  'use strict';

  var POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
  var POSITION_NAMES = { PG: 'Point Guard', SG: 'Shooting Guard', SF: 'Small Forward', PF: 'Power Forward', C: 'Center' };
  var ROSTER_SIZE = 15;
  var HEIGHTS = { PG: [72, 77], SG: [75, 79], SF: [78, 81], PF: [80, 83], C: [82, 86] };
  // Rating offsets from the team target, best to worst (15 slots)
  var OFFSETS = [9, 6, 4, 3, 2, -1, -3, -4, -6, -7, -9, -11, -12, -14, -16];
  // Team overall = weighted average of the top 10 player ratings
  var WEIGHTS = [6, 5, 5, 4, 4, 3, 2, 2, 1, 1];
  var JERSEYS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 40, 41, 42, 43, 44, 45, 50, 51, 55, 77, 88];

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function teamOverall(players) {
    var ratings = players.map(function (p) { return p.overall; }).sort(function (a, b) { return b - a; });
    var sum = 0, w = 0;
    for (var i = 0; i < WEIGHTS.length && i < ratings.length; i++) { sum += ratings[i] * WEIGHTS[i]; w += WEIGHTS[i]; }
    return w ? Math.round(sum / w) : 0;
  }

  // Best player at each position. Positions are filled in order of their
  // best candidate, so no player can hold two spots.
  function bestLineup(players) {
    var used = {};
    var lineup = {};
    POSITIONS.forEach(function (pos) {
      var candidates = players.filter(function (p) { return p.position === pos && !used[p.id]; })
        .sort(function (a, b) { return b.overall - a.overall || a.id.localeCompare(b.id); });
      var pick = candidates[0];
      if (!pick) {            // no natural fit: best remaining player
        pick = players.filter(function (p) { return !used[p.id]; }).sort(function (a, b) { return b.overall - a.overall; })[0];
      }
      if (pick) { lineup[pos] = pick.id; used[pick.id] = true; }
    });
    return lineup;
  }

  // Rating offsets for any roster size, sampled from the 15-player curve.
  function offsetsFor(size) {
    if (size === OFFSETS.length) return OFFSETS.slice();
    var out = [];
    for (var i = 0; i < size; i++) {
      var t = size === 1 ? 0 : i * (OFFSETS.length - 1) / (size - 1);
      var lo = Math.floor(t), hi = Math.min(OFFSETS.length - 1, lo + 1);
      out.push(Math.round(OFFSETS[lo] + (OFFSETS[hi] - OFFSETS[lo]) * (t - lo)));
    }
    return out;
  }

  // Balanced positions: every position at least twice for 10+ players.
  function positionsFor(size) {
    var list = [];
    for (var i = 0; i < size; i++) list.push(POSITIONS[i % POSITIONS.length]);
    return list;
  }

  function generateTeam(team, rng, nextId, size) {
    var target = team.overall;
    var youthBias = target < 71 ? -2.5 : target >= 86 ? 2.5 : 0;
    var positions = rng.shuffle(positionsFor(size));
    var offsets = offsetsFor(size);
    var jerseys = rng.shuffle(JERSEYS);

    var players = positions.map(function (pos, i) {
      var overall = clamp(Math.round(target + offsets[i] + rng.normal() * 1.2), 40, 99);
      // Better players skew to prime age; bench mixes rookies and veterans.
      var age = clamp(Math.round(26 + youthBias + rng.normal() * 2.6 + (offsets[i] < -8 ? rng.pick([-3, 4]) : 0)), 19, 37);
      var potential = clamp(overall + Math.max(0, 26 - age) * rng.int(1, 3) + rng.int(0, 3), overall, 99);
      var id = nextId();
      return {
        id: id,
        teamId: team.id,
        position: pos,
        age: age,
        overall: overall,
        potential: potential,
        jerseyNumber: jerseys[i],
        heightIn: rng.int(HEIGHTS[pos][0], HEIGHTS[pos][1]),
        portrait: Portraits.generate(id + ':' + team.id)
      };
    });

    // Calibrate: nudge individual ratings until the roster formula hits the
    // franchise's starting strength exactly.
    var guard2 = 0;
    var current = teamOverall(players);
    while (current !== target && guard2++ < 400) {
      var dir = current < target ? 1 : -1;
      var ordered = players.slice().sort(function (a, b) { return b.overall - a.overall; });
      var p = ordered[guard2 % 10];
      p.overall = clamp(p.overall + dir, 40, 99);
      p.potential = Math.max(p.potential, p.overall);
      current = teamOverall(players);
    }

    return { players: players, lineup: bestLineup(players), overall: current };
  }

  /**
   * @param teams  dynasty team records (need id, overall)
   * @param seed   any string (the dynasty id), for reproducibility
   * @param opts   { rosterSize } (default 15)
   * @returns { players[], lineups{ teamId: {PG,SG,SF,PF,C} }, ratings{ teamId: n } }
   */
  function generateLeague(teams, seed, opts) {
    var size = (opts && opts.rosterSize) || ROSTER_SIZE;
    var rng = R.rng('roster:' + seed);
    var counter = 0;
    var nextId = function () { counter++; return 'pl-' + String(counter).padStart(4, '0'); };
    var out = { players: [], lineups: {}, ratings: {} };
    teams.forEach(function (team) {
      var res = generateTeam(team, rng, nextId, size);
      out.players = out.players.concat(res.players);
      out.lineups[team.id] = res.lineup;
      out.ratings[team.id] = res.overall;
    });
    // Identities (nationality, name, birthplace, college...) are assigned
    // league-wide AFTER ratings exist, from their own seed.
    Identity.assignLeague(out.players, seed);
    return out;
  }

  function validateLineup(lineup, roster) {
    if (!lineup) return false;
    var ids = POSITIONS.map(function (p) { return lineup[p]; });
    var onTeam = {};
    roster.forEach(function (p) { onTeam[p.id] = true; });
    return ids.every(function (id) { return typeof id === 'string' && onTeam[id]; }) &&
      new Set(ids).size === POSITIONS.length;
  }

  function heightLabel(inches) {
    return Math.floor(inches / 12) + '′' + (inches % 12) + '″';
  }

  return {
    POSITIONS: POSITIONS,
    POSITION_NAMES: POSITION_NAMES,
    ROSTER_SIZE: ROSTER_SIZE,
    teamOverall: teamOverall,
    bestLineup: bestLineup,
    generateLeague: generateLeague,
    validateLineup: validateLineup,
    heightLabel: heightLabel
  };
});
