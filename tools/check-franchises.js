#!/usr/bin/env node
/* Verifies data/franchises.js: 30 unique teams, 15 per conference, valid
   fields, and a generated logo for every team. Exits non-zero on problems.
   Usage: node tools/check-franchises.js */
'use strict';

const fs = require('fs');
const path = require('path');
const F = require('../data/franchises.js');

const problems = F.validate();
if (F.FRANCHISES.length !== 30) problems.push(`Expected 30 franchises, found ${F.FRANCHISES.length}`);
problems.push(...F.validate(F.FRANCHISES.concat(F.EXPANSION), { balanced: false }));
if (!fs.existsSync(path.join(__dirname, '..', 'assets/logos/custom.svg'))) problems.push('missing assets/logos/custom.svg');
for (const t of F.FRANCHISES.concat(F.EXPANSION)) {
  if (!fs.existsSync(path.join(__dirname, '..', t.logo.src))) {
    problems.push(`${t.id}: missing logo ${t.logo.src} (run node tools/build-logos.js)`);
  }
}

if (problems.length) {
  console.error('Franchise data problems:\n  ' + problems.join('\n  '));
  process.exit(1);
}
const byConf = F.CONFERENCES.map((c) => `${c.shortName} ${F.FRANCHISES.filter((t) => t.conference === c.id).length}`);
console.log(`OK: ${F.FRANCHISES.length} unique franchises (${byConf.join(', ')}) + ${F.EXPANSION.length} expansion franchises, all logos present.`);
