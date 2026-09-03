'use strict';

/**
 * leagueStructure.js — the League Structure editor.
 *
 * Edits the shared league draft (leagueConfig.js) that the New Career screen
 * hands over: conferences, divisions, alignment and the team list itself.
 * Changes are held in memory and only written back to the draft on "Save
 * Structure", so Back discards. All teams and leagues are fictional.
 */

import {
  loadDraft, saveDraft, newDraft, summaryLine, unassignedTeams,
  newConference, newDivision, newTeamId, autoAlign, teamLibrary,
  EMOJI_CHOICES, FANS, crestHTML, teamColors, marketOf,
  lookupCity, readLogoFile,
} from './leagueConfig.js';

/* Working copy — Back leaves the stored draft untouched. */
let draft = JSON.parse(JSON.stringify(loadDraft()));
let editingTeamId = null;   // null while creating a new team

const el = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const divisionsOf = (confId) => draft.structure.divisions.filter((d) => d.conferenceId === confId);
const teamsIn = (divId) => draft.teams.filter((t) => t.divisionId === divId);
const teamsInConf = (confId) => {
  const ids = new Set(divisionsOf(confId).map((d) => d.id));
  return draft.teams.filter((t) => ids.has(t.divisionId));
};

/* ------------------------------- rendering ------------------------------- */

function divisionOptions(selectedId) {
  let out = `<option value=""${!selectedId ? ' selected' : ''}>— Unassigned —</option>`;
  for (const c of draft.structure.conferences) {
    out += `<optgroup label="${esc(c.name)}">`;
    for (const d of divisionsOf(c.id)) {
      out += `<option value="${d.id}"${d.id === selectedId ? ' selected' : ''}>${esc(d.name)}</option>`;
    }
    out += '</optgroup>';
  }
  return out;
}

function chipHTML(t, unassigned) {
  return `<div class="chip${unassigned ? ' is-unassigned' : ''}" data-team="${t.id}">
    ${crestHTML(t, 28)}
    <span class="who"><span class="c">${esc(t.city || '')}</span><span class="n">${esc(t.name || '')}</span></span>
    <select class="move" aria-label="Move ${esc(t.name)}">${divisionOptions(t.divisionId)}</select>
    <span class="chip-actions">
      <button class="icon-btn" data-act="edit-team" title="Edit team">✎</button>
      <button class="icon-btn danger" data-act="remove-team" title="Remove from league">✕</button>
    </span>
  </div>`;
}

function render() {
  el('summary').textContent = summaryLine(draft);

  // Unassigned teams get their own flagged panel.
  const orphans = unassignedTeams(draft);
  el('unassignedPanel').hidden = orphans.length === 0;
  el('unassignedCount').textContent = `${orphans.length} TEAM${orphans.length === 1 ? '' : 'S'}`;
  el('unassignedList').innerHTML = orphans.map((t) => chipHTML(t, true)).join('');

  const confs = draft.structure.conferences;
  el('emptyNote').hidden = confs.length > 0;
  el('conferences').innerHTML = confs.map((c, ci) => {
    const divs = divisionsOf(c.id);
    return `<section class="conf" data-conf="${c.id}">
      <div class="conf-head">
        <span class="cname">${esc(c.name)}</span>
        <span class="ccount">${teamsInConf(c.id).length} teams · ${divs.length} divisions</span>
        <span class="row-actions">
          <button class="icon-btn" data-act="conf-up" ${ci === 0 ? 'disabled' : ''} title="Move up">▲</button>
          <button class="icon-btn" data-act="conf-down" ${ci === confs.length - 1 ? 'disabled' : ''} title="Move down">▼</button>
          <button class="icon-btn" data-act="conf-rename" title="Rename">✎</button>
          <button class="icon-btn" data-act="add-div" title="Add division">+ Div</button>
          <button class="icon-btn danger" data-act="conf-delete" title="Delete conference">✕</button>
        </span>
      </div>
      ${divs.map((d, di) => {
        const dt = teamsIn(d.id);
        return `<div class="div" data-div="${d.id}">
          <div class="div-head">
            <span class="dname">${esc(d.name)}</span>
            <span class="dcount">${dt.length} team${dt.length === 1 ? '' : 's'}</span>
            <span class="row-actions">
              <button class="icon-btn" data-act="div-up" ${di === 0 ? 'disabled' : ''} title="Move up">▲</button>
              <button class="icon-btn" data-act="div-down" ${di === divs.length - 1 ? 'disabled' : ''} title="Move down">▼</button>
              <button class="icon-btn" data-act="div-rename" title="Rename">✎</button>
              <button class="icon-btn danger" data-act="div-delete" title="Delete division">✕</button>
            </span>
          </div>
          <div class="team-chips">${dt.map((t) => chipHTML(t, false)).join('') || '<span class="ls-empty" style="padding:.4rem">No teams</span>'}</div>
        </div>`;
      }).join('')}
    </section>`;
  }).join('');
}

