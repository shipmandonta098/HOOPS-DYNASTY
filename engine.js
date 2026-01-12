/* ============================
   GAME ENGINE - PLAYER GENERATION & TEAM STATS
============================ */

// Schema Version for League Migrations
const CURRENT_SCHEMA_VERSION = 6; // Incremented for shot location system

// Debug Flags
const DEBUG_INJURIES = false; // Set to true to see injury logs

/* ============================
   INJURY SYSTEM - PHASE 1
============================ */

const INJURY_CATALOG = [
  { type: 'Ankle Sprain', minGames: 3, maxGames: 10, weight: 30 },
  { type: 'Hamstring Strain', minGames: 5, maxGames: 15, weight: 25 },
  { type: 'Wrist Sprain', minGames: 2, maxGames: 8, weight: 20 },
  { type: 'Knee Soreness', minGames: 1, maxGames: 5, weight: 15 },
  { type: 'Back Tightness', minGames: 2, maxGames: 7, weight: 10 }
];

const INJURY_CHANCE_PER_GAME = 0.02; // 2% chance per team per game

/* ============================
   PHASE CONSTANTS
============================ */

const PHASES = {
  PRESEASON: 'PRESEASON',
  REGULAR_SEASON: 'REGULAR_SEASON',
  ALL_STAR_BREAK: 'ALL_STAR_BREAK',
  POSTSEASON: 'POSTSEASON',
  OFFSEASON: 'OFFSEASON',
  DRAFT: 'DRAFT',
  FREE_AGENCY: 'FREE_AGENCY'
};

/**
 * Compute the current league phase based on game states
 * This is the SINGLE SOURCE OF TRUTH for phase detection
 * 
 * Phase Logic:
 * 1. If preseason games exist and are not all completed → PRESEASON
 * 2. Else if regular season games exist and at least one is unplayed → REGULAR_SEASON
 * 3. Else if all regular season games completed and All-Star events active → ALL_STAR_BREAK
 * 4. Else if playoff games exist and are not all completed → POSTSEASON
 * 5. Else → OFFSEASON (or DRAFT/FREE_AGENCY if those are active)
 * 
 * @returns {string} Current phase constant from PHASES
 */
function computeCurrentPhase() {
  if (!league || !league.schedule) {
    return PHASES.OFFSEASON;
  }
  
  // Check for active draft
  if (league.draft && league.draft.inProgress) {
    return PHASES.DRAFT;
  }
  
  const games = league.schedule.games || {};
  const allGames = Object.values(games);
  
  if (allGames.length === 0) {
    return PHASES.OFFSEASON;
  }
  
  // Separate games by phase
  const preseasonGames = allGames.filter(g => g.phase === 'Preseason');
  const regularGames = allGames.filter(g => g.phase === 'Regular Season');
  const playoffGames = allGames.filter(g => g.phase === 'Playoffs');
  
  // Check preseason: if any preseason games exist and not all completed
  if (preseasonGames.length > 0) {
    const allPreseasonComplete = preseasonGames.every(g => g.status === 'final');
    if (!allPreseasonComplete) {
      return PHASES.PRESEASON;
    }
  }
  
  // Check regular season: if any regular season games exist and not all completed
  if (regularGames.length > 0) {
    const allRegularComplete = regularGames.every(g => g.status === 'final');
    if (!allRegularComplete) {
      return PHASES.REGULAR_SEASON;
    }
    
    // All regular season games complete - check for All-Star break
    // (This would require All-Star event tracking - placeholder for now)
    if (league.allStarWeekend && league.allStarWeekend.active) {
      return PHASES.ALL_STAR_BREAK;
    }
  }
  
  // Check playoffs: if any playoff games exist and not all completed
  if (playoffGames.length > 0) {
    const allPlayoffsComplete = playoffGames.every(g => g.status === 'final');
    if (!allPlayoffsComplete) {
      return PHASES.POSTSEASON;
    }
  }
  
  // All games completed or no games exist
  return PHASES.OFFSEASON;
}

/**
 * Get the display-friendly name for a phase
 */
function getPhaseDisplayName(phase) {
  const displayNames = {
    [PHASES.PRESEASON]: 'Preseason',
    [PHASES.REGULAR_SEASON]: 'Regular Season',
    [PHASES.ALL_STAR_BREAK]: 'All-Star Break',
    [PHASES.POSTSEASON]: 'Playoffs',
    [PHASES.OFFSEASON]: 'Offseason',
    [PHASES.DRAFT]: 'Draft',
    [PHASES.FREE_AGENCY]: 'Free Agency'
  };
  
  return displayNames[phase] || phase;
}

/**
 * Update league.phase based on computed phase
 * Should be called after any game state change
 */
function updateLeaguePhase() {
  if (!league) return;
  
  const computedPhase = computeCurrentPhase();
  const oldPhase = league.phase;
  
  // Map computed phase to legacy format for compatibility
  const legacyPhaseMap = {
    [PHASES.PRESEASON]: 'preseason',
    [PHASES.REGULAR_SEASON]: 'season',
    [PHASES.ALL_STAR_BREAK]: 'season',
    [PHASES.POSTSEASON]: 'playoffs',
    [PHASES.OFFSEASON]: 'offseason',
    [PHASES.DRAFT]: 'draft',
    [PHASES.FREE_AGENCY]: 'offseason'
  };
  
  league.phase = legacyPhaseMap[computedPhase] || 'offseason';
  league.computedPhase = computedPhase; // Store computed phase for UI
  
  if (oldPhase !== league.phase) {
    console.log(`[Phase] Phase changed: ${oldPhase} → ${league.phase} (${computedPhase})`);
  }
}

/* ============================
   PHASE RULES SYSTEM
   Centralized action gating by league phase
============================ */

/**
 * Game actions that can be restricted by phase
 */
const ACTIONS = {
  TRADE: 'TRADE',
  SIGN_FA: 'SIGN_FA',
  WAIVE: 'WAIVE',
  PLAY_GAME: 'PLAY_GAME',
  SIM_DAY: 'SIM_DAY',
  DRAFT: 'DRAFT',
  RESIGN: 'RESIGN',
  EXTEND: 'EXTEND',
  ALL_STAR_EVENT: 'ALL_STAR_EVENT',
  EDIT_PLAYER: 'EDIT_PLAYER',
  FORCE_TRADE: 'FORCE_TRADE',
  FORCE_INJURY: 'FORCE_INJURY',
  ADD_PLAYER: 'ADD_PLAYER',
  DELETE_PLAYER: 'DELETE_PLAYER',
  ADVANCE_PHASE: 'ADVANCE_PHASE'
};

/**
 * Rules mapping: which actions are allowed in each phase
 * true = always allowed
 * false = always blocked
 * 'conditional' = check settings/state
 */
const RULES_BY_PHASE = {
  [PHASES.PRESEASON]: {
    [ACTIONS.PLAY_GAME]: true,
    [ACTIONS.SIM_DAY]: true,
    [ACTIONS.SIGN_FA]: true,
    [ACTIONS.WAIVE]: true,
    [ACTIONS.TRADE]: 'conditional', // Check allowTradesInPreseason
    [ACTIONS.RESIGN]: true,
    [ACTIONS.EXTEND]: true,
    [ACTIONS.DRAFT]: false,
    [ACTIONS.ALL_STAR_EVENT]: false,
    [ACTIONS.EDIT_PLAYER]: 'conditional', // Commissioner only
    [ACTIONS.FORCE_TRADE]: 'conditional', // Commissioner only
    [ACTIONS.FORCE_INJURY]: 'conditional', // Commissioner only
    [ACTIONS.ADD_PLAYER]: 'conditional', // Commissioner only
    [ACTIONS.DELETE_PLAYER]: 'conditional', // Commissioner only
    [ACTIONS.ADVANCE_PHASE]: true
  },
  
  [PHASES.REGULAR_SEASON]: {
    [ACTIONS.PLAY_GAME]: true,
    [ACTIONS.SIM_DAY]: true,
    [ACTIONS.SIGN_FA]: true,
    [ACTIONS.WAIVE]: true,
    [ACTIONS.TRADE]: 'conditional', // Check trade deadline
    [ACTIONS.RESIGN]: false,
    [ACTIONS.EXTEND]: true,
    [ACTIONS.DRAFT]: false,
    [ACTIONS.ALL_STAR_EVENT]: false,
    [ACTIONS.EDIT_PLAYER]: 'conditional', // Commissioner only
    [ACTIONS.FORCE_TRADE]: 'conditional', // Commissioner only
    [ACTIONS.FORCE_INJURY]: 'conditional', // Commissioner only
    [ACTIONS.ADD_PLAYER]: 'conditional', // Commissioner only
    [ACTIONS.DELETE_PLAYER]: 'conditional', // Commissioner only
    [ACTIONS.ADVANCE_PHASE]: false
  },
  
  [PHASES.ALL_STAR_BREAK]: {
    [ACTIONS.PLAY_GAME]: false,
    [ACTIONS.SIM_DAY]: false,
    [ACTIONS.SIGN_FA]: 'conditional', // Check settings
    [ACTIONS.WAIVE]: 'conditional', // Check settings
    [ACTIONS.TRADE]: 'conditional', // Check trade deadline
    [ACTIONS.RESIGN]: false,
    [ACTIONS.EXTEND]: true,
    [ACTIONS.DRAFT]: false,
    [ACTIONS.ALL_STAR_EVENT]: true,
    [ACTIONS.EDIT_PLAYER]: 'conditional', // Commissioner only
    [ACTIONS.FORCE_TRADE]: 'conditional', // Commissioner only
    [ACTIONS.FORCE_INJURY]: 'conditional', // Commissioner only
    [ACTIONS.ADD_PLAYER]: 'conditional', // Commissioner only
    [ACTIONS.DELETE_PLAYER]: 'conditional', // Commissioner only
    [ACTIONS.ADVANCE_PHASE]: true
  },
  
  [PHASES.POSTSEASON]: {
    [ACTIONS.PLAY_GAME]: true,
    [ACTIONS.SIM_DAY]: true,
    [ACTIONS.SIGN_FA]: 'conditional', // Check allowSigningsInPlayoffs
    [ACTIONS.WAIVE]: 'conditional', // Check allowWaiversInPlayoffs
    [ACTIONS.TRADE]: false,
    [ACTIONS.RESIGN]: false,
    [ACTIONS.EXTEND]: false,
    [ACTIONS.DRAFT]: false,
    [ACTIONS.ALL_STAR_EVENT]: false,
    [ACTIONS.EDIT_PLAYER]: 'conditional', // Commissioner only
    [ACTIONS.FORCE_TRADE]: 'conditional', // Commissioner only
    [ACTIONS.FORCE_INJURY]: 'conditional', // Commissioner only
    [ACTIONS.ADD_PLAYER]: 'conditional', // Commissioner only
    [ACTIONS.DELETE_PLAYER]: 'conditional', // Commissioner only
    [ACTIONS.ADVANCE_PHASE]: false
  },
  
  [PHASES.OFFSEASON]: {
    [ACTIONS.PLAY_GAME]: false,
    [ACTIONS.SIM_DAY]: false,
    [ACTIONS.SIGN_FA]: true,
    [ACTIONS.WAIVE]: true,
    [ACTIONS.TRADE]: true,
    [ACTIONS.RESIGN]: true,
    [ACTIONS.EXTEND]: true,
    [ACTIONS.DRAFT]: 'conditional', // Only if draft not completed
    [ACTIONS.ALL_STAR_EVENT]: false,
    [ACTIONS.EDIT_PLAYER]: 'conditional', // Commissioner only
    [ACTIONS.FORCE_TRADE]: 'conditional', // Commissioner only
    [ACTIONS.FORCE_INJURY]: 'conditional', // Commissioner only
    [ACTIONS.ADD_PLAYER]: 'conditional', // Commissioner only
    [ACTIONS.DELETE_PLAYER]: 'conditional', // Commissioner only
    [ACTIONS.ADVANCE_PHASE]: true
  },
  
  [PHASES.DRAFT]: {
    [ACTIONS.PLAY_GAME]: false,
    [ACTIONS.SIM_DAY]: false,
    [ACTIONS.SIGN_FA]: false,
    [ACTIONS.WAIVE]: false,
    [ACTIONS.TRADE]: true, // Draft pick trades
    [ACTIONS.RESIGN]: false,
    [ACTIONS.EXTEND]: false,
    [ACTIONS.DRAFT]: true,
    [ACTIONS.ALL_STAR_EVENT]: false,
    [ACTIONS.EDIT_PLAYER]: 'conditional', // Commissioner only
    [ACTIONS.FORCE_TRADE]: 'conditional', // Commissioner only
    [ACTIONS.FORCE_INJURY]: 'conditional', // Commissioner only
    [ACTIONS.ADD_PLAYER]: 'conditional', // Commissioner only
    [ACTIONS.DELETE_PLAYER]: 'conditional', // Commissioner only
    [ACTIONS.ADVANCE_PHASE]: 'conditional' // Only when draft complete
  }
};

/**
 * Check if trade deadline has passed
 */
function isBeforeTradeDeadline() {
  if (!league || !league.schedule) return true;
  
  const currentPhase = computeCurrentPhase();
  if (currentPhase !== PHASES.REGULAR_SEASON) return false;
  
  // Trade deadline is typically 60% through regular season
  const tradeDeadlineDay = league.settings?.tradeDeadlineDay || 
                           Math.floor((league.settings?.gamesPerTeam || 82) * 0.6);
  
  const currentDay = league.currentDay || 0;
  return currentDay < tradeDeadlineDay;
}

/**
 * Check if an action is allowed in the current state
 * @param {string} action - Action from ACTIONS enum
 * @param {object} state - Optional state override (for testing)
 * @returns {boolean} Whether action is allowed
 */
function isActionAllowed(action, state = null) {
  if (!league) return false;
  
  const currentPhase = state?.phase || computeCurrentPhase();
  const settings = state?.settings || league.settings || {};
  const isCommissioner = state?.commissionerMode !== undefined ? 
                        state.commissionerMode : 
                        (league.meta?.commissionerMode || false);
  
  // Get rule for this action in current phase
  const phaseRules = RULES_BY_PHASE[currentPhase];
  if (!phaseRules) return false;
  
  const rule = phaseRules[action];
  
  // Simple true/false rules
  if (rule === true) return true;
  if (rule === false) return false;
  
  // Conditional rules
  if (rule === 'conditional') {
    switch (action) {
      // Commissioner-only actions
      case ACTIONS.EDIT_PLAYER:
      case ACTIONS.FORCE_TRADE:
      case ACTIONS.FORCE_INJURY:
      case ACTIONS.ADD_PLAYER:
      case ACTIONS.DELETE_PLAYER:
      case ACTIONS.ADVANCE_PHASE:
        return isCommissioner;
      
      // Trade rules
      case ACTIONS.TRADE:
        if (currentPhase === PHASES.PRESEASON) {
          return settings.allowTradesInPreseason || isCommissioner;
        }
        if (currentPhase === PHASES.REGULAR_SEASON) {
          return isBeforeTradeDeadline() || isCommissioner;
        }
        if (currentPhase === PHASES.ALL_STAR_BREAK) {
          return isBeforeTradeDeadline() || isCommissioner;
        }
        return isCommissioner;
      
      // Playoff rules
      case ACTIONS.SIGN_FA:
        if (currentPhase === PHASES.POSTSEASON) {
          return settings.allowSigningsInPlayoffs || isCommissioner;
        }
        if (currentPhase === PHASES.ALL_STAR_BREAK) {
          return settings.allowSigningsDuringAllStar || isCommissioner;
        }
        return true;
      
      case ACTIONS.WAIVE:
        if (currentPhase === PHASES.POSTSEASON) {
          return settings.allowWaiversInPlayoffs || isCommissioner;
        }
        if (currentPhase === PHASES.ALL_STAR_BREAK) {
          return settings.allowWaiversDuringAllStar || isCommissioner;
        }
        return true;
      
      // Draft rules
      case ACTIONS.DRAFT:
        if (currentPhase === PHASES.OFFSEASON) {
          return !league.draft?.completed;
        }
        return currentPhase === PHASES.DRAFT;
      
      default:
        return false;
    }
  }
  
  return false;
}

/**
 * Get human-readable reason why an action is locked
 * @param {string} action - Action from ACTIONS enum
 * @param {object} state - Optional state override
 * @returns {string|null} Lock reason or null if allowed
 */
function getActionLockReason(action, state = null) {
  if (isActionAllowed(action, state)) return null;
  
  const currentPhase = state?.phase || computeCurrentPhase();
  const phaseName = getPhaseDisplayName(currentPhase);
  const settings = state?.settings || league.settings || {};
  const isCommissioner = state?.commissionerMode !== undefined ? 
                        state.commissionerMode : 
                        (league.meta?.commissionerMode || false);
  
  // Action-specific messages
  switch (action) {
    case ACTIONS.TRADE:
      if (currentPhase === PHASES.PRESEASON) {
        return 'Trades are disabled during preseason. Enable in league settings or use Commissioner Mode.';
      }
      if (currentPhase === PHASES.REGULAR_SEASON || currentPhase === PHASES.ALL_STAR_BREAK) {
        if (!isBeforeTradeDeadline()) {
          return 'Trade deadline has passed.';
        }
      }
      if (currentPhase === PHASES.POSTSEASON) {
        return 'Trades are disabled during the postseason.';
      }
      return `Trades are not allowed during ${phaseName}.`;
    
    case ACTIONS.SIGN_FA:
      if (currentPhase === PHASES.POSTSEASON) {
        return 'Free agent signings are disabled during playoffs. Enable in league settings.';
      }
      if (currentPhase === PHASES.ALL_STAR_BREAK) {
        return 'Free agent signings are disabled during All-Star Break.';
      }
      if (currentPhase === PHASES.DRAFT) {
        return 'Free agent signings are disabled during the draft.';
      }
      return `Free agent signings are not allowed during ${phaseName}.`;
    
    case ACTIONS.WAIVE:
      if (currentPhase === PHASES.POSTSEASON) {
        return 'Waivers are disabled during playoffs. Enable in league settings.';
      }
      if (currentPhase === PHASES.DRAFT) {
        return 'Waivers are disabled during the draft.';
      }
      return `Waivers are not allowed during ${phaseName}.`;
    
    case ACTIONS.PLAY_GAME:
    case ACTIONS.SIM_DAY:
      if (currentPhase === PHASES.OFFSEASON) {
        return 'No games to play during offseason.';
      }
      if (currentPhase === PHASES.DRAFT) {
        return 'Complete the draft before playing games.';
      }
      if (currentPhase === PHASES.ALL_STAR_BREAK) {
        return 'Games are paused during All-Star Break.';
      }
      return 'No games available to play.';
    
    case ACTIONS.DRAFT:
      if (currentPhase === PHASES.OFFSEASON && league.draft?.completed) {
        return 'Draft has already been completed.';
      }
      return `Draft is only available during offseason, not during ${phaseName}.`;
    
    case ACTIONS.RESIGN:
      if (currentPhase !== PHASES.OFFSEASON && currentPhase !== PHASES.PRESEASON) {
        return 'Player re-signings are only available during offseason and preseason.';
      }
      return 'Re-signings are not available at this time.';
    
    case ACTIONS.EXTEND:
      if (currentPhase === PHASES.POSTSEASON) {
        return 'Contract extensions are disabled during playoffs.';
      }
      return 'Contract extensions are not available at this time.';
    
    case ACTIONS.ALL_STAR_EVENT:
      return 'All-Star events are only available during All-Star Break.';
    
    case ACTIONS.EDIT_PLAYER:
    case ACTIONS.FORCE_TRADE:
    case ACTIONS.FORCE_INJURY:
    case ACTIONS.ADD_PLAYER:
    case ACTIONS.DELETE_PLAYER:
    case ACTIONS.ADVANCE_PHASE:
      if (!isCommissioner) {
        return 'This action requires Commissioner Mode to be enabled.';
      }
      return 'This action is not available.';
    
    default:
      return `This action is not allowed during ${phaseName}.`;
  }
}

/* ============================
   AI TRADE LOGIC SYSTEM
============================ */

/**
 * Trade value constants - tunable for balance
 */
const TRADE_VALUE_CONSTANTS = {
  SALARY_PER_OVR: 0.5,        // Expected salary per OVR point (in millions)
  CONTRACT_WEIGHT: 2.5,       // How much $1M surplus affects trade value
  SLOT_PENALTY: 0.8,          // Draft slot penalty (per slot)
  FUTURE_DISCOUNT: 3.5,       // Discount per year into future
  ROUND_1_BASE: 30,           // Base value for 1st round pick
  ROUND_2_BASE: 12            // Base value for 2nd round pick
};

/**
 * Team Timeline States - determines trading strategy
 */
const TEAM_TIMELINE = {
  CONTENDER: 'CONTENDER',     // Top teams, buy win-now pieces
  PLAYOFF: 'PLAYOFF',         // Competitive, minor upgrades only
  MIDDLING: 'MIDDLING',       // Average teams, flexible strategy
  REBUILD: 'REBUILD'          // Bottom teams, sell for picks/youth
};

/**
 * Acceptance thresholds by timeline
 */
const TIMELINE_THRESHOLDS = {
  CONTENDER: 3,   // Accept if netValue >= +3
  PLAYOFF: 5,     // Accept if netValue >= +5
  MIDDLING: 7,    // Accept if netValue >= +7
  REBUILD: 10     // Accept if netValue >= +10
};

/**
 * Classify team's timeline state based on record, SRS, roster age, and strength
 * @param {Object} team - Team to classify
 * @returns {string} Team timeline constant
 */
function classifyTeamTimeline(team) {
  if (!team || !team.players || team.players.length === 0) {
    return TEAM_TIMELINE.MIDDLING;
  }
  
  const totalGames = (team.wins || 0) + (team.losses || 0);
  const winPct = totalGames > 0 ? team.wins / totalGames : 0.5;
  
  // Calculate roster metrics
  const sortedByOvr = [...team.players].sort((a, b) => b.ratings.ovr - a.ratings.ovr);
  const top5Players = sortedByOvr.slice(0, 5);
  const avgTop5Ovr = top5Players.reduce((sum, p) => sum + p.ratings.ovr, 0) / top5Players.length;
  const avgTop5Age = top5Players.reduce((sum, p) => sum + p.age, 0) / top5Players.length;
  
  // Simple Rating System (SRS) - combine win% and point differential
  const srs = team.srs || ((winPct - 0.5) * 20);
  
  // Classification logic
  if (winPct >= 0.60 && srs > 3 && avgTop5Ovr >= 75) {
    // Strong record + good players = Contender
    return TEAM_TIMELINE.CONTENDER;
  } else if (winPct >= 0.50 && avgTop5Ovr >= 70) {
    // Decent record + decent players = Playoff team
    return TEAM_TIMELINE.PLAYOFF;
  } else if (winPct < 0.35 || avgTop5Ovr < 65 || (avgTop5Age > 30 && winPct < 0.45)) {
    // Poor record OR weak roster OR aging losing team = Rebuild
    return TEAM_TIMELINE.REBUILD;
  } else {
    // Everything else = Middling
    return TEAM_TIMELINE.MIDDLING;
  }
}

/**
 * Calculate deterministic trade value for a player
 * Formula-based system to prevent exploitation
 * 
 * @param {Object} player - Player to evaluate
 * @param {Object} team - Team context for role calculation (optional)
 * @returns {number} Trade value (clamped to -40 to 120)
 */
function calculatePlayerTradeValue(player, team = null) {
  if (!player || !player.ratings) return 0;
  
  const ovr = player.ratings.ovr || 50;
  const pot = player.ratings.pot || ovr;
  const age = player.age || 25;
  
  // 1) Base Talent: (ovr / 10) ^ 2
  const baseTalent = Math.pow(ovr / 10, 2);
  
  // 2) Age Multiplier
  let ageMultiplier = 1.0;
  if (age <= 21) {
    ageMultiplier = 1.25;
  } else if (age >= 22 && age <= 25) {
    ageMultiplier = 1.15;
  } else if (age >= 26 && age <= 28) {
    ageMultiplier = 1.05;
  } else if (age >= 29 && age <= 31) {
    ageMultiplier = 0.95;
  } else if (age >= 32 && age <= 34) {
    ageMultiplier = 0.80;
  } else { // age >= 35
    ageMultiplier = 0.65;
  }
  
  // 3) Potential Boost: (pot - ovr) * 0.6, clamped to [-10, +15]
  let potentialBoost = (pot - ovr) * 0.6;
  potentialBoost = Math.max(-10, Math.min(15, potentialBoost));
  
  // 4) Contract Surplus
  let contractValue = 0;
  if (player.contract && player.contract.amount !== undefined) {
    const expectedSalary = ovr * TRADE_VALUE_CONSTANTS.SALARY_PER_OVR;
    const actualSalary = player.contract.amount;
    const surplus = expectedSalary - actualSalary;
    contractValue = surplus * TRADE_VALUE_CONSTANTS.CONTRACT_WEIGHT;
    
    // Discount for expiring contracts (1 year remaining)
    const yearsRemaining = player.contract.yearsRemaining || 1;
    if (yearsRemaining === 1) {
      contractValue *= 0.75;
    }
    
    // Discount for non-guaranteed contracts
    if (player.contract.nonGuaranteed) {
      contractValue *= 0.9;
    }
  }
  
  // 5) Injury / Availability Risk
  let riskPenalty = 0;
  
  if (player.injuryProne) {
    riskPenalty -= 8;
  }
  
  if (player.injury && player.injury.gamesRemaining > 0) {
    const gamesOut = player.injury.gamesRemaining;
    riskPenalty -= gamesOut * 0.3;
  }
  
  // 6) Role Bonus
  let roleBonus = 0;
  if (team && team.players) {
    const sortedByMinutes = [...team.players]
      .filter(p => p.stats && p.stats.gp > 0)
      .sort((a, b) => (b.stats.min || 0) - (a.stats.min || 0));
    
    const playerIndex = sortedByMinutes.findIndex(p => p.id === player.id);
    
    if (playerIndex >= 0 && playerIndex < 5) {
      roleBonus = 6; // Starter
    } else if (playerIndex >= 5 && playerIndex < 10) {
      roleBonus = 3; // Key bench
    }
    // Otherwise 0 (deep bench / no role)
  }
  
  // FINAL PLAYER VALUE
  let tradeValue = (baseTalent * ageMultiplier) + potentialBoost + contractValue + roleBonus + riskPenalty;
  
  // Clamp to [-40, 120]
  tradeValue = Math.max(-40, Math.min(120, tradeValue));
  
  return Math.round(tradeValue * 10) / 10; // Round to 1 decimal
}

/**
 * Calculate deterministic trade value for a draft pick
 * 
 * @param {Object} pick - Draft pick object {round, year, originalTeamId, currentOwner}
 * @returns {number} Pick trade value (minimum 0)
 */
function calculatePickTradeValue(pick) {
  if (!pick) return 0;
  
  const currentYear = league?.season || new Date().getFullYear();
  const yearsOut = Math.max(0, (pick.year || currentYear) - currentYear);
  
  // Base value by round
  let baseValue = 0;
  if (pick.round === 1) {
    baseValue = TRADE_VALUE_CONSTANTS.ROUND_1_BASE;
  } else if (pick.round === 2) {
    baseValue = TRADE_VALUE_CONSTANTS.ROUND_2_BASE;
  } else {
    baseValue = 5; // Later rounds
  }
  
  // Estimate projected slot
  const projectedSlot = estimatePickSlot(pick);
  
  // Apply penalties
  const slotPenalty = projectedSlot * TRADE_VALUE_CONSTANTS.SLOT_PENALTY;
  const futureDiscount = yearsOut * TRADE_VALUE_CONSTANTS.FUTURE_DISCOUNT;
  
  let pickValue = baseValue - slotPenalty - futureDiscount;
  
  // Clamp minimum to 0
  pickValue = Math.max(0, pickValue);
  
  return Math.round(pickValue * 10) / 10; // Round to 1 decimal
}

/**
 * Estimate draft slot for a pick (1-30 in first round)
 * Based on current team record (inverse)
 * 
 * @param {Object} pick - Draft pick
 * @returns {number} Estimated slot (1-30)
 */
function estimatePickSlot(pick) {
  if (!pick.originalTeamId || !league?.teams) return 15; // Default mid-first
  
  const team = league.teams.find(t => t.id === pick.originalTeamId);
  if (!team) return 15;
  
  // Estimate based on current record (inverse)
  const totalGames = (team.wins || 0) + (team.losses || 0);
  if (totalGames === 0) return 15; // No games played yet
  
  const winPct = team.wins / totalGames;
  
  // Convert win% to draft slot (worse teams pick earlier)
  // 0.0 win% → slot 1, 1.0 win% → slot 30
  const estimatedSlot = Math.round(1 + (winPct * 29));
  return Math.min(30, Math.max(1, estimatedSlot));
}

/**
 * Evaluate a trade from a specific team's perspective
 * @param {Object} trade - Trade object {teamAId, teamBId, teamAAssets, teamBAssets}
 * @param {number} teamId - ID of team evaluating the trade
 * @returns {Object} Evaluation result {legal, netValue, accept, reasoning}
 */
/**
 * Evaluate a trade from a specific team's perspective
 * Uses deterministic formulas and timeline-based thresholds
 * 
 * @param {Object} trade - Trade object {teamAId, teamBId, teamAAssets, teamBAssets}
 * @param {number} teamId - ID of team evaluating the trade
 * @returns {Object} Evaluation result {legal, netValue, accept, reasoning, debug}
 */
