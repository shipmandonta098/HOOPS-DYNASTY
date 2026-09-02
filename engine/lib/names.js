'use strict';

/**
 * names.js — Name pools for generating draft prospects and fictional players.
 * Purely cosmetic. Kept in its own file so you can swap in your own lists
 * (different eras, regions, joke names for a fantasy league) without touching
 * the generation logic in generateDraftClass.js.
 */

const FIRST_NAMES = [
  'James', 'Marcus', 'Tyrese', 'DeAndre', 'Jalen', 'Cameron', 'Isaiah', 'Malik',
  'Trey', 'Devin', 'Zion', 'Jaylen', 'Brandon', 'Anthony', 'Darius', 'Keegan',
  'Immanuel', 'Obi', 'Xavier', 'Jordan', 'Quentin', 'Terrence', 'Bennedict',
  'Scoot', 'Amen', 'Ausar', 'Cason', 'Gradey', 'Dereck', 'Julian', 'Bilal',
  'Kel', 'Nikola', 'Luka', 'Franz', 'Alperen', 'Deni', 'Santi', 'Vasilije',
];

const LAST_NAMES = [
  'Carter', 'Robinson', 'Mitchell', 'Thompson', 'Edwards', 'Bradley', 'Hayes',
  'Foster', 'Coleman', 'Reeves', 'Banchero', 'Holmgren', 'Wembanyama', 'Miller',
  'Whitmore', 'Hendricks', 'Wallace', 'Dick', 'Lively', 'Podziemski', 'Coulibaly',
  'Sensabaugh', 'Jaquez', 'Howard', 'George', 'Walker', 'Vincent', 'Sharpe',
  'Cissoko', 'Prosper', 'Nowell', 'Duren', 'Sochan', 'Mathurin', 'Kessler',
  'Williams', 'Johnson', 'Brooks', 'Freeman', 'Sanders', 'Bryant', 'Ellison',
];

const COLLEGES = [
  'Duke', 'Kentucky', 'Kansas', 'UCLA', 'Gonzaga', 'Michigan', 'Arizona',
  'Baylor', 'Villanova', 'Alabama', 'Houston', 'Overseas', 'G-League Ignite',
  'Auburn', 'Tennessee', 'Purdue', 'UConn', 'Marquette', 'Creighton',
];

module.exports = { FIRST_NAMES, LAST_NAMES, COLLEGES };
