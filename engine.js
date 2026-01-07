/* ============================
   GAME ENGINE - PLAYER GENERATION & TEAM STATS
============================ */

// Schema Version for League Migrations
const CURRENT_SCHEMA_VERSION = 5; // Incremented for leagueState refactor

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
      lockGenderEditing: true // Prevent gender editing unless commissioner mode
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
    }
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
  persistLeagueState();
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
  persistLeagueState();
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
  
  // Base ratings
  let shoot = rand(30, 85);
  let defense = rand(30, 85);
  let rebound = rand(30, 85);
  let passing = rand(30, 85);
  
  if (isRookie) {
    // Rookies have more variance and generally lower ratings
    shoot = clamp(rand(40, 75) + rand(-15, 15), 35, 90);
    defense = clamp(rand(40, 75) + rand(-15, 15), 35, 90);
    rebound = clamp(rand(40, 75) + rand(-15, 15), 35, 90);
    passing = clamp(rand(40, 75) + rand(-15, 15), 35, 90);
  }
  
  const ovr = Math.round((shoot + defense + rebound + passing) / 4);
  let pot = isRookie ? clamp(ovr + rand(0, 25), ovr, 95) : clamp(ovr + rand(-5, 10), ovr - 5, 95);
  
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
      hasTeamOption: false
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
  const teamA = league.teams.find(t => t.id === teamAId);
  const teamB = league.teams.find(t => t.id === teamBId);
  
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
  
  // Save league
  saveLeague(league);
  
  return true;
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
        passing
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
      isWatchlisted: false
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
  return {
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
      passing: prospect.ratings.passing
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
      draftedByTid: teamId
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
  
  // Record the pick
  league.draft.results.push({
    pickNumber: currentPick.overallPick,
    round: currentPick.round,
    teamId: pickingTeamId,
    teamName: team.name,
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
  
  const phase = league.phase?.toLowerCase() || '';
  const needsSchedule = 
    (!league.schedule || !league.schedule.days || !league.schedule.days[league.season] || league.schedule.days[league.season].length === 0) &&
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

function generateSeasonSchedule(season) {
  if (!league || !league.teams || league.teams.length < 2) return;
  
  if (!league.schedule) league.schedule = initScheduleState();
  if (!league.schedule.days[season]) {
    league.schedule.days[season] = [];
  }
  
  const teams = league.teams;
  const numTeams = teams.length;
  const gamesPerTeam = GAMES_PER_SEASON;
  const seasonDays = calculateSeasonDays(gamesPerTeam);
  
  console.log(`Generating ${seasonDays}-day schedule for ${numTeams} teams (${gamesPerTeam} games each)`);
  
  // Generate all matchups
  const allMatchups = [];
  const matchupsPerPair = Math.ceil(gamesPerTeam / (numTeams - 1));
  
  for (let i = 0; i < numTeams; i++) {
    for (let j = i + 1; j < numTeams; j++) {
      for (let k = 0; k < matchupsPerPair; k++) {
        const homeTeam = k % 2 === 0 ? teams[i] : teams[j];
        const awayTeam = k % 2 === 0 ? teams[j] : teams[i];
        
        allMatchups.push({
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id
        });
      }
    }
  }
  
  // Shuffle matchups for variety
  for (let i = allMatchups.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allMatchups[i], allMatchups[j]] = [allMatchups[j], allMatchups[i]];
  }
  
  // Track games played by each team to avoid fatigue issues
  const teamGameDays = {};
  teams.forEach(t => teamGameDays[t.id] = []);
  
  let matchupIndex = 0;
  const maxGamesPerDay = Math.floor(numTeams / 2);
  
  // Distribute games across days
  for (let dayNum = 1; dayNum <= seasonDays; dayNum++) {
    const day = createScheduleDay(dayNum, 'Regular Season');
    
    // Decide how many games to schedule this day (allow rest days)
    const shouldRest = Math.random() < 0.15; // 15% chance of rest day
    const numGamesToday = shouldRest ? 0 : Math.floor(Math.random() * maxGamesPerDay) + Math.max(1, Math.floor(maxGamesPerDay * 0.6));
    
    if (!shouldRest && matchupIndex < allMatchups.length) {
      let gamesScheduled = 0;
      
      while (gamesScheduled < numGamesToday && matchupIndex < allMatchups.length) {
        const matchup = allMatchups[matchupIndex];
        
        // Check if both teams can play (avoid too many back-to-backs)
        const homeLastGame = teamGameDays[matchup.homeTeamId].slice(-1)[0] || 0;
        const awayLastGame = teamGameDays[matchup.awayTeamId].slice(-1)[0] || 0;
        
        // Allow back-to-backs but not excessive streaks
        const homeStreak = homeLastGame === dayNum - 1 && (teamGameDays[matchup.homeTeamId].slice(-2)[0] || 0) === dayNum - 2;
        const awayStreak = awayLastGame === dayNum - 1 && (teamGameDays[matchup.awayTeamId].slice(-2)[0] || 0) === dayNum - 2;
        
        if (!homeStreak && !awayStreak) {
          const gameId = `game_${season}_${nextGameId++}`;
          league.schedule.games[gameId] = {
            id: gameId,
            season,
            day: dayNum,
            homeTeamId: matchup.homeTeamId,
            awayTeamId: matchup.awayTeamId,
            status: 'scheduled',
            score: { home: 0, away: 0 },
            quarter: 0,
            timeRemaining: '12:00',
            log: [],
            boxScore: null
          };
          
          day.games.push(gameId);
          teamGameDays[matchup.homeTeamId].push(dayNum);
          teamGameDays[matchup.awayTeamId].push(dayNum);
          
          gamesScheduled++;
          matchupIndex++;
        } else {
          matchupIndex++;
        }
      }
    }
    
    league.schedule.days[season].push(day);
  }
  
  // If we have leftover games, append more days
  while (matchupIndex < allMatchups.length) {
    const dayNum = league.schedule.days[season].length + 1;
    const day = createScheduleDay(dayNum, 'Regular Season');
    
    let gamesScheduled = 0;
    while (gamesScheduled < maxGamesPerDay && matchupIndex < allMatchups.length) {
      const matchup = allMatchups[matchupIndex];
      const gameId = `game_${season}_${nextGameId++}`;
      
      league.schedule.games[gameId] = {
        id: gameId,
        season,
        day: dayNum,
        homeTeamId: matchup.homeTeamId,
        awayTeamId: matchup.awayTeamId,
        status: 'scheduled',
        score: { home: 0, away: 0 },
        quarter: 0,
        timeRemaining: '12:00',
        log: [],
        boxScore: null
      };
      
      day.games.push(gameId);
      gamesScheduled++;
      matchupIndex++;
    }
    
    league.schedule.days[season].push(day);
  }
  
  league.schedule.currentDay = 1;
  
  // Sync schedule changes to leagueState if it exists
  if (leagueState) {
    leagueState.schedule = league.schedule;
  }
  
  console.log(`Generated ${Object.keys(league.schedule.games).length} games across ${league.schedule.days[season].length} days`);
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
  
  // Add simple log entry
  game.log = [
    { quarter: 0, time: '12:00', text: 'Game Start' },
    { quarter: 4, time: '0:00', text: `Final Score: ${awayTeam.name} ${result.awayScore}, ${homeTeam.name} ${result.homeScore}` }
  ];
  
  return game;
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
      const shotSuccess = Math.random() < 0.45;
      const isThree = Math.random() < 0.35;
      const points = isThree ? 3 : 2;
      
      if (shotSuccess) {
        if (game.possession === 'home') {
          game.score.home += points;
        } else {
          game.score.away += points;
        }
        logText = `${player.name} ${isThree ? 'hits a three-pointer' : 'makes the layup'}! ${points} points.`;
        scored = true;
      } else {
        logText = `${player.name} misses the ${isThree ? 'three' : 'shot'}.`;
      }
      game.possession = game.possession === 'home' ? 'away' : 'home';
      break;
      
    case 'turnover':
      logText = `Turnover by ${player.name}!`;
      game.possession = game.possession === 'home' ? 'away' : 'home';
      break;
      
    case 'foul':
      const defender = defendingTeam.players[Math.floor(Math.random() * Math.min(5, defendingTeam.players.length))];
      logText = `Foul by ${defender.name} on ${player.name}.`;
      break;
      
    case 'rebound':
      logText = `${player.name} grabs the rebound.`;
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
  } else {
    teamB.wins++;
    teamA.losses++;
    teamB.coach.careerStats.wins++;
    teamA.coach.careerStats.losses++;
    
    // Track advanced stats for team B (winner)
    updateTeamStats(teamA, false, isHomeGame, sameConference);
    updateTeamStats(teamB, true, !isHomeGame, sameConference);
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
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      for (let k = 0; k < 4; k++) {
        simGame(teams[i], teams[j]);
      }
    }
  }
  
  league.phase = 'offseason';
  
  // Save season to history
  saveSeasonToHistory();
  
  render();
  alert('Regular season complete! Proceed to Offseason.');
  save();
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
  if (!team) return;
  
  const player = team.players.find(p => p.id === playerId);
  if (!player) return;
  
  if (!confirm(`Cut ${player.name}? (Salary: $${player.contract.amount}M)`)) return;
  
  team.players = team.players.filter(p => p.id !== playerId);
  league.freeAgents.push(player);
  
  updateTeamPayrolls();
  render();
  save();
}