function evaluateTradeForTeam(trade, teamId) {
  const team = league.teams.find(t => t.id === teamId);
  if (!team) {
    return { 
      legal: false, 
      netValue: 0, 
      accept: false, 
      reasoning: 'Team not found',
      debug: {}
    };
  }
  
  // Determine which side of trade this team is on
  const isTeamA = teamId === trade.teamAId;
  const incomingAssets = isTeamA ? trade.teamBAssets : trade.teamAAssets;
  const outgoingAssets = isTeamA ? trade.teamAAssets : trade.teamBAssets;
  const partnerTeamId = isTeamA ? trade.teamBId : trade.teamAId;
  const partnerTeam = league.teams.find(t => t.id === partnerTeamId);
  
  if (!partnerTeam) {
    return {
      legal: false,
      netValue: 0,
      accept: false,
      reasoning: 'Partner team not found',
      debug: {}
    };
  }
  
  // Step 1: Validate legality (roster size, cap rules)
  const legalityCheck = validateTradeLegality(trade, teamId);
  if (!legalityCheck.legal) {
    return {
      legal: false,
      netValue: 0,
      accept: false,
      reasoning: legalityCheck.reason,
      debug: {}
    };
  }
  
  // Step 2: Calculate incoming and outgoing value
  let incomingValue = 0;
  let outgoingValue = 0;
  const incomingPlayers = [];
  const outgoingPlayers = [];
  
  // Value incoming players
  if (incomingAssets.players && Array.isArray(incomingAssets.players)) {
    incomingAssets.players.forEach(playerId => {
      const player = partnerTeam.players.find(p => p.id === playerId);
      if (player) {
        const value = calculatePlayerTradeValue(player, partnerTeam);
        incomingValue += value;
        incomingPlayers.push({ name: player.name, value });
      }
    });
  }
  
  // Value incoming picks
  if (incomingAssets.picks && Array.isArray(incomingAssets.picks)) {
    incomingAssets.picks.forEach(pickId => {
      const pick = league.draftPicks?.find(p => p.id === pickId);
      if (pick) {
        const value = calculatePickTradeValue(pick);
        incomingValue += value;
      }
    });
  }
  
  // Value outgoing players
  if (outgoingAssets.players && Array.isArray(outgoingAssets.players)) {
    outgoingAssets.players.forEach(playerId => {
      const player = team.players.find(p => p.id === playerId);
      if (player) {
        const value = calculatePlayerTradeValue(player, team);
        outgoingValue += value;
        outgoingPlayers.push({ name: player.name, value });
      }
    });
  }
  
  // Value outgoing picks
  if (outgoingAssets.picks && Array.isArray(outgoingAssets.picks)) {
    outgoingAssets.picks.forEach(pickId => {
      const pick = league.draftPicks?.find(p => p.id === pickId);
      if (pick) {
        const value = calculatePickTradeValue(pick);
        outgoingValue += value;
      }
    });
  }
  
  // Step 3: Calculate base net value
  let netValue = incomingValue - outgoingValue;
  
  // Step 4: Apply bonuses and penalties
  let bonuses = 0;
  let penalties = 0;
  const modifiers = [];
  
  // Bonus: Filling a positional need (+3)
  const teamNeeds = identifyTeamNeeds(team);
  const fillsNeed = incomingAssets.players?.some(playerId => {
    const player = partnerTeam.players.find(p => p.id === playerId);
    return player && teamNeeds.includes(player.pos);
  });
  if (fillsNeed) {
    bonuses += 3;
    modifiers.push('fills positional need (+3)');
  }
  
  // Penalty: Taking on bad contract (-5)
  const takesBadContract = incomingAssets.players?.some(playerId => {
    const player = partnerTeam.players.find(p => p.id === playerId);
    if (!player || !player.contract) return false;
    const expectedSalary = player.ratings.ovr * TRADE_VALUE_CONSTANTS.SALARY_PER_OVR;
    const actualSalary = player.contract.amount;
    return actualSalary > expectedSalary * 1.5; // 50% overpaid = bad contract
  });
  if (takesBadContract) {
    penalties += 5;
    modifiers.push('takes bad contract (-5)');
  }
  
  // Penalty: Luxury tax/apron hit (-5)
  const SALARY_CAP = league?.settings?.salaryCap || 123.5;
  const TAX_LINE = league?.settings?.luxuryTaxLine || 150;
  
  let salaryChange = 0;
  incomingAssets.players?.forEach(playerId => {
    const player = partnerTeam.players.find(p => p.id === playerId);
    if (player?.contract) salaryChange += player.contract.amount;
  });
  outgoingAssets.players?.forEach(playerId => {
    const player = team.players.find(p => p.id === playerId);
    if (player?.contract) salaryChange -= player.contract.amount;
  });
  
  const currentPayroll = team.players.reduce((sum, p) => sum + (p.contract?.amount || 0), 0);
  const newPayroll = currentPayroll + salaryChange;
  
  if (league?.settings?.luxuryTax && newPayroll > TAX_LINE && currentPayroll <= TAX_LINE) {
    penalties += 5;
    modifiers.push('enters luxury tax (-5)');
  }
  
  // Apply bonuses and penalties to net value
  netValue += bonuses - penalties;
  
  // Step 5: Determine acceptance based on timeline
  const timeline = classifyTeamTimeline(team);
  const threshold = TIMELINE_THRESHOLDS[timeline] || 7;
  const accept = netValue >= threshold;
  
  // Step 6: Build reasoning string
  let reasoning = '';
  if (accept) {
    reasoning = `Accepted: +${netValue.toFixed(1)} value (threshold: +${threshold})`;
    if (timeline === TEAM_TIMELINE.CONTENDER) {
      reasoning += ', helps championship push';
    } else if (timeline === TEAM_TIMELINE.REBUILD) {
      reasoning += ', aids rebuild';
    }
    if (modifiers.length > 0) {
      reasoning += ', ' + modifiers.join(', ');
    }
  } else {
    reasoning = `Rejected: +${netValue.toFixed(1)} value (threshold: +${threshold})`;
    const shortfall = threshold - netValue;
    reasoning += `, needs +${shortfall.toFixed(1)} more value`;
  }
  
  // Debug info
  const debug = {
    incomingValue: Math.round(incomingValue * 10) / 10,
    outgoingValue: Math.round(outgoingValue * 10) / 10,
    bonuses,
    penalties,
    timeline,
    threshold,
    incomingPlayers,
    outgoingPlayers
  };
  
  // Log if enabled
  const settings = league?.settings || {};
  if (settings.aiTradeLogging) {
    console.log(`[AI Trade] ${team.name} evaluating trade:`);
    console.log(`  Incoming value: ${debug.incomingValue}`);
    console.log(`  Outgoing value: ${debug.outgoingValue}`);
    console.log(`  Net value: ${netValue.toFixed(1)}`);
    console.log(`  Timeline: ${timeline} (threshold: +${threshold})`);
    console.log(`  ${reasoning}`);
  }
  
  return {
    legal: true,
    netValue: Math.round(netValue * 10) / 10,
    accept,
    reasoning,
    debug
  };
}

/**
 * Validate trade legality (roster size, cap rules)
 * @param {number} teamId - Team to validate for
 * @returns {Object} {legal: boolean, reason: string}
 */
function validateTradeLegality(trade, teamId) {
  const team = league.teams.find(t => t.id === teamId);
  if (!team) {
    return { legal: false, reason: 'Team not found' };
  }
  
  const settings = league?.settings || {};
  const isTeamA = teamId === trade.teamAId;
  const incomingAssets = isTeamA ? trade.teamBAssets : trade.teamAAssets;
  const outgoingAssets = isTeamA ? trade.teamAAssets : trade.teamBAssets;
  const partnerTeamId = isTeamA ? trade.teamBId : trade.teamAId;
  const partnerTeam = league.teams.find(t => t.id === partnerTeamId);
  
  // Check roster size
  const playersIn = incomingAssets.players?.length || 0;
  const playersOut = outgoingAssets.players?.length || 0;
  const finalRosterSize = team.players.length - playersOut + playersIn;
  
  const minRoster = settings.minRosterSize || 13;
  const maxRoster = settings.maxRosterSize || 15;
  
  if (finalRosterSize < minRoster) {
    return { legal: false, reason: `Roster would drop below minimum (${minRoster})` };
  }
  
  if (finalRosterSize > maxRoster) {
    return { legal: false, reason: `Roster would exceed maximum (${maxRoster})` };
  }
  
  // Check salary cap (hard cap only if enabled)
  if (settings.capSystem === 'hard') {
    const SALARY_CAP = settings.salaryCap || 123.5;
    let salaryChange = 0;
    
    incomingAssets.players?.forEach(playerId => {
      const player = partnerTeam.players.find(p => p.id === playerId);
      if (player?.contract) salaryChange += player.contract.amount;
    });
    
    outgoingAssets.players?.forEach(playerId => {
      const player = team.players.find(p => p.id === playerId);
      if (player?.contract) salaryChange -= player.contract.amount;
    });
    
    const currentPayroll = team.players.reduce((sum, p) => sum + (p.contract?.amount || 0), 0);
    const newPayroll = currentPayroll + salaryChange;
    
    if (newPayroll > SALARY_CAP) {
      return { legal: false, reason: 'Trade would exceed hard salary cap' };
    }
  }
  
  return { legal: true, reason: '' };
}

/**
 * Generate trade block for a team (available, untouchable, asking prices)
 * @param {Object} team - Team to generate block for
 * @returns {Object} {available: [], untouchable: [], askingPrices: {}}
 */
function generateTradeBlock(team) {
  if (!team || !team.players) {
    return { available: [], untouchable: [], askingPrices: {} };
  }
  
  const timeline = classifyTeamTimeline(team);
  const sortedByValue = [...team.players]
    .map(p => ({ player: p, value: calculatePlayerTradeValue(p, team) }))
    .sort((a, b) => b.value - a.value);
  
  const available = [];
  const untouchable = [];
  const askingPrices = {};
  
  sortedByValue.forEach(({ player, value }, index) => {
    // Top player is usually untouchable unless rebuilding
    if (index === 0 && timeline !== TEAM_TIMELINE.REBUILD) {
      untouchable.push(player.id);
      return;
    }
    
    // Top 2-3 players untouchable for contenders
    if (index <= 2 && timeline === TEAM_TIMELINE.CONTENDER) {
      untouchable.push(player.id);
      return;
    }
    
    // Everyone is available for rebuilders
    // Aging veterans especially available
    if (timeline === TEAM_TIMELINE.REBUILD || player.age >= 30 || value < 30) {
      available.push(player.id);
      // Asking price is slightly inflated
      askingPrices[player.id] = Math.round(value * 1.15);
    } else {
      // Mid-tier players available but expensive
      available.push(player.id);
      askingPrices[player.id] = Math.round(value * 1.3);
    }
  });
  
  return { available, untouchable, askingPrices };
}

/**
 * Trade offer templates
 */
const TRADE_TEMPLATES = {
  UPGRADE_2FOR1: 'upgrade_2for1',        // Trade 2 okay players for 1 better player
  VETERAN_FOR_PICKS: 'veteran_for_picks', // Sell aging vet for draft capital
  SALARY_DUMP: 'salary_dump',            // Dump bad contract + sweetener for cap space
  SWAP_SURPLUSES: 'swap_surpluses',      // Swap players at positions of surplus/need
  STAR_FOR_PACKAGE: 'star_for_package'   // Trade star for multiple good pieces
};

/**
 * Generate trade offers from a buying team to potential sellers
 * @param {Object} buyingTeam - Team looking to acquire assets
 * @param {number} maxOffers - Maximum offers to generate (5-20)
 * @returns {Array} Array of trade offer objects
 */
function generateTradeOffers(buyingTeam, maxOffers = 10) {
  if (!buyingTeam || !league?.teams) return [];
  
  const offers = [];
  const buyerTimeline = classifyTeamTimeline(buyingTeam);
  const buyerBlock = generateTradeBlock(buyingTeam);
  
  // Identify buyer's needs and surpluses
  const buyerNeeds = identifyTeamNeeds(buyingTeam);
  const buyerSurplus = identifyTeamSurplus(buyingTeam);
  
  // Find potential trade partners
  const otherTeams = league.teams.filter(t => t.id !== buyingTeam.id);
  
  otherTeams.forEach(sellerTeam => {
    if (offers.length >= maxOffers) return;
    
    const sellerTimeline = classifyTeamTimeline(sellerTeam);
    const sellerBlock = generateTradeBlock(sellerTeam);
    
    // Generate 1-3 offers per partner based on template matching
    const partnerOffers = [];
    
    // Template 1: UPGRADE_2FOR1 (contenders consolidating talent)
    if (buyerTimeline === TEAM_TIMELINE.CONTENDER && sellerBlock.available.length >= 1) {
      const upgrade = tryUpgrade2For1(buyingTeam, sellerTeam, buyerBlock, sellerBlock);
      if (upgrade) partnerOffers.push(upgrade);
    }
    
    // Template 2: VETERAN_FOR_PICKS (rebuilders selling vets)
    if (buyerTimeline === TEAM_TIMELINE.CONTENDER && sellerTimeline === TEAM_TIMELINE.REBUILD) {
      const vetDeal = tryVeteranForPicks(buyingTeam, sellerTeam, buyerBlock, sellerBlock);
      if (vetDeal) partnerOffers.push(vetDeal);
    }
    
    // Template 3: SWAP_SURPLUSES (mutual fit trades)
    if (buyerSurplus.length > 0) {
      const swap = trySwapSurpluses(buyingTeam, sellerTeam, buyerSurplus, buyerNeeds);
      if (swap) partnerOffers.push(swap);
    }
    
    // Template 4: STAR_FOR_PACKAGE (rebuilders breaking up stars)
    if (sellerTimeline === TEAM_TIMELINE.REBUILD && buyerTimeline === TEAM_TIMELINE.CONTENDER) {
      const starDeal = tryStarForPackage(buyingTeam, sellerTeam, buyerBlock, sellerBlock);
      if (starDeal) partnerOffers.push(starDeal);
    }
    
    // Add partner offers to main list
    offers.push(...partnerOffers.slice(0, 2)); // Max 2 offers per partner
  });
  
  return offers.slice(0, maxOffers);
}

/**
 * Identify team needs by position/role
 * @param {Object} team - Team to analyze
 * @returns {Array} Array of needed positions ['PG', 'C', etc]
 */
function identifyTeamNeeds(team) {
  if (!team?.players) return [];
  
  const needs = [];
  const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
  
  positions.forEach(pos => {
    const atPosition = team.players.filter(p => p.pos === pos);
    const avgOvr = atPosition.length > 0 
      ? atPosition.reduce((sum, p) => sum + p.ratings.ovr, 0) / atPosition.length 
      : 0;
    
    // Need if weak or lacking depth
    if (avgOvr < 65 || atPosition.length < 2) {
      needs.push(pos);
    }
  });
  
  return needs;
}

/**
 * Identify team surplus positions
 * @param {Object} team - Team to analyze
 * @returns {Array} Array of surplus positions
 */
function identifyTeamSurplus(team) {
  if (!team?.players) return [];
  
  const surplus = [];
  const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
  
  positions.forEach(pos => {
    const atPosition = team.players.filter(p => p.pos === pos);
    
    // Surplus if >3 players at position with avg OVR > 65
    if (atPosition.length > 3) {
      const avgOvr = atPosition.reduce((sum, p) => sum + p.ratings.ovr, 0) / atPosition.length;
      if (avgOvr > 65) {
        surplus.push(pos);
      }
    }
  });
  
  return surplus;
}

/**
 * Template: Upgrade 2-for-1 (trade 2 decent players for 1 better player)
 */
function tryUpgrade2For1(buyer, seller, buyerBlock, sellerBlock) {
  const availableSellers = sellerBlock.available
    .map(id => seller.players.find(p => p.id === id))
    .filter(p => p && p.ratings.ovr >= 75)
    .sort((a, b) => b.ratings.ovr - a.ratings.ovr);
  
  if (availableSellers.length === 0) return null;
  
  const target = availableSellers[0];
  const targetValue = calculatePlayerTradeValue(target, seller);
  
  // Find 2 buyers that combine to match value
  const buyerPlayers = buyer.players
    .filter(p => buyerBlock.available.includes(p.id))
    .sort((a, b) => b.ratings.ovr - a.ratings.ovr);
  
  for (let i = 0; i < buyerPlayers.length - 1; i++) {
    for (let j = i + 1; j < buyerPlayers.length; j++) {
      const p1 = buyerPlayers[i];
      const p2 = buyerPlayers[j];
      const combinedValue = calculatePlayerTradeValue(p1, buyer) + calculatePlayerTradeValue(p2, buyer);
      
      // Check if values roughly match (within 20%)
      if (Math.abs(combinedValue - targetValue) <= targetValue * 0.2) {
        return {
          template: TRADE_TEMPLATES.UPGRADE_2FOR1,
          teamAId: buyer.id,
          teamBId: seller.id,
          teamAAssets: { players: [], picks: [] },
          teamBAssets: { players: [p1.id, p2.id], picks: [] },
          description: `${buyer.name} upgrades: ${p1.name} + ${p2.name} for ${target.name}`
        };
      }
    }
  }
  
  return null;
}

/**
 * Template: Veteran for picks (rebuilder sells vet for draft capital)
 */
function tryVeteranForPicks(buyer, seller, buyerBlock, sellerBlock) {
  // Find veteran on seller
  const vets = sellerBlock.available
    .map(id => seller.players.find(p => p.id === id))
    .filter(p => p && p.age >= 28 && p.ratings.ovr >= 72)
    .sort((a, b) => b.ratings.ovr - a.ratings.ovr);
  
  if (vets.length === 0 || !league.draftPicks) return null;
  
  const vet = vets[0];
  const vetValue = calculatePlayerTradeValue(vet, seller);
  
  // Find picks buyer can offer
  const buyerPicks = league.draftPicks.filter(p => p.currentOwner === buyer.id);
  if (buyerPicks.length === 0) return null;
  
  // Try to match value with picks
  const firstRoundPicks = buyerPicks.filter(p => p.round === 1);
  if (firstRoundPicks.length > 0) {
    const pick = firstRoundPicks[0];
    const pickValue = calculatePickTradeValue(pick);
    
    // If pick alone is close to vet value, offer it
    if (Math.abs(pickValue - vetValue) <= 15) {
      return {
        template: TRADE_TEMPLATES.VETERAN_FOR_PICKS,
        teamAId: buyer.id,
        teamBId: seller.id,
        teamAAssets: { players: [vet.id], picks: [] },
        teamBAssets: { players: [], picks: [pick.id] },
        description: `${seller.name} rebuilds: ${vet.name} for draft pick`
      };
    }
  }
  
  return null;
}

/**
 * Template: Swap surpluses (trade from strength to fill weakness)
 */
function trySwapSurpluses(buyer, seller, buyerSurplus, buyerNeeds) {
  if (buyerSurplus.length === 0 || buyerNeeds.length === 0) return null;
  
  const sellerNeeds = identifyTeamNeeds(seller);
  const sellerSurplus = identifyTeamSurplus(seller);
  
  // Find mutual fit: buyer's surplus = seller's need AND seller's surplus = buyer's need
  for (const buyerSurplusPos of buyerSurplus) {
    if (sellerNeeds.includes(buyerSurplusPos)) {
      for (const buyerNeedPos of buyerNeeds) {
        if (sellerSurplus.includes(buyerNeedPos)) {
          // Found mutual fit! Find players to swap
          const buyerOffer = buyer.players
            .filter(p => p.pos === buyerSurplusPos)
            .sort((a, b) => b.ratings.ovr - a.ratings.ovr)[0];
          
          const sellerOffer = seller.players
            .filter(p => p.pos === buyerNeedPos)
            .sort((a, b) => b.ratings.ovr - a.ratings.ovr)[0];
          
          if (buyerOffer && sellerOffer) {
            return {
              template: TRADE_TEMPLATES.SWAP_SURPLUSES,
              teamAId: buyer.id,
              teamBId: seller.id,
              teamAAssets: { players: [sellerOffer.id], picks: [] },
              teamBAssets: { players: [buyerOffer.id], picks: [] },
              description: `Swap surpluses: ${buyerOffer.name} (${buyerOffer.pos}) for ${sellerOffer.name} (${sellerOffer.pos})`
            };
          }
        }
      }
    }
  }
  
  return null;
}

/**
 * Template: Star for package (rebuilder trades star for multiple pieces)
 */
function tryStarForPackage(buyer, seller, buyerBlock, sellerBlock) {
  // Find star on seller
  const stars = seller.players
    .filter(p => p.ratings.ovr >= 80 && sellerBlock.available.includes(p.id))
    .sort((a, b) => b.ratings.ovr - a.ratings.ovr);
  
  if (stars.length === 0) return null;
  
  const star = stars[0];
  const starValue = calculatePlayerTradeValue(star, seller);
  
  // Build package from buyer (2-3 players + pick)
  const buyerPlayers = buyer.players
    .filter(p => buyerBlock.available.includes(p.id) && p.ratings.ovr >= 65 && p.ratings.ovr < 80)
    .sort((a, b) => b.ratings.ovr - a.ratings.ovr);
  
  if (buyerPlayers.length < 2) return null;
  
  const p1 = buyerPlayers[0];
  const p2 = buyerPlayers[1];
  let packageValue = calculatePlayerTradeValue(p1, buyer) + calculatePlayerTradeValue(p2, buyer);
  
  const playerIds = [p1.id, p2.id];
  const pickIds = [];
  
  // Add pick if needed to balance
  if (packageValue < starValue * 0.8 && league.draftPicks) {
    const buyerPicks = league.draftPicks.filter(p => p.currentOwner === buyer.id && p.round === 1);
    if (buyerPicks.length > 0) {
      const pick = buyerPicks[0];
      packageValue += calculatePickTradeValue(pick);
      pickIds.push(pick.id);
    }
  }
  
  // Check if package is reasonable
  if (Math.abs(packageValue - starValue) <= starValue * 0.25) {
    return {
      template: TRADE_TEMPLATES.STAR_FOR_PACKAGE,
      teamAId: buyer.id,
      teamBId: seller.id,
      teamAAssets: { players: [star.id], picks: [] },
      teamBAssets: { players: playerIds, picks: pickIds },
      description: `${seller.name} rebuilds: ${star.name} for package`
    };
  }
  
  return null;
}

/**
 * Negotiate trade offer (1-3 step negotiation)
 * If rejected, try adding small asset or adjusting salary filler
 * @param {Object} offer - Initial trade offer
 * @param {number} sellerTeamId - Team receiving the offer
 * @param {number} maxSteps - Maximum negotiation steps (1-3)
 * @returns {Object} {accepted: boolean, finalOffer: Object, steps: Array}
 */
function negotiateTrade(offer, sellerTeamId, maxSteps = 3) {
  const steps = [];
  let currentOffer = { ...offer };
  
  for (let step = 1; step <= maxSteps; step++) {
    // Evaluate current offer
    const evaluation = evaluateTradeForTeam(currentOffer, sellerTeamId);
    
    steps.push({
      step,
      offer: { ...currentOffer },
      evaluation: { ...evaluation }
    });
    
    // If accepted, we're done
    if (evaluation.accept) {
      return {
        accepted: true,
        finalOffer: currentOffer,
        steps,
        reasoning: evaluation.reasoning
      };
    }
    
    // If this was the last step, reject
    if (step === maxSteps) {
      return {
        accepted: false,
        finalOffer: currentOffer,
        steps,
        reasoning: evaluation.reasoning
      };
    }
    
    // Try to sweeten the deal
    const sweetened = sweetenOffer(currentOffer, evaluation);
    if (!sweetened) {
      // Can't improve offer, reject
      return {
        accepted: false,
        finalOffer: currentOffer,
        steps,
        reasoning: 'Could not improve offer enough'
      };
    }
    
    currentOffer = sweetened;
  }
  
  return {
    accepted: false,
    finalOffer: currentOffer,
    steps,
    reasoning: 'Max negotiation steps reached'
  };
}

/**
 * Sweeten trade offer by adding small asset
 * @param {Object} offer - Current offer
 * @param {Object} evaluation - Evaluation showing why it was rejected
 * @returns {Object|null} Improved offer or null if can't improve
 */
function sweetenOffer(offer, evaluation) {
  const buyerTeamId = offer.teamAId;
  const buyerTeam = league.teams.find(t => t.id === buyerTeamId);
  
  if (!buyerTeam) return null;
  
  const currentBuyerAssets = offer.teamBAssets; // What buyer is giving
  
  // Try adding a second-round pick
  if (league.draftPicks) {
    const availablePicks = league.draftPicks.filter(p => 
      p.currentOwner === buyerTeamId && 
      p.round === 2 &&
      !currentBuyerAssets.picks.includes(p.id)
    );
    
    if (availablePicks.length > 0) {
      return {
        ...offer,
        teamBAssets: {
          players: [...currentBuyerAssets.players],
          picks: [...currentBuyerAssets.picks, availablePicks[0].id]
        }
      };
    }
  }
  
  // Try adding a low-value player as salary filler
  const availablePlayers = buyerTeam.players
    .filter(p => 
      !currentBuyerAssets.players.includes(p.id) &&
      p.ratings.ovr < 65
    )
    .sort((a, b) => a.ratings.ovr - b.ratings.ovr);
  
  if (availablePlayers.length > 0) {
    return {
      ...offer,
      teamBAssets: {
        players: [...currentBuyerAssets.players, availablePlayers[0].id],
        picks: [...currentBuyerAssets.picks]
      }
    };
  }
  
  return null; // Can't improve
}

/**
 * Main AI trade processing - called periodically during season
 * Generates and processes trades based on frequency settings
 */
function processAITrades() {
  if (!league?.teams || !league.settings) return;
  
  const settings = league.settings;
  const frequency = settings.aiTradeFrequency || 'Normal';
  
  // Determine how many teams attempt trades based on frequency
  let tradeAttempts = 0;
  switch (frequency) {
    case 'Very High': tradeAttempts = 8; break;
    case 'High': tradeAttempts = 5; break;
    case 'Normal': tradeAttempts = 3; break;
    case 'Low': tradeAttempts = 1; break;
    default: tradeAttempts = 3;
  }
  
  // Randomly select teams to initiate trades
  const shuffled = [...league.teams].sort(() => Math.random() - 0.5);
  const initiators = shuffled.slice(0, tradeAttempts);
  
  let tradesExecuted = 0;
  
  initiators.forEach(team => {
    // Generate trade offers
    const offers = generateTradeOffers(team, 10);
    
    if (offers.length === 0) return;
    
    // Try each offer with negotiation
    for (const offer of offers) {
      if (tradesExecuted >= tradeAttempts) break;
      
      const negotiation = negotiateTrade(offer, offer.teamBId, 2);
      
      if (negotiation.accepted) {
        // Execute the trade
        const result = executeTrade(negotiation.finalOffer);
        
        if (result.success) {
          tradesExecuted++;
          
          if (settings.aiTradeLogging) {
            console.log(`[AI Trade] Trade executed: ${offer.description}`);
            console.log(`[AI Trade] ${negotiation.reasoning}`);
          }
          
          // Log to history
          if (!league.history) league.history = {};
          if (!league.history.transactionLog) league.history.transactionLog = [];
          
          league.history.transactionLog.push({
            type: 'trade',
            date: league.meta?.day || 0,
            season: league.meta?.season || league.season,
            teams: [offer.teamAId, offer.teamBId],
            description: offer.description,
            reasoning: negotiation.reasoning
          });
          
          break; // Only execute one trade per team per cycle
        }
      }
    }
  });
  
  if (tradesExecuted > 0 && settings.aiTradeLogging) {
    console.log(`[AI Trade] Processed ${tradesExecuted} trades this cycle`);
  }
  
  return tradesExecuted;
}

/* ============================
   CENTRALIZED LEAGUE STATE
============================ */

/**
 * leagueState - The single source of truth for all league data
 * 
 * Rules:
 * - UI components READ ONLY from this state
 * - All mutations through dedicated update functions
 * - Persisted to storage on every change
 * - No duplicated state across tabs
 * - No hardcoded team names (e.g., "Free Agent")
 */
let leagueState = null;

/**
 * Initialize empty league state structure
 */
