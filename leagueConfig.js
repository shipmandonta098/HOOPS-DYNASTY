'use strict';

/**
 * leagueConfig.js — the shared "league draft" used by the New Career screen and
 * the League Structure screen.
 *
 * Both pages edit the same working configuration, so it lives here and is
 * persisted to localStorage between them. Saved presets (a reusable league
 * setup) live in IndexedDB via db.js's generic store API.
 *
 * All teams and leagues are fictional.
 *
 * Draft shape:
 *   {
 *     leagueName, season, difficulty, teamId,      // teamId = team you manage
 *     teams:     [{ id, city, name, emoji, color, marketSize, fanInterest,
 *                   budget, championships, divisionId|null, custom? }],
 *     structure: { conferences: [{id,name}], divisions: [{id,name,conferenceId}] }
 *   }
 * A team with divisionId === null is unassigned.
 */

import { saveData, loadData, deleteData, getAllData } from './db.js';

/* ============================ deterministic RNG ============================ */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function makeRNG(seed) {
  const r = mulberry32(seed >>> 0);
  return {
    next: r,
    int: (min, max) => min + Math.floor(r() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    gauss: (m, s) => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r();
      return m + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * s; },
  };
}

/* ============================== team sources ============================== */
/* Fixed seed so the default league is identical everywhere it is built. */
export const TEAM_SEED = 1;

const NAMED_TEAMS = [
  { id: 'NYM', city: 'New York', name: 'Monarchs', emoji: '👑', color: '#c0392b', marketSize: 'Large', fanInterest: 'High', budget: 120.0, championships: 0 },
  { id: 'LAS', city: 'Los Angeles', name: 'Sentinels', emoji: '🛡️', color: '#5b4b8a', marketSize: 'Large', fanInterest: 'High', budget: 118.0, championships: 2 },
  { id: 'CHT', city: 'Chicago', name: 'Titans', emoji: '🐂', color: '#b03a2e', marketSize: 'Large', fanInterest: 'Medium', budget: 108.0, championships: 3 },
  { id: 'MIW', city: 'Miami', name: 'Wave', emoji: '🌊', color: '#17a2a2', marketSize: 'Medium', fanInterest: 'High', budget: 104.0, championships: 1 },
  { id: 'TOR', city: 'Toronto', name: 'North', emoji: '🍁', color: '#a02128', marketSize: 'Medium', fanInterest: 'Medium', budget: 99.0, championships: 1 },
  { id: 'DAL', city: 'Dallas', name: 'Hurricanes', emoji: '🌀', color: '#2f6fb0', marketSize: 'Large', fanInterest: 'Medium', budget: 112.0, championships: 0 },
];

const MORE_CITIES = ['Boston', 'Denver', 'Phoenix', 'Seattle', 'Atlanta', 'Houston',
  'Portland', 'Orlando', 'Detroit', 'Memphis', 'Sacramento', 'Cleveland', 'Charlotte',
  'Indiana', 'Minnesota', 'Brooklyn', 'Philadelphia', 'Vancouver', 'Austin', 'Vegas',
  'San Diego', 'Kansas City', 'Nashville', 'Montreal'];
const MORE_NAMES = ['Blaze', 'Frost', 'Rhinos', 'Comets', 'Griffins', 'Voyagers',
  'Pioneers', 'Storm', 'Vipers', 'Raptors', 'Falcons', 'Dragons', 'Kings', 'Aviators',
  'Miners', 'Breakers', 'Rovers', 'Sharks', 'Bandits', 'Legends', 'Coyotes', 'Anchors',
  'Thunder', 'Wolves'];
export const EMOJI_CHOICES = ['🔥', '❄️', '🦏', '☄️', '🦅', '⚓', '⛏️', '⚡', '🐍', '🦖',
  '🐉', '🎯', '🐺', '🌪️', '👑', '🛡️', '🐂', '🌊', '🍁', '🌀', '⭐', '🏔️', '🚀', '🦌'];
