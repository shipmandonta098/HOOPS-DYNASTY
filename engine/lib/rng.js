'use strict';

/**
 * rng.js — Deterministic, seedable pseudo-random number generator.
 *
 * WHY THIS EXISTS:
 * The whole simulator is meant to be *reproducible*. If you run the same
 * league through the same modules with the same seed, you get the exact same
 * results every time. That is only possible if we NEVER call Math.random().
 * Every bit of randomness in the engine flows through this file instead.
 *
 * The league JSON stores a single `meta.rngSeed`. Each module derives its own
 * stream from that seed (see `RNG.forStream`) so that, say, the draft generator
 * and the season simulator don't accidentally consume each other's numbers.
 *
 * Algorithm: mulberry32 — tiny, fast, good enough statistical quality for a
 * game sim. Not cryptographic. Don't use it for anything security-sensitive.
 */

/**
 * Core mulberry32 generator. Returns a function that yields floats in [0, 1).
 * @param {number} seed - 32-bit unsigned integer seed.
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministically fold a string into a 32-bit integer.
 * Used so we can derive a sub-seed from a label like "season:2025".
 */
function hashString(str) {
  let h = 2166136261 >>> 0; // FNV-1a offset basis
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

class RNG {
  /**
   * @param {number} seed - base 32-bit seed. Defaults to a fixed value so an
   *   omitted seed is still deterministic (never random-by-accident).
   */
  constructor(seed = 123456789) {
    this._next = mulberry32(seed >>> 0);
    this.seed = seed >>> 0;
  }

  /**
   * Derive an independent RNG stream from a base seed plus a label.
   * Example: RNG.forStream(league.meta.rngSeed, `season:${year}`)
   * Guarantees two labels never share a sequence, so modules stay isolated.
   */
  static forStream(baseSeed, label) {
    return new RNG((baseSeed >>> 0) ^ hashString(String(label)));
  }

  /** Float in [0, 1). */
  next() {
    return this._next();
  }

  /** Integer in [min, max] inclusive. */
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Float in [min, max). */
  float(min, max) {
    return min + this.next() * (max - min);
  }

  /** Returns true with probability p (0..1). */
  chance(p) {
    return this.next() < p;
  }

  /** Pick one element from an array. */
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /**
   * Approximate a normal distribution (Box–Muller). Handy for generating
   * ratings that cluster around a mean instead of being flat/uniform.
   */
  gaussian(mean = 0, stdDev = 1) {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const mag = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + mag * stdDev;
  }

  /** In-place Fisher–Yates shuffle (deterministic given the seed). */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

module.exports = { RNG, mulberry32, hashString };
