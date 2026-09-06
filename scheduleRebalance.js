'use strict';

/**
 * scheduleRebalance.js — spreading a season's back-to-backs out.
 *
 * WHAT THIS MOVES, AND WHAT IT REFUSES TO. Dates move. Matchups never do.
 *
 * That is the whole design, and it is a deliberate departure from the brief,
 * which suggests "swap opponents with nearby teams". Swapping opponents would
 * silently break three things this league already guarantees: the matchup
 * frequency the user set (four meetings with a division rival becomes three,
 * and a team it should never play appears on the card), the home and away
 * split, and each club's game count. A schedule that obeys a rest rule by
 * quietly playing the wrong teams has not been repaired, it has been replaced.
 *
 * So every fixture keeps its two clubs and its host. The only edit is which
 * night it is played on, which means the season length, every matchup count and
 * every home/away balance come out of a rebalance bit-identical to what went
 * in. Those are checked after every run rather than assumed.
 *
 * REST DAYS ARE NOT FIXTURES. The brief's output puts `{ restDay: true }` rows
 * in the schedule. A rest day is the ABSENCE of a game, derivable from the
 * fixture list in one line, and a league-wide list of them would be some
 * thousands of rows recording that nothing happened. They are emitted only in
 * the single-team report, where they mark the specific dates a club was
 * relieved of a game by this pass — which is information, because it says what
 * changed.
 *
 * WHERE GAMES MAY GO. Only onto dates the season already plays on. A schedule
 * knows its own game nights; the calendar around them may contain an All-Star
 * break, blackout dates or the gap before the playoffs, and none of that is
 * visible from a fixture list alone. Restricting moves to nights that already
 * host basketball means a rebalance can never invent a game night the league
 * had deliberately left empty.
 */

/* ------------------------------------------------------------------- rules */

/**
 * THE BRIEF SETS THREE DIFFERENT THRESHOLDS, AND THEY DISAGREE.
 *
 * Task 1 detects "3+ consecutive back-to-backs". Task 3 acts on "2+ consecutive
 * back-to-backs". The standing rule says "never more than 2 consecutive games
 * without rest". Read consistently — a back-to-back being a game played the
 * night after another — those are: four games in four nights, three in three,
 * and two in two.
 *
 * The standing rule is the strictest and it subsumes the other two: a team that
 * never plays three nights running can never have two consecutive back-to-backs
 * to act on, let alone three to detect. So the standing rule is the constraint,
 * the other two are reported for the diagnosis they give, and nothing has to
 * pick between them.
 */
export const DEFAULT_RULES = {
  /** Longest run of consecutive game-nights a team may have. */
  maxConsecutiveGames: 2,
  /**
   * The band each club's back-to-back count should land in.
   *
   * A BAND, NOT A CEILING, and that distinction is the whole feature. Asking
   * for "14 back-to-backs" is asking for a league AVERAGE around 14, not a
   * quota of exactly 14 each — a real season has clubs on 12 and clubs on 16.
   * So a club under the floor is scored as far from the requested schedule as
   * one over the roof, and the repair pulls in both directions. Score only the
   * ceiling and the repair shaves every club down to it, which produces a
   * flatter, more artificial season than the one that was asked for.
   *
   * Null on the maximum derives a band from the schedule itself.
   */
  targetBackToBacks: null,
  minBackToBacksPerTeam: 0,
  maxBackToBacksPerTeam: null,
  /** Nights off required between games that are not a back-to-back. */
  minRestDaysBetweenGames: 1,
  /**
   * How far, in game-nights, a fixture may be moved. Null means anywhere.
   *
   * Unbounded is the default because bounding it measured WORSE AND SLOWER. A
   * pile-up in the opening fortnight can only be drained into the months that
   * have room, which are two and three months away; with a three-week window
   * the search cannot reach them, so it makes many small moves that each buy a
   * little and never fixes the cause. Unbounded, the same schedule converges in
   * three sweeps instead of seven, makes fewer moves, and clears every breach.
   *
   * Locality is not lost by this: ties break towards the smallest displacement,
   * so the median move in a full season is one night. A handful of fixtures
   * travel months, which is exactly what draining an over-booked October
   * requires.
   */
  moveWindow: null,
  /**
   * The nights a fixture may be placed on, as ISO dates. Null means "the nights
   * this schedule already plays on".
   *
   * That default is the safe one for a schedule arriving on its own: a fixture
   * list does not say which of the empty days around it are legal, and the gaps
   * may be an All-Star break or the run-up to the playoffs, so filling them
   * would invent game nights the league deliberately left clear.
   *
   * It is also restrictive enough to matter. A season that uses 94 nights out of
   * a 165-day window has nowhere to spread into, and a repair confined to those
   * 94 stalls with most of its clubs still over the limit — measured, not
   * guessed. So a caller that KNOWS the legal calendar should pass it, and the
   * generator does.
   */
  nights: null,
  /**
   * How many games each night should carry, as a Map of date to count.
   *
   * Scored, not enforced. Without it the repair flattens the week: it moves
   * games wherever a rest rule is cheapest and has no opinion about Friday
   * versus Monday, so a shaped placement comes out level again. With it the
   * shape is one more thing a move is judged on — heavily enough to hold the
   * week together, far too lightly to be worth breaking a rest rule for.
   */
  nightTargets: null,
  maxPasses: 40,
};

