/* ==========================================================================
   HOOPS DYNASTY — player career background (draft, debut, relatives)
   addCareers(save) gives every player without one:
     draft:     { year, round, pick, overall, teamId, teamName }
                or { year, undrafted: true }
     debut:     { date, teamName, opponentName } or null (hasn't played yet)
     relatives: [{ relation, name, playerId? , note? }]

   Needs the whole league at once: draft slots are unique within a year and
   in-league relatives are pairs. Deterministic (seeded from the dynasty id)
   and stored in the save, so it's generated once and never changes.

   Consistency rules
   - draft year = the season the player entered the league
     (current season year - experience)
   - better players (overall + potential) tend to go earlier; ~18% of each
     class goes undrafted, skewed toward lower-rated players
   - debut = late October of the draft year; rookies in a season that
     hasn't started have no debut yet
   - in-league relatives only link players who ALREADY share a last name
     and nationality (names are never changed); others get a fictional
     former-pro relative
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var node = typeof module === 'object' && module.exports;
  var api = factory(
    node ? require('./random.js') : root.HDRandom,
    node ? require('./player-identity.js') : root.HDPlayerIdentity,
    node ? require('./season.js') : root.HDSeason
  );
  if (node) module.exports = api;
  else root.HDPlayerCareer = api;
})(typeof self !== 'undefined' ? self : this, function (R, Identity, Season) {
  'use strict';

  var ROUNDS = 2;
  var PICKS_PER_ROUND = 30;
  var FORMER_FIRST = ['Clarence', 'Lonnie', 'Reggie', 'Calvin', 'Darnell', 'Maurice', 'Vernon', 'Otis', 'Lamont', 'Bernard',
    'Rodney', 'Earl', 'Terrence', 'Cornell', 'Dwayne', 'Harold', 'Milton', 'Russell', 'Ezekiel', 'Stanley'];

  function pad(n) { return String(n).padStart(2, '0'); }

  function draftYearOf(p, seasonYear) {
    return seasonYear - (Number.isInteger(p.experience) ? p.experience : 0);
  }

  function addCareers(save) {
    var players = save.players || [];
    var seasonYear = save.calendar.seasonYear;
    var teams = save.teams || [];
    if (!teams.length) return save;
    var needs = players.filter(function (p) { return !p.draft; });
    if (!needs.length) return save;
    var rng = R.rng('career:' + save.id);
    var teamById = {};
    teams.forEach(function (t) { teamById[t.id] = t; });

    // Slots already used by players who have draft data (keeps re-runs safe)
    var taken = {};
    players.forEach(function (p) {
      if (p.draft && !p.draft.undrafted) (taken[p.draft.year] = taken[p.draft.year] || {})[p.draft.overall] = true;
    });

    /* --- Draft, one class (year) at a time ---------------------------- */
    var byYear = {};
    needs.forEach(function (p) { (byYear[draftYearOf(p, seasonYear)] = byYear[draftYearOf(p, seasonYear)] || []).push(p); });
    Object.keys(byYear).sort().forEach(function (yearKey) {
      var year = Number(yearKey);
      var cls = byYear[yearKey];
      // Draft order: talent with noise (scouting isn't perfect)
      var ranked = cls.map(function (p) {
        return { p: p, score: (p.overall + p.potential) / 2 + rng.normal() * 4 };
      }).sort(function (a, b) { return b.score - a.score; });

      var free = [];
      for (var n = 1; n <= ROUNDS * PICKS_PER_ROUND; n++) if (!(taken[year] && taken[year][n])) free.push(n);
      // ~18% undrafted, from the bottom half of the class
      var undraftedCount = Math.min(ranked.length, Math.max(ranked.length - free.length, Math.round(ranked.length * 0.18)));
      var drafted = ranked.slice(0, ranked.length - undraftedCount);
      // Spread the class across the board: pick distinct slots, best first
      var slots = rng.shuffle(free).slice(0, drafted.length).sort(function (a, b) { return a - b; });

      drafted.forEach(function (entry, i) {
        var overall = slots[i];
        var p = entry.p;
        // Current-season rookies usually play for the team that drafted them
        var team = p.experience === 0 && teamById[p.teamId] && rng.chance(0.7) ? teamById[p.teamId] : rng.pick(teams);
        p.draft = {
          year: year,
          round: Math.ceil(overall / PICKS_PER_ROUND),
          pick: ((overall - 1) % PICKS_PER_ROUND) + 1,
          overall: overall,
          teamId: team.id,
          teamName: team.fullName       // as named at the time of the draft
        };
        (taken[year] = taken[year] || {})[overall] = true;
      });
      ranked.slice(ranked.length - undraftedCount).forEach(function (entry) {
        entry.p.draft = { year: year, undrafted: true };
      });
    });

    /* --- Debut ------------------------------------------------------- */
    var seasonStarted = save.calendar.phase !== 'preseason';
    needs.forEach(function (p) {
      var year = p.draft.year;
      var played = p.experience > 0 || seasonStarted;
      if (!played) { p.debut = null; return; }
      var team = p.draft.teamId && teamById[p.draft.teamId] && rng.chance(0.8) ? teamById[p.draft.teamId] : rng.pick(teams);
      var opp = rng.pick(teams.filter(function (t) { return t.id !== team.id; }));
      p.debut = {
        date: Season.isoDate(year, 10, rng.int(19, 30)),
        teamName: team.fullName,
        opponentName: opp.fullName
      };
    });

    /* --- Relatives ------------------------------------------------------ */
    needs.forEach(function (p) { if (!Array.isArray(p.relatives)) p.relatives = []; });
    // In-league pairs: only players who already share a last name AND a
    // nationality (nothing about either player is changed to fit).
    var byLast = {};
    needs.forEach(function (p) { var k = p.lastName + '|' + p.nationality; (byLast[k] = byLast[k] || []).push(p); });
    var MAX_PAIRS = 8;                          // family ties should be rare
    var pairs = 0;
    Object.keys(byLast).sort().forEach(function (last) {
      var group = byLast[last].slice().sort(function (a, b) { return a.id.localeCompare(b.id); });
      for (var i = 0; i + 1 < group.length; i += 2) {
        if (pairs >= MAX_PAIRS || !rng.chance(0.1)) continue;
        pairs++;
        var a = group[i], b = group[i + 1];
        var relation = Math.abs(a.age - b.age) <= 7 ? 'Brother' : 'Cousin';
        a.relatives.push({ relation: relation, name: Identity.fullName(b), playerId: b.id });
        b.relatives.push({ relation: relation, name: Identity.fullName(a), playerId: a.id });
      }
    });
    // Former professionals in the family (fictional people)
    needs.forEach(function (p) {
      if (!rng.chance(0.03)) return;
      var relation = rng.chance(0.65) ? 'Son' : 'Nephew';
      // Same family name and naming tradition; given name from a pool that
      // fits the tradition when available.
      var elder = { firstName: rng.pick(FORMER_FIRST), lastName: p.lastName, nameOrder: p.nameOrder };
      p.relatives.push({ relation: relation, name: Identity.fullName(elder), note: 'former professional player' });
    });

    return save;
  }

  /* --- Formatting ------------------------------------------------------- */
  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  // "Detroit Dynamos, 2nd round (23rd pick, 53rd overall), 2024 Hardwood League Draft"
  function draftLabel(draft, leagueName) {
    if (!draft) return '—';
    var event = draft.year + ' ' + (leagueName ? leagueName + ' ' : '') + 'Draft';
    if (draft.undrafted) return 'Undrafted, ' + event;
    return draft.teamName + ', ' + ordinal(draft.round) + ' round (' + ordinal(draft.pick) + ' pick, ' + ordinal(draft.overall) + ' overall), ' + event;
  }

  return { addCareers: addCareers, draftLabel: draftLabel, ordinal: ordinal, ROUNDS: ROUNDS, PICKS_PER_ROUND: PICKS_PER_ROUND };
});
