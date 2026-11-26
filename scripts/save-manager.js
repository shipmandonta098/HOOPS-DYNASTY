/* ==========================================================================
   HOOPS DYNASTY — save manager (the only code that touches dynasty storage)

   STORAGE
     IndexedDB database "hoops-dynasty" (v1) with two object stores:
       dynasties  — the complete save, keyed by dynasty id
       summaries  — the small card view (HDDynasty.summarize), same key
     Both are written in ONE transaction, and a write only resolves after
     the transaction commits, so success is never reported for a failed save.

     If IndexedDB is unavailable (some private-browsing modes), the same API
     runs on localStorage instead (keys "hoopsDynasty.dynasty.<id>" plus an
     index "hoopsDynasty.dynasties"). Display preferences
     ("hoopsDynasty.preferences") are never read or written here.

   MIGRATION
     Before this system, a single dynasty lived in localStorage under
     "hoopsDynasty.save" (format 1). On first start it is upgraded to the
     current format and stored as its own dynasty (same id, all data kept).
     Only after that write commits is the old key renamed to
     "hoopsDynasty.save.legacy" (kept as a backup, never re-imported).
     Saves already in storage are upgraded lazily when read.

   API (window.HDSaves) — every method returns a Promise
     ready()                 -> backend name ('indexeddb' | 'localstorage')
     list()                  -> summaries[]
     get(id)                 -> full dynasty (deep copy) | null
     has(id)                 -> boolean
     mostRecent()            -> summary of the most recently played | null
     create(dynasty)         -> summary   (rejects if the id already exists)
     update(dynasty)         -> summary   (rejects if it doesn't exist)
     markPlayed(id)          -> full dynasty with lastPlayedAt = now
     remove(id)              -> void
     exportFile(id)          -> { filename, text }   (read-only)
     parseImport(text)       -> dynasty   (throws HDDynasty.ImportError)
     importDynasty(d, mode)  -> summary   mode: 'new' | 'replace' | 'separate'
     subscribe(fn)           -> unsubscribe; fn({ type, id }) after changes

   Failures reject with SaveError { code: 'unavailable' | 'quota' |
   'exists' | 'not-found' | 'invalid' | 'failed', message }.
   ========================================================================== */
