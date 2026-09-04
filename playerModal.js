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
 * Biographical fields (height, weight, birth date and place, nationality,
 * draft position, college, experience, personality, morale, fatigue) are
 * REAL STORED DATA: playerBio.js generates them during league creation off
 * the seeded RNG and writes them into the player record. Nothing here is
 * invented at render time.
 *
 * Still absent, because the save genuinely has no field for them: jersey
 * number, photograph, health/injury risk, days rested, scouting notes, team
 * chemistry and player role. Badges are out at the user's request. Saves made
 * before the bio fields existed simply omit those rows rather than showing a
 * wall of dashes.
 */

import {
  ATTR_GROUPS, ATTR_LABELS, POSITION_NAME,
  groupScore, gradeBand, ratingLabel, ovr, initials, contractStatus,
} from './playerRatings.js';
import { crestHTML } from './leagueConfig.js';
import { applyTeamTheme } from './teamTheme.js';
import { MENTAL_ATTRS, mentalSummary } from './playerMental.js';
import {
  TRAIT_BY_ID, PRIORITIES, priorityLevel, satisfaction, satisfactionLabel,
} from './playerPersonality.js';
import { formatPotential } from './gameSettings.js';
import {
  formatHeight, formatBirthDate, formatBirthplace, formatDraft,
  moraleLabel, fatigueLabel,
} from './playerBio.js';

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
  activeTab = 'attributes';   // the only tab guaranteed to have content
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

  // A profile carries the colours of the player's OWN club, so opening a
  // rival's card looks like his team rather than yours.
  applyTeamTheme(team, root);

  root.innerHTML = `<div class="pm-card">
    <button class="pm-x" data-pm-close aria-label="Close profile">✕</button>

    <!-- ============ header ============ -->
    <div class="pm-head">
      <div class="pm-face" aria-hidden="true">${esc(initials(p.name))}</div>
      <div class="pm-id">
        <div class="pm-name">${esc(p.name)}</div>
        <div class="pm-pos">${esc(p.position || '—')}${
          POSITION_NAME[p.position] ? ` <span>| ${esc(POSITION_NAME[p.position])}</span>` : ''}${
          p.archetypeLabel ? ` <span class="arch">${esc(p.archetypeLabel)}</span>` : ''}</div>
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
      ${fact('Potential', formatPotential(p.potential, o, potMode()).text)}
      ${potMode() === 'Exact' ? fact('Upside', upside(p, o)) : ''}
      ${p.college ? fact('College', p.college) : ''}
    </div>

    <div class="pm-body">
      <!-- five category ratings: a summary of the player, not tab content, so
           it stays above the tabs on every panel -->
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

      <!-- Every panel is a tab. Bio and Contract used to sit in a permanent
           side column, which read as a sidebar on a wide screen but stacked
           underneath whichever tab was open on a narrow one — so they looked
           like part of Attributes, then part of Mental, then part of
           Personality. One tab, one panel. -->
      <div class="pm-tabs">
        ${tab('bio', 'Bio', true)}
        ${tab('attributes', 'Attributes', true)}
        ${p.mental ? tab('mental', 'Mental', true) : ''}
        ${p.personality ? tab('personality', 'Personality', true) : ''}
        ${tab('contract', 'Contract', true)}
        ${tab('career', 'Career Stats', true)}
        ${tab('gamelog', 'Game Log', false)}
      </div>
      <div class="pm-pane">${
        activeTab === 'bio' ? bioPane(p)
        : activeTab === 'contract' ? contractPane(p, meta)
        : activeTab === 'career' ? careerPane(p)
        : activeTab === 'mental' ? mentalPane(p)
        : activeTab === 'personality' ? personalityPane(p)
        : attrPane(p)}</div>
    </div>
  </div>`;
}

/** The league's Potential Visibility rule; Range when a save predates it. */
const potMode = () =>
  (league && league.settings && league.settings.potentialVisibility) || 'Range';

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
 * Mental attributes — how the ability shows up under pressure, kept in their
 * own section because they are a different kind of thing from the ability
 * ratings and, deliberately, do not feed overall.
 */
