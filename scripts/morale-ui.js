/* ==========================================================================
   HOOPS DYNASTY — morale UI (icon, Locker Room panel, profile section)
   Logic lives in scripts/morale.js; styles in styles/morale.css.
   ========================================================================== */
(function () {
  'use strict';

  var dom = window.HDDom;
  var el = dom.el;
  function M() { return window.HDMorale; }

  var MOUTHS = {
    high: 'M6.3 11.4Q10 15.4 13.7 11.4',
    mid: 'M6.6 12.9H13.4',
    low: 'M6.3 14.2Q10 10.4 13.7 14.2'
  };

  // Neon smiley for an evaluation ({ value, mood }) — or a neutral face
  function icon(ev, opts) {
    opts = opts || {};
    var id = ev && ev.mood ? ev.mood.id : null;
    var label = ev && ev.mood ? 'Morale: ' + ev.mood.label + ' (' + ev.value + ')' : 'Morale unavailable';
    var svg = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">' +
      '<circle cx="10" cy="10" r="8.1"/>' +
      '<circle cx="7.1" cy="8" r="1.05" fill="currentColor" stroke="none"/><circle cx="12.9" cy="8" r="1.05" fill="currentColor" stroke="none"/>' +
      '<path d="' + (MOUTHS[id] || MOUTHS.mid) + '"/></svg>';
    return el('span', { class: 'hd-morale' + (id ? ' hd-morale--' + id : '') + (opts.className ? ' ' + opts.className : ''),
      role: 'img', 'aria-label': label, title: label, html: svg });
  }

  function signed(n) { var r = Math.round(n); return (r > 0 ? '+' : r < 0 ? '−' : '±') + Math.abs(r); }

  /* --- Locker Room panel (roster tab, current season) -------------------- */
  function lockerRoomPanel(save, teamId, opts) {
    opts = opts || {};
    var rep = M().lockerRoomReport(save, teamId);
    var roster = save.players.filter(function (p) { return p.teamId === teamId; });
    var avgEv = rep.average == null ? null : { value: rep.average, mood: M().moodFor(rep.average) };
    var editable = !!opts.onCaptainChange;

    var captainControl;
    if (editable) {
      var sel = el('select', { class: 'hd-select', id: 'lr-captain', 'aria-label': 'Team captain' },
        roster.slice().sort(function (a, b) { return b.overall - a.overall; }).map(function (p) {
          return el('option', { value: p.id, selected: rep.captain && rep.captain.id === p.id,
            text: window.HDPlayerIdentity.fullName(p) + ' · ' + M().PERSONALITIES[p.personality].label });
        }));
      sel.addEventListener('change', function () { opts.onCaptainChange(sel.value); });
      captainControl = el('div', { class: 'lr-captain' }, [
        el('label', { class: 'lr-label', for: 'lr-captain', text: 'Captain' }),
        el('div', { class: 'hd-select-wrap' }, [sel])
      ]);
    } else {
      captainControl = el('div', { class: 'lr-captain' }, [
        el('span', { class: 'lr-label', text: 'Captain' }),
        el('span', { class: 'lr-value', text: rep.captain ? window.HDPlayerIdentity.fullName(rep.captain) + ' · ' + M().PERSONALITIES[rep.captain.personality].label : '—' })
      ]);
    }

    return el('section', { class: 'hd-panel gs-panel lr-panel', 'aria-labelledby': 'lr-title' }, [
      el('div', { class: 'lr-head' }, [
        el('h2', { class: 'hd-eyebrow lr-title', id: 'lr-title', text: 'Locker Room' }),
        el('div', { class: 'lr-summary' }, [
          icon(avgEv, { className: 'lr-avg-icon' }),
          el('span', { class: 'lr-avg' }, [el('strong', { text: rep.average == null ? '—' : String(rep.average) }), el('span', { text: ' team morale' })]),
          el('span', { class: 'lr-counts' }, [
            el('span', null, [icon({ value: 80, mood: M().moodFor(80) }), document.createTextNode(' ' + rep.counts.high)]),
            el('span', null, [icon({ value: 55, mood: M().moodFor(55) }), document.createTextNode(' ' + rep.counts.mid)]),
            el('span', null, [icon({ value: 20, mood: M().moodFor(20) }), document.createTextNode(' ' + rep.counts.low)])
          ])
        ]),
        captainControl
      ]),
      el('ul', { class: 'lr-issues' }, rep.issues.map(function (i) {
        return el('li', { class: 'lr-issue is-' + i.level, text: i.text });
      }))
    ]);
  }

  /* --- Player profile section -------------------------------------------- */
  function profileSection(save, player) {
    var ev = M().evaluate(save, player);
    var P = M().PERSONALITIES[ev.personality];
    var out = M().contractOutlook(ev.value, ev.personality);
    var pct = function (x) { return Math.round(x * 100) + '%'; };
    return el('section', { class: 'pp-section pp-morale', 'aria-labelledby': 'pp-morale-title' }, [
      el('h3', { class: 'hd-eyebrow pp-section-title', id: 'pp-morale-title', text: 'Morale' }),
      el('div', { class: 'pm-head' }, [
        icon(ev, { className: 'pm-icon' }),
        el('div', null, [
          el('p', { class: 'pm-score' }, [el('strong', { text: String(ev.value) }), el('span', { text: ' · ' + ev.mood.label })]),
          el('p', { class: 'pm-sub', text: P.label + (ev.captain ? ' · Team captain' : '') + ' — ' + P.summary })
        ])
      ]),
      el('ul', { class: 'pm-factors' }, ev.factors.map(function (f) {
        var cls = f.impact >= 1 ? 'is-up' : f.impact <= -1 ? 'is-down' : 'is-flat';
        return el('li', { class: 'pm-factor ' + cls }, [
          el('span', { class: 'pm-factor-label', text: f.label }),
          el('span', { class: 'pm-factor-impact', text: signed(f.impact) }),
          el('span', { class: 'pm-factor-detail', text: f.detail })
        ]);
      })),
      el('dl', { class: 'pm-outlook' }, [
        el('div', null, [el('dt', { text: 'Role' }), el('dd', { text: M().ROLE_LABELS[ev.role] + ' (expects ' + M().ROLE_LABELS[ev.expectedRole].toLowerCase() + ')' })]),
        el('div', null, [el('dt', { text: 'Contract outlook' }), el('dd', { text: out.summary })]),
        el('div', null, [el('dt', { text: 'Re-sign willingness' }), el('dd', { text: pct(out.resignWillingness) })]),
        el('div', null, [el('dt', { text: 'Free-agency flight risk' }), el('dd', { text: pct(out.freeAgencyLeaveRisk) })]),
        el('div', null, [el('dt', { text: 'Trade-request risk' }), el('dd', { text: pct(out.tradeRequestRisk) })])
      ])
    ]);
  }

  window.HDMoraleUI = { icon: icon, lockerRoomPanel: lockerRoomPanel, profileSection: profileSection };
})();