/** How badly each kind of breach counts. Runs are the hard rule, so they cost more. */
// Breaching the run limit is a hard rule and costs most. Missing the band is a
// target, so it costs less — and overshooting costs a shade more than
// undershooting, because a tired club is a worse outcome than a rested one.
const COST = { run: 100, over: 12, under: 8, drift: 1, shape: 3 };

/** How many blocked-but-useful nights a fixture will look for a swap partner on. */
const SWAP_NIGHTS = 6;

/**
 * The band a repair works to, from whatever the caller supplied.
 *
 * A caller that says nothing gets a band derived from the schedule, which keeps
 * the module usable on a bare fixture list. A caller that names a target and a
 * band gets exactly that.
 */
/**
 * A per-club target for each team, spread around the league's.
 *
 * WHY THIS EXISTS. A single league-wide target plus a pull towards it produces
 * a league where every club has exactly that number — measured, not feared: a
 * target of 14 gave thirty clubs on 14, spread zero. That is the one outcome
 * the setting explicitly rules out, because a league average of 14 is supposed
 * to mean clubs on 12 and clubs on 16, not thirty identical schedules.
 *
 * So the clubs are dealt their own numbers around the league target, in
 * symmetric pairs so the pairs cancel and the LEAGUE average still lands on
 * what was typed. Offsets reach out to the variance and no further, and stop
 * early at whichever edge of the band arrives first, so an off-centre band
 * (an explicit minimum or maximum) never drags the average off the target.
 *
 * The deal is by a hash of the club's id, so it is stable for a given league
 * and arbitrary-looking rather than alphabetical — the same league always
 * produces the same schedule, which is the rule everywhere else here too.
 */
function perTeamTargets(teams, band, variance) {
  const reach = variance != null
    ? Math.max(0, variance)
    : Math.max(0, Math.min(band.target - band.min, band.max - band.target));
  const base = Math.min(band.max, Math.max(band.min, band.target));
  // Pairs kept adjacent so a team count that does not divide evenly breaks at
  // most one pair, rather than skewing the whole deal one way.
  const offsets = [0];
  for (let k = 1; k <= reach; k++) {
    if (base - k < band.min || base + k > band.max) break;
    offsets.push(-k, k);
  }
  const order = [...teams].sort((a, b) => {
    const ha = hash(String(a)), hb = hash(String(b));
    return ha - hb || (a < b ? -1 : 1);
  });
  const out = new Map();
  order.forEach((t, i) => {
    out.set(t, { min: band.min, max: band.max, target: base + offsets[i % offsets.length] });
  });
  return out;
}

/** FNV-1a, so the deal is stable without importing the league's RNG. */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function resolveBand(r, gamesPerTeam) {
  const max = r.maxBackToBacksPerTeam != null
    ? Math.max(0, r.maxBackToBacksPerTeam)
    : Math.max(0, Math.round(gamesPerTeam * 0.18));
  const min = Math.min(max, Math.max(0, r.minBackToBacksPerTeam || 0));
  const target = r.targetBackToBacks != null
    ? Math.max(0, r.targetBackToBacks)
    : Math.round((min + max) / 2);
  return { min, max, target };
}

const dayNumber = (iso) => {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
};
const isoOf = (n) => new Date(n * 86400000).toISOString().slice(0, 10);

/** Both fixture shapes this project reads, normalised to one. */
function normalise(schedule) {
  const list = Array.isArray(schedule) ? schedule
    : (schedule && Array.isArray(schedule.games)) ? schedule.games : [];
  return list.map((g, i) => ({
    ref: g,
    idx: i,
    id: g.id != null ? g.id : (g.gameId != null ? g.gameId : `#${i}`),
    date: String(g.date).slice(0, 10),
    home: g.home || g.homeTeam,
    away: g.away || g.awayTeam,
    // A fixture pinned to the first or last night of the season is part of the
    // season's shape, not a spare part to move.
    pinned: g.openingNight === true || g.finale === true,
  }));
}

/* -------------------------------------------------------------- diagnosis */

/**
 * A team's game-nights, split into runs of consecutive days.
 *
 * @returns {Array<{ start, end, length, dates }>} one entry per unbroken run.
 */
export function runsOf(dates) {
  const sorted = [...new Set(dates)].sort();
  const runs = [];
  for (const d of sorted) {
    const last = runs[runs.length - 1];
    if (last && dayNumber(d) - dayNumber(last.dates[last.dates.length - 1]) === 1) {
      last.dates.push(d);
    } else {
      runs.push({ dates: [d] });
    }
  }
  return runs.map((r) => ({
    start: r.dates[0], end: r.dates[r.dates.length - 1],
    length: r.dates.length, dates: r.dates,
  }));
}

/**
 * Stretches where a team plays enough nights running to be an overload.
 *
 * A run of L nights contains L-1 back-to-backs, so the brief's "3+ consecutive
 * back-to-backs" is a run of four or more. Both counts are returned, because
 * the run length is what a schedule can be repaired against and the
 * back-to-back count is what the brief asks about.
 */
