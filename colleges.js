'use strict';

/**
 * colleges.js — where a player played before he turned pro.
 *
 * Real schools. Teams and leagues in this game are fictional, deliberately, but
 * a college is neither: it is a real institution a real player attended, and an
 * invented "Westlake State" told the reader nothing. So the pool is real, and
 * large enough that a league does not keep drawing the same dozen names.
 *
 * FOUR SEPARATE FACTS, and the whole point of this file is that they are separate:
 *
 *   Birthplace     where he was born            (nameCultures.js)
 *   Nationality    who he represents            (nameCultures.js)
 *   College        the real school, or null     (here)
 *   Pre-Draft Path how he reached the pros      (here)
 *
 * Being born abroad does NOT mean skipping American college basketball, and a
 * player who never attended one is `college: null` — shown as "None" — with the
 * route he actually took recorded in preDraftPath. "Overseas Professional" used
 * to sit in the college field; that is a career path, not a school, and it was
 * the reason this file exists.
 *
 * ON THE TIERS: `t` is a RECRUITING WEIGHT for this simulation, not a ranking,
 * a rating, or any claim about a real school's quality. It exists so that a
 * generated league draws from major programmes more often than from small ones,
 * the way a professional league's rosters actually do. `i` is the same kind of
 * weight for how often a programme takes the international route. Neither is
 * presented anywhere in the game, and neither touches a player's ratings:
 * college is background, never a hidden overall modifier.
 */

/* ===========================================================================
 * THE SCHOOLS
 * ---------------------------------------------------------------------------
 * [name, state, tier, flags]
 *   tier   'elite' | 'power' | 'mid' | 'small'  — recruiting weight only
 *   flags  'h' marks an HBCU; 'i' marks a programme weighted toward
 *          international recruiting.
 * ======================================================================== */
const S = (name, state, tier, flags = '') => ({ name, state, tier, flags });

