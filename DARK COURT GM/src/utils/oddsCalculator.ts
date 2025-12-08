import { Team, Player, Coach, Game, OddsInputs, TeamOdds } from "../types/basketball";

/**
 * Calculate odds inputs for a team
 */
export function calculateOddsInputs(
  team: Team,
  players: Player[],
  coach: Coach | undefined,
  games: Game[],
  sosScore: number
): OddsInputs {
  const roster = players.filter((p) => team.playerIds.includes(p.id));

  // Team OVR - average of top 8 players
  const topPlayers = [...roster].sort((a, b) => b.overall - a.overall).slice(0, 8);
  const teamOVR = topPlayers.length > 0
    ? topPlayers.reduce((sum, p) => sum + p.overall, 0) / topPlayers.length
    : 70;

  // Point differential (approximate based on team rating)
  const teamGames = games.filter((g) => g.played && (g.homeTeamId === team.id || g.awayTeamId === team.id));
  let pointDiff = 0;
  if (teamGames.length > 0) {
    const totalDiff = teamGames.reduce((sum, g) => {
      if (g.homeTeamId === team.id) {
        return sum + (g.homeScore - g.awayScore);
      } else {
        return sum + (g.awayScore - g.homeScore);
      }
    }, 0);
    pointDiff = totalDiff / teamGames.length;
  } else {
    // Estimate based on team OVR
    pointDiff = (teamOVR - 75) * 0.3;
  }

  // Last 10 games record
  const last10Games = teamGames.slice(-10);
  let last10Wins = 0;
  let last10Losses = 0;
  last10Games.forEach((g) => {
    const won = (g.homeTeamId === team.id && g.homeScore > g.awayScore) ||
                (g.awayTeamId === team.id && g.awayScore > g.homeScore);
    if (won) last10Wins++;
    else last10Losses++;
  });

  // Top 3 player OVR
  const top3 = [...roster].sort((a, b) => b.overall - a.overall).slice(0, 3);
  const topThreeOVR = top3.length > 0
    ? top3.reduce((sum, p) => sum + p.overall, 0) / top3.length
    : 70;

  // Injury impact (simplified - assume no injuries for now)
  const injuryImpact = 0;

  return {
    teamOVR,
    pointDiff,
    sosScore,
    last10Record: { wins: last10Wins, losses: last10Losses },
    injuryImpact,
    topThreeOVR,
    coachRating: coach?.overall || 70,
  };
}

/**
 * Convert percentage to betting odds format
 */
export function percentageToBettingOdds(percentage: number): string {
  if (percentage >= 50) {
    // Negative odds (favorite)
    const odds = Math.round((percentage / (100 - percentage)) * 100);
    return `-${odds}`;
  } else {
    // Positive odds (underdog)
    const odds = Math.round(((100 - percentage) / percentage) * 100);
    return `+${odds}`;
  }
}

/**
 * Calculate championship odds for a team
 */
export function calculateChampionshipOdds(
  inputs: OddsInputs,
  allTeamInputs: OddsInputs[]
): { betting: string; percentage: string; raw: number } {
  // Championship score formula
  let score = 0;

  // Team OVR (40% weight)
  score += (inputs.teamOVR / 99) * 40;

  // Point differential (15% weight)
  const normalizedPointDiff = Math.max(0, Math.min(1, (inputs.pointDiff + 10) / 20));
  score += normalizedPointDiff * 15;

  // Recent form (15% weight)
  const last10WinPct = inputs.last10Record.wins / (inputs.last10Record.wins + inputs.last10Record.losses || 1);
  score += last10WinPct * 15;

  // Top 3 players (20% weight) - star power matters
  score += (inputs.topThreeOVR / 99) * 20;

  // Coach rating (5% weight)
  score += (inputs.coachRating / 99) * 5;

  // SOS adjustment (5% weight) - easier schedule = slightly better odds
  const sosAdjustment = ((100 - inputs.sosScore) / 100) * 5;
  score += sosAdjustment;

  // Injury penalty
  score -= inputs.injuryImpact * 0.2;

  // Normalize score to percentage among all teams
  const totalScore = allTeamInputs.reduce((sum, inp) => {
    let s = 0;
    s += (inp.teamOVR / 99) * 40;
    const pd = Math.max(0, Math.min(1, (inp.pointDiff + 10) / 20));
    s += pd * 15;
    const l10 = inp.last10Record.wins / (inp.last10Record.wins + inp.last10Record.losses || 1);
    s += l10 * 15;
    s += (inp.topThreeOVR / 99) * 20;
    s += (inp.coachRating / 99) * 5;
    s += ((100 - inp.sosScore) / 100) * 5;
    s -= inp.injuryImpact * 0.2;
    return sum + s;
  }, 0);

  const rawPercentage = totalScore > 0 ? (score / totalScore) * 100 : 0;

  return {
    raw: rawPercentage,
    percentage: `${rawPercentage.toFixed(1)}%`,
    betting: percentageToBettingOdds(rawPercentage),
  };
}

