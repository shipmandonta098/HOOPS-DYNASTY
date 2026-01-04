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
  if (currentTab === 'draft') renderDraft();
  if (currentTab === 'expansion') renderExpansion();
  if (currentTab === 'schedule') renderSchedule();
  if (currentTab === 'history') renderHistory();
  if (currentTab === 'rotations') renderRotations();
  if (currentTab === 'finances') renderFinances();
  if (currentTab === 'trades') renderTrades();
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
      
      <!-- Alerts Section -->
      ${renderDashboardAlerts()}
      
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
              <button class="freeagents-negotiate-btn" onclick="openNegotiationModal(${p.id})">Negotiate</button>
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
                <div>${p.name} | ${p.pos} | ${p.age}y</div>
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
   SCHEDULE TAB
============================ */

let activeGameDrawer = null;
let liveGameIntervals = new Map(); // gameId -> intervalId

function renderSchedule() {
  const el = document.getElementById('schedule-tab');
  
  if (!league?.schedule || !league?.schedule.days[league.season]) {
    el.innerHTML = `
      <div style="padding: 20px;">
        <h2>📅 Schedule</h2>
        <p>No schedule available. Advance to next season to generate schedule.</p>
      </div>
    `;
    return;
  }
  
  const currentDay = getCurrentDay();
  const totalDays = getTotalScheduleDays(league.season);
  const day = getScheduleDay(league.season, currentDay);
  const games = getGamesForDay(league.season, currentDay);
  
  if (!day) {
    el.innerHTML = `
      <div style="padding: 20px;">
        <h2>📅 Schedule</h2>
        <p>Invalid day. Please check your schedule data.</p>
      </div>
    `;
    return;
  }
  
  el.innerHTML = `
    <div style="padding: 20px;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 2px solid #2a2a40;">
        <div>
          <h2 style="margin: 0 0 8px 0;">📅 Schedule - ${league.season} Season</h2>
          <div style="display: flex; gap: 20px; align-items: center;">
            <span style="font-size: 1.3em; font-weight: bold; color: #4CAF50;">Day ${currentDay} of ${totalDays}</span>
            <span style="padding: 6px 12px; background: #2196F3; border-radius: 6px; font-weight: bold; font-size: 0.9em;">${day.phase}</span>
          </div>
        </div>
        
        <!-- Navigation Controls -->
        <div style="display: flex; gap: 10px;">
          <button 
            onclick="navigateScheduleDay(-1)" 
            ${currentDay <= 1 ? 'disabled' : ''}
            style="padding: 10px 20px; background: ${currentDay <= 1 ? '#333' : '#2a2a40'}; color: ${currentDay <= 1 ? '#666' : 'white'}; border: none; border-radius: 6px; cursor: ${currentDay <= 1 ? 'not-allowed' : 'pointer'}; font-weight: bold;">
            ← Previous Day
          </button>
          <button 
            onclick="navigateScheduleDay(1)" 
            ${currentDay >= totalDays ? 'disabled' : ''}
            style="padding: 10px 20px; background: ${currentDay >= totalDays ? '#333' : '#2a2a40'}; color: ${currentDay >= totalDays ? '#666' : 'white'}; border: none; border-radius: 6px; cursor: ${currentDay >= totalDays ? 'not-allowed' : 'pointer'}; font-weight: bold;">
            Next Day →
          </button>
        </div>
      </div>
      
      <!-- Action Buttons -->
      <div style="display: flex; gap: 10px; margin-bottom: 25px;">
        <button 
          onclick="simEntireDayUI()"
          ${games.length === 0 || games.every(g => g.status === 'final') ? 'disabled' : ''}
          style="flex: 1; padding: 14px; background: ${games.length === 0 || games.every(g => g.status === 'final') ? '#333' : '#4CAF50'}; color: ${games.length === 0 || games.every(g => g.status === 'final') ? '#666' : 'white'}; border: none; border-radius: 8px; cursor: ${games.length === 0 || games.every(g => g.status === 'final') ? 'not-allowed' : 'pointer'}; font-weight: bold; font-size: 1em;">
          ⚡ Sim Entire Day
        </button>
        <button 
          onclick="simToNextUserGameUI()"
          style="flex: 1; padding: 14px; background: #2196F3; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 1em;">
          ⏭️ Sim to Next User Game
        </button>
      </div>
      
      <!-- Games Container -->
      <div style="background: #1a1a2e; border-radius: 10px; padding: 20px; min-height: 400px;">
        ${renderScheduleDayGames(games, day)}
      </div>
      
      <div id="game-drawer-container"></div>
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
  
  const statusDisplay = game.status === 'final' ? 'FINAL' : 
                       game.status === 'live' ? `LIVE - Q${game.quarter} ${game.timeRemaining}` :
                       'Scheduled';
  
  const statusColor = game.status === 'final' ? '#888' : 
                     game.status === 'live' ? '#f44336' : '#4CAF50';
  
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
          
          <div style="display: flex; align-items: center; margin-bottom: 10px;">
            <span style="font-weight: bold; font-size: 1.1em; width: 220px;">${awayTeam.name}</span>
            <span style="color: #888; font-size: 0.9em; margin-right: 15px;">(${awayTeam.wins}-${awayTeam.losses})</span>
            ${game.status !== 'scheduled' ? `<span style="font-size: 1.4em; font-weight: bold; color: ${game.score.away > game.score.home ? '#4CAF50' : '#fff'};">${game.score.away}</span>` : ''}
          </div>
          
          <div style="display: flex; align-items: center;">
            <span style="font-weight: bold; font-size: 1.1em; width: 220px;">${homeTeam.name}</span>
            <span style="color: #888; font-size: 0.9em; margin-right: 15px;">(${homeTeam.wins}-${homeTeam.losses})</span>
            ${game.status !== 'scheduled' ? `<span style="font-size: 1.4em; font-weight: bold; color: ${game.score.home > game.score.away ? '#4CAF50' : '#fff'};">${game.score.home}</span>` : ''}
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
  `;
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
  
  const homeTeam = league.teams.find(t => t.id === game.homeTeamId);
  const awayTeam = league.teams.find(t => t.id === game.awayTeamId);
  
  const container = document.getElementById('game-drawer-container');
  
  // Only render if container is empty (avoid re-rendering during live updates)
  if (container.children.length === 0) {
    console.log('Initial render of game drawer for:', game.id);
    container.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      " onclick="if(event.target === this) closeGameDrawer()">
        <div id="game-drawer-modal" style="
          background: #1a1a2e;
          border-radius: 12px;
          width: 90%;
          max-width: 900px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        ">
        <!-- Header -->
        <div id="game-drawer-header" style="padding: 20px; border-bottom: 2px solid #2a2a40;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0;">${awayTeam.name} @ ${homeTeam.name}</h3>
            <button onclick="closeGameDrawer()" style="background: #f44336; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">✕ Close</button>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 1.8em; font-weight: bold;">
                ${awayTeam.name} <span id="away-score" style="color: ${game.status === 'final' ? '#fff' : '#888'}">${game.score.away}</span>
              </div>
              <div style="font-size: 1.8em; font-weight: bold; margin-top: 5px;">
                ${homeTeam.name} <span id="home-score" style="color: ${game.status === 'final' ? '#fff' : '#888'}">${game.score.home}</span>
              </div>
            </div>
            <div id="game-status-display" style="text-align: right;">
              ${game.status === 'final' ? '<span style="color: #4CAF50; font-weight: bold;">FINAL</span>' : ''}
              ${game.status === 'live' ? `<span style="color: #f44336; font-weight: bold;">Q${game.quarter} ${game.timeRemaining}</span>` : ''}
              ${game.status === 'scheduled' ? '<span style="color: #888;">Scheduled</span>' : ''}
            </div>
          </div>
          
          <!-- Game Action Buttons -->
          <div id="game-action-buttons">
            ${game.status === 'scheduled' ? `
              <div style="margin-top: 15px; display: flex; gap: 10px;">
                <button onclick="simGameInstantUI('${game.id}')" style="flex: 1; background: #4CAF50; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; font-weight: bold;">⚡ Sim Instant</button>
                <button onclick="startWatchLiveUI('${game.id}')" style="flex: 1; background: #2196F3; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; font-weight: bold;">👁️ Watch Live</button>
              </div>
            ` : ''}
          </div>
        </div>
        
        <!-- Play-by-Play Feed (for Watch Live) -->
        <div id="playByPlayContainer" style="display: none; flex: 1; overflow: hidden; padding: 20px; background: #16213e;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="margin: 0; color: #4CAF50;">Live Play-by-Play</h4>
            <span id="pbp-event-count" style="color: #888; font-size: 0.9em;">0 events</span>
          </div>
          <div id="playByPlayFeed" class="pbp-feed" style="
            background: #0f1624;
            border: 1px solid #2a2a40;
            border-radius: 8px;
            padding: 15px;
            height: 320px;
            overflow-y: auto;
            font-family: monospace;
            color: #e0e0e0;
          "></div>
        </div>
        
        <!-- Content -->
        <div style="flex: 1; overflow-y: auto; padding: 20px;">
          ${renderGameDrawerContent(game, homeTeam, awayTeam)}
        </div>
        
        <!-- Live Controls -->
        ${game.status === 'live' ? renderLiveGameControls(game.id) : ''}
      </div>
    </div>
  `;
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
    <div style="border-top: 2px solid #2a2a40; padding: 15px; background: #16213e;">
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
  
  if (startLiveGame(gameId)) {
    save();
    
    // Show play-by-play container and hide action buttons
    const pbpContainer = document.getElementById('playByPlayContainer');
    const actionButtons = document.getElementById('game-action-buttons');
    
    if (pbpContainer) {
      pbpContainer.style.display = 'flex';
      console.log('✓ Play-by-play container shown');
    } else {
      console.error('✗ Play-by-play container not found!');
    }
    
    if (actionButtons) {
      actionButtons.style.display = 'none';
    }
    
    // Clear feed and initialize
    const feed = document.getElementById('playByPlayFeed');
    if (feed) {
      feed.innerHTML = '';
      console.log('✓ Play-by-play feed cleared and ready');
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
  
  const homeTeam = league.teams.find(t => t.id === game.homeTeamId);
  const awayTeam = league.teams.find(t => t.id === game.awayTeamId);
  
  // Update scores
  const awayScoreEl = document.getElementById('away-score');
  const homeScoreEl = document.getElementById('home-score');
  if (awayScoreEl) awayScoreEl.textContent = game.score.away;
  if (homeScoreEl) homeScoreEl.textContent = game.score.home;
  
  // Update status (quarter and time)
  const statusEl = document.getElementById('game-status-display');
  if (statusEl) {
    if (game.status === 'final') {
      statusEl.innerHTML = '<span style="color: #4CAF50; font-weight: bold;">FINAL</span>';
    } else if (game.status === 'live') {
      statusEl.innerHTML = `<span style="color: #f44336; font-weight: bold;">Q${game.quarter} ${game.timeRemaining}</span>`;
    }
  }
  
  // Update play-by-play feed
  const feed = document.getElementById('playByPlayFeed');
  const eventCount = document.getElementById('pbp-event-count');
  
  if (feed && game.log && game.log.length > 0) {
    // Get last event that hasn't been displayed yet
    const currentEventCount = feed.children.length;
    const newEvents = game.log.slice(currentEventCount);
    
    console.log(`PBP Update: ${currentEventCount} displayed, ${game.log.length} total, ${newEvents.length} new`);
    
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

function pauseLiveGameUI(gameId) {
  if (liveGameIntervals.has(gameId)) {
    clearInterval(liveGameIntervals.get(gameId));
    liveGameIntervals.delete(gameId);
    console.log('Game paused');
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

/* ============================
   FREE AGENCY NEGOTIATION
============================ */

let negotiationState = {
  playerId: null,
  currentOffer: null,
  agentResponse: null
};

function openNegotiationModal(playerId) {
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
            <div class="negotiation-player-name">${player.name}</div>
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
  // Remove from free agents
  const faIndex = league.freeAgents.findIndex(p => p.id === player.id);
  if (faIndex !== -1) {
    league.freeAgents.splice(faIndex, 1);
  }
  
  // Update player contract
  player.contract = {
    amount: contractTerms.salary,
    exp: league.season + contractTerms.years,
    yearsRemaining: contractTerms.years,
    totalValue: contractTerms.salary * contractTerms.years,
    startYear: league.season,
    hasPlayerOption: contractTerms.hasPlayerOption,
    hasTeamOption: contractTerms.hasTeamOption
  };
  
  // Add to team
  team.players.push(player);
  
  // Update team payroll
  team.payroll = team.players.reduce((sum, p) => sum + (p.contract?.amount || 0), 0);
  
  // Save league
  saveLeague(league);
  
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
          <button class="trades-btn propose" ${!evaluation.isLegal ? 'disabled' : ''} 
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
            <div class="trades-asset-name">${player.name}</div>
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
        <div class="trades-player-name">${p.name}</div>
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
  executeTrade(tradeState.teamAId, tradeState.teamBId, tradeState.teamAAssets, tradeState.teamBAssets);
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
            <div class="draft-phase">Phase: ${league.phase.toUpperCase()}</div>
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
                <div class="prospect-col-name">${p.name}</div>
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
                <div class="draft-prospect-name">${p.name}</div>
                <div class="draft-prospect-meta">${p.pos} • Age ${p.age} • ${p.bio.college}</div>
              </div>
              <div class="draft-prospect-ratings">
                <div class="draft-rating-badge ovr">${p.ratings.ovr} OVR</div>
                <div class="draft-rating-badge pot">${p.ratings.pot} POT</div>
              </div>
              <div class="draft-prospect-attrs">
                <span class="draft-attr-badge">3PT: ${p.attributes.offensive.threePoint}</span>
                <span class="draft-attr-badge">DEF: ${p.attributes.defensive.perimeterDefense}</span>
                <span class="draft-attr-badge">ATH: ${p.attributes.athletic.speed}</span>
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
                <div class="draft-prospect-name">${p.name}</div>
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
                <span class="prospect-attr-value">${prospect.attributes.athletic.speed}</span>
              </div>
              <div class="prospect-attr-item">
                <span>Vertical</span>
                <span class="prospect-attr-value">${prospect.attributes.athletic.vertical}</span>
              </div>
              <div class="prospect-attr-item">
                <span>Strength</span>
                <span class="prospect-attr-value">${prospect.attributes.athletic.strength}</span>
              </div>
            </div>
            
            <div class="prospect-attr-group">
              <h4>Offense</h4>
              <div class="prospect-attr-item">
                <span>3PT Shooting</span>
                <span class="prospect-attr-value">${prospect.attributes.offensive.threePoint}</span>
              </div>
              <div class="prospect-attr-item">
                <span>Finishing</span>
                <span class="prospect-attr-value">${prospect.attributes.offensive.finishing}</span>
              </div>
              <div class="prospect-attr-item">
                <span>Ball Handling</span>
                <span class="prospect-attr-value">${prospect.attributes.offensive.ballHandling}</span>
              </div>
            </div>
            
            <div class="prospect-attr-group">
              <h4>Defense</h4>
              <div class="prospect-attr-item">
                <span>Perimeter D</span>
                <span class="prospect-attr-value">${prospect.attributes.defensive.perimeterDefense}</span>
              </div>
              <div class="prospect-attr-item">
                <span>Interior D</span>
                <span class="prospect-attr-value">${prospect.attributes.defensive.interiorDefense}</span>
              </div>
              <div class="prospect-attr-item">
                <span>Rebounding</span>
                <span class="prospect-attr-value">${prospect.attributes.defensive.defensiveRebounding}</span>
              </div>
            </div>
            
            <div class="prospect-attr-group">
              <h4>Mental</h4>
              <div class="prospect-attr-item">
                <span>Basketball IQ</span>
                <span class="prospect-attr-value">${prospect.attributes.mental.basketballIQ}</span>
              </div>
              <div class="prospect-attr-item">
                <span>Work Ethic</span>
                <span class="prospect-attr-value">${prospect.attributes.mental.workEthic}</span>
              </div>
              <div class="prospect-attr-item">
                <span>Leadership</span>
                <span class="prospect-attr-value">${prospect.attributes.mental.leadership}</span>
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
              <span>${prospect.attributes.athletic.speed}</span>
            </div>
            <div class="prospect-attr-bar">
              <span>Vertical</span>
              <span>${prospect.attributes.athletic.vertical}</span>
            </div>
            <div class="prospect-attr-bar">
              <span>Strength</span>
              <span>${prospect.attributes.athletic.strength}</span>
            </div>
          </div>
          
          <div class="prospect-attr-group">
            <h4>Offense</h4>
            <div class="prospect-attr-bar">
              <span>3PT Shooting</span>
              <span>${prospect.attributes.offensive.threePoint}</span>
            </div>
            <div class="prospect-attr-bar">
              <span>Finishing</span>
              <span>${prospect.attributes.offensive.finishing}</span>
            </div>
            <div class="prospect-attr-bar">
              <span>Ball Handling</span>
              <span>${prospect.attributes.offensive.ballHandling}</span>
            </div>
          </div>
          
          <div class="prospect-attr-group">
            <h4>Defense</h4>
            <div class="prospect-attr-bar">
              <span>Perimeter D</span>
              <span>${prospect.attributes.defensive.perimeterDefense}</span>
            </div>
            <div class="prospect-attr-bar">
              <span>Interior D</span>
              <span>${prospect.attributes.defensive.interiorDefense}</span>
            </div>
            <div class="prospect-attr-bar">
              <span>Rebounding</span>
              <span>${prospect.attributes.defensive.defensiveRebounding}</span>
            </div>
          </div>
          
          <div class="prospect-attr-group">
            <h4>Mental</h4>
            <div class="prospect-attr-bar">
              <span>Basketball IQ</span>
              <span>${prospect.attributes.mental.basketballIQ}</span>
            </div>
            <div class="prospect-attr-bar">
              <span>Work Ethic</span>
              <span>${prospect.attributes.mental.workEthic}</span>
            </div>
            <div class="prospect-attr-bar">
              <span>Leadership</span>
              <span>${prospect.attributes.mental.leadership}</span>
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
