import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, Switch, Modal } from "react-native";
import { useBasketballStore } from "../state/basketballStore";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { LeagueSettings } from "../types/basketball";
import { DEFAULT_LEAGUE_SETTINGS } from "../utils/defaultSettings";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export default function SettingsScreen({ navigation }: Props) {
  const updateSettings = useBasketballStore((s) => s.updateSettings);
  const currentLeagueId = useBasketballStore((s) => s.currentLeagueId);
  const savedLeagues = useBasketballStore((s) => s.savedLeagues);
  const season = useBasketballStore((s) => s.season);

  // Get settings from the current league (reactive)
  const currentLeague = savedLeagues.find((l) => l.id === currentLeagueId);
  const settings = currentLeague?.settings || DEFAULT_LEAGUE_SETTINGS;

  // Check if season has started
  const hasStartedSeason = season.hasStartedSeason === true;

  const [showResetModal, setShowResetModal] = useState(false);

  // Helper function to update a single setting
  const handleUpdate = (key: keyof LeagueSettings, value: any) => {
    updateSettings({ [key]: value });
  };

  // Reset to defaults
  const handleReset = () => {
    updateSettings(DEFAULT_LEAGUE_SETTINGS);
    setShowResetModal(false);
  };

  // Render Toggle Switch
  const renderToggle = (
    label: string,
    value: boolean,
    key: keyof LeagueSettings,
    description?: string
  ) => (
    <View className="py-3 border-b border-gray-700">
      <View className="flex-row justify-between items-center">
        <View className="flex-1 mr-4">
          <Text className="text-white text-base font-medium">{label}</Text>
          {description && (
            <Text className="text-gray-400 text-xs mt-1">{description}</Text>
          )}
        </View>
        <Switch
          value={value}
          onValueChange={(newValue) => handleUpdate(key, newValue)}
          trackColor={{ false: "#374151", true: "#3B82F6" }}
          thumbColor={value ? "#60A5FA" : "#9CA3AF"}
        />
      </View>
    </View>
  );

  // Component for Dropdown Picker
  const PickerComponent = <T extends string>({
    label,
    value,
    options,
    settingKey,
    description,
  }: {
    label: string;
    value: T;
    options: { label: string; value: T }[];
    settingKey: keyof LeagueSettings;
    description?: string;
  }) => {
    const [showModal, setShowModal] = useState(false);

    return (
      <>
        <View className="py-3 border-b border-gray-700">
          <Text className="text-white text-base font-medium mb-2">{label}</Text>
          {description && (
            <Text className="text-gray-400 text-xs mb-2">{description}</Text>
          )}
          <Pressable
            className="bg-gray-700 rounded-lg px-4 py-3 flex-row justify-between items-center active:bg-gray-600"
            onPress={() => setShowModal(true)}
          >
            <Text className="text-white font-medium">
              {options.find((o) => o.value === value)?.label || value}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
          </Pressable>
        </View>

        {/* Picker Modal */}
        <Modal visible={showModal} transparent animationType="fade">
          <Pressable
            className="flex-1 bg-black/50 justify-center items-center"
            onPress={() => setShowModal(false)}
          >
            <View className="bg-gray-800 rounded-xl w-4/5 max-h-96 border border-gray-700">
              <View className="px-4 py-3 border-b border-gray-700">
                <Text className="text-white font-bold text-lg">{label}</Text>
              </View>
              <ScrollView>
                {options.map((option) => (
                  <Pressable
                    key={option.value}
                    className={`px-4 py-4 border-b border-gray-700 active:bg-gray-700 ${
                      option.value === value ? "bg-blue-900/30" : ""
                    }`}
                    onPress={() => {
                      handleUpdate(settingKey, option.value);
                      setShowModal(false);
                    }}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-white text-base">{option.label}</Text>
                      {option.value === value && (
                        <Ionicons name="checkmark-circle" size={24} color="#3B82F6" />
                      )}
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      </>
    );
  };

  // Render Slider (1-5 scale)
  const renderSlider = (
    label: string,
    value: number,
    key: keyof LeagueSettings,
    description?: string
  ) => (
    <View className="py-3 border-b border-gray-700">
      <View className="flex-row justify-between items-center mb-2">
        <View className="flex-1 mr-4">
          <Text className="text-white text-base font-medium">{label}</Text>
          {description && (
            <Text className="text-gray-400 text-xs mt-1">{description}</Text>
          )}
        </View>
        <View className="bg-gray-700 rounded-lg px-3 py-1">
          <Text className="text-white font-bold">{value}</Text>
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        <Pressable
          className="bg-gray-700 rounded-lg p-2 active:bg-gray-600"
          onPress={() => handleUpdate(key, Math.max(1, value - 1))}
        >
          <Ionicons name="remove" size={20} color="white" />
        </Pressable>
        <View className="flex-1 flex-row gap-1">
          {[1, 2, 3, 4, 5].map((level) => (
            <Pressable
              key={level}
              className="flex-1"
              onPress={() => handleUpdate(key, level)}
            >
              <View
                className={`h-8 rounded ${
                  value >= level ? "bg-blue-500" : "bg-gray-700"
                }`}
              />
            </Pressable>
          ))}
        </View>
        <Pressable
          className="bg-gray-700 rounded-lg p-2 active:bg-gray-600"
          onPress={() => handleUpdate(key, Math.min(5, value + 1))}
        >
          <Ionicons name="add" size={20} color="white" />
        </Pressable>
      </View>
    </View>
  );

  // Render Number Input (with +/-)
  const renderNumberInput = (
    label: string,
    value: number,
    key: keyof LeagueSettings,
    min: number,
    max: number,
    description?: string,
    step: number = 1,
    disabled: boolean = false,
    disabledTooltip?: string
  ) => (
    <View className="py-3 border-b border-gray-700">
      <View className="flex-row justify-between items-center mb-2">
        <View className="flex-1 mr-4">
          <Text className={`text-base font-medium ${disabled ? "text-gray-500" : "text-white"}`}>{label}</Text>
          {description && (
            <Text className="text-gray-400 text-xs mt-1">{description}</Text>
          )}
          {disabled && disabledTooltip && (
            <View className="mt-2 bg-yellow-900/30 border border-yellow-700 rounded px-2 py-1">
              <Text className="text-yellow-400 text-xs">{disabledTooltip}</Text>
            </View>
          )}
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        <Pressable
          className={`rounded-lg p-2 ${disabled ? "bg-gray-800" : "bg-gray-700 active:bg-gray-600"}`}
          onPress={() => !disabled && handleUpdate(key, Math.max(min, value - step))}
          disabled={disabled}
        >
          <Ionicons name="remove" size={20} color={disabled ? "#4B5563" : "white"} />
        </Pressable>
        <View className={`flex-1 rounded-lg py-3 items-center ${disabled ? "bg-gray-800" : "bg-gray-700"}`}>
          <Text className={`font-bold text-lg ${disabled ? "text-gray-500" : "text-white"}`}>{value}</Text>
        </View>
        <Pressable
          className={`rounded-lg p-2 ${disabled ? "bg-gray-800" : "bg-gray-700 active:bg-gray-600"}`}
          onPress={() => !disabled && handleUpdate(key, Math.min(max, value + step))}
          disabled={disabled}
        >
          <Ionicons name="add" size={20} color={disabled ? "#4B5563" : "white"} />
        </Pressable>
      </View>
    </View>
  );

  // Render wider 1-10 scale slider
  const renderWideSlider = (
    label: string,
    value: number,
    key: keyof LeagueSettings,
    description?: string
  ) => (
    <View className="py-3 border-b border-gray-700">
      <View className="flex-row justify-between items-center mb-2">
        <View className="flex-1 mr-4">
          <Text className="text-white text-base font-medium">{label}</Text>
          {description && (
            <Text className="text-gray-400 text-xs mt-1">{description}</Text>
          )}
        </View>
        <View className="bg-gray-700 rounded-lg px-3 py-1">
          <Text className="text-white font-bold">{value}/10</Text>
        </View>
      </View>
      <View className="flex-row gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
          <Pressable
            key={level}
            className="flex-1"
            onPress={() => handleUpdate(key, level)}
          >
            <View
              className={`h-8 rounded ${
                value >= level ? "bg-blue-500" : "bg-gray-700"
              }`}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-gray-950">
      {/* Header */}
      <View className="px-6 pt-16 pb-4 bg-gray-900 border-b border-gray-800">
        <Text className="text-white text-3xl font-bold">Settings</Text>
        <Text className="text-gray-400 text-sm mt-1">
          Configure your league experience
        </Text>
      </View>

      <ScrollView className="flex-1 px-6 py-4">
        {/* Section 1: League Structure */}
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-4">
            <Ionicons name="trophy" size={24} color="#60A5FA" />
            <Text className="text-white text-xl font-bold">League Structure</Text>
          </View>
          <View className="bg-gray-800 rounded-xl p-4">
            {renderToggle(
              "Conferences",
              settings.conferencesEnabled,
              "conferencesEnabled",
              "Split teams into Eastern and Western conferences"
            )}
            {renderToggle(
              "Divisions",
              settings.divisionsEnabled,
              "divisionsEnabled",
              "Group teams into divisions within conferences"
            )}
            {renderNumberInput(
              "Games Per Season",
              settings.gamesPerSeason,
              "gamesPerSeason",
              10,
              82,
              "Number of regular season games",
              1,
              hasStartedSeason,
              "Cannot change after the season starts"
            )}
            {renderNumberInput(
              "Playoff Teams",
              settings.playoffTeams,
              "playoffTeams",
              4,
              20,
              "How many teams make the playoffs"
            )}
          </View>
        </View>

        {/* Section 2: Gameplay Difficulty */}
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-4">
            <Ionicons name="game-controller" size={24} color="#60A5FA" />
            <Text className="text-white text-xl font-bold">Gameplay Difficulty</Text>
          </View>
          <View className="bg-gray-800 rounded-xl p-4">
            <PickerComponent
              label="Difficulty Level"
              value={settings.difficultyLevel}
              options={[
                { label: "Casual", value: "casual" },
                { label: "Normal", value: "normal" },
                { label: "Sim Hardcore", value: "sim-hardcore" },
              ]}
              settingKey="difficultyLevel"
              description="Overall game difficulty"
            />
            {renderWideSlider(
              "AI Skill Level",
              settings.playerAISkill,
              "playerAISkill",
              "How skilled AI opponents are in games"
            )}
            {renderWideSlider(
              "Trade AI Aggression",
              settings.tradeAIAggression,
              "tradeAIAggression",
              "How aggressively AI teams pursue trades"
            )}
          </View>
        </View>

        {/* Section 3: Realism Settings */}
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-4">
            <Ionicons name="pulse" size={24} color="#60A5FA" />
            <Text className="text-white text-xl font-bold">Realism Settings</Text>
          </View>
          <View className="bg-gray-800 rounded-xl p-4">
            {renderToggle(
              "Injuries",
              settings.injuriesEnabled,
              "injuriesEnabled",
              "Enable player injuries"
            )}
            {settings.injuriesEnabled &&
              renderSlider(
                "Injury Frequency",
                settings.injuryFrequency,
                "injuryFrequency",
                "How often injuries occur (1=rare, 5=frequent)"
              )}
            {renderToggle(
              "Player Fatigue",
              settings.fatigueEnabled,
              "fatigueEnabled",
              "Players get tired from heavy playing time"
            )}
            {renderToggle(
              "Player Morale",
              settings.playerMoraleEnabled,
              "playerMoraleEnabled",
              "Morale affects player performance and trade demands"
            )}
            {renderToggle(
              "Contract Negotiations",
              settings.contractNegotiationsEnabled,
              "contractNegotiationsEnabled",
              "Negotiate with players for contract extensions"
            )}
          </View>
        </View>

        {/* Section 4: Financial Rules */}
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-4">
            <Ionicons name="cash" size={24} color="#60A5FA" />
            <Text className="text-white text-xl font-bold">Financial Rules</Text>
          </View>
          <View className="bg-gray-800 rounded-xl p-4">
            {renderToggle(
              "Salary Cap",
              settings.salaryCapEnabled,
              "salaryCapEnabled",
              "Enable or disable salary cap restrictions"
            )}
            {renderNumberInput(
              "Salary Cap ($M)",
              settings.salaryCap,
              "salaryCap",
              50,
              300,
              "Maximum team salary allowed",
              1
            )}
            {renderToggle(
              "Luxury Tax",
              settings.luxuryTax,
              "luxuryTax",
              "Penalize teams exceeding the luxury tax threshold"
            )}
            {settings.luxuryTax && (
              <>
                {renderSlider(
                  "Luxury Tax Severity",
                  settings.luxuryTaxSeverity,
                  "luxuryTaxSeverity",
                  "How harsh the luxury tax penalties are"
                )}
                {renderNumberInput(
                  "Luxury Tax Threshold ($M)",
                  settings.luxuryTaxThreshold,
                  "luxuryTaxThreshold",
                  100,
                  350,
                  "Salary threshold before luxury tax kicks in",
                  1
                )}
              </>
            )}
            <PickerComponent
              label="Hard Cap Enforcement"
              value={settings.hardCapEnforcement}
              options={[
                { label: "None", value: "none" },
                { label: "Soft Cap", value: "soft" },
                { label: "Strict Cap", value: "strict" },
              ]}
              settingKey="hardCapEnforcement"
              description="How strictly the salary cap is enforced"
            />
            {renderNumberInput(
              "Minimum Salary ($M)",
              settings.minimumSalary,
              "minimumSalary",
              0.5,
              5,
              "Minimum player salary",
              0.1
            )}
            {renderNumberInput(
              "Max Contract Length (Years)",
              settings.maxContractLength,
              "maxContractLength",
              1,
              7,
              "Maximum contract duration"
            )}
          </View>
        </View>

        {/* Section 5: Roster Rules */}
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-4">
            <Ionicons name="people" size={24} color="#60A5FA" />
            <Text className="text-white text-xl font-bold">Roster Rules</Text>
          </View>
          <View className="bg-gray-800 rounded-xl p-4">
            {renderNumberInput(
              "Roster Size (Minimum)",
              settings.rosterSizeMin,
              "rosterSizeMin",
              8,
              15,
              "Minimum number of players per team"
            )}
            {renderNumberInput(
              "Roster Size (Maximum)",
              settings.rosterSizeMax,
              "rosterSizeMax",
              15,
              18,
              "Maximum number of players per team"
            )}
          </View>
        </View>

        {/* Section 6: Draft Settings */}
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-4">
            <Ionicons name="ribbon" size={24} color="#60A5FA" />
            <Text className="text-white text-xl font-bold">Draft Settings</Text>
          </View>
          <View className="bg-gray-800 rounded-xl p-4">
            {renderNumberInput(
              "Draft Rounds",
              settings.draftRounds,
              "draftRounds",
              1,
              5,
              "Number of rounds in the draft"
            )}
            {renderToggle(
              "Draft Lottery",
              settings.draftLotteryEnabled,
              "draftLotteryEnabled",
              "Bottom teams enter lottery for top picks"
            )}
            {renderNumberInput(
              "Rookie Contract Length (Years)",
              settings.rookieContracts,
              "rookieContracts",
              1,
              5,
              "Length of rookie contracts"
            )}
            <PickerComponent
              label="Draft Class Quality"
              value={settings.draftClassQuality}
              options={[
                { label: "Poor", value: "poor" },
                { label: "Average", value: "average" },
                { label: "Strong", value: "strong" },
                { label: "Legendary", value: "legendary" },
              ]}
              settingKey="draftClassQuality"
              description="Overall quality of draft prospects"
            />
          </View>
        </View>

        {/* Section 7: Simulation Settings */}
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-4">
            <Ionicons name="play-circle" size={24} color="#60A5FA" />
            <Text className="text-white text-xl font-bold">Simulation Settings</Text>
          </View>
          <View className="bg-gray-800 rounded-xl p-4">
            <PickerComponent
              label="Progression Speed"
              value={settings.progressionSpeed}
              options={[
                { label: "Slow", value: "slow" },
                { label: "Normal", value: "normal" },
                { label: "Fast", value: "fast" },
              ]}
              settingKey="progressionSpeed"
              description="How quickly the season progresses"
            />
            {renderSlider(
              "Player Development Speed",
              settings.playerDevelopment,
              "playerDevelopment",
              "How quickly players improve (1=slow, 5=fast)"
            )}
            <PickerComponent
              label="Game Simulation Detail"
              value={settings.gameSimulationDetail}
              options={[
                { label: "Fast", value: "fast" },
                { label: "Standard", value: "standard" },
                { label: "Deep Simulation", value: "deep" },
              ]}
              settingKey="gameSimulationDetail"
              description="Level of detail in game simulations"
            />
            {renderNumberInput(
              "Retirement Age",
              settings.retirementAge,
              "retirementAge",
              30,
              45,
              "Average age when players retire"
            )}
            {renderNumberInput(
              "Trade Deadline Week",
              settings.tradeDeadlineWeek,
              "tradeDeadlineWeek",
              1,
              82,
              "Week when trade deadline occurs"
            )}
            {renderSlider(
              "Trade Frequency",
              settings.tradeFrequency,
              "tradeFrequency",
              "How often AI teams make trades (1=rare, 5=frequent)"
            )}
            {renderSlider(
              "Chemistry & Morale Impact",
              settings.chemistryMoraleImpact,
              "chemistryMoraleImpact",
              "How much team chemistry affects performance"
            )}
          </View>
        </View>

        {/* Section 8: Player Generation */}
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-4">
            <Ionicons name="person-add" size={24} color="#60A5FA" />
            <Text className="text-white text-xl font-bold">Player Generation</Text>
          </View>
          <View className="bg-gray-800 rounded-xl p-4">
            <PickerComponent
              label="Skill Variance"
              value={settings.playerSkillVariance}
              options={[
                { label: "Low", value: "low" },
                { label: "Medium", value: "medium" },
                { label: "High", value: "high" },
              ]}
              settingKey="playerSkillVariance"
              description="How much variation in player attributes"
            />
            <PickerComponent
              label="Superstar Frequency"
              value={settings.superstarFrequency}
              options={[
                { label: "Rare", value: "rare" },
                { label: "Normal", value: "normal" },
                { label: "Common", value: "common" },
              ]}
              settingKey="superstarFrequency"
              description="How often elite players (85+ OVR) appear"
            />
            {renderNumberInput(
              "International Players %",
              settings.internationalPlayerPercentage,
              "internationalPlayerPercentage",
              0,
              100,
              "Percentage of players from outside USA",
              5
            )}
          </View>
        </View>

        {/* Section 9: Gender Options */}
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-4">
            <Ionicons name="body" size={24} color="#60A5FA" />
            <Text className="text-white text-xl font-bold">Gender Options</Text>
          </View>
          <View className="bg-gray-800 rounded-xl p-4">
            <PickerComponent
              label="Player Gender"
              value={settings.playerGender}
              options={[
                { label: "Male", value: "male" },
                { label: "Female", value: "female" },
                { label: "Mixed", value: "mixed" },
              ]}
              settingKey="playerGender"
              description="Gender composition of players"
            />
            {settings.playerGender === "mixed" &&
              renderNumberInput(
                "Female Players %",
                settings.playerGenderMixedPercentage || 50,
                "playerGenderMixedPercentage",
                0,
                100,
                "Percentage of female players in the league",
                5
              )}
            <PickerComponent
              label="Coach Gender"
              value={settings.coachGender}
              options={[
                { label: "Male", value: "male" },
                { label: "Female", value: "female" },
                { label: "Mixed", value: "mixed" },
              ]}
              settingKey="coachGender"
              description="Gender composition of coaches"
            />
            <PickerComponent
              label="Owner Gender"
              value={settings.ownerGender}
              options={[
                { label: "Male", value: "male" },
                { label: "Female", value: "female" },
                { label: "Mixed", value: "mixed" },
              ]}
              settingKey="ownerGender"
              description="Gender composition of team owners"
            />
          </View>
        </View>

        {/* Section 10: Expansion Rules */}
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-4">
            <Ionicons name="expand" size={24} color="#60A5FA" />
            <Text className="text-white text-xl font-bold">Expansion Rules</Text>
          </View>
          <View className="bg-gray-800 rounded-xl p-4">
            {renderToggle(
              "Expansion Enabled",
              settings.expansionEnabled,
              "expansionEnabled",
              "Allow expansion teams to join the league"
            )}
            {settings.expansionEnabled &&
              renderNumberInput(
                "Protected Players",
                settings.expansionProtectedPlayers,
                "expansionProtectedPlayers",
                3,
                10,
                "Number of players teams can protect in expansion draft"
              )}
          </View>
        </View>

        {/* Section 11: Presentation & News */}
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-4">
            <Ionicons name="newspaper" size={24} color="#60A5FA" />
            <Text className="text-white text-xl font-bold">
              Presentation & News
            </Text>
          </View>
          <View className="bg-gray-800 rounded-xl p-4">
            {renderSlider(
              "News Feed Volume",
              settings.newsFeedVolume,
              "newsFeedVolume",
              "Amount of news stories generated (1=minimal, 5=lots)"
            )}
            {renderSlider(
              "Rumor Intensity",
              settings.rumorIntensity,
              "rumorIntensity",
              "Frequency of trade rumors and speculation"
            )}
            {renderToggle(
              "Show Award Races",
              settings.showAwardRaces,
              "showAwardRaces",
              "Display MVP and award race panels"
            )}
            {renderToggle(
              "Show Odds Panel",
              settings.showOddsPanel,
              "showOddsPanel",
              "Display championship odds and betting lines"
            )}
            <View className="mt-2">
              <Text className="text-gray-400 text-xs font-semibold mb-3 uppercase tracking-wider">
                Notifications
              </Text>
              {renderToggle(
                "Trade Proposals",
                settings.notifyTradeProposals,
                "notifyTradeProposals"
              )}
              {renderToggle(
                "Contract Expiring",
                settings.notifyContractExpiring,
                "notifyContractExpiring"
              )}
              {renderToggle(
                "Player Milestones",
                settings.notifyPlayerMilestones,
                "notifyPlayerMilestones"
              )}
              {renderToggle(
                "Injuries",
                settings.notifyInjuries,
                "notifyInjuries"
              )}
            </View>
            {renderToggle(
              "Auto-Save",
              settings.autoSaveEnabled,
              "autoSaveEnabled",
              "Automatically save league progress"
            )}
          </View>
        </View>

        {/* Section 12: Accessibility */}
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-4">
            <Ionicons name="accessibility" size={24} color="#60A5FA" />
            <Text className="text-white text-xl font-bold">
              Accessibility
            </Text>
          </View>
          <View className="bg-gray-800 rounded-xl p-4">
            <PickerComponent
              label="Text Size"
              value={settings.textSize}
              options={[
                { label: "Small", value: "small" },
                { label: "Medium", value: "medium" },
                { label: "Large", value: "large" },
              ]}
              settingKey="textSize"
              description="Adjust text size throughout the app"
            />
            {renderToggle(
              "Colorblind-Friendly Mode",
              settings.colorblindMode,
              "colorblindMode",
              "Use colorblind-friendly color schemes"
            )}
            <View className="mt-4 pt-4 border-t border-gray-700">
              <Pressable
                className="bg-red-600 rounded-xl p-4 items-center active:bg-red-700"
                onPress={() => setShowResetModal(true)}
              >
                <View className="flex-row items-center gap-2">
                  <Ionicons name="refresh" size={20} color="white" />
                  <Text className="text-white font-semibold text-base">
                    Reset to Defaults
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>

        <View className="h-24" />
      </ScrollView>

      {/* Reset Confirmation Modal */}
      <Modal visible={showResetModal} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <View className="bg-gray-800 rounded-xl w-full p-6 border border-gray-700">
            <Text className="text-white text-xl font-bold mb-3">
              Reset Settings?
            </Text>
            <Text className="text-gray-400 text-base mb-6">
              This will reset all settings to their default values. This action
              cannot be undone.
            </Text>
            <View className="flex-row gap-3">
              <Pressable
                className="flex-1 bg-gray-700 rounded-xl p-4 items-center active:bg-gray-600"
                onPress={() => setShowResetModal(false)}
              >
                <Text className="text-white font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                className="flex-1 bg-red-600 rounded-xl p-4 items-center active:bg-red-700"
                onPress={handleReset}
              >
                <Text className="text-white font-semibold">Reset</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
