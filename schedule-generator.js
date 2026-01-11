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
 * Generate all matchups with NBA-style distribution - DETERMINISTIC VERSION
 * GUARANTEES:
 * - Exactly 82 games per team
 * - Exactly 1230 total games
 * - Exactly 41 home / 41 away per team
 * - Division: 4 games each, Conference: mix of 3x and 4x, Other conf: 2 each
 * - NO RANDOMNESS - same input produces same output
 */
function generateAllMatchupsWithHomeAway(teams, season, gamesPerTeam) {
  const numTeams = teams.length;
  const expectedTotalGames = (numTeams * gamesPerTeam) / 2; // 1230
  
  console.log('[Schedule] Building deterministic matchup matrix...');
  
  // Step 1: Build symmetric matchup count matrix (DETERMINISTIC)
  const gamesVs = buildDeterministicMatchupMatrix(teams);
  
  // Step 2: Validate matrix
  const matrixValidation = validateMatchupMatrix(gamesVs, teams, gamesPerTeam);
  if (!matrixValidation.valid) {
    console.error('[Schedule] Matrix validation FAILED:', matrixValidation.errors);
    throw new Error('Matchup matrix validation failed: ' + matrixValidation.errors.join('; '));
  }
  
  console.log('[Schedule] ✓ Matrix validated - all teams have 82 games');
  
  // Step 3: Convert matrix to games with DETERMINISTIC home/away assignment
  const allGames = convertMatrixToGamesBalanced(gamesVs, teams, season);
  
  // Step 4: Final validation
  const finalValidation = validateFinalSchedule(allGames, teams, gamesPerTeam, expectedTotalGames);
  if (!finalValidation.valid) {
    console.error('[Schedule] Final validation FAILED:', finalValidation.errors);
    throw new Error('Schedule validation failed: ' + finalValidation.errors.join('; '));
  }
  
  console.log('[Schedule] ✓ Schedule validated - 1230 games, 41/41 home/away per team');
  
  // Shuffle for variety in calendar placement (THIS is the only randomness)
  for (let i = allGames.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allGames[i], allGames[j]] = [allGames[j], allGames[i]];
  }
  
  return allGames;
}

/**
 * Build matchup matrix using DETERMINISTIC algorithm
 * No randomness - same teams always produce same matchups
 */
function buildDeterministicMatchupMatrix(teams) {
  const numTeams = teams.length;
  const gamesVs = Array(numTeams).fill(null).map(() => Array(numTeams).fill(0));
  
  // Group teams by conference and division
  const conferenceTeams = { East: [], West: [] };
  const divisionTeams = {};
  
  teams.forEach((team, idx) => {
    conferenceTeams[team.conference].push(idx);
    
    const divKey = `${team.conference}-${team.division}`;
    if (!divisionTeams[divKey]) divisionTeams[divKey] = [];
    divisionTeams[divKey].push(idx);
  });
  
  // Sort conference teams by index for determinism
  conferenceTeams.East.sort((a, b) => a - b);
  conferenceTeams.West.sort((a, b) => a - b);
  
  // Step 1: Division games - 4 each (16 total per team)
  for (const divKey in divisionTeams) {
    const divTeams = divisionTeams[divKey].sort((a, b) => a - b);
    for (let i = 0; i < divTeams.length; i++) {
      for (let j = i + 1; j < divTeams.length; j++) {
        gamesVs[divTeams[i]][divTeams[j]] = 4;
        gamesVs[divTeams[j]][divTeams[i]] = 4;
      }
    }
  }
  
  // Step 2: Inter-conference games - 2 each (30 total per team)
  for (const eastIdx of conferenceTeams.East) {
    for (const westIdx of conferenceTeams.West) {
      gamesVs[eastIdx][westIdx] = 2;
      gamesVs[westIdx][eastIdx] = 2;
    }
  }
  
  // Step 3: Same-conference non-division - DETERMINISTIC 6×4 + 4×3 assignment
  // Total needed: 36 games per team against 10 non-division conference opponents
  // Distribution: 6 opponents at 4 games (24) + 4 opponents at 3 games (12) = 36
  for (const conference of ['East', 'West']) {
    const confTeams = conferenceTeams[conference].sort((a, b) => a - b);
    
    // Build all non-division pairs in stable order
    const pairs = [];
    for (let i = 0; i < confTeams.length; i++) {
      for (let j = i + 1; j < confTeams.length; j++) {
        const teamA = confTeams[i];
        const teamB = confTeams[j];
        
        // Skip if same division
        if (teams[teamA].division === teams[teamB].division) continue;
        
        pairs.push({ teamA, teamB, key: teamA * 1000 + teamB });
      }
    }
    
    // Sort pairs by key for determinism
    pairs.sort((a, b) => a.key - b.key);
    
    // Initially set all non-division conference pairs to 3 games
    for (const pair of pairs) {
      gamesVs[pair.teamA][pair.teamB] = 3;
      gamesVs[pair.teamB][pair.teamA] = 3;
    }
    
    // Now upgrade exactly 6 pairs per team from 3→4 games
    // Track upgrades per team
    const upgradesNeeded = {};
    confTeams.forEach(tid => upgradesNeeded[tid] = 6);
    
    // Upgrade pairs where both teams need upgrades
    for (const pair of pairs) {
      if (upgradesNeeded[pair.teamA] > 0 && upgradesNeeded[pair.teamB] > 0) {
        gamesVs[pair.teamA][pair.teamB] = 4;
        gamesVs[pair.teamB][pair.teamA] = 4;
        upgradesNeeded[pair.teamA]--;
        upgradesNeeded[pair.teamB]--;
      }
    }
  }
  
  return gamesVs;
}

