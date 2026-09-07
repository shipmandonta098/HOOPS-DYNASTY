'use strict';

/**
 * playoffs.js — the bracket, and playing it out.
 *
 * SEEDED FROM THE STANDINGS, WHICH ARE COUNTED FROM PLAYED GAMES. Nothing here
 * decides who is good; it reads the table the season produced. Before a season
 * has been played the bracket is a projection and says so — "if the playoffs
 * started today" is a real statement about the current standings, and it is
 * labelled as a projection until the regular season is actually over.
 *
 * NOTHING IS HARD-CODED TO SIXTEEN TEAMS. The bracket is the largest power of
 * two that fits the qualifying seeds, per conference, and a league with no
 * conferences seeds one bracket out of the whole table. A six-team league gets
 * a two-team final; a thirty-two-team league with four conferences gets four
 * brackets. The series length, the number of guaranteed seeds and the size of
 * the play-in all come from settings.
 *
 * SERIES ARE PLAYED, NOT DECIDED. Every game in a series runs through the same
 * simulator the regular season uses, with the same rotations and the same
 * coaching instructions, on the playoff rotation weighting. A series result is
 * the games it contained.
 */

import { standings, cutLines } from './standings.js';
import { simulateGame, applyResult } from './gameSim.js';

/** The home-court pattern for a best-of-seven, and how it truncates. */
const HOME_PATTERN = [1, 1, 0, 0, 1, 0, 1];

/** Largest power of two that is at most `n`, and at least 2. */
function bracketSize(n) {
  let size = 2;
  while (size * 2 <= n) size *= 2;
  return Math.max(2, size);
}

/** Games needed to win a series of `len`. */
export const winsNeeded = (len) => Math.floor(len / 2) + 1;

/** Series length from settings, forced odd so a series cannot be drawn. */
export function seriesLength(settings) {
  const n = Number(settings && settings.playoffSeriesLength);
  const v = Number.isFinite(n) && n >= 1 ? Math.round(n) : 7;
  return v % 2 === 0 ? v + 1 : v;
}

/**
 * Who is in, per conference, and who has to play in for the last places.
 *
 * @returns {Array} one entry per bracket: `{ label, size, seeds, playIn }`
 */
export function qualifiers(league) {
  const table = standings(league, 'conference');
  return table.groups.map((g) => {
    const lines = cutLines(league.settings, g.rows.length);
    const size = bracketSize(lines.berths + lines.playIn);
    // Seeds above the guarantee line are in. The rest of the bracket is
    // decided by the play-in, among the seeds below it.
    const direct = Math.min(lines.berths, size);
    const contested = size - direct;
    return {
      label: g.label,
      size,
      clinched: g.rows.slice(0, direct),
      playIn: contested > 0
        ? g.rows.slice(direct, direct + Math.max(contested * 2, lines.playIn))
        : [],
      contested,
      rows: g.rows,
    };
  });
}

/* ------------------------------------------------------------------ series */

/** A round's pairings, from a seeded field: 1v8, 4v5, 3v6, 2v7. */
function pairSeeds(size) {
  let order = [1, 2];
  while (order.length < size) {
    const n = order.length * 2 + 1;
    const next = [];
    for (const s of order) { next.push(s, n - s); }
    order = next;
  }
  const pairs = [];
  for (let i = 0; i < order.length; i += 2) pairs.push([order[i], order[i + 1]]);
  return pairs;
}

/** An empty series between two seeded teams. */
function makeSeries(id, label, high, low, len) {
  return {
    id, label, length: len, need: winsNeeded(len),
    high: high ? { id: high.id, seed: high.seed, name: high.name, wins: 0 } : null,
    low: low ? { id: low.id, seed: low.seed, name: low.name, wins: 0 } : null,
    games: [], winner: null, loser: null, done: false,
  };
}

/**
 * Build the whole bracket, unplayed.
 *
 * Every round is created up front with its slots empty, so the screen can draw
 * a full bracket before a game is played — which is what a bracket is for.
 */
export function buildBracket(league) {
  const settings = league.settings || {};
  const len = seriesLength(settings);
  const season = (league.meta && league.meta.currentSeason) || null;
  const confs = qualifiers(league);

  const brackets = confs.map((c, ci) => {
    const field = c.clinched.concat(
      // Before the play-in is played, the higher seeds fill the contested
      // places provisionally — the screen labels the whole thing a projection
      // until the regular season is over, so this is a preview, not a claim.
      c.playIn.slice(0, c.contested),
    ).slice(0, c.size);

    const rounds = [];
    const pairs = pairSeeds(c.size);
    rounds.push(pairs.map(([a, b], i) => makeSeries(
      `po_${season}_c${ci}_r0_${i}`, roundName(0, c.size),
      field[a - 1], field[b - 1], len,
    )));
    let n = pairs.length;
    let r = 1;
    while (n > 1) {
      n = Math.floor(n / 2);
      rounds.push(new Array(n).fill(null).map((_, i) => makeSeries(
        `po_${season}_c${ci}_r${r}_${i}`, roundName(r, c.size), null, null, len)));
      r++;
    }
    return { label: c.label, size: c.size, rounds, playIn: c.playIn, contested: c.contested };
  });

  // One final between the bracket winners. With a single bracket — a league
  // with no conferences — its last round IS the final and there is no extra.
  const final = brackets.length > 1
    ? makeSeries(`po_${season}_final`, 'Finals', null, null, len)
    : null;

  return { season, length: len, brackets, final, champion: null };
}

