'use strict';

/**
 * scheduleFatigue.js — back-to-backs, how often they happen, and what they cost.
 *
 * WHAT THIS IS. Three things, in order: read a fixture list and mark which
 * games a team arrives at having played the night before; count how often that
 * happens to each club; and turn each player's conditioning and temperament
 * into the penalty they carry into such a game.
 *
 * All three are DERIVED. Nothing here invents a fixture, a result or a rating —
 * it reads the schedule the save already holds and the attributes the players
 * already have. A fatigue modifier is a projection about a game not yet played,
 * in the same class as a point spread, and like a spread it is a model's
 * opinion rather than a fact about the season.
 *
 * WHAT A PENALTY MEANS. The numbers are FRACTIONS, not rating points: -0.07 is
 * "seven per cent off", and the specified floor of -1 is the giveaway — minus
 * one point of anything would be nothing, minus one hundred per cent is a
 * player who cannot go. So a consumer multiplies by these, it does not add
 * them.
 *
 * THIS DOES NOT TOUCH OVERALL. Fatigue is a game-time modifier on how a player
 * performs on one night. It is never folded back into attributes, potential or
 * Overall, and mental traits reaching it here is not mental leaking into
 * Overall — the rating a player carries into a fresh game is unchanged.
 */

import { ovr } from './playerRatings.js';

/* ------------------------------------------------------------------- rules */

/** The cost of a second night, before anything about the player is read. */
export const BASE_PENALTY = { physical: -0.07, mental: -0.05 };

/** Penalties are clamped into this range, per the contract. */
export const PENALTY_RANGE = { min: -1, max: 0 };

/**
 * How a player's attributes move the penalty.
 *
 * `channel` is the deliberate reading of an ambiguous contract. The rules are
 * written as four bullets, two of which name a channel ("reduce MENTAL penalty
 * by 25%", "increase MENTAL penalty by 10%") and two of which do not. The
 * formula line then multiplies both channels by the same "attributeModifiers",
 * which cannot be right — it would have resilience, explicitly a mental trait,
 * cutting a player's legs as well as his head.
 *
 * So each trait acts on its own channel: conditioning (stamina, endurance) on
 * the physical penalty, temperament (resilience, concentration) on the mental
 * one. Pass `{ physicalTraitsAffectMental: true }` for the literal reading, in
 * which stamina and endurance discount both.
 *
 * The thresholds are strict and are taken literally, cliffs and all: stamina 86
 * earns the full twenty per cent and stamina 85 earns nothing. That is a real
 * edge — see the note on `playerFatigue`.
 */
export const TRAIT_RULES = [
  { trait: 'stamina', source: 'attributes', test: (v) => v > 85, factor: 0.80,
    channel: 'physical', label: 'High stamina' },
  { trait: 'endurance', source: 'attributes', test: (v) => v > 85, factor: 0.85,
    channel: 'physical', label: 'High endurance' },
  { trait: 'resilience', source: 'mental', test: (v) => v > 80, factor: 0.75,
    channel: 'mental', label: 'High resilience' },
  { trait: 'concentration', source: 'mental', test: (v) => v < 70, factor: 1.10,
    channel: 'mental', label: 'Low concentration' },
];

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;
const clamp = (n) => Math.min(PENALTY_RANGE.max, Math.max(PENALTY_RANGE.min, n));

/* -------------------------------------------------------------------- input */

/**
 * One fixture list, from either shape this project has to read.
 *
 * The save stores `{ id, date, home, away }` with team ids; the external
 * contract sends `{ gameId, date, homeTeam, awayTeam }` with team names. Both
 * are accepted and both come out the same, so a caller never has to reshape a
 * schedule to ask a question about it.
 */
export function normaliseGames(schedule) {
  const list = Array.isArray(schedule) ? schedule
    : (schedule && Array.isArray(schedule.games)) ? schedule.games : [];
  return list
    .filter((g) => g && g.date && (g.home || g.homeTeam) && (g.away || g.awayTeam))
    .map((g) => ({
      gameId: g.gameId != null ? g.gameId : g.id,
      date: String(g.date).slice(0, 10),
      home: g.home || g.homeTeam,
      away: g.away || g.awayTeam,
    }));
}

/** Likewise for players: the save splits these four traits across two layers. */
function traitValue(player, rule) {
  if (!player) return null;
  // The save keeps conditioning in `attributes` and temperament in `mental`;
  // the external contract puts all four under `attributes`. Read the player's
  // own layer first, then fall back, then give up — a trait that genuinely is
  // not there earns no modifier rather than a guessed one.
  const layers = [player[rule.source], player.attributes, player.mental, player];
  for (const layer of layers) {
    if (layer && typeof layer[rule.trait] === 'number') return layer[rule.trait];
  }
  return null;
}

