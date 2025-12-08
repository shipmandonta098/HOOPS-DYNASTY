import React, { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useBasketballStore } from "../state/basketballStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AwardRaceType } from "../types/basketball";
import { Ionicons } from "@expo/vector-icons";

const awardTabs = [
  { type: "MVP" as AwardRaceType, label: "MVP" },
  { type: "DPOY" as AwardRaceType, label: "DPOY" },
  { type: "ROY" as AwardRaceType, label: "ROY" },
  { type: "SIXTH_MAN" as AwardRaceType, label: "Sixth Man" },
  { type: "MIP" as AwardRaceType, label: "MIP" },
  { type: "COTY" as AwardRaceType, label: "Coach of Year" },
];

export default function AwardRacesScreen() {
  const insets = useSafeAreaInsets();
  const [selectedAward, setSelectedAward] = useState<AwardRaceType>("MVP");

  const awardRaces = useBasketballStore((s) => s.awardRaces);
  const teams = useBasketballStore((s) => s.teams);
  const players = useBasketballStore((s) => s.players);
  const coaches = useBasketballStore((s) => s.coaches);

  const currentRace = awardRaces?.[selectedAward.toLowerCase() as keyof typeof awardRaces];

  const getMomentumIcon = (momentum: "Up" | "Down" | "Steady") => {
    if (momentum === "Up") {
      return <Ionicons name="chevron-up" size={16} color="#10B981" />;
    } else if (momentum === "Down") {
      return <Ionicons name="chevron-down" size={16} color="#EF4444" />;
    }
    return <Ionicons name="remove" size={16} color="#6B7280" />;
  };

  const getMomentumColor = (momentum: "Up" | "Down" | "Steady") => {
    if (momentum === "Up") return "text-green-400";
    if (momentum === "Down") return "text-red-400";
    return "text-gray-400";
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return "bg-yellow-500";
    if (rank === 2) return "bg-gray-400";
    if (rank === 3) return "bg-orange-600";
    return "bg-gray-700";
  };

  return (
    <View className="flex-1 bg-gray-950">
      {/* Header */}
      <View className="px-4 pt-4 pb-3" style={{ paddingTop: insets.top + 16 }}>
        <Text className="text-white text-2xl font-bold">Award Races</Text>
        <Text className="text-gray-400 text-sm mt-1">
          Top candidates for season awards
        </Text>
      </View>

      {/* Award Type Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-4 mb-4"
        contentContainerStyle={{ gap: 8 }}
      >
        {awardTabs.map((tab) => (
          <Pressable
            key={tab.type}
            onPress={() => setSelectedAward(tab.type)}
            className={`px-4 py-2 rounded-lg ${
              selectedAward === tab.type
                ? "bg-blue-600"
                : "bg-gray-800"
            }`}
          >
            <Text
              className={`font-medium ${
                selectedAward === tab.type
                  ? "text-white"
                  : "text-gray-400"
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Candidates List */}
      <ScrollView className="flex-1 px-4">
        {!currentRace && (
          <View className="bg-gray-900 rounded-lg p-6 items-center">
            <Text className="text-gray-400 text-center">
              Award races will be calculated after the first simulated week
            </Text>
          </View>
        )}

        {currentRace?.candidates.map((candidate, index) => {
          const team = teams.find((t) => t.id === candidate.teamId);
          const isCoach = selectedAward === "COTY";
          const person = isCoach
            ? coaches.find((c) => c.id === candidate.coachId)
            : players.find((p) => p.id === candidate.playerId);

          return (
            <View
              key={candidate.playerId || candidate.coachId}
              className="bg-gray-900 rounded-lg p-4 mb-3"
            >
              {/* Header with Rank and Momentum */}
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-3">
                  {/* Rank Badge */}
                  <View
                    className={`${getRankBadgeColor(candidate.rank)} w-8 h-8 rounded-full items-center justify-center`}
                  >
                    <Text className="text-white font-bold text-sm">
                      {candidate.rank}
                    </Text>
                  </View>

                  {/* Name and Team */}
                  <View>
                    <Text className="text-white font-semibold text-base">
                      {candidate.playerName || candidate.coachName}
                    </Text>
                    <Text className="text-gray-400 text-sm">
                      {team?.city} {team?.name}
                    </Text>
                  </View>
                </View>

                {/* Momentum Indicator */}
                <View className="flex-row items-center gap-1">
                  {getMomentumIcon(candidate.momentum)}
                  <Text className={`text-sm font-medium ${getMomentumColor(candidate.momentum)}`}>
                    {candidate.momentum}
                  </Text>
                </View>
              </View>

              {/* Stats */}
              <View className="bg-gray-800 rounded-lg p-3 mb-2">
                <Text className="text-gray-300 text-sm">
                  {candidate.statLine}
                </Text>
                <Text className="text-gray-500 text-xs mt-1">
                  Team Record: {candidate.teamRecord}
                </Text>
              </View>

              {/* Explanation */}
              <Text className="text-gray-400 text-sm italic">
                {candidate.explanation}
              </Text>
            </View>
          );
        })}

        {currentRace && currentRace.candidates.length === 0 && (
          <View className="bg-gray-900 rounded-lg p-6 items-center">
            <Text className="text-gray-400 text-center">
              No candidates available for this award yet
            </Text>
          </View>
        )}

        <View className="h-6" />
      </ScrollView>
    </View>
  );
}
