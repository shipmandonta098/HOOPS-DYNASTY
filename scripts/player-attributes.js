/* ==========================================================================
   HOOPS DYNASTY — player attribute ratings (0–100)
   addAttributes(players, seed) gives every player without them:
     player.attributes = { agility, ballHandling, blocks, ... }   (20 keys)

   Built from what the player already is — never changes overall,
   potential, age or anything else:
   - position profile (point guards handle and pass, centers block and
     rebound, ...)
   - overall: attributes are shifted so the position-weighted skill average
     sits a little below the existing overall (a player's overall reflects
     his strengths, so not every skill is at that level)
   - height (within the position), weight (strength) and age (athleticism
     and durability decline after 30)
   - a seeded personal style (one or two strengths and a weakness)
   Seeded per dynasty + player, stored once in the save.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var node = typeof module === 'object' && module.exports;
  var api = factory(node ? require('./random.js') : root.HDRandom);
  if (node) module.exports = api;
  else root.HDPlayerAttributes = api;
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';

  // Display order is alphabetical (as listed by design); groups organise the profile.
  var ATTRIBUTES = Object.freeze([
    { key: 'agility',             label: 'Agility',               group: 'athleticism' },
    { key: 'ballHandling',        label: 'Ball Handling',         group: 'playmaking' },
    { key: 'blocks',              label: 'Blocks',                group: 'defense' },
    { key: 'defensiveRebounding', label: 'Defensive Rebounding',  group: 'rebounding' },
    { key: 'dunk',                label: 'Dunk',                  group: 'inside' },
    { key: 'durability',          label: 'Durability',            group: 'athleticism' },
    { key: 'freeThrow',           label: 'Free Throw',            group: 'outside' },
    { key: 'interiorDefense',     label: 'Interior Defense',      group: 'defense' },
    { key: 'layups',              label: 'Layups',                group: 'inside' },
    { key: 'lowPost',             label: 'Low Post',              group: 'inside' },
    { key: 'midRange',            label: 'Mid Range',             group: 'outside' },
    { key: 'offensiveRebounding', label: 'Offensive Rebounding',  group: 'rebounding' },
    { key: 'pass',                label: 'Pass',                  group: 'playmaking' },
    { key: 'perimeterDefense',    label: 'Perimeter Defense',     group: 'defense' },
    { key: 'speed',               label: 'Speed',                 group: 'athleticism' },
    { key: 'stamina',             label: 'Stamina',               group: 'athleticism' },
    { key: 'steal',               label: 'Steal',                 group: 'defense' },
    { key: 'strength',            label: 'Strength',              group: 'athleticism' },
    { key: 'threePoint',          label: 'Three Point',           group: 'outside' },
    { key: 'vertical',            label: 'Vertical',              group: 'athleticism' }
  ].map(Object.freeze));

  var GROUPS = Object.freeze([
    { id: 'inside',      label: 'Inside Scoring' },
    { id: 'outside',     label: 'Outside Scoring' },
    { id: 'playmaking',  label: 'Playmaking' },
    { id: 'defense',     label: 'Defense' },
    { id: 'rebounding',  label: 'Rebounding' },
    { id: 'athleticism', label: 'Athleticism' }
  ].map(Object.freeze));

  var KEYS = ATTRIBUTES.map(function (a) { return a.key; });
  // Not skills: excluded from the overall calibration
  var CONDITION = { durability: true, stamina: true };

  // Offsets from the player's overall, by position
  var PROFILE = {
    PG: { agility: 6, ballHandling: 10, blocks: -18, defensiveRebounding: -14, dunk: -8, freeThrow: 4, interiorDefense: -14, layups: 4, lowPost: -18, midRange: 2, offensiveRebounding: -16, pass: 10, perimeterDefense: 4, speed: 8, steal: 5, strength: -10, threePoint: 5, vertical: 0 },
    SG: { agility: 4, ballHandling: 4, blocks: -14, defensiveRebounding: -10, dunk: -2, freeThrow: 5, interiorDefense: -10, layups: 3, lowPost: -12, midRange: 5, offensiveRebounding: -12, pass: 1, perimeterDefense: 4, speed: 5, steal: 3, strength: -6, threePoint: 7, vertical: 2 },
    SF: { agility: 2, ballHandling: -2, blocks: -6, defensiveRebounding: -4, dunk: 3, freeThrow: 0, interiorDefense: -4, layups: 2, lowPost: -4, midRange: 2, offensiveRebounding: -5, pass: -2, perimeterDefense: 4, speed: 2, steal: 2, strength: 0, threePoint: 2, vertical: 3 },
    PF: { agility: -4, ballHandling: -10, blocks: 2, defensiveRebounding: 6, dunk: 4, freeThrow: -4, interiorDefense: 5, layups: 0, lowPost: 5, midRange: -2, offensiveRebounding: 5, pass: -6, perimeterDefense: -4, speed: -4, steal: -4, strength: 6, threePoint: -6, vertical: 0 },
    C:  { agility: -8, ballHandling: -16, blocks: 9, defensiveRebounding: 10, dunk: 6, freeThrow: -10, interiorDefense: 9, layups: -2, lowPost: 8, midRange: -8, offensiveRebounding: 9, pass: -9, perimeterDefense: -10, speed: -8, steal: -8, strength: 10, threePoint: -16, vertical: -2 }
  };
  var HEIGHT_MID = { PG: 74.5, SG: 77, SF: 79.5, PF: 81.5, C: 84 };
  var WEIGHT_MID = { PG: 190, SG: 200, SF: 215, PF: 232, C: 248 };
  var TALL = { blocks: 2, defensiveRebounding: 1.5, offensiveRebounding: 1.5, interiorDefense: 1, lowPost: 1, speed: -1.5, agility: -1.5, ballHandling: -1 };
  var ATHLETIC = ['agility', 'speed', 'vertical'];

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  var SPREAD = 1.5;        // how strongly position shapes the skills
  var BELOW = 6;           // weighted skill average = overall - BELOW

  // Position weight of each skill in the calibration (what the position relies on)
  function weightsFor(pos) {
    var prof = PROFILE[pos] || PROFILE.SF;
    var w = {};
    KEYS.forEach(function (k) { if (!CONDITION[k]) w[k] = 1 + Math.max(0, prof[k]) / 5; });
    return w;
  }

  function composite(attrs, pos) {
    var w = weightsFor(pos), sum = 0, total = 0;
    Object.keys(w).forEach(function (k) { sum += attrs[k] * w[k]; total += w[k]; });
    return sum / total;
  }

  function generateAttributes(player, seed) {
    var r = R.rng('attr:' + seed + ':' + player.id);
    var pos = PROFILE[player.position] ? player.position : 'SF';
    var prof = PROFILE[pos];
    var ovr = player.overall;
    var age = Number.isInteger(player.age) ? player.age : 26;
    var dh = Number.isFinite(player.heightIn) ? player.heightIn - HEIGHT_MID[pos] : 0;
    var dw = Number.isFinite(player.weightLb) ? player.weightLb - WEIGHT_MID[pos] : 0;
    var decline = Math.max(0, age - 29);

    // Personal style: two strengths, one weakness among the skills
    var skills = KEYS.filter(function (k) { return !CONDITION[k]; });
    var picks = r.shuffle(skills.slice());
    var style = {};
    style[picks[0]] = 8; style[picks[1]] = 5; style[picks[2]] = -8;

    var raw = {};
    KEYS.forEach(function (k) {
      if (CONDITION[k]) return;
      var v = ovr + prof[k] * SPREAD + (style[k] || 0) + r.normal() * 5 + (TALL[k] || 0) * dh;
      if (k === 'strength') v += dw * 0.25;
      if (ATHLETIC.indexOf(k) !== -1) v -= decline * 1.8;
      raw[k] = v;
    });
    // Shift skills so the position-weighted average equals the overall
    var shift = (ovr - BELOW) - composite(raw, pos);
    var out = {};
    skills.forEach(function (k) { out[k] = Math.round(clamp(raw[k] + shift, 25, 99)); });

    // Condition: stamina tracks quality a little; durability falls with age
    out.stamina = Math.round(clamp(62 + (ovr - 70) * 0.5 + r.normal() * 8 - decline * 1.2, 35, 99));
    out.durability = Math.round(clamp(78 + r.normal() * 10 - Math.max(0, age - 30) * 2.2, 30, 99));

    var ordered = {};
    KEYS.forEach(function (k) { ordered[k] = out[k]; });
    return ordered;
  }

  // Adds attributes to any player missing them (never overwrites)
  function addAttributes(players, seed) {
    (players || []).forEach(function (p) {
      if (p.attributes && KEYS.every(function (k) { return Number.isInteger(p.attributes[k]); })) return;
      p.attributes = generateAttributes(p, seed);
    });
    return players;
  }

  function isValid(attrs) {
    return !!attrs && typeof attrs === 'object' && KEYS.every(function (k) {
      return Number.isInteger(attrs[k]) && attrs[k] >= 0 && attrs[k] <= 100;
    });
  }

  return {
    ATTRIBUTES: ATTRIBUTES,
    GROUPS: GROUPS,
    KEYS: KEYS,
    generateAttributes: generateAttributes,
    addAttributes: addAttributes,
    composite: composite,
    isValid: isValid
  };
});
