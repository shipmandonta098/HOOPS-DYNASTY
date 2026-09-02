'use strict';

/**
 * newCareer.js — drives the New Career setup screen and, on "Start Career",
 * generates a full league and saves it through the repo's IndexedDB layer
 * (db.js). Static / browser ES module; no build step.
 *
 * Flow:
 *   1. Render the team carousel + difficulty cards.
 *   2. Track the user's choices (name, season, team, difficulty).
 *   3. On Start Career: build a schema-shaped league object, saveLeague(id,…),
 *      then return to the title screen where Continue/Load are now unlocked.
 *
 * The league it produces matches saves/example_league.json's shape, so the
 * Node engine (engine/*.js) can read and simulate it later.
 */

import { saveLeague } from './db.js';

/* ============================ deterministic RNG ============================ */
/* Mirrors engine/lib/rng.js so browser-created leagues are reproducible. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function makeRNG(seed) {
  const r = mulberry32(seed >>> 0);
  return {
    next: r,
    int: (min, max) => min + Math.floor(r() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    gauss: (m, s) => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r();
      return m + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * s; },
  };
}

/* ============================== league data =============================== */

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
const ATTRIBUTES = [
  'insideScoring', 'midRange', 'threePoint', 'freeThrow', 'passing', 'ballHandling',
  'offensiveRebound', 'defensiveRebound', 'perimeterDefense', 'interiorDefense',
  'block', 'steal', 'athleticism', 'basketballIQ',
];
const FIRST = ['James', 'Marcus', 'Tyrese', 'DeAndre', 'Jalen', 'Cam', 'Isaiah', 'Malik',
  'Trey', 'Devin', 'Zion', 'Jaylen', 'Brandon', 'Darius', 'Keegan', 'Obi', 'Xavier',
  'Jordan', 'Quentin', 'Terrence', 'Cason', 'Julian', 'Bilal', 'Kel', 'Deni', 'Santi'];
const LAST = ['Carter', 'Robinson', 'Mitchell', 'Thompson', 'Edwards', 'Hayes', 'Foster',
  'Coleman', 'Reeves', 'Miller', 'Wallace', 'Walker', 'Vincent', 'Sharpe', 'Duren',
  'Sanders', 'Bryant', 'Ellison', 'Brooks', 'Freeman', 'Howard', 'Nowell', 'Prosper'];

/* The six named teams from the reference, with their card stats. */
const NAMED_TEAMS = [
  { id: 'NYM', city: 'New York', name: 'Monarchs', emoji: '👑', color: '#c0392b', marketSize: 'Large', fanInterest: 'High', budget: 120.0, championships: 0 },
  { id: 'LAS', city: 'Los Angeles', name: 'Sentinels', emoji: '🛡️', color: '#5b4b8a', marketSize: 'Large', fanInterest: 'High', budget: 118.0, championships: 2 },
  { id: 'CHT', city: 'Chicago', name: 'Titans', emoji: '🐂', color: '#b03a2e', marketSize: 'Large', fanInterest: 'Medium', budget: 108.0, championships: 3 },
  { id: 'MIW', city: 'Miami', name: 'Wave', emoji: '🌊', color: '#17a2a2', marketSize: 'Medium', fanInterest: 'High', budget: 104.0, championships: 1 },
  { id: 'TOR', city: 'Toronto', name: 'North', emoji: '🍁', color: '#a02128', marketSize: 'Medium', fanInterest: 'Medium', budget: 99.0, championships: 1 },
  { id: 'DAL', city: 'Dallas', name: 'Hurricanes', emoji: '🌀', color: '#2f6fb0', marketSize: 'Large', fanInterest: 'Medium', budget: 112.0, championships: 0 },
];

/* Pools to procedurally fill the league out to 30 teams. */
const MORE_CITIES = ['Boston', 'Denver', 'Phoenix', 'Seattle', 'Atlanta', 'Houston',
  'Portland', 'Orlando', 'Detroit', 'Memphis', 'Sacramento', 'Cleveland', 'Charlotte',
  'Indiana', 'Minnesota', 'Brooklyn', 'Philadelphia', 'Vancouver', 'Austin', 'Vegas',
  'San Diego', 'Kansas City', 'Nashville', 'Montreal'];
const MORE_NAMES = ['Blaze', 'Frost', 'Rhinos', 'Comets', 'Griffins', 'Voyagers',
  'Pioneers', 'Storm', 'Vipers', 'Raptors', 'Falcons', 'Dragons', 'Kings', 'Aviators',
  'Miners', 'Breakers', 'Rovers', 'Sharks', 'Bandits', 'Legends', 'Coyotes', 'Anchors',
  'Thunder', 'Wolves'];
const MORE_EMOJI = ['🔥', '❄️', '🦏', '☄️', '🦅', '⚓', '⛏️', '⚡', '🐍', '🦖', '🐉', '🎯', '🐺', '🌪️'];
const MORE_COLORS = ['#2e7d32', '#1565c0', '#ef6c00', '#6a1b9a', '#00838f', '#c62828',
  '#4527a0', '#00695c', '#37474f', '#ad1457'];
