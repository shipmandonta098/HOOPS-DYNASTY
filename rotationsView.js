'use strict';

/**
 * rotationsView.js — the Rotations screen.
 *
 * WHAT IS REAL HERE, AND WHAT IS NOT.
 *
 * The minutes ARE real, and they are the point: an allocation is an
 * instruction the user gives the simulator, so it is true the moment it is
 * set. It is stored on the team and read back on every visit.
 *
 * The reference also prints "37 - 19, 1st in Western Conference" beside the
 * team name. That is a record, this league has not played a game, and the
 * Standings screen already refuses to invent one — so this reports what the
 * save knows and says plainly when that is nothing.
 *
 * The reference's player portraits are absent for the same reason they are
 * absent from the Roster screen: there is no photography in this game. Initials
 * stand in, which is the pattern already used everywhere a face would go.
 *
 * The Role column shows the ROTATION role, derived live from the minutes on
 * screen — Starter, Sixth Man, Rotation, Situational, Reserve. The reference
 * mixes those with archetype names ("Stretch Big", "Defensive Anchor"), which
 * are a different kind of fact and already live on the player card.
 */

import { loadLeague, listSavesDetailed, touchLastPlayed, saveLeague } from './db.js';
import { mountNav, activeLeagueId, renderNoCareer, markPlayed } from './shell.js';
import { crestHTML } from './leagueConfig.js';
import { applyTeamTheme } from './teamTheme.js';
import { ovr, initials, POSITION_NAME } from './playerRatings.js';
import { standings } from './standings.js';
import {
  ON_COURT, PRESETS, gameMinutes, totalMinutes, reconcile, depthOrder,
  applyPreset, autoMinutes, evenMinutes, resetMinutes, balanceMinutes,
  roleOf, validate,
} from './rotation.js';

const el = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let league = null;
let leagueId = null;
let team = null;
let roster = [];
let minutes = {};
let saved = {};
let presetName = null;

const settings = () => (league && league.settings) || {};
const money = (m) => (m == null ? null : `$${Number(m).toFixed(1)}M`);

/**
 * A contract, only from fields the save actually holds.
 *
 * The years live on `yearsRemaining`, not `years` — reading the wrong one
 * silently dropped half of every contract line rather than erroring, which is
 * exactly the kind of thing that survives a glance at the screen.
 */
function contractLine(p) {
  const c = p.contract;
  if (!c) return null;
  const yrs = Number(c.yearsRemaining);
  const sal = Number(c.salary);
  if (!Number.isFinite(yrs) && !Number.isFinite(sal)) return null;
  const bits = [];
  if (Number.isFinite(yrs)) bits.push(`${yrs} yr${yrs === 1 ? '' : 's'}`);
  if (Number.isFinite(sal)) bits.push(money(sal));
  return bits.join(' | ');
}

/* ---------------------------------------------------------------- render */

