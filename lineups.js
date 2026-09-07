'use strict';

/**
 * lineups.js — five-man units, and what they are good at.
 *
 * WHAT THIS CAN AND CANNOT SAY. A unit's ratings are DERIVED: take the five
 * players' attributes and combine them the way the floor does — shooting adds
 * up, rim protection is mostly the best defender, spacing is how many of the
 * five have to be guarded out there. All of that is arithmetic over data the
 * save already holds.
 *
 * What it does NOT say is how a unit has PERFORMED. Minutes together, net
 * rating, plus-minus by combination — real games produce those, and the
 * simulator does not track which five were on the floor for each possession,
 * so there is nothing honest to report. A "+8.4 net rating" on a unit that has
 * never played would be the most believable lie on the screen.
 */

import { ovr } from './playerRatings.js';
import { depthOrder } from './rotation.js';

export const UNIT_SIZE = 5;

/** The units a team keeps, and what each is for. */
export const UNIT_SLOTS = [
  { key: 'starting', label: 'Starting Five', blurb: 'Opens the game and each half.' },
  { key: 'closing', label: 'Closing Five', blurb: 'On the floor when the game is decided.' },
  { key: 'bench', label: 'Bench Unit', blurb: 'The group that holds a lead while starters rest.' },
  { key: 'small', label: 'Small Ball', blurb: 'Pace and spacing over size.' },
  { key: 'big', label: 'Big Lineup', blurb: 'Size, rebounding and rim protection.' },
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const attr = (p, k) => Number((p.attributes || {})[k]) || 50;
const mean = (list, f) => (list.length ? list.reduce((s, x) => s + f(x), 0) / list.length : 0);
/** The best of the five, for the things one player can carry on his own. */
const best = (list, f) => (list.length ? Math.max(...list.map(f)) : 0);

/**
 * What a five-man unit is, from its five players.
 *
 * Each dimension is combined the way it actually works on a floor rather than
 * by averaging everything. Rim protection is the best shot-blocker, because one
 * of them can cover it; spacing counts how many are genuinely a threat from
 * three, because a fifth non-shooter is what clogs a lane.
 */
export function unitRatings(players) {
  const p = (players || []).filter(Boolean);
  if (p.length < 2) return null;

  const shooters = p.filter((x) => attr(x, 'threePoint') >= 62).length;
  return {
    size: p.length,
    overall: Math.round(mean(p, ovr)),
    shooting: Math.round(mean(p, (x) => (attr(x, 'threePoint') * 0.6 + attr(x, 'midRange') * 0.4))),
    // Spacing is a count problem, not an average one: four shooters and a
    // non-shooter spaces a floor, and three and two does not.
    spacing: Math.round(clamp((shooters / UNIT_SIZE) * 100 + (mean(p, (x) => attr(x, 'threePoint')) - 50) * 0.4, 0, 99)),
    finishing: Math.round(mean(p, (x) => (attr(x, 'layup') * 0.6 + attr(x, 'dunk') * 0.4))),
    playmaking: Math.round(mean(p, (x) => (attr(x, 'passing') * 0.5 + attr(x, 'passingIQ') * 0.3
      + attr(x, 'ballHandling') * 0.2))),
    perimeterD: Math.round(mean(p, (x) => attr(x, 'perimeterDefense'))),
    // One rim protector covers a lineup, so this is the best of them lifted by
    // the rest rather than a flat average.
    rimProtection: Math.round(best(p, (x) => attr(x, 'block')) * 0.62
      + mean(p, (x) => attr(x, 'interiorDefense')) * 0.38),
    rebounding: Math.round(mean(p, (x) => (attr(x, 'defensiveRebound') * 0.65
      + attr(x, 'offensiveRebound') * 0.35))),
    athleticism: Math.round(mean(p, (x) => (attr(x, 'speed') * 0.4 + attr(x, 'agility') * 0.3
      + attr(x, 'vertical') * 0.3))),
    shooters,
    /** Positions covered, and which are doubled up or missing. */
    positions: coverage(p),
  };
}

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

/**
 * Which positions a unit covers.
 *
 * Reported, never enforced. The save has no data on who can cover which spot,
 * so a lineup with three centres is allowed and simply told that it has three
 * centres — which is information the user can act on, unlike a refusal.
 */
export function coverage(players) {
  const counts = Object.fromEntries(POSITIONS.map((x) => [x, 0]));
  for (const p of players) if (counts[p.position] != null) counts[p.position]++;
  return {
    counts,
    missing: POSITIONS.filter((x) => !counts[x]),
    doubled: POSITIONS.filter((x) => counts[x] > 1),
  };
}

/** A one-line read on a unit, from its own numbers. */
export function unitSummary(r) {
  if (!r) return 'Pick five players to see what this unit does.';
  const notes = [];
  if (r.spacing >= 70) notes.push('spaces the floor well');
  else if (r.spacing <= 40) notes.push('will be crowded inside');
  if (r.rimProtection >= 72) notes.push('protects the rim');
  else if (r.rimProtection <= 50) notes.push('gives up the paint');
  if (r.playmaking >= 70) notes.push('has plenty of creation');
  else if (r.playmaking <= 48) notes.push('is short of a ball handler');
  if (r.rebounding >= 70) notes.push('rebounds');
  if (!notes.length) notes.push('is balanced across the board');
  const pos = r.positions.missing.length
    ? ` No ${r.positions.missing.join(', ')} on the floor.` : '';
  return `This unit ${notes.join(', ')}.${pos}`;
}

/**
 * The units as they should be read: stored where the players are still here,
 * seeded from the depth chart where they are not.
 */
export function reconcileUnits(stored, roster) {
  const byId = new Map(roster.map((p) => [p.id, p]));
  const order = depthOrder(roster);
  const seed = {
    starting: order.slice(0, 5),
    closing: order.slice(0, 5),
    bench: order.slice(5, 10),
    small: order.filter((p) => p.position !== 'C').slice(0, 5),
    big: [...order].sort((a, b) => (Number(b.heightIn) || 0) - (Number(a.heightIn) || 0)).slice(0, 5),
  };
  const out = {};
  for (const slot of UNIT_SLOTS) {
    const kept = ((stored && stored[slot.key]) || []).filter((id) => byId.has(id));
    // A traded player leaves a hole rather than invalidating the unit, and the
    // hole is filled from the depth chart so the screen always has five.
    const fill = (seed[slot.key] || order).map((p) => p.id)
      .filter((id) => !kept.includes(id));
    out[slot.key] = [...kept, ...fill].slice(0, UNIT_SIZE);
  }
  return out;
}
