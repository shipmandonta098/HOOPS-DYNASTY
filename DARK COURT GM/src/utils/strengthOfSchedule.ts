import { Team, Game } from "../types/basketball";

export interface SOSData {
  score: number; // 0-100
  label: "Very Easy" | "Easy" | "Average" | "Hard" | "Very Hard";
  rank: number; // 1-30
  last10OpponentsAvgOVR: number;
  next10OpponentsAvgOVR: number;
  hardestStretch?: {
    startGame: number;
    endGame: number;
    avgDifficulty: string;
  };
}

export interface TeamSOS extends SOSData {
  teamId: string;
}

/**
 * Calculate average overall rating for a team based on its players
 */
export const calculateTeamOVR = (
  team: Team,
  allPlayers: any[]
): number => {
  const teamPlayers = allPlayers.filter((p) => team.playerIds.includes(p.id));
  if (teamPlayers.length === 0) return 50;

  const totalOVR = teamPlayers.reduce((sum, player) => {
    return sum + (player.overall || 50);
  }, 0);

  return Math.round(totalOVR / teamPlayers.length);
};

/**
 * Get difficulty label from SOS score
 */
export const getSOSLabel = (
  score: number
): "Very Easy" | "Easy" | "Average" | "Hard" | "Very Hard" => {
  if (score <= 20) return "Very Easy";
  if (score <= 40) return "Easy";
  if (score <= 60) return "Average";
  if (score <= 80) return "Hard";
  return "Very Hard";
};

/**
 * Get color for SOS difficulty
 */
export const getSOSColor = (label: string): string => {
  switch (label) {
    case "Very Easy":
      return "#10b981"; // green
    case "Easy":
      return "#84cc16"; // lime
    case "Average":
      return "#facc15"; // yellow
    case "Hard":
      return "#f97316"; // orange
    case "Very Hard":
      return "#ef4444"; // red
    default:
      return "#94a3b8"; // gray
  }
};

/**
 * Calculate Strength of Schedule for a team
 */
export const calculateSOS = (
  team: Team,
  allTeams: Team[],
  allGames: Game[],
  allPlayers: any[],
  rivalryScores?: Map<string, number>
): number => {
  // Get all games for this team
  const teamGames = allGames.filter(
    (game) => game.homeTeamId === team.id || game.awayTeamId === team.id
  );

  if (teamGames.length === 0) return 50; // Default average

  let totalDifficulty = 0;
  let gameCount = 0;

  teamGames.forEach((game) => {
    // Determine opponent
    const opponentId =
      game.homeTeamId === team.id ? game.awayTeamId : game.homeTeamId;
    const opponent = allTeams.find((t) => t.id === opponentId);
    const isRoadGame = game.awayTeamId === team.id;

    if (!opponent) return;

    // Calculate opponent's win percentage
    const opponentWinPct =
      opponent.wins + opponent.losses > 0
        ? opponent.wins / (opponent.wins + opponent.losses)
        : 0.5;

    // Calculate opponent's average OVR
    const opponentOVR = calculateTeamOVR(opponent, allPlayers);

    // Base difficulty from opponent OVR (normalized to 0-50 scale)
    let gameDifficulty = (opponentOVR / 100) * 50;

    // Add difficulty from win percentage (0-25 scale)
    gameDifficulty += opponentWinPct * 25;

    // Add difficulty for road games (0-15 points)
    if (isRoadGame) {
      gameDifficulty += 15;
    }

    // Add rivalry bonus (0-10 points)
    if (rivalryScores) {
      const rivalryKey = [team.id, opponentId].sort().join("-");
      const rivalryScore = rivalryScores.get(rivalryKey) || 0;
      // Rivalry adds up to 10 points based on intensity
      gameDifficulty += Math.min(rivalryScore / 10, 10);
    }

    totalDifficulty += gameDifficulty;
    gameCount++;
  });

  // Average difficulty and normalize to 0-100 scale
  const avgDifficulty = totalDifficulty / gameCount;
  // Scale from theoretical range (0-100) to actual 0-100
  const normalizedScore = Math.max(0, Math.min(100, avgDifficulty));

  return Math.round(normalizedScore);
};

/**
 * Calculate SOS for all teams and add rankings
 */
