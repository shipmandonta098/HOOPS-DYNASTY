'use strict';

/**
 * playerMental.js — the five mental attributes.
 *
 * WHY THESE LIVE OUTSIDE `player.attributes`
 * Overall is computed by iterating the ability categories over
 * `player.attributes`. If the mental ratings lived there, they would feed
 * overall the moment anyone added them to a category — a rule enforced only by
 * remembering it. They are stored on `player.mental` instead, so the
 * separation is structural: computeOverall() cannot see them, and no future
 * edit to the category tables can accidentally pull them in.
 *
 * WHAT THEY ARE
 * Overall says how good a player is. These say how that ability shows up when
 * the game gets difficult — after a turnover, in a hostile building, in a
 * close fourth quarter, when the coach changes his role.
 *
 * WHAT THEY ARE NOT
 * They are tendencies, never guarantees. 99 Composure makes a meltdown
 * unlikely, not impossible; 30 Resilience does not stop a player responding
 * well to adversity. `pressureFactor()` below enforces that at both ends, so
 * whatever consumes these later cannot turn a high rating into a certainty.
 */

export const MENTAL_ATTRS = [
  { key: 'resilience', label: 'Resilience',
    blurb: 'Bouncing back from mistakes, missed shots and bad stretches.' },
  { key: 'concentration', label: 'Concentration',
    blurb: 'Staying engaged across a whole game; fewer lapses and careless errors.' },
  { key: 'confidence', label: 'Confidence',
    blurb: 'Willingness to take the big shot and stay aggressive after a miss.' },
  { key: 'composure', label: 'Composure',
    blurb: 'Emotional control against crowds, trash talk, physical play and officials.' },
  { key: 'coachability', label: 'Coachability',
    blurb: 'Receptiveness to feedback, systems and changes of role.' },
];

export const MENTAL_KEYS = MENTAL_ATTRS.map((m) => m.key);

const clamp = (v) => Math.max(1, Math.min(99, Math.round(v)));

/**
 * Personality nudges one or two mental ratings — a Headstrong player really is
 * likelier to resist coaching. It is a TILT, not a derivation: personality
 * remains its own system, the shift is small next to the spread of the draws,
 * and every combination stays reachable (a Headstrong player can still roll
 * high Coachability).
 */
const PERSONALITY_TILT = {
  'Team-First':          { coachability: +8, confidence: -4 },
  'Competitor':          { resilience: +7, composure: -5 },
  'Vocal Leader':        { confidence: +9, coachability: -3 },
  'Quiet Professional':  { concentration: +8, composure: +6, confidence: -5 },
  'Coachable':           { coachability: +12 },
  'Streaky':             { resilience: -9, confidence: +6 },
  'Headstrong':          { coachability: -13, confidence: +7 },
  'Workhorse':           { concentration: +7, coachability: +5 },
  'Free Spirit':         { composure: -7, coachability: -6, confidence: +5 },
};

/**
 * Generate one player's mental profile.
 *
 * Deliberately NOT a function of overall or potential. A 62-overall reserve can
 * be the toughest-minded player in the league and a 95-overall star can be a
 * mess under pressure — that independence is measured in the tests, not just
 * intended.
 *
 * The five are drawn largely independently. A small shared "makeup" term keeps
 * them from being pure noise (some people are steadier across the board) but
 * is weak enough that lopsided profiles are common, which is the point: a 91
 * Resilience / 38 Coachability player has to be reachable.
 *
 * @param {object} rng     the league's seeded RNG
 * @param {object} o       { age, personality }
 */
export function makeMental(rng, { age = 25, personality = null } = {}) {
  const makeup = rng.gauss(0, 9);        // shared temperament, small on purpose
  const tilt = PERSONALITY_TILT[personality] || {};

  // Steadiness is partly learned. Composure and concentration drift up with
  // experience; confidence and coachability do not track age in any reliable
  // way, so they are left alone.
  const years = Math.max(0, Math.min(14, age - 21));
  const ageBonus = { composure: years * 0.8, concentration: years * 0.55 };

  const out = {};
  for (const { key } of MENTAL_ATTRS) {
    out[key] = clamp(
      rng.gauss(62, 17)                  // wide, so both tails are populated
      + makeup * 0.45
      + (ageBonus[key] || 0)
      + (tilt[key] || 0)
    );
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * READING THE RATINGS
 * ------------------------------------------------------------------------ */

/**
 * Turn a mental rating into a multiplier on the chance of a bad outcome —
 * the shape anything consuming these should use.
 *
 * The clamp is the point. At 99 the factor bottoms out at `floor` rather than
 * 0, so a meltdown stays possible; at 1 it tops out at `ceil` rather than
 * infinity, so a fragile player is not doomed every time. A rating of 62 (the
 * generation mean) returns ~1.0, i.e. no effect.
 *
 * Nothing consumes this yet — there is no game simulation — so it exists to
 * make the "tendency, never certainty" rule a property of the code rather than
 * a note someone has to remember when the sim is written.
 *
 * @param {number} rating 1-99
 * @param {object} opts   { strength, floor, ceil }
 * @returns {number} multiplier, ~0.35 (elite) to ~2.2 (poor)
 */
export function pressureFactor(rating, { strength = 1, floor = 0.35, ceil = 2.2 } = {}) {
  if (typeof rating !== 'number') return 1;
  const delta = (62 - Math.max(1, Math.min(99, rating))) / 37;   // -1 .. +1.65
  return Math.max(floor, Math.min(ceil, 1 + delta * 0.75 * strength));
}

/** One-line read on a mental profile, for a scouting blurb. */
export function mentalSummary(mental) {
  if (!mental) return null;
  const rated = MENTAL_ATTRS
    .map((m) => ({ ...m, v: mental[m.key] }))
    .filter((m) => typeof m.v === 'number');
  if (!rated.length) return null;
  const sorted = [...rated].sort((a, b) => b.v - a.v);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  if (best.v - worst.v < 12) {
    const mean = rated.reduce((s, m) => s + m.v, 0) / rated.length;
    return mean >= 72 ? 'Even-keeled and mentally solid across the board.'
      : mean >= 55 ? 'No strong mental tendencies either way.'
      : 'Struggles across most mental areas.';
  }
  return `${best.label} is his mental strength; ${worst.label.toLowerCase()} is the concern.`;
}