(function (root) {
  'use strict';

  var D = root.HDDynasty;

  var DB_NAME = 'hoops-dynasty';
  var DB_VERSION = 1;
  var LEGACY_KEY = 'hoopsDynasty.save';
  var LEGACY_BACKUP_KEY = 'hoopsDynasty.save.legacy';
  var LS_PREFIX = 'hoopsDynasty.dynasty.';
  var LS_INDEX = 'hoopsDynasty.dynasties';

  /* --- Errors ---------------------------------------------------------------- */

  var MESSAGES = {
    unavailable: 'Saving isn’t available in this browser (storage is blocked or in private mode).',
    quota: 'There isn’t enough storage space on this device to save.',
    exists: 'A dynasty with this ID already exists.',
    'not-found': 'That dynasty couldn’t be found. It may have been deleted.',
    invalid: 'This dynasty’s data is invalid and wasn’t saved.',
    failed: 'The save couldn’t be completed. Please try again.'
  };

  function SaveError(code, message) {
    this.name = 'SaveError';
    this.code = code;
    this.message = message || MESSAGES[code] || MESSAGES.failed;
  }
  SaveError.prototype = Object.create(Error.prototype);

  function toSaveError(err) {
    if (err instanceof SaveError) return err;
    var name = err && err.name;
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return new SaveError('quota');
    if (name === 'SecurityError' || name === 'InvalidStateError') return new SaveError('unavailable');
    return new SaveError('failed');
  }

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  /* --- IndexedDB backend --------------------------------------------------- */

  function idbBackend(db) {
    function tx(stores, mode, work) {
      return new Promise(function (resolve, reject) {
        var t;
        try { t = db.transaction(stores, mode); } catch (err) { reject(toSaveError(err)); return; }
        var result;
        t.oncomplete = function () { resolve(result); };            // committed
        t.onerror = function () { reject(toSaveError(t.error)); };
        t.onabort = function () { reject(toSaveError(t.error)); };
        try {
          work(t, function (value) { result = value; });
        } catch (err) {
          try { t.abort(); } catch (e) { /* already finished */ }
          reject(toSaveError(err));
        }
      });
    }
    function request(req, set, map) {
      req.onsuccess = function () { set(map ? map(req.result) : req.result); };
    }
    return {
      name: 'indexeddb',
      get: function (id) {
        return tx(['dynasties'], 'readonly', function (t, set) {
          request(t.objectStore('dynasties').get(id), set, function (r) { return r || null; });
        });
      },
      list: function () {
        return tx(['summaries'], 'readonly', function (t, set) {
          request(t.objectStore('summaries').getAll(), set);
        });
      },
      put: function (dynasty, summary) {
        return tx(['dynasties', 'summaries'], 'readwrite', function (t) {
          t.objectStore('dynasties').put(dynasty);
          t.objectStore('summaries').put(summary);
        });
      },
      remove: function (id) {
        return tx(['dynasties', 'summaries'], 'readwrite', function (t) {
          t.objectStore('dynasties').delete(id);
          t.objectStore('summaries').delete(id);
        });
      }
    };
  }

  function openIndexedDB() {
    return new Promise(function (resolve, reject) {
      var idb;
      try { idb = root.indexedDB; } catch (err) { idb = null; }
      if (!idb) { reject(new SaveError('unavailable')); return; }
      var req;
      try { req = idb.open(DB_NAME, DB_VERSION); } catch (err) { reject(toSaveError(err)); return; }
      var timer = setTimeout(function () { reject(new SaveError('unavailable')); }, 4000);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('dynasties')) db.createObjectStore('dynasties', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('summaries')) db.createObjectStore('summaries', { keyPath: 'id' });
      };
      req.onsuccess = function () {
        clearTimeout(timer);
        var db = req.result;
        // Another tab upgrading the schema later: let it, then reload state.
        db.onversionchange = function () { db.close(); };
        resolve(idbBackend(db));
      };
      req.onerror = function () { clearTimeout(timer); reject(toSaveError(req.error)); };
      req.onblocked = function () { /* wait; the timeout handles a stuck open */ };
    });
  }

  /* --- localStorage fallback backend ------------------------------------- */

  function lsBackend(ls) {
    function readIndex() {
      try { return JSON.parse(ls.getItem(LS_INDEX) || '[]'); } catch (err) { return []; }
    }
    return {
      name: 'localstorage',
      get: function (id) {
        return Promise.resolve().then(function () {
          var raw = ls.getItem(LS_PREFIX + id);
          return raw ? JSON.parse(raw) : null;
        });
      },
      list: function () {
        return Promise.resolve().then(readIndex);
      },
      put: function (dynasty, summary) {
        return Promise.resolve().then(function () {
          var key = LS_PREFIX + dynasty.id;
          var previous = ls.getItem(key);
          try {
            ls.setItem(key, JSON.stringify(dynasty));
            var index = readIndex().filter(function (s) { return s.id !== summary.id; });
            index.push(summary);
            ls.setItem(LS_INDEX, JSON.stringify(index));
          } catch (err) {
            // roll back so the dynasty and index never disagree
            try { if (previous === null) ls.removeItem(key); else ls.setItem(key, previous); } catch (e) { /* ignore */ }
            throw toSaveError(err);
          }
        });
      },
      remove: function (id) {
        return Promise.resolve().then(function () {
          try {
            ls.setItem(LS_INDEX, JSON.stringify(readIndex().filter(function (s) { return s.id !== id; })));
            ls.removeItem(LS_PREFIX + id);
          } catch (err) { throw toSaveError(err); }
        });
      }
    };
  }

  function localStorageOrNull() {
    try {
      var ls = root.localStorage;
      var probe = 'hoopsDynasty.__probe';
      ls.setItem(probe, '1');
      ls.removeItem(probe);
      return ls;
    } catch (err) {
      return null;
    }
  }

  /* --- Manager ------------------------------------------------------------- */

  var backendPromise = null;
  var listeners = [];

  function emit(event) {
    listeners.slice().forEach(function (fn) {
      try { fn(event); } catch (err) { /* a broken listener must not break saving */ }
    });
  }

  function backend() {
    if (!backendPromise) {
      backendPromise = openIndexedDB()
        .catch(function () {
          var ls = localStorageOrNull();
          if (!ls) throw new SaveError('unavailable');
          return lsBackend(ls);
        })
        .then(function (b) {
          return migrateLegacy(b).then(function () { return b; });
        });
    }
    return backendPromise;
  }

  // One-time move of the pre-multi-save single slot into the new storage.
  function migrateLegacy(b) {
    var ls = localStorageOrNull();
    var raw = null;
    try { raw = ls && ls.getItem(LEGACY_KEY); } catch (err) { raw = null; }
    if (!raw) return Promise.resolve();

    var dynasty;
    try {
      dynasty = D.migrate(JSON.parse(raw));
      if (!D.validateDynasty(dynasty).valid) throw new Error('invalid');
    } catch (err) {
      // Unreadable legacy data: leave it exactly where it is, untouched.
      if (root.console) console.warn('[Hoops Dynasty] A legacy save could not be migrated and was left in place.');
      return Promise.resolve();
    }

    return b.get(dynasty.id).then(function (existing) {
      return existing ? null : b.put(dynasty, D.summarize(dynasty));
    }).then(function () {
      // Committed: keep the original as a backup under a key we never import.
      try {
        ls.setItem(LEGACY_BACKUP_KEY, raw);
        ls.removeItem(LEGACY_KEY);
      } catch (err) { /* backup failed: the legacy key stays; migration is idempotent */ }
    }).catch(function () {
      if (root.console) console.warn('[Hoops Dynasty] Legacy save migration will be retried next start.');
    });
  }

  // Read + upgrade older formats transparently (written back on next save).
  function loadFull(b, id) {
    return b.get(id).then(function (raw) {
      if (!raw) return null;
      return raw.schemaVersion === D.SCHEMA_VERSION ? raw : D.migrate(raw);
    });
  }

  function write(b, dynasty) {
    var check = D.validateDynasty(dynasty);
    if (!check.valid) return Promise.reject(new SaveError('invalid', MESSAGES.invalid + ' (' + check.errors[0] + ')'));
    var summary = D.summarize(dynasty);
    return b.put(clone(dynasty), summary).then(function () { return summary; });
  }

  function byRecent(a, b) {
    return (Date.parse(b.lastPlayedAt) || 0) - (Date.parse(a.lastPlayedAt) || 0);
  }

  var api = {
    SaveError: SaveError,

    ready: function () {
      return backend().then(function (b) { return b.name; });
    },

    list: function () {
      return backend().then(function (b) { return b.list(); }).then(function (rows) {
        return rows.slice().sort(byRecent);
      });
    },

    get: function (id) {
      return backend().then(function (b) { return loadFull(b, id); });
    },

    has: function (id) {
      return backend().then(function (b) { return b.get(id); }).then(function (r) { return !!r; });
    },

    mostRecent: function () {
      return api.list().then(function (rows) { return rows[0] || null; });
    },

    create: function (dynasty) {
      return backend().then(function (b) {
        return b.get(dynasty.id).then(function (existing) {
          if (existing) throw new SaveError('exists');   // never overwrite on create
          return write(b, dynasty);
        });
      }).then(function (summary) {
        emit({ type: 'create', id: dynasty.id });
        return summary;
      });
    },

    update: function (dynasty) {
      return backend().then(function (b) {
        return b.get(dynasty.id).then(function (existing) {
          if (!existing) throw new SaveError('not-found');
          var next = clone(dynasty);
          next.updatedAt = new Date().toISOString();
          return write(b, next);
        });
      }).then(function (summary) {
        emit({ type: 'update', id: dynasty.id });
        return summary;
      });
    },

    markPlayed: function (id) {
      var result;
      return backend().then(function (b) {
        return loadFull(b, id).then(function (dynasty) {
          if (!dynasty) throw new SaveError('not-found');
          dynasty.lastPlayedAt = new Date().toISOString();
          result = dynasty;
          return write(b, dynasty);
        });
      }).then(function () {
        emit({ type: 'played', id: id });
        return clone(result);
      });
    },

    remove: function (id) {
      return backend().then(function (b) {
        return b.get(id).then(function (existing) {
          if (!existing) throw new SaveError('not-found');
          return b.remove(id);
        });
      }).then(function () {
        emit({ type: 'remove', id: id });
      });
    },

    exportFile: function (id) {
      return api.get(id).then(function (dynasty) {
        if (!dynasty) throw new SaveError('not-found');
        return {
          filename: D.exportFilename(dynasty),
          text: JSON.stringify(D.exportPayload(dynasty), null, 2)
        };
      });
    },

    parseImport: function (text) {
      return Promise.resolve().then(function () { return D.parseExport(text); });
    },

    /**
     * mode 'new'      — id must be free
     * mode 'replace'  — overwrite the save with the same id (user confirmed)
     * mode 'separate' — store under a fresh id; the original stays untouched
     */
    importDynasty: function (dynasty, mode) {
      var next = clone(dynasty);
      return backend().then(function (b) {
        return b.get(next.id).then(function (existing) {
          if (mode === 'separate') {
            next.id = D.makeId();
          } else if (mode === 'replace') {
            if (!existing) mode = 'new';
          } else if (existing) {
            throw new SaveError('exists');
          }
          return write(b, next);
        });
      }).then(function (summary) {
        emit({ type: 'import', id: next.id, mode: mode });
        return summary;
      });
    },

    subscribe: function (fn) {
      listeners.push(fn);
      return function () { listeners = listeners.filter(function (l) { return l !== fn; }); };
    }
  };

  root.HDSaves = api;
})(typeof self !== 'undefined' ? self : this);
