'use strict';

/**
 * playerArchetypes.js — what kind of basketball player somebody is.
 *
 * This module holds the SHAPE of a player and nothing about his level. It
 * knows that a rim protector blocks shots and cannot shoot; it does not know
 * or care whether he is a 62 or a 92. Level is applied afterwards by
 * playerGen.js, which slides the whole shape up or down onto a target overall.
 * Separating the two is the point: it is what lets a 66 and an 88 rim
 * protector be recognisably the same kind of player, and what lets two 75s at
 * the same position play nothing alike.
 *
 * Deliberately dependency-free so the browser (ES module) and the Node engine
 * (via engine/lib/archetypes.js) can both read it without a build step.
 *
 * FOUR THINGS SHAPE A PLAYER, in this order:
 *
 *   POSITION   sets the tendencies of the role   (POSITION_BASE)
 *   FRAME      sets what his body makes possible (frameMods)
 *   ARCHETYPE  sets his basketball identity      (ARCHETYPES[].p)
 *   AGE        sets how finished he is           (ageMods)
 *
 * All four produce DELTAS in rating points around a neutral player. They add
 * up to a shape; the shape is then shifted, not squashed, onto his overall.
 * That is why a weakness survives: shifting preserves every gap.
 *
 * Nothing here is a hard restriction. A 6'8" point guard, a small-ball five, a
 * centre who passes like a guard and a guard who rebounds like a four are all
 * reachable — the frame/archetype fit makes them uncommon, never impossible.
 */

/** The 23 stored attributes, grouped as the profile screen groups them. */
export const ATTRS = [
  'strength', 'speed', 'agility', 'vertical', 'stamina', 'endurance',
  'threePoint', 'midRange', 'layup', 'shotIQ', 'dunk', 'postControl', 'freeThrow',
  'passing', 'ballHandling', 'passingIQ',
  'perimeterDefense', 'interiorDefense', 'defensiveIQ', 'steal', 'block',
  'defensiveRebound', 'offensiveRebound',
];

/** Typical height in inches, by position. Frames are measured against these. */
export const POS_HEIGHT = { PG: 74.0, SG: 77.0, SF: 79.5, PF: 81.5, C: 83.5 };

/* ===========================================================================
 * POSITION BASELINES
 * ---------------------------------------------------------------------------
 * What the ROLE tends to ask for, before any archetype. These are tendencies,
 * not rules: every one of them can be overridden by an archetype, and several
 * archetypes exist specifically to override them (a playmaking big beats the
 * centre baseline's passing penalty by more than the baseline imposes it).
 * ======================================================================== */
export const POSITION_BASE = {
  PG: { speed: +6, agility: +7, ballHandling: +13, passing: +11, passingIQ: +9,
        threePoint: +3, freeThrow: +4, perimeterDefense: +3, steal: +4,
        strength: -11, dunk: -8, postControl: -19, interiorDefense: -15, block: -17,
        defensiveRebound: -15, offensiveRebound: -13 },
  SG: { speed: +4, agility: +4, threePoint: +6, midRange: +5, shotIQ: +4,
        ballHandling: +5, passing: +2, perimeterDefense: +4, steal: +2,
        strength: -6, postControl: -12, interiorDefense: -10, block: -12,
        defensiveRebound: -9, offensiveRebound: -8 },
  SF: { speed: +1, threePoint: +2, midRange: +2, layup: +2, perimeterDefense: +2,
        postControl: -4, interiorDefense: -2, block: -4,
        defensiveRebound: -1, offensiveRebound: -1 },
  PF: { strength: +7, postControl: +5, interiorDefense: +7, block: +5, dunk: +6,
        layup: +3, defensiveRebound: +9, offensiveRebound: +9,
        speed: -4, agility: -5, ballHandling: -8, passing: -5, passingIQ: -4,
        threePoint: -4, perimeterDefense: -4 },
  C:  { strength: +12, postControl: +9, interiorDefense: +13, block: +12, dunk: +9,
        layup: +5, defensiveRebound: +14, offensiveRebound: +13,
        speed: -9, agility: -11, ballHandling: -16, passing: -10, passingIQ: -8,
        threePoint: -10, midRange: -7, freeThrow: -5, perimeterDefense: -10 },
};

