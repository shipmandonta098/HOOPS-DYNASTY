'use strict';

/**
 * esm.js — load the browser's ES modules from the CommonJS engine.
 *
 * The game's player maths (playerRatings.js, playerArchetypes.js,
 * playerGen.js) lives at the repo root as ES modules, because the browser
 * loads them directly with no build step. This package is "commonjs", so
 * `require` cannot cross into them.
 *
 * Rather than keep a second copy of the generator in the engine — which would
 * drift out of step within a release and quietly give draft prospects a
 * different talent model from the league they are drafted into — this reads
 * the source, strips the ES module keywords, and evaluates it with its
 * dependencies injected. Node-only, once at require time.
 *
 * It handles exactly the shape these files use: static top-level imports of
 * named bindings from sibling files, and named `export` declarations. It is a
 * loader for THIS repo's modules, not a general one.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const cache = new Map();

/** Names a module exports, by scanning its `export` declarations. */
function exportedNames(src) {
  const names = new Set();
  const re = /^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(src))) names.add(m[1]);
  // `export { a, b as c };`
  const re2 = /^export\s*\{([^}]*)\}/gm;
  while ((m = re2.exec(src))) {
    for (const part of m[1].split(',')) {
      const as = part.split(/\s+as\s+/);
      const name = (as[1] || as[0]).trim();
      if (name) names.add(name);
    }
  }
  return [...names];
}

/** Load one root-level ES module and return its named exports. */
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const raw = fs.readFileSync(path.join(ROOT, file), 'utf8');

  // Pull out the imports and satisfy them by loading the sibling first.
  const scope = {};
  const importRe = /^import\s*\{([^}]*)\}\s*from\s*'\.\/([\w.]+\.js)';\s*$/gm;
  let m;
  while ((m = importRe.exec(raw))) {
    const dep = load(m[2]);
    for (const part of m[1].split(',')) {
      const as = part.split(/\s+as\s+/).map((x) => x.trim());
      const local = as[1] || as[0];
      if (local) scope[local] = dep[as[0]];
    }
  }

  const body = raw
    .replace(importRe, '')
    // `export { a, b };` re-exports are satisfied by the bindings already in
    // scope, so the statement itself can go.
    .replace(/^export\s*\{[^}]*\};\s*$/gm, '')
    .replace(/^export\s+/gm, '');

  const names = exportedNames(raw);
  const keys = Object.keys(scope);
  const fn = new Function(...keys, `${body}\nreturn { ${names.join(', ')} };`);
  const mod = fn(...keys.map((k) => scope[k]));
  cache.set(file, mod);
  return mod;
}

/**
 * Adapt the engine's RNG class to the shape the browser modules expect.
 *
 * Both are seeded and deterministic; they just name their methods
 * differently (`float(0,1)` against `next()`).
 */
function adaptRNG(rng) {
  const next = () => rng.float(0, 1);
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    gauss: (mean, sd) => rng.gaussian(mean, sd),
  };
}

module.exports = { load, adaptRNG };