export const COLOR_CHOICES = ['#2e7d32', '#1565c0', '#ef6c00', '#6a1b9a', '#00838f',
  '#c62828', '#4527a0', '#00695c', '#37474f', '#ad1457', '#c0392b', '#2f6fb0'];
export const MARKETS = ['Small', 'Medium', 'Large'];
export const FANS = ['Low', 'Medium', 'High'];

/** Extra fictional franchises the user can add from the library. */
const LIBRARY_EXTRA = [
  ['Anchorage', 'Glaciers'], ['Santa Fe', 'Serpents'], ['Buffalo', 'Bison'],
  ['Reno', 'Prospectors'], ['Tampa', 'Tarpons'], ['Omaha', 'Outlaws'],
  ['Hartford', 'Whalers'], ['Tulsa', 'Twisters'], ['Boise', 'Bighorns'],
  ['Richmond', 'Rebels'], ['Spokane', 'Sentries'], ['Mobile', 'Mariners'],
];

/** Build the default 30-team league (named first, then generated). */
export function defaultTeams() {
  const rng = makeRNG(TEAM_SEED);
  const teams = NAMED_TEAMS.map((t) => ({ ...t }));
  const usedCity = new Set(teams.map((t) => t.city));
  let ci = 0, ni = 0;
  while (teams.length < 30) {
    const city = MORE_CITIES[ci++ % MORE_CITIES.length];
    const name = MORE_NAMES[ni++ % MORE_NAMES.length];
    if (usedCity.has(city)) continue;
    usedCity.add(city);
    teams.push({
      id: (city.slice(0, 2) + name.slice(0, 1)).toUpperCase() + teams.length,
      city, name,
      emoji: rng.pick(EMOJI_CHOICES.slice(0, 14)),
      color: rng.pick(COLOR_CHOICES),
      marketSize: rng.pick(MARKETS),
      fanInterest: rng.pick(FANS),
      budget: +(85 + rng.next() * 40).toFixed(1),
      championships: rng.int(0, 3),
    });
  }
  return teams;
}

/** Fictional franchises available to add, excluding ones already in the league. */
export function teamLibrary(existingTeams) {
  const rng = makeRNG(TEAM_SEED + 77);
  const have = new Set((existingTeams || []).map((t) => `${t.city}|${t.name}`));
  const out = [];
  for (const [city, name] of LIBRARY_EXTRA) {
    if (have.has(`${city}|${name}`)) continue;
    out.push({
      id: 'lib_' + (city.slice(0, 2) + name.slice(0, 1)).toUpperCase(),
      city, name,
      emoji: rng.pick(EMOJI_CHOICES),
      color: rng.pick(COLOR_CHOICES),
      marketSize: rng.pick(MARKETS),
      fanInterest: rng.pick(FANS),
      budget: +(85 + rng.next() * 40).toFixed(1),
      championships: 0,
    });
  }
  return out;
}

/* ============================== structure ============================== */
const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 9);

/** Two conferences, six divisions — the default alignment. */
export function defaultStructure() {
  const east = { id: 'conf_east', name: 'Eastern Conference' };
  const west = { id: 'conf_west', name: 'Western Conference' };
  return {
    conferences: [east, west],
    divisions: [
      { id: 'div_atl', name: 'Atlantic', conferenceId: east.id },
      { id: 'div_lakes', name: 'Great Lakes', conferenceId: east.id },
      { id: 'div_south', name: 'Southern', conferenceId: east.id },
      { id: 'div_mtn', name: 'Mountain', conferenceId: west.id },
      { id: 'div_coast', name: 'Coastal', conferenceId: west.id },
      { id: 'div_plains', name: 'Plains', conferenceId: west.id },
    ],
  };
}

/** Spread teams evenly across the divisions, in order. */
export function autoAlign(teams, structure) {
  const divs = structure.divisions;
  if (!divs.length) { teams.forEach((t) => { t.divisionId = null; }); return teams; }
  const per = Math.ceil(teams.length / divs.length);
  teams.forEach((t, i) => { t.divisionId = divs[Math.min(divs.length - 1, Math.floor(i / per))].id; });
  return teams;
}