export function findOverloads(schedule, rules = {}) {
  const r = { ...DEFAULT_RULES, ...rules };
  const games = normalise(schedule);
  const byTeam = new Map();
  for (const g of games) {
    for (const t of [g.home, g.away]) {
      if (!byTeam.has(t)) byTeam.set(t, []);
      byTeam.get(t).push(g.date);
    }
  }
  const out = [];
  for (const [team, dates] of byTeam) {
    for (const run of runsOf(dates)) {
      if (run.length <= r.maxConsecutiveGames) continue;
      out.push({
        team, start: run.start, end: run.end,
        games: run.length,
        consecutiveBackToBacks: run.length - 1,
        overBy: run.length - r.maxConsecutiveGames,
        dates: run.dates,
      });
    }
  }
  return out.sort((a, b) => b.games - a.games || (a.start < b.start ? -1 : 1));
}

/** Every team's back-to-back count and worst run, from a fixture list. */
export function teamProfiles(schedule, rules = {}) {
  const r = { ...DEFAULT_RULES, ...rules };
  const games = normalise(schedule);
  const byTeam = new Map();
  for (const g of games) {
    for (const t of [g.home, g.away]) {
      if (!byTeam.has(t)) byTeam.set(t, []);
      byTeam.get(t).push(g.date);
    }
  }
  const out = new Map();
  for (const [team, dates] of byTeam) {
    const runs = runsOf(dates);
    out.set(team, {
      team,
      games: dates.length,
      backToBacks: runs.reduce((s, x) => s + (x.length - 1), 0),
      longestRun: runs.reduce((m, x) => Math.max(m, x.length), 0),
      overloads: runs.filter((x) => x.length > r.maxConsecutiveGames).length,
      runs,
    });
  }
  return out;
}

/**
 * Is the cap even reachable on this calendar?
 *
 * A team playing G games of which at most B are second-nights needs at least
 * `B + (G - 1 - B) * (minRest + 1)` days from its first game to its last. If
 * the season is shorter than that, no arrangement of fixtures can comply and
 * the honest answer is to say so with the numbers rather than to shuffle games
 * for forty passes and report a failure at the end.
 */
export function feasibility(schedule, rules = {}) {
  const r = { ...DEFAULT_RULES, ...rules };
  const games = normalise(schedule);
  if (!games.length) return { feasible: true, reason: 'empty schedule' };
  const dates = [...new Set(games.map((g) => g.date))].sort();
  const span = dayNumber(dates[dates.length - 1]) - dayNumber(dates[0]) + 1;
  const profiles = teamProfiles(schedule, r);
  const perTeam = Math.max(...[...profiles.values()].map((p) => p.games));
  const cap = resolveBand(r, perTeam).max;
  // A run limit of one game means every game needs a night off before it,
  // whatever the stated minimum rest says — otherwise the two disagree and the
  // arithmetic below quietly reports a cap as reachable when it is not.
  const gap = Math.max(r.minRestDaysBetweenGames, r.maxConsecutiveGames <= 1 ? 1 : 0) + 1;
  const needed = cap + Math.max(0, perTeam - 1 - cap) * gap + 1;
  return {
    feasible: needed <= span,
    gamesPerTeam: perTeam,
    maxBackToBacksPerTeam: cap,
    daysNeeded: needed,
    daysAvailable: span,
    slack: span - needed,
    playNights: dates.length,
    reason: needed <= span ? null
      : `A team playing ${perTeam} games with at most ${cap} back-to-backs and `
        + `${r.minRestDaysBetweenGames} rest day(s) otherwise needs ${needed} days; `
        + `the season spans ${span}.`,
  };
}

/* --------------------------------------------------------------- rebalance */

/** What a team's date list costs, in breaches. Used for reporting. */
function teamCost(dates, r, band) {
  const runs = runsOf(dates);
  let pen = 0, b2b = 0;
  for (const run of runs) {
    b2b += run.length - 1;
    if (run.length > r.maxConsecutiveGames) {
      pen += (run.length - r.maxConsecutiveGames) * COST.run;
    }
  }
  return totalOf(pen, b2b, band);
}

/**
 * THE SAME COST, COMPUTED INCREMENTALLY — which is the difference between this
 * finishing and this not finishing.
 *
 * The obvious implementation re-derives a club's runs for every candidate night
 * of every candidate fixture. For a full season that is millions of sorts of an
 * eighty-element array, and it does not return in any time worth waiting for.
 * It also is not necessary: moving one game touches only the run it leaves and
 * the run it joins, and both are found by walking a few days out from a date.
 * Everything below is that walk, over a Set of day numbers so that asking
 * "does this club play that night" is a lookup rather than a search.
 */
const runPenalty = (len, maxRun) => (len > maxRun ? (len - maxRun) * COST.run : 0);

/** Nights in the unbroken run ending just before `day`. */
function runBefore(days, day) {
  let n = 0;
  while (days.has(day - 1 - n)) n++;
  return n;
}
/** Nights in the unbroken run starting just after `day`. */
function runAfter(days, day) {
  let n = 0;
  while (days.has(day + 1 + n)) n++;
  return n;
}

