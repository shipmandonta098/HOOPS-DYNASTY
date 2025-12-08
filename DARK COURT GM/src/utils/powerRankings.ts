import { Team, Player, Game, Coach } from "../types/basketball";

export interface PowerRankingFactors {
  teamOVR: number; // Overall team rating (0-100)
  recentRecord: number; // Last 10 games performance (0-100)
  pointDifferential: number; // Average point diff (0-100)
  offensiveEfficiency: number; // Offensive rating (0-100)
  defensiveEfficiency: number; // Defensive rating (0-100)
  strengthOfSchedule: number; // SOS score (0-100)
}

export interface TeamPowerRanking {
  teamId: string;
  rank: number;
  score: number; // Overall power ranking score (0-100)
  previousRank?: number;
  factors: PowerRankingFactors;
  momentum: "Hot" | "Cold" | "Surging" | "Falling" | "Steady";
  trend: number; // Positive = moving up, negative = moving down
}

// Weights for each factor (must sum to 1.0)
const WEIGHTS = {
  teamOVR: 0.20, // 20% - Team's overall talent level
  recentRecord: 0.25, // 25% - Recent performance (last 10 games)
  pointDifferential: 0.20, // 20% - How much they win/lose by
  offensiveEfficiency: 0.12, // 12% - Offensive performance
  defensiveEfficiency: 0.13, // 13% - Defensive performance
  strengthOfSchedule: 0.10, // 10% - Quality of opponents
};

/**
 * Calculate team overall rating based on top players
 */
export function calculateTeamOVR(team: Team, players: Player[], coach?: Coach): number {
  const roster = players.filter((p) => team.playerIds.includes(p.id));
  if (roster.length === 0) return 50;

  // Get top 8 players (rotation players)
  const topPlayers = roster.sort((a, b) => b.overall - a.overall).slice(0, 8);
  const avgPlayerRating = topPlayers.reduce((sum, p) => sum + p.overall, 0) / topPlayers.length;

  // Add coach impact (small bonus)
  const coachBonus = coach ? (coach.overall - 70) * 0.15 : 0;

  return Math.min(99, Math.max(40, avgPlayerRating + coachBonus));
}

/**
 * Calculate recent performance score (last 10 games)
 */
export function calculateRecentPerformance(team: Team, games: Game[]): number {
  // Get last 10 games for this team
  const teamGames = games
    .filter((g) => g.played && (g.homeTeamId === team.id || g.awayTeamId === team.id))
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .slice(-10);

  if (teamGames.length === 0) {
    // No games played yet, use expected performance based on initial team OVR
    return 50;
  }

  let wins = 0;
  let totalPointDiff = 0;

  teamGames.forEach((game) => {
    const isHome = game.homeTeamId === team.id;
    const teamScore = isHome ? game.homeScore : game.awayScore;
    const oppScore = isHome ? game.awayScore : game.homeScore;
    const pointDiff = teamScore - oppScore;

    if (pointDiff > 0) wins++;
    totalPointDiff += pointDiff;
  });

  // Win percentage contributes 70%
  const winPct = (wins / teamGames.length) * 100;

  // Average point differential contributes 30% (scaled)
  const avgPointDiff = totalPointDiff / teamGames.length;
  const pointDiffScore = 50 + avgPointDiff * 2; // +2 points per point differential

  // Weight more recent games slightly higher
  const recentWeight = teamGames.length >= 5 ? 0.6 : 0.5;
  const recentGames = teamGames.slice(-5);
  const recentWins = recentGames.filter((g) => {
    const isHome = g.homeTeamId === team.id;
    const teamScore = isHome ? g.homeScore : g.awayScore;
    const oppScore = isHome ? g.awayScore : g.homeScore;
    return teamScore > oppScore;
  }).length;
  const recentWinPct = (recentWins / recentGames.length) * 100;

  return Math.min(99, Math.max(1, winPct * 0.7 * (1 - recentWeight) + recentWinPct * 0.7 * recentWeight + pointDiffScore * 0.3));
}

/**
 * Calculate point differential score
 */
export function calculatePointDifferential(team: Team, games: Game[]): number {
  const teamGames = games.filter((g) => g.played && (g.homeTeamId === team.id || g.awayTeamId === team.id));

  if (teamGames.length === 0) {
    return 50; // Neutral for teams with no games
  }

  let totalPointDiff = 0;

  teamGames.forEach((game) => {
    const isHome = game.homeTeamId === team.id;
    const teamScore = isHome ? game.homeScore : game.awayScore;
    const oppScore = isHome ? game.awayScore : game.homeScore;
    totalPointDiff += teamScore - oppScore;
  });

  const avgPointDiff = totalPointDiff / teamGames.length;

  // Scale to 0-100: +10 point diff = 75 score, -10 = 25 score
  const score = 50 + avgPointDiff * 2.5;

  return Math.min(99, Math.max(1, score));
}

/**
 * Calculate offensive efficiency
 */