function mentalPane(p) {
  const m = p.mental;
  if (!m) {
    return `<p class="pm-empty">This save predates the mental attributes.
      Start a new career to see them.</p>`;
  }
  const summary = mentalSummary(m);
  return `<div class="pm-mental">
    <p class="pm-mental-note">These describe how a player responds to pressure,
      mistakes, opponents and coaching. They are tendencies, not certainties, and
      they do <b>not</b> affect his Overall or Potential.</p>
    <div class="pm-mental-grid">
      ${MENTAL_ATTRS.map(({ key, label, blurb }) => {
        const v = m[key];
        return `<div class="mn-row">
          <div class="mn-head">
            <span class="mn-label">${esc(label)}</span>
            <span class="mn-val g-${gradeBand(v)}">${typeof v === 'number' ? v : '—'}</span>
          </div>
          <span class="mn-track"><span class="mn-fill g-${gradeBand(v)}"
            style="width:${typeof v === 'number' ? v : 0}%"></span></span>
          <div class="mn-blurb">${esc(blurb)}</div>
        </div>`;
      }).join('')}
    </div>
    ${summary ? `<p class="pm-mental-sum">${esc(summary)}</p>` : ''}
  </div>`;
}

/**
 * Personality — layer three. Traits are who the player is; priorities are what
 * currently matters to him and are derived from those traits plus his age and
 * standing, so they move as his career does.
 *
 * No trait is marked good or bad. Ambitious is an asset on a contender and a
 * problem during a rebuild, and that judgement belongs to the situation.
 */
function personalityPane(p) {
  const per = p.personality;
  if (!per || !Array.isArray(per.traits)) {
    return `<p class="pm-empty">This save predates the personality system.
      Start a new career to see it.</p>`;
  }
  const pr = per.priorities || {};
  const ranked = PRIORITIES
    .map((d) => ({ ...d, v: pr[d.key] }))
    .filter((d) => typeof d.v === 'number')
    .sort((a, b) => b.v - a.v);

  const sat = satisfaction(p, playerContext(p));

  return `<div class="pm-person">
    <p class="pm-mental-note">Personality governs how this player is to
      <b>manage</b> — contracts, roles, loyalty, the media, the locker room. It
      does <b>not</b> affect his Overall, his Potential or how he plays.</p>

    <div class="pp-block">
      <div class="pp-h">Traits</div>
      <div class="pp-traits">${per.traits.map((id) => {
        const t = TRAIT_BY_ID[id];
        if (!t) return '';
        return `<div class="pp-trait">
          <span class="pt-name">${esc(t.label)}</span>
          <span class="pt-blurb">${esc(t.blurb)}</span>
        </div>`;
      }).join('')}</div>
    </div>

    <div class="pp-block">
      <div class="pp-h">Career Priorities <span>what he wants right now</span></div>
      <div class="pp-priorities">${ranked.map((d) => {
        const lv = priorityLevel(d.v);
        return `<div class="pp-row">
          <span class="pp-label">${esc(d.label)}</span>
          <span class="pp-track"><span class="pp-fill lv-${lv.key}" style="width:${d.v}%"></span></span>
          <span class="pp-level lv-${lv.key}">${esc(lv.label)}</span>
        </div>`;
      }).join('')}</div>
    </div>

    ${satisfactionBlock(sat)}
  </div>`;
}

/** What the save can actually tell us about this player's situation. */
function playerContext(p) {
  if (!league || !p.teamId) return {};
  const roster = (league.players || []).filter((x) => x.teamId === p.teamId);
  const team = (league.teams || []).find((t) => t.id === p.teamId);
  const chart = team && team.depthChart;
  let depthSlot;
  if (chart) {
    const list = chart[p.position] || [];
    const i = list.indexOf(p.id);
    if (i >= 0) depthSlot = i;
  }
  const salary = (x) => (x.contract ? Number(x.contract.salary) || 0 : 0);
  const byPay = [...roster].sort((a, b) => salary(b) - salary(a));
  const byAbility = [...roster].sort((a, b) => ovr(b) - ovr(a));
  return {
    depthSlot,
    rosterCount: roster.length,
    salaryRank: byPay.findIndex((x) => x.id === p.id),
    abilityRank: byAbility.findIndex((x) => x.id === p.id),
  };
}

/**
 * Satisfaction, scored only where the save has an answer. Minutes, team
 * success and coaching need a simulated season, so they are listed as pending
 * rather than filled with a plausible-looking number.
 */
