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
     marketSize    'small' | 'medium' | 'large' (metro market; independent
                   of team quality).
     conference    'east' | 'west'.
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

  // Ordered largest first; `rank` drives market-size sorting.
  var MARKET_SIZES = [
    { id: 'large',  label: 'Large',  rank: 3 },
    { id: 'medium', label: 'Medium', rank: 2 },
    { id: 'small',  label: 'Small',  rank: 1 }
  ];

  // Labels for the provisional rating bands (used for display only).
  var RATING_TIERS = [
    { min: 86, label: 'Contender' },
    { min: 79, label: 'Playoff Team' },
    { min: 71, label: 'Middle of the Pack' },
    { min: 0,  label: 'Rebuilding' }
  ];

  function team(id, city, name, abbreviation, conference, marketSize, overall, colors, badge, emblem) {
    return {
      id: id,
      city: city,
      name: name,
      fullName: city + ' ' + name,
      abbreviation: abbreviation,
      conference: conference,
      marketSize: marketSize,
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
    team('fr-025', 'Phoenix',        'Sidewinders', 'PHX', 'west', 'medium', 80, ['#B4532F', '#F1DDB8', '#167F80'], 'diamond', 'snake'),
    team('fr-026', 'Portland',       'Cascades',    'POR', 'west', 'medium', 65, ['#1E5631', '#EEF2EC', '#9CBF3B'], 'shield',  'tree'),
    team('fr-027', 'Sacramento',     'Prospectors', 'SAC', 'west', 'medium', 79, ['#2B2B2B', '#D6A83A', '#7AA9D6'], 'roundel', 'pickaxes'),
    team('fr-028', 'Salt Lake City', 'Pioneers',    'SLC', 'west', 'small',  63, ['#A8412C', '#F1D9B5', '#2F3B45'], 'hexagon', 'beehive'),
    team('fr-029', 'San Antonio',    'Vaqueros',    'SAT', 'west', 'medium', 68, ['#234C9E', '#F2D27A', '#F4F1EA'], 'shield',  'hat'),
    team('fr-030', 'San Francisco',  'Fog',         'SFO', 'west', 'large',  78, ['#1B2A41', '#C9472F', '#B8C4CF'], 'roundel', 'bridge')
  ];

  FRANCHISES.forEach(function (t) { Object.freeze(t.colors); Object.freeze(t.logo); Object.freeze(t); });
  Object.freeze(FRANCHISES);

  function byId(id) {
    for (var i = 0; i < FRANCHISES.length; i++) if (FRANCHISES[i].id === id) return FRANCHISES[i];
    return null;
  }

  function conference(id) {
    for (var i = 0; i < CONFERENCES.length; i++) if (CONFERENCES[i].id === id) return CONFERENCES[i];
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
  function validate(list) {
    list = list || FRANCHISES;
    var problems = [];
    var seen = { id: {}, abbreviation: {}, fullName: {} };
    var counts = {};
    list.forEach(function (t) {
      ['id', 'abbreviation', 'fullName'].forEach(function (k) {
        if (seen[k][t[k]]) problems.push('Duplicate ' + k + ': ' + t[k]);
        seen[k][t[k]] = true;
      });
      if (!/^[A-Z]{3}$/.test(t.abbreviation)) problems.push(t.id + ': abbreviation must be 3 capital letters');
      if (!conference(t.conference)) problems.push(t.id + ': unknown conference ' + t.conference);
      if (!marketSize(t.marketSize)) problems.push(t.id + ': unknown market size ' + t.marketSize);
      if (!(t.overall >= 0 && t.overall <= 100)) problems.push(t.id + ': overall out of range');
      ['primary', 'secondary', 'tertiary'].forEach(function (c) {
        if (!/^#[0-9A-Fa-f]{6}$/.test(t.colors[c])) problems.push(t.id + ': bad ' + c + ' color');
      });
      counts[t.conference] = (counts[t.conference] || 0) + 1;
    });
    CONFERENCES.forEach(function (c) {
      if (counts[c.id] !== list.length / CONFERENCES.length) {
        problems.push(c.name + ' has ' + (counts[c.id] || 0) + ' teams');
      }
    });
    return problems;
  }

  return {
    FRANCHISES: FRANCHISES,
    CONFERENCES: CONFERENCES,
    MARKET_SIZES: MARKET_SIZES,
    RATING_TIERS: RATING_TIERS,
    byId: byId,
    conference: conference,
    marketSize: marketSize,
    ratingTier: ratingTier,
    validate: validate
  };
});
