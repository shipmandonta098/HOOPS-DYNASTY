'use strict';

/**
 * updateContracts.js — Age contracts by one year, expire deals, and move
 * players with no contract into free agency.
 *
 * CONTRACT: league -> league (new object).
 * Determinism: no randomness by default — contract math is pure arithmetic.
 * (Re-signing decisions that need randomness pull from a seeded stream.)
 *
 * WHAT A CONTRACT LOOKS LIKE (see schemas/player.schema.json):
 *   contract: {
 *     salary: number,        // $M per year
 *     yearsRemaining: number,
 *     type: "rookie" | "standard" | "max" | "vet_min",
 *     playerOption: boolean, // player can opt out after this year
 *     teamOption: boolean    // team can decline next year
 *   }
 *
 * THE OFFSEASON CONTRACT STEP:
 *   1. Decrement yearsRemaining on every active contract.
 *   2. When yearsRemaining hits 0, the contract expires -> player becomes a
 *      free agent (teamId = null, added to league.freeAgents).
 *   3. Report cap situation per team so a prompt/AI step can make signings.
 *
 * Free-agent SIGNING (offering new deals) is deliberately left to a prompt/AI
 * step — see prompts/run_trade_logic.md and README "Free agency" expansion —
 * because who to sign is a strategy decision, not bookkeeping.
 */

const { computeOverall } = require('./lib/ratings');
const { loadLeague, saveLeague, cloneLeague, playersByTeam } = require('./saveLoad');

/**
 * A rough "fair market" salary ($M) for a player, used to flag underpaid gems
 * and overpaid albatrosses. Purely advisory — nothing is forced.
 */
function fairSalary(player) {
  const overall = computeOverall(player);
  if (overall >= 88) return 45; // supermax territory
  if (overall >= 80) return 32;
  if (overall >= 74) return 22;
  if (overall >= 68) return 13;
  if (overall >= 62) return 7;
  if (overall >= 56) return 3;
  return 1.5; // minimum-ish
}

/**
 * Compute a team's total committed salary and cap space.
 */
function teamCap(league, teamId) {
  const cap = (league.settings && league.settings.salaryCap) || 140;
  const roster = playersByTeam(league, teamId);
  const committed = roster.reduce(
    (s, p) => s + (p.contract && p.contract.salary ? p.contract.salary : 0),
    0
  );
  return {
    teamId,
    rosterSize: roster.length,
    committed: +committed.toFixed(1),
    capSpace: +(cap - committed).toFixed(1),
    overCap: committed > cap,
  };
}

/**
 * Advance all contracts one year and process expirations.
 * @param {object} inputLeague
 */
function updateContracts(inputLeague) {
  const league = cloneLeague(inputLeague);
  const season = league.meta.currentSeason;
  league.freeAgents = league.freeAgents || [];
  const newlyFree = [];

  for (const player of league.players) {
    const c = player.contract;
    if (!c) {
      // No contract at all -> treat as a free agent needing a deal.
      if (player.teamId) {
        player.teamId = null;
      }
      if (!league.freeAgents.includes(player.id)) {
        league.freeAgents.push(player.id);
        newlyFree.push(player.id);
      }
      continue;
    }

    // Decrement the deal.
    c.yearsRemaining = Math.max(0, (c.yearsRemaining || 0) - 1);

    if (c.yearsRemaining <= 0) {
      // Contract expired -> free agency.
      player.contract = null;
      const priorTeam = player.teamId;
      player.teamId = null;
      if (!league.freeAgents.includes(player.id)) {
        league.freeAgents.push(player.id);
      }
      newlyFree.push(player.id);

      league.history = league.history || { seasons: [], champions: [], transactions: [] };
      league.history.transactions = league.history.transactions || [];
      league.history.transactions.push({
        type: 'contract_expired',
        season,
        playerId: player.id,
        priorTeam,
      });
    }
  }

  // Attach an advisory cap report for every team (handy for prompts).
  league.capReport = league.teams.map((t) => teamCap(league, t.id));
  league.meta.lastContractUpdateSeason = season;

  // Stash which players just hit the market this cycle (prompt convenience).
  league.meta.newlyFreeAgents = newlyFree;
  return league;
}

/**
 * Helper for a signing step: offer a free agent a contract and roster them.
 * Pure-ish (returns new league). Enforces roster size + basic cap sanity.
 *
 * @param {object} inputLeague
 * @param {object} signing - { playerId, teamId, salary, years, type }
 */
function signFreeAgent(inputLeague, signing) {
  const league = cloneLeague(inputLeague);
  const player = league.players.find((p) => p.id === signing.playerId);
  if (!player) throw new Error(`No such player: ${signing.playerId}`);
  if (player.teamId) throw new Error(`${player.name} is not a free agent.`);

  const maxRoster = (league.settings && league.settings.maxRosterSize) || 15;
  if (playersByTeam(league, signing.teamId).length >= maxRoster) {
    throw new Error(`Roster full for ${signing.teamId}.`);
  }

  player.teamId = signing.teamId;
  player.contract = {
    salary: signing.salary,
    yearsRemaining: signing.years,
    type: signing.type || 'standard',
    playerOption: false,
    teamOption: false,
  };
  league.freeAgents = (league.freeAgents || []).filter((id) => id !== signing.playerId);

  league.history = league.history || { seasons: [], champions: [], transactions: [] };
  league.history.transactions = league.history.transactions || [];
  league.history.transactions.push({
    type: 'signing',
    season: league.meta.currentSeason,
    playerId: signing.playerId,
    teamId: signing.teamId,
    salary: signing.salary,
    years: signing.years,
  });
  return league;
}

module.exports = { updateContracts, signFreeAgent, teamCap, fairSalary };

/* ---------- CLI: `node engine/updateContracts.js <file> [--save]` ---------- */
if (require.main === module) {
  const file = process.argv[2] || 'saves/example_league.json';
  const doSave = process.argv.includes('--save');
  const league = loadLeague(file);
  const updated = updateContracts(league);
  console.log(`\n=== Contract update (season ${updated.meta.currentSeason}) ===`);
  console.log(`Newly free agents: ${updated.meta.newlyFreeAgents.length}`);
  console.log('\nCap situation:');
  updated.capReport.forEach((c) => {
    const team = updated.teams.find((t) => t.id === c.teamId);
    console.log(
      `  ${(team.city + ' ' + team.name).padEnd(24)} $${c.committed}M committed, ` +
        `$${c.capSpace}M space${c.overCap ? '  [OVER CAP]' : ''}  (${c.rosterSize} players)`
    );
  });
  if (doSave) {
    saveLeague(updated, file);
    console.log(`\nSaved -> ${file}`);
  } else {
    console.log('\n(dry run — pass --save to write results back)');
  }
}
