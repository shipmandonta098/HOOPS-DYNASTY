'use strict';

/**
 * dashboard.js — GM Dashboard.
 *
 * GROUND RULE: this screen renders ONLY data that actually exists in the saved
 * league. Nothing is invented or "plausibly derived".
 *
 * What the save really contains: team identity, the full roster (names,
 * positions, ages, attributes, overall/potential, contracts), league settings
 * (salary cap), and meta (league name, season, phase). Ratings shown here are
 * computed from real player attributes, and payroll from real contracts.
 *
 * What it does NOT contain (and so is NOT displayed): game results, win/loss
 * records, standings, per-game stats, schedules, morale/fan/owner sentiment,
 * news, tasks, or revenue. Those need a simulated season. Until the sim runs,
 * those panels stay absent rather than being filled with invented numbers.
 * `statsHistory` is read where present, so real stats appear automatically
 * once games are actually simulated.
 */

import { loadLeague, listSavesDetailed, touchLastPlayed } from './db.js';
import { applyTeamTheme } from './teamTheme.js';
import { crestHTML, marketOf } from './leagueConfig.js';
import { mountNav, activeLeagueId, renderNoCareer, markPlayed } from './shell.js';
import { initPlayerModal } from './playerModal.js';
import { ovr, byOvr, initials } from './playerRatings.js';

/* ------------------------------ ratings (real) ------------------------------
   Computed from each player's stored attributes — arithmetic on real data,
   not fabrication. */
const ATTRS_OFF = ['layup', 'dunk', 'midRange', 'threePoint', 'postControl', 'passing', 'ballHandling'];
const ATTRS_DEF = ['perimeterDefense', 'interiorDefense', 'block', 'steal', 'defensiveIQ', 'defensiveRebound'];
const ATTRS_SHOOT = ['threePoint', 'midRange', 'freeThrow', 'shotIQ'];


