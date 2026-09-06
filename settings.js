'use strict';

/**
 * settings.js — the Players & Rosters settings screen.
 *
 * The whole screen is rendered from gameSettings.js's definition table, so a
 * new setting needs a row there and nothing here. Changes save as you make
 * them; there is no unsaved state to lose.
 */

import {
  GROUPS, ALL_SETTINGS, defaults, normalize, isRelevant, loadSettings, saveSettings,
  listRulePresets, saveRulePreset, getRulePreset, deleteRulePreset,
} from './gameSettings.js';
import { scheduleSummary, autoFixSchedule, matchupBreakdown } from './scheduleRules.js';
import { buildSchedule, scheduleStats } from './schedule.js';
import { loadDraft } from './leagueConfig.js';

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
  if (s.type === 'monthday') {
    // A season crosses New Year, so only the month and day mean anything. The
    // date input needs a year, so it borrows a leap year (keeping Feb 29
    // selectable) and the year is discarded on the way back out. A field marked
    // `after` another shows the FOLLOWING year when its month is earlier, so a
    // season ending in April does not read as four months before it began.
    let year = 2024;
    if (s.after && settings[s.after]) {
      const startMonth = Number(String(settings[s.after]).slice(0, 2));
      if (Number(String(v).slice(0, 2)) < startMonth) year = 2025;
    }
    return `<input type="date" data-key="${s.key}" data-monthday="1"
      value="${year}-${esc(v)}" aria-label="${esc(s.label)}"${dis} />`;
  }
  if (s.type === 'optnum') {
    // Blank is a real, meaningful value here — "no special treatment" — so the
    // field is left genuinely empty and the placeholder says what that means.
    return `<input type="number" data-key="${s.key}" data-optnum="1"
      value="${v === '' || v == null ? '' : v}" min="${s.min}" max="${s.max}"
      step="${s.step || 1}" placeholder="Auto" aria-label="${esc(s.label)}"${dis} />`;
  }
  if (s.type === 'text') {
    return `<input type="text" data-key="${s.key}" value="${esc(v)}"
      placeholder="auto" aria-label="${esc(s.label)}"${dis} />`;
  }
  return `<input type="number" data-key="${s.key}" value="${v}" min="${s.min}" max="${s.max}"
    step="${s.step || 1}" aria-label="${esc(s.label)}"${dis} />`;
}

/** Why a setting is greyed out, in the terms of the setting that disabled it. */
function irrelevantNote(s) {
  const d = s.dependsOn;
  // Named from the dependency itself rather than hard-coded, so a second
  // conditional setting explains itself correctly instead of citing the cap.
  const owner = ALL_SETTINGS.find((x) => x.key === d.key);
  return `Only applies when ${owner ? owner.label : d.key} is ${d.value} — currently ${settings[d.key]}.`;
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
  renderScheduleBar();
}

/* ------------------------------ schedule bar ------------------------------ */

/**
 * The teams the schedule will actually be built for.
 *
 * The League Structure draft is the source of truth while a league is being
 * set up — that is where teams, conferences and divisions are edited — so the
 * validation and the preview both read it rather than assuming a shape.
 */
function draftLeague() {
  try {
    const d = loadDraft();
    return { teams: (d && d.teams) || [], structure: (d && d.structure) || null };
  } catch (_) { return { teams: [], structure: null }; }
}

let previewOpen = false;

/**
 * The live consequence of the opponent rules, recomputed on every change.
 *
 * Shows the arithmetic rather than the conclusion — 4 opponents x 4 games = 16
 * — because the question these settings raise is "what does this actually do
 * to my season", and a single total does not answer it. Everything comes from
 * the league structure currently being built, so it follows teams,
 * conferences, divisions and the game count as they move.
 */
