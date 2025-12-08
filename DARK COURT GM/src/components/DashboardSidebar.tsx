import React, { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useBasketballStore } from "../state/basketballStore";
import { Player } from "../types/basketball";
import PlayerDetailsModal from "./PlayerDetailsModal";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing
} from "react-native-reanimated";

type Tab = "roster" | "trades";

interface DashboardSidebarProps {
  screenHeight: number;
}

export default function DashboardSidebar({ screenHeight }: DashboardSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("roster");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  // Roster state
  const [viewingTeamId, setViewingTeamId] = useState<string>("");
  const [showTeamPicker, setShowTeamPicker] = useState(false);

  // Trades state
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedUserPlayer, setSelectedUserPlayer] = useState<string | null>(null);
  const [selectedOtherPlayer, setSelectedOtherPlayer] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const teams = useBasketballStore((s) => s.teams);
  const players = useBasketballStore((s) => s.players);
  const userTeamId = useBasketballStore((s) => s.userTeamId);
  const releasePlayer = useBasketballStore((s) => s.releasePlayer);
  const tradePlayer = useBasketballStore((s) => s.tradePlayer);

  // Initialize viewing team ID
  React.useEffect(() => {
    if (userTeamId && !viewingTeamId) {
      setViewingTeamId(userTeamId);
    }
  }, [userTeamId, viewingTeamId]);

  const sidebarWidth = useSharedValue(60);

  const animatedStyle = useAnimatedStyle(() => ({
    width: sidebarWidth.value,
  }));

  const toggleSidebar = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    sidebarWidth.value = withTiming(newState ? 340 : 60, {
      duration: 300,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  };

  const getOverallColor = (overall: number) => {
    if (overall >= 90) return "text-purple-400";
    if (overall >= 85) return "text-blue-400";
    if (overall >= 80) return "text-green-400";
    if (overall >= 75) return "text-yellow-400";
    if (overall >= 70) return "text-orange-400";
    return "text-gray-400";
  };

  // Roster logic
  const viewingTeam = teams.find((t) => t.id === viewingTeamId);
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

  // Trades logic
  const userTeam = teams.find((t) => t.id === userTeamId);
  const otherTeams = teams.filter((t) => t.id !== userTeamId);
  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  const userRoster = players.filter((p) => userTeam?.playerIds.includes(p.id));
  const otherRoster = selectedTeam
    ? players.filter((p) => selectedTeam.playerIds.includes(p.id))
    : [];

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
    showRelease: boolean = false
  ) => (
    <Pressable
      key={player.id}
      className={`rounded-lg px-3 py-2 mb-2 ${isSelected ? "bg-blue-700" : "bg-gray-800"} active:bg-gray-700`}
      onPress={onPress}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-white font-semibold text-sm" numberOfLines={1}>
            {player.name}
          </Text>
          <Text className="text-gray-400 text-xs mt-1">
            {player.position} • {player.age}y • ${player.contract.salary}M
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className={`text-xl font-bold ${getOverallColor(player.overall)}`}>
            {player.overall}
          </Text>
          {showRelease && (
            <Pressable
              className="bg-red-900 rounded px-2 py-1 active:bg-red-800"
              onPress={(e) => {
                e.stopPropagation();
                releasePlayer(player.id);
              }}
            >
              <Text className="text-red-300 text-xs">X</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );

  const renderRosterContent = () => (
    <View className="flex-1 px-3 pt-3">
      {/* Team Selector */}
      <View className="mb-3">
        <Pressable
          className="bg-gray-800 rounded-lg p-3 flex-row items-center justify-between active:bg-gray-700"
          onPress={() => setShowTeamPicker(!showTeamPicker)}
        >
          <View className="flex-1">
            <Text className="text-gray-400 text-xs mb-1">Viewing Team</Text>
            <Text className="text-white font-semibold">
              {viewingTeam?.city} {viewingTeam?.name}
            </Text>
          </View>
          <Ionicons
            name={showTeamPicker ? "chevron-up" : "chevron-down"}
            size={20}
            color="white"
          />
        </Pressable>

        {showTeamPicker && (
          <ScrollView className="max-h-48 mt-2 bg-gray-800 rounded-lg" nestedScrollEnabled>
            {[...teams]
              .sort((a, b) => {
                if (a.id === userTeamId) return -1;
                if (b.id === userTeamId) return 1;
                return b.wins - a.wins;
              })
              .map((team) => (
                <Pressable
                  key={team.id}
                  className={`p-3 border-b border-gray-700 active:bg-gray-700 ${
                    team.id === viewingTeamId ? "bg-gray-700" : ""
                  }`}
                  onPress={() => {
                    setViewingTeamId(team.id);
                    setShowTeamPicker(false);
                  }}
                >
                  <Text className="text-white font-semibold">
                    {team.city} {team.name}
                  </Text>
                  <Text className="text-gray-400 text-xs">
                    {team.wins}-{team.losses}
                    {team.id === userTeamId && " (Your Team)"}
                  </Text>
                </Pressable>
              ))}
          </ScrollView>
        )}
      </View>

      {/* Cap Space */}
      <View className="bg-gray-800 rounded-lg p-3 mb-3">
        <View className="flex-row justify-between">
          <Text className="text-gray-400 text-xs">Salary</Text>
          <Text className="text-white text-sm font-semibold">${totalSalary.toFixed(1)}M</Text>
        </View>
        <View className="flex-row justify-between mt-1">
          <Text className="text-gray-400 text-xs">Cap Space</Text>
          <Text className={`text-sm font-semibold ${capSpace >= 0 ? "text-green-400" : "text-red-400"}`}>
            ${capSpace.toFixed(1)}M
          </Text>
        </View>
      </View>

      {/* Roster by Position */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {(["PG", "SG", "SF", "PF", "C"] as const).map((position) => (
          <View key={position} className="mb-4">
            <Text className="text-gray-400 text-xs uppercase tracking-wider mb-2">
              {position}
            </Text>
            {groupedRoster[position].length > 0 ? (
              groupedRoster[position].map((player) =>
                renderPlayerCard(
                  player,
                  false,
                  () => {
                    setSelectedPlayer(player);
                    setDetailsVisible(true);
                  },
                  isViewingOwnTeam
                )
              )
            ) : (
              <View className="bg-gray-800 rounded-lg p-3 mb-2">
                <Text className="text-gray-500 text-sm text-center">No players</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );

  const renderTradesContent = () => (
    <View className="flex-1 px-3 pt-3">
      {!selectedTeamId ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text className="text-gray-400 text-xs uppercase tracking-wider mb-2">
            Select Team to Trade With
          </Text>
          {otherTeams
            .sort((a, b) => b.wins - a.wins)
            .map((team) => (
              <Pressable
                key={team.id}
                className="bg-gray-800 rounded-lg p-3 mb-2 active:bg-gray-700"
                onPress={() => setSelectedTeamId(team.id)}
              >
                <Text className="text-white font-semibold">
                  {team.city} {team.name}
                </Text>
                <Text className="text-gray-400 text-xs mt-1">
                  {team.wins}-{team.losses}
                </Text>
              </Pressable>
            ))}
        </ScrollView>
      ) : (
        <View className="flex-1">
          {/* Trade Header */}
          <View className="flex-row items-center justify-between mb-3">
            <Pressable
              className="bg-gray-800 rounded-lg p-2 active:bg-gray-700"
              onPress={() => {
                setSelectedTeamId(null);
                setSelectedUserPlayer(null);
                setSelectedOtherPlayer(null);
              }}
            >
              <Ionicons name="arrow-back" size={20} color="white" />
            </Pressable>
            <Text className="text-white font-semibold text-sm">
              Trade with {selectedTeam?.city}
            </Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            {/* Your Team */}
            <View className="mb-4">
              <Text className="text-gray-400 text-xs uppercase tracking-wider mb-2">
                Your Team
              </Text>
              {userRoster.map((player) =>
                renderPlayerCard(
                  player,
                  selectedUserPlayer === player.id,
                  () => setSelectedUserPlayer(player.id)
                )
              )}
            </View>

            {/* Other Team */}
            <View className="mb-4">
              <Text className="text-gray-400 text-xs uppercase tracking-wider mb-2">
                {selectedTeam?.city} {selectedTeam?.name}
              </Text>
              {otherRoster.map((player) =>
                renderPlayerCard(
                  player,
                  selectedOtherPlayer === player.id,
                  () => setSelectedOtherPlayer(player.id)
                )
              )}
            </View>
          </ScrollView>

          {/* Trade Button */}
          <View className="p-3 bg-gray-900 border-t border-gray-800">
            <Pressable
              className={`rounded-lg p-3 items-center ${
                selectedUserPlayer && selectedOtherPlayer
                  ? "bg-blue-600 active:bg-blue-700"
                  : "bg-gray-700"
              }`}
              onPress={handleTrade}
              disabled={!selectedUserPlayer || !selectedOtherPlayer}
            >
              <Text
                className={`font-bold ${
                  selectedUserPlayer && selectedOtherPlayer ? "text-white" : "text-gray-500"
                }`}
              >
                Complete Trade
              </Text>
            </Pressable>
          </View>

          {/* Success Message */}
          {showSuccess && (
            <View className="absolute top-1/2 left-1/2 -ml-20 -mt-10 bg-green-600 rounded-xl p-4 items-center">
              <Ionicons name="checkmark-circle" size={32} color="white" />
              <Text className="text-white font-bold mt-2">Trade Successful!</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );

  return (
    <>
      <Animated.View
        style={[
          animatedStyle,
          {
            height: screenHeight,
            position: "absolute",
            right: 0,
            top: 0,
            zIndex: 50,
          },
        ]}
        className="bg-gray-900 border-l border-gray-800"
      >
        {/* Toggle Button */}
        <Pressable
          className="absolute left-0 top-1/2 -ml-10 bg-gray-800 rounded-l-lg p-2 border border-gray-700 border-r-0 active:bg-gray-700"
          onPress={toggleSidebar}
          style={{ transform: [{ translateY: -20 }] }}
        >
          <Ionicons
            name={isExpanded ? "chevron-forward" : "chevron-back"}
            size={24}
            color="white"
          />
        </Pressable>

        {/* Sidebar Content */}
        {!isExpanded ? (
          // Collapsed state - show icons
          <View className="flex-1 items-center pt-20">
            <Pressable
              className={`p-4 mb-4 rounded-lg ${activeTab === "roster" ? "bg-gray-700" : ""}`}
              onPress={() => {
                setActiveTab("roster");
                toggleSidebar();
              }}
            >
              <Ionicons name="people" size={24} color="#60A5FA" />
            </Pressable>
            <Pressable
              className={`p-4 rounded-lg ${activeTab === "trades" ? "bg-gray-700" : ""}`}
              onPress={() => {
                setActiveTab("trades");
                toggleSidebar();
              }}
            >
              <Ionicons name="swap-horizontal" size={24} color="#60A5FA" />
            </Pressable>
          </View>
        ) : (
          // Expanded state
          <View className="flex-1">
            {/* Tabs */}
            <View className="flex-row border-b border-gray-800 pt-16">
              <Pressable
                className={`flex-1 p-3 items-center ${
                  activeTab === "roster" ? "border-b-2 border-blue-500" : ""
                }`}
                onPress={() => setActiveTab("roster")}
              >
                <View className="flex-row items-center gap-2">
                  <Ionicons name="people" size={20} color={activeTab === "roster" ? "#60A5FA" : "#9CA3AF"} />
                  <Text
                    className={`font-semibold ${
                      activeTab === "roster" ? "text-blue-400" : "text-gray-400"
                    }`}
                  >
                    Roster
                  </Text>
                </View>
              </Pressable>
              <Pressable
                className={`flex-1 p-3 items-center ${
                  activeTab === "trades" ? "border-b-2 border-blue-500" : ""
                }`}
                onPress={() => setActiveTab("trades")}
              >
                <View className="flex-row items-center gap-2">
                  <Ionicons name="swap-horizontal" size={20} color={activeTab === "trades" ? "#60A5FA" : "#9CA3AF"} />
                  <Text
                    className={`font-semibold ${
                      activeTab === "trades" ? "text-blue-400" : "text-gray-400"
                    }`}
                  >
                    Trades
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* Tab Content */}
            {activeTab === "roster" && renderRosterContent()}
            {activeTab === "trades" && renderTradesContent()}
          </View>
        )}
      </Animated.View>

      {/* Player Details Modal */}
      <PlayerDetailsModal
        visible={detailsVisible}
        player={selectedPlayer}
        onClose={() => {
          setDetailsVisible(false);
          setSelectedPlayer(null);
        }}
      />
    </>
  );
}
