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
const { POSITIONS, computeOverall } = require('./lib/ratings');
const { load, adaptRNG } = require('./lib/esm');
const { makeRatedPlayer } = load('playerGen.js');
const { makeOrigin, makeName, COLLEGES } = require('./lib/names');
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
  // Prospects come out of the SAME generator the league does — frame first,
  // then an archetype his body supports, then attributes shaped around it.
  // Building them with a separate flat draw would mean a draft class was made
  // of a different kind of basketball player from the league drafting it.
  const rated = makeRatedPlayer(adaptRNG(rng),
    { target: targetOverall, position, age });
  const attributes = rated.attributes;
  // Where he is from and what he is called are one draw, not two, so a
  // prospect born in Bamako is not handed an unrelated name.
  const origin = makeOrigin(rng);
  const name = makeName(rng, origin);

  const prospect = {
    id: `prospect_${year}_${String(index + 1).padStart(2, '0')}`,
    name,
    position,
    secondaryPosition: rated.secondaryPosition,
    age,
    heightIn: rated.heightIn,
    weightLb: rated.weightLb,
    archetype: rated.archetype,
    archetypeLabel: rated.archetypeLabel,
    birthplace: {
      city: origin.birthCity,
      region: origin.birthRegion,
      country: origin.birthCountry,
    },
    nationality: origin.nationality,
    secondaryNationality: origin.secondaryNationality,
    namingOrigin: origin.namingOrigin,
    gender: origin.gender,
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