export function calculateOffensiveEfficiency(team: Team, players: Player[], games: Game[]): number {
  const roster = players.filter((p) => team.playerIds.includes(p.id));
  if (roster.length === 0) return 50;

  const topPlayers = roster.sort((a, b) => b.overall - a.overall).slice(0, 8);

  // Calculate offensive attributes
  const avgOffense = topPlayers.reduce((sum, p) => {
    const offense =
      (p.attributes.threePointShooting +
        p.attributes.midRangeShooting +
        p.attributes.finishing +
        p.attributes.freeThrowShooting +
        p.attributes.shotCreation +
        p.attributes.passingVision +
        p.attributes.ballHandling) /
      7;
    return sum + offense;
  }, 0) / topPlayers.length;

  // Use actual game performance if available
  const teamGames = games.filter((g) => g.played && (g.homeTeamId === team.id || g.awayTeamId === team.id));

  if (teamGames.length >= 5) {
    // Use actual points per game
    let totalPoints = 0;
    teamGames.forEach((game) => {
      const isHome = game.homeTeamId === team.id;
      totalPoints += isHome ? game.homeScore : game.awayScore;
    });
    const avgPoints = totalPoints / teamGames.length;

    // Scale: 90 PPG = 70, 110 PPG = 85, 120+ PPG = 95
    const gameScore = 20 + avgPoints * 0.6;

    // Blend attribute-based and game-based scores
    return Math.min(99, Math.max(1, avgOffense * 0.4 + gameScore * 0.6));
  }

  // No games yet, use attributes only
  return Math.min(99, Math.max(1, avgOffense));
}

/**
 * Calculate defensive efficiency
 */
export function calculateDefensiveEfficiency(team: Team, players: Player[], games: Game[]): number {
  const roster = players.filter((p) => team.playerIds.includes(p.id));
  if (roster.length === 0) return 50;

  const topPlayers = roster.sort((a, b) => b.overall - a.overall).slice(0, 8);

  // Calculate defensive attributes
  const avgDefense = topPlayers.reduce((sum, p) => {
    const defense =
      (p.attributes.perimeterDefense +
        p.attributes.interiorDefense +
        p.attributes.defensiveAwareness +
        p.attributes.defensiveRebounding +
        p.attributes.stealRating +
        p.attributes.blockRating) /
      6;
    return sum + defense;
  }, 0) / topPlayers.length;

  // Use actual game performance if available
  const teamGames = games.filter((g) => g.played && (g.homeTeamId === team.id || g.awayTeamId === team.id));

  if (teamGames.length >= 5) {
    // Use actual points allowed per game (inverse)
    let totalPointsAllowed = 0;
    teamGames.forEach((game) => {
      const isHome = game.homeTeamId === team.id;
      totalPointsAllowed += isHome ? game.awayScore : game.homeScore;
    });
    const avgPointsAllowed = totalPointsAllowed / teamGames.length;

    // Scale: 95 PPG allowed = 80, 105 PPG = 65, 115+ PPG = 40 (lower allowed = better defense)
    const gameScore = 140 - avgPointsAllowed * 0.7;

    // Blend attribute-based and game-based scores
    return Math.min(99, Math.max(1, avgDefense * 0.4 + gameScore * 0.6));
  }

  // No games yet, use attributes only
  return Math.min(99, Math.max(1, avgDefense));
}

/**
 * Calculate strength of schedule score
 */
export function calculateStrengthOfSchedule(team: Team, teams: Team[], games: Game[]): number {
  const teamGames = games.filter((g) => (g.homeTeamId === team.id || g.awayTeamId === team.id));

  if (teamGames.length === 0) {
    return 50; // Neutral for pre-season
  }

  let totalOpponentWinPct = 0;
  let opponentCount = 0;

  teamGames.forEach((game) => {
    const opponentId = game.homeTeamId === team.id ? game.awayTeamId : game.homeTeamId;
    const opponent = teams.find((t) => t.id === opponentId);

    if (opponent) {
      const totalGames = opponent.wins + opponent.losses;
      const winPct = totalGames > 0 ? opponent.wins / totalGames : 0.5;
      totalOpponentWinPct += winPct;
      opponentCount++;
    }
  });

  if (opponentCount === 0) return 50;

  const avgOpponentWinPct = totalOpponentWinPct / opponentCount;

  // Scale to 0-100: .600 opponent win% = 75, .400 = 50, .500 = 62.5
  const score = avgOpponentWinPct * 100;

  return Math.min(99, Math.max(1, score));
}

/**
 * Calculate momentum label based on recent trends
 */
