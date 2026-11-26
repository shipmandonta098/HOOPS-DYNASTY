/* ==========================================================================
   HOOPS DYNASTY — player physical & timeline data
   generateBio() adds weight, birthdate and league experience to a player.
   Nationality, names, birthplace, college and development pathway come from
   scripts/player-identity.js (run first); this module only reads the
   pathway's entry age so experience fits the player's story.

   Consistency rules:
   - birthDate matches the stored age on the season's opening day (Oct 1)
   - experience = age - pathway.entryAge (0 = rookie)
   - weight follows height and position only (never nationality)
   Each player uses its own seeded generator; results are stored once.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var node = typeof module === 'object' && module.exports;
  var api = factory(
    node ? require('./random.js') : root.HDRandom,
    node ? require('../data/nationalities.js') : root.HDNationalities,
    node ? require('./season.js') : root.HDSeason
  );
  if (node) module.exports = api;
  else root.HDPlayerBio = api;
})(typeof self !== 'undefined' ? self : this, function (R, N, Season) {
  'use strict';

  // Base weight by position, adjusted by height (lb)
  var WEIGHT_BASE = { PG: 190, SG: 200, SF: 215, PF: 232, C: 248 };
  var HEIGHT_MID = { PG: 74.5, SG: 77, SF: 79.5, PF: 81.5, C: 84 };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function pad(n) { return String(n).padStart(2, '0'); }

  /**
   * @param player     { id, position, age, heightIn, pathway? }
   * @param seed       dynasty id
   * @param seasonYear the season the age applies to (opening day Oct 1)
   */
  function generateBio(player, seed, seasonYear) {
    var r = R.rng('bio:' + seed + ':' + player.id);
    var entryAge = player.pathway && Number.isInteger(player.pathway.entryAge) ? player.pathway.entryAge : 20;
    var experience = Math.max(0, player.age - entryAge);

    // Birthday such that the player is exactly `age` on Oct 1 of seasonYear.
    var month = r.int(1, 12);
    var day = r.int(1, month === 2 ? 28 : (month === 4 || month === 6 || month === 9 || month === 11) ? 30 : 31);
    var hadBirthday = month < 10 || (month === 10 && day <= 1);
    var birthYear = seasonYear - player.age - (hadBirthday ? 0 : 1);

    var base = WEIGHT_BASE[player.position] || 215;
    var mid = HEIGHT_MID[player.position] || 79;
    var weightLb = clamp(Math.round(base + (player.heightIn - mid) * 8 + r.normal() * 7), 165, 300);

    return {
      weightLb: weightLb,
      birthDate: Season.isoDate(birthYear, month, day),     // any year, correctly padded
      experience: experience
    };
  }

  // Adds bio fields to any player missing them (never overwrites).
  function addBios(players, seed, seasonYear) {
    players.forEach(function (p) {
      if (p.birthDate && Number.isInteger(p.weightLb) && Number.isInteger(p.experience)) return;
      var bio = generateBio(p, seed, seasonYear);
      Object.keys(bio).forEach(function (k) { if (p[k] === undefined) p[k] = bio[k]; });
    });
    return players;
  }

  function experienceLabel(years) {
    if (!Number.isInteger(years)) return '—';
    return years === 0 ? 'R' : String(years);
  }

  function countryName(code) { return N.countryName(code); }

  return {
    generateBio: generateBio,
    addBios: addBios,
    experienceLabel: experienceLabel,
    countryName: countryName
  };
});
