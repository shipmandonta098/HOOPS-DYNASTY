'use strict';

/**
 * playerBio.js — biographical fields, GENERATED ONCE AND STORED IN THE SAVE.
 *
 * This is the honest way to have a bio panel. Nothing here is invented at
 * render time: makeBio() runs inside league generation, off the same seeded
 * RNG as everything else, and the result is written into the player record.
 * The profile modal then reads real stored fields, exactly like it reads
 * name, age and attributes.
 *
 * Everything is internally consistent by construction:
 *   experience = age - entryAge, and draft.year = startSeason - experience,
 *   so a player's age, years of service and draft year can never disagree.
 *   birthDate's year is derived from age the same way.
 *
 * Colleges and birthplaces are fictional-safe: invented schools, and real
 * cities only (a city is not a league or a team, so it carries no sports
 * branding).
 *
 * Where a player is from now comes from nameCultures.js, which owns the
 * country/city table AND the naming traditions, so that a player's birthplace
 * and his name are drawn together instead of independently. That module is the
 * only place either lives; this one just merges the result into the record.
 *
 * Personality used to live here as a single label. It is now its own layer
 * (playerPersonality.js) with multiple traits and derived career priorities,
 * because "what kind of person is this to manage" is not a biographical fact
 * like a birthplace.
 */

import { makeOrigin } from './nameCultures.js';

/* ------------------------------------------------------------------ pools */

/** Invented schools — no real programs, no real developmental leagues. */
export const COLLEGES = [
  'Westlake State', 'Cardinal Ridge', 'Northgate', 'St. Ambrose',
  'Lakeshore Tech', 'Verdant Valley', 'Ironwood', 'Summit College',
  'Pinehurst A&M', 'Granite State', 'Ashford', 'Blue Harbor',
  'Coastal Polytechnic', 'Fairmont', 'Kingsbury', 'Redstone',
  'Silverbrook', 'Thornfield University', 'Cascade State', 'Marlowe',
  'Overseas Professional', 'Developmental League',
];


/**
 * Height range in inches, plus a build adjustment in pounds. Weight is
 * 4.7 lb per inch minus 150 — which puts a 6'0" guard near 190 and a 7'0"
 * centre near 245 — and `build` shifts that by position.
 */
// Fallback frame, used only when a caller has no generated one to pass in
// (an old save being repaired). New players get their height and weight from
// playerGen.js, BEFORE any rating exists, because the body is what decides
// which ratings are plausible — see makeFrame() there.
const BUILD = {
  PG: { lo: 71, hi: 77, build: -6 },
  SG: { lo: 74, hi: 80, build: -2 },
  SF: { lo: 77, hi: 82, build: +3 },
  PF: { lo: 79, hi: 84, build: +10 },
  C:  { lo: 81, hi: 87, build: +18 },
};

const MONTH = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_IN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/* -------------------------------------------------------------- generation */

/**
 * Build one player's biography.
 * @param {object} rng          the league's seeded RNG (int/pick/gauss)
 * @param {object} o            { position, age, startSeason }
 * @returns {object} fields to merge into the player record
 */
export function makeBio(rng, { position, age, startSeason, heightIn: h, weightLb: wt }) {
  const build = BUILD[position] || BUILD.SF;
  // The generator draws the frame first and hands it here, so the body in the
  // biography is the same body the ratings were built around.
  const heightIn = typeof h === 'number' ? h : rng.int(build.lo, build.hi);
  const weightLb = typeof wt === 'number' ? wt : Math.max(155, Math.min(330, Math.round(
    heightIn * 4.7 - 150 + build.build + rng.gauss(0, 8))));

  // Age drives everything else, so service time and draft year always agree.
  const entryAge = rng.int(19, 23);
  const experience = Math.max(0, age - entryAge);
  const undrafted = rng.int(1, 100) <= 12;

  // Birthplace, nationality and naming tradition are ONE draw, not three:
  // a player born in Bamako should not end up with an unrelated name.
  const origin = makeOrigin(rng);
  const monthIdx = rng.int(0, 11);

  return {
    heightIn,
    weightLb,
    birthDate: {
      year: startSeason - age,
      month: monthIdx + 1,
      day: rng.int(1, DAYS_IN[monthIdx]),
    },
    birthplace: {
      city: origin.birthCity,
      region: origin.birthRegion,
      country: origin.birthCountry,
    },
    nationality: origin.nationality,
    // Born in one country, raised in another — null for most players.
    secondaryNationality: origin.secondaryNationality,
    // The naming tradition his name was drawn from. A naming tradition and
    // nothing else: not ancestry, not appearance. If portraits ever exist they
    // need their own variable rather than reading this one.
    namingOrigin: origin.namingOrigin,
    gender: origin.gender,
    college: rng.pick(COLLEGES),
    experience,
    draft: undrafted ? null : {
      year: startSeason - experience,
      round: rng.int(1, 100) <= 62 ? 1 : 2,
      pick: rng.int(1, 30),
    },
    // Starting values. The season simulator is free to move these later.
    morale: Math.max(20, Math.min(99, Math.round(rng.gauss(70, 12)))),
    fatigue: rng.int(0, 10),
  };
}

/* ---------------------------------------------------------------- display */

/** 78 -> `6'6"`. */
export function formatHeight(inches) {
  if (typeof inches !== 'number') return '—';
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

/** { year, month, day } -> "May 17, 1992". */
export function formatBirthDate(b) {
  if (!b || typeof b.year !== 'number') return '—';
  return `${MONTH[(b.month || 1) - 1]} ${b.day || 1}, ${b.year}`;
}

/** { city, region, country } -> "Norwalk, CT, USA". */
export function formatBirthplace(b) {
  if (!b || !b.city) return '—';
  return [b.city, b.region, b.country].filter(Boolean).join(', ');
}

/** { year, round, pick } -> "Round 1, Pick 9 (2022)"; null -> "Undrafted". */
export function formatDraft(d) {
  if (!d) return 'Undrafted';
  return `Round ${d.round}, Pick ${d.pick} (${d.year})`;
}

/** Morale 0-99 -> a word plus a colour band shared with the ratings scale. */
export function moraleLabel(v) {
  if (typeof v !== 'number') return { text: '—', band: '' };
  if (v >= 85) return { text: 'Thrilled', band: 'hi' };
  if (v >= 65) return { text: 'Happy', band: 'hi' };
  if (v >= 45) return { text: 'Content', band: 'mid' };
  if (v >= 30) return { text: 'Restless', band: 'mid' };
  return { text: 'Unhappy', band: 'lo' };
}

/** Fatigue 0-99 -> a word. Low is good here, so the bands invert. */
export function fatigueLabel(v) {
  if (typeof v !== 'number') return { text: '—', band: '' };
  if (v < 20) return { text: 'Fresh', band: 'hi' };
  if (v < 50) return { text: 'Winded', band: 'mid' };
  if (v < 75) return { text: 'Tired', band: 'mid' };
  return { text: 'Exhausted', band: 'lo' };
}
