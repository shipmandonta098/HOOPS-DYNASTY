'use strict';

/**
 * compressSeason.js — Season-compression + retention for Hoops Dynasty.
 *
 * WHY THIS EXISTS:
 * A fully-detailed season is HEAVY: full box scores, per-player game logs,
 * per-team game logs, advanced stats. Keep every season at that fidelity and
 * IndexedDB grows without bound and every read/scan gets slower year over year.
 * This module keeps the sim fast by compressing old seasons down to summaries
 * and pruning the heavy raw data out of the live stores.
 *
 * ---------------------------------------------------------------------------
 * DB DEPENDENCY (multi-store IndexedDB layer):
 * This module talks to the database through a small generic interface. Your
 * db.js must export these (see the note at the end of this file / the PR):
 *
 *     saveData(store, key, value)  -> Promise<key>      // put value at key
 *     loadData(store, key)         -> Promise<any|null> // get one record
 *     deleteData(store, key)       -> Promise<void>     // remove one record
 *     getAllData(store)            -> Promise<Array<{ key, value }>>
 *
 * Stores used: league_meta, teams, players, history_seasons, history_awards,
 *              draft_classes, transactions.
 * ---------------------------------------------------------------------------
 *
 * All public functions are async and Promise-based. The pure transform
 * (`compressSeason`) does no I/O so it's easy to unit-test and reason about.
 */

import { saveData, loadData, deleteData, getAllData } from './db.js';

/**
 * Detail levels a stored season can be at. The retention policy (below) moves
 * seasons down this ladder as they age.
 *   full       — everything: box scores, game logs, advanced stats.
 *   semi       — season averages kept; per-game logs & box scores dropped.
 *   compressed — summary only (standings, bracket, awards, averages, top-10 draft).
 */
export const DETAIL = { FULL: 'full', SEMI: 'semi', COMPRESSED: 'compressed' };

/** Transaction types we consider "major" and preserve when pruning. */
const MAJOR_TX_TYPES = new Set(['trade', 'signing', 'retirement', 'draft_pick', 'release']);

/* ===========================================================================
 * 1) PURE TRANSFORM — build a compressed season summary from full season data.
 *    No I/O. Same input -> same output. This is the heart of the module.
 * ======================================================================== */

/**
 * Average an array of stat-line objects: for every numeric field, return its
 * mean across the games. Non-numeric fields are ignored. Rounds to 1 decimal.
 * @param {object[]} logs - per-game stat lines (a player's or team's game logs).
 */
