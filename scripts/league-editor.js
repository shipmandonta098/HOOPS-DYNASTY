/* ==========================================================================
   HOOPS DYNASTY — Customize League dialog (New Dynasty → Select Franchise)
   Lists every team in the league being set up, with Edit and Delete, and a
   Add Team view (ready-made expansion franchises, or a custom team built
   from scratch) and a full team editor: city (+ Relocate), team name, abbreviation, division,
   population (drives market size), arena name & capacity, primary and
   secondary logos (upload from the device or an image URL), and colors.

   The wizard owns the team list; this dialog edits a working copy and
   reports every committed change through onChange(teams).

   HDLeagueEditor.init({ dialog, onChange }) ->
     { open(teams, { minPerConference, selectedId }), close() }
   ========================================================================== */
(function () {
  'use strict';

  var dom = window.HDDom;
  var el = dom.el;
  var T = window.HDTeams;
  var F = window.HDFranchises;

  var LOGO_MAX_PX = 256;     // uploads are scaled to fit this square

  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function marketLabel(pop) { var m = F.marketSize(F.marketSizeFor(pop)); return m ? m.label : '—'; }

  // Image file (photo library, camera roll, files…) -> small data URL
  function fileToLogo(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('Choose an image file (PNG, JPG, SVG, WebP or GIF).')); return; }
      if (file.size > 20 * 1024 * 1024) { reject(new Error('That image is too large (20 MB max).')); return; }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth || LOGO_MAX_PX, h = img.naturalHeight || LOGO_MAX_PX;
        var scale = Math.min(1, LOGO_MAX_PX / Math.max(w, h));
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        var data = canvas.toDataURL('image/png');
        if (data.length > T.LIMITS.logoDataMax) data = canvas.toDataURL('image/webp', 0.9);
        if (data.length > T.LIMITS.logoDataMax) data = canvas.toDataURL('image/jpeg', 0.85);
        if (!T.isLogoRef(data)) { reject(new Error('That image couldn’t be used. Try a smaller one.')); return; }
        resolve(data);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('That file couldn’t be read as an image.')); };
      img.src = url;
    });
  }

  // Check an image URL actually loads before using it
  function checkUrl(url) {
    return new Promise(function (resolve, reject) {
      url = String(url || '').trim();
      if (!/^https?:\/\//i.test(url)) { reject(new Error('Enter an image link starting with http:// or https://')); return; }
      if (!T.isLogoRef(url)) { reject(new Error('That link can’t be used as a logo.')); return; }
      var img = new Image();
      var timer = setTimeout(function () { img.src = ''; reject(new Error('That image took too long to load.')); }, 12000);
      img.onload = function () { clearTimeout(timer); resolve(url); };
      img.onerror = function () { clearTimeout(timer); reject(new Error('Couldn’t load an image from that link.')); };
      img.src = url;
    });
  }

  function init(options) {
    var dialog = options.dialog;
    var body = dialog.querySelector('[data-le-body]');
    var title = dialog.querySelector('[data-le-title]');
    var teams = [];
    var opts = {};
    var returnFocus = null;
    var listScroll = 0;

    function commit(next) {
      teams = next;
      options.onChange(teams.map(T.copy));
    }

    function confCount(confId, list) {
      return (list || teams).filter(function (t) { return T.normalize(t).conference === confId; }).length;
    }

    /* --- List view -------------------------------------------------------- */

    function renderList(focusId, notice) {
      title.textContent = 'Customize League';
      body.textContent = '';
      var counts = F.CONFERENCES.map(function (c) { return c.shortName + ' ' + confCount(c.id); }).join(' · ');
      body.appendChild(el('div', { class: 'le-intro' }, [
        el('p', { class: 'le-lead', text: 'Edit, relocate or delete any team before your league is created.' }),
        el('p', { class: 'le-counts', role: 'status', text: (notice ? notice + ' ' : '') + teams.length + ' teams · ' + counts })
      ]));
      var custom = T.isCustomized(teams);
      var full = teams.length >= T.LIMITS.maxTeams;
      body.appendChild(el('div', { class: 'le-list-actions' }, [
        el('div', { class: 'le-list-actions-start' }, [
          el('button', { class: 'hd-btn', type: 'button', 'data-le-add': '', disabled: full, text: '+ Add team' }),
          el('button', { class: 'hd-btn', type: 'button', 'data-le-restore': '', disabled: !custom, text: 'Restore default teams' })
        ]),
        el('button', { class: 'hd-btn is-primary', type: 'button', 'data-le-done': '', text: 'Done' })
      ]));
      if (full) body.appendChild(el('p', { class: 'le-row-note', text: 'The league is full (' + T.LIMITS.maxTeams + ' teams).' }));

      F.DIVISIONS.forEach(function (div) {
        var inDiv = teams.filter(function (t) { return t.division === div.id; })
          .sort(function (a, b) { return T.fullName(a).localeCompare(T.fullName(b)); });
        var conf = F.conference(div.conference);
        var section = el('section', { class: 'le-division', 'aria-label': div.name });
        section.appendChild(el('h3', { class: 'hd-eyebrow le-division-title', text: conf.shortName + ' · ' + div.name + ' (' + inDiv.length + ')' }));
        if (!inDiv.length) section.appendChild(el('p', { class: 'le-empty', text: 'No teams in this division.' }));
        var ul = el('ul', { class: 'le-rows' });
        inDiv.forEach(function (t) { ul.appendChild(row(t)); });
        section.appendChild(ul);
        body.appendChild(section);
      });

      if (focusId) {
        var target = body.querySelector('[data-le-edit="' + focusId + '"]');
        if (target) target.focus({ preventScroll: false });
      }
    }

    function row(t, confirming) {
      var n = T.normalize(t);
      var atMin = confCount(n.conference) <= T.LIMITS.minPerConference;
      var li = el('li', { class: 'le-row' + (confirming ? ' is-confirming' : ''), 'data-team': t.id, style: { '--team-primary': n.colors.primary } });
      li.appendChild(el('img', { class: 'le-row-logo', src: n.logo, alt: '', width: 40, height: 40, decoding: 'async' }));
      li.appendChild(el('span', { class: 'le-row-main' }, [
        el('span', { class: 'le-row-name', text: T.fullName(n) }),
        el('span', { class: 'le-row-meta', text: n.abbreviation + ' · ' + marketLabel(n.population) + ' market · ' + n.arenaName })
      ]));
      if (confirming) {
        li.appendChild(el('span', { class: 'le-confirm', role: 'group', 'aria-label': 'Confirm delete' }, [
          el('span', { class: 'le-confirm-text', text: 'Delete the ' + T.fullName(n) + '?' }),
          el('button', { class: 'hd-btn is-danger', type: 'button', 'data-le-delete-yes': t.id, text: 'Delete' }),
          el('button', { class: 'hd-btn', type: 'button', 'data-le-delete-no': t.id, text: 'Cancel' })
        ]));
      } else {
        li.appendChild(el('span', { class: 'le-row-actions' }, [
          el('button', { class: 'hd-btn', type: 'button', 'data-le-edit': t.id, 'aria-label': 'Edit ' + T.fullName(n), text: 'Edit' }),
          el('button', {
            class: 'hd-btn is-danger', type: 'button', 'data-le-delete': t.id,
            'aria-label': 'Delete ' + T.fullName(n), disabled: atMin,
            title: atMin ? 'Each conference needs at least ' + T.LIMITS.minPerConference + ' teams.' : null,
            text: 'Delete'
          })
        ]));
      }
      if (atMin && !confirming) li.appendChild(el('span', { class: 'le-row-note', text: 'Each conference needs at least ' + T.LIMITS.minPerConference + ' teams.' }));
      return li;
    }

    /* --- Add Team view ------------------------------------------------------ */

    function renderAdd(notice) {
      title.textContent = 'Add Team';
      body.textContent = '';
      body.appendChild(el('button', { class: 'hd-btn is-quiet le-back', type: 'button', 'data-le-back': '' }, [
        el('span', { class: 'hd-icon', 'aria-hidden': 'true', html: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3 5 8l5 5"/></svg>' }),
        el('span', { text: 'All teams' })
      ]));
      var avail = T.availableExpansion(teams);
      var room = T.LIMITS.maxTeams - teams.length;
      body.appendChild(el('div', { class: 'le-intro' }, [
        el('p', { class: 'le-lead', text: 'Add a ready-made expansion franchise, or build a team from scratch. You can edit any team after adding it.' }),
        el('p', { class: 'le-counts', role: 'status', text: (notice ? notice + ' ' : '') + teams.length + ' teams in the league · room for ' + room + ' more' })
      ]));
      body.appendChild(el('div', { class: 'le-list-actions' }, [
        el('button', { class: 'hd-btn', type: 'button', 'data-le-custom': '', disabled: room < 1, text: 'Create a custom team' }),
        avail.length > 1 ? el('button', { class: 'hd-btn', type: 'button', 'data-le-add-all': '', disabled: room < avail.length,
          title: room < avail.length ? 'Not enough room for all of them' : null, text: 'Add all ' + avail.length }) : null
      ]));
      body.appendChild(el('h3', { class: 'hd-eyebrow le-division-title', text: 'Expansion franchises (' + avail.length + ')' }));
      if (!avail.length) {
        body.appendChild(el('p', { class: 'le-empty', text: 'Every expansion franchise is already in the league.' }));
        return;
      }
      var ul = el('ul', { class: 'le-rows' });
      avail.forEach(function (f) {
        var div = F.division(f.division);
        var shared = T.sameMarket(f, teams);
        var li = el('li', { class: 'le-row', 'data-exp': f.id, style: { '--team-primary': f.colors.primary } }, [
          el('img', { class: 'le-row-logo', src: f.logo.src, alt: '', width: 40, height: 40, decoding: 'async' }),
          el('span', { class: 'le-row-main' }, [
            el('span', { class: 'le-row-name', text: f.fullName }),
            el('span', { class: 'le-row-meta', text: f.abbreviation + ' · ' + div.name + ' · ' + marketLabel(f.population) + ' market (' + fmt(f.population) + ') · ' + f.arena.name })
          ]),
          el('span', { class: 'le-row-actions' }, [
            el('button', { class: 'hd-btn is-primary', type: 'button', 'data-le-add-exp': f.id, 'aria-label': 'Add the ' + f.fullName, disabled: room < 1, text: 'Add' })
          ]),
          shared.length ? el('span', { class: 'le-row-note', text: 'Shares its market with the ' + shared.map(T.fullName).join(' and ') + '.' }) : null
        ]);
        ul.appendChild(li);
      });
      body.appendChild(ul);
    }

    // Adds expansion franchise `id`. If it clashes with the league (e.g. its
    // name or abbreviation is already used), opens it in the editor instead.
    function addExpansion(id) {
      var x = T.expansionTeam(id, teams);
      if (!x) return null;
      if (Object.keys(x.errors).length) { renderEdit(null, x.team); return 'edit'; }
      commit(teams.concat([x.team]));
      return x.team;
    }

    /* --- Edit view -------------------------------------------------------- */

    var draft = null;      // team being edited
    var isNew = false;     // draft is not in the league yet (Save adds it)
    var errors = {};

    function field(id, label, control, hint) {
      return el('div', { class: 'hd-field le-field', 'data-field': id }, [
        el('label', { class: 'hd-label', for: 'le-' + id, text: label }),
        control,
        hint ? el('p', { class: 'hd-hint', id: 'le-' + id + '-hint', text: hint }) : null,
        el('p', { class: 'hd-error', id: 'le-' + id + '-error', 'data-le-error': id })
      ]);
    }

    function input(id, value, attrs) {
      var a = { class: 'hd-input', id: 'le-' + id, type: 'text', value: value == null ? '' : String(value), autocomplete: 'off', 'aria-describedby': 'le-' + id + '-hint le-' + id + '-error', 'data-le-input': id };
      Object.keys(attrs || {}).forEach(function (k) { a[k] = attrs[k]; });
      return el('input', a);
    }

    function renderPreview() {
      var box = body.querySelector('[data-le-preview]');
      if (!box) return;
      var n = T.normalize(draft);
      box.style.setProperty('--c1', n.colors.primary);
      box.style.setProperty('--c2', n.colors.secondary);
      box.style.setProperty('--c3', n.colors.tertiary);
      box.textContent = '';
      box.appendChild(el('img', { class: 'le-preview-logo', src: n.logo, alt: 'Primary logo', width: 72, height: 72 }));
      box.appendChild(el('span', { class: 'le-preview-text' }, [
        el('span', { class: 'hd-eyebrow', text: (F.division(n.division) || {}).name || '' }),
        el('span', { class: 'le-preview-name', text: T.fullName(n) || 'Team name' }),
        el('span', { class: 'le-preview-sub', text: (n.abbreviation || '—') + ' · ' + (n.arenaName || 'Arena') })
      ]));
      if (n.secondaryLogo) box.appendChild(el('img', { class: 'le-preview-logo2', src: n.secondaryLogo, alt: 'Secondary logo', width: 44, height: 44 }));
      box.appendChild(el('span', { class: 'le-preview-band', 'aria-hidden': 'true' }, [el('span'), el('span'), el('span')]));
    }

    function logoBlock(key, label) {
      var isPrimary = key === 'logo';
      var current = draft[key];
      var def = F.byId(draft.franchiseId);
      var defaultSrc = isPrimary && def ? def.logo.src : null;
      var fileInput = el('input', { class: 'hd-visually-hidden', type: 'file', accept: 'image/*', id: 'le-' + key + '-file', 'data-le-file': key, tabindex: '-1' });
      return el('div', { class: 'hd-field le-field le-logo-field', 'data-field': key }, [
        el('span', { class: 'hd-label', id: 'le-' + key + '-label', text: label }),
        el('div', { class: 'le-logo' }, [
          el('span', { class: 'le-logo-preview' + (current ? '' : ' is-empty') }, [
            current ? el('img', { src: current, alt: label, width: 64, height: 64 }) : el('span', { text: 'None' })
          ]),
          el('div', { class: 'le-logo-controls' }, [
            el('div', { class: 'le-logo-buttons' }, [
              el('button', { class: 'hd-btn', type: 'button', 'data-le-upload': key, 'aria-describedby': 'le-' + key + '-label', text: 'Upload image' }),
              fileInput,
              isPrimary
                ? (defaultSrc && current !== defaultSrc ? el('button', { class: 'hd-btn is-quiet', type: 'button', 'data-le-logo-reset': key, text: 'Use default' }) : null)
                : (current ? el('button', { class: 'hd-btn is-quiet', type: 'button', 'data-le-logo-remove': key, text: 'Remove' }) : null)
            ]),
            el('div', { class: 'le-url' }, [
              el('label', { class: 'hd-visually-hidden', for: 'le-' + key + '-url', text: label + ' image link' }),
              el('input', { class: 'hd-input', id: 'le-' + key + '-url', type: 'url', inputmode: 'url', placeholder: 'or paste an image link (https://…)', autocomplete: 'off', spellcheck: 'false', 'aria-describedby': 'le-' + key + '-error' }),
              el('button', { class: 'hd-btn', type: 'button', 'data-le-url': key, text: 'Use link' })
            ])
          ])
        ]),
        el('p', { class: 'hd-hint', text: isPrimary ? 'Square images look best. Uploads are resized to ' + LOGO_MAX_PX + ' px.' : 'Optional alternate mark.' }),
        el('p', { class: 'hd-error', id: 'le-' + key + '-error', 'data-le-error': key, role: 'alert' })
      ]);
    }

    function colorField(role) {
      var id = role + 'Color';
      var hex = draft.colors[role];
      return el('div', { class: 'hd-field le-field le-color', 'data-field': id }, [
        el('label', { class: 'hd-label', for: 'le-' + id, text: role.charAt(0).toUpperCase() + role.slice(1) + ' color' }),
        el('div', { class: 'le-color-row' }, [
          el('input', { class: 'le-color-swatch', type: 'color', value: hex.toLowerCase(), 'data-le-color': role, 'aria-label': role + ' color picker' }),
          input(id, hex.toUpperCase(), { maxlength: '7', spellcheck: 'false', 'data-le-hex': role })
        ]),
        el('p', { class: 'hd-error', id: 'le-' + id + '-error', 'data-le-error': id })
      ]);
    }

    function divisionSelect() {
      var sel = el('select', { class: 'hd-select', id: 'le-division', 'data-le-input': 'division', 'aria-describedby': 'le-division-hint le-division-error' });
      F.CONFERENCES.forEach(function (c) {
        var group = el('optgroup', { label: c.name });
        F.DIVISIONS.filter(function (d) { return d.conference === c.id; }).forEach(function (d) {
          group.appendChild(el('option', { value: d.id, text: d.name, selected: d.id === draft.division }));
        });
        sel.appendChild(group);
      });
      return el('div', { class: 'hd-select-wrap' }, [sel]);
    }

    function relocatePanel() {
      var cities = T.relocationCities().filter(function (c) { return c.city !== draft.city; });
      var sel = el('select', { class: 'hd-select', id: 'le-reloc-city', 'data-le-reloc-city': '' }, [
        el('option', { value: '', text: 'Choose a city…' })
      ].concat(cities.map(function (c) {
        return el('option', { value: c.city, 'data-pop': String(c.population), text: c.city + ' — ' + fmt(c.population) + ' (' + marketLabel(c.population) + ')' });
      })).concat([el('option', { value: '__other', text: 'Other city…' })]));
      return el('div', { class: 'le-reloc', 'data-le-reloc': '', role: 'group', 'aria-labelledby': 'le-reloc-title' }, [
        el('p', { class: 'le-reloc-title', id: 'le-reloc-title', text: 'Relocate the ' + T.fullName(draft) }),
        el('div', { class: 'hd-select-wrap' }, [sel]),
        el('div', { class: 'le-reloc-other', 'data-le-reloc-other': '', hidden: true }, [
          el('label', { class: 'hd-label', for: 'le-reloc-name', text: 'City' }),
          el('input', { class: 'hd-input', id: 'le-reloc-name', type: 'text', maxlength: String(T.LIMITS.cityMax), autocomplete: 'off' }),
          el('label', { class: 'hd-label', for: 'le-reloc-pop', text: 'Metro population' }),
          el('input', { class: 'hd-input', id: 'le-reloc-pop', type: 'text', inputmode: 'numeric', autocomplete: 'off', placeholder: 'e.g. 2,500,000' })
        ]),
        el('p', { class: 'hd-error', 'data-le-reloc-error': '', role: 'alert' }),
        el('div', { class: 'le-reloc-actions' }, [
          el('button', { class: 'hd-btn is-primary', type: 'button', 'data-le-reloc-go': '', text: 'Relocate' }),
          el('button', { class: 'hd-btn', type: 'button', 'data-le-reloc-cancel': '', text: 'Cancel' })
        ])
      ]);
    }

    function renderEdit(teamId, newTeam) {
      var original = newTeam || teams.filter(function (t) { return t.id === teamId; })[0];
      if (!original) { renderList(); return; }
      isNew = !!newTeam;
      draft = T.copy(original);
      errors = {};
      title.textContent = isNew ? 'New Team' : 'Edit Team';
      body.textContent = '';
      body.appendChild(el('button', { class: 'hd-btn is-quiet le-back', type: 'button', 'data-le-back': '' }, [
        el('span', { class: 'hd-icon', 'aria-hidden': 'true', html: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3 5 8l5 5"/></svg>' }),
        el('span', { text: 'All teams' })
      ]));
      body.appendChild(el('div', { class: 'le-preview', 'data-le-preview': '' }));

      var form = el('form', { class: 'le-form', novalidate: true, 'data-le-form': '' });

      var identity = el('fieldset', { class: 'le-group' }, [el('legend', { class: 'hd-eyebrow', text: 'Identity' })]);
      identity.appendChild(field('city', 'City', el('div', { class: 'le-city-row' }, [
        input('city', draft.city, { maxlength: String(T.LIMITS.cityMax) }),
        el('button', { class: 'hd-btn', type: 'button', 'data-le-relocate': '', 'aria-expanded': 'false', text: 'Relocate' })
      ]), 'Edit to rename the city, or relocate to move the team to a new market.'));
      identity.appendChild(field('name', 'Team name', input('name', draft.name, { maxlength: String(T.LIMITS.nameMax) })));
      identity.appendChild(field('abbreviation', 'Abbreviation', input('abbreviation', draft.abbreviation, { maxlength: '4', spellcheck: 'false', autocapitalize: 'characters', class: 'hd-input le-abbr' }), '2–4 letters, e.g. ATL.'));
      identity.appendChild(field('division', 'Division', divisionSelect(), 'The division sets the conference.'));
      form.appendChild(identity);

      var market = el('fieldset', { class: 'le-group' }, [el('legend', { class: 'hd-eyebrow', text: 'Market & arena' })]);
      market.appendChild(field('population', 'Population', input('population', fmt(draft.population), { inputmode: 'numeric' }), 'Metro-area population. Sets the market size.'));
      market.appendChild(field('arenaName', 'Arena name', input('arenaName', draft.arenaName, { maxlength: String(T.LIMITS.arenaMax) }), 'Shown on the schedule.'));
      market.appendChild(field('arenaCapacity', 'Stadium capacity', input('arenaCapacity', fmt(draft.arenaCapacity), { inputmode: 'numeric' }), 'Seats for basketball.'));
      form.appendChild(market);

      var brand = el('fieldset', { class: 'le-group' }, [el('legend', { class: 'hd-eyebrow', text: 'Logos & colors' })]);
      brand.appendChild(el('div', { 'data-le-logo-slot': 'logo' }, [logoBlock('logo', 'Primary logo')]));
      brand.appendChild(el('div', { 'data-le-logo-slot': 'secondaryLogo' }, [logoBlock('secondaryLogo', 'Secondary logo')]));
      brand.appendChild(el('div', { class: 'le-colors' }, ['primary', 'secondary', 'tertiary'].map(colorField)));
      form.appendChild(brand);

      form.appendChild(el('div', { class: 'le-form-actions' }, [
        el('button', { class: 'hd-btn', type: 'button', 'data-le-back': '', text: 'Cancel' }),
        el('button', { class: 'hd-btn is-primary', type: 'submit', text: isNew ? 'Add team' : 'Save team' })
      ]));
      body.appendChild(form);
      updatePopulationHint();
      renderPreview();
      dialog.querySelector('.le-sheet').scrollTop = 0;
      if (isNew) {
        // A clash (or a blank custom team) shows what needs fixing right away
        errors = T.validateTeam(draft, teams);
        if (draft.city) showErrors();
        var firstBad = Object.keys(errors)[0];
        var target = firstBad && body.querySelector('#le-' + firstBad);
        if (target) { target.focus(); return; }
      }
      title.focus({ preventScroll: true });
    }

    function parseCount(v) {
      var s = String(v).replace(/[,\s]/g, '');
      return /^\d+$/.test(s) ? Number(s) : NaN;
    }

    function readForm() {
      var get = function (id) { var i = body.querySelector('#le-' + id); return i ? i.value : ''; };
      draft.city = get('city');
      draft.name = get('name');
      draft.abbreviation = get('abbreviation').toUpperCase();
      draft.division = get('division');
      draft.population = parseCount(get('population'));
      draft.arenaName = get('arenaName');
      draft.arenaCapacity = parseCount(get('arenaCapacity'));
      ['primary', 'secondary', 'tertiary'].forEach(function (r) {
        var v = get(r + 'Color').trim();
        draft.colors[r] = v.charAt(0) === '#' ? v : '#' + v;
      });
    }

    function updatePopulationHint() {
      var hint = body.querySelector('#le-population-hint');
      if (!hint) return;
      var pop = parseCount((body.querySelector('#le-population') || {}).value);
      hint.textContent = isNaN(pop) ? 'Metro-area population. Sets the market size.' : 'Market size: ' + marketLabel(pop) + ' (Large from ' + fmt(F.MARKET_SIZES[0].minPopulation) + ', Medium from ' + fmt(F.MARKET_SIZES[1].minPopulation) + ').';
    }

    function showErrors(only) {
      body.querySelectorAll('[data-le-error]').forEach(function (p) {
        var k = p.getAttribute('data-le-error');
        if (only && only !== k) return;
        if (k === 'logo' || k === 'secondaryLogo') { if (!only) p.textContent = errors[k] || ''; return; }
        p.textContent = errors[k] || '';
        var inp = body.querySelector('#le-' + k);
        if (inp) inp.setAttribute('aria-invalid', errors[k] ? 'true' : 'false');
      });
    }

    function setLogo(key, value) {
      draft[key] = value;
      var slot = body.querySelector('[data-le-logo-slot="' + key + '"]');
      slot.textContent = '';
      slot.appendChild(logoBlock(key, key === 'logo' ? 'Primary logo' : 'Secondary logo'));
      renderPreview();
    }

    function logoError(key, msg) {
      var p = body.querySelector('[data-le-error="' + key + '"]');
      if (p) p.textContent = msg || '';
    }

    function save() {
      readForm();
      errors = T.validateTeam(draft, teams);
      showErrors();
      var keys = Object.keys(errors);
      if (keys.length) {
        var first = body.querySelector('#le-' + keys[0]) || body.querySelector('[data-field="' + keys[0] + '"] button');
        if (first) first.focus();
        return;
      }
      var saved = T.normalize(draft);
      if (isNew) {
        commit(teams.concat([saved]));
        isNew = false;
        renderList(saved.id, T.fullName(saved) + ' added to the ' + F.division(saved.division).name + '.');
        return;
      }
      commit(teams.map(function (t) { return t.id === saved.id ? saved : t; }));
      renderList(saved.id, T.fullName(saved) + ' saved.');
    }

    /* --- Relocation ------------------------------------------------------- */

    function toggleRelocate(open) {
      var existing = body.querySelector('[data-le-reloc]');
      var btn = body.querySelector('[data-le-relocate]');
      if (existing) existing.remove();
      btn.setAttribute('aria-expanded', String(!!open));
      if (!open) return;
      readForm();
      var panel = relocatePanel();
      body.querySelector('[data-field="city"]').appendChild(panel);
      panel.querySelector('select').focus();
    }

    function doRelocate() {
      var panel = body.querySelector('[data-le-reloc]');
      var sel = panel.querySelector('[data-le-reloc-city]');
      var err = panel.querySelector('[data-le-reloc-error]');
      var city, pop;
      if (sel.value === '__other') {
        city = panel.querySelector('#le-reloc-name').value.trim().replace(/\s+/g, ' ');
        pop = parseCount(panel.querySelector('#le-reloc-pop').value);
      } else if (sel.value) {
        city = sel.value;
        pop = Number(sel.selectedOptions[0].getAttribute('data-pop'));
      }
      var check = T.validateTeam(Object.assign(T.copy(draft), { city: city || '', population: pop, abbreviation: 'ZZZZ' }), []);
      if (!sel.value) { err.textContent = 'Choose a city.'; sel.focus(); return; }
      if (check.city) { err.textContent = check.city; return; }
      if (check.population) { err.textContent = check.population; return; }
      readForm();
      var from = draft.city;
      draft.city = city;
      draft.population = pop;
      draft.abbreviation = T.suggestAbbreviation(city, teams, draft.id);
      body.querySelector('#le-city').value = city;
      body.querySelector('#le-population').value = fmt(pop);
      body.querySelector('#le-abbreviation').value = draft.abbreviation;
      toggleRelocate(false);
      updatePopulationHint();
      renderPreview();
      var hint = body.querySelector('#le-city-hint');
      hint.textContent = 'Relocating from ' + from + ' to ' + city + ': ' + marketLabel(pop) + ' market, abbreviation ' + draft.abbreviation + '. Save to keep it.';
      body.querySelector('[data-le-relocate]').focus();
    }

    /* --- Events ------------------------------------------------------------ */

    body.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var id;
      if (b.hasAttribute('data-le-done')) { close(); return; }
      if (b.hasAttribute('data-le-restore')) {
        commit(T.defaultLeague());
        renderList(null, 'Default teams restored.');
        body.querySelector('[data-le-done]').focus();
        return;
      }
      if ((id = b.getAttribute('data-le-edit'))) { listScroll = dialog.querySelector('.le-sheet').scrollTop; renderEdit(id); return; }
      if (b.hasAttribute('data-le-add')) { listScroll = dialog.querySelector('.le-sheet').scrollTop; renderAdd(); dialog.querySelector('.le-sheet').scrollTop = 0; title.focus({ preventScroll: true }); return; }
      if (b.hasAttribute('data-le-custom')) {
        var firstDiv = F.DIVISIONS.slice().sort(function (a, c) {
          return teams.filter(function (t) { return t.division === a.id; }).length - teams.filter(function (t) { return t.division === c.id; }).length;
        })[0];
        renderEdit(null, T.newCustomTeam(firstDiv.id));
        return;
      }
      if ((id = b.getAttribute('data-le-add-exp'))) {
        var added = addExpansion(id);
        if (added && added !== 'edit') {
          renderAdd(T.fullName(added) + ' added to the ' + F.division(added.division).name + '.');
          var nextBtn = body.querySelector('[data-le-add-exp]') || body.querySelector('[data-le-back]');
          nextBtn.focus({ preventScroll: true });
        }
        return;
      }
      if (b.hasAttribute('data-le-add-all')) {
        var count = 0, clash = null;
        T.availableExpansion(teams).forEach(function (f) {
          if (clash || teams.length >= T.LIMITS.maxTeams) return;
          var x = T.expansionTeam(f.id, teams);
          if (Object.keys(x.errors).length) { clash = x.team; return; }
          teams = teams.concat([x.team]);
          count++;
        });
        commit(teams);
        if (clash) { renderEdit(null, clash); return; }
        renderList(null, count + ' expansion team' + (count === 1 ? '' : 's') + ' added.');
        body.querySelector('[data-le-done]').focus({ preventScroll: true });
        return;
      }
      if ((id = b.getAttribute('data-le-delete'))) {
        var li = body.querySelector('.le-row[data-team="' + id + '"]');
        var t = teams.filter(function (x) { return x.id === id; })[0];
        var next = row(t, true);
        li.replaceWith(next);
        next.querySelector('[data-le-delete-no]').focus();
        return;
      }
      if ((id = b.getAttribute('data-le-delete-no'))) {
        var li2 = body.querySelector('.le-row[data-team="' + id + '"]');
        var t2 = teams.filter(function (x) { return x.id === id; })[0];
        var back = row(t2, false);
        li2.replaceWith(back);
        back.querySelector('[data-le-delete]').focus();
        return;
      }
      if ((id = b.getAttribute('data-le-delete-yes'))) {
        var gone = teams.filter(function (x) { return x.id === id; })[0];
        commit(teams.filter(function (x) { return x.id !== id; }));
        var scroll = dialog.querySelector('.le-sheet').scrollTop;
        renderList(null, T.fullName(gone) + ' deleted.');
        dialog.querySelector('.le-sheet').scrollTop = scroll;
        body.querySelector('[data-le-done]').focus({ preventScroll: true });
        return;
      }
      if (b.hasAttribute('data-le-back')) {
        var editedId = draft && !isNew && body.querySelector('[data-le-form]') && draft.id;
        isNew = false;
        renderList();
        dialog.querySelector('.le-sheet').scrollTop = listScroll;
        var again = editedId && body.querySelector('[data-le-edit="' + editedId + '"]');
        if (again) again.focus({ preventScroll: true });
        return;
      }
      if (b.hasAttribute('data-le-relocate')) { toggleRelocate(b.getAttribute('aria-expanded') !== 'true'); return; }
      if (b.hasAttribute('data-le-reloc-cancel')) { toggleRelocate(false); body.querySelector('[data-le-relocate]').focus(); return; }
      if (b.hasAttribute('data-le-reloc-go')) { doRelocate(); return; }
      var key;
      if ((key = b.getAttribute('data-le-upload'))) { body.querySelector('[data-le-file="' + key + '"]').click(); return; }
      if ((key = b.getAttribute('data-le-logo-remove'))) { setLogo(key, null); body.querySelector('[data-le-upload="' + key + '"]').focus(); return; }
      if ((key = b.getAttribute('data-le-logo-reset'))) { setLogo(key, F.byId(draft.franchiseId).logo.src); body.querySelector('[data-le-upload="' + key + '"]').focus(); return; }
      if ((key = b.getAttribute('data-le-url'))) {
        var urlInput = body.querySelector('#le-' + key + '-url');
        var k = key;
        b.disabled = true;
        logoError(k, '');
        checkUrl(urlInput.value).then(function (url) {
          setLogo(k, url);
          body.querySelector('[data-le-upload="' + k + '"]').focus();
        }).catch(function (err) {
          b.disabled = false;
          logoError(k, err.message);
          urlInput.setAttribute('aria-invalid', 'true');
          urlInput.focus();
        });
      }
    });

    body.addEventListener('change', function (e) {
      var t = e.target;
      var key = t.getAttribute('data-le-file');
      if (key) {
        var file = t.files && t.files[0];
        if (!file) return;
        logoError(key, '');
        fileToLogo(file).then(function (data) {
          setLogo(key, data);
          body.querySelector('[data-le-upload="' + key + '"]').focus();
        }).catch(function (err) { logoError(key, err.message); });
        return;
      }
      if (t.hasAttribute('data-le-reloc-city')) {
        var other = body.querySelector('[data-le-reloc-other]');
        other.hidden = t.value !== '__other';
        if (!other.hidden) other.querySelector('input').focus();
        return;
      }
      if (t.getAttribute('data-le-input') === 'division') { readForm(); renderPreview(); }
    });

    body.addEventListener('input', function (e) {
      var t = e.target;
      var role = t.getAttribute('data-le-color');
      if (role) {
        body.querySelector('#le-' + role + 'Color').value = t.value.toUpperCase();
      }
      var hexRole = t.getAttribute('data-le-hex');
      if (hexRole) {
        var v = t.value.trim();
        if (v && v.charAt(0) !== '#') v = '#' + v;
        if (/^#[0-9A-Fa-f]{6}$/.test(v)) body.querySelector('[data-le-color="' + hexRole + '"]').value = v.toLowerCase();
      }
      if (t.id === 'le-population') updatePopulationHint();
      if (t.id === 'le-abbreviation') {
        var pos = t.selectionStart;
        t.value = t.value.toUpperCase();
        t.setSelectionRange(pos, pos);
      }
      if (!draft || !body.querySelector('[data-le-form]')) return;
      readForm();
      renderPreview();
      var field = t.getAttribute('data-le-input') || (t.getAttribute('data-le-color') ? t.getAttribute('data-le-color') + 'Color' : null);
      if (field && Object.keys(errors).length) {
        errors = T.validateTeam(draft, teams);
        showErrors(field);
      }
    });

    body.addEventListener('submit', function (e) {
      e.preventDefault();
      save();
    });

    dialog.querySelector('[data-le-close]').addEventListener('click', close);
    dialog.addEventListener('cancel', function (e) {
      // Escape inside the editor goes back to the list first
      if (body.querySelector('[data-le-form]') || title.textContent === 'Add Team') {
        e.preventDefault();
        var editedId = draft && !isNew && draft.id;
        isNew = false;
        renderList(editedId || null);
      }
    });
    dialog.addEventListener('close', function () {
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
      returnFocus = null;
      draft = null;
    });

    function open(list, o) {
      teams = list.map(T.copy);
      opts = o || {};
      returnFocus = document.activeElement;
      renderList();
      if (!dialog.open) dialog.showModal();
      dialog.querySelector('.le-sheet').scrollTop = 0;
      title.focus({ preventScroll: true });
    }

    function close() { if (dialog.open) dialog.close(); }

    return {
      open: open,
      close: close,
      isOpen: function () { return dialog.open; },
      editTeam: function (id) { renderEdit(id); }
    };
  }

  window.HDLeagueEditor = { init: init, fileToLogo: fileToLogo };
})();
