'use strict';

/**
 * migrate.js — bring older saves up to the current data model.
 *
 * Called from db.js's loadLeague(), so every screen reads migrated data and no
 * screen needs to know old shapes existed.
 *
 * The rule here is the same as everywhere else: MAP, never invent. A save made
 * before the attribute split holds fourteen ratings; the twenty-three it needs
 * now are derived from those real values (athleticism becomes the six physical
 * traits, insideScoring becomes layups/dunks/post control, basketballIQ
 * becomes the three IQ ratings). Nothing is conjured from nowhere, and a save
 * that already has the new shape is returned untouched.
 */

import { computeOverall } from './playerRatings.js';

/**
 * Old attribute -> the new attributes it feeds, with an offset applied so the
 * split is not a flat copy. `basketballIQ` genuinely described three separate
 * skills, so it splits three ways; `athleticism` was one number standing in
 * for a whole physical profile.
 */
const SPLIT = {
  athleticism:   [['speed', 0], ['agility', -1], ['vertical', +1], ['strength', -2],
                  ['stamina', 0], ['endurance', -1]],
  insideScoring: [['layup', +1], ['dunk', 0], ['postControl', -3]],
  basketballIQ:  [['shotIQ', 0], ['passingIQ', +1], ['defensiveIQ', 0]],
};

/** Attributes whose name and meaning are unchanged. */
const CARRIED = [
  'threePoint', 'midRange', 'freeThrow', 'passing', 'ballHandling',
  'perimeterDefense', 'interiorDefense', 'steal', 'block',
  'offensiveRebound', 'defensiveRebound',
];

const clamp = (v) => Math.max(20, Math.min(99, Math.round(v)));

/** True if this player already carries the current attribute shape. */
function isCurrent(attrs) {
  return typeof attrs.strength === 'number' && typeof attrs.shotIQ === 'number';
}

/**
 * Upgrade one player's attribute block in place. Returns true if it changed.
 * Overall is recomputed afterwards: the definition of overall changed with the
 * attributes, so keeping the old cached number would leave it disagreeing with
 * the skills it is supposed to summarise.
 */
function migratePlayer(p) {
  const attrs = p && p.attributes;
  if (!attrs || isCurrent(attrs)) return false;

  const next = {};
  for (const key of CARRIED) {
    if (typeof attrs[key] === 'number') next[key] = clamp(attrs[key]);
  }
  for (const [from, targets] of Object.entries(SPLIT)) {
    const base = typeof attrs[from] === 'number' ? attrs[from] : null;
    if (base === null) continue;
    for (const [to, offset] of targets) next[to] = clamp(base + offset);
  }
  // Anything the old save simply did not have — there is no honest source for
  // it, so it takes the mean of what the player does have rather than a
  // flattering or punishing guess.
  const known = Object.values(next);
  const fallback = known.length ? clamp(known.reduce((a, b) => a + b, 0) / known.length) : 50;
  for (const key of [...CARRIED, ...Object.values(SPLIT).flat().map(([t]) => t)]) {
    if (typeof next[key] !== 'number') next[key] = fallback;
  }

  p.attributes = next;
  p.overall = computeOverall(p);
  return true;
}

/**
 * Migrate a whole league. Mutates and returns it; safe to call repeatedly.
 * @returns {{ league: object, changed: number }}
 */
export function migrateLeague(league) {
  if (!league || !Array.isArray(league.players)) return { league, changed: 0 };
  let changed = 0;
  for (const p of league.players) if (migratePlayer(p)) changed++;
  // Fields added after the first saves shipped, defaulted rather than assumed.
  if (!Array.isArray(league.freeAgents)) league.freeAgents = [];
  if (!Array.isArray(league.transactions)) league.transactions = [];
  if (changed) {
    console.info(`Save upgraded: ${changed} player(s) moved to the 23-attribute model.`);
  }
  return { league, changed };
}
