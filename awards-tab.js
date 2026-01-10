/* ============================
   AWARD RACES TAB
   Tracks MVP, DPOY, ROTY, 6MOY, MIP, COTY, All-League, All-Defense, All-Rookie
============================ */

// Award Races state
const awardRacesState = {
  selectedAward: 'mvp',
  filters: {
    conference: 'all',
    position: 'all',
    minGames: 20,
    minMinutes: 15,
    includeInjured: false
  },
  lastSnapshot: null
};

/* ============================
   AWARD CALCULATION FUNCTIONS
============================ */

// MVP Score: Team success + individual dominance
function calculateMVPScore(player, team, league) {
  if (!player.seasonStats || player.seasonStats.gp < awardRacesState.filters.minGames) return 0;
  
  const stats = player.seasonStats;
  const gp = stats.gp || 0;
  if (gp === 0) return 0;
  
  const mpg = (stats.min || 0) / gp;
  if (mpg < awardRacesState.filters.minMinutes) return 0;
  
  const ppg = (stats.pts || 0) / gp;
  const rpg = (stats.reb || 0) / gp;
  const apg = (stats.ast || 0) / gp;
  const spg = (stats.stl || 0) / gp;
  const bpg = (stats.blk || 0) / gp;
  const tovpg = (stats.tov || 0) / gp;
  const fgPct = (stats.fga || 0) > 0 ? (stats.fgm || 0) / stats.fga : 0;
  
  // Individual production (60% weight)
  const offensiveScore = ppg * 1.0 + apg * 1.5 + fgPct * 20;
  const versatilityScore = rpg * 0.8 + spg * 2.0 + bpg * 1.5;
  const efficiencyPenalty = tovpg * 1.5;
  const individualScore = offensiveScore + versatilityScore - efficiencyPenalty;
  
  // Team success (40% weight)
  const totalGames = team.wins + team.losses;
  const winPct = totalGames > 0 ? team.wins / totalGames : 0;
  const teamScore = winPct * 100 + team.wins * 0.5;
  
  return (individualScore * 0.6) + (teamScore * 0.4);
}

// DPOY Score: Defensive stats + team defensive rating
function calculateDPOYScore(player, team, league) {
  if (!player.seasonStats || player.seasonStats.gp < awardRacesState.filters.minGames) return 0;
  
  const stats = player.seasonStats;
  const gp = stats.gp || 0;
  if (gp === 0) return 0;
  
  const mpg = (stats.min || 0) / gp;
  if (mpg < awardRacesState.filters.minMinutes) return 0;
  
  const rpg = (stats.reb || 0) / gp;
  const spg = (stats.stl || 0) / gp;
  const bpg = (stats.blk || 0) / gp;
  const drbPg = (stats.drb || rpg * 0.7) / gp; // Defensive rebounds (estimate if missing)
  
  // Defensive production (70% weight)
  const defensiveScore = spg * 3.0 + bpg * 2.5 + drbPg * 1.0 + rpg * 0.5;
  
  // Team defense (30% weight) - use win% as proxy
  const totalGames = team.wins + team.losses;
  const winPct = totalGames > 0 ? team.wins / totalGames : 0;
  const teamDefenseScore = winPct * 30;
  
  return (defensiveScore * 0.7) + (teamDefenseScore * 0.3);
}

// ROTY Score: Rookie stats (must be age <= 20 or first season)
function calculateROTYScore(player, team, league) {
  // Check if rookie (age <= 20 or draft year matches current season)
  const isRookie = player.age <= 20 || player.draft.year === league.season;
  if (!isRookie) return 0;
  
  if (!player.seasonStats || player.seasonStats.gp < 15) return 0; // Lower threshold for rookies
  
  const stats = player.seasonStats;
  const gp = stats.gp || 0;
  if (gp === 0) return 0;
  
  const ppg = (stats.pts || 0) / gp;
  const rpg = (stats.reb || 0) / gp;
  const apg = (stats.ast || 0) / gp;
  const spg = (stats.stl || 0) / gp;
  const bpg = (stats.blk || 0) / gp;
  const fgPct = (stats.fga || 0) > 0 ? (stats.fgm || 0) / stats.fga : 0;
  
  // Pure production for rookies
  return ppg * 1.2 + rpg * 0.8 + apg * 1.3 + spg * 1.5 + bpg * 1.2 + fgPct * 15;
}

