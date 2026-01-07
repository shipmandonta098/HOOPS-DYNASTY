/* ============================
   PLAYERS TAB - League-Wide Player Database
   Comprehensive player analysis, filtering, and management
============================ */

// Players tab state
const playersState = {
  sortColumn: 'ovr',
  sortDirection: 'desc',
  filters: {
    team: 'all',
    position: 'all',
    ageMin: 18,
    ageMax: 40,
    ovrMin: 0,
    ovrMax: 100,
    potMin: 0,
    potMax: 100,
    contractYears: 'all',
    salaryMin: 0,
    salaryMax: 50000000,
    expiring: false,
    freeAgentsOnly: false,
    injured: 'all',
    gender: 'all'
  },
  visibleColumns: new Set([
    'name', 'position', 'team', 'age', 'ovr', 'pot', 
    'contract', 'expiration', 'height', 'weight', 'wingspan'
  ]),
  savedViews: {
    'all-players': { name: 'All Players', filters: {}, columns: null },
    'top-100': { name: 'Top 100 Players', filters: { ovrMin: 75 }, sort: { column: 'ovr', direction: 'desc' } },
    'expiring-deals': { name: 'Expiring Contracts', filters: { expiring: true } },
    'young-stars': { name: 'Future Stars (≤23 & POT ≥80)', filters: { ageMax: 23, potMin: 80 } },
    'bad-contracts': { name: 'Overpaid Players', filters: { ovrMax: 70, salaryMin: 15000000 } },
    'free-agents': { name: 'Free Agents', filters: { freeAgentsOnly: true } }
  },
  currentView: 'all-players',
  watchlist: new Set(),
  compareList: [],
  showCompareModal: false
};

// Get all players in the league
function getAllPlayers() {
  if (!league) return [];
  
  const allPlayers = [];
  
  // Add team players
  league.teams.forEach(team => {
    if (team.players) {
      team.players.forEach(player => {
        allPlayers.push({
          ...player,
          teamId: team.id,
          teamName: team.name,
          teamAbbr: getTeamAbbr(team.name)
        });
      });
    }
  });
  
  // Add free agents
  if (league.freeAgents) {
    league.freeAgents.forEach(player => {
      allPlayers.push({
        ...player,
        teamId: null,
        teamName: 'Free Agent',
        teamAbbr: 'FA'
      });
    });
  }
  
  return allPlayers;
}

// Filter players based on current filters
function filterPlayers(players) {
  const f = playersState.filters;
  
  return players.filter(p => {
    // Team filter
    if (f.team !== 'all' && p.teamId != f.team) return false;
    
    // Position filter
    if (f.position !== 'all' && p.pos !== f.position) return false;
    
    // Age filter
    if (p.age < f.ageMin || p.age > f.ageMax) return false;
    
    // OVR filter
    if (p.ovr < f.ovrMin || p.ovr > f.ovrMax) return false;
    
    // POT filter
    if (p.pot < f.potMin || p.pot > f.potMax) return false;
    
    // Salary filter
    const salary = p.contract?.amount || 0;
    if (salary < f.salaryMin || salary > f.salaryMax) return false;
    
    // Contract years filter
    if (f.contractYears !== 'all') {
      const yearsLeft = p.contract?.exp ? (p.contract.exp - league.season) : 0;
      if (f.contractYears === '0' && yearsLeft !== 0) return false;
      if (f.contractYears === '1' && yearsLeft !== 1) return false;
      if (f.contractYears === '2+' && yearsLeft < 2) return false;
    }
    
    // Expiring contract filter
    if (f.expiring && p.contract) {
      const yearsLeft = p.contract.exp - league.season;
      if (yearsLeft > 1) return false;
    }
    
    // Free agents only
    if (f.freeAgentsOnly && p.teamId !== null) return false;
    
    // Injury filter
    if (f.injured !== 'all') {
      const isInjured = p.injury && p.injury.gamesRemaining > 0;
      if (f.injured === 'injured' && !isInjured) return false;
      if (f.injured === 'healthy' && isInjured) return false;
    }
    
    // Gender filter
    if (f.gender !== 'all' && p.gender !== f.gender) return false;
    
    return true;
  });
}

// Sort players
function sortPlayers(players) {
  const { sortColumn, sortDirection } = playersState;
  const mult = sortDirection === 'asc' ? 1 : -1;
  
  return [...players].sort((a, b) => {
    let aVal, bVal;
    
    switch (sortColumn) {
      case 'name':
        aVal = a.name || '';
        bVal = b.name || '';
        return mult * aVal.localeCompare(bVal);
      
      case 'position':
        aVal = a.pos || '';
        bVal = b.pos || '';
        return mult * aVal.localeCompare(bVal);
      
      case 'team':
        aVal = a.teamName || '';
        bVal = b.teamName || '';
        return mult * aVal.localeCompare(bVal);
      
      case 'age':
        return mult * ((a.age || 0) - (b.age || 0));
      
      case 'ovr':
        return mult * ((a.ovr || 0) - (b.ovr || 0));
      
      case 'pot':
        return mult * ((a.pot || 0) - (b.pot || 0));
      
      case 'salary':
        aVal = a.contract?.amount || 0;
        bVal = b.contract?.amount || 0;
        return mult * (aVal - bVal);
      
      case 'expiration':
        aVal = a.contract?.exp || 9999;
        bVal = b.contract?.exp || 9999;
        return mult * (aVal - bVal);
      
      case 'height':
        aVal = a.bio?.heightInches || 0;
        bVal = b.bio?.heightInches || 0;
        return mult * (aVal - bVal);
      
      case 'weight':
        aVal = a.bio?.weightLbs || 0;
        bVal = b.bio?.weightLbs || 0;
        return mult * (aVal - bVal);
      
      case 'wingspan':
        aVal = a.bio?.wingspanInches || 0;
        bVal = b.bio?.wingspanInches || 0;
        return mult * (aVal - bVal);
      
      default:
        return 0;
    }
  });
}

