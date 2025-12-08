import React, { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import PlayerStatsTab from "../components/stats/PlayerStatsTab";
import TeamStatsTab from "../components/stats/TeamStatsTab";
import LeagueStatsTab from "../components/stats/LeagueStatsTab";

const Tab = createMaterialTopTabNavigator();

export default function StatsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-gray-950">
      {/* Header */}
      <View
        className="bg-gradient-to-r from-purple-900 to-indigo-900 px-4 pb-3"
        style={{ paddingTop: insets.top + 12 }}
      >
        <Text className="text-white text-3xl font-bold">📊 Stats</Text>
        <Text className="text-gray-300 text-sm mt-1">
          Player, team, and league statistics
        </Text>
      </View>

      {/* Tab Navigator */}
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: {
            backgroundColor: "#0c0a09",
            borderBottomWidth: 1,
            borderBottomColor: "#27272a",
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarActiveTintColor: "#a855f7",
          tabBarInactiveTintColor: "#71717a",
          tabBarIndicatorStyle: {
            backgroundColor: "#a855f7",
            height: 3,
          },
          tabBarLabelStyle: {
            fontSize: 13,
            fontWeight: "600",
            textTransform: "none",
          },
          tabBarPressColor: "#1f1f23",
        }}
      >
        <Tab.Screen
          name="Players"
          component={PlayerStatsTab}
          options={{ tabBarLabel: "Players" }}
        />
        <Tab.Screen
          name="Teams"
          component={TeamStatsTab}
          options={{ tabBarLabel: "Teams" }}
        />
        <Tab.Screen
          name="League"
          component={LeagueStatsTab}
          options={{ tabBarLabel: "League" }}
        />
      </Tab.Navigator>
    </View>
  );
}
