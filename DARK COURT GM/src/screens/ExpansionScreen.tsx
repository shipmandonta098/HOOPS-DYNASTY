import React, { useState } from "react";
import { View, Text, Pressable, TextInput, ScrollView, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useBasketballStore } from "../state/basketballStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Player } from "../types/basketball";

type Props = NativeStackScreenProps<RootStackParamList, "Expansion">;

type TabType = "city" | "identity" | "rules" | "draft" | "finalize";

interface CityOption {
  name: string;
  marketSize: "Small" | "Medium" | "Large";
  taxLevel: "Low" | "Medium" | "High";
  fanPassion: "Low" | "Medium" | "High" | "Very High";
  rivalryPotential: string[];
  description: string;
}

interface TeamIdentity {
  name: string;
  mascot: string;
  primaryColor: string;
  secondaryColor: string;
  logo: string;
  secondaryLogo: string;
  arenaName: string;
}

interface ProtectedTeam {
  teamId: string;
  teamName: string;
  protectedPlayers: string[];
  unprotectedPlayers: Player[];
  selectedPlayer: string | null;
}

const CITY_OPTIONS: CityOption[] = [
  {
    name: "Las Vegas",
    marketSize: "Large",
    taxLevel: "Low",
    fanPassion: "High",
    rivalryPotential: ["Los Angeles", "Phoenix", "Sacramento"],
    description: "Entertainment capital with passionate sports fans and no state income tax",
  },
  {
    name: "Seattle",
    marketSize: "Large",
    taxLevel: "Medium",
    fanPassion: "Very High",
    rivalryPotential: ["Portland", "Golden State", "Sacramento"],
    description: "Historic basketball city eager for a team to return",
  },
  {
    name: "Vancouver",
    marketSize: "Medium",
    taxLevel: "High",
    fanPassion: "High",
    rivalryPotential: ["Seattle", "Portland", "Toronto"],
    description: "International market with strong basketball culture",
  },
  {
    name: "Louisville",
    marketSize: "Small",
    taxLevel: "Medium",
    fanPassion: "Very High",
    rivalryPotential: ["Indianapolis", "Memphis", "Cleveland"],
    description: "College basketball hotbed ready for professional team",
  },
  {
    name: "Mexico City",
    marketSize: "Large",
    taxLevel: "Medium",
    fanPassion: "High",
    rivalryPotential: ["Dallas", "Houston", "San Antonio"],
    description: "Massive international market expanding league globally",
  },
  {
    name: "Pittsburgh",
    marketSize: "Medium",
    taxLevel: "Medium",
    fanPassion: "High",
    rivalryPotential: ["Cleveland", "Philadelphia", "Detroit"],
    description: "Strong sports city with dedicated fanbase",
  },
  {
    name: "Baltimore",
    marketSize: "Medium",
    taxLevel: "High",
    fanPassion: "Medium",
    rivalryPotential: ["Philadelphia", "New York", "Brooklyn"],
    description: "East coast market near major metropolitan areas",
  },
  {
    name: "San Diego",
    marketSize: "Large",
    taxLevel: "High",
    fanPassion: "Medium",
    rivalryPotential: ["Los Angeles", "Phoenix", "Las Vegas"],
    description: "Coastal California market with growing sports interest",
  },
  {
    name: "Kansas City",
    marketSize: "Medium",
    taxLevel: "Low",
    fanPassion: "High",
    rivalryPotential: ["Oklahoma City", "Memphis", "Denver"],
    description: "Midwest market with strong sports tradition",
  },
  {
    name: "Tampa",
    marketSize: "Medium",
    taxLevel: "Low",
    fanPassion: "Medium",
    rivalryPotential: ["Miami", "Orlando", "Atlanta"],
    description: "Growing Florida market with favorable tax climate",
  },
];

const DEFAULT_TEAM_IDENTITY: TeamIdentity = {
  name: "",
  mascot: "",
  primaryColor: "#1E90FF",
  secondaryColor: "#FFD700",
  logo: "🏀",
  secondaryLogo: "⭐",
  arenaName: "",
};

