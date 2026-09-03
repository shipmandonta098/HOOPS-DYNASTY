'use strict';

/**
 * settings.js — the Players & Rosters settings screen.
 *
 * The whole screen is rendered from gameSettings.js's definition table, so a
 * new setting needs a row there and nothing here. Changes save as you make
 * them; there is no unsaved state to lose.
 */

import {
  GROUPS, defaults, normalize, isRelevant, loadSettings, saveSettings,
  listRulePresets, saveRulePreset, getRulePreset, deleteRulePreset,
} from './gameSettings.js';

const el = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let settings = loadSettings();
let openGroups = new Set(['roster', 'generation']);   // first two open by default

/* -------------------------------- render --------------------------------- */

function controlHTML(s, off) {
  const v = settings[s.key];
  const dis = off ? ' disabled' : '';
  if (s.type === 'toggle') {
    return `<button class="sw${v ? ' is-on' : ''}" data-key="${s.key}" role="switch"${dis}
      aria-checked="${v ? 'true' : 'false'}" aria-label="${esc(s.label)}"><span></span></button>`;
  }
  if (s.type === 'choice') {
    return `<select data-key="${s.key}" aria-label="${esc(s.label)}"${dis}>${
      s.options.map((o) => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  }
  return `<input type="number" data-key="${s.key}" value="${v}" min="${s.min}" max="${s.max}"
    step="${s.step || 1}" aria-label="${esc(s.label)}"${dis} />`;
}

/** Why a setting is greyed out, in the terms of the setting that disabled it. */
function irrelevantNote(s) {
  const d = s.dependsOn;
  return `Only applies when Salary Cap Type is ${d.value} — currently ${settings[d.key]}.`;
}

function render() {
  el('groups').innerHTML = GROUPS.map((g) => {
    const open = openGroups.has(g.id);
    return `<section class="set-group${open ? ' is-open' : ''}">
      <button class="set-head" data-group="${g.id}" aria-expanded="${open}">
        <span class="chev" aria-hidden="true">▾</span>
        <span class="gt">${esc(g.label)}</span>
        <span class="gc">${g.settings.length}</span>
      </button>
      <div class="set-body">${g.settings.map((s) => {
        const off = !isRelevant(s, settings);
        return `<div class="set-row${off ? ' is-off' : ''}">
          <div class="sl">
            <span class="sn">${esc(s.label)}</span>
            <button class="help" type="button" data-help="${s.key}"
              aria-label="What does ${esc(s.label)} affect?">?</button>
            ${s.applied ? '' : '<span class="pending-tag">Pending</span>'}
            ${off ? `<span class="off-tag">${esc(irrelevantNote(s))}</span>` : ''}
            <div class="sh" id="help-${s.key}" hidden>${esc(s.help)}</div>
          </div>
          <div class="sc">${controlHTML(s, off)}</div>
        </div>`;
      }).join('')}
      </div>
    </section>`;
  }).join('');
}

function flash(msg) {
  const n = el('saveState');
  n.textContent = msg;
  n.classList.add('is-flash');
  setTimeout(() => { n.classList.remove('is-flash'); n.textContent = 'Saved automatically'; }, 1600);
}

function commit() {
  settings = normalize(settings);
  saveSettings(settings);
  render();
}

/* -------------------------------- presets -------------------------------- */

async function refreshPresets(selectId) {
  const list = await listRulePresets();
  const sel = el('presetSel');
  sel.innerHTML = '<option value="">Current settings</option>' +
    list.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  if (selectId) sel.value = selectId;
  const chosen = Boolean(sel.value);
  el('presetLoad').disabled = !chosen;
  el('presetDelete').disabled = !chosen;
}

/* --------------------------------- boot ---------------------------------- */

render();
refreshPresets();

el('groups').addEventListener('click', (e) => {
  const head = e.target.closest('[data-group]');
  if (head) {
    const id = head.dataset.group;
    if (openGroups.has(id)) openGroups.delete(id); else openGroups.add(id);
    render();
    return;
  }
  const help = e.target.closest('[data-help]');
  if (help) {
    const box = el('help-' + help.dataset.help);
    if (box) box.hidden = !box.hidden;
    return;
  }
  const sw = e.target.closest('.sw');
  if (sw) {
    settings[sw.dataset.key] = !settings[sw.dataset.key];
    commit();
  }
});

el('groups').addEventListener('change', (e) => {
  const k = e.target.dataset && e.target.dataset.key;
  if (!k) return;
  settings[k] = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
  commit();
});

el('restoreBtn').addEventListener('click', () => {
  if (!confirm('Restore every Players & Rosters setting to its default?')) return;
  settings = defaults();
  commit();
  flash('Defaults restored');
});

el('presetSel').addEventListener('change', async () => {
  const chosen = Boolean(el('presetSel').value);
  el('presetLoad').disabled = !chosen;
  el('presetDelete').disabled = !chosen;
});

el('presetSave').addEventListener('click', async () => {
  const name = prompt('Name this settings preset:', 'My rules');
  if (name === null) return;
  try {
    const id = await saveRulePreset(name.trim() || 'My rules', settings);
    await refreshPresets(id);
    flash('Preset saved');
  } catch (err) {
    console.error('Could not save the preset:', err);
    alert('The preset could not be saved.');
  }
});

el('presetLoad').addEventListener('click', async () => {
  const id = el('presetSel').value;
  if (!id) return;
  try {
    const p = await getRulePreset(id);
    if (!p) { alert('That preset could no longer be found.'); await refreshPresets(); return; }
    settings = p.settings;
    commit();
    flash(`Loaded “${p.name}”`);
  } catch (err) {
    console.error('Could not load the preset:', err);
    alert('The preset could not be loaded.');
  }
});

el('presetDelete').addEventListener('click', async () => {
  const id = el('presetSel').value;
  const name = el('presetSel').selectedOptions[0].textContent;
  if (!id || !confirm(`Delete the preset “${name}”? This cannot be undone.`)) return;
  await deleteRulePreset(id);
  await refreshPresets();
  flash('Preset deleted');
});

const back = () => { location.href = './new-career.html'; };
el('backBtn').addEventListener('click', back);
el('doneBtn').addEventListener('click', back);
