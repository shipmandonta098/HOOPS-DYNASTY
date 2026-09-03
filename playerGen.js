'use strict';

/**
 * playerGen.js — player generation and the talent curve.
 *
 * THE PROBLEM THIS REPLACES
 * The old generator drew all fourteen attributes from one gaussian per player,
 * so every player was a flat blob: a centre and a point guard differed only by
 * a small nudge on three attributes, and overall was the mean of everything.
 * Ratings carried no information — an 80 meant nothing because nobody was
 * shaped like anything.
 *
 * HOW THIS WORKS INSTEAD — the maths runs backwards from a target:
 *
 *   1. Each TEAM draws an archetype (contender, top-heavy, deep, young,
 *      veteran, rebuilding, balanced) which sets its mean talent, its spread,
 *      and its odds of rostering a star. Teams therefore differ in kind, not
 *      just in luck.
 *   2. Each team may draw a headline player from a rare star tier. These are
 *      PROBABILITIES, never quotas: nothing guarantees a league contains a 95+
 *      player, and most leagues do not.
 *   3. Each ROSTER SLOT draws a target overall from that team's curve.
 *   4. Each PLAYER draws a position archetype (rim protector, sharpshooter,
 *      floor general, ...) whose category deltas give him real strengths and
 *      real weaknesses.
 *   5. The five categories are shifted as a block until the position-weighted
 *      overall lands on the target, which preserves the archetype's shape.
 *   6. The fourteen stored attributes are drawn around their category with
 *      jitter, then corrected so each category score comes back to plan.
 *
 * The result: overall is still derived from attributes (playerRatings.js owns
 * that definition), but the distribution and the shape are both controlled.
 */

import {
  ATTR_GROUPS, POSITION_WEIGHTS, overallFromCategories, groupScore,
} from './playerRatings.js';

const CATS = ['phy', 'sho', 'ply', 'def', 'reb'];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ===========================================================================
 * 1. TEAM ARCHETYPES
 * ---------------------------------------------------------------------------
 * `mean`/`spread` shape the roster's talent draws. `stars` is a weighted table
 * over the headline-player tiers — read as probabilities, so a league's star
 * count varies run to run and can legitimately be zero at the top end.
 * `ageBias` shifts the roster older or younger; `potBias` widens or narrows
 * how much growth room the young players get.
 * ======================================================================== */
export const TEAM_ARCHETYPES = {
  contender:  { label: 'Contender',   weight: 12, mean: 73.5, spread: 5.4, ageBias:  +1, potBias: 0.9,
                stars: { generational: 0.020, superstar: 0.20, elite: 0.44, allstar: 0.24, none: 0.096 } },
  topHeavy:   { label: 'Top-Heavy',   weight: 12, mean: 68.6, spread: 8.4, ageBias:   0, potBias: 1.0,
                stars: { generational: 0.018, superstar: 0.19, elite: 0.40, allstar: 0.27, none: 0.122 } },
  deep:       { label: 'Deep',        weight: 14, mean: 72.8, spread: 3.6, ageBias:  +1, potBias: 0.9,
                stars: { generational: 0.001, superstar: 0.02, elite: 0.14, allstar: 0.40, none: 0.439 } },
  balanced:   { label: 'Balanced',    weight: 24, mean: 71.2, spread: 6.0, ageBias:   0, potBias: 1.0,
                stars: { generational: 0.004, superstar: 0.06, elite: 0.24, allstar: 0.36, none: 0.336 } },
  young:      { label: 'Young Core',  weight: 14, mean: 69.0, spread: 6.2, ageBias:  -4, potBias: 1.35,
                stars: { generational: 0.003, superstar: 0.04, elite: 0.16, allstar: 0.33, none: 0.467 } },
  veteran:    { label: 'Veteran',     weight: 14, mean: 71.4, spread: 5.6, ageBias:  +4, potBias: 0.6,
                stars: { generational: 0.002, superstar: 0.05, elite: 0.22, allstar: 0.36, none: 0.368 } },
  rebuilding: { label: 'Rebuilding',  weight: 10, mean: 66.4, spread: 6.6, ageBias:  -3, potBias: 1.45,
                stars: { generational: 0.000, superstar: 0.01, elite: 0.07, allstar: 0.22, none: 0.700 } },
};

/** Headline-player tiers. Ranges are inclusive. */
const STAR_TIERS = {
  generational: [95, 99],   // once in a generation; most leagues have none
  superstar:    [90, 94],
  elite:        [85, 89],
  allstar:      [80, 84],
  none:         null,       // the team's best player just comes off its curve
};

