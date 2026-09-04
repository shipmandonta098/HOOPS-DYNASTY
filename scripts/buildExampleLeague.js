'use strict';

/**
 * buildExampleLeague.js — Generate saves/example_league.json from scratch.
 *
 * This is both a convenience ("give me a fresh league to play with") and a
 * living test that the engine's pieces fit together. It:
 *   1. Creates 5 teams.
 *   2. Fills each with 10 players via a seeded generator.
 *   3. Generates a draft class with the real engine module.
 *   4. Seeds one season of fake history so history isn't empty.
 *
 * Everything flows through the same seeded RNG, so this file produces the
 * EXACT same league every time you run it. Change SEED for a different league.
 *
 * Run:  node scripts/buildExampleLeague.js
 */

const path = require('path');
const { RNG } = require('../engine/lib/rng');
const { POSITIONS, computeOverall } = require('../engine/lib/ratings');
const { load, adaptRNG } = require('../engine/lib/esm');

// The example league is a men's league; a real career takes this from the
// New Career settings screen.
const RULES = { playerGender: 'Male' };
const { makeRatedPlayer, pickGender } = load('playerGen.js');
const { makeBackground } = load('colleges.js');
const { makeOrigin, makeName } = require('../engine/lib/names');
const { generateDraftClass } = require('../engine/generateDraftClass');
const { saveLeague } = require('../engine/saveLoad');

const SEED = 424242;
const START_SEASON = 2025;

const TEAMS = [
  { id: 'BAY', city: 'Bay City', name: 'Breakers', conference: 'West' },
  { id: 'GRN', city: 'Granite', name: 'Miners', conference: 'West' },
  { id: 'HAR', city: 'Harbor', name: 'Sharks', conference: 'East' },
  { id: 'CAP', city: 'Capital', name: 'Sentinels', conference: 'East' },
  { id: 'RDG', city: 'Ridgeway', name: 'Rovers', conference: 'West' },
];

// Contract archetypes so salaries look believable relative to ability.
function contractFor(overall, age, rng) {
  let type = 'standard';
  let salary;
  let years;
  if (overall >= 82) {
    type = 'max';
    salary = rng.int(30, 45);
    years = rng.int(3, 5);
  } else if (overall >= 74) {
    salary = rng.int(16, 28);
    years = rng.int(2, 4);
  } else if (overall >= 66) {
    salary = rng.int(7, 15);
    years = rng.int(1, 3);
  } else if (age <= 23) {
    type = 'rookie';
    salary = rng.int(2, 6);
    years = rng.int(1, 3);
  } else {
    type = 'vet_min';
    salary = rng.int(1, 4);
    years = rng.int(1, 2);
  }
  return { salary, yearsRemaining: years, type, playerOption: false, teamOption: false };
}

function makePlayer(idNum, teamId, position, tier, rng) {
  // Tier sets the rough overall target. The player himself — frame, archetype
  // and the 23 attributes shaped around them — comes out of the game's own
  // generator, so the example league contains the same kind of basketball
  // players the game does. The hand-rolled version here was still boosting
  // `athleticism` and `insideScoring`, attributes that stopped existing at the
  // 14-to-23 split, so those "position boosts" wrote fields nobody read.
  const target = { star: 80, starter: 71, rotation: 63, bench: 55 }[tier];
  const age = rng.int(19, 34);
  const gender = pickGender(adaptRNG(rng), RULES);
  const rated = makeRatedPlayer(adaptRNG(rng),
    { target, position, age, gender });
  const attributes = rated.attributes;
  // Origin and name are one draw: the name follows from where he is from.
  const origin = makeOrigin(rng, gender);
  // Where he played before turning pro is its own draw, separate from where he
  // was born: a Rome-born player who went to Arizona is ordinary, and one who
  // never attended an American college gets a null college plus his real route.
  const background = makeBackground(adaptRNG(rng), {
    overall: target, position, age,
    birthCountry: origin.birthCountry,
    birthRegion: origin.birthRegion,
    secondaryNationality: origin.secondaryNationality,
  });
  const player = {
    id: `p_${String(idNum).padStart(3, '0')}`,
    name: makeName(rng, origin),
    position,
    gender: rated.gender,
    secondaryPosition: rated.secondaryPosition,
    age,
    teamId,
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
    college: background.college,
    preDraftPath: background.preDraftPath,
    collegeYears: background.collegeYears,
    attributes,
    statsHistory: [],
  };
  player.overall = computeOverall(player);
  // Potential: young players have room above current; vets are near their peak.
  const room = age <= 23 ? rng.int(4, 14) : age <= 27 ? rng.int(0, 5) : 0;
  player.potential = Math.min(99, player.overall + room);
  player.contract = contractFor(player.overall, age, rng);
  return player;
}

