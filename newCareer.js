'use strict';

/**
 * newCareer.js — drives the New Career setup screen and, on "Start Career",
 * generates a full league and saves it through the repo's IndexedDB layer.
 *
 * Setup flow (numbered on screen):
 *   1  League Name + League Preset
 *   2  Season
 *   3  League Structure  → league-structure.html (conferences / divisions / teams)
 *   4  Select Team
 *   5  Difficulty
 *
 * The league being configured lives in the shared draft (leagueConfig.js) so the
 * League Structure screen can edit the same thing. The team you manage and the
 * difficulty stay OUT of presets — the same league can be replayed with a
 * different franchise. All teams and leagues are fictional.
 */

import { saveLeague, listSaves } from './db.js';
import {
  makeRNG, hashString, loadDraft, saveDraft, summaryLine, unassignedTeams,
  listPresets, savePreset, getPreset, renamePreset, deletePreset, applyPreset,
} from './leagueConfig.js';

/* ============================== player generation ============================== */

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
 * Assemble a complete league from the draft. Teams and structure come straight
 * from the draft, so every customisation the player made is preserved.
 */
function generateLeague(cfg) {
  const seed = hashString(`${cfg.leagueName}|${cfg.season}|${cfg.teamId}`);
  const rng = makeRNG(seed);
  const teams = cfg.teams;

  const players = [];
  let idNum = 1;
  for (const team of teams) {
    const quality = team.marketSize === 'Large' ? 68 : team.marketSize === 'Medium' ? 64 : 61;
    for (const pos of POSITIONS) players.push(makePlayer(idNum++, team.id, pos, quality + rng.int(-2, 6), rng));
    for (let i = 0; i < 7; i++) players.push(makePlayer(idNum++, team.id, rng.pick(POSITIONS), quality + rng.int(-8, 2), rng));
  }

  const divById = {};
  for (const d of cfg.structure.divisions) divById[d.id] = d;

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
    // League alignment travels with the save.
    structure: JSON.parse(JSON.stringify(cfg.structure)),
    teams: teams.map((t) => ({
      id: t.id, city: t.city, name: t.name, emoji: t.emoji, color: t.color,
      marketSize: t.marketSize, fanInterest: t.fanInterest, budget: t.budget,
      championships: t.championships || 0,
      divisionId: t.divisionId || null,
      conferenceId: t.divisionId && divById[t.divisionId] ? divById[t.divisionId].conferenceId : null,
    })),
    players,
    freeAgents: [],
    draft: { schemaVersion: 1, class: cfg.season, prospects: [], order: [], completed: false },
    history: { schemaVersion: 1, seasons: [], champions: [], transactions: [], retirements: [] },
  };
}

/* ================================ UI state ================================ */

let draft = loadDraft();
const el = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const persist = () => saveDraft(draft);

/* --- 1. League name --- */
function initNameField() {
  const input = el('leagueName');
  input.value = draft.leagueName;
  const counter = el('nameCounter');
  const update = () => { counter.textContent = `${input.value.length} / ${input.maxLength}`; };
  input.addEventListener('input', () => { draft.leagueName = input.value; persist(); update(); });
  update();
}

/* --- 1b. League preset --- */
async function refreshPresets(selectId) {
  const presets = await listPresets();
  const sel = el('presetSelect');
  sel.innerHTML = '<option value="">Custom League</option>' +
    presets.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  sel.value = selectId != null ? selectId : (draft.presetId || '');
  const chosen = Boolean(sel.value);
  el('presetRename').disabled = !chosen;
  el('presetDelete').disabled = !chosen;
}

function initPresets() {
  const sel = el('presetSelect');

  sel.addEventListener('change', async () => {
    if (!sel.value) {                       // back to a plain custom league
      draft.presetId = null; draft.presetName = 'Custom League'; persist();
      await refreshPresets(''); return;
    }
    const preset = await getPreset(sel.value);
    if (!preset) { await refreshPresets(''); return; }
    applyPreset(draft, preset);             // league config only — team stays yours
    persist();
    el('leagueName').value = draft.leagueName;
    el('nameCounter').textContent = `${draft.leagueName.length} / ${el('leagueName').maxLength}`;
    el('seasonValue').textContent = draft.season;
    renderTeams(); renderStructure();
    await refreshPresets(preset.id);
  });

  el('presetSave').addEventListener('click', async () => {
    const name = prompt('Save this league setup as a preset:\n(e.g. "Modern 30-Team League", "32-Team Expansion")',
      draft.presetName && draft.presetName !== 'Custom League' ? draft.presetName : draft.leagueName);
    if (name == null || !name.trim()) return;
    try {
      const rec = await savePreset(name.trim(), draft);
      draft.presetId = rec.id; draft.presetName = rec.name; persist();
      await refreshPresets(rec.id);
    } catch (err) { alert('Could not save the preset: ' + err.message); }
  });

  el('presetRename').addEventListener('click', async () => {
    const id = el('presetSelect').value; if (!id) return;
    const current = await getPreset(id);
    const name = prompt('Rename preset:', current ? current.name : '');
    if (name == null || !name.trim()) return;
    await renamePreset(id, name.trim());
    draft.presetName = name.trim(); persist();
    await refreshPresets(id);
  });

  el('presetDelete').addEventListener('click', async () => {
    const id = el('presetSelect').value; if (!id) return;
    if (!confirm('Delete this preset? The league setup itself is not affected.')) return;
    await deletePreset(id);
    if (draft.presetId === id) { draft.presetId = null; draft.presetName = 'Custom League'; persist(); }
    await refreshPresets('');
  });

  refreshPresets();
}

