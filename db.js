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
  if (!league) return;
  
  // Ensure league has an ID
  if (!league.id) {
    league.id = 'league_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({
      id: league.id,
      name: league.name || 'My League',
      season: league.season,
      userTeamId: selectedTeamId,
      updatedAt: Date.now(),
      league: league
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
      const result = req.result?.league ?? null;
      if (result) {
        league = result;
        
        // Run migrations if needed
        const didMigrate = migrateLeague(league);
        
        nextPlayerId = Math.max(...league.teams.flatMap(t => t.players.map(p => p.id)), 
                                ...league.freeAgents.map(p => p.id)) + 1;
        selectedTeamId = req.result.userTeamId || league.teams[0].id;
        console.log('Loaded league with userTeamId:', req.result.userTeamId, 'selectedTeamId:', selectedTeamId);
        appView = 'league';
        render();
        
        // Auto-save if migrations were applied
        if (didMigrate) {
          console.log('Migrations applied, auto-saving league...');
          await save();
        }
      }
      resolve(result);
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
