/* ==========================================================================
   HOOPS DYNASTY — New Dynasty wizard (League Setup → Select Franchise →
   Confirm Dynasty)

   Owns the wizard's UI state. Navigation between steps goes through the
   page router (so browser/Android back works); the router calls show(step).

   HDNewDynasty.init({
     root,          // #new-dynasty-screen
     franchises,    // HDFranchises
     dynasty,       // HDDynasty
     saves,         // HDSaves (async save manager)
     navigate(step),// router: push a history entry for `step` and show it
     back(),        // router: go back one entry (previous step or title)
     onComplete(save)
   }) -> { show(step) -> step actually shown, reset() }

   Begin Dynasty always creates a NEW, independent save (its own permanent
   id); it never replaces an existing dynasty.

   Entered values live in the form controls themselves, so going Back never
   loses anything. reset() clears them after a dynasty is created.
   ========================================================================== */
(function () {
  'use strict';

  var CHECK_SVG = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6.2 5 8.6 9.5 3.6"/></svg>';

  // Small DOM helper: el('span', { class: 'x', text: 'hi' }, [children])
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (key) {
      var value = attrs[key];
      if (value == null || value === false) return;
      if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;           // static markup only
      else if (key === 'style') Object.keys(value).forEach(function (p) { node.style.setProperty(p, value[p]); });
      else node.setAttribute(key, value === true ? '' : value);
    });
    (children || []).forEach(function (child) { if (child) node.appendChild(child); });
    return node;
  }

  function normalize(text) {
    return String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function init(options) {
    var root = options.root;
    var F = options.franchises;
    var D = options.dynasty;
    var saves = options.saves;
    var RULES = D.LEAGUE_RULES;

    var $ = function (sel) { return root.querySelector(sel); };
    var $$ = function (sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); };

    var steps = $$('.nd-step');
    var current = 1;

    /* ------------------------------------------------------------------
       STEP 1 — League Setup
       ------------------------------------------------------------------ */
    var form = $('form.nd-step[data-step="1"]');
    var inputs = {
      leagueName: $('#nd-league-name'),
      gmName: $('#nd-gm-name'),
      inauguralYear: $('#nd-start-year')
    };
    var submitted = false;   // live re-validation only after the first attempt

    // The selected year is the year the inaugural season ENDS.
    $('[data-year-hint]').textContent =
      'The year your first season ends: ' + RULES.defaultInauguralYear + ' starts the ' +
      window.HDSeason.fromInauguralYear(RULES.defaultInauguralYear).label + ' season. Any year from ' +
      RULES.minInauguralYear + ' to ' + RULES.maxInauguralYear + '.';

    // League structure summary is computed from the data, not hardcoded.
    (function renderStructure() {
      var counts = {};
      F.FRANCHISES.forEach(function (t) { counts[t.conference] = (counts[t.conference] || 0) + 1; });
      $('[data-structure="teams"]').textContent = F.FRANCHISES.length;
      $('[data-structure="conferences"]').textContent = F.CONFERENCES.length;
      var list = $('[data-structure="list"]');
      list.textContent = '';
      F.CONFERENCES.forEach(function (c) {
        list.appendChild(el('li', null, [
          el('span', { text: c.name }),
          el('span', { text: counts[c.id] + ' teams' })
        ]));
      });
    })();

    function setupValues() {
      return {
        leagueName: inputs.leagueName.value,
        gmName: inputs.gmName.value,
        inauguralYear: inputs.inauguralYear.value
      };
    }

    function showErrors(errors, only) {
      Object.keys(inputs).forEach(function (field) {
        if (only && only !== field) return;
        var msg = errors[field] || '';
        inputs[field].setAttribute('aria-invalid', msg ? 'true' : 'false');
        $('[data-error-for="' + field + '"]').textContent = msg;
      });
    }

    function updateSeasonLabel() {
      var year = D.parseYear(inputs.inauguralYear.value);
      var ok = !isNaN(year) && year >= RULES.minInauguralYear && year <= RULES.maxInauguralYear;
      var season = ok ? window.HDSeason.fromInauguralYear(year) : null;
      $('[data-season-label]').textContent = season ? season.label : '—';
      $('[data-season-start]').textContent = season ? '· preseason begins ' + window.HDSeason.openingMonthLabel(season.startYear) : '';
    }

    function setupIsValid() {
      return D.validateSetup(setupValues()).valid && D.validateRules(rulesValues()).valid;
    }

    Object.keys(inputs).forEach(function (field) {
      inputs[field].addEventListener('input', function () {
        if (field === 'inauguralYear') {
          // digits only, max 4
          var digits = inputs.inauguralYear.value.replace(/\D/g, '').slice(0, 4);
          if (digits !== inputs.inauguralYear.value) inputs.inauguralYear.value = digits;
          updateSeasonLabel();
        }
        if (submitted) showErrors(D.validateSetup(setupValues()).errors, field);
      });
      inputs[field].addEventListener('blur', function () {
        if (submitted) showErrors(D.validateSetup(setupValues()).errors, field);
      });
    });

    $$('[data-year-step]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var year = D.parseYear(inputs.inauguralYear.value);
        if (isNaN(year)) year = RULES.defaultInauguralYear;
        else year += Number(btn.getAttribute('data-year-step'));
        year = Math.min(RULES.maxInauguralYear, Math.max(RULES.minInauguralYear, year));
        inputs.inauguralYear.value = String(year);
        updateSeasonLabel();
        if (submitted) showErrors(D.validateSetup(setupValues()).errors, 'inauguralYear');
      });
    });

    /* --- Tabs: League Details | League Rules ------------------------- */
    var tabs = $$('.nd-tab');
    function selectTab(name, focus) {
      tabs.forEach(function (t) {
        var on = t.getAttribute('data-tab') === name;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        $('#' + t.getAttribute('aria-controls')).hidden = !on;
        if (on && focus) t.focus();
      });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { selectTab(t.getAttribute('data-tab')); });
      t.addEventListener('keydown', function (e) {
        var next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        selectTab(tabs[(next + tabs.length) % tabs.length].getAttribute('data-tab'), true);
      });
    });

    /* --- League Rules -------------------------------------------------- */
    var O = D.RULE_OPTIONS;
    var ruleEls = {
      seasonGames: $('[data-rule="seasonGames"]'),
      playoffFormat: $('[data-rule="playoffFormat"]'),
      rosterSize: $('[data-rule="rosterSize"]'),
      salaryCapM: $('[data-rule="salaryCapM"]'),
      luxuryTaxM: $('[data-rule="luxuryTaxM"]')
    };
    O.seasonGames.forEach(function (n) {
      ruleEls.seasonGames.appendChild(el('option', { value: String(n), text: n + ' games' + (n === D.DEFAULT_RULES.seasonGames ? ' (standard)' : '') }));
    });
    Object.keys(O.playoffFormat).forEach(function (k) {
      ruleEls.playoffFormat.appendChild(el('option', { value: k, text: O.playoffFormat[k].label }));
    });
    function segmented(group, name, items) {
      var box = $('[data-rule-group="' + group + '"]');
      items.forEach(function (it) {
        box.appendChild(el('label', null, [
          el('input', { type: 'radio', name: name, value: it.value }),
          el('span', { text: it.label })
        ]));
      });
    }
    segmented('seriesLength', 'nd-series', O.seriesLength.map(function (n) { return { value: String(n), label: 'Best of ' + n }; }));
    segmented('difficulty', 'nd-difficulty', Object.keys(O.difficulty).map(function (k) { return { value: k, label: O.difficulty[k].label }; }));
    $('[data-roster-hint]').textContent = 'Players per team, ' + O.rosterSize.min + '–' + O.rosterSize.max + '. Rosters are generated at this size.';

    function checked(name) {
      var r = root.querySelector('input[name="' + name + '"]:checked');
      return r ? r.value : null;
    }
    function rulesValues() {
      return {
        seasonGames: ruleEls.seasonGames.value,
        playoffFormat: ruleEls.playoffFormat.value,
        seriesLength: checked('nd-series'),
        difficulty: checked('nd-difficulty'),
        rosterSize: ruleEls.rosterSize.value,
        salaryCapM: ruleEls.salaryCapM.value,
        luxuryTaxM: ruleEls.luxuryTaxM.value
      };
    }
    function setRules(r) {
      ruleEls.seasonGames.value = String(r.seasonGames);
      ruleEls.playoffFormat.value = r.playoffFormat;
      root.querySelector('input[name="nd-series"][value="' + r.seriesLength + '"]').checked = true;
      root.querySelector('input[name="nd-difficulty"][value="' + r.difficulty + '"]').checked = true;
      ruleEls.rosterSize.value = String(r.rosterSize);
      ruleEls.salaryCapM.value = (r.salaryCap / 1e6).toFixed(1);
      ruleEls.luxuryTaxM.value = (r.luxuryTax / 1e6).toFixed(1);
      showRuleErrors({});
      updateRuleDetails();
    }
    var RULE_ERROR_INPUT = { rosterSize: 'rosterSize', salaryCap: 'salaryCapM', luxuryTax: 'luxuryTaxM' };
    function showRuleErrors(errors) {
      Object.keys(RULE_ERROR_INPUT).forEach(function (k) {
        var msg = errors[k] || '';
        $('[data-rule-error="' + k + '"]').textContent = msg;
        ruleEls[RULE_ERROR_INPUT[k]].setAttribute('aria-invalid', msg ? 'true' : 'false');
      });
    }
    function updateRuleDetails() {
      var v = rulesValues();
      $('[data-rule-detail="playoffFormat"]').textContent = (O.playoffFormat[v.playoffFormat] || {}).detail || '';
      $('[data-rule-detail="difficulty"]').textContent = (O.difficulty[v.difficulty] || {}).detail || '';
      // "Custom" badge on the tab when anything differs from the defaults
      var check = D.validateRules(v);
      var def = D.DEFAULT_RULES;
      var custom = !check.valid || Object.keys(def).some(function (k) { return check.values[k] !== def[k]; });
      $('[data-rules-badge]').hidden = !custom;
    }
    $('#nd-panel-rules').addEventListener('input', function (e) {
      if (e.target === ruleEls.rosterSize) {
        var digits = ruleEls.rosterSize.value.replace(/\D/g, '').slice(0, 2);
        if (digits !== ruleEls.rosterSize.value) ruleEls.rosterSize.value = digits;
      }
      if (submitted) showRuleErrors(D.validateRules(rulesValues()).errors);
      updateRuleDetails();
    });
    $('#nd-panel-rules').addEventListener('change', updateRuleDetails);
    $$('[data-roster-step]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var n = parseInt(ruleEls.rosterSize.value, 10);
        if (isNaN(n)) n = D.DEFAULT_RULES.rosterSize;
        else n += Number(btn.getAttribute('data-roster-step'));
        ruleEls.rosterSize.value = String(Math.min(O.rosterSize.max, Math.max(O.rosterSize.min, n)));
        if (submitted) showRuleErrors(D.validateRules(rulesValues()).errors);
        updateRuleDetails();
      });
    });
    $('[data-rules-reset]').addEventListener('click', function () { setRules(D.DEFAULT_RULES); });

    /* --- "Last used" names ---------------------------------------------- */
    var recent = window.HDRecentNames;
    var RECENT_FIELDS = { league: 'leagueName', gm: 'gmName' };
    var RECENT_LABELS = { league: 'league name', gm: 'GM name' };
    function renderRecent(field) {
      var box = $('[data-recent="' + field + '"]');
      var names = recent ? recent.get(field) : [];
      box.textContent = '';
      box.hidden = names.length === 0;
      if (!names.length) return;
      box.appendChild(el('span', { class: 'nd-recent-label', id: 'nd-recent-' + field, text: 'Last used' }));
      var list = el('div', { class: 'nd-recent-list', role: 'group', 'aria-labelledby': 'nd-recent-' + field });
      names.forEach(function (name) {
        list.appendChild(el('button', { class: 'nd-chip', type: 'button', title: name, 'aria-label': 'Use ' + RECENT_LABELS[field] + ' ' + name, text: name, 'data-name': name }));
      });
      list.appendChild(el('button', { class: 'nd-chip-clear', type: 'button', 'aria-label': 'Clear recent ' + RECENT_LABELS[field] + 's', text: 'Clear', 'data-clear': field }));
      box.appendChild(list);
    }
    function renderAllRecent() { renderRecent('league'); renderRecent('gm'); }
    Object.keys(RECENT_FIELDS).forEach(function (field) {
      $('[data-recent="' + field + '"]').addEventListener('click', function (e) {
        var chip = e.target.closest('[data-name]');
        var input = inputs[RECENT_FIELDS[field]];
        if (chip) {
          input.value = chip.getAttribute('data-name');
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.focus();
        } else if (e.target.closest('[data-clear]')) {
          recent.clear(field);
          renderRecent(field);
          input.focus();
        }
      });
    });
    // Seed from existing dynasties (no-op once a list exists), then show
    // the chips. Runs at start-up and every time step 1 is shown.
    function refreshRecent() {
      if (recent && saves && saves.list) {
        return saves.list().then(function (rows) { recent.seedFrom(rows); }).catch(function () {}).then(renderAllRecent);
      }
      renderAllRecent();
      return Promise.resolve();
    }
    refreshRecent();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitted = true;
      var result = D.validateSetup(setupValues());
      var rules = D.validateRules(rulesValues());
      showErrors(result.errors);
      showRuleErrors(rules.errors);
      if (!result.valid) {
        selectTab('details');
        var firstBad = Object.keys(inputs).filter(function (f) { return result.errors[f]; })[0];
        inputs[firstBad].focus();
        return;
      }
      if (!rules.valid) {
        selectTab('rules');
        var badKey = Object.keys(RULE_ERROR_INPUT).filter(function (k) { return rules.errors[k]; })[0];
        if (badKey) ruleEls[RULE_ERROR_INPUT[badKey]].focus();
        return;
      }
      options.navigate(2);
    });

    /* ------------------------------------------------------------------
       STEP 2 — Select Franchise
       ------------------------------------------------------------------ */
    var teamList = $('[data-nd-teams]');
    var nextBtn2 = $('[data-nd-next-2]');
    var searchInput = $('#nd-search');
    var sortSelect = $('#nd-sort');
    var view = { conference: 'all', query: '', sort: 'city' };
    var cards = {};          // franchise id -> <label>
    var selectedId = null;

    function swatches(team, className) {
      var wrap = el('span', { class: 'hd-swatches' + (className ? ' ' + className : ''), 'aria-hidden': 'true' });
      ['primary', 'secondary', 'tertiary'].forEach(function (role) {
        wrap.appendChild(el('span', { class: 'hd-swatch', title: role + ' ' + team.colors[role], style: { '--swatch': team.colors[role] } }));
      });
      return wrap;
    }

    function ovrBlock(team) {
      return el('span', { class: 'nd-team-ovr' }, [
        el('span', { class: 'nd-ovr-num', text: team.overall }),
        el('span', { class: 'nd-ovr-label', text: 'OVR' })
      ]);
    }

    function teamLogo(team, className, size) {
      return el('img', { class: className, src: team.logo.src, alt: '', width: size, height: size, decoding: 'async' });
    }

    function renderTeams() {
      F.FRANCHISES.forEach(function (team) {
        var conf = F.conference(team.conference);
        var market = F.marketSize(team.marketSize);
        var input = el('input', {
          class: 'hd-visually-hidden', type: 'radio', name: 'nd-franchise', value: team.id,
          'aria-label': team.fullName + ', ' + conf.name + ', ' + market.label + ' market, overall ' + team.overall
        });
        var card = el('span', { class: 'hd-option-card nd-team-card', style: { '--team-primary': team.colors.primary } }, [
          teamLogo(team, 'nd-team-logo', 48),
          el('span', { class: 'nd-team-main' }, [
            el('span', { class: 'nd-team-name', text: team.fullName }),
            el('span', { class: 'nd-team-abbr', text: team.abbreviation }),
            el('span', { class: 'nd-team-meta' }, [
              swatches(team),
              el('span', { class: 'nd-team-meta-text', text: conf.shortName + ' · ' + market.label + ' market' })
            ])
          ]),
          el('span', { class: 'nd-col' }, [swatches(team)]),
          el('span', { class: 'nd-col', text: conf.shortName }),
          el('span', { class: 'nd-col', text: market.label }),
          ovrBlock(team),
          el('span', { class: 'hd-check', 'aria-hidden': 'true', html: CHECK_SVG })
        ]);
        var label = el('label', { class: 'hd-option nd-team', 'data-id': team.id }, [input, card]);
        cards[team.id] = label;
        teamList.appendChild(label);
      });
    }

    var SORTS = {
      city: function (a, b) { return a.city.localeCompare(b.city) || a.name.localeCompare(b.name); },
      overall: function (a, b) { return b.overall - a.overall || SORTS.city(a, b); },
      market: function (a, b) {
        return F.marketSize(b.marketSize).rank - F.marketSize(a.marketSize).rank || SORTS.city(a, b);
      }
    };

    function applyView() {
      var q = normalize(view.query.trim());
      var sorted = F.FRANCHISES.slice().sort(SORTS[view.sort]);
      var shown = 0;
      sorted.forEach(function (team) {
        var matchConf = view.conference === 'all' || team.conference === view.conference;
        // Match from the start of any word: "los" finds Los Angeles, not Apollos.
        var matchQuery = !q || [team.fullName, team.abbreviation].some(function (s) {
          var hay = normalize(s);
          return hay.indexOf(q) === 0 || hay.indexOf(' ' + q) !== -1;
        });
        var visible = matchConf && matchQuery;
        var card = cards[team.id];
        card.hidden = !visible;
        teamList.appendChild(card);        // re-append in sorted order (keeps state)
        if (visible) shown++;
      });
      $('[data-nd-empty]').hidden = shown !== 0;
      $('[data-nd-count]').textContent = shown === F.FRANCHISES.length
        ? 'Showing all ' + shown + ' franchises'
        : 'Showing ' + shown + ' of ' + F.FRANCHISES.length + ' franchises';
    }

    function renderSelection() {
      var info = $('[data-nd-selection-info]');
      info.textContent = '';
      var team = selectedId ? F.byId(selectedId) : null;
      nextBtn2.disabled = !team;
      if (!team) {
        info.appendChild(el('span', { class: 'nd-selection-empty', text: 'Select a franchise to continue.' }));
        return;
      }
      info.appendChild(teamLogo(team, '', 40));
      info.appendChild(el('span', { class: 'nd-selection-text' }, [
        el('span', { class: 'hd-eyebrow', text: 'Your franchise' }),
        el('span', { class: 'nd-selection-name', text: team.fullName })
      ]));
      var ovr = ovrBlock(team);
      ovr.classList.add('nd-selection-ovr');
      info.appendChild(ovr);
    }

    teamList.addEventListener('change', function (e) {
      if (e.target.name !== 'nd-franchise') return;
      selectedId = e.target.value;
      renderSelection();
    });

    $$('input[name="nd-conference"]').forEach(function (radio) {
      radio.addEventListener('change', function () { view.conference = radio.value; applyView(); });
    });
    searchInput.addEventListener('input', function () { view.query = searchInput.value; applyView(); });
    sortSelect.addEventListener('change', function () { view.sort = sortSelect.value; applyView(); });

    nextBtn2.addEventListener('click', function () {
      if (selectedId) options.navigate(3);
    });

    /* ------------------------------------------------------------------
       STEP 3 — Confirm Dynasty
       ------------------------------------------------------------------ */
    var review = $('[data-nd-review]');
    var beginBtn = $('[data-nd-begin]');
    var saveError = $('[data-nd-save-error]');

    function renderReview() {
      var setup = D.validateSetup(setupValues()).values;
      var rs = D.rulesSummary(D.validateRules(rulesValues()).values);
      var team = F.byId(selectedId);
      var conf = F.conference(team.conference);
      var market = F.marketSize(team.marketSize);

      review.textContent = '';
      review.style.setProperty('--team-primary', team.colors.primary);

      review.appendChild(el('div', { class: 'nd-review-hero' }, [
        teamLogo(team, 'nd-review-logo', 96),
        el('div', { class: 'nd-review-ident' }, [
          el('p', { class: 'hd-eyebrow', text: 'Your franchise' }),
          el('h2', { class: 'nd-review-name', text: team.fullName }),
          el('p', { class: 'nd-review-sub', text: team.abbreviation + ' · ' + conf.name }),
          el('span', { class: 'nd-tier', text: F.ratingTier(team.overall) })
        ]),
        ovrBlock(team)
      ]));

      var palette = el('ul', { class: 'nd-palette', 'aria-label': 'Team colors' });
      ['primary', 'secondary', 'tertiary'].forEach(function (role) {
        palette.appendChild(el('li', null, [
          el('span', { class: 'hd-swatch', style: { '--swatch': team.colors[role] }, 'aria-hidden': 'true' }),
          el('span', { class: 'nd-palette-text' }, [
            el('span', { class: 'nd-palette-role', text: role.charAt(0).toUpperCase() + role.slice(1) }),
            el('span', { class: 'nd-palette-hex', text: team.colors[role].toUpperCase() })
          ])
        ]));
      });
      review.appendChild(palette);

      var details = [
        ['League', setup.leagueName],
        ['General Manager', setup.gmName],
        ['Inaugural Season', window.HDSeason.fromInauguralYear(setup.inauguralYear).label],
        ['Conference', conf.name],
        ['Market Size', market.label],
        ['Team Overall', team.overall + ' · ' + F.ratingTier(team.overall)],
        ['Season & Playoffs', rs.season + ' · ' + rs.playoffs],
        ['Difficulty & Rosters', rs.difficulty + ' · ' + rs.roster],
        ['Salary Cap / Tax Line', rs.salaryCap + ' / ' + rs.luxuryTax]
      ];
      var dl = el('dl', { class: 'nd-details' });
      details.forEach(function (row) {
        dl.appendChild(el('div', null, [el('dt', { text: row[0] }), el('dd', { text: row[1] })]));
      });
      review.appendChild(dl);
      saveError.textContent = '';
    }

    beginBtn.addEventListener('click', function () {
      if (beginBtn.disabled) return;
      beginBtn.disabled = true;
      var setup = D.validateSetup(setupValues()).values;
      var dyn;
      try {
        dyn = D.createDynasty({
          leagueName: setup.leagueName,
          gmName: setup.gmName,
          inauguralYear: String(setup.inauguralYear),
          franchiseId: selectedId,
          rules: rulesValues()
        }, F);
      } catch (err) {
        saveError.textContent = 'Something went wrong creating the dynasty. Please go back and check your setup.';
        beginBtn.disabled = false;
        return;
      }
      saves.create(dyn).then(function () {
        // Only remembered once the dynasty is safely saved.
        if (recent) { recent.remember('league', setup.leagueName); recent.remember('gm', setup.gmName); }
        options.onComplete(dyn);
      }).catch(function (err) {
        // Persistence failed: say so, keep the user's choices, allow retry.
        saveError.textContent = 'Your dynasty wasn’t saved. ' + (err && err.message ? err.message : '');
        beginBtn.disabled = false;
      });
    });

    $('[data-nd-prev]').addEventListener('click', function () { options.back(); });
    $('[data-nd-back]').addEventListener('click', function () { options.back(); });

    /* ------------------------------------------------------------------
       Step switching
       ------------------------------------------------------------------ */
    function allowedStep(step) {
      step = Math.max(1, Math.min(3, Number(step) || 1));
      if (step > 1 && !setupIsValid()) return 1;
      if (step > 2 && !selectedId) return 2;
      return step;
    }

    function show(step) {
      step = allowedStep(step);
      current = step;
      steps.forEach(function (s) { s.hidden = Number(s.getAttribute('data-step')) !== step; });
      $$('.nd-progress-step').forEach(function (li) {
        var n = Number(li.getAttribute('data-progress'));
        li.classList.toggle('is-done', n < step);
        if (n === step) li.setAttribute('aria-current', 'step');
        else li.removeAttribute('aria-current');
      });
      if (step === 1) refreshRecent();        // names may have changed since last visit
      if (step === 3) renderReview();
      if (step === 3) beginBtn.disabled = false;
      root.scrollTop = 0;
      var title = $('.nd-step[data-step="' + step + '"] [data-step-title]');
      if (title) title.focus({ preventScroll: true });
      return step;
    }

    function reset() {
      form.reset();
      inputs.inauguralYear.value = String(RULES.defaultInauguralYear);
      submitted = false;
      showErrors({});
      setRules(D.DEFAULT_RULES);
      selectTab('details');
      renderAllRecent();
      updateSeasonLabel();
      selectedId = null;
      $$('input[name="nd-franchise"]').forEach(function (r) { r.checked = false; });
      view = { conference: 'all', query: '', sort: 'city' };
      $('input[name="nd-conference"][value="all"]').checked = true;
      searchInput.value = '';
      sortSelect.value = 'city';
      applyView();
      renderSelection();
      saveError.textContent = '';
    }

    renderTeams();
    reset();

    return { show: show, reset: reset, current: function () { return current; } };
  }

  window.HDNewDynasty = { init: init };
})();
