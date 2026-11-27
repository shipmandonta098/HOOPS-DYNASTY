/* ==========================================================================
   HOOPS DYNASTY — league news (event-driven, template-based)

   News is produced ONLY from events that actually happen in a dynasty and
   is stored inside that dynasty's save:

     save.news = { items: [item, ...] }          (oldest first)
     item = {
       id,            'news-' + hash(dynastyId | eventKey)  (unique, stable)
       eventKey,      one event -> one item (duplicates are ignored)
       dynastyId,     the save it belongs to (never shown in another dynasty)
       headline,      short ticker / list text
       body,          article text
       category,      one of CATEGORIES
       date,          in-game publication date (YYYY-MM-DD)
       seasonYear,    season start year (2025 = 2025–26)
       teamIds[], playerIds[],
       importance     1 minor · 2 notable · 3 major
     }

   Gameplay systems publish with HDNews.record(save, { type, key, data }).
   Each type has a template in TEMPLATES. Templates exist for every planned
   category; a template is only used when its system emits the event —
   nothing here invents events.

   Events emitted today:
     league-founded, gm-hired, ownership-statement, franchise-expansion,
     franchise-relocation (at dynasty creation / save upgrade) and
     rules-change (League Rules changed in Settings, or taking effect).

   AMBIENT holds general basketball lines and gameplay tips for when no
   dynasty exists. They are not reports of events.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var node = typeof module === 'object' && module.exports;
  var api = factory(
    node ? require('./random.js') : root.HDRandom,
    node ? require('./season.js') : root.HDSeason,
    node ? require('../data/franchises.js') : root.HDFranchises
  );
  if (node) module.exports = api;
  else root.HDNews = api;
})(typeof self !== 'undefined' ? self : this, function (R, Season, F) {
  'use strict';

  var CATEGORIES = Object.freeze({
    'game-result':     'Game Results',
    'performance':     'Player Performances',
    'trade':           'Trades',
    'signing':         'Free Agency',
    'extension':       'Contract Extensions',
    'injury':          'Injuries',
    'trade-request':   'Trade Requests',
    'draft-prospect':  'Draft Prospects',
    'draft-pick':      'Draft',
    'coaching':        'Coaching Changes',
    'gm-change':       'Front Office',
    'ownership':       'Ownership',
    'playoffs':        'Playoffs',
    'championship':    'Championship',
    'award':           'Awards',
    'retirement':      'Retirements',
    'milestone':       'Milestones',
    'record':          'League Records',
    'franchise':       'Expansion & Relocation',
    'league':          'League Office'
  });

  var MAX_ITEMS = 1500;          // oldest are dropped past this (archive later)

  var AMBIENT = Object.freeze([
    'A new season brings new championship aspirations.',
    'Front offices prepare for another competitive season.',
    'Building through the draft can be the foundation of a successful franchise.',
    'Financial flexibility can create valuable opportunities in free agency.',
    'Every championship dynasty begins with a vision.',
    'Tip: Customize the league during setup to relocate, rebrand or add expansion teams.',
    'Tip: Click any player’s name to open their full profile and ratings.',
    'Tip: Ratings are color-coded — green is elite, red needs work.',
    'Tip: League rules can change in Settings until the regular season tips off.'
  ]);

  /* --- helpers ------------------------------------------------------------- */

  function team(save, id) {
    for (var i = 0; i < save.teams.length; i++) if (save.teams[i].id === id) return save.teams[i];
    return null;
  }
  function player(save, id) {
    var ps = save.players || [];
    for (var i = 0; i < ps.length; i++) if (ps[i].id === id) return ps[i];
    return null;
  }
  function pname(p) { return p ? (p.nameOrder === 'family-first' ? p.lastName + ' ' + p.firstName : p.firstName + ' ' + p.lastName) : 'A player'; }
  function conferenceName(save, id) {
    var c = (save.league.conferences || []).filter(function (x) { return x.id === id; })[0];
    return c ? c.name : '';
  }
  function lower(s) { s = String(s || ''); return s.charAt(0).toLowerCase() + s.slice(1); }
  function ordinal(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

  /* --- templates -------------------------------------------------------------
     template(save, data) -> { headline, body, category, importance,
                               teamIds, playerIds }
     ------------------------------------------------------------------------- */
  var TEMPLATES = {
    /* emitted today */
    'league-founded': function (save) {
      var confs = (save.league.conferences || []).map(function (c) { return c.name; });
      return {
        category: 'league', importance: 3, teamIds: [], playerIds: [],
        headline: save.league.name + ' tips off its inaugural ' + Season.label(save.calendar.startYear) + ' season with ' + save.teams.length + ' franchises.',
        body: 'The ' + save.league.name + ' begins play with ' + save.teams.length + ' franchises' +
          (confs.length ? ' across the ' + confs.join(' and ') : '') + '. The preseason opens on ' +
          Season.formatDate(Season.phaseStartDate(save.calendar.startYear, 'preseason'), 'long') + '.'
      };
    },
    'gm-hired': function (save, d) {
      var t = team(save, d.teamId);
      var owner = (save.owners || []).filter(function (o) { return o.teamId === d.teamId; })[0];
      return {
        category: 'gm-change', importance: 3, teamIds: [d.teamId], playerIds: [],
        headline: 'The ' + t.fullName + ' name ' + d.gmName + ' general manager.',
        body: (owner ? owner.name + ' (' + owner.title + ') has' : 'The ' + t.fullName + ' have') + ' handed ' +
          d.gmName + ' control of basketball operations ahead of the ' + Season.label(save.calendar.startYear) + ' season.'
      };
    },
    'ownership-statement': function (save, d) {
      var t = team(save, d.teamId);
      return {
        category: 'ownership', importance: 2, teamIds: [d.teamId], playerIds: [],
        headline: t.name + ' owner ' + d.ownerName + ' sets the goal: ' + lower(d.goal),
        body: d.ownerName + ' outlined expectations for the ' + t.fullName + ': ' + d.goals.join(' ')
      };
    },
    'franchise-expansion': function (save, d) {
      var t = team(save, d.teamId);
      return {
        category: 'franchise', importance: 2, teamIds: [d.teamId], playerIds: [],
        headline: 'The ' + t.fullName + ' join the ' + save.league.name + ' as an expansion franchise.',
        body: 'The ' + t.fullName + ' enter the ' + conferenceName(save, t.conference) + ' and will play at ' +
          (t.arena ? t.arena.name : 'their new arena') + '.'
      };
    },
    'franchise-relocation': function (save, d) {
      var t = team(save, d.teamId);
      return {
        category: 'franchise', importance: 2, teamIds: [d.teamId], playerIds: [],
        headline: 'The ' + t.name + ' franchise relocates from ' + d.fromCity + ' to ' + t.city + '.',
        body: 'Ahead of the inaugural season, the ' + t.name + ' move from ' + d.fromCity + ' to ' + t.city +
          (t.arena ? ', where they will play at ' + t.arena.name : '') + '.'
      };
    },
    'rules-change': function (save, d) {
      var when = d.effective === 'now' ? 'for the ' + Season.label(d.seasonYear) + ' season' : 'beginning in ' + Season.label(d.seasonYear);
      return {
        category: 'league', importance: 2, teamIds: [], playerIds: [],
        headline: 'League office ' + (d.effective === 'now' ? 'adopts ' : 'approves ') + d.changes.join(', ') + ' ' + when + '.',
        body: 'The ' + save.league.name + ' has ' + (d.effective === 'now' ? 'adopted' : 'approved') + ' rule changes ' + when + ': ' + d.changes.join('; ') + '.'
      };
    },

    /* ready for future systems (not emitted until they exist) */
    'game-result': function (save, d) {
      var w = team(save, d.winnerId), l = team(save, d.loserId);
      return { category: 'game-result', importance: d.streak >= 5 ? 2 : 1, teamIds: [d.winnerId, d.loserId], playerIds: [],
        headline: d.streak >= 3 ? 'The ' + w.fullName + ' extend their winning streak to ' + d.streak + ' games.' : 'The ' + w.fullName + ' beat the ' + l.fullName + ' ' + d.winnerScore + '–' + d.loserScore + '.',
        body: 'The ' + w.fullName + ' defeated the ' + l.fullName + ' ' + d.winnerScore + '–' + d.loserScore + '.' };
    },
    'performance': function (save, d) {
      var p = player(save, d.playerId);
      return { category: 'performance', importance: d.careerHigh ? 2 : 1, teamIds: [p.teamId], playerIds: [d.playerId],
        headline: pname(p) + ' records ' + (d.careerHigh ? 'a career-high ' : '') + d.value + ' ' + d.stat + '.',
        body: pname(p) + ' finished with ' + d.value + ' ' + d.stat + ' against the ' + (team(save, d.opponentId) || {}).fullName + '.' };
    },
    'trade': function (save, d) {
      var names = d.teamIds.map(function (id) { return team(save, id).fullName; });
      return { category: 'trade', importance: 3, teamIds: d.teamIds, playerIds: d.playerIds || [],
        headline: names[0] + ' complete a ' + (d.teamIds.length > 2 ? d.teamIds.length + '-team ' : '') + 'trade with the ' + names.slice(1).join(' and ') + '.',
        body: d.summary || '' };
    },
    'signing': function (save, d) {
      var p = player(save, d.playerId), t = team(save, d.teamId);
      return { category: 'signing', importance: 2, teamIds: [d.teamId], playerIds: [d.playerId],
        headline: 'The ' + t.fullName + ' sign ' + pname(p) + '.', body: d.terms || '' };
    },
    'extension': function (save, d) {
      var p = player(save, d.playerId), t = team(save, d.teamId);
      return { category: 'extension', importance: 2, teamIds: [d.teamId], playerIds: [d.playerId],
        headline: 'The ' + t.fullName + ' extend ' + pname(p) + '.', body: d.terms || '' };
    },
    'injury': function (save, d) {
      var p = player(save, d.playerId);
      return { category: 'injury', importance: d.severe ? 2 : 1, teamIds: [p.teamId], playerIds: [d.playerId],
        headline: pname(p) + ' is out ' + d.duration + ' with ' + d.injury + '.', body: '' };
    },
    'trade-request': function (save, d) {
      var p = player(save, d.playerId);
      return { category: 'trade-request', importance: 2, teamIds: [p.teamId], playerIds: [d.playerId],
        headline: pname(p) + ' requests a trade from the ' + team(save, p.teamId).fullName + '.', body: '' };
    },
    'draft-prospect': function (save, d) {
      return { category: 'draft-prospect', importance: 1, teamIds: [], playerIds: d.playerId ? [d.playerId] : [],
        headline: d.name + ' rises up draft boards.', body: '' };
    },
    'draft-pick': function (save, d) {
      var t = team(save, d.teamId);
      return { category: 'draft-pick', importance: d.overall <= 5 ? 3 : 1, teamIds: [d.teamId], playerIds: [d.playerId],
        headline: 'The ' + t.fullName + ' select ' + d.name + ' ' + ordinal(d.overall) + ' overall.', body: '' };
    },
    'coaching': function (save, d) {
      var t = team(save, d.teamId);
      return { category: 'coaching', importance: 2, teamIds: [d.teamId], playerIds: [],
        headline: 'The ' + t.fullName + ' ' + (d.hired ? 'hire ' + d.name + ' as head coach.' : 'part ways with head coach ' + d.name + '.'), body: '' };
    },
    'gm-fired': function (save, d) {
      var t = team(save, d.teamId);
      return { category: 'gm-change', importance: 3, teamIds: [d.teamId], playerIds: [],
        headline: 'The ' + t.fullName + ' dismiss general manager ' + d.gmName + '.', body: '' };
    },
    'playoffs': function (save, d) {
      var t = team(save, d.teamId);
      return { category: 'playoffs', importance: 2, teamIds: [d.teamId], playerIds: [],
        headline: d.eliminated ? 'The ' + t.fullName + ' are eliminated from playoff contention.' : 'The ' + t.fullName + ' clinch a playoff berth.', body: '' };
    },
    'championship': function (save, d) {
      var t = team(save, d.teamId);
      return { category: 'championship', importance: 3, teamIds: [d.teamId], playerIds: [],
        headline: 'The ' + t.fullName + ' win the ' + Season.label(d.seasonYear) + ' ' + save.league.name + ' championship.', body: '' };
    },
    'award': function (save, d) {
      var p = player(save, d.playerId);
      return { category: 'award', importance: 3, teamIds: [p.teamId], playerIds: [d.playerId],
        headline: pname(p) + ' is named ' + d.award + '.', body: '' };
    },
    'retirement': function (save, d) {
      var p = player(save, d.playerId);
      return { category: 'retirement', importance: 2, teamIds: [p.teamId], playerIds: [d.playerId],
        headline: pname(p) + ' announces retirement after ' + d.seasons + ' seasons.', body: '' };
    },
    'milestone': function (save, d) {
      var p = player(save, d.playerId);
      return { category: 'milestone', importance: 2, teamIds: [p.teamId], playerIds: [d.playerId],
        headline: pname(p) + ' reaches ' + d.milestone + '.', body: '' };
    },
    'record': function (save, d) {
      return { category: 'record', importance: 3, teamIds: d.teamIds || [], playerIds: d.playerIds || [],
        headline: d.text, body: '' };
    }
  };

  /* --- store --------------------------------------------------------------- */

  function ensure(save) {
    if (!save.news || !Array.isArray(save.news.items)) save.news = { items: [] };
    return save.news;
  }

  function newsId(dynastyId, eventKey) { return 'news-' + R.hash(dynastyId + '|' + eventKey).toString(36); }

  /**
   * Publish one event. Returns the new item, or null when the event was
   * already published (same key) or has no template.
   * @param event { type, key, data, date? }
   */
  function record(save, event) {
    var store = ensure(save);
    var key = event.type + ':' + event.key;
    if (store.items.some(function (n) { return n.eventKey === key; })) return null;
    var tpl = TEMPLATES[event.type];
    if (!tpl) return null;
    var out = tpl(save, event.data || {});
    var item = {
      id: newsId(save.id, key),
      eventKey: key,
      dynastyId: save.id,
      headline: out.headline,
      body: out.body || '',
      category: out.category,
      date: event.date || save.calendar.currentDate,
      seasonYear: event.seasonYear != null ? event.seasonYear : save.calendar.seasonYear,
      teamIds: out.teamIds || [],
      playerIds: out.playerIds || [],
      importance: out.importance || 1
    };
    store.items.push(item);
    if (store.items.length > MAX_ITEMS) store.items.splice(0, store.items.length - MAX_ITEMS);
    return item;
  }

  /**
   * Events that happened when the league was founded, read from the save
   * itself (league, GM hire, owner's goals, expansion teams, relocations).
   * Safe to run more than once: each event is published only once.
   */
  function addFoundingNews(save) {
    var date = Season.phaseStartDate(save.calendar.startYear, 'preseason');
    var at = { date: date, seasonYear: save.calendar.startYear };
    function rec(type, key, data) { return record(save, { type: type, key: key, data: data, date: at.date, seasonYear: at.seasonYear }); }
    // Published least to most important, so newest-first lists lead with the league
    var expansion = {};
    F.EXPANSION.forEach(function (f) { expansion[f.id] = true; });
    save.teams.forEach(function (t) {
      var catalog = F.byId(t.franchiseId);
      if (expansion[t.franchiseId] || !catalog) rec('franchise-expansion', t.id, { teamId: t.id });
      else if (catalog.city !== t.city) rec('franchise-relocation', t.id + ':' + t.city, { teamId: t.id, fromCity: catalog.city });
    });
    var owner = (save.owners || []).filter(function (o) { return o.teamId === save.userTeamId; })[0];
    var goals = owner && owner.expectations && owner.expectations.season ? owner.expectations.season.map(function (g) { return g.text; }) : [];
    if (owner && goals.length) rec('ownership-statement', save.userTeamId + ':' + save.calendar.startYear, { teamId: save.userTeamId, ownerName: owner.name, goal: goals[0], goals: goals });
    var user = team(save, save.userTeamId);
    if (user && save.gm) rec('gm-hired', save.userTeamId + ':' + save.gm.name, { teamId: save.userTeamId, gmName: save.gm.name });
    rec('league-founded', save.calendar.startYear, {});
    return save;
  }

  /* --- reading -------------------------------------------------------------- */

  // Newest first: by date, then most recently published
  function latest(save, limit) {
    var items = save && save.news && Array.isArray(save.news.items) ? save.news.items.slice() : [];
    var order = {};
    items.forEach(function (n, i) { order[n.id] = i; });
    items.sort(function (a, b) {
      return Season.compareDates(b.date, a.date) || (order[b.id] - order[a.id]);
    });
    return items.filter(function (n) { return n.dynastyId === save.id; }).slice(0, limit || items.length);
  }

  // After a save is stored under a new id ("import as a separate dynasty")
  function rebind(save) {
    if (!save.news || !Array.isArray(save.news.items)) return save;
    save.news.items.forEach(function (n) { n.dynastyId = save.id; n.id = newsId(save.id, n.eventKey); });
    return save;
  }

  function isValid(save) {
    var n = save.news;
    if (n === undefined) return true;
    if (!n || !Array.isArray(n.items) || n.items.length > MAX_ITEMS) return false;
    var ids = {}, keys = {};
    return n.items.every(function (it) {
      var ok = it && typeof it.id === 'string' && !ids[it.id] && typeof it.eventKey === 'string' && !keys[it.eventKey] &&
        it.dynastyId === save.id && typeof it.headline === 'string' && it.headline.length > 0 && it.headline.length <= 300 &&
        typeof it.body === 'string' && it.body.length <= 4000 && Object.prototype.hasOwnProperty.call(CATEGORIES, it.category) &&
        Season.isValidDate(it.date) && Number.isInteger(it.seasonYear) && Array.isArray(it.teamIds) && Array.isArray(it.playerIds) &&
        [1, 2, 3].indexOf(it.importance) !== -1;
      if (ok) { ids[it.id] = true; keys[it.eventKey] = true; }
      return ok;
    });
  }

  return {
    CATEGORIES: CATEGORIES,
    TEMPLATES: TEMPLATES,
    AMBIENT: AMBIENT,
    MAX_ITEMS: MAX_ITEMS,
    record: record,
    addFoundingNews: addFoundingNews,
    latest: latest,
    rebind: rebind,
    isValid: isValid
  };
});
