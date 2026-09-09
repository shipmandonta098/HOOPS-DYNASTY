'use strict';

/**
 * seasonPipeline.js — the seven parts, run in order, as one call.
 *
 * WHAT THIS IS. An orchestrator, not a new model. Every part already exists in
 * this project and each keeps its own rules; this runs them in the order they
 * depend on each other and assembles one report. Nothing is reimplemented
 * here, because two copies of the fatigue formula would drift apart the first
 * time one of them was corrected.
 *
 * THE ORDER MATTERS AND IT IS NOT THE BRIEF'S ORDER. Detection has to precede
 * fixing; fixing decides which nights become rest days, so recovery cannot be
 * computed before it; and coach influence lands on tendencies before season
 * evolution reads them, because a player evolves out of the way he has been
 * asked to play. Running the brief's numbered order literally would compute
 * recovery for rest days that did not exist yet.
 *
 * WHAT NOTHING HERE TOUCHES. No attribute, rating, potential or Overall is
 * altered by anything in this file or anything it calls. Coaches, fatigue,
 * mental, personality and tendencies all sit outside that wall by design, and
 * the pipeline does not become a hole in it just because it touches all of
 * them at once.
 */

import { detectBackToBacks, playerFatigue } from './scheduleFatigue.js';
import { rebalanceSchedule, findOverloads, teamProfiles } from './scheduleRebalance.js';
import { restPlayer, currentDebt } from './fatigueRecovery.js';
import {
  TENDENCY_GROUPS, computeTendencies, applyBias, evolveTendencies, evolutionSummary,
  teamSystem, DRIFT_FADE, DRIFT_CAP,
} from './playerTendencies.js';
import {
  coachOf, coachFatigueFactors, coachRecoveryFactor, philosophyShift, developmentFactor,
} from './coaching.js';

const clamp01 = (n) => Math.max(-1, Math.min(0, n));
const round4 = (n) => Math.round(n * 10000) / 10000;
const round2 = (n) => Math.round(n * 100) / 100;
const clampT = (n) => Math.max(0, Math.min(100, Math.round(n)));

/** The grouped tendency object as one flat map, for reporting. */
function flatten(grouped) {
  const out = {};
  for (const g of TENDENCY_GROUPS) {
    for (const [k] of g.parts) out[k] = (grouped[g.key] || {})[k];
  }
  return out;
}

/** Flat deltas applied to a grouped object, returning a new grouped object. */
function applyDeltas(grouped, deltas) {
  const out = {};
  for (const g of TENDENCY_GROUPS) {
    out[g.key] = { ...(grouped[g.key] || {}) };
    for (const [k] of g.parts) {
      if (deltas[k] == null || out[g.key][k] == null) continue;
      out[g.key][k] = clampT(out[g.key][k] + deltas[k]);
    }
  }
  return out;
}

/** Team key from either shape this project reads. */
const teamKey = (p) => (p && (p.teamId || p.team)) || null;

/**
 * Run the whole thing.
 *
 * @param {object} input `{ schedule, players, coaches, leagueRules, seasonContext }`
 * @returns {object} the brief's output shape.
 */
