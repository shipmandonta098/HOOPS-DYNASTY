'use strict';

/**
 * scheduleRules.js — the arithmetic a schedule has to satisfy.
 *
 * CONSTRAINT-BASED, NOT HARD-CODED. Nothing here knows what a 30-team league
 * looks like. Everything is computed from the league actually in front of it:
 * how many teams, how they are grouped, how long the season is, how much rest
 * is required. A twelve-team single-conference league and a thirty-two-team
 * league with eight divisions go through the same code and get answers that
 * fit them.
 *
 * Three jobs:
 *   AUTO BALANCE  work out how often each kind of opponent should meet.
 *   VALIDATE      say whether the settings can produce a schedule at all, and
 *                 when they cannot, say why in the user's own numbers.
 *   AUTO FIX      change the fewest settings that make it possible.
 */

import { restDaysOf, gamesPerWeekOf, backToBackRules } from './gameSettings.js';

/* ===========================================================================
 * LEAGUE SHAPE
 * ======================================================================== */

/**
 * Normalise a team list to `{ id, conference, division }`.
 *
 * A team's conference is not always ON the team. A saved league writes it
 * there, but the League Structure draft stores only `divisionId` and keeps the
 * division-to-conference mapping on the structure — so reading the team alone
 * made every non-division opponent look non-conference, and auto balance
 * produced a league where conference rivals never met. One resolver, used by
 * everything, so the two shapes cannot disagree again.
 *
 * @param {Array} teams
 * @param {object} [structure] `{ divisions: [{ id, conferenceId }] }`
 */
export function resolveTeams(teams, structure) {
  const divToConf = {};
  for (const d of (structure && structure.divisions) || []) {
    if (d && d.id) divToConf[d.id] = d.conferenceId || null;
  }
  return (teams || []).filter((t) => t && t.id).map((t) => {
    const division = t.division || t.divisionId || null;
    const conference = t.conference || t.conferenceId
      || (division ? divToConf[division] : null) || null;
    return { id: t.id, conference, division, city: t.city, name: t.name };
  });
}

/**
 * Read the league's actual grouping. Conferences and divisions are whatever
 * the league says they are — including none, one, or eight of them.
 */
export function leagueShape(teams, structure) {
  const list = resolveTeams(teams, structure);
  const confOf = (t) => t.conference;
  const divOf = (t) => t.division;

  const conferences = new Map();
  const divisions = new Map();
  for (const t of list) {
    const c = confOf(t), d = divOf(t);
    if (c) conferences.set(c, (conferences.get(c) || 0) + 1);
    if (d) divisions.set(d, (divisions.get(d) || 0) + 1);
  }

  // How many opponents of each kind a typical team has. Divisions can differ in
  // size, so the average is used rather than assuming they are equal.
  let div = 0, conf = 0, non = 0;
  for (const t of list) {
    const c = confOf(t), d = divOf(t);
    let dOpp = 0, cOpp = 0, nOpp = 0;
    for (const o of list) {
      if (o.id === t.id) continue;
      const oc = confOf(o), od = divOf(o);
      if (d && od && d === od) dOpp++;
      else if (c && oc && c === oc) cOpp++;
      else nOpp++;
    }
    div += dOpp; conf += cOpp; non += nOpp;
  }
  const n = list.length || 1;
  return {
    teams: list.length,
    conferences: conferences.size,
    divisions: divisions.size,
    divisionOpponents: div / n,
    conferenceOpponents: conf / n,
    nonConferenceOpponents: non / n,
  };
}

/* ===========================================================================
 * AUTO BALANCE
 * ======================================================================== */

/**
 * How many times each kind of opponent should meet, to land as close as
 * possible to the requested season length.
 *
 * Searched rather than derived from a formula, because the right answer depends
 * on three opponent counts that vary with every league shape and there is no
 * closed form that also honours "division more often than conference, more
 * often than non-conference". The space is tiny, so an exhaustive search over
 * it is both exact and instant.
 *
 * @returns {{division, conference, nonConference, gamesPerTeam, exact}}
 */
