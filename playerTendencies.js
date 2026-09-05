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
