'use strict';

/**
 * staff.js — a team's staff, what it costs, and what it actually changes.
 *
 * THE HEAD COACH ALREADY EXISTED. coaching.js generates him and owns every
 * effect he has. This does NOT re-generate or re-model him; it reads him,
 * gives him the contract he never had, and adds the six other roles around
 * him. Two coach models would disagree the first time one was corrected.
 *
 * THE HONEST PART, AND IT IS MOST OF THE POINT OF THIS FILE.
 *
 * The brief asks for five influence figures: player development, fatigue
 * recovery, injury prevention, scouting accuracy and morale. Three of those
 * systems do not exist in this game yet:
 *
 *   - NOTHING SIMULATES INJURIES. `durability` is generated and read by the
 *     player card; no code has ever produced an injury, so a trainer cannot
 *     prevent one.
 *   - THERE IS NO SCOUTING FOG. Draft classes are generated fully visible and
 *     every rating is exact, so there is no error for a scout to reduce.
 *   - NOTHING READS `player.morale`. It is generated and displayed; no system
 *     consumes it, so a boost to it would change a number with no consequence.
 *
 * Printing "+9.4%" beside any of those would be the most convincing lie this
 * screen could tell: a dashboard of effects that do not happen. So each one
 * reports `live: false`, carries the rating that WILL drive it, and names what
 * is missing. The moment the system lands, the number turns on by itself.
 *
 * The three that ARE live are live because they are wired, not asserted:
 * development and fatigue recovery multiply into seasonPipeline.js, and the
 * philosophy's tendency shift is coaching.js's, already applied every game.
 *
 * WHAT STAFF CANNOT TOUCH. The same wall as everywhere else: no attribute, no
 * rating, no potential, no Overall. Development changes the RATE a player
 * moves at, never where he starts. Flat points for what lands in a game,
 * percentages for what compounds between seasons.
 */

import { makeRNG, hashString } from './leagueConfig.js';
import { makeName, makeOrigin } from './nameCultures.js';
import { PHILOSOPHIES, coachOf, makeCoach, coachRecoveryFactor,
  coachSummary } from './coaching.js';
import { TENDENCY_GROUPS, computeTendencies } from './playerTendencies.js';

const round1 = (n) => Math.round(n * 10) / 10;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const fmtPct = (n) => `${n > 0 ? '+' : ''}${round1(n)}%`;

/* ============================================================ the roles */

/**
 * The seven roles, in the order the page lists them.
 *
 * `icon` is the role's own mark. Specialty icons are separate, because the
 * brief ties those to what an assistant does rather than to his job title.
 */
export const ROLES = [
  { key: 'headCoach', label: 'Head Coach', icon: '🎯', single: true },
  { key: 'assistantCoaches', label: 'Assistant Coach', icon: '📋', single: false },
  { key: 'trainer', label: 'Trainer', icon: '💪', single: true },
  { key: 'scout', label: 'Scout', icon: '🔍', single: true },
  { key: 'gm', label: 'General Manager', icon: '🏢', single: true },
  { key: 'psychologist', label: 'Team Psychologist', icon: '🧠', single: true },
  { key: 'developmentDirector', label: 'Development Director', icon: '📈', single: true },
];

export const SPECIALTY_ICON = {
  Offense: '⚡',
  Defense: '🛡️',
  'Player Development': '📈',
  Conditioning: '💪',
  Evaluation: '🔍',
  'Cap Management': '💰',
  'Mental Performance': '🧠',
  'Growth Programme': '📈',
  System: '🎯',
};

/** The three assistant seats. One of each, so no staff is all-offence. */
const ASSISTANT_SPECIALTIES = ['Offense', 'Defense', 'Player Development'];

/**
 * A motivational style as a number, so the header's "communication +
 * motivation" average can be taken.
 *
 * Named here rather than done inline: averaging a word requires turning it
 * into a number, and doing that silently would be a fudge dressed as a stat.
 * The page prints this mapping under the figure.
 */
export const MOTIVATION_SCORE = { 'Player-Friendly': 85, Neutral: 65, 'Tough-Love': 55 };

/* ======================================================= grades & colour */

/**
 * A rating's grade band. The brief asks for green / yellow / red; the letters
 * are the same three bands named rather than only coloured, because colour
 * alone is not something every reader can use.
 */
