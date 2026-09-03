'use strict';

/**
 * playerModal.js — the shared player profile.
 *
 * Any screen can opt in with one call:
 *
 *     import { initPlayerModal } from './playerModal.js';
 *     initPlayerModal(league);
 *
 * ...and then mark any player name with `data-player="<player id>"`. A single
 * delegated listener on the document handles every one of them, present and
 * future, so a screen that re-renders its rows does not need to re-bind.
 *
 * GROUND RULE, as everywhere else: only what the save holds.
 *
 * The reference design carried a lot the save has no field for — jersey
 * number, photo, height, weight, experience, birthdate, birthplace,
 * nationality, draft position, personality, morale, fatigue, health, injury
 * risk, days rested, scouting notes, team chemistry, player role. None of it
 * is here; inventing any of it would make the profile fiction. Badges are out
 * at the user's request. What IS here is real: identity, age, position, team,
 * the cached overall and potential, all fourteen stored attributes, the
 * contract, and the career stat lines once a season has actually been
 * simulated.
 */

import {
  ATTR_GROUPS, ATTR_LABELS, POSITION_NAME,
  groupScore, gradeBand, ratingLabel, ovr, initials, contractStatus,
} from './playerRatings.js';
import { crestHTML } from './leagueConfig.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtM = (n) => `$${Number(n).toFixed(2)}M`;

let league = null;
let root = null;
let lastFocus = null;
let activeTab = 'attributes';
let current = null;

/* ------------------------------------------------------------------ mount */

/**
 * Wire the modal up for a screen.
 * @param {object} lg the loaded league — used to look players and teams up.
 */
export function initPlayerModal(lg) {
  league = lg;
  if (!root) {
    root = document.createElement('div');
    root.className = 'pm';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Player profile');
    document.body.appendChild(root);

    // Backdrop click and the close button both dismiss.
    root.addEventListener('click', (e) => {
      if (e.target === root || e.target.closest('[data-pm-close]')) close();
    });
    root.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-pm-tab]');
      if (!tab || tab.classList.contains('is-todo')) return;
      activeTab = tab.dataset.pmTab;
      render();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !root.hidden) close();
    });
  }

  // One delegated listener covers every player name on the page, including
  // rows drawn after this call.
  if (!document.body.dataset.pmBound) {
    document.body.dataset.pmBound = '1';
    const trigger = (e) => {
      const hit = e.target.closest('[data-player]');
      if (!hit) return;
      e.preventDefault();
      open(hit.dataset.player);
    };
    document.addEventListener('click', trigger);
    // The names are role="button" tabindex="0", so they must answer the
    // keyboard too — otherwise the profile is mouse-only.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') trigger(e);
    });
  }
}

/** Open the profile for a player id. Silently ignores an unknown id. */
export function open(playerId) {
  const p = (league && league.players || []).find((x) => x.id === playerId);
  if (!p) return;
  current = p;
  activeTab = 'attributes';   // the tab that always has real content
  lastFocus = document.activeElement;
  render();
  root.hidden = false;
  document.body.classList.add('pm-open');
  const btn = root.querySelector('[data-pm-close]');
  if (btn) btn.focus();
}

export function close() {
  if (!root || root.hidden) return;
  root.hidden = true;
  current = null;
  document.body.classList.remove('pm-open');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

/* ----------------------------------------------------------------- render */

function render() {
  const p = current;
  if (!p) return;
  const team = (league.teams || []).find((t) => t.id === p.teamId) || null;
  const o = ovr(p);
  const meta = league.meta || {};

  root.innerHTML = `<div class="pm-card">
    <button class="pm-x" data-pm-close aria-label="Close profile">✕</button>

    <!-- ============ header ============ -->
    <div class="pm-head">
      <div class="pm-face" aria-hidden="true">${esc(initials(p.name))}</div>
      <div class="pm-id">
        <div class="pm-name">${esc(p.name)}</div>
        <div class="pm-pos">${esc(p.position || '—')}${
          POSITION_NAME[p.position] ? ` <span>| ${esc(POSITION_NAME[p.position])}</span>` : ''}</div>
        <div class="pm-team">
          ${team ? crestHTML(team, 26) : ''}
          <span>
            <b>${team ? esc(`${team.city || ''} ${team.name || ''}`.trim()) : 'Free Agent'}</b>
            <em>${esc([meta.currentSeason, PHASE[meta.phase] || meta.phase].filter(Boolean).join(' '))}</em>
          </span>
        </div>
      </div>
      ${ovrRing(o)}
    </div>

    <!-- ============ facts: only fields the save actually carries ============ -->
    <div class="pm-facts">
      ${fact('Age', p.age ?? '—')}
      ${fact('Overall', o || '—')}
      ${fact('Potential', p.potential ?? '—')}
      ${fact('Upside', upside(p, o))}
      ${p.college ? fact('College', p.college) : ''}
    </div>

    <div class="pm-body">
      <div class="pm-main">
        <!-- five category ratings -->
        <div class="pm-cats">
          ${ATTR_GROUPS.map((g) => {
            const v = groupScore(p, g);
            return `<div class="pm-cat">
              <div class="ct">${esc(g.label)}</div>
              <div class="cv g-${gradeBand(v)}">${v ?? '—'}</div>
              <div class="cl g-${gradeBand(v)}">${esc(ratingLabel(v))}</div>
            </div>`;
          }).join('')}
        </div>

        <!-- tabs -->
        <div class="pm-tabs">
          ${tab('attributes', 'Attributes', true)}
          ${tab('career', 'Career Stats', true)}
          ${tab('gamelog', 'Game Log', false)}
          ${tab('contracts', 'Contract History', false)}
        </div>
        <div class="pm-pane">${activeTab === 'career' ? careerPane(p) : attrPane(p)}</div>
      </div>

      <!-- ============ contract ============ -->
      <aside class="pm-side">
        <h3>Contract</h3>
        ${contractPane(p, meta)}
      </aside>
    </div>
  </div>`;
}

const PHASE = {
  regular_season: 'Regular Season', playoffs: 'Playoffs', offseason: 'Offseason',
  draft: 'Draft', free_agency: 'Free Agency', finals: 'Finals',
};

/** Room left to grow: potential minus overall. Both are stored values. */
function upside(p, o) {
  if (typeof p.potential !== 'number' || !o) return '—';
  const d = p.potential - o;
  return d > 0 ? `+${d}` : 'Peaked';
}

const fact = (k, v) =>
  `<div class="pm-fact"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`;

const tab = (id, label, built) =>
  `<button class="pm-tab${activeTab === id ? ' is-active' : ''}${built ? '' : ' is-todo'}"
     data-pm-tab="${id}"${built ? '' : ' title="Not built yet"'}>${esc(label)}</button>`;

/** Overall as a ring, filled to overall/99. */
function ovrRing(o) {
  const r = 44, c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, (o || 0) / 99)) * c;
  return `<div class="pm-ovr">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle class="tr" cx="50" cy="50" r="${r}" />
      <circle class="fl g-${gradeBand(o)}" cx="50" cy="50" r="${r}"
              stroke-dasharray="${filled} ${c}" transform="rotate(-90 50 50)" />
    </svg>
    <div class="pm-ovr-t"><em>OVR</em><b class="g-${gradeBand(o)}">${o || '—'}</b></div>
    <div class="pm-ovr-l g-${gradeBand(o)}">${esc(ratingLabel(o))}</div>
  </div>`;
}

