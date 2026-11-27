#!/usr/bin/env node
/* ==========================================================================
   Development-only: rating distribution report.
   Generates N full leagues (default 100) through the real dynasty pipeline
   and N draft classes, then reports the distributions and checks them
   against the targets in data/rating-config.js. Exits 1 on a failed check.

   Usage:  node tools/validate-ratings.js [leagues=100] [--json]
   ========================================================================== */
'use strict';

const D = require('../scripts/dynasty.js');
const F = require('../data/franchises.js');
const C = require('../data/rating-config.js');
const PR = require('../scripts/player-ratings.js');
const A = require('../scripts/player-attributes.js');

const N = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a))) || 100;
const JSON_OUT = process.argv.includes('--json');

const stats = (xs) => {
  const s = xs.slice().sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length);
  const med = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  return { mean, median: med, sd, min: s[0], max: s[s.length - 1] };
};
const pct = (n, d) => (100 * n / d).toFixed(1) + '%';
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

const players = [];
const teams = [];
const leagues = [];
const invalid = [];
for (let i = 0; i < N; i++) {
  const d = D.createDynasty({ leagueName: 'Sample League', gmName: 'Validator', inauguralYear: '2026', franchiseId: 'fr-001' }, F, new Date(Date.UTC(2026, 0, 1, 0, 0, i)));
  const v = D.validateDynasty(d);
  if (!v.valid) invalid.push('league ' + i + ': ' + v.errors[0]);
  const lg = { players: d.players, teams: d.teams };
  leagues.push(lg);
  d.players.forEach((p) => {
    players.push(p);
    const bad = [p.overall, p.potential].concat(Object.values(p.attributes)).some((x) => !Number.isInteger(x) || x < 0 || x > 100);
    if (bad) invalid.push(p.id + ' out-of-range rating');
    if (p.potential < p.overall) invalid.push(p.id + ' potential below overall');
    if (PR.overallFromAttributes(p.attributes, p.position) !== p.overall) invalid.push(p.id + ' overall contradicts attributes');
    if (p.overall >= 100) invalid.push(p.id + ' generated a 100 overall');
  });
  d.teams.forEach((t) => teams.push({ overall: t.overall, elite: d.players.filter((p) => p.teamId === t.id && p.overall >= 90).length, stars: d.players.filter((p) => p.teamId === t.id && p.overall >= 85).length, mkt: t.marketSize }));
}

const P = players.length;
const ovr = players.map((p) => p.overall);
const pot = players.map((p) => p.potential);
const so = stats(ovr);
const report = [];
const out = (s = '') => report.push(s);
const checks = [];
const check = (ok, label) => checks.push({ ok, label });

out(`HOOPS DYNASTY — rating distribution report: ${N} leagues, ${P} players (${(P / N).toFixed(0)} per league)`);
out('');
out(`Overall   mean ${so.mean.toFixed(2)} · median ${so.median} · SD ${so.sd.toFixed(2)} · range ${so.min}–${so.max}`);
out('');
out('Overall distribution (per 450 players: actual vs target)');
C.OVERALL_BANDS.forEach((b) => {
  const n = ovr.filter((x) => x >= b.min && x <= b.max).length;
  const per = n / P * 450;
  out(`  ${pad(b.min + '–' + b.max, 7)} ${pad(b.label, 26)} ${lpad(per.toFixed(1), 6)}  target ${lpad(b.count, 3)}`);
  const tol = Math.max(2, b.count * 0.18);
  check(Math.abs(per - b.count) <= tol, `overall ${b.min}–${b.max}: ${per.toFixed(1)} per 450 (target ${b.count} ±${tol.toFixed(1)})`);
});
check(so.mean >= 70 && so.mean <= 74, `league average overall ${so.mean.toFixed(2)} within 70–74`);
const n80 = ovr.filter((x) => x >= 80).length / N, n90 = ovr.filter((x) => x >= 90).length / N, n95 = ovr.filter((x) => x >= 95).length / N;
out('');
out(`Per league: 80+ ${n80.toFixed(1)} · 90+ ${n90.toFixed(1)} · 95+ ${n95.toFixed(2)} · 100: ${ovr.filter((x) => x >= 100).length}`);
check(n90 >= 8 && n90 <= 16 && n95 <= 5, `90+ rare (${n90.toFixed(1)}/league), 95+ exceptionally rare (${n95.toFixed(2)}/league)`);

out('');
out('Potential distribution (share: actual vs target)');
C.POTENTIAL_TARGETS.forEach((b) => {
  const n = pot.filter((x) => x >= b.min && x <= b.max).length / P;
  out(`  ${pad(b.min + '–' + b.max, 7)} ${lpad((100 * n).toFixed(1), 5)}%  target ${(100 * b.share).toFixed(0)}%`);
  check(Math.abs(n - b.share) <= Math.max(0.01, b.share * 0.25), `potential ${b.min}–${b.max}: ${(100 * n).toFixed(1)}% (target ${(100 * b.share).toFixed(0)}%)`);
});
const young = players.filter((p) => p.age <= 21);
out(`  under-22s: mean POT−OVR ${stats(young.map((p) => p.potential - p.overall)).mean.toFixed(1)}; ${pct(young.filter((p) => p.potential - p.overall < 6).length, young.length)} have a low ceiling (< +6)`);
check(young.filter((p) => p.potential - p.overall < 6).length / young.length > 0.08, 'not every young player has high potential');
const old = players.filter((p) => p.age >= 32);
check(old.every((p) => p.potential === p.overall), 'veterans 32+: potential equals current ability (no projected growth)');

