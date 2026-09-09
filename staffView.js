'use strict';

/**
 * staffView.js — the Staff screen.
 *
 * Renders staff.js's `staffPage` contract and nothing else. Every figure on
 * this page comes out of that function, so what the screen shows and what the
 * brief's JSON says are the same thing by construction rather than by two
 * people agreeing.
 *
 * THE ONE THING THIS SCREEN INSISTS ON. Three of the brief's five influence
 * systems have nothing behind them in this game — injuries are not simulated,
 * draft ratings are already exact so a scout has no error to reduce, and
 * nothing reads player morale. Those rows carry a NOT SIMULATED tag, no
 * number, and the reason. A staff page whose whole point is "here is what your
 * staff changes" has to be honest about the half that changes nothing yet,
 * because a plausible percentage is indistinguishable from a real one.
 */

import { loadLeague, listSavesDetailed, touchLastPlayed } from './db.js';
import { mountNav, activeLeagueId, renderNoCareer, markPlayed } from './shell.js';
import { crestHTML } from './leagueConfig.js';
import { staffPage, grade } from './staff.js';

const el = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let league = null;
let teamId = null;

const money = (n) => (Number.isFinite(Number(n)) ? `$${Number(n).toFixed(1)}M` : '—');

/** The influence rows, in the order the brief lists them. */
const INFLUENCE_ORDER = [
  'playerDevelopment', 'fatigueRecovery', 'teamTendencies',
  'injuryPrevention', 'scoutingAccuracy', 'morale',
];

function renderHeader(page) {
  const h = page.header;
  const team = (league.teams || []).find((t) => t.id === teamId);
  el('crest').innerHTML = team ? crestHTML(team, 44) : '🏀';
  el('city').textContent = team ? team.city : '—';
  el('teamName').textContent = team ? team.name : h.team;
  el('coachLine').textContent = h.coachSummary || 'No head coach on record.';
  el('season').textContent = h.season == null ? '—' : String(h.season);

  el('totalSalary').textContent = money(h.totalSalary);
  // Staff pay sits OUTSIDE the player cap, so the share is offered as a sense
  // of scale and labelled as such rather than implied to count against it.
  const cap = Number(league.settings && league.settings.salaryCap);
  el('capNote').textContent = Number.isFinite(cap) && cap > 0
    ? `${((h.totalSalary / cap) * 100).toFixed(1)}% the size of the $${cap}M player cap `
      + '(staff pay is separate from it)'
    : `${h.staffCount} on staff`;

  el('morale').textContent = h.staffMorale == null ? '—' : h.staffMorale.toFixed(1);
  el('moraleBasis').textContent = h.staffMoraleBasis;
  el('staffCount').textContent = `${h.staffCount} on staff`;
}

function renderTable(page) {
  el('staffBody').innerHTML = page.staffTable.map((r) => {
    const g = grade(r.rating);
    return `<tr>
      <td class="sf-role"><span class="sf-rolecell">
        <span class="ic" aria-hidden="true">${r.roleIcon}</span>${esc(r.role)}</span></td>
      <td class="sf-name">${esc(r.name)}</td>
      <td class="sf-spec">${r.specialty ? `<span class="sf-speccell">
        <span aria-hidden="true">${r.specialtyIcon || ''}</span>${esc(r.specialty)}</span>` : '—'}</td>
      <td class="sf-rate"><span class="sf-ratecell">
        <b>${r.rating == null ? '—' : r.rating}</b>
        <i class="gr ${g.cls}" title="${esc(g.label)}">${g.letter}</i></span></td>
      <td class="sf-con">${esc(r.contract)}${
        r.expiring ? '<span class="sf-badge">Contract Year</span>' : ''}</td>
      <td class="sf-sal">${money(r.salary)}</td>
      <td class="sf-infl">${esc(r.influence)}</td>
    </tr>`;
  }).join('');

  el('gradeLegend').innerHTML = [
    { cls: 'gr-a', letter: 'A', text: '80+ elite' },
    { cls: 'gr-b', letter: 'B', text: '65–79 solid' },
    { cls: 'gr-c', letter: 'C', text: 'under 65 weak' },
  ].map((k) => `<span class="sf-key"><i class="gr ${k.cls}">${k.letter}</i>${esc(k.text)}</span>`)
    .join('')
    + '<span class="sf-key">Psychologist and development director are rated on a '
    + '15-point boost scale, shown here normalized to 100.</span>';
}

