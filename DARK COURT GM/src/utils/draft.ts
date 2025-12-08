import {
  Team,
  DraftLottery,
  DraftLotteryTeam,
  DraftLotteryResult,
  DraftClass,
  DraftProspect,
} from "../types/basketball";

// NBA Draft Lottery Odds (2024 system)
const LOTTERY_ODDS = [
  { pingPongBalls: 140, odds: 14.0 }, // Worst record
  { pingPongBalls: 140, odds: 14.0 }, // 2nd worst
  { pingPongBalls: 140, odds: 14.0 }, // 3rd worst
  { pingPongBalls: 125, odds: 12.5 },
  { pingPongBalls: 105, odds: 10.5 },
  { pingPongBalls: 90, odds: 9.0 },
  { pingPongBalls: 75, odds: 7.5 },
  { pingPongBalls: 60, odds: 6.0 },
  { pingPongBalls: 45, odds: 4.5 },
  { pingPongBalls: 30, odds: 3.0 },
  { pingPongBalls: 20, odds: 2.0 },
  { pingPongBalls: 15, odds: 1.5 },
  { pingPongBalls: 10, odds: 1.0 },
  { pingPongBalls: 5, odds: 0.5 },
];

/**
 * Generate draft lottery for non-playoff teams
 */
export function generateDraftLottery(teams: Team[]): DraftLottery {
  // Sort teams by wins (ascending) - worst teams first
  const sortedTeams = [...teams].sort((a, b) => {
    const aWins = a.wins;
    const bWins = b.wins;
    if (aWins !== bWins) return aWins - bWins;
    // Tiebreaker: losses (more losses = worse)
    return b.losses - a.losses;
  });

  // Take bottom 14 teams for lottery
  const lotteryTeams: DraftLotteryTeam[] = sortedTeams.slice(0, 14).map((team, index) => {
    const oddsData = LOTTERY_ODDS[index] || LOTTERY_ODDS[LOTTERY_ODDS.length - 1];
    return {
      teamId: team.id,
      wins: team.wins,
      losses: team.losses,
      lotteryOdds: oddsData.odds,
      pingPongBalls: oddsData.pingPongBalls,
    };
  });

  return {
    teams: lotteryTeams,
    executed: false,
  };
}

/**
 * Execute the draft lottery to determine draft order
 */
export function executeDraftLottery(lottery: DraftLottery): DraftLotteryResult[] {
  if (lottery.executed && lottery.results) {
    return lottery.results;
  }

  const results: DraftLotteryResult[] = [];
  const availableTeams = [...lottery.teams];
  const totalCombinations = 1000;

  // Determine top 4 picks via lottery
  for (let pick = 1; pick <= 4; pick++) {
    // Calculate total remaining ping pong balls
    const totalBalls = availableTeams.reduce((sum, team) => sum + team.pingPongBalls, 0);

    // Generate random number
    const randomBall = Math.floor(Math.random() * totalBalls);

    // Find which team wins this pick
    let runningTotal = 0;
    let winningTeamIndex = 0;

    for (let i = 0; i < availableTeams.length; i++) {
      runningTotal += availableTeams[i].pingPongBalls;
      if (randomBall < runningTotal) {
        winningTeamIndex = i;
        break;
      }
    }

    const winningTeam = availableTeams[winningTeamIndex];
    const originalPick = lottery.teams.findIndex((t) => t.teamId === winningTeam.teamId) + 1;

    results.push({
      teamId: winningTeam.teamId,
      originalPick,
      draftPosition: pick,
      movedUp: pick < originalPick,
      movedDown: false,
    });

    // Remove team from available teams
    availableTeams.splice(winningTeamIndex, 1);
  }

  // Remaining teams pick in reverse order of record (picks 5-14)
  availableTeams.forEach((team, index) => {
    const originalPick = lottery.teams.findIndex((t) => t.teamId === team.teamId) + 1;
    const draftPosition = 5 + index;

    results.push({
      teamId: team.teamId,
      originalPick,
      draftPosition,
      movedUp: false,
      movedDown: draftPosition > originalPick,
    });
  });

  // Add non-lottery teams (picks 15-30) in reverse order of record
  // This would be playoff teams, but for simplicity we'll skip them for now
  // They'd be added based on playoff performance

  return results;
}

/**
 * Generate a draft class with prospects
 */
