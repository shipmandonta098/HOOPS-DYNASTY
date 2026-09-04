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
 * bridge to it rather than a copy — loaded through ./esm.js, which is where
 * the ES-module-into-CommonJS mechanics live.
 */

const { load, adaptRNG } = require('./esm');

const cultures = load('nameCultures.js');

/** Where a player is from: birth city/country, nationality, naming origin. */
function makeOrigin(rng, gender = 'male') {
  return cultures.makeOrigin(adaptRNG(rng), gender);
}

/** A name in the naming tradition and gender pool `origin` carries. */
function makeName(rng, origin) {
  return cultures.makeName(adaptRNG(rng), origin);
}

module.exports = { makeOrigin, makeName, CULTURES: cultures.CULTURES, COUNTRIES: cultures.COUNTRIES };
