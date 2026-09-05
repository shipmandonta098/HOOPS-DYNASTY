'use strict';

/**
 * schedule.js — the season's fixture list.
 *
 * WHERE THE LINE IS. A schedule is a PLAN: who plays whom, where, and on what
 * date. Generating that from the league's real teams is the same kind of thing
 * as generating the league's structure or its players, and without it the
 * Schedule screen has nothing to show.
 *
 * A RESULT is not a plan. Scores, records, streaks, home and away splits and
 * standings position are facts about games that have been played, and this file
 * produces none of them. Every fixture starts with `played: false` and no
 * score, the screen reads results off games actually simulated, and in a league
 * where nothing has been simulated every one of those columns is honestly
 * empty. Nothing here invents a result, a venue, a broadcaster or a tip-off
 * time.
 *
 * Deterministic: the same league, settings and seed always produce the same
 * season, and a user-entered Schedule Seed reproduces one exactly.
 */

import { makeRNG, hashString } from './leagueConfig.js';

import { matchupsFor, seasonCalendar, resolveTeams } from './scheduleRules.js';
import { restDaysOf } from './gameSettings.js';

/* ===========================================================================
 * BUILDING A SEASON
 * ---------------------------------------------------------------------------
 * Constraint-based, not hard-coded. The builder is handed a league of whatever
 * shape and a set of rules, and it places games on dates while checking each
 * one against every constraint that applies to the two teams involved. Nothing
 * in it knows how many teams a league "should" have.
 *
 * Constraints, all read from settings:
 *   rest          days a team is guaranteed between games
 *   back-to-back  how willingly consecutive days are allowed
 *   homestands    the longest run of home or road games
 *   idle          how long a team may go without playing
 *   calendar      the season window, with the All-Star break cut out of it
 * ======================================================================== */

/** How often a back-to-back is allowed when the rules permit any at all. */
const B2B_RATE = { None: 0, Rare: 0.06, Normal: 0.18, Frequent: 0.34 };
/** How willingly the builder extends a road trip or homestand. */
const TRIP_BIAS = { Rare: 0.1, Normal: 0.42, Frequent: 0.72 };
/** How much the ordering is shuffled from season to season. */
const VARIATION = { Low: 0.25, Normal: 0.6, High: 1 };

/**
 * A style preset overrides the individual rules it speaks for. Custom sets
 * nothing, which is what makes it custom.
 */
const STYLE = {
  Balanced:   { backToBackFrequency: 'Rare', roadTripFrequency: 'Rare',
                maxConsecutiveHome: 4, maxConsecutiveAway: 4 },
  Realistic:  { backToBackFrequency: 'Normal', roadTripFrequency: 'Frequent',
                maxConsecutiveHome: 6, maxConsecutiveAway: 6 },
  Compressed: { backToBackFrequency: 'Frequent', roadTripFrequency: 'Normal',
                maxConsecutiveHome: 7, maxConsecutiveAway: 7 },
  Relaxed:    { backToBackFrequency: 'None', roadTripFrequency: 'Rare',
                maxConsecutiveHome: 3, maxConsecutiveAway: 3 },
  Custom:     {},
};

/** Settings with the chosen style folded in. */
export function effectiveRules(settings) {
  return { ...settings, ...(STYLE[settings.scheduleStyle] || {}) };
}

/**
 * Every game of the season as a home/away pairing.
 *
 * An even number of meetings splits exactly. An odd one cannot, so the extra
 * game's host is fixed by a stable hash of the two ids — the imbalance lands
 * across the league rather than always on the same teams, and it is the same
 * every time this runs.
 */
