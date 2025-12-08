import React, { useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useBasketballStore } from "../../state/basketballStore";
import { Player } from "../../types/basketball";
import PlayerDetailsModal from "../PlayerDetailsModal";

type StatCategory = "ppg" | "rpg" | "apg" | "spg" | "bpg" | "overall";

interface PlayerStatLine {
  player: Player;
  team: string;
  teamLogo: string;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
}

export default function PlayerStatsTab() {
  const [selectedCategory, setSelectedCategory] = useState<StatCategory>("ppg");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const players = useBasketballStore((s) => s.players);
  const teams = useBasketballStore((s) => s.teams);
  const season = useBasketballStore((s) => s.season);

  // Calculate per-game stats for all players
  const playerStats = useMemo(() => {
    const gamesPlayed = season.games.filter((g) => g.played).length / 30; // Average games per team

    return players
      .filter((p) => p.teamId) // Only players on teams
      .map((player) => {
        const team = teams.find((t) => t.id === player.teamId);
        return {
          player,
          team: team ? `${team.city} ${team.name}` : "Free Agent",
          teamLogo: team?.logo || "🏀",
          ppg: gamesPlayed > 0 ? parseFloat((player.stats.points / gamesPlayed).toFixed(1)) : 0,
          rpg: gamesPlayed > 0 ? parseFloat((player.stats.rebounds / gamesPlayed).toFixed(1)) : 0,
          apg: gamesPlayed > 0 ? parseFloat((player.stats.assists / gamesPlayed).toFixed(1)) : 0,
          spg: gamesPlayed > 0 ? parseFloat((player.stats.steals / gamesPlayed).toFixed(1)) : 0,
          bpg: gamesPlayed > 0 ? parseFloat((player.stats.blocks / gamesPlayed).toFixed(1)) : 0,
        };
      });
  }, [players, teams, season]);

  // Sort players based on selected category
  const sortedPlayers = useMemo(() => {
    return [...playerStats].sort((a, b) => {
      if (selectedCategory === "overall") {
        return b.player.overall - a.player.overall;
      }
      return b[selectedCategory] - a[selectedCategory];
    });
  }, [playerStats, selectedCategory]);

  const getOVRColor = (overall: number) => {
    if (overall >= 90) return "text-purple-400";
    if (overall >= 85) return "text-blue-400";
    if (overall >= 80) return "text-green-400";
    if (overall >= 75) return "text-yellow-400";
    if (overall >= 70) return "text-orange-400";
    return "text-gray-400";
  };

  const categories = [
    { key: "ppg" as StatCategory, label: "PPG", icon: "🏀" },
    { key: "rpg" as StatCategory, label: "RPG", icon: "💪" },
    { key: "apg" as StatCategory, label: "APG", icon: "🎯" },
    { key: "spg" as StatCategory, label: "SPG", icon: "🛡️" },
    { key: "bpg" as StatCategory, label: "BPG", icon: "🚫" },
    { key: "overall" as StatCategory, label: "OVR", icon: "⭐" },
  ];

  const handlePlayerPress = (player: Player) => {
    setSelectedPlayer(player);
    setModalVisible(true);
  };

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
              selectedCategory === cat.key
                ? "bg-purple-600"
                : "bg-gray-800"
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
              Player
            </Text>
            <Text className="text-gray-400 text-xs font-semibold w-16 text-center">
              OVR
            </Text>
            <Text className="text-gray-400 text-xs font-semibold w-14 text-center">
              PPG
            </Text>
            <Text className="text-gray-400 text-xs font-semibold w-14 text-center">
              RPG
            </Text>
            <Text className="text-gray-400 text-xs font-semibold w-14 text-center">
              APG
            </Text>
          </View>
        </View>

        {/* Player Rows */}
        {sortedPlayers.map((stat, index) => {
          const isTopThree = index < 3;
          return (
            <Pressable
              key={stat.player.id}
              onPress={() => handlePlayerPress(stat.player)}
              className={`px-4 py-3 border-b border-gray-800 ${
                isTopThree ? "bg-gray-900/80" : "bg-gray-950"
              }`}
            >
              <View className="flex-row items-center">
                {/* Rank */}
                <View className="w-10 items-center">
                  {isTopThree ? (
                    <Text className="text-2xl">
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                    </Text>
                  ) : (
                    <Text className="text-gray-500 font-bold">{index + 1}</Text>
                  )}
                </View>

                {/* Player Info */}
                <View className="flex-1 ml-2">
                  <Text className="text-white font-semibold" numberOfLines={1}>
                    {stat.player.name}
                  </Text>
                  <View className="flex-row items-center mt-0.5">
                    <Text className="text-lg mr-1">{stat.teamLogo}</Text>
                    <Text className="text-gray-500 text-xs" numberOfLines={1}>
                      {stat.player.position} • {stat.team}
                    </Text>
                  </View>
                </View>

                {/* Stats */}
                <Text
                  className={`w-16 text-center font-bold ${getOVRColor(
                    stat.player.overall
                  )}`}
                >
                  {stat.player.overall}
                </Text>
                <Text className="w-14 text-center text-white font-semibold">
                  {stat.ppg}
                </Text>
                <Text className="w-14 text-center text-white font-semibold">
                  {stat.rpg}
                </Text>
                <Text className="w-14 text-center text-white font-semibold">
                  {stat.apg}
                </Text>
              </View>

              {/* Secondary Stats */}
              <View className="flex-row items-center mt-2 ml-12">
                <View className="flex-row items-center mr-4">
                  <Text className="text-gray-500 text-xs">STL: </Text>
                  <Text className="text-gray-300 text-xs font-medium">
                    {stat.spg}
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <Text className="text-gray-500 text-xs">BLK: </Text>
                  <Text className="text-gray-300 text-xs font-medium">
                    {stat.bpg}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Player Details Modal */}
      {selectedPlayer && (
        <PlayerDetailsModal
          visible={modalVisible}
          player={selectedPlayer}
          onClose={() => setModalVisible(false)}
        />
      )}
    </View>
  );
}
