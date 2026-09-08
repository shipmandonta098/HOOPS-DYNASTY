'use strict';

/**
 * fatigueRecovery.js — what a night off gives back.
 *
 * A NAME COLLISION, RESOLVED. The brief calls its two-channel debt
 * `player.fatigue`, but this save already has a `fatigue` field: a 0-99
 * integer where LOW IS FRESH, set at generation, in the schema, and shown on
 * the player card as Fresh / Winded / Tired / Exhausted. The brief's quantity
 * is a different thing on a different scale — a signed fraction from -1 to 0
 * where ZERO is fresh — and writing it into the same key would silently break
 * that card, since it tests `typeof p.fatigue === 'number'`.
 *
 * So the accumulated debt lives on `player.fatigueDebt` and the old field is
 * left alone. They measure the same idea; they are not the same number, and
 * pretending otherwise would corrupt a field the rest of the game reads.
 *
 * WHAT RECOVERY IS FOR. A rest day is the ABSENCE of a game, so recovery is
 * what a club gets for the night the rebalancer took a fixture off it. The
 * amount comes from the player: a fit player recovers more, a distractible one
 * less. Nothing here changes an attribute, a rating or an Overall — fatigue is
 * a temporary state, and it is stored separately for exactly that reason.
 */

import { playerFatigue } from './scheduleFatigue.js';

/** Recovery per rest day, before the player is read. */
export const RECOVERY_BASE = { physical: 0.05, mental: 0.04 };

/** Fatigue is a debt: -1 is spent, 0 is fully rested. */
export const DEBT_RANGE = { min: -1, max: 0 };

/**
 * The two adjustments, and the reading behind them.
 *
 * The brief states them without naming a channel — unlike stamina and
 * resilience, which are named by the formula each appears in — so they apply
 * to BOTH. That is the literal reading, and it is defensible: a player who
 * cannot concentrate rests badly in general, and a player with a deep engine
 * recovers well in general. `channelled: true` splits them the other way,
 * endurance to physical and concentration to mental, for a caller who wants it.
 */
export const ADJUSTMENTS = [
  { trait: 'concentration', source: 'mental', test: (v) => v < 70, factor: 0.90,
    channel: 'mental', label: 'Low concentration' },
  { trait: 'endurance', source: 'attributes', test: (v) => v > 85, factor: 1.15,
    channel: 'physical', label: 'High endurance' },
];

const clampDebt = (n) => Math.min(DEBT_RANGE.max, Math.max(DEBT_RANGE.min, n));
const round4 = (n) => Math.round(n * 10000) / 10000;
const round2 = (n) => Math.round(n * 100) / 100;

/** Read a trait from whichever layer this save keeps it in. */
function traitValue(player, rule) {
  if (!player) return null;
  const layers = [player[rule.source], player.attributes, player.mental, player];
  for (const layer of layers) {
    if (layer && typeof layer[rule.trait] === 'number') return layer[rule.trait];
  }
  return null;
}

/** A player's current debt, defaulting to fresh rather than to a guess. */
export function currentDebt(player) {
  const d = player && (player.fatigueDebt || player.fatigue);
  if (d && typeof d === 'object') {
    return {
      physical: clampDebt(Number(d.physical) || 0),
      mental: clampDebt(Number(d.mental) || 0),
    };
  }
  // A number here is the OLD 0-99 rating, not a debt, and is deliberately not
  // converted — they are different scales set by different things.
  return { physical: 0, mental: 0 };
}

/**
 * What one rest day gives this player back.
 *
 * @returns {{ physical, mental, factors, applied, missing }} both figures are
 *   positive, because recovery moves a debt towards zero.
 */