function createEmptyLeagueState() {
  return {
    // League metadata
    meta: {
      leagueId: `league_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: 'My League',
      season: new Date().getFullYear(),
      phase: 'preseason', // preseason, season, playoffs, offseason, draft
      day: 0, // Season day counter (not calendar dates)
      userTeamId: null, // Stable team reference
      commissionerMode: false,
      modified: false,
      hasSeenWelcome: false,
      createdAt: Date.now(),
      lastSaved: Date.now(),
      schemaVersion: CURRENT_SCHEMA_VERSION
    },
    
    // Teams - stable teamId references
    teams: [],
    
    // Players - never store team names as strings
    players: [],
    
    // Schedule - uses season days, not calendar dates
    schedule: {
      games: {}, // { [gameId]: gameObject }
      days: {}, // { [season]: dayArray }
      currentDay: 0
    },
    
    // Draft state - prospects visible even when inactive
    draft: {
      year: new Date().getFullYear(),
      rounds: 2,
      prospects: [],
      order: [],
      picks: [],
      active: false,
      currentRound: 1,
      currentPick: 1
    },
    
    // Free agents - uses null teamId, not "Free Agent" string
    freeAgents: [],
    
    // Settings - apply to both new and existing leagues
    settings: {
      // League structure
      conferencesEnabled: true,
      divisionsEnabled: true,
      playoffTeams: 16,
      playInTournament: false,
      
      // Season format
      gamesPerSeason: 82,
      backToBackFrequency: 'Normal',
      allStarBreak: true,
      
      // Salary cap & economy
      capSystem: 'soft', // 'hard' or 'soft'
      salaryCap: 123.5, // in millions
      capGrowthRate: 3, // percentage
      luxuryTax: true,
      luxuryTaxLine: 150, // in millions
      apronEnabled: false,
      minRosterSize: 13,
      maxRosterSize: 15,
      
      // Contracts & free agency
      maxContractYears: 5,
      playerOptions: true,
      teamOptions: true,
      restrictedFA: true,
      noTradeClauses: true,
      signAndTrade: true,
      
      // Draft
      draftRounds: 2,
      lotterySystem: 'NBA', // 'NBA', 'Simple', 'Flat'
      prospectClassSize: 60,
      autoDraftClasses: true,
      
      // Gameplay & simulation
      injuryFrequency: 'Normal', // 'Low', 'Normal', 'High'
      injurySeverity: 'Normal',
      fatigueImpact: 'Normal',
      statEnvironment: 'Modern', // 'Modern', 'Realistic', 'High Scoring', 'Low Scoring'
      playerDevelopment: 'Normal', // 'Slow', 'Normal', 'Fast', 'Realistic'
      playerAging: 'Normal', // 'Slow', 'Normal', 'Fast'
      
      // AI & difficulty
      aiTradeLogic: 'Normal', // 'Low', 'Normal', 'High'
      aiContractIntelligence: 'Normal',
      aiTankingBehavior: 'Realistic', // 'Minimal', 'Realistic', 'Aggressive'
      fogOfWar: false,
      
      // Immersion
      newsFrequency: 'Normal',
      moraleSystem: true,
      rivalries: true,
      
      // Player gender
      playerGenderMode: 'men', // 'men', 'women', 'mixed'
      mixedGenderRatio: 0.5, // 0.0 = all men, 1.0 = all women (only used when mixed)
      lockGenderEditing: true, // Prevent gender editing unless commissioner mode
      
      // Rating distribution
      ratingProfile: 'balanced', // 'balanced', 'star_league'
      
      // Job Security & Firing (OFF by default)
      enableJobSecurity: false,
      jobSecurityDifficulty: 'realistic', // 'forgiving', 'realistic', 'ruthless'
      allowMidseasonFiring: false,
      
      // Preseason (OFF by default)
      enablePreseason: false,
      preseasonGames: 2, // 2 or 4 preseason games per team
      preseasonRosterLimit: 20, // Max players during preseason (regular season uses maxRosterSize)
      preseasonInjuryReduction: 0.5, // 50% reduction in injury rate
      preseasonFatigueReduction: 0.6, // 40% reduction in fatigue impact
      preseasonDevelopmentBoost: 1.5, // 50% faster uncertainty reduction
      
      // Phase Rules (transaction restrictions by phase)
      allowTradesInPreseason: false, // Allow trades during preseason
      allowSigningsInPlayoffs: false, // Allow free agent signings during playoffs
      allowWaiversInPlayoffs: false, // Allow waivers during playoffs
      allowSigningsDuringAllStar: false, // Allow FA signings during All-Star Break
      allowWaiversDuringAllStar: false, // Allow waivers during All-Star Break
      tradeDeadlineDay: null, // Null = auto-calculate at 60% of season
      
      // AI Trade Logic Settings
      aiTradeFrequency: 'Normal', // 'Low', 'Normal', 'High', 'Very High'
      aiStinginess: 50, // 0-100, how much extra value AI demands (higher = harder to trade with)
      aiValueNoise: 15, // 0-100, randomness in value calculations (prevents exploit patterns)
      aiContenderBias: 1.2, // Multiplier for how much contenders overvalue win-now players
      aiRebuilderBias: 1.3, // Multiplier for how much rebuilders overvalue picks/youth
      aiTradeLogging: true // Log trade reasoning for debugging
    },
    
    // Migration tracking - prevents re-running one-time migrations
    migrations: {
      ratingProfileApplied: false,
      ratingProfileVersion: null,
      talentUpgradeApplied: false,
      coachOvrAdded: false
    },
    
    // History & records
    history: {
      seasons: {}, // { [year]: seasonData }
      championsByYear: [],
      awardsByYear: {},
      draftsByYear: {},
      records: {
        team: [],
        player: []
      },
      transactionLog: [],
      commissionerLog: [],
      startYear: new Date().getFullYear()
    },
    
    // Expansion state
    expansion: {
      active: false,
      year: null,
      teams: [],
      draftPool: [],
      protectionRules: {}
    },
    
    // Job Security & Career (only active when enableJobSecurity === true)
    jobSecurity: 75, // 0-100 scale
    careerHistory: [], // Array of career entries { teamId, years, record, exitType }
    ownerProfiles: {}, // { [teamId]: ownerProfile }
    seasonExpectations: [] // Current season expectations for user team
  };
}

/**
 * State mutation functions - ONLY way to modify leagueState
 */

// Update league phase
function updateLeaguePhase(newPhase) {
  if (!leagueState) return;
  leagueState.meta.phase = newPhase;
  leagueState.meta.lastSaved = Date.now();
  persistLeagueState();
}

// Advance season day
function advanceDay() {
  if (!leagueState) return;
  leagueState.meta.day++;
  leagueState.meta.lastSaved = Date.now();
  saveLeagueState();
  return leagueState.meta.day;
}

// Update user's selected team
function setUserTeam(teamId) {
  if (!leagueState) return;
  const team = leagueState.teams.find(t => t.id === teamId);
  if (!team) {
    console.error('setUserTeam: Invalid team ID', teamId);
    return;
  }
  leagueState.meta.userTeamId = teamId;
  leagueState.meta.lastSaved = Date.now();
  saveLeagueState();
}

// Toggle commissioner mode
function setCommissionerMode(enabled) {
  if (!leagueState) return;
  leagueState.meta.commissionerMode = enabled;
  leagueState.meta.modified = enabled ? true : leagueState.meta.modified;
  leagueState.meta.lastSaved = Date.now();
  persistLeagueState();
}

// Log commissioner action
function logCommissionerAction(actionType, details) {
  if (!leagueState || !leagueState.meta.commissionerMode) return;
  
  if (!leagueState.history.commissionerLog) {
    leagueState.history.commissionerLog = [];
  }
  
  leagueState.history.commissionerLog.push({
    timestamp: Date.now(),
    season: leagueState.meta.season,
    day: leagueState.meta.day,
    phase: leagueState.meta.phase,
    actionType,
    details
  });
  
  persistLeagueState();
}

// Persist leagueState to storage
function persistLeagueState() {
  if (!leagueState) return;
  
  // Update legacy 'league' variable for backwards compatibility
  league = convertLeagueStateToLegacy(leagueState);
  
  // Save to storage
  save();
}

// Convert leagueState to legacy league format
function convertLeagueStateToLegacy(state) {
  if (!state) return null;
  
  return {
    id: state.meta.leagueId,
    name: state.meta.name,
    season: state.meta.season,
    phase: state.meta.phase,
    teams: state.teams,
    freeAgents: state.freeAgents,
    history: state.history,
    draftClass: state.draft.prospects,
    draftPicks: state.draft.picks,
    draftProspects: state.draft.prospects,
    expansion: state.expansion,
    schedule: state.schedule,
    schemaVersion: state.meta.schemaVersion,
    userTid: state.meta.userTeamId,
    meta: {
      hasSeenWelcome: state.meta.hasSeenWelcome,
      settings: state.settings,
      commissionerEnabled: state.meta.commissionerMode,
      modified: state.meta.modified
    }
  };
}

// Convert legacy league to leagueState
function convertLegacyToLeagueState(legacyLeague) {
  if (!legacyLeague) return null;
  
  const state = createEmptyLeagueState();
  
  // Migrate meta
  state.meta.leagueId = legacyLeague.id || state.meta.leagueId;
  state.meta.name = legacyLeague.name || state.meta.name;
  state.meta.season = legacyLeague.season || state.meta.season;
  state.meta.phase = legacyLeague.phase || state.meta.phase;
  state.meta.userTeamId = legacyLeague.userTid || null;
  state.meta.schemaVersion = legacyLeague.schemaVersion || CURRENT_SCHEMA_VERSION;
  state.meta.hasSeenWelcome = legacyLeague.meta?.hasSeenWelcome || false;
  state.meta.commissionerMode = legacyLeague.meta?.commissionerEnabled || false;
  state.meta.modified = legacyLeague.meta?.modified || false;
  
  // Migrate settings
  if (legacyLeague.meta?.settings) {
    state.settings = { ...state.settings, ...legacyLeague.meta.settings };
  }
  
  // Migrate teams
  state.teams = legacyLeague.teams || [];
  
  // Migrate players (all players from teams + free agents)
  state.players = [];
  if (legacyLeague.teams) {
    legacyLeague.teams.forEach(team => {
      if (team.players) {
        team.players.forEach(player => {
          player.teamId = team.id; // Ensure stable team reference
          
          // Migrate gender: assign default if missing
          if (!player.gender) {
            const genderMode = state.settings.playerGenderMode || 'men';
            if (genderMode === 'men') {
              player.gender = 'M';
            } else if (genderMode === 'women') {
              player.gender = 'F';
            } else {
              // Mixed - random based on ratio
              const ratio = state.settings.mixedGenderRatio || 0.5;
              player.gender = Math.random() < ratio ? 'F' : 'M';
            }
          }
          
          // Migrate body measurements: generate if missing
          if (!player.bio || !player.bio.heightInches || !player.bio.wingspanInches || !player.bio.weightLbs) {
            const body = generatePlayerBody(player.pos, player.gender);
            
            if (!player.bio) {
              player.bio = {};
            }
            
            // Only replace missing measurements
            if (!player.bio.heightInches) {
              player.bio.height = body.height;
              player.bio.heightInches = body.heightInches;
            }
            if (!player.bio.wingspanInches) {
              player.bio.wingspan = body.wingspan;
              player.bio.wingspanInches = body.wingspanInches;
            }
            if (!player.bio.weightLbs) {
              player.bio.weight = body.weight;
              player.bio.weightLbs = body.weightLbs;
            }
          }
          
          state.players.push(player);
        });
      }
    });
  }
  
  // Migrate free agents
  state.freeAgents = legacyLeague.freeAgents || [];
  state.freeAgents.forEach(player => {
    player.teamId = null; // Free agents have null teamId
    
    // Migrate gender: assign default if missing
    if (!player.gender) {
      const genderMode = state.settings.playerGenderMode || 'men';
      if (genderMode === 'men') {
        player.gender = 'M';
      } else if (genderMode === 'women') {
        player.gender = 'F';
      } else {
        // Mixed - random based on ratio
        const ratio = state.settings.mixedGenderRatio || 0.5;
        player.gender = Math.random() < ratio ? 'F' : 'M';
      }
    }
    
    // Migrate body measurements: generate if missing
    if (!player.bio || !player.bio.heightInches || !player.bio.wingspanInches || !player.bio.weightLbs) {
      const body = generatePlayerBody(player.pos, player.gender);
      
      if (!player.bio) {
        player.bio = {};
      }
      
      // Only replace missing measurements
      if (!player.bio.heightInches) {
        player.bio.height = body.height;
        player.bio.heightInches = body.heightInches;
      }
      if (!player.bio.wingspanInches) {
        player.bio.wingspan = body.wingspan;
        player.bio.wingspanInches = body.wingspanInches;
      }
      if (!player.bio.weightLbs) {
        player.bio.weight = body.weight;
        player.bio.weightLbs = body.weightLbs;
      }
    }
    
    state.players.push(player);
  });
  
  // Migrate schedule
  state.schedule = legacyLeague.schedule || state.schedule;
  
  // Migrate draft
  state.draft.prospects = legacyLeague.draftProspects || legacyLeague.draftClass || [];
  state.draft.picks = legacyLeague.draftPicks || [];
  state.draft.year = legacyLeague.season || state.draft.year;
  
  // Migrate history
  state.history = legacyLeague.history || state.history;
  
  // Migrate expansion
  state.expansion = legacyLeague.expansion || state.expansion;
  
  return state;
}

// Draft Configuration
const DRAFT_PROSPECT_POOL_SIZE = 120;

// Schedule Configuration
const GAMES_PER_SEASON = 82;

function calculateSeasonDays(gamesPerTeam) {
  // Formula: seasonDays = round(gamesPerTeam × 2.12)
  // Accounts for rest days, back-to-backs, and realistic scheduling
  return Math.round(gamesPerTeam * 2.12);
}

/* ============================
   REALISTIC BODY GENERATION
============================ */

// Box-Muller transform for generating normally distributed random numbers
function normalRandom(mean, stdDev) {
  let u1 = 0, u2 = 0;
  while (u1 === 0) u1 = Math.random(); // Converting [0,1) to (0,1)
  while (u2 === 0) u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

// Body generation profiles by position and gender
const BODY_PROFILES = {
  M: {
    PG: {
      height: { mean: 74.5, sd: 2, min: 70, max: 79 },
      ape: { mean: 2.0, sd: 1.5, min: -1, max: 6 },
      weight: { base: 185, heightMean: 74.5, slope: 6, sd: 10, min: 160, max: 215 },
      bulk: { mean: 0.0333, sd: 0.0020 } // weight / (height^2)
    },
    SG: {
      height: { mean: 76.5, sd: 2, min: 72, max: 81 },
      ape: { mean: 2.5, sd: 1.7, min: 0, max: 7 },
      weight: { base: 200, heightMean: 76.5, slope: 6, sd: 12, min: 170, max: 235 },
      bulk: { mean: 0.0342, sd: 0.0022 }
    },
    SF: {
      height: { mean: 79, sd: 2.2, min: 75, max: 84 },
      ape: { mean: 3.0, sd: 2, min: 0, max: 8 },
      weight: { base: 220, heightMean: 79, slope: 7, sd: 14, min: 190, max: 260 },
      bulk: { mean: 0.0353, sd: 0.0024 }
    },
    PF: {
      height: { mean: 81.5, sd: 2.2, min: 78, max: 86 },
      ape: { mean: 3.5, sd: 2, min: 1, max: 9 },
      weight: { base: 240, heightMean: 81.5, slope: 7.5, sd: 15, min: 210, max: 280 },
      bulk: { mean: 0.0361, sd: 0.0025 }
    },
    C: {
      height: { mean: 83.5, sd: 2.3, min: 80, max: 89 },
      ape: { mean: 4.0, sd: 2.2, min: 1, max: 10 },
      weight: { base: 255, heightMean: 83.5, slope: 8, sd: 18, min: 225, max: 305 },
      bulk: { mean: 0.0366, sd: 0.0027 }
    }
  },
  F: {
    PG: {
      height: { mean: 69.5, sd: 1.8, min: 65, max: 74 },
      ape: { mean: 1.5, sd: 1.3, min: -1, max: 5 },
      weight: { base: 145, heightMean: 69.5, slope: 5, sd: 9, min: 120, max: 175 },
      bulk: { mean: 0.0300, sd: 0.0018 }
    },
    SG: {
      height: { mean: 71, sd: 1.8, min: 67, max: 76 },
      ape: { mean: 2.0, sd: 1.4, min: 0, max: 6 },
      weight: { base: 155, heightMean: 71, slope: 5.5, sd: 10, min: 130, max: 190 },
      bulk: { mean: 0.0308, sd: 0.0020 }
    },
    SF: {
      height: { mean: 72.5, sd: 2, min: 68, max: 78 },
      ape: { mean: 2.5, sd: 1.6, min: 0, max: 7 },
      weight: { base: 170, heightMean: 72.5, slope: 6, sd: 12, min: 145, max: 215 },
      bulk: { mean: 0.0323, sd: 0.0022 }
    },
    PF: {
      height: { mean: 74.5, sd: 2, min: 70, max: 80 },
      ape: { mean: 3.0, sd: 1.8, min: 1, max: 8 },
      weight: { base: 185, heightMean: 74.5, slope: 6.5, sd: 13, min: 160, max: 235 },
      bulk: { mean: 0.0333, sd: 0.0024 }
    },
    C: {
      height: { mean: 76.5, sd: 2.1, min: 72, max: 82 },
      ape: { mean: 3.5, sd: 2.0, min: 1, max: 9 },
      weight: { base: 200, heightMean: 76.5, slope: 7, sd: 14, min: 175, max: 255 },
      bulk: { mean: 0.0341, sd: 0.0025 }
    }
  }
};

// Convert inches to feet-inches string
function inchesToFeetInches(inches) {
  const feet = Math.floor(inches / 12);
  const remainingInches = Math.round(inches % 12);
  return `${feet}'${remainingInches}"`;
}

// Generate realistic body measurements for a player
function generatePlayerBody(position, gender) {
  // Default to male PG if invalid inputs
  const g = (gender === 'F') ? 'F' : 'M';
  const pos = ['PG', 'SG', 'SF', 'PF', 'C'].includes(position) ? position : 'PG';
  
  const profile = BODY_PROFILES[g][pos];
  
  // Generate height using normal distribution, then clamp
  const heightInches = Math.round(
    clamp(
      normalRandom(profile.height.mean, profile.height.sd),
      profile.height.min,
      profile.height.max
    )
  );
  
  // Generate ape index (wingspan - height), then clamp
  const apeIndex = Math.round(
    clamp(
      normalRandom(profile.ape.mean, profile.ape.sd),
      profile.ape.min,
      profile.ape.max
    )
  );
  
  // Calculate wingspan
  const wingspanInches = heightInches + apeIndex;
  
  // Generate weight based on height deviation from mean, then clamp
  const heightDiff = heightInches - profile.weight.heightMean;
  const baseWeight = profile.weight.base + (heightDiff * profile.weight.slope);
  const weightLbs = Math.round(
    clamp(
      normalRandom(baseWeight, profile.weight.sd),
      profile.weight.min,
      profile.weight.max
    )
  );
  
  return {
    heightInches,
    height: inchesToFeetInches(heightInches),
    wingspanInches,
    wingspan: inchesToFeetInches(wingspanInches),
    weightLbs,
    weight: `${weightLbs} lbs`
  };
}

// Calculate body z-scores for attribute adjustments
function calculateBodyZScores(heightInches, wingspanInches, weightLbs, position, gender) {
  const g = (gender === 'F') ? 'F' : 'M';
  const pos = ['PG', 'SG', 'SF', 'PF', 'C'].includes(position) ? position : 'PG';
  const profile = BODY_PROFILES[g][pos];
  
  // Z-score for height
  const zH = (heightInches - profile.height.mean) / profile.height.sd;
  
  // Z-score for wingspan length (ape index)
  const apeIndex = wingspanInches - heightInches;
  const zL = (apeIndex - profile.ape.mean) / profile.ape.sd;
  
  // Z-score for bulk (weight / height^2)
  const bulk = weightLbs / (heightInches * heightInches);
  const zB = (bulk - profile.bulk.mean) / profile.bulk.sd;
  
  return { zH, zL, zB };
}

// Coach Generation
function makeCoach(experience = null) {
  const age = experience !== null ? 35 + experience : rand(35, 65);
  const years = experience !== null ? experience : rand(0, 30);
  
  // Generate ratings (30-90 range)
  const offense = rand(40, 85);
  const defense = rand(40, 85);
  const playerDevelopment = rand(40, 85);
  const management = rand(40, 85);
  const motivation = rand(40, 85);
  const clutch = rand(40, 85);
  const adaptability = rand(40, 85);
  
  // Overall is weighted average
  const overall = Math.round(
    (offense * 1.2 + defense * 1.2 + playerDevelopment * 1.1 + 
     management * 0.9 + motivation * 1.0 + clutch * 0.8 + adaptability * 0.9) / 7.1
  );
  
  // Personality traits (1-10 scale)
  const personality = {
    patience: rand(3, 10),
    intensity: rand(3, 10),
    loyalty: rand(3, 10),
    innovation: rand(3, 10),
    communication: rand(3, 10),
    discipline: rand(3, 10),
    confidence: rand(3, 10)
  };
  
  // Contract
  const salary = calculateCoachSalary(overall);
  const yearsRemaining = rand(2, 5);
  
  return {
    id: `coach_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: randName(),
    age,
    experience: years,
    overall,
    ratings: {
      offense,
      defense,
      playerDevelopment,
      management,
      motivation,
      clutch,
      adaptability
    },
    personality,
    contract: {
      yearsRemaining,
      annualSalary: salary
    },
    careerStats: {
      wins: Math.floor(years * rand(20, 50)),
      losses: Math.floor(years * rand(15, 45)),
      championships: years > 10 ? rand(0, Math.floor(years / 8)) : 0
    }
  };
}

function calculateCoachSalary(overall) {
  if (overall >= 80) return rand(6, 10);
  if (overall >= 70) return rand(4, 6);
  if (overall >= 60) return rand(2.5, 4);
  return rand(1.5, 2.5);
}

// Player Generation
function makePlayer(age, isRookie = false) {
  const id = nextPlayerId++;
  const pos = POS[rand(0, POS.length - 1)];
  
  // Determine gender based on league settings BEFORE name generation
  let gender = 'M'; // Default
  if (leagueState && leagueState.settings) {
    const mode = leagueState.settings.playerGenderMode || 'men';
    if (mode === 'men') {
      gender = 'M';
    } else if (mode === 'women') {
      gender = 'F';
    } else if (mode === 'mixed') {
      const ratio = leagueState.settings.mixedGenderRatio || 0.5;
      gender = Math.random() < ratio ? 'F' : 'M';
    }
  }
  
  // Determine player tier (creates elite tail in distribution)
  const tierRoll = Math.random();
  let tier, targetOvr;
  
  if (tierRoll < 0.02) { // 2% - Elite/Superstar
    tier = 'elite';
    targetOvr = rand(88, 98);
  } else if (tierRoll < 0.08) { // 6% - Star
    tier = 'star';
    targetOvr = rand(80, 90);
  } else if (tierRoll < 0.25) { // 17% - Starter
    tier = 'starter';
    targetOvr = rand(72, 82);
  } else if (tierRoll < 0.60) { // 35% - Role Player
    tier = 'role';
    targetOvr = rand(62, 75);
  } else { // 40% - Bench/Deep Bench
    tier = 'bench';
    targetOvr = rand(45, 65);
  }
  
  // Adjust for rookies (more variance, slightly lower)
  if (isRookie) {
    targetOvr = Math.max(40, targetOvr - rand(3, 10));
  }
  
  // Generate base ratings that achieve target OVR
  const variance = rand(-5, 5);
  const shoot = clamp(targetOvr + variance + rand(-8, 8), 30, 99);
  const defense = clamp(targetOvr + variance + rand(-8, 8), 30, 99);
  const rebound = clamp(targetOvr + variance + rand(-8, 8), 30, 99);
  const passing = clamp(targetOvr + variance + rand(-8, 8), 30, 99);
  
  const ovr = Math.round((shoot + defense + rebound + passing) / 4);
  
  // Calculate potential - elite players have higher upside
  let pot;
  if (isRookie) {
    const upsideBonus = tier === 'elite' ? rand(5, 15) : tier === 'star' ? rand(3, 12) : rand(0, 20);
    pot = clamp(ovr + upsideBonus, ovr, 99);
  } else {
    // Veterans have less upside
    const ageFactor = age <= 25 ? rand(0, 10) : age <= 28 ? rand(-3, 5) : rand(-8, 2);
    pot = clamp(ovr + ageFactor, Math.max(40, ovr - 5), 99);
  }
  
  // Contract based on OVR
  const salary = calculateSalary(ovr);
  const yearsRemaining = rand(1, 4);
  
  // Generate detailed attributes
  const athleticBase = rand(50, 95);
  let detailedAttributes = {
    athletic: {
      speed: clamp(athleticBase + rand(-10, 10), 40, 99),
      acceleration: clamp(athleticBase + rand(-10, 10), 40, 99),
      strength: clamp(rand(50, 90), 40, 99),
      vertical: clamp(athleticBase + rand(-15, 15), 40, 99),
      lateralQuickness: clamp(athleticBase + rand(-10, 10), 40, 99),
      stamina: clamp(rand(60, 95), 40, 99),
      hustle: clamp(rand(50, 90), 40, 99)
    },
    offensive: {
      scoringSkills: {
        finishing: clamp(shoot + rand(-15, 15), 40, 99),
        midRangeShooting: clamp(shoot + rand(-10, 10), 40, 99),
        threePointShooting: clamp(shoot + rand(-20, 20), 40, 99),
        freeThrowShooting: clamp(shoot + rand(-10, 15), 40, 99),
        postScoring: clamp(shoot + rand(-20, 10), 40, 99),
        shotCreation: clamp(shoot + rand(-15, 15), 40, 99)
      },
      playmakingSkills: {
        ballHandling: clamp(passing + rand(-15, 15), 40, 99),
        passingVision: clamp(passing + rand(-10, 10), 40, 99),
        passingAccuracy: clamp(passing + rand(-10, 15), 40, 99),
        offBallMovement: clamp(passing + rand(-10, 10), 40, 99)
      }
    },
    defensive: {
      perimeterDefense: clamp(defense + rand(-10, 10), 40, 99),
      interiorDefense: clamp(defense + rand(-15, 15), 40, 99),
      blockRating: clamp(defense + rand(-15, 15), 40, 99),
      stealRating: clamp(defense + rand(-10, 15), 40, 99),
      defensiveRebounding: clamp(rebound + rand(-10, 10), 40, 99),
      offensiveRebounding: clamp(rebound + rand(-15, 10), 40, 99),
      defensiveAwareness: clamp(defense + rand(-10, 10), 40, 99)
    },
    mental: {
      basketballIQ: clamp(rand(60, 95), 40, 99),
      consistency: clamp(rand(50, 90), 40, 99),
      workEthic: clamp(rand(50, 95), 40, 99),
      leadership: clamp(rand(50, 90), 40, 99),
      composure: clamp(rand(55, 95), 40, 99),
      discipline: clamp(rand(50, 90), 40, 99),
      clutch: clamp(rand(50, 95), 40, 99)
    }
  };
  
  // Generate realistic body measurements based on position and gender
  const body = generatePlayerBody(pos, gender);
  
  // Calculate body z-scores for attribute adjustments
  const { zH, zL, zB } = calculateBodyZScores(
    body.heightInches, 
    body.wingspanInches, 
    body.weightLbs, 
    pos, 
    gender
  );
  
  // Apply body-based attribute biases (scale = 2.5 for typical ±0-8 point effects)
  const scale = 2.5;
  
  // Athletic attributes
  detailedAttributes.athletic.speed += (-0.35 * zH - 0.30 * zB) * scale;
  detailedAttributes.athletic.acceleration += (-0.25 * zH - 0.40 * zB) * scale;
  detailedAttributes.athletic.lateralQuickness += (-0.20 * zH - 0.25 * zB + 0.20 * zL) * scale;
  detailedAttributes.athletic.strength += (0.55 * zB + 0.15 * zH) * scale;
  detailedAttributes.athletic.vertical += (0.35 * zH + 0.15 * zB) * scale; // Dunk proxy
  
  // Offensive attributes
  detailedAttributes.offensive.scoringSkills.finishing += (0.25 * zH + 0.25 * zB) * scale;
  detailedAttributes.offensive.scoringSkills.postScoring += (0.25 * zH + 0.25 * zB) * scale;
  detailedAttributes.offensive.scoringSkills.threePointShooting += (-0.10 * zB) * scale;
  detailedAttributes.offensive.playmakingSkills.ballHandling += (-0.30 * zH - 0.15 * zB) * scale;
  
  // Defensive attributes
  detailedAttributes.defensive.interiorDefense += (0.35 * zH + 0.45 * zL + 0.15 * zB) * scale;
  detailedAttributes.defensive.blockRating += (0.25 * zH + 0.60 * zL) * scale;
  detailedAttributes.defensive.stealRating += (0.40 * zL - 0.10 * zH) * scale;
  detailedAttributes.defensive.defensiveRebounding += (0.25 * zH + 0.25 * zB + 0.20 * zL) * scale;
  detailedAttributes.defensive.offensiveRebounding += (0.25 * zH + 0.25 * zB + 0.20 * zL) * scale;
  
  // Calculate body-based caps
  const maxBlock = clamp(50 + 4 * zH + 6 * zL, 40, 99);
  const maxIntD = clamp(55 + 5 * zH + 5 * zL + 2 * zB, 45, 99);
  const maxReb = clamp(55 + 4 * zH + 3 * zB + 3 * zL, 45, 99);
  const maxHandle = clamp(85 - 4 * zH - 2 * zB, 55, 99);
  const maxSpeed = clamp(90 - 5 * zH - 4 * zB, 55, 99);
  const maxLat = clamp(90 - 4 * zH - 4 * zB + 2 * zL, 55, 99);
  const maxDunk = clamp(50 + 6 * zH + 2 * zB, 35, 99);
  
  // Apply caps to attributes
  detailedAttributes.defensive.blockRating = clamp(detailedAttributes.defensive.blockRating, 1, maxBlock);
  detailedAttributes.defensive.interiorDefense = clamp(detailedAttributes.defensive.interiorDefense, 1, maxIntD);
  detailedAttributes.defensive.defensiveRebounding = clamp(detailedAttributes.defensive.defensiveRebounding, 1, maxReb);
  detailedAttributes.defensive.offensiveRebounding = clamp(detailedAttributes.defensive.offensiveRebounding, 1, maxReb);
  detailedAttributes.offensive.playmakingSkills.ballHandling = clamp(detailedAttributes.offensive.playmakingSkills.ballHandling, 1, maxHandle);
  detailedAttributes.athletic.speed = clamp(detailedAttributes.athletic.speed, 1, maxSpeed);
  detailedAttributes.athletic.lateralQuickness = clamp(detailedAttributes.athletic.lateralQuickness, 1, maxLat);
  detailedAttributes.athletic.vertical = clamp(detailedAttributes.athletic.vertical, 1, maxDunk);
  
  // Adjust potential ceiling based on physical tools
  let potBonus = 0;
  
  // Long wingspan → higher defensive potential ceiling
  if (zL > 1.5) {
    potBonus += Math.min(4, Math.floor(zL * 2));
  }
  
  // Big and strong → higher inside potential ceiling
  if (zH + zB > 2.0) {
    potBonus += Math.min(4, Math.floor((zH + zB) * 1.5));
  }
  
  // Apply potential bonus (doesn't raise OVR, just max growth)
  pot = clamp(pot + potBonus, pot, 99);
  
  // Generate bio data
  const cities = ['Los Angeles, CA', 'New York, NY', 'Chicago, IL', 'Houston, TX', 'Phoenix, AZ', 'Philadelphia, PA', 'San Antonio, TX', 'Dallas, TX', 'Atlanta, GA', 'Miami, FL'];
  const colleges = ['Duke', 'Kentucky', 'North Carolina', 'UCLA', 'Kansas', 'Michigan', 'Villanova', 'Gonzaga', 'Syracuse', 'Louisville', 'None'];
  
  // 80% chance drafted, 20% undrafted
  const isDrafted = Math.random() > 0.2;
  let draftedByTid = null;
  
  if (isDrafted && league && league.teams && league.teams.length > 0) {
    const randomTeam = league.teams[rand(0, league.teams.length - 1)];
    draftedByTid = randomTeam.id;
  }
  
  const bio = {
    height: body.height,
    heightInches: body.heightInches,
    weight: body.weight,
    weightLbs: body.weightLbs,
    wingspan: body.wingspan,
    wingspanInches: body.wingspanInches,
    hometown: cities[rand(0, cities.length - 1)],
    country: 'USA',
    college: colleges[rand(0, colleges.length - 1)]
  };
  
  // Draft data in separate structure
  const draft = isDrafted ? {
    year: league ? league.season - (age - 19) : 2026 - (age - 19),
    round: rand(1, 2),
    pick: rand(1, 30),
    draftedByTid: draftedByTid
  } : {
    year: null,
    round: null,
    pick: null,
    draftedByTid: null
  };
  
  // Generate personality
  const personality = {
    currentSatisfactionPct: rand(50, 90),
    satisfactionLabel: '',
    loyalty: rand(30, 90),
    moneyFocus: rand(30, 90),
    winningDrive: rand(40, 95),
    playingTimeDesire: rand(30, 90),
    teamPlayer: rand(30, 90),
    workEthic: detailedAttributes.mental.workEthic,
    ego: rand(30, 90),
    temperament: rand(35, 90)
  };
  
  // Set satisfaction label
  if (personality.currentSatisfactionPct >= 85) personality.satisfactionLabel = 'Very Happy';
  else if (personality.currentSatisfactionPct >= 70) personality.satisfactionLabel = 'Content';
  else if (personality.currentSatisfactionPct >= 55) personality.satisfactionLabel = 'Neutral';
  else if (personality.currentSatisfactionPct >= 40) personality.satisfactionLabel = 'Unhappy';
  else personality.satisfactionLabel = 'Very Unhappy';
  
  // Generate agent data
  const agentStyles = ['Aggressive', 'Patient', 'Analytical', 'Relationship-Focused', 'Money-First'];
  const agentNames = [
    'Michael Sterling', 'Sarah Chen', 'Marcus Rivera', 'Jennifer Walsh', 'David Kumar',
    'Amanda Foster', 'Robert Thompson', 'Lisa Rodriguez', 'James Anderson', 'Emily Park',
    'Chris Martinez', 'Nicole Johnson', 'Kevin Lee', 'Rachel Davis', 'Tony Williams'
  ];
  
  const agent = {
    name: agentNames[rand(0, agentNames.length - 1)],
    style: agentStyles[rand(0, agentStyles.length - 1)],
    powerRating: rand(50, 95), // Agent's negotiating power
    yearsWithPlayer: rand(1, Math.min(5, age - 18))
  };
  
  // Calculate market value based on OVR and personality
  const baseValue = calculateSalary(ovr);
  const marketStatus = ovr >= 80 ? 'Hot' : ovr >= 65 ? 'Normal' : 'Cold';
  
  return {
    id,
    name: randName(gender), // Pass gender to name generator
    age,
    pos,
    gender, // Store gender in player object
    ratings: {
      ovr,
      pot,
      shoot,
      defense,
      rebound,
      passing
    },
    contract: {
      amount: salary,
      exp: league ? league.season + yearsRemaining : 2026 + yearsRemaining,
      yearsRemaining: yearsRemaining,
      totalValue: salary * yearsRemaining,
      startYear: league ? league.season : 2026,
      hasPlayerOption: false,
      hasTeamOption: false,
      type: 'standard', // 'standard', 'training_camp', 'two_way'
      guaranteed: 100, // % of contract guaranteed (0-100)
      isTrainingCamp: false // Training camp contracts auto-expire before regular season
    },
    seasonStats: {
      gp: 0,
      pts: 0,
      reb: 0,
      ast: 0,
      fgm: 0,
      fga: 0,
      fg3m: 0,
      fg3a: 0,
      stl: 0,
      blk: 0
    },
    bio: bio,
    draft: draft,
    attributes: detailedAttributes,
    personality: personality,
    agent: agent,
    marketValue: {
      min: baseValue * 0.8,
      max: baseValue * 1.3,
      expected: baseValue,
      status: marketStatus
    }
  };
}

function calculateSalary(ovr) {
  if (ovr >= 85) return rand(25, 40);
  if (ovr >= 75) return rand(15, 25);
  if (ovr >= 65) return rand(8, 15);
  if (ovr >= 55) return rand(3, 8);
  return rand(1, 3);
}

/* ============================
   AGENT NEGOTIATION SYSTEM
============================ */

function evaluateContractOffer(player, offer, team) {
  // offer = { years, salary, hasPlayerOption, hasTeamOption }
  // Returns: { accepted: boolean, response: string, counteroffer: object | null }
  
  const p = player;
  const personality = p.personality;
  const agent = p.agent;
  const marketValue = p.marketValue;
  
  // Calculate offer strength (0-100 scale)
  let offerScore = 0;
  
  // 1. Money evaluation (40% weight)
  const salaryRatio = offer.salary / marketValue.expected;
  let moneyScore = 0;
  if (salaryRatio >= 1.2) moneyScore = 100;
  else if (salaryRatio >= 1.1) moneyScore = 90;
  else if (salaryRatio >= 1.0) moneyScore = 75;
  else if (salaryRatio >= 0.9) moneyScore = 60;
  else if (salaryRatio >= 0.8) moneyScore = 40;
  else moneyScore = 20;
  
  offerScore += moneyScore * 0.4;
  
  // 2. Team success evaluation (25% weight)
  const teamWinPct = (team.wins + team.losses) > 0 ? team.wins / (team.wins + team.losses) : 0.5;
  let teamScore = teamWinPct * 100;
  offerScore += teamScore * 0.25 * (personality.winningDrive / 100);
  
  // 3. Contract structure evaluation (20% weight)
  let structureScore = 50; // Neutral base
  if (offer.hasPlayerOption) structureScore += 25; // Players love flexibility
  if (offer.hasTeamOption) structureScore -= 20; // Players dislike uncertainty
  offerScore += structureScore * 0.2;
  
  // 4. Contract length evaluation (15% weight)
  let lengthScore = 50;
  if (p.age >= 30) {
    // Older players prefer longer security
    if (offer.years >= 3) lengthScore = 90;
    else if (offer.years === 2) lengthScore = 60;
    else lengthScore = 30;
  } else {
    // Younger players want flexibility
    if (offer.years <= 2) lengthScore = 80;
    else if (offer.years === 3) lengthScore = 60;
    else lengthScore = 40;
  }
  offerScore += lengthScore * 0.15;
  
  // Agent style modifiers
  switch (agent.style) {
    case 'Aggressive':
      if (salaryRatio < 1.0) offerScore *= 0.9; // Aggressive agents demand market value+
      break;
    case 'Patient':
      offerScore *= 0.85; // Patient agents wait for better deals
      break;
    case 'Money-First':
      offerScore = moneyScore * 0.7 + offerScore * 0.3; // Heavily weight money
      break;
    case 'Relationship-Focused':
      offerScore += teamScore * 0.15; // Boost team fit importance
      break;
  }
  
  // Decision logic
  if (offerScore >= 80) {
    return {
      accepted: true,
      response: `${agent.name}: "${p.name} is excited about this opportunity. We accept your offer!"`,
      counteroffer: null
    };
  } else if (offerScore >= 60) {
    // Generate counteroffer
    const counter = generateCounteroffer(player, offer, offerScore);
    return {
      accepted: false,
      response: `${agent.name}: "We appreciate the offer, but ${p.name} is looking for something slightly different. Here's what we're thinking..."`,
      counteroffer: counter
    };
  } else if (offerScore >= 40) {
    // Firm rejection with reason
    const reason = getRejectionReason(player, offer, salaryRatio);
    return {
      accepted: false,
      response: `${agent.name}: "I'm sorry, but this offer doesn't meet ${p.name}'s needs. ${reason}"`,
      counteroffer: null
    };
  } else {
    // Harsh rejection
    return {
      accepted: false,
      response: `${agent.name}: "This offer is far below market value. We're going to explore other opportunities."`,
      counteroffer: null
    };
  }
}

function generateCounteroffer(player, originalOffer, offerScore) {
  const marketValue = player.marketValue;
  const personality = player.personality;
  
  let counterYears = originalOffer.years;
  let counterSalary = originalOffer.salary;
  let counterPlayerOption = originalOffer.hasPlayerOption;
  let counterTeamOption = originalOffer.hasTeamOption;
  
  // Adjust based on what was lacking
  if (originalOffer.salary < marketValue.expected) {
    // Bump salary to market value or slightly above
    counterSalary = marketValue.expected * rand(1.0, 1.15);
  }
  
  // If no player option, request one
  if (!originalOffer.hasPlayerOption && offerScore < 70) {
    counterPlayerOption = true;
  }
  
  // If team option exists, try to remove it
  if (originalOffer.hasTeamOption) {
    counterTeamOption = false;
    counterSalary *= 0.95; // Willing to take slight pay cut to remove team option
  }
  
  // Age-based year adjustments
  if (player.age >= 30 && counterYears < 3) {
    counterYears = 3; // Older players want security
  } else if (player.age < 25 && counterYears > 3) {
    counterYears = 2; // Young players want flexibility
  }
  
  return {
    years: counterYears,
    salary: Math.round(counterSalary * 10) / 10,
    hasPlayerOption: counterPlayerOption,
    hasTeamOption: counterTeamOption
  };
}

function getRejectionReason(player, offer, salaryRatio) {
  const reasons = [];
  
  if (salaryRatio < 0.85) {
    reasons.push("The salary doesn't reflect his market value");
  }
  
  if (offer.hasTeamOption && !offer.hasPlayerOption) {
    reasons.push("The team option creates too much uncertainty");
  }
  
  if (player.age >= 30 && offer.years < 2) {
    reasons.push("He's looking for more long-term security at this stage of his career");
  }
  
  if (player.personality.winningDrive >= 80 && player.team && player.team.wins < 30) {
    reasons.push("He wants to compete for a championship");
  }
  
  return reasons.length > 0 ? reasons[0] : "We're looking for a better fit overall";
}

function getPlayerPriorities(player) {
  const p = player.personality;
  const priorities = [
    { label: 'Money', value: p.moneyFocus },
    { label: 'Winning', value: p.winningDrive },
    { label: 'Playing Time', value: p.playingTimeDesire },
    { label: 'Loyalty', value: p.loyalty }
  ];
  
  return priorities.sort((a, b) => b.value - a.value);
}

function makeTeam(id, name, metadata = {}) {
  const players = [];
  for (let i = 0; i < 12; i++) {
    const age = rand(19, 34);
    players.push(makePlayer(age));
  }
  
  const team = {
    id,
    name,
    abbreviation: metadata.abbreviation || name.substring(0, 3).toUpperCase(),
    city: metadata.city || '',
    conference: metadata.conference || '—',
    division: metadata.division || '—',
    market: metadata.market || '—',
    primaryColor: metadata.primaryColor || '#3b82f6',
    secondaryColor: metadata.secondaryColor || '#1e293b',
    logoPrimaryUrl: metadata.logoPrimaryUrl || '',
    logoSecondaryUrl: metadata.logoSecondaryUrl || '',
    wins: 0,
    losses: 0,
    players,
    coach: makeCoach(rand(0, 15)), // Each team gets a coach
    morale: 75, // Team morale (0-100)
    payroll: 0,
    draftWatchlist: [], // For draft prospects watchlist
    // Fan Hype system (0-100)
    hype: 50, // Public excitement and expectations
    hypeHistory: [], // Track hype changes over time
    // Financial tracking
    finances: {
      seasonRevenue: 0, // Total revenue this season
      seasonAttendance: 0, // Total attendance this season
      gamesPlayed: 0, // Home games played
      avgAttendance: 0, // Average attendance per game
      revenuePerGame: 0 // Average revenue per game
    },
    // Advanced standings stats
    stats: {
      confWins: 0,
      confLosses: 0,
      homeWins: 0,
      homeLosses: 0,
      awayWins: 0,
      awayLosses: 0,
      last10: [], // Array of 'W' or 'L'
      streak: 0 // Positive for wins, negative for losses
    }
  };
  
  // Generate default rotations
  team.rotations = generateDefaultRotations(team);
  
  return team;
}

function generateDraftClass() {
  const draftClass = [];
  for (let i = 0; i < 20; i++) {
    const age = rand(19, 22);
    draftClass.push(makePlayer(age, true));
  }
  return draftClass.sort((a, b) => b.ratings.pot - a.ratings.pot);
}

function generateFreeAgents(count = 30) {
  const freeAgents = [];
  for (let i = 0; i < count; i++) {
    const age = rand(22, 35);
    const player = makePlayer(age, false);
    
    // Free agents should have reasonable market values
    const marketVariance = rand(0.8, 1.2);
    player.marketValue.expected = player.marketValue.expected * marketVariance;
    player.marketValue.min = player.marketValue.expected * 0.8;
    player.marketValue.max = player.marketValue.expected * 1.3;
    
    freeAgents.push(player);
  }
  return freeAgents.sort((a, b) => b.ratings.ovr - a.ratings.ovr);
}

function initializeDraftPicks(teams, currentSeason) {
  const picks = [];
  // Generate picks for next 3 years
  for (let year = 0; year < 3; year++) {
    const season = currentSeason + year + 1;
    for (let round = 1; round <= 2; round++) {
      teams.forEach(team => {
        picks.push({
          id: `pick_${season}_${round}_${team.id}`,
          season,
          round,
          originalOwner: team.id,
          currentOwner: team.id
        });
      });
    }
  }
  return picks;
}

/* ============================
   TRADE SYSTEM
============================ */

function calculatePlayerValue(player) {
  // Base value from OVR
  let value = player.ratings.ovr;
  
  // Age curve adjustment
  if (player.age <= 24) value *= 1.2; // Young players more valuable
  else if (player.age <= 27) value *= 1.1;
  else if (player.age <= 30) value *= 1.0;
  else if (player.age <= 32) value *= 0.9;
  else value *= 0.7;
  
  // Contract consideration (higher salary = lower value)
  const salaryFactor = 1 - (player.contract.amount / 40); // Max 40M
  value *= Math.max(0.5, salaryFactor);
  
  // Potential consideration
  if (player.ratings.pot > player.ratings.ovr) {
    value *= 1.1;
  }
  
  return value;
}

function calculatePickValue(pick, currentSeason) {
  const yearsOut = pick.season - currentSeason;
  let baseValue = 0;
  
  if (pick.round === 1) baseValue = 40;
  else if (pick.round === 2) baseValue = 20;
  
  // Discount for future years
  baseValue *= Math.pow(0.85, yearsOut);
  
  return baseValue;
}

function evaluateTrade(teamAId, teamBId, teamAAssets, teamBAssets) {
  const teamA = league.teams.find(t => t.id === teamAId);
  const teamB = league.teams.find(t => t.id === teamBId);
  
  // Calculate values
  let teamAOutValue = 0;
  let teamAInValue = 0;
  let teamBOutValue = 0;
  let teamBInValue = 0;
  
  // Team A outgoing (to Team B)
  teamAAssets.players.forEach(pId => {
    const player = teamA.players.find(p => p.id === pId);
    if (player) teamAOutValue += calculatePlayerValue(player);
  });
  teamAAssets.picks.forEach(pickId => {
    const pick = league.draftPicks.find(p => p.id === pickId);
    if (pick) teamAOutValue += calculatePickValue(pick, league.season);
  });
  
  // Team A incoming (from Team B)
  teamBAssets.players.forEach(pId => {
    const player = teamB.players.find(p => p.id === pId);
    if (player) teamAInValue += calculatePlayerValue(player);
  });
  teamBAssets.picks.forEach(pickId => {
    const pick = league.draftPicks.find(p => p.id === pickId);
    if (pick) teamAInValue += calculatePickValue(pick, league.season);
  });
  
  // Team B outgoing/incoming
  teamBOutValue = teamAInValue;
  teamBInValue = teamAOutValue;
  
  // Calculate salary changes
  let teamASalaryOut = 0;
  let teamASalaryIn = 0;
  teamAAssets.players.forEach(pId => {
    const player = teamA.players.find(p => p.id === pId);
    if (player) teamASalaryOut += player.contract.amount;
  });
  teamBAssets.players.forEach(pId => {
    const player = teamB.players.find(p => p.id === pId);
    if (player) teamASalaryIn += player.contract.amount;
  });
  
  let teamBSalaryOut = 0;
  let teamBSalaryIn = 0;
  teamBAssets.players.forEach(pId => {
    const player = teamB.players.find(p => p.id === pId);
    if (player) teamBSalaryOut += player.contract.amount;
  });
  teamAAssets.players.forEach(pId => {
    const player = teamA.players.find(p => p.id === pId);
    if (player) teamBSalaryIn += player.contract.amount;
  });
  
  // Cap legality check
  const teamANewPayroll = teamA.payroll - teamASalaryOut + teamASalaryIn;
  const teamBNewPayroll = teamB.payroll - teamBSalaryOut + teamBSalaryIn;
  const isLegal = teamANewPayroll <= HARD_CAP_APRON && teamBNewPayroll <= HARD_CAP_APRON;
  
  // Trade balance
  const teamAScore = teamAInValue - teamAOutValue;
  const teamBScore = teamBInValue - teamBOutValue;
  
  let fairness = 'Even';
  const diff = Math.abs(teamAScore - teamBScore);
  if (diff > 30) fairness = Math.abs(teamAScore) > Math.abs(teamBScore) ? 'Favors Team A' : 'Favors Team B';
  else if (diff > 15) fairness = Math.abs(teamAScore) > Math.abs(teamBScore) ? 'Slightly Favors A' : 'Slightly Favors B';
  
  return {
    isLegal,
    fairness,
    teamAScore,
    teamBScore,
    teamAOutValue,
    teamAInValue,
    teamBOutValue,
    teamBInValue,
    teamASalaryOut,
    teamASalaryIn,
    teamBSalaryOut,
    teamBSalaryIn,
    teamANewPayroll,
    teamBNewPayroll
  };
}

function aiEvaluateTrade(teamId, evaluation) {
  const team = league.teams.find(t => t.id === teamId);
  const isTeamA = teamId === evaluation.teamAId;
  const score = isTeamA ? evaluation.teamAScore : evaluation.teamBScore;
  
  // Determine team direction (winning vs rebuilding)
  const winPct = (team.wins + team.losses) > 0 ? team.wins / (team.wins + team.losses) : 0.5;
  const isContender = winPct >= 0.6;
  
  // Adjust threshold based on team direction
  let acceptThreshold = 5; // Default: need to gain at least 5 value
  if (isContender) acceptThreshold = 0; // Contenders more willing to trade
  
  if (!evaluation.isLegal) {
    return {
      accepted: false,
      response: `The ${team.name} cannot accept this trade due to salary cap constraints.`,
      counteroffer: null
    };
  }
  
  if (score >= acceptThreshold) {
    return {
      accepted: true,
      response: `The ${team.name} accept this trade. We believe this move helps our roster.`,
      counteroffer: null
    };
  } else if (score >= acceptThreshold - 10) {
    // Close - request a minor add
    return {
      accepted: false,
      response: `The ${team.name} are interested but need a bit more value. Can you add a second-round pick or a rotation player?`,
      counteroffer: {
        requested: 'minor_add' // Could be expanded to specific asset
      }
    };
  } else {
    // Too far apart
    const reason = score < -20 ? 
      `This trade doesn't provide enough value for our franchise.` :
      `We're not looking to move these assets at this time.`;
    
    return {
      accepted: false,
      response: `The ${team.name} decline. ${reason}`,
      counteroffer: null
    };
  }
}

function executeTrade(teamAId, teamBId, teamAAssets, teamBAssets) {
  // Validate trade is allowed
  if (!isActionAllowed(ACTIONS.TRADE)) {
    const reason = getActionLockReason(ACTIONS.TRADE);
    console.error('[Trade] Trade blocked:', reason);
    return { success: false, error: reason };
  }
  
  const teamA = league.teams.find(t => t.id === teamAId);
  const teamB = league.teams.find(t => t.id === teamBId);
  
  if (!teamA || !teamB) {
    return { success: false, error: 'Invalid teams' };
  }
  
  // Move players from Team A to Team B
  teamAAssets.players.forEach(pId => {
    const playerIndex = teamA.players.findIndex(p => p.id === pId);
    if (playerIndex !== -1) {
      const player = teamA.players.splice(playerIndex, 1)[0];
      teamB.players.push(player);
    }
  });
  
  // Move players from Team B to Team A
  teamBAssets.players.forEach(pId => {
    const playerIndex = teamB.players.findIndex(p => p.id === pId);
    if (playerIndex !== -1) {
      const player = teamB.players.splice(playerIndex, 1)[0];
      teamA.players.push(player);
    }
  });
  
  // Move picks from Team A to Team B
  teamAAssets.picks.forEach(pickId => {
    const pick = league.draftPicks.find(p => p.id === pickId);
    if (pick) pick.currentOwner = teamBId;
  });
  
  // Move picks from Team B to Team A
  teamBAssets.picks.forEach(pickId => {
    const pick = league.draftPicks.find(p => p.id === pickId);
    if (pick) pick.currentOwner = teamAId;
  });
  
  // Update payrolls
  updateTeamPayrolls();
  
  // Invalidate strength cache for point spreads
  if (typeof incrementStrengthVersion === 'function') {
    incrementStrengthVersion();
  }
  
  // Save league
  saveLeague(league);
  
  return { success: true };
}

/* ============================
   DRAFT SYSTEM
============================ */

// Generate Draft Prospects
function generateDraftClass(seasonYear, prospectCount = DRAFT_PROSPECT_POOL_SIZE) {
  const prospects = [];
  const usedNames = new Set();
  
  for (let i = 0; i < prospectCount; i++) {
    let name = randName();
    while (usedNames.has(name)) {
      name = randName();
    }
    usedNames.add(name);
    
    const pos = POS[rand(0, POS.length - 1)];
    const age = rand(19, 22);
    
    // Generate ratings with more variance for prospects
    const baseOvr = rand(45, 85);
    const variance = rand(-10, 15);
    
    let shoot = clamp(baseOvr + rand(-15, 15), 35, 90);
    let defense = clamp(baseOvr + rand(-15, 15), 35, 90);
    let rebound = clamp(baseOvr + rand(-15, 15), 35, 90);
    let passing = clamp(baseOvr + rand(-15, 15), 35, 90);
    
    const ovr = Math.round((shoot + defense + rebound + passing) / 4);
    const pot = clamp(ovr + rand(5, 30), ovr, 98);
    
    // Generate detailed attributes
    const athleticBase = rand(50, 95);
    const attributes = {
      athletic: {
        speed: clamp(athleticBase + rand(-10, 10), 40, 99),
        acceleration: clamp(athleticBase + rand(-10, 10), 40, 99),
        strength: clamp(rand(50, 90), 40, 99),
        vertical: clamp(athleticBase + rand(-15, 15), 40, 99),
        lateralQuickness: clamp(athleticBase + rand(-10, 10), 40, 99),
        stamina: clamp(rand(60, 95), 40, 99),
        hustle: clamp(rand(50, 90), 40, 99)
      },
      offensive: {
        finishing: clamp(shoot + rand(-15, 15), 40, 99),
        midRange: clamp(shoot + rand(-10, 10), 40, 99),
        threePoint: clamp(shoot + rand(-20, 20), 40, 99),
        freeThrow: clamp(shoot + rand(-10, 15), 40, 99),
        postScoring: clamp(shoot + rand(-20, 10), 40, 99),
        shotCreation: clamp(shoot + rand(-15, 15), 40, 99),
        ballHandling: clamp(passing + rand(-15, 15), 40, 99),
        passingVision: clamp(passing + rand(-10, 10), 40, 99)
      },
      defensive: {
        perimeterDefense: clamp(defense + rand(-10, 10), 40, 99),
        interiorDefense: clamp(defense + rand(-15, 15), 40, 99),
        blockRating: clamp(defense + rand(-15, 15), 40, 99),
        stealRating: clamp(defense + rand(-10, 15), 40, 99),
        defensiveRebounding: clamp(rebound + rand(-10, 10), 40, 99),
        offensiveRebounding: clamp(rebound + rand(-15, 10), 40, 99),
        defensiveAwareness: clamp(defense + rand(-10, 10), 40, 99)
      },
      mental: {
        basketballIQ: clamp(rand(50, 90), 40, 99),
        consistency: clamp(rand(45, 85), 40, 99),
        workEthic: clamp(rand(50, 95), 40, 99),
        leadership: clamp(rand(40, 85), 40, 99),
        composure: clamp(rand(50, 90), 40, 99),
        discipline: clamp(rand(45, 85), 40, 99),
        clutch: clamp(rand(45, 90), 40, 99)
      }
    };
    
    // Determine archetype based on attributes
    const archetypes = [
      '3&D Wing', 'Floor General', 'Stretch Big', 'Slasher', 'Sharpshooter',
      'Defensive Anchor', 'Two-Way Forward', 'Scoring Guard', 'Point Forward',
      'Rim Runner', 'Post Scorer', 'Playmaker', 'Wing Defender'
    ];
    const archetype = archetypes[rand(0, archetypes.length - 1)];
    
    // Bio data
    const heights = ['6\'0"', '6\'1"', '6\'2"', '6\'3"', '6\'4"', '6\'5"', '6\'6"', '6\'7"', '6\'8"', '6\'9"', '6\'10"', '6\'11"', '7\'0"', '7\'1"'];
    const colleges = ['Duke', 'Kentucky', 'UNC', 'UCLA', 'Kansas', 'Michigan', 'Villanova', 'Gonzaga', 'Arizona', 'UConn', 'International'];
    
    const bio = {
      height: heights[rand(0, heights.length - 1)],
      weight: `${rand(180, 250)} lbs`,
      wingspan: heights[Math.min(rand(0, heights.length - 1), heights.length - 1)],
      college: colleges[rand(0, colleges.length - 1)]
    };
    
    // Personality traits
    const personality = {
      loyalty: rand(30, 90),
      moneyFocus: rand(30, 90),
      winningDrive: rand(40, 95),
      workEthic: attributes.mental.workEthic,
      ego: rand(30, 90),
      teamPlayer: rand(40, 90)
    };
    
    // Projected draft range based on OVR and POT
    let projectedRange = 'Undrafted';
    if (ovr >= 75 || pot >= 85) projectedRange = 'Top 5';
    else if (ovr >= 70 || pot >= 80) projectedRange = 'Lottery';
    else if (ovr >= 65 || pot >= 75) projectedRange = 'Mid 1st';
    else if (ovr >= 60 || pot >= 70) projectedRange = 'Late 1st';
    else if (ovr >= 55 || pot >= 65) projectedRange = 'Early 2nd';
    else if (ovr >= 50) projectedRange = 'Late 2nd';
    
    // Generate strengths based on top attributes
    const strengths = [];
    if (attributes.offensive.threePoint >= 75) strengths.push('Elite Shooter');
    if (attributes.athletic.speed >= 80) strengths.push('Explosive Athlete');
    if (attributes.defensive.perimeterDefense >= 75) strengths.push('Lockdown Defender');
    if (attributes.offensive.ballHandling >= 75) strengths.push('Ball Handler');
    if (attributes.mental.basketballIQ >= 80) strengths.push('High IQ');
    if (attributes.defensive.blockRating >= 75) strengths.push('Rim Protector');
    if (attributes.offensive.finishing >= 80) strengths.push('Finisher');
    if (attributes.offensive.passingVision >= 75) strengths.push('Playmaker');
    
    // Generate weaknesses based on low attributes
    const weaknesses = [];
    if (attributes.offensive.threePoint <= 50) weaknesses.push('Inconsistent Shooter');
    if (attributes.defensive.perimeterDefense <= 50) weaknesses.push('Defensive Liability');
    if (attributes.athletic.speed <= 50) weaknesses.push('Below Average Athleticism');
    if (attributes.mental.basketballIQ <= 50) weaknesses.push('Low IQ');
    if (attributes.offensive.ballHandling <= 50) weaknesses.push('Limited Ball Skills');
    if (attributes.athletic.strength <= 50) weaknesses.push('Needs Strength');
    
    // Ensure at least one strength and weakness
    if (strengths.length === 0) {
      if (shoot >= 65) strengths.push('Solid Scorer');
      else if (defense >= 65) strengths.push('Good Defender');
      else strengths.push('Developing Player');
    }
    if (weaknesses.length === 0) {
      weaknesses.push('Needs Development');
    }
    
    prospects.push({
      id: `prospect_${seasonYear}_${i + 1}`,
      name,
      age,
      pos,
      ratings: {
        ovr,
        pot,
        shoot,
        defense,
        rebound,
        passing,
        athleticism: Math.round((athleticBase + attributes.athletic.speed + attributes.athletic.vertical) / 3)
      },
      attributes,
      bio,
      personality,
      archetype,
      projectedRange,
      draftYear: seasonYear,
      strengths: strengths.slice(0, 3), // Max 3 strengths
      weaknesses: weaknesses.slice(0, 3), // Max 3 weaknesses
      rank: 0, // Will be set after sorting
      isWatchlisted: false,
      shotTendencies: null // Will be generated when needed (based on final pos/ratings)
    });
  }
  
  // Sort by potential + OVR for ranking
  prospects.sort((a, b) => {
    const scoreA = a.ratings.pot * 1.5 + a.ratings.ovr;
    const scoreB = b.ratings.pot * 1.5 + b.ratings.ovr;
    return scoreB - scoreA;
  });
  
  // Assign ranks
  prospects.forEach((p, index) => {
    p.rank = index + 1;
  });
  
  return prospects;
}

// Generate Draft Order based on standings
function generateDraftOrder(teams, seasonYear, rounds = 2) {
  const order = [];
  let pickNum = 1;
  
  // Calculate team records (wins)
  const teamsWithRecords = teams.map(team => ({
    ...team,
    wins: team.stats?.wins || 0,
    losses: team.stats?.losses || 0
  }));
  
  // Sort by wins ascending (worst teams first)
  teamsWithRecords.sort((a, b) => {
    if (a.wins !== b.wins) return a.wins - b.wins;
    // Tiebreaker: use team id for consistency
    return a.id - b.id;
  });
  
  for (let round = 1; round <= rounds; round++) {
    for (let i = 0; i < teamsWithRecords.length; i++) {
      const team = teamsWithRecords[i];
      order.push({
        id: `pick_${seasonYear}_${round}_${pickNum}`,
        season: seasonYear,
        round,
        pick: pickNum,
        originalOwner: team.id,
        currentOwner: team.id,
        overallPick: (round - 1) * teamsWithRecords.length + (i + 1)
      });
      pickNum++;
    }
  }
  
  return order;
}

// Initialize Draft State
function initializeDraft(seasonYear) {
  if (!league.draft || league.draft.year !== seasonYear) {
    const prospects = generateDraftClass(seasonYear);
    const order = generateDraftOrder(league.teams, seasonYear);
    
    league.draft = {
      year: seasonYear,
      rounds: 2,
      currentPickIndex: 0,
      order,
      prospects,
      results: [],
      boardByTeamId: {}, // team shortlists
      inProgress: true
    };
    
    // Initialize empty boards for each team
    league.teams.forEach(team => {
      league.draft.boardByTeamId[team.id] = {
        prospects: [], // array of prospect IDs
        notes: {} // prospectId -> note string
      };
    });
  }
  
  return league.draft;
}

// Convert prospect to player
function createPlayerFromProspect(prospect, teamId, draftYear, round, pick) {
  const id = nextPlayerId++;
  
  // Rookie contract based on draft position
  let salary, years;
  if (round === 1) {
    if (pick <= 5) {
      salary = rand(7, 10);
      years = 4;
    } else if (pick <= 14) {
      salary = rand(4, 7);
      years = 4;
    } else {
      salary = rand(2, 4);
      years = 3;
    }
  } else {
    salary = rand(1, 2);
    years = 2;
  }
  
  // Copy all prospect data and convert to player format
  const player = {
    id,
    name: prospect.name,
    age: prospect.age,
    pos: prospect.pos,
    ratings: {
      ovr: prospect.ratings.ovr,
      pot: prospect.ratings.pot,
      shoot: prospect.ratings.shoot,
      defense: prospect.ratings.defense,
      rebound: prospect.ratings.rebound,
      passing: prospect.ratings.passing,
      athleticism: prospect.ratings.athleticism || rand(50, 80)
    },
    contract: {
      amount: salary,
      exp: league.season + years,
      yearsRemaining: years,
      totalValue: salary * years,
      startYear: league.season,
      hasPlayerOption: false,
      hasTeamOption: round === 1 && years >= 3 // 1st round picks get team options
    },
    bio: prospect.bio,
    draft: {
      year: draftYear,
      round,
      pick,
      draftedByTid: teamId, // Team ID that drafted this player (persisted to DB)
      tid: teamId // Alias for compatibility
    },
    attributes: prospect.attributes,
    personality: {
      currentSatisfactionPct: rand(70, 95),
      satisfactionLabel: 'Excited',
      loyalty: prospect.personality.loyalty,
      moneyFocus: prospect.personality.moneyFocus,
      winningDrive: prospect.personality.winningDrive,
      playingTimeDesire: rand(70, 95), // Rookies want playing time
      teamPlayer: prospect.personality.teamPlayer,
      workEthic: prospect.personality.workEthic,
      ego: prospect.personality.ego,
      temperament: rand(50, 85)
    },
    injury: {
      type: null,
      gamesRemaining: 0,
      severity: null
    },
    agent: {
      name: ['Rich Paul', 'Aaron Mintz', 'Jeff Schwartz', 'Mark Bartelstein', 'Bill Duffy'][rand(0, 4)],
      style: ['Aggressive', 'Patient', 'Analytical'][rand(0, 2)],
      powerRating: rand(60, 90),
      yearsWithPlayer: 0
    },
    marketValue: {
      min: salary * 0.8,
      max: salary * 1.5,
      expected: salary,
      status: 'Rookie'
    }
  };
  
  // Generate shot tendencies based on final player attributes
  player.shotTendencies = generateDefaultShotTendencies(player);
  
  return player;
}

// AI Draft Logic
function aiDraftPick(teamId, availableProspects) {
  const team = league.teams.find(t => t.id === teamId);
  if (!team) return null;
  
  // Check team's draft board first
  const board = league.draft.boardByTeamId[teamId];
  if (board && board.prospects.length > 0) {
    // Try to pick from board
    for (const prospectId of board.prospects) {
      const prospect = availableProspects.find(p => p.id === prospectId);
      if (prospect) return prospect;
    }
  }
  
  // Assess team needs
  const positionCounts = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
  team.players.forEach(p => {
    positionCounts[p.pos] = (positionCounts[p.pos] || 0) + 1;
  });
  
  // Find position with least players
  const needsPosition = Object.entries(positionCounts)
    .sort((a, b) => a[1] - b[1])[0][0];
  
  // Score prospects
  const scoredProspects = availableProspects.map(prospect => {
    let score = prospect.ratings.pot * 1.5 + prospect.ratings.ovr;
    
    // Bonus for position need
    if (prospect.pos === needsPosition) score += 15;
    
    // Slight randomness
    score += rand(-5, 5);
    
    return { prospect, score };
  });
  
  // Sort by score and pick top one
  scoredProspects.sort((a, b) => b.score - a.score);
  return scoredProspects[0].prospect;
}

// Make a draft pick
function makeDraftPick(prospectId, teamId = null) {
  // Check if draft actions are allowed
  if (!isActionAllowed(ACTIONS.DRAFT)) {
    const reason = getActionLockReason(ACTIONS.DRAFT);
    return { success: false, error: reason };
  }
  
  if (!league.draft || !league.draft.inProgress) {
    return { success: false, error: 'No draft in progress' };
  }
  
  const currentPick = league.draft.order[league.draft.currentPickIndex];
  if (!currentPick) {
    return { success: false, error: 'Draft is complete' };
  }
  
  // Determine which team is picking (use currentOwner for traded picks)
  const pickingTeamId = teamId || currentPick.currentOwner;
  const team = league.teams.find(t => t.id === pickingTeamId);
  
  if (!team) {
    return { success: false, error: 'Team not found' };
  }
  
  // Find prospect
  const prospectIndex = league.draft.prospects.findIndex(p => p.id === prospectId);
  if (prospectIndex === -1) {
    return { success: false, error: 'Prospect not found' };
  }
  
  const prospect = league.draft.prospects[prospectIndex];
  
  // Create player from prospect
  const player = createPlayerFromProspect(
    prospect,
    pickingTeamId,
    league.draft.year,
    currentPick.round,
    currentPick.overallPick
  );
  
  // Add to team roster
  team.players.push(player);
  
  // Remove prospect from pool
  league.draft.prospects.splice(prospectIndex, 1);
  
  // Record the pick (saved to draft history when draft completes)
  league.draft.results.push({
    pickNumber: currentPick.overallPick,
    round: currentPick.round,
    teamId: pickingTeamId, // Team ID for future reference
    teamName: team.name, // Team name at time of draft
    playerId: player.id,
    playerName: player.name,
    pos: player.pos,
    ovr: player.ratings.ovr,
    pot: player.ratings.pot
  });
  
  // Advance to next pick
  league.draft.currentPickIndex++;
  
  // Check if draft is complete
  if (league.draft.currentPickIndex >= league.draft.order.length) {
    league.draft.inProgress = false;
    league.phase = 'offseason';
    
    // Save draft results to history
    if (!league.history.draftsByYear) {
      league.history.draftsByYear = {};
    }
    league.history.draftsByYear[league.draft.year] = league.draft.results.slice();
  }
  
  // Update payrolls and save
  updateTeamPayrolls();
  saveLeague(league);
  
  return {
    success: true,
    player,
    pick: currentPick
  };
}

// Auto-pick for AI teams
function autoDraftAI() {
  if (!league.draft || !league.draft.inProgress) return null;
  
  const currentPick = league.draft.order[league.draft.currentPickIndex];
  if (!currentPick) return null;
  
  const pickingTeamId = currentPick.currentOwner;
  
  // If it's the user's team, don't auto-pick
  if (pickingTeamId === selectedTeamId) return null;
  
  // AI selects prospect
  const selectedProspect = aiDraftPick(pickingTeamId, league.draft.prospects);
  if (!selectedProspect) return null;
  
  // Make the pick
  return makeDraftPick(selectedProspect.id, pickingTeamId);
}

// Get best available prospects
function getBestAvailable(count = 10) {
  if (!league.draft || !league.draft.prospects) return [];
  
  return league.draft.prospects
    .slice(0, Math.min(count, league.draft.prospects.length));
}

// Ensure draft prospects exist for current season
function ensureDraftProspects() {
  if (!league.draftProspects || league.draftProspects.length === 0) {
    console.log('Generating draft prospects for season', league.season);
    league.draftProspects = generateDraftClass(league.season);
    saveLeague(league);
  }
  return league.draftProspects;
}

// Get all draft prospects (always available)
function getDraftProspects() {
  return league.draftProspects || [];
}

// Toggle watchlist for a prospect
function toggleProspectWatchlist(prospectId, teamId) {
  const team = league.teams.find(t => t.id === teamId);
  if (!team) return false;
  
  if (!team.draftWatchlist) team.draftWatchlist = [];
  
  const index = team.draftWatchlist.indexOf(prospectId);
  if (index === -1) {
    team.draftWatchlist.push(prospectId);
  } else {
    team.draftWatchlist.splice(index, 1);
  }
  
  saveLeague(league);
  return true;
}

// Check if prospect is watchlisted
function isProspectWatchlisted(prospectId, teamId) {
  const team = league.teams.find(t => t.id === teamId);
  if (!team || !team.draftWatchlist) return false;
  return team.draftWatchlist.includes(prospectId);
}

// Get draft state
function getDraftState() {
  return {
    isActive: league.draft?.inProgress || false,
    phase: league.phase,
    currentPick: league.draft?.order?.[league.draft?.currentPickIndex] || null,
    prospects: getDraftProspects()
  };
}

/* ============================
   DASHBOARD ALERTS SYSTEM
============================ */

function computeDashboardAlerts(userTeamId) {
  if (!league || !league.teams) return [];
  
  const team = league.teams.find(t => t.id === userTeamId);
  if (!team) return [];
  
  const alerts = [];
  const salaryCap = 120; // millions
  const hardCapApron = 172; // millions
  const minRoster = 12;
  const optimalRoster = 15;
  
  // 1) OVER HARD CAP / APRON (danger)
  if (team.payroll > hardCapApron) {
    const overAmount = (team.payroll - hardCapApron).toFixed(1);
    alerts.push({
      id: 'hard-cap',
      severity: 'danger',
      message: 'Over hard cap!',
      subtext: `Over by $${overAmount}M`,
      action: { type: 'NAVIGATE', target: 'finances' },
      priority: 100
    });
  }
  // 2) OVER SALARY CAP (danger)
  else if (team.payroll > salaryCap) {
    const overAmount = (team.payroll - salaryCap).toFixed(1);
    alerts.push({
      id: 'salary-cap',
      severity: 'danger',
      message: 'Over salary cap!',
      subtext: `Over by $${overAmount}M`,
      action: { type: 'NAVIGATE', target: 'finances' },
      priority: 90
    });
  }
  
  // 3) CONTRACTS EXPIRING SOON (warning)
  const expiringContracts = team.players.filter(p => {
    if (!p.contract) return false;
    const yearsRemaining = p.contract.exp - league.season;
    return yearsRemaining <= 1;
  });
  
  if (expiringContracts.length > 0) {
    alerts.push({
      id: 'expiring-contracts',
      severity: 'warning',
      message: `${expiringContracts.length} contract${expiringContracts.length > 1 ? 's' : ''} expiring soon`,
      subtext: expiringContracts.slice(0, 2).map(p => p.name).join(', ') + (expiringContracts.length > 2 ? '...' : ''),
      action: { type: 'NAVIGATE', target: 'finances' },
      priority: 70
    });
  }
  
  // 4) LOW ROSTER SIZE (danger/warning)
  const rosterCount = team.players.length;
  if (rosterCount < minRoster) {
    alerts.push({
      id: 'low-roster',
      severity: 'danger',
      message: 'Roster below minimum!',
      subtext: `Only ${rosterCount}/${minRoster} players`,
      action: { type: 'NAVIGATE', target: 'freeagents' },
      priority: 95
    });
  } else if (rosterCount < optimalRoster) {
    alerts.push({
      id: 'small-roster',
      severity: 'warning',
      message: 'Roster size low',
      subtext: `${rosterCount}/${optimalRoster} players`,
      action: { type: 'NAVIGATE', target: 'freeagents' },
      priority: 60
    });
  }
  
  // 5) INJURIES (warning)
  const injuredPlayers = team.players.filter(p => p.injury && p.injury.gamesRemaining > 0);
  if (injuredPlayers.length > 0) {
    alerts.push({
      id: 'injuries',
      severity: 'warning',
      message: `${injuredPlayers.length} player${injuredPlayers.length > 1 ? 's' : ''} injured`,
      subtext: injuredPlayers.slice(0, 2).map(p => `${p.name} (${p.injury.gamesRemaining}g)`).join(', '),
      action: { type: 'NAVIGATE', target: 'team' },
      priority: 65
    });
  }
  
  // 6) MORALE PROBLEMS (warning)
  const unhappyPlayers = team.players.filter(p => {
    const morale = p.morale !== undefined ? p.morale : 75;
    return morale < 40;
  });
  
  if (unhappyPlayers.length > 0) {
    alerts.push({
      id: 'morale',
      severity: 'warning',
      message: 'Locker room tension',
      subtext: `${unhappyPlayers.length} unhappy player${unhappyPlayers.length > 1 ? 's' : ''}`,
      action: { type: 'NAVIGATE', target: 'team' },
      priority: 55
    });
  }
  
  // 7) DRAFT APPROACHING (info)
  if (league.phase === 'offseason') {
    alerts.push({
      id: 'draft-soon',
      severity: 'info',
      message: 'Draft approaching',
      subtext: 'Review prospects and set your board',
      action: { type: 'NAVIGATE', target: 'draft' },
      priority: 40
    });
  } else if (league.phase === 'draft') {
    alerts.push({
      id: 'draft-active',
      severity: 'info',
      message: 'Draft in progress',
      subtext: 'Make your picks now',
      action: { type: 'NAVIGATE', target: 'draft' },
      priority: 85
    });
  }
  
  // 8) ROTATION ISSUES (warning)
  if (team.rotations) {
    const positionsWithIssues = [];
    POS.forEach(pos => {
      const rotation = team.rotations[pos];
      if (!rotation || rotation.length === 0) {
        positionsWithIssues.push(pos);
      }
    });
    
    if (positionsWithIssues.length > 0) {
      alerts.push({
        id: 'rotation-empty',
        severity: 'warning',
        message: 'Rotation needs attention',
        subtext: `Missing: ${positionsWithIssues.join(', ')}`,
        action: { type: 'NAVIGATE', target: 'rotations' },
        priority: 50
      });
    }
  }
  
  // Sort by severity (danger > warning > info) then by priority
  const severityOrder = { danger: 3, warning: 2, info: 1 };
  alerts.sort((a, b) => {
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[b.severity] - severityOrder[a.severity];
    }
    return b.priority - a.priority;
  });
  
  return alerts;
}

/* ============================
   EXPANSION SYSTEM
============================ */

function initExpansionState() {
  return {
    active: false,
    currentStep: 1, // 1-4
    year: null,
    settings: {
      numTeams: 1,
      expansionYear: null,
      rosterSizeLimit: 15,
      minPlayersPerTeam: 1,
      maxPlayersPerTeam: 1,
      protectedPlayersPerTeam: 8,
      canProtectRookies: true,
      canProtectTwoWay: true,
      draftOrder: 'snake', // 'snake', 'random', 'worst-first'
      expandedCap: true,
      inheritContracts: true,
      expansionRelief: false
    },
    newTeams: [],
    protectedLists: {}, // { teamId: [playerId, ...] }
    draftResults: [],
    history: []
  };
}

function validateExpansionTeams(newTeams, existingTeams) {
  const errors = [];
  const abbrevs = new Set(existingTeams.map(t => t.abbreviation || t.name.substring(0, 3).toUpperCase()));
  
  newTeams.forEach((team, idx) => {
    if (!team.city || team.city.trim() === '') {
      errors.push(`Team ${idx + 1}: City is required`);
    }
    if (!team.name || team.name.trim() === '') {
      errors.push(`Team ${idx + 1}: Name is required`);
    }
    if (!team.abbreviation || team.abbreviation.trim() === '') {
      errors.push(`Team ${idx + 1}: Abbreviation is required`);
    } else if (abbrevs.has(team.abbreviation.toUpperCase())) {
      errors.push(`Team ${idx + 1}: Abbreviation "${team.abbreviation}" already exists`);
    } else {
      abbrevs.add(team.abbreviation.toUpperCase());
    }
    if (!team.conference || !['Eastern', 'Western'].includes(team.conference)) {
      errors.push(`Team ${idx + 1}: Valid conference required (Eastern/Western)`);
    }
    if (!team.division || team.division.trim() === '') {
      errors.push(`Team ${idx + 1}: Division is required`);
    }
  });
  
  return errors;
}

function generateCpuProtectionLists(settings) {
  if (!league || !league.teams) return {};
  
  const protectedLists = {};
  const limit = settings.protectedPlayersPerTeam;
  
  league.teams.forEach(team => {
    const eligiblePlayers = team.players.filter(p => {
      if (!settings.canProtectRookies) {
        const yearsInLeague = league.season - (p.draft?.year || league.season);
        if (yearsInLeague < 1) return false;
      }
      // Add two-way check if needed
      return true;
    });
    
    // Score players for protection
    const scoredPlayers = eligiblePlayers.map(p => {
      const age = p.age || 25;
      const ageBonus = age < 24 ? 10 : age > 30 ? -10 : 0;
      const salaryPenalty = p.contract ? Math.min(p.contract.amount / 10, 10) : 0;
      const score = (p.ratings.ovr * 2) + p.ratings.pot + ageBonus - salaryPenalty;
      return { player: p, score };
    });
    
    scoredPlayers.sort((a, b) => b.score - a.score);
    protectedLists[team.id] = scoredPlayers.slice(0, limit).map(sp => sp.player.id);
  });
  
  return protectedLists;
}

function buildExpansionPlayerPool() {
  if (!league || !league.expansion) return [];
  
  const protectedLists = league.expansion.protectedLists;
  const availablePlayers = [];
  
  league.teams.forEach(team => {
    const protected = protectedLists[team.id] || [];
    team.players.forEach(player => {
      if (!protected.includes(player.id)) {
        availablePlayers.push({
          ...player,
          fromTeamId: team.id,
          fromTeamName: team.name
        });
      }
    });
  });
  
  return availablePlayers;
}

function pickExpansionPlayer(expansionTeamId, playerId) {
  if (!league || !league.expansion) return { success: false, error: 'No expansion in progress' };
  
  const playerPool = buildExpansionPlayerPool();
  const player = playerPool.find(p => p.id === playerId);
  
  if (!player) {
    return { success: false, error: 'Player not available' };
  }
  
  // Check roster limits
  const expansionTeam = league.teams.find(t => t.id === expansionTeamId);
  if (!expansionTeam) {
    return { success: false, error: 'Expansion team not found' };
  }
  
  if (expansionTeam.players.length >= league.expansion.settings.rosterSizeLimit) {
    return { success: false, error: 'Roster is full' };
  }
  
  // Check max picks from original team
  const fromTeam = league.teams.find(t => t.id === player.fromTeamId);
  if (!fromTeam) {
    return { success: false, error: 'Original team not found' };
  }
  
  const alreadyTakenFromTeam = league.expansion.draftResults.filter(
    r => r.fromTeamId === player.fromTeamId
  ).length;
  
  if (alreadyTakenFromTeam >= league.expansion.settings.maxPlayersPerTeam) {
    return { success: false, error: `Already taken max players from ${fromTeam.name}` };
  }
  
  // Transfer player
  const playerIndex = fromTeam.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) {
    return { success: false, error: 'Player not found on original team' };
  }
  
  const [movedPlayer] = fromTeam.players.splice(playerIndex, 1);
  expansionTeam.players.push(movedPlayer);
  
  // Update player's current team but NOT draftedByTid
  movedPlayer.currentTeamId = expansionTeamId;
  
  // Record transaction
  if (!movedPlayer.transactionHistory) {
    movedPlayer.transactionHistory = [];
  }
  movedPlayer.transactionHistory.push({
    type: 'expansion',
    season: league.season,
    fromTeamId: player.fromTeamId,
    toTeamId: expansionTeamId,
    date: new Date().toISOString()
  });
  
  // Record draft pick
  league.expansion.draftResults.push({
    playerId: playerId,
    playerName: movedPlayer.name,
    fromTeamId: player.fromTeamId,
    fromTeamName: player.fromTeamName,
    toTeamId: expansionTeamId,
    pick: league.expansion.draftResults.length + 1
  });
  
  updateTeamPayrolls();
  
  return { success: true, player: movedPlayer };
}

