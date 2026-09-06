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

import {
  MARKET_TIERS, marketForTeam, marketFromPopulation, populationFromMarket,
  metroPopulation, lookupCity,
} from './markets.js';

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

/* Fan interest is set INDEPENDENTLY of market size here, on purpose: Chicago
   is a Very Large market with a Low-interest fanbase, which is the situation
   the two-concept split exists to make possible. */
const NAMED_TEAMS = [
  { id: 'NYM', city: 'New York', name: 'Monarchs', emoji: '👑', colors: { primary: '#c0392b', secondary: '#f0c419', tertiary: '#0d1e34' }, fanInterest: 'High', budget: 120.0, championships: 0 },
  { id: 'LAS', city: 'Los Angeles', name: 'Sentinels', emoji: '🛡️', colors: { primary: '#5b4b8a', secondary: '#d8c15e', tertiary: '#ffffff' }, fanInterest: 'Medium', budget: 118.0, championships: 2 },
  { id: 'CHT', city: 'Chicago', name: 'Titans', emoji: '🐂', colors: { primary: '#b03a2e', secondary: '#1a1a1a', tertiary: '#e8e8e8' }, fanInterest: 'Low', budget: 108.0, championships: 3 },
  { id: 'MIW', city: 'Miami', name: 'Wave', emoji: '🌊', colors: { primary: '#17a2a2', secondary: '#ff7fbf', tertiary: '#0d2b3e' }, fanInterest: 'High', budget: 104.0, championships: 1 },
  { id: 'TOR', city: 'Toronto', name: 'North', emoji: '🍁', colors: { primary: '#a02128', secondary: '#ffffff', tertiary: '#2b2b2b' }, fanInterest: 'Medium', budget: 99.0, championships: 1 },
  { id: 'DAL', city: 'Dallas', name: 'Hurricanes', emoji: '🌀', colors: { primary: '#2f6fb0', secondary: '#8ec6f0', tertiary: '#10233b' }, fanInterest: 'Medium', budget: 112.0, championships: 0 },
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
export const MARKETS = MARKET_TIERS;

/* Market size questions all go through markets.js, which looks the city up
   rather than deriving anything from the team. Re-exported here so existing
   callers keep working and there is still one import for league config. */
export { marketFromPopulation, populationFromMarket, metroPopulation, lookupCity };

/**
 * The market tier for a team: a manual override if the user set one, else the
 * city. Never random, and never a function of how good the team is.
 */
export function marketOf(team) {
  return marketForTeam(team);
}

/** A team's three-colour palette, tolerating older single-`color` records. */
export function teamColors(team) {
  const c = (team && team.colors) || {};
  const legacy = (team && team.color) || '#33506e';
  return {
    primary: c.primary || legacy,
    secondary: c.secondary || '#ffffff',
    tertiary: c.tertiary || '#0d1e34',
  };
}

/**
 * One crest renderer shared by every screen, so a team looks the same in the
 * carousel, the structure editor and the dashboard. Uses the uploaded primary
 * logo when there is one, otherwise the crest emoji, and paints all three
 * colours: primary fill, secondary inner ring, tertiary outer ring.
 */
export function crestHTML(team, size = 40) {
  const c = teamColors(team);
  const inner = team && team.logoPrimary
    ? `<img src="${team.logoPrimary}" alt="" style="width:74%;height:74%;object-fit:contain;">`
    : `<span style="font-size:${Math.round(size * 0.46)}px;line-height:1">${(team && team.emoji) || '🏀'}</span>`;
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;display:grid;place-items:center;
    background:${c.primary};box-shadow:0 0 0 2px ${c.secondary} inset, 0 0 0 2px ${c.tertiary};
    overflow:hidden;flex:0 0 auto;">${inner}</div>`;
}

/**
 * Read an image file, downscale it and return a PNG data URL. Downscaling
 * matters: logos are stored inside the league draft (localStorage) and the
 * save itself, and full-size uploads would blow past the storage quota.
 */
export function readLogoFile(file, max = 128) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file selected.'));
    if (!/^image\//.test(file.type)) return reject(new Error('That file is not an image.'));
    if (file.size > 4 * 1024 * 1024) return reject(new Error('Image is too large (4 MB max).'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      try { resolve(cv.toDataURL('image/png')); }
      catch (err) { reject(new Error('Could not process that image.')); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image.')); };
    img.src = url;
  });
}
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
      colors: {
        primary: rng.pick(COLOR_CHOICES),
        secondary: rng.pick(['#ffffff', '#f0c419', '#e8e8e8', '#1a1a1a', '#8ec6f0']),
        tertiary: rng.pick(['#0d1e34', '#10233b', '#2b2b2b', '#ffffff']),
      },
      // Metro population comes from the city itself. Market size is then
      // looked up from the city too, so a team in Atlanta is a Large market
      // whatever else is true about it.
      population: (lookupCity(city) || {}).population ?? null,
      // Fan interest is separate and free to be anything: a Very Large market
      // with an indifferent fanbase is a perfectly normal situation.
      fanInterest: rng.pick(FANS),
      // Budget is an OWNERSHIP decision, not a market one. Deliberately drawn
      // independently so a small-market owner can outspend a big-market one.
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
      colors: {
        primary: rng.pick(COLOR_CHOICES),
        secondary: rng.pick(['#ffffff', '#f0c419', '#e8e8e8', '#1a1a1a']),
        tertiary: rng.pick(['#0d1e34', '#2b2b2b', '#ffffff']),
      },
      population: (lookupCity(city) || {}).population ?? null,
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
    // Fictional, deliberately. "National Basketball League" is a real league
    // name in more than one country and reads as a thin variant of a bigger
    // one, which is exactly the real-world branding this game does not use.
    leagueName: 'Dynasty Basketball League',
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
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch (err) {
    // Almost always the storage quota — uploaded logos are the usual cause.
    console.warn('Could not save the league draft:', err);
    return false;
  }
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
