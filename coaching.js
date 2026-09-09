'use strict';

/**
 * coaching.js — the coach, and everything a coach changes.
 *
 * THE SAVE HAD NO COACHES. Staff is an unbuilt screen and nothing in the game
 * generated one, so a module that only applied coach effects would have been
 * inert — a contract with nothing to feed it. This generates them too, so the
 * effects below act on real, stored, deterministic coaches rather than on an
 * object a caller has to invent.
 *
 * WHAT A COACH CAN AND CANNOT TOUCH. A coach changes TENDENCIES — how a player
 * plays — and how fast a player evolves, and how heavily fatigue lands. A coach
 * never touches an attribute, a rating, potential or Overall. That is the same
 * wall every other layer in this game respects, and it is the reason a badly
 * coached good player is still a good player.
 *
 * ONE TENDENCY IN THE BRIEF DOES NOT EXIST HERE. Motion asks for
 * `offBallMovement`, and this game's sixteen tendencies have no such entry.
 * The nearest real thing is `catchAndShoot` — shooting off the pass IS moving
 * without the ball — so that is where it lands, named in the table so the
 * substitution is visible rather than silent.
 */

import { makeRNG, hashString } from './leagueConfig.js';
import { makeName, makeOrigin } from './nameCultures.js';

/* ------------------------------------------------------------ the traits */

export const PHILOSOPHIES = {
  'Pace-and-Space': { shootThree: +5, catchAndShoot: +3, postUp: -3 },
  'Grit-and-Grind': { shootMidRange: +5, paintDefense: +3, crashBoards: +3 },
  // `offBallMovement` in the brief; this game's nearest tendency is
  // catchAndShoot, which is the same idea measured differently.
  Motion: { pass: +5, catchAndShoot: +3, isoCreate: -3 },
  Isolation: { isoCreate: +5, pullUp: +3, drive: +2 },
  'Defensive Anchor': { contestShots: +5, perimeterPressure: +5, gambleSteals: -3 },
};

export const DEVELOPMENT_STYLES = ['Growth', 'Veteran Trust', 'Balanced'];
export const MOTIVATIONAL_STYLES = ['Player-Friendly', 'Tough-Love', 'Neutral'];
export const VISIONS = ['Win-Now', 'Build', 'Balanced'];
export const ROTATION_STYLES = ['Balanced', 'Star-Heavy', 'Deep'];
export const IN_GAME = ['Aggressive', 'Conservative', 'Adaptive'];

/* -------------------------------------------------------------- generate */

/**
 * A coach for one team, stable for a given league and team.
 *
 * Ratings are drawn around a competent middle rather than uniformly: most
 * coaches in a league are ordinary, and the thresholds this brief uses (85 for
 * adaptability, 80 for discipline) should be a real distinction rather than
 * something two thirds of the league clears.
 */
export function makeCoach(rngSeed, teamId, gender) {
  const rng = makeRNG(hashString(`coach|${rngSeed}|${teamId}`));
  const around = (mid, spread) => Math.max(25, Math.min(99,
    Math.round(mid + (rng.next() + rng.next() + rng.next() - 1.5) * spread)));
  // The coin is drawn whether or not it is used, so a coach's TRAITS do not
  // depend on whether the caller happened to pass a gender. Otherwise the same
  // seed and team would produce a different philosophy and different ratings
  // purely because a settings field was present, which would be a nasty
  // surprise the first time a save was re-staffed.
  const coin = rng.next() < 0.85 ? 'male' : 'female';
  const origin = makeOrigin(rng, gender || coin);
  return {
    id: `coach_${teamId}`,
    teamId,
    name: makeName(rng, origin),
    role: 'Head Coach',
    coachTraits: {
      philosophy: rng.pick(Object.keys(PHILOSOPHIES)),
      developmentStyle: rng.pick(DEVELOPMENT_STYLES),
      motivationalStyle: rng.pick(MOTIVATIONAL_STYLES),
      adaptability: around(70, 22),
      discipline: around(70, 22),
      communication: around(72, 20),
      vision: rng.pick(VISIONS),
      rotationManagement: rng.pick(ROTATION_STYLES),
      inGameStrategy: rng.pick(IN_GAME),
    },
  };
}

/** Give every team a coach, leaving any that already has one alone. */
export function staffLeague(league) {
  const seed = (league.meta && league.meta.rngSeed) || 1;
  league.coaches = league.coaches || [];
  const have = new Set(league.coaches.map((c) => c.teamId));
  for (const t of league.teams || []) {
    if (have.has(t.id)) continue;
    league.coaches.push(makeCoach(seed, t.id, league.settings && league.settings.playerGender));
  }
  return league.coaches;
}

