/* ==========================================================================
   HOOPS DYNASTY — player rating generation configuration (single source)
   Every tunable number used by scripts/player-ratings.js lives here:
   overall / potential distribution targets, the overall-rating formula,
   positional attribute weights, archetypes, age curves, team talent
   allocation and draft-class targets.

   Targets are generation-balancing objectives, not quotas: leagues vary
   naturally, and existing players are never changed to meet them.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HDRatingConfig = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* --- 1. League overall distribution (per 450 players) ------------------- */
  // Bands are inclusive. Scaled to any league size. 100 is never generated.
  var OVERALL_BANDS = [
    { min: 95, max: 99, count: 3,   label: 'Generational superstars' },
    { min: 90, max: 94, count: 9,   label: 'Superstars' },
    { min: 85, max: 89, count: 23,  label: 'All-Star caliber' },
    { min: 80, max: 84, count: 45,  label: 'High-level starters' },
    { min: 75, max: 79, count: 72,  label: 'Quality starters' },
    { min: 70, max: 74, count: 108, label: 'Rotation players' },
    { min: 65, max: 69, count: 90,  label: 'Role players' },
    { min: 60, max: 64, count: 63,  label: 'Deep bench' },
    { min: 50, max: 59, count: 32,  label: 'Fringe professionals' },
    { min: 38, max: 49, count: 5,   label: 'Extremely raw prospects' }
  ];
  var OVERALL_REFERENCE_SIZE = 450;
  var MAX_GENERATED_OVERALL = 99;
  // Within a band, values lean toward its lower end (talent thins out upward)
  var BAND_SKEW = 1.35;

  /* --- 2. Potential distribution targets (share of league) ---------------- */
  var POTENTIAL_TARGETS = [
    { min: 95, max: 99, share: 0.01 },
    { min: 90, max: 94, share: 0.03 },
    { min: 85, max: 89, share: 0.07 },
    { min: 80, max: 84, share: 0.12 },
    { min: 75, max: 79, share: 0.18 },
    { min: 70, max: 74, share: 0.25 },
    { min: 65, max: 69, share: 0.20 },
    { min: 0,  max: 64, share: 0.14 }
  ];
  // Expected remaining growth (OVR points) by age; actual growth varies a lot
  var GROWTH_BY_AGE = { 18: 15, 19: 14, 20: 12, 21: 10, 22: 8, 23: 6, 24: 4.5, 25: 3, 26: 2, 27: 1, 28: 0.4 };
  var GROWTH_SPREAD = 0.6;          // log-normal spread of growth (variance by player)
  // Growth shrinks near the top: factor = clamp((99 - OVR) / HEADROOM_SCALE, MIN, MAX)
  var HEADROOM = { SCALE: 32, MIN: 0.2, MAX: 1.0 };
  var GROWTH_NOISE = 2.5;           // extra +/- points
  var GENERATIONAL_CHANCE = 0.004;  // young players with a rare ceiling jump
  var LATE_BLOOMER_CHANCE = 0.05;   // 24–27 year-olds with unexpected room to grow

  /* --- 3. Overall-rating formula ------------------------------------------- */
  // raw = BASE_SHARE * position-weighted mean + PEAK_SHARE * mean of the
  //       player's PEAK_COUNT best position-relevant attributes
  // overall = STRETCH * raw + OFFSET, clamped to 1–99, rounded.
  // The peak term values specialists; the weighted mean values two-way and
  // complete players; low-impact attributes carry little weight.
  var FORMULA = {
    BASE_SHARE: 0.6,
    PEAK_SHARE: 0.4,
    PEAK_COUNT: 5,
    PEAK_MIN_WEIGHT: 1,      // only attributes that matter at the position count as peaks
    STRETCH: 1.2,
    OFFSET: -14
  };

  // Positional attribute weights (durability is excluded: it describes
  // injury risk, not contribution).
  var POSITION_WEIGHTS = {
    PG: { ballHandling: 3, pass: 3, threePoint: 2.5, midRange: 2, layups: 1.5, freeThrow: 1, perimeterDefense: 2, steal: 1.5, speed: 1.5, agility: 1.5, dunk: 0.3, lowPost: 0.2, interiorDefense: 0.3, blocks: 0.3, offensiveRebounding: 0.3, defensiveRebounding: 0.6, strength: 0.5, vertical: 0.6, stamina: 0.4 },
    SG: { threePoint: 3, midRange: 2.5, ballHandling: 2, layups: 2, freeThrow: 1.2, pass: 1.2, perimeterDefense: 2, steal: 1.2, speed: 1.3, agility: 1.3, dunk: 0.8, vertical: 0.8, lowPost: 0.3, interiorDefense: 0.4, blocks: 0.4, offensiveRebounding: 0.4, defensiveRebounding: 0.7, strength: 0.6, stamina: 0.4 },
    SF: { threePoint: 2, midRange: 2, layups: 2, dunk: 1.2, perimeterDefense: 2.2, interiorDefense: 1, ballHandling: 1.2, pass: 1.2, defensiveRebounding: 1.2, offensiveRebounding: 0.6, strength: 1, agility: 1.2, speed: 1, vertical: 1, steal: 1, blocks: 0.8, freeThrow: 1, lowPost: 0.6, stamina: 0.4 },
    PF: { interiorDefense: 2.5, defensiveRebounding: 2.5, offensiveRebounding: 1.5, lowPost: 1.8, layups: 1.8, dunk: 1.5, blocks: 1.8, strength: 1.8, midRange: 1.2, threePoint: 1, perimeterDefense: 1, pass: 0.8, freeThrow: 0.6, ballHandling: 0.5, vertical: 1, agility: 0.6, speed: 0.6, steal: 0.6, stamina: 0.4 },
    C:  { interiorDefense: 3, blocks: 2.5, defensiveRebounding: 3, offensiveRebounding: 2, lowPost: 2, dunk: 1.8, layups: 1.5, strength: 2, vertical: 1, pass: 0.6, threePoint: 0.4, midRange: 0.6, freeThrow: 0.4, perimeterDefense: 0.5, ballHandling: 0.3, speed: 0.5, agility: 0.5, steal: 0.4, stamina: 0.4 }
  };

  /* --- 4. Attribute generation --------------------------------------------- */
  // Positional tendency (applied at POSITION_SHAPE strength), before archetype
  var POSITION_SHAPE = 0.7;
  var POSITION_PROFILE = {
    PG: { agility: 6, ballHandling: 10, blocks: -18, defensiveRebounding: -14, dunk: -8, freeThrow: 4, interiorDefense: -14, layups: 4, lowPost: -18, midRange: 2, offensiveRebounding: -16, pass: 10, perimeterDefense: 4, speed: 8, steal: 5, strength: -10, threePoint: 5, vertical: 0 },
    SG: { agility: 4, ballHandling: 4, blocks: -14, defensiveRebounding: -10, dunk: -2, freeThrow: 5, interiorDefense: -10, layups: 3, lowPost: -12, midRange: 5, offensiveRebounding: -12, pass: 1, perimeterDefense: 4, speed: 5, steal: 3, strength: -6, threePoint: 7, vertical: 2 },
    SF: { agility: 2, ballHandling: -2, blocks: -6, defensiveRebounding: -4, dunk: 3, freeThrow: 0, interiorDefense: -4, layups: 2, lowPost: -4, midRange: 2, offensiveRebounding: -5, pass: -2, perimeterDefense: 4, speed: 2, steal: 2, strength: 0, threePoint: 2, vertical: 3 },
    PF: { agility: -4, ballHandling: -10, blocks: 2, defensiveRebounding: 6, dunk: 4, freeThrow: -4, interiorDefense: 5, layups: 0, lowPost: 5, midRange: -2, offensiveRebounding: 5, pass: -6, perimeterDefense: -4, speed: -4, steal: -4, strength: 6, threePoint: -6, vertical: 0 },
    C:  { agility: -8, ballHandling: -16, blocks: 9, defensiveRebounding: 10, dunk: 6, freeThrow: -10, interiorDefense: 9, layups: -2, lowPost: 8, midRange: -8, offensiveRebounding: 9, pass: -9, perimeterDefense: -10, speed: -8, steal: -8, strength: 10, threePoint: -16, vertical: -2 }
  };
  var ATTRIBUTE_NOISE = 6;          // per-attribute variation (SD)
  var SIGNATURE = { strengths: 2, strengthMin: 5, strengthMax: 11, weaknesses: 1, weaknessMin: 6, weaknessMax: 13 };
  var HYBRID_CHANCE = 0.18;         // a second archetype blended in (35%)
  var HYBRID_BLEND = 0.35;
  var SURPRISE_CHANCE = 0.08;       // an unexpected elite skill (e.g. a center who shoots)
  var SURPRISE_MIN = 12, SURPRISE_MAX = 22;
  var ATTRIBUTE_MIN = 25, ATTRIBUTE_MAX = 99;
  // Height (inches from the position's midpoint) per attribute
  var HEIGHT_EFFECT = { blocks: 2, defensiveRebounding: 1.5, offensiveRebounding: 1.5, interiorDefense: 1, lowPost: 1, speed: -1.5, agility: -1.5, ballHandling: -1 };
  var HEIGHT_MID = { PG: 74.5, SG: 77, SF: 79.5, PF: 81.5, C: 84 };

  // Archetypes: offsets from the player's skill level. `fit` = how often
  // the archetype appears at each position (relative weights).
  var ARCHETYPES = [
    /* Guards */
    { id: 'floor-general', label: 'Floor General', group: 'guard', fit: { PG: 3, SG: 0.5 },
      offsets: { pass: 16, ballHandling: 12, threePoint: 2, midRange: 3, freeThrow: 4, steal: 4, speed: 4, agility: 4, dunk: -10, lowPost: -14, blocks: -14, strength: -6, vertical: -4 } },
    { id: 'playmaker', label: 'Playmaker', group: 'guard', fit: { PG: 2.5, SG: 1 },
      offsets: { pass: 12, ballHandling: 14, layups: 6, speed: 8, agility: 8, threePoint: -4, perimeterDefense: -4, dunk: -2 } },
    { id: 'three-point-specialist', label: 'Three-Point Specialist', group: 'guard', fit: { PG: 0.6, SG: 2.5 },
      offsets: { threePoint: 20, freeThrow: 12, midRange: 8, ballHandling: -4, pass: -6, layups: -6, dunk: -10, perimeterDefense: -8, interiorDefense: -12, strength: -8, steal: -4 } },
    { id: 'scoring-guard', label: 'Scoring Guard', group: 'guard', fit: { PG: 1, SG: 2.5 },
      offsets: { midRange: 12, threePoint: 8, layups: 8, freeThrow: 8, ballHandling: 6, pass: -6, perimeterDefense: -8, steal: -2 } },
    { id: 'slasher', label: 'Slasher', group: 'guard', fit: { PG: 0.8, SG: 1.8 },
      offsets: { layups: 16, dunk: 12, speed: 10, agility: 8, vertical: 10, ballHandling: 6, threePoint: -12, freeThrow: -6, midRange: -4 } },
    { id: 'defensive-guard', label: 'Defensive Guard', group: 'guard', fit: { PG: 1, SG: 1.5 },
      offsets: { perimeterDefense: 20, steal: 16, agility: 8, speed: 4, threePoint: -10, midRange: -10, layups: -6, ballHandling: -4, pass: -2, freeThrow: -6 } },
    { id: 'two-way-guard', label: 'Two-Way Guard', group: 'guard', fit: { PG: 1, SG: 1.6 },
      offsets: { perimeterDefense: 12, steal: 8, threePoint: 6, midRange: 6, ballHandling: 2, pass: -4, lowPost: -10, blocks: -8 } },
    { id: 'combo-guard', label: 'Combo Guard', group: 'guard', fit: { PG: 1.5, SG: 1.5 },
      offsets: { ballHandling: 8, pass: 6, threePoint: 6, midRange: 6, layups: 4, perimeterDefense: -4, interiorDefense: -10, blocks: -10 } },
    /* Wings */
    { id: 'three-and-d-wing', label: 'Three-and-D Wing', group: 'wing', fit: { SG: 0.8, SF: 2.5, PF: 0.6 },
      offsets: { threePoint: 16, perimeterDefense: 14, steal: 6, ballHandling: -8, pass: -8, lowPost: -10, layups: -2, dunk: -4 } },
    { id: 'shot-creator', label: 'Shot Creator', group: 'wing', fit: { SG: 1, SF: 2 },
      offsets: { midRange: 16, ballHandling: 12, threePoint: 8, freeThrow: 8, layups: 6, perimeterDefense: -10, defensiveRebounding: -6, blocks: -8 } },
    { id: 'athletic-finisher', label: 'Athletic Finisher', group: 'wing', fit: { SG: 0.6, SF: 2, PF: 1 },
      offsets: { dunk: 18, vertical: 16, layups: 10, speed: 8, agility: 6, threePoint: -12, freeThrow: -10, midRange: -8, pass: -4 } },
    { id: 'defensive-specialist', label: 'Defensive Specialist', group: 'wing', fit: { SG: 0.5, SF: 1.8, PF: 0.8 },
      offsets: { perimeterDefense: 18, interiorDefense: 8, steal: 10, blocks: 6, defensiveRebounding: 4, threePoint: -12, midRange: -12, ballHandling: -8, layups: -6, freeThrow: -8, pass: -6 } },
    { id: 'point-forward', label: 'Point Forward', group: 'wing', fit: { SF: 1.2, PF: 0.8 },
      offsets: { pass: 16, ballHandling: 12, defensiveRebounding: 4, threePoint: -6, blocks: -4, freeThrow: -4 } },
    { id: 'perimeter-scorer', label: 'Perimeter Scorer', group: 'wing', fit: { SG: 0.8, SF: 2 },
      offsets: { threePoint: 12, midRange: 12, freeThrow: 10, layups: 4, perimeterDefense: -10, interiorDefense: -8, defensiveRebounding: -6, strength: -4 } },
    { id: 'two-way-wing', label: 'Two-Way Wing', group: 'wing', fit: { SG: 0.6, SF: 1.8, PF: 0.6 },
      offsets: { perimeterDefense: 10, midRange: 6, threePoint: 6, layups: 4, steal: 4, pass: -6, lowPost: -6 } },
    { id: 'all-around-wing', label: 'All-Around Wing', group: 'wing', fit: { SF: 1, PF: 0.4 },
      offsets: { pass: 6, defensiveRebounding: 6, threePoint: 3, midRange: 3, layups: 3, perimeterDefense: 3, ballHandling: 2 } },
    /* Bigs */
    { id: 'rim-protector', label: 'Rim Protector', group: 'big', fit: { PF: 0.6, C: 2.5 },
      offsets: { blocks: 20, interiorDefense: 16, defensiveRebounding: 8, vertical: 6, threePoint: -18, midRange: -12, freeThrow: -12, ballHandling: -12, pass: -8, lowPost: -6 } },
    { id: 'rebounding-specialist', label: 'Rebounding Specialist', group: 'big', fit: { PF: 1.2, C: 1.8 },
      offsets: { offensiveRebounding: 20, defensiveRebounding: 20, strength: 10, threePoint: -16, midRange: -10, freeThrow: -10, ballHandling: -10, pass: -6, lowPost: -4 } },
    { id: 'interior-scorer', label: 'Interior Scorer', group: 'big', fit: { PF: 1.5, C: 1.5 },
      offsets: { layups: 12, lowPost: 14, dunk: 10, strength: 6, threePoint: -14, perimeterDefense: -10, blocks: -4, pass: -4 } },
    { id: 'stretch-big', label: 'Stretch Big', group: 'big', fit: { PF: 2, C: 0.8 },
      offsets: { threePoint: 18, midRange: 12, freeThrow: 12, interiorDefense: -8, blocks: -10, offensiveRebounding: -10, strength: -6, lowPost: -6, dunk: -6 } },
    { id: 'pick-and-roll-finisher', label: 'Pick-and-Roll Finisher', group: 'big', fit: { PF: 1, C: 1.8 },
      offsets: { dunk: 16, vertical: 10, layups: 8, offensiveRebounding: 8, speed: 4, threePoint: -16, midRange: -10, freeThrow: -10, lowPost: -6, pass: -8 } },
    { id: 'post-scorer', label: 'Post Scorer', group: 'big', fit: { PF: 1.2, C: 1.5 },
      offsets: { lowPost: 20, strength: 10, midRange: 6, layups: 6, freeThrow: 2, speed: -10, agility: -8, threePoint: -10, perimeterDefense: -12 } },
    { id: 'playmaking-big', label: 'Playmaking Big', group: 'big', fit: { PF: 0.8, C: 0.8 },
      offsets: { pass: 18, ballHandling: 8, midRange: 6, defensiveRebounding: 4, blocks: -6, dunk: -4, offensiveRebounding: -4, vertical: -6 } },
    { id: 'two-way-big', label: 'Two-Way Big', group: 'big', fit: { PF: 1.5, C: 1.2 },
      offsets: { interiorDefense: 10, blocks: 8, lowPost: 6, layups: 4, defensiveRebounding: 6, threePoint: -10, ballHandling: -10, freeThrow: -4 } }
  ];

  /* --- 5. Age and career stage --------------------------------------------- */
  // Age by overall tier: mean / SD; low tiers mix young prospects and veterans
  var AGE = {
    MIN: 19, MAX: 39,
    STAR: { minOverall: 85, mean: 27.3, sd: 3.0 },
    STARTER: { minOverall: 75, mean: 27, sd: 3.4 },
    ROTATION: { minOverall: 65, mean: 26.6, sd: 3.8 },
    BENCH_YOUNG: { share: 0.55, mean: 21.3, sd: 1.6 },
    BENCH_VETERAN: { mean: 31, sd: 3.2 },
    TEAM_SHIFT: { rebuilding: -2.2, veteran: 3, contender: 0.8 }
  };
  // Physical decline / technical growth with age (per year)
  var AGING = {
    ATHLETIC_FROM: 30, ATHLETIC_PER_YEAR: 1.6, ATHLETIC: ['speed', 'agility', 'vertical'],
    DURABILITY_FROM: 31, DURABILITY_PER_YEAR: 2,
    STAMINA_FROM: 32, STAMINA_PER_YEAR: 1.2,
    SKILL_FROM: 27, SKILL_PER_YEAR: 0.6, SKILL_MAX: 4, SKILL: ['pass', 'freeThrow', 'midRange']
  };

  /* --- 6. Team talent allocation ------------------------------------------- */
  // A team's talent outlook comes from its franchise strength (+ noise),
  // never its market. Values are handed out best first; better teams are
  // likelier to receive elite players, but nothing is guaranteed.
  var TEAMS = {
    STRENGTH_CENTER: 75, STRENGTH_SCALE: 6, STRENGTH_NOISE: 0.55,
    // pull of team strength for a player of overall v: lerp(LOW_PULL, HIGH_PULL)
    LOW_PULL: 0.15, HIGH_PULL: 1.25, PULL_FROM: 60, PULL_TO: 92,
    ELITE: 88, MAX_ELITE_PER_TEAM: 3,
    TYPES: {
      // weight multipliers per type: elite (>= ELITE), good (78..ELITE-1)
      'contender':   { elite: 1.6, good: 1.3 },
      'star-led':    { elite: 2.6, good: 0.85, firstEliteOnly: true },
      'deep':        { elite: 0.45, good: 1.6 },
      'middle':      { elite: 0.8, good: 1.1 },
      'veteran':     { elite: 1, good: 1.15 },
      'rebuilding':  { elite: 0.6, good: 0.7 },
      'poor':        { elite: 0.35, good: 0.6 }
    }
  };

  /* --- 7. Draft classes ------------------------------------------------------ */
  // Incoming rookies: their own distribution, far below established pros.
  var DRAFT = {
    SIZE: 60,
    QUALITY_SD: 1.6,            // class-to-class strength (points of overall)
    OVERALL_MEAN: 54, OVERALL_SD: 7,
    NBA_READY_CHANCE: 0.012,    // per prospect: rare 72+ day-one players
    AGE_WEIGHTS: { 19: 30, 20: 26, 21: 22, 22: 16, 23: 6 },
    POTENTIAL_GROWTH_MEAN: 13, POTENTIAL_GROWTH_SD: 8,
    GENERATIONAL_CHANCE: 0.002  // per prospect: rare 95+ ceiling jump
  };

  return {
    OVERALL_BANDS: OVERALL_BANDS,
    OVERALL_REFERENCE_SIZE: OVERALL_REFERENCE_SIZE,
    MAX_GENERATED_OVERALL: MAX_GENERATED_OVERALL,
    BAND_SKEW: BAND_SKEW,
    POTENTIAL_TARGETS: POTENTIAL_TARGETS,
    GROWTH_BY_AGE: GROWTH_BY_AGE,
    GROWTH_SPREAD: GROWTH_SPREAD,
    HEADROOM: HEADROOM,
    GROWTH_NOISE: GROWTH_NOISE,
    GENERATIONAL_CHANCE: GENERATIONAL_CHANCE,
    LATE_BLOOMER_CHANCE: LATE_BLOOMER_CHANCE,
    FORMULA: FORMULA,
    POSITION_WEIGHTS: POSITION_WEIGHTS,
    POSITION_SHAPE: POSITION_SHAPE,
    POSITION_PROFILE: POSITION_PROFILE,
    ATTRIBUTE_NOISE: ATTRIBUTE_NOISE,
    SIGNATURE: SIGNATURE,
    HYBRID_CHANCE: HYBRID_CHANCE,
    HYBRID_BLEND: HYBRID_BLEND,
    SURPRISE_CHANCE: SURPRISE_CHANCE,
    SURPRISE_MIN: SURPRISE_MIN,
    SURPRISE_MAX: SURPRISE_MAX,
    ATTRIBUTE_MIN: ATTRIBUTE_MIN,
    ATTRIBUTE_MAX: ATTRIBUTE_MAX,
    HEIGHT_EFFECT: HEIGHT_EFFECT,
    HEIGHT_MID: HEIGHT_MID,
    ARCHETYPES: ARCHETYPES,
    AGE: AGE,
    AGING: AGING,
    TEAMS: TEAMS,
    DRAFT: DRAFT
  };
});
