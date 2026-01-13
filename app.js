/* ============================
   CONSTANTS & GLOBALS
============================ */

const POS = ["PG", "SG", "SF", "PF", "C"];
const SALARY_CAP = 120; // millions
const LUXURY_TAX_LINE = 146; // millions
const HARD_CAP_APRON = 172; // millions
const MLE_AMOUNT = 12.4; // millions
const BAE_AMOUNT = 4.5; // millions
const TMLE_AMOUNT = 5.0; // millions (Taxpayer MLE)
const MIN_SALARY = 1; // millions

/* ============================
   UTILITY HELPERS
============================ */

// Safe value helper - returns fallback for null/undefined/empty strings
function val(v, fallback = "—") {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "string" && v.trim() === "") return fallback;
  return v;
}

// Normalize player data to ensure consistent structure
function normalizePlayer(player) {
  if (!player) return null;
  
  // Normalize bio object
  if (!player.bio) {
    player.bio = {};
  }
  
  // Map common field variants to standard bio fields
  const bio = player.bio;
  
  // Height variants
  bio.height = val(bio.height || player.height);
  
  // Weight variants
  bio.weight = val(bio.weight || player.weight);
  
  // Wingspan variants
  bio.wingspan = val(bio.wingspan || bio.wingSpan || player.wingspan || player.wingSpan);
  
  // Hometown variants
  bio.hometown = val(bio.hometown || bio.homeTown || player.hometown || player.homeTown);
  
  // Country variants
  bio.country = val(bio.country || player.country, "USA");
  
  // College variants
  bio.college = val(bio.college || bio.collegeName || player.college || player.collegeName);
  
  // DRAFT DATA MIGRATION: Normalize to player.draft structure
  if (!player.draft) {
    player.draft = {
      year: null,
      round: null,
      pick: null,
      draftedByTid: null
    };
  }
  
  // Migrate from old bio.draftYear/Round/Pick fields
  if (player.draft.year === null && bio.draftYear !== undefined) {
    const year = typeof bio.draftYear === 'number' && isFinite(bio.draftYear) ? bio.draftYear : null;
    const round = typeof bio.draftRound === 'number' && isFinite(bio.draftRound) ? bio.draftRound : null;
    const pick = typeof bio.draftPick === 'number' && isFinite(bio.draftPick) ? bio.draftPick : null;
    
    player.draft.year = year;
    player.draft.round = round;
    player.draft.pick = pick;
    
    // Clean up old bio fields
    delete bio.draftYear;
    delete bio.draftRound;
    delete bio.draftPick;
  }
  
  // Migrate draftedByTid
  if (player.draft.draftedByTid === undefined || player.draft.draftedByTid === null) {
    if (bio.draftedByTid !== undefined && bio.draftedByTid !== null) {
      player.draft.draftedByTid = typeof bio.draftedByTid === 'number' ? bio.draftedByTid : null;
      delete bio.draftedByTid;
    }
  }
  
  // Normalize -1 to null
  if (player.draft.draftedByTid === -1) {
    player.draft.draftedByTid = null;
  }
  
  // Ensure attributes exist with defaults
  if (!player.attributes) {
    player.attributes = {
      athletic: {
        speed: 75, acceleration: 75, strength: 75, vertical: 75,
        lateralQuickness: 75, stamina: 75, hustle: 75
      },
      offensive: {
        scoringSkills: {
          finishing: 75, midRangeShooting: 75, threePointShooting: 75,
          freeThrowShooting: 75, postScoring: 75, shotCreation: 75
        },
        playmakingSkills: {
          ballHandling: 75, passingVision: 75, passingAccuracy: 75, offBallMovement: 75
        }
      },
      defensive: {
        perimeterDefense: 75, interiorDefense: 75, blockRating: 75,
        stealRating: 75, defensiveRebounding: 75, offensiveRebounding: 75, defensiveAwareness: 75
      },
      mental: {
        basketballIQ: 75, consistency: 75, workEthic: 75,
        leadership: 75, composure: 75, discipline: 75, clutch: 75
      }
    };
  }
  
  // Ensure personality exists with defaults
  if (!player.personality) {
    player.personality = {
      currentSatisfactionPct: 75,
      satisfactionLabel: 'Content',
      loyalty: 70, moneyFocus: 60, winningDrive: 80,
      playingTimeDesire: 65, teamPlayer: 70, workEthic: 75,
      ego: 60, temperament: 70
    };
  }
  
  return player;
}

const TEAM_META = [
  // Eastern Conference - Atlantic Division
  { city: "New York", name: "Comets", conference: "East", division: "Atlantic", market: "Large", primaryColor: "#FF6B35", secondaryColor: "#004E89", logoPrimaryUrl: "", logoSecondaryUrl: "☄️" },
  { city: "Boston", name: "Titans", conference: "East", division: "Atlantic", market: "Large", primaryColor: "#00843D", secondaryColor: "#FFFFFF", logoPrimaryUrl: "", logoSecondaryUrl: "⚡" },
  { city: "Brooklyn", name: "Empire", conference: "East", division: "Atlantic", market: "Large", primaryColor: "#000000", secondaryColor: "#FFFFFF", logoPrimaryUrl: "", logoSecondaryUrl: "🏛️" },
  { city: "Philadelphia", name: "Founders", conference: "East", division: "Atlantic", market: "Large", primaryColor: "#0077C8", secondaryColor: "#ED174C", logoPrimaryUrl: "", logoSecondaryUrl: "🔔" },
  { city: "Toronto", name: "Voyagers", conference: "East", division: "Atlantic", market: "Medium", primaryColor: "#CE1141", secondaryColor: "#000000", logoPrimaryUrl: "", logoSecondaryUrl: "🚀" },
  
  // Eastern Conference - Central Division
  { city: "Chicago", name: "Queens", conference: "East", division: "Central", market: "Large", primaryColor: "#CE1141", secondaryColor: "#000000", logoPrimaryUrl: "", logoSecondaryUrl: "👑" },
  { city: "Milwaukee", name: "Thunder", conference: "East", division: "Central", market: "Medium", primaryColor: "#00471B", secondaryColor: "#EEE1C6", logoPrimaryUrl: "", logoSecondaryUrl: "⚡" },
  { city: "Indiana", name: "Fury", conference: "East", division: "Central", market: "Medium", primaryColor: "#002D62", secondaryColor: "#FDBB30", logoPrimaryUrl: "", logoSecondaryUrl: "🔥" },
  { city: "Detroit", name: "Engines", conference: "East", division: "Central", market: "Medium", primaryColor: "#C8102E", secondaryColor: "#1D42BA", logoPrimaryUrl: "", logoSecondaryUrl: "⚙️" },
  { city: "Cleveland", name: "Steam", conference: "East", division: "Central", market: "Medium", primaryColor: "#860038", secondaryColor: "#FDBB30", logoPrimaryUrl: "", logoSecondaryUrl: "💨" },
  
  // Eastern Conference - Southeast Division
  { city: "Miami", name: "Heatwave", conference: "East", division: "Southeast", market: "Large", primaryColor: "#98002E", secondaryColor: "#F9A01B", logoPrimaryUrl: "", logoSecondaryUrl: "🌊" },
  { city: "Atlanta", name: "Skyforce", conference: "East", division: "Southeast", market: "Large", primaryColor: "#E03A3E", secondaryColor: "#C1D32F", logoPrimaryUrl: "", logoSecondaryUrl: "🦅" },
  { city: "Washington", name: "Monuments", conference: "East", division: "Southeast", market: "Large", primaryColor: "#002B5C", secondaryColor: "#E31837", logoPrimaryUrl: "", logoSecondaryUrl: "🗽" },
  { city: "Charlotte", name: "Lynx", conference: "East", division: "Southeast", market: "Medium", primaryColor: "#1D1160", secondaryColor: "#00788C", logoPrimaryUrl: "", logoSecondaryUrl: "🐆" },
  { city: "Orlando", name: "Knights", conference: "East", division: "Southeast", market: "Medium", primaryColor: "#0077C0", secondaryColor: "#C4CED4", logoPrimaryUrl: "", logoSecondaryUrl: "⚔️" },
  
  // Western Conference - Northwest Division
  { city: "Denver", name: "Altitude", conference: "West", division: "Northwest", market: "Medium", primaryColor: "#0E2240", secondaryColor: "#FEC524", logoPrimaryUrl: "", logoSecondaryUrl: "⛰️" },
  { city: "Portland", name: "Cascade", conference: "West", division: "Northwest", market: "Medium", primaryColor: "#E03A3E", secondaryColor: "#000000", logoPrimaryUrl: "", logoSecondaryUrl: "🌲" },
  { city: "Utah", name: "Avalanche", conference: "West", division: "Northwest", market: "Small", primaryColor: "#002B5C", secondaryColor: "#00471B", logoPrimaryUrl: "", logoSecondaryUrl: "❄️" },
  { city: "Oklahoma City", name: "Stampede", conference: "West", division: "Northwest", market: "Medium", primaryColor: "#007AC1", secondaryColor: "#EF3B24", logoPrimaryUrl: "", logoSecondaryUrl: "🐃" },
  { city: "Minnesota", name: "Blizzard", conference: "West", division: "Northwest", market: "Medium", primaryColor: "#0C2340", secondaryColor: "#78BE20", logoPrimaryUrl: "", logoSecondaryUrl: "🌨️" },
  
  // Western Conference - Pacific Division
  { city: "Los Angeles", name: "Waves", conference: "West", division: "Pacific", market: "Large", primaryColor: "#552583", secondaryColor: "#FDB927", logoPrimaryUrl: "", logoSecondaryUrl: "🌊" },
  { city: "Los Angeles", name: "Eclipse", conference: "West", division: "Pacific", market: "Large", primaryColor: "#C8102E", secondaryColor: "#1D428A", logoPrimaryUrl: "", logoSecondaryUrl: "🌑" },
  { city: "Golden State", name: "Pioneers", conference: "West", division: "Pacific", market: "Large", primaryColor: "#1D428A", secondaryColor: "#FFC72C", logoPrimaryUrl: "", logoSecondaryUrl: "⚓" },
  { city: "Phoenix", name: "Inferno", conference: "West", division: "Pacific", market: "Large", primaryColor: "#E56020", secondaryColor: "#1D1160", logoPrimaryUrl: "", logoSecondaryUrl: "🔥" },
  { city: "Sacramento", name: "Dragons", conference: "West", division: "Pacific", market: "Medium", primaryColor: "#5A2D81", secondaryColor: "#63727A", logoPrimaryUrl: "", logoSecondaryUrl: "🐉" },
  
  // Western Conference - Southwest Division
  { city: "Dallas", name: "Strikers", conference: "West", division: "Southwest", market: "Large", primaryColor: "#00538C", secondaryColor: "#002F87", logoPrimaryUrl: "", logoSecondaryUrl: "⭐" },
  { city: "Houston", name: "Astros", conference: "West", division: "Southwest", market: "Large", primaryColor: "#CE1141", secondaryColor: "#000000", logoPrimaryUrl: "", logoSecondaryUrl: "🚀" },
  { city: "San Antonio", name: "Generals", conference: "West", division: "Southwest", market: "Large", primaryColor: "#C4CED4", secondaryColor: "#000000", logoPrimaryUrl: "", logoSecondaryUrl: "🎖️" },
  { city: "Memphis", name: "Blues", conference: "West", division: "Southwest", market: "Medium", primaryColor: "#5D76A9", secondaryColor: "#12173F", logoPrimaryUrl: "", logoSecondaryUrl: "🎵" },
  { city: "New Orleans", name: "Voodoo", conference: "West", division: "Southwest", market: "Medium", primaryColor: "#0C2340", secondaryColor: "#C8102E", logoPrimaryUrl: "", logoSecondaryUrl: "🎭" }
];

// Generate SVG logo for a team
function generateTeamLogo(teamName, colors) {
  // Get initials from team name (e.g., "New York Comets" -> "NYC")
  const words = teamName.split(' ');
  let initials = '';
  
  if (words.length === 1) {
    initials = words[0].substring(0, 2).toUpperCase();
  } else if (words.length === 2) {
    initials = words[0][0] + words[1][0];
  } else {
    initials = words[0][0] + words[1][0] + words[2][0];
  }
  initials = initials.toUpperCase();
  
  const svg = `
    <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad-${initials}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${colors.primary};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${colors.secondary};stop-opacity:1" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="23" fill="url(#grad-${initials})" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
      <text x="24" y="24" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">${initials}</text>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// Legacy league object for backwards compatibility
let league = null;

/* ============================
   LEAGUE STATE HELPERS
============================ */

/**
 * Get current user's team from leagueState
 * Falls back to league object if leagueState not available
 */
function getUserTeam() {
  if (leagueState) {
    return leagueState.teams.find(t => t.id === leagueState.meta.userTeamId);
  }
  if (league) {
    return league.teams.find(t => t.id === selectedTeamId);
  }
  return null;
}

/**
 * Get team by ID from leagueState
 */
function getTeamById(teamId) {
  if (leagueState) {
    return leagueState.teams.find(t => t.id === teamId);
  }
  if (league) {
    return league.teams.find(t => t.id === teamId);
  }
  return null;
}

/**
 * Get player by ID from leagueState
 */
function getPlayerById(playerId) {
  if (leagueState && leagueState.players) {
    return leagueState.players.find(p => p.id === playerId);
  }
  // Fall back to searching all teams + free agents
  if (league) {
    for (const team of league.teams) {
      const player = team.players.find(p => p.id === playerId);
      if (player) return player;
    }
    return league.freeAgents.find(p => p.id === playerId);
  }
  return null;
}

/**
 * Get all players for a team from leagueState
 */
function getTeamPlayers(teamId) {
  if (leagueState && leagueState.players) {
    return leagueState.players.filter(p => p.teamId === teamId);
  }
  if (league) {
    const team = league.teams.find(t => t.id === teamId);
    return team ? team.players : [];
  }
  return [];
}

/**
 * Get all free agents from leagueState
 */
function getFreeAgents() {
  if (leagueState) {
    return leagueState.players.filter(p => p.teamId === null);
  }
  if (league) {
    return league.freeAgents;
  }
  return [];
}

/**
 * Get current league phase
 * SINGLE SOURCE OF TRUTH: league.phase
 */
function getCurrentPhase() {
  if (!league || !league.phase) return 'OFFSEASON';
  return league.phase.toUpperCase();
}

/**
 * Get display name for current phase
 */
function getCurrentPhaseDisplay() {
  if (!league) return 'No League';
  
  const phase = getCurrentPhase();
  
  // DEBUG: Show raw phase value (set DEBUG_PHASE = true to enable)
  if (window.DEBUG_PHASE) {
    const rawPhase = leagueState?.meta?.phase || league?.phase || 'undefined';
    const normalized = (rawPhase || '').toUpperCase();
    console.log('[PHASE DEBUG] raw=' + rawPhase + ' normalized=' + normalized);
  }
  
  if (typeof getPhaseDisplayName === 'function') {
    return getPhaseDisplayName(phase);
  }
  
  // Fallback formatting
  const displayMap = {
    'PRESEASON': 'Preseason',
    'REGULAR_SEASON': 'Regular Season',
    'ALL_STAR_BREAK': 'All-Star Break',
    'POSTSEASON': 'Playoffs',
    'PLAYOFFS': 'Playoffs',
    'OFFSEASON': 'Offseason',
    'DRAFT': 'Draft',
    'FREE_AGENCY': 'Free Agency',
    'preseason': 'Preseason',
    'season': 'Regular Season',
    'playoffs': 'Playoffs',
    'offseason': 'Offseason',
    'draft': 'Draft'
  };
  
  return displayMap[phase] || (phase ? phase.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'OFFSEASON');
}

/**
 * Start the regular season from preseason
 * CRITICAL: This is the handler for the Season Start button
 */
async function startRegularSeason() {
  if (!league) {
    alert('No league loaded');
    return;
  }
  
  const currentPhase = (league.phase || '').toUpperCase();
  
  console.log('═══════════════════════════════════════');
  console.log('[PHASE] Season Start Button Clicked');
  console.log('[PHASE] BEFORE - league.phase:', league.phase);
  console.log('[PHASE] BEFORE - leagueState.meta.phase:', leagueState?.meta?.phase);
  console.log('[PHASE] BEFORE - league.day:', league.day);
  console.log('═══════════════════════════════════════');
  
  if (currentPhase !== 'PRESEASON') {
    alert(`Can only start season from Preseason phase (current: ${currentPhase})`);
    return;
  }
  
  console.log('[PHASE] ✓ Phase check passed - advancing to REGULAR_SEASON');
  
  // CRITICAL: Set league.phase as single source of truth
  league.phase = 'REGULAR_SEASON';
  
  // Also update leagueState for persistence
  if (leagueState && leagueState.meta) {
    leagueState.meta.phase = 'REGULAR_SEASON';
    leagueState.meta.day = 1; // Start at day 1 of regular season
    leagueState.meta.regularSeasonStarted = true;
  }
  
  // Sync day to league object
  if (league) {
    league.day = 1;
  }
  
  console.log('[PHASE] advanced to', leagueState.meta.phase);
  console.log('[PHASE] day set to', leagueState.meta.day);
  
  // Ensure schedule exists
  if (typeof ensureSchedule === 'function') {
    ensureSchedule();
  }
  
  // Reset simulation state
  if (league.simulation) {
    league.simulation.currentEventIndex = 0;
    league.simulation.gamesSimulated = 0;
    league.simulation.isPaused = false;
    league.simulation.eventQueue = [];
  }
  
  // Save state (REQUIRED) - MUST complete before UI refresh
  console.log('[PHASE] Saving league state...');
  if (typeof saveLeagueState === 'function') {
    await saveLeagueState();
    console.log('[PHASE] ✓ saveLeagueState() complete');
  } else if (typeof save === 'function') {
    await save();
    console.log('[PHASE] ✓ save() complete');
  } else {
    console.error('[PHASE] ✗ No save function available!');
  }
  
  console.log('═══════════════════════════════════════');
  console.log('[PHASE] AFTER - league.phase:', league.phase);
  console.log('[PHASE] AFTER - leagueState.meta.phase:', leagueState?.meta?.phase);
  console.log('[PHASE] AFTER - league.day:', league.day);
  console.log('[PHASE] ✓ Phase transition complete');
  console.log('═══════════════════════════════════════');
  console.log('═══════════════════════════════════════');
  
  // CRITICAL: Force full UI re-render
  console.log('[PHASE] Triggering UI re-render...');
  render();
  console.log('[PHASE] ✓ UI re-render complete');
  
  alert('✅ Regular season has begun! Sim buttons are now enabled.');
}

// Expose to window for onclick handlers
window.startRegularSeason = startRegularSeason;

/**
 * Get current season
 */
function getCurrentSeason() {
  if (leagueState) {
    return leagueState.meta.season;
  }
  if (league) {
    return league.season;
  }
  return new Date().getFullYear();
}

/**
 * Check if commissioner mode is active
 */
function isCommissionerMode() {
  if (leagueState) {
    return leagueState.meta.commissionerMode === true;
  }
  if (league && league.meta) {
    return league.meta.commissionerEnabled === true;
  }
  return false;
}

let DEBUG_PLAYS = false; // Set to true to see play-by-play debug logs

// Console command to enable/disable play debug logging
window.togglePlayDebug = function() {
  DEBUG_PLAYS = !DEBUG_PLAYS;
  console.log(`[PLAYS] Debug logging ${DEBUG_PLAYS ? 'ENABLED' : 'DISABLED'}`);
  if (DEBUG_PLAYS) {
    console.log('[PLAYS] Type "togglePlayDebug()" in console to disable');
  }
  return DEBUG_PLAYS;
};

// Utility: Ensure game.log exists and is an array
// Initialize league history if missing
function initHistoryIfMissing(league) {
  if (!league.history) {
    league.history = {
      seasons: {}, // { [year]: seasonData }
      championsByYear: [],
      awardsByYear: {},
      draftsByYear: {},
      records: {
        team: [],
        player: []
      },
      transactionLog: [],
      startYear: league.season // Track when history recording began
    };
  }
  return league.history;
}

// Archive season at end of playoffs
function archiveSeasonIfNeeded(league, year) {
  const history = initHistoryIfMissing(league);
  
  // Don't overwrite existing archives
  if (history.seasons[year]) return;
  
  // Create season archive
  history.seasons[year] = {
    year: year,
    champion: null, // Set after finals
    finalist: null,
    finalsResult: null, // e.g., "4-2"
    mvp: null,
    awards: {
      mvp: null,
      dpoy: null,
      roy: null,
      sixmoy: null,
      mip: null,
      coty: null,
      allLeague: { first: [], second: [], third: [] }
    },
    standings: league.teams.map(t => ({
      teamId: t.id,
      name: t.name,
      wins: t.wins,
      losses: t.losses,
      conference: t.conference,
      playoffSeed: t.playoffSeed || null
    })),
    playoffBracket: null, // Store playoff matchups if implemented
    draftResults: league.draft?.results || [],
    teamStatsLeaders: {},
    playerStatsLeaders: {},
    notableEvents: []
  };
  
  save();
}

// Log transaction
function logTransaction(league, entry) {
  const history = initHistoryIfMissing(league);
  
  history.transactionLog.unshift({
    id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    season: league.season,
    day: getCurrentDay(),
    timestamp: Date.now(),
    type: entry.type, // 'trade', 'signing', 'release', 'extension', 'draft'
    summary: entry.summary,
    details: entry.details || {},
    teams: entry.teams || []
  });
  
  // Keep last 500 transactions
  if (history.transactionLog.length > 500) {
    history.transactionLog = history.transactionLog.slice(0, 500);
  }
  
  save();
}

function ensureGameLog(game) {
  if (!game) return;
  if (!game.log || !Array.isArray(game.log)) {
    game.log = [];
    if (DEBUG_PLAYS) {
      console.log(`[PLAYS] ensureGameLog: Initialized log for game ${game.id}`);
    }
  }
}

let appView = 'home'; // 'home', 'myLeagues', 'newLeague', 'editTeam', or 'league'
let standingsView = 'record'; // 'record' or 'power'
let currentTab = 'dashboard';
let historyTab = 'seasons'; // 'seasons', 'champions', 'awards', 'drafts', 'records', 'transactions'
let historyFilters = {
  season: null, // null = current season
  team: null, // null = all teams
  awardType: 'mvp', // for awards tab
  recordType: 'team', // 'team' or 'player'
  transactionType: 'all' // 'all', 'trade', 'signing', 'release', etc.
};

// Stats tab state
let statsSubTab = 'playerLeaders'; // playerLeaders | playerTable | teamLeaders | teamTable | advanced | gameLogs
let statsFilters = {
  season: null, // null = current season
  phase: 'regular', // regular | playoffs | preseason
  perGame: true, // true = per game, false = totals
  search: '',
  conference: 'all', // all | East | West
  team: 'all', // all | team ID
  position: 'all', // all | PG | SG | SF | PF | C
  minGP: 1,
  sortBy: 'pts',
  sortDir: 'desc'
};

// News tab state
let newsSubTab = 'feed'; // feed | inbox | breaking
let newsFilters = {
  category: 'all', // all | league | myteam | transactions | injuries | rumors | games | awards | draft | finance | chemistry
  search: '',
  showRead: true
};
let expandedNewsItems = new Set(); // Track which news items are expanded

let selectedTeamId = null;

// Schedule tab state
let scheduleView = 'myteam'; // 'myteam' | 'otherteams' | 'league'
let scheduleSelectedTeamId = null; // For 'otherteams' view
let selectedPlayerId = null;
let nextPlayerId = 1;
let sidebarOpen = false; // For sidebar drawer state
let allSavedLeagues = []; // Cache of saved leagues for home screen
let editTeamId = null; // For editing team details in New League setup

// New League Setup State
let newLeagueState = {
  name: '',
  seasonYear: new Date().getFullYear(),
  teamCount: 30,
  userTeamId: null,
  currentTab: 'teams', // 'teams' or 'settings'
  teams: [], // Will hold customized team metadata during setup
  
  // League Settings
  settings: {
    // League Structure
    conferencesEnabled: true,
    divisionsEnabled: true,
    playoffTeams: 16,
    playInTournament: false,
    
    // Season Format
    gamesPerTeam: 82,
    backToBackFrequency: 'Normal',
    allStarBreak: true,
    
    // Salary Cap & Economy
    capSystem: 'soft', // 'hard' or 'soft'
    salaryCap: 123500000,
    capGrowthRate: 3,
    luxuryTax: true,
    luxuryTaxLine: 150000000,
    apronEnabled: false,
    minRosterSize: 13,
    maxRosterSize: 15,
    
    // Contracts & Free Agency
    maxContractYears: 5,
    playerOptions: true,
    teamOptions: true,
    restrictedFA: true,
    noTradeClauses: true,
    signAndTrade: true,
    
    // Draft Settings
    draftRounds: 2,
    lotterySystem: 'NBA',
    prospectClassSize: 60,
    autoDraftClasses: true,
    
    // Gameplay & Simulation
    injuryFrequency: 'Normal',
    injurySeverity: 'Normal',
    fatigueImpact: 'Normal',
    statEnvironment: 'Modern',
    playerDevelopment: 'Normal',
    playerAging: 'Normal',
    
    // AI & Difficulty
    aiTradeLogic: 'Normal',
    aiContractIntelligence: 'Normal',
    aiTankingBehavior: 'Realistic',
    fogOfWar: false,
    
    // Immersion
    newsFrequency: 'Normal',
    moraleSystem: true,
    rivalries: true,
    commissionerMode: false,
    
    // Preseason (OFF by default)
    enablePreseason: false,
    preseasonGames: 2,
    preseasonRosterLimit: 20
  },
  expandedSections: new Set(['structure']) // Track which settings sections are expanded
};

/* ============================
   UTILITY FUNCTIONS
============================ */

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/* ============================
   NAME GENERATION WITH GENDER SUPPORT
============================ */

const MALE_FIRST_NAMES = [
  "James", "Michael", "Kobe", "LeBron", "Stephen", "Kevin", "Chris", "Anthony", 
  "Dwyane", "Russell", "Tim", "Larry", "Magic", "Kareem", "Shaquille", "Allen", 
  "Ray", "Paul", "Dirk", "Hakeem", "Charles", "John", "Karl", "Moses", "David",
  "Jason", "Gary", "Scottie", "Clyde", "Patrick", "Reggie", "Steve", "Grant",
  "Tracy", "Vince", "Carmelo", "Dwight", "Blake", "Damian", "Kyrie", "Kawhi",
  "Giannis", "Joel", "Nikola", "Jayson", "Devin", "Donovan", "Bradley", "Jimmy"
];

const FEMALE_FIRST_NAMES = [
  "Maya", "Diana", "Lisa", "Sheryl", "Candace", "Sue", "Lauren", "Brittney",
  "Elena", "Breanna", "Skylar", "Jewell", "Tamika", "Tina", "Cynthia", "Rebecca",
  "Seimone", "Cappie", "Angel", "Sabrina", "A'ja", "Jonquel", "Nneka", "Sylvia",
  "Cheryl", "Nancy", "Teresa", "Yolanda", "Cynthia", "Ruthie", "Katie", "Swin",
  "Kelsey", "Alyssa", "Courtney", "Natasha", "Alana", "Odyssey", "Rhyne", "Chelsea",
  "Aja", "Diamond", "Kelsey", "Tiffany", "Emma", "Napheesa", "Satou", "Betnijah"
];

const LAST_NAMES = [
  "Johnson", "Williams", "Brown", "Jones", "Davis", "Miller", "Wilson", "Moore",
  "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson",
  "Garcia", "Martinez", "Robinson", "Clark", "Rodriguez", "Lewis", "Lee", "Walker",
  "Hall", "Young", "Allen", "King", "Wright", "Lopez", "Hill", "Scott", "Green",
  "Adams", "Baker", "Nelson", "Carter", "Mitchell", "Perez", "Roberts", "Turner",
  "Phillips", "Campbell", "Parker", "Evans", "Edwards", "Collins", "Stewart", "Morris"
];

function randName(gender = null) {
  // If gender not specified, use league setting or default to male
  if (gender === null) {
    if (leagueState && leagueState.settings) {
      const mode = leagueState.settings.playerGenderMode;
      if (mode === 'men') {
        gender = 'M';
      } else if (mode === 'women') {
        gender = 'F';
      } else {
        // Mixed - random based on ratio
        const ratio = leagueState.settings.mixedGenderRatio || 0.5;
        gender = Math.random() < ratio ? 'F' : 'M';
      }
    } else {
      gender = 'M'; // Default fallback
    }
  }
  
  const firstNames = gender === 'F' ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES;
  const first = firstNames[rand(0, firstNames.length - 1)];
  const last = LAST_NAMES[rand(0, LAST_NAMES.length - 1)];
  
  return `${first} ${last}`;
}

/* ============================
   LEAGUE MANAGEMENT
============================ */

/* ============================
   HOME SCREEN
============================ */


async function renderHome() {
  const el = document.getElementById('home-screen');
  
  // Load saved leagues
  allSavedLeagues = await listLeagues();
  const hasSavedLeagues = allSavedLeagues.length > 0;
  const mostRecent = hasSavedLeagues ? allSavedLeagues[0] : null;
  
  // Continue button state
  const continueDisabled = !hasSavedLeagues;
  const continueText = hasSavedLeagues 
    ? `Resume Season ${mostRecent.season}` 
    : 'No league found';
  
  el.innerHTML = `
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px; text-align: center;">
      
      <div class="hero-logo"></div>
      
      <h1 class="hero-title">HOOPS DYNASTY</h1>
      <p class="hero-subtitle">Build Your Dynasty</p>
      
      <button class="btn-primary" onclick="showNewLeagueModal()">
        Create New League
      </button>
      <div class="helper-text">Start fresh with default settings</div>
      
      <button class="btn-secondary" onclick="continueMostRecent()" ${continueDisabled ? 'disabled' : ''}>
        ${continueDisabled ? ' ' : ' '}${continueText}
      </button>
      
      <div class="feature-list">
        <div class="feature-item">
          <span class="feature-icon"></span>
          <span>Manage teams across the league</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon"></span>
          <span>Sim seasons and build dynasties</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon"></span>
          <span>Track stats, history, and champions</span>
        </div>
      </div>
      
    </div>
  `;
}

async function continueMostRecent() {
  appView = 'myLeagues';
  render();
}

function showNewLeagueModal() {
  // Reset new league state
  newLeagueState = {
    name: '',
    seasonYear: new Date().getFullYear(),
    teamCount: 30,
    userTeamId: null,
    currentTab: 'teams',
    teams: [],
    settings: {
      // League Structure
      conferencesEnabled: true,
      divisionsEnabled: true,
      playoffTeams: 16,
      playInTournament: false,
      
      // Season Format
      gamesPerTeam: 82,
      backToBackFrequency: 'Normal',
      allStarBreak: true,
      
      // Salary Cap & Economy
      capSystem: 'soft',
      salaryCap: 123500000,
      capGrowthRate: 3,
      luxuryTax: true,
      luxuryTaxLine: 150000000,
      apronEnabled: false,
      minRosterSize: 13,
      maxRosterSize: 15,
      
      // Contracts & Free Agency
      maxContractYears: 5,
      playerOptions: true,
      teamOptions: true,
      restrictedFA: true,
      noTradeClauses: true,
      signAndTrade: true,
      
      // Draft Settings
      draftRounds: 2,
      lotterySystem: 'NBA',
      prospectClassSize: 60,
      autoDraftClasses: true,
      
      // Gameplay & Simulation
      injuryFrequency: 'Normal',
      injurySeverity: 'Normal',
      fatigueImpact: 'Normal',
      statEnvironment: 'Modern',
      playerDevelopment: 'Normal',
      playerAging: 'Normal',
      
      // AI & Difficulty
      aiTradeLogic: 'Normal',
      aiContractIntelligence: 'Normal',
      aiTankingBehavior: 'Realistic',
      fogOfWar: false,
      
      // Immersion
      newsFrequency: 'Normal',
      moraleSystem: true,
      rivalries: true,
      commissionerMode: false,
      
      // Player Gender
      playerGenderMode: 'men',
      mixedGenderRatio: 0.5,
      lockGenderEditing: true
    },
    expandedSections: new Set(['structure'])
  };
  
  appView = 'newLeague';
  render();
}

function goToHome() {
  appView = 'home';
  render();
}

/* ============================
   MY LEAGUES SCREEN
============================ */

async function renderMyLeagues() {
  const el = document.getElementById('myLeagues-screen');
  
  // Load saved leagues
  allSavedLeagues = await listLeagues();
  
  let content = '';
  
  if (allSavedLeagues.length === 0) {
    content = `
      <div class="empty-state">
        <div class="empty-state-icon">🏀</div>
        <h3 style="color: #94a3b8; margin: 0 0 10px 0;">No saved leagues yet</h3>
        <p>Create your first league to get started!</p>
      </div>
    `;
  } else {
    const cards = allSavedLeagues.map(save => {
      const date = new Date(save.updatedAt).toLocaleDateString();
      const time = new Date(save.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const userTeam = save.league.teams.find(t => t.id === save.userTeamId);
      const userTeamName = userTeam ? userTeam.name : 'Unknown';
      
      return `
        <div class="league-card" onclick="loadAndSwitchToLeague('${save.id}')">
          <div class="league-card-header">
            <h3 class="league-card-title">${save.name}</h3>
            <div class="league-card-season">Season ${save.season}</div>
          </div>
          <div class="league-card-info">
            <div class="league-card-info-item">
              <span>🏆</span>
              <span>${userTeamName}</span>
            </div>
            <div class="league-card-info-item">
              <span>📅</span>
              <span>${date} ${time}</span>
            </div>
          </div>
          <div class="league-card-actions" onclick="event.stopPropagation()">
            <button onclick="renameLeague('${save.id}')">✏️ Rename</button>
            <button onclick="exportLeague('${save.id}')">📥 Export</button>
            <button class="danger" onclick="deleteLeagueConfirm('${save.id}')">🗑️ Delete</button>
          </div>
        </div>
      `;
    }).join('');
    
    content = `<div class="leagues-container">${cards}</div>`;
  }
  
  el.innerHTML = `
    <div class="setup-header">
      <button class="back-btn" onclick="goToHome()">← Back</button>
      <h2>My Leagues</h2>
      <div class="header-actions">
        <button class="back-btn" onclick="importLeague()">📁 Import</button>
      </div>
    </div>
    ${content}
  `;
}

/**
 * Load league and switch to league view
 */
async function loadAndSwitchToLeague(leagueId) {
  console.log('[APP] Loading league:', leagueId);
  
  // Use new state manager if available
  if (typeof loadLeagueState === 'function') {
    const loaded = await loadLeagueState(leagueId);
    if (loaded) {
      appView = 'league';
      currentTab = 'dashboard';
      render();
    } else {
      alert('Failed to load league');
    }
  } else {
    // Fallback to old method
    await loadLeague(leagueId);
  }
}

async function deleteLeagueConfirm(id) {
  if (!confirm('Are you sure you want to delete this league?')) return;
  
  // Use new state manager if available
  if (typeof deleteLeagueState === 'function') {
    await deleteLeagueState(id);
  } else {
    await deleteLeague(id);
  }
  
  // If we deleted the current league, clear it
  if (league && league.id === id) {
    league = null;
    leagueState = null;
    appView = 'home';
  }
  
  render();
}

/* ============================
   NEW LEAGUE SETUP SCREEN
============================ */

function renderNewLeague() {
  const el = document.getElementById('newLeague-screen');
  
  // Initialize teams array from TEAM_META if needed
  if (newLeagueState.teams.length === 0 || newLeagueState.teams.length !== newLeagueState.teamCount) {
    newLeagueState.teams = TEAM_META.slice(0, newLeagueState.teamCount).map(meta => ({...meta}));
  }
  
  const teamMetas = newLeagueState.teams;
  const canCreate = newLeagueState.name.trim().length > 0 && newLeagueState.userTeamId !== null;
  
  let tabContent = '';
  
  if (newLeagueState.currentTab === 'teams') {
    const teamCards = teamMetas.map((meta, idx) => {
      const teamId = idx + 1;
      const isSelected = newLeagueState.userTeamId === teamId;
      const conference = meta.conference || '—';
      const division = meta.division || '—';
      const market = meta.market || '—';
      const fullName = `${meta.city} ${meta.name}`;
      
      // Use custom logo or generate fallback
      let logoHtml = '';
      if (meta.logoPrimaryUrl) {
        logoHtml = `<img src="${meta.logoPrimaryUrl}" alt="${fullName} logo" class="team-logo" onerror="this.style.display='none';" />`;
      } else {
        const logoUrl = generateTeamLogo(fullName, { primary: meta.primaryColor, secondary: meta.secondaryColor });
        logoHtml = `<img src="${logoUrl}" alt="${fullName} logo" class="team-logo" />`;
      }
      
      return `
        <div class="team-card ${isSelected ? 'selected' : ''}">
          <div class="team-logo-wrapper" onclick="selectTeam(${teamId})">
            ${logoHtml}
          </div>
          <div class="team-card-content" onclick="selectTeam(${teamId})">
            <div class="team-card-name">${fullName}</div>
            <div class="team-card-info">
              <div class="team-card-meta-line">${conference} • ${division}</div>
              <div class="team-card-meta-line">${market}</div>
            </div>
            <div class="color-dots">
              <div class="color-dot" style="background-color: ${meta.primaryColor};" title="Primary Color"></div>
              <div class="color-dot" style="background-color: ${meta.secondaryColor};" title="Secondary Color"></div>
            </div>
          </div>
          <div class="team-card-actions">
            <button class="btn-edit-team" onclick="event.stopPropagation(); editTeam(${teamId})">Edit</button>
          </div>
        </div>
      `;
    }).join('');
    
    tabContent = `
      <div class="setup-section">
        <h3>Select Your Team</h3>
        <div class="team-grid">
          ${teamCards}
        </div>
      </div>
    `;
  } else {
    tabContent = renderNewLeagueSettings();
  }
  
  el.innerHTML = `
    <div class="setup-header">
      <button class="back-btn" onclick="cancelNewLeague()">← Back</button>
      <h2>New League</h2>
    </div>
    
    <div class="setup-container">
      <div class="setup-section">
        <h3>League Basics</h3>
        
        <div class="input-wrapper">
          <label>League Name</label>
          <input 
            type="text" 
            id="leagueNameInput" 
            maxlength="30" 
            value="${newLeagueState.name}"
            placeholder="Enter league name..."
            oninput="updateLeagueName(this.value)"
          />
          <div class="char-count">${newLeagueState.name.length}/30</div>
        </div>
        
        <div class="input-wrapper">
          <label>Season Year</label>
          <input 
            type="number" 
            id="seasonYearInput" 
            value="${newLeagueState.seasonYear}"
            min="2000"
            max="2100"
            oninput="updateSeasonYear(this.value)"
          />
        </div>
        
        <div class="input-wrapper">
          <label>Number of Teams</label>
          <select 
            id="teamCountSelect"
            style="width: 100%; padding: 12px; background: #0f172a; border: 2px solid #334155; border-radius: 6px; color: #e5e7eb; font-size: 16px;"
            onchange="updateTeamCount(this.value)"
          >
            <option value="8" ${newLeagueState.teamCount === 8 ? 'selected' : ''}>8 Teams</option>
            <option value="12" ${newLeagueState.teamCount === 12 ? 'selected' : ''}>12 Teams</option>
            <option value="16" ${newLeagueState.teamCount === 16 ? 'selected' : ''}>16 Teams</option>
            <option value="20" ${newLeagueState.teamCount === 20 ? 'selected' : ''}>20 Teams</option>
            <option value="24" ${newLeagueState.teamCount === 24 ? 'selected' : ''}>24 Teams</option>
            <option value="30" ${newLeagueState.teamCount === 30 ? 'selected' : ''}>30 Teams</option>
          </select>
        </div>
      </div>
      
      <div class="setup-tabs">
        <button 
          class="setup-tab ${newLeagueState.currentTab === 'teams' ? 'active' : ''}"
          onclick="switchSetupTab('teams')"
        >
          Teams
        </button>
        <button 
          class="setup-tab ${newLeagueState.currentTab === 'settings' ? 'active' : ''}"
          onclick="switchSetupTab('settings')"
        >
          Settings
        </button>
      </div>
      
      ${tabContent}
    </div>
    
    <div class="setup-footer">
      <button 
        class="btn-create" 
        onclick="confirmCreateLeague()" 
        ${!canCreate ? 'disabled' : ''}
      >
        Create League
      </button>
      ${!canCreate ? '<div style="color: #64748b; margin-top: 10px; font-size: 13px;">Enter a name and select a team to continue</div>' : ''}
    </div>
  `;
}

function updateLeagueName(value) {
  newLeagueState.name = value;
  // Update character count without re-rendering entire form
  const charCount = document.querySelector('.char-count');
  if (charCount) {
    charCount.textContent = `${value.length}/30`;
  }
}

function updateSeasonYear(value) {
  newLeagueState.seasonYear = parseInt(value) || new Date().getFullYear();
}

function updateTeamCount(value) {
  newLeagueState.teamCount = parseInt(value);
  newLeagueState.userTeamId = null; // Reset team selection when count changes
  newLeagueState.teams = []; // Reset teams to trigger re-initialization
  renderNewLeague();
}

function selectTeam(teamId) {
  newLeagueState.userTeamId = teamId;
  renderNewLeague();
}

function editTeam(teamId) {
  editTeamId = teamId;
  appView = 'editTeam';
  render();
}

function saveTeamDetails() {
  const city = document.getElementById('teamCity').value.trim().substring(0, 30);
  const name = document.getElementById('teamName').value.trim().substring(0, 30);
  let primaryLogoUrl = document.getElementById('teamLogoPrimary').value.trim();
  let secondaryLogoUrl = document.getElementById('teamLogoSecondary').value.trim();
  let primaryColor = document.getElementById('teamPrimaryColor').value.trim();
  let secondaryColor = document.getElementById('teamSecondaryColor').value.trim();
  
  // Validate and fix color format
  if (primaryColor && !primaryColor.startsWith('#')) {
    primaryColor = '#' + primaryColor;
  }
  if (secondaryColor && !secondaryColor.startsWith('#')) {
    secondaryColor = '#' + secondaryColor;
  }
  
  // Validate hex color format
  const hexPattern = /^#[0-9A-Fa-f]{6}$/;
  if (!hexPattern.test(primaryColor)) {
    primaryColor = newLeagueState.teams[editTeamId - 1].primaryColor;
  }
  if (!hexPattern.test(secondaryColor)) {
    secondaryColor = newLeagueState.teams[editTeamId - 1].secondaryColor;
  }
  
  // Update team in newLeagueState
  newLeagueState.teams[editTeamId - 1] = {
    ...newLeagueState.teams[editTeamId - 1],
    city,
    name,
    logoPrimaryUrl: primaryLogoUrl,
    logoSecondaryUrl: secondaryLogoUrl,
    primaryColor,
    secondaryColor
  };
  
  appView = 'newLeague';
  editTeamId = null;
  render();
}

function cancelEditTeam() {
  appView = 'newLeague';
  editTeamId = null;
  render();
}

function switchSetupTab(tab) {
  console.log('=== switchSetupTab CALLED with:', tab);
  newLeagueState.currentTab = tab;
  renderNewLeague();
}

// Toggle settings section in new league setup
function toggleNewLeagueSection(section) {
  if (newLeagueState.expandedSections.has(section)) {
    newLeagueState.expandedSections.delete(section);
  } else {
    newLeagueState.expandedSections.add(section);
  }
  renderNewLeague();
}

// Update player gender mode
function updatePlayerGenderMode(mode) {
  if (!newLeagueState.settings) {
    newLeagueState.settings = {};
  }
  newLeagueState.settings.playerGenderMode = mode;
  renderNewLeague();
}

// Update mixed gender ratio
function updateMixedGenderRatio(value) {
  if (!newLeagueState.settings) {
    newLeagueState.settings = {};
  }
  newLeagueState.settings.mixedGenderRatio = parseFloat(value) / 100;
  renderNewLeague();
}

// Update new league setting
function updateNewLeagueSetting(category, field, value) {
  if (newLeagueState.settings[field] === undefined) {
    console.warn(`Unknown setting: ${field}`);
    return;
  }
  
  // Parse value based on type
  const currentValue = newLeagueState.settings[field];
  if (typeof currentValue === 'number') {
    newLeagueState.settings[field] = parseFloat(value) || 0;
  } else if (typeof currentValue === 'boolean') {
    newLeagueState.settings[field] = value === true || value === 'true';
  } else {
    newLeagueState.settings[field] = value;
  }
  
  renderNewLeague();
}

// Apply preset
function applyLeaguePreset(presetName) {
  const presets = {
    'nba': {
      conferencesEnabled: true,
      divisionsEnabled: true,
      playoffTeams: 16,
      playInTournament: true,
      gamesPerTeam: 82,
      backToBackFrequency: 'Normal',
      allStarBreak: true,
      capSystem: 'soft',
      salaryCap: 136000000,
      capGrowthRate: 7,
      luxuryTax: true,
      luxuryTaxLine: 165000000,
      apronEnabled: true,
      minRosterSize: 13,
      maxRosterSize: 15,
      maxContractYears: 5,
      playerOptions: true,
      teamOptions: true,
      restrictedFA: true,
      noTradeClauses: true,
      signAndTrade: true,
      draftRounds: 2,
      lotterySystem: 'NBA',
      prospectClassSize: 60,
      autoDraftClasses: true,
      injuryFrequency: 'Normal',
      injurySeverity: 'Normal',
      fatigueImpact: 'Normal',
      statEnvironment: 'Modern',
      playerDevelopment: 'Normal',
      playerAging: 'Normal',
      aiTradeLogic: 'Normal',
      aiContractIntelligence: 'Normal',
      aiTankingBehavior: 'Realistic',
      fogOfWar: false,
      newsFrequency: 'Normal',
      moraleSystem: true,
      rivalries: true,
      commissionerMode: false
    },
    'casual': {
      conferencesEnabled: true,
      divisionsEnabled: false,
      playoffTeams: 16,
      playInTournament: false,
      gamesPerTeam: 58,
      backToBackFrequency: 'Low',
      allStarBreak: false,
      capSystem: 'soft',
      salaryCap: 120000000,
      capGrowthRate: 5,
      luxuryTax: false,
      luxuryTaxLine: 150000000,
      apronEnabled: false,
      minRosterSize: 12,
      maxRosterSize: 15,
      maxContractYears: 6,
      playerOptions: true,
      teamOptions: true,
      restrictedFA: false,
      noTradeClauses: true,
      signAndTrade: true,
      draftRounds: 2,
      lotterySystem: 'Simple',
      prospectClassSize: 50,
      autoDraftClasses: true,
      injuryFrequency: 'Low',
      injurySeverity: 'Low',
      fatigueImpact: 'Low',
      statEnvironment: 'High Scoring',
      playerDevelopment: 'Fast',
      playerAging: 'Slow',
      aiTradeLogic: 'High',
      aiContractIntelligence: 'Low',
      aiTankingBehavior: 'Minimal',
      fogOfWar: false,
      newsFrequency: 'Low',
      moraleSystem: false,
      rivalries: false,
      commissionerMode: false
    },
    'hardcore': {
      conferencesEnabled: true,
      divisionsEnabled: true,
      playoffTeams: 8,
      playInTournament: false,
      gamesPerTeam: 82,
      backToBackFrequency: 'High',
      allStarBreak: true,
      capSystem: 'hard',
      salaryCap: 123500000,
      capGrowthRate: 3,
      luxuryTax: false,
      luxuryTaxLine: 150000000,
      apronEnabled: false,
      minRosterSize: 13,
      maxRosterSize: 15,
      maxContractYears: 4,
      playerOptions: false,
      teamOptions: false,
      restrictedFA: true,
      noTradeClauses: false,
      signAndTrade: false,
      draftRounds: 3,
      lotterySystem: 'Flat',
      prospectClassSize: 80,
      autoDraftClasses: true,
      injuryFrequency: 'High',
      injurySeverity: 'High',
      fatigueImpact: 'High',
      statEnvironment: 'Realistic',
      playerDevelopment: 'Realistic',
      playerAging: 'Fast',
      aiTradeLogic: 'Low',
      aiContractIntelligence: 'High',
      aiTankingBehavior: 'Aggressive',
      fogOfWar: true,
      newsFrequency: 'High',
      moraleSystem: true,
      rivalries: true,
      commissionerMode: false
    }
  };
  
  if (!presets[presetName]) {
    console.error('Unknown preset:', presetName);
    return;
  }
  
  if (!confirm(`Apply ${presetName.toUpperCase()} preset? This will overwrite your current settings.`)) {
    return;
  }
  
  newLeagueState.settings = { ...presets[presetName] };
  renderNewLeague();
  alert(`${presetName.toUpperCase()} preset applied!`);
}

// Render new league settings tab
function renderNewLeagueSettings() {
  console.log('=== renderNewLeagueSettings CALLED ===');
  const s = newLeagueState.settings;
  
  return `
    <div class="setup-section">
      <div style="margin-bottom: 20px;">
        <h3>League Settings</h3>
        <p style="color: #64748b; font-size: 14px; margin: 10px 0;">
          Configure your league before creation. Settings marked with 🔒 cannot be changed later.
        </p>
        
        <!-- Presets -->
        <div style="display: flex; gap: 10px; margin: 20px 0; flex-wrap: wrap;">
          <button onclick="applyLeaguePreset('nba')" style="
            padding: 10px 20px;
            background: #2563eb;
            color: #fff;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
          ">📊 NBA-Style</button>
          
          <button onclick="applyLeaguePreset('casual')" style="
            padding: 10px 20px;
            background: #10b981;
            color: #fff;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
          ">🎮 Casual</button>
          
          <button onclick="applyLeaguePreset('hardcore')" style="
            padding: 10px 20px;
            background: #dc2626;
            color: #fff;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
          ">⚔️ Hardcore</button>
        </div>
      </div>
      
      ${renderSettingSection('structure', 'League Structure 🔒', [
        { label: 'Conferences Enabled', field: 'conferencesEnabled', type: 'boolean' },
        { label: 'Divisions Enabled', field: 'divisionsEnabled', type: 'boolean' },
        { label: 'Playoff Teams', field: 'playoffTeams', type: 'select', options: [8, 16, 20] },
        { label: 'Play-In Tournament', field: 'playInTournament', type: 'boolean' }
      ])}
      
      ${renderSettingSection('season', 'Season Format 🔒', [
        { label: 'Games Per Team', field: 'gamesPerTeam', type: 'number', min: 40, max: 82 },
        { label: 'Back-to-Back Frequency', field: 'backToBackFrequency', type: 'select', options: ['Low', 'Normal', 'High'] },
        { label: 'All-Star Break', field: 'allStarBreak', type: 'boolean' }
      ])}
      
      ${renderSettingSection('economy', 'Salary Cap & Economy', [
        { label: 'Cap System', field: 'capSystem', type: 'select', options: [{ value: 'hard', label: 'Hard Cap' }, { value: 'soft', label: 'Soft Cap' }] },
        { label: 'Salary Cap ($)', field: 'salaryCap', type: 'number', min: 50000000, max: 200000000, step: 1000000 },
        { label: 'Cap Growth Rate (%)', field: 'capGrowthRate', type: 'number', min: 0, max: 10 },
        { label: 'Luxury Tax', field: 'luxuryTax', type: 'boolean' },
        { label: 'Luxury Tax Line ($)', field: 'luxuryTaxLine', type: 'number', min: 50000000, max: 250000000, step: 1000000 },
        { label: 'Apron Rules', field: 'apronEnabled', type: 'boolean' },
        { label: 'Min Roster Size', field: 'minRosterSize', type: 'number', min: 10, max: 15 },
        { label: 'Max Roster Size', field: 'maxRosterSize', type: 'number', min: 12, max: 20 }
      ])}
      
      ${renderSettingSection('contracts', 'Contracts & Free Agency', [
        { label: 'Max Contract Years', field: 'maxContractYears', type: 'number', min: 3, max: 7 },
        { label: 'Player Options', field: 'playerOptions', type: 'boolean' },
        { label: 'Team Options', field: 'teamOptions', type: 'boolean' },
        { label: 'Restricted Free Agency', field: 'restrictedFA', type: 'boolean' },
        { label: 'No-Trade Clauses', field: 'noTradeClauses', type: 'boolean' },
        { label: 'Sign-and-Trade', field: 'signAndTrade', type: 'boolean' }
      ])}
      
      ${renderSettingSection('draft', 'Draft Settings', [
        { label: 'Draft Rounds', field: 'draftRounds', type: 'number', min: 1, max: 5 },
        { label: 'Lottery System', field: 'lotterySystem', type: 'select', options: ['NBA', 'Simple', 'Flat'] },
        { label: 'Prospect Class Size', field: 'prospectClassSize', type: 'number', min: 30, max: 100 },
        { label: 'Auto-Generate Draft Classes', field: 'autoDraftClasses', type: 'boolean' }
      ])}
      
      ${renderSettingSection('gameplay', 'Gameplay & Simulation', [
        { label: 'Injury Frequency', field: 'injuryFrequency', type: 'select', options: ['Low', 'Normal', 'High'] },
        { label: 'Injury Severity', field: 'injurySeverity', type: 'select', options: ['Low', 'Normal', 'High'] },
        { label: 'Fatigue Impact', field: 'fatigueImpact', type: 'select', options: ['Low', 'Normal', 'High'] },
        { label: 'Stat Environment', field: 'statEnvironment', type: 'select', options: ['Modern', 'Realistic', 'High Scoring', 'Low Scoring'] },
        { label: 'Player Development Speed', field: 'playerDevelopment', type: 'select', options: ['Slow', 'Normal', 'Fast', 'Realistic'] },
        { label: 'Player Aging Speed', field: 'playerAging', type: 'select', options: ['Slow', 'Normal', 'Fast'] }
      ])}
      
      ${renderSettingSection('ai', 'AI & Difficulty', [
        { label: 'AI Trade Logic', field: 'aiTradeLogic', type: 'select', options: ['Low', 'Normal', 'High'] },
        { label: 'AI Contract Intelligence', field: 'aiContractIntelligence', type: 'select', options: ['Low', 'Normal', 'High'] },
        { label: 'AI Tanking Behavior', field: 'aiTankingBehavior', type: 'select', options: ['Minimal', 'Realistic', 'Aggressive'] },
        { label: 'Fog of War (Hide other teams info)', field: 'fogOfWar', type: 'boolean' }
      ])}
      
      ${renderSettingSection('immersion', 'Immersion', [
        { label: 'News Frequency', field: 'newsFrequency', type: 'select', options: ['Low', 'Normal', 'High'] },
        { label: 'Morale System', field: 'moraleSystem', type: 'boolean' },
        { label: 'Team Rivalries', field: 'rivalries', type: 'boolean' },
        { label: 'Enable Commissioner Mode', field: 'commissionerMode', type: 'boolean' }
      ])}
      
      ${renderSettingSection('preseason', 'Preseason (Optional)', [
        { label: 'Enable Preseason', field: 'enablePreseason', type: 'boolean' },
        { label: 'Preseason Games Per Team', field: 'preseasonGames', type: 'select', options: [2, 4] },
        { label: 'Preseason Roster Limit', field: 'preseasonRosterLimit', type: 'number', min: 15, max: 20 }
      ])}
      
      ${renderRatingProfileSection()}
      
      ${renderPlayerGenderSection()}
    </div>
  `;
}

// Render rating profile selection
function renderRatingProfileSection() {
  const selectedProfile = newLeagueState.settings.ratingProfile || 'balanced';
  
  return `
    <div style="
      background: #1e293b;
      border-radius: 8px;
      padding: 16px;
      margin: 16px 0;
      border: 2px solid #334155;
    ">
      <h4 style="margin: 0 0 12px 0; color: #f1f5f9; font-size: 16px;">
        ⭐ Rating Distribution Profile
      </h4>
      <p style="color: #94a3b8; font-size: 13px; margin: 0 0 16px 0;">
        Choose how player ratings are distributed. This affects league competitiveness and star power.
      </p>
      
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <!-- Balanced Profile -->
        <label style="
          display: flex;
          align-items: start;
          gap: 12px;
          padding: 12px;
          background: ${selectedProfile === 'balanced' ? '#2563eb20' : '#0f172a'};
          border: 2px solid ${selectedProfile === 'balanced' ? '#2563eb' : '#334155'};
          border-radius: 6px;
          cursor: pointer;
        ">
          <input 
            type="radio" 
            name="ratingProfile" 
            value="balanced"
            ${selectedProfile === 'balanced' ? 'checked' : ''}
            onchange="newLeagueState.settings.ratingProfile = 'balanced'; render();"
            style="margin-top: 2px;"
          />
          <div style="flex: 1;">
            <div style="color: #f1f5f9; font-weight: bold; margin-bottom: 4px;">
              Balanced (Default)
            </div>
            <div style="color: #94a3b8; font-size: 13px;">
              Standard distribution with 70-85 OVR range for most players.
              Few elite stars (85+). Realistic competitive balance.
            </div>
          </div>
        </label>
        
        <!-- Star League Profile -->
        <label style="
          display: flex;
          align-items: start;
          gap: 12px;
          padding: 12px;
          background: ${selectedProfile === 'star_league' ? '#2563eb20' : '#0f172a'};
          border: 2px solid ${selectedProfile === 'star_league' ? '#2563eb' : '#334155'};
          border-radius: 6px;
          cursor: pointer;
        ">
          <input 
            type="radio" 
            name="ratingProfile" 
            value="star_league"
            ${selectedProfile === 'star_league' ? 'checked' : ''}
            onchange="newLeagueState.settings.ratingProfile = 'star_league'; render();"
            style="margin-top: 2px;"
          />
          <div style="flex: 1;">
            <div style="color: #f1f5f9; font-weight: bold; margin-bottom: 4px;">
              ⭐ Star League
            </div>
            <div style="color: #94a3b8; font-size: 13px;">
              Creates realistic 90+ OVR superstars while preserving player rankings.
              Top 1% players: 95-99 OVR | Top 5%: 90-95 | Creates clear star tiers.
            </div>
          </div>
        </label>
      </div>
      
      ${selectedProfile === 'star_league' ? `
        <div style="
          background: #fef3c7;
          color: #78350f;
          padding: 12px;
          border-radius: 6px;
          margin-top: 12px;
          font-size: 13px;
        ">
          ⚠️ <strong>Star League</strong> will be applied when the league is created.
          You can also apply it later via Commissioner Settings.
        </div>
      ` : ''}
    </div>
  `;
}

// Render a collapsible settings section
function renderSettingSection(sectionId, title, fields) {
  const isExpanded = newLeagueState.expandedSections.has(sectionId);
  const s = newLeagueState.settings;
  
  return `
    <div style="
      background: #1a2332;
      border-radius: 8px;
      margin-bottom: 12px;
      border: 1px solid #334155;
      overflow: hidden;
    ">
      <div onclick="toggleNewLeagueSection('${sectionId}')" style="
        padding: 15px 20px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: ${isExpanded ? '#0f172a' : 'transparent'};
        transition: background 0.2s;
      ">
        <h4 style="margin: 0; color: #3b82f6; font-size: 1.1em;">${title}</h4>
        <span style="color: #64748b; font-size: 1.3em;">${isExpanded ? '▼' : '▶'}</span>
      </div>
      
      ${isExpanded ? `
        <div style="padding: 0 20px 20px 20px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
            ${fields.map(field => renderSettingField(field)).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// Render individual setting field
function renderSettingField(field) {
  const s = newLeagueState.settings;
  const value = s[field.field];
  
  if (field.type === 'boolean') {
    return `
      <div>
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: #e5e7eb;">
          <input 
            type="checkbox" 
            ${value ? 'checked' : ''}
            onchange="updateNewLeagueSetting('', '${field.field}', this.checked)"
            style="width: 18px; height: 18px; cursor: pointer;"
          />
          <span>${field.label}</span>
        </label>
      </div>
    `;
  } else if (field.type === 'number') {
    return `
      <div>
        <label style="display: block; color: #94a3b8; margin-bottom: 6px; font-size: 0.9em;">${field.label}</label>
        <input 
          type="number" 
          value="${value}"
          min="${field.min || 0}"
          max="${field.max || 1000}"
          step="${field.step || 1}"
          oninput="updateNewLeagueSetting('', '${field.field}', this.value)"
          style="
            width: 100%;
            padding: 10px;
            background: #0f172a;
            color: #e5e7eb;
            border: 1px solid #334155;
            border-radius: 6px;
            font-size: 1em;
          "
        />
      </div>
    `;
  } else if (field.type === 'select') {
    const options = Array.isArray(field.options) ? field.options : [];
    return `
      <div>
        <label style="display: block; color: #94a3b8; margin-bottom: 6px; font-size: 0.9em;">${field.label}</label>
        <select 
          onchange="updateNewLeagueSetting('', '${field.field}', this.value)"
          style="
            width: 100%;
            padding: 10px;
            background: #0f172a;
            color: #e5e7eb;
            border: 1px solid #334155;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1em;
          "
        >
          ${options.map(opt => {
            const optValue = typeof opt === 'object' ? opt.value : opt;
            const optLabel = typeof opt === 'object' ? opt.label : opt;
            return `<option value="${optValue}" ${value == optValue ? 'selected' : ''}>${optLabel}</option>`;
          }).join('')}
        </select>
      </div>
    `;
  }
  
  return '';
}

// Render player gender section with special controls
function renderPlayerGenderSection() {
  const s = newLeagueState.settings;
  const isExpanded = newLeagueState.expandedSections.has('playerGender');
  const mode = s.playerGenderMode || 'men';
  const ratio = (s.mixedGenderRatio || 0.5) * 100;
  const lockEditing = s.lockGenderEditing !== false; // Default true
  
  return `
    <div style="
      background: #1a2332;
      border-radius: 8px;
      margin-bottom: 12px;
      border: 1px solid #334155;
      overflow: hidden;
    ">
      <div onclick="toggleNewLeagueSection('playerGender')" style="
        padding: 15px 20px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: ${isExpanded ? '#0f172a' : 'transparent'};
        transition: background 0.2s;
      ">
        <h4 style="margin: 0; color: #3b82f6; font-size: 1.1em;">⚧️ Player Gender</h4>
        <span style="color: #64748b; font-size: 1.3em;">${isExpanded ? '▼' : '▶'}</span>
      </div>
      
      ${isExpanded ? `
        <div style="padding: 0 20px 20px 20px;">
          <!-- Gender Mode -->
          <div style="margin-bottom: 20px;">
            <label style="display: block; color: #94a3b8; margin-bottom: 10px; font-size: 0.9em;">League Type</label>
            <div style="display: flex; gap: 8px;">
              <button onclick="updatePlayerGenderMode('men')" style="
                flex: 1;
                padding: 12px;
                background: ${mode === 'men' ? '#3b82f6' : '#1e293b'};
                color: ${mode === 'men' ? '#fff' : '#94a3b8'};
                border: 2px solid ${mode === 'men' ? '#3b82f6' : '#334155'};
                border-radius: 8px;
                cursor: pointer;
                font-weight: ${mode === 'men' ? 'bold' : 'normal'};
                transition: all 0.2s;
              ">♂️ Men</button>
              
              <button onclick="updatePlayerGenderMode('women')" style="
                flex: 1;
                padding: 12px;
                background: ${mode === 'women' ? '#ec4899' : '#1e293b'};
                color: ${mode === 'women' ? '#fff' : '#94a3b8'};
                border: 2px solid ${mode === 'women' ? '#ec4899' : '#334155'};
                border-radius: 8px;
                cursor: pointer;
                font-weight: ${mode === 'women' ? 'bold' : 'normal'};
                transition: all 0.2s;
              ">♀️ Women</button>
              
              <button onclick="updatePlayerGenderMode('mixed')" style="
                flex: 1;
                padding: 12px;
                background: ${mode === 'mixed' ? '#8b5cf6' : '#1e293b'};
                color: ${mode === 'mixed' ? '#fff' : '#94a3b8'};
                border: 2px solid ${mode === 'mixed' ? '#8b5cf6' : '#334155'};
                border-radius: 8px;
                cursor: pointer;
                font-weight: ${mode === 'mixed' ? 'bold' : 'normal'};
                transition: all 0.2s;
              ">⚧️ Mixed</button>
            </div>
          </div>
          
          <!-- Mixed Ratio Slider (only when mixed) -->
          ${mode === 'mixed' ? `
            <div style="margin-bottom: 20px;">
              <label style="display: block; color: #94a3b8; margin-bottom: 8px; font-size: 0.9em;">
                Gender Distribution
              </label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value="${ratio}"
                oninput="updateMixedGenderRatio(this.value)"
                style="
                  width: 100%;
                  height: 6px;
                  background: linear-gradient(to right, #3b82f6 0%, #ec4899 100%);
                  border-radius: 3px;
                  outline: none;
                  cursor: pointer;
                "
              />
              <div style="
                margin-top: 8px;
                display: flex;
                justify-content: space-between;
                font-size: 0.85em;
                color: #64748b;
              ">
                <span>♀️ Women: <strong style="color: #ec4899;">${Math.round(ratio)}%</strong></span>
                <span>♂️ Men: <strong style="color: #3b82f6;">${Math.round(100 - ratio)}%</strong></span>
              </div>
            </div>
          ` : ''}
          
          <!-- Lock Gender Editing -->
          <div>
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: #e5e7eb;">
              <input 
                type="checkbox" 
                ${lockEditing ? 'checked' : ''}
                onchange="updateNewLeagueSetting('', 'lockGenderEditing', this.checked)"
                style="width: 18px; height: 18px; cursor: pointer;"
              />
              <span>🔒 Lock gender editing (requires Commissioner Mode to change)</span>
            </label>
            <p style="color: #64748b; font-size: 0.85em; margin: 8px 0 0 28px;">
              When enabled, player gender cannot be edited unless Commissioner Mode is active.
            </p>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

/* ============================
   EDIT TEAM DETAILS SCREEN
============================ */

function renderEditTeam() {
  const el = document.getElementById('editTeam-screen');
  if (!editTeamId || editTeamId < 1) {
    el.innerHTML = '<p>Invalid team ID</p>';
    return;
  }
  
  const team = newLeagueState.teams[editTeamId - 1];
  if (!team) {
    el.innerHTML = '<p>Team not found</p>';
    return;
  }
  
  const fullName = `${team.city} ${team.name}`;
  
  el.innerHTML = `
    <div class="edit-header">
      <button class="back-btn" onclick="cancelEditTeam()">← Back</button>
      <h2>Edit Team Details</h2>
    </div>
    
    <div class="edit-container">
      <div class="edit-section">
        <h3>Team Identity</h3>
        
        <div class="edit-field">
          <label>City Name</label>
          <input 
            type="text" 
            id="teamCity" 
            maxlength="30" 
            value="${team.city}"
            placeholder="Enter city name..."
          />
        </div>
        
        <div class="edit-field">
          <label>Team Name</label>
          <input 
            type="text" 
            id="teamName" 
            maxlength="30" 
            value="${team.name}"
            placeholder="Enter team name..."
          />
        </div>
      </div>
      
      <div class="edit-section">
        <h3>Team Logos</h3>
        
        <div class="edit-field">
          <label>Primary Logo URL</label>
          <div class="edit-field-row">
            <input 
              type="url" 
              id="teamLogoPrimary" 
              value="${team.logoPrimaryUrl}"
              placeholder="https://example.com/logo.png"
              oninput="updateLogoPreview('primary')"
            />
            <img 
              id="previewLogoPrimary" 
              class="logo-preview ${team.logoPrimaryUrl ? '' : 'placeholder'}" 
              src="${team.logoPrimaryUrl || ''}"
              onerror="this.className='logo-preview placeholder'; this.src='';"
              alt="Primary logo"
            />
          </div>
        </div>
        
        <div class="edit-field">
          <label>Secondary Logo URL (Optional)</label>
          <div class="edit-field-row">
            <input 
              type="url" 
              id="teamLogoSecondary" 
              value="${team.logoSecondaryUrl}"
              placeholder="https://example.com/secondary-logo.png"
              oninput="updateLogoPreview('secondary')"
            />
            <img 
              id="previewLogoSecondary" 
              class="logo-preview ${team.logoSecondaryUrl ? '' : 'placeholder'}" 
              src="${team.logoSecondaryUrl || ''}"
              onerror="this.className='logo-preview placeholder'; this.src='';"
              alt="Secondary logo"
            />
          </div>
        </div>
      </div>
      
      <div class="edit-section">
        <h3>Team Colors</h3>
        
        <div class="edit-field">
          <label>Primary Color</label>
          <div class="edit-field-row">
            <input 
              type="text" 
              id="teamPrimaryColor" 
              value="${team.primaryColor}"
              placeholder="#000000"
              oninput="updateColorPreview('primary')"
            />
            <div 
              id="previewColorPrimary" 
              class="color-preview" 
              style="background-color: ${team.primaryColor};"
            ></div>
          </div>
        </div>
        
        <div class="edit-field">
          <label>Secondary Color</label>
          <div class="edit-field-row">
            <input 
              type="text" 
              id="teamSecondaryColor" 
              value="${team.secondaryColor}"
              placeholder="#FFFFFF"
              oninput="updateColorPreview('secondary')"
            />
            <div 
              id="previewColorSecondary" 
              class="color-preview" 
              style="background-color: ${team.secondaryColor};"
            ></div>
          </div>
        </div>
      </div>
      
      <div class="edit-section">
        <h3>League Information</h3>
        <div class="readonly-info">
          <strong>Conference:</strong> ${team.conference}<br>
          <strong>Division:</strong> ${team.division}<br>
          <strong>Market Size:</strong> ${team.market}
        </div>
      </div>
    </div>
    
    <div class="edit-footer">
      <button class="btn-cancel-edit" onclick="cancelEditTeam()">Cancel</button>
      <button class="btn-save" onclick="saveTeamDetails()">Save Changes</button>
    </div>
  `;
}

function updateLogoPreview(type) {
  const input = document.getElementById(type === 'primary' ? 'teamLogoPrimary' : 'teamLogoSecondary');
  const preview = document.getElementById(type === 'primary' ? 'previewLogoPrimary' : 'previewLogoSecondary');
  const url = input.value.trim();
  
  if (url) {
    preview.src = url;
    preview.className = 'logo-preview';
  } else {
    preview.src = '';
    preview.className = 'logo-preview placeholder';
  }
}

function updateColorPreview(type) {
  const input = document.getElementById(type === 'primary' ? 'teamPrimaryColor' : 'teamSecondaryColor');
  const preview = document.getElementById(type === 'primary' ? 'previewColorPrimary' : 'previewColorSecondary');
  let color = input.value.trim();
  
  if (color && !color.startsWith('#')) {
    color = '#' + color;
  }
  
  const hexPattern = /^#[0-9A-Fa-f]{6}$/;
  if (hexPattern.test(color)) {
    preview.style.backgroundColor = color;
  }
}

function cancelNewLeague() {
  appView = 'home';
  render();
}

async function confirmCreateLeague() {
  if (newLeagueState.name.trim().length === 0 || newLeagueState.userTeamId === null) {
    return;
  }
  
  const name = newLeagueState.name.trim();
  const teamCount = newLeagueState.teamCount;
  const seasonYear = newLeagueState.seasonYear;
  const userTeamId = newLeagueState.userTeamId;
  const ratingProfile = newLeagueState.settings.ratingProfile || 'balanced';
  
  console.log('[APP] Creating new league with team ID:', userTeamId, 'rating profile:', ratingProfile);
  
  // Use new state manager if available
  if (typeof createNewLeague === 'function') {
    await createNewLeague({
      name,
      season: seasonYear,
      teamCount,
      userTeamId,
      ...newLeagueState
    });
  } else {
    // Fallback to old method
    createLeague(name, seasonYear, teamCount, newLeagueState, userTeamId);
  }
  
  // Apply star league profile if selected
  if (ratingProfile === 'star_league' && typeof applyStarLeagueProfile === 'function') {
    console.log('[APP] Applying star league rating profile...');
    applyStarLeagueProfile();
    // Save after applying profile
    if (typeof saveLeagueState === 'function') {
      await saveLeagueState();
    }
  }
  
  // Navigate to league view
  appView = 'league';
  currentTab = 'dashboard';
  render();
}

/* ============================
   UI RENDERING
============================ */

function render() {
  // Update league phase before rendering
  if (league && typeof updateLeaguePhase === 'function') {
    updateLeaguePhase();
  }
  
  // Control landing header visibility
  const landingHeader = document.getElementById('landingHeader');
  const isLandingView = appView === 'home' || appView === 'myLeagues' || appView === 'newLeague' || appView === 'editTeam';
  landingHeader.style.display = isLandingView ? '' : 'none';
  
  if (appView === 'home') {
    document.getElementById('home-screen').style.display = 'block';
    document.getElementById('myLeagues-screen').style.display = 'none';
    document.getElementById('newLeague-screen').style.display = 'none';
    document.getElementById('editTeam-screen').style.display = 'none';
    document.getElementById('league-view').style.display = 'none';
    renderHome();
    return;
  }
  
  if (appView === 'myLeagues') {
    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('myLeagues-screen').style.display = 'block';
    document.getElementById('newLeague-screen').style.display = 'none';
    document.getElementById('editTeam-screen').style.display = 'none';
    document.getElementById('league-view').style.display = 'none';
    renderMyLeagues();
    return;
  }
  
  if (appView === 'newLeague') {
    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('myLeagues-screen').style.display = 'none';
    document.getElementById('newLeague-screen').style.display = 'block';
    document.getElementById('editTeam-screen').style.display = 'none';
    document.getElementById('league-view').style.display = 'none';
    renderNewLeague();
    return;
  }
  
  if (appView === 'editTeam') {
    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('myLeagues-screen').style.display = 'none';
    document.getElementById('newLeague-screen').style.display = 'none';
    document.getElementById('editTeam-screen').style.display = 'block';
    document.getElementById('league-view').style.display = 'none';
    renderEditTeam();
    return;
  }
  
  // League view
  document.getElementById('home-screen').style.display = 'none';
  document.getElementById('myLeagues-screen').style.display = 'none';
  document.getElementById('newLeague-screen').style.display = 'none';
  document.getElementById('editTeam-screen').style.display = 'none';
  document.getElementById('league-view').style.display = 'block';
  
  if (!league) return;
  
  updateLeagueInfo();
  
  // Update active sidebar item
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.tab === currentTab) {
      item.classList.add('active');
    }
  });
  
  if (currentTab === 'dashboard') renderDashboard();
  if (currentTab === 'standings') renderStandings();
  if (currentTab === 'team') renderTeam();
  if (currentTab === 'teamManagement') renderTeamManagement();
  if (currentTab === 'freeagents') renderFreeAgents();
  if (currentTab === 'draft') renderDraft();
  if (currentTab === 'expansion') renderExpansion();
  if (currentTab === 'schedule') renderSchedule();
  if (currentTab === 'stats') renderStatsTab();
  if (currentTab === 'leaders') renderLeaders();
  if (currentTab === 'awards') renderAwardsTab();
  if (currentTab === 'players') renderPlayers();
  if (currentTab === 'news') renderNewsTab();
  if (currentTab === 'settings') renderSettings();
  if (currentTab === 'history') renderHistoryView();
  if (currentTab === 'career') renderCareerTab();
  if (currentTab === 'rotations') renderRotations();
  if (currentTab === 'finances') renderFinances();
  if (currentTab === 'trades') renderTrades();
}

function updateLeagueInfo() {
  const el = document.getElementById('leagueInfo');
  const leagueName = league.name || 'League';
  
  // Build job security indicator if enabled
  let jobSecurityHTML = '';
  if (league.settings && league.settings.enableJobSecurity) {
    const jobSecurity = league.jobSecurity || 75;
    const status = jobSecurity >= 70 ? 
      { text: 'Safe', color: '#4ade80', class: 'safe' } :
      jobSecurity >= 40 ? 
      { text: 'Warm Seat', color: '#fbbf24', class: 'warm' } :
      { text: 'Hot Seat', color: '#ef4444', class: 'hot' };
    
    jobSecurityHTML = `
      <span style="margin-left: 15px; padding: 4px 12px; background: ${status.color}22; border: 1px solid ${status.color}; border-radius: 4px; color: ${status.color}; font-size: 0.9em;">
        🔥 Job Security: ${jobSecurity}/100 (${status.text})
      </span>
    `;
  }
  
  // Get current phase display
  const phaseDisplay = getCurrentPhaseDisplay();
  
  // Debug: Show phase source
  const debugPhase = window.DEBUG_PHASE ? ` | <span style="color: #ff6b6b; font-size: 0.85em;">DEBUG: league.phase="${league.phase}"</span>` : '';
  
  el.innerHTML = `<strong>${leagueName}</strong> | Season: ${league.season} | Phase: ${phaseDisplay}${debugPhase}${jobSecurityHTML}`;
  
  // Update button states (sidebar buttons)
  const simSeasonBtn = document.getElementById('simSeasonBtnSidebar');
  const offseasonBtn = document.getElementById('offseasonBtnSidebar');
  const draftBtn = document.getElementById('draftBtnSidebar');
  
  const currentPhase = getCurrentPhase();
  const isPreseason = currentPhase === 'PRESEASON' || currentPhase === 'preseason';
  const isOffseason = currentPhase === 'OFFSEASON' || currentPhase === 'offseason';
  const isDraft = currentPhase === 'DRAFT' || currentPhase === 'draft';
  
  if (simSeasonBtn) simSeasonBtn.disabled = !isPreseason;
  if (offseasonBtn) offseasonBtn.disabled = !isOffseason;
  if (draftBtn) draftBtn.disabled = !isDraft;
  
  // Update Commissioner Badge
  const commissionerBadge = document.getElementById('commissionerBadge');
  if (commissionerBadge) {
    commissionerBadge.style.display = isCommissionerMode() ? 'block' : 'none';
  }
  
  // Initialize sim mode UI
  if (league && !league.simulation) {
    league.simulation = initSimulationState();
  }
  
  // Update simulation button states based on phase
  const phase = getCurrentPhase();
  const canSimulate = (phase === 'REGULAR_SEASON' || phase === 'SEASON' || phase === 'PLAYOFFS');
  
  const simButtons = ['simGameButton', 'simWeekButton', 'simMonthButton', 'simSeasonButton'];
  simButtons.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !canSimulate;
  });
  
  // Until Event button is always enabled
  const eventBtn = document.getElementById('simEventButton');
  if (eventBtn) eventBtn.disabled = false;
  
  // Initialize status label
  updateSimStatusLabel();
}

function switchTab(tab) {
  currentTab = tab;
  
  // Close sidebar
  closeSidebar();
  
  // Update sidebar item styling
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.classList.remove('active');
  });
  const activeItem = document.querySelector(`.sidebar-item[data-tab="${tab}"]`);
  if (activeItem) {
    activeItem.classList.add('active');
  }
  
  // Hide all tabs
  document.querySelectorAll('[id$="-tab"]').forEach(t => t.style.display = 'none');
  
  // Show selected tab
  const selectedTab = document.getElementById(`${tab}-tab`);
  if (selectedTab) {
    selectedTab.style.display = 'block';
  }
  
  render();
}

/* ============================
   SIDEBAR FUNCTIONS
============================ */

function toggleSidebar() {
  if (sidebarOpen) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

function openSidebar() {
  sidebarOpen = true;
  document.getElementById('sidebarDrawer').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('active');
  document.body.classList.add('sidebar-open');
}

function closeSidebar() {
  sidebarOpen = false;
  document.getElementById('sidebarDrawer').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
  document.body.classList.remove('sidebar-open');
}

/* ============================
   DASHBOARD RENDERING
============================ */

function computeFinalsOdds(league, teamId) {
  const team = league.teams.find(t => t.id === teamId);
  if (!team) return null;
  
  // Helper: Calculate power score for a team
  const getPowerScore = (t) => {
    const overall = getTeamOverall(t);
    const winPct = (t.wins + t.losses) > 0 ? t.wins / (t.wins + t.losses) : 0.5;
    return overall + (winPct - 0.5) * 10;
  };
  
  // Helper: Softmax probabilities
  const softmax = (teams, temperature = 8) => {
    const scores = teams.map(t => getPowerScore(t));
    const expScores = scores.map(s => Math.exp(s / temperature));
    const sum = expScores.reduce((a, b) => a + b, 0);
    return expScores.map(e => e / sum);
  };
  
  // Helper: Convert probability to American odds
  const probToAmericanOdds = (p) => {
    if (p >= 0.5) {
      return Math.round(-(p / (1 - p)) * 100);
    } else {
      return Math.round(((1 - p) / p) * 100);
    }
  };
  
  // Championship odds (all teams)
  const allTeams = league.teams;
  const champProbs = softmax(allTeams);
  const teamIdx = allTeams.findIndex(t => t.id === teamId);
  const champProb = champProbs[teamIdx];
  const champOdds = probToAmericanOdds(champProb);
  
  // Conference odds (same conference teams)
  const confTeams = allTeams.filter(t => t.conference === team.conference);
  const confProbs = softmax(confTeams);
  const confIdx = confTeams.findIndex(t => t.id === teamId);
  const confProb = confProbs[confIdx];
  const confOdds = probToAmericanOdds(confProb);
  
  // Division odds (same division teams)
  const divTeams = allTeams.filter(t => t.division === team.division);
  const divProbs = softmax(divTeams);
  const divIdx = divTeams.findIndex(t => t.id === teamId);
  const divProb = divProbs[divIdx];
  const divOdds = probToAmericanOdds(divProb);
  
  // Playoffs odds (simplified: sigmoid based on power score)
  const powerScore = getPowerScore(team);
  const playoffsProb = 1 / (1 + Math.exp(-(powerScore - 70) / 3));
  const playoffsOdds = probToAmericanOdds(playoffsProb);
  
  return {
    championship: { prob: champProb, odds: champOdds, pct: (champProb * 100).toFixed(1) },
    conference: { prob: confProb, odds: confOdds, pct: (confProb * 100).toFixed(1) },
    division: { prob: divProb, odds: divOdds, pct: (divProb * 100).toFixed(1) },
    playoffs: { prob: playoffsProb, odds: playoffsOdds, pct: (playoffsProb * 100).toFixed(1) }
  };
}

/**
 * Render Fan Hype card for dashboard
 */
function renderHypeCard(team) {
  if (!team) return '';
  
  const hype = team.hype !== undefined ? team.hype : 50;
  const hypeEffects = getHypeEffects(hype);
  const pressureInfo = getHypePressureInfo(team);
  
  // Determine hype color and trend
  const hypeColor = hype < 30 ? '#ef4444' :
                    hype < 50 ? '#fb923c' :
                    hype < 70 ? '#fbbf24' :
                    hype < 85 ? '#4ade80' : '#22c55e';
  
  // Calculate trend (last 5 games)
  let trendIcon = '—';
  let trendColor = '#94a3b8';
  if (team.hypeHistory && team.hypeHistory.length >= 2) {
    const recent = team.hypeHistory.slice(-5);
    const avgRecent = recent.reduce((sum, h) => sum + h.hype, 0) / recent.length;
    const older = team.hypeHistory.slice(-10, -5);
    if (older.length > 0) {
      const avgOlder = older.reduce((sum, h) => sum + h.hype, 0) / older.length;
      const diff = avgRecent - avgOlder;
      if (diff > 5) {
        trendIcon = '📈';
        trendColor = '#22c55e';
      } else if (diff < -5) {
        trendIcon = '📉';
        trendColor = '#ef4444';
      }
    }
  }
  
  // Media tone message
  const mediaToneMessages = {
    'critical': '🔴 Media is highly critical of the team',
    'skeptical': '🟡 Media coverage is skeptical',
    'optimistic': '🟢 Media coverage is optimistic',
    'euphoric': '🌟 Fans are in a frenzy!'
  };
  
  return `
    <div class="dashboard-card">
      <div class="dashboard-card-title">🔥 Fan Hype</div>
      
      <!-- Hype Meter -->
      <div class="hype-meter-container">
        <div class="hype-meter-value" style="color: ${hypeColor};">
          ${Math.round(hype)}
          <span class="hype-trend" style="color: ${trendColor};">${trendIcon}</span>
        </div>
        <div class="hype-meter-bar">
          <div class="hype-meter-fill" style="width: ${hype}%; background: linear-gradient(to right, #ef4444, #fbbf24, #4ade80);"></div>
        </div>
      </div>
      
      <!-- Hype Effects -->
      <div class="hype-effects-grid">
        <div class="hype-effect-item">
          <div class="hype-effect-label">Attendance</div>
          <div class="hype-effect-value">${(hypeEffects.attendance * 100).toFixed(0)}%</div>
        </div>
        <div class="hype-effect-item">
          <div class="hype-effect-label">Revenue</div>
          <div class="hype-effect-value">${(hypeEffects.revenue * 100).toFixed(0)}%</div>
        </div>
        <div class="hype-effect-item">
          <div class="hype-effect-label">Pressure</div>
          <div class="hype-effect-value" style="color: ${pressureInfo.color};">${pressureInfo.description}</div>
        </div>
      </div>
      
      <!-- Media Tone -->
      <div class="hype-media-tone">
        ${mediaToneMessages[hypeEffects.mediaTone]}
      </div>
      
      ${team.finances && team.finances.gamesPlayed > 0 ? `
        <div class="hype-attendance-info">
          📊 Avg Attendance: ${team.finances.avgAttendance.toLocaleString()} / game
        </div>
      ` : ''}
    </div>
  `;
}

function renderDashboard() {
  const el = document.getElementById('dashboard-tab');
  const team = league.teams.find(t => t.id === selectedTeamId);
  
  if (!team) {
    el.innerHTML = '<p>Team not found</p>';
    return;
  }
  
  // Team stats
  const overall = getTeamOverall(team);
  const offense = getTeamOffense(team);
  const defense = getTeamDefense(team);
  const powerRank = getPowerRank(team.id);
  const efficiency = getTeamEfficiencyStats(team);
  
  // Top 3 players
  const topPlayers = team.players
    .sort((a, b) => b.ratings.ovr - a.ratings.ovr)
    .slice(0, 3);
  
  // Salary cap
  const totalSalary = team.payroll;
  const capRoom = SALARY_CAP - totalSalary;
  const capPercent = Math.min(100, (totalSalary / SALARY_CAP) * 100);
  const isOverCap = totalSalary > SALARY_CAP;
  
  // Team logo
  const teamFullName = team.name;
  let logoHtml = '';
  if (team.logoPrimaryUrl) {
    logoHtml = `<img src="${team.logoPrimaryUrl}" alt="${teamFullName} logo" class="dashboard-team-logo" onerror="this.className='dashboard-team-logo placeholder';" />`;
  } else {
    const logoUrl = generateTeamLogo(teamFullName, { primary: team.primaryColor || '#3b82f6', secondary: team.secondaryColor || '#1e293b' });
    logoHtml = `<img src="${logoUrl}" alt="${teamFullName} logo" class="dashboard-team-logo" />`;
  }
  
  el.innerHTML = `
    <div class="dashboard-container">
      <!-- Header -->
      <div class="dashboard-header">
        ${logoHtml}
        <div class="dashboard-team-info">
          <div class="dashboard-label">YOUR TEAM</div>
          <div class="dashboard-team-name">${teamFullName}</div>
          <div class="dashboard-team-meta">${team.conference} • ${team.division}</div>
          <div class="dashboard-team-meta" style="font-size: 13px; color: #94a3b8; cursor: pointer;" onclick="showCoachModal(${team.id})">
            👔 Coach: ${team.coach ? team.coach.name : 'None'}${team.coach && team.coach.overall ? ` (${team.coach.overall} OVR)` : ''}
          </div>
          <div class="dashboard-record-row">
            <div class="dashboard-stat-pill">Record: ${team.wins}-${team.losses}</div>
            <div class="dashboard-stat-pill">#${powerRank} in League</div>
            <div class="dashboard-stat-pill">Morale: ${team.morale || 75}</div>
          </div>
        </div>
      </div>
      
      <!-- Team Ratings Card -->
      <div class="dashboard-card">
        <div class="dashboard-card-title">📊 Team Ratings</div>
        <div class="dashboard-ratings-grid">
          <div class="dashboard-rating-item">
            <div class="dashboard-rating-circle">${offense}</div>
            <div class="dashboard-rating-label">Offense</div>
          </div>
          <div class="dashboard-rating-item">
            <div class="dashboard-rating-circle">${defense}</div>
            <div class="dashboard-rating-label">Defense</div>
          </div>
          <div class="dashboard-rating-item">
            <div class="dashboard-rating-circle">${overall}</div>
            <div class="dashboard-rating-label">Overall</div>
          </div>
        </div>
      </div>
      
      <!-- Fan Hype Card -->
      ${renderHypeCard(team)}
      
      <!-- Efficiency Card -->
      <div class="dashboard-card">
        <div class="dashboard-card-title">⚡ Team Efficiency</div>
        <div class="dashboard-efficiency-grid">
          <div class="dashboard-efficiency-item">
            <div class="dashboard-efficiency-value">${efficiency.efg}%</div>
            <div class="dashboard-efficiency-label">eFG%</div>
          </div>
          <div class="dashboard-efficiency-item">
            <div class="dashboard-efficiency-value">${efficiency.tov}%</div>
            <div class="dashboard-efficiency-label">TOV%</div>
          </div>
          <div class="dashboard-efficiency-item">
            <div class="dashboard-efficiency-value">${efficiency.orb}%</div>
            <div class="dashboard-efficiency-label">ORB%</div>
          </div>
          <div class="dashboard-efficiency-item">
            <div class="dashboard-efficiency-value">${efficiency.ftRate}%</div>
            <div class="dashboard-efficiency-label">FT Rate</div>
          </div>
        </div>
      </div>
      
      <!-- Finals Odds Card -->
      ${(() => {
        const odds = computeFinalsOdds(league, team.id);
        if (!odds) return '';
        return `
      <div class="dashboard-card">
        <div class="dashboard-card-title">🏆 Finals Odds</div>
        <div class="odds-grid">
          <div class="odds-tile">
            <div class="odds-label">Championship</div>
            <div class="odds-value">${odds.championship.odds >= 0 ? '+' : ''}${odds.championship.odds}</div>
            <div class="odds-pct">${odds.championship.pct}%</div>
          </div>
          <div class="odds-tile">
            <div class="odds-label">Conference Title</div>
            <div class="odds-value">${odds.conference.odds >= 0 ? '+' : ''}${odds.conference.odds}</div>
            <div class="odds-pct">${odds.conference.pct}%</div>
          </div>
          <div class="odds-tile">
            <div class="odds-label">Make Playoffs</div>
            <div class="odds-value">${odds.playoffs.odds >= 0 ? '+' : ''}${odds.playoffs.odds}</div>
            <div class="odds-pct">${odds.playoffs.pct}%</div>
          </div>
          <div class="odds-tile">
            <div class="odds-label">Division Title</div>
            <div class="odds-value">${odds.division.odds >= 0 ? '+' : ''}${odds.division.odds}</div>
            <div class="odds-pct">${odds.division.pct}%</div>
          </div>
        </div>
      </div>
        `;
      })()}
      
      <!-- Top Players Card -->
      <div class="dashboard-card">
        <div class="dashboard-card-title">⭐ Top Players</div>
        ${topPlayers.map((p, idx) => {
          const ppg = p.seasonStats && p.seasonStats.gp > 0 
            ? (p.seasonStats.pts / p.seasonStats.gp).toFixed(1) 
            : 'N/A';
          return `
            <div class="dashboard-player-item">
              <div class="dashboard-player-rank">${idx + 1}</div>
              <div class="dashboard-player-info">
                <div class="dashboard-player-name clickable-player" onclick="showPlayerModal(${p.id})">${p.name}</div>
                <div class="dashboard-player-pos">${p.pos}</div>
              </div>
              <div class="dashboard-player-stat">${ppg} PPG</div>
              <div class="dashboard-player-ovr">${p.ratings.ovr}</div>
            </div>
          `;
        }).join('')}
      </div>
      
      <!-- Alerts Section -->
      ${renderDashboardAlerts()}
      
      <!-- Strength of Schedule Card -->
      ${renderStrengthOfSchedule(team.id)}
      
      <!-- Salary Cap Card -->
      <div class="dashboard-card">
        <div class="dashboard-card-title">💰 Salary Cap</div>
        <div class="dashboard-cap-row">
          <div class="dashboard-cap-label">Total Salary</div>
          <div class="dashboard-cap-value">$${totalSalary.toFixed(1)}M</div>
        </div>
        <div class="dashboard-cap-row">
          <div class="dashboard-cap-label">Cap Room</div>
          <div class="dashboard-cap-value ${isOverCap ? 'style="color: #ef4444;"' : ''}">$${capRoom.toFixed(1)}M</div>
        </div>
        <div class="dashboard-cap-bar">
          <div class="dashboard-cap-fill ${isOverCap ? 'over' : 'under'}" style="width: ${capPercent}%;"></div>
        </div>
        ${isOverCap ? '<div class="dashboard-alert">⚠️ Over Salary Cap!</div>' : ''}
      </div>
      
      <!-- Simulate Week Button -->
      <button class="btn-simulate-week" onclick="simulateWeek()">
        🏀 Simulate Week
      </button>
    </div>
  `;
}

function simulateWeek() {
  // Simulate 7 games for simplicity (about a week of games)
  const gamesPerWeek = 7;
  for (let i = 0; i < gamesPerWeek && league.phase === 'season'; i++) {
    // Find teams that haven't played 82 games yet
    const teamsToPlay = league.teams.filter(t => (t.wins + t.losses) < 82);
    if (teamsToPlay.length < 2) {
      league.phase = 'offseason';
      break;
    }
    
    // Simulate one round of games
    const used = new Set();
    for (let j = 0; j < Math.floor(teamsToPlay.length / 2); j++) {
      let teamA, teamB;
      do {
        teamA = teamsToPlay[Math.floor(Math.random() * teamsToPlay.length)];
        teamB = teamsToPlay[Math.floor(Math.random() * teamsToPlay.length)];
      } while (teamA === teamB || used.has(teamA.id) || used.has(teamB.id));
      
      used.add(teamA.id);
      used.add(teamB.id);
      
      simGame(teamA, teamB);
    }
  }
  
  render();
}

/* ============================
   STRENGTH OF SCHEDULE
============================ */

function calculateSOSData(teamId) {
  const team = league.teams.find(t => t.id === teamId);
  if (!team || !league.schedule || !league.schedule.games) {
    return { last10AvgOVR: null, next10AvgOVR: null, rank: null, label: 'N/A', totalTeams: league.teams.length };
  }
  
  const allGames = Object.values(league.schedule.games);
  const teamGames = allGames.filter(g => g.homeTeamId === teamId || g.awayTeamId === teamId);
  
  // Get completed games
  const completedGames = teamGames.filter(g => g.status === 'final').sort((a, b) => {
    // Sort by day number
    return (a.day || 0) - (b.day || 0);
  });
  
  // Get scheduled games
  const scheduledGames = teamGames.filter(g => g.status === 'scheduled').sort((a, b) => {
    return (a.day || 0) - (b.day || 0);
  });
  
  // Calculate last 10 opponents average OVR
  let last10AvgOVR = null;
  if (completedGames.length > 0) {
    const last10 = completedGames.slice(-10);
    const opponentOVRs = last10.map(g => {
      const opponentId = g.homeTeamId === teamId ? g.awayTeamId : g.homeTeamId;
      const opponent = league.teams.find(t => t.id === opponentId);
      return opponent ? getTeamOverall(opponent) : 0;
    });
    last10AvgOVR = opponentOVRs.length > 0 ? Math.round(opponentOVRs.reduce((a, b) => a + b, 0) / opponentOVRs.length) : null;
  }
  
  // Calculate next 10 opponents average OVR
  let next10AvgOVR = null;
  if (scheduledGames.length > 0) {
    const next10 = scheduledGames.slice(0, 10);
    const opponentOVRs = next10.map(g => {
      const opponentId = g.homeTeamId === teamId ? g.awayTeamId : g.homeTeamId;
      const opponent = league.teams.find(t => t.id === opponentId);
      return opponent ? getTeamOverall(opponent) : 0;
    });
    next10AvgOVR = opponentOVRs.length > 0 ? Math.round(opponentOVRs.reduce((a, b) => a + b, 0) / opponentOVRs.length) : null;
  }
  
  // Calculate league-wide SOS for ranking (based on remaining schedule)
  const allTeamsSOS = league.teams.map(t => {
    const tGames = allGames.filter(g => g.homeTeamId === t.id || g.awayTeamId === t.id);
    const tScheduled = tGames.filter(g => g.status === 'scheduled');
    
    if (tScheduled.length === 0) {
      return { teamId: t.id, sosValue: 0 };
    }
    
    const opponentOVRs = tScheduled.map(g => {
      const oppId = g.homeTeamId === t.id ? g.awayTeamId : g.homeTeamId;
      const opp = league.teams.find(team => team.id === oppId);
      return opp ? getTeamOverall(opp) : 0;
    });
    
    const sosValue = opponentOVRs.reduce((a, b) => a + b, 0) / opponentOVRs.length;
    return { teamId: t.id, sosValue };
  });
  
  // Sort by SOS value descending (highest = toughest)
  allTeamsSOS.sort((a, b) => b.sosValue - a.sosValue);
  
  // Find this team's rank (1 = toughest)
  const rank = allTeamsSOS.findIndex(s => s.teamId === teamId) + 1;
  const totalTeams = league.teams.length;
  
  // Determine label
  let label = 'Average';
  const percentile = rank / totalTeams;
  if (percentile <= 0.33) {
    label = 'Tough';
  } else if (percentile >= 0.67) {
    label = 'Easy';
  }
  
  return { last10AvgOVR, next10AvgOVR, rank, label, totalTeams };
}

function renderStrengthOfSchedule(teamId) {
  const sosData = calculateSOSData(teamId);
  
  // Determine rank text
  let rankText = '';
  if (sosData.rank && sosData.label !== 'N/A') {
    if (sosData.label === 'Tough') {
      rankText = `(#${sosData.rank} toughest)`;
    } else if (sosData.label === 'Easy') {
      rankText = `(#${sosData.totalTeams - sosData.rank + 1} easiest)`;
    } else {
      rankText = `(#${sosData.rank} toughest)`;
    }
  }
  
  return `
    <div class="dashboard-card">
      <div class="dashboard-card-header">
        <div class="dashboard-card-title">📅 STRENGTH OF SCHEDULE</div>
        <div class="dashboard-card-summary">
          <span class="sos-label sos-${sosData.label.toLowerCase()}">${sosData.label}</span>
          <span class="sos-rank">${rankText}</span>
        </div>
      </div>
      <div class="sos-subcards">
        <div class="sos-subcard">
          <div class="sos-subcard-title">Last 10 Opponents</div>
          <div class="sos-subcard-value">${sosData.last10AvgOVR !== null ? sosData.last10AvgOVR : 'N/A'}</div>
          <div class="sos-subcard-label">Avg OVR</div>
        </div>
        <div class="sos-subcard">
          <div class="sos-subcard-title">Next 10 Opponents</div>
          <div class="sos-subcard-value">${sosData.next10AvgOVR !== null ? sosData.next10AvgOVR : 'N/A'}</div>
          <div class="sos-subcard-label">Avg OVR</div>
        </div>
      </div>
    </div>
  `;
}

/* ============================
   DASHBOARD ALERTS
============================ */

function renderDashboardAlerts() {
  const alerts = computeDashboardAlerts(selectedTeamId);
  
  if (!alerts || alerts.length === 0) {
    return `
      <div class="dashboard-card">
        <div class="dashboard-card-title">🔔 ALERTS</div>
        <div class="alert-empty">
          <div class="alert-empty-icon">✓</div>
          <div class="alert-empty-text">No alerts. Everything looks stable.</div>
        </div>
      </div>
    `;
  }
  
  const visibleAlerts = alerts.slice(0, 4);
  const hasMore = alerts.length > 4;
  
  return `
    <div class="dashboard-card">
      <div class="dashboard-card-title">🔔 ALERTS</div>
      <div class="alerts-container">
        ${visibleAlerts.map(alert => `
          <div class="alert-card alert-${alert.severity}" onclick="handleAlertClick('${alert.action.type}', '${alert.action.target}')">
            <div class="alert-icon">
              ${alert.severity === 'danger' ? '⚠️' : alert.severity === 'warning' ? '⚡' : 'ℹ️'}
            </div>
            <div class="alert-content">
              <div class="alert-message">${alert.message}</div>
              ${alert.subtext ? `<div class="alert-subtext">${alert.subtext}</div>` : ''}
            </div>
          </div>
        `).join('')}
        ${hasMore ? `
          <div class="alert-view-all" onclick="openAlertsModal()">
            View all ${alerts.length} alerts →
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function handleAlertClick(actionType, target) {
  if (actionType === 'NAVIGATE') {
    switchTab(target);
  }
}

function openAlertsModal() {
  const alerts = computeDashboardAlerts(selectedTeamId);
  
  const modalHtml = `
    <div class="modal-overlay" onclick="closeAlertsModal()">
      <div class="modal-container alerts-modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>All Alerts</h2>
          <button class="modal-close" onclick="closeAlertsModal()">×</button>
        </div>
        <div class="modal-body">
          ${alerts.map(alert => `
            <div class="alert-card alert-${alert.severity}" onclick="handleAlertClick('${alert.action.type}', '${alert.action.target}'); closeAlertsModal();">
              <div class="alert-icon">
                ${alert.severity === 'danger' ? '⚠️' : alert.severity === 'warning' ? '⚡' : 'ℹ️'}
              </div>
              <div class="alert-content">
                <div class="alert-message">${alert.message}</div>
                ${alert.subtext ? `<div class="alert-subtext">${alert.subtext}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeAlertsModal() {
  const modal = document.querySelector('.modal-overlay');
  if (modal) modal.remove();
}

function renderStandings() {
  const el = document.getElementById('standings-tab');
  
  // Safety check
  if (!league || !league.teams || league.teams.length === 0) {
    el.innerHTML = `
      <h2>Season ${league?.season || '—'} Standings</h2>
      <div class="info-box">No teams available. Please start or load a league.</div>
    `;
    return;
  }
  
  // Pill toggle for Record vs Power Rankings
  const pillToggle = `
    <div class="standings-pill-toggle">
      <button class="pill-btn ${standingsView === 'record' ? 'active' : ''}" onclick="switchStandingsView('record')">Record</button>
      <button class="pill-btn ${standingsView === 'power' ? 'active' : ''}" onclick="switchStandingsView('power')">Power Rankings</button>
    </div>
  `;
  
  let content = '';
  
  if (standingsView === 'record') {
    content = renderRecordStandings();
  } else {
    content = renderPowerRankings();
  }
  
  // Add rivalries section if user team is selected
  let rivalriesSection = '';
  if (selectedTeamId) {
    rivalriesSection = '<div id="rivalries-section-placeholder"></div>';
  }
  
  el.innerHTML = `
    <h2>Season ${league.season} Standings</h2>
    ${pillToggle}
    ${rivalriesSection}
    ${content}
  `;
  
  // Load rivalries asynchronously
  if (selectedTeamId) {
    renderTopRivalsCard(selectedTeamId).then(html => {
      const placeholder = document.getElementById('rivalries-section-placeholder');
      if (placeholder) {
        placeholder.innerHTML = html;
      }
    });
  }
}


function switchStandingsView(view) {
  standingsView = view;
  renderStandings();
}

function renderRecordStandings() {
  // Handle teams with or without conference assignments
  const eastern = league.teams.filter(t => t.conference === 'Eastern' || t.conference === 'East').sort((a, b) => b.wins - a.wins);
  const western = league.teams.filter(t => t.conference === 'Western' || t.conference === 'West').sort((a, b) => b.wins - a.wins);
  const unassigned = league.teams.filter(t => !t.conference || (t.conference !== 'Eastern' && t.conference !== 'East' && t.conference !== 'Western' && t.conference !== 'West')).sort((a, b) => b.wins - a.wins);
  
  const renderConference = (teams, confName) => {
    if (teams.length === 0) return '';
    
    const leaderWins = teams[0].wins;
    const leaderLosses = teams[0].losses;
    
    const rows = teams.map((t, idx) => {
      const wpct = t.wins + t.losses > 0 ? (t.wins / (t.wins + t.losses)).toFixed(3) : '.000';
      const gb = idx === 0 ? '—' : calculateGB(t, leaderWins, leaderLosses);
      const confRecord = `${t.stats?.confWins || 0}-${t.stats?.confLosses || 0}`;
      const homeRecord = `${t.stats?.homeWins || 0}-${t.stats?.homeLosses || 0}`;
      const awayRecord = `${t.stats?.awayWins || 0}-${t.stats?.awayLosses || 0}`;
      const last10Record = getLast10Record(t.stats?.last10 || []);
      const streakStr = getStreakString(t.stats?.streak || 0);
      const teamLogo = t.logoSecondaryUrl ? `<div class="team-logo-emoji" style="font-size: 2em;">${t.logoSecondaryUrl}</div>` : `<div class="team-logo-small">${t.city.substring(0, 2).toUpperCase()}</div>`;
      
      // Hype indicator
      const hype = t.hype !== undefined ? t.hype : 50;
      const hypeColor = hype < 30 ? '#ef4444' :
                        hype < 50 ? '#fb923c' :
                        hype < 70 ? '#fbbf24' : '#4ade80';
      const hypeIcon = hype < 30 ? '🔴' :
                       hype < 50 ? '🟡' :
                       hype < 70 ? '🟢' : '🔥';
      
      return `
        <tr class="standings-row">
          <td class="standings-rank">${idx + 1}</td>
          <td class="standings-team">
            ${teamLogo}
            <span class="team-name">${t.name}</span>
          </td>
          <td>${t.wins}</td>
          <td>${t.losses}</td>
          <td>${wpct}</td>
          <td>${gb}</td>
        </tr>
        <tr class="standings-detail-row">
          <td colspan="6">
            <div class="standings-details">
              <span>CONF: ${confRecord}</span>
              <span>HOME: ${homeRecord}</span>
              <span>AWAY: ${awayRecord}</span>
              <span>L10: ${last10Record}</span>
              <span>STRK: ${streakStr}</span>
              <span title="Fan Hype" style="color: ${hypeColor};">${hypeIcon} ${Math.round(hype)}</span>
            </div>
          </td>
        </tr>
      `;
    }).join('');
    
    return `
      <div class="conference-section">
        <h3 class="conference-header">${confName} Conference</h3>
        <table class="standings-table">
          <thead>
            <tr>
              <th>#</th>
              <th style="text-align:left;">Team</th>
              <th>W</th>
              <th>L</th>
              <th>WIN%</th>
              <th>GB</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  };
  
  let html = '';
  if (eastern.length > 0) html += renderConference(eastern, 'Eastern');
  if (western.length > 0) html += renderConference(western, 'Western');
  if (unassigned.length > 0) html += renderConference(unassigned, 'League');
  
  // If no teams at all, show message
  if (html === '') {
    html = '<div class="info-box">No teams to display. Start a new season!</div>';
  }
  
  return html;
}

function renderPowerRankings() {
  const teamsWithPower = league.teams.map(t => ({
    team: t,
    powerScore: getPowerScore(t),
    statusTag: getStatusTag(t)
  })).sort((a, b) => b.powerScore - a.powerScore);
  
  const rows = teamsWithPower.map((item, idx) => {
    const { team, powerScore, statusTag } = item;
    const teamLogo = team.logoSecondaryUrl ? `<div class="team-logo-emoji" style="font-size: 2em;">${team.logoSecondaryUrl}</div>` : `<div class="team-logo-small">${team.city.substring(0, 2).toUpperCase()}</div>`;
    const record = `${team.wins}-${team.losses}`;
    
    return `
      <tr class="power-rankings-row">
        <td class="power-rank">${idx + 1}</td>
        <td class="power-team">
          ${teamLogo}
          <span class="team-name">${team.name}</span>
        </td>
        <td>${record}</td>
        <td><span class="status-tag status-${statusTag.toLowerCase()}">${statusTag}</span></td>
        <td class="power-score">${powerScore.toFixed(1)}</td>
      </tr>
    `;
  }).join('');
  
  return `
    <div class="power-rankings-section">
      <table class="power-rankings-table">
        <thead>
          <tr>
            <th>#</th>
            <th style="text-align:left;">Team</th>
            <th>Record</th>
            <th>Status</th>
            <th>Power</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function calculateGB(team, leaderWins, leaderLosses) {
  const gb = ((leaderWins - team.wins) + (team.losses - leaderLosses)) / 2;
  return gb === 0 ? '—' : gb.toFixed(1);
}

function getPowerScore(team) {
  // Safety check for players array
  if (!team.players || team.players.length === 0) {
    return 0;
  }
  
  const teamOVR = team.players.reduce((sum, p) => sum + p.ovr, 0) / team.players.length;
  const wpct = team.wins + team.losses > 0 ? team.wins / (team.wins + team.losses) : 0;
  const last10 = team.stats?.last10 || [];
  const last10Wins = last10.filter(r => r === 'W').length;
  const last10Losses = last10.filter(r => r === 'L').length;
  
  return teamOVR * 1.0 + wpct * 20 + (last10Wins - last10Losses) * 1.5;
}

/* ============================
   POINT SPREAD SYSTEM
============================ */

// Constants
const HOME_COURT_ADVANTAGE = 2.5; // Points home team gets as advantage
const MARGIN_SCALE = 0.55; // How much strength difference converts to point spread
const MAX_SPREAD = 20; // Maximum point spread magnitude

/**
 * Compute team strength for spread calculations
 * Uses weighted average of top 8 players OVR
 */
function computeTeamStrength(tid) {
  const team = league.teams.find(t => t.id === tid);
  if (!team || !team.players || team.players.length === 0) {
    return 70; // Default fallback strength
  }
  
  // Get top 8 players by OVR
  const top8 = team.players
    .filter(p => p.ratings && p.ratings.ovr)
    .sort((a, b) => b.ratings.ovr - a.ratings.ovr)
    .slice(0, 8);
  
  if (top8.length === 0) return 70;
  
  // Weighted average: starters count more than bench
  const weights = [1.5, 1.5, 1.3, 1.3, 1.2, 1.0, 0.8, 0.7]; // Weighted by importance
  let weightedSum = 0;
  let totalWeight = 0;
  
  top8.forEach((player, i) => {
    const weight = weights[i] || 0.5;
    weightedSum += player.ratings.ovr * weight;
    totalWeight += weight;
  });
  
  const strength = weightedSum / totalWeight;
  
  // Optional: Add coach bonus if you have coach ratings
  if (team.coach && team.coach.overall) {
    const coachBonus = (team.coach.overall - 70) * 0.1; // Small bonus/penalty from coach
    return strength + coachBonus;
  }
  
  return strength;
}

/**
 * Compute point spread for a game
 * Returns { home: number, away: number } where negative = favored
 */
function computeGameSpread(awayTid, homeTid, isNeutralSite = false) {
  const homeStrength = computeTeamStrength(homeTid);
  const awayStrength = computeTeamStrength(awayTid);
  
  // Calculate home court advantage
  const hca = isNeutralSite ? 0 : HOME_COURT_ADVANTAGE;
  
  // Calculate expected margin (positive = home favored, negative = away favored)
  const strengthDiff = (homeStrength + hca) - awayStrength;
  const expectedMargin = strengthDiff * MARGIN_SCALE;
  
  // Round to half points (0.5 increments)
  let spread = Math.round(expectedMargin * 2) / 2;
  
  // Clamp to max spread
  spread = Math.max(-MAX_SPREAD, Math.min(MAX_SPREAD, spread));
  
  // Return spread from each team's perspective
  // Negative = favored, Positive = underdog
  return {
    home: -spread,  // Home team's spread (negative if favored)
    away: +spread,  // Away team's spread (positive if underdog)
    strengthVersion: league.strengthVersion || 0,
    modelVersion: '1.0'
  };
}

/**
 * Get or compute spread for a game with caching
 */
function getGameSpread(game) {
  // Don't show spread for completed games
  if (game.status === 'final') {
    return null;
  }
  
  const currentVersion = league.strengthVersion || 0;
  
  // Check if we have cached spread and it's still valid
  if (game.spread && game.spread.strengthVersion === currentVersion) {
    return game.spread;
  }
  
  // Compute new spread
  const spread = computeGameSpread(game.awayTeamId, game.homeTeamId);
  
  // Cache it on the game object
  game.spread = spread;
  
  return spread;
}

/**
 * Format spread for display
 */
function formatSpread(spreadValue) {
  if (spreadValue === 0) {
    return 'PK'; // Pick'em
  }
  
  const sign = spreadValue > 0 ? '+' : '';
  
  // Show whole numbers without decimal
  if (spreadValue % 1 === 0) {
    return `${sign}${spreadValue}`;
  }
  
  // Show half points with .5
  return `${sign}${spreadValue.toFixed(1)}`;
}

/**
 * Increment strength version when team strength changes
 * Call this after: trades, injuries, player edits, add/delete player
 */
function incrementStrengthVersion() {
  if (!league.strengthVersion) {
    league.strengthVersion = 0;
  }
  league.strengthVersion++;
  console.log(`[Spread] Strength version updated to ${league.strengthVersion}`);
}

function getStatusTag(team) {
  const streak = team.stats?.streak || 0;
  
  if (streak >= 4) return 'Hot';
  if (streak >= 2) return 'Warm';
  if (streak <= -4) return 'Cold';
  if (streak <= -2) return 'Cool';
  return 'Neutral';
}

function getStreakString(streak) {
  if (streak === 0) return '—';
  return streak > 0 ? `W${streak}` : `L${Math.abs(streak)}`;
}

function getLast10Record(last10) {
  if (!last10 || last10.length === 0) return '0-0';
  const wins = last10.filter(r => r === 'W').length;
  const losses = last10.filter(r => r === 'L').length;
  return `${wins}-${losses}`;
}

function renderTeam() {
  const el = document.getElementById('team-tab');
  
  if (!selectedTeamId) {
    console.warn('[RENDER TEAM] No team selected, defaulting to first team');
    selectedTeamId = league.teams[0].id;
    // Persist the fallback selection
    if (typeof switchUserTeam === 'function') {
      switchUserTeam(selectedTeamId);
    }
  }
  
  const team = league.teams.find(t => t.id === selectedTeamId);
  
  if (!team) {
    el.innerHTML = '<p>Team not found</p>';
    return;
  }
  
  el.innerHTML = renderRosterMobileCards(team);
}

// Helper: Group players by position
function groupPlayersByPos(players) {
  const groups = {
    'PG': { label: 'POINT GUARDS', players: [] },
    'SG': { label: 'SHOOTING GUARDS', players: [] },
    'SF': { label: 'SMALL FORWARDS', players: [] },
    'PF': { label: 'POWER FORWARDS', players: [] },
    'C': { label: 'CENTERS', players: [] }
  };
  
  players.forEach(p => {
    if (groups[p.pos]) {
      groups[p.pos].players.push(p);
    }
  });
  
  return groups;
}

// Helper: Format money in millions
function formatMoneyM(num) {
  return `$${num.toFixed(1)}M`;
}

// Helper: Get OVR tier class
function ovrClass(ovr) {
  if (ovr >= 90) return 'ovr-purple';
  if (ovr >= 85) return 'ovr-blue';
  if (ovr >= 80) return 'ovr-green';
  if (ovr >= 70) return 'ovr-yellow';
  return 'ovr-gray';
}

// Render roster as mobile-friendly cards
function renderRosterMobileCards(team) {
  const capSpace = SALARY_CAP - team.payroll;
  const maxRoster = 15;
  
  // Team selector dropdown
  const teamOptions = league.teams.map(t => 
    `<option value="${t.id}" ${t.id === team.id ? 'selected' : ''}>${t.name}</option>`
  ).join('');
  
  // Group players by position
  const grouped = groupPlayersByPos(team.players);
  
  // Render position sections
  let positionSections = '';
  ['PG', 'SG', 'SF', 'PF', 'C'].forEach(pos => {
    const group = grouped[pos];
    if (group.players.length === 0) return;
    
    // Sort by OVR descending within position
    const sortedPlayers = [...group.players].sort((a, b) => b.ratings.ovr - a.ratings.ovr);
    
    const playerCards = sortedPlayers.map(p => {
      const ppg = p.seasonStats.gp > 0 ? (p.seasonStats.pts / p.seasonStats.gp).toFixed(1) : '0.0';
      const rpg = p.seasonStats.gp > 0 ? (p.seasonStats.reb / p.seasonStats.gp).toFixed(1) : '0.0';
      const apg = p.seasonStats.gp > 0 ? (p.seasonStats.ast / p.seasonStats.gp).toFixed(1) : '0.0';
      const yearsLeft = Math.max(0, p.contract.exp - league.season);
      
      // Contract type badge
      const contractBadge = p.contract.isTrainingCamp ? 
        '<span style="background:#dc2626; color:white; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:600; margin-left:6px;">TC</span>' :
        p.contract.guaranteed < 100 ?
        `<span style="background:#f59e0b; color:white; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:600; margin-left:6px;">${p.contract.guaranteed}%</span>` :
        '';
      
      return `
        <div class="player-card-mobile">
          <div class="player-card-main">
            <div class="player-card-left">
              <div class="player-name-mobile">${p.name}${contractBadge}</div>
              <div class="player-details-mobile">
                ${p.age} • ${yearsLeft}yr${yearsLeft !== 1 ? 's' : ''} • ${formatMoneyM(p.contract.amount)}/yr
              </div>
              <div class="player-stats-mobile">
                ${ppg} PPG • ${rpg} RPG • ${apg} APG
              </div>
            </div>
            <div class="player-card-right">
              <div class="player-ovr ${ovrClass(p.ratings.ovr)}">${p.ratings.ovr}</div>
              <div class="player-ovr-label">OVR</div>
            </div>
          </div>
          <button class="player-action-btn" onclick="showPlayerActionMenu(${p.id}, event)">⋯</button>
        </div>
      `;
    }).join('');
    
    positionSections += `
      <div class="position-section">
        <h3 class="position-header">${group.label}</h3>
        ${playerCards}
      </div>
    `;
  });
  
  return `
    <div class="roster-mobile-container">
      <div class="roster-header-mobile">
        <h2 class="roster-title">YOUR ROSTER</h2>
        <div class="team-selector-mobile">
          <select class="team-dropdown" onchange="if(typeof switchUserTeam === 'function') { switchUserTeam(parseInt(this.value)); } else { selectedTeamId = parseInt(this.value); } render();">
            ${teamOptions}
          </select>
          <span class="dropdown-icon">▾</span>
        </div>
        <div class="coach-row-mobile" onclick="showCoachModal(${team.id})">
          <span>Coach: <strong>${team.coach.name}</strong></span>
          <span class="info-icon">ⓘ</span>
        </div>
      </div>
      
      <div class="team-summary-strip">
        <div class="summary-stat">
          <div class="summary-label">Roster Size</div>
          <div class="summary-value">${team.players.length}/${maxRoster}</div>
        </div>
        <div class="summary-stat">
          <div class="summary-label">Salary</div>
          <div class="summary-value ${team.payroll > SALARY_CAP ? 'negative' : ''}">${formatMoneyM(team.payroll)}</div>
        </div>
        <div class="summary-stat">
          <div class="summary-label">Cap Space</div>
          <div class="summary-value ${capSpace < 0 ? 'negative' : 'positive'}">${formatMoneyM(capSpace)}</div>
        </div>
      </div>
      
      ${positionSections}
    </div>
  `;
}

// Show player action menu
let activeActionMenu = null;

function showPlayerActionMenu(playerId, event) {
  event.stopPropagation();
  
  // Close existing menu if any
  if (activeActionMenu) {
    activeActionMenu.remove();
    activeActionMenu = null;
  }
  
  // Find player and team
  let player = null;
  let teamId = null;
  
  for (let team of league.teams) {
    const p = team.players.find(pl => pl.id === playerId);
    if (p) {
      player = p;
      teamId = team.id;
      break;
    }
  }
  
  if (!player) return;
  
  // Check if waiving is allowed
  const waiveAllowed = typeof isActionAllowed === 'function' ? isActionAllowed(ACTIONS.WAIVE) : true;
  const waiveLockReason = !waiveAllowed && typeof getActionLockReason === 'function' ? 
                          getActionLockReason(ACTIONS.WAIVE) : null;
  
  const menu = document.createElement('div');
  menu.className = 'player-action-menu';
  menu.innerHTML = `
    <div class="action-menu-item" onclick="showPlayerModal(${playerId}); closeActionMenu();">View Player</div>
    <div class="action-menu-item" onclick="alert('Trade feature coming soon!'); closeActionMenu();">Trade</div>
    <div class="action-menu-item danger ${!waiveAllowed ? 'disabled' : ''}" 
         ${waiveLockReason ? `title="${waiveLockReason}"` : ''}
         onclick="${waiveAllowed ? `cutPlayer(${playerId}, ${teamId}); closeActionMenu();` : `alert('❌ Waive Not Allowed\\n\\n${waiveLockReason}'); closeActionMenu();`}">
      Cut/Waive
    </div>
  `;
  
  // Position menu near the button
  const btn = event.target;
  const rect = btn.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = `${rect.bottom + 5}px`;
  menu.style.right = `${window.innerWidth - rect.right}px`;
  
  document.body.appendChild(menu);
  activeActionMenu = menu;
  
  // Close menu when clicking outside
  setTimeout(() => {
    document.addEventListener('click', closeActionMenu);
  }, 10);
}

function closeActionMenu() {
  if (activeActionMenu) {
    activeActionMenu.remove();
    activeActionMenu = null;
  }
  document.removeEventListener('click', closeActionMenu);
}

function renderPlayer() {
  const el = document.getElementById('player-tab');
  el.innerHTML = `
    <h2>Player Details</h2>
    <p>Click on a player's name in the Team Roster tab to view their details.</p>
  `;
}

function renderFreeAgents() {
  const el = document.getElementById('freeagents-tab');
  
  // Check if free agent signing is allowed
  const signingAllowed = typeof isActionAllowed === 'function' ? isActionAllowed(ACTIONS.SIGN_FA) : true;
  const lockReason = !signingAllowed && typeof getActionLockReason === 'function' ? 
                     getActionLockReason(ACTIONS.SIGN_FA) : null;
  
  if (league.freeAgents.length === 0) {
    el.innerHTML = `
      <div class="freeagents-container">
        <h2 class="freeagents-title">Free Agency</h2>
        <div class="freeagents-empty">No free agents available</div>
      </div>
    `;
    return;
  }
  
  // Ensure all free agents have agent/market data
  league.freeAgents.forEach(p => {
    if (!p.agent) {
      const agentStyles = ['Aggressive', 'Patient', 'Analytical', 'Relationship-Focused', 'Money-First'];
      const agentNames = [
        'Michael Sterling', 'Sarah Chen', 'Marcus Rivera', 'Jennifer Walsh', 'David Kumar',
        'Amanda Foster', 'Robert Thompson', 'Lisa Rodriguez', 'James Anderson', 'Emily Park'
      ];
      p.agent = {
        name: agentNames[Math.floor(Math.random() * agentNames.length)],
        style: agentStyles[Math.floor(Math.random() * agentStyles.length)],
        powerRating: 50 + Math.floor(Math.random() * 45),
        yearsWithPlayer: 1 + Math.floor(Math.random() * 5)
      };
    }
    if (!p.marketValue) {
      const baseValue = p.contract.amount || 5;
      p.marketValue = {
        min: baseValue * 0.8,
        max: baseValue * 1.3,
        expected: baseValue,
        status: p.ratings.ovr >= 80 ? 'Hot' : p.ratings.ovr >= 65 ? 'Normal' : 'Cold'
      };
    }
    if (!p.contract.hasPlayerOption) p.contract.hasPlayerOption = false;
    if (!p.contract.hasTeamOption) p.contract.hasTeamOption = false;
  });
  
  const sorted = [...league.freeAgents].sort((a, b) => b.ratings.ovr - a.ratings.ovr);
  
  el.innerHTML = `
    <div class="freeagents-container">
      <h2 class="freeagents-title">Free Agency</h2>
      <div class="freeagents-subtitle">Negotiate with player agents to build your roster</div>
      
      <div class="freeagents-table">
        <div class="freeagents-header">
          <div class="freeagents-cell name">Player</div>
          <div class="freeagents-cell pos">Pos</div>
          <div class="freeagents-cell age">Age</div>
          <div class="freeagents-cell ovr">OVR</div>
          <div class="freeagents-cell salary">Expected Salary</div>
          <div class="freeagents-cell market">Market</div>
          <div class="freeagents-cell action">Action</div>
        </div>
        ${sorted.map(p => `
          <div class="freeagents-row">
            <div class="freeagents-cell name">
              <span class="freeagents-player-name" onclick="showPlayerModal(${p.id})">${p.name}</span>
            </div>
            <div class="freeagents-cell pos">${p.pos}</div>
            <div class="freeagents-cell age">${p.age}</div>
            <div class="freeagents-cell ovr">
              <span class="freeagents-ovr-badge">${p.ratings.ovr}</span>
            </div>
            <div class="freeagents-cell salary">$${p.marketValue.min.toFixed(1)}M - $${p.marketValue.max.toFixed(1)}M</div>
            <div class="freeagents-cell market">
              <span class="freeagents-market-badge ${p.marketValue.status.toLowerCase()}">${p.marketValue.status}</span>
            </div>
            <div class="freeagents-cell action">
              <button class="freeagents-negotiate-btn" 
                      ${!signingAllowed ? 'disabled' : ''}
                      ${lockReason ? `title="${lockReason}"` : ''}
                      onclick="openNegotiationModal(${p.id})">Negotiate</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/* ============================
   EXPANSION TAB
============================ */

function renderExpansion() {
  const el = document.getElementById('expansion-tab');
  
  if (!league) {
    el.innerHTML = '<div class="dashboard-card"><p>No league loaded. Please create or load a league first.</p></div>';
    return;
  }
  
  // Initialize expansion if missing (for old saves)
  if (!league.expansion) {
    console.log('Initializing expansion state for existing league');
    league.expansion = initExpansionState();
    save();
  }
  
  const exp = league.expansion;
  const currentStep = exp.currentStep || 1;
  
  el.innerHTML = `
    <div class="expansion-container">
      <!-- Header Card -->
      <div class="dashboard-card">
        <div class="dashboard-card-title">🌟 League Expansion</div>
        <div class="expansion-overview">
          <div class="expansion-info-grid">
            <div class="expansion-info-item">
              <div class="expansion-info-label">Current Season</div>
              <div class="expansion-info-value">${league.season}</div>
            </div>
            <div class="expansion-info-item">
              <div class="expansion-info-label">Phase</div>
              <div class="expansion-info-value">${league.phase.toUpperCase()}</div>
            </div>
            <div class="expansion-info-item">
              <div class="expansion-info-label">Expansion Active</div>
              <div class="expansion-info-value">${exp.active ? '✅ Yes' : '❌ No'}</div>
            </div>
            <div class="expansion-info-item">
              <div class="expansion-info-label">Teams to Add</div>
              <div class="expansion-info-value">${exp.settings.numTeams}</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Stepper -->
      <div class="expansion-stepper">
        ${[1, 2, 3, 4].map(step => {
          const isActive = step === currentStep;
          const isCompleted = step < currentStep;
          const stepLabels = ['Configure', 'Create Teams', 'Protection Lists', 'Expansion Draft'];
          return `
            <div class="expansion-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}" 
                 onclick="switchExpansionStep(${step})">
              <div class="expansion-step-number">${isCompleted ? '✓' : step}</div>
              <div class="expansion-step-label">${stepLabels[step - 1]}</div>
            </div>
          `;
        }).join('<div class="expansion-step-connector"></div>')}
      </div>
      
      <!-- Step Content -->
      <div class="expansion-content">
        ${renderExpansionStep(currentStep)}
      </div>
    </div>
  `;
}

function renderExpansionStep(step) {
  switch(step) {
    case 1: return renderExpansionSettings();
    case 2: return renderExpansionTeams();
    case 3: return renderExpansionProtection();
    case 4: return renderExpansionDraft();
    default: return '<p>Invalid step</p>';
  }
}

function renderExpansionSettings() {
  const settings = league.expansion.settings;
  
  return `
    <div class="dashboard-card">
      <div class="dashboard-card-title">⚙️ Expansion Settings</div>
      <div class="expansion-settings-grid">
        <div class="expansion-setting">
          <label>Number of Expansion Teams</label>
          <select id="exp-num-teams" value="${settings.numTeams}" onchange="updateExpansionSetting('numTeams', parseInt(this.value))">
            ${[1,2,3,4,5,6].map(n => `<option value="${n}" ${settings.numTeams === n ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>
        
        <div class="expansion-setting">
          <label>Expansion Year</label>
          <input type="number" id="exp-year" value="${settings.expansionYear || league.season + 1}" 
                 onchange="updateExpansionSetting('expansionYear', parseInt(this.value))" />
        </div>
        
        <div class="expansion-setting">
          <label>Roster Size Limit</label>
          <input type="number" id="exp-roster-limit" value="${settings.rosterSizeLimit}" min="10" max="20"
                 onchange="updateExpansionSetting('rosterSizeLimit', parseInt(this.value))" />
        </div>
        
        <div class="expansion-setting">
          <label>Protected Players per Team</label>
          <input type="number" id="exp-protected" value="${settings.protectedPlayersPerTeam}" min="5" max="12"
                 onchange="updateExpansionSetting('protectedPlayersPerTeam', parseInt(this.value))" />
        </div>
        
        <div class="expansion-setting">
          <label>Min Players per Team</label>
          <input type="number" id="exp-min-per" value="${settings.minPlayersPerTeam}" min="0" max="3"
                 onchange="updateExpansionSetting('minPlayersPerTeam', parseInt(this.value))" />
        </div>
        
        <div class="expansion-setting">
          <label>Max Players per Team</label>
          <input type="number" id="exp-max-per" value="${settings.maxPlayersPerTeam}" min="1" max="3"
                 onchange="updateExpansionSetting('maxPlayersPerTeam', parseInt(this.value))" />
        </div>
        
        <div class="expansion-setting">
          <label>Draft Order</label>
          <select id="exp-draft-order" onchange="updateExpansionSetting('draftOrder', this.value)">
            <option value="snake" ${settings.draftOrder === 'snake' ? 'selected' : ''}>Snake</option>
            <option value="random" ${settings.draftOrder === 'random' ? 'selected' : ''}>Random</option>
            <option value="worst-first" ${settings.draftOrder === 'worst-first' ? 'selected' : ''}>Worst Record First</option>
          </select>
        </div>
        
        <div class="expansion-setting expansion-checkbox">
          <label>
            <input type="checkbox" ${settings.canProtectRookies ? 'checked' : ''} 
                   onchange="updateExpansionSetting('canProtectRookies', this.checked)" />
            Can Protect Rookies
          </label>
        </div>
        
        <div class="expansion-setting expansion-checkbox">
          <label>
            <input type="checkbox" ${settings.expandedCap ? 'checked' : ''} 
                   onchange="updateExpansionSetting('expandedCap', this.checked)" />
            Expansion Teams Get Full Cap Space
          </label>
        </div>
        
        <div class="expansion-setting expansion-checkbox">
          <label>
            <input type="checkbox" ${settings.inheritContracts ? 'checked' : ''} 
                   onchange="updateExpansionSetting('inheritContracts', this.checked)" />
            Inherit Player Contracts
          </label>
        </div>
      </div>
      
      <div class="expansion-actions">
        <button class="btn-primary" onclick="startExpansion()">Start Expansion Process</button>
        ${league.expansion.active ? `<button class="btn-secondary" onclick="cancelExpansion()">Cancel Expansion</button>` : ''}
      </div>
    </div>
  `;
}

function renderExpansionTeams() {
  if (!league.expansion.active) {
    return `<div class="dashboard-card"><p>Start expansion process in Step 1 first.</p></div>`;
  }
  
  const newTeams = league.expansion.newTeams || [];
  const numNeeded = league.expansion.settings.numTeams;
  
  return `
    <div class="dashboard-card">
      <div class="dashboard-card-title">🏀 Create Expansion Teams (${newTeams.length}/${numNeeded})</div>
      
      <div class="expansion-teams-grid">
        ${Array.from({ length: numNeeded }).map((_, idx) => {
          const team = newTeams[idx] || {};
          return `
            <div class="expansion-team-card">
              <h4>Team ${idx + 1}</h4>
              <div class="expansion-team-form">
                <input type="text" placeholder="City" value="${team.city || ''}" 
                       id="exp-city-${idx}" onchange="updateExpansionTeam(${idx}, 'city', this.value)" />
                <input type="text" placeholder="Team Name" value="${team.name || ''}" 
                       id="exp-name-${idx}" onchange="updateExpansionTeam(${idx}, 'name', this.value)" />
                <input type="text" placeholder="ABV" value="${team.abbreviation || ''}" maxlength="3"
                       id="exp-abbr-${idx}" onchange="updateExpansionTeam(${idx}, 'abbreviation', this.value.toUpperCase())" />
                
                <select id="exp-conf-${idx}" onchange="updateExpansionTeam(${idx}, 'conference', this.value)">
                  <option value="">Select Conference</option>
                  <option value="Eastern" ${team.conference === 'Eastern' ? 'selected' : ''}>Eastern</option>
                  <option value="Western" ${team.conference === 'Western' ? 'selected' : ''}>Western</option>
                </select>
                
                <input type="text" placeholder="Division" value="${team.division || ''}" 
                       id="exp-div-${idx}" onchange="updateExpansionTeam(${idx}, 'division', this.value)" />
                
                <input type="color" value="${team.primaryColor || '#3b82f6'}" 
                       id="exp-color1-${idx}" onchange="updateExpansionTeam(${idx}, 'primaryColor', this.value)" />
                <input type="color" value="${team.secondaryColor || '#1e293b'}" 
                       id="exp-color2-${idx}" onchange="updateExpansionTeam(${idx}, 'secondaryColor', this.value)" />
                
                <select id="exp-market-${idx}" onchange="updateExpansionTeam(${idx}, 'market', this.value)">
                  <option value="small" ${team.market === 'small' ? 'selected' : ''}>Small Market</option>
                  <option value="medium" ${team.market === 'medium' ? 'selected' : ''}>Medium Market</option>
                  <option value="large" ${team.market === 'large' ? 'selected' : ''}>Large Market</option>
                </select>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      
      <div class="expansion-actions">
        <button class="btn-secondary" onclick="generateRandomExpansionTeams()">Generate Random Teams</button>
        <button class="btn-primary" onclick="validateAndContinueExpansion()">Validate & Continue</button>
      </div>
    </div>
  `;
}

function renderExpansionProtection() {
  if (!league.expansion.active || league.expansion.newTeams.length === 0) {
    return `<div class="dashboard-card"><p>Complete Step 2 first.</p></div>`;
  }
  
  const userTeam = league.teams.find(t => t.id === selectedTeamId);
  const protected = league.expansion.protectedLists[selectedTeamId] || [];
  const limit = league.expansion.settings.protectedPlayersPerTeam;
  
  return `
    <div class="dashboard-card">
      <div class="dashboard-card-title">🛡️ Protection Lists</div>
      
      <!-- User Team Protection -->
      <div class="protection-section">
        <h3>Your Team: ${userTeam.name}</h3>
        <div class="protection-header">
          <span>Protected: ${protected.length} / ${limit}</span>
          <input type="text" placeholder="Search players..." id="protection-search" 
                 onkeyup="filterProtectionList(this.value)" />
        </div>
        
        <div class="protection-list" id="protection-list">
          ${userTeam.players.map(p => {
            const isProtected = protected.includes(p.id);
            const canToggle = isProtected || protected.length < limit;
            return `
              <div class="protection-item ${isProtected ? 'protected' : ''}">
                <div class="protection-player-info">
                  <span class="protection-player-name">${p.name}</span>
                  <span class="protection-player-pos">${p.pos} | ${p.age}y | ${p.ratings.ovr} OVR</span>
                </div>
                <button class="protection-toggle ${isProtected ? 'active' : ''}" 
                        ${!canToggle ? 'disabled' : ''}
                        onclick="togglePlayerProtection(${p.id})">
                  ${isProtected ? '✓ Protected' : 'Unprotected'}
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      
      <!-- CPU Teams Summary -->
      <div class="protection-cpu-section">
        <h3>Other Teams</h3>
        <div class="cpu-protection-grid">
          ${league.teams.filter(t => t.id !== selectedTeamId).map(t => {
            const cpuProtected = league.expansion.protectedLists[t.id] || [];
            return `
              <div class="cpu-protection-card">
                <div class="cpu-team-name">${t.name}</div>
                <div class="cpu-protection-count">${cpuProtected.length}/${limit} protected</div>
                <button class="btn-small" onclick="viewTeamProtection(${t.id})">View</button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      
      <div class="expansion-actions">
        <button class="btn-secondary" onclick="autoGenerateAllProtectionLists()">Auto-Generate All CPU Lists</button>
        <button class="btn-primary" onclick="finalizeProtectionLists()">Finalize Protection Lists</button>
      </div>
    </div>
  `;
}

function renderExpansionDraft() {
  if (!league.expansion.active || Object.keys(league.expansion.protectedLists).length === 0) {
    return `<div class="dashboard-card"><p>Complete Step 3 first.</p></div>`;
  }
  
  const playerPool = buildExpansionPlayerPool();
  const draftResults = league.expansion.draftResults || [];
  const expansionTeams = league.teams.filter(t => 
    league.expansion.newTeams.some(nt => nt.abbreviation === (t.abbreviation || t.name.substring(0, 3)))
  );
  
  return `
    <div class="expansion-draft-container">
      <!-- Left: Draft Board -->
      <div class="expansion-draft-board">
        <h3>Draft Results (${draftResults.length} picks)</h3>
        <div class="draft-results-list">
          ${draftResults.map(pick => `
            <div class="draft-pick-item">
              <span class="pick-number">#${pick.pick}</span>
              <span class="pick-player">${pick.playerName}</span>
              <span class="pick-from">from ${pick.fromTeamName}</span>
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- Center: Available Players -->
      <div class="expansion-player-pool">
        <h3>Available Players (${playerPool.length})</h3>
        <input type="text" placeholder="Search..." id="pool-search" onkeyup="filterPlayerPool(this.value)" />
        <div class="player-pool-list" id="player-pool-list">
          ${playerPool.slice(0, 50).map(p => `
            <div class="pool-player-item" data-player-name="${p.name}">
              <div class="pool-player-info">
                <div class="clickable-player" onclick="showPlayerModal(${p.id})">${p.name} | ${p.pos} | ${p.age}y</div>
                <div class="pool-player-ratings">${p.ratings.ovr} OVR | ${p.ratings.pot} POT</div>
                <div class="pool-player-from">From: ${p.fromTeamName}</div>
              </div>
              <button class="btn-small" onclick="selectExpansionPlayer(${p.id})">Select</button>
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- Right: Expansion Teams -->
      <div class="expansion-teams-rosters">
        <h3>Expansion Teams</h3>
        ${expansionTeams.map(t => `
          <div class="expansion-team-roster">
            <h4>${t.name}</h4>
            <div class="roster-count">${t.players.length}/${league.expansion.settings.rosterSizeLimit}</div>
            <div class="roster-players">
              ${t.players.map(p => `<div class="roster-player-mini">${p.name}</div>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    
    <div class="expansion-actions" style="margin-top: 20px;">
      <button class="btn-secondary" onclick="autoCompleteDraft()">Auto-Complete Draft</button>
      <button class="btn-primary" onclick="finalizeExpansionDraft()">Finalize Expansion</button>
    </div>
  `;
}

/* Expansion Helper Functions */

function switchExpansionStep(step) {
  league.expansion.currentStep = step;
  render();
}

function updateExpansionSetting(key, value) {
  league.expansion.settings[key] = value;
  save();
}

function startExpansion() {
  if (league.phase !== 'offseason') {
    alert('Expansion can only start during offseason');
    return;
  }
  
  league.expansion.active = true;
  league.expansion.currentStep = 2;
  league.expansion.settings.expansionYear = league.expansion.settings.expansionYear || league.season + 1;
  save();
  render();
}

function cancelExpansion() {
  if (!confirm('Cancel expansion? This will reset all progress.')) return;
  
  league.expansion.active = false;
  league.expansion.currentStep = 1;
  league.expansion.newTeams = [];
  league.expansion.protectedLists = {};
  league.expansion.draftResults = [];
  save();
  render();
}

function updateExpansionTeam(idx, field, value) {
  if (!league.expansion.newTeams[idx]) {
    league.expansion.newTeams[idx] = {
      city: '',
      name: '',
      abbreviation: '',
      conference: '',
      division: '',
      primaryColor: '#3b82f6',
      secondaryColor: '#1e293b',
      market: 'medium'
    };
  }
  league.expansion.newTeams[idx][field] = value;
  save();
}

function generateRandomExpansionTeams() {
  const cities = ['Seattle', 'Las Vegas', 'Vancouver', 'Louisville', 'Pittsburgh', 'Kansas City'];
  const names = ['Supersonics', 'Aces', 'Grizzlies', 'Cardinals', 'Riveters', 'Monarchs'];
  const numTeams = league.expansion.settings.numTeams;
  
  league.expansion.newTeams = [];
  for (let i = 0; i < numTeams; i++) {
    const city = cities[i % cities.length];
    const name = names[i % names.length];
    league.expansion.newTeams.push({
      city,
      name,
      abbreviation: name.substring(0, 3).toUpperCase(),
      conference: i % 2 === 0 ? 'Eastern' : 'Western',
      division: i % 2 === 0 ? 'Atlantic' : 'Pacific',
      primaryColor: `#${Math.floor(Math.random()*16777215).toString(16)}`,
      secondaryColor: '#1e293b',
      market: ['small', 'medium', 'large'][Math.floor(Math.random() * 3)]
    });
  }
  save();
  render();
}

function validateAndContinueExpansion() {
  const errors = validateExpansionTeams(league.expansion.newTeams, league.teams);
  
  if (errors.length > 0) {
    alert('Validation errors:\\n' + errors.join('\\n'));
    return;
  }
  
  // Add teams to league
  const nextId = Math.max(...league.teams.map(t => t.id)) + 1;
  league.expansion.newTeams.forEach((teamData, idx) => {
    const fullName = `${teamData.city} ${teamData.name}`;
    const newTeam = makeTeam(nextId + idx, fullName, teamData);
    newTeam.players = [];
    league.teams.push(newTeam);
  });
  
  league.expansion.currentStep = 3;
  save();
  render();
}

function togglePlayerProtection(playerId) {
  const teamId = selectedTeamId;
  if (!league.expansion.protectedLists[teamId]) {
    league.expansion.protectedLists[teamId] = [];
  }
  
  const list = league.expansion.protectedLists[teamId];
  const idx = list.indexOf(playerId);
  
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    if (list.length < league.expansion.settings.protectedPlayersPerTeam) {
      list.push(playerId);
    } else {
      alert('Protection limit reached');
      return;
    }
  }
  
  save();
  render();
}

function filterProtectionList(query) {
  const items = document.querySelectorAll('.protection-item');
  items.forEach(item => {
    const name = item.querySelector('.protection-player-name').textContent.toLowerCase();
    item.style.display = name.includes(query.toLowerCase()) ? 'flex' : 'none';
  });
}

function viewTeamProtection(teamId) {
  const team = league.teams.find(t => t.id === teamId);
  const protected = league.expansion.protectedLists[teamId] || [];
  
  const protectedPlayers = team.players.filter(p => protected.includes(p.id));
  const unprotectedPlayers = team.players.filter(p => !protected.includes(p.id));
  
  const html = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal-container">
        <div class="modal-header">
          <h2>${team.name} - Protection List</h2>
          <button class="modal-close" onclick="closeModal(event)">×</button>
        </div>
        <div class="modal-body">
          <h3>Protected (${protectedPlayers.length})</h3>
          ${protectedPlayers.map(p => `<div>${p.name} | ${p.pos} | ${p.ratings.ovr} OVR</div>`).join('')}
          <h3 style="margin-top: 20px;">Unprotected (${unprotectedPlayers.length})</h3>
          ${unprotectedPlayers.map(p => `<div>${p.name} | ${p.pos} | ${p.ratings.ovr} OVR</div>`).join('')}
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', html);
}

function autoGenerateAllProtectionLists() {
  league.expansion.protectedLists = generateCpuProtectionLists(league.expansion.settings);
  save();
  render();
}

function finalizeProtectionLists() {
  // Ensure all teams have protection lists
  const missingTeams = league.teams.filter(t => !league.expansion.protectedLists[t.id]);
  
  if (missingTeams.length > 0) {
    if (!confirm(`${missingTeams.length} teams don't have protection lists. Auto-generate?`)) {
      return;
    }
    autoGenerateAllProtectionLists();
  }
  
  league.expansion.currentStep = 4;
  save();
  render();
}

function selectExpansionPlayer(playerId) {
  // Find first expansion team with space
  const expansionTeams = league.teams.filter(t => 
    league.expansion.newTeams.some(nt => nt.abbreviation === (t.abbreviation || t.name.substring(0, 3)))
  );
  
  for (const team of expansionTeams) {
    if (team.players.length < league.expansion.settings.rosterSizeLimit) {
      const result = pickExpansionPlayer(team.id, playerId);
      if (result.success) {
        save();
        render();
        return;
      } else {
        alert(result.error);
        return;
      }
    }
  }
  
  alert('All expansion teams are full');
}

function filterPlayerPool(query) {
  const items = document.querySelectorAll('.pool-player-item');
  items.forEach(item => {
    const name = item.dataset.playerName.toLowerCase();
    item.style.display = name.includes(query.toLowerCase()) ? 'flex' : 'none';
  });
}

function autoCompleteDraft() {
  if (!confirm('Auto-complete the expansion draft?')) return;
  
  const expansionTeams = league.teams.filter(t => 
    league.expansion.newTeams.some(nt => nt.abbreviation === (t.abbreviation || t.name.substring(0, 3)))
  );
  
  let picks = 0;
  const maxPicks = 1000; // Safety limit
  
  while (picks < maxPicks) {
    let allFull = true;
    
    for (const team of expansionTeams) {
      if (team.players.length < league.expansion.settings.rosterSizeLimit) {
        allFull = false;
        const result = aiPickExpansionPlayer(team.id);
        if (result.success) {
          picks++;
        } else {
          console.log('AI pick failed:', result.error);
        }
      }
    }
    
    if (allFull) break;
  }
  
  save();
  render();
}

function finalizeExpansionDraft() {
  if (!confirm('Finalize expansion? This cannot be undone.')) return;
  
  finalizeExpansion();
  alert('Expansion completed! New teams added to league.');
  render();
}

/* ============================
   SETTINGS TAB
============================ */

// Settings state
let settingsData = null;
let settingsOriginal = null;
let expandedSettingsSections = new Set(['gameplay', 'cap', 'ai', 'sim', 'ui', 'notifications', 'data', 'commissioner', 'jobsecurity']); // Default open sections

// User preferences (separate from league data)
let userPreferences = {
  darkMode: true,
  compactTables: false,
  stickyHeaders: true,
  autoScrollPlayByPlay: true,
  confirmBeforeSimming: true,
  confirmBeforeTrading: true
};

// Load user preferences from localStorage
function loadUserPreferences() {
  const stored = localStorage.getItem('hoopsDynastyUserPrefs');
  if (stored) {
    try {
      userPreferences = { ...userPreferences, ...JSON.parse(stored) };
    } catch (e) {
      console.error('Failed to load user preferences:', e);
    }
  }
}

// Save user preferences to localStorage
function saveUserPreferences() {
  localStorage.setItem('hoopsDynastyUserPrefs', JSON.stringify(userPreferences));
}

// Initialize settings with defaults for existing leagues
function initSettings(league) {
  // Initialize meta if missing
  if (!league.meta) {
    league.meta = {
      commissionerEnabled: false,
      modified: false
    };
  }
  
  // Initialize commissioner log
  if (!league.commissionerLog) {
    league.commissionerLog = [];
  }
  
  if (!league.rules) {
    league.rules = {
      gamesPerTeam: 82,
      quarterLength: 12,
      overtimeLength: 5,
      playoffTeams: 16,
      playoffSeriesLength: 7,
      draftRounds: 2,
      expansionAllowed: true,
      enableInjuries: true,
      injuryFrequency: 'Normal',
      fatigueImpact: 'Normal',
      moraleImpact: 'Normal'
    };
  }
  
  if (!league.capRules) {
    league.capRules = {
      salaryCap: 123500000,
      luxuryTaxLine: 150000000,
      hardCap: false,
      maxContractPercent: 35,
      rookieScaleEnabled: true,
      allowPlayerOptions: true,
      allowTeamOptions: true,
      allowExtensions: true,
      negotiationDifficulty: 'Normal'
    };
  }
  
  if (!league.aiSettings) {
    league.aiSettings = {
      tradeAggressiveness: 'Normal',
      freeAgencyAggressiveness: 'Normal',
      rosterPatience: 'Normal',
      rebuildTolerance: 'Normal',
      rotationStrictness: 'Normal',
      draftingStyle: 'Balanced'
    };
  }
  
  if (!league.simSettings) {
    league.simSettings = {
      defaultSimSpeed: 'Fast',
      watchLiveSpeed: '2x',
      autoPauseCloseGames: false,
      savePlayByPlay: true,
      saveFullBoxScores: true
    };
  }
  
  if (!league.newsSettings) {
    league.newsSettings = {
      frequency: 'Normal',
      breakingOnly: false,
      myTeamOnly: false,
      alertPopups: true
    };
  }
  
  if (!league.dataSettings) {
    league.dataSettings = {
      autoSaveFrequency: 'Every game',
      backupSaves: true
    };
  }
  
  if (!league.settings) {
    league.settings = {
      enableJobSecurity: false,
      jobSecurityDifficulty: 'realistic',
      allowMidseasonFiring: false
    };
  }
  
  return league;
}

// Initialize settings editor
function initSettingsEditor() {
  initSettings(league);
  settingsOriginal = JSON.parse(JSON.stringify({
    rules: league.rules,
    capRules: league.capRules,
    aiSettings: league.aiSettings,
    simSettings: league.simSettings,
    newsSettings: league.newsSettings,
    dataSettings: league.dataSettings,
    settings: league.settings
  }));
  settingsData = JSON.parse(JSON.stringify(settingsOriginal));
  return settingsData;
}

// Update setting field
function updateSetting(category, field, value) {
  if (!settingsData || !settingsData[category]) return;
  settingsData[category][field] = value;
  render();
}

// Update user preference
function updateUserPreference(field, value) {
  userPreferences[field] = value;
  saveUserPreferences();
  render();
}

// Toggle settings section
function toggleSettingsSection(section) {
  if (expandedSettingsSections.has(section)) {
    expandedSettingsSections.delete(section);
  } else {
    expandedSettingsSections.add(section);
  }
  render();
}

// Save settings
function saveSettings() {
  if (!settingsData || !settingsOriginal) {
    alert('No changes to save');
    return;
  }
  
  // Check for major changes
  const majorChanges = [];
  
  if (settingsData.rules.gamesPerTeam !== settingsOriginal.rules.gamesPerTeam) {
    if (league.phase !== 'preseason') {
      majorChanges.push('Games per team can only be changed in preseason');
    }
  }
  
  if (settingsData.capRules.salaryCap !== settingsOriginal.capRules.salaryCap) {
    majorChanges.push('Salary cap change affects all teams immediately');
  }
  
  if (settingsData.rules.playoffTeams !== settingsOriginal.rules.playoffTeams) {
    majorChanges.push('Playoff format change applies next season');
  }
  
  if (majorChanges.length > 0) {
    if (!confirm(`Important changes detected:\n\n• ${majorChanges.join('\n• ')}\n\nContinue?`)) {
      return;
    }
  }
  
  // Apply changes
  league.rules = settingsData.rules;
  league.capRules = settingsData.capRules;
  league.aiSettings = settingsData.aiSettings;
  league.simSettings = settingsData.simSettings;
  league.newsSettings = settingsData.newsSettings;
  league.dataSettings = settingsData.dataSettings;
  league.settings = settingsData.settings;
  
  save();
  settingsData = null;
  settingsOriginal = null;
  
  alert('Settings saved successfully!');
  render();
}

// Revert settings
function revertSettings() {
  if (confirm('Discard all changes?')) {
    settingsData = null;
    settingsOriginal = null;
    render();
  }
}

// Clear cached UI state
function clearCachedState() {
  if (confirm('Clear all cached UI state? This will reset filters, expanded sections, etc.')) {
    localStorage.removeItem('hoopsDynastyUIState');
    expandedSettingsSections = new Set(['gameplay']);
    alert('Cache cleared!');
    render();
  }
}

// Repair league data
function repairLeagueData() {
  if (!confirm('Run data repair? This will fix missing fields and run migrations.')) return;
  
  initSettings(league);
  initHistoryIfMissing(league);
  initNewsFeed(league);
  
  // Fix any missing team data
  league.teams.forEach(team => {
    if (!team.primaryColor) team.primaryColor = '#2196F3';
    if (!team.secondaryColor) team.secondaryColor = '#1976D2';
    if (!team.arenaCapacity) team.arenaCapacity = 18000;
    if (!team.marketSize) team.marketSize = 'Medium';
  });
  
  save();
  alert('Data repair complete!');
  render();
}

// Export league data
function exportLeague() {
  const data = JSON.stringify(league, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `HOOPS_DYNASTY_${league.season}_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  alert('League exported!');
}

// Import league data
function importLeague() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (!imported.teams || !imported.season) {
          alert('Invalid league file');
          return;
        }
        
        if (!confirm('Import this league? Current league will be replaced.')) return;
        
        league = imported;
        initSettings(league);
        save();
        render();
        alert('League imported successfully!');
      } catch (err) {
        alert('Failed to import league: ' + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

/* ============================
   COMMISSIONER MODE
============================ */

// Commissioner log entry
function logCommissionerAction(actionType, description, entitiesAffected = {}) {
  if (!league.commissionerLog) league.commissionerLog = [];
  
  league.commissionerLog.push({
    id: league.commissionerLog.length + 1,
    day: league.currentDay || 0,
    season: league.season || 1,
    actionType,
    description,
    entitiesAffected,
    timestamp: Date.now()
  });
  
  save();
}

// Enable Commissioner Mode
function enableCommissionerMode() {
  const warning = `
⚠️ COMMISSIONER MODE WARNING ⚠️

Enabling Commissioner Mode gives you full administrative control over:
• League phase advancement
• Team management (all teams)
• Player attributes & contracts
• Draft & transaction overrides
• Financial adjustments

CONSEQUENCES:
• League will be flagged as "Modified"
• All actions will be logged
• Cannot be undone

Do you understand and wish to continue?
  `.trim();
  
  if (!confirm(warning)) return;
  
  if (!league.meta) league.meta = {};
  league.meta.commissionerEnabled = true;
  league.meta.modified = true;
  
  logCommissionerAction('ENABLED', 'Commissioner Mode enabled');
  
  save();
  render();
  alert('Commissioner Mode ENABLED');
}

// Disable Commissioner Mode
function disableCommissionerMode() {
  if (!confirm('Disable Commissioner Mode? You can re-enable it anytime.')) return;
  
  if (!league.meta) league.meta = {};
  league.meta.commissionerEnabled = false;
  
  logCommissionerAction('DISABLED', 'Commissioner Mode disabled');
  
  save();
  render();
  alert('Commissioner Mode DISABLED');
}

// Check if Commissioner Mode is active
function isCommissionerMode() {
  return league?.meta?.commissionerEnabled === true;
}

// Toggle Commissioner Panel
function toggleCommissionerPanel() {
  const panel = document.getElementById('commissionerPanel');
  if (!panel) return;
  
  if (panel.style.display === 'none' || !panel.style.display) {
    panel.style.display = 'block';
  } else {
    panel.style.display = 'none';
  }
}

// Prompt to disable Commissioner Mode from panel
function promptDisableCommissioner() {
  toggleCommissionerPanel();
  disableCommissionerMode();
}

// Close panel when clicking outside
document.addEventListener('click', function(e) {
  const panel = document.getElementById('commissionerPanel');
  const badge = document.getElementById('commissionerBadge');
  
  if (!panel || !badge) return;
  
  // If panel is open and click is outside panel and badge
  if (panel.style.display === 'block' && 
      !panel.contains(e.target) && 
      !badge.contains(e.target)) {
    panel.style.display = 'none';
  }
});

// Commissioner: Advance Phase
function commissionerAdvancePhase() {
  if (!isCommissionerMode()) return;
  
  const phases = ['preseason', 'regular', 'playoffs', 'draft'];
  const currentIndex = phases.indexOf(league.phase);
  const nextPhase = phases[(currentIndex + 1) % phases.length];
  
  if (!confirm(`Advance from ${league.phase} to ${nextPhase}?`)) return;
  
  league.phase = nextPhase;
  logCommissionerAction('PHASE_ADVANCE', `Advanced phase: ${league.phase} → ${nextPhase}`);
  
  save();
  render();
}

// Commissioner: Force Schedule Regeneration
function commissionerForceSchedule() {
  if (!isCommissionerMode()) return;
  if (!confirm('Force schedule regeneration? ⚠️ WARNING: This will reset all remaining games and may affect simulation results.')) return;
  
  // Clear existing schedule
  if (league.schedule && league.schedule.days) {
    league.schedule.days[league.season] = [];
  }
  if (league.schedule && league.schedule.games) {
    // Remove games for current season
    Object.keys(league.schedule.games).forEach(gameId => {
      if (league.schedule.games[gameId].season === league.season) {
        delete league.schedule.games[gameId];
      }
    });
  }
  
  // Regenerate schedule
  generateSchedule();
  
  logCommissionerAction('SCHEDULE_REGEN', 'Forced schedule regeneration');
  save();
  render();
}

// Commissioner: Toggle Injuries
function commissionerToggleInjuries() {
  if (!isCommissionerMode()) return;
  
  league.rules.enableInjuries = !league.rules.enableInjuries;
  const status = league.rules.enableInjuries ? 'enabled' : 'disabled';
  
  logCommissionerAction('TOGGLE_INJURIES', `Injuries ${status}`);
  save();
  render();
  alert(`Injuries ${status}`);
}

// Commissioner: Override Salary Cap
function commissionerOverrideCap() {
  if (!isCommissionerMode()) return;
  
  const newCap = prompt('Enter new salary cap:', league.capRules.salaryCap);
  if (!newCap) return;
  
  const oldCap = league.capRules.salaryCap;
  league.capRules.salaryCap = parseInt(newCap);
  
  logCommissionerAction('CAP_OVERRIDE', `Salary cap changed: $${oldCap} → $${newCap}`);
  save();
  render();
}

// Commissioner: Take Control of Team
function commissionerTakeControl(teamId) {
  if (!isCommissionerMode()) return;
  
  const team = league.teams.find(t => t.id === teamId);
  if (!team) return;
  
  if (!confirm(`Take control of ${team.city} ${team.name}?`)) return;
  
  const oldTeam = league.teams.find(t => t.id === league.userTeamId);
  league.userTeamId = teamId;
  
  logCommissionerAction('TAKE_CONTROL', `Switched from ${oldTeam?.name || 'N/A'} to ${team.name}`, { teamId });
  save();
  render();
}

// Commissioner: Edit Player Attribute
function commissionerEditPlayer(playerId) {
  if (!isCommissionerMode()) return;
  
  const player = findPlayerById(playerId);
  if (!player) return;
  
  const field = prompt('Edit field (ovr/pot/age/salary):', 'ovr');
  if (!field) return;
  
  let newValue;
  if (field === 'ovr' || field === 'pot' || field === 'age') {
    newValue = parseInt(prompt(`New ${field.toUpperCase()} for ${player.name}:`, player.ratings[field] || player[field]));
    if (isNaN(newValue)) return;
    
    if (field === 'age') {
      player.age = newValue;
    } else {
      player.ratings[field] = newValue;
    }
  } else if (field === 'salary') {
    newValue = parseFloat(prompt(`New salary for ${player.name} (millions):`, player.contract?.amount || 0));
    if (isNaN(newValue)) return;
    
    if (!player.contract) player.contract = {};
    player.contract.amount = newValue * 1000000;
  }
  
  logCommissionerAction('EDIT_PLAYER', `${player.name}: ${field} = ${newValue}`, { playerId });
  save();
  render();
}

// Commissioner: Move Player
function commissionerMovePlayer(playerId, toTeamId) {
  if (!isCommissionerMode()) return;
  
  const player = findPlayerById(playerId);
  if (!player) return;
  
  const fromTeam = league.teams.find(t => t.id === player.teamId);
  const toTeam = league.teams.find(t => t.id === toTeamId);
  
  if (!toTeam) return;
  if (!confirm(`Move ${player.name} from ${fromTeam?.name || 'FA'} to ${toTeam.name}?`)) return;
  
  player.teamId = toTeamId;
  
  logCommissionerAction('MOVE_PLAYER', `${player.name}: ${fromTeam?.name || 'FA'} → ${toTeam.name}`, { 
    playerId, 
    fromTeamId: fromTeam?.id, 
    toTeamId 
  });
  
  save();
  render();
}

// Commissioner: Force Injury
function commissionerForceInjury(playerId) {
  if (!isCommissionerMode()) return;
  
  const player = findPlayerById(playerId);
  if (!player) return;
  
  const days = parseInt(prompt(`Injury duration for ${player.name} (days):`, 14));
  if (isNaN(days) || days <= 0) return;
  
  player.injury = {
    type: 'Commissioner Override',
    gamesRemaining: Math.ceil(days / 3),
    severity: days > 30 ? 'major' : 'minor'
  };
  
  logCommissionerAction('FORCE_INJURY', `${player.name} injured for ${days} days`, { playerId });
  save();
  render();
}

// Commissioner: Heal Injury
function commissionerHealInjury(playerId) {
  if (!isCommissionerMode()) return;
  
  const player = findPlayerById(playerId);
  if (!player) return;
  
  if (!confirm(`Heal ${player.name}'s injury?`)) return;
  
  player.injury = null;
  
  logCommissionerAction('HEAL_INJURY', `${player.name} healed`, { playerId });
  save();
  render();
}

// Commissioner: Force Trade
function commissionerForceTrade() {
  if (!isCommissionerMode()) return;
  alert('Force trade feature - integrate with existing trade logic');
  // This would integrate with existing trade system
}

// Commissioner: Force Signing
function commissionerForceSigning(playerId, teamId) {
  if (!isCommissionerMode()) return;
  
  const player = findPlayerById(playerId);
  const team = league.teams.find(t => t.id === teamId);
  
  if (!player || !team) return;
  if (!confirm(`Force ${player.name} to sign with ${team.name}?`)) return;
  
  player.teamId = teamId;
  if (!player.contract) player.contract = {};
  player.contract.amount = 5000000;
  player.contract.exp = league.season + 2;
  
  logCommissionerAction('FORCE_SIGNING', `${player.name} signed with ${team.name}`, { playerId, teamId });
  save();
  render();
}

/* ============================
   COMMISSIONER TOOLS - EXPANDED
   Add Player, Delete Player, Force Trade, Force Injury
============================ */

// Helper: Generate unique player ID
function generatePlayerId() {
  if (!league) return 1;
  
  let maxId = 0;
  
  // Check team players
  league.teams.forEach(team => {
    if (team.players) {
      team.players.forEach(p => {
        if (p.id > maxId) maxId = p.id;
      });
    }
  });
  
  // Check free agents
  if (league.freeAgents) {
    league.freeAgents.forEach(p => {
      if (p.id > maxId) maxId = p.id;
    });
  }
  
  return maxId + 1;
}

// Helper: Add news item to feed
function addNewsItem(title, description, category = 'transaction') {
  if (!league.news) league.news = [];
  
  league.news.unshift({
    id: Date.now() + Math.random(),
    season: league.season,
    day: league.currentDay || 0,
    title,
    description,
    category,
    timestamp: Date.now()
  });
  
  // Keep only last 100 news items
  if (league.news.length > 100) {
    league.news = league.news.slice(0, 100);
  }
}

/* ============================
   A) ADD PLAYER
============================ */

function showAddPlayerModal() {
  if (!isCommissionerMode()) {
    alert('⚠️ Commissioner Mode must be enabled to add players.');
    return;
  }
  
  // Build team options
  const teamOptions = [
    '<option value="fa">Free Agent</option>',
    ...league.teams.map(t => `
      <option value="${t.id}">${t.city} ${t.name}</option>
    `)
  ].join('');
  
  const modalHTML = `
    <div id="addPlayerModal" class="modal" style="display: flex;" onclick="if(event.target.id === 'addPlayerModal') closeAddPlayerModal()">
      <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #334155;">
          <h2 style="margin: 0; color: #fff;">➕ Add New Player</h2>
          <button onclick="closeAddPlayerModal()" style="
            background: transparent;
            color: #888;
            border: none;
            cursor: pointer;
            font-size: 2em;
            line-height: 1;
            padding: 0;
          ">×</button>
        </div>
        
        <form id="addPlayerForm" onsubmit="saveNewPlayer(event); return false;">
          <!-- 1) Identity -->
          <div class="edit-section">
            <h3 style="color: #3b82f6; margin-bottom: 15px;">👤 Identity</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="edit-field">
                <label>First Name</label>
                <input type="text" id="add_firstName" required style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              
              <div class="edit-field">
                <label>Last Name</label>
                <input type="text" id="add_lastName" required style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
              <div class="edit-field">
                <label>Position</label>
                <select id="add_pos" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
                  <option value="PG">PG</option>
                  <option value="SG">SG</option>
                  <option value="SF">SF</option>
                  <option value="PF">PF</option>
                  <option value="C">C</option>
                </select>
              </div>
              
              <div class="edit-field">
                <label>Age</label>
                <input type="number" id="add_age" value="22" min="18" max="45" required style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              
              <div class="edit-field">
                <label>Gender</label>
                <select id="add_gender" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
            </div>
          </div>
          
          <!-- 2) Body -->
          <div class="edit-section">
            <h3 style="color: #3b82f6; margin-bottom: 15px;">📏 Physical Attributes</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
              <div class="edit-field">
                <label>Height (inches)</label>
                <input type="number" id="add_height" value="78" min="60" max="96" required style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
                <small style="color: #888;">6'6" = 78 inches</small>
              </div>
              
              <div class="edit-field">
                <label>Weight (lbs)</label>
                <input type="number" id="add_weight" value="210" min="120" max="350" required style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              
              <div class="edit-field">
                <label>Wingspan (inches)</label>
                <input type="number" id="add_wingspan" value="82" min="60" max="100" required style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
            </div>
          </div>
          
          <!-- 3) Ratings -->
          <div class="edit-section">
            <h3 style="color: #3b82f6; margin-bottom: 15px;">⭐ Ratings</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="edit-field">
                <label>Overall (OVR)</label>
                <input type="number" id="add_ovr" value="75" min="0" max="99" required style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              
              <div class="edit-field">
                <label>Potential (POT)</label>
                <input type="number" id="add_pot" value="80" min="0" max="99" required style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
            </div>
          </div>
          
          <!-- 4) Contract -->
          <div class="edit-section">
            <h3 style="color: #3b82f6; margin-bottom: 15px;">💰 Contract</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
              <div class="edit-field">
                <label>Salary ($ millions)</label>
                <input type="number" id="add_salary" value="5" min="0" max="60" step="0.1" required style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              
              <div class="edit-field">
                <label>Years</label>
                <input type="number" id="add_years" value="2" min="0" max="6" required style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              
              <div class="edit-field">
                <label>Contract Type</label>
                <select id="add_contractType" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
                  <option value="guaranteed">Guaranteed</option>
                  <option value="partial">Partially Guaranteed</option>
                  <option value="non-guaranteed">Non-Guaranteed</option>
                </select>
              </div>
            </div>
          </div>
          
          <!-- 5) Destination -->
          <div class="edit-section">
            <h3 style="color: #3b82f6; margin-bottom: 15px;">🏀 Team Assignment</h3>
            
            <div class="edit-field">
              <label>Destination Team</label>
              <select id="add_team" style="
                width: 100%;
                padding: 12px;
                background: #1e293b;
                border: 1px solid #334155;
                border-radius: 6px;
                color: #fff;
                font-size: 14px;
              ">
                ${teamOptions}
              </select>
            </div>
          </div>
          
          <!-- 6) Draft Info (Optional) -->
          <div class="edit-section">
            <h3 style="color: #3b82f6; margin-bottom: 15px;">📋 Draft Info (Optional)</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
              <div class="edit-field">
                <label>Draft Year</label>
                <input type="number" id="add_draftYear" placeholder="Leave blank if undrafted" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              
              <div class="edit-field">
                <label>Round</label>
                <input type="number" id="add_round" placeholder="1-2" min="1" max="2" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              
              <div class="edit-field">
                <label>Pick</label>
                <input type="number" id="add_pick" placeholder="1-60" min="1" max="60" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
            </div>
          </div>
          
          <!-- Submit -->
          <div style="display: flex; gap: 12px; margin-top: 25px;">
            <button type="submit" style="
              flex: 1;
              padding: 15px;
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
              color: #fff;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-weight: bold;
              font-size: 1.1em;
            ">✅ Create Player</button>
            
            <button type="button" onclick="closeAddPlayerModal()" style="
              flex: 1;
              padding: 15px;
              background: #334155;
              color: #fff;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-weight: bold;
            ">❌ Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeAddPlayerModal() {
  const modal = document.getElementById('addPlayerModal');
  if (modal) modal.remove();
}

function saveNewPlayer(event) {
  event.preventDefault();
  
  if (!isCommissionerMode()) return;
  
  // Gather form data
  const firstName = document.getElementById('add_firstName').value.trim();
  const lastName = document.getElementById('add_lastName').value.trim();
  const pos = document.getElementById('add_pos').value;
  const age = parseInt(document.getElementById('add_age').value);
  const gender = document.getElementById('add_gender').value;
  const heightInches = parseInt(document.getElementById('add_height').value);
  const weightLbs = parseInt(document.getElementById('add_weight').value);
  const wingspanInches = parseInt(document.getElementById('add_wingspan').value);
  const ovr = parseInt(document.getElementById('add_ovr').value);
  const pot = parseInt(document.getElementById('add_pot').value);
  const salary = parseFloat(document.getElementById('add_salary').value);
  const years = parseInt(document.getElementById('add_years').value);
  const contractType = document.getElementById('add_contractType').value;
  const teamValue = document.getElementById('add_team').value;
  const draftYear = document.getElementById('add_draftYear').value ? parseInt(document.getElementById('add_draftYear').value) : null;
  const round = document.getElementById('add_round').value ? parseInt(document.getElementById('add_round').value) : null;
  const pick = document.getElementById('add_pick').value ? parseInt(document.getElementById('add_pick').value) : null;
  
  // Validate
  if (!firstName || !lastName) {
    alert('First and last name are required');
    return;
  }
  
  // Clamp values
  const clampedOvr = Math.max(0, Math.min(99, ovr));
  const clampedPot = Math.max(0, Math.min(99, pot));
  const clampedHeight = Math.max(60, Math.min(96, heightInches));
  const clampedWeight = Math.max(120, Math.min(350, weightLbs));
  const clampedWingspan = Math.max(60, Math.min(100, wingspanInches));
  
  // Generate unique ID
  const pid = generatePlayerId();
  
  // Helper to convert inches to feet-inches
  const inchesToFeetInches = (inches) => {
    const feet = Math.floor(inches / 12);
    const remainingInches = Math.round(inches % 12);
    return `${feet}'${remainingInches}"`;
  };
  
  // Create player object
  const newPlayer = {
    id: pid,
    name: `${firstName} ${lastName}`,
    age,
    pos,
    gender,
    bio: {
      height: inchesToFeetInches(clampedHeight),
      heightInches: clampedHeight,
      weight: `${clampedWeight} lbs`,
      weightLbs: clampedWeight,
      wingspan: inchesToFeetInches(clampedWingspan),
      wingspanInches: clampedWingspan,
      country: 'USA',
      college: 'N/A',
      hometown: 'N/A'
    },
    ratings: {
      ovr: clampedOvr,
      pot: clampedPot,
      shoot: clampedOvr,
      defense: clampedOvr,
      rebound: clampedOvr,
      passing: clampedOvr
    },
    contract: years > 0 ? {
      amount: salary * 1000000,
      exp: league.season + years,
      yearsRemaining: years,
      totalValue: salary * years * 1000000,
      startYear: league.season,
      type: contractType,
      hasPlayerOption: false,
      hasTeamOption: false
    } : null,
    draft: {
      year: draftYear,
      round: round,
      pick: pick,
      draftedByTid: teamValue !== 'fa' ? parseInt(teamValue) : null
    },
    attributes: {
      athletic: {
        speed: clampedOvr,
        acceleration: clampedOvr,
        strength: clampedOvr,
        vertical: clampedOvr,
        lateralQuickness: clampedOvr,
        stamina: clampedOvr,
        hustle: clampedOvr
      },
      offensive: {
        scoringSkills: {
          finishing: clampedOvr,
          midRangeShooting: clampedOvr,
          threePointShooting: clampedOvr,
          freeThrowShooting: clampedOvr,
          postScoring: clampedOvr,
          shotCreation: clampedOvr
        },
        playmakingSkills: {
          ballHandling: clampedOvr,
          passingVision: clampedOvr,
          passingAccuracy: clampedOvr,
          offBallMovement: clampedOvr
        }
      },
      defensive: {
        perimeterDefense: clampedOvr,
        interiorDefense: clampedOvr,
        blockRating: clampedOvr,
        stealRating: clampedOvr,
        defensiveRebounding: clampedOvr,
        offensiveRebounding: clampedOvr,
        defensiveAwareness: clampedOvr
      },
      mental: {
        basketballIQ: clampedOvr,
        consistency: clampedOvr,
        workEthic: clampedOvr,
        leadership: clampedOvr,
        composure: clampedOvr,
        discipline: clampedOvr,
        clutch: clampedOvr
      }
    },
    personality: {
      currentSatisfactionPct: 75,
      satisfactionLabel: 'Content',
      loyalty: 70,
      moneyFocus: 60,
      winningDrive: 80,
      playingTimeDesire: 65,
      teamPlayer: 70,
      workEthic: 75,
      ego: 60,
      temperament: 70
    },
    stats: {
      gp: 0,
      pts: 0,
      reb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      tov: 0,
      fg: 0,
      fga: 0,
      fg3: 0,
      fg3a: 0,
      ft: 0,
      fta: 0,
      min: 0
    }
  };
  
  // Add to team or free agents
  if (teamValue === 'fa') {
    if (!league.freeAgents) league.freeAgents = [];
    league.freeAgents.push(newPlayer);
  } else {
    const teamId = parseInt(teamValue);
    const team = league.teams.find(t => t.id === teamId);
    if (team) {
      if (!team.players) team.players = [];
      team.players.push(newPlayer);
    } else {
      alert('Team not found!');
      return;
    }
  }
  
  // Log action
  const destination = teamValue === 'fa' ? 'Free Agents' : league.teams.find(t => t.id === parseInt(teamValue))?.name;
  logCommissionerAction('ADD_PLAYER', `Created ${newPlayer.name} (${pos}, ${clampedOvr} OVR) → ${destination}`, { playerId: pid, teamId: teamValue });
  
  // Add news item
  addNewsItem(
    `Commissioner Added Player`,
    `${newPlayer.name} (${pos}, ${clampedOvr} OVR) was added to ${destination}`,
    'commissioner'
  );
  
  // Invalidate strength cache
  incrementStrengthVersion();
  
  // Save and refresh
  save();
  render();
  closeAddPlayerModal();
  
  alert(`✅ ${newPlayer.name} created successfully!`);
}

/* ============================
   B) DELETE PLAYER
============================ */

function showDeletePlayerModal(playerId) {
  if (!isCommissionerMode()) {
    alert('⚠️ Commissioner Mode must be enabled to delete players.');
    return;
  }
  
  // Find player
  let player = null;
  let currentTeam = null;
  
  for (let team of league.teams) {
    const p = team.players?.find(pl => pl.id === playerId);
    if (p) {
      player = p;
      currentTeam = team;
      break;
    }
  }
  
  if (!player && league.freeAgents) {
    player = league.freeAgents.find(p => p.id === playerId);
  }
  
  if (!player) {
    alert('Player not found');
    return;
  }
  
  const modalHTML = `
    <div id="deletePlayerModal" class="modal" style="display: flex;" onclick="if(event.target.id === 'deletePlayerModal') closeDeletePlayerModal()">
      <div class="modal-content" style="max-width: 600px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #334155;">
          <h2 style="margin: 0; color: #e74c3c;">🗑️ Delete Player</h2>
          <button onclick="closeDeletePlayerModal()" style="
            background: transparent;
            color: #888;
            border: none;
            cursor: pointer;
            font-size: 2em;
            line-height: 1;
            padding: 0;
          ">×</button>
        </div>
        
        <div style="
          padding: 20px;
          background: #f39c12;
          color: #000;
          border-radius: 8px;
          margin-bottom: 20px;
          font-weight: bold;
        ">
          ⚠️ WARNING: This action cannot be undone!
        </div>
        
        <div style="margin-bottom: 25px;">
          <h3 style="color: #fff; margin-bottom: 10px;">Player to Delete:</h3>
          <div style="
            padding: 15px;
            background: #1e293b;
            border-radius: 8px;
            border-left: 4px solid #e74c3c;
          ">
            <div style="color: #fff; font-size: 1.2em; font-weight: bold; margin-bottom: 5px;">
              ${player.name}
            </div>
            <div style="color: #888; font-size: 0.9em;">
              ${player.pos} • ${player.age} years old • ${player.ratings?.ovr || 0} OVR<br>
              Team: ${currentTeam ? currentTeam.name : 'Free Agent'}
            </div>
          </div>
        </div>
        
        <div style="margin-bottom: 25px;">
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
            <input type="checkbox" id="confirmDelete" style="width: 20px; height: 20px;">
            <span style="color: #fff; font-weight: bold;">I understand this player will be permanently deleted</span>
          </label>
        </div>
        
        <div style="display: flex; gap: 12px;">
          <button onclick="confirmDeletePlayer(${playerId})" style="
            flex: 1;
            padding: 15px;
            background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
            color: #fff;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            font-size: 1.1em;
          ">🗑️ Delete Player</button>
          
          <button onclick="closeDeletePlayerModal()" style="
            flex: 1;
            padding: 15px;
            background: #334155;
            color: #fff;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
          ">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeDeletePlayerModal() {
  const modal = document.getElementById('deletePlayerModal');
  if (modal) modal.remove();
}

function confirmDeletePlayer(playerId) {
  if (!isCommissionerMode()) return;
  
  const checkbox = document.getElementById('confirmDelete');
  if (!checkbox || !checkbox.checked) {
    alert('⚠️ Please confirm deletion by checking the checkbox');
    return;
  }
  
  // Find and remove player
  let playerName = 'Unknown';
  let teamName = 'Unknown';
  let found = false;
  
  // Check teams
  for (let team of league.teams) {
    const index = team.players?.findIndex(p => p.id === playerId);
    if (index !== undefined && index >= 0) {
      playerName = team.players[index].name;
      teamName = team.name;
      team.players.splice(index, 1);
      found = true;
      break;
    }
  }
  
  // Check free agents
  if (!found && league.freeAgents) {
    const index = league.freeAgents.findIndex(p => p.id === playerId);
    if (index >= 0) {
      playerName = league.freeAgents[index].name;
      teamName = 'Free Agents';
      league.freeAgents.splice(index, 1);
      found = true;
    }
  }
  
  if (!found) {
    alert('Player not found');
    return;
  }
  
  // Log action
  logCommissionerAction('DELETE_PLAYER', `Deleted ${playerName} from ${teamName}`, { playerId });
  
  // Add news item
  addNewsItem(
    `Commissioner Deleted Player`,
    `${playerName} was removed from the league`,
    'commissioner'
  );
  
  // Invalidate strength cache
  incrementStrengthVersion();
  
  // Save and refresh
  save();
  render();
  closeDeletePlayerModal();
  
  alert(`✅ ${playerName} has been deleted from the league.`);
}

/* ============================
   C) FORCE TRADE
============================ */

function showForceTradeModal() {
  if (!isCommissionerMode()) {
    alert('⚠️ Commissioner Mode must be enabled to force trades.');
    return;
  }
  
  const teamOptions = league.teams.map(t => `
    <option value="${t.id}">${t.city} ${t.name}</option>
  `).join('');
  
  const modalHTML = `
    <div id="forceTradeModal" class="modal" style="display: flex;" onclick="if(event.target.id === 'forceTradeModal') closeForceTradeModal()">
      <div class="modal-content" style="max-width: 1000px; max-height: 90vh; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #334155;">
          <h2 style="margin: 0; color: #fff;">🔄 Force Trade</h2>
          <button onclick="closeForceTradeModal()" style="
            background: transparent;
            color: #888;
            border: none;
            cursor: pointer;
            font-size: 2em;
            line-height: 1;
            padding: 0;
          ">×</button>
        </div>
        
        <div style="margin-bottom: 25px;">
          <h3 style="color: #3b82f6; margin-bottom: 15px;">Select Teams</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div>
              <label style="color: #fff; font-weight: bold; display: block; margin-bottom: 8px;">Team A</label>
              <select id="trade_teamA" onchange="loadTeamPlayers('A')" style="
                width: 100%;
                padding: 12px;
                background: #1e293b;
                border: 1px solid #334155;
                border-radius: 6px;
                color: #fff;
                font-size: 14px;
              ">
                <option value="">-- Select Team A --</option>
                ${teamOptions}
              </select>
            </div>
            
            <div>
              <label style="color: #fff; font-weight: bold; display: block; margin-bottom: 8px;">Team B</label>
              <select id="trade_teamB" onchange="loadTeamPlayers('B')" style="
                width: 100%;
                padding: 12px;
                background: #1e293b;
                border: 1px solid #334155;
                border-radius: 6px;
                color: #fff;
                font-size: 14px;
              ">
                <option value="">-- Select Team B --</option>
                ${teamOptions}
              </select>
            </div>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;">
          <div>
            <h3 style="color: #3b82f6; margin-bottom: 10px;">Team A Assets</h3>
            <div id="teamA_players" style="
              background: #1e293b;
              border: 1px solid #334155;
              border-radius: 8px;
              padding: 15px;
              min-height: 200px;
              max-height: 400px;
              overflow-y: auto;
            ">
              <div style="color: #888; text-align: center; padding: 40px;">
                Select Team A to see players
              </div>
            </div>
          </div>
          
          <div>
            <h3 style="color: #3b82f6; margin-bottom: 10px;">Team B Assets</h3>
            <div id="teamB_players" style="
              background: #1e293b;
              border: 1px solid #334155;
              border-radius: 8px;
              padding: 15px;
              min-height: 200px;
              max-height: 400px;
              overflow-y: auto;
            ">
              <div style="color: #888; text-align: center; padding: 40px;">
                Select Team B to see players
              </div>
            </div>
          </div>
        </div>
        
        <div style="margin-bottom: 25px;">
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; margin-bottom: 10px;">
            <input type="checkbox" id="trade_ignoreRules" checked style="width: 18px; height: 18px;">
            <span style="color: #fff;">Ignore salary cap and trade rules</span>
          </label>
          
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
            <input type="checkbox" id="trade_updateRotation" checked style="width: 18px; height: 18px;">
            <span style="color: #fff;">Automatically update team needs and rotations</span>
          </label>
        </div>
        
        <div style="display: flex; gap: 12px;">
          <button onclick="executeForceTradeExecute()" style="
            flex: 1;
            padding: 15px;
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            color: #fff;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            font-size: 1.1em;
          ">✅ Execute Trade</button>
          
          <button onclick="closeForceTradeModal()" style="
            flex: 1;
            padding: 15px;
            background: #334155;
            color: #fff;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
          ">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeForceTradeModal() {
  const modal = document.getElementById('forceTradeModal');
  if (modal) modal.remove();
}

function loadTeamPlayers(side) {
  const selectId = `trade_team${side}`;
  const containerId = `team${side}_players`;
  
  const teamId = parseInt(document.getElementById(selectId).value);
  const container = document.getElementById(containerId);
  
  if (!teamId) {
    container.innerHTML = `<div style="color: #888; text-align: center; padding: 40px;">Select Team ${side} to see players</div>`;
    return;
  }
  
  const team = league.teams.find(t => t.id === teamId);
  if (!team || !team.players || team.players.length === 0) {
    container.innerHTML = `<div style="color: #888; text-align: center; padding: 20px;">No players on this team</div>`;
    return;
  }
  
  const playersHTML = team.players.map(p => `
    <label style="
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      background: #0f172a;
      border-radius: 6px;
      margin-bottom: 8px;
      cursor: pointer;
    " onmouseover="this.style.background='#1e293b'" onmouseout="this.style.background='#0f172a'">
      <input type="checkbox" class="trade-player-${side}" data-player-id="${p.id}" style="width: 18px; height: 18px;">
      <div style="flex: 1;">
        <div style="color: #fff; font-weight: bold;">${p.name}</div>
        <div style="color: #888; font-size: 0.85em;">
          ${p.pos} • ${p.ratings?.ovr || 0} OVR • $${((p.contract?.amount || 0) / 1000000).toFixed(1)}M
        </div>
      </div>
    </label>
  `).join('');
  
  container.innerHTML = playersHTML;
}

function executeForceTradeExecute() {
  if (!isCommissionerMode()) return;
  
  const teamAId = parseInt(document.getElementById('trade_teamA').value);
  const teamBId = parseInt(document.getElementById('trade_teamB').value);
  
  if (!teamAId || !teamBId) {
    alert('Please select both teams');
    return;
  }
  
  if (teamAId === teamBId) {
    alert('Cannot trade with the same team');
    return;
  }
  
  const teamA = league.teams.find(t => t.id === teamAId);
  const teamB = league.teams.find(t => t.id === teamBId);
  
  if (!teamA || !teamB) {
    alert('Teams not found');
    return;
  }
  
  // Get selected players
  const playersACheckboxes = document.querySelectorAll('.trade-player-A:checked');
  const playersBCheckboxes = document.querySelectorAll('.trade-player-B:checked');
  
  const playersAIds = Array.from(playersACheckboxes).map(cb => parseInt(cb.getAttribute('data-player-id')));
  const playersBIds = Array.from(playersBCheckboxes).map(cb => parseInt(cb.getAttribute('data-player-id')));
  
  if (playersAIds.length === 0 && playersBIds.length === 0) {
    alert('Please select at least one player to trade');
    return;
  }
  
  if (!confirm(`Execute trade?\n\n${teamA.name} sends: ${playersAIds.length} player(s)\n${teamB.name} sends: ${playersBIds.length} player(s)`)) {
    return;
  }
  
  // Execute trade: Move players
  const playersA = [];
  const playersB = [];
  
  // Move players from A to B
  for (let pid of playersAIds) {
    const index = teamA.players.findIndex(p => p.id === pid);
    if (index >= 0) {
      const player = teamA.players.splice(index, 1)[0];
      playersA.push(player.name);
      teamB.players.push(player);
    }
  }
  
  // Move players from B to A
  for (let pid of playersBIds) {
    const index = teamB.players.findIndex(p => p.id === pid);
    if (index >= 0) {
      const player = teamB.players.splice(index, 1)[0];
      playersB.push(player.name);
      teamA.players.push(player);
    }
  }
  
  // Log action
  const description = `Trade: ${teamA.name} ↔ ${teamB.name}\n${teamA.name} receives: ${playersB.join(', ') || 'None'}\n${teamB.name} receives: ${playersA.join(', ') || 'None'}`;
  logCommissionerAction('FORCE_TRADE', description, { teamAId, teamBId, playersAIds, playersBIds });
  
  // Add news item
  addNewsItem(
    `Commissioner Forced Trade`,
    `${teamA.name} and ${teamB.name} completed a commissioner-mandated trade`,
    'commissioner'
  );
  
  // Invalidate strength cache
  incrementStrengthVersion();
  
  // Save and refresh
  save();
  render();
  closeForceTradeModal();
  
  alert(`✅ Trade executed successfully!\n\n${description}`);
}

/* ============================
   D) FORCE INJURY
============================ */

function showForceInjuryModal(playerId) {
  if (!isCommissionerMode()) {
    alert('⚠️ Commissioner Mode must be enabled to force injuries.');
    return;
  }
  
  // Find player
  let player = null;
  let currentTeam = null;
  
  for (let team of league.teams) {
    const p = team.players?.find(pl => pl.id === playerId);
    if (p) {
      player = p;
      currentTeam = team;
      break;
    }
  }
  
  if (!player && league.freeAgents) {
    player = league.freeAgents.find(p => p.id === playerId);
  }
  
  if (!player) {
    alert('Player not found');
    return;
  }
  
  const modalHTML = `
    <div id="forceInjuryModal" class="modal" style="display: flex;" onclick="if(event.target.id === 'forceInjuryModal') closeForceInjuryModal()">
      <div class="modal-content" style="max-width: 600px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #334155;">
          <h2 style="margin: 0; color: #e74c3c;">🏥 Force Injury</h2>
          <button onclick="closeForceInjuryModal()" style="
            background: transparent;
            color: #888;
            border: none;
            cursor: pointer;
            font-size: 2em;
            line-height: 1;
            padding: 0;
          ">×</button>
        </div>
        
        <div style="margin-bottom: 25px;">
          <h3 style="color: #fff; margin-bottom: 10px;">Player</h3>
          <div style="
            padding: 15px;
            background: #1e293b;
            border-radius: 8px;
            border-left: 4px solid #3b82f6;
          ">
            <div style="color: #fff; font-size: 1.2em; font-weight: bold; margin-bottom: 5px;">
              ${player.name}
            </div>
            <div style="color: #888; font-size: 0.9em;">
              ${player.pos} • ${player.age} years old • ${player.ratings?.ovr || 0} OVR<br>
              Team: ${currentTeam ? currentTeam.name : 'Free Agent'}
            </div>
          </div>
        </div>
        
        <form id="forceInjuryForm" onsubmit="executeForceInjury(event, ${playerId}); return false;">
          <div style="margin-bottom: 20px;">
            <label style="color: #fff; font-weight: bold; display: block; margin-bottom: 8px;">Injury Type</label>
            <select id="injury_type" style="
              width: 100%;
              padding: 12px;
              background: #1e293b;
              border: 1px solid #334155;
              border-radius: 6px;
              color: #fff;
              font-size: 14px;
            ">
              <option value="Ankle Sprain">Ankle Sprain</option>
              <option value="Knee Strain">Knee Strain</option>
              <option value="Hamstring Strain">Hamstring Strain</option>
              <option value="Shoulder Injury">Shoulder Injury</option>
              <option value="Back Spasms">Back Spasms</option>
              <option value="Concussion">Concussion</option>
              <option value="Fracture">Fracture</option>
              <option value="Torn Ligament">Torn Ligament</option>
              <option value="Illness">Illness</option>
              <option value="Custom">Custom</option>
            </select>
          </div>
          
          <div id="customInjuryContainer" style="margin-bottom: 20px; display: none;">
            <label style="color: #fff; font-weight: bold; display: block; margin-bottom: 8px;">Custom Injury Name</label>
            <input type="text" id="injury_custom" placeholder="Enter custom injury name" style="
              width: 100%;
              padding: 12px;
              background: #1e293b;
              border: 1px solid #334155;
              border-radius: 6px;
              color: #fff;
            ">
          </div>
          
          <div style="margin-bottom: 20px;">
            <label style="color: #fff; font-weight: bold; display: block; margin-bottom: 8px;">Severity</label>
            <select id="injury_severity" onchange="updateInjuryDuration()" style="
              width: 100%;
              padding: 12px;
              background: #1e293b;
              border: 1px solid #334155;
              border-radius: 6px;
              color: #fff;
              font-size: 14px;
            ">
              <option value="minor">Minor (1-2 weeks)</option>
              <option value="moderate">Moderate (2-6 weeks)</option>
              <option value="severe">Severe (6-12 weeks)</option>
              <option value="season-ending">Season Ending</option>
            </select>
          </div>
          
          <div style="margin-bottom: 20px;">
            <label style="color: #fff; font-weight: bold; display: block; margin-bottom: 8px;">
              Duration (games out)
            </label>
            <input type="number" id="injury_games" value="5" min="1" max="100" required style="
              width: 100%;
              padding: 12px;
              background: #1e293b;
              border: 1px solid #334155;
              border-radius: 6px;
              color: #fff;
              font-size: 14px;
            ">
            <small style="color: #888;">Typical: ~3 games per week</small>
          </div>
          
          <div style="display: flex; gap: 12px; margin-top: 25px;">
            <button type="submit" style="
              flex: 1;
              padding: 15px;
              background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
              color: #fff;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-weight: bold;
              font-size: 1.1em;
            ">🏥 Apply Injury</button>
            
            <button type="button" onclick="closeForceInjuryModal()" style="
              flex: 1;
              padding: 15px;
              background: #334155;
              color: #fff;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-weight: bold;
            ">Cancel</button>
          </div>
        </form>
      </div>
    </div>
    
    <script>
      // Show/hide custom injury input
      document.getElementById('injury_type').addEventListener('change', function() {
        const customContainer = document.getElementById('customInjuryContainer');
        customContainer.style.display = this.value === 'Custom' ? 'block' : 'none';
      });
    </script>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeForceInjuryModal() {
  const modal = document.getElementById('forceInjuryModal');
  if (modal) modal.remove();
}

function updateInjuryDuration() {
  const severity = document.getElementById('injury_severity').value;
  const gamesInput = document.getElementById('injury_games');
  
  switch (severity) {
    case 'minor':
      gamesInput.value = 5;
      break;
    case 'moderate':
      gamesInput.value = 15;
      break;
    case 'severe':
      gamesInput.value = 30;
      break;
    case 'season-ending':
      gamesInput.value = 82;
      break;
  }
}

function executeForceInjury(event, playerId) {
  event.preventDefault();
  
  if (!isCommissionerMode()) return;
  
  // Find player
  let player = null;
  
  for (let team of league.teams) {
    const p = team.players?.find(pl => pl.id === playerId);
    if (p) {
      player = p;
      break;
    }
  }
  
  if (!player && league.freeAgents) {
    player = league.freeAgents.find(p => p.id === playerId);
  }
  
  if (!player) {
    alert('Player not found');
    return;
  }
  
  // Get form data
  let injuryType = document.getElementById('injury_type').value;
  const severity = document.getElementById('injury_severity').value;
  const gamesOut = parseInt(document.getElementById('injury_games').value);
  
  if (injuryType === 'Custom') {
    const customName = document.getElementById('injury_custom').value.trim();
    if (!customName) {
      alert('Please enter a custom injury name');
      return;
    }
    injuryType = customName;
  }
  
  if (gamesOut <= 0) {
    alert('Duration must be at least 1 game');
    return;
  }
  
  // Apply injury
  player.injury = {
    type: injuryType,
    gamesRemaining: gamesOut,
    severity: severity,
    startGameIndex: league.currentDay || 0,
    isActive: true
  };
  
  // Log action
  logCommissionerAction('FORCE_INJURY', `${player.name}: ${injuryType} (${gamesOut} games, ${severity})`, { playerId });
  
  // Add news item
  addNewsItem(
    `Player Injury`,
    `${player.name} has been placed on the injury report with a ${injuryType} (${gamesOut} games)`,
    'injury'
  );
  
  // Invalidate strength cache
  incrementStrengthVersion();
  
  // Save and refresh
  save();
  render();
  closeForceInjuryModal();
  
  alert(`✅ ${player.name} has been injured with ${injuryType}\nGames out: ${gamesOut}`);
}

// Main Settings Renderer
function renderSettings() {
  const el = document.getElementById('settings-tab');
  if (!league) {
    el.innerHTML = '<div style="padding: 20px; color: #fff;">No league loaded</div>';
    return;
  }
  
  // Initialize settings if not already
  if (!settingsData) {
    initSettingsEditor();
  }
  
  const hasChanges = settingsOriginal && JSON.stringify(settingsData) !== JSON.stringify(settingsOriginal);
  const isMidSeason = league.phase !== 'preseason';
  
  el.innerHTML = `
    <div style="min-height: 100vh; background: #0f1624; padding-bottom: 100px;">
      <!-- Header -->
      <div style="
        background: linear-gradient(135deg, #1a2332 0%, #0f1624 100%);
        padding: 30px 20px;
        border-bottom: 2px solid #2a2a40;
      ">
        <h1 style="margin: 0 0 8px 0; color: #fff; font-size: 2em;">⚙️ Settings</h1>
        <div style="color: #888; font-size: 0.95em;">
          League Settings & Preferences • Season ${league.season} • ${league.phase}
        </div>
      </div>

      <!-- Settings Sections -->
      <div style="max-width: 1000px; margin: 0 auto; padding: 20px;">
        ${renderGameplayRulesSection(settingsData.rules, isMidSeason)}
        ${renderCapRulesSection(settingsData.capRules)}
        ${renderAIBehaviorSection(settingsData.aiSettings)}
        ${renderSimSettingsSection(settingsData.simSettings)}
        ${renderUIPreferencesSection()}
        ${renderNotificationsSection(settingsData.newsSettings)}
        ${renderDataSafetySection(settingsData.dataSettings)}
        ${renderJobSecuritySection(settingsData.settings || league.settings)}
        ${renderCommissionerModeSection()}
      </div>

      <!-- Save Bar -->
      ${hasChanges ? `
        <div style="
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: #1a2332;
          border-top: 2px solid #2196F3;
          padding: 15px 20px;
          display: flex;
          justify-content: center;
          gap: 15px;
          z-index: 100;
          box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
        ">
          <button onclick="saveSettings()" style="
            padding: 12px 32px;
            background: #2196F3;
            color: #fff;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            font-size: 1.1em;
          ">💾 Save Settings</button>
          <button onclick="revertSettings()" style="
            padding: 12px 32px;
            background: #f44336;
            color: #fff;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            font-size: 1.1em;
          ">↩️ Revert</button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderGameplayRulesSection(rules, isMidSeason) {
  const isExpanded = expandedSettingsSections.has('gameplay');
  
  return `
    <div style="background: #1a2332; border-radius: 12px; margin-bottom: 15px; border: 1px solid #2a2a40; overflow: hidden;">
      <div onclick="toggleSettingsSection('gameplay')" style="
        padding: 20px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: ${isExpanded ? '#1f2937' : 'transparent'};
      ">
        <h3 style="margin: 0; color: #2196F3; font-size: 1.3em;">🏀 Gameplay Rules</h3>
        <span style="color: #888; font-size: 1.5em;">${isExpanded ? '▼' : '▶'}</span>
      </div>
      
      ${isExpanded ? `
        <div style="padding: 0 20px 20px 20px;">
          ${isMidSeason ? `
            <div style="
              padding: 12px;
              background: #f39c12;
              color: #000;
              border-radius: 6px;
              margin-bottom: 15px;
              font-weight: bold;
            ">⚠️ Some changes only apply in preseason or next season</div>
          ` : ''}
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
            <div>
              <label style="display: block; color: #888; margin-bottom: 6px;">Games Per Team ${isMidSeason ? '(Next Season)' : ''}</label>
              <input type="number" min="1" max="82" value="${rules.gamesPerTeam}"
                     ${isMidSeason ? 'disabled' : ''}
                     oninput="updateSetting('rules', 'gamesPerTeam', parseInt(this.value))"
                     style="width: 100%; padding: 10px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px;" />
            </div>
            
            <div>
              <label style="display: block; color: #888; margin-bottom: 6px;">Quarter Length (minutes)</label>
              <input type="number" min="5" max="20" value="${rules.quarterLength}"
                     oninput="updateSetting('rules', 'quarterLength', parseInt(this.value))"
                     style="width: 100%; padding: 10px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px;" />
            </div>
            
            <div>
              <label style="display: block; color: #888; margin-bottom: 6px;">Overtime Length (minutes)</label>
              <input type="number" min="3" max="10" value="${rules.overtimeLength}"
                     oninput="updateSetting('rules', 'overtimeLength', parseInt(this.value))"
                     style="width: 100%; padding: 10px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px;" />
            </div>
            
            <div>
              <label style="display: block; color: #888; margin-bottom: 6px;">Playoff Teams</label>
              <select onchange="updateSetting('rules', 'playoffTeams', parseInt(this.value))"
                      style="width: 100%; padding: 10px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px; cursor: pointer;">
                <option value="8" ${rules.playoffTeams === 8 ? 'selected' : ''}>8 teams</option>
                <option value="16" ${rules.playoffTeams === 16 ? 'selected' : ''}>16 teams</option>
                <option value="20" ${rules.playoffTeams === 20 ? 'selected' : ''}>20 teams</option>
              </select>
            </div>
            
            <div>
              <label style="display: block; color: #888; margin-bottom: 6px;">Playoff Series Length</label>
              <select onchange="updateSetting('rules', 'playoffSeriesLength', parseInt(this.value))"
                      style="width: 100%; padding: 10px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px; cursor: pointer;">
                <option value="5" ${rules.playoffSeriesLength === 5 ? 'selected' : ''}>Best of 5</option>
                <option value="7" ${rules.playoffSeriesLength === 7 ? 'selected' : ''}>Best of 7</option>
              </select>
            </div>
            
            <div>
              <label style="display: block; color: #888; margin-bottom: 6px;">Draft Rounds</label>
              <input type="number" min="1" max="5" value="${rules.draftRounds}"
                     oninput="updateSetting('rules', 'draftRounds', parseInt(this.value))"
                     style="width: 100%; padding: 10px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px;" />
            </div>
            
            <div>
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" ${rules.expansionAllowed ? 'checked' : ''}
                       onchange="updateSetting('rules', 'expansionAllowed', this.checked)" />
                <span style="color: #fff;">Expansion Allowed</span>
              </label>
            </div>
            
            <div>
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" ${rules.enableInjuries ? 'checked' : ''}
                       onchange="updateSetting('rules', 'enableInjuries', this.checked)" />
                <span style="color: #fff;">Enable Injuries</span>
              </label>
            </div>
            
            <div>
              <label style="display: block; color: #888; margin-bottom: 6px;">Injury Frequency</label>
              <select onchange="updateSetting('rules', 'injuryFrequency', this.value)"
                      style="width: 100%; padding: 10px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px; cursor: pointer;">
                <option value="Low" ${rules.injuryFrequency === 'Low' ? 'selected' : ''}>Low</option>
                <option value="Normal" ${rules.injuryFrequency === 'Normal' ? 'selected' : ''}>Normal</option>
                <option value="High" ${rules.injuryFrequency === 'High' ? 'selected' : ''}>High</option>
              </select>
            </div>
            
            <div>
              <label style="display: block; color: #888; margin-bottom: 6px;">Fatigue Impact</label>
              <select onchange="updateSetting('rules', 'fatigueImpact', this.value)"
                      style="width: 100%; padding: 10px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px; cursor: pointer;">
                <option value="Low" ${rules.fatigueImpact === 'Low' ? 'selected' : ''}>Low</option>
                <option value="Normal" ${rules.fatigueImpact === 'Normal' ? 'selected' : ''}>Normal</option>
                <option value="High" ${rules.fatigueImpact === 'High' ? 'selected' : ''}>High</option>
              </select>
            </div>
            
            <div>
              <label style="display: block; color: #888; margin-bottom: 6px;">Morale Impact</label>
              <select onchange="updateSetting('rules', 'moraleImpact', this.value)"
                      style="width: 100%; padding: 10px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px; cursor: pointer;">
                <option value="Low" ${rules.moraleImpact === 'Low' ? 'selected' : ''}>Low</option>
                <option value="Normal" ${rules.moraleImpact === 'Normal' ? 'selected' : ''}>Normal</option>
                <option value="High" ${rules.moraleImpact === 'High' ? 'selected' : ''}>High</option>
              </select>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderCapRulesSection(capRules) {
  const isExpanded = expandedSettingsSections.has('cap');
  
  return `
    <div style="background: #1a2332; border-radius: 12px; margin-bottom: 15px; border: 1px solid #2a2a40; overflow: hidden;">
      <div onclick="toggleSettingsSection('cap')" style="
        padding: 20px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <h3 style="margin: 0; color: #2196F3; font-size: 1.3em;">💰 Salary Cap & Contract Rules</h3>
        <span style="color: #888; font-size: 1.5em;">${isExpanded ? '▼' : '▶'}</span>
      </div>
      
      ${isExpanded ? `
        <div style="padding: 0 20px 20px 20px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
            <div>
              <label style="display: block; color: #888; margin-bottom: 6px;">Salary Cap ($)</label>
              <input type="number" min="50000000" max="200000000" step="1000000" value="${capRules.salaryCap}"
                     oninput="updateSetting('capRules', 'salaryCap', parseInt(this.value))"
                     style="width: 100%; padding: 10px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px;" />
            </div>
            
            <div>
              <label style="display: block; color: #888; margin-bottom: 6px;">Luxury Tax Line ($)</label>
              <input type="number" min="50000000" max="250000000" step="1000000" value="${capRules.luxuryTaxLine}"
                     oninput="updateSetting('capRules', 'luxuryTaxLine', parseInt(this.value))"
                     style="width: 100%; padding: 10px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px;" />
            </div>
            
            <div>
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" ${capRules.hardCap ? 'checked' : ''}
                       onchange="updateSetting('capRules', 'hardCap', this.checked)" />
                <span style="color: #fff;">Hard Cap (No Luxury Tax)</span>
              </label>
            </div>
            
            <div>
              <label style="display: block; color: #888; margin-bottom: 6px;">Max Contract % of Cap</label>
              <input type="number" min="25" max="50" value="${capRules.maxContractPercent}"
                     oninput="updateSetting('capRules', 'maxContractPercent', parseInt(this.value))"
                     style="width: 100%; padding: 10px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px;" />
            </div>
            
            <div>
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" ${capRules.rookieScaleEnabled ? 'checked' : ''}
                       onchange="updateSetting('capRules', 'rookieScaleEnabled', this.checked)" />
                <span style="color: #fff;">Rookie Scale Enabled</span>
              </label>
            </div>
            
            <div>
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" ${capRules.allowPlayerOptions ? 'checked' : ''}
                       onchange="updateSetting('capRules', 'allowPlayerOptions', this.checked)" />
                <span style="color: #fff;">Allow Player Options</span>
              </label>
            </div>
            
            <div>
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" ${capRules.allowTeamOptions ? 'checked' : ''}
                       onchange="updateSetting('capRules', 'allowTeamOptions', this.checked)" />
                <span style="color: #fff;">Allow Team Options</span>
              </label>
            </div>
            
            <div>
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" ${capRules.allowExtensions ? 'checked' : ''}
                       onchange="updateSetting('capRules', 'allowExtensions', this.checked)" />
                <span style="color: #fff;">Allow Extensions</span>
              </label>
            </div>
            
            <div>
              <label style="display: block; color: #888; margin-bottom: 6px;">Negotiation Difficulty</label>
              <select onchange="updateSetting('capRules', 'negotiationDifficulty', this.value)"
                      style="width: 100%; padding: 10px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px; cursor: pointer;">
                <option value="Easy" ${capRules.negotiationDifficulty === 'Easy' ? 'selected' : ''}>Easy</option>
                <option value="Normal" ${capRules.negotiationDifficulty === 'Normal' ? 'selected' : ''}>Normal</option>
                <option value="Hard" ${capRules.negotiationDifficulty === 'Hard' ? 'selected' : ''}>Hard</option>
              </select>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderAIBehaviorSection(aiSettings) {
  const isExpanded = expandedSettingsSections.has('ai');
  
  return `
    <div style="background: #1a2332; border-radius: 12px; margin-bottom: 15px; border: 1px solid #2a2a40; overflow: hidden;">
      <div onclick="toggleSettingsSection('ai')" style="
        padding: 20px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <h3 style="margin: 0; color: #2196F3; font-size: 1.3em;">🤖 AI Behavior</h3>
        <span style="color: #888; font-size: 1.5em;">${isExpanded ? '▼' : '▶'}</span>
      </div>
      
      ${isExpanded ? `
        <div style="padding: 0 20px 20px 20px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
            ${['tradeAggressiveness', 'freeAgencyAggressiveness', 'rosterPatience', 'rebuildTolerance', 'rotationStrictness'].map(key => {
              const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
              return `
                <div>
                  <label style="display: block; color: #888; margin-bottom: 6px;">${label}</label>
                  <select onchange="updateSetting('aiSettings', '${key}', this.value)"
                          style="width: 100%; padding: 10px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px; cursor: pointer;">
                    <option value="Low" ${aiSettings[key] === 'Low' ? 'selected' : ''}>Low</option>
                    <option value="Normal" ${aiSettings[key] === 'Normal' ? 'selected' : ''}>Normal</option>
                    <option value="High" ${aiSettings[key] === 'High' ? 'selected' : ''}>High</option>
                  </select>
                </div>
              `;
            }).join('')}
            
            <div>
              <label style="display: block; color: #888; margin-bottom: 6px;">Drafting Style</label>
              <select onchange="updateSetting('aiSettings', 'draftingStyle', this.value)"
                      style="width: 100%; padding: 10px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px; cursor: pointer;">
                <option value="Best Player Available" ${aiSettings.draftingStyle === 'Best Player Available' ? 'selected' : ''}>Best Player Available</option>
                <option value="Team Needs" ${aiSettings.draftingStyle === 'Team Needs' ? 'selected' : ''}>Team Needs</option>
                <option value="Balanced" ${aiSettings.draftingStyle === 'Balanced' ? 'selected' : ''}>Balanced</option>
              </select>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderSimSettingsSection(simSettings) {
  const isExpanded = expandedSettingsSections.has('sim');
  
  return `
    <div style="background: #1a2332; border-radius: 12px; margin-bottom: 15px; border: 1px solid #2a2a40; overflow: hidden;">
      <div onclick="toggleSettingsSection('sim')" style="
        padding: 20px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <h3 style="margin: 0; color: #2196F3; font-size: 1.3em;">⚡ Simulation & Presentation</h3>
        <span style="color: #888; font-size: 1.5em;">${isExpanded ? '▼' : '▶'}</span>
      </div>
      
      ${isExpanded ? `
        <div style="padding: 0 20px 20px 20px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
            <div>
              <label style="display: block; color: #888; margin-bottom: 6px;">Default Sim Speed</label>
              <select onchange="updateSetting('simSettings', 'defaultSimSpeed', this.value)"
                      style="width: 100%; padding: 10px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px; cursor: pointer;">
                <option value="Instant" ${simSettings.defaultSimSpeed === 'Instant' ? 'selected' : ''}>Instant</option>
                <option value="Fast" ${simSettings.defaultSimSpeed === 'Fast' ? 'selected' : ''}>Fast</option>
                <option value="Normal" ${simSettings.defaultSimSpeed === 'Normal' ? 'selected' : ''}>Normal</option>
              </select>
            </div>
            
            <div>
              <label style="display: block; color: #888; margin-bottom: 6px;">Watch Live Speed</label>
              <select onchange="updateSetting('simSettings', 'watchLiveSpeed', this.value)"
                      style="width: 100%; padding: 10px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px; cursor: pointer;">
                <option value="1x" ${simSettings.watchLiveSpeed === '1x' ? 'selected' : ''}>1x (Real-time)</option>
                <option value="2x" ${simSettings.watchLiveSpeed === '2x' ? 'selected' : ''}>2x</option>
                <option value="5x" ${simSettings.watchLiveSpeed === '5x' ? 'selected' : ''}>5x</option>
              </select>
            </div>
            
            <div>
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" ${simSettings.autoPauseCloseGames ? 'checked' : ''}
                       onchange="updateSetting('simSettings', 'autoPauseCloseGames', this.checked)" />
                <span style="color: #fff;">Auto-Pause Close Games</span>
              </label>
            </div>
            
            <div>
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" ${simSettings.savePlayByPlay ? 'checked' : ''}
                       onchange="updateSetting('simSettings', 'savePlayByPlay', this.checked)" />
                <span style="color: #fff;">Save Play-by-Play Logs</span>
              </label>
            </div>
            
            <div>
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" ${simSettings.saveFullBoxScores ? 'checked' : ''}
                       onchange="updateSetting('simSettings', 'saveFullBoxScores', this.checked)" />
                <span style="color: #fff;">Save Full Box Scores</span>
              </label>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderUIPreferencesSection() {
  const isExpanded = expandedSettingsSections.has('ui');
  
  return `
    <div style="background: #1a2332; border-radius: 12px; margin-bottom: 15px; border: 1px solid #2a2a40; overflow: hidden;">
      <div onclick="toggleSettingsSection('ui')" style="
        padding: 20px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <h3 style="margin: 0; color: #2196F3; font-size: 1.3em;">🎨 UI Preferences</h3>
        <span style="color: #888; font-size: 1.5em;">${isExpanded ? '▼' : '▶'}</span>
      </div>
      
      ${isExpanded ? `
        <div style="padding: 0 20px 20px 20px;">
          <div style="
            padding: 12px;
            background: #0f1624;
            border-left: 3px solid #2196F3;
            border-radius: 6px;
            margin-bottom: 15px;
            color: #888;
            font-size: 0.9em;
          ">
            ℹ️ These preferences are stored locally and do not affect league balance
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
            <div>
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" ${userPreferences.darkMode ? 'checked' : ''}
                       onchange="updateUserPreference('darkMode', this.checked)" />
                <span style="color: #fff;">Dark Mode</span>
              </label>
            </div>
            
            <div>
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" ${userPreferences.compactTables ? 'checked' : ''}
                       onchange="updateUserPreference('compactTables', this.checked)" />
                <span style="color: #fff;">Compact Tables</span>
              </label>
            </div>
            
            <div>
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" ${userPreferences.stickyHeaders ? 'checked' : ''}
                       onchange="updateUserPreference('stickyHeaders', this.checked)" />
                <span style="color: #fff;">Sticky Table Headers</span>
              </label>
            </div>
            
            <div>
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" ${userPreferences.autoScrollPlayByPlay ? 'checked' : ''}
                       onchange="updateUserPreference('autoScrollPlayByPlay', this.checked)" />
                <span style="color: #fff;">Auto-Scroll Play-by-Play</span>
              </label>
            </div>
            
            <div>
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" ${userPreferences.confirmBeforeSimming ? 'checked' : ''}
                       onchange="updateUserPreference('confirmBeforeSimming', this.checked)" />
                <span style="color: #fff;">Confirm Before Simming</span>
              </label>
            </div>
            
            <div>
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" ${userPreferences.confirmBeforeTrading ? 'checked' : ''}
                       onchange="updateUserPreference('confirmBeforeTrading', this.checked)" />
                <span style="color: #fff;">Confirm Before Trading</span>
              </label>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderNotificationsSection(newsSettings) {
  const isExpanded = expandedSettingsSections.has('notifications');
  
  return `
    <div style="background: #1a2332; border-radius: 12px; margin-bottom: 15px; border: 1px solid #2a2a40; overflow: hidden;">
      <div onclick="toggleSettingsSection('notifications')" style="
        padding: 20px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <h3 style="margin: 0; color: #2196F3; font-size: 1.3em;">🔔 Notifications & News</h3>
        <span style="color: #888; font-size: 1.5em;">${isExpanded ? '▼' : '▶'}</span>
      </div>
      
      ${isExpanded ? `
        <div style="padding: 0 20px 20px 20px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
            <div>
              <label style="display: block; color: #888; margin-bottom: 6px;">News Frequency</label>
              <select onchange="updateSetting('newsSettings', 'frequency', this.value)"
                      style="width: 100%; padding: 10px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px; cursor: pointer;">
                <option value="Low" ${newsSettings.frequency === 'Low' ? 'selected' : ''}>Low</option>
                <option value="Normal" ${newsSettings.frequency === 'Normal' ? 'selected' : ''}>Normal</option>
                <option value="High" ${newsSettings.frequency === 'High' ? 'selected' : ''}>High</option>
              </select>
            </div>
            
            <div>
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" ${newsSettings.breakingOnly ? 'checked' : ''}
                       onchange="updateSetting('newsSettings', 'breakingOnly', this.checked)" />
                <span style="color: #fff;">Breaking News Only</span>
              </label>
            </div>
            
            <div>
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" ${newsSettings.myTeamOnly ? 'checked' : ''}
                       onchange="updateSetting('newsSettings', 'myTeamOnly', this.checked)" />
                <span style="color: #fff;">My Team Only</span>
              </label>
            </div>
            
            <div>
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" ${newsSettings.alertPopups ? 'checked' : ''}
                       onchange="updateSetting('newsSettings', 'alertPopups', this.checked)" />
                <span style="color: #fff;">Alert Popups</span>
              </label>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderDataSafetySection(dataSettings) {
  const isExpanded = expandedSettingsSections.has('data');
  
  return `
    <div style="background: #1a2332; border-radius: 12px; margin-bottom: 15px; border: 1px solid #2a2a40; overflow: hidden;">
      <div onclick="toggleSettingsSection('data')" style="
        padding: 20px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <h3 style="margin: 0; color: #2196F3; font-size: 1.3em;">💾 Data & Safety</h3>
        <span style="color: #888; font-size: 1.5em;">${isExpanded ? '▼' : '▶'}</span>
      </div>
      
      ${isExpanded ? `
        <div style="padding: 0 20px 20px 20px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
            <div>
              <label style="display: block; color: #888; margin-bottom: 6px;">Auto-Save Frequency</label>
              <select onchange="updateSetting('dataSettings', 'autoSaveFrequency', this.value)"
                      style="width: 100%; padding: 10px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px; cursor: pointer;">
                <option value="Every day" ${dataSettings.autoSaveFrequency === 'Every day' ? 'selected' : ''}>Every Day</option>
                <option value="Every game" ${dataSettings.autoSaveFrequency === 'Every game' ? 'selected' : ''}>Every Game</option>
                <option value="Manual" ${dataSettings.autoSaveFrequency === 'Manual' ? 'selected' : ''}>Manual Only</option>
              </select>
            </div>
            
            <div>
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" ${dataSettings.backupSaves ? 'checked' : ''}
                       onchange="updateSetting('dataSettings', 'backupSaves', this.checked)" />
                <span style="color: #fff;">Backup Saves</span>
              </label>
            </div>
          </div>
          
          <div style="margin-top: 20px; display: flex; flex-wrap: gap; gap: 10px;">
            <button onclick="clearCachedState()" style="
              padding: 10px 20px;
              background: #f39c12;
              color: #000;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-weight: bold;
            ">🗑️ Clear Cached UI State</button>
            
            <button onclick="repairLeagueData()" style="
              padding: 10px 20px;
              background: #9b59b6;
              color: #fff;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-weight: bold;
            ">🔧 Repair League Data</button>
            
            <button onclick="exportLeague()" style="
              padding: 10px 20px;
              background: #27ae60;
              color: #fff;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-weight: bold;
            ">📤 Export League</button>
            
            <button onclick="importLeague()" style="
              padding: 10px 20px;
              background: #3498db;
              color: #fff;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-weight: bold;
            ">📥 Import League</button>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderCommissionerModeSection() {
  const isExpanded = expandedSettingsSections.has('commissioner');
  const isEnabled = isCommissionerMode();
  
  return `
    <div style="background: #1a2332; border-radius: 12px; margin-bottom: 15px; border: 2px solid ${isEnabled ? '#e74c3c' : '#2a2a40'}; overflow: hidden;">
      <div onclick="toggleSettingsSection('commissioner')" style="
        padding: 20px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: ${isEnabled ? 'linear-gradient(135deg, #c0392b 0%, #e74c3c 100%)' : 'transparent'};
      ">
        <h3 style="margin: 0; color: ${isEnabled ? '#fff' : '#e74c3c'}; font-size: 1.3em;">
          👑 Commissioner Mode ${isEnabled ? '(ACTIVE)' : '(Advanced)'}
        </h3>
        <span style="color: ${isEnabled ? '#fff' : '#888'}; font-size: 1.5em;">${isExpanded ? '▼' : '▶'}</span>
      </div>
      
      ${isExpanded ? `
        <div style="padding: 20px;">
          ${!isEnabled ? `
            <div style="
              padding: 15px;
              background: #f39c12;
              color: #000;
              border-radius: 8px;
              margin-bottom: 15px;
              font-weight: bold;
              line-height: 1.6;
            ">
              ⚠️ WARNING: Commissioner Mode provides full administrative control over your league.
              <br>• Override game rules
              <br>• Edit players & teams
              <br>• Force transactions
              <br>• All actions are logged
              <br><br>
              <strong>Enabling will flag your league as "Modified"</strong>
            </div>
            
            <button onclick="enableCommissionerMode()" style="
              width: 100%;
              padding: 15px;
              background: #e74c3c;
              color: #fff;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-weight: bold;
              font-size: 1.1em;
            ">🔓 Enable Commissioner Mode</button>
          ` : `
            <div style="
              padding: 15px;
              background: #27ae60;
              color: #fff;
              border-radius: 8px;
              margin-bottom: 20px;
              font-weight: bold;
            ">
              ✅ Commissioner Mode is ACTIVE
              <br>All administrative features are unlocked.
            </div>
            
            <h4 style="color: #2196F3; margin: 20px 0 15px 0;">Global Actions</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
              <button onclick="commissionerAdvancePhase()" style="
                padding: 12px;
                background: #3498db;
                color: #fff;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: bold;
              ">⏩ Advance Phase</button>
              
              <button onclick="commissionerForceSchedule()" style="
                padding: 12px;
                background: #9b59b6;
                color: #fff;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: bold;
              ">📅 Force Schedule Regen</button>
              
              <button onclick="commissionerToggleInjuries()" style="
                padding: 12px;
                background: #e67e22;
                color: #fff;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: bold;
              ">🏥 Toggle Injuries</button>
              
              <button onclick="confirmApplyRatingProfile()" style="
                padding: 12px;
                background: #f39c12;
                color: #fff;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: bold;
              ">⭐ Apply Star Ratings</button>
            </div>
            
            <h4 style="color: #10b981; margin: 20px 0 15px 0;">⚡ Commissioner Tools</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
              <button onclick="showAddPlayerModal()" style="
                padding: 12px;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: #fff;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: bold;
              ">➕ Add Player</button>
              
              <button onclick="showForceTradeModal()" style="
                padding: 12px;
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                color: #fff;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: bold;
              ">🔄 Force Trade</button>
            </div>
            <div style="
              margin-top: 10px;
              padding: 10px;
              background: #1e293b;
              border-left: 4px solid #10b981;
              border-radius: 4px;
              color: #94a3b8;
              font-size: 0.85em;
            ">
              💡 Tip: Delete Player and Force Injury tools are available on individual player pages
            </div>
            
            <div style="
              margin-top: 15px;
              padding: 12px;
              background: #2c3e50;
              border-left: 4px solid #f39c12;
              border-radius: 4px;
              color: #ecf0f1;
              font-size: 0.9em;
            ">
              <strong>⭐ Apply Star Ratings:</strong> One-time migration that creates realistic 90+ OVR superstars.
              Preserves player rankings. Creates automatic backup before applying.
              ${leagueState?.migrations?.ratingProfileApplied ? 
                '<div style="color: #2ecc71; margin-top: 8px;">✓ Already applied (cannot reapply)</div>' : 
                '<div style="color: #e74c3c; margin-top: 8px;">⚠️ Not yet applied</div>'}
            </div>
              
              <button onclick="commissionerOverrideCap()" style="
                padding: 12px;
                background: #16a085;
                color: #fff;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: bold;
              ">💰 Override Salary Cap</button>
            </div>
            
            <div style="
              margin-top: 20px;
              padding: 12px;
              background: #0f1624;
              border-left: 3px solid #2196F3;
              border-radius: 6px;
              color: #888;
              font-size: 0.9em;
            ">
              ℹ️ Additional commissioner actions available in Team, Player, Draft, and Trade tabs.
              <br>View all actions in History → Commissioner Log.
            </div>
            
            <button onclick="disableCommissionerMode()" style="
              width: 100%;
              margin-top: 20px;
              padding: 12px;
              background: #95a5a6;
              color: #fff;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-weight: bold;
            ">🔒 Disable Commissioner Mode</button>
          `}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Render Job Security & Firing Section
 */
function renderJobSecuritySection(settings) {
  const isExpanded = expandedSettingsSections.has('jobsecurity');
  const isEnabled = settings.enableJobSecurity || false;
  
  return `
    <div style="background: #1a2332; border-radius: 12px; margin-bottom: 15px; border: 2px solid ${isEnabled ? '#f39c12' : '#2a2a40'}; overflow: hidden;">
      <div onclick="toggleSettingsSection('jobsecurity')" style="
        padding: 20px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: ${isEnabled ? 'linear-gradient(135deg, #e67e22 0%, #f39c12 100%)' : 'transparent'};
      ">
        <h3 style="margin: 0; color: ${isEnabled ? '#fff' : '#f39c12'}; font-size: 1.3em;">
          🔥 Job Security & Firing ${isEnabled ? '(ACTIVE)' : '(Optional)'}
        </h3>
        <span style="color: ${isEnabled ? '#fff' : '#888'}; font-size: 1.5em;">${isExpanded ? '▼' : '▶'}</span>
      </div>
      
      ${isExpanded ? `
        <div style="padding: 20px;">
          <div style="
            padding: 15px;
            background: ${isEnabled ? '#27ae60' : '#34495e'};
            color: #fff;
            border-radius: 8px;
            margin-bottom: 20px;
            line-height: 1.6;
          ">
            ${isEnabled ? `
              ✅ <strong>Job Security is ENABLED</strong>
              <br>Your performance is being evaluated. Keep your job security above the threshold or face termination.
            ` : `
              ℹ️ <strong>Job Security System (OFF by default)</strong>
              <br>• Owner evaluates your performance each season
              <br>• Meet expectations to keep your job (job security: 0-100)
              <br>• Get fired if job security drops too low
              <br>• Appeal dismissals or take jobs with other teams
              <br>• Track career history across multiple teams
            `}
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr; gap: 20px;">
            <div>
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 12px; background: #0f1624; border-radius: 6px;">
                <input type="checkbox" ${isEnabled ? 'checked' : ''}
                       onchange="updateSetting('settings', 'enableJobSecurity', this.checked); renderSettings();" />
                <div>
                  <div style="color: #fff; font-weight: bold;">Enable Job Security System</div>
                  <div style="color: #888; font-size: 0.85em; margin-top: 4px;">
                    Activates owner expectations and firing mechanics
                  </div>
                </div>
              </label>
            </div>
            
            ${isEnabled ? `
              <div>
                <label style="display: block; color: #888; margin-bottom: 8px; font-weight: bold;">
                  Difficulty Level
                </label>
                <select onchange="updateSetting('settings', 'jobSecurityDifficulty', this.value)"
                        style="width: 100%; padding: 12px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px; cursor: pointer;">
                  <option value="forgiving" ${settings.jobSecurityDifficulty === 'forgiving' ? 'selected' : ''}>
                    Forgiving (Fire at &lt;25 job security)
                  </option>
                  <option value="realistic" ${(settings.jobSecurityDifficulty === 'realistic' || !settings.jobSecurityDifficulty) ? 'selected' : ''}>
                    Realistic (Fire at &lt;35 job security)
                  </option>
                  <option value="ruthless" ${settings.jobSecurityDifficulty === 'ruthless' ? 'selected' : ''}>
                    Ruthless (Fire at &lt;45 job security)
                  </option>
                </select>
                <div style="color: #888; font-size: 0.85em; margin-top: 6px;">
                  Controls how quickly you can be fired
                </div>
              </div>
              
              <div>
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 12px; background: #0f1624; border-radius: 6px;">
                  <input type="checkbox" ${settings.allowMidseasonFiring ? 'checked' : ''}
                         onchange="updateSetting('settings', 'allowMidseasonFiring', this.checked)" />
                  <div>
                    <div style="color: #fff; font-weight: bold;">Allow Midseason Firing</div>
                    <div style="color: #888; font-size: 0.85em; margin-top: 4px;">
                      Enable firing during the season (not just at season end)
                    </div>
                  </div>
                </label>
              </div>
              
              <div style="
                padding: 12px;
                background: #0f1624;
                border-left: 3px solid #3498db;
                border-radius: 6px;
                color: #888;
                font-size: 0.9em;
                margin-top: 10px;
              ">
                <strong style="color: #3498db;">How It Works:</strong>
                <br>• Each team has an owner profile (patience, market pressure, budget tolerance)
                <br>• Owners set season expectations (wins, playoffs, development, etc.)
                <br>• Your job security (0-100) adjusts based on performance
                <br>• If job security drops below threshold, you can be fired
                <br>• You can appeal dismissals, take jobs elsewhere, or switch to commissioner mode
              </div>
            ` : `
              <div style="
                padding: 15px;
                background: #2c3e50;
                border-radius: 8px;
                color: #ecf0f1;
                text-align: center;
              ">
                Enable the system above to access difficulty settings
              </div>
            `}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Confirm and apply star league rating profile
 */
async function confirmApplyRatingProfile() {
  // Check if already applied
  if (leagueState?.migrations?.ratingProfileApplied) {
    alert('Star League ratings have already been applied to this league.');
    return;
  }
  
  const confirmed = confirm(
    '⭐ APPLY STAR LEAGUE RATINGS\n\n' +
    'This will transform your league ratings to create realistic 90+ OVR superstars.\n\n' +
    '✓ Preserves player rankings\n' +
    '✓ Creates clear star tiers\n' +
    '✓ Top 1%: 95-99 OVR\n' +
    '✓ Top 5%: 90-95 OVR\n\n' +
    '⚠️ This is a ONE-TIME migration that cannot be undone.\n' +
    'An automatic backup will be created before applying.\n\n' +
    'Continue?'
  );
  
  if (!confirmed) return;
  
  try {
    // Create backup
    console.log('[APP] Creating backup before rating profile...');
    if (typeof createRatingProfileBackup === 'function') {
      const backup = createRatingProfileBackup();
      if (backup) {
        console.log('[APP] ✓ Backup created');
      } else {
        throw new Error('Failed to create backup');
      }
    }
    
    // Apply the profile
    console.log('[APP] Applying star league profile...');
    if (typeof applyStarLeagueProfile === 'function') {
      const success = applyStarLeagueProfile();
      
      if (success) {
        // Save the league
        if (typeof saveLeagueState === 'function') {
          await saveLeagueState();
        }
        
        alert('✓ Star League ratings applied successfully!\n\nYour league now has realistic 90+ OVR superstars.');
        render();
      } else {
        throw new Error('Rating profile application failed');
      }
    } else {
      throw new Error('applyStarLeagueProfile function not available');
    }
  } catch (error) {
    console.error('[APP] Error applying rating profile:', error);
    alert('❌ Error applying rating profile: ' + error.message + '\n\nYour league has not been modified.');
  }
}

// Load user preferences on startup
loadUserPreferences();

// 7) COMMISSIONER LOG for History Tab
function renderCommissionerLogHistory() {
  const log = league.commissionerLog || [];
  
  if (log.length === 0) {
    return `
      <div style="text-align: center; padding: 80px 20px; color: #888;">
        <div style="font-size: 3em; margin-bottom: 20px;">👑</div>
        <div style="font-size: 1.2em; margin-bottom: 10px;">No Commissioner Actions</div>
        <div style="font-size: 0.9em;">
          ${isCommissionerMode() 
            ? 'Commissioner actions will be logged here' 
            : 'Enable Commissioner Mode in Settings to use admin features'}
        </div>
      </div>
    `;
  }
  
  // Sort by most recent first
  const sortedLog = [...log].sort((a, b) => b.id - a.id);
  
  return `
    <div style="margin-bottom: 20px;">
      <div style="
        padding: 15px;
        background: #e74c3c;
        color: #fff;
        border-radius: 8px;
        font-weight: bold;
      ">
        👑 Commissioner Activity Log
        <br><span style="font-weight: normal; font-size: 0.9em; opacity: 0.9;">
          ${log.length} action${log.length !== 1 ? 's' : ''} recorded • League flagged as Modified
        </span>
      </div>
    </div>
    
    <div style="display: flex; flex-direction: column; gap: 12px;">
      ${sortedLog.map(entry => {
        const actionColors = {
          'ENABLED': '#27ae60',
          'DISABLED': '#95a5a6',
          'PHASE_ADVANCE': '#3498db',
          'SCHEDULE_REGEN': '#9b59b6',
          'TOGGLE_INJURIES': '#e67e22',
          'CAP_OVERRIDE': '#16a085',
          'TAKE_CONTROL': '#f39c12',
          'EDIT_PLAYER': '#e74c3c',
          'MOVE_PLAYER': '#d35400',
          'FORCE_INJURY': '#c0392b',
          'HEAL_INJURY': '#2ecc71',
          'FORCE_SIGNING': '#8e44ad',
          'FORCE_TRADE': '#34495e'
        };
        
        const bgColor = actionColors[entry.actionType] || '#7f8c8d';
        
        return `
          <div style="
            background: #1a2332;
            border-radius: 10px;
            padding: 16px;
            border-left: 4px solid ${bgColor};
          ">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
              <span style="
                background: ${bgColor};
                color: #fff;
                padding: 4px 10px;
                border-radius: 4px;
                font-size: 0.75em;
                font-weight: bold;
              ">${entry.actionType.replace(/_/g, ' ')}</span>
              <div style="color: #888; font-size: 0.85em; text-align: right;">
                <div>Season ${entry.season} • Day ${entry.day}</div>
                <div style="font-size: 0.85em; opacity: 0.7;">
                  ${new Date(entry.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
            <div style="color: #fff; font-size: 1.05em; line-height: 1.5;">
              ${entry.description}
            </div>
            ${entry.entitiesAffected && Object.keys(entry.entitiesAffected).length > 0 ? `
              <div style="margin-top: 8px; padding: 8px; background: #0f1624; border-radius: 4px; font-size: 0.85em; color: #888;">
                <strong>Affected:</strong> ${JSON.stringify(entry.entitiesAffected)}
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* ============================
   TEAM MANAGEMENT TAB
============================ */

// Team editor state
let teamEditorData = null;
let teamEditorOriginal = null;
let selectedTeamForManagement = null;

// Initialize team editor with current team data
function initTeamEditor(teamId) {
  const team = league.teams.find(t => t.id === teamId);
  if (!team) return null;
  
  // Deep clone current team data
  teamEditorOriginal = JSON.parse(JSON.stringify(team));
  teamEditorData = JSON.parse(JSON.stringify(team));
  
  return teamEditorData;
}

// Validate abbreviation uniqueness
function validateAbbreviation(abbr, currentTeamId) {
  if (!abbr || abbr.length !== 3) return false;
  return !league.teams.some(t => t.id !== currentTeamId && t.abbreviation === abbr.toUpperCase());
}

// Save team changes
function saveTeamChanges() {
  if (!teamEditorData || !teamEditorOriginal) {
    alert('No changes to save');
    return;
  }
  
  // Validate required fields
  if (!teamEditorData.city || !teamEditorData.name) {
    alert('Team City and Name are required');
    return;
  }
  
  // Validate abbreviation
  if (!validateAbbreviation(teamEditorData.abbreviation, teamEditorData.id)) {
    alert('Abbreviation must be 3 letters and unique league-wide');
    return;
  }
  
  // Check for major changes requiring confirmation
  const conferenceChanged = teamEditorData.conference !== teamEditorOriginal.conference;
  const marketChanged = teamEditorData.marketSize !== teamEditorOriginal.marketSize;
  
  if (conferenceChanged || marketChanged) {
    const changes = [];
    if (conferenceChanged) changes.push('Conference change will affect standings and playoff seeding');
    if (marketChanged) changes.push('Market size affects revenue and free agent interest');
    
    if (!confirm(`Major changes detected:\n\n${changes.join('\n')}\n\nProceed?`)) {
      return;
    }
  }
  
  // Apply changes to actual team
  const team = league.teams.find(t => t.id === teamEditorData.id);
  if (!team) return;
  
  Object.assign(team, teamEditorData);
  
  // Generate news item
  const changedFields = [];
  if (teamEditorData.city !== teamEditorOriginal.city || teamEditorData.name !== teamEditorOriginal.name) {
    changedFields.push('identity');
  }
  if (teamEditorData.primaryColor !== teamEditorOriginal.primaryColor || 
      teamEditorData.secondaryColor !== teamEditorOriginal.secondaryColor) {
    changedFields.push('branding');
  }
  if (teamEditorData.conference !== teamEditorOriginal.conference) {
    changedFields.push('conference');
  }
  
  if (changedFields.length > 0 && league.news) {
    addNewsItem(league, 'teamRebrand', {
      teamName: team.name,
      teamId: team.id,
      changes: changedFields.join(', ')
    });
  }
  
  save();
  teamEditorData = null;
  teamEditorOriginal = null;
  
  alert('Team changes saved successfully!');
  render();
}

// Revert team changes
function revertTeamChanges() {
  if (confirm('Discard all changes?')) {
    teamEditorData = null;
    teamEditorOriginal = null;
    render();
  }
}

// Switch to different team in management
function switchTeamManagement(teamId) {
  if (!teamId) return;
  
  // Check for unsaved changes
  if (teamEditorData && teamEditorOriginal && 
      JSON.stringify(teamEditorData) !== JSON.stringify(teamEditorOriginal)) {
    if (!confirm('You have unsaved changes. Switch teams anyway?')) {
      return;
    }
  }
  
  selectedTeamForManagement = parseInt(teamId);
  teamEditorData = null;
  teamEditorOriginal = null;
  render();
}

// Update team editor field
function updateTeamField(field, value) {
  if (!teamEditorData) return;
  
  // Handle nested fields
  if (field.includes('.')) {
    const [parent, child] = field.split('.');
    if (!teamEditorData[parent]) teamEditorData[parent] = {};
    teamEditorData[parent][child] = value;
  } else {
    teamEditorData[field] = value;
  }
  
  render();
}

// Main Team Management Renderer
function renderTeamManagement() {
  const el = document.getElementById('teamManagement-tab');
  if (!league) {
    el.innerHTML = '<div style="padding: 20px; color: #fff;">No league loaded</div>';
    return;
  }
  
  // Determine which team to edit
  if (!selectedTeamForManagement) {
    selectedTeamForManagement = league.userTeamId || league.teams[0]?.id;
  }
  
  if (!selectedTeamForManagement) {
    el.innerHTML = '<div style="padding: 20px; color: #fff;">No team found</div>';
    return;
  }
  
  // Initialize editor if not already
  if (!teamEditorData) {
    initTeamEditor(selectedTeamForManagement);
  }
  
  const team = teamEditorData;
  const hasChanges = teamEditorOriginal && JSON.stringify(team) !== JSON.stringify(teamEditorOriginal);
  
  // Sort teams by conference and name
  const sortedTeams = [...league.teams].sort((a, b) => {
    if (a.conference !== b.conference) {
      return a.conference.localeCompare(b.conference);
    }
    return a.name.localeCompare(b.name);
  });
  
  el.innerHTML = `
    <div style="min-height: 100vh; background: #0f1624; padding-bottom: 100px;">
      <!-- Header -->
      <div style="
        background: linear-gradient(135deg, #1a2332 0%, #0f1624 100%);
        padding: 30px 20px 20px 20px;
        border-bottom: 2px solid #2a2a40;
      ">
        <h1 style="margin: 0 0 20px 0; color: #fff; font-size: 2em;">⚙️ Team Management</h1>
        
        <!-- Team Selector -->
        <div style="margin-bottom: 15px;">
          <label style="display: block; color: #888; margin-bottom: 8px; font-size: 0.9em;">Select Team to Edit:</label>
          <select 
            onchange="switchTeamManagement(this.value)"
            style="
              width: 100%;
              max-width: 400px;
              padding: 12px 16px;
              background: #0f1624;
              color: #fff;
              border: 2px solid #2a2a40;
              border-radius: 8px;
              font-size: 1.1em;
              cursor: pointer;
            "
          >
            ${sortedTeams.map(t => {
              // Avoid duplication if city is in the name
              const displayName = t.name?.startsWith(t.city) ? t.name : `${t.city} ${t.name}`;
              return `
              <option value="${t.id}" ${t.id === selectedTeamForManagement ? 'selected' : ''}>
                ${t.conference === 'East' ? '🟦' : '🟥'} ${displayName} ${t.id === league.userTeamId ? '(Your Team)' : ''}
              </option>
            `}).join('')}
          </select>
        </div>
        
        <div style="color: #888; font-size: 0.95em;">
          ${team.name?.startsWith(team.city) ? team.name : `${team.city} ${team.name}`} • ${team.conference} Conference • ${team.division || 'N/A'} Division
        </div>
      </div>

      <!-- Team Preview Card -->
      ${renderTeamPreviewCard(team)}

      <!-- Editor Sections -->
      <div style="max-width: 1000px; margin: 0 auto; padding: 20px;">
        ${renderTeamIdentitySection(team)}
        ${renderBrandingSection(team)}
        ${renderLocationSection(team)}
        ${renderFrontOfficeSection(team)}
        ${renderVisibilitySection(team)}
      </div>

      <!-- Save Bar (Sticky Bottom) -->
      ${hasChanges ? `
        <div style="
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: #1a2332;
          border-top: 2px solid #2196F3;
          padding: 15px 20px;
          display: flex;
          justify-content: center;
          gap: 15px;
          z-index: 100;
          box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
        ">
          <button onclick="saveTeamChanges()" style="
            padding: 12px 32px;
            background: #2196F3;
            color: #fff;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            font-size: 1.1em;
          ">💾 Save Changes</button>
          <button onclick="revertTeamChanges()" style="
            padding: 12px 32px;
            background: #f44336;
            color: #fff;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            font-size: 1.1em;
          ">↩️ Revert</button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderTeamPreviewCard(team) {
  return `
    <div style="max-width: 600px; margin: 30px auto; padding: 30px; background: #1a2332; border-radius: 16px; border: 2px solid #2a2a40; text-align: center;">
      <div style="
        width: 120px;
        height: 120px;
        margin: 0 auto 20px;
        background: linear-gradient(135deg, ${team.primaryColor || '#2196F3'} 0%, ${team.secondaryColor || '#1976D2'} 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 3em;
        color: #fff;
        font-weight: bold;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      ">${team.abbreviation || team.name?.substring(0, 3).toUpperCase() || '???'}</div>
      
      <h2 style="margin: 0 0 8px 0; color: #fff; font-size: 2em;">${team.name?.startsWith(team.city) ? team.name : `${team.city} ${team.name}`}</h2>
      <div style="color: ${team.primaryColor || '#2196F3'}; font-size: 1.2em; margin-bottom: 15px;">
        ${team.conference} Conference • ${team.division || 'N/A'} Division
      </div>
      <div style="color: #888; font-size: 0.9em;">
        ${team.marketSize || 'Medium'} Market • ${team.arenaName || 'Home Arena'} (${team.arenaCapacity || 18000} seats)
      </div>
    </div>
  `;
}

function renderTeamIdentitySection(team) {
  return `
    <div style="background: #1a2332; border-radius: 12px; padding: 25px; margin-bottom: 20px; border: 1px solid #2a2a40;">
      <h3 style="margin: 0 0 20px 0; color: #2196F3; font-size: 1.4em;">🏀 Team Identity</h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
        <div>
          <label style="display: block; color: #888; margin-bottom: 6px; font-size: 0.9em;">Team City *</label>
          <input 
            type="text" 
            value="${team.city || ''}"
            oninput="updateTeamField('city', this.value)"
            style="
              width: 100%;
              padding: 12px;
              background: #0f1624;
              color: #fff;
              border: 1px solid #2a2a40;
              border-radius: 6px;
              font-size: 1em;
            "
          />
        </div>

        <div>
          <label style="display: block; color: #888; margin-bottom: 6px; font-size: 0.9em;">Team Name *</label>
          <input 
            type="text" 
            value="${team.name || ''}"
            oninput="updateTeamField('name', this.value)"
            style="
              width: 100%;
              padding: 12px;
              background: #0f1624;
              color: #fff;
              border: 1px solid #2a2a40;
              border-radius: 6px;
              font-size: 1em;
            "
          />
        </div>

        <div>
          <label style="display: block; color: #888; margin-bottom: 6px; font-size: 0.9em;">Abbreviation (3 letters) *</label>
          <input 
            type="text" 
            value="${team.abbreviation || ''}"
            maxlength="3"
            oninput="updateTeamField('abbreviation', this.value.toUpperCase())"
            style="
              width: 100%;
              padding: 12px;
              background: #0f1624;
              color: #fff;
              border: 1px solid ${validateAbbreviation(team.abbreviation, team.id) ? '#2a2a40' : '#f44336'};
              border-radius: 6px;
              font-size: 1em;
              text-transform: uppercase;
            "
          />
        </div>

        <div>
          <label style="display: block; color: #888; margin-bottom: 6px; font-size: 0.9em;">Market Size</label>
          <select 
            onchange="updateTeamField('marketSize', this.value)"
            style="
              width: 100%;
              padding: 12px;
              background: #0f1624;
              color: #fff;
              border: 1px solid #2a2a40;
              border-radius: 6px;
              cursor: pointer;
            "
          >
            <option value="Small" ${team.marketSize === 'Small' ? 'selected' : ''}>Small</option>
            <option value="Medium" ${team.marketSize === 'Medium' ? 'selected' : ''}>Medium</option>
            <option value="Large" ${team.marketSize === 'Large' ? 'selected' : ''}>Large</option>
          </select>
        </div>

        <div>
          <label style="display: block; color: #888; margin-bottom: 6px; font-size: 0.9em;">Conference</label>
          <select 
            onchange="updateTeamField('conference', this.value)"
            style="
              width: 100%;
              padding: 12px;
              background: #0f1624;
              color: #fff;
              border: 1px solid #2a2a40;
              border-radius: 6px;
              cursor: pointer;
            "
          >
            <option value="East" ${team.conference === 'East' ? 'selected' : ''}>Eastern</option>
            <option value="West" ${team.conference === 'West' ? 'selected' : ''}>Western</option>
          </select>
        </div>

        <div>
          <label style="display: block; color: #888; margin-bottom: 6px; font-size: 0.9em;">Division</label>
          <input 
            type="text" 
            value="${team.division || ''}"
            oninput="updateTeamField('division', this.value)"
            style="
              width: 100%;
              padding: 12px;
              background: #0f1624;
              color: #fff;
              border: 1px solid #2a2a40;
              border-radius: 6px;
            "
          />
        </div>
      </div>
    </div>
  `;
}

function renderBrandingSection(team) {
  return `
    <div style="background: #1a2332; border-radius: 12px; padding: 25px; margin-bottom: 20px; border: 1px solid #2a2a40;">
      <h3 style="margin: 0 0 20px 0; color: #2196F3; font-size: 1.4em;">🎨 Branding</h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
        <div>
          <label style="display: block; color: #888; margin-bottom: 6px; font-size: 0.9em;">Primary Color</label>
          <div style="display: flex; gap: 10px; align-items: center;">
            <input 
              type="color" 
              value="${team.primaryColor || '#2196F3'}"
              oninput="updateTeamField('primaryColor', this.value)"
              style="
                width: 60px;
                height: 45px;
                border: 1px solid #2a2a40;
                border-radius: 6px;
                cursor: pointer;
              "
            />
            <input 
              type="text" 
              value="${team.primaryColor || '#2196F3'}"
              oninput="updateTeamField('primaryColor', this.value)"
              style="
                flex: 1;
                padding: 12px;
                background: #0f1624;
                color: #fff;
                border: 1px solid #2a2a40;
                border-radius: 6px;
              "
            />
          </div>
        </div>

        <div>
          <label style="display: block; color: #888; margin-bottom: 6px; font-size: 0.9em;">Secondary Color</label>
          <div style="display: flex; gap: 10px; align-items: center;">
            <input 
              type="color" 
              value="${team.secondaryColor || '#1976D2'}"
              oninput="updateTeamField('secondaryColor', this.value)"
              style="
                width: 60px;
                height: 45px;
                border: 1px solid #2a2a40;
                border-radius: 6px;
                cursor: pointer;
              "
            />
            <input 
              type="text" 
              value="${team.secondaryColor || '#1976D2'}"
              oninput="updateTeamField('secondaryColor', this.value)"
              style="
                flex: 1;
                padding: 12px;
                background: #0f1624;
                color: #fff;
                border: 1px solid #2a2a40;
                border-radius: 6px;
              "
            />
          </div>
        </div>

        <div>
          <label style="display: block; color: #888; margin-bottom: 6px; font-size: 0.9em;">Logo URL (optional)</label>
          <input 
            type="text" 
            value="${team.logoUrl || ''}"
            placeholder="https://..."
            oninput="updateTeamField('logoUrl', this.value)"
            style="
              width: 100%;
              padding: 12px;
              background: #0f1624;
              color: #fff;
              border: 1px solid #2a2a40;
              border-radius: 6px;
            "
          />
        </div>
      </div>
    </div>
  `;
}

function renderLocationSection(team) {
  return `
    <div style="background: #1a2332; border-radius: 12px; padding: 25px; margin-bottom: 20px; border: 1px solid #2a2a40;">
      <h3 style="margin: 0 0 20px 0; color: #2196F3; font-size: 1.4em;">📍 Home & Location</h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
        <div>
          <label style="display: block; color: #888; margin-bottom: 6px; font-size: 0.9em;">Arena Name</label>
          <input 
            type="text" 
            value="${team.arenaName || ''}"
            placeholder="Home Arena"
            oninput="updateTeamField('arenaName', this.value)"
            style="
              width: 100%;
              padding: 12px;
              background: #0f1624;
              color: #fff;
              border: 1px solid #2a2a40;
              border-radius: 6px;
            "
          />
        </div>

        <div>
          <label style="display: block; color: #888; margin-bottom: 6px; font-size: 0.9em;">Arena Capacity</label>
          <input 
            type="number" 
            value="${team.arenaCapacity || 18000}"
            min="5000"
            max="30000"
            oninput="updateTeamField('arenaCapacity', parseInt(this.value))"
            style="
              width: 100%;
              padding: 12px;
              background: #0f1624;
              color: #fff;
              border: 1px solid #2a2a40;
              border-radius: 6px;
            "
          />
        </div>

        <div>
          <label style="display: block; color: #888; margin-bottom: 6px; font-size: 0.9em;">Home Court Advantage</label>
          <select 
            onchange="updateTeamField('homeCourtAdvantage', this.value)"
            style="
              width: 100%;
              padding: 12px;
              background: #0f1624;
              color: #fff;
              border: 1px solid #2a2a40;
              border-radius: 6px;
              cursor: pointer;
            "
          >
            <option value="Low" ${team.homeCourtAdvantage === 'Low' ? 'selected' : ''}>Low</option>
            <option value="Normal" ${(!team.homeCourtAdvantage || team.homeCourtAdvantage === 'Normal') ? 'selected' : ''}>Normal</option>
            <option value="High" ${team.homeCourtAdvantage === 'High' ? 'selected' : ''}>High</option>
          </select>
        </div>

        <div>
          <label style="display: block; color: #888; margin-bottom: 6px; font-size: 0.9em;">Country</label>
          <select 
            onchange="updateTeamField('country', this.value)"
            style="
              width: 100%;
              padding: 12px;
              background: #0f1624;
              color: #fff;
              border: 1px solid #2a2a40;
              border-radius: 6px;
              cursor: pointer;
            "
          >
            <option value="USA" ${(!team.country || team.country === 'USA') ? 'selected' : ''}>United States</option>
            <option value="Canada" ${team.country === 'Canada' ? 'selected' : ''}>Canada</option>
            <option value="Mexico" ${team.country === 'Mexico' ? 'selected' : ''}>Mexico</option>
          </select>
        </div>
      </div>
    </div>
  `;
}

function renderFrontOfficeSection(team) {
  return `
    <div style="background: #1a2332; border-radius: 12px; padding: 25px; margin-bottom: 20px; border: 1px solid #2a2a40;">
      <h3 style="margin: 0 0 20px 0; color: #2196F3; font-size: 1.4em;">👔 Front Office</h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
        <div>
          <label style="display: block; color: #888; margin-bottom: 6px; font-size: 0.9em;">Owner Name</label>
          <input 
            type="text" 
            value="${team.ownerName || ''}"
            placeholder="Team Owner"
            oninput="updateTeamField('ownerName', this.value)"
            style="
              width: 100%;
              padding: 12px;
              background: #0f1624;
              color: #fff;
              border: 1px solid #2a2a40;
              border-radius: 6px;
            "
          />
        </div>

        <div>
          <label style="display: block; color: #888; margin-bottom: 6px; font-size: 0.9em;">GM Name</label>
          <input 
            type="text" 
            value="${team.gmName || ''}"
            placeholder="General Manager"
            oninput="updateTeamField('gmName', this.value)"
            style="
              width: 100%;
              padding: 12px;
              background: #0f1624;
              color: #fff;
              border: 1px solid #2a2a40;
              border-radius: 6px;
            "
          />
        </div>

        <div>
          <label style="display: block; color: #888; margin-bottom: 6px; font-size: 0.9em;">Coach Name</label>
          <input 
            type="text" 
            value="${team.coachName || ''}"
            placeholder="Head Coach"
            oninput="updateTeamField('coachName', this.value)"
            style="
              width: 100%;
              padding: 12px;
              background: #0f1624;
              color: #fff;
              border: 1px solid #2a2a40;
              border-radius: 6px;
            "
          />
        </div>

        <div>
          <label style="display: block; color: #888; margin-bottom: 6px; font-size: 0.9em;">Team Philosophy</label>
          <select 
            onchange="updateTeamField('philosophy', this.value)"
            style="
              width: 100%;
              padding: 12px;
              background: #0f1624;
              color: #fff;
              border: 1px solid #2a2a40;
              border-radius: 6px;
              cursor: pointer;
            "
          >
            <option value="Win Now" ${team.philosophy === 'Win Now' ? 'selected' : ''}>Win Now</option>
            <option value="Balanced" ${(!team.philosophy || team.philosophy === 'Balanced') ? 'selected' : ''}>Balanced</option>
            <option value="Rebuild" ${team.philosophy === 'Rebuild' ? 'selected' : ''}>Rebuild</option>
            <option value="Player Development" ${team.philosophy === 'Player Development' ? 'selected' : ''}>Player Development</option>
          </select>
        </div>
      </div>
    </div>
  `;
}

function renderVisibilitySection(team) {
  const isUserTeam = league.userTeamId === team.id;
  
  return `
    <div style="background: #1a2332; border-radius: 12px; padding: 25px; margin-bottom: 20px; border: 1px solid #2a2a40;">
      <h3 style="margin: 0 0 20px 0; color: #2196F3; font-size: 1.4em;">⚙️ Settings</h3>
      
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #0f1624; border-radius: 6px;">
          <div>
            <div style="color: #fff; font-weight: bold;">User-Controlled Team</div>
            <div style="color: #888; font-size: 0.85em;">This is your team</div>
          </div>
          <div style="
            padding: 6px 16px;
            background: ${isUserTeam ? '#4CAF50' : '#888'};
            color: #fff;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: bold;
          ">${isUserTeam ? 'Yes' : 'No'}</div>
        </div>

        <div style="padding: 15px; background: #0f1624; border-radius: 6px; border-left: 3px solid #2196F3;">
          <div style="color: #888; font-size: 0.9em; line-height: 1.6;">
            <strong style="color: #fff;">Note:</strong> Roster, contracts, and salary information are managed in other tabs. 
            This page only edits team identity, branding, and organizational settings.
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ============================
   NEWS TAB (News Feed)
============================ */

// Initialize news feed if missing
function initNewsFeed(league) {
  if (!league.news) {
    league.news = {
      items: [],
      nextId: 1,
      readItems: new Set()
    };
    
    // Add welcome news for existing leagues
    addNewsItem(league, 'welcome', {
      leagueName: league.name,
      season: league.season
    });
  }
  return league.news;
}

// News item templates
const NEWS_TEMPLATES = {
  welcome: (data) => ({
    category: 'league',
    importance: 3,
    headline: `Welcome to ${data.leagueName}`,
    summary: `Your basketball management journey begins in Season ${data.season}. Build your dynasty, make smart moves, and lead your team to glory.`,
    body: `The ${data.leagueName} season is underway! Navigate through the tabs to manage your roster, scout free agents, make trades, and guide your team through the season. Check back here for all league updates, transactions, and breaking news.`,
    entities: {}
  }),
  
  gameSummary: (data) => ({
    category: 'games',
    importance: data.upset ? 4 : 2,
    headline: `${data.winner} ${data.upset ? 'upset' : 'defeat'} ${data.loser}, ${data.winnerScore}–${data.loserScore}`,
    summary: `${data.leadScorer} led all scorers with ${data.leadPoints} points. ${data.winner} ${data.winStreak > 2 ? `extend win streak to ${data.winStreak}` : `improve to ${data.winnerRecord}`}.`,
    body: `In a ${data.upset ? 'stunning upset' : 'hard-fought battle'}, the ${data.winner} came away with a ${data.winnerScore}-${data.loserScore} victory over the ${data.loser}. ${data.leadScorer} was the star of the show with ${data.leadPoints} points, ${data.leadRebs} rebounds, and ${data.leadAsts} assists. The ${data.winner} now sit at ${data.winnerRecord} while the ${data.loser} fall to ${data.loserRecord}.`,
    entities: { gameId: data.gameId, teams: [data.winnerTeamId, data.loserTeamId], players: [data.leadPlayerId] }
  }),
  
  injury: (data) => ({
    category: 'injuries',
    importance: data.severity === 'major' ? 5 : 3,
    headline: `${data.playerName} ${data.severity === 'major' ? 'sidelined' : 'exits'} with ${data.injury}`,
    summary: `The ${data.teamName} ${data.position} is expected to miss ${data.games} games. ${data.replacement} likely to see increased minutes.`,
    body: `${data.playerName} suffered a ${data.injury} during ${data.context || 'today\'s game'} and will be out for approximately ${data.games} games. This is a significant blow to the ${data.teamName}, who have relied heavily on ${data.playerName}'s ${data.stat} per game this season. Look for ${data.replacement} to step into an expanded role during the absence.`,
    entities: { players: [data.playerId], teams: [data.teamId] }
  }),
  
  signing: (data) => ({
    category: 'transactions',
    importance: data.major ? 4 : 2,
    headline: `${data.teamName} sign ${data.playerName} to ${data.years}-year deal`,
    summary: `${data.playerName} joins the ${data.teamName} on a ${data.years}yr/${data.totalValue}M contract. Expected to ${data.role}.`,
    body: `The ${data.teamName} have officially signed ${data.position} ${data.playerName} to a ${data.years}-year, $${data.totalValue}M contract (${data.annualValue}M/yr). ${data.playerName} is expected to ${data.role} and should provide ${data.strengths}. This signing ${data.capImpact}.`,
    entities: { players: [data.playerId], teams: [data.teamId] }
  }),
  
  trade: (data) => ({
    category: 'transactions',
    importance: data.blockbuster ? 5 : 3,
    headline: `${data.blockbuster ? 'BLOCKBUSTER: ' : ''}${data.team1Name} acquire ${data.headliner}`,
    summary: `${data.team1Name} get ${data.team1Gets}. ${data.team2Name} receive ${data.team2Gets}.`,
    body: `In a ${data.blockbuster ? 'massive' : 'significant'} trade, the ${data.team1Name} have acquired ${data.team1Gets} from the ${data.team2Name} in exchange for ${data.team2Gets}. ${data.analysis}`,
    entities: { teams: [data.team1Id, data.team2Id], players: data.playerIds || [] }
  }),
  
  rumor: (data) => ({
    category: 'rumors',
    importance: 2,
    headline: `${data.likelihood === 'high' ? 'RUMOR: ' : 'Whispers: '}${data.headline}`,
    summary: `${data.summary} (Likelihood: ${data.likelihood.toUpperCase()})`,
    body: `${data.body} League sources caution that this is unconfirmed and subject to change.`,
    entities: { teams: data.teamIds || [], players: data.playerIds || [] }
  }),
  
  milestone: (data) => ({
    category: 'awards',
    importance: 4,
    headline: `${data.playerName} ${data.achievement}`,
    summary: `The ${data.teamName} ${data.position} becomes ${data.context}.`,
    body: `${data.playerName} has reached a major career milestone, ${data.achievement}. ${data.details} "${data.quote || 'I\'m honored and grateful for this moment'}," ${data.playerName} said after the game.`,
    entities: { players: [data.playerId], teams: [data.teamId] }
  }),
  
  mvpRace: (data) => ({
    category: 'awards',
    importance: 3,
    headline: `MVP Ladder: ${data.week}`,
    summary: `${data.leader} leads the pack with ${data.leaderStats}. ${data.challenger} close behind.`,
    body: `As we reach ${data.week} of the season, here are the top MVP candidates:\n\n1. ${data.top5[0]}\n2. ${data.top5[1]}\n3. ${data.top5[2]}\n4. ${data.top5[3]}\n5. ${data.top5[4]}\n\n${data.analysis}`,
    entities: { players: data.playerIds || [] }
  }),
  
  chemistry: (data) => ({
    category: 'chemistry',
    importance: 3,
    headline: `${data.headline}`,
    summary: `${data.summary}`,
    body: `${data.body} This could impact team performance and chemistry going forward.`,
    entities: { teams: [data.teamId], players: data.playerIds || [] }
  }),
  
  capAlert: (data) => ({
    category: 'finance',
    importance: 3,
    headline: `${data.teamName} ${data.status} salary cap`,
    summary: `Currently ${data.overUnder} by $${data.amount}M. ${data.consequence}`,
    body: `The ${data.teamName} are projected to ${data.status} the salary cap threshold, sitting ${data.overUnder} by approximately $${data.amount}M. ${data.details}`,
    entities: { teams: [data.teamId] }
  }),
  
  teamRebrand: (data) => ({
    category: 'league',
    importance: 3,
    headline: `${data.teamName} announce ${data.changes.includes('identity') ? 'rebrand' : 'organizational changes'}`,
    summary: `The ${data.teamName} have made ${data.changes} updates to their team identity and presentation.`,
    body: `In a move that has fans talking, the ${data.teamName} have officially announced changes to their ${data.changes}. The organization hopes these updates will usher in a new era of success for the franchise.`,
    entities: { teams: [data.teamId] }
  })
};

// Create news item
function createNewsItem(template, data) {
  const templateFn = NEWS_TEMPLATES[template];
  if (!templateFn) {
    console.error(`Unknown news template: ${template}`);
    return null;
  }
  
  const newsData = templateFn(data);
  return {
    ...newsData,
    day: league.currentDay || 0,
    phase: league.phase || 'preseason',
    readByUser: false,
    timestamp: Date.now()
  };
}

// Add news to league
function addNewsItem(league, template, data = {}) {
  const news = initNewsFeed(league);
  const item = createNewsItem(template, data);
  
  if (!item) return;
  
  item.id = news.nextId++;
  news.items.unshift(item); // Add to front (newest first)
  
  // Keep last 500 items
  if (news.items.length > 500) {
    news.items = news.items.slice(0, 500);
  }
  
  save();
  return item;
}

// Get filtered news
function getFilteredNews(league, filters) {
  const news = initNewsFeed(league);
  let items = [...news.items];
  
  // Category filter
  if (filters.category !== 'all') {
    if (filters.category === 'myteam') {
      const userTeamId = league.userTeamId;
      items = items.filter(item => 
        item.entities?.teams?.includes(userTeamId) ||
        item.entities?.players?.some(pid => {
          const player = findPlayerById(pid);
          return player && player.teamId === userTeamId;
        })
      );
    } else {
      items = items.filter(item => item.category === filters.category);
    }
  }
  
  // Search filter
  if (filters.search) {
    const search = filters.search.toLowerCase();
    items = items.filter(item =>
      item.headline.toLowerCase().includes(search) ||
      item.summary.toLowerCase().includes(search)
    );
  }
  
  // Read/unread filter
  if (!filters.showRead) {
    items = items.filter(item => !news.readItems.has(item.id));
  }
  
  return items;
}

// Mark news as read
function markNewsAsRead(newsId) {
  const news = initNewsFeed(league);
  news.readItems.add(newsId);
  save();
}

// Mark all as read
function markAllNewsAsRead() {
  const news = initNewsFeed(league);
  news.items.forEach(item => news.readItems.add(item.id));
  save();
  render();
}

// Toggle news item expansion
function toggleNewsExpanded(newsId) {
  if (expandedNewsItems.has(newsId)) {
    expandedNewsItems.delete(newsId);
  } else {
    expandedNewsItems.add(newsId);
    markNewsAsRead(newsId);
  }
  render();
}

// Main News Tab Renderer
function renderNewsTab() {
  const el = document.getElementById('news-tab');
  if (!league) {
    el.innerHTML = '<div style="padding: 20px; color: #fff;">No league loaded</div>';
    return;
  }
  
  const news = initNewsFeed(league);
  const currentDay = getCurrentDay();
  const phaseLabel = league.phase === 'preseason' ? 'Preseason' :
                     league.phase === 'regular' ? 'Regular Season' :
                     league.phase === 'playoffs' ? 'Playoffs' : 'Offseason';
  
  const unreadCount = news.items.filter(item => !news.readItems.has(item.id)).length;
  
  el.innerHTML = `
    <div style="min-height: 100vh; background: #0f1624; padding-bottom: 40px;">
      <!-- Header -->
      <div style="
        background: linear-gradient(135deg, #1a2332 0%, #0f1624 100%);
        padding: 30px 20px 20px 20px;
        border-bottom: 2px solid #2a2a40;
      ">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div>
            <h1 style="margin: 0 0 8px 0; color: #fff; font-size: 2em;">📰 News</h1>
            <div style="color: #888; font-size: 0.95em;">
              Season ${league.season} • Day ${currentDay} • ${phaseLabel}
            </div>
          </div>
          ${unreadCount > 0 ? `
            <div style="
              background: #2196F3;
              color: #fff;
              padding: 6px 12px;
              border-radius: 20px;
              font-size: 0.85em;
              font-weight: bold;
            ">${unreadCount} unread</div>
          ` : ''}
        </div>
      </div>

      <!-- Controls -->
      ${renderNewsControls()}

      <!-- Sub-tabs -->
      <div style="
        background: #0f1624;
        padding: 0 10px;
        border-bottom: 2px solid #2a2a40;
        display: flex;
        overflow-x: auto;
        position: sticky;
        top: 0;
        z-index: 10;
      ">
        ${['feed', 'inbox', 'breaking'].map(tab => {
          const labels = { feed: 'Feed', inbox: 'My Team', breaking: 'Breaking' };
          return `
            <button onclick="switchNewsSubTab('${tab}')" style="
              padding: 14px 20px;
              background: ${newsSubTab === tab ? '#2196F3' : 'transparent'};
              color: ${newsSubTab === tab ? '#fff' : '#888'};
              border: none;
              border-bottom: 3px solid ${newsSubTab === tab ? '#2196F3' : 'transparent'};
              cursor: pointer;
              font-weight: ${newsSubTab === tab ? 'bold' : 'normal'};
              white-space: nowrap;
              transition: all 0.2s;
            ">${labels[tab]}</button>
          `;
        }).join('')}
      </div>

      <!-- Content -->
      <div style="max-width: 900px; margin: 0 auto; padding: 20px;">
        ${renderNewsFeed()}
      </div>
    </div>
  `;
}

function renderNewsControls() {
  return `
    <div style="
      background: #1a2332;
      padding: 15px 20px;
      border-bottom: 1px solid #2a2a40;
      display: grid;
      grid-template-columns: 1fr 2fr auto;
      gap: 12px;
      align-items: center;
    ">
      <select onchange="setNewsCategory(this.value)" style="
        padding: 10px 12px;
        background: #0f1624;
        color: #fff;
        border: 1px solid #2a2a40;
        border-radius: 6px;
        cursor: pointer;
      ">
        <option value="all" ${newsFilters.category === 'all' ? 'selected' : ''}>All News</option>
        <option value="myteam" ${newsFilters.category === 'myteam' ? 'selected' : ''}>My Team</option>
        <option value="transactions" ${newsFilters.category === 'transactions' ? 'selected' : ''}>Transactions</option>
        <option value="games" ${newsFilters.category === 'games' ? 'selected' : ''}>Games</option>
        <option value="injuries" ${newsFilters.category === 'injuries' ? 'selected' : ''}>Injuries</option>
        <option value="rumors" ${newsFilters.category === 'rumors' ? 'selected' : ''}>Rumors</option>
        <option value="awards" ${newsFilters.category === 'awards' ? 'selected' : ''}>Awards</option>
        <option value="chemistry" ${newsFilters.category === 'chemistry' ? 'selected' : ''}>Chemistry</option>
        <option value="finance" ${newsFilters.category === 'finance' ? 'selected' : ''}>Finance</option>
      </select>

      <input 
        type="text" 
        placeholder="Search news..."
        value="${newsFilters.search}"
        oninput="setNewsSearch(this.value)"
        style="
          padding: 10px 12px;
          background: #0f1624;
          color: #fff;
          border: 1px solid #2a2a40;
          border-radius: 6px;
        "
      />

      <button onclick="markAllNewsAsRead()" style="
        padding: 10px 20px;
        background: #2a2a40;
        color: #fff;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        white-space: nowrap;
      ">Mark All Read</button>
    </div>
  `;
}

function switchNewsSubTab(tab) {
  newsSubTab = tab;
  render();
}

function setNewsCategory(category) {
  newsFilters.category = category;
  render();
}

function setNewsSearch(value) {
  newsFilters.search = value;
  render();
}

function renderNewsFeed() {
  let items = getFilteredNews(league, newsFilters);
  
  // Filter by sub-tab
  if (newsSubTab === 'inbox') {
    const userTeamId = league.userTeamId;
    items = items.filter(item =>
      item.entities?.teams?.includes(userTeamId) ||
      item.entities?.players?.some(pid => {
        const player = findPlayerById(pid);
        return player && player.teamId === userTeamId;
      })
    );
  } else if (newsSubTab === 'breaking') {
    items = items.filter(item => item.importance >= 4);
  }
  
  if (items.length === 0) {
    return `
      <div style="text-align: center; padding: 80px 20px; color: #888;">
        <div style="font-size: 3em; margin-bottom: 20px;">📰</div>
        <div style="font-size: 1.2em; margin-bottom: 10px;">No news yet</div>
        <div style="font-size: 0.9em;">Check back after simulating days or making transactions</div>
      </div>
    `;
  }
  
  // Show first 50 items (pagination can be added later)
  return `
    <div style="display: flex; flex-direction: column; gap: 15px;">
      ${items.slice(0, 50).map(item => renderNewsCard(item)).join('')}
    </div>
  `;
}

function renderNewsCard(item) {
  const news = initNewsFeed(league);
  const isRead = news.readItems.has(item.id);
  const isExpanded = expandedNewsItems.has(item.id);
  
  const categoryColors = {
    games: '#2196F3',
    injuries: '#f44336',
    transactions: '#4CAF50',
    rumors: '#9C27B0',
    awards: '#FFD700',
    league: '#2196F3',
    chemistry: '#FF9800',
    finance: '#00BCD4',
    draft: '#E91E63'
  };
  
  const categoryColor = categoryColors[item.category] || '#2196F3';
  
  return `
    <div style="
      background: ${isRead ? '#141e2e' : 'linear-gradient(135deg, #1a2332 0%, #1a2840 100%)'};
      border-radius: 12px;
      padding: 20px;
      border: 1px solid ${isRead ? '#2a2a40' : '#2196F3'};
      ${!isRead ? 'box-shadow: 0 0 20px rgba(33, 150, 243, 0.2);' : ''}
      position: relative;
      transition: all 0.3s;
    ">
      ${!isRead ? `
        <div style="
          position: absolute;
          top: 15px;
          right: 15px;
          width: 10px;
          height: 10px;
          background: #2196F3;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(33, 150, 243, 0.5);
        "></div>
      ` : ''}
      
      <!-- Category Badge & Timestamp -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="
          background: ${categoryColor};
          color: #fff;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.75em;
          font-weight: bold;
          text-transform: uppercase;
        ">${item.category}</span>
        <span style="color: #888; font-size: 0.85em;">
          Day ${item.day} ${item.importance >= 4 ? '• 🔥 BREAKING' : ''}
        </span>
      </div>
      
      <!-- Headline -->
      <h3 style="
        color: #fff;
        margin: 0 0 10px 0;
        font-size: 1.3em;
        line-height: 1.4;
      ">${item.headline}</h3>
      
      <!-- Summary -->
      <p style="
        color: ${isRead ? '#888' : '#ccc'};
        margin: 0 0 15px 0;
        line-height: 1.6;
        font-size: 0.95em;
      ">${item.summary}</p>
      
      <!-- Expanded Body -->
      ${isExpanded ? `
        <div style="
          color: #aaa;
          margin: 15px 0;
          padding: 15px;
          background: #0f1624;
          border-radius: 8px;
          line-height: 1.7;
          white-space: pre-wrap;
        ">${item.body}</div>
      ` : ''}
      
      <!-- Actions -->
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button onclick="toggleNewsExpanded(${item.id})" style="
          padding: 8px 16px;
          background: #2a2a40;
          color: #2196F3;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
          font-size: 0.85em;
        ">${isExpanded ? '▲ Show Less' : '▼ Read More'}</button>
        
        ${renderNewsActions(item)}
      </div>
    </div>
  `;
}

function renderNewsActions(item) {
  const actions = [];
  
  if (item.entities?.players && item.entities.players.length > 0) {
    actions.push(`
      <button onclick="alert('Player page coming soon!')" style="
        padding: 8px 16px;
        background: #2a2a40;
        color: #fff;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.85em;
      ">👤 View Player</button>
    `);
  }
  
  if (item.entities?.teams && item.entities.teams.length > 0) {
    actions.push(`
      <button onclick="alert('Team page coming soon!')" style="
        padding: 8px 16px;
        background: #2a2a40;
        color: #fff;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.85em;
      ">🏀 View Team</button>
    `);
  }
  
  if (item.entities?.gameId) {
    actions.push(`
      <button onclick="alert('Box score coming soon!')" style="
        padding: 8px 16px;
        background: #2a2a40;
        color: #fff;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.85em;
      ">📊 Box Score</button>
    `);
  }
  
  return actions.join('');
}

function findPlayerById(playerId) {
  if (!league || !league.teams) return null;
  for (const team of league.teams) {
    const player = team.players?.find(p => p.id === playerId);
    if (player) return player;
  }
  return null;
}

/* ============================
   STATS TAB
============================ */

function renderAwardsTab() {
  const el = document.getElementById('awards-tab');
  if (!league) {
    el.innerHTML = '<div style="padding: 20px; color: #fff;">No league loaded</div>';
    return;
  }
  
  // Awards tab is rendered by awards-tab.js
  if (typeof renderAwardRaces === 'function') {
    el.innerHTML = renderAwardRaces();
  } else {
    el.innerHTML = '<div style="padding: 20px; color: #fff;">Awards system loading...</div>';
  }
}

function renderCareerTab() {
  const el = document.getElementById('career-tab');
  if (!league) {
    el.innerHTML = '<div style="padding: 20px; color: #fff;">No league loaded</div>';
    return;
  }
  
  // Career tab is rendered by job-security.js
  if (typeof renderCareerHistoryTab === 'function') {
    el.innerHTML = renderCareerHistoryTab();
  } else {
    el.innerHTML = '<div style="padding: 20px; color: #fff;">Career tracking system loading...</div>';
  }
}

/* ============================
   STATS TAB
============================ */

function renderStatsTab() {
  const el = document.getElementById('stats-tab');
  if (!league) {
    el.innerHTML = '<div style="padding: 20px; color: #fff;">No league loaded</div>';
    return;
  }

  const selectedSeason = statsFilters.season || league.season;
  const phaseLabel = statsFilters.phase === 'regular' ? 'Regular Season' : 
                     statsFilters.phase === 'playoffs' ? 'Playoffs' : 'Preseason';

  el.innerHTML = `
    <div style="min-height: 100vh; background: #0f1624; padding-bottom: 40px;">
      <!-- Header -->
      <div style="
        background: linear-gradient(135deg, #1a2332 0%, #0f1624 100%);
        padding: 30px 20px 20px 20px;
        border-bottom: 2px solid #2a2a40;
      ">
        <h1 style="margin: 0 0 8px 0; color: #fff; font-size: 2em;">📊 Stats</h1>
        <div style="color: #888; font-size: 0.95em;">
          Season ${selectedSeason} • ${phaseLabel}
        </div>
      </div>

      <!-- Controls -->
      ${renderStatsControls(selectedSeason)}

      <!-- Sub-tabs -->
      <div style="
        background: #0f1624;
        padding: 0 10px;
        border-bottom: 2px solid #2a2a40;
        display: flex;
        overflow-x: auto;
        position: sticky;
        top: 0;
        z-index: 10;
      ">
        ${['playerLeaders', 'playerTable', 'teamLeaders', 'teamTable', 'advanced', 'gameLogs'].map(tab => {
          const labels = {
            playerLeaders: 'Player Leaders',
            playerTable: 'Player Table',
            teamLeaders: 'Team Leaders',
            teamTable: 'Team Table',
            advanced: 'Advanced',
            gameLogs: 'Game Logs'
          };
          return `
            <button onclick="switchStatsSubTab('${tab}')" style="
              padding: 14px 20px;
              background: ${statsSubTab === tab ? '#2196F3' : 'transparent'};
              color: ${statsSubTab === tab ? '#fff' : '#888'};
              border: none;
              border-bottom: 3px solid ${statsSubTab === tab ? '#2196F3' : 'transparent'};
              cursor: pointer;
              font-weight: ${statsSubTab === tab ? 'bold' : 'normal'};
              white-space: nowrap;
              transition: all 0.2s;
            ">${labels[tab]}</button>
          `;
        }).join('')}
      </div>

      <!-- Content -->
      <div style="max-width: 1400px; margin: 0 auto; padding: 20px;">
        ${renderStatsTabContent()}
      </div>
    </div>
  `;
}

function renderStatsControls(selectedSeason) {
  return `
    <div style="
      background: #1a2332;
      padding: 15px 20px;
      border-bottom: 1px solid #2a2a40;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
    ">
      <select onchange="setStatsSeason(this.value)" style="
        padding: 10px 12px;
        background: #0f1624;
        color: #fff;
        border: 1px solid #2a2a40;
        border-radius: 6px;
        cursor: pointer;
      ">
        <option value="${league.season}" ${!statsFilters.season ? 'selected' : ''}>Current Season (${league.season})</option>
      </select>

      <div style="display: flex; gap: 8px; background: #0f1624; border-radius: 6px; padding: 4px;">
        ${['regular', 'playoffs', 'preseason'].map(phase => `
          <button onclick="setStatsPhase('${phase}')" style="
            flex: 1;
            padding: 8px;
            background: ${statsFilters.phase === phase ? '#2196F3' : 'transparent'};
            color: ${statsFilters.phase === phase ? '#fff' : '#888'};
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.85em;
            font-weight: ${statsFilters.phase === phase ? 'bold' : 'normal'};
          ">${phase.charAt(0).toUpperCase() + phase.slice(1)}</button>
        `).join('')}
      </div>

      <div style="display: flex; gap: 8px; background: #0f1624; border-radius: 6px; padding: 4px;">
        <button onclick="togglePerGame(true)" style="
          flex: 1;
          padding: 8px;
          background: ${statsFilters.perGame ? '#2196F3' : 'transparent'};
          color: ${statsFilters.perGame ? '#fff' : '#888'};
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.85em;
          font-weight: ${statsFilters.perGame ? 'bold' : 'normal'};
        ">Per Game</button>
        <button onclick="togglePerGame(false)" style="
          flex: 1;
          padding: 8px;
          background: ${!statsFilters.perGame ? '#2196F3' : 'transparent'};
          color: ${!statsFilters.perGame ? '#fff' : '#888'};
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.85em;
          font-weight: ${!statsFilters.perGame ? 'bold' : 'normal'};
        ">Totals</button>
      </div>

      <input 
        type="text" 
        placeholder="Search player/team..."
        value="${statsFilters.search}"
        oninput="setStatsSearch(this.value)"
        style="
          padding: 10px 12px;
          background: #0f1624;
          color: #fff;
          border: 1px solid #2a2a40;
          border-radius: 6px;
        "
      />
    </div>
  `;
}

function switchStatsSubTab(tab) {
  statsSubTab = tab;
  render();
}

function setStatsSeason(season) {
  statsFilters.season = season === String(league.season) ? null : season;
  render();
}

function setStatsPhase(phase) {
  statsFilters.phase = phase;
  render();
}

function togglePerGame(perGame) {
  statsFilters.perGame = perGame;
  render();
}

function setStatsSearch(value) {
  statsFilters.search = value;
  render();
}

function renderStatsTabContent() {
  switch(statsSubTab) {
    case 'playerLeaders':
      return renderPlayerLeaders();
    case 'playerTable':
      return renderPlayerTable();
    case 'teamLeaders':
      return renderTeamLeaders();
    case 'teamTable':
      return renderTeamTable();
    case 'advanced':
      return renderAdvancedStats();
    case 'gameLogs':
      return renderGameLogs();
    default:
      return '<div style="padding: 20px; color: #888;">Select a view</div>';
  }
}

// Get player season stats
function getPlayerSeasonStats() {
  if (!league || !league.teams) return [];
  
  const stats = [];
  league.teams.forEach(team => {
    if (!team.players) return;
    team.players.forEach(player => {
      const seasonStats = player.seasonStats || player.stats || {};
      const gp = seasonStats.gp || seasonStats.gamesPlayed || 0;
      
      if (gp === 0) return; // Skip players with no games
      
      const pts = seasonStats.pts || seasonStats.points || 0;
      const reb = seasonStats.reb || seasonStats.rebounds || 0;
      const ast = seasonStats.ast || seasonStats.assists || 0;
      const stl = seasonStats.stl || seasonStats.steals || 0;
      const blk = seasonStats.blk || seasonStats.blocks || 0;
      const tov = seasonStats.tov || seasonStats.turnovers || 0;
      const fgm = seasonStats.fgm || 0;
      const fga = seasonStats.fga || 1;
      const tpm = seasonStats.tpm || seasonStats['3pm'] || 0;
      const tpa = seasonStats.tpa || seasonStats['3pa'] || 1;
      const ftm = seasonStats.ftm || 0;
      const fta = seasonStats.fta || 1;
      const min = seasonStats.min || seasonStats.minutes || 0;
      
      stats.push({
        playerId: player.id,
        name: `${player.firstName} ${player.lastName}`,
        teamId: team.id,
        teamName: team.name,
        position: player.position || 'F',
        gp: gp,
        min: min,
        pts: pts,
        reb: reb,
        ast: ast,
        stl: stl,
        blk: blk,
        tov: tov,
        fgm: fgm,
        fga: fga,
        tpm: tpm,
        tpa: tpa,
        ftm: ftm,
        fta: fta,
        fgPct: fga > 0 ? (fgm / fga * 100) : 0,
        tpPct: tpa > 0 ? (tpm / tpa * 100) : 0,
        ftPct: fta > 0 ? (ftm / fta * 100) : 0,
        ppg: gp > 0 ? pts / gp : 0,
        rpg: gp > 0 ? reb / gp : 0,
        apg: gp > 0 ? ast / gp : 0,
        spg: gp > 0 ? stl / gp : 0,
        bpg: gp > 0 ? blk / gp : 0,
        topg: gp > 0 ? tov / gp : 0,
        mpg: gp > 0 ? min / gp : 0
      });
    });
  });
  
  return stats;
}

// Get team season stats
function getTeamSeasonStats() {
  if (!league || !league.teams) return [];
  
  return league.teams.map(team => {
    const stats = team.seasonStats || team.stats || {};
    const gp = stats.gp || team.wins + team.losses || 0;
    
    return {
      teamId: team.id,
      name: team.name,
      wins: team.wins || 0,
      losses: team.losses || 0,
      gp: gp,
      pts: stats.pts || 0,
      oppPts: stats.oppPts || 0,
      fgm: stats.fgm || 0,
      fga: stats.fga || 1,
      tpm: stats.tpm || 0,
      tpa: stats.tpa || 1,
      ftm: stats.ftm || 0,
      fta: stats.fta || 1,
      reb: stats.reb || 0,
      ast: stats.ast || 0,
      stl: stats.stl || 0,
      blk: stats.blk || 0,
      tov: stats.tov || 0,
      ppg: gp > 0 ? stats.pts / gp : 0,
      oppPpg: gp > 0 ? stats.oppPts / gp : 0,
      diff: gp > 0 ? (stats.pts - stats.oppPts) / gp : 0,
      fgPct: stats.fga > 0 ? (stats.fgm / stats.fga * 100) : 0,
      tpPct: stats.tpa > 0 ? (stats.tpm / stats.tpa * 100) : 0,
      ftPct: stats.fta > 0 ? (stats.ftm / stats.fta * 100) : 0
    };
  });
}

// 1) PLAYER LEADERS
function renderPlayerLeaders() {
  const playerStats = getPlayerSeasonStats();
  
  if (playerStats.length === 0) {
    return `
      <div style="text-align: center; padding: 80px 20px; color: #888;">
        <div style="font-size: 3em; margin-bottom: 20px;">📊</div>
        <div style="font-size: 1.2em;">No player stats available</div>
      </div>
    `;
  }
  
  const leaders = {
    ppg: [...playerStats].sort((a, b) => b.ppg - a.ppg).slice(0, 5),
    rpg: [...playerStats].sort((a, b) => b.rpg - a.rpg).slice(0, 5),
    apg: [...playerStats].sort((a, b) => b.apg - a.apg).slice(0, 5),
    spg: [...playerStats].sort((a, b) => b.spg - a.spg).slice(0, 5),
    bpg: [...playerStats].sort((a, b) => b.bpg - a.bpg).slice(0, 5),
    tpm: [...playerStats].sort((a, b) => b.tpm - a.tpm).slice(0, 5),
    fgPct: [...playerStats].filter(p => p.fga >= 50).sort((a, b) => b.fgPct - a.fgPct).slice(0, 5),
    ftPct: [...playerStats].filter(p => p.fta >= 20).sort((a, b) => b.ftPct - a.ftPct).slice(0, 5)
  };
  
  return `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
      ${renderLeaderCard('Points', 'ppg', leaders.ppg, 'PPG', '🏀')}
      ${renderLeaderCard('Rebounds', 'rpg', leaders.rpg, 'RPG', '💪')}
      ${renderLeaderCard('Assists', 'apg', leaders.apg, 'APG', '🎯')}
      ${renderLeaderCard('Steals', 'spg', leaders.spg, 'SPG', '👐')}
      ${renderLeaderCard('Blocks', 'bpg', leaders.bpg, 'BPG', '🚫')}
      ${renderLeaderCard('3-Pointers', 'tpm', leaders.tpm, '3PM', '🎯')}
      ${renderLeaderCard('FG%', 'fgPct', leaders.fgPct, '%', '🎯')}
      ${renderLeaderCard('FT%', 'ftPct', leaders.ftPct, '%', '🎯')}
    </div>
  `;
}

function renderLeaderCard(title, stat, leaders, suffix, icon) {
  if (!leaders || leaders.length === 0) {
    return `
      <div style="
        background: #1a2332;
        border-radius: 12px;
        padding: 20px;
        border: 1px solid #2a2a40;
      ">
        <div style="font-size: 1.5em; margin-bottom: 10px;">${icon}</div>
        <h3 style="color: #2196F3; margin: 0 0 15px 0;">${title}</h3>
        <div style="color: #888;">No data</div>
      </div>
    `;
  }
  
  const leader = leaders[0];
  const value = suffix === '%' ? leader[stat].toFixed(1) : leader[stat].toFixed(1);
  
  return `
    <div style="
      background: #1a2332;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #2a2a40;
    ">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
        <div>
          <div style="font-size: 1.5em; margin-bottom: 5px;">${icon}</div>
          <h3 style="color: #2196F3; margin: 0;">${title}</h3>
        </div>
        <div style="text-align: right;">
          <div style="color: #4CAF50; font-size: 2em; font-weight: bold;">${value}</div>
          <div style="color: #888; font-size: 0.85em;">${suffix}</div>
        </div>
      </div>
      
      <div style="border-top: 1px solid #2a2a40; padding-top: 12px;">
        <div style="margin-bottom: 8px;">
          <div style="color: #fff; font-weight: bold; font-size: 1.1em;">${leader.name}</div>
          <div style="color: #888; font-size: 0.9em;">${leader.teamName}</div>
        </div>
        
        <details>
          <summary style="color: #2196F3; cursor: pointer; font-size: 0.9em; margin-top: 10px;">View Top 5</summary>
          <div style="margin-top: 10px;">
            ${leaders.slice(1, 5).map((p, idx) => `
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #2a2a40;">
                <div>
                  <span style="color: #888; margin-right: 8px;">${idx + 2}.</span>
                  <span style="color: #ccc;">${p.name}</span>
                  <span style="color: #666; font-size: 0.85em; margin-left: 8px;">${p.teamName}</span>
                </div>
                <span style="color: #4CAF50; font-weight: bold;">${suffix === '%' ? p[stat].toFixed(1) : p[stat].toFixed(1)}</span>
              </div>
            `).join('')}
          </div>
        </details>
      </div>
    </div>
  `;
}

// 2) PLAYER TABLE
function renderPlayerTable() {
  let playerStats = getPlayerSeasonStats();
  
  // Apply filters
  if (statsFilters.search) {
    const search = statsFilters.search.toLowerCase();
    playerStats = playerStats.filter(p => 
      p.name.toLowerCase().includes(search) || 
      p.teamName.toLowerCase().includes(search)
    );
  }
  
  if (statsFilters.position !== 'all') {
    playerStats = playerStats.filter(p => p.position === statsFilters.position);
  }
  
  if (statsFilters.minGP > 1) {
    playerStats = playerStats.filter(p => p.gp >= statsFilters.minGP);
  }
  
  // Sort
  const sortKey = statsFilters.sortBy;
  const sortDir = statsFilters.sortDir;
  playerStats.sort((a, b) => {
    const valA = statsFilters.perGame ? a[sortKey + 'g'] || a[sortKey] : a[sortKey];
    const valB = statsFilters.perGame ? b[sortKey + 'g'] || b[sortKey] : b[sortKey];
    return sortDir === 'desc' ? valB - valA : valA - valB;
  });
  
  return `
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; background: #1a2332; border-radius: 12px; overflow: hidden;">
        <thead style="position: sticky; top: 0; z-index: 5;">
          <tr style="background: #0f1624; color: #2196F3;">
            ${renderSortableHeader('Name', 'name')}
            ${renderSortableHeader('Team', 'teamName')}
            ${renderSortableHeader('Pos', 'position')}
            ${renderSortableHeader('GP', 'gp')}
            ${renderSortableHeader('MIN', statsFilters.perGame ? 'mpg' : 'min')}
            ${renderSortableHeader('PTS', statsFilters.perGame ? 'ppg' : 'pts')}
            ${renderSortableHeader('REB', statsFilters.perGame ? 'rpg' : 'reb')}
            ${renderSortableHeader('AST', statsFilters.perGame ? 'apg' : 'ast')}
            ${renderSortableHeader('STL', statsFilters.perGame ? 'spg' : 'stl')}
            ${renderSortableHeader('BLK', statsFilters.perGame ? 'bpg' : 'blk')}
            ${renderSortableHeader('TOV', statsFilters.perGame ? 'topg' : 'tov')}
            ${renderSortableHeader('FG%', 'fgPct')}
            ${renderSortableHeader('3P%', 'tpPct')}
            ${renderSortableHeader('FT%', 'ftPct')}
          </tr>
        </thead>
        <tbody>
          ${playerStats.slice(0, 100).map((p, idx) => `
            <tr style="border-bottom: 1px solid #2a2a40; ${idx % 2 === 0 ? 'background: #1a2332;' : 'background: #141e2e;'}">
              <td style="padding: 12px; color: #fff; font-weight: bold;">${p.name}</td>
              <td style="padding: 12px; color: #888;">${p.teamName}</td>
              <td style="padding: 12px; color: #888; text-align: center;">${p.position}</td>
              <td style="padding: 12px; color: #ccc; text-align: center;">${p.gp}</td>
              <td style="padding: 12px; color: #ccc; text-align: center;">${(statsFilters.perGame ? p.mpg : p.min).toFixed(1)}</td>
              <td style="padding: 12px; color: #4CAF50; font-weight: bold; text-align: center;">${(statsFilters.perGame ? p.ppg : p.pts).toFixed(1)}</td>
              <td style="padding: 12px; color: #ccc; text-align: center;">${(statsFilters.perGame ? p.rpg : p.reb).toFixed(1)}</td>
              <td style="padding: 12px; color: #ccc; text-align: center;">${(statsFilters.perGame ? p.apg : p.ast).toFixed(1)}</td>
              <td style="padding: 12px; color: #ccc; text-align: center;">${(statsFilters.perGame ? p.spg : p.stl).toFixed(1)}</td>
              <td style="padding: 12px; color: #ccc; text-align: center;">${(statsFilters.perGame ? p.bpg : p.blk).toFixed(1)}</td>
              <td style="padding: 12px; color: #ccc; text-align: center;">${(statsFilters.perGame ? p.topg : p.tov).toFixed(1)}</td>
              <td style="padding: 12px; color: #ccc; text-align: center;">${p.fgPct.toFixed(1)}%</td>
              <td style="padding: 12px; color: #ccc; text-align: center;">${p.tpPct.toFixed(1)}%</td>
              <td style="padding: 12px; color: #ccc; text-align: center;">${p.ftPct.toFixed(1)}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderSortableHeader(label, key) {
  const isActive = statsFilters.sortBy === key;
  const arrow = isActive ? (statsFilters.sortDir === 'desc' ? '▼' : '▲') : '';
  
  return `
    <th onclick="sortStatsTable('${key}')" style="
      padding: 12px;
      text-align: ${key === 'name' || key === 'teamName' ? 'left' : 'center'};
      cursor: pointer;
      user-select: none;
      font-weight: bold;
    ">
      ${label} ${arrow}
    </th>
  `;
}

function sortStatsTable(key) {
  if (statsFilters.sortBy === key) {
    statsFilters.sortDir = statsFilters.sortDir === 'desc' ? 'asc' : 'desc';
  } else {
    statsFilters.sortBy = key;
    statsFilters.sortDir = 'desc';
  }
  render();
}

// 3) TEAM LEADERS
function renderTeamLeaders() {
  const teamStats = getTeamSeasonStats();
  
  if (teamStats.length === 0) {
    return `
      <div style="text-align: center; padding: 80px 20px; color: #888;">
        <div style="font-size: 3em; margin-bottom: 20px;">📊</div>
        <div style="font-size: 1.2em;">No team stats available</div>
      </div>
    `;
  }
  
  const leaders = {
    ppg: [...teamStats].sort((a, b) => b.ppg - a.ppg).slice(0, 5),
    oppPpg: [...teamStats].sort((a, b) => a.oppPpg - b.oppPpg).slice(0, 5),
    diff: [...teamStats].sort((a, b) => b.diff - a.diff).slice(0, 5),
    fgPct: [...teamStats].sort((a, b) => b.fgPct - a.fgPct).slice(0, 5),
    tpPct: [...teamStats].sort((a, b) => b.tpPct - a.tpPct).slice(0, 5)
  };
  
  return `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
      ${renderTeamLeaderCard('Offensive Rating (PPG)', 'ppg', leaders.ppg, 'PPG', '⚡')}
      ${renderTeamLeaderCard('Defensive Rating (Opp PPG)', 'oppPpg', leaders.oppPpg, 'PPG', '🛡️')}
      ${renderTeamLeaderCard('Point Differential', 'diff', leaders.diff, '+/-', '📈')}
      ${renderTeamLeaderCard('FG%', 'fgPct', leaders.fgPct, '%', '🎯')}
      ${renderTeamLeaderCard('3P%', 'tpPct', leaders.tpPct, '%', '🎯')}
    </div>
  `;
}

function renderTeamLeaderCard(title, stat, leaders, suffix, icon) {
  if (!leaders || leaders.length === 0) return '<div></div>';
  
  const leader = leaders[0];
  const value = suffix === '%' || suffix === '+/-' ? leader[stat].toFixed(1) : leader[stat].toFixed(1);
  
  return `
    <div style="
      background: #1a2332;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #2a2a40;
    ">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
        <div>
          <div style="font-size: 1.5em; margin-bottom: 5px;">${icon}</div>
          <h3 style="color: #2196F3; margin: 0;">${title}</h3>
        </div>
        <div style="text-align: right;">
          <div style="color: #4CAF50; font-size: 2em; font-weight: bold;">${value}</div>
          <div style="color: #888; font-size: 0.85em;">${suffix}</div>
        </div>
      </div>
      
      <div style="border-top: 1px solid #2a2a40; padding-top: 12px;">
        <div style="margin-bottom: 8px;">
          <div style="color: #fff; font-weight: bold; font-size: 1.1em;">${leader.name}</div>
          <div style="color: #888; font-size: 0.9em;">${leader.wins}-${leader.losses}</div>
        </div>
        
        <details>
          <summary style="color: #2196F3; cursor: pointer; font-size: 0.9em; margin-top: 10px;">View Top 5</summary>
          <div style="margin-top: 10px;">
            ${leaders.slice(1, 5).map((t, idx) => `
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #2a2a40;">
                <div>
                  <span style="color: #888; margin-right: 8px;">${idx + 2}.</span>
                  <span style="color: #ccc;">${t.name}</span>
                </div>
                <span style="color: #4CAF50; font-weight: bold;">${(suffix === '%' || suffix === '+/-' ? t[stat].toFixed(1) : t[stat].toFixed(1))}</span>
              </div>
            `).join('')}
          </div>
        </details>
      </div>
    </div>
  `;
}

// 4) TEAM TABLE
function renderTeamTable() {
  let teamStats = getTeamSeasonStats();
  
  teamStats.sort((a, b) => {
    const winsA = a.wins / (a.wins + a.losses || 1);
    const winsB = b.wins / (b.wins + b.losses || 1);
    return winsB - winsA;
  });
  
  return `
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; background: #1a2332; border-radius: 12px; overflow: hidden;">
        <thead>
          <tr style="background: #0f1624; color: #2196F3;">
            <th style="padding: 12px; text-align: left;">Team</th>
            <th style="padding: 12px; text-align: center;">W-L</th>
            <th style="padding: 12px; text-align: center;">PPG</th>
            <th style="padding: 12px; text-align: center;">Opp PPG</th>
            <th style="padding: 12px; text-align: center;">Diff</th>
            <th style="padding: 12px; text-align: center;">FG%</th>
            <th style="padding: 12px; text-align: center;">3P%</th>
            <th style="padding: 12px; text-align: center;">FT%</th>
          </tr>
        </thead>
        <tbody>
          ${teamStats.map((t, idx) => `
            <tr style="border-bottom: 1px solid #2a2a40; ${idx % 2 === 0 ? 'background: #1a2332;' : 'background: #141e2e;'}">
              <td style="padding: 12px; color: #fff; font-weight: bold;">${t.name}</td>
              <td style="padding: 12px; color: #4CAF50; text-align: center; font-weight: bold;">${t.wins}-${t.losses}</td>
              <td style="padding: 12px; color: #ccc; text-align: center;">${t.ppg.toFixed(1)}</td>
              <td style="padding: 12px; color: #ccc; text-align: center;">${t.oppPpg.toFixed(1)}</td>
              <td style="padding: 12px; color: ${t.diff >= 0 ? '#4CAF50' : '#f44336'}; text-align: center; font-weight: bold;">${t.diff >= 0 ? '+' : ''}${t.diff.toFixed(1)}</td>
              <td style="padding: 12px; color: #ccc; text-align: center;">${t.fgPct.toFixed(1)}%</td>
              <td style="padding: 12px; color: #ccc; text-align: center;">${t.tpPct.toFixed(1)}%</td>
              <td style="padding: 12px; color: #ccc; text-align: center;">${t.ftPct.toFixed(1)}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// 5) ADVANCED STATS
function renderAdvancedStats() {
  return `
    <div style="text-align: center; padding: 80px 20px; color: #888;">
      <div style="font-size: 3em; margin-bottom: 20px;">📈</div>
      <div style="font-size: 1.2em; margin-bottom: 10px;">Advanced Stats</div>
      <div style="font-size: 0.9em;">Coming soon: PER, TS%, eFG%, USG%, ORtg, DRtg, NetRtg, and more</div>
    </div>
  `;
}

// 6) GAME LOGS
function renderGameLogs() {
  return `
    <div style="text-align: center; padding: 80px 20px; color: #888;">
      <div style="font-size: 3em; margin-bottom: 20px;">📅</div>
      <div style="font-size: 1.2em; margin-bottom: 10px;">Game Logs</div>
      <div style="font-size: 0.9em;">Coming soon: Player and team game-by-game statistics</div>
    </div>
  `;
}

/* ============================
   HISTORY TAB
============================ */

// Initialize league history if missing
function initHistoryIfMissing(league) {
  if (!league.history) {
    league.history = {
      seasons: {}, // { [year]: seasonData }
      championsByYear: [],
      awardsByYear: {},
      draftsByYear: {},
      records: {
        team: [],
        player: []
      },
      transactionLog: [],
      startYear: league.season // Track when history recording began
    };
  }
  return league.history;
}

// Archive season at end of playoffs
function archiveSeasonIfNeeded(league, year) {
  const history = initHistoryIfMissing(league);
  
  // Don't overwrite existing archives
  if (history.seasons[year]) return;
  
  // Create season archive
  history.seasons[year] = {
    year: year,
    champion: null, // Set after finals
    finalist: null,
    finalsResult: null, // e.g., "4-2"
    mvp: null,
    awards: {
      mvp: null,
      dpoy: null,
      roy: null,
      sixmoy: null,
      mip: null,
      coty: null,
      allLeague: { first: [], second: [], third: [] }
    },
    standings: league.teams.map(t => ({
      teamId: t.id,
      name: t.name,
      wins: t.wins,
      losses: t.losses,
      conference: t.conference,
      playoffSeed: t.playoffSeed || null
    })),
    playoffBracket: null, // Store playoff matchups if implemented
    draftResults: league.draft?.results || [],
    teamStatsLeaders: {},
    playerStatsLeaders: {},
    notableEvents: []
  };
  
  save();
}

// Log transaction
function logTransaction(league, entry) {
  const history = initHistoryIfMissing(league);
  
  history.transactionLog.unshift({
    id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    season: league.season,
    day: getCurrentDay(),
    timestamp: Date.now(),
    type: entry.type, // 'trade', 'signing', 'release', 'extension', 'draft'
    summary: entry.summary,
    details: entry.details || {},
    teams: entry.teams || []
  });
  
  // Keep last 500 transactions
  if (history.transactionLog.length > 500) {
    history.transactionLog = history.transactionLog.slice(0, 500);
  }
  
  save();
}

// Main History Tab Renderer
function renderHistoryView() {
  const el = document.getElementById('history-tab');
  console.log('renderHistoryView called', { el, league });
  if (!league) {
    el.innerHTML = '<div style="padding: 20px; color: #fff;">No league loaded. Create or load a league first.</div>';
    return;
  }
  
  const history = initHistoryIfMissing(league);
  const selectedSeason = historyFilters.season || league.season;
  
  el.innerHTML = `
    <div style="min-height: 100vh; background: #0f1624; padding-bottom: 40px;">
      <!-- Header -->
      <div style="
        background: linear-gradient(135deg, #1a2332 0%, #0f1624 100%);
        padding: 30px 20px;
        border-bottom: 2px solid #2a2a40;
      ">
        <h1 style="margin: 0 0 8px 0; color: #fff; font-size: 2em;">📜 History</h1>
        <div style="color: #888; font-size: 0.95em;">
          ${league.name} • Season ${league.season} ${history.startYear !== league.season ? `• Archive starts Season ${history.startYear}` : ''}
        </div>
      </div>
      
      <!-- Sub-tabs -->
      <div style="
        background: #0f1624;
        padding: 0 10px;
        border-bottom: 2px solid #2a2a40;
        display: flex;
        overflow-x: auto;
        position: sticky;
        top: 0;
        z-index: 10;
      ">
        ${['seasons', 'champions', 'awards', 'drafts', 'records', 'transactions', 'commissioner'].map(tab => `
          <button onclick="switchHistoryTab('${tab}')" style="
            padding: 14px 20px;
            background: ${historyTab === tab ? '#2196F3' : 'transparent'};
            color: ${historyTab === tab ? '#fff' : (tab === 'commissioner' ? '#e74c3c' : '#888')};
            border: none;
            border-bottom: 3px solid ${historyTab === tab ? '#2196F3' : 'transparent'};
            cursor: pointer;
            font-weight: ${historyTab === tab ? 'bold' : 'normal'};
            white-space: nowrap;
            transition: all 0.2s;
          ">${tab === 'commissioner' ? '👑 Commissioner' : tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
        `).join('')}
      </div>
      
      <!-- Filters -->
      ${renderHistoryFilters(history, selectedSeason)}
      
      <!-- Content -->
      <div style="max-width: 1200px; margin: 0 auto; padding: 20px;">
        ${renderHistoryContent(history, selectedSeason)}
      </div>
    </div>
  `;
}

function switchHistoryTab(tab) {
  historyTab = tab;
  render();
}

function renderHistoryFilters(history, selectedSeason) {
  const seasons = Object.keys(history.seasons || {}).sort((a, b) => b - a);
  
  return `
    <div style="
      background: #1a2332;
      padding: 15px 20px;
      border-bottom: 1px solid #2a2a40;
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      align-items: center;
    ">
      ${historyTab !== 'transactions' && historyTab !== 'records' ? `
        <select onchange="setHistorySeasonFilter(this.value)" style="
          padding: 8px 12px;
          background: #0f1624;
          color: #fff;
          border: 1px solid #2a2a40;
          border-radius: 6px;
          cursor: pointer;
        ">
          <option value="">Current Season (${league.season})</option>
          ${seasons.map(s => `
            <option value="${s}" ${selectedSeason == s ? 'selected' : ''}>Season ${s}</option>
          `).join('')}
        </select>
      ` : ''}
      
      ${historyTab === 'awards' ? `
        <select onchange="setAwardTypeFilter(this.value)" style="
          padding: 8px 12px;
          background: #0f1624;
          color: #fff;
          border: 1px solid #2a2a40;
          border-radius: 6px;
          cursor: pointer;
        ">
          <option value="mvp" ${historyFilters.awardType === 'mvp' ? 'selected' : ''}>MVP</option>
          <option value="dpoy" ${historyFilters.awardType === 'dpoy' ? 'selected' : ''}>DPOY</option>
          <option value="roy" ${historyFilters.awardType === 'roy' ? 'selected' : ''}>ROY</option>
          <option value="sixmoy" ${historyFilters.awardType === 'sixmoy' ? 'selected' : ''}>6MOY</option>
          <option value="mip" ${historyFilters.awardType === 'mip' ? 'selected' : ''}>MIP</option>
          <option value="coty" ${historyFilters.awardType === 'coty' ? 'selected' : ''}>COTY</option>
        </select>
      ` : ''}
      
      ${historyTab === 'records' ? `
        <div style="display: flex; gap: 8px;">
          <button onclick="setRecordType('team')" style="
            padding: 8px 16px;
            background: ${historyFilters.recordType === 'team' ? '#2196F3' : '#2a2a40'};
            color: #fff;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
          ">Team Records</button>
          <button onclick="setRecordType('player')" style="
            padding: 8px 16px;
            background: ${historyFilters.recordType === 'player' ? '#2196F3' : '#2a2a40'};
            color: #fff;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
          ">Player Records</button>
        </div>
      ` : ''}
    </div>
  `;
}

function setHistorySeasonFilter(season) {
  historyFilters.season = season || null;
  render();
}

function setAwardTypeFilter(type) {
  historyFilters.awardType = type;
  render();
}

function setRecordType(type) {
  historyFilters.recordType = type;
  render();
}

function renderHistoryContent(history, selectedSeason) {
  switch(historyTab) {
    case 'seasons':
      return renderSeasonsHistory(history);
    case 'champions':
      return renderChampionsHistory(history);
    case 'awards':
      return renderAwardsHistory(history);
    case 'drafts':
      return renderDraftsHistory(history, selectedSeason);
    case 'records':
      return renderRecordsHistory(history);
    case 'transactions':
      return renderTransactionsHistory(history);
    case 'commissioner':
      return renderCommissionerLogHistory();
    default:
      return '<div style="padding: 20px; color: #888;">Select a category</div>';
  }
}

// 1) SEASONS
function renderSeasonsHistory(history) {
  const seasons = Object.values(history.seasons || {}).sort((a, b) => b.year - a.year);
  
  if (seasons.length === 0) {
    return `
      <div style="text-align: center; padding: 80px 20px; color: #888;">
        <div style="font-size: 3em; margin-bottom: 20px;">📜</div>
        <div style="font-size: 1.2em; margin-bottom: 10px;">No seasons archived yet</div>
        <div style="font-size: 0.9em;">Season history will be recorded automatically at the end of each season</div>
      </div>
    `;
  }
  
  return `
    <div style="display: flex; flex-direction: column; gap: 20px;">
      ${seasons.map(season => `
        <div style="
          background: #1a2332;
          border-radius: 12px;
          padding: 20px;
          border: 1px solid #2a2a40;
        ">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
            <div>
              <h3 style="margin: 0 0 8px 0; color: #2196F3; font-size: 1.5em;">Season ${season.year}</h3>
              ${season.champion ? `
                <div style="color: #4CAF50; font-weight: bold; font-size: 1.1em;">
                  🏆 ${league.teams.find(t => t.id === season.champion)?.name || 'Unknown'} ${season.finalsResult ? `(${season.finalsResult})` : ''}
                </div>
              ` : '<div style="color: #888;">Season in progress</div>'}
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 15px;">
            ${season.mvp ? `
              <div>
                <div style="color: #888; font-size: 0.85em; margin-bottom: 4px;">MVP</div>
                <div style="color: #fff; font-weight: bold;">${season.mvp}</div>
              </div>
            ` : ''}
            ${season.standings && season.standings.length > 0 ? `
              <div>
                <div style="color: #888; font-size: 0.85em; margin-bottom: 4px;">Best Record</div>
                <div style="color: #fff; font-weight: bold;">
                  ${season.standings.sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses))[0].name} 
                  (${season.standings[0].wins}-${season.standings[0].losses})
                </div>
              </div>
            ` : ''}
          </div>
          
          <button onclick="viewSeasonDetails(${season.year})" style="
            padding: 10px 20px;
            background: #2196F3;
            color: #fff;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
          ">View Season Details</button>
        </div>
      `).join('')}
    </div>
  `;
}

function viewSeasonDetails(year) {
  // TODO: Implement season detail modal/page
  alert(`Season ${year} details coming soon!`);
}

// 2) CHAMPIONS
function renderChampionsHistory(history) {
  const champions = Object.values(history.seasons || {})
    .filter(s => s.champion)
    .sort((a, b) => b.year - a.year);
  
  if (champions.length === 0) {
    return '<div style="text-align: center; padding: 80px 20px; color: #888;">No champions crowned yet</div>';
  }
  
  // Count championships
  const dynasties = {};
  champions.forEach(s => {
    if (!dynasties[s.champion]) {
      dynasties[s.champion] = { count: 0, lastYear: s.year, teamName: league.teams.find(t => t.id === s.champion)?.name };
    }
    dynasties[s.champion].count++;
    if (s.year > dynasties[s.champion].lastYear) dynasties[s.champion].lastYear = s.year;
  });
  
  const sortedDynasties = Object.entries(dynasties).sort((a, b) => b[1].count - a[1].count);
  
  return `
    <div>
      <!-- Dynasties Section -->
      <div style="margin-bottom: 40px;">
        <h3 style="color: #2196F3; margin-bottom: 15px;">🏆 Championships</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px;">
          ${sortedDynasties.map(([teamId, data]) => `
            <div style="
              background: #1a2332;
              border-radius: 12px;
              padding: 20px;
              border: 1px solid #2a2a40;
              text-align: center;
            ">
              <div style="font-size: 2.5em; margin-bottom: 10px;">${'🏆'.repeat(Math.min(data.count, 5))}</div>
              <div style="color: #fff; font-weight: bold; font-size: 1.2em; margin-bottom: 5px;">${data.teamName}</div>
              <div style="color: #4CAF50; font-size: 1.1em; font-weight: bold;">${data.count} ${data.count === 1 ? 'Championship' : 'Championships'}</div>
              <div style="color: #888; font-size: 0.85em; margin-top: 5px;">Last: ${data.lastYear}</div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- Champions List -->
      <h3 style="color: #2196F3; margin-bottom: 15px;">Champions by Year</h3>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; background: #1a2332; border-radius: 12px; overflow: hidden;">
          <thead>
            <tr style="background: #0f1624; color: #2196F3;">
              <th style="padding: 12px; text-align: left;">Year</th>
              <th style="padding: 12px; text-align: left;">Champion</th>
              <th style="padding: 12px; text-align: left;">Opponent</th>
              <th style="padding: 12px; text-align: center;">Series</th>
              <th style="padding: 12px; text-align: left;">Finals MVP</th>
            </tr>
          </thead>
          <tbody>
            ${champions.map(s => `
              <tr style="border-bottom: 1px solid #2a2a40;">
                <td style="padding: 12px; color: #fff; font-weight: bold;">${s.year}</td>
                <td style="padding: 12px; color: #4CAF50; font-weight: bold;">
                  ${league.teams.find(t => t.id === s.champion)?.name || 'Unknown'}
                </td>
                <td style="padding: 12px; color: #ccc;">
                  ${s.finalist ? league.teams.find(t => t.id === s.finalist)?.name || 'Unknown' : 'TBD'}
                </td>
                <td style="padding: 12px; text-align: center; color: #ccc;">${s.finalsResult || '-'}</td>
                <td style="padding: 12px; color: #ccc;">${s.awards?.mvp || 'TBD'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 3) AWARDS
function renderAwardsHistory(history) {
  const awardType = historyFilters.awardType;
  const awards = [];
  
  Object.values(history.seasons || {}).forEach(s => {
    if (s.awards && s.awards[awardType]) {
      awards.push({
        year: s.year,
        winner: s.awards[awardType]
      });
    }
  });
  
  awards.sort((a, b) => b.year - a.year);
  
  const awardNames = {
    mvp: 'Most Valuable Player',
    dpoy: 'Defensive Player of the Year',
    roy: 'Rookie of the Year',
    sixmoy: 'Sixth Man of the Year',
    mip: 'Most Improved Player',
    coty: 'Coach of the Year'
  };
  
  return `
    <div>
      <h3 style="color: #2196F3; margin-bottom: 15px;">${awardNames[awardType]}</h3>
      
      ${awards.length === 0 ? `
        <div style="text-align: center; padding: 60px 20px; color: #888;">
          No ${awardNames[awardType]} awards recorded yet
        </div>
      ` : `
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; background: #1a2332; border-radius: 12px; overflow: hidden;">
            <thead>
              <tr style="background: #0f1624; color: #2196F3;">
                <th style="padding: 12px; text-align: left;">Year</th>
                <th style="padding: 12px; text-align: left;">Winner</th>
                <th style="padding: 12px; text-align: left;">Team</th>
              </tr>
            </thead>
            <tbody>
              ${awards.map(a => `
                <tr style="border-bottom: 1px solid #2a2a40;">
                  <td style="padding: 12px; color: #fff; font-weight: bold;">${a.year}</td>
                  <td style="padding: 12px; color: #4CAF50; font-weight: bold;">${a.winner}</td>
                  <td style="padding: 12px; color: #ccc;">TBD</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

// 4) DRAFTS
function renderDraftsHistory(history, selectedSeason) {
  const season = (history.seasons || {})[selectedSeason];
  
  if (!season || !season.draftResults || season.draftResults.length === 0) {
    return `
      <div style="text-align: center; padding: 80px 20px; color: #888;">
        <div style="font-size: 3em; margin-bottom: 20px;">🎯</div>
        <div style="font-size: 1.2em;">No draft results for Season ${selectedSeason}</div>
      </div>
    `;
  }
  
  return `
    <div>
      <h3 style="color: #2196F3; margin-bottom: 15px;">Season ${selectedSeason} Draft</h3>
      
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; background: #1a2332; border-radius: 12px; overflow: hidden;">
          <thead>
            <tr style="background: #0f1624; color: #2196F3;">
              <th style="padding: 12px; text-align: center;">Pick</th>
              <th style="padding: 12px; text-align: left;">Team</th>
              <th style="padding: 12px; text-align: left;">Player</th>
              <th style="padding: 12px; text-align: center;">Pos</th>
              <th style="padding: 12px; text-align: center;">OVR</th>
              <th style="padding: 12px; text-align: center;">POT</th>
            </tr>
          </thead>
          <tbody>
            ${season.draftResults.slice(0, 30).map((pick, idx) => `
              <tr style="border-bottom: 1px solid #2a2a40;">
                <td style="padding: 12px; text-align: center; color: #2196F3; font-weight: bold;">${idx + 1}</td>
                <td style="padding: 12px; color: #ccc;">${pick.teamName || 'Unknown'}</td>
                <td style="padding: 12px; color: #fff; font-weight: bold;">${pick.playerName || 'Unknown'}</td>
                <td style="padding: 12px; text-align: center; color: #888;">${pick.position || '-'}</td>
                <td style="padding: 12px; text-align: center; color: #4CAF50;">${pick.overall || '-'}</td>
                <td style="padding: 12px; text-align: center; color: #2196F3;">${pick.potential || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 5) RECORDS
function renderRecordsHistory(history) {
  const recordType = historyFilters.recordType;
  
  const teamRecords = [
    { name: 'Best Single-Season Record', holder: 'TBD', value: '-', season: '-' },
    { name: 'Longest Win Streak', holder: 'TBD', value: '-', season: '-' },
    { name: 'Most Points in a Game', holder: 'TBD', value: '-', season: '-' }
  ];
  
  const playerRecords = [
    { name: 'Most Points in a Game', holder: 'TBD', value: '-', season: '-' },
    { name: 'Most Rebounds in a Game', holder: 'TBD', value: '-', season: '-' },
    { name: 'Most Assists in a Game', holder: 'TBD', value: '-', season: '-' }
  ];
  
  const records = recordType === 'team' ? teamRecords : playerRecords;
  
  return `
    <div>
      <h3 style="color: #2196F3; margin-bottom: 15px;">${recordType === 'team' ? 'Team' : 'Player'} Records</h3>
      
      <div style="display: flex; flex-direction: column; gap: 15px;">
        ${records.map(record => `
          <div style="
            background: #1a2332;
            border-radius: 12px;
            padding: 20px;
            border: 1px solid #2a2a40;
          ">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="color: #2196F3; font-weight: bold; font-size: 1.1em; margin-bottom: 5px;">${record.name}</div>
                <div style="color: #fff; font-size: 1.2em; font-weight: bold;">${record.holder}</div>
              </div>
              <div style="text-align: right;">
                <div style="color: #4CAF50; font-size: 1.5em; font-weight: bold;">${record.value}</div>
                <div style="color: #888; font-size: 0.85em;">${record.season}</div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      
      <div style="margin-top: 20px; padding: 20px; background: #1a2332; border-radius: 12px; text-align: center; color: #888;">
        Record tracking will be implemented in a future update
      </div>
    </div>
  `;
}

// 6) TRANSACTIONS
function renderTransactionsHistory(history) {
  const transactions = history.transactionLog || [];
  
  if (transactions.length === 0) {
    return `
      <div style="text-align: center; padding: 80px 20px; color: #888;">
        <div style="font-size: 3em; margin-bottom: 20px;">📋</div>
        <div style="font-size: 1.2em; margin-bottom: 10px;">No transactions logged yet</div>
        <div style="font-size: 0.9em;">Transactions will be recorded automatically going forward</div>
      </div>
    `;
  }
  
  return `
    <div style="display: flex; flex-direction: column; gap: 15px;">
      ${transactions.map(txn => `
        <div style="
          background: #1a2332;
          border-radius: 12px;
          padding: 20px;
          border: 1px solid #2a2a40;
        ">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
            <div>
              <span style="
                background: ${txn.type === 'trade' ? '#2196F3' : txn.type === 'signing' ? '#4CAF50' : '#ff9800'};
                color: #fff;
                padding: 4px 10px;
                border-radius: 4px;
                font-size: 0.8em;
                font-weight: bold;
                text-transform: uppercase;
              ">${txn.type}</span>
            </div>
            <div style="color: #888; font-size: 0.85em;">
              Season ${txn.season} • Day ${txn.day}
            </div>
          </div>
          <div style="color: #fff; font-size: 1.05em;">${txn.summary}</div>
        </div>
      `).join('')}
    </div>
  `;
}

/* ============================
   SCHEDULE TAB
============================ */

let activeGameDrawer = null;
let liveGameIntervals = new Map(); // gameId -> intervalId
let activeLiveView = 'pbp'; // 'pbp' | 'box' | 'compare'
let activeGamecastTab = 'plays'; // 'matchup' | 'odds' | 'plays' | 'stats'
let activeStatsView = 'game'; // 'away' | 'game' | 'home'
let activeStatsTabView = 'team'; // 'team' | 'boxscore'
let autoScrollPlays = true; // Auto-scroll play-by-play to latest

function renderSchedule() {
  const el = document.getElementById('schedule-tab');
  
  // Check if schedule exists and has games
  if (!league?.schedule || !league?.schedule.games || Object.keys(league.schedule.games).length === 0) {
    // Show detailed error if available
    const errorMsg = league?.schedule?.generationError || 'No schedule data available';
    const errorLines = errorMsg.split('\n').map(line => `<div style="margin: 5px 0;">${escapeHtml(line)}</div>`).join('');
    
    el.innerHTML = `
      <div style="padding: 20px;">
        <h2>📅 Schedule</h2>
        <div style="background: #2a1a1a; border-left: 4px solid #ff6b6b; padding: 20px; margin: 20px 0; border-radius: 4px;">
          <h3 style="margin: 0 0 15px 0; color: #ff6b6b;">⚠ Schedule Generation Failed</h3>
          <div style="font-family: monospace; font-size: 13px; line-height: 1.6; color: #ffb3b3;">
            ${errorLines}
          </div>
          <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #444;">
            <strong>Common fixes:</strong>
            <ul style="margin: 10px 0; padding-left: 20px; color: #ccc;">
              <li>Ensure every team has a conference and division assigned</li>
              <li>For 30-team leagues: 2 conferences, 6 divisions (3 per conference), 5 teams per division</li>
              <li>Check that team IDs are unique and sequential (0, 1, 2, ...)</li>
              <li>Try regenerating the league if structure is correct</li>
            </ul>
          </div>
        </div>
        <button onclick="window.showTab('home')" style="padding: 10px 20px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">← Back to Home</button>
      </div>
    `;
    return;
  }
  
  // Set default selected team for Other Teams view
  if (!scheduleSelectedTeamId) {
    scheduleSelectedTeamId = league.teams[0]?.id || null;
  }
  
  // Get current season status
  const allGames = Object.values(league.schedule.games || {});
  const completedCount = allGames.filter(g => g.status === 'final').length / 2;
  const totalGamesPerTeam = league.schedule.gamesPerTeam || 82;
  
  // Check if in preseason (using single source of truth)
  const currentPhase = getCurrentPhase();
  const isPreseason = currentPhase === 'PRESEASON' && !leagueState?.meta?.regularSeasonStarted;
  
  // Determine active season event
  let activeEventBadge = '';
  if (isPreseason) {
    activeEventBadge = `
      <button onclick="startRegularSeason()" style="
        background: #4CAF50;
        color: #fff;
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        font-size: 1em;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
      ">
        🏀 Start Regular Season
      </button>
    `;
  } else if (completedCount === 0) {
    activeEventBadge = '<span style="background: #4CAF50; padding: 6px 12px; border-radius: 6px; font-size: 0.9em;">🏀 Season Start</span>';
  } else if (completedCount >= totalGamesPerTeam) {
    activeEventBadge = '<span style="background: #2196F3; padding: 6px 12px; border-radius: 6px; font-size: 0.9em;">🏁 Season Complete</span>';
  } else if (isSeasonEventTriggered('trade_deadline')) {
    activeEventBadge = '<span style="background: #f44336; padding: 6px 12px; border-radius: 6px; font-size: 0.9em;">🔒 Post-Trade Deadline</span>';
  } else if (isSeasonEventTriggered('allstar_break')) {
    activeEventBadge = '<span style="background: #9C27B0; padding: 6px 12px; border-radius: 6px; font-size: 0.9em;">⭐ Post-All-Star</span>';
  } else if (completedCount >= 41) {
    activeEventBadge = '<span style="background: #FF9800; padding: 6px 12px; border-radius: 6px; font-size: 0.9em;">📊 Mid-Season</span>';
  } else {
    activeEventBadge = '<span style="background: #4CAF50; padding: 6px 12px; border-radius: 6px; font-size: 0.9em;">🏀 Regular Season</span>';
  }
  
  el.innerHTML = `
    <div style="padding: 20px;">
      <!-- Header with Tabs -->
      <div style="margin-bottom: 25px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h2 style="margin: 0;">📅 Schedule - ${league.season} Season</h2>
          ${activeEventBadge}
        </div>
        
        <!-- START REGULAR SEASON BUTTON -->
        <div id="seasonStartButtonContainer" style="margin-bottom: 20px;"></div>
        
        <!-- Tab Navigation -->
        <div style="display: flex; gap: 5px; border-bottom: 2px solid #2a2a40; margin-bottom: 20px;">
          <button 
            onclick="switchScheduleView('myteam')"
            style="padding: 12px 24px; background: ${scheduleView === 'myteam' ? '#2196F3' : 'transparent'}; color: ${scheduleView === 'myteam' ? '#fff' : '#888'}; border: none; border-bottom: 3px solid ${scheduleView === 'myteam' ? '#2196F3' : 'transparent'}; cursor: pointer; font-weight: bold; transition: all 0.2s;">
            My Team
          </button>
          <button 
            onclick="switchScheduleView('otherteams')"
            style="padding: 12px 24px; background: ${scheduleView === 'otherteams' ? '#2196F3' : 'transparent'}; color: ${scheduleView === 'otherteams' ? '#fff' : '#888'}; border: none; border-bottom: 3px solid ${scheduleView === 'otherteams' ? '#2196F3' : 'transparent'}; cursor: pointer; font-weight: bold; transition: all 0.2s;">
            Other Teams
          </button>
          <button 
            onclick="switchScheduleView('league')"
            style="padding: 12px 24px; background: ${scheduleView === 'league' ? '#2196F3' : 'transparent'}; color: ${scheduleView === 'league' ? '#fff' : '#888'}; border: none; border-bottom: 3px solid ${scheduleView === 'league' ? '#2196F3' : 'transparent'}; cursor: pointer; font-weight: bold; transition: all 0.2s;">
            League
          </button>
        </div>
        
        ${renderScheduleContent()}
      </div>
      
      <div id="game-drawer-container"></div>
    </div>
  `;
  
  // Inject Start Season button if in preseason
  const buttonContainer = document.getElementById('seasonStartButtonContainer');
  if (buttonContainer) {
    const currentPhase = (league.phase || '').toUpperCase();
    if (currentPhase === 'PRESEASON' || currentPhase === '' || !currentPhase) {
      buttonContainer.innerHTML = `
        <div style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); border-radius: 12px; padding: 30px; text-align: center; box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);">
          <div style="font-size: 2em; margin-bottom: 10px;">🏀</div>
          <h3 style="margin: 0 0 10px 0; color: #fff;">Ready to Begin?</h3>
          <p style="margin: 0 0 20px 0; color: rgba(255,255,255,0.9);">The regular season is ready to start!</p>
          <button id="actualStartButton" style="
            background: #fff;
            color: #4CAF50;
            border: none;
            padding: 15px 40px;
            font-size: 1.1em;
            font-weight: bold;
            border-radius: 8px;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            transition: transform 0.2s;
          " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            START REGULAR SEASON
          </button>
        </div>
      `;
      
      // Attach click handler directly
      document.getElementById('actualStartButton').addEventListener('click', async function() {
        console.log('═══════════════════════════════════════');
        console.log('🏀 START REGULAR SEASON BUTTON CLICKED');
        console.log('═══════════════════════════════════════');
        console.log('BEFORE - window.league:', window.league);
        console.log('BEFORE - window.leagueState:', window.leagueState);
        console.log('BEFORE - window.league.phase:', window.league?.phase);
        console.log('BEFORE - window.leagueState.meta.phase:', window.leagueState?.meta?.phase);
        
        // Safety check: ensure objects exist
        if (!window.league) {
          alert('❌ Error: league object not loaded');
          console.error('window.league is undefined');
          return;
        }
        
        if (!window.leagueState || !window.leagueState.meta) {
          alert('❌ Error: leagueState not loaded');
          console.error('window.leagueState.meta is undefined');
          return;
        }
        
        // Set phase in BOTH global objects
        window.league.phase = 'REGULAR_SEASON';
        window.leagueState.meta.phase = 'REGULAR_SEASON';
        window.leagueState.meta.day = 1;
        window.leagueState.meta.regularSeasonStarted = true;
        
        console.log('AFTER SET - window.league.phase:', window.league.phase);
        console.log('AFTER SET - window.leagueState.meta.phase:', window.leagueState.meta.phase);
        
        // Save to storage
        console.log('Calling saveLeagueState...');
        if (window.saveLeagueState) {
          try {
            await window.saveLeagueState();
            console.log('✅ Save complete');
          } catch (err) {
            console.error('❌ Save failed:', err);
          }
        } else {
          console.error('❌ saveLeagueState not found on window');
        }
        
        console.log('AFTER SAVE - window.league.phase:', window.league.phase);
        console.log('AFTER SAVE - window.leagueState.meta.phase:', window.leagueState.meta.phase);
        
        // Re-render UI
        console.log('Calling render()...');
        render();
        console.log('✅ Render complete');
        console.log('═══════════════════════════════════════');
        
        alert('✅ Regular season started!\n\nPhase is now: ' + window.league.phase);
      });
    }
  }
}

function switchScheduleView(view) {
  scheduleView = view;
  renderSchedule();
}

function switchScheduleTeam(teamId) {
  scheduleSelectedTeamId = parseInt(teamId);
  renderSchedule();
}

function renderScheduleContent() {
  if (scheduleView === 'myteam') {
    return renderMyTeamSchedule();
  } else if (scheduleView === 'otherteams') {
    return renderOtherTeamsSchedule();
  } else {
    return renderLeagueSchedule();
  }
}

function renderMyTeamSchedule() {
  const userTeam = league.teams.find(t => t.id === league.userTid);
  if (!userTeam) {
    return '<div style="padding: 20px; color: #ff6b6b;">User team not found.</div>';
  }
  
  // Filter games for user's team from all schedule games (NO CALENDAR DAY - ordered list)
  const allGames = league.schedule.games || {};
  const userGames = Object.values(allGames).filter(game => 
    game.homeTeamId === league.userTid || game.awayTeamId === league.userTid
  );
  
  const completedGames = userGames.filter(g => g.status === 'final');
  const upcomingGames = userGames.filter(g => g.status === 'scheduled');
  const liveGames = userGames.filter(g => g.status === 'live');
  
  return `
    <div style="background: #1a2332; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
      <h3 style="margin: 0 0 15px 0; color: #4CAF50;">${userTeam.name} Schedule</h3>
      <div style="display: flex; gap: 20px; margin-bottom: 15px; color: #888;">
        <span>Completed: ${completedGames.length}</span>
        <span>Upcoming: ${upcomingGames.length}</span>
        ${liveGames.length > 0 ? `<span style="color: #f44336;">Live: ${liveGames.length}</span>` : ''}
        <span>Total: ${userGames.length} / ${league.schedule.gamesPerTeam || 82}</span>
      </div>
    </div>
    
    ${renderTeamScheduleGames(userGames, league.userTid)}
  `;
}

function renderOtherTeamsSchedule() {
  const selectedTeam = league.teams.find(t => t.id === scheduleSelectedTeamId);
  if (!selectedTeam) {
    return '<div style="padding: 20px; color: #ff6b6b;">Team not found.</div>';
  }
  
  // Filter games for selected team from all schedule games (NO CALENDAR DAY - ordered list)
  const allGames = league.schedule.games || {};
  const teamGames = Object.values(allGames).filter(game => 
    game.homeTeamId === scheduleSelectedTeamId || game.awayTeamId === scheduleSelectedTeamId
  );
  
  const completedGames = teamGames.filter(g => g.status === 'final');
  const upcomingGames = teamGames.filter(g => g.status === 'scheduled');
  
  // Team selector dropdown
  const teamOptions = league.teams.map(t => 
    `<option value="${t.id}" ${t.id === scheduleSelectedTeamId ? 'selected' : ''}>${t.name} (${t.wins}-${t.losses})</option>`
  ).join('');
  
  return `
    <div style="background: #1a2332; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="margin: 0; color: #2196F3;">Team Schedule</h3>
        <select onchange="switchScheduleTeam(this.value)" style="padding: 10px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px; cursor: pointer; min-width: 250px;">
          ${teamOptions}
        </select>
      </div>
      <div style="display: flex; gap: 20px; color: #888;">
        <span>Completed: ${completedGames.length}</span>
        <span>Upcoming: ${upcomingGames.length}</span>
        <span>Total: ${teamGames.length} / ${league.schedule.gamesPerTeam || 82}</span>
      </div>
    </div>
    
    ${renderTeamScheduleGames(teamGames, scheduleSelectedTeamId)}
  `;
}

function renderLeagueSchedule() {
  // Get all games (NO CALENDAR DAY - simple ordered list)
  const allGames = league.schedule.games || {};
  const gamesArray = Object.values(allGames);
  
  if (gamesArray.length === 0) {
    return `
      <div style="background: #1a1a2e; border-radius: 10px; padding: 40px; text-align: center; color: #888;">
        <div style="font-size: 2em; margin-bottom: 10px;">📅</div>
        <p>No games scheduled</p>
      </div>
    `;
  }
  
  // Group by status for display
  const completedGames = gamesArray.filter(g => g.status === 'final');
  const liveGames = gamesArray.filter(g => g.status === 'live');
  const upcomingGames = gamesArray.filter(g => g.status === 'scheduled');
  
  return `
    <div style="background: #1a1a2e; border-radius: 10px; padding: 20px;">
      <div style="margin-bottom: 15px; padding: 15px; background: #0f1624; border-radius: 8px; color: #888;">
        <strong>Season Overview:</strong> ${gamesArray.length} total games | Completed: ${completedGames.length} | Upcoming: ${upcomingGames.length}
        ${liveGames.length > 0 ? ` | <span style="color: #f44336;">Live: ${liveGames.length}</span>` : ''}
      </div>
      
      ${liveGames.length > 0 ? `
        <div style="margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #2a2a40;">
          <h3 style="margin: 0 0 15px 0; color: #f44336;">🔴 Live Games</h3>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${liveGames.map(game => renderScheduleGameRow(game)).join('')}
          </div>
        </div>
      ` : ''}
      
      ${upcomingGames.length > 0 ? `
        <div style="margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #2a2a40;">
          <h3 style="margin: 0 0 15px 0; color: #4CAF50;">📅 Upcoming Games (${upcomingGames.length})</h3>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${upcomingGames.slice(0, 20).map(game => renderScheduleGameRow(game)).join('')}
            ${upcomingGames.length > 20 ? `<p style="text-align: center; color: #888; margin: 10px 0;">...and ${upcomingGames.length - 20} more</p>` : ''}
          </div>
        </div>
      ` : ''}
      
      ${completedGames.length > 0 ? `
        <div>
          <h3 style="margin: 0 0 15px 0; color: #888;">✓ Completed Games (${completedGames.length})</h3>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${completedGames.slice(-10).reverse().map(game => renderScheduleGameRow(game)).join('')}
            ${completedGames.length > 10 ? `<p style="text-align: center; color: #888; margin: 10px 0;">Showing last 10 of ${completedGames.length}</p>` : ''}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderTeamScheduleGames(games, teamId) {
  if (games.length === 0) {
    return `
      <div style="background: #1a1a2e; border-radius: 10px; padding: 40px; text-align: center; color: #888;">
        <div style="font-size: 2em; margin-bottom: 10px;">📅</div>
        <p>No games found for this team</p>
      </div>
    `;
  }
  
  // Group by status
  const completedGames = games.filter(g => g.status === 'final');
  const liveGames = games.filter(g => g.status === 'live');
  const upcomingGames = games.filter(g => g.status === 'scheduled');
  
  // Get season events - create if missing (for leagues created before events system)
  let events = league.schedule.events;
  if (!events || events.length === 0) {
    console.log('[Schedule] Creating missing event markers for existing league');
    events = createSeasonEventMarkersForExistingLeague(league.schedule.gamesPerTeam || 82);
    league.schedule.events = events;
    saveLeague(); // Save the updated schedule
  }
  
  console.log('[DEBUG] Events array:', events);
  console.log('[DEBUG] Completed games count:', completedGames.length);
  
  // Build game list with events inserted at appropriate positions
  const gameListItems = [];
  
  // Season Start event (before Game 1)
  const seasonStartEvent = events.find(e => e.type === 'season_start');
  if (seasonStartEvent && completedGames.length === 0 && liveGames.length === 0) {
    gameListItems.push(renderSeasonEvent(seasonStartEvent));
  }
  
  // Completed games with events
  completedGames.forEach((game, idx) => {
    const gameNumber = idx + 1;
    gameListItems.push(renderScheduleGameRowWithNumber(game, gameNumber, teamId));
    
    // Check for events after this game number
    const eventsAfterThisGame = events.filter(e => e.afterGameNumber === gameNumber && e.type !== 'season_start');
    if (eventsAfterThisGame.length > 0) {
      console.log(`[DEBUG] Game ${gameNumber}: Found events:`, eventsAfterThisGame.map(e => e.name));
    }
    eventsAfterThisGame.forEach(event => {
      gameListItems.push(renderSeasonEvent(event));
    });
  });
  
  // Live games
  liveGames.forEach((game, idx) => {
    const gameNumber = completedGames.length + idx + 1;
    gameListItems.push(renderScheduleGameRowWithNumber(game, gameNumber, teamId));
    
    // Check for events after this game
    const eventsAfterThisGame = events.filter(e => 
      e.afterGameNumber === gameNumber && e.type !== 'season_start'
    );
    eventsAfterThisGame.forEach(event => {
      gameListItems.push(renderSeasonEvent(event));
    });
  });
  
  // Check if any events should appear between completed/live and upcoming games
  const currentGameNumber = completedGames.length + liveGames.length;
  const missedEvents = events.filter(e => 
    e.afterGameNumber > 0 && 
    e.afterGameNumber <= currentGameNumber && 
    e.type !== 'season_start' &&
    !gameListItems.some(item => item.includes(`event-${e.id}`))
  );
  missedEvents.forEach(event => {
    gameListItems.push(renderSeasonEvent(event));
  });
  
  // Upcoming games with events
  upcomingGames.forEach((game, idx) => {
    const gameNumber = completedGames.length + liveGames.length + idx + 1;
    
    // Insert events BEFORE this game (events that should appear after the previous game)
    const eventsBeforeThisGame = events.filter(e => 
      e.afterGameNumber === gameNumber - 1 && 
      e.type !== 'season_start' &&
      !gameListItems.some(item => item.includes(`event-${e.id}`))
    );
    eventsBeforeThisGame.forEach(event => {
      console.log(`[DEBUG] Inserting event "${event.name}" before Game ${gameNumber}`);
      gameListItems.push(renderSeasonEvent(event));
    });
    
    gameListItems.push(renderScheduleGameRowWithNumber(game, gameNumber, teamId));
  });
  
  // Season End event (after all games)
  const seasonEndEvent = events.find(e => e.type === 'season_end');
  if (seasonEndEvent && completedGames.length >= (league.schedule.gamesPerTeam || 82)) {
    gameListItems.push(renderSeasonEvent(seasonEndEvent));
  }
  
  return `
    <div style="background: #1a1a2e; border-radius: 10px; padding: 20px;">
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${gameListItems.join('')}
      </div>
    </div>
  `;
}

function renderScheduleDayGames(games, day) {
  if (games.length === 0) {
    return `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; color: #888;">
        <div style="font-size: 3em; margin-bottom: 15px;">🏖️</div>
        <h3 style="margin: 0 0 8px 0; color: #aaa;">No games scheduled today</h3>
        <p style="margin: 0; font-size: 0.95em;">Rest day for all teams</p>
      </div>
    `;
  }
  
  const allFinal = games.every(g => g.status === 'final');
  
  return `
    <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #2a2a40;">
      <h3 style="margin: 0; color: #4CAF50;">${games.length} Game${games.length !== 1 ? 's' : ''} ${allFinal ? '(Completed)' : ''}</h3>
    </div>
    
    <div style="display: flex; flex-direction: column; gap: 12px;">
      ${games.map(game => renderScheduleGameRow(game)).join('')}
    </div>
  `;
}

function renderScheduleGameRow(game) {
  const homeTeam = league.teams.find(t => t.id === game.homeTeamId);
  const awayTeam = league.teams.find(t => t.id === game.awayTeamId);
  
  if (!homeTeam || !awayTeam) return '';
  
  const isUserGame = game.homeTeamId === league.userTid || game.awayTeamId === league.userTid;
  
  // Get team abbreviations and logos
  const awayAbbr = awayTeam.abbreviation || awayTeam.city.substring(0, 3).toUpperCase();
  const homeAbbr = homeTeam.abbreviation || homeTeam.city.substring(0, 3).toUpperCase();
  const awayLogo = awayTeam.logoSecondaryUrl || awayAbbr;
  const homeLogo = homeTeam.logoSecondaryUrl || homeAbbr;
  
  const statusDisplay = game.status === 'final' ? 'FINAL' : 
                       game.status === 'live' ? `LIVE - Q${game.quarter} ${game.timeRemaining}` :
                       'Scheduled';
  
  const statusColor = game.status === 'final' ? '#888' : 
                     game.status === 'live' ? '#f44336' : '#4CAF50';
  
  // Get spread for scheduled games
  const spread = game.status === 'scheduled' ? getGameSpread(game) : null;
  
  // Add rivalry badge placeholder
  const rivalryBadgeId = `rivalry-badge-${game.id}`;
  
  return `
    <div style="
      background: ${isUserGame ? 'linear-gradient(135deg, #0f1624 0%, #1a2332 100%)' : '#0f1624'};
      border: 2px solid ${isUserGame ? '#4CAF50' : '#2a2a40'};
      border-radius: 8px;
      padding: 18px;
      transition: all 0.2s;
    " onmouseover="this.style.borderColor='#4CAF50'" onmouseout="this.style.borderColor='${isUserGame ? '#4CAF50' : '#2a2a40'}'">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <!-- Teams Info -->
        <div style="flex: 1;">
          ${isUserGame ? '<div style="color: #4CAF50; font-weight: bold; font-size: 0.85em; margin-bottom: 8px;">★ YOUR TEAM</div>' : ''}
          <div id="${rivalryBadgeId}" style="margin-bottom: 8px;"></div>
          
          <!-- Away Team -->
          <div style="display: flex; align-items: center; margin-bottom: 10px;">
            <div style="display: flex; align-items: center; width: 250px;">
              <span style="font-size: ${awayTeam.logoSecondaryUrl ? '1.5em' : '1em'}; margin-right: 10px; min-width: 35px; text-align: center; background: ${awayTeam.logoSecondaryUrl ? 'transparent' : '#2a2a40'}; padding: ${awayTeam.logoSecondaryUrl ? '0' : '4px 8px'}; border-radius: 4px;">${awayLogo}</span>
              <span style="font-weight: bold; font-size: 1.1em;">${awayTeam.name}</span>
            </div>
            <span style="color: #888; font-size: 0.9em; margin-right: 15px;">(${awayTeam.wins}-${awayTeam.losses})</span>
            ${game.status !== 'scheduled' ? `<span style="font-size: 1.4em; font-weight: bold; color: ${game.score.away > game.score.home ? '#4CAF50' : '#fff'}; min-width: 40px; text-align: right;">${game.score.away}</span>` : spread ? `<span style="color: ${spread.away > 0 ? '#f59e0b' : '#10b981'}; font-weight: bold; font-size: 0.9em;">${formatSpread(spread.away)} spread</span>` : ''}
          </div>
          
          <!-- vs/@ indicator -->
          <div style="color: #666; font-size: 0.85em; margin-left: 45px; margin-bottom: 5px;">@</div>
          
          <!-- Home Team -->
          <div style="display: flex; align-items: center;">
            <div style="display: flex; align-items: center; width: 250px;">
              <span style="font-size: ${homeTeam.logoSecondaryUrl ? '1.5em' : '1em'}; margin-right: 10px; min-width: 35px; text-align: center; background: ${homeTeam.logoSecondaryUrl ? 'transparent' : '#2a2a40'}; padding: ${homeTeam.logoSecondaryUrl ? '0' : '4px 8px'}; border-radius: 4px;">${homeLogo}</span>
              <span style="font-weight: bold; font-size: 1.1em;">${homeTeam.name}</span>
            </div>
            <span style="color: #888; font-size: 0.9em; margin-right: 15px;">(${homeTeam.wins}-${homeTeam.losses})</span>
            ${game.status !== 'scheduled' ? `<span style="font-size: 1.4em; font-weight: bold; color: ${game.score.home > game.score.away ? '#4CAF50' : '#fff'}; min-width: 40px; text-align: right;">${game.score.home}</span>` : spread ? `<span style="color: ${spread.home < 0 ? '#10b981' : '#f59e0b'}; font-weight: bold; font-size: 0.9em;">${formatSpread(spread.home)} spread</span>` : ''}
          </div>
        </div>
        
        <!-- Status & Actions -->
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 10px;">
          <div style="color: ${statusColor}; font-weight: bold; font-size: 0.95em; text-align: right;">
            ${statusDisplay}
            ${game.status === 'live' ? '<div style="color: #f44336; font-size: 0.9em; margin-top: 4px;">● LIVE</div>' : ''}
          </div>
          
          ${game.status === 'scheduled' ? `
            <div style="display: flex; gap: 8px;">
              <button onclick="simGameInstantUI('${game.id}')" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9em;">⚡ Sim Game</button>
              <button onclick="openGameDrawer('${game.id}')" style="padding: 8px 16px; background: #2196F3; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9em;">👁️ Watch Live</button>
            </div>
          ` : `
            <button onclick="openGameDrawer('${game.id}')" style="padding: 8px 16px; background: #2a2a40; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9em;">📊 View Details</button>
          `}
        </div>
      </div>
    </div>
    <script>
      // Load rivalry badge asynchronously
      (async function() {
        const score = await getRivalry(${game.homeTeamId}, ${game.awayTeamId});
        const label = getRivalryLabel(score);
        const badge = renderRivalryBadge(score, label);
        const el = document.getElementById('${rivalryBadgeId}');
        if (el && badge) {
          el.innerHTML = badge;
        }
      })();
    </script>
  `;
}

// Render schedule game row WITH game number (for team schedules)
function renderScheduleGameRowWithNumber(game, gameNumber, teamId) {
  const homeTeam = league.teams.find(t => t.id === game.homeTeamId);
  const awayTeam = league.teams.find(t => t.id === game.awayTeamId);
  
  if (!homeTeam || !awayTeam) return '';
  
  const isUserGame = game.homeTeamId === league.userTid || game.awayTeamId === league.userTid;
  
  // Get team abbreviations and logos
  const awayAbbr = awayTeam.abbreviation || awayTeam.city.substring(0, 3).toUpperCase();
  const homeAbbr = homeTeam.abbreviation || homeTeam.city.substring(0, 3).toUpperCase();
  const awayLogo = awayTeam.logoSecondaryUrl || awayAbbr;
  const homeLogo = homeTeam.logoSecondaryUrl || homeAbbr;
  
  const statusDisplay = game.status === 'final' ? 'FINAL' : 
                       game.status === 'live' ? `LIVE - Q${game.quarter} ${game.timeRemaining}` :
                       'Scheduled';
  
  const statusColor = game.status === 'final' ? '#888' : 
                     game.status === 'live' ? '#f44336' : '#4CAF50';
  
  // Get spread for scheduled games
  const spread = game.status === 'scheduled' ? getGameSpread(game) : null;
  
  // Add rivalry badge placeholder
  const rivalryBadgeId = `rivalry-badge-${game.id}`;
  
  return `
    <div style="
      background: ${isUserGame ? 'linear-gradient(135deg, #0f1624 0%, #1a2332 100%)' : '#0f1624'};
      border: 2px solid ${isUserGame ? '#4CAF50' : '#2a2a40'};
      border-radius: 8px;
      padding: 18px;
      transition: all 0.2s;
    " onmouseover="this.style.borderColor='#4CAF50'" onmouseout="this.style.borderColor='${isUserGame ? '#4CAF50' : '#2a2a40'}'">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <!-- Game Number Badge -->
        <div style="margin-right: 20px; min-width: 70px;">
          <div style="background: #2196F3; color: white; padding: 8px 12px; border-radius: 6px; text-align: center; font-weight: bold;">
            Game #${gameNumber}
          </div>
        </div>
        
        <!-- Teams Info -->
        <div style="flex: 1;">
          ${isUserGame ? '<div style="color: #4CAF50; font-weight: bold; font-size: 0.85em; margin-bottom: 8px;">★ YOUR TEAM</div>' : ''}
          <div id="${rivalryBadgeId}" style="margin-bottom: 8px;"></div>
          
          <!-- Away Team -->
          <div style="display: flex; align-items: center; margin-bottom: 10px;">
            <div style="display: flex; align-items: center; width: 250px;">
              <span style="font-size: ${awayTeam.logoSecondaryUrl ? '1.5em' : '1em'}; margin-right: 10px; min-width: 35px; text-align: center; background: ${awayTeam.logoSecondaryUrl ? 'transparent' : '#2a2a40'}; padding: ${awayTeam.logoSecondaryUrl ? '0' : '4px 8px'}; border-radius: 4px;">${awayLogo}</span>
              <span style="font-weight: bold; font-size: 1.1em;">${awayTeam.name}</span>
            </div>
            <span style="color: #888; font-size: 0.9em; margin-right: 15px;">(${awayTeam.wins}-${awayTeam.losses})</span>
            ${game.status !== 'scheduled' ? `<span style="font-size: 1.4em; font-weight: bold; color: ${game.score.away > game.score.home ? '#4CAF50' : '#fff'}; min-width: 40px; text-align: right;">${game.score.away}</span>` : spread ? `<span style="color: ${spread.away > 0 ? '#f59e0b' : '#10b981'}; font-weight: bold; font-size: 0.9em;">${formatSpread(spread.away)} spread</span>` : ''}
          </div>
          
          <!-- vs/@ indicator -->
          <div style="color: #666; font-size: 0.85em; margin-left: 45px; margin-bottom: 5px;">@</div>
          
          <!-- Home Team -->
          <div style="display: flex; align-items: center;">
            <div style="display: flex; align-items: center; width: 250px;">
              <span style="font-size: ${homeTeam.logoSecondaryUrl ? '1.5em' : '1em'}; margin-right: 10px; min-width: 35px; text-align: center; background: ${homeTeam.logoSecondaryUrl ? 'transparent' : '#2a2a40'}; padding: ${homeTeam.logoSecondaryUrl ? '0' : '4px 8px'}; border-radius: 4px;">${homeLogo}</span>
              <span style="font-weight: bold; font-size: 1.1em;">${homeTeam.name}</span>
            </div>
            <span style="color: #888; font-size: 0.9em; margin-right: 15px;">(${homeTeam.wins}-${homeTeam.losses})</span>
            ${game.status !== 'scheduled' ? `<span style="font-size: 1.4em; font-weight: bold; color: ${game.score.home > game.score.away ? '#4CAF50' : '#fff'}; min-width: 40px; text-align: right;">${game.score.home}</span>` : spread ? `<span style="color: ${spread.home < 0 ? '#10b981' : '#f59e0b'}; font-weight: bold; font-size: 0.9em;">${formatSpread(spread.home)} spread</span>` : ''}
          </div>
        </div>
        
        <!-- Status & Actions -->
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 10px;">
          <div style="color: ${statusColor}; font-weight: bold; font-size: 0.95em; text-align: right;">
            ${statusDisplay}
            ${game.status === 'live' ? '<div style="color: #f44336; font-size: 0.9em; margin-top: 4px;">● LIVE</div>' : ''}
          </div>
          
          ${game.status === 'scheduled' ? `
            <div style="display: flex; gap: 8px;">
              <button onclick="simGameInstantUI('${game.id}')" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9em;">⚡ Sim Game</button>
              <button onclick="openGameDrawer('${game.id}')" style="padding: 8px 16px; background: #2196F3; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9em;">👁️ Watch Live</button>
            </div>
          ` : `
            <button onclick="openGameDrawer('${game.id}')" style="padding: 8px 16px; background: #2a2a40; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9em;">📊 View Details</button>
          `}
        </div>
      </div>
    </div>
    <script>
      // Load rivalry badge asynchronously
      (async function() {
        const score = await getRivalry(${game.homeTeamId}, ${game.awayTeamId});
        const label = getRivalryLabel(score);
        const badge = renderRivalryBadge(score, label);
        const el = document.getElementById('${rivalryBadgeId}');
        if (el && badge) {
          el.innerHTML = badge;
        }
      })();
    </script>
  `;
}

// Render a season event marker
function renderSeasonEvent(event) {
  const bgColors = {
    'season_start': 'linear-gradient(135deg, #1a4d2e 0%, #2d5f3f 100%)',
    'allstar_break': 'linear-gradient(135deg, #4a1a4d 0%, #6b2d6f 100%)',
    'trade_deadline': 'linear-gradient(135deg, #4d1a1a 0%, #6f2d2d 100%)',
    'season_end': 'linear-gradient(135deg, #1a3a4d 0%, #2d5a6f 100%)'
  };
  
  const borderColors = {
    'season_start': '#4CAF50',
    'allstar_break': '#9C27B0',
    'trade_deadline': '#f44336',
    'season_end': '#2196F3'
  };
  
  const bg = bgColors[event.type] || 'linear-gradient(135deg, #2a2a40 0%, #3a3a50 100%)';
  const borderColor = borderColors[event.type] || '#4CAF50';
  
  return `
    <div id="event-${event.id}" style="
      background: ${bg};
      border: 3px solid ${borderColor};
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    ">
      <div style="font-size: 2.5em; margin-bottom: 8px;">${event.icon}</div>
      <h3 style="margin: 0 0 8px 0; color: ${borderColor}; font-size: 1.3em;">${event.name}</h3>
      <p style="margin: 0; color: #ccc; font-size: 0.95em;">${event.description}</p>
      ${event.unlocks ? `
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1);">
          <span style="color: #4CAF50; font-size: 0.9em;">✓ Unlocks: ${event.unlocks.join(', ')}</span>
        </div>
      ` : ''}
      ${event.locks ? `
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1);">
          <span style="color: #f44336; font-size: 0.9em;">🔒 Locks: ${event.locks.join(', ')}</span>
        </div>
      ` : ''}
    </div>
  `;
}

// Create season event markers for existing leagues (migration helper)
function createSeasonEventMarkersForExistingLeague(gamesPerTeam = 82) {
  const events = [];
  
  // Season Start - before any games
  events.push({
    id: 'season_start',
    type: 'season_start',
    name: 'Season Start',
    description: 'The regular season begins',
    afterGameNumber: 0,
    icon: '🏀',
    triggered: false
  });
  
  // All-Star Weekend - after Game 41
  events.push({
    id: 'allstar_weekend',
    type: 'allstar_break',
    name: 'All-Star Weekend',
    description: 'Mid-season break featuring the All-Star Game',
    afterGameNumber: 41,
    icon: '⭐',
    triggered: false,
    unlocks: ['allstar_voting', 'allstar_game']
  });
  
  // Trade Deadline - after Game 55
  events.push({
    id: 'trade_deadline',
    type: 'trade_deadline',
    name: 'Trade Deadline',
    description: 'Last day to make trades - all trading disabled after this point',
    afterGameNumber: 55,
    icon: '🔒',
    triggered: false,
    locks: ['trades']
  });
  
  // Regular Season End - after Game 82
  events.push({
    id: 'season_end',
    type: 'season_end',
    name: 'Regular Season End',
    description: 'Season concludes - standings locked, awards voting begins',
    afterGameNumber: gamesPerTeam,
    icon: '🏁',
    triggered: false,
    unlocks: ['awards', 'playoffs']
  });
  
  return events;
}

// Check if a season event has been triggered
function isSeasonEventTriggered(eventType) {
  const events = league?.schedule?.events || [];
  const event = events.find(e => e.type === eventType);
  return event?.triggered || false;
}

// Check if trades are currently allowed
function areTradesAllowed() {
  // Trades are locked after trade deadline
  if (isSeasonEventTriggered('trade_deadline')) {
    return false;
  }
  
  // Trades are locked during playoffs
  if (league?.phase === 'playoffs') {
    return false;
  }
  
  return true;
}

// Trigger a season event and handle its effects
function triggerSeasonEvent(eventType) {
  const events = league?.schedule?.events || [];
  const event = events.find(e => e.type === eventType);
  
  if (!event || event.triggered) return;
  
  event.triggered = true;
  
  console.log(`[Season Event] Triggered: ${event.name}`);
  
  // Handle event effects
  switch (eventType) {
    case 'trade_deadline':
      console.log('[Season Event] Trade deadline passed - trades now locked');
      // UI will check isSeasonEventTriggered('trade_deadline') to disable trade button
      break;
      
    case 'allstar_break':
      console.log('[Season Event] All-Star Weekend - voting and game unlocked');
      // Stub for future All-Star implementation
      break;
      
    case 'season_end':
      console.log('[Season Event] Regular season ended - awards and playoffs unlocked');
      // Stub for future playoffs implementation
      break;
  }
  
  saveLeague();
}

// Check for events that should trigger based on completed games
function checkSeasonEvents() {
  if (!league?.schedule?.events) return;
  
  const allGames = Object.values(league.schedule.games || {});
  const completedCount = allGames.filter(g => g.status === 'final').length / 2; // Divide by 2 since each game involves 2 teams
  
  league.schedule.events.forEach(event => {
    if (!event.triggered && completedCount >= event.afterGameNumber) {
      triggerSeasonEvent(event.type);
    }
  });
}

function switchGamecastTab(tab) {
  activeGamecastTab = tab;
  
  // Update tab buttons
  const tabs = ['plays', 'stats'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    if (btn) {
      btn.style.borderBottom = t === tab ? '3px solid #2196F3' : 'none';
      btn.style.color = t === tab ? '#2196F3' : '#888';
    }
  });
  
  // Update content
  updateGamecastContent();
}

function switchStatsView(view) {
  activeStatsView = view;
  updateGamecastContent();
}

function switchStatsTabView(view) {
  activeStatsTabView = view;
  // When switching to box score, ensure we have a team selected (not 'game')
  if (view === 'boxscore' && activeStatsView === 'game') {
    const container = document.getElementById('gamecast-content');
    if (container) {
      const gameId = container.dataset.gameId;
      const game = league.schedule.games[gameId];
      if (game) {
        const userTeam = league.userTeamId;
        if (game.homeTeamId === userTeam || game.awayTeamId === userTeam) {
          activeStatsView = game.homeTeamId === userTeam ? 'home' : 'away';
        } else {
          activeStatsView = 'away';
        }
      }
    }
  }
  updateGamecastContent();
}

function toggleAutoScroll(enabled) {
  autoScrollPlays = enabled;
}

function jumpToLatestPlay() {
  const container = document.getElementById('playsScrollContainer');
  if (container) {
    container.scrollTop = 0; // Scroll to top (latest plays)
  }
}

function updateGamecastContent() {
  const container = document.getElementById('gamecast-content');
  if (!container) return;
  
  const gameId = container.dataset.gameId;
  if (!gameId) return;
  
  const game = league.schedule.games[gameId];
  if (!game) return;
  
  const homeTeam = league.teams.find(t => t.id === game.homeTeamId);
  const awayTeam = league.teams.find(t => t.id === game.awayTeamId);
  
  container.innerHTML = renderGamecastContent(game, homeTeam, awayTeam);
}

function switchLiveView(view) {
  console.log('Switching live view to:', view);
  activeLiveView = view;
  
  // Update tab styles
  const tabs = ['pbp', 'box', 'compare'];
  tabs.forEach(tab => {
    const btn = document.getElementById(`tab-${tab}`);
    if (btn) {
      btn.style.background = tab === view ? '#4CAF50' : 'transparent';
    }
  });
  
  // Show/hide views
  const views = ['pbp', 'box', 'compare'];
  views.forEach(v => {
    const viewEl = document.getElementById(`view-${v}`);
    if (viewEl) {
      viewEl.style.display = v === view ? (v === 'pbp' ? 'flex' : 'block') : 'none';
    }
  });
  
  // Update content for new view if live game is active
  if (activeGameDrawer) {
    updateLiveGameDisplay(activeGameDrawer);
  }
}

function navigateScheduleDay(direction) {
  const currentDay = getCurrentDay();
  const totalDays = getTotalScheduleDays(league.season);
  const newDay = currentDay + direction;
  
  if (newDay >= 1 && newDay <= totalDays) {
    setCurrentDay(newDay);
    save();
    render();
  }
}

function simEntireDayUI() {
  const currentDay = getCurrentDay();
  const games = getGamesForDay(league.season, currentDay);
  const scheduledGames = games.filter(g => g.status === 'scheduled');
  
  if (scheduledGames.length === 0) {
    alert('No games to simulate on this day.');
    return;
  }
  
  if (confirm(`Simulate all ${scheduledGames.length} game(s) on Day ${currentDay}?`)) {
    simEntireDay(league.season, currentDay);
    render();
  }
}

function simToNextUserGameUI() {
  const nextDay = getNextUserGameDay();
  
  if (!nextDay) {
    alert('No more user games scheduled this season.');
    return;
  }
  
  const currentDay = getCurrentDay();
  
  if (nextDay === currentDay) {
    alert(`Your next game is today (Day ${nextDay}).`);
    return;
  }
  
  if (confirm(`Simulate all games from Day ${currentDay} to Day ${nextDay - 1}?`)) {
    // Sim all days up to (but not including) the user game day
    for (let day = currentDay; day < nextDay; day++) {
      simEntireDay(league.season, day);
    }
    
    setCurrentDay(nextDay);
    save();
    render();
  }
}

function openGameDrawer(gameId) {
  activeGameDrawer = gameId;
  
  const game = league.schedule.games[gameId];
  if (game && game.status === 'scheduled') {
    // Open drawer and immediately start watching live
    startWatchLiveUI(gameId);
  } else {
    renderGameDrawer();
  }
}

function closeGameDrawer() {
  // Stop any live game intervals
  if (activeGameDrawer && liveGameIntervals.has(activeGameDrawer)) {
    clearInterval(liveGameIntervals.get(activeGameDrawer));
    liveGameIntervals.delete(activeGameDrawer);
  }
  
  activeGameDrawer = null;
  document.getElementById('game-drawer-container').innerHTML = '';
}

let gameDrawerTab = 'summary'; // 'summary', 'boxscore', 'playbyplay'

function renderGameDrawer() {
  if (!activeGameDrawer) return;
  
  const game = league.schedule.games[activeGameDrawer];
  if (!game) return;
  
  // Ensure game has a log array
  ensureGameLog(game);
  
  const homeTeam = league.teams.find(t => t.id === game.homeTeamId);
  const awayTeam = league.teams.find(t => t.id === game.awayTeamId);
  
  const container = document.getElementById('game-drawer-container');
  
  // Only render if container is empty (avoid re-rendering during live updates)
  if (container.children.length === 0) {
    console.log('Initial render of NBA-style gamecast for:', game.id);
    
    activeGamecastTab = game.status === 'live' ? 'plays' : 'matchup';
    
    container.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.95);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
      " onclick="if(event.target === this) closeGameDrawer()">
        
        <!-- Gamecast Container -->
        <div id="gamecast-modal" style="
          background: #1a1a2e;
          width: 100%;
          max-width: 900px;
          height: 95vh;
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        ">
          
          <!-- STICKY HEADER: Scoreboard -->
          <div id="gamecast-header" style="
            background: linear-gradient(135deg, #16213e 0%, #0f1624 100%);
            padding: 20px;
            border-bottom: 3px solid #2196F3;
            position: sticky;
            top: 0;
            z-index: 10;
          ">
            <!-- Close Button -->
            <button onclick="closeGameDrawer()" style="
              position: absolute;
              top: 10px;
              right: 10px;
              background: rgba(244, 67, 54, 0.2);
              color: #f44336;
              border: 1px solid #f44336;
              padding: 6px 12px;
              border-radius: 6px;
              cursor: pointer;
              font-weight: bold;
              font-size: 0.9em;
            ">✕ Close</button>
            
            <!-- Teams Row -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <!-- Away Team -->
              <div style="flex: 1; text-align: left;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="width: 48px; height: 48px; background: #2a2a40; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #2196F3;">
                    ${awayTeam.name.substring(0, 3).toUpperCase()}
                  </div>
                  <div>
                    <div style="font-size: 1.3em; font-weight: bold; color: #fff;">${awayTeam.name}</div>
                    <div style="font-size: 0.85em; color: #888;">${awayTeam.wins}-${awayTeam.losses}</div>
                  </div>
                </div>
              </div>
              
              <!-- Score -->
              <div style="text-align: center; min-width: 180px;">
                <div id="gamecast-score" style="font-size: 2.5em; font-weight: bold; letter-spacing: 2px;">
                  <span id="away-score-big" style="color: ${game.score.away > game.score.home ? '#4CAF50' : '#ccc'}">${game.score.away}</span>
                  <span style="color: #555; margin: 0 8px;">—</span>
                  <span id="home-score-big" style="color: ${game.score.home > game.score.away ? '#4CAF50' : '#ccc'}">${game.score.home}</span>
                </div>
                <div id="game-status-main" style="margin-top: 8px; font-size: 0.95em; color: #2196F3; font-weight: bold;">
                  ${game.status === 'final' ? 'FINAL' : ''}
                  ${game.status === 'live' ? `Q${game.quarter} ${game.timeRemaining}` : ''}
                  ${game.status === 'scheduled' ? 'Scheduled' : ''}
                </div>
                ${game.day ? `<div style="font-size: 0.8em; color: #666; margin-top: 4px;">Day ${game.day}</div>` : ''}
                <div id="rivalry-display-${game.id}" style="margin-top: 8px;"></div>
                <script>
                  // Load rivalry display asynchronously
                  (async function() {
                    const score = await getRivalry(${game.homeTeamId}, ${game.awayTeamId});
                    if (score >= 40) {
                      const label = getRivalryLabel(score);
                      const html = renderRivalryMeter(score, label);
                      const el = document.getElementById('rivalry-display-${game.id}');
                      if (el) {
                        el.innerHTML = html;
                      }
                    }
                  })();
                </script>
              </div>
              
              <!-- Home Team -->
              <div style="flex: 1; text-align: right;">
                <div style="display: flex; align-items: center; gap: 12px; justify-content: flex-end;">
                  <div>
                    <div style="font-size: 1.3em; font-weight: bold; color: #fff;">${homeTeam.name}</div>
                    <div style="font-size: 0.85em; color: #888;">${homeTeam.wins}-${homeTeam.losses}</div>
                  </div>
                  <div style="width: 48px; height: 48px; background: #2a2a40; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #2196F3;">
                    ${homeTeam.name.substring(0, 3).toUpperCase()}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- STICKY TAB BAR -->
          <div id="gamecast-tabs" style="
            background: #0f1624;
            display: flex;
            border-bottom: 2px solid #2a2a40;
            position: sticky;
            top: 0;
            z-index: 9;
          ">
            <button onclick="switchGamecastTab('plays')" id="tab-plays" style="
              flex: 1;
              padding: 14px;
              background: transparent;
              color: ${activeGamecastTab === 'plays' ? '#2196F3' : '#888'};
              border: none;
              border-bottom: 3px solid ${activeGamecastTab === 'plays' ? '#2196F3' : 'transparent'};
              cursor: pointer;
              font-weight: bold;
              font-size: 0.9em;
              transition: all 0.2s;
            ">Plays</button>
            <button onclick="switchGamecastTab('stats')" id="tab-stats" style="
              flex: 1;
              padding: 14px;
              background: transparent;
              color: ${activeGamecastTab === 'stats' ? '#2196F3' : '#888'};
              border: none;
              border-bottom: 3px solid ${activeGamecastTab === 'stats' ? '#2196F3' : 'transparent'};
              cursor: pointer;
              font-weight: bold;
              font-size: 0.9em;
              transition: all 0.2s;
            ">Stats</button>
          </div>
          
          <!-- TAB CONTENT AREA -->
          <div id="gamecast-content" data-game-id="${game.id}" style="flex: 1; overflow-y: auto; background: #1a1a2e;">
            ${renderGamecastContent(game, homeTeam, awayTeam)}
          </div>
          
          <!-- STICKY BOTTOM CONTROLS -->
          ${renderGamecastControls(game)}
          
        </div>
      </div>
    `;
  }
}

function renderGamecastContent(game, homeTeam, awayTeam) {
  // If game is scheduled, show action buttons
  if (game.status === 'scheduled') {
    return `
      <div style="padding: 60px 20px; text-align: center;">
        <div style="font-size: 3em; margin-bottom: 20px;">🏀</div>
        <h3 style="color: #fff; margin-bottom: 30px;">Game Not Started</h3>
        <div style="display: flex; gap: 15px; max-width: 400px; margin: 0 auto;">
          <button onclick="simGameInstantUI('${game.id}')" style="
            flex: 1;
            background: #4CAF50;
            color: white;
            border: none;
            padding: 16px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            font-size: 1em;
          ">⚡ Sim Instant</button>
          <button onclick="startWatchLiveUI('${game.id}')" style="
            flex: 1;
            background: #2196F3;
            color: white;
            border: none;
            padding: 16px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            font-size: 1em;
          ">👁️ Watch Live</button>
        </div>
      </div>
    `;
  }
  
  // Render based on active tab
  switch(activeGamecastTab) {
    case 'plays':
      return renderPlaysTab(game, homeTeam, awayTeam);
    case 'stats':
      return renderGamecastStatsTab(game, homeTeam, awayTeam);
    case 'matchup':
      return renderMatchupTab(game, homeTeam, awayTeam);
    case 'odds':
      return renderOddsTab(game, homeTeam, awayTeam);
    default:
      return '<div style="padding: 20px;">Loading...</div>';
  }
}

function renderPlaysTab(game, homeTeam, awayTeam) {
  // Ensure log exists and is an array
  ensureGameLog(game);
  
  if (DEBUG_PLAYS) {
    console.log(`[PLAYS] renderPlaysTab: game ${game.id}, log has ${game.log.length} entries`);
  }
  
  if (game.log.length === 0) {
    return `
      <div style="padding: 80px 20px; text-align: center; color: #888;">
        <div style="font-size: 2.5em; margin-bottom: 15px;">⏳</div>
        <div style="font-size: 1.1em;">Waiting for first event...</div>
        <div style="font-size: 0.9em; margin-top: 8px;">Play-by-play will appear here</div>
      </div>
    `;
  }
  
  return `
    <div id="plays-tab-content" style="padding: 0;">
      <!-- Controls -->
      <div style="padding: 12px 20px; background: #0f1624; border-bottom: 1px solid #2a2a40; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #888; font-size: 0.9em;">${game.log.length} plays</span>
        <div style="display: flex; gap: 10px; align-items: center;">
          <label style="display: flex; align-items: center; gap: 6px; color: #888; font-size: 0.85em; cursor: pointer;">
            <input type="checkbox" id="autoScrollToggle" ${autoScrollPlays ? 'checked' : ''} onchange="toggleAutoScroll(this.checked)" style="cursor: pointer;">
            Auto-scroll
          </label>
          <button onclick="jumpToLatestPlay()" style="
            background: #2196F3;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.85em;
            font-weight: bold;
          ">⇩ Latest</button>
        </div>
      </div>
      
      <!-- Play Feed -->
      <div id="playsScrollContainer" style="max-height: calc(95vh - 340px); overflow-y: auto; background: #1a1a2e;">
        ${renderPlayByPlayFeed(game, homeTeam, awayTeam)}
      </div>
    </div>
  `;
}

function renderPlayByPlayFeed(game, homeTeam, awayTeam) {
  // Ensure log exists
  ensureGameLog(game);
  if (game.log.length === 0) return '';
  
  if (DEBUG_PLAYS) {
    console.log(`[PLAYS] renderPlayByPlayFeed: rendering ${game.log.length} plays`);
  }
  
  // Group plays by quarter
  const playsByQuarter = {};
  game.log.forEach(play => {
    if (!playsByQuarter[play.quarter]) playsByQuarter[play.quarter] = [];
    playsByQuarter[play.quarter].push(play);
  });
  
  let html = '';
  
  // Render in reverse order (latest quarter first)
  const quarters = Object.keys(playsByQuarter).sort((a, b) => b - a);
  
  quarters.forEach(q => {
    const plays = playsByQuarter[q];
    
    // Quarter header
    html += `
      <div style="
        padding: 12px 20px;
        background: #0f1624;
        border-bottom: 2px solid #2a2a40;
        font-weight: bold;
        color: #2196F3;
        font-size: 0.95em;
        position: sticky;
        top: 0;
        z-index: 5;
      ">${getQuarterLabel(parseInt(q))}</div>
    `;
    
    // Plays (reverse order within quarter - newest first)
    plays.slice().reverse().forEach((play, idx) => {
      const isScoring = play.scored;
      const bgColor = idx % 2 === 0 ? '#1a1a2e' : '#16213e';
      
      html += `
        <div style="
          padding: 12px 20px;
          background: ${isScoring ? 'rgba(33, 150, 243, 0.1)' : bgColor};
          border-left: 3px solid ${isScoring ? '#2196F3' : 'transparent'};
          border-bottom: 1px solid #2a2a40;
          display: flex;
          align-items: center;
          gap: 12px;
        ">
          <!-- Time -->
          <span style="
            min-width: 50px;
            color: #666;
            font-size: 0.85em;
            font-family: monospace;
          ">${play.time}</span>
          
          <!-- Team Icon -->
          <div style="
            width: 24px;
            height: 24px;
            background: #2a2a40;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.7em;
            font-weight: bold;
            color: #2196F3;
          ">${play.text.includes(homeTeam.name) ? homeTeam.name.substring(0, 2).toUpperCase() : awayTeam.name.substring(0, 2).toUpperCase()}</div>
          
          <!-- Play Text -->
          <span style="flex: 1; color: #ccc; font-size: 0.9em;">${play.text}</span>
          
          <!-- Score -->
          ${play.score ? `
            <span style="
              min-width: 70px;
              text-align: right;
              color: #4CAF50;
              font-weight: bold;
              font-size: 0.9em;
              font-family: monospace;
            ">${play.score.away}-${play.score.home}</span>
          ` : ''}
        </div>
      `;
    });
  });
  
  // Game End marker if final
  if (game.status === 'final') {
    html = `
      <div style="
        padding: 16px 20px;
        background: #4CAF50;
        color: white;
        font-weight: bold;
        text-align: center;
        font-size: 1em;
      ">✓ GAME END</div>
    ` + html;
  }
  
  return html;
}

function getQuarterLabel(q) {
  const labels = { 1: '1st Quarter', 2: '2nd Quarter', 3: '3rd Quarter', 4: '4th Quarter' };
  return labels[q] || `Q${q}`;
}

function renderGamecastStatsTab(game, homeTeam, awayTeam) {
  return `
    <div style="padding: 0;">
      <!-- Team vs Box Score Toggle -->
      <div style="
        padding: 12px 20px;
        background: #0f1624;
        border-bottom: 1px solid #2a2a40;
        display: flex;
        justify-content: center;
        gap: 8px;
      ">
        <button onclick="switchStatsTabView('team')" style="
          padding: 8px 24px;
          background: ${activeStatsTabView === 'team' ? '#2196F3' : '#16213e'};
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
          font-size: 0.9em;
          transition: all 0.2s;
        ">📊 Team</button>
        <button onclick="switchStatsTabView('boxscore')" 
                ${(!game.log || game.log.length === 0) && !game.boxScore ? 'disabled' : ''}
                style="
          padding: 8px 24px;
          background: ${activeStatsTabView === 'boxscore' ? '#2196F3' : '#16213e'};
          color: ${(!game.log || game.log.length === 0) && !game.boxScore ? '#666' : 'white'};
          border: none;
          border-radius: 6px;
          cursor: ${(!game.log || game.log.length === 0) && !game.boxScore ? 'not-allowed' : 'pointer'};
          font-weight: bold;
          font-size: 0.9em;
          transition: all 0.2s;
          opacity: ${(!game.log || game.log.length === 0) && !game.boxScore ? '0.5' : '1'};
        ">📋 Box Score</button>
      </div>
      
      <!-- Segmented Control (only for Box Score view) -->
      ${activeStatsTabView === 'boxscore' ? `
        <div style="
          padding: 12px 20px;
          background: #0f1624;
          border-bottom: 1px solid #2a2a40;
          display: flex;
          justify-content: center;
          gap: 10px;
        ">
          <button onclick="switchStatsView('away')" style="
            padding: 8px 20px;
            background: ${activeStatsView === 'away' ? '#2196F3' : '#2a2a40'};
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            font-size: 0.9em;
          ">${awayTeam.name}</button>
          <button onclick="switchStatsView('home')" style="
            padding: 8px 20px;
            background: ${activeStatsView === 'home' ? '#2196F3' : '#2a2a40'};
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            font-size: 0.9em;
          ">${homeTeam.name}</button>
        </div>
      ` : ''}
      
      <!-- Stats Content -->
      <div id="stats-content-container" style="padding: 20px; overflow-y: auto; max-height: calc(95vh - ${activeStatsTabView === 'boxscore' ? '440px' : '380px'});">
        ${renderStatsContent(game, homeTeam, awayTeam)}
      </div>
    </div>
  `;
}

function renderStatsContent(game, homeTeam, awayTeam) {
  // Safety check - this is for gamecast only
  if (!game || !homeTeam || !awayTeam) {
    return '<div>No game data available</div>';
  }
  
  if (activeStatsTabView === 'team') {
    return renderTeamStatsView(game, homeTeam, awayTeam);
  } else {
    // Check if game has started before showing box score
    const gameHasStarted = (game.log && game.log.length > 0) || game.boxScore;
    if (!gameHasStarted) {
      return `
        <div style="
          padding: 60px 20px;
          text-align: center;
          color: #888;
        ">
          <div style="font-size: 3em; margin-bottom: 20px; opacity: 0.3;">📊</div>
          <div style="font-size: 1.1em; color: #aaa; margin-bottom: 10px;">Box score not available yet</div>
          <div style="font-size: 0.9em; color: #666;">Box score will be available once the game is underway.</div>
        </div>
      `;
    }
    
    // Box Score view - show selected team
    // Default to user team if involved, otherwise away team
    const userTeam = league.userTeamId;
    if (activeStatsView === 'game') {
      // First time switching to box score, pick a default
      if (game.homeTeamId === userTeam || game.awayTeamId === userTeam) {
        activeStatsView = game.homeTeamId === userTeam ? 'home' : 'away';
      } else {
        activeStatsView = 'away';
      }
    }
    
    if (activeStatsView === 'away') {
      return renderTeamBoxScore(game, awayTeam, 'away');
    } else {
      return renderTeamBoxScore(game, homeTeam, 'home');
    }
  }
}

function renderTeamStatsView(game, homeTeam, awayTeam) {
  // Safety check
  if (!game || !homeTeam || !awayTeam) {
    return '<div>No game data available</div>';
  }
  
  // Calculate team totals from box score if available
  const awayStats = game.boxScore?.away || {};
  const homeStats = game.boxScore?.home || {};
  
  const awayTotals = calculateTeamTotals(awayStats);
  const homeTotals = calculateTeamTotals(homeStats);
  
  // Quarter scores (use actual if available, otherwise distribute evenly)
  const quarters = [1, 2, 3, 4];
  const awayQuarters = quarters.map(q => Math.floor(game.score.away / 4) + (q <= (game.score.away % 4) ? 1 : 0));
  const homeQuarters = quarters.map(q => Math.floor(game.score.home / 4) + (q <= (game.score.home % 4) ? 1 : 0));
  
  return `
    <div>
      <!-- Quarter Scoring Table -->
      <h4 style="margin: 0 0 15px 0; color: #2196F3;">Scoring by Quarter</h4>
      <div style="overflow-x: auto; margin-bottom: 25px;">
        <table style="width: 100%; border-collapse: collapse; background: #0f1624; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: #16213e; color: #2196F3;">
              <th style="text-align: left; padding: 12px; font-size: 0.85em;">TEAM</th>
              <th style="text-align: center; padding: 12px; font-size: 0.85em;">Q1</th>
              <th style="text-align: center; padding: 12px; font-size: 0.85em;">Q2</th>
              <th style="text-align: center; padding: 12px; font-size: 0.85em;">Q3</th>
              <th style="text-align: center; padding: 12px; font-size: 0.85em;">Q4</th>
              <th style="text-align: center; padding: 12px; font-size: 0.85em; font-weight: bold;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #2a2a40;">
              <td style="padding: 12px; color: #ccc; font-weight: bold;">${awayTeam.name}</td>
              ${awayQuarters.map(score => `<td style="text-align: center; padding: 12px; color: #888;">${score}</td>`).join('')}
              <td style="text-align: center; padding: 12px; color: #4CAF50; font-weight: bold; font-size: 1.1em;">${game.score.away}</td>
            </tr>
            <tr>
              <td style="padding: 12px; color: #ccc; font-weight: bold;">${homeTeam.name}</td>
              ${homeQuarters.map(score => `<td style="text-align: center; padding: 12px; color: #888;">${score}</td>`).join('')}
              <td style="text-align: center; padding: 12px; color: #4CAF50; font-weight: bold; font-size: 1.1em;">${game.score.home}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Team Totals Comparison -->
      <h4 style="margin: 0 0 15px 0; color: #2196F3;">Team Totals</h4>
      <div style="background: #0f1624; border-radius: 8px; padding: 15px;">
        ${renderStatComparison('Rebounds', awayTotals.reb, homeTotals.reb)}
        ${renderStatComparison('Assists', awayTotals.ast, homeTotals.ast)}
        ${renderStatComparison('Steals', awayTotals.stl, homeTotals.stl)}
        ${renderStatComparison('Blocks', awayTotals.blk, homeTotals.blk)}
        ${renderStatComparison('Turnovers', awayTotals.to, homeTotals.to, true)}
        ${renderStatComparison('Field Goal %', awayTotals.fgPct + '%', homeTotals.fgPct + '%')}
        ${renderStatComparison('3-Point %', awayTotals.threePct + '%', homeTotals.threePct + '%')}
        ${renderStatComparison('Free Throw %', awayTotals.ftPct + '%', homeTotals.ftPct + '%')}
      </div>
    </div>
  `;
}

function calculateTeamTotals(teamStats) {
  if (!teamStats.players || teamStats.players.length === 0) {
    // Generate placeholder stats
    return {
      reb: Math.floor(35 + Math.random() * 15),
      ast: Math.floor(18 + Math.random() * 12),
      stl: Math.floor(5 + Math.random() * 8),
      blk: Math.floor(3 + Math.random() * 7),
      to: Math.floor(10 + Math.random() * 10),
      fgPct: (40 + Math.random() * 15).toFixed(1),
      threePct: (30 + Math.random() * 15).toFixed(1),
      ftPct: (70 + Math.random() * 20).toFixed(1)
    };
  }
  
  const totals = teamStats.players.reduce((acc, p) => {
    acc.reb += p.reb || 0;
    acc.ast += p.ast || 0;
    acc.stl += p.stl || 0;
    acc.blk += p.blk || 0;
    acc.to += p.to || 0;
    return acc;
  }, { reb: 0, ast: 0, stl: 0, blk: 0, to: 0 });
  
  return {
    ...totals,
    fgPct: (40 + Math.random() * 15).toFixed(1),
    threePct: (30 + Math.random() * 15).toFixed(1),
    ftPct: (70 + Math.random() * 20).toFixed(1)
  };
}

function renderStatComparison(label, awayVal, homeVal, inverse = false) {
  const awayNum = typeof awayVal === 'string' ? parseFloat(awayVal) : awayVal;
  const homeNum = typeof homeVal === 'string' ? parseFloat(homeVal) : homeVal;
  const awayLeads = inverse ? (awayNum < homeNum) : (awayNum > homeNum);
  
  return `
    <div style="
      padding: 12px 0;
      border-bottom: 1px solid #2a2a40;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 15px;
    ">
      <div style="text-align: right; color: ${awayLeads ? '#4CAF50' : '#888'}; font-weight: ${awayLeads ? 'bold' : 'normal'}; font-size: 1.1em;">
        ${awayVal} ${awayLeads ? '▶' : ''}
      </div>
      <div style="color: #666; font-size: 0.85em; text-align: center; min-width: 100px;">${label}</div>
      <div style="text-align: left; color: ${!awayLeads ? '#4CAF50' : '#888'}; font-weight: ${!awayLeads ? 'bold' : 'normal'}; font-size: 1.1em;">
        ${!awayLeads ? '◀' : ''} ${homeVal}
      </div>
    </div>
  `;
}

function renderTeamBoxScore(game, team, side) {
  if (!game.boxScore || !game.boxScore[side]) {
    return '<div style="padding: 40px; text-align: center; color: #888;">Box score not available</div>';
  }
  
  const players = game.boxScore[side].players;
  const starters = players.slice(0, 5);
  const bench = players.slice(5);
  
  const renderPlayerRows = (playerList, isStarter) => {
    return playerList.map((p, idx) => `
      <tr style="border-bottom: 1px solid #2a2a40; ${!isStarter ? 'opacity: 0.85;' : ''}">
        <td style="padding: 10px 12px; color: #ccc; font-size: 0.85em;">
          ${p.name}
          ${isStarter ? '<span style="color: #2196F3; margin-left: 4px; font-size: 0.75em;">●</span>' : ''}
        </td>
        <td style="text-align: center; padding: 10px 8px; color: #888; font-size: 0.85em;">${p.min || 0}</td>
        <td style="text-align: center; padding: 10px 8px; color: #4CAF50; font-weight: bold; font-size: 0.9em;">${p.pts || 0}</td>
        <td style="text-align: center; padding: 10px 8px; color: #888; font-size: 0.85em;">${p.reb || 0}</td>
        <td style="text-align: center; padding: 10px 8px; color: #888; font-size: 0.85em;">${p.ast || 0}</td>
        <td style="text-align: center; padding: 10px 8px; color: #888; font-size: 0.85em;">${p.stl || 0}</td>
        <td style="text-align: center; padding: 10px 8px; color: #888; font-size: 0.85em;">${p.blk || 0}</td>
        <td style="text-align: center; padding: 10px 8px; color: #888; font-size: 0.85em;">${p.to || 0}</td>
      </tr>
    `).join('');
  };
  
  return `
    <div>
      <h4 style="margin: 0 0 15px 0; color: #2196F3; display: flex; justify-content: space-between; align-items: center;">
        <span>${team.name}</span>
        <span style="font-size: 1.3em;">${game.score[side]}</span>
      </h4>
      <div style="overflow-x: auto;">
        <table style="width: 100%; min-width: 600px; border-collapse: collapse; background: #0f1624; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: #16213e; color: #2196F3;">
              <th style="text-align: left; padding: 10px 12px; font-size: 0.8em; min-width: 140px;">PLAYER</th>
              <th style="text-align: center; padding: 10px 8px; font-size: 0.8em; min-width: 50px;">MIN</th>
              <th style="text-align: center; padding: 10px 8px; font-size: 0.8em; min-width: 50px;">PTS</th>
              <th style="text-align: center; padding: 10px 8px; font-size: 0.8em; min-width: 50px;">REB</th>
              <th style="text-align: center; padding: 10px 8px; font-size: 0.8em; min-width: 50px;">AST</th>
              <th style="text-align: center; padding: 10px 8px; font-size: 0.8em; min-width: 50px;">STL</th>
              <th style="text-align: center; padding: 10px 8px; font-size: 0.8em; min-width: 50px;">BLK</th>
              <th style="text-align: center; padding: 10px 8px; font-size: 0.8em; min-width: 50px;">TO</th>
            </tr>
          </thead>
          <tbody>
            ${renderPlayerRows(starters, true)}
            ${bench.length > 0 ? `
              <tr style="background: #16213e;">
                <td colspan="8" style="padding: 8px 12px; color: #666; font-size: 0.8em; font-weight: bold; text-transform: uppercase;">Bench</td>
              </tr>
              ${renderPlayerRows(bench, false)}
            ` : ''}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderMatchupTab(game, homeTeam, awayTeam) {
  return `
    <div style="padding: 20px;">
      <h3 style="margin: 0 0 20px 0; color: #2196F3; text-align: center;">Team Overview</h3>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
        <!-- Away Team -->
        <div style="background: #0f1624; border-radius: 8px; padding: 20px; border: 2px solid #2a2a40;">
          <h4 style="margin: 0 0 15px 0; color: #fff; text-align: center;">${awayTeam.name}</h4>
          <div style="text-align: center; margin-bottom: 15px;">
            <div style="font-size: 2em; color: #2196F3;">${awayTeam.wins}-${awayTeam.losses}</div>
            <div style="font-size: 0.85em; color: #888;">Record</div>
          </div>
          <div style="border-top: 1px solid #2a2a40; padding-top: 15px;">
            <div style="margin-bottom: 10px; color: #ccc; font-size: 0.9em;">
              <span style="color: #888;">Off Rating:</span> ${(105 + Math.random() * 10).toFixed(1)}
            </div>
            <div style="margin-bottom: 10px; color: #ccc; font-size: 0.9em;">
              <span style="color: #888;">Def Rating:</span> ${(105 + Math.random() * 10).toFixed(1)}
            </div>
            <div style="color: #ccc; font-size: 0.9em;">
              <span style="color: #888;">Pace:</span> ${(95 + Math.random() * 10).toFixed(1)}
            </div>
          </div>
        </div>
        
        <!-- Home Team -->
        <div style="background: #0f1624; border-radius: 8px; padding: 20px; border: 2px solid #2a2a40;">
          <h4 style="margin: 0 0 15px 0; color: #fff; text-align: center;">${homeTeam.name}</h4>
          <div style="text-align: center; margin-bottom: 15px;">
            <div style="font-size: 2em; color: #2196F3;">${homeTeam.wins}-${homeTeam.losses}</div>
            <div style="font-size: 0.85em; color: #888;">Record</div>
          </div>
          <div style="border-top: 1px solid #2a2a40; padding-top: 15px;">
            <div style="margin-bottom: 10px; color: #ccc; font-size: 0.9em;">
              <span style="color: #888;">Off Rating:</span> ${(105 + Math.random() * 10).toFixed(1)}
            </div>
            <div style="margin-bottom: 10px; color: #ccc; font-size: 0.9em;">
              <span style="color: #888;">Def Rating:</span> ${(105 + Math.random() * 10).toFixed(1)}
            </div>
            <div style="color: #ccc; font-size: 0.9em;">
              <span style="color: #888;">Pace:</span> ${(95 + Math.random() * 10).toFixed(1)}
            </div>
          </div>
        </div>
      </div>
      
      <div style="background: #0f1624; border-radius: 8px; padding: 20px; text-align: center;">
        <div style="color: #888; font-size: 0.9em; margin-bottom: 8px;">Game ${game.day || 'TBD'} - ${league.season} Season</div>
        <div style="color: #ccc;">Regular Season</div>
      </div>
    </div>
  `;
}

function renderOddsTab(game, homeTeam, awayTeam) {
  const awayProb = 45 + Math.random() * 10;
  const homeProb = 100 - awayProb;
  
  return `
    <div style="padding: 20px;">
      <h3 style="margin: 0 0 20px 0; color: #2196F3; text-align: center;">Game Forecast</h3>
      
      <div style="background: #0f1624; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
        <h4 style="margin: 0 0 20px 0; color: #fff; text-align: center;">Win Probability</h4>
        
        <!-- Away Team -->
        <div style="margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="color: #ccc; font-weight: bold;">${awayTeam.name}</span>
            <span style="color: #2196F3; font-weight: bold;">${awayProb.toFixed(1)}%</span>
          </div>
          <div style="background: #2a2a40; height: 12px; border-radius: 6px; overflow: hidden;">
            <div style="background: linear-gradient(90deg, #2196F3, #1976D2); height: 100%; width: ${awayProb}%; transition: width 0.3s;"></div>
          </div>
        </div>
        
        <!-- Home Team -->
        <div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="color: #ccc; font-weight: bold;">${homeTeam.name}</span>
            <span style="color: #4CAF50; font-weight: bold;">${homeProb.toFixed(1)}%</span>
          </div>
          <div style="background: #2a2a40; height: 12px; border-radius: 6px; overflow: hidden;">
            <div style="background: linear-gradient(90deg, #4CAF50, #388E3C); height: 100%; width: ${homeProb}%; transition: width 0.3s;"></div>
          </div>
        </div>
      </div>
      
      <div style="background: #0f1624; border-radius: 8px; padding: 20px; text-align: center;">
        <div style="color: #888; font-size: 0.85em; margin-bottom: 10px;">Projected Total</div>
        <div style="font-size: 2em; color: #2196F3; font-weight: bold;">${(game.score.away + game.score.home) || 210}</div>
        <div style="color: #888; font-size: 0.85em; margin-top: 8px;">Combined Points</div>
      </div>
    </div>
  `;
}

function renderGamecastControls(game) {
  if (game.status === 'final') {
    return `
      <div style="
        background: #0f1624;
        padding: 15px 20px;
        border-top: 2px solid #2a2a40;
        display: flex;
        justify-content: center;
        gap: 10px;
      ">
        <button onclick="closeGameDrawer()" style="
          padding: 12px 30px;
          background: #2196F3;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
          font-size: 1em;
        ">Close</button>
      </div>
    `;
  }
  
  if (game.status === 'live') {
    const isRunning = liveGameIntervals.has(game.id);
    
    return `
      <div style="
        background: #0f1624;
        padding: 15px 20px;
        border-top: 2px solid #2a2a40;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <!-- Left Controls -->
        <div style="display: flex; gap: 10px;">
          ${isRunning ? `
            <button onclick="pauseLiveGameUI('${game.id}')" style="
              padding: 10px 20px;
              background: #ff9800;
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-weight: bold;
            ">⏸️ Pause</button>
          ` : `
            <button onclick="resumeLiveGameUI('${game.id}')" style="
              padding: 10px 20px;
              background: #4CAF50;
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-weight: bold;
            ">▶️ Resume</button>
          `}
          <button onclick="simToEndUI('${game.id}')" style="
            padding: 10px 20px;
            background: #2196F3;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
          ">⏭️ Sim to End</button>
        </div>
        
        <!-- Right: Speed Control -->
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="color: #888; font-size: 0.9em; font-weight: bold;">Speed:</span>
          <button onclick="setLiveGameSpeed(1)" style="
            padding: 8px 16px;
            background: ${liveGameSpeed === 1 ? '#2196F3' : '#2a2a40'};
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
          ">1x</button>
          <button onclick="setLiveGameSpeed(2)" style="
            padding: 8px 16px;
            background: ${liveGameSpeed === 2 ? '#2196F3' : '#2a2a40'};
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
          ">2x</button>
          <button onclick="setLiveGameSpeed(5)" style="
            padding: 8px 16px;
            background: ${liveGameSpeed === 5 ? '#2196F3' : '#2a2a40'};
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
          ">5x</button>
        </div>
      </div>
    `;
  }
  
  return '';
}

function renderGameDrawerContent(game, homeTeam, awayTeam) {
  if (gameDrawerTab === 'summary') {
    return `
      <div>
        <h4>Game Summary</h4>
        ${game.status === 'scheduled' ? `
          <p>This game has not been played yet. Use the buttons above to simulate or watch live.</p>
        ` : ''}
        ${game.status === 'final' || game.status === 'live' ? `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
            <div style="background: #0f1624; padding: 15px; border-radius: 6px;">
              <h5 style="margin-top: 0;">${awayTeam.name}</h5>
              <div>Record: ${awayTeam.wins}-${awayTeam.losses}</div>
              <div style="font-size: 2em; font-weight: bold; margin-top: 10px;">${game.score.away}</div>
            </div>
            <div style="background: #0f1624; padding: 15px; border-radius: 6px;">
              <h5 style="margin-top: 0;">${homeTeam.name}</h5>
              <div>Record: ${homeTeam.wins}-${homeTeam.losses}</div>
              <div style="font-size: 2em; font-weight: bold; margin-top: 10px;">${game.score.home}</div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  } else if (gameDrawerTab === 'boxscore') {
    if (!game.boxScore) {
      return `<p style="text-align: center; padding: 40px; color: #888;">Box score not available yet.</p>`;
    }
    
    return `
      <div>
        <h4>${awayTeam.name}</h4>
        <table style="width: 100%; margin-bottom: 30px;">
          <thead>
            <tr style="background: #16213e;">
              <th style="text-align: left; padding: 8px;">Player</th>
              <th style="padding: 8px;">MIN</th>
              <th style="padding: 8px;">PTS</th>
              <th style="padding: 8px;">REB</th>
              <th style="padding: 8px;">AST</th>
            </tr>
          </thead>
          <tbody>
            ${game.boxScore.away.players.map(p => `
              <tr style="border-bottom: 1px solid #2a2a40;">
                <td style="padding: 8px;">${p.name}</td>
                <td style="text-align: center; padding: 8px;">${p.min}</td>
                <td style="text-align: center; padding: 8px;">${p.pts}</td>
                <td style="text-align: center; padding: 8px;">${p.reb}</td>
                <td style="text-align: center; padding: 8px;">${p.ast}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <h4>${homeTeam.name}</h4>
        <table style="width: 100%;">
          <thead>
            <tr style="background: #16213e;">
              <th style="text-align: left; padding: 8px;">Player</th>
              <th style="padding: 8px;">MIN</th>
              <th style="padding: 8px;">PTS</th>
              <th style="padding: 8px;">REB</th>
              <th style="padding: 8px;">AST</th>
            </tr>
          </thead>
          <tbody>
            ${game.boxScore.home.players.map(p => `
              <tr style="border-bottom: 1px solid #2a2a40;">
                <td style="padding: 8px;">${p.name}</td>
                <td style="text-align: center; padding: 8px;">${p.min}</td>
                <td style="text-align: center; padding: 8px;">${p.pts}</td>
                <td style="text-align: center; padding: 8px;">${p.reb}</td>
                <td style="text-align: center; padding: 8px;">${p.ast}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else if (gameDrawerTab === 'playbyplay') {
    if (!game.log || game.log.length === 0) {
      return `<p style="text-align: center; padding: 40px; color: #888;">No play-by-play available yet.</p>`;
    }
    
    return `
      <div style="height: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h4 style="margin: 0;">Play-by-Play</h4>
          <span style="color: #888; font-size: 0.9em;">${game.log.length} events</span>
        </div>
        <div style="background: #0f1624; padding: 15px; border-radius: 6px; height: calc(100vh - 400px); overflow-y: auto;">
          ${[...game.log].reverse().map(entry => `
            <div style="padding: 10px; border-bottom: 1px solid #2a2a40; ${entry.scored ? 'background: rgba(76, 175, 80, 0.1); border-left: 3px solid #4CAF50; margin-left: -3px;' : ''}">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <span style="color: #888; font-size: 0.85em; font-weight: bold;">Q${entry.quarter} ${entry.time}</span>
                  <span style="margin-left: 15px; font-size: 1.05em;">${entry.text}</span>
                </div>
                ${entry.score ? `<span style="font-weight: bold; font-size: 1.1em; color: #4CAF50;">${entry.score.away} - ${entry.score.home}</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  return '';
}

let liveGameSpeed = 1; // 1x, 2x, 5x

function renderLiveGameControls(gameId) {
  const isRunning = liveGameIntervals.has(gameId);
  
  return `
    <div style="border-top: 2px solid #2a2a40; padding: 15px; background: #0f1624;">
      <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between;">
        <div style="display: flex; gap: 10px;">
          ${isRunning ? `
            <button onclick="pauseLiveGameUI('${gameId}')" style="background: #ff9800; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold;">⏸️ Pause</button>
          ` : `
            <button onclick="resumeLiveGameUI('${gameId}')" style="background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold;">▶️ Resume</button>
          `}
          <button onclick="simToEndUI('${gameId}')" style="background: #2196F3; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold;">⏩ Sim to End</button>
        </div>
        
        <div style="display: flex; gap: 10px; align-items: center;">
          <span style="font-weight: bold;">Speed:</span>
          <button onclick="setLiveGameSpeed(1)" style="background: ${liveGameSpeed === 1 ? '#4CAF50' : '#2a2a40'}; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">1x</button>
          <button onclick="setLiveGameSpeed(2)" style="background: ${liveGameSpeed === 2 ? '#4CAF50' : '#2a2a40'}; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">2x</button>
          <button onclick="setLiveGameSpeed(5)" style="background: ${liveGameSpeed === 5 ? '#4CAF50' : '#2a2a40'}; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">5x</button>
        </div>
      </div>
    </div>
  `;
}

function setGameDrawerTab(tab) {
  gameDrawerTab = tab;
  renderGameDrawer();
}

function simGameInstantUI(gameId) {
  console.log('Sim Instant for game:', gameId);
  simGameInstant(gameId);
  save();
  
  // Close and reopen drawer to show results
  closeGameDrawer();
  render();
}

function startWatchLiveUI(gameId) {
  console.log('Starting Watch Live for game:', gameId);
  
  // Reset to play-by-play view
  activeLiveView = 'pbp';
  
  if (startLiveGame(gameId)) {
    save();
    
    // Show live game container and hide other sections
    const liveContainer = document.getElementById('liveGameContainer');
    const actionButtons = document.getElementById('game-action-buttons');
    const drawerContent = document.getElementById('game-drawer-content');
    
    if (pbpContainer) {
      pbpContainer.style.display = 'flex';
      pbpContainer.style.flexDirection = 'column';
      console.log('✓ Play-by-play container shown');
    } else {
      console.error('✗ Play-by-play container not found!');
    }
    
    if (actionButtons) {
      actionButtons.style.display = 'none';
    }
    
    if (drawerContent) {
      drawerContent.style.display = 'none';
      console.log('✓ Game summary hidden');
    }
    
    // Clear feed and initialize
    const feed = document.getElementById('playByPlayFeed');
    if (feed) {
      feed.innerHTML = '';
      console.log('✓ Play-by-play feed cleared and ready');
      
      // Add initial game log entries if they exist
      const game = league.schedule.games[gameId];
      if (game && game.log && game.log.length > 0) {
        console.log('Adding', game.log.length, 'existing log entries');
        game.log.forEach(entry => {
          const eventDiv = document.createElement('div');
          eventDiv.style.cssText = `
            padding: 10px;
            border-bottom: 1px solid #2a2a40;
            ${entry.scored ? 'background: rgba(76, 175, 80, 0.15); border-left: 3px solid #4CAF50; margin-left: -3px; padding-left: 12px;' : ''}
          `;
          
          eventDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="color: #888; font-size: 0.85em; font-weight: bold;">Q${entry.quarter} ${entry.time}</span>
                <span style="margin-left: 12px; font-size: 1.0em; color: #e0e0e0;">${entry.text}</span>
              </div>
              ${entry.score ? `<span style="font-weight: bold; font-size: 1.05em; color: #4CAF50;">${entry.score.away} - ${entry.score.home}</span>` : ''}
            </div>
          `;
          
          feed.appendChild(eventDiv);
        });
        feed.scrollTop = feed.scrollHeight;
        
        const eventCount = document.getElementById('pbp-event-count');
        if (eventCount) eventCount.textContent = `${game.log.length} events`;
      }
    } else {
      console.error('✗ Play-by-play feed element not found!');
    }
    
    // Start auto-stepping
    const baseInterval = 1000; // 1 second
    const interval = baseInterval / liveGameSpeed;
    
    const intervalId = setInterval(() => {
      const game = league.schedule.games[gameId];
      if (!game || game.status === 'final') {
        console.log('Game finished, stopping live updates');
        clearInterval(intervalId);
        liveGameIntervals.delete(gameId);
        save();
        updateLiveGameDisplay(gameId);
        render();
        return;
      }
      
      stepLiveGame(gameId);
      save();
      updateLiveGameDisplay(gameId);
    }, interval);
    
    liveGameIntervals.set(gameId, intervalId);
    console.log('✓ Live game interval started at', interval, 'ms');
  } else {
    console.error('Failed to start live game');
  }
}

function updateLiveGameDisplay(gameId) {
  const game = league.schedule.games[gameId];
  if (!game) return;
  
  // Ensure log exists
  ensureGameLog(game);
  
  if (DEBUG_PLAYS) {
    console.log(`[PLAYS] updateLiveGameDisplay: ${gameId}, log has ${game.log.length} entries`);
  }
  
  const homeTeam = league.teams.find(t => t.id === game.homeTeamId);
  const awayTeam = league.teams.find(t => t.id === game.awayTeamId);
  
  // Update header scores (NEW gamecast structure)
  const awayScoreBig = document.getElementById('away-score-big');
  const homeScoreBig = document.getElementById('home-score-big');
  if (awayScoreBig) {
    awayScoreBig.textContent = game.score.away;
    awayScoreBig.style.color = game.score.away > game.score.home ? '#4CAF50' : '#888';
  }
  if (homeScoreBig) {
    homeScoreBig.textContent = game.score.home;
    homeScoreBig.style.color = game.score.home > game.score.away ? '#4CAF50' : '#888';
  }
  
  // Update status (quarter and time) (NEW gamecast structure)
  const statusMain = document.getElementById('game-status-main');
  if (statusMain) {
    if (game.status === 'final') {
      statusMain.innerHTML = `
        <div style="font-weight: bold; color: #4CAF50; font-size: 1.1em;">FINAL</div>
        <div style="font-size: 0.85em; color: #666; margin-top: 4px;">Day ${game.day || getCurrentDay()}</div>
      `;
    } else if (game.status === 'live') {
      statusMain.innerHTML = `
        <div style="font-weight: bold; color: #f44336; font-size: 1.1em;">Q${game.quarter} ${game.timeRemaining}</div>
        <div style="font-size: 0.85em; color: #666; margin-top: 4px;">LIVE</div>
      `;
    }
  }
  
  // Update the active tab content
  updateGamecastContent();
  
  // Auto-scroll plays if enabled and on Plays tab
  if (autoScrollPlays && activeGamecastTab === 'plays') {
    setTimeout(() => {
      const container = document.getElementById('playsScrollContainer');
      if (container) container.scrollTop = 0; // Scroll to top (latest plays)
    }, 100);
  }
}

// Play-by-Play View Update
function updatePlayByPlayView(game) {
  const feed = document.getElementById('playByPlayFeed');
  const eventCount = document.getElementById('pbp-event-count');
  
  if (feed && game.log && game.log.length > 0) {
    // Get last event that hasn't been displayed yet
    const currentEventCount = feed.children.length;
    const newEvents = game.log.slice(currentEventCount);
    
    newEvents.forEach(entry => {
      const eventDiv = document.createElement('div');
      eventDiv.style.cssText = `
        padding: 10px;
        border-bottom: 1px solid #2a2a40;
        ${entry.scored ? 'background: rgba(76, 175, 80, 0.15); border-left: 3px solid #4CAF50; margin-left: -3px; padding-left: 12px;' : ''}
      `;
      
      eventDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="color: #888; font-size: 0.85em; font-weight: bold;">Q${entry.quarter} ${entry.time}</span>
            <span style="margin-left: 12px; font-size: 1.0em; color: #e0e0e0;">${entry.text}</span>
          </div>
          ${entry.score ? `<span style="font-weight: bold; font-size: 1.05em; color: #4CAF50;">${entry.score.away} - ${entry.score.home}</span>` : ''}
        </div>
      `;
      
      feed.appendChild(eventDiv);
    });
    
    // Auto-scroll to bottom
    feed.scrollTop = feed.scrollHeight;
    
    // Update event count
    if (eventCount) {
      eventCount.textContent = `${game.log.length} events`;
    }
  }
}

// Box Score View Update
function updateBoxScoreView(game, homeTeam, awayTeam) {
  const container = document.getElementById('boxScoreContent');
  if (!container) return;
  
  // DO NOT auto-generate box score on render - only show if game has started
  const gameHasStarted = (game.log && game.log.length > 0) || game.boxScore;
  if (!gameHasStarted) {
    container.innerHTML = `
      <div style="
        padding: 60px 20px;
        text-align: center;
        color: #888;
      ">
        <div style="font-size: 3em; margin-bottom: 20px; opacity: 0.3;">📊</div>
        <div style="font-size: 1.1em; color: #aaa; margin-bottom: 10px;">Box score not available yet</div>
        <div style="font-size: 0.9em; color: #666;">Box score will be available once the game is underway.</div>
      </div>
    `;
    return;
  }
  
  // Only show box score if it exists (created by simulation)
  if (!game.boxScore) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; color: #888;">
        Box score data not available
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <div style="margin-bottom: 30px;">
      <h4 style="margin: 0 0 15px 0; color: #4CAF50; border-bottom: 2px solid #2a2a40; padding-bottom: 8px;">${awayTeam.name} - ${game.score.away}</h4>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #0f1624; color: #4CAF50;">
              <th style="text-align: left; padding: 10px; border-bottom: 2px solid #2a2a40;">Player</th>
              <th style="padding: 10px; border-bottom: 2px solid #2a2a40;">MIN</th>
              <th style="padding: 10px; border-bottom: 2px solid #2a2a40;">PTS</th>
              <th style="padding: 10px; border-bottom: 2px solid #2a2a40;">REB</th>
              <th style="padding: 10px; border-bottom: 2px solid #2a2a40;">AST</th>
            </tr>
          </thead>
          <tbody>
            ${game.boxScore.away.players.map(p => `
              <tr style="border-bottom: 1px solid #2a2a40;">
                <td style="padding: 10px; color: #e0e0e0;">${p.name}</td>
                <td style="text-align: center; padding: 10px; color: #ccc;">${p.min}</td>
                <td style="text-align: center; padding: 10px; color: #4CAF50; font-weight: bold;">${p.pts}</td>
                <td style="text-align: center; padding: 10px; color: #ccc;">${p.reb}</td>
                <td style="text-align: center; padding: 10px; color: #ccc;">${p.ast}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    
    <div>
      <h4 style="margin: 0 0 15px 0; color: #4CAF50; border-bottom: 2px solid #2a2a40; padding-bottom: 8px;">${homeTeam.name} - ${game.score.home}</h4>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #0f1624; color: #4CAF50;">
              <th style="text-align: left; padding: 10px; border-bottom: 2px solid #2a2a40;">Player</th>
              <th style="padding: 10px; border-bottom: 2px solid #2a2a40;">MIN</th>
              <th style="padding: 10px; border-bottom: 2px solid #2a2a40;">PTS</th>
              <th style="padding: 10px; border-bottom: 2px solid #2a2a40;">REB</th>
              <th style="padding: 10px; border-bottom: 2px solid #2a2a40;">AST</th>
            </tr>
          </thead>
          <tbody>
            ${game.boxScore.home.players.map(p => `
              <tr style="border-bottom: 1px solid #2a2a40;">
                <td style="padding: 10px; color: #e0e0e0;">${p.name}</td>
                <td style="text-align: center; padding: 10px; color: #ccc;">${p.min}</td>
                <td style="text-align: center; padding: 10px; color: #4CAF50; font-weight: bold;">${p.pts}</td>
                <td style="text-align: center; padding: 10px; color: #ccc;">${p.reb}</td>
                <td style="text-align: center; padding: 10px; color: #ccc;">${p.ast}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Team Comparison View Update
function updateTeamComparisonView(game, homeTeam, awayTeam) {
  const container = document.getElementById('teamCompareContent');
  if (!container) return;
  
  // Calculate team stats
  const awayPts = game.score.away;
  const homePts = game.score.home;
  
  // Simple stat simulation based on score
  const awayFG = Math.floor(40 + (awayPts / 120) * 20);
  const homeFG = Math.floor(40 + (homePts / 120) * 20);
  const away3P = Math.floor(30 + Math.random() * 15);
  const home3P = Math.floor(30 + Math.random() * 15);
  const awayReb = Math.floor(35 + Math.random() * 15);
  const homeReb = Math.floor(35 + Math.random() * 15);
  const awayAst = Math.floor(15 + Math.random() * 10);
  const homeAst = Math.floor(15 + Math.random() * 10);
  const awayTO = Math.floor(10 + Math.random() * 8);
  const homeTO = Math.floor(10 + Math.random() * 8);
  
  const stats = [
    { label: 'Points', away: awayPts, home: homePts },
    { label: 'FG%', away: awayFG + '%', home: homeFG + '%' },
    { label: '3P%', away: away3P + '%', home: home3P + '%' },
    { label: 'Rebounds', away: awayReb, home: homeReb },
    { label: 'Assists', away: awayAst, home: homeAst },
    { label: 'Turnovers', away: awayTO, home: homeTO },
  ];
  
  container.innerHTML = `
    <div style="background: #0f1624; border-radius: 8px; padding: 20px;">
      <h4 style="margin: 0 0 20px 0; text-align: center; color: #4CAF50; font-size: 1.2em;">Team Statistics</h4>
      
      <div style="display: grid; gap: 15px;">
        ${stats.map(stat => `
          <div style="background: #16213e; border-radius: 6px; padding: 15px;">
            <div style="text-align: center; color: #888; font-size: 0.85em; margin-bottom: 8px; font-weight: bold;">${stat.label}</div>
            <div style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 15px;">
              <div style="text-align: right; font-size: 1.3em; font-weight: bold; color: #4CAF50;">${stat.away}</div>
              <div style="color: #666;">vs</div>
              <div style="text-align: left; font-size: 1.3em; font-weight: bold; color: #2196F3;">${stat.home}</div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; margin-top: 8px; font-size: 0.85em; color: #888;">
              <div style="text-align: right;">${awayTeam.name}</div>
              <div style="text-align: left;">${homeTeam.name}</div>
            </div>
          </div>
        `).join('')}
      </div>
      
      <div style="margin-top: 25px; padding: 15px; background: #1a1a2e; border-radius: 6px; text-align: center;">
        <div style="color: #888; font-size: 0.85em; margin-bottom: 8px;">Current Status</div>
        <div style="font-size: 1.1em; color: #4CAF50; font-weight: bold;">Q${game.quarter} ${game.timeRemaining}</div>
      </div>
    </div>
  `;
}

function pauseLiveGameUI(gameId) {
  if (liveGameIntervals.has(gameId)) {
    clearInterval(liveGameIntervals.get(gameId));
    liveGameIntervals.delete(gameId);
    console.log('Game paused');
    
    // Update controls to show Resume button
    const game = league.schedule.games[gameId];
    if (game) {
      const controlsContainer = document.querySelector('#gamecast-content').parentElement.querySelector('[style*="border-top: 2px solid #2a2a40"]');
      if (controlsContainer) {
        const homeTeam = league.teams.find(t => t.id === game.homeTeamId);
        const awayTeam = league.teams.find(t => t.id === game.awayTeamId);
        controlsContainer.outerHTML = renderGamecastControls(game);
      }
    }
  }
}

function resumeLiveGameUI(gameId) {
  if (liveGameIntervals.has(gameId)) return; // Already running
  
  console.log('Resuming game at speed', liveGameSpeed);
  
  const baseInterval = 1000;
  const interval = baseInterval / liveGameSpeed;
  
  const intervalId = setInterval(() => {
    const game = league.schedule.games[gameId];
    if (!game || game.status === 'final') {
      console.log('Game finished during resume');
      clearInterval(intervalId);
      liveGameIntervals.delete(gameId);
      save();
      updateLiveGameDisplay(gameId);
      render();
      return;
    }
    
    stepLiveGame(gameId);
    save();
    updateLiveGameDisplay(gameId);
  }, interval);
  
  liveGameIntervals.set(gameId, intervalId);
  
  // Update controls to show Pause button
  const game = league.schedule.games[gameId];
  if (game) {
    const controlsContainer = document.querySelector('#gamecast-content').parentElement.querySelector('[style*="border-top: 2px solid #2a2a40"]');
    if (controlsContainer) {
      controlsContainer.outerHTML = renderGamecastControls(game);
    }
  }
}

function setLiveGameSpeed(speed) {
  const gameId = activeGameDrawer;
  const wasRunning = liveGameIntervals.has(gameId);
  
  // Update speed
  liveGameSpeed = speed;
  
  // Restart interval if it was running
  if (wasRunning) {
    pauseLiveGameUI(gameId);
    resumeLiveGameUI(gameId);
  } else {
    renderGameDrawer();
  }
}

function simToEndUI(gameId) {
  // Pause live updates
  if (liveGameIntervals.has(gameId)) {
    clearInterval(liveGameIntervals.get(gameId));
    liveGameIntervals.delete(gameId);
  }
  
  // Finish the game
  finishLiveGame(gameId);
  save();
  renderGameDrawer();
  render();
}

function renderHistory() {
  const el = document.getElementById('history-tab');
  
  if (league.history.length === 0) {
    el.innerHTML = `
      <h2>League History</h2>
      <p>No history yet. Complete a season to see records.</p>
    `;
    return;
  }
  
  const rows = [...league.history].reverse().map(h => {
    const leader = h.scoringLeader ? `${h.scoringLeader.name} (${h.scoringLeader.ppg} PPG)` : 'N/A';
    return `
      <tr>
        <td>${h.season}</td>
        <td>${h.champion}</td>
        <td>${h.championRecord}</td>
        <td>${leader}</td>
      </tr>
    `;
  }).join('');
  
  el.innerHTML = `
    <h2>League History</h2>
    <table>
      <tr>
        <th>Season</th>
        <th>Champion</th>
        <th>Record</th>
        <th>Scoring Leader</th>
      </tr>
      ${rows}
    </table>
  `;
}

/* ============================
   FINANCES TAB
============================ */

function getTeamFinances(team) {
  // Calculate total salary from active roster
  const totalSalary = team.players.reduce((sum, p) => sum + (p.contract?.amount || 0), 0);
  
  // Cap calculations
  const capSpace = SALARY_CAP - totalSalary;
  const overCap = totalSalary > SALARY_CAP;
  const overLuxuryTax = totalSalary > LUXURY_TAX_LINE;
  const overHardCap = totalSalary > HARD_CAP_APRON;
  
  // Luxury tax calculation (progressive rates)
  let luxuryTaxBill = 0;
  if (totalSalary > LUXURY_TAX_LINE) {
    const overage = totalSalary - LUXURY_TAX_LINE;
    // Simplified: $1.50 per dollar over luxury tax
    luxuryTaxBill = overage * 1.5;
  }
  
  // Available exceptions
  const exceptions = {
    mle: {
      name: 'Mid-Level Exception',
      amount: MLE_AMOUNT,
      available: !overLuxuryTax
    },
    bae: {
      name: 'Bi-Annual Exception',
      amount: BAE_AMOUNT,
      available: !overLuxuryTax
    },
    tmle: {
      name: 'Taxpayer MLE',
      amount: TMLE_AMOUNT,
      available: overLuxuryTax && !overHardCap
    }
  };
  
  // Player salaries sorted by amount
  const playerSalaries = team.players
    .map(p => ({
      id: p.id,
      name: p.name,
      pos: p.pos,
      salary: p.contract?.amount || 0,
      yearsRemaining: p.contract?.exp ? Math.max(0, p.contract.exp - league.season) : 0
    }))
    .sort((a, b) => b.salary - a.salary);
  
  // Payroll projections (next 3 years)
  const projections = [];
  for (let i = 1; i <= 3; i++) {
    const season = league.season + i;
    const projectedPayroll = team.players
      .filter(p => p.contract?.exp && p.contract.exp >= season)
      .reduce((sum, p) => sum + (p.contract.amount || 0), 0);
    
    // Cap projected to grow 3% annually
    const projectedCap = SALARY_CAP * Math.pow(1.03, i);
    const projectedCapSpace = projectedCap - projectedPayroll;
    
    projections.push({
      season: `${season}-${String(season + 1).slice(-2)}`,
      payroll: projectedPayroll,
      cap: projectedCap,
      space: projectedCapSpace
    });
  }
  
  // Dead money (waived players still on books)
  const deadMoney = team.deadMoney || [];
  
  return {
    totalSalary,
    capSpace,
    luxuryTaxBill,
    overCap,
    overLuxuryTax,
    overHardCap,
    exceptions,
    playerSalaries,
    projections,
    deadMoney
  };
}

function formatMoneyM(amount) {
  return `$${amount.toFixed(1)}M`;
}

function renderFinances() {
  const el = document.getElementById('finances-tab');
  const team = league.teams.find(t => t.id === selectedTeamId);
  
  if (!team) {
    el.innerHTML = '<p>Team not found</p>';
    return;
  }
  
  const finances = getTeamFinances(team);
  
  el.innerHTML = `
    <div class="finances-container">
      <!-- Header -->
      <div class="finances-header">
        <h1 class="finances-title">Team Finances</h1>
        <div class="finances-subtitle">${team.city} ${team.name}</div>
      </div>
      
      <!-- Salary Cap Overview -->
      <div class="finances-card">
        <div class="finances-card-title">💰 Salary Cap Overview</div>
        
        <div class="finances-cap-grid">
          <div class="finances-stat-row">
            <span class="finances-stat-label">Total Salary</span>
            <span class="finances-stat-value ${finances.overCap ? 'negative' : ''}">${formatMoneyM(finances.totalSalary)}</span>
          </div>
          
          <div class="finances-stat-row">
            <span class="finances-stat-label">Cap Space</span>
            <span class="finances-stat-value ${finances.overCap ? 'negative' : 'positive'}">${formatMoneyM(finances.capSpace)}</span>
          </div>
          
          <div class="finances-stat-row">
            <span class="finances-stat-label">Salary Cap</span>
            <span class="finances-stat-value">${formatMoneyM(SALARY_CAP)}</span>
          </div>
          
          <div class="finances-stat-row">
            <span class="finances-stat-label">Luxury Tax Line</span>
            <span class="finances-stat-value">${formatMoneyM(LUXURY_TAX_LINE)}</span>
          </div>
          
          <div class="finances-stat-row">
            <span class="finances-stat-label">Hard Cap (Apron)</span>
            <span class="finances-stat-value">${formatMoneyM(HARD_CAP_APRON)}</span>
          </div>
          
          <div class="finances-stat-row">
            <span class="finances-stat-label">Luxury Tax Bill</span>
            <span class="finances-stat-value ${finances.luxuryTaxBill > 0 ? 'negative' : ''}">${formatMoneyM(finances.luxuryTaxBill)}</span>
          </div>
        </div>
        
        <!-- Progress Bar -->
        <div class="finances-cap-bar-container">
          <div class="finances-cap-bar">
            <div class="finances-cap-fill ${finances.overCap ? 'over' : 'under'}" 
                 style="width: ${Math.min(100, (finances.totalSalary / SALARY_CAP) * 100)}%;"></div>
          </div>
          <div class="finances-cap-markers">
            <span class="finances-cap-marker" style="left: ${(LUXURY_TAX_LINE / HARD_CAP_APRON) * 100}%;">Tax</span>
            <span class="finances-cap-marker" style="left: 100%;">Apron</span>
          </div>
        </div>
        
        <!-- Warnings -->
        ${finances.overLuxuryTax ? '<div class="finances-warning warning">⚠️ Over Luxury Tax Line</div>' : ''}
        ${finances.overHardCap ? '<div class="finances-warning error">🚫 Over Hard Cap!</div>' : ''}
      </div>
      
      <!-- Available Exceptions -->
      <div class="finances-card">
        <div class="finances-card-title">🎟️ Available Exceptions</div>
        <div class="finances-exceptions-grid">
          ${Object.values(finances.exceptions).map(exc => `
            <div class="finances-exception ${exc.available ? '' : 'unavailable'}">
              <div class="finances-exception-name">${exc.name}</div>
              <div class="finances-exception-value">${formatMoneyM(exc.amount)}</div>
              <div class="finances-exception-status">${exc.available ? 'Available' : 'Not Available'}</div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- Player Salaries -->
      <div class="finances-card">
        <div class="finances-card-title">👥 Player Salaries (${finances.playerSalaries.length})</div>
        <div class="finances-players-table">
          <div class="finances-table-header">
            <div class="finances-table-cell name">Player</div>
            <div class="finances-table-cell pos">Pos</div>
            <div class="finances-table-cell salary">Salary</div>
            <div class="finances-table-cell years">Years Left</div>
          </div>
          ${finances.playerSalaries.map(p => `
            <div class="finances-table-row">
              <div class="finances-table-cell name clickable-player" onclick="showPlayerModal(${p.id})">${p.name}</div>
              <div class="finances-table-cell pos">${p.pos}</div>
              <div class="finances-table-cell salary">${formatMoneyM(p.salary)}</div>
              <div class="finances-table-cell years">${p.yearsRemaining}</div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- Payroll Projections -->
      <div class="finances-card">
        <div class="finances-card-title">📊 Payroll Projections</div>
        <div class="finances-projections-table">
          <div class="finances-table-header">
            <div class="finances-table-cell season">Season</div>
            <div class="finances-table-cell amount">Projected Payroll</div>
            <div class="finances-table-cell amount">Projected Cap</div>
            <div class="finances-table-cell amount">Projected Space</div>
          </div>
          ${finances.projections.map(proj => `
            <div class="finances-table-row">
              <div class="finances-table-cell season">${proj.season}</div>
              <div class="finances-table-cell amount">${formatMoneyM(proj.payroll)}</div>
              <div class="finances-table-cell amount">${formatMoneyM(proj.cap)}</div>
              <div class="finances-table-cell amount ${proj.space < 0 ? 'negative' : 'positive'}">${formatMoneyM(proj.space)}</div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- Dead Money -->
      <div class="finances-card">
        <div class="finances-card-title">☠️ Dead Money</div>
        ${finances.deadMoney.length === 0 
          ? '<div class="finances-empty">No dead money contracts</div>'
          : `<div class="finances-dead-list">
               ${finances.deadMoney.map(d => `
                 <div class="finances-dead-item">
                   <span class="finances-dead-name">${d.playerName}</span>
                   <span class="finances-dead-amount">${formatMoneyM(d.amount)}</span>
                 </div>
               `).join('')}
             </div>`
        }
      </div>
      
      <!-- Quick Actions -->
      <div class="finances-card">
        <div class="finances-card-title">⚡ Quick Actions</div>
        <div class="finances-actions">
          <button class="finances-action-btn" onclick="alert('Trade Calculator coming soon!')">
            🔄 Trade Calculator
          </button>
          <button class="finances-action-btn" onclick="switchTab('freeagents')">
            💼 Free Agents
          </button>
          <button class="finances-action-btn disabled" disabled>
            📝 Contract Extensions
            <span class="finances-coming-soon">Coming Soon</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

/* ============================
   FREE AGENCY NEGOTIATION
============================ */

let negotiationState = {
  playerId: null,
  currentOffer: null,
  agentResponse: null
};

function openNegotiationModal(playerId) {
  // Check if free agent signing is allowed
  if (typeof isActionAllowed === 'function' && !isActionAllowed(ACTIONS.SIGN_FA)) {
    const reason = typeof getActionLockReason === 'function' ? 
                   getActionLockReason(ACTIONS.SIGN_FA) : 
                   'Free agent signings are not allowed at this time.';
    alert('❌ Signing Not Allowed\n\n' + reason);
    return;
  }
  
  const player = league.freeAgents.find(p => p.id === playerId);
  if (!player) return;
  
  const team = league.teams.find(t => t.id === selectedTeamId);
  if (!team) return;
  
  negotiationState.playerId = playerId;
  negotiationState.currentOffer = {
    years: 2,
    salary: player.marketValue.expected,
    hasPlayerOption: false,
    hasTeamOption: false
  };
  negotiationState.agentResponse = null;
  
  const priorities = getPlayerPriorities(player);
  const currentPayroll = team.players.reduce((sum, p) => sum + (p.contract?.amount || 0), 0);
  const capSpace = SALARY_CAP - currentPayroll;
  
  const modalContent = `
    <div class="negotiation-modal">
      <div class="negotiation-header">
        <h2 class="negotiation-title">Contract Negotiation</h2>
        <button class="negotiation-close" onclick="closeNegotiationModal()">×</button>
      </div>
      
      <div class="negotiation-body">
        <!-- Player Info -->
        <div class="negotiation-section">
          <div class="negotiation-player-card">
            <div class="negotiation-player-name clickable-player" onclick="showPlayerModal(${player.id})">${player.name}</div>
            <div class="negotiation-player-meta">${player.pos} • ${player.age} years old • ${player.ratings.ovr} OVR</div>
          </div>
          
          <div class="negotiation-agent-card">
            <div class="negotiation-agent-label">Agent</div>
            <div class="negotiation-agent-name">${player.agent.name}</div>
            <div class="negotiation-agent-style">${player.agent.style} negotiator</div>
          </div>
        </div>
        
        <!-- Player Priorities -->
        <div class="negotiation-section">
          <div class="negotiation-section-title">Player Priorities</div>
          <div class="negotiation-priorities">
            ${priorities.map((pr, idx) => `
              <div class="negotiation-priority">
                <span class="negotiation-priority-rank">${idx + 1}.</span>
                <span class="negotiation-priority-label">${pr.label}</span>
                <div class="negotiation-priority-bar">
                  <div class="negotiation-priority-fill" style="width: ${pr.value}%;"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <!-- Contract Offer Builder -->
        <div class="negotiation-section">
          <div class="negotiation-section-title">Your Offer</div>
          
          <div class="negotiation-offer-grid">
            <div class="negotiation-offer-field">
              <label class="negotiation-label">Contract Years</label>
              <input type="number" id="offerYears" min="1" max="5" value="${negotiationState.currentOffer.years}" 
                     class="negotiation-input" onchange="updateNegotiationOffer()">
            </div>
            
            <div class="negotiation-offer-field">
              <label class="negotiation-label">Annual Salary (millions)</label>
              <input type="number" id="offerSalary" min="1" max="50" step="0.1" value="${negotiationState.currentOffer.salary.toFixed(1)}" 
                     class="negotiation-input" onchange="updateNegotiationOffer()">
            </div>
          </div>
          
          <div class="negotiation-options">
            <label class="negotiation-checkbox">
              <input type="checkbox" id="offerPlayerOption" ${negotiationState.currentOffer.hasPlayerOption ? 'checked' : ''} 
                     onchange="updateNegotiationOffer()">
              <span>Player Option (final year)</span>
            </label>
            
            <label class="negotiation-checkbox">
              <input type="checkbox" id="offerTeamOption" ${negotiationState.currentOffer.hasTeamOption ? 'checked' : ''} 
                     onchange="updateNegotiationOffer()">
              <span>Team Option (final year)</span>
            </label>
          </div>
          
          <div class="negotiation-summary">
            <div class="negotiation-summary-row">
              <span>Total Contract Value:</span>
              <span class="negotiation-summary-value" id="totalValue">$${(negotiationState.currentOffer.years * negotiationState.currentOffer.salary).toFixed(1)}M</span>
            </div>
            <div class="negotiation-summary-row">
              <span>Cap Space Remaining:</span>
              <span class="negotiation-summary-value ${capSpace - negotiationState.currentOffer.salary < 0 ? 'negative' : ''}" id="capRemaining">
                $${(capSpace - negotiationState.currentOffer.salary).toFixed(1)}M
              </span>
            </div>
          </div>
          
          ${capSpace - negotiationState.currentOffer.salary < 0 ? 
            '<div class="negotiation-warning">⚠️ This contract would put you over the salary cap!</div>' : ''}
        </div>
        
        <!-- Agent Response -->
        <div class="negotiation-section" id="agentResponseSection" style="${negotiationState.agentResponse ? '' : 'display: none;'}">
          <div class="negotiation-section-title">Agent Response</div>
          <div class="negotiation-response" id="agentResponseText"></div>
          
          <div id="counterofferSection" style="display: none;">
            <div class="negotiation-counteroffer-title">Counteroffer</div>
            <div class="negotiation-counteroffer-details" id="counterofferDetails"></div>
          </div>
        </div>
      </div>
      
      <div class="negotiation-footer">
        <button class="negotiation-btn secondary" onclick="closeNegotiationModal()">Cancel</button>
        <button class="negotiation-btn primary" onclick="submitOffer()">Submit Offer</button>
      </div>
    </div>
  `;
  
  document.getElementById('modalContent').innerHTML = modalContent;
  document.getElementById('playerModal').style.display = 'flex';
}

function closeNegotiationModal() {
  negotiationState = { playerId: null, currentOffer: null, agentResponse: null };
  document.getElementById('playerModal').style.display = 'none';
}

function updateNegotiationOffer() {
  const years = parseInt(document.getElementById('offerYears').value);
  const salary = parseFloat(document.getElementById('offerSalary').value);
  const hasPlayerOption = document.getElementById('offerPlayerOption').checked;
  const hasTeamOption = document.getElementById('offerTeamOption').checked;
  
  negotiationState.currentOffer = { years, salary, hasPlayerOption, hasTeamOption };
  
  // Update summary displays
  document.getElementById('totalValue').textContent = `$${(years * salary).toFixed(1)}M`;
  
  const team = league.teams.find(t => t.id === selectedTeamId);
  const currentPayroll = team.players.reduce((sum, p) => sum + (p.contract?.amount || 0), 0);
  const capSpace = SALARY_CAP - currentPayroll;
  const remaining = capSpace - salary;
  
  const capRemainingEl = document.getElementById('capRemaining');
  capRemainingEl.textContent = `$${remaining.toFixed(1)}M`;
  capRemainingEl.className = `negotiation-summary-value ${remaining < 0 ? 'negative' : ''}`;
}

function submitOffer() {
  const player = league.freeAgents.find(p => p.id === negotiationState.playerId);
  const team = league.teams.find(t => t.id === selectedTeamId);
  
  if (!player || !team) return;
  
  const result = evaluateContractOffer(player, negotiationState.currentOffer, team);
  
  negotiationState.agentResponse = result;
  
  // Display response
  document.getElementById('agentResponseSection').style.display = 'block';
  document.getElementById('agentResponseText').innerHTML = `
    <div class="negotiation-response-text ${result.accepted ? 'accepted' : 'rejected'}">
      ${result.response}
    </div>
  `;
  
  if (result.accepted) {
    // Sign the player
    setTimeout(() => {
      signPlayerToContract(player, team, negotiationState.currentOffer);
      closeNegotiationModal();
      render();
    }, 2000);
  } else if (result.counteroffer) {
    // Show counteroffer
    document.getElementById('counterofferSection').style.display = 'block';
    document.getElementById('counterofferDetails').innerHTML = `
      <div class="negotiation-counteroffer-grid">
        <div class="negotiation-counteroffer-item">
          <span>Years:</span>
          <span>${result.counteroffer.years}</span>
        </div>
        <div class="negotiation-counteroffer-item">
          <span>Annual Salary:</span>
          <span>$${result.counteroffer.salary.toFixed(1)}M</span>
        </div>
        <div class="negotiation-counteroffer-item">
          <span>Player Option:</span>
          <span>${result.counteroffer.hasPlayerOption ? 'Yes' : 'No'}</span>
        </div>
        <div class="negotiation-counteroffer-item">
          <span>Team Option:</span>
          <span>${result.counteroffer.hasTeamOption ? 'Yes' : 'No'}</span>
        </div>
      </div>
      <button class="negotiation-btn accept-counter" onclick="acceptCounteroffer()">Accept Counteroffer</button>
    `;
  }
}

function acceptCounteroffer() {
  const player = league.freeAgents.find(p => p.id === negotiationState.playerId);
  const team = league.teams.find(t => t.id === selectedTeamId);
  
  if (!player || !team || !negotiationState.agentResponse.counteroffer) return;
  
  signPlayerToContract(player, team, negotiationState.agentResponse.counteroffer);
  closeNegotiationModal();
  render();
}

function signPlayerToContract(player, team, contractTerms) {
  // Check if free agent signing is allowed
  const result = signFreeAgent(player.id, team.id, contractTerms);
  
  if (!result.success) {
    alert('❌ Signing Failed\n\n' + result.error);
    return;
  }
  
  alert(`${player.name} has signed with ${team.city} ${team.name}!`);
}

/* ============================
   TRADES TAB
============================ */

let tradeState = {
  teamAId: null,
  teamBId: null,
  teamAAssets: { players: [], picks: [] },
  teamBAssets: { players: [], picks: [] },
  searchA: '',
  searchB: ''
};

function renderTrades() {
  const el = document.getElementById('trades-tab');
  
  // Check if trades are allowed
  const tradesAllowed = typeof isActionAllowed === 'function' ? isActionAllowed(ACTIONS.TRADE) : true;
  const lockReason = !tradesAllowed && typeof getActionLockReason === 'function' ? 
                     getActionLockReason(ACTIONS.TRADE) : null;
  
  // Initialize draft picks if missing
  if (!league.draftPicks) {
    league.draftPicks = initializeDraftPicks(league.teams, league.season);
    saveLeague(league);
  }
  
  // Initialize trade state
  if (!tradeState.teamAId) {
    tradeState.teamAId = selectedTeamId;
    tradeState.teamBId = league.teams.find(t => t.id !== selectedTeamId)?.id || league.teams[1].id;
  }
  
  const teamA = league.teams.find(t => t.id === tradeState.teamAId);
  const teamB = league.teams.find(t => t.id === tradeState.teamBId);
  
  if (!teamA || !teamB) {
    el.innerHTML = '<div class="trades-container"><p>Error loading teams</p></div>';
    return;
  }
  
  // Calculate trade evaluation
  const evaluation = tradeState.teamAAssets.players.length > 0 || tradeState.teamBAssets.players.length > 0 || 
                     tradeState.teamAAssets.picks.length > 0 || tradeState.teamBAssets.picks.length > 0
    ? evaluateTrade(tradeState.teamAId, tradeState.teamBId, tradeState.teamAAssets, tradeState.teamBAssets)
    : null;
  
  el.innerHTML = `
    <div class="trades-container">
      <h2 class="trades-title">Trade Machine</h2>
      
      <!-- Team Selection -->
      <div class="trades-team-select">
        <div class="trades-select-group">
          <label>Team A:</label>
          <select id="teamASelect" class="trades-select" onchange="switchTradeTeam('A', this.value)">
            ${league.teams.map(t => `<option value="${t.id}" ${t.id === tradeState.teamAId ? 'selected' : ''}>${t.name}</option>`).join('')}
          </select>
        </div>
        
        <button class="trades-swap-btn" onclick="swapTradeTeams()">⇄</button>
        
        <div class="trades-select-group">
          <label>Team B:</label>
          <select id="teamBSelect" class="trades-select" onchange="switchTradeTeam('B', this.value)">
            ${league.teams.map(t => `<option value="${t.id}" ${t.id === tradeState.teamBId ? 'selected' : ''}>${t.name}</option>`).join('')}
          </select>
        </div>
      </div>
      
      <!-- Trade Builder Panels -->
      <div class="trades-builder">
        <!-- Team A Panel -->
        <div class="trades-panel">
          <div class="trades-panel-header">
            <h3>${teamA.name} Sends</h3>
          </div>
          
          <!-- Team A Trade Assets -->
          <div class="trades-assets">
            ${renderTradeAssets('A', teamA, tradeState.teamAAssets)}
          </div>
          
          <!-- Team A Roster -->
          <div class="trades-roster-section">
            <div class="trades-section-title">Available Players</div>
            <input type="text" class="trades-search" placeholder="Search players..." 
                   value="${tradeState.searchA}" oninput="updateTradeSearch('A', this.value)">
            <div class="trades-roster-list">
              ${renderTradeRoster(teamA, tradeState.teamAAssets.players, tradeState.searchA)}
            </div>
          </div>
          
          <!-- Team A Picks -->
          <div class="trades-picks-section">
            <div class="trades-section-title">Available Draft Picks</div>
            ${renderTradePicks(tradeState.teamAId, tradeState.teamAAssets.picks)}
          </div>
        </div>
        
        <!-- Team B Panel -->
        <div class="trades-panel">
          <div class="trades-panel-header">
            <h3>${teamB.name} Sends</h3>
          </div>
          
          <!-- Team B Trade Assets -->
          <div class="trades-assets">
            ${renderTradeAssets('B', teamB, tradeState.teamBAssets)}
          </div>
          
          <!-- Team B Roster -->
          <div class="trades-roster-section">
            <div class="trades-section-title">Available Players</div>
            <input type="text" class="trades-search" placeholder="Search players..." 
                   value="${tradeState.searchB}" oninput="updateTradeSearch('B', this.value)">
            <div class="trades-roster-list">
              ${renderTradeRoster(teamB, tradeState.teamBAssets.players, tradeState.searchB)}
            </div>
          </div>
          
          <!-- Team B Picks -->
          <div class="trades-picks-section">
            <div class="trades-section-title">Available Draft Picks</div>
            ${renderTradePicks(tradeState.teamBId, tradeState.teamBAssets.picks)}
          </div>
        </div>
      </div>
      
      <!-- Trade Summary -->
      ${evaluation ? `
        <div class="trades-summary ${evaluation.isLegal ? '' : 'illegal'}">
          <div class="trades-summary-section">
            <div class="trades-summary-title">${teamA.name}</div>
            <div class="trades-summary-row">
              <span>Outgoing Salary:</span>
              <span>$${evaluation.teamASalaryOut.toFixed(1)}M</span>
            </div>
            <div class="trades-summary-row">
              <span>Incoming Salary:</span>
              <span>$${evaluation.teamASalaryIn.toFixed(1)}M</span>
            </div>
            <div class="trades-summary-row">
              <span>New Payroll:</span>
              <span class="${evaluation.teamANewPayroll > SALARY_CAP ? 'warning' : ''}">${evaluation.teamANewPayroll.toFixed(1)}M</span>
            </div>
          </div>
          
          <div class="trades-summary-section">
            <div class="trades-summary-title">Trade Balance</div>
            <div class="trades-fairness ${evaluation.fairness.includes('Even') ? 'even' : 'uneven'}">
              ${evaluation.fairness}
            </div>
            <div class="trades-legality ${evaluation.isLegal ? 'legal' : 'illegal'}">
              ${evaluation.isLegal ? '✓ Legal' : '✗ Violates Salary Cap'}
            </div>
          </div>
          
          <div class="trades-summary-section">
            <div class="trades-summary-title">${teamB.name}</div>
            <div class="trades-summary-row">
              <span>Outgoing Salary:</span>
              <span>$${evaluation.teamBSalaryOut.toFixed(1)}M</span>
            </div>
            <div class="trades-summary-row">
              <span>Incoming Salary:</span>
              <span>$${evaluation.teamBSalaryIn.toFixed(1)}M</span>
            </div>
            <div class="trades-summary-row">
              <span>New Payroll:</span>
              <span class="${evaluation.teamBNewPayroll > SALARY_CAP ? 'warning' : ''}">${evaluation.teamBNewPayroll.toFixed(1)}M</span>
            </div>
          </div>
        </div>
        
        <div class="trades-actions">
          <button class="trades-btn clear" onclick="clearTrade()">Clear Trade</button>
          <button class="trades-btn propose" 
                  ${!evaluation.isLegal || !tradesAllowed ? 'disabled' : ''} 
                  ${lockReason ? `title="${lockReason}"` : ''}
                  onclick="proposeTrade()">Propose Trade</button>
        </div>
      ` : '<div class="trades-empty">Add players or picks to build a trade</div>'}
    </div>
  `;
}

function renderTradeAssets(team, teamObj, assets) {
  if (assets.players.length === 0 && assets.picks.length === 0) {
    return '<div class="trades-assets-empty">No assets added</div>';
  }
  
  let html = '';
  
  // Render players
  assets.players.forEach(pId => {
    const player = teamObj.players.find(p => p.id === pId);
    if (player) {
      html += `
        <div class="trades-asset-card">
          <div class="trades-asset-info">
            <div class="trades-asset-name clickable-player" onclick="showPlayerModal(${player.id})">${player.name}</div>
            <div class="trades-asset-meta">${player.pos} • ${player.ratings.ovr} OVR • $${player.contract.amount.toFixed(1)}M</div>
          </div>
          <button class="trades-asset-remove" onclick="removeFromTrade('${team}', 'player', ${pId})">×</button>
        </div>
      `;
    }
  });
  
  // Render picks
  assets.picks.forEach(pickId => {
    const pick = league.draftPicks.find(p => p.id === pickId);
    if (pick) {
      html += `
        <div class="trades-asset-card">
          <div class="trades-asset-info">
            <div class="trades-asset-name">${pick.season} Round ${pick.round}</div>
            <div class="trades-asset-meta">Draft Pick</div>
          </div>
          <button class="trades-asset-remove" onclick="removeFromTrade('${team}', 'pick', '${pickId}')">×</button>
        </div>
      `;
    }
  });
  
  return html;
}

function renderTradeRoster(team, excludedPlayers, search) {
  let players = team.players.filter(p => !excludedPlayers.includes(p.id));
  
  if (search) {
    const searchLower = search.toLowerCase();
    players = players.filter(p => 
      p.name.toLowerCase().includes(searchLower) ||
      p.pos.toLowerCase().includes(searchLower)
    );
  }
  
  return players.sort((a, b) => b.ratings.ovr - a.ratings.ovr).map(p => `
    <div class="trades-roster-row">
      <div class="trades-player-info">
        <div class="trades-player-name clickable-player" onclick="showPlayerModal(${p.id})">${p.name}</div>
        <div class="trades-player-meta">${p.pos} • Age ${p.age} • ${p.ratings.ovr} OVR</div>
      </div>
      <div class="trades-player-salary">$${p.contract.amount.toFixed(1)}M</div>
      <button class="trades-add-btn" onclick="addToTrade('${team.id}', 'player', ${p.id})">+</button>
    </div>
  `).join('');
}

function renderTradePicks(teamId, excludedPicks) {
  const picks = league.draftPicks.filter(p => p.currentOwner === teamId && !excludedPicks.includes(p.id));
  
  if (picks.length === 0) {
    return '<div class="trades-picks-empty">No available draft picks</div>';
  }
  
  return picks.map(p => `
    <div class="trades-pick-row">
      <div class="trades-pick-info">${p.season} Round ${p.round}</div>
      <button class="trades-add-btn" onclick="addToTrade(${teamId}, 'pick', '${p.id}')">+</button>
    </div>
  `).join('');
}

function switchTradeTeam(side, teamId) {
  teamId = parseInt(teamId);
  if (side === 'A') {
    tradeState.teamAId = teamId;
    tradeState.teamAAssets = { players: [], picks: [] };
  } else {
    tradeState.teamBId = teamId;
    tradeState.teamBAssets = { players: [], picks: [] };
  }
  render();
}

function swapTradeTeams() {
  const tempId = tradeState.teamAId;
  const tempAssets = tradeState.teamAAssets;
  
  tradeState.teamAId = tradeState.teamBId;
  tradeState.teamAAssets = tradeState.teamBAssets;
  
  tradeState.teamBId = tempId;
  tradeState.teamBAssets = tempAssets;
  
  render();
}

function updateTradeSearch(team, value) {
  if (team === 'A') tradeState.searchA = value;
  else tradeState.searchB = value;
  render();
}

function addToTrade(teamId, type, id) {
  const isTeamA = teamId === tradeState.teamAId;
  const assets = isTeamA ? tradeState.teamAAssets : tradeState.teamBAssets;
  
  if (type === 'player') {
    if (!assets.players.includes(id)) {
      assets.players.push(id);
    }
  } else if (type === 'pick') {
    if (!assets.picks.includes(id)) {
      assets.picks.push(id);
    }
  }
  
  render();
}

function removeFromTrade(team, type, id) {
  const assets = team === 'A' ? tradeState.teamAAssets : tradeState.teamBAssets;
  
  if (type === 'player') {
    const index = assets.players.indexOf(id);
    if (index !== -1) assets.players.splice(index, 1);
  } else if (type === 'pick') {
    const index = assets.picks.indexOf(id);
    if (index !== -1) assets.picks.splice(index, 1);
  }
  
  render();
}

function clearTrade() {
  tradeState.teamAAssets = { players: [], picks: [] };
  tradeState.teamBAssets = { players: [], picks: [] };
  render();
}

function proposeTrade() {
  // Check if trades are allowed
  if (typeof isActionAllowed === 'function' && !isActionAllowed(ACTIONS.TRADE)) {
    const reason = typeof getActionLockReason === 'function' ? 
                   getActionLockReason(ACTIONS.TRADE) : 
                   'Trades are not allowed at this time.';
    alert('❌ Trade Not Allowed\n\n' + reason);
    return;
  }
  
  const evaluation = evaluateTrade(tradeState.teamAId, tradeState.teamBId, tradeState.teamAAssets, tradeState.teamBAssets);
  evaluation.teamAId = tradeState.teamAId;
  evaluation.teamBId = tradeState.teamBId;
  
  if (!evaluation.isLegal) {
    alert('This trade violates salary cap rules and cannot be proposed.');
    return;
  }
  
  // If user team is Team A, AI evaluates for Team B
  const aiTeamId = tradeState.teamAId === selectedTeamId ? tradeState.teamBId : tradeState.teamAId;
  const aiResponse = aiEvaluateTrade(aiTeamId, evaluation);
  
  showTradeResponseModal(aiResponse, evaluation);
}

function showTradeResponseModal(aiResponse, evaluation) {
  const aiTeam = league.teams.find(t => t.id === (tradeState.teamAId === selectedTeamId ? tradeState.teamBId : tradeState.teamAId));
  
  const modalContent = `
    <div class="trade-response-modal">
      <div class="trade-response-header">
        <h2>Trade Response</h2>
        <button class="trade-response-close" onclick="closeTradeResponseModal()">×</button>
      </div>
      
      <div class="trade-response-body">
        <div class="trade-response-team">${aiTeam.name}</div>
        <div class="trade-response-text ${aiResponse.accepted ? 'accepted' : 'rejected'}">
          ${aiResponse.response}
        </div>
        
        ${aiResponse.counteroffer ? `
          <div class="trade-response-counter">
            <div class="trade-counter-title">Counteroffer</div>
            <div class="trade-counter-text">${aiResponse.counteroffer.requested}</div>
          </div>
        ` : ''}
      </div>
      
      <div class="trade-response-footer">
        ${aiResponse.accepted ? `
          <button class="trade-btn-modal cancel" onclick="closeTradeResponseModal()">Cancel</button>
          <button class="trade-btn-modal accept" onclick="acceptTrade()">Complete Trade</button>
        ` : `
          <button class="trade-btn-modal" onclick="closeTradeResponseModal()">Close</button>
        `}
      </div>
    </div>
  `;
  
  document.getElementById('modalContent').innerHTML = modalContent;
  document.getElementById('playerModal').style.display = 'flex';
}

function closeTradeResponseModal() {
  document.getElementById('playerModal').style.display = 'none';
}

function acceptTrade() {
  const result = executeTrade(tradeState.teamAId, tradeState.teamBId, tradeState.teamAAssets, tradeState.teamBAssets);
  
  if (!result.success) {
    alert('❌ Trade Failed\n\n' + result.error);
    closeTradeResponseModal();
    return;
  }
  
  closeTradeResponseModal();
  clearTrade();
  alert('Trade completed successfully!');
  render();
}

/* ============================
   DRAFT TAB
============================ */

let draftState = {
  activeMode: 'board', // 'board' or 'room'
  activeSubTab: 'prospects', // prospects, order, results (for board mode)
  selectedProspectId: null,
  searchQuery: '',
  positionFilter: 'ALL',
  rangeFilter: 'ALL',
  sortBy: 'rank' // rank, ovr, pot, age, name
};

function renderDraft() {
  const el = document.getElementById('draft-tab');
  
  // Ensure prospects exist
  ensureDraftProspects();
  
  const draftActive = league.draft?.inProgress || false;
  const prospects = getDraftProspects();
  
  // Auto-switch to room mode if draft is active and user was in board mode
  if (draftActive && draftState.activeMode === 'board') {
    // Keep them in board mode unless they click room
  }
  
  el.innerHTML = `
    <div class="draft-container">
      <!-- Draft Header -->
      <div class="draft-header">
        <div class="draft-header-left">
          <h1 class="draft-title">Draft</h1>
          <div class="draft-subtitle">Prospects & Draft Room</div>
        </div>
        <div class="draft-header-right">
          <div class="draft-phase-info">
            <div class="draft-season">Season ${league.season}</div>
            <div class="draft-phase">Phase: ${getCurrentPhaseDisplay()}</div>
          </div>
        </div>
      </div>
      
      ${!draftActive ? `
        <div class="draft-inactive-banner">
          <div class="draft-banner-icon">⏸️</div>
          <div class="draft-banner-content">
            <div class="draft-banner-title">No Draft In Progress</div>
            <div class="draft-banner-text">The draft begins after the regular season and playoffs conclude.</div>
          </div>
          ${league.phase === 'offseason' ? `
            <button class="draft-banner-btn" onclick="startDraft()">Start Draft</button>
          ` : ''}
        </div>
      ` : ''}
      
      <!-- Mode Toggle -->
      <div class="draft-mode-toggle">
        <button class="draft-mode-btn ${draftState.activeMode === 'board' ? 'active' : ''}" 
                onclick="switchDraftMode('board')">
          <span class="draft-mode-icon">📋</span>
          <span class="draft-mode-text">Prospect Board</span>
        </button>
        <button class="draft-mode-btn ${draftState.activeMode === 'room' ? 'active' : ''}" 
                onclick="switchDraftMode('room')"
                ${!draftActive ? 'disabled title="Draft not active"' : ''}>
          <span class="draft-mode-icon">🎯</span>
          <span class="draft-mode-text">Draft Room</span>
          ${!draftActive ? '<span class="draft-mode-lock">🔒</span>' : ''}
        </button>
      </div>
      
      <!-- Content Area -->
      <div class="draft-content">
        ${draftState.activeMode === 'board' ? renderProspectBoard() : renderDraftRoom()}
      </div>
    </div>
  `;
}

function switchDraftMode(mode) {
  const draftActive = league.draft?.inProgress || false;
  if (mode === 'room' && !draftActive) {
    return; // Can't switch to room if draft not active
  }
  draftState.activeMode = mode;
  render();
}

function renderProspectBoard() {
  let prospects = [...getDraftProspects()];
  const userTeam = league.teams.find(t => t.id === selectedTeamId);
  
  // Apply filters
  if (draftState.positionFilter !== 'ALL') {
    prospects = prospects.filter(p => p.pos === draftState.positionFilter);
  }
  
  if (draftState.rangeFilter !== 'ALL') {
    prospects = prospects.filter(p => p.projectedRange === draftState.rangeFilter);
  }
  
  if (draftState.searchQuery) {
    const query = draftState.searchQuery.toLowerCase();
    prospects = prospects.filter(p => 
      p.name.toLowerCase().includes(query) ||
      p.pos.toLowerCase().includes(query) ||
      p.archetype.toLowerCase().includes(query)
    );
  }
  
  // Apply sorting
  prospects.sort((a, b) => {
    switch (draftState.sortBy) {
      case 'rank': return a.rank - b.rank;
      case 'ovr': return b.ratings.ovr - a.ratings.ovr;
      case 'pot': return b.ratings.pot - a.ratings.pot;
      case 'age': return a.age - b.age;
      case 'name': return a.name.localeCompare(b.name);
      default: return 0;
    }
  });
  
  return `
    <div class="prospect-board">
      <!-- Filters & Search -->
      <div class="prospect-filters">
        <input type="text" class="prospect-search" placeholder="Search prospects..." 
               value="${draftState.searchQuery}" 
               oninput="updateProspectSearch(this.value)">
        
        <select class="prospect-filter-select" onchange="updateProspectPosition(this.value)">
          <option value="ALL" ${draftState.positionFilter === 'ALL' ? 'selected' : ''}>All Positions</option>
          <option value="PG" ${draftState.positionFilter === 'PG' ? 'selected' : ''}>PG</option>
          <option value="SG" ${draftState.positionFilter === 'SG' ? 'selected' : ''}>SG</option>
          <option value="SF" ${draftState.positionFilter === 'SF' ? 'selected' : ''}>SF</option>
          <option value="PF" ${draftState.positionFilter === 'PF' ? 'selected' : ''}>PF</option>
          <option value="C" ${draftState.positionFilter === 'C' ? 'selected' : ''}>C</option>
        </select>
        
        <select class="prospect-filter-select" onchange="updateProspectRange(this.value)">
          <option value="ALL" ${draftState.rangeFilter === 'ALL' ? 'selected' : ''}>All Ranges</option>
          <option value="Top 5" ${draftState.rangeFilter === 'Top 5' ? 'selected' : ''}>Top 5</option>
          <option value="Lottery" ${draftState.rangeFilter === 'Lottery' ? 'selected' : ''}>Lottery</option>
          <option value="Mid 1st" ${draftState.rangeFilter === 'Mid 1st' ? 'selected' : ''}>Mid 1st</option>
          <option value="Late 1st" ${draftState.rangeFilter === 'Late 1st' ? 'selected' : ''}>Late 1st</option>
          <option value="Early 2nd" ${draftState.rangeFilter === 'Early 2nd' ? 'selected' : ''}>Early 2nd</option>
          <option value="Late 2nd" ${draftState.rangeFilter === 'Late 2nd' ? 'selected' : ''}>Late 2nd</option>
        </select>
        
        <select class="prospect-filter-select" onchange="updateProspectSort(this.value)">
          <option value="rank" ${draftState.sortBy === 'rank' ? 'selected' : ''}>Sort by Rank</option>
          <option value="ovr" ${draftState.sortBy === 'ovr' ? 'selected' : ''}>Sort by OVR</option>
          <option value="pot" ${draftState.sortBy === 'pot' ? 'selected' : ''}>Sort by POT</option>
          <option value="age" ${draftState.sortBy === 'age' ? 'selected' : ''}>Sort by Age</option>
          <option value="name" ${draftState.sortBy === 'name' ? 'selected' : ''}>Sort by Name</option>
        </select>
      </div>
      
      <!-- Prospect List -->
      <div class="prospect-list">
        <div class="prospect-list-header">
          <div class="prospect-col-rank">Rank</div>
          <div class="prospect-col-name">Name</div>
          <div class="prospect-col-pos">Pos</div>
          <div class="prospect-col-age">Age</div>
          <div class="prospect-col-ovr">OVR</div>
          <div class="prospect-col-pot">POT</div>
          <div class="prospect-col-archetype">Archetype</div>
          <div class="prospect-col-range">Projected</div>
          <div class="prospect-col-watch">Watch</div>
        </div>
        
        <div class="prospect-list-body">
          ${prospects.length === 0 ? `
            <div class="prospect-list-empty">No prospects found</div>
          ` : prospects.map(p => {
            const isWatchlisted = isProspectWatchlisted(p.id, selectedTeamId);
            return `
              <div class="prospect-list-row" onclick="openProspectModal('${p.id}')">
                <div class="prospect-col-rank">#${p.rank}</div>
                <div class="prospect-col-name clickable-player" onclick="event.stopPropagation(); showPlayerModal('${p.id}');">${p.name}</div>
                <div class="prospect-col-pos">${p.pos}</div>
                <div class="prospect-col-age">${p.age}</div>
                <div class="prospect-col-ovr">
                  <span class="prospect-rating ovr">${p.ratings.ovr}</span>
                </div>
                <div class="prospect-col-pot">
                  <span class="prospect-rating pot">${p.ratings.pot}</span>
                </div>
                <div class="prospect-col-archetype">${p.archetype}</div>
                <div class="prospect-col-range">
                  <span class="prospect-range-badge">${p.projectedRange}</span>
                </div>
                <div class="prospect-col-watch">
                  <button class="prospect-watch-btn ${isWatchlisted ? 'active' : ''}" 
                          onclick="event.stopPropagation(); toggleWatchlist('${p.id}')">
                    ${isWatchlisted ? '⭐' : '☆'}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderDraftContent() {
  switch (draftState.activeSubTab) {
    case 'room': return renderDraftRoom();
    case 'prospects': return renderProspectsTab();
    case 'order': return renderDraftOrderTab();
    case 'results': return renderResultsTab();
    default: return '<div>Loading...</div>';
  }
}

function renderDraftRoom() {
  const draft = league.draft;
  const currentPick = draft.order[draft.currentPickIndex];
  if (!currentPick) {
    return '<div class="draft-complete">Draft Complete!</div>';
  }
  
  const onClockTeam = league.teams.find(t => t.id === currentPick.currentOwner);
  const isUserOnClock = currentPick.currentOwner === selectedTeamId;
  const bestAvailable = getBestAvailable(10);
  
  return `
    <div class="draft-room">
      <!-- On The Clock Card -->
      <div class="draft-on-clock">
        <div class="draft-clock-header">On The Clock</div>
        <div class="draft-clock-team">${onClockTeam.name}</div>
        <div class="draft-clock-pick">Pick #${currentPick.overallPick} (Round ${currentPick.round})</div>
        ${!isUserOnClock ? `
          <button class="draft-sim-pick-btn" onclick="simulateAIPick()">Simulate Pick</button>
        ` : ''}
      </div>
      
      <!-- Best Available List -->
      <div class="draft-best-available">
        <h3 class="draft-section-title">Best Available</h3>
        <div class="draft-prospects-list">
          ${bestAvailable.map((p, idx) => `
            <div class="draft-prospect-row ${draftState.selectedProspectId === p.id ? 'selected' : ''}" 
                 onclick="selectProspect('${p.id}')">
              <div class="draft-prospect-rank">${idx + 1}</div>
              <div class="draft-prospect-info">
                <div class="draft-prospect-name clickable-player" onclick="event.stopPropagation(); showPlayerModal('${p.id}');">${p.name}</div>
                <div class="draft-prospect-meta">${p.pos} • Age ${p.age} • ${p.bio.college}</div>
              </div>
              <div class="draft-prospect-ratings">
                <div class="draft-rating-badge ovr">${p.ratings.ovr} OVR</div>
                <div class="draft-rating-badge pot">${p.ratings.pot} POT</div>
              </div>
              <div class="draft-prospect-attrs">
                <span class="draft-attr-badge">3PT: ${Math.round(p.attributes.offensive.threePoint)}</span>
                <span class="draft-attr-badge">DEF: ${Math.round(p.attributes.defensive.perimeterDefense)}</span>
                <span class="draft-attr-badge">ATH: ${Math.round(p.attributes.athletic.speed)}</span>
              </div>
              <button class="draft-view-btn" onclick="event.stopPropagation(); viewProspectProfile('${p.id}')">View</button>
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- Action Buttons -->
      ${isUserOnClock ? `
        <div class="draft-actions">
          <button class="draft-action-btn auto" onclick="autoPickPlayer()">Auto Pick (Best Available)</button>
          <button class="draft-action-btn make-pick" 
                  ${!draftState.selectedProspectId ? 'disabled' : ''}
                  onclick="makeUserPick()">Make Pick</button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderProspectsTab() {
  const draft = league.draft;
  let prospects = [...draft.prospects];
  
  // Apply filters
  if (draftState.positionFilter !== 'ALL') {
    prospects = prospects.filter(p => p.pos === draftState.positionFilter);
  }
  
  if (draftState.searchQuery) {
    const query = draftState.searchQuery.toLowerCase();
    prospects = prospects.filter(p => 
      p.name.toLowerCase().includes(query) ||
      p.pos.toLowerCase().includes(query)
    );
  }
  
  // Apply sorting
  prospects.sort((a, b) => {
    switch (draftState.sortBy) {
      case 'ovr': return b.ratings.ovr - a.ratings.ovr;
      case 'pot': return b.ratings.pot - a.ratings.pot;
      case 'age': return a.age - b.age;
      case 'name': return a.name.localeCompare(b.name);
      default: return 0;
    }
  });
  
  const userBoard = draft.boardByTeamId[selectedTeamId] || { prospects: [], notes: {} };
  
  return `
    <div class="draft-prospects">
      <!-- Filters -->
      <div class="draft-filters">
        <input type="text" class="draft-search" placeholder="Search prospects..." 
               value="${draftState.searchQuery}" 
               oninput="updateDraftSearch(this.value)">
        
        <select class="draft-filter-select" onchange="updatePositionFilter(this.value)">
          <option value="ALL" ${draftState.positionFilter === 'ALL' ? 'selected' : ''}>All Positions</option>
          <option value="PG" ${draftState.positionFilter === 'PG' ? 'selected' : ''}>PG</option>
          <option value="SG" ${draftState.positionFilter === 'SG' ? 'selected' : ''}>SG</option>
          <option value="SF" ${draftState.positionFilter === 'SF' ? 'selected' : ''}>SF</option>
          <option value="PF" ${draftState.positionFilter === 'PF' ? 'selected' : ''}>PF</option>
          <option value="C" ${draftState.positionFilter === 'C' ? 'selected' : ''}>C</option>
        </select>
        
        <select class="draft-filter-select" onchange="updateDraftSort(this.value)">
          <option value="ovr" ${draftState.sortBy === 'ovr' ? 'selected' : ''}>Sort by OVR</option>
          <option value="pot" ${draftState.sortBy === 'pot' ? 'selected' : ''}>Sort by POT</option>
          <option value="age" ${draftState.sortBy === 'age' ? 'selected' : ''}>Sort by Age</option>
          <option value="name" ${draftState.sortBy === 'name' ? 'selected' : ''}>Sort by Name</option>
        </select>
      </div>
      
      <!-- Prospects List -->
      <div class="draft-prospects-list">
        ${prospects.map(p => {
          const isOnBoard = userBoard.prospects.includes(p.id);
          return `
            <div class="draft-prospect-row">
              <div class="draft-prospect-info">
                <div class="draft-prospect-name clickable-player" onclick="showPlayerModal('${p.id}')">${p.name}</div>
                <div class="draft-prospect-meta">${p.pos} • Age ${p.age} • ${p.archetype}</div>
              </div>
              <div class="draft-prospect-ratings">
                <div class="draft-rating-badge ovr">${p.ratings.ovr} OVR</div>
                <div class="draft-rating-badge pot">${p.ratings.pot} POT</div>
              </div>
              <div class="draft-prospect-range">${p.projectedRange}</div>
              <button class="draft-board-btn ${isOnBoard ? 'active' : ''}" 
                      onclick="toggleBoard('${p.id}')">
                ${isOnBoard ? '⭐' : '☆'}
              </button>
              <button class="draft-view-btn" onclick="viewProspectProfile('${p.id}')">View</button>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderDraftOrderTab() {
  const draft = league.draft;
  
  // Group picks by round
  const round1 = draft.order.filter(p => p.round === 1);
  const round2 = draft.order.filter(p => p.round === 2);
  
  const renderPickList = (picks) => picks.map(pick => {
    const team = league.teams.find(t => t.id === pick.currentOwner);
    const isPast = pick.overallPick < draft.order[draft.currentPickIndex]?.overallPick;
    const isCurrent = pick.overallPick === draft.order[draft.currentPickIndex]?.overallPick;
    const draftedPlayer = draft.results.find(r => r.pickNumber === pick.overallPick);
    
    return `
      <div class="draft-order-row ${isPast ? 'past' : ''} ${isCurrent ? 'current' : ''}">
        <div class="draft-order-pick">#${pick.overallPick}</div>
        <div class="draft-order-team">${team.name}</div>
        ${draftedPlayer ? `
          <div class="draft-order-player">${draftedPlayer.playerName} (${draftedPlayer.pos})</div>
        ` : '<div class="draft-order-player">—</div>'}
      </div>
    `;
  }).join('');
  
  return `
    <div class="draft-order">
      <div class="draft-round-section">
        <h3 class="draft-section-title">Round 1</h3>
        <div class="draft-order-list">
          ${renderPickList(round1)}
        </div>
      </div>
      
      <div class="draft-round-section">
        <h3 class="draft-section-title">Round 2</h3>
        <div class="draft-order-list">
          ${renderPickList(round2)}
        </div>
      </div>
    </div>
  `;
}

function renderResultsTab() {
  const draft = league.draft;
  
  if (draft.results.length === 0) {
    return '<div class="draft-no-results">No picks made yet</div>';
  }
  
  return `
    <div class="draft-results">
      <h3 class="draft-section-title">Draft Results</h3>
      <div class="draft-results-list">
        ${draft.results.map(result => `
          <div class="draft-result-row">
            <div class="draft-result-pick">#${result.pickNumber}</div>
            <div class="draft-result-round">R${result.round}</div>
            <div class="draft-result-team">${result.teamName}</div>
            <div class="draft-result-player">
              <div class="draft-result-name">${result.playerName}</div>
              <div class="draft-result-meta">${result.pos} • ${result.ovr} OVR • ${result.pot} POT</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function switchDraftTab(tab) {
  draftState.activeSubTab = tab;
  render();
}

function selectProspect(prospectId) {
  draftState.selectedProspectId = prospectId;
  render();
}

function updateProspectSearch(value) {
  draftState.searchQuery = value;
  render();
}

function updateProspectPosition(value) {
  draftState.positionFilter = value;
  render();
}

function updateProspectRange(value) {
  draftState.rangeFilter = value;
  render();
}

function updateProspectSort(value) {
  draftState.sortBy = value;
  render();
}

function toggleWatchlist(prospectId) {
  toggleProspectWatchlist(prospectId, selectedTeamId);
  render();
}

function openProspectModal(prospectId) {
  const prospects = getDraftProspects();
  const prospect = prospects.find(p => p.id === prospectId);
  if (!prospect) return;
  
  const isWatchlisted = isProspectWatchlisted(prospectId, selectedTeamId);
  const draftActive = league.draft?.inProgress || false;
  const currentPick = league.draft?.order?.[league.draft?.currentPickIndex];
  const isUserOnClock = currentPick && currentPick.currentOwner === selectedTeamId;
  
  const modalContent = `
    <div class="prospect-modal">
      <div class="prospect-modal-header">
        <div class="prospect-modal-title">
          <h2>${prospect.name}</h2>
          <div class="prospect-modal-subtitle">
            ${prospect.pos} • Age ${prospect.age} • ${prospect.archetype}
          </div>
        </div>
        <button class="prospect-modal-close" onclick="closeModal(event)">×</button>
      </div>
      
      <div class="prospect-modal-body">
        <!-- Main Ratings -->
        <div class="prospect-modal-ratings">
          <div class="prospect-rating-large">
            <div class="prospect-rating-value ovr">${prospect.ratings.ovr}</div>
            <div class="prospect-rating-label">Overall</div>
          </div>
          <div class="prospect-rating-large">
            <div class="prospect-rating-value pot">${prospect.ratings.pot}</div>
            <div class="prospect-rating-label">Potential</div>
          </div>
          <div class="prospect-rating-large">
            <div class="prospect-rating-value rank">#${prospect.rank}</div>
            <div class="prospect-rating-label">Rank</div>
          </div>
        </div>
        
        <!-- Bio -->
        <div class="prospect-modal-section">
          <h3 class="prospect-modal-section-title">Bio</h3>
          <div class="prospect-bio-grid">
            <div class="prospect-bio-item">
              <span class="prospect-bio-label">Height:</span>
              <span class="prospect-bio-value">${prospect.bio.height}</span>
            </div>
            <div class="prospect-bio-item">
              <span class="prospect-bio-label">Weight:</span>
              <span class="prospect-bio-value">${prospect.bio.weight}</span>
            </div>
            <div class="prospect-bio-item">
              <span class="prospect-bio-label">Wingspan:</span>
              <span class="prospect-bio-value">${prospect.bio.wingspan}</span>
            </div>
            <div class="prospect-bio-item">
              <span class="prospect-bio-label">College:</span>
              <span class="prospect-bio-value">${prospect.bio.college}</span>
            </div>
            <div class="prospect-bio-item">
              <span class="prospect-bio-label">Draft Year:</span>
              <span class="prospect-bio-value">${prospect.draftYear}</span>
            </div>
            <div class="prospect-bio-item">
              <span class="prospect-bio-label">Projected:</span>
              <span class="prospect-bio-value">${prospect.projectedRange}</span>
            </div>
          </div>
        </div>
        
        <!-- Strengths & Weaknesses -->
        <div class="prospect-modal-section">
          <div class="prospect-sw-grid">
            <div class="prospect-sw-column">
              <h4 class="prospect-sw-title strengths">Strengths</h4>
              <div class="prospect-sw-tags">
                ${prospect.strengths.map(s => `<span class="prospect-tag strength">${s}</span>`).join('')}
              </div>
            </div>
            <div class="prospect-sw-column">
              <h4 class="prospect-sw-title weaknesses">Weaknesses</h4>
              <div class="prospect-sw-tags">
                ${prospect.weaknesses.map(w => `<span class="prospect-tag weakness">${w}</span>`).join('')}
              </div>
            </div>
          </div>
        </div>
        
        <!-- Attributes -->
        <div class="prospect-modal-section">
          <h3 class="prospect-modal-section-title">Attributes</h3>
          <div class="prospect-attrs-grid">
            <div class="prospect-attr-group">
              <h4>Athletic</h4>
              <div class="prospect-attr-item">
                <span>Speed</span>
                <span class="prospect-attr-value">${Math.round(prospect.attributes.athletic.speed)}</span>
              </div>
              <div class="prospect-attr-item">
                <span>Vertical</span>
                <span class="prospect-attr-value">${Math.round(prospect.attributes.athletic.vertical)}</span>
              </div>
              <div class="prospect-attr-item">
                <span>Strength</span>
                <span class="prospect-attr-value">${Math.round(prospect.attributes.athletic.strength)}</span>
              </div>
            </div>
            
            <div class="prospect-attr-group">
              <h4>Offense</h4>
              <div class="prospect-attr-item">
                <span>3PT Shooting</span>
                <span class="prospect-attr-value">${Math.round(prospect.attributes.offensive.threePoint)}</span>
              </div>
              <div class="prospect-attr-item">
                <span>Finishing</span>
                <span class="prospect-attr-value">${Math.round(prospect.attributes.offensive.finishing)}</span>
              </div>
              <div class="prospect-attr-item">
                <span>Ball Handling</span>
                <span class="prospect-attr-value">${Math.round(prospect.attributes.offensive.ballHandling)}</span>
              </div>
            </div>
            
            <div class="prospect-attr-group">
              <h4>Defense</h4>
              <div class="prospect-attr-item">
                <span>Perimeter D</span>
                <span class="prospect-attr-value">${Math.round(prospect.attributes.defensive.perimeterDefense)}</span>
              </div>
              <div class="prospect-attr-item">
                <span>Interior D</span>
                <span class="prospect-attr-value">${Math.round(prospect.attributes.defensive.interiorDefense)}</span>
              </div>
              <div class="prospect-attr-item">
                <span>Rebounding</span>
                <span class="prospect-attr-value">${Math.round(prospect.attributes.defensive.defensiveRebounding)}</span>
              </div>
            </div>
            
            <div class="prospect-attr-group">
              <h4>Mental</h4>
              <div class="prospect-attr-item">
                <span>Basketball IQ</span>
                <span class="prospect-attr-value">${Math.round(prospect.attributes.mental.basketballIQ)}</span>
              </div>
              <div class="prospect-attr-item">
                <span>Work Ethic</span>
                <span class="prospect-attr-value">${Math.round(prospect.attributes.mental.workEthic)}</span>
              </div>
              <div class="prospect-attr-item">
                <span>Leadership</span>
                <span class="prospect-attr-value">${Math.round(prospect.attributes.mental.leadership)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="prospect-modal-footer">
        <button class="prospect-watchlist-toggle ${isWatchlisted ? 'active' : ''}" 
                onclick="toggleWatchlist('${prospectId}'); openProspectModal('${prospectId}')">
          ${isWatchlisted ? '⭐ Remove from Watchlist' : '☆ Add to Watchlist'}
        </button>
        ${draftActive && isUserOnClock ? `
          <button class="prospect-draft-now" onclick="draftThisPlayer('${prospectId}')">
            Draft This Player
          </button>
        ` : ''}
      </div>
    </div>
  `;
  
  document.getElementById('modalContent').innerHTML = modalContent;
  document.getElementById('playerModal').style.display = 'flex';
}

function updateDraftSearch(value) {
  draftState.searchQuery = value;
  render();
}

function updatePositionFilter(value) {
  draftState.positionFilter = value;
  render();
}

function updateDraftSort(value) {
  draftState.sortBy = value;
  render();
}

function toggleBoard(prospectId) {
  const userBoard = league.draft.boardByTeamId[selectedTeamId];
  if (!userBoard) return;
  
  const index = userBoard.prospects.indexOf(prospectId);
  if (index === -1) {
    userBoard.prospects.push(prospectId);
  } else {
    userBoard.prospects.splice(index, 1);
  }
  
  saveLeague(league);
  render();
}

function viewProspectProfile(prospectId) {
  const prospect = league.draft.prospects.find(p => p.id === prospectId);
  if (!prospect) return;
  
  const userBoard = league.draft.boardByTeamId[selectedTeamId] || { prospects: [], notes: {} };
  const isOnBoard = userBoard.prospects.includes(prospectId);
  const currentPick = league.draft.order[league.draft.currentPickIndex];
  const isUserOnClock = currentPick && currentPick.currentOwner === selectedTeamId;
  
  const modalContent = `
    <div class="prospect-profile-modal">
      <div class="prospect-profile-header">
        <div class="prospect-profile-title">
          <h2>${prospect.name}</h2>
          <div class="prospect-profile-subtitle">${prospect.pos} • Age ${prospect.age} • ${prospect.archetype}</div>
        </div>
        <button class="prospect-profile-close" onclick="closeModal(event)">×</button>
      </div>
      
      <div class="prospect-profile-body">
        <!-- Main Ratings -->
        <div class="prospect-ratings-main">
          <div class="prospect-rating-big">
            <div class="prospect-rating-value ovr">${prospect.ratings.ovr}</div>
            <div class="prospect-rating-label">Overall</div>
          </div>
          <div class="prospect-rating-big">
            <div class="prospect-rating-value pot">${prospect.ratings.pot}</div>
            <div class="prospect-rating-label">Potential</div>
          </div>
        </div>
        
        <!-- Bio Info -->
        <div class="prospect-bio">
          <div class="prospect-bio-item">
            <span class="prospect-bio-label">Height:</span>
            <span class="prospect-bio-value">${prospect.bio.height}</span>
          </div>
          <div class="prospect-bio-item">
            <span class="prospect-bio-label">Weight:</span>
            <span class="prospect-bio-value">${prospect.bio.weight}</span>
          </div>
          <div class="prospect-bio-item">
            <span class="prospect-bio-label">Wingspan:</span>
            <span class="prospect-bio-value">${prospect.bio.wingspan}</span>
          </div>
          <div class="prospect-bio-item">
            <span class="prospect-bio-label">College:</span>
            <span class="prospect-bio-value">${prospect.bio.college}</span>
          </div>
          <div class="prospect-bio-item">
            <span class="prospect-bio-label">Projected:</span>
            <span class="prospect-bio-value">${prospect.projectedRange}</span>
          </div>
        </div>
        
        <!-- Attributes -->
        <div class="prospect-attributes">
          <div class="prospect-attr-group">
            <h4>Athletic</h4>
            <div class="prospect-attr-bar">
              <span>Speed</span>
              <span>${Math.round(prospect.attributes.athletic.speed)}</span>
            </div>
            <div class="prospect-attr-bar">
              <span>Vertical</span>
              <span>${Math.round(prospect.attributes.athletic.vertical)}</span>
            </div>
            <div class="prospect-attr-bar">
              <span>Strength</span>
              <span>${Math.round(prospect.attributes.athletic.strength)}</span>
            </div>
          </div>
          
          <div class="prospect-attr-group">
            <h4>Offense</h4>
            <div class="prospect-attr-bar">
              <span>3PT Shooting</span>
              <span>${Math.round(prospect.attributes.offensive.threePoint)}</span>
            </div>
            <div class="prospect-attr-bar">
              <span>Finishing</span>
              <span>${Math.round(prospect.attributes.offensive.finishing)}</span>
            </div>
            <div class="prospect-attr-bar">
              <span>Ball Handling</span>
              <span>${Math.round(prospect.attributes.offensive.ballHandling)}</span>
            </div>
          </div>
          
          <div class="prospect-attr-group">
            <h4>Defense</h4>
            <div class="prospect-attr-bar">
              <span>Perimeter D</span>
              <span>${Math.round(prospect.attributes.defensive.perimeterDefense)}</span>
            </div>
            <div class="prospect-attr-bar">
              <span>Interior D</span>
              <span>${Math.round(prospect.attributes.defensive.interiorDefense)}</span>
            </div>
            <div class="prospect-attr-bar">
              <span>Rebounding</span>
              <span>${Math.round(prospect.attributes.defensive.defensiveRebounding)}</span>
            </div>
          </div>
          
          <div class="prospect-attr-group">
            <h4>Mental</h4>
            <div class="prospect-attr-bar">
              <span>Basketball IQ</span>
              <span>${Math.round(prospect.attributes.mental.basketballIQ)}</span>
            </div>
            <div class="prospect-attr-bar">
              <span>Work Ethic</span>
              <span>${Math.round(prospect.attributes.mental.workEthic)}</span>
            </div>
            <div class="prospect-attr-bar">
              <span>Leadership</span>
              <span>${Math.round(prospect.attributes.mental.leadership)}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="prospect-profile-footer">
        <button class="prospect-board-toggle ${isOnBoard ? 'active' : ''}" 
                onclick="toggleBoard('${prospectId}'); viewProspectProfile('${prospectId}')">
          ${isOnBoard ? '⭐ On Board' : '☆ Add to Board'}
        </button>
        ${isUserOnClock ? `
          <button class="prospect-draft-btn" onclick="draftThisPlayer('${prospectId}')">
            Draft This Player
          </button>
        ` : ''}
      </div>
    </div>
  `;
  
  document.getElementById('modalContent').innerHTML = modalContent;
  document.getElementById('playerModal').style.display = 'flex';
}

function startDraft() {
  initializeDraft(league.season);
  league.phase = 'draft';
  saveLeague(league);
  switchTab('draft');
  render();
}

function simulateAIPick() {
  const result = autoDraftAI();
  if (result && result.success) {
    render();
  }
}

function autoPickPlayer() {
  const bestAvailable = getBestAvailable(1);
  if (bestAvailable.length > 0) {
    makeUserPick(bestAvailable[0].id);
  }
}

function makeUserPick(prospectId = null) {
  const pickProspectId = prospectId || draftState.selectedProspectId;
  if (!pickProspectId) {
    alert('Please select a prospect first');
    return;
  }
  
  const result = makeDraftPick(pickProspectId, selectedTeamId);
  if (result.success) {
    draftState.selectedProspectId = null;
    
    // Check if draft is complete
    if (!league.draft.inProgress) {
      showDraftCompleteModal();
    } else {
      render();
    }
  } else {
    alert(result.error || 'Failed to make pick');
  }
}

function draftThisPlayer(prospectId) {
  closeModal();
  makeUserPick(prospectId);
}

function showDraftCompleteModal() {
  const userPicks = league.draft.results.filter(r => r.teamId === selectedTeamId);
  
  const modalContent = `
    <div class="draft-complete-modal">
      <div class="draft-complete-header">
        <h2>Draft Complete!</h2>
      </div>
      
      <div class="draft-complete-body">
        <h3>Your Picks:</h3>
        <div class="draft-complete-picks">
          ${userPicks.map(pick => `
            <div class="draft-complete-pick">
              <div class="draft-complete-pick-num">#${pick.pickNumber}</div>
              <div class="draft-complete-pick-info">
                <div class="draft-complete-pick-name">${pick.playerName}</div>
                <div class="draft-complete-pick-meta">${pick.pos} • ${pick.ovr} OVR • ${pick.pot} POT</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="draft-complete-footer">
        <button class="draft-complete-btn" onclick="closeDraftCompleteModal()">Continue to Offseason</button>
      </div>
    </div>
  `;
  
  document.getElementById('modalContent').innerHTML = modalContent;
  document.getElementById('playerModal').style.display = 'flex';
}

function closeDraftCompleteModal() {
  closeModal();
  switchTab('team');
  render();
}

function renderRotations() {
  const el = document.getElementById('rotations-tab');
  if (!el) return;
  
  const team = league.teams.find(t => t.id === selectedTeamId);
  if (!team) return;
  
  // Ensure team has rotations
  if (!team.rotations) {
    team.rotations = generateDefaultRotations(team);
  }
  
  const totalMinutes = calcTotalMinutes(selectedTeamId);
  const isValid = totalMinutes === 240;
  const minutesClass = isValid ? '' : (totalMinutes > 240 ? 'error' : 'warning');
  
  // Calculate starter and bench minutes
  const starterMinutes = team.players
    .filter(p => team.rotations.roleByPlayerId[p.id] === 'starter')
    .reduce((sum, p) => sum + (team.rotations.minuteTargetsByPlayerId[p.id] || 0), 0);
  const benchMinutes = totalMinutes - starterMinutes;
  
  // Coach influence values
  const coachRigidity = team.coach?.personality?.discipline ? team.coach.personality.discipline * 10 : 50;
  const coachVeteranTrust = team.coach?.personality?.patience ? team.coach.personality.patience * 10 : 50;
  const coachExperimentation = team.coach?.personality?.innovation ? team.coach.personality.innovation * 10 : 50;
  
  // Get starters and bench players
  const starters = team.players.filter(p => team.rotations.roleByPlayerId[p.id] === 'starter')
    .sort((a, b) => ['PG', 'SG', 'SF', 'PF', 'C'].indexOf(a.pos) - ['PG', 'SG', 'SF', 'PF', 'C'].indexOf(b.pos));
  const benchPlayers = team.players
    .filter(p => team.rotations.roleByPlayerId[p.id] !== 'starter')
    .sort((a, b) => (team.rotations.minuteTargetsByPlayerId[b.id] || 0) - (team.rotations.minuteTargetsByPlayerId[a.id] || 0))
    .slice(0, 3);
  
  // Group players by position
  const positionGroups = {
    PG: team.players.filter(p => p.pos === 'PG').sort((a, b) => b.ratings.ovr - a.ratings.ovr),
    SG: team.players.filter(p => p.pos === 'SG').sort((a, b) => b.ratings.ovr - a.ratings.ovr),
    SF: team.players.filter(p => p.pos === 'SF').sort((a, b) => b.ratings.ovr - a.ratings.ovr),
    PF: team.players.filter(p => p.pos === 'PF').sort((a, b) => b.ratings.ovr - a.ratings.ovr),
    C: team.players.filter(p => p.pos === 'C').sort((a, b) => b.ratings.ovr - a.ratings.ovr)
  };
  
  el.innerHTML = `
    <div class="rotations-page">
      <!-- Header -->
      <div class="rotations-header">
        <h1 class="rotations-title">Rotations</h1>
        <div class="rotations-meta">
          <select class="rotations-team-select" onchange="if(typeof switchUserTeam === 'function') { switchUserTeam(parseInt(this.value)); } else { selectedTeamId = parseInt(this.value); } render();">
            ${league.teams.map(t => `
              <option value="${t.id}" ${t.id === selectedTeamId ? 'selected' : ''}>${t.name}</option>
            `).join('')}
          </select>
          <a href="#" class="rotations-coach-link" onclick="event.preventDefault(); showCoachModal(${selectedTeamId});">
            Coach: ${team.coach?.name || 'Unknown'}
          </a>
          <span class="rotations-season-text">${league.season} • ${(league.phase || 'offseason').toUpperCase()}</span>
        </div>
      </div>
      
      <!-- Summary Pills -->
      <div class="rotations-summary">
        <div class="summary-pill">
          <div class="summary-pill-label">Total Minutes</div>
          <div class="summary-pill-value ${minutesClass}">${totalMinutes}/240</div>
          <div class="summary-pill-subtitle">${isValid ? 'Valid' : (totalMinutes > 240 ? 'Overage' : 'Under target')}</div>
        </div>
        <div class="summary-pill">
          <div class="summary-pill-label">Starters Minutes</div>
          <div class="summary-pill-value">${starterMinutes}</div>
          <div class="summary-pill-subtitle">Bench: ${benchMinutes}</div>
        </div>
        <div class="summary-pill">
          <div class="summary-pill-label">Coach Rigidity</div>
          <div class="summary-pill-value">${coachRigidity}</div>
          <div class="summary-pill-subtitle">Follows targets closely</div>
        </div>
      </div>
      
      <!-- Lineup Preview -->
      <div class="lineup-preview-card">
        <div class="lineup-preview-header">
          <h3 class="lineup-preview-title">Lineup Preview</h3>
          <div class="lineup-reset-buttons">
            <button class="reset-btn" onclick="resetRotationsByOVR()">Reset to Best OVR</button>
            <button class="reset-btn" onclick="resetRotationsBalanced()">Reset Balanced</button>
          </div>
        </div>
        
        <div class="lineup-slots">
          ${starters.map(p => {
            if (!p) {
              console.warn('[ROTATION] Undefined player in starters lineup slot');
              return '<div class="lineup-slot"><div class="lineup-slot-position">-</div><div class="lineup-slot-player">Empty</div><div class="lineup-slot-minutes">0 min</div></div>';
            }
            return `
            <div class="lineup-slot">
              <div class="lineup-slot-position">${p.pos || 'G'}</div>
              <div class="lineup-slot-player clickable-player" onclick="showPlayerModal(${p.id})">${p.name || 'Unknown'}</div>
              <div class="lineup-slot-minutes">${team.rotations.minuteTargetsByPlayerId[p.id] || 0} min</div>
            </div>
          `}).join('')}
        </div>
        
        <div class="lineup-bench">
          <div class="lineup-bench-title">Top Bench</div>
          <div class="lineup-bench-players">
            ${benchPlayers.map(p => {
              if (!p) {
                console.warn('[ROTATION] Undefined player in bench');
                return '<div class="bench-player-chip">Empty (0 min)</div>';
              }
              return `<div class="bench-player-chip clickable-player" onclick="showPlayerModal(${p.id})">${p.name || 'Unknown'} (${team.rotations.minuteTargetsByPlayerId[p.id] || 0} min)</div>`;
            }).join('')}
          </div>
        </div>
      </div>
      
      <!-- Position Sections -->
      ${Object.keys(positionGroups).map(pos => renderPositionSection(pos, positionGroups[pos], team)).join('')}
      
      <!-- Coach/GM Influence -->
      <div class="influence-cards">
        <div class="influence-card">
          <h3 class="influence-card-title">Coach Control</h3>
          <div class="influence-row">
            <div class="influence-label">Coach Rigidity</div>
            <div class="influence-value">
              <div class="influence-bar">
                <div class="influence-bar-fill" style="width: ${coachRigidity}%"></div>
              </div>
              <div class="influence-number">${coachRigidity}</div>
            </div>
          </div>
          <div class="influence-row">
            <div class="influence-label">Trust Veterans</div>
            <div class="influence-value">
              <div class="influence-bar">
                <div class="influence-bar-fill" style="width: ${coachVeteranTrust}%"></div>
              </div>
              <div class="influence-number">${coachVeteranTrust}</div>
            </div>
          </div>
          <div class="influence-row">
            <div class="influence-label">Experimentation</div>
            <div class="influence-value">
              <div class="influence-bar">
                <div class="influence-bar-fill" style="width: ${coachExperimentation}%"></div>
              </div>
              <div class="influence-number">${coachExperimentation}</div>
            </div>
          </div>
        </div>
        
        <div class="influence-card">
          <h3 class="influence-card-title">GM Philosophy</h3>
          <div class="influence-row">
            <div class="influence-label">Star Priority</div>
            <div class="influence-value">
              <div class="influence-bar">
                <div class="influence-bar-fill" style="width: 75%"></div>
              </div>
              <div class="influence-number">75</div>
            </div>
          </div>
          <div class="influence-row">
            <div class="influence-label">Youth Development</div>
            <div class="influence-value">
              <div class="influence-bar">
                <div class="influence-bar-fill" style="width: 60%"></div>
              </div>
              <div class="influence-number">60</div>
            </div>
          </div>
          <div class="influence-row">
            <div class="influence-label">Contract Respect</div>
            <div class="influence-value">
              <div class="influence-bar">
                <div class="influence-bar-fill" style="width: 80%"></div>
              </div>
              <div class="influence-number">80</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderPositionSection(position, players, team) {
  if (players.length === 0) return '';
  
  return `
    <div class="position-section" id="position-${position}">
      <div class="position-header" onclick="togglePositionSection('${position}')">
        <div class="position-header-left">
          <div class="position-badge">${position}</div>
          <div class="position-count">${players.length} player${players.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="position-expand-icon">▼</div>
      </div>
      <div class="position-players">
        ${players.map(p => renderRotationPlayerCard(p, team)).join('')}
      </div>
    </div>
  `;
}

function renderRotationPlayerCard(player, team) {
  // Null safety checks
  if (!player) {
    console.warn('[ROTATION] Undefined player in rotation card');
    return '<div class="rotation-player-card"><div class="rotation-player-info">Empty Slot</div></div>';
  }
  
  if (!player.pos) {
    console.warn('[ROTATION] Player missing pos field:', player.id, player.name);
    player.pos = 'G'; // Default fallback
  }
  
  if (!player.name) {
    console.warn('[ROTATION] Player missing name:', player.id);
    player.name = 'Unknown Player';
  }
  
  if (!player.ratings) {
    console.warn('[ROTATION] Player missing ratings:', player.id, player.name);
    player.ratings = { ovr: 50 };
  }
  
  if (!player.contract) {
    console.warn('[ROTATION] Player missing contract:', player.id, player.name);
    player.contract = { amount: 0, yearsRemaining: 0 };
  }
  
  const ovrClass = player.ratings.ovr >= 90 ? 'ovr-purple' :
                   player.ratings.ovr >= 85 ? 'ovr-blue' :
                   player.ratings.ovr >= 80 ? 'ovr-green' :
                   player.ratings.ovr >= 70 ? 'ovr-yellow' : 'ovr-gray';
  
  const role = team.rotations.roleByPlayerId[player.id] || 'bench';
  const minutes = team.rotations.minuteTargetsByPlayerId[player.id] || 0;
  const locked = team.rotations.lockedByPlayerId[player.id] || false;
  
  return `
    <div class="rotation-player-card">
      <div class="rotation-player-left">
        <div class="rotation-player-info">
          <div class="rotation-player-name clickable-player" onclick="showPlayerModal(${player.id})">${player.name}</div>
          <div class="rotation-player-meta">
            <span class="rotation-ovr ${ovrClass}">${player.ratings.ovr}</span>
            <span>${player.pos || 'G'}</span>
            <span class="rotation-role-badge ${role}">${(role || 'bench').toUpperCase()}</span>
            <span>Age ${player.age || 0}</span>
            <span>$${player.contract.amount.toFixed(1)}M/yr</span>
            <span>${player.contract.yearsRemaining}yr</span>
          </div>
        </div>
      </div>
      
      <div class="rotation-player-right">
        <div class="minutes-stepper">
          <button class="stepper-btn" onclick="adjustMinutes(${player.id}, -1)" ${minutes === 0 ? 'disabled' : ''}>−</button>
          <input type="number" 
                 class="minutes-input" 
                 value="${minutes}" 
                 min="0" 
                 max="48"
                 onchange="setMinutes(${player.id}, parseInt(this.value))">
          <button class="stepper-btn" onclick="adjustMinutes(${player.id}, 1)" ${minutes === 48 ? 'disabled' : ''}>+</button>
        </div>
        
        <button class="lock-toggle ${locked ? 'locked' : ''}" 
                onclick="toggleLock(${player.id})"
                title="${locked ? 'Unlock minutes' : 'Lock minutes'}">
          ${locked ? '🔒' : '🔓'}
        </button>
        
        <button class="player-menu-btn" onclick="showPlayerModal(${player.id})">
          ⋯
        </button>
      </div>
    </div>
  `;
}

// Rotation interaction functions
function togglePositionSection(position) {
  const section = document.getElementById(`position-${position}`);
  if (section) {
    section.classList.toggle('collapsed');
  }
}

function adjustMinutes(playerId, delta) {
  const team = league.teams.find(t => t.id === selectedTeamId);
  if (!team || !team.rotations) return;
  
  const current = team.rotations.minuteTargetsByPlayerId[playerId] || 0;
  const newValue = Math.max(0, Math.min(48, current + delta));
  team.rotations.minuteTargetsByPlayerId[playerId] = newValue;
  
  save();
  render();
}

function setMinutes(playerId, value) {
  const team = league.teams.find(t => t.id === selectedTeamId);
  if (!team || !team.rotations) return;
  
  const newValue = Math.max(0, Math.min(48, value || 0));
  team.rotations.minuteTargetsByPlayerId[playerId] = newValue;
  
  save();
  render();
}

function toggleLock(playerId) {
  const team = league.teams.find(t => t.id === selectedTeamId);
  if (!team || !team.rotations) return;
  
  team.rotations.lockedByPlayerId[playerId] = !team.rotations.lockedByPlayerId[playerId];
  
  save();
  render();
}

function resetRotationsByOVR() {
  const team = league.teams.find(t => t.id === selectedTeamId);
  if (!team) return;
  
  team.rotations = generateDefaultRotations(team);
  
  save();
  render();
}

function resetRotationsBalanced() {
  const team = league.teams.find(t => t.id === selectedTeamId);
  if (!team) return;
  
  // Get top 8 players by OVR
  const sortedPlayers = [...team.players].sort((a, b) => b.ratings.ovr - a.ratings.ovr);
  
  // Assign balanced minutes: 32, 32, 30, 30, 28, 28, 24, 16
  const minuteDistribution = [32, 32, 30, 30, 28, 28, 24, 16];
  
  team.rotations.minuteTargetsByPlayerId = {};
  team.rotations.roleByPlayerId = {};
  team.rotations.lockedByPlayerId = {};
  
  sortedPlayers.forEach((player, idx) => {
    if (idx < 5) {
      team.rotations.roleByPlayerId[player.id] = 'starter';
    } else if (idx === 5) {
      team.rotations.roleByPlayerId[player.id] = 'sixth';
    } else if (idx < 8) {
      team.rotations.roleByPlayerId[player.id] = 'rotation';
    } else {
      team.rotations.roleByPlayerId[player.id] = idx < 10 ? 'bench' : 'dnp';
    }
    
    team.rotations.minuteTargetsByPlayerId[player.id] = idx < minuteDistribution.length ? minuteDistribution[idx] : 0;
    team.rotations.lockedByPlayerId[player.id] = false;
  });
  
  save();
  render();
}

function showPlayerModal(playerId) {
  // Find player
  let player = null;
  let teamName = 'Free Agent';
  
  for (let team of league.teams) {
    const p = team.players.find(pl => pl.id === playerId);
    if (p) {
      player = p;
      teamName = team.name;
      break;
    }
  }
  
  if (!player) {
    player = league.freeAgents.find(p => p.id === playerId);
  }
  
  if (!player) return;
  
  // Normalize player data to handle all field variants
  player = normalizePlayer(player);
  
  // Log player object for debugging
  console.log('Player Modal - Full Player Object:', player);
  
  // Calculate per-game stats
  const ppg = player.seasonStats.gp > 0 ? (player.seasonStats.pts / player.seasonStats.gp).toFixed(1) : '0.0';
  const rpg = player.seasonStats.gp > 0 ? (player.seasonStats.reb / player.seasonStats.gp).toFixed(1) : '0.0';
  const apg = player.seasonStats.gp > 0 ? (player.seasonStats.ast / player.seasonStats.gp).toFixed(1) : '0.0';
  const spg = player.seasonStats.gp > 0 && player.seasonStats.stl ? (player.seasonStats.stl / player.seasonStats.gp).toFixed(1) : '0.0';
  const bpg = player.seasonStats.gp > 0 && player.seasonStats.blk ? (player.seasonStats.blk / player.seasonStats.gp).toFixed(1) : '0.0';
  
  // Contract info
  const yearsRemaining = player.contract.yearsRemaining || Math.max(0, player.contract.exp - league.season);
  const totalValue = player.contract.totalValue || (player.contract.amount * yearsRemaining);
  const contractStart = player.contract.startYear || (player.contract.exp - yearsRemaining);
  
  // Compute isDrafted from player.draft structure
  const isDrafted = (
    typeof player.draft.year === 'number' && isFinite(player.draft.year) &&
    typeof player.draft.round === 'number' && isFinite(player.draft.round) &&
    typeof player.draft.pick === 'number' && isFinite(player.draft.pick)
  );
  
  // Build draft line and drafted by team
  let draftLine, draftedByTeamName;
  
  if (isDrafted) {
    draftLine = `${player.draft.year} • Round ${player.draft.round} • Pick ${player.draft.pick}`;
    
    // Resolve drafted by team - NEVER show "Unknown Team"
    const teamId = player.draft.draftedByTid ?? player.draft.tid;
    
    if (teamId !== null && teamId !== undefined) {
      // Try to find team by ID in current league
      const draftTeam = league.teams.find(t => t.id === teamId);
      
      if (draftTeam) {
        // Team still exists - show current name
        draftedByTeamName = draftTeam.name;
      } else {
        // Team no longer exists - check draft history for original name
        const draftRecord = league.history?.draftsByYear?.[player.draft.year]?.find(
          pick => pick.playerId === player.id || 
                  pick.playerName === player.name ||
                  (pick.teamId === teamId && pick.round === player.draft.round && pick.pickNumber === player.draft.pick)
        );
        
        if (draftRecord && draftRecord.teamName) {
          // Found in history - show historical team name
          draftedByTeamName = `${draftRecord.teamName} (Former)`;
        } else {
          // No history found - show generic former team
          draftedByTeamName = `Former Team (ID: ${teamId})`;
        }
      }
    } else {
      // No team ID persisted - try multiple fallbacks
      const draftRecord = league.history?.draftsByYear?.[player.draft.year]?.find(
        pick => pick.playerId === player.id || 
                pick.playerName === player.name ||
                (pick.round === player.draft.round && pick.pickNumber === player.draft.pick)
      );
      
      if (draftRecord && draftRecord.teamName) {
        draftedByTeamName = draftRecord.teamName;
      } else {
        // Last resort: find player's current team
        const currentTeam = league.teams.find(t => 
          t.players.some(p => p.id === player.id)
        );
        
        if (currentTeam) {
          draftedByTeamName = `${currentTeam.name}`;
        } else {
          // Player not on any team and no history
          draftedByTeamName = '—';
        }
      }
    }
  } else {
    draftLine = 'Undrafted';
    draftedByTeamName = '—';
  }
  
  // Helper function to render attribute bars
  const renderAttributeBar = (label, value, description = '') => {
    const barClass = value >= 80 ? 'bar-green' : value >= 60 ? 'bar-blue' : value >= 40 ? 'bar-yellow' : 'bar-red';
    const displayValue = Math.round(value);
    return `
      <div class="attribute-row">
        <div class="attribute-left">
          <div class="attribute-label">${label}</div>
          ${description ? `<div class="attribute-description">${description}</div>` : ''}
        </div>
        <div class="attribute-right">
          <div class="attribute-value">${displayValue}</div>
        </div>
        <div class="attribute-bar-container">
          <div class="attribute-bar ${barClass}" style="width: ${value}%"></div>
        </div>
      </div>
    `;
  };
  
  // OVR color class
  const ovrColorClass = player.ratings.ovr >= 90 ? 'ovr-purple' :
                        player.ratings.ovr >= 85 ? 'ovr-blue' :
                        player.ratings.ovr >= 80 ? 'ovr-green' :
                        player.ratings.ovr >= 70 ? 'ovr-yellow' : 'ovr-gray';
  
  const content = `
    <div class="player-modal-content">
      <!-- Header -->
      <div class="player-modal-header">
        <div class="player-modal-title-section">
          <h1 class="player-modal-name">${player.name}</h1>
          <div class="player-modal-subtitle">
            ${player.pos} • Age ${player.age}${player.gender ? ` • <span style="color: ${player.gender === 'F' ? '#ec4899' : '#3b82f6'}; font-weight: 600;">${player.gender === 'F' ? '♀' : '♂'}</span>` : ''}
          </div>
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
          ${isCommissionerMode() ? `
            <div style="position: relative;">
              <button onclick="toggleCommissionerToolsDropdown(${player.id})" style="
                padding: 10px 20px;
                background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: bold;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 8px;
              ">
                <span>👑 Commissioner Tools</span>
                <span style="font-size: 0.8em;">▼</span>
              </button>
              <div id="commToolsDropdown_${player.id}" style="
                display: none;
                position: absolute;
                top: 100%;
                right: 0;
                margin-top: 5px;
                background: #1e293b;
                border: 2px solid #e74c3c;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                min-width: 200px;
                z-index: 10000;
              ">
                <button onclick="closePlayerModal(); showEditPlayerModal(${player.id});" style="
                  width: 100%;
                  padding: 12px 16px;
                  background: transparent;
                  color: #fff;
                  border: none;
                  border-bottom: 1px solid #334155;
                  cursor: pointer;
                  font-weight: bold;
                  text-align: left;
                  transition: background 0.2s;
                " onmouseover="this.style.background='#334155'" onmouseout="this.style.background='transparent'">
                  ✏️ Edit Player
                </button>
                <button onclick="closePlayerModal(); showDeletePlayerModal(${player.id});" style="
                  width: 100%;
                  padding: 12px 16px;
                  background: transparent;
                  color: #ef4444;
                  border: none;
                  border-bottom: 1px solid #334155;
                  cursor: pointer;
                  font-weight: bold;
                  text-align: left;
                  transition: background 0.2s;
                " onmouseover="this.style.background='#334155'" onmouseout="this.style.background='transparent'">
                  🗑️ Delete Player
                </button>
                <button onclick="closePlayerModal(); showForceInjuryModal(${player.id});" style="
                  width: 100%;
                  padding: 12px 16px;
                  background: transparent;
                  color: #f59e0b;
                  border: none;
                  cursor: pointer;
                  font-weight: bold;
                  text-align: left;
                  transition: background 0.2s;
                " onmouseover="this.style.background='#334155'" onmouseout="this.style.background='transparent'">
                  🏥 Force Injury
                </button>
              </div>
            </div>
          ` : ''}
          <button class="player-modal-close" onclick="closePlayerModal()">✕</button>
        </div>
      </div>
      
      <!-- Overall & Potential -->
      <div class="player-ratings-big">
        <div class="rating-big-item">
          <div class="rating-big-value ${ovrColorClass}">${player.ratings.ovr}</div>
          <div class="rating-big-label">OVERALL</div>
        </div>
        <div class="rating-big-item">
          <div class="rating-big-value rating-potential">${player.ratings.pot}</div>
          <div class="rating-big-label">POTENTIAL</div>
        </div>
      </div>
      
      <!-- Player Bio Card -->
      <div class="player-detail-card">
        <h3 class="card-title">Player Bio</h3>
        <div class="bio-grid-3">
          <div class="bio-stat">
            <div class="bio-label">Height</div>
            <div class="bio-value">${val(player.bio.height)}</div>
          </div>
          <div class="bio-stat">
            <div class="bio-label">Weight</div>
            <div class="bio-value">${val(player.bio.weight)}</div>
          </div>
          <div class="bio-stat">
            <div class="bio-label">Wingspan</div>
            <div class="bio-value">${val(player.bio.wingspan)}</div>
          </div>
        </div>
        <div class="bio-row">
          <span class="bio-label">Hometown:</span>
          <span class="bio-value">${val(player.bio.hometown)}</span>
        </div>
        <div class="bio-row">
          <span class="bio-label">Country:</span>
          <span class="bio-value">${val(player.bio.country)}</span>
        </div>
        <div class="bio-row">
          <span class="bio-label">College:</span>
          <span class="bio-value">${val(player.bio.college)}</span>
        </div>
        <div class="bio-row">
          <span class="bio-label">Draft:</span>
          <span class="bio-value">${draftLine}</span>
        </div>
        <div class="bio-row">
          <span class="bio-label">Drafted by:</span>
          <span class="bio-value">${draftedByTeamName}</span>
        </div>
      </div>
      
      <!-- Contract Card -->
      <div class="player-detail-card">
        <h3 class="card-title">Contract</h3>
        <div class="contract-grid">
          <div class="contract-stat">
            <div class="contract-label">Annual Salary</div>
            <div class="contract-value">$${player.contract.amount.toFixed(1)}M / yr</div>
          </div>
          <div class="contract-stat">
            <div class="contract-label">Total Value</div>
            <div class="contract-value">$${totalValue.toFixed(1)}M</div>
          </div>
        </div>
        <div class="contract-row">
          <span class="contract-label">Years Remaining:</span>
          <span class="contract-value">${yearsRemaining} yr${yearsRemaining !== 1 ? 's' : ''}</span>
        </div>
        <div class="contract-row">
          <span class="contract-label">Contract Period:</span>
          <span class="contract-value">${contractStart} - ${player.contract.exp}</span>
        </div>
      </div>
      
      <!-- Season Stats Card -->
      <div class="player-detail-card">
        <h3 class="card-title">Season Stats</h3>
        <div class="stats-list">
          <div class="stat-row">
            <span class="stat-label">Points</span>
            <span class="stat-value">${ppg}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Rebounds</span>
            <span class="stat-value">${rpg}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Assists</span>
            <span class="stat-value">${apg}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Steals</span>
            <span class="stat-value">${spg}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Blocks</span>
            <span class="stat-value">${bpg}</span>
          </div>
        </div>
      </div>
      
      <!-- Athletic Attributes Card -->
      <div class="player-detail-card">
        <h3 class="card-title">Athletic Attributes</h3>
        <div class="attributes-list">
          ${renderAttributeBar('Speed', player.attributes.athletic.speed)}
          ${renderAttributeBar('Acceleration', player.attributes.athletic.acceleration)}
          ${renderAttributeBar('Strength', player.attributes.athletic.strength)}
          ${renderAttributeBar('Vertical', player.attributes.athletic.vertical)}
          ${renderAttributeBar('Lateral Quickness', player.attributes.athletic.lateralQuickness)}
          ${renderAttributeBar('Stamina', player.attributes.athletic.stamina)}
          ${renderAttributeBar('Hustle', player.attributes.athletic.hustle)}
        </div>
      </div>
      
      <!-- Offensive Attributes Card -->
      <div class="player-detail-card">
        <h3 class="card-title">Offensive Attributes</h3>
        <h4 class="card-subtitle">Scoring Skills</h4>
        <div class="attributes-list">
          ${renderAttributeBar('Finishing', player.attributes.offensive.scoringSkills.finishing)}
          ${renderAttributeBar('Mid-Range Shooting', player.attributes.offensive.scoringSkills.midRangeShooting)}
          ${renderAttributeBar('Three-Point Shooting', player.attributes.offensive.scoringSkills.threePointShooting)}
          ${renderAttributeBar('Free Throw Shooting', player.attributes.offensive.scoringSkills.freeThrowShooting)}
          ${renderAttributeBar('Post Scoring', player.attributes.offensive.scoringSkills.postScoring)}
          ${renderAttributeBar('Shot Creation', player.attributes.offensive.scoringSkills.shotCreation)}
        </div>
        <h4 class="card-subtitle">Playmaking Skills</h4>
        <div class="attributes-list">
          ${renderAttributeBar('Ball Handling', player.attributes.offensive.playmakingSkills.ballHandling)}
          ${renderAttributeBar('Passing Vision', player.attributes.offensive.playmakingSkills.passingVision)}
          ${renderAttributeBar('Passing Accuracy', player.attributes.offensive.playmakingSkills.passingAccuracy)}
          ${renderAttributeBar('Off-Ball Movement', player.attributes.offensive.playmakingSkills.offBallMovement)}
        </div>
      </div>
      
      <!-- Defensive Attributes Card -->
      <div class="player-detail-card">
        <h3 class="card-title">Defensive Attributes</h3>
        <div class="attributes-list">
          ${renderAttributeBar('Perimeter Defense', player.attributes.defensive.perimeterDefense)}
          ${renderAttributeBar('Interior Defense', player.attributes.defensive.interiorDefense)}
          ${renderAttributeBar('Block Rating', player.attributes.defensive.blockRating)}
          ${renderAttributeBar('Steal Rating', player.attributes.defensive.stealRating)}
          ${renderAttributeBar('Defensive Rebounding', player.attributes.defensive.defensiveRebounding)}
          ${renderAttributeBar('Offensive Rebounding', player.attributes.defensive.offensiveRebounding)}
          ${renderAttributeBar('Defensive Awareness', player.attributes.defensive.defensiveAwareness)}
        </div>
      </div>
      
      <!-- Mental Attributes Card -->
      <div class="player-detail-card">
        <h3 class="card-title">Mental Attributes</h3>
        <div class="attributes-list">
          ${renderAttributeBar('Basketball IQ', player.attributes.mental.basketballIQ)}
          ${renderAttributeBar('Consistency', player.attributes.mental.consistency)}
          ${renderAttributeBar('Work Ethic', player.attributes.mental.workEthic)}
          ${renderAttributeBar('Leadership', player.attributes.mental.leadership)}
          ${renderAttributeBar('Composure', player.attributes.mental.composure)}
          ${renderAttributeBar('Discipline', player.attributes.mental.discipline)}
          ${renderAttributeBar('Clutch', player.attributes.mental.clutch)}
        </div>
      </div>
      
      <!-- Personality & Satisfaction Card -->
      <div class="player-detail-card">
        <h3 class="card-title">Personality & Satisfaction</h3>
        <div class="satisfaction-card">
          <div class="satisfaction-left">
            <div class="satisfaction-value">${player.personality.currentSatisfactionPct}%</div>
            <div class="satisfaction-label">Current Satisfaction</div>
          </div>
          <div class="satisfaction-right">
            <div class="satisfaction-status">${player.personality.satisfactionLabel}</div>
          </div>
        </div>
        <div class="attributes-list" style="margin-top: 20px;">
          ${renderAttributeBar('Loyalty', player.personality.loyalty, 'Likelihood to stay with team long-term')}
          ${renderAttributeBar('Money Focus', player.personality.moneyFocus, 'How important money is in decisions')}
          ${renderAttributeBar('Winning Drive', player.personality.winningDrive, 'Desire to win championships')}
          ${renderAttributeBar('Playing Time Desire', player.personality.playingTimeDesire, 'Importance of minutes and role')}
          ${renderAttributeBar('Team Player', player.personality.teamPlayer, 'How well they work with teammates')}
          ${renderAttributeBar('Work Ethic', player.personality.workEthic, 'Dedication to improvement')}
          ${renderAttributeBar('Ego', player.personality.ego, 'Self-importance and pride')}
          ${renderAttributeBar('Temperament', player.personality.temperament, 'Emotional stability (high = calm)')}
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalContent').innerHTML = content;
  document.getElementById('playerModal').classList.add('active');
  
  // Prevent body scroll when modal is open
  document.body.style.overflow = 'hidden';
}

function closePlayerModal() {
  document.getElementById('playerModal').classList.remove('active');
  document.body.style.overflow = '';
}

function closeModal(event) {
  // Close if clicking modal background OR if no event (called directly from button)
  if (!event || event.target.id === 'playerModal') {
    closePlayerModal();
  }
}

// Toggle Commissioner Tools dropdown on player page
function toggleCommissionerToolsDropdown(playerId) {
  const dropdown = document.getElementById(`commToolsDropdown_${playerId}`);
  if (!dropdown) return;
  
  // Toggle display
  if (dropdown.style.display === 'none' || !dropdown.style.display) {
    dropdown.style.display = 'block';
  } else {
    dropdown.style.display = 'none';
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
  // Close all commissioner tools dropdowns if clicking outside
  if (!event.target.closest('[onclick*="toggleCommissionerToolsDropdown"]') && 
      !event.target.closest('[id^="commToolsDropdown_"]')) {
    document.querySelectorAll('[id^="commToolsDropdown_"]').forEach(dropdown => {
      dropdown.style.display = 'none';
    });
  }
});

/* ============================
   COMMISSIONER MODE - EDIT PLAYER
============================ */

function showEditPlayerModal(playerId) {
  // Security guard: Only allow if Commissioner Mode is ON
  if (!isCommissionerMode()) {
    alert('⚠️ Commissioner Mode must be enabled to edit players.\\n\\nEnable it in Settings first.');
    return;
  }
  
  // Find player
  let player = null;
  let currentTeam = null;
  
  for (let team of league.teams) {
    const p = team.players.find(pl => pl.id === playerId);
    if (p) {
      player = p;
      currentTeam = team;
      break;
    }
  }
  
  if (!player) {
    player = league.freeAgents.find(p => p.id === playerId);
  }
  
  if (!player) {
    alert('Player not found');
    return;
  }
  
  // Normalize player data
  player = normalizePlayer(player);
  
  // Build team options for dropdown
  const teamOptions = [
    '<option value="null">Free Agent</option>',
    ...league.teams.map(t => `
      <option value="${t.id}" ${currentTeam && currentTeam.id === t.id ? 'selected' : ''}>
        ${t.name}
      </option>
    `)
  ].join('');
  
  const modalHTML = `
    <div id="editPlayerModal" class="modal" style="display: flex;" onclick="if(event.target.id === 'editPlayerModal') closeEditPlayerModal()">
      <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #334155;">
          <h2 style="margin: 0; color: #fff;">✏️ Edit Player - ${player.name}</h2>
          <button onclick="closeEditPlayerModal()" style="
            background: transparent;
            color: #888;
            border: none;
            cursor: pointer;
            font-size: 2em;
            line-height: 1;
            padding: 0;
          ">×</button>
        </div>
        
        <form id="editPlayerForm" onsubmit="savePlayerEdits(event, ${player.id}); return false;">
          <!-- Bio Section -->
          <div class="edit-section">
            <h3>Player Identity</h3>
            
            <div class="edit-field">
              <label>Full Name</label>
              <input type="text" id="edit_name" value="${player.name}" required style="
                width: 100%;
                padding: 10px;
                background: #1e293b;
                border: 1px solid #334155;
                border-radius: 6px;
                color: #fff;
                font-size: 14px;
              ">
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="edit-field">
                <label>Age</label>
                <input type="number" id="edit_age" value="${player.age}" min="18" max="45" required style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              
              <div class="edit-field">
                <label>Position</label>
                <select id="edit_pos" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
                  ${['PG', 'SG', 'SF', 'PF', 'C'].map(pos => `
                    <option value="${pos}" ${player.pos === pos ? 'selected' : ''}>${pos}</option>
                  `).join('')}
                </select>
              </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="edit-field">
                <label>Country</label>
                <input type="text" id="edit_country" value="${player.bio.country || 'USA'}" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              
              <div class="edit-field">
                <label>College</label>
                <input type="text" id="edit_college" value="${player.bio.college || ''}" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
            </div>
            
            <div class="edit-field">
              <label>Team Assignment</label>
              <select id="edit_teamId" style="
                width: 100%;
                padding: 10px;
                background: #1e293b;
                border: 1px solid #334155;
                border-radius: 6px;
                color: #fff;
              ">
                ${teamOptions}
              </select>
              <small style="color: #94a3b8; margin-top: 4px; display: block;">⚠️ Warning: Changing team will update roster assignments</small>
            </div>
          </div>
          
          <!-- Physical Attributes -->
          <div class="edit-section">
            <h3>Physical Attributes</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
              <div class="edit-field">
                <label>Height</label>
                <input type="text" id="edit_height" value="${player.bio.height || '6-6'}" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              
              <div class="edit-field">
                <label>Weight (lbs)</label>
                <input type="number" id="edit_weight" value="${parseInt(player.bio.weight) || 200}" min="150" max="350" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              
              <div class="edit-field">
                <label>Wingspan</label>
                <input type="text" id="edit_wingspan" value="${player.bio.wingspan || '6-10'}" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
            </div>
          </div>
          
          <!-- Ratings -->
          <div class="edit-section">
            <h3>Ratings & Attributes</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="edit-field">
                <label>Overall (OVR)</label>
                <input type="number" id="edit_ovr" value="${player.ratings.ovr}" min="0" max="99" required style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              
              <div class="edit-field">
                <label>Potential (POT)</label>
                <input type="number" id="edit_pot" value="${player.ratings.pot}" min="0" max="99" required style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-top: 12px;">
              <div class="edit-field">
                <label>Shooting</label>
                <input type="number" id="edit_shoot" value="${player.ratings.shoot}" min="0" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              
              <div class="edit-field">
                <label>Defense</label>
                <input type="number" id="edit_defense" value="${player.ratings.defense}" min="0" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              
              <div class="edit-field">
                <label>Rebounding</label>
                <input type="number" id="edit_rebound" value="${player.ratings.rebound}" min="0" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              
              <div class="edit-field">
                <label>Passing</label>
                <input type="number" id="edit_passing" value="${player.ratings.passing}" min="0" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
            </div>
          </div>
          
          <!-- Athletic Attributes -->
          <div class="edit-section">
            <h3>Athletic Attributes</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
              <div class="edit-field">
                <label>Speed</label>
                <input type="number" id="edit_speed" value="${player.attributes?.athletic?.speed || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Acceleration</label>
                <input type="number" id="edit_acceleration" value="${player.attributes?.athletic?.acceleration || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Strength</label>
                <input type="number" id="edit_strength" value="${player.attributes?.athletic?.strength || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Vertical</label>
                <input type="number" id="edit_vertical" value="${player.attributes?.athletic?.vertical || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Lateral Quickness</label>
                <input type="number" id="edit_lateralQuickness" value="${player.attributes?.athletic?.lateralQuickness || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Stamina</label>
                <input type="number" id="edit_stamina" value="${player.attributes?.athletic?.stamina || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Hustle</label>
                <input type="number" id="edit_hustle" value="${player.attributes?.athletic?.hustle || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
            </div>
          </div>
          
          <!-- Offensive Skills -->
          <div class="edit-section">
            <h3>Offensive Skills</h3>
            <h4 style="color: #94a3b8; font-size: 14px; margin: 10px 0;">Scoring</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
              <div class="edit-field">
                <label>Finishing</label>
                <input type="number" id="edit_finishing" value="${player.attributes?.offensive?.scoringSkills?.finishing || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Mid-Range</label>
                <input type="number" id="edit_midRangeShooting" value="${player.attributes?.offensive?.scoringSkills?.midRangeShooting || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Three-Point</label>
                <input type="number" id="edit_threePointShooting" value="${player.attributes?.offensive?.scoringSkills?.threePointShooting || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Free Throw</label>
                <input type="number" id="edit_freeThrowShooting" value="${player.attributes?.offensive?.scoringSkills?.freeThrowShooting || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Post Scoring</label>
                <input type="number" id="edit_postScoring" value="${player.attributes?.offensive?.scoringSkills?.postScoring || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Shot Creation</label>
                <input type="number" id="edit_shotCreation" value="${player.attributes?.offensive?.scoringSkills?.shotCreation || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
            </div>
            
            <h4 style="color: #94a3b8; font-size: 14px; margin: 10px 0;">Playmaking</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px;">
              <div class="edit-field">
                <label>Ball Handling</label>
                <input type="number" id="edit_ballHandling" value="${player.attributes?.offensive?.playmakingSkills?.ballHandling || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Passing Vision</label>
                <input type="number" id="edit_passingVision" value="${player.attributes?.offensive?.playmakingSkills?.passingVision || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Passing Accuracy</label>
                <input type="number" id="edit_passingAccuracy" value="${player.attributes?.offensive?.playmakingSkills?.passingAccuracy || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Off-Ball Movement</label>
                <input type="number" id="edit_offBallMovement" value="${player.attributes?.offensive?.playmakingSkills?.offBallMovement || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
            </div>
          </div>
          
          <!-- Defensive Skills -->
          <div class="edit-section">
            <h3>Defensive Skills</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
              <div class="edit-field">
                <label>Perimeter Defense</label>
                <input type="number" id="edit_perimeterDefense" value="${player.attributes?.defensive?.perimeterDefense || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Interior Defense</label>
                <input type="number" id="edit_interiorDefense" value="${player.attributes?.defensive?.interiorDefense || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Block Rating</label>
                <input type="number" id="edit_blockRating" value="${player.attributes?.defensive?.blockRating || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Steal Rating</label>
                <input type="number" id="edit_stealRating" value="${player.attributes?.defensive?.stealRating || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Def. Rebounding</label>
                <input type="number" id="edit_defensiveRebounding" value="${player.attributes?.defensive?.defensiveRebounding || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Off. Rebounding</label>
                <input type="number" id="edit_offensiveRebounding" value="${player.attributes?.defensive?.offensiveRebounding || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Def. Awareness</label>
                <input type="number" id="edit_defensiveAwareness" value="${player.attributes?.defensive?.defensiveAwareness || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
            </div>
          </div>
          
          <!-- Mental Attributes -->
          <div class="edit-section">
            <h3>Mental Attributes</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
              <div class="edit-field">
                <label>Basketball IQ</label>
                <input type="number" id="edit_basketballIQ" value="${player.attributes?.mental?.basketballIQ || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Consistency</label>
                <input type="number" id="edit_consistency" value="${player.attributes?.mental?.consistency || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Work Ethic</label>
                <input type="number" id="edit_workEthic" value="${player.attributes?.mental?.workEthic || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Leadership</label>
                <input type="number" id="edit_leadership" value="${player.attributes?.mental?.leadership || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Composure</label>
                <input type="number" id="edit_composure" value="${player.attributes?.mental?.composure || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Discipline</label>
                <input type="number" id="edit_discipline" value="${player.attributes?.mental?.discipline || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Clutch</label>
                <input type="number" id="edit_clutch" value="${player.attributes?.mental?.clutch || 70}" min="40" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
            </div>
          </div>
          
          <!-- Personality Attributes -->
          <div class="edit-section">
            <h3>Personality Traits</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
              <div class="edit-field">
                <label>Loyalty</label>
                <input type="number" id="edit_loyalty" value="${player.personality?.loyalty || 70}" min="30" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Money Focus</label>
                <input type="number" id="edit_moneyFocus" value="${player.personality?.moneyFocus || 70}" min="30" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Winning Drive</label>
                <input type="number" id="edit_winningDrive" value="${player.personality?.winningDrive || 70}" min="30" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Ego</label>
                <input type="number" id="edit_ego" value="${player.personality?.ego || 70}" min="30" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              <div class="edit-field">
                <label>Temperament</label>
                <input type="number" id="edit_temperament" value="${player.personality?.temperament || 70}" min="30" max="99" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
            </div>
          </div>
          
          <!-- Contract -->
          <div class="edit-section">
            <h3>Contract Details</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="edit-field">
                <label>Annual Salary ($M)</label>
                <input type="number" id="edit_salary" value="${player.contract.amount}" min="0" max="50" step="0.1" required style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              
              <div class="edit-field">
                <label>Years Remaining</label>
                <input type="number" id="edit_contractYears" value="${player.contract.yearsRemaining || Math.max(0, player.contract.exp - league.season)}" min="0" max="7" required style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px;">
              <div class="edit-field">
                <label>
                  <input type="checkbox" id="edit_playerOption" ${player.contract.hasPlayerOption ? 'checked' : ''}>
                  Player Option
                </label>
              </div>
              
              <div class="edit-field">
                <label>
                  <input type="checkbox" id="edit_teamOption" ${player.contract.hasTeamOption ? 'checked' : ''}>
                  Team Option
                </label>
              </div>
            </div>
            
            <div class="edit-field" style="margin-top: 12px;">
              <label>Guaranteed %</label>
              <input type="number" id="edit_guaranteed" value="${player.contract.guaranteed || 100}" min="0" max="100" step="1" style="
                width: 100%;
                padding: 10px;
                background: #1e293b;
                border: 1px solid #334155;
                border-radius: 6px;
                color: #fff;
              ">
              <small style="color: #94a3b8; margin-top: 4px; display: block;">0% = Non-guaranteed, 100% = Fully guaranteed</small>
            </div>
          </div>
          
          <!-- Draft Info -->
          <div class="edit-section">
            <h3>Draft Information</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
              <div class="edit-field">
                <label>Draft Year</label>
                <input type="number" id="edit_draftYear" value="${player.draft.year || ''}" min="1950" max="2050" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              
              <div class="edit-field">
                <label>Round</label>
                <input type="number" id="edit_draftRound" value="${player.draft.round || ''}" min="1" max="5" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
              
              <div class="edit-field">
                <label>Pick</label>
                <input type="number" id="edit_draftPick" value="${player.draft.pick || ''}" min="1" max="60" style="
                  width: 100%;
                  padding: 10px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  color: #fff;
                ">
              </div>
            </div>
            
            <div class="edit-field" style="margin-top: 12px;">
              <label>Drafted By Team</label>
              <select id="edit_draftedByTid" style="
                width: 100%;
                padding: 10px;
                background: #1e293b;
                border: 1px solid #334155;
                border-radius: 6px;
                color: #fff;
              ">
                <option value="null">Undrafted</option>
                ${league.teams.map(t => `
                  <option value="${t.id}" ${player.draft.draftedByTid === t.id || player.draft.tid === t.id ? 'selected' : ''}>
                    ${t.name}
                  </option>
                `).join('')}
              </select>
              <small style="color: #94a3b8; margin-top: 4px; display: block;">⚠️ Must be a valid team - never "Unknown Team" or "Free Agent"</small>
            </div>
          </div>
          
          <!-- Action Buttons -->
          <div style="display: flex; gap: 12px; margin-top: 24px; padding-top: 20px; border-top: 2px solid #334155;">
            <button type="submit" style="
              flex: 1;
              padding: 14px;
              background: #10b981;
              color: white;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-weight: bold;
              font-size: 16px;
            ">💾 Save Changes</button>
            
            <button type="button" onclick="closeEditPlayerModal()" style="
              flex: 1;
              padding: 14px;
              background: #6b7280;
              color: white;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-weight: bold;
              font-size: 16px;
            ">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeEditPlayerModal() {
  const modal = document.getElementById('editPlayerModal');
  if (modal) modal.remove();
}

function savePlayerEdits(event, playerId) {
  event.preventDefault();
  
  // Security guard
  if (!isCommissionerMode()) {
    alert('⚠️ Commissioner Mode must be enabled to save edits.');
    return;
  }
  
  // Find player
  let player = null;
  let oldTeam = null;
  
  for (let team of league.teams) {
    const p = team.players.find(pl => pl.id === playerId);
    if (p) {
      player = p;
      oldTeam = team;
      break;
    }
  }
  
  if (!player) {
    player = league.freeAgents.find(p => p.id === playerId);
  }
  
  if (!player) {
    alert('Player not found');
    return;
  }
  
  // Collect form values
  const formData = {
    name: document.getElementById('edit_name').value.trim(),
    age: parseInt(document.getElementById('edit_age').value),
    pos: document.getElementById('edit_pos').value,
    country: document.getElementById('edit_country').value.trim(),
    college: document.getElementById('edit_college').value.trim(),
    teamId: document.getElementById('edit_teamId').value === 'null' ? null : parseInt(document.getElementById('edit_teamId').value),
    height: document.getElementById('edit_height').value.trim(),
    weight: parseInt(document.getElementById('edit_weight').value),
    wingspan: document.getElementById('edit_wingspan').value.trim(),
    ovr: parseInt(document.getElementById('edit_ovr').value),
    pot: parseInt(document.getElementById('edit_pot').value),
    shoot: parseInt(document.getElementById('edit_shoot').value),
    defense: parseInt(document.getElementById('edit_defense').value),
    rebound: parseInt(document.getElementById('edit_rebound').value),
    passing: parseInt(document.getElementById('edit_passing').value),
    // Athletic
    speed: parseInt(document.getElementById('edit_speed').value),
    acceleration: parseInt(document.getElementById('edit_acceleration').value),
    strength: parseInt(document.getElementById('edit_strength').value),
    vertical: parseInt(document.getElementById('edit_vertical').value),
    lateralQuickness: parseInt(document.getElementById('edit_lateralQuickness').value),
    stamina: parseInt(document.getElementById('edit_stamina').value),
    hustle: parseInt(document.getElementById('edit_hustle').value),
    // Offensive Skills
    finishing: parseInt(document.getElementById('edit_finishing').value),
    midRangeShooting: parseInt(document.getElementById('edit_midRangeShooting').value),
    threePointShooting: parseInt(document.getElementById('edit_threePointShooting').value),
    freeThrowShooting: parseInt(document.getElementById('edit_freeThrowShooting').value),
    postScoring: parseInt(document.getElementById('edit_postScoring').value),
    shotCreation: parseInt(document.getElementById('edit_shotCreation').value),
    ballHandling: parseInt(document.getElementById('edit_ballHandling').value),
    passingVision: parseInt(document.getElementById('edit_passingVision').value),
    passingAccuracy: parseInt(document.getElementById('edit_passingAccuracy').value),
    offBallMovement: parseInt(document.getElementById('edit_offBallMovement').value),
    // Defensive Skills
    perimeterDefense: parseInt(document.getElementById('edit_perimeterDefense').value),
    interiorDefense: parseInt(document.getElementById('edit_interiorDefense').value),
    blockRating: parseInt(document.getElementById('edit_blockRating').value),
    stealRating: parseInt(document.getElementById('edit_stealRating').value),
    defensiveRebounding: parseInt(document.getElementById('edit_defensiveRebounding').value),
    offensiveRebounding: parseInt(document.getElementById('edit_offensiveRebounding').value),
    defensiveAwareness: parseInt(document.getElementById('edit_defensiveAwareness').value),
    // Mental
    basketballIQ: parseInt(document.getElementById('edit_basketballIQ').value),
    consistency: parseInt(document.getElementById('edit_consistency').value),
    workEthic: parseInt(document.getElementById('edit_workEthic').value),
    leadership: parseInt(document.getElementById('edit_leadership').value),
    composure: parseInt(document.getElementById('edit_composure').value),
    discipline: parseInt(document.getElementById('edit_discipline').value),
    clutch: parseInt(document.getElementById('edit_clutch').value),
    // Personality
    loyalty: parseInt(document.getElementById('edit_loyalty').value),
    moneyFocus: parseInt(document.getElementById('edit_moneyFocus').value),
    winningDrive: parseInt(document.getElementById('edit_winningDrive').value),
    ego: parseInt(document.getElementById('edit_ego').value),
    temperament: parseInt(document.getElementById('edit_temperament').value),
    // Contract & Draft
    salary: parseFloat(document.getElementById('edit_salary').value),
    contractYears: parseInt(document.getElementById('edit_contractYears').value),
    playerOption: document.getElementById('edit_playerOption').checked,
    teamOption: document.getElementById('edit_teamOption').checked,
    guaranteed: parseInt(document.getElementById('edit_guaranteed').value),
    draftYear: document.getElementById('edit_draftYear').value ? parseInt(document.getElementById('edit_draftYear').value) : null,
    draftRound: document.getElementById('edit_draftRound').value ? parseInt(document.getElementById('edit_draftRound').value) : null,
    draftPick: document.getElementById('edit_draftPick').value ? parseInt(document.getElementById('edit_draftPick').value) : null,
    draftedByTid: document.getElementById('edit_draftedByTid').value === 'null' ? null : parseInt(document.getElementById('edit_draftedByTid').value)
  };
  
  // Validation
  if (!formData.name || formData.name.length < 2) {
    alert('⚠️ Player name must be at least 2 characters');
    return;
  }
  
  if (formData.age < 18 || formData.age > 45) {
    alert('⚠️ Age must be between 18 and 45');
    return;
  }
  
  if (formData.ovr < 0 || formData.ovr > 99) {
    alert('⚠️ Overall rating must be between 0 and 99');
    return;
  }
  
  if (formData.pot < 0 || formData.pot > 99) {
    alert('⚠️ Potential rating must be between 0 and 99');
    return;
  }
  
  if (formData.guaranteed < 0 || formData.guaranteed > 100) {
    alert('⚠️ Guaranteed percentage must be between 0 and 100');
    return;
  }
  
  // Validate draft info consistency
  const hasDraftYear = formData.draftYear !== null;
  const hasDraftRound = formData.draftRound !== null;
  const hasDraftPick = formData.draftPick !== null;
  
  if ((hasDraftYear || hasDraftRound || hasDraftPick) && !(hasDraftYear && hasDraftRound && hasDraftPick)) {
    alert('⚠️ Draft info must be complete (Year, Round, Pick) or all empty for undrafted');
    return;
  }
  
  // Validate draftedByTid is a real team if drafted
  if (hasDraftYear && formData.draftedByTid !== null) {
    const draftTeamExists = league.teams.some(t => t.id === formData.draftedByTid);
    if (!draftTeamExists) {
      alert('⚠️ Drafted by team must be a valid team from the league');
      return;
    }
  }
  
  // Initialize nested structures if missing
  if (!player.attributes) {
    player.attributes = {
      athletic: {},
      offensive: {
        scoringSkills: {},
        playmakingSkills: {}
      },
      defensive: {},
      mental: {}
    };
  }
  if (!player.attributes.athletic) player.attributes.athletic = {};
  if (!player.attributes.offensive) player.attributes.offensive = {};
  if (!player.attributes.offensive.scoringSkills) player.attributes.offensive.scoringSkills = {};
  if (!player.attributes.offensive.playmakingSkills) player.attributes.offensive.playmakingSkills = {};
  if (!player.attributes.defensive) player.attributes.defensive = {};
  if (!player.attributes.mental) player.attributes.mental = {};
  if (!player.personality) player.personality = {};
  
  // Apply basic edits
  player.name = formData.name;
  player.age = formData.age;
  player.pos = formData.pos;
  player.bio.country = formData.country;
  player.bio.college = formData.college;
  player.bio.height = formData.height;
  player.bio.weight = formData.weight;
  player.bio.wingspan = formData.wingspan;
  player.ratings.ovr = formData.ovr;
  player.ratings.pot = formData.pot;
  player.ratings.shoot = formData.shoot;
  player.ratings.defense = formData.defense;
  player.ratings.rebound = formData.rebound;
  player.ratings.passing = formData.passing;
  
  // Apply athletic attributes
  player.attributes.athletic.speed = formData.speed;
  player.attributes.athletic.acceleration = formData.acceleration;
  player.attributes.athletic.strength = formData.strength;
  player.attributes.athletic.vertical = formData.vertical;
  player.attributes.athletic.lateralQuickness = formData.lateralQuickness;
  player.attributes.athletic.stamina = formData.stamina;
  player.attributes.athletic.hustle = formData.hustle;
  
  // Apply offensive scoring skills
  player.attributes.offensive.scoringSkills.finishing = formData.finishing;
  player.attributes.offensive.scoringSkills.midRange = formData.midRangeShooting;
  player.attributes.offensive.scoringSkills.threePoint = formData.threePointShooting;
  player.attributes.offensive.scoringSkills.freeThrow = formData.freeThrowShooting;
  player.attributes.offensive.scoringSkills.postScoring = formData.postScoring;
  player.attributes.offensive.scoringSkills.shotCreation = formData.shotCreation;
  
  // Apply offensive playmaking skills
  player.attributes.offensive.playmakingSkills.ballHandling = formData.ballHandling;
  player.attributes.offensive.playmakingSkills.passingVision = formData.passingVision;
  player.attributes.offensive.playmakingSkills.passingAccuracy = formData.passingAccuracy;
  player.attributes.offensive.playmakingSkills.offBallMovement = formData.offBallMovement;
  
  // Apply defensive attributes
  player.attributes.defensive.perimeterDefense = formData.perimeterDefense;
  player.attributes.defensive.interiorDefense = formData.interiorDefense;
  player.attributes.defensive.blockRating = formData.blockRating;
  player.attributes.defensive.stealRating = formData.stealRating;
  player.attributes.defensive.defensiveRebounding = formData.defensiveRebounding;
  player.attributes.defensive.offensiveRebounding = formData.offensiveRebounding;
  player.attributes.defensive.defensiveAwareness = formData.defensiveAwareness;
  
  // Apply mental attributes
  player.attributes.mental.basketballIQ = formData.basketballIQ;
  player.attributes.mental.consistency = formData.consistency;
  player.attributes.mental.workEthic = formData.workEthic;
  player.attributes.mental.leadership = formData.leadership;
  player.attributes.mental.composure = formData.composure;
  player.attributes.mental.discipline = formData.discipline;
  player.attributes.mental.clutch = formData.clutch;
  
  // Apply personality traits
  player.personality.loyalty = formData.loyalty;
  player.personality.moneyFocus = formData.moneyFocus;
  player.personality.winningDrive = formData.winningDrive;
  player.personality.ego = formData.ego;
  player.personality.temperament = formData.temperament;
  
  // Apply contract details
  player.contract.amount = formData.salary;
  player.contract.yearsRemaining = formData.contractYears;
  player.contract.exp = league.season + formData.contractYears;
  player.contract.totalValue = formData.salary * formData.contractYears;
  player.contract.hasPlayerOption = formData.playerOption;
  player.contract.hasTeamOption = formData.teamOption;
  player.contract.guaranteed = formData.guaranteed;
  player.contract.isTrainingCamp = formData.guaranteed === 0;
  
  // Apply draft details
  player.draft.year = formData.draftYear;
  player.draft.round = formData.draftRound;
  player.draft.pick = formData.draftPick;
  player.draft.draftedByTid = formData.draftedByTid;
  player.draft.tid = formData.draftedByTid; // Backwards compatibility
  
  // Handle team change
  if (formData.teamId !== (oldTeam ? oldTeam.id : null)) {
    // Remove from old team
    if (oldTeam) {
      oldTeam.players = oldTeam.players.filter(p => p.id !== player.id);
      updateTeamPayrolls();
    } else {
      // Remove from free agents
      league.freeAgents = league.freeAgents.filter(p => p.id !== player.id);
    }
    
    // Add to new team
    if (formData.teamId !== null) {
      const newTeam = league.teams.find(t => t.id === formData.teamId);
      if (newTeam) {
        newTeam.players.push(player);
        player.teamId = newTeam.id;
        updateTeamPayrolls();
      }
    } else {
      // Move to free agents
      league.freeAgents.push(player);
      player.teamId = null;
    }
  }
  
  // Log commissioner action
  if (typeof logCommissionerAction === 'function') {
    logCommissionerAction('edit_player', {
      playerId: player.id,
      playerName: player.name,
      changes: Object.keys(formData)
    });
  }
  
  // Invalidate strength cache for point spreads
  incrementStrengthVersion();
  
  // Save to database
  saveLeagueState();
  
  // Close modal and refresh UI
  closeEditPlayerModal();
  render();
  
  // Show success toast
  showToast('✅ ' + player.name + ' updated successfully!');
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 9999;
    font-weight: bold;
    animation: slideIn 0.3s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ============================
   WELCOME OVERLAY
============================ */

function openWelcomeOverlay() {
  if (!league) return;
  
  // Don't show if already seen
  if (league.meta?.hasSeenWelcome) {
    render();
    return;
  }
  
  const team = league.teams.find(t => t.id === selectedTeamId);
  const teamCity = team?.city || 'your';
  const teamName = team?.name || 'team';
  const leagueName = league.name || 'Hoops Dynasty';
  const seasonYear = league.season || new Date().getFullYear();
  
  const content = `
    <div class="welcome-header">
      <span class="welcome-trophy">🏆</span>
      <h1 class="welcome-title">Welcome to ${leagueName}!</h1>
      <p class="welcome-subtitle">From the Office of the League Commissioner</p>
    </div>
    
    <div class="welcome-body">
      <p class="welcome-greeting">Congratulations on taking control of the ${teamName}!</p>
      
      <p class="welcome-text">
        As General Manager, you now hold the keys to this franchise's future. Your decisions will shape the roster, 
        drive the team's success, and determine whether this city celebrates a championship or endures another 
        rebuilding season.
      </p>
      
      <p class="welcome-text">
        You'll manage player contracts, navigate the salary cap, orchestrate trades, scout the draft, and build 
        a winning culture. Every move matters—from your starting lineup to your coaching staff, from free agent 
        signings to development of young talent.
      </p>
      
      <p class="welcome-text">
        The front office has full confidence in your vision. The coaching staff is ready to execute your game plan. 
        The fans are hungry for success. Now it's time to prove you have what it takes to build a dynasty.
      </p>
      
      <p class="welcome-italic">
        The city is counting on you. Let's bring a championship home.
      </p>
      
      <div class="welcome-signature">
        <p class="welcome-regards">Best regards,</p>
        <p class="welcome-from">Commissioner's Office</p>
        <p class="welcome-meta">${leagueName} • Season ${seasonYear}</p>
      </div>
    </div>
    
    <div class="welcome-footer">
      <button class="welcome-cta" onclick="closeWelcomeOverlay()">
        Let's Get Started →
      </button>
    </div>
  `;
  
  document.getElementById('welcomeContent').innerHTML = content;
  document.getElementById('welcomeOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeWelcomeOverlay() {
  if (!league) return;
  
  // Mark as seen
  if (!league.meta) {
    league.meta = {};
  }
  league.meta.hasSeenWelcome = true;
  
  // Close overlay
  document.getElementById('welcomeOverlay').classList.add('hidden');
  document.body.style.overflow = '';
  
  // Save and render dashboard
  save();
  render();
}

/* ============================
   COACH MODAL
============================ */

function showCoachModal(teamId) {
  const team = league.teams.find(t => t.id === teamId);
  if (!team || !team.coach) {
    alert('No coach assigned to this team.');
    return;
  }
  
  const coach = team.coach;
  const winPct = coach.careerStats.wins + coach.careerStats.losses > 0
    ? ((coach.careerStats.wins / (coach.careerStats.wins + coach.careerStats.losses)) * 100).toFixed(1)
    : '0.0';
  
  const isUserTeam = team.id === selectedTeamId;
  
  const content = `
    <div class="modal-header">
      <h2 class="modal-title">👔 Head Coach Profile</h2>
      <button class="modal-close" onclick="closePlayerModal()">×</button>
    </div>
    
    <div class="coach-profile">
      <div class="coach-header">
        <div class="coach-avatar">👤</div>
        <div class="coach-header-info">
          <h3 class="coach-name">${coach.name}</h3>
          <div class="coach-role">Head Coach • ${team.name}</div>
          <div class="coach-meta">Age ${coach.age} • ${coach.experience} Years Experience</div>
          <div class="coach-overall-badge">Overall: ${coach.ratings.overall}</div>
        </div>
      </div>
      
      <div class="coach-section">
        <h4 class="coach-section-title">📊 Career Statistics</h4>
        <div class="coach-stats-grid">
          <div class="coach-stat-box">
            <div class="coach-stat-value">${coach.careerStats.wins}-${coach.careerStats.losses}</div>
            <div class="coach-stat-label">Career Record</div>
          </div>
          <div class="coach-stat-box">
            <div class="coach-stat-value">${winPct}%</div>
            <div class="coach-stat-label">Win Percentage</div>
          </div>
          <div class="coach-stat-box">
            <div class="coach-stat-value">${coach.careerStats.championships}</div>
            <div class="coach-stat-label">Championships</div>
          </div>
        </div>
      </div>
      
      <div class="coach-section">
        <h4 class="coach-section-title">⚡ Coaching Ratings</h4>
        <div class="coach-ratings-list">
          ${createCoachRatingBar('Offense', coach.ratings.offense)}
          ${createCoachRatingBar('Defense', coach.ratings.defense)}
          ${createCoachRatingBar('Player Development', coach.ratings.playerDevelopment)}
          ${createCoachRatingBar('Management', coach.ratings.management)}
          ${createCoachRatingBar('Motivation', coach.ratings.motivation)}
          ${createCoachRatingBar('Clutch', coach.ratings.clutch)}
          ${createCoachRatingBar('Adaptability', coach.ratings.adaptability)}
        </div>
      </div>
      
      <div class="coach-section">
        <h4 class="coach-section-title">🧠 Personality Traits</h4>
        <div class="coach-personality-grid">
          ${createPersonalityBar('Patience', coach.personality.patience)}
          ${createPersonalityBar('Intensity', coach.personality.intensity)}
          ${createPersonalityBar('Loyalty', coach.personality.loyalty)}
          ${createPersonalityBar('Innovation', coach.personality.innovation)}
          ${createPersonalityBar('Communication', coach.personality.communication)}
          ${createPersonalityBar('Discipline', coach.personality.discipline)}
          ${createPersonalityBar('Confidence', coach.personality.confidence)}
        </div>
      </div>
      
      <div class="coach-section">
        <h4 class="coach-section-title">📝 Contract</h4>
        <div class="coach-contract-info">
          <div class="coach-contract-row">
            <span>Years Remaining:</span>
            <strong>${coach.contract.yearsRemaining} years</strong>
          </div>
          <div class="coach-contract-row">
            <span>Annual Salary:</span>
            <strong>$${coach.contract.annualSalary.toFixed(1)}M</strong>
          </div>
        </div>
      </div>
      
      ${isUserTeam ? `
        <div class="coach-actions">
          <button class="btn-danger" onclick="fireCoach(${team.id}); closeModal(event);">
            Fire Coach
          </button>
        </div>
      ` : ''}
    </div>
  `;
  
  document.getElementById('modalContent').innerHTML = content;
  document.getElementById('playerModal').classList.add('active');
}

function createCoachRatingBar(label, value) {
  const percentage = (value / 100) * 100;
  let color = '#ef4444'; // red
  if (value >= 70) color = '#22c55e'; // green
  else if (value >= 55) color = '#eab308'; // yellow
  
  return `
    <div class="coach-rating-row">
      <div class="coach-rating-label">${label}</div>
      <div class="coach-rating-bar-container">
        <div class="coach-rating-bar" style="width: ${percentage}%; background: ${color};"></div>
      </div>
      <div class="coach-rating-value">${value}</div>
    </div>
  `;
}

function createPersonalityBar(label, value) {
  const percentage = (value / 10) * 100;
  return `
    <div class="coach-personality-row">
      <div class="coach-personality-label">${label}</div>
      <div class="coach-personality-bar-container">
        <div class="coach-personality-bar" style="width: ${percentage}%;"></div>
      </div>
      <div class="coach-personality-value">${value}/10</div>
    </div>
  `;
}

/* ============================
   INITIALIZATION
============================ */

// Removed: initializeApp() is now called from index.html DOMContentLoaded

// Add escape key handler for sidebar
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (sidebarOpen) {
      closeSidebar();
    } else if (document.getElementById('playerModal').classList.contains('active')) {
      closePlayerModal();
    }
  }
});

// Initialize coaches for existing leagues (migration helper)
function ensureCoachesExist() {
  if (!league) return;
  
  league.teams.forEach(team => {
    if (!team.coach) {
      team.coach = makeCoach(rand(0, 15));
    }
    if (team.morale === undefined) {
      team.morale = 75;
    }
  });
}

/* ============================
   SIM CONTROL FUNCTIONALITY
============================ */

// Initialize sim mode on league load
function initializeSimMode() {
  if (!league) return;
  
  // Set default sim mode if not present
  if (!league.simMode) {
    league.simMode = 'oneDay';
  }
  
  // Update UI to reflect stored mode
  updateSimModeUI(league.simMode);
  updateSimStatusLabel();
}

// Toggle sim dropdown menu
function toggleSimDropdown() {
  const menu = document.getElementById('simDropdownMenu');
  if (!menu) return;
  
  menu.classList.toggle('show');
  
  // Close on outside click
  if (menu.classList.contains('show')) {
    setTimeout(() => {
      document.addEventListener('click', closeSimDropdownOnOutsideClick);
      document.addEventListener('keydown', closeSimDropdownOnEsc);
    }, 0);
  } else {
    document.removeEventListener('click', closeSimDropdownOnOutsideClick);
    document.removeEventListener('keydown', closeSimDropdownOnEsc);
  }
}

function closeSimDropdownOnOutsideClick(e) {
  const menu = document.getElementById('simDropdownMenu');
  const toggle = document.getElementById('simDropdownToggle');
  
  if (menu && !menu.contains(e.target) && !toggle.contains(e.target)) {
    menu.classList.remove('show');
    document.removeEventListener('click', closeSimDropdownOnOutsideClick);
    document.removeEventListener('keydown', closeSimDropdownOnEsc);
  }
}

function closeSimDropdownOnEsc(e) {
  if (e.key === 'Escape') {
    const menu = document.getElementById('simDropdownMenu');
    if (menu) {
      menu.classList.remove('show');
      document.removeEventListener('click', closeSimDropdownOnOutsideClick);
      document.removeEventListener('keydown', closeSimDropdownOnEsc);
    }
  }
}

// Select a sim mode
function selectSimMode(mode) {
  if (!league) return;
  
  league.simMode = mode;
  updateSimModeUI(mode);
  
  // Close dropdown
  const menu = document.getElementById('simDropdownMenu');
  if (menu) {
    menu.classList.remove('show');
  }
  
  document.removeEventListener('click', closeSimDropdownOnOutsideClick);
  document.removeEventListener('keydown', closeSimDropdownOnEsc);
  
  // Save league state
  saveLeague();
}

// Update UI to show selected mode
function updateSimModeUI(mode) {
  const modes = ['oneDay', 'oneWeek', 'oneMonth', 'tradeDeadline', 'allStar', 'playoffs'];
  
  modes.forEach(m => {
    const checkmark = document.getElementById('check-' + m);
    if (checkmark) {
      checkmark.textContent = m === mode ? '' : '';
    }
  });
}

// Update status label
function updateSimStatusLabel(customText) {
  const label = document.getElementById('simStatusLabel');
  if (!label) return;
  
  if (customText) {
    label.textContent = customText;
    return;
  }
  
  if (!league) {
    label.textContent = 'No League';
    return;
  }
  
  // Check if simulation is paused
  if (league.simulation?.isPaused) {
    const reason = getPauseReasonText(league.simulation.pauseReason);
    label.textContent = `⏸️ PAUSED: ${reason}`;
    label.style.color = '#f39c12';
    return;
  }
  
  // Reset color
  label.style.color = '#888';
  
  const season = league.season || new Date().getFullYear();
  const phase = league.phase || 'PRESEASON';
  
  // Get game progress
  let gameInfo = '';
  if (league.schedule?.days?.[season]) {
    const totalDays = league.schedule.days[season].length;
    const currentDay = league.schedule.currentDay || 1;
    const gamesPlayed = Math.min(currentDay - 1, totalDays);
    gameInfo = ` · Game ${gamesPlayed}/${totalDays}`;
  }
  
  // Format phase name
  let phaseText = phase.charAt(0).toUpperCase() + phase.slice(1).toLowerCase().replace(/_/g, ' ');
  
  label.textContent = `${season} ${phaseText}${gameInfo} · Idle`;
}

// Execute simulation based on selected mode
/* ============================
   EVENT-DRIVEN SIMULATION CONTROLS
============================ */

async function executeSimGame() {
  if (!league) {
    alert('No league loaded');
    return;
  }
  
  disableSimButtons();
  updateSimStatusLabel('Simulating...');
  
  try {
    const result = await simOneGame();
    handleSimulationResult(result);
  } catch (error) {
    console.error('Simulation error:', error);
    alert('Simulation error: ' + error.message);
  } finally {
    enableSimButtons();
    updateSimStatusLabel();
    save();
    render();
  }
}

async function executeSimUntilEvent() {
  if (!league) {
    alert('No league loaded');
    return;
  }
  
  disableSimButtons();
  updateSimStatusLabel('Simulating until next event...');
  
  try {
    const result = await simUntilNextEvent();
    handleSimulationResult(result);
  } catch (error) {
    console.error('Simulation error:', error);
    alert('Simulation error: ' + error.message);
  } finally {
    enableSimButtons();
    updateSimStatusLabel();
    save();
    render();
  }
}

async function executeSimWeek() {
  if (!league) {
    alert('No league loaded');
    return;
  }
  
  disableSimButtons();
  updateSimStatusLabel('Simulating week...');
  
  try {
    const result = await simWeek();
    handleSimulationResult(result);
  } catch (error) {
    console.error('Simulation error:', error);
    alert('Simulation error: ' + error.message);
  } finally {
    enableSimButtons();
    updateSimStatusLabel();
    save();
    render();
  }
}

async function executeSimMonth() {
  if (!league) {
    alert('No league loaded');
    return;
  }
  
  disableSimButtons();
  updateSimStatusLabel('Simulating month...');
  
  try {
    const result = await simMonth();
    handleSimulationResult(result);
  } catch (error) {
    console.error('Simulation error:', error);
    alert('Simulation error: ' + error.message);
  } finally {
    enableSimButtons();
    updateSimStatusLabel();
    save();
    render();
  }
}

async function executeSimSeason() {
  if (!league) {
    alert('No league loaded');
    return;
  }
  
  const confirm = window.confirm('Simulate entire season? This will process all remaining games.');
  if (!confirm) return;
  
  disableSimButtons();
  updateSimStatusLabel('Simulating season...');
  
  try {
    const result = await simSeason();
    handleSimulationResult(result);
    
    // Show completion message
    if (result.complete) {
      const gamesSimmed = league.simulation?.gamesSimulated || 0;
      alert(`Season complete! Simulated ${gamesSimmed} games.`);
    }
  } catch (error) {
    console.error('Simulation error:', error);
    alert('Simulation error: ' + error.message);
  } finally {
    enableSimButtons();
    updateSimStatusLabel();
    save();
    render();
  }
}

async function executeResumeSimulation() {
  if (!league?.simulation?.isPaused) {
    alert('No paused simulation to resume');
    return;
  }
  
  disableSimButtons();
  updateSimStatusLabel('Resuming...');
  
  try {
    const result = await resumeSimulation();
    handleSimulationResult(result);
  } catch (error) {
    console.error('Simulation error:', error);
    alert('Simulation error: ' + error.message);
  } finally {
    enableSimButtons();
    updateSimStatusLabel();
    save();
    render();
  }
}

function handleSimulationResult(result) {
  if (!result) return;
  
  if (result.paused) {
    // Simulation paused - show pause indicator
    showPauseIndicator(result);
    showResumeButton();
  } else if (result.complete) {
    // Simulation complete
    hideResumeButton();
    if (result.message) {
      showNotification(result.message, 'success');
    }
  } else if (!result.success) {
    // Error
    hideResumeButton();
    showNotification(result.error || 'Simulation failed', 'error');
  }
}

function showPauseIndicator(result) {
  const statusLabel = document.getElementById('simStatusLabel');
  if (statusLabel) {
    const reasonText = getPauseReasonText(result.reason);
    statusLabel.textContent = `⏸️ PAUSED: ${reasonText}`;
    statusLabel.style.color = '#f39c12';
  }
  
  // Show modal/notification if needed
  if (result.reason === 'TRADE_OFFER') {
    showTradeOfferModal(result.data);
  } else if (result.reason === 'PHASE_TRANSITION') {
    showNotification(result.message, 'info');
  } else if (result.reason === 'TRADE_DEADLINE') {
    showNotification(result.message, 'warning');
  } else {
    showNotification(result.message || 'Simulation paused', 'info');
  }
}

function getPauseReasonText(reason) {
  const reasons = {
    TRADE_OFFER: 'Trade Offer',
    TRADE_DEADLINE: 'Trade Deadline',
    PHASE_TRANSITION: 'Phase Change',
    ALL_STAR_VOTING: 'All-Star Voting',
    CONTRACT_OPTION: 'Contract Decision',
    INJURY: 'Major Injury',
    PLAYOFF_CLINCH: 'Playoff Clinch'
  };
  return reasons[reason] || 'Event';
}

function showResumeButton() {
  const resumeBtn = document.getElementById('resumeButton');
  if (resumeBtn) {
    resumeBtn.style.display = 'inline-flex';
  }
}

function hideResumeButton() {
  const resumeBtn = document.getElementById('resumeButton');
  if (resumeBtn) {
    resumeBtn.style.display = 'none';
  }
}

function disableSimButtons() {
  ['simGameButton', 'simEventButton', 'simWeekButton', 'simMonthButton', 'simSeasonButton'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = true;
  });
}

function enableSimButtons() {
  ['simGameButton', 'simEventButton', 'simWeekButton', 'simMonthButton', 'simSeasonButton'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = false;
  });
}

function showNotification(message, type = 'info') {
  // Simple notification (can be enhanced with a toast system)
  const colors = {
    success: '#27ae60',
    error: '#e74c3c',
    warning: '#f39c12',
    info: '#3498db'
  };
  
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: ${colors[type]};
    color: white;
    padding: 15px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    font-weight: 500;
    max-width: 300px;
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

/* ============================
   LEGACY SIMULATION FUNCTIONS (DEPRECATED)
============================ */

// Keep old functions for backwards compatibility but mark as deprecated
async function executeSimulation() {
  console.warn('executeSimulation() is deprecated - use event-driven sim functions');
  await executeSimUntilEvent();
}

function initializeSimMode() {
  // No longer needed with event-driven system
  console.log('[SIM] Event-driven simulation initialized');
}

function selectSimMode(mode) {
  // No longer needed - kept for compatibility
  console.warn('selectSimMode() is deprecated');
}

function updateSimModeUI(mode) {
  // No longer needed - kept for compatibility
}

function toggleSimDropdown() {
  // No longer needed - kept for compatibility
}

// Sim functions (UI control only - no data modification)
async function simOneDay() {
  // Placeholder: This would advance one day in the schedule
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('Simulated one day');
}

async function simOneWeek() {
  // Placeholder: This would advance one week
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('Simulated one week');
}

async function simOneMonth() {
  // Placeholder: This would advance one month
  await new Promise(resolve => setTimeout(resolve, 1500));
  console.log('Simulated one month');
}

async function simUntilTradeDeadline() {
  // Placeholder: This would sim until trade deadline
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('Simulated until trade deadline');
}

async function simUntilAllStar() {
  // Placeholder: This would sim until All-Star events
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('Simulated until All-Star events');
}

async function simUntilPlayoffs() {
  // Placeholder: This would sim until playoffs
  await new Promise(resolve => setTimeout(resolve, 2500));
  console.log('Simulated until playoffs');
}

/* ============================
   RIVALRY UI COMPONENTS
============================ */

/**
 * Get rivalry color based on score
 */
function getRivalryColor(score) {
  if (score >= 80) return '#FF4444'; // Very Hot - Red
  if (score >= 60) return '#FF8844'; // Hot - Orange
  if (score >= 40) return '#FFD700'; // Warm - Yellow
  if (score >= 20) return '#88CCFF'; // Cold - Light Blue
  return '#AAAAAA'; // Ice Cold - Gray
}

/**
 * Render rivalry meter bar
 */
function renderRivalryMeter(score, label) {
  const color = getRivalryColor(score);
  const percentage = score;
  
  return `
    <div class="rivalry-meter-container">
      <div class="rivalry-meter-bar">
        <div class="rivalry-meter-fill" style="width: ${percentage}%; background: ${color};"></div>
      </div>
      <div class="rivalry-meter-label" style="color: ${color};">${label}</div>
    </div>
  `;
}

/**
 * Render rivalry badge for schedule/game displays
 */
function renderRivalryBadge(score, label) {
  if (score < 40) return ''; // Only show for Warm or higher
  
  const color = getRivalryColor(score);
  return `
    <span class="rivalry-badge" style="background: ${color}20; color: ${color}; border-color: ${color};">
      🔥 ${label}
    </span>
  `;
}

/**
 * Render Top Rivals card for team page/standings
 */
async function renderTopRivalsCard(teamId) {
  if (!teamId) return '';
  
  const rivalries = await getTeamRivalries(teamId);
  
  if (!rivalries || rivalries.length === 0) {
    return `
      <div class="rivals-card">
        <h3 class="rivals-title">🔥 Top Rivals</h3>
        <div class="rivals-empty">
          <p>No rivalries yet. Play more games to develop rivalries!</p>
        </div>
      </div>
    `;
  }
  
  const topRivals = rivalries.slice(0, 5);
  const team = league.teams.find(t => t.id === teamId);
  
  const rivalsList = topRivals.map(rivalry => {
    const opponent = league.teams.find(t => t.id === rivalry.opponentId);
    if (!opponent) return '';
    
    return `
      <div class="rival-item">
        <div class="rival-team-info">
          <div class="rival-team-name">${opponent.name}</div>
          <div class="rival-team-record">${opponent.wins}-${opponent.losses}</div>
        </div>
        ${renderRivalryMeter(rivalry.score, rivalry.label)}
      </div>
    `;
  }).join('');
  
  return `
    <div class="rivals-card">
      <h3 class="rivals-title">🔥 Top Rivals</h3>
      <div class="rivals-list">
        ${rivalsList}
      </div>
    </div>
  `;
}

/**
 * Add rivalry info to game display
 */
async function addRivalryToGameDisplay(game, containerElement) {
  if (!game || !containerElement) return;
  
  const rivalryScore = await getRivalry(game.homeTeamId, game.awayTeamId);
  if (rivalryScore >= 40) {
    const label = getRivalryLabel(rivalryScore);
    const badge = renderRivalryBadge(rivalryScore, label);
    
    // Insert badge into game display
    const headerEl = containerElement.querySelector('.game-header, .matchup-header');
    if (headerEl) {
      const badgeDiv = document.createElement('div');
      badgeDiv.innerHTML = badge;
      badgeDiv.style.marginTop = '8px';
      headerEl.appendChild(badgeDiv);
    }
  }
}

/* ============================
   SCHEDULE DEBUG HELPERS
============================ */

/**
 * Debug schedule distribution - shows when each team plays their first game
 * and the overall distribution of games across calendar days
 */
function debugScheduleDistribution() {
  if (!league || !league.schedule || !league.schedule.games) {
    console.log('[SCHEDULE DEBUG] No schedule available');
    return;
  }
  
  const allGames = league.schedule.games;
  const teams = league.teams;
  
  // Track each team's games
  const teamData = {};
  teams.forEach(t => {
    teamData[t.id] = {
      name: t.name,
      games: [],
      homeGames: 0,
      awayGames: 0,
      earliestDay: Infinity
    };
  });
  
  // Collect game data
  Object.values(allGames).forEach(game => {
    const day = Number(game.day);
    if (isNaN(day)) return;
    
    const homeData = teamData[game.homeTeamId];
    const awayData = teamData[game.awayTeamId];
    
    if (homeData) {
      homeData.games.push(day);
      homeData.homeGames++;
      homeData.earliestDay = Math.min(homeData.earliestDay, day);
    }
    
    if (awayData) {
      awayData.games.push(day);
      awayData.awayGames++;
      awayData.earliestDay = Math.min(awayData.earliestDay, day);
    }
  });
  
  // Print per-team summary
  console.log('\n=== SCHEDULE DISTRIBUTION BY TEAM ===');
  const teamSummary = Object.values(teamData).map(t => ({
    name: t.name,
    totalGames: t.games.length,
    home: t.homeGames,
    away: t.awayGames,
    firstGame: t.earliestDay === Infinity ? 'NONE' : t.earliestDay
  })).sort((a, b) => {
    const aDay = a.firstGame === 'NONE' ? Infinity : a.firstGame;
    const bDay = b.firstGame === 'NONE' ? Infinity : b.firstGame;
    return aDay - bDay;
  });
  
  console.table(teamSummary);
  
  // Find teams starting late
  const lateStarters = teamSummary.filter(t => t.firstGame !== 'NONE' && t.firstGame > 5);
  if (lateStarters.length > 0) {
    console.warn('[SCHEDULE DEBUG] ⚠️ Teams with first game after Day 5:');
    console.table(lateStarters);
  }
  
  // Day-by-day distribution
  const dayDistribution = {};
  Object.values(allGames).forEach(game => {
    const day = Number(game.calendarDay || game.day);
    if (isNaN(day)) return;
    dayDistribution[day] = (dayDistribution[day] || 0) + 1;
  });
  
  const days = Object.keys(dayDistribution).map(d => parseInt(d)).sort((a, b) => a - b);
  console.log('\n=== GAMES PER CALENDAR DAY (First 10 days) ===');
  const firstDays = days.slice(0, 10).map(day => ({
    day: day,
    games: dayDistribution[day]
  }));
  console.table(firstDays);
  
  // Summary stats
  const totalGames = Object.keys(allGames).length;
  const earliestDay = Math.min(...Object.values(teamData).map(t => t.earliestDay));
  const latestFirstGame = Math.max(...Object.values(teamData).map(t => t.earliestDay === Infinity ? 0 : t.earliestDay));
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total games: ${totalGames}`);
  console.log(`Calendar days used: ${days.length}`);
  console.log(`Earliest game day: ${earliestDay}`);
  console.log(`Latest team first game: Day ${latestFirstGame}`);
  console.log(`Teams with no games: ${Object.values(teamData).filter(t => t.games.length === 0).length}`);
  
  return teamSummary;
}