export const COLLEGES = [
  /* ------------------------------ elite ------------------------------- */
  S('Duke', 'NC', 'elite', 'i'), S('North Carolina', 'NC', 'elite'),
  S('Kentucky', 'KY', 'elite', 'i'), S('Kansas', 'KS', 'elite', 'i'),
  S('UCLA', 'CA', 'elite', 'i'), S('Indiana', 'IN', 'elite'),
  S('Louisville', 'KY', 'elite'), S('Michigan State', 'MI', 'elite'),
  S('UConn', 'CT', 'elite', 'i'), S('Villanova', 'PA', 'elite'),
  S('Syracuse', 'NY', 'elite'), S('Arizona', 'AZ', 'elite', 'i'),
  S('Michigan', 'MI', 'elite'), S('Ohio State', 'OH', 'elite'),
  S('Georgetown', 'DC', 'elite', 'i'), S('Gonzaga', 'WA', 'elite', 'i'),

  /* ------------------------------ power ------------------------------- */
  S('Virginia', 'VA', 'power'), S('Virginia Tech', 'VA', 'power'),
  S('NC State', 'NC', 'power'), S('Wake Forest', 'NC', 'power'),
  S('Miami', 'FL', 'power'), S('Florida State', 'FL', 'power'),
  S('Clemson', 'SC', 'power'), S('Pittsburgh', 'PA', 'power'),
  S('Boston College', 'MA', 'power'), S('Georgia Tech', 'GA', 'power'),
  S('Notre Dame', 'IN', 'power'), S('SMU', 'TX', 'power'),
  S('California', 'CA', 'power'), S('Stanford', 'CA', 'power', 'i'),
  S('Purdue', 'IN', 'power'), S('Illinois', 'IL', 'power', 'i'),
  S('Wisconsin', 'WI', 'power'), S('Iowa', 'IA', 'power'),
  S('Maryland', 'MD', 'power'), S('Rutgers', 'NJ', 'power'),
  S('Nebraska', 'NE', 'power'), S('Minnesota', 'MN', 'power'),
  S('Northwestern', 'IL', 'power'), S('Penn State', 'PA', 'power'),
  S('Oregon', 'OR', 'power', 'i'), S('Washington', 'WA', 'power', 'i'),
  S('USC', 'CA', 'power'), S('Alabama', 'AL', 'power'),
  S('Auburn', 'AL', 'power'), S('Florida', 'FL', 'power'),
  S('Georgia', 'GA', 'power'), S('Tennessee', 'TN', 'power'),
  S('Arkansas', 'AR', 'power'), S('Texas A&M', 'TX', 'power'),
  S('LSU', 'LA', 'power'), S('Mississippi State', 'MS', 'power'),
  S('Ole Miss', 'MS', 'power'), S('Missouri', 'MO', 'power'),
  S('South Carolina', 'SC', 'power'), S('Vanderbilt', 'TN', 'power'),
  S('Oklahoma', 'OK', 'power'), S('Texas', 'TX', 'power'),
  S('Baylor', 'TX', 'power'), S('Houston', 'TX', 'power'),
  S('Texas Tech', 'TX', 'power'), S('TCU', 'TX', 'power'),
  S('Oklahoma State', 'OK', 'power'), S('Iowa State', 'IA', 'power'),
  S('Kansas State', 'KS', 'power'), S('West Virginia', 'WV', 'power'),
  S('Cincinnati', 'OH', 'power'), S('BYU', 'UT', 'power', 'i'),
  S('Utah', 'UT', 'power'), S('Arizona State', 'AZ', 'power', 'i'),
  S('Colorado', 'CO', 'power'), S('UCF', 'FL', 'power'),
  S('Marquette', 'WI', 'power'), S('Xavier', 'OH', 'power'),
  S('Creighton', 'NE', 'power'), S('Providence', 'RI', 'power'),
  S("St. John's", 'NY', 'power'), S('Seton Hall', 'NJ', 'power'),
  S('DePaul', 'IL', 'power'), S('Butler', 'IN', 'power'),
  S('Memphis', 'TN', 'power'), S('Wichita State', 'KS', 'power'),
  S('Temple', 'PA', 'power'), S('Saint Louis', 'MO', 'power'),
  S('VCU', 'VA', 'power'), S('Dayton', 'OH', 'power'),
  S('San Diego State', 'CA', 'power'), S('UNLV', 'NV', 'power'),
  S('Nevada', 'NV', 'power'), S('New Mexico', 'NM', 'power'),
  S('Utah State', 'UT', 'power'), S('Boise State', 'ID', 'power'),
  S("Saint Mary's", 'CA', 'power', 'i'), S('Oregon State', 'OR', 'power'),
  S('Washington State', 'WA', 'power'), S('Tulane', 'LA', 'power'),

  /* ------------------------------- mid -------------------------------- */
  S('San Francisco', 'CA', 'mid', 'i'), S('Santa Clara', 'CA', 'mid', 'i'),
  S('Loyola Marymount', 'CA', 'mid'), S('Pepperdine', 'CA', 'mid', 'i'),
  S('Portland', 'OR', 'mid', 'i'), S('Pacific', 'CA', 'mid'),
  S('UC Santa Barbara', 'CA', 'mid'), S('UC Irvine', 'CA', 'mid'),
  S('Long Beach State', 'CA', 'mid'), S('Fresno State', 'CA', 'mid'),
  S('San Jose State', 'CA', 'mid'), S('Grand Canyon', 'AZ', 'mid', 'i'),
  S('Northern Arizona', 'AZ', 'mid'), S('Weber State', 'UT', 'mid'),
  S('Montana', 'MT', 'mid'), S('Montana State', 'MT', 'mid'),
  S('Idaho', 'ID', 'mid'), S('Eastern Washington', 'WA', 'mid'),
  S('Wyoming', 'WY', 'mid'), S('Colorado State', 'CO', 'mid'),
  S('Air Force', 'CO', 'mid'), S('Denver', 'CO', 'mid'),
  S('North Texas', 'TX', 'mid'), S('Rice', 'TX', 'mid'),
  S('Tulsa', 'OK', 'mid'), S('UAB', 'AL', 'mid'),
  S('South Florida', 'FL', 'mid'), S('Florida Atlantic', 'FL', 'mid'),
  S('FIU', 'FL', 'mid'), S('Charlotte', 'NC', 'mid'),
  S('East Carolina', 'NC', 'mid'), S('Davidson', 'NC', 'mid'),
  S('Furman', 'SC', 'mid'), S('College of Charleston', 'SC', 'mid'),
  S('Wofford', 'SC', 'mid'), S('Chattanooga', 'TN', 'mid'),
  S('Belmont', 'TN', 'mid'), S('Murray State', 'KY', 'mid'),
  S('Western Kentucky', 'KY', 'mid'), S('Middle Tennessee', 'TN', 'mid'),
  S('Toledo', 'OH', 'mid'), S('Akron', 'OH', 'mid'),
  S('Kent State', 'OH', 'mid'), S('Ohio', 'OH', 'mid'),
  S('Bowling Green', 'OH', 'mid'), S('Miami (OH)', 'OH', 'mid'),
  S('Ball State', 'IN', 'mid'), S('Valparaiso', 'IN', 'mid'),
  S('Evansville', 'IN', 'mid'), S('Bradley', 'IL', 'mid'),
  S('Illinois State', 'IL', 'mid'), S('Loyola Chicago', 'IL', 'mid'),
  S('Northern Iowa', 'IA', 'mid'), S('Drake', 'IA', 'mid'),
  S('Missouri State', 'MO', 'mid'), S('Oral Roberts', 'OK', 'mid'),
  S('South Dakota State', 'SD', 'mid'), S('North Dakota State', 'ND', 'mid'),
  S('Vermont', 'VT', 'mid'), S('Boston University', 'MA', 'mid'),
  S('Northeastern', 'MA', 'mid'), S('UMass', 'MA', 'mid'),
  S('Rhode Island', 'RI', 'mid'), S('Hofstra', 'NY', 'mid'),
  S('Buffalo', 'NY', 'mid'), S('Siena', 'NY', 'mid'),
  S('Iona', 'NY', 'mid'), S('Manhattan', 'NY', 'mid'),
  S('Fordham', 'NY', 'mid'), S('Rider', 'NJ', 'mid'),
  S('Monmouth', 'NJ', 'mid'), S("Saint Joseph's", 'PA', 'mid'),
  S('La Salle', 'PA', 'mid'), S('Duquesne', 'PA', 'mid'),
  S('Bucknell', 'PA', 'mid'), S('Lafayette', 'PA', 'mid'),
  S('Lehigh', 'PA', 'mid'), S('Drexel', 'PA', 'mid'),
  S('Delaware', 'DE', 'mid'), S('Towson', 'MD', 'mid'),
  S('George Mason', 'VA', 'mid'), S('George Washington', 'DC', 'mid'),
  S('Richmond', 'VA', 'mid'), S('Old Dominion', 'VA', 'mid'),
  S('William & Mary', 'VA', 'mid'), S('James Madison', 'VA', 'mid'),
  S('Marshall', 'WV', 'mid'), S('Kennesaw State', 'GA', 'mid'),
  S('Mercer', 'GA', 'mid'), S('Georgia State', 'GA', 'mid'),
  S('Georgia Southern', 'GA', 'mid'), S('Samford', 'AL', 'mid'),
  S('Troy', 'AL', 'mid'), S('South Alabama', 'AL', 'mid'),
  S('Louisiana', 'LA', 'mid'), S('Louisiana Tech', 'LA', 'mid'),
  S('Stephen F. Austin', 'TX', 'mid'), S('Abilene Christian', 'TX', 'mid'),
  S('Sam Houston', 'TX', 'mid'), S('New Mexico State', 'NM', 'mid'),
  S('UTEP', 'TX', 'mid'), S('Utah Valley', 'UT', 'mid', 'i'),
  S('Seattle', 'WA', 'mid'), S('Cal State Fullerton', 'CA', 'mid'),
  S('UC Davis', 'CA', 'mid'), S('UC Riverside', 'CA', 'mid'),
  S('Hawaii', 'HI', 'mid', 'i'), S('Cal Poly', 'CA', 'mid'),
  S('Sacramento State', 'CA', 'mid'), S('Northern Colorado', 'CO', 'mid'),
  S('Milwaukee', 'WI', 'mid'), S('Green Bay', 'WI', 'mid'),
  S('Oakland', 'MI', 'mid'), S('Detroit Mercy', 'MI', 'mid'),
  S('Western Michigan', 'MI', 'mid'), S('Central Michigan', 'MI', 'mid'),
  S('Eastern Michigan', 'MI', 'mid'), S('Cleveland State', 'OH', 'mid'),
  S('Wright State', 'OH', 'mid'), S('Youngstown State', 'OH', 'mid'),
  S('Robert Morris', 'PA', 'mid'), S("Saint Peter's", 'NJ', 'mid'),
  S('NJIT', 'NJ', 'mid'), S('Stony Brook', 'NY', 'mid'),
  S('Albany', 'NY', 'mid'), S('Binghamton', 'NY', 'mid'),
  S('UMBC', 'MD', 'mid'), S('Navy', 'MD', 'mid'),
  S('Army', 'NY', 'mid'), S('Colgate', 'NY', 'mid'),
  S('Cornell', 'NY', 'mid'), S('Princeton', 'NJ', 'mid'),
  S('Yale', 'CT', 'mid'), S('Harvard', 'MA', 'mid', 'i'),
  S('Penn', 'PA', 'mid'), S('Brown', 'RI', 'mid'),
  S('Dartmouth', 'NH', 'mid'), S('Columbia', 'NY', 'mid'),
  S('Wagner', 'NY', 'mid'), S('Sacred Heart', 'CT', 'mid'),
  S('Fairfield', 'CT', 'mid'), S('Quinnipiac', 'CT', 'mid'),
  S('Marist', 'NY', 'mid'), S('Canisius', 'NY', 'mid'),
  S('Niagara', 'NY', 'mid'), S('Bryant', 'RI', 'mid'),
  S('Maine', 'ME', 'mid'), S('New Hampshire', 'NH', 'mid'),
  S('UMass Lowell', 'MA', 'mid'), S('Merrimack', 'MA', 'mid'),

  /* ------------------------------ small ------------------------------- */
  S('Longwood', 'VA', 'small'), S('High Point', 'NC', 'small'),
  S('UNC Asheville', 'NC', 'small'), S('Radford', 'VA', 'small'),
  S('Winthrop', 'SC', 'small'), S('Campbell', 'NC', 'small'),
  S('Gardner-Webb', 'NC', 'small'), S('Presbyterian', 'SC', 'small'),
  S('Charleston Southern', 'SC', 'small'), S('Lipscomb', 'TN', 'small'),
  S('North Florida', 'FL', 'small'), S('Stetson', 'FL', 'small'),
  S('Jacksonville', 'FL', 'small'), S('Bellarmine', 'KY', 'small'),
  S('Queens', 'NC', 'small'), S('Central Arkansas', 'AR', 'small'),
  S('Lamar', 'TX', 'small'), S('Nicholls', 'LA', 'small'),
  S('Southeastern Louisiana', 'LA', 'small'), S('McNeese', 'LA', 'small'),
  S('Houston Christian', 'TX', 'small'), S('Incarnate Word', 'TX', 'small'),
  S('Tarleton State', 'TX', 'small'), S('UT Arlington', 'TX', 'small'),
  S('Southern Utah', 'UT', 'small'), S('Idaho State', 'ID', 'small'),
  S('Portland State', 'OR', 'small'), S('Northern Kentucky', 'KY', 'small'),
  S('IU Indianapolis', 'IN', 'small'), S('Purdue Fort Wayne', 'IN', 'small'),
  S('UIC', 'IL', 'small'), S('Chicago State', 'IL', 'small'),
  S('Western Illinois', 'IL', 'small'), S('SIU Edwardsville', 'IL', 'small'),
  S('Southern Illinois', 'IL', 'small'), S('Little Rock', 'AR', 'small'),
  S('Arkansas State', 'AR', 'small'), S('UT Martin', 'TN', 'small'),
  S('Tennessee Tech', 'TN', 'small'), S('Eastern Illinois', 'IL', 'small'),
  S('Morehead State', 'KY', 'small'), S('Southern Indiana', 'IN', 'small'),
  S('Austin Peay', 'TN', 'small'), S('Saint Francis', 'PA', 'small'),
  S('Central Connecticut', 'CT', 'small'), S('Stonehill', 'MA', 'small'),
  S('Le Moyne', 'NY', 'small'), S('Lindenwood', 'MO', 'small'),
  S('Omaha', 'NE', 'small'), S('South Dakota', 'SD', 'small'),
  S('North Dakota', 'ND', 'small'),
  S('California Baptist', 'CA', 'small'), S('CSU Bakersfield', 'CA', 'small'),
  S('CSU Northridge', 'CA', 'small'), S('UC San Diego', 'CA', 'small'),
  S('Bethune-Cookman', 'FL', 'small', 'h'),

  /* ------------------------------ HBCUs ------------------------------- */
  S('Howard', 'DC', 'small', 'h'), S('Norfolk State', 'VA', 'small', 'h'),
  S('Hampton', 'VA', 'small', 'h'), S('Morgan State', 'MD', 'small', 'h'),
  S('Coppin State', 'MD', 'small', 'h'), S('Delaware State', 'DE', 'small', 'h'),
  S('North Carolina Central', 'NC', 'small', 'h'),
  S('North Carolina A&T', 'NC', 'small', 'h'),
  S('South Carolina State', 'SC', 'small', 'h'),
  S('Florida A&M', 'FL', 'small', 'h'), S('Jackson State', 'MS', 'small', 'h'),
  S('Alcorn State', 'MS', 'small', 'h'),
  S('Mississippi Valley State', 'MS', 'small', 'h'),
  S('Southern', 'LA', 'small', 'h'), S('Grambling State', 'LA', 'small', 'h'),
  S('Alabama State', 'AL', 'small', 'h'), S('Alabama A&M', 'AL', 'small', 'h'),
  S('Texas Southern', 'TX', 'small', 'h'),
  S('Prairie View A&M', 'TX', 'small', 'h'),
  S('Arkansas-Pine Bluff', 'AR', 'small', 'h'),
  S('Tennessee State', 'TN', 'small', 'h'),
];

