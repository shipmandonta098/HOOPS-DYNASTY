import React from "react";
import { View, Text, Modal, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Player } from "../types/basketball";

interface PlayerDetailsModalProps {
  player: Player | null;
  visible: boolean;
  onClose: () => void;
}

export default function PlayerDetailsModal({
  player,
  visible,
  onClose,
}: PlayerDetailsModalProps) {
  if (!player) return null;

  // Fallback for players without personality data (backwards compatibility)
  const hasPersonality = player.personality && typeof player.personality === "object";
  const satisfaction = player.satisfaction ?? 75;

  const getOverallColor = (overall: number) => {
    if (overall >= 90) return "text-purple-400";
    if (overall >= 85) return "text-blue-400";
    if (overall >= 80) return "text-green-400";
    if (overall >= 75) return "text-yellow-400";
    if (overall >= 70) return "text-orange-400";
    return "text-gray-400";
  };

  const getAttributeColor = (value: number) => {
    if (value >= 85) return "bg-green-500";
    if (value >= 75) return "bg-blue-500";
    if (value >= 65) return "bg-yellow-500";
    if (value >= 55) return "bg-orange-500";
    return "bg-red-500";
  };

  const renderAttribute = (label: string, value: number) => (
    <View className="mb-3">
      <View className="flex-row justify-between mb-1">
        <Text className="text-gray-300 text-sm">{label}</Text>
        <Text className="text-white font-semibold text-sm">{value}</Text>
      </View>
      <View className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <View
          className={`h-full ${getAttributeColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </View>
    </View>
  );

  const getPersonalityColor = (value: number) => {
    if (value >= 75) return "bg-green-500";
    if (value >= 60) return "bg-blue-500";
    if (value >= 45) return "bg-yellow-500";
    if (value >= 30) return "bg-orange-500";
    return "bg-red-500";
  };

  const renderPersonalityTrait = (label: string, value: number, description: string) => (
    <View className="mb-3">
      <View className="flex-row justify-between mb-1">
        <Text className="text-gray-300 text-sm">{label}</Text>
        <Text className="text-white font-semibold text-sm">{value}</Text>
      </View>
      <View className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <View
          className={`h-full ${getPersonalityColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </View>
      <Text className="text-gray-500 text-xs mt-1">{description}</Text>
    </View>
  );

  const getSatisfactionColor = (satisfaction: number) => {
    if (satisfaction >= 80) return "text-green-400";
    if (satisfaction >= 60) return "text-blue-400";
    if (satisfaction >= 40) return "text-yellow-400";
    if (satisfaction >= 20) return "text-orange-400";
    return "text-red-400";
  };

  const getSatisfactionLabel = (satisfaction: number) => {
    if (satisfaction >= 80) return "Very Happy";
    if (satisfaction >= 60) return "Content";
    if (satisfaction >= 40) return "Neutral";
    if (satisfaction >= 20) return "Unhappy";
    return "Very Unhappy";
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/80 justify-end">
        <View className="bg-gray-900 rounded-t-3xl max-h-[85%]">
          {/* Header */}
          <View className="px-6 pt-6 pb-4 border-b border-gray-800">
            <View className="flex-row items-start justify-between mb-2">
              <View className="flex-1">
                <Text className="text-white text-2xl font-bold mb-1">
                  {player.name}
                </Text>
                <Text className="text-gray-400 text-base">
                  {player.position} • Age {player.age}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                className="bg-gray-800 rounded-full p-2 active:bg-gray-700"
              >
                <Ionicons name="close" size={24} color="white" />
              </Pressable>
            </View>
            <View className="flex-row items-center gap-4 mt-2">
              <View>
                <Text className="text-gray-400 text-xs mb-1">OVERALL</Text>
                <Text className={`text-3xl font-bold ${getOverallColor(player.overall)}`}>
                  {player.overall}
                </Text>
              </View>
              <View>
                <Text className="text-gray-400 text-xs mb-1">POTENTIAL</Text>
                <Text className="text-3xl font-bold text-gray-400">
                  {player.potential}
                </Text>
              </View>
            </View>
          </View>

          <ScrollView className="px-6 py-4">
            {/* Bio Info */}
            <View className="mb-6">
              <Text className="text-gray-400 text-xs font-semibold mb-3 tracking-wider">
                PLAYER BIO
              </Text>
              <View className="bg-gray-800 rounded-lg p-4">
                <View className="flex-row justify-between mb-3">
                  <View className="flex-1">
                    <Text className="text-gray-400 text-xs">Height</Text>
                    <Text className="text-white font-semibold text-base">
                      {player.bio.height}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-400 text-xs">Weight</Text>
                    <Text className="text-white font-semibold text-base">
                      {player.bio.weight} lbs
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-400 text-xs">Wingspan</Text>
                    <Text className="text-white font-semibold text-base">
                      {player.bio.wingspan}
                    </Text>
                  </View>
                </View>
                <View className="border-t border-gray-700 pt-3 mb-3">
                  <Text className="text-gray-400 text-xs mb-1">Hometown</Text>
                  <Text className="text-white font-semibold text-base">
                    {player.bio.hometown}
                  </Text>
                </View>
                <View className="mb-3">
                  <Text className="text-gray-400 text-xs mb-1">Country</Text>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-2xl">{player.bio.countryFlag}</Text>
                    <Text className="text-white font-semibold text-base">
                      {player.bio.country}
                    </Text>
                  </View>
                </View>
                <View className="mb-3">
                  <Text className="text-gray-400 text-xs mb-1">College</Text>
                  <Text className="text-white font-semibold text-base">
                    {player.bio.college}
                  </Text>
                </View>
                <View className="border-t border-gray-700 pt-3">
                  <Text className="text-gray-400 text-xs mb-1">Draft</Text>
                  <Text className="text-white font-semibold text-base">
                    {player.bio.draftYear} • Round {player.bio.draftRound} • Pick {player.bio.draftPick}
                  </Text>
                  <Text className="text-gray-400 text-sm mt-1">
                    Drafted by {player.bio.draftedBy}
                  </Text>
                </View>
              </View>
            </View>

            {/* Contract Info */}
            <View className="mb-6">
              <Text className="text-gray-400 text-xs font-semibold mb-3 tracking-wider">
                CONTRACT
              </Text>
              <View className="bg-gray-800 rounded-lg p-4">
                <View className="flex-row justify-between mb-3">
                  <View className="flex-1">
                    <Text className="text-gray-400 text-xs mb-1">Annual Salary</Text>
                    <Text className="text-white text-lg font-bold">
                      ${player.contract.salary.toFixed(1)}M / yr
                    </Text>
                  </View>
                  <View className="flex-1 items-end">
                    <Text className="text-gray-400 text-xs mb-1">Total Value</Text>
                    <Text className="text-white text-lg font-bold">
                      ${(player.contract.salary * player.contract.years).toFixed(1)}M
                    </Text>
                  </View>
                </View>
                <View className="border-t border-gray-700 pt-3">
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-gray-400 text-sm">Years Remaining</Text>
                    <Text className="text-white font-semibold">
                      {player.contract.years} yr{player.contract.years !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-gray-400 text-sm">Contract Period</Text>
                    <Text className="text-white font-semibold">
                      {new Date().getFullYear()} - {new Date().getFullYear() + player.contract.years}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Stats */}
            <View className="mb-6">
              <Text className="text-gray-400 text-xs font-semibold mb-3 tracking-wider">
                SEASON STATS
              </Text>
              <View className="bg-gray-800 rounded-lg p-4">
                <View className="flex-row justify-between mb-2">
                  <Text className="text-gray-400 text-sm">Points</Text>
                  <Text className="text-white font-semibold">{player.stats.points}</Text>
                </View>
                <View className="flex-row justify-between mb-2">
                  <Text className="text-gray-400 text-sm">Rebounds</Text>
                  <Text className="text-white font-semibold">{player.stats.rebounds}</Text>
                </View>
                <View className="flex-row justify-between mb-2">
                  <Text className="text-gray-400 text-sm">Assists</Text>
                  <Text className="text-white font-semibold">{player.stats.assists}</Text>
                </View>
                <View className="flex-row justify-between mb-2">
                  <Text className="text-gray-400 text-sm">Steals</Text>
                  <Text className="text-white font-semibold">{player.stats.steals}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-gray-400 text-sm">Blocks</Text>
                  <Text className="text-white font-semibold">{player.stats.blocks}</Text>
                </View>
              </View>
            </View>

            {/* Attributes */}
            <View className="mb-6">
              <Text className="text-gray-400 text-xs font-semibold mb-3 tracking-wider">
                ATHLETIC ATTRIBUTES
              </Text>
              {renderAttribute("Speed", player.attributes.speed)}
              {renderAttribute("Acceleration", player.attributes.acceleration)}
              {renderAttribute("Strength", player.attributes.strength)}
              {renderAttribute("Vertical", player.attributes.vertical)}
              {renderAttribute("Lateral Quickness", player.attributes.lateralQuickness)}
              {renderAttribute("Stamina", player.attributes.stamina)}
              {renderAttribute("Hustle", player.attributes.hustle)}
            </View>

            {/* Offensive Attributes */}
            <View className="mb-6">
              <Text className="text-gray-400 text-xs font-semibold mb-3 tracking-wider">
                OFFENSIVE ATTRIBUTES
              </Text>
              <Text className="text-gray-300 text-sm font-semibold mb-2 mt-2">
                Scoring Skills
              </Text>
              {renderAttribute("Finishing", player.attributes.finishing)}
              {renderAttribute("Mid-Range Shooting", player.attributes.midRangeShooting)}
              {renderAttribute("Three-Point Shooting", player.attributes.threePointShooting)}
              {renderAttribute("Free Throw Shooting", player.attributes.freeThrowShooting)}
              {renderAttribute("Post Scoring", player.attributes.postScoring)}
              {renderAttribute("Shot Creation", player.attributes.shotCreation)}

              <Text className="text-gray-300 text-sm font-semibold mb-2 mt-4">
                Playmaking Skills
              </Text>
              {renderAttribute("Ball Handling", player.attributes.ballHandling)}
              {renderAttribute("Passing Vision", player.attributes.passingVision)}
              {renderAttribute("Passing Accuracy", player.attributes.passingAccuracy)}
              {renderAttribute("Off-Ball Movement", player.attributes.offBallMovement)}
            </View>

            {/* Defensive Attributes */}
            <View className="mb-6">
              <Text className="text-gray-400 text-xs font-semibold mb-3 tracking-wider">
                DEFENSIVE ATTRIBUTES
              </Text>
              {renderAttribute("Perimeter Defense", player.attributes.perimeterDefense)}
              {renderAttribute("Interior Defense", player.attributes.interiorDefense)}
              {renderAttribute("Block Rating", player.attributes.blockRating)}
              {renderAttribute("Steal Rating", player.attributes.stealRating)}
              {renderAttribute("Defensive Rebounding", player.attributes.defensiveRebounding)}
              {renderAttribute("Offensive Rebounding", player.attributes.offensiveRebounding)}
              {renderAttribute("Defensive Awareness", player.attributes.defensiveAwareness)}
            </View>

            {/* Mental Attributes */}
            <View className="mb-6">
              <Text className="text-gray-400 text-xs font-semibold mb-3 tracking-wider">
                MENTAL ATTRIBUTES
              </Text>
              {renderAttribute("Basketball IQ", player.attributes.basketballIQ)}
              {renderAttribute("Consistency", player.attributes.consistency)}
              {renderAttribute("Work Ethic", player.attributes.workEthic)}
              {renderAttribute("Leadership", player.attributes.leadership)}
              {renderAttribute("Composure", player.attributes.composure)}
              {renderAttribute("Discipline", player.attributes.discipline)}
              {renderAttribute("Clutch", player.attributes.clutch)}
            </View>

            {/* Personality & Satisfaction */}
            {hasPersonality && (
              <View className="mb-6">
                <Text className="text-gray-400 text-xs font-semibold mb-3 tracking-wider">
                  PERSONALITY & SATISFACTION
                </Text>

                {/* Current Satisfaction */}
                <View className="bg-gray-800 rounded-lg p-4 mb-4">
                  <Text className="text-gray-400 text-xs mb-2">Current Satisfaction</Text>
                  <View className="flex-row items-center justify-between">
                    <Text className={`text-2xl font-bold ${getSatisfactionColor(satisfaction)}`}>
                      {satisfaction}%
                    </Text>
                    <Text className={`text-lg font-semibold ${getSatisfactionColor(satisfaction)}`}>
                      {getSatisfactionLabel(satisfaction)}
                    </Text>
                  </View>
                </View>

                {/* Personality Traits */}
                {renderPersonalityTrait(
                  "Loyalty",
                  player.personality.loyalty,
                  "Likelihood to stay with team long-term"
                )}
                {renderPersonalityTrait(
                  "Money Focus",
                  player.personality.greed,
                  "How important money is in decisions"
                )}
                {renderPersonalityTrait(
                  "Winning Drive",
                  player.personality.winning,
                  "Desire to win championships"
                )}
                {renderPersonalityTrait(
                  "Playing Time Desire",
                  player.personality.playTime,
                  "Importance of minutes and role"
                )}
                {renderPersonalityTrait(
                  "Team Player",
                  player.personality.teamPlayer,
                  "How well they work with teammates"
                )}
                {renderPersonalityTrait(
                  "Work Ethic",
                  player.personality.workEthic,
                  "Dedication to improvement"
                )}
                {renderPersonalityTrait(
                  "Ego",
                  player.personality.ego,
                  "Self-importance and pride"
                )}
                {renderPersonalityTrait(
                  "Temperament",
                  player.personality.temperament,
                  "Emotional stability (high = calm)"
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
