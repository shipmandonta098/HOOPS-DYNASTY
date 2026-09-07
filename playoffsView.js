'use strict';

/**
 * playoffsView.js — the Playoffs screen.
 *
 * THE BRACKET IS ONE OF TWO THINGS, AND IT SAYS WHICH. Before the regular
 * season is over it is a PROJECTION from today's standings — genuinely useful,
 * and labelled as a projection everywhere it appears. Once the season is
 * complete it becomes the real bracket and can be played.
 *
 * WHAT IS NOT TAKEN FROM THE REFERENCE. Its league mark, its trophy artwork
 * and its team crests are real-world branding, and this game uses none: the
 * league's own name and initials go in that slot and the crests are the save's
 * own. Its records are a played season, which this only shows once one has
 * been. And the sixteen-team, eight-per-conference shape is not assumed — the
 * bracket is whatever the league's own conferences and playoff settings make
 * it.
 */

import { loadLeague, listSavesDetailed, touchLastPlayed, saveLeague } from './db.js';
import { mountNav, activeLeagueId, renderNoCareer, markPlayed } from './shell.js';
import { crestHTML } from './leagueConfig.js';
import { standings } from './standings.js';
import { teamPower } from './powerRanking.js';
import {
  buildBracket, playPostseason, qualifiers, seriesLength, winsNeeded,
  regularSeasonComplete,
} from './playoffs.js';

const el = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let league = null;
let leagueId = null;
let tab = 'bracket';
let bracket = null;

const teamById = (id) => (league.teams || []).find((t) => t.id === id) || null;
const teamName = (id) => {
  const t = teamById(id);
  return t ? `${t.city || ''} ${t.name || ''}`.trim() : String(id || '');
};
const shortName = (id) => { const t = teamById(id); return t ? (t.name || t.city || id) : id; };
/** The league's own initials, where the reference puts a real-world mark. */
const initials = (n) => String(n || '').split(/\s+/).filter(Boolean)
  .map((w) => w[0]).join('').toUpperCase().slice(0, 4) || 'HD';

const complete = () => regularSeasonComplete(league);
const live = () => !!(league.playoffs && league.playoffs.season
  === (league.meta && league.meta.currentSeason));

/* ---------------------------------------------------------------- render */

const PANES = ['bracket', 'picture', 'compare', 'history'];

function render() {
  for (const p of PANES) {
    const node = el(`pane${p[0].toUpperCase()}${p.slice(1)}`);
    if (node) node.hidden = p !== tab;
  }
  for (const b of el('tabs').querySelectorAll('.tab[data-tab]')) {
    b.classList.toggle('is-active', b.dataset.tab === tab);
  }
  renderBanner();
  if (tab === 'picture') renderPicture();
  else if (tab === 'compare') renderCompare();
  else if (tab === 'history') renderHistory();
  else renderBracket();
}

function renderBanner() {
  const done = complete();
  const played = live();
  el('poState').textContent = played
    ? (league.playoffs.champion ? 'Complete' : 'In progress')
    : (done ? 'Ready to play' : 'If the playoffs started today');

  const b = el('poBanner');
  if (played && league.playoffs.champion) {
    b.className = 'po-banner is-champ';
    b.innerHTML = `<b>${esc(teamName(league.playoffs.champion))}</b> are the
      ${esc(league.meta.currentSeason)} champions.`;
  } else if (played) {
    b.className = 'po-banner';
    b.innerHTML = 'The postseason is under way.';
  } else if (done) {
    b.className = 'po-banner is-ready';
    b.innerHTML = `<b>The regular season is over.</b> This is the real bracket, seeded
      from the final standings. <button class="po-play" id="poPlay">Play The Postseason</button>`;
  } else {
    b.className = 'po-banner is-proj';
    const s = standings(league, 'conference');
    b.innerHTML = s.played
      ? `<b>Projection.</b> This is the bracket the current standings would produce,
         with ${s.played} of ${((league.schedule || {}).games || []).length} games played.
         It is not the real bracket and nothing here has happened.`
      : `<b>Projection, from nothing.</b> No games have been played, so every club is
         level and these seeds are alphabetical rather than earned. Play some of the
         season and this becomes a real picture.`;
  }
}

/* --------------------------------------------------------------- bracket */

