/* ==========================================================================
   HOOPS DYNASTY — season & calendar utility (single source of truth)

   Conventions
   - A season is identified internally by its START year:
       seasonYear 2025  ->  the 2025–26 season (Oct 2025 – Jun 2026)
     calendar.seasonYear in every save uses this convention.
   - Players choose an INAUGURAL SEASON YEAR, the year the season ENDS:
       2026 -> 2025–26 season, preseason begins October 2025.
   - Label = full start year + "–" + last two digits of the end year
       (1939 -> "1939–40", 2499 -> "2499–00", 9999 -> "9999–00").

   Game dates are strings "YYYY-MM-DD" (year zero-padded to 4 digits; years
   of 10000+ written in full, e.g. "10000-10-01"). They are built, parsed,
   compared and formatted ONLY here — never with Date.parse(), which can't
   read years above 9999, and never with Date.UTC(), which turns years
   0–99 into 1900–1999.

   Technical limits (the only ones enforced)
   - MIN_INAUGURAL_YEAR 40: rosters include players up to 37 years old and
     the calendar has no year 0, so every birth year stays at 1 AD or later.
   - MAX_INAUGURAL_YEAR 275000: JavaScript dates (used to name weekdays and
     months) end in September 275760; this leaves room for centuries of
     seasons after the inaugural one.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HDSeason = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MIN_INAUGURAL_YEAR = 40;
  var MAX_INAUGURAL_YEAR = 275000;

  // First in-game date of each phase, relative to the season's start year
  var PHASE_DATES = {
    'preseason':      { offset: 0, month: 10, day: 1 },
    'regular-season': { offset: 0, month: 10, day: 21 },
    'playoffs':       { offset: 1, month: 4, day: 18 },
    'offseason':      { offset: 1, month: 7, day: 1 }
  };
  var OPENING = { month: 10, day: 1 };        // ages are measured on opening day

  function pad2(n) { return String(n).padStart(2, '0'); }

  /* --- seasons ----------------------------------------------------------- */

  function startOf(endYear) { return Number(endYear) - 1; }
  function endOf(startYear) { return Number(startYear) + 1; }

  // 2025 -> "2025–26", 1999 -> "1999–00", 9999 -> "9999–00"
  function label(startYear) {
    var s = Number(startYear);
    return s + '–' + pad2(endOf(s) % 100);
  }

  // Inaugural season year (end year) -> season
  function fromInauguralYear(endYear) {
    var start = startOf(endYear);
    return { startYear: start, endYear: Number(endYear), label: label(start) };
  }

  // The real-world calendar year (default inaugural season year)
  function currentYear() { return new Date().getFullYear(); }

  /* --- game dates ---------------------------------------------------------- */

  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  function daysInMonth(y, m) { return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; }

  // (2025, 10, 1) -> "2025-10-01"; (39, 10, 1) -> "0039-10-01"; (10000, ...) -> "10000-10-01"
  function isoDate(year, month, day) {
    var y = Number(year);
    return (y < 10000 ? String(y).padStart(4, '0') : String(y)) + '-' + pad2(month) + '-' + pad2(day);
  }

  // "YYYY-MM-DD" (4+ digit year) -> { year, month, day } or null if invalid
  function parseDate(text) {
    var m = /^(\d{4,6})-(\d{2})-(\d{2})$/.exec(String(text == null ? '' : text));
    if (!m) return null;
    var y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    if (y < 1 || mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
    return { year: y, month: mo, day: d };
  }

  function isValidDate(text) { return parseDate(text) !== null; }

  function compareDates(a, b) {
    var x = parseDate(a), y = parseDate(b);
    return (x.year - y.year) || (x.month - y.month) || (x.day - y.day);
  }

  // Whole years between a birth date and another date
  function ageOn(birthIso, onIso) {
    var b = parseDate(birthIso), o = parseDate(onIso);
    if (!b || !o) return null;
    var age = o.year - b.year;
    if (o.month < b.month || (o.month === b.month && o.day < b.day)) age--;
    return age;
  }

  // JavaScript Date for formatting only (setUTCFullYear keeps years 0–99 intact)
  function toJsDate(parts) {
    var d = new Date(0);
    d.setUTCFullYear(parts.year, parts.month - 1, parts.day);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  var FORMATS = {};
  function formatter(style) {
    if (!FORMATS[style]) {
      var opts = {
        short:  { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' },
        medium: { month: 'short', day: 'numeric', year: 'numeric' },
        long:   { month: 'long', day: 'numeric', year: 'numeric' }
      }[style] || { month: 'short', day: 'numeric', year: 'numeric' };
      opts.timeZone = 'UTC';
      FORMATS[style] = new Intl.DateTimeFormat(undefined, opts);
    }
    return FORMATS[style];
  }

  // "2025-10-01" -> "Wed, Oct 1, 2025" (short) / "Oct 1, 2025" / "October 1, 2025"
  function formatDate(iso, style) {
    var parts = parseDate(iso);
    if (!parts) return '—';
    return formatter(style || 'medium').format(toJsDate(parts));
  }

  /* --- calendar ------------------------------------------------------------ */

  function phaseStartDate(startYear, phase) {
    var p = PHASE_DATES[phase] || PHASE_DATES.preseason;
    return isoDate(Number(startYear) + p.offset, p.month, p.day);
  }

  function openingDay(startYear) { return isoDate(startYear, OPENING.month, OPENING.day); }

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

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  // "October 2025"
  function openingMonthLabel(startYear) { return MONTHS[OPENING.month - 1] + ' ' + Number(startYear); }

  return {
    MIN_INAUGURAL_YEAR: MIN_INAUGURAL_YEAR,
    MAX_INAUGURAL_YEAR: MAX_INAUGURAL_YEAR,
    startOf: startOf,
    endOf: endOf,
    label: label,
    fromInauguralYear: fromInauguralYear,
    currentYear: currentYear,
    isoDate: isoDate,
    parseDate: parseDate,
    isValidDate: isValidDate,
    compareDates: compareDates,
    ageOn: ageOn,
    formatDate: formatDate,
    phaseStartDate: phaseStartDate,
    openingDay: openingDay,
    nextCalendar: nextCalendar,
    openingMonthLabel: openingMonthLabel
  };
});
