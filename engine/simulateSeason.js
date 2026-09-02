'use strict';

/**
 * simulateSeason.js — Play a full regular season + playoffs, crown a champion,
 * and append the result to league history.
 *
 * CONTRACT (shared by every engine module):
 *   input:  a league object
 *   output: a NEW league object (input is never mutated)
 *   determinism: fully deterministic given league.meta.rngSeed +
 *                league.meta.currentSeason. Re-running yields identical results.
 *
 * WHAT IT DOES, IN ORDER:
 *   1. Build a balanced schedule (every team plays every other team N times).
 *   2. Simulate each game from team strength + a seeded random swing.
 *   3. Compute standings, per-team and per-player season stats.
 *   4. Seed a playoff bracket from the standings and simulate best-of-7 rounds.
 *   5. Record a full season summary in league.history.
 *   6. Advance meta.currentSeason and set the phase to "offseason".
 *
 * WHAT IT DOESN'T DO (on purpose — keep modules single-responsibility):
 *   - Age players or change ratings  -> playerDevelopment.js
 *   - Expire/renew contracts         -> updateContracts.js
 *   - Create next year's prospects   -> generateDraftClass.js
 *
 * Run the modules in that cycle order each year (see README).
 */

const { RNG } = require('./lib/rng');
const { teamStrength, playerImpact, computeOverall } = require('./lib/ratings');
const { loadLeague, saveLeague, cloneLeague, playersByTeam } = require('./saveLoad');

/**
 * Build a double(-ish) round-robin schedule. Each pair of teams meets
 * `meetings` times, home/away alternating. Deterministic ordering.
 */
function buildSchedule(teams, meetings) {
  const games = [];
  for (let m = 0; m < meetings; m++) {
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        // Alternate who's home each meeting for fairness.
        const home = m % 2 === 0 ? teams[i] : teams[j];
        const away = m % 2 === 0 ? teams[j] : teams[i];
        games.push({ home: home.id, away: away.id });
      }
    }
  }
  return games;
}

/**
 * Simulate a single game. Returns { homeScore, awayScore }.
 *
 * Model: each team's strength maps to an expected points total around a
 * league-average of ~110. A seeded gaussian swing represents "any given night".
 * Home court adds a small bump. This is intentionally simple but produces
 * believable score lines and win distributions.
 */
function simulateGame(homeStrength, awayStrength, rng) {
  const HOME_COURT = 2.5; // strength points
  const BASE_POINTS = 108;
  const POINTS_PER_STRENGTH = 0.9; // how much a strength edge is worth
  const NIGHTLY_STD = 9; // scoring variance ("any given night")

  const hAdj = homeStrength + HOME_COURT;
  const aAdj = awayStrength;

  const homeScore = Math.round(
    BASE_POINTS + (hAdj - 50) * POINTS_PER_STRENGTH + rng.gaussian(0, NIGHTLY_STD)
  );
  const awayScore = Math.round(
    BASE_POINTS + (aAdj - 50) * POINTS_PER_STRENGTH + rng.gaussian(0, NIGHTLY_STD)
  );

  // No ties in basketball — settle with one more possession, favoring strength.
  if (homeScore === awayScore) {
    return hAdj >= aAdj
      ? { homeScore: homeScore + 2, awayScore }
      : { homeScore, awayScore: awayScore + 2 };
  }
  return { homeScore, awayScore };
}

/**
 * Simulate a best-of-7 series between two seeds. Returns the winning teamId.
 * Higher seed gets home court (games 1,2,5,7).
 */
function simulateSeries(high, low, strengthOf, rng) {
  let highWins = 0;
  let lowWins = 0;
  const homeGames = new Set([1, 2, 5, 7]);
  let game = 1;
  while (highWins < 4 && lowWins < 4) {
    const highHome = homeGames.has(game);
    const res = highHome
      ? simulateGame(strengthOf(high), strengthOf(low), rng)
      : simulateGame(strengthOf(low), strengthOf(high), rng);
    const highScored = highHome ? res.homeScore : res.awayScore;
    const lowScored = highHome ? res.awayScore : res.homeScore;
    if (highScored > lowScored) highWins++;
    else lowWins++;
    game++;
  }
  return { winner: highWins === 4 ? high : low, highWins, lowWins };
}

