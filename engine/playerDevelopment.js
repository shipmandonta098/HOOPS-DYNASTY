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
const { classifyArchetype } = require('./lib/esm').load('playerArchetypes.js');
const { teamSystem } = require('./lib/esm').load('playerTendencies.js');
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

/* A typical rating sits around 70, i.e. 45 points above the floor. The old
   point magnitudes were tuned against players of about that size, so dividing
   by it turns each one into the rate that reproduces the same movement for a
   typical player while behaving sensibly at the extremes. */
const REFERENCE = 45;

function clampAttr(v) {
  return Math.max(25, Math.min(99, Math.round(v)));
}

/**
 * Move a set of attributes, PROPORTIONALLY.
 *
 * Season-to-season change is a rate, not a fixed number of points, because it
 * COMPOUNDS: a career is twenty of these applied one after another, and a flat
 * step gives an absurd result at the ends of the scale — the same -1.5 a year
 * takes a 40 to nothing while barely troubling a 95. Proportional change is
 * also what decline actually looks like: an elite athlete has more to lose and
 * loses more of it.
 *
 * (In-game modifiers are the opposite case and stay flat — see the note at the
 * top of playerTendencies.js. The distinction is timescale: one applies once
 * within a game, the other twenty times across a career.)
 *
 * `rate` is a fraction, so 0.02 is two percent. `direction` is +1 (growth) or
 * -1 (decline). Attributes are measured against a 25 floor rather than zero,
 * because that is where the scale actually bottoms out and a rating of 25 is
 * "none of this skill", not "a quarter of it".
 */
const ATTR_FLOOR = 25;

function nudgeAttributes(attrs, rate, weights, direction, rng) {
  for (const attr of ATTRIBUTES) {
    if (typeof attrs[attr] !== 'number') continue;
    const w = weights[attr] != null ? weights[attr] : 1;
    // A little per-attribute noise so growth isn't perfectly uniform.
    const pct = direction * rate * w * rng.float(0.6, 1.4);
    const headroom = attrs[attr] - ATTR_FLOOR;
    attrs[attr] = clampAttr(attrs[attr] + headroom * pct);
  }
}

/* Which attributes each style of play asks a player to work on, and which it
   lets him neglect. Weights are relative within a style. */
const SYSTEM_EMPHASIS = {
  'Pace and Space': { threePoint: +1, freeThrow: +0.4, speed: +0.5, shotIQ: +0.5,
                      postControl: -1, strength: -0.5, interiorDefense: -0.3 },
  'Inside-Out':     { postControl: +1, strength: +0.7, interiorDefense: +0.5,
                      offensiveRebound: +0.5, threePoint: -1, speed: -0.3 },
  'Ball Movement':  { passing: +1, passingIQ: +0.8, shotIQ: +0.5,
                      ballHandling: -0.4, postControl: -0.6 },
  Balanced:         {},
};

/**
 * A season inside a system leaves a mark: a player works on what his team asks
 * of him and lets slide what it does not.
 *
 * PROPORTIONAL, because it is season-to-season and compounds across a career —
 * a decade in one system should visibly reshape a player.
 *
 * NET-NEUTRAL ON OVERALL, and that is not a nicety. Coachability is a mental
 * attribute, and mental attributes must never move a rating. So drift
 * REDISTRIBUTES: what one attribute gains another gives up, and the player's
 * overall is restored to what it was before. He has not got better or worse,
 * he has become a different player — which is exactly what a system does to
 * someone, and the only version of this that does not smuggle a mental
 * attribute into Overall.
 */
