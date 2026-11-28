/* ==========================================================================
   HOOPS DYNASTY — player tendencies (how a player plays, for the game sim)
   Ratings say how WELL a player does something; tendencies say how OFTEN
   he chooses to. 24 tendencies, 0–100, in four groups, stored on each
   player (player.tendencies). Generated once from who the player already
   is — attributes, position, height, mental attributes and personality
   stats — plus a little seeded individuality, so a 40-rated shooter never
   jacks up threes like a 90-rated one. Never overwritten.

   Two-sided tendencies (`ends`) run from the low label to the high one
   (e.g. Pull-Up 0 ↔ 100 Catch-and-Shoot).

   simProfile() turns tendencies into the probabilities the game engine
   uses (shot mix, pass vs. shoot, defensive choices, situational
   multipliers); flavor() gives play-by-play text hooks (dunks, putbacks).
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var node = typeof module === 'object' && module.exports;
  var api = factory(node ? require('./random.js') : root.HDRandom);
  if (node) module.exports = api;
  else root.HDTendencies = api;
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';

  var GROUPS = Object.freeze([
    { id: 'scoring', label: 'Shot Selection & Scoring' },
    { id: 'playmaking', label: 'Playmaking & Ball-Handling' },
    { id: 'defense', label: 'Defense, Hustle & Rebounding' },
    { id: 'situational', label: 'Situational & Game Flow' }
  ]);

  function t(key, group, label, desc, ends) { return Object.freeze({ key: key, group: group, label: label, desc: desc, ends: ends || null }); }
  var TENDENCIES = Object.freeze([
    t('threePoint', 'scoring', 'Three-Point Frequency', 'How often he pulls from deep instead of taking a two.'),
    t('catchShoot', 'scoring', 'Catch-and-Shoot vs. Pull-Up', 'Spot-up shooter or off-the-dribble jumpers.', ['Pull-Up', 'Catch & Shoot']),
    t('deepRange', 'scoring', 'Deep / Limitless Range', 'Launches well past the arc.'),
    t('drive', 'scoring', 'Drive vs. Jumper', 'Attacks the lane or settles for perimeter shots.', ['Jumper', 'Drive']),
    t('rimAttack', 'scoring', 'Rim Attack / Driving Layup', 'Finishes at the basket over floaters or pull-ups.'),
    t('floater', 'scoring', 'Floater / Runner', 'Mid-lane touch shots when help defense steps up.'),
    t('midRange', 'scoring', 'Mid-Range vs. Paint', 'Elbow and baseline jumpers versus post-ups and dump-offs inside.', ['Paint', 'Mid-Range']),
    t('postUp', 'scoring', 'Post-Up Frequency', 'Backs down a defender in the low or mid post.'),
    t('flashyDunk', 'scoring', 'Flashy Dunk / Putback', 'Highlight finishes on breakaways and offensive rebounds.'),
    t('passFirst', 'playmaking', 'Pass-First vs. Shot-First', 'Moves the ball quickly or hunts his own shot.', ['Shot-First', 'Pass-First']),
    t('driveKick', 'playmaking', 'Drive-and-Kick', 'Drives into traffic to draw help and kick out to shooters.'),
    t('pnrHandler', 'playmaking', 'Pick-and-Roll: Handler vs. Screener', 'Calls for screens or sets them to slip and roll.', ['Screener', 'Ball Handler']),
    t('transition', 'playmaking', 'Transition Push', 'Pushes the tempo off defensive rebounds and turnovers.'),
    t('riskyPass', 'playmaking', 'Flashy / Risky Pass', 'Skip passes and no-looks — with more turnovers.'),
    t('iso', 'playmaking', 'Iso / Hero Ball', 'Holds the ball for his own isolation late in the clock.'),
    t('onBallPressure', 'defense', 'On-Ball Pressure', 'Pressures up the floor instead of sagging off.'),
    t('gamble', 'defense', 'Gambling for Steals', 'Reaches into lanes and dribbles — and gets blown by or fouls.'),
    t('helpBlock', 'defense', 'Shot-Blocking / Help Contest', 'Rotates to contest at the rim instead of staying home.'),
    t('chargeDraw', 'defense', 'Foul / Charge Draw', 'Takes charges and initiates contact for shooting fouls.'),
    t('crashGlass', 'defense', 'Offensive Rebound Crash', 'Crashes the glass at the expense of transition defense.'),
    t('boxOut', 'defense', 'Box-Out Priority', 'Pins his man out instead of chasing loose rebounds.'),
    t('clutch', 'situational', 'Clutch / Late-Clock Aggression', 'Takes over in the final minutes and closing seconds.'),
    t('foulCaution', 'situational', 'Foul Trouble Caution', 'Scales back drives, steals and blocks with fouls piling up.'),
    t('hotHand', 'situational', 'Hot-Hand / Cold-Hand Reaction', 'Chases shots after makes and defers after misses.', ['Steady', 'Streaky'])
  ]);
  var KEYS = TENDENCIES.map(function (x) { return x.key; });

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function val(v) { return Math.round(clamp(v, 0, 100)); }

  var GUARD = { PG: 1, SG: 0.6, SF: 0.2, PF: -0.5, C: -1 };   // guard-ness by position

  /**
   * Tendencies for one player (deterministic per dynasty + player).
   */
  function generate(p, seed) {
    var r = R.rng('tendencies:' + seed + ':' + p.id);
    function n(sd) { return r.normal() * (sd || 7); }
    var a = p.attributes || {};
    function A(k) { return typeof a[k] === 'number' ? a[k] : 50; }
    var m = p.mental || {}, tr = p.traits || {};
    var iq = m.iq || 50, disc = m.discipline || 50, clutchM = m.clutch || 50, defC = m.defConsistency || 50;
    var vol = tr.volatility == null ? 50 : tr.volatility, lead = tr.leadership == null ? 50 : tr.leadership, loyal = tr.loyalty == null ? 50 : tr.loyalty;
    var g = GUARD[p.position] == null ? 0 : GUARD[p.position];
    var spot = p.personality === 'spotlight' ? 10 : p.personality === 'volatile' ? 6 : p.personality === 'professional' ? -4 : 0;
    var finishing = (A('layups') + A('dunk')) / 2;
    var shooting = (A('threePoint') + A('midRange')) / 2;
    var scoring = Math.max(shooting, finishing, A('lowPost'));

    var out = {
      threePoint: 50 + (A('threePoint') - 55) * 1.5 + g * 8 + n(),
      catchShoot: 55 + (A('threePoint') - A('ballHandling')) * 0.7 - g * 6 + n(8),
      deepRange: A('threePoint') >= 78 ? (A('threePoint') - 74) * 4 + spot + n(8) : clamp(5 + n(3), 0, 12),
      drive: 50 + ((finishing + A('speed')) / 2 - shooting) * 0.8 + (A('ballHandling') - 55) * 0.5 + g * 8 + n(),
      rimAttack: 30 + (finishing - 55) * 1.1 + (A('strength') - 55) * 0.3 + (A('vertical') - 55) * 0.2 + n(),
      floater: 35 + (A('layups') - 55) * 0.6 + (A('midRange') - 55) * 0.4 - (A('strength') - 55) * 0.4 + g * 6 + n(8),
      midRange: 50 + (A('midRange') - (A('lowPost') + A('layups')) / 2) * 1.1 + g * 5 + n(),
      postUp: 15 + (A('lowPost') - 50) * 1.2 + (A('strength') - 55) * 0.4 - g * 14 + n(),
      flashyDunk: (A('dunk') - 45) * 1.3 + (A('vertical') - 55) * 0.4 + spot + (vol - 50) * 0.15 + n(8),

      passFirst: 45 + (A('pass') - scoring) * 0.9 + (iq - 50) * 0.2 + g * 10 - spot + n(),
      driveKick: 30 + (A('pass') - 50) * 0.6 + (A('ballHandling') - 50) * 0.4 + (A('speed') - 55) * 0.3 + g * 6 + n(8),
      pnrHandler: 50 + (A('ballHandling') - 55) * 0.9 - (A('strength') - 55) * 0.3 + g * 22 + n(),
      transition: 45 + (A('speed') - 55) * 0.8 + (A('ballHandling') - 55) * 0.3 + g * 6 + n(8),
      riskyPass: 35 + (A('pass') - 55) * 0.6 + (vol - 50) * 0.3 - (disc - 50) * 0.3 + spot * 0.5 + n(8),
      iso: 25 + (A('ballHandling') - 55) * 0.5 + (scoring - 60) * 0.7 + (p.overall - 70) * 0.6 + spot + (50 - loyal) * 0.1 + n(8),

      onBallPressure: 45 + (A('perimeterDefense') - 55) * 0.7 + (A('speed') - 55) * 0.3 + (A('stamina') - 60) * 0.2 + g * 6 + n(8),
      gamble: 35 + (A('steal') - 55) * 0.7 - (defC - 50) * 0.3 + (vol - 50) * 0.2 + n(8),
      helpBlock: 35 + (A('blocks') - 50) * 0.8 + (A('interiorDefense') - 55) * 0.3 + (A('vertical') - 55) * 0.2 - g * 8 + n(8),
      chargeDraw: 40 + (iq - 50) * 0.3 + (defC - 50) * 0.3 + (disc - 50) * 0.2 - (A('blocks') - 50) * 0.2 + n(9),
      crashGlass: 25 + (A('offensiveRebounding') - 50) * 1.1 - g * 10 + n(8),
      boxOut: 40 + (A('defensiveRebounding') - 50) * 0.7 + (A('strength') - 55) * 0.3 + (disc - 50) * 0.2 - g * 6 + n(8),

      clutch: 40 + (clutchM - 50) * 0.6 + (lead - 50) * 0.2 + (p.overall - 70) * 0.6 + spot * 0.6 + n(8),
      foulCaution: 50 + (disc - 50) * 0.5 + (iq - 50) * 0.3 - (vol - 50) * 0.2 + n(8),
      hotHand: 40 + (vol - 50) * 0.5 + spot - (iq - 50) * 0.2 + n(9)
    };
    // Players who can't shoot it rarely try (keeps tendencies honest to ratings)
    if (A('threePoint') < 45) out.threePoint = Math.min(out.threePoint, 12);
    if (A('dunk') < 40) out.flashyDunk = Math.min(out.flashyDunk, 5);
    var res = {};
    KEYS.forEach(function (k) { res[k] = val(out[k]); });
    return res;
  }

  function isValid(x) { return !!x && KEYS.every(function (k) { return Number.isInteger(x[k]) && x[k] >= 0 && x[k] <= 100; }); }

  // Fills missing tendencies only; never overwrites
  function addMissing(players, seed) {
    (players || []).forEach(function (p) { if (!isValid(p.tendencies)) p.tendencies = generate(p, seed); });
    return players;
  }

  function label(key, v) {
    var def = TENDENCIES.filter(function (x) { return x.key === key; })[0];
    if (def && def.ends) {
      if (v >= 65) return 'Leans ' + def.ends[1];
      if (v <= 35) return 'Leans ' + def.ends[0];
      return 'Balanced';
    }
    return v >= 80 ? 'Constantly' : v >= 60 ? 'Often' : v >= 40 ? 'Sometimes' : v >= 20 ? 'Rarely' : 'Almost never';
  }

  /**
   * Engine-ready view of a player's tendencies.
   *  shots:      share of his field-goal attempts by zone (sums to 1)
   *  shotType:   catch-and-shoot share of his jumpers, deep-three share of his threes
   *  usage:      { passFirst (0..1, chance he moves the ball), iso, driveKick, pnrHandler, riskyPass, transition }
   *  defense:    { pressure, gamble, help, chargeDraw, crashGlass, boxOut } (0..1)
   *  situational: clutch usage multiplier, foul-trouble aggression multiplier (per foul count), hot / cold hand multiplier
   */
  function simProfile(p) {
    var x = p.tendencies || generate(p, 'default');
    function f(k) { return x[k] / 100; }
    var rim = 0.3 + f('rimAttack') * 0.8 + f('drive') * 0.4;
    var floater = 0.05 + f('floater') * 0.35;
    var post = 0.02 + f('postUp') * 0.9;
    var mid = 0.1 + f('midRange') * 0.6 * (1.2 - f('drive') * 0.4);
    var three = 0.03 + f('threePoint') * 1.4;
    var total = rim + floater + post + mid + three;
    return {
      shots: { rim: rim / total, floater: floater / total, post: post / total, mid: mid / total, three: three / total },
      shotType: { catchAndShoot: f('catchShoot'), deepThree: f('deepRange') * 0.35 },
      usage: { passFirst: 0.3 + f('passFirst') * 0.6, iso: f('iso') * 0.45, driveKick: f('driveKick') * 0.6, pnrHandler: f('pnrHandler'),
        riskyPass: f('riskyPass') * 0.3, transition: f('transition') },
      defense: { pressure: f('onBallPressure'), gamble: f('gamble') * 0.4, help: f('helpBlock') * 0.6, chargeDraw: f('chargeDraw') * 0.25,
        crashGlass: f('crashGlass') * 0.7, boxOut: f('boxOut') },
      situational: {
        clutchUsage: 0.7 + f('clutch') * 0.8,                                   // x0.7..1.5 in the final minutes
        foulTrouble: function (fouls) { return fouls < 3 ? 1 : Math.max(0.3, 1 - (fouls - 2) * f('foulCaution') * 0.25); },
        streak: function (madeInRow, missedInRow) { var h = f('hotHand'); return 1 + h * 0.15 * Math.min(4, madeInRow) - h * 0.1 * Math.min(4, missedInRow); }
      },
      flashyDunk: f('flashyDunk')
    };
  }

  // Play-by-play flavor for high-energy finishes (used by the game log)
  function flavor(p, kind, rng) {
    var x = p.tendencies || {};
    if ((x.flashyDunk || 0) < 55) return null;
    var name = p.lastName;
    var lines = kind === 'putback'
      ? [name + ' flies in for the putback slam!', name + ' tips it home with authority!', 'Offensive board — and ' + name + ' throws it down!']
      : [name + ' takes off from the dotted line — what a finish!', name + ' with the windmill on the break!', name + ' hammers it home in transition!'];
    var r = rng || Math.random;
    return lines[Math.floor((typeof r === 'function' ? r() : r.next()) * lines.length)];
  }

  return { GROUPS: GROUPS, TENDENCIES: TENDENCIES, KEYS: KEYS, generate: generate, addMissing: addMissing, isValid: isValid, label: label, simProfile: simProfile, flavor: flavor };
});
