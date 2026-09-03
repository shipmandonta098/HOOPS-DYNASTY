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
import { makeBio } from './playerBio.js';
import { makeMental } from './playerMental.js';
import { autoChart } from './depthChart.js';
import { makeRoster, pickTeamArchetype } from './playerGen.js';
import {
  makeRNG, hashString, loadDraft, saveDraft, summaryLine, unassignedTeams,
  listPresets, savePreset, getPreset, renamePreset, deletePreset, applyPreset,
  crestHTML, marketOf, teamColors,
} from './leagueConfig.js';

/* ============================== player generation ============================== */


/* League economics. settings.salaryCap below reads from these, so the numbers
   the contracts were built against are the numbers the league is played with. */
const SALARY_CAP = 140;      // $M
const MIN_SALARY = 1.1;      // $M
const MAX_SALARY = 50;       // $M — what a 99-overall commands
const ROSTER_SIZE = 14;      // of maxRosterSize 15, leaving a spot open
const FIRST = ['James', 'Marcus', 'Tyrese', 'DeAndre', 'Jalen', 'Cam', 'Isaiah', 'Malik',
  'Trey', 'Devin', 'Zion', 'Jaylen', 'Brandon', 'Darius', 'Keegan', 'Obi', 'Xavier',
  'Jordan', 'Quentin', 'Terrence', 'Cason', 'Julian', 'Bilal', 'Kel', 'Deni', 'Santi',
  'Amari', 'Corey', 'Dante', 'Elias', 'Filip', 'Gabe', 'Hakim', 'Idris', 'Jonas',
  'Kofi', 'Lonzo', 'Micah', 'Nikola', 'Omar', 'Pierre', 'Rashad', 'Sekou', 'Tobias',
  'Uche', 'Vince', 'Wes', 'Yannick', 'Zane', 'Andre', 'Bruno', 'Caleb', 'Damir',
  'Emeka', 'Frank', 'Goran', 'Hugo', 'Ivan', 'Jamal', 'Kristaps'];
const LAST = ['Carter', 'Robinson', 'Mitchell', 'Thompson', 'Edwards', 'Hayes', 'Foster',
  'Coleman', 'Reeves', 'Miller', 'Wallace', 'Walker', 'Vincent', 'Sharpe', 'Duren',
  'Sanders', 'Bryant', 'Ellison', 'Brooks', 'Freeman', 'Howard', 'Nowell', 'Prosper',
  'Abara', 'Bogdan', 'Castillo', 'Dempsey', 'Ferreira', 'Gallagher', 'Haywood',
  'Ibrahim', 'Jankovic', 'Keita', 'Larsen', 'Mensah', 'Novak', 'Okafor', 'Petrov',
  'Quintero', 'Ramsey', 'Sokolov', 'Traore', 'Underwood', 'Vasquez', 'Whitfield',
  'Yates', 'Zielinski', 'Ashford', 'Barnett', 'Cross', 'Dunlap', 'Everett'];

/**
 * Pick a name nobody in the league already has. With ~360 players drawn from
 * a few thousand combinations, collisions are otherwise a certainty — the old
 * pools produced 95 duplicates in a 360-player league, four players deep in
 * places, which made a name a useless way to identify anyone.
 */
function uniqueName(rng, used) {
  for (let i = 0; i < 40; i++) {
    const n = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
    if (!used.has(n)) { used.add(n); return n; }
  }
  // Exhausted the pool: distinguish with a middle initial rather than give up.
  const base = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
  for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    const [f, l] = base.split(' ');
    const n = `${f} ${c}. ${l}`;
    if (!used.has(n)) { used.add(n); return n; }
  }
  used.add(base);
  return base;
}

/**
 * Wrap a generated rating profile (playerGen.js) into a full player record:
 * identity, biography, contract. The ratings themselves — attributes, overall,
 * potential, age, archetype, durability — come from the talent system, which
 * owns the distribution and the archetype shaping.
 */
function makePlayer(idNum, teamId, rated, rng, startSeason, usedNames, cap) {
  const bio = makeBio(rng, { position: rated.position, age: rated.age, startSeason });
  return {
    id: `p_${String(idNum).padStart(4, '0')}`,
    name: uniqueName(rng, usedNames),
    position: rated.position,
    age: rated.age,
    teamId,
    // Bio is generated HERE and stored in the save, so the profile screen
    // reads real saved fields instead of inventing anything at render time.
    ...bio,
    attributes: rated.attributes,
    // Mental ratings live in their own field, NOT in `attributes`. That is
    // what keeps them out of overall: computeOverall iterates the ability
    // categories over `attributes` and cannot reach here.
    mental: makeMental(rng, { age: rated.age, personality: bio.personality }),
    overall: rated.overall,
    potential: rated.potential,
    // Archetype travels with the player: it is what the ratings were shaped
    // around, so the profile can name it rather than infer it back.
    archetype: rated.archetype,
    archetypeLabel: rated.archetypeLabel,
    durability: rated.durability,
    contract: null,   // filled in by the payroll pass, which respects the cap
    statsHistory: [],
  };
}

