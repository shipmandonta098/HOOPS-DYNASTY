'use strict';

/**
 * playerTendencies.js — what a player TRIES to do, as distinct from how well
 * he does it.
 *
 * An attribute is an ability: three-point 93 says the shot goes in. A tendency
 * is a behaviour probability: shootThree 79 says he takes it. Two players with
 * the same jumper can play nothing alike, and this is the layer that says so.
 *
 * THREE THINGS THIS IS NOT:
 *
 *   Not a rating. Nothing here is skill, and a high tendency is not a good
 *   thing — a low-percentage shooter with a high shootThree is a problem, and
 *   the table should be able to say that.
 *
 *   Not stored. Tendencies are a PURE FUNCTION of attributes, position and
 *   archetype, computed at render time. So they cannot drift out of step with
 *   the ratings, they follow a player as he develops, and there is nothing to
 *   migrate onto an old save.
 *
 *   Not part of Overall. computeOverall() reads `player.attributes` and
 *   nothing else, and this module writes no attribute, so the separation is
 *   structural rather than a promise — the same guarantee mental attributes
 *   and personality have.
 *
 * THE MAPPING is the caller's spec, implemented literally where it is explicit
 * and extended where it is not. Each rule of the form
 *
 *     MidRange >= 90  ->  shootMidRange 85-95
 *
 * becomes a two-piece linear map: the stated band above the threshold, and a
 * continuous slope below it, so a 89 mid-range shooter sits just under 85
 * instead of falling off a cliff the spec never intended. Where the spec is
 * silent — catch-and-shoot, pull-up, the pick-and-roll, the four defensive
 * tendencies — the formula is built from the attributes that actually drive
 * that behaviour and is documented at the point of use.
 */

/* ------------------------------------------------------------------ helpers */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Map v from [inLo, inHi] onto [outLo, outHi], clamped at both ends. */
function lerp(v, inLo, inHi, outLo, outHi) {
  if (!Number.isFinite(v)) return outLo;
  const t = clamp((v - inLo) / (inHi - inLo), 0, 1);
  return outLo + t * (outHi - outLo);
}

/**
 * A spec rule: at or above `threshold` the output runs across [bandLo, bandHi]
 * as the attribute runs to 99; below it the output falls continuously to
 * `floor` at `floorAt`. Continuous at the threshold by construction.
 */
function rule(v, threshold, bandLo, bandHi, floorAt, floor) {
  if (!Number.isFinite(v)) return floor;
  return v >= threshold
    ? lerp(v, threshold, 99, bandLo, bandHi)
    : lerp(v, floorAt, threshold, floor, bandLo);
}

const round = (v) => clamp(Math.round(v), 0, 100);

/**
 * A stated rule is a CONTRACT, and the modifiers must not break it.
 *
 * Every tendency the spec governs also picks up realism adjustments after the
 * mapping — vision pulling isolation down, discipline pulling gambles down,
 * crashing the glass trading against leaking out. Left unbounded those
 * adjustments walk a value straight out of the band the rule promised: a
 * 90-speed player came out at leakOut 46 against a stated 50-65, and iso,
 * pass and gambleSteals could all do the same.
 *
 * So a rule whose threshold is met records its band, every modifier is applied
 * on top, and the value is clamped back into that band at the end. The
 * adjustments still order players WITHIN the band, which is all they were ever
 * meant to do; they can no longer contradict the rule they are decorating.
 */
function bandOf(bands, key, v, threshold, lo, hi) {
  if (Number.isFinite(v) && v >= threshold) bands[key] = { lo, hi };
}

/**
 * Read an attribute regardless of which spelling or shape it arrives in.
 *
 * The game stores 23 flat attributes; the mapping spec groups them and uses
 * plurals for three of them (layups, steals, blocks). Both are accepted so the
 * same function serves the profile screen and a hand-written JSON payload.
 */
const ALIASES = {
  layup: ['layup', 'layups'],
  steal: ['steal', 'steals'],
  block: ['block', 'blocks'],
  threePoint: ['threePoint', 'three', '3pt'],
  midRange: ['midRange', 'mid'],
  postControl: ['postControl', 'postScoring', 'post'],
  defensiveRebound: ['defensiveRebound', 'defRebound'],
  offensiveRebound: ['offensiveRebound', 'offRebound'],
};

