'use strict';

/**
 * generateDraftClass.js — Create a new class of draft prospects.
 *
 * CONTRACT: league -> league (new object). Writes into league.draft.
 * Determinism: seeded from meta.rngSeed + the draft year.
 *
 * A draft class is just a pool of young players (age 18–22) with a CURRENT
 * ability and a POTENTIAL ceiling. Most are role players; a few are stars;
 * a rare one is a franchise-changer. That talent spread is controlled by the
 * `tiers` table below — tweak it to make drafts deeper or more top-heavy.
 *
 * Prospects live in `league.draft.prospects` until they are drafted. Drafting
 * (assigning teamId + moving them into league.players) is done by a prompt/AI
 * step or by your own draft logic — see prompts/generate_draft_class.md.
 */

const { RNG } = require('./lib/rng');
const { POSITIONS, computeOverall, ATTRIBUTES } = require('./lib/ratings');
const { FIRST_NAMES, LAST_NAMES, COLLEGES } = require('./lib/names');
const { loadLeague, saveLeague, cloneLeague } = require('./saveLoad');

/**
 * Talent tiers. `weight` is how common the tier is; the ranges are the
 * prospect's peak POTENTIAL. Current ability is derived below as a fraction of
 * potential (prospects are raw — they haven't developed yet).
 */
const TIERS = [
  { label: 'franchise', weight: 3, potMin: 82, potMax: 92 },
  { label: 'star', weight: 10, potMin: 74, potMax: 82 },
  { label: 'starter', weight: 30, potMin: 66, potMax: 74 },
  { label: 'rotation', weight: 37, potMin: 58, potMax: 66 },
  { label: 'fringe', weight: 20, potMin: 48, potMax: 58 },
];

/** Weighted pick of a tier. */
function pickTier(rng) {
  const total = TIERS.reduce((s, t) => s + t.weight, 0);
  let roll = rng.float(0, total);
  for (const t of TIERS) {
    if (roll < t.weight) return t;
    roll -= t.weight;
  }
  return TIERS[TIERS.length - 1];
}

/**
 * Build a prospect's attribute block so that its computed overall lands near a
 * target value, with a position-appropriate profile. We generate around the
 * target, then let ratings.computeOverall() report the real number.
 */
function buildAttributes(position, targetOverall, rng) {
  const attrs = {};
  for (const attr of ATTRIBUTES) {
    // Center around the target with spread; individual skills vary a lot.
    attrs[attr] = Math.max(25, Math.min(99, Math.round(rng.gaussian(targetOverall, 8))));
  }
  // Give position-defining skills a boost so archetypes read true.
  const boosts = {
    PG: ['passing', 'ballHandling', 'threePoint'],
    SG: ['threePoint', 'midRange', 'perimeterDefense'],
    SF: ['athleticism', 'perimeterDefense', 'insideScoring'],
    PF: ['insideScoring', 'defensiveRebound', 'interiorDefense'],
    C: ['interiorDefense', 'block', 'defensiveRebound', 'insideScoring'],
  }[position] || [];
  for (const b of boosts) {
    attrs[b] = Math.min(99, attrs[b] + rng.int(4, 10));
  }
  return attrs;
}

/**
 * Generate a single prospect object.
 * @param {number} index - draft order position used to build a stable id.
 * @param {number} year
 */
function generateProspect(index, year, rng) {
  const tier = pickTier(rng);
  const potential = rng.int(tier.potMin, tier.potMax);
  const age = rng.int(18, 22);

  // Raw current ability: younger + higher-ceiling prospects are further from
  // their peak. Older prospects are more "finished".
  const rawnessGap = rng.int(8, 20) - (age - 18) * 2;
  const targetOverall = Math.max(40, potential - Math.max(4, rawnessGap));

  const position = rng.pick(POSITIONS);
  const attributes = buildAttributes(position, targetOverall, rng);
  const name = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;

  const prospect = {
    id: `prospect_${year}_${String(index + 1).padStart(2, '0')}`,
    name,
    position,
    age,
    college: rng.pick(COLLEGES),
    teamId: null, // undrafted
    draftClass: year,
    tier: tier.label,
    potential,
    attributes,
    contract: null, // signed on draft (rookie scale) via updateContracts/prompt
    statsHistory: [],
  };
  // Cache derived overall for readability.
  prospect.overall = computeOverall(prospect);
  return prospect;
}

/**
 * Generate a full draft class and attach it to league.draft.
 * @param {object} inputLeague
 * @param {object} [options] - { size?: number, year?: number }
 */
function generateDraftClass(inputLeague, options = {}) {
  const league = cloneLeague(inputLeague);
  const year = options.year || league.meta.currentSeason;
  const size = options.size || (league.settings && league.settings.draftClassSize) || 30;
  const rng = RNG.forStream(league.meta.rngSeed, `draft:${year}`);

  const prospects = [];
  for (let i = 0; i < size; i++) {
    prospects.push(generateProspect(i, year, rng));
  }
  // Sort by overall (best prospects first) so pick order is scouting-friendly.
  prospects.sort((a, b) => b.overall - a.overall || b.potential - a.potential);
  // Re-index ids to match the sorted board so prospect_YEAR_01 = top prospect.
  prospects.forEach((p, i) => {
    p.projectedPick = i + 1;
  });

  league.draft = {
    schemaVersion: 1,
    class: year,
    generatedForSeason: year,
    prospects,
    // Draft order is filled in by your league logic (usually reverse standings).
    order: league.draft && league.draft.order ? league.draft.order : [],
    completed: false,
  };
  return league;
}

module.exports = { generateDraftClass, generateProspect };

/* ---------- CLI: `node engine/generateDraftClass.js <file> [--save]` ---------- */
if (require.main === module) {
  const file = process.argv[2] || 'saves/example_league.json';
  const doSave = process.argv.includes('--save');
  const league = loadLeague(file);
  const updated = generateDraftClass(league);
  console.log(`\n=== ${updated.draft.class} Draft Class (${updated.draft.prospects.length} prospects) ===`);
  updated.draft.prospects.slice(0, 12).forEach((p) =>
    console.log(
      `  ${String(p.projectedPick).padStart(2)}. ${p.name.padEnd(22)} ${p.position}  ` +
        `${p.overall} OVR / ${p.potential} POT  (${p.tier}, age ${p.age})`
    )
  );
  console.log('  ...');
  if (doSave) {
    saveLeague(updated, file);
    console.log(`\nSaved -> ${file}`);
  } else {
    console.log('\n(dry run — pass --save to write results back)');
  }
}