function signFreeAgent(playerId, teamId) {
  const team = league.teams.find(t => t.id === teamId);
  const player = league.freeAgents.find(p => p.id === playerId);
  
  if (!team || !player) return;
  
  const currentPayroll = team.players.reduce((sum, p) => sum + p.contract.amount, 0);
  if (currentPayroll + player.contract.amount > SALARY_CAP) {
    alert('Not enough cap space!');
    return;
  }
  
  if (team.players.length >= 15) {
    alert('Roster full! (Max 15 players)');
    return;
  }
  
  team.players.push(player);
  league.freeAgents = league.freeAgents.filter(p => p.id !== playerId);
  
  updateTeamPayrolls();
  render();
  save();
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
  // Get players who should play this game based on rotation
  if (!team.rotations) {
    // Fallback: top 8 by OVR
    return team.players.sort((a, b) => b.ratings.ovr - a.ratings.ovr).slice(0, 8);
  }
  
  // Get players with minute targets > 0, sorted by target minutes
  const playersWithMinutes = team.players
    .filter(p => (team.rotations.minuteTargetsByPlayerId[p.id] || 0) > 0)
    .sort((a, b) => {
      const minsB = team.rotations.minuteTargetsByPlayerId[b.id] || 0;
      const minsA = team.rotations.minuteTargetsByPlayerId[a.id] || 0;
      return minsB - minsA;
    });
  
  // Ensure at least 8 players (fill with next best OVR if needed)
  if (playersWithMinutes.length < 8) {
    const remainingPlayers = team.players
      .filter(p => !playersWithMinutes.includes(p))
      .sort((a, b) => b.ratings.ovr - a.ratings.ovr);
    
    playersWithMinutes.push(...remainingPlayers.slice(0, 8 - playersWithMinutes.length));
  }
  
  return playersWithMinutes.slice(0, 10); // Top 10 players for rotation
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
        player.draft.year = null;
        player.draft.round = null;
        player.draft.pick = null;
        player.draft.draftedByTid = null;
      } else {
        // If drafted but team not found, set to null
        if (player.draft.draftedByTid !== null && !validTeamIds.has(player.draft.draftedByTid)) {
          player.draft.draftedByTid = null;
        }
      }
      
      // Normalize -1 to null
      if (player.draft.draftedByTid === -1) {
        player.draft.draftedByTid = null;
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
  console.log('[LEAGUE STATE] League created with userTeamId:', userTeamId, 'selectedTeamId:', selectedTeamId);
  
  // Convert to legacy format FIRST (so generateSeasonSchedule can access it)
  league = convertLeagueStateToLegacy(leagueState);
  
  // Automatically ensure schedule exists for the new league
  ensureSchedule();
  
  appView = 'league';
  save();
  
  // Show welcome overlay for new leagues
  openWelcomeOverlay();
}

