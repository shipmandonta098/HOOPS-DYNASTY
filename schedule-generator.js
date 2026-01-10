/* ============================
   LEAGUE SCHEDULE GENERATOR
   
   Uses ROUND-ROBIN CIRCLE METHOD + CALENDAR SPACING
   - Generates exactly 82 games per team (30-team league)
   - Spreads games across realistic calendar (175 days)
   - Teams get rest days between games
   - Allows limited back-to-backs for realism
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
  
  // Schedule configuration
  const config = {
    seasonDays: 175,
    maxGamesPerDayLeague: 12,
    minRestDaysPreferred: 1,
    allowBackToBack: true,
    backToBackTargetPerTeam: 12
  };
  
  // Step 1: Generate all matchups with home/away assignments
  const allGames = generateAllMatchupsWithHomeAway(teams, season, gamesPerTeam);
  
  console.log(`[Schedule Generator] Generated ${allGames.length} total games`);
  
  // Step 2: Assign games to calendar days
  const calendar = assignGamesToCalendar(allGames, numTeams, config);
  
  // Step 3: Build final schedule structure
  const schedule = {
    days: [],
    games: {},
    seasonDays: config.seasonDays,
    totalDays: 0,
    gamesPerTeam: gamesPerTeam,
    totalGames: 0
  };
  
  // Convert calendar to schedule format
  let dayNumber = 0;
  for (let calendarDay = 0; calendarDay < calendar.length; calendarDay++) {
    const dayGames = calendar[calendarDay];
    
    if (dayGames.length > 0) {
      dayNumber++;
      const gameIds = [];
      
      for (const game of dayGames) {
        schedule.games[game.id] = {
          ...game,
          day: dayNumber,
          calendarDay: calendarDay + 1 // 1-based for display
        };
        gameIds.push(game.id);
      }
      
      schedule.days.push({
        day: dayNumber,
        calendarDay: calendarDay + 1,
        phase: 'Regular Season',
        games: gameIds
      });
    }
  }
  
  schedule.totalDays = dayNumber;
  schedule.totalGames = Object.keys(schedule.games).length;
  
  // Global validation
  const validation = validateSchedule(schedule, teams, gamesPerTeam);
  if (!validation.valid) {
    console.error('[Schedule Generator] VALIDATION FAILED:', validation.errors);
    throw new Error('Schedule validation failed: ' + validation.errors.join(', '));
  }
  
  // Calculate stats
  const stats = calculateScheduleStats(calendar, numTeams, config.seasonDays);
  
  console.log(`[Schedule Generator] ✓ Schedule generated: days=${schedule.totalDays} games=${schedule.totalGames} calendar=${config.seasonDays}`);
  console.log(`[Schedule Generator] ✓ Schedule validated: minGames=${validation.minGames} maxGames=${validation.maxGames}`);
  console.log(`[Schedule Generator] ✓ Stats: avgGamesPerDay=${stats.avgGamesPerDay.toFixed(1)} avgRestDays=${stats.avgRestDays.toFixed(1)} avgBackToBacks=${stats.avgBackToBacks.toFixed(1)}`);
  
  return schedule;
}

/**
 * Generate all matchups with home/away assignments
 */
function generateAllMatchupsWithHomeAway(teams, season, gamesPerTeam) {
  const numTeams = teams.length;
  
  // Generate round-robin pairings
  const roundPairings = generateRoundRobinPairings(numTeams);
  const numRounds = roundPairings.length;
  
  const allGames = [];
  let gameIdCounter = 0;
  const homeCount = Array(numTeams).fill(0);
  const awayCount = Array(numTeams).fill(0);
  
  // Generate games by cycling through round pairings
  for (let gameRound = 0; gameRound < gamesPerTeam; gameRound++) {
    const roundIndex = gameRound % numRounds;
    const pairings = roundPairings[roundIndex];
    
    for (const [teamA, teamB] of pairings) {
      // Determine home/away based on balance
      let homeTeam, awayTeam;
      
      const aBalance = homeCount[teamA] - awayCount[teamA];
      const bBalance = homeCount[teamB] - awayCount[teamB];
      
      if (aBalance < bBalance) {
        homeTeam = teamA;
        awayTeam = teamB;
      } else if (bBalance < aBalance) {
        homeTeam = teamB;
        awayTeam = teamA;
      } else {
        // Equal balance: alternate based on round
        if (gameRound % 2 === 0) {
          homeTeam = teamA;
          awayTeam = teamB;
        } else {
          homeTeam = teamB;
          awayTeam = teamA;
        }
      }
      
      const gameId = `game_${season}_${gameIdCounter++}`;
      allGames.push({
        id: gameId,
        season: season,
        homeTeamId: teams[homeTeam].id,
        awayTeamId: teams[awayTeam].id,
        homeTeamIndex: homeTeam,
        awayTeamIndex: awayTeam,
        status: 'scheduled',
        score: { home: 0, away: 0 },
        quarter: 0,
        timeRemaining: '12:00',
        log: [],
        boxScore: null
      });
      
      homeCount[homeTeam]++;
      awayCount[awayTeam]++;
    }
  }
  
  // Shuffle for variety in calendar placement
  for (let i = allGames.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allGames[i], allGames[j]] = [allGames[j], allGames[i]];
  }
  
  return allGames;
}

