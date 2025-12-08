import { LeagueSettings } from "../types/basketball";
import { Team, Player } from "../types/basketball";

/**
 * Validates if a team can sign a player based on league settings
 */
export function canSignPlayer(
  team: Team,
  player: Player,
  teamPlayers: Player[],
  settings: LeagueSettings | null
): { allowed: boolean; reason?: string } {
  if (!settings) {
    return { allowed: true }; // If no settings, allow everything
  }

  // Check roster size limits
  const currentRosterSize = teamPlayers.length;
  if (currentRosterSize >= settings.rosterSizeMax) {
    return {
      allowed: false,
      reason: `Roster is full (${currentRosterSize}/${settings.rosterSizeMax} players)`,
    };
  }

  // Check salary cap if enabled
  if (settings.salaryCapEnabled) {
    const currentSalary = teamPlayers.reduce((sum, p) => sum + p.contract.salary, 0);
    const newTotalSalary = currentSalary + player.contract.salary;
    const hardCap = settings.salaryCap;

    if (settings.hardCapEnforcement === "strict" && newTotalSalary > hardCap) {
      return {
        allowed: false,
        reason: `Signing would exceed hard cap ($${newTotalSalary.toFixed(1)}M > $${hardCap}M)`,
      };
    }

    if (settings.hardCapEnforcement === "soft" && newTotalSalary > hardCap) {
      return {
        allowed: true,
        reason: `Warning: This signing will put you over the salary cap ($${newTotalSalary.toFixed(1)}M > $${hardCap}M)`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Validates if a trade can be executed based on league settings
 */
export function canExecuteTrade(
  fromTeam: Team,
  toTeam: Team,
  playerToTrade: Player,
  fromTeamPlayers: Player[],
  toTeamPlayers: Player[],
  settings: LeagueSettings | null
): { allowed: boolean; reason?: string } {
  if (!settings) {
    return { allowed: true };
  }

  // Check roster size for receiving team
  const toTeamRosterSize = toTeamPlayers.length + 1; // +1 for incoming player
  if (toTeamRosterSize > settings.rosterSizeMax) {
    return {
      allowed: false,
      reason: `Trade would exceed ${toTeam.city}'s roster limit (${toTeamRosterSize}/${settings.rosterSizeMax})`,
    };
  }

  // Check if sending team would fall below minimum
  const fromTeamRosterSize = fromTeamPlayers.length - 1; // -1 for outgoing player
  if (fromTeamRosterSize < settings.rosterSizeMin) {
    return {
      allowed: false,
      reason: `Trade would leave ${fromTeam.city} below minimum roster size (${fromTeamRosterSize}/${settings.rosterSizeMin})`,
    };
  }

  // Check salary cap if enabled and strict
  if (settings.salaryCapEnabled && settings.hardCapEnforcement === "strict") {
    const toTeamCurrentSalary = toTeamPlayers.reduce((sum, p) => sum + p.contract.salary, 0);
    const toTeamNewSalary = toTeamCurrentSalary + playerToTrade.contract.salary;
    const hardCap = settings.salaryCap;

    if (toTeamNewSalary > hardCap) {
      return {
        allowed: false,
        reason: `Trade would put ${toTeam.city} over the hard cap ($${toTeamNewSalary.toFixed(1)}M > $${hardCap}M)`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Validates if a team can release a player based on league settings
 */
export function canReleasePlayer(
  team: Team,
  teamPlayers: Player[],
  settings: LeagueSettings | null
): { allowed: boolean; reason?: string } {
  if (!settings) {
    return { allowed: true };
  }

  const newRosterSize = teamPlayers.length - 1;
  if (newRosterSize < settings.rosterSizeMin) {
    return {
      allowed: false,
      reason: `Cannot release - roster would fall below minimum (${newRosterSize}/${settings.rosterSizeMin})`,
    };
  }

  return { allowed: true };
}

/**
 * Calculate luxury tax penalty based on settings
 */
export function calculateLuxuryTax(
  totalSalary: number,
  settings: LeagueSettings | null
): number {
  if (!settings || !settings.luxuryTax || !settings.salaryCapEnabled) {
    return 0;
  }

  const overage = totalSalary - settings.luxuryTaxThreshold;
  if (overage <= 0) {
    return 0;
  }

  // Base tax rate increases with severity setting (1-5)
  const baseTaxRate = 0.5 + (settings.luxuryTaxSeverity - 1) * 0.25; // 0.5 to 1.5
  const repeaterMultiplier = 1.0; // Could be enhanced later for repeat offenders

  return overage * baseTaxRate * repeaterMultiplier;
}

/**
 * Get the effective salary cap for display purposes
 */
export function getEffectiveSalaryCap(settings: LeagueSettings | null): number | null {
  if (!settings || !settings.salaryCapEnabled) {
    return null; // No cap
  }
  return settings.salaryCap;
}

/**
 * Check if expansion is enabled
 */
export function isExpansionEnabled(settings: LeagueSettings | null): boolean {
  return settings?.expansionEnabled ?? false;
}

/**
 * Get injury chance multiplier based on settings
 */
export function getInjuryChanceMultiplier(settings: LeagueSettings | null): number {
  if (!settings || !settings.injuriesEnabled) {
    return 0; // No injuries
  }
  // Convert 1-5 scale to multiplier (0.2 to 2.0)
  return (settings.injuryFrequency / 5) * 2;
}

/**
 * Get player development speed multiplier
 */
export function getDevelopmentSpeedMultiplier(settings: LeagueSettings | null): number {
  if (!settings) {
    return 1.0;
  }
  // Convert 1-5 scale to multiplier (0.5 to 1.5)
  return 0.5 + (settings.playerDevelopment / 5);
}

/**
 * Get AI trade frequency multiplier
 */
export function getTradeFrequencyMultiplier(settings: LeagueSettings | null): number {
  if (!settings) {
    return 1.0;
  }
  // Convert 1-5 scale to multiplier (0.2 to 2.0)
  return (settings.tradeFrequency / 5) * 2;
}

/**
 * Get chemistry/morale impact multiplier
 */
export function getChemistryImpactMultiplier(settings: LeagueSettings | null): number {
  if (!settings || !settings.playerMoraleEnabled) {
    return 0;
  }
  // Convert 1-5 scale to multiplier (0.2 to 2.0)
  return (settings.chemistryMoraleImpact / 5) * 2;
}

/**
 * Get news generation multiplier
 */
export function getNewsVolumeMultiplier(settings: LeagueSettings | null): number {
  if (!settings) {
    return 1.0;
  }
  // Convert 1-5 scale to multiplier (0.2 to 2.0)
  return (settings.newsFeedVolume / 5) * 2;
}

/**
 * Get rumor intensity multiplier
 */
export function getRumorIntensityMultiplier(settings: LeagueSettings | null): number {
  if (!settings) {
    return 1.0;
  }
  // Convert 1-5 scale to multiplier (0.2 to 2.0)
  return (settings.rumorIntensity / 5) * 2;
}
