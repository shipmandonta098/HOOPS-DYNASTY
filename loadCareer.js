'use strict';

/**
 * loadCareer.js — the Load Career screen.
 *
 * Reads saved leagues from the IndexedDB layer (db.js), renders them as a
 * table, and wires up per-save actions: load, delete, export (download JSON),
 * rename, plus Import File to bring a save in from disk.
 *
 * Each row is derived from a saved league object (see saves/example_league.json
 * / newCareer.js): meta.leagueName, the user's team (meta.userTeamId), the
 * current phase, meta.createdAt, and the save's updatedAt ("last played").
 */

import { listSavesDetailed, loadLeague, deleteSave, saveLeague } from './db.js';

/* ------------------------------- helpers ------------------------------- */

/** Format an ISO timestamp into { date, time } like "May 12, 2026" / "10:42 AM". */
function fmt(iso) {
  const d = new Date(iso);
  if (!iso || isNaN(d.getTime())) return { date: '—', time: '' };
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
}

/** Initials for a league badge, e.g. "National Basketball League" -> "NBL". */
function initials(name) {
  const words = String(name || '').split(/\s+/).filter(Boolean);
  let s = words.map((w) => w[0]).join('').toUpperCase();
  if (s.length > 3) s = s.slice(0, 3);
  if (s.length < 2) s = String(name || '?').slice(0, 3).toUpperCase();
  return s;
}

/** Stable-ish hue from a string, for varying league badge colors. */
function hue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}

/** Phase -> display config: label, accent color, icon, and a sub-line. */
function phaseInfo(phase, season) {
  const ICONS = {
    calendar: '<path d="M7 2v3M17 2v3M3 8h18M4 5h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="2"/>',
    trophy: '<path d="M6 4h12v2h3v2a4 4 0 0 1-4 4h-.6A6 6 0 0 1 13 15.7V18h3v2H8v-2h3v-2.3A6 6 0 0 1 6.6 12H6a4 4 0 0 1-4-4V6h3V4z" fill="currentColor"/>',
    clipboard: '<path d="M9 3h6v2h3v16H6V5h3V3zm0 6h6M9 13h6M9 17h4" fill="none" stroke="currentColor" stroke-width="2"/>',
  };
  const map = {
    regular_season: { label: 'Regular Season', color: 'var(--green)', icon: ICONS.calendar, sub: season ? `${season} Season` : 'In progress' },
    playoffs:       { label: 'Playoffs',       color: 'var(--red-hi)', icon: ICONS.trophy,   sub: 'Postseason' },
    finals:         { label: 'Finals',         color: 'var(--orange)', icon: ICONS.trophy,   sub: 'Championship' },
    offseason:      { label: 'Offseason',      color: 'var(--blue)',   icon: ICONS.clipboard, sub: 'Between seasons' },
    draft:          { label: 'Draft',          color: 'var(--blue)',   icon: ICONS.clipboard, sub: 'Draft night' },
    free_agency:    { label: 'Free Agency',    color: 'var(--blue)',   icon: ICONS.clipboard, sub: 'Signings open' },
  };
  return map[phase] || map.regular_season;
}

/** Build a view-model row from a saved league. */
function toRow(id, league, updatedAt) {
  const meta = league.meta || {};
  const teams = league.teams || [];
  const team = teams.find((t) => t.id === meta.userTeamId) || teams[0] || {};
  return {
    id,
    league,
    leagueName: meta.leagueName || id,
    team,
    phase: meta.currentPhase || 'regular_season',
    season: meta.currentSeason,
    createdAt: meta.createdAt,
    lastPlayed: updatedAt,
  };
}

/** Read every save and turn it into a row VM, newest-played first. */
async function fetchRows() {
  const metas = await listSavesDetailed(); // [{ id, updatedAt }]
  const rows = [];
  for (const m of metas) {
    const league = await loadLeague(m.id);
    if (league) rows.push(toRow(m.id, league, m.updatedAt));
  }
  rows.sort((a, b) => String(b.lastPlayed || '').localeCompare(String(a.lastPlayed || '')));
  return rows;
}

