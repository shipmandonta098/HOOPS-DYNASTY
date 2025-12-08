import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useBasketballStore } from "../state/basketballStore";
import { getLotteryOddsDisplay } from "../utils/draft";

export default function DraftScreen() {
  const insets = useSafeAreaInsets();
  const [showAllProspects, setShowAllProspects] = useState(false);

  const teams = useBasketballStore((s) => s.teams);
  const userTeamId = useBasketballStore((s) => s.userTeamId);
  const season = useBasketballStore((s) => s.season);
  const initializeDraftLottery = useBasketballStore((s) => s.initializeDraftLottery);
  const executeDraftLottery = useBasketballStore((s) => s.executeDraftLottery);
  const draftPlayer = useBasketballStore((s) => s.draftPlayer);

  const userTeam = teams.find((t) => t.id === userTeamId);

  // Get user team's lottery position
  const userTeamRank = useMemo(() => {
    const sorted = [...teams].sort((a, b) => {
      if (a.wins !== b.wins) return a.wins - b.wins;
      return b.losses - a.losses;
    });
    return sorted.findIndex((t) => t.id === userTeamId) + 1;
  }, [teams, userTeamId]);

  const lotteryDisplay = getLotteryOddsDisplay(userTeamRank);

  // Get user's draft pick after lottery
  const userDraftPick = useMemo(() => {
    if (!season.draftLottery?.results) return userTeamRank;
    const result = season.draftLottery.results.find((r) => r.teamId === userTeamId);
    return result?.draftPosition || userTeamRank;
  }, [season.draftLottery, userTeamId, userTeamRank]);

  const isOnTheClock = useMemo(() => {
    if (!season.upcomingDraft) return false;
    if (season.upcomingDraft.completed) return false;
    if (!season.draftLottery?.results) return false;

    const currentPickTeam = season.draftLottery.results.find(
      (r) => r.draftPosition === season.upcomingDraft!.currentPick + 1
    );
    return currentPickTeam?.teamId === userTeamId;
  }, [season, userTeamId]);

  // Available prospects (not yet drafted)
  const availableProspects = useMemo(() => {
    if (!season.upcomingDraft) return [];
    return season.upcomingDraft.prospects.filter((p) => !p.draftedBy);
  }, [season.upcomingDraft]);

  const handleInitializeLottery = () => {
    initializeDraftLottery();
  };

  const handleExecuteLottery = () => {
    executeDraftLottery();
  };

  const handleDraft = (prospectId: string) => {
    if (!isOnTheClock) return;
    draftPlayer(prospectId, userTeamId);
  };

  const renderLotterySection = () => (
    <View className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-lg border-2 border-blue-500 p-4 mb-4">
      <Text className="text-white text-xl font-bold mb-3">🎰 Draft Lottery Odds</Text>

      <View className="flex-row items-center justify-between mb-4 p-4 bg-black/30 rounded-lg border border-blue-400">
        <View>
          <Text className="text-blue-300 text-sm font-semibold">Your Current Position</Text>
          <Text className="text-white text-4xl font-bold">#{userTeamRank}</Text>
          <Text className="text-gray-300 text-xs mt-1">{userTeam?.wins}-{userTeam?.losses}</Text>
        </View>
        <View className="items-end">
          <Text className="text-5xl mb-1">{lotteryDisplay.arrows}</Text>
          <Text className="text-blue-300 text-xs text-right font-semibold">{lotteryDisplay.description}</Text>
        </View>
      </View>

      {!season.draftLottery && (
        <Pressable
          className="bg-blue-600 rounded-lg p-4 active:bg-blue-700"
          onPress={handleInitializeLottery}
        >
          <Text className="text-white font-semibold text-center">
            Initialize Draft Lottery
          </Text>
        </Pressable>
      )}

      {season.draftLottery && !season.draftLottery.executed && (
        <Pressable
          className="bg-green-600 rounded-lg p-4 active:bg-green-700"
          onPress={handleExecuteLottery}
        >
          <Text className="text-white font-semibold text-center">
            Execute Lottery Drawing
          </Text>
        </Pressable>
      )}

      {season.draftLottery?.executed && season.draftLottery.results && (
        <View>
          <View className="flex-row items-center justify-between p-4 bg-green-900/30 rounded-lg border border-green-700 mb-3">
            <Text className="text-white font-semibold">Your Draft Position:</Text>
            <Text className="text-green-400 text-2xl font-bold">#{userDraftPick}</Text>
          </View>

          <Text className="text-gray-400 text-xs mb-2">Top 5 Lottery Results:</Text>
          {season.draftLottery.results.slice(0, 5).map((result) => {
            const team = teams.find((t) => t.id === result.teamId);
            const isUser = result.teamId === userTeamId;
            return (
              <View
                key={result.teamId}
                className={`flex-row justify-between py-2 px-3 ${
                  isUser ? "bg-blue-950/30" : ""
                }`}
              >
                <Text className={isUser ? "text-blue-400" : "text-gray-300"}>
                  #{result.draftPosition} {team?.city} {team?.name}
                </Text>
                {result.movedUp && (
                  <Text className="text-green-400 text-xs">
                    ⬆️ +{result.originalPick - result.draftPosition}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );

  const renderDraftBoard = () => {
    if (!season.upcomingDraft) return null;

    const isDraftPhase = season.phase === "draft";
    const showPickProgress = isDraftPhase && !season.upcomingDraft.completed;

    // Determine how many prospects to display
    const displayLimit = showAllProspects ? availableProspects.length : 30;
    const prospectsToShow = availableProspects.slice(0, displayLimit);
    const totalProspects = availableProspects.length;

    return (
      <View className="bg-gray-900 rounded-lg border border-gray-800 p-4">
        <View className="flex-row justify-between items-center mb-3">
          <View>
            <Text className="text-white text-lg font-bold">
              {season.upcomingDraft.year} Draft Class
            </Text>
            <Text className="text-gray-400 text-xs mt-1">
              {totalProspects} prospects available • Showing top {displayLimit}
            </Text>
          </View>
          {showPickProgress && (
            <Text className="text-gray-400 text-sm">
              Pick {season.upcomingDraft.currentPick + 1}/100
            </Text>
          )}
        </View>

        {!isDraftPhase && (
          <View className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 mb-3">
            <Text className="text-blue-400 text-sm text-center">
              Scouting prospects for the upcoming draft
            </Text>
          </View>
        )}

        {isOnTheClock && (
          <View className="bg-green-900/30 border border-green-700 rounded-lg p-3 mb-3">
            <Text className="text-green-400 font-bold text-center">
              🔔 YOU ARE ON THE CLOCK!
            </Text>
            <Text className="text-gray-300 text-sm text-center mt-1">
              Select a prospect to draft
            </Text>
          </View>
        )}

        <ScrollView className="max-h-96" showsVerticalScrollIndicator={false}>
          {prospectsToShow.map((prospect, index) => (
            <Pressable
              key={prospect.id}
              className={`border-b border-gray-800 py-3 ${
                isOnTheClock ? "active:bg-gray-800" : ""
              }`}
              onPress={() => isOnTheClock && handleDraft(prospect.id)}
              disabled={!isOnTheClock}
            >
              <View className="flex-row items-start">
                <View className="w-10">
                  <Text className="text-gray-500 font-bold">{index + 1}</Text>
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center mb-1">
                    <Text className="text-white font-semibold">{prospect.name}</Text>
                    <Text className="text-gray-500 text-xs ml-2">{prospect.position}</Text>
                    <Text className="text-gray-500 text-xs ml-2">{prospect.bio.countryFlag}</Text>
                  </View>
                  <Text className="text-gray-400 text-xs mb-1">
                    {prospect.bio.college} • {prospect.bio.height} • {prospect.bio.weight} lbs
                  </Text>
                  <View className="flex-row items-center mb-2">
                    <View className="bg-blue-600/20 px-2 py-1 rounded mr-2">
                      <Text className="text-blue-400 text-xs font-bold">
                        OVR: {prospect.overall}
                      </Text>
                    </View>
                    <View className="bg-purple-600/20 px-2 py-1 rounded">
                      <Text className="text-purple-400 text-xs font-bold">
                        POT: {prospect.potential}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-gray-500 text-xs italic">
                    {prospect.scoutingReport}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        {!showAllProspects && totalProspects > 30 && (
          <Pressable
            className="bg-gray-800 rounded-lg p-3 mt-3 active:bg-gray-700"
            onPress={() => setShowAllProspects(true)}
          >
            <Text className="text-blue-400 font-semibold text-center">
              View Full Draft Class ({totalProspects - 30} more prospects)
            </Text>
          </Pressable>
        )}

        {showAllProspects && (
          <Pressable
            className="bg-gray-800 rounded-lg p-3 mt-3 active:bg-gray-700"
            onPress={() => setShowAllProspects(false)}
          >
            <Text className="text-blue-400 font-semibold text-center">
              Show Top 30 Only
            </Text>
          </Pressable>
        )}

        {season.upcomingDraft.completed && (
          <View className="bg-green-900/30 border border-green-700 rounded-lg p-4 mt-3">
            <Text className="text-green-400 font-bold text-center">
              Draft Completed!
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gray-950">
      {/* Header */}
      <View
        className="bg-gray-900 border-b border-gray-800"
        style={{ paddingTop: insets.top + 60 }}
      >
        <View className="px-6 pb-4">
          <Text className="text-white text-2xl font-bold">Draft</Text>
          <Text className="text-gray-400 text-sm mt-1">
            {userTeam?.city} {userTeam?.name}
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <View className="px-4 py-4">
          {/* Always show lottery odds */}
          {renderLotterySection()}

          {/* Always show draft board if draft class exists */}
          {renderDraftBoard()}

          {/* Show message if no draft class exists yet */}
          {!season.upcomingDraft && (
            <View className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <Text className="text-white text-lg font-bold mb-2">No Draft Class Available</Text>
              <Text className="text-gray-400">
                Draft class will be generated automatically. If you are seeing this, there may be an issue with your league.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