const MARKETS = ['Small', 'Medium', 'Large'];
const FANS = ['Low', 'Medium', 'High'];

/** Build the full 30-team list (named first, then generated), deterministic. */
function buildTeams(rng) {
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
      emoji: rng.pick(MORE_EMOJI),
      color: rng.pick(MORE_COLORS),
      marketSize: rng.pick(MARKETS),
      fanInterest: rng.pick(FANS),
      budget: +(85 + rng.next() * 40).toFixed(1),
      championships: rng.int(0, 3),
    });
  }
  return teams;
}

/** Generate one player with a full attribute block + cached overall. */
function makePlayer(idNum, teamId, pos, target, rng) {
  const attrs = {};
  for (const a of ATTRIBUTES) attrs[a] = Math.max(25, Math.min(99, Math.round(rng.gauss(target, 7))));
  const boosts = {
    PG: ['passing', 'ballHandling', 'threePoint'], SG: ['threePoint', 'midRange', 'perimeterDefense'],
    SF: ['athleticism', 'perimeterDefense', 'insideScoring'], PF: ['insideScoring', 'defensiveRebound', 'interiorDefense'],
    C: ['interiorDefense', 'block', 'defensiveRebound', 'insideScoring'],
  }[pos];
  for (const b of boosts) attrs[b] = Math.min(99, attrs[b] + rng.int(3, 9));
  const overall = Math.round(ATTRIBUTES.reduce((s, a) => s + attrs[a], 0) / ATTRIBUTES.length);
  const age = rng.int(19, 34);
  const room = age <= 23 ? rng.int(4, 12) : age <= 27 ? rng.int(0, 4) : 0;
  return {
    id: `p_${String(idNum).padStart(4, '0')}`,
    name: `${rng.pick(FIRST)} ${rng.pick(LAST)}`,
    position: pos, age, teamId,
    attributes: attrs, overall, potential: Math.min(99, overall + room),
    contract: { salary: Math.max(1, Math.round((overall - 55) * 1.1)), yearsRemaining: rng.int(1, 4), type: 'standard', playerOption: false, teamOption: false },
    statsHistory: [],
  };
}

/**
 * Assemble a complete league object from the user's setup choices.
 * @param {{leagueName, season, teamId, difficulty}} cfg
 */
function generateLeague(cfg) {
  const seed = hashString(`${cfg.leagueName}|${cfg.season}|${cfg.teamId}`);
  const rng = makeRNG(seed);
  const teams = buildTeams(rng);

  // A roster per team: one starter per position + 7 bench.
  const players = [];
  let idNum = 1;
  for (const team of teams) {
    const quality = team.marketSize === 'Large' ? 68 : team.marketSize === 'Medium' ? 64 : 61;
    for (const pos of POSITIONS) players.push(makePlayer(idNum++, team.id, pos, quality + rng.int(-2, 6), rng));
    for (let i = 0; i < 7; i++) players.push(makePlayer(idNum++, team.id, rng.pick(POSITIONS), quality + rng.int(-8, 2), rng));
  }

  return {
    schemaVersion: 1,
    meta: {
      leagueName: cfg.leagueName,
      currentSeason: cfg.season,
      currentPhase: 'regular_season',
      rngSeed: seed,
      createdAt: new Date().toISOString(),
      difficulty: cfg.difficulty,
      userTeamId: cfg.teamId,
      lastSimulatedSeason: null,
    },
    settings: {
      salaryCap: 140, minSalary: 1, maxRosterSize: 15,
      meetingsPerMatchup: 4, draftClassSize: 18, playoffTeams: 8,
      difficulty: cfg.difficulty,
    },
    teams: teams.map((t) => ({
      id: t.id, city: t.city, name: t.name, emoji: t.emoji, color: t.color,
      marketSize: t.marketSize, fanInterest: t.fanInterest, budget: t.budget,
      championships: t.championships,
    })),
    players,
    freeAgents: [],
    draft: { schemaVersion: 1, class: cfg.season, prospects: [], order: [], completed: false },
    history: { schemaVersion: 1, seasons: [], champions: [], transactions: [], retirements: [] },
  };
}

/* ============================= UI wiring ================================= */

const state = {
  season: 2026,
  teamId: 'NYM',
  difficulty: 'normal',
  teams: buildTeams(makeRNG(1)),   // a stable preview list for the carousel
};

/* --- Section 1: league name + character counter --- */
function initNameField() {
  const input = document.getElementById('leagueName');
  const counter = document.getElementById('nameCounter');
  const update = () => { counter.textContent = `${input.value.length} / ${input.maxLength}`; };
  input.addEventListener('input', update);
  update();
}

