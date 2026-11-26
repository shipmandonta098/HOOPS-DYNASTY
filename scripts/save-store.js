/* ==========================================================================
   HOOPS DYNASTY — dynasty save storage (minimal, single slot)

   Uses the key the title screen already reads for its Continue button
   ('hoopsDynasty.save'). Display preferences live elsewhere
   ('hoopsDynasty.preferences') and are never touched here.

   API (window.HDSaveStore):
     exists()          -> true if ANY data is stored in the slot (even if it
                          can't be parsed), so callers always confirm before
                          replacing it.
     read()            -> the dynasty object (migrated to the current
                          schema), or null.
     summary()         -> { teamName, season } for confirmation prompts, or null.
     write(dynasty, { replace }) -> { ok: true } | { ok: false, reason }
                          Refuses to overwrite an existing save unless
                          replace === true. The replaced save is kept under
                          BACKUP_KEY as a safety net.

   Multiple save slots can be added later by namespacing the key; keep the
   Continue slot as the "active" dynasty.
   ========================================================================== */
(function (root) {
  'use strict';

  var KEY = 'hoopsDynasty.save';
  var BACKUP_KEY = 'hoopsDynasty.save.previous';

  // schemaVersion -> function(save) returning the next version.
  // e.g. MIGRATIONS[1] = function (s) { s.rosters = {}; s.schemaVersion = 2; return s; };
  var MIGRATIONS = {};

  function storage() {
    try { return root.localStorage; } catch (err) { return null; }
  }

  function rawValue() {
    var ls = storage();
    if (!ls) return null;
    try { return ls.getItem(KEY); } catch (err) { return null; }
  }

  function exists() {
    var raw = rawValue();
    return raw !== null && raw !== '';
  }

  function migrate(save) {
    var guard = 0;
    while (save && MIGRATIONS[save.schemaVersion] && guard++ < 50) {
      save = MIGRATIONS[save.schemaVersion](save);
    }
    return save;
  }

  function read() {
    var raw = rawValue();
    if (!raw) return null;
    try {
      var save = JSON.parse(raw);
      return save && typeof save === 'object' ? migrate(save) : null;
    } catch (err) {
      return null;
    }
  }

  function summary() {
    var save = read();
    if (!save || typeof save.teamName !== 'string') return exists() ? { teamName: null, season: null } : null;
    return { teamName: save.teamName, season: save.season != null ? String(save.season) : null };
  }

  function write(dynasty, options) {
    options = options || {};
    var ls = storage();
    if (!ls) return { ok: false, reason: 'unavailable' };
    if (exists() && options.replace !== true) return { ok: false, reason: 'exists' };
    try {
      var previous = rawValue();
      if (previous) ls.setItem(BACKUP_KEY, previous);
      ls.setItem(KEY, JSON.stringify(dynasty));
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err && err.name === 'QuotaExceededError' ? 'quota' : 'unavailable' };
    }
  }

  root.HDSaveStore = {
    KEY: KEY,
    BACKUP_KEY: BACKUP_KEY,
    exists: exists,
    read: read,
    summary: summary,
    write: write
  };
})(typeof self !== 'undefined' ? self : this);