/* ===========================================================================
 * ARCHETYPES
 * ---------------------------------------------------------------------------
 * `p` is a per-attribute delta profile: the identity, in rating points.
 * `pos` is the per-position weight — an archetype can belong to more than one
 *   position, at different frequencies (a sharpshooter is common at the two,
 *   possible at the three, rare at the one).
 * `h` is the height band the archetype is built for. Outside it the archetype
 *   is not forbidden, only unlikely, which is where small-ball fives and
 *   oversized guards come from.
 * `sig` are the attributes that can spike ABOVE what his overall suggests —
 *   this is how a 69 overall ends up with an 88 three-ball.
 * `hole` are the attributes that can be dug out further. Every player gets one
 *   or the other or both, superstars included.
 * ======================================================================== */
export const ARCHETYPES = [
  /* ------------------------------- guards ------------------------------- */
  { id: 'floor_general', label: 'Floor General', pos: { PG: 7, SG: 1 }, h: [70, 78],
    p: { passing: +18, passingIQ: +18, ballHandling: +14, shotIQ: +6, threePoint: +2,
         midRange: +2, dunk: -16, postControl: -18, interiorDefense: -10, block: -12,
         offensiveRebound: -10, defensiveRebound: -8, strength: -8, vertical: -8 },
    sig: ['passing', 'passingIQ', 'ballHandling'],
    hole: ['dunk', 'postControl', 'block', 'vertical'] },

  { id: 'scoring_guard', label: 'Scoring Guard', pos: { PG: 5, SG: 6 }, h: [72, 79],
    p: { midRange: +14, threePoint: +12, layup: +10, shotIQ: +8, freeThrow: +8,
         ballHandling: +8, passing: -6, passingIQ: -4, perimeterDefense: -8,
         defensiveIQ: -6, postControl: -10, defensiveRebound: -10,
         offensiveRebound: -10, block: -12 },
    sig: ['midRange', 'threePoint', 'layup'],
    hole: ['perimeterDefense', 'defensiveIQ', 'passing'] },

  { id: 'sharpshooter', label: 'Sharpshooter', pos: { PG: 2, SG: 6, SF: 3 }, h: [72, 80],
    p: { threePoint: +22, freeThrow: +16, midRange: +14, shotIQ: +12, layup: -4,
         dunk: -16, postControl: -16, ballHandling: -4, passing: -4,
         perimeterDefense: -8, interiorDefense: -10, block: -12, strength: -8,
         offensiveRebound: -10, defensiveRebound: -8, speed: -4, vertical: -8 },
    sig: ['threePoint', 'freeThrow', 'midRange'],
    hole: ['dunk', 'postControl', 'interiorDefense', 'strength'] },

  { id: 'slashing_guard', label: 'Slashing Guard', pos: { PG: 4, SG: 5 }, h: [72, 79],
    p: { speed: +14, agility: +12, vertical: +12, layup: +16, dunk: +12,
         ballHandling: +8, threePoint: -18, midRange: -10, freeThrow: -8, shotIQ: -4,
         postControl: -12, interiorDefense: -8, block: -10 },
    sig: ['speed', 'layup', 'vertical', 'dunk'],
    hole: ['threePoint', 'freeThrow', 'midRange'] },

  { id: 'two_way_guard', label: 'Two-Way Guard', pos: { PG: 4, SG: 4 }, h: [72, 80],
    p: { perimeterDefense: +14, steal: +12, defensiveIQ: +10, agility: +8, speed: +6,
         ballHandling: +6, passing: +4, threePoint: +2, postControl: -14,
         interiorDefense: -4, block: -8, offensiveRebound: -8 },
    sig: ['perimeterDefense', 'steal', 'defensiveIQ'],
    hole: ['postControl', 'block'] },

  { id: 'defensive_specialist', label: 'Defensive Specialist', pos: { PG: 3, SG: 3 }, h: [73, 80],
    p: { perimeterDefense: +20, steal: +16, defensiveIQ: +14, agility: +10, speed: +8,
         stamina: +6, threePoint: -14, midRange: -12, shotIQ: -8, ballHandling: -8,
         passing: -8, postControl: -16, freeThrow: -8, dunk: -8 },
    sig: ['perimeterDefense', 'steal', 'defensiveIQ'],
    hole: ['threePoint', 'midRange', 'ballHandling'] },

  { id: 'combo_guard', label: 'Combo Guard', pos: { PG: 5, SG: 5 }, h: [72, 79],
    p: { ballHandling: +10, midRange: +8, threePoint: +7, passing: +6, passingIQ: +5,
         layup: +6, shotIQ: +4, perimeterDefense: -4, postControl: -12,
         interiorDefense: -8, block: -10, defensiveRebound: -8 },
    sig: ['midRange', 'ballHandling'],
    hole: ['postControl', 'block'] },

  /* -------------------------------- wings ------------------------------- */
  { id: 'three_and_d', label: '3-and-D Wing', pos: { SG: 5, SF: 6, PF: 1 }, h: [76, 82],
    p: { threePoint: +18, perimeterDefense: +16, defensiveIQ: +12, steal: +8,
         agility: +6, freeThrow: +6, ballHandling: -14, passing: -12, passingIQ: -8,
         midRange: -4, postControl: -14, dunk: -4 },
    sig: ['threePoint', 'perimeterDefense', 'defensiveIQ'],
    hole: ['ballHandling', 'passing', 'postControl'] },

  { id: 'shot_creator', label: 'Shot Creator', pos: { SG: 4, SF: 4 }, h: [75, 81],
    p: { midRange: +16, ballHandling: +14, threePoint: +10, shotIQ: +10, layup: +8,
         freeThrow: +8, passing: -2, perimeterDefense: -8, defensiveIQ: -6,
         block: -8, offensiveRebound: -8 },
    sig: ['midRange', 'ballHandling', 'threePoint'],
    hole: ['perimeterDefense', 'defensiveIQ'] },

  { id: 'slashing_wing', label: 'Slashing Wing', pos: { SG: 3, SF: 4 }, h: [75, 82],
    p: { vertical: +16, speed: +10, agility: +8, dunk: +18, layup: +14, strength: +4,
         threePoint: -18, midRange: -10, freeThrow: -8, postControl: -8, passingIQ: -6 },
    sig: ['dunk', 'vertical', 'layup'],
    hole: ['threePoint', 'freeThrow'] },

  { id: 'two_way_wing', label: 'Two-Way Wing', pos: { SG: 3, SF: 5 }, h: [76, 82],
    p: { perimeterDefense: +10, defensiveIQ: +8, threePoint: +6, midRange: +6,
         layup: +5, steal: +5, agility: +4, stamina: +5, postControl: -8, block: -4 },
    sig: ['perimeterDefense', 'threePoint'],
    hole: ['postControl'] },

  { id: 'point_forward', label: 'Point Forward', pos: { SF: 3, PF: 2 }, h: [78, 84],
    p: { passing: +18, passingIQ: +18, ballHandling: +14, shotIQ: +8,
         defensiveRebound: +6, midRange: +4, dunk: -8, vertical: -6, speed: -4,
         perimeterDefense: -4, threePoint: -4, block: -6 },
    sig: ['passing', 'passingIQ', 'ballHandling'],
    hole: ['dunk', 'block'] },

  { id: 'defensive_stopper', label: 'Defensive Stopper', pos: { SF: 4, PF: 3 }, h: [77, 83],
    p: { perimeterDefense: +18, defensiveIQ: +16, interiorDefense: +10, steal: +10,
         strength: +10, agility: +8, stamina: +6, block: +6, threePoint: -16,
         midRange: -12, ballHandling: -12, passing: -10, shotIQ: -8, postControl: -12,
         freeThrow: -8 },
    sig: ['perimeterDefense', 'defensiveIQ', 'interiorDefense'],
    hole: ['threePoint', 'ballHandling', 'midRange'] },

  // The one archetype for which "every rating near his overall" is the RIGHT
  // answer. It is deliberately not the most common one.
  { id: 'all_around_wing', label: 'All-Around Wing', pos: { SF: 4, SG: 1, PF: 1 }, h: [76, 82],
    p: { threePoint: +3, midRange: +4, layup: +4, perimeterDefense: +4, defensiveIQ: +3,
         passing: +3, ballHandling: +3, defensiveRebound: +3, postControl: -4 },
    sig: [], hole: [] },

  { id: 'three_level_scorer', label: 'Three-Level Scorer', pos: { SG: 2, SF: 2, PF: 1 }, h: [75, 82],
    p: { midRange: +16, threePoint: +14, layup: +14, shotIQ: +12, freeThrow: +10,
         ballHandling: +10, dunk: +6, perimeterDefense: -8, defensiveIQ: -6,
         passing: -4, block: -8 },
    sig: ['midRange', 'threePoint', 'layup'],
    hole: ['perimeterDefense'] },

  /* ------------------------------- bigs --------------------------------- */
  { id: 'stretch_four', label: 'Stretch Four', pos: { PF: 5 }, h: [79, 84],
    p: { threePoint: +20, midRange: +14, freeThrow: +12, shotIQ: +8,
         interiorDefense: -10, block: -12, strength: -8, postControl: -8,
         offensiveRebound: -8, dunk: -8, speed: -2 },
    sig: ['threePoint', 'midRange'],
    hole: ['interiorDefense', 'block', 'strength'] },

  { id: 'interior_scorer', label: 'Interior Scorer', pos: { PF: 4, C: 4 }, h: [80, 86],
    p: { postControl: +20, layup: +14, dunk: +12, strength: +14, offensiveRebound: +10,
         defensiveRebound: +6, threePoint: -20, midRange: -10, freeThrow: -8,
         ballHandling: -12, passing: -8, perimeterDefense: -12, speed: -6, agility: -6 },
    sig: ['postControl', 'layup', 'strength'],
    hole: ['threePoint', 'perimeterDefense', 'freeThrow'] },

  { id: 'glass_cleaner', label: 'Glass Cleaner', pos: { PF: 4, C: 4 }, h: [80, 86],
    p: { defensiveRebound: +22, offensiveRebound: +22, strength: +14, vertical: +10,
         interiorDefense: +8, threePoint: -22, midRange: -16, freeThrow: -12,
         ballHandling: -16, passing: -12, passingIQ: -8, shotIQ: -8, postControl: -6,
         perimeterDefense: -12 },
    sig: ['defensiveRebound', 'offensiveRebound'],
    hole: ['threePoint', 'ballHandling', 'freeThrow'] },

  { id: 'rim_protector', label: 'Rim Protector', pos: { C: 6, PF: 2 }, h: [81, 88],
    p: { block: +24, interiorDefense: +20, defensiveIQ: +10, defensiveRebound: +12,
         strength: +10, vertical: +8, threePoint: -24, midRange: -16, freeThrow: -12,
         ballHandling: -16, passing: -12, perimeterDefense: -6, postControl: -6,
         speed: -6, agility: -8 },
    sig: ['block', 'interiorDefense'],
    hole: ['threePoint', 'freeThrow', 'ballHandling'] },

  { id: 'defensive_anchor', label: 'Defensive Anchor', pos: { C: 5, PF: 3 }, h: [80, 87],
    p: { interiorDefense: +20, defensiveIQ: +18, block: +14, defensiveRebound: +14,
         strength: +10, perimeterDefense: +4, stamina: +4, threePoint: -20,
         midRange: -14, ballHandling: -14, passing: -8, postControl: -4, dunk: -4 },
    sig: ['interiorDefense', 'defensiveIQ', 'block'],
    hole: ['threePoint', 'ballHandling'] },

  { id: 'stretch_big', label: 'Stretch Big', pos: { C: 3 }, h: [81, 87],
    p: { threePoint: +22, midRange: +16, freeThrow: +14, shotIQ: +10, passing: +4,
         interiorDefense: -8, block: -8, offensiveRebound: -10, strength: -6,
         postControl: -4, speed: -2 },
    sig: ['threePoint', 'midRange'],
    hole: ['interiorDefense', 'offensiveRebound', 'block'] },

  { id: 'playmaking_big', label: 'Playmaking Big', pos: { C: 2, PF: 2 }, h: [80, 86],
    p: { passing: +20, passingIQ: +20, shotIQ: +10, ballHandling: +8, midRange: +6,
         postControl: +6, dunk: -6, vertical: -6, speed: -4, block: -4, steal: -4 },
    sig: ['passing', 'passingIQ'],
    hole: ['vertical', 'speed'] },

  { id: 'athletic_finisher', label: 'Athletic Finisher', pos: { SF: 2, PF: 4, C: 3 }, h: [78, 85],
    p: { vertical: +20, dunk: +22, layup: +12, speed: +10, agility: +8,
         offensiveRebound: +10, strength: +4, block: +6, threePoint: -24, midRange: -18,
         freeThrow: -14, ballHandling: -12, passing: -10, shotIQ: -8, postControl: -10 },
    sig: ['dunk', 'vertical'],
    hole: ['threePoint', 'freeThrow', 'midRange'] },

  { id: 'post_playmaker', label: 'Post Playmaker', pos: { C: 3, PF: 2 }, h: [80, 86],
    p: { postControl: +18, passing: +16, passingIQ: +14, strength: +10,
         defensiveRebound: +8, shotIQ: +8, layup: +6, threePoint: -14, ballHandling: -6,
         speed: -6, agility: -6, perimeterDefense: -8, vertical: -6 },
    sig: ['postControl', 'passing'],
    hole: ['threePoint', 'perimeterDefense'] },

  { id: 'traditional_center', label: 'Traditional Center', pos: { C: 5 }, h: [82, 88],
    p: { strength: +16, postControl: +14, interiorDefense: +14, defensiveRebound: +16,
         offensiveRebound: +12, block: +10, layup: +6, dunk: +6, threePoint: -24,
         midRange: -16, freeThrow: -10, ballHandling: -18, passing: -10, passingIQ: -6,
         perimeterDefense: -14, speed: -10, agility: -12 },
    sig: ['strength', 'defensiveRebound', 'interiorDefense'],
    hole: ['threePoint', 'ballHandling', 'perimeterDefense', 'speed'] },

  { id: 'two_way_big', label: 'Two-Way Big', pos: { PF: 3, C: 3 }, h: [80, 86],
    p: { interiorDefense: +12, postControl: +10, defensiveRebound: +12, block: +8,
         strength: +10, layup: +8, offensiveRebound: +8, dunk: +6, defensiveIQ: +6,
         threePoint: -12, ballHandling: -10, perimeterDefense: -4, passing: -4 },
    sig: ['interiorDefense', 'postControl'],
    hole: ['threePoint', 'ballHandling'] },
];

