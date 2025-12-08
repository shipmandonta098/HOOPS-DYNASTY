import { Player, Team, Coach, AwardRace, AwardRaceCandidate } from "../types/basketball";

/**
 * Calculate MVP race candidates
 */
export function calculateMVPRace(
  players: Player[],
  teams: Team[],
  previousRace?: AwardRace
): AwardRace {
  // Filter players on teams (not free agents)
  const activePlayers = players.filter((p) => p.teamId !== null);

  // Calculate MVP score for each player
  const scoredPlayers = activePlayers.map((player) => {
    const team = teams.find((t) => t.id === player.teamId);
    if (!team) return null;

    let score = 0;

    // Individual performance (50% weight)
    // PPG equivalent (from overall rating and offensive attributes)
    const ppgEstimate = (player.stats.points / 10) * player.overall;
    score += (ppgEstimate / 30) * 20; // Max 20 points

    // All-around game (assists, rebounds)
    const allAroundScore = (player.stats.assists + player.stats.rebounds) / 20;
    score += allAroundScore * 15; // Max 15 points

    // Overall rating matters
    score += (player.overall / 99) * 15; // Max 15 points

    // Team success (50% weight)
    const winPct = team.wins / (team.wins + team.losses || 1);
    score += winPct * 30; // Max 30 points

    // Team placement boost (top teams get extra boost)
    const sortedTeams = [...teams].sort((a, b) => {
      const aWinPct = a.wins / (a.wins + a.losses || 1);
      const bWinPct = b.wins / (b.wins + b.losses || 1);
      return bWinPct - aWinPct;
    });
    const teamRank = sortedTeams.findIndex((t) => t.id === team.id) + 1;
    if (teamRank <= 3) {
      score += 10;
    } else if (teamRank <= 8) {
      score += 5;
    }

    // Star power (clutch, leadership)
    score += (player.attributes.clutch / 100) * 5;
    score += (player.attributes.leadership / 100) * 5;

    return {
      player,
      team,
      score,
    };
  }).filter((p) => p !== null) as Array<{ player: Player; team: Team; score: number }>;

  // Sort by score and take top 10
  const topCandidates = scoredPlayers
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  // Determine momentum
  const candidates: AwardRaceCandidate[] = topCandidates.map((candidate, index) => {
    const rank = index + 1;
    const previousRank = previousRace?.candidates.find((c) => c.playerId === candidate.player.id)?.rank;
    let momentum: "Up" | "Down" | "Steady" = "Steady";
    if (previousRank) {
      if (previousRank > rank) momentum = "Up";
      else if (previousRank < rank) momentum = "Down";
    }

    // Generate stat line
    const ppg = candidate.player.stats.points.toFixed(1);
    const rpg = candidate.player.stats.rebounds.toFixed(1);
    const apg = candidate.player.stats.assists.toFixed(1);
    const statLine = `${ppg} PPG, ${rpg} RPG, ${apg} APG`;

    // Generate explanation
    let explanation = "";
    if (rank === 1) {
      explanation = "Leading the league with dominant all-around play and team success";
    } else if (rank <= 3) {
      explanation = "Elite production on a winning team";
    } else if (rank <= 5) {
      explanation = "Outstanding individual stats and leadership";
    } else {
      explanation = "Strong performance keeping team competitive";
    }

    return {
      playerId: candidate.player.id,
      playerName: candidate.player.name,
      teamId: candidate.team.id,
      rank,
      statLine,
      teamRecord: `${candidate.team.wins}-${candidate.team.losses}`,
      momentum,
      explanation,
      score: candidate.score,
    };
  });

  return {
    type: "MVP",
    label: "MVP Race",
    candidates,
    lastUpdated: 0, // Will be set by the store
  };
}

/**
 * Calculate DPOY race candidates
 */