export function autoBalanceMatchups(shape, targetGames, preferUnder) {
  const d = Math.round(shape.divisionOpponents);
  const c = Math.round(shape.conferenceOpponents);
  const x = Math.round(shape.nonConferenceOpponents);
  const target = Math.max(1, targetGames);

  let best = null;
  const MAX = 12;
  for (let md = d ? 1 : 0; md <= (d ? MAX : 0); md++) {
    for (let mc = c ? 1 : 0; mc <= (c ? Math.min(MAX, md || MAX) : 0); mc++) {
      for (let mx = x ? 1 : 0; mx <= (x ? Math.min(MAX, mc || md || MAX) : 0); mx++) {
        const games = d * md + c * mc + x * mx;
        if (!games) continue;
        // Overshooting is worse than undershooting when this is filling in
        // blanks around counts the user fixed: a shortfall is distributed by
        // the generator, while an excess simply produces more games than the
        // season was set to.
        const over = games > target;
        const miss = Math.abs(games - target) * (preferUnder && over ? 3 : 1);
        // Then the clearest division > conference > non-conference ordering,
        // then fewer games.
        const spread = (md - mc) + (mc - mx);
        const score = miss * 1000 - spread * 10 + games * 0.001;
        if (!best || score < best.score) {
          best = { division: md, conference: mc, nonConference: mx, gamesPerTeam: games, score };
        }
      }
    }
  }
  if (!best) return { division: 0, conference: 0, nonConference: 0, gamesPerTeam: 0, exact: false };
  return {
    division: best.division,
    conference: best.conference,
    nonConference: best.nonConference,
    gamesPerTeam: best.gamesPerTeam,
    exact: best.gamesPerTeam === target,
  };
}

/** A specified count, or null when the field was left blank. */
function spec(v) {
  return v === '' || v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v));
}

/**
 * The meeting counts in force.
 *
 * BLANK IS NOT ZERO. A blank field means the category gets no special
 * scheduling treatment and is worked out by the generator; zero means those
 * teams genuinely never meet. Conflating the two would silently delete a
 * third of a league's fixtures the first time someone cleared a box.
 *
 * Specified categories are CONSTRAINTS and are honoured exactly. Whatever
 * season length is left over is then spread across the blank categories, in
 * the priority order division, conference, non-conference. If every category
 * is specified, any shortfall is reported as a remainder for the generator to
 * distribute rather than being forced into the counts.
 *
 * @returns {{ shape, division, conference, nonConference, gamesPerTeam, exact,
 *   assigned, remaining, sources }} `sources` says, per category, whether the
 *   number came from the user or was filled in.
 */
export function matchupsFor(teams, settings, structure) {
  const shape = leagueShape(teams, structure);
  const target = Math.max(1, settings.regularSeasonGames || 1);
  const opp = {
    division: Math.round(shape.divisionOpponents),
    conference: Math.round(shape.conferenceOpponents),
    nonConference: Math.round(shape.nonConferenceOpponents),
  };

  if (settings.autoBalanceSchedule) {
    const auto = autoBalanceMatchups(shape, target);
    const assigned = opp.division * auto.division + opp.conference * auto.conference
      + opp.nonConference * auto.nonConference;
    return {
      shape, ...auto, opponents: opp, assigned, remaining: target - assigned,
      sources: { division: 'auto', conference: 'auto', nonConference: 'auto' },
    };
  }

  const given = {
    division: spec(settings.divisionGames),
    conference: spec(settings.conferenceGames),
    nonConference: spec(settings.nonConferenceGames),
  };
  const keys = ['division', 'conference', 'nonConference'];
  const fixedGames = keys.reduce(
    (sum, k) => sum + (given[k] != null ? opp[k] * given[k] : 0), 0);

  // Blank categories share whatever the specified ones left over, balanced
  // among themselves by the same ordered search auto balance uses. Filling
  // them greedily in priority order instead gave division rivals fourteen
  // meetings each and left the rest of the league one apiece — technically the
  // right total, and not a schedule anybody would want.
  const blanks = keys.filter((k) => given[k] == null && opp[k] > 0);
  const out = { ...given };
  if (blanks.length) {
    const subShape = {
      divisionOpponents: blanks.includes('division') ? opp.division : 0,
      conferenceOpponents: blanks.includes('conference') ? opp.conference : 0,
      nonConferenceOpponents: blanks.includes('nonConference') ? opp.nonConference : 0,
    };
    const auto = autoBalanceMatchups(subShape, Math.max(1, target - fixedGames), true);
    for (const k of blanks) out[k] = auto[k];
  }
  for (const k of keys) if (out[k] == null) out[k] = 0;

  const assigned = keys.reduce((sum, k) => sum + opp[k] * out[k], 0);
  return {
    shape,
    division: out.division,
    conference: out.conference,
    nonConference: out.nonConference,
    gamesPerTeam: assigned,
    opponents: opp,
    assigned,
    // Positive: the generator has room to add games. Negative: the rules
    // demand more than the season holds, which validation refuses.
    remaining: target - assigned,
    exact: assigned === target,
    sources: Object.fromEntries(keys.map((k) => [k, given[k] != null ? 'user' : 'auto'])),
    required: fixedGames,
  };
}