/* ===========================================================================
 * GEOGRAPHY
 * ---------------------------------------------------------------------------
 * A home-state prospect is likelier to stay near home, but every programme
 * recruits nationally, so this is a nudge and never a fence.
 * ======================================================================== */
const REGION_OF = {};
const REGIONS = {
  NE: 'ME NH VT MA RI CT NY NJ PA',
  MidAtl: 'MD DE DC VA WV',
  South: 'NC SC GA FL AL MS TN KY LA AR',
  Midwest: 'OH IN IL MI WI MN IA MO',
  Plains: 'KS NE ND SD OK',
  Southwest: 'TX NM AZ',
  West: 'CA NV UT CO HI',
  Northwest: 'WA OR ID MT WY AK',
};
for (const [region, states] of Object.entries(REGIONS)) {
  for (const st of states.split(' ')) REGION_OF[st] = region;
}

const ADJACENT = {
  NE: ['MidAtl', 'Midwest'],
  MidAtl: ['NE', 'South', 'Midwest'],
  South: ['MidAtl', 'Midwest', 'Southwest'],
  Midwest: ['NE', 'MidAtl', 'South', 'Plains'],
  Plains: ['Midwest', 'Southwest', 'West', 'South'],
  Southwest: ['South', 'Plains', 'West'],
  West: ['Southwest', 'Plains', 'Northwest'],
  Northwest: ['West', 'Plains'],
};

