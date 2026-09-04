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
 * HOW THIS WORKS INSTEAD — the player is built, then the level is applied:
 *
 *   1. Each TEAM draws an archetype (contender, top-heavy, deep, young,
 *      veteran, rebuilding, balanced) which sets its mean talent, its spread,
 *      and its odds of rostering a star. Teams therefore differ in kind, not
 *      just in luck.
 *   2. Each team may draw a headline player from a rare star tier. These are
 *      PROBABILITIES, never quotas: nothing guarantees a league contains a 95+
 *      player, and most leagues do not.
 *   3. Each ROSTER SLOT draws a position and a target overall from that team's
 *      curve.
 *   4. The PLAYER is then built in the order a scout would describe him:
 *        position  ->  physical frame (height, weight)
 *                  ->  archetype compatible with that position and frame
 *                  ->  a full 23-attribute SHAPE from position + frame +
 *                      archetype + age + correlated individual variation
 *                  ->  a signature skill and/or a real hole
 *   5. Only then is the shape SHIFTED — as a block, every attribute by the
 *      same amount — until his position-weighted overall lands on the target.
 *      Shifting preserves every gap, which is the whole trick: it is what
 *      makes two 75s at the same position play nothing alike, and what lets an
 *      88 keep a genuine weakness instead of being 88 at everything.
 *   6. Potential is drawn afterwards from age and development room.
 *
 * The shape itself lives in playerArchetypes.js, which knows nothing about
 * levels. This file owns the arithmetic that puts a level on it.
 *
 * The result: overall is still derived from attributes (playerRatings.js owns
 * that definition), but the distribution and the shape are both controlled.
 */

import {
  ATTR_GROUPS, POSITION_WEIGHTS, overallFromCategories, groupScore,
} from './playerRatings.js';
import {
  ATTRS, POS_HEIGHT, POSITION_BASE, FACTORS,
  archetypesFor, archetypeById, frameMods, ageMods, classifyArchetype,
} from './playerArchetypes.js';

export { classifyArchetype, archetypeById };

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
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
 * 2. THE PHYSICAL FRAME
 * ---------------------------------------------------------------------------
 * Height and weight are generated HERE, before any skill, because they decide
 * what the rest of the player can plausibly be. They used to be drawn in
 * playerBio.js after the ratings existed, which meant a 7'0" player could be
 * quicker than a 6'1" one — the body was decoration.
 *
 * Most players are ordinary for their position. A small share are not, and
 * that is deliberate: the 6'8" point guard and the 6'7" centre are supposed to
 * exist, be rare, and still make sense, because the frame then feeds every
 * attribute through frameMods().
 * ======================================================================== */

/** Weight offset by position: a centre carries more than his height alone says. */
const POS_BUILD = { PG: -6, SG: -2, SF: +3, PF: +10, C: +18 };

// How far off the positional norm a body is allowed to get. Asymmetric on
// purpose: an oversized guard is a real archetype, a 5'8" two-guard is not.
const HEIGHT_RANGE = {
  PG: [69, 82], SG: [72, 84], SF: [74, 86], PF: [76, 88], C: [77, 90],
};

function makeFrame(rng, position) {
  const mean = POS_HEIGHT[position] || POS_HEIGHT.SF;
  let h = rng.gauss(mean, 2.0);
  // Unconventional bodies. Roughly one player in fourteen is meaningfully off
  // the standard for his spot — enough that a roster usually has one, not so
  // many that they stop being interesting.
  if (rng.next() < 0.07) h += (rng.next() < 0.5 ? -1 : 1) * (3 + rng.next() * 3);
  const [lo, hi] = HEIGHT_RANGE[position] || HEIGHT_RANGE.SF;
  const heightIn = clamp(Math.round(h), lo, hi);
  const weightLb = clamp(Math.round(
    heightIn * 4.7 - 150 + (POS_BUILD[position] || 0) + rng.gauss(0, 9)), 155, 330);
  return { heightIn, weightLb };
}