function seat(side, series, champ) {
  if (!side) {
    return `<div class="po-seat is-empty"><span class="po-seed">–</span>
      <span class="po-tn">\u2014</span></div>`;
  }
  const t = teamById(side.id);
  const won = series && series.done && series.winner === side.id;
  const out = series && series.done && series.winner !== side.id;
  return `<div class="po-seat${won ? ' is-won' : ''}${out ? ' is-out' : ''}${
    champ ? ' is-champ' : ''}">
    <span class="po-seed">${side.seed}</span>
    <span class="po-crest">${t ? crestHTML(t, 22) : ''}</span>
    <span class="po-tn" title="${esc(teamName(side.id))}">${esc(shortName(side.id))}</span>
    <span class="po-w">${series && (series.games || []).length ? side.wins : ''}</span>
  </div>`;
}

function seriesBox(series, extra) {
  if (!series) return '<div class="po-series is-empty"></div>';
  const played = (series.games || []).length;
  return `<div class="po-series${series.done ? ' is-done' : ''} ${extra || ''}"
    ${series.high && series.low ? `title="Best of ${series.length}"` : ''}>
    ${seat(series.high, series)}
    ${seat(series.low, series)}
    ${played ? `<div class="po-note">${played} game${played === 1 ? '' : 's'}</div>` : ''}
  </div>`;
}

function renderBracket() {
  const b = bracket;
  if (!b || !b.brackets.length) {
    el('paneBracket').innerHTML = `<div class="card po-empty">
      This league has no conferences or too few teams to seed a bracket.</div>`;
    return;
  }

  // Two brackets face each other with the final between them, the way the
  // reference lays it out. One bracket, or more than two, stacks instead —
  // nothing here assumes a league has exactly two conferences.
  const facing = b.brackets.length === 2;
  const col = (rounds, flip) => rounds.map((round, ri) => `
    <div class="po-col">
      <div class="po-rname">${esc(round[0] ? round[0].label : '')}</div>
      ${round.map((s) => seriesBox(s)).join('')}
    </div>`).join('');

  const finalBlock = `
    <div class="po-final">
      <div class="po-trophy" aria-hidden="true">
        <span class="po-badge">${esc(initials(league.meta && league.meta.leagueName))}</span>
        <span class="po-fl">Finals</span>
      </div>
      ${seriesBox(b.final, 'is-final')}
      <div class="po-champ">
        <div class="po-ck">Champion</div>
        <div class="po-cv">${b.champion
          ? `<span class="po-crest">${crestHTML(teamById(b.champion), 26)}</span>
             ${esc(teamName(b.champion))}`
          : '<span class="na">—</span>'}</div>
      </div>
    </div>`;

  el('paneBracket').innerHTML = `
    <div class="po-wrap ${facing ? 'is-facing' : 'is-stacked'}">
      ${facing ? `
        <section class="po-half">
          <header class="po-chead">${esc(b.brackets[0].label)}</header>
          <div class="po-rounds">${col(b.brackets[0].rounds)}</div>
        </section>
        ${finalBlock}
        <section class="po-half is-right">
          <header class="po-chead">${esc(b.brackets[1].label)}</header>
          <div class="po-rounds is-rtl">${col(b.brackets[1].rounds)}</div>
        </section>`
      : `${b.brackets.map((x) => `
          <section class="po-half">
            <header class="po-chead">${esc(x.label)}</header>
            <div class="po-rounds">${col(x.rounds)}</div>
          </section>`).join('')}
         ${b.final ? finalBlock : ''}`}
    </div>
    ${factRow()}`;
}

/** The four fact cards under the bracket, every figure read from the save. */
function factRow() {
  const games = ((league.schedule || {}).games) || [];
  const dates = games.map((g) => g.date).sort();
  const q = qualifiers(league);
  const perConf = q.length ? q[0].size : 0;
  const teams = q.reduce((n, x) => n + x.size, 0);
  const len = seriesLength(league.settings);
  const card = (icon, k, v) => `<div class="card po-fact">
    <span class="po-fi">${icon}</span>
    <div><div class="po-fk">${esc(k)}</div><div class="po-fv">${v}</div></div></div>`;
  return `<div class="po-facts">
    ${card('📅', 'Regular season ends', dates.length
      ? esc(fmt(dates[dates.length - 1])) : '<span class="na">—</span>')}
    ${card('🏆', 'Champion', bracket && bracket.champion
      ? esc(teamName(bracket.champion)) : '<span class="na">Not decided</span>')}
    ${card('📄', 'Series format', `Best of ${len}`)}
    ${card('📊', 'Teams in playoffs', `${teams}${q.length > 1
      ? ` (top ${perConf} per conference)` : ''}`)}
  </div>`;
}

