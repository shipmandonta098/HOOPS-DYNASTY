/* ==========================================================================
   HOOPS DYNASTY — dynasty model (no DOM, no storage; browser or Node)

   - LEAGUE_RULES / validateSetup(): League Setup limits and checks.
   - createDynasty(): builds a brand-new dynasty from setup choices + the
     default franchise data.
   - migrate(): upgrades any older save format to the current one.
   - validateDynasty(): strict structural check used for imports and
     before anything is written to storage.
   - summarize(): the small record shown on save cards / Continue.
   - exportPayload() / parseExport() / exportFilename(): the JSON file format.
   - teamOverall(): the one place team strength is read from.

   SAVE FORMAT (schemaVersion 2)
   {
     schemaVersion: 2,
     id,                         // permanent dynasty ID, never reused
     createdAt, updatedAt, lastPlayedAt,          // ISO timestamps
     league:   { name, foundedYear, conferences[{ id, name, teamIds[] }], teamIds[] },
     gm:       { name, teamId },
     calendar: { startYear, seasonYear, seasonLabel, phase },
     record:   { wins, losses },                  // user team, current season
     userTeamId,
     teams: [{ id, franchiseId, city, name, fullName, abbreviation, logo,
               colors{primary,secondary,tertiary}, marketSize, conference,
               overall, ratingSource, control: 'human' | 'cpu' }]
     // Future systems (rosters, contracts, schedule, standings, history...)
     // add their own top-level keys. Unknown keys are preserved by
     // storage, export and import, so nothing is dropped between versions.
   }

   To change the format: bump SCHEMA_VERSION and add MIGRATIONS[old].
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HDDynasty = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SCHEMA_VERSION = 2;
  var EXPORT_FORMAT = 'hoops-dynasty-save';

  var LEAGUE_RULES = Object.freeze({
    defaultStartYear: 2026,
    minStartYear: 1950,
    maxStartYear: 2100,
    nameMinLength: 2,
    nameMaxLength: 40
  });

  var PHASES = Object.freeze({
    'preseason':      'Preseason',
    'regular-season': 'Regular Season',
    'playoffs':       'Playoffs',
    'offseason':      'Offseason'
  });

  /* --- Small helpers ------------------------------------------------------ */

  // 2026 -> "2026–27" (en dash, like a printed season label)
  function seasonLabel(year) {
    year = Number(year);
    return year + '–' + String((year + 1) % 100).padStart(2, '0');
  }

  function phaseLabel(phase) {
    return PHASES[phase] || 'Unknown';
  }

  // Trim and collapse internal whitespace.
  function cleanName(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function parseYear(value) {
    var text = String(value == null ? '' : value).trim();
    return /^\d{4}$/.test(text) ? Number(text) : NaN;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function makeId() {
    var c = typeof crypto !== 'undefined' ? crypto : null;
    if (c && typeof c.randomUUID === 'function') return 'dyn-' + c.randomUUID();
    var rand = '';
    for (var i = 0; i < 4; i++) rand += Math.random().toString(36).slice(2, 8);
    return 'dyn-' + Date.now().toString(36) + '-' + rand;
  }

  /* --- League Setup validation --------------------------------------------- */

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

  /* --- Creation ------------------------------------------------------------ */

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

    // Teams are copied, not referenced, so later relocations / rebrands /
    // expansion never rewrite an existing dynasty's history.
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
      id: makeId(),
      createdAt: stamp,
      updatedAt: stamp,
      lastPlayedAt: stamp,
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
      record: { wins: 0, losses: 0 },
      userTeamId: userTeam.id,
      teams: teams
    };
  }

  /* --- Migration ------------------------------------------------------------ */

  // MIGRATIONS[n] upgrades a version-n save to version n+1. Never mutate
  // the input; never drop unknown keys.
  var MIGRATIONS = {
    // v1 (single-slot save from the first New Dynasty release):
    // header fields teamName/season/wins/losses were duplicated at the top
    // level for the old Continue button; last-played didn't exist.
    1: function (s) {
      s.lastPlayedAt = s.updatedAt || s.createdAt;
      s.record = {
        wins: Number.isFinite(s.wins) ? s.wins : 0,
        losses: Number.isFinite(s.losses) ? s.losses : 0
      };
      delete s.teamName;   // derivable from teams + userTeamId
      delete s.season;     // derivable from calendar
      delete s.wins;       // moved into record
      delete s.losses;
      s.schemaVersion = 2;
      return s;
    }
  };

  function UnsupportedVersionError(version) {
    this.name = 'UnsupportedVersionError';
    this.version = version;
    this.message = version > SCHEMA_VERSION
      ? 'This save was made with a newer version of Hoops Dynasty (format ' + version + '). Update the game to open it.'
      : 'This save format (' + version + ') isn’t supported.';
  }
  UnsupportedVersionError.prototype = Object.create(Error.prototype);

  // Returns an upgraded deep copy, or throws UnsupportedVersionError.
  function migrate(save) {
    var s = clone(save);
    var version = s && s.schemaVersion;
    if (!Number.isInteger(version) || version < 1 || version > SCHEMA_VERSION) {
      throw new UnsupportedVersionError(version);
    }
    while (s.schemaVersion < SCHEMA_VERSION) {
      var step = MIGRATIONS[s.schemaVersion];
      if (!step) throw new UnsupportedVersionError(s.schemaVersion);
      s = step(s);
    }
    return s;
  }

  /* --- Validation (current format) ----------------------------------------- */

  var HEX = /^#[0-9A-Fa-f]{6}$/;
  var LOGO_PATH = /^assets\/logos\/[A-Za-z0-9_-]+\.svg$/;   // local assets only
  var ID = /^[A-Za-z0-9_-]{4,100}$/;

  function isText(v, max) { return typeof v === 'string' && v.trim().length > 0 && v.length <= max; }
  function isDate(v) { return typeof v === 'string' && v.length <= 40 && !isNaN(Date.parse(v)); }
  function isInt(v, min, max) { return Number.isInteger(v) && v >= min && v <= max; }

  // -> { valid, errors[] }. Expects the CURRENT schema (run migrate first).
  function validateDynasty(d) {
    var errors = [];
    function req(ok, msg) { if (!ok) errors.push(msg); }

    if (!d || typeof d !== 'object' || Array.isArray(d)) return { valid: false, errors: ['Not a dynasty object.'] };
    req(d.schemaVersion === SCHEMA_VERSION, 'Unexpected save format version.');
    req(typeof d.id === 'string' && ID.test(d.id), 'Missing or invalid dynasty ID.');
    req(isDate(d.createdAt), 'Missing creation date.');
    req(isDate(d.updatedAt), 'Missing last-updated date.');
    req(isDate(d.lastPlayedAt), 'Missing last-played date.');

    var league = d.league || {};
    req(isText(league.name, 80), 'Missing league name.');
    req(isInt(league.foundedYear, 1000, 9999), 'Missing league founding year.');
    req(Array.isArray(league.conferences) && league.conferences.length > 0, 'Missing conferences.');
    req(Array.isArray(league.teamIds), 'Missing league team list.');

    var gm = d.gm || {};
    req(isText(gm.name, 80), 'Missing general manager name.');

    var cal = d.calendar || {};
    req(isInt(cal.startYear, 1000, 9999) && isInt(cal.seasonYear, 1000, 9999), 'Missing season year.');
    req(typeof cal.seasonLabel === 'string' && cal.seasonLabel.length <= 20, 'Missing season label.');
    req(Object.prototype.hasOwnProperty.call(PHASES, cal.phase), 'Unknown league phase.');

    var rec = d.record || {};
    req(isInt(rec.wins, 0, 1000) && isInt(rec.losses, 0, 1000), 'Missing season record.');

    var teams = Array.isArray(d.teams) ? d.teams : null;
    req(teams && teams.length >= 2 && teams.length <= 64, 'Missing or invalid team list.');
    if (teams) {
      var ids = {};
      var humans = 0;
      teams.forEach(function (t, i) {
        var where = 'Team ' + (i + 1);
        if (!t || typeof t !== 'object') { errors.push(where + ' is invalid.'); return; }
        req(typeof t.id === 'string' && ID.test(t.id) && !ids[t.id], where + ': missing or duplicate ID.');
        ids[t.id] = true;
        req(isText(t.fullName, 80) && isText(t.city, 60) && isText(t.name, 60), where + ': missing name.');
        req(typeof t.abbreviation === 'string' && /^[A-Z]{2,4}$/.test(t.abbreviation), where + ': invalid abbreviation.');
        req(typeof t.logo === 'string' && LOGO_PATH.test(t.logo), where + ': invalid logo reference.');
        req(t.colors && HEX.test(t.colors.primary) && HEX.test(t.colors.secondary) && HEX.test(t.colors.tertiary), where + ': invalid colors.');
        req(typeof t.conference === 'string' && t.conference.length <= 40, where + ': missing conference.');
        req(typeof t.overall === 'number' && t.overall >= 0 && t.overall <= 100, where + ': invalid overall rating.');
        req(t.control === 'human' || t.control === 'cpu', where + ': invalid control type.');
        if (t.control === 'human') humans++;
      });
      req(humans === 1, 'A dynasty must have exactly one human-controlled team.');
      req(typeof d.userTeamId === 'string' && ids[d.userTeamId], 'Selected franchise is missing from the league.');
      req(gm.teamId === d.userTeamId, 'General manager isn’t assigned to the selected franchise.');
      var human = teams.filter(function (t) { return t && t.control === 'human'; })[0];
      req(!human || human.id === d.userTeamId, 'Human-controlled team doesn’t match the selected franchise.');
    }

    // Collapse to unique messages, cap the list
    var unique = errors.filter(function (m, i) { return errors.indexOf(m) === i; }).slice(0, 8);
    return { valid: unique.length === 0, errors: unique };
  }

  /* --- Summaries ------------------------------------------------------------ */

  function userTeam(d) {
    for (var i = 0; i < d.teams.length; i++) if (d.teams[i].id === d.userTeamId) return d.teams[i];
    return null;
  }

  // Small, card-sized view of a dynasty (stored alongside the full save so
  // lists never have to load every full dynasty).
  function summarize(d) {
    var team = userTeam(d) || {};
    return {
      id: d.id,
      schemaVersion: d.schemaVersion,
      teamId: team.id,
      fullName: team.fullName,
      abbreviation: team.abbreviation,
      logo: team.logo,
      colors: team.colors,
      overall: team.overall,
      leagueName: d.league.name,
      gmName: d.gm.name,
      seasonYear: d.calendar.seasonYear,
      seasonLabel: d.calendar.seasonLabel,
      phase: d.calendar.phase,
      record: d.record,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      lastPlayedAt: d.lastPlayedAt
    };
  }

  /* --- Export / import file format ----------------------------------------- */

  function slug(text) {
    return String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // hoops-dynasty-atlanta-phoenix-2026-27.json
  function exportFilename(d) {
    var team = userTeam(d);
    return 'hoops-dynasty-' + slug(team ? team.fullName : 'dynasty') + '-' + slug(d.calendar.seasonLabel) + '.json';
  }

  // The complete dynasty, wrapped with a format marker. Every key of the
  // save (including ones added by future systems) is included as-is.
  function exportPayload(d, now) {
    return {
      format: EXPORT_FORMAT,
      formatVersion: d.schemaVersion,
      exportedAt: (now || new Date()).toISOString(),
      dynasty: clone(d)
    };
  }

  function ImportError(message, details) {
    this.name = 'ImportError';
    this.message = message;
    this.details = details || [];
  }
  ImportError.prototype = Object.create(Error.prototype);

  /**
   * Parse and verify an exported dynasty file. Never evaluates the content:
   * JSON.parse only, then structural validation.
   * @returns {object} the dynasty, migrated to the current format
   * @throws  {ImportError}
   */
  function parseExport(text) {
    if (typeof text !== 'string' || !text.trim()) throw new ImportError('The file is empty.');
    var data;
    try {
      data = JSON.parse(text.replace(/^﻿/, ''));
    } catch (err) {
      throw new ImportError('This file isn’t valid JSON. It may be damaged or not a Hoops Dynasty save.');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new ImportError('This file isn’t a Hoops Dynasty save.');
    }

    var dynasty;
    if (data.format === EXPORT_FORMAT) {
      dynasty = data.dynasty;
      if (!dynasty || typeof dynasty !== 'object') throw new ImportError('The save file is missing its dynasty data.');
      if (data.formatVersion !== dynasty.schemaVersion) throw new ImportError('The save file’s version information is inconsistent.');
    } else if (data.schemaVersion != null && Array.isArray(data.teams)) {
      dynasty = data;   // a raw save (e.g. copied from storage by hand)
    } else {
      throw new ImportError('This file isn’t a Hoops Dynasty save.');
    }

    var migrated;
    try {
      migrated = migrate(dynasty);
    } catch (err) {
      throw new ImportError(err instanceof UnsupportedVersionError ? err.message : 'This save couldn’t be upgraded to the current format.');
    }

    var check = validateDynasty(migrated);
    if (!check.valid) throw new ImportError('This save is incomplete or damaged and can’t be imported.', check.errors);
    return migrated;
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    EXPORT_FORMAT: EXPORT_FORMAT,
    LEAGUE_RULES: LEAGUE_RULES,
    PHASES: PHASES,
    seasonLabel: seasonLabel,
    phaseLabel: phaseLabel,
    cleanName: cleanName,
    parseYear: parseYear,
    makeId: makeId,
    validateSetup: validateSetup,
    teamOverall: teamOverall,
    createDynasty: createDynasty,
    migrate: migrate,
    validateDynasty: validateDynasty,
    userTeam: userTeam,
    summarize: summarize,
    exportFilename: exportFilename,
    exportPayload: exportPayload,
    parseExport: parseExport,
    ImportError: ImportError,
    UnsupportedVersionError: UnsupportedVersionError
  };
});