function satisfactionBlock(sat) {
  if (!sat.scored.length) {
    return `<div class="pp-block"><div class="pp-h">Satisfaction</div>
      <p class="pp-none">Nothing measurable yet — this player is not on a roster.</p></div>`;
  }
  const overall = satisfactionLabel(sat.overall);
  return `<div class="pp-block">
    <div class="pp-h">Satisfaction
      <span class="g-${overall.band}">${esc(overall.text)}</span></div>
    <div class="pp-sat">${sat.scored.map((d) => {
      const l = satisfactionLabel(d.score);
      return `<div class="pp-row">
        <span class="pp-label">${esc(d.label)}</span>
        <span class="pp-track"><span class="pp-fill g-${l.band}" style="width:${d.score}%"></span></span>
        <span class="pp-level g-${l.band}">${esc(l.text)}</span>
      </div>`;
    }).join('')}</div>
    <p class="pp-pending">Not yet measurable: ${esc(sat.unavailable.join(', '))} —
      these need a simulated season.</p>
  </div>`;
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
 * Durability is a stored 0-99 trait. It is deliberately shown as a trait and
 * not as an "injury risk percentage": nothing simulates injuries yet, so a
 * probability would imply a model that does not exist.
 */
function durabilityLabel(v) {
  if (v >= 85) return { text: 'Iron Man', band: 'hi' };
  if (v >= 70) return { text: 'Durable', band: 'hi' };
  if (v >= 55) return { text: 'Average', band: 'mid' };
  if (v >= 40) return { text: 'Fragile', band: 'mid' };
  return { text: 'Injury Prone', band: 'lo' };
}

/**
 * Biography. Every row is a stored field; a row whose field is missing (a save
 * created before these existed) is dropped rather than shown as a dash.
 */
function bioPane(p) {
  const mor = moraleLabel(p.morale);
  const fat = fatigueLabel(p.fatigue);
  const rows = [
    ['Height', typeof p.heightIn === 'number' ? formatHeight(p.heightIn) : null],
    ['Weight', typeof p.weightLb === 'number' ? `${p.weightLb} lbs` : null],
    ['Birthdate', p.birthDate ? `${formatBirthDate(p.birthDate)}` : null,
      p.birthDate && typeof p.age === 'number' ? `Age ${p.age}` : null],
    ['Birthplace', p.birthplace ? formatBirthplace(p.birthplace) : null],
    // A dual-national shows both. namingOrigin and gender are internal
    // generation fields and deliberately never displayed.
    ['Nationality', p.nationality
      ? (p.secondaryNationality ? `${p.nationality} / ${p.secondaryNationality}` : p.nationality)
      : null],
    ['College', p.college || null],
    ['Experience', typeof p.experience === 'number'
      ? (p.experience === 0 ? 'Rookie' : `${p.experience} ${p.experience === 1 ? 'season' : 'seasons'}`)
      : null],
    ['Drafted', p.draft !== undefined ? formatDraft(p.draft) : null],
    ['Durability', typeof p.durability === 'number' ? durabilityLabel(p.durability).text : null,
      null, typeof p.durability === 'number' ? durabilityLabel(p.durability).band : null],
    ['Morale', typeof p.morale === 'number' ? mor.text : null, null, mor.band],
    ['Fatigue', typeof p.fatigue === 'number' ? fat.text : null, null, fat.band],
  ].filter(([, v]) => v != null);

  if (!rows.length) {
    return `<p class="pm-empty">This save predates the biographical fields.
      Start a new career to see them.</p>`;
  }
  return `<div class="pm-rows pm-rows-wide">${rows.map(
    ([k, v, sub, band]) => `<div class="pm-row"><span>${esc(k)}</span>` +
      `<b${band ? ` class="g-${band}"` : ''}>${esc(v)}${
        sub ? `<em>${esc(sub)}</em>` : ''}</b></div>`).join('')}</div>`;
}

/**
 * Contract facts. The save stores salary, yearsRemaining, type and the two
 * option flags — that is all, so that is all this shows. "Remaining value" is
 * labelled as the arithmetic it is rather than presented as a stored total.
 */
function contractPane(p, meta) {
  const c = p.contract;
  if (!c) {
    return `<div class="pm-rows pm-rows-wide"><div class="pm-row"><span>Status</span>
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

  return `<div class="pm-rows pm-rows-wide">${rows.map(([k, v, sub]) =>
    `<div class="pm-row"><span>${esc(k)}</span><b>${esc(v)}${
      sub ? `<em>${esc(sub)}</em>` : ''}</b></div>`).join('')}</div>
    <p class="pm-note">Contract totals beyond these fields — guarantees, cap
      holds, year-by-year salary — are not stored in the save.</p>
    <div class="pm-subhead">Contract History</div>
    <p class="pm-note">Past deals are not recorded yet. Signings and extensions
      will appear here once they are logged.</p>`;
}