export function newConference(name) { return { id: uid('conf'), name: name || 'New Conference' }; }
export function newDivision(name, conferenceId) { return { id: uid('div'), name: name || 'New Division', conferenceId }; }
export function newTeamId() { return uid('team').toUpperCase(); }

/** "30 Teams • 2 Conferences • 6 Divisions" */
export function summaryLine(draft) {
  const t = (draft.teams || []).length;
  const c = ((draft.structure || {}).conferences || []).length;
  const d = ((draft.structure || {}).divisions || []).length;
  const plural = (n, s) => `${n} ${s}${n === 1 ? '' : 's'}`;
  return `${plural(t, 'Team')} • ${plural(c, 'Conference')} • ${plural(d, 'Division')}`;
}

/** Teams with no division assigned — surfaced prominently in the editor. */
export function unassignedTeams(draft) {
  const ids = new Set((draft.structure.divisions || []).map((d) => d.id));
  return (draft.teams || []).filter((t) => !t.divisionId || !ids.has(t.divisionId));
}

/* ============================== draft state ============================== */
const DRAFT_KEY = 'hd.leagueDraft';

export function newDraft() {
  const structure = defaultStructure();
  const teams = autoAlign(defaultTeams(), structure);
  return {
    leagueName: 'National Basketball League',
    season: 2026,
    difficulty: 'normal',
    teamId: teams[0].id,
    presetId: null,
    presetName: 'Custom League',
    teams, structure,
  };
}

export function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && Array.isArray(d.teams) && d.structure) return d;
    }
  } catch (_) {}
  return newDraft();
}

export function saveDraft(draft) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (_) {}
  return draft;
}

export function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
}

/* ============================== presets ============================== */
/* A preset stores the league CONFIGURATION only. The team you manage and the
   difficulty stay per-career, so the same league can be replayed with a
   different franchise. */

const PRESET_STORE = 'presets';

function toPresetConfig(draft) {
  return {
    leagueName: draft.leagueName,
    season: draft.season,
    teams: JSON.parse(JSON.stringify(draft.teams)),
    structure: JSON.parse(JSON.stringify(draft.structure)),
  };
}

export async function listPresets() {
  try {
    const rows = await getAllData(PRESET_STORE);
    return rows.map((r) => r.value).filter(Boolean)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  } catch (err) {
    console.warn('Presets unavailable:', err);
    return [];
  }
}

export async function savePreset(name, draft, existingId) {
  const id = existingId || uid('preset');
  const record = {
    id, name: String(name || 'Untitled Preset').trim(),
    updatedAt: new Date().toISOString(),
    config: toPresetConfig(draft),
  };
  await saveData(PRESET_STORE, id, record);
  return record;
}

export async function getPreset(id) { return loadData(PRESET_STORE, id); }

export async function renamePreset(id, name) {
  const p = await loadData(PRESET_STORE, id);
  if (!p) return null;
  p.name = String(name || p.name).trim();
  p.updatedAt = new Date().toISOString();
  await saveData(PRESET_STORE, id, p);
  return p;
}

export async function deletePreset(id) { await deleteData(PRESET_STORE, id); }

/** Apply a preset's configuration onto the draft, keeping team + difficulty. */
export function applyPreset(draft, preset) {
  const c = preset.config || {};
  draft.leagueName = c.leagueName || draft.leagueName;
  draft.season = c.season || draft.season;
  draft.teams = JSON.parse(JSON.stringify(c.teams || draft.teams));
  draft.structure = JSON.parse(JSON.stringify(c.structure || draft.structure));
  draft.presetId = preset.id;
  draft.presetName = preset.name;
  // The previously managed team may not exist in this preset — fall back.
  if (!draft.teams.some((t) => t.id === draft.teamId)) draft.teamId = draft.teams[0] ? draft.teams[0].id : null;
  return draft;
}