/** Weighted pick from an object of { key: weight }. */
function pickWeighted(rng, table) {
  const total = Object.values(table).reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  for (const [k, w] of Object.entries(table)) { r -= w; if (r <= 0) return k; }
  return Object.keys(table)[Object.keys(table).length - 1];
}

/**
 * Choose a team's archetype. Market size nudges the odds — a big market is a
 * little likelier to be built to win now, a small one to be rebuilding — but
 * it never decides: a small-market contender is entirely possible.
 */
export function pickTeamArchetype(rng, marketSize) {
  const table = {};
  for (const [k, a] of Object.entries(TEAM_ARCHETYPES)) table[k] = a.weight;
  if (marketSize === 'Very Large') { table.contender += 7; table.veteran += 3; table.rebuilding -= 5; }
  else if (marketSize === 'Large') { table.contender += 4; table.veteran += 2; table.rebuilding -= 3; }
  else if (marketSize === 'Small') { table.rebuilding += 5; table.young += 3; table.contender -= 5; }
  for (const k of Object.keys(table)) table[k] = Math.max(1, table[k]);
  return pickWeighted(rng, table);
}

/* ===========================================================================
 * 2. PLAYER ARCHETYPES
 * ---------------------------------------------------------------------------
 * Category deltas, in rating points, applied before the block is shifted onto
 * the target overall. They are what makes a 74 defensive centre look nothing
 * like a 74 scoring guard.
 * ======================================================================== */