export const calculateAllTeamsSOS = (
  teams: Team[],
  games: Game[],
  players: any[],
  rivalryScores?: Map<string, number>
): TeamSOS[] => {
  // Calculate raw SOS scores
  const teamSOSList: TeamSOS[] = teams.map((team) => {
    const score = calculateSOS(team, teams, games, players, rivalryScores);
    const label = getSOSLabel(score);

    // Calculate last 10 and next 10 opponents avg OVR
    const teamGames = games
      .filter((g) => g.homeTeamId === team.id || g.awayTeamId === team.id)
      .sort((a, b) => a.dayNumber - b.dayNumber);

    const playedGames = teamGames.filter((g) => g.played);
    const upcomingGames = teamGames.filter((g) => !g.played);

    const last10 = playedGames.slice(-10);
    const next10 = upcomingGames.slice(0, 10);

    const getLast10Avg = () => {
      if (last10.length === 0) return 0;
      const opponentOVRs = last10.map((game) => {
        const oppId =
          game.homeTeamId === team.id ? game.awayTeamId : game.homeTeamId;
        const opp = teams.find((t) => t.id === oppId);
        return opp ? calculateTeamOVR(opp, players) : 50;
      });
      return Math.round(
        opponentOVRs.reduce((a, b) => a + b, 0) / opponentOVRs.length
      );
    };

    const getNext10Avg = () => {
      if (next10.length === 0) return 0;
      const opponentOVRs = next10.map((game) => {
        const oppId =
          game.homeTeamId === team.id ? game.awayTeamId : game.homeTeamId;
        const opp = teams.find((t) => t.id === oppId);
        return opp ? calculateTeamOVR(opp, players) : 50;
      });
      return Math.round(
        opponentOVRs.reduce((a, b) => a + b, 0) / opponentOVRs.length
      );
    };

    return {
      teamId: team.id,
      score,
      label,
      rank: 0, // Will be set after sorting
      last10OpponentsAvgOVR: getLast10Avg(),
      next10OpponentsAvgOVR: getNext10Avg(),
    };
  });

  // Sort by score (highest = hardest = rank 1)
  teamSOSList.sort((a, b) => b.score - a.score);

  // Assign ranks
  teamSOSList.forEach((sos, index) => {
    sos.rank = index + 1;
  });

  return teamSOSList;
};

/**
 * Find danger stretches (3+ consecutive Hard/Very Hard games)
 */
export const findDangerStretches = (
  teamId: string,
  games: Game[],
  teams: Team[],
  players: any[]
): Array<{ startGame: number; endGame: number; gameCount: number }> => {
  const teamGames = games
    .filter((g) => g.homeTeamId === teamId || g.awayTeamId === teamId)
    .filter((g) => !g.played)
    .sort((a, b) => a.dayNumber - b.dayNumber);

  const difficulties = teamGames.map((game) => {
    const oppId = game.homeTeamId === teamId ? game.awayTeamId : game.homeTeamId;
    const opponent = teams.find((t) => t.id === oppId);
    if (!opponent) return 50;

    const oppOVR = calculateTeamOVR(opponent, players);
    const oppWinPct =
      opponent.wins + opponent.losses > 0
        ? opponent.wins / (opponent.wins + opponent.losses)
        : 0.5;

    // Simple difficulty score
    const difficulty = (oppOVR / 100) * 50 + oppWinPct * 50;
    return difficulty;
  });

  const dangerStretches: Array<{
    startGame: number;
    endGame: number;
    gameCount: number;
  }> = [];

  let stretchStart = -1;
  let stretchCount = 0;

  difficulties.forEach((diff, index) => {
    const isHard = diff >= 61; // Hard or Very Hard threshold

    if (isHard) {
      if (stretchStart === -1) {
        stretchStart = index;
        stretchCount = 1;
      } else {
        stretchCount++;
      }
    } else {
      if (stretchStart !== -1 && stretchCount >= 3) {
        dangerStretches.push({
          startGame: stretchStart,
          endGame: stretchStart + stretchCount - 1,
          gameCount: stretchCount,
        });
      }
      stretchStart = -1;
      stretchCount = 0;
    }
  });

  // Check last stretch
  if (stretchStart !== -1 && stretchCount >= 3) {
    dangerStretches.push({
      startGame: stretchStart,
      endGame: stretchStart + stretchCount - 1,
      gameCount: stretchCount,
    });
  }

  return dangerStretches;
};

/**
 * Get game difficulty for a single game
 */
export const getGameDifficulty = (
  game: Game,
  teamId: string,
  teams: Team[],
  players: any[]
): { score: number; label: string; opponentOVR: number } => {
  const oppId = game.homeTeamId === teamId ? game.awayTeamId : game.homeTeamId;
  const opponent = teams.find((t) => t.id === oppId);

  if (!opponent) {
    return { score: 50, label: "Average", opponentOVR: 50 };
  }

  const opponentOVR = calculateTeamOVR(opponent, players);
  const oppWinPct =
    opponent.wins + opponent.losses > 0
      ? opponent.wins / (opponent.wins + opponent.losses)
      : 0.5;

  // Calculate difficulty (0-100)
  let difficulty = (opponentOVR / 100) * 60 + oppWinPct * 40;

  const label = getSOSLabel(difficulty);

  return {
    score: Math.round(difficulty),
    label,
    opponentOVR,
  };
};