export default function ExpansionScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const teams = useBasketballStore((s) => s.teams);
  const players = useBasketballStore((s) => s.players);
  const addExpansionTeam = useBasketballStore((s) => s.addExpansionTeam);

  const [activeTab, setActiveTab] = useState<TabType>("city");
  const [selectedCity, setSelectedCity] = useState<CityOption | null>(null);
  const [teamIdentity, setTeamIdentity] = useState<TeamIdentity>(DEFAULT_TEAM_IDENTITY);
  const [protectedTeams, setProtectedTeams] = useState<ProtectedTeam[]>([]);
  const [error, setError] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Initialize protected teams when moving to draft tab
  const initializeProtectedTeams = () => {
    const initialized = teams.map((team) => {
      const teamPlayers = players
        .filter((p) => p.teamId === team.id)
        .sort((a, b) => b.overall - a.overall);

      const protectedPlayers = teamPlayers.slice(0, 8).map((p) => p.id);
      const unprotectedPlayers = teamPlayers.slice(8);

      return {
        teamId: team.id,
        teamName: `${team.city} ${team.name}`,
        protectedPlayers,
        unprotectedPlayers,
        selectedPlayer: null,
      };
    });

    setProtectedTeams(initialized);
  };

  const handleTabChange = (tab: TabType) => {
    if (tab === "identity" && !selectedCity) {
      setError("Please select a city first");
      return;
    }
    if (tab === "rules" && !teamIdentity.name) {
      setError("Please complete team identity first");
      return;
    }
    if (tab === "draft") {
      if (!teamIdentity.name) {
        setError("Please complete team identity first");
        return;
      }
      if (protectedTeams.length === 0) {
        initializeProtectedTeams();
      }
    }
    if (tab === "finalize") {
      const selectedCount = protectedTeams.filter((t) => t.selectedPlayer).length;
      if (selectedCount < teams.length) {
        setError("Please select at least one player from each team");
        return;
      }
    }
    setError("");
    setActiveTab(tab);
  };

  const selectPlayerFromTeam = (teamId: string, playerId: string) => {
    setProtectedTeams((prev) =>
      prev.map((team) =>
        team.teamId === teamId ? { ...team, selectedPlayer: playerId } : team
      )
    );
  };

  const getTotalSalary = () => {
    return protectedTeams.reduce((total, team) => {
      if (team.selectedPlayer) {
        const player = players.find((p) => p.id === team.selectedPlayer);
        return total + (player?.contract?.salary || 1.1);
      }
      return total;
    }, 0);
  };

  const getSelectedPlayers = () => {
    return protectedTeams
      .filter((t) => t.selectedPlayer)
      .map((t) => players.find((p) => p.id === t.selectedPlayer)!)
      .filter(Boolean);
  };

  const handleFinalize = () => {
    if (!selectedCity || !teamIdentity.name) {
      setError("Please complete all required steps");
      return;
    }

    const selectedPlayerIds = protectedTeams
      .filter((t) => t.selectedPlayer)
      .map((t) => t.selectedPlayer!);

    if (selectedPlayerIds.length < teams.length) {
      setError("Please select at least one player from each team");
      return;
    }

    addExpansionTeam(selectedCity, teamIdentity, selectedPlayerIds);
    setShowConfirmModal(true);
  };

  const handleModalClose = () => {
    setShowConfirmModal(false);
    navigation.goBack();
  };

  return (
    <View className="flex-1 bg-gray-950" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-6 py-4 border-b border-gray-800">
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => navigation.goBack()} className="flex-row items-center gap-2">
            <Ionicons name="arrow-back" size={24} color="#60A5FA" />
            <Text className="text-blue-400 text-lg">Back</Text>
          </Pressable>
          <Text className="text-white text-2xl font-bold">League Expansion</Text>
          <View style={{ width: 80 }} />
        </View>
      </View>

      {/* Error Message */}
      {error ? (
        <View className="mx-6 mt-4 bg-red-900/30 border border-red-700 rounded-xl p-4">
          <Text className="text-red-400 text-center">{error}</Text>
        </View>
      ) : null}

      {/* Tab Navigation */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6 mt-4">
        <View className="flex-row gap-2">
          {[
            { key: "city", label: "City", icon: "location" },
            { key: "identity", label: "Identity", icon: "shirt" },
            { key: "rules", label: "Rules", icon: "information-circle" },
            { key: "draft", label: "Draft", icon: "people" },
            { key: "finalize", label: "Finalize", icon: "checkmark-circle" },
          ].map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => handleTabChange(tab.key as TabType)}
              className={`px-4 py-2 rounded-xl flex-row items-center gap-2 ${
                activeTab === tab.key ? "bg-blue-600" : "bg-gray-800"
              }`}
            >
              <Ionicons
                name={tab.icon as any}
                size={18}
                color={activeTab === tab.key ? "#FFFFFF" : "#9CA3AF"}
              />
              <Text
                className={`font-semibold ${
                  activeTab === tab.key ? "text-white" : "text-gray-400"
                }`}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <ScrollView className="flex-1 px-6 mt-6">
        {/* City Selection Tab */}
        {activeTab === "city" && (
          <View>
            <Text className="text-white text-xl font-bold mb-4">Select Expansion City</Text>
            <Text className="text-gray-400 mb-6">
              Choose a city to host your expansion team. Consider market size, taxes, and fan
              passion.
            </Text>

            {CITY_OPTIONS.map((city) => (
              <Pressable
                key={city.name}
                onPress={() => {
                  setSelectedCity(city);
                  setError("");
                }}
                className={`mb-4 p-4 rounded-xl border-2 ${
                  selectedCity?.name === city.name
                    ? "bg-blue-900/30 border-blue-500"
                    : "bg-gray-800 border-gray-700"
                }`}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-white text-lg font-bold">{city.name}</Text>
                  {selectedCity?.name === city.name && (
                    <Ionicons name="checkmark-circle" size={24} color="#3B82F6" />
                  )}
                </View>

                <Text className="text-gray-400 text-sm mb-3">{city.description}</Text>

                <View className="flex-row flex-wrap gap-2">
                  <View className="bg-gray-700 px-3 py-1 rounded-lg">
                    <Text className="text-gray-300 text-xs">
                      Market: <Text className="text-white font-semibold">{city.marketSize}</Text>
                    </Text>
                  </View>
                  <View className="bg-gray-700 px-3 py-1 rounded-lg">
                    <Text className="text-gray-300 text-xs">
                      Tax: <Text className="text-white font-semibold">{city.taxLevel}</Text>
                    </Text>
                  </View>
                  <View className="bg-gray-700 px-3 py-1 rounded-lg">
                    <Text className="text-gray-300 text-xs">
                      Passion: <Text className="text-white font-semibold">{city.fanPassion}</Text>
                    </Text>
                  </View>
                </View>

                {city.rivalryPotential.length > 0 && (
                  <View className="mt-3">
                    <Text className="text-gray-500 text-xs mb-1">Potential Rivals:</Text>
                    <Text className="text-blue-400 text-xs">{city.rivalryPotential.join(", ")}</Text>
                  </View>
                )}
              </Pressable>
            ))}

            <View className="h-20" />
          </View>
        )}

        {/* Team Identity Tab */}
        {activeTab === "identity" && (
          <View>
            <Text className="text-white text-xl font-bold mb-4">Design Your Team</Text>
            <Text className="text-gray-400 mb-6">
              Create your expansion team{"'"}s identity with a unique name, colors, and branding.
            </Text>

            {/* Team Name */}
            <View className="mb-4">
              <Text className="text-white text-base font-semibold mb-2">Team Name</Text>
              <TextInput
                value={teamIdentity.name}
                onChangeText={(text) => {
                  setTeamIdentity({ ...teamIdentity, name: text });
                  setError("");
                }}
                placeholder="e.g., Dragons, Storm, Thunder"
                placeholderTextColor="#6B7280"
                className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base"
                maxLength={20}
              />
            </View>

            {/* Mascot */}
            <View className="mb-4">
              <Text className="text-white text-base font-semibold mb-2">Mascot</Text>
              <TextInput
                value={teamIdentity.mascot}
                onChangeText={(text) => setTeamIdentity({ ...teamIdentity, mascot: text })}
                placeholder="e.g., Spike, Blaze"
                placeholderTextColor="#6B7280"
                className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base"
                maxLength={15}
              />
            </View>

            {/* Primary Logo */}
            <View className="mb-4">
              <Text className="text-white text-base font-semibold mb-2">Primary Logo (Emoji)</Text>
              <View className="flex-row items-center gap-3">
                <TextInput
                  value={teamIdentity.logo}
                  onChangeText={(text) => setTeamIdentity({ ...teamIdentity, logo: text })}
                  placeholder="🏀"
                  placeholderTextColor="#6B7280"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base"
                  maxLength={2}
                />
                <Text style={{ fontSize: 40 }}>{teamIdentity.logo || "🏀"}</Text>
              </View>
            </View>

            {/* Secondary Logo */}
            <View className="mb-4">
              <Text className="text-white text-base font-semibold mb-2">
                Secondary Logo (Emoji)
              </Text>
              <View className="flex-row items-center gap-3">
                <TextInput
                  value={teamIdentity.secondaryLogo}
                  onChangeText={(text) =>
                    setTeamIdentity({ ...teamIdentity, secondaryLogo: text })
                  }
                  placeholder="⭐"
                  placeholderTextColor="#6B7280"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base"
                  maxLength={2}
                />
                <Text style={{ fontSize: 32 }}>{teamIdentity.secondaryLogo || "⭐"}</Text>
              </View>
            </View>

            {/* Primary Color */}
            <View className="mb-4">
              <Text className="text-white text-base font-semibold mb-2">Primary Color (Hex)</Text>
              <View className="flex-row items-center gap-3">
                <TextInput
                  value={teamIdentity.primaryColor}
                  onChangeText={(text) =>
                    setTeamIdentity({ ...teamIdentity, primaryColor: text })
                  }
                  placeholder="#1E90FF"
                  placeholderTextColor="#6B7280"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base"
                  autoCapitalize="none"
                />
                <View
                  className="w-12 h-12 rounded-xl border-2 border-gray-700"
                  style={{ backgroundColor: teamIdentity.primaryColor }}
                />
              </View>
            </View>

            {/* Secondary Color */}
            <View className="mb-4">
              <Text className="text-white text-base font-semibold mb-2">
                Secondary Color (Hex)
              </Text>
              <View className="flex-row items-center gap-3">
                <TextInput
                  value={teamIdentity.secondaryColor}
                  onChangeText={(text) =>
                    setTeamIdentity({ ...teamIdentity, secondaryColor: text })
                  }
                  placeholder="#FFD700"
                  placeholderTextColor="#6B7280"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base"
                  autoCapitalize="none"
                />
                <View
                  className="w-12 h-12 rounded-xl border-2 border-gray-700"
                  style={{ backgroundColor: teamIdentity.secondaryColor }}
                />
              </View>
            </View>

            {/* Arena Name */}
            <View className="mb-4">
              <Text className="text-white text-base font-semibold mb-2">Arena Name</Text>
              <TextInput
                value={teamIdentity.arenaName}
                onChangeText={(text) => setTeamIdentity({ ...teamIdentity, arenaName: text })}
                placeholder={`e.g., ${selectedCity?.name} Arena`}
                placeholderTextColor="#6B7280"
                className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base"
                maxLength={30}
              />
            </View>

            {/* Brand Preview */}
            <View className="mt-6 bg-gray-800 rounded-xl p-6 border-2 border-gray-700">
              <Text className="text-white text-lg font-bold mb-4 text-center">Brand Preview</Text>
              <View className="items-center">
                <View className="flex-row items-center mb-3">
                  <Text style={{ fontSize: 48 }}>{teamIdentity.logo}</Text>
                  <Text style={{ fontSize: 32, marginLeft: -12 }}>
                    {teamIdentity.secondaryLogo}
                  </Text>
                </View>
                <Text className="text-white text-2xl font-bold mb-1">
                  {selectedCity?.name} {teamIdentity.name || "Team Name"}
                </Text>
                {teamIdentity.mascot && (
                  <Text className="text-gray-400 text-base mb-3">
                    Mascot: {teamIdentity.mascot}
                  </Text>
                )}
                <View className="flex-row items-center gap-2">
                  <View
                    className="w-8 h-8 rounded-full"
                    style={{ backgroundColor: teamIdentity.primaryColor }}
                  />
                  <View
                    className="w-8 h-8 rounded-full"
                    style={{ backgroundColor: teamIdentity.secondaryColor }}
                  />
                </View>
                {teamIdentity.arenaName && (
                  <Text className="text-gray-400 text-sm mt-3">
                    Home: {teamIdentity.arenaName}
                  </Text>
                )}
              </View>
            </View>

            <View className="h-20" />
          </View>
        )}

        {/* Rules Tab */}
        {activeTab === "rules" && (
          <View>
            <Text className="text-white text-xl font-bold mb-4">Expansion Draft Rules</Text>

            <View className="bg-gray-800 rounded-xl p-5 mb-4">
              <View className="flex-row items-start gap-3 mb-4">
                <View className="bg-blue-600 rounded-full w-8 h-8 items-center justify-center">
                  <Text className="text-white font-bold">1</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-white text-base font-semibold mb-1">
                    Protected Players
                  </Text>
                  <Text className="text-gray-400 text-sm">
                    Each existing team protects their 8 best players (by overall rating). The
                    remaining players become available for selection.
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start gap-3 mb-4">
                <View className="bg-blue-600 rounded-full w-8 h-8 items-center justify-center">
                  <Text className="text-white font-bold">2</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-white text-base font-semibold mb-1">Selection Limit</Text>
                  <Text className="text-gray-400 text-sm">
                    You must select exactly 1 player from each existing team. This ensures you
                    build a balanced roster from across the league.
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start gap-3 mb-4">
                <View className="bg-blue-600 rounded-full w-8 h-8 items-center justify-center">
                  <Text className="text-white font-bold">3</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-white text-base font-semibold mb-1">Salary Minimum</Text>
                  <Text className="text-gray-400 text-sm">
                    Your expansion team must meet the league{"'"}s salary floor. The total salary of
                    selected players will be tracked automatically.
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start gap-3">
                <View className="bg-blue-600 rounded-full w-8 h-8 items-center justify-center">
                  <Text className="text-white font-bold">4</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-white text-base font-semibold mb-1">Team Benefits</Text>
                  <Text className="text-gray-400 text-sm">
                    • High fan interest for 2 seasons{"\n"}• Low expectations for 1 season{"\n"}•
                    Improved draft lottery odds{"\n"}• Auto-generated coaching staff
                  </Text>
                </View>
              </View>
            </View>

            <View className="bg-blue-900/30 border border-blue-700 rounded-xl p-4">
              <View className="flex-row items-center gap-2 mb-2">
                <Ionicons name="information-circle" size={24} color="#60A5FA" />
                <Text className="text-blue-400 text-base font-bold">Strategy Tip</Text>
              </View>
              <Text className="text-blue-300 text-sm">
                Look for young players with high potential or veterans on expiring contracts. Build
                for the future while staying competitive.
              </Text>
            </View>

            <View className="h-20" />
          </View>
        )}

        {/* Draft Tab */}
        {activeTab === "draft" && (
          <View>
            <Text className="text-white text-xl font-bold mb-2">Expansion Draft</Text>
            <Text className="text-gray-400 mb-4">
              Select 1 player from each team. Protected players (top 8) are unavailable.
            </Text>

            {/* Salary Tracker */}
            <View className="bg-gray-800 rounded-xl p-4 mb-4">
              <View className="flex-row justify-between items-center">
                <Text className="text-gray-400 text-sm">Total Salary</Text>
                <Text className="text-white text-lg font-bold">
                  ${getTotalSalary().toFixed(1)}M
                </Text>
              </View>
              <View className="flex-row justify-between items-center mt-2">
                <Text className="text-gray-400 text-sm">Players Selected</Text>
                <Text className="text-white text-lg font-bold">
                  {protectedTeams.filter((t) => t.selectedPlayer).length} / {teams.length}
                </Text>
              </View>
            </View>

            {/* Team Selection Grid */}
            {protectedTeams.map((team) => (
              <View key={team.teamId} className="bg-gray-800 rounded-xl p-4 mb-4">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-white text-lg font-bold">{team.teamName}</Text>
                  {team.selectedPlayer && (
                    <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                  )}
                </View>

                {team.unprotectedPlayers.length === 0 ? (
                  <View className="bg-gray-700 rounded-lg p-3">
                    <Text className="text-gray-400 text-sm text-center">
                      No unprotected players available
                    </Text>
                  </View>
                ) : (
                  <View>
                    <Text className="text-gray-400 text-xs mb-2">
                      {team.unprotectedPlayers.length} available players
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View className="flex-row gap-2">
                        {team.unprotectedPlayers.map((player) => (
                          <Pressable
                            key={player.id}
                            onPress={() => selectPlayerFromTeam(team.teamId, player.id)}
                            className={`w-40 rounded-lg p-3 border-2 ${
                              team.selectedPlayer === player.id
                                ? "bg-blue-900/30 border-blue-500"
                                : "bg-gray-700 border-gray-600"
                            }`}
                          >
                            <Text className="text-white text-sm font-bold mb-1">
                              {player.name}
                            </Text>
                            <View className="flex-row items-center gap-2 mb-1">
                              <View className="bg-gray-800 px-2 py-0.5 rounded">
                                <Text className="text-gray-300 text-xs">{player.position}</Text>
                              </View>
                              <View
                                className={`px-2 py-0.5 rounded ${
                                  player.overall >= 80
                                    ? "bg-green-600"
                                    : player.overall >= 70
                                    ? "bg-blue-600"
                                    : "bg-gray-600"
                                }`}
                              >
                                <Text className="text-white text-xs font-bold">
                                  {player.overall}
                                </Text>
                              </View>
                            </View>
                            <Text className="text-gray-400 text-xs">
                              Age: {player.age} | ${player.contract?.salary.toFixed(1)}M
                            </Text>
                            {team.selectedPlayer === player.id && (
                              <View className="mt-2 items-center">
                                <Ionicons name="checkmark-circle" size={20} color="#3B82F6" />
                              </View>
                            )}
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                )}
              </View>
            ))}

            <View className="h-20" />
          </View>
        )}

        {/* Finalize Tab */}
        {activeTab === "finalize" && (
          <View>
            <Text className="text-white text-xl font-bold mb-4">Confirm Expansion Team</Text>

            {/* Team Summary */}
            <View className="bg-gray-800 rounded-xl p-5 mb-4">
              <View className="items-center mb-4">
                <View className="flex-row items-center mb-2">
                  <Text style={{ fontSize: 48 }}>{teamIdentity.logo}</Text>
                  <Text style={{ fontSize: 32, marginLeft: -12 }}>
                    {teamIdentity.secondaryLogo}
                  </Text>
                </View>
                <Text className="text-white text-2xl font-bold">
                  {selectedCity?.name} {teamIdentity.name}
                </Text>
                {teamIdentity.arenaName && (
                  <Text className="text-gray-400 text-sm mt-1">{teamIdentity.arenaName}</Text>
                )}
              </View>

              <View className="border-t border-gray-700 pt-4">
                <View className="flex-row justify-between mb-2">
                  <Text className="text-gray-400">Market Size</Text>
                  <Text className="text-white font-semibold">{selectedCity?.marketSize}</Text>
                </View>
                <View className="flex-row justify-between mb-2">
                  <Text className="text-gray-400">Fan Passion</Text>
                  <Text className="text-white font-semibold">{selectedCity?.fanPassion}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-gray-400">Tax Level</Text>
                  <Text className="text-white font-semibold">{selectedCity?.taxLevel}</Text>
                </View>
              </View>
            </View>

            {/* Roster Summary */}
            <View className="bg-gray-800 rounded-xl p-5 mb-4">
              <Text className="text-white text-lg font-bold mb-3">Expansion Draft Picks</Text>
              <Text className="text-gray-400 text-sm mb-3">
                {getSelectedPlayers().length} players selected
              </Text>

              {getSelectedPlayers()
                .sort((a, b) => b.overall - a.overall)
                .map((player, index) => (
                  <View
                    key={player.id}
                    className="flex-row items-center justify-between py-2 border-b border-gray-700"
                  >
                    <View className="flex-1">
                      <Text className="text-white text-base font-semibold">
                        {player.name}
                      </Text>
                      <Text className="text-gray-400 text-sm">
                        {player.position} • Age {player.age}
                      </Text>
                    </View>
                    <View className="items-end">
                      <View
                        className={`px-2 py-1 rounded ${
                          player.overall >= 80
                            ? "bg-green-600"
                            : player.overall >= 70
                            ? "bg-blue-600"
                            : "bg-gray-600"
                        }`}
                      >
                        <Text className="text-white text-sm font-bold">{player.overall}</Text>
                      </View>
                      <Text className="text-gray-400 text-xs mt-1">
                        ${player.contract?.salary.toFixed(1)}M
                      </Text>
                    </View>
                  </View>
                ))}

              <View className="mt-4 pt-3 border-t border-gray-700">
                <View className="flex-row justify-between">
                  <Text className="text-white text-base font-bold">Total Salary</Text>
                  <Text className="text-white text-base font-bold">
                    ${getTotalSalary().toFixed(1)}M
                  </Text>
                </View>
              </View>
            </View>

            {/* Benefits Summary */}
            <View className="bg-blue-900/30 border border-blue-700 rounded-xl p-5 mb-4">
              <Text className="text-blue-400 text-lg font-bold mb-3">Expansion Benefits</Text>
              <View className="gap-2">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={20} color="#60A5FA" />
                  <Text className="text-blue-300 text-sm">High fan interest for 2 seasons</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={20} color="#60A5FA" />
                  <Text className="text-blue-300 text-sm">Low expectations for 1 season</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={20} color="#60A5FA" />
                  <Text className="text-blue-300 text-sm">Improved draft lottery odds</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={20} color="#60A5FA" />
                  <Text className="text-blue-300 text-sm">Auto-generated coaching staff</Text>
                </View>
              </View>
            </View>

            <View className="h-20" />
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Button */}
      <View
        className="px-6 py-4 bg-gray-900 border-t border-gray-800"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        {activeTab === "city" && selectedCity && (
          <Pressable
            onPress={() => handleTabChange("identity")}
            className="bg-blue-600 rounded-2xl p-5 items-center active:bg-blue-700"
          >
            <Text className="text-white text-xl font-bold">Continue to Team Identity</Text>
          </Pressable>
        )}

        {activeTab === "identity" && teamIdentity.name && (
          <Pressable
            onPress={() => handleTabChange("rules")}
            className="bg-blue-600 rounded-2xl p-5 items-center active:bg-blue-700"
          >
            <Text className="text-white text-xl font-bold">Continue to Rules</Text>
          </Pressable>
        )}

        {activeTab === "rules" && (
          <Pressable
            onPress={() => handleTabChange("draft")}
            className="bg-blue-600 rounded-2xl p-5 items-center active:bg-blue-700"
          >
            <Text className="text-white text-xl font-bold">Begin Expansion Draft</Text>
          </Pressable>
        )}

        {activeTab === "draft" &&
          protectedTeams.filter((t) => t.selectedPlayer).length === teams.length && (
            <Pressable
              onPress={() => handleTabChange("finalize")}
              className="bg-blue-600 rounded-2xl p-5 items-center active:bg-blue-700"
            >
              <Text className="text-white text-xl font-bold">Review Selection</Text>
            </Pressable>
          )}

        {activeTab === "finalize" && (
          <Pressable
            onPress={handleFinalize}
            className="bg-green-600 rounded-2xl p-5 items-center active:bg-green-700"
          >
            <Text className="text-white text-xl font-bold">Finalize Expansion</Text>
          </Pressable>
        )}
      </View>

      {/* Success Modal */}
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View className="flex-1 bg-black/80 justify-center items-center px-6">
          <View className="bg-gray-900 rounded-3xl p-6 w-full max-w-md">
            <View className="items-center mb-4">
              <View className="bg-green-600 rounded-full w-16 h-16 items-center justify-center mb-4">
                <Ionicons name="checkmark" size={40} color="#FFFFFF" />
              </View>
              <Text className="text-white text-2xl font-bold mb-2">Expansion Complete!</Text>
              <Text className="text-gray-400 text-center">
                {selectedCity?.name} {teamIdentity.name} has been added to the league
              </Text>
            </View>

            <Pressable
              onPress={handleModalClose}
              className="bg-blue-600 rounded-2xl p-4 items-center active:bg-blue-700 mt-4"
            >
              <Text className="text-white text-lg font-bold">Return to Dashboard</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
