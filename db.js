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
  // If we have leagueState, save it (preferred)
  // Otherwise fall back to legacy league object
  const stateToSave = leagueState ? leagueState : (league ? convertLegacyToLeagueState(league) : null);
  
  if (!stateToSave) return;
  
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
      userTeamId: selectedTeamId || stateToSave.meta.userTeamId,
      updatedAt: Date.now(),
      league: legacyFormat,
      // Store new leagueState format (for future use)
      leagueState: stateToSave
    });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

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
      
      // Set selected team
      selectedTeamId = savedData.userTeamId || leagueState.meta.userTeamId || league.teams[0].id;
      console.log('[LEAGUE STATE] Loaded league with userTeamId:', leagueState.meta.userTeamId, 'selectedTeamId:', selectedTeamId);
      
      appView = 'league';
      render();
      
      // Auto-save to persist any migrations or conversions
      console.log('[LEAGUE STATE] Auto-saving after load...');
      await save();
      
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
