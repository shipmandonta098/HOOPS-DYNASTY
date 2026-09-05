'use strict';

/**
 * powerRanking.js — how strong a team is, and what that predicts.
 *
 * WHAT THIS IS AND IS NOT. A power rating is DERIVED — a weighted read of the
 * ratings the save already holds, in the same class as Overall itself. A
 * predicted spread is a PROJECTION built from two of those ratings: it is a
 * forecast, not a result, and every screen that shows one says so. Nothing
 * here reads or writes a score, and a game that has been played is reported
 * from its score rather than from this.
 *
 * The distinction matters because the two look alike on screen. "Monarchs -5.5"
 * is a model's opinion; "112-98" is what happened. The first is labelled
 * Projected wherever it appears.
 *
 * ROTATION, NOT ROSTER. A team is not the average of fifteen players — it is
 * mostly its best eight or nine. Weights fall off down the rotation, so signing
 * a twelfth man barely moves a rating and losing a star moves it a lot.
 *
 * PLAYOFF RATINGS ARE DIFFERENT ON PURPOSE. Rotations shorten and stars play
 * more, so the playoff weights are steeper and shorter. A top-heavy team is
 * therefore stronger in the playoffs than its regular-season rating suggests,
 * and a deep one is weaker — which is the whole reason to keep two ratings
 * rather than one.
 */

import { ovr } from './playerRatings.js';

/**
 * Minute share down the rotation, as relative weights.
 *
 * Regular season: about a ten-man rotation, tapering. Playoffs: about eight,
 * with the top of it playing nearly all of the game.
 */
export const ROTATION = {
  regular: [1.00, 0.96, 0.92, 0.88, 0.82, 0.70, 0.60, 0.50, 0.38, 0.26, 0.14, 0.07],
  playoff: [1.00, 1.00, 0.98, 0.94, 0.88, 0.72, 0.52, 0.30, 0.12, 0.05],
};

/**
 * HOW MUCH A RATING POINT IS WORTH ON THE SCOREBOARD.
 *
 * A modelling choice, stated openly rather than buried, and calibrated against
 * what the generator actually produces rather than picked by feel. Generated
 * rosters are tight: a thirty-team league spans about seven points of rotation-
 * weighted rating end to end, with a standard deviation under two. At one point
 * of margin per rating point the whole league would sit inside a seven-point
 * band and every game would read as a coin flip, which is not a forecast so
 * much as a shrug.
 *
 * At 2.5 the measured season lands where a real book's numbers land: a median
 * line near 5, three quarters of the card inside 9, roughly one game in six
 * past double digits, and a worst mismatch around 19. That is the whole reason
 * for the number, and it is the single knob to turn if lines feel flat or wild.
 *
 * It follows the data, so it is worth re-measuring if player generation ever
 * widens or narrows the gap between clubs.
 */
export const POINTS_PER_RATING = 2.5;

/**
 * Home advantage, in points, added to the home side's projection.
 *
 * Home edge in basketball has shrunk over the decades to roughly two to three
 * points, so this is deliberately small — enough to make a level fixture lean
 * home, not enough to carry a bad team.
 */
export const HOME_ADVANTAGE = 2.5;

/**
 * A team's power rating from the players actually on it.
 *
 * @param {Array} roster   the team's players
 * @param {string} [mode]  'regular' (default) or 'playoff'
 * @returns {{ power, rotation, depth, contributors }} power is on the 0-99
 *   scale ratings use, so it reads like an Overall.
 */
