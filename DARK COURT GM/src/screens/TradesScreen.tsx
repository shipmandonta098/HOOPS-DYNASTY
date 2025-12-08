import React, { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useBasketballStore } from "../state/basketballStore";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { Player } from "../types/basketball";
import PlayerDetailsModal from "../components/PlayerDetailsModal";

type Props = NativeStackScreenProps<RootStackParamList, "Trades">;

export default function TradesScreen({ navigation }: Props) {
  const teams = useBasketballStore((s) => s.teams);
  const players = useBasketballStore((s) => s.players);
  const userTeamId = useBasketballStore((s) => s.userTeamId);
  const tradePlayer = useBasketballStore((s) => s.tradePlayer);

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedUserPlayer, setSelectedUserPlayer] = useState<string | null>(null);
  const [selectedOtherPlayer, setSelectedOtherPlayer] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [detailsPlayer, setDetailsPlayer] = useState<Player | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  const userTeam = teams.find((t) => t.id === userTeamId);
  const otherTeams = teams.filter((t) => t.id !== userTeamId);
  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  const userRoster = players.filter((p) => userTeam?.playerIds.includes(p.id));
  const otherRoster = selectedTeam
    ? players.filter((p) => selectedTeam.playerIds.includes(p.id))
    : [];

  const getOverallColor = (overall: number) => {
    if (overall >= 90) return "text-purple-400";
    if (overall >= 85) return "text-blue-400";
    if (overall >= 80) return "text-green-400";
    if (overall >= 75) return "text-yellow-400";
    if (overall >= 70) return "text-orange-400";
    return "text-gray-400";
  };

  const handleTrade = () => {
    if (!selectedUserPlayer || !selectedOtherPlayer || !selectedTeamId || !userTeamId) return;

    tradePlayer(selectedUserPlayer, userTeamId, selectedTeamId);
    tradePlayer(selectedOtherPlayer, selectedTeamId, userTeamId);

    setShowSuccess(true);
    setSelectedUserPlayer(null);
    setSelectedOtherPlayer(null);

    setTimeout(() => {
      setShowSuccess(false);
      setSelectedTeamId(null);
    }, 2000);
  };

  const renderPlayerCard = (
    player: Player,
    isSelected: boolean,
    onPress: () => void,
    disabled: boolean = false
  ) => (
    <View key={player.id} className="mb-2">
      <Pressable
        className={`rounded-lg px-4 py-3 flex-row items-center ${
          isSelected ? "bg-blue-700" : "bg-gray-800"
        } ${disabled ? "opacity-50" : "active:bg-gray-700"}`}
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
      >
        <View className="flex-1">
          <Text className="text-white font-semibold">{player.name}</Text>
          <Text className="text-gray-400 text-xs mt-1">
            {player.position} • Age {player.age} • ${player.contract.salary}M
          </Text>
        </View>
        <View className="flex-row items-center gap-3">
          <Text className={`text-2xl font-bold ${getOverallColor(player.overall)}`}>
            {player.overall}
          </Text>
          <Pressable
            className="bg-gray-700 rounded p-2 active:bg-gray-600"
            onPress={(e) => {
              e.stopPropagation();
              setDetailsPlayer(player);
              setDetailsVisible(true);
            }}
          >
            <Ionicons name="information-circle-outline" size={20} color="white" />
          </Pressable>
        </View>
      </Pressable>
    </View>
  );

  return (
    <View className="flex-1 bg-gray-950">
      {/* Header */}
      <View className="px-6 pt-16 pb-4 bg-gray-900 border-b border-gray-800">
        <View className="flex-row items-center">
          <View>
            <Text className="text-gray-400 text-sm">TRADE CENTER</Text>
            <Text className="text-white text-2xl font-bold">Make a Trade</Text>
          </View>
        </View>
      </View>

      {showSuccess && (
        <View className="bg-green-600 px-6 py-3">
          <Text className="text-white font-semibold text-center">Trade Completed!</Text>
        </View>
      )}

      <ScrollView className="flex-1">
        {!selectedTeamId ? (
          <View className="px-6 py-4">
            <Text className="text-gray-400 text-xs font-semibold mb-3 tracking-wider">
              SELECT A TEAM TO TRADE WITH
            </Text>
            {otherTeams.map((team) => (
              <Pressable
                key={team.id}
                className="bg-gray-800 rounded-lg px-4 py-4 mb-2 flex-row items-center justify-between active:bg-gray-700"
                onPress={() => setSelectedTeamId(team.id)}
              >
                <View>
                  <Text className="text-white font-semibold text-base">
                    {team.city} {team.name}
                  </Text>
                  <Text className="text-gray-400 text-sm mt-1">
                    {team.wins}-{team.losses} • {team.playerIds.length} players
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
              </Pressable>
            ))}
          </View>
        ) : (
          <View className="px-6 py-4">
            {/* Your Team */}
            <View className="mb-6">
              <Text className="text-gray-400 text-xs font-semibold mb-3 tracking-wider">
                YOUR TEAM - SELECT PLAYER TO TRADE
              </Text>
              {userRoster.sort((a, b) => b.overall - a.overall).map((player) =>
                renderPlayerCard(
                  player,
                  selectedUserPlayer === player.id,
                  () => setSelectedUserPlayer(player.id),
                  !!selectedOtherPlayer && selectedUserPlayer !== player.id
                )
              )}
            </View>

            {/* Trade Icon */}
            <View className="items-center my-4">
              <View className="bg-gray-800 rounded-full p-4">
                <Ionicons name="swap-vertical" size={32} color="#60A5FA" />
              </View>
            </View>

            {/* Other Team */}
            <View className="mb-6">
              <Text className="text-gray-400 text-xs font-semibold mb-3 tracking-wider">
                {selectedTeam?.city.toUpperCase()} {selectedTeam?.name.toUpperCase()} - SELECT
                PLAYER TO ACQUIRE
              </Text>
              {otherRoster.sort((a, b) => b.overall - a.overall).map((player) =>
                renderPlayerCard(
                  player,
                  selectedOtherPlayer === player.id,
                  () => setSelectedOtherPlayer(player.id),
                  !!selectedUserPlayer && selectedOtherPlayer !== player.id
                )
              )}
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-3 mb-8">
              <Pressable
                className="flex-1 bg-gray-800 rounded-xl p-4 items-center active:bg-gray-700"
                onPress={() => {
                  setSelectedTeamId(null);
                  setSelectedUserPlayer(null);
                  setSelectedOtherPlayer(null);
                }}
              >
                <Text className="text-white font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                className={`flex-1 rounded-xl p-4 items-center ${
                  selectedUserPlayer && selectedOtherPlayer
                    ? "bg-blue-600 active:bg-blue-700"
                    : "bg-gray-700"
                }`}
                onPress={handleTrade}
                disabled={!selectedUserPlayer || !selectedOtherPlayer}
              >
                <Text
                  className={`font-semibold ${
                    selectedUserPlayer && selectedOtherPlayer ? "text-white" : "text-gray-500"
                  }`}
                >
                  Complete Trade
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      <PlayerDetailsModal
        player={detailsPlayer}
        visible={detailsVisible}
        onClose={() => setDetailsVisible(false)}
      />
    </View>
  );
}