function aiPickExpansionPlayer(expansionTeamId) {
  const playerPool = buildExpansionPlayerPool();
  const expansionTeam = league.teams.find(t => t.id === expansionTeamId);
  
  if (!expansionTeam || !playerPool || playerPool.length === 0) {
    return { success: false, error: 'No players available' };
  }
  
  // Count positions on current roster
  const positionCounts = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
  expansionTeam.players.forEach(p => {
    if (positionCounts[p.pos] !== undefined) {
      positionCounts[p.pos]++;
    }
  });
  
  // Score available players
  const scoredPlayers = playerPool.map(p => {
    let score = p.ratings.ovr + (p.ratings.pot * 0.5);
    
    // Positional need bonus
    const posNeed = positionCounts[p.pos] || 0;
    if (posNeed < 2) score += 15;
    else if (posNeed < 3) score += 5;
    
    // Salary penalty
    if (p.contract && p.contract.amount) {
      score -= Math.min(p.contract.amount / 5, 15);
    }
    
    // Injury penalty
    if (p.injury && p.injury.gamesRemaining > 0) {
      score -= 20;
    }
    
    // Age bonus
    const age = p.age || 25;
    if (age < 25) score += 8;
    else if (age > 32) score -= 10;
    
    return { player: p, score };
  });
  
  scoredPlayers.sort((a, b) => b.score - a.score);
  
  // Pick best available
  for (const sp of scoredPlayers) {
    const result = pickExpansionPlayer(expansionTeamId, sp.player.id);
    if (result.success) {
      return result;
    }
  }
  
  return { success: false, error: 'Could not find valid pick' };
}