/* --- 2. Season --- */
function initSeason() {
  const val = el('seasonValue');
  const MIN = 2024, MAX = 2035;
  const render = () => { val.textContent = draft.season; };
  el('seasonPrev').addEventListener('click', () => { draft.season = Math.max(MIN, draft.season - 1); persist(); render(); });
  el('seasonNext').addEventListener('click', () => { draft.season = Math.min(MAX, draft.season + 1); persist(); render(); });
  render();
}

/* --- 3. League structure --- */
function renderStructure() {
  el('structureSummary').textContent = summaryLine(draft);
  const orphans = unassignedTeams(draft);
  const warn = el('structureWarn');
  warn.hidden = orphans.length === 0;
  warn.textContent = orphans.length
    ? `${orphans.length} team${orphans.length === 1 ? ' is' : 's are'} not assigned to a division yet.`
    : '';
}
function initStructure() {
  el('structureBtn').addEventListener('click', () => {
    persist();                                  // hand the draft to the editor
    location.href = './league-structure.html';
  });
  renderStructure();
}

/* --- 4. Select team --- */
function crestHTML(team) {
  return `<div style="width:100%;height:100%;border-radius:50%;display:grid;place-items:center;
    background:${esc(team.color || '#33506e')};font-size:1.7rem;box-shadow:0 0 0 3px rgba(255,255,255,0.08) inset;">${team.emoji || '🏀'}</div>`;
}
function renderTeams() {
  const track = el('teamTrack');
  el('teamCount').textContent = `${draft.teams.length} TEAMS`;
  if (!draft.teams.some((t) => t.id === draft.teamId)) {
    draft.teamId = draft.teams[0] ? draft.teams[0].id : null;
  }
  track.innerHTML = draft.teams.map((t) => `
    <div class="team-card${t.id === draft.teamId ? ' is-selected' : ''}" data-team="${esc(t.id)}" role="button" tabindex="0">
      <span class="star" aria-hidden="true">★</span>
      <div class="logo">${crestHTML(t)}</div>
      <div class="city">${esc(t.city)}</div>
      <div class="team">${esc(t.name)}</div>
      <div class="stats">
        <div class="row"><span>Market Size</span><b>${esc(t.marketSize)}</b></div>
        <div class="row"><span>Fan Interest</span><b>${esc(t.fanInterest)}</b></div>
        <div class="row"><span>Budget</span><b>$${Number(t.budget).toFixed(1)}M</b></div>
      </div>
    </div>`).join('');
  renderDots();
}
function selectTeam(id) {
  draft.teamId = id; persist();
  document.querySelectorAll('.team-card').forEach((c) =>
    c.classList.toggle('is-selected', c.dataset.team === id));
}
function initTeams() {
  const track = el('teamTrack');
  renderTeams();
  track.addEventListener('click', (e) => {
    const card = e.target.closest('.team-card'); if (card) selectTeam(card.dataset.team);
  });
  track.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.team-card');
    if (card) { e.preventDefault(); selectTeam(card.dataset.team); }
  });
  const step = 170 * 2;
  el('teamPrev').addEventListener('click', () => track.scrollBy({ left: -step }));
  el('teamNext').addEventListener('click', () => track.scrollBy({ left: step }));
  track.addEventListener('scroll', () => window.requestAnimationFrame(renderDots));
  window.addEventListener('resize', renderDots);
}
function renderDots() {
  const track = el('teamTrack'), dotsEl = el('teamDots');
  const pages = Math.max(1, Math.ceil(track.scrollWidth / Math.max(1, track.clientWidth)));
  const active = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
  dotsEl.innerHTML = Array.from({ length: pages }, (_, i) =>
    `<span class="dot${i === active ? ' active' : ''}" data-page="${i}"></span>`).join('');
}
el('teamDots').addEventListener('click', (e) => {
  const dot = e.target.closest('.dot'); if (!dot) return;
  const track = el('teamTrack');
  track.scrollTo({ left: dot.dataset.page * track.clientWidth });
});

/* --- 5. Difficulty --- */
function initDifficulty() {
  const cards = document.querySelectorAll('.diff-card');
  cards.forEach((c) => c.classList.toggle('is-selected', c.dataset.diff === draft.difficulty));
  cards.forEach((card) => card.addEventListener('click', () => {
    draft.difficulty = card.dataset.diff; persist();
    cards.forEach((c) => c.classList.toggle('is-selected', c === card));
  }));
}

/* --- Footer --- */
function initFooter() {
  el('backBtn').addEventListener('click', () => { location.href = './index.html'; });
  el('settingsBtn').addEventListener('click', () => console.log('→ settings (not built yet)'));

  el('startBtn').addEventListener('click', async () => {
    const name = el('leagueName').value.trim();
    if (!name) { el('leagueName').focus(); return; }
    if (draft.teams.length < 2) { alert('A league needs at least two teams. Add some in League Structure.'); return; }
    if (!draft.teamId) { alert('Choose a team to manage first.'); return; }

    const btn = el('startBtn');
    btn.disabled = true;
    const label = btn.querySelector('.txt');
    const original = label.textContent;
    label.textContent = 'Creating…';

    try {
      draft.leagueName = name;
      const league = generateLeague(draft);
      // Every career gets its OWN save slot; suffix if the slug is taken.
      const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'career';
      const taken = new Set(await listSaves());
      let id = base;
      for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
      await saveLeague(id, league);
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

/* ================================ boot ================================ */
initNameField();
initPresets();
initSeason();
initStructure();
initTeams();
initDifficulty();
initFooter();
