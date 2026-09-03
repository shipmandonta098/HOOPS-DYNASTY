'use strict';

/**
 * roster.js — the Roster screen.
 *
 * GROUND RULE (same as the Dashboard): this screen renders ONLY what the save
 * actually holds. Every number here is either stored directly (name, age,
 * position, overall, potential, contract salary/years/options) or is plain
 * arithmetic over stored attributes (the five category grades, the summary
 * strip, the composition and salary panels).
 *
 * The reference design also carried a "Team Chemistry" panel and player
 * photographs. The save has neither chemistry/morale data nor images, so
 * those are absent rather than fabricated — initials stand in for photos, and
 * two panels built from real contract data stand in for chemistry.
 */

import { loadLeague, listSavesDetailed, saveLeague } from './db.js';
import { crestHTML } from './leagueConfig.js';
import { mountNav, activeLeagueId, renderNoCareer } from './shell.js';
import { initPlayerModal } from './playerModal.js';
import {
  ATTR_GROUPS, groupScore, letterGrade, gradeBand,
  ovr, initials, contractStatus, POSITION_NAME,
} from './playerRatings.js';
import {
  POSITIONS, SLOT_LABEL, autoChart, reconcile, move, starters, startingFive,
} from './depthChart.js';

const el = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtM = (n) => `$${Number(n).toFixed(2)}M`;

/* ------------------------------- view model -------------------------------
   One pass over the save, producing exactly what the screen draws. */
function computeVM(league, viewTeamId) {
  const meta = league.meta || {};
  const settings = league.settings || {};
  const userTeamId = meta.userTeamId || (league.teams[0] && league.teams[0].id);
  const wanted = viewTeamId || userTeamId;
  const team = league.teams.find((t) => t.id === wanted)
            || league.teams.find((t) => t.id === userTeamId)
            || league.teams[0] || {};
  const roster = (league.players || []).filter((p) => p.teamId === team.id);

  const signed = roster.filter((p) => p.contract);
  const statuses = roster.map((p) => contractStatus(p).tone);
  const underContract = statuses.filter((t) => t === 'ok').length;
  const expiring = statuses.filter((t) => t === 'warn').length;
  const optioned = statuses.filter((t) => t === 'option').length;
  const ages = roster.map((p) => p.age).filter((a) => typeof a === 'number');
  const payroll = signed.reduce((s, p) => s + (Number(p.contract.salary) || 0), 0);
  const cap = typeof settings.salaryCap === 'number' ? settings.salaryCap : null;

  const byId = new Map((league.players || []).map((p) => [p.id, p]));
  const chart = reconcile(team.depthChart, roster);
  const faIds = Array.isArray(league.freeAgents) ? league.freeAgents : [];
  const freeAgents = faIds.map((id) => byId.get(id)).filter(Boolean);

  return {
    meta, settings, team, roster, byId, chart, freeAgents,
    transactions: Array.isArray(league.transactions) ? league.transactions : [],
    userTeamId,
    // Roster moves only apply to the team you actually manage.
    isOwnTeam: team.id === userTeamId,
    seasonLabel: meta.currentSeason ? `${meta.currentSeason} Season` : '',
    phaseLabel: PHASE_LABEL[meta.phase] || meta.phase || '',
    totals: {
      players: roster.length,
      maxRoster: settings.maxRosterSize || null,
      signed: signed.length,
      underContract, expiring, optioned,
      avgAge: ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length) : null,
      payroll,
      cap,
      capRoom: cap != null ? cap - payroll : null,
    },
  };
}

const PHASE_LABEL = {
  regular_season: 'Regular Season', playoffs: 'Playoffs', offseason: 'Offseason',
  draft: 'Draft', free_agency: 'Free Agency', finals: 'Finals',
};

/* --------------------------------- filters -------------------------------- */
const VIEWS = {
  all:      () => true,
  contract: (p) => Boolean(p.contract),
  expiring: (p) => Boolean(p.contract) && (Number(p.contract.yearsRemaining) || 0) <= 1,
  unsigned: (p) => !p.contract,
};
const POS_ORDER = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 };

function visible(roster, view) {
  const f = VIEWS[view] || ((p) => p.position === view);
  return roster.filter(f);
}

const salaryOf = (p) => (p.contract ? Number(p.contract.salary) || 0 : -1);
const yearsOf  = (p) => (p.contract ? Number(p.contract.yearsRemaining) || 0 : -1);