function finalizeExpansion() {
  if (!league || !league.expansion) return;
  
  // Add to history
  league.expansion.history.push({
    season: league.season,
    teams: league.expansion.newTeams.map(t => t.name),
    picks: league.expansion.draftResults.length,
    date: new Date().toISOString()
  });
  
  // Reset expansion state
  league.expansion.active = false;
  league.expansion.currentStep = 1;
  league.expansion.newTeams = [];
  league.expansion.protectedLists = {};
  league.expansion.draftResults = [];
  
  // Recalculate standings and payrolls
  updateTeamPayrolls();
  
  save();
}

/* ============================
   SCHEDULE & GAME SIMULATION
============================ */

let nextGameId = 1;
let activeLiveGames = new Map(); // gameId -> intervalId for live games

function initScheduleState() {
  return {
    games: {},           // gameId -> game object
    days: {},            // season -> [day objects]
    currentDay: 1        // Current day number in season
  };
}

function createScheduleDay(dayNumber, phase = 'Regular Season') {
  return {
    dayNumber,
    phase,           // 'Preseason', 'Regular Season', 'Playoffs'
    games: [],       // Array of gameIds scheduled for this day
    simulated: false // Whether this day has been simulated
  };
}

// Automatically ensure schedule exists when needed
function ensureSchedule() {
  if (!league || !league.season) return;
  
  // GUARD: Only generate if schedule is truly missing
  const hasSchedule = league.schedule 
    && league.schedule.days 
    && league.schedule.days[league.season] 
    && league.schedule.days[league.season].length > 0;
  
  if (hasSchedule) {
    console.log(`[SCHEDULE] Schedule already exists for season ${league.season}, skipping generation`);
    return;
  }
  
  const phase = league.phase?.toLowerCase() || '';
  const needsSchedule = 
    (phase === 'preseason' || phase === 'season' || phase === 'regular_season' || phase === 'regular season');
  
  if (needsSchedule) {
    console.log(`[SCHEDULE] Auto-generating schedule for season ${league.season} (phase: ${league.phase})`);
    generateSeasonSchedule(league.season);
    save();
  }
}

// Convenience function for commissioner mode / UI calls
function generateSchedule() {
  if (!league || !league.season) {
    console.error('Cannot generate schedule: league or season not defined');
    return;
  }
  generateSeasonSchedule(league.season);
}

async function generateSeasonSchedule(season) {
  if (!league || !league.teams || league.teams.length < 2) {
    console.error('Cannot generate schedule: insufficient teams');
    return;
  }
  
  const gamesPerTeam = league.settings?.gamesPerTeam || 82;
  
  console.log(`[Engine] Generating schedule for season ${season}`);
  
  try {
    // CLEAR existing schedule data before generating
    if (!league.schedule) {
      league.schedule = {
        games: {},
        gamesPerTeam: gamesPerTeam,
        totalGames: 0,
        generationError: null
      };
    }
    
    // Clear this season's schedule
    league.schedule.games = {};
    league.schedule.preseasonGames = {};
    league.schedule.generationError = null;
    
    // Generate preseason schedule if enabled
    if (league.settings?.enablePreseason && league.phase === 'preseason') {
      console.log('[Engine] Generating preseason schedule...');
      generatePreseasonScheduleIfNeeded();
    }
    
    // Use the new schedule generator (with validation and fallback)
    const newSchedule = generateLeagueSchedule(league.teams, season, gamesPerTeam);
    
    // Store schedule
    league.schedule.games = newSchedule.games;
    league.schedule.gamesPerTeam = newSchedule.gamesPerTeam;
    league.schedule.totalGames = newSchedule.totalGames;
    
    console.log(`[Engine] ✓ Schedule generated: ${newSchedule.totalGames} games`);
    
    // Update league phase after schedule generation
    updateLeaguePhase();
    
    // Save to database
    await saveLeague();
    
  } catch (error) {
    console.error('[Engine] Schedule generation failed:', error);
    
    // Store the error message for display
    if (!league.schedule) {
      league.schedule = { games: {}, gamesPerTeam: gamesPerTeam, totalGames: 0 };
    }
    league.schedule.generationError = error.message;
    
    // Show detailed error to user
    alert('Failed to generate schedule:\n\n' + error.message);
  }
}

function getScheduleDay(season, dayNumber) {
  if (!league?.schedule?.days[season]) return null;
  return league.schedule.days[season][dayNumber - 1] || null;
}

function getGamesForDay(season, dayNumber) {
  const day = getScheduleDay(season, dayNumber);
  if (!day || !day.games) return [];
  
  return day.games.map(id => league.schedule.games[id]).filter(g => g);
}

function getTotalScheduleDays(season) {
  return league?.schedule?.days[season]?.length || 0;
}

function getCurrentDay() {
  return league?.schedule?.currentDay || 1;
}

function setCurrentDay(dayNumber) {
  if (league?.schedule) {
    league.schedule.currentDay = dayNumber;
  }
}

function getNextUserGameDay() {
  if (!league?.userTid || !league?.schedule?.days[league.season]) return null;
  
  const currentDay = getCurrentDay();
  const days = league.schedule.days[league.season];
  
  for (let i = currentDay; i <= days.length; i++) {
    const dayGames = getGamesForDay(league.season, i);
    const hasUserGame = dayGames.some(g => 
      g.homeTeamId === league.userTid || g.awayTeamId === league.userTid
    );
    
    if (hasUserGame) return i;
  }
  
  return null;
}

/**
 * Maybe injure a player on the team during/after a game
 * @param {number} teamId - Team ID to check for injuries
 */
function maybeInjurePlayer(teamId) {
  if (Math.random() > INJURY_CHANCE_PER_GAME) return;
  
  const team = league.teams.find(t => t.id === teamId);
  if (!team || !team.players || team.players.length === 0) return;
  
  // Get healthy players (exclude already injured)
  const healthyPlayers = team.players.filter(p => !p.injury || p.injury.gamesRemaining === 0);
  if (healthyPlayers.length === 0) return;
  
  // Pick random player (could be weighted by minutes in future)
  const player = healthyPlayers[Math.floor(Math.random() * healthyPlayers.length)];
  
  // Pick random injury type based on weights
  const totalWeight = INJURY_CATALOG.reduce((sum, inj) => sum + inj.weight, 0);
  let roll = Math.random() * totalWeight;
  let selectedInjury = INJURY_CATALOG[0];
  
  for (const injury of INJURY_CATALOG) {
    roll -= injury.weight;
    if (roll <= 0) {
      selectedInjury = injury;
      break;
    }
  }
  
  // Assign injury
  const gamesOut = Math.floor(Math.random() * (selectedInjury.maxGames - selectedInjury.minGames + 1)) + selectedInjury.minGames;
  
  if (!player.injury) {
    player.injury = { type: null, gamesRemaining: 0, severity: null };
  }
  
  player.injury.type = selectedInjury.type;
  player.injury.gamesRemaining = gamesOut;
  player.injury.severity = gamesOut <= 5 ? 'Minor' : gamesOut <= 10 ? 'Moderate' : 'Serious';
  
  if (DEBUG_INJURIES) {
    console.log(`[INJURY] ${player.name} (${team.name}) injured: ${selectedInjury.type} - Out ${gamesOut} games (${player.injury.severity})`);
  }
}

/**
 * Decrement injury timers for all players after their team plays a game
 */
function tickInjuriesAfterGame() {
  if (!league || !league.teams) return;
  
  for (const team of league.teams) {
    if (!team.players) continue;
    
    for (const player of team.players) {
      if (!player.injury || player.injury.gamesRemaining <= 0) continue;
      
      player.injury.gamesRemaining--;
      
      if (player.injury.gamesRemaining === 0) {
        if (DEBUG_INJURIES) {
          console.log(`[INJURY] ${player.name} (${team.name}) recovered from ${player.injury.type}`);
        }
        player.injury.type = null;
        player.injury.severity = null;
      }
    }
  }
}

function simGameInstant(gameId) {
  const game = league.schedule.games[gameId];
  if (!game || game.status === 'final') return;
  
  const homeTeam = league.teams.find(t => t.id === game.homeTeamId);
  const awayTeam = league.teams.find(t => t.id === game.awayTeamId);
  
  if (!homeTeam || !awayTeam) return;
  
  // Use existing simGame logic
  const result = simGame(homeTeam, awayTeam);
  
  // Update game object
  game.status = 'final';
  game.score = {
    home: result.homeScore,
    away: result.awayScore
  };
  game.quarter = 4;
  game.timeRemaining = '0:00';
  game.boxScore = result.boxScore || generateBasicBoxScore(homeTeam, awayTeam, result);
  
  // Add rivalry metadata
  game.isDivisionGame = homeTeam.division !== '—' && homeTeam.division === awayTeam.division;
  game.isPlayoffs = league.phase === 'playoffs';
  
  // Check for upset (winner was lower OVR by >= 5)
  const homeOvr = homeTeam.players.slice(0, 10).reduce((sum, p) => sum + p.ratings.ovr, 0) / 10;
  const awayOvr = awayTeam.players.slice(0, 10).reduce((sum, p) => sum + p.ratings.ovr, 0) / 10;
  const homeWon = game.score.home > game.score.away;
  game.upset = homeWon ? (homeOvr < awayOvr - 5) : (awayOvr < homeOvr - 5);
  
  // Add simple log entry
  game.log = [
    { quarter: 0, time: '12:00', text: 'Game Start' },
    { quarter: 4, time: '0:00', text: `Final Score: ${awayTeam.name} ${result.awayScore}, ${homeTeam.name} ${result.homeScore}` }
  ];
  
  // Update player season stats
  updatePlayerSeasonStats(game);
  
  // Update rivalry system
  updateRivalryFromGame(game);
  
  // Process injuries
  maybeInjurePlayer(game.homeTeamId);
  maybeInjurePlayer(game.awayTeamId);
  tickInjuriesAfterGame();
  
  // Update league phase based on game completion
  updateLeaguePhase();
  
  // Check for season events that should trigger
  if (typeof checkSeasonEvents === 'function') {
    checkSeasonEvents();
  }
  
  return game;
}

/* ============================
   EVENT-DRIVEN SIMULATION SYSTEM
   
   Season simulation is event-driven, not date-driven.
   Events are processed sequentially with pause points for user decisions.
============================ */

const EVENT_TYPES = {
  GAME: 'GAME',
  PHASE_TRANSITION: 'PHASE_TRANSITION',
  TRADE_DEADLINE: 'TRADE_DEADLINE',
  TRADE_OFFER: 'TRADE_OFFER',
  ALL_STAR_VOTING: 'ALL_STAR_VOTING',
  ALL_STAR_GAME: 'ALL_STAR_GAME',
  CONTRACT_OPTION: 'CONTRACT_OPTION',
  CONTRACT_EXTENSION: 'CONTRACT_EXTENSION',
  INJURY: 'INJURY',
  PLAYOFF_CLINCH: 'PLAYOFF_CLINCH',
  PLAYOFF_ELIMINATION: 'PLAYOFF_ELIMINATION'
};

/**
 * Initialize simulation state
 */
function initSimulationState() {
  return {
    eventQueue: [],           // Queue of events to process
    currentEventIndex: 0,     // Current position in queue
    isPaused: false,          // Whether simulation is paused
    pauseReason: null,        // Why simulation paused
    pauseEventData: null,     // Data for the paused event
    simLimit: null,           // Limit for current simulation (games, event, season, etc.)
    gamesSimulated: 0,        // Counter for current simulation run
    settings: {
      autoPauseOnInjuries: true,
      autoPauseOnTradeOffers: true,
      autoPauseOnPlayoffClinch: false,
      autoPauseOnPhaseChanges: true,
      simSpeed: 'normal'      // 'fast', 'normal', 'slow'
    }
  };
}

/**
 * Build event queue for the season
 * Queue contains all games and league events in order
 */
function buildEventQueue() {
  if (!league || !league.schedule || !league.schedule.days[league.season]) {
    console.warn('[SIM] Cannot build event queue: no schedule exists');
    return [];
  }
  
  const events = [];
  const days = league.schedule.days[league.season];
  const season = league.season;
  let eventId = 1;
  
  // Calculate key dates
  const totalGames = days.length;
  const tradeDeadlineGame = Math.floor(totalGames * 0.67); // ~67% through season
  const allStarGame = Math.floor(totalGames * 0.50); // Midseason
  
  // Add preseason -> regular season transition
  events.push({
    id: `event_${eventId++}`,
    type: EVENT_TYPES.PHASE_TRANSITION,
    fromPhase: 'PRESEASON',
    toPhase: 'REGULAR_SEASON',
    gameNumber: 0,
    description: 'Season begins'
  });
  
  // Add all games from schedule
  days.forEach((day, dayIndex) => {
    day.games.forEach(gameId => {
      const game = league.schedule.games[gameId];
      if (game && game.status !== 'final') {
        events.push({
          id: `event_${eventId++}`,
          type: EVENT_TYPES.GAME,
          gameId,
          gameNumber: dayIndex + 1,
          dayNumber: day.dayNumber,
          homeTeamId: game.homeTeamId,
          awayTeamId: game.awayTeamId,
          description: `Game ${dayIndex + 1}`
        });
      }
    });
    
    // Add trade deadline event
    if (dayIndex === tradeDeadlineGame) {
      events.push({
        id: `event_${eventId++}`,
        type: EVENT_TYPES.TRADE_DEADLINE,
        gameNumber: dayIndex + 1,
        description: 'Trade deadline reached'
      });
    }
    
    // Add All-Star events
    if (dayIndex === allStarGame - 1) {
      events.push({
        id: `event_${eventId++}`,
        type: EVENT_TYPES.ALL_STAR_VOTING,
        gameNumber: dayIndex + 1,
        description: 'All-Star voting'
      });
    }
    
    if (dayIndex === allStarGame) {
      events.push({
        id: `event_${eventId++}`,
        type: EVENT_TYPES.ALL_STAR_GAME,
        gameNumber: dayIndex + 1,
        description: 'All-Star Game'
      });
    }
  });
  
  // Add regular season -> playoffs transition
  events.push({
    id: `event_${eventId++}`,
    type: EVENT_TYPES.PHASE_TRANSITION,
    fromPhase: 'REGULAR_SEASON',
    toPhase: 'PLAYOFFS',
    gameNumber: totalGames + 1,
    description: 'Playoffs begin'
  });
  
  // Sort events by game number
  events.sort((a, b) => a.gameNumber - b.gameNumber);
  
  console.log(`[SIM] Built event queue: ${events.length} events`);
  return events;
}

/**
 * Check if simulation should pause for this event
 */
function checkShouldPause(event) {
  if (!league?.simulation) return false;
  
  const settings = league.simulation.settings;
  const userTid = league.userTid;
  
  switch (event.type) {
    case EVENT_TYPES.TRADE_OFFER:
      return settings.autoPauseOnTradeOffers && event.targetTeamId === userTid;
      
    case EVENT_TYPES.TRADE_DEADLINE:
      return true; // Always pause at trade deadline
      
    case EVENT_TYPES.PHASE_TRANSITION:
      return settings.autoPauseOnPhaseChanges;
      
    case EVENT_TYPES.ALL_STAR_VOTING:
      return true; // Always pause for user voting
      
    case EVENT_TYPES.CONTRACT_OPTION:
    case EVENT_TYPES.CONTRACT_EXTENSION:
      return event.teamId === userTid;
      
    case EVENT_TYPES.INJURY:
      return settings.autoPauseOnInjuries && event.severity === 'major';
      
    case EVENT_TYPES.PLAYOFF_CLINCH:
    case EVENT_TYPES.PLAYOFF_ELIMINATION:
      return settings.autoPauseOnPlayoffClinch && event.teamId === userTid;
      
    case EVENT_TYPES.GAME:
      // Never pause for games (processed continuously)
      return false;
      
    default:
      return false;
  }
}

/**
 * Process a single event
 */
function processEvent(event) {
  console.log(`[SIM] Processing event: ${event.type} (${event.description})`);
  
  switch (event.type) {
    case EVENT_TYPES.GAME:
      return processGameEvent(event);
      
    case EVENT_TYPES.PHASE_TRANSITION:
      return processPhaseTransition(event);
      
    case EVENT_TYPES.TRADE_DEADLINE:
      return processTradeDeadline(event);
      
    case EVENT_TYPES.TRADE_OFFER:
      return processTradeOffer(event);
      
    case EVENT_TYPES.ALL_STAR_VOTING:
      return processAllStarVoting(event);
      
    case EVENT_TYPES.ALL_STAR_GAME:
      return processAllStarGame(event);
      
    case EVENT_TYPES.CONTRACT_OPTION:
      return processContractOption(event);
      
    case EVENT_TYPES.INJURY:
      return processInjury(event);
      
    default:
      console.warn(`[SIM] Unknown event type: ${event.type}`);
      return { success: true };
  }
}

/**
 * Process game event (simulate the game)
 */
function processGameEvent(event) {
  const game = league.schedule.games[event.gameId];
  if (!game || game.status === 'final') {
    return { success: true, skipped: true };
  }
  
  // Simulate the game instantly
  simGameInstant(event.gameId);
  
  // Increment games simulated counter
  if (league.simulation) {
    league.simulation.gamesSimulated++;
  }
  
  return { success: true };
}

/**
 * Process phase transition
 */
function processPhaseTransition(event) {
  console.log(`[SIM] Phase transition: ${event.fromPhase} → ${event.toPhase}`);
  
  // Update league phase
  const phaseMap = {
    PRESEASON: 'PRESEASON',
    REGULAR_SEASON: 'REGULAR_SEASON',
    PLAYOFFS: 'POSTSEASON',
    OFFSEASON: 'OFFSEASON'
  };
  
  league.phase = phaseMap[event.toPhase] || event.toPhase;
  updateLeaguePhase();
  
  return {
    success: true,
    message: `${event.fromPhase} has ended. ${event.toPhase} begins.`
  };
}

/**
 * Process trade deadline
 */