/** What taking a game off `day` does to a club's run penalty and back-to-backs. */
function removeDelta(days, day, maxRun) {
  const a = runBefore(days, day), b = runAfter(days, day);
  return {
    pen: runPenalty(a, maxRun) + runPenalty(b, maxRun) - runPenalty(a + 1 + b, maxRun),
    b2b: (Math.max(0, a - 1) + Math.max(0, b - 1)) - (a + b),
  };
}

/** And what putting one on `day` does. */
function addDelta(days, day, maxRun) {
  const a = runBefore(days, day), b = runAfter(days, day);
  return {
    pen: runPenalty(a + 1 + b, maxRun) - runPenalty(a, maxRun) - runPenalty(b, maxRun),
    b2b: (a + b) - (Math.max(0, a - 1) + Math.max(0, b - 1)),
  };
}

/** A club's whole cost, read once off its day-number Set. */
function costFromDays(days, maxRun, band) {
  let pen = 0, b2b = 0;
  for (const d of days) {
    // Score each run once, at its first night.
    if (days.has(d - 1)) { b2b++; continue; }
    let len = 1;
    while (days.has(d + len)) len++;
    pen += runPenalty(len, maxRun);
  }
  return { pen, b2b, total: totalOf(pen, b2b, band) };
}

/**
 * The cost of a club whose penalty and back-to-back totals are already known.
 *
 * `band` is `{ min, max }`. Being under the floor costs, being over the roof
 * costs more, and anywhere between the two costs nothing at all — which is what
 * lets the league spread naturally across the band instead of piling onto one
 * number.
 */
const totalOf = (pen, b2b, band) => pen
  + (b2b > band.max ? (b2b - band.max) * COST.over : 0)
  + (b2b < band.min ? (band.min - b2b) * COST.under : 0)
  // A WEAK PULL TOWARDS THE TARGET, inside the band as well as outside it.
  //
  // Without it the repair stops the moment every club clears the floor, and
  // since it can only ever reduce back-to-backs it stops there: a league asked
  // for 14 measured 12.4, sitting on the bottom of its own band. The target is
  // an average the user typed, so the league should centre on it.
  //
  // The weight is deliberately an order below the band penalties. Strong enough
  // to pull the average up off the floor, far too weak to be worth breaking a
  // run limit or a band for — and weak enough that clubs still settle a set or
  // two either side rather than collapsing onto one number, which is the whole
  // reason the setting is an average and not a quota.
  + Math.abs(b2b - band.target) * COST.drift;

/**
 * Move fixtures between nights until the rest rules hold.
 *
 * The method is local repair, not a re-solve. Each sweep walks the fixture list
 * in a fixed order — so the same schedule and rules always produce the same
 * moves — and for any fixture belonging to a club currently in breach, tries
 * every legal night inside its window and takes the best strictly-improving
 * one. It stops when a whole sweep changes nothing, which is a real stopping
 * point rather than a failure; whatever breach is left is reported instead of
 * being papered over.
 *
 * A move is legal only if both clubs are free that night, the night is one the
 * season already plays on, and it would not push that night past the number of
 * games the league can physically stage.
 */