export function grade(rating) {
  const n = Number(rating);
  if (!Number.isFinite(n)) return { letter: '—', cls: 'gr-na', colour: 'grey', label: 'Unrated' };
  if (n >= 80) return { letter: 'A', cls: 'gr-a', colour: 'green', label: 'Elite' };
  if (n >= 65) return { letter: 'B', cls: 'gr-b', colour: 'yellow', label: 'Solid' };
  return { letter: 'C', cls: 'gr-c', colour: 'red', label: 'Weak' };
}

/* ========================================================== generation */

/**
 * Staff salaries scale with the league's cap.
 *
 * A league set to a $500M cap should not be paying its head coach $6.5M — the
 * whole economy moved, and a fixed table would leave staff costing nothing.
 * Bases are quoted against the game's default $140M cap and scaled from there.
 */
const SALARY_BASE = {
  headCoach: 5.0, assistantCoaches: 1.6, trainer: 1.4,
  scout: 1.2, gm: 3.5, psychologist: 1.0, developmentDirector: 1.3,
};
const REFERENCE_CAP = 140;

function priceOf(roleKey, rating, capScale) {
  const base = SALARY_BASE[roleKey] || 1;
  const worth = 0.55 + 0.9 * (clamp(Number(rating) || 50, 0, 100) / 100);
  return Math.max(0.3, Math.round(base * capScale * worth * 10) / 10);
}

/** A 25-99 draw around a competent middle, matching coaching.js's shape. */
const around = (rng, mid, spread) => Math.max(25, Math.min(99,
  Math.round(mid + (rng.next() + rng.next() + rng.next() - 1.5) * spread)));

/**
 * Everyone on one team's staff except the head coach, who comes from
 * coaching.js. Deterministic for a league seed and team.
 *
 * @param {number|string} rngSeed  the league seed
 * @param {string} teamId
 * @param {object} opts  `{ gender, salaryCap }`
 */
export function makeSupportStaff(rngSeed, teamId, opts = {}) {
  const rng = makeRNG(hashString(`staff|${rngSeed}|${teamId}`));
  const capScale = (Number(opts.salaryCap) || REFERENCE_CAP) / REFERENCE_CAP;
  const person = () => {
    // Drawn whether or not it is used, so a settings field cannot shift the
    // ratings that follow it. Same reasoning as makeCoach.
    const coin = rng.next() < 0.7 ? 'male' : 'female';
    return makeName(rng, makeOrigin(rng, opts.gender || coin));
  };
  const years = () => rng.int(1, 4);

  const assistantCoaches = ASSISTANT_SPECIALTIES.map((specialty) => {
    const rating = around(rng, 74, 16);
    return {
      id: `asst_${teamId}_${specialty.replace(/\s+/g, '')}`,
      role: 'assistantCoaches', name: person(), specialty, rating,
      contractYears: years(), salary: priceOf('assistantCoaches', rating, capScale),
    };
  });

  const trainer = (() => {
    const conditioning = around(rng, 74, 16);
    const injuryPrevention = around(rng, 74, 16);
    return {
      id: `trn_${teamId}`, role: 'trainer', name: person(), specialty: 'Conditioning',
      conditioning, injuryPrevention,
      rating: Math.round((conditioning + injuryPrevention) / 2),
      contractYears: years(),
      salary: priceOf('trainer', (conditioning + injuryPrevention) / 2, capScale),
    };
  })();

  const scout = (() => {
    const evaluationAccuracy = around(rng, 73, 17);
    const projectionSkill = around(rng, 73, 17);
    return {
      id: `sct_${teamId}`, role: 'scout', name: person(), specialty: 'Evaluation',
      evaluationAccuracy, projectionSkill,
      rating: Math.round((evaluationAccuracy + projectionSkill) / 2),
      contractYears: years(),
      salary: priceOf('scout', (evaluationAccuracy + projectionSkill) / 2, capScale),
    };
  })();

  const gm = (() => {
    const negotiation = around(rng, 74, 16);
    const capManagement = around(rng, 74, 16);
    return {
      id: `gm_${teamId}`, role: 'gm', name: person(), specialty: 'Cap Management',
      negotiation, capManagement, vision: rng.pick(['Win-Now', 'Build', 'Balanced']),
      rating: Math.round((negotiation + capManagement) / 2),
      contractYears: years(),
      salary: priceOf('gm', (negotiation + capManagement) / 2, capScale),
    };
  })();

  // The last two are quoted in the brief as BOOSTS, not ratings — a 0-15
  // scale, not 0-100. Both are kept in their own units, because that is what
  // the influence maths consumes, and a normalized 0-100 `rating` is derived
  // alongside for the table's Rating column and its colour band. Printing 10
  // as if it were a rating of 10 would grade a good psychologist an F.
  const BOOST_MAX = 15;
  const norm = (a, b) => Math.round(((a + b) / 2 / BOOST_MAX) * 100);

  const psychologist = (() => {
    const resilienceBoost = rng.int(3, BOOST_MAX);
    const confidenceBoost = rng.int(3, BOOST_MAX);
    const rating = norm(resilienceBoost, confidenceBoost);
    return {
      id: `psy_${teamId}`, role: 'psychologist', name: person(),
      specialty: 'Mental Performance', resilienceBoost, confidenceBoost, rating,
      boostScale: BOOST_MAX,
      contractYears: years(), salary: priceOf('psychologist', rating, capScale),
    };
  })();

  const developmentDirector = (() => {
    const growthFocus = rng.int(3, BOOST_MAX);
    const roleAdaptation = rng.int(3, BOOST_MAX);
    const rating = norm(growthFocus, roleAdaptation);
    return {
      id: `dev_${teamId}`, role: 'developmentDirector', name: person(),
      specialty: 'Growth Programme', growthFocus, roleAdaptation, rating,
      boostScale: BOOST_MAX,
      contractYears: years(), salary: priceOf('developmentDirector', rating, capScale),
    };
  })();

  return { teamId, assistantCoaches, trainer, scout, gm, psychologist, developmentDirector };
}