function flatten(input) {
  const src = (input && input.attributes) || input || {};
  const flat = {};
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === 'object') Object.assign(flat, v);   // grouped shape
    else flat[k] = v;
  }
  return flat;
}

/** One attribute, or null when the payload does not carry it. */
function attr(flat, key) {
  for (const name of (ALIASES[key] || [key])) {
    if (Number.isFinite(flat[name])) return flat[name];
  }
  return null;
}

/* ===========================================================================
 * ARCHETYPE AND POSITION
 * ---------------------------------------------------------------------------
 * The spec asks that tendencies "reflect realistic playstyle". Archetype IS
 * the playstyle, and the save already carries it, so it enters as a small
 * additive nudge AFTER the attribute mapping rather than as part of it. The
 * numbers are deliberately modest: a sharpshooter's archetype should tilt what
 * he does, not overrule what his ratings say he can do.
 *
 * A payload with no archetype (the raw JSON contract) skips this layer
 * entirely and gets the stated rules exactly.
 * ======================================================================== */
const ARCHETYPE_TILT = {
  floor_general:      { pass: +10, kickOutPass: +8, isoCreate: -8, shootThree: -4, postUp: -6 },
  scoring_guard:      { isoCreate: +8, pullUp: +8, pass: -8, kickOutPass: -5 },
  sharpshooter:       { catchAndShoot: +12, shootThree: +8, drive: -10, postUp: -8, isoCreate: -6 },
  slashing_guard:     { drive: +12, shootThree: -10, catchAndShoot: -8, leakOut: +6 },
  two_way_guard:      { perimeterPressure: +8, gambleSteals: +4 },
  defensive_specialist: { perimeterPressure: +12, gambleSteals: +6, shootThree: -8, isoCreate: -10 },
  combo_guard:        { pullUp: +5, pickAndRollBallHandler: +6 },
  three_and_d:        { catchAndShoot: +12, shootThree: +8, isoCreate: -14, pass: -8, perimeterPressure: +8 },
  shot_creator:       { isoCreate: +12, pullUp: +10, catchAndShoot: -8 },
  slashing_wing:      { drive: +12, shootThree: -10, leakOut: +6, crashBoards: +4 },
  two_way_wing:       { perimeterPressure: +6, catchAndShoot: +4 },
  point_forward:      { pass: +12, kickOutPass: +8, pickAndRollBallHandler: +8, postUp: -4 },
  defensive_stopper:  { perimeterPressure: +12, contestShots: +6, shootThree: -8, isoCreate: -10 },
  all_around_wing:    {},
  three_level_scorer: { pullUp: +8, isoCreate: +6, shootMidRange: +6 },
  stretch_four:       { catchAndShoot: +10, shootThree: +10, postUp: -12, crashBoards: -8 },
  interior_scorer:    { postUp: +14, shootThree: -12, crashBoards: +6, catchAndShoot: -8 },
  glass_cleaner:      { crashBoards: +14, shootThree: -12, postUp: -4, leakOut: -8 },
  rim_protector:      { paintDefense: +12, contestShots: +10, shootThree: -14, isoCreate: -10 },
  defensive_anchor:   { paintDefense: +12, contestShots: +8, gambleSteals: -6, shootThree: -10 },
  stretch_big:        { catchAndShoot: +12, shootThree: +12, postUp: -10, paintDefense: -6 },
  playmaking_big:     { pass: +14, kickOutPass: +10, postUp: +4 },
  athletic_finisher:  { drive: +10, crashBoards: +8, shootThree: -14, catchAndShoot: -10, leakOut: +6 },
  post_playmaker:     { postUp: +12, pass: +10, kickOutPass: +8 },
  traditional_center: { postUp: +12, crashBoards: +10, shootThree: -14, pickAndRollBallHandler: -10 },
  two_way_big:        { postUp: +6, paintDefense: +8, crashBoards: +6 },
};

/** Where a role naturally lives, before any of the above. */
const POSITION_TILT = {
  PG: { pickAndRollBallHandler: +12, pass: +6, postUp: -10, paintDefense: -10, crashBoards: -10, leakOut: +5 },
  SG: { catchAndShoot: +5, postUp: -8, paintDefense: -7, crashBoards: -7 },
  SF: {},
  PF: { postUp: +6, paintDefense: +7, crashBoards: +7, pickAndRollBallHandler: -8, leakOut: -4 },
  C:  { postUp: +10, paintDefense: +12, crashBoards: +10, pickAndRollBallHandler: -14, shootThree: -6, leakOut: -8 },
};