function buildPairings(teams, matchups, rules, rng, season) {
  const confOf = (t) => t.conference;
  const divOf = (t) => t.division;
  const kindOf = (a, b) => (divOf(a) && divOf(a) === divOf(b) ? 'division'
    : confOf(a) && confOf(a) === confOf(b) ? 'conference' : 'nonConference');

  /**
   * Split n meetings between the two clubs as evenly as the number allows.
   *
   * An odd count cannot split evenly, and the extra home game must not land on
   * the same club every year — a franchise that gets the extra date forever is
   * a quiet, permanent advantage. The season is part of the hash, so the extra
   * alternates from year to year while staying deterministic within one.
   */
  const meet = (a, b, n, out) => {
    if (rules.homeAwayBalance === 'Random') {
      for (let k = 0; k < n; k++) {
        out.push(rng.next() < 0.5 ? { home: a.id, away: b.id } : { home: b.id, away: a.id });
      }
      return;
    }
    const half = Math.floor(n / 2);
    for (let k = 0; k < half; k++) out.push({ home: a.id, away: b.id });
    for (let k = 0; k < half; k++) out.push({ home: b.id, away: a.id });
    if (n % 2) {
      const aHosts = rules.homeAwayBalance === 'Mostly Balanced'
        ? rng.next() < 0.5
        : hashString(`${a.id}|${b.id}|${season}`) % 2 === 0;
      out.push(aHosts ? { home: a.id, away: b.id } : { home: b.id, away: a.id });
    }
  };

  const games = [];
  const pairs = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const a = teams[i], b = teams[j];
      const kind = kindOf(a, b);
      const n = matchups[kind];
      pairs.push({ a, b, kind });
      if (n) meet(a, b, n, games);
    }
  }

  /* ----------------------- the remaining games -------------------------- */
  // When the specified rules assign fewer games than the season length, the
  // shortfall is not dropped — it is distributed, one extra meeting at a time,
  // over the pairs whose category the user did NOT pin down. Pairs the user
  // specified exactly are left alone, because those numbers were instructions.
  const perTeam = {};
  for (const t of teams) perTeam[t.id] = 0;
  for (const g of games) { perTeam[g.home]++; perTeam[g.away]++; }
  const target = matchups.targetGames || 0;
  if (target > 0) {
    // Which pairs may take an extra meeting.
    //
    // A specified count is a GUARANTEED MINIMUM, not a ceiling — the spec's own
    // example assigns 76 of 82 and expects the generator to place the other
    // six, which it can only do by adding meetings to pairs the user already
    // gave a number. So every category is eligible EXCEPT one explicitly set to
    // zero: that is not "few games", it is "these teams never meet", and topping
    // it up would overrule the clearest instruction on the screen.
    const sources = matchups.sources || {};
    const eligible = pairs.filter((p) =>
      !(sources[p.kind] === 'user' && matchups[p.kind] === 0));
    // Pairs the user left to the generator go first, so the extras land where
    // no preference was expressed before they touch a specified category.
    const free = eligible.filter((p) => sources[p.kind] !== 'user')
      .concat(eligible.filter((p) => sources[p.kind] === 'user'));
    const order = free.slice();
    // Shuffled within each band so the extras are spread, without letting the
    // shuffle undo the auto-before-specified ordering above.
    const band = (p) => (sources[p.kind] !== 'user' ? 0 : 1);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      if (band(order[i]) !== band(order[j])) continue;
      [order[i], order[j]] = [order[j], order[i]];
    }
    // Rounds over the eligible pairs, adding a meeting only where BOTH clubs
    // are still short, so the extra games land evenly instead of piling onto
    // whichever pair happens to come first.
    // Each extra is a single game, so its host decides a home date outright.
    // Handing it to whichever club is currently the more road-heavy keeps the
    // top-up from unbalancing what the even splits above achieved — without
    // this, six extra games meant a six-game home/away gap.
    const homeCount = {};
    for (const t of teams) homeCount[t.id] = 0;
    for (const g of games) homeCount[g.home]++;
    const balancedMeet = (a, b) => {
      const aHomeShare = homeCount[a.id] - (perTeam[a.id] - homeCount[a.id]);
      const bHomeShare = homeCount[b.id] - (perTeam[b.id] - homeCount[b.id]);
      const host = aHomeShare <= bHomeShare ? a : b;
      const guest = host === a ? b : a;
      games.push({ home: host.id, away: guest.id });
      homeCount[host.id]++;
    };
    let added = true;
    for (let round = 0; round < 12 && added; round++) {
      added = false;
      for (const p of order) {
        if (perTeam[p.a.id] >= target || perTeam[p.b.id] >= target) continue;
        balancedMeet(p.a, p.b);
        perTeam[p.a.id]++; perTeam[p.b.id]++;
        added = true;
      }
    }
  }
  return games;
}

