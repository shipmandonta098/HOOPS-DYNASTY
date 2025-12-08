import { Player, Team } from "../types/basketball";

export type PlayType =
  | "shot_made"
  | "shot_missed"
  | "three_made"
  | "three_missed"
  | "free_throw_made"
  | "free_throw_missed"
  | "rebound"
  | "assist"
  | "steal"
  | "block"
  | "turnover"
  | "foul"
  | "timeout"
  | "quarter_end"
  | "game_end";

export interface Play {
  id: string;
  quarter: number;
  time: string;
  playType: PlayType;
  description: string;
  player?: Player;
  assistPlayer?: Player;
  team: Team;
  homeScore: number;
  awayScore: number;
}

export interface QuarterStats {
  quarter: number;
  homeScore: number;
  awayScore: number;
}

export interface LiveGameState {
  plays: Play[];
  currentQuarter: number;
  timeRemaining: number;
  homeScore: number;
  awayScore: number;
  quarterStats: QuarterStats[];
  isFinished: boolean;
}

// Get weighted random player based on their overall rating
function getWeightedPlayer(players: Player[]): Player {
  const weights = players.map((p) => Math.pow(p.overall, 2));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < players.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return players[i];
    }
  }

  return players[0];
}

// Get shooter based on position and shooting attributes
function getShooter(players: Player[]): Player {
  const shooters = players.filter((p) => ["PG", "SG", "SF"].includes(p.position));
  return getWeightedPlayer(shooters.length > 0 ? shooters : players);
}

// Get rebounder based on position
function getRebounder(players: Player[]): Player {
  const rebounders = players.filter((p) => ["PF", "C"].includes(p.position));
  return getWeightedPlayer(rebounders.length > 0 ? rebounders : players);
}

// Format time (seconds to MM:SS)
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

// Generate a single play
function generatePlay(
  homeTeam: Team,
  awayTeam: Team,
  homePlayers: Player[],
  awayPlayers: Player[],
  currentState: {
    quarter: number;
    time: number;
    homeScore: number;
    awayScore: number;
    possession: "home" | "away";
  }
): { play: Play; newState: typeof currentState } {
  const offenseTeam = currentState.possession === "home" ? homeTeam : awayTeam;
  const defenseTeam = currentState.possession === "home" ? awayTeam : homeTeam;
  const offensePlayers = currentState.possession === "home" ? homePlayers : awayPlayers;
  const defensePlayers = currentState.possession === "home" ? awayPlayers : homePlayers;

  let playType: PlayType;
  let description: string;
  let player: Player | undefined;
  let assistPlayer: Player | undefined;
  let pointsScored = 0;
  let switchPossession = false;

  const rand = Math.random();

  // Determine play outcome
  if (rand < 0.05) {
    // 5% - Turnover
    playType = "turnover";
    player = getWeightedPlayer(offensePlayers);
    const stealPlayer = getWeightedPlayer(defensePlayers);
    description = `${player.name} turns the ball over! Stolen by ${stealPlayer.name}`;
    switchPossession = true;
  } else if (rand < 0.10) {
    // 5% - Foul
    playType = "foul";
    player = getWeightedPlayer(defensePlayers);
    const fouledPlayer = getShooter(offensePlayers);
    description = `Foul on ${player.name} while defending ${fouledPlayer.name}`;

    // Free throws
    const ftMade = Math.random() < 0.75 ? 2 : Math.random() < 0.5 ? 1 : 0;
    if (ftMade > 0) {
      pointsScored = ftMade;
      description += `. ${fouledPlayer.name} makes ${ftMade}/2 free throws`;
    } else {
      description += `. ${fouledPlayer.name} misses both free throws`;
    }
    switchPossession = true;
  } else if (rand < 0.25) {
    // 15% - Three pointer attempt
    player = getShooter(offensePlayers);
    const shootingSkill = player.overall / 100;
    const made = Math.random() < shootingSkill * 0.35;

    if (made) {
      playType = "three_made";
      pointsScored = 3;
      if (Math.random() < 0.6) {
        assistPlayer = getWeightedPlayer(offensePlayers.filter((p) => p.id !== player?.id));
        description = `${player.name} drains a three-pointer! Assisted by ${assistPlayer.name}`;
      } else {
        description = `${player.name} hits a three-pointer!`;
      }
      switchPossession = true;
    } else {
      playType = "three_missed";
      description = `${player.name} misses the three-point attempt`;

      // Rebound
      const reboundPlayer = Math.random() < 0.7 ? getRebounder(defensePlayers) : getRebounder(offensePlayers);
      description += `. Rebound ${reboundPlayer.name}`;
      switchPossession = defensePlayers.includes(reboundPlayer);
    }
  } else {
    // 75% - Two pointer attempt
    player = getShooter(offensePlayers);
    const shootingSkill = player.overall / 100;
    const made = Math.random() < shootingSkill * 0.48;

    if (made) {
      playType = "shot_made";
      pointsScored = 2;

      // Block chance
      if (Math.random() < 0.05) {
        const blockPlayer = getRebounder(defensePlayers);
        description = `${player.name} scores on a contested layup! ${blockPlayer.name} nearly blocked it`;
      } else if (Math.random() < 0.5) {
        assistPlayer = getWeightedPlayer(offensePlayers.filter((p) => p.id !== player?.id));
        description = `${player.name} makes the shot! Assisted by ${assistPlayer.name}`;
      } else {
        description = `${player.name} scores!`;
      }
      switchPossession = true;
    } else {
      playType = "shot_missed";

      // Block chance
      if (Math.random() < 0.08) {
        const blockPlayer = getRebounder(defensePlayers);
        description = `${player.name} is blocked by ${blockPlayer.name}!`;
      } else {
        description = `${player.name} misses the shot`;
      }

      // Rebound
      const reboundPlayer = Math.random() < 0.7 ? getRebounder(defensePlayers) : getRebounder(offensePlayers);
      description += `. Rebound ${reboundPlayer.name}`;
      switchPossession = defensePlayers.includes(reboundPlayer);
    }
  }

  // Update scores
  const newHomeScore = currentState.homeScore + (currentState.possession === "home" ? pointsScored : 0);
  const newAwayScore = currentState.awayScore + (currentState.possession === "away" ? pointsScored : 0);

  // Create play object
  const play: Play = {
    id: `${currentState.quarter}-${currentState.time}-${Math.random()}`,
    quarter: currentState.quarter,
    time: formatTime(currentState.time),
    playType,
    description,
    player,
    assistPlayer,
    team: offenseTeam,
    homeScore: newHomeScore,
    awayScore: newAwayScore,
  };

  // Update state
  const newState = {
    ...currentState,
    time: Math.max(0, currentState.time - Math.floor(Math.random() * 15 + 10)), // 10-25 seconds per play
    homeScore: newHomeScore,
    awayScore: newAwayScore,
    possession: switchPossession
      ? currentState.possession === "home"
        ? ("away" as const)
        : ("home" as const)
      : currentState.possession,
  };

  return { play, newState };
}