/* ===========================================================================
 * THE CALENDAR
 * ======================================================================== */

const pad = (n) => String(n).padStart(2, '0');

/** `'10-20'` plus a starting year -> a UTC Date, rolling into the next year. */
export function monthDayToDate(md, year, afterMonth) {
  const [m, d] = String(md || '01-01').split('-').map(Number);
  const y = afterMonth != null && (m - 1) < afterMonth ? year + 1 : year;
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

/** The dates a season may be played on, with the All-Star break removed. */
export function seasonCalendar(settings, startYear) {
  const start = monthDayToDate(settings.seasonStart, startYear);
  const end = monthDayToDate(settings.seasonEnd, startYear, start.getUTCMonth());
  const blocked = new Set();
  if (settings.allStarBreak) {
    const b = monthDayToDate(settings.allStarBreakDate, startYear, start.getUTCMonth());
    for (let i = 0; i < (settings.allStarBreakLength || 0); i++) {
      blocked.add(new Date(b.getTime() + i * 86400000).toISOString().slice(0, 10));
    }
  }
  const dates = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    const iso = new Date(t).toISOString().slice(0, 10);
    if (!blocked.has(iso)) dates.push(iso);
  }
  return { start, end, dates, blocked: [...blocked] };
}

/* ===========================================================================
 * VALIDATION
 * ======================================================================== */

/** "an 82-game schedule", "a 72-game schedule". */
const article = (n) => {
  const t = String(n);
  return t[0] === '8' || /^(11|18)/.test(t) ? 'An' : 'A';
};

const fmt = (iso) => new Date(`${iso}T00:00:00Z`)
  .toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * Can these settings produce a schedule for this league?
 *
 * Returns problems in the user's own numbers, each with the single smallest
 * change that would resolve it. An empty list means the schedule will build.
 *
 * @returns {{ ok, problems: Array<{code, message, fix}>, notes: Array<string>, plan }}
 */
