'use strict';

/**
 * playerStats.js — the career stats table: five views over one stored season row.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE: nothing here invents a number.
 *
 * A cell shows a value only when the save actually holds what the value is made
 * of. Everything else is an em dash. That means the table is mostly empty in a
 * league nobody has simulated yet, which is correct — an empty column says "no
 * games have been played", and a filled one would be a lie dressed as a record.
 *
 * Three kinds of cell, and the line between them is the whole design:
 *
 *   STORED     read straight off the season row (FG, FGA, PTS, ...).
 *   DERIVED    arithmetic whose inputs are all stored, and which has exactly
 *              one answer: FG% is FG/FGA, 2P is FG - 3P, TRB is ORB + DRB,
 *              Per 36 is totals x 36/MP. Computing these is not inventing
 *              them — refusing to would just be hiding arithmetic.
 *   REFUSED    anything that would need a fact the save does not have. A past
 *              season's TEAM is the clearest case: the player's current club
 *              is not where he played in 2027, and filling it in from his
 *              roster spot today would silently rewrite his history the first
 *              time anyone is traded. Dash.
 *
 * AGE is derived, TEAM and POS are refused, and the difference is the point:
 * age follows with certainty from a birth date and a season year, while team
 * and position are facts about the past that only the past can supply.
 *
 * The column lists below are complete whether or not anything can fill them,
 * so the day the simulator writes a real box score the table fills in with no
 * further work.
 */

/* ===========================================================================
 * THE CANONICAL SEASON ROW
 * ---------------------------------------------------------------------------
 * What a fully populated `player.statsHistory[]` entry looks like. Counting
 * stats are SEASON TOTALS; the per-game and per-36 views divide them here
 * rather than being stored three times over.
 *
 *   season, age, teamId, teamAbbr, pos
 *   g gs mp
 *   fg fga fg3 fg3a ft fta
 *   orb drb ast stl blk tov pf pts
 *   awards: ['ROY-1', 'MVP-5']      // NAME-place; place 1 is a win
 *   per ows dws obpm dbpm vorp      // advanced, when a model produces them
 *   highs: { pts, trb, ast, ... }   // one game's best, when a game log exists
 *
 * Older saves hold only per-game points, rebounds and assists, so those three
 * appear in the Traditional view and every other cell is honestly blank.
 * ======================================================================== */

const int = (v) => (Number.isFinite(v) ? String(Math.round(v)) : null);
const dec1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : null);
const dec2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : null);
/** WS/48 prints like a percentage does — .169, -.030 — not as 0.169. */
const dec3 = (v) => (Number.isFinite(v)
  ? v.toFixed(3).replace(/^(-?)0\./, '$1.') : null);