// Get player context indicators
function getPlayerIndicators(player) {
  const indicators = [];
  
  // Expiring contract
  if (player.contract && (player.contract.exp - league.season) <= 1) {
    indicators.push({ icon: '⏳', tooltip: 'Contract expiring soon', color: '#f39c12' });
  }
  
  // Declining
  if (player.age >= 32 && player.ovr > player.pot + 5) {
    indicators.push({ icon: '📉', tooltip: 'Declining', color: '#e74c3c' });
  }
  
  // Improving
  if (player.pot > player.ovr + 10 && player.age < 25) {
    indicators.push({ icon: '📈', tooltip: 'High upside', color: '#27ae60' });
  }
  
  // Rookie
  if (player.draft && player.draft.year === league.season) {
    indicators.push({ icon: '🐣', tooltip: 'Rookie', color: '#3498db' });
  }
  
  // Injured
  if (player.injury && player.injury.gamesRemaining > 0) {
    indicators.push({ icon: '🏥', tooltip: `Injured (${player.injury.gamesRemaining} games)`, color: '#e74c3c' });
  }
  
  // High OVR
  if (player.ovr >= 85) {
    indicators.push({ icon: '⭐', tooltip: 'Elite player', color: '#f1c40f' });
  }
  
  // Franchise player
  if (player.ovr >= 90) {
    indicators.push({ icon: '🔒', tooltip: 'Franchise cornerstone', color: '#9b59b6' });
  }
  
  return indicators;
}

// Format contract display
function formatContract(player) {
  if (!player.contract || !player.contract.amount) {
    return '<span style="color: #666;">N/A</span>';
  }
  
  const amount = player.contract.amount;
  const yearsLeft = player.contract.exp - league.season;
  const amountStr = amount >= 1000000 
    ? `$${(amount / 1000000).toFixed(1)}M` 
    : `$${(amount / 1000).toFixed(0)}K`;
  
  const color = yearsLeft === 0 ? '#e74c3c' : yearsLeft === 1 ? '#f39c12' : '#fff';
  
  return `<span style="color: ${color};">${amountStr} / ${yearsLeft}yr</span>`;
}