const SORTS = {
  ovr:    (a, b) => ovr(b) - ovr(a),
  pot:    (a, b) => (b.potential || 0) - (a.potential || 0),
  age:    (a, b) => (a.age || 0) - (b.age || 0),
  salary: (a, b) => salaryOf(b) - salaryOf(a),
  years:  (a, b) => yearsOf(b) - yearsOf(a),
  pos:    (a, b) => (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9) || ovr(b) - ovr(a),
  name:   (a, b) => String(a.name).localeCompare(String(b.name)),
};

/* ---------------------------------- render -------------------------------- */
let vm = null;
let state = { view: 'all', sort: 'ovr', teamId: null, tab: 'players', faSort: 'ovr', mvScope: 'team' };
let leagueRef = null;      // the loaded save, mutated by roster actions
let leagueId = null;

/**
 * Fill the team switcher once. Teams are grouped by conference when the league
 * has a structure, so a 30-team list stays navigable; your own team is marked
 * so it's findable at a glance.
 */
function renderTeamOptions() {
  const sel = el('teamSel');
  const teams = leagueRef.teams || [];
  const label = (t) => `${`${t.city || ''} ${t.name || ''}`.trim()}${
    t.id === vm.userTeamId ? ' \u2605' : ''}`;
  const opt = (t) =>
    `<option value="${esc(t.id)}">${esc(label(t))}</option>`;

  const confs = (leagueRef.structure && leagueRef.structure.conferences) || [];
  const divs = (leagueRef.structure && leagueRef.structure.divisions) || [];
  if (confs.length) {
    const confOf = {};
    for (const d of divs) confOf[d.id] = d.conferenceId;
    const grouped = confs.map((c) => ({
      name: c.name,
      teams: teams.filter((t) => confOf[t.divisionId] === c.id),
    }));
    const placed = new Set(grouped.flatMap((g) => g.teams.map((t) => t.id)));
    const rest = teams.filter((t) => !placed.has(t.id));
    sel.innerHTML =
      grouped.filter((g) => g.teams.length).map((g) =>
        `<optgroup label="${esc(g.name)}">${g.teams.map(opt).join('')}</optgroup>`).join('') +
      (rest.length ? `<optgroup label="Unassigned">${rest.map(opt).join('')}</optgroup>` : '');
  } else {
    sel.innerHTML = teams.map(opt).join('');
  }
}

function renderHeader() {
  const t = vm.team;
  el('teamSel').value = t.id || '';
  el('teamChipSub').textContent =
    [vm.phaseLabel, vm.meta.currentSeason].filter(Boolean).join(' \u00b7 ');
  el('ownTag').hidden = !vm.isOwnTeam;
  const chip = el('teamChipLogo');
  chip.textContent = '';
  chip.style.background = 'none';
  chip.innerHTML = crestHTML(t, 34);
}

/** Redraw the header plus whichever panel is showing. */
function renderAll() {
  renderHeader();
  if (state.tab === 'players') {
    renderStrip(); renderTable(); renderComposition(); renderSalary();
  } else if (state.tab === 'depth') {
    renderDepth();
  } else if (state.tab === 'moves') {
    renderMoves();
  } else if (state.tab === 'fa') {
    renderFreeAgents();
  }
}

/** Keep ?team= in the address bar so a roster view is linkable and survives a reload. */
function syncUrl() {
  const u = new URL(location.href);
  if (vm.isOwnTeam) u.searchParams.delete('team');
  else u.searchParams.set('team', vm.team.id);
  if (state.tab === 'players') u.searchParams.delete('tab');
  else u.searchParams.set('tab', state.tab);
  history.replaceState(null, '', u);
}

function renderStrip() {
  const T = vm.totals;
  const cells = [
    ['Total Players', T.maxRoster ? `${T.players} / ${T.maxRoster}` : String(T.players), ''],
    ['Under Contract', String(T.underContract), ''],
    ['Expiring', String(T.expiring), T.expiring ? 'warn' : ''],
    ...(T.optioned ? [['Option Years', String(T.optioned), '']] : []),
    ['Average Age', T.avgAge != null ? T.avgAge.toFixed(1) : '—', ''],
    ['Total Salary', fmtM(T.payroll), ''],
    ['Salary Cap Room',
      T.capRoom != null ? fmtM(Math.abs(T.capRoom)) : '—',
      T.capRoom == null ? '' : T.capRoom < 0 ? 'neg' : 'pos'],
  ];
  el('strip').innerHTML = cells.map(([k, v, tone]) =>
    `<div class="s-cell"><div class="k">${esc(k)}</div>` +
    `<div class="v ${tone}">${esc(v)}</div></div>`).join('');
  // Say it plainly when the roster is over the cap rather than showing a
  // positive-looking number.
  if (T.capRoom != null && T.capRoom < 0) {
    el('strip').lastElementChild.querySelector('.k').textContent = 'Over The Cap';
  }
}

