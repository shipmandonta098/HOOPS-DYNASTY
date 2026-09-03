'use strict';

/**
 * playerDevelopment.js — Age every player one year and adjust their ratings
 * along a realistic career arc. Handles breakouts, decline, and retirement.
 *
 * CONTRACT: league -> league (new object, no mutation).
 * Determinism: seeded from meta.rngSeed + the season being processed.
 *
 * THE CAREER CURVE (basketball reality, compressed):
 *   - Ages ~19–24: growth years. Players climb toward their `potential`.
 *   - Ages ~25–28: prime. Small ups and downs, roughly stable.
 *   - Ages ~29+:  decline. Athleticism fades first, skill/IQ hang on longer.
 *   - Ages ~34+:  steeper decline; retirement risk rises each year.
 *
 * `potential` is a soft ceiling for a young player's overall. High-IQ workers
 * develop faster; players already near their ceiling grow slowly.
 */

const { RNG } = require('./lib/rng');
const { computeOverall, ATTRIBUTES } = require('./lib/ratings');
const { loadLeague, saveLeague, cloneLeague } = require('./saveLoad');

// Which attributes fade with age, and how fast (relative multiplier).
// Athletic tools go first; skill and IQ are "old-man game" — they persist, and
// a 34-year-old shooter is still a shooter. Now that athleticism is six
// separate ratings, the fast-twitch ones (speed, vertical, agility) decline
// hardest while strength holds and IQ barely moves at all.
const DECLINE_SENSITIVITY = {
  // Physical
  speed: 1.7,
  vertical: 1.7,
  agility: 1.5,
  stamina: 1.2,
  endurance: 1.1,
  strength: 0.6,          // veterans keep, and often add, strength
  // Shooting / scoring
  dunk: 1.6,              // the first thing to go
  layup: 1.0,
  postControl: 0.6,
  midRange: 0.6,
  threePoint: 0.5,
  freeThrow: 0.3,
  shotIQ: 0.1,
  // Playmaking
  ballHandling: 0.7,
  passing: 0.3,
  passingIQ: 0.1,
  // Defense
  perimeterDefense: 1.2,
  block: 1.1,
  interiorDefense: 1.0,
  steal: 1.0,
  defensiveIQ: 0.1,       // reads and positioning survive the legs
  // Rebounding
  offensiveRebound: 1.0,
  defensiveRebound: 0.9,
};

function clampAttr(v) {
  return Math.max(25, Math.min(99, Math.round(v)));
}

/**
 * Apply a delta to a set of attributes, weighted by each attribute's list of
 * relative multipliers. `direction` is +1 (growth) or -1 (decline).
 */
function nudgeAttributes(attrs, magnitude, weights, direction, rng) {
  for (const attr of ATTRIBUTES) {
    if (typeof attrs[attr] !== 'number') continue;
    const w = weights[attr] != null ? weights[attr] : 1;
    // Add a little per-attribute noise so growth isn't perfectly uniform.
    const change = direction * magnitude * w * rng.float(0.6, 1.4);
    attrs[attr] = clampAttr(attrs[attr] + change);
  }
}

/**
 * Develop a single player one year. Mutates the passed player object (which is
 * already a clone owned by this module). Returns { retired: boolean, note }.
 */
