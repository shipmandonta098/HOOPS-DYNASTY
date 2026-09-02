'use strict';

/**
 * db.js — Browser-side IndexedDB storage for Hoops Dynasty save files.
 *
 * This is a BROWSER module (ES module, uses the IndexedDB API). It does NOT run
 * in Node — the engine/ modules are Node/CommonJS; this is the front-end's local
 * persistence layer. Import it into your page with:
 *
 *     import { saveLeague, loadLeague, listSaves, deleteSave } from './db.js';
 *
 * WHY INDEXEDDB:
 * The whole league is one JSON object (see saves/*.json). IndexedDB lets us keep
 * many of those save objects in the browser, keyed by a save id, so the user can
 * save/load without touching the filesystem or re-uploading a file each time.
 *
 * DESIGN NOTES (kept simple so it's easy to modify later):
 *   - One database ("BasketballGM"), one object store ("saves"), keyPath "id".
 *   - Each record is a small wrapper: { id, data, updatedAt }.
 *       `data`      = the full league JSON you passed to saveLeague().
 *       `updatedAt` = ISO timestamp, handy for a "most recent" list.
 *     We wrap rather than storing the league directly so the league object never
 *     needs its own `id` field — the store's key is separate from league content.
 *   - Every function returns a Promise and rejects with a real Error on failure.
 */

const DB_NAME = 'BasketballGM';
const DB_VERSION = 2;
const STORE_NAME = 'saves';

/**
 * Multi-store schema for the season-compression system (compressSeason.js).
 * These stores use OUT-OF-LINE keys (no keyPath) — the caller passes an
 * explicit key to saveData(store, key, value). That's why season records can
 * be keyed by year and players/teams by their own id without the value needing
 * to embed the key. To add another store later: add its name here and bump
 * DB_VERSION so onupgradeneeded runs again.
 */
const DATA_STORES = [
  'league_meta',
  'teams',
  'players',
  'history_seasons',
  'history_awards',
  'draft_classes',
  'transactions',
];

/**
 * Open (and if needed, create/upgrade) the database. The result is cached so we
 * only open the connection once per page load. Returns Promise<IDBDatabase>.
 *
 * The object store + keyPath are created in `onupgradeneeded`, which fires on
 * first use or whenever DB_VERSION increases — that's where future schema
 * changes (new stores, indexes) would go.
 */
let _dbPromise = null;
function openDB() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Runs on first creation or a version bump — the only place to define stores.
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      // The original single-store save slots (keyPath 'id').
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      // The multi-store schema (out-of-line keys) used by the season system.
      for (const name of DATA_STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name);
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB.'));
    request.onblocked = () =>
      reject(new Error('IndexedDB open blocked — close other tabs using this database.'));
  });

  return _dbPromise;
}

/**
 * Internal helper: run one transaction against the saves store and resolve with
 * the result of `action(store)`. Keeps every public function tiny and consistent
 * in how it handles success/error. `mode` is 'readonly' or 'readwrite'.
 */
async function withStore(mode, action) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    let request;
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);

    try {
      request = action(store);
    } catch (err) {
      reject(err);
      return;
    }

    // Prefer the request's own result; fall back to tx completion for writes.
    tx.oncomplete = () => resolve(request ? request.result : undefined);
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed.'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted.'));
  });
}

/**
 * Store (create or overwrite) a league save under `id`.
 * @param {string} id   - a save slot name, e.g. "my-dynasty" or "autosave".
 * @param {object} data - the full league JSON object.
 * @returns {Promise<string>} resolves with the id that was written.
 */
export async function saveLeague(id, data) {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('saveLeague: id must be a non-empty string.');
  }
  if (data === null || typeof data !== 'object') {
    throw new Error('saveLeague: data must be a league object.');
  }
  const record = { id, data, updatedAt: new Date().toISOString() };
  await withStore('readwrite', (store) => store.put(record));
  return id;
}

/**
 * Retrieve a league save by `id`.
 * @param {string} id
 * @returns {Promise<object|null>} the league JSON, or null if no such save.
 */
