/* ==========================================================================
   HOOPS DYNASTY — Transactions section (player profile)
   A chronological, text-based record of every completed transaction in a
   player's career, in the Basketball-Reference style. Reads the league's
   single transaction log (scripts/transactions.js); descriptions are built
   from the structured records. Styles: styles/transactions.css.

   Names link by permanent id: players open their profile (when the player
   is in the league's records); franchises and draft picks are plain text
   until franchise / draft history screens exist — never a broken link.
   ========================================================================== */
(function () {
  'use strict';

  var dom = window.HDDom;
  var el = dom.el;
  function TX() { return window.HDTransactions; }

  var PREF_KEY = 'hoopsDynasty.transactionsNewestFirst';
  function readPref() { try { return window.localStorage.getItem(PREF_KEY) === '1'; } catch (e) { return false; } }
  function writePref(v) { try { window.localStorage.setItem(PREF_KEY, v ? '1' : '0'); } catch (e) { /* not stored */ } }

  function dateLabel(iso) { return window.HDSeason.formatDate(iso, 'long'); }

  // Segments -> inline nodes (links by id; historical names as recorded)
  function render(save, segs) {
    var known = {};
    (save.players || []).concat(save.retiredPlayers || []).forEach(function (p) { known[p.id] = true; });
    return segs.map(function (s) {
      if (s.player && known[s.player]) {
        return el('button', { class: 'pp-link tx-ref', type: 'button', 'data-player-id': s.player, text: s.text });
      }
      if (s.team) return el('span', { class: 'tx-team', 'data-team-id': s.team, text: s.text });
      if (s.pick) return el('span', { class: 'tx-pick', 'data-pick-id': s.pick, text: s.text });
      if (s.note) return el('span', { class: 'tx-pre', text: s.text });
      return document.createTextNode(s.text);
    });
  }

  // "… Navigators (before the league began)." — the note goes inside the sentence
  function withNote(segs, note) {
    if (!note || !segs.length) return segs;
    var last = segs[segs.length - 1];
    if (last.player || last.team || last.pick || !/\.$/.test(last.text)) return segs.concat([{ text: note, note: true }]);
    return segs.slice(0, -1).concat([{ text: last.text.slice(0, -1) }, { text: note, note: true }, { text: '.' }]);
  }

  function section(ctx) {
    var save = ctx.save, player = ctx.player;
    if (!TX() || !save.transactions) return null;
    var state = { category: 'all', season: 'all', newestFirst: readPref() };
    var root = el('section', { class: 'pp-section pp-transactions', 'aria-labelledby': 'pp-tx-title' });

    function draw() {
      root.textContent = '';
      var all = TX().forPlayer(save, player.id);
      var seasons = all.map(function (t) { return t.seasonYear; }).filter(function (y, i, a) { return y != null && a.indexOf(y) === i; }).sort(function (a, b) { return a - b; });
      var list = TX().forPlayer(save, player.id, {
        category: state.category,
        seasonYear: state.season === 'all' ? null : Number(state.season),
        newestFirst: state.newestFirst
      });

      var catSelect = el('select', { class: 'hd-select tx-select', 'data-tx-category': '', 'aria-label': 'Transaction type' }, TX().CATEGORIES.map(function (c) {
        return el('option', { value: c.id, text: c.label, selected: state.category === c.id });
      }));
      var seasonSelect = seasons.length > 1 ? el('select', { class: 'hd-select tx-select', 'data-tx-season': '', 'aria-label': 'Season' },
        [el('option', { value: 'all', text: 'All Seasons', selected: state.season === 'all' })].concat(seasons.slice().reverse().map(function (y) {
          return el('option', { value: String(y), text: window.HDSeason.label(y), selected: String(y) === state.season });
        }))) : null;

      root.appendChild(el('div', { class: 'cs-head' }, [
        el('h3', { class: 'hd-eyebrow pp-section-title', id: 'pp-tx-title', text: 'Transactions' })
      ]));
      root.appendChild(el('div', { class: 'tx-tools' }, [
        el('div', { class: 'hd-select-wrap' }, [catSelect]),
        seasonSelect ? el('div', { class: 'hd-select-wrap' }, [seasonSelect]) : null,
        el('button', { class: 'tx-sort', type: 'button', 'data-tx-sort': '', 'aria-pressed': state.newestFirst ? 'true' : 'false',
          text: state.newestFirst ? 'Newest first' : 'Oldest first', title: 'Change the order' }),
        el('span', { class: 'tx-count', role: 'status', text: list.length + (list.length === 1 ? ' transaction' : ' transactions') })
      ]));

      if (TX().incomplete(save, player.id)) {
        root.appendChild(el('p', { class: 'cs-note tx-note', role: 'note', text: 'Transaction history may be incomplete for events occurring before the dynasty began.' }));
      }

      if (!list.length) {
        root.appendChild(el('p', { class: 'cs-empty', text: all.length ? 'No transactions match this filter.' : 'No recorded transactions.' }));
        return;
      }
      root.appendChild(el('ol', { class: 'tx-list' }, list.map(function (t) {
        var details = t.type === 'trade' && t.assets && TX().tradeDetails(save, t);
        var multi = details && details.length > 2;
        return el('li', { class: 'tx-item', 'data-tx-id': t.id, 'data-tx-type': t.type }, [
          el('p', { class: 'tx-line' }, [
            el('strong', { class: 'tx-date', text: (t.date ? dateLabel(t.date) : 'Date not recorded') + ':' }),
            document.createTextNode(' ')
          ].concat(render(save, withNote(TX().describe(save, t, player.id), t.preDynasty && t.type !== 'drafted' && t.date ? ' (before the league began)' : '')))),
          multi ? el('details', { class: 'tx-details' }, [
            el('summary', { text: 'Trade details' }),
            el('ul', null, details.map(function (d) { return el('li', null, render(save, d.segs)); }))
          ]) : null
        ]);
      })));
    }

    root.addEventListener('change', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-tx-category')) { state.category = t.value; draw(); root.querySelector('[data-tx-category]').focus(); }
      else if (t.hasAttribute('data-tx-season')) { state.season = t.value; draw(); root.querySelector('[data-tx-season]').focus(); }
    });
    root.addEventListener('click', function (e) {
      if (!e.target.closest('[data-tx-sort]')) return;
      state.newestFirst = !state.newestFirst; writePref(state.newestFirst); draw();
      root.querySelector('[data-tx-sort]').focus();
    });
    draw();
    return root;
  }

  window.HDTransactionsUI = { section: section };
})();