const BY_ID = Object.fromEntries(ARCHETYPES.map((a) => [a.id, a]));
export function archetypeById(id) { return BY_ID[id] || null; }

/**
 * How well a height suits an archetype: 1 inside its band, halving every two
 * inches outside it. Never zero — a 6'7" rim protector is rare, not banned.
 */
export function frameFit(archetype, heightIn) {
  const [lo, hi] = archetype.h;
  const off = heightIn < lo ? lo - heightIn : heightIn > hi ? heightIn - hi : 0;
  return off === 0 ? 1 : Math.max(0.02, 0.5 ** (off / 2));
}

/** Archetypes a player of this position and height could plausibly be, weighted. */
export function archetypesFor(position, heightIn) {
  const out = [];
  for (const a of ARCHETYPES) {
    const base = a.pos[position];
    if (!base) continue;
    out.push({ archetype: a, weight: base * frameFit(a, heightIn) });
  }
  return out;
}

/* ===========================================================================
 * FRAME
 * ---------------------------------------------------------------------------
 * What a body makes easy and what it makes hard. Measured against the typical
 * height FOR HIS POSITION, not against a league average, so this captures only
 * what is unusual about him — a 6'10" centre gets no bonus for being tall,
 * because that is simply what a centre is, while a 6'8" point guard gets the
 * whole difference.
 *
 * This is what keeps unconventional players coherent instead of silly. An
 * oversized guard really does rebound better and change direction worse, and
 * a small-ball five really does struggle to protect the rim.
 * ======================================================================== */
