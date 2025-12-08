export interface Player {
  id: string;
  name: string;
  position: "PG" | "SG" | "SF" | "PF" | "C";
  age: number;
  overall: number; // 0-99 rating
  potential: number; // 0-99 rating
  gender: "male" | "female"; // Player gender
  agentId?: string; // Reference to player's agent
  contract: {
    years: number;
    salary: number; // in millions
  };
  stats: {
    points: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
  };
  attributes: {
    // Athletic Attributes
    speed: number; // 0-100 rating
    acceleration: number; // 0-100 rating
    strength: number; // 0-100 rating
    vertical: number; // 0-100 rating
    lateralQuickness: number; // 0-100 rating
    stamina: number; // 0-100 rating
    hustle: number; // 0-100 rating

    // Offensive Attributes - Scoring
    finishing: number; // 0-100 rating
    midRangeShooting: number; // 0-100 rating
    threePointShooting: number; // 0-100 rating
    freeThrowShooting: number; // 0-100 rating
    postScoring: number; // 0-100 rating
    shotCreation: number; // 0-100 rating

    // Offensive Attributes - Playmaking
    ballHandling: number; // 0-100 rating
    passingVision: number; // 0-100 rating
    passingAccuracy: number; // 0-100 rating
    offBallMovement: number; // 0-100 rating

    // Defensive Attributes
    perimeterDefense: number; // 0-100 rating
    interiorDefense: number; // 0-100 rating
    blockRating: number; // 0-100 rating
    stealRating: number; // 0-100 rating
    defensiveRebounding: number; // 0-100 rating
    offensiveRebounding: number; // 0-100 rating
    defensiveAwareness: number; // 0-100 rating

    // Mental Attributes
    basketballIQ: number; // 0-100 rating
    consistency: number; // 0-100 rating
    workEthic: number; // 0-100 rating
    leadership: number; // 0-100 rating
    composure: number; // 0-100 rating
    discipline: number; // 0-100 rating
    clutch: number; // 0-100 rating
  };
  bio: {
    height: string; // e.g., "6'7\""
    weight: number; // in lbs
    wingspan: string; // e.g., "7'2\""
    hometown: string;
    country: string;
    countryFlag: string; // emoji flag
    college: string;
    draftYear: number;
    draftRound: number;
    draftPick: number;
    draftedBy: string; // team name
  };
  personality: {
    loyalty: number; // 0-100: How likely to stay with team (affects free agency, trade requests)
    greed: number; // 0-100: How much money matters (affects contract negotiations)
    winning: number; // 0-100: Desire to win championships (affects interest in good teams)
    playTime: number; // 0-100: Desire for minutes/role (affects satisfaction with bench role)
    teamPlayer: number; // 0-100: How well they work with others (affects team chemistry)
    workEthic: number; // 0-100: Dedication to improvement (affects development speed)
    ego: number; // 0-100: Self-importance (affects reactions to criticism, trades)
    temperament: number; // 0-100: Emotional stability (100=calm, 0=volatile, affects chemistry)
  };
  satisfaction: number; // 0-100: Current satisfaction with team/role
  teamId: string | null;
}

export interface Coach {
  id: string;
  name: string;
  age: number;
  overall: number; // 0-99 coaching rating
  experience: number; // Years of coaching experience
  gender: "male" | "female"; // Coach gender
  attributes: {
    offense: number; // 0-99: Offensive scheme effectiveness
    defense: number; // 0-99: Defensive scheme effectiveness
    playerDevelopment: number; // 0-99: Ability to develop young players
    management: number; // 0-99: Relationship management with players
    motivation: number; // 0-99: Ability to motivate and inspire team
    clutch: number; // 0-99: Performance in high-pressure situations
    adaptability: number; // 0-99: Adjusting strategy mid-game
  };
  bio: {
    hometown: string;
    country: string;
    countryFlag: string;
    formerPlayer: boolean; // Was this coach a former player?
    playingCareer?: string; // Brief description if former player
    coachingStyle: string; // e.g., "Defensive Minded", "Offensive Guru", "Player Development"
  };
  personality: {
    patience: number; // 0-100: Tolerance with mistakes/development
    intensity: number; // 0-100: Coaching demeanor (100=intense, 0=calm)
    loyalty: number; // 0-100: Commitment to organization
    innovation: number; // 0-100: Willingness to try new strategies
    communication: number; // 0-100: Ability to communicate with players
    discipline: number; // 0-100: Emphasis on rules and structure
    confidence: number; // 0-100: Self-assurance and decisiveness
  };
  contract: {
    years: number;
    salary: number; // in millions per year
  };
  teamId: string | null;
  championships: number; // Rings won as head coach
  careerWins: number;
  careerLosses: number;
}

