/* ==========================================================================
   HOOPS DYNASTY — league team editing model
   Used by New Dynasty → Select Franchise → Customize (edit / delete /
   relocate teams) and by the dynasty initializer, which validates the
   edited list before it builds a league.

   An editable team (plain object, never the frozen catalog entry):
     { id, franchiseId, city, name, abbreviation, division, conference,
       population, marketSize, arenaName, arenaCapacity,
       logo, secondaryLogo, colors{primary,secondary,tertiary}, overall }
   conference and marketSize are always derived (division / population).

   Logos are a local asset path, an http(s) image URL, or an uploaded image
   stored as a small data URL (the editor scales uploads down first).
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var node = typeof module === 'object' && module.exports;
  var api = factory(node ? require('../data/franchises.js') : root.HDFranchises);
  if (node) module.exports = api;
  else root.HDTeams = api;
})(typeof self !== 'undefined' ? self : this, function (F) {
  'use strict';

  var LIMITS = Object.freeze({
    cityMax: 40,
    nameMax: 40,
    arenaMin: 2,
    arenaMax: 60,
    population: { min: 10000, max: 50000000 },
    capacity: { min: 1000, max: 100000 },
    minPerConference: 4,          // smallest playoff format takes 4 per conference
    maxTeams: 50,
    logoUrlMax: 2048,
    logoDataMax: 400000           // characters of an uploaded image data URL
  });

  // Markets a team can relocate to (approximate 2023 metro populations,
  // rounded). The league's founding cities are offered as well.
  var RELOCATION_CITIES = [
    ['Albuquerque', 920000], ['Austin', 2473000], ['Baltimore', 2834000], ['Birmingham', 1184000],
    ['Buffalo', 1155000], ['Calgary', 1600000], ['Cincinnati', 2271000], ['Columbus', 2180000],
    ['Hartford', 1151000], ['Honolulu', 990000], ['Jacksonville', 1713000], ['Kansas City', 2221000],
    ['Las Vegas', 2337000], ['Louisville', 1366000], ['Mexico City', 21800000], ['Montreal', 4500000],
    ['Nashville', 2103000], ['Omaha', 984000], ['Pittsburgh', 2423000], ['Providence', 1677000], ['Raleigh', 1509000],
    ['Richmond', 1349000], ['San Diego', 3270000], ['Seattle', 4045000], ['St. Louis', 2797000],
    ['Tampa', 3343000], ['Vancouver', 3000000], ['Virginia Beach', 1787000]
  ].map(function (c) { return { city: c[0], population: c[1] }; });

  function relocationCities() {
    var seen = {};
    var list = [];
    RELOCATION_CITIES.concat(F.FRANCHISES.map(function (t) { return { city: t.city, population: t.population }; }))
      .forEach(function (c) { if (!seen[c.city]) { seen[c.city] = true; list.push(c); } });
    return list.sort(function (a, b) { return a.city.localeCompare(b.city); });
  }

  function fullName(t) { return (String(t.city).trim() + ' ' + String(t.name).trim()).trim(); }

  // Catalog franchise -> editable copy
  function fromFranchise(f) {
    return {
      id: f.id,
      franchiseId: f.id,
      city: f.city,
      name: f.name,
      abbreviation: f.abbreviation,
      division: f.division,
      conference: f.conference,
      population: f.population,
      marketSize: f.marketSize,
      arenaName: f.arena.name,
      arenaCapacity: f.arena.capacity,
      logo: f.logo.src,
      secondaryLogo: null,
      colors: { primary: f.colors.primary, secondary: f.colors.secondary, tertiary: f.colors.tertiary },
      overall: f.overall
    };
  }

  function defaultLeague() { return F.FRANCHISES.map(fromFranchise); }

  /* --- expansion --------------------------------------------------------- */

  // Expansion franchises not yet in `list`
  function availableExpansion(list) {
    var have = {};
    (list || []).forEach(function (t) { have[t.id] = true; });
    return F.EXPANSION.filter(function (f) { return !have[f.id]; });
  }

  // Teams in `list` that share a city with `team` (e.g. a second Oklahoma City club)
  function sameMarket(team, list) {
    var city = String(team.city).trim().toLowerCase();
    return (list || []).filter(function (t) { return t.id !== team.id && String(t.city).trim().toLowerCase() === city; });
  }

  /**
   * Editable copy of an expansion franchise, ready to add to `list`. If its
   * abbreviation is already taken in this league, a unique one is suggested.
   * @returns {{ team, errors }} errors = validateTeam() against `list`
   */
  function expansionTeam(id, list) {
    var f = F.byId(id);
    if (!f || F.EXPANSION.indexOf(f) === -1) return null;
    var t = fromFranchise(f);
    var taken = (list || []).some(function (o) { return String(o.abbreviation).toUpperCase() === t.abbreviation; });
    if (taken) t.abbreviation = suggestAbbreviation(t.city, list, t.id);
    return { team: t, errors: validateTeam(t, list) };
  }

  var customCounter = 0;
  // A blank team for "Create a custom team" (generic logo, neutral colors)
  function newCustomTeam(division) {
    customCounter++;
    var id = 'cx-' + Date.now().toString(36) + '-' + customCounter;
    var div = F.division(division) || F.DIVISIONS[0];
    return {
      id: id,
      franchiseId: id,
      city: '',
      name: '',
      abbreviation: '',
      division: div.id,
      conference: div.conference,
      population: 1000000,
      marketSize: F.marketSizeFor(1000000),
      arenaName: '',
      arenaCapacity: 18000,
      logo: 'assets/logos/custom.svg',
      secondaryLogo: null,
      colors: { primary: '#3A3D44', secondary: '#E8E8EA', tertiary: '#9A9DA5' },
      overall: 60                 // expansion-level seed for roster generation
    };
  }

  function copy(t) {
    var c = {};
    Object.keys(t).forEach(function (k) { c[k] = t[k]; });
    c.colors = { primary: t.colors.primary, secondary: t.colors.secondary, tertiary: t.colors.tertiary };
    return c;
  }

  // Recompute derived fields after an edit.
  function normalize(t) {
    var c = copy(t);
    c.city = String(c.city).trim().replace(/\s+/g, ' ');
    c.name = String(c.name).trim().replace(/\s+/g, ' ');
    c.arenaName = String(c.arenaName).trim().replace(/\s+/g, ' ');
    c.abbreviation = String(c.abbreviation).trim().toUpperCase();
    ['primary', 'secondary', 'tertiary'].forEach(function (k) { c.colors[k] = String(c.colors[k]).toUpperCase(); });
    var div = F.division(c.division);
    if (div) c.conference = div.conference;
    if (Number.isInteger(c.population)) c.marketSize = F.marketSizeFor(c.population);
    return c;
  }

  /* --- logos ------------------------------------------------------------- */

  var LOCAL_LOGO = /^assets\/logos\/[A-Za-z0-9_-]+\.svg$/;
  var DATA_LOGO = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/;
  var URL_LOGO = /^https?:\/\/[^\s"'<>]+$/i;

  function isLogoRef(v) {
    if (typeof v !== 'string') return false;
    if (LOCAL_LOGO.test(v)) return true;
    if (v.indexOf('data:') === 0) return v.length <= LIMITS.logoDataMax && DATA_LOGO.test(v);
    return v.length <= LIMITS.logoUrlMax && URL_LOGO.test(v);
  }

  /* --- abbreviations ----------------------------------------------------- */

  function letters(s) { return String(s).toUpperCase().replace(/[^A-Z\s]/g, ' ').trim().split(/\s+/).filter(Boolean); }

  // "Las Vegas" -> "LV", "Seattle" -> "SEA"; varied until unique in `list`.
  function suggestAbbreviation(city, list, selfId) {
    var taken = {};
    (list || []).forEach(function (t) { if (t.id !== selfId) taken[t.abbreviation] = true; });
    var words = letters(city);
    if (!words.length) return '';
    var all = words.join('');
    var options = [];
    if (words.length > 1) {
      var initials = words.map(function (w) { return w[0]; }).join('').slice(0, 3);
      options.push(initials);
      options.push(words[0][0] + words[words.length - 1].slice(0, 2));
    }
    options.push(all.slice(0, 3));
    for (var i = 1; i < all.length; i++) for (var j = i + 1; j < all.length; j++) options.push(all[0] + all[i] + all[j]);
    for (var k = 0; k < options.length; k++) {
      if (/^[A-Z]{2,4}$/.test(options[k]) && !taken[options[k]]) return options[k];
    }
    return all.slice(0, 3);
  }

  /* --- validation -------------------------------------------------------- */

  function isText(v, min, max) { return typeof v === 'string' && v.trim().length >= min && v.trim().length <= max; }
  var NAME_CHARS = /^[\p{L}\p{M}0-9 .'’&-]+$/u;
  var HEX = /^#[0-9A-Fa-f]{6}$/;

  /**
   * Field errors for one team, checked against the rest of the league.
   * @returns {object} field -> message ({} when valid)
   */
  function validateTeam(team, list) {
    var e = {};
    var t = normalize(team);
    var others = (list || []).filter(function (o) { return o.id !== t.id; });
    if (!t.city) e.city = 'City is required.';
    else if (t.city.length > LIMITS.cityMax) e.city = 'City must be ' + LIMITS.cityMax + ' characters or fewer.';
    else if (!NAME_CHARS.test(t.city)) e.city = 'Use letters, numbers, spaces and . \' & - only.';
    if (!t.name) e.name = 'Team name is required.';
    else if (t.name.length > LIMITS.nameMax) e.name = 'Team name must be ' + LIMITS.nameMax + ' characters or fewer.';
    else if (!NAME_CHARS.test(t.name)) e.name = 'Use letters, numbers, spaces and . \' & - only.';
    if (!e.city && !e.name && others.some(function (o) { return fullName(o).toLowerCase() === fullName(t).toLowerCase(); })) {
      e.name = 'Another team is already called the ' + fullName(t) + '.';
    }
    if (!/^[A-Z]{2,4}$/.test(t.abbreviation)) e.abbreviation = 'Use 2–4 letters, e.g. ATL.';
    else if (others.some(function (o) { return String(o.abbreviation).toUpperCase() === t.abbreviation; })) {
      e.abbreviation = t.abbreviation + ' is already used by another team.';
    }
    if (!F.division(t.division)) e.division = 'Choose a division.';
    if (!Number.isInteger(t.population) || t.population < LIMITS.population.min || t.population > LIMITS.population.max) {
      e.population = 'Enter a population from ' + LIMITS.population.min.toLocaleString('en-US') + ' to ' + LIMITS.population.max.toLocaleString('en-US') + '.';
    }
    if (!Number.isInteger(t.arenaCapacity) || t.arenaCapacity < LIMITS.capacity.min || t.arenaCapacity > LIMITS.capacity.max) {
      e.arenaCapacity = 'Enter a capacity from ' + LIMITS.capacity.min.toLocaleString('en-US') + ' to ' + LIMITS.capacity.max.toLocaleString('en-US') + '.';
    }
    if (!isText(t.arenaName, LIMITS.arenaMin, LIMITS.arenaMax)) e.arenaName = 'Arena name must be ' + LIMITS.arenaMin + '–' + LIMITS.arenaMax + ' characters.';
    else if (!NAME_CHARS.test(t.arenaName)) e.arenaName = 'Use letters, numbers, spaces and . \' & - only.';
    if (!isLogoRef(t.logo)) e.logo = 'A primary logo is required.';
    if (t.secondaryLogo !== null && t.secondaryLogo !== undefined && !isLogoRef(t.secondaryLogo)) e.secondaryLogo = 'That secondary logo can’t be used.';
    ['primary', 'secondary', 'tertiary'].forEach(function (k) {
      if (!HEX.test(t.colors[k])) e[k + 'Color'] = 'Use a hex color like #1D428A.';
    });
    return e;
  }

  /**
   * Whole-league check. opts.minPerConference (default LIMITS.minPerConference)
   * lets the caller require more teams per conference for its playoff format.
   * @returns {{ valid, errors: string[] }}
   */
  function validateLeague(list, opts) {
    opts = opts || {};
    var errors = [];
    if (!Array.isArray(list) || !list.length) return { valid: false, errors: ['The league has no teams.'] };
    var ids = {};
    list.forEach(function (t) {
      if (!t || typeof t.id !== 'string' || ids[t.id]) errors.push('Every team needs a unique ID.');
      else ids[t.id] = true;
      var e = validateTeam(t, list);
      var keys = Object.keys(e);
      if (keys.length) errors.push(fullName(t) + ': ' + e[keys[0]]);
    });
    if (list.length > LIMITS.maxTeams) errors.push('A league can have at most ' + LIMITS.maxTeams + ' teams.');
    var need = Math.max(LIMITS.minPerConference, opts.minPerConference || 0);
    F.CONFERENCES.forEach(function (c) {
      var n = list.filter(function (t) { return normalize(t).conference === c.id; }).length;
      if (n < need) errors.push('The ' + c.name + ' has ' + n + ' team' + (n === 1 ? '' : 's') + '; it needs at least ' + need + '.');
    });
    var unique = errors.filter(function (m, i) { return errors.indexOf(m) === i; });
    return { valid: unique.length === 0, errors: unique };
  }

  // True when `list` differs from the default league
  function isCustomized(list) {
    var def = defaultLeague();
    if (!list || list.length !== def.length) return true;
    return list.some(function (t, i) { return JSON.stringify(normalize(t)) !== JSON.stringify(normalize(def[i])); });
  }

  return {
    LIMITS: LIMITS,
    relocationCities: relocationCities,
    fullName: fullName,
    fromFranchise: fromFranchise,
    defaultLeague: defaultLeague,
    availableExpansion: availableExpansion,
    expansionTeam: expansionTeam,
    newCustomTeam: newCustomTeam,
    sameMarket: sameMarket,
    copy: copy,
    normalize: normalize,
    isLogoRef: isLogoRef,
    suggestAbbreviation: suggestAbbreviation,
    validateTeam: validateTeam,
    validateLeague: validateLeague,
    isCustomized: isCustomized
  };
});
