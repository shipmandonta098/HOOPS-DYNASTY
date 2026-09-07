'use strict';

/**
 * liveGame.js — watching a game unfold.
 *
 * WHAT "LIVE" MEANS HERE. The game is played out in full the moment you press
 * the button — the simulator is deterministic and takes about a millisecond —
 * and this replays the plays it produced on a clock. That is a deliberate
 * choice rather than a shortcut: it means watching a game and simulating it
 * give exactly the same result, so a manager cannot fish for a better score by
 * picking the other button. The uncertainty is in the seed, not in which way
 * you chose to look at it.
 *
 * NOTHING IS WRITTEN UNTIL THE GAME IS OVER. Close the window at half time and
 * the fixture is still unplayed, because it is: half a game is not a result.
 * Reaching the final buzzer, or skipping to it, is what commits the score.
 */

import { crestHTML } from './leagueConfig.js';
import { simulateGame, applyResult } from './gameSim.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Milliseconds between plays at each speed. */
const SPEEDS = [
  { label: '1×', ms: 750 },
  { label: '2×', ms: 340 },
  { label: '4×', ms: 130 },
  { label: '8×', ms: 45 },
];

/**
 * Open the live view for one fixture.
 *
 * @param {object} league
 * @param {object} game     the fixture, mutated in place when it finishes
 * @param {function} onDone called with the result once the game is committed,
 *   and not called at all if the viewer walks away early.
 */
export function watchLive(league, game, onDone) {
  const result = simulateGame(league, game);
  if (!result) return null;

  const home = (league.teams || []).find((t) => t.id === game.home) || {};
  const away = (league.teams || []).find((t) => t.id === game.away) || {};

  const root = document.createElement('div');
  root.className = 'lg-backdrop';
  root.innerHTML = `
    <div class="lg" role="dialog" aria-modal="true" aria-label="Live game">
      <header class="lg-score">
        <div class="lg-team">
          <div class="lg-crest">${crestHTML(away, 40)}</div>
          <div class="lg-tn">${esc(`${away.city || ''} ${away.name || ''}`.trim())}</div>
          <div class="lg-pts" id="lgAway">0</div>
        </div>
        <div class="lg-clock">
          <div class="lg-per" id="lgPeriod">Tip-off</div>
          <div class="lg-time" id="lgTime">${esc(startClock(result))}</div>
          <button class="lg-x" id="lgClose" aria-label="Close">✕</button>
        </div>
        <div class="lg-team is-home">
          <div class="lg-crest">${crestHTML(home, 40)}</div>
          <div class="lg-tn">${esc(`${home.city || ''} ${home.name || ''}`.trim())}</div>
          <div class="lg-pts" id="lgHome">0</div>
        </div>
      </header>

      <div class="lg-feed" id="lgFeed" aria-live="polite"></div>

      <footer class="lg-bar">
        <button class="lg-btn" id="lgPlay">Pause</button>
        <div class="lg-speed" id="lgSpeed" role="group" aria-label="Speed">
          ${SPEEDS.map((s, i) => `<button data-i="${i}"${i === 1 ? ' class="is-on"' : ''}
            >${s.label}</button>`).join('')}
        </div>
        <div class="lg-prog"><i id="lgProg"></i></div>
        <button class="lg-btn is-ghost" id="lgSkip">Skip to Final</button>
      </footer>
    </div>`;
  document.body.appendChild(root);

  const el = (id) => root.querySelector(`#${id}`);
  const feed = el('lgFeed');
  let i = 0;
  let speed = 1;
  let paused = false;
  let timer = null;
  let committed = false;

  /** Put one play on screen and move the scoreboard to match it. */
  const step = () => {
    if (i >= result.plays.length) { finish(); return; }
    const p = result.plays[i++];
    el('lgAway').textContent = p.away;
    el('lgHome').textContent = p.home;
    el('lgPeriod').textContent = periodLabel(p.period);
    el('lgTime').textContent = p.clock;
    el('lgProg').style.width = `${Math.round((i / result.plays.length) * 100)}%`;

    const row = document.createElement('div');
    row.className = `lg-play is-${p.kind}${p.side ? ` is-${p.side}` : ''}`;
    row.innerHTML = `<span class="lg-when">${esc(p.clock)}</span>
      <span class="lg-txt">${esc(p.text)}</span>
      <span class="lg-run">${p.away}-${p.home}</span>`;
    feed.appendChild(row);
    // Only the tail matters while a game is running, and an 800-row feed makes
    // the browser work for nothing.
    while (feed.childElementCount > 220) feed.removeChild(feed.firstChild);
    feed.scrollTop = feed.scrollHeight;
  };

  const tick = () => {
    if (paused) return;
    step();
    if (i < result.plays.length) timer = setTimeout(tick, SPEEDS[speed].ms);
  };

  /** The buzzer: the only place a result is written. */
  const finish = () => {
    if (committed) return;
    committed = true;
    clearTimeout(timer);
    el('lgPlay').disabled = true;
    el('lgSkip').disabled = true;
    el('lgPeriod').textContent = 'Final';
    el('lgTime').textContent = '0:00';
    el('lgProg').style.width = '100%';
    el('lgAway').textContent = result.awayScore;
    el('lgHome').textContent = result.homeScore;
    applyResult(game, result);
    if (typeof onDone === 'function') onDone(result);
  };

  const close = () => {
    clearTimeout(timer);
    root.remove();
    document.removeEventListener('keydown', onKey);
  };

  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  };

  const togglePlay = () => {
    if (committed) return;
    paused = !paused;
    el('lgPlay').textContent = paused ? 'Resume' : 'Pause';
    if (!paused) tick();
  };

  el('lgPlay').addEventListener('click', togglePlay);
  el('lgClose').addEventListener('click', close);
  root.addEventListener('click', (e) => { if (e.target === root) close(); });
  el('lgSkip').addEventListener('click', () => {
    clearTimeout(timer);
    // Draw the tail rather than every play, so skipping is instant and the
    // feed still shows how the game ended.
    i = Math.max(i, result.plays.length - 60);
    while (i < result.plays.length) step();
    finish();
  });
  el('lgSpeed').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    speed = Number(b.dataset.i);
    for (const x of el('lgSpeed').querySelectorAll('button')) {
      x.classList.toggle('is-on', x === b);
    }
  });
  document.addEventListener('keydown', onKey);

  tick();
  return { close };
}

const periodLabel = (n) => (n <= 4 ? `Q${n}` : `OT${n - 4}`);
const startClock = (r) => (r.plays[0] ? r.plays[0].clock : '12:00');
