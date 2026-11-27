/* ==========================================================================
   HOOPS DYNASTY — reusable portrait asset
   A portrait is stored as a tiny spec { skin, hair, hairColor, attire } of
   palette indexes and rendered here as an inline SVG silhouette (no facial
   features: a neutral, broadcast-graphic style). Players render in their
   team's jersey; owners in business attire.

   Every value is clamped / validated at render time, so a spec from an
   imported save can never inject markup or CSS.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory(function () {
    return (typeof module === 'object' && module.exports) ? require('./random.js') : root.HDRandom;
  });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HDPortraits = api;
})(typeof self !== 'undefined' ? self : this, function (getRandom) {
  'use strict';

  var SKIN = ['#F1D3BC', '#E2B48F', '#C99068', '#A86F4B', '#8A5536', '#6B3F27', '#4E2C1C'];
  var HAIR_COLORS = ['#1E1A18', '#3B2A20', '#6B4A2E', '#A57A4A', '#C9A25E', '#8E8E8E', '#D6D6D6'];
  // [suit, shirt, tie|null]
  var ATTIRE = [
    ['#2F3338', '#F4F4F2', '#7A1F2B'],   // charcoal suit, tie
    ['#1E2B45', '#EAF0F7', null],        // navy, open collar
    ['#141518', '#2A2C31', null],        // black, turtleneck
    ['#5B6068', '#F3EEE6', null],        // gray blazer, blouse
    ['#22262D', '#F4F4F2', '#1F4E79']    // dark suit, blue tie
  ];
  var HAIR_STYLES = 11;  // see HAIR below (0–6 original styles, 7–10 added for women's leagues)
  var MALE_STYLES = 7;   // men keep the original seven (same random draw as before)
  var FEMALE_STYLES = [4, 5, 7, 8, 9, 10];

  var HAIR = [
    'M21 24C21 12 43 12 43 24c-2-6-7-8-11-8s-9 2-11 8Z',                                     // 0 short crop
    'M21.5 22c.5-9 20.5-9 21 0-3.5-5-17.5-5-21 0Z',                                         // 1 buzz
    'M20 26c-1-15 24-16 24-2-4-7-11-7-15-6l-2 4c-3 0-5 2-7 4Z',                             // 2 side part
    'M21 28c-1-6 1-8 2-9v9Zm22 0c1-6-1-8-2-9v9Z',                                           // 3 receding
    'M19 34c-2-22 28-22 26 0-1-8-2-12-4-15-4-3-14-3-18 0-2 3-3 7-4 15Z',                    // 4 long / bob
    null,                                                                                     // 5 curly (circles)
    '',                                                                                       // 6 bald
    'M21 24c1-11 21-11 22 0-3-5-9-7-13-6-3 1-6 3-9 6Z',                                       // 7 long straight (front)
    'M21 24C21 12 43 12 43 24c-3-6-8-8-11-8s-8 2-11 8Z',                                     // 8 ponytail (front)
    'M21 24C21 12 43 12 43 24c-3-6-8-8-11-8s-8 2-11 8ZM27.5 10a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0Z', // 9 top bun
    'M21 24C21 12 43 12 43 24c-3-6-8-8-11-8s-8 2-11 8Z'                                      // 10 braids (front)
  ];
  // Hair that falls behind the head (drawn before the face)
  var HAIR_BACK = {
    7: 'M19 26c0-16 26-16 26 0v17c-3 2-6 2-8 0V31H27v12c-2 2-5 2-8 0Z',
    8: 'M41 17c7 1 10 9 8 19-1 4-4 5-5 3 2-7 1-12-4-16Z',
    10: 'M19.5 24v21h4.2V27Zm20.8 3v18h4.2V24Z'
  };

  function idx(value, length) {
    var n = Math.floor(Number(value));
    if (!isFinite(n) || n < 0) return 0;
    return n % length;
  }
  function hex(value, fallback) {
    return /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
  }

  /**
   * Deterministic spec from a seed string.
   * opts.older: bias toward gray hair / receding (owners)
   */
  function generate(seed, opts) {
    opts = opts || {};
    var r = getRandom().rng('portrait:' + seed);
    var hairColor = opts.older && r.chance(0.55) ? r.pick([5, 6]) : r.int(0, 4);
    var hair = opts.female ? r.pick(FEMALE_STYLES) : r.int(0, MALE_STYLES - 1);
    if (opts.older && !opts.female && r.chance(0.3)) hair = 3;
    return { skin: r.int(0, SKIN.length - 1), hair: hair, hairColor: hairColor, attire: r.int(0, ATTIRE.length - 1) };
  }

  /**
   * SVG markup for a portrait.
   * opts.jersey: { primary, secondary } renders a team jersey instead of attire
   * opts.background: hex background (defaults to transparent)
   * opts.label: accessible label (omitted = decorative)
   */
  function render(spec, opts) {
    spec = spec || {};
    opts = opts || {};
    var skin = SKIN[idx(spec.skin, SKIN.length)];
    var hairColor = HAIR_COLORS[idx(spec.hairColor, HAIR_COLORS.length)];
    var style = idx(spec.hair, HAIR_STYLES);
    var bg = opts.background ? hex(opts.background, null) : null;

    var body;
    if (opts.jersey) {
      var p = hex(opts.jersey.primary, '#444444');
      var s = hex(opts.jersey.secondary, '#DDDDDD');
      body =
        '<path d="M8 64c0-16 12-22 24-22s24 6 24 22Z" fill="' + p + '"/>' +
        '<path d="M25 42.5 32 51l7-8.5Z" fill="' + skin + '"/>' +
        '<path d="M24.5 42.2 32 51.5l7.5-9.3" fill="none" stroke="' + s + '" stroke-width="2.4" stroke-linejoin="round"/>' +
        '<path d="M14 49c3 3 4 8 4 15M50 49c-3 3-4 8-4 15" fill="none" stroke="' + s + '" stroke-width="2"/>';
    } else {
      var a = ATTIRE[idx(spec.attire, ATTIRE.length)];
      body =
        '<path d="M8 64c0-16 12-22 24-22s24 6 24 22Z" fill="' + a[0] + '"/>' +
        '<path d="M26 42.5 32 55l6-12.5Z" fill="' + a[1] + '"/>' +
        (a[2] ? '<path d="M31 46h2l1.2 10-2.2 2.5-2.2-2.5Z" fill="' + a[2] + '"/>' : '') +
        '<path d="M26 42.5 32 55M38 42.5 32 55" stroke="rgba(0,0,0,.25)" stroke-width="1"/>';
    }

    var hair;
    if (style === 5) {
      hair = '<g fill="' + hairColor + '">' +
        [[23, 19], [27, 15.5], [32, 14], [37, 15.5], [41, 19], [21.5, 24], [42.5, 24]]
          .map(function (c) { return '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="5"/>'; }).join('') + '</g>';
    } else {
      hair = HAIR[style] ? '<path d="' + HAIR[style] + '" fill="' + hairColor + '"/>' : '';
    }

    var label = typeof opts.label === 'string' ? opts.label.replace(/[<>&"]/g, '') : '';
    return '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" ' +
      (label ? 'role="img" aria-label="' + label + '"' : 'aria-hidden="true"') + '>' +
      (bg ? '<rect width="64" height="64" fill="' + bg + '"/>' : '') +
      (HAIR_BACK[style] ? '<path d="' + HAIR_BACK[style] + '" fill="' + hairColor + '"/>' : '') +
      '<rect x="27" y="33" width="10" height="11" rx="3" fill="' + skin + '"/>' +
      body +
      '<ellipse cx="21" cy="27" rx="2" ry="3" fill="' + skin + '"/>' +
      '<ellipse cx="43" cy="27" rx="2" ry="3" fill="' + skin + '"/>' +
      '<ellipse cx="32" cy="26" rx="11" ry="13" fill="' + skin + '"/>' +
      '<path d="M32 39c-5 0-9-2-11-6 3 2 7 3 11 3s8-1 11-3c-2 4-6 6-11 6Z" fill="rgba(0,0,0,.08)"/>' +
      hair +
      '</svg>';
  }

  function isValidSpec(spec) {
    return !!spec && ['skin', 'hair', 'hairColor', 'attire'].every(function (k) {
      return Number.isInteger(spec[k]) && spec[k] >= 0 && spec[k] < 32;
    });
  }

  return { generate: generate, render: render, isValidSpec: isValidSpec };
});
