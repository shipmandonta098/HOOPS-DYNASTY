'use strict';

/**
 * gameSim.js — playing one game out, possession by possession.
 *
 * THIS IS THE FILE EVERY OTHER SCREEN HAS BEEN WAITING FOR. Records, standings,
 * streaks, splits, last-ten, fatigue and career stats have all been sitting
 * empty with a note saying they fill in once a score is written back. This is
 * what writes it, and it produces that score by actually playing the game
 * rather than by rolling a plausible-looking number.
 *
 * WHY POSSESSION-BY-POSSESSION AND NOT A FORMULA. A final score could be drawn
 * straight from the two power ratings, and it would look fine in a table. But
 * it would have no play-by-play behind it, no box score, and no reason for the
 * numbers it produced — a 118-104 with nothing underneath it is a fabrication
 * with extra steps. Playing it out means every point on the board belongs to a
 * player who took a shot, the commentary is a record of what happened rather
 * than a story written to fit a result, and the box score adds up because it IS
 * the game.
 *
 * WHAT DECIDES ANYTHING. Only what the save holds: the 23 attributes, the
 * tendencies derived from them, and the minutes the user set on the Rotations
 * screen. Mental attributes and personality reach shot quality under pressure
 * and nothing else — they never touch Overall, which is the rule everywhere.
 *
 * DETERMINISTIC. A game is seeded from its own id, so simulating it and
 * watching it live produce the same game, and re-simulating never changes a
 * result that has already happened.
 */

import { makeRNG, hashString } from './leagueConfig.js';
import { ovr } from './playerRatings.js';
import { computeTendencies } from './playerTendencies.js';
import { gameMinutes, ON_COURT, depthOrder, reconcile } from './rotation.js';

/** Possessions per team in a regulation game, before pace adjustments. */
const BASE_PACE = 102;
/** How long an overtime period runs, as a fraction of a quarter. */
const OT_SHARE = 5 / 12;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Tendencies, flattened.
 *
 * computeTendencies returns them GROUPED — { offense: { shootThree }, ... } —
 * which is right for the screen that displays them in sections and wrong for
 * everything here. Reading the nested shape as a flat one does not throw: every
 * lookup is simply undefined, every weight becomes NaN, and NaN fails every
 * comparison, so the shot picker fell through to its last branch on every
 * possession. The result was a game with no threes, no assists, and one player
 * taking seventy-nine shots — which looked like a balance problem rather than
 * the read error it was.
 */
function flatTendencies(player) {
  const g = computeTendencies({ attributes: player.attributes, position: player.position });
  return { ...g.offense, ...g.playmaking, ...g.defense, ...g.rebounding };
}
/** A rating on 0-99 as a 0-1 quality, centred so 50 is average. */
const q = (v) => clamp((Number(v) || 50) / 100, 0.05, 0.99);

/* ------------------------------------------------------------------ setup */

/**
 * The players available to a team, with the share of the game each plays.
 *
 * Minutes come from the Rotations screen when the user has set them. When they
 * have not, the top of the depth chart plays — an untouched team should field
 * its best players rather than nobody, and a team the user HAS set is played
 * exactly as instructed, including the parts of that instruction that are bad
 * ideas.
 */
function lineup(team, roster, settings) {
  const order = depthOrder(roster);
  if (!order.length) return [];
  const { minutes } = reconcile(team && team.rotation, roster, settings);
  const cap = gameMinutes(settings);
  const total = ON_COURT * cap;

  let sum = 0;
  const rows = order.map((p) => {
    const m = clamp(Number(minutes[p.id]) || 0, 0, cap);
    sum += m;
    return { player: p, minutes: m };
  });
  if (!sum) return [];
  // Usage share is minutes share: a player on 34 of 240 is on the floor for
  // about a seventh of the game and gets about a seventh of the touches.
  for (const r of rows) r.share = r.minutes / sum;
  return rows.filter((r) => r.minutes > 0).map((r) => ({
    ...r,
    tend: flatTendencies(r.player),
    rating: ovr(r.player),
  }));
}