export interface Owner {
  id: string;
  name: string;
  age: number;
  gender: "male" | "female"; // Owner gender
  netWorth: number; // in billions
  bio: {
    hometown: string;
    country: string;
    countryFlag: string;
    businessBackground: string; // e.g., "Tech Entrepreneur", "Real Estate Mogul"
  };
  personality: {
    patience: number; // 0-100: Patience with losing seasons
    loyalty: number; // 0-100: Commitment to city/franchise
    wealthDisplay: number; // 0-100: Willingness to spend
    meddling: number; // 0-100: Involvement in basketball decisions
    publicity: number; // 0-100: Desire for media attention
  };
  teamId: string;
  yearsOwned: number;
  championships: number; // Rings won as owner
}

export interface Team {
  id: string;
  name: string;
  city: string;
  wins: number;
  losses: number;
  budget: number; // salary cap in millions
  playerIds: string[];
  coachId?: string; // Reference to team's head coach
  ownerId?: string; // Reference to team's owner
  conference: "East" | "West";
  division?: string; // Division within conference
  logo: string; // emoji logo (primary)
  secondaryLogo?: string; // emoji logo (secondary)
  primaryColor?: string; // hex color
  secondaryColor?: string; // hex color
  marketSize?: "Small" | "Medium" | "Large"; // Market size
  deadMoney?: DeadMoneyContract[]; // Waived/buyout contracts
  exceptions?: {
    midLevelException: number; // MLE remaining
    biAnnualException: number; // BAE remaining
    taxpayerMidLevel: number; // TMLE remaining
  };
}

export interface DeadMoneyContract {
  playerName: string;
  amountPerYear: number;
  yearsRemaining: number;
  reason: "waived" | "buyout";
}

export interface Game {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  date: string;
  dayNumber: number; // The game day (1, 2, 3, etc.) for proper scheduling
  played: boolean;
  wasCloseGame?: boolean; // Score difference <= 5 points
  hadBigPerformance?: boolean; // Any player scored 50+ points
  wasPhysical?: boolean; // Flag for physical/intense game
}

export interface GameDay {
  dayIndex: number; // 1-based day number
  games: Game[]; // All games scheduled for this day
}

export type RivalryLevel = "ice-cold" | "cold" | "warm" | "hot" | "red-hot";

export interface RivalryEvent {
  id: string;
  type: "playoff_series" | "upset" | "trade" | "injury" | "close_game" | "blowout" | "big_performance" | "game_winner";
  description: string;
  season: number;
  date: string;
  impact: number; // Points added to rivalry
}

export interface RivalryData {
  teamAId: string;
  teamBId: string;
  level: RivalryLevel;
  points: number; // Total rivalry points accumulated (0-100)
  lastUpdated: string;
  lastInteraction?: string; // Last time teams played/traded
  seasonsSincePlayoff?: number; // Seasons without playoff meeting (for cooling)
  factors: {
    // Regular Season Interaction
    closeGames: number; // Games decided by ≤5 points
    blowouts: number; // Games with 20+ point margin
    bigPerformances: number; // Games with 50+ point performances
    physicalGames: number; // Physical/intense games
    lastSecondWins: number; // Game-winning shots in final seconds

    // Playoff Interaction
    playoffMeetings: number; // Number of playoff series
    sevenGameSeries: number; // Number of 7-game playoff series
    majorUpsets: number; // Major playoff upsets
    repeatedPlayoffMatchups: number; // Consecutive years meeting in playoffs

    // Star Player Drama
    starPlayerMoves: number; // Stars leaving to join rival
    tradeRequests: number; // Trade demands to/from team
    playerConflicts: number; // Player-on-player conflicts
    dirtyFouls: number; // Injury-causing fouls

    // Trade & GM Conflict
    trades: number; // Trades between teams
    failedNegotiations: number; // Failed trade negotiations
  };
  history?: RivalryEvent[]; // Key events in rivalry
}

export interface Season {
  year: number;
  currentWeek: number;
  games: Game[];
  rivalries: RivalryData[]; // Track all team rivalries
  phase: SeasonPhase;
  hasStartedSeason?: boolean; // Track if any regular season games have been played
  draftLottery?: DraftLottery;
  upcomingDraft?: DraftClass;
}

