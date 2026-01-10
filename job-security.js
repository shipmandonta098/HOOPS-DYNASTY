// ============================
// JOB SECURITY & FIRING SYSTEM
// ============================

// This system is OFF by default and only runs when enableJobSecurity === true

// ============================
// OWNER PROFILE GENERATION
// ============================

function generateOwnerProfile(teamId) {
  const profiles = [
    { patience: 'low', marketPressure: 'large', budgetTolerance: 'cheap', competitiveTimeline: 'contender' },
    { patience: 'low', marketPressure: 'medium', budgetTolerance: 'normal', competitiveTimeline: 'playoff' },
    { patience: 'medium', marketPressure: 'large', budgetTolerance: 'aggressive', competitiveTimeline: 'contender' },
    { patience: 'medium', marketPressure: 'medium', budgetTolerance: 'normal', competitiveTimeline: 'playoff' },
    { patience: 'medium', marketPressure: 'small', budgetTolerance: 'normal', competitiveTimeline: 'rebuild' },
    { patience: 'high', marketPressure: 'small', budgetTolerance: 'cheap', competitiveTimeline: 'rebuild' },
    { patience: 'high', marketPressure: 'medium', budgetTolerance: 'normal', competitiveTimeline: 'playoff' },
  ];
  
  // Use teamId to deterministically select profile
  const index = teamId % profiles.length;
  return { ...profiles[index] };
}

// ============================
// SEASON EXPECTATIONS
// ============================

function generateSeasonExpectations(team, league) {
  if (!league.settings.enableJobSecurity) return [];
  
  const ownerProfile = team.ownerProfile || generateOwnerProfile(team.id);
  const expectations = [];
  
  const teamRoster = league.players.filter(p => p.teamId === team.id && p.activeStatus !== 'injured');
  const avgOVR = teamRoster.reduce((sum, p) => sum + p.attributes.overall, 0) / teamRoster.length || 65;
  
  // Expectation: Minimum Wins
  if (ownerProfile.competitiveTimeline === 'contender') {
    expectations.push({ type: 'minWins', value: 50, description: 'Win at least 50 games' });
  } else if (ownerProfile.competitiveTimeline === 'playoff') {
    expectations.push({ type: 'minWins', value: 40, description: 'Win at least 40 games' });
  } else if (ownerProfile.competitiveTimeline === 'rebuild') {
    expectations.push({ type: 'minWins', value: 25, description: 'Win at least 25 games' });
  }
  
  // Expectation: Make Playoffs
  if (ownerProfile.competitiveTimeline === 'contender' || ownerProfile.competitiveTimeline === 'playoff') {
    expectations.push({ type: 'makePlayoffs', value: true, description: 'Make the playoffs' });
  }
  
  // Expectation: Player Development (for rebuild teams)
  if (ownerProfile.competitiveTimeline === 'rebuild') {
    expectations.push({ type: 'playerDevelopment', value: 5, description: 'Develop young players (+5 avg OVR)' });
  }
  
  // Expectation: Stay Under Cap (for cheap owners)
  if (ownerProfile.budgetTolerance === 'cheap') {
    expectations.push({ type: 'stayUnderCap', value: true, description: 'Stay under salary cap' });
  }
  
  // Expectation: Top-10 Offense/Defense (for contenders)
  if (ownerProfile.competitiveTimeline === 'contender' && avgOVR >= 75) {
    expectations.push({ type: 'top10Offense', value: 10, description: 'Finish top-10 in offensive rating' });
  }
  
  return expectations;
}

