/* ==========================================================================
   HOOPS DYNASTY — display preferences (theme + text size)

   Load this as a plain, blocking <script> in <head>, BEFORE any stylesheet
   that paints the page. It applies the saved preferences to <html> right away
   so the first frame is already in the right theme (no flash).

   Everything visual is driven by two attributes on <html>:
     data-theme="original" | "dark" | "light"
     data-text-size="small" | "medium" | "large" | "xlarge"
   styles/theme.css maps those to CSS custom properties, so any screen that
   uses the tokens (var(--bg), var(--text), rem font sizes, ...) follows the
   preferences automatically.

   Public API (window.HDPrefs):
     HDPrefs.get()                  -> { theme, textSize }
     HDPrefs.set({ theme?, textSize? })
     HDPrefs.reset()
     HDPrefs.subscribe(fn)          -> unsubscribe function; fn(prefs)
     HDPrefs.THEMES, HDPrefs.TEXT_SIZES, HDPrefs.DEFAULTS
   ========================================================================== */
(function () {
  'use strict';

  // Kept separate from the dynasty save ('hoopsDynasty.save') on purpose:
  // display preferences belong to the device, not to a particular dynasty.
  var STORAGE_KEY = 'hoopsDynasty.preferences';

  var THEMES = {
    original: { label: 'Original', metaColor: '#0a0a0c' },
    dark:     { label: 'Dark',     metaColor: '#1b1d21' },
    light:    { label: 'Light',    metaColor: '#eceef1' }
  };

  var TEXT_SIZES = {
    small:  { label: 'Small',       scale: 0.9  },
    medium: { label: 'Medium',      scale: 1    },
    large:  { label: 'Large',       scale: 1.15 },
    xlarge: { label: 'Extra Large', scale: 1.3  }
  };

  var DEFAULTS = Object.freeze({ theme: 'original', textSize: 'medium' });

  var listeners = [];
  var current = sanitize(readStored());

  function has(obj, key) {
    return typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key);
  }

  // Anything unknown or malformed falls back to the default for that field.
  function sanitize(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    return {
      theme: has(THEMES, raw.theme) ? raw.theme : DEFAULTS.theme,
      textSize: has(TEXT_SIZES, raw.textSize) ? raw.textSize : DEFAULTS.textSize
    };
  }

  function readStored() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null; // storage blocked (private mode) or corrupt JSON
    }
  }

  function writeStored(prefs) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      return true;
    } catch (err) {
      return false; // still applied for this session, just not remembered
    }
  }

  function apply(prefs) {
    var root = document.documentElement;
    root.setAttribute('data-theme', prefs.theme);
    root.setAttribute('data-text-size', prefs.textSize);

    // Browser chrome (mobile address bar) follows the theme too.
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEMES[prefs.theme].metaColor);
  }

  function commit(next) {
    current = sanitize(next);
    apply(current);
    var saved = writeStored(current);
    var snapshot = get();
    listeners.slice().forEach(function (fn) {
      try { fn(snapshot, { saved: saved }); } catch (err) { /* one bad listener shouldn't block others */ }
    });
    return snapshot;
  }

  function get() {
    return { theme: current.theme, textSize: current.textSize };
  }

  function set(partial) {
    partial = partial || {};
    return commit({
      theme: partial.theme !== undefined ? partial.theme : current.theme,
      textSize: partial.textSize !== undefined ? partial.textSize : current.textSize
    });
  }

  function reset() {
    return commit(DEFAULTS);
  }

  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (l) { return l !== fn; });
    };
  }

  // Another tab changed the preferences: follow along.
  window.addEventListener('storage', function (e) {
    if (e.key !== STORAGE_KEY) return;
    current = sanitize(readStored());
    apply(current);
    var snapshot = get();
    listeners.slice().forEach(function (fn) {
      try { fn(snapshot, { saved: true }); } catch (err) { /* ignore */ }
    });
  });

  apply(current);

  window.HDPrefs = {
    get: get,
    set: set,
    reset: reset,
    subscribe: subscribe,
    THEMES: THEMES,
    TEXT_SIZES: TEXT_SIZES,
    DEFAULTS: DEFAULTS,
    STORAGE_KEY: STORAGE_KEY
  };
})();