/* ===========================================================================
 * THE TENDENCIES
 * ======================================================================== */

/** Group headings and the copy that explains what each one means on the court. */
export const TENDENCY_GROUPS = [
  { key: 'offense', label: 'Offense', parts: [
    ['shootThree', 'Shoot Three', 'How often he looks for the three rather than a two.'],
    ['shootMidRange', 'Shoot Mid-Range', 'Willingness to take the pull-up two the defence gives him.'],
    ['drive', 'Drive', 'How readily he puts the ball on the floor and attacks the rim.'],
    ['postUp', 'Post Up', 'How often the offence goes to him on the block.'],
    ['catchAndShoot', 'Catch & Shoot', 'Shooting off the pass rather than off the dribble.'],
    ['pullUp', 'Pull Up', 'Shooting off the dribble rather than off the pass.'],
  ] },
  { key: 'playmaking', label: 'Playmaking', parts: [
    ['pass', 'Pass', 'How readily he gives the ball up rather than finishing the play himself.'],
    ['isoCreate', 'Iso Create', 'Creating his own shot one-on-one.'],
    ['pickAndRollBallHandler', 'Pick & Roll', 'How often he handles the ball in the screen game.'],
    ['kickOutPass', 'Kick Out', 'Finding the open shooter once the defence collapses.'],
  ] },
  { key: 'defense', label: 'Defense', parts: [
    ['perimeterPressure', 'Perimeter Pressure', 'How high he picks his man up and how hard he presses.'],
    ['paintDefense', 'Paint Defense', 'How much he commits to protecting the rim.'],
    ['gambleSteals', 'Gamble for Steals', 'Jumping passing lanes, at the cost of position.'],
    ['contestShots', 'Contest Shots', 'How often he goes up to challenge rather than staying down.'],
  ] },
  { key: 'rebounding', label: 'Rebounding', parts: [
    ['crashBoards', 'Crash the Boards', 'Attacking the glass rather than getting back.'],
    ['leakOut', 'Leak Out', 'Releasing early in transition rather than rebounding.'],
  ] },
];

/**
 * Attributes to tendencies.
 *
 * @param {object} input  a player, or `{ attributes: {...} }` in either the
 *   flat 23-attribute shape or the grouped shape the JSON contract uses.
 * @param {object} [opts] `{ position, archetype }`; both optional, and both
 *   are omitted by a raw JSON payload, which then gets the stated rules alone.
 * @returns {{ offense, playmaking, defense, rebounding }} every value 0-100.
 */