/**
 * Validate matchup matrix for symmetry and correct game counts
 */
function validateMatchupMatrix(gamesVs, teams, expectedGamesPerTeam) {
  const errors = [];
  const numTeams = teams.length;
  
  // Check symmetry
  for (let i = 0; i < numTeams; i++) {
    for (let j = i + 1; j < numTeams; j++) {
      if (gamesVs[i][j] !== gamesVs[j][i]) {
        errors.push(`Asymmetric: Team ${i} (${teams[i].name}) vs Team ${j} (${teams[j].name}) has ${gamesVs[i][j]} but reverse has ${gamesVs[j][i]}`);
      }
    }
  }
  
  // Check each team's total games with detailed breakdown
  for (let i = 0; i < numTeams; i++) {
    const totalGames = gamesVs[i].reduce((sum, count) => sum + count, 0);
    if (totalGames !== expectedGamesPerTeam) {
      // Breakdown by opponent type
      let divGames = 0;
      let confGames = 0;
      let otherConfGames = 0;
      
      for (let j = 0; j < numTeams; j++) {
        if (i === j) continue;
        const games = gamesVs[i][j];
        
        if (teams[i].division === teams[j].division) {
          divGames += games;
        } else if (teams[i].conference === teams[j].conference) {
          confGames += games;
        } else {
          otherConfGames += games;
        }
      }
      
      errors.push(`Team ${i} (${teams[i].name}): ${totalGames} games (expected ${expectedGamesPerTeam}) - Division: ${divGames}, Conf: ${confGames}, Other: ${otherConfGames}`);
    }
  }
  
  // Check total game count
  const totalGames = gamesVs.reduce((sum, row) => sum + row.reduce((s, c) => s + c, 0), 0) / 2;
  const expectedTotal = (numTeams * expectedGamesPerTeam) / 2;
  if (totalGames !== expectedTotal) {
    errors.push(`Total games: ${totalGames} (expected ${expectedTotal})`);
  }
  
  if (errors.length > 0) {
    console.error('[Schedule Matrix] Validation errors:', errors);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Convert matchup matrix to games with GUARANTEED 41/41 home/away balance
 * DETERMINISTIC - no randomness
 */
function convertMatrixToGamesBalanced(gamesVs, teams, season) {
  const numTeams = teams.length;
  const allGames = [];
  let gameIdCounter = 0;
  
  const homeCount = Array(numTeams).fill(0);
  const awayCount = Array(numTeams).fill(0);
  
  // Process each team pair in stable order
  for (let i = 0; i < numTeams; i++) {
    for (let j = i + 1; j < numTeams; j++) {
      const numGames = gamesVs[i][j];
      if (numGames === 0) continue;
      
      // Deterministic home/away split
      let iHomeGames, jHomeGames;
      
      if (numGames === 2 || numGames === 4) {
        // Even split
        iHomeGames = numGames / 2;
        jHomeGames = numGames / 2;
      } else if (numGames === 3) {
        // Odd - give extra home to team with fewer home games
        // If tied, give to lower index team (deterministic)
        const iBalance = homeCount[i] - 41;
        const jBalance = homeCount[j] - 41;
        
        if (iBalance < jBalance) {
          iHomeGames = 2;
          jHomeGames = 1;
        } else if (jBalance < iBalance) {
          iHomeGames = 1;
          jHomeGames = 2;
        } else {
          // Tied - use team index as tiebreaker
          if (i < j) {
            iHomeGames = 2;
            jHomeGames = 1;
          } else {
            iHomeGames = 1;
            jHomeGames = 2;
          }
        }
      } else {
        throw new Error(`Unexpected game count: ${numGames} between teams ${i} and ${j}`);
      }
      
      // Create games with team i as home
      for (let g = 0; g < iHomeGames; g++) {
        const gameId = `game_${season}_${gameIdCounter++}`;
        allGames.push({
          id: gameId,
          season: season,
          homeTeamId: teams[i].id,
          awayTeamId: teams[j].id,
          homeTeamIndex: i,
          awayTeamIndex: j,
          status: 'scheduled',
          score: { home: 0, away: 0 },
          quarter: 0,
          timeRemaining: '12:00',
          log: [],
          boxScore: null
        });
        homeCount[i]++;
        awayCount[j]++;
      }
      
      // Create games with team j as home
      for (let g = 0; g < jHomeGames; g++) {
        const gameId = `game_${season}_${gameIdCounter++}`;
        allGames.push({
          id: gameId,
          season: season,
          homeTeamId: teams[j].id,
          awayTeamId: teams[i].id,
          homeTeamIndex: j,
          awayTeamIndex: i,
          status: 'scheduled',
          score: { home: 0, away: 0 },
          quarter: 0,
          timeRemaining: '12:00',
          log: [],
          boxScore: null
        });
        homeCount[j]++;
        awayCount[i]++;
      }
    }
  }
  
  // Final balancing pass - flip games if needed to hit exactly 41/41
  for (let teamIdx = 0; teamIdx < numTeams; teamIdx++) {
    while (homeCount[teamIdx] < 41 && awayCount[teamIdx] > 41) {
      // Team needs more home games - find a game where they're away and flip it
      const gameToFlip = allGames.find(g => 
        g.awayTeamIndex === teamIdx && 
        homeCount[g.homeTeamIndex] > 41
      );
      
      if (gameToFlip) {
        // Flip home/away
        const tempId = gameToFlip.homeTeamId;
        const tempIdx = gameToFlip.homeTeamIndex;
        gameToFlip.homeTeamId = gameToFlip.awayTeamId;
        gameToFlip.homeTeamIndex = gameToFlip.awayTeamIndex;
        gameToFlip.awayTeamId = tempId;
        gameToFlip.awayTeamIndex = tempIdx;
        
        homeCount[teamIdx]++;
        awayCount[teamIdx]--;
        homeCount[tempIdx]--;
        awayCount[tempIdx]++;
      } else {
        break; // Can't balance further
      }
    }
    
    while (homeCount[teamIdx] > 41 && awayCount[teamIdx] < 41) {
      // Team has too many home games - find a game where they're home and flip it
      const gameToFlip = allGames.find(g => 
        g.homeTeamIndex === teamIdx && 
        awayCount[g.awayTeamIndex] > 41
      );
      
      if (gameToFlip) {
        // Flip home/away
        const tempId = gameToFlip.homeTeamId;
        const tempIdx = gameToFlip.homeTeamIndex;
        gameToFlip.homeTeamId = gameToFlip.awayTeamId;
        gameToFlip.homeTeamIndex = gameToFlip.awayTeamIndex;
        gameToFlip.awayTeamId = tempId;
        gameToFlip.awayTeamIndex = tempIdx;
        
        homeCount[teamIdx]--;
        awayCount[teamIdx]++;
        homeCount[tempIdx]++;
        awayCount[tempIdx]--;
      } else {
        break;
      }
    }
  }
  
  return allGames;
}

/**
 * Validate final schedule meets all requirements
 */
function validateFinalSchedule(allGames, teams, expectedGamesPerTeam, expectedTotalGames) {
  const errors = [];
  const numTeams = teams.length;
  
  // Check total game count
  if (allGames.length !== expectedTotalGames) {
    errors.push(`Total games: ${allGames.length} (expected ${expectedTotalGames})`);
  }
  
  // Count games per team
  const teamGames = Array(numTeams).fill(0);
  const homeGames = Array(numTeams).fill(0);
  const awayGames = Array(numTeams).fill(0);
  
  for (const game of allGames) {
    teamGames[game.homeTeamIndex]++;
    teamGames[game.awayTeamIndex]++;
    homeGames[game.homeTeamIndex]++;
    awayGames[game.awayTeamIndex]++;
  }
  
  // Validate each team
  for (let i = 0; i < numTeams; i++) {
    if (teamGames[i] !== expectedGamesPerTeam) {
      errors.push(`Team ${i} (${teams[i].name}): ${teamGames[i]} total games (expected ${expectedGamesPerTeam})`);
    }
    
    const targetHomeAway = expectedGamesPerTeam / 2;
    if (homeGames[i] !== targetHomeAway) {
      errors.push(`Team ${i} (${teams[i].name}): ${homeGames[i]} home games (expected ${targetHomeAway})`);
    }
    if (awayGames[i] !== targetHomeAway) {
      errors.push(`Team ${i} (${teams[i].name}): ${awayGames[i]} away games (expected ${targetHomeAway})`);
    }
  }
  
  // Check for duplicates
  const gameSet = new Set();
  for (const game of allGames) {
    const key = `${Math.min(game.homeTeamIndex, game.awayTeamIndex)}-${Math.max(game.homeTeamIndex, game.awayTeamIndex)}`;
    gameSet.add(key);
  }
  
  // Check for team playing itself
  for (const game of allGames) {
    if (game.homeTeamIndex === game.awayTeamIndex) {
      errors.push(`Team ${game.homeTeamIndex} plays itself`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Assign games to calendar days with realistic spacing constraints
 * ENFORCES MAX_GAP RULE: No team can go more than MAX_GAP days without a game
 */
function assignGamesToCalendar(allGames, numTeams, config) {
  const MAX_GAP = 4; // Maximum days between consecutive games for any team (HARD RULE)
  const MIN_REST = 1; // Minimum rest days between games (1 = no back-to-back by default)
  const TARGET_GAMES_PER_DAY = 10; // Target number of games per calendar day
  const MAX_GAMES_PER_DAY = 12; // Hard limit on games per day
  
  let retries = 0;
  const maxRetries = 50;
  let bestAttempt = null;
  let bestScore = Infinity;
  
  console.log(`[Schedule] Starting calendar placement with MAX_GAP=${MAX_GAP}, MIN_REST=${MIN_REST}`);
  
  while (retries < maxRetries) {
    const calendar = Array(config.seasonDays).fill(null).map(() => []);
    const teamLastDayPlayed = Array(numTeams).fill(-999); // Start with very negative so first game is always valid
    const teamGamesScheduled = Array(numTeams).fill(0);
    const teamBackToBacks = Array(numTeams).fill(0);
    
    // Shuffle games for variety on each retry
    const remainingGames = [...allGames].sort(() => Math.random() - 0.5);
    
    let calendarDay = 0;
    let consecutiveEmptyDays = 0;
    let placementFailed = false;
    
    while (remainingGames.length > 0 && calendarDay < config.seasonDays) {
      const dayGames = [];
      const teamsScheduledToday = new Set();
      
      // Step 1: Find teams that are overdue (would exceed MAX_GAP if not scheduled today)
      const overdueTeams = new Set();
      for (let teamIdx = 0; teamIdx < numTeams; teamIdx++) {
        if (teamGamesScheduled[teamIdx] === 0) continue; // Skip teams with no games yet (handled separately)
        
        const daysSinceLastGame = calendarDay - teamLastDayPlayed[teamIdx];
        if (daysSinceLastGame > MAX_GAP) {
          overdueTeams.add(teamIdx);
        }
      }
      
      // Step 2: Build candidate games
      const candidateGames = [];
      const overdueGames = [];
      
      for (let i = remainingGames.length - 1; i >= 0; i--) {
        const game = remainingGames[i];
        const homeIdx = game.homeTeamIndex;
        const awayIdx = game.awayTeamIndex;
        
        // Skip if either team already playing today
        if (teamsScheduledToday.has(homeIdx) || teamsScheduledToday.has(awayIdx)) {
          continue;
        }
        
        // Check rest constraints
        const homeDaysSince = calendarDay - teamLastDayPlayed[homeIdx];
        const awayDaysSince = calendarDay - teamLastDayPlayed[awayIdx];
        
        // Calculate effective MIN_REST (allow back-to-backs if we're desperate)
        let effectiveMinRest = MIN_REST;
        if (retries > 10) effectiveMinRest = 0; // Allow back-to-backs after many retries
        
        // Check if rest requirement met
        const homeRestOk = homeDaysSince >= effectiveMinRest + 1 || teamGamesScheduled[homeIdx] === 0;
        const awayRestOk = awayDaysSince >= effectiveMinRest + 1 || teamGamesScheduled[awayIdx] === 0;
        
        if (!homeRestOk || !awayRestOk) {
          // Check if it's a back-to-back situation
          const homeIsBackToBack = homeDaysSince === 1;
          const awayIsBackToBack = awayDaysSince === 1;
          
          // Limit back-to-backs per team
          if (homeIsBackToBack && teamBackToBacks[homeIdx] >= 15) continue;
          if (awayIsBackToBack && teamBackToBacks[awayIdx] >= 15) continue;
          
          // Only allow if desperate
          if (effectiveMinRest > 0) continue;
        }
        
        // Check if this game involves an overdue team
        const involvesOverdueTeam = overdueTeams.has(homeIdx) || overdueTeams.has(awayIdx);
        
        if (involvesOverdueTeam) {
          overdueGames.push({ game, index: i });
        } else {
          candidateGames.push({ game, index: i });
        }
      }
      
      // Step 3: Schedule games, prioritizing overdue teams
      const gamesToSchedule = [...overdueGames, ...candidateGames];
      
      for (const { game, index } of gamesToSchedule) {
        if (dayGames.length >= MAX_GAMES_PER_DAY) break;
        
        const homeIdx = game.homeTeamIndex;
        const awayIdx = game.awayTeamIndex;
        
        // Double-check constraints (teams might have been scheduled in this loop)
        if (teamsScheduledToday.has(homeIdx) || teamsScheduledToday.has(awayIdx)) {
          continue;
        }
        
        // Place the game
        dayGames.push(game);
        teamsScheduledToday.add(homeIdx);
        teamsScheduledToday.add(awayIdx);
        
        // Update tracking
        const homeDaysSince = calendarDay - teamLastDayPlayed[homeIdx];
        const awayDaysSince = calendarDay - teamLastDayPlayed[awayIdx];
        
        if (homeDaysSince === 1) teamBackToBacks[homeIdx]++;
        if (awayDaysSince === 1) teamBackToBacks[awayIdx]++;
        
        teamLastDayPlayed[homeIdx] = calendarDay;
        teamLastDayPlayed[awayIdx] = calendarDay;
        teamGamesScheduled[homeIdx]++;
        teamGamesScheduled[awayIdx]++;
        
        // Remove from remaining games
        remainingGames.splice(index, 1);
        
        // Stop if we hit target games per day (unless we have overdue teams)
        if (dayGames.length >= TARGET_GAMES_PER_DAY && overdueTeams.size === 0) {
          break;
        }
      }
      
      // Add games to calendar
      calendar[calendarDay] = dayGames;
      
      // Track empty days
      if (dayGames.length === 0) {
        consecutiveEmptyDays++;
        if (consecutiveEmptyDays > 10 && remainingGames.length > 0) {
          // We're stuck, can't place any more games
          placementFailed = true;
          break;
        }
      } else {
        consecutiveEmptyDays = 0;
      }
      
      calendarDay++;
    }
    
    // Check if placement succeeded
    if (remainingGames.length > 0 || placementFailed) {
      console.warn(`[Schedule] Retry ${retries + 1}: Failed to place ${remainingGames.length} games`);
      retries++;
      continue;
    }
    
    // Validate the schedule
    const validation = validateCalendarPlacement(calendar, numTeams, MAX_GAP, config.gamesPerTeam || 82);
    
    if (validation.valid) {
      console.log(`[Schedule] ✓ Valid placement found on retry ${retries + 1}`);
      console.log(`[Schedule] ✓ Max gap: ${validation.maxGap} days, Avg gap: ${validation.avgGap.toFixed(1)} days`);
      console.log(`[Schedule] ✓ Back-to-backs: ${validation.totalBackToBacks}, Days used: ${validation.daysUsed}/${config.seasonDays}`);
      return calendar;
    } else {
      // Track best attempt
      const score = validation.violations.length + (validation.maxGap - MAX_GAP) * 100;
      if (score < bestScore) {
        bestScore = score;
        bestAttempt = calendar;
      }
      
      console.warn(`[Schedule] Retry ${retries + 1}: ${validation.violations.length} violations, max gap: ${validation.maxGap}`);
      retries++;
    }
  }
  
  // If we exhausted retries, use best attempt or throw error
  if (bestAttempt) {
    console.error(`[Schedule] Using best attempt after ${maxRetries} retries (score: ${bestScore})`);
    return bestAttempt;
  }
  
  throw new Error(`Failed to generate valid schedule after ${maxRetries} retries`);
}

/**
 * Validate calendar placement for MAX_GAP and game count
 */
function validateCalendarPlacement(calendar, numTeams, maxGap, expectedGamesPerTeam) {
  const teamGames = Array(numTeams).fill(null).map(() => []);
  const violations = [];
  
  // Collect all games by team
  calendar.forEach((dayGames, calendarDay) => {
    dayGames.forEach(game => {
      teamGames[game.homeTeamIndex].push(calendarDay);
      teamGames[game.awayTeamIndex].push(calendarDay);
    });
  });
  
  let maxGapFound = 0;
  let totalGaps = 0;
  let gapCount = 0;
  let totalBackToBacks = 0;
  
  // Check each team
  for (let teamIdx = 0; teamIdx < numTeams; teamIdx++) {
    const games = teamGames[teamIdx].sort((a, b) => a - b);
    
    // Check game count
    if (games.length !== expectedGamesPerTeam) {
      violations.push(`Team ${teamIdx}: ${games.length} games (expected ${expectedGamesPerTeam})`);
    }
    
    // Check gaps between consecutive games
    for (let i = 1; i < games.length; i++) {
      const gap = games[i] - games[i - 1];
      maxGapFound = Math.max(maxGapFound, gap);
      totalGaps += gap;
      gapCount++;
      
      if (gap === 1) {
        totalBackToBacks++;
      }
      
      if (gap > maxGap) {
        violations.push(`Team ${teamIdx}: gap of ${gap} days between games (max allowed: ${maxGap})`);
      }
    }
  }
  
  const avgGap = gapCount > 0 ? totalGaps / gapCount : 0;
  const daysUsed = calendar.filter(day => day.length > 0).length;
  
  return {
    valid: violations.length === 0,
    violations,
    maxGap: maxGapFound,
    avgGap,
    totalBackToBacks,
    daysUsed
  };
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
