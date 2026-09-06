'use strict';

/**
 * ownerMessage.js — the welcome letter, shown once between creating a career
 * and entering it.
 *
 * THREE THINGS IN THE REFERENCE ARE NOT HERE, on purpose.
 *
 * The city photograph. There is no photography anywhere in this game and no
 * way to obtain one per city, so the left panel is built from the club's own
 * crest and colours instead — which is a real thing the save holds, and which
 * makes the panel look different for every team rather than showing the wrong
 * skyline for twenty-nine of them.
 *
 * The three brand slogans — "More Than A Game", "Same City. Higher Standards.",
 * "People. Passion. Progress." Invented marketing copy, and one of them makes a
 * claim ("same city") about a history most careers do not have. Those slots
 * carry facts from the save instead: the season, the division, the championship
 * count, how the city feels about the club.
 *
 * A named owner. The save has no owner, so nothing is signed by a person who
 * does not exist. The letter comes from the ownership group, which is a role.
 */

import { loadLeague, listSaves, saveLeague } from './db.js';
import { crestHTML } from './leagueConfig.js';
import { teamThemeVars } from './teamTheme.js';
import { ownerLetter } from './ownerLetter.js';

const el = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const params = new URLSearchParams(location.search);

function go(id) {
  location.href = `./gm-dashboard.html?id=${encodeURIComponent(id)}`;
}

function render(league, leagueId) {
  const letter = ownerLetter(league);
  if (!letter) { go(leagueId); return; }
  const t = letter.team;

  // The whole screen takes the club's colours. teamTheme has already corrected
  // them for contrast against this surface, so a team whose real colour is too
  // dark or too pale to read still gets a legible accent.
  const vars = teamThemeVars(t, '#0e1012');
  for (const [k, v] of Object.entries(vars)) document.body.style.setProperty(k, v);

  const chip = (f) => `<div class="om-fact">
    <span class="om-fk">${esc(f.label)}</span>
    <span class="om-fv">${esc(f.value)}</span>
  </div>`;

  el('card').innerHTML = `
    <!-- Left: the club, built from its crest and colours. -->
    <aside class="om-brand">
      <div class="om-brand-inner">
        <div class="om-city">${esc(t.city || '')}</div>
        <div class="om-nick">${esc(t.name || '')}</div>
        <div class="om-crest">${crestHTML(t, 132)}</div>
        <div class="om-rule" aria-hidden="true"></div>
        <div class="om-facts">${letter.facts.slice(0, 4).map(chip).join('')}</div>
      </div>
    </aside>

    <!-- Right: the letter. -->
    <section class="om-letter">
      <header class="om-top">
        <div class="om-eyebrow">${esc(letter.eyebrow)}</div>
        <div class="om-stamp">
          ${letter.facts.slice(4).map((f) =>
            `<span>${esc(f.label)}: ${esc(f.value)}</span>`).join('')}
        </div>
      </header>

      <h1 class="om-h">
        <span class="om-kicker">${esc(letter.kicker)}</span>
        <span class="om-title">
          <b class="om-t1">${esc(letter.headline.city)}</b>
          <b class="om-t2">${esc(letter.headline.nick)}</b>
        </span>
      </h1>
      <div class="om-bar" aria-hidden="true"></div>

      <div class="om-body">
        <p class="om-dear">${esc(letter.salutation)}</p>
        ${letter.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}
      </div>

      <div class="om-sign">
        <div class="om-sign-rule" aria-hidden="true"></div>
        <div class="om-sign-txt">
          <span class="om-sk">Sincerely,</span>
          <span class="om-sv">${esc(letter.signoff)}</span>
        </div>
        <button class="om-go" id="goBtn" type="button">
          Continue <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"
            fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"
            stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
        </button>
      </div>
    </section>`;

  el('foot').innerHTML = `
    <span>${esc(`${t.city || ''} Basketball`)}</span>
    <i aria-hidden="true"></i>
    <span>${esc(league.meta.leagueName || '')} · ${esc(String(league.meta.currentSeason || ''))}</span>`;

  el('goBtn').addEventListener('click', () => go(leagueId));
  el('goBtn').focus();
  // Enter or Space anywhere continues, so the screen is not a mouse trap.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(leagueId); }
  });
}

(async function boot() {
  const id = params.get('id')
    || (() => { try { return localStorage.getItem('activeLeagueId'); } catch (_) { return null; } })();
  let leagueId = id;
  if (!leagueId) {
    const saves = await listSaves();
    leagueId = saves[saves.length - 1] || null;
  }
  if (!leagueId) { location.href = './index.html'; return; }

  const league = await loadLeague(leagueId);
  if (!league) { location.href = './index.html'; return; }

  render(league, leagueId);

  // Recorded so the rest of the game knows the letter has been delivered. The
  // page still renders if it is opened again — it is a letter, not a gate —
  // but nothing else has to guess whether the career has started.
  if (!(league.meta && league.meta.ownerWelcomeSeen)) {
    league.meta.ownerWelcomeSeen = true;
    try { await saveLeague(leagueId, league); } catch (_) { /* read-only is fine */ }
  }
}());
