import React, { useState } from "react";
import { View, Text, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform, Modal, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useBasketballStore } from "../state/basketballStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<RootStackParamList, "CreateLeague">;

type TabType = "teams" | "settings";

interface TeamData {
  city: string;
  name: string;
  conference: string;
  division: string;
  logo: string;
  secondaryLogo: string;
  primaryColor: string;
  secondaryColor: string;
  marketSize: string;
}

interface LeagueSettings {
  // League Structure
  numberOfTeams: number;
  gamesPerSeason: number;
  playoffTeams: number;
  conferencesEnabled: boolean;
  divisionsEnabled: boolean;

  // Gameplay Difficulty
  difficultyLevel: "easy" | "medium" | "hard" | "realistic";
  playerAISkill: number; // 1-10 scale
  tradeAIAggression: number; // 1-10 scale

  // Realism Settings
  injuriesEnabled: boolean;
  injuryFrequency: "low" | "medium" | "high";
  fatigueEnabled: boolean;
  playerMoraleEnabled: boolean;
  contractNegotiationsEnabled: boolean;

  // Financial Rules
  salaryCap: number; // in millions
  luxuryTax: boolean;
  luxuryTaxThreshold: number; // in millions
  minimumSalary: number; // in millions
  maxContractLength: number; // years

  // Draft Settings
  draftRounds: number;
  draftLotteryEnabled: boolean;
  rookieContracts: number; // years
  draftClassQuality: "poor" | "average" | "strong" | "legendary";

  // Simulation Settings
  progressionSpeed: "slow" | "normal" | "fast";
  playerDevelopment: "realistic" | "accelerated";
  retirementAge: number;
  tradeDeadlineWeek: number;

  // Player Generation
  playerSkillVariance: "low" | "medium" | "high";
  superstarFrequency: "rare" | "normal" | "common";
  internationalPlayerPercentage: number; // 0-100

  // Gender Options
  playerGender: "male" | "female" | "mixed";
  coachGender: "male" | "female" | "mixed";
  ownerGender: "male" | "female" | "mixed";
}

const INITIAL_TEAM_DATA: TeamData[] = [
  // Eastern Conference - Atlantic
  { city: "Boston", name: "Titans", conference: "East", division: "Atlantic", logo: "⚡", secondaryLogo: "🌩️", primaryColor: "#1E90FF", secondaryColor: "#FFD700", marketSize: "Large" },
  { city: "New York", name: "Empire", conference: "East", division: "Atlantic", logo: "🏛️", secondaryLogo: "🗽", primaryColor: "#0047AB", secondaryColor: "#FFA500", marketSize: "Large" },
  { city: "Philadelphia", name: "Knights", conference: "East", division: "Atlantic", logo: "⚔️", secondaryLogo: "🛡️", primaryColor: "#002366", secondaryColor: "#C0C0C0", marketSize: "Large" },
  { city: "Toronto", name: "Guardians", conference: "East", division: "Atlantic", logo: "🛡️", secondaryLogo: "🍁", primaryColor: "#CE1141", secondaryColor: "#000000", marketSize: "Large" },
  { city: "Brooklyn", name: "Royals", conference: "East", division: "Atlantic", logo: "👑", secondaryLogo: "🌉", primaryColor: "#000000", secondaryColor: "#FFFFFF", marketSize: "Large" },
  // Eastern Conference - Southeast
  { city: "Miami", name: "Inferno", conference: "East", division: "Southeast", logo: "🔥", secondaryLogo: "🌴", primaryColor: "#98002E", secondaryColor: "#F9A01B", marketSize: "Large" },
  { city: "Atlanta", name: "Raptors", conference: "East", division: "Southeast", logo: "🦖", secondaryLogo: "🦅", primaryColor: "#E03A3E", secondaryColor: "#C1D32F", marketSize: "Large" },
  { city: "Orlando", name: "Rebellion", conference: "East", division: "Southeast", logo: "⭐", secondaryLogo: "✨", primaryColor: "#0077C0", secondaryColor: "#C4CED4", marketSize: "Medium" },
  { city: "Charlotte", name: "Panthers", conference: "East", division: "Southeast", logo: "🐆", secondaryLogo: "🐝", primaryColor: "#1D1160", secondaryColor: "#00788C", marketSize: "Medium" },
  { city: "Memphis", name: "Warriors", conference: "East", division: "Southeast", logo: "⚔️", secondaryLogo: "🐻", primaryColor: "#5D76A9", secondaryColor: "#12173F", marketSize: "Small" },
  // Eastern Conference - Central
  { city: "Chicago", name: "Legends", conference: "East", division: "Central", logo: "📜", secondaryLogo: "🐂", primaryColor: "#CE1141", secondaryColor: "#000000", marketSize: "Large" },
  { city: "Milwaukee", name: "Hunters", conference: "East", division: "Central", logo: "🎯", secondaryLogo: "🦌", primaryColor: "#00471B", secondaryColor: "#EEE1C6", marketSize: "Medium" },
  { city: "Detroit", name: "Ironmen", conference: "East", division: "Central", logo: "🔧", secondaryLogo: "🏭", primaryColor: "#C8102E", secondaryColor: "#006BB6", marketSize: "Medium" },
  { city: "Cleveland", name: "Cobras", conference: "East", division: "Central", logo: "🐍", secondaryLogo: "👑", primaryColor: "#860038", secondaryColor: "#FDBB30", marketSize: "Medium" },
  { city: "Indianapolis", name: "Flames", conference: "East", division: "Central", logo: "🔥", secondaryLogo: "🏁", primaryColor: "#002D62", secondaryColor: "#FDBB30", marketSize: "Medium" },
  // Western Conference - Pacific
  { city: "Los Angeles", name: "Thunder", conference: "West", division: "Pacific", logo: "⚡", secondaryLogo: "🌟", primaryColor: "#552583", secondaryColor: "#FDB927", marketSize: "Large" },
  { city: "Golden State", name: "Storm", conference: "West", division: "Pacific", logo: "🌪️", secondaryLogo: "🌉", primaryColor: "#1D428A", secondaryColor: "#FFC72C", marketSize: "Large" },
  { city: "Phoenix", name: "Blaze", conference: "West", division: "Pacific", logo: "☀️", secondaryLogo: "🔥", primaryColor: "#E56020", secondaryColor: "#1D1160", marketSize: "Large" },
  { city: "Sacramento", name: "Dragons", conference: "West", division: "Pacific", logo: "🐉", secondaryLogo: "👑", primaryColor: "#5A2D81", secondaryColor: "#63727A", marketSize: "Medium" },
  { city: "Portland", name: "Surge", conference: "West", division: "Pacific", logo: "🌊", secondaryLogo: "🌲", primaryColor: "#E03A3E", secondaryColor: "#000000", marketSize: "Medium" },
  // Western Conference - Northwest
  { city: "Seattle", name: "Vipers", conference: "West", division: "Northwest", logo: "🐍", secondaryLogo: "☔", primaryColor: "#00653B", secondaryColor: "#FFD200", marketSize: "Large" },
  { city: "Denver", name: "Avalanche", conference: "West", division: "Northwest", logo: "⛰️", secondaryLogo: "⛏️", primaryColor: "#0E2240", secondaryColor: "#FEC524", marketSize: "Large" },
  { city: "Utah", name: "Pioneers", conference: "West", division: "Northwest", logo: "🏔️", secondaryLogo: "🎷", primaryColor: "#002B5C", secondaryColor: "#00471B", marketSize: "Medium" },
  { city: "Minnesota", name: "Wolves", conference: "West", division: "Northwest", logo: "🐺", secondaryLogo: "🌲", primaryColor: "#0C2340", secondaryColor: "#236192", marketSize: "Medium" },
  { city: "Oklahoma City", name: "Mustangs", conference: "West", division: "Northwest", logo: "🐎", secondaryLogo: "⚡", primaryColor: "#007AC1", secondaryColor: "#EF3B24", marketSize: "Medium" },
  // Western Conference - Southwest
  { city: "Dallas", name: "Outlaws", conference: "West", division: "Southwest", logo: "🤠", secondaryLogo: "⭐", primaryColor: "#00538C", secondaryColor: "#002B5E", marketSize: "Large" },
  { city: "Houston", name: "Cyclones", conference: "West", division: "Southwest", logo: "🌪️", secondaryLogo: "🚀", primaryColor: "#CE1141", secondaryColor: "#000000", marketSize: "Large" },
  { city: "San Antonio", name: "Sentinels", conference: "West", division: "Southwest", logo: "🗼", secondaryLogo: "🦅", primaryColor: "#C4CED4", secondaryColor: "#000000", marketSize: "Large" },
  { city: "New Orleans", name: "Voyagers", conference: "West", division: "Southwest", logo: "⛵", secondaryLogo: "🎺", primaryColor: "#0C2340", secondaryColor: "#C8102E", marketSize: "Medium" },
  { city: "Las Vegas", name: "Aces", conference: "West", division: "Southwest", logo: "🎰", secondaryLogo: "♠️", primaryColor: "#C8102E", secondaryColor: "#000000", marketSize: "Large" },
];