export function rebalanceSchedule(schedule, rules = {}) {
  const r = { ...DEFAULT_RULES, ...rules };
  const games = normalise(schedule);
  if (!games.length) return emptyResult(games, r);

  // Every night a fixture may occupy: the caller's legal calendar when it gave
  // one, otherwise the nights already in use. Nights currently carrying games
  // are always included, so a schedule can never be made unplaceable by a
  // calendar that forgot one of its own dates.
  const nights = [...new Set([
    ...(Array.isArray(r.nights) ? r.nights.map((d) => String(d).slice(0, 10)) : []),
    ...games.map((g) => g.date),
  ])].sort();
  const nightDay = nights.map(dayNumber);
  const nightIdx = new Map(nights.map((d, i) => [d, i]));
  const teams = [...new Set(games.flatMap((g) => [g.home, g.away]))];
  const capacity = Math.max(1, Math.floor(teams.length / 2));
  const maxRun = r.maxConsecutiveGames;

  // Live state. The caller's array is never touched.
  const days = new Map(teams.map((t) => [t, new Set()]));    // team -> Set(day number)
  const busy = new Map(nights.map((d) => [d, new Set()]));   // date -> Set(team)
  const load = new Map(nights.map((d) => [d, 0]));           // date -> games that night
  const at = games.map((g) => nightIdx.get(g.date));         // game -> night index
  const onNight = nights.map(() => new Set());               // night index -> game indices
  games.forEach((g, i) => onNight[nightIdx.get(g.date)].add(i));
  for (const g of games) {
    for (const t of [g.home, g.away]) {
      days.get(t).add(dayNumber(g.date));
      busy.get(g.date).add(t);
    }
    load.set(g.date, load.get(g.date) + 1);
  }

  const profiles = teamProfiles(schedule, r);
  const perTeam = Math.max(...[...profiles.values()].map((p) => p.games));
  const leagueBand = resolveBand(r, perTeam);
  const bands = perTeamTargets(teams, leagueBand, r.b2bVariance != null ? r.b2bVariance : null);
  const bandOf = (t) => bands.get(t) || leagueBand;

  // Each club's running penalty and back-to-back total, carried forward by the
  // same deltas that score the moves, so nothing is recomputed wholesale.
  const pen = new Map(), b2b = new Map();
  for (const t of teams) {
    const c = costFromDays(days.get(t), maxRun, bandOf(t));
    pen.set(t, c.pen); b2b.set(t, c.b2b);
  }
  const cost = (t) => totalOf(pen.get(t), b2b.get(t), bandOf(t));

  // What a night costs at a given load. Absent targets make this free, which
  // leaves the repair behaving exactly as it did before the shape existed.
  const wanted = r.nightTargets instanceof Map ? r.nightTargets : null;
  const nightCost = (date, at2) => (wanted
    ? Math.abs(at2 - (wanted.get(date) != null ? wanted.get(date) : at2)) * COST.shape
    : 0);
  /** What moving one game off `from` and onto `to` does to the weekly shape. */
  const shapeGain = (from, to) => {
    if (!wanted) return 0;
    const lf = load.get(from), lt = load.get(to);
    return (nightCost(from, lf) + nightCost(to, lt))
         - (nightCost(from, lf - 1) + nightCost(to, lt + 1));
  };

  const moves = [];

  /** Recost a set of clubs from scratch, and write the result back. */
  const recost = (clubs) => {
    let total = 0;
    for (const t of clubs) {
      const c = costFromDays(days.get(t), maxRun, bandOf(t));
      pen.set(t, c.pen); b2b.set(t, c.b2b);
      total += c.total;
    }
    return total;
  };

  /** Move one fixture's date in the live state, without scoring it. */
  const moveGame = (i, toIdx) => {
    const g = games[i];
    const fromIdx = at[i];
    const fromDate = nights[fromIdx], toDate = nights[toIdx];
    for (const t of [g.home, g.away]) {
      days.get(t).delete(nightDay[fromIdx]);
      days.get(t).add(nightDay[toIdx]);
      busy.get(fromDate).delete(t);
      busy.get(toDate).add(t);
    }
    load.set(fromDate, load.get(fromDate) - 1);
    load.set(toDate, load.get(toDate) + 1);
    onNight[fromIdx].delete(i);
    onNight[toIdx].add(i);
    at[i] = toIdx;
  };

  /**
   * What trading two fixtures' dates would buy, in cost.
   *
   * Swapping is legal only if each fixture's clubs are free on the other's
   * night once the other has vacated it — sharing a club makes the trade a
   * no-op at best and a double-booking at worst. The gain is measured by
   * actually performing the swap on the live state, recosting the clubs
   * involved, and undoing it, which is exact and short enough not to matter.
   */
  const swapGain = (i, j) => {
    const a = games[i], b = games[j];
    if (a.home === b.home || a.home === b.away
        || a.away === b.home || a.away === b.away) return 0;
    const ai = at[i], bi = at[j];
    if (ai === bi) return 0;
    const aDate = nights[ai], bDate = nights[bi];
    // Free on the other's night, ignoring the fixture that is leaving it.
    if (busy.get(bDate).has(a.home) || busy.get(bDate).has(a.away)) return 0;
    if (busy.get(aDate).has(b.home) || busy.get(aDate).has(b.away)) return 0;

    const clubs = [a.home, a.away, b.home, b.away];
    const snapshot = clubs.map((t) => [pen.get(t), b2b.get(t)]);
    const before = clubs.reduce((sum, t) => sum + totalOf(pen.get(t), b2b.get(t), bandOf(t)), 0);
    moveGame(i, bi); moveGame(j, ai);
    const after = recost(clubs);
    moveGame(j, bi); moveGame(i, ai);
    clubs.forEach((t, k) => { pen.set(t, snapshot[k][0]); b2b.set(t, snapshot[k][1]); });
    return before - after;
  };

  /** Commit a swap and record it as the two moves it is. */
  const applySwap = (i, j) => {
    const a = games[i], b = games[j];
    const ai = at[i], bi = at[j];
    moveGame(i, bi); moveGame(j, ai);
    recost([a.home, a.away, b.home, b.away]);
    moves.push({ id: a.id, home: a.home, away: a.away,
      from: nights[ai], to: nights[bi], swappedWith: b.id });
    moves.push({ id: b.id, home: b.home, away: b.away,
      from: nights[bi], to: nights[ai], swappedWith: a.id });
  };

  let sweeps = 0;
  // Diagnostics. A repair that stops short should be able to say where it ran
  // out of room rather than leaving the caller to guess.
  const stats = { candidates: 0, noWanted: 0, swapTried: 0, swapTaken: 0, moveTaken: 0 };
  for (let pass = 0; pass < r.maxPasses; pass++) {
    let changed = 0;
    sweeps++;
    for (let i = 0; i < games.length; i++) {
      const g = games[i];
      if (g.pinned) continue;
      const home = g.home, away = g.away;
      if (cost(home) === 0 && cost(away) === 0) continue;
      stats.candidates++;

      const fromIdx = at[i];
      const fromDay = nightDay[fromIdx];
      const fromDate = nights[fromIdx];
      const hDays = days.get(home), aDays = days.get(away);

      // Lifting the game off its current night costs the same whichever night
      // it lands on, so it is scored once per fixture rather than once per
      // candidate. The deltas are read while the night is still occupied.
      const hOut = removeDelta(hDays, fromDay, maxRun);
      const aOut = removeDelta(aDays, fromDay, maxRun);
      hDays.delete(fromDay); aDays.delete(fromDay);

      const basePenH = pen.get(home), baseB2BH = b2b.get(home);
      const basePenA = pen.get(away), baseB2BA = b2b.get(away);
      const baseline = totalOf(basePenH, baseB2BH, bandOf(home)) + totalOf(basePenA, baseB2BA, bandOf(away));
      const midPenH = basePenH + hOut.pen, midB2BH = baseB2BH + hOut.b2b;
      const midPenA = basePenA + aOut.pen, midB2BA = baseB2BA + aOut.b2b;

      let best = null;
      const wantedNights = [];   // nights that would help but are occupied or full
      const w = r.moveWindow == null ? nights.length : r.moveWindow;
      const lo = Math.max(0, fromIdx - w);
      const hi = Math.min(nights.length - 1, fromIdx + w);
      for (let j = lo; j <= hi; j++) {
        if (j === fromIdx) continue;
        const to = nights[j];
        const toDay = nightDay[j];
        const hIn = addDelta(hDays, toDay, maxRun);
        const aIn = addDelta(aDays, toDay, maxRun);
        const after = totalOf(midPenH + hIn.pen, midB2BH + hIn.b2b, bandOf(home))
                    + totalOf(midPenA + aIn.pen, midB2BA + aIn.b2b, bandOf(away));
        // A move is judged on rest AND on the weekly shape. A swap is not: it
        // leaves both nights carrying exactly what they carried, so it cannot
        // change the shape and is scored on rest alone.
        const gain = baseline - after + shapeGain(fromDate, to);
        if (gain <= 0) continue;

        const bset = busy.get(to);
        const blocked = load.get(to) >= capacity || bset.has(home) || bset.has(away);
        if (blocked) { wantedNights.push({ j, gain }); continue; }

        // Ties go to the smallest displacement, so a repaired season still
        // looks like the one that was generated.
        const shift = Math.abs(j - fromIdx);
        if (!best || gain > best.gain || (gain === best.gain && shift < best.shift)) {
          best = { kind: 'move', j, to, toDay, gain, shift, hIn, aIn };
        }
      }

      hDays.add(fromDay); aDays.add(fromDay);   // restore before considering swaps

      // A SWAP, WHERE A MOVE CANNOT GO.
      //
      // Late in a repair the useful nights are all full, and a schedule that
      // needs draining has nowhere to drain into: every single-game move is
      // blocked on capacity or on one of the two clubs already playing. Trading
      // two fixtures' dates sidesteps both, because each night keeps exactly the
      // number of games it had. Without this the search stops well short — a
      // dense season stalls with a quarter of its clubs still over the limit.
      //
      // Only nights that would actually help are considered, and only when no
      // plain move was found that beats them, so the cost stays bounded.
      if (!wantedNights.length) stats.noWanted++;
      if (wantedNights.length) {
        wantedNights.sort((x, y) => y.gain - x.gain);
        const tryTop = Math.min(wantedNights.length, SWAP_NIGHTS);
        for (let k = 0; k < tryTop; k++) {
          const { j } = wantedNights[k];
          if (best && best.gain >= wantedNights[k].gain) break;   // a move already beats it
          for (const other of onNight[j]) {
            const h = games[other];
            if (h.pinned) continue;
            stats.swapTried++;
            const gain = swapGain(i, other);
            if (gain <= 0) continue;
            const shift = Math.abs(j - fromIdx);
            if (!best || gain > best.gain || (gain === best.gain && shift < best.shift)) {
              best = { kind: 'swap', j, other, gain, shift };
            }
          }
        }
      }

      if (!best) continue;
      if (best.kind === 'swap') { applySwap(i, best.other); stats.swapTaken++; changed++; continue; }
      moveGame(i, best.j);
      pen.set(home, midPenH + best.hIn.pen); b2b.set(home, midB2BH + best.hIn.b2b);
      pen.set(away, midPenA + best.aIn.pen); b2b.set(away, midB2BA + best.aIn.b2b);
      moves.push({ id: g.id, home, away, from: fromDate, to: best.to });
      stats.moveTaken++;
      changed++;
    }
    if (!changed) break;
  }

  const adjusted = games.map((g, i) => ({ ...g.ref, date: nights[at[i]] }));
  return {
    games: adjusted,
    moves,
    sweeps,
    stats,
    rules: { ...r, ...leagueBand },
    before: profileSummary(schedule, r, leagueBand),
    after: profileSummary(adjusted, r, leagueBand),
    integrity: checkIntegrity(games, adjusted),
    feasibility: feasibility(schedule, { ...r, ...leagueBand }),
  };
}

