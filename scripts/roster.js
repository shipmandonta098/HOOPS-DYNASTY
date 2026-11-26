/* ==========================================================================
   HOOPS DYNASTY — roster initialization (minimal, extensible)

   generateLeague(teams, seed) builds 15 fictional players per team and a
   valid starting lineup (one distinct player per position). It runs ONCE,
   when a dynasty is created (or migrated from a save without rosters);
   the result is stored in the save and never regenerated.

   Ratings are calibrated so teamOverall(roster) equals the franchise's
   starting strength exactly, keeping contenders / rebuilders consistent.

   Player record:
   { id, teamId, firstName, lastName, position, age, overall, potential,
     jerseyNumber, heightIn, portrait }
   Future systems (contracts, attributes, injuries, morale...) add fields.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var node = typeof module === 'object' && module.exports;
  var api = factory(
    node ? require('./random.js') : root.HDRandom,
    node ? require('./portraits.js') : root.HDPortraits
  );
  if (node) module.exports = api;
  else root.HDRoster = api;
})(typeof self !== 'undefined' ? self : this, function (R, Portraits) {
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

  var FIRST = ['Andre', 'Malik', 'Jalen', 'Tyrese', 'Darius', 'Marcus', 'Elijah', 'Isaiah', 'Caleb', 'Jordan', 'Cameron', 'Devin', 'Trey', 'Xavier', 'Quentin',
    'Rashad', 'Damon', 'Terrell', 'Aaron', 'Brandon', 'Colin', 'Dante', 'Emmett', 'Felix', 'Gavin', 'Hugo', 'Ivan', 'Jonah', 'Kendrick', 'Luca', 'Mateo',
    'Nikolai', 'Omar', 'Pierce', 'Reggie', 'Silas', 'Tobias', 'Ulysses', 'Vince', 'Wes', 'Yusuf', 'Zane', 'Amari', 'Bryce', 'Cedric', 'Desmond', 'Ezra',
    'Franco', 'Grant', 'Hassan', 'Idris', 'Jamal', 'Keon', 'Lamar', 'Miles', 'Nate', 'Otis', 'Paxton', 'Roman', 'Santiago', 'Theo', 'Victor', 'Wendell',
    'Alonzo', 'Bastian', 'Corey', 'Dorian', 'Elias', 'Finn', 'Gideon', 'Harlan', 'Jasper', 'Kai', 'Leon', 'Moses', 'Noel', 'Orlando', 'Rocco', 'Soren'];
  var LAST = ['Abernathy', 'Achebe', 'Alvarado', 'Ashford', 'Baptiste', 'Barlow', 'Beckford', 'Bellamy', 'Bianchi', 'Boateng', 'Brannigan', 'Calloway',
    'Castellanos', 'Chukwu', 'Cordero', 'Crenshaw', 'Dabrowski', 'Delgado', 'Diallo', 'Dorsey', 'Duchamp', 'Easley', 'Ellison', 'Esposito', 'Faulkner',
    'Ferreira', 'Fontaine', 'Galloway', 'Garrity', 'Gentry', 'Haddad', 'Halvorsen', 'Hargrove', 'Holloway', 'Ibekwe', 'Ingram-Shaw', 'Jankovic', 'Jaramillo',
    'Kamara', 'Kessler', 'Kincaid', 'Kovac', 'Lachance', 'Langford', 'Ledbetter', 'Lindgren', 'Lombardi', 'Mbeki', 'McAllister', 'Mendoza', 'Moreau',
    'Nakamura', 'Ndiaye', 'Novak', 'Oduya', 'Okafor', 'Olander', 'Pacheco', 'Petrovic', 'Pemberton', 'Quarles', 'Radcliffe', 'Ramsey', 'Rinaldi',
    'Rutherford', 'Salazar', 'Sandoval', 'Seabrook', 'Silva', 'Sorensen', 'Stanton', 'Strickland', 'Takahashi', 'Thorne', 'Toussaint', 'Underwood',
    'Valdez', 'Vasquez', 'Voss', 'Wainwright', 'Whitaker', 'Whitfield', 'Wojcik', 'Yamamoto', 'Yeboah', 'Zamora', 'Zielinski', 'Aldridge-Moss', 'Banda',
    'Carrow', 'Desrosiers', 'Eberhardt', 'Fairley', 'Grimaldi', 'Hutchins', 'Iwobi', 'Jessup', 'Kowalski', 'Lockhart', 'Marchetti', 'Nwosu', 'Ortega',
    'Prescott', 'Quintero', 'Ridley', 'Sowell', 'Tavares', 'Umeh', 'Vickers', 'Winslow', 'Yancey', 'Zeller-Park'];

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

  function generateTeam(team, rng, nextId, usedNames) {
    var target = team.overall;
    var youthBias = target < 71 ? -2.5 : target >= 86 ? 2.5 : 0;
    var positions = rng.shuffle(POSITIONS.concat(POSITIONS, POSITIONS));
    var offsets = OFFSETS.slice();
    var jerseys = rng.shuffle(JERSEYS);

    var players = positions.map(function (pos, i) {
      var first, last, guard = 0;
      do {
        first = rng.pick(FIRST); last = rng.pick(LAST);
      } while (usedNames[first + ' ' + last] && guard++ < 50);
      usedNames[first + ' ' + last] = true;

      var overall = clamp(Math.round(target + offsets[i] + rng.normal() * 1.2), 40, 99);
      // Better players skew to prime age; bench mixes rookies and veterans.
      var age = clamp(Math.round(26 + youthBias + rng.normal() * 2.6 + (offsets[i] < -8 ? rng.pick([-3, 4]) : 0)), 19, 37);
      var potential = clamp(overall + Math.max(0, 26 - age) * rng.int(1, 3) + rng.int(0, 3), overall, 99);
      var id = nextId();
      return {
        id: id,
        teamId: team.id,
        firstName: first,
        lastName: last,
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
   * @returns { players[], lineups{ teamId: {PG,SG,SF,PF,C} }, ratings{ teamId: n } }
   */
  function generateLeague(teams, seed) {
    var rng = R.rng('roster:' + seed);
    var counter = 0;
    var usedNames = {};
    var nextId = function () { counter++; return 'pl-' + String(counter).padStart(4, '0'); };
    var out = { players: [], lineups: {}, ratings: {} };
    teams.forEach(function (team) {
      var res = generateTeam(team, rng, nextId, usedNames);
      out.players = out.players.concat(res.players);
      out.lineups[team.id] = res.lineup;
      out.ratings[team.id] = res.overall;
    });
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
