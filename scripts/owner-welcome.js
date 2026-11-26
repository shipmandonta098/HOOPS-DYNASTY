/* ==========================================================================
   HOOPS DYNASTY — Owner Welcome screen + reusable ownership UI pieces
   Shown once per dynasty (until save.onboarding.ownerIntroCompleted).
   Everything is read from the dynasty save (owner record built by
   scripts/ownership.js at creation / migration).

   HDOwnerUI     confidenceMeter(), expectations(), ownerCard()  (reused
                 by the in-game Owner and Dashboard sections)
   HDOwnerWelcome.init({ root, onEnter(save) -> Promise, onExit() })
                 -> { render(save) }
   ========================================================================== */
(function () {
  'use strict';

  var dom = window.HDDom;
  var el = dom.el;

  /* --- Reusable pieces --------------------------------------------------- */

  function confidenceMeter(value, opts) {
    opts = opts || {};
    var v = Math.max(0, Math.min(100, Math.round(value)));
    var label = window.HDOwnership.confidenceLabel(v);
    return el('div', { class: 'ow-meter' + (opts.compact ? ' is-compact' : '') }, [
      el('div', { class: 'ow-meter-head' }, [
        el('span', { class: 'ow-meter-label', text: opts.title || 'Owner Confidence' }),
        el('span', { class: 'ow-meter-value' }, [el('strong', { text: String(v) }), el('span', { text: ' / 100' })])
      ]),
      el('div', {
        class: 'ow-meter-track', role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(v),
        'aria-valuetext': v + ' out of 100, ' + label, 'aria-label': opts.title || 'Owner confidence'
      }, [
        el('span', { class: 'ow-meter-fill', style: { width: v + '%' } }),
        // band marks at 25 / 50 / 70 / 85
        el('span', { class: 'ow-meter-mark', style: { left: '25%' } }),
        el('span', { class: 'ow-meter-mark', style: { left: '50%' } }),
        el('span', { class: 'ow-meter-mark', style: { left: '70%' } }),
        el('span', { class: 'ow-meter-mark', style: { left: '85%' } })
      ]),
      el('span', { class: 'ow-meter-status', text: label })
    ]);
  }

  function objectiveList(items) {
    return el('ul', { class: 'ow-list' }, items.map(function (o) {
      return el('li', null, [dom.icon('check', 'ow-list-icon'), el('span', { text: o.text })]);
    }));
  }

  function expectations(owner) {
    var x = owner.expectations;
    var tier = window.HDOwnership.TIERS[x.tier];
    return el('div', { class: 'ow-expectations' }, [
      el('section', { class: 'ow-exp', 'aria-label': 'Season expectations' }, [
        el('h3', { class: 'hd-eyebrow', text: 'Season Expectations' }),
        el('p', { class: 'ow-exp-tier', text: tier ? tier.label : '' }),
        objectiveList(x.season)
      ]),
      el('section', { class: 'ow-exp', 'aria-label': 'Financial expectations' }, [
        el('h3', { class: 'hd-eyebrow', text: 'Financial Expectations' }),
        el('p', { class: 'ow-exp-tier', text: 'Spending: ' + window.HDOwnership.spendingLabel(owner.traits.spending) }),
        objectiveList(x.financial)
      ]),
      el('section', { class: 'ow-exp', 'aria-label': 'Long-term expectations' }, [
        el('h3', { class: 'hd-eyebrow', text: 'Long-Term Vision' }),
        el('p', { class: 'ow-exp-tier', text: personality(owner).label }),
        objectiveList(x.longTerm)
      ])
    ]);
  }

  function personality(owner) {
    return (window.HDOwners.PERSONALITIES[owner.personality]) || { label: owner.personality, summary: '' };
  }

  function ownerCard(owner) {
    var p = personality(owner);
    return el('div', { class: 'ow-owner' }, [
      dom.portrait(owner.portrait, { className: 'ow-owner-portrait', label: 'Portrait of ' + owner.name }),
      el('div', { class: 'ow-owner-text' }, [
        el('p', { class: 'ow-owner-name', text: owner.name }),
        el('p', { class: 'ow-owner-title', text: owner.title }),
        el('span', { class: 'ow-chip', title: p.summary, text: p.label })
      ])
    ]);
  }

  window.HDOwnerUI = { confidenceMeter: confidenceMeter, expectations: expectations, ownerCard: ownerCard, personality: personality };

  /* --- Welcome screen ---------------------------------------------------- */

  function init(options) {
    var root = options.root;
    var content = root.querySelector('[data-ow-content]');
    var current = null;

    function render(save) {
      current = save;
      var D = window.HDDynasty;
      var team = D.userTeam(save);
      var owner = D.userOwner(save);
      root.style.setProperty('--c1', dom.hex(team.colors.primary));
      root.style.setProperty('--c2', dom.hex(team.colors.secondary));
      root.style.setProperty('--c3', dom.hex(team.colors.tertiary));
      content.textContent = '';

      var swatches = el('span', { class: 'hd-swatches', role: 'img', 'aria-label': 'Team colors' },
        ['primary', 'secondary', 'tertiary'].map(function (k) { return el('span', { class: 'hd-swatch', style: { '--swatch': dom.hex(team.colors[k]) } }); }));

      content.appendChild(el('header', { class: 'ow-franchise' }, [
        el('img', { class: 'ow-logo', src: team.logo, alt: team.fullName + ' logo', width: 72, height: 72 }),
        el('div', { class: 'ow-franchise-text' }, [
          el('p', { class: 'hd-eyebrow', text: save.calendar.seasonLabel + ' Season · ' + save.league.name }),
          el('h1', { class: 'ow-title', id: 'ow-title', tabindex: '-1', text: team.fullName }),
          swatches
        ])
      ]));

      content.appendChild(el('section', { class: 'hd-panel ow-letter', 'aria-labelledby': 'ow-letter-title' }, [
        el('div', { class: 'hd-team-accent', 'aria-hidden': 'true' }, [el('span'), el('span'), el('span')]),
        el('div', { class: 'ow-letter-body' }, [
          ownerCard(owner),
          el('div', { class: 'ow-message' }, [
            el('h2', { class: 'hd-eyebrow', id: 'ow-letter-title', text: 'A Message From Ownership' }),
            el('p', { class: 'ow-message-text', text: owner.welcomeMessage || '' }),
            el('p', { class: 'ow-signature' }, [el('span', { text: '— ' + owner.name }), el('span', { class: 'ow-signature-title', text: owner.title + ', ' + team.fullName })])
          ])
        ])
      ]));

      content.appendChild(expectations(owner));

      var enter = el('button', { class: 'hd-btn is-primary is-large ow-enter', type: 'button', text: 'Enter Front Office' });
      var error = el('p', { class: 'hd-error', role: 'alert' });
      enter.addEventListener('click', function () {
        enter.disabled = true;
        error.textContent = '';
        Promise.resolve(options.onEnter(current)).catch(function (err) {
          error.textContent = 'Couldn’t save your progress. ' + (err && err.message ? err.message : '');
          enter.disabled = false;
        });
      });

      content.appendChild(el('div', { class: 'hd-panel ow-footer' }, [
        confidenceMeter(owner.confidence, { title: 'Initial Owner Confidence' }),
        el('div', { class: 'ow-footer-action' }, [enter, error])
      ]));
    }

    root.querySelector('[data-ow-exit]').addEventListener('click', function () { options.onExit(); });

    return { render: render, currentId: function () { return current && current.id; } };
  }

  window.HDOwnerWelcome = { init: init };
})();
