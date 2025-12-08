import React from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Player } from "../types/basketball";

interface PlayerActionMenuProps {
  visible: boolean;
  player: Player | null;
  onClose: () => void;
  onWaive: () => void;
  onExtend: () => void;
  onTrade: () => void;
}

export default function PlayerActionMenu({
  visible,
  player,
  onClose,
  onWaive,
  onExtend,
  onTrade,
}: PlayerActionMenuProps) {
  if (!player) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/60 justify-end"
        onPress={onClose}
      >
        <Pressable
          className="bg-gray-900 rounded-t-3xl border-t-2 border-gray-800"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle Bar */}
          <View className="items-center py-3">
            <View className="w-12 h-1 bg-gray-700 rounded-full" />
          </View>

          {/* Player Header */}
          <View className="px-6 pb-4 border-b border-gray-800">
            <Text className="text-white text-xl font-bold">{player.name}</Text>
            <Text className="text-gray-400 text-sm mt-1">
              {player.position} • {player.overall} OVR
            </Text>
          </View>

          {/* Action Items */}
          <View className="px-4 py-2">
            {/* Trade */}
            <Pressable
              className="flex-row items-center px-4 py-4 active:bg-gray-800 rounded-lg"
              onPress={() => {
                onTrade();
                onClose();
              }}
            >
              <View className="w-10 h-10 bg-blue-600/20 rounded-full items-center justify-center mr-3">
                <Ionicons name="swap-horizontal" size={22} color="#60A5FA" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-semibold text-base">Trade Player</Text>
                <Text className="text-gray-400 text-xs mt-0.5">
                  Find a trade partner for this player
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </Pressable>

            {/* Extend */}
            <Pressable
              className="flex-row items-center px-4 py-4 active:bg-gray-800 rounded-lg"
              onPress={() => {
                onExtend();
                onClose();
              }}
            >
              <View className="w-10 h-10 bg-green-600/20 rounded-full items-center justify-center mr-3">
                <Ionicons name="document-text" size={22} color="#4ADE80" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-semibold text-base">Extend Contract</Text>
                <Text className="text-gray-400 text-xs mt-0.5">
                  Negotiate a contract extension
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </Pressable>

            {/* Waive */}
            <Pressable
              className="flex-row items-center px-4 py-4 active:bg-gray-800 rounded-lg"
              onPress={() => {
                onWaive();
                onClose();
              }}
            >
              <View className="w-10 h-10 bg-red-600/20 rounded-full items-center justify-center mr-3">
                <Ionicons name="close-circle" size={22} color="#F87171" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-semibold text-base">Waive Player</Text>
                <Text className="text-gray-400 text-xs mt-0.5">
                  Release player from roster
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </Pressable>
          </View>

          {/* Cancel Button */}
          <View className="px-4 pb-8 pt-2">
            <Pressable
              className="bg-gray-800 rounded-xl py-4 active:bg-gray-700"
              onPress={onClose}
            >
              <Text className="text-white text-center font-semibold text-base">
                Cancel
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