/**
 * Every team has a head coach and a full support staff. Leaves alone anything
 * already stored, so a save keeps its people across loads.
 */
export function ensureStaff(league) {
  if (!league || !Array.isArray(league.teams)) return { coaches: 0, staff: 0 };
  const seed = (league.meta && league.meta.rngSeed) || 1;
  const gender = league.settings && league.settings.playerGender;
  const cap = (league.settings && league.settings.salaryCap) || REFERENCE_CAP;

  league.coaches = league.coaches || [];
  league.staff = league.staff || [];
  const haveCoach = new Set(league.coaches.map((c) => c.teamId));
  const haveStaff = new Set(league.staff.map((s) => s.teamId));
  let coaches = 0, staff = 0;

  for (const t of league.teams) {
    if (!haveCoach.has(t.id)) { league.coaches.push(makeCoach(seed, t.id, gender)); coaches++; }
    if (!haveStaff.has(t.id)) {
      league.staff.push(makeSupportStaff(seed, t.id, { gender, salaryCap: cap }));
      staff++;
    }
  }
  // A head coach carries no contract of his own in coaching.js — that module
  // models what he DOES, not what he costs. The deal is added here, from its
  // own stream, so adding it cannot disturb his traits.
  for (const c of league.coaches) {
    if (c.contractYears != null) continue;
    const rng = makeRNG(hashString(`coachdeal|${seed}|${c.teamId}`));
    c.contractYears = rng.int(1, 4);
    c.salary = priceOf('headCoach', coachRating(c), cap / REFERENCE_CAP);
  }
  return { coaches, staff };
}

/** A head coach's single 0-100 number, derived from his three rated traits. */
export function coachRating(coach) {
  const t = (coach && coach.coachTraits) || {};
  const vals = ['adaptability', 'discipline', 'communication']
    .map((k) => Number(t[k])).filter(Number.isFinite);
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}

/** One team's support staff, or null. */
export function staffOf(league, teamId) {
  return ((league && league.staff) || []).find((s) => s.teamId === teamId) || null;
}

/* ================================================== the live influences */

/**
 * How much faster this staff moves a player year on year.
 *
 * A PERCENTAGE, because development is season-to-season — the other half of
 * the project's flat-points-in-game rule. Returned as a multiplier so it
 * composes with coaching.js's developmentFactor rather than replacing it.
 *
 * Both contributors are measured against 70, the competent middle the staff
 * generator draws around, so an average staff returns exactly 1.0 and only a
 * genuinely good or bad one moves the number.
 */
