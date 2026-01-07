/* ============================
   INDEXEDDB / STORAGE
============================ */

const DB_NAME = "HoopsDynastyDB";
const STORE = "leagues";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveLeague() {
  // DEPRECATED: Use saveLeagueState() from state-manager.js instead
  // This is kept for backward compatibility
  console.warn('[DB] saveLeague() is deprecated, use saveLeagueState() instead');
  
  // Redirect to new state manager if available
  if (typeof saveLeagueState === 'function') {
    return await saveLeagueState();
  }
  
  // Fallback to old behavior
  const stateToSave = leagueState ? leagueState : (league ? convertLegacyToLeagueState(league) : null);
  
  if (!stateToSave) return;
  
  // Ensure selectedTeamId is synced to leagueState before saving
  if (selectedTeamId) {
    stateToSave.meta.userTeamId = selectedTeamId;
  }
  
  // Update lastSaved timestamp
  stateToSave.meta.lastSaved = Date.now();
  
  // Convert to legacy format for storage (backwards compatibility)
  const legacyFormat = convertLeagueStateToLegacy(stateToSave);
  
  // Ensure league has an ID
  if (!legacyFormat.id) {
    legacyFormat.id = 'league_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    stateToSave.meta.leagueId = legacyFormat.id;
  }
  
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({
      id: legacyFormat.id,
      name: legacyFormat.name || 'My League',
      season: legacyFormat.season,
      userTeamId: stateToSave.meta.userTeamId,
      updatedAt: Date.now(),
      league: legacyFormat,
      // Store new leagueState format (for future use)
      leagueState: stateToSave
    });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// Backward compatibility alias
const save = saveLeague;

async function listLeagues() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const leagues = req.result.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(leagues);
    };
    req.onerror = () => reject(req.error);
  });
}

async function loadLeague(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = async () => {
      const savedData = req.result;
      if (!savedData) {
        resolve(null);
        return;
      }
      
      // Try to load new leagueState format first, fall back to legacy
      if (savedData.leagueState) {
        console.log('[LEAGUE STATE] Loading from new leagueState format');
        leagueState = savedData.leagueState;
        
        // Ensure schemaVersion is up to date
        if (!leagueState.meta.schemaVersion || leagueState.meta.schemaVersion < CURRENT_SCHEMA_VERSION) {
          console.log('[LEAGUE STATE] Migrating from schema', leagueState.meta.schemaVersion, 'to', CURRENT_SCHEMA_VERSION);
          // Run migrations here if needed
          leagueState.meta.schemaVersion = CURRENT_SCHEMA_VERSION;
        }
        
        // Convert to legacy format for backwards compatibility
        league = convertLeagueStateToLegacy(leagueState);
      } else if (savedData.league) {
        console.log('[LEAGUE STATE] Loading from legacy league format, converting...');
        league = savedData.league;
        
        // Run legacy migrations
        const didMigrate = migrateLeague(league);
        
        // Convert legacy to new leagueState
        leagueState = convertLegacyToLeagueState(league);
        
        if (didMigrate) {
          console.log('[LEAGUE STATE] Migrations applied during conversion');
        }
      } else {
        resolve(null);
        return;
      }
      
      // Set nextPlayerId
      if (leagueState.players && leagueState.players.length > 0) {
        nextPlayerId = Math.max(...leagueState.players.map(p => p.id || 0)) + 1;
      } else {
        nextPlayerId = Math.max(...league.teams.flatMap(t => t.players.map(p => p.id || 0)), 
                                ...league.freeAgents.map(p => p.id || 0)) + 1;
      }
      
      // Set selected team with proper priority
      // 1. Use saved userTeamId from database
      // 2. Fall back to leagueState.meta.userTeamId
      // 3. Last resort: first team in league
      console.log('[DB DEPRECATED] This loadLeague function is deprecated, use loadLeagueState() instead');
      
      const restoredTeamId = savedData.userTeamId || leagueState.meta.userTeamId || (league.teams && league.teams.length > 0 ? league.teams[0].id : null);
      
      // Verify the team still exists in the league
      const teamExists = league.teams && league.teams.some(t => t.id === restoredTeamId);
      
      if (teamExists) {
        selectedTeamId = restoredTeamId;
      } else {
        console.warn('[DB] Saved team ID not found, defaulting to first team');
        selectedTeamId = league.teams && league.teams.length > 0 ? league.teams[0].id : null;
      }
      
      // Sync back to leagueState
      leagueState.meta.userTeamId = selectedTeamId;
      
      console.log('[DB] Loaded league, userTeamId:', leagueState.meta.userTeamId, 'team:', league.teams.find(t => t.id === selectedTeamId)?.name);
      
      // DO NOT auto-navigate or auto-save here - let the caller handle that
      
      resolve(league);
    };
    req.onerror = () => reject(req.error);
  });
}

async function deleteLeague(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function loadMostRecentLeague() {
  const leagues = await listLeagues();
  return leagues.length > 0 ? leagues[0].league : null;
}

async function renameLeague(id) {
  const newName = prompt('Enter new league name:');
  if (!newName || !newName.trim()) return;
  
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const getReq = tx.objectStore(STORE).get(id);
    
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (record) {
        record.name = newName.trim();
        record.league.name = newName.trim();
        tx.objectStore(STORE).put(record);
      }
    };
    
    tx.oncomplete = () => {
      if (league && league.id === id) {
        league.name = newName.trim();
      }
      render();
      resolve(true);
    };
    tx.onerror = () => reject(tx.error);
  });
}

function exportLeague(id) {
  listLeagues().then(leagues => {
    const record = leagues.find(l => l.id === id);
    if (!record) return;
    
    const dataStr = JSON.stringify(record, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${record.name.replace(/[^a-z0-9]/gi, '_')}_Season${record.season}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });
}

function importLeague() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Validate minimal fields
      if (!data.league || !data.league.teams || !data.league.season) {
        alert('Invalid league file format');
        return;
      }
      
      // Generate new ID to avoid conflicts
      data.id = 'league_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      data.league.id = data.id;
      data.updatedAt = Date.now();
      data.name = data.name || 'Imported League';
      
      // Save to IndexedDB
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(data);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
      
      alert('League imported successfully!');
      render();
    } catch (err) {
      alert('Failed to import league: ' + err.message);
    }
  };
  input.click();
}

function save() {
  saveLeague();
}
