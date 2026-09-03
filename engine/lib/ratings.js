'use strict';

/**
 * ratings.js — Turns a player's raw attributes into meaningful numbers.
 *
 * Everything downstream (game sim, trade value, contracts, development) leans
 * on a single, consistent notion of how good a player is. Rather than storing
 * a hand-entered "overall", we DERIVE it from attributes so the number always
 * matches the underlying skills. Change an attribute, the overall follows.
 *
 * Attributes live on `player.attributes` and are 25..99 scale (basketball
 * convention). Positions weight those attributes differently: a center's
 * overall leans on interior scoring/defense/rebounding, a point guard's on
 * playmaking and perimeter skill.
 */

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

/**
 * Every attribute the engine understands. Keeping this list in one place makes
 * it trivial to add a new skill later (add it here + give it a weight below).
 */
const ATTRIBUTES = [
  // Physical
  'strength', 'speed', 'vertical', 'agility', 'stamina', 'endurance',
  // Shooting (the whole scoring game, finishing and post play included)
  'layup', 'dunk', 'threePoint', 'midRange', 'freeThrow', 'postControl', 'shotIQ',
  // Playmaking
  'passing', 'passingIQ', 'ballHandling',
  // Defense
  'perimeterDefense', 'interiorDefense', 'steal', 'block', 'defensiveIQ',
  // Rebounding
  'offensiveRebound', 'defensiveRebound',
];

/**
 * THE CATEGORY MODEL — kept in step with playerRatings.js on the browser side.
 *
 * The fourteen attributes roll up into five categories, and each position
 * weights those categories differently. Two reasons this beats weighting the
 * fourteen attributes directly:
 *
 *   - It is the same model the UI grades players with, so the overall the
 *     engine computes always matches the categories a player sees on screen.
 *   - It is what stops a player being punished for skills his role does not
 *     ask for. Shooting is 11% of a centre's overall, so a rim protector who
 *     cannot shoot is still rated on rim protection.
 *
 * Weights within a category are relative; category weights sum to 1 per
 * position, so overalls stay comparable across positions.
 */
const CATEGORIES = {
  phy: [['strength', 1], ['speed', 1], ['agility', 0.9], ['vertical', 0.8],
        ['stamina', 0.6], ['endurance', 0.6]],
  sho: [['threePoint', 1], ['midRange', 0.95], ['layup', 0.85], ['shotIQ', 0.8],
        ['dunk', 0.6], ['postControl', 0.55], ['freeThrow', 0.5]],
  ply: [['passing', 1], ['ballHandling', 0.95], ['passingIQ', 0.8]],
  def: [['perimeterDefense', 1], ['interiorDefense', 1], ['defensiveIQ', 0.8],
        ['steal', 0.6], ['block', 0.6]],
  reb: [['defensiveRebound', 1], ['offensiveRebound', 0.8]],
};

const POSITION_WEIGHTS = {
  PG: { phy: 0.14, sho: 0.28, ply: 0.32, def: 0.19, reb: 0.07 },
  SG: { phy: 0.16, sho: 0.34, ply: 0.19, def: 0.22, reb: 0.09 },
  SF: { phy: 0.19, sho: 0.30, ply: 0.15, def: 0.23, reb: 0.13 },
  PF: { phy: 0.21, sho: 0.24, ply: 0.10, def: 0.25, reb: 0.20 },
  C: { phy: 0.22, sho: 0.21, ply: 0.08, def: 0.27, reb: 0.22 },
};

/** Weighted 0..99 score for one category, or null when the data is absent. */
function categoryScore(attrs, key) {
  let sum = 0;
  let weight = 0;
  for (const [attr, w] of CATEGORIES[key]) {
    const v = attrs[attr];
    if (typeof v === 'number') { sum += v * w; weight += w; }
  }
  return weight > 0 ? Math.round(sum / weight) : null;
}

/**
 * Compute a 0..99 overall rating for a player given their position.
 * Pure function — same input always yields the same number.
 */
function computeOverall(player) {
  const weights = POSITION_WEIGHTS[player.position] || POSITION_WEIGHTS.SF;
  const attrs = player.attributes || {};
  let weightedSum = 0;
  let weightTotal = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const score = categoryScore(attrs, key);
    if (score === null) continue;
    weightedSum += score * weight;
    weightTotal += weight;
  }
  const raw = weightTotal > 0 ? weightedSum / weightTotal : 50;
  return Math.max(0, Math.min(99, Math.round(raw)));
}

/**
 * A player's contribution to winning. Overall is the base; we give a small
 * nudge for elite basketball IQ (spacing, decisions) and speed (motor). IQ is
 * now three separate ratings, so it is averaged across them.
 * Used by the season simulator to build team strength.
 */
function playerImpact(player) {
  const overall = computeOverall(player);
  const a = player.attributes || {};
  const iq = ((a.shotIQ || 50) + (a.passingIQ || 50) + (a.defensiveIQ || 50)) / 3;
  const ath = ((a.speed || 50) + (a.agility || 50) + (a.vertical || 50)) / 3;
  return overall + (iq - 50) * 0.05 + (ath - 50) * 0.03;
}

/**
 * Team strength = minutes-weighted impact of the roster's best players.
 * Top 8 players carry the load (a rotation), with the starters weighted most.
 * Returns a single number on roughly the same 0..99 scale as overall.
 */
function teamStrength(teamPlayers) {
  const sorted = [...teamPlayers]
    .map((p) => playerImpact(p))
    .sort((a, b) => b - a)
    .slice(0, 8);
  // Minute weights: starters play more than the bench.
  const weights = [1.0, 0.95, 0.9, 0.85, 0.8, 0.55, 0.45, 0.35];
  let sum = 0;
  let wTotal = 0;
  sorted.forEach((impact, i) => {
    const w = weights[i] || 0.2;
    sum += impact * w;
    wTotal += w;
  });
  return wTotal > 0 ? sum / wTotal : 40;
}

/**
 * Estimate trade/asset value for a player. Combines current ability with
 * upside (young + high potential is worth more) and contract friendliness
 * (cheap = valuable, an albatross = liability). Used by tradeAI.js.
 */
function tradeValue(player) {
  const overall = computeOverall(player);
  const age = player.age || 27;
  const potential = player.potential || overall;

  // Upside: unrealized potential for young players is a real asset.
  const upside = Math.max(0, potential - overall);
  const youthBonus = age <= 24 ? upside * 1.2 : upside * 0.4;

  // Age curve: value drops off as a player ages past his prime.
  let ageFactor = 1.0;
  if (age >= 31) ageFactor = 1 - (age - 30) * 0.06;
  if (age <= 23) ageFactor = 1.05;
  ageFactor = Math.max(0.4, ageFactor);

  // Contract: a productive player on a cheap deal is a bargain.
  const salary = (player.contract && player.contract.salary) || 0;
  const expectedSalary = Math.max(1, (overall - 55) * 1.2); // rough $M a player "deserves"
  const contractFactor = salary <= expectedSalary ? 1.1 : 0.9;

  const base = Math.pow(Math.max(0, overall - 40), 1.6);
  return Math.round((base + youthBonus * 3) * ageFactor * contractFactor);
}

module.exports = {
  POSITIONS,
  ATTRIBUTES,
  POSITION_WEIGHTS,
  computeOverall,
  playerImpact,
  teamStrength,
  tradeValue,
};
