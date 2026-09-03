'use strict';

/**
 * playerPersonality.js — layer three: "what kind of person is this to manage?"
 *
 * THE THREE LAYERS, AND WHY THEY ARE SEPARATE OBJECTS
 *   player.attributes  ability      -> feeds overall
 *   player.mental      temperament  -> does NOT feed overall
 *   player.personality character     -> does NOT feed overall
 *
 * The separation is structural, not a convention anyone has to remember.
 * computeOverall() iterates the ability categories over `attributes` alone, so
 * neither of the other two is reachable from it. A difficult 91-overall star is
 * still a 91; a beloved 68-overall professional is still a 68. What changes is
 * how much work he is to manage.
 *
 * PERSONALITY vs PRIORITIES
 * Traits are who the player IS and barely move. Priorities are what currently
 * MATTERS to him, and they are derived — from his traits, his age and his
 * career standing — rather than frozen at generation. Recompute them for a
 * different age and they shift, which is what makes them dynamic without
 * needing a season simulator to have run.
 *
 * Nothing here is graded good or bad. Ambitious is an asset on a contender and
 * a liability during a rebuild; that judgement belongs to the situation, not
 * to the trait.
 */

/* ===========================================================================
 * TRAITS
 * ---------------------------------------------------------------------------
 * `axis` marks mutually exclusive sets — a player cannot be both Reserved and
 * Outspoken. `affinity` lists traits that plausibly travel together and makes
 * them likelier once a related trait is drawn, which is what stops a roster
 * reading as random adjective soup.
 * ======================================================================== */
