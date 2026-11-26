#!/usr/bin/env node
/* ==========================================================================
   HOOPS DYNASTY — player generation validator (development only)

   Generates many sample leagues with the real dynasty generator and reports
   nationality, region, college and identity statistics, plus integrity and
   fairness checks. Exits non-zero if a target is missed.

   Usage: node tools/validate-generation.js [leagues=100]
   ========================================================================== */
'use strict';

const F = require('../data/franchises.js');
const D = require('../scripts/dynasty.js');
const N = require('../data/nationalities.js');
const I = require('../scripts/player-identity.js');

const LEAGUES = Number(process.argv[2]) || 100;
const problems = [];
const pct = (n, d) => (d ? (100 * n / d).toFixed(1) + '%' : '—');
const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);

let players = 0, us = 0, collegeUS = 0, collegeIntl = 0, intlTotal = 0, noCollege = 0;
let dupNames = 0, badCodes = 0, badBirth = 0, missing = 0, blocked = 0, inconsistentPath = 0, dual = 0, bornAbroad = 0;
const perLeagueIntl = [];
const byCountry = {}, byRegion = {}, byPathway = {}, byOrigin = {};
const ovr = { us: [], intl: [] }, pot = { us: [], intl: [] }, ht = { us: [], intl: [] };
const countriesSeen = new Set();
const multicultural = {};   // nationality -> set of naming backgrounds seen
const intlInCollege = {};    // nationality -> count at US colleges
const REQUIRED = ['firstName', 'lastName', 'nameOrder', 'nationality', 'birthCity', 'birthCountry', 'pathway', 'birthDate', 'weightLb', 'experience'];

const t0 = Date.now();
for (let i = 0; i < LEAGUES; i++) {
  const team = F.FRANCHISES[i % F.FRANCHISES.length];
  const d = D.createDynasty({ leagueName: 'Validation League', gmName: 'Validator', inauguralYear: '2027', franchiseId: team.id }, F);
  const v = D.validateDynasty(d);
  if (!v.valid) problems.push('League ' + i + ' failed validation: ' + v.errors.join('; '));

  const seen = new Set();
  let leagueIntl = 0;
  d.players.forEach((p) => {
    players++;
    REQUIRED.forEach((k) => { if (p[k] === undefined || p[k] === '') missing++; });
    if (p.college === undefined) missing++;
    const name = I.fold(I.fullName(p));
    if (seen.has(name)) dupNames++;
    seen.add(name);
    if (I.isBlocked(I.fullName(p)) || I.isBlocked(p.firstName + ' ' + p.lastName)) blocked++;
    if (!N.isValidCode(p.nationality) || (p.secondaryNationality && !N.isValidCode(p.secondaryNationality))) badCodes++;
    const cities = N.cityList(p.birthCountry).map((c) => c.city);
    if (!N.isValidCode(p.birthCountry) || cities.indexOf(p.birthCity) === -1) badBirth++;
    if (p.secondaryNationality) dual++;
    if (p.birthCountry !== p.nationality) bornAbroad++;
    // pathway consistency with college, age and experience
    const pw = p.pathway;
    if ((pw.type === 'ncaa') !== (typeof p.college === 'string') || p.age - p.experience !== pw.entryAge ||
      pw.entryAge < 19 || (pw.type === 'ncaa' && (pw.collegeYears < 1 || pw.collegeYears > 5))) inconsistentPath++;

    const c = N.country(p.nationality);
    byCountry[p.nationality] = (byCountry[p.nationality] || 0) + 1;
    byRegion[c.region] = (byRegion[c.region] || 0) + 1;
    byPathway[pw.type] = (byPathway[pw.type] || 0) + 1;
    byOrigin[p.nameOrigin] = (byOrigin[p.nameOrigin] || 0) + 1;
    (multicultural[p.nationality] = multicultural[p.nationality] || new Set()).add(p.nameOrigin);
    countriesSeen.add(p.nationality);
    if (!p.college) noCollege++;
    const key = p.nationality === 'US' ? 'us' : 'intl';
    ovr[key].push(p.overall); pot[key].push(p.potential); ht[key].push(p.heightIn);
    if (p.nationality === 'US') { us++; if (p.college) collegeUS++; }
    else {
      intlTotal++; leagueIntl++;
      if (p.college) { collegeIntl++; intlInCollege[p.nationality] = (intlInCollege[p.nationality] || 0) + 1; }
    }
  });
  perLeagueIntl.push(leagueIntl / d.players.length);
}

