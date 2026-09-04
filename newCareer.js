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
import { makeName } from './nameCultures.js';
import { makeMental } from './playerMental.js';
import { makePersonality } from './playerPersonality.js';
import { loadSettings, generationTuning } from './gameSettings.js';
import { autoChart } from './depthChart.js';
import { makeRoster, pickTeamArchetype } from './playerGen.js';
import {
  makeRNG, hashString, loadDraft, saveDraft, summaryLine, unassignedTeams,
  listPresets, savePreset, getPreset, renamePreset, deletePreset, applyPreset,
  crestHTML, marketOf, teamColors,
} from './leagueConfig.js';

/* ============================== player generation ============================== */


/* Every economic rule now comes from the Settings screen (gameSettings.js):
   the cap, the payroll floor, cap type, salaries, contract lengths and roster
   size. Nothing about league finances is hard-coded here any more. */
/**
 * Pick a name nobody in the league already has, drawn from the naming
 * tradition his origin gave him (nameCultures.js). With ~360 players,
 * collisions are otherwise a certainty — the old single-pool generator
 * produced 95 duplicates in a 360-player league, four players deep in places,
 * which made a name a useless way to identify anyone.
 *
 * Retries stay INSIDE the player's own culture. Reaching for a different
 * culture's pool just to dodge a collision would be the one thing this system
 * exists to prevent, so the last resort is a middle initial instead.
 */