export function generateDraftClass(year: number, numProspects: number = 100, gender: "male" | "female" | "mixed" = "male"): DraftClass {
  const prospects: DraftProspect[] = [];

  // Define positional distribution for 100 players
  // PG: 20, SG: 20, SF: 20, PF: 20, C: 20
  const positionQuotas = {
    PG: 20,
    SG: 20,
    SF: 20,
    PF: 20,
    C: 20,
  };

  const positionCounts = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };

  // Generate prospects with varying quality and positional balance
  for (let i = 0; i < numProspects; i++) {
    // Determine position based on quotas
    const positions: Array<"PG" | "SG" | "SF" | "PF" | "C"> = ["PG", "SG", "SF", "PF", "C"];
    let selectedPosition: "PG" | "SG" | "SF" | "PF" | "C";

    // Find positions that haven't met their quota
    const availablePositions = positions.filter(
      (pos) => positionCounts[pos] < positionQuotas[pos]
    );

    if (availablePositions.length > 0) {
      selectedPosition = availablePositions[Math.floor(Math.random() * availablePositions.length)];
    } else {
      // Fallback to any position
      selectedPosition = positions[Math.floor(Math.random() * positions.length)];
    }

    positionCounts[selectedPosition]++;

    const prospect = generateDraftProspect(i + 1, year, selectedPosition, gender);
    prospects.push(prospect);
  }

  // Sort by overall rating (best prospects first)
  prospects.sort((a, b) => b.overall - a.overall);

  return {
    year,
    prospects,
    currentPick: 0,
    completed: false,
  };
}

/**
 * Generate a single draft prospect
 */
