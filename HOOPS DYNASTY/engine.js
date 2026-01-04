/* ============================
   GAME ENGINE - PLAYER GENERATION & TEAM STATS
============================ */

// Schema Version for League Migrations
const CURRENT_SCHEMA_VERSION = 1;

// Coach Generation
function makeCoach(experience = null) {
  const age = experience !== null ? 35 + experience : rand(35, 65);
  const years = experience !== null ? experience : rand(0, 30);
  
  // Generate ratings (30-90 range)
  const offense = rand(40, 85);
  const defense = rand(40, 85);
  const playerDevelopment = rand(40, 85);
  const management = rand(40, 85);
  const motivation = rand(40, 85);
  const clutch = rand(40, 85);
  const adaptability = rand(40, 85);
  
  // Overall is weighted average
  const overall = Math.round(
    (offense * 1.2 + defense * 1.2 + playerDevelopment * 1.1 + 
     management * 0.9 + motivation * 1.0 + clutch * 0.8 + adaptability * 0.9) / 7.1
  );
  
  // Personality traits (1-10 scale)
  const personality = {
    patience: rand(3, 10),
    intensity: rand(3, 10),
    loyalty: rand(3, 10),
    innovation: rand(3, 10),
    communication: rand(3, 10),
    discipline: rand(3, 10),
    confidence: rand(3, 10)
  };
  
  // Contract
  const salary = calculateCoachSalary(overall);
  const yearsRemaining = rand(2, 5);
  
  return {
    id: `coach_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: randName(),
    age,
    experience: years,
    overall,
    ratings: {
      offense,
      defense,
      playerDevelopment,
      management,
      motivation,
      clutch,
      adaptability
    },
    personality,
    contract: {
      yearsRemaining,
      annualSalary: salary
    },
    careerStats: {
      wins: Math.floor(years * rand(20, 50)),
      losses: Math.floor(years * rand(15, 45)),
      championships: years > 10 ? rand(0, Math.floor(years / 8)) : 0
    }
  };
}

function calculateCoachSalary(overall) {
  if (overall >= 80) return rand(6, 10);
  if (overall >= 70) return rand(4, 6);
  if (overall >= 60) return rand(2.5, 4);
  return rand(1.5, 2.5);
}

// Player Generation
function makePlayer(age, isRookie = false) {
  const id = nextPlayerId++;
  const pos = POS[rand(0, POS.length - 1)];
  
  // Base ratings
  let shoot = rand(30, 85);
  let defense = rand(30, 85);
  let rebound = rand(30, 85);
  let passing = rand(30, 85);
  
  if (isRookie) {
    // Rookies have more variance and generally lower ratings
    shoot = clamp(rand(40, 75) + rand(-15, 15), 35, 90);
    defense = clamp(rand(40, 75) + rand(-15, 15), 35, 90);
    rebound = clamp(rand(40, 75) + rand(-15, 15), 35, 90);
    passing = clamp(rand(40, 75) + rand(-15, 15), 35, 90);
  }
  
  const ovr = Math.round((shoot + defense + rebound + passing) / 4);
  const pot = isRookie ? clamp(ovr + rand(0, 25), ovr, 95) : clamp(ovr + rand(-5, 10), ovr - 5, 95);
  
  // Contract based on OVR
  const salary = calculateSalary(ovr);
  const yearsRemaining = rand(1, 4);
  
  // Generate detailed attributes
  const athleticBase = rand(50, 95);
  const detailedAttributes = {
    athletic: {
      speed: clamp(athleticBase + rand(-10, 10), 40, 99),
      acceleration: clamp(athleticBase + rand(-10, 10), 40, 99),
      strength: clamp(rand(50, 90), 40, 99),
      vertical: clamp(athleticBase + rand(-15, 15), 40, 99),
      lateralQuickness: clamp(athleticBase + rand(-10, 10), 40, 99),
      stamina: clamp(rand(60, 95), 40, 99),
      hustle: clamp(rand(50, 90), 40, 99)
    },
    offensive: {
      scoringSkills: {
        finishing: clamp(shoot + rand(-15, 15), 40, 99),
        midRangeShooting: clamp(shoot + rand(-10, 10), 40, 99),
        threePointShooting: clamp(shoot + rand(-20, 20), 40, 99),
        freeThrowShooting: clamp(shoot + rand(-10, 15), 40, 99),
        postScoring: clamp(shoot + rand(-20, 10), 40, 99),
        shotCreation: clamp(shoot + rand(-15, 15), 40, 99)
      },
      playmakingSkills: {
        ballHandling: clamp(passing + rand(-15, 15), 40, 99),
        passingVision: clamp(passing + rand(-10, 10), 40, 99),
        passingAccuracy: clamp(passing + rand(-10, 15), 40, 99),
        offBallMovement: clamp(passing + rand(-10, 10), 40, 99)
      }
    },
    defensive: {
      perimeterDefense: clamp(defense + rand(-10, 10), 40, 99),
      interiorDefense: clamp(defense + rand(-15, 15), 40, 99),
      blockRating: clamp(defense + rand(-15, 15), 40, 99),
      stealRating: clamp(defense + rand(-10, 15), 40, 99),
      defensiveRebounding: clamp(rebound + rand(-10, 10), 40, 99),
      offensiveRebounding: clamp(rebound + rand(-15, 10), 40, 99),
      defensiveAwareness: clamp(defense + rand(-10, 10), 40, 99)
    },
    mental: {
      basketballIQ: clamp(rand(60, 95), 40, 99),
      consistency: clamp(rand(50, 90), 40, 99),
      workEthic: clamp(rand(50, 95), 40, 99),
      leadership: clamp(rand(50, 90), 40, 99),
      composure: clamp(rand(55, 95), 40, 99),
      discipline: clamp(rand(50, 90), 40, 99),
      clutch: clamp(rand(50, 95), 40, 99)
    }
  };
  
  // Generate bio data
  const heights = ['5\'10"', '5\'11"', '6\'0"', '6\'1"', '6\'2"', '6\'3"', '6\'4"', '6\'5"', '6\'6"', '6\'7"', '6\'8"', '6\'9"', '6\'10"', '6\'11"', '7\'0"'];
  const cities = ['Los Angeles, CA', 'New York, NY', 'Chicago, IL', 'Houston, TX', 'Phoenix, AZ', 'Philadelphia, PA', 'San Antonio, TX', 'Dallas, TX', 'Atlanta, GA', 'Miami, FL'];
  const colleges = ['Duke', 'Kentucky', 'North Carolina', 'UCLA', 'Kansas', 'Michigan', 'Villanova', 'Gonzaga', 'Syracuse', 'Louisville', 'None'];
  
  const heightIdx = clamp(rand(0, heights.length - 1), 0, heights.length - 1);
  
  // 80% chance drafted, 20% undrafted
  const isDrafted = Math.random() > 0.2;
  let draftedByTid = null;
  
  if (isDrafted && league && league.teams && league.teams.length > 0) {
    const randomTeam = league.teams[rand(0, league.teams.length - 1)];
    draftedByTid = randomTeam.id;
  }
  
  const bio = {
    height: heights[heightIdx],
    weight: `${rand(175, 250)} lbs`,
    wingspan: heights[Math.min(heightIdx + rand(0, 2), heights.length - 1)],
    hometown: cities[rand(0, cities.length - 1)],
    country: 'USA',
    college: colleges[rand(0, colleges.length - 1)]
  };
  
  // Draft data in separate structure
  const draft = isDrafted ? {
    year: league ? league.season - (age - 19) : 2026 - (age - 19),
    round: rand(1, 2),
    pick: rand(1, 30),
    draftedByTid: draftedByTid
  } : {
    year: null,
    round: null,
    pick: null,
    draftedByTid: null
  };
  
  // Generate personality
  const personality = {
    currentSatisfactionPct: rand(50, 90),
    satisfactionLabel: '',
    loyalty: rand(30, 90),
    moneyFocus: rand(30, 90),
    winningDrive: rand(40, 95),
    playingTimeDesire: rand(30, 90),
    teamPlayer: rand(30, 90),
    workEthic: detailedAttributes.mental.workEthic,
    ego: rand(30, 90),
    temperament: rand(35, 90)
  };
  
  // Set satisfaction label
  if (personality.currentSatisfactionPct >= 85) personality.satisfactionLabel = 'Very Happy';
  else if (personality.currentSatisfactionPct >= 70) personality.satisfactionLabel = 'Content';
  else if (personality.currentSatisfactionPct >= 55) personality.satisfactionLabel = 'Neutral';
  else if (personality.currentSatisfactionPct >= 40) personality.satisfactionLabel = 'Unhappy';
  else personality.satisfactionLabel = 'Very Unhappy';
  
  return {
    id,
    name: randName(),
    age,
    pos,
    ratings: {
      ovr,
      pot,
      shoot,
      defense,
      rebound,
      passing
    },
    contract: {
      amount: salary,
      exp: league ? league.season + yearsRemaining : 2026 + yearsRemaining,
      yearsRemaining: yearsRemaining,
      totalValue: salary * yearsRemaining,
      startYear: league ? league.season : 2026
    },
    seasonStats: {
      gp: 0,
      pts: 0,
      reb: 0,
      ast: 0,
      fgm: 0,
      fga: 0,
      fg3m: 0,
      fg3a: 0,
      stl: 0,
      blk: 0
    },
    bio: bio,
    draft: draft,
    attributes: detailedAttributes,
    personality: personality
  };
}

function calculateSalary(ovr) {
  if (ovr >= 85) return rand(25, 40);
  if (ovr >= 75) return rand(15, 25);
  if (ovr >= 65) return rand(8, 15);
  if (ovr >= 55) return rand(3, 8);
  return rand(1, 3);
}

function makeTeam(id, name, metadata = {}) {
  const players = [];
  for (let i = 0; i < 12; i++) {
    const age = rand(19, 34);
    players.push(makePlayer(age));
  }
  
  const team = {
    id,
    name,
    city: metadata.city || '',
    conference: metadata.conference || '—',
    division: metadata.division || '—',
    market: metadata.market || '—',
    primaryColor: metadata.primaryColor || '#3b82f6',
    secondaryColor: metadata.secondaryColor || '#1e293b',
    logoPrimaryUrl: metadata.logoPrimaryUrl || '',
    logoSecondaryUrl: metadata.logoSecondaryUrl || '',
    wins: 0,
    losses: 0,
    players,
    coach: makeCoach(rand(0, 15)), // Each team gets a coach
    morale: 75, // Team morale (0-100)
    payroll: 0,
    // Advanced standings stats
    stats: {
      confWins: 0,
      confLosses: 0,
      homeWins: 0,
      homeLosses: 0,
      awayWins: 0,
      awayLosses: 0,
      last10: [], // Array of 'W' or 'L'
      streak: 0 // Positive for wins, negative for losses
    }
  };
  
  // Generate default rotations
  team.rotations = generateDefaultRotations(team);
  
  return team;
}

function generateDraftClass() {
  const draftClass = [];
  for (let i = 0; i < 20; i++) {
    const age = rand(19, 22);
    draftClass.push(makePlayer(age, true));
  }
  return draftClass.sort((a, b) => b.ratings.pot - a.ratings.pot);
}

// Team Stats & Metrics
function getTeamOverall(team) {
  const topPlayers = team.players
    .sort((a, b) => b.ratings.ovr - a.ratings.ovr)
    .slice(0, 8);
  
  if (topPlayers.length === 0) return 50;
  
  const totalOvr = topPlayers.reduce((sum, p) => sum + p.ratings.ovr, 0);
  return Math.round(totalOvr / topPlayers.length);
}

function getTeamOffense(team) {
  const topPlayers = team.players
    .sort((a, b) => b.ratings.ovr - a.ratings.ovr)
    .slice(0, 8);
  
  if (topPlayers.length === 0) return 50;
  
  const totalShoot = topPlayers.reduce((sum, p) => sum + p.ratings.shoot, 0);
  return Math.round(totalShoot / topPlayers.length);
}

function getTeamDefense(team) {
  const topPlayers = team.players
    .sort((a, b) => b.ratings.ovr - a.ratings.ovr)
    .slice(0, 8);
  
  if (topPlayers.length === 0) return 50;
  
  const totalDef = topPlayers.reduce((sum, p) => sum + p.ratings.defense, 0);
  return Math.round(totalDef / topPlayers.length);
}

function getPowerRank(teamId) {
  const rankedTeams = league.teams
    .map(t => ({ id: t.id, overall: getTeamOverall(t) }))
    .sort((a, b) => b.overall - a.overall);
  
  const rank = rankedTeams.findIndex(t => t.id === teamId) + 1;
  return rank;
}

function getTeamEfficiencyStats(team) {
  const offense = getTeamOffense(team);
  const defense = getTeamDefense(team);
  
  // Proxy metrics based on ratings (stable per team)
  const efg = Math.round(45 + (offense - 70) * 0.2); // ~45-55%
  const tov = Math.round(18 - (offense - 70) * 0.1); // ~13-23%
  const orb = Math.round(25 + (defense - 70) * 0.15); // ~20-30%
  const ftRate = Math.round(20 + (offense - 70) * 0.12); // ~15-25%
  
  return {
    efg: Math.max(40, Math.min(60, efg)),
    tov: Math.max(10, Math.min(25, tov)),
    orb: Math.max(15, Math.min(35, orb)),
    ftRate: Math.max(10, Math.min(30, ftRate))
  };
}

function updateTeamPayrolls() {
  league.teams.forEach(team => {
    team.payroll = team.players.reduce((sum, p) => sum + p.contract.amount, 0);
  });
}

// Coach impact on game simulation
function getCoachGameModifier(coach, morale) {
  if (!coach) return { offense: 1.0, defense: 1.0, morale: 1.0 };
  
  // Offense/Defense modifiers: 0.97 to 1.03 (3% max swing)
  const offenseMod = 1.0 + (coach.ratings.offense - 60) * 0.0005;
  const defenseMod = 1.0 + (coach.ratings.defense - 60) * 0.0005;
  
  // Morale affects performance (motivation + confidence)
  const moraleBase = (morale - 75) / 100; // -0.75 to +0.25
  const motivationFactor = (coach.ratings.motivation - 60) * 0.001;
  const moraleMod = 1.0 + (moraleBase * motivationFactor);
  
  return {
    offense: clamp(offenseMod, 0.97, 1.03),
    defense: clamp(defenseMod, 0.97, 1.03),
    morale: clamp(moraleMod, 0.98, 1.02)
  };
}

/* ============================
   GAME SIMULATION
============================ */

function simGame(teamA, teamB) {
  const possessions = 95;
  let scoreA = 0;
  let scoreB = 0;
  
  // Get rotation players using minute targets if available
  const rotationA = getGameRotation(teamA);
  const rotationB = getGameRotation(teamB);
  
  // Initialize minutes tracker
  const minutes = new Map();
  rotationA.forEach(p => minutes.set(p.id, 0));
  rotationB.forEach(p => minutes.set(p.id, 0));
  
  // Team defensive ratings with coach modifier
  const defA = rotationA.reduce((sum, p) => sum + p.ratings.defense, 0) / rotationA.length;
  const defB = rotationB.reduce((sum, p) => sum + p.ratings.defense, 0) / rotationB.length;
  
  // Coach bonuses (subtle 0-3% modifiers)
  const coachModA = getCoachGameModifier(teamA.coach, teamA.morale);
  const coachModB = getCoachGameModifier(teamB.coach, teamB.morale);
  
  for (let poss = 0; poss < possessions; poss++) {
    // Team A possession
    const shooterA = pickShooter(rotationA, poss, possessions);
    const resultA = simulatePossession(shooterA, defB, poss, possessions, minutes, coachModA);
    scoreA += resultA.points;
    updatePlayerStats(shooterA, resultA);
    
    // Team B possession
    const shooterB = pickShooter(rotationB, poss, possessions);
    const resultB = simulatePossession(shooterB, defA, poss, possessions, minutes, coachModB);
    scoreB += resultB.points;
    updatePlayerStats(shooterB, resultB);
  }
  
  // Close game bonus from coach clutch rating
  const scoreDiff = Math.abs(scoreA - scoreB);
  if (scoreDiff <= 5) {
    const clutchBonusA = (teamA.coach.ratings.clutch - 60) * 0.02; // -0.6 to +0.5 points
    const clutchBonusB = (teamB.coach.ratings.clutch - 60) * 0.02;
    scoreA += clutchBonusA;
    scoreB += clutchBonusB;
  }
  
  // Determine winner and update records
  const teamAWon = scoreA > scoreB;
  const isHomeGame = Math.random() > 0.5; // Randomly assign home/away
  const sameConference = teamA.conference !== '—' && teamA.conference === teamB.conference;
  
  // Update team records
  if (teamAWon) {
    teamA.wins++;
    teamB.losses++;
    teamA.coach.careerStats.wins++;
    teamB.coach.careerStats.losses++;
    
    // Track advanced stats for team A (winner)
    updateTeamStats(teamA, true, isHomeGame, sameConference);
    updateTeamStats(teamB, false, !isHomeGame, sameConference);
  } else {
    teamB.wins++;
    teamA.losses++;
    teamB.coach.careerStats.wins++;
    teamA.coach.careerStats.losses++;
    
    // Track advanced stats for team B (winner)
    updateTeamStats(teamA, false, isHomeGame, sameConference);
    updateTeamStats(teamB, true, !isHomeGame, sameConference);
  }
  
  // Mark game played
  rotationA.forEach(p => p.seasonStats.gp++);
  rotationB.forEach(p => p.seasonStats.gp++);
}

function updateTeamStats(team, won, isHome, sameConference) {
  // Initialize stats object if it doesn't exist (for old saves)
  if (!team.stats) {
    team.stats = {
      confWins: 0,
      confLosses: 0,
      homeWins: 0,
      homeLosses: 0,
      awayWins: 0,
      awayLosses: 0,
      last10: [],
      streak: 0
    };
  }
  
  // Update conference record
  if (sameConference) {
    if (won) team.stats.confWins++;
    else team.stats.confLosses++;
  }
  
  // Update home/away record
  if (isHome) {
    if (won) team.stats.homeWins++;
    else team.stats.homeLosses++;
  } else {
    if (won) team.stats.awayWins++;
    else team.stats.awayLosses++;
  }
  
  // Update last 10
  team.stats.last10.push(won ? 'W' : 'L');
  if (team.stats.last10.length > 10) {
    team.stats.last10.shift();
  }
  
  // Update streak
  if (won) {
    if (team.stats.streak >= 0) {
      team.stats.streak++;
    } else {
      team.stats.streak = 1;
    }
  } else {
    if (team.stats.streak <= 0) {
      team.stats.streak--;
    } else {
      team.stats.streak = -1;
    }
  }
}

function pickShooter(rotation, currentPoss, totalPoss) {
  // Weight by OVR
  const weights = rotation.map(p => p.ratings.ovr);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * totalWeight;
  
  for (let i = 0; i < rotation.length; i++) {
    r -= weights[i];
    if (r <= 0) return rotation[i];
  }
  return rotation[0];
}

function simulatePossession(shooter, oppDef, currentPoss, totalPoss, minutesMap, coachMod = null) {
  const fatigueMultiplier = calculateFatigue(shooter, currentPoss, totalPoss, minutesMap);
  let adjustedShoot = shooter.ratings.shoot * fatigueMultiplier;
  
  // Apply coach offensive modifier
  if (coachMod) {
    adjustedShoot *= coachMod.offense * coachMod.morale;
  }
  
  // Determine shot type
  const is3PT = Math.random() < 0.35; // 35% of shots are 3s
  const shotDifficulty = is3PT ? 0.35 : 0.50;
  
  // Make chance based on shooter skill vs defense (with coach defense mod)
  let effectiveOppDef = oppDef;
  if (coachMod) {
    effectiveOppDef *= coachMod.defense;
  }
  
  const makeChance = clamp((adjustedShoot - effectiveOppDef * 0.3) / 100 * shotDifficulty, 0.1, 0.7);
  const made = Math.random() < makeChance;
  
  // Track minutes
  minutesMap.set(shooter.id, (minutesMap.get(shooter.id) || 0) + 1);
  
  // Simple rebound/assist simulation
  const reb = Math.random() < 0.15 ? 1 : 0;
  const ast = Math.random() < 0.12 ? 1 : 0;
  
  return {
    points: made ? (is3PT ? 3 : 2) : 0,
    fgm: made ? 1 : 0,
    fga: 1,
    fg3m: (made && is3PT) ? 1 : 0,
    fg3a: is3PT ? 1 : 0,
    reb,
    ast
  };
}

function calculateFatigue(player, currentPoss, totalPoss, minutesMap) {
  const minutesPlayed = minutesMap.get(player.id) || 0;
  const gameProgress = currentPoss / totalPoss;
  
  // If playing heavy minutes in late game, slight fatigue penalty
  if (gameProgress > 0.75 && minutesPlayed > 40) {
    return 0.95; // 5% penalty
  }
  return 1.0;
}

function updatePlayerStats(player, result) {
  player.seasonStats.pts += result.points;
  player.seasonStats.fgm += result.fgm;
  player.seasonStats.fga += result.fga;
  player.seasonStats.fg3m += result.fg3m;
  player.seasonStats.fg3a += result.fg3a;
  player.seasonStats.reb += result.reb;
  player.seasonStats.ast += result.ast;
}

/* ============================
   SEASON SIMULATION
============================ */

function simRegularSeason() {
  if (!league) return;
  
  // Reset season stats
  league.teams.forEach(team => {
    team.wins = 0;
    team.losses = 0;
    team.players.forEach(p => {
      p.seasonStats = { gp: 0, pts: 0, reb: 0, ast: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0 };
    });
  });
  
  // Each team plays each other 4 times (home/away)
  const teams = league.teams;
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      for (let k = 0; k < 4; k++) {
        simGame(teams[i], teams[j]);
      }
    }
  }
  
  league.phase = 'offseason';
  
  // Save season to history
  saveSeasonToHistory();
  
  render();
  alert('Regular season complete! Proceed to Offseason.');
  save();
}

function saveSeasonToHistory() {
  const standings = [...league.teams].sort((a, b) => b.wins - a.wins);
  const champion = standings[0];
  
  // Find stat leaders
  const allPlayers = league.teams.flatMap(t => t.players);
  const scoringLeader = [...allPlayers].sort((a, b) => {
    const ppgA = a.seasonStats.gp > 0 ? a.seasonStats.pts / a.seasonStats.gp : 0;
    const ppgB = b.seasonStats.gp > 0 ? b.seasonStats.pts / b.seasonStats.gp : 0;
    return ppgB - ppgA;
  })[0];
  
  league.history.push({
    season: league.season,
    champion: champion.name,
    championRecord: `${champion.wins}-${champion.losses}`,
    scoringLeader: scoringLeader ? {
      name: scoringLeader.name,
      ppg: (scoringLeader.seasonStats.pts / scoringLeader.seasonStats.gp).toFixed(1)
    } : null,
    standings: standings.map(t => ({ name: t.name, wins: t.wins, losses: t.losses }))
  });
}

/* ============================
   PLAYER PROGRESSION
============================ */

function progressPlayers() {
  league.teams.forEach(team => {
    // Coach player development bonus (0-15% boost for young players)
    const devBonus = team.coach ? (team.coach.ratings.playerDevelopment - 60) * 0.005 : 0;
    
    team.players.forEach(player => {
      player.age++;
      
      // Age curve
      let growthFactor = 0;
      if (player.age >= 19 && player.age <= 23) {
        growthFactor = randFloat(0, 3);
        // Chance of big leap if POT > OVR
        if (player.ratings.pot > player.ratings.ovr && Math.random() < 0.3) {
          growthFactor += randFloat(3, 8);
        }
        // Apply coach development bonus for young players
        growthFactor *= (1.0 + devBonus);
      } else if (player.age >= 24 && player.age <= 29) {
        growthFactor = randFloat(-1, 1);
      } else if (player.age >= 30) {
        growthFactor = randFloat(-5, -1);
      }
      
      // Apply to each rating
      player.ratings.shoot = clamp(player.ratings.shoot + growthFactor + randFloat(-2, 2), 30, 100);
      player.ratings.defense = clamp(player.ratings.defense + growthFactor + randFloat(-2, 2), 30, 100);
      player.ratings.rebound = clamp(player.ratings.rebound + growthFactor + randFloat(-2, 2), 30, 100);
      player.ratings.passing = clamp(player.ratings.passing + growthFactor + randFloat(-2, 2), 30, 100);
      
      // Recalculate OVR
      player.ratings.ovr = Math.round((player.ratings.shoot + player.ratings.defense + 
                                       player.ratings.rebound + player.ratings.passing) / 4);
      player.ratings.ovr = clamp(player.ratings.ovr, 30, 100);
    });
  });
}

/* ============================
   CONTRACTS & FREE AGENCY
============================ */

function runOffseason() {
  if (!league || league.phase !== 'offseason') {
    alert('Not in offseason phase!');
    return;
  }
  
  // Evaluate and potentially fire coaches
  evaluateCoachPerformance();
  
  // Update coach contracts and age
  updateCoachContracts();
  
  // Progress players (age + ratings)
  progressPlayers();
  
  // Handle expiring contracts
  handleExpiringContracts();
  
  // Re-sign phase
  resignPlayers();
  
  // Free agency
  freeAgencySignings();
  
  // Restore some morale
  league.teams.forEach(team => {
    team.morale = Math.min(100, team.morale + 5);
  });
  
  updateTeamPayrolls();
  league.phase = 'draft';
  
  // Generate draft class
  league.draftClass = generateDraftClass();
  
  render();
  alert('Offseason complete! Proceed to Draft.');
  save();
}

function handleExpiringContracts() {
  league.teams.forEach(team => {
    const expiring = team.players.filter(p => p.contract.exp <= league.season);
    expiring.forEach(p => {
      league.freeAgents.push(p);
    });
    team.players = team.players.filter(p => p.contract.exp > league.season);
  });
}

function resignPlayers() {
  league.teams.forEach(team => {
    const capSpace = SALARY_CAP - team.players.reduce((sum, p) => sum + p.contract.amount, 0);
    
    // Try to re-sign top free agents from this team
    const teamFAs = league.freeAgents.filter(fa => {
      // Check if player was on this team (simple heuristic: if team has < 12 players)
      return team.players.length < 12;
    }).sort((a, b) => b.ratings.ovr - a.ratings.ovr);
    
    for (let fa of teamFAs) {
      if (team.players.length >= 15) break;
      
      const newSalary = calculateSalary(fa.ratings.ovr);
      const currentPayroll = team.players.reduce((sum, p) => sum + p.contract.amount, 0);
      
      if (currentPayroll + newSalary <= SALARY_CAP * 1.1) { // 10% luxury tax tolerance
        fa.contract = {
          amount: newSalary,
          exp: league.season + rand(1, 4)
        };
        team.players.push(fa);
        league.freeAgents = league.freeAgents.filter(p => p.id !== fa.id);
      }
    }
  });
}

function freeAgencySignings() {
  // Remaining free agents sign minimum deals with teams under cap
  league.freeAgents.sort((a, b) => b.ratings.ovr - a.ratings.ovr);
  
  for (let fa of [...league.freeAgents]) {
    const teamsWithSpace = league.teams.filter(t => {
      const payroll = t.players.reduce((sum, p) => sum + p.contract.amount, 0);
      return payroll < SALARY_CAP && t.players.length < 15;
    }).sort((a, b) => {
      const payA = a.players.reduce((sum, p) => sum + p.contract.amount, 0);
      const payB = b.players.reduce((sum, p) => sum + p.contract.amount, 0);
      return payA - payB; // Teams with more space go first
    });
    
    if (teamsWithSpace.length > 0) {
      const team = teamsWithSpace[0];
      fa.contract = {
        amount: MIN_SALARY,
        exp: league.season + 1
      };
      team.players.push(fa);
      league.freeAgents = league.freeAgents.filter(p => p.id !== fa.id);
    }
  }
}

/* ============================
   DRAFT
============================ */

function runDraft() {
  if (!league || league.phase !== 'draft') {
    alert('Not in draft phase!');
    return;
  }
  
  // Draft order: reverse standings
  const draftOrder = [...league.teams].sort((a, b) => a.wins - b.wins);
  
  for (let i = 0; i < draftOrder.length && i < league.draftClass.length; i++) {
    const team = draftOrder[i];
    const pick = league.draftClass[i];
    
    pick.contract = {
      amount: rand(2, 5), // Rookie scale
      exp: league.season + 4
    };
    
    team.players.push(pick);
  }
  
  league.draftClass = [];
  league.phase = 'preseason';
  league.season++;
  
  updateTeamPayrolls();
  render();
  alert(`Draft complete! Welcome to the ${league.season} season!`);
  save();
}

/* ============================
   TRANSACTIONS
============================ */

function cutPlayer(playerId, teamId) {
  const team = league.teams.find(t => t.id === teamId);
  if (!team) return;
  
  const player = team.players.find(p => p.id === playerId);
  if (!player) return;
  
  if (!confirm(`Cut ${player.name}? (Salary: $${player.contract.amount}M)`)) return;
  
  team.players = team.players.filter(p => p.id !== playerId);
  league.freeAgents.push(player);
  
  updateTeamPayrolls();
  render();
  save();
}

function signFreeAgent(playerId, teamId) {
  const team = league.teams.find(t => t.id === teamId);
  const player = league.freeAgents.find(p => p.id === playerId);
  
  if (!team || !player) return;
  
  const currentPayroll = team.players.reduce((sum, p) => sum + p.contract.amount, 0);
  if (currentPayroll + player.contract.amount > SALARY_CAP) {
    alert('Not enough cap space!');
    return;
  }
  
  if (team.players.length >= 15) {
    alert('Roster full! (Max 15 players)');
    return;
  }
  
  team.players.push(player);
  league.freeAgents = league.freeAgents.filter(p => p.id !== playerId);
  
  updateTeamPayrolls();
  render();
  save();
}

/* ============================
   COACH MANAGEMENT
============================ */

function fireCoach(teamId) {
  const team = league.teams.find(t => t.id === teamId);
  if (!team || !team.coach) return;
  
  const coachName = team.coach.name;
  if (!confirm(`Fire ${coachName}? This will temporarily hurt team morale.`)) return;
  
  // Morale penalty for firing coach
  team.morale = Math.max(40, team.morale - 15);
  
  // Hire a replacement immediately
  team.coach = makeCoach(rand(0, 20));
  
  alert(`${coachName} has been fired. ${team.coach.name} is the new head coach.`);
  
  render();
  save();
}

function evaluateCoachPerformance() {
  // AI teams evaluate and potentially fire coaches
  league.teams.forEach(team => {
    if (!team.coach) return;
    
    const totalGames = team.wins + team.losses;
    if (totalGames < 30) return; // Need enough games to evaluate
    
    const winPct = team.wins / totalGames;
    const moraleIsPoor = team.morale < 50;
    const coachIsStruggling = team.coach.ratings.overall < 55;
    
    // Firing conditions
    const shouldFire = 
      (winPct < 0.30 && totalGames > 40) || // Terrible record
      (winPct < 0.40 && moraleIsPoor) || // Bad record + low morale
      (moraleIsPoor && coachIsStruggling); // Low morale + bad coach
    
    if (shouldFire && Math.random() < 0.3) { // 30% chance if conditions met
      team.morale = Math.max(40, team.morale - 10);
      team.coach = makeCoach(rand(5, 25));
    }
  });
}

function updateCoachContracts() {
  // Age coaches and update contracts during offseason
  league.teams.forEach(team => {
    if (!team.coach) return;
    
    team.coach.age++;
    team.coach.experience++;
    team.coach.contract.yearsRemaining--;
    
    // Extend or renegotiate if contract is expiring
    if (team.coach.contract.yearsRemaining <= 0) {
      // Good coaches get extensions, bad ones get replaced
      const winPct = team.wins / Math.max(1, team.wins + team.losses);
      if (winPct > 0.45 || team.coach.ratings.overall > 70) {
        // Extend contract
        team.coach.contract.yearsRemaining = rand(2, 5);
        team.coach.contract.annualSalary = calculateCoachSalary(team.coach.ratings.overall);
      } else {
        // Replace
        team.coach = makeCoach(rand(0, 15));
      }
    }
  });
}

/* ============================
   ROTATIONS SYSTEM
============================ */

function generateDefaultRotations(team) {
  // Generate default minute targets and roles for a team
  const rotations = {
    minuteTargetsByPlayerId: {},
    roleByPlayerId: {},
    lockedByPlayerId: {}
  };
  
  // Group players by position fit
  const positionGroups = {
    PG: [],
    SG: [],
    SF: [],
    PF: [],
    C: []
  };
  
  team.players.forEach(p => {
    if (!positionGroups[p.pos]) positionGroups[p.pos] = [];
    positionGroups[p.pos].push(p);
  });
  
  // Sort each position by OVR
  Object.keys(positionGroups).forEach(pos => {
    positionGroups[pos].sort((a, b) => b.ratings.ovr - a.ratings.ovr);
  });
  
  // Assign starters (top player per position)
  const starters = [];
  ['PG', 'SG', 'SF', 'PF', 'C'].forEach(pos => {
    if (positionGroups[pos].length > 0) {
      const player = positionGroups[pos][0];
      starters.push(player);
      rotations.roleByPlayerId[player.id] = 'starter';
      rotations.minuteTargetsByPlayerId[player.id] = 34;
      rotations.lockedByPlayerId[player.id] = false;
    }
  });
  
  // Collect remaining players
  const bench = team.players.filter(p => !starters.includes(p));
  bench.sort((a, b) => b.ratings.ovr - a.ratings.ovr);
  
  // Assign bench roles and minutes
  const starterMinutes = starters.length * 34; // 170
  const remainingMinutes = 240 - starterMinutes; // 70
  
  bench.forEach((player, idx) => {
    if (idx === 0) {
      // Sixth man
      rotations.roleByPlayerId[player.id] = 'sixth';
      rotations.minuteTargetsByPlayerId[player.id] = 24;
    } else if (idx < 4) {
      // Rotation players
      rotations.roleByPlayerId[player.id] = 'rotation';
      const avgMinutes = Math.floor((remainingMinutes - 24) / Math.min(3, bench.length - 1));
      rotations.minuteTargetsByPlayerId[player.id] = Math.max(10, avgMinutes);
    } else if (idx < 8) {
      // Deep bench
      rotations.roleByPlayerId[player.id] = 'bench';
      rotations.minuteTargetsByPlayerId[player.id] = Math.max(5, Math.floor((remainingMinutes - 24) / (bench.length - 1)));
    } else {
      // DNP
      rotations.roleByPlayerId[player.id] = 'dnp';
      rotations.minuteTargetsByPlayerId[player.id] = 0;
    }
    rotations.lockedByPlayerId[player.id] = false;
  });
  
  // Normalize to exactly 240
  normalizeMinutesTo240(rotations.minuteTargetsByPlayerId, team.players);
  
  return rotations;
}

function normalizeMinutesTo240(minuteTargets, players) {
  // Adjust minutes so total equals 240
  const playerIds = players.map(p => p.id);
  let total = playerIds.reduce((sum, id) => sum + (minuteTargets[id] || 0), 0);
  
  if (total === 240) return;
  
  const diff = 240 - total;
  const activePlayers = playerIds.filter(id => (minuteTargets[id] || 0) > 0);
  
  if (activePlayers.length === 0) {
    // Edge case: distribute 240 across all players
    const perPlayer = Math.floor(240 / playerIds.length);
    playerIds.forEach(id => minuteTargets[id] = perPlayer);
    total = perPlayer * playerIds.length;
    if (total < 240) {
      minuteTargets[playerIds[0]] += 240 - total;
    }
    return;
  }
  
  // Distribute diff across active players
  const perPlayer = Math.floor(diff / activePlayers.length);
  const remainder = diff % activePlayers.length;
  
  activePlayers.forEach((id, idx) => {
    minuteTargets[id] = (minuteTargets[id] || 0) + perPlayer + (idx < remainder ? 1 : 0);
  });
}

function calcTotalMinutes(teamId) {
  const team = league.teams.find(t => t.id === teamId);
  if (!team || !team.rotations) return 0;
  
  return team.players.reduce((sum, p) => {
    return sum + (team.rotations.minuteTargetsByPlayerId[p.id] || 0);
  }, 0);
}

function getProjectedMinutes(team, player) {
  // Apply coach/GM influence to calculate projected minutes from targets
  if (!team.rotations) return 0;
  
  const target = team.rotations.minuteTargetsByPlayerId[player.id] || 0;
  if (target === 0) return 0;
  
  const coach = team.coach;
  if (!coach) return target;
  
  // Coach rigidity: how closely coach follows GM targets
  // Higher rigidity = less deviation
  const rigidity = coach.personality?.discipline ? coach.personality.discipline * 10 : 50;
  const deviationScale = (100 - rigidity) / 100;
  
  // Random deviation based on coach personality
  const randomDeviation = (Math.random() - 0.5) * 10 * deviationScale;
  
  // Veteran bias
  const veteranBias = coach.personality?.patience ? (coach.personality.patience - 5) : 0;
  const veteranAdjustment = player.age > 28 ? veteranBias * 0.5 : 0;
  
  // Overall rating influence
  const ovrAdjustment = (player.ratings.ovr - 75) * 0.1;
  
  const projected = target + randomDeviation + veteranAdjustment + ovrAdjustment;
  
  return Math.max(0, Math.min(48, Math.round(projected)));
}

function getGameRotation(team) {
  // Get players who should play this game based on rotation
  if (!team.rotations) {
    // Fallback: top 8 by OVR
    return team.players.sort((a, b) => b.ratings.ovr - a.ratings.ovr).slice(0, 8);
  }
  
  // Get players with minute targets > 0, sorted by target minutes
  const playersWithMinutes = team.players
    .filter(p => (team.rotations.minuteTargetsByPlayerId[p.id] || 0) > 0)
    .sort((a, b) => {
      const minsB = team.rotations.minuteTargetsByPlayerId[b.id] || 0;
      const minsA = team.rotations.minuteTargetsByPlayerId[a.id] || 0;
      return minsB - minsA;
    });
  
  // Ensure at least 8 players (fill with next best OVR if needed)
  if (playersWithMinutes.length < 8) {
    const remainingPlayers = team.players
      .filter(p => !playersWithMinutes.includes(p))
      .sort((a, b) => b.ratings.ovr - a.ratings.ovr);
    
    playersWithMinutes.push(...remainingPlayers.slice(0, 8 - playersWithMinutes.length));
  }
  
  return playersWithMinutes.slice(0, 10); // Top 10 players for rotation
}

/* ============================
   LEAGUE MIGRATIONS
============================ */

// Migration functions (each takes league and modifies it)
const migrations = {
  1: function migrateTo1(league) {
    // Fix draft data: migrate to player.draft structure and clean up bad values
    console.log('Running migration to schema version 1: migrating draft data to player.draft structure');
    
    // Get all valid team IDs
    const validTeamIds = new Set(league.teams.map(t => t.id));
    
    // Migrate all players (on teams + free agents)
    const allPlayers = [
      ...league.teams.flatMap(t => t.players),
      ...league.freeAgents
    ];
    
    allPlayers.forEach(player => {
      // Ensure draft object exists
      if (!player.draft) {
        player.draft = {
          year: null,
          round: null,
          pick: null,
          draftedByTid: null
        };
      }
      
      // Migrate from bio fields if draft fields are empty
      if (player.bio) {
        // Migrate draft year/round/pick from bio
        if (player.draft.year === null && player.bio.draftYear !== undefined) {
          player.draft.year = typeof player.bio.draftYear === 'number' && isFinite(player.bio.draftYear) 
            ? player.bio.draftYear : null;
          delete player.bio.draftYear;
        }
        
        if (player.draft.round === null && player.bio.draftRound !== undefined) {
          player.draft.round = typeof player.bio.draftRound === 'number' && isFinite(player.bio.draftRound) 
            ? player.bio.draftRound : null;
          delete player.bio.draftRound;
        }
        
        if (player.draft.pick === null && player.bio.draftPick !== undefined) {
          player.draft.pick = typeof player.bio.draftPick === 'number' && isFinite(player.bio.draftPick) 
            ? player.bio.draftPick : null;
          delete player.bio.draftPick;
        }
        
        // Migrate draftedByTid from bio
        if (player.draft.draftedByTid === null && player.bio.draftedByTid !== undefined) {
          // Handle string values like "Team 26" or "Undrafted"
          if (typeof player.bio.draftedByTid === 'string') {
            const match = player.bio.draftedByTid.match(/Team (\d+)/);
            if (match) {
              const teamId = parseInt(match[1]);
              player.draft.draftedByTid = validTeamIds.has(teamId) ? teamId : null;
            } else {
              player.draft.draftedByTid = null;
            }
          } else if (typeof player.bio.draftedByTid === 'number') {
            player.draft.draftedByTid = validTeamIds.has(player.bio.draftedByTid) ? player.bio.draftedByTid : null;
          }
          delete player.bio.draftedByTid;
        }
        
        // Handle legacy draftedBy field
        if (player.bio.draftedBy !== undefined) {
          if (typeof player.bio.draftedBy === 'string' && player.draft.draftedByTid === null) {
            const match = player.bio.draftedBy.match(/Team (\d+)/);
            if (match) {
              const teamId = parseInt(match[1]);
              player.draft.draftedByTid = validTeamIds.has(teamId) ? teamId : null;
            }
          }
          delete player.bio.draftedBy;
        }
      }
      
      // Clean up draft object - if no year/round/pick, force all to null
      const isDrafted = (
        typeof player.draft.year === 'number' && isFinite(player.draft.year) &&
        typeof player.draft.round === 'number' && isFinite(player.draft.round) &&
        typeof player.draft.pick === 'number' && isFinite(player.draft.pick)
      );
      
      if (!isDrafted) {
        player.draft.year = null;
        player.draft.round = null;
        player.draft.pick = null;
        player.draft.draftedByTid = null;
      } else {
        // If drafted but team not found, set to null
        if (player.draft.draftedByTid !== null && !validTeamIds.has(player.draft.draftedByTid)) {
          player.draft.draftedByTid = null;
        }
      }
      
      // Normalize -1 to null
      if (player.draft.draftedByTid === -1) {
        player.draft.draftedByTid = null;
      }
    });
    
    // Add rotations to teams that don't have them
    league.teams.forEach(team => {
      if (!team.rotations) {
        team.rotations = generateDefaultRotations(team);
      }
    });
    
    console.log('Migration to version 1 complete');
  }
};

function migrateLeague(league) {
  const startVersion = league.schemaVersion || 0;
  let currentVersion = startVersion;
  
  console.log(`League schema version: ${currentVersion}, current: ${CURRENT_SCHEMA_VERSION}`);
  
  // Run migrations sequentially
  while (currentVersion < CURRENT_SCHEMA_VERSION) {
    const nextVersion = currentVersion + 1;
    const migrationFn = migrations[nextVersion];
    
    if (migrationFn) {
      console.log(`Running migration ${currentVersion} -> ${nextVersion}`);
      migrationFn(league);
      currentVersion = nextVersion;
    } else {
      console.warn(`No migration function found for version ${nextVersion}`);
      break;
    }
  }
  
  // Update schema version
  league.schemaVersion = currentVersion;
  
  return currentVersion !== startVersion; // Return true if migrations were run
}

/* ============================
   LEAGUE CREATION
============================ */

function createLeague(leagueName, seasonYear, teamCount, newLeagueState, userTeamId) {
  nextPlayerId = 1;
  const teams = [];
  
  for (let i = 0; i < Math.min(teamCount, 30); i++) {
    // Use customized team from newLeagueState if available, otherwise use TEAM_META
    const teamMeta = (newLeagueState && newLeagueState.teams && newLeagueState.teams.length > i) ? newLeagueState.teams[i] : TEAM_META[i];
    if (teamMeta) {
      const fullName = `${teamMeta.city} ${teamMeta.name}`;
      teams.push(makeTeam(i + 1, fullName, {
        city: teamMeta.city,
        conference: teamMeta.conference,
        division: teamMeta.division,
        market: teamMeta.market,
        primaryColor: teamMeta.primaryColor,
        secondaryColor: teamMeta.secondaryColor,
        logoPrimaryUrl: teamMeta.logoPrimaryUrl,
        logoSecondaryUrl: teamMeta.logoSecondaryUrl
      }));
    } else {
      teams.push(makeTeam(i + 1, `Team ${i + 1}`, {}));
    }
  }
  
  league = {
    id: 'league_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    name: leagueName,
    season: seasonYear,
    phase: 'preseason', // preseason, season, offseason, draft
    teams,
    freeAgents: [],
    history: [],
    draftClass: [],
    schemaVersion: CURRENT_SCHEMA_VERSION,
    meta: {
      hasSeenWelcome: false
    }
  };
  
  updateTeamPayrolls();
  
  // Set selected team to user's choice, NOT the first team
  selectedTeamId = userTeamId || teams[0].id;
  console.log('League created with userTeamId:', userTeamId, 'selectedTeamId:', selectedTeamId);
  
  appView = 'league';
  save();
  
  // Show welcome overlay for new leagues
  openWelcomeOverlay();
}
