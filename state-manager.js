/* ============================
   STATE MANAGER - Single Source of Truth
   Persistent state management with localStorage + IndexedDB
============================ */

/**
 * LocalStorage keys for quick-access metadata
 */
const STORAGE_KEYS = {
  ACTIVE_LEAGUE_ID: 'hoopsDynasty_activeLeagueId',
  USER_TEAM_ID: 'hoopsDynasty_userTeamId',
  RNG_SEED: 'hoopsDynasty_rngSeed',
  APP_VERSION: 'hoopsDynasty_appVersion'
};

const APP_VERSION = '1.0.0';

/**
 * Get active league ID from localStorage
 */
function getActiveLeagueId() {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_LEAGUE_ID);
}

/**
 * Set active league ID in localStorage
 */
function setActiveLeagueId(leagueId) {
  if (leagueId) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_LEAGUE_ID, leagueId);
  } else {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_LEAGUE_ID);
  }
}

/**
 * Get user team ID from localStorage
 */
function getUserTeamId() {
  const teamId = localStorage.getItem(STORAGE_KEYS.USER_TEAM_ID);
  return teamId ? parseInt(teamId, 10) : null;
}

/**
 * Set user team ID in localStorage
 */
function setUserTeamId(teamId) {
  if (teamId !== null && teamId !== undefined) {
    localStorage.setItem(STORAGE_KEYS.USER_TEAM_ID, teamId.toString());
    
    // Also sync to leagueState if it exists
    if (leagueState) {
      leagueState.meta.userTeamId = teamId;
    }
  } else {
    localStorage.removeItem(STORAGE_KEYS.USER_TEAM_ID);
  }
}

/**
 * Get RNG seed from localStorage or generate new one
 */
function getRngSeed() {
  let seed = localStorage.getItem(STORAGE_KEYS.RNG_SEED);
  if (!seed) {
    seed = Date.now().toString(36) + Math.random().toString(36).substr(2);
    localStorage.setItem(STORAGE_KEYS.RNG_SEED, seed);
  }
  return seed;
}

/**
 * Generate new RNG seed
 */
function generateNewRngSeed() {
  const seed = Date.now().toString(36) + Math.random().toString(36).substr(2);
  localStorage.setItem(STORAGE_KEYS.RNG_SEED, seed);
  return seed;
}

/**
 * Save league state to IndexedDB
 * This is the ONLY function that should write to storage
 */
