import { RivalryData, RivalryLevel, RivalryEvent, Game, Player } from "../types/basketball";

/**
 * Calculate rivalry points based on factors
 * Points determine the rivalry level (0-100 scale)
 */
export function calculateRivalryPoints(factors: RivalryData["factors"]): number {
  let points = 0;

  // Regular Season Interaction
  points += factors.closeGames * 3; // Close games (≤5 pts)
  points += factors.blowouts * 5; // Blowouts (20+ pts) - now increase rivalry
  points += factors.bigPerformances * 4; // 50+ point performances
  points += factors.physicalGames * 3; // Physical/intense games

  // Playoff Interaction (most important)
  points += factors.playoffMeetings * 15; // Meeting in playoffs
  points += factors.sevenGameSeries * 25; // 7-game series
  points += factors.majorUpsets * 30; // Major upsets
  points += factors.repeatedPlayoffMatchups * 10; // Consecutive years
  points += factors.lastSecondWins * 5; // Game-winning shots

  // Star Player Drama
  points += factors.starPlayerMoves * 10; // Star leaves to join rival
  points += factors.tradeRequests * 10; // Demands trade to/from team
  points += factors.playerConflicts * 5; // Player-on-player drama
  points += factors.dirtyFouls * 10; // Injury-causing fouls

  // Trade & GM Conflict
  points += factors.trades * 10; // Controversial trades
  points += factors.failedNegotiations * 5; // Failed GM negotiations

  return Math.min(100, Math.max(0, points));
}

/**
 * Determine rivalry level based on points (0-100 scale)
 */
export function getRivalryLevel(points: number): RivalryLevel {
  if (points >= 80) return "red-hot";    // 80-100
  if (points >= 60) return "hot";        // 60-79
  if (points >= 40) return "warm";       // 40-59
  if (points >= 20) return "cold";       // 20-39
  return "ice-cold";                     // 0-19
}

/**
 * Get display text for rivalry level
 */
export function getRivalryDisplayText(level: RivalryLevel): string {
  switch (level) {
    case "red-hot":
      return "Red Hot";
    case "hot":
      return "Hot";
    case "warm":
      return "Warm";
    case "cold":
      return "Cold";
    case "ice-cold":
      return "Ice Cold";
  }
}

/**
 * Get color class for rivalry level
 */
export function getRivalryColor(level: RivalryLevel): string {
  switch (level) {
    case "red-hot":
      return "bg-red-600";
    case "hot":
      return "bg-orange-600";
    case "warm":
      return "bg-yellow-600";
    case "cold":
      return "bg-blue-600";
    case "ice-cold":
      return "bg-gray-600";
  }
}

/**
 * Get text color class for rivalry level
 */
export function getRivalryTextColor(level: RivalryLevel): string {
  switch (level) {
    case "red-hot":
      return "text-red-400";
    case "hot":
      return "text-orange-400";
    case "warm":
      return "text-yellow-400";
    case "cold":
      return "text-blue-400";
    case "ice-cold":
      return "text-gray-400";
  }
}

/**
 * Find or create rivalry data between two teams
 */
export function getRivalryBetweenTeams(
  rivalries: RivalryData[] | undefined,
  teamAId: string,
  teamBId: string
): RivalryData | null {
  if (!rivalries || !Array.isArray(rivalries)) {
    return null;
  }

  return (
    rivalries.find(
      (r) =>
        (r.teamAId === teamAId && r.teamBId === teamBId) ||
        (r.teamAId === teamBId && r.teamBId === teamAId)
    ) || null
  );
}

/**
 * Create a new rivalry between two teams
 */
export function createRivalry(teamAId: string, teamBId: string): RivalryData {
  return {
    teamAId,
    teamBId,
    level: "ice-cold",
    points: 0,
    lastUpdated: new Date().toISOString(),
    lastInteraction: new Date().toISOString(),
    seasonsSincePlayoff: 0,
    factors: {
      // Regular Season
      closeGames: 0,
      blowouts: 0,
      bigPerformances: 0,
      physicalGames: 0,
      lastSecondWins: 0,
      // Playoffs
      playoffMeetings: 0,
      sevenGameSeries: 0,
      majorUpsets: 0,
      repeatedPlayoffMatchups: 0,
      // Star Player Drama
      starPlayerMoves: 0,
      tradeRequests: 0,
      playerConflicts: 0,
      dirtyFouls: 0,
      // Trade & GM
      trades: 0,
      failedNegotiations: 0,
    },
    history: [],
  };
}

/**
 * Update rivalry based on a game result
 */