export function staffDevelopmentFactor(staff) {
  const applied = [];
  let pct = 0;
  const asst = ((staff && staff.assistantCoaches) || [])
    .find((a) => a.specialty === 'Player Development');
  if (asst && Number.isFinite(Number(asst.rating))) {
    const d = round1((asst.rating - 70) * 0.25);
    if (d) { pct += d; applied.push(`${asst.name} (development assistant, ${fmtPct(d)})`); }
  }
  const dir = staff && staff.developmentDirector;
  if (dir && Number.isFinite(Number(dir.growthFocus))) {
    const d = round1(dir.growthFocus * 0.6);
    if (d) { pct += d; applied.push(`${dir.name} (growth focus ${dir.growthFocus}, ${fmtPct(d)})`); }
  }
  pct = round1(pct);
  return { factor: Math.round((1 + pct / 100) * 1000) / 1000, percent: pct, applied };
}

/**
 * How much more a rest day gives back under this trainer.
 *
 * Multiplies with coaching.js's coachRecoveryFactor, which is the head
 * coach's half of the same number.
 */
export function staffRecoveryFactor(staff) {
  const t = staff && staff.trainer;
  if (!t || !Number.isFinite(Number(t.conditioning))) {
    return { factor: 1, percent: 0, applied: [] };
  }
  const pct = round1((t.conditioning - 70) * 0.30);
  return {
    factor: Math.round((1 + pct / 100) * 1000) / 1000,
    percent: pct,
    applied: pct ? [`${t.name} (conditioning ${t.conditioning}, ${fmtPct(pct)})`] : [],
  };
}

/* ============================================== roster / system fit */

const TEND_KEYS = TENDENCY_GROUPS.flatMap((g) => g.parts.map(([k]) => k));

/** Flat tendency means for a set of players. */
function tendencyMeans(players) {
  const sums = {}; let n = 0;
  for (const p of players) {
    if (!p || !p.attributes) continue;
    const grouped = computeTendencies(p, { position: p.position, archetype: p.archetype });
    for (const g of TENDENCY_GROUPS) {
      for (const [k] of g.parts) sums[k] = (sums[k] || 0) + (grouped[g.key][k] || 0);
    }
    n++;
  }
  if (!n) return null;
  const out = {};
  for (const k of TEND_KEYS) out[k] = sums[k] / n;
  return out;
}

/**
 * How well a roster already plays the way its head coach wants.
 *
 * MEASURED, not asserted. For every tendency the philosophy pushes, this asks
 * how far this roster sits from the LEAGUE in the direction the system wants,
 * in standard deviations, and scores that. A league-average roster scores 50
 * on that key — it neither suits the system nor fights it — and the whole
 * figure is the weighted mean, weighted by how hard the philosophy pushes.
 *
 * The league is the yardstick because "shoots a lot of threes" only means
 * anything relative to everyone else. Against an absolute threshold, a league
 * of poor shooters would report thirty badly-fitting rosters.
 */
