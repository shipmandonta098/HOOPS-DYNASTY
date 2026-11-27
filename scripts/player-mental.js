/* ==========================================================================
   HOOPS DYNASTY — mental attributes & personality stats

   MENTAL ATTRIBUTES (0–100, the on-court IQ) — player.mental
     iq                 Basketball IQ / awareness: reading the defense.
                        High passing + low IQ = forced passes, turnovers.
     clutch             Clutch / composure under pressure (late & close,
                        playoffs): boosts or hurts shooting and turnovers.
     defConsistency     Missed rotations, biting on pump fakes, failing
                        to contest — independent of block / steal ratings.
     discipline         Reach-in, shooting and offensive foul frequency.
   They multiply a player's physical and technical attributes in a
   possession (possessionModifiers); they are NOT part of overall, so every
   existing overall rating stays exactly as it was.

   PERSONALITY STATS (0–100) — player.traits
     loyalty            Greed (0) vs loyalty (100): free-agency behaviour.
     workEthic          Offseason progression rate; how long the physical
                        peak lasts into the 30s.
     volatility         Temperament: morale swings, losing-streak drops,
                        trade demands, negative locker-room incidents.
     leadership         Passive boost to younger teammates' composure, IQ
                        and development.
   Stats follow the player's personality type (scripts/morale.js), with
   individual variation. Seeded; stored once.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var node = typeof module === 'object' && module.exports;
  var api = factory(node ? require('./random.js') : root.HDRandom);
  if (node) module.exports = api;
  else root.HDPlayerMental = api;
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';

  var MENTAL = Object.freeze([
    { key: 'iq', label: 'Basketball IQ', summary: 'Reads the defense; fewer forced passes and turnovers.' },
    { key: 'clutch', label: 'Clutch', summary: 'Composure late in close games and in the playoffs.' },
    { key: 'defConsistency', label: 'Defensive Consistency', summary: 'Makes rotations, stays down on pump fakes, contests.' },
    { key: 'discipline', label: 'Discipline', summary: 'Avoids reach-ins, shooting and offensive fouls.' }
  ].map(Object.freeze));
  var MENTAL_KEYS = MENTAL.map(function (m) { return m.key; });

  var TRAITS = Object.freeze([
    { key: 'loyalty', label: 'Loyalty', low: 'Greedy', high: 'Loyal' },
    { key: 'workEthic', label: 'Work Ethic' },
    { key: 'volatility', label: 'Temperament', low: 'Calm', high: 'Volatile' },
    { key: 'leadership', label: 'Leadership' }
  ].map(Object.freeze));
  var TRAIT_KEYS = TRAITS.map(function (t) { return t.key; });

  // Personality type -> trait centers (variation is added per player)
  var TRAIT_CENTERS = {
    leader:       { loyalty: 67, workEthic: 74, volatility: 28, leadership: 82 },
    professional: { loyalty: 63, workEthic: 80, volatility: 25, leadership: 60 },
    competitor:   { loyalty: 50, workEthic: 74, volatility: 50, leadership: 55 },
    easygoing:    { loyalty: 66, workEthic: 50, volatility: 20, leadership: 40 },
    spotlight:    { loyalty: 33, workEthic: 58, volatility: 55, leadership: 38 },
    volatile:     { loyalty: 44, workEthic: 54, volatility: 84, leadership: 25 }
  };
  var TRAIT_SD = { loyalty: 13, workEthic: 11, volatility: 8, leadership: 8 };

  var MENTAL_PERSONALITY = {
    leader:       { clutch: 6, discipline: 6 },
    professional: { clutch: 2, discipline: 10, defConsistency: 5 },
    competitor:   { clutch: 8, discipline: -2 },
    easygoing:    { clutch: -2, discipline: 4 },
    spotlight:    { clutch: 4, discipline: -3 },
    volatile:     { clutch: -8, discipline: -14, defConsistency: -4 }
  };
  var IQ_ARCHETYPE = { 'floor-general': 10, 'playmaker': 6, 'point-forward': 8, 'playmaking-big': 8, 'two-way-guard': 4,
    'two-way-wing': 4, 'two-way-big': 4, 'all-around-wing': 4, 'athletic-finisher': -4, 'slasher': -3 };
  var DEF_ARCHETYPE = { 'defensive-guard': 9, 'defensive-specialist': 10, 'rim-protector': 8, 'two-way-guard': 6, 'two-way-wing': 6,
    'two-way-big': 6, 'three-and-d-wing': 5, 'scoring-guard': -5, 'shot-creator': -5, 'perimeter-scorer': -5, 'stretch-big': -4, 'post-scorer': -3 };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function rnd(v) { return Math.round(clamp(v, 1, 99)); }

  /* --- generation ---------------------------------------------------------- */

  function generateTraits(r, p) {
    var c = TRAIT_CENTERS[p.personality] || TRAIT_CENTERS.professional;
    var exp = Number.isInteger(p.experience) ? p.experience : 0;
    var t = {};
    TRAIT_KEYS.forEach(function (k) { t[k] = c[k] + r.normal() * TRAIT_SD[k]; });
    t.leadership += Math.min(exp, 12) * 1.1 - 6 + (p.age <= 22 ? -8 : 0);    // leaders grow with experience
    t.workEthic += p.age >= 30 ? 2 : 0;                                        // vets still around tend to work
    var out = {};
    TRAIT_KEYS.forEach(function (k) { out[k] = rnd(t[k]); });
    return out;
  }

  function generateMental(r, p) {
    var a = p.attributes || {};
    var exp = Number.isInteger(p.experience) ? p.experience : 0;
    var ovr = typeof p.overall === 'number' ? p.overall : 70;
    var pm = MENTAL_PERSONALITY[p.personality] || {};
    var def = typeof a.perimeterDefense === 'number' ? (a.perimeterDefense + a.interiorDefense) / 2 : ovr - 8;
    return {
      iq: rnd(50 + (ovr - 70) * 0.6 + Math.min(exp, 12) * 1.2 + (IQ_ARCHETYPE[p.archetype] || 0) + r.normal() * 8),
      clutch: rnd(55 + (ovr - 70) * 0.5 + Math.min(exp, 12) * 0.6 + (pm.clutch || 0) + r.normal() * 10),
      defConsistency: rnd(52 + (def - 60) * 0.4 + (DEF_ARCHETYPE[p.archetype] || 0) + (pm.defConsistency || 0) + (p.age >= 28 ? 3 : 0) + r.normal() * 9),
      discipline: rnd(58 + (pm.discipline || 0) + Math.min(exp, 12) * 0.5 + (p.age <= 21 ? -4 : 0) + r.normal() * 10)
    };
  }

  /**
   * Adds mental attributes and personality stats to any player missing
   * them (never changes existing values). Players need a personality first
   * (scripts/morale.js addPersonalities).
   */
  function addMissing(players, seed) {
    (players || []).forEach(function (p) {
      var r = R.rng('mental:' + seed + ':' + p.id);
      if (!isValidTraits(p.traits)) p.traits = generateTraits(r, p);
      if (!isValidMental(p.mental)) p.mental = generateMental(r, p);
    });
    return players;
  }

  function isValidMental(m) { return !!m && MENTAL_KEYS.every(function (k) { return Number.isInteger(m[k]) && m[k] >= 0 && m[k] <= 100; }); }
  function isValidTraits(t) { return !!t && TRAIT_KEYS.every(function (k) { return Number.isInteger(t[k]) && t[k] >= 0 && t[k] <= 100; }); }

  /* --- leadership aura ---------------------------------------------------- */

  /**
   * The team's most influential leader (the captain's voice counts extra)
   * and the passive boost young teammates (24 and under) receive.
   * @returns { leader, boost }   boost 0..6 points to IQ and composure
   */
  function leadershipAura(save, teamId) {
    var roster = save.players.filter(function (p) { return p.teamId === teamId && p.traits; });
    var captainId = save.morale && save.morale.captains ? save.morale.captains[teamId] : null;
    var best = null, bestScore = -1;
    roster.forEach(function (p) {
      var s = p.traits.leadership * (p.id === captainId ? 1.15 : 1);
      if (s > bestScore) { bestScore = s; best = p; }
    });
    var boost = best ? Math.round(clamp((bestScore - 60) / 6, 0, 6)) : 0;
    return { leader: boost ? best : null, boost: boost };
  }

  // Mental attributes as they play, including a leader's boost for young players
  function effectiveMental(save, player) {
    var m = player.mental;
    if (!m) return null;
    var aura = leadershipAura(save, player.teamId);
    var applies = aura.boost > 0 && player.age <= 24 && aura.leader && aura.leader.id !== player.id;
    var out = { boost: applies ? aura.boost : 0, leader: applies ? aura.leader : null };
    MENTAL_KEYS.forEach(function (k) {
      out[k] = applies && (k === 'iq' || k === 'clutch') ? Math.min(99, m[k] + aura.boost) : m[k];
    });
    return out;
  }

  /* --- effects for the game simulation ---------------------------------- */

  /**
   * How a player's mind scales a possession.
   * @param player  { mental (or effective mental), attributes }
   * @param ctx     { pressure: bool  (late & close, playoffs) }
   * @returns { turnoverRate, shootingPct, missedRotationRate, foulRate }
   *          multipliers around 1.0 (base rates come from the simulation)
   */
  function possessionModifiers(mental, attributes, ctx) {
    var m = mental || {}, a = attributes || {};
    var iq = m.iq != null ? m.iq : 60, clutch = m.clutch != null ? m.clutch : 60;
    var pass = a.pass != null ? a.pass : 60;
    // A gifted passer who can't read the floor forces passes
    var turnover = 1 + Math.max(0, pass - iq) / 150 + (60 - iq) / 200;
    var shooting = 1;
    if (ctx && ctx.pressure) {
      shooting += (clutch - 60) / 600;               // about ±6%
      turnover *= 1 + (60 - clutch) / 300;
    }
    return {
      turnoverRate: Math.round(clamp(turnover, 0.6, 1.8) * 1000) / 1000,
      shootingPct: Math.round(clamp(shooting, 0.9, 1.08) * 1000) / 1000,
      missedRotationRate: Math.round(clamp(1 + (60 - (m.defConsistency != null ? m.defConsistency : 60)) / 80, 0.5, 1.8) * 1000) / 1000,
      foulRate: Math.round(clamp(1 + (60 - (m.discipline != null ? m.discipline : 60)) / 70, 0.5, 1.9) * 1000) / 1000
    };
  }

  /* --- effects for future progression / free agency / events --------------- */

  // Work ethic -> offseason training points and how long the peak lasts
  function progressionModifiers(traits, leadershipBoost) {
    var w = traits ? traits.workEthic : 60;
    return {
      trainingPoints: Math.round((0.7 + w / 100 * 0.6 + (leadershipBoost || 0) / 50) * 100) / 100,   // 0.7..1.42
      peakExtensionYears: Math.round(clamp((w - 50) / 25, -2, 2) * 10) / 10                          // decline starts later / earlier
    };
  }

  /**
   * Free-agency demand from greed / loyalty (combine with morale's
   * contractOutlook). Greedy players ask for the max regardless of team
   * success; loyal players may give their own team a discount to chase a
   * title.
   * @param ctx { homeTeam: bool, contending: bool }
   */
  function freeAgencyDemand(traits, ctx) {
    ctx = ctx || {};
    var loyalty = traits ? traits.loyalty : 50, greed = 100 - loyalty;
    var demandsMax = greed >= 75;
    var factor = 1 + (greed - 50) / 200;                  // 0.75 .. 1.25
    var homeDiscount = !demandsMax && ctx.homeTeam && loyalty >= 70 && ctx.contending;
    if (homeDiscount) factor = Math.min(factor, 0.85 + (100 - loyalty) / 300);
    // Same bands as the Loyalty description (traitLabel)
    var summary = demandsMax ? 'Will demand a maximum contract, whatever the team’s fortunes.'
      : homeDiscount ? 'Would take a hometown discount to stay with a contender.'
      : loyalty >= 75 ? 'Very loyal: would consider a hometown discount to chase a title.'
      : loyalty >= 55 ? 'Prefers to stay; flexible on price.'
      : loyalty >= 40 ? 'Weighs money and fit evenly.'
      : 'Will follow the best offer.';
    return { demandsMax: demandsMax, homeDiscount: !!homeDiscount, askingPriceFactor: Math.round(factor * 100) / 100, summary: summary };
  }

  // Temperament: morale lost per game during a losing streak
  function losingStreakMoraleDrop(streak, traits) {
    var v = traits ? traits.volatility : 50;
    return streak >= 3 ? Math.round(Math.min(12, (streak - 2) * (v / 50)) * 10) / 10 : 0;
  }

  // Chance of a negative locker-room incident after a loss (future text events)
  var INCIDENTS = [
    '{name} was seen arguing with teammates after another loss.',
    '{name} skipped the team’s film session following the defeat.',
    '{name} vented frustration about the losing streak to reporters.',
    '{name} had a heated exchange with the coaching staff on the bench.'
  ];
  function lockerIncidentChance(traits, streak) {
    var v = traits ? traits.volatility : 50;
    if (v < 65 || streak < 2) return 0;
    return Math.round(((v - 65) / 35) * Math.min(1, streak / 8) * 0.5 * 1000) / 1000;
  }

  function label(value, scale) {
    for (var i = 0; i < scale.length; i++) if (value >= scale[i][0]) return scale[i][1];
    return scale[scale.length - 1][1];
  }
  var WORK_LABELS = [[85, 'Elite'], [70, 'Strong'], [45, 'Average'], [0, 'Poor']];
  var TEMPER_LABELS = [[80, 'Explosive'], [65, 'Volatile'], [35, 'Even-keeled'], [0, 'Calm']];
  var LEAD_LABELS = [[85, 'Elite leader'], [70, 'Strong leader'], [45, 'Occasional voice'], [0, 'Follower']];
  var LOYAL_LABELS = [[75, 'Very loyal'], [55, 'Loyal'], [40, 'Business-minded'], [25, 'Greedy'], [0, 'Very greedy']];
  function traitLabel(key, v) {
    return label(v, key === 'workEthic' ? WORK_LABELS : key === 'volatility' ? TEMPER_LABELS : key === 'leadership' ? LEAD_LABELS : LOYAL_LABELS);
  }

  return {
    MENTAL: MENTAL, MENTAL_KEYS: MENTAL_KEYS, TRAITS: TRAITS, TRAIT_KEYS: TRAIT_KEYS,
    addMissing: addMissing,
    isValidMental: isValidMental, isValidTraits: isValidTraits,
    leadershipAura: leadershipAura, effectiveMental: effectiveMental,
    possessionModifiers: possessionModifiers,
    progressionModifiers: progressionModifiers,
    freeAgencyDemand: freeAgencyDemand,
    losingStreakMoraleDrop: losingStreakMoraleDrop,
    lockerIncidentChance: lockerIncidentChance,
    INCIDENTS: INCIDENTS,
    traitLabel: traitLabel
  };
});