function renderTable() {
  const rows = visible(vm.roster, state.view).sort(SORTS[state.sort] || SORTS.ovr);
  const best = vm.roster.length ? Math.max(...vm.roster.map(ovr)) : -1;

  el('thead').innerHTML =
    ['#', 'Player', 'Pos', 'Age', 'OVR', 'POT', 'Contract', 'Salary', 'Years']
      .map((h, i) => `<th class="${['c-num','c-player','c-pos','c-age','c-ovr','c-pot','c-con','c-sal','c-yrs'][i]}">${h}</th>`).join('') +
    ATTR_GROUPS.map((g, i) =>
      `<th class="c-grade${i === 0 ? ' col-first' : ''}" title="${esc(g.label)}">${esc(g.short)}</th>`).join('') +
    '<th class="c-menu"><span class="sr-only">Actions</span></th>';

  el('tbody').innerHTML = rows.map((p, i) => {
    const c = contractStatus(p);
    const o = ovr(p);
    const grades = ATTR_GROUPS.map((g, gi) => {
      const v = groupScore(p, g);
      return `<td class="c-grade${gi === 0 ? ' col-first' : ''} g-${gradeBand(v)}" title="${esc(g.label)}${
        v == null ? '' : ' ' + v}">${esc(letterGrade(v))}</td>`;
    }).join('');
    return `<tr>
      <td class="c-num">${i + 1}</td>
      <td class="c-player">
        <span class="av">${esc(initials(p.name))}</span>
        <span class="pn" data-player="${esc(p.id)}" role="button" tabindex="0">${esc(p.name)}</span>
        ${o === best ? '<span class="star" title="Highest overall on the roster">★</span>' : ''}
      </td>
      <td class="c-pos">${esc(p.position || '—')}</td>
      <td class="c-age">${p.age ?? '—'}</td>
      <td class="c-ovr ${band(o)}">${o || '—'}</td>
      <td class="c-pot ${band(p.potential)}">${p.potential ?? '—'}</td>
      <td class="c-con"><span class="pill t-${c.tone}">${esc(c.label)}</span>
        <span class="sub">${esc(c.sub)}</span></td>
      <td class="c-sal">${p.contract ? fmtM(p.contract.salary) : '—'}</td>
      <td class="c-yrs">${p.contract ? (Number(p.contract.yearsRemaining) || 0) : '—'}</td>
      ${grades}
      <td class="c-menu"><button class="row-dots" data-menu="${esc(p.id)}"
        aria-haspopup="true" aria-label="Actions for ${esc(p.name)}">&#8943;</button></td>
    </tr>`;
  }).join('');

  const note = el('emptyNote');
  note.hidden = rows.length > 0;
  if (!rows.length) {
    note.textContent = vm.roster.length
      ? 'No players match this view.'
      : 'This team has no players on its roster.';
  }
}

/** Overall/potential colour band — same thresholds as the category grades. */
const band = (v) => (typeof v === 'number' ? 'g-' + gradeBand(v) : '');

function renderComposition() {
  const byPos = {};
  for (const p of vm.roster) byPos[p.position] = (byPos[p.position] || 0) + 1;
  const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
  const max = Math.max(1, ...positions.map((k) => byPos[k] || 0));

  const ages = vm.roster.map((p) => p.age).filter((a) => typeof a === 'number');
  const bands = [
    ['Under 23', ages.filter((a) => a < 23).length],
    ['23 – 27',  ages.filter((a) => a >= 23 && a <= 27).length],
    ['28 – 31',  ages.filter((a) => a >= 28 && a <= 31).length],
    ['32+',      ages.filter((a) => a >= 32).length],
  ];
  const ageMax = Math.max(1, ...bands.map(([, n]) => n));

  el('comp').innerHTML = `
    <div class="comp-block">
      <div class="comp-h">By Position</div>
      ${positions.map((k) => bar(k, byPos[k] || 0, max)).join('')}
    </div>
    <div class="comp-block">
      <div class="comp-h">By Age</div>
      ${bands.map(([k, n]) => bar(k, n, ageMax)).join('')}
    </div>`;
}

