import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { useBasketballStore } from "../state/basketballStore";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { Player } from "../types/basketball";
import PlayerDetailsModal from "../components/PlayerDetailsModal";
import CoachDetailsModal from "../components/CoachDetailsModal";
import PlayerActionMenu from "../components/PlayerActionMenu";

type Props = NativeStackScreenProps<RootStackParamList, "Roster">;

export default function RosterScreen({ navigation }: Props) {
  const teams = useBasketballStore((s) => s.teams);
  const players = useBasketballStore((s) => s.players);
  const coaches = useBasketballStore((s) => s.coaches);
  const userTeamId = useBasketballStore((s) => s.userTeamId);
  const releasePlayer = useBasketballStore((s) => s.releasePlayer);

  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [coachModalVisible, setCoachModalVisible] = useState(false);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [actionMenuPlayer, setActionMenuPlayer] = useState<Player | null>(null);
  const [viewingTeamId, setViewingTeamId] = useState<string>(userTeamId);
  const [showTeamPicker, setShowTeamPicker] = useState(false);

  const viewingTeam = teams.find((t) => t.id === viewingTeamId);
  const viewingCoach = coaches.find((c) => c.id === viewingTeam?.coachId);
  const isViewingOwnTeam = viewingTeamId === userTeamId;
  const roster = players.filter((p) => viewingTeam?.playerIds.includes(p.id));

  const groupedRoster = {
    PG: roster.filter((p) => p.position === "PG").sort((a, b) => b.overall - a.overall),
    SG: roster.filter((p) => p.position === "SG").sort((a, b) => b.overall - a.overall),
    SF: roster.filter((p) => p.position === "SF").sort((a, b) => b.overall - a.overall),
    PF: roster.filter((p) => p.position === "PF").sort((a, b) => b.overall - a.overall),
    C: roster.filter((p) => p.position === "C").sort((a, b) => b.overall - a.overall),
  };

  const totalSalary = roster.reduce((sum, p) => sum + p.contract.salary, 0);
  const capSpace = viewingTeam ? viewingTeam.budget - totalSalary : 0;

  const getOverallColor = (overall: number) => {
    if (overall >= 90) return "text-purple-400";
    if (overall >= 85) return "text-blue-400";
    if (overall >= 80) return "text-green-400";
    if (overall >= 75) return "text-yellow-400";
    if (overall >= 70) return "text-orange-400";
    return "text-gray-400";
  };

  const handleWaive = (player: Player) => {
    Alert.alert(
      "Waive Player",
      `Are you sure you want to waive ${player.name}? This will release them from your roster.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Waive",
          style: "destructive",
          onPress: () => releasePlayer(player.id),
        },
      ]
    );
  };

  const handleExtend = (player: Player) => {
    // Navigate to contract negotiation screen
    navigation.navigate("ContractNegotiation", {
      playerId: player.id,
      isExtension: true,
    });
  };

  const handleTrade = (player: Player) => {
    // Navigate to trades screen
    navigation.navigate("Trades");
  };

  const renderPlayer = (player: Player) => (
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
        <View className="flex-row items-center gap-3">
          <Text className="text-gray-400 text-xs">
            Age {player.age} • {player.contract.years} yr{player.contract.years !== 1 ? "s" : ""} • ${player.contract.salary.toFixed(1)}M / yr
          </Text>
        </View>
        <View className="flex-row items-center gap-3 mt-1">
          <Text className="text-gray-500 text-xs">
            {player.stats.points} PTS • {player.stats.rebounds} REB • {player.stats.assists} AST
          </Text>
        </View>
      </View>
      <View className="items-end gap-2">
        <View className="flex-row items-center gap-2">
          <Text className={`text-2xl font-bold ${getOverallColor(player.overall)}`}>
            {player.overall}
          </Text>
          <Text className="text-gray-600 text-sm">OVR</Text>
        </View>
        {isViewingOwnTeam && (
          <Pressable
            className="bg-gray-700 rounded-full p-2 active:bg-gray-600"
            onPress={(e) => {
              e.stopPropagation();
              setActionMenuPlayer(player);
              setActionMenuVisible(true);
            }}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color="#9CA3AF" />
          </Pressable>
        )}
      </View>
    </Pressable>
  );

  return (
    <View className="flex-1 bg-gray-950">
      {/* Header */}
      <View className="px-6 pt-16 pb-4 bg-gray-900 border-b border-gray-800">
        <View className="flex-row items-center mb-4">
          <View className="flex-1">
            <Text className="text-gray-400 text-sm">
              {isViewingOwnTeam ? "YOUR ROSTER" : "ROSTER"}
            </Text>
            <Pressable
              onPress={() => setShowTeamPicker(!showTeamPicker)}
              className="flex-row items-center gap-2"
            >
              <Text className="text-white text-2xl font-bold">
                {viewingTeam?.city} {viewingTeam?.name}
              </Text>
              <Ionicons
                name={showTeamPicker ? "chevron-up" : "chevron-down"}
                size={24}
                color="#60A5FA"
              />
            </Pressable>
            {viewingCoach && (
              <Pressable
                onPress={() => setCoachModalVisible(true)}
                className="flex-row items-center gap-1 mt-1"
              >
                <Text className="text-gray-400 text-sm">Coach:</Text>
                <Text className="text-blue-400 text-sm underline">{viewingCoach.name}</Text>
                <Ionicons name="information-circle" size={14} color="#60A5FA" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Team Picker Dropdown */}
        {showTeamPicker && (
          <View className="mb-4 bg-gray-800 rounded-xl max-h-64 border border-gray-700">
            <ScrollView>
              {teams
                .sort((a, b) => {
                  // User team first
                  if (a.id === userTeamId) return -1;
                  if (b.id === userTeamId) return 1;
                  // Then by wins
                  return b.wins - a.wins;
                })
                .map((team) => (
                  <Pressable
                    key={team.id}
                    onPress={() => {
                      setViewingTeamId(team.id);
                      setShowTeamPicker(false);
                    }}
                    className={`p-3 border-b border-gray-700 active:bg-gray-700 ${
                      team.id === viewingTeamId ? "bg-blue-900/30" : ""
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-white text-base font-semibold">
                            {team.city} {team.name}
                          </Text>
                          {team.id === userTeamId && (
                            <View className="bg-blue-600 rounded px-2 py-0.5">
                              <Text className="text-white text-xs font-bold">YOU</Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-gray-400 text-sm mt-0.5">
                          {team.wins}-{team.losses}
                        </Text>
                      </View>
                      {team.id === viewingTeamId && (
                        <Ionicons name="checkmark-circle" size={24} color="#3B82F6" />
                      )}
                    </View>
                  </Pressable>
                ))}
            </ScrollView>
          </View>
        )}

        <View className="flex-row justify-between bg-gray-800 rounded-lg p-3">
          <View>
            <Text className="text-gray-400 text-xs">Roster Size</Text>
            <Text className="text-white text-lg font-bold">{roster.length}/15</Text>
          </View>
          <View>
            <Text className="text-gray-400 text-xs">Salary</Text>
            <Text className="text-white text-lg font-bold">${totalSalary.toFixed(1)}M</Text>
          </View>
          <View>
            <Text className="text-gray-400 text-xs">Cap Space</Text>
            <Text
              className={`text-lg font-bold ${
                capSpace > 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              ${capSpace.toFixed(1)}M
            </Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-6 py-4">
        {/* Point Guards */}
        <View className="mb-6">
          <Text className="text-gray-400 text-xs font-semibold mb-3 tracking-wider">
            POINT GUARDS
          </Text>
          {groupedRoster.PG.length > 0 ? (
            groupedRoster.PG.map(renderPlayer)
          ) : (
            <Text className="text-gray-600 text-center py-4">No point guards</Text>
          )}
        </View>

        {/* Shooting Guards */}
        <View className="mb-6">
          <Text className="text-gray-400 text-xs font-semibold mb-3 tracking-wider">
            SHOOTING GUARDS
          </Text>
          {groupedRoster.SG.length > 0 ? (
            groupedRoster.SG.map(renderPlayer)
          ) : (
            <Text className="text-gray-600 text-center py-4">No shooting guards</Text>
          )}
        </View>

        {/* Small Forwards */}
        <View className="mb-6">
          <Text className="text-gray-400 text-xs font-semibold mb-3 tracking-wider">
            SMALL FORWARDS
          </Text>
          {groupedRoster.SF.length > 0 ? (
            groupedRoster.SF.map(renderPlayer)
          ) : (
            <Text className="text-gray-600 text-center py-4">No small forwards</Text>
          )}
        </View>

        {/* Power Forwards */}
        <View className="mb-6">
          <Text className="text-gray-400 text-xs font-semibold mb-3 tracking-wider">
            POWER FORWARDS
          </Text>
          {groupedRoster.PF.length > 0 ? (
            groupedRoster.PF.map(renderPlayer)
          ) : (
            <Text className="text-gray-600 text-center py-4">No power forwards</Text>
          )}
        </View>

        {/* Centers */}
        <View className="mb-6">
          <Text className="text-gray-400 text-xs font-semibold mb-3 tracking-wider">
            CENTERS
          </Text>
          {groupedRoster.C.length > 0 ? (
            groupedRoster.C.map(renderPlayer)
          ) : (
            <Text className="text-gray-600 text-center py-4">No centers</Text>
          )}
        </View>

        {/* Free Agents Button */}
        {isViewingOwnTeam && (
          <Pressable
            className="bg-blue-600 rounded-xl p-4 items-center mb-8 active:bg-blue-700"
            onPress={() => navigation.navigate("FreeAgents")}
          >
            <Text className="text-white font-semibold text-base">Sign Free Agents</Text>
          </Pressable>
        )}
      </ScrollView>

      <PlayerDetailsModal
        player={selectedPlayer}
        visible={detailsVisible}
        onClose={() => setDetailsVisible(false)}
      />

      {/* Coach Details Modal */}
      <CoachDetailsModal
        coach={viewingCoach || null}
        visible={coachModalVisible}
        onClose={() => setCoachModalVisible(false)}
      />

      {/* Player Action Menu */}
      <PlayerActionMenu
        visible={actionMenuVisible}
        player={actionMenuPlayer}
        onClose={() => setActionMenuVisible(false)}
        onWaive={() => actionMenuPlayer && handleWaive(actionMenuPlayer)}
        onExtend={() => actionMenuPlayer && handleExtend(actionMenuPlayer)}
        onTrade={() => actionMenuPlayer && handleTrade(actionMenuPlayer)}
      />
    </View>
  );
}
