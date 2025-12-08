import { Team, Game } from "../types/basketball";

export interface TeamStandings {
  teamId: string;
  city: string;
  name: string;
  logo: string;
  conference: "East" | "West";
  wins: number;
  losses: number;
  winPercentage: number;
  gamesBack: number;
  conferenceRecord: string;
  homeRecord: string;
  awayRecord: string;
  lastTen: string;
  streak: string;
}

export interface ConferenceStandings {
  East: TeamStandings[];
  West: TeamStandings[];
}

interface GameRecords {
  conference: { wins: number; losses: number };
  home: { wins: number; losses: number };
  away: { wins: number; losses: number };
  lastTenGames: Array<"W" | "L">;
}

/**
 * Calculate comprehensive standings for all teams, organized by conference
 */
export function calculateStandings(teams: Team[], games: Game[]): ConferenceStandings {
  // Calculate additional records for each team
  const teamRecords = new Map<string, GameRecords>();

  // Initialize records
  teams.forEach((team) => {
    teamRecords.set(team.id, {
      conference: { wins: 0, losses: 0 },
      home: { wins: 0, losses: 0 },
      away: { wins: 0, losses: 0 },
      lastTenGames: [],
    });
  });

  // Process all played games
  const playedGames = games.filter((g) => g.played);

  // Sort games by date to track last 10 correctly
  const sortedGames = [...playedGames].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  sortedGames.forEach((game) => {
    const homeTeamRecord = teamRecords.get(game.homeTeamId);
    const awayTeamRecord = teamRecords.get(game.awayTeamId);
    const homeTeam = teams.find((t) => t.id === game.homeTeamId);
    const awayTeam = teams.find((t) => t.id === game.awayTeamId);

    if (!homeTeamRecord || !awayTeamRecord || !homeTeam || !awayTeam) return;

    const homeWon = game.homeScore > game.awayScore;
    const isConferenceGame = homeTeam.conference === awayTeam.conference;

    // Update home team records
    if (homeWon) {
      homeTeamRecord.home.wins++;
      homeTeamRecord.lastTenGames.push("W");
      if (isConferenceGame) {
        homeTeamRecord.conference.wins++;
      }
    } else {
      homeTeamRecord.home.losses++;
      homeTeamRecord.lastTenGames.push("L");
      if (isConferenceGame) {
        homeTeamRecord.conference.losses++;
      }
    }

    // Update away team records
    if (!homeWon) {
      awayTeamRecord.away.wins++;
      awayTeamRecord.lastTenGames.push("W");
      if (isConferenceGame) {
        awayTeamRecord.conference.wins++;
      }
    } else {
      awayTeamRecord.away.losses++;
      awayTeamRecord.lastTenGames.push("L");
      if (isConferenceGame) {
        awayTeamRecord.conference.losses++;
      }
    }
  });

  // Calculate standings for each team
  const allStandings: TeamStandings[] = teams.map((team) => {
    const record = teamRecords.get(team.id)!;
    const totalGames = team.wins + team.losses;
    const winPercentage = totalGames > 0 ? team.wins / totalGames : 0;

    // Last 10 games
    const lastTen = record.lastTenGames.slice(-10);
    const lastTenWins = lastTen.filter((r) => r === "W").length;
    const lastTenLosses = lastTen.filter((r) => r === "L").length;
    const lastTenStr = `${lastTenWins}-${lastTenLosses}`;

    // Calculate streak
    let streak = "";
    if (record.lastTenGames.length > 0) {
      const recentGames = [...record.lastTenGames].reverse();
      let count = 0;
      const currentStreakType = recentGames[0];

      for (const result of recentGames) {
        if (result === currentStreakType) {
          count++;
        } else {
          break;
        }
      }

      streak = `${currentStreakType}${count}`;
    } else {
      streak = "-";
    }

    return {
      teamId: team.id,
      city: team.city,
      name: team.name,
      logo: team.logo,
      conference: team.conference,
      wins: team.wins,
      losses: team.losses,
      winPercentage,
      gamesBack: 0, // Will be calculated after sorting
      conferenceRecord: `${record.conference.wins}-${record.conference.losses}`,
      homeRecord: `${record.home.wins}-${record.home.losses}`,
      awayRecord: `${record.away.wins}-${record.away.losses}`,
      lastTen: lastTenStr,
      streak,
    };
  });

  // Split by conference
  const eastTeams = allStandings.filter((team) => team.conference === "East");
  const westTeams = allStandings.filter((team) => team.conference === "West");

  // Sort each conference by win percentage (descending), then by wins (descending)
  const sortStandings = (standings: TeamStandings[]) => {
    standings.sort((a, b) => {
      if (b.winPercentage !== a.winPercentage) {
        return b.winPercentage - a.winPercentage;
      }
      return b.wins - a.wins;
    });

    // Calculate games back from first place in conference
    if (standings.length > 0) {
      const firstPlace = standings[0];
      const firstPlaceWins = firstPlace.wins;
      const firstPlaceLosses = firstPlace.losses;

      standings.forEach((team) => {
        if (team === firstPlace) {
          team.gamesBack = 0;
        } else {
          // GB = ((First Place Wins - Team Wins) + (Team Losses - First Place Losses)) / 2
          const gb = ((firstPlaceWins - team.wins) + (team.losses - firstPlaceLosses)) / 2;
          team.gamesBack = Math.max(0, gb);
        }
      });
    }

    return standings;
  };

  return {
    East: sortStandings(eastTeams),
    West: sortStandings(westTeams),
  };
}

/**
 * Format win percentage for display
 */
export function formatWinPercentage(winPercentage: number): string {
  return winPercentage.toFixed(3);
}

/**
 * Format games back for display
 */
export function formatGamesBack(gamesBack: number): string {
  if (gamesBack === 0) return "-";
  return gamesBack % 1 === 0 ? gamesBack.toString() : gamesBack.toFixed(1);
}