function evaluateExpectations(team, league) {
  if (!league.settings.enableJobSecurity) return { met: 0, missed: 0, results: [] };
  
  const expectations = team.seasonExpectations || [];
  const results = [];
  let met = 0;
  let missed = 0;
  
  const teamStats = team.stats || { wins: 0, losses: 0 };
  const wins = teamStats.wins || 0;
  
  // Check if team made playoffs
  const madePlayoffs = (league.playoffs && league.playoffs.teams && league.playoffs.teams.includes(team.id)) || false;
  
  // Calculate injury impact (reduces penalties)
  const injuryImpact = calculateInjuryImpact(team, league);
  
  for (const exp of expectations) {
    let success = false;
    
    if (exp.type === 'minWins') {
      success = wins >= exp.value;
    } else if (exp.type === 'makePlayoffs') {
      success = madePlayoffs;
    } else if (exp.type === 'playerDevelopment') {
      success = checkPlayerDevelopment(team, league, exp.value);
    } else if (exp.type === 'stayUnderCap') {
      success = !team.overCap;
    } else if (exp.type === 'top10Offense') {
      success = checkTop10Stat(team, league, 'offense', exp.value);
    }
    
    results.push({ ...exp, success });
    if (success) met++;
    else missed++;
  }
  
  return { met, missed, results, injuryImpact };
}

function checkPlayerDevelopment(team, league, targetIncrease) {
  const youngPlayers = league.players.filter(p => 
    p.teamId === team.id && 
    p.age <= 24 && 
    p.careerStats && 
    p.careerStats.lastSeason
  );
  
  if (youngPlayers.length === 0) return true; // No young players = pass
  
  const avgImprovement = youngPlayers.reduce((sum, p) => {
    const lastOVR = p.careerStats.lastSeason.overall || p.attributes.overall;
    return sum + (p.attributes.overall - lastOVR);
  }, 0) / youngPlayers.length;
  
  return avgImprovement >= targetIncrease;
}

function checkTop10Stat(team, league, statType, threshold) {
  const teams = league.teams || [];
  const teamRank = teams
    .map(t => ({ id: t.id, rating: t.stats?.[statType + 'Rating'] || 0 }))
    .sort((a, b) => b.rating - a.rating)
    .findIndex(t => t.id === team.id) + 1;
  
  return teamRank > 0 && teamRank <= threshold;
}

function calculateInjuryImpact(team, league) {
  const roster = league.players.filter(p => p.teamId === team.id);
  const injuredGames = roster.reduce((sum, p) => sum + (p.injuryHistory?.gamesLost || 0), 0);
  const totalPossibleGames = roster.length * 82;
  
  const injuryRate = totalPossibleGames > 0 ? injuredGames / totalPossibleGames : 0;
  
  // High injury rate (>15%) provides protection
  return injuryRate > 0.15 ? 'high' : injuryRate > 0.08 ? 'moderate' : 'low';
}

// ============================
// JOB SECURITY ADJUSTMENTS
// ============================

function adjustJobSecurity(team, league, evaluation) {
  if (!league.settings.enableJobSecurity) return;
  
  const { met, missed, injuryImpact } = evaluation;
  const ownerProfile = team.ownerProfile || generateOwnerProfile(team.id);
  const difficulty = league.settings.jobSecurityDifficulty || 'realistic';
  
  let adjustment = 0;
  
  // Positive adjustments for exceeding expectations
  if (met > missed) {
    adjustment += 10 + (met * 2);
    if (met >= missed * 2) adjustment += 5; // Far exceeded
  }
  
  // Negative adjustments for missing expectations
  if (missed > met) {
    adjustment -= 15 + (missed * 3);
    if (missed >= met * 2) adjustment -= 10; // Far below
  }
  
  // Cap disaster penalty
  if (team.overCap && ownerProfile.budgetTolerance === 'cheap') {
    adjustment -= 10;
  }
  
  // Repeated losing seasons penalty
  const recentSeasons = team.seasonHistory?.slice(-3) || [];
  const losingSeasons = recentSeasons.filter(s => (s.wins || 0) < 30).length;
  if (losingSeasons >= 2) {
    adjustment -= 8;
  }
  
  // Injury protection
  if (injuryImpact === 'high') {
    adjustment = Math.max(-10, adjustment); // Cap negative impact
  } else if (injuryImpact === 'moderate') {
    adjustment += 3; // Small bonus for overcoming injuries
  }
  
  // Difficulty modifiers
  if (difficulty === 'forgiving') {
    adjustment = adjustment < 0 ? adjustment * 0.7 : adjustment * 1.2;
  } else if (difficulty === 'ruthless') {
    adjustment = adjustment < 0 ? adjustment * 1.3 : adjustment * 0.9;
  }
  
  // Apply adjustment
  league.jobSecurity = Math.max(0, Math.min(100, (league.jobSecurity || 75) + adjustment));
  
  return adjustment;
}