/* ------------------------------- rendering ------------------------------- */

let rows = [];
let selectedId = null;

function rowHTML(r) {
  const created = fmt(r.createdAt);
  const played = fmt(r.lastPlayed);
  const p = phaseInfo(r.phase, r.season);
  const badgeHue = hue(r.leagueName);
  const badgeBg = `linear-gradient(160deg, hsl(${badgeHue} 45% 32%), hsl(${badgeHue} 55% 18%))`;
  const crestBg = r.team.color || '#33506e';
  const emoji = r.team.emoji || '🏀';
  const city = r.team.city || 'Unknown';
  const name = (r.team.name || 'Team').toUpperCase();

  return `
    <div class="save-row${r.id === selectedId ? ' is-selected' : ''}" data-id="${r.id}" role="button" tabindex="0">
      <div class="cell league" data-label="League">
        <span class="league-badge" style="background:${badgeBg}">${initials(r.leagueName)}</span>
        <span class="league-name">${escapeHTML(r.leagueName)}</span>
      </div>
      <div class="cell team" data-label="Team">
        <span class="crest" style="background:${crestBg}">${emoji}</span>
        <span><span class="team-city">${escapeHTML(city)}</span><span class="team-name">${escapeHTML(name)}</span></span>
      </div>
      <div class="cell phase" data-label="Phase">
        <span>
          <span class="phase-label" style="color:${p.color}"><svg viewBox="0 0 24 24">${p.icon}</svg>${p.label}</span>
          <span class="phase-sub">${p.sub}</span>
        </span>
      </div>
      <div class="cell created" data-label="Date Created"><span>${created.date}</span><span class="t">${created.time}</span></div>
      <div class="cell played" data-label="Last Played"><span>${played.date}</span><span class="t">${played.time}</span></div>
      <div class="cell menu"><button class="menu-btn" aria-label="Save options" data-menu="${r.id}">&#8943;</button></div>
    </div>`;
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function render() {
  const host = document.getElementById('rows');
  if (rows.length === 0) {
    host.innerHTML = `
      <div class="empty">
        <h2>No saved careers</h2>
        <p>Start one from <a href="./new-career.html">New Career</a>, or use Import File.</p>
      </div>`;
  } else {
    host.innerHTML = rows.map(rowHTML).join('');
  }
  document.getElementById('deleteBtn').disabled = !selectedId;
}

/* ------------------------------- actions ------------------------------- */

function select(id) {
  selectedId = id;
  document.querySelectorAll('.save-row').forEach((el) =>
    el.classList.toggle('is-selected', el.dataset.id === id));
  document.getElementById('deleteBtn').disabled = !selectedId;
}

/** "Load" a save — no game screen yet, so remember the choice and inform. */
function loadSave(id) {
  try { localStorage.setItem('activeLeagueId', id); } catch (_) {}
  const r = rows.find((x) => x.id === id);
  alert(`Loading "${r ? r.leagueName : id}"…\n(The in-game screen isn't built yet — this is where it will open.)`);
}

async function removeSave(id) {
  const r = rows.find((x) => x.id === id);
  if (!confirm(`Delete "${r ? r.leagueName : id}"? This can't be undone.`)) return;
  await deleteSave(id);
  if (selectedId === id) selectedId = null;
  rows = rows.filter((x) => x.id !== id);
  render();
}

function exportSave(id) {
  const r = rows.find((x) => x.id === id);
  if (!r) return;
  const blob = new Blob([JSON.stringify(r.league, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${id}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function renameSave(id) {
  const r = rows.find((x) => x.id === id);
  if (!r) return;
  const next = prompt('Rename league:', r.leagueName);
  if (next == null) return;
  const name = next.trim();
  if (!name) return;
  r.league.meta = r.league.meta || {};
  r.league.meta.leagueName = name;
  await saveLeague(id, r.league); // same id, updated display name
  r.leagueName = name;
  render();
}

async function importFile(file) {
  try {
    const text = await file.text();
    const league = JSON.parse(text);
    if (!league || typeof league !== 'object' || !league.meta || !Array.isArray(league.teams)) {
      throw new Error('That file does not look like a Hoops Dynasty save.');
    }
    const base = (league.meta.leagueName || 'imported')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'imported';
    // Avoid clobbering an existing id.
    let id = base;
    const existing = new Set(rows.map((r) => r.id));
    let n = 2;
    while (existing.has(id)) id = `${base}-${n++}`;
    await saveLeague(id, league);
    await refresh();
    select(id);
  } catch (err) {
    alert('Import failed: ' + err.message);
  }
}

async function refresh() {
  rows = await fetchRows();
  if (selectedId && !rows.some((r) => r.id === selectedId)) selectedId = null;
  render();
}

/* ------------------------------- menu popover ------------------------------- */

function openMenu(id, btn) {
  const menu = document.getElementById('rowMenu');
  menu.dataset.id = id;
  menu.hidden = false;
  const r = btn.getBoundingClientRect();
  // Align the menu's right edge under the button, opening downward.
  const w = menu.offsetWidth;
  let left = window.scrollX + r.right - w;
  let top = window.scrollY + r.bottom + 6;
  // Flip above if it would run off the bottom.
  if (r.bottom + menu.offsetHeight + 10 > window.innerHeight) {
    top = window.scrollY + r.top - menu.offsetHeight - 6;
  }
  menu.style.left = Math.max(8, left) + 'px';
  menu.style.top = top + 'px';
}
function closeMenu() {
  const menu = document.getElementById('rowMenu');
  menu.hidden = true;
  menu.dataset.id = '';
}

/* ------------------------------- wiring ------------------------------- */

function init() {
  // Row interactions (event-delegated).
  const host = document.getElementById('rows');
  host.addEventListener('click', (e) => {
    const menuBtn = e.target.closest('.menu-btn');
    if (menuBtn) {
      e.stopPropagation();
      const id = menuBtn.dataset.menu;
      select(id);
      const menu = document.getElementById('rowMenu');
      if (!menu.hidden && menu.dataset.id === id) closeMenu();
      else openMenu(id, menuBtn);
      return;
    }
    const row = e.target.closest('.save-row');
    if (row) select(row.dataset.id);
  });
  host.addEventListener('dblclick', (e) => {
    const row = e.target.closest('.save-row');
    if (row) loadSave(row.dataset.id);
  });
  host.addEventListener('keydown', (e) => {
    const row = e.target.closest('.save-row');
    if (!row) return;
    if (e.key === 'Enter') { e.preventDefault(); loadSave(row.dataset.id); }
  });

  // Row menu actions.
  document.getElementById('rowMenu').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = document.getElementById('rowMenu').dataset.id;
    closeMenu();
    if (btn.dataset.act === 'delete') removeSave(id);
    else if (btn.dataset.act === 'export') exportSave(id);
    else if (btn.dataset.act === 'rename') renameSave(id);
  });

  // Close the menu on any outside click / escape / scroll.
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#rowMenu') && !e.target.closest('.menu-btn')) closeMenu();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('scroll', closeMenu, true);

  // Import file.
  const fileInput = document.getElementById('fileInput');
  document.getElementById('importBtn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) importFile(fileInput.files[0]);
    fileInput.value = '';
  });

  // Footer.
  document.getElementById('backBtn').addEventListener('click', () => { location.href = './index.html'; });
  document.getElementById('deleteBtn').addEventListener('click', () => { if (selectedId) removeSave(selectedId); });
  document.getElementById('manageBtn').addEventListener('click', () => {
    alert('Saves live in your browser (IndexedDB). Use the ⋯ menu on a row to export a backup, or Import File to restore one.');
  });

  refresh();
}

init();