/** The coach of a team, or null. */
export function coachOf(league, teamId) {
  return ((league && league.coaches) || []).find((c) => c.teamId === teamId) || null;
}

const traits = (coach) => (coach && coach.coachTraits) || {};

/* ------------------------------------------- part 3: fatigue penalties */

/**
 * How a coach changes what a back-to-back costs.
 *
 * Multipliers on the penalty, so 0.8 means twenty per cent less. Returned
 * rather than applied, so the fatigue module stays the one place penalties are
 * actually computed.
 */
export function coachFatigueFactors(coach) {
  const t = traits(coach);
  let physical = 1, mental = 1;
  const applied = [];
  if (Number(t.adaptability) > 85) {
    physical *= 0.80; mental *= 0.80;
    applied.push('Adaptable coach (-20% both)');
  }
  if (Number(t.discipline) > 80) {
    mental *= 0.90;
    applied.push('Disciplined coach (-10% mental)');
  }
  if (t.rotationManagement === 'Balanced') {
    physical *= 0.90;
    applied.push('Balanced rotation (-10% physical)');
  }
  return { physical, mental, applied };
}

/* --------------------------------------------- part 4: fatigue recovery */

/** How a coach changes what a rest day gives back. */
export function coachRecoveryFactor(coach) {
  const t = traits(coach);
  if (t.motivationalStyle === 'Player-Friendly') {
    return { factor: 1.10, applied: ['Player-friendly coach (+10% recovery)'] };
  }
  if (t.motivationalStyle === 'Tough-Love') {
    return { factor: 0.90, applied: ['Tough-love coach (-10% recovery)'] };
  }
  return { factor: 1, applied: [] };
}

/* ------------------------------------------- part 5: philosophy on play */

/**
 * The tendency shifts a coach's philosophy asks for.
 *
 * FLAT POINTS, not percentages — the rule this project settled on for
 * in-game modifiers, with percentages reserved for season-to-season change.
 * How much of the ask actually lands depends on the player: a coachable
 * player takes nearly all of it, an uncoachable one takes a fraction, and a
 * communicative coach closes some of that gap.
 */
export function philosophyShift(coach, player, opts = {}) {
  const t = traits(coach);
  const table = PHILOSOPHIES[t.philosophy];
  if (!table) return { deltas: {}, uptake: 0, philosophy: null };

  const mental = (player && player.mental) || {};
  const coachability = Number(mental.coachability);
  // An uncoachable player still absorbs some of a system; a very coachable one
  // does not absorb more than the coach asked for. 0.45 to 1.0.
  const base = Number.isFinite(coachability)
    ? 0.45 + (Math.max(0, Math.min(99, coachability)) / 99) * 0.55
    : 0.72;
  const comm = Number(t.communication);
  const lift = Number.isFinite(comm) ? 1 + ((comm - 70) / 100) * 0.25 : 1;
  // coachability above 95 aligns faster, per the brief's mental rules.
  const fast = coachability > 95 ? 1.15 : 1;
  const uptake = Math.max(0, Math.min(1.25, base * lift * fast));

  const deltas = {};
  for (const [k, v] of Object.entries(table)) {
    const d = Math.round(v * uptake * 10) / 10;
    if (d) deltas[k] = d;
  }
  return { deltas, uptake: Math.round(uptake * 100) / 100, philosophy: t.philosophy };
}

/* ------------------------------------------ part 7: development style */

/**
 * How much a coach speeds up or steadies a player's year-on-year change.
 *
 * A PERCENTAGE, because this is season-to-season evolution — the other half of
 * the project's flat-points-in-game rule. Growth accelerates the young;
 * Veteran Trust steadies the old, which means LESS change, not more.
 */
export function developmentFactor(coach, player) {
  const t = traits(coach);
  const age = Number(player && player.age);
  if (!Number.isFinite(age)) return { factor: 1, applied: [] };
  if (t.developmentStyle === 'Growth' && age < 25) {
    return { factor: 1.10, applied: ['Growth coach, under 25 (+10% evolution)'] };
  }
  if (t.developmentStyle === 'Veteran Trust' && age > 30) {
    // "+10% stability" is less movement, not more — a stabiliser that
    // increased change would be the opposite of what the word means.
    return { factor: 0.90, applied: ['Veteran-trust coach, over 30 (+10% stability)'] };
  }
  return { factor: 1, applied: [] };
}

/** A one-line read on a coach, for a screen that wants to show one. */
export function coachSummary(coach) {
  const t = traits(coach);
  if (!t.philosophy) return null;
  return `${t.philosophy} · ${t.vision} · ${t.rotationManagement} rotation · `
    + `${t.motivationalStyle}`;
}
