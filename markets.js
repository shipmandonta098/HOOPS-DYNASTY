'use strict';

/**
 * markets.js — market size from the city, never from the team.
 *
 * MARKET SIZE IS A PROPERTY OF THE PLACE, NOT THE FRANCHISE.
 * It is the commercial and media reach available to whoever plays there:
 * metropolitan population, media-market rank, economic and corporate scale,
 * sponsorship reach. It says nothing about whether the team is any good,
 * whether the building is full, or whether anyone locally cares — that is Fan
 * Interest, which is a separate, dynamic field. All four combinations are
 * legitimate, and the fictional Atlanta Griffins can draw badly without
 * Atlanta becoming a small market.
 *
 * Because it is a property of the place, it is looked up rather than rolled.
 * The previous system drew a random "population" per generated team and
 * derived market size from that, so a team in Atlanta could come out Small and
 * a team in Boise could come out Large.
 *
 * Market size is also deliberately NOT the input to team budget. What an owner
 * will spend depends on their wealth, their appetite and the franchise's
 * finances; a small-market owner can outspend a large-market one.
 */

/** Ordered smallest to largest, so tiers can be compared as well as named. */
export const MARKET_TIERS = ['Small', 'Medium', 'Large', 'Very Large'];

/** Rank of a tier, or -1 if it is not one. Useful for comparisons and sorting. */
export const marketRank = (tier) => MARKET_TIERS.indexOf(tier);

/**
 * City -> [tier, metro population in millions].
 *
 * The population is the real metropolitan figure and is stored for display and
 * for anything that wants a continuous number; the TIER is what the game uses,
 * because tiers are what a GM reasons about. Cities are grouped by tier below
 * so the classification is easy to audit and argue with.
 *
 * Shared markets are shared on purpose: a Brooklyn franchise sits in the New
 * York market, and a Bay Area franchise in San Francisco's.
 */
const VERY_LARGE = {
  'New York': 20.1, 'Brooklyn': 20.1, 'Newark': 20.1,
  'Los Angeles': 13.0, 'Anaheim': 13.0,
  'Chicago': 9.4,
  'Dallas': 7.9, 'Fort Worth': 7.9,
  'Toronto': 6.4,
};
const LARGE = {
  'Houston': 7.3, 'Washington': 6.4, 'Philadelphia': 6.3, 'Atlanta': 6.2,
  'Miami': 6.2, 'Phoenix': 5.0, 'Boston': 4.9, 'San Francisco': 4.7,
  'Bay Area': 4.7, 'San Jose': 4.7, 'Oakland': 4.7,
  'Detroit': 4.4, 'Seattle': 4.0, 'Minneapolis': 3.7, 'Minnesota': 3.7,
  'San Diego': 3.3, 'Tampa': 3.3, 'Denver': 3.0, 'Montreal': 4.3,
};
const MEDIUM = {
  'Baltimore': 2.8, 'Charlotte': 2.7, 'Orlando': 2.7, 'San Antonio': 2.6,
  'Portland': 2.5, 'Sacramento': 2.4, 'Pittsburgh': 2.4, 'Las Vegas': 2.3,
  'Vegas': 2.3, 'Austin': 2.4, 'Cincinnati': 2.3, 'Kansas City': 2.2,
  'Columbus': 2.2, 'Cleveland': 2.1, 'Indianapolis': 2.1, 'Indiana': 2.1,
  'Nashville': 2.0, 'Vancouver': 2.6, 'Virginia Beach': 1.8, 'Providence': 1.7,
  'Jacksonville': 1.7, 'Milwaukee': 1.6, 'Raleigh': 1.5, 'Salt Lake City': 1.3,
  'Utah': 1.3, 'St. Louis': 2.8, 'Calgary': 1.6, 'Edmonton': 1.5, 'Ottawa': 1.5,
};
const SMALL = {
  'Oklahoma City': 1.4, 'Memphis': 1.3, 'Louisville': 1.3, 'New Orleans': 1.3,
  'Buffalo': 1.2, 'Birmingham': 1.1, 'Rochester': 1.1, 'Tucson': 1.1,
  'Tulsa': 1.0, 'Omaha': 1.0, 'Albuquerque': 0.9, 'Winnipeg': 0.8,
  'Boise': 0.8, 'Spokane': 0.6, 'Richmond': 1.3, 'Hartford': 1.2,
  'Des Moines': 0.7, 'Mobile': 0.4, 'Santa Fe': 0.2, 'Reno': 0.5,
  'Anchorage': 0.4, 'Halifax': 0.5, 'Green Bay': 0.3, 'Wichita': 0.6,
  'El Paso': 0.9, 'Fresno': 1.0, 'Bakersfield': 0.9, 'Colorado Springs': 0.8,
};