export const ARCHETYPES = {
  PG: [
    { id: 'floor_general',  label: 'Floor General',   w: 3,
      d: { phy: -4, sho:  +1, ply: +14, def:  -3, reb:  -8 },
      a: { passingIQ: +8, ballHandling: +5, dunk: -14, postControl: -12, shotIQ: +5 } },
    { id: 'scoring_guard',  label: 'Scoring Guard',   w: 3,
      d: { phy:  +1, sho: +11, ply:  +4, def:  -8, reb:  -9 },
      a: { threePoint: +7, midRange: +6, layup: +4, postControl: -12, dunk: -6 } },
    { id: 'two_way_guard',  label: 'Two-Way Guard',   w: 2,
      d: { phy:  +4, sho:  +1, ply:  +6, def:  +9, reb:  -6 },
      a: { steal: +9, defensiveIQ: +7, postControl: -10, dunk: -6 } },
    { id: 'burst_athlete',  label: 'Burst Athlete',   w: 2,
      d: { phy: +13, sho:  -6, ply:  +5, def:  +2, reb:  -5 },
      a: { speed: +9, agility: +8, vertical: +7, threePoint: -14, midRange: -8, layup: +10, dunk: +8 } },
  ],
  SG: [
    { id: 'sharpshooter',   label: 'Sharpshooter',    w: 3,
      d: { phy:  -6, sho: +14, ply:  -2, def:  -7, reb:  -6 },
      a: { threePoint: +14, freeThrow: +10, shotIQ: +7, dunk: -16, postControl: -12, layup: -6 } },
    { id: 'three_and_d',    label: '3&D Wing',        w: 3,
      d: { phy:  +2, sho:  +5, ply: -10, def: +12, reb:  -3 },
      a: { threePoint: +12, perimeterDefense: +9, postControl: -12, midRange: -6 } },
    { id: 'slasher',        label: 'Slasher',         w: 2,
      d: { phy: +12, sho:  +2, ply:  +2, def:  -2, reb:  -2 },
      a: { speed: +8, vertical: +8, layup: +13, dunk: +11, threePoint: -15, midRange: -6 } },
    { id: 'combo_guard',    label: 'Combo Guard',     w: 2,
      d: { phy:  +1, sho:  +6, ply:  +8, def:  -6, reb:  -7 },
      a: { ballHandling: +7, midRange: +6, postControl: -11, dunk: -5 } },
  ],
  SF: [
    { id: 'wing_scorer',    label: 'Wing Scorer',     w: 3,
      d: { phy:  +5, sho: +10, ply:  +1, def:  -8, reb:  -6 },
      a: { midRange: +8, threePoint: +6, layup: +5, shotIQ: +5, postControl: -6 } },
    { id: 'defensive_wing', label: 'Defensive Wing',  w: 3,
      d: { phy:  +6, sho:  -7, ply:  -5, def: +14, reb:  +3 },
      a: { perimeterDefense: +9, defensiveIQ: +8, steal: +6, threePoint: -12, postControl: -8 } },
    { id: 'point_forward',  label: 'Point Forward',   w: 2,
      d: { phy:  -2, sho:  +2, ply: +14, def:  -4, reb:  +2 },
      a: { passing: +8, passingIQ: +8, dunk: -10, threePoint: -5 } },
    { id: 'finisher',       label: 'Athletic Finisher', w: 2,
      d: { phy: +14, sho:  -4, ply:  -3, def:  +3, reb:  +5 },
      a: { vertical: +11, strength: +7, dunk: +17, layup: +11, threePoint: -22, midRange: -12, freeThrow: -8 } },
  ],
  PF: [
    { id: 'stretch_four',   label: 'Stretch Four',    w: 3,
      d: { phy:  -6, sho: +13, ply:  +2, def:  -7, reb:  -4 },
      a: { threePoint: +16, midRange: +9, freeThrow: +8, dunk: -12, postControl: -8 } },
    { id: 'defensive_big',  label: 'Defensive Big',   w: 3,
      d: { phy:  +5, sho:  -9, ply:  -7, def: +13, reb: +10 },
      a: { interiorDefense: +9, block: +9, defensiveIQ: +6, threePoint: -18, midRange: -10 } },
    { id: 'rim_runner',     label: 'Rim Runner',      w: 2,
      d: { phy: +13, sho:  -6, ply:  -6, def:  +4, reb: +10 },
      a: { vertical: +10, strength: +8, dunk: +18, layup: +10, threePoint: -24, midRange: -14, freeThrow: -10 } },
    { id: 'face_up_four',   label: 'Face-Up Four',    w: 2,
      d: { phy:  +3, sho:  +7, ply:  +7, def:  -5, reb:  -2 },
      a: { midRange: +9, ballHandling: +7, postControl: -6 } },
  ],
  C: [
    { id: 'rim_protector',  label: 'Rim Protector',   w: 4,
      d: { phy:  +6, sho: -12, ply: -12, def: +14, reb: +13 },
      a: { block: +12, interiorDefense: +10, strength: +8, threePoint: -26, midRange: -16,
           freeThrow: -12, dunk: +9, layup: +6 } },
    { id: 'post_hub',       label: 'Post Hub',        w: 2,
      d: { phy:  +4, sho:  -4, ply:  +9, def:  +2, reb:  +9 },
      a: { postControl: +16, passing: +8, passingIQ: +8, strength: +7, threePoint: -18, speed: -8 } },
    { id: 'stretch_five',   label: 'Stretch Five',    w: 2,
      d: { phy:  -5, sho: +14, ply:  +1, def:  -4, reb:  +2 },
      a: { threePoint: +18, midRange: +10, freeThrow: +9, dunk: -12, strength: -6 } },
    { id: 'athletic_big',   label: 'Athletic Big',    w: 3,
      d: { phy: +14, sho:  -8, ply:  -8, def:  +8, reb: +11 },
      a: { vertical: +11, speed: +8, dunk: +16, layup: +8, threePoint: -24, midRange: -14, freeThrow: -9 } },
  ],
};

function pickArchetype(rng, position) {
  const list = ARCHETYPES[position] || ARCHETYPES.SF;
  const table = {};
  list.forEach((a, i) => { table[i] = a.w; });
  return list[Number(pickWeighted(rng, table))];
}

/* ===========================================================================
 * 3. AGE, POTENTIAL AND DECLINE
 * ======================================================================== */

/**
 * Growth room by age: how far above his current overall a player might still
 * reach. Younger means more room AND more uncertainty — the spread shrinks
 * with age, so a 19-year-old's ceiling is a guess and a 30-year-old's is not.
 * Past his peak a player has none: his potential is what he already is.
 */
const GROWTH = {
  19: [14.0, 6.0], 20: [12.0, 5.5], 21: [10.0, 5.0], 22: [8.0, 4.5],
  23: [6.5, 4.0],  24: [5.0, 3.5],  25: [3.5, 3.0],  26: [2.0, 2.5],
};

/**
 * Age, correlated with ability rather than drawn independently.
 *
 * Ability and age are not independent in a real league: the best players are
 * overwhelmingly in their prime, while the bottom of a roster is bimodal —
 * either a 20-year-old project or a 34-year-old hanging on. Drawing age
 * independently gave 23% of the league to teenagers and left almost no
 * gradient between a 20-year-old's ability and a 27-year-old's.
 *
 * The entry floor is hard (nobody is 18) but the exit is gradual, so the
 * veteran tail is stretched while the young tail is not.
 */
