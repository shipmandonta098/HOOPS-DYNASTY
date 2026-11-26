/* ==========================================================================
   HOOPS DYNASTY — dynasty model (no DOM; usable in the browser or Node)

   - LEAGUE_RULES: configurable limits for league setup.
   - validateSetup(): checks the League Setup form values.
   - createDynasty(): builds a brand-new dynasty from the setup choices and
     the default franchise data.
   - teamOverall(): the one place team strength is read from (provisional
     today; swap in a roster-based calculation later).

   SAVE SCHEMA (schemaVersion 1)
   {
     schemaVersion, id, createdAt, updatedAt,

     // Save header. The title screen's Continue button reads these four
     // fields directly, so keep them current as the dynasty progresses.
     teamName, season, wins, losses,

     league:   { name, foundedYear, conferences[], teamIds[] },
     gm:       { name, teamId },
     calendar: { startYear, seasonYear, seasonLabel, phase },
     userTeamId,
     teams: [{ id, franchiseId, city, name, fullName, abbreviation, logo,
               colors{primary,secondary,tertiary}, marketSize, conference,
               overall, ratingSource, control: 'human' | 'cpu' }]
   }

   Teams are copied into the save (not referenced) so later relocations,
   rebrands or expansion never rewrite an existing dynasty's history.
   Future systems (rosters, contracts, schedule, standings, ownership...)
   should add their own top-level keys and bump schemaVersion with a
   migration in scripts/save-store.js.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HDDynasty = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SCHEMA_VERSION = 1;

  var LEAGUE_RULES = Object.freeze({
    defaultStartYear: 2026,
    minStartYear: 1950,
    maxStartYear: 2100,
    nameMinLength: 2,
    nameMaxLength: 40
  });

  // 2026 -> "2026–27" (en dash, like a printed season label)
  function seasonLabel(year) {
    year = Number(year);
    return year + '–' + String((year + 1) % 100).padStart(2, '0');
  }

  // Trim and collapse internal whitespace.
  function cleanName(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function parseYear(value) {
    var text = String(value == null ? '' : value).trim();
    return /^\d{4}$/.test(text) ? Number(text) : NaN;
  }

  function validateName(value, label) {
    var name = cleanName(value);
    if (!name) return label + ' is required.';
    if (name.length < LEAGUE_RULES.nameMinLength) return label + ' must be at least ' + LEAGUE_RULES.nameMinLength + ' characters.';
    if (name.length > LEAGUE_RULES.nameMaxLength) return label + ' must be ' + LEAGUE_RULES.nameMaxLength + ' characters or fewer.';
    return null;
  }

  function validateYear(value) {
    var text = String(value == null ? '' : value).trim();
    if (!text) return 'Starting year is required.';
    var year = parseYear(text);
    if (isNaN(year)) return 'Enter a four-digit year.';
    if (year < LEAGUE_RULES.minStartYear || year > LEAGUE_RULES.maxStartYear) {
      return 'Choose a year from ' + LEAGUE_RULES.minStartYear + ' to ' + LEAGUE_RULES.maxStartYear + '.';
    }
    return null;
  }

  // -> { valid, errors: { leagueName?, gmName?, startYear? }, values }
  function validateSetup(input) {
    input = input || {};
    var errors = {};
    var e;
    if ((e = validateName(input.leagueName, 'League name'))) errors.leagueName = e;
    if ((e = validateName(input.gmName, 'General manager name'))) errors.gmName = e;
    if ((e = validateYear(input.startYear))) errors.startYear = e;
    return {
      valid: Object.keys(errors).length === 0,
      errors: errors,
      values: {
        leagueName: cleanName(input.leagueName),
        gmName: cleanName(input.gmName),
        startYear: parseYear(input.startYear)
      }
    };
  }

  // Team strength. Today every team uses its provisional franchise rating;
  // when rosters exist, compute from the roster here and set ratingSource.
  function teamOverall(team) {
    return team.overall;
  }

  function makeId(now) {
    var rand = Math.random().toString(36).slice(2, 8);
    return 'dyn-' + now.getTime().toString(36) + '-' + rand;
  }

  /**
   * Build a new dynasty.
   * @param {object} setup       { leagueName, gmName, startYear, franchiseId }
   * @param {object} franchises  the HDFranchises module
   * @param {Date}   [now]
   */
  function createDynasty(setup, franchises, now) {
    now = now || new Date();
    var check = validateSetup(setup);
    if (!check.valid) throw new Error('Invalid league setup: ' + JSON.stringify(check.errors));

    var problems = franchises.validate();
    if (problems.length) throw new Error('Franchise data is invalid: ' + problems.join('; '));

    var userTeam = franchises.byId(setup.franchiseId);
    if (!userTeam) throw new Error('Unknown franchise: ' + setup.franchiseId);

    var v = check.values;
    var stamp = now.toISOString();

    var teams = franchises.FRANCHISES.map(function (f) {
      return {
        id: f.id,                 // team id == franchise id for the founding league
        franchiseId: f.id,
        city: f.city,
        name: f.name,
        fullName: f.fullName,
        abbreviation: f.abbreviation,
        logo: f.logo.src,
        colors: { primary: f.colors.primary, secondary: f.colors.secondary, tertiary: f.colors.tertiary },
        marketSize: f.marketSize,
        conference: f.conference,
        overall: teamOverall(f),
        ratingSource: 'provisional',
        control: f.id === userTeam.id ? 'human' : 'cpu'
      };
    });

    return {
      schemaVersion: SCHEMA_VERSION,
      id: makeId(now),
      createdAt: stamp,
      updatedAt: stamp,

      teamName: userTeam.fullName,
      season: seasonLabel(v.startYear),
      wins: 0,
      losses: 0,

      league: {
        name: v.leagueName,
        foundedYear: v.startYear,
        conferences: franchises.CONFERENCES.map(function (c) {
          return {
            id: c.id,
            name: c.name,
            teamIds: teams.filter(function (t) { return t.conference === c.id; }).map(function (t) { return t.id; })
          };
        }),
        teamIds: teams.map(function (t) { return t.id; })
      },
      gm: { name: v.gmName, teamId: userTeam.id },
      calendar: {
        startYear: v.startYear,
        seasonYear: v.startYear,
        seasonLabel: seasonLabel(v.startYear),
        phase: 'preseason'
      },
      userTeamId: userTeam.id,
      teams: teams
    };
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    LEAGUE_RULES: LEAGUE_RULES,
    seasonLabel: seasonLabel,
    cleanName: cleanName,
    parseYear: parseYear,
    validateSetup: validateSetup,
    teamOverall: teamOverall,
    createDynasty: createDynasty
  };
});