/* ------------------------------- operations ------------------------------- */

/* Reorder helper: move item at index i by delta within its own array slice. */
function reorder(list, predicate, id, delta) {
  const scoped = list.filter(predicate);
  const idx = scoped.findIndex((x) => x.id === id);
  const target = idx + delta;
  if (idx < 0 || target < 0 || target >= scoped.length) return;
  // Swap positions in the underlying array.
  const a = list.indexOf(scoped[idx]);
  const b = list.indexOf(scoped[target]);
  [list[a], list[b]] = [list[b], list[a]];
}

function deleteConference(confId) {
  const divs = divisionsOf(confId);
  if (!confirm('Delete this conference? Its divisions are removed and their teams become unassigned.')) return;
  const divIds = new Set(divs.map((d) => d.id));
  draft.teams.forEach((t) => { if (divIds.has(t.divisionId)) t.divisionId = null; });
  draft.structure.divisions = draft.structure.divisions.filter((d) => d.conferenceId !== confId);
  draft.structure.conferences = draft.structure.conferences.filter((c) => c.id !== confId);
  render();
}

function deleteDivision(divId) {
  if (!confirm('Delete this division? Its teams become unassigned.')) return;
  draft.teams.forEach((t) => { if (t.divisionId === divId) t.divisionId = null; });
  draft.structure.divisions = draft.structure.divisions.filter((d) => d.id !== divId);
  render();
}

function removeTeam(teamId) {
  const t = draft.teams.find((x) => x.id === teamId);
  if (!t || !confirm(`Remove ${t.city} ${t.name} from the league?`)) return;
  draft.teams = draft.teams.filter((x) => x.id !== teamId);
  if (draft.teamId === teamId) draft.teamId = draft.teams[0] ? draft.teams[0].id : null;
  render();
}

/* ------------------------------- team editor ------------------------------- */

function fillSelect(sel, values, current, render_) {
  sel.innerHTML = values.map((v) =>
    `<option value="${esc(v)}"${v === current ? ' selected' : ''}>${render_ ? render_(v) : esc(v)}</option>`).join('');
}

/* Logos being edited, held aside until the team is saved. */
let draftLogos = { primary: null, secondary: null };

/** Repaint the crest preview and the derived market label from the live form. */
/**
 * Explain where the market size is coming from. Market size belongs to the
 * city, so the note names the city's tier; an override says so plainly, and an
 * invented city falls back to the population field.
 */
function refreshMarketNote() {
  const city = el('fCity').value.trim();
  const hit = lookupCity(city);
  const override = el('fMarket').value;
  const note = el('fMarketNote');
  const pop = el('fPopulation');

  if (override) {
    note.textContent = hit
      ? `Manual override. ${hit.city} is normally ${hit.tier}.`
      : 'Manual override.';
  } else if (hit) {
    note.textContent = `${hit.city} is a ${hit.tier} market (${hit.population}M metro).`;
  } else if (city) {
    note.textContent = 'Unknown city — set the market manually, or give a metro population.';
  } else {
    note.textContent = 'Set by the city.';
  }
  // Population only matters where the city is not a real one we can look up.
  pop.disabled = Boolean(hit);
  if (hit) pop.value = hit.population;
}

function refreshEditorPreview() {
  const preview = {
    emoji: el('fEmoji').value,
    colors: {
      primary: el('fPrimary').value,
      secondary: el('fSecondary').value,
      tertiary: el('fTertiary').value,
    },
    logoPrimary: draftLogos.primary,
  };
  el('crestPreview').innerHTML = crestHTML(preview, 76);
  refreshMarketNote();
  const box = (slot, url) => {
    const b = el(slot);
    b.innerHTML = url ? `<img src="${url}" alt="">` : '<span class="ph">No logo</span>';
  };
  box('logoPrimaryBox', draftLogos.primary);
  box('logoSecondaryBox', draftLogos.secondary);
}

