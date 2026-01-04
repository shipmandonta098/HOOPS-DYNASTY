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
  { city: "New York", name: "Comets", conference: "East", division: "Atlantic", market: "Large", primaryColor: "#FF6B35", secondaryColor: "#004E89", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  { city: "Boston", name: "Titans", conference: "East", division: "Atlantic", market: "Large", primaryColor: "#00843D", secondaryColor: "#FFFFFF", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  { city: "Brooklyn", name: "Empire", conference: "East", division: "Atlantic", market: "Large", primaryColor: "#000000", secondaryColor: "#FFFFFF", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  { city: "Philadelphia", name: "Founders", conference: "East", division: "Atlantic", market: "Large", primaryColor: "#0077C8", secondaryColor: "#ED174C", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  { city: "Toronto", name: "Voyagers", conference: "East", division: "Atlantic", market: "Medium", primaryColor: "#CE1141", secondaryColor: "#000000", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  
  // Eastern Conference - Central Division
  { city: "Chicago", name: "Queens", conference: "East", division: "Central", market: "Large", primaryColor: "#CE1141", secondaryColor: "#000000", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  { city: "Milwaukee", name: "Thunder", conference: "East", division: "Central", market: "Medium", primaryColor: "#00471B", secondaryColor: "#EEE1C6", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  { city: "Indiana", name: "Fury", conference: "East", division: "Central", market: "Medium", primaryColor: "#002D62", secondaryColor: "#FDBB30", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  { city: "Detroit", name: "Engines", conference: "East", division: "Central", market: "Medium", primaryColor: "#C8102E", secondaryColor: "#1D42BA", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  { city: "Cleveland", name: "Steam", conference: "East", division: "Central", market: "Medium", primaryColor: "#860038", secondaryColor: "#FDBB30", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  
  // Eastern Conference - Southeast Division
  { city: "Miami", name: "Heatwave", conference: "East", division: "Southeast", market: "Large", primaryColor: "#98002E", secondaryColor: "#F9A01B", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  { city: "Atlanta", name: "Skyforce", conference: "East", division: "Southeast", market: "Large", primaryColor: "#E03A3E", secondaryColor: "#C1D32F", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  { city: "Washington", name: "Monuments", conference: "East", division: "Southeast", market: "Large", primaryColor: "#002B5C", secondaryColor: "#E31837", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  { city: "Charlotte", name: "Lynx", conference: "East", division: "Southeast", market: "Medium", primaryColor: "#1D1160", secondaryColor: "#00788C", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  { city: "Orlando", name: "Knights", conference: "East", division: "Southeast", market: "Medium", primaryColor: "#0077C0", secondaryColor: "#C4CED4", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  
  // Western Conference - Northwest Division
  { city: "Denver", name: "Altitude", conference: "West", division: "Northwest", market: "Medium", primaryColor: "#0E2240", secondaryColor: "#FEC524", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  { city: "Portland", name: "Cascade", conference: "West", division: "Northwest", market: "Medium", primaryColor: "#E03A3E", secondaryColor: "#000000", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  { city: "Utah", name: "Avalanche", conference: "West", division: "Northwest", market: "Small", primaryColor: "#002B5C", secondaryColor: "#00471B", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  { city: "Oklahoma City", name: "Stampede", conference: "West", division: "Northwest", market: "Medium", primaryColor: "#007AC1", secondaryColor: "#EF3B24", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  { city: "Minnesota", name: "Blizzard", conference: "West", division: "Northwest", market: "Medium", primaryColor: "#0C2340", secondaryColor: "#78BE20", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  
  // Western Conference - Pacific Division
  { city: "Los Angeles", name: "Waves", conference: "West", division: "Pacific", market: "Large", primaryColor: "#552583", secondaryColor: "#FDB927", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  { city: "Los Angeles", name: "Eclipse", conference: "West", division: "Pacific", market: "Large", primaryColor: "#C8102E", secondaryColor: "#1D428A", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  { city: "Golden State", name: "Pioneers", conference: "West", division: "Pacific", market: "Large", primaryColor: "#1D428A", secondaryColor: "#FFC72C", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  { city: "Phoenix", name: "Inferno", conference: "West", division: "Pacific", market: "Large", primaryColor: "#E56020", secondaryColor: "#1D1160", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  { city: "Sacramento", name: "Dragons", conference: "West", division: "Pacific", market: "Medium", primaryColor: "#5A2D81", secondaryColor: "#63727A", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  
  // Western Conference - Southwest Division
  { city: "Dallas", name: "Strikers", conference: "West", division: "Southwest", market: "Large", primaryColor: "#00538C", secondaryColor: "#002F87", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  { city: "Houston", name: "Astros", conference: "West", division: "Southwest", market: "Large", primaryColor: "#CE1141", secondaryColor: "#000000", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  { city: "San Antonio", name: "Generals", conference: "West", division: "Southwest", market: "Large", primaryColor: "#C4CED4", secondaryColor: "#000000", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  { city: "Memphis", name: "Blues", conference: "West", division: "Southwest", market: "Medium", primaryColor: "#5D76A9", secondaryColor: "#12173F", logoPrimaryUrl: "", logoSecondaryUrl: "" },
  { city: "New Orleans", name: "Voodoo", conference: "West", division: "Southwest", market: "Medium", primaryColor: "#0C2340", secondaryColor: "#C8102E", logoPrimaryUrl: "", logoSecondaryUrl: "" }
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

let league = null;
let appView = 'home'; // 'home', 'myLeagues', 'newLeague', 'editTeam', or 'league'
let standingsView = 'record'; // 'record' or 'power'
let currentTab = 'dashboard';
let selectedTeamId = null;
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
  teams: [] // Will hold customized team metadata during setup
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

function randName() {
  const first = ["James", "Michael", "Kobe", "LeBron", "Stephen", "Kevin", "Chris", "Anthony", "Dwyane", "Russell", "Tim", "Larry", "Magic", "Kareem", "Shaq", "Allen", "Ray", "Paul", "Dirk", "Hakeem", "Charles", "John", "Karl", "Moses", "David"];
  const last = ["Johnson", "Williams", "Brown", "Jones", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Garcia", "Martinez", "Robinson", "Clark", "Rodriguez", "Lewis", "Lee", "Walker", "Hall"];
  return `${first[rand(0, first.length - 1)]} ${last[rand(0, last.length - 1)]}`;
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
    teams: []
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
        <div class="league-card" onclick="loadLeague('${save.id}')">
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

async function deleteLeagueConfirm(id) {
  if (!confirm('Are you sure you want to delete this league?')) return;
  
  await deleteLeague(id);
  
  // If we deleted the current league, clear it
  if (league && league.id === id) {
    league = null;
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
    tabContent = `
      <div class="setup-section">
        <p style="color: #64748b; text-align: center; padding: 40px 20px;">Additional settings coming soon...</p>
      </div>
    `;
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
          disabled
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
  newLeagueState.currentTab = tab;
  renderNewLeague();
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

function confirmCreateLeague() {
  if (newLeagueState.name.trim().length === 0 || newLeagueState.userTeamId === null) {
    return;
  }
  
  const name = newLeagueState.name.trim();
  const teamCount = newLeagueState.teamCount;
  const seasonYear = newLeagueState.seasonYear;
  const userTeamId = newLeagueState.userTeamId;
  
  console.log('Creating league with selected team ID:', userTeamId);
  
  createLeague(name, seasonYear, teamCount, newLeagueState, userTeamId);
}

/* ============================
   UI RENDERING
============================ */

function render() {
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
  if (currentTab === 'freeagents') renderFreeAgents();
  if (currentTab === 'history') renderHistory();
  if (currentTab === 'rotations') renderRotations();
  if (currentTab === 'finances') renderFinances();
}

function updateLeagueInfo() {
  const el = document.getElementById('leagueInfo');
  const leagueName = league.name || 'League';
  el.innerHTML = `<strong>${leagueName}</strong> | Season: ${league.season} | Phase: ${league.phase.toUpperCase()}`;
  
  // Update button states
  document.getElementById('simSeasonBtn').disabled = league.phase !== 'preseason';
  document.getElementById('offseasonBtn').disabled = league.phase !== 'offseason';
  document.getElementById('draftBtn').disabled = league.phase !== 'draft';
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
  document.getElementById(`${tab}-tab`).style.display = 'block';
  
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
            👔 Coach: ${team.coach ? team.coach.name : 'None'} (${team.coach ? team.coach.ratings.overall : 0} OVR)
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
                <div class="dashboard-player-name">${p.name}</div>
                <div class="dashboard-player-pos">${p.pos}</div>
              </div>
              <div class="dashboard-player-stat">${ppg} PPG</div>
              <div class="dashboard-player-ovr">${p.ratings.ovr}</div>
            </div>
          `;
        }).join('')}
      </div>
      
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
  
  el.innerHTML = `
    <h2>Season ${league.season} Standings</h2>
    ${pillToggle}
    ${content}
  `;
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
      const teamLogo = `<div class="team-logo-small">${t.city.substring(0, 2).toUpperCase()}</div>`;
      
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
              <span>SOS: —</span>
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
    const teamLogo = `<div class="team-logo-small">${team.city.substring(0, 2).toUpperCase()}</div>`;
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
  
  if (!selectedTeamId) selectedTeamId = league.teams[0].id;
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
      
      return `
        <div class="player-card-mobile">
          <div class="player-card-main">
            <div class="player-card-left">
              <div class="player-name-mobile">${p.name}</div>
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
          <select class="team-dropdown" onchange="selectedTeamId = parseInt(this.value); render();">
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
  
  const menu = document.createElement('div');
  menu.className = 'player-action-menu';
  menu.innerHTML = `
    <div class="action-menu-item" onclick="showPlayerModal(${playerId}); closeActionMenu();">View Player</div>
    <div class="action-menu-item" onclick="alert('Trade feature coming soon!'); closeActionMenu();">Trade</div>
    <div class="action-menu-item danger" onclick="cutPlayer(${playerId}, ${teamId}); closeActionMenu();">Cut/Waive</div>
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
  
  if (league.freeAgents.length === 0) {
    el.innerHTML = `
      <h2>Free Agents</h2>
      <p>No free agents available.</p>
    `;
    return;
  }
  
  const sorted = [...league.freeAgents].sort((a, b) => b.ratings.ovr - a.ratings.ovr);
  
  const rows = sorted.map(p => {
    return `
      <tr>
        <td><span class="clickable" onclick="showPlayerModal(${p.id})">${p.name}</span></td>
        <td>${p.pos}</td>
        <td>${p.age}</td>
        <td>${p.ratings.ovr}</td>
        <td>${p.ratings.pot}</td>
        <td>$${p.contract.amount}M</td>
        <td>
          <select id="teamSelect${p.id}">
            ${league.teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
          </select>
          <button onclick="signFreeAgent(${p.id}, parseInt(document.getElementById('teamSelect${p.id}').value))">Sign</button>
        </td>
      </tr>
    `;
  }).join('');
  
  el.innerHTML = `
    <h2>Free Agents</h2>
    <table>
      <tr>
        <th>Name</th>
        <th>Pos</th>
        <th>Age</th>
        <th>OVR</th>
        <th>POT</th>
        <th>Asking</th>
        <th>Action</th>
      </tr>
      ${rows}
    </table>
  `;
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
              <div class="finances-table-cell name">${p.name}</div>
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
          <select class="rotations-team-select" onchange="selectedTeamId = parseInt(this.value); render();">
            ${league.teams.map(t => `
              <option value="${t.id}" ${t.id === selectedTeamId ? 'selected' : ''}>${t.name}</option>
            `).join('')}
          </select>
          <a href="#" class="rotations-coach-link" onclick="event.preventDefault(); showCoachModal(${selectedTeamId});">
            Coach: ${team.coach?.name || 'Unknown'}
          </a>
          <span class="rotations-season-text">${league.season} • ${league.phase.toUpperCase()}</span>
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
          ${starters.map(p => `
            <div class="lineup-slot">
              <div class="lineup-slot-position">${p.pos}</div>
              <div class="lineup-slot-player">${p.name}</div>
              <div class="lineup-slot-minutes">${team.rotations.minuteTargetsByPlayerId[p.id] || 0} min</div>
            </div>
          `).join('')}
        </div>
        
        <div class="lineup-bench">
          <div class="lineup-bench-title">Top Bench</div>
          <div class="lineup-bench-players">
            ${benchPlayers.map(p => `
              <div class="bench-player-chip">${p.name} (${team.rotations.minuteTargetsByPlayerId[p.id] || 0} min)</div>
            `).join('')}
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
          <div class="rotation-player-name">${player.name}</div>
          <div class="rotation-player-meta">
            <span class="rotation-ovr ${ovrClass}">${player.ratings.ovr}</span>
            <span>${player.pos}</span>
            <span class="rotation-role-badge ${role}">${role.toUpperCase()}</span>
            <span>Age ${player.age}</span>
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
    
    // Resolve drafted by team
    if (player.draft.draftedByTid !== null && player.draft.draftedByTid !== undefined) {
      const draftTeam = league.teams.find(t => t.id === player.draft.draftedByTid);
      draftedByTeamName = draftTeam ? draftTeam.name : 'Unknown Team';
    } else {
      draftedByTeamName = 'Unknown Team';
    }
  } else {
    draftLine = 'Undrafted';
    draftedByTeamName = '—';
  }
  
  // Helper function to render attribute bars
  const renderAttributeBar = (label, value, description = '') => {
    const barClass = value >= 80 ? 'bar-green' : value >= 60 ? 'bar-blue' : value >= 40 ? 'bar-yellow' : 'bar-red';
    return `
      <div class="attribute-row">
        <div class="attribute-left">
          <div class="attribute-label">${label}</div>
          ${description ? `<div class="attribute-description">${description}</div>` : ''}
        </div>
        <div class="attribute-right">
          <div class="attribute-value">${value}</div>
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
          <div class="player-modal-subtitle">${player.pos} • Age ${player.age}</div>
        </div>
        <button class="player-modal-close" onclick="closePlayerModal()">✕</button>
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
      <p class="welcome-greeting">Congratulations on taking control of the ${teamCity} ${teamName}!</p>
      
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

(async function boot() {
  const saved = await loadMostRecentLeague();
  if (saved) {
    league = saved;
    nextPlayerId = Math.max(...league.teams.flatMap(t => t.players.map(p => p.id)), 
                            ...league.freeAgents.map(p => p.id)) + 1;
    selectedTeamId = league.teams[0].id;
    ensureCoachesExist(); // Add coaches to existing saves
    appView = 'league';
  } else {
    appView = 'home';
  }
  render();
})();

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
