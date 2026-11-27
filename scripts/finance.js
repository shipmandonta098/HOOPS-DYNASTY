/* ==========================================================================
   HOOPS DYNASTY — finance configuration and calculations
   League-wide thresholds (salary cap, luxury tax) are configuration stored
   in each dynasty save (finances.config) so future seasons can grow them.

   Team payroll is DERIVED from player contracts: the cap charges in
   save.contracts (scripts/contracts.js, the single source), passed in as
   a number. Without contract data payroll is null ("unavailable") rather
   than an invented figure.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HDFinance = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_CONFIG = Object.freeze({
    currency: 'USD',
    salaryCap: 141000000,
    luxuryTax: 171300000,
    // Incremental tax: rate per $1 over the line, for each $5M bracket;
    // brackets past the table add 0.5 each.
    taxBracketSize: 5000000,
    taxRates: [1.5, 1.75, 2.5, 3.25]
  });

  // overrides: { salaryCap, luxuryTax } from the dynasty's league rules
  function initFinances(seasonYear, overrides) {
    var config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    if (overrides) {
      if (typeof overrides.salaryCap === 'number') config.salaryCap = overrides.salaryCap;
      if (typeof overrides.luxuryTax === 'number') config.luxuryTax = overrides.luxuryTax;
    }
    return {
      seasonYear: seasonYear,
      config: config,
      // Per-team ledgers (revenue, expenses...) land here later.
      teams: {}
    };
  }

  // Sum of active contract salaries; null when no contract data exists.
  function payroll(roster) {
    var withContracts = roster.filter(function (p) { return p.contract && typeof p.contract.salary === 'number'; });
    if (!withContracts.length) return null;
    return withContracts.reduce(function (sum, p) { return sum + p.contract.salary; }, 0);
  }

  function taxBill(pay, config) {
    var over = pay - config.luxuryTax;
    if (over <= 0) return 0;
    var bill = 0, bracket = 0;
    while (over > 0) {
      var amount = Math.min(over, config.taxBracketSize);
      var rate = bracket < config.taxRates.length
        ? config.taxRates[bracket]
        : config.taxRates[config.taxRates.length - 1] + 0.5 * (bracket - config.taxRates.length + 1);
      bill += amount * rate;
      over -= amount;
      bracket++;
    }
    return Math.round(bill);
  }

  /**
   * rosterOrPayroll: the team's payroll (number, from HDContracts.teamPayroll)
   *                  or a roster (legacy `contract.salary` fields)
   * -> { payroll|null, salaryCap, luxuryTax, capSpace|null, taxStatus, taxBill|null }
   * taxStatus: 'unavailable' | 'under-cap' | 'over-cap' | 'taxpayer'
   */
  function teamSummary(finances, rosterOrPayroll) {
    var config = (finances && finances.config) || DEFAULT_CONFIG;
    var pay = typeof rosterOrPayroll === 'number' ? rosterOrPayroll : Array.isArray(rosterOrPayroll) ? payroll(rosterOrPayroll) : null;
    var status = 'unavailable';
    if (pay != null) status = pay > config.luxuryTax ? 'taxpayer' : pay > config.salaryCap ? 'over-cap' : 'under-cap';
    return {
      payroll: pay,
      salaryCap: config.salaryCap,
      luxuryTax: config.luxuryTax,
      capSpace: pay == null ? null : config.salaryCap - pay,
      taxStatus: status,
      taxBill: pay == null ? null : taxBill(pay, config)
    };
  }

  var STATUS_LABELS = {
    'unavailable': 'Unavailable',
    'under-cap': 'Under the Cap',
    'over-cap': 'Over the Cap',
    'taxpayer': 'Luxury Taxpayer'
  };

  function money(value) {
    if (value == null || !isFinite(value)) return '—';
    var sign = value < 0 ? '−' : '';
    var abs = Math.abs(value);
    return sign + '$' + (abs >= 1e6 ? (abs / 1e6).toFixed(1) + 'M' : Math.round(abs / 1e3) + 'K');
  }

  return {
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    STATUS_LABELS: STATUS_LABELS,
    initFinances: initFinances,
    payroll: payroll,
    taxBill: taxBill,
    teamSummary: teamSummary,
    money: money
  };
});
