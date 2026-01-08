/* ============================
   PLAYER RATING SYSTEM
   Non-linear, scarcity-based rating calculation
============================ */

/**
 * Rating System Constants
 */
const RATING_CONSTANTS = {
  // Overall range: 40-99 (absolute maximum)
  OVR_MIN: 40,
  OVR_MAX: 99,
  
  // Potential range: 45-99
  POT_MIN: 45,
  POT_MAX: 99,
  
  // Scarcity constraints (league-wide)
  MAX_PLAYERS_ABOVE_97: 1,    // Only 1 generational player
  MAX_PLAYERS_ABOVE_94: 3,    // Elite tier
  TARGET_PLAYERS_ABOVE_90: 10, // All-NBA level
  
  // Development age ranges
  DEVELOPMENT_PEAK_START: 24,
  DEVELOPMENT_PEAK_END: 27,
  DECLINE_START_MIN: 29,
  DECLINE_START_MAX: 32,
  
  // Attribute weights for OVR calculation
  WEIGHTS: {
    // Core skills (70% of rating)
    shooting: 0.20,
    defense: 0.18,
    playmaking: 0.16,
    rebounding: 0.16,
    
    // Mental/IQ (15% of rating)
    basketballIQ: 0.08,
    consistency: 0.04,
    composure: 0.03,
    
    // Athletic (10% of rating)
    speed: 0.03,
    strength: 0.02,
    vertical: 0.02,
    
    // Physical modifiers (5% of rating)
    height: 0.025,
    wingspan: 0.025
  }
};

/**
 * Calculate non-linear OVR from weighted attributes
 * Uses exponential scaling to create separation at the top
 */
function calculatePlayerOVR(player) {
  if (!player || !player.detailedAttributes) {
    return 50; // Fallback
  }
  
  const attrs = player.detailedAttributes;
  const W = RATING_CONSTANTS.WEIGHTS;
  
  // Aggregate skill ratings
  const shooting = calculateShootingRating(attrs.offensive.scoringSkills);
  const defense = calculateDefenseRating(attrs.defensive);
  const playmaking = calculatePlaymakingRating(attrs.offensive.playmakingSkills);
  const rebounding = (attrs.defensive.defensiveRebounding + attrs.defensive.offensiveRebounding) / 2;
  
  // Mental attributes
  const basketballIQ = attrs.mental.basketballIQ || 70;
  const consistency = attrs.mental.consistency || 70;
  const composure = attrs.mental.composure || 70;
  
  // Athletic attributes
  const speed = attrs.athletic.speed || 70;
  const strength = attrs.athletic.strength || 70;
  const vertical = attrs.athletic.vertical || 70;
  
  // Physical measurements (normalized to 0-100 scale)
  const height = normalizeHeight(player.bio?.heightInches || 78);
  const wingspan = normalizeWingspan(player.bio?.wingspanInches || 80);
  
  // Weighted sum (base rating)
  const baseRating = 
    shooting * W.shooting +
    defense * W.defense +
    playmaking * W.playmaking +
    rebounding * W.rebounding +
    basketballIQ * W.basketballIQ +
    consistency * W.consistency +
    composure * W.composure +
    speed * W.speed +
    strength * W.strength +
    vertical * W.vertical +
    height * W.height +
    wingspan * W.wingspan;
  
  // Apply non-linear transformation
  // This creates exponential separation at the top
  const curved = applyOVRCurve(baseRating);
  
  // Apply age-based modifiers
  const ageFactor = getAgeFactor(player.age);
  const adjusted = curved * ageFactor;
  
  // Clamp to valid range
  return Math.round(clamp(adjusted, RATING_CONSTANTS.OVR_MIN, RATING_CONSTANTS.OVR_MAX));
}

/**
 * Calculate shooting rating from all shooting skills
 */
function calculateShootingRating(scoringSkills) {
  if (!scoringSkills) return 70;
  
  return (
    (scoringSkills.finishing || 70) * 0.25 +
    (scoringSkills.midRangeShooting || 70) * 0.20 +
    (scoringSkills.threePointShooting || 70) * 0.25 +
    (scoringSkills.freeThrowShooting || 70) * 0.15 +
    (scoringSkills.postScoring || 70) * 0.10 +
    (scoringSkills.shotCreation || 70) * 0.05
  );
}

/**
 * Calculate defense rating from defensive skills
 */