const fmt = (iso) => new Date(`${iso}T00:00:00Z`)
  .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/* --------------------------------------------------------------- picture */

function renderPicture() {
  const q = qualifiers(league);
  const s = standings(league, 'conference');
  el('panePicture').innerHTML = `${q.map((c) => {
    const row = (r, tag) => `<tr class="${tag}">
      <td class="po-s">${r.seed}</td>
      <td class="po-t"><span class="po-crest">${crestHTML(teamById(r.id), 22)}</span>
        ${esc(teamName(r.id))}</td>
      <td>${r.played ? `${r.wins}-${r.losses}` : '<span class="na">—</span>'}</td>
      <td>${r.played ? (r.pct != null ? r.pct.toFixed(3).replace(/^0/, '') : '') : '<span class="na">—</span>'}</td>
      <td>${r.gb == null ? '<span class="na">—</span>' : (r.gb === 0 ? '—' : r.gb.toFixed(1))}</td>
      <td class="po-tag">${tag === 'is-in' ? 'Clinched a place'
        : tag === 'is-pi' ? 'Play-in' : 'Outside'}</td>
    </tr>`;
    const inIds = new Set(c.clinched.map((r) => r.id));
    const piIds = new Set(c.playIn.map((r) => r.id));
    return `<section class="card po-pic">
      <div class="po-chead is-flat">${esc(c.label)}</div>
      <table class="po-table"><thead><tr>
        <th>#</th><th class="po-t">Team</th><th>Record</th><th>Win%</th><th>GB</th><th>Status</th>
      </tr></thead><tbody>
        ${c.rows.map((r) => row(r, inIds.has(r.id) ? 'is-in'
          : piIds.has(r.id) ? 'is-pi' : 'is-out')).join('')}
      </tbody></table>
    </section>`;
  }).join('')}
  <p class="po-note-long">${s.played
    ? `Seeds and games behind are counted from the ${s.played} games played so far. `
      + 'Nothing is clinched until the regular season ends — the labels describe '
      + 'where each club would stand if it ended today.'
    : 'No games have been played, so there is no order here to speak of. These are '
      + 'the teams, alphabetically, and every column that needs a result is empty.'}</p>`;
}

/* --------------------------------------------------------------- compare */

const COMPARE = [
  ['power', 'Playoff power'], ['wins', 'Wins'], ['pct', 'Win %'],
  ['home', 'Home'], ['away', 'Away'], ['last10', 'Last 10'],
];

/**
 * Two clubs side by side.
 *
 * Records come from played games and are dashes before there are any. Playoff
 * power is the rotation-weighted rating on the SHORTER playoff rotation, which
 * is the one thing here that means something before a season starts — it is a
 * property of the roster, not of results.
 */
function renderCompare() {
  const rows = standings(league, 'conference').groups.flatMap((g) => g.rows);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const mine = (league.meta && league.meta.userTeamId) || (rows[0] && rows[0].id);
  const other = el('poCompareB') ? el('poCompareB').value
    : (rows.find((r) => r.id !== mine) || {}).id;

  const rosterOf = (id) => (league.players || []).filter((p) => p.teamId === id);
  const power = (id) => teamPower(rosterOf(id), 'playoff').power;

  const pick = (id, which) => `<select id="poCompare${which}" class="po-sel">
    ${rows.map((r) => `<option value="${esc(r.id)}"${r.id === id ? ' selected' : ''}
      >${esc(teamName(r.id))}</option>`).join('')}</select>`;

  const val = (id, key) => {
    const r = byId.get(id) || {};
    if (key === 'power') return String(power(id).toFixed(1));
    if (!r.played) return null;
    if (key === 'wins') return `${r.wins}-${r.losses}`;
    if (key === 'pct') return r.pct != null ? r.pct.toFixed(3).replace(/^0/, '') : null;
    return r[key] || null;
  };

  el('paneCompare').innerHTML = `
    <section class="card po-cmp">
      <div class="po-cmp-head">
        ${pick(mine, 'A')}<span class="po-vs">vs</span>${pick(other, 'B')}
      </div>
      <table class="po-table po-cmp-table"><tbody>
        ${COMPARE.map(([k, label]) => {
          const a = val(mine, k), bv = val(other, k);
          const na = k === 'power' ? Number(a) : NaN;
          const nb = k === 'power' ? Number(bv) : NaN;
          return `<tr>
            <td class="po-ca ${na > nb ? 'is-better' : ''}">${a == null ? '<span class="na">—</span>' : esc(a)}</td>
            <td class="po-ck">${esc(label)}</td>
            <td class="po-cb ${nb > na ? 'is-better' : ''}">${bv == null ? '<span class="na">—</span>' : esc(bv)}</td>
          </tr>`;
        }).join('')}
      </tbody></table>
      <p class="po-note-long">Playoff power is the rotation-weighted rating on the
        shorter playoff rotation, so it is a property of the roster and means something
        before a ball is bounced. Every other row is counted from played games and
        stays empty until there are some.</p>
    </section>`;
}

