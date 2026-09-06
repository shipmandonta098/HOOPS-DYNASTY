'use strict';

/**
 * preseason.js — the exhibition games before the season starts.
 *
 * WHY THIS IS A SEPARATE LIST. Preseason games are stored in their own array,
 * never mixed into the regular-season fixtures, and that is a structural
 * guarantee rather than a convention. Records, standings, streaks, running
 * win-loss, back-to-back counts, fatigue, power ratings and projected spreads
 * all read `schedule.games`. If an exhibition were dropped in there it would
 * quietly become part of a team's record, and no amount of filtering scattered
 * across six screens would reliably keep it out. Keeping the two lists apart
 * means preseason CANNOT reach any of that, because the code that computes it
 * never sees these games at all.
 *
 * WHAT THE NUMBERS ARE. Every team plays at least the floor and at most the
 * ceiling, with the target as the common case. A thirty-team league on the
 * defaults produces about sixty-five games, which is what a real preseason
 * runs to — but nothing here assumes thirty teams or sixty-five games. Both
 * fall out of the league being built and the settings it was given.
 *
 * A NOTE ON THE BRIEF'S OWN ARITHMETIC. "At least 4 per team" and "about 65
 * games league-wide" only agree at thirty teams: 65 games is 130 team-games,
 * which is 4.33 each. There is no room in that for many teams at 6, let alone
 * the ceiling of 8 — a league where everyone played 6 would need 90 games. So
 * the per-team target is the control here and the league total is DERIVED from
 * it and reported, rather than both being set and left to contradict.
 */

import { makeRNG, hashString } from './leagueConfig.js';
import { resolveTeams } from './scheduleRules.js';
import { nightTargets } from './dayShape.js';

/** Hard limits, from the brief. A setting may sit anywhere between them. */
export const PRESEASON_LIMITS = { min: 4, max: 8 };

/** Nobody should meet the same opponent more than this in an exhibition slate. */
const MAX_MEETINGS = 2;

const dayNumber = (iso) => {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
};
const isoOf = (n) => new Date(n * 86400000).toISOString().slice(0, 10);

/**
 * The window the preseason runs in.
 *
 * It ends a clear day before opening night, so no club walks into the first
 * game of the season on no rest — an exhibition back-to-back into game one
 * would be a fatigue penalty nobody chose.
 */
export function preseasonWindow(seasonStart, days) {
  if (!seasonStart) return { dates: [], start: null, end: null };
  const open = dayNumber(seasonStart);
  const end = open - 2;              // one clear day before opening night
  const span = Math.max(1, Math.min(60, Number(days) || 14));
  const start = end - span + 1;
  const dates = [];
  for (let d = start; d <= end; d++) dates.push(isoOf(d));
  return { dates, start: dates[0], end: dates[dates.length - 1] };
}

/**
 * How many exhibition games each club plays.
 *
 * The target is the common case and the rest sit around it, in symmetric pairs
 * so the pairs cancel and the league average stays on the target — the same
 * reasoning as the back-to-back band, and for the same reason: a preseason
 * where all thirty clubs play exactly four games is not what a preseason looks
 * like. Where the band runs into a limit the offsets stop, so a target sitting
 * on the floor spreads upward only.
 */
export function preseasonCounts(teams, opts = {}) {
  const target = clampCount(opts.target != null ? opts.target : 4);
  const variance = Math.max(0, Math.min(4, Number(opts.variance) || 0));
  const lo = Math.max(PRESEASON_LIMITS.min, target - variance);
  const hi = Math.min(PRESEASON_LIMITS.max, target + variance);

  // Offsets in cancelling pairs, stopping at whichever edge arrives first.
  const offsets = [0];
  for (let k = 1; k <= variance; k++) {
    if (target - k < lo || target + k > hi) break;
    offsets.push(-k, k);
  }
  // When the band is one-sided — a target on the floor, say — spread the only
  // way there is, rather than giving every club the same number.
  if (offsets.length === 1) {
    for (let v = target + 1; v <= hi && offsets.length <= variance; v++) {
      offsets.push(v - target);
    }
  }

  const order = [...teams].sort((a, b) => hashString(`pre|${a}`) - hashString(`pre|${b}`)
    || (a < b ? -1 : 1));
  const counts = new Map();
  order.forEach((t, i) => counts.set(t, clampCount(target + offsets[i % offsets.length])));

  // Every game consumes two slots, so the total has to be even. The correction
  // goes to a club that can absorb it without leaving its band.
  let total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (total % 2) {
    const bump = order.find((t) => counts.get(t) < hi)
      || order.find((t) => counts.get(t) > lo);
    if (bump) {
      counts.set(bump, counts.get(bump) + (counts.get(bump) < hi ? 1 : -1));
      total = [...counts.values()].reduce((a, b) => a + b, 0);
    }
  }
  return { counts, games: total / 2, lo, hi, target };
}