// Render players table
function renderPlayersTable(players) {
  const cols = playersState.visibleColumns;
  
  if (players.length === 0) {
    return `
      <div style="
        padding: 60px 20px;
        text-align: center;
        color: #666;
      ">
        <div style="font-size: 3em; margin-bottom: 15px;">🔍</div>
        <div style="font-size: 1.2em; margin-bottom: 8px;">No players found</div>
        <div style="font-size: 0.9em;">Try adjusting your filters</div>
      </div>
    `;
  }
  
  const headerStyle = `
    padding: 12px 8px;
    background: #0f1624;
    border-bottom: 2px solid #2a2a40;
    color: #888;
    font-size: 0.8em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    cursor: pointer;
    user-select: none;
    position: sticky;
    top: 0;
    z-index: 5;
    transition: all 0.2s;
  `;
  
  const renderSortIcon = (column) => {
    if (playersState.sortColumn !== column) return ' ↕';
    return playersState.sortDirection === 'asc' ? ' ↑' : ' ↓';
  };
  
  return `
    <div style="overflow-x: auto;">
      <table style="
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9em;
      ">
        <thead>
          <tr style="background: #0f1624;">
            <th style="${headerStyle}" title="Compare players">
              <input type="checkbox" 
                ${playersState.compareList.length === players.length && players.length > 0 ? 'checked' : ''}
                onchange="toggleAllCompare(this.checked, ${JSON.stringify(players.slice(0, 4).map(p => p.pid))})"
                style="cursor: pointer; width: 18px; height: 18px;">
            </th>
            ${cols.has('name') ? `<th onclick="sortPlayersBy('name')" style="${headerStyle}">Player${renderSortIcon('name')}</th>` : ''}
            ${cols.has('position') ? `<th onclick="sortPlayersBy('position')" style="${headerStyle}">Pos${renderSortIcon('position')}</th>` : ''}
            ${cols.has('team') ? `<th onclick="sortPlayersBy('team')" style="${headerStyle}">Team${renderSortIcon('team')}</th>` : ''}
            ${cols.has('age') ? `<th onclick="sortPlayersBy('age')" style="${headerStyle}">Age${renderSortIcon('age')}</th>` : ''}
            ${cols.has('ovr') ? `<th onclick="sortPlayersBy('ovr')" style="${headerStyle}">OVR${renderSortIcon('ovr')}</th>` : ''}
            ${cols.has('pot') ? `<th onclick="sortPlayersBy('pot')" style="${headerStyle}">POT${renderSortIcon('pot')}</th>` : ''}
            ${cols.has('contract') ? `<th onclick="sortPlayersBy('salary')" style="${headerStyle}">Contract${renderSortIcon('salary')}</th>` : ''}
            ${cols.has('expiration') ? `<th onclick="sortPlayersBy('expiration')" style="${headerStyle}">Expires${renderSortIcon('expiration')}</th>` : ''}
            ${cols.has('height') ? `<th onclick="sortPlayersBy('height')" style="${headerStyle}">Height${renderSortIcon('height')}</th>` : ''}
            ${cols.has('weight') ? `<th onclick="sortPlayersBy('weight')" style="${headerStyle}">Weight${renderSortIcon('weight')}</th>` : ''}
            ${cols.has('wingspan') ? `<th onclick="sortPlayersBy('wingspan')" style="${headerStyle}">Wingspan${renderSortIcon('wingspan')}</th>` : ''}
            <th style="${headerStyle}">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${players.map(p => renderPlayerRow(p)).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Render individual player row
function renderPlayerRow(player) {
  const cols = playersState.visibleColumns;
  const indicators = getPlayerIndicators(player);
  const isWatched = playersState.watchlist.has(player.pid);
  const isInCompare = playersState.compareList.includes(player.pid);
  
  const rowStyle = `
    border-bottom: 1px solid #1a2332;
    transition: background 0.2s;
    background: ${isInCompare ? '#1a2a3a' : ''};
  `;
  
  const cellStyle = `
    padding: 12px 8px;
    color: #e5e7eb;
  `;
  
  return `
    <tr style="${rowStyle}" onmouseover="this.style.background='#1a2332'" onmouseout="this.style.background='${isInCompare ? '#1a2a3a' : ''}'">
      <td style="${cellStyle}">
        <input type="checkbox" 
          ${isInCompare ? 'checked' : ''} 
          ${playersState.compareList.length >= 4 && !isInCompare ? 'disabled' : ''}
          onchange="toggleCompare(${player.pid})" 
          style="cursor: pointer; width: 18px; height: 18px;"
          title="${playersState.compareList.length >= 4 && !isInCompare ? 'Max 4 players' : 'Add to comparison'}">
      </td>
      ${cols.has('name') ? `
        <td style="${cellStyle}">
          <div style="display: flex; align-items: center; gap: 6px;">
            ${isWatched ? '<span style="color: #f1c40f;">⭐</span>' : ''}
            <span style="font-weight: 500;">${player.name}</span>
            ${indicators.map(ind => `
              <span title="${ind.tooltip}" style="color: ${ind.color}; font-size: 0.9em;">${ind.icon}</span>
            `).join('')}
          </div>
        </td>
      ` : ''}
      ${cols.has('position') ? `<td style="${cellStyle}">${player.pos || '-'}</td>` : ''}
      ${cols.has('team') ? `
        <td style="${cellStyle}">
          <span style="
            padding: 4px 8px;
            background: ${player.teamId ? '#2a2a40' : '#e74c3c'};
            border-radius: 4px;
            font-size: 0.85em;
            font-weight: 600;
          ">${player.teamAbbr}</span>
        </td>
      ` : ''}
      ${cols.has('age') ? `<td style="${cellStyle}">${player.age}</td>` : ''}
      ${cols.has('ovr') ? `
        <td style="${cellStyle}">
          <span style="
            padding: 3px 8px;
            background: ${getOVRColor(player.ovr)};
            border-radius: 4px;
            font-weight: 600;
          ">${player.ovr}</span>
        </td>
      ` : ''}
      ${cols.has('pot') ? `
        <td style="${cellStyle}">
          <span style="color: ${player.pot > player.ovr ? '#27ae60' : '#666'};">${player.pot}</span>
        </td>
      ` : ''}
      ${cols.has('contract') ? `<td style="${cellStyle}">${formatContract(player)}</td>` : ''}
      ${cols.has('expiration') ? `<td style="${cellStyle}">${player.contract?.exp || '-'}</td>` : ''}
      ${cols.has('height') ? `<td style="${cellStyle}">${player.bio?.height || '-'}</td>` : ''}
      ${cols.has('weight') ? `<td style="${cellStyle}">${player.bio?.weight || '-'}</td>` : ''}
      ${cols.has('wingspan') ? `<td style="${cellStyle}">${player.bio?.wingspan || '-'}</td>` : ''}
      <td style="${cellStyle}">
        <div style="display: flex; gap: 6px;">
          <button onclick="toggleWatchlist(${player.pid})" style="
            padding: 4px 8px;
            background: ${isWatched ? '#f1c40f' : '#2a2a40'};
            color: ${isWatched ? '#000' : '#fff'};
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.75em;
          " title="${isWatched ? 'Remove from watchlist' : 'Add to watchlist'}">
            ${isWatched ? '★' : '☆'}
          </button>
          <button onclick="viewPlayerProfile(${player.pid})" style="
            padding: 4px 8px;
            background: #2196F3;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.75em;
          ">View</button>
        </div>
      </td>
    </tr>
  `;
}

// Get OVR color
function getOVRColor(ovr) {
  if (ovr >= 90) return '#9b59b6';
  if (ovr >= 85) return '#e74c3c';
  if (ovr >= 80) return '#f39c12';
  if (ovr >= 75) return '#27ae60';
  if (ovr >= 70) return '#3498db';
  return '#2a2a40';
}

// Render filter controls
function renderFilters() {
  const f = playersState.filters;
  const teams = league.teams || [];
  
  return `
    <div style="
      background: #0f1624;
      padding: 20px;
      border-bottom: 2px solid #2a2a40;
    ">
      <div style="
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
      ">
        <!-- Team Filter -->
        <select onchange="updatePlayerFilter('team', this.value)" style="
          padding: 10px;
          background: #1a2332;
          color: #fff;
          border: 1px solid #2a2a40;
          border-radius: 6px;
        ">
          <option value="all" ${f.team === 'all' ? 'selected' : ''}>All Teams</option>
          ${teams.map(t => `
            <option value="${t.id}" ${f.team == t.id ? 'selected' : ''}>${t.name}</option>
          `).join('')}
        </select>
        
        <!-- Position Filter -->
        <select onchange="updatePlayerFilter('position', this.value)" style="
          padding: 10px;
          background: #1a2332;
          color: #fff;
          border: 1px solid #2a2a40;
          border-radius: 6px;
        ">
          <option value="all">All Positions</option>
          <option value="PG" ${f.position === 'PG' ? 'selected' : ''}>PG</option>
          <option value="SG" ${f.position === 'SG' ? 'selected' : ''}>SG</option>
          <option value="SF" ${f.position === 'SF' ? 'selected' : ''}>SF</option>
          <option value="PF" ${f.position === 'PF' ? 'selected' : ''}>PF</option>
          <option value="C" ${f.position === 'C' ? 'selected' : ''}>C</option>
        </select>
        
        <!-- Age Range -->
        <div style="display: flex; gap: 8px; align-items: center;">
          <label style="color: #888; font-size: 0.85em; white-space: nowrap;">Age:</label>
          <input type="number" value="${f.ageMin}" onchange="updatePlayerFilter('ageMin', parseInt(this.value))" 
            min="18" max="40" style="
              width: 60px;
              padding: 8px;
              background: #1a2332;
              color: #fff;
              border: 1px solid #2a2a40;
              border-radius: 4px;
            ">
          <span style="color: #666;">-</span>
          <input type="number" value="${f.ageMax}" onchange="updatePlayerFilter('ageMax', parseInt(this.value))" 
            min="18" max="40" style="
              width: 60px;
              padding: 8px;
              background: #1a2332;
              color: #fff;
              border: 1px solid #2a2a40;
              border-radius: 4px;
            ">
        </div>
        
        <!-- OVR Range -->
        <div style="display: flex; gap: 8px; align-items: center;">
          <label style="color: #888; font-size: 0.85em; white-space: nowrap;">OVR:</label>
          <input type="number" value="${f.ovrMin}" onchange="updatePlayerFilter('ovrMin', parseInt(this.value))" 
            min="0" max="100" style="
              width: 60px;
              padding: 8px;
              background: #1a2332;
              color: #fff;
              border: 1px solid #2a2a40;
              border-radius: 4px;
            ">
          <span style="color: #666;">-</span>
          <input type="number" value="${f.ovrMax}" onchange="updatePlayerFilter('ovrMax', parseInt(this.value))" 
            min="0" max="100" style="
              width: 60px;
              padding: 8px;
              background: #1a2332;
              color: #fff;
              border: 1px solid #2a2a40;
              border-radius: 4px;
            ">
        </div>
        
        <!-- Contract Years -->
        <select onchange="updatePlayerFilter('contractYears', this.value)" style="
          padding: 10px;
          background: #1a2332;
          color: #fff;
          border: 1px solid #2a2a40;
          border-radius: 6px;
        ">
          <option value="all">All Contracts</option>
          <option value="0" ${f.contractYears === '0' ? 'selected' : ''}>Expiring This Year</option>
          <option value="1" ${f.contractYears === '1' ? 'selected' : ''}>1 Year Left</option>
          <option value="2+" ${f.contractYears === '2+' ? 'selected' : ''}>2+ Years Left</option>
        </select>
        
        <!-- Quick Toggles -->
        <div style="display: flex; gap: 8px; align-items: center;">
          <label style="
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            background: ${f.freeAgentsOnly ? '#2196F3' : '#1a2332'};
            border: 1px solid #2a2a40;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.85em;
          ">
            <input type="checkbox" ${f.freeAgentsOnly ? 'checked' : ''} 
              onchange="updatePlayerFilter('freeAgentsOnly', this.checked)" 
              style="cursor: pointer;">
            Free Agents Only
          </label>
        </div>
      </div>
      
      <div style="margin-top: 12px; display: flex; gap: 8px; justify-content: flex-end;">
        <button onclick="resetPlayerFilters()" style="
          padding: 8px 16px;
          background: #2a2a40;
          color: #fff;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.85em;
        ">Reset Filters</button>
      </div>
    </div>
  `;
}

// Render saved views
function renderSavedViews() {
  const views = playersState.savedViews;
  
  return `
    <div style="
      background: #0f1624;
      padding: 12px 20px;
      border-bottom: 1px solid #2a2a40;
      display: flex;
      gap: 8px;
      overflow-x: auto;
    ">
      <span style="color: #888; font-size: 0.85em; margin-right: 8px; align-self: center;">Quick Views:</span>
      ${Object.entries(views).map(([key, view]) => `
        <button onclick="loadSavedView('${key}')" style="
          padding: 8px 16px;
          background: ${playersState.currentView === key ? '#2196F3' : '#2a2a40'};
          color: #fff;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.85em;
          white-space: nowrap;
          transition: all 0.2s;
        " onmouseover="this.style.background='#2196F3'" onmouseout="if('${playersState.currentView}' !== '${key}') this.style.background='#2a2a40'">
          ${view.name}
        </button>
      `).join('')}
    </div>
  `;
}

// Main Players tab render
function renderPlayers() {
  const el = document.getElementById('players-tab');
  
  if (!league) {
    el.innerHTML = '<div style="padding: 20px; color: #fff;">No league loaded</div>';
    return;
  }
   padding-bottom: ${playersState.compareList.length > 0 ? '120px' : '20px'};">
      <!-- Header -->
      <div style="
        background: linear-gradient(135deg, #1a2332 0%, #0f1624 100%);
        padding: 30px 20px 20px 20px;
        border-bottom: 2px solid #2a2a40;
      ">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div>
            <h1 style="margin: 0 0 8px 0; color: #fff; font-size: 2em;">👥 Players</h1>
            <div style="color: #888; font-size: 0.95em;">
              Showing ${sortedPlayers.length} of ${allPlayers.length} players
              ${playersState.watchlist.size > 0 ? ` • ${playersState.watchlist.size} on watchlist` : ''}
              ${playersState.compareList.length > 0 ? ` • ${playersState.compareList.length} selected for comparison` : ''}
            </div>
          </div>
          <button onclick="toggleColumnSelector()" style="
            padding: 10px 20px;
            background: #2a2a40;
            color: #fff;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9em;
          ">⚙️ Columns</button>
        </div>
      </div>
      
      <!-- Saved Views -->
      ${renderSavedViews()}
      
      <!-- Filters -->
      ${renderFilters()}
      
      <!-- Players Table -->
      ${renderPlayersTable(sortedPlayers)}
      
      <!-- Comparison Tray -->
      ${renderComparisonTray()}
      
      <!-- Comparison Modal -->
      ${playersState.showCompareModal ? renderCompareModal() : ''
      
      <!-- Filters -->
      ${renderFilters()}
      
      <!-- Players Table -->
      ${renderPlayersTable(sortedPlayers)}
    </div>
  `;
}