export const TRAITS = [
  { id: 'loyal', label: 'Loyal', axis: 'stability', w: 10,
    blurb: 'Values stability and the relationships he has built; slow to leave a good situation.',
    affinity: ['family_oriented', 'security_seeking', 'professional'] },
  { id: 'restless', label: 'Restless', axis: 'stability', w: 7,
    blurb: 'Grows willing to move on once his situation stagnates.',
    affinity: ['ambitious', 'opportunity_seeking'] },

  { id: 'team_first', label: 'Team-First', axis: 'ego', w: 11,
    blurb: 'Will give up touches, statistics or status if the team is better for it.',
    affinity: ['mentor', 'professional', 'lead_by_example'] },
  { id: 'ego_driven', label: 'Ego-Driven', axis: 'ego', w: 8,
    blurb: 'Wants status, recognition and a starring role, and notices when he does not get them.',
    affinity: ['market_conscious', 'outspoken', 'ambitious'] },

  { id: 'easygoing', label: 'Easygoing', axis: 'tolerance', w: 9,
    blurb: 'Shrugs off the small organisational irritations that bother other players.',
    affinity: ['social', 'lead_by_example'] },
  { id: 'demanding', label: 'Demanding', axis: 'tolerance', w: 8,
    blurb: 'Holds management, coaches and teammates to a high standard, and says so.',
    affinity: ['competitive', 'outspoken', 'professional'] },

  { id: 'outspoken', label: 'Outspoken', axis: 'expression', w: 8,
    blurb: 'Willing to air opinions, disagreements and dissatisfaction in public.',
    affinity: ['ego_driven', 'demanding', 'vocal_leader'] },
  { id: 'reserved', label: 'Reserved', axis: 'expression', w: 9,
    blurb: 'Keeps out of locker-room politics and media narratives.',
    affinity: ['private', 'lead_by_example', 'professional'] },
  { id: 'private', label: 'Private', axis: 'expression', w: 7,
    blurb: 'Handles personal and organisational matters well away from the cameras.',
    affinity: ['reserved', 'family_oriented'] },

  { id: 'vocal_leader', label: 'Vocal Leader', axis: 'leadership', w: 7,
    blurb: 'Organises teammates and takes a visible leadership role.',
    affinity: ['outspoken', 'competitive', 'mentor'] },
  { id: 'lead_by_example', label: 'Lead by Example', axis: 'leadership', w: 8,
    blurb: 'Leads through preparation and behaviour rather than words.',
    affinity: ['professional', 'reserved', 'team_first'] },

  { id: 'ambitious', label: 'Ambitious', w: 10,
    blurb: 'Driven by advancement, recognition and getting further than he is now.',
    affinity: ['opportunity_seeking', 'market_conscious', 'restless'] },
  { id: 'professional', label: 'Professional', w: 12,
    blurb: 'Takes preparation and his obligations to the organisation seriously.',
    affinity: ['lead_by_example', 'mentor', 'team_first'] },
  { id: 'independent', label: 'Independent', w: 7,
    blurb: 'Values his autonomy and bristles at being over-managed.',
    affinity: ['private', 'restless'] },
  { id: 'competitive', label: 'Competitive', w: 11,
    blurb: 'Needs to be somewhere that is trying to win; losing wears on him fast.',
    affinity: ['legacy_minded', 'demanding', 'vocal_leader'] },
  { id: 'mentor', label: 'Mentor', w: 8, minAge: 27,
    blurb: 'Takes younger teammates under his wing and enjoys doing it.',
    affinity: ['professional', 'team_first', 'lead_by_example'] },
  { id: 'social', label: 'Social', w: 8,
    blurb: 'Locker-room relationships and culture matter a great deal to him.',
    affinity: ['easygoing', 'vocal_leader'] },
  { id: 'family_oriented', label: 'Family-Oriented', w: 9,
    blurb: 'Weighs location, stability and family circumstances heavily in career decisions.',
    affinity: ['loyal', 'private', 'security_seeking'] },
  { id: 'market_conscious', label: 'Market-Conscious', w: 6,
    blurb: 'Values exposure, endorsements and being seen in a big market.',
    affinity: ['ambitious', 'ego_driven'] },
  { id: 'money_motivated', label: 'Money-Motivated', w: 9,
    blurb: 'Maximising the contract carries real weight in his decisions.',
    affinity: ['security_seeking', 'ambitious'] },
  { id: 'legacy_minded', label: 'Legacy-Minded', w: 7,
    blurb: 'Thinks in terms of rings, awards and how he will be remembered.',
    affinity: ['competitive', 'ambitious'] },
  { id: 'security_seeking', label: 'Security-Seeking', w: 8,
    blurb: 'Wants guaranteed money and a contract he can plan a life around.',
    affinity: ['family_oriented', 'loyal', 'money_motivated'] },
  { id: 'opportunity_seeking', label: 'Opportunity-Seeking', w: 9,
    blurb: 'Chases minutes and a real role over almost anything else.',
    affinity: ['ambitious', 'restless'] },
];

export const TRAIT_BY_ID = Object.fromEntries(TRAITS.map((t) => [t.id, t]));

/**
 * Age tilts which traits are plausible. Tilts make a trait rare; where rare is
 * not enough — nobody is a Mentor at twenty — the trait carries a hard
 * `minAge` instead, applied in makeTraits().
 */
const AGE_TILT = [
  { id: 'mentor',              young: 0.15, old: 2.2 },
  { id: 'security_seeking',    young: 0.45, old: 1.9 },
  { id: 'family_oriented',     young: 0.5,  old: 1.7 },
  { id: 'loyal',               young: 0.7,  old: 1.5 },
  { id: 'lead_by_example',     young: 0.5,  old: 1.6 },
  { id: 'opportunity_seeking', young: 1.9,  old: 0.5 },
  { id: 'ambitious',           young: 1.5,  old: 0.6 },
  { id: 'market_conscious',    young: 1.3,  old: 0.7 },
  { id: 'restless',            young: 1.2,  old: 0.8 },
];

/* ===========================================================================
 * PRIORITIES
 * ---------------------------------------------------------------------------
 * Stored as 0-100 weights so they can be compared and interpolated; the five
 * display levels are derived from the number. A weight is an input to a
 * decision, never the decision itself.
 * ======================================================================== */