/**
 * Place the games on dates, checking each against the rules.
 *
 * DATE-MAJOR, then progressively relaxed. The builder walks the calendar in
 * order and fills each date from the pool, preferring whichever teams most
 * need a game — games still owed divided by dates still available. Walking the
 * calendar rather than the game list is what spreads a season evenly; placing
 * each game at its own earliest legal date instead front-loaded October and
 * left a quarter of the fixtures with nowhere to go.
 *
 * Each later pass drops the softest remaining constraint and re-walks the
 * calendar with what is left. The last enforces only the rule that is not a
 * preference — a team cannot play twice in a day — so the fixture list always
 * comes out complete and legal, and the constraints degrade in the order a
 * manager would give them up.
 */
const PASSES = [
  { rest: true, b2b: true, trips: true, streaks: true },
  { rest: true, b2b: true, trips: false, streaks: true },
  { rest: true, b2b: false, trips: false, streaks: true },
  { rest: false, b2b: false, trips: false, streaks: true },
  { rest: false, b2b: false, trips: false, streaks: false },
];

function place(games, dates, teams, rules, rng) {
  const rest = restDaysOf(rules);
  const rate = B2B_RATE[rules.backToBackFrequency] != null
    ? B2B_RATE[rules.backToBackFrequency] : 0.18;
  const trip = TRIP_BIAS[rules.roadTripFrequency] != null
    ? TRIP_BIAS[rules.roadTripFrequency] : 0.42;
  const maxHome = Math.max(1, rules.maxConsecutiveHome || 6);
  const maxAway = Math.max(1, rules.maxConsecutiveAway || 6);

  // Back-to-backs are a BUDGET per team, not a coin flip per attempt. A rate
  // of 0.18 then means about 18% of a team's games follow one the day before,
  // which is what "frequency" should mean; rolling a die at each placement
  // made the outcome depend on how often the builder happened to ask.
  const owed = {};
  for (const g of games) {
    owed[g.home] = (owed[g.home] || 0) + 1;
    owed[g.away] = (owed[g.away] || 0) + 1;
  }
  const state = {};
  for (const t of teams) {
    state[t.id] = {
      lastIdx: -Infinity, streak: 0, streakHome: null,
      owed: owed[t.id] || 0, b2b: 0, b2bMax: Math.round((owed[t.id] || 0) * rate),
    };
  }

  const busyByDate = dates.map(() => new Set());
  const countByDate = dates.map(() => 0);
  const capacity = Math.floor(teams.length / 2);
  let remaining = games.slice();
  const placed = [];

  const legal = (g, di, pass) => {
    if (busyByDate[di].has(g.home) || busyByDate[di].has(g.away)) return false;
    if (countByDate[di] >= capacity) return false;
    const h = state[g.home], a = state[g.away];
    const gapH = di - h.lastIdx, gapA = di - a.lastIdx;
    if (pass.rest && rest > 0 && (gapH <= rest || gapA <= rest)) return false;
    if (pass.b2b) {
      if (gapH === 1 && h.b2b >= h.b2bMax) return false;
      if (gapA === 1 && a.b2b >= a.b2bMax) return false;
    }
    if (pass.streaks) {
      if (h.streakHome === true && h.streak >= maxHome) return false;
      if (a.streakHome === false && a.streak >= maxAway) return false;
    }
    if (pass.trips) {
      // EXTENDING a run is what road-trip frequency governs. Breaking one is
      // the default and is never gated — gating it was the bug that made a
      // quarter of a season unplaceable, because a team could then barely host
      // a game the day after playing away.
      if (h.streakHome === true && h.streak > 0 && rng.next() > trip) return false;
      if (a.streakHome === false && a.streak > 0 && rng.next() > trip) return false;
    }
    return true;
  };

  const commit = (g, di) => {
    busyByDate[di].add(g.home); busyByDate[di].add(g.away);
    countByDate[di]++;
    placed.push({ ...g, date: dates[di] });
    for (const [id, isHome] of [[g.home, true], [g.away, false]]) {
      const st = state[id];
      if (di - st.lastIdx === 1) st.b2b++;
      st.streak = st.streakHome === isHome ? st.streak + 1 : 1;
      st.streakHome = isHome;
      st.lastIdx = di;
      st.owed--;
    }
  };

  for (const pass of PASSES) {
    if (!remaining.length) break;
    for (let di = 0; di < dates.length && remaining.length; di++) {
      const left = dates.length - di;
      // Urgency: games still owed against dates still available. The team
      // furthest behind gets first refusal, which is what keeps anyone from
      // disappearing from the schedule for weeks.
      const urgency = (g) =>
        Math.max(state[g.home].owed, state[g.away].owed) / Math.max(1, left);
      const order = remaining
        .map((g, i) => ({ g, i, u: urgency(g) }))
        .sort((x, y) => y.u - x.u);
      // Preferring the best-rested pair here was tried and made things worse:
      // it packed the season into 141 of 167 dates and opened month-long gaps,
      // without improving the back-to-back rate at all. Urgency alone spreads
      // the calendar, and the back-to-back squeeze is a window problem that
      // validation reports rather than one the ordering can solve.

      const taken = new Set();
      for (const { g, i } of order) {
        if (countByDate[di] >= capacity) break;
        if (!legal(g, di, pass)) continue;
        commit(g, di);
        taken.add(i);
      }
      if (taken.size) remaining = remaining.filter((_, i) => !taken.has(i));
    }
  }
  return { placed, unplaced: remaining.length };
}

