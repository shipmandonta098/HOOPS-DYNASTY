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
  { key: 'phy', label: 'Physical',   short: 'PHY', parts: [
    ['strength', 1], ['speed', 1], ['agility', 0.9], ['vertical', 0.8],
    ['stamina', 0.6], ['endurance', 0.6],
  ] },
  // NOTE: Shooting carries the whole scoring game, finishing and post play
  // included — not just jump shooting. Position weights below are set against
  // that meaning, which is why a centre's Shooting weight is not tiny.
  { key: 'sho', label: 'Shooting',   short: 'SHO', parts: [
    ['threePoint', 1], ['midRange', 0.95], ['layup', 0.85], ['shotIQ', 0.8],
    ['dunk', 0.6], ['postControl', 0.55], ['freeThrow', 0.5],
  ] },
  { key: 'ply', label: 'Playmaking', short: 'PLY', parts: [
    ['passing', 1], ['ballHandling', 0.95], ['passingIQ', 0.8],
  ] },
  { key: 'def', label: 'Defense',    short: 'DEF', parts: [
    ['perimeterDefense', 1], ['interiorDefense', 1], ['defensiveIQ', 0.8],
    ['steal', 0.6], ['block', 0.6],
  ] },
  { key: 'reb', label: 'Rebounding', short: 'REB', parts: [
    ['defensiveRebound', 1], ['offensiveRebound', 0.8],
  ] },
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
  PG: { phy: 0.14, sho: 0.28, ply: 0.32, def: 0.19, reb: 0.07 },
  SG: { phy: 0.16, sho: 0.34, ply: 0.19, def: 0.22, reb: 0.09 },
  SF: { phy: 0.19, sho: 0.30, ply: 0.15, def: 0.23, reb: 0.13 },
  PF: { phy: 0.21, sho: 0.24, ply: 0.10, def: 0.25, reb: 0.20 },
  C:  { phy: 0.22, sho: 0.21, ply: 0.08, def: 0.27, reb: 0.22 },
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
 * Word for a 0-99 rating. Shares gradeBand's thresholds exactly, so the label
 * and the colour can never disagree.
 */
export function ratingLabel(v) {
  if (typeof v !== 'number') return '—';
  if (v >= 80) return 'Elite';
  if (v >= 70) return 'Good';
  if (v >= 66) return 'Solid';
  if (v >= 61) return 'Average';
  return 'Poor';
}

/** Full name for a position code, for headers that have room for it. */
export const POSITION_NAME = {
  PG: 'Point Guard', SG: 'Shooting Guard', SF: 'Small Forward',
  PF: 'Power Forward', C: 'Center',
};

/** Every attribute the schema defines, in the order the categories list them. */
export const ATTR_LABELS = {
  strength: 'Strength', speed: 'Speed', vertical: 'Vertical', agility: 'Agility',
  stamina: 'Stamina', endurance: 'Endurance',
  layup: 'Layups', dunk: 'Dunk', threePoint: 'Three Point', midRange: 'Midrange',
  freeThrow: 'Free Throw', postControl: 'Post Control', shotIQ: 'Shot IQ',
  passing: 'Passing', passingIQ: 'Passing IQ', ballHandling: 'Ball Handling',
  perimeterDefense: 'Perimeter Defense', interiorDefense: 'Interior Defense',
  steal: 'Steals', block: 'Blocks', defensiveIQ: 'Defensive IQ',
  offensiveRebound: 'Offensive Rebounding', defensiveRebound: 'Defensive Rebounding',
};

/**
 * The colour band a 0-99 rating sits in. Every rating shown anywhere in the
 * game — overall, potential, category scores, the twenty-three attributes and
 * the letter grades derived from them — runs through this one function, so
 * the scale is the same on every screen by construction.
 *
 *   elite  80-99  bright green   All-Star and above
 *   good   70-79  green          starter / strong rotation
 *   solid  66-69  lime           slightly above average
 *   avg    61-65  yellow         average to below average
 *   poor    0-60  red            fringe / replacement level
 *
 * Colours live in theme.css as .g-<band>.
 */
export function gradeBand(v) {
  if (typeof v !== 'number') return '';
  if (v >= 80) return 'elite';
  if (v >= 70) return 'good';
  if (v >= 66) return 'solid';
  if (v >= 61) return 'avg';
  return 'poor';
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
