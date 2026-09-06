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
import { spreadModel, formatLine } from './powerRanking.js';
import { detectBackToBacks } from './scheduleFatigue.js';
import { preseasonGames } from './preseason.js';

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
/**
 * The projector behind the Spread column, rebuilt on every render.
 *
 * Rebuilding rather than caching is the point: the line has to move when the
 * roster does. A trade, a signing, a player's ratings changing, or the league
 * entering the playoffs all land on the next render, and none of them needs
 * this screen to know about them.
 */
let model = null;
/**
 * Which fixtures each club arrives at on no rest, rebuilt alongside the spread
 * model. Flags the SECOND night of a pair — the game the tiredness is carried
 * into, not the one it was earned in.
 */
let rest = null;
/**
 * 'regular' or 'preseason'. The two read DIFFERENT fixture lists — exhibitions
 * live in `schedule.preseason.games` and never in `schedule.games` — so this
 * switch changes the data source, not a filter over one list. That is what
 * keeps a preseason game from ever reaching a record or a rating.
 */
let phase = 'regular';

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

/** The exhibition slate, or null when the league has none. */
const preseason = () => (league.schedule && league.schedule.preseason) || null;

function render() {
  model = spreadModel(league);
  // Rest and records are properties of the SEASON, so they read the regular
  // fixture list whichever tab is open. An exhibition never becomes a
  // back-to-back a fatigue system would charge for.
  rest = detectBackToBacks(league.schedule);

  const pre = phase === 'preseason';
  const games = pre
    ? preseasonGames(preseason(), viewTeam)
    : teamGames(league.schedule, viewTeam);
  // A preseason record is not a record. Exhibitions are shown with their
  // result and counted into nothing, so the strip keeps reporting the season.
  const seasonGames = teamGames(league.schedule, viewTeam);
  const record = teamRecord(seasonGames);
  const records = pre ? games.map(() => null) : runningRecords(games);
  const next = nextGame(games);

  // The whole screen carries the viewed club's colours, so the accents below
  // follow the team switcher rather than being pinned to one hue.
  applyTeamTheme(teamById(viewTeam), document.body);
  renderTeamChip();
  renderStrip(record, next);
  renderControls();
  if (scope === 'league' && !pre) renderLeagueDay();
  else renderTable(games, records);
  renderNext(next);
  renderCalendar(games);
}

/**
 * Reseat the month stepper on whichever fixture list the open tab reads.
 *
 * The two phases live in different months — the preseason runs before opening
 * night — so a month index from one is meaningless in the other.
 */
