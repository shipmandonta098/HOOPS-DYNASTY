/* ==========================================================================
   HOOPS DYNASTY — rating color system (single source of truth)
   Every 0–100 rating on every screen (player overall / potential, the
   attribute ratings, team overall) is colored with these thresholds:

     90–100  elite    green
     80–89   great    light green
     65–79   average  gray
     50–64   below    orange
     0–49    poor     red
     missing / invalid → no tier: default text color

   Colors are theme tokens (--rating-elite … --rating-poor in
   styles/theme.css), tuned per theme to stay readable (>= 4.5:1).
   Only the numbers are colored; labels keep the normal text color.

   HDRatings.tier(value)        -> { id, label, min } | null
   HDRatings.className(value)   -> 'hd-rating hd-rating--<tier|none>'
   HDRatings.text(value)        -> '87' or '—'
   HDRatings.el(value, opts)    -> <span class="hd-rating …">87</span> (browser)
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HDRatings = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Highest first; a rating takes the first tier whose min it reaches.
  var TIERS = Object.freeze([
    Object.freeze({ id: 'elite',   min: 90, label: 'Elite' }),
    Object.freeze({ id: 'great',   min: 80, label: 'Very Good' }),
    Object.freeze({ id: 'average', min: 65, label: 'Average' }),
    Object.freeze({ id: 'below',   min: 50, label: 'Below Average' }),
    Object.freeze({ id: 'poor',    min: 0,  label: 'Poor' })
  ]);

  function valid(value) {
    return typeof value === 'number' && isFinite(value) && value >= 0 && value <= 100;
  }

  function tier(value) {
    if (!valid(value)) return null;
    for (var i = 0; i < TIERS.length; i++) if (value >= TIERS[i].min) return TIERS[i];
    return null;
  }

  function className(value) {
    var t = tier(value);
    return 'hd-rating hd-rating--' + (t ? t.id : 'none');
  }

  function text(value) { return valid(value) ? String(Math.round(value)) : '—'; }

  // <span> with the rating colored; opts.className adds classes, opts.tag
  // picks the element (e.g. 'strong'), opts.label sets an aria-label.
  function el(value, opts) {
    opts = opts || {};
    var node = document.createElement(opts.tag || 'span');
    node.className = className(value) + (opts.className ? ' ' + opts.className : '');
    node.textContent = text(value);
    if (opts.label) node.setAttribute('aria-label', opts.label + ' ' + text(value));
    return node;
  }

  return { TIERS: TIERS, tier: tier, className: className, text: text, el: el };
});
