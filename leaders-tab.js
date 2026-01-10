/* ============================
   LEAGUE LEADERS TAB
   
   Season, Career, and Single-Game leaders
   with filters and sortable categories
============================ */

// Leaders tab state
let leadersScope = 'season'; // 'season' | 'career' | 'singlegame'
let leadersPhase = 'regular'; // 'regular' | 'playoffs'
let leadersSeason = null; // null = current season
let leadersTeamFilter = null; // null = all teams
let leadersPosFilter = null; // null = all positions
let leadersMinGames = 10;
let leadersPerMode = 'total'; // 'total' | 'pergame' | 'per36'
let leadersCategory = 'pts'; // Current stat category

// Stat categories configuration
const LEADER_CATEGORIES = [
  { id: 'pts', label: 'Points', icon: '🏀', decimals: 1, type: 'counting' },
  { id: 'reb', label: 'Rebounds', icon: '📊', decimals: 1, type: 'counting' },
  { id: 'ast', label: 'Assists', icon: '🎯', decimals: 1, type: 'counting' },
  { id: 'stl', label: 'Steals', icon: '🤚', decimals: 1, type: 'counting' },
  { id: 'blk', label: 'Blocks', icon: '🚫', decimals: 1, type: 'counting' },
  { id: 'tpm', label: '3-Pointers', icon: '🎯', decimals: 1, type: 'counting', stat: 'tp' },
  { id: 'fgPct', label: 'FG%', icon: '📈', decimals: 1, type: 'percentage', minAttempts: true },
  { id: 'tpPct', label: '3P%', icon: '🎯', decimals: 1, type: 'percentage', minAttempts: true },
  { id: 'ftPct', label: 'FT%', icon: '✔️', decimals: 1, type: 'percentage', minAttempts: true },
];