/** Which region a US state belongs to, or null for anything else. */
export function regionOfState(state) {
  return (state && REGION_OF[state]) || null;
}

/* ===========================================================================
 * PRE-DRAFT PATH
 * ======================================================================== */

export const PRE_DRAFT_PATHS = [
  'College', 'International Professional', 'Development League',
  'Direct Entry', 'Other',
];

/**
 * How likely a player from each country is to take the American college route.
 *
 * A probability, never a rule — the point of this whole file is that a Serb
 * CAN go to Arizona and a Malian CAN go to UConn. Countries whose players
 * mostly come up through professional academies sit lower; countries whose
 * players mostly come up through the American system sit high. Anything not
 * listed uses the default.
 */
const COLLEGE_ROUTE = {
  USA: 0.86,
  Canada: 0.80, 'Puerto Rico': 0.78, Jamaica: 0.66, Bahamas: 0.74,
  'Dominican Republic': 0.55, Australia: 0.45, 'New Zealand': 0.45,
  Nigeria: 0.48, Senegal: 0.46, Mali: 0.42, Ghana: 0.44, Cameroon: 0.46,
  'South Sudan': 0.44, 'DR Congo': 0.38, 'South Africa': 0.40,
  'United Kingdom': 0.50, Ireland: 0.48, Germany: 0.26, France: 0.20,
  Spain: 0.16, Italy: 0.20, Serbia: 0.16, Croatia: 0.18, Slovenia: 0.16,
  'Bosnia and Herzegovina': 0.18, Montenegro: 0.16, Greece: 0.18,
  Turkey: 0.18, Lithuania: 0.20, Latvia: 0.24, Estonia: 0.26,
  Poland: 0.26, Ukraine: 0.30, Russia: 0.14, Israel: 0.24,
  Argentina: 0.24, Brazil: 0.26, Mexico: 0.40, China: 0.20,
  Japan: 0.34, 'South Korea': 0.26, Philippines: 0.34, Iran: 0.14,
  Finland: 0.30, Sweden: 0.32, Denmark: 0.32, Netherlands: 0.30,
  Switzerland: 0.28, Austria: 0.26, Czechia: 0.24,
};
const DEFAULT_COLLEGE_ROUTE = 0.34;