export function computeTendencies(input, opts = {}) {
  const a = flatten(input);
  const position = opts.position || (input && input.position) || null;
  const archetype = opts.archetype || (input && input.archetype) || null;

  const g = (k) => attr(a, k);
  const or = (v, fallback) => (v == null ? fallback : v);

  const threePoint = or(g('threePoint'), 50);
  const midRange = or(g('midRange'), 50);
  const layup = or(g('layup'), 50);
  const dunk = or(g('dunk'), 50);
  const freeThrow = or(g('freeThrow'), 50);
  const shotIQ = or(g('shotIQ'), 50);
  const postControl = g('postControl');            // may genuinely be absent
  const ballHandling = or(g('ballHandling'), 50);
  const passing = or(g('passing'), 50);
  const passingIQ = or(g('passingIQ'), 50);
  const perimeterDefense = or(g('perimeterDefense'), 50);
  const interiorDefense = or(g('interiorDefense'), 50);
  const steal = or(g('steal'), 50);
  const block = or(g('block'), 50);
  const defensiveIQ = or(g('defensiveIQ'), 50);
  const speed = or(g('speed'), 50);
  const agility = or(g('agility'), speed);
  const strength = or(g('strength'), 50);
  const vertical = or(g('vertical'), 50);
  const oreb = or(g('offensiveRebound'), 50);
  const dreb = or(g('defensiveRebound'), 50);

  const t = {};
  const bands = {};

  /* ------------------------------- offense ------------------------------ */
  // Spec: ThreePoint >= 90 -> 75-90.
  t.shootThree = rule(threePoint, 90, 75, 90, 40, 8);
  bandOf(bands, 'shootThree', threePoint, 90, 75, 90);

  // Spec: MidRange >= 90 -> 85-95.
  t.shootMidRange = rule(midRange, 90, 85, 95, 40, 10);
  bandOf(bands, 'shootMidRange', midRange, 90, 85, 95);

  // Spec: Layups + Speed >= 180 -> 65-80, then Dunk <= 70 -> reduce by 10.
  //
  // Taken literally, including the step. An earlier version tapered the
  // penalty out between 70 and 78 to avoid a ten-point behaviour swing on a
  // one-point rating difference — which is a real modelling wart — but that
  // smoothing quietly broke the stated rule for every player with a dunk of
  // 71 to 77, in a range nobody would think to check. A stated rule is a
  // contract; a wart in it is the caller's to decide about, not mine to paper
  // over. The cliff is at 70/71 and it is worth knowing about.
  const dunkPenalty = dunk <= 70 ? 10 : 0;
  t.drive = rule(layup + speed, 180, 65, 80, 100, 10) - dunkPenalty;
  bandOf(bands, 'drive', layup + speed, 180, 65 - dunkPenalty, 80);

  // Spec: PostControl >= 85 -> 35-55. A payload with no post rating gets the
  // floor rather than a guess: not posting up is the safe reading of silence.
  t.postUp = postControl == null ? 6 : rule(postControl, 85, 35, 55, 30, 3);
  t.postUp += lerp(strength, 60, 99, 0, 8);
  if (postControl != null) bandOf(bands, 'postUp', postControl, 85, 35, 55);

  // Not in the spec. Shooting off the pass is a jumper plus off-ball feel; a
  // heavy ball-handler creates his own instead of spotting up, so the handle
  // pulls this DOWN even though it is a strength.
  t.catchAndShoot = lerp(0.5 * threePoint + 0.3 * shotIQ + 0.2 * freeThrow, 40, 99, 12, 88);
  t.catchAndShoot -= lerp(ballHandling, 70, 99, 0, 18);

  // Not in the spec, and the mirror image: off the dribble rather than off the
  // pass, so the handle pushes this one UP.
  t.pullUp = lerp(0.45 * midRange + 0.4 * ballHandling + 0.15 * shotIQ, 40, 99, 6, 90);

  /* ----------------------------- playmaking ----------------------------- */
  // Spec: Passing >= 80 -> 55-70.
  t.pass = rule(passing, 80, 55, 70, 30, 8);
  t.pass += lerp(passingIQ, 60, 99, -3, 8);
  bandOf(bands, 'pass', passing, 80, 55, 70);

  // Spec: BallHandling >= 90 -> 80-90. Vision pulls it back: a player who sees
  // the floor gives it up rather than grinding out an isolation.
  t.isoCreate = rule(ballHandling, 90, 80, 90, 40, 8);
  t.isoCreate -= lerp(passingIQ, 70, 99, 0, 10);
  bandOf(bands, 'isoCreate', ballHandling, 90, 80, 90);

  // Not in the spec: handling the ball in the screen game needs the handle,
  // the read and something to shoot with once the coverage commits.
  t.pickAndRollBallHandler =
    lerp(0.4 * ballHandling + 0.35 * passingIQ + 0.25 * midRange, 40, 99, 5, 90);

  // Not in the spec: vision plus the drives that create the kick in the first
  // place, so it is fed by the drive tendency computed above.
  t.kickOutPass = lerp(0.55 * passingIQ + 0.45 * passing, 35, 99, 8, 82);
  t.kickOutPass += clamp(t.drive, 0, 100) * 0.1;

  /* ------------------------------- defense ------------------------------ */
  // Not in the spec: how high he picks up and how hard he presses needs both
  // the ability to stay in front and the feet to recover.
  t.perimeterPressure = lerp(0.55 * perimeterDefense + 0.25 * agility + 0.2 * speed,
    40, 99, 8, 90);

  // Not in the spec: committing to the rim rather than staying with his man.
  t.paintDefense = lerp(0.45 * interiorDefense + 0.3 * block + 0.25 * strength,
    35, 99, 5, 92);

  // Spec: Steals >= 80 -> 60-75. Discipline cuts it: a defender who reads the
  // play does not need to jump the lane, which is the difference between a
  // good defender and a busy one.
  t.gambleSteals = rule(steal, 80, 60, 75, 30, 6);
  t.gambleSteals -= lerp(defensiveIQ, 70, 99, 0, 14);
  bandOf(bands, 'gambleSteals', steal, 80, 60, 75);

  // Not in the spec: going up to challenge rather than staying down.
  t.contestShots = lerp(0.35 * block + 0.3 * interiorDefense + 0.2 * defensiveIQ
    + 0.15 * vertical, 35, 99, 10, 92);

  /* ----------------------------- rebounding ----------------------------- */
  // Spec: Rebounding >= 85 -> 60-75. Weighted toward the offensive glass,
  // because crashing is the behaviour the defensive board does not require.
  const rebound = 0.6 * oreb + 0.4 * dreb;
  t.crashBoards = rule(rebound, 85, 60, 75, 30, 5);
  bandOf(bands, 'crashBoards', rebound, 85, 60, 75);

  // Spec: Speed >= 90 -> 50-65. In direct tension with crashing — a player
  // cannot release early and hit the offensive glass on the same possession —
  // so the two trade against each other.
  t.leakOut = rule(speed, 90, 50, 65, 40, 5);
  t.leakOut -= lerp(t.crashBoards, 50, 90, 0, 16);
  bandOf(bands, 'leakOut', speed, 90, 50, 65);

  /* -------------------------- playstyle tilts --------------------------- */
  for (const table of [POSITION_TILT[position], ARCHETYPE_TILT[archetype]]) {
    if (!table) continue;
    for (const [k, d] of Object.entries(table)) t[k] = (t[k] || 0) + d;
  }

  // Last, and after the tilts as well: a stated rule holds no matter what was
  // layered on top of it.
  for (const [k, b] of Object.entries(bands)) t[k] = clamp(t[k], b.lo, b.hi);

  return {
    offense: {
      shootThree: round(t.shootThree),
      shootMidRange: round(t.shootMidRange),
      drive: round(t.drive),
      postUp: round(t.postUp),
      catchAndShoot: round(t.catchAndShoot),
      pullUp: round(t.pullUp),
    },
    playmaking: {
      pass: round(t.pass),
      isoCreate: round(t.isoCreate),
      pickAndRollBallHandler: round(t.pickAndRollBallHandler),
      kickOutPass: round(t.kickOutPass),
    },
    defense: {
      perimeterPressure: round(t.perimeterPressure),
      paintDefense: round(t.paintDefense),
      gambleSteals: round(t.gambleSteals),
      contestShots: round(t.contestShots),
    },
    rebounding: {
      crashBoards: round(t.crashBoards),
      leakOut: round(t.leakOut),
    },
  };
}

