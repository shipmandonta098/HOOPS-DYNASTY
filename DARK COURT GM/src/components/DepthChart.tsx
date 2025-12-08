import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import type { Player, PlayerRotation } from "../types/basketball";

interface DepthChartSlot {
  position: "PG" | "SG" | "SF" | "PF" | "C";
  string: 1 | 2 | 3; // 1st, 2nd, or 3rd string
  player: Player | null;
}

interface DepthChartProps {
  players: Player[];
  currentRotations: PlayerRotation[];
  onAutoSetByOVR: () => void;
  onDepthChartChange: (depthChart: DepthChartSlot[]) => void;
}

export default function DepthChart({ players, currentRotations, onAutoSetByOVR, onDepthChartChange }: DepthChartProps) {
  const positions: Array<"PG" | "SG" | "SF" | "PF" | "C"> = ["PG", "SG", "SF", "PF", "C"];

  // Build depth chart from current rotations
  const buildDepthChartFromRotations = (): DepthChartSlot[] => {
    const chart: DepthChartSlot[] = [];

    // Initialize empty chart
    positions.forEach((pos) => {
      for (let string = 1; string <= 3; string++) {
        chart.push({
          position: pos,
          string: string as 1 | 2 | 3,
          player: null,
        });
      }
    });

    // Sort rotations by depth chart position
    const sortedRotations = [...currentRotations]
      .filter((r) => r.depthChartPosition > 0 && r.depthChartPosition <= 15)
      .sort((a, b) => a.depthChartPosition - b.depthChartPosition);

    // Fill in the chart based on depth chart positions
    sortedRotations.forEach((rotation, index) => {
      if (index < 15) {
        const player = players.find((p) => p.id === rotation.playerId);
        if (player) {
          const positionIndex = Math.floor(index / 3);
          const stringIndex = index % 3;

          if (positionIndex < 5) {
            chart[positionIndex * 3 + stringIndex].player = player;
          }
        }
      }
    });

    return chart;
  };

  const [depthChart, setDepthChart] = useState<DepthChartSlot[]>(buildDepthChartFromRotations());
  const [draggedPlayer, setDraggedPlayer] = useState<Player | null>(null);
  const [draggedFromSlot, setDraggedFromSlot] = useState<DepthChartSlot | null>(null);

  // Update depth chart when rotations change
  useEffect(() => {
    setDepthChart(buildDepthChartFromRotations());
  }, [currentRotations, players]);

  const handleSlotPress = (slot: DepthChartSlot) => {
    if (draggedPlayer) {
      // Drop the dragged player into this slot
      const newChart = depthChart.map((s) => {
        if (s.position === slot.position && s.string === slot.string) {
          return { ...s, player: draggedPlayer };
        }
        return s;
      });

      // Clear the original slot if dragging from depth chart (swap)
      if (draggedFromSlot) {
        const fromIndex = newChart.findIndex(
          (s) => s.position === draggedFromSlot.position && s.string === draggedFromSlot.string
        );
        if (fromIndex !== -1) {
          newChart[fromIndex] = { ...newChart[fromIndex], player: slot.player };
        }
      }

      setDepthChart(newChart);
      onDepthChartChange(newChart);
      setDraggedPlayer(null);
      setDraggedFromSlot(null);
    } else if (slot.player) {
      // Start dragging this player
      setDraggedPlayer(slot.player);
      setDraggedFromSlot(slot);
    }
  };

  const handleUnassignedPlayerPress = (player: Player) => {
    if (draggedPlayer) {
      // Cancel drag
      setDraggedPlayer(null);
      setDraggedFromSlot(null);
    } else {
      // Start dragging this unassigned player
      setDraggedPlayer(player);
      setDraggedFromSlot(null);
    }
  };

  const getUnassignedPlayers = (): Player[] => {
    const assignedIds = new Set(
      depthChart.filter((slot) => slot.player).map((slot) => slot.player!.id)
    );
    return players.filter((p) => !assignedIds.has(p.id));
  };

  const renderSlot = (slot: DepthChartSlot) => {
    const isDragged = draggedPlayer?.id === slot.player?.id && draggedFromSlot === slot;
    const isDropTarget = draggedPlayer && !isDragged;

    return (
      <Pressable
        key={`${slot.position}-${slot.string}`}
        className={`bg-gray-800 rounded-lg px-3 py-3 mb-2 border ${
          isDragged ? "border-blue-500 opacity-50" : isDropTarget ? "border-blue-400" : "border-gray-700"
        } active:bg-gray-700`}
        onPress={() => handleSlotPress(slot)}
      >
        {slot.player ? (
          <View>
            <Text className="text-white font-semibold text-sm" numberOfLines={1}>
              {slot.player.name}
            </Text>
            <Text className="text-blue-400 text-xs font-bold mt-0.5">OVR {slot.player.overall}</Text>
          </View>
        ) : (
          <View className="items-center opacity-50">
            <Text className="text-gray-500 text-xs">Empty</Text>
          </View>
        )}
      </Pressable>
    );
  };

  const renderPositionColumn = (position: "PG" | "SG" | "SF" | "PF" | "C") => {
    const slots = depthChart.filter((slot) => slot.position === position);

    return (
      <View key={position} className="flex-1 min-w-[70px]">
        <View className="bg-gray-700 rounded-t-lg px-2 py-2 items-center">
          <Text className="text-white font-bold text-sm">{position}</Text>
        </View>
        <View className="mt-2">
          {slots.map((slot) => renderSlot(slot))}
        </View>
      </View>
    );
  };

  const unassignedPlayers = getUnassignedPlayers();

  return (
    <View className="px-6 py-4">
      <View className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-white font-bold text-lg">Depth Chart</Text>
          <Pressable
            className="bg-blue-600 rounded-lg px-4 py-2 active:bg-blue-700"
            onPress={onAutoSetByOVR}
          >
            <Text className="text-white font-semibold text-sm">Auto set by OVR</Text>
          </Pressable>
        </View>

        {/* Instructions */}
        {draggedPlayer ? (
          <View className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 mb-4">
            <Text className="text-blue-300 text-xs">
              Tap a slot to place {draggedPlayer.name}. Tap another player to switch.
            </Text>
          </View>
        ) : (
          <View className="bg-gray-800 rounded-lg p-3 mb-4">
            <Text className="text-gray-400 text-xs">
              Tap a player to drag, then tap a slot to place them. Tap two filled slots to swap. The 1st string at each position = starters.
            </Text>
          </View>
        )}

        {/* Depth Chart Grid */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {positions.map((pos) => renderPositionColumn(pos))}
          </View>
        </ScrollView>

        {/* Unassigned Players */}
        {unassignedPlayers.length > 0 && (
          <View className="mt-4 pt-4 border-t border-gray-700">
            <Text className="text-gray-400 text-xs font-semibold tracking-wider mb-2">
              UNASSIGNED PLAYERS
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {unassignedPlayers.map((player) => {
                  const isDragged = draggedPlayer?.id === player.id;
                  return (
                    <Pressable
                      key={player.id}
                      className={`bg-gray-800 rounded-lg px-3 py-2 border ${
                        isDragged ? "border-blue-500 opacity-50" : "border-gray-700"
                      } active:bg-gray-700`}
                      onPress={() => handleUnassignedPlayerPress(player)}
                    >
                      <Text className="text-white font-semibold text-sm">{player.name}</Text>
                      <Text className="text-gray-400 text-xs">
                        {player.position} • OVR {player.overall}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Cancel Drag Button */}
        {draggedPlayer && (
          <Pressable
            className="mt-4 bg-red-600/20 border border-red-600 rounded-lg py-3 items-center active:bg-red-600/30"
            onPress={() => {
              setDraggedPlayer(null);
              setDraggedFromSlot(null);
            }}
          >
            <Text className="text-red-400 font-semibold text-sm">Cancel</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
