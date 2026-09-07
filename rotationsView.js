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
  ON_COURT, PERIODS, PRESETS, gameMinutes, totalMinutes, periodMinutes, reconcile,
  depthOrder, applyPreset, autoMinutes, evenMinutes, resetMinutes, balanceMinutes,
  roleOf, validate, spreadPeriods, reconcilePeriods, validatePeriods,
} from './rotation.js';
import { UNIT_SLOTS, UNIT_SIZE, unitRatings, unitSummary, reconcileUnits } from './lineups.js';
import { STRATEGY, reconcileStrategy, strategyEffects, strategySummary } from './strategy.js';

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
let units = {};
let periods = {};
let strat = {};
let savedUnits = {};
let savedPeriods = {};
let savedStrat = {};
/** Which of the four tabs is on screen. */
let tab = 'rotations';

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

const PANES = ['rotations', 'lineups', 'minutes', 'strategy'];

function render() {
  for (const name of PANES) {
    const pane = el(`pane${name[0].toUpperCase()}${name.slice(1)}`);
    if (pane) pane.hidden = name !== tab;
  }
  for (const btn of el('tabs').querySelectorAll('.tab[data-tab]')) {
    btn.classList.toggle('is-active', btn.dataset.tab === tab);
  }
  if (tab === 'lineups') renderLineups();
  else if (tab === 'minutes') renderMinutes();
  else if (tab === 'strategy') renderStrategy();
  else renderRotations();

  const v = validate(roster, minutes, settings());
  const pv = validatePeriods(periods, minutes, roster, settings());
  // Save is gated on BOTH, because they are one rotation: a valid minute total
  // split wrongly across the quarters is not a rotation anyone can play.
  el('saveBtn').disabled = !(v.ok && pv.ok) || !changed();
  el('revertBtn').disabled = !changed();
}