/** Round names, counted back from the final so they fit any bracket size. */
function roundName(index, size) {
  const rounds = Math.log2(size);
  const back = rounds - index;
  if (back === 1) return 'Conference Finals';
  if (back === 2) return 'Conference Semifinals';
  if (back === 3) return 'First Round';
  return `Round ${index + 1}`;
}

/* ------------------------------------------------------------------- play */

/**
 * Play one series to its conclusion.
 *
 * Home court follows the higher seed on the 2-2-1-1-1 pattern, truncated for
 * shorter series. Each game goes through the ordinary simulator on the PLAYOFF
 * rotation, so shortened benches and heavier star minutes are already in the
 * ratings the spread model uses.
 */
export function playSeries(league, series) {
  if (!series || series.done || !series.high || !series.low) return series;
  const need = series.need;
  while (series.high.wins < need && series.low.wins < need) {
    const n = series.games.length;
    const highHome = HOME_PATTERN[n % HOME_PATTERN.length] === 1;
    const game = {
      id: `${series.id}_g${n + 1}`,
      date: null,
      home: highHome ? series.high.id : series.low.id,
      away: highHome ? series.low.id : series.high.id,
      phase: 'playoffs',
      played: false, homeScore: null, awayScore: null,
    };
    const r = simulateGame(league, game);
    if (!r) break;                       // a team that cannot field five ends it
    applyResult(game, r);
    const homeWon = r.homeScore > r.awayScore;
    const winner = homeWon === highHome ? series.high : series.low;
    winner.wins++;
    series.games.push({
      id: game.id, home: game.home, away: game.away,
      homeScore: r.homeScore, awayScore: r.awayScore,
      overtimes: r.overtimes || 0, box: r.box,
    });
  }
  const hw = series.high.wins >= need;
  series.winner = hw ? series.high.id : series.low.id;
  series.loser = hw ? series.low.id : series.high.id;
  series.done = true;
  return series;
}

/** Move a completed round's winners into the next one. */
function promote(bracket, roundIdx, byId) {
  const from = bracket.rounds[roundIdx];
  const to = bracket.rounds[roundIdx + 1];
  if (!to) return;
  for (let i = 0; i < to.length; i++) {
    const a = from[i * 2], b = from[i * 2 + 1];
    if (!a || !b || !a.done || !b.done) continue;
    const wa = byId(a.winner), wb = byId(b.winner);
    // The better seed is the home side in the next round, whichever bracket
    // half they came from.
    const [high, low] = (wa.seed <= wb.seed) ? [wa, wb] : [wb, wa];
    to[i].high = { id: high.id, seed: high.seed, name: high.name, wins: 0 };
    to[i].low = { id: low.id, seed: low.seed, name: low.name, wins: 0 };
  }
}

/**
 * Play the whole postseason out, round by round.
 *
 * @returns {object} the bracket, with a champion.
 */
export function playPostseason(league, bracket) {
  const seedOf = new Map();
  for (const b of bracket.brackets) {
    for (const s of b.rounds[0]) {
      for (const side of [s.high, s.low]) if (side) seedOf.set(side.id, side);
    }
  }
  const byId = (id) => seedOf.get(id) || { id, seed: 99, name: id };

  for (const b of bracket.brackets) {
    for (let r = 0; r < b.rounds.length; r++) {
      for (const s of b.rounds[r]) playSeries(league, s);
      promote(b, r, byId);
    }
  }

  if (bracket.final) {
    const champs = bracket.brackets
      .map((b) => b.rounds[b.rounds.length - 1][0])
      .filter((s) => s && s.done);
    if (champs.length === 2) {
      const [a, b] = champs.map((s) => byId(s.winner));
      // The better regular-season record hosts the final; a tie goes to the
      // seed, which is itself the record.
      const [high, low] = a.seed <= b.seed ? [a, b] : [b, a];
      bracket.final.high = { id: high.id, seed: high.seed, name: high.name, wins: 0 };
      bracket.final.low = { id: low.id, seed: low.seed, name: low.name, wins: 0 };
      playSeries(league, bracket.final);
      bracket.champion = bracket.final.winner;
    }
  } else if (bracket.brackets.length === 1) {
    const last = bracket.brackets[0].rounds[bracket.brackets[0].rounds.length - 1][0];
    if (last && last.done) bracket.champion = last.winner;
  }
  return bracket;
}

/** Is the regular season finished? A bracket is only real once it is. */
export function regularSeasonComplete(league) {
  const games = ((league.schedule || {}).games) || [];
  return games.length > 0 && games.every((g) => g.played);
}

/**
 * A series in one line: "Sentinels win 4-2", or the state it is in.
 */
export function seriesLine(series, nameOf) {
  if (!series || !series.high || !series.low) return null;
  const h = nameOf(series.high.id), l = nameOf(series.low.id);
  if (series.done) {
    const w = series.winner === series.high.id ? series.high : series.low;
    const lo = series.winner === series.high.id ? series.low : series.high;
    return `${nameOf(w.id)} win ${w.wins}-${lo.wins}`;
  }
  if (series.games.length) return `${h} ${series.high.wins}-${series.low.wins} ${l}`;
  return `${h} vs ${l}`;
}