// Update filter
function updatePlayerFilter(key, value) {
  playersState.filters[key] = value;
  playersState.currentView = 'custom';
  render();
}

// Reset filters
function resetPlayerFilters() {
  playersState.filters = {
    team: 'all',
    position: 'all',
    ageMin: 18,
    ageMax: 40,
    ovrMin: 0,
    ovrMax: 100,
    potMin: 0,
    potMax: 100,
    contractYears: 'all',
    salaryMin: 0,
    salaryMax: 50000000,
    expiring: false,
    freeAgentsOnly: false,
    injured: 'all',
    gender: 'all'
  };
  playersState.currentView = 'all-players';
  render();
}

// Sort players by column
function sortPlayersBy(column) {
  if (playersState.sortColumn === column) {
    playersState.sortDirection = playersState.sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    playersState.sortColumn = column;
    playersState.sortDirection = 'desc';
  }
  render();
}

// Load saved view
function loadSavedView(viewKey) {
  const view = playersState.savedViews[viewKey];
  if (!view) return;
  
  // Reset filters first
  resetPlayerFilters();
  
  // Apply view filters
  if (view.filters) {
    Object.assign(playersState.filters, view.filters);
  }
  
  // Apply sorting
  if (view.sort) {
    playersState.sortColumn = view.sort.column;
    playersState.sortDirection = view.sort.direction;
  }
  
  playersState.currentView = viewKey;
  render();
}