/** Band for the bar colour. A tendency is behaviour, so this is frequency, not quality. */
export function tendencyBand(v) {
  if (v >= 75) return 'very-high';
  if (v >= 55) return 'high';
  if (v >= 35) return 'medium';
  if (v >= 18) return 'low';
  return 'very-low';
}

export const TENDENCY_BAND_LABEL = {
  'very-high': 'Very High', high: 'High', medium: 'Medium', low: 'Low', 'very-low': 'Very Low',
};

/** The two or three habits that most define how he plays. */
export function tendencySummary(t) {
  if (!t) return null;
  const all = [];
  for (const g of TENDENCY_GROUPS) {
    for (const [key, label] of g.parts) all.push({ key, label, v: t[g.key][key] });
  }
  const top = all.slice().sort((x, y) => y.v - x.v).slice(0, 3);
  const bottom = all.slice().sort((x, y) => x.v - y.v)[0];
  if (top[0].v < 25) return 'No pronounced habits in any area.';
  return `Leans hardest on ${top.map((x) => x.label.toLowerCase()).join(', ')};`
    + ` least inclined to ${bottom.label.toLowerCase()}.`;
}

/* ===========================================================================
 * MENTAL AND PERSONALITY BIAS
 * ---------------------------------------------------------------------------
 * The first time either layer influences ANYTHING, and it is worth being
 * precise about why that is consistent rather than a reversal.
 *
 * The standing rule is that mental attributes and personality never affect
 * Overall or Potential. They still do not: this module reads them and writes
 * tendencies, tendencies are derived rather than stored, and computeOverall()
 * reads `attributes` alone. What mental and personality touch here is
 * BEHAVIOUR, which is exactly what they are for — a confident player taking
 * more pull-ups is not a better player, he is a different one. Ability is
 * untouched; only the habits move.
 *
 * SITUATION IS NOT BASELINE. Five of the supplied rules are conditional on
 * game state — trailing by more than ten, a playoff game, late in a game,
 * immediately after a miss. None of that state exists yet, and folding those
 * rules into the profile's numbers would print a losing-by-ten-in-the-playoffs
 * tendency as though it were how the player normally plays. So a bias declares
 * the situation it belongs to, the profile shows the base one, and the others
 * are computed on demand for a simulator that knows the score.
 *
 * VOLATILITY IS NOT A LEVEL. "Stabilise tendencies after misses" and "no
 * tendency spikes under pressure" describe the SPREAD of a player's behaviour
 * around his tendency, not the tendency itself. Nudging a displayed number
 * would be answering a different question, so those two produce coefficients
 * for the simulator to read when one exists, and are reported as stability
 * rather than as a habit.
 *
 * ON THE MAGNITUDES: rules 1 and 2 are written as points ("+5 to pullUp")
 * while rule 3 specifies the mechanism as `base x (1 + bias)`. Rule 3 is the
 * only statement about HOW, so it wins: "+5" is read as +5%, which also scales
 * the nudge with the propensity it is nudging. Switching to flat points is a
 * one-line change if that was the intent.
 * ======================================================================== */

