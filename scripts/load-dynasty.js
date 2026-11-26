/* ==========================================================================
   HOOPS DYNASTY — Load Dynasty screen
   Lists every saved dynasty (from HDSaves) as a franchise-branded card with
   Load / Export / Delete, plus sorting and Import.

   HDLoadScreen.init({
     root,            // #load-dynasty-screen
     saves,           // HDSaves
     dynasty,         // HDDynasty (labels, import parsing)
     onLoad(id),      // -> Promise; opens the dynasty (router + dashboard)
     onNewDynasty(),  // empty-state shortcut
     toast(label, detail)
   }) -> { refresh(options) }
   ========================================================================== */
(function () {
  'use strict';

  var MAX_IMPORT_BYTES = 25 * 1024 * 1024;

  var ICONS = {
    upload: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 11V2.5M4.5 6 8 2.5 11.5 6M2.5 10.5v3h11v-3"/></svg>',
    download: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.5V11M4.5 7.5 8 11l3.5-3.5M2.5 10.5v3h11v-3"/></svg>',
    trash: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.8 6.5v4.5M9.2 6.5v4.5"/></svg>'
  };

  var SORTS = {
    recent:   function (a, b) { return time(b.lastPlayedAt) - time(a.lastPlayedAt); },
    created:  function (a, b) { return time(b.createdAt) - time(a.createdAt); },
    franchise: function (a, b) { return text(a.fullName).localeCompare(text(b.fullName)) || SORTS.recent(a, b); },
    league:   function (a, b) { return text(a.leagueName).localeCompare(text(b.leagueName)) || SORTS.recent(a, b); }
  };

  function time(iso) { return Date.parse(iso) || 0; }
  function text(v) { return String(v || ''); }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (key) {
      var value = attrs[key];
      if (value == null || value === false) return;
      if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;          // static icons only
      else if (key === 'style') Object.keys(value).forEach(function (p) { node.style.setProperty(p, value[p]); });
      else node.setAttribute(key, value === true ? '' : value);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  var dateFmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  var dateTimeFmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  function formatDate(iso, withTime) {
    var t = time(iso);
    return t ? (withTime ? dateTimeFmt : dateFmt).format(new Date(t)) : '—';
  }

  // Values come from saved data; only hex colors reach CSS (validated on save).
  function safeColor(c) { return /^#[0-9A-Fa-f]{6}$/.test(c) ? c : '#808080'; }

  function readFileText(file) {
    if (typeof file.text === 'function') return file.text();
    return new Promise(function (resolve, reject) {             // older Safari
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result)); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsText(file);
    });
  }

  var isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Save a text file to the device. iOS gets the share sheet ("Save to
  // Files") when available; everything else uses a download link.
  function saveTextFile(filename, content) {
    var blob = new Blob([content], { type: 'application/json' });
    if (isIOS && typeof File === 'function' && navigator.canShare) {
      var file = new File([blob], filename, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: filename }).then(
          function () { return 'shared'; },
          function (err) { if (err && err.name === 'AbortError') return 'cancelled'; return download(); }
        );
      }
    }
    return Promise.resolve(download());

    function download() {
      var url = URL.createObjectURL(blob);
      var a = el('a', { href: url, download: filename, rel: 'noopener' });
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      return 'downloaded';
    }
  }

  function init(options) {
    var root = options.root;
    var saves = options.saves;
    var D = options.dynasty;
    var toast = options.toast || function () {};

    var $ = function (sel) { return root.querySelector(sel); };
    var list = $('[data-ld-list]');
    var empty = $('[data-ld-empty]');
    var toolbar = $('[data-ld-toolbar]');
    var countEl = $('[data-ld-count]');
    var sortSelect = $('#ld-sort');
    var fileInput = $('[data-ld-file]');
    var message = $('[data-ld-message]');
    var deleteDialog = $('[data-ld-delete]');
    var dupDialog = $('[data-ld-duplicate]');

    var rows = [];
    var busy = false;
    var pendingDelete = null;
    var pendingImport = null;

    /* --- Messages ------------------------------------------------------- */

    function showMessage(title, details) {
      message.textContent = '';
      message.appendChild(el('div', { class: 'ld-message-body' }, [
        el('p', { class: 'ld-message-title', text: title }),
        details && details.length ? el('ul', { class: 'ld-message-list' }, details.map(function (d) { return el('li', { text: d }); })) : null
      ]));
      var close = el('button', { class: 'hd-btn is-quiet ld-message-close', type: 'button', 'aria-label': 'Dismiss message', text: '✕' });
      close.addEventListener('click', hideMessage);
      message.appendChild(close);
      message.hidden = false;
      message.scrollIntoView({ block: 'nearest' });   // visible even if the list was scrolled
    }
    function hideMessage() { message.hidden = true; message.textContent = ''; }

    /* --- Rendering ------------------------------------------------------ */

    function card(s) {
      var colors = s.colors || {};
      var c1 = safeColor(colors.primary), c2 = safeColor(colors.secondary), c3 = safeColor(colors.tertiary);
      var phase = D.phaseLabel(s.phase);

      var swatches = el('span', { class: 'hd-swatches ld-swatches', role: 'img',
        'aria-label': 'Team colors ' + c1 + ', ' + c2 + ', ' + c3 }, [c1, c2, c3].map(function (c) {
        return el('span', { class: 'hd-swatch', style: { '--swatch': c } });
      }));

      var facts = el('dl', { class: 'ld-facts' }, [
        ['Season', s.seasonLabel],
        ['Phase', phase],
        ['Created', null, el('time', { datetime: s.createdAt, text: formatDate(s.createdAt) })],
        ['Last Played', null, el('time', { datetime: s.lastPlayedAt, text: formatDate(s.lastPlayedAt, true) })]
      ].map(function (f) {
        return el('div', null, [el('dt', { text: f[0] }), f[2] ? el('dd', null, [f[2]]) : el('dd', { text: f[1] })]);
      }));

      var label = s.fullName + ', ' + s.leagueName;
      return el('article', { class: 'ld-card', 'data-id': s.id, 'aria-label': label, style: { '--c1': c1, '--c2': c2, '--c3': c3 } }, [
        el('div', { class: 'hd-team-accent', 'aria-hidden': 'true' }, [el('span'), el('span'), el('span')]),
        el('div', { class: 'ld-card-head' }, [
          el('img', { class: 'ld-logo', src: s.logo, alt: s.fullName + ' logo', width: 56, height: 56, decoding: 'async' }),
          el('div', { class: 'ld-ident' }, [
            el('h2', { class: 'ld-name', text: s.fullName }),
            el('p', { class: 'ld-league', text: s.leagueName }),
            el('p', { class: 'ld-gm' }, [el('span', { class: 'ld-gm-label', text: 'GM ' }), el('span', { text: s.gmName })])
          ]),
          swatches
        ]),
        facts,
        el('div', { class: 'ld-actions' }, [
          el('button', { class: 'hd-btn is-primary ld-load', type: 'button', 'data-act': 'load', 'aria-label': 'Load dynasty: ' + label, text: 'Load Dynasty' }),
          el('button', { class: 'hd-btn ld-export', type: 'button', 'data-act': 'export', 'aria-label': 'Export save: ' + label, html: ICONS.download + '<span>Export Save</span>' }),
          el('button', { class: 'hd-btn is-quiet is-danger ld-delete', type: 'button', 'data-act': 'delete', 'aria-label': 'Delete save: ' + label, html: ICONS.trash + '<span>Delete Save</span>' })
        ])
      ]);
    }

    function render() {
      var sorted = rows.slice().sort(SORTS[sortSelect.value] || SORTS.recent);
      list.textContent = '';
      sorted.forEach(function (s) { list.appendChild(card(s)); });
      var n = rows.length;
      countEl.textContent = n === 1 ? '1 saved dynasty' : n + ' saved dynasties';
      empty.hidden = n !== 0;
      list.hidden = n === 0;
      toolbar.hidden = n === 0;
    }

    /**
     * Reload from storage.
     * options.highlight: id of a card to scroll to and flash (after import)
     * options.focus: 'title' | id-of-next-card-to-focus
     */
    function refresh(opts) {
      opts = opts || {};
      list.setAttribute('aria-busy', 'true');
      return saves.list().then(function (summaries) {
        rows = summaries;
        render();
        if (opts.highlight) {
          var c = list.querySelector('[data-id="' + CSS.escape(opts.highlight) + '"]');
          if (c) {
            c.classList.add('is-highlighted');
            c.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            setTimeout(function () { c.classList.remove('is-highlighted'); }, 2400);
            var btn = c.querySelector('.ld-load');
            if (btn) btn.focus({ preventScroll: true });
          }
        }
      }).catch(function (err) {
        rows = [];
        render();
        showMessage('Saved dynasties couldn’t be read.', [err && err.message ? err.message : 'Storage error.']);
      }).then(function () {
        list.removeAttribute('aria-busy');
      });
    }

    function summaryById(id) {
      for (var i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i];
      return null;
    }

    /* --- Card actions --------------------------------------------------- */

    list.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn || busy) return;
      var id = btn.closest('.ld-card').getAttribute('data-id');
      var act = btn.getAttribute('data-act');
      if (act === 'load') loadDynasty(id, btn);
      else if (act === 'export') exportDynasty(id, btn);
      else if (act === 'delete') askDelete(id);
    });

    function loadDynasty(id, btn) {
      busy = true;
      btn.disabled = true;
      hideMessage();
      Promise.resolve(options.onLoad(id)).catch(function (err) {
        showMessage('This dynasty couldn’t be loaded.', [err && err.message ? err.message : 'Storage error.']);
      }).then(function () {
        busy = false;
        btn.disabled = false;
      });
    }

    function exportDynasty(id, btn) {
      btn.disabled = true;
      saves.exportFile(id).then(function (file) {
        return saveTextFile(file.filename, file.text).then(function (how) {
          if (how !== 'cancelled') toast('Save exported', file.filename);
        });
      }).catch(function (err) {
        showMessage('The save couldn’t be exported.', [err && err.message ? err.message : 'Unknown error.']);
      }).then(function () { btn.disabled = false; });
    }

    /* --- Delete --------------------------------------------------------- */

    function askDelete(id) {
      var s = summaryById(id);
      if (!s) return;
      pendingDelete = s;
      $('[data-ld-delete-team]').textContent = s.fullName;
      $('[data-ld-delete-league]').textContent = s.leagueName;
      deleteDialog.returnValue = '';
      deleteDialog.showModal();
    }

    deleteDialog.addEventListener('close', function () {
      var s = pendingDelete;
      pendingDelete = null;
      if (!s) return;
      if (deleteDialog.returnValue !== 'delete') {
        var keep = list.querySelector('[data-id="' + CSS.escape(s.id) + '"] .ld-delete');
        if (keep) keep.focus();
        return;
      }
      // Work out where focus should land once the card is gone.
      var cards = Array.prototype.slice.call(list.querySelectorAll('.ld-card'));
      var idx = cards.findIndex(function (c) { return c.getAttribute('data-id') === s.id; });
      var neighbor = cards[idx + 1] || cards[idx - 1];
      var neighborId = neighbor ? neighbor.getAttribute('data-id') : null;

      saves.remove(s.id).then(function () {
        toast('Dynasty deleted', s.fullName + ' · ' + s.leagueName);
        return refresh();
      }).then(function () {
        var target = neighborId && list.querySelector('[data-id="' + CSS.escape(neighborId) + '"] .ld-load');
        (target || $('#ld-title')).focus();
      }).catch(function (err) {
        showMessage('The dynasty couldn’t be deleted.', [err && err.message ? err.message : 'Storage error.']);
      });
    });

    /* --- Import --------------------------------------------------------- */

    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-ld-import]')) {
        hideMessage();
        fileInput.value = '';
        fileInput.click();
      } else if (e.target.closest('[data-ld-new]')) {
        options.onNewDynasty();
      }
    });

    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      fileInput.value = '';                       // allow picking the same file again
      if (!file) return;
      if (file.size > MAX_IMPORT_BYTES) {
        showMessage('This file is too large to be a Hoops Dynasty save.');
        return;
      }
      readFileText(file).then(function (content) {
        return saves.parseImport(content);
      }).then(function (dynasty) {
        return saves.has(dynasty.id).then(function (exists) {
          if (exists) askDuplicate(dynasty);
          else doImport(dynasty, 'new');
        });
      }).catch(function (err) {
        if (err && err.name === 'ImportError') showMessage('Import failed: ' + err.message, err.details);
        else showMessage('Import failed: the file couldn’t be read.', [err && err.message ? err.message : '']);
      });
    });

    function askDuplicate(dynasty) {
      pendingImport = dynasty;
      var team = D.userTeam(dynasty);
      var existing = summaryById(dynasty.id);
      $('[data-ld-dup-name]').textContent = (team ? team.fullName : 'This dynasty') + ' · ' + dynasty.league.name;
      $('[data-ld-dup-existing]').textContent = existing
        ? 'Your saved copy was last played ' + formatDate(existing.lastPlayedAt, true) + '.'
        : '';
      dupDialog.returnValue = '';
      dupDialog.showModal();
    }

    dupDialog.addEventListener('close', function () {
      var dynasty = pendingImport;
      pendingImport = null;
      if (!dynasty) return;
      var choice = dupDialog.returnValue;
      if (choice === 'replace' || choice === 'separate') doImport(dynasty, choice);
      else toast('Import cancelled', 'Your saves were not changed');
    });

    function doImport(dynasty, mode) {
      saves.importDynasty(dynasty, mode).then(function (summary) {
        toast(mode === 'replace' ? 'Save replaced' : 'Dynasty imported', summary.fullName + ' · ' + summary.leagueName);
        return refresh({ highlight: summary.id });
      }).catch(function (err) {
        showMessage('Import failed: the dynasty couldn’t be saved.', [err && err.message ? err.message : 'Storage error.']);
      });
    }

    sortSelect.addEventListener('change', render);

    return { refresh: refresh, hideMessage: hideMessage };
  }

  window.HDLoadScreen = { init: init, saveTextFile: saveTextFile };
})();