// Toggle watchlist
function toggleWatchlist(playerId) {
  if (playersState.watchlist.has(playerId)) {
    playersState.watchlist.delete(playerId);
  } else {
    playersState.watchlist.add(playerId);
  }
  render();
}

// View player profile
function viewPlayerProfile(playerId) {
  // Find the player
  const allPlayers = getAllPlayers();
  const player = allPlayers.find(p => p.pid === playerId);
  
  if (!player) return;
  
  alert(`Player Profile: ${player.name}\n\nThis would open a detailed player profile modal.\nComing soon!`);
}

// Toggle column selector
function toggleColumnSelector() {
  alert('Column selector coming soon!\n\nYou\'ll be able to show/hide:\n- Usage Rate\n- PER\n- Ratings (Off/Def)\n- Physical stats\n- And more...');
}

// Get team abbreviation
function getTeamAbbr(teamName) {
  if (!teamName) return 'FA';
  const parts = teamName.split(' ');
  if (parts.length === 1) return teamName.substring(0, 3).toUpperCase();
  return parts.map(p => p[0]).join('').toUpperCase().substring(0, 3);
}

// Toggle compare
function toggleCompare(playerId) {
  const index = playersState.compareList.indexOf(playerId);
  if (index > -1) {
    playersState.compareList.splice(index, 1);
  } else {
    if (playersState.compareList.length < 4) {
      playersState.compareList.push(playerId);
    }
  }
  render();
}

// Toggle all compare
function toggleAllCompare(checked, playerIds) {
  if (checked) {
    playerIds.forEach(pid => {
      if (!playersState.compareList.includes(pid) && playersState.compareList.length < 4) {
        playersState.compareList.push(pid);
      }
    });
  } else {
    playersState.compareList = [];
  }
  render();
}

// Clear comparison
function clearComparison() {
  playersState.compareList = [];
  playersState.showCompareModal = false;
  render();
}

// Remove from comparison
function removeFromCompare(playerId) {
  const index = playersState.compareList.indexOf(playerId);
  if (index > -1) {
    playersState.compareList.splice(index, 1);
  }
  if (playersState.compareList.length === 0) {
    playersState.showCompareModal = false;
  }
  render();
}