function emptyResult(games, r) {
  return { games: [], moves: [], rules: r, before: null, after: null,
    integrity: { ok: true, notes: ['empty schedule'] }, feasibility: { feasible: true } };
}

function profileSummary(schedule, r, band) {
  const p = teamProfiles(schedule, r);
  const rows = [...p.values()];
  return {
    teams: rows.length,
    totalBackToBacks: rows.reduce((s, x) => s + x.backToBacks, 0),
    worstRun: rows.reduce((m, x) => Math.max(m, x.longestRun), 0),
    teamsOverRunLimit: rows.filter((x) => x.longestRun > r.maxConsecutiveGames).length,
    teamsOverB2BCap: rows.filter((x) => x.backToBacks > band.max).length,
    teamsUnderB2BFloor: rows.filter((x) => x.backToBacks < band.min).length,
    teamsInBand: rows.filter((x) => x.backToBacks >= band.min && x.backToBacks <= band.max).length,
    averageBackToBacks: rows.length
      ? Math.round((rows.reduce((s2, x) => s2 + x.backToBacks, 0) / rows.length) * 10) / 10 : 0,
    lowestBackToBacks: rows.length ? Math.min(...rows.map((x) => x.backToBacks)) : 0,
    highestBackToBacks: rows.length ? Math.max(...rows.map((x) => x.backToBacks)) : 0,
    band: { min: band.min, max: band.max, target: band.target },
    maxBackToBacks: rows.reduce((m, x) => Math.max(m, x.backToBacks), 0),
    overloadSegments: rows.reduce((s, x) => s + x.overloads, 0),
  };
}

