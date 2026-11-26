/* ==========================================================================
   HOOPS DYNASTY — season & calendar utility (single source of truth)

   Conventions
   - A season is identified internally by its START year:
       seasonYear 2025  ->  the 2025–26 season (Oct 2025 – Jun 2026)
     calendar.seasonYear in every save uses this convention.
   - Players choose an INAUGURAL SEASON YEAR, which is the year the season
     ENDS:  2026 -> 2025–26 season, preseason begins October 2025.
   - Label = full start year + "–" + last two digits of the end year
       (1999 -> "1999–00", 2025 -> "2025–26").

   Every screen and system formats seasons and derives dates through here.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HDSeason = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var OPENING_MONTH_DAY = '10-01';           // preseason / ages are measured here
  // First in-game date of each phase, relative to the season's start year
  var PHASE_DATES = {
    'preseason':      { offset: 0, monthDay: '10-01' },
    'regular-season': { offset: 0, monthDay: '10-21' },
    'playoffs':       { offset: 1, monthDay: '04-18' },
    'offseason':      { offset: 1, monthDay: '07-01' }
  };

  function startOf(endYear) { return Number(endYear) - 1; }
  function endOf(startYear) { return Number(startYear) + 1; }

  // 2025 -> "2025–26", 1999 -> "1999–00"
  function label(startYear) {
    var s = Number(startYear);
    return s + '–' + String(endOf(s) % 100).padStart(2, '0');
  }

  // Inaugural season year (end year) -> season
  function fromInauguralYear(endYear) {
    var start = startOf(endYear);
    return { startYear: start, endYear: Number(endYear), label: label(start) };
  }

  // ISO date (yyyy-mm-dd) a phase begins in the season starting startYear
  function phaseStartDate(startYear, phase) {
    var p = PHASE_DATES[phase] || PHASE_DATES.preseason;
    return (Number(startYear) + p.offset) + '-' + p.monthDay;
  }

  function openingDay(startYear) { return Number(startYear) + '-' + OPENING_MONTH_DAY; }

  // Calendar for the season after `calendar` (e.g. 2025–26 -> 2026–27)
  function nextCalendar(calendar) {
    var start = Number(calendar.seasonYear) + 1;
    return {
      startYear: calendar.startYear,
      seasonYear: start,
      seasonLabel: label(start),
      phase: 'preseason',
      currentDate: phaseStartDate(start, 'preseason')
    };
  }

  // "Begins October 2025" style text for a season
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function openingMonthLabel(startYear) {
    return MONTHS[Number(OPENING_MONTH_DAY.slice(0, 2)) - 1] + ' ' + Number(startYear);
  }

  return {
    startOf: startOf,
    endOf: endOf,
    label: label,
    fromInauguralYear: fromInauguralYear,
    phaseStartDate: phaseStartDate,
    openingDay: openingDay,
    nextCalendar: nextCalendar,
    openingMonthLabel: openingMonthLabel
  };
});