function build() {
  const rng = new RNG(SEED);

  // Each team gets a starting five (by position) + 5 bench players.
  const roster = ['PG', 'SG', 'SF', 'PF', 'C']; // starters, one per spot
  const players = [];
  let idNum = 1;

  for (const team of TEAMS) {
    // Give teams slightly different quality so standings aren't a coin flip.
    const teamQuality = rng.pick(['star', 'starter', 'starter', 'rotation']);
    // Starters
    for (const pos of roster) {
      const tier = rng.chance(0.35) ? teamQuality : rng.pick(['starter', 'rotation']);
      players.push(makePlayer(idNum++, team.id, pos, tier, rng));
    }
    // Bench (5), random positions, lower tiers
    for (let i = 0; i < 5; i++) {
      const pos = rng.pick(POSITIONS);
      const tier = rng.pick(['rotation', 'bench', 'bench']);
      players.push(makePlayer(idNum++, team.id, pos, tier, rng));
    }
  }

  const teams = TEAMS.map((t) => ({
    id: t.id,
    city: t.city,
    name: t.name,
    conference: t.conference,
    championships: 0,
  }));

  let league = {
    schemaVersion: 1,
    meta: {
      leagueName: 'Hoops Dynasty Demo League',
      currentSeason: START_SEASON,
      currentPhase: 'regular_season',
      rngSeed: SEED,
      createdAt: '2025-01-01',
      lastSimulatedSeason: null,
    },
    settings: {
      salaryCap: 140,
      minSalary: 1,
      maxRosterSize: 15,
      meetingsPerMatchup: 4,
      draftClassSize: 18,
      playoffTeams: 4,
    },
    teams,
    players,
    freeAgents: [],
    draft: { schemaVersion: 1, class: START_SEASON, prospects: [], order: [], completed: false },
    history: {
      schemaVersion: 1,
      seasons: [],
      champions: [],
      transactions: [],
      retirements: [],
    },
  };

  // Attach a generated draft class using the real engine module.
  league = generateDraftClass(league, { size: 18, year: START_SEASON });

  // Seed a little prior history so the file demonstrates the shape (a fake
  // 2024 championship) without needing to have simulated it.
  league.history.seasons.push({
    season: 2024,
    champion: 'HAR',
    championName: 'Harbor Sharks',
    runnerUp: 'BAY',
    runnerUpName: 'Bay City Breakers',
    standings: [],
    mvp: null,
    note: 'Seeded example history — replace by simulating real seasons.',
  });
  league.history.champions.push({ season: 2024, teamId: 'HAR', teamName: 'Harbor Sharks' });
  const har = league.teams.find((t) => t.id === 'HAR');
  har.championships = 1;

  const out = path.resolve(__dirname, '..', 'saves', 'example_league.json');
  saveLeague(league, out);
  console.log(`Built example league -> ${out}`);
  console.log(`Teams: ${league.teams.length}, Players: ${league.players.length}, ` +
    `Prospects: ${league.draft.prospects.length}`);
  return league;
}

if (require.main === module) build();
module.exports = { build };