function renderInfluence(page) {
  const b = page.influenceBreakdown;
  el('influence').innerHTML = INFLUENCE_ORDER.map((k) => {
    const r = b[k];
    if (!r) return '';
    // Flat-point channels get their own colour: they are not percentages and
    // should not read as one.
    const flat = r.live && r.percent == null;
    return `<div class="sf-inf ${r.live ? 'is-live' : 'is-dead'}">
      <div class="sf-inf-h">
        <b>${esc(r.system)}</b>
        <span class="sf-tag">${r.live ? 'Live' : 'Not simulated'}</span>
      </div>
      <div class="sf-inf-v ${flat ? 'is-flat' : ''}">${esc(r.display)}</div>
      <div class="sf-inf-body">
        ${r.detail && r.detail.length
          ? `<ul>${r.detail.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
        ${r.note ? `<p class="sf-inf-why">${esc(r.note)}</p>` : ''}
        ${r.appliedIn ? `<p class="sf-inf-where">Applied in ${esc(r.appliedIn)}</p>` : ''}
      </div>
    </div>`;
  }).join('');
}

function renderCompat(page) {
  const c = page.compatibilityPanel;
  if (c.match == null) {
    el('compat').innerHTML = `<p class="sf-fit-say">${esc(c.note || 'Nothing to compare.')}</p>`;
    return;
  }
  el('compat').innerHTML = `
    <div class="sf-fit-top">
      <span class="sf-fit-pct">${c.match}%</span>
      <span class="sf-fit-sys">${esc(c.philosophy)}</span>
    </div>
    <div class="sf-bar"><i style="width:${Math.max(0, Math.min(100, c.match))}%"></i></div>
    <p class="sf-fit-say">Measured against the rest of the league, not against a fixed
      threshold: 50% on a line means this roster is exactly league-average at it, so it
      neither suits the system nor fights it. Each line shows what the system asks for,
      what this roster does, and what the league does.</p>
    ${c.keys.map((k) => `<div class="sf-fitrow">
      <span class="k">${esc(labelOf(k.key))}
        <small>wants ${esc(k.wants)} · team ${k.team} vs league ${k.league}</small></span>
      <span class="s">${k.z > 0 ? '+' : ''}${k.z} SD</span>
      <span class="s ${k.score >= 60 ? 'hi' : k.score <= 40 ? 'lo' : ''}">${Math.round(k.score)}</span>
    </div>`).join('')}`;
}

/* Tendency keys are camelCase in the data; the panel shows them as words. */
const labelOf = (k) => String(k)
  .replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();

function renderControls(page) {
  const c = page.controls;
  el('expiringCount').textContent = c.expiring.length
    ? `${c.expiring.length} expiring` : 'None expiring';
  el('controls').innerHTML = `
    <div class="sf-cons">${c.contracts.map((k) => `
      <div class="sf-con-card ${k.expiring ? 'is-expiring' : ''}">
        <div class="sf-con-role">${esc(k.role)}</div>
        <div class="sf-con-name">${esc(k.name)}${
          k.expiring ? '<span class="sf-badge">Contract Year</span>' : ''}</div>
        <div class="sf-con-meta">
          <span>${k.contractYears} yr${k.contractYears === 1 ? '' : 's'}</span>
          <span>${money(k.salary)}</span>
        </div>
      </div>`).join('')}</div>
    <div class="sf-acts">
      <button class="card-btn" style="width:auto" disabled>Hire Staff</button>
      <button class="card-btn" style="width:auto" disabled>Release Staff</button>
      <span class="why">${esc(c.unavailableReason)}</span>
    </div>`;
}

function render() {
  const { staffPage: page } = staffPage(league, teamId);

  const rows = INFLUENCE_ORDER.map((k) => page.influenceBreakdown[k]).filter(Boolean);
  const live = rows.filter((r) => r.live).map((r) => r.system);
  const dead = rows.filter((r) => !r.live).map((r) => r.system);
  const list = (a) => (a.length < 2 ? a.join('')
    : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
  el('liveNote').innerHTML = dead.length
    ? `<b>${live.length} of these ${rows.length} figures are applied by the simulation;
       ${dead.length} are not.</b> ${esc(list(live))} are applied by the season pipeline
       and by every simulated game. ${esc(list(dead))}
       ${dead.length === 1 ? 'describes a system' : 'describe systems'} this game has not
       built yet, so ${dead.length === 1 ? 'it carries' : 'they carry'} no percentage —
       the ratings are stored and the numbers switch on the day those systems land. A
       plausible-looking percentage nobody applies would be indistinguishable from a
       real one.`
    : '<b>Every influence below is applied by the simulation.</b>';

  renderHeader(page);
  renderTable(page);
  renderInfluence(page);
  renderCompat(page);
  renderControls(page);
}

function bind() {
  el('teamSel').addEventListener('change', (e) => {
    teamId = e.target.value;
    render();
  });
}

(async function boot() {
  let id = null;
  try {
    id = await activeLeagueId(listSavesDetailed);
    if (id) league = await loadLeague(id);
  } catch (_) { /* fall through to the no-career state */ }

  mountNav('staff', id);
  if (!league) { renderNoCareer(); return; }
  markPlayed(touchLastPlayed, id);

  // Your own club first, because it is the one you are managing; the rest are
  // there because a GM looks at who else is coaching.
  const own = (league.meta && league.meta.userTeamId) || null;
  const teams = [...(league.teams || [])].sort((a, b) => {
    if (a.id === own) return -1;
    if (b.id === own) return 1;
    return `${a.city} ${a.name}`.localeCompare(`${b.city} ${b.name}`);
  });
  teamId = own || (teams[0] && teams[0].id) || null;
  el('teamSel').innerHTML = teams.map((t) =>
    `<option value="${esc(t.id)}"${t.id === teamId ? ' selected' : ''}>${
      esc(`${t.city} ${t.name}`)}${t.id === own ? ' (You)' : ''}</option>`).join('');

  if (!teamId) { renderNoCareer(); return; }
  bind();
  render();
}());
