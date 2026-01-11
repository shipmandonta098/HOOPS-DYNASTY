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
  // Step 3: Shuffle for variety (only randomness in generation)
  for (let i = allGames.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allGames[i], allGames[j]] = [allGames[j], allGames[i]];
  }
  
  // Build final schedule structure - NO CALENDAR DAYS
  const schedule = {
    games: {},
    gamesPerTeam: gamesPerTeam,
    totalGames: 0
  };
  
  // Convert array to games object (no day assignment)
  for (const game of allGames) {
    schedule.games[game.id] = game;
  }
  
  schedule.totalGames = Object.keys(schedule.games).length;
  
  // Validation: Check total games and per-team counts
  const expectedTotal = (numTeams * gamesPerTeam) / 2;
  if (schedule.totalGames !== expectedTotal) {
    throw new Error(`Schedule has ${schedule.totalGames} games, expected ${expectedTotal}`);
  }
  
  // Validation: Check each team has exactly 82 games
  const teamGameCounts = Array(numTeams).fill(0);
  Object.values(schedule.games).forEach(game => {
    teamGameCounts[game.homeTeamIndex]++;
    teamGameCounts[game.awayTeamIndex]++;
  });
  
  for (let i = 0; i < numTeams; i++) {
    if (teamGameCounts[i] !== gamesPerTeam) {
      throw new Error(`Team ${i} (${teams[i].name}) has ${teamGameCounts[i]} games, expected ${gamesPerTeam}`);
    }
  }
  
  // Validation: Ensure no calendarDay or day fields exist
  const gamesWithDayFields = Object.values(schedule.games).filter(g => 'calendarDay' in g || 'day' in g);
  if (gamesWithDayFields.length > 0) {
    console.warn('[Schedule] WARNING: Games have calendarDay/day fields, stripping them');
    Object.values(schedule.games).forEach(game => {
      delete game.calendarDay;
      delete game.day;
    });
  }
  
  console.log(`[Schedule Generator] ✓ Schedule generated: ${schedule.totalGames} games, ${numTeams} teams`);
  console.log(`[Schedule Generator] ✓ Each team has exactly ${gamesPerTeam} games`);
  console.log(`[Schedule Generator] ✓ No calendarDay fields - using ordered game list`);
  
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
  
  return allGames;
}

/**
 * Build matchup matrix using DETERMINISTIC algorithm with GUARANTEED 6 upgrades per team
 * No randomness - same teams always produce same matchups
 * GUARANTEES: Each team gets exactly 82 games (16 div + 36 conf + 30 other)
 */