// Simulate entire game and return all plays
export function simulateGamePlayByPlay(
  homeTeam: Team,
  awayTeam: Team,
  homePlayers: Player[],
  awayPlayers: Player[]
): LiveGameState {
  const plays: Play[] = [];
  const quarterStats: QuarterStats[] = [];

  let currentState = {
    quarter: 1,
    time: 12 * 60, // 12 minutes in seconds
    homeScore: 0,
    awayScore: 0,
    possession: Math.random() < 0.5 ? ("home" as const) : ("away" as const),
  };

  // Simulate 4 quarters
  for (let quarter = 1; quarter <= 4; quarter++) {
    currentState.quarter = quarter;
    currentState.time = 12 * 60;

    const quarterStartHome = currentState.homeScore;
    const quarterStartAway = currentState.awayScore;

    // Generate plays until quarter ends
    while (currentState.time > 0) {
      const { play, newState } = generatePlay(
        homeTeam,
        awayTeam,
        homePlayers,
        awayPlayers,
        currentState
      );

      plays.push(play);
      currentState = newState;
    }

    // Add quarter end play
    plays.push({
      id: `q${quarter}-end`,
      quarter,
      time: "0:00",
      playType: "quarter_end",
      description: `End of Quarter ${quarter}`,
      team: homeTeam,
      homeScore: currentState.homeScore,
      awayScore: currentState.awayScore,
    });

    quarterStats.push({
      quarter,
      homeScore: currentState.homeScore - quarterStartHome,
      awayScore: currentState.awayScore - quarterStartAway,
    });
  }

  // Add game end play
  plays.push({
    id: "game-end",
    quarter: 4,
    time: "0:00",
    playType: "game_end",
    description: "Final",
    team: homeTeam,
    homeScore: currentState.homeScore,
    awayScore: currentState.awayScore,
  });

  return {
    plays,
    currentQuarter: 4,
    timeRemaining: 0,
    homeScore: currentState.homeScore,
    awayScore: currentState.awayScore,
    quarterStats,
    isFinished: true,
  };
}

// Generate plays incrementally for live simulation
export function generateNextPlay(
  homeTeam: Team,
  awayTeam: Team,
  homePlayers: Player[],
  awayPlayers: Player[],
  currentState: {
    quarter: number;
    time: number;
    homeScore: number;
    awayScore: number;
    possession: "home" | "away";
  }
): { play: Play; newState: typeof currentState; quarterEnded: boolean; gameEnded: boolean; timeElapsed: number } {
  // Check if quarter should end
  if (currentState.time <= 0) {
    if (currentState.quarter >= 4) {
      // Game over
      const play: Play = {
        id: "game-end",
        quarter: currentState.quarter,
        time: "0:00",
        playType: "game_end",
        description: "Final",
        team: homeTeam,
        homeScore: currentState.homeScore,
        awayScore: currentState.awayScore,
      };
      return { play, newState: currentState, quarterEnded: false, gameEnded: true, timeElapsed: 0 };
    } else {
      // Quarter end
      const play: Play = {
        id: `q${currentState.quarter}-end`,
        quarter: currentState.quarter,
        time: "0:00",
        playType: "quarter_end",
        description: `End of Quarter ${currentState.quarter}`,
        team: homeTeam,
        homeScore: currentState.homeScore,
        awayScore: currentState.awayScore,
      };

      const newState = {
        ...currentState,
        quarter: currentState.quarter + 1,
        time: 12 * 60,
        possession: Math.random() < 0.5 ? ("home" as const) : ("away" as const),
      };

      return { play, newState, quarterEnded: true, gameEnded: false, timeElapsed: 0 };
    }
  }

  const { play, newState } = generatePlay(
    homeTeam,
    awayTeam,
    homePlayers,
    awayPlayers,
    currentState
  );

  // Calculate time elapsed during this play
  const timeElapsed = currentState.time - newState.time;

  return { play, newState, quarterEnded: false, gameEnded: false, timeElapsed };
}