const DEFAULT_SETTINGS: LeagueSettings = {
  // League Structure
  numberOfTeams: 30,
  gamesPerSeason: 82,
  playoffTeams: 16,
  conferencesEnabled: true,
  divisionsEnabled: true,

  // Gameplay Difficulty
  difficultyLevel: "realistic",
  playerAISkill: 7,
  tradeAIAggression: 5,

  // Realism Settings
  injuriesEnabled: true,
  injuryFrequency: "medium",
  fatigueEnabled: true,
  playerMoraleEnabled: true,
  contractNegotiationsEnabled: true,

  // Financial Rules
  salaryCap: 120,
  luxuryTax: true,
  luxuryTaxThreshold: 145,
  minimumSalary: 1.1,
  maxContractLength: 5,

  // Draft Settings
  draftRounds: 2,
  draftLotteryEnabled: true,
  rookieContracts: 4,
  draftClassQuality: "average",

  // Simulation Settings
  progressionSpeed: "normal",
  playerDevelopment: "realistic",
  retirementAge: 36,
  tradeDeadlineWeek: 35,

  // Player Generation
  playerSkillVariance: "medium",
  superstarFrequency: "normal",
  internationalPlayerPercentage: 23,

  // Gender Options
  playerGender: "male",
  coachGender: "male",
  ownerGender: "male",
};