/**
 * Calculate conference title odds
 */
export function calculateConferenceTitleOdds(
  inputs: OddsInputs,
  conferenceTeamInputs: OddsInputs[]
): { betting: string; percentage: string; raw: number } {
  let score = 0;

  // Similar to championship but within conference
  score += (inputs.teamOVR / 99) * 35;
  const normalizedPointDiff = Math.max(0, Math.min(1, (inputs.pointDiff + 10) / 20));
  score += normalizedPointDiff * 20;
  const last10WinPct = inputs.last10Record.wins / (inputs.last10Record.wins + inputs.last10Record.losses || 1);
  score += last10WinPct * 20;
  score += (inputs.topThreeOVR / 99) * 20;
  score += (inputs.coachRating / 99) * 5;
  score -= inputs.injuryImpact * 0.2;

  const totalScore = conferenceTeamInputs.reduce((sum, inp) => {
    let s = 0;
    s += (inp.teamOVR / 99) * 35;
    const pd = Math.max(0, Math.min(1, (inp.pointDiff + 10) / 20));
    s += pd * 20;
    const l10 = inp.last10Record.wins / (inp.last10Record.wins + inp.last10Record.losses || 1);
    s += l10 * 20;
    s += (inp.topThreeOVR / 99) * 20;
    s += (inp.coachRating / 99) * 5;
    s -= inp.injuryImpact * 0.2;
    return sum + s;
  }, 0);

  const rawPercentage = totalScore > 0 ? (score / totalScore) * 100 : 0;

  return {
    raw: rawPercentage,
    percentage: `${rawPercentage.toFixed(1)}%`,
    betting: percentageToBettingOdds(rawPercentage),
  };
}

/**
 * Calculate playoff qualification odds
 */
export function calculatePlayoffOdds(
  team: Team,
  inputs: OddsInputs,
  conferenceTeams: Team[],
  gamesRemaining: number
): { betting: string; percentage: string; raw: number } {
  const totalGames = team.wins + team.losses + gamesRemaining;
  const currentWinPct = team.wins / (team.wins + team.losses || 1);

  // Project final wins
  const projectedWins = team.wins + (gamesRemaining * currentWinPct);

  // Count teams with better or similar projected records
  const conferenceRecords = conferenceTeams.map((t) => {
    const tWinPct = t.wins / (t.wins + t.losses || 1);
    const tProjectedWins = t.wins + (gamesRemaining * tWinPct);
    return { teamId: t.id, projectedWins: tProjectedWins };
  }).sort((a, b) => b.projectedWins - a.projectedWins);

  const rank = conferenceRecords.findIndex((r) => r.teamId === team.id) + 1;

  // Simple playoff odds based on ranking and record
  let rawPercentage = 0;
  if (rank <= 6) {
    rawPercentage = 95 + (6 - rank) * 1; // Top 6 teams very likely
  } else if (rank <= 10) {
    rawPercentage = 70 - (rank - 6) * 10; // 7-10 fighting for spots
  } else if (rank <= 12) {
    rawPercentage = 30 - (rank - 10) * 10; // 11-12 outside looking in
  } else {
    rawPercentage = Math.max(1, 10 - (rank - 12) * 2); // Long shots
  }

  // Adjust based on recent form
  const last10WinPct = inputs.last10Record.wins / (inputs.last10Record.wins + inputs.last10Record.losses || 1);
  if (last10WinPct > 0.7) {
    rawPercentage = Math.min(99, rawPercentage + 5);
  } else if (last10WinPct < 0.3) {
    rawPercentage = Math.max(1, rawPercentage - 5);
  }

  return {
    raw: rawPercentage,
    percentage: `${rawPercentage.toFixed(1)}%`,
    betting: percentageToBettingOdds(rawPercentage),
  };
}