const teamKeyOf = (p) => p && (p.teamId || p.team || null);

/* ------------------------------------------------------- back-to-backs */

/** Calendar days between two ISO dates. Dates only — no clocks, no zones. */
function dayNumber(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/**
 * Which games each team arrives at on no rest.
 *
 * A back-to-back FLAGS THE SECOND NIGHT, not both halves. That is what the
 * contract's own example says — three straight days at home come back as
 * false, true, true — and it is the only reading that makes the count usable:
 * fatigue is carried into the second game, so flagging the first would charge
 * a team for a game it turned up fresh to. It also means a team playing three
 * days running is flagged twice, which is correct; the third night is a second
 * night as much as the second was.
 *
 * @returns {{ flags: Map, byTeam: Map }} flags is keyed by gameId; byTeam holds
 *   `{ total, backToBack, dates }` per team.
 */
export function detectBackToBacks(schedule) {
  const games = normaliseGames(schedule);
  const byTeam = new Map();

  for (const g of games) {
    for (const id of [g.home, g.away]) {
      if (!byTeam.has(id)) byTeam.set(id, { total: 0, backToBack: 0, dates: [], b2bDates: [] });
      const t = byTeam.get(id);
      t.total++;
      t.dates.push(g.date);
    }
  }
  // A team can only be on a back-to-back relative to its own previous game, so
  // each team's dates are sorted once and read as a sequence.
  const b2bDates = new Map();
  for (const [id, t] of byTeam) {
    t.dates.sort();
    const set = new Set();
    for (let i = 1; i < t.dates.length; i++) {
      // Duplicate dates are a broken schedule, not a back-to-back: a team
      // cannot play twice in a night, and calling that no rest would hide the
      // real problem behind a fatigue number.
      if (dayNumber(t.dates[i]) - dayNumber(t.dates[i - 1]) === 1) set.add(t.dates[i]);
    }
    t.backToBack = set.size;
    t.b2bDates = [...set].sort();
    b2bDates.set(id, set);
  }

  const flags = new Map();
  for (const g of games) {
    flags.set(g.gameId, {
      home: b2bDates.get(g.home).has(g.date),
      away: b2bDates.get(g.away).has(g.date),
    });
  }
  return { flags, byTeam, games };
}

/* ---------------------------------------------------------------- fatigue */

/**
 * One player's fatigue penalty for a second night.
 *
 * Modifiers COMPOUND rather than add: a player over both conditioning
 * thresholds carries 0.80 x 0.85 = 0.68 of the base penalty, not 0.65. The
 * contract's formula multiplies, so this does.
 *
 * TWO THINGS WORTH KNOWING, both properties of the contract rather than bugs:
 *
 * 1. The thresholds are cliffs. Stamina 86 is a fifth cheaper than stamina 85,
 *    which is a large step for one rating point and will show up as clustering
 *    if rosters bunch near the line. `raw` is returned unrounded so a caller
 *    that wants a ramp can build one without re-deriving any of this.
 *
 * 2. Two decimal places throws most of this away. The physical penalty can only
 *    ever land on -0.05, -0.06 or -0.07 once rounded, so a carefully computed
 *    -0.0476 and -0.0510 become the same number. The rounded values are what
 *    the contract asks for and what `analyseFatigue` returns; `raw` carries the
 *    full precision, and a simulator should read that.
 */
export function playerFatigue(player, opts = {}) {
  const bleed = opts.physicalTraitsAffectMental === true;
  let physical = 1, mental = 1;
  const applied = [];
  const missing = [];

  for (const rule of TRAIT_RULES) {
    const v = traitValue(player, rule);
    if (v == null) { missing.push(rule.trait); continue; }
    if (!rule.test(v)) continue;
    if (rule.channel === 'physical') {
      physical *= rule.factor;
      if (bleed) mental *= rule.factor;
    } else {
      mental *= rule.factor;
    }
    applied.push({ trait: rule.trait, value: v, factor: rule.factor, label: rule.label });
  }

  const rawPhysical = clamp(BASE_PENALTY.physical * physical);
  const rawMental = clamp(BASE_PENALTY.mental * mental);
  return {
    name: player && player.name,
    physical: round2(rawPhysical),
    mental: round2(rawMental),
    raw: { physical: rawPhysical, mental: rawMental },
    factors: { physical, mental },
    applied,
    missing,
  };
}

/**
 * A team's fatigue penalty: its players' penalties, weighted by who plays.
 *
 * The contract asks for one number per team and gives attributes per player,
 * so the two have to be joined somehow and it does not say how. A flat mean
 * over the whole roster is the obvious answer and the wrong one — it lets a
 * fifteenth man who never leaves the bench pull the number a team actually
 * plays with. So the default weights players the way `powerRanking.js` does,
 * by rotation order, and the fifteenth man barely counts.
 *
 * Pass `{ weight: 'flat' }` for a plain mean. A roster whose players cannot be
 * ranked — the external contract sends four attributes and no Overall — falls
 * back to flat on its own, because ordering players by a rating that is not
 * there would be ordering them by nothing.
 */
export const FATIGUE_ROTATION = [1.00, 0.96, 0.92, 0.88, 0.82, 0.70, 0.60, 0.50, 0.38, 0.26, 0.14, 0.07];

export function teamFatigue(players, opts = {}) {
  const list = (players || []).filter(Boolean);
  if (!list.length) return null;

  const each = list.map((p) => ({ player: p, ...playerFatigue(p, opts) }));

  let weights = each.map(() => 1);
  const wantRotation = (opts.weight || 'rotation') === 'rotation';
  if (wantRotation) {
    const rated = each.map((e, i) => ({ i, o: ovr(e.player) }))
      .filter((r) => Number.isFinite(r.o) && r.o > 0);
    // Ranking needs something to rank by. One rating, or none, is not an order.
    const distinct = new Set(rated.map((r) => r.o)).size;
    if (rated.length === each.length && distinct > 1) {
      rated.sort((a, b) => b.o - a.o);
      weights = each.map(() => 0);
      rated.forEach((r, slot) => {
        weights[r.i] = FATIGUE_ROTATION[slot] != null ? FATIGUE_ROTATION[slot] : 0;
      });
    }
  }

  let wp = 0, wm = 0, wt = 0;
  each.forEach((e, i) => {
    const w = weights[i];
    if (w <= 0) return;
    wp += e.raw.physical * w;
    wm += e.raw.mental * w;
    wt += w;
  });
  if (!wt) return null;

  const rawPhysical = clamp(wp / wt);
  const rawMental = clamp(wm / wt);
  return {
    physical: round2(rawPhysical),
    mental: round2(rawMental),
    raw: { physical: rawPhysical, mental: rawMental },
    weighting: wantRotation && weights.some((w) => w !== 1) ? 'rotation' : 'flat',
    players: each,
  };
}

/* ----------------------------------------------------------------- report */

/**
 * The whole analysis, in the shape the contract specifies.
 *
 * @param {object} input  `{ schedule, players }`, or a league save — a save's
 *   `schedule.games` and `players` are read directly, so this can be handed a
 *   league without reshaping it.
 * @returns {{ backToBackSummary, gameFlags }}
 */
export function analyseFatigue(input, opts = {}) {
  const schedule = input.schedule || input;
  const players = input.players || [];
  const { flags, byTeam, games } = detectBackToBacks(schedule);

  const byTeamPlayers = new Map();
  for (const p of players) {
    const key = teamKeyOf(p);
    if (!key) continue;
    if (!byTeamPlayers.has(key)) byTeamPlayers.set(key, []);
    byTeamPlayers.get(key).push(p);
  }

  // Every team on the schedule appears, in a stable order, whether or not it
  // ever plays a second night — a club with no back-to-backs is a real answer
  // to "how often", and dropping it would look like missing data.
  const summary = [...byTeam.keys()].sort().map((team) => {
    const t = byTeam.get(team);
    const roster = byTeamPlayers.get(team) || [];
    const fatigue = t.backToBack > 0 ? teamFatigue(roster, opts) : null;
    return {
      team,
      totalGames: t.total,
      backToBackGames: t.backToBack,
      frequency: t.total ? round1((t.backToBack / t.total) * 100) : 0,
      // A modifier is what a team carries INTO a second night. A club that
      // never plays one carries nothing, and printing a penalty it can never
      // pay would be inventing a cost.
      fatigueModifiers: fatigue ? { physical: fatigue.physical, mental: fatigue.mental } : null,
    };
  });

  return {
    backToBackSummary: summary,
    gameFlags: games.map((g) => ({ gameId: g.gameId, backToBack: flags.get(g.gameId) })),
  };
}

/** The same analysis as a JSON string, for a caller that wants the document. */
export function fatigueJSON(input, opts = {}) {
  return JSON.stringify(analyseFatigue(input, opts), null, 2);
}