// 6MOY Score: Bench players (games started < 50% of games played)
function calculate6MOYScore(player, team, league) {
  if (!player.seasonStats || player.seasonStats.gp < awardRacesState.filters.minGames) return 0;
  
  const stats = player.seasonStats;
  const gp = stats.gp || 0;
  if (gp === 0) return 0;
  
  const gs = stats.gs || 0;
  const startPct = gs / gp;
  
  // Must come off bench in majority of games
  if (startPct >= 0.5) return 0;
  
  const mpg = (stats.min || 0) / gp;
  const ppg = (stats.pts || 0) / gp;
  const rpg = (stats.reb || 0) / gp;
  const apg = (stats.ast || 0) / gp;
  const fgPct = (stats.fga || 0) > 0 ? (stats.fgm || 0) / stats.fga : 0;
  
  // Bench impact score
  return ppg * 1.3 + rpg * 0.7 + apg * 1.2 + mpg * 0.5 + fgPct * 12;
}

// MIP Score: Improvement over last season (requires previous season data)
function calculateMIPScore(player, team, league) {
  if (!player.seasonStats || player.seasonStats.gp < awardRacesState.filters.minGames) return 0;
  if (!player.careerStats || !player.careerStats.lastSeason) return 0;
  
  const current = player.seasonStats;
  const last = player.careerStats.lastSeason;
  
  const currentGp = current.gp || 0;
  const lastGp = last.gp || 0;
  
  if (currentGp === 0 || lastGp === 0) return 0;
  
  const currentPpg = (current.pts || 0) / currentGp;
  const lastPpg = (last.pts || 0) / lastGp;
  const ppgImprovement = currentPpg - lastPpg;
  
  const currentRpg = (current.reb || 0) / currentGp;
  const lastRpg = (last.reb || 0) / lastGp;
  const rpgImprovement = currentRpg - lastRpg;
  
  const currentApg = (current.ast || 0) / currentGp;
  const lastApg = (last.ast || 0) / lastGp;
  const apgImprovement = currentApg - lastApg;
  
  const currentFgPct = (current.fga || 0) > 0 ? (current.fgm || 0) / current.fga : 0;
  const lastFgPct = (last.fga || 0) > 0 ? (last.fgm || 0) / last.fga : 0;
  const fgPctImprovement = (currentFgPct - lastFgPct) * 100;
  
  // Only positive improvements count
  const totalImprovement = Math.max(0, ppgImprovement) * 2.0 + 
                           Math.max(0, rpgImprovement) * 1.0 + 
                           Math.max(0, apgImprovement) * 1.5 +
                           Math.max(0, fgPctImprovement) * 0.8;
  
  // Must show meaningful improvement
  return totalImprovement > 3 ? totalImprovement : 0;
}

// COTY Score: Team overperformance vs expected
function calculateCOTYScore(coach, team, league) {
  if (!coach || !team) return 0;
  
  const totalGames = team.wins + team.losses;
  if (totalGames < 20) return 0;
  
  const winPct = team.wins / totalGames;
  const expectedWinPct = getTeamOverall(team) / 100 * 0.01 + 0.45; // Baseline expectation
  const overperformance = (winPct - expectedWinPct) * 100;
  
  // Coach rating bonus
  const coachRating = coach.overall || 65;
  
  return overperformance * 5 + team.wins * 0.8 + coachRating * 0.3;
}

/* ============================
   SNAPSHOT SYSTEM
============================ */

function createAwardSnapshot() {
  if (!league || !league.teams) return null;
  
  const snapshot = {
    timestamp: Date.now(),
    season: league.season,
    day: league.calendar.currentDay,
    awards: {}
  };
  
  // Calculate all award races
  const awards = ['mvp', 'dpoy', 'roty', '6moy', 'mip', 'coty'];
  
  awards.forEach(award => {
    snapshot.awards[award] = calculateAwardLeaderboard(award);
  });
  
  return snapshot;
}

