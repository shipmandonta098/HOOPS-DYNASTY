/* ==========================================================================
   HOOPS DYNASTY — league contract rules (single source)
   Every amount is a share of the league's salary cap (league rules), so
   custom caps scale everything. Modeled on the structure of the NBA's
   collective bargaining agreement, simplified where the game has no
   matching mechanic yet (documented below).
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HDContractRules = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Minimum salary by years of experience (share of the cap), 10+ = last
  var MINIMUM = [0.0082, 0.0132, 0.0148, 0.0153, 0.0159, 0.0172, 0.0185, 0.0198, 0.0211, 0.0212, 0.0235];

  // Maximum salary by years of experience (first-year salary, share of cap)
  var MAXIMUM = [
    { minExp: 10, share: 0.35 },
    { minExp: 7, share: 0.30 },
    { minExp: 0, share: 0.25 }
  ];
  // "Supermax" (designated veteran) requires award eligibility (MVP / All-League /
  // DPOY in recent seasons). Awards aren't simulated yet, so it is never assigned.
  var SUPERMAX = { share: 0.35, minExp: 7, maxExp: 9, requiresAwards: true };

  // Rookie scale: first-round picks, four seasons (years 3 and 4 team options)
  var ROOKIE = {
    YEARS: 4,
    FIRST_PICK_SHARE: 0.0715, LAST_PICK_SHARE: 0.0158, CURVE: 1.6,
    RAISES: [1, 1.05, 1.05, 1.1],             // year-over-year multipliers
    TEAM_OPTION_YEARS: [3, 4]
  };

  var RAISE = 0.05;                          // annual raise on veteran deals
  var PAYDAYS = 12;                          // semi-monthly paychecks, Nov 15 – Apr 30

  // Contract types the game can create today; others are architecture only
  var TYPES = {
    'rookie-scale': { label: 'Rookie Scale', supported: true },
    'veteran': { label: 'Veteran', supported: true },
    'minimum': { label: 'Minimum', supported: true },
    'maximum': { label: 'Maximum', supported: true },
    'supermax': { label: 'Designated Veteran (Supermax)', supported: false, note: 'requires awards' },
    'two-way': { label: 'Two-Way', supported: false, note: 'requires two-way roster slots' },
    'short-term': { label: 'Short-Term', supported: false, note: 'requires in-season signings' }
  };

  function minimumFor(exp, cap) { return Math.round(cap * MINIMUM[Math.max(0, Math.min(MINIMUM.length - 1, exp))]); }
  function maximumFor(exp, cap) {
    for (var i = 0; i < MAXIMUM.length; i++) if (exp >= MAXIMUM[i].minExp) return Math.round(cap * MAXIMUM[i].share);
    return Math.round(cap * MAXIMUM[MAXIMUM.length - 1].share);
  }
  function rookieScale(pick, cap) {
    var p = Math.max(1, Math.min(30, pick));
    var share = ROOKIE.LAST_PICK_SHARE + (ROOKIE.FIRST_PICK_SHARE - ROOKIE.LAST_PICK_SHARE) * Math.pow((30 - p) / 29, ROOKIE.CURVE);
    return Math.round(cap * share);
  }

  /* Free agency (implemented rule): a player finishing a rookie-scale
     contract becomes a Restricted Free Agent (subject to a qualifying
     offer); everyone else becomes Unrestricted. */
  function freeAgencyStatus(contract) { return contract && contract.type === 'rookie-scale' ? 'RFA' : 'UFA'; }

  return {
    MINIMUM: MINIMUM, MAXIMUM: MAXIMUM, SUPERMAX: SUPERMAX, ROOKIE: ROOKIE, RAISE: RAISE, PAYDAYS: PAYDAYS, TYPES: TYPES,
    minimumFor: minimumFor, maximumFor: maximumFor, rookieScale: rookieScale, freeAgencyStatus: freeAgencyStatus
  };
});