/** Basketball percentages print as .456, and 1.000 keeps its leading digit. */
const pct = (v) => (Number.isFinite(v) ? (v >= 1 ? v.toFixed(3) : v.toFixed(3).replace(/^0/, '')) : null);
const pct1 = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}` : null);

/** Divide only when both sides are real numbers and the denominator is not 0. */
function ratio(a, b) {
  return Number.isFinite(a) && Number.isFinite(b) && b > 0 ? a / b : null;
}

/** A stored number, or null. Never coerces a missing field into 0. */
function num(row, key) {
  const v = row ? row[key] : undefined;
  return Number.isFinite(v) ? v : null;
}

/* ===========================================================================
 * COLUMNS
 * ======================================================================== */

/** Traditional, Totals, Per 36 and Game Highs all share this shape. */
const BOX_COLUMNS = [
  'season', 'age', 'team', 'pos', 'g', 'gs', 'mp',
  'fg', 'fga', 'fgPct', 'fg3', 'fg3a', 'fg3Pct', 'fg2', 'fg2a', 'fg2Pct', 'efgPct',
  'ft', 'fta', 'ftPct', 'orb', 'drb', 'trb', 'ast', 'stl', 'blk', 'tov', 'pf', 'pts',
  'awards',
];

const ADVANCED_COLUMNS = [
  'season', 'age', 'team', 'pos', 'g', 'gs', 'mp',
  'per', 'tsPct', 'fg3Ar', 'ftr',
  'orbPct', 'drbPct', 'trbPct', 'astPct', 'stlPct', 'blkPct', 'tovPct', 'usgPct',
  'ows', 'dws', 'ws', 'ws48', 'obpm', 'dbpm', 'bpm', 'vorp',
];

/** label and formatter per column id. */
export const COLUMN = {
  season: { label: 'Season', align: 'left' },
  age: { label: 'Age', fmt: int },
  team: { label: 'Team', align: 'left' },
  pos: { label: 'POS', align: 'left' },
  g: { label: 'G', fmt: int },
  gs: { label: 'GS', fmt: int },
  mp: { label: 'MP', fmt: dec1 },
  fg: { label: 'FG', fmt: dec1 },
  fga: { label: 'FGA', fmt: dec1 },
  fgPct: { label: 'FG%', fmt: pct },
  fg3: { label: '3P', fmt: dec1 },
  fg3a: { label: '3PA', fmt: dec1 },
  fg3Pct: { label: '3P%', fmt: pct },
  fg2: { label: '2P', fmt: dec1 },
  fg2a: { label: '2PA', fmt: dec1 },
  fg2Pct: { label: '2P%', fmt: pct },
  efgPct: { label: 'eFG%', fmt: pct },
  ft: { label: 'FT', fmt: dec1 },
  fta: { label: 'FTA', fmt: dec1 },
  ftPct: { label: 'FT%', fmt: pct },
  orb: { label: 'ORB', fmt: dec1 },
  drb: { label: 'DRB', fmt: dec1 },
  trb: { label: 'TRB', fmt: dec1 },
  ast: { label: 'AST', fmt: dec1 },
  stl: { label: 'STL', fmt: dec1 },
  blk: { label: 'BLK', fmt: dec1 },
  tov: { label: 'TOV', fmt: dec1 },
  pf: { label: 'PF', fmt: dec1 },
  pts: { label: 'PTS', fmt: dec1 },
  awards: { label: 'Awards', align: 'left' },

  per: { label: 'PER', fmt: dec1 },
  tsPct: { label: 'TS%', fmt: pct },
  fg3Ar: { label: '3PAr', fmt: pct },
  ftr: { label: 'FTr', fmt: pct },
  orbPct: { label: 'ORB%', fmt: pct1 },
  drbPct: { label: 'DRB%', fmt: pct1 },
  trbPct: { label: 'TRB%', fmt: pct1 },
  astPct: { label: 'AST%', fmt: pct1 },
  stlPct: { label: 'STL%', fmt: pct1 },
  blkPct: { label: 'BLK%', fmt: pct1 },
  tovPct: { label: 'TOV%', fmt: pct1 },
  usgPct: { label: 'USG%', fmt: pct1 },
  ows: { label: 'OWS', fmt: dec1 },
  dws: { label: 'DWS', fmt: dec1 },
  ws: { label: 'WS', fmt: dec1 },
  ws48: { label: 'WS/48', fmt: dec3 },
  obpm: { label: 'OBPM', fmt: dec1 },
  dbpm: { label: 'DBPM', fmt: dec1 },
  bpm: { label: 'BPM', fmt: dec1 },
  vorp: { label: 'VORP', fmt: dec1 },
};

export const VIEWS = [
  { id: 'traditional', label: 'Traditional', columns: BOX_COLUMNS },
  { id: 'totals', label: 'Totals', columns: BOX_COLUMNS },
  { id: 'per36', label: 'Per 36', columns: BOX_COLUMNS },
  { id: 'advanced', label: 'Advanced', columns: ADVANCED_COLUMNS },
  { id: 'highs', label: 'Game Highs', columns: BOX_COLUMNS },
];

/* ===========================================================================
 * READING A SEASON
 * ======================================================================== */

/** Counting stats, as season totals, straight off the row. */
const COUNTING = ['fg', 'fga', 'fg3', 'fg3a', 'ft', 'fta',
  'orb', 'drb', 'ast', 'stl', 'blk', 'tov', 'pf', 'pts', 'mp'];

/**
 * A season's age.
 *
 * Derived, because it is arithmetic with one answer: the season year minus the
 * birth year. If the row stores it, the row wins. If there is no birth date,
 * the player's current age and the current season give the same number.
 */
function ageFor(row, player, currentSeason) {
  const stored = num(row, 'age');
  if (stored != null) return stored;
  const season = num(row, 'season');
  if (season == null) return null;
  const birthYear = player && player.birthDate && Number.isFinite(player.birthDate.year)
    ? player.birthDate.year : null;
  if (birthYear != null) return season - birthYear;
  if (Number.isFinite(player && player.age) && Number.isFinite(currentSeason)) {
    return player.age - (currentSeason - season);
  }
  return null;
}

/**
 * Every value a season row can supply, as season TOTALS, before any view
 * divides them. Missing inputs stay null all the way through — no zero
 * defaults, because a zero is a claim and a null is not.
 */
function totalsOf(row) {
  const t = {};
  for (const k of COUNTING) t[k] = num(row, k);
  t.g = num(row, 'g');
  t.gs = num(row, 'gs');
  // Both halves of a made/attempted pair are needed, so a 2P that has to be
  // inferred from a missing 3P stays blank rather than becoming the FG total.
  t.fg2 = t.fg != null && t.fg3 != null ? t.fg - t.fg3 : null;
  t.fg2a = t.fga != null && t.fg3a != null ? t.fga - t.fg3a : null;
  t.trb = num(row, 'trb') != null ? num(row, 'trb')
    : (t.orb != null && t.drb != null ? t.orb + t.drb : null);
  return t;
}

/** Shooting rates. Identical in every counting view, because they are ratios. */
function rates(t) {
  return {
    fgPct: ratio(t.fg, t.fga),
    fg3Pct: ratio(t.fg3, t.fg3a),
    fg2Pct: ratio(t.fg2, t.fg2a),
    efgPct: t.fg != null && t.fg3 != null ? ratio(t.fg + 0.5 * t.fg3, t.fga) : null,
    ftPct: ratio(t.ft, t.fta),
    tsPct: t.pts != null && t.fga != null && t.fta != null
      ? ratio(t.pts, 2 * (t.fga + 0.44 * t.fta)) : null,
    fg3Ar: ratio(t.fg3a, t.fga),
    ftr: ratio(t.fta, t.fga),
  };
}

/**
 * One rendered row, as { columnId: string|null }. A null is a dash: the save
 * does not hold that fact and nothing here will conjure one.
 *
 * @param {string} view  one of VIEWS[].id
 */
export function seasonValues(view, row, player, currentSeason) {
  const t = totalsOf(row);
  const r = rates(t);
  const out = {};

  out.season = row && row.season != null ? String(row.season) : null;
  const age = ageFor(row, player, currentSeason);
  out.age = age != null ? String(Math.round(age)) : null;
  // Refused, not derived: the club and role he holds today say nothing about
  // the season this row describes.
  out.team = row && (row.teamAbbr || row.team) ? String(row.teamAbbr || row.team) : null;
  out.pos = row && row.pos ? String(row.pos) : null;
  out.g = int(t.g);
  out.gs = int(t.gs);

  if (view === 'advanced') {
    // Season total, as an integer — this view is not a per-game one.
    out.mp = int(t.mp);
    for (const k of ['per', 'ows', 'dws', 'obpm', 'dbpm', 'vorp']) {
      const v = num(row, k);
      out[k] = v != null ? COLUMN[k].fmt(v) : null;
    }
    // Win Shares and BPM are sums of their halves; both halves must be there.
    const ws = num(row, 'ows') != null && num(row, 'dws') != null
      ? num(row, 'ows') + num(row, 'dws') : num(row, 'ws');
    out.ws = ws != null ? dec1(ws) : null;
    out.ws48 = ws != null && t.mp ? dec3(ratio(ws * 48, t.mp)) : null;
    const bpm = num(row, 'obpm') != null && num(row, 'dbpm') != null
      ? num(row, 'obpm') + num(row, 'dbpm') : num(row, 'bpm');
    out.bpm = bpm != null ? dec1(bpm) : null;
    out.tsPct = pct(r.tsPct);
    out.fg3Ar = pct(r.fg3Ar);
    out.ftr = pct(r.ftr);
    // The percentage rates need the TEAM's and the OPPONENT's totals for the
    // same minutes. Nothing stores those, and a rate computed without them
    // would be a different statistic wearing this one's name.
    for (const k of ['orbPct', 'drbPct', 'trbPct', 'astPct', 'stlPct', 'blkPct',
      'tovPct', 'usgPct']) {
      const v = num(row, k);
      out[k] = v != null ? COLUMN[k].fmt(v) : null;
    }
    return out;
  }

  if (view === 'highs') {
    // A single game's best, which only a game log can supply.
    const h = (row && row.highs) || null;
    // Every high is one game's figure, so they are all whole numbers.
    out.mp = h ? int(num(h, 'mp')) : null;
    for (const k of ['fg', 'fga', 'fg3', 'fg3a', 'fg2', 'fg2a', 'ft', 'fta',
      'orb', 'drb', 'trb', 'ast', 'stl', 'blk', 'tov', 'pf', 'pts']) {
      out[k] = h ? int(num(h, k)) : null;
    }
    // A high is one game, so shooting percentages across a season do not apply.
    for (const k of ['fgPct', 'fg3Pct', 'fg2Pct', 'efgPct', 'ftPct']) out[k] = null;
    out.awards = null;
    return out;
  }

  // Traditional divides by games; Per 36 scales by minutes; Totals is as stored.
  let scale = 1;
  if (view === 'traditional') scale = t.g ? 1 / t.g : null;
  else if (view === 'per36') scale = t.mp ? 36 / t.mp : null;

  const box = (k) => {
    const v = t[k];
    if (v == null || scale == null) return null;
    return view === 'totals' ? int(v) : dec1(v * scale);
  };
  // Minutes per game is a rate; in the Per 36 view the column is by definition
  // 36, which is noise, so it stays as minutes per game there too.
  out.mp = view === 'totals' ? int(t.mp)
    : (t.mp != null && t.g ? dec1(t.mp / t.g) : null);
  for (const k of ['fg', 'fga', 'fg3', 'fg3a', 'fg2', 'fg2a', 'ft', 'fta',
    'orb', 'drb', 'trb', 'ast', 'stl', 'blk', 'tov', 'pf', 'pts']) {
    out[k] = box(k);
  }
  out.fgPct = pct(r.fgPct);
  out.fg3Pct = pct(r.fg3Pct);
  out.fg2Pct = pct(r.fg2Pct);
  out.efgPct = pct(r.efgPct);
  out.ftPct = pct(r.ftPct);

  // Saves written before a box score existed hold only per-game points,
  // rebounds and assists. They belong in the per-game view and nowhere else:
  // a total needs games played and a per-36 needs minutes, and multiplying an
  // average by a number the save does not have is exactly the invention this
  // file refuses to make.
  if (view === 'traditional') {
    if (out.pts == null && Number.isFinite(row && row.ppg)) out.pts = dec1(row.ppg);
    if (out.trb == null && Number.isFinite(row && row.rpg)) out.trb = dec1(row.rpg);
    if (out.ast == null && Number.isFinite(row && row.apg)) out.ast = dec1(row.apg);
  }

  out.awards = Array.isArray(row && row.awards) && row.awards.length ? row.awards : null;
  return out;
}

/**
 * A career row: the seasons summed.
 *
 * A column is summed only when EVERY season carries it. One missing season
 * makes the total wrong in a way nobody could see, so the cell stays blank
 * instead of quietly reporting a partial career as a whole one.
 */
export function careerValues(view, rows) {
  if (view === 'highs') {
    // The best single game of a career is the max of the seasons' maxima.
    const highs = rows.map((r) => r && r.highs).filter(Boolean);
    if (!highs.length) return null;
    const out = { season: 'Career' };
    for (const k of ['mp', 'fg', 'fga', 'fg3', 'fg3a', 'fg2', 'fg2a', 'ft', 'fta',
      'orb', 'drb', 'trb', 'ast', 'stl', 'blk', 'tov', 'pf', 'pts']) {
      const vals = highs.map((h) => num(h, k)).filter((v) => v != null);
      out[k] = vals.length === rows.length ? int(Math.max(...vals)) : null;
    }
    return out;
  }
  if (view === 'advanced') return null;   // rate stats do not sum

  const sum = {};
  for (const k of [...COUNTING, 'g', 'gs']) {
    const vals = rows.map((r) => num(r, k));
    sum[k] = vals.every((v) => v != null) && vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  }
  if (sum.g == null && sum.pts == null) return null;
  const out = seasonValues(view, { season: null, ...sum }, null, null);
  out.season = 'Career';
  out.age = null;
  out.team = null;
  out.pos = null;
  out.awards = null;
  return out;
}

/**
 * Split an award into its name and finishing place. Place 1 is a win, which
 * the table shows in bold.
 * @returns {{ text: string, won: boolean }}
 */
export function parseAward(award) {
  const s = String(award);
  const m = s.match(/-(\d+)$/);
  return { text: s, won: !!m && Number(m[1]) === 1 };
}

/** Which columns any season actually fills, so an all-blank table can say so. */
export function filledColumns(view, rows, player, currentSeason) {
  const filled = new Set();
  for (const row of rows) {
    const v = seasonValues(view, row, player, currentSeason);
    for (const [k, val] of Object.entries(v)) if (val != null) filled.add(k);
  }
  return filled;
}