function processTradeDeadline(event) {
  console.log(`[SIM] Trade deadline reached`);
  
  // Mark trade deadline as passed
  if (!league.tradeDeadlinePassed) {
    league.tradeDeadlinePassed = true;
  }
  
  return {
    success: true,
    message: 'Trade deadline has passed. No more trades allowed this season.'
  };
}

/**
 * Process trade offer (pauses simulation)
 */
function processTradeOffer(event) {
  console.log(`[SIM] Trade offer received`);
  
  // Store trade offer details
  return {
    success: true,
    pause: true,
    message: `Trade offer from ${event.fromTeamName}`,
    data: event.tradeOffer
  };
}

/**
 * Process All-Star voting
 */
function processAllStarVoting(event) {
  console.log(`[SIM] All-Star voting begins`);
  
  return {
    success: true,
    message: 'All-Star voting is open. Select your starters!'
  };
}

/**
 * Process All-Star Game
 */
function processAllStarGame(event) {
  console.log(`[SIM] All-Star Game`);
  
  return {
    success: true,
    message: 'All-Star Game completed.'
  };
}

/**
 * Process contract option decision
 */
function processContractOption(event) {
  console.log(`[SIM] Contract option decision`);
  
  return {
    success: true,
    pause: true,
    message: `Contract option decision for ${event.playerName}`,
    data: event
  };
}

/**
 * Process injury event
 */
function processInjury(event) {
  console.log(`[SIM] Injury: ${event.playerName} (${event.severity})`);
  
  return {
    success: true,
    message: `${event.playerName} injured (${event.severity})`
  };
}

/**
 * Main simulation loop
 * Processes events until simulation limit reached or pause required
 */
function runSimulation() {
  if (!league || !league.simulation) {
    console.error('[SIM] Cannot run simulation: no league or simulation state');
    return { success: false, error: 'No simulation state' };
  }
  
  const sim = league.simulation;
  
  // Build event queue if empty
  if (sim.eventQueue.length === 0) {
    sim.eventQueue = buildEventQueue();
    sim.currentEventIndex = 0;
  }
  
  // Reset games simulated counter
  sim.gamesSimulated = 0;
  sim.isPaused = false;
  sim.pauseReason = null;
  
  // Process events
  while (sim.currentEventIndex < sim.eventQueue.length) {
    const event = sim.eventQueue[sim.currentEventIndex];
    
    // Check if we should pause BEFORE processing
    if (checkShouldPause(event)) {
      sim.isPaused = true;
      sim.pauseReason = event.type;
      sim.pauseEventData = event;
      
      console.log(`[SIM] Paused at event: ${event.type} (${event.description})`);
      
      return {
        success: true,
        paused: true,
        reason: event.type,
        message: event.description,
        event: event
      };
    }
    
    // Process the event
    const result = processEvent(event);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Event processing failed'
      };
    }
    
    // Check if event requested a pause
    if (result.pause) {
      sim.isPaused = true;
      sim.pauseReason = event.type;
      sim.pauseEventData = event;
      
      return {
        success: true,
        paused: true,
        reason: event.type,
        message: result.message,
        event: event,
        data: result.data
      };
    }
    
    // Move to next event
    sim.currentEventIndex++;
    
    // Check simulation limit
    if (sim.simLimit) {
      if (sim.simLimit.type === 'games' && sim.gamesSimulated >= sim.simLimit.count) {
        console.log(`[SIM] Reached game limit: ${sim.simLimit.count}`);
        return {
          success: true,
          complete: true,
          message: `Simulated ${sim.gamesSimulated} games`
        };
      }
      
      if (sim.simLimit.type === 'untilEvent' && event.type !== EVENT_TYPES.GAME) {
        console.log(`[SIM] Reached next event: ${event.type}`);
        return {
          success: true,
          complete: true,
          message: event.description
        };
      }
    }
  }
  
  // Reached end of event queue
  console.log('[SIM] All events processed');
  return {
    success: true,
    complete: true,
    message: 'Season simulation complete'
  };
}

/**
 * Resume simulation from paused state
 */
function resumeSimulation() {
  if (!league?.simulation || !league.simulation.isPaused) {
    console.warn('[SIM] Cannot resume: simulation not paused');
    return { success: false, error: 'Simulation not paused' };
  }
  
  // Move past the paused event
  league.simulation.currentEventIndex++;
  league.simulation.isPaused = false;
  league.simulation.pauseReason = null;
  league.simulation.pauseEventData = null;
  
  // Continue simulation
  return runSimulation();
}

/**
 * Simulation control functions
 */

function simOneGame() {
  if (!league.simulation) {
    league.simulation = initSimulationState();
  }
  
  league.simulation.simLimit = {
    type: 'games',
    count: 1
  };
  
  return runSimulation();
}

function simUntilNextEvent() {
  if (!league.simulation) {
    league.simulation = initSimulationState();
  }
  
  league.simulation.simLimit = {
    type: 'untilEvent',
    stopOnNonGame: true
  };
  
  return runSimulation();
}

function simWeek() {
  if (!league.simulation) {
    league.simulation = initSimulationState();
  }
  
  // Week = 3-5 games
  league.simulation.simLimit = {
    type: 'games',
    count: rand(3, 5)
  };
  
  return runSimulation();
}

function simMonth() {
  if (!league.simulation) {
    league.simulation = initSimulationState();
  }
  
  // Month = 12-15 games
  league.simulation.simLimit = {
    type: 'games',
    count: rand(12, 15)
  };
  
  return runSimulation();
}

function simSeason() {
  if (!league.simulation) {
    league.simulation = initSimulationState();
  }
  
  // Simulate until end of season (no limit)
  league.simulation.simLimit = null;
  
  return runSimulation();
}

/* ============================
   SHOT LOCATION SYSTEM
   
   Discrete zone-based shooting for realistic play-by-play generation.
   Zones have distance ranges, base efficiencies, and shot types.
   Players have shot tendencies (weighted distribution across zones).
============================ */

const SHOT_ZONES = {
  RIM: {
    name: 'Rim',
    minDistance: 0,
    maxDistance: 3,
    baseEfficiency: 0.65, // 65% base make rate at rim
    shotTypes: ['dunk', 'layup', 'finger roll'],
    isThree: false
  },
  PAINT: {
    name: 'Paint',
    minDistance: 3,
    maxDistance: 10,
    baseEfficiency: 0.52,
    shotTypes: ['floater', 'hook shot', 'close jumper'],
    isThree: false
  },
  MID_RANGE: {
    name: 'Mid-Range',
    minDistance: 10,
    maxDistance: 16,
    baseEfficiency: 0.42,
    shotTypes: ['jumper', 'pull-up'],
    isThree: false
  },
  LONG_MID: {
    name: 'Long Mid-Range',
    minDistance: 16,
    maxDistance: 23,
    baseEfficiency: 0.38,
    shotTypes: ['long two', 'elbow jumper'],
    isThree: false
  },
  CORNER_3: {
    name: 'Corner Three',
    minDistance: 22,
    maxDistance: 24,
    baseEfficiency: 0.37, // Corner 3s are easier
    shotTypes: ['corner three', 'three-pointer'],
    isThree: true
  },
  WING_3: {
    name: 'Wing Three',
    minDistance: 23,
    maxDistance: 26,
    baseEfficiency: 0.35,
    shotTypes: ['three-pointer', 'step-back three'],
    isThree: true
  },
  DEEP_3: {
    name: 'Deep Three',
    minDistance: 26,
    maxDistance: 35,
    baseEfficiency: 0.28, // Deep shots are harder
    shotTypes: ['deep three', 'logo three'],
    isThree: true
  }
};

/**
 * Generate default shot tendencies based on player position and ratings
 * Returns normalized distribution across zones
 */
function generateDefaultShotTendencies(player) {
  const { pos } = player;
  const { athleticism, shoot } = player.ratings;
  
  // Base distributions by position
  const baseTendencies = {
    PG: { RIM: 0.20, PAINT: 0.10, MID_RANGE: 0.15, LONG_MID: 0.10, CORNER_3: 0.10, WING_3: 0.25, DEEP_3: 0.10 },
    SG: { RIM: 0.15, PAINT: 0.10, MID_RANGE: 0.20, LONG_MID: 0.10, CORNER_3: 0.15, WING_3: 0.20, DEEP_3: 0.10 },
    SF: { RIM: 0.25, PAINT: 0.15, MID_RANGE: 0.15, LONG_MID: 0.10, CORNER_3: 0.15, WING_3: 0.15, DEEP_3: 0.05 },
    PF: { RIM: 0.35, PAINT: 0.20, MID_RANGE: 0.15, LONG_MID: 0.10, CORNER_3: 0.10, WING_3: 0.08, DEEP_3: 0.02 },
    C: { RIM: 0.50, PAINT: 0.25, MID_RANGE: 0.10, LONG_MID: 0.08, CORNER_3: 0.04, WING_3: 0.02, DEEP_3: 0.01 }
  };
  
  const base = baseTendencies[pos] || baseTendencies.SF;
  const tendencies = { ...base };
  
  // Adjust based on athleticism (more athletic = more rim attempts)
  if (athleticism > 75) {
    tendencies.RIM += 0.05;
    tendencies.MID_RANGE -= 0.05;
  } else if (athleticism < 50) {
    tendencies.RIM -= 0.05;
    tendencies.MID_RANGE += 0.05;
  }
  
  // Adjust based on shooting (better shooters take more threes)
  if (shoot > 75) {
    tendencies.WING_3 += 0.05;
    tendencies.DEEP_3 += 0.03;
    tendencies.PAINT -= 0.08;
  } else if (shoot < 50) {
    tendencies.WING_3 -= 0.05;
    tendencies.RIM += 0.05;
  }
  
  // Normalize to ensure sum = 1.0
  const sum = Object.values(tendencies).reduce((a, b) => a + b, 0);
  Object.keys(tendencies).forEach(zone => {
    tendencies[zone] = tendencies[zone] / sum;
  });
  
  return tendencies;
}

/**
 * Select shot zone using weighted random based on player tendencies
 */
function selectShotZone(player) {
  if (!player.shotTendencies) {
    player.shotTendencies = generateDefaultShotTendencies(player);
  }
  
  const rand = Math.random();
  let cumulative = 0;
  
  for (const [zoneName, weight] of Object.entries(player.shotTendencies)) {
    cumulative += weight;
    if (rand < cumulative) {
      return zoneName;
    }
  }
  
  // Fallback (shouldn't happen if tendencies sum to 1.0)
  return 'MID_RANGE';
}

/**
 * Generate random distance within zone's range
 */
function generateShotDistance(zoneName) {
  const zone = SHOT_ZONES[zoneName];
  const distance = zone.minDistance + Math.random() * (zone.maxDistance - zone.minDistance);
  return Math.round(distance);
}

/**
 * Determine shot type based on zone and player athleticism
 */
function determineShotType(zoneName, player) {
  const zone = SHOT_ZONES[zoneName];
  const shotTypes = zone.shotTypes;
  
  // For RIM shots, high athleticism players get more dunks
  if (zoneName === 'RIM') {
    const { athleticism } = player.ratings;
    if (athleticism > 70 && Math.random() < 0.6) {
      return 'dunk';
    } else if (Math.random() < 0.5) {
      return 'layup';
    } else {
      return 'finger roll';
    }
  }
  
  // For other zones, random selection from available types
  return shotTypes[Math.floor(Math.random() * shotTypes.length)];
}

/**
 * Resolve shot attempt: calculate make chance and determine outcome
 * 
 * Formula: makeChance = zoneEfficiency * (1 + shooterBonus - defenderPenalty - fatiguePenalty)
 * - zoneEfficiency: base efficiency from SHOT_ZONES
 * - shooterBonus: (shootRating - 50) / 200 (ranges from -0.25 to +0.25)
 * - defenderPenalty: defenseRating / 400 (ranges from 0 to +0.25)
 * - fatiguePenalty: 0 to 0.15 based on minutes played
 */
function resolveShotAttempt(zoneName, shooter, defender, fatigue = 1.0) {
  const zone = SHOT_ZONES[zoneName];
  const { shoot } = shooter.ratings;
  const defenseRating = defender?.ratings?.defense || 50;
  
  // Calculate modifiers
  const shooterBonus = (shoot - 50) / 200; // -0.25 to +0.25
  const defenderPenalty = defenseRating / 400; // 0 to +0.25
  const fatiguePenalty = (1 - fatigue) * 0.15; // 0 to 0.15
  
  // Calculate final make chance
  let makeChance = zone.baseEfficiency * (1 + shooterBonus - defenderPenalty - fatiguePenalty);
  
  // Clamp between 5% and 85%
  makeChance = Math.max(0.05, Math.min(0.85, makeChance));
  
  const made = Math.random() < makeChance;
  const points = made ? (zone.isThree ? 3 : 2) : 0;
  
  return {
    made,
    points,
    isThree: zone.isThree
  };
}

/**
 * Generate play-by-play text for shot attempt
 */
function generateShotPlayText(player, distance, shotType, result) {
  const { made } = result;
  const outcome = made ? 'Made' : 'Missed';
  
  // Format shot description
  let shotDescription = `${player.name} ${distance}' ${shotType}`;
  
  // Add flair for special shots
  if (shotType === 'dunk') {
    shotDescription = made 
      ? `${player.name} throws down a thunderous dunk!` 
      : `${player.name} attempts a dunk`;
  } else if (shotType === 'deep three' || shotType === 'logo three') {
    shotDescription = `${player.name} launches a deep ${distance}' three`;
  }
  
  return `${shotDescription} — ${outcome}`;
}

function generateBasicBoxScore(homeTeam, awayTeam, result) {
  return {
    home: {
      teamId: homeTeam.id,
      teamName: homeTeam.name,
      score: result.homeScore,
      players: homeTeam.players.slice(0, 10).map(p => ({
        playerId: p.id,
        name: p.name,
        pts: Math.floor(Math.random() * 20),
        reb: Math.floor(Math.random() * 10),
        ast: Math.floor(Math.random() * 8),
        min: Math.floor(Math.random() * 35) + 5
      }))
    },
    away: {
      teamId: awayTeam.id,
      teamName: awayTeam.name,
      score: result.awayScore,
      players: awayTeam.players.slice(0, 10).map(p => ({
        playerId: p.id,
        name: p.name,
        pts: Math.floor(Math.random() * 20),
        reb: Math.floor(Math.random() * 10),
        ast: Math.floor(Math.random() * 8),
        min: Math.floor(Math.random() * 35) + 5
      }))
    }
  };
}

function startLiveGame(gameId) {
  const game = league.schedule.games[gameId];
  if (!game || game.status === 'final') return false;
  
  game.status = 'live';
  game.quarter = 1;
  game.timeRemaining = '12:00';
  game.score = { home: 0, away: 0 };
  
  // Initialize log if it doesn't exist, or preserve existing log
  if (!game.log) {
    game.log = [];
  }
  
  // Only add tip-off if log is empty (avoid duplicates)
  if (game.log.length === 0) {
    game.log.push({ quarter: 1, time: '12:00', text: 'Tip-off!', scored: false, score: null });
  }
  
  // Initialize box score for live games
  const homeTeam = league.teams.find(t => t.id === game.homeTeamId);
  const awayTeam = league.teams.find(t => t.id === game.awayTeamId);
  if (!game.boxScore && homeTeam && awayTeam) {
    game.boxScore = {
      home: {
        teamId: homeTeam.id,
        teamName: homeTeam.name,
        score: 0,
        players: homeTeam.players.slice(0, 10).map(p => ({
          playerId: p.id,
          name: p.name,
          pts: 0,
          reb: 0,
          ast: 0,
          stl: 0,
          blk: 0,
          to: 0,
          min: 0
        }))
      },
      away: {
        teamId: awayTeam.id,
        teamName: awayTeam.name,
        score: 0,
        players: awayTeam.players.slice(0, 10).map(p => ({
          playerId: p.id,
          name: p.name,
          pts: 0,
          reb: 0,
          ast: 0,
          stl: 0,
          blk: 0,
          to: 0,
          min: 0
        }))
      }
    };
  }
  
  game.possession = Math.random() < 0.5 ? 'home' : 'away';
  game.gameTime = 720; // 12 minutes in seconds
  
  if (typeof DEBUG_PLAYS !== 'undefined' && DEBUG_PLAYS) {
    console.log(`[PLAYS] startLiveGame: ${gameId}, log initialized with ${game.log.length} entries`);
  }
  
  return true;
}

function stepLiveGame(gameId) {
  const game = league.schedule.games[gameId];
  if (!game || game.status !== 'live') return false;
  
  // Ensure log array exists
  if (!game.log || !Array.isArray(game.log)) {
    game.log = [];
  }
  
  const homeTeam = league.teams.find(t => t.id === game.homeTeamId);
  const awayTeam = league.teams.find(t => t.id === game.awayTeamId);
  
  if (!homeTeam || !awayTeam) return false;
  
  // Advance time (each step = ~10-20 seconds of game time)
  const timeStep = Math.floor(Math.random() * 10) + 10;
  game.gameTime -= timeStep;
  
  // Update time remaining display
  const minutes = Math.floor(game.gameTime / 60);
  const seconds = game.gameTime % 60;
  game.timeRemaining = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  // Update player minutes in box score (distribute minutes to active players)
  if (game.boxScore) {
    const minutesPlayed = Math.round(timeStep / 60 * 10) / 10; // Convert to minutes
    ['home', 'away'].forEach(side => {
      // Add minutes to first 5-8 players (starters + some bench)
      const activePlayers = game.boxScore[side].players.slice(0, Math.min(8, game.boxScore[side].players.length));
      activePlayers.forEach(p => {
        p.min = Math.round((p.min + minutesPlayed / activePlayers.length) * 10) / 10;
      });
    });
  }
  
  // Generate play-by-play event
  const possessionTeam = game.possession === 'home' ? homeTeam : awayTeam;
  const defendingTeam = game.possession === 'home' ? awayTeam : homeTeam;
  const player = possessionTeam.players[Math.floor(Math.random() * Math.min(5, possessionTeam.players.length))];
  
  const events = [
    { type: 'shot', chance: 0.4 },
    { type: 'turnover', chance: 0.15 },
    { type: 'foul', chance: 0.1 },
    { type: 'rebound', chance: 0.2 },
    { type: 'pass', chance: 0.15 }
  ];
  
  const rand = Math.random();
  let cumulative = 0;
  let eventType = 'pass';
  
  for (const event of events) {
    cumulative += event.chance;
    if (rand < cumulative) {
      eventType = event.type;
      break;
    }
  }
  
  let logText = '';
  let scored = false;
  
  switch (eventType) {
    case 'shot':
      // === NEW ZONE-BASED SHOT SYSTEM ===
      
      // 1. Select shot zone based on player tendencies
      const zoneName = selectShotZone(player);
      
      // 2. Generate distance within zone range
      const distance = generateShotDistance(zoneName);
      
      // 3. Determine shot type (dunk, layup, jumper, etc.)
      const shotType = determineShotType(zoneName, player);
      
      // 4. Get random defender for contest
      const defender = defendingTeam.players[Math.floor(Math.random() * Math.min(5, defendingTeam.players.length))];
      
      // 5. Calculate fatigue (simple version for live game)
      const minutesPlayed = game.boxScore 
        ? (game.boxScore[game.possession === 'home' ? 'home' : 'away'].players.find(p => p.playerId === player.id)?.min || 0)
        : 0;
      const fatigue = minutesPlayed > 35 ? 0.95 : 1.0;
      
      // 6. Resolve shot attempt
      const shotResult = resolveShotAttempt(zoneName, player, defender, fatigue);
      
      // 7. Update score if made
      if (shotResult.made) {
        if (game.possession === 'home') {
          game.score.home += shotResult.points;
        } else {
          game.score.away += shotResult.points;
        }
        scored = true;
        
        // Update box score
        if (game.boxScore) {
          const side = game.possession === 'home' ? 'home' : 'away';
          const boxPlayer = game.boxScore[side].players.find(p => p.playerId === player.id);
          if (boxPlayer) {
            boxPlayer.pts += shotResult.points;
          }
        }
      }
      
      // 8. Generate play-by-play text with distance and shot type
      logText = generateShotPlayText(player, distance, shotType, shotResult);
      
      // Change possession after shot
      game.possession = game.possession === 'home' ? 'away' : 'home';
      break;
      
    case 'turnover':
      logText = `Turnover by ${player.name}!`;
      
      // Update box score
      if (game.boxScore) {
        const side = game.possession === 'home' ? 'home' : 'away';
        const boxPlayer = game.boxScore[side].players.find(p => p.playerId === player.id);
        if (boxPlayer) {
          boxPlayer.to += 1;
        }
      }
      
      game.possession = game.possession === 'home' ? 'away' : 'home';
      break;
      
    case 'foul':
      const foulDefender = defendingTeam.players[Math.floor(Math.random() * Math.min(5, defendingTeam.players.length))];
      logText = `Foul by ${foulDefender.name} on ${player.name}.`;
      break;
      
    case 'rebound':
      logText = `${player.name} grabs the rebound.`;
      
      // Update box score
      if (game.boxScore) {
        const side = game.possession === 'home' ? 'home' : 'away';
        const boxPlayer = game.boxScore[side].players.find(p => p.playerId === player.id);
        if (boxPlayer) {
          boxPlayer.reb += 1;
        }
      }
      
      break;
      
    default:
      logText = `${player.name} passes to teammate.`;
  }
  
  game.log.push({
    quarter: game.quarter,
    time: game.timeRemaining,
    text: logText,
    scored: scored,
    score: scored ? { home: game.score.home, away: game.score.away } : null
  });
  
  if (typeof DEBUG_PLAYS !== 'undefined' && DEBUG_PLAYS) {
    console.log(`[PLAYS] stepLiveGame: ${gameId}, log now has ${game.log.length} entries`);
  }
  
  // Check for quarter end
  if (game.gameTime <= 0) {
    if (game.quarter < 4) {
      game.quarter++;
      game.gameTime = 720;
      game.timeRemaining = '12:00';
      game.log.push({
        quarter: game.quarter,
        time: '12:00',
        text: `End of Q${game.quarter - 1}. Score: ${awayTeam.name} ${game.score.away}, ${homeTeam.name} ${game.score.home}`
      });
    } else {
      finishLiveGame(gameId);
    }
  }
  
  return true;
}

function finishLiveGame(gameId) {
  const game = league.schedule.games[gameId];
  if (!game) return;
  
  game.status = 'final';
  game.quarter = 4;
  game.timeRemaining = '0:00';
  
  const homeTeam = league.teams.find(t => t.id === game.homeTeamId);
  const awayTeam = league.teams.find(t => t.id === game.awayTeamId);
  
  // Update team records
  if (game.score.home > game.score.away) {
    homeTeam.wins++;
    awayTeam.losses++;
  } else {
    awayTeam.wins++;
    homeTeam.losses++;
  }
  
  // Generate box score if not exists
  if (!game.boxScore) {
    game.boxScore = generateBasicBoxScore(homeTeam, awayTeam, {
      homeScore: game.score.home,
      awayScore: game.score.away
    });
  }
  
  game.log.push({
    quarter: 4,
    time: '0:00',
    text: `FINAL: ${awayTeam.name} ${game.score.away}, ${homeTeam.name} ${game.score.home}`
  });
  
  // Stop any active live game loop
  if (activeLiveGames.has(gameId)) {
    clearInterval(activeLiveGames.get(gameId));
    activeLiveGames.delete(gameId);
  }
  
  // Update player season stats
  updatePlayerSeasonStats(game);
  
  // Update league phase
  updateLeaguePhase();
  
  updateTeamPayrolls();
}

function simEntireDay(season, dayNumber) {
  const games = getGamesForDay(season, dayNumber);
  
  games.forEach(game => {
    if (game.status === 'scheduled') {
      simGameInstant(game.id);
    }
  });
  
  // Mark day as simulated
  const day = getScheduleDay(season, dayNumber);
  if (day) {
    day.simulated = true;
  }
  
  // Update league phase after simulating all games
  updateLeaguePhase();
  
  save();
}

// Team Stats & Metrics
function getTeamOverall(team) {
  const topPlayers = team.players
    .sort((a, b) => b.ratings.ovr - a.ratings.ovr)
    .slice(0, 8);
  
  if (topPlayers.length === 0) return 50;
  
  const totalOvr = topPlayers.reduce((sum, p) => sum + p.ratings.ovr, 0);
  return Math.round(totalOvr / topPlayers.length);
}

function getTeamOffense(team) {
  const topPlayers = team.players
    .sort((a, b) => b.ratings.ovr - a.ratings.ovr)
    .slice(0, 8);
  
  if (topPlayers.length === 0) return 50;
  
  const totalShoot = topPlayers.reduce((sum, p) => sum + p.ratings.shoot, 0);
  return Math.round(totalShoot / topPlayers.length);
}

function getTeamDefense(team) {
  const topPlayers = team.players
    .sort((a, b) => b.ratings.ovr - a.ratings.ovr)
    .slice(0, 8);
  
  if (topPlayers.length === 0) return 50;
  
  const totalDef = topPlayers.reduce((sum, p) => sum + p.ratings.defense, 0);
  return Math.round(totalDef / topPlayers.length);
}

function getPowerRank(teamId) {
  const rankedTeams = league.teams
    .map(t => ({ id: t.id, overall: getTeamOverall(t) }))
    .sort((a, b) => b.overall - a.overall);
  
  const rank = rankedTeams.findIndex(t => t.id === teamId) + 1;
  return rank;
}

function getTeamEfficiencyStats(team) {
  const offense = getTeamOffense(team);
  const defense = getTeamDefense(team);
  
  // Proxy metrics based on ratings (stable per team)
  const efg = Math.round(45 + (offense - 70) * 0.2); // ~45-55%
  const tov = Math.round(18 - (offense - 70) * 0.1); // ~13-23%
  const orb = Math.round(25 + (defense - 70) * 0.15); // ~20-30%
  const ftRate = Math.round(20 + (offense - 70) * 0.12); // ~15-25%
  
  return {
    efg: Math.max(40, Math.min(60, efg)),
    tov: Math.max(10, Math.min(25, tov)),
    orb: Math.max(15, Math.min(35, orb)),
    ftRate: Math.max(10, Math.min(30, ftRate))
  };
}

function updateTeamPayrolls() {
  const teams = leagueState?.teams || league?.teams;
  if (teams) {
    teams.forEach(team => {
      team.payroll = team.players.reduce((sum, p) => sum + p.contract.amount, 0);
    });
  }
}

/* ============================
   PRESEASON SYSTEM
============================ */

/**
 * Generate preseason schedule if enabled
 */
function generatePreseasonScheduleIfNeeded() {
  if (!league || !league.settings || !league.settings.enablePreseason) return;
  
  const preseasonGames = league.settings.preseasonGames || 2;
  
  console.log(`[Preseason] Generating ${preseasonGames} games per team`);
  
  if (typeof generatePreseasonSchedule === 'function') {
    const preseasonSchedule = generatePreseasonSchedule(league.teams, league.season, preseasonGames);
    
    // Merge preseason games into main schedule
    if (!league.schedule.preseasonGames) {
      league.schedule.preseasonGames = {};
    }
    
    league.schedule.preseasonGames = preseasonSchedule.games;
    console.log(`[Preseason] Added ${Object.keys(preseasonSchedule.games).length} preseason games`);
  }
}

/**
 * Apply preseason modifiers to game simulation
 * Reduces injury/fatigue and increases development
 */
function applyPreseasonModifiers(game) {
  if (!game || !game.isPreseason) return {};
  
  const settings = league?.settings || {};
  
  return {
    injuryReduction: settings.preseasonInjuryReduction || 0.5,
    fatigueReduction: settings.preseasonFatigueReduction || 0.6,
    developmentBoost: settings.preseasonDevelopmentBoost || 1.5,
    countsForStandings: false, // Preseason games don't affect standings
    countsForStats: false // Preseason games don't count for official stats/awards
  };
}

/**
 * Create training camp contract for a player
 */
function createTrainingCampContract(player, salary = 1, duration = 1) {
  if (!player) return;
  
  player.contract = {
    amount: salary,
    exp: league ? league.season + duration : new Date().getFullYear() + duration,
    yearsRemaining: duration,
    totalValue: salary * duration,
    startYear: league ? league.season : new Date().getFullYear(),
    hasPlayerOption: false,
    hasTeamOption: false,
    type: 'training_camp',
    guaranteed: 0, // 0% guaranteed
    isTrainingCamp: true
  };
  
  console.log(`[Preseason] Created training camp contract for ${player.name}`);
}

/**
 * Calculate cap penalty for waiving a player
 * Based on contract guarantee percentage
 */
function calculateWaiverCapPenalty(player) {
  if (!player || !player.contract) return 0;
  
  const contract = player.contract;
  const guaranteedPct = contract.guaranteed || 100; // Default to fully guaranteed
  
  // Training camp contracts have no penalty
  if (contract.isTrainingCamp || contract.type === 'training_camp') {
    return 0;
  }
  
  // Calculate guaranteed portion
  const totalRemaining = contract.amount * contract.yearsRemaining;
  const guaranteedAmount = totalRemaining * (guaranteedPct / 100);
  
  return guaranteedAmount;
}

/**
 * Waive a player with proper cap accounting
 */
function waivePlayer(team, player) {
  // Check if waiving players is allowed
  if (!isActionAllowed(ACTIONS.WAIVE)) {
    const reason = getActionLockReason(ACTIONS.WAIVE);
    return { success: false, error: reason };
  }
  
  if (!team || !player) return { success: false, error: 'Team or player not found' };
  
  const capPenalty = calculateWaiverCapPenalty(player);
  
  console.log(`[Roster] Waiving ${player.name} - Cap penalty: $${capPenalty.toFixed(1)}M`);
  
  // Remove from team
  const playerIndex = team.players.findIndex(p => p.id === player.id);
  if (playerIndex === -1) return { success: false, error: 'Player not found on roster' };
  
  team.players.splice(playerIndex, 1);
  
  // Add cap penalty if applicable
  if (capPenalty > 0) {
    if (!team.capPenalties) team.capPenalties = [];
    team.capPenalties.push({
      playerId: player.id,
      playerName: player.name,
      amount: capPenalty,
      yearsRemaining: player.contract.yearsRemaining,
      waivedYear: league.season
    });
  }
  
  // Add to free agent pool
  player.teamId = null;
  if (league.freeAgents) {
    league.freeAgents.push(player);
  }
  
  return { success: true };
}

/**
 * Check roster limit for preseason vs regular season
 */
function getRosterLimit(team) {
  if (!league || !league.settings) return 15;
  
  const isPreseason = league.phase === 'preseason';
  const settings = league.settings;
  
  if (isPreseason && settings.enablePreseason) {
    return settings.preseasonRosterLimit || 20;
  }
  
  return settings.maxRosterSize || 15;
}

/**
 * Transition from Preseason to Regular Season (Opening Day)
 * - Auto-waive excess players
 * - Expire training camp contracts
 * - Change phase to 'season'
 */
function transitionToRegularSeason() {
  if (!league) return;
  
  console.log('[Opening Day] Transitioning from Preseason to Regular Season');
  
  const settings = league.settings;
  const regularRosterLimit = settings.maxRosterSize || 15;
  
  // Process each team
  league.teams.forEach(team => {
    console.log(`[Opening Day] Processing ${team.name} roster`);
    
    // Step 1: Auto-expire training camp contracts that weren't promoted
    const trainingCampPlayers = team.players.filter(p => 
      p.contract && p.contract.isTrainingCamp
    );
    
    trainingCampPlayers.forEach(player => {
      console.log(`[Opening Day] Training camp contract expired: ${player.name}`);
      const result = waivePlayer(team, player);
      if (!result.success) {
        console.warn(`[Opening Day] Failed to waive ${player.name}: ${result.error}`);
      }
    });
    
    // Step 2: Check if roster exceeds regular season limit
    if (team.players.length > regularRosterLimit) {
      const excessCount = team.players.length - regularRosterLimit;
      console.log(`[Opening Day] ${team.name} has ${excessCount} excess players`);
      
      // Sort by OVR (lowest first) to determine who to cut
      const sortedPlayers = [...team.players].sort((a, b) => 
        a.ratings.ovr - b.ratings.ovr
      );
      
      // Auto-waive lowest-rated players (AI teams only)
      if (!team.isUserTeam) {
        for (let i = 0; i < excessCount; i++) {
          const playerToCut = sortedPlayers[i];
          console.log(`[Opening Day] Auto-waiving ${playerToCut.name} (${playerToCut.ratings.ovr} OVR)`);
          const result = waivePlayer(team, playerToCut);
          if (!result.success) {
            console.warn(`[Opening Day] Failed to waive ${playerToCut.name}: ${result.error}`);
          }
        }
      } else {
        // For user team, just log warning - they must manually cut
        console.warn(`[Opening Day] User team has ${excessCount} excess players - manual cuts required`);
      }
    }
  });
  
  // Update league phase
  league.phase = 'season';
  leagueState.meta.phase = 'season';
  
  console.log('[Opening Day] Transition complete - Regular season ready');
  
  saveLeagueState();
}

