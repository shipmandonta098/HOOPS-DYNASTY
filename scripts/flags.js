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
    ME: '<rect width="30" height="20" fill="#D3AE3B"/><rect x="1.2" y="1.2" width="27.6" height="17.6" fill="#C40308"/><circle cx="15" cy="10" r="3" fill="#D3AE3B"/>'
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