// Show comparison modal
function showCompareModal() {
  if (playersState.compareList.length === 0) return;
  playersState.showCompareModal = true;
  render();
}

// Close comparison modal
function closeCompareModal() {
  playersState.showCompareModal = false;
  render();
}

// Render comparison tray
function renderComparisonTray() {
  if (playersState.compareList.length === 0) return '';
  
  const allPlayers = getAllPlayers();
  const selectedPlayers = playersState.compareList
    .map(pid => allPlayers.find(p => p.pid === pid))
    .filter(p => p);
  
  return `
    <div style="
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #1a2332 0%, #0f1624 100%);
      border-top: 3px solid #2196F3;
      padding: 15px 20px;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
      z-index: 100;
      display: flex;
      align-items: center;
      gap: 15px;
      overflow-x: auto;
    ">
      <div style="
        color: #888;
        font-size: 0.9em;
        font-weight: 600;
        white-space: nowrap;
      ">
        COMPARE (${selectedPlayers.length}/4):
      </div>
      
      <div style="
        display: flex;
        gap: 10px;
        flex: 1;
        overflow-x: auto;
      ">
        ${selectedPlayers.map(p => `
          <div style="
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: #2a2a40;
            border: 2px solid #2196F3;
            border-radius: 8px;
            white-space: nowrap;
          ">
            <div style="display: flex; flex-direction: column;">
              <span style="font-weight: 600; color: #fff; font-size: 0.9em;">${p.name}</span>
              <span style="color: #888; font-size: 0.75em;">${p.teamAbbr} • ${p.pos} • OVR ${p.ovr}</span>
            </div>
            <button onclick="removeFromCompare(${p.pid})" style="
              background: transparent;
              color: #e74c3c;
              border: none;
              cursor: pointer;
              font-size: 1.2em;
              padding: 0 4px;
              line-height: 1;
            " title="Remove">×</button>
          </div>
        `).join('')}
      </div>
      
      <div style="display: flex; gap: 10px; white-space: nowrap;">
        <button onclick="showCompareModal()" style="
          padding: 10px 24px;
          background: #2196F3;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.9em;
        ">🔍 Compare</button>
        
        <button onclick="clearComparison()" style="
          padding: 10px 20px;
          background: #e74c3c;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9em;
        ">Clear</button>
      </div>
    </div>
  `;
}

// Comparison modal state
let compareModalTab = 'overview';

function setCompareTab(tab) {
  compareModalTab = tab;
  render();
}

// Render comparison modal
function renderCompareModal() {
  const allPlayers = getAllPlayers();
  const selectedPlayers = playersState.compareList
    .map(pid => allPlayers.find(p => p.pid === pid))
    .filter(p => p);
  
  if (selectedPlayers.length === 0) return '';
  
  return `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.8);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      overflow-y: auto;
    " onclick="if(event.target === this) closeCompareModal()">
      <div style="
        background: #0f1624;
        border-radius: 12px;
        width: 100%;
        max-width: 1400px;
        max-height: 90vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: 0 10px 50px rgba(0,0,0,0.5);
      ">
        <!-- Header -->
        <div style="
          background: linear-gradient(135deg, #1a2332 0%, #0f1624 100%);
          padding: 20px;
          border-bottom: 2px solid #2a2a40;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <h2 style="margin: 0; color: #fff; font-size: 1.5em;">
            🔍 Player Comparison
          </h2>
          <button onclick="closeCompareModal()" style="
            background: transparent;
            color: #888;
            border: none;
            cursor: pointer;
            font-size: 2em;
            line-height: 1;
            padding: 0;
          ">×</button>
        </div>
        
        <!-- Tabs -->
        <div style="
          background: #0f1624;
          padding: 0 10px;
          border-bottom: 2px solid #2a2a40;
          display: flex;
          gap: 5px;
        ">
          ${['overview', 'attributes', 'physical', 'contract'].map(tab => `
            <button onclick="setCompareTab('${tab}')" style="
              padding: 12px 20px;
              background: ${compareModalTab === tab ? '#2196F3' : 'transparent'};
              color: ${compareModalTab === tab ? '#fff' : '#888'};
              border: none;
              border-bottom: 3px solid ${compareModalTab === tab ? '#2196F3' : 'transparent'};
              cursor: pointer;
              font-weight: ${compareModalTab === tab ? '600' : '400'};
              text-transform: capitalize;
              transition: all 0.2s;
            ">${tab}</button>
          `).join('')}
        </div>
        
        <!-- Content -->
        <div style="
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        ">
          ${renderCompareContent(selectedPlayers)}
        </div>
      </div>
    </div>
  `;
}

// Render comparison content based on tab
function renderCompareContent(players) {
  switch (compareModalTab) {
    case 'overview':
      return renderCompareOverview(players);
    case 'attributes':
      return renderCompareAttributes(players);
    case 'physical':
      return renderComparePhysical(players);
    case 'contract':
      return renderCompareContract(players);
    default:
      return renderCompareOverview(players);
  }
}

