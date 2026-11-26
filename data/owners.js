/* ==========================================================================
   HOOPS DYNASTY — default franchise owners (single source of truth)

   One fictional owner per franchise in data/franchises.js. Copied into each
   dynasty save at creation, so an owner stays the same for the whole career
   even if this file changes later.

   traits (0–100):
     ambition  — appetite for immediate contention
     patience  — tolerance for losing / rebuilding
     spending  — willingness to pay salary and luxury tax
   portrait: { skin, hair, hairColor, attire } indexes into the palettes in
   scripts/portraits.js (reusable portrait asset, rendered as SVG).
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HDOwners = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PERSONALITIES = {
    'championship-driven': {
      label: 'Championship Driven',
      summary: 'Prioritizes immediate championship contention.'
    },
    'patient-builder': {
      label: 'Patient Builder',
      summary: 'Supports rebuilding and player development.'
    },
    'business-oriented': {
      label: 'Business Oriented',
      summary: 'Prioritizes profitability and responsible spending.'
    },
    'balanced': {
      label: 'Balanced',
      summary: 'Values competitiveness and financial stability.'
    },
    'demanding': {
      label: 'Demanding',
      summary: 'Has limited patience for poor performance.'
    }
  };

  function owner(id, franchiseId, name, title, personality, ambition, patience, spending, portrait) {
    return {
      id: id,
      franchiseId: franchiseId,
      name: name,
      title: title,
      personality: personality,
      traits: { ambition: ambition, patience: patience, spending: spending },
      portrait: { skin: portrait[0], hair: portrait[1], hairColor: portrait[2], attire: portrait[3] }
    };
  }

  //       id        franchise  name                    title                       personality            amb pat spd  portrait [skin, hair, hairColor, attire]
  var OWNERS = [
    owner('own-001', 'fr-001', 'Marcus Delacroix-Hale', 'Principal Owner',          'balanced',             68, 60, 62, [5, 1, 0, 0]),
    owner('own-002', 'fr-002', 'Eleanor Whitcombe',     'Owner & Chairwoman',       'championship-driven',  92, 38, 80, [0, 4, 5, 1]),
    owner('own-003', 'fr-003', 'Tobias Okonkwo-Reyes',  'Managing Partner',         'patient-builder',      48, 86, 58, [6, 0, 0, 2]),
    owner('own-004', 'fr-004', 'Celeste Montgomery',    'Principal Owner',          'patient-builder',      52, 80, 50, [3, 5, 1, 3]),
    owner('own-005', 'fr-005', 'Raymond Kowalczyk',     'Chairman & CEO',           'business-oriented',    55, 62, 34, [1, 3, 6, 0]),
    owner('own-006', 'fr-006', 'Desmond Achterberg',    'Owner & Governor',         'championship-driven',  90, 42, 76, [2, 2, 2, 4]),
    owner('own-007', 'fr-007', 'Patricia Vanterpool',   'Principal Owner',          'patient-builder',      44, 90, 52, [4, 4, 1, 2]),
    owner('own-008', 'fr-008', 'Gerald Lindqvist',      'Owner & Chairman',         'balanced',             72, 58, 55, [0, 6, 6, 1]),
    owner('own-009', 'fr-009', 'Adriana Solano-Vance',  'Managing General Partner', 'demanding',            86, 24, 72, [3, 4, 0, 3]),
    owner('own-010', 'fr-010', 'Henrik Olafsson',       'Owner & Governor',         'balanced',             80, 55, 48, [0, 3, 3, 0]),
    owner('own-011', 'fr-011', 'Victor Castellano',     'Chairman',                 'demanding',            94, 18, 88, [2, 6, 6, 4]),
    owner('own-012', 'fr-012', 'Simone Hartwell',       'Principal Owner',          'business-oriented',    60, 64, 38, [1, 5, 2, 1]),
    owner('own-013', 'fr-013', 'Franklin Ashby',        'Managing Partner',         'championship-driven',  88, 40, 70, [5, 2, 0, 0]),
    owner('own-014', 'fr-014', 'Naomi Fairbanks',       'Owner & Chairwoman',       'balanced',             66, 66, 64, [4, 4, 0, 2]),
    owner('own-015', 'fr-015', 'Clifford Rennick',      'Principal Owner',          'patient-builder',      40, 88, 46, [0, 0, 6, 3]),

    owner('own-016', 'fr-016', 'Beauregard Callahan',   'Owner & Governor',         'demanding',            84, 26, 82, [1, 1, 3, 4]),
    owner('own-017', 'fr-017', 'Ingrid Sorensen',       'Chairwoman & CEO',         'championship-driven',  90, 45, 68, [0, 5, 4, 1]),
    owner('own-018', 'fr-018', 'Lionel Abernathy',      'Principal Owner',          'business-oriented',    62, 58, 36, [6, 3, 0, 0]),
    owner('own-019', 'fr-019', 'Camila Reyes-Whitford', 'Managing Partner',         'balanced',             64, 62, 66, [3, 4, 0, 3]),
    owner('own-020', 'fr-020', 'Sterling Vaughn',       'Owner & Chairman',         'championship-driven',  95, 30, 90, [2, 2, 0, 4]),
    owner('own-021', 'fr-021', 'Odessa Blackwood',      'Principal Owner',          'business-oriented',    58, 66, 30, [6, 4, 0, 2]),
    owner('own-022', 'fr-022', 'Torvald Henningsen',    'Owner & Governor',         'balanced',             74, 56, 52, [0, 1, 3, 1]),
    owner('own-023', 'fr-023', 'Josephine Thibodeaux',  'Principal Owner',          'patient-builder',      54, 82, 44, [4, 5, 0, 3]),
    owner('own-024', 'fr-024', 'Wendell Pruitt',        'Chairman & CEO',           'business-oriented',    70, 60, 32, [1, 0, 5, 0]),
    owner('own-025', 'fr-025', 'Rafael Ibarra',         'Managing Partner',         'demanding',            82, 22, 64, [3, 2, 0, 4]),
    owner('own-026', 'fr-026', 'Margaret Ellsworth',    'Principal Owner',          'patient-builder',      42, 92, 54, [0, 4, 6, 2]),
    owner('own-027', 'fr-027', 'Dariusz Nowakowski',    'Owner & Chairman',         'balanced',             70, 58, 50, [1, 3, 2, 1]),
    owner('own-028', 'fr-028', 'Lorraine Haddock',      'Principal Owner',          'business-oriented',    46, 76, 28, [0, 5, 1, 3]),
    owner('own-029', 'fr-029', 'Esteban Villarreal',    'Owner & Governor',         'patient-builder',      50, 84, 56, [3, 1, 0, 0]),
    owner('own-030', 'fr-030', 'Vivian Ashcroft-Lee',   'Chairwoman',               'demanding',            88, 28, 74, [4, 4, 0, 1])
  ];

  OWNERS.forEach(function (o) { Object.freeze(o.traits); Object.freeze(o.portrait); Object.freeze(o); });
  Object.freeze(OWNERS);

  function byFranchise(franchiseId) {
    for (var i = 0; i < OWNERS.length; i++) if (OWNERS[i].franchiseId === franchiseId) return OWNERS[i];
    return null;
  }

  return { OWNERS: OWNERS, PERSONALITIES: PERSONALITIES, byFranchise: byFranchise };
});
