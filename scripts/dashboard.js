/* ==========================================================================
   HOOPS DYNASTY — Dynasty dashboard (landing screen for a loaded dynasty)
   Renders ONLY from the loaded save object, so switching dynasties can
   never show another dynasty's data. No simulation lives here yet.

   HDDashboard.init({ root, dynasty: HDDynasty, franchises: HDFranchises })
     -> { render(save), clear(), currentId() }
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
      else if (key === 'style') Object.keys(value).forEach(function (p) { node.style.setProperty(p, value[p]); });
      else node.setAttribute(key, value === true ? '' : value);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

  function init(options) {
    var root = options.root;
    var D = options.dynasty;
    var F = options.franchises;
    var content = root.querySelector('[data-db-content]');
    var currentId = null;

    function render(save) {
      currentId = save.id;
      var team = D.userTeam(save);
      var conf = (save.league.conferences || []).filter(function (c) { return c.id === team.conference; })[0];
      var confName = conf ? conf.name : cap(team.conference);
      var market = F && F.marketSize(team.marketSize);
      var record = save.record.wins + '–' + save.record.losses;

      content.textContent = '';
      root.style.setProperty('--c1', team.colors.primary);
      root.style.setProperty('--c2', team.colors.secondary);
      root.style.setProperty('--c3', team.colors.tertiary);

      // Hero
      content.appendChild(el('section', { class: 'hd-panel db-hero', 'aria-labelledby': 'db-title' }, [
        el('div', { class: 'hd-team-accent', 'aria-hidden': 'true' }, [el('span'), el('span'), el('span')]),
        el('div', { class: 'db-hero-body' }, [
          el('img', { class: 'db-logo', src: team.logo, alt: team.fullName + ' logo', width: 96, height: 96 }),
          el('div', { class: 'db-ident' }, [
            el('p', { class: 'hd-eyebrow', text: save.league.name }),
            el('h1', { class: 'db-title', id: 'db-title', tabindex: '-1', text: team.fullName }),
            el('p', { class: 'db-gm', text: 'General Manager · ' + save.gm.name }),
            el('div', { class: 'db-chips' }, [
              el('span', { class: 'db-chip', text: save.calendar.seasonLabel + ' Season' }),
              el('span', { class: 'db-chip is-phase', text: D.phaseLabel(save.calendar.phase) })
            ])
          ]),
          el('div', { class: 'db-stats' }, [
            el('div', { class: 'db-stat' }, [el('span', { class: 'db-stat-num', text: record }), el('span', { class: 'db-stat-label', text: 'Record' })]),
            el('div', { class: 'db-stat' }, [el('span', { class: 'db-stat-num', text: String(D.teamOverall(team)) }), el('span', { class: 'db-stat-label', text: 'OVR' })])
          ])
        ])
      ]));

      // Season overview
      var facts = [
        ['Season', save.calendar.seasonLabel],
        ['League Phase', D.phaseLabel(save.calendar.phase)],
        ['Record', record],
        ['Conference', confName],
        ['Market Size', market ? market.label : cap(team.marketSize)],
        ['League Founded', String(save.league.foundedYear)]
      ];
      var overview = el('section', { class: 'hd-panel db-panel', 'aria-labelledby': 'db-overview-title' }, [
        el('h2', { class: 'hd-eyebrow db-panel-title', id: 'db-overview-title', text: 'Season Overview' }),
        el('dl', { class: 'db-facts' }, facts.map(function (f) {
          return el('div', null, [el('dt', { text: f[0] }), el('dd', { text: f[1] })]);
        }))
      ]);

      // Conference power ratings (from this save's teams only)
      var confTeams = save.teams.filter(function (t) { return t.conference === team.conference; })
        .sort(function (a, b) { return D.teamOverall(b) - D.teamOverall(a) || a.fullName.localeCompare(b.fullName); });
      var ratings = el('ol', { class: 'db-ratings' }, confTeams.map(function (t, i) {
        var isUser = t.id === team.id;
        return el('li', { class: isUser ? 'is-user' : null, 'aria-current': isUser ? 'true' : null }, [
          el('span', { class: 'db-rank', text: String(i + 1) }),
          el('img', { src: t.logo, alt: '', width: 28, height: 28, loading: 'lazy' }),
          el('span', { class: 'db-team' }, [
            el('span', { text: t.fullName }),
            isUser ? el('span', { class: 'db-you', text: 'Your team' }) : null
          ]),
          el('span', { class: 'db-ovr', text: String(D.teamOverall(t)) })
        ]);
      }));
      var standings = el('section', { class: 'hd-panel db-panel', 'aria-labelledby': 'db-ratings-title' }, [
        el('h2', { class: 'hd-eyebrow db-panel-title', id: 'db-ratings-title', text: confName + ' · Power Ratings' }),
        ratings
      ]);

      content.appendChild(el('div', { class: 'db-grid' }, [overview, standings]));
      content.appendChild(el('p', { class: 'db-note', text: 'Game simulation, rosters and the season schedule arrive in upcoming updates. Your dynasty is saved on this device.' }));
    }

    function clear() {
      currentId = null;
      content.textContent = '';
    }

    return { render: render, clear: clear, currentId: function () { return currentId; } };
  }

  window.HDDashboard = { init: init };
})();