function averageStatLines(logs) {
  if (!Array.isArray(logs) || logs.length === 0) return {};
  const totals = {};
  const counts = {};
  for (const line of logs) {
    for (const [key, val] of Object.entries(line)) {
      if (typeof val !== 'number') continue;
      totals[key] = (totals[key] || 0) + val;
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  const avg = { gamesPlayed: logs.length };
  for (const key of Object.keys(totals)) {
    avg[key] = +(totals[key] / counts[key]).toFixed(1);
  }
  return avg;
}

/**
 * Reduce a player's season to averages only (drop the raw game logs).
 * Prefers computing from `gameLogs`; falls back to any pre-computed `averages`.
 */
function playerSeasonAverage(player) {
  const averages = player.gameLogs
    ? averageStatLines(player.gameLogs)
    : player.averages || {};
  return {
    playerId: player.playerId != null ? player.playerId : player.id,
    name: player.name,
    teamId: player.teamId,
    position: player.position,
    age: player.age,
    averages,
  };
}

/** Reduce a team's season to averages only (drop the raw game logs). */
function teamSeasonAverage(team) {
  const averages = team.gameLogs
    ? averageStatLines(team.gameLogs)
    : team.averages || {};
  return {
    teamId: team.teamId != null ? team.teamId : team.id,
    name: team.name,
    wins: team.wins,
    losses: team.losses,
    averages,
  };
}

/** Keep only the top 10 picks of a draft class, as a light summary. */
function draftClassSummary(draftClass) {
  if (!draftClass) return null;
  const picks = (draftClass.picks || draftClass.prospects || [])
    .slice() // don't mutate caller's array
    .sort((a, b) => (a.pick || a.projectedPick || 999) - (b.pick || b.projectedPick || 999))
    .slice(0, 10)
    .map((p) => ({
      pick: p.pick || p.projectedPick,
      playerId: p.playerId || p.id,
      name: p.name,
      position: p.position,
      teamId: p.teamId || null,
      overall: p.overall,
      potential: p.potential,
    }));
  return { class: draftClass.class || draftClass.year, topPicks: picks };
}

/** Keep only the transactions that matter historically. */
function majorTransactionsOnly(transactions) {
  return (transactions || []).filter((t) => MAJOR_TX_TYPES.has(t.type));
}

/**
 * Build the compressed season summary. Contains ONLY the durable, low-volume
 * facts about a season — never game logs or box scores.
 *
 * @param {object} seasonData - the full season object, with (any of):
 *   { year, standings, playoffBracket, champion, finalsMVP, awards,
 *     players[], teams[], draftClass, transactions[], retirements[],
 *     boxScores[] }
 * @returns {object} compressed season summary keyed by year.
 */
export function compressSeason(seasonData) {
  const year = seasonData.year != null ? seasonData.year : seasonData.season;

  return {
    schemaVersion: 1,
    detailLevel: DETAIL.COMPRESSED,
    year,

    // Final standings and how the playoffs went.
    standings: seasonData.standings || [],
    playoffBracket: seasonData.playoffBracket || seasonData.bracket || null,

    // Who won it all + hardware.
    champion: seasonData.champion || null,
    finalsMVP: seasonData.finalsMVP || null,
    awards: seasonData.awards || {}, // { MVP, DPOY, ROY, SMOY, MIP, ... }

    // Season averages only — game logs are intentionally discarded here.
    playerAverages: (seasonData.players || []).map(playerSeasonAverage),
    teamAverages: (seasonData.teams || []).map(teamSeasonAverage),

    // Light draft memory: top 10 picks.
    draftClass: draftClassSummary(seasonData.draftClass),

    // Only historically meaningful moves survive.
    majorTransactions: majorTransactionsOnly(seasonData.transactions),
    retirements: seasonData.retirements || [],

    compressedAt: new Date().toISOString(),
  };
}

/* ===========================================================================
 * 2) PERSIST — write the compressed summary into history_seasons.
 * ======================================================================== */

/**
 * Save a compressed season into the history_seasons store, keyed by year.
 * @param {number} year
 * @param {object} compressedSeason
 */
export async function saveCompressedSeason(year, compressedSeason) {
  return saveData('history_seasons', year, compressedSeason);
}

/* ===========================================================================
 * 3) PRUNE — remove heavy data from the live stores for a given season/year.
 *    Each helper loads records, strips the heavy fields, and writes them back.
 * ======================================================================== */

/** Remove per-game logs (and advanced per-game stats) from every player. */
async function prunePlayerGameLogs() {
  const players = await getAllData('players');
  for (const { key, value } of players) {
    if (!value) continue;
    if ('gameLogs' in value || 'advancedGameStats' in value) {
      delete value.gameLogs;
      delete value.advancedGameStats;
      await saveData('players', key, value);
    }
  }
}

/** Remove per-game logs from every team. */
async function pruneTeamGameLogs() {
  const teams = await getAllData('teams');
  for (const { key, value } of teams) {
    if (!value) continue;
    if ('gameLogs' in value || 'advancedGameStats' in value) {
      delete value.gameLogs;
      delete value.advancedGameStats;
      await saveData('teams', key, value);
    }
  }
}

/**
 * Remove full box scores from a stored season in history_seasons. Box scores
 * are the single biggest blob; a compressed season should never carry them.
 * @param {number} year
 */
async function pruneSeasonBoxScores(year) {
  const season = await loadData('history_seasons', year);
  if (season && ('boxScores' in season || 'gameResults' in season)) {
    delete season.boxScores;
    delete season.gameResults;
    await saveData('history_seasons', year, season);
  }
}

/**
 * Reduce a stored draft class to its top-10 summary.
 * @param {number} year
 */
async function pruneDraftClass(year) {
  const dc = await loadData('draft_classes', year);
  if (dc && !dc._summarized) {
    const summary = draftClassSummary(dc);
    if (summary) {
      summary._summarized = true;
      await saveData('draft_classes', year, summary);
    }
  }
}

/**
 * Reduce the transactions store for a season to major events only.
 * Assumes transactions are keyed/tagged by `season`. Rewrites each record that
 * belongs to `year`, dropping non-major entries.
 * @param {number} year
 */
async function pruneTransactions(year) {
  const all = await getAllData('transactions');
  for (const { key, value } of all) {
    if (!value) continue;
    // A record may be a single tx, or a per-season bucket { season, items[] }.
    if (Array.isArray(value.items) && value.season === year) {
      const before = value.items.length;
      value.items = majorTransactionsOnly(value.items);
      if (value.items.length !== before) await saveData('transactions', key, value);
    } else if (value.season === year && !MAJOR_TX_TYPES.has(value.type)) {
      await deleteData('transactions', key);
    }
  }
}

/* ===========================================================================
 * 4) RETENTION POLICY — decide each past season's detail level by age.
 *      currentYear      -> full     (leave everything alone)
 *      currentYear - 1  -> semi     (drop game logs + box scores, keep averages)
 *      <= currentYear-2 -> compressed (summary only; prune everything heavy)
 * ======================================================================== */

/**
 * Apply the retention policy across all stored seasons.
 * @param {number} currentYear - the season that was just completed/started.
 */
export async function applyRetentionPolicy(currentYear) {
  const seasons = await getAllData('history_seasons');

  for (const { key, value } of seasons) {
    if (!value) continue;
    const year = value.year != null ? value.year : Number(key);
    const age = currentYear - year;

    if (age <= 0) {
      // Current season: keep full detail. Nothing to do.
      continue;
    }

    if (age === 1) {
      // Previous season: SEMI. Strip per-game logs + box scores, keep averages.
      if (value.detailLevel !== DETAIL.SEMI && value.detailLevel !== DETAIL.COMPRESSED) {
        await pruneSeasonBoxScores(year);
        const semi = await loadData('history_seasons', year);
        if (semi) {
          semi.detailLevel = DETAIL.SEMI;
          await saveData('history_seasons', year, semi);
        }
      }
      continue;
    }

    // age >= 2: fully COMPRESSED. Prune everything heavy tied to this year.
    if (value.detailLevel !== DETAIL.COMPRESSED) {
      await pruneSeasonBoxScores(year);
      await pruneDraftClass(year);
      await pruneTransactions(year);
      // Reload AFTER pruning — pruneSeasonBoxScores() already rewrote this
      // record, so `value` is stale and would re-introduce the box scores if
      // we saved it. Read the pruned copy, then stamp the detail level on it.
      const compressed = await loadData('history_seasons', year);
      if (compressed) {
        compressed.detailLevel = DETAIL.COMPRESSED;
        await saveData('history_seasons', year, compressed);
      }
    }
  }

  // Player/team game logs are per-season working data; once we're past the
  // previous season they're no longer needed in the live rosters. Prune globally.
  await prunePlayerGameLogs();
  await pruneTeamGameLogs();
}

/* ===========================================================================
 * 5) ORCHESTRATOR — call this once at the end of each simulated season.
 * ======================================================================== */

/**
 * End-of-season compression pipeline. Call after a season finishes simulating.
 *
 *   1. Build the compressed summary from the full season data.
 *   2. Save it into history_seasons (keyed by year).
 *   3. Apply the retention policy so older seasons get pruned/compressed.
 *
 * @param {object} seasonData - the full season object (see compressSeason()).
 * @returns {Promise<object>} the compressed summary that was stored.
 */
export async function compressAndStoreSeason(seasonData) {
  const year = seasonData.year != null ? seasonData.year : seasonData.season;
  if (year == null) throw new Error('compressAndStoreSeason: seasonData needs a year.');

  // Step 1 — compress (pure).
  const compressed = compressSeason(seasonData);

  // Step 2 — persist the summary.
  await saveCompressedSeason(year, compressed);

  // Step 3 — prune box scores from THIS just-stored season immediately (the
  // summary must never carry them) then age everything else per policy.
  await pruneSeasonBoxScores(year);
  await applyRetentionPolicy(year);

  return compressed;
}

/* Default export: the orchestrator is the common entry point. */
export default compressAndStoreSeason;