function calculateDefenseRating(defensiveSkills) {
  if (!defensiveSkills) return 70;
  
  return (
    (defensiveSkills.perimeterDefense || 70) * 0.30 +
    (defensiveSkills.interiorDefense || 70) * 0.25 +
    (defensiveSkills.defensiveAwareness || 70) * 0.20 +
    (defensiveSkills.stealRating || 70) * 0.15 +
    (defensiveSkills.blockRating || 70) * 0.10
  );
}

/**
 * Calculate playmaking rating
 */
function calculatePlaymakingRating(playmakingSkills) {
  if (!playmakingSkills) return 70;
  
  return (
    (playmakingSkills.passingVision || 70) * 0.35 +
    (playmakingSkills.passingAccuracy || 70) * 0.30 +
    (playmakingSkills.ballHandling || 70) * 0.25 +
    (playmakingSkills.offBallMovement || 70) * 0.10
  );
}

/**
 * Normalize height to 0-100 scale (position-adjusted)
 * 5'10" (70") = 50, 6'6" (78") = 75, 7'2" (86") = 95
 */
function normalizeHeight(heightInches) {
  return clamp((heightInches - 60) * 3.5, 0, 100);
}

/**
 * Normalize wingspan to 0-100 scale
 */
function normalizeWingspan(wingspanInches) {
  return clamp((wingspanInches - 68) * 2.5, 0, 100);
}

/**
 * Apply non-linear curve to create separation at the top
 * Low ratings (40-70) compress, high ratings (85+) expand
 */
function applyOVRCurve(baseRating) {
  // Normalize to 0-1
  const normalized = (baseRating - 40) / 60;
  
  // Apply exponential curve: y = x^1.8
  // This creates steeper gains at high end
  const curved = Math.pow(normalized, 1.8);
  
  // Scale back to 40-99 range
  return 40 + (curved * 59);
}

/**
 * Get age-based multiplier for OVR
 * Peak: 24-27, Decline: 29-32
 */
function getAgeFactor(age) {
  if (age <= 23) {
    // Young players still developing
    return 0.92 + (age - 19) * 0.02; // 0.92 at 19 → 1.0 at 23
  } else if (age <= 27) {
    // Peak years
    return 1.0;
  } else if (age <= 32) {
    // Gradual decline
    return 1.0 - (age - 27) * 0.015; // 1.0 at 27 → 0.925 at 32
  } else {
    // Steep decline after 32
    return 0.925 - (age - 32) * 0.03;
  }
}

/**
 * Calculate potential (POT) based on OVR, age, and work ethic
 */
function calculatePlayerPOT(player, currentOVR) {
  const age = player.age;
  const workEthic = player.detailedAttributes?.mental?.workEthic || 70;
  
  // Base potential from current OVR
  let pot = currentOVR;
  
  if (age < RATING_CONSTANTS.DEVELOPMENT_PEAK_START) {
    // Young players: POT > OVR
    const yearsToPeak = RATING_CONSTANTS.DEVELOPMENT_PEAK_START - age;
    const growthPotential = (workEthic / 100) * yearsToPeak * 2.5;
    pot = currentOVR + growthPotential;
  } else if (age <= RATING_CONSTANTS.DEVELOPMENT_PEAK_END) {
    // Peak years: POT ≈ OVR with slight upside
    pot = currentOVR + (workEthic - 70) / 20;
  } else {
    // Decline years: POT < OVR (shows future decline)
    const yearsAfterPeak = age - RATING_CONSTANTS.DEVELOPMENT_PEAK_END;
    const declineRate = 1.5;
    pot = currentOVR - (yearsAfterPeak * declineRate);
  }
  
  // Clamp to valid range
  return Math.round(clamp(pot, RATING_CONSTANTS.POT_MIN, RATING_CONSTANTS.POT_MAX));
}

/**
 * Enforce league-wide scarcity constraints
 * Ensures only 1 player >97, max 3 ≥94, ~10 ≥90
 */
