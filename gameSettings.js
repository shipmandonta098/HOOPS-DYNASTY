'use strict';

/**
 * gameSettings.js — the Players & Rosters rules a league is created with.
 *
 * One definition table drives everything: the settings screen renders from it,
 * defaults come from it, validation clamps against it, and presets round-trip
 * through it. Adding a setting means adding a row here and nothing else.
 *
 * `applied` is deliberately part of the data. Some of these rules take effect
 * the moment a league is generated; others describe behaviour that belongs to
 * a season simulator that does not exist yet. The screen says which is which
 * rather than presenting a switch that quietly does nothing.
 *
 * THE SEPARATION THESE SETTINGS MUST NOT BREAK
 *   Basketball attributes -> how good he is       -> the ONLY input to overall
 *   Mental attributes     -> how he handles it    -> never touches overall
 *   Personality/priorities-> what he's like to manage -> never touches overall
 * Turning mental or personality off removes those layers from the save. It
 * does not, and cannot, change anybody's rating.
 */

import { saveData, loadData, deleteData, getAllData } from './db.js';

const PRESET_STORE = 'presets';
const PRESET_PREFIX = 'rules:';

/** Every setting, grouped exactly as the screen lays them out. */
export const GROUPS = [
  {
    id: 'roster', label: 'Roster',
    settings: [
      { key: 'minRosterSize', label: 'Minimum Roster Size', type: 'number',
        def: 10, min: 5, max: 20, applied: true,
        help: 'The fewest players a team may carry. Enforced when signing and releasing.' },
      { key: 'maxRosterSize', label: 'Maximum Roster Size', type: 'number',
        def: 15, min: 8, max: 25, applied: true,
        help: 'The most standard players a team may carry. Generated rosters fill to one below this, leaving a spot open.' },
    ],
  },
  {
    id: 'generation', label: 'Player Generation',
    settings: [
      { key: 'playerGender', label: 'Player Gender', type: 'choice',
        options: ['Male', 'Female', 'Mixed'], def: 'Male', applied: true,
        help: 'Which player pool the league draws from. Gender changes the physical distributions — height, weight, strength, vertical, explosiveness — and nothing else. It is never a talent penalty: a 90 in a women\u2019s league is a 90, an elite player in that league\u2019s own competitive context. Shooting, playmaking, IQ, defence and rebounding are generated identically.' },
      { key: 'genderSplit', label: 'Male Share (Mixed)', type: 'number',
        min: 0, max: 100, step: 5, def: 50, unit: '%', applied: true,
        dependsOn: { key: 'playerGender', value: 'Mixed' },
        help: 'In a Mixed league, the share of generated players who are male. Applied as a probability across the whole population, so individual rosters and draft classes vary around it rather than each matching it exactly.' },
      { key: 'talentLevel', label: 'Player Talent Level', type: 'choice',
        options: ['Low', 'Normal', 'High', 'Custom'], def: 'Normal', applied: true,
        help: 'Shifts the whole league up or down the rating scale. The scale itself never changes — 95+ stays generational, 70-74 stays rotation. Custom leaves the curve alone and lets Variance and Generational Frequency do the work.' },
      { key: 'talentVariance', label: 'Talent Variance', type: 'choice',
        options: ['Low', 'Normal', 'High'], def: 'Normal', applied: true,
        help: 'How far apart players are. Low bunches the league around its average; High opens up real gaps between weak, average, good and elite.' },
      { key: 'generationalFrequency', label: 'Generational Talent Frequency', type: 'choice',
        options: ['Extremely Rare', 'Rare', 'Occasional'], def: 'Extremely Rare', applied: true,
        help: 'How often a player capable of roughly 95+ appears. Even on Occasional nothing guarantees one exists — these are probabilities, not quotas, and most leagues on Extremely Rare have none at all.' },
    ],
  },
  {
    id: 'development', label: 'Development',
    settings: [
      { key: 'dynamicDevelopment', label: 'Dynamic Player Development', type: 'toggle',
        def: true, applied: false,
        help: 'Development varies player to player instead of following a fixed curve. Takes effect once seasons are simulated.' },
      { key: 'developmentVariance', label: 'Development Variance', type: 'choice',
        options: ['Low', 'Normal', 'High'], def: 'Normal', applied: true,
        help: 'How unpredictable growth is. High produces more breakouts, more stalled prospects and more late bloomers. Applied now to how far potential can sit above current ability.' },
      { key: 'ageDecline', label: 'Age-Based Decline', type: 'toggle',
        def: true, applied: false,
        help: 'Players decline with age, at different rates rather than identically. Takes effect once seasons are simulated.' },
      { key: 'potentialVisibility', label: 'Potential Visibility', type: 'choice',
        options: ['Exact', 'Range', 'Scouted'], def: 'Range', applied: true,
        help: 'How potential is shown. Exact: 84. Range: 80-87. Scouted: a star rating. Potential is a plausible ceiling, never a promise — Range and Scouted show it honestly as an estimate.' },
    ],
  },
  {
    id: 'mental', label: 'Mental & Personality',
    settings: [
      { key: 'mentalAttributes', label: 'Mental Attributes', type: 'toggle',
        def: true, applied: true,
        help: 'Resilience, Concentration, Confidence, Composure and Coachability. They govern how a player handles pressure, mistakes and coaching. They never affect Overall — switching them off removes the layer, it does not change anyone’s rating.' },
      { key: 'personalityTraits', label: 'Personality Traits', type: 'toggle',
        def: true, applied: true,
        help: 'Loyal, Ambitious, Ego-Driven, Mentor and twenty others. Personality governs off-court behaviour and how difficult a player is to manage. It never affects Overall.' },
      { key: 'dynamicPriorities', label: 'Dynamic Career Priorities', type: 'toggle',
        def: true, applied: true,
        help: 'What a player currently wants — minutes, money, a ring, stability — recomputed from their traits, age and standing, so it moves as their career does. Requires Personality Traits.' },
    ],
  },
  {
    id: 'behavior', label: 'Player Behavior',
    settings: [
      { key: 'playerMorale', label: 'Player Morale', type: 'toggle', def: true, applied: true,
        help: 'Players carry a morale rating that responds to their situation.' },
      { key: 'playerRelationships', label: 'Player Relationships', type: 'toggle', def: true, applied: false,
        help: 'Bonds with teammates, coaches and the organisation, built through what actually happens. Needs an event system; nothing populates them yet.' },
      { key: 'tradeRequests', label: 'Trade Requests', type: 'toggle', def: true, applied: false,
        help: 'A persistently unhappy player may ask to be moved. Dissatisfaction raises the probability — it never triggers a request on its own. Needs a season simulator.' },
      { key: 'canRefuseNegotiations', label: 'Players Can Refuse Negotiations', type: 'toggle',
        def: true, applied: false,
        help: 'An unhappy player may decline to extend or may test free agency. Again a probability, never automatic. Needs contract negotiation, which is not built.' },
    ],
  },
  {
    id: 'finances', label: 'Finances',
    settings: [
      { key: 'salaryCapType', label: 'Salary Cap Type', type: 'choice',
        options: ['Soft', 'Hard', 'None'], def: 'Soft', applied: true,
        help: 'Soft: teams may exceed the cap, with restrictions on what they can do while over. Hard: the cap cannot be crossed at all. None: no cap. Generated payrolls respect the choice — under Hard nobody starts over the line.' },
      { key: 'salaryCap', label: 'Salary Cap ($M)', type: 'number',
        def: 140, min: 20, max: 500, step: 1, applied: true,
        help: 'The team payroll limit. Generated rosters are priced against it, so raising it makes contracts larger across the league rather than just moving a line on a chart.' },
      { key: 'minPayroll', label: 'Minimum Payroll ($M)', type: 'number',
        def: 126, min: 0, max: 500, step: 1, applied: true,
        help: 'The least a team may spend. Generated payrolls are held at or above it, so no club starts the league below the floor.' },
      { key: 'luxuryTaxThreshold', label: 'Luxury Tax Threshold ($M)', type: 'number',
        def: 170, min: 0, max: 800, step: 1, applied: false,
        help: 'Payroll above this line is taxed. Stored now; the bill is charged once seasons are simulated and finances run.' },
      { key: 'luxuryTaxRate', label: 'Luxury Tax Rate ($ per $1 over)', type: 'number',
        def: 1.5, min: 0, max: 10, step: 0.1, applied: false,
        help: 'What each dollar above the threshold costs the owner. 1.5 means $1.50 of tax per $1 over. Needs season finances.' },
      { key: 'teamBudgets', label: 'Team Budgets', type: 'toggle', def: true, applied: true,
        help: 'Owners set a spending budget separate from the cap, so a wealthy small-market owner can outspend a frugal large-market one. Off removes budgets entirely.' },
      { key: 'tradeSalaryMatch', label: 'Trade Salary Match (%)', type: 'number',
        def: 125, min: 100, max: 300, step: 5, applied: false,
        dependsOn: { key: 'salaryCapType', value: 'Soft' },
        help: 'Soft cap only. A team already over the cap cannot take back more than this share of the salary it sends out — 125% means $10M out can bring at most $12.5M back. It stops clubs already over the cap from going much further over. Meaningless under a Hard cap (which cannot be crossed) or None (which has no line), and needs the trade system.' },
    ],
  },
  {
    id: 'contracts', label: 'Contracts',
    settings: [
      { key: 'minSalary', label: 'Minimum Salary ($M)', type: 'number',
        def: 1.2, min: 0.2, max: 10, step: 0.1, applied: true,
        help: 'The least a standard contract can pay.' },
      { key: 'maxSalary', label: 'Maximum Player Salary ($M)', type: 'number',
        def: 50, min: 10, max: 150, step: 0.5, applied: true,
        help: 'What a 99-overall player commands. Salaries scale superlinearly toward this, so the gap between 85 and 90 costs far more than 65 to 70.' },
      { key: 'minContractLength', label: 'Minimum Contract Length (years)', type: 'number',
        def: 1, min: 1, max: 8, applied: true,
        help: 'The shortest deal that can be signed. Contracts shorter than a season are not supported, so 1 is the floor. Raising it forces longer commitments across the league.' },
      { key: 'maxContractLength', label: 'Maximum Contract Length (years)', type: 'number',
        def: 5, min: 1, max: 8, applied: true,
        help: 'The longest deal that can be signed.' },
    ],
  },
  {
    id: 'rookies', label: 'Rookie Contracts',
    settings: [
      { key: 'rookieScale', label: 'Rookie Salary Scale', type: 'toggle', def: true, applied: false,
        help: 'Drafted players sign a fixed scale by pick rather than negotiating. Applies when the draft is played.' },
      { key: 'firstPickPercent', label: '#1 Pick Salary — % of Maximum', type: 'number',
        def: 25, min: 5, max: 100, applied: false,
        help: 'What the first pick earns as a share of the maximum salary. Later picks slide down from here.' },
      { key: 'scaledRounds', label: 'Rounds Paid Above Minimum', type: 'number',
        def: 1, min: 0, max: 2, applied: false,
        help: 'How many draft rounds get scale money. Picks in later rounds sign for the minimum.' },
      { key: 'round1Years', label: 'Round 1 Contract Length (years)', type: 'number',
        def: 3, min: 1, max: 5, applied: false,
        help: 'How long a first-round rookie deal runs.' },
      { key: 'round2Years', label: 'Round 2 Contract Length (years)', type: 'number',
        def: 2, min: 1, max: 5, applied: false,
        help: 'How long a second-round rookie deal runs.' },
      { key: 'refuseAfterRookie', label: 'Can Refuse After Rookie Contract', type: 'toggle',
        def: true, applied: false,
        help: 'A player finishing a rookie deal may decline to re-sign. Needs contract negotiation.' },
    ],
  },
];

