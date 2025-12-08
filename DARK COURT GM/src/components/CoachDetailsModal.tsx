import React from "react";
import { View, Text, Modal, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Coach } from "../types/basketball";

interface CoachDetailsModalProps {
  coach: Coach | null;
  visible: boolean;
  onClose: () => void;
}

export default function CoachDetailsModal({
  coach,
  visible,
  onClose,
}: CoachDetailsModalProps) {
  if (!coach) return null;

  const getAttributeColor = (value: number) => {
    if (value >= 90) return "text-purple-400";
    if (value >= 85) return "text-blue-400";
    if (value >= 80) return "text-green-400";
    if (value >= 75) return "text-yellow-400";
    if (value >= 70) return "text-orange-400";
    return "text-gray-400";
  };

  const getOverallColor = (overall: number) => {
    if (overall >= 85) return "bg-purple-600";
    if (overall >= 80) return "bg-blue-600";
    if (overall >= 75) return "bg-green-600";
    if (overall >= 70) return "bg-yellow-600";
    return "bg-gray-600";
  };

  const renderAttribute = (label: string, value: number) => (
    <View className="flex-row justify-between items-center mb-2">
      <Text className="text-gray-400 text-sm">{label}</Text>
      <Text className={`font-bold text-lg ${getAttributeColor(value)}`}>{value}</Text>
    </View>
  );

  const renderPersonalityTrait = (label: string, value: number) => {
    const barWidth = Math.max(10, value);
    const barColor =
      value >= 75 ? "bg-green-500" : value >= 50 ? "bg-yellow-500" : "bg-red-500";

    return (
      <View className="mb-3">
        <View className="flex-row justify-between items-center mb-1">
          <Text className="text-gray-300 text-sm">{label}</Text>
          <Text className="text-white font-semibold">{value}</Text>
        </View>
        <View className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <View className={`h-full ${barColor}`} style={{ width: `${barWidth}%` }} />
        </View>
      </View>
    );
  };

  const winPercentage = coach.careerWins + coach.careerLosses > 0
    ? ((coach.careerWins / (coach.careerWins + coach.careerLosses)) * 100).toFixed(1)
    : "0.0";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/70">
        <View className="flex-1 bg-gray-900 mt-16 mx-4 rounded-t-2xl border border-gray-700 overflow-hidden">
          {/* Fixed Header */}
          <View className="px-6 pt-6 pb-4 border-b border-gray-800 bg-gray-900">
            <View className="flex-row justify-between items-start mb-4">
              <View className="flex-1">
                <Text className="text-white text-2xl font-bold">{coach.name}</Text>
                <Text className="text-gray-400 text-sm mt-1">Head Coach</Text>
              </View>
              <Pressable
                onPress={onClose}
                className="bg-gray-800 rounded-lg p-2 active:bg-gray-700"
              >
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </Pressable>
            </View>

            {/* Overall Rating - In Header */}
            <View className="flex-row items-center gap-3">
              <View
                className={`${getOverallColor(coach.overall)} rounded-full w-16 h-16 items-center justify-center`}
              >
                <Text className="text-white text-2xl font-bold">{coach.overall}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-gray-400 text-xs uppercase">Overall Rating</Text>
                <Text className="text-white text-lg font-semibold">
                  {coach.overall >= 85
                    ? "Elite Coach"
                    : coach.overall >= 80
                    ? "Great Coach"
                    : coach.overall >= 75
                    ? "Good Coach"
                    : coach.overall >= 70
                    ? "Average Coach"
                    : "Developing Coach"}
                </Text>
              </View>
            </View>
          </View>

          {/* Scrollable Content */}
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={true}
            persistentScrollbar={true}
            indicatorStyle="white"
            contentContainerStyle={{ padding: 24 }}
          >
            <View className="bg-gray-800 rounded-lg p-4 mb-4">
              <Text className="text-white font-bold text-lg mb-3">Bio</Text>
              <View className="space-y-2">
                <View className="flex-row justify-between">
                  <Text className="text-gray-400 text-sm">Age</Text>
                  <Text className="text-white font-semibold">{coach.age}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-gray-400 text-sm">Experience</Text>
                  <Text className="text-white font-semibold">{coach.experience} years</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-gray-400 text-sm">Hometown</Text>
                  <Text className="text-white font-semibold">
                    {coach.bio.countryFlag} {coach.bio.hometown}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-gray-400 text-sm">Coaching Style</Text>
                  <Text className="text-white font-semibold">{coach.bio.coachingStyle}</Text>
                </View>
                {coach.bio.formerPlayer && coach.bio.playingCareer && (
                  <View className="mt-2 pt-2 border-t border-gray-700">
                    <Text className="text-gray-400 text-xs mb-1">Playing Career</Text>
                    <Text className="text-blue-400 text-sm">{coach.bio.playingCareer}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Career Stats */}
            <View className="bg-gray-800 rounded-lg p-4 mb-4">
              <Text className="text-white font-bold text-lg mb-3">Career Stats</Text>
              <View className="flex-row justify-around">
                <View className="items-center">
                  <Text className="text-gray-400 text-xs mb-1">Record</Text>
                  <Text className="text-white font-bold text-lg">
                    {coach.careerWins}-{coach.careerLosses}
                  </Text>
                </View>
                <View className="items-center">
                  <Text className="text-gray-400 text-xs mb-1">Win %</Text>
                  <Text className="text-green-400 font-bold text-lg">{winPercentage}%</Text>
                </View>
                <View className="items-center">
                  <Text className="text-gray-400 text-xs mb-1">Championships</Text>
                  <Text className="text-yellow-400 font-bold text-lg">
                    {coach.championships}
                  </Text>
                </View>
              </View>
            </View>

            {/* Attributes */}
            <View className="bg-gray-800 rounded-lg p-4 mb-4">
              <Text className="text-white font-bold text-lg mb-3">Coaching Attributes</Text>
              {renderAttribute("Offense", coach.attributes.offense)}
              {renderAttribute("Defense", coach.attributes.defense)}
              {renderAttribute("Player Development", coach.attributes.playerDevelopment)}
              {renderAttribute("Management", coach.attributes.management)}
              {renderAttribute("Motivation", coach.attributes.motivation)}
              {renderAttribute("Clutch", coach.attributes.clutch)}
              {renderAttribute("Adaptability", coach.attributes.adaptability)}
            </View>

            {/* Personality */}
            <View className="bg-gray-800 rounded-lg p-4 mb-4">
              <Text className="text-white font-bold text-lg mb-3">Personality</Text>
              {renderPersonalityTrait("Patience", coach.personality.patience)}
              {renderPersonalityTrait("Intensity", coach.personality.intensity)}
              {renderPersonalityTrait("Loyalty", coach.personality.loyalty)}
              {renderPersonalityTrait("Innovation", coach.personality.innovation)}
              {renderPersonalityTrait("Communication", coach.personality.communication)}
              {renderPersonalityTrait("Discipline", coach.personality.discipline)}
              {renderPersonalityTrait("Confidence", coach.personality.confidence)}
            </View>

            {/* Contract */}
            <View className="bg-gray-800 rounded-lg p-4">
              <Text className="text-white font-bold text-lg mb-3">Contract</Text>
              <View className="flex-row justify-between">
                <Text className="text-gray-400 text-sm">Years Remaining</Text>
                <Text className="text-white font-semibold">{coach.contract.years}</Text>
              </View>
              <View className="flex-row justify-between mt-2">
                <Text className="text-gray-400 text-sm">Annual Salary</Text>
                <Text className="text-green-400 font-semibold">
                  ${coach.contract.salary}M
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