function matchupPanel(teams, structure) {
  const b = matchupBreakdown(teams, settings, structure);
  const rows = b.lines.map((l) => `<div class="mx-row">
    <span class="mx-l">${esc(l.label)}</span>
    <span class="mx-v">${esc(l.text)}</span>
    <span class="mx-src${l.source === 'user' ? ' is-user' : ''}">${
      l.source === 'user' ? 'set' : 'auto'}</span>
  </div>`).join('');

  const over = b.over;
  const remaining = b.target - b.assigned;
  return `<div class="mx-panel">
    <div class="mx-h">League Structure</div>
    <div class="mx-struct">${b.structure.map((x) => `<span>${esc(x)}</span>`).join('')}</div>
    <div class="mx-h">Schedule</div>
    ${rows}
    <div class="mx-total${over ? ' is-over' : ''}">
      <span>Assigned Games</span><b>${b.assigned} / ${b.target}</b>
    </div>
    ${!over && remaining > 0 ? `<div class="mx-rem">Remaining Games: ${remaining}
      <em>— distributed automatically</em></div>` : ''}
    ${!over && remaining === 0 ? '<div class="mx-rem">Fully specified.</div>' : ''}
  </div>`;
}

function renderScheduleBar() {
  const bar = el('schedBar');
  if (!bar) return;
  const { teams, structure } = draftLeague();
  if (teams.length < 2) {
    bar.innerHTML = `<div class="sb-line">Add at least two teams in League Structure to
      validate the schedule.</div>`;
    return;
  }
  const sum = scheduleSummary(teams, settings, new Date().getFullYear(), structure);
  const problems = sum.problems.map((p) => `<li>${esc(p.message)}</li>`).join('');
  const notes = sum.notes.map((n) => `<li>${esc(n)}</li>`).join('');

  bar.innerHTML = `
    <div class="sb-head">
      <span class="sb-k">Schedule</span>
      <span class="sb-status ${sum.valid ? 'is-ok' : 'is-bad'}">${
        sum.valid ? 'Valid' : 'Cannot be generated'}</span>
    </div>
    <div class="sb-line">${esc(sum.text)}</div>
    <div class="sb-sub">${teams.length} teams · ${sum.plan.totalGames} games total</div>
    ${matchupPanel(teams, structure)}
    ${problems ? `<ul class="sb-problems">${problems}</ul>` : ''}
    ${notes ? `<ul class="sb-notes">${notes}</ul>` : ''}
    <div class="sb-actions">
      <button class="mini" id="autoFixBtn"${sum.valid ? ' disabled' : ''}>Auto Fix Schedule</button>
      <button class="mini" id="previewBtn">Preview Generated Schedule</button>
    </div>
    <div class="sb-preview" id="schedPreview"${previewOpen ? '' : ' hidden'}></div>`;
}

/**
 * Build a throwaway schedule from the current settings and report what it
 * actually produced — measured, not predicted, because the settings are
 * targets and a tight calendar makes the generator relax them.
 */
/**
 * What the generated schedule actually did about back-to-backs.
 *
 * The point of a numeric target is that it can be CHECKED, so this reads the
 * finished fixture list rather than restating the setting: the league average,
 * the lowest and highest club, and whether anyone fell outside the band. A
 * spread of exactly zero would mean every club got the same number, which is
 * the thing the settings explicitly do not ask for, so the spread is shown too.
 */