export type SeasonPhase =
  | "regular_season"
  | "playoffs"
  | "draft_lottery"
  | "draft"
  | "offseason";

export interface DraftLottery {
  teams: DraftLotteryTeam[];
  executed: boolean;
  results?: DraftLotteryResult[];
}

export interface DraftLotteryTeam {
  teamId: string;
  wins: number;
  losses: number;
  lotteryOdds: number; // Percentage chance at #1 pick
  pingPongBalls: number; // Number of combinations
}

export interface DraftLotteryResult {
  teamId: string;
  originalPick: number; // Based on record
  draftPosition: number; // After lottery
  movedUp: boolean;
  movedDown: boolean;
}

export interface DraftClass {
  year: number;
  prospects: DraftProspect[];
  currentPick: number;
  completed: boolean;
}

export interface DraftProspect {
  id: string;
  name: string;
  position: "PG" | "SG" | "SF" | "PF" | "C";
  age: number;
  overall: number;
  potential: number;
  gender: "male" | "female"; // Prospect gender
  attributes: {
    // Athletic Attributes
    speed: number; // 0-100 rating
    acceleration: number; // 0-100 rating
    strength: number; // 0-100 rating
    vertical: number; // 0-100 rating
    lateralQuickness: number; // 0-100 rating
    stamina: number; // 0-100 rating
    hustle: number; // 0-100 rating

    // Offensive Attributes - Scoring
    finishing: number; // 0-100 rating
    midRangeShooting: number; // 0-100 rating
    threePointShooting: number; // 0-100 rating
    freeThrowShooting: number; // 0-100 rating
    postScoring: number; // 0-100 rating
    shotCreation: number; // 0-100 rating

    // Offensive Attributes - Playmaking
    ballHandling: number; // 0-100 rating
    passingVision: number; // 0-100 rating
    passingAccuracy: number; // 0-100 rating
    offBallMovement: number; // 0-100 rating

    // Defensive Attributes
    perimeterDefense: number; // 0-100 rating
    interiorDefense: number; // 0-100 rating
    blockRating: number; // 0-100 rating
    stealRating: number; // 0-100 rating
    defensiveRebounding: number; // 0-100 rating
    offensiveRebounding: number; // 0-100 rating
    defensiveAwareness: number; // 0-100 rating

    // Mental Attributes
    basketballIQ: number; // 0-100 rating
    consistency: number; // 0-100 rating
    workEthic: number; // 0-100 rating
    leadership: number; // 0-100 rating
    composure: number; // 0-100 rating
    discipline: number; // 0-100 rating
    clutch: number; // 0-100 rating
  };
  bio: {
    height: string;
    weight: number;
    wingspan: string;
    hometown: string;
    country: string;
    countryFlag: string;
    college: string;
  };
  personality: {
    loyalty: number;
    greed: number;
    winning: number;
    playTime: number;
    teamPlayer: number;
    workEthic: number;
    ego: number;
    temperament: number;
  };
  scoutingReport: string;
  draftedBy?: string;
  draftPosition?: number;
}

// Rotation Management Types
export interface PlayerRotation {
  playerId: string;
  minutesPerGame: number; // Minutes assigned by coach
  role: "starter" | "bench" | "reserve" | "inactive"; // Playing role
  depthChartPosition: number; // 1-15, position in depth chart
}

export interface TeamRotation {
  teamId: string;
  rotations: PlayerRotation[];
  lastUpdated: string;
}

export type GMActionType = "suggest_starter" | "suggest_minutes" | "suggest_benching" | "manual_override";
export type GMActionStatus = "pending" | "accepted" | "rejected" | "ignored";

export interface GMAction {
  id: string;
  teamId: string;
  actionType: GMActionType;
  playerId: string;
  requestedMinutes?: number;
  requestedRole?: "starter" | "bench" | "reserve" | "inactive";
  reason: string; // GM's reasoning
  status: GMActionStatus;
  timestamp: string;
  coachResponse?: string; // Coach's reasoning for accept/reject
  relationshipImpact: number; // How much this affects GM-Coach relationship (-10 to +10)
}