/** The situations a bias can belong to. `base` is always on. */
export const SITUATIONS = [
  { id: 'base', label: 'Any Situation' },
  { id: 'lateGame', label: 'Late Game' },
  { id: 'trailing', label: 'Trailing by 10+' },
  { id: 'playoffs', label: 'Playoffs' },
];

const DEFENSIVE = ['perimeterPressure', 'paintDefense', 'gambleSteals', 'contestShots'];

/** Flatten the grouped tendency object to { key: value }. */
function flat(t) {
  const out = {};
  for (const g of TENDENCY_GROUPS) for (const [k] of g.parts) out[k] = t[g.key][k];
  return out;
}

/** Rebuild the grouped shape from a flat map. */
function group(m) {
  const out = {};
  for (const g of TENDENCY_GROUPS) {
    out[g.key] = {};
    for (const [k] of g.parts) out[g.key][k] = round(m[k]);
  }
  return out;
}

/**
 * A team's playing style, DERIVED from what its roster actually does.
 *
 * The coachability rule says to align a player with the team system and gives
 * pace-and-space as an example. No such field exists, and hard-coding the
 * example would assert that every team plays that way. Instead the system is
 * read off the roster's own mean tendencies, which is real stored data, and
 * alignment pulls the player toward those means — so a team of shooters
 * produces the rule's example on its own rather than by assumption.
 *
 * @param {Array} roster players on the team
 * @returns {{ label: string, means: object }|null} null for an unknown roster
 */
export function teamSystem(roster) {
  const players = (roster || []).filter((p) => p && p.attributes);
  if (players.length < 3) return null;
  const sums = {};
  for (const p of players) {
    const f = flat(computeTendencies(p, { position: p.position, archetype: p.archetype }));
    for (const [k, v] of Object.entries(f)) sums[k] = (sums[k] || 0) + v;
  }
  const means = {};
  for (const [k, v] of Object.entries(sums)) means[k] = v / players.length;
  const label = means.shootThree >= 55 && means.postUp <= 35 ? 'Pace and Space'
    : means.postUp >= 45 ? 'Inside-Out'
    : means.pass >= 55 ? 'Ball Movement'
    : 'Balanced';
  return { label, means };
}

const LEVEL_RANK = { very_low: 0, low: 1, medium: 2, high: 3, very_high: 4 };

/** A priority's level, from either the stored 0-100 number or a written label. */
function priorityRank(priorities, key) {
  const v = priorities ? priorities[key] : undefined;
  if (Number.isFinite(v)) return LEVEL_RANK[priorityLevelKey(v)];
  if (typeof v === 'string') {
    const k = v.toLowerCase().replace(/[\s-]+/g, '_');
    return LEVEL_RANK[k] != null ? LEVEL_RANK[k] : null;
  }
  return null;
}

