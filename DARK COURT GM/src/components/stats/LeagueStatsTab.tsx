import React, { useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import { useBasketballStore } from "../../state/basketballStore";

export default function LeagueStatsTab() {
  const teams = useBasketballStore((s) => s.teams);
  const players = useBasketballStore((s) => s.players);
  const season = useBasketballStore((s) => s.season);

  // Calculate league-wide statistics
  const leagueStats = useMemo(() => {
    const playedGames = season.games.filter((g) => g.played);
    const totalGames = playedGames.length;

    // Calculate total points scored
    const totalPoints = playedGames.reduce(
      (sum, game) => sum + game.homeScore + game.awayScore,
      0
    );

    // Average points per game (across all games)
    const avgPointsPerGame = totalGames > 0 ? (totalPoints / totalGames).toFixed(1) : "0.0";

    // Calculate highest and lowest scoring games
    const sortedByScore = [...playedGames].sort(
      (a, b) => b.homeScore + b.awayScore - (a.homeScore + a.awayScore)
    );
    const highestScoringGame = sortedByScore[0];
    const lowestScoringGame = sortedByScore[sortedByScore.length - 1];

    // Calculate close games (5 points or less)
    const closeGames = playedGames.filter(
      (g) => Math.abs(g.homeScore - g.awayScore) <= 5
    ).length;
    const closeGamePercent = totalGames > 0 ? ((closeGames / totalGames) * 100).toFixed(1) : "0.0";

    // Calculate blowouts (20+ point margin)
    const blowouts = playedGames.filter(
      (g) => Math.abs(g.homeScore - g.awayScore) >= 20
    ).length;
    const blowoutPercent = totalGames > 0 ? ((blowouts / totalGames) * 100).toFixed(1) : "0.0";

    // Home court advantage
    const homeWins = playedGames.filter((g) => g.homeScore > g.awayScore).length;
    const homeWinPercent = totalGames > 0 ? ((homeWins / totalGames) * 100).toFixed(1) : "0.0";

    // Player statistics
    const activePlayers = players.filter((p) => p.teamId);
    const totalPlayers = activePlayers.length;
    const avgPlayerRating = totalPlayers > 0
      ? (activePlayers.reduce((sum, p) => sum + p.overall, 0) / totalPlayers).toFixed(1)
      : "0.0";

    // Position distribution
    const positionCounts = {
      PG: activePlayers.filter((p) => p.position === "PG").length,
      SG: activePlayers.filter((p) => p.position === "SG").length,
      SF: activePlayers.filter((p) => p.position === "SF").length,
      PF: activePlayers.filter((p) => p.position === "PF").length,
      C: activePlayers.filter((p) => p.position === "C").length,
    };

    // Team statistics
    const totalTeams = teams.length;
    const avgTeamWins = totalTeams > 0
      ? (teams.reduce((sum, t) => sum + t.wins, 0) / totalTeams).toFixed(1)
      : "0.0";

    // Roster sizes
    const teamRosterSizes = teams.map((t) => t.playerIds.length);
    const avgRosterSize = totalTeams > 0
      ? (teamRosterSizes.reduce((sum, size) => sum + size, 0) / totalTeams).toFixed(1)
      : "0.0";

    // Salary cap stats
    const totalSalaries = teams.reduce((sum, team) => {
      const teamSalary = team.playerIds.reduce((teamSum, playerId) => {
        const player = players.find((p) => p.id === playerId);
        return teamSum + (player?.contract.salary || 0);
      }, 0);
      return sum + teamSalary;
    }, 0);

    const avgTeamSalary = totalTeams > 0 ? (totalSalaries / totalTeams).toFixed(1) : "0.0";

    return {
      totalGames,
      avgPointsPerGame,
      highestScoringGame,
      lowestScoringGame,
      closeGames,
      closeGamePercent,
      blowouts,
      blowoutPercent,
      homeWinPercent,
      totalPlayers,
      avgPlayerRating,
      positionCounts,
      totalTeams,
      avgTeamWins,
      avgRosterSize,
      avgTeamSalary,
    };
  }, [teams, players, season]);

  const StatCard = ({ title, value, subtitle, icon }: { title: string; value: string; subtitle?: string; icon: string }) => (
    <View className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-gray-400 text-xs font-semibold uppercase">{title}</Text>
        <Text className="text-2xl">{icon}</Text>
      </View>
      <Text className="text-white text-2xl font-bold">{value}</Text>
      {subtitle && <Text className="text-gray-500 text-xs mt-1">{subtitle}</Text>}
    </View>
  );

  return (
    <ScrollView className="flex-1 bg-gray-950">
      <View className="p-4 space-y-4">
        {/* Season Overview */}
        <View>
          <Text className="text-white text-lg font-bold mb-3">📅 Season Overview</Text>
          <View className="flex-row justify-between mb-3">
            <View className="flex-1 mr-2">
              <StatCard
                title="Games Played"
                value={leagueStats.totalGames.toString()}
                subtitle={`Week ${season.currentWeek}`}
                icon="🏀"
              />
            </View>
            <View className="flex-1 ml-2">
              <StatCard
                title="Avg Points/Game"
                value={leagueStats.avgPointsPerGame}
                subtitle="Both teams combined"
                icon="📊"
              />
            </View>
          </View>
        </View>

        {/* Game Insights */}
        <View>
          <Text className="text-white text-lg font-bold mb-3">🎯 Game Insights</Text>
          <View className="flex-row justify-between mb-3">
            <View className="flex-1 mr-2">
              <StatCard
                title="Close Games"
                value={`${leagueStats.closeGames}`}
                subtitle={`${leagueStats.closeGamePercent}% of games`}
                icon="🔥"
              />
            </View>
            <View className="flex-1 ml-2">
              <StatCard
                title="Blowouts"
                value={`${leagueStats.blowouts}`}
                subtitle={`${leagueStats.blowoutPercent}% of games`}
                icon="💥"
              />
            </View>
          </View>
          <StatCard
            title="Home Win Rate"
            value={`${leagueStats.homeWinPercent}%`}
            subtitle="Home court advantage"
            icon="🏠"
          />
        </View>

        {/* Scoring Records */}
        {leagueStats.highestScoringGame && (
          <View>
            <Text className="text-white text-lg font-bold mb-3">🏆 Scoring Records</Text>
            <View className="bg-gray-900 rounded-lg p-4 border border-gray-800 mb-3">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-gray-400 text-xs font-semibold uppercase">
                  Highest Scoring Game
                </Text>
                <Text className="text-2xl">🔥</Text>
              </View>
              <Text className="text-white text-xl font-bold">
                {leagueStats.highestScoringGame.homeScore + leagueStats.highestScoringGame.awayScore} Total Points
              </Text>
              <Text className="text-gray-500 text-xs mt-1">
                {leagueStats.highestScoringGame.homeScore} - {leagueStats.highestScoringGame.awayScore}
              </Text>
            </View>
            {leagueStats.lowestScoringGame && (
              <View className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-gray-400 text-xs font-semibold uppercase">
                    Lowest Scoring Game
                  </Text>
                  <Text className="text-2xl">❄️</Text>
                </View>
                <Text className="text-white text-xl font-bold">
                  {leagueStats.lowestScoringGame.homeScore + leagueStats.lowestScoringGame.awayScore} Total Points
                </Text>
                <Text className="text-gray-500 text-xs mt-1">
                  {leagueStats.lowestScoringGame.homeScore} - {leagueStats.lowestScoringGame.awayScore}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Player Statistics */}
        <View>
          <Text className="text-white text-lg font-bold mb-3">👥 Player Statistics</Text>
          <View className="flex-row justify-between mb-3">
            <View className="flex-1 mr-2">
              <StatCard
                title="Active Players"
                value={leagueStats.totalPlayers.toString()}
                subtitle={`${leagueStats.totalTeams} teams`}
                icon="🏃"
              />
            </View>
            <View className="flex-1 ml-2">
              <StatCard
                title="Avg Rating"
                value={leagueStats.avgPlayerRating}
                subtitle="League-wide OVR"
                icon="⭐"
              />
            </View>
          </View>

          {/* Position Distribution */}
          <View className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <Text className="text-gray-400 text-xs font-semibold uppercase mb-3">
              Position Distribution
            </Text>
            {Object.entries(leagueStats.positionCounts).map(([position, count]) => (
              <View key={position} className="flex-row justify-between items-center mb-2">
                <Text className="text-gray-300 font-medium">{position}</Text>
                <View className="flex-row items-center">
                  <View
                    className="h-2 bg-purple-600 rounded mr-2"
                    style={{ width: (count as number / leagueStats.totalPlayers) * 200 }}
                  />
                  <Text className="text-white font-bold w-8 text-right">{count}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Team Statistics */}
        <View>
          <Text className="text-white text-lg font-bold mb-3">🏟️ Team Statistics</Text>
          <View className="flex-row justify-between mb-3">
            <View className="flex-1 mr-2">
              <StatCard
                title="Avg Team Wins"
                value={leagueStats.avgTeamWins}
                subtitle="Per team"
                icon="🏆"
              />
            </View>
            <View className="flex-1 ml-2">
              <StatCard
                title="Avg Roster Size"
                value={leagueStats.avgRosterSize}
                subtitle="Players per team"
                icon="👕"
              />
            </View>
          </View>
          <StatCard
            title="Avg Team Salary"
            value={`$${leagueStats.avgTeamSalary}M`}
            subtitle="Out of $120M cap"
            icon="💰"
          />
        </View>

        {/* Phase Information */}
        <View className="bg-gradient-to-r from-purple-900/20 to-indigo-900/20 rounded-lg p-4 border border-purple-800/30">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-gray-400 text-xs font-semibold uppercase">
                Season Phase
              </Text>
              <Text className="text-white text-xl font-bold mt-1 capitalize">
                {season.phase.replace("_", " ")}
              </Text>
            </View>
            <Text className="text-4xl">
              {season.phase === "regular_season" ? "🏀" : season.phase === "playoffs" ? "🏆" : season.phase === "draft" ? "🎯" : "📋"}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
