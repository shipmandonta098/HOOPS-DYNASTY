'use strict';

/**
 * playerRatings.js — shared, browser-side player maths.
 *
 * Everything here is arithmetic on values that ACTUALLY EXIST in the save
 * (player.attributes, player.overall). Nothing is invented. Screens import
 * from here so the Roster, the Dashboard and anything added later grade a
 * player identically instead of each rolling their own.
 *
 * (engine/lib/ratings.js is the Node/CommonJS equivalent used by the sim.
 * This is the browser ES-module side; keep the two in step if you change the
 * definition of "overall".)
 */

/* ---------------------------------------------------------------------------
 * ATTRIBUTE CATEGORIES
 * ---------------------------------------------------------------------------
 * The save stores 14 raw attributes. Showing all 14 in a roster row is
 * unreadable, so they roll up into five categories. Every one of the 14 feeds
 * exactly one category — nothing is double-counted and nothing is ignored,
 * which is what makes the category score an honest average rather than a
 * flattering one.
 *
 * `weight` biases a category toward the attribute that defines it (a centre's
 * Defense is more about interior D and blocks than steals). Weights are
 * relative within a category only.
 */
export const ATTR_GROUPS = [
  { key: 'phy', label: 'Physical',   short: 'PHY',
    parts: [['athleticism', 1], ['insideScoring', 0.8]] },
  { key: 'sho', label: 'Shooting',   short: 'SHO',
    parts: [['threePoint', 1], ['midRange', 0.9], ['freeThrow', 0.5]] },
  { key: 'ply', label: 'Playmaking', short: 'PLY',
    parts: [['passing', 1], ['ballHandling', 0.9], ['basketballIQ', 0.7]] },
  { key: 'def', label: 'Defense',    short: 'DEF',
    parts: [['perimeterDefense', 1], ['interiorDefense', 1], ['block', 0.6], ['steal', 0.6]] },
  { key: 'reb', label: 'Rebounding', short: 'REB',
    parts: [['defensiveRebound', 1], ['offensiveRebound', 0.8]] },
];

/** Weighted 0-99 score for one category, or null if the save has none of it. */
export function groupScore(player, group) {
  const a = (player && player.attributes) || {};
  let sum = 0, wt = 0;
  for (const [attr, w] of group.parts) {
    const v = a[attr];
    if (typeof v === 'number') { sum += v * w; wt += w; }
  }
  return wt ? Math.round(sum / wt) : null;
}

/** All five categories at once, as { phy, sho, ply, def, reb }. */
export function groupScores(player) {
  const out = {};
  for (const g of ATTR_GROUPS) out[g.key] = groupScore(player, g);
  return out;
}

/* ---------------------------------------------------------------------------
 * GRADES
 * ------------------------------------------------------------------------ */

/** 0-99 -> letter grade. Thresholds are the display scale, nothing more. */
export function letterGrade(v) {
  if (typeof v !== 'number') return '—';
  if (v >= 92) return 'A+';
  if (v >= 87) return 'A';
  if (v >= 82) return 'A-';
  if (v >= 77) return 'B+';
  if (v >= 72) return 'B';
  if (v >= 67) return 'B-';
  if (v >= 62) return 'C+';
  if (v >= 57) return 'C';
  if (v >= 52) return 'C-';
  if (v >= 47) return 'D+';
  if (v >= 42) return 'D';
  if (v >= 37) return 'D-';
  return 'F';
}

/** Which colour band a grade sits in: 'hi' | 'mid' | 'lo' (or '' if absent). */
export function gradeBand(v) {
  if (typeof v !== 'number') return '';
  if (v >= 67) return 'hi';    // B- and up
  if (v >= 52) return 'mid';   // C- .. C+
  return 'lo';
}

/* ---------------------------------------------------------------------------
 * SHARED HELPERS
 * ------------------------------------------------------------------------ */

/** Player overall — the cached field when present, else the attribute mean. */
export function ovr(p) {
  if (p && typeof p.overall === 'number') return p.overall;
  const a = (p && p.attributes) || {};
  const k = Object.keys(a);
  return k.length ? Math.round(k.reduce((s, x) => s + a[x], 0) / k.length) : 0;
}

/** Copy of `list`, best overall first. */
export const byOvr = (list) => [...list].sort((a, b) => ovr(b) - ovr(a));

/** "Jalen Thompson" -> "JT". Used wherever a player has no photo (we have none). */
export const initials = (n) =>
  String(n || '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

/**
 * A player's contract status, straight from the stored contract object.
 * Returns { label, sub, tone } — tone drives the badge colour.
 * Deliberately conservative: we only describe fields the save actually has
 * (salary, yearsRemaining, type, playerOption, teamOption).
 */
export function contractStatus(p) {
  const c = p && p.contract;
  if (!c) return { label: 'No Contract', sub: 'Unsigned', tone: 'muted' };
  const yrs = Number(c.yearsRemaining) || 0;
  const label = yrs === 1 ? '1 YR' : `${yrs} YRS`;
  if (c.playerOption) return { label, sub: 'Player Option', tone: 'option' };
  if (c.teamOption)   return { label, sub: 'Team Option',   tone: 'option' };
  if (yrs <= 1)       return { label, sub: 'Expiring',      tone: 'warn' };
  return { label, sub: TYPE_LABEL[c.type] || 'Under Contract', tone: 'ok' };
}

const TYPE_LABEL = {
  rookie: 'Rookie Deal',
  standard: 'Under Contract',
  max: 'Max Deal',
  vet_min: 'Veteran Min',
};