export function frameMods(position, heightIn, weightLb) {
  const dh = heightIn - (POS_HEIGHT[position] || 79.5);
  // Weight relative to what this frame would normally carry.
  const expected = heightIn * 4.7 - 150;
  const dw = (weightLb - expected) / 10;   // in "ten-pound" units
  const m = {};
  const add = (k, v) => { m[k] = (m[k] || 0) + v; };

  add('strength', dh * 1.1 + dw * 2.6);
  add('block', dh * 1.7);
  add('interiorDefense', dh * 1.3 + dw * 1.0);
  add('defensiveRebound', dh * 1.4 + dw * 0.7);
  add('offensiveRebound', dh * 1.1 + dw * 0.7);
  add('postControl', dh * 1.0 + dw * 1.0);
  add('dunk', dh * 0.6);

  add('speed', -dh * 1.2 - dw * 1.6);
  add('agility', -dh * 1.4 - dw * 1.7);
  add('ballHandling', -dh * 1.2);
  add('perimeterDefense', -dh * 0.9 - dw * 0.8);
  add('passing', -dh * 0.5);
  add('threePoint', -dh * 0.35);
  add('vertical', -dw * 1.4);        // height barely matters; weight does
  add('stamina', -dw * 1.1);
  add('endurance', -dw * 0.9);
  return m;
}

