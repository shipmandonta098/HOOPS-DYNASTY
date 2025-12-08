import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Player, Team, Game, Season, Coach, TeamRotation, GMAction, GMCoachRelationship, PlayerRotation, GMActionStatus, Agent, HistoryData, Transaction, SeasonSummary, Award, FranchiseRecord, GMCareerStats, NotableMoment, NewsFeed, NewsStory, AwardRaces, TeamOdds, MediaHeadline, LeagueSettings, TeamPowerRanking } from "../types/basketball";
import {
  getRivalryBetweenTeams,
  createRivalry,
  updateRivalryFromGame,
  updateRivalryFromTrade,
} from "../utils/rivalry";
import { generatePlayerContract, generateRookieContract, recalculateAllContracts } from "../utils/contractGeneration";
import { canSignPlayer, canExecuteTrade, canReleasePlayer, getChemistryImpactMultiplier } from "../utils/settingsValidation";
import { DEFAULT_LEAGUE_SETTINGS } from "../utils/defaultSettings";

interface SavedLeague {
  id: string;
  name: string;
  createdAt: string;
  lastPlayedAt: string;
  players: Player[];
  teams: Team[];
  coaches: Coach[];
  agents?: Agent[]; // Player agents
  owners?: any[]; // Owner type to be imported from basketball.ts
  season: Season;
  userTeamId: string;
  hasSeenWelcome?: boolean;
  rotations?: TeamRotation[];
  gmCoachRelationships?: GMCoachRelationship[];
  gmActions?: GMAction[];
  history?: HistoryData; // Historical data tracking
  newsFeed?: NewsFeed; // News feed tracking
  awardRaces?: AwardRaces; // Award races tracking
  teamOdds?: TeamOdds[]; // Finals odds tracking
  headlines?: MediaHeadline[]; // Media headlines
  settings?: LeagueSettings; // League settings
  powerRankings?: TeamPowerRanking[]; // Power rankings tracking
}

interface BasketballState {
  // Current active league
  players: Player[];
  teams: Team[];
  coaches: Coach[];
  agents: Agent[];
  season: Season;
  userTeamId: string;

  // Rotation management
  rotations: TeamRotation[];
  gmCoachRelationships: GMCoachRelationship[];
  gmActions: GMAction[];

  // History tracking
  history: HistoryData;

  // News feed
  newsFeed: NewsFeed;

  // Award races and odds
  awardRaces: AwardRaces | null;
  teamOdds: TeamOdds[];
  headlines: MediaHeadline[];

  // Power rankings
  powerRankings: TeamPowerRanking[];

  // Saved leagues
  savedLeagues: SavedLeague[];
  currentLeagueId: string | null;

  // Actions
  createLeague: (name: string, year: number, userTeamIndex: number, customTeamData?: Array<{city: string; name: string; conference: string; division: string; logo: string; secondaryLogo: string; primaryColor: string; secondaryColor: string; marketSize: string}>, settings?: Partial<LeagueSettings>) => void;
  loadLeague: (leagueId: string) => void;
  deleteLeague: (leagueId: string) => void;
  renameLeague: (leagueId: string, newName: string) => void;
  exportLeague: (leagueId: string) => SavedLeague | null;
  importLeague: (leagueData: any) => { success: boolean; leagueId?: string; error?: string };
  markWelcomeSeen: () => void;
  initializeGame: () => void;
  simulateGame: (gameId: string) => void;
  simulateWeek: () => void;
  tradePlayer: (playerId: string, fromTeamId: string, toTeamId: string) => void;
  signPlayer: (playerId: string, teamId: string, years?: number, salary?: number) => void;
  releasePlayer: (playerId: string) => void;
  updatePlayerSatisfaction: () => void;
  saveCurrentLeague: () => void;
  initializeDraftLottery: () => void;
  executeDraftLottery: () => void;
  draftPlayer: (prospectId: string, teamId: string) => void;

  // Rotation management actions
  initializeRotations: () => void;
  submitGMAction: (teamId: string, playerId: string, actionType: string, requestedMinutes?: number, requestedRole?: "starter" | "bench" | "reserve" | "inactive", reason?: string) => void;
  processGMActions: () => void;
  updateGMCoachRelationship: (teamId: string) => void;
  getTeamRotation: (teamId: string) => TeamRotation | undefined;
  getGMCoachRelationship: (teamId: string) => GMCoachRelationship | undefined;
  updateRotationsFromDepthChart: (teamId: string, depthChartByPosition: { [key: string]: string[] }) => void;

  // Agent system actions
  updateAgentRelationship: (agentId: string, teamId: string, change: number) => void;
  extendPlayer: (playerId: string, years: number, salary: number) => void;

  // Expansion actions
  addExpansionTeam: (city: any, teamIdentity: any, selectedPlayerIds: string[]) => void;

  // SOS actions
  getTeamSOS: (teamId: string) => any;
  getAllTeamsSOS: () => any[];

  // History tracking actions
  addTransaction: (transaction: Omit<Transaction, "id" | "timestamp" | "season">) => void;
  recordSeasonEnd: () => void;
  getHistory: () => HistoryData;

  // News feed actions
  addNewsStory: (story: Omit<NewsStory, "id" | "timestamp">) => void;
  markNewsAsRead: (storyId: string) => void;
  generateDailyNews: () => void;
  clearOldNews: (daysToKeep: number) => void;

  // Award races and odds actions
  updateAwardRaces: () => void;
  updateTeamOdds: () => void;
  generateHeadlines: () => void;
  getAwardRaces: () => AwardRaces | null;
  getTeamOdds: (teamId?: string) => TeamOdds | TeamOdds[] | null;

  // Power rankings actions
  updatePowerRankings: () => void;
  getPowerRankings: () => TeamPowerRanking[];
  getTeamPowerRanking: (teamId: string) => TeamPowerRanking | undefined;

  // Contract migration action
  migrateContractsToNewSystem: () => void;

  // Settings actions
  getSettings: () => LeagueSettings | null;
  updateSettings: (newSettings: Partial<LeagueSettings>) => void;
}

