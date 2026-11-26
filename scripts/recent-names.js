/* ==========================================================================
   HOOPS DYNASTY — recently used names (New Dynasty > League Setup)
   Remembers the last few league names and GM names on this device so they
   can be reused with one tap. Stored separately from display preferences
   and from dynasty saves ('hoopsDynasty.recentNames').

   The first time it's used, the list is seeded from existing saved
   dynasties, so returning players see their names right away. Clearing a
   list stores an empty list, so it isn't seeded again.

   HDRecentNames.get(field)            -> string[] (most recent first)
   HDRecentNames.remember(field, name)
   HDRecentNames.remove(field, name)
   HDRecentNames.clear(field)
   HDRecentNames.seedFrom(summaries)   (only fills lists that were never set)
   field: 'league' | 'gm'
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'hoopsDynasty.recentNames';
  var MAX = 5;
  var FIELDS = ['league', 'gm'];

  function read() {
    try {
      var data = JSON.parse(localStorage.getItem(KEY) || 'null');
      return data && typeof data === 'object' ? data : {};
    } catch (err) { return {}; }
  }

  function write(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch (err) { return false; }
  }

  function clean(name) {
    return String(name == null ? '' : name).replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  function list(data, field) {
    var v = data[field];
    return Array.isArray(v) ? v.filter(function (n) { return typeof n === 'string' && n; }).slice(0, MAX) : null;
  }

  function get(field) {
    return list(read(), field) || [];
  }

  function remember(field, name) {
    name = clean(name);
    if (!name || FIELDS.indexOf(field) === -1) return;
    var data = read();
    var current = list(data, field) || [];
    var key = name.toLowerCase();
    data[field] = [name].concat(current.filter(function (n) { return n.toLowerCase() !== key; })).slice(0, MAX);
    write(data);
  }

  function remove(field, name) {
    var data = read();
    data[field] = (list(data, field) || []).filter(function (n) { return n !== name; });
    write(data);
  }

  function clear(field) {
    var data = read();
    data[field] = [];
    write(data);
  }

  // summaries: HDSaves.list() rows (leagueName, gmName, createdAt)
  function seedFrom(summaries) {
    var data = read();
    var changed = false;
    var rows = (summaries || []).slice().sort(function (a, b) {
      return (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0);
    });
    [['league', 'leagueName'], ['gm', 'gmName']].forEach(function (pair) {
      if (list(data, pair[0]) !== null) return;           // already set (even if cleared)
      var seen = {};
      var names = rows.map(function (r) { return clean(r[pair[1]]); })
        .filter(function (n) { var k = n.toLowerCase(); if (!n || seen[k]) return false; seen[k] = true; return true; })
        .slice(0, MAX);
      if (!names.length) return;                           // nothing to seed yet: try again later
      data[pair[0]] = names;
      changed = true;
    });
    if (changed) write(data);
  }

  window.HDRecentNames = { get: get, remember: remember, remove: remove, clear: clear, seedFrom: seedFrom, MAX: MAX };
})();
