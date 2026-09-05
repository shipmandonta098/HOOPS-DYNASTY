'use strict';

/**
 * scheduleView.js — the Schedule screen.
 *
 * GROUND RULE, as on every other screen: only what the save holds.
 *
 * The FIXTURES are real generated data — schedule.js builds them from the
 * league's own teams and seed, and they are written into the save the first
 * time this screen opens so the season is stable from then on.
 *
 * The RESULTS are not generated. Score, W/L, running record, streak, home and
 * away splits and last-ten all read off games that have actually been
 * simulated. Nothing has been, so today every one of them is a dash. That is
 * the screen telling the truth about the save, and each of those columns fills
 * in on its own the moment the season simulator writes a score back.
 *
 * Three things in the reference this is built from are absent on purpose: the
 * arena name, the broadcaster and the tip-off time. None exists anywhere in the
 * data model, and inventing them would put three fabrications on every row.
 * Location says Home or Away, which is a fact about the fixture.
 */

import { loadLeague, listSavesDetailed, touchLastPlayed, saveLeague } from './db.js';
import { mountNav, activeLeagueId, renderNoCareer, markPlayed } from './shell.js';
import { applyTeamTheme } from './teamTheme.js';
import { crestHTML } from './leagueConfig.js';
import {
  buildSchedule, teamGames, teamRecord, runningRecords, nextGame,
  scheduleMonths, formatGameDate, formatLongDate, toCSV,
  leagueGamesOn, gamesPerDate, leagueDates,
} from './schedule.js';

const el = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let league = null;
let leagueId = null;
let viewTeam = null;
let months = [];
let monthIdx = 0;
let filter = 'all';
let selectedDate = null;
/** 'team' shows one club's season; 'league' shows every game on one date. */
let scope = 'team';
let dayIdx = 0;
let allDates = [];

const teamById = (id) => (league.teams || []).find((t) => t.id === id) || null;
const teamName = (id) => {
  const t = teamById(id);
  return t ? `${t.city || ''} ${t.name || ''}`.trim() : id;
};
const shortName = (id) => {
  const t = teamById(id);
  return t ? (t.name || t.city || id) : id;
};

/* ------------------------------------------------------------------ data */

/**
 * The league's schedule, built and saved once.
 *
 * Generated on first open rather than at league creation so that an existing
 * career picks one up too, and written back immediately so every later visit —
 * and the simulator, when it consumes this — sees the same season.
 */
async function ensureSchedule() {
  const season = (league.meta && league.meta.currentSeason) || null;
  if (league.schedule && league.schedule.season === season
      && Array.isArray(league.schedule.games) && league.schedule.games.length) {
    return league.schedule;
  }
  league.schedule = buildSchedule(league, season);
  try { await saveLeague(leagueId, league); } catch (_) { /* read-only is fine */ }
  return league.schedule;
}

/* ---------------------------------------------------------------- render */

function render() {
  const games = teamGames(league.schedule, viewTeam);
  const record = teamRecord(games);
  const records = runningRecords(games);
  const next = nextGame(games);

  // The whole screen carries the viewed club's colours, so the accents below
  // follow the team switcher rather than being pinned to one hue.
  applyTeamTheme(teamById(viewTeam), document.body);
  renderTeamChip();
  renderStrip(record, next);
  renderControls();
  if (scope === 'league') renderLeagueDay();
  else renderTable(games, records);
  renderNext(next);
  renderCalendar(games);
}

function renderTeamChip() {
  const t = teamById(viewTeam);
  el('teamChipLogo').outerHTML =
    `<div class="avatar" id="teamChipLogo">${t ? crestHTML(t, 38) : '🏀'}</div>`;
  el('teamChipSub').textContent =
    `${(league.meta && league.meta.currentSeason) || '—'} Season`;
  const own = league.meta && league.meta.userTeamId;
  el('ownTag').hidden = !own || own !== viewTeam;
}

/**
 * The summary strip. A record of 0-0 would be a claim that this team has played
 * and not won, so a team with no games played shows dashes instead.
 */
