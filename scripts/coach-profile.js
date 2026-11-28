/* ==========================================================================
   HOOPS DYNASTY — coach profile (rendered in the player profile dialog)
   Bio (birthdate, college, relatives), coaching attributes in three
   groups, coaching career, As Player and As Executive (empty until there's
   history). Data: scripts/coaches.js. Styles: styles/coaches.css + the
   player profile styles.
   ========================================================================== */
(function () {
  'use strict';

  var dom = window.HDDom;
  var el = dom.el;
  function C() { return window.HDCoaches; }
  function dateLabel(iso) { return window.HDSeason.formatDate(iso, 'long'); }

  function row(label, value) {
    return el('div', { class: 'pp-row' }, [el('dt', { text: label }), el('dd', null, [typeof value === 'string' ? document.createTextNode(value) : value])]);
  }
  function none(text) { return el('span', { class: 'pp-none', text: text }); }

  function bio(save, c) {
    var Bio = window.HDPlayerBio;
    var known = {};
    (save.players || []).concat(save.retiredPlayers || []).forEach(function (p) { known[p.id] = true; });
    var relatives = c.relatives.length ? el('ul', { class: 'pp-relatives' }, c.relatives.map(function (r) {
      return el('li', null, [el('span', { text: r.relation + ' of ' }),
        r.playerId && known[r.playerId] ? el('button', { class: 'pp-link', type: 'button', 'data-player-id': r.playerId, text: r.name }) : el('span', { text: r.name })]);
    })) : none('None');
    var team = c.teamId ? save.teams.filter(function (t) { return t.id === c.teamId; })[0] : null;
    return el('section', { class: 'pp-section', 'aria-labelledby': 'cp-bio-title' }, [
      el('h3', { class: 'hd-eyebrow pp-section-title', id: 'cp-bio-title', text: 'Bio' }),
      el('dl', { class: 'pp-bio' }, [
        row('Role', team ? 'Head Coach, ' + team.fullName : 'Available coach'),
        row('Born', el('time', { datetime: c.birthDate, text: dateLabel(c.birthDate) })),
        row('Age', String(window.HDSeason.ageOn(c.birthDate, save.calendar.currentDate))),
        row('Birthplace', window.HDPlayerIdentity.birthplaceLabel(c)),
        row('Nationality', el('span', { class: 'pp-country' }, [el('span', { class: 'hd-flag', html: window.HDFlags.svg(c.nationality) }), el('span', { text: Bio.countryName(c.nationality) })])),
        row('College', c.college || el('span', { class: 'pp-none', 'aria-label': 'No college', text: '—' })),
        row('Relatives', relatives),
        row('Specialty', C().SPECIALTIES[c.specialty])
      ])
    ]);
  }

  function attributes(c) {
    var Rt = window.HDRatings;
    var grid = el('div', { class: 'pp-attr-groups cp-attr-groups' });
    C().GROUPS.forEach(function (g) {
      grid.appendChild(el('div', { class: 'pp-attr-group', role: 'group', 'aria-labelledby': 'cp-attr-' + g.id }, [
        el('h4', { class: 'pp-attr-group-title', id: 'cp-attr-' + g.id, text: g.label }),
        el('ul', { class: 'pp-attrs' }, C().ATTRIBUTES.filter(function (a) { return a.group === g.id; }).map(function (a) {
          var v = c.attributes[a.key];
          var style = a.kind === 'style';
          return el('li', { class: 'pp-attr' + (style ? ' cp-style' : ''), title: a.desc, 'data-attr': a.key }, [
            el('span', { class: 'pp-attr-name' }, [document.createTextNode(a.label),
              style ? el('span', { class: 'cp-style-label', text: ' · ' + C().styleLabel(a.key, v) }) : null]),
            el('span', { class: 'pp-attr-bar', 'aria-hidden': 'true' }, [
              el('span', { class: 'pp-attr-fill ' + (style ? 'cp-fill-style' : Rt.className(v)), style: { width: v + '%' } })
            ]),
            style ? el('strong', { class: 'pp-attr-value cp-style-value', text: String(v) }) : Rt.el(v, { className: 'pp-attr-value', tag: 'strong' })
          ]);
        }))
      ]));
    });
    return el('section', { class: 'pp-section pp-ratings', 'aria-labelledby': 'cp-attr-title' }, [
      el('h3', { class: 'hd-eyebrow pp-section-title', id: 'cp-attr-title', text: 'Coaching Attributes' }),
      grid,
      el('p', { class: 'cs-legend', text: 'Colored ratings: higher is better. Gray bars are styles — preferences, neither good nor bad.' })
    ]);
  }

  function history(save, c) {
    var ap = c.asPlayer;
    var player = ap ? (save.players || []).concat(save.retiredPlayers || []).filter(function (p) { return p.id === ap.playerId; })[0] : null;
    var careerList = c.career.length ? el('ul', { class: 'cp-list' }, c.career.slice().reverse().map(function (s) {
      var span = (s.from ? dateLabel(s.from) : 'Before the league began') + ' – ' + (s.to ? dateLabel(s.to) : 'present');
      return el('li', null, [el('strong', { text: s.role + ', ' + s.teamName }), el('span', { class: 'pp-muted', text: ' · ' + span })]);
    })) : el('p', { class: 'pp-none', text: 'No head coaching jobs yet.' });
    var lob = c.teamId && c.teamId === save.userTeamId ? C().lobbying(save, c.teamId) : null;   // the coach lobbies YOU
    return el('section', { class: 'pp-section cp-history', 'aria-labelledby': 'cp-career-title' }, [
      el('h3', { class: 'hd-eyebrow pp-section-title', id: 'cp-career-title', text: 'Career' }),
      el('h4', { class: 'pp-attr-group-title', text: 'As Coach' }), careerList,
      lob ? el('p', { class: 'cs-note cp-lobby', role: 'note', text: lob.text }) : null,
      el('h4', { class: 'pp-attr-group-title', text: 'As Player' }),
      ap ? el('p', { class: 'cp-text' }, [
        player ? el('button', { class: 'pp-link', type: 'button', 'data-player-id': player.id, text: 'Played ' + ap.seasons + (ap.seasons === 1 ? ' season' : ' seasons') })
          : el('span', { text: 'Played ' + ap.seasons + (ap.seasons === 1 ? ' season' : ' seasons') }),
        el('span', { text: (ap.lastTeamName ? ', last with the ' + ap.lastTeamName : '') + '; retired ' + dateLabel(ap.retiredDate) + '.' })
      ]) : el('p', { class: 'pp-none', text: 'No playing career on record.' }),
      el('h4', { class: 'pp-attr-group-title', text: 'As Executive' }),
      c.asExecutive.length ? el('ul', { class: 'cp-list' }, c.asExecutive.map(function (x) { return el('li', { text: x.role + ', ' + x.teamName }); }))
        : el('p', { class: 'pp-none', text: 'No executive history.' })
    ]);
  }

  /** Renders a coach into the profile dialog body. */
  function render(body, dialog, save, coachId) {
    var c = C().get(save, coachId);
    body.textContent = '';
    if (!c) { body.appendChild(el('p', { class: 'pp-none', text: 'This coach couldn’t be found.' })); return; }
    var team = c.teamId ? save.teams.filter(function (t) { return t.id === c.teamId; })[0] : null;
    var colors = team ? team.colors : { primary: '#555555', secondary: '#DDDDDD', tertiary: '#999999' };
    dialog.style.setProperty('--c1', dom.hex(colors.primary));
    dialog.style.setProperty('--c2', dom.hex(colors.secondary));
    dialog.style.setProperty('--c3', dom.hex(colors.tertiary));
    body.appendChild(el('header', { class: 'pp-head' }, [
      el('div', { class: 'hd-team-accent', 'aria-hidden': 'true' }, [el('span'), el('span'), el('span')]),
      el('div', { class: 'pp-head-body' }, [
        dom.portrait(c.portrait, { className: 'pp-portrait' }),
        el('div', { class: 'pp-ident' }, [
          el('p', { class: 'hd-eyebrow pp-team' }, [team ? el('img', { src: team.logo, alt: '', width: 18, height: 18 }) : null,
            el('span', { text: team ? team.fullName : 'Available' })]),
          el('h2', { class: 'pp-name', id: 'pp-name', tabindex: '-1', text: C().fullName(c) }),
          el('p', { class: 'pp-sub', text: (team ? 'Head Coach' : 'Coach') + ' · ' + C().summary(c) })
        ]),
        el('div', { class: 'pp-badges' }, [
          el('span', { class: 'pp-badge' }, [window.HDRatings.el(C().overall(c), { tag: 'strong', label: 'Coaching overall' }), el('span', { text: 'OVR', 'aria-hidden': 'true' })])
        ])
      ])
    ]));
    body.appendChild(el('div', { class: 'pp-sections' }, [bio(save, c), attributes(c), history(save, c)]));
  }

  window.HDCoachProfile = { render: render };
})();
