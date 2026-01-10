/* ============================
   LEAGUE SCHEDULE GENERATOR
   
   Uses ROUND-ROBIN CIRCLE METHOD for perfect matchings
   - Generates exactly 82 games per team (30-team league)
   - Each day is a perfect matching (15 games, all 30 teams play once)
   - Uses circle rotation algorithm to create 29 unique round pairings
   - Cycles through rounds to reach 82 days
   - Balances home/away to ~41 each
============================ */

/**
 * Generate a complete league schedule using round-robin circle method
 * @param {Array} teams - Array of team objects
 * @param {number} season - Season year
 * @param {number} gamesPerTeam - Games each team should play (default 82)
 * @returns {Object} Schedule object with days and games
 */
function generateLeagueSchedule(teams, season, gamesPerTeam = 82) {
  console.log(`[Schedule Generator] Starting round-robin for ${teams.length} teams, ${gamesPerTeam} games each`);
  
  const numTeams = teams.length;
  const totalExpectedGames = (numTeams * gamesPerTeam) / 2;
  
  // CLEAR schedule before generating
  const schedule = {
    days: [],
    games: {},
    totalDays: gamesPerTeam,
    gamesPerTeam: gamesPerTeam,
    totalGames: 0
  };
  
  // Generate round-robin pairings using circle method
  const roundPairings = generateRoundRobinPairings(numTeams);
  const numRounds = roundPairings.length; // Should be numTeams - 1 for even teams
  
  console.log(`[Schedule Generator] Generated ${numRounds} unique round pairings`);
  
  let gameIdCounter = 0;
  const homeCount = Array(numTeams).fill(0);
  const awayCount = Array(numTeams).fill(0);
  const gamesCount = Array(numTeams).fill(0);
  
  // Generate 82 days by cycling through round pairings
  for (let day = 1; day <= gamesPerTeam; day++) {
    const roundIndex = (day - 1) % numRounds;
    const pairings = roundPairings[roundIndex];
    const dayGames = [];
    const usedTeams = new Set();
    
    // Create games for this day
    for (const [teamA, teamB] of pairings) {
      // Determine home/away based on balance and day
      let homeTeam, awayTeam;
      
      const aBalance = homeCount[teamA] - awayCount[teamA];
      const bBalance = homeCount[teamB] - awayCount[teamB];
      
      // Team with fewer home games gets home court
      if (aBalance < bBalance) {
        homeTeam = teamA;
        awayTeam = teamB;
      } else if (bBalance < aBalance) {
        homeTeam = teamB;
        awayTeam = teamA;
      } else {
        // Equal balance: alternate based on day
        if (day % 2 === 0) {
          homeTeam = teamA;
          awayTeam = teamB;
        } else {
          homeTeam = teamB;
          awayTeam = teamA;
        }
      }
      
      // Validation: ensure no team plays twice in one day
      if (usedTeams.has(teamA) || usedTeams.has(teamB)) {
        throw new Error(`Day ${day}: Team ${teamA} or ${teamB} scheduled multiple times!`);
      }
      if (teamA === teamB) {
        throw new Error(`Day ${day}: Team playing itself!`);
      }
      
      usedTeams.add(teamA);
      usedTeams.add(teamB);
      
      // Create game
      const gameId = `game_${season}_${gameIdCounter++}`;
      schedule.games[gameId] = {
        id: gameId,
        season: season,
        day: day,
        homeTeamId: teams[homeTeam].id,
        awayTeamId: teams[awayTeam].id,
        status: 'scheduled',
        score: { home: 0, away: 0 },
        quarter: 0,
        timeRemaining: '12:00',
        log: [],
        boxScore: null
      };
      
      dayGames.push(gameId);
      
      // Update counters
      homeCount[homeTeam]++;
      awayCount[awayTeam]++;
      gamesCount[teamA]++;
      gamesCount[teamB]++;
    }
    
    // Per-day validation
    if (dayGames.length !== numTeams / 2) {
      throw new Error(`Day ${day}: Expected ${numTeams/2} games, got ${dayGames.length}`);
    }
    if (usedTeams.size !== numTeams) {
      throw new Error(`Day ${day}: Expected ${numTeams} teams, only ${usedTeams.size} played`);
    }
    
    schedule.days.push({
      day: day,
      phase: 'Regular Season',
      games: dayGames
    });
  }
  
  schedule.totalGames = Object.keys(schedule.games).length;
  
  // Global validation
  const validation = validateSchedule(schedule, teams, gamesPerTeam);
  if (!validation.valid) {
    console.error('[Schedule Generator] VALIDATION FAILED:', validation.errors);
    throw new Error('Schedule validation failed: ' + validation.errors.join(', '));
  }
  
  console.log(`[Schedule Generator] ✓ Schedule generated: days=${gamesPerTeam} games=${schedule.totalGames}`);
  console.log(`[Schedule Generator] ✓ Schedule validated: minGames=${validation.minGames} maxGames=${validation.maxGames}`);
  
  return schedule;
}