function render() {
  const cap = gameMinutes(settings());
  const order = depthOrder(roster);
  const v = validate(roster, minutes, settings());

  el('rotHead').innerHTML = `<tr>
    <th class="rt-slot">Slot</th>
    <th class="rt-player">Player</th>
    <th class="rt-pos">Pos</th>
    <th class="rt-ovr">Ovr</th>
    <th class="rt-min">Minutes</th>
    <th class="rt-slider">
      <span class="rt-scale">${[0, 12, 24, 36, cap].map((n) =>
        `<i>${n}</i>`).join('')}</span>
    </th>
    <th class="rt-role">Role</th>
    <th class="rt-age">Age</th>
    <th class="rt-con">Contract</th>
  </tr>`;

  // The three bands are read off the minutes, not configured: the starters are
  // the top five, the bench is everyone else still playing, and a reserve is
  // anybody on nothing. Drag someone to zero and they move band.
  let band = null;
  const rows = order.map((p, i) => {
    const m = Math.max(0, Number(minutes[p.id]) || 0);
    const role = roleOf(i, m, settings());
    const want = i < ON_COURT ? 'STARTERS' : (m > 0 ? 'BENCH' : 'RESERVES');
    const header = want !== band
      ? `<tr class="rt-band"><td colspan="9"><span class="rt-badge is-${want.toLowerCase()}">${want}</span></td></tr>`
      : '';
    band = want;
    const con = contractLine(p);

    return `${header}<tr data-id="${esc(p.id)}" class="${m > 0 ? '' : 'is-off'}">
      <td class="rt-slot"><span class="rt-num">${i + 1}</span></td>
      <td class="rt-player">
        <span class="av">${esc(initials(p.name))}</span>
        <span class="rt-name">${esc(p.name || '')}</span>
      </td>
      <td class="rt-pos"><span class="rt-tag" title="${esc(POSITION_NAME[p.position] || '')}"
        >${esc(p.position || '—')}</span></td>
      <td class="rt-ovr"><b class="${ovrClass(ovr(p))}">${ovr(p)}</b></td>
      <td class="rt-min">
        <input class="rt-input" type="number" min="0" max="${cap}" step="1"
          value="${m}" data-id="${esc(p.id)}"
          aria-label="Minutes for ${esc(p.name || '')}" />
      </td>
      <td class="rt-slider">
        <input class="rt-range" type="range" min="0" max="${cap}" step="1"
          value="${m}" data-id="${esc(p.id)}"
          aria-label="Minutes slider for ${esc(p.name || '')}" />
      </td>
      <td class="rt-role"><span class="rt-r is-${role.tone}">${esc(role.label)}</span></td>
      <td class="rt-age">${Number.isFinite(Number(p.age)) ? Number(p.age) : '<span class="na">—</span>'}</td>
      <td class="rt-con">${con ? esc(con) : '<span class="na">—</span>'}</td>
    </tr>`;
  }).join('');

  el('rotBody').innerHTML = rows || `<tr><td colspan="9" class="rt-empty">
    This team has nobody on its roster.</td></tr>`;

  renderInfo(v);
  renderActions();
  el('saveBtn').disabled = !v.ok || !changed();
  el('revertBtn').disabled = !changed();
}

const ovrClass = (n) => (n >= 80 ? 'is-elite' : n >= 70 ? 'is-good' : n >= 60 ? 'is-ok' : 'is-low');