function bar(label, n, max) {
  return `<div class="bar-row">
    <span class="bl">${esc(label)}</span>
    <span class="bt"><span class="bf" style="width:${(n / max) * 100}%"></span></span>
    <span class="bn">${n}</span>
  </div>`;
}

function renderSalary() {
  const T = vm.totals;
  const signed = vm.roster.filter((p) => p.contract);
  // Split by contract shape — every one of these flags is a stored field.
  const buckets = [
    ['Player Options', signed.filter((p) => p.contract.playerOption)],
    ['Team Options',   signed.filter((p) => p.contract.teamOption && !p.contract.playerOption)],
    ['Expiring',       signed.filter((p) => !p.contract.playerOption && !p.contract.teamOption
                                            && (Number(p.contract.yearsRemaining) || 0) <= 1)],
    ['Multi-Year',     signed.filter((p) => !p.contract.playerOption && !p.contract.teamOption
                                            && (Number(p.contract.yearsRemaining) || 0) > 1)],
  ].map(([label, list], i) => ({
    label, i,
    total: list.reduce((s, p) => s + (Number(p.contract.salary) || 0), 0),
    count: list.length,
  })).filter((b) => b.count > 0);

  const capPct = T.cap ? Math.min(100, (T.payroll / T.cap) * 100) : 0;

  // Donut is a conic-gradient over the same buckets — no chart library, and
  // every slice is a real sum of stored contract salaries.
  let acc = 0;
  const stops = buckets.map((b) => {
    const from = acc;
    acc += T.payroll ? (b.total / T.payroll) * 100 : 0;
    return `var(--slice-${b.i}) ${from}% ${acc}%`;
  }).join(', ');

  el('sal').innerHTML = `
    <div class="sal-top">
    <div class="donut" style="--stops:${stops || 'var(--stroke) 0% 100%'}"
         role="img" aria-label="Payroll split by contract type">
      <span class="hole"><b>${fmtM(T.payroll)}</b><em>Total Salary</em></span>
    </div>
    <div class="cap-line">
      <div class="cap-head">
        <span>Payroll <b>${fmtM(T.payroll)}</b></span>
        <span>Cap <b>${T.cap != null ? fmtM(T.cap) : '—'}</b></span>
      </div>
      <div class="cap-track"><span class="cap-fill ${
        T.capRoom != null && T.capRoom < 0 ? 'over' : ''}" style="width:${capPct}%"></span></div>
      ${T.capRoom == null ? '' : `<div class="cap-note ${T.capRoom < 0 ? 'neg' : ''}">${
        T.capRoom < 0 ? `${fmtM(Math.abs(T.capRoom))} over the cap`
                      : `${fmtM(T.capRoom)} of cap room`}</div>`}
    </div>
    </div>
    <ul class="legend-list">
      ${buckets.map((b) => `<li>
        <span class="dot d${b.i}"></span>
        <span class="ll">${esc(b.label)} <em>${b.count}</em></span>
        <span class="lv">${fmtM(b.total)}</span>
        <span class="lp">${T.payroll ? Math.round((b.total / T.payroll) * 100) : 0}%</span>
      </li>`).join('') || '<li class="none">No players under contract.</li>'}
    </ul>`;
}

function renderLegend() {
  el('legend').innerHTML =
    `<p>Each grade is a weighted average of the player's stored attributes —
        nothing is invented. Every attribute feeds exactly one category.</p>` +
    `<ul>${ATTR_GROUPS.map((g) => `<li><b>${esc(g.label)}</b> (${esc(g.short)}) — ${
      g.parts.map(([a]) => esc(camelToWords(a))).join(', ')}</li>`).join('')}</ul>`;
}

const camelToWords = (s) => s.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());


/* =============================== DEPTH CHART ===============================
   Five columns, one per position, starters at the top. Reordering writes the
   chart back to the team and saves — on your own roster only. */