export function recoveryFor(player, opts = {}) {
  const channelled = opts.channelled === true;
  let fPhys = 1, fMent = 1;
  const applied = [];
  const missing = [];

  const stamina = traitValue(player, { trait: 'stamina', source: 'attributes' });
  const resilience = traitValue(player, { trait: 'resilience', source: 'mental' });
  if (stamina == null) missing.push('stamina');
  if (resilience == null) missing.push('resilience');

  for (const rule of ADJUSTMENTS) {
    const v = traitValue(player, rule);
    if (v == null) { missing.push(rule.trait); continue; }
    if (!rule.test(v)) continue;
    if (channelled) {
      if (rule.channel === 'physical') fPhys *= rule.factor; else fMent *= rule.factor;
    } else {
      fPhys *= rule.factor; fMent *= rule.factor;
    }
    applied.push({ trait: rule.trait, value: v, factor: rule.factor, label: rule.label });
  }

  // A missing trait recovers nothing from that term rather than a guessed
  // amount — the same rule the fatigue penalties follow.
  const physical = RECOVERY_BASE.physical * ((stamina == null ? 0 : stamina) / 100) * fPhys;
  const mental = RECOVERY_BASE.mental * ((resilience == null ? 0 : resilience) / 100) * fMent;

  return {
    physical: round4(physical),
    mental: round4(mental),
    factors: { physical: fPhys, mental: fMent },
    applied, missing,
  };
}

/**
 * Apply `nights` rest days to one player.
 *
 * Recovery is capped at zero, so a rested player cannot bank credit against a
 * future back-to-back — the debt floor and ceiling are both real.
 */
export function restPlayer(player, nights = 1, opts = {}) {
  const before = currentDebt(player);
  const per = recoveryFor(player, opts);
  const n = Math.max(0, Math.round(Number(nights) || 0));
  const after = {
    physical: clampDebt(before.physical + per.physical * n),
    mental: clampDebt(before.mental + per.mental * n),
  };
  return {
    before, after, nights: n, per,
    // What was ACTUALLY given back, which is less than the formula's amount
    // once the cap bites. Reporting the formula instead would overstate it.
    gained: {
      physical: round4(after.physical - before.physical),
      mental: round4(after.mental - before.mental),
    },
  };
}

/**
 * Rest a whole squad, and report it.
 *
 * @param {Array} players  mutated: their `fatigueDebt` is written back
 * @returns {{ team, restDaysAdded, averageRecoveryPhysical, averageRecoveryMental, players }}
 */
export function restTeam(team, players, nights, opts = {}) {
  const list = (players || []).filter(Boolean);
  const rows = list.map((p) => {
    const r = restPlayer(p, nights, opts);
    if (opts.apply !== false) p.fatigueDebt = { ...r.after };
    return { name: p.name, id: p.id, ...r };
  });
  const avg = (f) => (rows.length
    ? round4(rows.reduce((s, r) => s + f(r), 0) / rows.length) : 0);
  const n = Math.max(0, Math.round(Number(nights) || 0));
  return {
    team,
    restDaysAdded: n,
    // PER REST DAY, averaged across the squad — which is what the brief's own
    // example reports: it pairs four rest days with +0.05, and +0.05 is the
    // base rate for one night rather than four nights' worth. The cumulative
    // figure is carried alongside rather than instead, because "how much did
    // this club actually get back" is the other question worth answering and
    // the two are easy to confuse.
    averageRecoveryPhysical: n ? round2(avg((r) => r.gained.physical) / n) : 0,
    averageRecoveryMental: n ? round2(avg((r) => r.gained.mental) / n) : 0,
    totalRecoveryPhysical: round2(avg((r) => r.gained.physical)),
    totalRecoveryMental: round2(avg((r) => r.gained.mental)),
    players: rows,
  };
}

/**
 * Seed a squad's debt from the back-to-backs it has actually played.
 *
 * Recovery only means something if something spent the debt in the first
 * place, and nothing in this game accrues it yet — there is no per-game
 * fatigue accumulator. So where a caller has no stored debt, this charges each
 * player the back-to-back penalty they carry, once per second night their club
 * played. That is derived from the fixture list rather than invented, and a
 * caller with real stored debt keeps it.
 */
export function seedDebt(players, backToBacks, opts = {}) {
  const n = Math.max(0, Math.round(Number(backToBacks) || 0));
  for (const p of players || []) {
    if (p.fatigueDebt) continue;
    const f = playerFatigue(p, opts);
    p.fatigueDebt = {
      physical: clampDebt(f.raw.physical * n),
      mental: clampDebt(f.raw.mental * n),
    };
  }
  return players;
}
