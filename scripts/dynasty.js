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

   SAVE FORMAT (schemaVersion 7)
   {
     schemaVersion: 7,
     id,                         // permanent dynasty ID, never reused
     createdAt, updatedAt, lastPlayedAt,          // ISO timestamps
     league:   { name, foundedYear, conferences[{ id, name, teamIds[] }], teamIds[],
                 rules: { seasonGames, playoffFormat, seriesLength, difficulty,
                          rosterSize, salaryCap, luxuryTax } },   // chosen at creation
     gm:       { name, teamId },
     calendar: { startYear, seasonYear, seasonLabel, phase, currentDate },
     onboarding: { ownerIntroCompleted, completedAt },
     userTeamId,
     teams: [{ id, franchiseId, city, name, fullName, abbreviation, logo,
               secondaryLogo, colors{primary,secondary,tertiary}, marketSize,
               population, conference, division, arena{name,capacity},
               overall, ratingSource, control: 'human' | 'cpu' }],
     owners:    [owner]                           // scripts/ownership.js
     players:   [player]       // roster.js (ratings) + player-identity.js (who they are)
                               // + player-bio.js (weight, birthdate, experience)
                               // + player-career.js (draft, debut, relatives)
     rosterHistory: [{ seasonYear, seasonLabel, archivedAt, players[], lineups{} }]
                                                  // end-of-season snapshots (newest last)
     lineups:   { teamId: { PG, SG, SF, PF, C } } // player ids
     standings: { teamId: { wins, losses, streak{type,count}, conferenceRank } }
     stats:     { season: { seasonYear, teams{}, players{} } }  // totals
     finances:  { seasonYear, config{ salaryCap, luxuryTax, ... }, teams{} }
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

  var SCHEMA_VERSION = 14;

  // Sibling modules (globals in the browser, require() in Node).
  var isNode = typeof module === 'object' && module.exports;
  function dep(name, path) {
    return isNode ? require(path) : (typeof self !== 'undefined' ? self : this)[name];
  }
  function deps() {
    return {
      franchises: dep('HDFranchises', '../data/franchises.js'),
      owners: dep('HDOwners', '../data/owners.js'),
      roster: dep('HDRoster', './roster.js'),
      ownership: dep('HDOwnership', './ownership.js'),
      stats: dep('HDStats', './stats.js'),
      finance: dep('HDFinance', './finance.js'),
      portraits: dep('HDPortraits', './portraits.js'),
      playerBio: dep('HDPlayerBio', './player-bio.js'),
      playerIdentity: dep('HDPlayerIdentity', './player-identity.js'),
      nationalities: dep('HDNationalities', '../data/nationalities.js'),
      playerCareer: dep('HDPlayerCareer', './player-career.js'),
      season: dep('HDSeason', './season.js'),
      teams: dep('HDTeams', './teams.js'),
      playerAttributes: dep('HDPlayerAttributes', './player-attributes.js'),
      news: dep('HDNews', './news.js'),
      morale: dep('HDMorale', './morale.js'),
      mental: dep('HDPlayerMental', './player-mental.js'),
      careerStats: dep('HDCareerStats', './career-stats.js')
    };
  }
  var EXPORT_FORMAT = 'hoops-dynasty-save';

  // Setup limits. The player picks the INAUGURAL SEASON YEAR: the year the
  // first season ENDS (2026 -> the 2025–26 season, preseason October 2025).
  // Only technical year limits apply (see scripts/season.js); the default is
  // the current real-world year (HDSeason.currentYear()).
  var SEASON = isNode ? require('./season.js') : (typeof self !== 'undefined' ? self : this).HDSeason;
  var LEAGUE_RULES = Object.freeze({
    minInauguralYear: SEASON.MIN_INAUGURAL_YEAR,
    maxInauguralYear: SEASON.MAX_INAUGURAL_YEAR,
    nameMinLength: 2,
    nameMaxLength: 40
  });

  /* --- League rules (chosen in New Dynasty > League Rules) ---------------- */

  var RULE_OPTIONS = Object.freeze({
    seasonGames: [82, 72, 58, 41, 29],
    playoffFormat: {
      'play-in': { label: '20 teams with play-in', detail: 'Top 6 per conference advance; seeds 7–10 meet in a play-in tournament.', teamsPerConference: 10 },
      'sixteen': { label: '16 teams', detail: 'Top 8 per conference advance directly.', teamsPerConference: 8 },
      'eight':   { label: '8 teams', detail: 'Only the top 4 per conference make the playoffs.', teamsPerConference: 4 }
    },
    seriesLength: [7, 5, 3],
    difficulty: {
      'rookie':       { label: 'Rookie',       detail: 'Forgiving owners and generous CPU trade partners.' },
      'pro':          { label: 'Pro',          detail: 'A balanced, realistic front-office challenge.' },
      'all-star':     { label: 'All-Star',     detail: 'Shrewd CPU general managers and higher expectations.' },
      'hall-of-fame': { label: 'Hall of Fame', detail: 'Ruthless trade AI and owners with little patience.' }
    },
    rosterSize: { min: 13, max: 17 },
    // Who is generated (heights, names, colleges, portraits...). Set at
    // creation only: changing it would mean regenerating every player.
    playerGender: {
      'male':   { label: 'Men', detail: 'A men’s league.' },
      'female': { label: 'Women', detail: 'A women’s league: shorter at every position, far fewer dunks, women’s college powerhouses.' },
      'mixed':  { label: 'Mixed', detail: 'About half the players are women and half are men.' }
    },
    salaryCap: { min: 50000000, max: 500000000 },
    luxuryTax: { min: 50000000, max: 600000000 }
  });

  var DEFAULT_RULES = Object.freeze({
    seasonGames: 82,
    playoffFormat: 'play-in',
    seriesLength: 7,
    difficulty: 'pro',
    rosterSize: 15,
    playerGender: 'male',
    salaryCap: 141000000,
    luxuryTax: 171300000
  });

  // Accepts form values (strings OK; money may be given in $M via
  // salaryCapM / luxuryTaxM). -> { valid, errors{}, values }
  function validateRules(input) {
    input = input || {};
    var errors = {};
    var o = RULE_OPTIONS;
    function num(v) { return typeof v === 'number' ? v : Number(String(v == null ? '' : v).replace(/[$,\s]/g, '')); }
    function money(key) {
      if (input[key + 'M'] != null && String(input[key + 'M']).trim() !== '') return Math.round(num(input[key + 'M']) * 1e6);
      return input[key] != null ? Math.round(num(input[key])) : DEFAULT_RULES[key];
    }
    var v = {
      seasonGames: input.seasonGames != null ? num(input.seasonGames) : DEFAULT_RULES.seasonGames,
      playoffFormat: input.playoffFormat || DEFAULT_RULES.playoffFormat,
      seriesLength: input.seriesLength != null ? num(input.seriesLength) : DEFAULT_RULES.seriesLength,
      difficulty: input.difficulty || DEFAULT_RULES.difficulty,
      playerGender: input.playerGender || DEFAULT_RULES.playerGender,
      rosterSize: input.rosterSize != null ? num(input.rosterSize) : DEFAULT_RULES.rosterSize,
      salaryCap: money('salaryCap'),
      luxuryTax: money('luxuryTax')
    };
    if (o.seasonGames.indexOf(v.seasonGames) === -1) errors.seasonGames = 'Choose a season length.';
    if (!Object.prototype.hasOwnProperty.call(o.playoffFormat, v.playoffFormat)) errors.playoffFormat = 'Choose a playoff format.';
    if (o.seriesLength.indexOf(v.seriesLength) === -1) errors.seriesLength = 'Choose a series length.';
    if (!Object.prototype.hasOwnProperty.call(o.difficulty, v.difficulty)) errors.difficulty = 'Choose a difficulty.';
    if (!Object.prototype.hasOwnProperty.call(o.playerGender, v.playerGender)) errors.playerGender = 'Choose who plays in the league.';
    if (!Number.isInteger(v.rosterSize) || v.rosterSize < o.rosterSize.min || v.rosterSize > o.rosterSize.max) {
      errors.rosterSize = 'Roster size must be ' + o.rosterSize.min + '–' + o.rosterSize.max + ' players.';
    }
    if (!isFinite(v.salaryCap) || v.salaryCap < o.salaryCap.min || v.salaryCap > o.salaryCap.max) {
      errors.salaryCap = 'Salary cap must be between $' + o.salaryCap.min / 1e6 + 'M and $' + o.salaryCap.max / 1e6 + 'M.';
    }
    if (!isFinite(v.luxuryTax) || v.luxuryTax < o.luxuryTax.min || v.luxuryTax > o.luxuryTax.max) {
      errors.luxuryTax = 'Luxury tax line must be between $' + o.luxuryTax.min / 1e6 + 'M and $' + o.luxuryTax.max / 1e6 + 'M.';
    } else if (!errors.salaryCap && v.luxuryTax <= v.salaryCap) {
      errors.luxuryTax = 'The luxury tax line must be above the salary cap.';
    }
    return { valid: Object.keys(errors).length === 0, errors: errors, values: v };
  }

  function rulesSummary(rules) {
    var r = rules || DEFAULT_RULES;
    return {
      season: r.seasonGames + ' games',
      playoffs: (RULE_OPTIONS.playoffFormat[r.playoffFormat] || {}).label + ', best of ' + r.seriesLength,
      difficulty: (RULE_OPTIONS.difficulty[r.difficulty] || {}).label,
      roster: r.rosterSize + ' players',
      players: (RULE_OPTIONS.playerGender[r.playerGender || 'male'] || {}).label,
      salaryCap: '$' + (r.salaryCap / 1e6).toFixed(1) + 'M',
      luxuryTax: '$' + (r.luxuryTax / 1e6).toFixed(1) + 'M'
    };
  }

  /* --- Changing rules during a dynasty (in-game Settings) ----------------- *
   * Before the regular season (preseason) and between seasons (offseason)
   * every rule can change and takes effect immediately. Once the regular
   * season starts, only 'anytime' rules change now; the rest are saved as
   * league.pendingRules and take effect when the next season begins.
   *   league.pendingRules = { seasonYear: <start year it applies to>, values: { key: value } }
   */
  var RULE_KEYS = ['seasonGames', 'playoffFormat', 'seriesLength', 'difficulty', 'rosterSize', 'salaryCap', 'luxuryTax'];
  var RULE_TIMING = Object.freeze({
    seasonGames: 'next-season',     // the schedule is set when the regular season starts
    playoffFormat: 'next-season',   // seeding races depend on it
    seriesLength: 'next-season',
    difficulty: 'anytime',
    rosterSize: 'next-season',      // roster limits hold for the whole season
    salaryCap: 'next-season',       // a season's cap and tax line are fixed
    luxuryTax: 'next-season'
  });
  var RULE_LABELS = Object.freeze({
    seasonGames: 'Season length', playoffFormat: 'Playoff format', seriesLength: 'Playoff series',
    difficulty: 'Difficulty', rosterSize: 'Roster size', salaryCap: 'Salary cap', luxuryTax: 'Luxury tax line'
  });

  // True while the regular season or playoffs are under way
  function seasonInProgress(save) {
    var ph = save.calendar.phase;
    return ph === 'regular-season' || ph === 'playoffs';
  }

  function ruleLocked(save, key) {
    return seasonInProgress(save) && RULE_TIMING[key] !== 'anytime';
  }

  // Rules that will be in force next season (current + scheduled changes)
  function nextSeasonRules(save) {
    var r = clone(save.league.rules);
    var p = save.league.pendingRules;
    if (p && p.values) Object.keys(p.values).forEach(function (k) { r[k] = p.values[k]; });
    return r;
  }

  function ruleValueLabel(key, value) {
    var o = RULE_OPTIONS;
    switch (key) {
      case 'seasonGames': return value + ' games';
      case 'playoffFormat': return (o.playoffFormat[value] || {}).label || String(value);
      case 'seriesLength': return 'Best of ' + value;
      case 'difficulty': return (o.difficulty[value] || {}).label || String(value);
      case 'rosterSize': return value + ' players';
      default: return '$' + (value / 1e6).toFixed(1) + 'M';
    }
  }

  function conferenceSizes(save) {
    var sizes = {};
    save.teams.forEach(function (t) { sizes[t.conference] = (sizes[t.conference] || 0) + 1; });
    return sizes;
  }

  // Effects of a rule taking effect on the rest of the save
  function applyRuleEffects(save, key, oldValue, value) {
    var x = deps();
    if ((key === 'salaryCap' || key === 'luxuryTax') && save.finances && save.finances.config) {
      save.finances.config[key] = value;
    }
    if (key === 'seasonGames' && Array.isArray(save.owners) && x.ownership.rescaleWinTargets) {
      save.owners.forEach(function (o) { x.ownership.rescaleWinTargets(o, value); });
    }
    void oldValue;
  }

  /**
   * Change league rules during a dynasty. Mutates `save`.
   * @param input  form values (same shape validateRules accepts), describing
   *               the rules the player wants for the CURRENT season when
   *               unlocked, or for NEXT season when a rule is locked
   * @returns {{ ok, errors, applied: [{key, from, to}], scheduled: [{key, to}], cancelled: [{key}] }}
   */
  function changeRules(save, input) {
    applyPendingRules(save);
    var check = validateRules(input);
    var result = { ok: false, errors: check.errors, applied: [], scheduled: [], cancelled: [] };
    if (!check.valid) return result;
    var want = check.values;
    var fmt = RULE_OPTIONS.playoffFormat[want.playoffFormat];
    var sizes = conferenceSizes(save);
    var short = Object.keys(sizes).filter(function (c) { return sizes[c] < fmt.teamsPerConference; });
    if (short.length) {
      result.errors = { playoffFormat: 'This format needs ' + fmt.teamsPerConference + ' teams per conference; the ' + conferenceName(save, short[0]) + ' has ' + sizes[short[0]] + '.' };
      return result;
    }
    var rules = save.league.rules;
    var pending = save.league.pendingRules && save.league.pendingRules.values ? clone(save.league.pendingRules.values) : {};
    RULE_KEYS.forEach(function (key) {
      var to = want[key];
      if (!ruleLocked(save, key)) {
        if (to !== rules[key]) {
          var from = rules[key];
          rules[key] = to;
          applyRuleEffects(save, key, from, to);
          result.applied.push({ key: key, from: from, to: to });
        }
        delete pending[key];
        return;
      }
      var target = Object.prototype.hasOwnProperty.call(pending, key) ? pending[key] : rules[key];
      if (to === rules[key]) {
        if (Object.prototype.hasOwnProperty.call(pending, key)) { delete pending[key]; result.cancelled.push({ key: key }); }
      } else if (to !== target) {
        pending[key] = to;
        result.scheduled.push({ key: key, to: to });
      }
    });
    if (Object.keys(pending).length) save.league.pendingRules = { seasonYear: save.calendar.seasonYear + 1, values: pending };
    else delete save.league.pendingRules;
    publishRuleNews(save, result);
    result.ok = true;
    result.errors = {};
    return result;
  }

  /**
   * Record a completed game everywhere statistics live: the career store
   * (scripts/career-stats.js) and, for the current regular season, the
   * dashboard's season totals (scripts/stats.js). Idempotent per game id.
   */
  function recordGame(save, game) {
    var x = deps();
    var res = x.careerStats.recordGame(save, game);
    if (!res.recorded) return res;
    var year = Number.isInteger(game.seasonYear) ? game.seasonYear : save.calendar.seasonYear;
    var season = save.stats && save.stats.season;
    if ((game.competition || 'regular') === 'regular' && season && season.seasonYear === year) {
      var sides = [game.home, game.away];
      var tot = sides.map(function (sd) {
        var t = { fg: 0, fga: 0, tp: 0, tpa: 0, ft: 0, fta: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, pts: 0, mp: 0 };
        sd.players.forEach(function (l) {
          Object.keys(t).forEach(function (k) { if (k !== 'pts') t[k] += l[k] || 0; });
          t.pts += 2 * ((l.fg || 0) - (l.tp || 0)) + 3 * (l.tp || 0) + (l.ft || 0);
        });
        return t;
      });
      sides.forEach(function (sd, i) {
        var t = tot[i], o = tot[1 - i];
        if (season.teams[sd.teamId]) {
          x.stats.addTeamGame(season, sd.teamId, { min: t.mp, pts: t.pts, oppPts: o.pts, fgm: t.fg, fga: t.fga, tpm: t.tp, tpa: t.tpa,
            ftm: t.ft, fta: t.fta, reb: t.orb + t.drb, ast: t.ast, stl: t.stl, blk: t.blk, tov: t.tov,
            poss: x.careerStats.possessions(t, o), oppPoss: x.careerStats.possessions(o, t) });
        }
        sd.players.forEach(function (l) {
          if (!(l.mp > 0) || !season.players[l.playerId]) return;
          x.stats.addPlayerGame(season, l.playerId, { gs: l.started ? 1 : 0, min: l.mp,
            pts: 2 * ((l.fg || 0) - (l.tp || 0)) + 3 * (l.tp || 0) + (l.ft || 0), fgm: l.fg || 0, fga: l.fga || 0, tpm: l.tp || 0, tpa: l.tpa || 0,
            ftm: l.ft || 0, fta: l.fta || 0, reb: (l.orb || 0) + (l.drb || 0), ast: l.ast || 0, stl: l.stl || 0, blk: l.blk || 0, tov: l.tov || 0 });
        });
      });
    }
    return res;
  }

  // League-office news for rule changes (Difficulty is a player setting, not news)
  var RULE_NEWS = {
    seasonGames: function (v) { return 'a ' + v + '-game season'; },
    playoffFormat: function (v) { return { 'play-in': 'a 20-team playoff with a play-in tournament', 'sixteen': 'a 16-team playoff', 'eight': 'an 8-team playoff' }[v]; },
    seriesLength: function (v) { return 'best-of-' + v + ' playoff series'; },
    rosterSize: function (v) { return v + '-player rosters'; },
    salaryCap: function (v) { return 'a $' + (v / 1e6).toFixed(1) + 'M salary cap'; },
    luxuryTax: function (v) { return 'a $' + (v / 1e6).toFixed(1) + 'M luxury tax line'; }
  };
  function joinAnd(list) { return list.length < 2 ? list.join('') : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]; }
  function publishRuleNews(save, result) {
    [['now', result.applied, save.calendar.seasonYear], ['next', result.scheduled, save.calendar.seasonYear + 1]].forEach(function (g) {
      var changes = g[1].filter(function (c) { return RULE_NEWS[c.key]; }).map(function (c) { return RULE_NEWS[c.key](c.to); });
      if (!changes.length) return;
      deps().news.record(save, {
        type: 'rules-change',
        key: save.calendar.currentDate + ':' + g[0] + ':' + changes.join('|'),
        data: { effective: g[0], seasonYear: g[2], changes: [joinAnd(changes)] }
      });
    });
  }

  // Drop one scheduled change (e.g. "Cancel" next to it in Settings)
  function cancelPendingRule(save, key) {
    var p = save.league.pendingRules;
    if (!p || !p.values || !Object.prototype.hasOwnProperty.call(p.values, key)) return false;
    delete p.values[key];
    if (!Object.keys(p.values).length) delete save.league.pendingRules;
    return true;
  }

  /**
   * Applies scheduled rule changes once their season has begun. Call at the
   * start of every season (season rollover) and whenever a save is opened.
   * @returns {Array} [{ key, from, to }] applied (empty when nothing changed)
   */
  function applyPendingRules(save) {
    var p = save.league && save.league.pendingRules;
    if (!p) return [];
    var due = save.calendar.seasonYear >= p.seasonYear || !seasonInProgress(save);
    if (!due) return [];
    var applied = [];
    Object.keys(p.values || {}).forEach(function (key) {
      var from = save.league.rules[key];
      if (from === p.values[key]) return;
      save.league.rules[key] = p.values[key];
      applyRuleEffects(save, key, from, p.values[key]);
      applied.push({ key: key, from: from, to: p.values[key] });
    });
    delete save.league.pendingRules;
    return applied;
  }

  var PHASES = Object.freeze({
    'preseason':      'Preseason',
    'regular-season': 'Regular Season',
    'playoffs':       'Playoffs',
    'offseason':      'Offseason'
  });

  /* --- Small helpers ------------------------------------------------------ */

  // Season START year -> printed label: 2025 -> "2025–26" (scripts/season.js)
  function seasonLabel(startYear) {
    return deps().season.label(startYear);
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
    // Whole positive numbers only: no sign, decimals, spaces or exponents
    return /^\d+$/.test(text) ? Number(text) : NaN;
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
    if (!text) return 'Inaugural season year is required.';
    var year = parseYear(text);
    if (isNaN(year) || !Number.isSafeInteger(year)) return 'Enter a whole-number year, like 2026.';
    if (year < LEAGUE_RULES.minInauguralYear) {
      return 'The earliest supported year is ' + LEAGUE_RULES.minInauguralYear + ', so every player is born in 1 AD or later.';
    }
    if (year > LEAGUE_RULES.maxInauguralYear) {
      return 'The latest supported year is ' + LEAGUE_RULES.maxInauguralYear.toLocaleString('en-US') + ' (the limit of the browser’s calendar).';
    }
    return null;
  }

  // input.inauguralYear = the year the first season ENDS.
  // -> { valid, errors: { leagueName?, gmName?, inauguralYear? }, values }
  function validateSetup(input) {
    input = input || {};
    var errors = {};
    var e;
    if ((e = validateName(input.leagueName, 'League name'))) errors.leagueName = e;
    if ((e = validateName(input.gmName, 'General manager name'))) errors.gmName = e;
    if ((e = validateYear(input.inauguralYear))) errors.inauguralYear = e;
    return {
      valid: Object.keys(errors).length === 0,
      errors: errors,
      values: {
        leagueName: cleanName(input.leagueName),
        gmName: cleanName(input.gmName),
        inauguralYear: parseYear(input.inauguralYear)
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
   * @param {object} setup       { leagueName, gmName, inauguralYear, franchiseId, rules, teams? }
   *                              inauguralYear = year the first season ENDS
   *                              teams = the league as customized in setup
   *                              (HDTeams editable teams); default league if omitted
   * @param {object} franchises  the HDFranchises module
   * @param {Date}   [now]
   */
  function createDynasty(setup, franchises, now) {
    now = now || new Date();
    var check = validateSetup(setup);
    if (!check.valid) throw new Error('Invalid league setup: ' + JSON.stringify(check.errors));

    var problems = franchises.validate();
    if (problems.length) throw new Error('Franchise data is invalid: ' + problems.join('; '));

    var v = check.values;
    var stamp = now.toISOString();
    // 2026 -> 2025–26: the dynasty starts in the preseason of October 2025.
    var inaugural = deps().season.fromInauguralYear(v.inauguralYear);
    var ruleCheck = validateRules(setup.rules || DEFAULT_RULES);
    if (!ruleCheck.valid) throw new Error('Invalid league rules: ' + JSON.stringify(ruleCheck.errors));

    // The league as customized during setup (edited / deleted / relocated
    // teams), or the default franchises.
    var T = deps().teams;
    var source = Array.isArray(setup.teams) ? setup.teams.map(T.normalize) : T.defaultLeague();
    var leagueCheck = T.validateLeague(source, { minPerConference: playoffTeamsPerConference(ruleCheck.values) });
    if (!leagueCheck.valid) throw new Error('Invalid league teams: ' + leagueCheck.errors.join('; '));

    var userTeam = source.filter(function (t) { return t.id === setup.franchiseId; })[0];
    if (!userTeam) throw new Error('Unknown franchise: ' + setup.franchiseId);

    // Teams are copied, not referenced, so later relocations / rebrands /
    // expansion never rewrite an existing dynasty's history.
    var teams = source.map(function (f) {
      return {
        id: f.id,                 // team id == franchise id for the founding league
        franchiseId: f.franchiseId,
        city: f.city,
        name: f.name,
        fullName: T.fullName(f),
        abbreviation: f.abbreviation,
        logo: f.logo,
        secondaryLogo: f.secondaryLogo || null,
        colors: { primary: f.colors.primary, secondary: f.colors.secondary, tertiary: f.colors.tertiary },
        marketSize: f.marketSize,
        population: f.population,
        conference: f.conference,
        division: f.division,
        arena: { name: f.arenaName, capacity: f.arenaCapacity },
        overall: teamOverall(f),
        ratingSource: 'provisional',
        control: f.id === userTeam.id ? 'human' : 'cpu'
      };
    });

    var save = {
      schemaVersion: SCHEMA_VERSION,
      id: makeId(),
      createdAt: stamp,
      updatedAt: stamp,
      lastPlayedAt: stamp,
      league: {
        name: v.leagueName,
        foundedYear: inaugural.startYear,
        conferences: franchises.CONFERENCES.map(function (c) {
          return {
            id: c.id,
            name: c.name,
            teamIds: teams.filter(function (t) { return t.conference === c.id; }).map(function (t) { return t.id; })
          };
        }),
        divisions: divisionsFor(teams),
        teamIds: teams.map(function (t) { return t.id; }),
        rules: ruleCheck.values
      },
      gm: { name: v.gmName, teamId: userTeam.id },
      calendar: {
        startYear: inaugural.startYear,          // first season's start year
        seasonYear: inaugural.startYear,         // current season's start year
        seasonLabel: inaugural.label,
        phase: 'preseason',
        currentDate: defaultDate(inaugural.startYear, 'preseason')
      },
      userTeamId: userTeam.id,
      teams: teams
    };
    attachSystems(save, null);
    // League news: the founding events (scripts/news.js)
    deps().news.addFoundingNews(save);
    // Personalities, then mental attributes and personality stats, then
    // captains (chosen with the leadership stat) — scripts/morale.js,
    // scripts/player-mental.js
    deps().morale.addPersonalities(save.players, save.id);
    deps().mental.addMissing(save.players, save.id);
    deps().morale.ensure(save);
    // Career statistics: empty until games are played (scripts/career-stats.js)
    deps().careerStats.ensure(save);
    return save;
  }

  // Playoff teams each conference needs for the chosen format
  function playoffTeamsPerConference(rules) {
    var f = RULE_OPTIONS.playoffFormat[(rules || DEFAULT_RULES).playoffFormat];
    return f ? f.teamsPerConference : 0;
  }

  function divisionsFor(teams) {
    return deps().franchises.DIVISIONS.map(function (d) {
      return {
        id: d.id, name: d.name, conference: d.conference,
        teamIds: teams.filter(function (t) { return t.division === d.id; }).map(function (t) { return t.id; })
      };
    });
  }

  // First in-game date for a phase (ISO yyyy-mm-dd), season START year.
  function defaultDate(seasonYear, phase) {
    return deps().season.phaseStartDate(seasonYear, phase);
  }

  // Calendar for the next season (2025–26 -> 2026–27). For the future
  // season rollover; archive rosters with archiveRosters() first.
  function nextSeasonCalendar(calendar) {
    return deps().season.nextCalendar(calendar);
  }

  // Full conference name, e.g. "Western Conference".
  function conferenceName(save, confId) {
    var conf = (save.league.conferences || []).filter(function (c) { return c.id === confId; })[0];
    return conf ? conf.name : String(confId);
  }

  /**
   * Adds the v3 systems (owners, rosters, lineups, standings, stats,
   * finances, onboarding) to a save that doesn't have them yet. Used by
   * createDynasty and by the v2 -> v3 migration. `userRecord` carries an
   * existing record forward so no progress is lost.
   */
  function attachSystems(save, userRecord) {
    var x = deps();
    var rules = save.league.rules || DEFAULT_RULES;

    // Rosters first: team strength is then derived from the roster.
    if (!Array.isArray(save.players)) {
      var league = x.roster.generateLeague(save.teams, save.id, { rosterSize: rules.rosterSize, gender: rules.playerGender || 'male' });
      save.players = league.players;
      save.lineups = league.lineups;
      save.teams.forEach(function (t) {
        t.overall = league.ratings[t.id];
        t.ratingSource = 'roster';
      });
    }

    // Identity (nationality, birthplace, college, pathway; names only for
    // nameless players), then weight / birthdate / experience. Fills
    // missing fields only; never overwrites.
    x.playerIdentity.addMissing(save.players, save.id);
    x.playerBio.addBios(save.players, save.id, save.calendar.seasonYear);
    // Attribute ratings (needs position, overall, height, weight, age)
    x.playerAttributes.addAttributes(save.players, save.id);
    // Draft, debut and relatives (needs bios: uses experience).
    x.playerCareer.addCareers(save);
    if (!Array.isArray(save.rosterHistory)) save.rosterHistory = [];

    if (!Array.isArray(save.owners)) {
      save.owners = save.teams.map(function (t) {
        var base = x.owners.byFranchise(t.franchiseId) || {
          // A team with no catalog owner (e.g. future expansion): neutral defaults.
          id: 'own-' + t.id, franchiseId: t.franchiseId, name: t.city + ' Ownership Group', title: 'Ownership Group',
          personality: 'balanced', traits: { ambition: 60, patience: 60, spending: 55 },
          portrait: x.portraits.generate('owner:' + t.id, { older: true })
        };
        var market = x.franchises.marketSize(t.marketSize);
        return x.ownership.buildOwner(base, t, {
          gmName: save.gm.name,
          conferenceName: conferenceName(save, t.conference),
          marketLabel: market ? market.label : 'local',
          seed: save.id,
          seasonGames: rules.seasonGames,
          isUserTeam: t.id === save.userTeamId
        });
      });
    }

    if (!save.standings) {
      save.standings = {};
      save.teams.forEach(function (t) {
        var rec = t.id === save.userTeamId && userRecord ? userRecord : { wins: 0, losses: 0 };
        save.standings[t.id] = {
          wins: rec.wins, losses: rec.losses,
          streak: { type: null, count: 0 },
          conferenceRank: null      // set once games are played
        };
      });
    }

    if (!save.stats) save.stats = { season: x.stats.initSeason(save.calendar.seasonYear, save.teams, save.players) };
    if (!save.finances) save.finances = x.finance.initFinances(save.calendar.seasonYear, { salaryCap: rules.salaryCap, luxuryTax: rules.luxuryTax });
    if (!save.calendar.currentDate) save.calendar.currentDate = defaultDate(save.calendar.seasonYear, save.calendar.phase);
    if (!save.onboarding) save.onboarding = { ownerIntroCompleted: false, completedAt: null };
    return save;
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
    },
    // v2 (multi-save release): no owners, rosters, standings, stats,
    // finances, in-game date or onboarding. Existing record is kept as the
    // user team's standings; everything else is initialized once and saved.
    2: function (s) {
      var record = s.record && Number.isInteger(s.record.wins) ? { wins: s.record.wins, losses: s.record.losses } : null;
      delete s.record;
      attachSystems(s, record);
      s.schemaVersion = 3;
      return s;
    },
    // v3 (GM dashboard release): no league rules. Existing dynasties get
    // the defaults, keeping whatever cap / tax their finances already use.
    3: function (s) {
      var cfg = s.finances && s.finances.config ? s.finances.config : {};
      s.league.rules = {
        seasonGames: DEFAULT_RULES.seasonGames,
        playoffFormat: DEFAULT_RULES.playoffFormat,
        seriesLength: DEFAULT_RULES.seriesLength,
        difficulty: DEFAULT_RULES.difficulty,
        rosterSize: DEFAULT_RULES.rosterSize,
        salaryCap: typeof cfg.salaryCap === 'number' ? cfg.salaryCap : DEFAULT_RULES.salaryCap,
        luxuryTax: typeof cfg.luxuryTax === 'number' ? cfg.luxuryTax : DEFAULT_RULES.luxuryTax
      };
      s.schemaVersion = 4;
      return s;
    },
    // v4: players had no bio data and there was no roster history. Adds
    // both; existing player ratings, ages, teams and lineups are untouched.
    4: function (s) {
      deps().playerIdentity.addMissing(s.players || [], s.id);
      deps().playerBio.addBios(s.players || [], s.id, s.calendar.seasonYear);
      if (!Array.isArray(s.rosterHistory)) s.rosterHistory = [];
      s.schemaVersion = 5;
      return s;
    },
    // v5: players had no draft, debut or relatives. Added once; nothing
    // else about any player changes (names are never altered).
    5: function (s) {
      deps().playerCareer.addCareers(s);
      s.schemaVersion = 6;
      return s;
    },
    // v6: identity data model (birthplace, secondary nationality, naming
    // background, development pathway). Existing names, nationalities,
    // colleges and ratings are kept exactly; only missing fields are added.
    6: function (s) {
      deps().playerIdentity.addMissing(s.players || [], s.id);
      s.schemaVersion = 7;
      return s;
    },
    // v7: teams had no division, population, arena or secondary logo.
    // Founding teams take them from the franchise catalog; market size,
    // names, colors and everything else stay exactly as saved.
    7: function (s) {
      var F = deps().franchises;
      (s.teams || []).forEach(function (t) {
        var f = F.byId(t.franchiseId);
        if (t.division === undefined) {
          t.division = f ? f.division : (F.DIVISIONS.filter(function (d) { return d.conference === t.conference; })[0] || F.DIVISIONS[0]).id;
        }
        if (t.population === undefined) {
          var band = F.marketSize(t.marketSize);
          t.population = f ? f.population : ({ large: 5000000, medium: 2500000, small: 1200000 }[band ? band.id : 'small']);
        }
        if (t.arena === undefined) t.arena = f ? { name: f.arena.name, capacity: f.arena.capacity } : { name: t.city + ' Arena', capacity: 18000 };
        if (t.secondaryLogo === undefined) t.secondaryLogo = null;
      });
      if (s.league && !Array.isArray(s.league.divisions)) s.league.divisions = divisionsFor(s.teams || []);
      s.schemaVersion = 8;
      return s;
    },
    // v8: players had no attribute ratings. Added once to current and
    // archived players; overall, potential and everything else unchanged.
    8: function (s) {
      var A = deps().playerAttributes;
      A.addAttributes(s.players || [], s.id);
      (s.rosterHistory || []).forEach(function (h) { A.addAttributes(h.players || [], s.id); });
      s.schemaVersion = 9;
      return s;
    },
    // v9: no league news. The founding events (league, GM hire, owner's
    // goals, expansion / relocation) are published from the save's own data.
    9: function (s) {
      deps().news.addFoundingNews(s);
      s.schemaVersion = 10;
      return s;
    },
    // v10: no morale data. Players get a personality and each team a
    // captain; ratings, roles and everything else are unchanged.
    10: function (s) {
      deps().morale.ensure(s);
      s.schemaVersion = 11;
      return s;
    },
    // v11: no player gender. Every existing league was a men's league.
    11: function (s) {
      if (s.league && s.league.rules && !s.league.rules.playerGender) s.league.rules.playerGender = 'male';
      (s.players || []).forEach(function (p) { if (!p.gender) p.gender = 'M'; });
      (s.rosterHistory || []).forEach(function (h) { (h.players || []).forEach(function (p) { if (!p.gender) p.gender = 'M'; }); });
      s.schemaVersion = 12;
      return s;
    },
    // v12: no mental attributes or personality stats. Added to current
    // players (from their existing personality); ratings and captains kept.
    12: function (s) {
      deps().morale.addPersonalities(s.players || [], s.id);
      deps().mental.addMissing(s.players || [], s.id);
      s.schemaVersion = 13;
      return s;
    },
    // v13: no career statistics store. Added empty: no games had been
    // simulated, and pre-dynasty history is never invented.
    13: function (s) {
      deps().careerStats.ensure(s);
      s.schemaVersion = 14;
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
  var ID = /^[A-Za-z0-9_-]{4,100}$/;

  function isText(v, max) { return typeof v === 'string' && v.trim().length > 0 && v.length <= max; }
  // Game years: positive, and within what the calendar can represent
  var MAX_YEAR = 275760;
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
    req(isInt(league.foundedYear, 1, MAX_YEAR), 'Missing league founding year.');
    req(Array.isArray(league.conferences) && league.conferences.length > 0, 'Missing conferences.');
    req(Array.isArray(league.teamIds), 'Missing league team list.');
    req(league.rules && validateRules(league.rules).valid, 'Missing or invalid league rules.');
    req(deps().news.isValid(d), 'Invalid league news.');
    req(deps().careerStats.isValid(d), 'Invalid career statistics.');
    req(!Array.isArray(d.players) || deps().morale.isValid(d), 'Invalid morale data.');
    if (league.pendingRules !== undefined) {
      var pr = league.pendingRules;
      req(pr && isInt(pr.seasonYear, 1, MAX_YEAR) && pr.values && typeof pr.values === 'object' &&
        Object.keys(pr.values).every(function (k) { return RULE_KEYS.indexOf(k) !== -1; }) &&
        league.rules && validateRules(Object.assign(clone(league.rules), pr.values)).valid, 'Invalid scheduled rule changes.');
    }

    var gm = d.gm || {};
    req(isText(gm.name, 80), 'Missing general manager name.');

    var cal = d.calendar || {};
    req(isInt(cal.startYear, 1, MAX_YEAR) && isInt(cal.seasonYear, 1, MAX_YEAR), 'Missing season year.');
    req(typeof cal.seasonLabel === 'string' && cal.seasonLabel.length <= 20, 'Missing season label.');
    req(Object.prototype.hasOwnProperty.call(PHASES, cal.phase), 'Unknown league phase.');

    req(SEASON.isValidDate(cal.currentDate), 'Missing in-game date.');
    req(d.onboarding && typeof d.onboarding.ownerIntroCompleted === 'boolean', 'Missing onboarding status.');

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
        req(deps().teams.isLogoRef(t.logo), where + ': invalid logo reference.');
        req(t.secondaryLogo === null || deps().teams.isLogoRef(t.secondaryLogo), where + ': invalid secondary logo.');
        req(typeof t.division === 'string' && t.division.length <= 40, where + ': missing division.');
        req(isInt(t.population, 1, 100000000), where + ': invalid population.');
        req(t.arena && isText(t.arena.name, 60) && isInt(t.arena.capacity, 1, 200000), where + ': invalid arena.');
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

    if (teams && errors.length === 0) validateSystems(d, teams, req);

    // Collapse to unique messages, cap the list
    var unique = errors.filter(function (m, i) { return errors.indexOf(m) === i; }).slice(0, 8);
    return { valid: unique.length === 0, errors: unique };
  }

  var POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
  var PERSONALITY_IDS = ['championship-driven', 'patient-builder', 'business-oriented', 'balanced', 'demanding'];

  function validObjectives(list) {
    return Array.isArray(list) && list.length <= 12 && list.every(function (x) {
      return x && typeof x.id === 'string' && x.id.length <= 60 && isText(x.text, 240);
    });
  }

  function validPortrait(p) {
    return !!p && ['skin', 'hair', 'hairColor', 'attire'].every(function (k) { return isInt(p[k], 0, 31); });
  }

  var PATHWAY_TYPES = ['ncaa', 'domestic-club', 'foreign-club', 'academy', 'pro-development', 'prep'];
  function validIdentity(p) {
    var Nat = deps().nationalities;
    var pw = p.pathway;
    return Nat.isValidCode(p.nationality) &&
      (p.secondaryNationality === null || (Nat.isValidCode(p.secondaryNationality) && p.secondaryNationality !== p.nationality)) &&
      Nat.isValidCode(p.birthCountry) && isText(p.birthCity, 80) && (p.birthRegion == null || isText(p.birthRegion, 60)) &&
      (p.nameOrder === 'given-first' || p.nameOrder === 'surname-first') &&
      (p.nameOrigin === null || (typeof p.nameOrigin === 'string' && p.nameOrigin.length <= 40)) &&
      (p.suffix == null || isText(p.suffix, 8)) &&
      !!pw && PATHWAY_TYPES.indexOf(pw.type) !== -1 && isInt(pw.entryAge, 15, 40) &&
      ((pw.type === 'ncaa') === (typeof p.college === 'string')) &&
      (pw.country == null || Nat.isValidCode(pw.country));
  }

  // Owners, players, lineups, standings, stats, finances.
  function validateSystems(d, teams, req) {
    var teamIds = {};
    teams.forEach(function (t) { teamIds[t.id] = true; });

    var owners = Array.isArray(d.owners) ? d.owners : null;
    req(owners && owners.length === teams.length, 'Missing ownership data.');
    if (owners) {
      var ownerTeams = {};
      owners.forEach(function (o) {
        var ok = o && typeof o.id === 'string' && ID.test(o.id) && teamIds[o.teamId] && !ownerTeams[o.teamId] &&
          isText(o.name, 80) && isText(o.title, 60) && PERSONALITY_IDS.indexOf(o.personality) !== -1 &&
          o.traits && isInt(o.traits.ambition, 0, 100) && isInt(o.traits.patience, 0, 100) && isInt(o.traits.spending, 0, 100) &&
          isInt(o.confidence, 0, 100) && validPortrait(o.portrait) && o.expectations &&
          validObjectives(o.expectations.season) && validObjectives(o.expectations.financial) && validObjectives(o.expectations.longTerm) &&
          (o.welcomeMessage === null || isText(o.welcomeMessage, 2000));
        req(ok, 'Invalid ownership record.');
        if (o) ownerTeams[o.teamId] = true;
      });
    }

    var players = Array.isArray(d.players) ? d.players : null;
    req(players && players.length >= teams.length * 5 && players.length <= 5000, 'Missing or invalid rosters.');
    var byTeam = {};
    if (players) {
      var seen = {};
      players.forEach(function (p) {
        var ok = p && typeof p.id === 'string' && ID.test(p.id) && !seen[p.id] && teamIds[p.teamId] &&
          isText(p.firstName, 40) && isText(p.lastName, 40) && POSITIONS.indexOf(p.position) !== -1 &&
          isInt(p.age, 15, 50) && isInt(p.overall, 0, 100) && isInt(p.jerseyNumber, 0, 99) && validPortrait(p.portrait);
        req(ok, 'Invalid player record.');
        req(p && isInt(p.weightLb, 120, 400) && SEASON.isValidDate(p.birthDate) &&
          isInt(p.experience, 0, 30) && (p.college === null || isText(p.college, 80)), 'Invalid player biography.');
        req(p && validIdentity(p), 'Invalid player identity.');
        req(p && deps().playerAttributes.isValid(p.attributes), 'Invalid player attributes.');
        req(p && (p.gender === undefined || p.gender === 'M' || p.gender === 'F'), 'Invalid player gender.');
        req(p && (p.mental === undefined || deps().mental.isValidMental(p.mental)) && (p.traits === undefined || deps().mental.isValidTraits(p.traits)), 'Invalid mental attributes or personality stats.');
        req(p && (p.archetype === undefined || (typeof p.archetype === 'string' && p.archetype.length <= 40)) &&
          (p.archetypeSecondary == null || (typeof p.archetypeSecondary === 'string' && p.archetypeSecondary.length <= 40)), 'Invalid player archetype.');
        var dr = p && p.draft;
        req(dr && isInt(dr.year, 1, MAX_YEAR) && (dr.undrafted === true ||
          (isInt(dr.round, 1, 10) && isInt(dr.pick, 1, 60) && isInt(dr.overall, 1, 600) && isText(dr.teamName, 80))), 'Invalid draft record.');
        req(p && (p.debut === null || (p.debut && SEASON.isValidDate(p.debut.date) && isText(p.debut.teamName, 80) && isText(p.debut.opponentName, 80))), 'Invalid debut record.');
        req(p && Array.isArray(p.relatives) && p.relatives.length <= 10 && p.relatives.every(function (r) {
          return r && isText(r.relation, 30) && isText(r.name, 80) && (r.playerId == null || typeof r.playerId === 'string');
        }), 'Invalid relatives.');
        if (!p) return;
        seen[p.id] = true;
        (byTeam[p.teamId] = byTeam[p.teamId] || []).push(p);
      });
    }

    var lineups = d.lineups && typeof d.lineups === 'object' ? d.lineups : null;
    req(lineups, 'Missing starting lineups.');
    if (lineups && players) {
      teams.forEach(function (t) {
        var lu = lineups[t.id];
        var roster = byTeam[t.id] || [];
        var ids = lu ? POSITIONS.map(function (pos) { return lu[pos]; }) : [];
        var onTeam = {};
        roster.forEach(function (p) { onTeam[p.id] = true; });
        req(lu && ids.every(function (id) { return onTeam[id]; }) && new Set(ids).size === 5, 'Invalid starting lineup for ' + t.fullName + '.');
      });
    }

    var standings = d.standings && typeof d.standings === 'object' ? d.standings : null;
    req(standings && teams.every(function (t) {
      var s = standings[t.id];
      return s && isInt(s.wins, 0, 200) && isInt(s.losses, 0, 200);
    }), 'Missing or invalid standings.');

    req(Array.isArray(d.rosterHistory) && d.rosterHistory.every(function (h) {
      return h && isInt(h.seasonYear, 1, MAX_YEAR) && Array.isArray(h.players) && h.lineups && typeof h.lineups === 'object';
    }), 'Invalid roster history.');
    req(d.stats && d.stats.season && typeof d.stats.season.teams === 'object' && typeof d.stats.season.players === 'object', 'Missing statistics.');
    req(d.finances && d.finances.config && typeof d.finances.config.salaryCap === 'number' && d.finances.config.salaryCap > 0 &&
      typeof d.finances.config.luxuryTax === 'number' && d.finances.config.luxuryTax > 0, 'Missing financial configuration.');
  }

  /* --- Summaries ------------------------------------------------------------ */

  function userOwner(d) {
    var list = d.owners || [];
    for (var i = 0; i < list.length; i++) if (list[i].teamId === d.userTeamId) return list[i];
    return null;
  }

  function teamRoster(d, teamId) {
    return (d.players || []).filter(function (p) { return p.teamId === teamId; });
  }

  /* --- Roster seasons ------------------------------------------------------ */

  // Seasons with roster data, newest first: the current season plus any
  // archived end-of-season snapshots.
  function rosterSeasons(d) {
    var list = [{ seasonYear: d.calendar.seasonYear, seasonLabel: d.calendar.seasonLabel, current: true }];
    (d.rosterHistory || []).forEach(function (h) {
      if (h.seasonYear !== d.calendar.seasonYear) list.push({ seasonYear: h.seasonYear, seasonLabel: h.seasonLabel || seasonLabel(h.seasonYear), current: false });
    });
    return list.sort(function (a, b) { return b.seasonYear - a.seasonYear; });
  }

  // -> { players[], lineup, current } for a team in a given season
  function rosterFor(d, teamId, seasonYear) {
    if (seasonYear == null || seasonYear === d.calendar.seasonYear) {
      return { players: teamRoster(d, teamId), lineup: (d.lineups || {})[teamId] || {}, current: true };
    }
    var snap = (d.rosterHistory || []).filter(function (h) { return h.seasonYear === seasonYear; })[0];
    if (!snap) return { players: [], lineup: {}, current: false };
    return {
      players: snap.players.filter(function (p) { return p.teamId === teamId; }),
      lineup: snap.lineups[teamId] || {},
      current: false
    };
  }

  // Snapshot every roster as it stands (call at season rollover, before
  // ages / contracts / transactions move on). Replaces an existing snapshot
  // for the same season.
  function archiveRosters(d, now) {
    var snap = {
      seasonYear: d.calendar.seasonYear,
      seasonLabel: d.calendar.seasonLabel,
      archivedAt: (now || new Date()).toISOString(),
      players: clone(d.players),
      lineups: clone(d.lineups)
    };
    d.rosterHistory = (d.rosterHistory || []).filter(function (h) { return h.seasonYear !== snap.seasonYear; }).concat([snap]);
    return d;
  }

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
      record: d.standings && d.standings[d.userTeamId]
        ? { wins: d.standings[d.userTeamId].wins, losses: d.standings[d.userTeamId].losses }
        : { wins: 0, losses: 0 },
      ownerIntroCompleted: !!(d.onboarding && d.onboarding.ownerIntroCompleted),
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
    validateYear: validateYear,
    makeId: makeId,
    // News moves with a save stored under a new id (scripts/news.js)
    rebindNews: function (save) { return deps().news.rebind(save); },
    recordGame: recordGame,
    validateSetup: validateSetup,
    RULE_OPTIONS: RULE_OPTIONS,
    RULE_KEYS: RULE_KEYS,
    RULE_TIMING: RULE_TIMING,
    RULE_LABELS: RULE_LABELS,
    seasonInProgress: seasonInProgress,
    ruleLocked: ruleLocked,
    nextSeasonRules: nextSeasonRules,
    ruleValueLabel: ruleValueLabel,
    changeRules: changeRules,
    cancelPendingRule: cancelPendingRule,
    applyPendingRules: applyPendingRules,
    DEFAULT_RULES: DEFAULT_RULES,
    validateRules: validateRules,
    rulesSummary: rulesSummary,
    teamOverall: teamOverall,
    createDynasty: createDynasty,
    migrate: migrate,
    validateDynasty: validateDynasty,
    userTeam: userTeam,
    userOwner: userOwner,
    teamRoster: teamRoster,
    rosterSeasons: rosterSeasons,
    rosterFor: rosterFor,
    archiveRosters: archiveRosters,
    defaultDate: defaultDate,
    nextSeasonCalendar: nextSeasonCalendar,
    summarize: summarize,
    exportFilename: exportFilename,
    exportPayload: exportPayload,
    parseExport: parseExport,
    ImportError: ImportError,
    UnsupportedVersionError: UnsupportedVersionError
  };
});