out('');
out('Average overall by age');
const byAge = {};
players.forEach((p) => { (byAge[p.age] = byAge[p.age] || []).push(p.overall); });
Object.keys(byAge).map(Number).sort((a, b) => a - b).forEach((a) => out(`  ${lpad(a, 2)}  ${lpad(stats(byAge[a]).mean.toFixed(1), 5)}  (${byAge[a].length})`));
const ageStats = stats(players.map((p) => p.age));
out(`  age mean ${ageStats.mean.toFixed(1)} · range ${ageStats.min}–${ageStats.max}`);
const prime = players.filter((p) => p.age >= 25 && p.age <= 31), kids = players.filter((p) => p.age <= 21);
check(stats(prime.map((p) => p.overall)).mean > stats(kids.map((p) => p.overall)).mean + 3, 'prime-age players outrate raw prospects on average');
check(players.some((p) => p.age <= 23 && p.overall >= 85), 'exceptional young stars exist');
check(players.some((p) => p.age >= 33 && p.overall >= 80), 'productive older veterans exist');

out('');
out('Average overall by position');
['PG', 'SG', 'SF', 'PF', 'C'].forEach((pos) => out(`  ${pad(pos, 3)} ${stats(players.filter((p) => p.position === pos).map((p) => p.overall)).mean.toFixed(1)}`));

out('');
out('Archetypes (count · average overall)');
const byArch = {};
players.forEach((p) => { (byArch[p.archetype] = byArch[p.archetype] || []).push(p.overall); });
C.ARCHETYPES.forEach((a) => { const xs = byArch[a.id] || []; out(`  ${pad(a.label, 24)} ${lpad(xs.length, 6)} · ${xs.length ? stats(xs).mean.toFixed(1) : '—'}`); });
check(C.ARCHETYPES.every((a) => (byArch[a.id] || []).length > 0), 'every archetype appears');
out(`  hybrids: ${pct(players.filter((p) => p.archetypeSecondary).length, P)}`);

out('');
out('Attributes (mean · SD · min–max · share 90+ · share < 50)');
A.ATTRIBUTES.forEach((a) => {
  const xs = players.map((p) => p.attributes[a.key]); const s = stats(xs);
  out(`  ${pad(a.label, 22)} ${lpad(s.mean.toFixed(1), 5)} · ${lpad(s.sd.toFixed(1), 4)} · ${lpad(s.min, 2)}–${s.max} · ${lpad(pct(xs.filter((x) => x >= 90).length, P), 6)} · ${lpad(pct(xs.filter((x) => x < 50).length, P), 6)}`);
});

out('');
out('Strengths and weaknesses');
const spread = players.map((p) => { const v = Object.entries(p.attributes).filter(([k]) => k !== 'durability' && k !== 'stamina').map(([, x]) => x); return Math.max(...v) - Math.min(...v); });
const withBoth = players.filter((p) => { const v = Object.entries(p.attributes).filter(([k]) => k !== 'durability' && k !== 'stamina').map(([, x]) => x); return v.some((x) => x >= p.overall + 8) && v.some((x) => x <= p.overall - 15); }).length;
out(`  attribute spread (best − worst skill): mean ${stats(spread).mean.toFixed(1)}, min ${stats(spread).min}`);
out(`  players with a clear strength (≥ OVR+8) AND weakness (≤ OVR−15): ${pct(withBoth, P)}`);
check(withBoth / P > 0.8, 'most players have recognizable strengths and weaknesses');
const specialists = players.filter((p) => p.overall < 80 && Object.values(p.attributes).some((x) => x >= 90));
out(`  sub-80 players with an elite (90+) skill: ${pct(specialists.length, P)}`);
check(specialists.length / P > 0.05, 'lower-rated specialists with elite skills exist');
const stars = players.filter((p) => p.overall >= 90);
const starWeak = stars.filter((p) => Object.entries(p.attributes).some(([k, x]) => k !== 'durability' && k !== 'stamina' && x < 75)).length;
out(`  90+ players with at least one skill under 75: ${pct(starWeak, stars.length)}`);
check(starWeak / stars.length > 0.6, 'superstars still have weaknesses');
const crossC = players.filter((p) => p.position === 'C' && (p.attributes.threePoint >= 80 || p.attributes.pass >= 80)).length;
const crossG = players.filter((p) => (p.position === 'PG' || p.position === 'SG') && (p.attributes.defensiveRebounding >= 80 || p.attributes.interiorDefense >= 80)).length;
out(`  centers shooting or passing 80+: ${crossC / N} per league · guards rebounding or interior-defending 80+: ${crossG / N} per league`);
check(crossC > 0 && crossG > 0, 'non-stereotypical skills occur');