/**
 * Assign games to calendar days with rest days
 */
function assignGamesToCalendar(allGames, numTeams, config) {
  const calendar = Array(config.seasonDays).fill(null).map(() => []);
  const lastPlayedDay = Array(numTeams).fill(-999);
  const gamesAssigned = Array(numTeams).fill(0);
  const backToBacks = Array(numTeams).fill(0);
  
  let retries = 0;
  const maxRetries = 3;
  
  while (retries < maxRetries) {
    // Reset for retry
    calendar.forEach(day => day.length = 0);
    lastPlayedDay.fill(-999);
    gamesAssigned.fill(0);
    backToBacks.fill(0);
    
    let failedPlacements = 0;
    
    // Try to place each game
    for (const game of allGames) {
      const homeIdx = game.homeTeamIndex;
      const awayIdx = game.awayTeamIndex;
      let placed = false;
      
      // Try to find earliest suitable day
      for (let day = 0; day < config.seasonDays; day++) {
        // Check constraints
        const dayGames = calendar[day];
        
        // a) Neither team already playing this day
        const homeAlreadyPlaying = dayGames.some(g => g.homeTeamIndex === homeIdx || g.awayTeamIndex === homeIdx);
        const awayAlreadyPlaying = dayGames.some(g => g.homeTeamIndex === awayIdx || g.awayTeamIndex === awayIdx);
        if (homeAlreadyPlaying || awayAlreadyPlaying) continue;
        
        // b) Day not full
        if (dayGames.length >= config.maxGamesPerDayLeague) continue;
        
        // c) Rest rules
        const homeDaysSinceLastGame = day - lastPlayedDay[homeIdx];
        const awayDaysSinceLastGame = day - lastPlayedDay[awayIdx];
        
        const homeNeedsRest = homeDaysSinceLastGame < config.minRestDaysPreferred + 1;
        const awayNeedsRest = awayDaysSinceLastGame < config.minRestDaysPreferred + 1;
        
        if (homeNeedsRest || awayNeedsRest) {
          // Check if it's a back-to-back
          const homeBackToBack = homeDaysSinceLastGame === 1;
          const awayBackToBack = awayDaysSinceLastGame === 1;
          
          if (homeBackToBack && backToBacks[homeIdx] >= config.backToBackTargetPerTeam + 3) continue;
          if (awayBackToBack && backToBacks[awayIdx] >= config.backToBackTargetPerTeam + 3) continue;
          
          // Allow if not too many back-to-backs and past first 10 days
          if (day < 10) continue;
        }
        
        // Place the game
        dayGames.push(game);
        lastPlayedDay[homeIdx] = day;
        lastPlayedDay[awayIdx] = day;
        gamesAssigned[homeIdx]++;
        gamesAssigned[awayIdx]++;
        
        // Track back-to-backs
        if (day > 0 && day - lastPlayedDay[homeIdx] === 1) backToBacks[homeIdx]++;
        if (day > 0 && day - lastPlayedDay[awayIdx] === 1) backToBacks[awayIdx]++;
        
        placed = true;
        break;
      }
      
      if (!placed) {
        failedPlacements++;
      }
    }
    
    if (failedPlacements === 0) {
      console.log(`[Schedule Generator] ✓ All games placed successfully`);
      break;
    } else {
      console.warn(`[Schedule Generator] Failed to place ${failedPlacements} games, retry ${retries + 1}/${maxRetries}`);
      retries++;
      
      // Relax constraints for next retry
      config.minRestDaysPreferred = Math.max(0, config.minRestDaysPreferred - 1);
      config.backToBackTargetPerTeam += 3;
    }
  }
  
  return calendar;
}

/**
 * Calculate schedule statistics
 */
function calculateScheduleStats(calendar, numTeams, seasonDays) {
  const totalGames = calendar.reduce((sum, day) => sum + day.length, 0);
  const daysWithGames = calendar.filter(day => day.length > 0).length;
  const avgGamesPerDay = totalGames / daysWithGames;
  
  const lastPlayedDay = Array(numTeams).fill(-1);
  const restDays = Array(numTeams).fill([]).map(() => []);
  const backToBacks = Array(numTeams).fill(0);
  
  for (let day = 0; day < seasonDays; day++) {
    const dayGames = calendar[day];
    const teamsPlayingToday = new Set();
    
    for (const game of dayGames) {
      teamsPlayingToday.add(game.homeTeamIndex);
      teamsPlayingToday.add(game.awayTeamIndex);
    }
    
    for (const teamIdx of teamsPlayingToday) {
      if (lastPlayedDay[teamIdx] >= 0) {
        const daysSinceLastGame = day - lastPlayedDay[teamIdx];
        restDays[teamIdx].push(daysSinceLastGame - 1);
        
        if (daysSinceLastGame === 1) {
          backToBacks[teamIdx]++;
        }
      }
      lastPlayedDay[teamIdx] = day;
    }
  }
  
  const totalRestDays = restDays.reduce((sum, team) => sum + team.reduce((a, b) => a + b, 0), 0);
  const avgRestDays = totalRestDays / (totalGames / 2);
  const avgBackToBacks = backToBacks.reduce((a, b) => a + b, 0) / numTeams;
  
  return {
    avgGamesPerDay,
    avgRestDays,
    avgBackToBacks,
    daysWithGames
  };
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