/**
 * Price a player. Superlinear in overall, because pay in a capped league is
 * not linear in ability — the difference between 85 and 90 costs far more than
 * the difference between 65 and 70.
 */
function rawValue(overall) {
  const t = Math.max(0, (overall - 55) / 40);
  return Math.pow(Math.min(1, t), 2.2) * MAX_SALARY;
}

/**
 * Give every player a contract, with each team's payroll landing somewhere
 * sensible against the cap.
 *
 * The old generator priced players independently and produced ~$185M payrolls
 * against a $140M cap — every team $45M over, which made cap space meaningless.
 * Here each roster is priced on the curve above and then scaled as a block to
 * a target share of the cap, so teams differ in how tight they are: most have
 * room, a few are pressed right up against it, and the odd contender is a
 * little over.
 */
function assignContracts(players, teams, rng, cap) {
  for (const team of teams) {
    const roster = players.filter((p) => p.teamId === team.id);
    if (!roster.length) continue;

    const raw = roster.map((p) => rawValue(p.overall));
    const rawTotal = raw.reduce((a, b) => a + b, 0) || 1;
    // Most teams sit under the cap; a few go over, as real clubs do.
    const targetShare = Math.max(0.62, Math.min(1.05, rng.gauss(0.88, 0.10)));
    const scale = (cap * targetShare) / rawTotal;

    roster.forEach((p, i) => {
      const salary = Math.max(MIN_SALARY, Math.round(raw[i] * scale * 10) / 10);
      // Better players and prime-age players get longer deals; nobody old or
      // marginal is signed long.
      const long = p.overall >= 80 && p.age <= 31;
      const years = p.age >= 34 ? rng.int(1, 2)
        : long ? rng.int(2, 5)
        : p.overall >= 70 ? rng.int(1, 4)
        : rng.int(1, 3);
      const type = salary >= MAX_SALARY * 0.6 ? 'max'
        : salary <= MIN_SALARY * 1.4 ? 'vet_min'
        : (p.age <= 22 && years >= 2) ? 'rookie'
        : 'standard';
      p.contract = {
        salary, yearsRemaining: years, type,
        playerOption: years >= 2 && rng.next() < 0.10,
        teamOption: years >= 2 && rng.next() < 0.09,
      };
    });
  }
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
  const usedNames = new Set();
  const teamArchetypes = {};
  let idNum = 1;
  for (const team of teams) {
    // Each club draws its own build — contender, deep, young, rebuilding and
    // so on — so rosters differ in kind, not just in luck. Market size nudges
    // the odds without deciding them.
    const key = pickTeamArchetype(rng, marketOf(team));
    teamArchetypes[team.id] = key;
    for (const rated of makeRoster(rng, key, ROSTER_SIZE)) {
      players.push(makePlayer(idNum++, team.id, rated, rng, cfg.season, usedNames));
    }
  }
  assignContracts(players, teams, rng, SALARY_CAP);

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
      salaryCap: SALARY_CAP, minSalary: MIN_SALARY, maxRosterSize: 15,
      meetingsPerMatchup: 4, draftClassSize: 18, playoffTeams: 8,
      difficulty: cfg.difficulty,
    },
    // League alignment travels with the save.
    structure: JSON.parse(JSON.stringify(cfg.structure)),
    teams: teams.map((t) => ({
      id: t.id, city: t.city, name: t.name, emoji: t.emoji,
      // Seeded best-first; the Depth Chart tab reorders it from here.
      depthChart: autoChart(players.filter((p) => p.teamId === t.id)),
      colors: teamColors(t),
      color: teamColors(t).primary,          // legacy single colour
      logoPrimary: t.logoPrimary || null,
      logoSecondary: t.logoSecondary || null,
      population: t.population != null ? t.population : null,
      marketSize: marketOf(t), fanInterest: t.fanInterest, budget: t.budget,
      championships: t.championships || 0,
      divisionId: t.divisionId || null,
      conferenceId: t.divisionId && divById[t.divisionId] ? divById[t.divisionId].conferenceId : null,
    })),
    players,
    freeAgents: [],
    // Append-only record of roster moves. Empty until something actually
    // happens — the Roster Moves tab reports it, it never invents entries.
    transactions: [],
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
function renderTeams() {
  const track = el('teamTrack');
  el('teamCount').textContent = `${draft.teams.length} TEAMS`;
  if (!draft.teams.some((t) => t.id === draft.teamId)) {
    draft.teamId = draft.teams[0] ? draft.teams[0].id : null;
  }
  track.innerHTML = draft.teams.map((t) => `
    <div class="team-card${t.id === draft.teamId ? ' is-selected' : ''}" data-team="${esc(t.id)}" role="button" tabindex="0">
      <span class="star" aria-hidden="true">★</span>
      <div class="logo">${crestHTML(t, 50)}</div>
      <div class="city">${esc(t.city)}</div>
      <div class="team">${esc(t.name)}</div>
      <div class="stats">
        <div class="row"><span>Market Size</span><b>${esc(marketOf(t))}</b></div>
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