/** Mirrors playerPersonality.priorityLevel without importing it, to stay dependency-free. */
function priorityLevelKey(v) {
  if (v >= 80) return 'very_high';
  if (v >= 63) return 'high';
  if (v >= 42) return 'medium';
  if (v >= 25) return 'low';
  return 'very_low';
}

/** Traits arrive as stored ids, or as the labels a hand-written payload uses. */
function hasTrait(traits, id, label) {
  if (!Array.isArray(traits)) return false;
  return traits.some((t) => {
    const s = String(t).toLowerCase().replace(/[\s-]+/g, '_');
    return s === id || s === String(label).toLowerCase().replace(/[\s-]+/g, '_');
  });
}

/**
 * Apply the mental and personality biases to a set of base tendencies.
 *
 * @param {object} base      grouped tendencies from computeTendencies()
 * @param {object} player    the player, or `{ mental, personality }`
 * @param {object} [opts]    `{ situation, roster }`
 *   situation  one of SITUATIONS[].id; defaults to 'base', which applies only
 *              the unconditional biases.
 *   roster     the player's teammates, for the coachability alignment. Absent,
 *              that rule is a documented no-op rather than a guess.
 * @returns {{ tendencies, biasSummary, volatility, applied }}
 */
export function applyBias(base, player, opts = {}) {
  const situation = opts.situation || 'base';
  const mental = (player && player.mental) || {};
  const per = (player && player.personality) || {};
  const traits = per.traits;
  const priorities = per.priorities || per.careerPriorities;

  const m = flat(base);
  const pct = {};              // key -> total proportional bias
  const applied = [];          // human-readable record of what fired

  const num = (v) => (Number.isFinite(v) ? v : null);
  const resilience = num(mental.resilience);

  // "Reduce negative modifiers by 10%" means each NEGATIVE MODIFIER, so the
  // damping has to happen as each one is added. Applying it to the summed bias
  // instead — which only bites when the total happens to come out negative —
  // is a different rule, and it left resilience doing nothing at all for any
  // player whose positives outweighed his negatives, which is most of them.
  const dampsNegatives = resilience != null && resilience > 80;

  const add = (keys, amount, why, when = 'base') => {
    if (when !== 'base' && when !== situation) {
      applied.push({ why, amount, when, active: false });
      return;
    }
    const value = amount < 0 && dampsNegatives ? amount * 0.9 : amount;
    for (const k of [].concat(keys)) pct[k] = (pct[k] || 0) + value;
    applied.push({ why, amount: value, when, active: true, keys: [].concat(keys) });
  };

  const concentration = num(mental.concentration);
  const confidence = num(mental.confidence);
  const composure = num(mental.composure);
  const coachability = num(mental.coachability);

  /* ------------------------------- mental ------------------------------- */
  // Confidence > 70 -> boost shot creation. Unconditional.
  if (confidence != null && confidence > 70) {
    add(['pullUp', 'isoCreate'], 0.05, 'Confidence above 70 boosts shot creation');
  }
  // Concentration < 70 -> late-game lapses. Conditional on the situation.
  if (concentration != null && concentration < 70) {
    add(['pass'], -0.05, 'Concentration below 70 costs late-game decisions', 'lateGame');
    add(DEFENSIVE, -0.05, 'Concentration below 70 costs late-game defence', 'lateGame');
  }

  /* ----------------------------- personality ---------------------------- */
  if (hasTrait(traits, 'opportunity_seeking', 'Opportunity-Seeking')) {
    add(['isoCreate'], 0.10, 'Opportunity-Seeking looks for his own shot');
    add(['drive'], 0.05, 'Opportunity-Seeking attacks the gap');
  }
  if (hasTrait(traits, 'competitive', 'Competitive')) {
    add(['shootThree', 'drive'], 0.10, 'Competitive presses when the game is getting away', 'trailing');
  }
  const contention = priorityRank(priorities, 'contention');
  const winning = priorityRank(priorities, 'winning');
  if (contention === 4 || winning === 4) {
    add(['pass'], 0.05, 'Championship and winning priorities move the ball in the playoffs', 'playoffs');
    add(['isoCreate'], -0.05, 'Championship and winning priorities cut isolation in the playoffs', 'playoffs');
  }
  const chemistry = priorityRank(priorities, 'chemistry');
  if (chemistry != null && chemistry >= 3) {
    add(['pass'], 0.05, 'Team Chemistry priority moves the ball');
    add(['isoCreate'], -0.05, 'Team Chemistry priority cuts isolation');
  }

  /* ------------- coachability aligns him with the team's system --------- */
  const system = opts.roster ? teamSystem(opts.roster) : null;
  if (coachability != null && coachability > 95 && system) {
    // Pull 5% of the way toward what this roster actually does.
    for (const [k, mean] of Object.entries(system.means)) {
      m[k] = m[k] + (mean - m[k]) * 0.05;
    }
    applied.push({ why: `Coachability above 95 aligns him with a ${system.label} system`,
      amount: 0.05, when: 'base', active: true, keys: Object.keys(system.means) });
  }

  /* --------------------------- rule 3: apply ---------------------------- */
  const out = {};
  for (const [k, v] of Object.entries(m)) out[k] = v * (1 + (pct[k] || 0));

  /* ------------------------------ volatility ---------------------------- */
  // Spread, not level. Nothing consumes these yet; they are stated so that a
  // simulator can, rather than being smuggled into a displayed number.
  const volatility = {
    afterMissDamping: dampsNegatives ? 0.10 : 0,
    spikeSuppression: composure != null && composure > 90,
    lateGameSwing: concentration != null && concentration < 70 ? 0.05 : 0,
  };

  return {
    tendencies: group(out),
    biasSummary: biasSummary(mental, per, applied, system, situation),
    volatility,
    applied,
  };
}

