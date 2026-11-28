/* ==========================================================================
   HOOPS DYNASTY — transaction log (the single record of roster movement)
   Every completed transaction — draft, signings, options, trades, waivers,
   retirements — is ONE structured record here. Player profiles (the
   Transactions section), Contract History (financial records only), and
   future franchise / league / trade / draft histories all read this log;
   League News references the same events by key.

     save.transactions = { version: 1, items: [ Transaction ] }   (append-only)
     Transaction = {
       id,            stable, unique ('tx-' + hash of key)
       key,           event identifier: one completed event -> one record
       type,          one of TYPES
       date,          in-game ISO date, or null when the date wasn't recorded
       seasonYear,    season (start year) the date falls in, or null
       dynastyId,
       playerIds[],   every player in the event (a trade shares ONE record)
       fromTeamIds[], toTeamIds[], contractIds[], pickIds[],
       money,         { total, years, guaranteed, aav, contractType, options[], firstSeason, lastSeason, salary, amount } | null
       assets,        trades: [ { kind: 'player'|'pick'|'cash', from, to, ... } ] | null
       teamNames,     { teamId: name AT THE TIME } (relocations never rewrite history)
       playerNames,   { playerId: name at the time }
       meta,          { first, preDynasty notes, faStatus, optionSeason, newsKey, ... }
       preDynasty,    true for records reconstructed when the league began
       seq            insertion order (ties on the same date)
     }

   Descriptions are generated from the structure (describe()) as segments
   of text / team / player / pick references, so the UI can link names by
   permanent id while showing the historical name.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var node = typeof module === 'object' && module.exports;
  var api = factory(
    node ? require('./random.js') : root.HDRandom,
    node ? require('./season.js') : root.HDSeason,
    node ? require('./news.js') : root.HDNews
  );
  if (node) module.exports = api;
  else root.HDTransactions = api;
})(typeof self !== 'undefined' ? self : this, function (R, Season, News) {
  'use strict';

  var VERSION = 1;

  var CATEGORIES = [
    { id: 'all', label: 'All Transactions' },
    { id: 'draft', label: 'Draft' },
    { id: 'trades', label: 'Trades' },
    { id: 'contracts', label: 'Contracts' },
    { id: 'free-agency', label: 'Free Agency' },
    { id: 'roster', label: 'Roster Moves' },
    { id: 'retirement', label: 'Retirement' }
  ];

  /* Every planned type. `supported` = a game system creates it today; the
     others are architecture only and are never generated. `financial` =
     shown in Contract History too. */
  function T(label, category, supported, financial) { return { label: label, category: category, supported: supported, financial: financial }; }
  var TYPES = {
    // draft & professional entry
    'drafted': T('Drafted', 'draft', true, false),
    'draft-rights-acquired': T('Draft Rights Acquired', 'draft', false, false),
    'draft-rights-traded': T('Draft Rights Traded', 'draft', false, false),
    'signed-undrafted': T('Signed as Undrafted Free Agent', 'draft', true, true),
    // contracts & free agency
    'signed': T('Signed', 'contracts', true, true),
    'signed-rookie-scale': T('Rookie-Scale Signing', 'contracts', true, true),
    'extension': T('Extension', 'contracts', true, true),
    're-signed': T('Re-Signed', 'free-agency', true, true),
    'signed-free-agent': T('Free-Agent Signing', 'free-agency', true, true),
    'signed-short-term': T('Short-Term Signing', 'contracts', false, true),
    'signed-two-way': T('Two-Way Signing', 'contracts', false, true),
    'player-option-exercised': T('Player Option Exercised', 'contracts', true, true),
    'player-option-declined': T('Player Option Declined', 'contracts', true, true),
    'team-option-exercised': T('Team Option Exercised', 'contracts', true, true),
    'team-option-declined': T('Team Option Declined', 'contracts', true, true),
    'guarantee-activated': T('Guarantee Activated', 'contracts', true, true),
    'qualifying-offer-extended': T('Qualifying Offer Extended', 'free-agency', false, true),
    'qualifying-offer-accepted': T('Qualifying Offer Accepted', 'free-agency', false, true),
    'offer-sheet-signed': T('Offer Sheet Signed', 'free-agency', false, true),
    'offer-sheet-matched': T('Offer Sheet Matched', 'free-agency', false, true),
    'expired': T('Contract Expired', 'free-agency', true, true),
    'renegotiated': T('Renegotiation', 'contracts', false, true),
    'terminated': T('Contract Terminated', 'contracts', true, true),
    // roster movement
    'trade': T('Trade', 'trades', true, true),
    'acquired': T('Acquired', 'trades', true, true),
    'expansion-draft': T('Expansion Draft', 'roster', false, true),
    'waived': T('Waived', 'roster', true, true),
    'claimed': T('Claimed off Waivers', 'roster', true, true),
    'released': T('Released', 'roster', false, true),
    'buyout': T('Buyout', 'roster', true, true),
    'assigned': T('Assigned to Affiliate', 'roster', false, false),
    'recalled': T('Recalled from Affiliate', 'roster', false, false),
    'converted-two-way': T('Converted to Standard Contract', 'roster', false, true),
    // career status
    'retirement-announced': T('Retirement Announced', 'retirement', false, false),
    'retired': T('Retired', 'retirement', true, true),
    'unretired': T('Returned from Retirement', 'retirement', false, false),
    'entered-coaching': T('Entered Coaching', 'retirement', true, false)
  };

  /* --- small helpers ---------------------------------------------------------- */

  function teamById(save, id) { return (save.teams || []).filter(function (t) { return t.id === id; })[0] || null; }
  function playerById(save, id) { return (save.players || []).filter(function (p) { return p.id === id; })[0] || null; }
  function fullName(p) {
    if (!p) return null;
    var base = p.nameOrder === 'surname-first' ? p.lastName + ' ' + p.firstName : p.firstName + ' ' + p.lastName;
    return p.suffix ? base + ' ' + p.suffix : base;
  }
  function uniq(list) { return list.filter(function (v, i) { return v != null && list.indexOf(v) === i; }); }
  function cmp(a, b) { return Season.compareDates(a, b); }

  // Season a date falls in (league year turns over on July 1)
  function seasonOf(iso) {
    var d = Season.parseDate(iso);
    if (!d) return null;
    return d.month >= 7 ? d.year : d.year - 1;
  }

  // League calendar rule: the draft is held on the last Thursday of June.
  function draftDate(year) {
    for (var day = 30; day >= 24; day--) {
      if (new Date(Date.UTC(year, 5, day)).getUTCDay() === 4) return Season.isoDate(year, 6, day);
    }
    return Season.isoDate(year, 6, 26);
  }

  function leagueAbbr(save) {
    var words = String((save.league && save.league.name) || '').split(/\s+/).filter(Boolean);
    return (words.map(function (w) { return w.charAt(0); }).join('').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'LG').slice(0, 4);
  }

  /* --- store ------------------------------------------------------------------ */

  function ensure(save) {
    if (!save.transactions || !Array.isArray(save.transactions.items)) save.transactions = { version: VERSION, items: [] };
    return save.transactions;
  }

  function idFor(key, items) {
    var base = 'tx-' + R.hash(key).toString(36), id = base, n = 1;
    while (items.some(function (t) { return t.id === id; })) id = base + '-' + (n++);
    return id;
  }

  function has(save, key) {
    return !!(save.transactions && save.transactions.items.some(function (t) { return t.key === key; }));
  }
  function get(save, idOrKey) {
    return ((save.transactions && save.transactions.items) || []).filter(function (t) { return t.id === idOrKey || t.key === idOrKey; })[0] || null;
  }

  /**
   * Record one COMPLETED event. Idempotent: an event key is logged once,
   * whatever is reprocessed (reloads, re-simulation, imports).
   * Returns the record, or null if the event was already logged.
   */
  function log(save, input) {
    if (!TYPES[input.type]) throw new Error('Unknown transaction type: ' + input.type);
    if (!input.key) throw new Error('Transactions need an event key');
    var store = ensure(save);
    if (store.items.some(function (t) { return t.key === input.key; })) return null;
    var assets = input.assets || null;
    var playerIds = uniq((input.playerIds || []).concat(assets ? assets.filter(function (a) { return a.kind === 'player'; }).map(function (a) { return a.playerId; }) : []));
    var fromIds = uniq((input.fromTeamIds || []).concat(assets ? assets.map(function (a) { return a.from; }) : []));
    var toIds = uniq((input.toTeamIds || []).concat(assets ? assets.map(function (a) { return a.to; }) : []));
    var teamNames = Object.assign({}, input.teamNames || {});
    fromIds.concat(toIds).concat(assets ? assets.filter(function (a) { return a.originalTeamId; }).map(function (a) { return a.originalTeamId; }) : [])
      .forEach(function (id) { if (!teamNames[id]) { var t = teamById(save, id); if (t) teamNames[id] = t.fullName; } });
    var playerNames = Object.assign({}, input.playerNames || {});
    playerIds.forEach(function (id) { if (!playerNames[id]) { var p = playerById(save, id); if (p) playerNames[id] = fullName(p); } });
    var seq = store.items.reduce(function (m, t) { return Math.max(m, t.seq || 0); }, 0) + 1;
    var tx = {
      id: idFor(input.key, store.items),
      key: input.key,
      type: input.type,
      date: input.date || null,
      seasonYear: input.date ? seasonOf(input.date) : (input.seasonYear == null ? null : input.seasonYear),
      dynastyId: save.id,
      playerIds: playerIds,
      fromTeamIds: fromIds,
      toTeamIds: toIds,
      contractIds: uniq(input.contractIds || []),
      pickIds: uniq((input.pickIds || []).concat(assets ? assets.filter(function (a) { return a.kind === 'pick'; }).map(function (a) { return a.id; }) : [])),
      money: input.money || null,
      assets: assets,
      teamNames: teamNames,
      playerNames: playerNames,
      meta: input.meta || {},
      preDynasty: !!input.preDynasty,
      seq: seq
    };
    store.items.push(tx);
    if (!tx.preDynasty) publishNews(save, tx);
    return tx;
  }

  /* --- League News: significant events only, same event key ------------------ */

  function capOf(save) { return (save.finances && save.finances.config && save.finances.config.salaryCap) || 141000000; }
  function publishNews(save, tx) {
    if (!News || !save.news) return;
    var pid = tx.playerIds[0], team = tx.toTeamIds[0] || tx.fromTeamIds[0];
    var big = tx.money && tx.money.aav >= capOf(save) * 0.15;
    var item = null;
    if (tx.type === 'trade') {
      item = News.record(save, { type: 'trade', key: tx.key, date: tx.date, data: { teamIds: uniq(tx.fromTeamIds.concat(tx.toTeamIds)), playerIds: tx.playerIds, summary: textOf(describe(save, tx, pid)) } });
    } else if ((tx.type === 'signed-free-agent' || tx.type === 're-signed' || tx.type === 'signed') && big && playerById(save, pid)) {
      item = News.record(save, { type: 'signing', key: tx.key, date: tx.date, data: { playerId: pid, teamId: team, terms: textOf(describe(save, tx, pid)) } });
    } else if (tx.type === 'extension' && big && playerById(save, pid)) {
      item = News.record(save, { type: 'extension', key: tx.key, date: tx.date, data: { playerId: pid, teamId: team, terms: textOf(describe(save, tx, pid)) } });
    } else if (tx.type === 'retired' && playerById(save, pid)) {
      var p = playerById(save, pid);
      item = News.record(save, { type: 'retirement', key: tx.key, date: tx.date, data: { playerId: pid, seasons: Math.max(1, (p.experience || 0) + 1) } });
    }
    if (item) tx.meta.newsKey = item.eventKey;
  }

  /* --- formatting -------------------------------------------------------------- */

  var WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  function yearsWord(n) { return (WORDS[n] || String(n)) + '-year'; }
  function ordinal(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function roundWord(r) { return ordinal(r); }
  function money(v) {
    if (typeof v !== 'number' || !isFinite(v)) return null;
    if (v >= 1e6) {
      var m = v / 1e6;
      var txt = m >= 100 ? String(Math.round(m)) : (Math.round(m * 10) / 10).toFixed(1).replace(/\.0$/, '');
      return '$' + txt + ' million';
    }
    return '$' + Math.round(v).toLocaleString('en-US');
  }
  function article(word) { return /^(one|uni|eu)/i.test(word) ? 'a' : /^[aeiou]/i.test(word) ? 'an' : 'a'; }

  function pronoun(save, pid) {
    var p = playerById(save, pid);
    return p && p.gender === 'F' ? 'her' : 'his';
  }

  // Segment builders
  function txt(s) { return { text: s }; }
  function teamRef(tx, id) { return { team: id, text: tx.teamNames[id] || 'a former franchise' }; }
  function playerRef(tx, id) { return { player: id, text: tx.playerNames[id] || 'a player' }; }

  function joinList(parts) {
    // parts: arrays of segments -> "a, b and c"
    var out = [];
    parts.forEach(function (segs, i) {
      if (i > 0) out.push(txt(i === parts.length - 1 ? ' and ' : ', '));
      out.push.apply(out, segs);
    });
    return out;
  }

  function pickSegs(tx, a) {
    var round = a.round === 1 ? 'first-round' : a.round === 2 ? 'second-round' : ordinal(a.round) + '-round';
    if (a.swap) return [txt('the right to swap ' + a.year + ' ' + round + ' draft picks')];
    var segs = [];
    var own = a.originalTeamId && a.originalTeamId !== a.from;
    if (own) { segs.push(txt('the ')); segs.push(teamRef(tx, a.originalTeamId)); segs.push(txt('’s ' + a.year + ' ' + round + ' draft pick')); }
    else segs.push(txt('a ' + a.year + ' ' + round + ' draft pick'));
    if (a.protection) segs.push(txt(' (' + a.protection + ')'));
    return [{ pick: a.id, segs: segs }];
  }
  function flattenPick(list) {
    var out = [];
    list.forEach(function (s) { if (s.segs) { s.segs.forEach(function (x) { out.push(Object.assign({ pick: s.pick }, x)); }); } else out.push(s); });
    return out;
  }
  function assetSegs(tx, a) {
    if (a.kind === 'player') return [playerRef(tx, a.playerId)];
    if (a.kind === 'pick') return flattenPick(pickSegs(tx, a));
    if (a.kind === 'cash') return [txt(a.amount ? money(a.amount) + ' in cash considerations' : 'cash considerations')];
    return [txt('other considerations')];
  }

  function contractTerms(m, kindWord) {
    // "a four-year, $112 million rookie-scale contract"
    var words = [];
    if (m.years) words.push(yearsWord(m.years));
    var head = words.length ? words.join(' ') + ', ' : '';
    var phrase = head + (money(m.total) || '') + (kindWord ? ' ' + kindWord : '') + ' contract';
    phrase = phrase.replace(/,\s+contract$/, ' contract');
    return article(phrase) + ' ' + phrase;
  }
  function contractNotes(m) {
    var notes = [];
    if (m.guaranteed != null && m.total != null && m.guaranteed < m.total) notes.push(money(m.guaranteed) + ' guaranteed');
    (m.options || []).forEach(function (o) { notes.push((o.option === 'team' ? 'team' : 'player') + ' option for ' + Season.label(o.seasonYear)); });
    return notes.length ? ' (' + notes.join('; ') + ')' : '';
  }
  var TYPE_WORD = { 'minimum': 'minimum', 'maximum': 'maximum', 'rookie-scale': 'rookie-scale', 'veteran': null, 'supermax': 'designated veteran', 'two-way': 'two-way', 'short-term': 'short-term' };

  /**
   * Readable description from the player's point of view, as segments:
   *   { text } | { team: id, text } | { player: id, text } | { pick: id, text }
   */
  function describe(save, tx, pid) {
    pid = pid || tx.playerIds[0];
    var his = pronoun(save, pid);
    var to = tx.toTeamIds[0], from = tx.fromTeamIds[0];
    var m = tx.money || {};
    var s = [];
    function team(id) { s.push(txt('the ')); s.push(teamRef(tx, id)); }
    switch (tx.type) {
      case 'drafted': {
        var d = tx.meta;
        s.push(txt('Drafted by ')); team(to);
        s.push(txt(' in the ' + roundWord(d.round) + ' round (' + (d.round === 1 ? ordinal(d.overall) + ' overall pick' : ordinal(d.pick) + ' pick, ' + ordinal(d.overall) + ' overall') + ') of the ' + d.year + ' ' + (d.leagueAbbr || leagueAbbr(save)) + ' Draft.'));
        break;
      }
      case 'signed-undrafted':
        s.push(txt('Signed with ')); team(to); s.push(txt(' as an undrafted free agent'));
        if (m.total != null) s.push(txt(': ' + contractTerms(m, TYPE_WORD[m.contractType]) + contractNotes(m)));
        s.push(txt('.'));
        break;
      case 'signed-rookie-scale':
        s.push(txt('Signed ' + contractTerms(m, 'rookie-scale') + ' with ')); team(to); s.push(txt(contractNotes(m) + '.'));
        break;
      case 'signed':
      case 're-signed':
      case 'signed-free-agent': {
        var lead = tx.type === 're-signed' ? 'Re-signed with ' : 'Signed ';
        if (tx.type === 're-signed') { s.push(txt(lead)); team(to); s.push(txt(': ' + contractTerms(m, TYPE_WORD[m.contractType]) + contractNotes(m) + '.')); }
        else {
          s.push(txt((tx.meta.first ? 'Signed ' + his + ' first professional contract, ' : 'Signed ') + contractTerms(m, TYPE_WORD[m.contractType]) + ' with '));
          team(to);
          s.push(txt((tx.type === 'signed-free-agent' ? ' as a free agent' : '') + contractNotes(m) + '.'));
        }
        break;
      }
      case 'extension':
        s.push(txt('Signed ' + contractTerms(m, null).replace(/ contract$/, ' contract extension') + ' with ')); team(to);
        s.push(txt(', through ' + Season.label(m.lastSeason) + contractNotes(Object.assign({}, m, { guaranteed: null })) + '.'));
        break;
      case 'team-option-exercised':
        team(to); s[0] = txt('The '); s.push(txt(' exercised ' + his + ' team option for the ' + Season.label(tx.meta.optionSeason) + ' season' + (m.salary ? ' (' + money(m.salary) + ')' : '') + '.'));
        break;
      case 'team-option-declined':
        team(to); s[0] = txt('The '); s.push(txt(' declined ' + his + ' team option for the ' + Season.label(tx.meta.optionSeason) + ' season; ' + (his === 'her' ? 'she' : 'he') + ' will become ' + faWords(tx.meta.faStatus) + '.'));
        break;
      case 'player-option-exercised':
        s.push(txt('Exercised ' + his + ' player option with ')); team(to); s.push(txt(' for the ' + Season.label(tx.meta.optionSeason) + ' season' + (m.salary ? ' (' + money(m.salary) + ')' : '') + '.'));
        break;
      case 'player-option-declined':
        s.push(txt('Declined ' + his + ' player option with ')); team(to); s.push(txt(' for the ' + Season.label(tx.meta.optionSeason) + ' season and will become ' + faWords(tx.meta.faStatus) + '.'));
        break;
      case 'guarantee-activated':
        s.push(txt(cap(his) + ' ' + Season.label(tx.meta.optionSeason) + ' salary with ')); team(to); s.push(txt(' became fully guaranteed' + (m.salary ? ' (' + money(m.salary) + ')' : '') + '.'));
        break;
      case 'expired':
        s.push(txt(cap(his) + ' contract with ')); team(from || to); s.push(txt(' expired; became ' + faWords(tx.meta.faStatus) + '.'));
        break;
      case 'terminated':
        s.push(txt(cap(his) + ' contract with ')); team(from || to); s.push(txt(' was terminated.'));
        break;
      case 'waived':
        s.push(txt('Waived by ')); team(from); s.push(txt(m.amount ? ' (' + money(m.amount) + ' in guaranteed salary remains on the cap).' : '.'));
        break;
      case 'buyout':
        s.push(txt('Contract bought out by ')); team(from); s.push(txt(m.amount ? ' for ' + money(m.amount) + '.' : '.'));
        break;
      case 'claimed':
        s.push(txt('Claimed off waivers by ')); team(to); if (from) { s.push(txt(' from ')); team(from); } s.push(txt('.'));
        break;
      case 'acquired':
        s.push(txt('Acquired by ')); team(to); if (from) { s.push(txt(' from ')); team(from); }
        s.push(txt(tx.preDynasty && !tx.date ? ' (trade date and terms not recorded).' : '.'));
        break;
      case 'trade':
        return describeTrade(save, tx, pid);
      case 'retired':
        s.push(txt('Retired from professional basketball' + (from ? '' : '.')));
        if (from) { s.push(txt(' as a member of ')); team(from); s.push(txt('.')); }
        break;
      case 'entered-coaching':
        s.push(txt('Began a coaching career; joined the pool of available coaches.'));
        break;
      default:
        s.push(txt(TYPES[tx.type] ? TYPES[tx.type].label + '.' : 'Transaction.'));
    }
    return s;
  }
  function cap(w) { return w.charAt(0).toUpperCase() + w.slice(1); }
  function faWords(st) { return st === 'RFA' ? 'a restricted free agent' : 'an unrestricted free agent'; }

  function describeTrade(save, tx, pid) {
    var mine = (tx.assets || []).filter(function (a) { return a.kind === 'player' && a.playerId === pid; })[0];
    var s = [];
    function team(id) { s.push(txt('the ')); s.push(teamRef(tx, id)); }
    var teams = uniq(tx.fromTeamIds.concat(tx.toTeamIds));
    if (!mine) { s.push(txt('Part of a ' + teams.length + '-team trade.')); return s; }
    if (teams.length > 2) {
      var others = teams.filter(function (id) { return id !== mine.from && id !== mine.to; });
      s.push(txt('Acquired by ')); team(mine.to); s.push(txt(' from ')); team(mine.from);
      s.push(txt(' as part of a ' + (WORDS[teams.length] || teams.length) + '-team trade involving '));
      others.forEach(function (id, i) { if (i) s.push(txt(i === others.length - 1 ? ' and ' : ', ')); team(id); });
      s.push(txt('.'));
      return s;
    }
    var along = tx.assets.filter(function (a) { return a !== mine && a.from === mine.from && a.to === mine.to; });
    var back = tx.assets.filter(function (a) { return a.from === mine.to && a.to === mine.from; });
    s.push(txt('Traded by ')); team(mine.from);
    if (along.length) { s.push(txt(', along with ')); s.push.apply(s, joinList(along.map(function (a) { return assetSegs(tx, a); }))); s.push(txt(',')); }
    s.push(txt(' to ')); team(mine.to);
    if (back.length) { s.push(txt(' in exchange for ')); s.push.apply(s, joinList(back.map(function (a) { return assetSegs(tx, a); }))); }
    s.push(txt('.'));
    return s;
  }

  // Per-team breakdown for multi-team trades: [{ teamId, name, receives: [segments] }]
  function tradeDetails(save, tx) {
    if (tx.type !== 'trade' || !tx.assets) return [];
    return uniq(tx.toTeamIds).map(function (id) {
      var got = tx.assets.filter(function (a) { return a.to === id; });
      return { teamId: id, segs: [teamRef(tx, id), txt(' acquired ')].concat(joinList(got.map(function (a) {
        var segs = assetSegs(tx, a);
        return segs.concat([txt(' from the '), teamRef(tx, a.from)]);
      }))).concat([txt('.')]) };
    });
  }

  function textOf(segs) { return segs.map(function (x) { return x.text; }).join(''); }

  /* --- queries ----------------------------------------------------------------- */

  // Undated pre-league records sit just before the league's first day.
  function sortKey(save, t) { return t.date || Season.isoDate(save.calendar.startYear, 9, 30); }
  function chronological(save, list) {
    return list.slice().sort(function (a, b) { return cmp(sortKey(save, a), sortKey(save, b)) || (a.seq - b.seq); });
  }

  /**
   * A player's records. opts: { category, seasonYear, financial, newestFirst }
   */
  function forPlayer(save, pid, opts) {
    opts = opts || {};
    var list = ((save.transactions && save.transactions.items) || []).filter(function (t) {
      if (t.playerIds.indexOf(pid) === -1 || !TYPES[t.type]) return false;
      if (opts.financial && !TYPES[t.type].financial) return false;
      if (opts.category && opts.category !== 'all' && TYPES[t.type].category !== opts.category) return false;
      if (opts.seasonYear != null && t.seasonYear !== opts.seasonYear) return false;
      return true;
    });
    list = chronological(save, list);
    return opts.newestFirst ? list.reverse() : list;
  }

  // League / franchise log (for future league and team transaction pages)
  function forTeam(save, teamId) {
    return chronological(save, ((save.transactions && save.transactions.items) || []).filter(function (t) {
      return t.fromTeamIds.indexOf(teamId) !== -1 || t.toTeamIds.indexOf(teamId) !== -1;
    }));
  }

  /* --- history reconstructed when the league began ---------------------------- */

  /**
   * Draft selections recorded in each player's career background
   * (scripts/player-career.js). Undrafted players get none. Idempotent.
   */
  function addDraftHistory(save) {
    (save.players || []).forEach(function (p) {
      var d = p.draft;
      if (!d || d.undrafted || !d.round) return;
      var teamNames = {};
      var teamId = d.teamId || ('draft-team:' + d.teamName);
      teamNames[teamId] = d.teamName;
      log(save, {
        type: 'drafted', key: 'drafted:' + p.id, date: draftDate(d.year), playerIds: [p.id], toTeamIds: [teamId], teamNames: teamNames,
        meta: { year: d.year, round: d.round, pick: d.pick, overall: d.overall, leagueAbbr: leagueAbbr(save) },
        preDynasty: d.year < save.calendar.startYear || (d.year === save.calendar.startYear && cmp(draftDate(d.year), save.calendar.currentDate) < 0)
      });
    });
    return save;
  }

  /**
   * True when part of a player's career happened before the league's
   * records began (so missing entries are unknown, not absent).
   */
  function incomplete(save, pid) {
    var p = playerById(save, pid);
    var start = save.calendar.startYear;
    if (p && p.draft && Number.isInteger(p.draft.year)) return p.draft.year < start;
    return !!(p && p.experience > 0);
  }

  /* --- lifecycle ----------------------------------------------------------------- */

  // Records follow a save imported as a separate dynasty
  function rebind(save) {
    if (!save.transactions) return save;
    save.transactions.items.forEach(function (t) { t.dynastyId = save.id; });
    return save;
  }

  function isInt(v) { return Number.isInteger(v); }
  function isValid(save) {
    var s = save.transactions;
    if (s === undefined) return true;
    if (!s || !Array.isArray(s.items)) return false;
    var ids = {}, keys = {};
    return s.items.every(function (t) {
      var ok = t && typeof t.id === 'string' && !ids[t.id] && typeof t.key === 'string' && !keys[t.key] && TYPES[t.type] &&
        (t.date === null || Season.isValidDate(t.date)) && (t.seasonYear === null || isInt(t.seasonYear)) &&
        t.dynastyId === save.id && Array.isArray(t.playerIds) && Array.isArray(t.fromTeamIds) && Array.isArray(t.toTeamIds) &&
        Array.isArray(t.contractIds) && Array.isArray(t.pickIds) && t.teamNames && typeof t.teamNames === 'object' &&
        t.playerNames && typeof t.playerNames === 'object' && t.meta && typeof t.meta === 'object' && isInt(t.seq) &&
        (t.assets === null || Array.isArray(t.assets)) && (t.money === null || typeof t.money === 'object');
      if (ok) { ids[t.id] = true; keys[t.key] = true; }
      return ok;
    });
  }

  return {
    VERSION: VERSION,
    TYPES: TYPES,
    CATEGORIES: CATEGORIES,
    ensure: ensure,
    log: log,
    has: has,
    get: get,
    seasonOf: seasonOf,
    draftDate: draftDate,
    describe: describe,
    tradeDetails: tradeDetails,
    textOf: textOf,
    money: money,
    forPlayer: forPlayer,
    forTeam: forTeam,
    chronological: chronological,
    addDraftHistory: addDraftHistory,
    incomplete: incomplete,
    rebind: rebind,
    isValid: isValid
  };
});