export function updateRivalryFromGame(
  rivalry: RivalryData,
  game: Game
): RivalryData {
  const updatedFactors = { ...rivalry.factors };
  const scoreDiff = Math.abs(game.homeScore - game.awayScore);

  // Check if it was a close game (5 points or less)
  if (scoreDiff <= 5 && game.wasCloseGame !== false) {
    updatedFactors.closeGames += 1;
  }

  // Check if it was a blowout (20+ points)
  if (scoreDiff >= 20) {
    updatedFactors.blowouts += 1;
  }

  // Check for big performance
  if (game.hadBigPerformance) {
    updatedFactors.bigPerformances += 1;
  }

  // Check for physical game
  if (game.wasPhysical) {
    updatedFactors.physicalGames += 1;
  }

  const newPoints = calculateRivalryPoints(updatedFactors);
  const newLevel = getRivalryLevel(newPoints);

  return {
    ...rivalry,
    factors: updatedFactors,
    points: newPoints,
    level: newLevel,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Update rivalry when a trade happens between teams
 */
export function updateRivalryFromTrade(rivalry: RivalryData, playerOverall?: number): RivalryData {
  const updatedFactors = {
    ...rivalry.factors,
    trades: rivalry.factors.trades + 1,
  };

  // If it's a star player (85+), add extra drama
  if (playerOverall && playerOverall >= 85) {
    updatedFactors.starPlayerMoves += 1;
  }

  const newPoints = calculateRivalryPoints(updatedFactors);
  const newLevel = getRivalryLevel(newPoints);

  return {
    ...rivalry,
    factors: updatedFactors,
    points: newPoints,
    level: newLevel,
    lastUpdated: new Date().toISOString(),
    lastInteraction: new Date().toISOString(),
  };
}

/**
 * Cool down rivalry over time (call this at season end)
 */
export function coolRivalry(rivalry: RivalryData, seasonsWithoutPlayoff: number, bothNonContenders: boolean): RivalryData {
  let pointsReduction = 0;

  // Decrease rivalry if teams don't meet in playoffs
  if (seasonsWithoutPlayoff >= 3) {
    pointsReduction += 10;
  }

  // Decrease if both teams are non-contenders
  if (bothNonContenders) {
    pointsReduction += 5 * Math.min(seasonsWithoutPlayoff, 3);
  }

  const newPoints = Math.max(0, rivalry.points - pointsReduction);
  const newLevel = getRivalryLevel(newPoints);

  return {
    ...rivalry,
    points: newPoints,
    level: newLevel,
    seasonsSincePlayoff: seasonsWithoutPlayoff,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get rivalry modifier for game simulation
 * Returns a multiplier for intensity, fouls, and clutch volatility
 */
export function getRivalryGameModifiers(level: RivalryLevel): {
  intensityBoost: number;
  foulRateIncrease: number;
  clutchVolatility: number;
  homeCourtBoost: number;
} {
  switch (level) {
    case "red-hot":
      return {
        intensityBoost: 1.15, // 15% intensity boost for competitive players
        foulRateIncrease: 1.25, // 25% more fouls
        clutchVolatility: 1.3, // 30% more volatile clutch moments
        homeCourtBoost: 1.1, // 10% stronger home court advantage
      };
    case "hot":
      return {
        intensityBoost: 1.1,
        foulRateIncrease: 1.15,
        clutchVolatility: 1.2,
        homeCourtBoost: 1.07,
      };
    case "warm":
      return {
        intensityBoost: 1.05,
        foulRateIncrease: 1.08,
        clutchVolatility: 1.1,
        homeCourtBoost: 1.05,
      };
    case "cold":
      return {
        intensityBoost: 1.02,
        foulRateIncrease: 1.03,
        clutchVolatility: 1.05,
        homeCourtBoost: 1.02,
      };
    case "ice-cold":
    default:
      return {
        intensityBoost: 1.0,
        foulRateIncrease: 1.0,
        clutchVolatility: 1.0,
        homeCourtBoost: 1.0,
      };
  }
}

/**
 * Get trade difficulty modifier based on rivalry level
 * Returns a value that affects trade acceptance (higher = harder to trade)
 */
export function getRivalryTradeModifier(level: RivalryLevel): number {
  switch (level) {
    case "red-hot":
      return 0.3; // 70% harder to accept trades (30% acceptance rate)
    case "hot":
      return 0.5; // 50% harder
    case "warm":
      return 0.7; // 30% harder
    case "cold":
      return 0.85; // 15% harder
    case "ice-cold":
    default:
      return 1.0; // No penalty
  }
}

/**
 * Check if teams should refuse trade entirely (Red Hot rivalry)
 */
export function shouldRefuseTrade(level: RivalryLevel, tradeValue: number): boolean {
  // Red Hot rivalries refuse unless trade is heavily in their favor
  if (level === "red-hot" && tradeValue < 1.5) {
    return true;
  }
  return false;
}

/**
 * Get morale impact from winning/losing a rivalry game
 */
export function getRivalryMoraleImpact(level: RivalryLevel, won: boolean): number {
  const baseImpact = won ? 1 : -1;

  switch (level) {
    case "red-hot":
      return baseImpact * 8; // ±8 morale
    case "hot":
      return baseImpact * 5; // ±5 morale
    case "warm":
      return baseImpact * 3; // ±3 morale
    case "cold":
      return baseImpact * 2; // ±2 morale
    case "ice-cold":
    default:
      return 0; // No impact
  }
}

/**
 * Add rivalry event to history
 */
export function addRivalryEvent(
  rivalry: RivalryData,
  type: RivalryEvent["type"],
  description: string,
  season: number,
  impact: number
): RivalryData {
  const event: RivalryEvent = {
    id: `event-${Date.now()}-${Math.random()}`,
    type,
    description,
    season,
    date: new Date().toISOString(),
    impact,
  };

  return {
    ...rivalry,
    history: [...(rivalry.history || []), event],
  };
}