out('');
out('Teams');
const to = stats(teams.map((t) => t.overall));
out(`  team overall mean ${to.mean.toFixed(1)} · SD ${to.sd.toFixed(1)} · lowest ${to.min} · highest ${to.max}`);
const perLeague = leagues.map((l) => { const o = l.teams.map((t) => t.overall); return Math.max(...o) - Math.min(...o); });
out(`  best − worst team per league: mean ${stats(perLeague).mean.toFixed(1)}`);
const eliteDist = {}; teams.forEach((t) => { eliteDist[t.elite] = (eliteDist[t.elite] || 0) + 1; });
out(`  90+ players per team: ${Object.keys(eliteDist).sort().map((k) => k + ': ' + pct(eliteDist[k], teams.length)).join(' · ')}`);
const noStar = teams.filter((t) => t.stars === 0).length;
out(`  teams without an 85+ player: ${pct(noStar, teams.length)}`);
check(noStar > 0 && eliteDist[0] / teams.length > 0.4, 'not every franchise has a star');
check(Object.keys(eliteDist).some((k) => Number(k) >= 2), 'some teams have multiple superstars');
const mk = {}; teams.forEach((t) => { (mk[t.mkt] = mk[t.mkt] || []).push(t.overall); });
out(`  by market size: ${Object.keys(mk).map((k) => k + ' ' + stats(mk[k]).mean.toFixed(1)).join(' · ')}`);
const mks = Object.values(mk).map((xs) => stats(xs).mean);
check(Math.max(...mks) - Math.min(...mks) < 3, 'market size does not decide talent');
const catalogCorr = (() => { const xs = [], ys = []; leagues.forEach((l) => l.teams.forEach((t) => { xs.push(F.byId(t.franchiseId).overall); ys.push(t.overall); })); const mx = stats(xs).mean, my = stats(ys).mean; let n = 0, a = 0, b = 0; xs.forEach((x, i) => { n += (x - mx) * (ys[i] - my); a += (x - mx) ** 2; b += (ys[i] - my) ** 2; }); return n / Math.sqrt(a * b); })();
out(`  correlation with franchise strength: r = ${catalogCorr.toFixed(2)} (outlook guides talent, but not exactly)`);

out('');
out('Draft classes (' + N + ' classes of ' + C.DRAFT.SIZE + ')');
const classes = [];
for (let i = 0; i < N; i++) classes.push(PR.generateDraftClass('validate-' + i));
const rookies = classes.flat();
const ro = stats(rookies.map((p) => p.overall)), rp = stats(rookies.map((p) => p.potential));
out(`  rookie overall mean ${ro.mean.toFixed(1)} · SD ${ro.sd.toFixed(1)} · range ${ro.min}–${ro.max} · potential mean ${rp.mean.toFixed(1)}`);
const classMeans = classes.map((c) => stats(c.map((p) => p.overall)).mean);
out(`  class strength varies: weakest ${stats(classMeans).min.toFixed(1)} · strongest ${stats(classMeans).max.toFixed(1)}`);
const ready = classes.map((c) => c.filter((p) => p.overall >= 72).length);
const gens = classes.map((c) => c.filter((p) => p.potential >= 95).length);
out(`  NBA-ready (72+) per class: mean ${stats(ready).mean.toFixed(2)}, classes with none ${pct(ready.filter((x) => !x).length, N)}`);
out(`  95+ ceilings per class: mean ${stats(gens).mean.toFixed(2)}, classes with none ${pct(gens.filter((x) => !x).length, N)}`);
check(ro.mean < so.mean - 10, 'rookies enter well below established pros');
check(gens.filter((x) => !x).length / N >= 0.4 && stats(gens).mean <= 1, 'generational prospects are rare: ' + stats(gens).mean.toFixed(2) + ' per class, ' + pct(gens.filter((x) => !x).length, N) + ' of classes have none');
check(rookies.every((p) => PR.overallFromAttributes(p.attributes, p.position) === p.overall), 'draft prospects: overall computed from attributes');

out('');
out('Long-term balance');
out('  Player progression, regression and retirement are not implemented yet, so a');
out('  multi-decade simulation is not run here (by design). Draft-class output above');
out('  and the potential distribution are the inputs a future development system');
out('  will balance against the same targets in data/rating-config.js.');

out('');
out('Invalid or out-of-range ratings: ' + (invalid.length ? invalid.length + '\n  ' + invalid.slice(0, 10).join('\n  ') : 'none'));
check(invalid.length === 0, 'no invalid, out-of-range or contradicting ratings');

out('');
out('Checks');
checks.forEach((c) => out(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.label}`));
const failed = checks.filter((c) => !c.ok).length;
out('');
out(failed ? failed + ' check(s) FAILED' : 'All checks passed.');

if (JSON_OUT) console.log(JSON.stringify({ leagues: N, players: P, overall: so, checks }, null, 2));
else console.log(report.join('\n'));
process.exit(failed ? 1 : 0);