function syncMonths() {
  const pre = phase === 'preseason';
  const list = pre
    ? ((preseason() && preseason().games) || [])
    : (league.schedule.games || []);
  months = scheduleMonths(list);
  const mine = pre
    ? preseasonGames(preseason(), viewTeam)
    : teamGames(league.schedule, viewTeam);
  // Open on the month the next game falls in, which is where a manager is.
  const next = nextGame(mine) || mine[0];
  const idx = next ? months.findIndex((m) => m.key === next.date.slice(0, 7)) : 0;
  monthIdx = idx >= 0 ? idx : 0;
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
    // Every cell to the left of this one counts the SEASON, so when the
    // preseason tab is open the label says which fixture list this one is
    // reading. A next-game cell quietly switching lists under a season heading
    // would read as a season game.
    // "vs" is wrong for a road game, and the fixture already knows which it is.
    cell(phase === 'preseason' ? 'Next Preseason' : 'Next Game',
      next ? `${next.home ? 'vs' : '@'} ${esc(shortName(next.opponent))}` : none,
      next ? esc(formatGameDate(next.date))
        : (phase === 'preseason' ? 'preseason complete' : 'season complete')),
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

  for (const btn of document.querySelectorAll('#tabs .tab[data-tab]')) {
    btn.classList.toggle('is-active', btn.dataset.tab === phase);
  }
  for (const btn of el('scopeSeg').querySelectorAll('button')) {
    btn.classList.toggle('is-active', btn.dataset.scope === scope);
  }
  // The league-day view reads the season's fixture list, so it has nothing to
  // show while the preseason tab is open.
  el('scopeSeg').closest('.sc-group').hidden = phase === 'preseason';
  // The home/away filter is about one club's season, so it has no meaning
  // against a day of league-wide fixtures.
  // What the Spread column is, said once under the table rather than in a
  // tooltip nobody opens. Which rating it used matters, so it names that too.
  const noteEl = el('spreadNote');
  if (noteEl && phase === 'preseason') {
    const pre = preseason();
    const p = pre && pre.plan;
    noteEl.innerHTML = p
      ? `<b>Preseason</b> games are exhibitions. They carry a result but count towards
         nothing — not records, not standings, not ratings, not back-to-backs — because
         they are kept in a separate fixture list from the season. This league plays
         <b>${pre.games.length}</b> of them across <b>${pre.window.days}</b> days,
         averaging <b>${p.average.toFixed(1)}</b> per club (lowest ${p.lowest},
         highest ${p.highest}).`
      : '';
  } else if (noteEl) {
    // The club's own count, then the league's, so the number the settings asked
    // for can be checked against the season that was actually built.
    const rep = league.schedule && league.schedule.rest && league.schedule.rest.backToBacks;
    const leagueLine = rep && rep.teams
      ? ` League average <b>${rep.average.toFixed(1)}</b>, lowest <b>${rep.lowest}</b>,
          highest <b>${rep.highest}</b>.`
      : '';
    const t = rest && rest.byTeam.get(viewTeam);
    const freq = t && t.total
      ? ` <b>${esc(shortName(viewTeam))}</b> play <b>${t.backToBack}</b> back-to-back${
          t.backToBack === 1 ? '' : 's'} in ${t.total} games — ${
          (t.backToBack / t.total * 100).toFixed(1)}% of the schedule, marked B2B on the
          second night.${leagueLine}`
      : '';
    noteEl.innerHTML = (model && model.mode === 'playoff'
      ? `<b>Spread</b> is a projection from <b>playoff</b> power ratings — rotations
         shorten and the best players play more, so top-heavy teams rate higher than
         they did in the regular season. A negative number means favoured. Played
         games show their score instead.`
      : `<b>Spread</b> is a projection from power ratings, weighted down each team's
         rotation. A negative number means favoured, positive means underdog. It moves
         with the rosters, and played games show their score instead.`) + freq;
  }
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
  <th>Spread<span class="th-tag">proj</span></th>
  <th>Result</th><th>Score</th><th>Record</th></tr>`;
/**
 * The preseason table drops two columns, and both omissions are deliberate.
 *
 * There is no Record, because an exhibition does not produce one — printing a
 * running W-L beside games that count for nothing would be inventing a record.
 * There is no Spread either: a projection built from rotation-weighted ratings
 * assumes the rotation plays, and the one thing everyone knows about a
 * preseason game is that it does not. A number that is wrong by construction is
 * worse than no number.
 */
const PRESEASON_HEAD = `<tr><th>Date</th><th>Opponent</th><th>Location</th>
  <th>Result</th><th>Score</th></tr>`;

// In the league-wide view the line is quoted for the home side — the club the
// column sits next to — so the header says so rather than leaving it to a
// tooltip.
const LEAGUE_HEAD = `<tr><th>Away</th><th></th><th>Home</th>
  <th>Home Spread<span class="th-tag">proj</span></th>
  <th>Result</th><th>Score</th></tr>`;

/**
 * The projected line for one fixture, from one team's point of view.
 *
 * Two rules hold this column honest. A game that has been played shows no line
 * at all — the Score column already says what happened, and a forecast printed
 * beside a result invites the two to be read as the same kind of thing. And a
 * fixture the model cannot rate (a club with nobody on it) shows a dash rather
 * than a number, because "no opinion" is a real answer.
 */
/**
 * The no-rest marker for one side of one fixture.
 *
 * A fact about the fixture list, not a projection: the schedule says this club
 * played yesterday. It is shown because it is the thing that explains a soft
 * night, and it is shown on the second game rather than both, which is the
 * game the tiredness is actually carried into.
 */
function b2b(gameId, which) {
  const f = rest && rest.flags.get(gameId);
  if (!f || !f[which]) return '';
  return `<span class="sg-b2b" title="Back-to-back — this team played yesterday.">B2B</span>`;
}

function spreadCell(homeId, awayId, forTeam, played) {
  const none = '<span class="na">--</span>';
  if (played) return none;
  const s = model && model.spread(homeId, awayId);
  if (!s) return none;
  const v = s.line(forTeam);
  const cls = v < 0 ? 'is-fav' : v > 0 ? 'is-dog' : 'is-pk';
  const who = v < 0 ? 'favoured by' : v > 0 ? 'expected to lose by' : 'level with';
  const title = v === 0
    ? `Projected pick'em: ${teamName(homeId)} and ${teamName(awayId)} rate level.`
    : `Projected: ${teamName(forTeam)} ${who} ${s.margin} points. A forecast from `
      + `power ratings, not a result.`;
  return `<span class="sg-spread ${cls}" title="${esc(title)}">${esc(formatLine(v))}</span>`;
}

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
      `<tr class="sg-empty"><td colspan="6">No games on this date.</td></tr>`;
    return;
  }
  el('gamesBody').innerHTML = games.map((g) => {
    const away = teamById(g.away), home = teamById(g.home);
    const mine = g.home === viewTeam || g.away === viewTeam;
    const side = (t, won, which) => `<span class="sg-side${won ? ' is-won' : ''}">
      <span class="sg-crest">${t ? crestHTML(t, 24) : ''}</span>
      <span>${esc(teamName(t && t.id))}</span>${b2b(g.id, which)}</span>`;
    return `<tr class="${mine ? 'is-mine' : ''}">
      <td>${side(away, g.winner === 'away', 'away')}</td>
      <td class="sg-at">@</td>
      <td>${side(home, g.winner === 'home', 'home')}</td>
      <td>${spreadCell(g.home, g.away, g.home, !!g.winner)}</td>
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
  const pre = phase === 'preseason';
  el('gamesHead').innerHTML = pre ? PRESEASON_HEAD : TEAM_HEAD;
  const m = months[monthIdx];
  const rows = games
    .map((g, i) => ({ g, record: records[i] }))
    .filter(({ g }) => (!m || g.date.slice(0, 7) === m.key) && passesFilter(g));

  if (!rows.length) {
    el('gamesBody').innerHTML = `<tr class="sg-empty"><td colspan="${pre ? 5 : 7}">${
      pre ? 'No preseason games match this filter.' : 'No games match this filter.'
    }</td></tr>`;
    return;
  }
  const nextId = (nextGame(games) || {}).id;
  el('gamesBody').innerHTML = rows.map(({ g, record }) => {
    const opp = teamById(g.opponent);
    return `<tr class="${g.id === nextId ? 'is-next' : ''}${
      g.date === selectedDate ? ' is-selected' : ''}">
      <td class="sg-date">${esc(formatGameDate(g.date))}${
        b2b(g.id, g.home ? 'home' : 'away')}</td>
      <td class="sg-opp">
        <span class="sg-crest">${opp ? crestHTML(opp, 24) : ''}</span>
        <span>${g.home ? '' : '@ '}${esc(teamName(g.opponent))}</span>
      </td>
      <td>${g.home ? 'Home' : 'Away'}</td>
      ${pre ? '' : `<td>${spreadCell(g.home ? viewTeam : g.opponent,
                       g.home ? g.opponent : viewTeam, viewTeam, !!g.result)}</td>`}
      <td>${g.result
        ? `<span class="sg-res is-${g.result === 'W' ? 'w' : 'l'}">${g.result}</span>`
        : '<span class="na">--</span>'}</td>
      <td>${g.result ? `${g.forScore} - ${g.againstScore}` : '<span class="na">--</span>'}</td>
      ${pre ? '' : `<td>${record ? esc(record.replace('-', ' - ')) : '<span class="na">--</span>'}</td>`}
    </tr>`;
  }).join('');
}

/**
 * The projected line on the next-game card, spelled out rather than quoted.
 *
 * The card has room to say what the number is, so it does: which club the model
 * likes, by how much, off which two ratings, and — plainly — that it is a
 * forecast. The two power ratings are shown because a line with no ratings
 * behind it is a number to be argued with; a line with them is a number to be
 * checked.
 */
function spreadBlock(sp, homeId, awayId) {
  const pk = sp.margin === 0;
  const headline = pk
    ? `Pick'em`
    : `${esc(shortName(sp.favourite))} ${esc(formatLine(-sp.margin))}`;
  const playoff = sp.mode === 'playoff';
  return `<div class="nc-spread">
    <div class="nc-sk">Projected Line</div>
    <div class="nc-sv ${pk ? 'is-pk' : ''}">${headline}</div>
    <div class="nc-sp">
      <span>${esc(shortName(awayId))} <b>${sp.awayPower.toFixed(1)}</b></span>
      <span>${esc(shortName(homeId))} <b>${sp.homePower.toFixed(1)}</b></span>
    </div>
    <div class="nc-ss">${playoff
      ? 'Playoff power ratings — rotations shorten and the best players play more.'
      : 'Regular-season power ratings, weighted down the rotation.'}
      A forecast, not a result.</div>
  </div>`;
}