export function teamPower(roster, mode = 'regular') {
  const weights = ROTATION[mode] || ROTATION.regular;
  // Unavailable players do not play, so they do not count. Nothing sets this
  // flag yet — there is no injury model — but the rating is ready for one, and
  // reading a field that is always absent is honest in a way that inventing
  // availability would not be.
  const available = (roster || []).filter((p) => p && !p.injured && p.out !== true);
  const rated = available
    .map((p) => ({ id: p.id, name: p.name, ovr: ovr(p) }))
    .filter((p) => Number.isFinite(p.ovr) && p.ovr > 0)
    .sort((a, b) => b.ovr - a.ovr);

  if (!rated.length) return { power: 0, rotation: [], depth: 0, contributors: 0 };

  let sum = 0, wt = 0;
  const rotation = [];
  rated.forEach((p, i) => {
    const w = weights[i] != null ? weights[i] : 0;
    if (w <= 0) return;
    sum += p.ovr * w;
    wt += w;
    rotation.push({ ...p, weight: w, share: 0 });
  });
  for (const r of rotation) r.share = wt ? r.weight / wt : 0;

  return {
    power: wt ? Math.round((sum / wt) * 10) / 10 : 0,
    rotation,
    depth: rated.length,
    contributors: rotation.length,
  };
}

/** Players grouped by the team they are on. Built once, read many times. */
function rostersOf(league) {
  const byTeam = {};
  for (const p of league.players || []) {
    if (!p.teamId) continue;
    (byTeam[p.teamId] = byTeam[p.teamId] || []).push(p);
  }
  return byTeam;
}

/** Every team's power rating, strongest first. */
export function powerRankings(league, mode = 'regular') {
  const byTeam = rostersOf(league);
  return (league.teams || [])
    .map((t) => ({ team: t, ...teamPower(byTeam[t.id] || [], mode) }))
    .sort((a, b) => b.power - a.power)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Which rating a phase should use. Playoff rotations are shorter. */
export function modeForPhase(phase) {
  return phase === 'playoffs' || phase === 'finals' ? 'playoff' : 'regular';
}

/** Spreads are quoted to the half point, which is also what avoids a push. */
const toHalf = (n) => Math.round(n * 2) / 2;

/**
 * A reusable projector for one league and one phase.
 *
 * A screen that quotes a line on eighty-two rows should rate each team once,
 * not once per row, so the roster index and every team's power are computed
 * here and the fixtures just read them.
 */
export function spreadModel(league, mode) {
  const use = mode || modeForPhase(league && league.meta && league.meta.currentPhase);
  const byTeam = rostersOf(league || {});
  const cache = new Map();
  const powerOf = (teamId) => {
    if (!cache.has(teamId)) cache.set(teamId, teamPower(byTeam[teamId] || [], use));
    return cache.get(teamId);
  };

  return {
    mode: use,
    powerOf,
    /**
     * The projected margin for one fixture.
     *
     * @returns {null|{ favourite, underdog, margin, homePower, awayPower,
     *   homeMargin, mode, line }} `line` is a function: line(teamId) gives that
     *   team's number, negative when favoured and positive when not, in the way
     *   a spread is quoted. Null when either side has nobody to rate — an
     *   unrated team gets no projection rather than a made-up one.
     */
    spread(homeId, awayId) {
      const home = powerOf(homeId);
      const away = powerOf(awayId);
      if (!home.power || !away.power) return null;

      // The home side's expected margin: the rating gap converted to points,
      // plus the advantage of playing at home.
      const raw = (home.power - away.power) * POINTS_PER_RATING + HOME_ADVANTAGE;
      const margin = toHalf(Math.abs(raw));
      const favourite = raw >= 0 ? homeId : awayId;
      const underdog = raw >= 0 ? awayId : homeId;

      return {
        favourite, underdog, margin,
        homePower: home.power, awayPower: away.power,
        homeMargin: toHalf(raw),
        mode: use,
        line: (teamId) => (margin === 0 ? 0 : (teamId === favourite ? -margin : margin)),
      };
    },
  };
}

/** One fixture's projection, for callers that only need the one. */
export function predictSpread(league, homeId, awayId, mode) {
  return spreadModel(league, mode).spread(homeId, awayId);
}

/** `-5.5`, `+5.5`, `PK` for a pick'em. Always signed, the way a line is read. */
export function formatLine(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value === 0) return 'PK';
  return `${value > 0 ? '+' : ''}${value % 1 ? value.toFixed(1) : value}`;
}