const minI = Math.min(...perLeagueIntl), maxI = Math.max(...perLeagueIntl);
const out = [];
out.push('HOOPS DYNASTY — generation validation (' + LEAGUES + ' leagues, ' + ((Date.now() - t0) / 1000).toFixed(1) + 's)');
out.push('');
out.push('Players                ' + players + ' (' + (players / LEAGUES) + ' per league)');
out.push('American               ' + pct(us, players));
out.push('International          ' + pct(intlTotal, players) + '   per league: min ' + (100 * minI).toFixed(1) + '%, max ' + (100 * maxI).toFixed(1) + '%, mean ' + (100 * mean(perLeagueIntl)).toFixed(1) + '%');
out.push('Intl players / league  ' + (intlTotal / LEAGUES).toFixed(1) + '  (target ~108–135)');
out.push('College attendance     all ' + pct(players - noCollege, players) + ' · American ' + pct(collegeUS, us) + ' · International ' + pct(collegeIntl, intlTotal));
out.push('No college             ' + noCollege + ' (' + pct(noCollege, players) + ')');
out.push('Dual nationality       ' + pct(dual, players) + ' · born outside primary country ' + pct(bornAbroad, players));
out.push('');
out.push('Regions:     ' + Object.keys(byRegion).sort((a, b) => byRegion[b] - byRegion[a]).map((r) => N.REGIONS[r] + ' ' + pct(byRegion[r], players)).join(' · '));
out.push('Pathways:    ' + Object.keys(byPathway).sort((a, b) => byPathway[b] - byPathway[a]).map((k) => k + ' ' + pct(byPathway[k], players)).join(' · '));
out.push('');
out.push('Countries (share of international players):');
Object.keys(byCountry).filter((k) => k !== 'US').sort((a, b) => byCountry[b] - byCountry[a]).forEach((k) => {
  out.push('  ' + k + ' ' + N.countryName(k).padEnd(24) + String(byCountry[k]).padStart(5) + '  ' + pct(byCountry[k], intlTotal).padStart(6) +
    '   names: ' + [...multicultural[k]].join(', '));
});
out.push('  Countries appearing: ' + countriesSeen.size + ' of ' + Object.keys(N.COUNTRIES).length);
out.push('');
out.push('American naming backgrounds: ' + [...multicultural.US].join(', '));
out.push('International players at U.S. colleges: ' + Object.keys(intlInCollege).sort((a, b) => intlInCollege[b] - intlInCollege[a]).slice(0, 10).map((k) => k + ' ' + intlInCollege[k]).join(', '));
out.push('');
out.push('Fairness (nationality must not affect talent or size)');
out.push('  Mean OVR      American ' + mean(ovr.us).toFixed(2) + ' · International ' + mean(ovr.intl).toFixed(2));
out.push('  Mean POT      American ' + mean(pot.us).toFixed(2) + ' · International ' + mean(pot.intl).toFixed(2));
out.push('  Mean height   American ' + mean(ht.us).toFixed(2) + 'in · International ' + mean(ht.intl).toFixed(2) + 'in');
out.push('  Stars (OVR≥90) international share ' + pct(ovr.intl.filter((x) => x >= 90).length, ovr.us.filter((x) => x >= 90).length + ovr.intl.filter((x) => x >= 90).length));
out.push('');
out.push('Integrity');
out.push('  Duplicate full names within a league   ' + dupNames);
out.push('  Real-player (blocked) names generated   ' + blocked);
out.push('  Invalid country codes                   ' + badCodes);
out.push('  Invalid birthplace combinations         ' + badBirth);
out.push('  Missing identity fields                 ' + missing);
out.push('  Pathway / college / age inconsistencies ' + inconsistentPath);

// Targets
if (minI < 0.235 || maxI > 0.305) problems.push('International share outside 24–30% (min ' + (100 * minI).toFixed(1) + '%, max ' + (100 * maxI).toFixed(1) + '%)');
if (dupNames) problems.push(dupNames + ' duplicate names');
if (blocked) problems.push(blocked + ' blocked names generated');
if (badCodes) problems.push(badCodes + ' invalid country codes');
if (badBirth) problems.push(badBirth + ' invalid birthplaces');
if (missing) problems.push(missing + ' missing identity fields');
if (inconsistentPath) problems.push(inconsistentPath + ' inconsistent pathways');
if (Math.abs(mean(ovr.us) - mean(ovr.intl)) > 1.5) problems.push('Overall ratings differ by nationality');
if (Math.abs(mean(ht.us) - mean(ht.intl)) > 0.6) problems.push('Heights differ by nationality');

out.push('');
out.push(problems.length ? 'PROBLEMS:\n  ' + problems.join('\n  ') : 'All targets met.');
console.log(out.join('\n'));
process.exit(problems.length ? 1 : 0);
