/* ==========================================================================
   HOOPS DYNASTY — coaches
   One head coach per team, plus a pool of available coaches (retired
   players who chose coaching). Stored in the dynasty save:

     save.coaches = {
       version: 1,
       items:  { [coachId]: Coach },
       byTeam: { [teamId]: coachId }          current head coach
     }
     Coach = {
       id, firstName, lastName, suffix, nameOrder, nameOrigin, gender,
       birthDate, nationality, birthCity, birthRegion, birthCountry,
       college, relatives: [ { relation, name, playerId? } ], portrait,
       teamId | null, status: 'employed' | 'available',
       attributes: { ...ATTRIBUTES keys (1–100) }, specialty,
       career:      [ { teamId, teamName, role, from, to } ]   coaching stints (dates null = before the league)
       asPlayer:    null | { playerId, seasons, retiredDate, lastTeamName, draft }   empty by default
       asExecutive: []                                         empty until there's history
       source: 'generated' | 'former-player'
     }

   Effects (single place): gameModifiers() for the game engine,
   progressionMultiplier() for development, scoutingError() for scouting,
   moraleFactor() / rotationSize() / rotationOrder() used by morale today,
   lobbying() for front-office requests.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var node = typeof module === 'object' && module.exports;
  var api = factory(
    node ? require('./random.js') : root.HDRandom,
    node ? require('./season.js') : root.HDSeason,
    function () { return node ? require('./player-identity.js') : root.HDPlayerIdentity; },
    function () { return node ? require('./portraits.js') : root.HDPortraits; }
  );
  if (node) module.exports = api;
  else root.HDCoaches = api;
})(typeof self !== 'undefined' ? self : this, function (R, Season, Identity, Portraits) {
  'use strict';

  var VERSION = 1;

  /* kind: 'skill' = higher is better (rating colors); 'style' = a preference
     (neither good nor bad; described, not colored). */
  var ATTRIBUTES = Object.freeze([
    { key: 'offense', group: 'tactics', kind: 'skill', label: 'Offensive Scheme / IQ', desc: 'Team offensive efficiency, assist rate, fewer turnovers.' },
    { key: 'defense', group: 'tactics', kind: 'skill', label: 'Defensive Scheme / IQ', desc: 'Team defensive rating, contests, forced turnovers.' },
    { key: 'pace', group: 'tactics', kind: 'style', label: 'Pace / Tempo', desc: '1 = grind-it-out; 100 = seven seconds or less.' },
    { key: 'adjustments', group: 'tactics', kind: 'skill', label: 'In-Game Adjustments', desc: 'Second halves and out of timeouts; can erase an opponent’s momentum.' },
    { key: 'clutch', group: 'tactics', kind: 'skill', label: 'Clutch / ATO', desc: 'Execution in the final two minutes of close games and after timeouts.' },
    { key: 'rotation', group: 'tactics', kind: 'style', label: 'Rotation Flexibility', desc: 'Low: a tight 8-man rotation. High: deep 11-man lineups.' },
    { key: 'youth', group: 'development', kind: 'skill', label: 'Youth Development', desc: 'Progression multiplier for players under 24.' },
    { key: 'skills', group: 'development', kind: 'skill', label: 'Skills Specialty', desc: 'Targeted boost for one kind of player (see specialty).' },
    { key: 'talentEval', group: 'development', kind: 'skill', label: 'Talent Evaluation', desc: 'Accuracy of scouting reports on prospects and trade targets.' },
    { key: 'ego', group: 'locker', kind: 'skill', label: 'Ego / Star Management', desc: 'Keeps stars happy when touches are limited or the team is losing.' },
    { key: 'discipline', group: 'locker', kind: 'style', label: 'Discipline', desc: 'Fewer technicals and lazy possessions; too strict clashes with volatile players.' },
    { key: 'veteranBias', group: 'locker', kind: 'style', label: 'Loyalty / Veteran Bias', desc: 'High: trusted veterans get minutes over high-potential rookies.' },
    { key: 'frontOffice', group: 'locker', kind: 'style', label: 'Front Office Influence', desc: 'How loudly the coach lobbies the GM for players.' }
  ].map(Object.freeze));
  var KEYS = ATTRIBUTES.map(function (a) { return a.key; });
  var GROUPS = Object.freeze([
    { id: 'tactics', label: 'Tactical & In-Game Strategy' },
    { id: 'development', label: 'Player Development & Scouting' },
    { id: 'locker', label: 'Locker Room & Front Office' }
  ]);
  var SPECIALTIES = Object.freeze({
    'shooting': 'Shooting — turns poor shooters into floor-spacers',
    'post': 'Big men — post play and rebounding',
    'playmaking': 'Playmaking — ball handling and passing',
    'defense': 'Perimeter defense — on-ball and steals',
    'athleticism': 'Athleticism — strength and conditioning'
  });
  var SKILL_KEYS = ATTRIBUTES.filter(function (a) { return a.kind === 'skill'; }).map(function (a) { return a.key; });

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function rate(v) { return Math.round(clamp(v, 1, 100)); }

  /* --- store ----------------------------------------------------------------- */

  function store(save) {
    if (!save.coaches || !save.coaches.items) save.coaches = { version: VERSION, items: {}, byTeam: {} };
    return save.coaches;
  }
  function get(save, id) { return (save.coaches && save.coaches.items[id]) || null; }
  function forTeam(save, teamId) { var s = save.coaches; return s ? get(save, s.byTeam[teamId]) : null; }
  function available(save) {
    var s = save.coaches;
    return s ? Object.keys(s.items).map(function (id) { return s.items[id]; }).filter(function (c) { return c.status === 'available'; }) : [];
  }
  function teamName(save, id) { var t = (save.teams || []).filter(function (x) { return x.id === id; })[0]; return t ? t.fullName : null; }
  function fullName(c) { return Identity().fullName(c); }

  // Coach overall: average of the skill attributes (styles excluded)
  function overall(c) {
    return Math.round(SKILL_KEYS.reduce(function (s, k) { return s + c.attributes[k]; }, 0) / SKILL_KEYS.length);
  }

  /* --- generation --------------------------------------------------------------- */

  function birthDate(r, seasonYear, age) {
    var y = seasonYear - age;                 // age on the season's opening day (Oct 1)
    var m = r.int(1, 12), d = r.int(1, 28);
    if (m >= 10) y -= 1;                      // born Oct–Dec: one more year back to keep the age
    return Season.isoDate(y, m, d);
  }

  function genderFor(r, mode) {
    if (mode === 'female') return r.chance(0.65) ? 'F' : 'M';
    if (mode === 'mixed') return r.chance(0.5) ? 'F' : 'M';
    return 'M';
  }

  function generateAttributes(r, age) {
    var q = clamp(64 + r.normal() * 7 + (age - 50) * 0.15, 45, 88);   // overall quality; experience helps a little
    function skill() { return rate(q + r.normal() * 9); }
    var a = {
      offense: skill(), defense: skill(), adjustments: skill(), clutch: skill(),
      youth: rate(q + r.normal() * 10 - (age - 50) * 0.2),               // younger coaches lean to development
      skills: skill(), talentEval: skill(), ego: skill(),
      pace: rate(55 + r.normal() * 14 - (age - 50) * 0.5),               // older: slower
      rotation: rate(50 + r.normal() * 15),
      discipline: rate(58 + r.normal() * 13 + (age - 50) * 0.3),
      veteranBias: rate(50 + r.normal() * 13 + (age - 50) * 0.6),
      frontOffice: rate(45 + r.normal() * 15 + (q - 60) * 0.4)
    };
    // Schemes trade off a little: few coaches are elite at both ends
    if (a.offense > 80 && a.defense > 80) a[r.chance(0.5) ? 'offense' : 'defense'] -= r.int(6, 14);
    return a;
  }

  function newCoach(save, seed, opts) {
    var r = R.rng('coach:' + save.id + ':' + seed);
    var age = Math.min(opts.age || r.int(36, 68), save.calendar.seasonYear - 2);   // very early inaugural years: no birth before year 1
    var gender = opts.gender || genderFor(r, (save.league.rules && save.league.rules.playerGender) || 'male');
    var stub = { id: 'coach-' + seed, age: age, gender: gender };
    var idn = Identity().generateIdentity(stub, save.id + ':coach', { usShare: 0.85, used: opts.used });
    return {
      id: 'coach-' + seed,
      firstName: idn.firstName, lastName: idn.lastName, suffix: idn.suffix, nameOrder: idn.nameOrder, nameOrigin: idn.nameOrigin,
      gender: gender,
      birthDate: birthDate(r, save.calendar.seasonYear, age),
      nationality: idn.nationality, birthCity: idn.birthCity, birthRegion: idn.birthRegion, birthCountry: idn.birthCountry,
      college: idn.college,
      relatives: [],
      portrait: Portraits().generate('coach:' + save.id + ':' + seed, { older: age >= 45, female: gender === 'F' }),
      teamId: null, status: 'available',
      attributes: generateAttributes(r, age),
      specialty: r.pick(Object.keys(SPECIALTIES)),
      career: [], asPlayer: null, asExecutive: [],
      source: 'generated'
    };
  }

  // Relatives: only real, existing coincidences — a coach who shares a
  // surname and nationality with a player a generation younger.
  function linkRelatives(save, coach, r) {
    var age = Season.ageOn(coach.birthDate, save.calendar.currentDate);
    var match = (save.players || []).filter(function (p) {
      return p.lastName === coach.lastName && p.nationality === coach.nationality && age - p.age >= 20 && age - p.age <= 40;
    })[0];
    if (match && r.chance(0.6)) {
      var parent = coach.gender === 'F' ? 'Mother' : 'Father';
      var child = match.gender === 'F' ? 'Daughter' : 'Son';
      coach.relatives.push({ relation: parent, name: fullName(match), playerId: match.id });
      if (!(match.relatives || []).some(function (x) { return x.coachId === coach.id; })) {
        (match.relatives = match.relatives || []).push({ relation: child, name: fullName(coach), coachId: coach.id, note: 'head coach' });
      }
    }
  }

  /** Hires a head coach for every team without one (once). */
  function ensure(save) {
    var s = store(save);
    var used = {};
    (save.players || []).forEach(function (p) { used[Identity().fold(fullName(p))] = true; });
    Object.keys(s.items).forEach(function (id) { used[Identity().fold(fullName(s.items[id]))] = true; });
    (save.teams || []).forEach(function (t) {
      if (s.byTeam[t.id] && s.items[s.byTeam[t.id]]) return;
      var c = newCoach(save, t.id, { used: used });
      c.teamId = t.id; c.status = 'employed';
      // Hired before the league began: the date isn't on record
      c.career.push({ teamId: t.id, teamName: t.fullName, role: 'Head Coach', from: null, to: null });
      linkRelatives(save, c, R.rng('coach-rel:' + save.id + ':' + t.id));
      s.items[c.id] = c;
      s.byTeam[t.id] = c.id;
    });
    return save;
  }

  /* --- retired players -> coaching ------------------------------------------------ */

  /**
   * Interest in coaching after retirement, from personality: leadership,
   * basketball IQ, work ethic, and a calm temperament. -> 0..0.85
   */
  function coachingInterest(p) {
    var t = p.traits || {}, m = p.mental || {};
    var score = (t.leadership || 50) * 0.35 + (m.iq || 50) * 0.3 + (t.workEthic || 50) * 0.2 + (100 - (t.volatility || 50)) * 0.15;
    return clamp((score - 52) / 35, 0, 0.85);
  }

  // A former player's coaching profile grows out of who he was as a player
  function attributesFromPlayer(r, p) {
    var t = p.traits || {}, m = p.mental || {}, a = p.attributes || {};
    function v(x, sd) { return rate(x + r.normal() * (sd || 6)); }
    var pos = p.position;
    return {
      offense: v((m.iq || 55) * 0.7 + (pos === 'PG' ? 18 : 12)),
      defense: v((m.defConsistency || 55) * 0.75 + 12),
      pace: v(pos === 'PG' || pos === 'SG' ? 62 : 45, 12),
      adjustments: v((m.iq || 55) * 0.6 + 18),
      clutch: v((m.clutch || 55) * 0.8 + 8),
      rotation: v(50, 14),
      youth: v((t.workEthic || 55) * 0.6 + (t.leadership || 50) * 0.2 + 10),
      skills: v(55, 9),
      talentEval: v((m.iq || 55) * 0.5 + 22),
      ego: v((t.leadership || 50) * 0.55 + (100 - (t.volatility || 50)) * 0.3 + 8),
      discipline: v((m.discipline || 55) * 0.8 + 12),
      veteranBias: v(50 + ((a.durability || 60) - 60) * 0.2, 12),
      frontOffice: v((t.leadership || 50) * 0.5 + (100 - (t.loyalty || 50)) * 0.3 + 10)
    };
  }
  function specialtyFromPlayer(p) {
    var a = p.attributes || {};
    var best = [['shooting', a.threePoint || 0], ['post', ((a.lowPost || 0) + (a.offRebounding || a.offensiveRebounding || 0)) / 2],
      ['playmaking', ((a.pass || 0) + (a.ballHandling || 0)) / 2], ['defense', a.perimeterDefense || 0], ['athleticism', ((a.speed || 0) + (a.vertical || 0)) / 2]]
      .sort(function (x, y) { return y[1] - x[1]; })[0];
    return best[1] ? best[0] : 'shooting';
  }

  /**
   * Called when a player retires. Decides (deterministically, from
   * personality) whether he goes into coaching; if so he joins the pool of
   * available coaches with his playing career recorded. -> coach | null
   */
  function considerCoaching(save, player, date) {
    var s = store(save);
    var id = 'coach-p-' + player.id;
    if (s.items[id]) return s.items[id];
    var r = R.rng('coach-career:' + save.id + ':' + player.id);
    if (!r.chance(coachingInterest(player))) return null;
    var c = {
      id: id,
      firstName: player.firstName, lastName: player.lastName, suffix: player.suffix || null,
      nameOrder: player.nameOrder, nameOrigin: player.nameOrigin, gender: player.gender || 'M',
      birthDate: player.birthDate, nationality: player.nationality, birthCity: player.birthCity, birthRegion: player.birthRegion || null,
      birthCountry: player.birthCountry, college: player.college,
      relatives: (player.relatives || []).map(function (x) { return { relation: x.relation, name: x.name, playerId: x.playerId || null }; }),
      portrait: player.portrait,
      teamId: null, status: 'available',
      attributes: attributesFromPlayer(r, player),
      specialty: specialtyFromPlayer(player),
      career: [],
      asPlayer: { playerId: player.id, seasons: (player.experience || 0) + 1, retiredDate: date, lastTeamName: teamName(save, player.teamId), draft: player.draft || null },
      asExecutive: [],
      source: 'former-player'
    };
    s.items[id] = c;
    return c;
  }

  /** Head coach change: the new coach takes over; the old one becomes available. */
  function hire(save, teamId, coachId, date) {
    var s = store(save);
    var c = s.items[coachId];
    if (!c || c.status !== 'available' || !teamName(save, teamId)) return false;
    var old = forTeam(save, teamId);
    if (old) {
      old.status = 'available'; old.teamId = null;
      var stint = old.career[old.career.length - 1];
      if (stint && stint.to == null) stint.to = date;
    }
    c.status = 'employed'; c.teamId = teamId;
    c.career.push({ teamId: teamId, teamName: teamName(save, teamId), role: 'Head Coach', from: date, to: null });
    s.byTeam[teamId] = coachId;
    return true;
  }

  /* --- effects ------------------------------------------------------------------- */

  // For the game engine (multipliers; 1 = neutral)
  function gameModifiers(c) {
    var a = c ? c.attributes : null;
    function f(k, span) { return a ? 1 + (a[k] - 50) / 50 * span : 1; }
    return {
      offensiveEfficiency: f('offense', 0.03),
      assistRate: f('offense', 0.05),
      turnoverRate: a ? 1 - (a.offense - 50) / 50 * 0.04 : 1,
      defensiveEfficiency: a ? 1 - (a.defense - 50) / 50 * 0.03 : 1,     // points allowed
      contestRate: f('defense', 0.05),
      forcedTurnovers: f('defense', 0.05),
      possessionsPer48: a ? Math.round((88 + a.pace * 0.16) * 10) / 10 : 96,   // 88..104
      secondHalfBoost: f('adjustments', 0.02),
      erasesMomentum: !!a && a.adjustments >= 75,
      clutchExecution: f('clutch', 0.05),
      afterTimeout: f('clutch', 0.04),
      rotationSize: rotationSize(c),
      technicalFouls: a ? 1 - (a.discipline - 50) / 100 : 1
    };
  }

  function rotationSize(c) {
    if (!c) return 9;
    var r = c.attributes.rotation;
    return r < 25 ? 8 : r < 60 ? 9 : r < 85 ? 10 : 11;
  }

  // Development multiplier for a player (under 24: youth development;
  // plus the coach's specialty for matching players)
  function progressionMultiplier(c, player) {
    if (!c) return 1;
    var m = 1;
    if (player.age < 24) m *= 0.75 + c.attributes.youth / 200;                 // 0.75..1.25
    if (specialtyFits(c.specialty, player)) m *= 1 + c.attributes.skills / 1000; // up to +10%
    return Math.round(m * 1000) / 1000;
  }
  function specialtyFits(sp, p) {
    var a = p.attributes || {};
    if (sp === 'shooting') return (a.threePoint || 99) < 60;
    if (sp === 'post') return p.position === 'PF' || p.position === 'C';
    if (sp === 'playmaking') return p.position === 'PG' || p.position === 'SG';
    if (sp === 'defense') return p.position === 'SG' || p.position === 'SF';
    return true;
  }

  // Scouting fog: ± rating points of error on hidden ratings
  function scoutingError(c) { return c ? Math.max(1, Math.round(13 - c.attributes.talentEval / 9)) : 8; }

  /**
   * Bench order for playing time: veteran bias moves trusted veterans up
   * and raw young players down. -> sort score (higher plays more)
   */
  function minutesScore(c, p) {
    var vb = c ? (c.attributes.veteranBias - 50) / 10 : 0;   // -5..+5
    var adj = p.age >= 30 ? vb : p.age <= 23 ? -vb : 0;
    return p.overall + adj;
  }

  /**
   * Morale: how the head coach handles this player. -> { impact, detail } | null
   */
  function moraleFactor(c, player, ctx) {
    if (!c) return null;
    var a = c.attributes, impact = 0, notes = [];
    var star = player.overall >= 80;
    if (star) {
      var e = (a.ego - 50) / 10;                 // -5..+5
      impact += e;
      notes.push(e >= 1.5 ? 'Coach ' + c.lastName + ' keeps the stars bought in.' : e <= -1.5 ? 'Clashes with Coach ' + c.lastName + ' over touches.' : 'A workable relationship with the coach.');
    }
    var vol = player.traits ? player.traits.volatility : 50;
    if (a.discipline >= 78 && vol >= 65) { impact -= (a.discipline - 75) / 5 + 1; notes.push('Chafes under a strict, disciplined coach.'); }
    else if (a.discipline >= 70 && player.personality === 'professional') { impact += 1; notes.push('Respects the coach’s structure.'); }
    else if (a.discipline <= 30 && player.personality === 'easygoing') { impact += 1; notes.push('Enjoys the relaxed environment.'); }
    var young = player.age <= 23 && player.potential - player.overall >= 8;
    if (young && a.veteranBias >= 70) { impact -= 2; notes.push('Coach favors veterans over young players.'); }
    if (player.age >= 30 && a.veteranBias >= 70) { impact += 1.5; notes.push('The coach trusts veterans.'); }
    if (!notes.length) return null;
    return { impact: Math.round(impact * 10) / 10, detail: notes.join(' ') };
  }

  // Losing streaks: star management softens the blow (multiplier)
  function streakBuffer(c, player) {
    if (!c || player.overall < 80) return 1;
    return clamp(1.3 - c.attributes.ego / 125, 0.5, 1.3);
  }

  var POS_NAMES = { PG: 'point guard', SG: 'shooting guard', SF: 'small forward', PF: 'power forward', C: 'center' };
  /**
   * What the coach is pushing the GM for, if anything (front office
   * influence). Based on the actual roster. -> { level, text } | null
   */
  function lobbying(save, teamId) {
    var c = forTeam(save, teamId);
    if (!c || c.attributes.frontOffice < 55) return null;
    var lineup = (save.lineups || {})[teamId] || {};
    var byId = {};
    (save.players || []).forEach(function (p) { byId[p.id] = p; });
    var weakest = Object.keys(lineup).map(function (pos) { return { pos: pos, p: byId[lineup[pos]] }; })
      .filter(function (x) { return x.p; }).sort(function (x, y) { return x.p.overall - y.p.overall; })[0];
    if (!weakest) return null;
    var loud = c.attributes.frontOffice >= 75;
    var wantsVet = c.attributes.veteranBias >= 60;
    var text = (loud ? 'Coach ' + c.lastName + ' is pushing hard' : 'Coach ' + c.lastName + ' would like you') + ' to ' +
      (wantsVet ? 'trade for a proven veteran ' : 'upgrade at ') + POS_NAMES[weakest.pos] +
      (wantsVet ? ' and avoid drafting raw prospects.' : '.');
    return { level: loud ? 'loud' : 'mild', text: text, position: weakest.pos };
  }

  function styleLabel(key, v) {
    if (key === 'pace') return v >= 75 ? 'Run-and-gun' : v >= 58 ? 'Up-tempo' : v >= 42 ? 'Balanced' : v >= 25 ? 'Deliberate' : 'Grind-it-out';
    if (key === 'rotation') return rotationSize({ attributes: { rotation: v } }) + '-man rotation';
    if (key === 'discipline') return v >= 78 ? 'Strict' : v >= 55 ? 'Structured' : v >= 35 ? 'Relaxed' : 'Hands-off';
    if (key === 'veteranBias') return v >= 70 ? 'Trusts veterans' : v >= 45 ? 'Balanced' : 'Plays the kids';
    if (key === 'frontOffice') return v >= 75 ? 'Lobbies loudly' : v >= 55 ? 'Makes requests' : 'Stays in his lane';
    return '';
  }
  // One-line identity for the roster tab
  function summary(c) {
    var a = c.attributes;
    var parts = [styleLabel('pace', a.pace)];
    if (a.defense - a.offense >= 8) parts.push('defense-first'); else if (a.offense - a.defense >= 8) parts.push('offense-first');
    parts.push(rotationSize(c) + '-man rotation');
    return parts.join(' · ');
  }

  /* --- validation ----------------------------------------------------------------- */

  function isValid(save) {
    var s = save.coaches;
    if (s === undefined) return true;
    if (!s || typeof s.items !== 'object' || typeof s.byTeam !== 'object') return false;
    var ok = Object.keys(s.items).every(function (id) {
      var c = s.items[id];
      return c && c.id === id && typeof c.firstName === 'string' && typeof c.lastName === 'string' && Season.isValidDate(c.birthDate) &&
        (c.status === 'employed' || c.status === 'available') && c.attributes &&
        KEYS.every(function (k) { return Number.isInteger(c.attributes[k]) && c.attributes[k] >= 1 && c.attributes[k] <= 100; }) &&
        SPECIALTIES[c.specialty] && Array.isArray(c.relatives) && Array.isArray(c.career) && Array.isArray(c.asExecutive) &&
        (c.asPlayer === null || typeof c.asPlayer === 'object');
    });
    return ok && Object.keys(s.byTeam).every(function (t) { var c = s.items[s.byTeam[t]]; return c && c.teamId === t && c.status === 'employed'; });
  }

  return {
    VERSION: VERSION, ATTRIBUTES: ATTRIBUTES, KEYS: KEYS, GROUPS: GROUPS, SPECIALTIES: SPECIALTIES,
    ensure: ensure, get: get, forTeam: forTeam, available: available, overall: overall, fullName: fullName,
    coachingInterest: coachingInterest, considerCoaching: considerCoaching, hire: hire,
    gameModifiers: gameModifiers, rotationSize: rotationSize, progressionMultiplier: progressionMultiplier,
    scoutingError: scoutingError, minutesScore: minutesScore, moraleFactor: moraleFactor, streakBuffer: streakBuffer,
    lobbying: lobbying, styleLabel: styleLabel, summary: summary, isValid: isValid
  };
});