/**
 * Is a setting relevant given the rest? Trade Salary Match only means anything
 * under a soft cap: a hard cap cannot be crossed, and None has no line to be
 * over. The screen disables an irrelevant setting and says why rather than
 * hiding it, so the reason is visible.
 */
export function isRelevant(setting, settings) {
  const dep = setting.dependsOn;
  if (!dep) return true;
  return settings[dep.key] === dep.value;
}

/** Flat lookup for validation. */
export const ALL_SETTINGS = GROUPS.flatMap((g) => g.settings);
const BY_KEY = Object.fromEntries(ALL_SETTINGS.map((s) => [s.key, s]));

/** A fresh set of defaults. */
export function defaults() {
  return Object.fromEntries(ALL_SETTINGS.map((s) => [s.key, s.def]));
}

/**
 * Coerce anything into a valid settings object: unknown keys dropped, numbers
 * clamped, choices checked, missing keys defaulted. Everything that reads
 * settings goes through this, so a hand-edited or older preset cannot put the
 * generator into an impossible state.
 */
export function normalize(raw) {
  const out = defaults();
  for (const [k, v] of Object.entries(raw || {})) {
    const def = BY_KEY[k];
    if (!def) continue;
    if (def.type === 'toggle') out[k] = Boolean(v);
    else if (def.type === 'choice') out[k] = def.options.includes(v) ? v : def.def;
    else if (def.type === 'number') {
      const n = Number(v);
      out[k] = Number.isFinite(n) ? Math.max(def.min, Math.min(def.max, n)) : def.def;
    }
  }
  // Cross-setting rules that a per-field clamp cannot express.
  if (out.minRosterSize > out.maxRosterSize) out.minRosterSize = out.maxRosterSize;
  if (out.minSalary > out.maxSalary) out.minSalary = Math.min(out.minSalary, out.maxSalary);
  if (out.minContractLength > out.maxContractLength) out.minContractLength = out.maxContractLength;
  // A floor above the cap, or a tax line below it, would be incoherent.
  if (out.minPayroll > out.salaryCap) out.minPayroll = out.salaryCap;
  if (out.luxuryTaxThreshold < out.salaryCap) out.luxuryTaxThreshold = out.salaryCap;
  // Priorities are derived from traits, so they cannot outlive them.
  if (!out.personalityTraits) out.dynamicPriorities = false;
  return out;
}