const clampCount = (n) => Math.max(PRESEASON_LIMITS.min,
  Math.min(PRESEASON_LIMITS.max, Math.round(Number(n) || PRESEASON_LIMITS.min)));

/**
 * Who plays whom.
 *
 * Exhibition slates are built around travel, not competition: clubs play
 * whoever is nearby, which in a league with divisions means division and
 * conference rivals more often than not. So a pairing is preferred when the
 * two are close, but nothing is forbidden — a preseason fixture list that
 * exactly mirrored the divisions would look more structured than a real one.
 */
function buildPairs(teams, counts, rng) {
  const need = new Map(counts);
  const met = new Map();                      // "a|b" -> meetings so far
  const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const byId = new Map(teams.map((t) => [t.id, t]));
  const pairs = [];

  const affinity = (a, b) => {
    const A = byId.get(a), B = byId.get(b);
    if (!A || !B) return 0;
    if (A.division && A.division === B.division) return 3;
    if (A.conference && A.conference === B.conference) return 2;
    return 1;
  };

  // Guard rather than trust: a slate that cannot be completed should stop,
  // not spin.
  const limit = teams.length * PRESEASON_LIMITS.max * 4;
  for (let guard = 0; guard < limit; guard++) {
    const hungry = [...need.entries()].filter(([, n]) => n > 0)
      .sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1));
    if (hungry.length < 2) break;

    const [a] = hungry[0];
    const options = hungry.slice(1)
      .filter(([b]) => (met.get(key(a, b)) || 0) < MAX_MEETINGS)
      .map(([b, n]) => ({ b, n, score: n * 2 + affinity(a, b) + rng.next() * 2 }));
    if (!options.length) { need.set(a, 0); continue; }

    options.sort((x, y) => y.score - x.score);
    const b = options[0].b;
    // The host alternates by a stable hash so one club is not always at home,
    // and the same league always produces the same slate.
    const aHosts = (hashString(key(a, b)) + pairs.length) % 2 === 0;
    pairs.push(aHosts ? { home: a, away: b } : { home: b, away: a });
    met.set(key(a, b), (met.get(key(a, b)) || 0) + 1);
    need.set(a, need.get(a) - 1);
    need.set(b, need.get(b) - 1);
  }
  return pairs;
}

/**
 * Put the slate on dates.
 *
 * The same weekly shape the regular season uses, so a preseason Friday is
 * busier than a preseason Monday, and no club plays two nights running — there
 * is no reason to tire anyone out in an exhibition, and every reason not to.
 */