/* ===========================================================================
 * AGE
 * ---------------------------------------------------------------------------
 * Age changes the SHAPE of a skill set, not its level. A 20-year-old is raw:
 * the tools are there and the reads are not. A 34-year-old is the reverse.
 * Both are then shifted onto whatever overall they are meant to have, so an
 * old player is not automatically a bad player — he is a differently shaped
 * one.
 * ======================================================================== */
export function ageMods(age) {
  const m = {};
  const add = (k, v) => { m[k] = (m[k] || 0) + v; };
  if (age <= 22) {
    const raw = 23 - age;                               // 1..4
    add('speed', raw * 1.2); add('vertical', raw * 1.4); add('agility', raw * 1.0);
    add('stamina', raw * 0.5); add('dunk', raw * 1.0);
    add('shotIQ', -raw * 2.2); add('passingIQ', -raw * 2.2); add('defensiveIQ', -raw * 2.4);
    add('postControl', -raw * 1.4); add('freeThrow', -raw * 0.8);
    add('ballHandling', -raw * 0.6); add('strength', -raw * 1.3);
    add('interiorDefense', -raw * 0.9); add('perimeterDefense', -raw * 0.9);
  } else if (age >= 30) {
    const old = Math.min(8, age - 29);                  // 1..8
    add('speed', -old * 1.5); add('vertical', -old * 1.6); add('agility', -old * 1.3);
    add('stamina', -old * 0.9); add('endurance', -old * 0.7); add('dunk', -old * 1.5);
    add('perimeterDefense', -old * 0.7);
    add('shotIQ', old * 1.2); add('passingIQ', old * 1.2); add('defensiveIQ', old * 1.3);
    add('freeThrow', old * 0.8); add('threePoint', old * 0.5); add('postControl', old * 0.7);
    add('strength', old * 0.4);
  }
  return m;
}