/** Pick a player weighted by a per-row weight. */
function pick(rng, rows, weight) {
  let total = 0;
  const w = rows.map((r) => { const v = Math.max(0, weight(r)); total += v; return v; });
  if (total <= 0) return rows[0];
  let n = rng.next() * total;
  for (let i = 0; i < rows.length; i++) { n -= w[i]; if (n <= 0) return rows[i]; }
  return rows[rows.length - 1];
}

/** A team's average defensive quality, weighted by who is on the floor. */
function defenceOf(rows) {
  if (!rows.length) return { perimeter: 0.5, interior: 0.5, steal: 0.5, block: 0.5, reb: 0.5 };
  const avg = (f) => rows.reduce((s, r) => s + f(r) * r.share, 0);
  const a = (r, k) => q(r.player.attributes && r.player.attributes[k]);
  return {
    perimeter: avg((r) => a(r, 'perimeterDefense')),
    interior: avg((r) => a(r, 'interiorDefense')),
    steal: avg((r) => a(r, 'steal')),
    block: avg((r) => a(r, 'block')),
    reb: avg((r) => a(r, 'defensiveRebound')),
  };
}

/* --------------------------------------------------------------- the game */

const SHOT = { THREE: 'three', MID: 'mid', RIM: 'rim' };

/** An empty statline, so every counted thing has a home before it happens. */
const blankLine = (p) => ({
  id: p.id, name: p.name, position: p.position,
  min: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0,
  oreb: 0, dreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0,
});

/**
 * Play one game.
 *
 * @param {object} league
 * @param {object} game    a fixture from `league.schedule.games`
 * @returns {null|object}  `{ homeScore, awayScore, plays, box, quarters, ... }`
 *   null when either side has nobody who can play, because a game between a
 *   team and an empty roster is not a game.
 */
