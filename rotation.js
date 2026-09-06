'use strict';

/**
 * rotation.js — who plays, and for how many minutes.
 *
 * WHAT THIS IS. Minutes are an INSTRUCTION, not a result. Everything else on
 * this screen that looks like a number — a record, a win percentage, a stat —
 * is a fact about games that have been played, and this league has played
 * none. A minutes allocation is different in kind: it is the user telling the
 * simulator what to do next, and it is real the moment it is set because the
 * user set it. So this file stores and validates it, and invents nothing else.
 *
 * WHY 240 IS NOT WRITTEN DOWN ANYWHERE. Five players on the floor for the
 * length of a game is where the number comes from, and both halves of that are
 * read from the league rather than assumed — a league playing forty-minute
 * games has 200 minutes to hand out, and nothing here would notice the
 * difference.
 *
 * PRESETS ARE SHAPES, NOT ROSTERS. A saved rotation is a curve down the depth
 * chart, not a map of player ids: "the starter gets 34, the sixth man gets 24".
 * Store it against ids and it breaks the first time somebody is traded. Stored
 * as a shape, the same preset applies to any roster, and to next year's.
 */

import { ovr } from './playerRatings.js';

/** Players on the floor at once. Not a setting — it is what basketball is. */
export const ON_COURT = 5;

/** Minutes in a game, from settings, so a shorter game means fewer to give. */
export function gameMinutes(settings) {
  const n = Number(settings && settings.gameMinutes);
  return Number.isFinite(n) && n > 0 ? n : 48;
}

/** The whole allocation a team has to distribute. */
export const totalMinutes = (settings) => ON_COURT * gameMinutes(settings);

/**
 * Built-in minute shapes, as a curve down the depth order.
 *
 * Quoted for a 48-minute game and scaled to whatever the league actually
 * plays, so the shape survives a rule change rather than the numbers.
 */
export const PRESETS = {
  // Each shape sums to exactly 240 at a 48-minute game, so the balancer below
  // has nothing to correct and the curve arrives intact. A shape that overran
  // came out flattened instead — the first Balanced summed to 246 and lost six
  // minutes off the top, turning 34/32/30 into 30/30/30, which is not the
  // rotation it says it is. (The reference image has the same problem: its
  // sliders add up to 246 while its panel reports 240 of 240.)
  Balanced: [34, 32, 30, 28, 30, 22, 19, 17, 16, 12, 0, 0, 0, 0, 0],
  'Star Heavy': [38, 36, 34, 30, 34, 20, 16, 12, 10, 10, 0, 0, 0, 0, 0],
  'Deep Bench': [30, 28, 28, 26, 28, 24, 22, 20, 18, 16, 0, 0, 0, 0, 0],
  'Short Rotation': [40, 38, 36, 34, 36, 22, 18, 16, 0, 0, 0, 0, 0, 0, 0],
};

/** The rotation as it should be read: stored where valid, seeded where not. */
export function reconcile(stored, roster, settings) {
  const order = depthOrder(roster);
  const minutes = {};
  const total = totalMinutes(settings);
  let assigned = 0;

  for (const p of order) {
    const v = stored && stored.minutes ? Number(stored.minutes[p.id]) : NaN;
    minutes[p.id] = Number.isFinite(v) && v >= 0 ? Math.min(v, gameMinutes(settings)) : 0;
    assigned += minutes[p.id];
  }
  // A stored rotation that does not add up is not thrown away — it is a user's
  // work — but a rotation that was never set at all gets the default shape
  // rather than a roster of zeroes nobody can play with.
  if (!stored || !stored.minutes || assigned === 0) {
    return { minutes: applyPreset(order, PRESETS.Balanced, settings), preset: 'Balanced' };
  }
  return { minutes, preset: (stored && stored.preset) || null };
}

/**
 * The depth order the rotation is built on.
 *
 * Best five by overall are the starters, one per slot, and everyone else
 * follows by overall. Position is deliberately NOT enforced: a team whose two
 * best players are both centres should be able to play them both, and the
 * save has no data about who can cover which position.
 */
export function depthOrder(roster) {
  return [...(roster || [])].sort((a, b) => ovr(b) - ovr(a)
    || String(a.name || '').localeCompare(String(b.name || '')));
}

/** A preset curve, scaled to this league's game length and this roster. */
export function applyPreset(order, shape, settings) {
  const cap = gameMinutes(settings);
  const scale = cap / 48;
  const raw = order.map((p, i) => Math.round((shape[i] || 0) * scale));
  return balanceTo(order, raw, totalMinutes(settings), cap);
}

/**
 * Nudge a set of minutes until it adds up exactly.
 *
 * A preset scaled to a different game length, or a roster shorter than the
 * curve, will not land on the total by itself. The correction goes to whoever
 * is already playing most, one minute at a time, so the SHAPE survives — a
 * rotation that fixed its arithmetic by handing four minutes to a deep reserve
 * would no longer be the rotation that was chosen.
 */