function drawAge(rng, ageBias, target) {
  let base;
  if (target >= 80) {
    base = rng.gauss(27.2, 3.0);                    // stars are in their prime
  } else if (target >= 70) {
    base = rng.gauss(26.6, 3.6);
  } else if (rng.next() < 0.45) {
    base = rng.gauss(21.6, 1.8);                    // developmental project
  } else {
    base = rng.gauss(30.4, 3.4);                    // fringe veteran
  }
  // Careers end by attrition rather than at a cliff, so stretch the old tail.
  if (base > 30) base = 30 + (base - 30) * 1.45;
  return clamp(Math.round(base + ageBias), 19, 38);
}

/**
 * A plausible ceiling, not a promise. Returns >= ovr, capped at 99.
 * `potBias` comes from the team archetype: a rebuilding roster's kids carry
 * more upside than a contender's end-of-bench veterans.
 */
function drawPotential(rng, ovr, age, potBias) {
  const g = GROWTH[age];
  if (!g) return Math.min(99, ovr + (rng.next() < 0.12 ? rng.int(1, 2) : 0));
  const room = Math.max(0, rng.gauss(g[0] * potBias, g[1]));
  // Players already near the ceiling have less headroom left than the raw
  // draw suggests, so high overalls compress.
  const headroom = (99 - ovr) / 30;
  return clamp(Math.round(ovr + room * Math.min(1, headroom)), ovr, 99);
}

/* ===========================================================================
 * 4. BUILDING ONE PLAYER
 * ======================================================================== */

/**
 * Shape five category scores for `archetype` and shift them as a block until
 * the position-weighted overall equals `target`. Shifting preserves the gaps
 * between categories, which is what the archetype actually is.
 */
function buildCategories(rng, target, position, archetype) {
  const w = POSITION_WEIGHTS[position] || POSITION_WEIGHTS.SF;

  // Near the ceiling an archetype physically cannot keep its full shape: at 95
  // overall, one category sitting 15 points low forces every other category to
  // ~99 to compensate. So the deltas are scaled to fit the headroom, which is
  // not a fudge — it is what the arithmetic of a weighted mean requires. Elite
  // players have relative strengths, not gaping holes.
  const dmax = Math.max(...CATS.map((c) => archetype.d[c]));
  const dmin = Math.min(...CATS.map((c) => archetype.d[c]));
  let k = 1;
  if (dmax > 0) k = Math.min(k, (97 - target) / dmax);
  if (dmin < 0) k = Math.min(k, (26 - target) / dmin);
  k = clamp(k, 0.35, 1);

  const scores = {};
  for (const c of CATS) scores[c] = target + archetype.d[c] * k + rng.gauss(0, 3.2 * k);

  // Converge onto the target. Correcting EVERY category by the gap was the bug
  // here: with one category pinned at 99 the others absorbed its share too and
  // overshot, which is how a Rim Runner ended up with 95 playmaking. Only
  // categories that can still move in the needed direction take the
  // correction, and the step is sized by their combined position weight so the
  // overall lands exactly.
  for (let i = 0; i < 8; i++) {
    const current = overallFromCategories(
      Object.fromEntries(CATS.map((c) => [c, Math.round(scores[c])])), position);
    const gap = target - current;
    if (gap === 0) break;
    const movable = CATS.filter((c) => (gap > 0 ? scores[c] < 99 : scores[c] > 22));
    const weight = movable.reduce((sum, c) => sum + w[c], 0);
    if (!movable.length || weight <= 0) break;
    const step = gap / weight;
    for (const c of movable) scores[c] = clamp(scores[c] + step, 22, 99);
  }
  for (const c of CATS) scores[c] = Math.round(clamp(scores[c], 22, 99));
  return scores;
}

/**
 * Spread each category across its attributes with jitter, then correct so the
 * weighted category score comes back to plan — texture inside a category
 * without moving the category itself.
 */