export function validateSchedule(teams, settings, startYear, structure) {
  const problems = [];
  const notes = [];
  const list = (teams || []).filter((t) => t && t.id);
  const matchups = matchupsFor(list, settings, structure);
  const cal = seasonCalendar(settings, startYear || 2025);
  const rest = restDaysOf(settings);
  const G = matchups.gamesPerTeam;

  if (list.length < 2) {
    problems.push({ code: 'teams',
      message: `A schedule needs at least two teams; this league has ${list.length}.`,
      fix: null });
    return { ok: false, problems, notes, plan: { matchups, calendar: cal, gamesPerTeam: G } };
  }

  if (!G) {
    problems.push({ code: 'matchups',
      message: 'The opponent settings produce no games at all. At least one kind of '
        + 'opponent has to be played more than zero times.',
      fix: { autoBalanceSchedule: true } });
  }

  // Manually specified frequencies are constraints, and constraints that
  // demand more games than the season holds are a contradiction rather than
  // something to quietly trim. Reported in the user's own arithmetic.
  if (!settings.autoBalanceSchedule && matchups.required > settings.regularSeasonGames) {
    const parts = [];
    for (const [k, label] of [['division', 'division'], ['conference', 'conference'],
      ['nonConference', 'non-conference']]) {
      if (matchups.sources[k] === 'user' && matchups.opponents[k]) {
        parts.push(`${matchups.opponents[k]} ${label} opponent`
          + `${matchups.opponents[k] === 1 ? '' : 's'} \u00d7 ${matchups[k]}`);
      }
    }
    problems.push({ code: 'overspecified',
      message: `Your opponent scheduling rules require at least ${matchups.required} games, `
        + `which exceeds the ${settings.regularSeasonGames}-game regular season`
        + (parts.length ? ` (${parts.join(' + ')})` : '') + '.',
      fix: { regularSeasonGames: matchups.required } });
  }

  // A team needs a gap of `rest` days between each of its games, so its season
  // occupies a minimum stretch of calendar whatever else is true.
  const needDays = G > 0 ? (G - 1) * (rest + 1) + 1 : 0;
  if (needDays > cal.dates.length) {
    problems.push({ code: 'window',
      message: `${article(G)} ${G}-game schedule cannot be generated between ${fmt(cal.dates[0])} and `
        + `${fmt(cal.dates[cal.dates.length - 1])} with ${rest === 0 ? 'no minimum rest'
          : `a minimum of ${rest} rest day${rest === 1 ? '' : 's'}`} between every game. `
        + `That needs ${needDays} days of calendar and there are ${cal.dates.length}.`,
      fix: rest > 0 ? { minRestDays: 'No Minimum' } : { regularSeasonGames: cal.dates.length } });
  }

  // Only half the league can play on any one date, so the whole fixture list
  // needs a minimum number of dates regardless of any team's own spacing.
  const totalGames = Math.round((list.length * G) / 2);
  const perDate = Math.floor(list.length / 2);
  const needDates = perDate ? Math.ceil(totalGames / perDate) : Infinity;
  if (needDates > cal.dates.length) {
    problems.push({ code: 'capacity',
      message: `${totalGames} games need at least ${needDates} playing dates, because only `
        + `${perDate} game${perDate === 1 ? '' : 's'} can be played a day in a `
        + `${list.length}-team league. The season window has ${cal.dates.length}.`,
      fix: { seasonEnd: null } });
  }

  if (settings.homeAwayBalance === 'Balanced' && G % 2 === 1) {
    notes.push(`With ${G} games an even home and away split is impossible; every team `
      + 'will be within one game of even, which is the best the arithmetic allows.');
  }
  if (!settings.autoBalanceSchedule && matchups.remaining > 0
      && matchups.required <= settings.regularSeasonGames) {
    notes.push(`These rules assign ${matchups.assigned} of `
      + `${settings.regularSeasonGames} games. The generator will distribute the remaining `
      + `${matchups.remaining} across opponents itself.`);
  }
  if (!matchups.exact && settings.autoBalanceSchedule) {
    notes.push(`This league's shape cannot produce exactly ${settings.regularSeasonGames} games. `
      + `The closest balanced schedule is ${G} per team `
      + `(${matchups.division} against each division rival, ${matchups.conference} in `
      + `conference, ${matchups.nonConference} outside it).`);
  }
  // A back-to-back target implies a minimum season length of its own: every
  // game that is NOT a back-to-back needs a clear day either side. When the
  // window is tighter than that, the generator physically cannot hit the
  // target, and saying so beforehand is better than the user finding out from
  // the summary. A target of zero gets its own wording, because "avoid
  // consecutive days entirely" is the case most likely to be impossible and the
  // one the user most needs warned about rather than quietly overridden.
  const b2b = backToBackRules(settings, G);
  if (G > 1) {
    const minSpan = (G - 1 - b2b.max) * 2 + b2b.max + 1;
    if (minSpan > cal.dates.length) {
      notes.push(b2b.max === 0
        ? `${G} games with no back-to-backs at all needs about ${minSpan} days and the `
          + `window has ${cal.dates.length}. The generator cannot avoid consecutive-day `
          + 'games in a window this tight, so some teams will finish above zero. A longer '
          + 'season, fewer games, or a target above zero would make it achievable.'
        : `${G} games with an average of ${b2b.target} back-to-back${
            b2b.target === 1 ? '' : 's'} per team needs about ${minSpan} days and the `
          + `window has ${cal.dates.length}, so teams will finish above the target. A `
          + 'longer season window or a higher target would remove the squeeze.');
    }
  }
  // Scaling is silent unless it actually moved the number, in which case the
  // user typed one thing and the generator will work to another.
  if (b2b.scaled && b2b.target !== b2b.typed) {
    notes.push(`Scale With Season Length turns the typed target of ${b2b.typed} into `
      + `${b2b.target} for a ${G}-game season. Turn the toggle off to hold ${b2b.typed}.`);
  }
  if (rest >= 1 && Number(settings.b2bTarget) > 0) {
    notes.push('A minimum rest of a day or more rules back-to-backs out entirely, '
      + 'so the back-to-back target has nothing to do.');
  }
  if (b2b.allowThreeInThree && b2b.target === 0) {
    notes.push('Allowing three games in three days has no effect while the back-to-back '
      + 'target is zero, since a third consecutive night needs a second one first.');
  }
  // A short season in a long window cannot avoid long idle stretches, whatever
  // the maximum says — there is simply more calendar than there are games.
  const maxIdle = settings.maxDaysWithoutGame || 7;
  if (G > 0 && cal.dates.length / G > maxIdle) {
    notes.push(`${G} games spread across ${cal.dates.length} days averages a game every `
      + `${(cal.dates.length / G).toFixed(1)} days, so gaps will exceed the `
      + `${maxIdle}-day maximum. A shorter season window or more games would close them.`);
  }

  const weekly = gamesPerWeekOf(settings);
  const impliedWeeks = cal.dates.length / 7;
  if (G > 0 && impliedWeeks > 0 && G / impliedWeeks > weekly + 1.5) {
    notes.push(`Fitting ${G} games into ${Math.round(impliedWeeks)} weeks means about `
      + `${(G / impliedWeeks).toFixed(1)} a week, above the ${weekly} target. The target `
      + 'gives way to the game count.');
  }

  return {
    ok: problems.length === 0,
    problems,
    notes,
    plan: { matchups, calendar: cal, gamesPerTeam: G, totalGames, rest, needDays, needDates },
  };
}

