'use strict';

/**
 * depthChart.js — depth-chart storage and reconciliation.
 *
 * The chart is stored on the team as ordered player ids per position:
 *
 *     team.depthChart = { PG: ['p_0001', ...], SG: [...], SF: [...], PF: [...], C: [...] }
 *
 * Ids, not player objects, so a trade or a waive is still a one-field update
 * on the player — the same reason team rosters are derived rather than stored.
 *
 * The catch with storing ids is drift: waive someone and the chart still lists
 * him; sign someone and he is nowhere. So NOTHING reads the raw stored chart.
 * Every read goes through reconcile(), which drops ids that are no longer on
 * the roster and appends anyone missing at their primary position. The chart
 * therefore self-heals, and a save whose chart predates a roster change still
 * renders correctly.
 */

import { ovr, byOvr } from './playerRatings.js';

export const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

/**
 * Depth labels by slot index. Numeric rather than "Starter/2nd/..." because
 * the label sits in a narrow column beside the name; the starting slot is
 * marked visually instead.
 */
export const SLOT_LABEL = ['1st', '2nd', '3rd', '4th', '5th'];

/**
 * Best-overall-first chart, used to seed a new league and to power "Auto-Sort".
 * A player appears at his primary position only; positional versatility is not
 * something the save models, so pretending otherwise would be invention.
 */
export function autoChart(roster) {
  const chart = {};
  for (const pos of POSITIONS) {
    chart[pos] = byOvr(roster.filter((p) => p.position === pos)).map((p) => p.id);
  }
  return chart;
}

/**
 * The chart as it should actually be read: stored order first, minus anyone no
 * longer on the roster, plus anyone missing (best first) appended to their
 * position. Pure — returns a new object and never touches `stored`.
 *
 * @param {object|null|undefined} stored  team.depthChart, possibly stale or absent
 * @param {Array} roster                  the team's current players
 * @returns {object} { PG: [...ids], SG: [...], ... }
 */
export function reconcile(stored, roster) {
  const onRoster = new Map(roster.map((p) => [p.id, p]));
  const listed = new Set();
  const chart = {};

  for (const pos of POSITIONS) {
    const kept = ((stored && stored[pos]) || []).filter((id) => {
      if (!onRoster.has(id) || listed.has(id)) return false;
      listed.add(id);
      return true;
    });
    chart[pos] = kept;
  }

  // Anyone not in the chart at all joins his own position, best first.
  for (const pos of POSITIONS) {
    const missing = byOvr(roster.filter((p) => p.position === pos && !listed.has(p.id)));
    for (const p of missing) { chart[pos].push(p.id); listed.add(p.id); }
  }

  // A player whose position is not one of the five (or is absent) would other-
  // wise vanish from the screen entirely. Park him where he fits best.
  const orphans = roster.filter((p) => !listed.has(p.id));
  for (const p of orphans) {
    chart[POSITIONS.includes(p.position) ? p.position : 'SF'].push(p.id);
    listed.add(p.id);
  }
  return chart;
}

/**
 * Move the player at `index` up or down one slot within a position.
 * Returns a NEW chart; out-of-range moves return the input unchanged.
 */
export function move(chart, pos, index, delta) {
  const list = (chart[pos] || []).slice();
  const to = index + delta;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return chart;
  [list[index], list[to]] = [list[to], list[index]];
  return { ...chart, [pos]: list };
}

/**
 * The five starters, in position order. Positions with nobody at them come
 * back as null rather than being silently filled from elsewhere — an empty
 * slot is a real fact about the roster and the screen should say so.
 */
export function starters(chart, byId) {
  return POSITIONS.map((pos) => {
    const id = (chart[pos] || [])[0];
    return { pos, player: id ? byId.get(id) || null : null };
  });
}

/** Minutes-weighted rating of the five starters — arithmetic on stored overalls. */
export function startingFive(chart, byId) {
  const five = starters(chart, byId).map((s) => s.player).filter(Boolean);
  if (!five.length) return null;
  return Math.round(five.reduce((s, p) => s + ovr(p), 0) / five.length);
}