/**
 * The next game card. The reference carries a venue, a broadcaster and a
 * tip-off time; none of the three exists in the save, so the card shows the
 * two clubs, the date and which of them is at home — all of which are real.
 */
function renderNext(next) {
  if (phase === 'preseason') {
    // No projected line here: see PRESEASON_HEAD. The card still says what the
    // next exhibition is, which is a fact about the fixture list.
    if (!next) {
      el('nextCard').innerHTML = `<div class="nc-h">Next Preseason Game</div>
        <p class="nc-empty">Every preseason game has been played.</p>`;
      return;
    }
    const me = teamById(viewTeam), them = teamById(next.opponent);
    const side = (t) => `<div class="nc-team">
      <div class="nc-crest">${t ? crestHTML(t, 62) : ''}</div>
      <div class="nc-name">${esc(teamName(t && t.id))}</div>
      <div class="nc-rec"><span class="na">exhibition</span></div>
    </div>`;
    el('nextCard').innerHTML = `
      <div class="nc-h">Next Preseason Game</div>
      <div class="nc-date">${esc(formatLongDate(next.date))}</div>
      <div class="nc-matchup">
        ${side(me)}<div class="nc-vs">VS</div>${side(them)}
      </div>
      <div class="nc-meta">
        <b>${next.home ? 'Home' : 'Away'} game.</b>
        ${esc(teamName(next.home ? viewTeam : next.opponent))} hosts.
        <span class="nc-note">No projected line: a spread assumes the rotation plays,
          and in an exhibition it does not.</span>
      </div>`;
    return;
  }
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

  const homeId = next.home ? viewTeam : next.opponent;
  const awayId = next.home ? next.opponent : viewTeam;
  const sp = model && model.spread(homeId, awayId);

  el('nextCard').innerHTML = `
    <div class="nc-h">Next Game</div>
    <div class="nc-date">${esc(formatLongDate(next.date))}</div>
    <div class="nc-matchup">
      ${side(me, recLine(myRec))}
      <div class="nc-vs">VS</div>
      ${side(them, recLine(theirRec))}
    </div>
    ${sp ? spreadBlock(sp, homeId, awayId) : ''}
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
    viewTeam = e.target.value; selectedDate = null; syncMonths(); render();
  });
  // Switching phase switches which fixture list is on screen, so the month
  // stepper has to be reseated: the preseason's months are not the season's.
  for (const btn of document.querySelectorAll('#tabs .tab[data-tab]')) {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      phase = btn.dataset.tab;
      selectedDate = null;
      if (phase === 'preseason') scope = 'team';
      syncMonths();
      render();
    });
  }
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

  allDates = leagueDates(league.schedule);
  // A league with no preseason has no tab to open; the button says so rather
  // than sitting there dead.
  const preTab = el('tabPreseason');
  const pre = preseason();
  if (preTab) {
    const has = !!(pre && pre.games && pre.games.length);
    preTab.disabled = !has;
    preTab.classList.toggle('is-todo', !has);
    preTab.title = has
      ? `${pre.games.length} exhibition games — they do not count towards records.`
      : 'Preseason is switched off for this league.';
  }
  syncMonths();

  bind();
  render();
}());
