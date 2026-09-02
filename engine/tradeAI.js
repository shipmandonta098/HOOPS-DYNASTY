'use strict';

/**
 * tradeAI.js — Propose and evaluate trades between teams.
 *
 * CONTRACT: league -> league (new object) when a trade is executed.
 * Also exports pure helpers you can call without mutating anything, so a
 * prompt/AI step can *reason about* trades before committing one.
 * Determinism: seeded from meta.rngSeed + season, so "find me a trade" is
 * repeatable. Randomness only breaks ties between similar options.
 *
 * CORE IDEA:
 *   Every player has a `tradeValue` (see lib/ratings.js). A trade is FAIR when
 *   the two sides are within a tolerance of each other. A team ACCEPTS a trade
 *   when it gets fair-or-better value AND the deal fits its NEEDS (a rebuilding
 *   team wants youth/picks; a contender wants win-now talent).
 *
 * This is intentionally a simple, transparent valuation model. It's meant to
 * be readable and expandable, not to out-smart a real GM.
 */

const { RNG } = require('./lib/rng');
const { tradeValue, computeOverall } = require('./lib/ratings');
const { loadLeague, saveLeague, cloneLeague, playersByTeam, getPlayer, getTeam } = require('./saveLoad');

/**
 * Classify a team's competitive window from its roster.
 * Returns 'contender' | 'balanced' | 'rebuilding'.
 * Contenders skew old-and-good; rebuilders skew young-and-unproven.
 */
function teamMode(league, teamId) {
  const roster = playersByTeam(league, teamId);
  if (roster.length === 0) return 'rebuilding';
  const avgOverall = roster.reduce((s, p) => s + computeOverall(p), 0) / roster.length;
  const avgAge = roster.reduce((s, p) => s + (p.age || 25), 0) / roster.length;
  if (avgOverall >= 72 && avgAge >= 26) return 'contender';
  if (avgOverall <= 68 || avgAge <= 24.5) return 'rebuilding';
  return 'balanced';
}

/**
 * How much a given team "likes" a specific player beyond raw value, based on
 * its mode. A rebuilder over-values youth; a contender over-values proven
 * production. Returns a multiplier applied to the player's base trade value.
 */
function fitMultiplier(mode, player) {
  const age = player.age || 27;
  const overall = computeOverall(player);
  if (mode === 'rebuilding') {
    if (age <= 24) return 1.25; // wants youth
    if (age >= 30) return 0.7; // doesn't want aging vets
  }
  if (mode === 'contender') {
    if (overall >= 75) return 1.2; // wants stars now
    if (age <= 21 && overall < 65) return 0.75; // projects don't help now
  }
  return 1.0;
}

/**
 * Value a package of players FROM the perspective of the team RECEIVING it.
 * @param {object[]} players
 * @param {string} receivingMode - the receiving team's mode
 */
function packageValueFor(players, receivingMode) {
  return players.reduce((sum, p) => sum + tradeValue(p) * fitMultiplier(receivingMode, p), 0);
}

/**
 * Evaluate a concrete proposed trade WITHOUT executing it.
 *
 * @param {object} league
 * @param {object} proposal - {
 *     teamA: string, teamB: string,
 *     sendFromA: string[]  // player ids A sends to B
 *     sendFromB: string[]  // player ids B sends to A
 *   }
 * @returns {object} verdict with per-side values and whether each accepts.
 */
function evaluateTrade(league, proposal) {
  const modeA = teamMode(league, proposal.teamA);
  const modeB = teamMode(league, proposal.teamB);

  const fromA = proposal.sendFromA.map((id) => getPlayer(league, id));
  const fromB = proposal.sendFromB.map((id) => getPlayer(league, id));

  if (fromA.includes(undefined) || fromB.includes(undefined)) {
    throw new Error('Trade references a player id that does not exist.');
  }

  // What each team RECEIVES, valued by that team's own preferences.
  const aReceives = packageValueFor(fromB, modeA);
  const bReceives = packageValueFor(fromA, modeB);

  // What each team GIVES UP, valued by its own preferences (opportunity cost).
  const aGives = packageValueFor(fromA, modeA);
  const bGives = packageValueFor(fromB, modeB);

  const TOLERANCE = 0.9; // must receive at least 90% of what you give up
  const aAccepts = aReceives >= aGives * TOLERANCE;
  const bAccepts = bReceives >= bGives * TOLERANCE;

  return {
    modeA,
    modeB,
    aReceives: Math.round(aReceives),
    bReceives: Math.round(bReceives),
    aGives: Math.round(aGives),
    bGives: Math.round(bGives),
    aAccepts,
    bAccepts,
    accepted: aAccepts && bAccepts,
  };
}

