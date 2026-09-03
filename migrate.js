'use strict';

/**
 * migrate.js — bring older saves up to the current data model.
 *
 * Called from db.js's loadLeague(), so every screen reads migrated data and no
 * screen needs to know old shapes existed.
 *
 * The rule here is the same as everywhere else: MAP, never invent. A save made
 * before the attribute split holds fourteen ratings; the twenty-three it needs
 * now are derived from those real values (athleticism becomes the six physical
 * traits, insideScoring becomes layups/dunks/post control, basketballIQ
 * becomes the three IQ ratings). Nothing is conjured from nowhere, and a save
 * that already has the new shape is returned untouched.
 */

import { computeOverall } from './playerRatings.js';
import { makeMental, MENTAL_KEYS } from './playerMental.js';
import { makeTraits, derivePriorities } from './playerPersonality.js';
import { ovr } from './playerRatings.js';
import { marketForTeam, lookupCity } from './markets.js';
import { normalize as normalizeSettings } from './gameSettings.js';

/**
 * Old attribute -> the new attributes it feeds, with an offset applied so the
 * split is not a flat copy. `basketballIQ` genuinely described three separate
 * skills, so it splits three ways; `athleticism` was one number standing in
 * for a whole physical profile.
 */
const SPLIT = {
  athleticism:   [['speed', 0], ['agility', -1], ['vertical', +1], ['strength', -2],
                  ['stamina', 0], ['endurance', -1]],
  insideScoring: [['layup', +1], ['dunk', 0], ['postControl', -3]],
  basketballIQ:  [['shotIQ', 0], ['passingIQ', +1], ['defensiveIQ', 0]],
};

/** Attributes whose name and meaning are unchanged. */
const CARRIED = [
  'threePoint', 'midRange', 'freeThrow', 'passing', 'ballHandling',
  'perimeterDefense', 'interiorDefense', 'steal', 'block',
  'offensiveRebound', 'defensiveRebound',
];

const clamp = (v) => Math.max(20, Math.min(99, Math.round(v)));

/** True if this player already carries the current attribute shape. */
function isCurrent(attrs) {
  return typeof attrs.strength === 'number' && typeof attrs.shotIQ === 'number';
}

/**
 * Upgrade one player's attribute block in place. Returns true if it changed.
 * Overall is recomputed afterwards: the definition of overall changed with the
 * attributes, so keeping the old cached number would leave it disagreeing with
 * the skills it is supposed to summarise.
 */
function migratePlayer(p) {
  const attrs = p && p.attributes;
  if (!attrs || isCurrent(attrs)) return false;

  const next = {};
  for (const key of CARRIED) {
    if (typeof attrs[key] === 'number') next[key] = clamp(attrs[key]);
  }
  for (const [from, targets] of Object.entries(SPLIT)) {
    const base = typeof attrs[from] === 'number' ? attrs[from] : null;
    if (base === null) continue;
    for (const [to, offset] of targets) next[to] = clamp(base + offset);
  }
  // Anything the old save simply did not have — there is no honest source for
  // it, so it takes the mean of what the player does have rather than a
  // flattering or punishing guess.
  const known = Object.values(next);
  const fallback = known.length ? clamp(known.reduce((a, b) => a + b, 0) / known.length) : 50;
  for (const key of [...CARRIED, ...Object.values(SPLIT).flat().map(([t]) => t)]) {
    if (typeof next[key] !== 'number') next[key] = fallback;
  }

  p.attributes = next;
  p.overall = computeOverall(p);
  return true;
}

/**
 * A player-stable RNG for backfilling fields onto an existing save.
 *
 * Seeded from the player's id, NOT from chance, so the same player gets the
 * same values every time the save is opened. A fresh draw on each load would
 * mean a player's mental profile changed whenever you looked at him.
 */
