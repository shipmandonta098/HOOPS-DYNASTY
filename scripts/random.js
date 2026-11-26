/* ==========================================================================
   HOOPS DYNASTY — deterministic randomness
   Seeded PRNG so generated content (rosters, portraits, owner messages) is
   reproducible from a seed. Generated data is still SAVED; the seed only
   guarantees the same result if generation ever has to be repeated
   (e.g. migrating an older save).
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HDRandom = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // FNV-1a 32-bit string hash
  function hash(text) {
    var h = 0x811c9dc5;
    text = String(text);
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  // mulberry32: small, fast, good enough for game content
  function rng(seed) {
    var a = typeof seed === 'number' ? seed >>> 0 : hash(seed);
    function next() {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      next: next,
      int: function (min, max) { return min + Math.floor(next() * (max - min + 1)); },
      pick: function (list) { return list[Math.floor(next() * list.length)]; },
      chance: function (p) { return next() < p; },
      // roughly normal, mean 0, sd ~1
      normal: function () { return (next() + next() + next() + next() - 2) * 1.7; },
      shuffle: function (list) {
        var a2 = list.slice();
        for (var i = a2.length - 1; i > 0; i--) {
          var j = Math.floor(next() * (i + 1));
          var tmp = a2[i]; a2[i] = a2[j]; a2[j] = tmp;
        }
        return a2;
      }
    };
  }

  return { hash: hash, rng: rng };
});
