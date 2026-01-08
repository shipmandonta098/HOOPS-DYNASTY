/* ============================
   ADVANCED PLAYER RATING SYSTEM
   Non-linear, scarcity-enforced rating calculations
============================ */

/**
 * Rating tier definitions
 */
const RATING_TIERS = {
  GENERATIONAL: { min: 95, max: 99, label: 'Generational', color: '#FFD700' },      // Gold
  ALL_NBA: { min: 90, max: 94, label: 'All-NBA', color: '#9370DB' },                 // Purple
  ALL_STAR: { min: 85, max: 89, label: 'All-Star', color: '#4169E1' },               // Royal Blue
  HIGH_STARTER: { min: 75, max: 84, label: 'High Starter', color: '#32CD32' },       // Lime Green
  STARTER: { min: 65, max: 74, label: 'Starter', color: '#FFD700' },                 // Light Gold
  ROTATION: { min: 55, max: 64, label: 'Rotation', color: '#FFA500' },               // Orange
  BENCH: { min: 45, max: 54, label: 'Bench', color: '#CD853F' },                     // Peru
  FRINGE: { min: 40, max: 44, label: 'Fringe', color: '#808080' }                    // Gray
};

/**
 * League-wide scarcity constraints
 */
const SCARCITY_RULES = {
  MAX_99: 0,           // No one should be 99 (reserved for all-time greats)
  MAX_98: 1,           // Only 1 player can be 98
  MAX_97_PLUS: 1,      // Only 1 player ≥97
  MAX_94_PLUS: 3,      // Max 3 players ≥94
  TARGET_90_PLUS: 10   // ~10 players ≥90
};

/**
 * Attribute weights for OVR calculation
 * Skills matter more than physicals
 */
const ATTRIBUTE_WEIGHTS = {
  // Core skills (70% of rating)
  scoring: 0.25,
  playmaking: 0.15,
  defense: 0.20,
  rebounding: 0.10,
  
  // Mental/IQ (20% of rating)
  basketballIQ: 0.12,
  composure: 0.04,
  consistency: 0.04,
  
  // Physical modifiers (10% of rating, capped influence)
  athleticism: 0.06,
  physical: 0.04
};

/**
 * Calculate weighted skill composite from detailed attributes
 */
function calculateSkillComposites(attrs) {
  // Scoring composite (weighted average of shooting skills)
  const scoring = (
    attrs.offensive.scoringSkills.finishing * 0.25 +
    attrs.offensive.scoringSkills.midRangeShooting * 0.20 +
    attrs.offensive.scoringSkills.threePointShooting * 0.20 +
    attrs.offensive.scoringSkills.freeThrowShooting * 0.10 +
    attrs.offensive.scoringSkills.postScoring * 0.15 +
    attrs.offensive.scoringSkills.shotCreation * 0.10
  );
  
  // Playmaking composite
  const playmaking = (
    attrs.offensive.playmakingSkills.passingVision * 0.35 +
    attrs.offensive.playmakingSkills.passingAccuracy * 0.25 +
    attrs.offensive.playmakingSkills.ballHandling * 0.30 +
    attrs.offensive.playmakingSkills.offBallMovement * 0.10
  );
  
  // Defense composite
  const defense = (
    attrs.defensive.perimeterDefense * 0.25 +
    attrs.defensive.interiorDefense * 0.25 +
    attrs.defensive.defensiveAwareness * 0.20 +
    attrs.defensive.stealRating * 0.15 +
    attrs.defensive.blockRating * 0.15
  );
  
  // Rebounding composite
  const rebounding = (
    attrs.defensive.defensiveRebounding * 0.60 +
    attrs.defensive.offensiveRebounding * 0.40
  );
  
  // Basketball IQ
  const basketballIQ = attrs.mental.basketballIQ;
  
  // Composure
  const composure = (
    attrs.mental.composure * 0.50 +
    attrs.mental.clutch * 0.50
  );
  
  // Consistency
  const consistency = (
    attrs.mental.consistency * 0.60 +
    attrs.mental.discipline * 0.40
  );
  
  // Athleticism composite
  const athleticism = (
    attrs.athletic.speed * 0.25 +
    attrs.athletic.acceleration * 0.20 +
    attrs.athletic.vertical * 0.20 +
    attrs.athletic.lateralQuickness * 0.20 +
    attrs.athletic.stamina * 0.15
  );
  
  // Physical composite (size/strength as modifier)
  const physical = (
    attrs.athletic.strength * 0.60 +
    attrs.athletic.hustle * 0.40
  );
  
  return {
    scoring,
    playmaking,
    defense,
    rebounding,
    basketballIQ,
    composure,
    consistency,
    athleticism,
    physical
  };
}

/**
 * Non-linear rating curve
 * Maps weighted sum (0-100) to OVR (40-99)
 * Elite players get more separation at the top
 */
