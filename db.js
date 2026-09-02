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
const DB_VERSION = 1;
const STORE_NAME = 'saves';

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
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
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