function enforceLeagueScarcity(allPlayers) {
  if (!allPlayers || allPlayers.length === 0) return;
  
  // Sort by OVR descending
  const sorted = [...allPlayers].sort((a, b) => (b.ratings?.ovr || 0) - (a.ratings?.ovr || 0));
  
  // Count players in elite tiers
  const above97 = sorted.filter(p => p.ratings.ovr > 97);
  const above94 = sorted.filter(p => p.ratings.ovr >= 94);
  const above90 = sorted.filter(p => p.ratings.ovr >= 90);
  
  // Enforce 97+ cap (only 1 allowed)
  if (above97.length > RATING_CONSTANTS.MAX_PLAYERS_ABOVE_97) {
    for (let i = RATING_CONSTANTS.MAX_PLAYERS_ABOVE_97; i < above97.length; i++) {
      above97[i].ratings.ovr = 97;
      console.log(`[SCARCITY] Capped ${above97[i].name} from ${above97[i].ratings.ovr} to 97`);
    }
  }
  
  // Enforce 94+ cap (max 3 allowed)
  if (above94.length > RATING_CONSTANTS.MAX_PLAYERS_ABOVE_94) {
    for (let i = RATING_CONSTANTS.MAX_PLAYERS_ABOVE_94; i < above94.length; i++) {
      above94[i].ratings.ovr = 93;
      console.log(`[SCARCITY] Capped ${above94[i].name} from ${above94[i].ratings.ovr} to 93`);
    }
  }
  
  // Soft cap for 90+ (compress if too many)
  if (above90.length > RATING_CONSTANTS.TARGET_PLAYERS_ABOVE_90 + 5) {
    const excess = above90.length - RATING_CONSTANTS.TARGET_PLAYERS_ABOVE_90;
    for (let i = RATING_CONSTANTS.TARGET_PLAYERS_ABOVE_90; i < above90.length && i < RATING_CONSTANTS.TARGET_PLAYERS_ABOVE_90 + excess; i++) {
      above90[i].ratings.ovr -= 2;
      console.log(`[SCARCITY] Reduced ${above90[i].name} to ${above90[i].ratings.ovr}`);
    }
  }
}

/**
 * Recalculate all player ratings (call only on season transitions)
 */
function recalculateAllRatings() {
  if (!league || !league.teams) return;
  
  console.log('[RATINGS] Recalculating all player ratings...');
  
  const allPlayers = [];
  
  // Collect all players
  league.teams.forEach(team => {
    team.players.forEach(player => {
      allPlayers.push(player);
    });
  });
  
  if (league.freeAgents) {
    league.freeAgents.forEach(player => {
      allPlayers.push(player);
    });
  }
  
  // Recalculate OVR and POT for each player
  allPlayers.forEach(player => {
    const ovr = calculatePlayerOVR(player);
    const pot = calculatePlayerPOT(player, ovr);
    
    if (!player.ratings) {
      player.ratings = {};
    }
    
    player.ratings.ovr = ovr;
    player.ratings.pot = pot;
  });
  
  // Enforce scarcity constraints
  enforceLeagueScarcity(allPlayers);
  
  console.log('[RATINGS] ✓ Ratings recalculated');
  
  // Display elite players
  const elitePlayers = allPlayers
    .filter(p => p.ratings.ovr >= 90)
    .sort((a, b) => b.ratings.ovr - a.ratings.ovr)
    .slice(0, 15);
  
  console.log('[RATINGS] Elite Players (90+):');
  elitePlayers.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name} - ${p.ratings.ovr} OVR (${p.age} years old)`);
  });
}

/**
 * Get OVR tier information for UI display
 */
function getOVRTier(ovr) {
  if (ovr >= 95) return { name: 'Generational', color: '#FFD700', emoji: '👑' };
  if (ovr >= 90) return { name: 'All-NBA', color: '#FF6B6B', emoji: '⭐' };
  if (ovr >= 85) return { name: 'All-Star', color: '#4ECDC4', emoji: '🌟' };
  if (ovr >= 75) return { name: 'Starter', color: '#95E1D3', emoji: '✓' };
  if (ovr >= 65) return { name: 'Rotation', color: '#999', emoji: '○' };
  return { name: 'Bench', color: '#666', emoji: '·' };
}

/**
 * Get player's league rank by OVR
 */
function getPlayerLeagueRank(player) {
  if (!league || !league.teams) return null;
  
  const allPlayers = [];
  league.teams.forEach(team => {
    team.players.forEach(p => allPlayers.push(p));
  });
  
  if (league.freeAgents) {
    league.freeAgents.forEach(p => allPlayers.push(p));
  }
  
  allPlayers.sort((a, b) => (b.ratings?.ovr || 0) - (a.ratings?.ovr || 0));
  
  const rank = allPlayers.findIndex(p => p.id === player.id) + 1;
  return rank > 0 ? rank : null;
}

console.log('[RATINGS] Rating system loaded');