/**
 * Build a season's fixture list from the league and its schedule rules.
 *
 * @param {object} league   needs `teams`, `meta.rngSeed`, `settings`
 * @param {number} [season] the season year; defaults to the league's current
 * @returns {{ season, games, plan }}
 */
export function buildSchedule(league, season, settingsOverride, structure) {
  // Resolved once, so the pairing maths and the matchup maths see the same
  // conferences whether they came off the team or off the league structure.
  const teams = resolveTeams(league.teams, structure || league.structure);
  const year = season || (league.meta && league.meta.currentSeason) || 2026;
  const rules = effectiveRules(settingsOverride || league.settings || {});
  if (teams.length < 2) return { season: year, games: [], plan: null };

  // A user seed reproduces a schedule exactly; blank derives one from the
  // league, and the season year keeps each year's schedule different.
  const seedSource = rules.scheduleSeed
    ? `seed:${rules.scheduleSeed}:${year}`
    : `schedule:${league.meta && league.meta.rngSeed}:${year}`;
  const rng = makeRNG(hashString(seedSource));

  const matchups = matchupsFor(teams, rules);   // already resolved
  const cal = seasonCalendar(rules, year - 1);
  const pairs = buildPairings(teams,
    { ...matchups, targetGames: rules.regularSeasonGames }, rules, rng, year);

  // Variation shuffles how the season is dealt. Low keeps the ordering close to
  // the pairing order, High reorders it freely — every season differs either
  // way, because the seed carries the year.
  const amount = VARIATION[rules.scheduleVariation] != null
    ? VARIATION[rules.scheduleVariation] : 0.6;
  for (let i = pairs.length - 1; i > 0; i--) {
    if (rng.next() > amount) continue;
    const j = Math.floor(rng.next() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }

  const { placed, unplaced } = place(pairs, cal.dates, teams, rules, rng);
  placed.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const firstDate = placed.length ? placed[0].date : null;
  const lastDate = placed.length ? placed[placed.length - 1].date : null;

  const games = placed.map((g, i) => ({
    id: `g_${year}_${String(i).padStart(4, '0')}`,
    date: g.date,
    home: g.home,
    away: g.away,
    // Marked dates, which are facts about the fixture list rather than results.
    ...(rules.openingNight && g.date === firstDate ? { openingNight: true } : {}),
    ...(rules.seasonFinale && g.date === lastDate ? { finale: true } : {}),
    // A fixture is a plan. Everything below is a fact about a game that has
    // been played, and stays empty until the simulator fills it in.
    played: false,
    homeScore: null,
    awayScore: null,
  }));

  return {
    season: year,
    games,
    plan: {
      matchups,
      gamesPerTeam: matchups.gamesPerTeam,
      dates: cal.dates.length,
      breakDates: cal.blocked,
      unplaced,
      seed: seedSource,
    },
  };
}

/* ===========================================================================
 * READING A SCHEDULE
 * ---------------------------------------------------------------------------
 * Everything below derives from games ACTUALLY PLAYED. With none played, every
 * one of these returns an empty record rather than a plausible-looking one.
 * ======================================================================== */

/**
 * What a generated schedule ACTUALLY came out as.
 *
 * Measured from the fixture list rather than predicted from the settings,
 * because the settings are targets and the generator relaxes them when the
 * calendar is too tight. The preview shows these so a user sees the schedule
 * they will get, not the one they asked for.
 */
export function scheduleStats(schedule, teams) {
  const games = schedule.games || [];
  const ids = (teams || []).map((t) => t.id);
  const byTeam = {};
  for (const id of ids) byTeam[id] = [];
  for (const g of games) {
    if (byTeam[g.home]) byTeam[g.home].push({ date: g.date, home: true });
    if (byTeam[g.away]) byTeam[g.away].push({ date: g.date, home: false });
  }
  let b2b = 0, played = 0, maxGap = 0, maxHome = 0, maxAway = 0;
  let minGames = Infinity, maxGames = 0, worstBalance = 0;
  for (const id of ids) {
    const list = byTeam[id].sort((a, b) => (a.date < b.date ? -1 : 1));
    minGames = Math.min(minGames, list.length);
    maxGames = Math.max(maxGames, list.length);
    const h = list.filter((x) => x.home).length;
    worstBalance = Math.max(worstBalance, Math.abs(h - (list.length - h)));
    let hs = 0, as = 0;
    for (let i = 0; i < list.length; i++) {
      played++;
      if (i) {
        const gap = (new Date(list[i].date) - new Date(list[i - 1].date)) / 86400000;
        if (gap === 1) b2b++;
        if (gap > maxGap) maxGap = gap;
      }
      if (list[i].home) { hs++; as = 0; } else { as++; hs = 0; }
      if (hs > maxHome) maxHome = hs;
      if (as > maxAway) maxAway = as;
    }
  }
  const dates = new Set(games.map((g) => g.date));
  return {
    games: games.length,
    gamesPerTeam: minGames === maxGames ? minGames : `${minGames}\u2013${maxGames}`,
    dates: dates.size,
    backToBackPct: played ? Math.round((b2b / played) * 100) : 0,
    longestGap: maxGap,
    longestHomestand: maxHome,
    longestRoadTrip: maxAway,
    homeAwayGap: worstBalance,
    unplaced: (schedule.plan && schedule.plan.unplaced) || 0,
  };
}

/** One team's games, in date order, with the view from that team's side. */
export function teamGames(schedule, teamId) {
  return (schedule.games || [])
    .filter((g) => g.home === teamId || g.away === teamId)
    .map((g) => {
      const home = g.home === teamId;
      const opponent = home ? g.away : g.home;
      const forScore = home ? g.homeScore : g.awayScore;
      const againstScore = home ? g.awayScore : g.homeScore;
      const result = g.played && forScore != null && againstScore != null
        ? (forScore > againstScore ? 'W' : 'L') : null;
      return { ...g, home, opponent, forScore, againstScore, result };
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * A team's record through the games it has played.
 *
 * Returns nulls rather than zeros where nothing has happened: 0-0 is a claim
 * that a team has played and not won, and "no games yet" is a different
 * statement.
 */
export function teamRecord(games) {
  const done = games.filter((g) => g.result);
  if (!done.length) {
    return { wins: 0, losses: 0, played: 0, home: null, away: null, streak: null, last10: null };
  }
  const tally = (list) => list.reduce((acc, g) => {
    if (g.result === 'W') acc.w++; else acc.l++;
    return acc;
  }, { w: 0, l: 0 });

  const all = tally(done);
  const home = tally(done.filter((g) => g.home));
  const away = tally(done.filter((g) => !g.home));

  // Streak reads backwards from the most recent game.
  let streak = 0, kind = done[done.length - 1].result;
  for (let i = done.length - 1; i >= 0 && done[i].result === kind; i--) streak++;

  const last = done.slice(-10);
  const l10 = tally(last);

  return {
    wins: all.w, losses: all.l, played: done.length,
    home: `${home.w}-${home.l}`, away: `${away.w}-${away.l}`,
    streak: `${kind}${streak}`,
    last10: `${l10.w}-${l10.l}`,
  };
}

/** The running record after each game, for the table's Record column. */
export function runningRecords(games) {
  let w = 0, l = 0;
  return games.map((g) => {
    if (g.result === 'W') w++;
    else if (g.result === 'L') l++;
    return g.result ? `${w}-${l}` : null;
  });
}

/**
 * Every game in the league on one date, for the league-wide day view.
 *
 * Sorted by home team so a day reads in a stable order rather than in whatever
 * order the fixture builder happened to deal them.
 */
export function leagueGamesOn(schedule, date) {
  return (schedule.games || [])
    .filter((g) => g.date === date)
    .map((g) => {
      const result = g.played && g.homeScore != null && g.awayScore != null
        ? (g.homeScore > g.awayScore ? 'home' : 'away') : null;
      return { ...g, winner: result };
    })
    .sort((a, b) => (a.home < b.home ? -1 : a.home > b.home ? 1 : 0));
}

/** How many games the league plays on each date, keyed by date. */
export function gamesPerDate(schedule) {
  const counts = new Map();
  for (const g of schedule.games || []) counts.set(g.date, (counts.get(g.date) || 0) + 1);
  return counts;
}

/** Every date the league plays on, in order. */
export function leagueDates(schedule) {
  return [...new Set((schedule.games || []).map((g) => g.date))].sort();
}

/** The next game that has not been played, or null once the season is over. */
export function nextGame(games) {
  return games.find((g) => !g.played) || null;
}

/** Months the schedule spans, as `{ key: 'YYYY-MM', label, year, month }`. */
export function scheduleMonths(games) {
  const seen = new Map();
  for (const g of games) {
    const key = g.date.slice(0, 7);
    if (!seen.has(key)) {
      const [y, m] = key.split('-').map(Number);
      seen.set(key, { key, year: y, month: m - 1,
        label: new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US',
          { month: 'long', year: 'numeric', timeZone: 'UTC' }) });
    }
  }
  return [...seen.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
}

/** `2026-01-14` -> `Wed, Jan 14`. */
export function formatGameDate(iso) {
  if (!iso) return '—';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US',
    { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** `2026-01-14` -> `Wednesday, January 14, 2026`. */
export function formatLongDate(iso) {
  if (!iso) return '—';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US',
    { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** The schedule as CSV, for the export button. Real fixtures, empty results. */
export function toCSV(games, nameOf) {
  const head = 'Date,Opponent,Location,Result,Score,Record';
  const records = runningRecords(games);
  const rows = games.map((g, i) => [
    g.date,
    nameOf(g.opponent),
    g.home ? 'Home' : 'Away',
    g.result || '',
    g.result ? `${g.forScore}-${g.againstScore}` : '',
    records[i] || '',
  ].map((v) => (/[",]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(','));
  return [head, ...rows].join('\n');
}