function placePairs(pairs, dates, teamCount, rng, seed) {
  if (!dates.length || !pairs.length) return [];
  const hardCap = Math.max(1, Math.floor(teamCount / 2));
  const shape = nightTargets(dates, pairs.length, hardCap, { variation: 'Normal', seed });
  const caps = shape.caps;

  const busy = dates.map(() => new Set());
  const load = dates.map(() => 0);
  const lastIdx = new Map();
  const placed = [];
  const dayOf = dates.map(dayNumber);

  // Two rules, tried in order: refuse consecutive days, then allow them rather
  // than leave a fixture unplaced. The second rule repeats while it is still
  // placing anything — one sweep gives each fixture a single attempt, and a
  // tight window needs the room freed by the previous placement before the next
  // one fits. Without the retry a short window silently dropped games.
  const remaining = pairs.slice();
  for (const allowB2B of [false, true, true, true, true]) {
    const before = remaining.length;
    for (let i = remaining.length - 1; i >= 0; i--) {
      const g = remaining[i];
      // Nights are tried in a shuffled order weighted by how much room each has,
      // so the slate spreads instead of stacking on the first legal date.
      const order = dates.map((_, di) => di)
        .filter((di) => load[di] < caps[di]
          && !busy[di].has(g.home) && !busy[di].has(g.away))
        .filter((di) => allowB2B || [g.home, g.away].every((t) => {
          const prev = lastIdx.get(t);
          return prev == null || Math.abs(dayOf[di] - dayOf[prev]) > 1;
        }))
        .sort((x, y) => (caps[y] - load[y]) - (caps[x] - load[x])
          || rng.next() - 0.5);
      if (!order.length) continue;
      const di = order[Math.floor(rng.next() * Math.min(3, order.length))];
      busy[di].add(g.home); busy[di].add(g.away);
      load[di]++;
      lastIdx.set(g.home, di); lastIdx.set(g.away, di);
      placed.push({ ...g, date: dates[di] });
      remaining.splice(i, 1);
    }
    if (allowB2B && remaining.length === before) break;   // nothing left to gain
  }
  return placed.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * The whole preseason for one league.
 *
 * @returns {null|{ season, games, window, plan }} null when the setting is off,
 *   so a caller can tell "no preseason" from "an empty one".
 */
export function buildPreseason(league, season, settings, structure, seasonStart) {
  const rules = settings || league.settings || {};
  if (!rules.preseason) return null;

  const teams = resolveTeams(league.teams, structure || league.structure);
  const win = preseasonWindow(seasonStart, rules.preseasonWindow);
  if (teams.length < 2 || !win.dates.length) return null;

  const seed = rules.scheduleSeed
    ? `pre:${rules.scheduleSeed}:${season}`
    : `preseason:${league.meta && league.meta.rngSeed}:${season}`;
  const rng = makeRNG(hashString(seed));

  const plan = preseasonCounts(teams.map((t) => t.id), {
    target: rules.preseasonGamesPerTeam,
    variance: rules.preseasonVariance,
  });
  const pairs = buildPairs(teams, plan.counts, rng);
  const placed = placePairs(pairs, win.dates, teams.length, rng, seed);

  const games = placed.map((g, i) => ({
    id: `pre_${season}_${String(i).padStart(3, '0')}`,
    date: g.date,
    home: g.home,
    away: g.away,
    // Marked on every fixture, so anything that ever does read both lists can
    // tell them apart without inferring it from a date.
    phase: 'preseason',
    played: false,
    homeScore: null,
    awayScore: null,
  }));

  const per = {};
  for (const g of games) { per[g.home] = (per[g.home] || 0) + 1; per[g.away] = (per[g.away] || 0) + 1; }
  const counts = teams.map((t) => per[t.id] || 0);

  return {
    season,
    games,
    window: { start: win.start, end: win.end, days: win.dates.length },
    plan: {
      target: plan.target, min: plan.lo, max: plan.hi,
      requested: plan.games,
      placed: games.length,
      unplaced: pairs.length - games.length,
      perTeam: per,
      lowest: counts.length ? Math.min(...counts) : 0,
      highest: counts.length ? Math.max(...counts) : 0,
      average: counts.length
        ? Math.round((counts.reduce((a, b) => a + b, 0) / counts.length) * 10) / 10 : 0,
      // Whether every club actually cleared the floor the brief sets. A real
      // answer, counted off the slate, that can say no.
      meetsMinimum: counts.every((c) => c >= PRESEASON_LIMITS.min),
    },
  };
}

/** One club's exhibition games, in the shape the schedule screen reads. */
export function preseasonGames(pre, teamId) {
  if (!pre || !Array.isArray(pre.games)) return [];
  return pre.games
    .filter((g) => g.home === teamId || g.away === teamId)
    .map((g) => {
      const home = g.home === teamId;
      const forScore = home ? g.homeScore : g.awayScore;
      const againstScore = home ? g.awayScore : g.homeScore;
      return {
        ...g,
        home,
        opponent: home ? g.away : g.home,
        forScore,
        againstScore,
        // Exhibitions have a winner but never a record, so a result is shown
        // and nothing counts it.
        result: g.played && forScore != null && againstScore != null
          ? (forScore > againstScore ? 'W' : 'L') : null,
      };
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