export function calculateDPOYRace(
  players: Player[],
  teams: Team[],
  previousRace?: AwardRace
): AwardRace {
  const activePlayers = players.filter((p) => p.teamId !== null);

  const scoredPlayers = activePlayers.map((player) => {
    const team = teams.find((t) => t.id === player.teamId);
    if (!team) return null;

    let score = 0;

    // Defensive attributes (60% weight)
    const defenseAvg = (
      player.attributes.perimeterDefense +
      player.attributes.interiorDefense +
      player.attributes.defensiveAwareness +
      player.attributes.blockRating +
      player.attributes.stealRating
    ) / 5;
    score += (defenseAvg / 100) * 40;

    // Defensive stats
    score += player.stats.steals * 3;
    score += player.stats.blocks * 3;
    score += (player.stats.rebounds / 10) * 14;

    // Overall rating
    score += (player.overall / 99) * 15;

    // Team defensive success (approximate)
    const winPct = team.wins / (team.wins + team.losses || 1);
    score += winPct * 15;

    // Physical attributes
    score += (player.attributes.strength / 100) * 5;
    score += (player.attributes.hustle / 100) * 5;

    return { player, team, score };
  }).filter((p) => p !== null) as Array<{ player: Player; team: Team; score: number }>;

  const topCandidates = scoredPlayers.sort((a, b) => b.score - a.score).slice(0, 10);

  const candidates: AwardRaceCandidate[] = topCandidates.map((candidate, index) => {
    const rank = index + 1;
    const previousRank = previousRace?.candidates.find((c) => c.playerId === candidate.player.id)?.rank;
    let momentum: "Up" | "Down" | "Steady" = "Steady";
    if (previousRank) {
      if (previousRank > rank) momentum = "Up";
      else if (previousRank < rank) momentum = "Down";
    }

    const ppg = candidate.player.stats.points.toFixed(1);
    const rpg = candidate.player.stats.rebounds.toFixed(1);
    const bpg = candidate.player.stats.blocks.toFixed(1);
    const spg = candidate.player.stats.steals.toFixed(1);
    const statLine = `${ppg} PPG, ${rpg} RPG, ${bpg} BPG, ${spg} SPG`;

    let explanation = "";
    if (rank === 1) {
      explanation = "Anchoring elite defense with versatility and impact";
    } else if (rank <= 3) {
      explanation = "Defensive force protecting the rim and perimeter";
    } else {
      explanation = "Consistent defensive impact game after game";
    }

    return {
      playerId: candidate.player.id,
      playerName: candidate.player.name,
      teamId: candidate.team.id,
      rank,
      statLine,
      teamRecord: `${candidate.team.wins}-${candidate.team.losses}`,
      momentum,
      explanation,
      score: candidate.score,
    };
  });

  return {
    type: "DPOY",
    label: "DPOY Race",
    candidates,
    lastUpdated: 0,
  };
}

/**
 * Calculate ROY race candidates
 */
export function calculateROYRace(
  players: Player[],
  teams: Team[],
  currentYear: number,
  previousRace?: AwardRace
): AwardRace {
  // Find rookies (players drafted this year)
  const rookies = players.filter((p) => p.teamId !== null && p.bio.draftYear === currentYear);

  const scoredPlayers = rookies.map((player) => {
    const team = teams.find((t) => t.id === player.teamId);
    if (!team) return null;

    let score = 0;

    // Individual stats (70% weight)
    score += (player.stats.points / 25) * 35;
    score += (player.stats.rebounds / 10) * 15;
    score += (player.stats.assists / 8) * 15;
    score += (player.overall / 99) * 5;

    // Team success (20% weight)
    const winPct = team.wins / (team.wins + team.losses || 1);
    score += winPct * 20;

    // Potential/hype (10% weight)
    score += (player.potential / 99) * 10;

    return { player, team, score };
  }).filter((p) => p !== null) as Array<{ player: Player; team: Team; score: number }>;

  const topCandidates = scoredPlayers.sort((a, b) => b.score - a.score).slice(0, 10);

  const candidates: AwardRaceCandidate[] = topCandidates.map((candidate, index) => {
    const rank = index + 1;
    const previousRank = previousRace?.candidates.find((c) => c.playerId === candidate.player.id)?.rank;
    let momentum: "Up" | "Down" | "Steady" = "Steady";
    if (previousRank) {
      if (previousRank > rank) momentum = "Up";
      else if (previousRank < rank) momentum = "Down";
    }

    const ppg = candidate.player.stats.points.toFixed(1);
    const rpg = candidate.player.stats.rebounds.toFixed(1);
    const apg = candidate.player.stats.assists.toFixed(1);
    const statLine = `${ppg} PPG, ${rpg} RPG, ${apg} APG`;

    let explanation = "";
    if (rank === 1) {
      explanation = "Exceeded expectations with immediate impact";
    } else if (rank <= 3) {
      explanation = "Making strong rookie impression";
    } else {
      explanation = "Solid first-year production";
    }

    return {
      playerId: candidate.player.id,
      playerName: candidate.player.name,
      teamId: candidate.team.id,
      rank,
      statLine,
      teamRecord: `${candidate.team.wins}-${candidate.team.losses}`,
      momentum,
      explanation,
      score: candidate.score,
    };
  });

  return {
    type: "ROY",
    label: "ROY Race",
    candidates,
    lastUpdated: 0,
  };
}