function generateDraftProspect(pickNumber: number, draftYear: number, position?: "PG" | "SG" | "SF" | "PF" | "C", gender: "male" | "female" | "mixed" = "male"): DraftProspect {
  if (!position) {
    const positions: Array<"PG" | "SG" | "SF" | "PF" | "C"> = ["PG", "SG", "SF", "PF", "C"];
    position = positions[Math.floor(Math.random() * positions.length)];
  }

  // Quality tiers based on draft position with expanded depth
  let overallRange: [number, number];
  let potentialBonus: number;
  let tier: string;

  if (pickNumber <= 3) {
    // Top 3: Elite/Franchise prospects (Lottery-caliber tier 1)
    overallRange = [80, 88];
    potentialBonus = 12;
    tier = "lottery-elite";
  } else if (pickNumber <= 10) {
    // Picks 4-10: High lottery (Lottery-caliber tier 2)
    overallRange = [75, 82];
    potentialBonus = 10;
    tier = "lottery-high";
  } else if (pickNumber <= 14) {
    // Picks 11-14: Late lottery
    overallRange = [72, 78];
    potentialBonus = 9;
    tier = "lottery-late";
  } else if (pickNumber <= 20) {
    // Picks 15-20: Premium first round
    overallRange = [68, 75];
    potentialBonus = 8;
    tier = "first-round-premium";
  } else if (pickNumber <= 30) {
    // Picks 21-30: Standard first round
    overallRange = [65, 72];
    potentialBonus = 7;
    tier = "first-round";
  } else if (pickNumber <= 40) {
    // Picks 31-40: Early second round
    overallRange = [62, 68];
    potentialBonus = 6;
    tier = "second-round-early";
  } else if (pickNumber <= 50) {
    // Picks 41-50: Mid second round (Sleepers)
    overallRange = [58, 65];
    potentialBonus = 8; // Higher potential for sleepers
    tier = "sleeper";
  } else if (pickNumber <= 70) {
    // Picks 51-70: Late second round (Long-shots)
    overallRange = [55, 62];
    potentialBonus = 10; // Even higher potential for long-shots
    tier = "long-shot";
  } else {
    // Picks 71-100: International stash prospects
    overallRange = [52, 60];
    potentialBonus = 12; // Highest potential for stash prospects
    tier = "international-stash";
  }

  const overall = Math.floor(Math.random() * (overallRange[1] - overallRange[0] + 1)) + overallRange[0];
  const potential = Math.min(99, overall + Math.floor(Math.random() * potentialBonus) + 5);

  // Generate attributes based on position and overall
  const baseVariance = 10;
  const genAttr = (bias: number = 0) => {
    const value = overall + bias + (Math.random() * baseVariance * 2 - baseVariance);
    return Math.max(40, Math.min(99, Math.round(value)));
  };

  let attributes;
  switch (position) {
    case "PG":
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
    case "SG":
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
    case "SF":
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
    case "PF":
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
    case "C":
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

  // Generate bio
  const nationalities = [
    {
      name: "USA",
      flag: "🇺🇸",
      weight: 85,
      maleFirstNames: ["Marcus", "Jaylen", "Kevin", "Devin", "Trae", "Tyler", "Damian", "Chris", "Zion", "Ja", "Brandon", "Donovan", "Anthony", "DeMar", "Julius", "Jalen", "Isaiah", "Dejounte", "Jordan", "Andrew"],
      femaleFirstNames: ["Maya", "Emma", "Sophia", "Olivia", "Ava", "Isabella", "Mia", "Charlotte", "Amelia", "Harper", "Evelyn", "Abigail", "Emily", "Madison", "Ella", "Scarlett", "Grace", "Chloe", "Victoria", "Riley"],
      lastNames: ["Johnson", "Williams", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Robinson"],
      hometowns: ["Chicago, IL", "Los Angeles, CA", "New York, NY", "Houston, TX", "Phoenix, AZ", "Atlanta, GA"],
      colleges: ["Duke", "Kentucky", "Kansas", "North Carolina", "UCLA", "Gonzaga", "Villanova", "Arizona"],
    },
    {
      name: "France",
      flag: "🇫🇷",
      weight: 5,
      maleFirstNames: ["Victor", "Rudy", "Nicolas", "Evan", "Timothe"],
      femaleFirstNames: ["Emma", "Jade", "Louise", "Alice", "Chloe"],
      lastNames: ["Batum", "Gobert", "Fournier", "Ntilikina", "Luwawu"],
      hometowns: ["Paris", "Lyon", "Marseille"],
      colleges: ["International"],
    },
    {
      name: "Canada",
      flag: "🇨🇦",
      weight: 5,
      maleFirstNames: ["RJ", "Jamal", "Shai", "Andrew", "Luguentz"],
      femaleFirstNames: ["Emma", "Olivia", "Ava", "Sophia", "Isabella"],
      lastNames: ["Barrett", "Murray", "Alexander", "Wiggins", "Dort"],
      hometowns: ["Toronto, ON", "Montreal, QC", "Vancouver, BC"],
      colleges: ["International"],
    },
    {
      name: "Australia",
      flag: "🇦🇺",
      weight: 3,
      maleFirstNames: ["Josh", "Patty", "Ben", "Joe", "Matthew"],
      femaleFirstNames: ["Charlotte", "Olivia", "Amelia", "Isla", "Mia"],
      lastNames: ["Giddey", "Mills", "Simmons", "Ingles", "Dellavedova"],
      hometowns: ["Melbourne, VIC", "Sydney, NSW"],
      colleges: ["International"],
    },
    {
      name: "Serbia",
      flag: "🇷🇸",
      weight: 2,
      maleFirstNames: ["Nikola", "Bogdan", "Nemanja"],
      femaleFirstNames: ["Milica", "Jovana", "Ana"],
      lastNames: ["Jokic", "Bogdanovic", "Bjelica"],
      hometowns: ["Belgrade", "Novi Sad"],
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

  const nationality = weightedNationalities[Math.floor(Math.random() * weightedNationalities.length)];

  // Determine prospect gender
  let prospectGender: "male" | "female";
  if (gender === "mixed") {
    prospectGender = Math.random() < 0.5 ? "male" : "female";
  } else {
    prospectGender = gender;
  }

  // Generate name based on gender
  const firstNameArray = prospectGender === "male" ? nationality.maleFirstNames : nationality.femaleFirstNames;
  const firstName = firstNameArray[Math.floor(Math.random() * firstNameArray.length)];
  const lastName = nationality.lastNames[Math.floor(Math.random() * nationality.lastNames.length)];
  const hometown = nationality.hometowns[Math.floor(Math.random() * nationality.hometowns.length)];
  const college = nationality.name === "USA"
    ? nationality.colleges[Math.floor(Math.random() * nationality.colleges.length)]
    : "International";

  // Generate height based on position
  const generateHeight = (pos: string): string => {
    const baseHeight = pos === "PG" ? 73 : pos === "SG" ? 77 : pos === "SF" ? 79 : pos === "PF" ? 81 : 83;
    const variance = Math.floor(Math.random() * 5) - 2;
    const totalInches = baseHeight + variance;
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${feet}'${inches}"`;
  };

  const generateWeight = (pos: string): number => {
    const baseWeight = pos === "PG" ? 190 : pos === "SG" ? 205 : pos === "SF" ? 220 : pos === "PF" ? 235 : 250;
    return baseWeight + Math.floor(Math.random() * 30) - 15;
  };

  const generateWingspan = (heightStr: string): string => {
    const heightMatch = heightStr.match(/(\d+)'(\d+)"/);
    if (!heightMatch) return heightStr;
    const totalInches = parseInt(heightMatch[1]) * 12 + parseInt(heightMatch[2]);
    const wingspanInches = totalInches + Math.floor(Math.random() * 5) + 2;
    const feet = Math.floor(wingspanInches / 12);
    const inches = wingspanInches % 12;
    return `${feet}'${inches}"`;
  };

  const height = generateHeight(position);

  // Generate personality
  const generatePersonalityTrait = () => Math.floor(Math.random() * 60) + 20;

  const personality = {
    loyalty: generatePersonalityTrait(),
    greed: generatePersonalityTrait(),
    winning: generatePersonalityTrait(),
    playTime: Math.floor(Math.random() * 40) + 50, // Rookies want playing time
    teamPlayer: generatePersonalityTrait(),
    workEthic: Math.floor(Math.random() * 30) + 60, // High work ethic for draftees
    ego: generatePersonalityTrait(),
    temperament: generatePersonalityTrait(),
  };

  // Generate scouting report
  const scoutingReport = generateScoutingReport(position, overall, potential, attributes);

  return {
    id: `draft-${draftYear}-${pickNumber}`,
    name: `${firstName} ${lastName}`,
    position,
    age: 19,
    overall,
    potential,
    gender: prospectGender,
    attributes,
    bio: {
      height,
      weight: generateWeight(position),
      wingspan: generateWingspan(height),
      hometown,
      country: nationality.name,
      countryFlag: nationality.flag,
      college,
    },
    personality,
    scoutingReport,
  };
}

/**
 * Generate a scouting report for a prospect
 */
function generateScoutingReport(
  position: string,
  overall: number,
  potential: number,
  attributes: any
): string {
  const reports: string[] = [];

  // Overall assessment
  if (overall >= 80) {
    reports.push("Elite prospect with franchise player potential.");
  } else if (overall >= 75) {
    reports.push("High-quality prospect expected to make immediate impact.");
  } else if (overall >= 70) {
    reports.push("Solid prospect with good upside.");
  } else if (overall >= 65) {
    reports.push("Project player with development potential.");
  } else {
    reports.push("Raw talent that needs significant development.");
  }

  // Strengths
  const strengths: string[] = [];
  if (attributes.speed >= 80) strengths.push("exceptional speed");
  if (attributes.threePoint >= 80) strengths.push("elite shooting");
  if (attributes.defense >= 80) strengths.push("lockdown defense");
  if (attributes.basketballIQ >= 80) strengths.push("high basketball IQ");
  if (attributes.strength >= 80) strengths.push("physical dominance");

  if (strengths.length > 0) {
    reports.push(`Strengths: ${strengths.join(", ")}.`);
  }

  // Weaknesses
  const weaknesses: string[] = [];
  if (attributes.defense < 60) weaknesses.push("defensive awareness");
  if (attributes.threePoint < 60) weaknesses.push("outside shooting");
  if (attributes.freeThrow < 65) weaknesses.push("free throw shooting");
  if (attributes.strength < 60) weaknesses.push("physical strength");

  if (weaknesses.length > 0) {
    reports.push(`Needs work on: ${weaknesses.join(", ")}.`);
  }

  // Potential
  if (potential - overall >= 15) {
    reports.push("Tremendous upside if developed properly.");
  } else if (potential - overall >= 10) {
    reports.push("Good developmental ceiling.");
  }

  return reports.join(" ");
}

/**
 * Get lottery odds display (arrows showing movement potential)
 */
export function getLotteryOddsDisplay(currentRank: number): {
  arrows: string;
  description: string;
} {
  if (currentRank <= 3) {
    return {
      arrows: "⬆️⬆️⬆️",
      description: "Highest odds - 14% chance at #1",
    };
  } else if (currentRank <= 5) {
    return {
      arrows: "⬆️⬆️",
      description: "Strong odds - 10-12.5% at #1",
    };
  } else if (currentRank <= 10) {
    return {
      arrows: "⬆️",
      description: "Moderate odds - 3-9% at #1",
    };
  } else if (currentRank <= 14) {
    return {
      arrows: "↔️",
      description: "Low odds - 0.5-2% at #1",
    };
  } else {
    return {
      arrows: "⬇️",
      description: "No lottery odds (playoff team)",
    };
  }
}