export function runSeasonPipeline(input, opts = {}) {
  const inp = input || {};
  const rules = inp.leagueRules || {};
  const players = inp.players || [];
  const ctx = inp.seasonContext || {};
  const league = { coaches: inp.coaches || [] };

  /* ---- Part 1: detection ------------------------------------------- */
  const detected = detectBackToBacks(inp.schedule);
  const overloads = findOverloads(inp.schedule, { maxConsecutiveGames: 2 });

  /* ---- Part 2: fixing ---------------------------------------------- */
  const fixed = rebalanceSchedule(inp.schedule, {
    maxBackToBacksPerTeam: rules.maxBackToBacksPerTeam,
    minRestDaysBetweenGames: rules.minRestDaysBetweenGames,
    maxConsecutiveGames: 2,
    ...opts.rules,
  });
  const after = detectBackToBacks(fixed.games);

  // Rest days are the nights a club was carrying a fixture and no longer is.
  // The calendar is fixed, so nothing is inserted; this is the same event.
  const datesOf = (games, team) => new Set(games
    .filter((g) => g.home === team || g.away === team).map((g) => String(g.date).slice(0, 10)));
  const beforeGames = detected.games;
  const afterGames = after.games;
  const teams = [...detected.byTeam.keys()].sort();
  const freed = new Map(teams.map((t) => {
    const b = datesOf(beforeGames, t), a = datesOf(afterGames, t);
    return [t, [...b].filter((d) => !a.has(d)).sort()];
  }));

  const byTeam = new Map();
  for (const p of players) {
    const k = teamKey(p);
    if (!k) continue;
    if (!byTeam.has(k)) byTeam.set(k, []);
    byTeam.get(k).push(p);
  }
  const profiles = teamProfiles(fixed.games, fixed.rules);

  /* ---- Parts 3 & 4: fatigue, with the coach in both ----------------- */
  const fatigueUpdates = [];
  for (const team of teams) {
    const coach = coachOf(league, team);
    const cf = coachFatigueFactors(coach);
    const cr = coachRecoveryFactor(coach);
    const nights = (freed.get(team) || []).length;
    const b2b = (profiles.get(team) || {}).backToBacks || 0;

    for (const p of byTeam.get(team) || []) {
      // Part 3: what a second night costs this player under this coach.
      const base = playerFatigue(p, opts);
      const penalty = {
        physical: round4(clamp01(base.raw.physical * cf.physical)),
        mental: round4(clamp01(base.raw.mental * cf.mental)),
      };
      // Charge the season's back-to-backs, then credit the rest days it freed.
      if (!p.fatigueDebt) {
        p.fatigueDebt = {
          physical: clamp01(penalty.physical * b2b),
          mental: clamp01(penalty.mental * b2b),
        };
      }
      const before = currentDebt(p);
      const rest = restPlayer(p, nights, opts);
      // Part 4: the coach's motivational style scales what a night gives back.
      const gained = {
        physical: round4(rest.gained.physical * cr.factor),
        mental: round4(rest.gained.mental * cr.factor),
      };
      const finalDebt = {
        physical: round4(clamp01(before.physical + gained.physical)),
        mental: round4(clamp01(before.mental + gained.mental)),
      };
      p.fatigueDebt = finalDebt;

      fatigueUpdates.push({
        player: p.name, team,
        backToBacks: b2b,
        penaltyPerBackToBack: penalty,
        restDays: nights,
        recovered: gained,
        fatigue: finalDebt,
        coachEffects: [...cf.applied, ...cr.applied],
      });
    }
  }

  /* ---- Parts 5 & 6: coach, then mental and personality -------------- */
  //
  // computeTendencies and applyBias both speak the GROUPED shape —
  // { offense: { shootThree }, ... } — so the coach's deltas are applied to
  // that shape and the flat form is only produced for reporting. Flattening in
  // between and handing applyBias a flat object throws, and handing gameSim a
  // grouped one silently produced NaN weights; the shape has now caught two
  // callers, so it is worth stating plainly which one each function wants.
  const updatedTendencies = [];
  for (const p of players) {
    const team = teamKey(p);
    const coach = coachOf(league, team);
    const grouped = computeTendencies({ attributes: p.attributes, position: p.position });
    const baseline = flatten(grouped);

    // Part 5 first: the system a player is asked to play in.
    const sys = philosophyShift(coach, p, opts);
    const afterCoach = applyDeltas(grouped, sys.deltas);

    // Part 6 second: who the player is, layered on how he is being asked to
    // play — the order matters, because a player resists a system through his
    // own temperament rather than the other way round.
    const biased = applyBias(afterCoach, p, opts);
    const finalGrouped = (biased && biased.tendencies) || afterCoach;
    const final = flatten(finalGrouped);

    const changes = {};
    for (const k of Object.keys(baseline)) {
      const d = (final[k] || 0) - baseline[k];
      if (d) changes[k] = Math.round(d * 10) / 10;
    }
    updatedTendencies.push({
      player: p.name, team,
      philosophy: sys.philosophy, uptake: sys.uptake,
      tendencies: final,
      changes,
      biasSummary: (biased && biased.biasSummary) || null,
    });
  }

  /* ---- Part 7: season-to-season evolution --------------------------- */
  //
  // evolveTendencies returns a DRIFT MAP — the player's running `tendencyDrift`
  // after this offseason, carried history included — not a set of tendencies,
  // and it takes no rate option. So the coach's development factor is applied
  // here. It scales THIS OFFSEASON'S delta only, never the carried total: a
  // growth coach speeds up the change a player is making now, he does not
  // retroactively rewrite what four previous seasons did to him. The carried
  // part is reconstructed the same way evolveTendencies builds it, from the
  // player's prior drift and the exported fade.
  //
  // WHICH SYSTEM A PLAYER EVOLVES TOWARD. A caller may state it. Otherwise it
  // is the COACH'S PHILOSOPHY, and only failing that the label derived from
  // what the roster already does.
  //
  // That order is the opposite of what it looks like it should be, and it was
  // chosen after measuring: teamSystem() classifies on absolute roster means,
  // and a fifteen-man roster averages its guards against its centres, so all
  // thirty teams in a freshly generated league come back 'Balanced' — whose
  // shift is empty. Deriving alone would have left this channel silently dead.
  //
  // It is not double-counting the coach. Part 5 is the SHORT run: flat points
  // on the tendencies a player brings to a game, gone when the coach is. This
  // is the LONG run: after four seasons in a pace-and-space team he genuinely
  // shoots more threes, which is a permanent change to his habits. The brief
  // asks for both, and the project's own rule already splits them — flat
  // points in-game, percentage drift season to season.
  const PHILOSOPHY_SYSTEM = {
    'Pace-and-Space': 'Pace and Space',
    'Grit-and-Grind': 'Grit and Grind',
    Motion: 'Motion',
    Isolation: 'Isolation',
    'Defensive Anchor': 'Defensive Anchor',
  };
  const systems = new Map();
  const systemOf = (team) => {
    if (!systems.has(team)) {
      const stated = ctx.teamSystems && ctx.teamSystems[team];
      const phil = (coachOf(league, team) || {}).coachTraits;
      const label = phil && PHILOSOPHY_SYSTEM[phil.philosophy];
      systems.set(team, stated
        || (label ? { label, from: 'coach' } : null)
        || teamSystem(byTeam.get(team) || [])
        || null);
    }
    return systems.get(team);
  };

  const seasonEvolution = [];
  for (const p of players) {
    const team = teamKey(p);
    const coach = coachOf(league, team);
    const dev = developmentFactor(coach, p);
    const evolved = evolveTendencies(p, {
      system: systemOf(team),
      role: (ctx.roles && ctx.roles[p.id]) || null,
      ...((opts.evolve) || {}),
    });

    const prior = p.tendencyDrift || {};
    const total = (evolved && evolved.drift) || {};
    const drift = {};       // the new running total, coach-scaled
    const seasonDelta = {}; // what this offseason alone moved
    for (const [k, v] of Object.entries(total)) {
      const carried = (Number(prior[k]) || 0) * (1 - DRIFT_FADE);
      const delta = v - carried;
      const scaled = Math.max(-DRIFT_CAP, Math.min(DRIFT_CAP,
        carried + delta * dev.factor));
      drift[k] = Math.round(scaled * 100) / 100;
      const moved = Math.round(delta * dev.factor * 100) / 100;
      if (moved) seasonDelta[k] = moved;
    }

    // Before and after as the player's actual habits, not as raw drift, so the
    // summary reads in the units the rest of the game shows.
    const before = computeTendencies(p);
    const after = computeTendencies(p, { drift });

    seasonEvolution.push({
      player: p.name, team, age: p.age,
      system: (systemOf(team) || {}).label || null,
      developmentStyle: (coach && coach.coachTraits && coach.coachTraits.developmentStyle) || null,
      evolutionFactor: dev.factor,
      coachEffects: dev.applied,
      drift,
      seasonDelta,
      before: flatten(before),
      after: flatten(after),
      changes: (evolved && evolved.changes) || [],
      skipped: (evolved && evolved.skipped) || [],
      summary: evolutionSummary(before, after, evolved),
    });
  }

  /* ---- the report --------------------------------------------------- */
  const restDaysAdded = [...freed.values()].reduce((n, d) => n + d.length, 0);
  const avg = (list, f) => (list.length
    ? round4(list.reduce((s, x) => s + f(x), 0) / list.length) : 0);
  const changeCount = (r) => Object.keys(r.changes || {}).length;

  const restRows = [];
  for (const [team, dates] of freed) {
    for (const d of dates) restRows.push({ date: d, restDay: true, team });
  }

  return {
    adjustedSchedule: [
      ...afterGames.map((g) => ({ date: g.date, homeTeam: g.home, awayTeam: g.away })),
      ...restRows,
    ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),

    gameFlags: afterGames.map((g) => ({
      gameId: g.gameId, backToBack: after.flags.get(g.gameId),
    })),

    fatigueUpdates,
    updatedTendencies,
    seasonEvolution,

    summary: {
      // Back-to-backs REMOVED by the fix, which is what "fixed" means. The
      // count before minus the count after, not the number that existed.
      backToBacksFixed: Math.max(0,
        fixed.before.totalBackToBacks - fixed.after.totalBackToBacks),
      overloadSegments: overloads.length,
      overloadSegmentsRemaining: findOverloads(fixed.games, { maxConsecutiveGames: 2 }).length,
      restDaysAdded,
      fatigueRecovered: avg(fatigueUpdates, (r) => r.recovered.physical + r.recovered.mental),
      tendencyChanges: round2(avg(updatedTendencies, changeCount)),
      coachInfluenceApplied: updatedTendencies.some((r) => r.philosophy != null),
      // Stated rather than assumed: a report that claims compliance it did not
      // achieve is worse than one that says what is left.
      compliance: fixed.integrity.ok && !fixed.after.teamsOverB2BCap
        && !fixed.after.teamsOverRunLimit
        ? 'Within league rules'
        : `${fixed.after.teamsOverRunLimit} team(s) over the run limit, `
          + `${fixed.after.teamsOverB2BCap} over the back-to-back cap`,
    },
  };
}