function applyNonLinearCurve(weightedSum) {
  // weightedSum is 0-100 scale
  // We want to map this to 40-99 with non-linear progression
  
  if (weightedSum < 50) {
    // Low tier: compressed, linear growth (40-65)
    return 40 + (weightedSum / 50) * 25;
  } else if (weightedSum < 75) {
    // Mid tier: moderate growth (65-80)
    const normalized = (weightedSum - 50) / 25;
    return 65 + normalized * 15;
  } else if (weightedSum < 90) {
    // High tier: accelerated growth (80-90)
    const normalized = (weightedSum - 75) / 15;
    return 80 + Math.pow(normalized, 1.3) * 10;
  } else {
    // Elite tier: exponential growth (90-99)
    const normalized = (weightedSum - 90) / 10;
    return 90 + Math.pow(normalized, 1.5) * 9;
  }
}

/**
 * Calculate raw OVR from attributes (before scarcity adjustment)
 */
function calculateRawOVR(detailedAttributes) {
  const composites = calculateSkillComposites(detailedAttributes);
  
  // Calculate weighted sum
  let weightedSum = 0;
  weightedSum += composites.scoring * ATTRIBUTE_WEIGHTS.scoring;
  weightedSum += composites.playmaking * ATTRIBUTE_WEIGHTS.playmaking;
  weightedSum += composites.defense * ATTRIBUTE_WEIGHTS.defense;
  weightedSum += composites.rebounding * ATTRIBUTE_WEIGHTS.rebounding;
  weightedSum += composites.basketballIQ * ATTRIBUTE_WEIGHTS.basketballIQ;
  weightedSum += composites.composure * ATTRIBUTE_WEIGHTS.composure;
  weightedSum += composites.consistency * ATTRIBUTE_WEIGHTS.consistency;
  weightedSum += composites.athleticism * ATTRIBUTE_WEIGHTS.athleticism;
  weightedSum += composites.physical * ATTRIBUTE_WEIGHTS.physical;
  
  // Apply non-linear curve
  const rawOVR = applyNonLinearCurve(weightedSum);
  
  return Math.round(clamp(rawOVR, 40, 99));
}

/**
 * Calculate potential based on age, attributes, and physical tools
 */
function calculatePotential(age, rawOVR, detailedAttributes, bodyZScores) {
  let basePotential = rawOVR;
  
  // Age-based potential ceiling
  if (age <= 22) {
    // Young players: high ceiling
    basePotential += rand(10, 20);
  } else if (age <= 24) {
    // Developing: moderate ceiling
    basePotential += rand(5, 15);
  } else if (age <= 26) {
    // Peak approach: small ceiling
    basePotential += rand(0, 8);
  } else if (age <= 29) {
    // Peak/decline: POT ≈ OVR
    basePotential += rand(-5, 5);
  } else {
    // Decline: POT < OVR
    basePotential += rand(-10, 0);
  }
  
  // Physical tools bonus (elite physicals = higher ceiling)
  if (bodyZScores) {
    const { zH, zL, zB } = bodyZScores;
    
    // Exceptional wingspan
    if (zL > 1.5) {
      basePotential += Math.min(3, Math.floor(zL));
    }
    
    // Ideal size/strength combo
    if (zH + zB > 2.0) {
      basePotential += Math.min(3, Math.floor((zH + zB) * 0.8));
    }
    
    // Elite athleticism
    const athleticScore = detailedAttributes.athletic.speed + detailedAttributes.athletic.vertical;
    if (athleticScore > 180) {
      basePotential += 2;
    }
  }
  
  // Work ethic multiplier
  const workEthic = detailedAttributes.mental.workEthic;
  if (workEthic > 85) {
    basePotential += 2;
  } else if (workEthic < 60) {
    basePotential -= 2;
  }
  
  // POT must be >= OVR for young players
  if (age < 27) {
    basePotential = Math.max(basePotential, rawOVR);
  }
  
  return Math.round(clamp(basePotential, 45, 99));
}

/**
 * Enforce league-wide scarcity constraints
 * Adjusts OVRs to maintain hierarchy and rarity
 */
