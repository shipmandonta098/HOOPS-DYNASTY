import { LeagueSettings } from "../types/basketball";

export const DEFAULT_LEAGUE_SETTINGS: LeagueSettings = {
  // League Structure
  numberOfTeams: 30,
  gamesPerSeason: 82,
  playoffTeams: 16,
  conferencesEnabled: true,
  divisionsEnabled: true,

  // Gameplay Difficulty
  difficultyLevel: "normal",
  playerAISkill: 7,
  tradeAIAggression: 5,

  // Realism Settings
  injuriesEnabled: true,
  injuryFrequency: 3, // Medium (1-5 scale)
  fatigueEnabled: true,
  playerMoraleEnabled: true,
  contractNegotiationsEnabled: true,

  // Financial Rules
  salaryCapEnabled: true,
  salaryCap: 149,
  luxuryTax: true,
  luxuryTaxSeverity: 3, // Medium (1-5 scale)
  luxuryTaxThreshold: 169,
  minimumSalary: 1.1,
  maxContractLength: 5,
  hardCapEnforcement: "soft",

  // Roster Rules
  rosterSizeMin: 13,
  rosterSizeMax: 15,

  // Draft Settings
  draftRounds: 2,
  draftLotteryEnabled: true,
  rookieContracts: 4,
  draftClassQuality: "average",

  // Simulation Settings
  progressionSpeed: "normal",
  playerDevelopment: 3, // Normal (1-5 scale)
  retirementAge: 36,
  tradeDeadlineWeek: 35,
  tradeDeadlineDay: 110, // Day 110 of the season
  allStarWeekendDay: 90, // Day 90 of the season
  tradeFrequency: 3, // Normal (1-5 scale)
  chemistryMoraleImpact: 3, // Normal (1-5 scale)
  gameSimulationDetail: "standard",

  // Player Generation
  playerSkillVariance: "medium",
  superstarFrequency: "normal",
  internationalPlayerPercentage: 23,

  // Gender Options
  playerGender: "male",
  playerGenderMixedPercentage: 50,
  coachGender: "male",
  ownerGender: "male",

  // Expansion Rules
  expansionEnabled: false,
  expansionProtectedPlayers: 7,

  // Presentation & News
  newsFeedVolume: 3, // Normal (1-5 scale)
  rumorIntensity: 3, // Normal (1-5 scale)
  showAwardRaces: true,
  showOddsPanel: true,
  notifyTradeProposals: true,
  notifyContractExpiring: true,
  notifyPlayerMilestones: true,
  notifyInjuries: true,
  autoSaveEnabled: true,

  // Accessibility & Misc
  textSize: "medium",
  colorblindMode: false,
};
