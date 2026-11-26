/* ==========================================================================
   HOOPS DYNASTY — player biographical data
   generateBio() adds weight, birthdate, nationality, league experience and
   college to a player. Each player uses its own seeded generator (dynasty
   seed + player id), so bios are reproducible and never disturb the rest
   of roster generation. Bios are generated once and stored in the save.

   Consistency rules:
   - birthDate matches the stored age on the season's opening day (Oct 1)
   - experience = seasons since entering the league (0 = rookie), derived
     from age and a realistic entry age (college years / international)
   - weight follows height and position
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var node = typeof module === 'object' && module.exports;
  var api = factory(node ? require('./random.js') : root.HDRandom);
  if (node) module.exports = api;
  else root.HDPlayerBio = api;
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';

  // ISO 3166-1 alpha-2 code -> display name. Weights shape the league mix.
  var COUNTRIES = {
    US: 'United States', CA: 'Canada', FR: 'France', RS: 'Serbia', AU: 'Australia',
    DE: 'Germany', ES: 'Spain', NG: 'Nigeria', LT: 'Lithuania', GR: 'Greece',
    SI: 'Slovenia', HR: 'Croatia', TR: 'Türkiye', BR: 'Brazil', AR: 'Argentina',
    CM: 'Cameroon', JP: 'Japan', LV: 'Latvia', BS: 'Bahamas', DO: 'Dominican Republic',
    IT: 'Italy', SN: 'Senegal', FI: 'Finland', ME: 'Montenegro'
  };
  var INTERNATIONAL = ['CA', 'CA', 'CA', 'FR', 'FR', 'AU', 'AU', 'RS', 'DE', 'ES', 'NG', 'LT', 'GR', 'SI',
    'HR', 'TR', 'BR', 'AR', 'CM', 'JP', 'LV', 'BS', 'DO', 'IT', 'SN', 'FI', 'ME'];
  // Share of each group that played U.S. college basketball
  var COLLEGE_RATE = { US: 0.88, CA: 0.7, AU: 0.45, NG: 0.6, CM: 0.4, BS: 0.75, DO: 0.5, SN: 0.35 };

  var COLLEGES = ['Duke', 'Kentucky', 'North Carolina', 'Kansas', 'UCLA', 'Villanova', 'Gonzaga', 'Michigan State',
    'Arizona', 'UConn', 'Syracuse', 'Louisville', 'Indiana', 'Michigan', 'Texas', 'Florida', 'Baylor', 'Virginia',
    'Wake Forest', 'Georgetown', 'Ohio State', 'Purdue', 'Tennessee', 'Alabama', 'Auburn', 'Arkansas', 'Houston',
    'Memphis', 'USC', 'Stanford', 'Oregon', 'Washington', 'Marquette', 'Creighton', 'Xavier', "Saint Mary's",
    'San Diego State', 'Iowa State', 'LSU', 'Texas Tech', 'Wisconsin', 'Illinois', 'Maryland', 'Notre Dame',
    'Butler', 'Davidson', 'Murray State', 'Dayton'];

  // Base weight by position, adjusted by height (lb)
  var WEIGHT_BASE = { PG: 190, SG: 200, SF: 215, PF: 232, C: 248 };
  var HEIGHT_MID = { PG: 74.5, SG: 77, SF: 79.5, PF: 81.5, C: 84 };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function pad(n) { return String(n).padStart(2, '0'); }

  /**
   * @param player     { id, position, age, heightIn }
   * @param seed       dynasty id
   * @param seasonYear the season the age applies to (opening day Oct 1)
   */
  function generateBio(player, seed, seasonYear) {
    var r = R.rng('bio:' + seed + ':' + player.id);

    var nationality = r.chance(0.74) ? 'US' : r.pick(INTERNATIONAL);
    var college = null;
    var entryAge;
    if (r.chance(COLLEGE_RATE[nationality] != null ? COLLEGE_RATE[nationality] : 0.15)) {
      college = r.pick(COLLEGES);
      entryAge = r.pick([19, 19, 20, 20, 21, 22, 22, 23]);     // one-and-done to four-year seniors
    } else {
      entryAge = nationality === 'US' ? r.pick([19, 19, 20]) : r.pick([19, 20, 20, 21, 22]);
    }
    var experience = Math.max(0, player.age - entryAge);

    // Birthday such that the player is exactly `age` on Oct 1 of seasonYear.
    var month = r.int(1, 12);
    var day = r.int(1, month === 2 ? 28 : (month === 4 || month === 6 || month === 9 || month === 11) ? 30 : 31);
    var hadBirthday = month < 10 || (month === 10 && day <= 1);
    var birthYear = seasonYear - player.age - (hadBirthday ? 0 : 1);

    var base = WEIGHT_BASE[player.position] || 215;
    var mid = HEIGHT_MID[player.position] || 79;
    var weightLb = clamp(Math.round((base + (player.heightIn - mid) * 8 + r.normal() * 7) / 1) , 165, 300);

    return {
      weightLb: weightLb,
      birthDate: birthYear + '-' + pad(month) + '-' + pad(day),
      nationality: nationality,
      experience: experience,
      college: college
    };
  }

  // Adds bios to any player that doesn't have one yet (never overwrites).
  function addBios(players, seed, seasonYear) {
    players.forEach(function (p) {
      if (p.birthDate && p.nationality) return;
      var bio = generateBio(p, seed, seasonYear);
      Object.keys(bio).forEach(function (k) { if (p[k] === undefined) p[k] = bio[k]; });
    });
    return players;
  }

  function experienceLabel(years) {
    if (!Number.isInteger(years)) return '—';
    return years === 0 ? 'R' : String(years);
  }

  function countryName(code) { return COUNTRIES[code] || code || '—'; }

  return {
    COUNTRIES: COUNTRIES,
    COLLEGES: COLLEGES,
    generateBio: generateBio,
    addBios: addBios,
    experienceLabel: experienceLabel,
    countryName: countryName
  };
});
