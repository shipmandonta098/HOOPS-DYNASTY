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

  // rngNext: function returning [0, 1)
  function pick(rngNext) {
    var r = rngNext() * TOTAL;
    for (var i = 0; i < WEIGHTED.length; i++) {
      r -= WEIGHTED[i].weight;
      if (r < 0) return WEIGHTED[i].name;
    }
    return WEIGHTED[WEIGHTED.length - 1].name;
  }

  var ALL = WEIGHTED.map(function (x) { return x.name; });
  function tierOf(name) {
    for (var i = 0; i < WEIGHTED.length; i++) if (WEIGHTED[i].name === name) return WEIGHTED[i].tier;
    return null;
  }

  return { TIERS: TIERS, ALL: ALL, pick: pick, tierOf: tierOf };
});