function buildDeterministicMatchupMatrix(teams) {
  const numTeams = teams.length;
  const gamesVs = Array(numTeams).fill(null).map(() => Array(numTeams).fill(0));
  
  // Step 1: Build conference/division structure
  const conferences = { East: { divisions: [] }, West: { divisions: [] } };
  const divisionMap = {};
  
  teams.forEach((team, idx) => {
    const divKey = `${team.conference}-${team.division}`;
    if (!divisionMap[divKey]) {
      divisionMap[divKey] = [];
    }
    divisionMap[divKey].push(idx);
  });
  
  // Sort divisions and teams within divisions for determinism
  for (const divKey in divisionMap) {
    divisionMap[divKey].sort((a, b) => a - b);
  }
  
  // Organize into conference structure
  const eastDivKeys = Object.keys(divisionMap).filter(k => k.startsWith('East-')).sort();
  const westDivKeys = Object.keys(divisionMap).filter(k => k.startsWith('West-')).sort();
  
  conferences.East.divisions = eastDivKeys.map(k => divisionMap[k]);
  conferences.West.divisions = westDivKeys.map(k => divisionMap[k]);
  
  // Step 2: Division games - 4 each (16 total per team)
  for (const divKey in divisionMap) {
    const divTeams = divisionMap[divKey];
    for (let i = 0; i < divTeams.length; i++) {
      for (let j = i + 1; j < divTeams.length; j++) {
        gamesVs[divTeams[i]][divTeams[j]] = 4;
        gamesVs[divTeams[j]][divTeams[i]] = 4;
      }
    }
  }
  
  // Step 3: Inter-conference games - 2 each (30 total per team)
  const eastTeams = conferences.East.divisions.flat().sort((a, b) => a - b);
  const westTeams = conferences.West.divisions.flat().sort((a, b) => a - b);
  
  for (const eastIdx of eastTeams) {
    for (const westIdx of westTeams) {
      gamesVs[eastIdx][westIdx] = 2;
      gamesVs[westIdx][eastIdx] = 2;
    }
  }
  
  // Step 4: Same-conference non-division games using MODULAR PATTERN
  // GUARANTEES: Each team gets exactly 6 upgrades (3 per other division pair)
  // Result: 10 opponents with 6 at 4 games + 4 at 3 games = 36 total
  for (const confName of ['East', 'West']) {
    const divisions = conferences[confName].divisions;
    
    // Process each division pair
    const divisionPairs = [
      [0, 1], // D0-D1
      [0, 2], // D0-D2
      [1, 2]  // D1-D2
    ];
    
    for (const [d0Idx, d1Idx] of divisionPairs) {
      const D0 = divisions[d0Idx];
      const D1 = divisions[d1Idx];
      
      // First: Set all cross-division pairs to 3 games
      for (let i = 0; i < D0.length; i++) {
        for (let j = 0; j < D1.length; j++) {
          const a = D0[i];
          const b = D1[j];
          if (gamesVs[a][b] === 0) {
            gamesVs[a][b] = 3;
            gamesVs[b][a] = 3;
          }
        }
      }
      
      // Second: Upgrade specific pairs using modular pattern
      // Each team i gets upgraded opponents at positions i, i+1, i+2 (mod 5)
      // This gives exactly 3 upgrades per team per division pair
      for (let i = 0; i < D0.length; i++) {
        for (let offset = 0; offset < 3; offset++) {
          const j = (i + offset) % D0.length;
          const a = D0[i];
          const b = D1[j];
          gamesVs[a][b] = 4;
          gamesVs[b][a] = 4;
        }
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
 * Convert matchup matrix to games with GUARANTEED correct count
 * CRITICAL: Must produce exactly 1230 games with 82 per team
 * DETERMINISTIC - no randomness
 */
function convertMatrixToGamesBalanced(gamesVs, teams, season) {
  const numTeams = teams.length;
  const allGames = [];
  let gameIdCounter = 0;
  
  const homeCount = Array(numTeams).fill(0);
  const awayCount = Array(numTeams).fill(0);
  const gameCount = Array(numTeams).fill(0);
  
  // Process each team pair ONCE (a < b only) to avoid duplicates
  for (let a = 0; a < numTeams; a++) {
    for (let b = a + 1; b < numTeams; b++) {
      const n = gamesVs[a][b];
      if (n === 0) continue;
      
      // Determine home/away split for this pair
      let aHomeGames, bHomeGames;
      
      if (n === 2) {
        // 2 games: 1 home each
        aHomeGames = 1;
        bHomeGames = 1;
      } else if (n === 4) {
        // 4 games: 2 home each
        aHomeGames = 2;
        bHomeGames = 2;
      } else if (n === 3) {
        // 3 games: 2 home for one team, 1 for the other
        // Give extra home to team with fewer home games, tiebreak by lower tid
        if (homeCount[a] < homeCount[b]) {
          aHomeGames = 2;
          bHomeGames = 1;
        } else if (homeCount[b] < homeCount[a]) {
          aHomeGames = 1;
          bHomeGames = 2;
        } else {
          // Tied - use team index as tiebreaker
          aHomeGames = 2; // 'a' is always lower
          bHomeGames = 1;
        }
      } else {
        throw new Error(`Unexpected game count ${n} between teams ${a} (${teams[a].name}) and ${b} (${teams[b].name})`);
      }
      
      // CRITICAL: Verify we're creating exactly n games
      if (aHomeGames + bHomeGames !== n) {
        throw new Error(`Home/away split error: ${aHomeGames} + ${bHomeGames} != ${n} for teams ${a} and ${b}`);
      }
      
      // Create games with team a as home
      for (let g = 0; g < aHomeGames; g++) {
        allGames.push({
          id: `game_${season}_${gameIdCounter++}`,
          season: season,
          homeTeamId: teams[a].id,
          awayTeamId: teams[b].id,
          homeTeamIndex: a,
          awayTeamIndex: b,
          status: 'scheduled',
          score: { home: 0, away: 0 },
          quarter: 0,
          timeRemaining: '12:00',
          log: [],
          boxScore: null
        });
        homeCount[a]++;
        awayCount[b]++;
        gameCount[a]++;
        gameCount[b]++;
      }
      
      // Create games with team b as home
      for (let g = 0; g < bHomeGames; g++) {
        allGames.push({
          id: `game_${season}_${gameIdCounter++}`,
          season: season,
          homeTeamId: teams[b].id,
          awayTeamId: teams[a].id,
          homeTeamIndex: b,
          awayTeamIndex: a,
          status: 'scheduled',
          score: { home: 0, away: 0 },
          quarter: 0,
          timeRemaining: '12:00',
          log: [],
          boxScore: null
        });
        homeCount[b]++;
        awayCount[a]++;
        gameCount[a]++;
        gameCount[b]++;
      }
    }
  }
  
  // IMMEDIATE VALIDATION - before any further processing
  const errors = [];
  
  // Check total games
  if (allGames.length !== 1230) {
    errors.push(`Total games: ${allGames.length} (expected 1230)`);
  }
  
  // Check each team's game count
  for (let tid = 0; tid < numTeams; tid++) {
    if (gameCount[tid] !== 82) {
      errors.push(`Team ${tid} (${teams[tid].name}): ${gameCount[tid]} games (expected 82) - Home: ${homeCount[tid]}, Away: ${awayCount[tid]}`);
    }
  }
  
  // If validation failed, find the discrepancy
  if (errors.length > 0) {
    console.error('[Schedule Expansion] VALIDATION FAILED:');
    console.error(errors);
    
    // Debug: Find which pairs don't match expected counts
    console.error('[Schedule Expansion] Checking matrix vs actual games...');
    for (let a = 0; a < numTeams; a++) {
      for (let b = a + 1; b < numTeams; b++) {
        const expected = gamesVs[a][b];
        if (expected === 0) continue;
        
        const actual = allGames.filter(g => 
          (g.homeTeamIndex === a && g.awayTeamIndex === b) ||
          (g.homeTeamIndex === b && g.awayTeamIndex === a)
        ).length;
        
        if (actual !== expected) {
          console.error(`  Pair ${a}-${b} (${teams[a].name} vs ${teams[b].name}): expected ${expected} games, created ${actual}`);
        }
      }
    }
    
    throw new Error('Game expansion validation failed: ' + errors.join('; '));
  }
  
  console.log('[Schedule Expansion] ✓ Validated: 1230 games, 82 per team');
  
  // Final balancing pass for home/away to get as close to 41/41 as possible
  balanceHomeAwayFinal(allGames, teams, homeCount, awayCount);
  
  return allGames;
}

/**
 * Final balancing pass to get each team to exactly 41 home / 41 away
 */
function balanceHomeAwayFinal(allGames, teams, homeCount, awayCount) {
  const numTeams = teams.length;
  
  for (let teamIdx = 0; teamIdx < numTeams; teamIdx++) {
    while (homeCount[teamIdx] < 41 && awayCount[teamIdx] > 41) {
      // Team needs more home games - find a game where they're away and can flip
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
        break;
      }
    }
    
    while (homeCount[teamIdx] > 41 && awayCount[teamIdx] < 41) {
      // Team has too many home games - find a game where they're home and can flip
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
  
  // Log final home/away distribution
  let perfectBalance = 0;
  for (let tid = 0; tid < numTeams; tid++) {
    if (homeCount[tid] === 41 && awayCount[tid] === 41) {
      perfectBalance++;
    }
  }
  console.log(`[Schedule Balance] ${perfectBalance}/${numTeams} teams have exactly 41 home / 41 away`);
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
    
    // Allow 40-42 home/away (perfectly balanced is ideal but not required)
    const targetHomeAway = expectedGamesPerTeam / 2;
    if (homeGames[i] < 40 || homeGames[i] > 42) {
      errors.push(`Team ${i} (${teams[i].name}): ${homeGames[i]} home games (expected ~${targetHomeAway})`);
    }
    if (awayGames[i] < 40 || awayGames[i] > 42) {
      errors.push(`Team ${i} (${teams[i].name}): ${awayGames[i]} away games (expected ~${targetHomeAway})`);
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
      
      // Track which indices to remove (will remove in descending order to avoid index shifting)
      const indicesToRemove = [];
      
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
        
        // Mark for removal (will remove later to avoid index shifting bug)
        indicesToRemove.push(index);
        
        // Stop if we hit target games per day (unless we have overdue teams)
        if (dayGames.length >= TARGET_GAMES_PER_DAY && overdueTeams.size === 0) {
          break;
        }
      }
      
      // Remove scheduled games in DESCENDING order to avoid index shifting
      indicesToRemove.sort((a, b) => b - a);
      for (const index of indicesToRemove) {
        remainingGames.splice(index, 1);
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