/**
 * Decide how a player reached the professional league.
 *
 * Position enters ONLY here, and only for players from outside the American
 * system: an international big is a little likelier to have come up through a
 * professional club, a guard a little likelier to have taken the college
 * route. It does not touch WHICH school he attended — tying real programmes to
 * positions would be inventing facts about them.
 *
 * @returns {string} one of PRE_DRAFT_PATHS
 */
export function pickPreDraftPath(rng, { birthCountry, secondaryNationality, position }) {
  const homegrown = birthCountry === 'USA' || secondaryNationality === 'USA';
  let college = COLLEGE_ROUTE[birthCountry];
  if (college == null) college = DEFAULT_COLLEGE_ROUTE;
  // Born abroad, raised in the States: the American route becomes the likely one.
  if (homegrown && birthCountry !== 'USA') college = Math.max(college, 0.70);

  if (!homegrown) {
    if (position === 'C' || position === 'PF') college -= 0.06;
    else if (position === 'PG' || position === 'SG') college += 0.05;
  }
  college = Math.max(0.05, Math.min(0.94, college));

  if (rng.next() < college) return 'College';

  // The remainder splits by where he actually was. An American who did not go
  // to college mostly came through the development league or straight in; a
  // player from abroad mostly came through a professional club there.
  const r = rng.next();
  if (birthCountry === 'USA') {
    if (r < 0.45) return 'Development League';
    if (r < 0.80) return 'Direct Entry';
    if (r < 0.93) return 'International Professional';
    return 'Other';
  }
  if (r < 0.74) return 'International Professional';
  if (r < 0.84) return 'Direct Entry';
  if (r < 0.94) return 'Development League';
  return 'Other';
}