function openTeamEditor(teamId) {
  editingTeamId = teamId;
  const t = teamId ? draft.teams.find((x) => x.id === teamId) : null;
  const c = teamColors(t || {});
  el('teamModalTitle').textContent = t ? 'Edit Team' : 'Create Custom Team';
  el('fCity').value = t ? t.city : '';
  el('fName').value = t ? t.name : '';
  fillSelect(el('fEmoji'), EMOJI_CHOICES, t ? t.emoji : EMOJI_CHOICES[0]);
  fillSelect(el('fFans'), FANS, t ? t.fanInterest : 'Medium');
  el('fPrimary').value = c.primary;
  el('fSecondary').value = c.secondary;
  el('fTertiary').value = c.tertiary;
  // Teams saved before population existed get a sensible value from their market.
  el('fMarket').value = (t && t.marketOverride) || '';
  el('fPopulation').value = t
    ? (t.population != null ? t.population : '')
    : 2.5;
  el('fBudget').value = t ? t.budget : 100;
  el('fDivision').innerHTML = divisionOptions(t ? t.divisionId : null);
  draftLogos = { primary: (t && t.logoPrimary) || null, secondary: (t && t.logoSecondary) || null };
  refreshEditorPreview();
  el('teamModal').hidden = false;
  el('fCity').focus();
}

function saveTeamFromEditor() {
  const city = el('fCity').value.trim();
  const name = el('fName').value.trim();
  if (!city || !name) { alert('A team needs both a city and a name.'); return; }
  const hit = lookupCity(city);
  const override = el('fMarket').value || null;
  // A real city carries its own metro population; an invented one takes
  // whatever the user typed.
  const population = hit
    ? hit.population
    : Math.max(0.1, Math.min(30, parseFloat(el('fPopulation').value) || 1));
  const colors = {
    primary: el('fPrimary').value,
    secondary: el('fSecondary').value,
    tertiary: el('fTertiary').value,
  };
  const patch = {
    city, name,
    emoji: el('fEmoji').value,
    colors,
    color: colors.primary,          // legacy field other screens still read
    population,
    // Stored for display, but marketOf() is the authority and recomputes from
    // the city every time, so a later city change moves the market with it.
    marketOverride: override,
    marketSize: marketOf({ city, marketOverride: override, population }),
    fanInterest: el('fFans').value,
    budget: Math.max(40, Math.min(200, parseFloat(el('fBudget').value) || 100)),
    divisionId: el('fDivision').value || null,
    logoPrimary: draftLogos.primary || null,
    logoSecondary: draftLogos.secondary || null,
  };
  if (editingTeamId) {
    Object.assign(draft.teams.find((t) => t.id === editingTeamId), patch);
  } else {
    draft.teams.push({ id: newTeamId(), championships: 0, custom: true, ...patch });
  }
  el('teamModal').hidden = true;
  render();
}

/* ------------------------------- library ------------------------------- */

function openLibrary() {
  const lib = teamLibrary(draft.teams);
  el('libList').innerHTML = lib.length
    ? lib.map((t) => `<div class="lib-item" data-lib='${esc(JSON.stringify(t))}'>
        ${crestHTML(t, 28)}
        <span class="who"><span class="c">${esc(t.city)}</span><span class="n">${esc(t.name)}</span></span>
        <button class="icon-btn" data-act="lib-add">Add</button>
      </div>`).join('')
    : '<p class="ls-empty">Every library team is already in the league.</p>';
  el('libModal').hidden = false;
}

/* ------------------------------- wiring ------------------------------- */

// Conference / division / team actions, all event-delegated.
el('conferences').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const confId = e.target.closest('[data-conf]')?.dataset.conf;
  const divId = e.target.closest('[data-div]')?.dataset.div;
  const teamId = e.target.closest('[data-team]')?.dataset.team;
  const act = btn.dataset.act;

  if (act === 'conf-up' || act === 'conf-down') {
    reorder(draft.structure.conferences, () => true, confId, act === 'conf-up' ? -1 : 1); render();
  } else if (act === 'conf-rename') {
    const c = draft.structure.conferences.find((x) => x.id === confId);
    const n = prompt('Conference name:', c.name); if (n && n.trim()) { c.name = n.trim(); render(); }
  } else if (act === 'add-div') {
    const n = prompt('Division name:', 'New Division');
    if (n && n.trim()) { draft.structure.divisions.push(newDivision(n.trim(), confId)); render(); }
  } else if (act === 'conf-delete') {
    deleteConference(confId);
  } else if (act === 'div-up' || act === 'div-down') {
    reorder(draft.structure.divisions, (d) => d.conferenceId === confId, divId, act === 'div-up' ? -1 : 1); render();
  } else if (act === 'div-rename') {
    const d = draft.structure.divisions.find((x) => x.id === divId);
    const n = prompt('Division name:', d.name); if (n && n.trim()) { d.name = n.trim(); render(); }
  } else if (act === 'div-delete') {
    deleteDivision(divId);
  } else if (act === 'edit-team') {
    openTeamEditor(teamId);
  } else if (act === 'remove-team') {
    removeTeam(teamId);
  }
});

