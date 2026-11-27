/* ==========================================================================
   HOOPS DYNASTY — U.S. college basketball programs (real schools, text only)
   Tiers set how often a program appears. Selection is NOT limited to
   prestigious programs: mid-majors, HBCUs and smaller Division I schools
   all produce professionals.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HDColleges = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function list(s) { return s.split('|').map(function (x) { return x.trim(); }).filter(Boolean); }

  var TIERS = {
    'blue-blood': { weight: 4, schools: list('Duke|Kentucky|North Carolina|Kansas|UCLA|Connecticut|Michigan State|Villanova|Gonzaga|Arizona|Indiana|Louisville') },
    'power': { weight: 2, schools: list('Florida|Auburn|Georgia|Alabama|Arkansas|Tennessee|LSU|Texas|Baylor|Houston|Texas Tech|' +
      'Oklahoma|Oklahoma State|Kansas State|Iowa State|TCU|West Virginia|Cincinnati|BYU|Utah|Colorado|Arizona State|USC|Oregon|' +
      'Washington|Stanford|California|Michigan|Ohio State|Purdue|Illinois|Iowa|Wisconsin|Maryland|Minnesota|Northwestern|' +
      'Nebraska|Penn State|Rutgers|Syracuse|Virginia|Virginia Tech|Wake Forest|NC State|Clemson|Florida State|Miami|Pittsburgh|' +
      'Georgia Tech|Notre Dame|Marquette|Creighton|Xavier|Providence|St. John\'s|Seton Hall|Georgetown|Butler|DePaul|' +
      'Memphis|Ole Miss|Mississippi State|Missouri|South Carolina|Texas A&M|Vanderbilt|SMU') },
    'mid-major': { weight: 1, schools: list('San Diego State|Saint Mary\'s|Dayton|VCU|Wichita State|Loyola Chicago|Belmont|Drake|' +
      'Murray State|Davidson|Richmond|Saint Louis|UNLV|New Mexico|Boise State|Utah State|Colorado State|Nevada|Florida Atlantic|' +
      'Charleston|Furman|Wofford|Vermont|Oral Roberts|Northern Iowa|Missouri State|Bradley|Illinois State|Southern Illinois|' +
      'Western Kentucky|Middle Tennessee|Louisiana Tech|UAB|Old Dominion|George Mason|Rhode Island|Saint Joseph\'s|Toledo|' +
      'Akron|Kent State|Ohio|Buffalo|Ball State|UC Santa Barbara|UC Irvine|Long Beach State|Hawaii|Weber State|Montana|' +
      'Eastern Washington|Santa Clara|San Francisco|Pepperdine|Loyola Marymount|Chattanooga|Wright State|Iona|Princeton|Yale') },
    'hbcu': { weight: 0.7, schools: list('Howard|North Carolina A&T|Norfolk State|Grambling State|Jackson State|Texas Southern|' +
      'Morgan State|Hampton|Southern|Alcorn State|Florida A&M|North Carolina Central|Prairie View A&M|Coppin State|Delaware State') },
    'small-d1': { weight: 0.5, schools: list('Lamar|Stephen F. Austin|Sam Houston|Abilene Christian|Grand Canyon|Southern Utah|' +
      'Sacramento State|Northern Colorado|Idaho State|Detroit Mercy|Fairfield|Siena|Rider|Wagner|Robert Morris|Morehead State|' +
      'Eastern Kentucky|Tennessee State|Austin Peay|Little Rock|UT Arlington|North Texas|Texas State|Arkansas State|Troy|' +
      'Georgia Southern|Mercer|Samford|Winthrop|Radford|Liberty|Campbell|Jacksonville|Stetson|Bucknell|Lehigh|Colgate|Hofstra') }
  };

  // Flat weighted list built once
  var WEIGHTED = [];
  Object.keys(TIERS).forEach(function (tier) {
    TIERS[tier].schools.forEach(function (name) { WEIGHTED.push({ name: name, tier: tier, weight: TIERS[tier].weight }); });
  });
  var TOTAL = WEIGHTED.reduce(function (s, x) { return s + x.weight; }, 0);

  /* --- Women's programs --------------------------------------------------
     Women's college basketball has its own history of dominance, so the
     women's feeder system is weighted separately:
       dynasty  — the sport's most decorated programs (Connecticut's 11+
                  titles, Tennessee's 8, plus South Carolina, Stanford,
                  Baylor and Notre Dame, all multiple-time champions)
       elite    — other national champions and perennial powers
                  (Louisiana Tech, Old Dominion, USC, Texas, Texas Tech,
                  Purdue, Maryland, Texas A&M, LSU ...)
     Every other school above stays in the pool at a lower weight. */
  var WOMENS_TIERS = {
    'dynasty': { weight: 9, schools: list('Connecticut|Tennessee|South Carolina|Stanford|Baylor|Notre Dame') },
    'elite': { weight: 4, schools: list('Louisiana Tech|Old Dominion|USC|Texas|Texas Tech|Purdue|Maryland|Texas A&M|LSU|' +
      'Iowa|UCLA|Duke|Mississippi State|Louisville|Oregon|NC State|Ohio State|Rutgers|Georgia|Virginia|Indiana|Iowa State|' +
      'North Carolina|Florida State|Oklahoma|Arizona|Michigan|Kentucky|Ole Miss|Utah|Gonzaga|Creighton|Villanova|Princeton|' +
      'Washington State|Oregon State|Western Kentucky|Colorado|Miami|Arkansas') }
  };
  var WOMENS_BASE = { 'blue-blood': 1.5, 'power': 1.5, 'mid-major': 1, 'hbcu': 0.7, 'small-d1': 0.5 };
  var WOMENS_WEIGHTED = (function () {
    var byName = {};
    Object.keys(TIERS).forEach(function (tier) {
      TIERS[tier].schools.forEach(function (name) { byName[name] = { name: name, tier: tier, weight: WOMENS_BASE[tier] }; });
    });
    Object.keys(WOMENS_TIERS).forEach(function (tier) {
      WOMENS_TIERS[tier].schools.forEach(function (name) { byName[name] = { name: name, tier: 'womens-' + tier, weight: WOMENS_TIERS[tier].weight }; });
    });
    return Object.keys(byName).map(function (k) { return byName[k]; });
  })();
  var WOMENS_TOTAL = WOMENS_WEIGHTED.reduce(function (s, x) { return s + x.weight; }, 0);

  // rngNext: function returning [0, 1); gender 'F' uses the women's feeder system
  function pick(rngNext, gender) {
    if (gender === 'F') {
      var rf = rngNext() * WOMENS_TOTAL;
      for (var j = 0; j < WOMENS_WEIGHTED.length; j++) {
        rf -= WOMENS_WEIGHTED[j].weight;
        if (rf < 0) return WOMENS_WEIGHTED[j].name;
      }
      return WOMENS_WEIGHTED[WOMENS_WEIGHTED.length - 1].name;
    }
    var r = rngNext() * TOTAL;
    for (var i = 0; i < WEIGHTED.length; i++) {
      r -= WEIGHTED[i].weight;
      if (r < 0) return WEIGHTED[i].name;
    }
    return WEIGHTED[WEIGHTED.length - 1].name;
  }

  var ALL = WOMENS_WEIGHTED.map(function (x) { return x.name; });   // every school (men's + women's lists)
  function tierOf(name) {
    for (var i = 0; i < WEIGHTED.length; i++) if (WEIGHTED[i].name === name) return WEIGHTED[i].tier;
    return null;
  }

  return { TIERS: TIERS, WOMENS_TIERS: WOMENS_TIERS, ALL: ALL, pick: pick, tierOf: tierOf };
});
