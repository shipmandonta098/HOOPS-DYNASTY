import React from "react";
import { View, Text, Pressable, ImageBackground } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useBasketballStore } from "../state/basketballStore";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const savedLeagues = useBasketballStore((s) => s.savedLeagues);

  const hasExistingLeague = savedLeagues.length > 0;

  const handleCreateNewLeague = () => {
    navigation.navigate("CreateLeague");
  };

  const handleContinue = () => {
    navigation.navigate("ContinueLeague");
  };

  return (
    <View className="flex-1 bg-gray-950">
      {/* Background gradient effect */}
      <View className="absolute top-0 left-0 right-0 h-96 bg-blue-900 opacity-20" />

      <View className="flex-1 justify-center items-center px-6">
        {/* Logo/Icon */}
        <View className="mb-8 items-center">
          <View className="bg-blue-600 rounded-full p-6 mb-4">
            <Ionicons name="basketball" size={80} color="white" />
          </View>
          <Text className="text-white text-5xl font-bold mb-2">GM Simulator</Text>
          <Text className="text-gray-400 text-lg">Build Your Dynasty</Text>
        </View>

        {/* Action Buttons */}
        <View className="w-full max-w-sm mt-12">
          <Pressable
            className="bg-blue-600 rounded-2xl p-5 mb-4 items-center active:bg-blue-700"
            onPress={handleCreateNewLeague}
          >
            <View className="flex-row items-center gap-3">
              <Ionicons name="add-circle-outline" size={28} color="white" />
              <Text className="text-white text-xl font-bold">Create New League</Text>
            </View>
            <Text className="text-blue-200 text-sm mt-2">Start fresh with 30 teams</Text>
          </Pressable>

          {hasExistingLeague && (
            <Pressable
              className="bg-gray-800 rounded-2xl p-5 items-center active:bg-gray-700 border-2 border-gray-700"
              onPress={handleContinue}
            >
              <View className="flex-row items-center gap-3">
                <Ionicons name="play-circle-outline" size={28} color="white" />
                <Text className="text-white text-xl font-bold">Continue</Text>
              </View>
              <Text className="text-gray-400 text-sm mt-2">Resume your league</Text>
            </Pressable>
          )}

          {!hasExistingLeague && (
            <View className="bg-gray-900 rounded-2xl p-5 items-center opacity-50">
              <View className="flex-row items-center gap-3">
                <Ionicons name="play-circle-outline" size={28} color="#6B7280" />
                <Text className="text-gray-500 text-xl font-bold">Continue</Text>
              </View>
              <Text className="text-gray-600 text-sm mt-2">No league found</Text>
            </View>
          )}
        </View>

        {/* Features */}
        <View className="w-full max-w-sm mt-16">
          <View className="flex-row items-center gap-3 mb-3">
            <Ionicons name="trophy" size={20} color="#60A5FA" />
            <Text className="text-gray-400">Manage 30 teams across the league</Text>
          </View>
          <View className="flex-row items-center gap-3 mb-3">
            <Ionicons name="people" size={20} color="#60A5FA" />
            <Text className="text-gray-400">Trade and sign 480+ unique players</Text>
          </View>
          <View className="flex-row items-center gap-3">
            <Ionicons name="stats-chart" size={20} color="#60A5FA" />
            <Text className="text-gray-400">Simulate seasons and build dynasties</Text>
          </View>
        </View>
      </View>

      {/* Version */}
      <View className="pb-8 items-center">
        <Text className="text-gray-600 text-sm">v1.0.0</Text>
      </View>
    </View>
  );
}
