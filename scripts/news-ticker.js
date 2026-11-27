/* ==========================================================================
   HOOPS DYNASTY — League News ticker (reusable component)
   Restores the title-screen ticker from the original front-office design
   (fixed "LEAGUE NEWS" label, headlines scrolling right to left, diamond
   separators, seamless loop), rebuilt as a component any screen can mount.

     var t = HDNewsTicker.create(hostElement, { label: 'League News' });
     t.setItems(['Headline one', 'Headline two']);   // or [{ headline }]
     t.destroy();

   Seamless loop: the headline list is repeated until it is wider than the
   viewport, then cloned; the track moves by exactly one list width (-50%).
   Speed is constant (px/s) whatever the number of headlines.
   Pauses on hover and keyboard focus. With reduced motion the ticker does
   not move; the headlines can be scrolled sideways inside the ticker.
   Styles: styles/news-ticker.css.
   ========================================================================== */
(function () {
  'use strict';

  var SPEED_PX_PER_SEC = 48;       // comfortable reading speed
  var MIN_DURATION_S = 20;

  function create(host, opts) {
    opts = opts || {};
    var items = [];
    var root = document.createElement('section');
    root.className = 'hd-ticker';
    root.setAttribute('aria-label', opts.label || 'League News');

    var label = document.createElement('div');
    label.className = 'hd-ticker-label';
    label.setAttribute('aria-hidden', 'true');
    label.innerHTML = '<span class="hd-ticker-dot"></span>';
    // "League News": "League " is dropped when the label would crowd out
    // the headlines (narrow phones, large text) — see fitLabel()
    var words = String(opts.label || 'League News').split(' ');
    var last = words.pop();
    var text = document.createElement('span');
    if (words.length) {
      var lead = document.createElement('span');
      lead.className = 'hd-ticker-label-lead';
      lead.textContent = words.join(' ') + ' ';
      text.appendChild(lead);
    }
    text.appendChild(document.createTextNode(last));
    label.appendChild(text);

    var viewport = document.createElement('div');
    viewport.className = 'hd-ticker-viewport';
    viewport.tabIndex = 0;          // keyboard users can focus it to pause
    viewport.setAttribute('aria-label', (opts.label || 'League News') + ' headlines');

    var track = document.createElement('div');
    track.className = 'hd-ticker-track';
    viewport.appendChild(track);
    root.appendChild(label);
    root.appendChild(viewport);
    host.appendChild(root);

    function texts() {
      return items.map(function (it) { return typeof it === 'string' ? it : it.headline; }).filter(Boolean);
    }

    function fill(list, hidden) {
      texts().forEach(function (text) {
        var li = document.createElement('li');
        li.textContent = text;
        if (hidden) li.setAttribute('aria-hidden', 'true');
        list.appendChild(li);
      });
    }

    // Keep the label to at most 40% of the ticker
    function fitLabel() {
      root.classList.remove('is-compact');
      if (root.clientWidth && label.offsetWidth > root.clientWidth * 0.4) root.classList.add('is-compact');
    }

    var lastWidth = -1;
    function build() {
      fitLabel();
      var list = texts();
      track.textContent = '';
      root.hidden = list.length === 0;
      if (!list.length) return;
      var first = document.createElement('ul');
      first.className = 'hd-ticker-list';
      fill(first, false);
      track.appendChild(first);
      // Repeat until one list is wider than the viewport: never a gap
      var vw = viewport.clientWidth || window.innerWidth;
      for (var i = 0; i < 12 && first.scrollWidth < vw; i++) fill(first, true);
      var second = first.cloneNode(true);
      second.setAttribute('aria-hidden', 'true');
      second.querySelectorAll('li').forEach(function (li) { li.setAttribute('aria-hidden', 'true'); });
      track.appendChild(second);
      var seconds = Math.max(MIN_DURATION_S, first.scrollWidth / SPEED_PX_PER_SEC);
      track.style.setProperty('--hd-ticker-duration', seconds.toFixed(1) + 's');
      lastWidth = vw;
    }

    // Rebuild when the viewport width changes (rotation, resize, text size)
    var ro = null, timer = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () {
        if (Math.abs(viewport.clientWidth - lastWidth) < 2) return;
        clearTimeout(timer);
        timer = setTimeout(build, 150);
      });
      ro.observe(viewport);
    }

    return {
      element: root,
      setItems: function (next) { items = Array.isArray(next) ? next.slice() : []; build(); },
      refresh: build,
      destroy: function () { if (ro) ro.disconnect(); clearTimeout(timer); root.remove(); }
    };
  }

  window.HDNewsTicker = { create: create, SPEED_PX_PER_SEC: SPEED_PX_PER_SEC };
})();