// Render overview comparison
function renderCompareOverview(players) {
  return `
    <div style="
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    ">
      ${players.map(p => `
        <div style="
          background: #1a2332;
          border-radius: 8px;
          padding: 20px;
          border: 2px solid #2a2a40;
        ">
          <div style="text-align: center; margin-bottom: 15px;">
            <h3 style="margin: 0 0 5px 0; color: #fff; font-size: 1.2em;">${p.name}</h3>
            <div style="color: #888; font-size: 0.85em;">${p.teamName}</div>
          </div>
          
          <div style="
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            margin-top: 15px;
          ">
            <div style="text-align: center;">
              <div style="color: #888; font-size: 0.75em; margin-bottom: 4px;">POSITION</div>
              <div style="color: #fff; font-weight: 600;">${p.pos}</div>
            </div>
            <div style="text-align: center;">
              <div style="color: #888; font-size: 0.75em; margin-bottom: 4px;">AGE</div>
              <div style="color: #fff; font-weight: 600;">${p.age}</div>
            </div>
            <div style="text-align: center;">
              <div style="color: #888; font-size: 0.75em; margin-bottom: 4px;">OVR</div>
              <div style="
                display: inline-block;
                padding: 4px 10px;
                background: ${getOVRColor(p.ovr)};
                border-radius: 4px;
                font-weight: 600;
                color: #fff;
              ">${p.ovr}</div>
            </div>
            <div style="text-align: center;">
              <div style="color: #888; font-size: 0.75em; margin-bottom: 4px;">POT</div>
              <div style="color: ${p.pot > p.ovr ? '#27ae60' : '#888'}; font-weight: 600;">${p.pot}</div>
            </div>
          </div>
          
          <div style="
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #2a2a40;
            text-align: center;
          ">
            <div style="color: #888; font-size: 0.75em; margin-bottom: 4px;">CONTRACT</div>
            <div style="color: #fff;">${formatContract(p)}</div>
            <div style="color: #888; font-size: 0.8em; margin-top: 2px;">Exp: ${p.contract?.exp || 'N/A'}</div>
          </div>
          
          <div style="
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #2a2a40;
          ">
            <div style="display: flex; justify-content: space-around; font-size: 0.85em;">
              <div style="text-align: center;">
                <div style="color: #888; font-size: 0.8em;">HT</div>
                <div style="color: #fff;">${p.bio?.height || '-'}</div>
              </div>
              <div style="text-align: center;">
                <div style="color: #888; font-size: 0.8em;">WT</div>
                <div style="color: #fff;">${p.bio?.weight || '-'}</div>
              </div>
              <div style="text-align: center;">
                <div style="color: #888; font-size: 0.8em;">WS</div>
                <div style="color: #fff;">${p.bio?.wingspan || '-'}</div>
              </div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Render attributes comparison
function renderCompareAttributes(players) {
  const attributes = [
    { key: 'hgt', label: 'Height' },
    { key: 'spd', label: 'Speed' },
    { key: 'jmp', label: 'Jump' },
    { key: 'endu', label: 'Endurance' },
    { key: 'ins', label: 'Inside' },
    { key: 'dnk', label: 'Dunking' },
    { key: 'ft', label: 'Free Throw' },
    { key: 'fg', label: 'Field Goal' },
    { key: 'tp', label: '3-Point' },
    { key: 'oiq', label: 'Off IQ' },
    { key: 'diq', label: 'Def IQ' },
    { key: 'drb', label: 'Dribbling' },
    { key: 'pss', label: 'Passing' },
    { key: 'reb', label: 'Rebounding' }
  ];
  
  return `
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
        <thead>
          <tr style="background: #1a2332;">
            <th style="
              padding: 12px;
              text-align: left;
              color: #888;
              font-size: 0.8em;
              font-weight: 600;
              text-transform: uppercase;
              border-bottom: 2px solid #2a2a40;
              position: sticky;
              left: 0;
              background: #1a2332;
              z-index: 1;
            ">Attribute</th>
            ${players.map(p => `
              <th style="
                padding: 12px;
                text-align: center;
                color: #fff;
                border-bottom: 2px solid #2a2a40;
              ">${p.name}</th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${attributes.map(attr => {
            const values = players.map(p => p.ratings?.[attr.key] || 0);
            const maxValue = Math.max(...values);
            
            return `
              <tr style="border-bottom: 1px solid #1a2332;">
                <td style="
                  padding: 10px 12px;
                  color: #fff;
                  font-weight: 500;
                  position: sticky;
                  left: 0;
                  background: #0f1624;
                  border-right: 1px solid #2a2a40;
                ">${attr.label}</td>
                ${players.map((p, idx) => {
                  const value = p.ratings?.[attr.key] || 0;
                  const isBest = value === maxValue && maxValue > 0;
                  return `
                    <td style="
                      padding: 10px 12px;
                      text-align: center;
                      background: ${isBest ? 'rgba(39, 174, 96, 0.2)' : ''};
                      color: ${isBest ? '#27ae60' : '#fff'};
                      font-weight: ${isBest ? '600' : '400'};
                    ">${value}</td>
                  `;
                }).join('')}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Render physical comparison
function renderComparePhysical(players) {
  const physicals = [
    { key: 'heightInches', label: 'Height (in)', format: v => v || 0 },
    { key: 'weightLbs', label: 'Weight (lbs)', format: v => v || 0 },
    { key: 'wingspanInches', label: 'Wingspan (in)', format: v => v || 0 }
  ];
  
  const ratings = [
    { key: 'spd', label: 'Speed' },
    { key: 'jmp', label: 'Jumping' },
    { key: 'endu', label: 'Endurance' },
    { key: 'str', label: 'Strength' }
  ];
  
  return `
    <div style="overflow-x: auto;">
      <h3 style="color: #fff; margin: 0 0 15px 0;">Physical Measurements</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 0.9em; margin-bottom: 30px;">
        <thead>
          <tr style="background: #1a2332;">
            <th style="
              padding: 12px;
              text-align: left;
              color: #888;
              font-size: 0.8em;
              font-weight: 600;
              text-transform: uppercase;
              border-bottom: 2px solid #2a2a40;
            ">Measurement</th>
            ${players.map(p => `
              <th style="
                padding: 12px;
                text-align: center;
                color: #fff;
                border-bottom: 2px solid #2a2a40;
              ">${p.name}</th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${physicals.map(attr => {
            const values = players.map(p => attr.format(p.bio?.[attr.key]));
            const maxValue = Math.max(...values);
            
            return `
              <tr style="border-bottom: 1px solid #1a2332;">
                <td style="
                  padding: 10px 12px;
                  color: #fff;
                  font-weight: 500;
                ">${attr.label}</td>
                ${players.map((p, idx) => {
                  const value = values[idx];
                  const isBest = value === maxValue && maxValue > 0;
                  return `
                    <td style="
                      padding: 10px 12px;
                      text-align: center;
                      background: ${isBest ? 'rgba(39, 174, 96, 0.2)' : ''};
                      color: ${isBest ? '#27ae60' : '#fff'};
                      font-weight: ${isBest ? '600' : '400'};
                    ">${value}</td>
                  `;
                }).join('')}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      
      <h3 style="color: #fff; margin: 30px 0 15px 0;">Athletic Ratings</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
        <thead>
          <tr style="background: #1a2332;">
            <th style="
              padding: 12px;
              text-align: left;
              color: #888;
              font-size: 0.8em;
              font-weight: 600;
              text-transform: uppercase;
              border-bottom: 2px solid #2a2a40;
            ">Rating</th>
            ${players.map(p => `
              <th style="
                padding: 12px;
                text-align: center;
                color: #fff;
                border-bottom: 2px solid #2a2a40;
              ">${p.name}</th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${ratings.map(attr => {
            const values = players.map(p => p.ratings?.[attr.key] || 0);
            const maxValue = Math.max(...values);
            
            return `
              <tr style="border-bottom: 1px solid #1a2332;">
                <td style="
                  padding: 10px 12px;
                  color: #fff;
                  font-weight: 500;
                ">${attr.label}</td>
                ${players.map((p, idx) => {
                  const value = p.ratings?.[attr.key] || 0;
                  const isBest = value === maxValue && maxValue > 0;
                  return `
                    <td style="
                      padding: 10px 12px;
                      text-align: center;
                      background: ${isBest ? 'rgba(39, 174, 96, 0.2)' : ''};
                      color: ${isBest ? '#27ae60' : '#fff'};
                      font-weight: ${isBest ? '600' : '400'};
                    ">${value}</td>
                  `;
                }).join('')}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Render contract comparison
function renderCompareContract(players) {
  return `
    <div style="
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
    ">
      ${players.map(p => {
        const contract = p.contract || {};
        const yearsLeft = contract.exp ? (contract.exp - league.season) : 0;
        const amount = contract.amount || 0;
        const avgSalary = amount;
        
        return `
          <div style="
            background: #1a2332;
            border-radius: 8px;
            padding: 20px;
            border: 2px solid #2a2a40;
          ">
            <h3 style="margin: 0 0 15px 0; color: #fff;">${p.name}</h3>
            
            <div style="margin-bottom: 20px;">
              <div style="color: #888; font-size: 0.75em; margin-bottom: 4px;">ANNUAL SALARY</div>
              <div style="
                color: #fff;
                font-size: 1.5em;
                font-weight: 600;
              ">
                ${amount >= 1000000 ? `$${(amount / 1000000).toFixed(2)}M` : `$${(amount / 1000).toFixed(0)}K`}
              </div>
            </div>
            
            <div style="
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
              margin-bottom: 15px;
            ">
              <div>
                <div style="color: #888; font-size: 0.75em; margin-bottom: 4px;">YEARS LEFT</div>
                <div style="
                  color: ${yearsLeft <= 1 ? '#e74c3c' : '#fff'};
                  font-weight: 600;
                ">${yearsLeft}</div>
              </div>
              <div>
                <div style="color: #888; font-size: 0.75em; margin-bottom: 4px;">EXPIRES</div>
                <div style="color: #fff; font-weight: 600;">${contract.exp || 'N/A'}</div>
              </div>
            </div>
            
            <div style="
              padding-top: 15px;
              border-top: 1px solid #2a2a40;
              margin-top: 15px;
            ">
              <div style="color: #888; font-size: 0.75em; margin-bottom: 4px;">VALUE RATING</div>
              <div style="color: #fff;">
                ${amount > 0 ? `$${(amount / Math.max(p.ovr, 1) / 1000000).toFixed(2)}M per OVR point` : 'N/A'}
              </div>
            </div>
            
            ${yearsLeft <= 1 ? `
              <div style="
                margin-top: 15px;
                padding: 10px;
                background: rgba(231, 76, 60, 0.2);
                border: 1px solid #e74c3c;
                border-radius: 6px;
                color: #e74c3c;
                font-size: 0.85em;
                text-align: center;
              ">
                ⏳ Contract expiring ${yearsLeft === 0 ? 'this year' : 'next year'}
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}
