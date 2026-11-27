/* ==========================================================================
   HOOPS DYNASTY — roster initialization (minimal, extensible)

   generateLeague(teams, seed) builds the league's players and a valid
   starting lineup per team (one distinct player per position). It runs
   ONCE, when a dynasty is created (or migrated from a save without
   rosters); the result is stored in the save and never regenerated.

   Ratings come from scripts/player-ratings.js (config: data/rating-config.js):
   the league's overall distribution is handed out unevenly across teams
   (franchise strength biases it; market size never does), each player gets
   an archetype and attributes, and OVERALL IS COMPUTED FROM THE ATTRIBUTES.
   Team overall is then derived from the actual roster (teamOverall).

   Player record:
   { id, teamId, position, age, overall, potential, archetype,
     archetypeSecondary, attributes, jerseyNumber, heightIn, portrait }
     + identity (name, nationality, birthplace, college, pathway)
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
    node ? require('./player-identity.js') : root.HDPlayerIdentity,
    node ? require('./player-ratings.js') : root.HDPlayerRatings
  );
  if (node) module.exports = api;
  else root.HDRoster = api;
})(typeof self !== 'undefined' ? self : this, function (R, Portraits, Identity, Ratings) {
  'use strict';

  var POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
  var POSITION_NAMES = { PG: 'Point Guard', SG: 'Shooting Guard', SF: 'Small Forward', PF: 'Power Forward', C: 'Center' };
  var ROSTER_SIZE = 15;
  var HEIGHTS = { PG: [72, 77], SG: [75, 79], SF: [78, 81], PF: [80, 83], C: [82, 86] };
  // Team overall = rotation-weighted average of the top 10 player ratings
  // (starters count most, the end of the rotation least)
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

  // Balanced positions: every position at least twice for 10+ players.
  function positionsFor(size) {
    var list = [];
    for (var i = 0; i < size; i++) list.push(POSITIONS[i % POSITIONS.length]);
    return list;
  }

  function buildPlayer(seed, team, profile, pos, targetOverall, id, jersey, mode) {
    var r = R.rng('ratings:' + seed + ':' + id);
    // Men's leagues keep their exact random sequence (gender draws only otherwise)
    var gender = mode && mode !== 'male' ? Ratings.genderFor(R.rng('gender:' + seed + ':' + id), mode) : 'M';
    var age = Ratings.ageFor(r, targetOverall, profile.type);
    var heightIn = gender === 'F' ? Ratings.heightFor(r, pos, 'F') : r.int(HEIGHTS[pos][0], HEIGHTS[pos][1]);
    var rated = Ratings.generatePlayer(r, { position: pos, age: age, heightIn: heightIn, targetOverall: targetOverall, gender: gender });
    return {
      id: id,
      teamId: team.id,
      gender: gender,
      position: pos,
      age: age,
      overall: rated.overall,                 // computed from the attributes
      potential: rated.potential,
      archetype: rated.archetype,
      archetypeSecondary: rated.archetypeSecondary,
      attributes: rated.attributes,
      jerseyNumber: jersey,
      heightIn: heightIn,
      portrait: Portraits.generate(id + ':' + team.id, { female: gender === 'F' })
    };
  }

  /**
   * @param teams  dynasty team records (id; overall = franchise strength,
   *               used only to bias talent allocation)
   * @param seed   any string (the dynasty id), for reproducibility
   * @param opts   { rosterSize (default 15), gender: 'male'|'female'|'mixed' }
   * @returns { players[], lineups{ teamId: {PG,SG,SF,PF,C} }, ratings{ teamId: n },
   *            profiles{ teamId: { strength, type } } }
   */
  function generateLeague(teams, seed, opts) {
    var size = (opts && opts.rosterSize) || ROSTER_SIZE;
    var rng = R.rng('roster:' + seed);
    var counter = 0;
    var nextId = function () { counter++; return 'pl-' + String(counter).padStart(4, '0'); };
    var sizes = {}, profiles = {};
    teams.forEach(function (t) { sizes[t.id] = size; profiles[t.id] = Ratings.teamProfile(rng, t); });
    var values = Ratings.allocate(rng, teams, sizes, profiles);
    var out = { players: [], lineups: {}, ratings: {}, profiles: profiles };
    teams.forEach(function (team) {
      var positions = rng.shuffle(positionsFor(size));
      var mine = rng.shuffle(values[team.id]);
      var jerseys = rng.shuffle(JERSEYS);
      var players = positions.map(function (pos, i) {
        return buildPlayer(seed, team, profiles[team.id], pos, mine[i], nextId(), jerseys[i], opts && opts.gender);
      });
      out.players = out.players.concat(players);
      out.lineups[team.id] = bestLineup(players);
      out.ratings[team.id] = teamOverall(players);      // from the actual roster
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