function applySystemDrift(player, system, rng) {
  if (!system) return false;
  const emphasis = SYSTEM_EMPHASIS[system.label];
  if (!emphasis || !Object.keys(emphasis).length) return false;
  const attrs = player.attributes || {};
  const coach = (player.mental && player.mental.coachability);
  if (!Number.isFinite(coach)) return false;

  // A coachable player absorbs the system; a stubborn one barely does.
  const rate = 0.010 * Math.max(0, (coach - 50) / 49) * rng.float(0.6, 1.4);
  if (rate <= 0) return false;

  const before = computeOverall(player);
  for (const [attr, w] of Object.entries(emphasis)) {
    if (typeof attrs[attr] !== 'number') continue;
    const headroom = attrs[attr] - ATTR_FLOOR;
    attrs[attr] = clampAttr(attrs[attr] + headroom * rate * w);
  }
  // Put the overall back where it was: this reshapes a player, it does not
  // rate him. A whole-block correction preserves the reshaping.
  for (let i = 0; i < 8; i++) {
    const gap = before - computeOverall(player);
    if (gap === 0) break;
    for (const attr of ATTRIBUTES) {
      if (typeof attrs[attr] === 'number') attrs[attr] = clampAttr(attrs[attr] + gap * 0.6);
    }
  }
  return true;
}

/**
 * Develop a single player one year. Mutates the passed player object (which is
 * already a clone owned by this module). Returns { retired: boolean, note }.
 */
function developPlayer(player, rng, system) {
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
    // basketballIQ was split into three separate IQ ratings; reading the dead
    // name meant this factor was silently pinned at 50 for every player.
    const iq = ((attrs.shotIQ || 50) + (attrs.passingIQ || 50) + (attrs.defensiveIQ || 50)) / 3;
    const iqFactor = (iq - 50) / 100;                         // -0.25..+0.49
    // Was a point magnitude; divided by the reference headroom it was
    // implicitly assuming, so a typical season moves as far as it used to.
    const rate = ((0.15 + room * 0.06) * (1 + iqFactor) * rng.float(0.7, 1.5)) / REFERENCE;
    // Growth spreads across all attributes but favors "trainable" skills.
    nudgeAttributes(attrs, rate, {}, +1, rng);
    if (rng.chance(0.08 + iqFactor * 0.1)) {
      // Breakout year — a real leap.
      nudgeAttributes(attrs, rate * 1.5, {}, +1, rng);
      note = 'breakout';
    }
  } else if (age <= 28) {
    // PRIME: mostly stable, tiny random drift either way.
    const drift = rng.float(-0.4, 0.5) / REFERENCE;
    nudgeAttributes(attrs, Math.abs(drift), {}, drift >= 0 ? +1 : -1, rng);
    note = 'prime';
  } else {
    // DECLINE: accelerates with age. Athletic attributes fall fastest.
    const yearsPastPrime = age - 28;
    const rate = (0.5 + yearsPastPrime * 0.35) / REFERENCE;
    nudgeAttributes(attrs, rate, DECLINE_SENSITIVITY, -1, rng);
    note = 'decline';
  }

  player.attributes = attrs;
  // A season in the team's system, after growth or decline and before the
  // archetype is re-read, so a player reshaped by his system is re-labelled by
  // the numbers that reshaping produced.
  if (applySystemDrift(player, system, rng) && !note) note = 'system';

  const after = computeOverall(player);
  player.overall = after; // cache the derived overall for convenience/readers
  player.overallChange = after - before;

  // ---- Archetype evolution ----
  // A player's archetype is READ BACK off the ratings he now has, not carried
  // forward as a label stapled on at birth. So a slashing guard who develops a
  // jumper genuinely becomes a three-level scorer, and an athletic wing who
  // loses a step genuinely becomes a 3-and-D wing — because the numbers moved
  // first and the label followed. Nothing here reassigns an archetype at
  // random; if the ratings did not change shape, neither does the label.
  const now = classifyArchetype(player);
  if (now && now.id !== player.archetype) {
    player.archetypeChangedFrom = player.archetypeLabel || null;
    player.archetype = now.id;
    player.archetypeLabel = now.label;
    if (!note) note = 'archetype';
  }

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

  // Each team's system is read off its roster ONCE, before anyone develops, so
  // every player on a team drifts toward the same style rather than toward a
  // target that moves as his teammates are processed.
  const systemByTeam = {};
  for (const team of league.teams || []) {
    systemByTeam[team.id] = teamSystem(
      league.players.filter((p) => p.teamId === team.id));
  }

  const retirements = [];
  const survivors = [];
  for (const player of league.players) {
    const { retired, note } = developPlayer(player, rng, systemByTeam[player.teamId] || null);
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
