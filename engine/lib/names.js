'use strict';

/**
 * names.js — names for engine-generated players (draft prospects), drawn from
 * the SAME cultural naming system the browser game uses.
 *
 * This file used to hold two flat arrays. Two things were wrong with that:
 *
 *   1. The pools were seeded with real, currently-active players' surnames,
 *      which the project's fictional-only rule does not allow. They are gone.
 *   2. A draft class generated here would have had no relationship between a
 *      prospect's name and where he is from, while the same league's existing
 *      players did — the same league, two different systems.
 *
 * So there is one source of truth, ../../nameCultures.js, and this file is a
 * bridge to it rather than a copy. That module is an ES module (the browser
 * loads it directly) and the engine is CommonJS, which `require` cannot cross
 * in a package marked "commonjs". Reading the source and evaluating it with
 * the `export` keywords stripped is a small, contained hack, and it beats
 * maintaining a second copy of 700 lines of name pools that would drift out of
 * step within a release. It runs once, at require time, in Node only.
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'nameCultures.js');

function loadNameCultures() {
  const src = fs.readFileSync(SRC, 'utf8').replace(/^export /gm, '');
  const factory = new Function(
    `${src}\nreturn { CULTURES, COUNTRIES, makeOrigin, makeName, cultureForCountry, poolSize };`,
  );
  return factory();
}

const cultures = loadNameCultures();

/**
 * The cultural module expects `rng.next()` (the browser's RNG shape); the
 * engine's RNG class exposes `float(min, max)`. One adapter, so neither side
 * has to know about the other.
 */
function adapt(rng) {
  return { next: () => rng.float(0, 1) };
}

/** Where a prospect is from: birth city/country, nationality, naming origin. */
function makeOrigin(rng) {
  return cultures.makeOrigin(adapt(rng));
}

/** A name in the naming tradition `origin` gave him. */
function makeName(rng, origin) {
  return cultures.makeName(adapt(rng), origin);
}

module.exports = { makeOrigin, makeName, CULTURES: cultures.CULTURES, COUNTRIES: cultures.COUNTRIES };