function developPlayer(player, rng) {
  player.age = (player.age || 22) + 1;
  const age = player.age;
  const before = computeOverall(player);
  const potential = player.potential || before;
  const attrs = player.attributes || {};
  let note = '';

  if (age <= 24) {
    // GROWTH: climb toward potential. The further below the ceiling, the
    // bigger the jump. High basketball IQ accelerates development.
    const room = Math.max(0, potential - before);
    const iqFactor = ((attrs.basketballIQ || 50) - 50) / 100; // -0.25..+0.49
    const magnitude = (0.15 + room * 0.06) * (1 + iqFactor) * rng.float(0.7, 1.5);
    // Growth spreads across all attributes but favors "trainable" skills.
    nudgeAttributes(attrs, magnitude, {}, +1, rng);
    if (rng.chance(0.08 + iqFactor * 0.1)) {
      // Breakout year — a real leap.
      nudgeAttributes(attrs, magnitude * 1.5, {}, +1, rng);
      note = 'breakout';
    }
  } else if (age <= 28) {
    // PRIME: mostly stable, tiny random drift either way.
    const drift = rng.float(-0.4, 0.5);
    nudgeAttributes(attrs, Math.abs(drift), {}, drift >= 0 ? +1 : -1, rng);
    note = 'prime';
  } else {
    // DECLINE: accelerates with age. Athletic attributes fall fastest.
    const yearsPastPrime = age - 28;
    const magnitude = 0.5 + yearsPastPrime * 0.35;
    nudgeAttributes(attrs, magnitude, DECLINE_SENSITIVITY, -1, rng);
    note = 'decline';
  }

  player.attributes = attrs;
  const after = computeOverall(player);
  player.overall = after; // cache the derived overall for convenience/readers
  player.overallChange = after - before;

  // ---- Retirement check ----
  // Risk rises with age and falls with remaining ability. A 40-year-old star
  // might hang on; a 34-year-old scrub is likely done.
  let retired = false;
  if (age >= 32) {
    const abilityFloor = Math.max(0, (after - 60) / 100); // stars retire less
    const baseRisk = (age - 31) * 0.12;
    const risk = Math.max(0, baseRisk - abilityFloor);
    if (after < 55 || rng.chance(risk)) {
      retired = true;
      note = 'retired';
    }
  }
  return { retired, note };
}

/**
 * Develop the whole league for one offseason.
 * Retired players are removed from rosters and recorded in history.
 * @param {object} inputLeague
 */
function playerDevelopment(inputLeague) {
  const league = cloneLeague(inputLeague);
  // Use the season that was just completed so dev pairs with that year.
  const devYear = league.meta.lastSimulatedSeason || league.meta.currentSeason - 1;
  const rng = RNG.forStream(league.meta.rngSeed, `development:${devYear}`);

  const retirements = [];
  const survivors = [];
  for (const player of league.players) {
    const { retired, note } = developPlayer(player, rng);
    if (retired) {
      retirements.push({
        playerId: player.id,
        name: player.name,
        age: player.age,
        season: devYear,
        finalOverall: player.overall,
      });
    } else {
      player.lastDevelopmentNote = note;
      survivors.push(player);
    }
  }

  league.players = survivors;

  // Record retirements in history so the league remembers its legends.
  league.history = league.history || { seasons: [], champions: [], transactions: [] };
  league.history.retirements = league.history.retirements || [];
  league.history.retirements.push(...retirements);

  league.meta.lastDevelopmentSeason = devYear;
  return league;
}

module.exports = { playerDevelopment, developPlayer };

/* ---------- CLI: `node engine/playerDevelopment.js <file> [--save]` ---------- */
if (require.main === module) {
  const file = process.argv[2] || 'saves/example_league.json';
  const doSave = process.argv.includes('--save');
  const league = loadLeague(file);
  const before = league.players.length;
  const updated = playerDevelopment(league);
  const retired = (updated.history.retirements || []).filter(
    (r) => r.season === (updated.meta.lastDevelopmentSeason)
  );
  console.log(`\n=== Offseason Development (${updated.meta.lastDevelopmentSeason}) ===`);
  console.log(`Players before: ${before}, after: ${updated.players.length}`);
  const risers = [...updated.players].sort((a, b) => (b.overallChange || 0) - (a.overallChange || 0)).slice(0, 5);
  console.log('\nBiggest risers:');
  risers.forEach((p) => console.log(`  +${p.overallChange}  ${p.name} (age ${p.age}, now ${p.overall} OVR)`));
  if (retired.length) {
    console.log('\nRetirements:');
    retired.forEach((r) => console.log(`  ${r.name} — age ${r.age}, ${r.finalOverall} OVR`));
  }
  if (doSave) {
    saveLeague(updated, file);
    console.log(`\nSaved -> ${file}`);
  } else {
    console.log('\n(dry run — pass --save to write results back)');
  }
}