/* ===========================================================================
 * CORRELATION
 * ---------------------------------------------------------------------------
 * Individual variation that is not independent noise. Four latent factors are
 * drawn per player and loaded onto related attributes, so a player who is
 * explosive is explosive across the board and a player with touch shoots well
 * from everywhere — without any two ratings being the same number.
 *
 * Independent per-attribute noise on top of this is what keeps two players of
 * the same archetype from being copies.
 * ======================================================================== */
export const FACTORS = {
  // Explosive athleticism.
  athleticism: { speed: 1.0, agility: 0.9, vertical: 1.0, dunk: 0.8, layup: 0.5,
                 offensiveRebound: 0.4, perimeterDefense: 0.4, steal: 0.4, block: 0.3,
                 stamina: 0.3 },
  // Shooting touch: a jumper is one skill expressed at several distances.
  touch:       { threePoint: 1.0, midRange: 0.95, freeThrow: 0.9, shotIQ: 0.5,
                 layup: 0.3, postControl: 0.25 },
  // Feel for the game: reads, timing, decisions. Not the same as mental
  // attributes, which live in their own layer and never touch a rating.
  feel:        { passingIQ: 1.0, defensiveIQ: 0.95, shotIQ: 0.8, passing: 0.7,
                 ballHandling: 0.4, steal: 0.3, offensiveRebound: 0.2,
                 defensiveRebound: 0.2 },
  // Physicality: functional strength and the interior game it enables.
  physicality: { strength: 1.0, interiorDefense: 0.7, postControl: 0.6,
                 defensiveRebound: 0.6, offensiveRebound: 0.55, block: 0.4,
                 endurance: 0.3 },
};