export interface GMCoachRelationship {
  teamId: string;
  trust: number; // 0-100: How much coach trusts GM
  authority: number; // 0-100: GM's authority over basketball decisions
  tension: number; // 0-100: Current tension level
  acceptanceRate: number; // Historical % of suggestions followed
  recentActions: GMAction[]; // Last 10 actions
  relationshipStatus: "excellent" | "good" | "neutral" | "strained" | "hostile";
  factors: {
    teamSuccess: number; // Win% affects authority
    gmReputation: number; // Track record
    starPlayerPressure: number; // Star players wanting changes
    ownerPressure: number; // Owner expectations
    coachJobSecurity: number; // How secure coach feels
  };
}

// Agent System Types
export interface Agent {
  id: string;
  name: string;
  agency: string; // Agency name (e.g., "CAA Sports", "Excel Sports Management")
  toughness: number; // 0-100: How aggressive in negotiations
  riskTolerance: number; // 0-100: Willingness to gamble on player potential
  priorities: {
    money: number; // 0-100: Weight for maximizing salary
    role: number; // 0-100: Weight for playing time/starter status
    market: number; // 0-100: Weight for big market/endorsements
    contender: number; // 0-100: Weight for winning team
  };
  clientIds: string[]; // List of player IDs this agent represents
  relationshipByTeam: { [teamId: string]: number }; // -100 to +100 relationship with each team
  negotiationHistory: NegotiationHistory[];
  reputation: number; // 0-100: Overall reputation in the league
}

export interface NegotiationHistory {
  id: string;
  teamId: string;
  playerId: string;
  timestamp: string;
  offerMade: ContractOffer;
  outcome: "accepted" | "rejected" | "countered" | "ended";
  fairnessScore: number; // -100 to +100: How fair the offer was
  relationshipChange: number; // How much the relationship changed
}

export interface ContractOffer {
  years: number;
  annualSalary: number; // in millions
  totalValue: number; // years * annualSalary
  roleGuarantee?: "starter" | "rotation" | "bench"; // Promised playing time
  incentives?: number; // Additional millions in performance bonuses
}

export interface ContractTarget {
  minYears: number;
  maxYears: number;
  minAnnualSalary: number;
  maxAnnualSalary: number;
  idealYears: number;
  idealAnnualSalary: number;
  mustHaveStarterRole: boolean;
  preferredMarketSize?: "Small" | "Medium" | "Large";
  mustBeContender: boolean; // Team must have good record
}

export type NegotiationResponse =
  | { type: "accept"; message: string }
  | { type: "counter"; message: string; counterOffer: ContractOffer }
  | { type: "reject"; message: string }
  | { type: "end_talks"; message: string; relationshipDamage: number };

export interface AgentDialogue {
  greeting: string;
  acceptMessages: string[];
  rejectMessages: string[];
  counterMessages: string[];
  endTalksMessages: string[];
  fairOfferMessages: string[];
  lowballMessages: string[];
}

// History System Types
export type TransactionType = "trade" | "free_agent_signing" | "waiver" | "release" | "draft_pick" | "contract_extension" | "coach_hire" | "coach_fire" | "expansion_draft";

export interface Transaction {
  id: string;
  type: TransactionType;
  timestamp: string;
  season: number;
  description: string;
  // Trade specific
  teamAId?: string;
  teamBId?: string;
  playersToA?: string[]; // Player IDs
  playersToB?: string[]; // Player IDs
  // Free agent / signing specific
  playerId?: string;
  teamId?: string;
  contractYears?: number;
  contractSalary?: number;
  // Coach specific
  coachId?: string;
  coachName?: string;
}

export interface SeasonSummary {
  season: number;
  teamId: string;
  finalRecord: {
    wins: number;
    losses: number;
    winPercentage: number;
  };
  playoffResult: string; // e.g., "Did not qualify", "Lost in Round 1", "Champion"
  rankings: {
    offensiveRank: number;
    defensiveRank: number;
    overallRank: number;
  };
  teamRating: {
    startOfSeason: number;
    endOfSeason: number;
  };
  headCoach: {
    name: string;
    overall: number;
  };
  topPlayers: Array<{
    playerId: string;
    name: string;
    overall: number;
    position: string;
  }>;
  sosData?: {
    rank: number; // 1-30
    score: number; // 0-100
    label: "Very Easy" | "Easy" | "Average" | "Hard" | "Very Hard";
    hardestStretch?: {
      startGame: number;
      endGame: number;
      gameCount: number;
    };
    recordVsTopSOS?: {
      wins: number;
      losses: number;
    };
  };
}