/**
 * The guarantee, checked rather than promised.
 *
 * A rebalance that changed a matchup, a host, a club's game count or the size
 * of the fixture list has done something it was not allowed to do, and that
 * has to surface as a failure rather than as a quietly different season.
 */
export function checkIntegrity(originalGames, adjusted) {
  const before = normalise(originalGames.map((g) => g.ref || g));
  const after = normalise(adjusted);
  const notes = [];
  if (before.length !== after.length) notes.push(`game count ${before.length} -> ${after.length}`);

  const key = (g) => `${g.home}|${g.away}`;
  const tally = (list) => list.reduce((m, g) => m.set(key(g), (m.get(key(g)) || 0) + 1), new Map());
  const a = tally(before), b = tally(after);
  for (const [k, n] of a) if (b.get(k) !== n) notes.push(`matchup ${k}: ${n} -> ${b.get(k) || 0}`);
  for (const k of b.keys()) if (!a.has(k)) notes.push(`matchup ${k} appeared`);

  const perTeam = (list) => {
    const m = new Map();
    for (const g of list) for (const t of [g.home, g.away]) m.set(t, (m.get(t) || 0) + 1);
    return m;
  };
  const pa = perTeam(before), pb = perTeam(after);
  for (const [t, n] of pa) if (pb.get(t) !== n) notes.push(`${t} games ${n} -> ${pb.get(t) || 0}`);

  // A night can only stage as many games as it has teams for.
  const cap = Math.max(1, Math.floor(new Set(after.flatMap((g) => [g.home, g.away])).size / 2));
  const load = new Map(), seen = new Map();
  for (const g of after) {
    load.set(g.date, (load.get(g.date) || 0) + 1);
    for (const t of [g.home, g.away]) {
      const k = `${g.date}|${t}`;
      if (seen.has(k)) notes.push(`${t} double-booked on ${g.date}`);
      seen.set(k, true);
    }
  }
  for (const [d, n] of load) if (n > cap) notes.push(`${d} stages ${n} games, capacity ${cap}`);

  return { ok: notes.length === 0, notes };
}

/* ------------------------------------------------------------------ report */

/**
 * The brief's output shape, for one club.
 *
 * The brief's own summary carries a single `team`, so this is a single-team
 * view of a league-wide repair: the whole season is rebalanced, and one club's
 * card is written up. `restDay` rows mark the nights this club was carrying a
 * game before the pass and is now free — the actual change, rather than a row
 * for every empty day of the year.
 *
 * `compliance` is a finding, not a courtesy. It reads "Within league rules"
 * only when the club is genuinely inside both limits after the pass.
 */