async function saveLeagueState() {
  if (!leagueState) {
    console.warn('[STATE] No leagueState to save');
    return false;
  }

  try {
    // Update timestamp
    leagueState.meta.lastSaved = Date.now();
    
    // Sync userTeamId
    if (selectedTeamId !== null) {
      leagueState.meta.userTeamId = selectedTeamId;
      setUserTeamId(selectedTeamId);
    }
    
    // Ensure stable IDs exist
    if (!leagueState.meta.leagueId) {
      leagueState.meta.leagueId = `league_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Add RNG seed if not present
    if (!leagueState.meta.rngSeed) {
      leagueState.meta.rngSeed = getRngSeed();
    }
    
    console.log('[STATE] Saving league:', leagueState.meta.leagueId, 'userTeam:', leagueState.meta.userTeamId);
    
    // Convert to legacy format for backward compatibility
    const legacyFormat = convertLeagueStateToLegacy(leagueState);
    
    // Save to IndexedDB
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({
        id: leagueState.meta.leagueId,
        name: leagueState.meta.name || 'My League',
        season: leagueState.meta.season,
        userTeamId: leagueState.meta.userTeamId,
        updatedAt: Date.now(),
        league: legacyFormat,
        leagueState: leagueState
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
    
    // Update localStorage with active league
    setActiveLeagueId(leagueState.meta.leagueId);
    
    console.log('[STATE] ✓ Saved successfully');
    return true;
    
  } catch (error) {
    console.error('[STATE] Save failed:', error);
    return false;
  }
}

/**
 * Load league state from IndexedDB
 */
async function loadLeagueState(leagueId) {
  try {
    const db = await openDB();
    const savedData = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(leagueId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    
    if (!savedData) {
      console.warn('[STATE] League not found:', leagueId);
      return null;
    }
    
    console.log('[STATE] Loading league:', leagueId);
    
    // Load leagueState (new format) or convert from legacy
    if (savedData.leagueState) {
      leagueState = savedData.leagueState;
      console.log('[STATE] Loaded from leagueState format');
    } else if (savedData.league) {
      leagueState = convertLegacyToLeagueState(savedData.league);
      console.log('[STATE] Converted from legacy format');
    } else {
      console.error('[STATE] No valid league data found');
      return null;
    }
    
    // Validate and migrate schema if needed
    if (!leagueState.meta.schemaVersion || leagueState.meta.schemaVersion < CURRENT_SCHEMA_VERSION) {
      console.log('[STATE] Migrating schema from', leagueState.meta.schemaVersion, 'to', CURRENT_SCHEMA_VERSION);
      migrateLeagueState(leagueState);
    }
    
    // Convert to legacy format for backward compatibility
    league = convertLeagueStateToLegacy(leagueState);
    
    // Restore user team selection
    const restoredTeamId = savedData.userTeamId || leagueState.meta.userTeamId || getUserTeamId();
    
    // Validate team exists
    const teamExists = league.teams && league.teams.some(t => t.id === restoredTeamId);
    
    if (teamExists) {
      selectedTeamId = restoredTeamId;
    } else {
      console.warn('[STATE] Saved team not found, using first team');
      selectedTeamId = league.teams && league.teams.length > 0 ? league.teams[0].id : null;
    }
    
    // Sync to localStorage and leagueState
    setUserTeamId(selectedTeamId);
    leagueState.meta.userTeamId = selectedTeamId;
    
    // Restore nextPlayerId counter
    if (leagueState.players && leagueState.players.length > 0) {
      nextPlayerId = Math.max(...leagueState.players.map(p => p.id || 0)) + 1;
    } else {
      nextPlayerId = Math.max(...league.teams.flatMap(t => t.players.map(p => p.id || 0)), 
                              ...league.freeAgents.map(p => p.id || 0)) + 1;
    }
    
    // Set RNG seed from league or localStorage
    if (leagueState.meta.rngSeed) {
      localStorage.setItem(STORAGE_KEYS.RNG_SEED, leagueState.meta.rngSeed);
    }
    
    console.log('[STATE] ✓ Loaded:', {
      leagueId: leagueState.meta.leagueId,
      name: leagueState.meta.name,
      season: leagueState.meta.season,
      userTeamId: selectedTeamId,
      teamName: league.teams.find(t => t.id === selectedTeamId)?.name
    });
    
    // Update active league ID
    setActiveLeagueId(leagueId);
    
    return leagueState;
    
  } catch (error) {
    console.error('[STATE] Load failed:', error);
    return null;
  }
}

/**
 * Migrate league state to current schema version
 */
function migrateLeagueState(state) {
  // Add missing meta fields
  if (!state.meta) {
    state.meta = {};
  }
  
  if (!state.meta.leagueId) {
    state.meta.leagueId = `league_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  if (!state.meta.rngSeed) {
    state.meta.rngSeed = getRngSeed();
  }
  
  if (!state.meta.createdAt) {
    state.meta.createdAt = Date.now();
  }
  
  // Update schema version
  state.meta.schemaVersion = CURRENT_SCHEMA_VERSION;
  
  console.log('[STATE] Migration complete');
}

/**
 * Initialize app on boot
 * This is the ONLY entry point for app initialization
 */
async function initializeApp() {
  console.log('[STATE] Initializing app...');
  
  try {
    // Check for active league in localStorage
    const activeLeagueId = getActiveLeagueId();
    
    if (activeLeagueId) {
      console.log('[STATE] Found active league:', activeLeagueId);
      
      // Try to load the league
      const loaded = await loadLeagueState(activeLeagueId);
      
      if (loaded) {
        // Successfully loaded - go to league view
        appView = 'league';
        render();
        return;
      } else {
        // League not found - clear stale reference
        console.warn('[STATE] Active league not found, clearing reference');
        setActiveLeagueId(null);
        setUserTeamId(null);
      }
    }
    
    // No active league - show home screen
    console.log('[STATE] No active league, showing home screen');
    appView = 'home';
    render();
    
  } catch (error) {
    console.error('[STATE] Initialization failed:', error);
    appView = 'home';
    render();
  }
}

/**
 * Create new league (only called when user clicks "Create New League")
 */
async function createNewLeague(config) {
  console.log('[STATE] Creating new league...');
  
  // Generate new RNG seed for this league
  const rngSeed = generateNewRngSeed();
  
  // Create league using engine.js - pass parameters correctly
  createLeague(
    config.name || 'My League',
    config.season || new Date().getFullYear(),
    config.teamCount || 30,
    config,
    config.userTeamId
  );
  
  // Ensure leagueState was created
  if (!leagueState || !leagueState.meta) {
    console.error('[STATE] League creation failed - leagueState not initialized');
    return null;
  }
  
  // Set RNG seed
  leagueState.meta.rngSeed = rngSeed;
  
  // Set user team
  if (config.userTeamId !== null && config.userTeamId !== undefined) {
    selectedTeamId = config.userTeamId;
    leagueState.meta.userTeamId = config.userTeamId;
    setUserTeamId(config.userTeamId);
  }
  
  // Save to storage
  await saveLeagueState();
  
  console.log('[STATE] ✓ New league created:', leagueState.meta.leagueId);
  
  return leagueState;
}

/**
 * Delete league
 */
async function deleteLeagueState(leagueId) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(leagueId);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
    
    // If this was the active league, clear localStorage
    if (getActiveLeagueId() === leagueId) {
      setActiveLeagueId(null);
      setUserTeamId(null);
    }
    
    console.log('[STATE] ✓ Deleted league:', leagueId);
    return true;
    
  } catch (error) {
    console.error('[STATE] Delete failed:', error);
    return false;
  }
}

/**
 * Switch to different team
 */
function switchUserTeam(teamId) {
  if (!leagueState) {
    console.warn('[STATE] Cannot switch team - no active league');
    return;
  }
  
  // Validate team exists
  const teamExists = league && league.teams && league.teams.some(t => t.id === teamId);
  
  if (!teamExists) {
    console.error('[STATE] Team not found:', teamId);
    return;
  }
  
  selectedTeamId = teamId;
  leagueState.meta.userTeamId = teamId;
  setUserTeamId(teamId);
  
  console.log('[STATE] Switched to team:', teamId, league.teams.find(t => t.id === teamId)?.name);
  
  // Auto-save
  saveLeagueState();
}

console.log('[STATE] State manager loaded');