function enforceScarcityConstraints(allPlayers) {
  if (!allPlayers || allPlayers.length === 0) return;
  
  // Sort by raw OVR descending
  const sorted = [...allPlayers].sort((a, b) => {
    const ovrA = a.ratings?.ovr || calculateRawOVR(a.attributes || a);
    const ovrB = b.ratings?.ovr || calculateRawOVR(b.attributes || b);
    return ovrB - ovrA;
  });
  
  let count98Plus = 0;
  let count97Plus = 0;
  let count94Plus = 0;
  let count90Plus = 0;
  
  sorted.forEach((player, index) => {
    let ovr = player.ratings?.ovr || calculateRawOVR(player.attributes || player);
    
    // No one gets 99 (reserved for legends)
    if (ovr >= 99) {
      ovr = 98;
    }
    
    // Only 1 player can be 98
    if (ovr >= 98) {
      if (count98Plus >= SCARCITY_RULES.MAX_98) {
        ovr = 97;
      } else {
        count98Plus++;
      }
    }
    
    // Only 1 player ≥97
    if (ovr >= 97) {
      if (count97Plus >= SCARCITY_RULES.MAX_97_PLUS) {
        ovr = 96;
      } else {
        count97Plus++;
      }
    }
    
    // Max 3 players ≥94
    if (ovr >= 94) {
      if (count94Plus >= SCARCITY_RULES.MAX_94_PLUS) {
        ovr = 93;
      } else {
        count94Plus++;
      }
    }
    
    // Track 90+ for target
    if (ovr >= 90) {
      count90Plus++;
    }
    
    // Compress if too many 90+ players
    if (count90Plus > SCARCITY_RULES.TARGET_90_PLUS + 3 && ovr >= 90 && ovr < 94) {
      ovr = Math.min(ovr, 89);
    }
    
    // Update player OVR
    if (player.ratings) {
      player.ratings.ovr = Math.round(ovr);
    }
  });
  
  console.log('[RATINGS] Scarcity enforcement:', {
    total: sorted.length,
    '98+': count98Plus,
    '97+': count97Plus,
    '94+': count94Plus,
    '90+': count90Plus
  });
}

/**
 * Apply age-based development/decline
 * Called during season transitions
 */
function applyAgingCurve(player) {
  if (!player || !player.ratings) return;
  
  const age = player.age;
  const ovr = player.ratings.ovr;
  const pot = player.ratings.pot;
  
  // Development phase (improving toward POT)
  if (age < 24) {
    // Young players develop quickly
    const growth = Math.min(pot - ovr, rand(2, 5));
    player.ratings.ovr = Math.min(player.ratings.ovr + growth, pot);
  } else if (age >= 24 && age <= 27) {
    // Peak development years
    const growth = Math.min(pot - ovr, rand(1, 3));
    player.ratings.ovr = Math.min(player.ratings.ovr + growth, pot);
  } else if (age >= 28 && age <= 30) {
    // Maintenance phase (slight chance of improvement or decline)
    const change = rand(-1, 1);
    player.ratings.ovr = clamp(player.ratings.ovr + change, 40, 99);
  } else if (age >= 31 && age <= 33) {
    // Early decline
    const decline = rand(1, 3);
    player.ratings.ovr = Math.max(player.ratings.ovr - decline, 40);
    player.ratings.pot = Math.max(player.ratings.pot - 2, player.ratings.ovr);
  } else {
    // Steep decline
    const decline = rand(2, 4);
    player.ratings.ovr = Math.max(player.ratings.ovr - decline, 40);
    player.ratings.pot = Math.max(player.ratings.pot - 3, player.ratings.ovr);
  }
  
  // POT decay over time
  if (age >= 26) {
    player.ratings.pot = Math.max(player.ratings.pot - 1, player.ratings.ovr);
  }
}

/**
 * Get tier info for an OVR
 */
function getRatingTier(ovr) {
  for (const tier of Object.values(RATING_TIERS)) {
    if (ovr >= tier.min && ovr <= tier.max) {
      return tier;
    }
  }
  return RATING_TIERS.FRINGE;
}

/**
 * Get league rank for a player
 */
function getLeagueRank(player, allPlayers) {
  if (!player || !allPlayers) return null;
  
  const sorted = [...allPlayers].sort((a, b) => {
    const ovrA = a.ratings?.ovr || 0;
    const ovrB = b.ratings?.ovr || 0;
    return ovrB - ovrA;
  });
  
  const rank = sorted.findIndex(p => p.id === player.id) + 1;
  return rank > 0 ? rank : null;
}

/**
 * Recalculate all player ratings (called on season transition only)
 */
function recalculateAllRatings() {
  if (!league) return;
  
  console.log('[RATINGS] Recalculating all player ratings...');
  
  // Get all players
  const allPlayers = [];
  league.teams.forEach(team => {
    team.players.forEach(p => {
      p.teamName = team.name;
      allPlayers.push(p);
    });
  });
  league.freeAgents.forEach(p => {
    p.teamName = 'Free Agent';
    allPlayers.push(p);
  });
  
  // Calculate raw OVRs
  allPlayers.forEach(player => {
    if (player.attributes) {
      const rawOVR = calculateRawOVR(player.attributes);
      
      if (!player.ratings) {
        player.ratings = {};
      }
      
      player.ratings.ovr = rawOVR;
      
      // Calculate POT if not set
      if (!player.ratings.pot) {
        const bodyZScores = player.bio ? {
          zH: (player.bio.heightInches - 78) / 3,
          zL: (player.bio.wingspanInches - 81) / 4,
          zB: (player.bio.weightLbs - 215) / 25
        } : null;
        
        player.ratings.pot = calculatePotential(
          player.age,
          rawOVR,
          player.attributes,
          bodyZScores
        );
      }
    }
  });
  
  // Enforce scarcity
  enforceScarcityConstraints(allPlayers);
  
  console.log('[RATINGS] ✓ Ratings recalculated');
}

console.log('[RATINGS] Rating system loaded');