export function rebalanceReport(schedule, team, rules = {}) {
  const result = rebalanceSchedule(schedule, rules);
  const r = result.rules;
  const mine = (list) => normalise(list)
    .filter((g) => g.home === team || g.away === team)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const beforeGames = mine(schedule);
  const afterGames = mine(result.games);
  const beforeDates = new Set(beforeGames.map((g) => g.date));
  const afterDates = new Set(afterGames.map((g) => g.date));
  const freed = [...beforeDates].filter((d) => !afterDates.has(d)).sort();

  const b2b = (list) => runsOf(list.map((g) => g.date)).reduce((s, x) => s + (x.length - 1), 0);
  const longest = (list) => runsOf(list.map((g) => g.date)).reduce((m, x) => Math.max(m, x.length), 0);
  const originalB2B = b2b(beforeGames);
  const adjustedB2B = b2b(afterGames);
  const worstRun = longest(afterGames);

  const rows = [
    ...afterGames.map((g) => ({ date: g.date, homeTeam: g.home, awayTeam: g.away })),
    ...freed.map((d) => ({ date: d, restDay: true, team })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const withinCap = adjustedB2B <= r.maxBackToBacksPerTeam;
  const withinRun = worstRun <= r.maxConsecutiveGames;
  const compliance = withinCap && withinRun
    ? 'Within league rules'
    : [
        withinCap ? null : `${adjustedB2B} back-to-backs exceeds the cap of ${r.maxBackToBacksPerTeam}`,
        withinRun ? null : `longest run of ${worstRun} games exceeds the limit of ${r.maxConsecutiveGames}`,
        result.feasibility.feasible ? null : `the calendar cannot support the cap — ${result.feasibility.reason}`,
      ].filter(Boolean).join('; ');

  return {
    adjustedSchedule: rows,
    summary: {
      team,
      originalBackToBacks: originalB2B,
      adjustedBackToBacks: adjustedB2B,
      restDaysAdded: freed.length,
      compliance,
    },
  };
}


/* ------------------------------------------------------- back-to-back types */

/**
 * The four shapes a back-to-back can take, and what each one asks of a club.
 *
 * These are tracked because they are not equivalent. Two road games on
 * consecutive nights means a flight between them; two home games means a night
 * in your own bed. The weights say so, and they feed the difficulty figure
 * below rather than any user setting — nobody is asked to tune them, and
 * nothing about them changes a club's Overall.
 */
export const B2B_TYPES = {
  homeHome: { label: 'Home \u2192 Home', weight: 1.0 },
  homeAway: { label: 'Home \u2192 Away', weight: 1.3 },
  awayHome: { label: 'Away \u2192 Home', weight: 1.15 },
  awayAway: { label: 'Away \u2192 Away', weight: 1.5 },
};

const typeKey = (firstHome, secondHome) => (firstHome
  ? (secondHome ? 'homeHome' : 'homeAway')
  : (secondHome ? 'awayHome' : 'awayAway'));

/**
 * Every club's back-to-backs, broken down by shape, with a difficulty figure.
 *
 * Difficulty is the weighted count: a club with four away-to-away sets is
 * carrying more than a club with four at home, even though both read "4" in the
 * summary. It exists so fairness can be judged on what the back-to-backs
 * actually are rather than on how many there are.
 */
export function backToBackTypes(schedule) {
  const games = normalise(schedule);
  const byTeam = new Map();
  for (const g of games) {
    for (const [team, home] of [[g.home, true], [g.away, false]]) {
      if (!byTeam.has(team)) byTeam.set(team, []);
      byTeam.get(team).push({ day: dayNumber(g.date), date: g.date, home });
    }
  }
  const out = new Map();
  for (const [team, list] of byTeam) {
    list.sort((a, b) => a.day - b.day);
    const counts = { homeHome: 0, homeAway: 0, awayHome: 0, awayAway: 0 };
    const sets = [];
    let difficulty = 0;
    for (let i = 1; i < list.length; i++) {
      if (list[i].day - list[i - 1].day !== 1) continue;
      const key = typeKey(list[i - 1].home, list[i].home);
      counts[key]++;
      difficulty += B2B_TYPES[key].weight;
      sets.push({ type: key, first: list[i - 1].date, second: list[i].date });
    }
    out.set(team, {
      team,
      backToBacks: sets.length,
      counts,
      sets,
      difficulty: Math.round(difficulty * 100) / 100,
    });
  }
  return out;
}

/**
 * The summary a user checks a generated schedule against.
 *
 * Every figure here is counted off the finished fixture list, so it is a
 * measurement of what was built rather than a restatement of what was asked
 * for. `withinBand` is therefore a real answer: it can say no.
 */
export function backToBackReport(schedule, rules = {}) {
  const types = backToBackTypes(schedule);
  const rows = [...types.values()].sort((a, b) => a.backToBacks - b.backToBacks
    || (a.team < b.team ? -1 : 1));
  if (!rows.length) {
    return { teams: 0, average: 0, lowest: 0, highest: 0, spread: 0,
      band: null, withinBand: true, outside: [], byTeam: {}, types: null };
  }
  const counts = rows.map((r) => r.backToBacks);
  const total = counts.reduce((a, b) => a + b, 0);
  const band = rules.min != null && rules.max != null
    ? { min: rules.min, max: rules.max, target: rules.target }
    : null;
  const outside = band
    ? rows.filter((r) => r.backToBacks < band.min || r.backToBacks > band.max)
      .map((r) => ({ team: r.team, backToBacks: r.backToBacks }))
    : [];
  const totals = { homeHome: 0, homeAway: 0, awayHome: 0, awayAway: 0 };
  for (const r of rows) for (const k in totals) totals[k] += r.counts[k];
  const diffs = rows.map((r) => r.difficulty);

  return {
    teams: rows.length,
    average: Math.round((total / rows.length) * 10) / 10,
    lowest: Math.min(...counts),
    highest: Math.max(...counts),
    spread: Math.max(...counts) - Math.min(...counts),
    band,
    withinBand: !outside.length,
    outside,
    types: totals,
    // The hardest and easiest schedules by weighted difficulty, which is what
    // "is this fair" actually turns on.
    difficulty: {
      lowest: Math.round(Math.min(...diffs) * 10) / 10,
      highest: Math.round(Math.max(...diffs) * 10) / 10,
      average: Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 10) / 10,
    },
    byTeam: Object.fromEntries(rows.map((r) => [r.team, {
      backToBacks: r.backToBacks, counts: r.counts, difficulty: r.difficulty,
    }])),
  };
}