function renderStrip(r, next) {
  const cell = (label, value, sub, cls) => `<div class="s-cell">
    <div class="s-k">${esc(label)}</div>
    <div class="s-v ${cls || ''}">${value}</div>
    ${sub ? `<div class="s-s">${sub}</div>` : ''}</div>`;

  const none = '<span class="na">—</span>';
  const streakClass = r.streak ? (r.streak[0] === 'W' ? 'is-w' : 'is-l') : '';
  el('strip').innerHTML = [
    cell('Record', r.played ? `${r.wins} - ${r.losses}` : none,
      r.played ? '' : 'no games played'),
    cell('Home', r.home ? esc(r.home.replace('-', ' - ')) : none),
    cell('Away', r.away ? esc(r.away.replace('-', ' - ')) : none),
    cell('Streak', r.streak ? esc(r.streak) : none, '', streakClass),
    cell('Last 10', r.last10 ? esc(r.last10.replace('-', ' - ')) : none),
    // "vs" is wrong for a road game, and the fixture already knows which it is.
    cell('Next Game', next ? `${next.home ? 'vs' : '@'} ${esc(shortName(next.opponent))}` : none,
      next ? esc(formatGameDate(next.date)) : 'season complete'),
  ].join('');
}

function renderControls() {
  el('seasonLabel').textContent = (league.schedule && league.schedule.season) || '—';
  // One season exists, so stepping off it would be stepping onto nothing.
  el('seasonPrev').disabled = true;
  el('seasonNext').disabled = true;
  const m = months[monthIdx];
  el('monthLabel').textContent = m ? m.label.replace(/ \d{4}$/, '') : '—';
  el('monthPrev').disabled = monthIdx <= 0;
  el('monthNext').disabled = monthIdx >= months.length - 1;
  el('calLabel').textContent = m ? m.label.toUpperCase() : '—';
  el('viewSel').value = filter;

  for (const btn of el('scopeSeg').querySelectorAll('button')) {
    btn.classList.toggle('is-active', btn.dataset.scope === scope);
  }
  // The home/away filter is about one club's season, so it has no meaning
  // against a day of league-wide fixtures.
  el('viewGroup').hidden = scope === 'league';
  el('leagueDay').hidden = scope !== 'league';
  if (scope === 'league') {
    const date = allDates[dayIdx];
    el('dayLabel').textContent = date ? formatLongDate(date) : '—';
    el('dayPrev').disabled = dayIdx <= 0;
    el('dayNext').disabled = dayIdx >= allDates.length - 1;
    const n = date ? (gamesPerDate(league.schedule).get(date) || 0) : 0;
    el('dayCount').textContent = n ? `${n} game${n === 1 ? '' : 's'}` : '';
  }
}

const TEAM_HEAD = `<tr><th>Date</th><th>Opponent</th><th>Location</th>
  <th>Result</th><th>Score</th><th>Record</th></tr>`;
const LEAGUE_HEAD = `<tr><th>Away</th><th></th><th>Home</th>
  <th>Result</th><th>Score</th></tr>`;

/**
 * Every game in the league on one date.
 *
 * The viewed team's own game is marked, which is the only reason the team
 * switcher still matters here — it is the row a manager is looking for in a
 * page of fixtures that are mostly not his.
 */
function renderLeagueDay() {
  el('gamesHead').innerHTML = LEAGUE_HEAD;
  const date = allDates[dayIdx];
  const games = date ? leagueGamesOn(league.schedule, date) : [];
  if (!games.length) {
    el('gamesBody').innerHTML =
      `<tr class="sg-empty"><td colspan="5">No games on this date.</td></tr>`;
    return;
  }
  el('gamesBody').innerHTML = games.map((g) => {
    const away = teamById(g.away), home = teamById(g.home);
    const mine = g.home === viewTeam || g.away === viewTeam;
    const side = (t, won) => `<span class="sg-side${won ? ' is-won' : ''}">
      <span class="sg-crest">${t ? crestHTML(t, 24) : ''}</span>
      <span>${esc(teamName(t && t.id))}</span></span>`;
    return `<tr class="${mine ? 'is-mine' : ''}">
      <td>${side(away, g.winner === 'away')}</td>
      <td class="sg-at">@</td>
      <td>${side(home, g.winner === 'home')}</td>
      <td>${g.winner
        ? `<span class="sg-res is-w">Final</span>`
        : '<span class="na">--</span>'}</td>
      <td>${g.winner ? `${g.awayScore} - ${g.homeScore}` : '<span class="na">--</span>'}</td>
    </tr>`;
  }).join('');
}

function passesFilter(g) {
  if (filter === 'home') return g.home;
  if (filter === 'away') return !g.home;
  if (filter === 'played') return !!g.result;
  if (filter === 'upcoming') return !g.result;
  return true;
}