function buildAttributes(rng, scores, archetype) {
  const tilt = archetype.a || {};
  const attrs = {};
  for (const g of ATTR_GROUPS) {
    const target = scores[g.key];
    // The tilt is what separates two players with the SAME category score:
    // a rim runner and a stretch five can both sit at 70 Shooting, but one
    // gets there on dunks and layups and the other on threes. Without this,
    // bundling finishing and jump shooting into one category would flatten
    // exactly the distinction the categories are meant to expose.
    for (const [attr] of g.parts) {
      attrs[attr] = clamp(target + (tilt[attr] || 0) + rng.gauss(0, 5.5), 20, 99);
    }
    // Correct back onto the category score so the tilt reshapes the inside of
    // a category without moving the category itself.
    for (let i = 0; i < 4; i++) {
      const got = groupScore({ attributes: attrs }, g);
      const gap = target - got;
      if (gap === 0) break;
      const movable = g.parts.filter(([a]) => (gap > 0 ? attrs[a] < 99 : attrs[a] > 20));
      const weight = movable.reduce((sum, [, w]) => sum + w, 0);
      if (!movable.length || weight <= 0) break;
      const total = g.parts.reduce((sum, [, w]) => sum + w, 0);
      const step = (gap * total) / weight;
      for (const [a] of movable) attrs[a] = clamp(attrs[a] + step, 20, 99);
    }
    for (const [attr] of g.parts) attrs[attr] = Math.round(attrs[attr]);
  }
  return attrs;
}

/**
 * One player at a target overall.
 * @returns {object} { position, archetype, attributes, overall, potential, age, durability }
 */
export function makeRatedPlayer(rng, { target, position, age, potBias = 1 }) {
  const archetype = pickArchetype(rng, position);
  const scores = buildCategories(rng, clamp(Math.round(target), 40, 99), position, archetype);
  const attributes = buildAttributes(rng, scores, archetype);

  // Overall is read back off the attributes rather than trusted from the
  // target, so the stored number always matches the stored skills.
  const overall = overallFromCategories(
    Object.fromEntries(ATTR_GROUPS.map((g) => [g.key, groupScore({ attributes }, g)])), position);

  return {
    position,
    archetype: archetype.id,
    archetypeLabel: archetype.label,
    attributes,
    overall,
    potential: drawPotential(rng, overall, age, potBias),
    age,
    // Injury resistance. Stored for the season simulator to consume; nothing
    // reads it as a probability yet, so it is presented as a trait, not a risk.
    durability: clamp(Math.round(rng.gauss(74 - Math.max(0, age - 30) * 1.6, 13)), 25, 99),
  };
}

/* ===========================================================================
 * 5. BUILDING A ROSTER
 * ======================================================================== */

/** Positions for a 14-man roster: three at four spots, two at the fifth. */
function rosterPositions(rng) {
  const short = rng.pick(['PG', 'SG', 'SF', 'PF', 'C']);
  const out = [];
  for (const pos of ['PG', 'SG', 'SF', 'PF', 'C']) {
    for (let i = 0; i < (pos === short ? 2 : 3); i++) out.push(pos);
  }
  return out;
}

/**
 * Draw one team's target overalls, best first.
 *
 * The headline player is drawn from the archetype's star table when it hits;
 * otherwise the team's best is simply the top of its own curve. Everyone else
 * comes off that curve, capped just under the star so a top-heavy roster
 * really is top-heavy.
 */
export function rosterTargets(rng, archetypeKey, size) {
  const a = TEAM_ARCHETYPES[archetypeKey] || TEAM_ARCHETYPES.balanced;
  const tier = STAR_TIERS[pickWeighted(rng, a.stars)];
  const targets = [];

  let cap = 99;
  if (tier) {
    const star = rng.int(tier[0], tier[1]);
    targets.push(star);
    cap = star - 1;
  }
  while (targets.length < size) {
    targets.push(clamp(Math.round(rng.gauss(a.mean, a.spread)), 46, cap));
  }
  return targets.sort((x, y) => y - x);
}

/**
 * A full roster for one team.
 * @param {object} rng    the league's seeded RNG
 * @param {string} archetypeKey  from pickTeamArchetype()
 * @param {number} size   how many players (14 leaves a roster spot open)
 */
export function makeRoster(rng, archetypeKey, size = 14) {
  const a = TEAM_ARCHETYPES[archetypeKey] || TEAM_ARCHETYPES.balanced;
  const targets = rosterTargets(rng, archetypeKey, size);
  const positions = rosterPositions(rng);

  // Best players get the deepest positions on the chart, so the top of the
  // roster is spread across the floor instead of stacking at one spot.
  const order = positions.slice().sort(() => rng.next() - 0.5);

  return targets.map((target, i) => {
    // Deeper bench slots skew younger or older than the core: that is where
    // developmental projects and end-of-career veterans actually sit.
    const fringe = i >= size - 4;
    return makeRatedPlayer(rng, {
      target,
      position: order[i] || 'SF',
      age: drawAge(rng, a.ageBias, target),
      potBias: a.potBias * (fringe ? 1.1 : 1),
    });
  });
}