// ============================
// FIRING LOGIC
// ============================

function checkFiringConditions(league) {
  if (!league.settings.enableJobSecurity) return false;
  
  const userTeam = league.teams.find(t => t.isUserTeam);
  if (!userTeam) return false;
  
  // Never fire in Year 1
  const careerYears = (league.careerHistory || []).reduce((sum, h) => sum + h.years, 0);
  if (careerYears === 0 && league.season <= 1) return false;
  
  // Never fire during rebuild if expectations met
  const ownerProfile = userTeam.ownerProfile || generateOwnerProfile(userTeam.id);
  if (ownerProfile.competitiveTimeline === 'rebuild') {
    const evaluation = evaluateExpectations(userTeam, league);
    if (evaluation.met >= evaluation.missed) return false;
  }
  
  // Check threshold based on difficulty
  const difficulty = league.settings.jobSecurityDifficulty || 'realistic';
  const thresholds = {
    forgiving: 25,
    realistic: 35,
    ruthless: 45
  };
  
  const threshold = thresholds[difficulty];
  return (league.jobSecurity || 75) < threshold;
}

function calculateAppealChance(league) {
  const userTeam = league.teams.find(t => t.isUserTeam);
  if (!userTeam) return 0;
  
  const ownerProfile = userTeam.ownerProfile || generateOwnerProfile(userTeam.id);
  const jobSecurity = league.jobSecurity || 75;
  
  let baseChance = 30;
  
  // Owner patience affects appeal success
  if (ownerProfile.patience === 'high') baseChance += 25;
  else if (ownerProfile.patience === 'medium') baseChance += 10;
  
  // How close to threshold
  if (jobSecurity >= 30) baseChance += 15;
  else if (jobSecurity >= 20) baseChance += 5;
  
  // Career history (championships help)
  const championships = (league.careerHistory || []).filter(h => h.exitType === 'champion').length;
  baseChance += championships * 10;
  
  return Math.min(80, Math.max(5, baseChance));
}

function processAppeal(league) {
  const appealChance = calculateAppealChance(league);
  const roll = Math.random() * 100;
  
  if (roll < appealChance) {
    // Appeal successful - restore some job security
    league.jobSecurity = Math.min(100, (league.jobSecurity || 0) + 20);
    return { success: true, message: 'The owner has agreed to give you another chance.' };
  } else {
    return { success: false, message: 'Your appeal was denied. You have been relieved of your duties.' };
  }
}

// ============================
// CAREER HISTORY TRACKING
// ============================

function addCareerEntry(league, exitType) {
  if (!league.careerHistory) league.careerHistory = [];
  
  const userTeam = league.teams.find(t => t.isUserTeam);
  if (!userTeam) return;
  
  const yearsWithTeam = (league.careerHistory.filter(h => h.teamId === userTeam.id).length || 0) + 1;
  const wins = userTeam.stats?.wins || 0;
  const losses = userTeam.stats?.losses || 0;
  
  league.careerHistory.push({
    teamId: userTeam.id,
    teamName: userTeam.name,
    years: yearsWithTeam,
    record: { wins, losses },
    season: league.season,
    exitType: exitType // 'fired' | 'resigned' | 'champion' | 'active'
  });
}