/** All fourteen stored attributes, grouped the way the categories group them. */
function attrPane(p) {
  const a = p.attributes || {};
  if (!Object.keys(a).length) {
    return `<p class="pm-empty">This player record has no attribute block.</p>`;
  }
  return `<div class="pm-attrs">${ATTR_GROUPS.map((g) => `
    <div class="pm-attr-group">
      <div class="ag-h">${esc(g.label)}</div>
      ${g.parts.map(([key]) => {
        const v = a[key];
        return `<div class="ag-row">
          <span class="an">${esc(ATTR_LABELS[key] || key)}</span>
          <span class="at"><span class="af g-${gradeBand(v)}" style="width:${
            typeof v === 'number' ? v : 0}%"></span></span>
          <span class="av g-${gradeBand(v)}">${typeof v === 'number' ? v : '—'}</span>
        </div>`;
      }).join('')}
    </div>`).join('')}</div>`;
}

/**
 * Career stat lines. `statsHistory` is written by the season simulator, so it
 * is empty in a fresh league — that gets said plainly instead of being filled
 * with plausible-looking numbers. Columns are whatever the sim actually wrote.
 */
const STAT_COLS = [
  ['season', 'Season'], ['gp', 'GP'], ['gs', 'GS'], ['mpg', 'MPG'],
  ['ppg', 'PPG'], ['rpg', 'RPG'], ['apg', 'APG'], ['spg', 'SPG'], ['bpg', 'BPG'],
  ['fgPct', 'FG%'], ['threePct', '3P%'], ['ftPct', 'FT%'], ['tsPct', 'TS%'],
];

function careerPane(p) {
  const rows = Array.isArray(p.statsHistory) ? p.statsHistory : [];
  if (!rows.length) {
    return `<p class="pm-empty">No games have been played yet. Career stats appear
      here once a season has been simulated.</p>`;
  }
  const cols = STAT_COLS.filter(([k]) => rows.some((r) => r[k] != null));
  return `<div class="pm-stats"><table>
    <thead><tr>${cols.map(([, l]) => `<th>${esc(l)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${cols.map(([k]) =>
      `<td>${r[k] != null ? esc(r[k]) : '—'}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

/**
 * Contract facts. The save stores salary, yearsRemaining, type and the two
 * option flags — that is all, so that is all this shows. "Remaining value" is
 * labelled as the arithmetic it is rather than presented as a stored total.
 */
function contractPane(p, meta) {
  const c = p.contract;
  if (!c) {
    return `<div class="pm-rows"><div class="pm-row"><span>Status</span>
      <b>Not under contract</b></div></div>`;
  }
  const st = contractStatus(p);
  const yrs = Number(c.yearsRemaining) || 0;
  const salary = Number(c.salary) || 0;
  const rows = [
    [meta.currentSeason ? `Salary (${meta.currentSeason})` : 'Salary', fmtM(salary)],
    ['Years Remaining', yrs],
    ['Status', st.sub],
    ['Remaining Value', `${fmtM(salary * yrs)}`, `${yrs} × ${fmtM(salary)}`],
  ];
  if (c.playerOption) rows.push(['Player Option', 'Yes']);
  if (c.teamOption) rows.push(['Team Option', 'Yes']);

  return `<div class="pm-rows">${rows.map(([k, v, sub]) =>
    `<div class="pm-row"><span>${esc(k)}</span><b>${esc(v)}${
      sub ? `<em>${esc(sub)}</em>` : ''}</b></div>`).join('')}</div>
    <p class="pm-note">Contract totals beyond these fields — guarantees, cap
      holds, year-by-year salary — are not stored in the save.</p>`;
}