/**
 * Generate round-robin pairings using circle rotation method
 * For even number of teams, creates (numTeams - 1) rounds with perfect matchings
 * @param {number} numTeams - Number of teams (must be even)
 * @returns {Array} Array of rounds, each containing array of [teamA, teamB] pairs
 */
function generateRoundRobinPairings(numTeams) {
  if (numTeams % 2 !== 0) {
    throw new Error('Round-robin circle method requires even number of teams');
  }
  
  const rounds = [];
  const teamIds = Array.from({ length: numTeams }, (_, i) => i);
  
  // Generate numTeams - 1 rounds
  for (let round = 0; round < numTeams - 1; round++) {
    const pairings = [];
    
    // Create pairings for this round
    // Pair: first with last, second with second-last, etc.
    for (let i = 0; i < numTeams / 2; i++) {
      const teamA = teamIds[i];
      const teamB = teamIds[numTeams - 1 - i];
      pairings.push([teamA, teamB]);
    }
    
    rounds.push(pairings);
    
    // Rotate: keep first element fixed, rotate rest clockwise
    const fixed = teamIds[0];
    const rest = teamIds.slice(1);
    const rotated = [rest[rest.length - 1], ...rest.slice(0, -1)];
    teamIds.length = 0;
    teamIds.push(fixed, ...rotated);
  }
  
  return rounds;
}

/**
 * Generate all matchups that need to be played
 * Returns array of [teamIndexA, teamIndexB] pairs
 */
function generateAllMatchups(teams, gamesPerTeam) {
  const numTeams = teams.length;
  const matchups = [];
  
  // Calculate how many games each pair of teams should play
  const baseGames = Math.floor(gamesPerTeam / (numTeams - 1));
  const extraGames = gamesPerTeam % (numTeams - 1);
  
  for (let i = 0; i < numTeams; i++) {
    let gamesAssigned = 0;
    for (let j = i + 1; j < numTeams; j++) {
      // Each pair plays baseGames times, plus 1 extra for the first 'extraGames' opponents
      const timesToPlay = baseGames + (gamesAssigned < extraGames ? 1 : 0);
      
      for (let k = 0; k < timesToPlay; k++) {
        matchups.push([i, j]);
      }
      
      gamesAssigned++;
    }
  }
  
  // Shuffle matchups for variety
  for (let i = matchups.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [matchups[i], matchups[j]] = [matchups[j], matchups[i]];
  }
  
  return matchups;
}

/**
 * Build initial matchup matrix showing how many times each pair should play
 */
function buildMatchupMatrix(teams, gamesPerTeam) {
  const n = teams.length;
  const gamesVs = Array(n).fill(0).map(() => Array(n).fill(0));
  
  // Simple distribution: play each opponent multiple times to reach 82 games
  const baseGames = Math.floor(gamesPerTeam / (n - 1));
  const extraGames = gamesPerTeam % (n - 1);
  
  for (let i = 0; i < n; i++) {
    let assigned = 0;
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        const games = baseGames + (assigned < extraGames ? 1 : 0);
        gamesVs[i][j] = games;
        assigned++;
      }
    }
  }
  
  return gamesVs;
}

/**
 * Find a perfect or near-perfect matching for one day
 * Returns array of [teamA, teamB] pairs
 */
