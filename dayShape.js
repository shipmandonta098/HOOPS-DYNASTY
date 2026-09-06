'use strict';

/**
 * dayShape.js — how many games a league stages on a given night.
 *
 * THE PROBLEM THIS SOLVES. A generated season already varied night to night —
 * measured, it ran from 1 game to 15 with an average of 7.5, which is about
 * right. What it did NOT do was vary by DAY OF THE WEEK: Sunday averaged 7.7,
 * Monday 7.4, Friday 7.5, Saturday 7.5. Every weekday was the same weekday.
 * Real schedules are not shaped like that. Friday and Saturday are heavy
 * because that is when people watch; Monday and Thursday are light because
 * that is when teams travel and rest.
 *
 * So the variance here is not noise added for its own sake. It is a WEEKLY
 * SHAPE, and the noise sits on top of it so that no two Fridays are identical
 * either.
 *
 * A TARGET, NOT A CAP. These numbers are what each night should carry, and the
 * generator is scored against them rather than fenced in by them. A hard cap
 * would make the schedule unplaceable the moment some other rule — rest,
 * matchups, a road trip — needed a game on a night that was already full. A
 * target lets the shape lose an argument it ought to lose, and a season comes
 * out close to it rather than exactly on it, which is also what a real
 * schedule looks like.
 */

/**
 * Relative load by weekday, Sunday first.
 *
 * These are quoted as games per night in a thirty-team league and then scaled
 * to whatever league is actually being built, so the SHAPE is what carries
 * over, not the numbers. They sum to 51 a week, which is an average of 7.3 a
 * night — the figure a 1,230-game season over about 170 nights produces.
 *
 * Friday and Saturday are the heavy nights. Monday and Thursday are the light
 * ones: in a real season those are travel and rest days, and the national
 * broadcast on a Thursday is a doubleheader rather than a full card.
 */
export const WEEKDAY_LOAD = [7, 3, 7, 9, 3, 11, 11];
//                          Sun Mon Tue Wed Thu Fri Sat

/** How far the shape is pushed away from a flat week. */
export const VARIATION_STRENGTH = { Off: 0, Low: 0.5, Normal: 1, High: 1.3 };

/** Per-night wobble, so two Fridays are not the same Friday. */
const JITTER = 0.18;

const MEAN_LOAD = WEEKDAY_LOAD.reduce((a, b) => a + b, 0) / 7;

const weekdayOf = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();

/** FNV-1a, so a night's wobble is stable for a given season and seed. */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * How many games each night should carry.
 *
 * @param {string[]} dates      every night the season may play on, sorted
 * @param {number} totalGames   games that must be placed
 * @param {number} hardCap      most a night can physically stage (half the teams)
 * @param {object} [opts]
 * @param {string} [opts.variation]  Off | Low | Normal | High
 * @param {string} [opts.seed]       makes the wobble reproducible
 * @param {string} [opts.finaleDate] a closing night, which gets a full card
 * @returns {{ targets: number[], byDate: Map, caps: number[], mean: number }}
 *   `targets` is what each night should carry and sums to exactly totalGames;
 *   `caps` is the ceiling the placer works to, which is looser.
 */
export function nightTargets(dates, totalGames, hardCap, opts = {}) {
  const n = dates.length;
  const empty = { targets: [], byDate: new Map(), caps: [], mean: 0 };
  if (!n || totalGames <= 0 || hardCap <= 0) return empty;

  const strength = VARIATION_STRENGTH[opts.variation] != null
    ? VARIATION_STRENGTH[opts.variation] : 1;
  const seed = String(opts.seed || '');

  // The weekly shape, flattened towards a level week by the variation setting.
  // Off gives every night the same weight, which is the behaviour this replaced.
  const raw = dates.map((d, i) => {
    const base = MEAN_LOAD + (WEEKDAY_LOAD[weekdayOf(d)] - MEAN_LOAD) * strength;
    // A deterministic wobble in [1-JITTER, 1+JITTER].
    const wobble = strength === 0 ? 1
      : 1 + ((hash(`${seed}|${d}|${i}`) % 2001) / 1000 - 1) * JITTER;
    return Math.max(0.25, base * wobble);
  });

  // Scale the shape onto the games that actually have to be placed, so the
  // targets sum to the season rather than to an assumed one.
  const rawSum = raw.reduce((a, b) => a + b, 0);
  const scale = totalGames / rawSum;
  const targets = raw.map((v) => Math.min(hardCap, v * scale));

  // The closing night is a full card where the season has one — every club in
  // action on the last day is a real feature of a season's shape, not noise.
  const finaleIdx = opts.finaleDate ? dates.indexOf(opts.finaleDate) : -1;
  if (finaleIdx >= 0) targets[finaleIdx] = hardCap;

  const whole = roundToTotal(targets, totalGames, hardCap);
  return {
    targets: whole,
    byDate: new Map(dates.map((d, i) => [d, whole[i]])),
    // The placer's ceiling. Loose enough that the shape never makes a season
    // unplaceable, tight enough that it still means something.
    caps: whole.map((v) => Math.min(hardCap, Math.max(2, Math.ceil(v * 1.5) + 1))),
    mean: totalGames / n,
  };
}