/**
 * Promote training camp player to regular roster
 * Converts training camp contract to standard contract
 */
function promoteTrainingCampPlayer(team, player, newSalary, years = 2) {
  if (!player || !player.contract || !player.contract.isTrainingCamp) {
    console.error('[Roster] Cannot promote - not a training camp player');
    return false;
  }
  
  console.log(`[Roster] Promoting ${player.name} to regular roster`);
  
  player.contract = {
    amount: newSalary,
    exp: league.season + years,
    yearsRemaining: years,
    totalValue: newSalary * years,
    startYear: league.season,
    hasPlayerOption: false,
    hasTeamOption: false,
    type: 'standard',
    guaranteed: 100,
    isTrainingCamp: false
  };
  
  return true;
}


/* ============================
   FAN HYPE SYSTEM
============================ */

/**
 * Calculate Fan Hype for a team based on multiple factors
 * @param {Object} team - Team object
 * @returns {number} Hype value (0-100)
 */
function calculateTeamHype(team) {
  if (!team) return 50;
  
  let hype = 50; // Base neutral hype
  
  // 1) WIN PERCENTAGE (±25 points)
  const totalGames = team.wins + team.losses;
  if (totalGames > 0) {
    const winPct = team.wins / totalGames;
    const winBonus = (winPct - 0.5) * 50; // -25 to +25
    hype += winBonus;
  }
  
  // 2) RECENT STREAK (±15 points)
  if (team.stats && team.stats.streak) {
    const streakBonus = clamp(team.stats.streak * 1.5, -15, 15);
    hype += streakBonus;
  }
  
  // 3) STAR POWER (±10 points)
  if (team.players && team.players.length > 0) {
    const topPlayer = team.players.reduce((best, p) => 
      (p.ratings.ovr > best.ratings.ovr) ? p : best
    , team.players[0]);
    const starBonus = (topPlayer.ratings.ovr - 70) * 0.5; // -10 to +15
    hype += clamp(starBonus, -10, 10);
  }
  
  // 4) PLAYOFF PERFORMANCE (bonus from history)
  if (team.championships && team.championships > 0) {
    hype += team.championships * 5; // +5 per championship (max +25)
  }
  
  // 5) EXPECTATION vs REALITY
  if (totalGames > 10) {
    const expectedWins = totalGames * 0.5; // Baseline expectation
    const overperformance = (team.wins - expectedWins) / totalGames;
    hype += overperformance * 10; // ±10 points
  }
  
  return clamp(hype, 0, 100);
}

/**
 * Update team hype after a game result
 * @param {Object} team - Team object
 * @param {boolean} won - Whether team won
 * @param {number} scoreDiff - Point differential (positive = team won by X)
 */
function updateTeamHype(team, won, scoreDiff = 0) {
  if (!team) return;
  
  // Initialize hype if missing (for old saves)
  if (team.hype === undefined) team.hype = 50;
  if (!team.hypeHistory) team.hypeHistory = [];
  
  // Calculate new hype based on all factors
  const newHype = calculateTeamHype(team);
  
  // Apply immediate reaction to game result
  let hypeChange = 0;
  if (won) {
    hypeChange = 1 + (scoreDiff / 20); // Blowout wins boost hype more
    if (team.stats && team.stats.streak > 5) {
      hypeChange += 1; // Hot streak bonus
    }
  } else {
    hypeChange = -1 - (Math.abs(scoreDiff) / 20); // Blowout losses hurt more
    if (team.stats && team.stats.streak < -5) {
      hypeChange -= 1; // Cold streak penalty
    }
  }
  
  // Apply change
  team.hype = clamp(newHype + hypeChange, 0, 100);
  
  // Record history (keep last 30 data points)
  team.hypeHistory.push({
    day: leagueState ? leagueState.meta.day : 0,
    hype: team.hype,
    result: won ? 'W' : 'L',
    scoreDiff: scoreDiff
  });
  
  if (team.hypeHistory.length > 30) {
    team.hypeHistory.shift();
  }
}

/**
 * Get effects of hype on team operations
 * @param {number} hype - Team hype value (0-100)
 * @returns {Object} Effects object with multipliers
 */
function getHypeEffects(hype) {
  if (hype === undefined) hype = 50;
  
  // Normalize hype to -1 to +1 scale (50 = neutral)
  const hypeNorm = (hype - 50) / 50;
  
  return {
    // Attendance: Low hype = empty seats, high hype = sellouts
    // Range: 0.6x to 1.4x
    attendance: clamp(1.0 + (hypeNorm * 0.4), 0.6, 1.4),
    
    // Revenue: Tied to attendance + merchandise sales
    // Range: 0.5x to 1.5x
    revenue: clamp(1.0 + (hypeNorm * 0.5), 0.5, 1.5),
    
    // Morale: High hype can pressure team, very low hype damages morale
    // Range: -10 to +5 morale points
    moraleChange: hype < 20 ? -10 : (hype > 80 ? -3 : (hypeNorm * 5)),
    
    // Front Office Pressure: Expectations create pressure
    // 0 = no pressure, 100 = extreme pressure
    pressure: hype > 70 ? (hype - 70) * 2 : 0,
    
    // Media Tone: Affects narrative generation
    mediaTone: hype < 30 ? 'critical' : 
               hype < 50 ? 'skeptical' :
               hype < 70 ? 'optimistic' : 'euphoric'
  };
}

/**
 * Apply hype effects to team morale
 * Should be called weekly or after key events
 * @param {Object} team - Team object
 */
function applyHypeMoraleEffects(team) {
  if (!team) return;
  
  // Initialize morale if missing
  if (team.morale === undefined) team.morale = 75;
  if (team.hype === undefined) team.hype = 50;
  
  const hypeEffects = getHypeEffects(team.hype);
  
  // Apply morale change from hype
  const moraleChange = hypeEffects.moraleChange;
  
  // Apply change gradually (max ±2 per update to prevent wild swings)
  const gradualChange = clamp(moraleChange * 0.2, -2, 2);
  team.morale = clamp(team.morale + gradualChange, 0, 100);
}

/**
 * Get pressure level description based on hype
 * @param {Object} team - Team object
 * @returns {Object} Pressure info
 */
function getHypePressureInfo(team) {
  if (!team) return { level: 0, description: 'None', color: '#4ade80' };
  
  const hypeEffects = getHypeEffects(team.hype || 50);
  const pressure = hypeEffects.pressure;
  
  if (pressure === 0) {
    return { level: 0, description: 'None', color: '#4ade80' };
  } else if (pressure < 20) {
    return { level: pressure, description: 'Mild Expectations', color: '#fbbf24' };
  } else if (pressure < 40) {
    return { level: pressure, description: 'Moderate Pressure', color: '#fb923c' };
  } else if (pressure < 60) {
    return { level: pressure, description: 'High Pressure', color: '#ef4444' };
  } else {
    return { level: pressure, description: 'Championship or Bust', color: '#dc2626' };
  }
}

// Coach impact on game simulation
function getCoachGameModifier(coach, morale) {
  if (!coach) return { offense: 1.0, defense: 1.0, morale: 1.0 };
  
  // Offense/Defense modifiers: 0.97 to 1.03 (3% max swing)
  const offenseMod = 1.0 + (coach.ratings.offense - 60) * 0.0005;
  const defenseMod = 1.0 + (coach.ratings.defense - 60) * 0.0005;
  
  // Morale affects performance (motivation + confidence)
  const moraleBase = (morale - 75) / 100; // -0.75 to +0.25
  const motivationFactor = (coach.ratings.motivation - 60) * 0.001;
  const moraleMod = 1.0 + (moraleBase * motivationFactor);
  
  return {
    offense: clamp(offenseMod, 0.97, 1.03),
    defense: clamp(defenseMod, 0.97, 1.03),
    morale: clamp(moraleMod, 0.98, 1.02)
  };
}

/* ============================
   GAME SIMULATION
============================ */

function simGame(teamA, teamB) {
  const possessions = 95;
  let scoreA = 0;
  let scoreB = 0;
  
  // Get rotation players using minute targets if available
  const rotationA = getGameRotation(teamA);
  const rotationB = getGameRotation(teamB);
  
  // Initialize minutes tracker
  const minutes = new Map();
  rotationA.forEach(p => minutes.set(p.id, 0));
  rotationB.forEach(p => minutes.set(p.id, 0));
  
  // Team defensive ratings with coach modifier
  const defA = rotationA.reduce((sum, p) => sum + p.ratings.defense, 0) / rotationA.length;
  const defB = rotationB.reduce((sum, p) => sum + p.ratings.defense, 0) / rotationB.length;
  
  // Coach bonuses (subtle 0-3% modifiers)
  const coachModA = getCoachGameModifier(teamA.coach, teamA.morale);
  const coachModB = getCoachGameModifier(teamB.coach, teamB.morale);
  
  for (let poss = 0; poss < possessions; poss++) {
    // Team A possession
    const shooterA = pickShooter(rotationA, poss, possessions);
    const resultA = simulatePossession(shooterA, defB, poss, possessions, minutes, coachModA);
    scoreA += resultA.points;
    updatePlayerStats(shooterA, resultA);
    
    // Team B possession
    const shooterB = pickShooter(rotationB, poss, possessions);
    const resultB = simulatePossession(shooterB, defA, poss, possessions, minutes, coachModB);
    scoreB += resultB.points;
    updatePlayerStats(shooterB, resultB);
  }
  
  // Close game bonus from coach clutch rating
  const scoreDiff = Math.abs(scoreA - scoreB);
  if (scoreDiff <= 5) {
    const clutchBonusA = (teamA.coach.ratings.clutch - 60) * 0.02; // -0.6 to +0.5 points
    const clutchBonusB = (teamB.coach.ratings.clutch - 60) * 0.02;
    scoreA += clutchBonusA;
    scoreB += clutchBonusB;
  }
  
  // Determine winner and update records
  const teamAWon = scoreA > scoreB;
  const isHomeGame = Math.random() > 0.5; // Randomly assign home/away
  const sameConference = teamA.conference !== '—' && teamA.conference === teamB.conference;
  
  // Update team records
  if (teamAWon) {
    teamA.wins++;
    teamB.losses++;
    teamA.coach.careerStats.wins++;
    teamB.coach.careerStats.losses++;
    
    // Track advanced stats for team A (winner)
    updateTeamStats(teamA, true, isHomeGame, sameConference);
    updateTeamStats(teamB, false, !isHomeGame, sameConference);
    
    // Update Fan Hype based on game result
    updateTeamHype(teamA, true, scoreA - scoreB);
    updateTeamHype(teamB, false, scoreB - scoreA);
    
    // Process game financials for home team
    if (isHomeGame) {
      processGameFinancials(teamA, true);
    } else {
      processGameFinancials(teamB, false);
    }
  } else {
    teamB.wins++;
    teamA.losses++;
    teamB.coach.careerStats.wins++;
    teamA.coach.careerStats.losses++;
    
    // Track advanced stats for team B (winner)
    updateTeamStats(teamA, false, isHomeGame, sameConference);
    updateTeamStats(teamB, true, !isHomeGame, sameConference);
    
    // Update Fan Hype based on game result
    updateTeamHype(teamA, false, scoreA - scoreB);
    updateTeamHype(teamB, true, scoreB - scoreA);
    
    // Process game financials for home team
    if (isHomeGame) {
      processGameFinancials(teamA, false);
    } else {
      processGameFinancials(teamB, true);
    }
  }
  
  // Mark game played
  rotationA.forEach(p => p.seasonStats.gp++);
  rotationB.forEach(p => p.seasonStats.gp++);
}

function updateTeamStats(team, won, isHome, sameConference) {
  // Initialize stats object if it doesn't exist (for old saves)
  if (!team.stats) {
    team.stats = {
      confWins: 0,
      confLosses: 0,
      homeWins: 0,
      homeLosses: 0,
      awayWins: 0,
      awayLosses: 0,
      last10: [],
      streak: 0
    };
  }
  
  // Update conference record
  if (sameConference) {
    if (won) team.stats.confWins++;
    else team.stats.confLosses++;
  }
  
  // Update home/away record
  if (isHome) {
    if (won) team.stats.homeWins++;
    else team.stats.homeLosses++;
  } else {
    if (won) team.stats.awayWins++;
    else team.stats.awayLosses++;
  }
  
  // Update last 10
  team.stats.last10.push(won ? 'W' : 'L');
  if (team.stats.last10.length > 10) {
    team.stats.last10.shift();
  }
  
  // Update streak
  if (won) {
    if (team.stats.streak >= 0) {
      team.stats.streak++;
    } else {
      team.stats.streak = 1;
    }
  } else {
    if (team.stats.streak <= 0) {
      team.stats.streak--;
    } else {
      team.stats.streak = -1;
    }
  }
}

/**
 * Process game attendance and revenue for home team
 * @param {Object} homeTeam - Home team object
 * @param {boolean} wonGame - Whether home team won
 */
function processGameFinancials(homeTeam, wonGame) {
  if (!homeTeam || !homeTeam.finances) {
    // Initialize finances if missing (for old saves)
    if (homeTeam && !homeTeam.finances) {
      homeTeam.finances = {
        seasonRevenue: 0,
        seasonAttendance: 0,
        gamesPlayed: 0,
        avgAttendance: 0,
        revenuePerGame: 0
      };
    }
    if (!homeTeam) return;
  }
  
  // Base attendance (capacity: 18,000 for standard arena)
  const arenaCapacity = 18000;
  
  // Market size affects base attendance
  const marketMultiplier = homeTeam.market === 'Large' ? 1.2 :
                          homeTeam.market === 'Medium' ? 1.0 :
                          homeTeam.market === 'Small' ? 0.8 : 1.0;
  
  // Get hype effects
  const hypeEffects = getHypeEffects(homeTeam.hype || 50);
  
  // Calculate attendance with hype multiplier
  const baseAttendance = arenaCapacity * marketMultiplier;
  const attendance = Math.round(baseAttendance * hypeEffects.attendance);
  
  // Revenue per fan (tickets, concessions, merchandise)
  const revenuePerFan = 85; // $85 average per attendee
  const gameRevenue = attendance * revenuePerFan * hypeEffects.revenue / 1000000; // Convert to millions
  
  // Update team finances
  homeTeam.finances.gamesPlayed++;
  homeTeam.finances.seasonAttendance += attendance;
  homeTeam.finances.seasonRevenue += gameRevenue;
  homeTeam.finances.avgAttendance = Math.round(homeTeam.finances.seasonAttendance / homeTeam.finances.gamesPlayed);
  homeTeam.finances.revenuePerGame = homeTeam.finances.seasonRevenue / homeTeam.finances.gamesPlayed;
}

function pickShooter(rotation, currentPoss, totalPoss) {
  // Weight by OVR
  const weights = rotation.map(p => p.ratings.ovr);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * totalWeight;
  
  for (let i = 0; i < rotation.length; i++) {
    r -= weights[i];
    if (r <= 0) return rotation[i];
  }
  return rotation[0];
}

function simulatePossession(shooter, oppDef, currentPoss, totalPoss, minutesMap, coachMod = null) {
  const fatigueMultiplier = calculateFatigue(shooter, currentPoss, totalPoss, minutesMap);
  let adjustedShoot = shooter.ratings.shoot * fatigueMultiplier;
  
  // Apply coach offensive modifier
  if (coachMod) {
    adjustedShoot *= coachMod.offense * coachMod.morale;
  }
  
  // Determine shot type
  const is3PT = Math.random() < 0.35; // 35% of shots are 3s
  const shotDifficulty = is3PT ? 0.35 : 0.50;
  
  // Make chance based on shooter skill vs defense (with coach defense mod)
  let effectiveOppDef = oppDef;
  if (coachMod) {
    effectiveOppDef *= coachMod.defense;
  }
  
  const makeChance = clamp((adjustedShoot - effectiveOppDef * 0.3) / 100 * shotDifficulty, 0.1, 0.7);
  const made = Math.random() < makeChance;
  
  // Track minutes
  minutesMap.set(shooter.id, (minutesMap.get(shooter.id) || 0) + 1);
  
  // Simple rebound/assist simulation
  const reb = Math.random() < 0.15 ? 1 : 0;
  const ast = Math.random() < 0.12 ? 1 : 0;
  
  return {
    points: made ? (is3PT ? 3 : 2) : 0,
    fgm: made ? 1 : 0,
    fga: 1,
    fg3m: (made && is3PT) ? 1 : 0,
    fg3a: is3PT ? 1 : 0,
    reb,
    ast
  };
}

function calculateFatigue(player, currentPoss, totalPoss, minutesMap) {
  const minutesPlayed = minutesMap.get(player.id) || 0;
  const gameProgress = currentPoss / totalPoss;
  
  // If playing heavy minutes in late game, slight fatigue penalty
  if (gameProgress > 0.75 && minutesPlayed > 40) {
    return 0.95; // 5% penalty
  }
  return 1.0;
}

function updatePlayerStats(player, result) {
  player.seasonStats.pts += result.points;
  player.seasonStats.fgm += result.fgm;
  player.seasonStats.fga += result.fga;
  player.seasonStats.fg3m += result.fg3m;
  player.seasonStats.fg3a += result.fg3a;
  player.seasonStats.reb += result.reb;
  player.seasonStats.ast += result.ast;
}

/* ============================
   SEASON SIMULATION
============================ */

function simRegularSeason() {
  if (!league) return;
  
  // Reset season stats
  league.teams.forEach(team => {
    team.wins = 0;
    team.losses = 0;
    team.players.forEach(p => {
      p.seasonStats = { gp: 0, pts: 0, reb: 0, ast: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0 };
    });
  });
  
  // Each team plays each other 4 times (home/away)
  const teams = league.teams;
  let gamesSimmed = 0;
  const totalGames = (teams.length * (teams.length - 1) * 4) / 2;
  
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      for (let k = 0; k < 4; k++) {
        simGame(teams[i], teams[j]);
        gamesSimmed++;
        
        // Save award snapshot every 10 games
        if (gamesSimmed % 10 === 0 && typeof saveAwardSnapshot === 'function') {
          saveAwardSnapshot();
        }
      }
    }
  }
  
  // Final snapshot at end of season
  if (typeof saveAwardSnapshot === 'function') {
    saveAwardSnapshot();
  }
  
  league.phase = 'offseason';
  
  // Save season to history
  saveSeasonToHistory();
  
  // Process job security if enabled
  if (typeof processSeasonEndJobSecurity === 'function') {
    processSeasonEndJobSecurity(league);
  }
  
  render();
  alert('Regular season complete! Proceed to Offseason.');
  saveLeagueState();
}

function saveSeasonToHistory() {
  const standings = [...league.teams].sort((a, b) => b.wins - a.wins);
  const champion = standings[0];
  
  // Find stat leaders
  const allPlayers = league.teams.flatMap(t => t.players);
  const scoringLeader = [...allPlayers].sort((a, b) => {
    const ppgA = a.seasonStats.gp > 0 ? a.seasonStats.pts / a.seasonStats.gp : 0;
    const ppgB = b.seasonStats.gp > 0 ? b.seasonStats.pts / b.seasonStats.gp : 0;
    return ppgB - ppgA;
  })[0];
  
  league.history.push({
    season: league.season,
    champion: champion.name,
    championRecord: `${champion.wins}-${champion.losses}`,
    scoringLeader: scoringLeader ? {
      name: scoringLeader.name,
      ppg: (scoringLeader.seasonStats.pts / scoringLeader.seasonStats.gp).toFixed(1)
    } : null,
    standings: standings.map(t => ({ name: t.name, wins: t.wins, losses: t.losses }))
  });
}

/* ============================
   PLAYER PROGRESSION
============================ */

function progressPlayers() {
  league.teams.forEach(team => {
    // Coach player development bonus (0-15% boost for young players)
    const devBonus = team.coach ? (team.coach.ratings.playerDevelopment - 60) * 0.005 : 0;
    
    team.players.forEach(player => {
      player.age++;
      
      // Age curve
      let growthFactor = 0;
      if (player.age >= 19 && player.age <= 23) {
        growthFactor = randFloat(0, 3);
        // Chance of big leap if POT > OVR
        if (player.ratings.pot > player.ratings.ovr && Math.random() < 0.3) {
          growthFactor += randFloat(3, 8);
        }
        // Apply coach development bonus for young players
        growthFactor *= (1.0 + devBonus);
      } else if (player.age >= 24 && player.age <= 29) {
        growthFactor = randFloat(-1, 1);
      } else if (player.age >= 30) {
        growthFactor = randFloat(-5, -1);
      }
      
      // Apply to each rating
      player.ratings.shoot = clamp(player.ratings.shoot + growthFactor + randFloat(-2, 2), 30, 100);
      player.ratings.defense = clamp(player.ratings.defense + growthFactor + randFloat(-2, 2), 30, 100);
      player.ratings.rebound = clamp(player.ratings.rebound + growthFactor + randFloat(-2, 2), 30, 100);
      player.ratings.passing = clamp(player.ratings.passing + growthFactor + randFloat(-2, 2), 30, 100);
      
      // Recalculate OVR
      player.ratings.ovr = Math.round((player.ratings.shoot + player.ratings.defense + 
                                       player.ratings.rebound + player.ratings.passing) / 4);
      player.ratings.ovr = clamp(player.ratings.ovr, 30, 100);
    });
  });
}

/* ============================
   CONTRACTS & FREE AGENCY
============================ */

function runOffseason() {
  if (!league || league.phase !== 'offseason') {
    alert('Not in offseason phase!');
    return;
  }
  
  // Evaluate and potentially fire coaches
  evaluateCoachPerformance();
  
  // Update coach contracts and age
  updateCoachContracts();
  
  // Progress players (age + ratings)
  progressPlayers();
  
  // Handle expiring contracts
  handleExpiringContracts();
  
  // Re-sign phase
  resignPlayers();
  
  // Free agency
  freeAgencySignings();
  
  // Add new free agents to maintain pool size
  if (league.freeAgents.length < 20) {
    const newFreeAgents = generateFreeAgents(20 - league.freeAgents.length);
    league.freeAgents.push(...newFreeAgents);
  }
  
  // Restore some morale
  league.teams.forEach(team => {
    team.morale = Math.min(100, team.morale + 5);
  });
  
  updateTeamPayrolls();
  league.phase = 'draft';
  
  // Generate draft class
  league.draftClass = generateDraftClass();
  
  render();
  alert('Offseason complete! Proceed to Draft.');
  save();
}

function handleExpiringContracts() {
  league.teams.forEach(team => {
    const expiring = team.players.filter(p => p.contract.exp <= league.season);
    expiring.forEach(p => {
      league.freeAgents.push(p);
    });
    team.players = team.players.filter(p => p.contract.exp > league.season);
  });
}

function resignPlayers() {
  league.teams.forEach(team => {
    const capSpace = SALARY_CAP - team.players.reduce((sum, p) => sum + p.contract.amount, 0);
    
    // Try to re-sign top free agents from this team
    const teamFAs = league.freeAgents.filter(fa => {
      // Check if player was on this team (simple heuristic: if team has < 12 players)
      return team.players.length < 12;
    }).sort((a, b) => b.ratings.ovr - a.ratings.ovr);
    
    for (let fa of teamFAs) {
      if (team.players.length >= 15) break;
      
      const newSalary = calculateSalary(fa.ratings.ovr);
      const currentPayroll = team.players.reduce((sum, p) => sum + p.contract.amount, 0);
      
      if (currentPayroll + newSalary <= SALARY_CAP * 1.1) { // 10% luxury tax tolerance
        fa.contract = {
          amount: newSalary,
          exp: league.season + rand(1, 4)
        };
        team.players.push(fa);
        league.freeAgents = league.freeAgents.filter(p => p.id !== fa.id);
      }
    }
  });
}

function freeAgencySignings() {
  // Remaining free agents sign minimum deals with teams under cap
  league.freeAgents.sort((a, b) => b.ratings.ovr - a.ratings.ovr);
  
  for (let fa of [...league.freeAgents]) {
    const teamsWithSpace = league.teams.filter(t => {
      const payroll = t.players.reduce((sum, p) => sum + p.contract.amount, 0);
      return payroll < SALARY_CAP && t.players.length < 15;
    }).sort((a, b) => {
      const payA = a.players.reduce((sum, p) => sum + p.contract.amount, 0);
      const payB = b.players.reduce((sum, p) => sum + p.contract.amount, 0);
      return payA - payB; // Teams with more space go first
    });
    
    if (teamsWithSpace.length > 0) {
      const team = teamsWithSpace[0];
      fa.contract = {
        amount: MIN_SALARY,
        exp: league.season + 1
      };
      team.players.push(fa);
      league.freeAgents = league.freeAgents.filter(p => p.id !== fa.id);
    }
  }
}

/* ============================
   DRAFT
============================ */

function runDraft() {
  if (!league || league.phase !== 'draft') {
    alert('Not in draft phase!');
    return;
  }
  
  // Draft order: reverse standings
  const draftOrder = [...league.teams].sort((a, b) => a.wins - b.wins);
  
  for (let i = 0; i < draftOrder.length && i < league.draftClass.length; i++) {
    const team = draftOrder[i];
    const pick = league.draftClass[i];
    
    pick.contract = {
      amount: rand(2, 5), // Rookie scale
      exp: league.season + 4
    };
    
    team.players.push(pick);
  }
  
  league.draftClass = [];
  league.phase = 'preseason';
  league.season++;
  
  // Decay rivalries for the new season
  decayRivalriesForNewSeason(league.season);
  
  updateTeamPayrolls();
  render();
  alert(`Draft complete! Welcome to the ${league.season} season!`);
  save();
}

/* ============================
   TRANSACTIONS
============================ */

function cutPlayer(playerId, teamId) {
  const team = league.teams.find(t => t.id === teamId);
  if (!team) {
    alert('Team not found');
    return;
  }
  
  const player = team.players.find(p => p.id === playerId);
  if (!player) {
    alert('Player not found');
    return;
  }
  
  if (!confirm(`Cut ${player.name}? (Salary: $${player.contract.amount}M)`)) return;
  
  const result = waivePlayer(team, player);
  
  if (!result.success) {
    alert('❌ Waive Failed\n\n' + result.error);
    return;
  }
  
  updateTeamPayrolls();
  render();
  save();
}

function signFreeAgent(playerId, teamId, contractTerms) {
  // Check if free agent signing is allowed
  if (!isActionAllowed(ACTIONS.SIGN_FA)) {
    const reason = getActionLockReason(ACTIONS.SIGN_FA);
    return { success: false, error: reason };
  }
  
  const team = league.teams.find(t => t.id === teamId);
  const player = league.freeAgents.find(p => p.id === playerId);
  
  if (!team || !player) return { success: false, error: 'Team or player not found' };
  
  // If no contract terms provided, use existing contract
  const terms = contractTerms || {
    salary: player.contract.amount,
    years: player.contract.yearsRemaining || 1,
    hasPlayerOption: player.contract.hasPlayerOption || false,
    hasTeamOption: player.contract.hasTeamOption || false
  };
  
  const currentPayroll = team.players.reduce((sum, p) => sum + p.contract.amount, 0);
  if (currentPayroll + terms.salary > SALARY_CAP) {
    return { success: false, error: 'Not enough cap space!' };
  }
  
  if (team.players.length >= 15) {
    return { success: false, error: 'Roster full! (Max 15 players)' };
  }
  
  // Update player contract
  player.contract = {
    amount: terms.salary,
    exp: league.season + terms.years,
    yearsRemaining: terms.years,
    totalValue: terms.salary * terms.years,
    startYear: league.season,
    hasPlayerOption: terms.hasPlayerOption,
    hasTeamOption: terms.hasTeamOption
  };
  
  // Remove from free agents
  const faIndex = league.freeAgents.findIndex(p => p.id === playerId);
  if (faIndex !== -1) {
    league.freeAgents.splice(faIndex, 1);
  }
  
  // Add to team
  team.players.push(player);
  
  // Update team payroll
  team.payroll = team.players.reduce((sum, p) => sum + (p.contract?.amount || 0), 0);
  
  updateTeamPayrolls();
  render();
  saveLeagueState();
  
  return { success: true };
}

/* ============================
   COACH MANAGEMENT
============================ */

function fireCoach(teamId) {
  const team = league.teams.find(t => t.id === teamId);
  if (!team || !team.coach) return;
  
  const coachName = team.coach.name;
  if (!confirm(`Fire ${coachName}? This will temporarily hurt team morale.`)) return;
  
  // Morale penalty for firing coach
  team.morale = Math.max(40, team.morale - 15);
  
  // Hire a replacement immediately
  team.coach = makeCoach(rand(0, 20));
  
  alert(`${coachName} has been fired. ${team.coach.name} is the new head coach.`);
  
  render();
  save();
}

function evaluateCoachPerformance() {
  // AI teams evaluate and potentially fire coaches
  league.teams.forEach(team => {
    if (!team.coach) return;
    
    const totalGames = team.wins + team.losses;
    if (totalGames < 30) return; // Need enough games to evaluate
    
    const winPct = team.wins / totalGames;
    const moraleIsPoor = team.morale < 50;
    const coachIsStruggling = team.coach.ratings.overall < 55;
    
    // Firing conditions
    const shouldFire = 
      (winPct < 0.30 && totalGames > 40) || // Terrible record
      (winPct < 0.40 && moraleIsPoor) || // Bad record + low morale
      (moraleIsPoor && coachIsStruggling); // Low morale + bad coach
    
    if (shouldFire && Math.random() < 0.3) { // 30% chance if conditions met
      team.morale = Math.max(40, team.morale - 10);
      team.coach = makeCoach(rand(5, 25));
    }
  });
}

function updateCoachContracts() {
  // Age coaches and update contracts during offseason
  league.teams.forEach(team => {
    if (!team.coach) return;
    
    team.coach.age++;
    team.coach.experience++;
    team.coach.contract.yearsRemaining--;
    
    // Extend or renegotiate if contract is expiring
    if (team.coach.contract.yearsRemaining <= 0) {
      // Good coaches get extensions, bad ones get replaced
      const winPct = team.wins / Math.max(1, team.wins + team.losses);
      if (winPct > 0.45 || team.coach.ratings.overall > 70) {
        // Extend contract
        team.coach.contract.yearsRemaining = rand(2, 5);
        team.coach.contract.annualSalary = calculateCoachSalary(team.coach.ratings.overall);
      } else {
        // Replace
        team.coach = makeCoach(rand(0, 15));
      }
    }
  });
}

/* ============================
   ROTATIONS SYSTEM
============================ */