function findDailyMatching(gamesVs, gamesLeft, numTeams) {
  const matching = [];
  const available = [];
  
  // Find teams that still need games
  for (let i = 0; i < numTeams; i++) {
    if (gamesLeft[i] > 0) {
      available.push(i);
    }
  }
  
  // Sort by fewest valid opponents (helps avoid dead ends)
  available.sort((a, b) => {
    const aOpponents = gamesVs[a].filter(g => g > 0).length;
    const bOpponents = gamesVs[b].filter(g => g > 0).length;
    return aOpponents - bOpponents;
  });
  
  const used = new Set();
  
  // Greedy matching
  for (const teamA of available) {
    if (used.has(teamA)) continue;
    
    // Find best opponent for teamA
    let bestOpponent = -1;
    let bestScore = -1;
    
    for (let teamB = 0; teamB < numTeams; teamB++) {
      if (teamB === teamA || used.has(teamB) || gamesVs[teamA][teamB] <= 0 || gamesLeft[teamB] <= 0) continue;
      
      // Score this pairing (prefer teams with fewer options)
      const score = 1000 - gamesVs[teamA].filter(g => g > 0).length - gamesVs[teamB].filter(g => g > 0).length;
      
      if (score > bestScore) {
        bestScore = score;
        bestOpponent = teamB;
      }
    }
    
    if (bestOpponent >= 0) {
      matching.push([teamA, bestOpponent]);
      used.add(teamA);
      used.add(bestOpponent);
    }
  }
  
  return matching;
}

/**
 * Validate the generated schedule
 */
function validateSchedule(schedule, teams, expectedGamesPerTeam) {
  const errors = [];
  const teamGames = {};
  const teamHomeGames = {};
  const teamAwayGames = {};
  
  // Initialize counters
  teams.forEach(t => {
    teamGames[t.id] = 0;
    teamHomeGames[t.id] = 0;
    teamAwayGames[t.id] = 0;
  });
  
  // Count games
  Object.values(schedule.games).forEach(game => {
    if (game.homeTeamId === game.awayTeamId) {
      errors.push(`Game ${game.id}: Team playing itself`);
    }
    
    teamGames[game.homeTeamId] = (teamGames[game.homeTeamId] || 0) + 1;
    teamGames[game.awayTeamId] = (teamGames[game.awayTeamId] || 0) + 1;
    teamHomeGames[game.homeTeamId] = (teamHomeGames[game.homeTeamId] || 0) + 1;
    teamAwayGames[game.awayTeamId] = (teamAwayGames[game.awayTeamId] || 0) + 1;
  });
  
  // Check each team
  let minGames = Infinity;
  let maxGames = 0;
  
  teams.forEach(t => {
    const total = teamGames[t.id] || 0;
    const home = teamHomeGames[t.id] || 0;
    const away = teamAwayGames[t.id] || 0;
    
    minGames = Math.min(minGames, total);
    maxGames = Math.max(maxGames, total);
    
    if (total !== expectedGamesPerTeam) {
      errors.push(`Team ${t.name}: ${total} games (expected ${expectedGamesPerTeam})`);
    }
    
    const expectedHome = Math.floor(expectedGamesPerTeam / 2);
    const expectedAway = Math.ceil(expectedGamesPerTeam / 2);
    
    if (Math.abs(home - expectedHome) > 1) {
      errors.push(`Team ${t.name}: ${home} home games (expected ~${expectedHome})`);
    }
    
    if (Math.abs(away - expectedAway) > 1) {
      errors.push(`Team ${t.name}: ${away} away games (expected ~${expectedAway})`);
    }
  });
  
  // Check total games
  const totalGames = Object.keys(schedule.games).length;
  const expectedTotal = (teams.length * expectedGamesPerTeam) / 2;
  if (totalGames !== expectedTotal) {
    errors.push(`Total games: ${totalGames} (expected ${expectedTotal})`);
  }
  
  return {
    valid: errors.length === 0,
    errors: errors,
    minGames: minGames,
    maxGames: maxGames
  };
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateLeagueSchedule,
    validateSchedule
  };
}