/**
 * Calculate Sixth Man award race
 */
export function calculateSixthManRace(
  players: Player[],
  teams: Team[],
  previousRace?: AwardRace
): AwardRace {
  // Filter for bench players (lower overall rating suggests bench role)
  const benchPlayers = players.filter((p) => p.teamId !== null && p.overall >= 70 && p.overall < 85);

  const scoredPlayers = benchPlayers.map((player) => {
    const team = teams.find((t) => t.id === player.teamId);
    if (!team) return null;

    let score = 0;

    // Scoring punch off the bench (60% weight)
    score += (player.stats.points / 20) * 40;
    score += (player.overall / 99) * 20;

    // Team success (20% weight)
    const winPct = team.wins / (team.wins + team.losses || 1);
    score += winPct * 20;

    // Efficiency and versatility (20% weight)
    score += (player.stats.assists / 5) * 10;
    score += (player.attributes.offBallMovement / 100) * 10;

    return { player, team, score };
  }).filter((p) => p !== null) as Array<{ player: Player; team: Team; score: number }>;

  const topCandidates = scoredPlayers.sort((a, b) => b.score - a.score).slice(0, 10);

  const candidates: AwardRaceCandidate[] = topCandidates.map((candidate, index) => {
    const rank = index + 1;
    const previousRank = previousRace?.candidates.find((c) => c.playerId === candidate.player.id)?.rank;
    let momentum: "Up" | "Down" | "Steady" = "Steady";
    if (previousRank) {
      if (previousRank > rank) momentum = "Up";
      else if (previousRank < rank) momentum = "Down";
    }

    const ppg = candidate.player.stats.points.toFixed(1);
    const rpg = candidate.player.stats.rebounds.toFixed(1);
    const apg = candidate.player.stats.assists.toFixed(1);
    const statLine = `${ppg} PPG, ${rpg} RPG, ${apg} APG`;

    let explanation = "";
    if (rank === 1) {
      explanation = "Providing elite scoring punch off the bench";
    } else if (rank <= 3) {
      explanation = "Key reserve keeping team competitive";
    } else {
      explanation = "Valuable bench contributor";
    }

    return {
      playerId: candidate.player.id,
      playerName: candidate.player.name,
      teamId: candidate.team.id,
      rank,
      statLine,
      teamRecord: `${candidate.team.wins}-${candidate.team.losses}`,
      momentum,
      explanation,
      score: candidate.score,
    };
  });

  return {
    type: "SIXTH_MAN",
    label: "Sixth Man",
    candidates,
    lastUpdated: 0,
  };
}

/**
 * Calculate Most Improved Player race
 */