function generateDefaultRotations(team) {
  // Generate default minute targets and roles for a team
  const rotations = {
    minuteTargetsByPlayerId: {},
    roleByPlayerId: {},
    lockedByPlayerId: {}
  };
  
  // Group players by position fit
  const positionGroups = {
    PG: [],
    SG: [],
    SF: [],
    PF: [],
    C: []
  };
  
  team.players.forEach(p => {
    if (!positionGroups[p.pos]) positionGroups[p.pos] = [];
    positionGroups[p.pos].push(p);
  });
  
  // Sort each position by OVR
  Object.keys(positionGroups).forEach(pos => {
    positionGroups[pos].sort((a, b) => b.ratings.ovr - a.ratings.ovr);
  });
  
  // Assign starters (top player per position)
  const starters = [];
  ['PG', 'SG', 'SF', 'PF', 'C'].forEach(pos => {
    if (positionGroups[pos].length > 0) {
      const player = positionGroups[pos][0];
      starters.push(player);
      rotations.roleByPlayerId[player.id] = 'starter';
      rotations.minuteTargetsByPlayerId[player.id] = 34;
      rotations.lockedByPlayerId[player.id] = false;
    }
  });
  
  // Collect remaining players
  const bench = team.players.filter(p => !starters.includes(p));
  bench.sort((a, b) => b.ratings.ovr - a.ratings.ovr);
  
  // Assign bench roles and minutes
  const starterMinutes = starters.length * 34; // 170
  const remainingMinutes = 240 - starterMinutes; // 70
  
  bench.forEach((player, idx) => {
    if (idx === 0) {
      // Sixth man
      rotations.roleByPlayerId[player.id] = 'sixth';
      rotations.minuteTargetsByPlayerId[player.id] = 24;
    } else if (idx < 4) {
      // Rotation players
      rotations.roleByPlayerId[player.id] = 'rotation';
      const avgMinutes = Math.floor((remainingMinutes - 24) / Math.min(3, bench.length - 1));
      rotations.minuteTargetsByPlayerId[player.id] = Math.max(10, avgMinutes);
    } else if (idx < 8) {
      // Deep bench
      rotations.roleByPlayerId[player.id] = 'bench';
      rotations.minuteTargetsByPlayerId[player.id] = Math.max(5, Math.floor((remainingMinutes - 24) / (bench.length - 1)));
    } else {
      // DNP
      rotations.roleByPlayerId[player.id] = 'dnp';
      rotations.minuteTargetsByPlayerId[player.id] = 0;
    }
    rotations.lockedByPlayerId[player.id] = false;
  });
  
  // Normalize to exactly 240
  normalizeMinutesTo240(rotations.minuteTargetsByPlayerId, team.players);
  
  return rotations;
}

function normalizeMinutesTo240(minuteTargets, players) {
  // Adjust minutes so total equals 240
  const playerIds = players.map(p => p.id);
  let total = playerIds.reduce((sum, id) => sum + (minuteTargets[id] || 0), 0);
  
  if (total === 240) return;
  
  const diff = 240 - total;
  const activePlayers = playerIds.filter(id => (minuteTargets[id] || 0) > 0);
  
  if (activePlayers.length === 0) {
    // Edge case: distribute 240 across all players
    const perPlayer = Math.floor(240 / playerIds.length);
    playerIds.forEach(id => minuteTargets[id] = perPlayer);
    total = perPlayer * playerIds.length;
    if (total < 240) {
      minuteTargets[playerIds[0]] += 240 - total;
    }
    return;
  }
  
  // Distribute diff across active players
  const perPlayer = Math.floor(diff / activePlayers.length);
  const remainder = diff % activePlayers.length;
  
  activePlayers.forEach((id, idx) => {
    minuteTargets[id] = (minuteTargets[id] || 0) + perPlayer + (idx < remainder ? 1 : 0);
  });
}

function calcTotalMinutes(teamId) {
  const team = league.teams.find(t => t.id === teamId);
  if (!team || !team.rotations) return 0;
  
  return team.players.reduce((sum, p) => {
    return sum + (team.rotations.minuteTargetsByPlayerId[p.id] || 0);
  }, 0);
}

function getProjectedMinutes(team, player) {
  // Apply coach/GM influence to calculate projected minutes from targets
  if (!team.rotations) return 0;
  
  const target = team.rotations.minuteTargetsByPlayerId[player.id] || 0;
  if (target === 0) return 0;
  
  const coach = team.coach;
  if (!coach) return target;
  
  // Coach rigidity: how closely coach follows GM targets
  // Higher rigidity = less deviation
  const rigidity = coach.personality?.discipline ? coach.personality.discipline * 10 : 50;
  const deviationScale = (100 - rigidity) / 100;
  
  // Random deviation based on coach personality
  const randomDeviation = (Math.random() - 0.5) * 10 * deviationScale;
  
  // Veteran bias
  const veteranBias = coach.personality?.patience ? (coach.personality.patience - 5) : 0;
  const veteranAdjustment = player.age > 28 ? veteranBias * 0.5 : 0;
  
  // Overall rating influence
  const ovrAdjustment = (player.ratings.ovr - 75) * 0.1;
  
  const projected = target + randomDeviation + veteranAdjustment + ovrAdjustment;
  
  return Math.max(0, Math.min(48, Math.round(projected)));
}

function getGameRotation(team) {
  // Helper to check if player is injured
  const isInjured = (p) => p.injury && p.injury.gamesRemaining > 0;
  
  // Get players who should play this game based on rotation
  if (!team.rotations) {
    // Fallback: top 8 by OVR, excluding injured
    return team.players
      .filter(p => !isInjured(p))
      .sort((a, b) => b.ratings.ovr - a.ratings.ovr)
      .slice(0, 8);
  }
  
  // Get healthy players with minute targets > 0, sorted by target minutes
  const playersWithMinutes = team.players
    .filter(p => !isInjured(p) && (team.rotations.minuteTargetsByPlayerId[p.id] || 0) > 0)
    .sort((a, b) => {
      const minsB = team.rotations.minuteTargetsByPlayerId[b.id] || 0;
      const minsA = team.rotations.minuteTargetsByPlayerId[a.id] || 0;
      return minsB - minsA;
    });
  
  // Ensure at least 8 players (fill with next best healthy OVR if needed)
  if (playersWithMinutes.length < 8) {
    const remainingPlayers = team.players
      .filter(p => !isInjured(p) && !playersWithMinutes.includes(p))
      .sort((a, b) => b.ratings.ovr - a.ratings.ovr);
    
    playersWithMinutes.push(...remainingPlayers.slice(0, 8 - playersWithMinutes.length));
  }
  
  return playersWithMinutes.slice(0, 10); // Top 10 healthy players for rotation
}

/* ============================
   LEAGUE MIGRATIONS
============================ */

// Migration functions (each takes league and modifies it)
const migrations = {
  1: function migrateTo1(league) {
    // Fix draft data: migrate to player.draft structure and clean up bad values
    console.log('Running migration to schema version 1: migrating draft data to player.draft structure');
    
    // Get all valid team IDs
    const validTeamIds = new Set(league.teams.map(t => t.id));
    
    // Migrate all players (on teams + free agents)
    const allPlayers = [
      ...league.teams.flatMap(t => t.players),
      ...league.freeAgents
    ];
    
    allPlayers.forEach(player => {
      // Ensure draft object exists
      if (!player.draft) {
        player.draft = {
          year: null,
          round: null,
          pick: null,
          draftedByTid: null
        };
      }
      
      // Migrate from bio fields if draft fields are empty
      if (player.bio) {
        // Migrate draft year/round/pick from bio
        if (player.draft.year === null && player.bio.draftYear !== undefined) {
          player.draft.year = typeof player.bio.draftYear === 'number' && isFinite(player.bio.draftYear) 
            ? player.bio.draftYear : null;
          delete player.bio.draftYear;
        }
        
        if (player.draft.round === null && player.bio.draftRound !== undefined) {
          player.draft.round = typeof player.bio.draftRound === 'number' && isFinite(player.bio.draftRound) 
            ? player.bio.draftRound : null;
          delete player.bio.draftRound;
        }
        
        if (player.draft.pick === null && player.bio.draftPick !== undefined) {
          player.draft.pick = typeof player.bio.draftPick === 'number' && isFinite(player.bio.draftPick) 
            ? player.bio.draftPick : null;
          delete player.bio.draftPick;
        }
        
        // Migrate draftedByTid from bio
        if (player.draft.draftedByTid === null && player.bio.draftedByTid !== undefined) {
          // Handle string values like "Team 26" or "Undrafted"
          if (typeof player.bio.draftedByTid === 'string') {
            const match = player.bio.draftedByTid.match(/Team (\d+)/);
            if (match) {
              const teamId = parseInt(match[1]);
              player.draft.draftedByTid = validTeamIds.has(teamId) ? teamId : null;
            } else {
              player.draft.draftedByTid = null;
            }
          } else if (typeof player.bio.draftedByTid === 'number') {
            player.draft.draftedByTid = validTeamIds.has(player.bio.draftedByTid) ? player.bio.draftedByTid : null;
          }
          delete player.bio.draftedByTid;
        }
        
        // Handle legacy draftedBy field
        if (player.bio.draftedBy !== undefined) {
          if (typeof player.bio.draftedBy === 'string' && player.draft.draftedByTid === null) {
            const match = player.bio.draftedBy.match(/Team (\d+)/);
            if (match) {
              const teamId = parseInt(match[1]);
              player.draft.draftedByTid = validTeamIds.has(teamId) ? teamId : null;
            }
          }
          delete player.bio.draftedBy;
        }
      }
      
      // Clean up draft object - if no year/round/pick, force all to null
      const isDrafted = (
        typeof player.draft.year === 'number' && isFinite(player.draft.year) &&
        typeof player.draft.round === 'number' && isFinite(player.draft.round) &&
        typeof player.draft.pick === 'number' && isFinite(player.draft.pick)
      );
      
      if (!isDrafted) {
        // Undrafted players should have NO draft data
        player.draft.year = null;
        player.draft.round = null;
        player.draft.pick = null;
        player.draft.draftedByTid = null;
      } else {
        // Player is drafted - ensure they have valid team data
        // Don't nullify draftedByTid if team doesn't exist - keep for historical reference
        
        // Normalize -1 to null
        if (player.draft.draftedByTid === -1) {
          player.draft.draftedByTid = null;
        }
        
        // Try to populate missing draftedByTid from draft history
        if (player.draft.draftedByTid === null || player.draft.draftedByTid === undefined) {
          const draftYear = player.draft.year;
          const draftHistory = league.history?.draftsByYear?.[draftYear];
          if (draftHistory) {
            const draftRecord = draftHistory.find(
              pick => pick.playerId === player.id || 
                      pick.playerName === player.name ||
                      (pick.round === player.draft.round && pick.pickNumber === player.draft.pick)
            );
            if (draftRecord && draftRecord.teamId !== undefined) {
              player.draft.draftedByTid = draftRecord.teamId;
            }
          }
          
          // If still no team ID, assign a random team
          // (we don't have the real data, but showing a team name is better than nothing)
          if (player.draft.draftedByTid === null || player.draft.draftedByTid === undefined) {
            const randomTeam = league.teams[rand(0, league.teams.length - 1)];
            if (randomTeam) {
              player.draft.draftedByTid = randomTeam.id;
              console.log(`Migration: Assigned random draft team for ${player.name}: ${randomTeam.name} (ID: ${randomTeam.id})`);
            }
          }
        }
      }
    });
    
    // Add rotations to teams that don't have them
    league.teams.forEach(team => {
      if (!team.rotations) {
        team.rotations = generateDefaultRotations(team);
      }
    });
    
    console.log('Migration to version 1 complete');
  },
  
  // Migration 2: Add persistent draft prospects
  2: function(league) {
    console.log('Running migration to version 2: Adding draft prospects');
    
    // Add draftProspects if missing
    if (!league.draftProspects) {
      console.log('Generating initial draft prospect pool for season', league.season);
      league.draftProspects = generateDraftClass(league.season);
    }
    
    // Ensure all prospects have required fields
    if (league.draftProspects && Array.isArray(league.draftProspects)) {
      league.draftProspects.forEach(prospect => {
        if (!prospect.strengths) prospect.strengths = [];
        if (!prospect.weaknesses) prospect.weaknesses = [];
        if (prospect.rank === undefined) prospect.rank = 0;
        if (prospect.isWatchlisted === undefined) prospect.isWatchlisted = false;
      });
    }
    
    // Ensure watchlist exists on each team
    league.teams.forEach(team => {
      if (!team.draftWatchlist) {
        team.draftWatchlist = [];
      }
    });
    
    console.log('Migration to version 2 complete');
  },
  
  // Migration 3: Add expansion system
  3: function(league) {
    console.log('Running migration to version 3: Adding expansion system');
    
    // Add expansion state if missing
    if (!league.expansion) {
      league.expansion = initExpansionState();
    }
    
    // Ensure all required expansion fields exist
    if (!league.expansion.active) league.expansion.active = false;
    if (!league.expansion.currentStep) league.expansion.currentStep = 1;
    if (!league.expansion.settings) league.expansion.settings = initExpansionState().settings;
    if (!league.expansion.newTeams) league.expansion.newTeams = [];
    if (!league.expansion.protectedLists) league.expansion.protectedLists = {};
    if (!league.expansion.draftResults) league.expansion.draftResults = [];
    if (!league.expansion.history) league.expansion.history = [];
    
    console.log('Migration to version 3 complete');
  },
  
  // Migration 4: Add schedule system
  4: function(league) {
    console.log('Running migration to version 4: Adding schedule system');
    
    // Initialize schedule state if missing
    if (!league.schedule) {
      league.schedule = initScheduleState();
    }
    
    // Ensure schedule structure exists
    if (!league.schedule.games) league.schedule.games = {};
    if (!league.schedule.days) league.schedule.days = {};
    if (!league.schedule.currentDay) league.schedule.currentDay = 1;
    
    // Generate schedule for current season if in season/preseason
    if (league.season && league.phase !== 'DRAFT' && league.phase !== 'FREE_AGENCY') {
      if (!league.schedule.days[league.season] || league.schedule.days[league.season].length === 0) {
        console.log(`Generating schedule for season ${league.season}`);
        generateSeasonSchedule(league.season);
      }
    }
    
    console.log('Migration to version 4 complete');
  },
  
  // Migration 5: Placeholder for future use
  5: function(league) {
    console.log('Running migration to version 5: No changes required');
    // Reserved for future migrations
  },
  
  // Migration 6: Add shot tendencies to all players
  6: function(league) {
    console.log('Running migration to version 6: Adding shot tendencies to players');
    
    let playersUpdated = 0;
    
    // Add shot tendencies to all players (on teams + free agents + draft prospects)
    const allPlayers = [
      ...league.teams.flatMap(t => t.players),
      ...league.freeAgents,
      ...(league.draftProspects || [])
    ];
    
    allPlayers.forEach(player => {
      if (!player.shotTendencies) {
        player.shotTendencies = generateDefaultShotTendencies(player);
        playersUpdated++;
      }
    });
    
    console.log(`Migration to version 6 complete: ${playersUpdated} players updated with shot tendencies`);
  }
};

function migrateLeague(league) {
  const startVersion = league.schemaVersion || 0;
  let currentVersion = startVersion;
  
  console.log(`League schema version: ${currentVersion}, current: ${CURRENT_SCHEMA_VERSION}`);
  
  // Run migrations sequentially
  while (currentVersion < CURRENT_SCHEMA_VERSION) {
    const nextVersion = currentVersion + 1;
    const migrationFn = migrations[nextVersion];
    
    if (migrationFn) {
      console.log(`Running migration ${currentVersion} -> ${nextVersion}`);
      migrationFn(league);
      currentVersion = nextVersion;
    } else {
      console.warn(`No migration function found for version ${nextVersion}`);
      break;
    }
  }
  
  // Update schema version
  league.schemaVersion = currentVersion;
  
  return currentVersion !== startVersion; // Return true if migrations were run
}

/* ============================
   DEBUG TOOLS
============================ */

/**
 * Debug function to analyze league talent distribution
 * Usage: window.debugRatings() in browser console
 */
function debugRatings() {
  if (!league) {
    console.error('No league loaded');
    return;
  }
  
  const allPlayers = [];
  league.teams.forEach(team => {
    team.players.forEach(p => allPlayers.push({ ...p, teamName: team.name }));
  });
  league.freeAgents.forEach(p => allPlayers.push({ ...p, teamName: 'Free Agent' }));
  
  console.log('='.repeat(60));
  console.log('LEAGUE TALENT DISTRIBUTION REPORT');
  console.log('='.repeat(60));
  console.log(`Total Players: ${allPlayers.length}`);
  console.log(`Teams: ${league.teams.length}`);
  console.log(`Free Agents: ${league.freeAgents.length}`);
  console.log('');
  
  // Get OVR/POT values
  const ovrValues = allPlayers.map(p => p.ratings?.ovr ?? p.ovr ?? 0).filter(v => v > 0);
  const potValues = allPlayers.map(p => p.ratings?.pot ?? p.pot ?? 0).filter(v => v > 0);
  
  if (ovrValues.length === 0) {
    console.error('❌ NO VALID OVR VALUES FOUND!');
    console.log('Sample players:', allPlayers.slice(0, 3));
    return;
  }
  
  const maxOvr = Math.max(...ovrValues);
  const maxPot = Math.max(...potValues);
  const avgOvr = (ovrValues.reduce((a, b) => a + b, 0) / ovrValues.length).toFixed(1);
  const avgPot = (potValues.reduce((a, b) => a + b, 0) / potValues.length).toFixed(1);
  
  console.log(`Max OVR: ${maxOvr}`);
  console.log(`Max POT: ${maxPot}`);
  console.log(`Avg OVR: ${avgOvr}`);
  console.log(`Avg POT: ${avgPot}`);
  console.log('');
  
  // Top 10 players
  const sorted = allPlayers
    .map(p => ({
      name: p.name,
      age: p.age,
      pos: p.position,
      team: p.teamName,
      ovr: p.ratings?.ovr ?? p.ovr ?? 0,
      pot: p.ratings?.pot ?? p.pot ?? 0
    }))
    .sort((a, b) => b.ovr - a.ovr);
  
  console.log('TOP 10 PLAYERS BY OVR:');
  console.table(sorted.slice(0, 10));
  console.log('');
  
  // Distribution histogram
  const buckets = {
    '90-99': 0, '80-89': 0, '70-79': 0, '60-69': 0, 
    '50-59': 0, '40-49': 0, '30-39': 0, '< 30': 0
  };
  
  ovrValues.forEach(ovr => {
    if (ovr >= 90) buckets['90-99']++;
    else if (ovr >= 80) buckets['80-89']++;
    else if (ovr >= 70) buckets['70-79']++;
    else if (ovr >= 60) buckets['60-69']++;
    else if (ovr >= 50) buckets['50-59']++;
    else if (ovr >= 40) buckets['40-49']++;
    else if (ovr >= 30) buckets['30-39']++;
    else buckets['< 30']++;
  });
  
  console.log('OVR DISTRIBUTION:');
  Object.entries(buckets).forEach(([range, count]) => {
    const pct = ((count / ovrValues.length) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / ovrValues.length * 50));
    console.log(`${range.padEnd(8)} ${count.toString().padStart(4)} (${pct.padStart(5)}%) ${bar}`);
  });
  console.log('');
  
  // Check for issues
  const undefinedOvr = allPlayers.filter(p => !(p.ratings?.ovr || p.ovr)).length;
  const undefinedPot = allPlayers.filter(p => !(p.ratings?.pot || p.pot)).length;
  
  if (undefinedOvr > 0 || undefinedPot > 0) {
    console.warn(`⚠️ ISSUES FOUND:`);
    console.warn(`  - ${undefinedOvr} players with undefined OVR`);
    console.warn(`  - ${undefinedPot} players with undefined POT`);
  }
  
  console.log('='.repeat(60));
  
  return {
    totalPlayers: allPlayers.length,
    maxOvr,
    maxPot,
    avgOvr: parseFloat(avgOvr),
    avgPot: parseFloat(avgPot),
    distribution: buckets,
    top10: sorted.slice(0, 10),
    issues: { undefinedOvr, undefinedPot }
  };
}

// Expose to window for console access
if (typeof window !== 'undefined') {
  window.debugRatings = debugRatings;
}

/* ============================
   RATING PROFILE MIGRATION
   One-time transformation of OVR/POT distributions
============================ */

/**
 * Apply star league rating profile
 * Uses percentile-based scaling to create realistic 90+ stars
 * Preserves player ordering and relative strength
 */
function applyStarLeagueProfile() {
  if (!league || !leagueState) {
    console.error('[RATING PROFILE] No league loaded');
    return false;
  }
  
  // Check if already applied
  if (leagueState.migrations && leagueState.migrations.ratingProfileApplied) {
    console.warn('[RATING PROFILE] Already applied, skipping');
    return false;
  }
  
  console.log('[RATING PROFILE] Applying star_league profile...');
  
  // Collect all players
  const allPlayers = [];
  league.teams.forEach(team => {
    team.players.forEach(player => {
      allPlayers.push(player);
    });
  });
  league.freeAgents.forEach(player => {
    allPlayers.push(player);
  });
  
  console.log('[RATING PROFILE] Processing', allPlayers.length, 'players');
  
  // Sort by current OVR to establish percentiles
  const sortedByOvr = [...allPlayers].sort((a, b) => {
    const ovrA = a.ratings?.ovr ?? a.ovr ?? 50;
    const ovrB = b.ratings?.ovr ?? b.ovr ?? 50;
    return ovrA - ovrB;
  });
  
  // Calculate percentile for each player
  const playerPercentiles = new Map();
  sortedByOvr.forEach((player, index) => {
    const percentile = index / (sortedByOvr.length - 1);
    playerPercentiles.set(player.id, percentile);
  });
  
  // Apply new ratings based on percentile
  let transformedCount = 0;
  allPlayers.forEach(player => {
    const percentile = playerPercentiles.get(player.id) || 0.5;
    const age = player.age || 25;
    
    // Map OVR using piecewise curve
    let newOvr;
    if (percentile >= 0.99) {
      // Top 1% → 95-99
      const localP = (percentile - 0.99) / 0.01;
      newOvr = 95 + localP * 4;
    } else if (percentile >= 0.95) {
      // 95-99% → 90-95
      const localP = (percentile - 0.95) / 0.04;
      newOvr = 90 + localP * 5;
    } else if (percentile >= 0.80) {
      // 80-95% → 80-90
      const localP = (percentile - 0.80) / 0.15;
      newOvr = 80 + localP * 10;
    } else if (percentile >= 0.50) {
      // 50-80% → 70-80
      const localP = (percentile - 0.50) / 0.30;
      newOvr = 70 + localP * 10;
    } else {
      // Bottom 50% → 55-70
      const localP = percentile / 0.50;
      newOvr = 55 + localP * 15;
    }
    
    // Clamp OVR
    newOvr = Math.max(40, Math.min(99, Math.round(newOvr)));
    
    // Calculate POT based on age and current potential percentile
    const sortedByPot = [...allPlayers].sort((a, b) => {
      const potA = a.ratings?.pot ?? a.pot ?? 50;
      const potB = b.ratings?.pot ?? b.pot ?? 50;
      return potA - potB;
    });
    const potPercentile = sortedByPot.findIndex(p => p.id === player.id) / (sortedByPot.length - 1);
    
    // Age-based upside bonus
    let upsideBonus;
    if (age <= 22) {
      upsideBonus = 3 + Math.random() * 7; // +3 to +10
    } else if (age <= 26) {
      upsideBonus = 1 + Math.random() * 5; // +1 to +6
    } else if (age <= 30) {
      upsideBonus = -2 + Math.random() * 5; // -2 to +3
    } else {
      upsideBonus = -8 + Math.random() * 9; // -8 to +1
    }
    
    // POT = scaled based on POT percentile + age bonus
    let basePot;
    if (potPercentile >= 0.95) {
      basePot = 92 + potPercentile * 7;
    } else if (potPercentile >= 0.80) {
      basePot = 82 + (potPercentile - 0.80) * 10;
    } else if (potPercentile >= 0.50) {
      basePot = 70 + (potPercentile - 0.50) * 12;
    } else {
      basePot = 55 + potPercentile * 15;
    }
    
    let newPot = Math.round(basePot + upsideBonus);
    
    // POT should usually be >= OVR for young players
    if (age <= 25 && newPot < newOvr) {
      newPot = newOvr + Math.floor(Math.random() * 5);
    }
    
    // Clamp POT
    newPot = Math.max(40, Math.min(99, newPot));
    
    // Apply new ratings
    if (player.ratings) {
      player.ratings.ovr = newOvr;
      player.ratings.pot = newPot;
    } else {
      player.ovr = newOvr;
      player.pot = newPot;
    }
    
    transformedCount++;
  });
  
  // Mark migration as complete
  if (!leagueState.migrations) {
    leagueState.migrations = {};
  }
  leagueState.migrations.ratingProfileApplied = true;
  leagueState.migrations.ratingProfileVersion = 'star_league_v1';
  leagueState.settings.ratingProfile = 'star_league';
  
  console.log('[RATING PROFILE] ✓ Transformed', transformedCount, 'players');
  console.log('[RATING PROFILE] Migration complete');
  
  return true;
}

/**
 * Create backup before applying rating profile
 */
function createRatingProfileBackup() {
  if (!league || !leagueState) return null;
  
  const backup = {
    timestamp: Date.now(),
    leagueName: leagueState.meta.name,
    season: leagueState.meta.season,
    leagueState: JSON.parse(JSON.stringify(leagueState)),
    league: JSON.parse(JSON.stringify(league))
  };
  
  try {
    localStorage.setItem('league_backup_before_rating_profile', JSON.stringify(backup));
    console.log('[BACKUP] Created rating profile backup');
    return backup;
  } catch (error) {
    console.error('[BACKUP] Failed to create backup:', error);
    return null;
  }
}

/* ============================
   LEAGUE CREATION
============================ */

function createLeague(leagueName, seasonYear, teamCount, newLeagueSetup, userTeamId) {
  nextPlayerId = 1;
  
  // Create new leagueState
  leagueState = createEmptyLeagueState();
  
  // Set meta information
  leagueState.meta.name = leagueName;
  leagueState.meta.season = seasonYear;
  leagueState.meta.phase = 'preseason';
  leagueState.meta.userTeamId = userTeamId;
  leagueState.meta.day = 0;
  leagueState.draft.year = seasonYear;
  
  // Apply settings from new league setup
  if (newLeagueSetup && newLeagueSetup.settings) {
    leagueState.settings = { ...leagueState.settings, ...newLeagueSetup.settings };
  }
  
  // Create teams
  const teams = [];
  for (let i = 0; i < Math.min(teamCount, 30); i++) {
    // Use customized team from newLeagueSetup if available, otherwise use TEAM_META
    const teamMeta = (newLeagueSetup && newLeagueSetup.teams && newLeagueSetup.teams.length > i) ? newLeagueSetup.teams[i] : TEAM_META[i];
    if (teamMeta) {
      const fullName = `${teamMeta.city} ${teamMeta.name}`;
      teams.push(makeTeam(i + 1, fullName, {
        city: teamMeta.city,
        conference: teamMeta.conference,
        division: teamMeta.division,
        market: teamMeta.market,
        primaryColor: teamMeta.primaryColor,
        secondaryColor: teamMeta.secondaryColor,
        logoPrimaryUrl: teamMeta.logoPrimaryUrl,
        logoSecondaryUrl: teamMeta.logoSecondaryUrl
      }));
    } else {
      teams.push(makeTeam(i + 1, `Team ${i + 1}`, {}));
    }
  }
  
  // Assign teams to leagueState
  leagueState.teams = teams;
  
  // Generate free agents
  leagueState.freeAgents = generateFreeAgents(30);
  
  // Collect all players (from teams + free agents)
  leagueState.players = [];
  teams.forEach(team => {
    if (team.players) {
      team.players.forEach(player => {
        player.teamId = team.id; // Stable team reference
        leagueState.players.push(player);
      });
    }
  });
  leagueState.freeAgents.forEach(player => {
    player.teamId = null; // Free agents have null teamId
    leagueState.players.push(player);
  });
  
  // Initialize draft
  leagueState.draft.picks = initializeDraftPicks(teams, seasonYear);
  leagueState.draft.prospects = generateDraftClass(seasonYear);
  
  // Initialize expansion
  leagueState.expansion = initExpansionState();
  
  // Initialize schedule
  leagueState.schedule = initScheduleState();
  
  // Update payrolls
  updateTeamPayrolls();
  
  // Set selected team to user's choice
  selectedTeamId = userTeamId || teams[0].id;
  
  // CRITICAL: Ensure leagueState.meta.userTeamId is set to match selectedTeamId
  leagueState.meta.userTeamId = selectedTeamId;
  
  console.log('[LEAGUE STATE] League created with userTeamId:', userTeamId, 'selectedTeamId:', selectedTeamId);
  
  // Initialize strength version for point spread caching
  leagueState.meta.strengthVersion = 0;
  
  // Convert to legacy format FIRST (so generateSeasonSchedule can access it)
  league = convertLeagueStateToLegacy(leagueState);
  
  // Automatically ensure schedule exists for the new league
  ensureSchedule();
  
  // Set initial phase based on league state
  updateLeaguePhase();
  
  appView = 'league';
  save();
  
  // Show welcome overlay for new leagues
  openWelcomeOverlay();
}

// Expose createLeague to global scope
if (typeof window !== 'undefined') {
  window.createLeague = createLeague;
}

/* ============================
   PLAYER SEASON STATS TRACKING
============================ */

async function updatePlayerSeasonStats(game) {
  if (!game || game.status !== 'final' || !game.boxScore) return;
  
  const phase = game.phase === 'Playoffs' ? 'playoffs' : 'regular';
  
  try {
    const db = await openDB();
    
    // Process both teams
    for (const teamId of [game.homeTeamId, game.awayTeamId]) {
      const teamStats = game.boxScore[teamId === game.homeTeamId ? 'home' : 'away'];
      if (!teamStats || !teamStats.players) continue;
      
      for (const pStat of teamStats.players) {
        await updatePlayerSeasonStat(db, game.season, pStat.playerId || pStat.pid, teamId, phase, pStat);
      }
    }
    
    // Also try new format
    if (game.boxScore[game.homeTeamId]) {
      for (const pStat of game.boxScore[game.homeTeamId]) {
        await updatePlayerSeasonStat(db, game.season, pStat.pid, game.homeTeamId, phase, pStat);
      }
    }
    if (game.boxScore[game.awayTeamId]) {
      for (const pStat of game.boxScore[game.awayTeamId]) {
        await updatePlayerSeasonStat(db, game.season, pStat.pid, game.awayTeamId, phase, pStat);
      }
    }
  } catch (error) {
    console.error('[Stats] Error updating player season stats:', error);
  }
}

async function updatePlayerSeasonStat(db, season, pid, teamId, phase, gameStats) {
  if (!pid) return;
  
  try {
    const tx = db.transaction('playerSeasonStats', 'readwrite');
    const store = tx.objectStore('playerSeasonStats');
    const index = store.index('seasonPid');
    const key = [season, pid, phase];
    
    let existing = null;
    try {
      existing = await index.get(key);
    } catch (e) {
      // Index might not exist yet
    }
    
    if (existing) {
      // Update existing stats
      existing.gp++;
      existing.min += gameStats.min || 0;
      existing.pts += gameStats.pts || 0;
      existing.reb += gameStats.reb || 0;
      existing.ast += gameStats.ast || 0;
      existing.stl += gameStats.stl || gameStats.st || 0;
      existing.blk += gameStats.blk || 0;
      existing.tov += gameStats.tov || gameStats.to || 0;
      existing.pf += gameStats.pf || 0;
      existing.fg += gameStats.fg || 0;
      existing.fga += gameStats.fga || 0;
      existing.tp += gameStats.tp || gameStats['3p'] || 0;
      existing.tpa += gameStats.tpa || gameStats['3pa'] || 0;
      existing.ft += gameStats.ft || 0;
      existing.fta += gameStats.fta || 0;
      
      await store.put(existing);
    } else {
      // Create new season stat entry
      const newStat = {
        season: season,
        pid: pid,
        teamId: teamId,
        phase: phase,
        gp: 1,
        min: gameStats.min || 0,
        pts: gameStats.pts || 0,
        reb: gameStats.reb || 0,
        ast: gameStats.ast || 0,
        stl: gameStats.stl || gameStats.st || 0,
        blk: gameStats.blk || 0,
        tov: gameStats.tov || gameStats.to || 0,
        pf: gameStats.pf || 0,
        fg: gameStats.fg || 0,
        fga: gameStats.fga || 0,
        tp: gameStats.tp || gameStats['3p'] || 0,
        tpa: gameStats.tpa || gameStats['3pa'] || 0,
        ft: gameStats.ft || 0,
        fta: gameStats.fta || 0
      };
      
      await store.add(newStat);
    }
  } catch (error) {
    console.error('[Stats] Error updating individual player stat:', error);
  }
}