function getCareerStats(league) {
  const history = league.careerHistory || [];
  
  return {
    totalYears: history.reduce((sum, h) => sum + h.years, 0),
    totalWins: history.reduce((sum, h) => sum + (h.record.wins || 0), 0),
    totalLosses: history.reduce((sum, h) => sum + (h.record.losses || 0), 0),
    championships: history.filter(h => h.exitType === 'champion').length,
    timesRed: history.filter(h => h.exitType === 'fired').length,
    teams: [...new Set(history.map(h => h.teamName))].length
  };
}

function getAvailableJobs(league) {
  const stats = getCareerStats(league);
  const reputation = calculateReputation(stats);
  
  // Filter teams based on reputation
  const availableTeams = league.teams.filter(t => {
    if (t.isUserTeam) return false; // Can't take current team
    
    const teamRoster = league.players.filter(p => p.teamId === t.id);
    const avgOVR = teamRoster.reduce((sum, p) => sum + p.attributes.overall, 0) / teamRoster.length || 65;
    
    if (reputation === 'elite') return true; // Can take any job
    if (reputation === 'good' && avgOVR < 80) return true;
    if (reputation === 'average' && avgOVR < 70) return true;
    if (reputation === 'poor' && avgOVR < 60) return true;
    
    return false;
  });
  
  return availableTeams;
}

function calculateReputation(stats) {
  const winPct = stats.totalWins / (stats.totalWins + stats.totalLosses) || 0;
  
  if (stats.championships >= 2 || winPct >= 0.65) return 'elite';
  if (stats.championships >= 1 || winPct >= 0.55) return 'good';
  if (winPct >= 0.45) return 'average';
  return 'poor';
}

// ============================
// UI RENDERING FUNCTIONS
// ============================

function getJobSecurityStatus(jobSecurity) {
  if (jobSecurity >= 70) return { text: 'Safe', color: '#4ade80', class: 'safe' };
  if (jobSecurity >= 40) return { text: 'Warm Seat', color: '#fbbf24', class: 'warm' };
  return { text: 'Hot Seat', color: '#ef4444', class: 'hot' };
}

function renderJobSecurityMeter() {
  if (!league || !league.settings.enableJobSecurity) return '';
  
  const jobSecurity = league.jobSecurity || 75;
  const status = getJobSecurityStatus(jobSecurity);
  
  return `
    <div class="job-security-meter">
      <div class="job-security-label">
        <span>Job Security</span>
        <span class="job-security-status ${status.class}">${status.text}</span>
      </div>
      <div class="job-security-bar">
        <div class="job-security-fill ${status.class}" style="width: ${jobSecurity}%"></div>
      </div>
      <div class="job-security-value">${jobSecurity}/100</div>
    </div>
  `;
}

function renderFiringModal(league) {
  const appealChance = calculateAppealChance(league);
  const userTeam = league.teams.find(t => t.isUserTeam);
  const ownerProfile = userTeam?.ownerProfile || generateOwnerProfile(userTeam?.id || 0);
  
  return `
    <div class="modal-overlay" id="firing-modal">
      <div class="modal-content job-security-modal">
        <h2>⚠️ Owner's Office</h2>
        <div class="owner-message">
          <p><strong>From: ${userTeam?.city || 'Team'} Ownership</strong></p>
          <p>After careful consideration, we have decided to make a change in the coaching position. 
          Your performance has not met our expectations, and we believe it's time to move in a different direction.</p>
          
          <div class="firing-details">
            <p><strong>Current Job Security:</strong> ${league.jobSecurity || 0}/100</p>
            <p><strong>Season Record:</strong> ${userTeam?.stats?.wins || 0}-${userTeam?.stats?.losses || 0}</p>
            <p><strong>Owner Patience:</strong> ${ownerProfile.patience}</p>
          </div>
        </div>
        
        <div class="modal-actions">
          <button class="modal-btn danger" onclick="acceptFiring()">Accept Dismissal</button>
          <button class="modal-btn warning" onclick="attemptAppeal()">
            Appeal Decision (${appealChance}% chance)
          </button>
          <button class="modal-btn secondary" onclick="resignPosition()">Resign</button>
        </div>
      </div>
    </div>
  `;
}

