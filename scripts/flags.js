/* ==========================================================================
   HOOPS DYNASTY — national flags (inline SVG)
   Small, simplified flags for the countries in scripts/player-bio.js.
   Drawn as SVG instead of emoji because emoji flags render as plain
   letters on Windows. Unknown codes fall back to a neutral tile.
   HDFlags.svg(code) -> trusted SVG markup (static shapes only).
   ========================================================================== */
(function () {
  'use strict';

  // viewBox 30 x 20
  function h(colors, weights) {                 // horizontal bands
    weights = weights || colors.map(function () { return 1; });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var y = 0;
    return colors.map(function (c, i) {
      var hgt = 20 * weights[i] / total;
      var r = '<rect y="' + y.toFixed(2) + '" width="30" height="' + (hgt + 0.05).toFixed(2) + '" fill="' + c + '"/>';
      y += hgt;
      return r;
    }).join('');
  }
  function v(colors) {                            // vertical bands
    var w = 30 / colors.length;
    return colors.map(function (c, i) {
      return '<rect x="' + (i * w).toFixed(2) + '" width="' + (w + 0.05).toFixed(2) + '" height="20" fill="' + c + '"/>';
    }).join('');
  }
  function star(cx, cy, r, fill) {
    var pts = [];
    for (var i = 0; i < 10; i++) {
      var rad = i % 2 ? r * 0.4 : r;
      var a = -Math.PI / 2 + i * Math.PI / 5;
      pts.push((cx + rad * Math.cos(a)).toFixed(2) + ',' + (cy + rad * Math.sin(a)).toFixed(2));
    }
    return '<polygon points="' + pts.join(' ') + '" fill="' + fill + '"/>';
  }

  var FLAGS = {
    US: (function () {
      var s = '<rect width="30" height="20" fill="#B22234"/>';
      for (var i = 1; i < 13; i += 2) s += '<rect y="' + (i * 20 / 13).toFixed(2) + '" width="30" height="' + (20 / 13).toFixed(2) + '" fill="#fff"/>';
      s += '<rect width="12" height="10.77" fill="#3C3B6E"/>';
      for (var row = 0; row < 3; row++) for (var col = 0; col < 4; col++) s += '<circle cx="' + (1.8 + col * 2.8) + '" cy="' + (2 + row * 3.4) + '" r=".55" fill="#fff"/>';
      return s;
    })(),
    CA: '<rect width="30" height="20" fill="#fff"/><rect width="7.5" height="20" fill="#D52B1E"/><rect x="22.5" width="7.5" height="20" fill="#D52B1E"/>' +
      '<path d="M15 4.2l1 2.1 1.3-.6-.5 2.9 1.7-1.6.5 1.2 1.6-.3-.7 2 .7.4-2.6 2 .4 1-2.6-.5V16h-.6v-3.2l-2.6.5.4-1-2.6-2 .7-.4-.7-2 1.6.3.5-1.2 1.7 1.6-.5-2.9 1.3.6Z" fill="#D52B1E"/>',
    FR: v(['#0055A4', '#fff', '#EF4135']),
    RS: h(['#C6363C', '#0C4076', '#fff']),
    AU: '<rect width="30" height="20" fill="#012169"/><path d="M0 0h15v10H0z" fill="#012169"/><path d="M0 0l15 10M15 0L0 10" stroke="#fff" stroke-width="2"/><path d="M7.5 0v10M0 5h15" stroke="#fff" stroke-width="3.2"/><path d="M7.5 0v10M0 5h15" stroke="#C8102E" stroke-width="1.6"/>' + star(7.5, 15, 2.2, '#fff') + star(23, 6, 1.1, '#fff') + star(26, 11, 1.1, '#fff') + star(22, 16, 1.1, '#fff'),
    DE: h(['#000', '#DD0000', '#FFCE00']),
    ES: h(['#AA151B', '#F1BF00', '#AA151B'], [1, 2, 1]),
    NG: v(['#008751', '#fff', '#008751']),
    LT: h(['#FDB913', '#006A44', '#C1272D']),
    GR: (function () {
      var s = '';
      for (var i = 0; i < 9; i++) s += '<rect y="' + (i * 20 / 9).toFixed(2) + '" width="30" height="' + (20 / 9 + 0.05).toFixed(2) + '" fill="' + (i % 2 ? '#fff' : '#0D5EAF') + '"/>';
      return s + '<rect width="11.1" height="11.1" fill="#0D5EAF"/><path d="M4.44 0h2.22v11.1H4.44zM0 4.44h11.1v2.22H0z" fill="#fff"/>';
    })(),
    SI: h(['#fff', '#005DA4', '#ED1C24']),
    HR: h(['#FF0000', '#fff', '#171796']) + '<rect x="12" y="4.5" width="6" height="7" fill="#fff" stroke="#FF0000" stroke-width=".6"/><path d="M12 4.5h2v1.75h-2zm4 0h2v1.75h-2zm-2 1.75h2V8h-2zm-2 1.75h2v1.75h-2zm4 0h2v1.75h-2zm-2 1.75h2v1.75h-2z" fill="#FF0000"/>',
    TR: '<rect width="30" height="20" fill="#E30A17"/><circle cx="11" cy="10" r="5" fill="#fff"/><circle cx="12.25" cy="10" r="4" fill="#E30A17"/>' + star(17, 10, 2.2, '#fff'),
    BR: '<rect width="30" height="20" fill="#009C3B"/><path d="M15 2.2 27.6 10 15 17.8 2.4 10Z" fill="#FFDF00"/><circle cx="15" cy="10" r="4.4" fill="#002776"/><path d="M10.8 9.2c3-.9 6.2-.6 8.6.9" stroke="#fff" stroke-width=".7" fill="none"/>',
    AR: h(['#74ACDF', '#fff', '#74ACDF']) + '<circle cx="15" cy="10" r="1.7" fill="#F6B40E"/>',
    CM: v(['#007A5E', '#CE1126', '#FCD116']) + star(15, 10, 2.6, '#FCD116'),
    JP: '<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#BC002D"/>',
    LV: h(['#9E3039', '#fff', '#9E3039'], [2, 1, 2]),
    BS: h(['#00778B', '#FFC72C', '#00778B']) + '<path d="M0 0 13 10 0 20Z" fill="#000"/>',
    DO: '<rect width="30" height="20" fill="#fff"/><rect width="13.5" height="8.5" fill="#002D62"/><rect x="16.5" width="13.5" height="8.5" fill="#CE1126"/><rect y="11.5" width="13.5" height="8.5" fill="#CE1126"/><rect x="16.5" y="11.5" width="13.5" height="8.5" fill="#002D62"/>',
    IT: v(['#009246', '#fff', '#CE2B37']),
    SN: v(['#00853F', '#FDEF42', '#E31B23']) + star(15, 10, 2.6, '#00853F'),
    FI: '<rect width="30" height="20" fill="#fff"/><path d="M8 0h5v20H8zM0 7.5h30v5H0z" fill="#002F6C"/>',
    ME: '<rect width="30" height="20" fill="#D3AE3B"/><rect x="1.2" y="1.2" width="27.6" height="17.6" fill="#C40308"/><circle cx="15" cy="10" r="3" fill="#D3AE3B"/>',
    GB: '<rect width="30" height="20" fill="#012169"/><path d="M0 0l30 20M30 0 0 20" stroke="#fff" stroke-width="4"/><path d="M0 0l30 20M30 0 0 20" stroke="#C8102E" stroke-width="1.6"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6"/><path d="M15 0v20M0 10h30" stroke="#C8102E" stroke-width="3.4"/>',
    SE: '<rect width="30" height="20" fill="#006AA7"/><path d="M8 0h4v20H8zM0 8h30v4H0z" fill="#FECC00"/>',
    BE: v(['#000', '#FDDA24', '#EF3340']),
    CH: '<rect width="30" height="20" fill="#DA291C"/><path d="M13.2 4.5h3.6v4h4v3.6h-4v4h-3.6v-4h-4V8.5h4z" fill="#fff"/>',
    AT: h(['#C8102E', '#fff', '#C8102E']),
    BA: '<rect width="30" height="20" fill="#002395"/><path d="M8 0h14v20Z" fill="#FECB00"/>' +
      [[6, 2], [8.6, 6], [11.2, 10], [13.8, 14], [16.4, 18]].map(function (p) { return star(p[0], p[1], 1, '#fff'); }).join(''),
    GE: '<rect width="30" height="20" fill="#fff"/><path d="M13 0h4v20h-4zM0 8h30v4H0z" fill="#FF0000"/><path d="M5.5 2.5h1.4v1.3h1.3v1.4H6.9v1.3H5.5V5.2H4.2V3.8h1.3zM23 2.5h1.4v1.3h1.3v1.4h-1.3v1.3H23V5.2h-1.3V3.8H23zM5.5 13.5h1.4v1.3h1.3v1.4H6.9v1.3H5.5v-1.3H4.2v-1.4h1.3zM23 13.5h1.4v1.3h1.3v1.4h-1.3v1.3H23v-1.3h-1.3v-1.4H23z" fill="#FF0000"/>',
    SS: h(['#000', '#fff', '#DA121A', '#fff', '#078930'], [6, 1, 6, 1, 6]) + '<path d="M0 0 12 10 0 20Z" fill="#0F47AF"/>' + star(4.5, 10, 2.2, '#FCDD09'),
    CD: '<rect width="30" height="20" fill="#007FFF"/><path d="M0 17 26 0h4v3L4 20H0Z" fill="#F7D618"/><path d="M0 18.5 28 0h2v1.5L2 20H0Z" fill="#CE1021"/>' + star(5, 4.5, 2.6, '#F7D618'),
    AO: h(['#CC092F', '#000']) + '<path d="M13 7.5a4 4 0 1 1 1.6 6.5" fill="none" stroke="#FFCB00" stroke-width="1.2"/>' + star(16, 8.6, 1.1, '#FFCB00'),
    CN: '<rect width="30" height="20" fill="#EE1C25"/>' + star(5, 5, 3, '#FFFF00') + star(10, 2, 1, '#FFFF00') + star(12, 4, 1, '#FFFF00') + star(12, 7, 1, '#FFFF00') + star(10, 9, 1, '#FFFF00'),
    PH: h(['#0038A8', '#CE1126']) + '<path d="M0 0l15 10L0 20Z" fill="#fff"/><circle cx="5" cy="10" r="2" fill="#FCD116"/>' + star(1.6, 2.2, .8, '#FCD116') + star(1.6, 17.8, .8, '#FCD116') + star(12.2, 10, .8, '#FCD116'),
    IL: '<rect width="30" height="20" fill="#fff"/><path d="M0 2h30v2.6H0zM0 15.4h30V18H0z" fill="#0038B8"/><path d="M15 6.2l3.3 5.7h-6.6ZM15 13.8l-3.3-5.7h6.6Z" fill="none" stroke="#0038B8" stroke-width=".9"/>',
    NZ: '<rect width="30" height="20" fill="#012169"/><path d="M0 0l15 10M15 0L0 10" stroke="#fff" stroke-width="2"/><path d="M7.5 0v10M0 5h15" stroke="#fff" stroke-width="3.2"/><path d="M7.5 0v10M0 5h15" stroke="#C8102E" stroke-width="1.6"/>' +
      [[22, 5], [25.5, 9], [19.5, 10], [22, 16]].map(function (p) { return star(p[0], p[1], 1.4, '#fff') + star(p[0], p[1], 1, '#C8102E'); }).join(''),
    MX: v(['#006847', '#fff', '#CE1126']) + '<circle cx="15" cy="10" r="2.2" fill="#8C5A2B"/>',
    PR: (function () {
      var s2 = '';
      for (var i = 0; i < 5; i++) s2 += '<rect y="' + (i * 4) + '" width="30" height="4.05" fill="' + (i % 2 ? '#fff' : '#ED0000') + '"/>';
      return s2 + '<path d="M0 0l13 10L0 20Z" fill="#0050F0"/>' + star(4.5, 10, 2.2, '#fff');
    })(),
    JM: '<rect width="30" height="20" fill="#009B3A"/><path d="M0 0l15 10L0 20ZM30 0 15 10l15 10Z" fill="#000"/><path d="M0 0l30 20M30 0 0 20" stroke="#FED100" stroke-width="2.6"/>',
    UA: h(['#0057B7', '#FFD700']),
    PL: h(['#fff', '#DC143C']),
    CZ: h(['#fff', '#D7141A']) + '<path d="M0 0l15 10L0 20Z" fill="#11457E"/>'
  };

  function svg(code) {
    var body = FLAGS[code] || '<rect width="30" height="20" fill="#9AA0A8"/>';
    // Rounded corners come from CSS (.hd-flag), so no clip-path ids are
    // needed (duplicate ids across many inline SVGs are fragile).
    return '<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="none">' +
      body + '<rect x=".25" y=".25" width="29.5" height="19.5" fill="none" stroke="rgba(0,0,0,.25)" stroke-width=".5"/></svg>';
  }

  window.HDFlags = { svg: svg, codes: Object.keys(FLAGS) };
})();
