import React, { useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useBasketballStore } from "../../state/basketballStore";
import { Team } from "../../types/basketball";

type TeamStatCategory = "ppg" | "oppg" | "pace" | "offense" | "defense";

interface TeamStatLine {
  team: Team;
  wins: number;
  losses: number;
  ppg: number;
  oppg: number;
  pace: number;
  offenseRating: number;
  defenseRating: number;
  netRating: number;
}

export default function TeamStatsTab() {
  const [selectedCategory, setSelectedCategory] = useState<TeamStatCategory>("ppg");

  const teams = useBasketballStore((s) => s.teams);
  const players = useBasketballStore((s) => s.players);
  const season = useBasketballStore((s) => s.season);
  const userTeamId = useBasketballStore((s) => s.userTeamId);

  // Calculate team stats
  const teamStats = useMemo(() => {
    return teams.map((team) => {
      const teamGames = season.games.filter(
        (g) =>
          g.played && (g.homeTeamId === team.id || g.awayTeamId === team.id)
      );

      const gamesPlayed = teamGames.length;

      // Calculate total points scored and allowed
      let totalPoints = 0;
      let totalPointsAllowed = 0;

      teamGames.forEach((game) => {
        if (game.homeTeamId === team.id) {
          totalPoints += game.homeScore;
          totalPointsAllowed += game.awayScore;
        } else {
          totalPoints += game.awayScore;
          totalPointsAllowed += game.homeScore;
        }
      });

      const ppg = gamesPlayed > 0 ? parseFloat((totalPoints / gamesPlayed).toFixed(1)) : 0;
      const oppg = gamesPlayed > 0 ? parseFloat((totalPointsAllowed / gamesPlayed).toFixed(1)) : 0;

      // Get team roster for advanced calculations
      const roster = players.filter((p) => team.playerIds.includes(p.id));
      const topPlayers = [...roster].sort((a, b) => b.overall - a.overall).slice(0, 8);

      // Calculate pace (possessions per game estimate)
      // Higher speed and stamina = faster pace
      const avgSpeed = topPlayers.length > 0
        ? topPlayers.reduce((sum, p) => sum + p.attributes.speed, 0) / topPlayers.length
        : 70;
      const pace = 95 + (avgSpeed - 70) * 0.3;

      // Offensive rating (points per 100 possessions estimate)
      const avgOffense = topPlayers.length > 0
        ? topPlayers.reduce((sum, p) => sum + (p.attributes.threePointShooting + p.attributes.freeThrowShooting + p.attributes.clutch + p.attributes.finishing) / 4, 0) / topPlayers.length
        : 70;
      const offenseRating = 105 + (avgOffense - 70) * 0.5;

      // Defensive rating (points allowed per 100 possessions estimate)
      const avgDefense = topPlayers.length > 0
        ? topPlayers.reduce((sum, p) => sum + (p.attributes.perimeterDefense + p.attributes.interiorDefense + p.attributes.defensiveAwareness) / 3, 0) / topPlayers.length
        : 70;
      const defenseRating = 110 - (avgDefense - 70) * 0.5;

      const netRating = parseFloat((offenseRating - defenseRating).toFixed(1));

      return {
        team,
        wins: team.wins,
        losses: team.losses,
        ppg,
        oppg,
        pace: parseFloat(pace.toFixed(1)),
        offenseRating: parseFloat(offenseRating.toFixed(1)),
        defenseRating: parseFloat(defenseRating.toFixed(1)),
        netRating,
      };
    });
  }, [teams, players, season]);

  // Sort teams based on selected category
  const sortedTeams = useMemo(() => {
    return [...teamStats].sort((a, b) => {
      switch (selectedCategory) {
        case "ppg":
          return b.ppg - a.ppg;
        case "oppg":
          return a.oppg - b.oppg; // Lower is better
        case "pace":
          return b.pace - a.pace;
        case "offense":
          return b.offenseRating - a.offenseRating;
        case "defense":
          return a.defenseRating - b.defenseRating; // Lower is better
        default:
          return b.ppg - a.ppg;
      }
    });
  }, [teamStats, selectedCategory]);

  const categories = [
    { key: "ppg" as TeamStatCategory, label: "Points", icon: "🏀" },
    { key: "oppg" as TeamStatCategory, label: "Defense", icon: "🛡️" },
    { key: "pace" as TeamStatCategory, label: "Pace", icon: "⚡" },
    { key: "offense" as TeamStatCategory, label: "Off RTG", icon: "📈" },
    { key: "defense" as TeamStatCategory, label: "Def RTG", icon: "📉" },
  ];

  return (
    <View className="flex-1 bg-gray-950">
      {/* Category Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="bg-gray-900 border-b border-gray-800"
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
      >
        {categories.map((cat) => (
          <Pressable
            key={cat.key}
            onPress={() => setSelectedCategory(cat.key)}
            className={`mr-3 px-4 py-2 rounded-full ${
              selectedCategory === cat.key ? "bg-purple-600" : "bg-gray-800"
            }`}
          >
            <Text
              className={`font-semibold ${
                selectedCategory === cat.key ? "text-white" : "text-gray-400"
              }`}
            >
              {cat.icon} {cat.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Stats Table */}
      <ScrollView className="flex-1">
        {/* Table Header */}
        <View className="bg-gray-900 px-4 py-3 border-b border-gray-800">
          <View className="flex-row items-center">
            <Text className="text-gray-400 text-xs font-semibold w-10 text-center">
              #
            </Text>
            <Text className="text-gray-400 text-xs font-semibold flex-1 ml-2">
              Team
            </Text>
            <Text className="text-gray-400 text-xs font-semibold w-16 text-center">
              Record
            </Text>
            <Text className="text-gray-400 text-xs font-semibold w-14 text-center">
              PPG
            </Text>
            <Text className="text-gray-400 text-xs font-semibold w-14 text-center">
              OPPG
            </Text>
            <Text className="text-gray-400 text-xs font-semibold w-14 text-center">
              PACE
            </Text>
          </View>
        </View>

        {/* Team Rows */}
        {sortedTeams.map((stat, index) => {
          const isUserTeam = stat.team.id === userTeamId;
          const isTopThree = index < 3;
          return (
            <View
              key={stat.team.id}
              className={`px-4 py-3 border-b border-gray-800 ${
                isUserTeam
                  ? "bg-blue-950/30"
                  : isTopThree
                  ? "bg-gray-900/80"
                  : "bg-gray-950"
              }`}
            >
              <View className="flex-row items-center">
                {/* Rank */}
                <View className="w-10 items-center">
                  {isTopThree && !isUserTeam ? (
                    <Text className="text-2xl">
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                    </Text>
                  ) : (
                    <Text
                      className={`font-bold ${
                        isUserTeam ? "text-blue-400" : "text-gray-500"
                      }`}
                    >
                      {index + 1}
                    </Text>
                  )}
                </View>

                {/* Team Info */}
                <View className="flex-1 ml-2 flex-row items-center">
                  <Text className="text-2xl mr-2">{stat.team.logo}</Text>
                  <View className="flex-1">
                    <Text
                      className={`font-bold ${
                        isUserTeam ? "text-blue-400" : "text-white"
                      }`}
                      numberOfLines={1}
                    >
                      {stat.team.city}
                    </Text>
                    <Text className="text-gray-500 text-xs" numberOfLines={1}>
                      {stat.team.name}
                    </Text>
                  </View>
                </View>

                {/* Stats */}
                <Text className="w-16 text-center text-white font-semibold text-xs">
                  {stat.wins}-{stat.losses}
                </Text>
                <Text className="w-14 text-center text-white font-semibold">
                  {stat.ppg}
                </Text>
                <Text className="w-14 text-center text-white font-semibold">
                  {stat.oppg}
                </Text>
                <Text className="w-14 text-center text-white font-semibold">
                  {stat.pace}
                </Text>
              </View>

              {/* Secondary Stats */}
              <View className="flex-row items-center mt-2 ml-12">
                <View className="flex-row items-center mr-4">
                  <Text className="text-gray-500 text-xs">Off RTG: </Text>
                  <Text className="text-green-400 text-xs font-bold">
                    {stat.offenseRating}
                  </Text>
                </View>
                <View className="flex-row items-center mr-4">
                  <Text className="text-gray-500 text-xs">Def RTG: </Text>
                  <Text className="text-blue-400 text-xs font-bold">
                    {stat.defenseRating}
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <Text className="text-gray-500 text-xs">Net: </Text>
                  <Text
                    className={`text-xs font-bold ${
                      stat.netRating > 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {stat.netRating > 0 ? "+" : ""}
                    {stat.netRating}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
