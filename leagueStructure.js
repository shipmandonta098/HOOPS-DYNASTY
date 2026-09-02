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
  EMOJI_CHOICES, COLOR_CHOICES, MARKETS, FANS,
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
    <span class="crest" style="background:${esc(t.color || '#33506e')}">${t.emoji || '🏀'}</span>
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

function openTeamEditor(teamId) {
  editingTeamId = teamId;
  const t = teamId ? draft.teams.find((x) => x.id === teamId) : null;
  el('teamModalTitle').textContent = t ? 'Edit Team' : 'Create Custom Team';
  el('fCity').value = t ? t.city : '';
  el('fName').value = t ? t.name : '';
  fillSelect(el('fEmoji'), EMOJI_CHOICES, t ? t.emoji : EMOJI_CHOICES[0]);
  fillSelect(el('fColor'), COLOR_CHOICES, t ? t.color : COLOR_CHOICES[0]);
  fillSelect(el('fMarket'), MARKETS, t ? t.marketSize : 'Medium');
  fillSelect(el('fFans'), FANS, t ? t.fanInterest : 'Medium');
  el('fBudget').value = t ? t.budget : 100;
  el('fDivision').innerHTML = divisionOptions(t ? t.divisionId : null);
  el('teamModal').hidden = false;
  el('fCity').focus();
}

function saveTeamFromEditor() {
  const city = el('fCity').value.trim();
  const name = el('fName').value.trim();
  if (!city || !name) { alert('A team needs both a city and a name.'); return; }
  const patch = {
    city, name,
    emoji: el('fEmoji').value,
    color: el('fColor').value,
    marketSize: el('fMarket').value,
    fanInterest: el('fFans').value,
    budget: Math.max(40, Math.min(200, parseFloat(el('fBudget').value) || 100)),
    divisionId: el('fDivision').value || null,
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
        <span class="crest" style="background:${esc(t.color)};width:28px;height:28px;border-radius:50%;display:grid;place-items:center">${t.emoji}</span>
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
  saveDraft(stored);
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