function calculateAwardLeaderboard(award) {
  const leaderboard = [];
  
  if (award === 'coty') {
    // Coach of the Year
    league.teams.forEach(team => {
      if (team.coach) {
        const score = calculateCOTYScore(team.coach, team, league);
        if (score > 0) {
          leaderboard.push({
            id: team.coach.id,
            name: team.coach.name,
            team: team.name,
            teamId: team.id,
            score: score,
            record: `${team.wins}-${team.losses}`,
            overall: team.coach.overall || 65
          });
        }
      }
    });
  } else {
    // Player awards
    league.teams.forEach(team => {
      if (!team.players) return;
      
      team.players.forEach(player => {
        let score = 0;
        
        switch(award) {
          case 'mvp':
            score = calculateMVPScore(player, team, league);
            break;
          case 'dpoy':
            score = calculateDPOYScore(player, team, league);
            break;
          case 'roty':
            score = calculateROTYScore(player, team, league);
            break;
          case '6moy':
            score = calculate6MOYScore(player, team, league);
            break;
          case 'mip':
            score = calculateMIPScore(player, team, league);
            break;
        }
        
        if (score > 0 && player.seasonStats && player.seasonStats.gp > 0) {
          const stats = player.seasonStats;
          const gp = stats.gp;
          
          leaderboard.push({
            id: player.id,
            name: player.name,
            team: team.name,
            teamId: team.id,
            pos: player.pos,
            age: player.age,
            ovr: player.ratings.ovr,
            score: score,
            record: `${team.wins}-${team.losses}`,
            gp: gp,
            ppg: ((stats.pts || 0) / gp).toFixed(1),
            rpg: ((stats.reb || 0) / gp).toFixed(1),
            apg: ((stats.ast || 0) / gp).toFixed(1),
            spg: ((stats.stl || 0) / gp).toFixed(1),
            bpg: ((stats.blk || 0) / gp).toFixed(1),
            fgPct: ((stats.fga || 0) > 0 ? ((stats.fgm || 0) / stats.fga * 100) : 0).toFixed(1)
          });
        }
      });
    });
  }
  
  // Sort by score descending
  leaderboard.sort((a, b) => b.score - a.score);
  
  // Return top 10
  return leaderboard.slice(0, 10);
}

function saveAwardSnapshot() {
  const snapshot = createAwardSnapshot();
  if (!snapshot) return;
  
  if (!league.awardSnapshots) {
    league.awardSnapshots = [];
  }
  
  league.awardSnapshots.push(snapshot);
  
  // Keep only last 10 snapshots to save space
  if (league.awardSnapshots.length > 10) {
    league.awardSnapshots = league.awardSnapshots.slice(-10);
  }
  
  awardRacesState.lastSnapshot = snapshot;
  saveLeague(league);
}

function getRankChange(currentRank, award) {
  if (!league.awardSnapshots || league.awardSnapshots.length === 0) return null;
  
  const lastSnapshot = league.awardSnapshots[league.awardSnapshots.length - 1];
  if (!lastSnapshot || !lastSnapshot.awards[award]) return null;
  
  const lastRanking = lastSnapshot.awards[award];
  const previousRank = lastRanking.findIndex(p => p.id === currentRank.id) + 1;
  
  if (previousRank === 0) return 'NEW';
  return previousRank;
}

/* ============================
   RENDER FUNCTIONS
============================ */

function renderAwardRaces() {
  if (!league || !league.teams) {
    return '<div class="tab-content"><p>No league loaded</p></div>';
  }
  
  const { selectedAward, filters } = awardRacesState;
  
  return `
    <div class="tab-content">
      <div class="content-header">
        <h2>🏆 Award Races - ${league.season} Season</h2>
        <div class="header-subtitle">Live standings updated after simulations</div>
      </div>
      
      ${renderAwardSelector()}
      ${renderAwardFilters()}
      ${renderAwardLeaderboard()}
    </div>
  `;
}