export function compatibility(league, teamId) {
  const coach = coachOf(league, teamId);
  const philosophy = coach && coach.coachTraits && coach.coachTraits.philosophy;
  const table = PHILOSOPHIES[philosophy];
  const roster = (league.players || []).filter((p) => p.teamId === teamId);
  if (!table || !roster.length) {
    return { philosophy: philosophy || null, match: null, keys: [],
      note: !table ? 'This team has no head coach, so there is no system to match against.'
        : 'No players on this roster.' };
  }

  const rosterMean = tendencyMeans(roster);
  const leagueMean = tendencyMeans(league.players || []);
  if (!rosterMean || !leagueMean) {
    return { philosophy, match: null, keys: [], note: 'Not enough players to measure against.' };
  }

  // Spread across TEAM means, not across players: the question is whether this
  // roster is unusual among rosters, and player-level spread is much wider.
  const teamMeans = [...new Set((league.players || []).map((p) => p.teamId).filter(Boolean))]
    .map((id) => tendencyMeans((league.players || []).filter((p) => p.teamId === id)))
    .filter(Boolean);

  const sd = {};
  for (const k of TEND_KEYS) {
    const vals = teamMeans.map((m) => m[k]);
    const mu = vals.reduce((a, b) => a + b, 0) / vals.length;
    const varr = vals.reduce((s, v) => s + (v - mu) ** 2, 0) / Math.max(1, vals.length - 1);
    sd[k] = Math.sqrt(varr);
  }

  const keys = [];
  let num = 0, den = 0;
  for (const [k, points] of Object.entries(table)) {
    const spread = sd[k];
    const dir = Math.sign(points);
    // A tendency every team shares cannot distinguish a roster, so it scores
    // neutral rather than dividing by something near zero.
    const z = spread > 0.5 ? (rosterMean[k] - leagueMean[k]) / spread : 0;
    const score = clamp(50 + dir * z * 20, 0, 100);
    const w = Math.abs(points);
    num += score * w; den += w;
    keys.push({
      key: k, wants: points > 0 ? 'more' : 'less', points,
      team: round1(rosterMean[k]), league: round1(leagueMean[k]),
      z: Math.round(z * 100) / 100, score: round1(score),
    });
  }
  const match = den ? round1(num / den) : null;
  keys.sort((a, b) => b.score - a.score);
  return {
    philosophy, match, keys,
    summary: match == null ? null
      : `Roster matches ${match}% with the ${philosophy} system.`,
    note: null,
  };
}

/* ============================================ the five (six) influences */

/**
 * What this staff changes, and — for the systems this game has not built —
 * what it WILL change, with the missing piece named.
 *
 * Every row carries `live`. A false one has no percentage at all, because a
 * percentage nobody applies is a decoration pretending to be a mechanic.
 */
export function influenceBreakdown(league, teamId) {
  const coach = coachOf(league, teamId);
  const staff = staffOf(league, teamId);
  const t = (coach && coach.coachTraits) || {};

  const dev = staffDevelopmentFactor(staff);
  const rec = staffRecoveryFactor(staff);
  const coachRec = coachRecoveryFactor(coach);
  const coachRecPct = round1((coachRec.factor - 1) * 100);
  // MULTIPLIED, not added, because that is what seasonPipeline.js does with
  // these two factors. Adding -10% and -1.5% gives -11.5%; multiplying gives
  // -11.4%, and the page has to say the number the simulation actually uses.
  const recPct = round1((rec.factor * coachRec.factor - 1) * 100);

  // The head coach's development style is age-conditional, so it is reported as
  // the rule it is rather than as a single number that would be wrong for most
  // of the roster.
  const devStyleNote = t.developmentStyle === 'Growth'
    ? 'Growth coach: +10% again for players under 25.'
    : t.developmentStyle === 'Veteran Trust'
      ? 'Veteran-trust coach: 10% LESS movement for players over 30, which is what stability means.'
      : null;

  const asst = ((staff && staff.assistantCoaches) || []);
  const off = asst.find((a) => a.specialty === 'Offense');
  const def = asst.find((a) => a.specialty === 'Defense');

  return {
    playerDevelopment: {
      system: 'Player Development', live: true, percent: dev.percent,
      display: fmtPct(dev.percent),
      detail: dev.applied,
      // The staff's share only. The head coach's share is a RULE, not a
      // number: it depends on each player's age, so folding it into one
      // figure would be wrong for most of the roster.
      note: devStyleNote,
      appliedIn: 'seasonPipeline.js — scales the offseason tendency drift each player takes.',
    },
    fatigueRecovery: {
      system: 'Fatigue Recovery', live: true,
      percent: recPct,
      display: fmtPct(recPct),
      detail: [...rec.applied, ...coachRec.applied],
      note: coachRecPct && rec.percent
        ? `Trainer ${fmtPct(rec.percent)} and coach ${fmtPct(coachRecPct)} compound `
          + `rather than add, so the pair comes to ${fmtPct(recPct)}.`
        : null,
      appliedIn: 'seasonPipeline.js — scales what every rest day gives back.',
    },
    teamTendencies: {
      system: 'Team Tendencies', live: true, percent: null,
      display: t.philosophy ? `${t.philosophy} shift` : '—',
      // FLAT POINTS, not a percentage: this lands inside a game, and that is
      // the project's rule for in-game modifiers.
      detail: t.philosophy
        ? Object.entries(PHILOSOPHIES[t.philosophy] || {})
          .map(([k, v]) => `${label(k)} ${v > 0 ? '+' : ''}${v}`)
        : [],
      note: 'Flat points, scaled per player by how coachable he is.'
        + (off || def ? ` ${[off && `${off.name} runs the offense`,
          def && `${def.name} runs the defense`].filter(Boolean).join('; ')}.` : ''),
      appliedIn: 'coaching.js — applied to every player, every game.',
    },
    injuryPrevention: {
      system: 'Injury Prevention', live: false, percent: null, display: 'Not simulated',
      detail: staff && staff.trainer
        ? [`${staff.trainer.name} carries injury prevention ${staff.trainer.injuryPrevention}, ready for it.`]
        : [],
      note: 'Nothing in this game generates an injury yet, so there is nothing '
        + 'to prevent. The rating is stored and this turns on by itself the day '
        + 'injuries are simulated.',
      appliedIn: null,
    },
    scoutingAccuracy: {
      system: 'Scouting Accuracy', live: false, percent: null, display: 'Not simulated',
      detail: staff && staff.scout
        ? [`${staff.scout.name}: evaluation ${staff.scout.evaluationAccuracy}, `
          + `projection ${staff.scout.projectionSkill}.`]
        : [],
      note: 'Draft classes are generated fully visible — every rating is exact, '
        + 'so there is no error for a scout to reduce. Needs scouting fog first.',
      appliedIn: null,
    },
    morale: {
      system: 'Morale', live: false, percent: null, display: 'Not simulated',
      detail: staff && staff.psychologist
        ? [`${staff.psychologist.name}: resilience +${staff.psychologist.resilienceBoost}, `
          + `confidence +${staff.psychologist.confidenceBoost}.`]
        : [],
      note: 'Players carry a morale rating and the card shows it, but no system '
        + 'reads it, so a boost would move a number with no consequence.',
      appliedIn: null,
    },
  };
}