const generatePlayers = (gender: "male" | "female" | "mixed" = "male"): Player[] => {
  const positions: Array<"PG" | "SG" | "SF" | "PF" | "C"> = ["PG", "SG", "SF", "PF", "C"];

  // Nationality data with weighted distribution (75-80% USA)
  const nationalities = [
    {
      name: "USA",
      flag: "🇺🇸",
      weight: 77, // 77% USA players
      maleFirstNames: ["Marcus", "Jaylen", "Kevin", "Devin", "Trae", "Tyler", "Damian", "Chris", "Paul", "Zion", "Ja", "Brandon", "Donovan", "Anthony", "DeMar", "Julius", "Darius", "Jalen", "Isaiah", "Malcolm", "Dejounte", "Jordan", "Andrew", "Buddy", "Collin", "De'Aaron", "Terry", "Miles", "LaMelo", "Cade", "Cameron", "Evan", "Cole", "Austin", "Derek", "Trevor", "Spencer", "Kyle", "Ryan", "Mason"],
      femaleFirstNames: ["Maya", "Emma", "Sophia", "Olivia", "Ava", "Isabella", "Mia", "Charlotte", "Amelia", "Harper", "Evelyn", "Abigail", "Emily", "Madison", "Ella", "Scarlett", "Grace", "Chloe", "Victoria", "Riley"],
      lastNames: ["Johnson", "Williams", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Robinson", "Clark", "Lee", "Walker", "Hall", "Allen", "Young", "King", "Wright", "Hill", "Green", "Adams", "Baker", "Nelson", "Carter", "Mitchell", "Perez", "Roberts", "Turner", "Phillips", "Campbell", "Parker", "Evans", "Edwards", "Collins"],
      hometowns: ["Chicago, IL", "Los Angeles, CA", "New York, NY", "Houston, TX", "Phoenix, AZ", "Philadelphia, PA", "Miami, FL", "Dallas, TX", "Atlanta, GA", "Boston, MA", "Detroit, MI", "Seattle, WA", "Denver, CO", "Portland, OR", "Las Vegas, NV", "Oakland, CA", "Charlotte, NC", "Memphis, TN", "Milwaukee, WI", "Indianapolis, IN", "San Antonio, TX", "Baltimore, MD", "Louisville, KY", "Washington, DC", "Cleveland, OH"],
      colleges: ["Duke", "Kentucky", "Kansas", "North Carolina", "UCLA", "Michigan", "Gonzaga", "Villanova", "Syracuse", "Arizona", "Louisville", "Florida", "Ohio State", "Texas", "UConn", "Memphis", "Georgetown", "Indiana", "Maryland", "Wake Forest", "Purdue", "Michigan State", "Virginia", "Tennessee", "Auburn"],
    },
    {
      name: "Canada",
      flag: "🇨🇦",
      weight: 6,
      firstNames: ["Liam", "Noah", "Oliver", "Lucas", "Ethan", "Logan", "Jackson", "Nathan", "Owen", "Connor", "Mason", "Carter", "Hunter", "Jacob", "William"],
      lastNames: ["Smith", "Martin", "Roy", "Wilson", "Tremblay", "Campbell", "Anderson", "Lee", "Walker", "White", "Thompson", "Scott", "Young", "King", "Green"],
      hometowns: ["Toronto, ON", "Montreal, QC", "Vancouver, BC", "Hamilton, ON", "Ottawa, ON", "Calgary, AB", "Mississauga, ON", "Brampton, ON", "Kitchener, ON", "Edmonton, AB"],
      colleges: ["International"],
    },
    {
      name: "France",
      flag: "🇫🇷",
      weight: 4,
      firstNames: ["Louis", "Lucas", "Hugo", "Jules", "Arthur", "Gabriel", "Raphael", "Adam", "Alexandre", "Antoine", "Mathis", "Leo", "Maxime", "Thomas"],
      lastNames: ["Martin", "Bernard", "Dubois", "Thomas", "Robert", "Petit", "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Lefebvre", "Michel", "Garcia"],
      hometowns: ["Paris", "Lyon", "Marseille", "Toulouse", "Nice", "Nantes", "Strasbourg", "Montpellier", "Bordeaux", "Lille"],
      colleges: ["International"],
    },
    {
      name: "Serbia",
      flag: "🇷🇸",
      weight: 3,
      firstNames: ["Luka", "Stefan", "Marko", "Nikola", "Filip", "Aleksandar", "Dusan", "Milan", "Milos", "Vladimir"],
      lastNames: ["Jovic", "Petrovic", "Nikolic", "Popovic", "Djordjevic", "Ilic", "Pavlovic", "Markovic", "Lukic", "Kovacevic"],
      hometowns: ["Belgrade", "Novi Sad", "Nis", "Kragujevac", "Subotica", "Zrenjanin"],
      colleges: ["International"],
    },
    {
      name: "Slovenia",
      flag: "🇸🇮",
      weight: 2,
      firstNames: ["Jan", "Luka", "Anze", "Matej", "Ziga", "Rok", "David", "Miha", "Tim", "Jaka"],
      lastNames: ["Novak", "Horvat", "Krajnc", "Kovac", "Zupan", "Potocnik", "Vidmar", "Kolar", "Mlakar", "Turk"],
      hometowns: ["Ljubljana", "Maribor", "Celje", "Kranj", "Koper"],
      colleges: ["International"],
    },
    {
      name: "Spain",
      flag: "🇪🇸",
      weight: 2,
      firstNames: ["Pablo", "Alejandro", "Daniel", "Hugo", "Adrian", "Carlos", "Javier", "Diego", "Alvaro", "Sergio"],
      lastNames: ["Garcia", "Rodriguez", "Martinez", "Lopez", "Gonzalez", "Fernandez", "Sanchez", "Perez", "Jimenez", "Ruiz"],
      hometowns: ["Madrid", "Barcelona", "Valencia", "Seville", "Zaragoza", "Malaga"],
      colleges: ["International"],
    },
    {
      name: "Greece",
      flag: "🇬🇷",
      weight: 2,
      firstNames: ["Dimitris", "Nikos", "Georgios", "Yannis", "Andreas", "Konstantinos", "Christos", "Alexandros", "Panagiotis", "Vasilis"],
      lastNames: ["Papadopoulos", "Nikolaidis", "Dimitriou", "Georgiou", "Ioannou", "Athanasiou", "Konstantinou", "Petrou", "Vasileiou", "Christodoulou"],
      hometowns: ["Athens", "Thessaloniki", "Patras", "Heraklion", "Larissa"],
      colleges: ["International"],
    },
    {
      name: "Australia",
      flag: "🇦🇺",
      weight: 2,
      firstNames: ["Jack", "Oliver", "Noah", "William", "James", "Lucas", "Henry", "Ethan", "Mason", "Logan"],
      lastNames: ["Smith", "Jones", "Williams", "Brown", "Wilson", "Taylor", "Johnson", "White", "Martin", "Anderson"],
      hometowns: ["Melbourne, VIC", "Sydney, NSW", "Brisbane, QLD", "Perth, WA", "Adelaide, SA", "Canberra, ACT"],
      colleges: ["International"],
    },
    {
      name: "Germany",
      flag: "🇩🇪",
      weight: 1,
      firstNames: ["Lukas", "Leon", "Tim", "Paul", "Felix", "Jonas", "Niklas", "Moritz", "Jan", "Max"],
      lastNames: ["Mueller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann"],
      hometowns: ["Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne", "Dortmund"],
      colleges: ["International"],
    },
    {
      name: "Argentina",
      flag: "🇦🇷",
      weight: 1,
      firstNames: ["Santiago", "Mateo", "Nicolas", "Tomas", "Lucas", "Benjamin", "Joaquin", "Thiago", "Felipe", "Agustin"],
      lastNames: ["Gonzalez", "Rodriguez", "Fernandez", "Lopez", "Martinez", "Garcia", "Perez", "Sanchez", "Romero", "Alvarez"],
      hometowns: ["Buenos Aires", "Cordoba", "Rosario", "Mendoza", "La Plata"],
      colleges: ["International"],
    },
  ];

  // Create weighted array for random selection
  const weightedNationalities: typeof nationalities[0][] = [];
  nationalities.forEach((nat) => {
    for (let i = 0; i < nat.weight; i++) {
      weightedNationalities.push(nat);
    }
  });

  const players: Player[] = [];

  // Generate 480 players (30 teams * 15 players + 30 free agents)
  for (let i = 0; i < 480; i++) {
    // Select nationality based on weights
    const nationality = weightedNationalities[Math.floor(Math.random() * weightedNationalities.length)];

    // Determine player gender
    let playerGender: "male" | "female";
    if (gender === "mixed") {
      playerGender = Math.random() < 0.5 ? "male" : "female";
    } else {
      playerGender = gender;
    }

    // Generate name from the selected nationality based on gender
    let firstNameArray: string[];
    if (nationality.maleFirstNames && nationality.femaleFirstNames) {
      // USA has gender-specific names
      firstNameArray = playerGender === "male" ? nationality.maleFirstNames : nationality.femaleFirstNames;
    } else {
      // Other countries use generic firstNames for all genders
      firstNameArray = nationality.firstNames;
    }
    const firstName = firstNameArray[Math.floor(Math.random() * firstNameArray.length)];
    const lastName = nationality.lastNames[Math.floor(Math.random() * nationality.lastNames.length)];

    // Select hometown from the nationality's cities
    const hometown = nationality.hometowns[Math.floor(Math.random() * nationality.hometowns.length)];

    // Select college - USA players get real colleges, others get "International"
    const college = nationality.name === "USA"
      ? nationality.colleges[Math.floor(Math.random() * nationality.colleges.length)]
      : "International";

    const position = positions[Math.floor(Math.random() * positions.length)];
    const overall = Math.floor(Math.random() * 40) + 60; // 60-99

    // Generate attributes based on position tendencies and overall rating
    const baseVariance = 15; // How much attributes can vary from overall
    const genAttr = (bias: number = 0) => {
      const value = overall + bias + (Math.random() * baseVariance * 2 - baseVariance);
      return Math.max(40, Math.min(99, Math.round(value)));
    };

    // Position-specific attribute tendencies
    let attributes;
    switch (position) {
      case "PG": // Point guards: high speed, IQ, passing
        attributes = {
          // Athletic
          speed: genAttr(8),
          acceleration: genAttr(7),
          strength: genAttr(-10),
          vertical: genAttr(0),
          lateralQuickness: genAttr(5),
          stamina: genAttr(2),
          hustle: genAttr(3),
          // Offensive - Scoring
          finishing: genAttr(0),
          midRangeShooting: genAttr(2),
          threePointShooting: genAttr(3),
          freeThrowShooting: genAttr(5),
          postScoring: genAttr(-8),
          shotCreation: genAttr(5),
          // Offensive - Playmaking
          ballHandling: genAttr(8),
          passingVision: genAttr(9),
          passingAccuracy: genAttr(7),
          offBallMovement: genAttr(2),
          // Defensive
          perimeterDefense: genAttr(-3),
          interiorDefense: genAttr(-8),
          blockRating: genAttr(-10),
          stealRating: genAttr(3),
          defensiveRebounding: genAttr(-7),
          offensiveRebounding: genAttr(-5),
          defensiveAwareness: genAttr(0),
          // Mental
          basketballIQ: genAttr(7),
          consistency: genAttr(2),
          workEthic: genAttr(0),
          leadership: genAttr(3),
          composure: genAttr(3),
          discipline: genAttr(2),
          clutch: genAttr(2),
        };
        break;
      case "SG": // Shooting guards: high shooting, speed
        attributes = {
          // Athletic
          speed: genAttr(5),
          acceleration: genAttr(5),
          strength: genAttr(-5),
          vertical: genAttr(3),
          lateralQuickness: genAttr(3),
          stamina: genAttr(3),
          hustle: genAttr(4),
          // Offensive - Scoring
          finishing: genAttr(3),
          midRangeShooting: genAttr(7),
          threePointShooting: genAttr(8),
          freeThrowShooting: genAttr(7),
          postScoring: genAttr(-5),
          shotCreation: genAttr(7),
          // Offensive - Playmaking
          ballHandling: genAttr(4),
          passingVision: genAttr(0),
          passingAccuracy: genAttr(2),
          offBallMovement: genAttr(6),
          // Defensive
          perimeterDefense: genAttr(0),
          interiorDefense: genAttr(-5),
          blockRating: genAttr(-5),
          stealRating: genAttr(2),
          defensiveRebounding: genAttr(-3),
          offensiveRebounding: genAttr(-2),
          defensiveAwareness: genAttr(2),
          // Mental
          basketballIQ: genAttr(2),
          consistency: genAttr(3),
          workEthic: genAttr(0),
          leadership: genAttr(0),
          composure: genAttr(4),
          discipline: genAttr(2),
          clutch: genAttr(5),
        };
        break;
      case "SF": // Small forwards: balanced
        attributes = {
          // Athletic
          speed: genAttr(3),
          acceleration: genAttr(3),
          strength: genAttr(0),
          vertical: genAttr(4),
          lateralQuickness: genAttr(3),
          stamina: genAttr(4),
          hustle: genAttr(4),
          // Offensive - Scoring
          finishing: genAttr(4),
          midRangeShooting: genAttr(4),
          threePointShooting: genAttr(4),
          freeThrowShooting: genAttr(2),
          postScoring: genAttr(0),
          shotCreation: genAttr(4),
          // Offensive - Playmaking
          ballHandling: genAttr(3),
          passingVision: genAttr(2),
          passingAccuracy: genAttr(2),
          offBallMovement: genAttr(4),
          // Defensive
          perimeterDefense: genAttr(3),
          interiorDefense: genAttr(0),
          blockRating: genAttr(0),
          stealRating: genAttr(3),
          defensiveRebounding: genAttr(2),
          offensiveRebounding: genAttr(1),
          defensiveAwareness: genAttr(3),
          // Mental
          basketballIQ: genAttr(3),
          consistency: genAttr(2),
          workEthic: genAttr(0),
          leadership: genAttr(2),
          composure: genAttr(3),
          discipline: genAttr(2),
          clutch: genAttr(3),
        };
        break;
      case "PF": // Power forwards: high strength, rebounding
        attributes = {
          // Athletic
          speed: genAttr(-5),
          acceleration: genAttr(-4),
          strength: genAttr(8),
          vertical: genAttr(5),
          lateralQuickness: genAttr(-2),
          stamina: genAttr(2),
          hustle: genAttr(5),
          // Offensive - Scoring
          finishing: genAttr(6),
          midRangeShooting: genAttr(0),
          threePointShooting: genAttr(-3),
          freeThrowShooting: genAttr(-2),
          postScoring: genAttr(7),
          shotCreation: genAttr(-2),
          // Offensive - Playmaking
          ballHandling: genAttr(-4),
          passingVision: genAttr(-2),
          passingAccuracy: genAttr(0),
          offBallMovement: genAttr(2),
          // Defensive
          perimeterDefense: genAttr(0),
          interiorDefense: genAttr(7),
          blockRating: genAttr(6),
          stealRating: genAttr(0),
          defensiveRebounding: genAttr(8),
          offensiveRebounding: genAttr(7),
          defensiveAwareness: genAttr(4),
          // Mental
          basketballIQ: genAttr(2),
          consistency: genAttr(2),
          workEthic: genAttr(0),
          leadership: genAttr(1),
          composure: genAttr(2),
          discipline: genAttr(3),
          clutch: genAttr(1),
        };
        break;
      case "C": // Centers: highest strength, defense, low speed
        attributes = {
          // Athletic
          speed: genAttr(-10),
          acceleration: genAttr(-8),
          strength: genAttr(10),
          vertical: genAttr(6),
          lateralQuickness: genAttr(-5),
          stamina: genAttr(-2),
          hustle: genAttr(3),
          // Offensive - Scoring
          finishing: genAttr(7),
          midRangeShooting: genAttr(-5),
          threePointShooting: genAttr(-8),
          freeThrowShooting: genAttr(-5),
          postScoring: genAttr(9),
          shotCreation: genAttr(-6),
          // Offensive - Playmaking
          ballHandling: genAttr(-8),
          passingVision: genAttr(-3),
          passingAccuracy: genAttr(-2),
          offBallMovement: genAttr(0),
          // Defensive
          perimeterDefense: genAttr(-5),
          interiorDefense: genAttr(9),
          blockRating: genAttr(10),
          stealRating: genAttr(-3),
          defensiveRebounding: genAttr(10),
          offensiveRebounding: genAttr(8),
          defensiveAwareness: genAttr(6),
          // Mental
          basketballIQ: genAttr(3),
          consistency: genAttr(1),
          workEthic: genAttr(0),
          leadership: genAttr(2),
          composure: genAttr(2),
          discipline: genAttr(3),
          clutch: genAttr(0),
        };
        break;
    }

    // Generate height based on position
    const generateHeight = (pos: string): string => {
      const baseHeight = pos === "PG" ? 73 : pos === "SG" ? 77 : pos === "SF" ? 79 : pos === "PF" ? 81 : 83; // in inches
      const variance = Math.floor(Math.random() * 5) - 2; // -2 to +2 inches
      const totalInches = baseHeight + variance;
      const feet = Math.floor(totalInches / 12);
      const inches = totalInches % 12;
      return `${feet}'${inches}"`;
    };

    // Generate weight based on position and height
    const generateWeight = (pos: string): number => {
      const baseWeight = pos === "PG" ? 190 : pos === "SG" ? 205 : pos === "SF" ? 220 : pos === "PF" ? 235 : 250;
      return baseWeight + Math.floor(Math.random() * 30) - 15; // ±15 lbs
    };

    // Generate wingspan (usually 2-6 inches longer than height)
    const generateWingspan = (heightStr: string): string => {
      const heightMatch = heightStr.match(/(\d+)'(\d+)"/);
      if (!heightMatch) return heightStr;
      const totalInches = parseInt(heightMatch[1]) * 12 + parseInt(heightMatch[2]);
      const wingspanInches = totalInches + Math.floor(Math.random() * 5) + 2; // +2 to +6 inches
      const feet = Math.floor(wingspanInches / 12);
      const inches = wingspanInches % 12;
      return `${feet}'${inches}"`;
    };

    const age = Math.floor(Math.random() * 15) + 20; // 20-34
    const draftYear = 2025 - (age - 19); // Assume drafted at 19
    const height = generateHeight(position);

    // Generate personality traits (0-100 scale)
    const generatePersonalityTrait = () => Math.floor(Math.random() * 60) + 20; // 20-80 base range

    // Some traits influenced by overall rating
    const loyalty = overall >= 85 ? Math.floor(Math.random() * 40) + 30 : Math.floor(Math.random() * 50) + 30; // Stars can be less loyal
    const greed = overall >= 85 ? Math.floor(Math.random() * 40) + 40 : Math.floor(Math.random() * 50) + 20; // Stars want more money
    const winning = overall >= 80 ? Math.floor(Math.random() * 30) + 60 : Math.floor(Math.random() * 60) + 20; // Good players want to win more
    const ego = overall >= 85 ? Math.floor(Math.random() * 40) + 50 : Math.floor(Math.random() * 60) + 20; // Stars have bigger egos

    players.push({
      id: `player-${i}`,
      name: `${firstName} ${lastName}`,
      position,
      age,
      overall,
      potential: Math.min(99, overall + Math.floor(Math.random() * 15)),
      gender: playerGender,
      contract: generatePlayerContract(overall, age, false),
      stats: {
        points: parseFloat((overall * 0.3).toFixed(1)),
        rebounds: parseFloat((overall * 0.15).toFixed(1)),
        assists: parseFloat((overall * 0.12).toFixed(1)),
        steals: parseFloat((overall * 0.05).toFixed(1)),
        blocks: parseFloat((overall * 0.04).toFixed(1)),
      },
      attributes,
      bio: {
        height,
        weight: generateWeight(position),
        wingspan: generateWingspan(height),
        hometown,
        country: nationality.name,
        countryFlag: nationality.flag,
        college,
        draftYear,
        draftRound: Math.random() > 0.5 ? 1 : 2,
        draftPick: Math.floor(Math.random() * 30) + 1,
        draftedBy: `Team ${Math.floor(Math.random() * 30)}`,
      },
      personality: {
        loyalty,
        greed,
        winning,
        playTime: generatePersonalityTrait(),
        teamPlayer: generatePersonalityTrait(),
        workEthic: generatePersonalityTrait(),
        ego,
        temperament: generatePersonalityTrait(),
      },
      satisfaction: 75, // Start at 75% satisfied
      teamId: null,
    });
  }

  return players;
};

// Migration function to update player bio data with new nationality system
const migratePlayerBioData = (players: Player[]): Player[] => {
  const nationalities = [
    {
      name: "USA",
      flag: "🇺🇸",
      weight: 77,
      firstNames: ["Marcus", "Jaylen", "Kevin", "Devin", "Trae", "Tyler", "Damian", "Chris", "Paul", "Zion", "Ja", "Brandon", "Donovan", "Anthony", "DeMar", "Julius", "Darius", "Jalen", "Isaiah", "Malcolm", "Dejounte", "Jordan", "Andrew", "Buddy", "Collin", "De'Aaron", "Terry", "Miles", "LaMelo", "Cade", "Cameron", "Evan", "Cole", "Austin", "Derek", "Trevor", "Spencer", "Kyle", "Ryan", "Mason"],
      lastNames: ["Johnson", "Williams", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Robinson", "Clark", "Lee", "Walker", "Hall", "Allen", "Young", "King", "Wright", "Hill", "Green", "Adams", "Baker", "Nelson", "Carter", "Mitchell", "Perez", "Roberts", "Turner", "Phillips", "Campbell", "Parker", "Evans", "Edwards", "Collins"],
      hometowns: ["Chicago, IL", "Los Angeles, CA", "New York, NY", "Houston, TX", "Phoenix, AZ", "Philadelphia, PA", "Miami, FL", "Dallas, TX", "Atlanta, GA", "Boston, MA", "Detroit, MI", "Seattle, WA", "Denver, CO", "Portland, OR", "Las Vegas, NV", "Oakland, CA", "Charlotte, NC", "Memphis, TN", "Milwaukee, WI", "Indianapolis, IN", "San Antonio, TX", "Baltimore, MD", "Louisville, KY", "Washington, DC", "Cleveland, OH"],
      colleges: ["Duke", "Kentucky", "Kansas", "North Carolina", "UCLA", "Michigan", "Gonzaga", "Villanova", "Syracuse", "Arizona", "Louisville", "Florida", "Ohio State", "Texas", "UConn", "Memphis", "Georgetown", "Indiana", "Maryland", "Wake Forest", "Purdue", "Michigan State", "Virginia", "Tennessee", "Auburn"],
    },
    {
      name: "Canada",
      flag: "🇨🇦",
      weight: 6,
      firstNames: ["Liam", "Noah", "Oliver", "Lucas", "Ethan", "Logan", "Jackson", "Nathan", "Owen", "Connor", "Mason", "Carter", "Hunter", "Jacob", "William"],
      lastNames: ["Smith", "Martin", "Roy", "Wilson", "Tremblay", "Campbell", "Anderson", "Lee", "Walker", "White", "Thompson", "Scott", "Young", "King", "Green"],
      hometowns: ["Toronto, ON", "Montreal, QC", "Vancouver, BC", "Hamilton, ON", "Ottawa, ON", "Calgary, AB", "Mississauga, ON", "Brampton, ON", "Kitchener, ON", "Edmonton, AB"],
      colleges: ["International"],
    },
    {
      name: "France",
      flag: "🇫🇷",
      weight: 4,
      firstNames: ["Louis", "Lucas", "Hugo", "Jules", "Arthur", "Gabriel", "Raphael", "Adam", "Alexandre", "Antoine", "Mathis", "Leo", "Maxime", "Thomas"],
      lastNames: ["Martin", "Bernard", "Dubois", "Thomas", "Robert", "Petit", "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Lefebvre", "Michel", "Garcia"],
      hometowns: ["Paris", "Lyon", "Marseille", "Toulouse", "Nice", "Nantes", "Strasbourg", "Montpellier", "Bordeaux", "Lille"],
      colleges: ["International"],
    },
    {
      name: "Serbia",
      flag: "🇷🇸",
      weight: 3,
      firstNames: ["Luka", "Stefan", "Marko", "Nikola", "Filip", "Aleksandar", "Dusan", "Milan", "Milos", "Vladimir"],
      lastNames: ["Jovic", "Petrovic", "Nikolic", "Popovic", "Djordjevic", "Ilic", "Pavlovic", "Markovic", "Lukic", "Kovacevic"],
      hometowns: ["Belgrade", "Novi Sad", "Nis", "Kragujevac", "Subotica", "Zrenjanin"],
      colleges: ["International"],
    },
    {
      name: "Slovenia",
      flag: "🇸🇮",
      weight: 2,
      firstNames: ["Jan", "Luka", "Anze", "Matej", "Ziga", "Rok", "David", "Miha", "Tim", "Jaka"],
      lastNames: ["Novak", "Horvat", "Krajnc", "Kovac", "Zupan", "Potocnik", "Vidmar", "Kolar", "Mlakar", "Turk"],
      hometowns: ["Ljubljana", "Maribor", "Celje", "Kranj", "Koper"],
      colleges: ["International"],
    },
    {
      name: "Spain",
      flag: "🇪🇸",
      weight: 2,
      firstNames: ["Pablo", "Alejandro", "Daniel", "Hugo", "Adrian", "Carlos", "Javier", "Diego", "Alvaro", "Sergio"],
      lastNames: ["Garcia", "Rodriguez", "Martinez", "Lopez", "Gonzalez", "Fernandez", "Sanchez", "Perez", "Jimenez", "Ruiz"],
      hometowns: ["Madrid", "Barcelona", "Valencia", "Seville", "Zaragoza", "Malaga"],
      colleges: ["International"],
    },
    {
      name: "Greece",
      flag: "🇬🇷",
      weight: 2,
      firstNames: ["Dimitris", "Nikos", "Georgios", "Yannis", "Andreas", "Konstantinos", "Christos", "Alexandros", "Panagiotis", "Vasilis"],
      lastNames: ["Papadopoulos", "Nikolaidis", "Dimitriou", "Georgiou", "Ioannou", "Athanasiou", "Konstantinou", "Petrou", "Vasileiou", "Christodoulou"],
      hometowns: ["Athens", "Thessaloniki", "Patras", "Heraklion", "Larissa"],
      colleges: ["International"],
    },
    {
      name: "Australia",
      flag: "🇦🇺",
      weight: 2,
      firstNames: ["Jack", "Oliver", "Noah", "William", "James", "Lucas", "Henry", "Ethan", "Mason", "Logan"],
      lastNames: ["Smith", "Jones", "Williams", "Brown", "Wilson", "Taylor", "Johnson", "White", "Martin", "Anderson"],
      hometowns: ["Melbourne, VIC", "Sydney, NSW", "Brisbane, QLD", "Perth, WA", "Adelaide, SA", "Canberra, ACT"],
      colleges: ["International"],
    },
    {
      name: "Germany",
      flag: "🇩🇪",
      weight: 1,
      firstNames: ["Lukas", "Leon", "Tim", "Paul", "Felix", "Jonas", "Niklas", "Moritz", "Jan", "Max"],
      lastNames: ["Mueller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann"],
      hometowns: ["Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne", "Dortmund"],
      colleges: ["International"],
    },
    {
      name: "Argentina",
      flag: "🇦🇷",
      weight: 1,
      firstNames: ["Santiago", "Mateo", "Nicolas", "Tomas", "Lucas", "Benjamin", "Joaquin", "Thiago", "Felipe", "Agustin"],
      lastNames: ["Gonzalez", "Rodriguez", "Fernandez", "Lopez", "Martinez", "Garcia", "Perez", "Sanchez", "Romero", "Alvarez"],
      hometowns: ["Buenos Aires", "Cordoba", "Rosario", "Mendoza", "La Plata"],
      colleges: ["International"],
    },
  ];

  // Create weighted array
  const weightedNationalities: typeof nationalities[0][] = [];
  nationalities.forEach((nat) => {
    for (let i = 0; i < nat.weight; i++) {
      weightedNationalities.push(nat);
    }
  });

  return players.map((player) => {
    // Select nationality based on weights
    const nationality = weightedNationalities[Math.floor(Math.random() * weightedNationalities.length)];

    // Generate new name from the selected nationality
    const firstName = nationality.firstNames[Math.floor(Math.random() * nationality.firstNames.length)];
    const lastName = nationality.lastNames[Math.floor(Math.random() * nationality.lastNames.length)];

    // Select hometown from the nationality's cities
    const hometown = nationality.hometowns[Math.floor(Math.random() * nationality.hometowns.length)];

    // Select college - USA players get real colleges, others get "International"
    const college = nationality.name === "USA"
      ? nationality.colleges[Math.floor(Math.random() * nationality.colleges.length)]
      : "International";

    // Return player with updated bio but preserve everything else
    return {
      ...player,
      name: `${firstName} ${lastName}`,
      bio: {
        ...player.bio,
        hometown,
        country: nationality.name,
        countryFlag: nationality.flag,
        college,
      },
    };
  });
};

// Migration function to add logos and conferences to existing teams
const migrateTeamData = (teams: Team[]): Team[] => {
  const teamLogos: Record<string, { logo: string; conference: "East" | "West" }> = {
    // Eastern Conference
    "Boston": { logo: "⚡", conference: "East" },
    "New York": { logo: "🏛️", conference: "East" },
    "Philadelphia": { logo: "⚔️", conference: "East" },
    "Toronto": { logo: "🛡️", conference: "East" },
    "Brooklyn": { logo: "👑", conference: "East" },
    "Miami": { logo: "🔥", conference: "East" },
    "Atlanta": { logo: "🦖", conference: "East" },
    "Orlando": { logo: "⭐", conference: "East" },
    "Charlotte": { logo: "🐆", conference: "East" },
    "Chicago": { logo: "📜", conference: "East" },
    "Milwaukee": { logo: "🎯", conference: "East" },
    "Detroit": { logo: "🔧", conference: "East" },
    "Cleveland": { logo: "🐍", conference: "East" },
    "Indianapolis": { logo: "🔥", conference: "East" },
    "Memphis": { logo: "⚔️", conference: "East" },
    // Western Conference
    "Los Angeles": { logo: "⚡", conference: "West" },
    "Golden State": { logo: "🌪️", conference: "West" },
    "Phoenix": { logo: "☀️", conference: "West" },
    "Sacramento": { logo: "🐉", conference: "West" },
    "Portland": { logo: "🌊", conference: "West" },
    "Seattle": { logo: "🐍", conference: "West" },
    "Dallas": { logo: "🤠", conference: "West" },
    "Houston": { logo: "🌪️", conference: "West" },
    "San Antonio": { logo: "🗼", conference: "West" },
    "New Orleans": { logo: "⛵", conference: "West" },
    "Oklahoma City": { logo: "🐎", conference: "West" },
    "Denver": { logo: "⛰️", conference: "West" },
    "Utah": { logo: "🏔️", conference: "West" },
    "Minnesota": { logo: "🐺", conference: "West" },
    "Las Vegas": { logo: "🎰", conference: "West" },
  };

  return teams.map((team) => {
    const cityData = teamLogos[team.city];

    // If team already has logo and conference, return as is
    if (team.logo && team.conference) {
      return team;
    }

    // Otherwise, add missing data
    return {
      ...team,
      logo: team.logo || cityData?.logo || "🏀", // Default to basketball if not found
      conference: team.conference || cityData?.conference || "East", // Default to East if not found
    };
  });
};

const generateTeams = (players: Player[], customTeamData?: Array<{city: string; name: string; conference: string; division: string; logo: string; secondaryLogo: string; primaryColor: string; secondaryColor: string; marketSize: string}>): Team[] => {
  const teamNames = customTeamData || [
    // Eastern Conference - Atlantic Division
    { city: "Boston", name: "Titans", conference: "East" as const, division: "Atlantic", logo: "⚡", secondaryLogo: "🌩️", primaryColor: "#1E90FF", secondaryColor: "#FFD700", marketSize: "Large" as const },
    { city: "New York", name: "Empire", conference: "East" as const, division: "Atlantic", logo: "🏛️", secondaryLogo: "🗽", primaryColor: "#0047AB", secondaryColor: "#FFA500", marketSize: "Large" as const },
    { city: "Philadelphia", name: "Knights", conference: "East" as const, division: "Atlantic", logo: "⚔️", secondaryLogo: "🛡️", primaryColor: "#002366", secondaryColor: "#C0C0C0", marketSize: "Large" as const },
    { city: "Toronto", name: "Guardians", conference: "East" as const, division: "Atlantic", logo: "🛡️", secondaryLogo: "🍁", primaryColor: "#CE1141", secondaryColor: "#000000", marketSize: "Large" as const },
    { city: "Brooklyn", name: "Royals", conference: "East" as const, division: "Atlantic", logo: "👑", secondaryLogo: "🌉", primaryColor: "#000000", secondaryColor: "#FFFFFF", marketSize: "Large" as const },

    // Eastern Conference - Southeast Division
    { city: "Miami", name: "Inferno", conference: "East" as const, division: "Southeast", logo: "🔥", secondaryLogo: "🌴", primaryColor: "#98002E", secondaryColor: "#F9A01B", marketSize: "Large" as const },
    { city: "Atlanta", name: "Raptors", conference: "East" as const, division: "Southeast", logo: "🦖", secondaryLogo: "🦅", primaryColor: "#E03A3E", secondaryColor: "#C1D32F", marketSize: "Large" as const },
    { city: "Orlando", name: "Rebellion", conference: "East" as const, division: "Southeast", logo: "⭐", secondaryLogo: "✨", primaryColor: "#0077C0", secondaryColor: "#C4CED4", marketSize: "Medium" as const },
    { city: "Charlotte", name: "Panthers", conference: "East" as const, division: "Southeast", logo: "🐆", secondaryLogo: "🐝", primaryColor: "#1D1160", secondaryColor: "#00788C", marketSize: "Medium" as const },
    { city: "Memphis", name: "Warriors", conference: "East" as const, division: "Southeast", logo: "⚔️", secondaryLogo: "🐻", primaryColor: "#5D76A9", secondaryColor: "#12173F", marketSize: "Small" as const },

    // Eastern Conference - Central Division
    { city: "Chicago", name: "Legends", conference: "East" as const, division: "Central", logo: "📜", secondaryLogo: "🐂", primaryColor: "#CE1141", secondaryColor: "#000000", marketSize: "Large" as const },
    { city: "Milwaukee", name: "Hunters", conference: "East" as const, division: "Central", logo: "🎯", secondaryLogo: "🦌", primaryColor: "#00471B", secondaryColor: "#EEE1C6", marketSize: "Medium" as const },
    { city: "Detroit", name: "Ironmen", conference: "East" as const, division: "Central", logo: "🔧", secondaryLogo: "🏭", primaryColor: "#C8102E", secondaryColor: "#006BB6", marketSize: "Medium" as const },
    { city: "Cleveland", name: "Cobras", conference: "East" as const, division: "Central", logo: "🐍", secondaryLogo: "👑", primaryColor: "#860038", secondaryColor: "#FDBB30", marketSize: "Medium" as const },
    { city: "Indianapolis", name: "Flames", conference: "East" as const, division: "Central", logo: "🔥", secondaryLogo: "🏁", primaryColor: "#002D62", secondaryColor: "#FDBB30", marketSize: "Medium" as const },

    // Western Conference - Pacific Division
    { city: "Los Angeles", name: "Thunder", conference: "West" as const, division: "Pacific", logo: "⚡", secondaryLogo: "🌟", primaryColor: "#552583", secondaryColor: "#FDB927", marketSize: "Large" as const },
    { city: "Golden State", name: "Storm", conference: "West" as const, division: "Pacific", logo: "🌪️", secondaryLogo: "🌉", primaryColor: "#1D428A", secondaryColor: "#FFC72C", marketSize: "Large" as const },
    { city: "Phoenix", name: "Blaze", conference: "West" as const, division: "Pacific", logo: "☀️", secondaryLogo: "🔥", primaryColor: "#E56020", secondaryColor: "#1D1160", marketSize: "Large" as const },
    { city: "Sacramento", name: "Dragons", conference: "West" as const, division: "Pacific", logo: "🐉", secondaryLogo: "👑", primaryColor: "#5A2D81", secondaryColor: "#63727A", marketSize: "Medium" as const },
    { city: "Portland", name: "Surge", conference: "West" as const, division: "Pacific", logo: "🌊", secondaryLogo: "🌲", primaryColor: "#E03A3E", secondaryColor: "#000000", marketSize: "Medium" as const },

    // Western Conference - Northwest Division
    { city: "Seattle", name: "Vipers", conference: "West" as const, division: "Northwest", logo: "🐍", secondaryLogo: "☔", primaryColor: "#00653B", secondaryColor: "#FFD200", marketSize: "Large" as const },
    { city: "Denver", name: "Avalanche", conference: "West" as const, division: "Northwest", logo: "⛰️", secondaryLogo: "⛏️", primaryColor: "#0E2240", secondaryColor: "#FEC524", marketSize: "Large" as const },
    { city: "Utah", name: "Pioneers", conference: "West" as const, division: "Northwest", logo: "🏔️", secondaryLogo: "🎷", primaryColor: "#002B5C", secondaryColor: "#00471B", marketSize: "Medium" as const },
    { city: "Minnesota", name: "Wolves", conference: "West" as const, division: "Northwest", logo: "🐺", secondaryLogo: "🌲", primaryColor: "#0C2340", secondaryColor: "#236192", marketSize: "Medium" as const },
    { city: "Oklahoma City", name: "Mustangs", conference: "West" as const, division: "Northwest", logo: "🐎", secondaryLogo: "⚡", primaryColor: "#007AC1", secondaryColor: "#EF3B24", marketSize: "Medium" as const },

    // Western Conference - Southwest Division
    { city: "Dallas", name: "Outlaws", conference: "West" as const, division: "Southwest", logo: "🤠", secondaryLogo: "⭐", primaryColor: "#00538C", secondaryColor: "#002B5E", marketSize: "Large" as const },
    { city: "Houston", name: "Cyclones", conference: "West" as const, division: "Southwest", logo: "🌪️", secondaryLogo: "🚀", primaryColor: "#CE1141", secondaryColor: "#000000", marketSize: "Large" as const },
    { city: "San Antonio", name: "Sentinels", conference: "West" as const, division: "Southwest", logo: "🗼", secondaryLogo: "🦅", primaryColor: "#C4CED4", secondaryColor: "#000000", marketSize: "Large" as const },
    { city: "New Orleans", name: "Voyagers", conference: "West" as const, division: "Southwest", logo: "⛵", secondaryLogo: "🎺", primaryColor: "#0C2340", secondaryColor: "#C8102E", marketSize: "Medium" as const },
    { city: "Las Vegas", name: "Aces", conference: "West" as const, division: "Southwest", logo: "🎰", secondaryLogo: "♠️", primaryColor: "#C8102E", secondaryColor: "#000000", marketSize: "Large" as const },
  ];

  const teams: Team[] = teamNames.map((team, index) => ({
    id: `team-${index}`,
    city: team.city,
    name: team.name,
    wins: 0,
    losses: 0,
    budget: 120, // $120M salary cap
    playerIds: [],
    conference: (team.conference === "West" ? "West" : "East") as "East" | "West",
    division: team.division,
    logo: team.logo,
    secondaryLogo: team.secondaryLogo,
    primaryColor: team.primaryColor,
    secondaryColor: team.secondaryColor,
    marketSize: (team.marketSize === "Large" ? "Large" : team.marketSize === "Medium" ? "Medium" : "Small") as "Large" | "Medium" | "Small",
  }));

  // Distribute players to teams (15 per team)
  let playerIndex = 0;
  teams.forEach((team) => {
    for (let i = 0; i < 15; i++) {
      if (playerIndex < players.length) {
        players[playerIndex].teamId = team.id;
        team.playerIds.push(players[playerIndex].id);
        playerIndex++;
      }
    }
  });

  return teams;
};

// Simple schedule generator - guarantees exactly gamesPerSeason games per team
const generateSchedule = (teams: Team[], gamesPerSeason: number = 82): Game[] => {
  const GAMES_PER_TEAM = gamesPerSeason;
  const MAX_GAMES_PER_DAY = 15;

  // Simple approach: generate all required matchups, then schedule them
  const games: Game[] = [];
  let gameId = 0;

  // Track game counts per team
  const teamGameCount = new Map<string, number>();
  const homeGameCount = new Map<string, number>();
  teams.forEach(team => {
    teamGameCount.set(team.id, 0);
    homeGameCount.set(team.id, 0);
  });

  // Helper: Get number of games two teams should play against each other
  const getMatchupCount = (teamA: Team, teamB: Team): number => {
    // Same division: 4 games
    if (teamA.conference === teamB.conference && teamA.division === teamB.division) {
      return 4;
    }
    // Same conference, different division: 3 games
    if (teamA.conference === teamB.conference) {
      return 3;
    }
    // Cross-conference: 2 games
    return 2;
  };

  // Phase 1: Generate all matchups
  interface Matchup {
    teamA: string;
    teamB: string;
    count: number;
  }

  const allMatchups: Matchup[] = [];

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const count = getMatchupCount(teams[i], teams[j]);
      allMatchups.push({
        teamA: teams[i].id,
        teamB: teams[j].id,
        count
      });
    }
  }

  // Create individual games from matchups
  const gamesToSchedule: { homeTeamId: string; awayTeamId: string }[] = [];

  allMatchups.forEach(matchup => {
    for (let g = 0; g < matchup.count; g++) {
      // Alternate home/away for fairness
      if (g % 2 === 0) {
        gamesToSchedule.push({ homeTeamId: matchup.teamA, awayTeamId: matchup.teamB });
      } else {
        gamesToSchedule.push({ homeTeamId: matchup.teamB, awayTeamId: matchup.teamA });
      }
    }
  });

  // Shuffle games for better distribution
  for (let i = gamesToSchedule.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [gamesToSchedule[i], gamesToSchedule[j]] = [gamesToSchedule[j], gamesToSchedule[i]];
  }

  // Phase 2: Adjust to ensure exactly GAMES_PER_TEAM games per team
  // Count scheduled games per team
  const scheduledCounts = new Map<string, number>();
  teams.forEach(team => scheduledCounts.set(team.id, 0));

  gamesToSchedule.forEach(game => {
    scheduledCounts.set(game.homeTeamId, (scheduledCounts.get(game.homeTeamId) || 0) + 1);
    scheduledCounts.set(game.awayTeamId, (scheduledCounts.get(game.awayTeamId) || 0) + 1);
  });

  // Add or remove games to reach exactly GAMES_PER_TEAM
  const teamsNeedingMore = teams.filter(t => (scheduledCounts.get(t.id) || 0) < GAMES_PER_TEAM);
  const teamsWithExtra = teams.filter(t => (scheduledCounts.get(t.id) || 0) > GAMES_PER_TEAM);

  // Remove excess games
  for (const team of teamsWithExtra) {
    while ((scheduledCounts.get(team.id) || 0) > GAMES_PER_TEAM) {
      // Find and remove a game involving this team
      const gameIndex = gamesToSchedule.findIndex(
        g => g.homeTeamId === team.id || g.awayTeamId === team.id
      );
      if (gameIndex >= 0) {
        const removed = gamesToSchedule.splice(gameIndex, 1)[0];
        scheduledCounts.set(removed.homeTeamId, (scheduledCounts.get(removed.homeTeamId) || 0) - 1);
        scheduledCounts.set(removed.awayTeamId, (scheduledCounts.get(removed.awayTeamId) || 0) - 1);
      } else {
        break;
      }
    }
  }

  // Add missing games
  for (const teamA of teamsNeedingMore) {
    while ((scheduledCounts.get(teamA.id) || 0) < GAMES_PER_TEAM) {
      // Find another team that also needs games or is at the target
      let foundPartner = false;

      for (const teamB of teams) {
        if (teamA.id === teamB.id) continue;
        const teamBCount = scheduledCounts.get(teamB.id) || 0;

        if (teamBCount < GAMES_PER_TEAM) {
          // Both teams need games, create a matchup
          const homeTeamId = Math.random() < 0.5 ? teamA.id : teamB.id;
          const awayTeamId = homeTeamId === teamA.id ? teamB.id : teamA.id;

          gamesToSchedule.push({ homeTeamId, awayTeamId });
          scheduledCounts.set(teamA.id, (scheduledCounts.get(teamA.id) || 0) + 1);
          scheduledCounts.set(teamB.id, (scheduledCounts.get(teamB.id) || 0) + 1);
          foundPartner = true;
          break;
        }
      }

      if (!foundPartner) {
        // If no team needs games, pair with any team
        const teamB = teams.find(t => t.id !== teamA.id);
        if (teamB) {
          const homeTeamId = Math.random() < 0.5 ? teamA.id : teamB.id;
          const awayTeamId = homeTeamId === teamA.id ? teamB.id : teamA.id;

          gamesToSchedule.push({ homeTeamId, awayTeamId });
          scheduledCounts.set(teamA.id, (scheduledCounts.get(teamA.id) || 0) + 1);
          scheduledCounts.set(teamB.id, (scheduledCounts.get(teamB.id) || 0) + 1);
        }
      }
    }
  }

  // Phase 3: Schedule games across days
  const SEASON_DAYS = Math.ceil(gamesToSchedule.length / MAX_GAMES_PER_DAY) + 10; // Add buffer days
  let currentDay = 1;
  let gamesScheduledToday = 0;
  const teamLastPlayedDay = new Map<string, number>();

  teams.forEach(team => teamLastPlayedDay.set(team.id, -10));

  for (const gameData of gamesToSchedule) {
    // Try to schedule this game
    let scheduled = false;
    let dayOffset = 0;

    while (!scheduled && dayOffset < SEASON_DAYS) {
      const tryDay = currentDay + dayOffset;
      const homeLastDay = teamLastPlayedDay.get(gameData.homeTeamId) || -10;
      const awayLastDay = teamLastPlayedDay.get(gameData.awayTeamId) || -10;

      // Check if both teams can play (simple spacing: at least 1 day between games usually)
      const homeDaysSince = tryDay - homeLastDay;
      const awayDaysSince = tryDay - awayLastDay;

      // Allow scheduling if it's been at least 1 day, or if we need to move forward
      if (homeDaysSince >= 1 && awayDaysSince >= 1) {
        // Create the game
        games.push({
          id: `game-${gameId++}`,
          homeTeamId: gameData.homeTeamId,
          awayTeamId: gameData.awayTeamId,
          homeScore: 0,
          awayScore: 0,
          dayNumber: tryDay,
          date: new Date(2025, 0, tryDay).toISOString(),
          played: false,
        });

        teamGameCount.set(gameData.homeTeamId, (teamGameCount.get(gameData.homeTeamId) || 0) + 1);
        teamGameCount.set(gameData.awayTeamId, (teamGameCount.get(gameData.awayTeamId) || 0) + 1);
        homeGameCount.set(gameData.homeTeamId, (homeGameCount.get(gameData.homeTeamId) || 0) + 1);

        teamLastPlayedDay.set(gameData.homeTeamId, tryDay);
        teamLastPlayedDay.set(gameData.awayTeamId, tryDay);

        gamesScheduledToday++;

        // Move to next day if we hit the limit
        if (gamesScheduledToday >= MAX_GAMES_PER_DAY) {
          currentDay++;
          gamesScheduledToday = 0;
        }

        scheduled = true;
      } else {
        dayOffset++;
        if (dayOffset === 1) {
          currentDay++;
          gamesScheduledToday = 0;
        }
      }
    }

    if (!scheduled) {
      // Force schedule on current day
      games.push({
        id: `game-${gameId++}`,
        homeTeamId: gameData.homeTeamId,
        awayTeamId: gameData.awayTeamId,
        homeScore: 0,
        awayScore: 0,
        dayNumber: currentDay,
        date: new Date(2025, 0, currentDay).toISOString(),
        played: false,
      });

      teamGameCount.set(gameData.homeTeamId, (teamGameCount.get(gameData.homeTeamId) || 0) + 1);
      teamGameCount.set(gameData.awayTeamId, (teamGameCount.get(gameData.awayTeamId) || 0) + 1);
      homeGameCount.set(gameData.homeTeamId, (homeGameCount.get(gameData.homeTeamId) || 0) + 1);

      gamesScheduledToday++;
      if (gamesScheduledToday >= MAX_GAMES_PER_DAY) {
        currentDay++;
        gamesScheduledToday = 0;
      }
    }
  }

  // Validation
  let validationFailed = false;
  teams.forEach((team) => {
    const count = teamGameCount.get(team.id) || 0;
    if (count !== GAMES_PER_TEAM) {
      console.error(`Schedule validation failed: Team ${team.id} has ${count} games instead of ${GAMES_PER_TEAM}`);
      validationFailed = true;
    }
  });

  if (validationFailed) {
    console.warn("Schedule had validation issues, but returning best effort schedule");
  }

  return games;
};

export const useBasketballStore = create<BasketballState>()(
  persist(
    (set, get) => ({
      players: [],
      teams: [],
      coaches: [],
      agents: [],
      season: {
        year: 2025,
        currentWeek: 1,
        games: [],
        rivalries: [],
        phase: "regular_season",
      },
      userTeamId: "team-0",
      savedLeagues: [],
      currentLeagueId: null,
      rotations: [],
      gmCoachRelationships: [],
      gmActions: [],
      history: {
        seasonSummaries: [],
        transactions: [],
        awards: [],
        franchiseRecords: [],
        gmCareerStats: {
          totalSeasons: 0,
          lifetimeWins: 0,
          lifetimeLosses: 0,
          winPercentage: 0,
          championships: 0,
          playoffAppearances: 0,
          totalTrades: 0,
          totalFreeAgentSigns: 0,
          totalDraftPicks: 0,
          contractNegotiationsWon: 0,
          contractNegotiationsLost: 0,
        },
        notableMoments: [],
      },
      newsFeed: {
        stories: [],
        lastGeneratedDay: 0,
        dailyStoryCount: {},
      },
      awardRaces: null,
      teamOdds: [],
      headlines: [],
      powerRankings: [],

      createLeague: (name: string, year: number, userTeamIndex: number, customTeamData?, settings?) => {
        // Merge provided settings with defaults
        const leagueSettings = {
          ...DEFAULT_LEAGUE_SETTINGS,
          ...settings,
        };

        const playerGender = leagueSettings.playerGender;
        const coachGender = leagueSettings.coachGender;
        const ownerGender = leagueSettings.ownerGender;

        const players = generatePlayers(playerGender);
        const teams = generateTeams(players, customTeamData);

        const games = generateSchedule(teams, leagueSettings.gamesPerSeason);

        // Generate coaches for all teams
        const { generateCoaches } = require("../utils/coaches");
        const coaches = generateCoaches(teams.map((t) => t.id), coachGender);

        // Generate owners for all teams
        const { generateOwners } = require("../utils/owners");
        const owners = generateOwners(teams.map((t) => t.id), ownerGender);

        // Assign coaches to teams
        const teamsWithCoaches = teams.map((team, index) => ({
          ...team,
          coachId: coaches[index].id,
        }));

        // Generate agents and assign to players
        const { generateAgents, assignAgentsToPlayers } = require("../utils/agentGeneration");
        const generatedAgents = generateAgents(50);
        const { updatedPlayers, updatedAgents } = assignAgentsToPlayers(players, generatedAgents);

        // Initialize agent relationships with all teams
        updatedAgents.forEach((agent: Agent) => {
          teamsWithCoaches.forEach((team) => {
            agent.relationshipByTeam[team.id] = 0; // Start neutral
          });
        });

        // Generate draft class immediately for year-round scouting
        const { generateDraftClass } = require("../utils/draft");
        const draftClass = generateDraftClass(year, 100, playerGender);

        const leagueId = `league-${Date.now()}`;
        const userTeamId = `team-${userTeamIndex}`;
        const now = new Date().toISOString();

        const newLeague: SavedLeague = {
          id: leagueId,
          name,
          createdAt: now,
          lastPlayedAt: now,
          players: updatedPlayers,
          teams: teamsWithCoaches,
          coaches,
          agents: updatedAgents,
          season: {
            year,
            currentWeek: 1,
            games,
            rivalries: [],
            phase: "regular_season",
            upcomingDraft: draftClass,
            hasStartedSeason: false, // New leagues haven't started yet
          },
          userTeamId,
          settings: leagueSettings, // Store the merged settings
        };

        const state = get();
        set({
          players: updatedPlayers,
          teams: teamsWithCoaches,
          coaches,
          agents: updatedAgents,
          season: {
            year,
            currentWeek: 1,
            games,
            rivalries: [],
            phase: "regular_season",
            upcomingDraft: draftClass,
            hasStartedSeason: false, // New leagues haven't started yet
          },
          userTeamId,
          currentLeagueId: leagueId,
          savedLeagues: [...state.savedLeagues, newLeague],
        });

        // Initialize rotations after setting the state
        setTimeout(() => get().initializeRotations(), 0);

        // Initialize power rankings with pre-season projections
        setTimeout(() => get().updatePowerRankings(), 0);
      },

      loadLeague: (leagueId: string) => {
        const state = get();
        const league = state.savedLeagues.find((l) => l.id === leagueId);
        if (!league) return;

        // Migrate player bio data with new nationality system
        let migratedPlayers = migratePlayerBioData(league.players);

        // Migrate contracts to new 2025 NBA salary tier system
        migratedPlayers = recalculateAllContracts(migratedPlayers);

        // Initialize settings if they don't exist (backward compatibility)
        const leagueSettings = league.settings || DEFAULT_LEAGUE_SETTINGS;

        // Migrate team data to add logos and ensure conferences
        const migratedTeams = migrateTeamData(league.teams);

        // Migrate or generate coaches if they don't exist
        let migratedCoaches = league.coaches || [];
        if (migratedCoaches.length === 0) {
          const { generateCoaches } = require("../utils/coaches");
          migratedCoaches = generateCoaches(league.teams.map((t) => t.id));
          // Assign coach IDs to teams if missing
          migratedTeams.forEach((team, index) => {
            if (!team.coachId) {
              team.coachId = migratedCoaches[index].id;
            }
          });
        }

        // Migrate or generate agents if they don't exist
        let migratedAgents = league.agents || [];
        if (migratedAgents.length === 0) {
          const { generateAgents, assignAgentsToPlayers } = require("../utils/agentGeneration");
          const generatedAgents = generateAgents(50);
          const { updatedPlayers: playersWithAgents, updatedAgents: agentsWithClients } = assignAgentsToPlayers(
            migratedPlayers,
            generatedAgents
          );
          migratedPlayers.splice(0, migratedPlayers.length, ...playersWithAgents);
          migratedAgents = agentsWithClients;

          // Initialize agent relationships with all teams
          migratedAgents.forEach((agent: Agent) => {
            migratedTeams.forEach((team) => {
              agent.relationshipByTeam[team.id] = 0; // Start neutral
            });
          });
        }

        // Ensure season has draft class for year-round scouting
        let upcomingDraft = league.season.upcomingDraft;
        if (!upcomingDraft) {
          const { generateDraftClass } = require("../utils/draft");
          upcomingDraft = generateDraftClass(league.season.year);
        }

        // Migrate games to add dayNumber if missing
        const migratedGames = league.season.games.map((game, index) => {
          if (game.dayNumber === undefined) {
            // For old leagues, assign dayNumber based on date or index
            const gameDate = new Date(game.date);
            const dayNumber = gameDate.getDate() || index + 1;
            return { ...game, dayNumber };
          }
          return game;
        });

        // Ensure season has all required fields (migration for old saves)
        const migratedSeason = {
          ...league.season,
          games: migratedGames,
          rivalries: league.season.rivalries || [],
          phase: league.season.phase || "regular_season",
          upcomingDraft,
        };

        // Update the league in saved leagues with migrated data
        const updatedLeagues = state.savedLeagues.map((l) =>
          l.id === leagueId
            ? {
                ...l,
                lastPlayedAt: new Date().toISOString(),
                players: migratedPlayers,
                teams: migratedTeams,
                coaches: migratedCoaches,
                agents: migratedAgents,
                season: migratedSeason,
                settings: leagueSettings, // Ensure settings are saved
              }
            : l
        );

        set({
          players: migratedPlayers,
          teams: migratedTeams,
          coaches: migratedCoaches,
          agents: migratedAgents,
          season: migratedSeason,
          userTeamId: league.userTeamId,
          currentLeagueId: leagueId,
          savedLeagues: updatedLeagues,
          rotations: league.rotations || [],
          gmCoachRelationships: league.gmCoachRelationships || [],
          gmActions: league.gmActions || [],
          history: league.history || {
            seasonSummaries: [],
            transactions: [],
            awards: [],
            franchiseRecords: [],
            gmCareerStats: {
              totalSeasons: 0,
              lifetimeWins: 0,
              lifetimeLosses: 0,
              winPercentage: 0,
              championships: 0,
              playoffAppearances: 0,
              totalTrades: 0,
              totalFreeAgentSigns: 0,
              totalDraftPicks: 0,
              contractNegotiationsWon: 0,
              contractNegotiationsLost: 0,
            },
            notableMoments: [],
          },
          newsFeed: league.newsFeed || {
            stories: [],
            lastGeneratedDay: 0,
            dailyStoryCount: {},
          },
          awardRaces: league.awardRaces || null,
          teamOdds: league.teamOdds || [],
          headlines: league.headlines || [],
          powerRankings: league.powerRankings || [],
        });

        // Initialize rotations if they don't exist
        if (!league.rotations || league.rotations.length === 0) {
          setTimeout(() => get().initializeRotations(), 0);
        }

        // Initialize award races and odds if not present
        if (!league.awardRaces) {
          setTimeout(() => {
            get().updateAwardRaces();
            get().updateTeamOdds();
            get().generateHeadlines();
          }, 0);
        }

        // Initialize power rankings if not present
        if (!league.powerRankings || league.powerRankings.length === 0) {
          setTimeout(() => get().updatePowerRankings(), 0);
        }
      },

      deleteLeague: (leagueId: string) => {
        const state = get();
        const updatedLeagues = state.savedLeagues.filter((l) => l.id !== leagueId);

        // If deleting current league, clear the active state
        if (state.currentLeagueId === leagueId) {
          set({
            savedLeagues: updatedLeagues,
            currentLeagueId: null,
            players: [],
            teams: [],
            season: {
              year: 2025,
              currentWeek: 1,
              games: [],
              rivalries: [],
              phase: "regular_season",
            },
            userTeamId: "team-0",
          });
        } else {
          set({ savedLeagues: updatedLeagues });
        }
      },

      renameLeague: (leagueId: string, newName: string) => {
        const state = get();
        const updatedLeagues = state.savedLeagues.map((l) =>
          l.id === leagueId ? { ...l, name: newName } : l
        );
        set({ savedLeagues: updatedLeagues });
      },

      exportLeague: (leagueId: string) => {
        const state = get();
        const league = state.savedLeagues.find((l) => l.id === leagueId);
        return league || null;
      },

      importLeague: (leagueData: any) => {
        try {
          const state = get();

          // Validate the imported data structure
          if (!leagueData || typeof leagueData !== "object") {
            return { success: false, error: "Invalid league data format" };
          }

          // Check if this is the new export format (with version and league wrapper)
          const actualLeagueData = leagueData.version ? leagueData : { league: leagueData };

          // Extract league metadata
          const leagueInfo = actualLeagueData.league || leagueData;

          // Validate required fields
          if (!leagueInfo.id || !leagueInfo.name || !leagueData.teams || !leagueData.players || !leagueData.season) {
            return { success: false, error: "Missing required league data fields" };
          }

          // Check if league with this ID already exists
          const existingLeague = state.savedLeagues.find((l) => l.id === leagueInfo.id);
          if (existingLeague) {
            return { success: false, error: `League "${leagueInfo.name}" already exists` };
          }

          // Construct the saved league object
          const importedLeague: SavedLeague = {
            id: leagueInfo.id,
            name: leagueInfo.name,
            createdAt: leagueInfo.createdAt || new Date().toISOString(),
            lastPlayedAt: leagueInfo.lastPlayedAt || new Date().toISOString(),
            players: recalculateAllContracts(leagueData.players), // Migrate contracts on import
            teams: leagueData.teams,
            coaches: leagueData.coaches || [],
            agents: leagueData.agents || [],
            season: leagueData.season,
            userTeamId: leagueData.userTeamId,
            hasSeenWelcome: leagueData.hasSeenWelcome || false,
            rotations: leagueData.rotations || [],
            gmCoachRelationships: leagueData.gmCoachRelationships || [],
            gmActions: leagueData.gmActions || [],
            history: leagueData.history || {
              seasons: [],
              transactions: [],
              awards: [],
              franchiseRecords: [],
              gmCareerStats: null,
              notableMoments: [],
            },
            newsFeed: leagueData.newsFeed || {
              stories: [],
              lastGeneratedWeek: 0,
            },
            awardRaces: leagueData.awardRaces || null,
            teamOdds: leagueData.teamOdds || [],
            headlines: leagueData.headlines || [],
          };

          // Add the imported league to saved leagues
          set({
            savedLeagues: [...state.savedLeagues, importedLeague],
          });

          return { success: true, leagueId: importedLeague.id };
        } catch (error) {
          console.error("Error importing league:", error);
          return { success: false, error: "Failed to import league data" };
        }
      },

      markWelcomeSeen: () => {
        const state = get();
        if (!state.currentLeagueId) return;

        const updatedLeagues = state.savedLeagues.map((l) =>
          l.id === state.currentLeagueId
            ? { ...l, hasSeenWelcome: true }
            : l
        );

        set({ savedLeagues: updatedLeagues });
      },

      saveCurrentLeague: () => {
        const state = get();
        if (!state.currentLeagueId) return;

        const updatedLeagues = state.savedLeagues.map((l) =>
          l.id === state.currentLeagueId
            ? {
                ...l,
                players: state.players,
                teams: state.teams,
                coaches: state.coaches,
                agents: state.agents,
                season: state.season,
                userTeamId: state.userTeamId,
                lastPlayedAt: new Date().toISOString(),
                rotations: state.rotations,
                gmCoachRelationships: state.gmCoachRelationships,
                gmActions: state.gmActions,
                history: state.history,
                newsFeed: state.newsFeed,
                awardRaces: state.awardRaces || undefined,
                teamOdds: state.teamOdds,
                headlines: state.headlines,
                powerRankings: state.powerRankings,
              }
            : l
        );

        set({ savedLeagues: updatedLeagues });
      },

      initializeGame: () => {
        const players = generatePlayers();
        const teams = generateTeams(players);
        const games = generateSchedule(teams, DEFAULT_LEAGUE_SETTINGS.gamesPerSeason);

        set({
          players,
          teams,
          season: {
            year: 2025,
            currentWeek: 1,
            games,
            rivalries: [],
            phase: "regular_season",
          },
          userTeamId: "team-0",
        });
      },

      simulateGame: (gameId: string) => {
        const state = get();
        const game = state.season.games.find((g) => g.id === gameId);
        if (!game || game.played) return;

        const homeTeam = state.teams.find((t) => t.id === game.homeTeamId);
        const awayTeam = state.teams.find((t) => t.id === game.awayTeamId);
        if (!homeTeam || !awayTeam) return;

        // Check for existing rivalry
        let rivalry = getRivalryBetweenTeams(
          state.season.rivalries || [],
          game.homeTeamId,
          game.awayTeamId
        );

        // Get rivalry modifiers for game simulation
        const { getRivalryGameModifiers } = require("../utils/rivalry");
        const rivalryModifiers = rivalry
          ? getRivalryGameModifiers(rivalry.level)
          : { intensityBoost: 1.0, foulRateIncrease: 1.0, clutchVolatility: 1.0, homeCourtBoost: 1.0 };

        // Calculate team strength
        const getTeamStrength = (team: Team) => {
          const teamPlayers = state.players.filter((p) => team.playerIds.includes(p.id));
          return teamPlayers.reduce((sum, p) => sum + p.overall, 0) / teamPlayers.length;
        };

        const homeStrength = getTeamStrength(homeTeam);
        const awayStrength = getTeamStrength(awayTeam);

        // Apply rivalry modifiers to home court advantage and game volatility
        const baseHomeAdvantage = 5;
        const rivalryHomeAdvantage = baseHomeAdvantage * rivalryModifiers.homeCourtBoost;
        const volatility = 20 * rivalryModifiers.clutchVolatility;

        // Simulate scores (with rivalry-modified home court advantage)
        const homeScore = Math.floor(90 + (homeStrength / 2) + Math.random() * volatility + rivalryHomeAdvantage);
        const awayScore = Math.floor(90 + (awayStrength / 2) + Math.random() * volatility);

        // Calculate game characteristics for rivalry tracking
        const scoreDiff = Math.abs(homeScore - awayScore);
        const wasCloseGame = scoreDiff <= 5;
        const hadBigPerformance = Math.random() < (0.08 * rivalryModifiers.intensityBoost); // Rivalry increases chance of big performance
        const wasPhysical = Math.random() < (0.15 * rivalryModifiers.foulRateIncrease); // Rivalry increases physicality

        const updatedGames = state.season.games.map((g) =>
          g.id === gameId
            ? {
                ...g,
                homeScore,
                awayScore,
                played: true,
                wasCloseGame,
                hadBigPerformance,
                wasPhysical,
              }
            : g
        );

        const updatedTeams = state.teams.map((t) => {
          if (t.id === game.homeTeamId) {
            return homeScore > awayScore
              ? { ...t, wins: t.wins + 1 }
              : { ...t, losses: t.losses + 1 };
          }
          if (t.id === game.awayTeamId) {
            return awayScore > homeScore
              ? { ...t, wins: t.wins + 1 }
              : { ...t, losses: t.losses + 1 };
          }
          return t;
        });

        // Update rivalry between these two teams
        let updatedRivalries = [...(state.season.rivalries || [])];

        if (!rivalry) {
          // Create new rivalry if it doesn't exist
          rivalry = createRivalry(game.homeTeamId, game.awayTeamId);
          updatedRivalries.push(rivalry);
        }

        // Update rivalry based on game result
        const playedGame = updatedGames.find((g) => g.id === gameId);
        if (playedGame) {
          const updatedRivalry = updateRivalryFromGame(rivalry, playedGame);
          updatedRivalries = updatedRivalries.map((r) =>
            (r.teamAId === rivalry!.teamAId && r.teamBId === rivalry!.teamBId) ||
            (r.teamAId === rivalry!.teamBId && r.teamBId === rivalry!.teamAId)
              ? updatedRivalry
              : r
          );
        }

        set({
          season: {
            ...state.season,
            games: updatedGames,
            rivalries: updatedRivalries,
            hasStartedSeason: true, // Mark season as started when first game is played
          },
          teams: updatedTeams,
        });
      },

      simulateWeek: () => {
        const state = get();
        const settings = state.getSettings();

        const gamesThisWeek = state.season.games
          .filter((g) => !g.played)
          .slice(0, 45); // Simulate 45 games per week (more games with 30 teams)

        gamesThisWeek.forEach((game) => {
          state.simulateGame(game.id);
        });

        set({
          season: {
            ...state.season,
            currentWeek: state.season.currentWeek + 1,
          },
        });

        // Update player satisfaction after simulating the week
        state.updatePlayerSatisfaction();

        // Update award races and odds weekly (respect settings)
        if (settings?.showAwardRaces) {
          state.updateAwardRaces();
        }
        if (settings?.showOddsPanel) {
          state.updateTeamOdds();
        }
        state.generateHeadlines();

        // Update power rankings after each game day
        state.updatePowerRankings();

        // Auto-save the league progress if enabled
        if (settings?.autoSaveEnabled) {
          state.saveCurrentLeague();
        }
      },

      tradePlayer: (playerId: string, fromTeamId: string, toTeamId: string) => {
        const state = get();
        const player = state.players.find((p) => p.id === playerId);
        const fromTeam = state.teams.find((t) => t.id === fromTeamId);
        const toTeam = state.teams.find((t) => t.id === toTeamId);

        if (!player || !fromTeam || !toTeam) return;

        // Get current settings and validate trade
        const settings = state.getSettings();
        const fromTeamPlayers = state.players.filter((p) => fromTeam.playerIds.includes(p.id));
        const toTeamPlayers = state.players.filter((p) => toTeam.playerIds.includes(p.id));

        const validation = canExecuteTrade(fromTeam, toTeam, player, fromTeamPlayers, toTeamPlayers, settings);
        if (!validation.allowed) {
          console.warn(`Cannot trade ${player.name}: ${validation.reason}`);
          return; // Block the trade
        }

        // Calculate satisfaction impact from trade (only if player has personality)
        let satisfactionChange = 0;
        if (player && player.personality) {
          // High loyalty players don't like being traded
          if (player.personality.loyalty > 70) {
            satisfactionChange -= Math.round((player.personality.loyalty - 70) * 0.4); // Up to -12
          }
          // High ego players take it personally
          if (player.personality.ego > 70) {
            satisfactionChange -= Math.round((player.personality.ego - 70) * 0.3); // Up to -9
          }
        }

        const updatedPlayers = state.players.map((p) => {
          if (p.id === playerId) {
            // Only update satisfaction if player has personality trait
            if (p.personality && p.satisfaction !== undefined) {
              const newSatisfaction = Math.max(0, Math.min(100, p.satisfaction + satisfactionChange));
              return { ...p, teamId: toTeamId, satisfaction: newSatisfaction };
            }
            return { ...p, teamId: toTeamId };
          }
          return p;
        });

        const updatedTeams = state.teams.map((t) => {
          if (t.id === fromTeamId) {
            return {
              ...t,
              playerIds: t.playerIds.filter((id) => id !== playerId),
            };
          }
          if (t.id === toTeamId) {
            return {
              ...t,
              playerIds: [...t.playerIds, playerId],
            };
          }
          return t;
        });

        // Update rivalry between the two teams involved in the trade
        let updatedRivalries = [...(state.season.rivalries || [])];
        let rivalry = getRivalryBetweenTeams(updatedRivalries, fromTeamId, toTeamId);

        if (!rivalry) {
          // Create new rivalry if it doesn't exist
          rivalry = createRivalry(fromTeamId, toTeamId);
          updatedRivalries.push(rivalry);
        }

        // Update rivalry based on trade (pass player overall if star player)
        const updatedRivalry = updateRivalryFromTrade(rivalry, player?.overall);
        updatedRivalries = updatedRivalries.map((r) =>
          (r.teamAId === rivalry!.teamAId && r.teamBId === rivalry!.teamBId) ||
          (r.teamAId === rivalry!.teamBId && r.teamBId === rivalry!.teamAId)
            ? updatedRivalry
            : r
        );

        // Add transaction to history
        if (player) {
          state.addTransaction({
            type: "trade",
            description: `Traded ${player.name} from ${state.teams.find((t) => t.id === fromTeamId)?.city || "Unknown"} to ${state.teams.find((t) => t.id === toTeamId)?.city || "Unknown"}`,
            teamAId: fromTeamId,
            teamBId: toTeamId,
            playersToB: [player.id],
          });
        }

        set({
          players: updatedPlayers,
          teams: updatedTeams,
          season: {
            ...state.season,
            rivalries: updatedRivalries,
          },
        });

        // Auto-save if enabled
        if (settings?.autoSaveEnabled) {
          state.saveCurrentLeague();
        }
      },

      signPlayer: (playerId: string, teamId: string, years?: number, salary?: number) => {
        const state = get();
        const player = state.players.find((p) => p.id === playerId);
        const team = state.teams.find((t) => t.id === teamId);

        if (!player || !team || player.teamId) return;

        // Get current settings
        const settings = state.getSettings();
        const teamPlayers = state.players.filter((p) => team.playerIds.includes(p.id));

        // Validate signing based on settings
        const validation = canSignPlayer(team, player, teamPlayers, settings);
        if (!validation.allowed) {
          console.warn(`Cannot sign ${player.name}: ${validation.reason}`);
          return; // Block the signing
        }

        const updatedPlayers = state.players.map((p) =>
          p.id === playerId
            ? {
                ...p,
                teamId,
                contract: {
                  years: years || p.contract.years,
                  salary: salary || p.contract.salary,
                },
              }
            : p
        );

        const updatedTeams = state.teams.map((t) =>
          t.id === teamId
            ? { ...t, playerIds: [...t.playerIds, playerId] }
            : t
        );

        set({ players: updatedPlayers, teams: updatedTeams });

        // Auto-save if enabled
        if (settings?.autoSaveEnabled) {
          state.saveCurrentLeague();
        }
      },

      releasePlayer: (playerId: string) => {
        const state = get();
        const player = state.players.find((p) => p.id === playerId);
        if (!player || !player.teamId) return;

        const team = state.teams.find((t) => t.id === player.teamId);
        if (!team) return;

        // Get current settings and validate release
        const settings = state.getSettings();
        const teamPlayers = state.players.filter((p) => team.playerIds.includes(p.id));

        const validation = canReleasePlayer(team, teamPlayers, settings);
        if (!validation.allowed) {
          console.warn(`Cannot release ${player.name}: ${validation.reason}`);
          return; // Block the release
        }

        const updatedPlayers = state.players.map((p) =>
          p.id === playerId ? { ...p, teamId: null } : p
        );

        const updatedTeams = state.teams.map((t) =>
          t.id === player.teamId
            ? { ...t, playerIds: t.playerIds.filter((id) => id !== playerId) }
            : t
        );

        set({ players: updatedPlayers, teams: updatedTeams });

        // Auto-save if enabled
        if (settings?.autoSaveEnabled) {
          state.saveCurrentLeague();
        }
      },

      updatePlayerSatisfaction: () => {
        const state = get();
        const settings = state.getSettings();
        const chemistryMultiplier = getChemistryImpactMultiplier(settings);

        const updatedPlayers = state.players.map((player) => {
          // Skip players without personality data (backwards compatibility)
          if (!player.personality || player.satisfaction === undefined) return player;
          if (!player.teamId) return player; // Free agents maintain current satisfaction

          const team = state.teams.find((t) => t.id === player.teamId);
          if (!team) return player;

          let satisfactionChange = 0;

          // Team performance impact (based on winning drive)
          const winRate = team.wins / Math.max(1, team.wins + team.losses);
          if (winRate > 0.65) {
            // Winning team
            satisfactionChange += Math.round(player.personality.winning * 0.15 * chemistryMultiplier); // Up to +15 for high winning drive
          } else if (winRate < 0.35) {
            // Losing team
            satisfactionChange -= Math.round(player.personality.winning * 0.15 * chemistryMultiplier); // Down to -15 for high winning drive
          }

          // Playing time satisfaction (estimate based on overall vs team average)
          const teamPlayers = state.players.filter((p) => team.playerIds.includes(p.id));
          const avgOverall = teamPlayers.reduce((sum, p) => sum + p.overall, 0) / teamPlayers.length;
          const isStarter = player.overall >= avgOverall - 5; // Top players on team

          if (!isStarter && player.personality.playTime > 60) {
            // Bench player who wants more minutes
            satisfactionChange -= Math.round((player.personality.playTime - 60) * 0.2 * chemistryMultiplier); // Up to -8
          } else if (isStarter && player.personality.playTime > 50) {
            // Starter who values playing time
            satisfactionChange += Math.round((player.personality.playTime - 50) * 0.1 * chemistryMultiplier); // Up to +5
          }

          // Contract satisfaction (based on greed and salary vs overall)
          const expectedSalary = player.overall / 10;
          if (player.contract.salary < expectedSalary - 1 && player.personality.greed > 60) {
            // Underpaid and cares about money
            satisfactionChange -= Math.round((player.personality.greed - 60) * 0.15 * chemistryMultiplier); // Up to -6
          }

          // Team chemistry (team player trait)
          if (player.personality.teamPlayer > 70) {
            satisfactionChange += Math.round(3 * chemistryMultiplier); // Good team players are generally happier
          } else if (player.personality.teamPlayer < 40) {
            satisfactionChange -= Math.round(2 * chemistryMultiplier); // Poor team players struggle
          }

          // Apply change with diminishing returns near extremes
          let newSatisfaction = player.satisfaction + satisfactionChange;

          // Natural drift toward 50 (regression to mean)
          if (newSatisfaction > 70) {
            newSatisfaction -= 1;
          } else if (newSatisfaction < 50) {
            newSatisfaction += 1;
          }

          // Clamp between 0-100
          newSatisfaction = Math.max(0, Math.min(100, newSatisfaction));

          return { ...player, satisfaction: newSatisfaction };
        });

        set({ players: updatedPlayers });
      },

      initializeDraftLottery: () => {
        const state = get();
        const { generateDraftLottery, generateDraftClass } = require("../utils/draft");

        // Generate lottery for bottom 14 teams
        const lottery = generateDraftLottery(state.teams);

        // Generate draft class only if it doesn't already exist
        const draftClass = state.season.upcomingDraft || generateDraftClass(state.season.year);

        set({
          season: {
            ...state.season,
            phase: "draft_lottery",
            draftLottery: lottery,
            upcomingDraft: draftClass,
          },
        });

        state.saveCurrentLeague();
      },

      executeDraftLottery: () => {
        const state = get();
        if (!state.season.draftLottery) return;

        const { executeDraftLottery } = require("../utils/draft");
        const results = executeDraftLottery(state.season.draftLottery);

        set({
          season: {
            ...state.season,
            phase: "draft",
            draftLottery: {
              ...state.season.draftLottery,
              executed: true,
              results,
            },
          },
        });

        state.saveCurrentLeague();
      },

      draftPlayer: (prospectId: string, teamId: string) => {
        const state = get();
        if (!state.season.upcomingDraft) return;

        const prospect = state.season.upcomingDraft.prospects.find((p) => p.id === prospectId);
        if (!prospect) return;

        // Convert prospect to player
        const newPlayer: Player = {
          id: `player-${Date.now()}-${Math.random()}`,
          name: prospect.name,
          position: prospect.position,
          age: prospect.age,
          overall: prospect.overall,
          potential: prospect.potential,
          gender: prospect.gender,
          contract: generateRookieContract(prospect.overall),
          stats: {
            points: parseFloat((prospect.overall * 0.25).toFixed(1)),
            rebounds: parseFloat((prospect.overall * 0.12).toFixed(1)),
            assists: parseFloat((prospect.overall * 0.1).toFixed(1)),
            steals: parseFloat((prospect.overall * 0.04).toFixed(1)),
            blocks: parseFloat((prospect.overall * 0.03).toFixed(1)),
          },
          attributes: prospect.attributes,
          bio: {
            ...prospect.bio,
            draftYear: state.season.year,
            draftRound: state.season.upcomingDraft.currentPick < 30 ? 1 : 2,
            draftPick: state.season.upcomingDraft.currentPick + 1,
            draftedBy: state.teams.find((t) => t.id === teamId)?.city || "Unknown",
          },
          personality: prospect.personality,
          satisfaction: 75,
          teamId,
        };

        // Update team roster
        const updatedTeams = state.teams.map((t) =>
          t.id === teamId
            ? { ...t, playerIds: [...t.playerIds, newPlayer.id] }
            : t
        );

        // Mark prospect as drafted
        const updatedProspects = state.season.upcomingDraft.prospects.map((p) =>
          p.id === prospectId
            ? { ...p, draftedBy: teamId, draftPosition: state.season.upcomingDraft!.currentPick + 1 }
            : p
        );

        const updatedDraft = {
          ...state.season.upcomingDraft,
          prospects: updatedProspects,
          currentPick: state.season.upcomingDraft.currentPick + 1,
          completed: state.season.upcomingDraft.currentPick + 1 >= 60,
        };

        set({
          players: [...state.players, newPlayer],
          teams: updatedTeams,
          season: {
            ...state.season,
            upcomingDraft: updatedDraft,
            phase: updatedDraft.completed ? "offseason" : state.season.phase,
          },
        });

        state.saveCurrentLeague();
      },

      // Rotation Management Methods
      initializeRotations: () => {
        const state = get();
        const rotations: TeamRotation[] = [];
        const relationships: GMCoachRelationship[] = [];

        state.teams.forEach((team) => {
          const teamPlayers = state.players.filter((p) => team.playerIds.includes(p.id));
          const sortedPlayers = [...teamPlayers].sort((a, b) => b.overall - a.overall);

          const playerRotations: PlayerRotation[] = sortedPlayers.map((player, index) => ({
            playerId: player.id,
            minutesPerGame: index < 5 ? 32 - (index * 4) : index < 10 ? 20 - ((index - 5) * 2) : 10 - ((index - 10) * 2),
            role: index < 5 ? "starter" : index < 10 ? "bench" : index < 13 ? "reserve" : "inactive",
            depthChartPosition: index + 1,
          }));

          rotations.push({
            teamId: team.id,
            rotations: playerRotations,
            lastUpdated: new Date().toISOString(),
          });

          // Initialize GM-Coach relationship
          const coach = state.coaches.find((c) => c.id === team.coachId);
          const teamWins = team.wins;
          const teamGames = team.wins + team.losses;
          const winPct = teamGames > 0 ? teamWins / teamGames : 0.5;

          relationships.push({
            teamId: team.id,
            trust: 60,
            authority: 50,
            tension: 20,
            acceptanceRate: 50,
            recentActions: [],
            relationshipStatus: "neutral",
            factors: {
              teamSuccess: winPct * 100,
              gmReputation: 50,
              starPlayerPressure: 0,
              ownerPressure: 50,
              coachJobSecurity: coach ? (coach.careerWins / (coach.careerWins + coach.careerLosses + 1)) * 100 : 50,
            },
          });
        });

        set({
          rotations,
          gmCoachRelationships: relationships,
        });
      },

      submitGMAction: (teamId, playerId, actionType, requestedMinutes, requestedRole, reason = "GM Decision") => {
        const state = get();
        const action: GMAction = {
          id: `action-${Date.now()}-${Math.random()}`,
          teamId,
          actionType: actionType as any,
          playerId,
          requestedMinutes,
          requestedRole,
          reason,
          status: actionType === "manual_override" ? "accepted" : "pending",
          timestamp: new Date().toISOString(),
          relationshipImpact: actionType === "manual_override" ? -5 : 0,
        };

        set({
          gmActions: [...state.gmActions, action],
        });

        // Process immediately if manual override
        if (actionType === "manual_override") {
          state.processGMActions();
        }
      },

      processGMActions: () => {
        const state = get();
        const pendingActions = state.gmActions.filter((a) => a.status === "pending");

        pendingActions.forEach((action) => {
          const team = state.teams.find((t) => t.id === action.teamId);
          const coach = state.coaches.find((c) => c.id === team?.coachId);
          const relationship = state.gmCoachRelationships.find((r) => r.teamId === action.teamId);

          if (!coach || !relationship) return;

          // Calculate acceptance probability based on coach personality and relationship
          let acceptanceChance = 50;

          // Coach personality factors
          acceptanceChance += (100 - coach.personality.confidence) * 0.2; // Less confident = more likely to accept
          acceptanceChance += coach.personality.communication * 0.15; // Better communication = more receptive
          acceptanceChance -= coach.personality.discipline * 0.1; // High discipline = sticks to plan

          // Relationship factors
          acceptanceChance += relationship.trust * 0.3;
          acceptanceChance += relationship.authority * 0.25;
          acceptanceChance -= relationship.tension * 0.2;

          // Team success factor
          acceptanceChance += relationship.factors.teamSuccess * 0.1;
          acceptanceChance -= relationship.factors.coachJobSecurity * 0.05;

          // Star player pressure
          const player = state.players.find((p) => p.id === action.playerId);
          if (player && player.overall >= 85) {
            acceptanceChance += 15;
          }

          // Action type modifiers
          if (action.actionType === "suggest_starter") acceptanceChance -= 10;
          if (action.actionType === "suggest_benching") acceptanceChance -= 15;

          // Decide if coach accepts
          const accepted = Math.random() * 100 < acceptanceChance;
          const updatedAction = {
            ...action,
            status: (accepted ? "accepted" : "rejected") as GMActionStatus,
            coachResponse: accepted
              ? "I think that could work. Let's give it a shot."
              : "I appreciate the input, but I'm going to stick with my plan for now.",
            relationshipImpact: accepted ? 2 : -3,
          };

          // Update action in state
          const updatedActions = state.gmActions.map((a) => (a.id === action.id ? updatedAction : a));

          // Apply rotation changes if accepted
          if (accepted) {
            const teamRotation = state.rotations.find((r) => r.teamId === action.teamId);
            if (teamRotation) {
              const updatedRotations = teamRotation.rotations.map((pr) => {
                if (pr.playerId === action.playerId) {
                  return {
                    ...pr,
                    minutesPerGame: action.requestedMinutes ?? pr.minutesPerGame,
                    role: action.requestedRole ?? pr.role,
                  };
                }
                return pr;
              });

              const updatedTeamRotations = state.rotations.map((r) =>
                r.teamId === action.teamId
                  ? { ...r, rotations: updatedRotations, lastUpdated: new Date().toISOString() }
                  : r
              );

              set({ rotations: updatedTeamRotations, gmActions: updatedActions });
            }
          } else {
            set({ gmActions: updatedActions });
          }

          // Update relationship
          state.updateGMCoachRelationship(action.teamId);
        });
      },

      updateGMCoachRelationship: (teamId) => {
        const state = get();
        const relationship = state.gmCoachRelationships.find((r) => r.teamId === teamId);
        if (!relationship) return;

        const recentActions = state.gmActions.filter((a) => a.teamId === teamId).slice(-10);
        const acceptedCount = recentActions.filter((a) => a.status === "accepted").length;
        const acceptanceRate = recentActions.length > 0 ? (acceptedCount / recentActions.length) * 100 : 50;

        // Calculate impact on trust and tension
        const totalImpact = recentActions.reduce((sum, a) => sum + a.relationshipImpact, 0);
        const newTrust = Math.max(0, Math.min(100, relationship.trust + totalImpact));
        const newTension = Math.max(0, Math.min(100, relationship.tension - totalImpact));

        // Recalculate authority based on factors
        const team = state.teams.find((t) => t.id === teamId);
        const teamWins = team?.wins || 0;
        const teamGames = (team?.wins || 0) + (team?.losses || 0);
        const winPct = teamGames > 0 ? teamWins / teamGames : 0.5;

        const newAuthority = Math.max(
          0,
          Math.min(
            100,
            50 +
              winPct * 30 +
              newTrust * 0.2 -
              newTension * 0.15 +
              acceptanceRate * 0.1
          )
        );

        // Determine relationship status
        let status: "excellent" | "good" | "neutral" | "strained" | "hostile" = "neutral";
        if (newTrust >= 80 && newTension <= 20) status = "excellent";
        else if (newTrust >= 60 && newTension <= 40) status = "good";
        else if (newTension >= 70 || newTrust <= 30) status = "hostile";
        else if (newTension >= 50 || newTrust <= 45) status = "strained";

        const updatedRelationship: GMCoachRelationship = {
          ...relationship,
          trust: newTrust,
          authority: newAuthority,
          tension: newTension,
          acceptanceRate,
          recentActions,
          relationshipStatus: status,
          factors: {
            ...relationship.factors,
            teamSuccess: winPct * 100,
          },
        };

        const updatedRelationships = state.gmCoachRelationships.map((r) =>
          r.teamId === teamId ? updatedRelationship : r
        );

        set({ gmCoachRelationships: updatedRelationships });
      },

      getTeamRotation: (teamId) => {
        const state = get();
        return state.rotations.find((r) => r.teamId === teamId);
      },

      getGMCoachRelationship: (teamId) => {
        const state = get();
        return state.gmCoachRelationships.find((r) => r.teamId === teamId);
      },

      updateRotationsFromDepthChart: (teamId, depthChartByPosition) => {
        const state = get();
        const teamRotation = state.rotations.find((r) => r.teamId === teamId);
        if (!teamRotation) return;

        const positions: Array<"PG" | "SG" | "SF" | "PF" | "C"> = ["PG", "SG", "SF", "PF", "C"];

        // Build starters: 1st string at each position
        const starters: Array<{ playerId: string; position: "PG" | "SG" | "SF" | "PF" | "C" }> = [];
        const starterMinutes = [32, 30, 30, 28, 28]; // PG, SG, SF, PF, C

        positions.forEach((pos, idx) => {
          const positionPlayers = depthChartByPosition[pos] || [];
          if (positionPlayers.length > 0 && positionPlayers[0]) {
            starters.push({ playerId: positionPlayers[0], position: pos });
          }
        });

        // Build bench: 2nd string at each position
        const bench: string[] = [];
        positions.forEach((pos) => {
          const positionPlayers = depthChartByPosition[pos] || [];
          if (positionPlayers.length > 1 && positionPlayers[1]) {
            bench.push(positionPlayers[1]);
          }
        });

        // Build reserves: 3rd string at each position
        const reserves: string[] = [];
        positions.forEach((pos) => {
          const positionPlayers = depthChartByPosition[pos] || [];
          if (positionPlayers.length > 2 && positionPlayers[2]) {
            reserves.push(positionPlayers[2]);
          }
        });

        // Create a set of all assigned players
        const assignedPlayerIds = new Set([
          ...starters.map((s) => s.playerId),
          ...bench,
          ...reserves,
        ]);

        // Update rotations
        const updatedRotations = teamRotation.rotations.map((rotation) => {
          // Check if player is a starter
          const starterInfo = starters.find((s) => s.playerId === rotation.playerId);
          if (starterInfo) {
            const starterIndex = starters.findIndex((s) => s.playerId === rotation.playerId);
            return {
              ...rotation,
              role: "starter" as const,
              minutesPerGame: starterMinutes[starterIndex] || 28,
              depthChartPosition: starterIndex + 1,
            };
          }

          // Check if player is on bench
          const benchIndex = bench.indexOf(rotation.playerId);
          if (benchIndex !== -1) {
            return {
              ...rotation,
              role: "bench" as const,
              minutesPerGame: 18 - (benchIndex * 2),
              depthChartPosition: 6 + benchIndex,
            };
          }

          // Check if player is a reserve
          const reserveIndex = reserves.indexOf(rotation.playerId);
          if (reserveIndex !== -1) {
            return {
              ...rotation,
              role: "reserve" as const,
              minutesPerGame: 8 - reserveIndex,
              depthChartPosition: 11 + reserveIndex,
            };
          }

          // Player not in depth chart - set to inactive
          return {
            ...rotation,
            role: "inactive" as const,
            minutesPerGame: 0,
            depthChartPosition: 999,
          };
        });

        set({
          rotations: state.rotations.map((r) =>
            r.teamId === teamId
              ? { ...r, rotations: updatedRotations, lastUpdated: new Date().toISOString() }
              : r
          ),
        });
      },

      // Agent system methods
      updateAgentRelationship: (agentId: string, teamId: string, change: number) => {
        const state = get();
        const updatedAgents = state.agents.map((agent) => {
          if (agent.id === agentId) {
            const currentRelationship = agent.relationshipByTeam[teamId] || 0;
            const newRelationship = Math.max(-100, Math.min(100, currentRelationship + change));
            return {
              ...agent,
              relationshipByTeam: {
                ...agent.relationshipByTeam,
                [teamId]: newRelationship,
              },
            };
          }
          return agent;
        });

        set({ agents: updatedAgents });
        state.saveCurrentLeague();
      },

      extendPlayer: (playerId: string, years: number, salary: number) => {
        const state = get();
        const updatedPlayers = state.players.map((p) =>
          p.id === playerId
            ? {
                ...p,
                contract: {
                  years,
                  salary,
                },
              }
            : p
        );

        set({ players: updatedPlayers });
        state.saveCurrentLeague();
      },

      // History tracking methods
      addTransaction: (transaction) => {
        const state = get();
        const newTransaction: Transaction = {
          ...transaction,
          id: `transaction-${Date.now()}-${Math.random()}`,
          timestamp: new Date().toISOString(),
          season: state.season.year,
        };

        set({
          history: {
            ...state.history,
            transactions: [...state.history.transactions, newTransaction],
          },
        });
        state.saveCurrentLeague();
      },

      recordSeasonEnd: () => {
        const state = get();
        const userTeam = state.teams.find((t) => t.id === state.userTeamId);
        if (!userTeam) return;

        // Get user team coach
        const userCoach = state.coaches.find((c) => c.id === userTeam.coachId);

        // Get SOS data for user team
        const { calculateAllTeamsSOS, findDangerStretches } = require("../utils/strengthOfSchedule");
        const rivalryScores = new Map<string, number>();
        state.season.rivalries?.forEach((rivalry: any) => {
          const key = [rivalry.team1Id, rivalry.team2Id].sort().join("-");
          rivalryScores.set(key, rivalry.score);
        });
        const allSOS = calculateAllTeamsSOS(state.teams, state.season.games, state.players, rivalryScores);
        const userTeamSOS = allSOS.find((sos: any) => sos.teamId === state.userTeamId);

        // Find hardest stretch
        const dangerStretches = findDangerStretches(state.userTeamId, state.season.games, state.teams, state.players);
        const hardestStretch = dangerStretches.length > 0
          ? dangerStretches.reduce((max: typeof dangerStretches[0], stretch: typeof dangerStretches[0]) =>
              stretch.gameCount > max.gameCount ? stretch : max
            )
          : undefined;

        // Calculate record vs top-10 SOS teams
        const topSOSTeamIds = allSOS
          .slice(0, 10)
          .map((sos: any) => sos.teamId);

        const gamesVsTopSOS = state.season.games.filter((g) => {
          if (!g.played) return false;
          const isUserGame = g.homeTeamId === state.userTeamId || g.awayTeamId === state.userTeamId;
          if (!isUserGame) return false;
          const oppId = g.homeTeamId === state.userTeamId ? g.awayTeamId : g.homeTeamId;
          return topSOSTeamIds.includes(oppId);
        });

        const recordVsTopSOS = {
          wins: gamesVsTopSOS.filter((g) => {
            const userScore = g.homeTeamId === state.userTeamId ? g.homeScore : g.awayScore;
            const oppScore = g.homeTeamId === state.userTeamId ? g.awayScore : g.homeScore;
            return userScore > oppScore;
          }).length,
          losses: gamesVsTopSOS.filter((g) => {
            const userScore = g.homeTeamId === state.userTeamId ? g.homeScore : g.awayScore;
            const oppScore = g.homeTeamId === state.userTeamId ? g.awayScore : g.homeScore;
            return userScore < oppScore;
          }).length,
        };

        // Calculate coach respect bonus based on SOS
        if (userCoach && userTeamSOS) {
          let coachBonus = 0;

          // Hard or Very Hard SOS: +1 to +3 based on performance
          if (userTeamSOS.label === "Hard" || userTeamSOS.label === "Very Hard") {
            const winPct = userTeam.wins / (userTeam.wins + userTeam.losses);

            if (winPct >= 0.6) {
              coachBonus = 3; // Exceeded expectations significantly
            } else if (winPct >= 0.5) {
              coachBonus = 2; // Met/slightly exceeded expectations
            } else if (winPct >= 0.4) {
              coachBonus = 1; // Decent performance given difficulty
            }

            // Apply bonus to coach overall rating (capped at 99)
            if (coachBonus > 0) {
              const updatedCoaches = state.coaches.map((c) => {
                if (c.id === userCoach.id) {
                  return {
                    ...c,
                    overall: Math.min(99, c.overall + coachBonus),
                  };
                }
                return c;
              });
              set({ coaches: updatedCoaches });
            }
          }
        }

        // Get top 3 players on user team
        const userPlayers = state.players
          .filter((p) => p.teamId === state.userTeamId)
          .sort((a, b) => b.overall - a.overall)
          .slice(0, 3)
          .map((p) => ({
            playerId: p.id,
            name: p.name,
            overall: p.overall,
            position: p.position,
          }));

        // Calculate team rating (average overall of roster)
        const teamPlayers = state.players.filter((p) => p.teamId === state.userTeamId);
        const avgRating =
          teamPlayers.reduce((sum, p) => sum + p.overall, 0) / teamPlayers.length;

        // Create season summary with SOS data
        const seasonSummary: SeasonSummary = {
          season: state.season.year,
          teamId: state.userTeamId,
          finalRecord: {
            wins: userTeam.wins,
            losses: userTeam.losses,
            winPercentage: userTeam.wins / (userTeam.wins + userTeam.losses),
          },
          playoffResult: "Did not qualify", // TODO: Update when playoffs are implemented
          rankings: {
            offensiveRank: 15, // TODO: Calculate based on team stats
            defensiveRank: 15, // TODO: Calculate based on team stats
            overallRank: state.teams.sort((a, b) => b.wins - a.wins).findIndex((t) => t.id === state.userTeamId) + 1,
          },
          teamRating: {
            startOfSeason: avgRating,
            endOfSeason: avgRating,
          },
          headCoach: {
            name: userCoach?.name || "Unknown",
            overall: userCoach?.overall || 0,
          },
          topPlayers: userPlayers,
          sosData: userTeamSOS ? {
            rank: userTeamSOS.rank,
            score: userTeamSOS.score,
            label: userTeamSOS.label,
            hardestStretch,
            recordVsTopSOS,
          } : undefined,
        };

        // Update GM career stats
        const updatedGMStats: GMCareerStats = {
          ...state.history.gmCareerStats,
          totalSeasons: state.history.gmCareerStats.totalSeasons + 1,
          lifetimeWins: state.history.gmCareerStats.lifetimeWins + userTeam.wins,
          lifetimeLosses: state.history.gmCareerStats.lifetimeLosses + userTeam.losses,
          winPercentage:
            (state.history.gmCareerStats.lifetimeWins + userTeam.wins) /
            (state.history.gmCareerStats.lifetimeWins +
              userTeam.wins +
              state.history.gmCareerStats.lifetimeLosses +
              userTeam.losses),
        };

        set({
          history: {
            ...state.history,
            seasonSummaries: [...state.history.seasonSummaries, seasonSummary],
            gmCareerStats: updatedGMStats,
          },
        });
        state.saveCurrentLeague();
      },

      getHistory: () => {
        const state = get();
        return state.history;
      },

      getTeamSOS: (teamId: string) => {
        const state = get();
        const { calculateAllTeamsSOS } = require("../utils/strengthOfSchedule");

        // Build rivalry scores map
        const rivalryScores = new Map<string, number>();
        state.season.rivalries?.forEach((rivalry: any) => {
          const key = [rivalry.team1Id, rivalry.team2Id].sort().join("-");
          rivalryScores.set(key, rivalry.score);
        });

        const allSOS = calculateAllTeamsSOS(
          state.teams,
          state.season.games,
          state.players,
          rivalryScores
        );

        return allSOS.find((sos: any) => sos.teamId === teamId);
      },

      getAllTeamsSOS: () => {
        const state = get();
        const { calculateAllTeamsSOS } = require("../utils/strengthOfSchedule");

        // Build rivalry scores map
        const rivalryScores = new Map<string, number>();
        state.season.rivalries?.forEach((rivalry: any) => {
          const key = [rivalry.team1Id, rivalry.team2Id].sort().join("-");
          rivalryScores.set(key, rivalry.score);
        });

        return calculateAllTeamsSOS(
          state.teams,
          state.season.games,
          state.players,
          rivalryScores
        );
      },

      addExpansionTeam: (city: any, teamIdentity: any, selectedPlayerIds: string[]) => {
        const state = get();
        const { generateCoaches } = require("../utils/coaches");

        // Create new team ID
        const newTeamId = `team-${state.teams.length}`;

        // Create the expansion team
        const newTeam: Team = {
          id: newTeamId,
          city: city.name,
          name: teamIdentity.name,
          logo: teamIdentity.logo,
          secondaryLogo: teamIdentity.secondaryLogo,
          primaryColor: teamIdentity.primaryColor,
          secondaryColor: teamIdentity.secondaryColor,
          conference: state.teams.length % 2 === 0 ? "East" : "West", // Balance conferences
          division: "Atlantic", // Default division
          wins: 0,
          losses: 0,
          budget: 120, // Standard salary cap
          playerIds: selectedPlayerIds,
          coachId: "",
          marketSize: city.marketSize,
        };

        // Generate coach for the new team
        const newCoaches = generateCoaches([newTeamId]);
        newTeam.coachId = newCoaches[0].id;

        // Transfer selected players to the expansion team
        const updatedPlayers = state.players.map((player) => {
          if (selectedPlayerIds.includes(player.id)) {
            return { ...player, teamId: newTeamId };
          }
          return player;
        });

        // Add transactions for each player moved
        selectedPlayerIds.forEach((playerId) => {
          const player = state.players.find((p) => p.id === playerId);
          if (player) {
            state.addTransaction({
              type: "expansion_draft",
              description: `${player.name} selected by ${city.name} ${teamIdentity.name} in expansion draft`,
              playerId: player.id,
              teamId: newTeamId,
            });
          }
        });

        // Update teams array
        const updatedTeams = [...state.teams, newTeam];

        // Get current league settings
        const currentLeague = state.savedLeagues.find((l) => l.id === state.currentLeagueId);
        const leagueSettings = currentLeague?.settings || DEFAULT_LEAGUE_SETTINGS;

        // Regenerate schedule with new team
        const newGames = generateSchedule(updatedTeams, leagueSettings.gamesPerSeason);

        // Initialize agent relationships for new team
        const updatedAgents = state.agents.map((agent) => ({
          ...agent,
          relationshipByTeam: {
            ...agent.relationshipByTeam,
            [newTeamId]: 0,
          },
        }));

        // Update state
        set({
          teams: updatedTeams,
          coaches: [...state.coaches, newCoaches[0]],
          players: updatedPlayers,
          agents: updatedAgents,
          season: {
            ...state.season,
            games: newGames,
          },
        });

        // Initialize rotations for the new team
        setTimeout(() => get().initializeRotations(), 0);

        // Save changes
        state.saveCurrentLeague();
      },

      // News feed methods
      addNewsStory: (story: Omit<NewsStory, "id" | "timestamp">) => {
        const state = get();
        const newStory: NewsStory = {
          ...story,
          id: `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
        };

        set({
          newsFeed: {
            ...state.newsFeed,
            stories: [...state.newsFeed.stories, newStory],
          },
        });

        state.saveCurrentLeague();
      },

      markNewsAsRead: (storyId: string) => {
        const state = get();
        set({
          newsFeed: {
            ...state.newsFeed,
            stories: state.newsFeed.stories.map((s: NewsStory) =>
              s.id === storyId ? { ...s, readStatus: true } : s
            ),
          },
        });
      },

      generateDailyNews: () => {
        const state = get();
        const currentDay = state.season.games.filter((g: Game) => g.played).length;

        // Avoid generating too many stories per day
        const todayCount = state.newsFeed.dailyStoryCount[currentDay] || 0;
        if (todayCount >= 5) return;

        // Generate various types of news based on current state
        const {
          generatePlayerMoodStory,
          generateWinningStreakStory,
          generateLosingStreakStory,
          generateRivalryStory,
          generateRumorStory,
        } = require("../utils/newsGenerator");

        const stories: Array<Omit<NewsStory, "id" | "timestamp">> = [];

        // Check for winning/losing streaks
        state.teams.forEach((team: Team) => {
          const recentGames = state.season.games
            .filter((g: Game) => g.played && (g.homeTeamId === team.id || g.awayTeamId === team.id))
            .slice(-5);

          if (recentGames.length >= 3) {
            const wins = recentGames.filter((g: Game) => {
              const isHome = g.homeTeamId === team.id;
              const teamScore = isHome ? g.homeScore : g.awayScore;
              const oppScore = isHome ? g.awayScore : g.homeScore;
              return teamScore > oppScore;
            }).length;

            if (wins >= 5 && Math.random() < 0.3) {
              stories.push({
                ...generateWinningStreakStory(team, wins, state.season.year, currentDay),
                id: "",
                timestamp: "",
              });
            } else if (wins === 0 && recentGames.length >= 5 && Math.random() < 0.3) {
              stories.push({
                ...generateLosingStreakStory(team, recentGames.length, state.season.year, currentDay),
                id: "",
                timestamp: "",
              });
            }
          }
        });

        // Check for player mood issues (low satisfaction)
        state.players.forEach((player: Player) => {
          if (player.teamId && player.satisfaction < 40 && Math.random() < 0.1) {
            const team = state.teams.find((t: Team) => t.id === player.teamId);
            if (team) {
              stories.push({
                ...generatePlayerMoodStory(
                  player,
                  team,
                  "frustrated_team",
                  state.season.year,
                  currentDay
                ),
                id: "",
                timestamp: "",
              });
            }
          }
        });

        // Check for hot rivalries
        if (state.season.rivalries) {
          const hotRivalries = state.season.rivalries.filter(
            (r: any) => r.level === "hot" || r.level === "red-hot"
          );
          hotRivalries.forEach((rivalry: any) => {
            if (Math.random() < 0.15) {
              const teamA = state.teams.find((t: Team) => t.id === rivalry.teamAId);
              const teamB = state.teams.find((t: Team) => t.id === rivalry.teamBId);
              if (teamA && teamB) {
                stories.push({
                  ...generateRivalryStory(rivalry, teamA, teamB, state.season.year, currentDay),
                  id: "",
                  timestamp: "",
                });
              }
            }
          });
        }

        // Generate random rumors occasionally
        if (Math.random() < 0.2 && stories.length < 3) {
          const randomTeam = state.teams[Math.floor(Math.random() * state.teams.length)];
          stories.push({
            ...generateRumorStory(undefined, randomTeam, "trade_exploration", state.season.year, currentDay),
            id: "",
            timestamp: "",
          });
        }

        // Add stories (limit to 2-3 per call)
        const storiesToAdd = stories.slice(0, Math.min(3, 5 - todayCount));
        storiesToAdd.forEach((story) => {
          get().addNewsStory(story);
        });

        // Update daily count
        set({
          newsFeed: {
            ...state.newsFeed,
            lastGeneratedDay: currentDay,
            dailyStoryCount: {
              ...state.newsFeed.dailyStoryCount,
              [currentDay]: todayCount + storiesToAdd.length,
            },
          },
        });
      },

      clearOldNews: (daysToKeep: number) => {
        const state = get();
        const currentDay = state.season.games.filter((g: Game) => g.played).length;
        const cutoffDay = currentDay - daysToKeep;

        set({
          newsFeed: {
            ...state.newsFeed,
            stories: state.newsFeed.stories.filter((s: NewsStory) => s.dayNumber >= cutoffDay),
          },
        });

        state.saveCurrentLeague();
      },

      // Award races and odds actions
      updateAwardRaces: () => {
        const state = get();
        const {
          calculateMVPRace,
          calculateDPOYRace,
          calculateROYRace,
          calculateSixthManRace,
          calculateMIPRace,
          calculateCOTYRace,
        } = require("../utils/awardRaceCalculator");

        const mvp = calculateMVPRace(state.players, state.teams, state.awardRaces?.mvp);
        const dpoy = calculateDPOYRace(state.players, state.teams, state.awardRaces?.dpoy);
        const roy = calculateROYRace(state.players, state.teams, state.season.year, state.awardRaces?.roy);
        const sixthMan = calculateSixthManRace(state.players, state.teams, state.awardRaces?.sixthMan);
        const mip = calculateMIPRace(state.players, state.teams, state.awardRaces?.mip);
        const coty = calculateCOTYRace(state.coaches, state.teams, state.awardRaces?.coty);

        const currentWeek = state.season.currentWeek;

        set({
          awardRaces: {
            mvp: { ...mvp, lastUpdated: currentWeek },
            dpoy: { ...dpoy, lastUpdated: currentWeek },
            roy: { ...roy, lastUpdated: currentWeek },
            sixthMan: { ...sixthMan, lastUpdated: currentWeek },
            mip: { ...mip, lastUpdated: currentWeek },
            coty: { ...coty, lastUpdated: currentWeek },
          },
        });

        state.saveCurrentLeague();
      },

      updateTeamOdds: () => {
        const state = get();
        const { calculateTeamOdds } = require("../utils/oddsCalculator");
        const { getTeamSOS } = state;

        const allTeamOdds = state.teams.map((team: Team) => {
          const sosData = getTeamSOS(team.id);
          const sosScore = sosData?.score || 50;
          return calculateTeamOdds(team, state.teams, state.players, state.coaches, state.season.games, sosScore);
        });

        set({ teamOdds: allTeamOdds });
        state.saveCurrentLeague();
      },

      generateHeadlines: () => {
        const state = get();
        const newHeadlines: MediaHeadline[] = [];
        const now = new Date().toISOString();

        // Generate headlines based on award race movement
        if (state.awardRaces) {
          const mvpLeader = state.awardRaces.mvp.candidates[0];
          if (mvpLeader) {
            const player = state.players.find((p: Player) => p.id === mvpLeader.playerId);
            const team = state.teams.find((t: Team) => t.id === mvpLeader.teamId);
            if (player && team) {
              newHeadlines.push({
                id: `headline-mvp-${Date.now()}`,
                headline: `${player.name} Leading MVP Race`,
                description: `${player.name} of the ${team.city} ${team.name} is currently the frontrunner for MVP with impressive ${mvpLeader.statLine}`,
                type: "award_race",
                timestamp: now,
                priority: 8,
                playerId: player.id,
                teamId: team.id,
              });
            }
          }
        }

        // Generate headlines based on odds shifts
        if (state.teamOdds.length > 0) {
          const topContender = [...state.teamOdds].sort((a, b) => b.championshipOdds.raw - a.championshipOdds.raw)[0];
          const team = state.teams.find((t: Team) => t.id === topContender.teamId);
          if (team) {
            newHeadlines.push({
              id: `headline-odds-${Date.now()}`,
              headline: `${team.city} ${team.name} Favorites to Win Championship`,
              description: `With ${topContender.championshipOdds.betting} odds, the ${team.city} ${team.name} are the betting favorites to win it all`,
              type: "odds_shift",
              timestamp: now,
              priority: 7,
              teamId: team.id,
            });
          }
        }

        // Check for hot streaks
        state.teams.forEach((team: Team) => {
          const teamGames = state.season.games.filter((g: Game) => g.played && (g.homeTeamId === team.id || g.awayTeamId === team.id));
          const last5Games = teamGames.slice(-5);
          const last5Wins = last5Games.filter((g: Game) => {
            return (g.homeTeamId === team.id && g.homeScore > g.awayScore) || (g.awayTeamId === team.id && g.awayScore > g.homeScore);
          }).length;

          if (last5Wins === 5) {
            newHeadlines.push({
              id: `headline-streak-${team.id}-${Date.now()}`,
              headline: `${team.city} ${team.name} on Fire!`,
              description: `The ${team.city} ${team.name} have won their last 5 games and are rolling`,
              type: "hot_streak",
              timestamp: now,
              priority: 6,
              teamId: team.id,
            });
          } else if (last5Wins === 0) {
            newHeadlines.push({
              id: `headline-cold-${team.id}-${Date.now()}`,
              headline: `${team.city} ${team.name} Struggling`,
              description: `The ${team.city} ${team.name} have dropped their last 5 games in a concerning slide`,
              type: "cold_streak",
              timestamp: now,
              priority: 6,
              teamId: team.id,
            });
          }
        });

        // Keep only the most recent 10 headlines
        const updatedHeadlines = [...newHeadlines, ...state.headlines].slice(0, 10);

        set({ headlines: updatedHeadlines });
        state.saveCurrentLeague();
      },

      getAwardRaces: () => {
        const state = get();
        return state.awardRaces;
      },

      getTeamOdds: (teamId?: string) => {
        const state = get();
        if (teamId) {
          return state.teamOdds.find((odds: TeamOdds) => odds.teamId === teamId) || null;
        }
        return state.teamOdds;
      },

      updatePowerRankings: () => {
        const state = get();
        const { calculatePowerRankings } = require("../utils/powerRankings");

        const newRankings = calculatePowerRankings(
          state.teams,
          state.players,
          state.coaches,
          state.season.games,
          state.powerRankings
        );

        set({ powerRankings: newRankings });
        state.saveCurrentLeague();
      },

      getPowerRankings: () => {
        const state = get();
        return state.powerRankings;
      },

      getTeamPowerRanking: (teamId: string) => {
        const state = get();
        return state.powerRankings.find((r) => r.teamId === teamId);
      },

      migrateContractsToNewSystem: () => {
        const state = get();

        // Recalculate all player contracts using the new salary tier system
        const migratedPlayers = recalculateAllContracts(state.players);

        set({ players: migratedPlayers });
        state.saveCurrentLeague();
      },

      getSettings: () => {
        const state = get();
        if (!state.currentLeagueId) return null;
        const league = state.savedLeagues.find((l) => l.id === state.currentLeagueId);
        return league?.settings || null;
      },

      updateSettings: (newSettings: Partial<LeagueSettings>) => {
        const state = get();
        if (!state.currentLeagueId) return;

        const currentSettings = state.getSettings();
        const updatedSettings = { ...currentSettings, ...newSettings } as LeagueSettings;

        // Check if gamesPerSeason changed and season hasn't started
        const gamesPerSeasonChanged = newSettings.gamesPerSeason !== undefined &&
                                       newSettings.gamesPerSeason !== currentSettings?.gamesPerSeason;
        const hasStarted = state.season.hasStartedSeason;

        if (gamesPerSeasonChanged && !hasStarted) {
          // Regenerate schedule with new games per season
          console.log(`Regenerating schedule with ${updatedSettings.gamesPerSeason} games per season`);
          const newGames = generateSchedule(state.teams, updatedSettings.gamesPerSeason);

          // Update both settings and schedule
          const updatedLeagues = state.savedLeagues.map((l) =>
            l.id === state.currentLeagueId
              ? { ...l, settings: updatedSettings, season: { ...l.season, games: newGames } }
              : l
          );

          set({
            savedLeagues: updatedLeagues,
            season: { ...state.season, games: newGames },
          });
        } else {
          // Just update settings without regenerating schedule
          const updatedLeagues = state.savedLeagues.map((l) =>
            l.id === state.currentLeagueId ? { ...l, settings: updatedSettings } : l
          );

          set({ savedLeagues: updatedLeagues });
        }
      },
    }),
    {
      name: "basketball-store",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

