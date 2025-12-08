import { Player } from "../types/basketball";

/**
 * 2025 NBA-style salary tiers based on player overall rating
 * Salaries are in millions per year
 */
export interface SalaryTier {
  min: number;
  max: number;
  minSalary: number;
  maxSalary: number;
  contractYearsMin: number;
  contractYearsMax: number;
}

const SALARY_TIERS: SalaryTier[] = [
  { min: 92, max: 99, minSalary: 40, maxSalary: 52, contractYearsMin: 4, contractYearsMax: 5 }, // Superstar
  { min: 88, max: 91, minSalary: 28, maxSalary: 38, contractYearsMin: 3, contractYearsMax: 4 }, // All-Star
  { min: 82, max: 87, minSalary: 15, maxSalary: 25, contractYearsMin: 2, contractYearsMax: 3 }, // Starter
  { min: 78, max: 81, minSalary: 10, maxSalary: 15, contractYearsMin: 2, contractYearsMax: 3 }, // Role Player
  { min: 74, max: 77, minSalary: 4, maxSalary: 9, contractYearsMin: 1, contractYearsMax: 2 }, // Bench
  { min: 70, max: 73, minSalary: 1.8, maxSalary: 4, contractYearsMin: 1, contractYearsMax: 2 }, // Deep Bench
  { min: 0, max: 69, minSalary: 1.0, maxSalary: 1.8, contractYearsMin: 1, contractYearsMax: 2 }, // Minimum
];

/**
 * 2025 NBA Salary Cap (approximate)
 */
export const NBA_SALARY_CAP_2025 = 149;

/**
 * Generates a contract for a player based on their overall rating
 * @param overall - Player's overall rating (0-99)
 * @param age - Player's age (affects contract length)
 * @param isRookie - Whether this is a rookie contract
 * @returns Contract object with years and salary
 */
export function generatePlayerContract(
  overall: number,
  age: number,
  isRookie: boolean = false
): { years: number; salary: number } {
  // Rookie contracts follow a different scale
  if (isRookie) {
    return generateRookieContract(overall);
  }

  // Find the appropriate salary tier
  const tier = SALARY_TIERS.find((t) => overall >= t.min && overall <= t.max);

  if (!tier) {
    // Fallback for edge cases
    return { years: 1, salary: 1.0 };
  }

  // Generate salary within the tier range
  const salaryRange = tier.maxSalary - tier.minSalary;
  const tierProgress = (overall - tier.min) / (tier.max - tier.min);
  let salary = tier.minSalary + (salaryRange * tierProgress);

  // Age adjustments
  if (age < 25 && overall >= 80) {
    // Young stars get premium
    salary *= 1.05;
  } else if (age > 32) {
    // Older players get discount
    salary *= 0.85;
  } else if (age > 34) {
    // Veteran minimum territory
    salary *= 0.7;
  }

  // Generate contract length based on tier and age
  let years = tier.contractYearsMin;

  if (overall >= 85) {
    // Stars want longer deals
    years = Math.max(tier.contractYearsMin, tier.contractYearsMax);
  } else if (age < 26) {
    // Young players want security
    years = tier.contractYearsMax;
  } else if (age > 30) {
    // Older players get shorter deals
    years = tier.contractYearsMin;
  } else {
    // Random within tier range
    years = Math.floor(Math.random() * (tier.contractYearsMax - tier.contractYearsMin + 1)) + tier.contractYearsMin;
  }

  // Cap contract length for older players
  if (age > 33) {
    years = Math.min(years, 2);
  }
  if (age > 35) {
    years = 1;
  }

  return {
    years,
    salary: parseFloat(salary.toFixed(1)),
  };
}

/**
 * Generates a rookie contract based on draft position/overall
 * @param overall - Player's overall rating
 * @returns Contract object with years and salary (4 years for rookies)
 */
export function generateRookieContract(overall: number): { years: number; salary: number } {
  // All rookie contracts are 4 years
  const years = 4;

  // Rookie scale salaries based on overall
  let salary: number;

  if (overall >= 85) {
    // Top 5 pick range
    salary = 9.5;
  } else if (overall >= 80) {
    // Top 10 pick range
    salary = 7.5;
  } else if (overall >= 75) {
    // Lottery pick range
    salary = 5.5;
  } else if (overall >= 70) {
    // First round range
    salary = 3.5;
  } else {
    // Second round / undrafted
    salary = 1.8;
  }

  return {
    years,
    salary: parseFloat(salary.toFixed(1)),
  };
}

/**
 * Recalculates all player contracts in a league to match new salary tiers
 * Use this for migrating existing leagues
 * @param players - Array of players to update
 * @returns Updated array of players with new contracts
 */
export function recalculateAllContracts(players: Player[]): Player[] {
  return players.map((player) => {
    // Determine if this should be treated as a rookie contract
    const isRookie = Boolean(player.bio.draftYear && (new Date().getFullYear() - player.bio.draftYear <= 3));

    const newContract = generatePlayerContract(player.overall, player.age, isRookie);

    return {
      ...player,
      contract: newContract,
    };
  });
}

/**
 * Calculates total team salary
 * @param players - Array of players on the team
 * @returns Total salary in millions
 */
export function calculateTeamSalary(players: Player[]): number {
  return players.reduce((total, player) => total + player.contract.salary, 0);
}

/**
 * Checks if a team is over the salary cap
 * @param players - Array of players on the team
 * @returns Object with salary info and cap status
 */
export function checkSalaryCap(players: Player[]): {
  totalSalary: number;
  salaryCapSpace: number;
  isOverCap: boolean;
  luxuryTaxAmount: number;
} {
  const totalSalary = calculateTeamSalary(players);
  const salaryCapSpace = NBA_SALARY_CAP_2025 - totalSalary;
  const isOverCap = totalSalary > NBA_SALARY_CAP_2025;

  // Luxury tax threshold (typically ~$20M above cap)
  const luxuryTaxThreshold = NBA_SALARY_CAP_2025 + 20;
  const luxuryTaxAmount = Math.max(0, totalSalary - luxuryTaxThreshold);

  return {
    totalSalary: parseFloat(totalSalary.toFixed(1)),
    salaryCapSpace: parseFloat(salaryCapSpace.toFixed(1)),
    isOverCap,
    luxuryTaxAmount: parseFloat(luxuryTaxAmount.toFixed(1)),
  };
}