export type AwardType = "MVP" | "DPOY" | "ROY" | "All-Star" | "All-League-First" | "All-League-Second" | "All-League-Third" | "Coach-of-Year" | "GM-of-Year";

export interface Award {
  id: string;
  type: AwardType;
  season: number;
  playerId?: string;
  playerName?: string;
  coachId?: string;
  coachName?: string;
  teamId: string;
}

export interface FranchiseRecord {
  category: string; // e.g., "Most Points in a Game", "Best Win Streak"
  value: number | string;
  season?: number;
  playerId?: string;
  playerName?: string;
  date?: string;
  description: string;
}

export interface GMCareerStats {
  totalSeasons: number;
  lifetimeWins: number;
  lifetimeLosses: number;
  winPercentage: number;
  championships: number;
  playoffAppearances: number;
  totalTrades: number;
  totalFreeAgentSigns: number;
  totalDraftPicks: number;
  contractNegotiationsWon: number;
  contractNegotiationsLost: number;
}

export interface NotableMoment {
  id: string;
  type: "upset" | "award" | "breakout" | "trade" | "injury" | "dispute" | "milestone";
  season: number;
  timestamp: string;
  title: string;
  description: string;
  playerId?: string;
  teamId?: string;
}

export interface HistoryData {
  seasonSummaries: SeasonSummary[];
  transactions: Transaction[];
  awards: Award[];
  franchiseRecords: FranchiseRecord[];
  gmCareerStats: GMCareerStats;
  notableMoments: NotableMoment[];
}

// News Feed System Types
export type NewsCategory =
  | "rumor"
  | "official_announcement"
  | "player_mood"
  | "trade_request"
  | "league_buzz"
  | "analytics"
  | "injury_report"
  | "rivalry_update";

export type NewsStoryType =
  // Rumors
  | "player_interest_rumor"
  | "trade_exploration_rumor"
  | "coaching_change_rumor"
  // Official Announcements
  | "signing_announcement"
  | "trade_announcement"
  | "firing_announcement"
  | "hiring_announcement"
  | "injury_announcement"
  | "extension_announcement"
  | "expansion_announcement"
  // Player Mood & Drama
  | "player_unhappy_role"
  | "player_unhappy_performance"
  | "player_frustrated_team"
  | "player_thrilled_minutes"
  | "player_happy_winning"
  // Trade Requests
  | "trade_request_made"
  | "trade_request_withdrawn"
  // League Buzz
  | "winning_streak"
  | "losing_streak"
  | "award_race_update"
  | "finals_odds_update"
  | "power_rankings"
  | "rivalry_heating_up"
  | "player_of_week"
  | "draft_prospect_rising";

export interface NewsStory {
  id: string;
  category: NewsCategory;
  type: NewsStoryType;
  timestamp: string;
  season: number;
  dayNumber: number; // Which day of the season this occurred
  headline: string;
  description: string;
  detailedContent?: string; // Optional longer content for expansion
  isBreaking?: boolean; // Breaking news banner
  // Related entities
  playerId?: string;
  teamId?: string;
  relatedTeamId?: string; // For trades, rivalries
  coachId?: string;
  // Metadata
  readStatus?: boolean;
  priority: number; // Higher = more important
}

export interface NewsFeed {
  stories: NewsStory[];
  lastGeneratedDay: number;
  dailyStoryCount: { [day: number]: number }; // Track stories per day
}

// Award Race System Types
export type AwardRaceType = "MVP" | "DPOY" | "ROY" | "SIXTH_MAN" | "MIP" | "COTY";

export interface AwardRaceCandidate {
  playerId?: string;
  playerName?: string;
  coachId?: string;
  coachName?: string;
  teamId: string;
  rank: number; // 1-10
  statLine: string; // e.g., "28.5 PPG, 8.2 RPG, 6.7 APG"
  teamRecord: string; // e.g., "45-15"
  momentum: "Up" | "Down" | "Steady";
  explanation: string; // Short reason for their rank
  score: number; // Internal score for ranking (0-100)
}

export interface AwardRace {
  type: AwardRaceType;
  label: string; // e.g., "MVP Race"
  candidates: AwardRaceCandidate[];
  lastUpdated: number; // Week number
}

export interface AwardRaces {
  mvp: AwardRace;
  dpoy: AwardRace;
  roy: AwardRace;
  sixthMan: AwardRace;
  mip: AwardRace;
  coty: AwardRace;
}