/**
 * Estimate a player's per-game box-score line for the season. Deterministic,
 * derived from ability + role. Good enough to make history feel alive; expand
 * later if you want fuller stat tracking.
 */
function estimatePlayerStats(player, teamRank, rng) {
  const overall = computeOverall(player);
  const attrs = player.attributes || {};
  // Usage: better players (and better teams' stars) shoulder more scoring.
  const usage = Math.max(0.05, (overall - 45) / 55);
  const ppg = +(6 + usage * 20 + rng.gaussian(0, 1.5)).toFixed(1);
  const rpg = +(
    2 + ((attrs.defensiveRebound || 50) + (attrs.offensiveRebound || 50)) / 40 + rng.gaussian(0, 0.7)
  ).toFixed(1);
  const apg = +(
    1 + ((attrs.passing || 50) + (attrs.ballHandling || 50)) / 60 + rng.gaussian(0, 0.6)
  ).toFixed(1);
  return {
    ppg: Math.max(0, ppg),
    rpg: Math.max(0, rpg),
    apg: Math.max(0, apg),
  };
}

/**
 * Main entry point. Pure: returns a new league, does not touch disk.
 * @param {object} inputLeague
 * @param {object} [options] - { meetings?: number } override games per matchup.
 */
function simulateSeason(inputLeague, options = {}) {
  const league = cloneLeague(inputLeague);
  const year = league.meta.currentSeason;
  const rng = RNG.forStream(league.meta.rngSeed, `season:${year}`);

  const teams = league.teams;
  if (teams.length < 2) throw new Error('Need at least 2 teams to simulate a season.');

  // Pre-compute each team's strength once from its current roster.
  const strengthById = {};
  for (const team of teams) {
    strengthById[team.id] = teamStrength(playersByTeam(league, team.id));
  }
  const strengthOf = (id) => strengthById[id];

  // Standings accumulator.
  const record = {};
  for (const team of teams) {
    record[team.id] = { teamId: team.id, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 };
  }

  // How many times each pair meets. Default scales to a sensible season length.
  const meetings =
    options.meetings || (league.settings && league.settings.meetingsPerMatchup) || 4;

  // ---- Regular season ----
  const schedule = buildSchedule(teams, meetings);
  for (const g of schedule) {
    const res = simulateGame(strengthOf(g.home), strengthOf(g.away), rng);
    const h = record[g.home];
    const a = record[g.away];
    h.pointsFor += res.homeScore;
    h.pointsAgainst += res.awayScore;
    a.pointsFor += res.awayScore;
    a.pointsAgainst += res.homeScore;
    if (res.homeScore > res.awayScore) {
      h.wins++;
      a.losses++;
    } else {
      a.wins++;
      h.losses++;
    }
  }

  // Rank teams: wins first, then point differential as the tiebreaker.
  const standings = Object.values(record).sort((x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins;
    return y.pointsFor - y.pointsAgainst - (x.pointsFor - x.pointsAgainst);
  });
  standings.forEach((s, i) => {
    s.seed = i + 1;
    s.diff = s.pointsFor - s.pointsAgainst;
  });

  // ---- Player season stats (attach to each player's statsHistory) ----
  const teamRankById = {};
  standings.forEach((s) => (teamRankById[s.teamId] = s.seed));
  for (const player of league.players) {
    if (!player.teamId) continue; // skip free agents
    const line = estimatePlayerStats(player, teamRankById[player.teamId], rng);
    player.statsHistory = player.statsHistory || [];
    player.statsHistory.push({ season: year, ...line });
  }

  // ---- Playoffs: top 2^k seeds into a bracket ----
  const bracketSize = largestPowerOfTwo(Math.min(standings.length, 8));
  const playoffTeams = standings.slice(0, bracketSize).map((s) => s.teamId);
  const { champion, runnerUp, rounds } = simulatePlayoffs(playoffTeams, strengthOf, rng);

  // ---- Award: simple regular-season MVP = best player on a top team ----
  const mvp = pickMVP(league, standings);

  // ---- Record history ----
  league.history = league.history || { seasons: [], champions: [], transactions: [] };
  const championName = teamName(league, champion);
  const seasonSummary = {
    season: year,
    standings: standings.map((s) => ({
      teamId: s.teamId,
      teamName: teamName(league, s.teamId),
      wins: s.wins,
      losses: s.losses,
      diff: s.diff,
      seed: s.seed,
    })),
    champion,
    championName,
    runnerUp,
    runnerUpName: teamName(league, runnerUp),
    playoffRounds: rounds,
    mvp: mvp ? { playerId: mvp.id, name: mvp.name, overall: computeOverall(mvp) } : null,
  };
  league.history.seasons.push(seasonSummary);
  league.history.champions.push({ season: year, teamId: champion, teamName: championName });

  // Bump the championship counter on the team record for quick display.
  const champTeam = teams.find((t) => t.id === champion);
  if (champTeam) champTeam.championships = (champTeam.championships || 0) + 1;

  // ---- Advance the clock ----
  league.meta.currentPhase = 'offseason';
  league.meta.lastSimulatedSeason = year;
  league.meta.currentSeason = year + 1;

  return league;
}