/* ===========================================================================
 * AUTO FIX
 * ======================================================================== */

/**
 * The fewest changes that make the configuration valid.
 *
 * Ordered by how little each one costs the user's intent: stretch the calendar
 * first, because a later end date changes nothing about the season they asked
 * for; then relax rest, which is a preference; and only last cut games, which
 * is the thing they most likely care about.
 *
 * @returns {{ settings, changes: Array<string> }}
 */
export function autoFixSchedule(teams, settings, startYear, structure) {
  let next = { ...settings };
  const changes = [];
  const year = startYear || 2025;

  for (let attempt = 0; attempt < 6; attempt++) {
    const v = validateSchedule(teams, next, year, structure);
    if (v.ok) break;

    const need = Math.max(v.plan.needDays || 0, v.plan.needDates || 0);
    const have = v.plan.calendar.dates.length;

    if (need > have) {
      // Push the end date out, up to a season that ends in late June.
      const end = monthDayToDate(next.seasonEnd, year,
        monthDayToDate(next.seasonStart, year).getUTCMonth());
      const extended = new Date(end.getTime() + (need - have + 4) * 86400000);
      const limit = monthDayToDate('06-30', year,
        monthDayToDate(next.seasonStart, year).getUTCMonth());
      if (extended <= limit) {
        const md = `${pad(extended.getUTCMonth() + 1)}-${pad(extended.getUTCDate())}`;
        changes.push(`Season End moved to ${fmt(extended.toISOString().slice(0, 10))} `
          + `to make room for ${v.plan.gamesPerTeam} games.`);
        next.seasonEnd = md;
        continue;
      }
      if (restDaysOf(next) > 0) {
        changes.push('Minimum Rest Between Games reduced to No Minimum; the season window '
          + 'is not long enough to guarantee rest between every game.');
        next.minRestDays = 'No Minimum';
        continue;
      }
      // Last resort: cut the season to what the calendar can actually hold.
      const fits = Math.max(4, have);
      changes.push(`Regular Season Games reduced to ${fits}, the most this calendar holds.`);
      next.regularSeasonGames = fits;
      next.autoBalanceSchedule = true;
      continue;
    }

    // Over-specified rules are reduced in REVERSE priority — non-conference
    // first, then conference, then division — because that is the order the
    // user cared least about, and the league structure is never touched.
    if (v.problems.some((p) => p.code === 'overspecified')) {
      const m = v.plan.matchups;
      let reduced = false;
      for (const k of ['nonConference', 'conference', 'division']) {
        const key = { nonConference: 'nonConferenceGames', conference: 'conferenceGames',
          division: 'divisionGames' }[k];
        if (m.sources[k] !== 'user' || !m.opponents[k] || !next[key]) continue;
        const over = m.required - next.regularSeasonGames;
        // Never reduced below one: dropping a category to zero would change
        // what the user asked for from "fewer games" into "these teams never
        // meet", which is a different instruction entirely.
        const cut = Math.min(next[key] - 1, Math.ceil(over / m.opponents[k]));
        if (cut <= 0) continue;
        const label = { nonConference: 'Non-Conference', conference: 'Conference',
          division: 'Division' }[k];
        changes.push(`Games vs. Each ${label} Opponent reduced from ${next[key]} to `
          + `${next[key] - cut}; the rules asked for ${m.required} games in a `
          + `${next.regularSeasonGames}-game season.`);
        next[key] = next[key] - cut;
        reduced = true;
        break;
      }
      if (reduced) continue;
    }

    if (v.problems.some((p) => p.code === 'matchups')) {
      changes.push('Auto Balance Schedule switched on; the manual opponent counts produced '
        + 'no games.');
      next.autoBalanceSchedule = true;
      continue;
    }
    break;
  }
  return { settings: next, changes };
}