export const PRIORITIES = [
  { key: 'winning',      label: 'Winning' },
  { key: 'contention',   label: 'Championship Contention' },
  { key: 'playingTime',  label: 'Playing Time' },
  { key: 'startingRole', label: 'Starting Role' },
  { key: 'development',  label: 'Development Opportunity' },
  { key: 'money',        label: 'Money' },
  { key: 'security',     label: 'Contract Security' },
  { key: 'loyalty',      label: 'Team Loyalty' },
  { key: 'marketSize',   label: 'Market Size / Exposure' },
  { key: 'chemistry',    label: 'Team Chemistry' },
  { key: 'coaching',     label: 'Coaching Relationship' },
  { key: 'recognition',  label: 'Individual Recognition' },
  { key: 'location',     label: 'Location / Stability' },
  { key: 'legacy',       label: 'Franchise Legacy' },
];

export const PRIORITY_KEYS = PRIORITIES.map((p) => p.key);

/** 0-100 weight -> one of the five levels. */
export function priorityLevel(v) {
  if (typeof v !== 'number') return { key: 'medium', label: 'Medium' };
  if (v >= 80) return { key: 'very_high', label: 'Very High' };
  if (v >= 63) return { key: 'high', label: 'High' };
  if (v >= 42) return { key: 'medium', label: 'Medium' };
  if (v >= 25) return { key: 'low', label: 'Low' };
  return { key: 'very_low', label: 'Very Low' };
}

/**
 * What each trait pushes on. Values are added to the age-stage baseline, so a
 * trait shifts emphasis rather than dictating a whole profile.
 */
const TRAIT_PRIORITY = {
  loyal:               { loyalty: +30, location: +12, money: -8, marketSize: -8 },
  restless:            { loyalty: -25, playingTime: +10, location: -10 },
  team_first:          { recognition: -18, startingRole: -12, chemistry: +18, winning: +10 },
  ego_driven:          { recognition: +28, startingRole: +22, marketSize: +10, chemistry: -8 },
  easygoing:           { coaching: -8, chemistry: +8 },
  demanding:           { coaching: +18, winning: +12, chemistry: -6 },
  outspoken:           { recognition: +10 },
  reserved:            { marketSize: -14, recognition: -10 },
  private:             { marketSize: -22, location: +10 },
  vocal_leader:        { chemistry: +14, recognition: +8, coaching: +8 },
  lead_by_example:     { chemistry: +10, recognition: -8 },
  ambitious:           { recognition: +18, contention: +12, playingTime: +12, loyalty: -10 },
  professional:        { coaching: +12, chemistry: +8 },
  independent:         { coaching: -20, loyalty: -8 },
  competitive:         { winning: +28, contention: +22, money: -8 },
  mentor:              { chemistry: +20, playingTime: -12, coaching: +8 },
  social:              { chemistry: +26, location: +8 },
  family_oriented:     { location: +30, security: +14, marketSize: -10 },
  market_conscious:    { marketSize: +32, recognition: +14 },
  money_motivated:     { money: +32, loyalty: -10, winning: -8 },
  legacy_minded:       { legacy: +30, contention: +22, winning: +12, money: -8 },
  security_seeking:    { security: +32, money: +10, location: +10 },
  opportunity_seeking: { playingTime: +30, startingRole: +18, development: +18, winning: -12 },
};

/**
 * Baseline priorities for a career stage. This is the "dynamic" half of the
 * system: priorities are recomputed from age and standing rather than stored
 * once, so the same player wants different things at 21, 27 and 34.
 */
