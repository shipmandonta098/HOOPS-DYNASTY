import { NewsStory, NewsCategory, NewsStoryType, Player, Team, Coach, RivalryData } from "../types/basketball";

// Helper to generate unique ID
const generateId = () => `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Get category icon
export const getCategoryIcon = (category: NewsCategory): string => {
  switch (category) {
    case "rumor":
      return "chatbubbles";
    case "official_announcement":
      return "megaphone";
    case "player_mood":
      return "person";
    case "trade_request":
      return "alert-circle";
    case "league_buzz":
      return "trending-up";
    case "analytics":
      return "stats-chart";
    case "injury_report":
      return "medical";
    case "rivalry_update":
      return "flame";
    default:
      return "newspaper";
  }
};

// Get category color
export const getCategoryColor = (category: NewsCategory): string => {
  switch (category) {
    case "rumor":
      return "bg-purple-600";
    case "official_announcement":
      return "bg-blue-600";
    case "player_mood":
      return "bg-orange-600";
    case "trade_request":
      return "bg-red-600";
    case "league_buzz":
      return "bg-green-600";
    case "analytics":
      return "bg-cyan-600";
    case "injury_report":
      return "bg-yellow-600";
    case "rivalry_update":
      return "bg-pink-600";
    default:
      return "bg-gray-600";
  }
};

// Get category label
export const getCategoryLabel = (category: NewsCategory): string => {
  switch (category) {
    case "rumor":
      return "Rumor";
    case "official_announcement":
      return "Official";
    case "player_mood":
      return "Player Mood";
    case "trade_request":
      return "Trade Request";
    case "league_buzz":
      return "League Buzz";
    case "analytics":
      return "Analytics";
    case "injury_report":
      return "Injury";
    case "rivalry_update":
      return "Rivalry";
    default:
      return "News";
  }
};

// News generators for different events
export const generatePlayerMoodStory = (
  player: Player,
  team: Team,
  moodType: "unhappy_role" | "unhappy_performance" | "frustrated_team" | "thrilled_minutes" | "happy_winning",
  season: number,
  dayNumber: number
): NewsStory => {
  let headline = "";
  let description = "";
  let type: NewsStoryType;
  let priority = 5;

  switch (moodType) {
    case "unhappy_role":
      type = "player_unhappy_role";
      headline = `${player.name} Unhappy with Role`;
      description = `Sources close to ${player.name} say the ${player.position} is frustrated with limited playing time for the ${team.city} ${team.name}.`;
      priority = player.overall > 80 ? 8 : 6;
      break;
    case "unhappy_performance":
      type = "player_unhappy_performance";
      headline = `${player.name} Frustrated with Personal Performance`;
      description = `${player.name} has expressed disappointment with recent struggles on the court.`;
      priority = 4;
      break;
    case "frustrated_team":
      type = "player_frustrated_team";
      headline = `${player.name} Frustrated with Team Performance`;
      description = `${player.name} is reportedly unhappy with the ${team.city} ${team.name} (${team.wins}-${team.losses}) and their current direction.`;
      priority = player.overall > 80 ? 9 : 7;
      break;
    case "thrilled_minutes":
      type = "player_thrilled_minutes";
      headline = `${player.name} Thrilled with Increased Role`;
      description = `${player.name} has been given more playing time and is reportedly excited about the opportunity to contribute more for ${team.city}.`;
      priority = 3;
      break;
    case "happy_winning":
      type = "player_happy_winning";
      headline = `${player.name} Loving Life in ${team.city}`;
      description = `With the ${team.name} rolling at ${team.wins}-${team.losses}, ${player.name} couldn't be happier with the team's success.`;
      priority = 2;
      break;
  }

  return {
    id: generateId(),
    category: "player_mood",
    type,
    timestamp: new Date().toISOString(),
    season,
    dayNumber,
    headline,
    description,
    priority,
    playerId: player.id,
    teamId: team.id,
  };
};

export const generateTradeRequestStory = (
  player: Player,
  team: Team,
  isWithdrawing: boolean,
  season: number,
  dayNumber: number
): NewsStory => {
  if (isWithdrawing) {
    return {
      id: generateId(),
      category: "trade_request",
      type: "trade_request_withdrawn",
      timestamp: new Date().toISOString(),
      season,
      dayNumber,
      headline: `${player.name} Withdraws Trade Request`,
      description: `${player.name} has officially withdrawn his trade request from the ${team.city} ${team.name} and is committed to the team going forward.`,
      isBreaking: true,
      priority: 9,
      playerId: player.id,
      teamId: team.id,
    };
  }

  return {
    id: generateId(),
    category: "trade_request",
    type: "trade_request_made",
    timestamp: new Date().toISOString(),
    season,
    dayNumber,
    headline: `BREAKING: ${player.name} Requests Trade`,
    description: `In a shocking development, ${player.name} has officially requested a trade from the ${team.city} ${team.name}.`,
    detailedContent: `Sources confirm that ${player.name}, a ${player.overall} overall ${player.position}, has formally asked the ${team.name} front office to explore trade options. The ${team.wins}-${team.losses} team now faces a difficult decision moving forward.`,
    isBreaking: true,
    priority: 10,
    playerId: player.id,
    teamId: team.id,
  };
};

export const generateTradeAnnouncementStory = (
  teamA: Team,
  teamB: Team,
  playersToA: Player[],
  playersToB: Player[],
  season: number,
  dayNumber: number
): NewsStory => {
  const majorPlayers = [...playersToA, ...playersToB].filter((p) => p.overall > 80);
  const isBlockbuster = majorPlayers.length > 0;

  const playersANames = playersToA.map((p) => p.name).join(", ");
  const playersBNames = playersToB.map((p) => p.name).join(", ");

  return {
    id: generateId(),
    category: "official_announcement",
    type: "trade_announcement",
    timestamp: new Date().toISOString(),
    season,
    dayNumber,
    headline: isBlockbuster
      ? `BLOCKBUSTER: ${teamA.city} and ${teamB.city} Complete Major Trade`
      : `${teamA.city} and ${teamB.city} Complete Trade`,
    description: `The ${teamA.city} ${teamA.name} have acquired ${playersANames} from ${teamB.city} in exchange for ${playersBNames}.`,
    detailedContent: `OFFICIAL: ${teamA.city} receives ${playersANames}. ${teamB.city} receives ${playersBNames}.`,
    isBreaking: isBlockbuster,
    priority: isBlockbuster ? 10 : 7,
    teamId: teamA.id,
    relatedTeamId: teamB.id,
  };
};

export const generateSigningAnnouncementStory = (
  player: Player,
  team: Team,
  years: number,
  salary: number,
  season: number,
  dayNumber: number
): NewsStory => {
  const isBigSigning = player.overall > 85 || salary > 30;

  return {
    id: generateId(),
    category: "official_announcement",
    type: "signing_announcement",
    timestamp: new Date().toISOString(),
    season,
    dayNumber,
    headline: isBigSigning
      ? `BREAKING: ${team.city} Signs ${player.name}`
      : `${team.city} Signs ${player.name}`,
    description: `The ${team.city} ${team.name} have signed ${player.position} ${player.name} to a ${years}-year, $${salary}M contract.`,
    isBreaking: isBigSigning,
    priority: isBigSigning ? 9 : 6,
    playerId: player.id,
    teamId: team.id,
  };
};

export const generateExtensionAnnouncementStory = (
  player: Player,
  team: Team,
  years: number,
  salary: number,
  season: number,
  dayNumber: number
): NewsStory => {
  const isSupermax = salary > 40;

  return {
    id: generateId(),
    category: "official_announcement",
    type: "extension_announcement",
    timestamp: new Date().toISOString(),
    season,
    dayNumber,
    headline: isSupermax
      ? `${player.name} Signs Supermax Extension with ${team.city}`
      : `${player.name} Extends with ${team.city}`,
    description: `${player.name} has agreed to a ${years}-year, $${salary}M contract extension to remain with the ${team.city} ${team.name}.`,
    isBreaking: isSupermax,
    priority: isSupermax ? 9 : 7,
    playerId: player.id,
    teamId: team.id,
  };
};

export const generateCoachingChangeStory = (
  coach: Coach,
  team: Team,
  isFiring: boolean,
  season: number,
  dayNumber: number
): NewsStory => {
  if (isFiring) {
    return {
      id: generateId(),
      category: "official_announcement",
      type: "firing_announcement",
      timestamp: new Date().toISOString(),
      season,
      dayNumber,
      headline: `${team.city} Fires Head Coach ${coach.name}`,
      description: `The ${team.city} ${team.name} have relieved ${coach.name} of his coaching duties. The team is ${team.wins}-${team.losses} this season.`,
      isBreaking: true,
      priority: 9,
      coachId: coach.id,
      teamId: team.id,
    };
  }

  return {
    id: generateId(),
    category: "official_announcement",
    type: "hiring_announcement",
    timestamp: new Date().toISOString(),
    season,
    dayNumber,
    headline: `${team.city} Hires ${coach.name} as Head Coach`,
    description: `The ${team.city} ${team.name} have named ${coach.name} as their new head coach.`,
    isBreaking: true,
    priority: 8,
    coachId: coach.id,
    teamId: team.id,
  };
};

export const generateWinningStreakStory = (
  team: Team,
  streakLength: number,
  season: number,
  dayNumber: number
): NewsStory => {
  const isImposing = streakLength >= 10;

  return {
    id: generateId(),
    category: "league_buzz",
    type: "winning_streak",
    timestamp: new Date().toISOString(),
    season,
    dayNumber,
    headline: isImposing
      ? `${team.city} on Fire with ${streakLength}-Game Win Streak`
      : `${team.city} Wins ${streakLength} Straight`,
    description: `The ${team.city} ${team.name} have won ${streakLength} consecutive games and are now ${team.wins}-${team.losses} on the season.`,
    priority: isImposing ? 8 : 5,
    teamId: team.id,
  };
};

export const generateLosingStreakStory = (
  team: Team,
  streakLength: number,
  season: number,
  dayNumber: number
): NewsStory => {
  const isCatastrophic = streakLength >= 10;

  return {
    id: generateId(),
    category: "league_buzz",
    type: "losing_streak",
    timestamp: new Date().toISOString(),
    season,
    dayNumber,
    headline: isCatastrophic
      ? `${team.city} in Freefall: ${streakLength}-Game Losing Streak`
      : `${team.city} Drops ${streakLength} Straight`,
    description: `The ${team.city} ${team.name} have now lost ${streakLength} consecutive games, falling to ${team.wins}-${team.losses}.`,
    priority: isCatastrophic ? 8 : 5,
    teamId: team.id,
  };
};

export const generateRivalryStory = (
  rivalry: RivalryData,
  teamA: Team,
  teamB: Team,
  season: number,
  dayNumber: number
): NewsStory => {
  return {
    id: generateId(),
    category: "rivalry_update",
    type: "rivalry_heating_up",
    timestamp: new Date().toISOString(),
    season,
    dayNumber,
    headline: `${teamA.city}-${teamB.city} Rivalry Intensifies`,
    description: `The rivalry between the ${teamA.city} ${teamA.name} and ${teamB.city} ${teamB.name} is heating up. Insiders say tensions are high between these two squads.`,
    priority: rivalry.level === "red-hot" ? 8 : 6,
    teamId: teamA.id,
    relatedTeamId: teamB.id,
  };
};

export const generateRumorStory = (
  player: Player | undefined,
  team: Team,
  rumorType: "player_interest" | "trade_exploration",
  season: number,
  dayNumber: number
): NewsStory => {
  if (rumorType === "player_interest" && player) {
    return {
      id: generateId(),
      category: "rumor",
      type: "player_interest_rumor",
      timestamp: new Date().toISOString(),
      season,
      dayNumber,
      headline: `Sources: ${player.name} and ${team.city} Have Mutual Interest`,
      description: `League sources indicate that free agent ${player.name} has mutual interest with the ${team.city} ${team.name}.`,
      priority: player.overall > 85 ? 7 : 4,
      playerId: player.id,
      teamId: team.id,
    };
  }

  return {
    id: generateId(),
    category: "rumor",
    type: "trade_exploration_rumor",
    timestamp: new Date().toISOString(),
    season,
    dayNumber,
    headline: `League Insiders: ${team.city} Exploring Trades`,
    description: `Sources say the ${team.city} ${team.name} front office is actively exploring trade possibilities ahead of the deadline.`,
    priority: 5,
    teamId: team.id,
  };
};

export const generatePowerRankingsStory = (
  topTeams: Array<{ team: Team; rank: number }>,
  season: number,
  dayNumber: number
): NewsStory => {
  const top3 = topTeams.slice(0, 3);
  const teamList = top3.map((t) => `${t.rank}. ${t.team.city} (${t.team.wins}-${t.team.losses})`).join(", ");

  return {
    id: generateId(),
    category: "analytics",
    type: "power_rankings",
    timestamp: new Date().toISOString(),
    season,
    dayNumber,
    headline: "Power Rankings Update",
    description: `This week's top 3: ${teamList}`,
    priority: 4,
  };
};