/** Flattened lookup, built once. */
const CITY_MARKETS = {};
for (const [tier, table] of [['Very Large', VERY_LARGE], ['Large', LARGE],
                             ['Medium', MEDIUM], ['Small', SMALL]]) {
  for (const [city, pop] of Object.entries(table)) {
    CITY_MARKETS[normalize(city)] = { tier, population: pop, city };
  }
}

/** Loose match so "st louis", "ST. LOUIS" and " Saint Louis " all land. */
function normalize(city) {
  return String(city || '')
    .toLowerCase()
    .replace(/^(saint|st)\.?\s+/, 'st ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * What market is this city in?
 * @param {string} city
 * @returns {{ tier: string, population: number, city: string }|null}
 *          null for a city the table does not know — an invented location.
 */
export function lookupCity(city) {
  return CITY_MARKETS[normalize(city)] || null;
}

/** Every known city, for a picker. Sorted largest market first, then A-Z. */
export function knownCities() {
  return Object.values(CITY_MARKETS)
    .sort((a, b) => marketRank(b.tier) - marketRank(a.tier) || a.city.localeCompare(b.city))
    .map((e) => ({ city: e.city, tier: e.tier, population: e.population }));
}

/**
 * The market tier for a team.
 *
 * Order of authority:
 *   1. an explicit manual override the user set (`marketOverride`)
 *   2. the city, looked up
 *   3. the stored metro population, for an invented city the user gave a size to
 *   4. Medium, as the neutral default for an unknown place
 *
 * Never random, and never derived from anything about the team itself.
 */
export function marketForTeam(team) {
  if (!team) return 'Medium';
  if (team.marketOverride && MARKET_TIERS.includes(team.marketOverride)) {
    return team.marketOverride;
  }
  const hit = lookupCity(team.city);
  if (hit) return hit.tier;
  if (typeof team.population === 'number') return marketFromPopulation(team.population);
  return 'Medium';
}

/**
 * Tier from a metro population in millions. Only used for invented cities the
 * table cannot know about; a real city is looked up, not estimated.
 */
export function marketFromPopulation(pop) {
  const p = Number(pop) || 0;
  if (p >= 6.5) return 'Very Large';
  if (p >= 3.0) return 'Large';
  if (p >= 1.5) return 'Medium';
  return 'Small';
}

/** A representative metro population for a tier, for invented cities. */
export function populationFromMarket(tier) {
  return { 'Very Large': 9.0, Large: 4.5, Medium: 2.2, Small: 1.0 }[tier] ?? 2.2;
}

/** The real metro population for a team's city, when the city is a real one. */
export function metroPopulation(team) {
  const hit = lookupCity(team && team.city);
  if (hit) return hit.population;
  return typeof (team && team.population) === 'number' ? team.population : null;
}

/**
 * How much a market multiplies commercial ceilings — local media, sponsorship,
 * merchandise. Exposed for revenue work later; deliberately NOT applied to
 * team budget, which is an ownership decision.
 */
export function marketMultiplier(tier) {
  return { 'Very Large': 1.45, Large: 1.18, Medium: 1.0, Small: 0.84 }[tier] ?? 1.0;
}