const LABELS = (() => {
  const m = {};
  for (const g of TENDENCY_GROUPS) for (const [k, l] of g.parts) m[k] = l;
  return m;
})();
const label = (k) => LABELS[k] || k;

/* ================================================== the page contract */

/** One row of the staff table. */
function row(member, roleLabel, roleIcon, influence) {
  const g = grade(member.rating);
  return {
    role: roleLabel,
    roleIcon,
    name: member.name,
    specialty: member.specialty || null,
    specialtyIcon: SPECIALTY_ICON[member.specialty] || null,
    rating: member.rating,
    grade: g.letter,
    colour: g.colour,
    contract: `${member.contractYears} yr${member.contractYears === 1 ? '' : 's'}`,
    contractYears: member.contractYears,
    expiring: member.contractYears === 1,
    salary: member.salary,
    influence,
  };
}

/**
 * The whole Staff page as data.
 *
 * @param {object} league  a migrated save
 * @param {string} teamId
 * @returns {{ staffPage: object }} the brief's contract
 */
export function staffPage(league, teamId) {
  const team = (league.teams || []).find((t) => t.id === teamId) || null;
  const coach = coachOf(league, teamId);
  const staff = staffOf(league, teamId);
  const t = (coach && coach.coachTraits) || {};
  const infl = influenceBreakdown(league, teamId);
  const fit = compatibility(league, teamId);

  const rows = [];
  if (coach) {
    const cr = coachRating(coach);
    rows.push(row(
      { name: coach.name, specialty: 'System', rating: cr,
        contractYears: coach.contractYears, salary: coach.salary },
      'Head Coach', '🎯',
      t.philosophy
        ? `Shifts team tendencies toward ${t.philosophy}: `
          + Object.entries(PHILOSOPHIES[t.philosophy] || {})
            .map(([k, v]) => `${label(k).toLowerCase()} ${v > 0 ? '+' : ''}${v}`).join(', ')
          + '.'
        : 'No philosophy on record.'));
  }
  for (const a of (staff && staff.assistantCoaches) || []) {
    rows.push(row(a, 'Assistant Coach', '📋',
      a.specialty === 'Player Development'
        ? `${a.rating >= 70 ? 'Speeds' : 'Slows'} player development by `
          + `${fmtPct(Math.abs(round1((a.rating - 70) * 0.25)))}.`
        : `Runs the ${a.specialty.toLowerCase()}. Rated ${a.rating}; there is no separate `
          + 'offense/defense coaching channel yet, so this rating is not applied.'));
  }
  if (staff && staff.trainer) {
    const r = staffRecoveryFactor(staff);
    // "Improves ... by -1.5%" is not English. A below-average trainer makes
    // recovery worse, and the sentence has to be able to say so.
    const verb = r.percent > 0 ? 'Improves fatigue recovery by'
      : r.percent < 0 ? 'Slows fatigue recovery by' : 'Leaves fatigue recovery unchanged';
    rows.push(row(staff.trainer, 'Trainer', '💪',
      `${verb}${r.percent ? ` ${fmtPct(Math.abs(r.percent))}` : ''}. `
      + `Injury prevention ${staff.trainer.injuryPrevention} is stored — injuries are not simulated yet.`));
  }
  if (staff && staff.scout) {
    rows.push(row(staff.scout, 'Scout', '🔍',
      `Evaluation ${staff.scout.evaluationAccuracy}, projection ${staff.scout.projectionSkill}. `
      + 'Draft ratings are already exact, so there is no error to improve on yet.'));
  }
  if (staff && staff.gm) {
    rows.push(row(staff.gm, 'General Manager', '🏢',
      `${staff.gm.vision} vision. Negotiation ${staff.gm.negotiation}, `
      + `cap management ${staff.gm.capManagement}. Trades and free agency are not built yet.`));
  }
  if (staff && staff.psychologist) {
    const p = staff.psychologist;
    rows.push(row(p, 'Team Psychologist', '🧠',
      `Resilience +${p.resilienceBoost}, confidence +${p.confidenceBoost} on a `
      + `${p.boostScale}-point scale. Nothing reads player morale yet.`));
  }
  if (staff && staff.developmentDirector) {
    const d = staff.developmentDirector;
    rows.push(row(d, 'Development Director', '📈',
      `Growth focus ${d.growthFocus} adds ${fmtPct(round1(d.growthFocus * 0.6))} to `
      + `development — the growth programme only ever helps. `
      + `Role adaptation ${d.roleAdaptation} is stored; role change is `
      + 'handled by the evolution rules, which do not read it yet.'));
  }

  const totalSalary = round1(rows.reduce((s, r) => s + (Number(r.salary) || 0), 0));

  // "Average of communication + motivation", with motivation scored by the
  // table above because it is stored as a word.
  const comm = Number(t.communication);
  const motiv = MOTIVATION_SCORE[t.motivationalStyle];
  const moraleParts = [comm, motiv].filter(Number.isFinite);
  const staffMorale = moraleParts.length
    ? round1(moraleParts.reduce((a, b) => a + b, 0) / moraleParts.length) : null;

  return {
    staffPage: {
      header: {
        team: team ? `${team.city} ${team.name}` : teamId,
        teamId,
        season: (league.meta && league.meta.currentSeason) || null,
        totalSalary,
        salaryUnit: '$M',
        staffCount: rows.length,
        staffMorale,
        staffMoraleBasis: Number.isFinite(comm) && motiv != null
          ? `Communication ${comm} and ${t.motivationalStyle} motivation, scored ${motiv}.`
          : 'Not enough of the head coach\'s profile to score.',
        coachSummary: coachSummary(coach),
      },
      staffTable: rows,
      influenceBreakdown: infl,
      compatibilityPanel: fit,
      controls: {
        // The brief asks these be DISPLAYED. Hiring and firing need a staff
        // market, a budget and a replacement pool, none of which exist — so
        // the buttons say so instead of failing when pressed.
        canHire: false,
        canFire: false,
        unavailableReason: 'Hiring and firing need a staff market and a staff budget. '
          + 'Neither is built, so these are shown and not armed.',
        expiring: rows.filter((r) => r.expiring)
          .map((r) => ({ role: r.role, name: r.name, badge: 'Contract Year' })),
        contracts: rows.map((r) => ({
          role: r.role, name: r.name, contractYears: r.contractYears,
          salary: r.salary, expiring: r.expiring,
        })),
      },
    },
  };
}