/* --------------------------------------------------------------- history */

function renderHistory() {
  const past = (league.history && league.history.champions) || [];
  el('paneHistory').innerHTML = past.length
    ? `<section class="card"><table class="po-table"><thead><tr>
        <th>Season</th><th class="po-t">Champion</th><th>Runner-up</th><th>Series</th>
      </tr></thead><tbody>${past.slice().reverse().map((h) => `<tr>
        <td>${esc(h.season)}</td>
        <td class="po-t"><span class="po-crest">${crestHTML(teamById(h.champion), 22)}</span>
          ${esc(teamName(h.champion))}</td>
        <td>${esc(teamName(h.runnerUp))}</td>
        <td>${esc(h.result || '')}</td></tr>`).join('')}</tbody></table></section>`
    : `<div class="card po-empty">
        <b>No seasons have finished yet.</b> Champions are recorded here as they are
        won. Nothing is listed because nothing has happened — this table fills itself
        the first time a postseason is played out.</div>`;
}

/* ------------------------------------------------------------------ play */

async function playAll() {
  const btn = el('poPlay');
  if (btn) { btn.disabled = true; btn.textContent = 'Playing…'; }
  bracket = playPostseason(league, buildBracket(league));
  league.playoffs = bracket;
  if (bracket.champion && bracket.final) {
    league.history = league.history || {};
    league.history.champions = league.history.champions || [];
    const already = league.history.champions.some((h) => h.season === bracket.season);
    if (!already) {
      const f = bracket.final;
      const w = f.winner === f.high.id ? f.high : f.low;
      const l = f.winner === f.high.id ? f.low : f.high;
      league.history.champions.push({
        season: bracket.season, champion: w.id, runnerUp: l.id,
        result: `${w.wins}-${l.wins}`,
      });
    }
  }
  if (league.meta) league.meta.currentPhase = 'playoffs';
  try { await saveLeague(leagueId, league); } catch (_) { /* read-only is fine */ }
  render();
}

/* ------------------------------------------------------------------ boot */

(async function boot() {
  let id = null;
  try {
    id = await activeLeagueId(listSavesDetailed);
    if (id) league = await loadLeague(id);
  } catch (_) { /* fall through to the no-career state */ }

  mountNav('playoffs', id);
  if (!league) { renderNoCareer(); return; }
  markPlayed(touchLastPlayed, id);
  leagueId = id;

  el('poLeague').textContent = (league.meta && league.meta.leagueName) || '—';
  el('poSeason').textContent = `${(league.meta && league.meta.currentSeason) || '—'} Season`;

  // A postseason already played is shown as it happened; otherwise the bracket
  // is rebuilt from the standings every visit, so a projection tracks the table.
  bracket = live() ? league.playoffs : buildBracket(league);

  el('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('.tab[data-tab]');
    if (!b || b.disabled) return;
    tab = b.dataset.tab;
    render();
  });
  el('poBanner').addEventListener('click', (e) => {
    if (e.target.closest('#poPlay')) playAll();
  });
  el('paneCompare').addEventListener('change', (e) => {
    if (e.target.closest('.po-sel')) renderCompare();
  });

  render();
}());
