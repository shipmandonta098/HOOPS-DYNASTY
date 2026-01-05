// ===== HISTORY TAB - League Archive & Timeline =====

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
function renderHistoryTab() {
  if (!league) return '<div style="padding: 20px;">No league loaded</div>';
  
  const history = initHistoryIfMissing(league);
  const selectedSeason = historyFilters.season || league.season;
  
  return `
    <div style="min-height: 100vh; background: #0f1624; padding-bottom: 40px;">
      <!-- Header -->
      <div style="
        background: linear-gradient(135deg, #1a2332 0%, #0f1624 100%);
        padding: 30px 20px;
        border-bottom: 2px solid #2a2a40;
      ">
        <h1 style="margin: 0 0 8px 0; color: #fff; font-size: 2em;">📜 History</h1>
        <div style="color: #888; font-size: 0.95em;">
          ${league.name} • Season ${league.season} ${history.startYear !== league.season ? `• Archive starts ${history.startYear}` : ''}
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
        ${['seasons', 'champions', 'awards', 'drafts', 'records', 'transactions'].map(tab => `
          <button onclick="switchHistoryTab('${tab}')" style="
            padding: 14px 20px;
            background: ${historyTab === tab ? '#2196F3' : 'transparent'};
            color: ${historyTab === tab ? '#fff' : '#888'};
            border: none;
            border-bottom: 3px solid ${historyTab === tab ? '#2196F3' : 'transparent'};
            cursor: pointer;
            font-weight: ${historyTab === tab ? 'bold' : 'normal'};
            white-space: nowrap;
            transition: all 0.2s;
          ">${tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
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
  const seasons = Object.keys(history.seasons).sort((a, b) => b - a);
  
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
    default:
      return '<div style="padding: 20px; color: #888;">Select a category</div>';
  }
}

// 1) SEASONS
function renderSeasonsHistory(history) {
  const seasons = Object.values(history.seasons).sort((a, b) => b.year - a.year);
  
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
  const champions = Object.values(history.seasons)
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
  
  Object.values(history.seasons).forEach(s => {
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
  const season = history.seasons[selectedSeason];
  
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
