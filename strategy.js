'use strict';

/**
 * strategy.js — the instructions a coach gives, and what they actually do.
 *
 * EVERY SETTING HERE CHANGES A SIMULATED GAME. That is the whole point and it
 * is worth stating plainly, because a strategy screen whose controls do not
 * reach the simulator is decoration — it looks like depth and is a set of
 * dropdowns that remember themselves. Each option below carries the exact
 * numbers it feeds into gameSim, and the effects are measurable: turn pace up
 * and possessions go up, tell a team to crash the glass and its offensive
 * rebounds go up and its opponent's transition chances with them.
 *
 * NOTHING HERE TOUCHES A PLAYER. Strategy modifies how a team plays, never who
 * the players are — no attribute, rating, potential or Overall is altered by
 * anything on this screen. A badly coached good player is still a good player.
 */

/**
 * Each option's effect, as multipliers and offsets the simulator reads.
 *
 * `pace`      multiplies possessions
 * `three`     multiplies how often a three is taken
 * `rim`       multiplies how often the ball goes to the rim
 * `crash`     shifts the offensive rebound rate, in absolute probability
 * `tov`       shifts the turnover rate, in absolute probability
 * `steal`     multiplies the defence's chance of forcing one
 * `foul`      multiplies how often the defence fouls
 * `defRim`    multiplies interior defence
 * `defPerim`  multiplies perimeter defence
 */
export const STRATEGY = {
  pace: {
    label: 'Pace',
    blurb: 'How quickly the team looks for its shot.',
    options: {
      'Walk It Up': { pace: 0.88, tov: -0.004, blurb: 'Fewer possessions, cleaner ones.' },
      Balanced: { pace: 1.00, blurb: 'No particular hurry either way.' },
      'Push The Ball': { pace: 1.09, tov: +0.010, blurb: 'More possessions, more mistakes.' },
      'Run And Gun': { pace: 1.18, tov: +0.020, blurb: 'Everything early, whatever the cost.' },
    },
  },
  offense: {
    label: 'Offensive Focus',
    blurb: 'Where the shots come from.',
    options: {
      'Inside Out': { rim: 1.30, three: 0.78, blurb: 'Work the paint first.' },
      Balanced: { blurb: 'Take what the defence gives.' },
      'Perimeter Heavy': { rim: 0.76, three: 1.34, blurb: 'Hunt threes.' },
      'Three Point Barrage': { rim: 0.62, three: 1.62, blurb: 'Live and die from deep.' },
    },
  },
  defense: {
    label: 'Defensive Scheme',
    blurb: 'How the defence is set.',
    options: {
      'Protect The Paint': { defRim: 1.14, defPerim: 0.92, blurb: 'Pack it in, concede the three.' },
      Balanced: { blurb: 'No lean either way.' },
      'Switch Everything': { defPerim: 1.08, defRim: 0.95, blurb: 'Stay attached outside.' },
      'Full Court Pressure': { steal: 1.35, foul: 1.30, defRim: 0.92, defPerim: 0.96,
        blurb: 'Force mistakes, give up fouls and easy looks.' },
    },
  },
  rebounding: {
    label: 'Rebounding',
    blurb: 'Crash the offensive glass, or get back.',
    options: {
      'Get Back': { crash: -0.055, pace: 0.98, blurb: 'Concede second chances, stop transition.' },
      Balanced: { blurb: 'Send whoever is in position.' },
      'Crash The Glass': { crash: +0.060, blurb: 'Second chances, at the cost of getting back.' },
    },
  },
};

/** Defaults, which are the neutral option of every dial. */
export function defaultStrategy() {
  const out = {};
  for (const [key, group] of Object.entries(STRATEGY)) {
    out[key] = Object.keys(group.options).find((k) => k === 'Balanced')
      || Object.keys(group.options)[0];
  }
  return out;
}

/** A stored strategy, with anything unrecognised replaced by the default. */
export function reconcileStrategy(stored) {
  const base = defaultStrategy();
  const out = { ...base };
  for (const key of Object.keys(STRATEGY)) {
    const v = stored && stored[key];
    if (v && STRATEGY[key].options[v]) out[key] = v;
  }
  return out;
}

/**
 * Every chosen option's effects, multiplied together into one set of numbers.
 *
 * Multipliers compound and offsets add, so two settings that both push pace up
 * push it up further, and the simulator reads one object rather than four.
 */
export function strategyEffects(stored) {
  const chosen = reconcileStrategy(stored);
  const e = { pace: 1, three: 1, rim: 1, crash: 0, tov: 0, steal: 1, foul: 1, defRim: 1, defPerim: 1 };
  for (const [key, name] of Object.entries(chosen)) {
    const opt = (STRATEGY[key] && STRATEGY[key].options[name]) || {};
    for (const k of Object.keys(e)) {
      if (opt[k] == null) continue;
      if (k === 'crash' || k === 'tov') e[k] += opt[k];   // absolute shifts
      else e[k] *= opt[k];                                 // multipliers
    }
  }
  return { chosen, ...e };
}

/** What the current choices add up to, in words the user can check. */
export function strategySummary(stored) {
  const e = strategyEffects(stored);
  const pct = (v) => `${v >= 1 ? '+' : ''}${Math.round((v - 1) * 100)}%`;
  const rows = [
    { label: 'Possessions', value: pct(e.pace) },
    { label: 'Three-point rate', value: pct(e.three) },
    { label: 'Shots at the rim', value: pct(e.rim) },
    { label: 'Offensive rebound rate',
      value: `${e.crash >= 0 ? '+' : ''}${Math.round(e.crash * 100)} pts` },
    { label: 'Turnovers', value: `${e.tov >= 0 ? '+' : ''}${(e.tov * 100).toFixed(1)} pts` },
    { label: 'Steals forced', value: pct(e.steal) },
    { label: 'Fouls committed', value: pct(e.foul) },
    { label: 'Interior defence', value: pct(e.defRim) },
    { label: 'Perimeter defence', value: pct(e.defPerim) },
  ];
  return rows.filter((r) => !/^\+0%$|^\+0 pts$|^\+0\.0 pts$/.test(r.value));
}