function renderCareerHistoryTab() {
  if (!league) return '<div class="no-data">No league loaded</div>';
  
  const stats = getCareerStats(league);
  const history = league.careerHistory || [];
  const winPct = ((stats.totalWins / (stats.totalWins + stats.totalLosses)) * 100).toFixed(1) || 0;
  
  return `
    <div class="career-history-container">
      <h2>Career History</h2>
      
      <div class="career-stats-summary">
        <div class="career-stat">
          <span class="stat-label">Total Years</span>
          <span class="stat-value">${stats.totalYears}</span>
        </div>
        <div class="career-stat">
          <span class="stat-label">Record</span>
          <span class="stat-value">${stats.totalWins}-${stats.totalLosses}</span>
        </div>
        <div class="career-stat">
          <span class="stat-label">Win %</span>
          <span class="stat-value">${winPct}%</span>
        </div>
        <div class="career-stat">
          <span class="stat-label">Championships</span>
          <span class="stat-value">${stats.championships}</span>
        </div>
        <div class="career-stat">
          <span class="stat-label">Teams</span>
          <span class="stat-value">${stats.teams}</span>
        </div>
      </div>
      
      <div class="career-history-table">
        <table>
          <thead>
            <tr>
              <th>Season</th>
              <th>Team</th>
              <th>Years</th>
              <th>Record</th>
              <th>Exit</th>
            </tr>
          </thead>
          <tbody>
            ${history.map(h => `
              <tr>
                <td>${h.season}</td>
                <td>${h.teamName}</td>
                <td>${h.years}</td>
                <td>${h.record.wins}-${h.record.losses}</td>
                <td class="exit-${h.exitType}">${formatExitType(h.exitType)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function formatExitType(exitType) {
  const types = {
    fired: '🔴 Fired',
    resigned: '⚪ Resigned',
    champion: '🏆 Champion',
    active: '✅ Active'
  };
  return types[exitType] || exitType;
}

// ============================
// EVENT HANDLERS
// ============================

function acceptFiring() {
  if (!league) return;
  
  addCareerEntry(league, 'fired');
  document.getElementById('firing-modal')?.remove();
  showPostFiringOptions();
}

function attemptAppeal() {
  if (!league) return;
  
  const result = processAppeal(league);
  
  if (result.success) {
    alert(result.message);
    document.getElementById('firing-modal')?.remove();
    saveLeague();
    render();
  } else {
    alert(result.message);
    acceptFiring();
  }
}

function resignPosition() {
  if (!league) return;
  
  addCareerEntry(league, 'resigned');
  document.getElementById('firing-modal')?.remove();
  showPostFiringOptions();
}

function showPostFiringOptions() {
  const availableJobs = getAvailableJobs(league);
  
  const html = `
    <div class="modal-overlay" id="post-firing-modal">
      <div class="modal-content job-search-modal">
        <h2>What's Next?</h2>
        
        <div class="modal-section">
          <h3>Take Another Job</h3>
          <p>Available positions based on your reputation:</p>
          <div class="available-jobs">
            ${availableJobs.map(t => `
              <button class="job-option" onclick="takeJob(${t.id})">
                ${t.city} ${t.name}
              </button>
            `).join('') || '<p class="no-jobs">No teams are currently interested.</p>'}
          </div>
        </div>
        
        <div class="modal-section">
          <button class="modal-btn secondary" onclick="sitOutSeason()">Sit Out a Season</button>
        </div>
        
        <div class="modal-section">
          <button class="modal-btn secondary" onclick="switchToCommissioner()">Commissioner Mode</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', html);
}

function takeJob(teamId) {
  if (!league) return;
  
  // Remove user flag from current team
  league.teams.forEach(t => t.isUserTeam = false);
  
  // Set new team as user team
  const newTeam = league.teams.find(t => t.id === teamId);
  if (newTeam) {
    newTeam.isUserTeam = true;
    league.jobSecurity = 75; // Reset job security
    
    // Generate new expectations
    newTeam.seasonExpectations = generateSeasonExpectations(newTeam, league);
  }
  
  document.getElementById('post-firing-modal')?.remove();
  saveLeague();
  render();
  
  alert(`Welcome to the ${newTeam.city} ${newTeam.name}!`);
}

function sitOutSeason() {
  if (!league) return;
  
  // Remove user team flag
  league.teams.forEach(t => t.isUserTeam = false);
  
  document.getElementById('post-firing-modal')?.remove();
  saveLeague();
  render();
  
  alert('You are now observing the league. You can take a job next season.');
}

function switchToCommissioner() {
  if (!league) return;
  
  league.commissionerMode = true;
  league.teams.forEach(t => t.isUserTeam = false);
  
  document.getElementById('post-firing-modal')?.remove();
  saveLeague();
  render();
  
  alert('Switched to Commissioner Mode. All teams are now AI-controlled.');
}

// ============================
// INITIALIZATION
// ============================

function initializeJobSecurity(league) {
  if (!league.settings.enableJobSecurity) return;
  
  // Initialize job security value if not present
  if (typeof league.jobSecurity !== 'number') {
    league.jobSecurity = 75;
  }
  
  // Initialize career history if not present
  if (!league.careerHistory) {
    league.careerHistory = [];
  }
  
  // Generate owner profiles for all teams if not present
  league.teams.forEach(team => {
    if (!team.ownerProfile) {
      team.ownerProfile = generateOwnerProfile(team.id);
    }
    
    // Generate season expectations for user team
    if (team.isUserTeam && !team.seasonExpectations) {
      team.seasonExpectations = generateSeasonExpectations(team, league);
    }
  });
}

// ============================
// SEASON END HOOK
// ============================

function processSeasonEndJobSecurity(league) {
  if (!league.settings.enableJobSecurity) return;
  
  const userTeam = league.teams.find(t => t.isUserTeam);
  if (!userTeam) return;
  
  // Evaluate expectations
  const evaluation = evaluateExpectations(userTeam, league);
  
  // Adjust job security
  const adjustment = adjustJobSecurity(userTeam, league, evaluation);
  
  // Check for firing
  const shouldFire = checkFiringConditions(league);
  
  if (shouldFire) {
    // Show firing modal
    document.body.insertAdjacentHTML('beforeend', renderFiringModal(league));
  } else {
    // Show season review
    showSeasonReview(evaluation, adjustment);
  }
}

function showSeasonReview(evaluation, adjustment) {
  const sign = adjustment >= 0 ? '+' : '';
  const color = adjustment >= 0 ? 'green' : 'red';
  
  const html = `
    <div class="modal-overlay" id="season-review-modal">
      <div class="modal-content season-review-modal">
        <h2>Season Performance Review</h2>
        
        <div class="expectations-review">
          <h3>Expectations Met: ${evaluation.met} / ${evaluation.met + evaluation.missed}</h3>
          ${evaluation.results.map(r => `
            <div class="expectation-result ${r.success ? 'met' : 'missed'}">
              <span>${r.success ? '✓' : '✗'}</span>
              <span>${r.description}</span>
            </div>
          `).join('')}
        </div>
        
        <div class="job-security-change">
          <p>Job Security: <span style="color: ${color}; font-weight: bold;">${sign}${adjustment}</span></p>
          <p>New Job Security: ${league.jobSecurity}/100</p>
        </div>
        
        <button class="modal-btn primary" onclick="closeSeasonReview()">Continue</button>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', html);
}

function closeSeasonReview() {
  document.getElementById('season-review-modal')?.remove();
}
