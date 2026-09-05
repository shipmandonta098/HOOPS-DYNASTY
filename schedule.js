'use strict';

/**
 * schedule.js — the season's fixture list.
 *
 * WHERE THE LINE IS. A schedule is a PLAN: who plays whom, where, and on what
 * date. Generating that from the league's real teams is the same kind of thing
 * as generating the league's structure or its players, and without it the
 * Schedule screen has nothing to show.
 *
 * A RESULT is not a plan. Scores, records, streaks, home and away splits and
 * standings position are facts about games that have been played, and this file
 * produces none of them. Every fixture starts with `played: false` and no
 * score, the screen reads results off games actually simulated, and in a league
 * where nothing has been simulated every one of those columns is honestly
 * empty. Nothing here invents a result, a venue, a broadcaster or a tip-off
 * time.
 *
 * Deterministic from the league's own seed, so the same league always produces
 * the same season and the schedule survives a reload without being stored twice.
 */

import { makeRNG, hashString } from './leagueConfig.js';

/**
 * How many times a pair of teams meets, by how closely related they are.
 * Same division most often, then the rest of the conference, then everyone
 * else — the shape almost every real league uses.
 */
export const MEETINGS = { division: 4, conference: 3, interConference: 2 };

/** The season runs from late October to mid-April, like a real one. */
const SEASON_START = { month: 9, day: 22 };    // month is 0-based: October
const SEASON_END = { month: 3, day: 12 };      // April

/**
 * Which division and conference each team belongs to, from whichever fields
 * the save actually carries. Older leagues store only a conference.
 */
function alignmentOf(league) {
  const map = {};
  for (const t of league.teams || []) {
    map[t.id] = {
      conference: t.conference || t.conferenceId || null,
      division: t.division || t.divisionId || null,
    };
  }
  return map;
}

/** How many times these two should meet. */
function meetingsFor(a, b, align) {
  const x = align[a], y = align[b];
  if (!x || !y) return MEETINGS.interConference;
  if (x.division && y.division && x.division === y.division) return MEETINGS.division;
  if (x.conference && y.conference && x.conference === y.conference) return MEETINGS.conference;
  return MEETINGS.interConference;
}

/**
 * Every game of the season as an unordered pairing turned into home and away.
 *
 * An even number of meetings splits exactly. An odd number cannot, so the extra
 * game alternates by a stable hash of the two ids — which means the imbalance
 * is spread across the league rather than always falling on the same teams, and
 * it is the same every time this runs.
 */
function buildPairings(teams, align, rng) {
  const games = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const a = teams[i].id, b = teams[j].id;
      const n = meetingsFor(a, b, align);
      const half = Math.floor(n / 2);
      for (let k = 0; k < half; k++) games.push({ home: a, away: b });
      for (let k = 0; k < half; k++) games.push({ home: b, away: a });
      if (n % 2) {
        // The odd game's host, fixed by the pair rather than by chance.
        const aHosts = hashString(`${a}|${b}`) % 2 === 0;
        games.push(aHosts ? { home: a, away: b } : { home: b, away: a });
      }
    }
  }
  // Shuffle so the season is not played in team-id order.
  for (let i = games.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [games[i], games[j]] = [games[j], games[i]];
  }
  return games;
}

/**
 * Deal the games into rounds where no team appears twice, so a team never plays
 * itself into two games on one date.
 *
 * Greedy, which does not produce a perfect round-robin, but a schedule only has
 * to be legal and reasonably spread — and greedy over a shuffled list gives
 * both without the machinery a perfect one needs.
 */
function buildRounds(games) {
  const remaining = games.slice();
  const rounds = [];
  while (remaining.length) {
    const used = new Set();
    const round = [];
    for (let i = 0; i < remaining.length;) {
      const g = remaining[i];
      if (used.has(g.home) || used.has(g.away)) { i++; continue; }
      used.add(g.home); used.add(g.away);
      round.push(g);
      remaining.splice(i, 1);
    }
    rounds.push(round);
  }
  return rounds;
}