function renderDepth() {
  const five = starters(vm.chart, vm.byId);
  const rating = startingFive(vm.chart, vm.byId);
  const gaps = five.filter((s) => !s.player).map((s) => s.pos);

  el('dcFive').innerHTML = five.map(({ pos, player }) => `
    <div class="dc-slot${player ? '' : ' is-empty'}">
      <div class="dp">${esc(pos)}</div>
      ${player ? `
        <div class="dn" data-player="${esc(player.id)}" role="button" tabindex="0">${esc(player.name)}</div>
        <div class="do g-${gradeBand(ovr(player))}">${ovr(player)}</div>`
      : `<div class="dn dim">No ${esc(POSITION_NAME[pos] || pos)}</div><div class="do dim">—</div>`}
    </div>`).join('') +
    `<div class="dc-slot dc-rating">
      <div class="dp">Starting Five</div>
      <div class="dn dim">average overall</div>
      <div class="do g-${gradeBand(rating)}">${rating ?? '—'}</div>
    </div>`;

  el('dcHint').textContent = gaps.length
    ? `No player listed at ${gaps.join(', ')} — the roster has nobody at ${
        gaps.length > 1 ? 'those positions' : 'that position'}.`
    : (vm.isOwnTeam ? 'Use the arrows to set your rotation.' : 'Read-only — this is not your team.');
  el('dcAuto').disabled = !vm.isOwnTeam;

  el('dcCols').innerHTML = POSITIONS.map((pos) => {
    const ids = vm.chart[pos] || [];
    return `<div class="card dc-col">
      <h3>${esc(POSITION_NAME[pos] || pos)} <span>${esc(pos)}</span></h3>
      ${ids.length ? ids.map((id, i) => {
        const p = vm.byId.get(id);
        if (!p) return '';
        return `<div class="dc-row${i === 0 ? ' is-starter' : ''}">
          <span class="ds">${esc(SLOT_LABEL[i] || `${i + 1}th`)}</span>
          <span class="dnm" data-player="${esc(p.id)}" role="button" tabindex="0"
            title="${esc(p.name)}">${esc(p.name)}</span>
          <span class="dov g-${gradeBand(ovr(p))}">${ovr(p)}</span>
          <span class="dbtns">
            <button class="icon-mini" data-dc="up" data-pos="${esc(pos)}" data-i="${i}"
              ${!vm.isOwnTeam || i === 0 ? 'disabled' : ''} aria-label="Move ${esc(p.name)} up">&#9650;</button>
            <button class="icon-mini" data-dc="down" data-pos="${esc(pos)}" data-i="${i}"
              ${!vm.isOwnTeam || i === ids.length - 1 ? 'disabled' : ''} aria-label="Move ${esc(p.name)} down">&#9660;</button>
          </span>
        </div>`;
      }).join('') : '<p class="dc-none">Nobody on the roster plays here.</p>'}
    </div>`;
  }).join('');
}

/** Persist the chart onto the team and write the save. */
async function saveChart(chart) {
  const team = (leagueRef.teams || []).find((t) => t.id === vm.team.id);
  if (!team) return;
  team.depthChart = chart;
  try {
    await saveLeague(leagueId, leagueRef);
  } catch (err) {
    console.error('Could not save the depth chart:', err);
    alert('The depth chart could not be saved.');
    return;
  }
  vm = computeVM(leagueRef, state.teamId);
  renderDepth();
}

/* =============================== ROSTER MOVES ==============================
   The stored log, newest first. Nothing is synthesised: a league where no
   move has been made shows an empty state, which is the truth. */

const MOVE_ICON = { waive: '\u2715', sign: '\u002B', trade: '\u21C4', draft: '\u2605',
  release: '\u2715', extension: '\u21BB' };

function renderMoves() {
  const all = vm.transactions;
  const rows = (state.mvScope === 'team'
    ? all.filter((t) => t.teamId === vm.team.id)
    : all).slice().reverse();

  if (!rows.length) {
    el('mvList').innerHTML = `<p class="empty-note">${
      all.length
        ? 'No moves recorded for this team yet.'
        : 'No roster moves yet. Waiving or signing a player records an entry here.'
    }</p>`;
    return;
  }
  const teamName = (id) => {
    const t = (leagueRef.teams || []).find((x) => x.id === id);
    return t ? `${t.city || ''} ${t.name || ''}`.trim() : '—';
  };
  el('mvList').innerHTML = `<div class="mv-rows">${rows.map((t) => `
    <div class="mv-row">
      <span class="mv-ic t-${esc(t.type)}">${MOVE_ICON[t.type] || '\u2022'}</span>
      <span class="mv-main">
        <b>${esc(t.playerName || 'Unknown player')}</b>
        <em>${esc(t.detail || t.type)}</em>
      </span>
      <span class="mv-team">${esc(teamName(t.teamId))}</span>
      <span class="mv-when">${esc(fmtWhen(t))}</span>
    </div>`).join('')}</div>`;
}