function renderTable(games, records) {
  el('gamesHead').innerHTML = TEAM_HEAD;
  const m = months[monthIdx];
  const rows = games
    .map((g, i) => ({ g, record: records[i] }))
    .filter(({ g }) => (!m || g.date.slice(0, 7) === m.key) && passesFilter(g));

  if (!rows.length) {
    el('gamesBody').innerHTML =
      `<tr class="sg-empty"><td colspan="6">No games match this filter.</td></tr>`;
    return;
  }
  const nextId = (nextGame(games) || {}).id;
  el('gamesBody').innerHTML = rows.map(({ g, record }) => {
    const opp = teamById(g.opponent);
    return `<tr class="${g.id === nextId ? 'is-next' : ''}${
      g.date === selectedDate ? ' is-selected' : ''}">
      <td class="sg-date">${esc(formatGameDate(g.date))}</td>
      <td class="sg-opp">
        <span class="sg-crest">${opp ? crestHTML(opp, 24) : ''}</span>
        <span>${g.home ? '' : '@ '}${esc(teamName(g.opponent))}</span>
      </td>
      <td>${g.home ? 'Home' : 'Away'}</td>
      <td>${g.result
        ? `<span class="sg-res is-${g.result === 'W' ? 'w' : 'l'}">${g.result}</span>`
        : '<span class="na">--</span>'}</td>
      <td>${g.result ? `${g.forScore} - ${g.againstScore}` : '<span class="na">--</span>'}</td>
      <td>${record ? esc(record.replace('-', ' - ')) : '<span class="na">--</span>'}</td>
    </tr>`;
  }).join('');
}

/**
 * The next game card. The reference carries a venue, a broadcaster and a
 * tip-off time; none of the three exists in the save, so the card shows the
 * two clubs, the date and which of them is at home — all of which are real.
 */
function renderNext(next) {
  if (!next) {
    el('nextCard').innerHTML = `<div class="nc-h">Next Game</div>
      <p class="nc-empty">Every game on the schedule has been played.</p>`;
    return;
  }
  const me = teamById(viewTeam);
  const them = teamById(next.opponent);
  const side = (t, rec) => `<div class="nc-team">
    <div class="nc-crest">${t ? crestHTML(t, 62) : ''}</div>
    <div class="nc-name">${esc(teamName(t && t.id))}</div>
    <div class="nc-rec">${rec}</div>
  </div>`;

  const myRec = teamRecord(teamGames(league.schedule, viewTeam));
  const theirRec = teamRecord(teamGames(league.schedule, next.opponent));
  const recLine = (r) => (r.played ? `${r.wins} - ${r.losses}` : '<span class="na">—</span>');

  el('nextCard').innerHTML = `
    <div class="nc-h">Next Game</div>
    <div class="nc-date">${esc(formatLongDate(next.date))}</div>
    <div class="nc-matchup">
      ${side(me, recLine(myRec))}
      <div class="nc-vs">VS</div>
      ${side(them, recLine(theirRec))}
    </div>
    <div class="nc-meta">
      <b>${next.home ? 'Home' : 'Away'} game.</b>
      ${esc(teamName(next.home ? viewTeam : next.opponent))} hosts.
      <span class="nc-note">The save has no arena, broadcaster or tip-off time,
        so none is shown.</span>
    </div>
    <button class="mini nc-todo" disabled title="Not built yet">Game Preview</button>`;
}

