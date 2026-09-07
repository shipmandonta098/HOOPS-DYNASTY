'use strict';

/**
 * seasonClock.js — where the league is in time, and moving it forward.
 *
 * WHAT ADVANCING IS. Every fixture up to and including the target date gets
 * played, and the clock moves to that date. Nothing else happens: no result is
 * invented, no game is skipped, and a fixture that was already played is left
 * exactly as it was. Advancing a month and pressing Sim on each of that month's
 * games one at a time produce identical scores, because the simulator is seeded
 * per fixture and does not care how it was asked.
 *
 * THE CLOCK IS NEW. Saves made before this have no current date, so it is
 * derived on first read from what has actually been played — the day after the
 * last completed fixture, or the first day of the season if none has been. That
 * is a fact about the save rather than a default, so an existing career resumes
 * where it actually is.
 *
 * PRESEASON COUNTS. Exhibitions have dates and sit before the season, so
 * advancing through them plays them. They still count towards nothing; they are
 * fixtures on a calendar, and the calendar is what this moves.
 */

import { simulateGame, applyResult } from './gameSim.js';

const dayNum = (iso) => {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
};
const isoOf = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
const addDays = (iso, n) => isoOf(dayNum(iso) + n);

/** Every fixture the league has, season and preseason together, in date order. */
export function allFixtures(league) {
  const sch = (league && league.schedule) || {};
  const pre = (sch.preseason && sch.preseason.games) || [];
  return [...pre, ...(sch.games || [])]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * The league's current date.
 *
 * Stored once set, derived from the fixture list before that — the day after
 * the last played game, so a career that has simulated three days resumes on
 * the fourth rather than at the start of the season.
 */
export function currentDate(league) {
  const stored = league && league.meta && league.meta.currentDate;
  if (stored) return String(stored).slice(0, 10);
  const games = allFixtures(league);
  if (!games.length) return null;
  const played = games.filter((g) => g.played);
  return played.length
    ? addDays(played[played.length - 1].date, 1)
    : games[0].date;
}

/** The last date the league has a fixture on. */
export function seasonEnd(league) {
  const games = allFixtures(league);
  return games.length ? games[games.length - 1].date : null;
}

/** The first date of the regular season, which is where the preseason ends. */
export function seasonStart(league) {
  const games = ((league.schedule || {}).games) || [];
  return games.length ? games.map((g) => g.date).sort()[0] : null;
}

/**
 * Where the league is, in words, and what remains.
 *
 * `phase` is read off the calendar rather than off a stored label, so it cannot
 * disagree with the fixtures — a league whose preseason games are all played
 * and whose season has not started is in the gap between them, and says so.
 */
export function clockState(league) {
  const date = currentDate(league);
  const sch = (league && league.schedule) || {};
  const season = (sch.games || []);
  const pre = ((sch.preseason || {}).games) || [];
  const start = seasonStart(league);
  const end = seasonEnd(league);

  const remaining = allFixtures(league).filter((g) => !g.played);
  const seasonLeft = season.filter((g) => !g.played).length;
  const preLeft = pre.filter((g) => !g.played).length;

  let phase = 'regular';
  if (!date) phase = 'none';
  else if (preLeft && start && date < start) phase = 'preseason';
  else if (!seasonLeft && !preLeft) phase = 'complete';
  else if (start && date < start) phase = 'gap';

  return {
    date, start, end, phase,
    remaining: remaining.length,
    seasonLeft, preLeft,
    played: season.filter((g) => g.played).length,
    total: season.length,
    /** The next fixture anywhere, and the next one for a given club. */
    next: remaining[0] || null,
    nextFor: (teamId) => remaining.find((g) => g.home === teamId || g.away === teamId) || null,
  };
}

/** The advance targets the toolbar offers. */
export const STEPS = [
  { id: 'day', label: 'Day', hint: 'Play everything scheduled for one more day.' },
  { id: 'week', label: 'Week', hint: 'Seven days.' },
  { id: 'month', label: 'Month', hint: 'One calendar month.' },
  { id: 'next', label: 'Next Game', hint: 'Up to and including your club’s next fixture.' },
  { id: 'playoffs', label: 'To Playoffs', hint: 'Play out the rest of the regular season.' },
];

/**
 * The date a step lands on.
 *
 * Returns null when there is nowhere to go — a season with nothing left, or a
 * club with no fixture remaining — so the button can be disabled rather than
 * pressed to no effect.
 */
export function targetDate(league, step, teamId) {
  const s = clockState(league);
  if (!s.date) return null;
  switch (step) {
    case 'day': return s.remaining ? s.date : null;
    case 'week': return s.remaining ? addDays(s.date, 6) : null;
    case 'month': {
      if (!s.remaining) return null;
      const [y, m, d] = s.date.split('-').map(Number);
      // One calendar month, not thirty days: a month from the 31st lands on
      // the last day of a shorter one rather than spilling into the next.
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const next = new Date(Date.UTC(y, m, Math.min(d, last)));
      return addDays(next.toISOString().slice(0, 10), -1);
    }
    case 'next': {
      const g = teamId ? s.nextFor(teamId) : s.next;
      return g ? g.date : null;
    }
    case 'playoffs': return s.seasonLeft || s.preLeft ? s.end : null;
    default: return null;
  }
}

/**
 * Play every unplayed fixture up to and including `through`, and move the clock.
 *
 * @param {object} league   mutated in place
 * @param {string} through  the last date to play
 * @param {object} [opts]   `stopAt` halts before a date, for stopping at a game
 * @returns {{ played, results, from, to, stopped }} a report the screen can
 *   show, because advancing silently past forty games tells the user nothing.
 */
export function advanceTo(league, through, opts = {}) {
  const from = currentDate(league);
  if (!from || !through) return { played: 0, results: [], from, to: from, stopped: false };

  const due = allFixtures(league)
    .filter((g) => !g.played && g.date <= through && g.date >= from);

  const results = [];
  for (const g of due) {
    if (opts.stopAt && g.date > opts.stopAt) break;
    const r = simulateGame(league, g);
    if (!r) continue;                       // a fixture nobody can field is skipped
    applyResult(g, r);
    results.push({ game: g, result: r });
  }

  // The clock lands on the day after the last date played, so pressing Day
  // again moves on rather than replaying an empty date.
  const to = addDays(through, 1);
  league.meta = league.meta || {};
  league.meta.currentDate = to;
  return { played: results.length, results, from, to: through, stopped: false };
}

/**
 * What just happened, for one club.
 *
 * A run of forty games needs a summary, and the only summary that means
 * anything to a manager is their own record over it.
 */
export function runSummary(report, teamId) {
  const mine = report.results.filter(({ game }) =>
    game.home === teamId || game.away === teamId);
  let w = 0, l = 0;
  const games = mine.map(({ game, result }) => {
    const home = game.home === teamId;
    const forS = home ? result.homeScore : result.awayScore;
    const agS = home ? result.awayScore : result.homeScore;
    const won = forS > agS;
    // Exhibitions are shown and counted towards nothing, the way they are
    // everywhere else.
    if (game.phase !== 'preseason') { if (won) w++; else l++; }
    return {
      id: game.id, date: game.date, home, won,
      opponent: home ? game.away : game.home,
      score: `${forS}-${agS}`,
      preseason: game.phase === 'preseason',
    };
  });
  return { wins: w, losses: l, games, total: report.played };
}