/* ===========================================================================
 * PICKING A SCHOOL
 * ======================================================================== */

const TIER_BASE = { elite: 3.4, power: 2.4, mid: 1.0, small: 0.45 };
// How sharply each tier's weight responds to how good the prospect is.
// Positive means the tier gets likelier as talent rises. None of them is ever
// zero, which is what keeps superstars out of small schools from being
// impossible and busts out of powerhouses from being impossible.
const TIER_TALENT = { elite: 0.95, power: 0.45, mid: -0.35, small: -0.75 };
// Baseline pull for an international recruit, by tier; 'i' schools get more.
const TIER_INTL = { elite: 1.6, power: 1.2, mid: 0.9, small: 0.5 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Choose the school a player attended.
 *
 * Weighted by programme prominence, by how highly rated the prospect is, by
 * where he grew up, and — for players from abroad — by how much a programme
 * recruits internationally. Every one of those is a MULTIPLIER on a weight
 * that is never zero, so none of them is deterministic: a fringe player can
 * come out of Kansas and a future star out of a small school in his own state.
 *
 * The home-region pull is damped for the best prospects, because that is what
 * national recruiting means: the higher he is rated, the less his home state
 * predicts where he ended up.
 *
 * @returns {string} the school's name
 */
export function pickCollege(rng, { overall = 70, birthCountry, birthRegion } = {}) {
  const international = birthCountry && birthCountry !== 'USA';
  const home = international ? null : regionOfState(birthRegion);
  const near = home ? ADJACENT[home] || [] : [];
  // -1 fringe .. +1 star
  const t = clamp((overall - 70) / 18, -1, 1);

  let total = 0;
  const weights = new Array(COLLEGES.length);
  for (let i = 0; i < COLLEGES.length; i++) {
    const c = COLLEGES[i];
    let w = TIER_BASE[c.tier] * Math.exp(TIER_TALENT[c.tier] * t);
    if (home) {
      const region = REGION_OF[c.state];
      const pull = region === home ? 2.8 : near.includes(region) ? 1.5 : 1;
      // National recruiting: a five-star's home state barely predicts him.
      w *= pull ** (1 - 0.65 * Math.max(0, t));
    } else if (international) {
      w *= TIER_INTL[c.tier] * (c.flags.includes('i') ? 1.7 : 1);
    }
    weights[i] = w;
    total += w;
  }

  let r = rng.next() * total;
  for (let i = 0; i < COLLEGES.length; i++) {
    r -= weights[i];
    if (r <= 0) return COLLEGES[i].name;
  }
  return COLLEGES[COLLEGES.length - 1].name;
}

/**
 * A player's whole pre-professional background: the route, and the school if
 * the route was college.
 *
 * `collegeYears` exists so the biography's arithmetic can be honest — a
 * four-year player entered the league at 22, a one-and-done at 19 — rather
 * than drawing an entry age unconnected to the history it is supposed to
 * describe.
 *
 * @returns {{ college: string|null, preDraftPath: string, collegeYears: number }}
 */
export function makeBackground(rng, { overall = 70, position, birthCountry, birthRegion,
  secondaryNationality, age = 24 } = {}) {
  let preDraftPath = pickPreDraftPath(rng, { birthCountry, secondaryNationality, position });
  // An 18-year-old has not had a college season yet, whatever the roll said.
  // The route has to be one his age allows, or the biography claims a history
  // he has not lived long enough to have.
  if (preDraftPath === 'College' && age < 19) preDraftPath = 'Direct Entry';
  if (preDraftPath !== 'College') {
    return { college: null, preDraftPath, collegeYears: 0 };
  }
  // How long he stayed. The best prospects leave early; everyone else mostly
  // finishes, which is what makes a 24-year-old rookie a four-year player and a
  // 19-year-old rookie a one-and-done rather than a chronological impossibility.
  const t = clamp((overall - 70) / 18, -1, 1);
  const table = [
    1 + Math.max(0, t) * 3.2,      // one and done
    1.4,                            // sophomore
    1.5,                            // junior
    2.2 + Math.max(0, -t) * 1.6,   // senior
  ];
  const sum = table.reduce((a, b) => a + b, 0);
  let r = rng.next() * sum;
  let years = 4;
  for (let i = 0; i < table.length; i++) { r -= table[i]; if (r <= 0) { years = i + 1; break; } }
  // Nobody starts college before 18, so a 20-year-old cannot have four years
  // of it behind him. This is the cap that keeps the biography from claiming a
  // history he has not lived long enough to have.
  years = clamp(years, 1, age - 18);
  return { college: pickCollege(rng, { overall, birthCountry, birthRegion }), preDraftPath, collegeYears: years };
}

/** How many schools the pool holds, for sanity checks. */
export function poolSize() { return COLLEGES.length; }