/**
 * Round a set of fractional targets to whole games that still sum correctly.
 *
 * Largest-remainder: floor everything, then hand the shortfall to the nights
 * that lost the most in the rounding. Rounding each night independently would
 * leave the season a few games short or long, and a target list that does not
 * add up to the schedule is a target list nothing can hit.
 */
function roundToTotal(values, total, hardCap) {
  const floors = values.map((v) => Math.floor(v));
  const out = floors.slice();
  let placed = out.reduce((a, b) => a + b, 0);
  const order = values
    .map((v, i) => ({ i, rem: v - floors[i] }))
    .sort((a, b) => b.rem - a.rem);

  let k = 0;
  while (placed < total && k < order.length * 4) {
    const { i } = order[k % order.length];
    if (out[i] < hardCap) { out[i]++; placed++; }
    k++;
  }
  // Overshoot can only come from the hard cap clamping a night upward, so it
  // is taken back off the fullest nights first.
  while (placed > total) {
    let worst = -1;
    for (let i = 0; i < out.length; i++) {
      if (out[i] > 0 && (worst < 0 || out[i] > out[worst])) worst = i;
    }
    if (worst < 0) break;
    out[worst]--; placed--;
  }
  return out;
}

/**
 * The back-to-backs a weekly shape FORCES, before anyone chooses anything.
 *
 * This is pigeonhole arithmetic, not a preference. If Friday stages `a` games
 * and Saturday stages `b`, then 2a clubs are busy on Friday and 2b on Saturday;
 * in a league of N clubs at least 2a + 2b - N of them must be busy on both, and
 * every one of those is a back-to-back nobody asked for. Two heavy nights in a
 * row cannot be arranged around.
 *
 * It matters because the two settings can genuinely contradict each other. A
 * Friday and Saturday of eleven games each in a thirty-team league forces
 * fourteen clubs onto both nights every weekend — about eleven back-to-backs
 * per club across a season — so asking for that shape AND a target of eight is
 * asking for two incompatible things. The generator resolves it by keeping the
 * back-to-back target and letting the shape flatten, which is the right way
 * round: rest is a rule about players, the shape is a rule about television.
 * But the user should be told, not left wondering why Saturday looks light.
 *
 * @returns {{ perTeam, total, worstPair }} perTeam is the season-long average
 *   each club is forced into by the shape alone.
 */
export function impliedBackToBacks(dates, targets, teamCount) {
  if (!dates || dates.length < 2 || !teamCount) {
    return { perTeam: 0, total: 0, worstPair: null };
  }
  let total = 0;
  let worstPair = null;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(`${dates[i - 1]}T00:00:00Z`).getTime();
    const here = new Date(`${dates[i]}T00:00:00Z`).getTime();
    if (here - prev !== 86400000) continue;   // not consecutive days
    const forced = Math.max(0, 2 * targets[i - 1] + 2 * targets[i] - teamCount);
    total += forced;
    if (forced > 0 && (!worstPair || forced > worstPair.forced)) {
      worstPair = { from: dates[i - 1], to: dates[i], forced };
    }
  }
  return {
    perTeam: Math.round((total / teamCount) * 10) / 10,
    total,
    worstPair,
  };
}

/**
 * What a finished schedule actually did, by weekday.
 *
 * Reported rather than assumed: the shape above is a target, so the only way
 * to know whether a season followed it is to count the season.
 */
export function weekdayProfile(games) {
  const per = new Map();
  for (const g of games || []) per.set(g.date, (per.get(g.date) || 0) + 1);
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const buckets = names.map(() => []);
  for (const [date, count] of per) buckets[weekdayOf(date)].push(count);

  const rows = names.map((name, i) => {
    const list = buckets[i].sort((a, b) => a - b);
    if (!list.length) return { day: name, nights: 0, average: 0, low: 0, high: 0 };
    return {
      day: name,
      nights: list.length,
      average: Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10,
      low: list[0],
      high: list[list.length - 1],
    };
  });
  const counts = [...per.values()];
  return {
    byDay: rows,
    nights: per.size,
    average: per.size
      ? Math.round((counts.reduce((a, b) => a + b, 0) / per.size) * 10) / 10 : 0,
    busiest: counts.length ? Math.max(...counts) : 0,
    lightest: counts.length ? Math.min(...counts) : 0,
    // The gap between the heaviest and lightest weekday averages. Flat means
    // the week has no shape, which is the thing this module exists to fix.
    weekdaySpread: Math.round(
      (Math.max(...rows.map((r) => r.average)) - Math.min(...rows.map((r) => r.average))) * 10) / 10,
  };
}
