/* ==========================================================================
   HOOPS DYNASTY — shared DOM helpers for in-game screens
   el()        build elements (text is always set via textContent)
   portrait()  render an HDPortraits spec into a sized container
   gameDate()  format an in-game ISO date (yyyy-mm-dd, timezone-free)
   icon()      small stroke icons used across the game UI (static markup)
   ========================================================================== */
(function () {
  'use strict';

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (key) {
      var value = attrs[key];
      if (value == null || value === false) return;
      if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;        // trusted static/generated markup only
      else if (key === 'style') Object.keys(value).forEach(function (p) { node.style.setProperty(p, value[p]); });
      else if (key === 'on') Object.keys(value).forEach(function (ev) { node.addEventListener(ev, value[ev]); });
      else node.setAttribute(key, value === true ? '' : value);
    });
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  // Portrait markup comes from HDPortraits.render, which validates every
  // value it emits, so it is safe to insert.
  function portrait(spec, opts) {
    opts = opts || {};
    return el('span', { class: 'hd-portrait' + (opts.className ? ' ' + opts.className : ''),
      html: window.HDPortraits.render(spec, { jersey: opts.jersey, label: opts.label }) });
  }

  function hex(c, fallback) { return /^#[0-9A-Fa-f]{6}$/.test(c) ? c : (fallback || '#808080'); }

  // In-game dates work for any supported year (see scripts/season.js)
  function gameDate(iso, long) {
    return window.HDSeason.formatDate(iso, long ? 'long' : 'short');
  }

  var ICON_PATHS = {
    dashboard: '<rect x="3" y="3" width="6" height="7" rx="1"/><rect x="11" y="3" width="6" height="4" rx="1"/><rect x="11" y="9" width="6" height="8" rx="1"/><rect x="3" y="12" width="6" height="5" rx="1"/>',
    roster: '<circle cx="7.5" cy="7" r="2.6"/><path d="M2.8 16c.4-3 2.3-4.6 4.7-4.6s4.3 1.6 4.7 4.6"/><circle cx="13.6" cy="7.6" r="2.1"/><path d="M13.2 11.4c2.2 0 3.8 1.4 4.1 4"/>',
    schedule: '<rect x="3" y="4.5" width="14" height="12.5" rx="1.5"/><path d="M3 8.5h14M7 2.5v4M13 2.5v4"/>',
    standings: '<path d="M4 16V9M10 16V4M16 16v-5"/><path d="M2.5 16.5h15"/>',
    league: '<circle cx="10" cy="10" r="7"/><path d="M3 10h14M10 3c2.2 2 3.3 4.4 3.3 7S12.2 15 10 17M10 3c-2.2 2-3.3 4.4-3.3 7S7.8 15 10 17"/>',
    office: '<rect x="3" y="6.5" width="14" height="10" rx="1.5"/><path d="M7.5 6.5V4.8c0-.7.5-1.3 1.2-1.3h2.6c.7 0 1.2.6 1.2 1.3v1.7M3 11h14"/>',
    finances: '<path d="M10 2.8v14.4M13.4 5.6c-.6-1.2-1.9-1.9-3.4-1.9-2 0-3.4 1.1-3.4 2.6 0 3.6 7 1.9 7 5.6 0 1.6-1.5 2.7-3.6 2.7-1.6 0-3-.7-3.6-2"/>',
    owner: '<circle cx="10" cy="7" r="3"/><path d="M4 17c.5-3.4 3-5.3 6-5.3s5.5 1.9 6 5.3"/><path d="m7.2 2.6 1.3 1.2L10 2l1.5 1.8 1.3-1.2"/>',
    settings: '<circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/>',
    exit: '<path d="M8 3.5H4.5A1.5 1.5 0 0 0 3 5v10a1.5 1.5 0 0 0 1.5 1.5H8M12.5 6.5 16 10l-3.5 3.5M16 10H7.5"/>',
    menu: '<path d="M3 5.5h14M3 10h14M3 14.5h14"/>',
    close: '<path d="m5 5 10 10M15 5 5 15"/>',
    play: '<path d="M6 4.5v11l9-5.5Z"/>',
    calendar: '<rect x="3" y="4.5" width="14" height="12.5" rx="1.5"/><path d="M3 8.5h14M7 2.5v4M13 2.5v4"/>',
    check: '<path d="m4.5 10.5 3.5 3.5 7.5-8"/>',
    chart: '<path d="M3 16.5h14M5.5 13l3.5-4 3 2.5 4-6"/>'
  };
  function icon(name, className) {
    return el('span', { class: 'hd-icon' + (className ? ' ' + className : ''), 'aria-hidden': 'true',
      html: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (ICON_PATHS[name] || '') + '</svg>' });
  }

  window.HDDom = { el: el, portrait: portrait, hex: hex, gameDate: gameDate, icon: icon };
})();