/* ===========================================================================
 * CLASSIFICATION — archetype from attributes
 * ---------------------------------------------------------------------------
 * The inverse of generation, and the reason archetypes can EVOLVE. A player's
 * label is not a permanent tag stapled on at birth: it is read back off the
 * ratings he actually has. A slashing guard who develops a jumper genuinely
 * becomes a three-level scorer, and an athletic wing who loses a step
 * genuinely becomes a 3-and-D wing, because the numbers moved and the label
 * follows the numbers.
 * ======================================================================== */

/**
 * Match a player's attribute shape against every archetype available at his
 * position, and return the best fit.
 *
 * The shape is his ratings CENTRED on their own mean, so the comparison is
 * about the pattern of strengths and weaknesses, not about how good he is —
 * which is what lets the same function label a 62 and a 92.
 *
 * @returns {{id, label, score}|null}
 */
export function classifyArchetype(player) {
  const a = (player && player.attributes) || {};
  const vals = ATTRS.map((k) => (typeof a[k] === 'number' ? a[k] : null));
  if (vals.some((v) => v === null)) return null;

  const position = player.position;
  const height = typeof player.heightIn === 'number'
    ? player.heightIn : (POS_HEIGHT[position] || 79.5);
  const weight = typeof player.weightLb === 'number'
    ? player.weightLb : height * 4.7 - 150;

  // Undo everything that is NOT the archetype before comparing.
  //
  // Without this step the position baseline swamps the signal: a centre's
  // ratings look like the centre baseline, which looks like a traditional
  // centre, so every big classified as one — 33 rim protectors, 29 interior
  // scorers and 25 glass cleaners all came back "Traditional Center". Position,
  // frame and age are known quantities, so subtracting them leaves the part of
  // his profile that is actually a choice about what kind of player he is.
  const base = POSITION_BASE[position] || POSITION_BASE.SF;
  const frame = frameMods(position, height, weight);
  const aged = typeof player.age === 'number' ? ageMods(player.age) : {};

  const resid = ATTRS.map((k) => a[k] - (base[k] || 0) - (frame[k] || 0) - (aged[k] || 0));
  const mean = resid.reduce((s, v) => s + v, 0) / resid.length;
  const shape = resid.map((v) => v - mean);
  const shapeMag = Math.sqrt(shape.reduce((s, v) => s + v * v, 0)) || 1;

  let best = null;
  for (const { archetype, weight: prior } of archetypesFor(position, height)) {
    const prof = ATTRS.map((k) => archetype.p[k] || 0);
    const pMean = prof.reduce((s, v) => s + v, 0) / prof.length;
    const centred = prof.map((v) => v - pMean);
    const profMag = Math.sqrt(centred.reduce((s, v) => s + v * v, 0)) || 1;
    let dot = 0;
    for (let i = 0; i < ATTRS.length; i++) dot += shape[i] * centred[i];
    // Cosine similarity, nudged by how plausible the archetype is for his
    // position and frame — so a marginal fit does not win on a rounding error.
    const score = dot / (shapeMag * profMag) + Math.log(1 + prior) * 0.04;
    if (!best || score > best.score) best = { id: archetype.id, label: archetype.label, score };
  }
  return best;
}
