'use strict';

/**
 * dashboard.js — GM Dashboard.
 *
 * Loads the active saved league (db.js) and renders the dashboard. Our league
 * model stores rosters + team identity but does NOT yet track games, morale,
 * finances, etc. — those are DERIVED here, deterministically seeded from
 * league.meta.rngSeed, so every value is stable per save and will be swapped
 * for real sim output once the season engine is wired into the browser.
 *
 * Which save? ?id=<id> in the URL, else localStorage.activeLeagueId, else the
 * most-recently-played save.
 */

import { loadLeague, listSavesDetailed } from './db.js';

/* ------------------------------ seeded rng ------------------------------ */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function rngFrom(seed, label) {
  let h = 2166136261 >>> 0;
  const s = String(label);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  const r = mulberry32((seed >>> 0) ^ (h >>> 0));
  return { next: r, int: (a, b) => a + Math.floor(r() * (b - a + 1)), gauss: (m, sd) => {
    let u = 0, v = 0; while (!u) u = r(); while (!v) v = r();
    return m + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd; } };
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ------------------------------ ratings ------------------------------ */
const ATTRS_OFF = ['insideScoring', 'midRange', 'threePoint', 'passing', 'ballHandling'];
const ATTRS_DEF = ['perimeterDefense', 'interiorDefense', 'block', 'steal', 'defensiveRebound'];
const ATTRS_SHOOT = ['threePoint', 'midRange', 'freeThrow'];

function ovr(p) {
  if (typeof p.overall === 'number') return p.overall;
  const a = p.attributes || {};
  const keys = Object.keys(a);
  return keys.length ? Math.round(keys.reduce((s, k) => s + a[k], 0) / keys.length) : 60;
}
function topN(players, n) { return [...players].sort((a, b) => ovr(b) - ovr(a)).slice(0, n); }
function teamOverall(players) {
  const t = topN(players, 8).map(ovr);
  const w = [1, .95, .9, .85, .8, .55, .45, .35];
  let s = 0, wt = 0; t.forEach((v, i) => { s += v * (w[i] || .2); wt += (w[i] || .2); });
  return wt ? Math.round(s / wt) : 55;
}
function avgAttrs(players, list) {
  const top = topN(players, 8);
  let s = 0, c = 0;
  for (const p of top) for (const k of list) { const v = (p.attributes || {})[k]; if (typeof v === 'number') { s += v; c++; } }
  return c ? Math.round(s / c) : 60;
}
function estStats(p) {
  const o = ovr(p), a = p.attributes || {};
  const usage = Math.max(0.05, (o - 45) / 55);
  return {
    ppg: +(6 + usage * 20).toFixed(1),
    rpg: +(2 + ((a.defensiveRebound || 50) + (a.offensiveRebound || 50)) / 40).toFixed(1),
    apg: +(1 + ((a.passing || 50) + (a.ballHandling || 50)) / 60).toFixed(1),
  };
}

/* ------------------------------ helpers ------------------------------ */
const DIVISIONS = ['Atlantic', 'Central', 'Southeast', 'Northwest', 'Pacific', 'Southwest'];
const GM_FIRST = ['Khalil', 'Marcus', 'Dwayne', 'Elias', 'Andre', 'Victor', 'Julian', 'Malik', 'Terrence', 'Damon'];
const GM_LAST = ['Carter', 'Whitfield', 'Booker', 'Ellison', 'Navarro', 'Hastings', 'Okafor', 'Reyes', 'Sloan', 'Vega'];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = (name) => String(name || '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const fmtM = (n) => `$${n.toFixed(2)}M`;

function ringSVG(pct, color, r = 42, sw = 7) {
  const C = 2 * Math.PI * r;
  const off = C * (1 - clamp(pct, 0, 100) / 100);
  return `<svg viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="${sw}"/>
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"
      stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
  </svg>`;
}
function moraleWord(v) { return v >= 88 ? ['Thrilled', 'Players love the direction of the club.']
  : v >= 78 ? ['Confident', 'Players are happy with team direction.']
  : v >= 64 ? ['Content', 'The locker room is steady.']
  : v >= 50 ? ['Uneasy', 'Some players want to see changes.']
  : ['Unhappy', 'The locker room is fracturing.']; }
function fanWord(v) { return v >= 88 ? ['Excited', 'Fans are thrilled with your leadership.']
  : v >= 76 ? ['Engaged', 'Fans are enjoying the ride.']
  : v >= 62 ? ['Interested', 'Fans are cautiously optimistic.']
  : v >= 48 ? ['Restless', 'Fans want more from this team.']
  : ['Frustrated', 'The fanbase is losing patience.']; }
function ownerWord(v) { return v >= 88 ? ['Very Happy', "Owner believes you're building a contender."]
  : v >= 76 ? ['Happy', 'Owner is pleased with your progress.']
  : v >= 62 ? ['Satisfied', 'Owner expects steady improvement.']
  : v >= 48 ? ['Concerned', 'Owner wants to see results soon.']
  : ['Unhappy', 'Owner is questioning the plan.']; }

/* ------------------------------ VM ------------------------------ */
function computeVM(league) {
  const meta = league.meta || {};
  const seed = meta.rngSeed || 12345;
  const season = meta.currentSeason || 2026;
  const teams = league.teams || [];
  const players = league.players || [];
  const byTeam = (id) => players.filter((p) => p.teamId === id);

  const userTeam = teams.find((t) => t.id === meta.userTeamId) || teams[0] || {};
  const userPlayers = byTeam(userTeam.id);

  // Per-team strength + a projected season record (deterministic).
  const strengths = {};
  teams.forEach((t) => { strengths[t.id] = teamOverall(byTeam(t.id)); });
  const leagueAvg = teams.reduce((s, t) => s + strengths[t.id], 0) / (teams.length || 1);
  const rng = rngFrom(seed, 'records');
  const records = {};
  teams.forEach((t) => {
    const diff = strengths[t.id] - leagueAvg;
    const p = 1 / (1 + Math.pow(10, -diff / 12));
    const w = clamp(Math.round(p * 82 + rng.gauss(0, 3)), 15, 67);
    records[t.id] = { w, l: 82 - w };
  });

  // Divisions: fixed chunks of the team list; show the user's division.
  const divIndexById = {};
  teams.forEach((t, i) => { divIndexById[t.id] = Math.floor(i / 5) % DIVISIONS.length; });
  const userDiv = divIndexById[userTeam.id] || 0;
  const divTeams = teams.filter((t) => divIndexById[t.id] === userDiv)
    .sort((a, b) => records[b.id].w - records[a.id].w || strengths[b.id] - strengths[a.id]);
  const divLeader = divTeams[0];
  const gb = (t) => {
    const g = ((records[divLeader.id].w - records[divLeader.id].l) - (records[t.id].w - records[t.id].l)) / 2;
    return g <= 0 ? '-' : g.toFixed(1);
  };
  const userDivRank = divTeams.findIndex((t) => t.id === userTeam.id) + 1;

  // Team ratings + league ranks.
  const rate = (t) => ({
    off: avgAttrs(byTeam(t.id), ATTRS_OFF),
    def: avgAttrs(byTeam(t.id), ATTRS_DEF),
    shoot: avgAttrs(byTeam(t.id), ATTRS_SHOOT),
    ovr: strengths[t.id],
  });
  const myR = rate(userTeam);
  const rankOf = (key, val) => 1 + teams.filter((t) => rate(t)[key] > val).length;
  const chem = clamp(Math.round(78 + rngFrom(seed, 'chem').gauss(0, 6)), 62, 95);
  const chemWord = chem >= 88 ? 'Excellent' : chem >= 76 ? 'Good' : chem >= 64 ? 'Average' : 'Poor';

  // Satisfaction gauges.
  const rec = records[userTeam.id];
  const winPct = rec.w / 82;
  const marketBonus = userTeam.marketSize === 'Large' ? 6 : userTeam.marketSize === 'Medium' ? 2 : -2;
  const fanBase = userTeam.fanInterest === 'High' ? 8 : userTeam.fanInterest === 'Medium' ? 2 : -4;
  const gRng = rngFrom(seed, 'gauges');
  const morale = clamp(Math.round(58 + (myR.ovr - 70) * 1.4 + winPct * 24 + gRng.gauss(0, 3)), 40, 99);
  const fan = clamp(Math.round(56 + winPct * 30 + fanBase + gRng.gauss(0, 3)), 40, 99);
  const owner = clamp(Math.round(54 + winPct * 34 + marketBonus + gRng.gauss(0, 3)), 40, 99);

  // Strengths / weaknesses from the rating spread.
  const dims = [
    ['Interior Scoring', avgAttrs(userPlayers, ['insideScoring'])],
    ['Perimeter Shooting', avgAttrs(userPlayers, ['threePoint'])],
    ['Rebounding', avgAttrs(userPlayers, ['offensiveRebound', 'defensiveRebound'])],
    ['Perimeter Defense', avgAttrs(userPlayers, ['perimeterDefense'])],
    ['Playmaking', avgAttrs(userPlayers, ['passing', 'ballHandling'])],
    ['Rim Protection', avgAttrs(userPlayers, ['block', 'interiorDefense'])],
    ['Free Throw Shooting', avgAttrs(userPlayers, ['freeThrow'])],
  ].sort((a, b) => b[1] - a[1]);
  const strengthsList = dims.slice(0, 3).map((d) => d[0]);
  const weaknessList = dims.slice(-3).reverse().map((d) => d[0]);

  // Owner goals (derived completion).
  const hasStar = userPlayers.some((p) => ovr(p) >= 86);
  const goals = [
    ['🏆', 'Win a Championship', userDivRank === 1 && myR.ovr >= 85],
    ['🥈', 'Reach Conference Finals', rec.w >= 48],
    ['⭐', 'Develop a Superstar', hasStar],
    ['📈', `Top 5 in Fan Interest`, userTeam.marketSize !== 'Small' && userTeam.fanInterest !== 'Low'],
  ];

  // Next game — a divisional opponent.
  const opp = divTeams.find((t) => t.id !== userTeam.id) || teams.find((t) => t.id !== userTeam.id) || {};
  const phaseTag = { playoffs: 'Conference Semifinals · Game 1', finals: 'Finals · Game 1',
    offseason: 'Preseason · Game 1', draft: 'Preseason · Game 1', free_agency: 'Preseason · Game 1' }[meta.currentPhase]
    || 'Regular Season · Opening Night';

  // Top players.
  const top5 = topN(userPlayers, 5).map((p) => ({ name: p.name, pos: p.position, ovr: ovr(p), ...estStats(p) }));

  // Finances.
  const fRng = rngFrom(seed, 'finance');
  const payroll = userPlayers.reduce((s, p) => s + ((p.contract && p.contract.salary) || 0), 0);
  const budget = userTeam.budget || 120;
  const arenaRevenue = clamp(Math.round((55 + marketBonus * 2 + fanBase * 1.5 + winPct * 20 + fRng.gauss(0, 4)) * 100) / 100, 40, 120);
  const profit = Math.round((arenaRevenue * 0.28 + fRng.gauss(0, 3)) * 100) / 100;
  const cash = Math.round((18 + fRng.gauss(0, 8) + winPct * 12) * 100) / 100;

  // GM identity (seeded).
  const nRng = rngFrom(seed, 'gm');
  const gmName = `${GM_FIRST[nRng.int(0, GM_FIRST.length - 1)]} ${GM_LAST[nRng.int(0, GM_LAST.length - 1)]}`;

  return {
    league, meta, season, userTeam, userPlayers,
    record: rec, divName: DIVISIONS[userDiv], userDivRank,
    divTeams: divTeams.map((t) => ({ id: t.id, city: t.city, name: t.name, emoji: t.emoji, color: t.color,
      w: records[t.id].w, l: records[t.id].l, gb: gb(t), me: t.id === userTeam.id })),
    ratings: myR, ranks: { off: rankOf('off', myR.off), def: rankOf('def', myR.def), shoot: rankOf('shoot', myR.shoot) },
    chem, chemWord, morale, fan, owner, strengthsList, weaknessList, goals,
    opp: { city: opp.city, name: opp.name, emoji: opp.emoji, color: opp.color, w: records[opp.id] ? records[opp.id].w : 0, l: records[opp.id] ? records[opp.id].l : 0 },
    phaseTag, top5,
    fin: { budget, payroll, profit, cash, arenaRevenue },
    gmName,
  };
}

/* ------------------------------ render ------------------------------ */
const ord = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

function render(vm) {
  const t = vm.userTeam;
  const gaugeColor = (v) => v >= 76 ? 'var(--green)' : v >= 55 ? 'var(--orange)' : 'var(--red-hi)';
  const el = (id) => document.getElementById(id);

  // Topbar
  el('ctxLeague').textContent = vm.meta.leagueName || 'League';
  el('ctxSeason').textContent = `${vm.season} Season`;
  el('ctxDate').textContent = `Oct 21, ${vm.season}`;
  el('gmName').textContent = `GM ${vm.gmName}`;
  el('gmTeam').textContent = `${t.city} ${t.name}`;
  el('gmAvatar').textContent = t.emoji || '🏀';
  el('gmAvatar').style.background = `linear-gradient(160deg, ${t.color || '#1b3c60'}, #0a1a2e)`;

  // Identity
  el('teamLogo').textContent = t.emoji || '🏀';
  el('teamLogo').style.background = t.color || '#33506e';
  el('teamCity').textContent = t.city || '';
  el('teamName').textContent = t.name || 'Team';
  el('teamRec').textContent = `${vm.record.w}-${vm.record.l}`;
  el('teamSub').textContent = `${ord(vm.userDivRank)} in ${vm.divName} Division`;

  // Gauges
  const gauge = (id, val, word, desc) => {
    const c = gaugeColor(val);
    el(id).innerHTML = `<div class="ring">${ringSVG(val, c)}<div class="val">${val}</div></div>
      <div class="status" style="color:${c}">${word}</div><div class="desc">${desc}</div>`;
  };
  const [mw, md] = moraleWord(vm.morale); const [fw, fd] = fanWord(vm.fan); const [ow, od] = ownerWord(vm.owner);
  gauge('gMorale', vm.morale, mw, md); gauge('gFan', vm.fan, fw, fd); gauge('gOwner', vm.owner, ow, od);

  // Owner goals
  el('goals').innerHTML = vm.goals.map(([ic, label, done]) => `
    <div class="goal"><span class="gi">${ic}</span><span>${esc(label)}</span>
      <span class="mark ${done ? 'done' : 'pending'}">${done
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M4 12l5 5L20 6"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>'}</span>
    </div>`).join('');

  // Next game
  const o = vm.opp;
  el('nextTag').textContent = vm.phaseTag;
  el('ngHomeLogo').textContent = t.emoji || '🏀'; el('ngHomeLogo').style.background = t.color || '#33506e';
  el('ngHomeCity').textContent = t.city; el('ngHomeName').textContent = t.name; el('ngHomeRec').textContent = `${vm.record.w}-${vm.record.l}`;
  el('ngAwayLogo').textContent = o.emoji || '🏀'; el('ngAwayLogo').style.background = o.color || '#33506e';
  el('ngAwayCity').textContent = o.city || ''; el('ngAwayName').textContent = o.name || 'TBD'; el('ngAwayRec').textContent = `${o.w}-${o.l}`;
  el('ngDate').textContent = `Oct 24, ${vm.season}`;
  el('ngArena').textContent = `${t.city} Arena`;

  // Team overview
  el('ovOVR').textContent = vm.ratings.ovr;
  const setStat = (id, v, r) => { el(id + 'V').textContent = v; el(id + 'R').textContent = r; };
  setStat('ovOff', vm.ratings.off, ord(vm.ranks.off)); setStat('ovDef', vm.ratings.def, ord(vm.ranks.def));
  setStat('ovShoot', vm.ratings.shoot, ord(vm.ranks.shoot));
  el('ovChemV').textContent = vm.chem; el('ovChemR').textContent = vm.chemWord;
  el('ovChemR').style.color = vm.chem >= 76 ? 'var(--green)' : 'var(--muted)';
  el('strengths').innerHTML = vm.strengthsList.map((s) => `<li>${esc(s)}</li>`).join('');
  el('weaknesses').innerHTML = vm.weaknessList.map((s) => `<li>${esc(s)}</li>`).join('');

  // Standings
  el('standDiv').textContent = `${vm.divName} Division`;
  el('standBody').innerHTML = vm.divTeams.map((tm, i) => `
    <tr class="${tm.me ? 'me' : ''}">
      <td class="tn"><div class="team-cell"><span class="rank">${i + 1}</span>
        <span class="mini" style="background:${tm.color || '#33506e'}">${tm.emoji || '🏀'}</span>
        <span>${esc(tm.city)} ${esc(tm.name)}</span></div></td>
      <td>${tm.w}</td><td>${tm.l}</td><td>${tm.gb}</td>
    </tr>`).join('');

  // Top players
  const ringColor = (o) => o >= 85 ? 'var(--gold)' : o >= 78 ? 'var(--green)' : o >= 70 ? 'var(--blue)' : 'var(--muted)';
  el('players').innerHTML = vm.top5.map((p) => `
    <div class="pl">
      <div class="av">${ringSVG(p.ovr, ringColor(p.ovr), 44, 6).replace('viewBox="0 0 100 100"', 'viewBox="0 0 100 100" class="ring"')}
        <div class="face">${initials(p.name)}</div><div class="ovr">${p.ovr}</div></div>
      <div class="pos">${p.pos}</div><div class="pn">${esc(p.name)}</div>
      <div class="line">${p.ppg} PPG<br>${p.rpg} RPG<br>${p.apg} APG</div>
    </div>`).join('');

  // Recent news (derived)
  const star = vm.top5[0] || { name: 'A star' };
  const news = [
    ['👑', `${t.name} projected ${ord(vm.userDivRank)} in the ${vm.divName}`, `Oct 18, ${vm.season}`],
    ['🏀', `${star.name} headlines the season preview`, `Oct 15, ${vm.season}`],
    ['📋', `${vm.meta.leagueName || 'League'} releases the ${vm.season} schedule`, `Oct 10, ${vm.season}`],
    ['➕', `Training camp opens for the ${t.name}`, `Oct 1, ${vm.season}`],
  ];
  el('news').innerHTML = news.map(([ic, txt, d]) => `
    <div class="item"><span class="ni">${ic}</span><div class="nb"><div class="nt">${esc(txt)}</div><div class="nd">${d}</div></div></div>`).join('');

  // Tasks (static-ish GM to-dos)
  const tasks = [
    ['Set the opening-night rotation', '3 days left', 'high'],
    ['Review staff contracts', '5 days left', 'medium'],
    ['Scout 2 SG prospects', '1 week left', 'high'],
    ['Upgrade training facility', '2 weeks left', 'low'],
    ['Analyze preseason report', '2 weeks left', 'medium'],
  ];
  el('tasks').innerHTML = tasks.map(([txt, left, pri]) => `
    <div class="t"><span class="box"></span><span class="tt">${esc(txt)}</span>
      <span class="left">${left}</span><span class="pri ${pri}">${pri.toUpperCase()}</span></div>`).join('');

  // Finances
  el('finBudget').textContent = fmtM(vm.fin.budget);
  el('finPayroll').textContent = `Payroll ${fmtM(vm.fin.payroll)}`;
  el('finProfit').textContent = (vm.fin.profit >= 0 ? '' : '-') + fmtM(Math.abs(vm.fin.profit));
  el('finProfit').classList.toggle('pos', vm.fin.profit >= 0);
  el('finCash').textContent = fmtM(vm.fin.cash);
  el('finArena').textContent = fmtM(vm.fin.arenaRevenue);

  // Upcoming events
  const events = [
    ['NBA Draft Lottery', `May 19, ${vm.season + 1}`],
    ['Free Agency Begins', `June 1, ${vm.season + 1}`],
    ['NBA Draft', `June 25, ${vm.season + 1}`],
    ['Summer League Begins', `July 5, ${vm.season + 1}`],
  ];
  el('events').innerHTML = events.map(([n, d]) => `
    <div class="ev"><span class="en">${esc(n)}</span><span class="ed">${d}</span></div>`).join('');

  // Sidebar badges
  el('taskBadge').textContent = tasks.length;
}

/* ------------------------------ boot ------------------------------ */
async function activeId() {
  const q = new URLSearchParams(location.search).get('id');
  if (q) return q;
  try { const s = localStorage.getItem('activeLeagueId'); if (s) return s; } catch (_) {}
  const list = await listSavesDetailed();
  return list.length ? list[0].id : null;
}

async function boot() {
  let league = null;
  try {
    const id = await activeId();
    if (id) league = await loadLeague(id);
  } catch (err) { console.error('Failed to load league:', err); }

  if (!league) {
    document.querySelector('.main').innerHTML =
      '<div style="padding:4rem 1rem;text-align:center;color:#8ea3ba">' +
      '<h1 style="font-family:var(--font-display);color:#fff;font-size:2rem;text-transform:uppercase">No active career</h1>' +
      '<p style="margin-top:.6rem">Start one from <a style="color:#e5393f" href="./new-career.html">New Career</a> ' +
      'or pick one from <a style="color:#e5393f" href="./load-career.html">Load Career</a>.</p></div>';
    return;
  }
  render(computeVM(league));

  // Sidebar nav: only Dashboard exists; the rest are placeholders for now.
  document.querySelector('.nav').addEventListener('click', (e) => {
    const a = e.target.closest('a'); if (!a) return;
    const to = a.dataset.to;
    if (to === 'title') { e.preventDefault(); location.href = './index.html'; return; }
    if (!a.classList.contains('active')) { e.preventDefault(); console.log('→ nav:', a.dataset.nav || a.textContent.trim()); }
  });
}

boot();
