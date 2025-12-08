import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput } from "react-native";
import { useBasketballStore } from "../state/basketballStore";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { Player } from "../types/basketball";
import PlayerDetailsModal from "../components/PlayerDetailsModal";

type Props = NativeStackScreenProps<RootStackParamList, "FreeAgents">;

export default function FreeAgentsScreen({ navigation }: Props) {
  const teams = useBasketballStore((s) => s.teams);
  const players = useBasketballStore((s) => s.players);
  const userTeamId = useBasketballStore((s) => s.userTeamId);
  const signPlayer = useBasketballStore((s) => s.signPlayer);

  const [selectedPosition, setSelectedPosition] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  const userTeam = teams.find((t) => t.id === userTeamId);
  const userRoster = players.filter((p) => userTeam?.playerIds.includes(p.id));
  const totalSalary = userRoster.reduce((sum, p) => sum + p.contract.salary, 0);
  const capSpace = userTeam ? userTeam.budget - totalSalary : 0;

  const freeAgents = players.filter((p) => !p.teamId);

  const filteredAgents = freeAgents
    .filter((p) => {
      const matchesPosition = selectedPosition === "ALL" || p.position === selectedPosition;
      const matchesSearch =
        searchQuery === "" || p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesPosition && matchesSearch;
    })
    .sort((a, b) => b.overall - a.overall);

  const positions = ["ALL", "PG", "SG", "SF", "PF", "C"];

  const getOverallColor = (overall: number) => {
    if (overall >= 90) return "text-purple-400";
    if (overall >= 85) return "text-blue-400";
    if (overall >= 80) return "text-green-400";
    if (overall >= 75) return "text-yellow-400";
    if (overall >= 70) return "text-orange-400";
    return "text-gray-400";
  };

  const handleSignPlayer = (player: Player) => {
    if (userRoster.length >= 15) {
      return;
    }

    if (player.contract.salary > capSpace) {
      return;
    }

    signPlayer(player.id, userTeamId);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const canAfford = (salary: number) => salary <= capSpace;
  const hasRosterSpace = userRoster.length < 15;

  return (
    <View className="flex-1 bg-gray-950">
      {/* Header */}
      <View className="px-6 pt-16 pb-4 bg-gray-900 border-b border-gray-800">
        <View className="flex-row items-center mb-4">
          <View className="flex-1">
            <Text className="text-gray-400 text-sm">FREE AGENCY</Text>
            <Text className="text-white text-2xl font-bold">Available Players</Text>
          </View>
        </View>

        {/* Cap Space Info */}
        <View className="bg-gray-800 rounded-lg p-3 mb-3 flex-row justify-between">
          <View>
            <Text className="text-gray-400 text-xs">Cap Space</Text>
            <Text
              className={`text-lg font-bold ${capSpace > 0 ? "text-green-400" : "text-red-400"}`}
            >
              ${capSpace.toFixed(1)}M
            </Text>
          </View>
          <View>
            <Text className="text-gray-400 text-xs">Roster Spots</Text>
            <Text className="text-white text-lg font-bold">
              {15 - userRoster.length} available
            </Text>
          </View>
        </View>

        {/* Search */}
        <View className="bg-gray-800 rounded-lg px-4 py-2 flex-row items-center mb-3">
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            className="flex-1 ml-3 text-white"
            placeholder="Search players..."
            placeholderTextColor="#6B7280"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Position Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
          {positions.map((pos) => (
            <Pressable
              key={pos}
              className={`rounded-full px-4 py-2 mr-2 ${
                selectedPosition === pos ? "bg-blue-600" : "bg-gray-800"
              }`}
              onPress={() => setSelectedPosition(pos)}
            >
              <Text
                className={`font-semibold ${
                  selectedPosition === pos ? "text-white" : "text-gray-400"
                }`}
              >
                {pos}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {showSuccess && (
        <View className="bg-green-600 px-6 py-3">
          <Text className="text-white font-semibold text-center">Player Signed!</Text>
        </View>
      )}

      <ScrollView className="flex-1 px-6 py-4">
        {filteredAgents.length === 0 ? (
          <View className="items-center justify-center py-12">
            <Ionicons name="people-outline" size={64} color="#4B5563" />
            <Text className="text-gray-500 text-center mt-4">No free agents found</Text>
          </View>
        ) : (
          filteredAgents.map((player) => {
            const affordable = canAfford(player.contract.salary);
            const canSign = affordable && hasRosterSpace;

            return (
              <Pressable
                key={player.id}
                className="bg-gray-800 rounded-lg px-4 py-3 mb-2 flex-row items-center active:bg-gray-700"
                onPress={() => {
                  setSelectedPlayer(player);
                  setDetailsVisible(true);
                }}
              >
                <View className="flex-1">
                  <Text className="text-white font-semibold text-base mb-1">{player.name}</Text>
                  <Text className="text-gray-400 text-xs mb-1">
                    {player.position} • Age {player.age} • {player.contract.years} yr{player.contract.years !== 1 ? "s" : ""} • $
                    {player.contract.salary.toFixed(1)}M / yr
                  </Text>
                  <View className="flex-row items-center gap-3">
                    <Text className="text-gray-500 text-xs">
                      {player.stats.points} PTS • {player.stats.rebounds} REB •{" "}
                      {player.stats.assists} AST
                    </Text>
                  </View>
                </View>
                <View className="items-end gap-2">
                  <Text className={`text-2xl font-bold ${getOverallColor(player.overall)}`}>
                    {player.overall}
                  </Text>
                  <Pressable
                    className={`rounded px-4 py-2 ${
                      canSign ? "bg-green-600 active:bg-green-700" : "bg-gray-700"
                    }`}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleSignPlayer(player);
                    }}
                    disabled={!canSign}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        canSign ? "text-white" : "text-gray-500"
                      }`}
                    >
                      {!hasRosterSpace
                        ? "Full"
                        : !affordable
                          ? "Too Expensive"
                          : "Sign"}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <PlayerDetailsModal
        player={selectedPlayer}
        visible={detailsVisible}
        onClose={() => setDetailsVisible(false)}
      />
    </View>
  );
}