function renderInfo(v) {
  const bar = (label, value, cls) => `<div class="mi-row">
    <span>${esc(label)}</span><b class="${cls || ''}">${esc(String(value))}</b></div>`;

  el('minutesInfo').innerHTML = `
    <div class="rot-h"><i>≡</i>Minutes Info</div>
    ${bar('Total Minutes', `${v.total} / ${v.target}`, v.ok ? 'is-ok' : 'is-warn')}
    ${bar('Starters', v.starters)}
    ${bar('Bench', v.bench)}
    ${bar('Inactive', v.inactive)}
    <div class="mi-state ${v.ok ? 'is-ok' : 'is-warn'}">
      <span class="mi-dot"></span>
      <div>
        <b>${v.ok ? 'Rotation is valid' : 'Rotation is not ready'}</b>
        ${v.ok ? '' : `<ul>${v.problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`}
      </div>
    </div>`;
}

const ACTIONS = [
  { id: 'auto', icon: '✨', label: 'Auto-Set Minutes',
    hint: 'Weights minutes by Overall down a ten-man rotation.' },
  { id: 'balance', icon: '⚖️', label: 'Balance Rotation',
    hint: 'Keeps the shape you built and scales it to the exact total.' },
  { id: 'even', icon: '👥', label: 'Even Minutes',
    hint: 'The same minutes for everyone in the rotation.' },
  { id: 'reset', icon: '↺', label: 'Reset Minutes',
    hint: 'Everyone to zero, to build from nothing.' },
];

function renderActions() {
  el('quickActions').innerHTML = `
    <div class="rot-h"><i>⚡</i>Quick Actions</div>
    ${ACTIONS.map((a) => `<button class="qa" data-act="${a.id}" title="${esc(a.hint)}">
      <span class="qa-ic">${a.icon}</span>
      <span class="qa-t">${esc(a.label)}</span>
    </button>`).join('')}`;
}

const changed = () => JSON.stringify(minutes) !== JSON.stringify(saved);

/* ------------------------------------------------------------------ edit */

function setMinutes(id, value) {
  const cap = gameMinutes(settings());
  const n = Math.max(0, Math.min(cap, Math.round(Number(value) || 0)));
  minutes[id] = n;
  // The preset no longer describes what is on screen once a slider moves.
  if (presetName) { presetName = null; el('presetSel').value = ''; }
  render();
}

function bind() {
  const body = el('rotBody');
  // One listener for the whole table: rows are rebuilt on every render, so
  // per-row handlers would be re-attached constantly and leak.
  body.addEventListener('input', (e) => {
    const t = e.target;
    if (t.classList.contains('rt-range') || t.classList.contains('rt-input')) {
      setMinutes(t.dataset.id, t.value);
    }
  });

  el('quickActions').addEventListener('click', (e) => {
    const btn = e.target.closest('.qa');
    if (!btn) return;
    const s = settings();
    if (btn.dataset.act === 'auto') minutes = autoMinutes(roster, s);
    else if (btn.dataset.act === 'balance') minutes = balanceMinutes(roster, minutes, s);
    else if (btn.dataset.act === 'even') minutes = evenMinutes(roster, s);
    else if (btn.dataset.act === 'reset') minutes = resetMinutes(roster);
    presetName = null;
    el('presetSel').value = '';
    render();
  });

  el('presetSel').addEventListener('change', (e) => {
    const name = e.target.value;
    if (!name || !PRESETS[name]) { presetName = null; return; }
    minutes = applyPreset(depthOrder(roster), PRESETS[name], settings());
    presetName = name;
    render();
  });

  el('saveBtn').addEventListener('click', async () => {
    const v = validate(roster, minutes, settings());
    if (!v.ok) return;
    team.rotation = { minutes: { ...minutes }, preset: presetName };
    saved = { ...minutes };
    try { await saveLeague(leagueId, league); } catch (_) { /* read-only is fine */ }
    render();
  });

  el('revertBtn').addEventListener('click', () => {
    minutes = { ...saved };
    render();
  });
}

/* ------------------------------------------------------------------ boot */

(async function boot() {
  let id = null;
  try {
    id = await activeLeagueId(listSavesDetailed);
    if (id) league = await loadLeague(id);
  } catch (_) { /* fall through to the no-career state */ }

  mountNav('rotations', id);
  if (!league) { renderNoCareer(); return; }
  markPlayed(touchLastPlayed, id);
  leagueId = id;

  const myId = (league.meta && league.meta.userTeamId)
    || ((league.teams || [])[0] || {}).id || null;
  team = (league.teams || []).find((t) => t.id === myId) || null;
  if (!team) { renderNoCareer(); return; }
  roster = (league.players || []).filter((p) => p.teamId === team.id);

  applyTeamTheme(team, document.body);
  el('crest').outerHTML = `<div class="rt-crest" id="crest">${crestHTML(team, 56)}</div>`;
  el('city').textContent = team.city || '';
  el('teamName').textContent = team.name || '';
  el('season').textContent = `${(league.meta && league.meta.currentSeason) || '—'} Season`;
  el('phase').textContent = 'Regular Season';

  // The record, from the standings module, which counts played games and only
  // played games. In a league that has not tipped off this says so.
  const table = standings(league, 'conference');
  const row = table.groups.flatMap((g) => g.rows).find((r) => r.id === team.id);
  el('record').innerHTML = table.played && row
    ? `${row.wins} - ${row.losses} <span class="rt-seed">${ordinal(row.seed)} in ${
      esc(table.groups.find((g) => g.rows.includes(row)).label)}</span>`
    : '<span class="na">No games played yet</span>';

  el('presetSel').innerHTML = '<option value="">Custom</option>'
    + Object.keys(PRESETS).map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('');

  const start = reconcile(team.rotation, roster, settings());
  minutes = start.minutes;
  presetName = start.preset;
  saved = { ...minutes };
  if (presetName) el('presetSel').value = presetName;

  bind();
  render();
}());

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
