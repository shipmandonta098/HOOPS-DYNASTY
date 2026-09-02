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
  'insideScoring',
  'midRange',
  'threePoint',
  'freeThrow',
  'passing',
  'ballHandling',
  'offensiveRebound',
  'defensiveRebound',
  'perimeterDefense',
  'interiorDefense',
  'block',
  'steal',
  'athleticism',
  'basketballIQ',
];

/**
 * Per-position attribute weights. Each column roughly sums to the same total
 * so overalls are comparable across positions. Tweak these to change how the
 * league values different archetypes.
 */
const POSITION_WEIGHTS = {
  PG: { passing: 3, ballHandling: 3, threePoint: 2.5, midRange: 2, perimeterDefense: 2, steal: 1.5, basketballIQ: 2, athleticism: 1.5, freeThrow: 1, insideScoring: 1, defensiveRebound: 0.5, interiorDefense: 0.5 },
  SG: { threePoint: 3, midRange: 2.5, ballHandling: 2, perimeterDefense: 2.5, athleticism: 2, insideScoring: 1.5, passing: 1.5, steal: 1.5, basketballIQ: 1.5, freeThrow: 1, defensiveRebound: 0.5 },
  SF: { threePoint: 2.5, insideScoring: 2, midRange: 2, perimeterDefense: 2.5, athleticism: 2.5, defensiveRebound: 1.5, ballHandling: 1.5, passing: 1.5, interiorDefense: 1.5, basketballIQ: 1.5, steal: 1 },
  PF: { insideScoring: 2.5, interiorDefense: 2.5, defensiveRebound: 2.5, offensiveRebound: 2, athleticism: 2, midRange: 1.5, block: 1.5, threePoint: 1, perimeterDefense: 1, basketballIQ: 1.5 },
  C: { interiorDefense: 3, insideScoring: 3, defensiveRebound: 3, block: 2.5, offensiveRebound: 2.5, athleticism: 1.5, basketballIQ: 1.5, midRange: 1, passing: 1 },
};

/**
 * Compute a 0..99 overall rating for a player given their position.
 * Pure function — same input always yields the same number.
 */
function computeOverall(player) {
  const weights = POSITION_WEIGHTS[player.position] || POSITION_WEIGHTS.SF;
  const attrs = player.attributes || {};
  let weightedSum = 0;
  let weightTotal = 0;
  for (const [attr, weight] of Object.entries(weights)) {
    const value = typeof attrs[attr] === 'number' ? attrs[attr] : 50;
    weightedSum += value * weight;
    weightTotal += weight;
  }
  const raw = weightTotal > 0 ? weightedSum / weightTotal : 50;
  return Math.max(0, Math.min(99, Math.round(raw)));
}

/**
 * A player's contribution to winning. Overall is the base; we give a small
 * nudge for elite basketball IQ (spacing, decisions) and athleticism (motor).
 * Used by the season simulator to build team strength.
 */
function playerImpact(player) {
  const overall = computeOverall(player);
  const iq = (player.attributes && player.attributes.basketballIQ) || 50;
  const ath = (player.attributes && player.attributes.athleticism) || 50;
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