function baseline(age, overall) {
  const star = overall >= 80;
  if (age <= 23) {
    return { winning: 32, contention: 30, playingTime: 78, startingRole: 62, development: 82,
      money: 45, security: 50, loyalty: 35, marketSize: 45, chemistry: 45, coaching: 55,
      recognition: 50, location: 35, legacy: 25 };
  }
  if (age <= 26) {
    return { winning: 50, contention: 48, playingTime: 68, startingRole: 68, development: 55,
      money: 62, security: 58, loyalty: 45, marketSize: 50, chemistry: 50, coaching: 50,
      recognition: 60, location: 45, legacy: 38 };
  }
  if (age <= 31) {
    return star
      ? { winning: 70, contention: 72, playingTime: 55, startingRole: 68, development: 25,
          money: 62, security: 55, loyalty: 48, marketSize: 55, chemistry: 52, coaching: 50,
          recognition: 66, location: 48, legacy: 66 }
      : { winning: 58, contention: 52, playingTime: 60, startingRole: 60, development: 30,
          money: 68, security: 64, loyalty: 50, marketSize: 48, chemistry: 52, coaching: 50,
          recognition: 55, location: 52, legacy: 42 };
  }
  return { winning: 68, contention: 62, playingTime: 40, startingRole: 38, development: 15,
    money: 52, security: 70, loyalty: 58, marketSize: 35, chemistry: 62, coaching: 52,
    recognition: 42, location: 66, legacy: 55 };
}

const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

/**
 * Priorities for a player as he is right now. Pure — call it again after a
 * birthday or a leap in ability and the answer changes, which is how
 * priorities evolve without anything having to store a history.
 *
 * @param {string[]} traits
 * @param {object} o { age, overall, rng } — rng optional, adds personal noise
 */
export function derivePriorities(traits, { age = 26, overall = 70, rng = null } = {}) {
  const out = { ...baseline(age, overall) };
  for (const id of traits || []) {
    const effect = TRAIT_PRIORITY[id];
    if (!effect) continue;
    for (const [k, v] of Object.entries(effect)) out[k] = (out[k] || 50) + v;
  }
  for (const k of PRIORITY_KEYS) {
    out[k] = clamp((out[k] ?? 50) + (rng ? rng.gauss(0, 7) : 0));
  }
  return out;
}

/* ===========================================================================
 * GENERATION
 * ======================================================================== */

function pickWeighted(rng, entries) {
  const total = entries.reduce((s, e) => s + e.w, 0);
  if (total <= 0) return null;
  let r = rng.next() * total;
  for (const e of entries) { r -= e.w; if (r <= 0) return e; }
  return entries[entries.length - 1];
}

/**
 * Build a believable trait set.
 *
 * Two rules keep it coherent. Axes are exclusive, so nobody is Reserved AND
 * Outspoken. Affinities raise the odds of traits that plausibly travel with
 * what has already been drawn, so a Competitive player is likelier to also be
 * Demanding or Legacy-Minded than to be a random adjective.
 *
 * Count is 2-5, weighted toward 3: most people are a handful of things, and a
 * few are simple.
 */
export function makeTraits(rng, { age = 26 } = {}) {
  const roll = rng.next();
  const target = roll < 0.16 ? 2 : roll < 0.55 ? 3 : roll < 0.86 ? 4 : 5;

  const youngness = Math.max(0, Math.min(1, (28 - age) / 9));   // 1 young .. 0 old
  const ageMult = {};
  for (const t of AGE_TILT) ageMult[t.id] = t.young * youngness + t.old * (1 - youngness);

  const chosen = [];
  const usedAxes = new Set();

  while (chosen.length < target) {
    const pool = TRAITS
      .filter((t) => !chosen.includes(t.id))
      .filter((t) => !t.axis || !usedAxes.has(t.axis))
      .filter((t) => (t.minAge == null || age >= t.minAge)
                  && (t.maxAge == null || age <= t.maxAge))
      .map((t) => {
        let w = t.w * (ageMult[t.id] ?? 1);
        // Affinity works both ways: a trait already chosen pulls in its
        // partners, and a candidate that names a chosen trait is pulled in too.
        for (const id of chosen) {
          if ((TRAIT_BY_ID[id].affinity || []).includes(t.id)) w *= 2.6;
          if ((t.affinity || []).includes(id)) w *= 2.0;
        }
        return { ...t, w };
      });
    const pick = pickWeighted(rng, pool);
    if (!pick) break;
    chosen.push(pick.id);
    if (pick.axis) usedAxes.add(pick.axis);
  }
  return chosen;
}

