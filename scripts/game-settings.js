/* ==========================================================================
   HOOPS DYNASTY — in-game Settings section (game shell → Settings)
   League Rules for the active dynasty, plus a shortcut to the app's display
   settings (theme, text size).

   Timing (scripts/dynasty.js changeRules):
   - Preseason / offseason: every rule can change and applies immediately.
   - Regular season / playoffs: Difficulty still applies immediately; every
     other rule change is scheduled and takes effect next season.

   HDGameSettings.render(container, save, ctx)
     ctx.replaceSave(save)   adopt the saved copy in the shell
     ctx.openAppSettings()   open Theme & Text Size
   ========================================================================== */
(function () {
  'use strict';

  var dom = window.HDDom;
  var el = dom.el;
  function D() { return window.HDDynasty; }

  var uid = 0;

  function render(container, save, ctx) {
    var Dy = D();
    var O = Dy.RULE_OPTIONS;
    var id = 'gss' + (++uid);
    var inSeason = Dy.seasonInProgress(save);
    var next = Dy.nextSeasonRules(save);
    var cur = save.league.rules;
    var pending = (save.league.pendingRules && save.league.pendingRules.values) || {};
    var nextLabel = Dy.seasonLabel(save.calendar.seasonYear + 1);

    container.appendChild(el('header', { class: 'gs-section-head' }, [
      el('p', { class: 'hd-eyebrow', text: save.league.name }),
      el('h1', { class: 'gs-section-title', tabindex: '-1', text: 'Settings' }),
      el('p', { class: 'gs-section-sub', text: 'League rules for this dynasty, and display options.' })
    ]));

    // When can rules change?
    var phase = Dy.phaseLabel(save.calendar.phase);
    container.appendChild(el('div', { class: 'gss-banner' + (inSeason ? ' is-locked' : ''), role: 'note' }, [
      dom.icon(inSeason ? 'lock' : 'calendar', 'gss-banner-icon'),
      el('p', null, inSeason
        ? [el('strong', { text: 'The ' + save.calendar.seasonLabel + ' ' + phase.toLowerCase() + ' is under way. ' }),
           document.createTextNode('Difficulty changes apply now. Other rule changes are saved and take effect in the ' + nextLabel + ' season.')]
        : [el('strong', { text: phase + ': rule changes take effect immediately. ' }),
           document.createTextNode('Once the regular season starts, only Difficulty can change until the next season.')])
    ]));

    /* --- form ---------------------------------------------------------- */
    var form = el('form', { class: 'gss-form', novalidate: true });

    function lockNote(key) {
      var wrap = el('div', { class: 'gss-rule-note', 'data-note': key });
      if (Dy.RULE_TIMING[key] === 'anytime') {
        wrap.appendChild(el('span', { class: 'gss-tag is-open', text: 'Changes apply immediately' }));
      } else if (inSeason) {
        wrap.appendChild(el('span', { class: 'gss-tag is-locked' }, [dom.icon('lock'), el('span', { text: 'Locked until ' + nextLabel })]));
      }
      if (Object.prototype.hasOwnProperty.call(pending, key)) {
        wrap.appendChild(el('span', { class: 'gss-pending' }, [
          el('span', { text: 'Now: ' + Dy.ruleValueLabel(key, cur[key]) + ' → ' + nextLabel + ': ' + Dy.ruleValueLabel(key, pending[key]) }),
          el('button', { class: 'hd-btn is-quiet gss-cancel', type: 'button', 'data-cancel': key, 'aria-label': 'Cancel the scheduled ' + Dy.RULE_LABELS[key].toLowerCase() + ' change', text: 'Cancel change' })
        ]));
      }
      return wrap;
    }

    function selectField(key, label, options) {
      var sel = el('select', { class: 'hd-select', id: id + '-' + key, 'data-rule': key, 'aria-describedby': id + '-' + key + '-detail' },
        options.map(function (o) { return el('option', { value: String(o.value), text: o.label, selected: String(o.value) === String(next[key]) }); }));
      return el('div', { class: 'hd-field gss-field', 'data-field': key }, [
        el('label', { class: 'hd-label', for: id + '-' + key, text: label }),
        el('div', { class: 'hd-select-wrap' }, [sel]),
        el('p', { class: 'hd-hint', id: id + '-' + key + '-detail', 'data-detail': key }),
        el('p', { class: 'hd-error', 'data-error': key }),
        lockNote(key)
      ]);
    }

    function segField(key, label, options) {
      return el('fieldset', { class: 'hd-field nd-fieldset gss-field', 'data-field': key }, [
        el('legend', { class: 'hd-label', text: label }),
        el('div', { class: 'hd-segmented nd-seg-full' + (options.length > 3 ? ' nd-seg-wrap' : '') }, options.map(function (o) {
          return el('label', null, [
            el('input', { type: 'radio', name: id + '-' + key, value: String(o.value), checked: String(o.value) === String(next[key]), 'data-rule': key }),
            el('span', { text: o.label })
          ]);
        })),
        el('p', { class: 'hd-hint', 'data-detail': key }),
        lockNote(key)
      ]);
    }

    function moneyField(key, label, hint) {
      return el('div', { class: 'hd-field gss-field', 'data-field': key }, [
        el('label', { class: 'hd-label', for: id + '-' + key, text: label }),
        el('div', { class: 'nd-money' }, [
          el('span', { 'aria-hidden': 'true', text: '$' }),
          el('input', { class: 'hd-input', id: id + '-' + key, type: 'text', inputmode: 'decimal', maxlength: '6', 'data-rule': key + 'M', value: (next[key] / 1e6).toFixed(1), 'aria-describedby': id + '-' + key + '-error' }),
          el('span', { 'aria-hidden': 'true', text: 'M' })
        ]),
        hint ? el('p', { class: 'hd-hint', text: hint }) : null,
        el('p', { class: 'hd-error', id: id + '-' + key + '-error', 'data-error': key }),
        lockNote(key)
      ]);
    }

    var rosterInput = el('input', { class: 'hd-input nd-year-input', id: id + '-rosterSize', type: 'text', inputmode: 'numeric', maxlength: '2', 'data-rule': 'rosterSize', value: String(next.rosterSize), 'aria-describedby': id + '-roster-hint ' + id + '-rosterSize-error' });
    var rosterField = el('div', { class: 'hd-field gss-field', 'data-field': 'rosterSize' }, [
      el('label', { class: 'hd-label', for: id + '-rosterSize', text: 'Roster Size' }),
      el('div', { class: 'nd-year' }, [
        el('button', { class: 'hd-btn is-icon', type: 'button', 'data-step': '-1', 'aria-label': 'Fewer players', text: '−' }),
        rosterInput,
        el('button', { class: 'hd-btn is-icon', type: 'button', 'data-step': '1', 'aria-label': 'More players', text: '+' })
      ]),
      el('p', { class: 'hd-hint', id: id + '-roster-hint', text: 'Maximum players per team, ' + O.rosterSize.min + '–' + O.rosterSize.max + '. Applies to roster moves; current rosters aren’t trimmed or filled.' }),
      el('p', { class: 'hd-error', id: id + '-rosterSize-error', 'data-error': 'rosterSize' }),
      lockNote('rosterSize')
    ]);

    form.appendChild(el('div', { class: 'nd-rules-grid gss-grid' }, [
      el('section', { class: 'hd-panel gs-panel', 'aria-labelledby': id + '-h-season' }, [
        el('h2', { class: 'hd-eyebrow', id: id + '-h-season', text: 'Season' }),
        selectField('seasonGames', 'Season Length', O.seasonGames.map(function (n) { return { value: n, label: n + ' games' }; })),
        selectField('playoffFormat', 'Playoff Format', Object.keys(O.playoffFormat).map(function (k) { return { value: k, label: O.playoffFormat[k].label }; })),
        segField('seriesLength', 'Playoff Series', O.seriesLength.map(function (n) { return { value: n, label: 'Best of ' + n }; }))
      ]),
      el('section', { class: 'hd-panel gs-panel', 'aria-labelledby': id + '-h-comp' }, [
        el('h2', { class: 'hd-eyebrow', id: id + '-h-comp', text: 'Competition' }),
        el('div', { class: 'hd-field gss-field', 'data-field': 'playerGender' }, [
          el('span', { class: 'hd-label', text: 'Players' }),
          el('p', { class: 'gss-fixed', text: (O.playerGender[cur.playerGender || 'male'] || O.playerGender.male).label }),
          el('div', { class: 'gss-rule-note' }, [el('span', { class: 'gss-tag' }, [dom.icon('lock'), el('span', { text: 'Set when the league was created' })])])
        ]),
        segField('difficulty', 'Difficulty', Object.keys(O.difficulty).map(function (k) { return { value: k, label: O.difficulty[k].label }; })),
        rosterField
      ]),
      el('section', { class: 'hd-panel gs-panel', 'aria-labelledby': id + '-h-fin' }, [
        el('h2', { class: 'hd-eyebrow', id: id + '-h-fin', text: 'Finances' }),
        moneyField('salaryCap', 'Salary Cap'),
        moneyField('luxuryTax', 'Luxury Tax Threshold', 'Teams with payroll above this line pay luxury tax.')
      ])
    ]));

    var status = el('p', { class: 'gss-status', role: 'status', 'aria-live': 'polite' });
    var saveBtn = el('button', { class: 'hd-btn is-primary', type: 'submit', disabled: true, text: 'Save changes' });
    form.appendChild(el('div', { class: 'gss-actions' }, [
      el('button', { class: 'hd-btn is-quiet', type: 'button', 'data-defaults': '', text: 'Reset to defaults' }),
      el('button', { class: 'hd-btn', type: 'button', 'data-discard': '', disabled: true, text: 'Discard' }),
      saveBtn
    ]));
    form.appendChild(status);
    container.appendChild(form);

    /* --- display settings ------------------------------------------------ */
    container.appendChild(el('section', { class: 'hd-panel gs-panel gss-display', 'aria-labelledby': id + '-h-display' }, [
      el('div', null, [
        el('h2', { class: 'hd-eyebrow', id: id + '-h-display', text: 'Display' }),
        el('p', { class: 'gss-display-text', text: 'Theme and text size apply to every dynasty on this device.' })
      ]),
      el('button', { class: 'hd-btn', type: 'button', 'data-app-settings': '', text: 'Theme & text size' })
    ]));

    /* --- behaviour ----------------------------------------------------- */
    function values() {
      var v = {};
      form.querySelectorAll('[data-rule]').forEach(function (inp) {
        var k = inp.getAttribute('data-rule');
        if (inp.type === 'radio') { if (inp.checked) v[k] = inp.value; }
        else v[k] = inp.value;
      });
      return v;
    }
    var initial = JSON.stringify(Dy.validateRules(values()).values);

    function refresh() {
      var check = Dy.validateRules(values());
      var v = check.values;
      form.querySelector('[data-detail="playoffFormat"]').textContent = (O.playoffFormat[v.playoffFormat] || {}).detail || '';
      form.querySelector('[data-detail="difficulty"]').textContent = (O.difficulty[v.difficulty] || {}).detail || '';
      var dirty = JSON.stringify(v) !== initial;
      saveBtn.disabled = !dirty;
      form.querySelector('[data-discard]').disabled = !dirty;
      return check;
    }

    function showErrors(errors) {
      form.querySelectorAll('[data-error]').forEach(function (p) {
        var k = p.getAttribute('data-error');
        p.textContent = errors[k] || '';
        var inp = form.querySelector('#' + id + '-' + k);
        if (inp) inp.setAttribute('aria-invalid', errors[k] ? 'true' : 'false');
      });
    }

    function rerender(s, message) {
      container.textContent = '';
      render(container, s, ctx);
      var st = container.querySelector('.gss-status');
      if (st && message) { st.textContent = message; st.classList.add('is-visible'); }
    }

    function summary(res) {
      var parts = [];
      res.applied.forEach(function (a) { parts.push(Dy.RULE_LABELS[a.key] + ' is now ' + Dy.ruleValueLabel(a.key, a.to) + '.'); });
      res.scheduled.forEach(function (a) { parts.push(Dy.RULE_LABELS[a.key] + ' changes to ' + Dy.ruleValueLabel(a.key, a.to) + ' in ' + nextLabel + '.'); });
      res.cancelled.forEach(function (a) { parts.push('Scheduled ' + Dy.RULE_LABELS[a.key].toLowerCase() + ' change cancelled.'); });
      return parts.join(' ') || 'No changes.';
    }

    // Persist a modified copy; the shell adopts it only once it's saved.
    function persist(copy, message) {
      saveBtn.disabled = true;
      status.textContent = 'Saving…';
      return window.HDSaves.update(copy).then(function () {
        ctx.replaceSave(copy);
        rerender(copy, message);
      }).catch(function (err) {
        status.textContent = 'Your changes weren’t saved. ' + (err && err.message ? err.message : '');
        status.classList.add('is-error');
        saveBtn.disabled = false;
      });
    }

    form.addEventListener('input', function () { refresh(); });
    form.addEventListener('change', function () { refresh(); });

    form.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var step = b.getAttribute('data-step');
      if (step) {
        var n = parseInt(rosterInput.value, 10);
        n = isNaN(n) ? Dy.DEFAULT_RULES.rosterSize : n + Number(step);
        rosterInput.value = String(Math.min(O.rosterSize.max, Math.max(O.rosterSize.min, n)));
        refresh();
        return;
      }
      if (b.hasAttribute('data-discard')) { rerender(save, 'Changes discarded.'); container.querySelector('h1').focus({ preventScroll: true }); return; }
      if (b.hasAttribute('data-defaults')) {
        var d = Dy.DEFAULT_RULES;
        form.querySelector('[data-rule="seasonGames"]').value = String(d.seasonGames);
        form.querySelector('[data-rule="playoffFormat"]').value = d.playoffFormat;
        form.querySelector('[data-rule="seriesLength"][value="' + d.seriesLength + '"]').checked = true;
        form.querySelector('[data-rule="difficulty"][value="' + d.difficulty + '"]').checked = true;
        rosterInput.value = String(d.rosterSize);
        form.querySelector('[data-rule="salaryCapM"]').value = (d.salaryCap / 1e6).toFixed(1);
        form.querySelector('[data-rule="luxuryTaxM"]').value = (d.luxuryTax / 1e6).toFixed(1);
        showErrors({});
        refresh();
        status.textContent = 'Defaults filled in. Save to apply them.';
        return;
      }
      var key = b.getAttribute('data-cancel');
      if (key) {
        var copy = JSON.parse(JSON.stringify(save));
        Dy.cancelPendingRule(copy, key);
        persist(copy, 'Scheduled ' + Dy.RULE_LABELS[key].toLowerCase() + ' change cancelled.');
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var check = refresh();
      if (!check.valid) {
        showErrors(check.errors);
        var first = form.querySelector('[aria-invalid="true"]');
        if (first) first.focus();
        return;
      }
      var copy = JSON.parse(JSON.stringify(save));
      var res = Dy.changeRules(copy, values());
      if (!res.ok) {
        showErrors(res.errors);
        var bad = form.querySelector('#' + id + '-' + Object.keys(res.errors)[0]);
        if (bad) bad.focus();
        return;
      }
      showErrors({});
      persist(copy, summary(res));
    });

    container.querySelector('[data-app-settings]').addEventListener('click', function () { ctx.openAppSettings(); });
    refresh();
  }

  window.HDGameSettings = { render: render };
})();