export default function CreateLeagueScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const createLeague = useBasketballStore((s) => s.createLeague);

  // Main state
  const [activeTab, setActiveTab] = useState<TabType>("teams");
  const [leagueName, setLeagueName] = useState("");
  const [seasonYear, setSeasonYear] = useState("2025");
  const [selectedTeamIndex, setSelectedTeamIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTeamIndex, setEditingTeamIndex] = useState<number | null>(null);
  const [teamData, setTeamData] = useState<TeamData[]>(INITIAL_TEAM_DATA);

  // League settings state
  const [settings, setSettings] = useState<LeagueSettings>(DEFAULT_SETTINGS);

  // Edit form state
  const [editCity, setEditCity] = useState("");
  const [editName, setEditName] = useState("");
  const [editLogo, setEditLogo] = useState("");
  const [editSecondaryLogo, setEditSecondaryLogo] = useState("");
  const [editPrimaryColor, setEditPrimaryColor] = useState("");
  const [editSecondaryColor, setEditSecondaryColor] = useState("");

  const handleCreate = () => {
    // Validation
    if (!leagueName.trim()) {
      setError("Please enter a league name");
      return;
    }

    const year = parseInt(seasonYear);
    if (isNaN(year) || year < 2000 || year > 2100) {
      setError("Please enter a valid year (2000-2100)");
      return;
    }

    if (selectedTeamIndex === null) {
      setError("Please select a team to manage");
      return;
    }

    // Create the league with settings (map local settings to store settings)
    createLeague(
      leagueName.trim(),
      year,
      selectedTeamIndex,
      teamData,
      {
        gamesPerSeason: settings.gamesPerSeason,
        playerGender: settings.playerGender,
        coachGender: settings.coachGender,
        ownerGender: settings.ownerGender,
      }
    );

    // Navigate to dashboard
    navigation.replace("Dashboard");
  };

  const openEditModal = (index: number) => {
    const team = teamData[index];
    setEditingTeamIndex(index);
    setEditCity(team.city);
    setEditName(team.name);
    setEditLogo(team.logo);
    setEditSecondaryLogo(team.secondaryLogo);
    setEditPrimaryColor(team.primaryColor);
    setEditSecondaryColor(team.secondaryColor);
    setEditModalVisible(true);
  };

  const saveTeamEdit = () => {
    if (editingTeamIndex === null) return;

    const updatedTeams = [...teamData];
    updatedTeams[editingTeamIndex] = {
      ...updatedTeams[editingTeamIndex],
      city: editCity.trim() || updatedTeams[editingTeamIndex].city,
      name: editName.trim() || updatedTeams[editingTeamIndex].name,
      logo: editLogo || updatedTeams[editingTeamIndex].logo,
      secondaryLogo: editSecondaryLogo || updatedTeams[editingTeamIndex].secondaryLogo,
      primaryColor: editPrimaryColor || updatedTeams[editingTeamIndex].primaryColor,
      secondaryColor: editSecondaryColor || updatedTeams[editingTeamIndex].secondaryColor,
    };

    setTeamData(updatedTeams);
    setEditModalVisible(false);
    setEditingTeamIndex(null);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-gray-950"
      style={{ paddingTop: insets.top }}
    >
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View className="px-6 py-6 flex-row items-center justify-between border-b border-gray-800">
          <Pressable
            onPress={() => navigation.goBack()}
            className="flex-row items-center gap-2"
          >
            <Ionicons name="arrow-back" size={24} color="#60A5FA" />
            <Text className="text-blue-400 text-lg">Back</Text>
          </Pressable>
          <Text className="text-white text-2xl font-bold">New League</Text>
          <View style={{ width: 80 }} />
        </View>

        {/* Error Message */}
        {error ? (
          <View className="mx-6 mt-4 bg-red-900/30 border border-red-700 rounded-xl p-4">
            <Text className="text-red-400 text-center">{error}</Text>
          </View>
        ) : null}

        {/* League Name Input */}
        <View className="px-6 mt-6">
          <Text className="text-white text-lg font-semibold mb-3">League Name</Text>
          <TextInput
            value={leagueName}
            onChangeText={(text) => {
              setLeagueName(text);
              setError("");
            }}
            placeholder="Enter league name"
            placeholderTextColor="#6B7280"
            className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-4 text-white text-lg"
            maxLength={30}
          />
          <Text className="text-gray-500 text-sm mt-2">
            {leagueName.length}/30 characters
          </Text>
        </View>

        {/* Season Year Input */}
        <View className="px-6 mt-6">
          <Text className="text-white text-lg font-semibold mb-3">Season Year</Text>
          <TextInput
            value={seasonYear}
            onChangeText={(text) => {
              setSeasonYear(text);
              setError("");
            }}
            placeholder="2025"
            placeholderTextColor="#6B7280"
            keyboardType="number-pad"
            className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-4 text-white text-lg"
            maxLength={4}
          />
        </View>

        {/* Tab Navigation */}
        <View className="px-6 mt-8">
          <View className="flex-row bg-gray-900 rounded-xl p-1">
            <Pressable
              onPress={() => setActiveTab("teams")}
              className={`flex-1 py-3 rounded-lg items-center ${
                activeTab === "teams" ? "bg-blue-600" : "bg-transparent"
              }`}
            >
              <Text
                className={`font-semibold text-base ${
                  activeTab === "teams" ? "text-white" : "text-gray-400"
                }`}
              >
                Teams
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("settings")}
              className={`flex-1 py-3 rounded-lg items-center ${
                activeTab === "settings" ? "bg-blue-600" : "bg-transparent"
              }`}
            >
              <Text
                className={`font-semibold text-base ${
                  activeTab === "settings" ? "text-white" : "text-gray-400"
                }`}
              >
                Settings
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Teams Tab Content */}
        {activeTab === "teams" && (
          <View className="px-6 mt-6 mb-6">
            <Text className="text-white text-lg font-semibold mb-3">Select Your Team</Text>
            <Text className="text-gray-400 text-sm mb-4">
              Choose which team you want to manage. Tap Edit to customize.
            </Text>

            {teamData.map((team, index) => (
              <Pressable
                key={index}
                onPress={() => {
                  setSelectedTeamIndex(index);
                  setError("");
                }}
                className={`mb-3 p-4 rounded-xl border-2 ${
                  selectedTeamIndex === index
                    ? "bg-blue-900/30 border-blue-500"
                    : "bg-gray-800 border-gray-700"
                }`}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-3 flex-1">
                    {/* Primary and Secondary Logo */}
                    <View className="flex-row items-center">
                      <Text style={{ fontSize: 32 }}>{team.logo}</Text>
                      <Text style={{ fontSize: 20, marginLeft: -8 }}>{team.secondaryLogo}</Text>
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2 mb-1">
                        <Text className="text-white text-lg font-semibold">
                          {team.city} {team.name}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-2 flex-wrap">
                        <View className="flex-row items-center gap-1">
                          <View
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: team.primaryColor }}
                          />
                          <View
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: team.secondaryColor }}
                          />
                        </View>
                        <Text className="text-gray-500 text-xs">•</Text>
                        <Text className="text-gray-400 text-xs">{team.conference}</Text>
                        <Text className="text-gray-500 text-xs">•</Text>
                        <Text className="text-gray-400 text-xs">{team.division}</Text>
                        <Text className="text-gray-500 text-xs">•</Text>
                        <Text className="text-gray-400 text-xs">{team.marketSize}</Text>
                      </View>
                    </View>
                    {selectedTeamIndex === index && (
                      <Ionicons name="checkmark-circle" size={28} color="#3B82F6" />
                    )}
                  </View>
                </View>

                {/* Edit Button */}
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    openEditModal(index);
                  }}
                  className="mt-2 bg-gray-700 rounded-lg px-3 py-2 flex-row items-center justify-center gap-2 active:bg-gray-600"
                >
                  <Ionicons name="pencil" size={16} color="#9CA3AF" />
                  <Text className="text-gray-400 text-sm font-semibold">Edit Team Details</Text>
                </Pressable>
              </Pressable>
            ))}
          </View>
        )}

        {/* Settings Tab Content */}
        {activeTab === "settings" && (
          <View className="px-6 mt-6 mb-6">
            <Text className="text-white text-lg font-semibold mb-4">League Settings</Text>

            {/* League Structure */}
            <View className="mb-8">
              <Text className="text-blue-400 text-base font-semibold mb-4">League Structure</Text>

              <View className="bg-gray-800 rounded-xl p-4 mb-3">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-white text-base">Conferences</Text>
                  <Switch
                    value={settings.conferencesEnabled}
                    onValueChange={(value) =>
                      setSettings({ ...settings, conferencesEnabled: value })
                    }
                    trackColor={{ false: "#374151", true: "#3B82F6" }}
                    thumbColor={settings.conferencesEnabled ? "#60A5FA" : "#9CA3AF"}
                  />
                </View>
                <Text className="text-gray-400 text-sm">
                  Split teams into Eastern and Western conferences
                </Text>
              </View>

              <View className="bg-gray-800 rounded-xl p-4 mb-3">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-white text-base">Divisions</Text>
                  <Switch
                    value={settings.divisionsEnabled}
                    onValueChange={(value) =>
                      setSettings({ ...settings, divisionsEnabled: value })
                    }
                    trackColor={{ false: "#374151", true: "#3B82F6" }}
                    thumbColor={settings.divisionsEnabled ? "#60A5FA" : "#9CA3AF"}
                  />
                </View>
                <Text className="text-gray-400 text-sm">
                  Group teams into divisions within conferences
                </Text>
              </View>

              <View className="bg-gray-800 rounded-xl p-4 mb-3">
                <Text className="text-white text-base mb-2">Games Per Season</Text>
                <TextInput
                  value={settings.gamesPerSeason.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 0;
                    setSettings({ ...settings, gamesPerSeason: num });
                  }}
                  keyboardType="number-pad"
                  className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white text-base"
                  placeholder="82"
                  placeholderTextColor="#6B7280"
                />
                <Text className="text-gray-400 text-sm mt-2">
                  Number of regular season games (10-82)
                </Text>
              </View>

              <View className="bg-gray-800 rounded-xl p-4">
                <Text className="text-white text-base mb-2">Playoff Teams</Text>
                <TextInput
                  value={settings.playoffTeams.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 0;
                    setSettings({ ...settings, playoffTeams: num });
                  }}
                  keyboardType="number-pad"
                  className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white text-base"
                  placeholder="16"
                  placeholderTextColor="#6B7280"
                />
                <Text className="text-gray-400 text-sm mt-2">
                  How many teams make the playoffs (4-20)
                </Text>
              </View>
            </View>

            {/* Gameplay Difficulty */}
            <View className="mb-8">
              <Text className="text-blue-400 text-base font-semibold mb-4">Gameplay Difficulty</Text>

              <View className="bg-gray-800 rounded-xl p-4 mb-3">
                <Text className="text-white text-base mb-3">Difficulty Level</Text>
                <View className="flex-row flex-wrap gap-2">
                  {(["easy", "medium", "hard", "realistic"] as const).map((level) => (
                    <Pressable
                      key={level}
                      onPress={() => setSettings({ ...settings, difficultyLevel: level })}
                      className={`px-4 py-2 rounded-lg border ${
                        settings.difficultyLevel === level
                          ? "bg-blue-600 border-blue-500"
                          : "bg-gray-700 border-gray-600"
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold capitalize ${
                          settings.difficultyLevel === level ? "text-white" : "text-gray-400"
                        }`}
                      >
                        {level}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View className="bg-gray-800 rounded-xl p-4 mb-3">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-white text-base">AI Skill Level</Text>
                  <Text className="text-blue-400 text-base font-semibold">
                    {settings.playerAISkill}/10
                  </Text>
                </View>
                <View className="flex-row gap-1 mt-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                    <Pressable
                      key={level}
                      onPress={() => setSettings({ ...settings, playerAISkill: level })}
                      className={`flex-1 h-8 rounded ${
                        level <= settings.playerAISkill ? "bg-blue-600" : "bg-gray-700"
                      }`}
                    />
                  ))}
                </View>
                <Text className="text-gray-400 text-sm mt-2">
                  How skilled AI opponents are in games
                </Text>
              </View>

              <View className="bg-gray-800 rounded-xl p-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-white text-base">Trade AI Aggression</Text>
                  <Text className="text-blue-400 text-base font-semibold">
                    {settings.tradeAIAggression}/10
                  </Text>
                </View>
                <View className="flex-row gap-1 mt-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                    <Pressable
                      key={level}
                      onPress={() => setSettings({ ...settings, tradeAIAggression: level })}
                      className={`flex-1 h-8 rounded ${
                        level <= settings.tradeAIAggression ? "bg-blue-600" : "bg-gray-700"
                      }`}
                    />
                  ))}
                </View>
                <Text className="text-gray-400 text-sm mt-2">
                  How aggressively AI teams pursue trades
                </Text>
              </View>
            </View>

            {/* Realism Settings */}
            <View className="mb-8">
              <Text className="text-blue-400 text-base font-semibold mb-4">Realism Settings</Text>

              <View className="bg-gray-800 rounded-xl p-4 mb-3">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-white text-base">Injuries</Text>
                  <Switch
                    value={settings.injuriesEnabled}
                    onValueChange={(value) =>
                      setSettings({ ...settings, injuriesEnabled: value })
                    }
                    trackColor={{ false: "#374151", true: "#3B82F6" }}
                    thumbColor={settings.injuriesEnabled ? "#60A5FA" : "#9CA3AF"}
                  />
                </View>
                {settings.injuriesEnabled && (
                  <View className="flex-row gap-2 mt-2">
                    {(["low", "medium", "high"] as const).map((freq) => (
                      <Pressable
                        key={freq}
                        onPress={() => setSettings({ ...settings, injuryFrequency: freq })}
                        className={`flex-1 py-2 rounded-lg border ${
                          settings.injuryFrequency === freq
                            ? "bg-blue-600 border-blue-500"
                            : "bg-gray-700 border-gray-600"
                        }`}
                      >
                        <Text
                          className={`text-sm font-semibold capitalize text-center ${
                            settings.injuryFrequency === freq ? "text-white" : "text-gray-400"
                          }`}
                        >
                          {freq}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              <View className="bg-gray-800 rounded-xl p-4 mb-3">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-white text-base">Player Fatigue</Text>
                  <Switch
                    value={settings.fatigueEnabled}
                    onValueChange={(value) =>
                      setSettings({ ...settings, fatigueEnabled: value })
                    }
                    trackColor={{ false: "#374151", true: "#3B82F6" }}
                    thumbColor={settings.fatigueEnabled ? "#60A5FA" : "#9CA3AF"}
                  />
                </View>
                <Text className="text-gray-400 text-sm">
                  Players get tired from heavy playing time
                </Text>
              </View>

              <View className="bg-gray-800 rounded-xl p-4 mb-3">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-white text-base">Player Morale</Text>
                  <Switch
                    value={settings.playerMoraleEnabled}
                    onValueChange={(value) =>
                      setSettings({ ...settings, playerMoraleEnabled: value })
                    }
                    trackColor={{ false: "#374151", true: "#3B82F6" }}
                    thumbColor={settings.playerMoraleEnabled ? "#60A5FA" : "#9CA3AF"}
                  />
                </View>
                <Text className="text-gray-400 text-sm">
                  Morale affects player performance and trade demands
                </Text>
              </View>

              <View className="bg-gray-800 rounded-xl p-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-white text-base">Contract Negotiations</Text>
                  <Switch
                    value={settings.contractNegotiationsEnabled}
                    onValueChange={(value) =>
                      setSettings({ ...settings, contractNegotiationsEnabled: value })
                    }
                    trackColor={{ false: "#374151", true: "#3B82F6" }}
                    thumbColor={settings.contractNegotiationsEnabled ? "#60A5FA" : "#9CA3AF"}
                  />
                </View>
                <Text className="text-gray-400 text-sm">
                  Negotiate with players for contract extensions
                </Text>
              </View>
            </View>

            {/* Financial Rules */}
            <View className="mb-8">
              <Text className="text-blue-400 text-base font-semibold mb-4">Financial Rules</Text>

              <View className="bg-gray-800 rounded-xl p-4 mb-3">
                <Text className="text-white text-base mb-2">Salary Cap ($M)</Text>
                <TextInput
                  value={settings.salaryCap.toString()}
                  onChangeText={(text) => {
                    const num = parseFloat(text) || 0;
                    setSettings({ ...settings, salaryCap: num });
                  }}
                  keyboardType="numeric"
                  className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white text-base"
                  placeholder="120"
                  placeholderTextColor="#6B7280"
                />
              </View>

              <View className="bg-gray-800 rounded-xl p-4 mb-3">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-white text-base">Luxury Tax</Text>
                  <Switch
                    value={settings.luxuryTax}
                    onValueChange={(value) =>
                      setSettings({ ...settings, luxuryTax: value })
                    }
                    trackColor={{ false: "#374151", true: "#3B82F6" }}
                    thumbColor={settings.luxuryTax ? "#60A5FA" : "#9CA3AF"}
                  />
                </View>
                {settings.luxuryTax && (
                  <View className="mt-2">
                    <Text className="text-gray-400 text-sm mb-2">Luxury Tax Threshold ($M)</Text>
                    <TextInput
                      value={settings.luxuryTaxThreshold.toString()}
                      onChangeText={(text) => {
                        const num = parseFloat(text) || 0;
                        setSettings({ ...settings, luxuryTaxThreshold: num });
                      }}
                      keyboardType="numeric"
                      className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white text-base"
                      placeholder="145"
                      placeholderTextColor="#6B7280"
                    />
                  </View>
                )}
              </View>

              <View className="bg-gray-800 rounded-xl p-4 mb-3">
                <Text className="text-white text-base mb-2">Minimum Salary ($M)</Text>
                <TextInput
                  value={settings.minimumSalary.toString()}
                  onChangeText={(text) => {
                    const num = parseFloat(text) || 0;
                    setSettings({ ...settings, minimumSalary: num });
                  }}
                  keyboardType="numeric"
                  className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white text-base"
                  placeholder="1.1"
                  placeholderTextColor="#6B7280"
                />
              </View>

              <View className="bg-gray-800 rounded-xl p-4">
                <Text className="text-white text-base mb-2">Max Contract Length (Years)</Text>
                <TextInput
                  value={settings.maxContractLength.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 0;
                    setSettings({ ...settings, maxContractLength: num });
                  }}
                  keyboardType="number-pad"
                  className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white text-base"
                  placeholder="5"
                  placeholderTextColor="#6B7280"
                />
              </View>
            </View>

            {/* Draft Settings */}
            <View className="mb-8">
              <Text className="text-blue-400 text-base font-semibold mb-4">Draft Settings</Text>

              <View className="bg-gray-800 rounded-xl p-4 mb-3">
                <Text className="text-white text-base mb-2">Draft Rounds</Text>
                <TextInput
                  value={settings.draftRounds.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 0;
                    setSettings({ ...settings, draftRounds: num });
                  }}
                  keyboardType="number-pad"
                  className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white text-base"
                  placeholder="2"
                  placeholderTextColor="#6B7280"
                />
              </View>

              <View className="bg-gray-800 rounded-xl p-4 mb-3">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-white text-base">Draft Lottery</Text>
                  <Switch
                    value={settings.draftLotteryEnabled}
                    onValueChange={(value) =>
                      setSettings({ ...settings, draftLotteryEnabled: value })
                    }
                    trackColor={{ false: "#374151", true: "#3B82F6" }}
                    thumbColor={settings.draftLotteryEnabled ? "#60A5FA" : "#9CA3AF"}
                  />
                </View>
                <Text className="text-gray-400 text-sm">
                  Bottom teams enter lottery for top picks
                </Text>
              </View>

              <View className="bg-gray-800 rounded-xl p-4 mb-3">
                <Text className="text-white text-base mb-2">Rookie Contract Length (Years)</Text>
                <TextInput
                  value={settings.rookieContracts.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 0;
                    setSettings({ ...settings, rookieContracts: num });
                  }}
                  keyboardType="number-pad"
                  className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white text-base"
                  placeholder="4"
                  placeholderTextColor="#6B7280"
                />
              </View>

              <View className="bg-gray-800 rounded-xl p-4">
                <Text className="text-white text-base mb-3">Draft Class Quality</Text>
                <View className="flex-row flex-wrap gap-2">
                  {(["poor", "average", "strong", "legendary"] as const).map((quality) => (
                    <Pressable
                      key={quality}
                      onPress={() => setSettings({ ...settings, draftClassQuality: quality })}
                      className={`px-4 py-2 rounded-lg border ${
                        settings.draftClassQuality === quality
                          ? "bg-blue-600 border-blue-500"
                          : "bg-gray-700 border-gray-600"
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold capitalize ${
                          settings.draftClassQuality === quality ? "text-white" : "text-gray-400"
                        }`}
                      >
                        {quality}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {/* Simulation Settings */}
            <View className="mb-8">
              <Text className="text-blue-400 text-base font-semibold mb-4">Simulation Settings</Text>

              <View className="bg-gray-800 rounded-xl p-4 mb-3">
                <Text className="text-white text-base mb-3">Progression Speed</Text>
                <View className="flex-row gap-2">
                  {(["slow", "normal", "fast"] as const).map((speed) => (
                    <Pressable
                      key={speed}
                      onPress={() => setSettings({ ...settings, progressionSpeed: speed })}
                      className={`flex-1 py-2 rounded-lg border ${
                        settings.progressionSpeed === speed
                          ? "bg-blue-600 border-blue-500"
                          : "bg-gray-700 border-gray-600"
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold capitalize text-center ${
                          settings.progressionSpeed === speed ? "text-white" : "text-gray-400"
                        }`}
                      >
                        {speed}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View className="bg-gray-800 rounded-xl p-4 mb-3">
                <Text className="text-white text-base mb-3">Player Development</Text>
                <View className="flex-row gap-2">
                  {(["realistic", "accelerated"] as const).map((dev) => (
                    <Pressable
                      key={dev}
                      onPress={() => setSettings({ ...settings, playerDevelopment: dev })}
                      className={`flex-1 py-2 rounded-lg border ${
                        settings.playerDevelopment === dev
                          ? "bg-blue-600 border-blue-500"
                          : "bg-gray-700 border-gray-600"
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold capitalize text-center ${
                          settings.playerDevelopment === dev ? "text-white" : "text-gray-400"
                        }`}
                      >
                        {dev}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View className="bg-gray-800 rounded-xl p-4 mb-3">
                <Text className="text-white text-base mb-2">Retirement Age</Text>
                <TextInput
                  value={settings.retirementAge.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 0;
                    setSettings({ ...settings, retirementAge: num });
                  }}
                  keyboardType="number-pad"
                  className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white text-base"
                  placeholder="36"
                  placeholderTextColor="#6B7280"
                />
              </View>

              <View className="bg-gray-800 rounded-xl p-4">
                <Text className="text-white text-base mb-2">Trade Deadline Week</Text>
                <TextInput
                  value={settings.tradeDeadlineWeek.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 0;
                    setSettings({ ...settings, tradeDeadlineWeek: num });
                  }}
                  keyboardType="number-pad"
                  className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white text-base"
                  placeholder="35"
                  placeholderTextColor="#6B7280"
                />
              </View>
            </View>

            {/* Player Generation */}
            <View className="mb-8">
              <Text className="text-blue-400 text-base font-semibold mb-4">Player Generation</Text>

              <View className="bg-gray-800 rounded-xl p-4 mb-3">
                <Text className="text-white text-base mb-3">Skill Variance</Text>
                <View className="flex-row gap-2">
                  {(["low", "medium", "high"] as const).map((variance) => (
                    <Pressable
                      key={variance}
                      onPress={() => setSettings({ ...settings, playerSkillVariance: variance })}
                      className={`flex-1 py-2 rounded-lg border ${
                        settings.playerSkillVariance === variance
                          ? "bg-blue-600 border-blue-500"
                          : "bg-gray-700 border-gray-600"
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold capitalize text-center ${
                          settings.playerSkillVariance === variance ? "text-white" : "text-gray-400"
                        }`}
                      >
                        {variance}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text className="text-gray-400 text-sm mt-2">
                  How much variation in player attributes
                </Text>
              </View>

              <View className="bg-gray-800 rounded-xl p-4 mb-3">
                <Text className="text-white text-base mb-3">Superstar Frequency</Text>
                <View className="flex-row gap-2">
                  {(["rare", "normal", "common"] as const).map((freq) => (
                    <Pressable
                      key={freq}
                      onPress={() => setSettings({ ...settings, superstarFrequency: freq })}
                      className={`flex-1 py-2 rounded-lg border ${
                        settings.superstarFrequency === freq
                          ? "bg-blue-600 border-blue-500"
                          : "bg-gray-700 border-gray-600"
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold capitalize text-center ${
                          settings.superstarFrequency === freq ? "text-white" : "text-gray-400"
                        }`}
                      >
                        {freq}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text className="text-gray-400 text-sm mt-2">
                  How often elite players (85+ OVR) appear
                </Text>
              </View>

              <View className="bg-gray-800 rounded-xl p-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-white text-base">International Players</Text>
                  <Text className="text-blue-400 text-base font-semibold">
                    {settings.internationalPlayerPercentage}%
                  </Text>
                </View>
                <View className="flex-row gap-1 mt-2">
                  {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((percent) => (
                    <Pressable
                      key={percent}
                      onPress={() =>
                        setSettings({ ...settings, internationalPlayerPercentage: percent })
                      }
                      className={`flex-1 h-8 rounded ${
                        settings.internationalPlayerPercentage >= percent ? "bg-blue-600" : "bg-gray-700"
                      }`}
                    />
                  ))}
                </View>
                <Text className="text-gray-400 text-sm mt-2">
                  Percentage of players from outside USA
                </Text>
              </View>
            </View>

            {/* Gender Options */}
            <View className="mb-8">
              <Text className="text-blue-400 text-base font-semibold mb-4">Gender Options</Text>

              <View className="bg-gray-800 rounded-xl p-4 mb-3">
                <Text className="text-white text-base mb-3">Player Gender</Text>
                <View className="flex-row gap-2">
                  {(["male", "female", "mixed"] as const).map((gender) => (
                    <Pressable
                      key={gender}
                      onPress={() => setSettings({ ...settings, playerGender: gender })}
                      className={`flex-1 py-2 rounded-lg border ${
                        settings.playerGender === gender
                          ? "bg-blue-600 border-blue-500"
                          : "bg-gray-700 border-gray-600"
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold capitalize text-center ${
                          settings.playerGender === gender ? "text-white" : "text-gray-400"
                        }`}
                      >
                        {gender}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text className="text-gray-400 text-sm mt-2">
                  {settings.playerGender === "mixed"
                    ? "League will have both male and female players"
                    : `All players will be ${settings.playerGender}`}
                </Text>
              </View>

              <View className="bg-gray-800 rounded-xl p-4 mb-3">
                <Text className="text-white text-base mb-3">Coach Gender</Text>
                <View className="flex-row gap-2">
                  {(["male", "female", "mixed"] as const).map((gender) => (
                    <Pressable
                      key={gender}
                      onPress={() => setSettings({ ...settings, coachGender: gender })}
                      className={`flex-1 py-2 rounded-lg border ${
                        settings.coachGender === gender
                          ? "bg-blue-600 border-blue-500"
                          : "bg-gray-700 border-gray-600"
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold capitalize text-center ${
                          settings.coachGender === gender ? "text-white" : "text-gray-400"
                        }`}
                      >
                        {gender}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text className="text-gray-400 text-sm mt-2">
                  {settings.coachGender === "mixed"
                    ? "League will have both male and female coaches"
                    : `All coaches will be ${settings.coachGender}`}
                </Text>
              </View>

              <View className="bg-gray-800 rounded-xl p-4">
                <Text className="text-white text-base mb-3">Owner Gender</Text>
                <View className="flex-row gap-2">
                  {(["male", "female", "mixed"] as const).map((gender) => (
                    <Pressable
                      key={gender}
                      onPress={() => setSettings({ ...settings, ownerGender: gender })}
                      className={`flex-1 py-2 rounded-lg border ${
                        settings.ownerGender === gender
                          ? "bg-blue-600 border-blue-500"
                          : "bg-gray-700 border-gray-600"
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold capitalize text-center ${
                          settings.ownerGender === gender ? "text-white" : "text-gray-400"
                        }`}
                      >
                        {gender}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text className="text-gray-400 text-sm mt-2">
                  {settings.ownerGender === "mixed"
                    ? "League will have both male and female team owners"
                    : `All team owners will be ${settings.ownerGender}`}
                </Text>
              </View>
            </View>

            {/* Reset to Defaults Button */}
            <Pressable
              onPress={() => setSettings(DEFAULT_SETTINGS)}
              className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex-row items-center justify-center gap-2"
            >
              <Ionicons name="refresh" size={20} color="#60A5FA" />
              <Text className="text-blue-400 text-base font-semibold">Reset to Defaults</Text>
            </Pressable>
          </View>
        )}

        {/* Spacer for button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Create Button - Fixed at bottom */}
      <View
        className="px-6 py-4 bg-gray-900 border-t border-gray-800"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <Pressable
          onPress={handleCreate}
          className={`rounded-2xl p-5 items-center ${
            leagueName.trim() && seasonYear && selectedTeamIndex !== null
              ? "bg-blue-600 active:bg-blue-700"
              : "bg-gray-700"
          }`}
          disabled={!leagueName.trim() || !seasonYear || selectedTeamIndex === null}
        >
          <Text className="text-white text-xl font-bold">Create League</Text>
        </Pressable>
      </View>

      {/* Edit Team Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 bg-black/80 justify-end"
        >
          <View className="bg-gray-900 rounded-t-3xl" style={{ paddingBottom: insets.bottom }}>
            <ScrollView className="max-h-[600px]">
              {/* Modal Header */}
              <View className="px-6 py-6 border-b border-gray-800 flex-row items-center justify-between">
                <Text className="text-white text-2xl font-bold">Edit Team</Text>
                <Pressable onPress={() => setEditModalVisible(false)}>
                  <Ionicons name="close" size={28} color="#9CA3AF" />
                </Pressable>
              </View>

              {/* Edit Fields */}
              <View className="px-6 py-4">
                {/* City Name */}
                <View className="mb-4">
                  <Text className="text-white text-base font-semibold mb-2">City Name</Text>
                  <TextInput
                    value={editCity}
                    onChangeText={setEditCity}
                    placeholder="Enter city name"
                    placeholderTextColor="#6B7280"
                    className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base"
                  />
                </View>

                {/* Team Name */}
                <View className="mb-4">
                  <Text className="text-white text-base font-semibold mb-2">Team Name</Text>
                  <TextInput
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Enter team name"
                    placeholderTextColor="#6B7280"
                    className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base"
                  />
                </View>

                {/* Primary Logo */}
                <View className="mb-4">
                  <Text className="text-white text-base font-semibold mb-2">Primary Logo (Emoji)</Text>
                  <View className="flex-row items-center gap-3">
                    <TextInput
                      value={editLogo}
                      onChangeText={setEditLogo}
                      placeholder="🏀"
                      placeholderTextColor="#6B7280"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base"
                      maxLength={2}
                    />
                    <Text style={{ fontSize: 40 }}>{editLogo || "🏀"}</Text>
                  </View>
                </View>

                {/* Secondary Logo */}
                <View className="mb-4">
                  <Text className="text-white text-base font-semibold mb-2">Secondary Logo (Emoji)</Text>
                  <View className="flex-row items-center gap-3">
                    <TextInput
                      value={editSecondaryLogo}
                      onChangeText={setEditSecondaryLogo}
                      placeholder="⭐"
                      placeholderTextColor="#6B7280"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base"
                      maxLength={2}
                    />
                    <Text style={{ fontSize: 32 }}>{editSecondaryLogo || "⭐"}</Text>
                  </View>
                </View>

                {/* Primary Color */}
                <View className="mb-4">
                  <Text className="text-white text-base font-semibold mb-2">Primary Color (Hex)</Text>
                  <View className="flex-row items-center gap-3">
                    <TextInput
                      value={editPrimaryColor}
                      onChangeText={setEditPrimaryColor}
                      placeholder="#1E90FF"
                      placeholderTextColor="#6B7280"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base"
                      autoCapitalize="none"
                    />
                    <View
                      className="w-12 h-12 rounded-xl border-2 border-gray-700"
                      style={{ backgroundColor: editPrimaryColor || "#1E90FF" }}
                    />
                  </View>
                </View>

                {/* Secondary Color */}
                <View className="mb-4">
                  <Text className="text-white text-base font-semibold mb-2">Secondary Color (Hex)</Text>
                  <View className="flex-row items-center gap-3">
                    <TextInput
                      value={editSecondaryColor}
                      onChangeText={setEditSecondaryColor}
                      placeholder="#FFD700"
                      placeholderTextColor="#6B7280"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base"
                      autoCapitalize="none"
                    />
                    <View
                      className="w-12 h-12 rounded-xl border-2 border-gray-700"
                      style={{ backgroundColor: editSecondaryColor || "#FFD700" }}
                    />
                  </View>
                </View>

                {/* Read-only fields */}
                <View className="bg-gray-800 rounded-xl p-4 mb-4">
                  <Text className="text-gray-400 text-sm mb-2">Conference: <Text className="text-white">{editingTeamIndex !== null ? teamData[editingTeamIndex].conference : ""}</Text></Text>
                  <Text className="text-gray-400 text-sm mb-2">Division: <Text className="text-white">{editingTeamIndex !== null ? teamData[editingTeamIndex].division : ""}</Text></Text>
                  <Text className="text-gray-400 text-sm">Market Size: <Text className="text-white">{editingTeamIndex !== null ? teamData[editingTeamIndex].marketSize : ""}</Text></Text>
                </View>
              </View>

              {/* Save Button */}
              <View className="px-6 pb-6">
                <Pressable
                  onPress={saveTeamEdit}
                  className="bg-blue-600 rounded-2xl p-5 items-center active:bg-blue-700"
                >
                  <Text className="text-white text-xl font-bold">Save Changes</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}