/* ---------------- helpers ---------------- */

function largestPowerOfTwo(n) {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

/**
 * Standard bracket: 1 vs N, 2 vs N-1, ... winners advance. Best-of-7 each round.
 */
function simulatePlayoffs(seededTeamIds, strengthOf, rng) {
  const rounds = [];
  let alive = [...seededTeamIds]; // already in seed order (index 0 = 1 seed)
  while (alive.length > 1) {
    const roundResults = [];
    const next = [];
    for (let i = 0; i < alive.length / 2; i++) {
      const high = alive[i];
      const low = alive[alive.length - 1 - i];
      const series = simulateSeries(high, low, strengthOf, rng);
      roundResults.push({
        high,
        low,
        winner: series.winner,
        result: `${series.highWins}-${series.lowWins}`,
      });
      next.push(series.winner);
    }
    rounds.push(roundResults);
    alive = next;
  }
  const champion = alive[0];
  // Runner-up = the losing finalist from the final round.
  const finalRound = rounds[rounds.length - 1][0];
  const runnerUp = finalRound.winner === finalRound.high ? finalRound.low : finalRound.high;
  return { champion, runnerUp, rounds };
}

function pickMVP(league, standings) {
  // Consider only playoff-caliber teams; reward the best individual on them.
  const topTeamIds = new Set(standings.slice(0, Math.ceil(standings.length / 2)).map((s) => s.teamId));
  let best = null;
  let bestScore = -1;
  for (const p of league.players) {
    if (!topTeamIds.has(p.teamId)) continue;
    const score = computeOverall(p);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

function teamName(league, teamId) {
  const t = league.teams.find((x) => x.id === teamId);
  return t ? `${t.city} ${t.name}` : teamId;
}

module.exports = { simulateSeason, simulateGame, simulateSeries, buildSchedule };

/* ---------- CLI: `node engine/simulateSeason.js <file> [--save]` ---------- */
if (require.main === module) {
  const file = process.argv[2] || 'saves/example_league.json';
  const doSave = process.argv.includes('--save');
  const league = loadLeague(file);
  const seasonPlayed = league.meta.currentSeason;
  const updated = simulateSeason(league);
  const summary = updated.history.seasons[updated.history.seasons.length - 1];
  console.log(`\n=== ${seasonPlayed} Season Results ===`);
  console.log('Standings:');
  summary.standings.forEach((s) =>
    console.log(`  #${s.seed}  ${s.teamName.padEnd(24)} ${s.wins}-${s.losses}  (${s.diff >= 0 ? '+' : ''}${s.diff})`)
  );
  console.log(`\nChampion: ${summary.championName}`);
  console.log(`Runner-up: ${summary.runnerUpName}`);
  if (summary.mvp) console.log(`MVP: ${summary.mvp.name} (${summary.mvp.overall} OVR)`);
  if (doSave) {
    saveLeague(updated, file);
    console.log(`\nSaved -> ${file} (now season ${updated.meta.currentSeason}, phase ${updated.meta.currentPhase})`);
  } else {
    console.log('\n(dry run — pass --save to write results back to the file)');
  }
}