export function calculateMIPRace(
  players: Player[],
  teams: Team[],
  previousRace?: AwardRace
): AwardRace {
  // Focus on players who likely improved (age 22-28, decent overall)
  const candidates = players.filter((p) => p.teamId !== null && p.age >= 22 && p.age <= 28 && p.overall >= 75);

  const scoredPlayers = candidates.map((player) => {
    const team = teams.find((t) => t.id === player.teamId);
    if (!team) return null;

    let score = 0;

    // Simulate "improvement" based on potential vs current
    const improvementPotential = Math.max(0, player.potential - player.overall);
    score += improvementPotential * 5;

    // Current production
    score += (player.stats.points / 25) * 30;
    score += (player.overall / 99) * 30;

    // Work ethic and development traits
    score += (player.personality.workEthic / 100) * 15;
    score += (player.attributes.workEthic / 100) * 10;

    // Team success
    const winPct = team.wins / (team.wins + team.losses || 1);
    score += winPct * 10;

    return { player, team, score };
  }).filter((p) => p !== null) as Array<{ player: Player; team: Team; score: number }>;

  const topCandidates = scoredPlayers.sort((a, b) => b.score - a.score).slice(0, 10);

  const awardCandidates: AwardRaceCandidate[] = topCandidates.map((candidate, index) => {
    const rank = index + 1;
    const previousRank = previousRace?.candidates.find((c) => c.playerId === candidate.player.id)?.rank;
    let momentum: "Up" | "Down" | "Steady" = "Steady";
    if (previousRank) {
      if (previousRank > rank) momentum = "Up";
      else if (previousRank < rank) momentum = "Down";
    }

    const ppg = candidate.player.stats.points.toFixed(1);
    const rpg = candidate.player.stats.rebounds.toFixed(1);
    const apg = candidate.player.stats.assists.toFixed(1);
    const statLine = `${ppg} PPG, ${rpg} RPG, ${apg} APG`;

    let explanation = "";
    if (rank === 1) {
      explanation = "Massive leap in production and impact";
    } else if (rank <= 3) {
      explanation = "Significant improvement from last season";
    } else {
      explanation = "Notable development in their game";
    }

    return {
      playerId: candidate.player.id,
      playerName: candidate.player.name,
      teamId: candidate.team.id,
      rank,
      statLine,
      teamRecord: `${candidate.team.wins}-${candidate.team.losses}`,
      momentum,
      explanation,
      score: candidate.score,
    };
  });

  return {
    type: "MIP",
    label: "Most Improved",
    candidates: awardCandidates,
    lastUpdated: 0,
  };
}

/**
 * Calculate Coach of the Year race
 */
export function calculateCOTYRace(
  coaches: Coach[],
  teams: Team[],
  previousRace?: AwardRace
): AwardRace {
  const scoredCoaches = coaches
    .filter((coach) => coach.teamId !== null)
    .map((coach) => {
      const team = teams.find((t) => t.id === coach.teamId);
      if (!team) return null;

      let score = 0;

      // Team success (50% weight)
      const winPct = team.wins / (team.wins + team.losses || 1);
      score += winPct * 50;

      // Coaching attributes (30% weight)
      const coachAvg = (
        coach.attributes.offense +
        coach.attributes.defense +
        coach.attributes.management +
        coach.attributes.motivation
      ) / 4;
      score += (coachAvg / 99) * 30;

      // Exceeding expectations (20% weight) - approximate with team OVR
      score += (coach.overall / 99) * 20;

      return { coach, team, score };
    }).filter((c) => c !== null) as Array<{ coach: Coach; team: Team; score: number }>;

  const topCandidates = scoredCoaches.sort((a, b) => b.score - a.score).slice(0, 10);

  const candidates: AwardRaceCandidate[] = topCandidates.map((candidate, index) => {
    const rank = index + 1;
    const previousRank = previousRace?.candidates.find((c) => c.coachId === candidate.coach.id)?.rank;
    let momentum: "Up" | "Down" | "Steady" = "Steady";
    if (previousRank) {
      if (previousRank > rank) momentum = "Up";
      else if (previousRank < rank) momentum = "Down";
    }

    const winPct = (candidate.team.wins / (candidate.team.wins + candidate.team.losses || 1) * 100).toFixed(1);
    const statLine = `${candidate.team.wins}-${candidate.team.losses} (${winPct}% win rate)`;

    let explanation = "";
    if (rank === 1) {
      explanation = "Exceptional leadership elevating team performance";
    } else if (rank <= 3) {
      explanation = "Outstanding coaching surpassing expectations";
    } else {
      explanation = "Strong performance with team success";
    }

    return {
      coachId: candidate.coach.id,
      coachName: candidate.coach.name,
      teamId: candidate.team.id,
      rank,
      statLine,
      teamRecord: `${candidate.team.wins}-${candidate.team.losses}`,
      momentum,
      explanation,
      score: candidate.score,
    };
  });

  return {
    type: "COTY",
    label: "Coach of the Year",
    candidates,
    lastUpdated: 0,
  };
}