function renderRotations() {
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

/** Anything unsaved, on any tab — one Save button covers all four. */
/* --------------------------------------------------------------- lineups */

const BARS = [
  ['overall', 'Overall'], ['shooting', 'Shooting'], ['spacing', 'Spacing'],
  ['finishing', 'Finishing'], ['playmaking', 'Playmaking'],
  ['perimeterD', 'Perimeter D'], ['rimProtection', 'Rim Protection'],
  ['rebounding', 'Rebounding'], ['athleticism', 'Athleticism'],
];

/**
 * The five-man units.
 *
 * Each unit's ratings are DERIVED from the five players in it. What is not
 * here is how a unit has performed — minutes together, net rating, plus-minus
 * by combination. Real games produce those and the simulator does not track
 * which five were on the floor for each possession, so there is nothing honest
 * to report and nothing is reported.
 */
function renderLineups() {
  const order = depthOrder(roster);
  const byId = new Map(roster.map((p) => [p.id, p]));

  el('paneLineups').innerHTML = `<div class="lu-grid">${UNIT_SLOTS.map((slot) => {
    const ids = units[slot.key] || [];
    const players = ids.map((id) => byId.get(id)).filter(Boolean);
    const r = unitRatings(players);
    const picked = new Set(ids);

    const seats = ids.map((id, i) => {
      const p = byId.get(id);
      return `<div class="lu-seat">
        <span class="lu-n">${i + 1}</span>
        <select data-unit="${esc(slot.key)}" data-seat="${i}"
          aria-label="Player ${i + 1} in ${esc(slot.label)}">
          ${order.map((o) => `<option value="${esc(o.id)}"${o.id === id ? ' selected' : ''}${
            picked.has(o.id) && o.id !== id ? ' disabled' : ''}
            >${esc(o.position || '')} · ${esc(o.name)} (${ovr(o)})</option>`).join('')}
        </select>
      </div>`;
    }).join('');

    const bars = r ? BARS.map(([k, label]) => `<div class="lu-bar">
      <span class="lu-bk">${esc(label)}</span>
      <span class="lu-track"><i style="width:${Math.max(2, Math.min(100, r[k]))}%"></i></span>
      <b>${r[k]}</b>
    </div>`).join('') : '';

    const pos = r ? `<div class="lu-pos">${
      Object.entries(r.positions.counts).map(([k, n]) =>
        `<span class="lu-p${n === 0 ? ' is-none' : n > 1 ? ' is-dup' : ''}">${esc(k)}${
          n > 1 ? ` ×${n}` : ''}</span>`).join('')}</div>` : '';

    return `<section class="card lu-card">
      <div class="rot-h"><i>V</i>${esc(slot.label)}</div>
      <p class="lu-blurb">${esc(slot.blurb)}</p>
      <div class="lu-seats">${seats}</div>
      ${pos}
      <div class="lu-bars">${bars}</div>
      <p class="lu-read">${esc(unitSummary(r))}</p>
    </section>`;
  }).join('')}</div>
  <p class="rot-note">Unit ratings are worked out from the five players in them.
    How a unit has actually performed together — minutes, net rating, plus-minus —
    is not shown, because the simulator does not record which five were on the floor
    for each possession, so there is nothing real to report.</p>`;
}

/* --------------------------------------------------------------- minutes */

/**
 * The same minutes, split across the quarters.
 *
 * The Rotations tab says how many; this says when. Both have to hold before a
 * rotation can be saved: a player's quarters must add up to his total, and
 * every quarter must field exactly five players for its whole length.
 */
function renderMinutes() {
  const order = depthOrder(roster);
  const per = periodMinutes(settings());
  const v = validatePeriods(periods, minutes, roster, settings());

  const head = `<tr><th class="mn-p">Player</th><th>Total</th>
    ${v.periods.map((r) => `<th class="mn-q ${r.ok ? '' : 'is-bad'}">Q${r.period}</th>`).join('')}
    <th>Split</th></tr>`;

  const rows = order.map((p) => {
    const row = periods[p.id] || new Array(PERIODS).fill(0);
    const total = Number(minutes[p.id]) || 0;
    const sum = row.reduce((a, b) => a + b, 0);
    return `<tr class="${total ? '' : 'is-off'}${sum === total ? '' : ' is-bad'}">
      <td class="mn-p"><span class="av">${esc(initials(p.name))}</span>
        <span class="rt-name">${esc(p.name)}</span></td>
      <td class="mn-tot">${total}</td>
      ${row.map((v2, i) => `<td><input class="mn-in" type="number" min="0" max="${per}"
        step="1" value="${v2}" data-pid="${esc(p.id)}" data-q="${i}"
        aria-label="${esc(p.name)} minutes in quarter ${i + 1}" /></td>`).join('')}
      <td class="mn-sum ${sum === total ? 'is-ok' : 'is-warn'}">${sum}</td>
    </tr>`;
  }).join('');

  el('paneMinutes').innerHTML = `
    <div class="mn-wrap-outer">
      <section class="card mn-card">
        <div class="rot-h"><i>⏱</i>Minutes By Quarter</div>
        <div class="mn-wrap"><table class="mn-table">
          <thead>${head}</thead><tbody>${rows}</tbody>
          <tfoot><tr><td class="mn-p">On the floor</td><td></td>
            ${v.periods.map((r) => `<td class="mn-foot ${r.ok ? 'is-ok' : 'is-warn'}"
              >${r.minutes}/${r.need}</td>`).join('')}
            <td></td></tr></tfoot>
        </table></div>
      </section>
      <aside class="mn-side">
        <section class="card">
          <div class="rot-h"><i>≡</i>Quarter Check</div>
          <div class="mi-state ${v.ok ? 'is-ok' : 'is-warn'}">
            <span class="mi-dot"></span>
            <div><b>${v.ok ? 'Every quarter is covered' : 'Quarters do not add up'}</b>
            ${v.ok ? '' : `<ul>${v.problems.slice(0, 6).map((x) =>
              `<li>${esc(x)}</li>`).join('')}</ul>`}</div>
          </div>
          <button class="qa mn-auto" id="mnSpread">
            <span class="qa-ic">↔</span>
            <span class="qa-t">Spread Evenly</span>
          </button>
        </section>
        <section class="card rot-tips">
          <div class="rot-h"><i>i</i>How This Works</div>
          <p>Each quarter needs ${ON_COURT} players on the floor for all ${per}
             minutes, which is ${ON_COURT * per} minutes a quarter.</p>
          <p>A player's four quarters have to add up to the total you set on the
             Rotations tab. Change a total there and the split is redrawn here.</p>
        </section>
      </aside>
    </div>`;
}

/* -------------------------------------------------------------- strategy */

/**
 * The coaching instructions.
 *
 * Every control here reaches the simulator — the panel on the right shows the
 * exact numbers the current choices feed into it. A strategy screen whose
 * dropdowns only remember themselves is decoration, so this one states what it
 * does and the effect is measurable in a simulated season.
 */
function renderStrategy() {
  const chosen = reconcileStrategy(strat);
  const rows = strategySummary(strat);

  el('paneStrategy').innerHTML = `
    <div class="st-grid">
      <div class="st-groups">
        ${Object.entries(STRATEGY).map(([key, group]) => `
          <section class="card st-card">
            <div class="rot-h"><i>⚙</i>${esc(group.label)}</div>
            <p class="lu-blurb">${esc(group.blurb)}</p>
            <div class="st-opts">
              ${Object.entries(group.options).map(([name, opt]) => `
                <button class="st-opt${name === chosen[key] ? ' is-on' : ''}"
                  data-group="${esc(key)}" data-opt="${esc(name)}">
                  <b>${esc(name)}</b>
                  <span>${esc(opt.blurb || '')}</span>
                </button>`).join('')}
            </div>
          </section>`).join('')}
      </div>
      <aside class="st-side">
        <section class="card">
          <div class="rot-h"><i>Σ</i>What This Does</div>
          ${rows.length
            ? rows.map((r) => `<div class="mi-row"><span>${esc(r.label)}</span>
                <b>${esc(r.value)}</b></div>`).join('')
            : '<p class="lu-blurb">Every dial is on its neutral setting, so nothing '
              + 'is changed from how the team would play anyway.</p>'}
          <p class="rot-note st-note">These are the actual multipliers the game
            simulator reads. Nothing here changes a player \u2014 no attribute, rating,
            potential or Overall is touched by a coaching instruction.</p>
        </section>
      </aside>
    </div>`;
}

const changed = () => JSON.stringify(minutes) !== JSON.stringify(saved)
  || JSON.stringify(units) !== JSON.stringify(savedUnits)
  || JSON.stringify(periods) !== JSON.stringify(savedPeriods)
  || JSON.stringify(strat) !== JSON.stringify(savedStrat);

/* ------------------------------------------------------------------ edit */

function setMinutes(id, value) {
  const cap = gameMinutes(settings());
  const n = Math.max(0, Math.min(cap, Math.round(Number(value) || 0)));
  minutes[id] = n;
  // A changed total makes the old quarter split stale — it no longer adds up —
  // so it is redrawn rather than left contradicting the number above it.
  periods = spreadPeriods(minutes, roster, settings());
  // The preset no longer describes what is on screen once a slider moves.
  if (presetName) { presetName = null; el('presetSel').value = ''; }
  render();
}

/** Every quick action rewrites the totals, so every one redraws the split. */
function afterMinutesChange() {
  periods = spreadPeriods(minutes, roster, settings());
  presetName = null;
  el('presetSel').value = '';
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
    afterMinutesChange();
  });

  el('presetSel').addEventListener('change', (e) => {
    const name = e.target.value;
    if (!name || !PRESETS[name]) { presetName = null; return; }
    minutes = applyPreset(depthOrder(roster), PRESETS[name], settings());
    periods = spreadPeriods(minutes, roster, settings());
    presetName = name;
    render();
  });

  // The four tabs are four views of one team, so one Save writes all of them
  // and one Revert takes all of them back.
  el('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab[data-tab]');
    if (!btn || btn.disabled) return;
    tab = btn.dataset.tab;
    render();
  });

  el('paneLineups').addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-unit]');
    if (!sel) return;
    const key = sel.dataset.unit;
    const seat = Number(sel.dataset.seat);
    const list = [...(units[key] || [])];
    const already = list.indexOf(sel.value);
    // Picking somebody already in the unit swaps the two seats rather than
    // leaving a duplicate, which is the only sensible reading of the action.
    if (already >= 0 && already !== seat) list[already] = list[seat];
    list[seat] = sel.value;
    units[key] = list;
    render();
  });

  el('paneMinutes').addEventListener('input', (e) => {
    const inp = e.target.closest('.mn-in');
    if (!inp) return;
    const per = periodMinutes(settings());
    const row = [...(periods[inp.dataset.pid] || new Array(PERIODS).fill(0))];
    row[Number(inp.dataset.q)] = Math.max(0, Math.min(per, Math.round(Number(inp.value) || 0)));
    periods[inp.dataset.pid] = row;
    render();
  });
  el('paneMinutes').addEventListener('click', (e) => {
    if (!e.target.closest('#mnSpread')) return;
    periods = spreadPeriods(minutes, roster, settings());
    render();
  });

  el('paneStrategy').addEventListener('click', (e) => {
    const btn = e.target.closest('.st-opt');
    if (!btn) return;
    strat = { ...strat, [btn.dataset.group]: btn.dataset.opt };
    render();
  });

  el('saveBtn').addEventListener('click', async () => {
    const v = validate(roster, minutes, settings());
    const pv = validatePeriods(periods, minutes, roster, settings());
    if (!v.ok || !pv.ok) return;
    team.rotation = { minutes: { ...minutes }, preset: presetName, periods: { ...periods } };
    team.lineups = { ...units };
    team.strategy = { ...strat };
    saved = { ...minutes };
    savedUnits = JSON.parse(JSON.stringify(units));
    savedPeriods = JSON.parse(JSON.stringify(periods));
    savedStrat = { ...strat };
    try { await saveLeague(leagueId, league); } catch (_) { /* read-only is fine */ }
    render();
  });

  el('revertBtn').addEventListener('click', () => {
    minutes = { ...saved };
    units = JSON.parse(JSON.stringify(savedUnits));
    periods = JSON.parse(JSON.stringify(savedPeriods));
    strat = { ...savedStrat };
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
  periods = reconcilePeriods(team.rotation && team.rotation.periods, minutes, roster, settings());
  units = reconcileUnits(team.lineups, roster);
  strat = reconcileStrategy(team.strategy);
  saved = { ...minutes };
  savedPeriods = JSON.parse(JSON.stringify(periods));
  savedUnits = JSON.parse(JSON.stringify(units));
  savedStrat = { ...strat };
  if (presetName) el('presetSel').value = presetName;

  bind();
  render();
}());

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
