import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useBasketballStore } from "../state/basketballStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS } from "react-native-reanimated";

type Props = NativeStackScreenProps<RootStackParamList, "ContinueLeague">;

export default function ContinueLeagueScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const savedLeagues = useBasketballStore((s) => s.savedLeagues);
  const loadLeague = useBasketballStore((s) => s.loadLeague);
  const deleteLeague = useBasketballStore((s) => s.deleteLeague);
  const renameLeague = useBasketballStore((s) => s.renameLeague);
  const exportLeague = useBasketballStore((s) => s.exportLeague);
  const importLeague = useBasketballStore((s) => s.importLeague);

  const [renamingLeagueId, setRenamingLeagueId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useSharedValue(0);
  const toastTranslateY = useSharedValue(20);

  const showToast = (message: string) => {
    setToastMessage(message);
    toastOpacity.value = withSpring(1);
    toastTranslateY.value = withSpring(0);

    setTimeout(() => {
      toastOpacity.value = withTiming(0, { duration: 300 });
      toastTranslateY.value = withTiming(20, { duration: 300 });
      setTimeout(() => {
        runOnJS(setToastMessage)(null);
      }, 300);
    }, 2500);
  };

  const toastStyle = useAnimatedStyle(() => {
    return {
      opacity: toastOpacity.value,
      transform: [{ translateY: toastTranslateY.value }],
    };
  });

  const handleLoadLeague = (leagueId: string) => {
    loadLeague(leagueId);
    navigation.replace("Dashboard");
  };

  const handleDeleteLeague = (leagueId: string, leagueName: string) => {
    // Show custom confirmation modal
    Alert.alert(
      "Delete League",
      `Are you sure you want to delete "${leagueName}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteLeague(leagueId),
        },
      ]
    );
  };

  const handleRenameLeague = (leagueId: string) => {
    if (newName.trim()) {
      renameLeague(leagueId, newName.trim());
      setRenamingLeagueId(null);
      setNewName("");
    }
  };

  const handleExportLeague = async (leagueId: string) => {
    const league = exportLeague(leagueId);
    if (!league) return;

    try {
      // Create a comprehensive export with all league data
      const exportData = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        league: {
          id: league.id,
          name: league.name,
          createdAt: league.createdAt,
          lastPlayedAt: league.lastPlayedAt,
        },
        season: league.season,
        teams: league.teams,
        players: league.players,
        coaches: league.coaches,
        agents: league.agents,
        rotations: league.rotations,
        gmCoachRelationships: league.gmCoachRelationships,
        gmActions: league.gmActions,
        history: league.history,
        newsFeed: league.newsFeed,
        awardRaces: league.awardRaces,
        teamOdds: league.teamOdds,
        headlines: league.headlines,
        userTeamId: league.userTeamId,
        hasSeenWelcome: league.hasSeenWelcome,
      };

      const leagueJson = JSON.stringify(exportData, null, 2);

      // Create file in cache directory
      const fileName = `${league.name.replace(/\s+/g, "_")}_export.json`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      // Write JSON to file
      await FileSystem.writeAsStringAsync(fileUri, leagueJson, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert("Error", "Sharing is not available on this device");
        return;
      }

      // Share the file
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/json",
        dialogTitle: `Export ${league.name}`,
        UTI: "public.json",
      });

      // Show success toast
      showToast("League exported successfully.");
    } catch (error) {
      console.error("Error exporting league:", error);
      Alert.alert("Export Failed", "There was an error exporting your league. Please try again.");
    }
  };

  const handleImportLeague = async () => {
    try {
      // Open document picker to select JSON file
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      if (!file) {
        Alert.alert("Import Failed", "No file selected.");
        return;
      }

      // Read the file contents
      const fileContent = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Parse JSON
      let leagueData;
      try {
        leagueData = JSON.parse(fileContent);
      } catch (parseError) {
        Alert.alert("Import Failed", "Invalid JSON file format. Please select a valid league export file.");
        return;
      }

      // Import the league
      const importResult = importLeague(leagueData);

      if (importResult.success) {
        showToast("League imported successfully.");
      } else {
        Alert.alert("Import Failed", importResult.error || "Failed to import league data.");
      }
    } catch (error) {
      console.error("Error importing league:", error);
      Alert.alert("Import Failed", "There was an error importing your league. Please try again.");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const sortedLeagues = [...savedLeagues].sort(
    (a, b) => new Date(b.lastPlayedAt).getTime() - new Date(a.lastPlayedAt).getTime()
  );

  return (
    <View className="flex-1 bg-gray-950" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-6 py-6 flex-row items-center justify-between border-b border-gray-800">
        <Pressable
          onPress={() => navigation.goBack()}
          className="flex-row items-center gap-2"
        >
          <Ionicons name="arrow-back" size={24} color="#60A5FA" />
          <Text className="text-blue-400 text-lg">Back</Text>
        </Pressable>
        <Text className="text-white text-2xl font-bold">My Leagues</Text>
        <Pressable
          onPress={handleImportLeague}
          className="bg-blue-600 px-4 py-2 rounded-lg active:bg-blue-700"
        >
          <View className="flex-row items-center gap-1">
            <Ionicons name="download-outline" size={18} color="white" />
            <Text className="text-white text-sm font-semibold">Import</Text>
          </View>
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-6 pt-4">
        {sortedLeagues.length === 0 ? (
          <View className="items-center justify-center py-20">
            <Ionicons name="folder-open-outline" size={80} color="#4B5563" />
            <Text className="text-gray-400 text-xl mt-6">No saved leagues</Text>
            <Text className="text-gray-500 text-base mt-2 text-center">
              Create a new league to get started
            </Text>
          </View>
        ) : (
          sortedLeagues.map((league) => {
            const userTeam = league.teams.find((t) => t.id === league.userTeamId);
            const isRenaming = renamingLeagueId === league.id;

            return (
              <View
                key={league.id}
                className="mb-4 bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden"
              >
                {/* Main League Info */}
                <Pressable
                  onPress={() => handleLoadLeague(league.id)}
                  className="p-5 active:bg-gray-750"
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-1">
                      {isRenaming ? (
                        <View className="flex-row items-center gap-2">
                          <TextInput
                            value={newName}
                            onChangeText={setNewName}
                            placeholder={league.name}
                            placeholderTextColor="#6B7280"
                            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-lg"
                            autoFocus
                            maxLength={30}
                          />
                          <Pressable
                            onPress={() => handleRenameLeague(league.id)}
                            className="bg-blue-600 rounded-lg p-2"
                          >
                            <Ionicons name="checkmark" size={20} color="white" />
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              setRenamingLeagueId(null);
                              setNewName("");
                            }}
                            className="bg-gray-600 rounded-lg p-2"
                          >
                            <Ionicons name="close" size={20} color="white" />
                          </Pressable>
                        </View>
                      ) : (
                        <Text className="text-white text-2xl font-bold">
                          {league.name}
                        </Text>
                      )}
                    </View>
                  </View>

                  {!isRenaming && (
                    <>
                      <View className="flex-row items-center gap-4 mb-2">
                        <View className="flex-row items-center gap-2">
                          <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
                          <Text className="text-gray-400 text-sm">
                            Season {league.season.year}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-2">
                          <Ionicons name="time-outline" size={16} color="#9CA3AF" />
                          <Text className="text-gray-400 text-sm">
                            Week {league.season.currentWeek}
                          </Text>
                        </View>
                      </View>

                      {userTeam && (
                        <View className="flex-row items-center gap-2 mb-2">
                          <Ionicons name="basketball-outline" size={16} color="#60A5FA" />
                          <Text className="text-blue-400 text-sm font-semibold">
                            {userTeam.city} {userTeam.name}
                          </Text>
                          <Text className="text-gray-500 text-sm">
                            ({userTeam.wins}-{userTeam.losses})
                          </Text>
                        </View>
                      )}

                      <Text className="text-gray-500 text-xs">
                        Last played: {formatDate(league.lastPlayedAt)}
                      </Text>
                    </>
                  )}
                </Pressable>

                {/* Action Buttons */}
                {!isRenaming && (
                  <View className="flex-row border-t border-gray-700">
                    <Pressable
                      onPress={() => {
                        setRenamingLeagueId(league.id);
                        setNewName(league.name);
                      }}
                      className="flex-1 py-3 items-center border-r border-gray-700 active:bg-gray-700"
                    >
                      <Ionicons name="pencil-outline" size={20} color="#60A5FA" />
                      <Text className="text-blue-400 text-xs mt-1">Rename</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleExportLeague(league.id)}
                      className="flex-1 py-3 items-center border-r border-gray-700 active:bg-gray-700"
                    >
                      <Ionicons name="share-outline" size={20} color="#10B981" />
                      <Text className="text-green-400 text-xs mt-1">Export</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleDeleteLeague(league.id, league.name)}
                      className="flex-1 py-3 items-center active:bg-gray-700"
                    >
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                      <Text className="text-red-400 text-xs mt-1">Delete</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })
        )}

        {/* Spacer for bottom */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Toast Notification */}
      {toastMessage && (
        <Animated.View
          style={[
            toastStyle,
            {
              position: "absolute",
              bottom: insets.bottom + 20,
              left: 20,
              right: 20,
              backgroundColor: "#10B981",
              borderRadius: 12,
              paddingVertical: 14,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={22} color="white" />
          <Text
            style={{
              color: "white",
              fontSize: 15,
              fontWeight: "600",
              marginLeft: 10,
            }}
          >
            {toastMessage}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}