/** Sentence case for a generated clause. */
const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);

/** "a, b and c" rather than "a and b and c". */
function joinList(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Plain-language account of what the two layers did, and what they did not. */
function biasSummary(mental, per, applied, system, situation) {
  const on = applied.filter((a) => a.active);
  const off = applied.filter((a) => !a.active);

  const mentalBits = [];
  if (Number.isFinite(mental.confidence) && mental.confidence > 70) {
    mentalBits.push(`confidence ${mental.confidence} adds to shot creation`);
  }
  if (Number.isFinite(mental.resilience) && mental.resilience > 80) {
    mentalBits.push(`resilience ${mental.resilience} damps negative swings by 10% and steadies him after a miss`);
  }
  if (Number.isFinite(mental.composure) && mental.composure > 90) {
    mentalBits.push(`composure ${mental.composure} suppresses pressure spikes`);
  }
  if (Number.isFinite(mental.concentration) && mental.concentration < 70) {
    mentalBits.push(`concentration ${mental.concentration} costs him passing and defence late in games`);
  }
  if (Number.isFinite(mental.coachability) && mental.coachability > 95) {
    mentalBits.push(system
      ? `coachability ${mental.coachability} pulls him toward the team's ${system.label} system`
      : `coachability ${mental.coachability} would align him to the team system, which is not defined here`);
  }

  // One clause per source, not per tendency: a trait that moves two habits is
  // still one reason, and lower-casing the first word turned trait names into
  // "opportunity-Seeking".
  const perBits = [];
  for (const a of on) {
    if (/^(Confidence|Concentration|Resilience|Composure|Coachability)/.test(a.why)) continue;
    const source = a.why.split(/ (?:looks|attacks|presses|move|cut|moves|cuts)/)[0];
    if (!perBits.some((b) => b.startsWith(source))) perBits.push(a.why);
  }
  const pending = [...new Set(off.map((a) => a.when))]
    .map((w) => ((SITUATIONS.find((s) => s.id === w) || {}).label || w).toLowerCase());
  const pendingNote = pending.length ? ` Held for ${joinList(pending)}.` : '';

  return {
    mentalInfluence: mentalBits.length
      ? `${cap(mentalBits.join('; '))}.`
      : 'No mental attribute crosses a threshold, so nothing is applied.',
    personalityInfluence: (perBits.length
      ? `${cap(perBits.join('; '))}.`
      : 'No personality trait or priority applies in this situation.') + pendingNote,
    situation: (SITUATIONS.find((s) => s.id === situation) || {}).label || situation,
  };
}
