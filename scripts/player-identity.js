/* ==========================================================================
   HOOPS DYNASTY — player identity generation (centralized)

   The one place that decides who a player IS: nationality, cultural naming
   background, name, birthplace, secondary nationality, college and
   development pathway. Used by league creation today and meant for future
   draft classes, free agents and expansion rosters.

   NOTHING here reads or writes ratings, height, weight or position:
   basketball attributes come from scripts/roster.js and are independent of
   nationality and background by construction.

   Order of generation (per player)
     nationality -> naming background -> name -> birthplace / dual
     nationality -> college or development pathway (+ league entry age)

   League creation
     assignLeague(players, seed)  League-wide quota: the American share is
       drawn per dynasty around 73% (70–76%), so international players are
       24–30% of the league; which players are international is a seeded
       shuffle, so teams naturally vary.

   Existing dynasties
     addMissing(players, seed)  Fills only fields that are missing. Never
       renames anyone or changes an existing nationality, college, rating.

   Player identity fields
     firstName, lastName, suffix (opt), nameOrder ('given-first' |
     'surname-first'), nameOrigin (naming background id | null),
     nationality (primary ISO code), secondaryNationality (code | null),
     birthCity, birthRegion (US state etc. | null), birthCountry (code),
     college (string | null), pathway { type, entryAge, country?, collegeYears? }
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var node = typeof module === 'object' && module.exports;
  var api = factory(
    node ? require('./random.js') : root.HDRandom,
    node ? require('../data/nationalities.js') : root.HDNationalities,
    node ? require('../data/name-pools.js') : root.HDNamePools,
    node ? require('../data/colleges.js') : root.HDColleges
  );
  if (node) module.exports = api;
  else root.HDPlayerIdentity = api;
})(typeof self !== 'undefined' ? self : this, function (R, N, Names, Colleges) {
  'use strict';

  var B = Names.BACKGROUNDS;

  /* --- helpers ---------------------------------------------------------- */

  function weighted(rng, table) {
    var keys = Object.keys(table);
    var total = keys.reduce(function (s, k) { return s + table[k]; }, 0);
    var r = rng.next() * total;
    for (var i = 0; i < keys.length; i++) {
      r -= table[keys[i]];
      if (r < 0) return keys[i];
    }
    return keys[keys.length - 1];
  }

  function fold(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }
  var BLOCKED = {};
  Names.BLOCKED_NAMES.forEach(function (n) { BLOCKED[fold(n)] = true; });

  function fullName(p) {
    if (!p) return '';
    var parts = p.nameOrder === 'surname-first' ? [p.lastName, p.firstName] : [p.firstName, p.lastName];
    if (p.suffix) parts.push(p.suffix);
    return parts.join(' ');
  }

  var INTERNATIONAL_WEIGHTS = (function () {
    var t = {};
    Object.keys(N.COUNTRIES).forEach(function (code) { if (N.COUNTRIES[code].weight > 0) t[code] = N.COUNTRIES[code].weight; });
    return t;
  })();

  /* --- nationality ------------------------------------------------------ */

  // A single player's nationality (for future draft classes / free agents)
  function pickNationality(rng, usShare) {
    var share = usShare == null ? N.LEAGUE_MIX.usShareTarget : usShare;
    return rng.chance(share) ? 'US' : weighted(rng, INTERNATIONAL_WEIGHTS);
  }

  function pickBackground(nationality, rng) {
    var c = N.country(nationality);
    return weighted(rng, c ? c.backgrounds : { 'anglo': 1 });
  }

  /* --- names ------------------------------------------------------------ */

  // -> { firstName, lastName, suffix, nameOrder, nameOrigin }
  function generateName(backgroundId, rng, used) {
    var id = backgroundId;
    var bg = B[id];
    if (bg && bg.mixOf) { id = rng.pick(bg.mixOf); bg = B[id]; }
    if (!bg) { id = 'anglo'; bg = B.anglo; }
    var out;
    for (var attempt = 0; attempt < 40; attempt++) {
      var first = rng.pick(bg.first);
      var last = rng.pick(bg.last);
      if (bg.noRepeatSame && first === last) continue;
      if (bg.compound && rng.chance(bg.compound.rate)) {
        var second = rng.pick(bg.last);
        if (second !== last) last = last + bg.compound.join + second;
      }
      if (bg.particles && rng.chance(bg.particles.rate)) last = rng.pick(bg.particles.values) + ' ' + last;
      var suffix = bg.suffix && rng.chance(bg.suffix.rate) ? rng.pick(bg.suffix.values) : null;
      out = { firstName: first, lastName: last, suffix: suffix, nameOrder: bg.order || 'given-first', nameOrigin: id };
      var key = fold(fullName(out));
      var plain = fold(first + ' ' + last);
      if (BLOCKED[key] || BLOCKED[plain]) continue;
      if (used && used[key]) continue;
      break;
    }
    if (used) used[fold(fullName(out))] = true;
    return out;
  }

  /* --- birthplace ------------------------------------------------------- */

  var FAMILY_ABROAD_BIRTH = ['DE', 'IT', 'JP', 'GB'];       // e.g. military / expatriate families
  var US_BORN_ABROAD_COUNTRIES = { BS: 1, DO: 1, JM: 1, MX: 1, PH: 1, NG: 1, CM: 1, SS: 1, CD: 1, AO: 1, SN: 1, CA: 1, AU: 1, NZ: 1, IL: 1, GB: 1 };

  // -> { birthCity, birthRegion, birthCountry, secondaryNationality }
  function birthplace(nationality, nameOrigin, rng) {
    var bg = B[nameOrigin];
    var origins = (bg && bg.origin ? bg.origin : []).filter(function (c) { return c !== nationality && N.isValidCode(c); });
    var heritage = origins.length ? rng.pick(origins) : null;
    var born = nationality;
    var secondary = null;

    if (nationality === 'PR') {
      secondary = 'US';                                    // Puerto Ricans are U.S. citizens
    } else if (heritage && rng.chance(0.22)) {
      born = heritage;                                     // immigrant family, born in the heritage country
      secondary = rng.chance(0.55) ? heritage : null;
    } else if (heritage && rng.chance(0.15)) {
      secondary = heritage;                                // born at home, holds heritage citizenship too
    } else if (nationality === 'US' && rng.chance(0.015)) {
      born = rng.pick(FAMILY_ABROAD_BIRTH);
    } else if (US_BORN_ABROAD_COUNTRIES[nationality] && rng.chance(0.06)) {
      born = 'US';                                         // raised in the U.S., represents another country
      secondary = 'US';
    }
    var cities = N.cityList(born);
    var city = cities.length ? rng.pick(cities) : { city: N.countryName(born), region: null };
    return { birthCity: city.city, birthRegion: city.region, birthCountry: born, secondaryNationality: secondary };
  }

  /* --- college & development pathway --------------------------------- */

  function pathwayCountry(type, nationality, rng) {
    var c = N.country(nationality);
    if (type === 'domestic-club') return nationality === 'US' ? 'US' : nationality;
    if (type === 'foreign-club') return rng.pick(N.CLUB_HUBS.filter(function (x) { return x !== nationality; }));
    if (type === 'academy') return c && c.region === 'africa' ? rng.pick(['SN', 'NG']) : nationality;
    if (type === 'pro-development') return nationality === 'US' ? 'US' : (c && c.region === 'oceania' ? 'AU' : 'US');
    return nationality;
  }

  /**
   * College / pathway consistent with the player's age.
   * entryAge (age when the player joined the league) drives experience.
   * opts.entryAge forces it (existing players: age - experience)
   * opts.college: undefined = decide; string / null = keep as given
   */
  function development(nationality, age, rng, opts) {
    opts = opts || {};
    var c = N.country(nationality) || N.country('US');
    var college;
    if (opts.college !== undefined) college = opts.college;
    else college = rng.chance(c.collegeRate) ? Colleges.pick(rng.next) : null;

    var type = college ? 'ncaa' : weighted(rng, c.pathways);
    var entryAge = opts.entryAge != null ? opts.entryAge : Math.min(age, rng.pick(N.ENTRY_AGES[type]));
    var pathway = { type: type, entryAge: entryAge };
    if (type === 'ncaa') pathway.collegeYears = Math.max(1, Math.min(5, entryAge - 18));
    else pathway.country = pathwayCountry(type, nationality, rng);
    return { college: college || null, pathway: pathway };
  }

  /* --- whole identity --------------------------------------------------- */

  /**
   * Identity for one NEW player (future draft classes, free agents...).
   * opts: { nationality, usShare, used (name registry) }
   */
  function generateIdentity(player, seed, opts) {
    opts = opts || {};
    var rng = R.rng('identity:' + seed + ':' + player.id);
    var nationality = opts.nationality || pickNationality(rng, opts.usShare);
    var name = generateName(pickBackground(nationality, rng), rng, opts.used);
    var birth = birthplace(nationality, name.nameOrigin, rng);
    var dev = development(nationality, player.age, rng);
    return {
      firstName: name.firstName, lastName: name.lastName, suffix: name.suffix,
      nameOrder: name.nameOrder, nameOrigin: name.nameOrigin,
      nationality: nationality, secondaryNationality: birth.secondaryNationality,
      birthCity: birth.birthCity, birthRegion: birth.birthRegion, birthCountry: birth.birthCountry,
      college: dev.college, pathway: dev.pathway
    };
  }

  // Draw this league's American share (70–76%)
  function leagueUsShare(seed) {
    var r = R.rng('league-mix:' + seed);
    return N.LEAGUE_MIX.usShareTarget + (r.next() * 2 - 1) * N.LEAGUE_MIX.usShareVariation;
  }

  // League-wide nationality quota for the given players (seeded shuffle).
  function nationalityPlan(players, seed) {
    var rng = R.rng('nationality:' + seed);
    var share = leagueUsShare(seed);
    var intlCount = Math.round(players.length * (1 - share));
    var order = rng.shuffle(players.map(function (p) { return p.id; }));
    var plan = {};
    order.forEach(function (id, i) { plan[id] = i < intlCount ? weighted(rng, INTERNATIONAL_WEIGHTS) : 'US'; });
    return plan;
  }

  /** New league: full identities (including names) for every player. */
  function assignLeague(players, seed) {
    var plan = nationalityPlan(players, seed);
    var used = {};
    players.forEach(function (p) {
      var id = generateIdentity(p, seed, { nationality: plan[p.id], used: used });
      Object.keys(id).forEach(function (k) { p[k] = id[k]; });
    });
    return players;
  }

  /**
   * Existing dynasties: add only what's missing. Names, nationalities,
   * colleges and ratings that already exist are never changed.
   */
  function addMissing(players, seed) {
    var needNat = players.filter(function (p) { return !p.nationality; });
    var plan = needNat.length ? nationalityPlan(needNat, seed + ':legacy') : {};
    var used = {};
    players.forEach(function (p) { if (p.firstName) used[fold(fullName(p))] = true; });

    players.forEach(function (p) {
      var rng = R.rng('identity-fill:' + seed + ':' + p.id);
      if (!p.nationality) p.nationality = plan[p.id] || 'US';
      if (!p.firstName || !p.lastName) {
        var nm = generateName(pickBackground(p.nationality, rng), rng, used);
        p.firstName = nm.firstName; p.lastName = nm.lastName; p.suffix = nm.suffix;
        p.nameOrder = nm.nameOrder; p.nameOrigin = nm.nameOrigin;
      }
      if (p.nameOrder === undefined) p.nameOrder = 'given-first';
      if (p.nameOrigin === undefined) p.nameOrigin = null;      // existing name: background unknown
      if (p.suffix === undefined) p.suffix = null;
      if (p.birthCountry === undefined) {
        // Existing players: born in their country (no assumptions from the name)
        var cities = N.cityList(p.nationality);
        var city = cities.length ? rng.pick(cities) : { city: N.countryName(p.nationality), region: null };
        p.birthCountry = p.nationality; p.birthCity = city.city; p.birthRegion = city.region;
        if (p.secondaryNationality === undefined) p.secondaryNationality = p.nationality === 'PR' ? 'US' : null;
      }
      if (p.secondaryNationality === undefined) p.secondaryNationality = null;
      if (p.pathway === undefined) {
        var hasExp = Number.isInteger(p.experience) && Number.isInteger(p.age);
        var dev = development(p.nationality, p.age, rng, {
          college: p.college !== undefined ? p.college : undefined,
          entryAge: hasExp ? Math.max(17, p.age - p.experience) : null
        });
        if (p.college === undefined) p.college = dev.college;
        p.pathway = dev.pathway;
      }
      if (p.college === undefined) {
        // Pathway known but college missing: keep the two consistent
        p.college = p.pathway.type === 'ncaa' ? Colleges.pick(rng.next) : null;
      }
    });
    return players;
  }

  /* --- display ------------------------------------------------------------ */

  // Shown at state level for U.S. births ("Georgia, USA": the country
  // name avoids confusion with the country Georgia) and country level for
  // everyone else ("France"). The birth city stays in the save, unused.
  var REGION_NAMES = { 'D.C.': 'Washington, D.C.' };
  function birthplaceLabel(p) {
    if (!p || !p.birthCountry) return '—';
    if (p.birthCountry === 'US') {
      return p.birthRegion ? (REGION_NAMES[p.birthRegion] || p.birthRegion) + ', USA' : 'United States';
    }
    return N.countryName(p.birthCountry);
  }

  function pathwayLabel(p) {
    var pw = p && p.pathway;
    if (!pw) return '—';
    if (pw.type === 'ncaa') return 'NCAA · ' + (p.college || 'College') + (pw.collegeYears ? ' (' + pw.collegeYears + (pw.collegeYears === 1 ? ' season)' : ' seasons)') : '');
    var where = pw.country ? N.countryName(pw.country) : '';
    if (pw.type === 'domestic-club') return 'Professional club · ' + where;
    if (pw.type === 'foreign-club') return 'Professional club abroad · ' + where;
    if (pw.type === 'academy') return 'Basketball academy · ' + where;
    if (pw.type === 'pro-development') return 'Professional development program' + (where ? ' · ' + where : '');
    if (pw.type === 'prep') return 'Prep school (straight to the pros)';
    return N.PATHWAYS[pw.type] || '—';
  }

  return {
    fullName: fullName,
    fold: fold,
    isBlocked: function (name) { return !!BLOCKED[fold(name)]; },
    pickNationality: pickNationality,
    pickBackground: pickBackground,
    generateName: generateName,
    birthplace: birthplace,
    development: development,
    generateIdentity: generateIdentity,
    leagueUsShare: leagueUsShare,
    assignLeague: assignLeague,
    addMissing: addMissing,
    birthplaceLabel: birthplaceLabel,
    pathwayLabel: pathwayLabel
  };
});