// Finals Odds System Types
export interface TeamOdds {
  teamId: string;
  championshipOdds: {
    betting: string; // e.g., "+450"
    percentage: string; // e.g., "12%"
    raw: number; // Raw percentage for calculations
  };
  conferenceTitleOdds: {
    betting: string;
    percentage: string;
    raw: number;
  };
  playoffOdds: {
    betting: string;
    percentage: string;
    raw: number;
  };
  divisionOdds: {
    betting: string;
    percentage: string;
    raw: number;
  };
}

export interface OddsInputs {
  teamOVR: number; // Average team overall rating
  pointDiff: number; // Point differential per game
  sosScore: number; // Strength of schedule (0-100)
  last10Record: { wins: number; losses: number };
  injuryImpact: number; // Impact of injuries (0-100, 0=no injuries)
  topThreeOVR: number; // Average OVR of top 3 players
  coachRating: number; // Coach overall rating
}

// Media Headlines Types
export interface MediaHeadline {
  id: string;
  headline: string;
  description: string;
  type: "award_race" | "odds_shift" | "hot_streak" | "cold_streak" | "upset" | "rivalry";
  timestamp: string;
  priority: number; // Higher = more important
  teamId?: string;
  playerId?: string;
}

// Power Rankings System Types
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

// League Settings Types
export interface LeagueSettings {
  // League Structure
  numberOfTeams: number;
  gamesPerSeason: number;
  playoffTeams: number;
  conferencesEnabled: boolean;
  divisionsEnabled: boolean;

  // Gameplay Difficulty
  difficultyLevel: "casual" | "normal" | "sim-hardcore";
  playerAISkill: number; // 1-10 scale
  tradeAIAggression: number; // 1-10 scale

  // Realism Settings
  injuriesEnabled: boolean;
  injuryFrequency: number; // 1-5 slider scale
  fatigueEnabled: boolean;
  playerMoraleEnabled: boolean;
  contractNegotiationsEnabled: boolean;

  // Financial Rules
  salaryCapEnabled: boolean; // Toggle for salary cap
  salaryCap: number; // in millions
  luxuryTax: boolean;
  luxuryTaxSeverity: number; // 1-5 slider scale
  luxuryTaxThreshold: number; // in millions
  minimumSalary: number; // in millions
  maxContractLength: number; // years
  hardCapEnforcement: "none" | "soft" | "strict"; // Hard cap enforcement dropdown

  // Roster Rules
  rosterSizeMin: number; // 8-15
  rosterSizeMax: number; // 15-18

  // Draft Settings
  draftRounds: number;
  draftLotteryEnabled: boolean;
  rookieContracts: number; // years
  draftClassQuality: "poor" | "average" | "strong" | "legendary";

  // Simulation Settings
  progressionSpeed: "slow" | "normal" | "fast";
  playerDevelopment: number; // 1-5 slider scale (development speed)
  retirementAge: number;
  tradeDeadlineWeek: number;
  tradeDeadlineDay: number; // Specific day for trade deadline
  allStarWeekendDay: number; // Specific day for all-star weekend
  tradeFrequency: number; // 1-5 slider scale
  chemistryMoraleImpact: number; // 1-5 slider scale
  gameSimulationDetail: "fast" | "standard" | "deep"; // Detail level dropdown

  // Player Generation
  playerSkillVariance: "low" | "medium" | "high";
  superstarFrequency: "rare" | "normal" | "common";
  internationalPlayerPercentage: number; // 0-100

  // Gender Options
  playerGender: "male" | "female" | "mixed";
  playerGenderMixedPercentage?: number; // 0-100 (only for mixed)
  coachGender: "male" | "female" | "mixed";
  ownerGender: "male" | "female" | "mixed";

  // Expansion Rules
  expansionEnabled: boolean;
  expansionProtectedPlayers: number; // 3, 5, 7, 10 options

  // Presentation & News
  newsFeedVolume: number; // 1-5 slider scale
  rumorIntensity: number; // 1-5 slider scale
  showAwardRaces: boolean;
  showOddsPanel: boolean;
  notifyTradeProposals: boolean;
  notifyContractExpiring: boolean;
  notifyPlayerMilestones: boolean;
  notifyInjuries: boolean;
  autoSaveEnabled: boolean;

  // Accessibility & Misc
  textSize: "small" | "medium" | "large";
  colorblindMode: boolean;
}