/* --- Section 2: season stepper --- */
function initSeason() {
  const val = document.getElementById('seasonValue');
  const MIN = 2024, MAX = 2035;
  const render = () => { val.textContent = state.season; };
  document.getElementById('seasonPrev').addEventListener('click', () => {
    state.season = Math.max(MIN, state.season - 1); render();
  });
  document.getElementById('seasonNext').addEventListener('click', () => {
    state.season = Math.min(MAX, state.season + 1); render();
  });
  render();
}

/* --- Section 3: team carousel --- */
function crestHTML(team) {
  return `<div style="width:100%;height:100%;border-radius:50%;display:grid;place-items:center;
    background:${team.color};font-size:1.7rem;box-shadow:0 0 0 3px rgba(255,255,255,0.08) inset;">${team.emoji}</div>`;
}
function initTeams() {
  const track = document.getElementById('teamTrack');
  document.getElementById('teamCount').textContent = `${state.teams.length} TEAMS`;

  track.innerHTML = state.teams.map((t) => `
    <div class="team-card${t.id === state.teamId ? ' is-selected' : ''}" data-team="${t.id}" role="button" tabindex="0">
      <span class="star" aria-hidden="true">★</span>
      <div class="logo">${crestHTML(t)}</div>
      <div class="city">${t.city}</div>
      <div class="team">${t.name}</div>
      <div class="stats">
        <div class="row"><span>Market Size</span><b>${t.marketSize}</b></div>
        <div class="row"><span>Fan Interest</span><b>${t.fanInterest}</b></div>
        <div class="row"><span>Budget</span><b>$${t.budget.toFixed(1)}M</b></div>
      </div>
    </div>`).join('');

  const select = (id) => {
    state.teamId = id;
    track.querySelectorAll('.team-card').forEach((c) =>
      c.classList.toggle('is-selected', c.dataset.team === id));
  };
  track.addEventListener('click', (e) => {
    const card = e.target.closest('.team-card');
    if (card) select(card.dataset.team);
  });
  track.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.team-card');
    if (card) { e.preventDefault(); select(card.dataset.team); }
  });

  // Arrows scroll the track by ~2 cards.
  const step = 170 * 2;
  document.getElementById('teamPrev').addEventListener('click', () => track.scrollBy({ left: -step }));
  document.getElementById('teamNext').addEventListener('click', () => track.scrollBy({ left: step }));

  initDots(track);
}
function initDots(track) {
  const dotsEl = document.getElementById('teamDots');
  const pages = () => Math.max(1, Math.ceil(track.scrollWidth / track.clientWidth));
  const render = () => {
    const n = pages();
    const active = Math.round(track.scrollLeft / track.clientWidth);
    dotsEl.innerHTML = Array.from({ length: n }, (_, i) =>
      `<span class="dot${i === active ? ' active' : ''}" data-page="${i}"></span>`).join('');
  };
  dotsEl.addEventListener('click', (e) => {
    const dot = e.target.closest('.dot');
    if (dot) track.scrollTo({ left: dot.dataset.page * track.clientWidth });
  });
  track.addEventListener('scroll', () => window.requestAnimationFrame(render));
  window.addEventListener('resize', render);
  render();
}

/* --- Section 4: difficulty --- */
function initDifficulty() {
  const cards = document.querySelectorAll('.diff-card');
  cards.forEach((card) => card.addEventListener('click', () => {
    state.difficulty = card.dataset.diff;
    cards.forEach((c) => c.classList.toggle('is-selected', c === card));
  }));
}

/* --- Footer: start / back --- */
function initFooter() {
  document.getElementById('backBtn').addEventListener('click', () => { location.href = './index.html'; });
  document.getElementById('settingsBtn').addEventListener('click', () => console.log('→ settings (not built yet)'));

  document.getElementById('startBtn').addEventListener('click', async () => {
    const name = document.getElementById('leagueName').value.trim();
    if (!name) { document.getElementById('leagueName').focus(); return; }

    const btn = document.getElementById('startBtn');
    btn.disabled = true;
    const label = btn.querySelector('.txt');
    const original = label.textContent;
    label.textContent = 'Creating…';

    try {
      const league = generateLeague({
        leagueName: name, season: state.season,
        teamId: state.teamId, difficulty: state.difficulty,
      });
      // Slug the name for a stable save id; a repeat name overwrites the slot.
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'career';
      await saveLeague(id, league);
      // Remember this as the active career so Continue resumes it, then drop
      // the user straight into the GM dashboard for the league they just made.
      try { localStorage.setItem('activeLeagueId', id); } catch (_) {}
      location.href = './gm-dashboard.html?id=' + encodeURIComponent(id);
    } catch (err) {
      console.error('Failed to create league:', err);
      label.textContent = original;
      btn.disabled = false;
      alert('Could not create the league: ' + err.message);
    }
  });
}

/* ============================== boot ==================================== */
initNameField();
initSeason();
initTeams();
initDifficulty();
initFooter();
