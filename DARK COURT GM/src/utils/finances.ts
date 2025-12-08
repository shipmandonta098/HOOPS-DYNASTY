import { Team, Player } from "../types/basketball";

// NBA Salary Cap Constants (in millions)
export const SALARY_CAP = 120; // Standard salary cap
export const LUXURY_TAX_LINE = 146; // Luxury tax threshold
export const HARD_CAP = 172; // Hard cap (apron)
export const MID_LEVEL_EXCEPTION = 12.4; // MLE
export const BI_ANNUAL_EXCEPTION = 4.5; // BAE
export const TAXPAYER_MID_LEVEL = 5.2; // TMLE

export interface CapSheetPlayer {
  id: string;
  name: string;
  position: string;
  salary: number;
  yearsRemaining: number;
}

export interface PayrollProjection {
  year: string;
  totalSalary: number;
  projectedCap: number;
  capSpace: number;
  overCap: boolean;
}

export interface FinancialSummary {
  totalSalary: number;
  capSpace: number;
  luxuryTaxAmount: number;
  isOverCap: boolean;
  isOverLuxuryTax: boolean;
  isOverHardCap: boolean;
  roomException: number;
}

/**
 * Calculate team's current financial summary
 */
export function calculateFinancialSummary(
  team: Team,
  players: Player[]
): FinancialSummary {
  const teamPlayers = players.filter((p) => team.playerIds.includes(p.id));
  const totalSalary = teamPlayers.reduce((sum, p) => sum + p.contract.salary, 0);

  // Add dead money
  const deadMoney = team.deadMoney?.reduce(
    (sum, contract) => sum + contract.amountPerYear,
    0
  ) || 0;

  const totalPayroll = totalSalary + deadMoney;
  const capSpace = Math.max(0, SALARY_CAP - totalPayroll);
  const isOverCap = totalPayroll > SALARY_CAP;
  const isOverLuxuryTax = totalPayroll > LUXURY_TAX_LINE;
  const isOverHardCap = totalPayroll > HARD_CAP;

  // Calculate luxury tax (simplified - $1.50 per dollar over for first $5M)
  let luxuryTaxAmount = 0;
  if (isOverLuxuryTax) {
    const overAmount = totalPayroll - LUXURY_TAX_LINE;
    if (overAmount <= 5) {
      luxuryTaxAmount = overAmount * 1.5;
    } else {
      luxuryTaxAmount = 5 * 1.5 + (overAmount - 5) * 1.75; // Incremental rate
    }
  }

  // Room exception (for teams under cap)
  const roomException = !isOverCap ? Math.min(capSpace, 7.9) : 0;

  return {
    totalSalary: totalPayroll,
    capSpace,
    luxuryTaxAmount,
    isOverCap,
    isOverLuxuryTax,
    isOverHardCap,
    roomException,
  };
}

/**
 * Get cap sheet with all player contracts
 */
export function getCapSheet(team: Team, players: Player[]): CapSheetPlayer[] {
  const teamPlayers = players.filter((p) => team.playerIds.includes(p.id));

  return teamPlayers
    .map((player) => ({
      id: player.id,
      name: player.name,
      position: player.position,
      salary: player.contract.salary,
      yearsRemaining: player.contract.years,
    }))
    .sort((a, b) => b.salary - a.salary); // Sort by highest salary
}

/**
 * Project payroll for next 3-4 years
 */
export function projectPayroll(
  team: Team,
  players: Player[],
  years: number = 4
): PayrollProjection[] {
  const currentYear = 2025;
  const teamPlayers = players.filter((p) => team.playerIds.includes(p.id));
  const projections: PayrollProjection[] = [];

  for (let i = 0; i < years; i++) {
    const year = currentYear + i;
    let totalSalary = 0;

    // Calculate salaries for players still under contract
    teamPlayers.forEach((player) => {
      if (player.contract.years > i) {
        totalSalary += player.contract.salary;
      }
    });

    // Add dead money that extends to this year
    team.deadMoney?.forEach((contract) => {
      if (contract.yearsRemaining > i) {
        totalSalary += contract.amountPerYear;
      }
    });

    // Project cap increase (3% per year)
    const projectedCap = SALARY_CAP * Math.pow(1.03, i);
    const capSpace = Math.max(0, projectedCap - totalSalary);

    projections.push({
      year: `${year}-${year + 1}`,
      totalSalary: parseFloat(totalSalary.toFixed(1)),
      projectedCap: parseFloat(projectedCap.toFixed(1)),
      capSpace: parseFloat(capSpace.toFixed(1)),
      overCap: totalSalary > projectedCap,
    });
  }

  return projections;
}

/**
 * Get available exceptions for team
 */
export function getAvailableExceptions(team: Team, isOverCap: boolean) {
  if (!isOverCap) {
    // Teams under cap can't use most exceptions
    return {
      midLevelException: 0,
      biAnnualException: 0,
      taxpayerMidLevel: 0,
      roomException: Math.min(SALARY_CAP - (team.budget || 0), 7.9),
    };
  }

  // Return team's exceptions or defaults
  return {
    midLevelException: team.exceptions?.midLevelException ?? MID_LEVEL_EXCEPTION,
    biAnnualException: team.exceptions?.biAnnualException ?? BI_ANNUAL_EXCEPTION,
    taxpayerMidLevel: team.exceptions?.taxpayerMidLevel ?? TAXPAYER_MID_LEVEL,
    roomException: 0,
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(1)}M`;
}

/**
 * Get cap status color
 */
export function getCapStatusColor(
  totalSalary: number
): "green" | "yellow" | "orange" | "red" {
  if (totalSalary < SALARY_CAP * 0.9) return "green";
  if (totalSalary < SALARY_CAP) return "yellow";
  if (totalSalary < LUXURY_TAX_LINE) return "orange";
  return "red";
}