function renderLeaders() {
  const el = document.getElementById('leaders-tab');
  
  if (!league) {
    el.innerHTML = '<div style="padding: 20px; color: #888;">No league loaded</div>';
    return;
  }
  
  // Set default season if not set
  if (leadersSeason === null) {
    leadersSeason = league.season;
  }
  
  el.innerHTML = `
    <div style="padding: 20px;">
      <h2 style="margin: 0 0 20px 0;">🏆 League Leaders</h2>
      
      <!-- Filters -->
      <div style="background: #1a2332; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
        <!-- Row 1: Scope & Phase -->
        <div style="display: flex; gap: 20px; margin-bottom: 15px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 200px;">
            <label style="display: block; color: #888; font-size: 0.9em; margin-bottom: 5px;">Scope</label>
            <div style="display: flex; gap: 5px;">
              ${['season', 'career', 'singlegame'].map(scope => `
                <button 
                  onclick="setLeadersScope('${scope}')"
                  style="flex: 1; padding: 10px; background: ${leadersScope === scope ? '#2196F3' : '#0f1624'}; color: ${leadersScope === scope ? '#fff' : '#888'}; border: 1px solid ${leadersScope === scope ? '#2196F3' : '#2a2a40'}; border-radius: 6px; cursor: pointer; font-weight: ${leadersScope === scope ? 'bold' : 'normal'};">
                  ${scope === 'season' ? 'Season' : scope === 'career' ? 'Career' : 'Single Game'}
                </button>
              `).join('')}
            </div>
          </div>
          
          <div style="flex: 1; min-width: 200px;">
            <label style="display: block; color: #888; font-size: 0.9em; margin-bottom: 5px;">Phase</label>
            <div style="display: flex; gap: 5px;">
              ${['regular', 'playoffs'].map(phase => `
                <button 
                  onclick="setLeadersPhase('${phase}')"
                  style="flex: 1; padding: 10px; background: ${leadersPhase === phase ? '#2196F3' : '#0f1624'}; color: ${leadersPhase === phase ? '#fff' : '#888'}; border: 1px solid ${leadersPhase === phase ? '#2196F3' : '#2a2a40'}; border-radius: 6px; cursor: pointer; font-weight: ${leadersPhase === phase ? 'bold' : 'normal'};">
                  ${phase === 'regular' ? 'Regular Season' : 'Playoffs'}
                </button>
              `).join('')}
            </div>
          </div>
          
          ${leadersScope === 'season' ? `
            <div style="flex: 1; min-width: 150px;">
              <label style="display: block; color: #888; font-size: 0.9em; margin-bottom: 5px;">Season</label>
              <select onchange="setLeadersSeason(parseInt(this.value))" style="width: 100%; padding: 10px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px;">
                ${generateSeasonOptions()}
              </select>
            </div>
          ` : ''}
        </div>
        
        <!-- Row 2: Team, Position, Min Games -->
        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 150px;">
            <label style="display: block; color: #888; font-size: 0.9em; margin-bottom: 5px;">Team</label>
            <select onchange="setLeadersTeamFilter(this.value === 'all' ? null : parseInt(this.value))" style="width: 100%; padding: 10px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px;">
              <option value="all">All Teams</option>
              ${league.teams.map(t => `<option value="${t.id}" ${leadersTeamFilter === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
            </select>
          </div>
          
          <div style="flex: 1; min-width: 150px;">
            <label style="display: block; color: #888; font-size: 0.9em; margin-bottom: 5px;">Position</label>
            <select onchange="setLeadersPosFilter(this.value === 'all' ? null : this.value)" style="width: 100%; padding: 10px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px;">
              <option value="all">All Positions</option>
              ${['PG', 'SG', 'SF', 'PF', 'C'].map(pos => `<option value="${pos}" ${leadersPosFilter === pos ? 'selected' : ''}>${pos}</option>`).join('')}
            </select>
          </div>
          
          <div style="flex: 1; min-width: 150px;">
            <label style="display: block; color: #888; font-size: 0.9em; margin-bottom: 5px;">Min Games</label>
            <input type="number" value="${leadersMinGames}" onchange="setLeadersMinGames(parseInt(this.value))" style="width: 100%; padding: 10px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px;" min="0" />
          </div>
          
          ${leadersScope !== 'singlegame' ? `
            <div style="flex: 1; min-width: 150px;">
              <label style="display: block; color: #888; font-size: 0.9em; margin-bottom: 5px;">Display Mode</label>
              <select onchange="setLeadersPerMode(this.value)" style="width: 100%; padding: 10px; background: #0f1624; color: #fff; border: 1px solid #2a2a40; border-radius: 6px;">
                <option value="total" ${leadersPerMode === 'total' ? 'selected' : ''}>Totals</option>
                <option value="pergame" ${leadersPerMode === 'pergame' ? 'selected' : ''}>Per Game</option>
                <option value="per36" ${leadersPerMode === 'per36' ? 'selected' : ''}>Per 36 Min</option>
              </select>
            </div>
          ` : ''}
        </div>
      </div>
      
      <!-- Category Tiles -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 25px;">
        ${LEADER_CATEGORIES.map(cat => `
          <div 
            onclick="setLeadersCategory('${cat.id}')"
            style="
              background: ${leadersCategory === cat.id ? 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)' : '#1a2332'};
              border: 2px solid ${leadersCategory === cat.id ? '#2196F3' : '#2a2a40'};
              border-radius: 10px;
              padding: 15px;
              cursor: pointer;
              text-align: center;
              transition: all 0.2s;
            "
            onmouseover="if('${leadersCategory}' !== '${cat.id}') this.style.borderColor='#4CAF50'"
            onmouseout="if('${leadersCategory}' !== '${cat.id}') this.style.borderColor='#2a2a40'"
          >
            <div style="font-size: 2em; margin-bottom: 5px;">${cat.icon}</div>
            <div style="font-weight: bold; color: ${leadersCategory === cat.id ? '#fff' : '#888'};">${cat.label}</div>
          </div>
        `).join('')}
      </div>
      
      <!-- Leaderboard -->
      <div id="leaders-leaderboard" style="background: #1a2332; border-radius: 10px; padding: 20px;">
        <div style="text-align: center; padding: 40px; color: #888;">
          <div class="spinner"></div>
          <p>Loading leaders...</p>
        </div>
      </div>
    </div>
  `;
  
  // Load and render leaderboard
  setTimeout(() => renderLeaderboard(), 100);
}

function generateSeasonOptions() {
  const seasons = [];
  const currentSeason = league.season;
  
  // Generate last 10 seasons
  for (let i = 0; i <= Math.min(9, currentSeason - 2020); i++) {
    const season = currentSeason - i;
    seasons.push(`<option value="${season}" ${leadersSeason === season ? 'selected' : ''}>${season}</option>`);
  }
  
  return seasons.join('');
}

async function renderLeaderboard() {
  const container = document.getElementById('leaders-leaderboard');
  if (!container) return;
  
  const category = LEADER_CATEGORIES.find(c => c.id === leadersCategory);
  if (!category) return;
  
  // Get player stats
  const stats = await getLeaderboardStats();
  
  if (!stats || stats.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #888;">
        <div style="font-size: 3em; margin-bottom: 15px;">📊</div>
        <p style="font-size: 1.1em; margin-bottom: 10px;">No data available yet</p>
        <p>Simulate games to generate league leaders</p>
      </div>
    `;
    return;
  }
  
  // Filter and sort
  let filtered = filterPlayers(stats);
  filtered = sortByCategory(filtered, category);
  
  // Limit to top 50
  filtered = filtered.slice(0, 50);
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #888;">
        <p>No players match the current filters</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <h3 style="margin: 0 0 20px 0; color: #2196F3;">
      ${category.icon} ${category.label} Leaders
      ${leadersScope === 'season' ? `- ${leadersSeason} ${leadersPhase === 'playoffs' ? 'Playoffs' : 'Season'}` : ''}
      ${leadersScope === 'career' ? '- Career' : ''}
      ${leadersScope === 'singlegame' ? '- Single Game Highs' : ''}
    </h3>
    
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 2px solid #2a2a40;">
            <th style="padding: 12px 8px; text-align: left; color: #888; font-weight: bold;">Rank</th>
            <th style="padding: 12px 8px; text-align: left; color: #888; font-weight: bold;">Player</th>
            <th style="padding: 12px 8px; text-align: left; color: #888; font-weight: bold;">Team</th>
            <th style="padding: 12px 8px; text-align: center; color: #888; font-weight: bold;">Pos</th>
            <th style="padding: 12px 8px; text-align: center; color: #888; font-weight: bold;">GP</th>
            ${leadersScope !== 'singlegame' ? '<th style="padding: 12px 8px; text-align: center; color: #888; font-weight: bold;">MIN</th>' : ''}
            <th style="padding: 12px 8px; text-align: center; color: #888; font-weight: bold; font-size: 1.1em;">${category.label}</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map((stat, idx) => renderLeaderRow(stat, idx + 1, category)).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderLeaderRow(stat, rank, category) {
  const player = league.players.find(p => p.id === stat.pid);
  if (!player) return '';
  
  const team = league.teams.find(t => t.id === stat.teamId);
  const teamAbbr = team?.abbreviation || team?.city?.substring(0, 3).toUpperCase() || 'FA';
  const isUserTeam = team?.id === league.userTid;
  
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
  
  const value = getStatValue(stat, category);
  const displayValue = category.type === 'percentage' ? `${value.toFixed(1)}%` : value.toFixed(category.decimals);
  
  return `
    <tr style="border-bottom: 1px solid #2a2a40; background: ${isUserTeam ? 'rgba(76, 175, 80, 0.1)' : 'transparent'};" onmouseover="this.style.background='rgba(33, 150, 243, 0.1)'" onmouseout="this.style.background='${isUserTeam ? 'rgba(76, 175, 80, 0.1)' : 'transparent'}'">
      <td style="padding: 12px 8px; color: #888;">
        ${medal} ${medal ? '' : rank}
      </td>
      <td style="padding: 12px 8px;">
        <span onclick="openPlayerModal(${player.id})" style="color: ${isUserTeam ? '#4CAF50' : '#2196F3'}; cursor: pointer; font-weight: bold;">
          ${player.firstName} ${player.lastName}
        </span>
      </td>
      <td style="padding: 12px 8px;">
        <span style="color: #888; cursor: pointer;">${teamAbbr}</span>
      </td>
      <td style="padding: 12px 8px; text-align: center; color: #888;">${player.position || 'F'}</td>
      <td style="padding: 12px 8px; text-align: center; color: #888;">${stat.gp || 1}</td>
      ${leadersScope !== 'singlegame' ? `<td style="padding: 12px 8px; text-align: center; color: #888;">${stat.min ? (stat.min / stat.gp).toFixed(1) : '0.0'}</td>` : ''}
      <td style="padding: 12px 8px; text-align: center; font-weight: bold; font-size: 1.1em; color: #2196F3;">${displayValue}</td>
    </tr>
  `;
}

async function getLeaderboardStats() {
  if (leadersScope === 'season') {
    return await getSeasonStats(leadersSeason, leadersPhase);
  } else if (leadersScope === 'career') {
    return await getCareerStats();
  } else {
    return await getSingleGameStats();
  }
}

async function getSeasonStats(season, phase) {
  // Check if we have playerSeasonStats in IndexedDB
  if (!db) return [];
  
  try {
    const tx = db.transaction('playerSeasonStats', 'readonly');
    const store = tx.objectStore('playerSeasonStats');
    const allStats = await store.getAll();
    
    return allStats.filter(s => s.season === season && s.phase === phase);
  } catch (error) {
    console.error('[Leaders] Error loading season stats:', error);
    // Fallback: calculate from games
    return calculateSeasonStatsFromGames(season, phase);
  }
}

function calculateSeasonStatsFromGames(season, phase) {
  // Aggregate from game data
  const playerStats = {};
  
  if (!league.schedule || !league.schedule.games) return [];
  
  Object.values(league.schedule.games).forEach(game => {
    if (game.season !== season || game.status !== 'final') return;
    if (phase === 'playoffs' && game.phase !== 'Playoffs') return;
    if (phase === 'regular' && game.phase === 'Playoffs') return;
    
    if (!game.boxScore) return;
    
    [game.homeTeamId, game.awayTeamId].forEach(teamId => {
      const teamStats = game.boxScore[teamId];
      if (!teamStats) return;
      
      teamStats.forEach(pStat => {
        const key = `${pStat.pid}`;
        if (!playerStats[key]) {
          playerStats[key] = {
            pid: pStat.pid,
            teamId: teamId,
            season: season,
            phase: phase,
            gp: 0,
            min: 0,
            pts: 0,
            reb: 0,
            ast: 0,
            stl: 0,
            blk: 0,
            tov: 0,
            pf: 0,
            fg: 0,
            fga: 0,
            tp: 0,
            tpa: 0,
            ft: 0,
            fta: 0
          };
        }
        
        const stat = playerStats[key];
        stat.gp++;
        stat.min += pStat.min || 0;
        stat.pts += pStat.pts || 0;
        stat.reb += pStat.reb || 0;
        stat.ast += pStat.ast || 0;
        stat.stl += pStat.stl || 0;
        stat.blk += pStat.blk || 0;
        stat.tov += pStat.tov || 0;
        stat.pf += pStat.pf || 0;
        stat.fg += pStat.fg || 0;
        stat.fga += pStat.fga || 0;
        stat.tp += pStat.tp || 0;
        stat.tpa += pStat.tpa || 0;
        stat.ft += pStat.ft || 0;
        stat.fta += pStat.fta || 0;
      });
    });
  });
  
  return Object.values(playerStats);
}

async function getCareerStats() {
  // Aggregate all season stats
  if (!db) return calculateCareerStatsFromGames();
  
  try {
    const tx = db.transaction('playerSeasonStats', 'readonly');
    const store = tx.objectStore('playerSeasonStats');
    const allStats = await store.getAll();
    
    const careerStats = {};
    
    allStats.forEach(stat => {
      if (stat.phase !== leadersPhase) return;
      
      const key = stat.pid;
      if (!careerStats[key]) {
        careerStats[key] = { ...stat };
      } else {
        const career = careerStats[key];
        career.gp += stat.gp;
        career.min += stat.min;
        career.pts += stat.pts;
        career.reb += stat.reb;
        career.ast += stat.ast;
        career.stl += stat.stl;
        career.blk += stat.blk;
        career.tov += stat.tov;
        career.pf += stat.pf;
        career.fg += stat.fg;
        career.fga += stat.fga;
        career.tp += stat.tp;
        career.tpa += stat.tpa;
        career.ft += stat.ft;
        career.fta += stat.fta;
      }
    });
    
    return Object.values(careerStats);
  } catch (error) {
    return calculateCareerStatsFromGames();
  }
}

function calculateCareerStatsFromGames() {
  const playerStats = {};
  
  if (!league.schedule || !league.schedule.games) return [];
  
  Object.values(league.schedule.games).forEach(game => {
    if (game.status !== 'final') return;
    if (leadersPhase === 'playoffs' && game.phase !== 'Playoffs') return;
    if (leadersPhase === 'regular' && game.phase === 'Playoffs') return;
    
    if (!game.boxScore) return;
    
    [game.homeTeamId, game.awayTeamId].forEach(teamId => {
      const teamStats = game.boxScore[teamId];
      if (!teamStats) return;
      
      teamStats.forEach(pStat => {
        const key = `${pStat.pid}`;
        if (!playerStats[key]) {
          playerStats[key] = {
            pid: pStat.pid,
            teamId: teamId,
            phase: leadersPhase,
            gp: 0,
            min: 0,
            pts: 0,
            reb: 0,
            ast: 0,
            stl: 0,
            blk: 0,
            tov: 0,
            pf: 0,
            fg: 0,
            fga: 0,
            tp: 0,
            tpa: 0,
            ft: 0,
            fta: 0
          };
        }
        
        const stat = playerStats[key];
        stat.gp++;
        stat.min += pStat.min || 0;
        stat.pts += pStat.pts || 0;
        stat.reb += pStat.reb || 0;
        stat.ast += pStat.ast || 0;
        stat.stl += pStat.stl || 0;
        stat.blk += pStat.blk || 0;
        stat.tov += pStat.tov || 0;
        stat.pf += pStat.pf || 0;
        stat.fg += pStat.fg || 0;
        stat.fga += pStat.fga || 0;
        stat.tp += pStat.tp || 0;
        stat.tpa += pStat.tpa || 0;
        stat.ft += pStat.ft || 0;
        stat.fta += pStat.fta || 0;
      });
    });
  });
  
  return Object.values(playerStats);
}

async function getSingleGameStats() {
  const gameStats = [];
  
  if (!league.schedule || !league.schedule.games) return [];
  
  Object.values(league.schedule.games).forEach(game => {
    if (game.status !== 'final') return;
    if (leadersPhase === 'playoffs' && game.phase !== 'Playoffs') return;
    if (leadersPhase === 'regular' && game.phase === 'Playoffs') return;
    
    if (!game.boxScore) return;
    
    [game.homeTeamId, game.awayTeamId].forEach(teamId => {
      const teamStats = game.boxScore[teamId];
      if (!teamStats) return;
      
      teamStats.forEach(pStat => {
        gameStats.push({
          pid: pStat.pid,
          teamId: teamId,
          gameId: game.id,
          season: game.season,
          day: game.day,
          phase: game.phase,
          gp: 1,
          min: pStat.min || 0,
          pts: pStat.pts || 0,
          reb: pStat.reb || 0,
          ast: pStat.ast || 0,
          stl: pStat.stl || 0,
          blk: pStat.blk || 0,
          tov: pStat.tov || 0,
          pf: pStat.pf || 0,
          fg: pStat.fg || 0,
          fga: pStat.fga || 0,
          tp: pStat.tp || 0,
          tpa: pStat.tpa || 0,
          ft: pStat.ft || 0,
          fta: pStat.fta || 0
        });
      });
    });
  });
  
  return gameStats;
}

function filterPlayers(stats) {
  return stats.filter(stat => {
    // Min games filter
    if (stat.gp < leadersMinGames) return false;
    
    // Team filter
    if (leadersTeamFilter !== null && stat.teamId !== leadersTeamFilter) return false;
    
    // Position filter
    if (leadersPosFilter !== null) {
      const player = league.players.find(p => p.id === stat.pid);
      if (!player || player.position !== leadersPosFilter) return false;
    }
    
    return true;
  });
}

function sortByCategory(stats, category) {
  return stats.sort((a, b) => {
    const aVal = getStatValue(a, category);
    const bVal = getStatValue(b, category);
    
    // For percentages, apply minimum attempt requirements
    if (category.type === 'percentage') {
      const aQualifies = meetsAttemptMinimum(a, category);
      const bQualifies = meetsAttemptMinimum(b, category);
      
      if (!aQualifies && bQualifies) return 1;
      if (aQualifies && !bQualifies) return -1;
      if (!aQualifies && !bQualifies) return 0;
    }
    
    return bVal - aVal;
  });
}

function getStatValue(stat, category) {
  const statKey = category.stat || category.id;
  let value = 0;
  
  if (category.type === 'percentage') {
    if (category.id === 'fgPct') {
      value = stat.fga > 0 ? (stat.fg / stat.fga) * 100 : 0;
    } else if (category.id === 'tpPct') {
      value = stat.tpa > 0 ? (stat.tp / stat.tpa) * 100 : 0;
    } else if (category.id === 'ftPct') {
      value = stat.fta > 0 ? (stat.ft / stat.fta) * 100 : 0;
    }
  } else {
    value = stat[statKey] || 0;
    
    // Apply per-game or per-36 mode
    if (leadersPerMode === 'pergame' && stat.gp > 0) {
      value = value / stat.gp;
    } else if (leadersPerMode === 'per36' && stat.min > 0) {
      value = (value / stat.min) * 36;
    }
  }
  
  return value;
}

function meetsAttemptMinimum(stat, category) {
  const gp = stat.gp || 1;
  
  if (category.id === 'fgPct') {
    const minAttempts = Math.max(50, gp * 2);
    return stat.fga >= minAttempts;
  } else if (category.id === 'tpPct') {
    const minAttempts = Math.max(25, gp * 1);
    return stat.tpa >= minAttempts;
  } else if (category.id === 'ftPct') {
    const minAttempts = Math.max(25, gp * 1);
    return stat.fta >= minAttempts;
  }
  
  return true;
}

// Filter setters
function setLeadersScope(scope) {
  leadersScope = scope;
  if (scope === 'career') {
    leadersMinGames = 100;
  } else if (scope === 'season') {
    leadersMinGames = 10;
  } else {
    leadersMinGames = 1;
  }
  renderLeaders();
}

function setLeadersPhase(phase) {
  leadersPhase = phase;
  renderLeaders();
}

function setLeadersSeason(season) {
  leadersSeason = season;
  renderLeaders();
}

function setLeadersTeamFilter(teamId) {
  leadersTeamFilter = teamId;
  renderLeaderboard();
}

function setLeadersPosFilter(pos) {
  leadersPosFilter = pos;
  renderLeaderboard();
}

function setLeadersMinGames(min) {
  leadersMinGames = Math.max(0, min);
  renderLeaderboard();
}

function setLeadersPerMode(mode) {
  leadersPerMode = mode;
  renderLeaderboard();
}

function setLeadersCategory(category) {
  leadersCategory = category;
  renderLeaderboard();
}