function fmtWhen(t) {
  const season = t.season ? `${t.season}` : '';
  if (!t.at) return season;
  const d = new Date(t.at);
  if (Number.isNaN(d.getTime())) return season;
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}${
    season ? ` \u00b7 ${season}` : ''}`;
}

/** Append an entry to the log. Called only when a move genuinely happens. */
function logMove(entry) {
  if (!Array.isArray(leagueRef.transactions)) leagueRef.transactions = [];
  leagueRef.transactions.push({
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    season: (leagueRef.meta || {}).currentSeason || null,
    ...entry,
  });
}

/* =============================== FREE AGENTS ===============================
   league.freeAgents, which fills as players are actually released. */

const FA_SORTS = {
  ovr: (a, b) => ovr(b) - ovr(a),
  pot: (a, b) => (b.potential || 0) - (a.potential || 0),
  age: (a, b) => (a.age || 0) - (b.age || 0),
  pos: (a, b) => (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9) || ovr(b) - ovr(a),
  name: (a, b) => String(a.name).localeCompare(String(b.name)),
};

function renderFreeAgents() {
  const list = vm.freeAgents.slice().sort(FA_SORTS[state.faSort] || FA_SORTS.ovr);
  const ages = list.map((p) => p.age).filter((a) => typeof a === 'number');
  const spots = vm.totals.maxRoster != null ? vm.totals.maxRoster - vm.totals.players : null;
  const min = typeof vm.settings.minSalary === 'number' ? vm.settings.minSalary : null;

  el('faStrip').innerHTML = [
    ['Available', String(list.length), ''],
    ['Average Age', ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : '—', ''],
    ['Best Available', list.length ? String(ovr(list.slice().sort(FA_SORTS.ovr)[0])) : '—', ''],
    ['Open Roster Spots', spots == null ? '—' : String(Math.max(0, spots)), spots > 0 ? 'pos' : ''],
    ['Minimum Salary', min != null ? fmtM(min) : '—', ''],
  ].map(([k, v, tone]) =>
    `<div class="s-cell"><div class="k">${esc(k)}</div><div class="v ${tone}">${esc(v)}</div></div>`).join('');

  el('faHead').innerHTML =
    ['Player', 'Pos', 'Age', 'OVR', 'POT', 'Last Salary']
      .map((h, i) => `<th class="${['c-player','c-pos','c-age','c-ovr','c-pot','c-sal'][i]}">${h}</th>`).join('') +
    ATTR_GROUPS.map((g, i) =>
      `<th class="c-grade${i === 0 ? ' col-first' : ''}" title="${esc(g.label)}">${esc(g.short)}</th>`).join('') +
    '<th class="c-menu"><span class="sr-only">Actions</span></th>';

  el('faBody').innerHTML = list.map((p) => {
    const o = ovr(p);
    const grades = ATTR_GROUPS.map((g, gi) => {
      const v = groupScore(p, g);
      return `<td class="c-grade${gi === 0 ? ' col-first' : ''} g-${gradeBand(v)}"
        title="${esc(g.label)}${v == null ? '' : ' ' + v}">${esc(letterGrade(v))}</td>`;
    }).join('');
    const canSign = vm.isOwnTeam && spots > 0 && min != null;
    return `<tr>
      <td class="c-player">
        <span class="av">${esc(initials(p.name))}</span>
        <span class="pn" data-player="${esc(p.id)}" role="button" tabindex="0">${esc(p.name)}</span>
      </td>
      <td class="c-pos">${esc(p.position || '—')}</td>
      <td class="c-age">${p.age ?? '—'}</td>
      <td class="c-ovr ${band(o)}">${o || '—'}</td>
      <td class="c-pot ${band(p.potential)}">${p.potential ?? '—'}</td>
      <td class="c-sal">${p.contract ? fmtM(p.contract.salary) : '—'}</td>
      ${grades}
      <td class="c-menu"><button class="mini sign-btn" data-sign="${esc(p.id)}"
        ${canSign ? '' : `disabled title="${esc(signBlockedWhy(spots, min))}"`}>Sign</button></td>
    </tr>`;
  }).join('');

  const note = el('faEmpty');
  note.hidden = list.length > 0;
  if (!list.length) {
    note.textContent = 'No free agents. Players appear here when they are waived.';
  }
}

function signBlockedWhy(spots, min) {
  if (!vm.isOwnTeam) return 'You can only sign players to your own team.';
  if (min == null) return 'This league has no minimum salary set.';
  if (!(spots > 0)) return 'Your roster is full.';
  return '';
}

/**
 * Sign a free agent to a one-year minimum deal. That is the only contract this
 * screen can offer honestly — anything else needs the negotiation system that
 * does not exist yet, and inventing terms would be fiction.
 */
async function signPlayer(playerId) {
  if (!vm.isOwnTeam) return;
  const p = vm.freeAgents.find((x) => x.id === playerId);
  const min = vm.settings.minSalary;
  const spots = vm.totals.maxRoster != null ? vm.totals.maxRoster - vm.totals.players : 1;
  if (!p || typeof min !== 'number' || spots <= 0) return;

  if (!confirm(`Sign ${p.name} for 1 year at ${fmtM(min)}?\n\n` +
      `A one-year minimum deal is the only offer this screen can make — ` +
      `contract negotiation is not built yet.`)) return;

  const rec = (leagueRef.players || []).find((x) => x.id === p.id);
  if (!rec) return;
  rec.teamId = vm.team.id;
  rec.contract = { salary: min, yearsRemaining: 1, type: 'vet_min', playerOption: false, teamOption: false };
  leagueRef.freeAgents = (leagueRef.freeAgents || []).filter((id) => id !== p.id);
  logMove({ type: 'sign', teamId: vm.team.id, playerId: p.id, playerName: p.name,
    position: p.position, salary: min, years: 1,
    detail: `Signed to a 1-year minimum deal (${fmtM(min)})` });

  try {
    await saveLeague(leagueId, leagueRef);
  } catch (err) {
    console.error('Could not save after signing:', err);
    alert('The player could not be signed — the save failed to write.');
    return;
  }
  vm = computeVM(leagueRef, state.teamId);
  renderAll();
}

/* --------------------------------- tabs ---------------------------------- */
function showTab(tab) {
  state.tab = tab;
  for (const el2 of document.querySelectorAll('.panel')) {
    el2.hidden = el2.dataset.panel !== tab;
  }
  for (const b of document.querySelectorAll('.tab')) {
    b.classList.toggle('is-active', b.dataset.tab === tab);
  }
  closeRowMenu();
  renderAll();
  syncUrl();
}

/* ------------------------------- row actions -------------------------------
   Negotiate and Trade need contract-negotiation and trade systems that do not
   exist yet, so they render disabled rather than pretending. Waive is real: it
   frees the player, drops his salary off the payroll and writes the save. */

let openMenuFor = null;

function closeRowMenu() {
  const m = el('rowMenu');
  if (m) m.remove();
  openMenuFor = null;
}

function openRowMenu(btn, playerId) {
  closeRowMenu();
  const p = vm.roster.find((x) => x.id === playerId);
  if (!p) return;
  openMenuFor = playerId;

  const menu = document.createElement('div');
  menu.id = 'rowMenu';
  menu.className = 'row-menu';
  menu.setAttribute('role', 'menu');
  // Roster moves belong to the team you manage. Viewing another club's roster
  // is read-only, and the menu says why rather than silently doing nothing.
  const own = vm.isOwnTeam;
  const notYours = 'You only manage ' +
    `${(leagueRef.teams.find((t) => t.id === vm.userTeamId) || {}).name || 'your own team'}`;
  menu.innerHTML = `
    <div class="rm-head">${esc(p.name)}</div>
    <button role="menuitem" class="is-todo" disabled title="Not built yet">Negotiate Contract</button>
    <button role="menuitem" ${own ? 'data-act="waive"' : `class="is-todo" disabled title="${esc(notYours)}"`}>Waive Player</button>
    <button role="menuitem" class="is-todo" disabled title="Not built yet">Trade Player</button>
    ${own ? '' : `<div class="rm-note">${esc(notYours)}.</div>`}`;
  document.body.appendChild(menu);

  // Anchor under the button, nudged back inside the viewport if it would spill.
  const r = btn.getBoundingClientRect();
  const w = menu.offsetWidth;
  menu.style.top = `${Math.min(r.bottom + 6, window.innerHeight - menu.offsetHeight - 8)}px`;
  menu.style.left = `${Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8))}px`;

  menu.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'waive') await waivePlayer(p);
    closeRowMenu();
  });
}

/**
 * Release a player: teamId goes null, his id joins freeAgents, and the save is
 * written. His salary comes fully off the payroll because the save has no
 * dead-money model — the confirmation says so rather than quietly implying
 * that releasing a contract is free in a real cap system.
 */
async function waivePlayer(p) {
  if (!vm.isOwnTeam) return;   // only ever your own roster
  const salary = p.contract ? Number(p.contract.salary) || 0 : 0;
  const ok = confirm(
    `Waive ${p.name}?\n\n` +
    `He becomes a free agent and his ${fmtM(salary)} comes off the payroll in full — ` +
    `this save has no dead-money model, so released salary is not retained.\n\n` +
    `This cannot be undone.`);
  if (!ok) return;

  const rec = (leagueRef.players || []).find((x) => x.id === p.id);
  if (!rec) return;
  rec.teamId = null;
  if (!Array.isArray(leagueRef.freeAgents)) leagueRef.freeAgents = [];
  if (!leagueRef.freeAgents.includes(rec.id)) leagueRef.freeAgents.push(rec.id);
  logMove({ type: 'waive', teamId: vm.team.id, playerId: rec.id, playerName: rec.name,
    position: rec.position, salary,
    detail: `Waived \u2014 ${fmtM(salary)} off the payroll` });

  try {
    await saveLeague(leagueId, leagueRef);
  } catch (err) {
    console.error('Could not save after waiving:', err);
    alert('The player could not be waived — the save failed to write.');
    return;
  }
  // Recompute from the mutated league so every panel agrees with the new roster.
  vm = computeVM(leagueRef, state.teamId);
  renderAll();
}

/* ----------------------------------- boot --------------------------------- */
async function boot() {
  let league = null;
  let id = null;
  try {
    id = await activeLeagueId(listSavesDetailed);
    if (id) league = await loadLeague(id);
  } catch (err) {
    console.error('Failed to load league:', err);
  }

  mountNav('roster', id);
  if (!league) { renderNoCareer(); return; }

  leagueRef = league;
  leagueId = id;
  initPlayerModal(league);

  const params = new URLSearchParams(location.search);
  state.teamId = params.get('team') || null;
  const wantTab = params.get('tab');
  if (['players', 'depth', 'moves', 'fa'].includes(wantTab)) state.tab = wantTab;
  vm = computeVM(league, state.teamId);
  state.teamId = vm.team.id;          // an unknown ?team= falls back to yours
  renderTeamOptions();
  renderLegend();
  showTab(state.tab);                 // draws the panel and syncs the URL

  el('teamSel').addEventListener('change', (e) => {
    state.teamId = e.target.value;
    closeRowMenu();
    vm = computeVM(leagueRef, state.teamId);
    // Position filters can leave an empty table on a team with a different
    // shape, so a team change starts from the full roster again.
    state.view = 'all';
    el('viewSel').value = 'all';
    renderAll();
    syncUrl();
    // The player profile looks players up in the league, not the roster, so it
    // needs no rebinding — but the row menu was anchored to the old team.
    closeRowMenu();
  });
  el('viewSel').addEventListener('change', (e) => { state.view = e.target.value; renderTable(); });
  el('sortSel').addEventListener('change', (e) => { state.sort = e.target.value; renderTable(); });
  el('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('.tab');
    if (!b) return;
    if (b.classList.contains('is-todo')) { e.preventDefault(); return; }
    if (b.dataset.tab !== state.tab) showTab(b.dataset.tab);
  });

  // Depth chart: reorder within a position, or reseed from overall.
  el('dcCols').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-dc]');
    if (!b || b.disabled || !vm.isOwnTeam) return;
    await saveChart(move(vm.chart, b.dataset.pos, Number(b.dataset.i), b.dataset.dc === 'up' ? -1 : 1));
  });
  el('dcAuto').addEventListener('click', async () => {
    if (!vm.isOwnTeam) return;
    await saveChart(autoChart(vm.roster));
  });

  el('mvScope').addEventListener('change', (e) => { state.mvScope = e.target.value; renderMoves(); });
  el('faSort').addEventListener('change', (e) => { state.faSort = e.target.value; renderFreeAgents(); });
  el('faBody').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-sign]');
    if (b && !b.disabled) await signPlayer(b.dataset.sign);
  });

  // Row actions. The dots live inside the table, which re-renders, so the
  // listener is delegated from the tbody rather than bound per button.
  el('tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('.row-dots');
    if (!btn) return;
    e.stopPropagation();
    if (openMenuFor === btn.dataset.menu) { closeRowMenu(); return; }
    openRowMenu(btn, btn.dataset.menu);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#rowMenu') && !e.target.closest('.row-dots')) closeRowMenu();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeRowMenu(); });
  window.addEventListener('resize', closeRowMenu);
}

boot();