function uniqueName(rng, used, origin) {
  for (let i = 0; i < 60; i++) {
    const n = makeName(rng, origin);
    if (!used.has(n)) { used.add(n); return n; }
  }
  // Exhausted the culture's combinations: distinguish with a middle initial
  // rather than give up or leave the tradition.
  const base = makeName(rng, origin);
  const parts = base.split(' ');
  for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    // Insert before the surname, which is the last token even when the name
    // carries a particle ("Le Blanc") or a second surname.
    const n = [parts[0], `${c}.`, ...parts.slice(1)].join(' ');
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
function makePlayer(idNum, teamId, rated, rng, startSeason, usedNames, cfg) {
  // The frame came out of the talent system, which drew it BEFORE the ratings
  // so the ratings could be built around it. The bio reports it rather than
  // rolling a second, unrelated body.
  const bio = makeBio(rng, {
    position: rated.position, age: rated.age, startSeason,
    // Recruiting weighting only — how highly he was rated coming out, which
    // nudges which programme took him. College never feeds back into a rating.
    overall: rated.overall,
    heightIn: rated.heightIn, weightLb: rated.weightLb,
  });
  // Personality first: it feeds the mental tilt, and priorities are derived
  // from the traits plus his age and standing.
  const personality = cfg.personalityTraits
    ? makePersonality(rng, { age: rated.age, overall: rated.overall })
    : null;
  // A layer switched off is ABSENT, not zeroed — and switching one off cannot
  // change anybody's rating, because overall never reads these fields.
  if (personality && !cfg.dynamicPriorities) delete personality.priorities;
  return {
    id: `p_${String(idNum).padStart(4, '0')}`,
    // The name comes from the bio: birthplace and naming tradition are one
    // draw, so a Bamako-born player is not handed an unrelated name.
    name: uniqueName(rng, usedNames, bio),
    position: rated.position,
    // Derived from his actual attributes and size, never rolled — see
    // secondaryPosition() in playerGen.js. Null when nothing else fits.
    secondaryPosition: rated.secondaryPosition,
    age: rated.age,
    teamId,
    // Bio is generated HERE and stored in the save, so the profile screen
    // reads real saved fields instead of inventing anything at render time.
    ...bio,
    ...(cfg.playerMorale ? {} : { morale: undefined }),
    attributes: rated.attributes,
    // Mental ratings live in their own field, NOT in `attributes`. That is
    // what keeps them out of overall: computeOverall iterates the ability
    // categories over `attributes` and cannot reach here.
    mental: cfg.mentalAttributes
      ? makeMental(rng, { age: rated.age, traits: (personality && personality.traits) || [] })
      : null,
    // Layer three, in its own field for the same reason as `mental`:
    // computeOverall() cannot see it. Traits are who he is; priorities are
    // what currently matters to him, derived rather than frozen.
    personality,
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
function rawValue(overall, maxSalary) {
  const t = Math.max(0, (overall - 55) / 40);
  return Math.pow(Math.min(1, t), 2.2) * maxSalary;
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
function assignContracts(players, teams, rng, rules) {
  const minSalary = rules.minSalary;
  const maxSalary = rules.maxSalary;
  const minYears = rules.minContractLength;
  const maxYears = rules.maxContractLength;
  const cap = rules.salaryCap;

  // What the cap type means for where a generated payroll may land.
  //   Hard  — the line cannot be crossed, so nobody starts over it.
  //   Soft  — teams may sit a little over, as real clubs do.
  //   None  — there is no line, so spending spreads much wider.
  const band = {
    Hard: { mean: 0.84, sd: 0.09, lo: 0.55, hi: 1.0 },
    Soft: { mean: 0.88, sd: 0.10, lo: 0.62, hi: 1.05 },
    None: { mean: 0.92, sd: 0.18, lo: 0.45, hi: 1.45 },
  }[rules.salaryCapType] || { mean: 0.88, sd: 0.10, lo: 0.62, hi: 1.05 };

  // The payroll floor is a share of the cap too, so it survives a cap change.
  const floorShare = cap > 0 ? Math.min(band.hi, rules.minPayroll / cap) : 0;

  for (const team of teams) {
    const roster = players.filter((p) => p.teamId === team.id);
    if (!roster.length) continue;

    const raw = roster.map((p) => rawValue(p.overall, maxSalary));
    const rawTotal = raw.reduce((a, b) => a + b, 0) || 1;
    // Where this club lands, within the band its cap type allows and never
    // below the league's payroll floor.
    const targetShare = Math.max(Math.max(band.lo, floorShare),
      Math.min(band.hi, rng.gauss(band.mean, band.sd)));
    const scale = (cap * targetShare) / rawTotal;

    roster.forEach((p, i) => {
      const salary = Math.min(maxSalary,
        Math.max(minSalary, Math.round(raw[i] * scale * 10) / 10));
      // Better players and prime-age players get longer deals; nobody old or
      // marginal is signed long. One season is always the floor, which is why
      // there is no minimum-length setting.
      // Clamp every draw into [minContractLength, maxContractLength].
      const yr = (lo, hi) => rng.int(
        Math.max(minYears, Math.min(maxYears, lo)),
        Math.max(minYears, Math.min(maxYears, hi)));
      const long = p.overall >= 80 && p.age <= 31;
      const years = p.age >= 34 ? yr(1, 2)
        : long ? yr(2, 5)
        : p.overall >= 70 ? yr(1, 4)
        : yr(1, 3);
      const type = salary >= maxSalary * 0.6 ? 'max'
        : salary <= minSalary * 1.4 ? 'vet_min'
        : (p.age <= 22 && years >= 2) ? 'rookie'
        : 'standard';
      p.contract = {
        salary, yearsRemaining: years, type,
        playerOption: years >= 2 && rng.next() < 0.10,
        teamOption: years >= 2 && rng.next() < 0.09,
      };
    });

    // Per-player rounding to $0.1M and the min/max clamps each nudge the total,
    // so a roster aimed at the floor could still land a fraction under it —
    // measured at $125.8M against a $126M floor. Top the shortfall up on the
    // best-paid players who still have room, so the floor is a floor.
    if (rules.minPayroll > 0) {
      let total = roster.reduce((s, p) => s + p.contract.salary, 0);
      const order = [...roster].sort((a, b) => b.contract.salary - a.contract.salary);
      for (const p of order) {
        if (total >= rules.minPayroll - 0.001) break;
        const room = maxSalary - p.contract.salary;
        if (room <= 0) continue;
        const add = Math.min(room, Math.ceil((rules.minPayroll - total) * 10) / 10);
        p.contract.salary = Math.round((p.contract.salary + add) * 10) / 10;
        total += add;
      }
    }
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

  // Every rule the player set on the Settings screen enters generation here.
  const rules = loadSettings();
  const tuning = generationTuning(rules);
  // Fill to one below the maximum so a roster spot stays open for signings.
  const rosterSize = Math.max(rules.minRosterSize, rules.maxRosterSize - 1);

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
    for (const rated of makeRoster(rng, key, rosterSize, tuning)) {
      players.push(makePlayer(idNum++, team.id, rated, rng, cfg.season, usedNames, rules));
    }
  }
  assignContracts(players, teams, rng, rules);

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
      // The rules this league was generated under travel with the save, so a
      // career keeps playing by the settings it was created with. salaryCap is
      // one of them now, so nothing separate needs setting here.
      ...rules,
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
      marketSize: marketOf(t), fanInterest: t.fanInterest,
      budget: rules.teamBudgets ? t.budget : null,
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
  el('settingsBtn').addEventListener('click', () => { location.href = './settings.html'; });

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