/**
 * Calculate division title odds
 */
export function calculateDivisionOdds(
  team: Team,
  divisionTeams: Team[],
  gamesRemaining: number
): { betting: string; percentage: string; raw: number } {
  const currentWinPct = team.wins / (team.wins + team.losses || 1);
  const projectedWins = team.wins + (gamesRemaining * currentWinPct);

  // Get division standings
  const divisionRecords = divisionTeams.map((t) => {
    const tWinPct = t.wins / (t.wins + t.losses || 1);
    const tProjectedWins = t.wins + (gamesRemaining * tWinPct);
    return { teamId: t.id, projectedWins: tProjectedWins, currentWins: t.wins };
  }).sort((a, b) => b.projectedWins - a.projectedWins);

  const rank = divisionRecords.findIndex((r) => r.teamId === team.id) + 1;
  const leader = divisionRecords[0];
  const gamesBack = (leader.currentWins - team.wins) / 2;

  // Division odds based on rank and games back
  let rawPercentage = 0;
  if (rank === 1) {
    rawPercentage = Math.min(95, 60 + gamesBack * -10); // Leader
  } else if (rank === 2) {
    rawPercentage = Math.max(5, 35 - gamesBack * 5);
  } else if (rank === 3) {
    rawPercentage = Math.max(2, 15 - gamesBack * 3);
  } else {
    rawPercentage = Math.max(1, 5 - gamesBack * 1);
  }

  return {
    raw: rawPercentage,
    percentage: `${rawPercentage.toFixed(1)}%`,
    betting: percentageToBettingOdds(rawPercentage),
  };
}

/**
 * Calculate all odds for a team
 */
export function calculateTeamOdds(
  team: Team,
  allTeams: Team[],
  allPlayers: Player[],
  allCoaches: Coach[],
  games: Game[],
  sosScore: number
): TeamOdds {
  const coach = allCoaches.find((c) => c.id === team.coachId);
  const inputs = calculateOddsInputs(team, allPlayers, coach, games, sosScore);

  // Get conference and division teams
  const conferenceTeams = allTeams.filter((t) => t.conference === team.conference);
  const divisionTeams = allTeams.filter((t) => t.division === team.division);

  // Calculate all team inputs
  const allTeamInputs = allTeams.map((t) => {
    const tCoach = allCoaches.find((c) => c.id === t.coachId);
    // For simplicity, use the same SOS for now or fetch actual SOS
    return calculateOddsInputs(t, allPlayers, tCoach, games, sosScore);
  });

  const conferenceTeamInputs = conferenceTeams.map((t) => {
    const tCoach = allCoaches.find((c) => c.id === t.coachId);
    return calculateOddsInputs(t, allPlayers, tCoach, games, sosScore);
  });

  // Estimate games remaining (assume 28 game season)
  const gamesRemaining = Math.max(0, 28 - (team.wins + team.losses));

  return {
    teamId: team.id,
    championshipOdds: calculateChampionshipOdds(inputs, allTeamInputs),
    conferenceTitleOdds: calculateConferenceTitleOdds(inputs, conferenceTeamInputs),
    playoffOdds: calculatePlayoffOdds(team, inputs, conferenceTeams, gamesRemaining),
    divisionOdds: calculateDivisionOdds(team, divisionTeams, gamesRemaining),
  };
}