function b2bSummary(sch) {
  const r = sch.rest && sch.rest.backToBacks;
  const band = sch.rest && sch.rest.rules;
  if (!r || !r.teams) return '';
  const row = (k, v, cls) => `<div class="pv-row"><span>${esc(k)}</span>
    <b class="${cls || ''}">${esc(String(v))}</b></div>`;
  const asked = band
    ? `${band.target} \u00b1 ${band.variance} (${band.min}\u2013${band.max})`
    : '\u2014';
  const miss = r.outside.length
    ? `${r.outside.length} team${r.outside.length === 1 ? '' : 's'} outside`
    : 'All teams inside';
  const t = r.types || {};
  return `<div class="pv-h">Back-to-backs</div>
    <div class="pv-grid">
      ${row('Target band', asked)}
      ${row('League average', r.average.toFixed(1))}
      ${row('Lowest / highest', `${r.lowest} / ${r.highest}`)}
      ${row('Spread', `${r.spread} set${r.spread === 1 ? '' : 's'}`)}
      ${row('Within band', miss, r.withinBand ? 'is-ok' : 'is-warn')}
      ${row('Home\u2192Home / Home\u2192Away', `${t.homeHome || 0} / ${t.homeAway || 0}`)}
      ${row('Away\u2192Home / Away\u2192Away', `${t.awayHome || 0} / ${t.awayAway || 0}`)}
    </div>
    ${r.outside.length ? `<p class="pv-note">Outside the band:
      ${esc(r.outside.map((o) => `${o.team} (${o.backToBacks})`).join(', '))}. The
      generator could not fit every club inside it on this calendar.</p>` : ''}`;
}

function renderPreview() {
  const { teams, structure } = draftLeague();
  const box = el('schedPreview');
  if (!box || teams.length < 2) return;
  const year = new Date().getFullYear() + 1;
  const league = { meta: { currentSeason: year, rngSeed: 1 }, teams, settings, structure };
  const sch = buildSchedule(league, year, settings, structure);
  const st = scheduleStats(sch, teams);
  const m = sch.plan.matchups;

  const row = (k, v) => `<div class="pv-row"><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`;
  const sample = sch.games.slice(0, 6).map((g) => {
    const nm = (id) => {
      const t = teams.find((x) => x.id === id);
      return t ? `${t.city || ''} ${t.name || ''}`.trim() || id : id;
    };
    return `<div class="pv-game">${esc(g.date)} — ${esc(nm(g.away))} @ ${esc(nm(g.home))}</div>`;
  }).join('');

  box.innerHTML = `
    <div class="pv-h">What these settings actually produce</div>
    <div class="pv-grid">
      ${row('Games per team', st.gamesPerTeam)}
      ${row('Total games', st.games)}
      ${row('Playing dates', st.dates)}
      ${row('Matchups (div / conf / non)', `${m.division} / ${m.conference} / ${m.nonConference}`)}
      ${row('Back-to-backs', `${st.backToBackPct}% of games`)}
      ${row('Longest gap', `${st.longestGap} days`)}
      ${row('Longest homestand', `${st.longestHomestand} games`)}
      ${row('Longest road trip', `${st.longestRoadTrip} games`)}
      ${row('Home/away difference', `${st.homeAwayGap} game${st.homeAwayGap === 1 ? '' : 's'}`)}
      ${st.unplaced ? row('Could not place', `${st.unplaced} games`) : ''}
    </div>
    ${b2bSummary(sch)}
    <div class="pv-h">First games</div>
    ${sample}
    <p class="pv-note">A sample only — nothing is saved, and the real schedule is
      generated when the career starts.</p>`;
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
renderScheduleBar();

document.addEventListener('click', (e) => {
  if (e.target.closest('#autoFixBtn')) {
    const { teams, structure } = draftLeague();
    const fixed = autoFixSchedule(teams, settings, new Date().getFullYear(), structure);
    if (!fixed.changes.length) { flash('Nothing could be adjusted automatically'); return; }
    settings = fixed.settings;
    commit();
    alert(`Auto Fix made ${fixed.changes.length} change${fixed.changes.length === 1 ? '' : 's'}:

`
      + fixed.changes.map((c) => `\u2022 ${c}`).join('\n'));
    return;
  }
  if (e.target.closest('#previewBtn')) {
    previewOpen = !previewOpen;
    renderScheduleBar();
    if (previewOpen) renderPreview();
  }
});

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
  if (e.target.dataset.monthday) settings[k] = e.target.value.slice(5);  // drop the year
  // An empty optional number stays empty. Coercing it to 0 here would turn
  // "no special treatment" into "these teams never meet".
  else if (e.target.dataset.optnum) {
    settings[k] = e.target.value === '' ? '' : Number(e.target.value);
  } else settings[k] = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
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