/* --------------------------- working copy (localStorage) ------------------ */
const KEY = 'hd.gameSettings';

export function loadSettings() {
  try { return normalize(JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch (_) { return defaults(); }
}

export function saveSettings(settings) {
  try { localStorage.setItem(KEY, JSON.stringify(normalize(settings))); return true; }
  catch (err) { console.warn('Could not store settings:', err); return false; }
}

/* ------------------------------- presets --------------------------------- */
/* Stored in the same IndexedDB store as League Presets but under a distinct
   id prefix, so rules presets and league presets never collide. */

export async function listRulePresets() {
  const rows = await getAllData(PRESET_STORE);
  return rows
    .filter((r) => String(r.key).startsWith(PRESET_PREFIX))
    .map((r) => ({ id: r.key, name: r.value.name, savedAt: r.value.savedAt }))
    .sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
}

export async function saveRulePreset(name, settings, existingId) {
  const id = existingId || PRESET_PREFIX + Date.now().toString(36);
  await saveData(PRESET_STORE, id, {
    name: String(name || 'Untitled rules').slice(0, 48),
    settings: normalize(settings),
    savedAt: new Date().toISOString(),
  });
  return id;
}

export async function getRulePreset(id) {
  const row = await loadData(PRESET_STORE, id);
  return row ? { ...row, settings: normalize(row.settings) } : null;
}

export async function deleteRulePreset(id) { await deleteData(PRESET_STORE, id); }

/* ------------------------ turning settings into numbers ------------------- */

/**
 * How the generation settings translate into the talent curve. Kept here so
 * the settings screen and the generator agree by construction.
 */
export function generationTuning(settings) {
  const s = normalize(settings);
  const level = { Low: -3.2, Normal: 0, High: +3.2, Custom: 0 }[s.talentLevel] ?? 0;
  const variance = { Low: 0.72, Normal: 1, High: 1.38 }[s.talentVariance] ?? 1;
  const generational = { 'Extremely Rare': 1, Rare: 3.5, Occasional: 9 }[s.generationalFrequency] ?? 1;
  const devVariance = { Low: 0.65, Normal: 1, High: 1.5 }[s.developmentVariance] ?? 1;
  return {
    meanShift: level, spreadScale: variance, generationalScale: generational, devVariance,
    // Passed straight through: the generator draws each player's gender from
    // these, and nothing about them reaches the talent curve.
    playerGender: s.playerGender, genderSplit: s.genderSplit,
  };
}

/** Format a potential for display, honouring Potential Visibility. */
export function formatPotential(potential, overall, mode) {
  if (typeof potential !== 'number') return { text: '—', title: '' };
  if (mode === 'Exact') return { text: String(potential), title: 'Exact potential' };
  if (mode === 'Scouted') {
    // Stars describe the ceiling, not the current player.
    const stars = potential >= 88 ? 5 : potential >= 80 ? 4 : potential >= 72 ? 3 : potential >= 64 ? 2 : 1;
    return {
      text: '★'.repeat(stars) + '☆'.repeat(5 - stars),
      title: `Scouted ceiling: ${stars} of 5 stars`,
    };
  }
  // Range: widen with the distance still to travel, because a ceiling far off
  // is a worse guess than one a player is nearly at.
  const gap = Math.max(0, potential - (overall || potential));
  const pad = Math.max(2, Math.round(2 + gap * 0.35));
  const lo = Math.max(overall || 0, potential - pad);
  const hi = Math.min(99, potential + pad);
  return { text: `${lo}–${hi}`, title: 'Estimated ceiling, not a guarantee' };
}