/** Minutes-weighted rating of the top 8 — the team's real on-paper strength. */
function teamRating(players) {
  const t = byOvr(players).slice(0, 8).map(ovr);
  const w = [1, .95, .9, .85, .8, .55, .45, .35];
  let s = 0, wt = 0;
  t.forEach((v, i) => { s += v * (w[i] || .2); wt += (w[i] || .2); });
  return wt ? Math.round(s / wt) : 0;
}
function avgAttrs(players, list) {
  const top = byOvr(players).slice(0, 8);
  let s = 0, c = 0;
  for (const p of top) for (const k of list) {
    const v = (p.attributes || {})[k];
    if (typeof v === 'number') { s += v; c++; }
  }
  return c ? Math.round(s / c) : 0;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtM = (n) => `$${Number(n).toFixed(2)}M`;

/** Paint a team crest into `node`, replacing the placeholder box styling. */
function setCrest(node, team, size) {
  if (!node) return;
  node.textContent = '';
  node.style.background = 'none';
  // Clear rather than 'none': an inline 'none' outranks the stylesheet, which
  // silently killed the team-coloured ring around the crest.
  node.style.boxShadow = '';
  node.style.padding = '0';
  node.innerHTML = crestHTML(team, size);
}
const ord = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const PHASE_LABEL = {
  regular_season: 'Regular Season', playoffs: 'Playoffs', offseason: 'Offseason',
  draft: 'Draft', free_agency: 'Free Agency',
};

/* --------------------------------- view model --------------------------------- */
function computeVM(league) {
  const meta = league.meta || {};
  const settings = league.settings || {};
  const teams = league.teams || [];
  const players = league.players || [];
  const rosterOf = (id) => players.filter((p) => p.teamId === id);

  const team = teams.find((t) => t.id === meta.userTeamId) || teams[0] || {};
  const roster = rosterOf(team.id);

  // Real ratings for every team, so the league ranks below are genuine.
  const rate = (t) => {
    const r = rosterOf(t.id);
    return { ovr: teamRating(r), off: avgAttrs(r, ATTRS_OFF), def: avgAttrs(r, ATTRS_DEF), shoot: avgAttrs(r, ATTRS_SHOOT) };
  };
  const mine = rate(team);
  const all = teams.map(rate);
  const rankOf = (key) => 1 + all.filter((r) => r[key] > mine[key]).length;

  // Strengths / weaknesses straight from attribute averages.
  const dims = [
    ['Rim Finishing', avgAttrs(roster, ['layup', 'dunk'])],
    ['Post Scoring', avgAttrs(roster, ['postControl'])],
    ['Perimeter Shooting', avgAttrs(roster, ['threePoint', 'midRange'])],
    ['Rebounding', avgAttrs(roster, ['offensiveRebound', 'defensiveRebound'])],
    ['Perimeter Defense', avgAttrs(roster, ['perimeterDefense', 'steal'])],
    ['Playmaking', avgAttrs(roster, ['passing', 'ballHandling', 'passingIQ'])],
    ['Rim Protection', avgAttrs(roster, ['block', 'interiorDefense'])],
    ['Athleticism', avgAttrs(roster, ['speed', 'vertical', 'agility'])],
    ['Basketball IQ', avgAttrs(roster, ['shotIQ', 'passingIQ', 'defensiveIQ'])],
    ['Free Throw Shooting', avgAttrs(roster, ['freeThrow'])],
  ].sort((a, b) => b[1] - a[1]);

  // Roster aggregates — all real.
  const ages = roster.map((p) => p.age).filter((n) => typeof n === 'number');
  const posCounts = {};
  for (const p of roster) posCounts[p.position] = (posCounts[p.position] || 0) + 1;

  // Finances: only what the save actually holds.
  const payroll = roster.reduce((s, p) => s + ((p.contract && p.contract.salary) || 0), 0);
  const cap = typeof settings.salaryCap === 'number' ? settings.salaryCap : null;

  // Has any game actually been played? Only then do records/stats exist.
  const played = Boolean(meta.lastSimulatedSeason) ||
    roster.some((p) => Array.isArray(p.statsHistory) && p.statsHistory.length > 0);

  return {
    meta, team, roster, played,
    seasonLabel: `${meta.currentSeason || ''} Season`,
    phaseLabel: PHASE_LABEL[meta.currentPhase] || 'Preseason',
    ratings: mine,
    ranks: { ovr: rankOf('ovr'), off: rankOf('off'), def: rankOf('def'), shoot: rankOf('shoot') },
    teamCount: teams.length,
    strengths: dims.slice(0, 3).map((d) => d[0]),
    weaknesses: dims.slice(-3).reverse().map((d) => d[0]),
    rosterSize: roster.length,
    avgAge: ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : '—',
    avgOvr: roster.length ? Math.round(roster.reduce((s, p) => s + ovr(p), 0) / roster.length) : '—',
    posCounts,
    maxRoster: settings.maxRosterSize || null,
    payroll, cap,
    capSpace: cap != null ? cap - payroll : null,
    topPlayers: byOvr(roster).slice(0, 5),
  };
}

/* --------------------------------- render --------------------------------- */
function render(vm) {
  const el = (id) => document.getElementById(id);
  const t = vm.team;

  // Re-tint the shell for this club. Contrast correction happens inside, so a
  // near-black or neon palette still produces accents that read.
  applyTeamTheme(t);

  // Top bar — league, season, phase. No invented calendar date or GM persona.
  el('ctxLeague').textContent = vm.meta.leagueName || 'League';
  el('ctxSeason').textContent = vm.seasonLabel;
  el('ctxPhase').textContent = vm.phaseLabel;
  el('teamChipName').textContent = `${t.city || ''} ${t.name || ''}`.trim();
  // Crests use the team's own palette (primary/secondary/tertiary) and any
  // uploaded primary logo — the same renderer the setup screens use, so what
  // you picked in Edit Team is what you see here.
  setCrest(el('teamChipLogo'), t, 30);

  // Identity
  setCrest(el('teamLogo'), t, 70);
  el('teamCity').textContent = t.city || '';
  el('teamName').textContent = t.name || 'Team';
  el('teamSub').textContent = `${vm.phaseLabel} · ${vm.meta.currentSeason || ''}`;

  // Header facts — stored on the team record, so these are real.
  const facts = [
    ['Market Size', marketOf(t) || '—'],
    ['Population', typeof t.population === 'number' ? `${t.population}M` : '—'],
    ['Fan Interest', t.fanInterest || '—'],
    ['Team Budget', typeof t.budget === 'number' ? fmtM(t.budget) : '—'],
  ];
  el('facts').innerHTML = facts.map(([k, v]) =>
    `<div class="fact"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('');

  // Team overview — every number computed from real attributes.
  el('ovOVR').textContent = vm.ratings.ovr;
  const stat = (id, v, r) => { el(id + 'V').textContent = v; el(id + 'R').textContent = `${ord(r)} of ${vm.teamCount}`; };
  stat('ovOff', vm.ratings.off, vm.ranks.off);
  stat('ovDef', vm.ratings.def, vm.ranks.def);
  stat('ovShoot', vm.ratings.shoot, vm.ranks.shoot);
  el('strengths').innerHTML = vm.strengths.map((s) => `<li>${esc(s)}</li>`).join('');
  el('weaknesses').innerHTML = vm.weaknesses.map((s) => `<li>${esc(s)}</li>`).join('');

  // Roster summary
  el('rosterCount').textContent = vm.rosterSize + (vm.maxRoster ? ` / ${vm.maxRoster}` : '');
  el('rosterAge').textContent = vm.avgAge;
  el('rosterOvr').textContent = vm.avgOvr;
  el('rosterPos').innerHTML = ['PG', 'SG', 'SF', 'PF', 'C']
    .map((p) => `<span><b>${vm.posCounts[p] || 0}</b> ${p}</span>`).join('');

  // Finances — payroll summed from real contracts; cap from settings.
  el('finPayroll').textContent = fmtM(vm.payroll);
  el('finCap').textContent = vm.cap != null ? fmtM(vm.cap) : '—';
  if (vm.capSpace != null) {
    el('finSpace').textContent = fmtM(Math.abs(vm.capSpace));
    el('finSpace').classList.toggle('neg', vm.capSpace < 0);
    el('finSpaceLabel').textContent = vm.capSpace < 0 ? 'Over the cap' : 'Cap space';
  } else {
    el('finSpace').textContent = '—';
  }

  // Top players — real identity + real contract facts. No per-game stats until
  // games are actually played; then statsHistory supplies them.
  el('players').innerHTML = vm.topPlayers.map((p) => {
    const line = vm.played && Array.isArray(p.statsHistory) && p.statsHistory.length
      ? (() => { const s = p.statsHistory[p.statsHistory.length - 1];
          return `${s.ppg} PPG<br>${s.rpg} RPG<br>${s.apg} APG`; })()
      : `Age ${p.age}<br>${p.potential} POT<br>${p.contract ? fmtM(p.contract.salary) : '—'}`;
    return `<div class="pl">
      <div class="av"><div class="face">${esc(initials(p.name))}</div><div class="ovr">${ovr(p)}</div></div>
      <div class="pos">${esc(p.position)}</div>
      <div class="pn" data-player="${esc(p.id)}" role="button" tabindex="0">${esc(p.name)}</div>
      <div class="line">${line}</div>
    </div>`;
  }).join('');

  // Honest status line instead of fabricated standings / schedule / news.
  el('note').textContent = vm.played
    ? 'Season data is available from the simulated seasons on record.'
    : 'No games have been played yet. Standings, records, player stats, schedule and finances beyond payroll will appear here once a season is simulated.';
}

/* --------------------------------- boot --------------------------------- */
async function boot() {
  let league = null;
  let id = null;
  try {
    id = await activeLeagueId(listSavesDetailed);
    if (id) league = await loadLeague(id);
  } catch (err) { console.error('Failed to load league:', err); }

  mountNav('dashboard', id);
  if (!league) { renderNoCareer(); return; }
  markPlayed(touchLastPlayed, id);
  initPlayerModal(league);
  render(computeVM(league));
}

boot();