export function calculateMomentum(
  recentRecord: number,
  trend: number,
  last10Record: { wins: number; losses: number }
): "Hot" | "Cold" | "Surging" | "Falling" | "Steady" {
  const winPct = last10Record.wins / (last10Record.wins + last10Record.losses || 1);

  // Surging: Moving up significantly (trend > 3) and winning
  if (trend >= 4 && recentRecord >= 65) {
    return "Surging";
  }

  // Hot: High recent win% and stable/improving
  if (winPct >= 0.7 && trend >= -1) {
    return "Hot";
  }

  // Falling: Moving down significantly
  if (trend <= -4 && recentRecord <= 55) {
    return "Falling";
  }

  // Cold: Low recent win% and not improving
  if (winPct <= 0.3 && trend <= 1) {
    return "Cold";
  }

  // Steady: Everything else
  return "Steady";
}

/**
 * Calculate power rankings for all teams
 */
export function calculatePowerRankings(
  teams: Team[],
  players: Player[],
  coaches: Coach[],
  games: Game[],
  previousRankings?: TeamPowerRanking[]
): TeamPowerRanking[] {
  const rankings: TeamPowerRanking[] = teams.map((team) => {
    const coach = coaches.find((c) => c.id === team.coachId);

    // Calculate all factors
    const teamOVR = calculateTeamOVR(team, players, coach);
    const recentRecord = calculateRecentPerformance(team, games);
    const pointDifferential = calculatePointDifferential(team, games);
    const offensiveEfficiency = calculateOffensiveEfficiency(team, players, games);
    const defensiveEfficiency = calculateDefensiveEfficiency(team, players, games);
    const strengthOfSchedule = calculateStrengthOfSchedule(team, teams, games);

    // Calculate weighted score
    const score =
      teamOVR * WEIGHTS.teamOVR +
      recentRecord * WEIGHTS.recentRecord +
      pointDifferential * WEIGHTS.pointDifferential +
      offensiveEfficiency * WEIGHTS.offensiveEfficiency +
      defensiveEfficiency * WEIGHTS.defensiveEfficiency +
      strengthOfSchedule * WEIGHTS.strengthOfSchedule;

    // Get previous rank for trend calculation
    const previousRank = previousRankings?.find((r) => r.teamId === team.id)?.rank;

    // Calculate last 10 record for momentum
    const last10Games = games
      .filter((g) => g.played && (g.homeTeamId === team.id || g.awayTeamId === team.id))
      .slice(-10);

    const last10Wins = last10Games.filter((g) => {
      const isHome = g.homeTeamId === team.id;
      const teamScore = isHome ? g.homeScore : g.awayScore;
      const oppScore = isHome ? g.awayScore : g.homeScore;
      return teamScore > oppScore;
    }).length;

    const last10Record = {
      wins: last10Wins,
      losses: last10Games.length - last10Wins,
    };

    return {
      teamId: team.id,
      rank: 0, // Will be set after sorting
      score: Math.round(score * 100) / 100,
      previousRank,
      factors: {
        teamOVR: Math.round(teamOVR * 100) / 100,
        recentRecord: Math.round(recentRecord * 100) / 100,
        pointDifferential: Math.round(pointDifferential * 100) / 100,
        offensiveEfficiency: Math.round(offensiveEfficiency * 100) / 100,
        defensiveEfficiency: Math.round(defensiveEfficiency * 100) / 100,
        strengthOfSchedule: Math.round(strengthOfSchedule * 100) / 100,
      },
      momentum: "Steady",
      trend: 0,
    };
  });

  // Sort by score (highest first) and assign ranks
  rankings.sort((a, b) => b.score - a.score);
  rankings.forEach((ranking, index) => {
    ranking.rank = index + 1;
    ranking.trend = ranking.previousRank ? ranking.previousRank - ranking.rank : 0;

    // Calculate momentum
    const last10Games = games
      .filter((g) => g.played && (g.homeTeamId === ranking.teamId || g.awayTeamId === ranking.teamId))
      .slice(-10);

    const last10Wins = last10Games.filter((g) => {
      const isHome = g.homeTeamId === ranking.teamId;
      const teamScore = isHome ? g.homeScore : g.awayScore;
      const oppScore = isHome ? g.awayScore : g.homeScore;
      return teamScore > oppScore;
    }).length;

    ranking.momentum = calculateMomentum(
      ranking.factors.recentRecord,
      ranking.trend,
      { wins: last10Wins, losses: last10Games.length - last10Wins }
    );
  });

  return rankings;
}

/**
 * Get team's power ranking
 */
export function getTeamPowerRanking(
  teamId: string,
  powerRankings: TeamPowerRanking[]
): TeamPowerRanking | undefined {
  return powerRankings.find((r) => r.teamId === teamId);
}

/**
 * Get color for momentum label
 */
export function getMomentumColor(momentum: "Hot" | "Cold" | "Surging" | "Falling" | "Steady"): string {
  switch (momentum) {
    case "Hot":
      return "#ef4444"; // red-500
    case "Surging":
      return "#f97316"; // orange-500
    case "Cold":
      return "#3b82f6"; // blue-500
    case "Falling":
      return "#6366f1"; // indigo-500
    case "Steady":
    default:
      return "#9ca3af"; // gray-400
  }
}