/**
 * A player's whole personality layer.
 * @returns {{ traits: string[], priorities: object }}
 */
export function makePersonality(rng, { age = 26, overall = 70 } = {}) {
  const traits = makeTraits(rng, { age });
  return { traits, priorities: derivePriorities(traits, { age, overall, rng }) };
}

/* ===========================================================================
 * SATISFACTION
 * ---------------------------------------------------------------------------
 * Compares what a player wants against his actual situation. Only the parts
 * the save can actually answer are scored; the rest report as unavailable
 * rather than being filled with a plausible-looking number. Once a season
 * simulator exists, minutes, team success and coaching become answerable and
 * slot in here.
 * ======================================================================== */

/**
 * @param {object} player
 * @param {object} ctx { depthSlot, rosterSize, salaryRank, rosterCount, teamPayrollRank }
 * @returns {{ scored: Array, unavailable: string[], overall: number|null }}
 */
export function satisfaction(player, ctx = {}) {
  const pr = (player.personality && player.personality.priorities) || null;
  if (!pr) return { scored: [], unavailable: [], overall: null };

  const scored = [];

  // Role — the depth chart genuinely knows this.
  if (typeof ctx.depthSlot === 'number') {
    // 0 = starter. How well his slot matches how much he cares about starting.
    const got = ctx.depthSlot === 0 ? 100 : ctx.depthSlot === 1 ? 62 : ctx.depthSlot === 2 ? 34 : 15;
    scored.push(dimension('Role', pr.startingRole, got));
  }
  // Contract — compare how well he is paid on his own roster against how much
  // he is worth on it. Both ranks are real; neither needs a simulated season.
  if (typeof ctx.salaryRank === 'number' && typeof ctx.abilityRank === 'number'
      && ctx.rosterCount > 1) {
    const n = ctx.rosterCount - 1;
    const paid = 100 - (ctx.salaryRank / n) * 100;
    const worth = 100 - (ctx.abilityRank / n) * 100;
    scored.push(dimension('Contract', pr.money, 50 + (paid - worth) / 2));
  }

  const unavailable = ['Minutes', 'Team Success', 'Coaching', 'Management',
    'Teammates', 'Location', 'Organisational Direction']
    .filter(() => true);

  const overall = scored.length
    ? Math.round(scored.reduce((s, d) => s + d.score, 0) / scored.length)
    : null;
  return { scored, unavailable, overall };
}

/**
 * One satisfaction dimension. A player who does not care about something is
 * near-neutral on it however it goes; a player who cares deeply swings hard.
 */
function dimension(label, weight, got) {
  const care = (typeof weight === 'number' ? weight : 50) / 100;
  const gap = (Math.max(0, Math.min(100, got)) - 50);
  return { label, weight: weight ?? 50, score: clamp(50 + gap * (0.4 + care * 0.6)) };
}

/** Word for a 0-100 satisfaction score. */
export function satisfactionLabel(v) {
  if (typeof v !== 'number') return { text: '—', band: '' };
  if (v >= 78) return { text: 'Delighted', band: 'elite' };
  if (v >= 62) return { text: 'Content', band: 'good' };
  if (v >= 45) return { text: 'Neutral', band: 'solid' };
  if (v >= 30) return { text: 'Unsettled', band: 'avg' };
  return { text: 'Unhappy', band: 'poor' };
}

/** The traits that most define a player, for a one-line read. */
export function personalitySummary(personality) {
  const ids = (personality && personality.traits) || [];
  if (!ids.length) return null;
  return ids.map((id) => (TRAIT_BY_ID[id] || {}).label || id).join(' · ');
}
