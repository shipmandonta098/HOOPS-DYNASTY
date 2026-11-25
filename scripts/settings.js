/* ==========================================================================
   HOOPS DYNASTY — Settings screen behaviour
   Wires the settings markup (#settings-screen in index.html) to HDPrefs.
   Navigation in/out of the screen is owned by the page's screen router,
   which passes an onBack callback.

   Usage: HDSettings.init({ root: element, onBack: fn })
   ========================================================================== */
(function () {
  'use strict';

  var STATUS_IDLE = 'Changes are saved automatically.';
  var STATUS_SAVED = 'Saved.';
  var STATUS_RESET = 'Restored defaults: Original theme, Medium text.';
  var STATUS_UNSAVED = 'Applied, but this browser is blocking storage, so it won’t be remembered.';

  function init(options) {
    var root = options.root;
    var onBack = options.onBack || function () {};
    var prefs = window.HDPrefs;
    var status = root.querySelector('[data-settings-status]');
    var statusTimer = null;

    function setStatus(text, warning) {
      clearTimeout(statusTimer);
      status.textContent = text;
      status.classList.toggle('is-warning', !!warning);
      if (!warning && text !== STATUS_IDLE) {
        statusTimer = setTimeout(function () { setStatus(STATUS_IDLE); }, 2600);
      }
    }

    // Reflect the current preferences in the radio buttons.
    function sync(current) {
      root.querySelectorAll('input[name="theme"]').forEach(function (input) {
        input.checked = input.value === current.theme;
      });
      root.querySelectorAll('input[name="text-size"]').forEach(function (input) {
        input.checked = input.value === current.textSize;
      });
    }

    root.addEventListener('change', function (e) {
      var input = e.target;
      if (input.name === 'theme') prefs.set({ theme: input.value });
      else if (input.name === 'text-size') prefs.set({ textSize: input.value });
    });

    var pendingReset = false;
    root.querySelector('[data-settings-reset]').addEventListener('click', function () {
      pendingReset = true;
      prefs.reset();
    });

    root.querySelector('[data-settings-back]').addEventListener('click', function () {
      onBack();
    });

    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        onBack();
      }
    });

    prefs.subscribe(function (current, info) {
      sync(current);
      if (info && info.saved === false) setStatus(STATUS_UNSAVED, true);
      else setStatus(pendingReset ? STATUS_RESET : STATUS_SAVED);
      pendingReset = false;
    });

    sync(prefs.get());
    setStatus(STATUS_IDLE);
  }

  window.HDSettings = { init: init };
})();
