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
 * OVERALL
 * ---------------------------------------------------------------------------
 * ONE definition of overall, shared by the browser and (in the same form) by
 * engine/lib/ratings.js: a position-weighted blend of the five category
 * scores. Weights sum to 1 per position, so overalls stay comparable across
 * positions while each position values what it actually needs — playmaking
 * carries a point guard, defence and rebounding carry a centre.
 *
 * This is also what stops a player being punished for skills his role does not
 * ask for: a centre's shooting is worth 11% of his overall, so a rim protector
 * who cannot shoot is still rated on rim protection.
 */
export const POSITION_WEIGHTS = {
  PG: { phy: 0.13, sho: 0.25, ply: 0.35, def: 0.19, reb: 0.08 },
  SG: { phy: 0.15, sho: 0.33, ply: 0.20, def: 0.23, reb: 0.09 },
  SF: { phy: 0.19, sho: 0.27, ply: 0.16, def: 0.24, reb: 0.14 },
  PF: { phy: 0.22, sho: 0.18, ply: 0.11, def: 0.27, reb: 0.22 },
  C:  { phy: 0.24, sho: 0.11, ply: 0.09, def: 0.30, reb: 0.26 },
};

/**
 * Overall from the five categories, weighted by position. Pure, and the source
 * of truth — `player.overall` is a cache of exactly this.
 * @param {object} scores { phy, sho, ply, def, reb }
 * @param {string} position
 */
export function overallFromCategories(scores, position) {
  const w = POSITION_WEIGHTS[position] || POSITION_WEIGHTS.SF;
  let sum = 0, wt = 0;
  for (const k of Object.keys(w)) {
    const v = scores[k];
    if (typeof v === 'number') { sum += v * w[k]; wt += w[k]; }
  }
  return wt ? Math.max(0, Math.min(99, Math.round(sum / wt))) : 0;
}

/** Overall computed straight from a player's stored attributes. */
export function computeOverall(player) {
  return overallFromCategories(groupScores(player), player && player.position);
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

/**
 * Word for a 0-99 rating. Deliberately shares gradeBand's thresholds so the
 * label and the colour never disagree — "GOOD" is always green, "AVERAGE"
 * always amber.
 */
export function ratingLabel(v) {
  if (typeof v !== 'number') return '—';
  if (v >= 82) return 'Elite';
  if (v >= 67) return 'Good';
  if (v >= 52) return 'Average';
  return 'Poor';
}

/** Full name for a position code, for headers that have room for it. */
export const POSITION_NAME = {
  PG: 'Point Guard', SG: 'Shooting Guard', SF: 'Small Forward',
  PF: 'Power Forward', C: 'Center',
};

/** Every attribute the schema defines, in the order the categories list them. */
export const ATTR_LABELS = {
  athleticism: 'Athleticism', insideScoring: 'Inside Scoring',
  threePoint: 'Three Point', midRange: 'Mid Range', freeThrow: 'Free Throw',
  passing: 'Passing', ballHandling: 'Ball Handling', basketballIQ: 'Basketball IQ',
  perimeterDefense: 'Perimeter Defense', interiorDefense: 'Interior Defense',
  block: 'Block', steal: 'Steal',
  defensiveRebound: 'Defensive Rebound', offensiveRebound: 'Offensive Rebound',
};

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

/**
 * Player overall — the cached field when present, else computed from the
 * attributes with the same position-weighted definition that produced it.
 * (The old fallback was a flat mean of all fourteen attributes, which
 * disagreed with the cached value for anyone with a lopsided profile.)
 */
export function ovr(p) {
  if (p && typeof p.overall === 'number') return p.overall;
  if (p && p.attributes) return computeOverall(p);
  return 0;
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