/** A month grid. A day is marked only by what the save knows about it. */
function renderCalendar(games) {
  const m = months[monthIdx];
  if (!m) { el('calGrid').innerHTML = ''; return; }
  const byDate = new Map();
  for (const g of games) if (g.date.slice(0, 7) === m.key) byDate.set(g.date, g);

  const first = new Date(Date.UTC(m.year, m.month, 1));
  const days = new Date(Date.UTC(m.year, m.month + 1, 0)).getUTCDate();
  const lead = first.getUTCDay();

  const head = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    .map((d) => `<div class="cal-dow">${d}</div>`).join('');

  // In the league-wide view every date is selectable, not only the ones the
  // viewed team plays on.
  const counts = gamesPerDate(league.schedule);
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<div class="cal-cell is-blank"></div>');
  for (let d = 1; d <= days; d++) {
    const iso = `${m.year}-${String(m.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const g = byDate.get(iso);
    const leagueCount = counts.get(iso) || 0;
    const clickable = scope === 'league' ? leagueCount > 0 : !!g;
    const cls = ['cal-cell'];
    if (g) cls.push(g.result === 'W' ? 'is-win' : g.result === 'L' ? 'is-loss' : 'is-up');
    else if (scope === 'league' && leagueCount) cls.push('is-league');
    if (iso === selectedDate) cls.push('is-sel');
    // The opponent's crest, which is what makes a month readable at a glance —
    // the day number moves to the corner rather than being replaced.
    const opp = g ? teamById(g.opponent) : null;
    const inner = opp
      ? `<span class="cal-n">${d}</span><span class="cal-crest">${crestHTML(opp, 20)}</span>`
      : `<span class="cal-d">${d}</span>${
          scope === 'league' && leagueCount ? `<span class="cal-c">${leagueCount}</span>` : ''}`;
    cells.push(`<div class="${cls.join(' ')}"${clickable ? ` data-date="${iso}" role="button"
      tabindex="0" title="${g ? esc(`${g.home ? 'vs ' : '@ '}${teamName(g.opponent)}`)
        : `${leagueCount} games`}"` : ''}>${inner}</div>`);
  }
  el('calGrid').innerHTML = head + cells.join('');
}

/* ----------------------------------------------------------------- wire */

function bind() {
  el('teamSel').addEventListener('change', (e) => {
    viewTeam = e.target.value; selectedDate = null; render();
  });
  el('monthPrev').addEventListener('click', () => { if (monthIdx > 0) { monthIdx--; render(); } });
  el('monthNext').addEventListener('click', () => {
    if (monthIdx < months.length - 1) { monthIdx++; render(); }
  });
  el('calPrev').addEventListener('click', () => { if (monthIdx > 0) { monthIdx--; render(); } });
  el('calNext').addEventListener('click', () => {
    if (monthIdx < months.length - 1) { monthIdx++; render(); }
  });
  el('viewSel').addEventListener('change', (e) => { filter = e.target.value; render(); });
  el('calGrid').addEventListener('click', (e) => {
    const cell = e.target.closest('[data-date]');
    if (!cell) return;
    const date = cell.dataset.date;
    if (scope === 'league') {
      // In the day view a calendar click IS the navigation.
      const i = allDates.indexOf(date);
      if (i >= 0) dayIdx = i;
      selectedDate = date;
    } else {
      selectedDate = selectedDate === date ? null : date;
    }
    render();
  });
  el('scopeSeg').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-scope]');
    if (!btn || btn.dataset.scope === scope) return;
    scope = btn.dataset.scope;
    if (scope === 'league') {
      // Open on the day already selected, else the viewed team's next game.
      const next = nextGame(teamGames(league.schedule, viewTeam));
      const target = selectedDate || (next && next.date) || allDates[0];
      const i = allDates.indexOf(target);
      dayIdx = i >= 0 ? i : 0;
      selectedDate = allDates[dayIdx] || null;
      syncMonthToDay();
    }
    render();
  });
  el('dayPrev').addEventListener('click', () => {
    if (dayIdx > 0) { dayIdx--; selectedDate = allDates[dayIdx]; syncMonthToDay(); render(); }
  });
  el('dayNext').addEventListener('click', () => {
    if (dayIdx < allDates.length - 1) {
      dayIdx++; selectedDate = allDates[dayIdx]; syncMonthToDay(); render();
    }
  });
  el('exportBtn').addEventListener('click', () => {
    const games = teamGames(league.schedule, viewTeam);
    const csv = toCSV(games, teamName);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${shortName(viewTeam)}-${league.schedule.season}-schedule.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

/** Keep the calendar on the month the selected day belongs to. */
function syncMonthToDay() {
  const date = allDates[dayIdx];
  if (!date) return;
  const i = months.findIndex((m) => m.key === date.slice(0, 7));
  if (i >= 0) monthIdx = i;
}

/* ----------------------------------------------------------------- boot */

(async function boot() {
  let id = null;
  try {
    id = await activeLeagueId(listSavesDetailed);
    if (id) league = await loadLeague(id);
  } catch (_) { /* fall through to the no-career state */ }

  mountNav('schedule', id);
  if (!league) { renderNoCareer(); return; }
  markPlayed(touchLastPlayed, id);
  leagueId = id;

  await ensureSchedule();

  viewTeam = (league.meta && league.meta.userTeamId)
    || ((league.teams || [])[0] || {}).id || null;

  el('teamSel').innerHTML = (league.teams || [])
    .slice().sort((a, b) => teamName(a.id).localeCompare(teamName(b.id)))
    .map((t) => `<option value="${esc(t.id)}"${t.id === viewTeam ? ' selected' : ''}
      >${esc(teamName(t.id))}</option>`).join('');

  months = scheduleMonths(league.schedule.games);
  allDates = leagueDates(league.schedule);
  // Open on the month the next game falls in, which is where a manager is.
  const next = nextGame(teamGames(league.schedule, viewTeam));
  const idx = next ? months.findIndex((m) => m.key === next.date.slice(0, 7)) : 0;
  monthIdx = idx >= 0 ? idx : 0;

  bind();
  render();
}());
