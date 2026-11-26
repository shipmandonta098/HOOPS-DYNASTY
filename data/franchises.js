/* ==========================================================================
   HOOPS DYNASTY — default league franchises (single source of truth)

   30 fictional franchises in real basketball markets: 15 East, 15 West.
   Every UI, the dynasty initializer and the logo generator
   (tools/build-logos.js) read from this file; nothing else hardcodes teams.

   Field notes
     id            Permanent franchise ID. Never reuse or renumber: saves,
                   future relocations and expansion reference teams by it.
     abbreviation  Unique 3-letter code.
     logo.src      Generated SVG in assets/logos/. logo.badge / logo.emblem
                   describe the design; edit them, then run
                   `node tools/build-logos.js` to regenerate the files.
     colors        primary / secondary / tertiary hex values.
     marketSize    'small' | 'medium' | 'large', derived from population
                   (marketSizeFor); independent of team quality.
     population    Approximate metro-area population (2023 estimates,
                   rounded). Drives market size.
     division      One of DIVISIONS; its conference is the team's conference.
     conference    'east' | 'west' (follows the division).
     arena         { name, capacity } — fictional venue names.
     overall       0–100. PROVISIONAL: there is no roster system yet. Once
                   rosters exist, derive this from roster strength (see
                   teamOverall() in scripts/dynasty.js) and treat this value
                   only as a seed.

   Loads as a browser global (window.HDFranchises) or a CommonJS module.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HDFranchises = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CONFERENCES = [
    { id: 'east', name: 'Eastern Conference', shortName: 'East' },
    { id: 'west', name: 'Western Conference', shortName: 'West' }
  ];

  // Three divisions of five per conference.
  var DIVISIONS = [
    { id: 'atlantic',  name: 'Atlantic Division',  shortName: 'Atlantic',  conference: 'east' },
    { id: 'central',   name: 'Central Division',   shortName: 'Central',   conference: 'east' },
    { id: 'southeast', name: 'Southeast Division', shortName: 'Southeast', conference: 'east' },
    { id: 'northwest', name: 'Northwest Division', shortName: 'Northwest', conference: 'west' },
    { id: 'pacific',   name: 'Pacific Division',   shortName: 'Pacific',   conference: 'west' },
    { id: 'southwest', name: 'Southwest Division', shortName: 'Southwest', conference: 'west' }
  ];

  // Ordered largest first; `rank` drives market-size sorting. A market is
  // the largest size whose minPopulation the metro population reaches.
  var MARKET_SIZES = [
    { id: 'large',  label: 'Large',  rank: 3, minPopulation: 4500000 },
    { id: 'medium', label: 'Medium', rank: 2, minPopulation: 2000000 },
    { id: 'small',  label: 'Small',  rank: 1, minPopulation: 0 }
  ];

  function marketSizeFor(population) {
    for (var i = 0; i < MARKET_SIZES.length; i++) if (population >= MARKET_SIZES[i].minPopulation) return MARKET_SIZES[i].id;
    return 'small';
  }

  // id: [division, metro population, arena name, arena capacity]
  var VENUES = {
    'fr-001': ['southeast',  6307000, 'Peachtree Pavilion',      18118],
    'fr-002': ['atlantic',   4919000, 'Harborview Garden',       19156],
    'fr-003': ['atlantic',  19498000, 'Gowanus Arena',           17732],
    'fr-004': ['southeast',  2805000, 'Queen City Coliseum',     19077],
    'fr-005': ['central',    9263000, 'Lakeshore Center',        20917],
    'fr-006': ['central',    2159000, 'Cuyahoga Fieldhouse',     19432],
    'fr-007': ['central',    4342000, 'Motor City Arena',        20332],
    'fr-008': ['central',    2142000, 'Circle City Fieldhouse',  17923],
    'fr-009': ['southeast',  6183000, 'Biscayne Bay Arena',      19600],
    'fr-010': ['central',    1560000, 'Lakefront Forum',         17341],
    'fr-011': ['atlantic',  19498000, 'Hudson Square Garden',    19812],
    'fr-012': ['southeast',  2818000, 'Launchpad Arena',         18846],
    'fr-013': ['atlantic',   6246000, 'Liberty Hall Arena',      20478],
    'fr-014': ['atlantic',   6712000, 'Northern Lights Centre',  19800],
    'fr-015': ['southeast',  6305000, 'Capitol Arena',           20356],
    'fr-016': ['southwest',  8100000, 'Trinity River Arena',     19200],
    'fr-017': ['northwest',  3005000, 'Front Range Arena',       19520],
    'fr-018': ['southwest',  7510000, 'Mission Control Center',  18055],
    'fr-019': ['pacific',   12799000, 'Pacific Coast Arena',     18997],
    'fr-020': ['pacific',   12799000, 'Sunset Boulevard Arena',  19068],
    'fr-021': ['southwest',  1336000, 'Riverboat Pavilion',      17794],
    'fr-022': ['northwest',  3712000, 'North Star Arena',        18978],
    'fr-023': ['southwest',   962000, 'Bayou Coliseum',          16867],
    'fr-024': ['northwest',  1478000, 'Prairie Wind Arena',      18203],
    'fr-025': ['pacific',    5070000, 'Desert Sun Arena',        17071],
    'fr-026': ['northwest',  2508000, 'Rose City Garden',        19393],
    'fr-027': ['pacific',    2421000, 'Gold Rush Pavilion',      17608],
    'fr-028': ['northwest',  1268000, 'Wasatch Center',          18306],
    'fr-029': ['southwest',  2704000, 'Alamo City Arena',        18418],
    'fr-030': ['pacific',    4567000, 'Embarcadero Arena',       18064],

    // Expansion franchises (not in the founding league; added in Customize)
    'fr-031': ['southwest',  1478000, 'Red Earth Arena',         18500],
    'fr-032': ['central',    2423000, 'Allegheny Arena',         18400],
    'fr-033': ['northwest',  4045000, 'Puget Sound Pavilion',    18600],
    'fr-034': ['atlantic',   1677000, 'Narragansett Center',     14500],
    'fr-035': ['central',    2797000, 'Gateway Pavilion',        19000],
    'fr-036': ['northwest',  3000000, 'Burrard Inlet Arena',     18900],
    'fr-037': ['atlantic',   2834000, 'Inner Harbor Arena',      18300],
    'fr-038': ['southeast',  1366000, 'Bluegrass Coliseum',      17800],
    'fr-039': ['southwest', 21800000, 'Palacio del Sol',         22000],
    'fr-040': ['pacific',    3270000, 'Mission Bay Arena',       18000],
    'fr-041': ['atlantic',   1155000, 'Niagara Fieldhouse',      18700],
    'fr-042': ['central',    2271000, 'Ohio River Arena',        17500],
    'fr-043': ['southwest',  2221000, 'Heartland Arena',         18900]
  };

  // Labels for the provisional rating bands (used for display only).
  var RATING_TIERS = [
    { min: 86, label: 'Contender' },
    { min: 79, label: 'Playoff Team' },
    { min: 71, label: 'Middle of the Pack' },
    { min: 0,  label: 'Rebuilding' }
  ];

  function team(id, city, name, abbreviation, conference, marketSize, overall, colors, badge, emblem) {
    var v = VENUES[id];
    return {
      id: id,
      city: city,
      name: name,
      fullName: city + ' ' + name,
      abbreviation: abbreviation,
      conference: conference,
      division: v[0],
      population: v[1],
      marketSize: marketSize,
      arena: { name: v[2], capacity: v[3] },
      overall: overall,
      colors: { primary: colors[0], secondary: colors[1], tertiary: colors[2] },
      logo: { src: 'assets/logos/' + id + '.svg', badge: badge, emblem: emblem }
    };
  }

  var FRANCHISES = [
    /* ---- Eastern Conference ------------------------------------------- */
    team('fr-001', 'Atlanta',        'Phoenix',     'ATL', 'east', 'large',  75, ['#C2451B', '#F6E7D2', '#F2B33D'], 'shield',  'phoenix'),
    team('fr-002', 'Boston',         'Ironsides',   'BOS', 'east', 'large',  86, ['#13294B', '#F4F1EA', '#B5893B'], 'roundel', 'ship'),
    team('fr-003', 'Brooklyn',       'Navigators',  'BKN', 'east', 'large',  67, ['#0F5E66', '#F2EDE4', '#D08447'], 'roundel', 'compass'),
    team('fr-004', 'Charlotte',      'Crown',       'CHA', 'east', 'medium', 66, ['#3F2368', '#E2B53A', '#C3C8D0'], 'shield',  'crown'),
    team('fr-005', 'Chicago',        'Gale',        'CHI', 'east', 'large',  74, ['#24496E', '#EAF2F8', '#8FB8DA'], 'hexagon', 'gale'),
    team('fr-006', 'Cleveland',      'Forge',       'CLE', 'east', 'medium', 85, ['#3D4249', '#E8A33D', '#C4372F'], 'shield',  'anvil'),
    team('fr-007', 'Detroit',        'Dynamos',     'DET', 'east', 'medium', 64, ['#1C5E45', '#E9EDEF', '#9FD356'], 'roundel', 'gear'),
    team('fr-008', 'Indianapolis',   'Velocity',    'IND', 'east', 'medium', 80, ['#151515', '#F5F5F5', '#D12B2B'], 'diamond', 'chevrons'),
    team('fr-009', 'Miami',          'Riptide',     'MIA', 'east', 'large',  81, ['#0E2A47', '#33C2C0', '#F27A5E'], 'roundel', 'wave'),
    team('fr-010', 'Milwaukee',      'Anchors',     'MIL', 'east', 'small',  87, ['#1D5C96', '#EFE6D2', '#B5533A'], 'shield',  'anchor'),
    team('fr-011', 'New York',       'Sentinels',   'NYS', 'east', 'large',  84, ['#0D1B2A', '#C3CCD6', '#C02B3C'], 'shield',  'tower'),
    team('fr-012', 'Orlando',        'Orbit',       'ORL', 'east', 'medium', 79, ['#4A3290', '#3FD0EE', '#F2F0FA'], 'roundel', 'planet'),
    team('fr-013', 'Philadelphia',   'Founders',    'PHI', 'east', 'large',  83, ['#2C5637', '#EADFC4', '#A6432F'], 'shield',  'bell'),
    team('fr-014', 'Toronto',        'Borealis',    'TOR', 'east', 'large',  73, ['#0C1E3A', '#4CD08E', '#CFE8F3'], 'hexagon', 'northstar'),
    team('fr-015', 'Washington',     'Statesmen',   'WAS', 'east', 'large',  62, ['#6E1C31', '#E9DDBF', '#C9A24A'], 'shield',  'dome'),

    /* ---- Western Conference ------------------------------------------- */
    team('fr-016', 'Dallas',         'Wranglers',   'DAL', 'west', 'large',  81, ['#6B4026', '#E4C696', '#2A9D8F'], 'shield',  'horseshoe'),
    team('fr-017', 'Denver',         'Summit',      'DEN', 'west', 'medium', 88, ['#2F4558', '#F1F4F7', '#E07A3F'], 'hexagon', 'mountains'),
    team('fr-018', 'Houston',        'Apollos',     'HOU', 'west', 'large',  77, ['#102A5C', '#F28C28', '#D3D8DE'], 'roundel', 'rocket'),
    team('fr-019', 'Los Angeles',    'Breakers',    'LAB', 'west', 'large',  72, ['#0B6FA4', '#F3E2B8', '#FFB347'], 'roundel', 'sunset'),
    team('fr-020', 'Los Angeles',    'Legends',     'LEG', 'west', 'large',  83, ['#141414', '#D9B44A', '#A3213A'], 'diamond', 'star'),
    team('fr-021', 'Memphis',        'Steamers',    'MEM', 'west', 'small',  76, ['#9E2F2A', '#EADFC8', '#1C2B45'], 'roundel', 'paddlewheel'),
    team('fr-022', 'Minneapolis',    'Frost',       'MIN', 'west', 'medium', 82, ['#13233F', '#F2F7FB', '#7FB6E3'], 'hexagon', 'snowflake'),
    team('fr-023', 'New Orleans',    'Krewe',       'NOL', 'west', 'small',  74, ['#4E2373', '#E3B23C', '#3DA66B'], 'diamond', 'harlequin'),
    team('fr-024', 'Oklahoma City',  'Twisters',    'OKC', 'west', 'small',  90, ['#3E4651', '#F5C518', '#9EC9E8'], 'shield',  'tornado'),
    team('fr-025', 'Phoenix',        'Sidewinders', 'PHX', 'west', 'large',  80, ['#B4532F', '#F1DDB8', '#167F80'], 'diamond', 'snake'),
    team('fr-026', 'Portland',       'Cascades',    'POR', 'west', 'medium', 65, ['#1E5631', '#EEF2EC', '#9CBF3B'], 'shield',  'tree'),
    team('fr-027', 'Sacramento',     'Prospectors', 'SAC', 'west', 'medium', 79, ['#2B2B2B', '#D6A83A', '#7AA9D6'], 'roundel', 'pickaxes'),
    team('fr-028', 'Salt Lake City', 'Pioneers',    'SLC', 'west', 'small',  63, ['#A8412C', '#F1D9B5', '#2F3B45'], 'hexagon', 'beehive'),
    team('fr-029', 'San Antonio',    'Vaqueros',    'SAT', 'west', 'medium', 68, ['#234C9E', '#F2D27A', '#F4F1EA'], 'shield',  'hat'),
    team('fr-030', 'San Francisco',  'Fog',         'SFO', 'west', 'large',  78, ['#1B2A41', '#C9472F', '#B8C4CF'], 'roundel', 'bridge')
  ];

  /* ---- Expansion franchises ------------------------------------------- *
   * Ready-made teams the player can add to the league in New Dynasty →
   * Customize. Not part of the founding league. Ratings are expansion-level.
   * A city that already has a founding team (Oklahoma City) gets a second,
   * separate franchise; the player chooses whether to add it.            */
  var EXPANSION = [
    team('fr-031', 'Oklahoma City',  'Stampede',    'OKS', 'west', 'small',  61, ['#7A2E1D', '#F2E3C6', '#D99A2B'], 'shield',  'horns'),
    team('fr-032', 'Pittsburgh',     'Inclines',    'PIT', 'east', 'medium', 63, ['#1F1F22', '#F0C419', '#8C9399'], 'hexagon', 'incline'),
    team('fr-033', 'Seattle',        'Squall',      'SEA', 'west', 'medium', 64, ['#123B3A', '#DCEFEA', '#5FB49C'], 'roundel', 'raindrop'),
    team('fr-034', 'Providence',     'Jewelers',    'PRO', 'east', 'small',  60, ['#2A1E5C', '#E9E4F5', '#C8A2E8'], 'diamond', 'gem'),
    team('fr-035', 'St. Louis',      'Archers',     'STL', 'east', 'medium', 63, ['#0F3D6E', '#F3F5F8', '#B8C3CF'], 'shield',  'arch'),
    team('fr-036', 'Vancouver',      'Lumberjacks', 'VAN', 'west', 'medium', 62, ['#2D4A22', '#F1E6D0', '#B23A2E'], 'shield',  'axe'),
    team('fr-037', 'Baltimore',      'Crabbers',    'BAL', 'east', 'medium', 61, ['#1B3B6F', '#F5F1E8', '#E2573B'], 'roundel', 'crab'),
    team('fr-038', 'Louisville',     'Derby',       'LOU', 'east', 'small',  60, ['#5C1A33', '#F2E6D8', '#D4AF37'], 'roundel', 'trophy'),
    team('fr-039', 'Mexico City',    'Sol',         'MEX', 'west', 'large',  64, ['#0C6B58', '#FBE7B0', '#E4572E'], 'roundel', 'sun'),
    team('fr-040', 'San Diego',      'Surf',        'SD',  'west', 'medium', 63, ['#0B4F71', '#F6E7C8', '#F28F3B'], 'diamond', 'surfboard'),
    team('fr-041', 'Buffalo',        'Falls',       'BUF', 'east', 'small',  59, ['#16325C', '#E6F1F8', '#4FA3D9'], 'hexagon', 'falls'),
    team('fr-042', 'Cincinnati',     'Lanterns',    'CIN', 'east', 'medium', 62, ['#3A2A1E', '#F4D58D', '#C2452D'], 'hexagon', 'lantern'),
    team('fr-043', 'Kansas City',    'Fountains',   'KC',  'west', 'medium', 61, ['#21415E', '#E9F3F8', '#58B6C0'], 'roundel', 'fountain')
  ];

  FRANCHISES.concat(EXPANSION).forEach(function (t) { Object.freeze(t.colors); Object.freeze(t.logo); Object.freeze(t.arena); Object.freeze(t); });
  Object.freeze(FRANCHISES);
  Object.freeze(EXPANSION);

  // Founding or expansion franchise by id
  function byId(id) {
    var all = FRANCHISES.concat(EXPANSION);
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  function conference(id) {
    for (var i = 0; i < CONFERENCES.length; i++) if (CONFERENCES[i].id === id) return CONFERENCES[i];
    return null;
  }

  function division(id) {
    for (var i = 0; i < DIVISIONS.length; i++) if (DIVISIONS[i].id === id) return DIVISIONS[i];
    return null;
  }

  function marketSize(id) {
    for (var i = 0; i < MARKET_SIZES.length; i++) if (MARKET_SIZES[i].id === id) return MARKET_SIZES[i];
    return null;
  }

  function ratingTier(overall) {
    for (var i = 0; i < RATING_TIERS.length; i++) if (overall >= RATING_TIERS[i].min) return RATING_TIERS[i].label;
    return RATING_TIERS[RATING_TIERS.length - 1].label;
  }

  // Integrity check: returns a list of problems (empty = valid). Used by tests
  // and by the dynasty initializer before it builds a league.
  // opts.balanced (default true): conferences must have equal team counts.
  function validate(list, opts) {
    list = list || FRANCHISES;
    var balanced = !opts || opts.balanced !== false;
    var problems = [];
    var seen = { id: {}, abbreviation: {}, fullName: {} };
    var counts = {};
    list.forEach(function (t) {
      ['id', 'abbreviation', 'fullName'].forEach(function (k) {
        if (seen[k][t[k]]) problems.push('Duplicate ' + k + ': ' + t[k]);
        seen[k][t[k]] = true;
      });
      if (!/^[A-Z]{2,4}$/.test(t.abbreviation)) problems.push(t.id + ': abbreviation must be 2–4 capital letters');
      if (!conference(t.conference)) problems.push(t.id + ': unknown conference ' + t.conference);
      if (!marketSize(t.marketSize)) problems.push(t.id + ': unknown market size ' + t.marketSize);
      var div = division(t.division);
      if (!div || div.conference !== t.conference) problems.push(t.id + ': division ' + t.division + ' is not in its conference');
      if (t.marketSize !== marketSizeFor(t.population)) problems.push(t.id + ': market size does not match population');
      if (!t.arena || !t.arena.name || !(t.arena.capacity > 0)) problems.push(t.id + ': missing arena');
      if (!(t.overall >= 0 && t.overall <= 100)) problems.push(t.id + ': overall out of range');
      ['primary', 'secondary', 'tertiary'].forEach(function (c) {
        if (!/^#[0-9A-Fa-f]{6}$/.test(t.colors[c])) problems.push(t.id + ': bad ' + c + ' color');
      });
      counts[t.conference] = (counts[t.conference] || 0) + 1;
    });
    if (balanced) CONFERENCES.forEach(function (c) {
      if (counts[c.id] !== list.length / CONFERENCES.length) {
        problems.push(c.name + ' has ' + (counts[c.id] || 0) + ' teams');
      }
    });
    return problems;
  }

  return {
    FRANCHISES: FRANCHISES,
    EXPANSION: EXPANSION,
    CONFERENCES: CONFERENCES,
    MARKET_SIZES: MARKET_SIZES,
    DIVISIONS: DIVISIONS,
    division: division,
    marketSizeFor: marketSizeFor,
    RATING_TIERS: RATING_TIERS,
    byId: byId,
    conference: conference,
    marketSize: marketSize,
    ratingTier: ratingTier,
    validate: validate
  };
});