/**
 * Actually perform a trade: reassign teamId on every player and log it to
 * history.transactions. Returns a NEW league. Throws if the deal isn't
 * mutually acceptable (call evaluateTrade first if you want to inspect).
 */
function executeTrade(inputLeague, proposal) {
  const league = cloneLeague(inputLeague);
  const verdict = evaluateTrade(league, proposal);
  if (!verdict.accepted) {
    throw new Error(
      `Trade rejected (A accepts: ${verdict.aAccepts}, B accepts: ${verdict.bAccepts}).`
    );
  }
  for (const id of proposal.sendFromA) getPlayer(league, id).teamId = proposal.teamB;
  for (const id of proposal.sendFromB) getPlayer(league, id).teamId = proposal.teamA;

  league.history = league.history || { seasons: [], champions: [], transactions: [] };
  league.history.transactions = league.history.transactions || [];
  league.history.transactions.push({
    type: 'trade',
    season: league.meta.currentSeason,
    teamA: proposal.teamA,
    teamB: proposal.teamB,
    sendFromA: proposal.sendFromA,
    sendFromB: proposal.sendFromB,
    verdict,
  });
  return league;
}

/**
 * Suggest a plausible trade for a given team by scanning partners for a
 * mutually beneficial 1-for-1 swap. Great as a starting point for a prompt/AI
 * step to refine. Returns the best proposal found, or null.
 *
 * @param {object} league
 * @param {string} teamId - the team we're finding a trade for
 */
function suggestTrade(league, teamId) {
  const rng = RNG.forStream(league.meta.rngSeed, `trade:${league.meta.currentSeason}:${teamId}`);
  const myRoster = playersByTeam(league, teamId);
  let best = null;

  for (const other of league.teams) {
    if (other.id === teamId) continue;
    const theirRoster = playersByTeam(league, other.id);
    for (const mine of myRoster) {
      for (const theirs of theirRoster) {
        const proposal = {
          teamA: teamId,
          teamB: other.id,
          sendFromA: [mine.id],
          sendFromB: [theirs.id],
        };
        let verdict;
        try {
          verdict = evaluateTrade(league, proposal);
        } catch (_) {
          continue;
        }
        if (!verdict.accepted) continue;
        // Score by how much value WE (teamId = side A) net gain.
        const gain = verdict.aReceives - verdict.aGives + rng.float(-0.5, 0.5);
        if (!best || gain > best.gain) best = { proposal, verdict, gain };
      }
    }
  }
  return best;
}

module.exports = {
  teamMode,
  evaluateTrade,
  executeTrade,
  suggestTrade,
  packageValueFor,
};

/* ---------- CLI: `node engine/tradeAI.js <file> [teamId] [--save]` ---------- */
if (require.main === module) {
  const file = process.argv[2] || 'saves/example_league.json';
  const doSave = process.argv.includes('--save');
  const league = loadLeague(file);
  const teamId = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : league.teams[0].id;
  const team = getTeam(league, teamId);
  console.log(`\n=== Trade search for ${team.city} ${team.name} (${teamMode(league, teamId)}) ===`);
  const found = suggestTrade(league, teamId);
  if (!found) {
    console.log('No mutually acceptable trade found.');
  } else {
    const { proposal, verdict } = found;
    const nameOf = (id) => getPlayer(league, id).name;
    console.log(`Send:    ${proposal.sendFromA.map(nameOf).join(', ')}`);
    console.log(`Receive: ${proposal.sendFromB.map(nameOf).join(', ')}`);
    console.log(`From:    ${getTeam(league, proposal.teamB).name} (${verdict.modeB})`);
    console.log(`Value — you give ${verdict.aGives}, you get ${verdict.aReceives}`);
    if (doSave) {
      const updated = executeTrade(league, proposal);
      saveLeague(updated, file);
      console.log(`\nExecuted & saved -> ${file}`);
    } else {
      console.log('\n(dry run — pass --save to execute & write the trade)');
    }
  }
}