export function simulateGame(league, game) {
  const settings = (league && league.settings) || {};
  const teamOf = (id) => (league.teams || []).find((t) => t.id === id) || null;
  const rosterOf = (id) => (league.players || []).filter((p) => p.teamId === id);

  const home = teamOf(game.home);
  const away = teamOf(game.away);
  if (!home || !away) return null;

  const sides = [
    { team: away, at: 'away', rows: lineup(away, rosterOf(away.id), settings) },
    { team: home, at: 'home', rows: lineup(home, rosterOf(home.id), settings) },
  ];
  if (sides.some((s) => !s.rows.length)) return null;

  const rng = makeRNG(hashString(`game:${game.id}:${league.meta && league.meta.rngSeed}`));
  const cap = gameMinutes(settings);
  const periods = 4;

  for (const s of sides) {
    s.def = defenceOf(s.rows);
    s.score = 0;
    s.box = new Map(s.rows.map((r) => [r.player.id, blankLine(r.player)]));
    for (const r of s.rows) s.box.get(r.player.id).min = r.minutes;
  }

  const plays = [];
  const quarters = [];
  // Home advantage as a small edge on shot quality — the same 2.5-point effect
  // the spread model assumes, expressed where it actually comes from.
  const EDGE = 0.012;

  const log = (period, clock, side, text, kind) => plays.push({
    period, clock, team: side ? side.team.id : null, side: side ? side.at : null,
    text, kind, away: sides[0].score, home: sides[1].score,
  });

  /** One possession. Returns nothing; it mutates the score and the log. */
  const possession = (off, def, period, clock) => {
    const edge = off.at === 'home' ? EDGE : 0;
    const rows = off.rows;

    // Turnover, from ball handling against pressure.
    const handler = pick(rng, rows, (r) => r.share * (0.5 + r.tend.pass / 200));
    const tovChance = clamp(0.122 + (def.def.steal - q(handler.player.attributes.ballHandling)) * 0.18, 0.05, 0.28);
    if (rng.next() < tovChance) {
      off.box.get(handler.player.id).tov++;
      const stealer = pick(rng, def.rows, (r) => r.share * (0.4 + r.tend.gambleSteals / 120));
      const stolen = rng.next() < 0.55;
      if (stolen) def.box.get(stealer.player.id).stl++;
      log(period, clock, off, stolen
        ? `${stealer.player.name} steals it from ${handler.player.name}.`
        : `${handler.player.name} turns it over.`, 'tov');
      return;
    }

    // A foul away from the shot — a reach, a hold, a loose ball. Most of a
    // team's fouls are these rather than shooting fouls, and without them a
    // box score comes out at a quarter of a real one.
    if (rng.next() < 0.105) {
      const fouler = pick(rng, def.rows, (r) => r.share * (0.5 + r.tend.perimeterPressure / 120));
      def.box.get(fouler.player.id).pf++;
      log(period, clock, def, `${fouler.player.name} is called for a foul.`, 'foul');
    }

    // Who shoots, and from where. Usage follows minutes, tilted by how much a
    // player looks for his own shot rather than giving it up.
    const shooter = pick(rng, rows, (r) => r.share * (0.55 + (100 - r.tend.pass) / 130
      + r.tend.isoCreate / 260));
    const t = shooter.tend;
    const a = shooter.player.attributes || {};
    const w = { [SHOT.THREE]: t.shootThree * 1.32, [SHOT.MID]: t.shootMidRange * 0.8,
      [SHOT.RIM]: (t.drive + t.postUp) * 0.62 };
    const totalW = w.three + w.mid + w.rim;
    let roll = rng.next() * totalW;
    const type = (roll -= w.three) <= 0 ? SHOT.THREE : (roll -= w.mid) <= 0 ? SHOT.MID : SHOT.RIM;

    const line = off.box.get(shooter.player.id);
    // Base make rates by shot type, moved by the shooter's rating for it and by
    // the defence that matters for it.
    // BASE RATES AND HOW HARD RATING PUSHES THEM, both calibrated against a
    // measured season rather than picked by feel. The first pass used a bigger
    // rating coefficient and came out at 52% from the field and 43% from three
    // — the shot picker gives most of the shots to the best shooters, so a
    // coefficient that looks reasonable per player lands far too high per
    // league. These land the season near 46% and 36%.
    const spec = {
      [SHOT.THREE]: { base: 0.330, attr: 'threePoint', d: def.def.perimeter, pts: 3 },
      [SHOT.MID]:   { base: 0.402, attr: 'midRange',   d: def.def.perimeter, pts: 2 },
      [SHOT.RIM]:   { base: 0.580, attr: 'layup',      d: def.def.interior,  pts: 2 },
    }[type];
    let p = spec.base + (q(a[spec.attr]) - 0.5) * 0.24 - (spec.d - 0.5) * 0.20 + edge;
    // Shot IQ is shot SELECTION, so it moves the quality of the look rather
    // than the ability to make it.
    p += (q(a.shotIQ) - 0.5) * 0.05;
    p = clamp(p, 0.15, 0.78);

    // A foul on the shot, more likely at the rim.
    // Shooting fouls. At the first rates a team took nine free throws a game
    // against a real twenty-two, so these are set from that measurement.
    const foulRate = type === SHOT.RIM ? 0.275 : type === SHOT.MID ? 0.085 : 0.055;
    const fouled = rng.next() < foulRate;

    // A block, only at the rim and in the mid-range.
    if (type !== SHOT.THREE && !fouled) {
      const blocker = pick(rng, def.rows, (r) => r.share * (0.3 + r.tend.paintDefense / 130));
      // Blocks came out under two a game against a real five.
      const blockChance = clamp((q(blocker.player.attributes.block) - 0.35) * 0.35, 0, 0.16);
      if (rng.next() < blockChance) {
        line.fga++; if (type === SHOT.THREE) line.tpa++;
        def.box.get(blocker.player.id).blk++;
        log(period, clock, off, `${blocker.player.name} blocks ${shooter.player.name} at the rim.`, 'blk');
        rebound(off, def, period, clock, true);
        return;
      }
    }

    const made = rng.next() < p;
    line.fga++;
    if (type === SHOT.THREE) line.tpa++;

    if (made) {
      line.fgm++;
      if (type === SHOT.THREE) line.tpm++;
      line.pts += spec.pts;
      off.score += spec.pts;
      // An assist, if somebody else created it. Catch-and-shoot threes are
      // assisted far more often than an iso pull-up.
      const assistOdds = type === SHOT.THREE ? 0.94 : type === SHOT.RIM ? 0.74 : 0.62;
      let assister = null;
      if (rows.length > 1 && rng.next() < assistOdds * (0.78 + t.catchAndShoot / 400)) {
        const others = rows.filter((r) => r.player.id !== shooter.player.id);
        assister = pick(rng, others, (r) => r.share * (0.4 + r.tend.pass / 90 + r.tend.kickOutPass / 160));
        off.box.get(assister.player.id).ast++;
      }
      const how = type === SHOT.THREE ? 'three' : type === SHOT.RIM
        ? (q(a.dunk) > 0.78 && rng.next() < 0.35 ? 'dunk' : 'layup') : 'jumper';
      log(period, clock, off, assister
        ? `${shooter.player.name} makes a ${how}, assisted by ${assister.player.name}.`
        : `${shooter.player.name} makes a ${how}.`, 'make');
      if (fouled) {
        // The and-one still costs somebody a foul. Crediting it only on a miss
        // left teams on about four fouls a game.
        def.box.get(pick(rng, def.rows, (r) => r.share).player.id).pf++;
        freeThrows(off, shooter, 1, period, clock, ' after the and-one');
      }
      return;
    }

    if (fouled) {
      line.fga--; if (type === SHOT.THREE) line.tpa--;
      const fouler = pick(rng, def.rows, (r) => r.share);
      def.box.get(fouler.player.id).pf++;
      log(period, clock, off, `${fouler.player.name} fouls ${shooter.player.name}.`, 'foul');
      freeThrows(off, shooter, type === SHOT.THREE ? 3 : 2, period, clock, '');
      return;
    }

    log(period, clock, off, `${shooter.player.name} misses a ${
      type === SHOT.THREE ? 'three' : type === SHOT.RIM ? 'layup' : 'jumper'}.`, 'miss');
    rebound(off, def, period, clock, false);
  };

  /** Free throws, which are the shooter alone against the line. */
  const freeThrows = (off, shooter, n, period, clock, suffix) => {
    const line = off.box.get(shooter.player.id);
    const p = clamp(0.62 + (q(shooter.player.attributes.freeThrow) - 0.5) * 0.85, 0.40, 0.96);
    let made = 0;
    for (let i = 0; i < n; i++) {
      line.fta++;
      if (rng.next() < p) { line.ftm++; line.pts++; off.score++; made++; }
    }
    log(period, clock, off, `${shooter.player.name} makes ${made} of ${n} at the line${suffix}.`,
      made ? 'make' : 'miss');
  };

  /** The board after a miss. */
  const rebound = (off, def, period, clock, blocked) => {
    // Offensive rebounds are the exception, so the defence is favoured heavily.
    const offReb = clamp(0.26 + (avgTend(off.rows, 'crashBoards') - 50) / 500
      - (def.def.reb - 0.5) * 0.18, 0.10, 0.42);
    const offensive = rng.next() < offReb;
    const side = offensive ? off : def;
    const r = pick(rng, side.rows, (row) => row.share
      * (0.3 + q(row.player.attributes[offensive ? 'offensiveRebound' : 'defensiveRebound'])));
    const l = side.box.get(r.player.id);
    if (offensive) l.oreb++; else l.dreb++;
    l.reb++;
    if (!blocked || offensive) {
      log(period, clock, side, `${r.player.name} pulls down the ${
        offensive ? 'offensive' : 'defensive'} rebound.`, 'reb');
    }
  };

  const avgTend = (rows, key) => rows.reduce((s, r) => s + (r.tend[key] || 50) * r.share, 0);

  /* -------------------------------------------------------- run the game */

  // Pace: a fast team and a slow one meet somewhere in between, so both sides
  // get the same number of possessions, which is what actually happens.
  const paceOf = (s) => 1 + (avgTend(s.rows, 'drive') - 50) / 600 - (avgTend(s.rows, 'postUp') - 50) / 900;
  const pace = (paceOf(sides[0]) + paceOf(sides[1])) / 2;
  const perQuarter = Math.max(4, Math.round((BASE_PACE * pace) / periods));

  const clockAt = (i, n, minutes) => {
    const left = minutes * (1 - i / n);
    const m = Math.floor(left);
    const sec = Math.floor((left - m) * 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  let possessionIdx = 0;
  for (let period = 1; period <= periods; period++) {
    const before = [sides[0].score, sides[1].score];
    for (let i = 0; i < perQuarter * 2; i++) {
      const off = sides[possessionIdx % 2];
      const def = sides[(possessionIdx + 1) % 2];
      possession(off, def, period, clockAt(i, perQuarter * 2, cap / periods));
      possessionIdx++;
    }
    quarters.push({ period, away: sides[0].score - before[0], home: sides[1].score - before[1] });
    log(period, '0:00', null, `End of ${period === 4 ? 'regulation' : `Q${period}`}: `
      + `${away.name} ${sides[0].score}, ${home.name} ${sides[1].score}.`, 'period');
  }

  // Overtime, as many as it takes. A tie is not a result basketball produces.
  let ot = 0;
  while (sides[0].score === sides[1].score && ot < 6) {
    ot++;
    const before = [sides[0].score, sides[1].score];
    const otPoss = Math.max(2, Math.round(perQuarter * OT_SHARE));
    for (let i = 0; i < otPoss * 2; i++) {
      possession(sides[possessionIdx % 2], sides[(possessionIdx + 1) % 2],
        periods + ot, clockAt(i, otPoss * 2, cap / periods * OT_SHARE));
      possessionIdx++;
    }
    quarters.push({ period: periods + ot, away: sides[0].score - before[0], home: sides[1].score - before[1], ot: true });
    log(periods + ot, '0:00', null, `End of OT${ot}: ${away.name} ${sides[0].score}, `
      + `${home.name} ${sides[1].score}.`, 'period');
  }

  const homeWon = sides[1].score > sides[0].score;
  log(periods + ot, '0:00', null,
    `Final: ${(homeWon ? home : away).name} win ${Math.max(sides[0].score, sides[1].score)}`
    + `-${Math.min(sides[0].score, sides[1].score)}.`, 'final');

  return {
    gameId: game.id,
    homeScore: sides[1].score,
    awayScore: sides[0].score,
    overtimes: ot,
    quarters,
    plays,
    box: {
      home: [...sides[1].box.values()].sort((a, b) => b.pts - a.pts),
      away: [...sides[0].box.values()].sort((a, b) => b.pts - a.pts),
    },
  };
}

/**
 * Write a played game back into the save.
 *
 * The score goes on the fixture, which is what every other screen reads. The
 * box score goes with it so a result can be looked at again rather than only
 * counted; the play-by-play does NOT, because a full season of them is
 * megabytes of text and the game can always be replayed from its seed.
 */
export function applyResult(game, result) {
  if (!game || !result) return game;
  game.played = true;
  game.homeScore = result.homeScore;
  game.awayScore = result.awayScore;
  if (result.overtimes) game.overtimes = result.overtimes;
  game.box = result.box;
  game.quarters = result.quarters;
  return game;
}

/** Every unplayed fixture up to and including a date, in order. */
export function gamesThrough(schedule, date, teamId) {
  return ((schedule && schedule.games) || [])
    .filter((g) => !g.played && g.date <= date
      && (!teamId || g.home === teamId || g.away === teamId))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
