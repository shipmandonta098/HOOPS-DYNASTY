'use strict';

/**
 * saveLoad.js — Read and write the single JSON save file.
 *
 * The ENTIRE league lives in one JSON file. Every other module is a pure
 * function of the shape `league -> league`. This file is the only place that
 * touches the disk, so the rest of the engine stays testable and portable
 * (it would work just as happily in a browser with a different loader).
 *
 * It also does light structural validation so you fail fast with a clear
 * message instead of a cryptic crash three modules later.
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 1;

/**
 * The top-level keys every valid league must have. This is a cheap sanity
 * check, NOT full JSON-Schema validation (that lives in /schemas). It catches
 * the "you loaded the wrong file" class of mistakes.
 */
const REQUIRED_TOP_LEVEL_KEYS = ['schemaVersion', 'meta', 'settings', 'teams', 'players'];

/**
 * Load a league from disk and validate its basic shape.
 * @param {string} filePath - path to the .json save file.
 * @returns {object} the parsed league object.
 */
function loadLeague(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Save file not found: ${abs}`);
  }
  let league;
  try {
    league = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (err) {
    throw new Error(`Save file is not valid JSON (${abs}): ${err.message}`);
  }
  validateLeague(league);
  return league;
}

/**
 * Structural validation. Throws on the first problem it finds.
 * Deliberately forgiving about *extra* keys — the whole design goal is that
 * you can add fields (morale, chemistry, etc.) without breaking older code.
 */
function validateLeague(league) {
  if (typeof league !== 'object' || league === null) {
    throw new Error('League must be a JSON object.');
  }
  for (const key of REQUIRED_TOP_LEVEL_KEYS) {
    if (!(key in league)) {
      throw new Error(`League is missing required top-level key: "${key}".`);
    }
  }
  if (league.schemaVersion !== SCHEMA_VERSION) {
    // A warning, not a hard error — lets you migrate old saves intentionally.
    console.warn(
      `[saveLoad] schemaVersion is ${league.schemaVersion}, engine expects ${SCHEMA_VERSION}. ` +
        'Proceeding, but consider migrating the save.'
    );
  }
  if (!Array.isArray(league.teams)) throw new Error('league.teams must be an array.');
  if (!Array.isArray(league.players)) throw new Error('league.players must be an array.');
  return true;
}

/**
 * Write a league to disk as pretty-printed JSON.
 * Pretty-printing matters here: the save file is meant to be read and edited
 * by a human AND by Claude, so 2-space indentation keeps diffs clean.
 *
 * @param {object} league
 * @param {string} filePath
 */
function saveLeague(league, filePath) {
  validateLeague(league);
  const abs = path.resolve(filePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(league, null, 2) + '\n', 'utf8');
  return abs;
}

/**
 * Deep clone a league so modules can return a NEW object without mutating the
 * caller's input. Keeps the "pure function" contract honest. structuredClone
 * is available in Node 17+; we fall back to JSON round-trip otherwise.
 */
function cloneLeague(league) {
  if (typeof structuredClone === 'function') return structuredClone(league);
  return JSON.parse(JSON.stringify(league));
}

/* ---------- Convenience lookups used across the engine ---------- */

/** All players belonging to a given team id. */
function playersByTeam(league, teamId) {
  return league.players.filter((p) => p.teamId === teamId);
}

/** Find a player object by id. */
function getPlayer(league, playerId) {
  return league.players.find((p) => p.id === playerId);
}

/** Find a team object by id. */
function getTeam(league, teamId) {
  return league.teams.find((t) => t.id === teamId);
}

module.exports = {
  SCHEMA_VERSION,
  loadLeague,
  saveLeague,
  validateLeague,
  cloneLeague,
  playersByTeam,
  getPlayer,
  getTeam,
};

/* ---------- CLI: `node engine/saveLoad.js <file>` prints a summary ---------- */
if (require.main === module) {
  const file = process.argv[2] || 'saves/example_league.json';
  const league = loadLeague(file);
  console.log(`League: ${league.meta.leagueName}`);
  console.log(`Season: ${league.meta.currentSeason}  Phase: ${league.meta.currentPhase}`);
  console.log(`Teams: ${league.teams.length}  Players: ${league.players.length}`);
  console.log(`Free agents: ${(league.freeAgents || []).length}`);
  console.log(`Draft class: ${(league.draft && league.draft.prospects ? league.draft.prospects.length : 0)} prospects`);
  console.log(`History: ${(league.history && league.history.seasons ? league.history.seasons.length : 0)} completed seasons`);
}
