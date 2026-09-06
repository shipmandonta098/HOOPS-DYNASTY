'use strict';

/**
 * standingsView.js — the Standings screen.
 *
 * GROUND RULE, as everywhere else: only what the save holds.
 *
 * The league's SHAPE is real — which teams exist, which conference and division
 * each is in, and how many seeds qualify. That is drawn in full.
 *
 * Every RECORD is not. Win-loss, win percentage, games behind, conference
 * record, home and away splits, last ten and streak are facts about games that
 * have been simulated, and nothing has been. So they are dashes, the screen
 * says why once at the top rather than thirty times in the rows, and each
 * column fills in on its own the moment the season simulator writes a score
 * back. A table of invented records would be the single most convincing lie
 * this game could tell.
 *
 * TWO THINGS FROM THE REFERENCE ARE NOT HERE. The real-world league mark beside
 * the title — this game uses no real-world branding, so the league's own badge
 * takes that slot. And the reference's records themselves, which are a full
 * season of results for a league that has not tipped off.
 */

import { loadLeague, listSavesDetailed, touchLastPlayed } from './db.js';
import { mountNav, activeLeagueId, renderNoCareer, markPlayed } from './shell.js';
import { crestHTML } from './leagueConfig.js';
import { standings, formatPct, formatGB } from './standings.js';

const el = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let league = null;
let leagueId = null;
let scope = 'conference';

/** Initials for the league badge: "Dynasty Basketball League" -> "DBL". */
const initials = (n) => String(n || '')
  .split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 4) || '—';

const STATUS = {
  berth: { label: 'Playoff Berth', cls: 'is-berth' },
  playin: { label: 'Play-In', cls: 'is-playin' },
  out: { label: 'Out of Playoffs', cls: 'is-out' },
};

const HEAD = `<tr>
  <th class="st-rail" aria-hidden="true"></th>
  <th class="st-seed">#</th>
  <th class="st-team">Team</th>
  <th>W</th><th>L</th><th>Win%</th><th>GB</th>
  <th>Conf</th><th>Home</th><th>Away</th><th>L10</th><th>Streak</th>
</tr>`;

/** A dash, used everywhere a result would go in a league that has none. */
const NA = '<span class="na">—</span>';
const cell = (v) => (v == null || v === '' ? NA : esc(String(v)));

function render() {
  const table = standings(league, scope);
  const own = (league.meta && league.meta.userTeamId) || null;

  el('leagueBadge').textContent = initials(league.meta && league.meta.leagueName);
  el('leagueBadge').title = (league.meta && league.meta.leagueName) || '';
  for (const btn of el('scopeTabs').querySelectorAll('.tab')) {
    btn.classList.toggle('is-active', btn.dataset.scope === scope);
  }

  // The key describes marks that are only drawn once there is a standing to
  // draw them from, so it is hidden alongside them rather than explaining
  // colours that are not on screen.
  el('legend').hidden = table.played === 0;
  el('legend').innerHTML = Object.values(STATUS)
    .map((s) => `<span class="st-key"><i class="${s.cls}"></i>${esc(s.label)}</span>`).join('');

  // Said once, plainly, rather than leaving a reader to wonder why an entire
  // league is tied at nothing.
  const note = el('emptyNote');
  note.hidden = table.played > 0;
  if (!table.played) {
    note.innerHTML = `<b>No games have been played yet.</b> Records, win percentage,
      games behind, splits, last ten and streak are all counted from simulated games, so
      they stay empty until the season is played — they are not zeroes, and this screen
      will not invent them. Teams are listed alphabetically, because with nothing played
      there is no standing to sort by, and no playoff picture is marked for the same
      reason — seeding an alphabetical list would be a guess dressed as a standing. The
      conferences and divisions below are real.`;
  }

  el('groups').innerHTML = table.groups.map((g) => {
    const rows = g.rows.map((r) => {
      const st = STATUS[r.status] || null;
      const streakCls = r.streakKind === 'W' ? 'is-w' : r.streakKind === 'L' ? 'is-l' : '';
      return `<tr class="${r.team.id === own ? 'is-mine' : ''}">
        <td class="st-rail">${st
          ? `<i class="${st.cls}" title="${esc(st.label)}"></i>` : ''}</td>
        <td class="st-seed">${r.seed}</td>
        <td class="st-team">
          <span class="st-crest">${crestHTML(r.team, 24)}</span>
          <span class="st-name">${esc(r.name)}</span>
          ${r.team.id === own ? '<span class="st-own">You</span>' : ''}
        </td>
        <td class="st-n">${r.played ? r.wins : NA}</td>
        <td class="st-n">${r.played ? r.losses : NA}</td>
        <td class="st-n">${cell(formatPct(r.pct))}</td>
        <td class="st-n">${cell(formatGB(r.gb))}</td>
        <td class="st-n">${cell(r.conf)}</td>
        <td class="st-n">${cell(r.home)}</td>
        <td class="st-n">${cell(r.away)}</td>
        <td class="st-n">${cell(r.last10)}</td>
        <td class="st-n ${streakCls}">${cell(r.streak)}</td>
      </tr>`;
    }).join('');

    // The dashed rule sits under the last guaranteed seed and under the last
    // play-in seed, so the two cut lines are visible in the table itself and
    // not only in the legend.
    const cuts = g.lines
      ? [g.lines.berths, g.lines.berths + g.lines.playIn]
        .filter((n) => n > 0 && n < g.rows.length)
      : [];

    return `<section class="card st-group">
      <header class="st-head">
        <h2>${esc(g.label)}</h2>
        ${g.sub ? `<span class="st-sub">${esc(g.sub)}</span>` : ''}
        <span class="st-count">${g.rows.length} team${g.rows.length === 1 ? '' : 's'}</span>
      </header>
      <div class="st-wrap">
        <table class="st-table" data-cuts="${cuts.join(',')}">
          <thead>${HEAD}</thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
  }).join('');

  // Cut lines are drawn after the rows exist, because they attach to a row.
  for (const t of el('groups').querySelectorAll('.st-table')) {
    const cuts = (t.dataset.cuts || '').split(',').filter(Boolean).map(Number);
    const body = t.querySelector('tbody');
    for (const n of cuts) {
      const tr = body.children[n - 1];
      if (tr) tr.classList.add('is-cut');
    }
  }
}

function bind() {
  el('scopeTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab[data-scope]');
    if (!btn) return;
    scope = btn.dataset.scope;
    render();
  });
}

(async function boot() {
  let id = null;
  try {
    id = await activeLeagueId(listSavesDetailed);
    if (id) league = await loadLeague(id);
  } catch (_) { /* fall through to the no-career state */ }

  mountNav('standings', id);
  if (!league) { renderNoCareer(); return; }
  markPlayed(touchLastPlayed, id);
  leagueId = id;

  // One season exists, so the picker shows it and nothing else — stepping off
  // it would be stepping onto a season that has not happened.
  const season = (league.meta && league.meta.currentSeason) || '—';
  el('seasonSel').innerHTML = `<option>${esc(String(season))}</option>`;

  bind();
  render();
}());