/**
 * Pick an archetype the player's position AND body can support. The frame is a
 * weight, not a gate: a 6'7" rim protector is unlikely and not impossible.
 */
function pickArchetype(rng, position, heightIn) {
  const options = archetypesFor(position, heightIn);
  if (!options.length) return archetypeById('all_around_wing');
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let r = rng.next() * total;
  for (const o of options) { r -= o.weight; if (r <= 0) return o.archetype; }
  return options[options.length - 1].archetype;
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
  18: [15.5, 6.2], 19: [14.0, 6.0], 20: [12.0, 5.5], 21: [10.0, 5.0], 22: [8.0, 4.5],
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

/** How hard the four correlated factors push, and how much noise sits on top. */
const FACTOR_SCALE = 6.0;
const IDIOSYNCRATIC = 4.5;

/* An archetype's strengths count for less than its weaknesses.
 *
 * That is not a nerf, it is what a weighted mean does. Overall is (roughly)
 * the average of a player's ratings, so a hole has to be PAID FOR by every
 * other rating rising. Give the profile symmetric peaks and troughs and the
 * shift lands the peaks absurdly high — two players in three ended up with a
 * 95+ rating, which makes 95 mean nothing.
 *
 * Asymmetry also matches how the game actually reads: a defensive centre is
 * defined far more by the 27 points he gives away on offence than by the 9 he
 * gains on defence. Specialists still reach the top of the scale, but they get
 * there through the signature spike below, which is the deliberate exception
 * rather than every player's default shape. */
const UPSIDE = 0.55;

/**
 * Every attribute as a delta around a neutral player: position + frame +
 * archetype + age + correlated individual variation.
 *
 * The correlated part matters as much as the archetype. Independent noise on
 * 23 ratings averages out into mush; four latent factors (explosiveness,
 * shooting touch, feel, physicality) loaded onto related attributes mean an
 * explosive player is explosive everywhere and a shooter shoots from
 * everywhere, while still never producing two identical numbers.
 */
function buildShape(rng, { position, heightIn, weightLb, archetype, age }) {
  const base = POSITION_BASE[position] || POSITION_BASE.SF;
  const frame = frameMods(position, heightIn, weightLb);
  const aged = ageMods(age);

  const factor = {};
  for (const k of Object.keys(FACTORS)) factor[k] = rng.gauss(0, 1);

  const shape = {};
  for (const attr of ATTRS) {
    const d = archetype.p[attr] || 0;
    let v = (base[attr] || 0) + (d > 0 ? d * UPSIDE : d)
          + (frame[attr] || 0) + (aged[attr] || 0);
    for (const [name, loads] of Object.entries(FACTORS)) {
      if (loads[attr]) v += factor[name] * loads[attr] * FACTOR_SCALE;
    }
    shape[attr] = v + rng.gauss(0, IDIOSYNCRATIC);
  }
  return shape;
}

/** Fisher-Yates against the seeded RNG. */
function shuffled(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Give the player a signature skill, a real hole, or both.
 *
 * This is what produces specialists. Because the shape is shifted onto the
 * target AFTERWARDS, a spike here does not make him better overall — it makes
 * him more lopsided at the same overall. A 69 with an 88 three-ball is a 69
 * precisely because the spike was paid for everywhere else, which is exactly
 * what a shooting specialist is.
 *
 * It also applies at the top of the league. An 88 who is elite at everything
 * should be rare, so most stars keep a genuine weakness; only the roughly one
 * player in twenty-five who comes back `complete` has his holes filled in.
 */
function applyIdentity(rng, shape, archetype) {
  const sig = archetype.sig || [];
  const holes = archetype.hole || [];
  const complete = rng.next() < 0.04;
  if (complete) {
    // The genuinely all-around player: no dug-out weakness, no outsized skill.
    for (const a of holes) shape[a] += 8;
    return { complete: true, signature: [] };
  }
  const signature = [];
  if (sig.length && rng.next() < 0.62) {
    const n = rng.next() < 0.25 ? 2 : 1;
    for (const a of shuffled(rng, sig).slice(0, n)) {
      shape[a] += Math.abs(rng.gauss(10, 4.5));
      signature.push(a);
    }
  }
  if (holes.length && rng.next() < 0.55) {
    const n = rng.next() < 0.3 ? 2 : 1;
    for (const a of shuffled(rng, holes).slice(0, n)) shape[a] -= Math.abs(rng.gauss(11, 5));
  }
  return { complete: false, signature };
}

/* Cap how far a STRENGTH can run, in shape space rather than in rating space.
 *
 * The first attempt compressed the top of the finished 0-99 scale, and it was
 * wrong in a way worth recording: at a 93 target the offset dominates, so
 * squashing everything above ~88 collapsed the whole player into the 90s. It
 * fixed the "everyone has a 95" problem by breaking a more important one —
 * stars came out elite at everything, which is precisely what the design says
 * must not happen.
 *
 * Softening the SHAPE instead leaves the level alone. A deviation of +12 above
 * his own weighted mean passes through almost untouched; +25 and +40 both
 * arrive near +18. So a 75 rim protector's block stops running to 97, a 93
 * slasher keeps his mediocre jumper, and the deep holes — which are never
 * softened, because a weakness should be free to be a real one — stay exactly
 * as deep as the archetype made them. */
const PEAK = 24;

/**
 * How far a strength may stand out, given how good the player already is.
 *
 * There is simply less room above 90 than above 70, so the cap shrinks with
 * the level. This is the honest version of what "elite players have relative
 * strengths, not gaping ones" means — and it is the opposite of flattening,
 * because only the PEAKS are capped. A star's weaknesses are never softened,
 * so an elite slasher keeps the mediocre jumper his archetype gave him instead
 * of being dragged up to 90 with everything else.
 */
function peakRoom(level) {
  return clamp(99 - level, 5, PEAK);
}

function softenPeak(d, room) {
  return d > 0 ? room * (1 - Math.exp(-d / room)) : d;
}

const HARD_FLOOR = 24;

/**
 * Realise a shape at a given additive offset.
 *
 * Deviations are measured against the shape's own position-weighted mean —
 * roughly "his own level" — so the softening acts on how far a strength stands
 * out, not on how good the player is.
 */
function realise(shape, offset, position) {
  const w = POSITION_WEIGHTS[position] || POSITION_WEIGHTS.SF;
  let sum = 0, wt = 0;
  for (const g of ATTR_GROUPS) {
    const per = w[g.key] / g.parts.length;
    for (const [a] of g.parts) { sum += shape[a] * per; wt += per; }
  }
  const mean = wt ? sum / wt : 0;
  const room = peakRoom(mean + offset);
  const attrs = {};
  for (const a of ATTRS) {
    attrs[a] = clamp(Math.round(mean + offset + softenPeak(shape[a] - mean, room)), HARD_FLOOR, 99);
  }
  return attrs;
}

/**
 * Slide the whole shape until the position-weighted overall hits `target`.
 *
 * ONE offset applied to EVERY attribute. That is the difference between this
 * and the previous generator, which scaled an archetype's deltas down as the
 * target rose and so flattened stars into 90-at-everything blobs. Shifting
 * preserves every gap at every level: the compression that does occur happens
 * only where an attribute actually hits 99 or 20, which is real arithmetic
 * rather than a fudge.
 */
function shiftToTarget(shape, position, target) {
  const ovrAt = (o) => overallFromCategories(
    Object.fromEntries(ATTR_GROUPS.map(
      (g) => [g.key, groupScore({ attributes: realise(shape, o, position) }, g)])),
    position);

  // Overall is non-decreasing in the offset, so bisection is exact.
  let lo = -60, hi = 200;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (ovrAt(mid) < target) lo = mid; else hi = mid;
  }
  const a = realise(shape, lo, position), b = realise(shape, hi, position);
  const errA = Math.abs(ovrAt(lo) - target), errB = Math.abs(ovrAt(hi) - target);
  return errA <= errB ? a : b;
}

/**
 * The position a player could also credibly play, or null.
 *
 * Derived, never rolled: it is the position OTHER than his own whose weighting
 * of his actual categories, penalised by how far his height sits from that
 * spot's norm, comes closest to his primary. That is why a 6'9" ball-handling
 * forward can come out SF/PG while a 6'9" rim runner cannot, and why most
 * players get an adjacent spot or nothing at all.
 */
export function secondaryPosition(attributes, heightIn, primary) {
  const cats = Object.fromEntries(
    ATTR_GROUPS.map((g) => [g.key, groupScore({ attributes }, g)]));
  const fit = {};
  for (const p of POSITIONS) {
    fit[p] = overallFromCategories(cats, p) - Math.abs(heightIn - POS_HEIGHT[p]) * 1.7;
  }
  const other = POSITIONS.filter((p) => p !== primary).sort((x, y) => fit[y] - fit[x])[0];
  return fit[other] >= fit[primary] - 2.2 ? other : null;
}

/**
 * One player at a target overall.
 * @returns {object} position, secondaryPosition, heightIn, weightLb, archetype,
 *   attributes, overall, potential, age, durability
 */
export function makeRatedPlayer(rng, { target, position, age, potBias = 1 }) {
  const { heightIn, weightLb } = makeFrame(rng, position);
  const archetype = pickArchetype(rng, position, heightIn);
  const shape = buildShape(rng, { position, heightIn, weightLb, archetype, age });
  applyIdentity(rng, shape, archetype);
  const attributes = shiftToTarget(shape, position, clamp(Math.round(target), 40, 99));

  // Overall is read back off the attributes rather than trusted from the
  // target, so the stored number always matches the stored skills.
  const overall = overallFromCategories(
    Object.fromEntries(ATTR_GROUPS.map((g) => [g.key, groupScore({ attributes }, g)])), position);

  return {
    position,
    secondaryPosition: secondaryPosition(attributes, heightIn, position),
    heightIn,
    weightLb,
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
export function rosterTargets(rng, archetypeKey, size, tuning = {}) {
  const a = TEAM_ARCHETYPES[archetypeKey] || TEAM_ARCHETYPES.balanced;
  const {
    meanShift = 0,            // Player Talent Level
    spreadScale = 1,          // Talent Variance
    generationalScale = 1,    // Generational Talent Frequency
  } = tuning;

  // Generational odds scale, and the weight comes off "no star at all" so the
  // rest of the tiers keep their shape. Still a probability: nothing here can
  // guarantee a league contains a 95+ player.
  const stars = { ...a.stars };
  if (generationalScale !== 1) {
    const extra = stars.generational * (generationalScale - 1);
    stars.generational += extra;
    stars.none = Math.max(0, stars.none - extra);
  }

  const tier = STAR_TIERS[pickWeighted(rng, stars)];
  const targets = [];

  let cap = 99;
  if (tier) {
    const star = rng.int(tier[0], tier[1]);
    targets.push(star);
    cap = star - 1;
  }
  const mean = a.mean + meanShift;
  const spread = a.spread * spreadScale;
  while (targets.length < size) {
    targets.push(clamp(Math.round(rng.gauss(mean, spread)), 40, cap));
  }
  return targets.sort((x, y) => y - x);
}

/**
 * A full roster for one team.
 * @param {object} rng    the league's seeded RNG
 * @param {string} archetypeKey  from pickTeamArchetype()
 * @param {number} size   how many players (14 leaves a roster spot open)
 */
export function makeRoster(rng, archetypeKey, size = 14, tuning = {}) {
  const a = TEAM_ARCHETYPES[archetypeKey] || TEAM_ARCHETYPES.balanced;
  const targets = rosterTargets(rng, archetypeKey, size, tuning);
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
      // Development Variance widens or narrows how far potential can sit
      // above current ability.
      potBias: a.potBias * (fringe ? 1.1 : 1) * (tuning.devVariance || 1),
    });
  });
}