// Moving a team between divisions (works in both the conference list and the
// unassigned tray).
function onMove(e) {
  const sel = e.target.closest('select.move');
  if (!sel) return;
  const teamId = e.target.closest('[data-team]').dataset.team;
  const t = draft.teams.find((x) => x.id === teamId);
  if (t) { t.divisionId = sel.value || null; render(); }
}
el('conferences').addEventListener('change', onMove);
el('unassignedList').addEventListener('change', onMove);
el('unassignedList').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const teamId = e.target.closest('[data-team]').dataset.team;
  if (btn.dataset.act === 'edit-team') openTeamEditor(teamId);
  if (btn.dataset.act === 'remove-team') removeTeam(teamId);
});

// Toolbar
el('addConf').addEventListener('click', () => {
  const n = prompt('Conference name:', 'New Conference');
  if (n && n.trim()) { draft.structure.conferences.push(newConference(n.trim())); render(); }
});
el('addTeam').addEventListener('click', () => openTeamEditor(null));
el('openLibrary').addEventListener('click', openLibrary);
el('autoAlignBtn').addEventListener('click', () => {
  if (!draft.structure.divisions.length) { alert('Add at least one division first.'); return; }
  if (!confirm('Spread every team evenly across the current divisions?')) return;
  autoAlign(draft.teams, draft.structure); render();
});

// Team editor
el('teamCancel').addEventListener('click', () => { el('teamModal').hidden = true; });
el('teamSave').addEventListener('click', saveTeamFromEditor);

// Colours, crest symbol and population all repaint the preview immediately.
for (const id of ['fPrimary', 'fSecondary', 'fTertiary', 'fEmoji', 'fPopulation',
                  'fCity', 'fMarket']) {
  el(id).addEventListener('input', refreshEditorPreview);
  el(id).addEventListener('change', refreshEditorPreview);
}

// Logo uploads are downscaled before being stored.
async function handleLogo(inputId, slot) {
  const input = el(inputId);
  const file = input.files && input.files[0];
  input.value = '';                       // allow re-picking the same file
  if (!file) return;
  try {
    draftLogos[slot] = await readLogoFile(file);
    refreshEditorPreview();
  } catch (err) {
    alert('Could not use that image: ' + err.message);
  }
}
el('fLogoPrimary').addEventListener('change', () => handleLogo('fLogoPrimary', 'primary'));
el('fLogoSecondary').addEventListener('change', () => handleLogo('fLogoSecondary', 'secondary'));
el('clearLogoPrimary').addEventListener('click', () => { draftLogos.primary = null; refreshEditorPreview(); });
el('clearLogoSecondary').addEventListener('click', () => { draftLogos.secondary = null; refreshEditorPreview(); });

// Library
el('libClose').addEventListener('click', () => { el('libModal').hidden = true; });
el('libList').addEventListener('click', (e) => {
  if (!e.target.closest('[data-act="lib-add"]')) return;
  const item = e.target.closest('[data-lib]');
  const t = JSON.parse(item.dataset.lib);
  draft.teams.push({ ...t, id: newTeamId(), divisionId: null });
  item.remove();
  render();
});

// Footer
el('backBtn').addEventListener('click', () => { location.href = './new-career.html'; });
el('resetBtn').addEventListener('click', () => {
  if (!confirm('Reset to the default 30-team, 2-conference league?')) return;
  const fresh = newDraft();
  draft.teams = fresh.teams; draft.structure = fresh.structure;
  render();
});
el('saveBtn').addEventListener('click', () => {
  const stored = loadDraft();
  stored.teams = draft.teams;
  stored.structure = draft.structure;
  // A custom league no longer matches the preset it came from.
  stored.presetId = null;
  stored.presetName = 'Custom League';
  if (!stored.teams.some((t) => t.id === stored.teamId)) {
    stored.teamId = stored.teams[0] ? stored.teams[0].id : null;
  }
  if (!saveDraft(stored)) {
    alert('Could not save the league structure — browser storage is full.\n' +
          'Try clearing a logo or two (uploaded images take the most space).');
    return;
  }
  location.href = './new-career.html';
});

// Close modals on backdrop click / Escape.
for (const id of ['teamModal', 'libModal']) {
  el(id).addEventListener('click', (e) => { if (e.target === el(id)) el(id).hidden = true; });
}
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  el('teamModal').hidden = true; el('libModal').hidden = true;
});

render();