function rngForPlayer(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  const r = () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  return {
    next: r,
    int: (min, max) => min + Math.floor(r() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    gauss: (m, s) => {
      let u = 0, v = 0;
      while (!u) u = r();
      while (!v) v = r();
      return m + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * s;
    },
  };
}

/**
 * Give a pre-mental-attributes player a profile. Returns true if it added one.
 * `enabled` is the league's own setting: a league generated with Mental
 * Attributes switched off must not have them handed back by the upgrade path.
 */
function backfillMental(p, enabled) {
  if (!p || !p.id || !enabled) return false;
  const m = p.mental;
  if (m && MENTAL_KEYS.every((k) => typeof m[k] === 'number')) return false;
  p.mental = makeMental(rngForPlayer(p.id), { age: p.age, personality: p.personality });
  return true;
}

/**
 * The old single personality label maps onto the trait it most obviously
 * describes. That is a real carry-over rather than a re-roll: a player who was
 * "Headstrong" keeps that character, and the rest of his trait set is drawn
 * around it.
 */
const LEGACY_PERSONALITY = {
  'Team-First': 'team_first',
  'Competitor': 'competitive',
  'Vocal Leader': 'vocal_leader',
  'Quiet Professional': 'professional',
  'Coachable': 'team_first',
  'Streaky': 'restless',
  'Headstrong': 'independent',
  'Workhorse': 'professional',
  'Free Spirit': 'independent',
};

/** As above: never re-add a layer the league was deliberately created without. */
function backfillPersonality(p, enabled) {
  if (!p || !p.id || !enabled) return false;
  const per = p.personality;
  if (per && Array.isArray(per.traits) && per.priorities) return false;

  const rng = rngForPlayer(p.id + ':personality');
  const traits = makeTraits(rng, { age: p.age });
  // Seed from the old label so the upgrade preserves character rather than
  // replacing it. `personality` was a string on these saves.
  const seed = typeof per === 'string' ? LEGACY_PERSONALITY[per] : null;
  if (seed && !traits.includes(seed)) traits[traits.length - 1] = seed;

  p.personality = {
    traits,
    priorities: derivePriorities(traits, { age: p.age, overall: ovr(p), rng }),
  };
  if (!Array.isArray(p.relationships)) p.relationships = [];
  return true;
}

/**
 * Bring a team's market size onto the geography-based system.
 *
 * Market size used to be derived from a per-team random "population", so a
 * franchise in Atlanta could be Small and one in Boise could be Large. It is a
 * property of the CITY, so it is recomputed from the city here. Nothing else
 * about the team is touched: names, colours, logos, budget, fan interest and
 * championships all survive — fan interest especially, since it is a separate
 * concept and a big market with an indifferent fanbase is a real situation.
 *
 * A manual override the user set is respected and never overwritten.
 */
function migrateTeamMarket(t) {
  if (!t || !t.city) return false;
  const hit = lookupCity(t.city);
  const before = t.marketSize;
  // A real city carries its real metro population; the old random one goes.
  if (hit) t.population = hit.population;
  t.marketSize = marketForTeam(t);
  return t.marketSize !== before;
}

/**
 * Migrate a whole league. Mutates and returns it; safe to call repeatedly.
 * @returns {{ league: object, changed: number }}
 */
export function migrateLeague(league) {
  if (!league || !Array.isArray(league.players)) return { league, changed: 0 };
  // Settings first: the backfills below have to know which layers this league
  // is supposed to have before they decide whether to add them.
  league.settings = { ...normalizeSettings(league.settings), ...(league.settings || {}) };
  league.settings = { ...league.settings, ...normalizeSettings(league.settings) };
  const rules = league.settings;

  let changed = 0;
  let mentals = 0;
  let persons = 0;
  for (const p of league.players) {
    if (migratePlayer(p)) changed++;
    if (backfillMental(p, rules.mentalAttributes)) mentals++;
    if (backfillPersonality(p, rules.personalityTraits)) persons++;
  }
  let markets = 0;
  for (const t of league.teams || []) if (migrateTeamMarket(t)) markets++;
  if (markets) {
    console.info(`Save upgraded: ${markets} team(s) re-classified by city market size.`);
  }

  // Fields added after the first saves shipped, defaulted rather than assumed.
  if (!Array.isArray(league.freeAgents)) league.freeAgents = [];
  if (!Array.isArray(league.transactions)) league.transactions = [];
  if (changed) {
    console.info(`Save upgraded: ${changed} player(s) moved to the 23-attribute model.`);
  }
  if (mentals) {
    console.info(`Save upgraded: mental attributes assigned to ${mentals} player(s).`);
  }
  if (persons) {
    console.info(`Save upgraded: personality traits and priorities assigned to ${persons} player(s).`);
  }
  return { league, changed, mentals, persons };
}