/* ===========================================================================
 * SUMMARY
 * ======================================================================== */

/**
 * The live consequence of the current opponent rules, line by line.
 *
 * Recomputed from the league in front of it, so it follows teams, conferences,
 * divisions and the season length as they change.
 *
 * @returns {{ structure: Array, lines: Array, assigned, target, remaining, over }}
 */
export function matchupBreakdown(teams, settings, structure) {
  const resolved = resolveTeams(teams, structure);
  const shape = leagueShape(teams, structure);
  const m = matchupsFor(teams, settings, structure);
  const divisions = new Set(resolved.map((t) => t.division).filter(Boolean));
  const conferences = new Set(resolved.map((t) => t.conference).filter(Boolean));
  const perDivision = divisions.size ? resolved.length / divisions.size : 0;

  const structureLines = [
    `${resolved.length} Teams`,
    `${conferences.size || 1} Conference${(conferences.size || 1) === 1 ? '' : 's'}`,
  ];
  if (divisions.size) {
    const perConf = conferences.size ? divisions.size / conferences.size : divisions.size;
    structureLines.push(`${perConf % 1 ? perConf.toFixed(1) : perConf} Division`
      + `${perConf === 1 ? '' : 's'} per Conference`);
    structureLines.push(`${perDivision % 1 ? perDivision.toFixed(1) : perDivision} `
      + `Teams per Division`);
  }

  const lines = [];
  for (const [k, label] of [['division', 'Division Opponents'],
    ['conference', 'Non-Division Conference Opponents'],
    ['nonConference', 'Non-Conference Opponents']]) {
    const o = m.opponents[k];
    if (!o) continue;
    lines.push({
      label, opponents: o, games: m[k], total: o * m[k], source: m.sources[k],
      text: `${o} \u00d7 ${m[k]} game${m[k] === 1 ? '' : 's'} = ${o * m[k]} games`,
    });
  }
  const over = m.required > settings.regularSeasonGames;
  return {
    structure: structureLines,
    lines,
    // Over-specified rules are argued about in terms of what they REQUIRE, so
    // the panel shows that number rather than a total that silently includes
    // an auto-filled category the error message never mentions.
    assigned: over ? m.required : m.assigned,
    target: settings.regularSeasonGames,
    remaining: m.remaining,
    over,
  };
}

/** The live one-line summary shown under the schedule settings. */
export function scheduleSummary(teams, settings, startYear, structure) {
  const v = validateSchedule(teams, settings, startYear, structure);
  const cal = v.plan.calendar;
  const bits = [
    `${v.plan.gamesPerTeam} Games`,
    cal.dates.length ? `${fmt(cal.dates[0])} – ${fmt(cal.dates[cal.dates.length - 1])}` : 'No window',
    `${settings.homeAwayBalance} Home/Away`,
    restDaysOf(settings) > 0
      ? `${restDaysOf(settings)}-Day Minimum Rest`
      : `~${backToBackRules(settings, v.plan.gamesPerTeam).target} Back-to-Backs`,
    settings.allStarBreak
      ? `All-Star Break ${settings.allStarBreakLength} Days`
      : 'No All-Star Break',
  ];
  return { text: bits.join(' • '), valid: v.ok, problems: v.problems, notes: v.notes, plan: v.plan };
}