function balanceTo(order, values, target, cap) {
  const out = values.slice();
  const sum = () => out.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (sum() !== target && guard++ < 5000) {
    const over = sum() > target;
    // Prefer whoever is playing most when trimming, and whoever is playing
    // most but not yet at the cap when adding.
    let pick = -1;
    for (let i = 0; i < out.length; i++) {
      if (over ? out[i] <= 0 : out[i] >= cap) continue;
      if (pick < 0 || (over ? out[i] > out[pick] : out[i] > out[pick])) pick = i;
    }
    if (pick < 0) break;
    out[pick] += over ? -1 : 1;
  }
  const minutes = {};
  order.forEach((p, i) => { minutes[p.id] = out[i]; });
  return minutes;
}

/** Overall-weighted minutes: better players play more, everyone stays legal. */
export function autoMinutes(roster, settings, depth = 10) {
  const order = depthOrder(roster);
  const cap = gameMinutes(settings);
  const target = totalMinutes(settings);
  const playing = order.slice(0, Math.min(depth, order.length));
  if (!playing.length) return {};
  // Weighted by rating above a floor, so a 76 and a 71 are not treated as
  // interchangeable but a bench player still gets a real share.
  const weights = playing.map((p) => Math.max(1, ovr(p) - 55));
  const wsum = weights.reduce((a, b) => a + b, 0);
  const raw = order.map((p, i) => (i < playing.length
    ? Math.min(cap, Math.round((weights[i] / wsum) * target)) : 0));
  return balanceTo(order, raw, target, cap);
}

/** The same minutes for everyone in the rotation. */
export function evenMinutes(roster, settings, depth = 10) {
  const order = depthOrder(roster);
  const cap = gameMinutes(settings);
  const target = totalMinutes(settings);
  const n = Math.max(1, Math.min(depth, order.length));
  const each = Math.min(cap, Math.round(target / n));
  const raw = order.map((p, i) => (i < n ? each : 0));
  return balanceTo(order, raw, target, cap);
}

/** Everyone to zero, so a rotation can be built from nothing. */
export function resetMinutes(roster) {
  const minutes = {};
  for (const p of roster || []) minutes[p.id] = 0;
  return minutes;
}

/**
 * Keep the shape, fix the arithmetic.
 *
 * "Balance" is the button for a rotation that is nearly right and does not add
 * up. It scales what is there to the total rather than replacing it, so the
 * user's own choices are preserved and only the sum changes.
 */
export function balanceMinutes(roster, minutes, settings) {
  const order = depthOrder(roster);
  const cap = gameMinutes(settings);
  const target = totalMinutes(settings);
  const current = order.map((p) => Math.max(0, Number(minutes[p.id]) || 0));
  const sum = current.reduce((a, b) => a + b, 0);
  if (!sum) return autoMinutes(roster, settings);
  const scaled = current.map((v) => Math.min(cap, Math.round((v / sum) * target)));
  return balanceTo(order, scaled, target, cap);
}

/**
 * What a player's minutes make them.
 *
 * Derived from the allocation the user has actually made, so it moves as the
 * sliders move. It is a description of the rotation, not a judgement about the
 * player — that is what Overall and the archetype are for.
 */
export function roleOf(index, mins, settings) {
  const cap = gameMinutes(settings);
  if (mins <= 0) return { label: 'Reserve', tone: 'off' };
  if (index < ON_COURT) return { label: 'Starter', tone: 'start' };
  if (index === ON_COURT) return { label: 'Sixth Man', tone: 'six' };
  if (mins >= cap * 0.3) return { label: 'Rotation', tone: 'rot' };
  return { label: 'Situational', tone: 'sit' };
}

/**
 * Is this rotation playable?
 *
 * Reported rather than enforced. A user mid-edit is allowed to be at 238 for a
 * moment; the screen says so and the Save is what refuses. Returning the exact
 * shortfall matters more than a boolean — "8 minutes short" is actionable and
 * "invalid" is not.
 */
export function validate(roster, minutes, settings) {
  const cap = gameMinutes(settings);
  const target = totalMinutes(settings);
  const order = depthOrder(roster);

  let total = 0, playing = 0, starters = 0, bench = 0;
  const problems = [];
  order.forEach((p, i) => {
    const m = Math.max(0, Number(minutes[p.id]) || 0);
    total += m;
    if (m > 0) playing++;
    if (i < ON_COURT) starters += m; else bench += m;
    if (m > cap) problems.push(`${p.name} is over the ${cap}-minute game length.`);
  });

  if (total !== target) {
    const diff = target - total;
    problems.push(diff > 0
      ? `${diff} minute${diff === 1 ? '' : 's'} still to allocate.`
      : `${-diff} minute${diff === -1 ? '' : 's'} over the ${target} available.`);
  }
  // Five have to be on the floor, so fewer than five players cannot cover a
  // game however the minutes are arranged.
  if (playing < ON_COURT) {
    problems.push(`Only ${playing} player${playing === 1 ? '' : 's'} `
      + `${playing === 1 ? 'has' : 'have'} minutes; ${ON_COURT} are needed on the floor.`);
  }

  return {
    ok: problems.length === 0,
    problems,
    total, target, remaining: target - total,
    starters, bench, inactive: order.length - playing,
    playing,
  };
}