function renderAwardSelector() {
  const awards = [
    { id: 'mvp', name: 'MVP', icon: '👑' },
    { id: 'dpoy', name: 'DPOY', icon: '🛡️' },
    { id: 'roty', name: 'ROTY', icon: '⭐' },
    { id: '6moy', name: '6MOY', icon: '💎' },
    { id: 'mip', name: 'MIP', icon: '📈' },
    { id: 'coty', name: 'COTY', icon: '👔' }
  ];
  
  return `
    <div class="award-selector">
      ${awards.map(award => `
        <button 
          class="award-btn ${awardRacesState.selectedAward === award.id ? 'active' : ''}"
          onclick="selectAward('${award.id}')">
          <span class="award-icon">${award.icon}</span>
          <span class="award-name">${award.name}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function renderAwardFilters() {
  if (awardRacesState.selectedAward === 'coty') {
    return ''; // No filters for coach awards
  }
  
  return `
    <div class="award-filters">
      <select onchange="updateAwardFilter('conference', this.value)" class="filter-select">
        <option value="all" ${awardRacesState.filters.conference === 'all' ? 'selected' : ''}>All Conferences</option>
        <option value="Eastern" ${awardRacesState.filters.conference === 'Eastern' ? 'selected' : ''}>Eastern</option>
        <option value="Western" ${awardRacesState.filters.conference === 'Western' ? 'selected' : ''}>Western</option>
      </select>
      
      <select onchange="updateAwardFilter('position', this.value)" class="filter-select">
        <option value="all" ${awardRacesState.filters.position === 'all' ? 'selected' : ''}>All Positions</option>
        <option value="PG" ${awardRacesState.filters.position === 'PG' ? 'selected' : ''}>PG</option>
        <option value="SG" ${awardRacesState.filters.position === 'SG' ? 'selected' : ''}>SG</option>
        <option value="SF" ${awardRacesState.filters.position === 'SF' ? 'selected' : ''}>SF</option>
        <option value="PF" ${awardRacesState.filters.position === 'PF' ? 'selected' : ''}>PF</option>
        <option value="C" ${awardRacesState.filters.position === 'C' ? 'selected' : ''}>C</option>
      </select>
      
      <label class="filter-checkbox">
        <input type="checkbox" 
               ${awardRacesState.filters.includeInjured ? 'checked' : ''}
               onchange="updateAwardFilter('includeInjured', this.checked)">
        Include Injured
      </label>
    </div>
  `;
}

function renderAwardLeaderboard() {
  const leaderboard = calculateAwardLeaderboard(awardRacesState.selectedAward);
  
  if (leaderboard.length === 0) {
    return '<div class="no-data">No eligible candidates yet. Play more games to see rankings.</div>';
  }
  
  const isCOTY = awardRacesState.selectedAward === 'coty';
  
  return `
    <div class="award-leaderboard">
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Δ</th>
            <th>${isCOTY ? 'Coach' : 'Player'}</th>
            <th>Team</th>
            ${!isCOTY ? '<th>Pos</th><th>Age</th>' : ''}
            <th>OVR</th>
            <th>Record</th>
            ${!isCOTY ? '<th>GP</th><th>PPG</th><th>RPG</th><th>APG</th><th>FG%</th>' : ''}
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          ${leaderboard.map((entry, idx) => {
            const rank = idx + 1;
            const previousRank = getRankChange(entry, awardRacesState.selectedAward);
            const rankDelta = getRankDelta(rank, previousRank);
            
            return `
              <tr class="${rank <= 3 ? 'top-three' : ''}">
                <td class="rank-cell">${getRankDisplay(rank)}</td>
                <td class="delta-cell">${rankDelta}</td>
                <td class="name-cell ${isCOTY ? '' : 'clickable-player'}" 
                    ${isCOTY ? '' : `onclick="showPlayerModal(${entry.id})"`}>
                  ${entry.name}
                </td>
                <td>${entry.team}</td>
                ${!isCOTY ? `<td>${entry.pos}</td><td>${entry.age}</td>` : ''}
                <td>${entry.ovr}</td>
                <td>${entry.record}</td>
                ${!isCOTY ? `
                  <td>${entry.gp}</td>
                  <td>${entry.ppg}</td>
                  <td>${entry.rpg}</td>
                  <td>${entry.apg}</td>
                  <td>${entry.fgPct}%</td>
                ` : ''}
                <td class="score-cell">${entry.score.toFixed(1)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function getRankDisplay(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return rank;
}

function getRankDelta(currentRank, previousRank) {
  if (previousRank === null || previousRank === undefined) return '<span class="no-change">—</span>';
  if (previousRank === 'NEW') return '<span class="rank-new">NEW</span>';
  
  const change = previousRank - currentRank;
  if (change > 0) return `<span class="rank-up">▲${change}</span>`;
  if (change < 0) return `<span class="rank-down">▼${Math.abs(change)}</span>`;
  return '<span class="no-change">—</span>';
}

/* ============================
   EVENT HANDLERS
============================ */

function selectAward(awardId) {
  awardRacesState.selectedAward = awardId;
  render();
}

function updateAwardFilter(filterName, value) {
  awardRacesState.filters[filterName] = value;
  render();
}
