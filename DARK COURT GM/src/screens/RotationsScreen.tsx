import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, Modal, TextInput } from "react-native";
import { useBasketballStore } from "../state/basketballStore";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CoachDetailsModal from "../components/CoachDetailsModal";
import DepthChart from "../components/DepthChart";
import type { Player } from "../types/basketball";

interface DepthChartSlot {
  position: "PG" | "SG" | "SF" | "PF" | "C";
  string: 1 | 2 | 3;
  player: Player | null;
}

type Props = NativeStackScreenProps<RootStackParamList, "Rotations">;

export default function RotationsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [coachModalVisible, setCoachModalVisible] = useState(false);
  const [gmActionModalVisible, setGMActionModalVisible] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"suggest_starter" | "suggest_minutes" | "suggest_benching" | "manual_override">("suggest_minutes");
  const [requestedMinutes, setRequestedMinutes] = useState("");
  const [actionReason, setActionReason] = useState("");

  const teams = useBasketballStore((s) => s.teams);
  const players = useBasketballStore((s) => s.players);
  const coaches = useBasketballStore((s) => s.coaches);
  const userTeamId = useBasketballStore((s) => s.userTeamId);
  const getTeamRotation = useBasketballStore((s) => s.getTeamRotation);
  const getGMCoachRelationship = useBasketballStore((s) => s.getGMCoachRelationship);
  const submitGMAction = useBasketballStore((s) => s.submitGMAction);
  const processGMActions = useBasketballStore((s) => s.processGMActions);
  const gmActions = useBasketballStore((s) => s.gmActions);
  const updateRotationsFromDepthChart = useBasketballStore((s) => s.updateRotationsFromDepthChart);

  const userTeam = teams.find((t) => t.id === userTeamId);
  const userCoach = coaches.find((c) => c.id === userTeam?.coachId);
  const teamRotation = getTeamRotation(userTeamId);
  const relationship = getGMCoachRelationship(userTeamId);

  // Process pending GM actions on mount
  useEffect(() => {
    processGMActions();
  }, []);

  const userRoster = players.filter((p) => userTeam?.playerIds.includes(p.id));

  // Build starters from depth chart: 1st string at each position (PG, SG, SF, PF, C)
  const positions: Array<"PG" | "SG" | "SF" | "PF" | "C"> = ["PG", "SG", "SF", "PF", "C"];
  const starters = positions.map((pos, index) => {
    // Find the player with depthChartPosition matching this starter slot (1-5)
    const rotation = teamRotation?.rotations.find((r) => r.depthChartPosition === index + 1 && r.role === "starter");
    if (rotation) {
      const player = players.find((p) => p.id === rotation.playerId);
      return {
        ...rotation,
        player,
        displayPosition: pos, // Use the depth chart column position
      };
    }
    return null;
  }).filter((r) => r !== null && r.player);

  // Sort remaining players by depth chart position for bench/reserves
  const sortedRotation = teamRotation?.rotations
    .map((rotation) => ({
      ...rotation,
      player: players.find((p) => p.id === rotation.playerId),
    }))
    .filter((r) => r.player)
    .sort((a, b) => a.depthChartPosition - b.depthChartPosition) || [];

  const bench = sortedRotation.filter((r) => r.role === "bench");
  const reserves = sortedRotation.filter((r) => r.role === "reserve");
  const inactive = sortedRotation.filter((r) => r.role === "inactive");

  const recentActions = gmActions
    .filter((a) => a.teamId === userTeamId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  const getRelationshipColor = (status: string) => {
    switch (status) {
      case "excellent": return "text-green-400";
      case "good": return "text-blue-400";
      case "neutral": return "text-gray-400";
      case "strained": return "text-yellow-400";
      case "hostile": return "text-red-400";
      default: return "text-gray-400";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "accepted": return "text-green-400";
      case "rejected": return "text-red-400";
      case "pending": return "text-yellow-400";
      default: return "text-gray-400";
    }
  };

  const handleOpenActionModal = (playerId: string) => {
    setSelectedPlayerId(playerId);
    setGMActionModalVisible(true);
    setRequestedMinutes("");
    setActionReason("");
  };

  const handleSubmitAction = () => {
    if (!selectedPlayerId) return;

    const minutes = parseInt(requestedMinutes) || undefined;
    let role: "starter" | "bench" | "reserve" | "inactive" | undefined = undefined;

    if (actionType === "suggest_starter") role = "starter";
    if (actionType === "suggest_benching") role = "bench";

    submitGMAction(
      userTeamId,
      selectedPlayerId,
      actionType,
      minutes,
      role,
      actionReason || "GM Decision"
    );

    setGMActionModalVisible(false);
    setSelectedPlayerId(null);

    // Process actions if it's a suggestion
    if (actionType !== "manual_override") {
      setTimeout(() => processGMActions(), 500);
    }
  };

  const handleAutoSetByOVR = () => {
    // Auto-fill logic: assign players by position, sorted by OVR
    const positions: Array<"PG" | "SG" | "SF" | "PF" | "C"> = ["PG", "SG", "SF", "PF", "C"];
    const depthChartByPosition: { [key: string]: string[] } = {};

    positions.forEach((position) => {
      // Find all players with this as primary position, sorted by overall
      const primaryPlayers = userRoster
        .filter((p) => p.position === position)
        .sort((a, b) => b.overall - a.overall);

      // Assign up to 3 primary players per position
      depthChartByPosition[position] = primaryPlayers.slice(0, 3).map((p) => p.id);
    });

    updateRotationsFromDepthChart(userTeamId, depthChartByPosition);
  };

  const handleDepthChartChange = (depthChart: DepthChartSlot[]) => {
    // Convert depth chart to position-based structure
    const positions: Array<"PG" | "SG" | "SF" | "PF" | "C"> = ["PG", "SG", "SF", "PF", "C"];
    const depthChartByPosition: { [key: string]: string[] } = {};

    positions.forEach((position) => {
      const positionSlots = depthChart.filter((slot) => slot.position === position);
      depthChartByPosition[position] = positionSlots
        .filter((slot) => slot.player !== null)
        .map((slot) => slot.player!.id);
    });

    updateRotationsFromDepthChart(userTeamId, depthChartByPosition);
  };

  const renderPlayer = (rotation: any) => {
    const player = rotation.player;
    if (!player) return null;

    const playerActions = recentActions.filter((a) => a.playerId === player.id);
    const lastAction = playerActions[0];

    // Use displayPosition for starters (from depth chart column), otherwise use player's actual position
    const positionToShow = rotation.displayPosition || player.position;

    return (
      <Pressable
        key={player.id}
        className="bg-gray-800 rounded-lg px-4 py-3 mb-2 active:bg-gray-700"
        onPress={() => handleOpenActionModal(player.id)}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-white font-semibold text-base">{player.name}</Text>
            <Text className="text-gray-400 text-xs mt-1">
              {positionToShow} • OVR {player.overall}
            </Text>
            {lastAction && (
              <View className="flex-row items-center mt-1">
                <Text className="text-gray-500 text-xs">Last action: </Text>
                <Text className={`text-xs font-semibold ${getStatusColor(lastAction.status)}`}>
                  {lastAction.status.toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View className="items-end">
            <Text className="text-blue-400 font-bold text-xl">{rotation.minutesPerGame}</Text>
            <Text className="text-gray-500 text-xs">MPG</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  if (!userTeam || !teamRotation || !relationship) {
    return (
      <View className="flex-1 bg-gray-950 items-center justify-center">
        <Text className="text-white text-lg">Loading rotations...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-950" style={{ paddingTop: insets.top }}>
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-6 py-6 bg-gradient-to-b from-gray-900 to-gray-950">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-1">
              <Text className="text-gray-400 text-xs uppercase tracking-wider mb-1">Rotations</Text>
              <Text className="text-white text-2xl font-bold">{userTeam.city} {userTeam.name}</Text>
              {userCoach && (
                <Pressable
                  onPress={() => setCoachModalVisible(true)}
                  className="flex-row items-center gap-1 mt-1"
                >
                  <Text className="text-gray-400 text-sm">Coach:</Text>
                  <Text className="text-blue-400 text-sm underline">{userCoach.name}</Text>
                  <Ionicons name="information-circle" size={14} color="#60A5FA" />
                </Pressable>
              )}
            </View>
          </View>

          {/* GM-Coach Relationship */}
          <View className="bg-gray-800 rounded-xl p-4">
            <Text className="text-white font-bold text-base mb-3">GM-Coach Relationship</Text>
            <View className="flex-row flex-wrap gap-4">
              <View className="flex-1 min-w-[45%]">
                <Text className="text-gray-400 text-xs mb-1">Status</Text>
                <Text className={`font-bold text-lg ${getRelationshipColor(relationship.relationshipStatus)}`}>
                  {relationship.relationshipStatus.toUpperCase()}
                </Text>
              </View>
              <View className="flex-1 min-w-[45%]">
                <Text className="text-gray-400 text-xs mb-1">Trust</Text>
                <View className="flex-row items-center gap-2">
                  <View className="flex-1 bg-gray-700 h-2 rounded-full overflow-hidden">
                    <View className="h-full bg-blue-500" style={{ width: `${relationship.trust}%` }} />
                  </View>
                  <Text className="text-white text-sm font-semibold">{relationship.trust}</Text>
                </View>
              </View>
              <View className="flex-1 min-w-[45%]">
                <Text className="text-gray-400 text-xs mb-1">Authority</Text>
                <View className="flex-row items-center gap-2">
                  <View className="flex-1 bg-gray-700 h-2 rounded-full overflow-hidden">
                    <View className="h-full bg-green-500" style={{ width: `${relationship.authority}%` }} />
                  </View>
                  <Text className="text-white text-sm font-semibold">{relationship.authority}</Text>
                </View>
              </View>
              <View className="flex-1 min-w-[45%]">
                <Text className="text-gray-400 text-xs mb-1">Tension</Text>
                <View className="flex-row items-center gap-2">
                  <View className="flex-1 bg-gray-700 h-2 rounded-full overflow-hidden">
                    <View className="h-full bg-red-500" style={{ width: `${relationship.tension}%` }} />
                  </View>
                  <Text className="text-white text-sm font-semibold">{relationship.tension}</Text>
                </View>
              </View>
            </View>
            <View className="mt-3 pt-3 border-t border-gray-700">
              <Text className="text-gray-400 text-xs">
                Coach accepts {relationship.acceptanceRate.toFixed(0)}% of your suggestions
              </Text>
            </View>
          </View>
        </View>

        {/* Info Box */}
        <View className="px-6 py-4">
          <View className="bg-blue-900/30 border border-blue-700 rounded-xl p-4">
            <View className="flex-row items-start gap-3">
              <Ionicons name="information-circle" size={24} color="#60A5FA" />
              <View className="flex-1">
                <Text className="text-blue-300 text-sm leading-5">
                  The coach sets rotations by default. You can suggest changes, but the coach may reject them based on their personality and your relationship. Manual overrides guarantee the change but damage morale.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Starters */}
        <View className="px-6 py-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-gray-400 text-xs font-semibold tracking-wider">STARTERS</Text>
            <Text className="text-gray-500 text-xs">{starters.length} players</Text>
          </View>
          {starters.map(renderPlayer)}
        </View>

        {/* Bench */}
        <View className="px-6 py-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-gray-400 text-xs font-semibold tracking-wider">BENCH</Text>
            <Text className="text-gray-500 text-xs">{bench.length} players</Text>
          </View>
          {bench.map(renderPlayer)}
        </View>

        {/* Depth Chart */}
        <DepthChart
          players={userRoster}
          currentRotations={teamRotation?.rotations || []}
          onAutoSetByOVR={handleAutoSetByOVR}
          onDepthChartChange={handleDepthChartChange}
        />

        {/* Reserves */}
        {reserves.length > 0 && (
          <View className="px-6 py-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-gray-400 text-xs font-semibold tracking-wider">RESERVES</Text>
              <Text className="text-gray-500 text-xs">{reserves.length} players</Text>
            </View>
            {reserves.map(renderPlayer)}
          </View>
        )}

        {/* Inactive */}
        {inactive.length > 0 && (
          <View className="px-6 py-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-gray-400 text-xs font-semibold tracking-wider">INACTIVE</Text>
              <Text className="text-gray-500 text-xs">{inactive.length} players</Text>
            </View>
            {inactive.map(renderPlayer)}
          </View>
        )}

        {/* Recent Actions */}
        {recentActions.length > 0 && (
          <View className="px-6 py-4 pb-24">
            <Text className="text-gray-400 text-xs font-semibold tracking-wider mb-3">
              RECENT ACTIONS
            </Text>
            {recentActions.map((action) => {
              const player = players.find((p) => p.id === action.playerId);
              return (
                <View key={action.id} className="bg-gray-800 rounded-lg p-4 mb-2">
                  <View className="flex-row items-start justify-between mb-2">
                    <Text className="text-white font-semibold">{player?.name}</Text>
                    <Text className={`text-xs font-bold ${getStatusColor(action.status)}`}>
                      {action.status.toUpperCase()}
                    </Text>
                  </View>
                  <Text className="text-gray-400 text-sm mb-1">{action.reason}</Text>
                  {action.coachResponse && (
                    <Text className="text-gray-500 text-xs italic">
                      Coach: {action.coachResponse}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Coach Details Modal */}
      <CoachDetailsModal
        coach={userCoach || null}
        visible={coachModalVisible}
        onClose={() => setCoachModalVisible(false)}
      />

      {/* GM Action Modal */}
      <Modal
        visible={gmActionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGMActionModalVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/70 justify-center items-center px-4"
          onPress={() => setGMActionModalVisible(false)}
        >
          <Pressable
            className="bg-gray-900 rounded-2xl w-full max-w-md border border-gray-700 p-6"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-white text-xl font-bold">GM Action</Text>
              <Pressable onPress={() => setGMActionModalVisible(false)}>
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </Pressable>
            </View>

            {/* Action Type */}
            <Text className="text-gray-400 text-sm mb-2">Action Type</Text>
            <View className="mb-4">
              {[
                { value: "suggest_minutes", label: "Suggest Minutes" },
                { value: "suggest_starter", label: "Suggest Starter" },
                { value: "suggest_benching", label: "Suggest Benching" },
                { value: "manual_override", label: "Manual Override (- Morale)" },
              ].map((option) => (
                <Pressable
                  key={option.value}
                  className={`p-3 rounded-lg mb-2 border ${
                    actionType === option.value
                      ? "bg-blue-600 border-blue-500"
                      : "bg-gray-800 border-gray-700"
                  }`}
                  onPress={() => setActionType(option.value as any)}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      actionType === option.value ? "text-white" : "text-gray-400"
                    }`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Minutes Input */}
            {actionType === "suggest_minutes" && (
              <View className="mb-4">
                <Text className="text-gray-400 text-sm mb-2">Requested Minutes Per Game</Text>
                <TextInput
                  className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
                  placeholder="e.g., 28"
                  placeholderTextColor="#6B7280"
                  keyboardType="numeric"
                  value={requestedMinutes}
                  onChangeText={setRequestedMinutes}
                />
              </View>
            )}

            {/* Reason */}
            <View className="mb-4">
              <Text className="text-gray-400 text-sm mb-2">Reason (Optional)</Text>
              <TextInput
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
                placeholder="Explain your reasoning..."
                placeholderTextColor="#6B7280"
                multiline
                numberOfLines={3}
                value={actionReason}
                onChangeText={setActionReason}
              />
            </View>

            {/* Submit Button */}
            <Pressable
              className="bg-blue-600 rounded-xl p-4 items-center active:bg-blue-700"
              onPress={handleSubmitAction}
            >
              <Text className="text-white font-bold text-base">Submit Action</Text>
            </Pressable>

            {/* Warning for Manual Override */}
            {actionType === "manual_override" && (
              <View className="mt-4 bg-red-900/30 border border-red-700 rounded-lg p-3">
                <Text className="text-red-400 text-xs">
                  Manual overrides guarantee changes but damage trust and increase tension with the coach.
                </Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