/** Every date the season can be played on, evenly covering the window. */
function seasonDates(startYear, count) {
  const start = new Date(Date.UTC(startYear, SEASON_START.month, SEASON_START.day));
  const end = new Date(Date.UTC(startYear + 1, SEASON_END.month, SEASON_END.day));
  const span = Math.round((end - start) / 86400000);
  const dates = [];
  for (let i = 0; i < count; i++) {
    const offset = count === 1 ? 0 : Math.round((i * span) / (count - 1));
    const d = new Date(start.getTime() + offset * 86400000);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * Build a season's fixture list.
 *
 * @param {object} league  needs `teams` and `meta.rngSeed`
 * @param {number} [season] the season year; defaults to the league's current
 * @returns {{ season, games: Array }} each game
 *   `{ id, date, home, away, played:false, homeScore:null, awayScore:null }`
 */
export function buildSchedule(league, season) {
  const teams = (league.teams || []).filter((t) => t && t.id);
  const year = season || (league.meta && league.meta.currentSeason) || 2026;
  if (teams.length < 2) return { season: year, games: [] };

  const rng = makeRNG(hashString(`schedule:${league.meta && league.meta.rngSeed}:${year}`));
  const align = alignmentOf(league);
  const rounds = buildRounds(buildPairings(teams, align, rng));
  const dates = seasonDates(year - 1, rounds.length);

  const games = [];
  rounds.forEach((round, i) => {
    round.forEach((g, j) => {
      games.push({
        id: `g_${year}_${String(i).padStart(3, '0')}_${String(j).padStart(2, '0')}`,
        date: dates[i],
        home: g.home,
        away: g.away,
        // A fixture is a plan. Everything below is a fact about a game that
        // has been played, and stays empty until the simulator fills it in.
        played: false,
        homeScore: null,
        awayScore: null,
      });
    });
  });
  games.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { season: year, games };
}

/* ===========================================================================
 * READING A SCHEDULE
 * ---------------------------------------------------------------------------
 * Everything below derives from games ACTUALLY PLAYED. With none played, every
 * one of these returns an empty record rather than a plausible-looking one.
 * ======================================================================== */

/** One team's games, in date order, with the view from that team's side. */
export function teamGames(schedule, teamId) {
  return (schedule.games || [])
    .filter((g) => g.home === teamId || g.away === teamId)
    .map((g) => {
      const home = g.home === teamId;
      const opponent = home ? g.away : g.home;
      const forScore = home ? g.homeScore : g.awayScore;
      const againstScore = home ? g.awayScore : g.homeScore;
      const result = g.played && forScore != null && againstScore != null
        ? (forScore > againstScore ? 'W' : 'L') : null;
      return { ...g, home, opponent, forScore, againstScore, result };
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * A team's record through the games it has played.
 *
 * Returns nulls rather than zeros where nothing has happened: 0-0 is a claim
 * that a team has played and not won, and "no games yet" is a different
 * statement.
 */
export function teamRecord(games) {
  const done = games.filter((g) => g.result);
  if (!done.length) {
    return { wins: 0, losses: 0, played: 0, home: null, away: null, streak: null, last10: null };
  }
  const tally = (list) => list.reduce((acc, g) => {
    if (g.result === 'W') acc.w++; else acc.l++;
    return acc;
  }, { w: 0, l: 0 });

  const all = tally(done);
  const home = tally(done.filter((g) => g.home));
  const away = tally(done.filter((g) => !g.home));

  // Streak reads backwards from the most recent game.
  let streak = 0, kind = done[done.length - 1].result;
  for (let i = done.length - 1; i >= 0 && done[i].result === kind; i--) streak++;

  const last = done.slice(-10);
  const l10 = tally(last);

  return {
    wins: all.w, losses: all.l, played: done.length,
    home: `${home.w}-${home.l}`, away: `${away.w}-${away.l}`,
    streak: `${kind}${streak}`,
    last10: `${l10.w}-${l10.l}`,
  };
}

/** The running record after each game, for the table's Record column. */
export function runningRecords(games) {
  let w = 0, l = 0;
  return games.map((g) => {
    if (g.result === 'W') w++;
    else if (g.result === 'L') l++;
    return g.result ? `${w}-${l}` : null;
  });
}

/**
 * Every game in the league on one date, for the league-wide day view.
 *
 * Sorted by home team so a day reads in a stable order rather than in whatever
 * order the fixture builder happened to deal them.
 */
export function leagueGamesOn(schedule, date) {
  return (schedule.games || [])
    .filter((g) => g.date === date)
    .map((g) => {
      const result = g.played && g.homeScore != null && g.awayScore != null
        ? (g.homeScore > g.awayScore ? 'home' : 'away') : null;
      return { ...g, winner: result };
    })
    .sort((a, b) => (a.home < b.home ? -1 : a.home > b.home ? 1 : 0));
}

/** How many games the league plays on each date, keyed by date. */
export function gamesPerDate(schedule) {
  const counts = new Map();
  for (const g of schedule.games || []) counts.set(g.date, (counts.get(g.date) || 0) + 1);
  return counts;
}

/** Every date the league plays on, in order. */
export function leagueDates(schedule) {
  return [...new Set((schedule.games || []).map((g) => g.date))].sort();
}

/** The next game that has not been played, or null once the season is over. */
export function nextGame(games) {
  return games.find((g) => !g.played) || null;
}

/** Months the schedule spans, as `{ key: 'YYYY-MM', label, year, month }`. */
export function scheduleMonths(games) {
  const seen = new Map();
  for (const g of games) {
    const key = g.date.slice(0, 7);
    if (!seen.has(key)) {
      const [y, m] = key.split('-').map(Number);
      seen.set(key, { key, year: y, month: m - 1,
        label: new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US',
          { month: 'long', year: 'numeric', timeZone: 'UTC' }) });
    }
  }
  return [...seen.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
}

/** `2026-01-14` -> `Wed, Jan 14`. */
export function formatGameDate(iso) {
  if (!iso) return '—';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US',
    { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** `2026-01-14` -> `Wednesday, January 14, 2026`. */
export function formatLongDate(iso) {
  if (!iso) return '—';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US',
    { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** The schedule as CSV, for the export button. Real fixtures, empty results. */
export function toCSV(games, nameOf) {
  const head = 'Date,Opponent,Location,Result,Score,Record';
  const records = runningRecords(games);
  const rows = games.map((g, i) => [
    g.date,
    nameOf(g.opponent),
    g.home ? 'Home' : 'Away',
    g.result || '',
    g.result ? `${g.forScore}-${g.againstScore}` : '',
    records[i] || '',
  ].map((v) => (/[",]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(','));
  return [head, ...rows].join('\n');
}