export async function loadLeague(id) {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('loadLeague: id must be a non-empty string.');
  }
  const record = await withStore('readonly', (store) => store.get(id));
  return record ? record.data : null;
}

/**
 * List all save ids currently stored.
 * @returns {Promise<string[]>} array of save ids (empty array if none).
 */
export async function listSaves() {
  const keys = await withStore('readonly', (store) => store.getAllKeys());
  return keys || [];
}

/**
 * Delete a save by `id`. Resolves whether or not the id existed (idempotent).
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteSave(id) {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('deleteSave: id must be a non-empty string.');
  }
  await withStore('readwrite', (store) => store.delete(id));
}

/**
 * OPTIONAL EXTRAS (uncomment / build on as needed):
 * List saves with their timestamps, newest first — useful for a save-slot menu.
 */
export async function listSavesDetailed() {
  const records = await withStore('readonly', (store) => store.getAll());
  return (records || [])
    .map((r) => ({ id: r.id, updatedAt: r.updatedAt }))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

/* ===========================================================================
 * GENERIC MULTI-STORE API
 * ---------------------------------------------------------------------------
 * A small, uniform key/value interface over the DATA_STORES above. These power
 * the multi-store architecture (league_meta, teams, players, history_seasons,
 * history_awards, draft_classes, transactions) and the season-compression
 * system in compressSeason.js. Keys are out-of-line — you pass them explicitly.
 *
 *   saveData(store, key, value) -> Promise<key>
 *   loadData(store, key)        -> Promise<value|null>
 *   deleteData(store, key)      -> Promise<void>
 *   getAllData(store)           -> Promise<Array<{ key, value }>>
 * ======================================================================== */

/** Guard: make sure callers only touch stores that exist. */
function assertStore(store) {
  if (!DATA_STORES.includes(store)) {
    throw new Error(
      `Unknown store "${store}". Known data stores: ${DATA_STORES.join(', ')}.`
    );
  }
}

/**
 * Run a single transaction against one data store and resolve with the result
 * of `action(objectStore)`. Mirrors withStore() but for arbitrary stores.
 */
async function withDataStore(store, mode, action) {
  assertStore(store);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    let request;
    const tx = db.transaction(store, mode);
    const os = tx.objectStore(store);
    try {
      request = action(os);
    } catch (err) {
      reject(err);
      return;
    }
    tx.oncomplete = () => resolve(request ? request.result : undefined);
    tx.onerror = () => reject(tx.error || new Error(`Transaction failed on "${store}".`));
    tx.onabort = () => reject(tx.error || new Error(`Transaction aborted on "${store}".`));
  });
}

/** Store (create or overwrite) `value` at `key` in `store`. */
export async function saveData(store, key, value) {
  if (key === undefined || key === null) {
    throw new Error('saveData: key is required.');
  }
  await withDataStore(store, 'readwrite', (os) => os.put(value, key));
  return key;
}

/** Retrieve the value at `key` in `store`, or null if absent. */
export async function loadData(store, key) {
  const result = await withDataStore(store, 'readonly', (os) => os.get(key));
  return result === undefined ? null : result;
}

/** Remove `key` from `store`. Idempotent. */
export async function deleteData(store, key) {
  await withDataStore(store, 'readwrite', (os) => os.delete(key));
}

/**
 * Return every record in `store` as { key, value } pairs. compressSeason.js
 * relies on this shape so it can rewrite records back at their original key.
 */
export async function getAllData(store) {
  assertStore(store);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const os = db.transaction(store, 'readonly').objectStore(store);
    const keysReq = os.getAllKeys();
    const valsReq = os.getAll();
    let keys = null;
    let vals = null;
    const done = () => {
      if (keys === null || vals === null) return;
      resolve(keys.map((k, i) => ({ key: k, value: vals[i] })));
    };
    keysReq.onsuccess = () => { keys = keysReq.result; done(); };
    valsReq.onsuccess = () => { vals = valsReq.result; done(); };
    keysReq.onerror = () => reject(keysReq.error);
    valsReq.onerror = () => reject(valsReq.error);
  });
}
