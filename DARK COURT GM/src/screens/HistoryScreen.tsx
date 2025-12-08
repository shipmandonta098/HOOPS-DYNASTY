import React, { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useBasketballStore } from "../state/basketballStore";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SeasonSummary, Transaction, NewsStory } from "../types/basketball";
import {
  getRivalryBetweenTeams,
  getRivalryDisplayText,
  getRivalryTextColor,
  getRivalryColor,
} from "../utils/rivalry";
import { getCategoryIcon, getCategoryColor, getCategoryLabel } from "../utils/newsGenerator";

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const history = useBasketballStore((s) => s.history);
  const userTeamId = useBasketballStore((s) => s.userTeamId);
  const teams = useBasketballStore((s) => s.teams);
  const players = useBasketballStore((s) => s.players);
  const season = useBasketballStore((s) => s.season);
  const newsFeed = useBasketballStore((s) => s.newsFeed);
  const rivalries = season.rivalries || [];

  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<"seasons" | "transactions" | "awards" | "records" | "career" | "rivalries" | "news">("seasons");

  const userTeam = teams.find((t) => t.id === userTeamId);

  const toggleSeason = (season: number) => {
    const newExpanded = new Set(expandedSeasons);
    if (newExpanded.has(season)) {
      newExpanded.delete(season);
    } else {
      newExpanded.add(season);
    }
    setExpandedSeasons(newExpanded);
  };

  const getTransactionDescription = (transaction: Transaction): string => {
    if (transaction.description) return transaction.description;

    switch (transaction.type) {
      case "trade":
        const teamA = teams.find((t) => t.id === transaction.teamAId);
        const teamB = teams.find((t) => t.id === transaction.teamBId);
        return `Trade between ${teamA?.name || "Unknown"} and ${teamB?.name || "Unknown"}`;
      case "free_agent_signing":
        const player = players.find((p) => p.id === transaction.playerId);
        const team = teams.find((t) => t.id === transaction.teamId);
        return `${player?.name || "Unknown"} signed with ${team?.name || "Unknown"} (${transaction.contractYears}yr, $${transaction.contractSalary}M)`;
      case "draft_pick":
        return `Drafted ${transaction.playerId}`;
      case "waiver":
      case "release":
        return `Released ${transaction.playerId}`;
      case "contract_extension":
        return `Extended ${transaction.playerId} (${transaction.contractYears}yr, $${transaction.contractSalary}M)`;
      default:
        return "Transaction";
    }
  };

  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const getTransactionIcon = (type: Transaction["type"]) => {
    switch (type) {
      case "trade":
        return "swap-horizontal";
      case "free_agent_signing":
        return "person-add";
      case "draft_pick":
        return "school";
      case "waiver":
      case "release":
        return "remove-circle";
      case "contract_extension":
        return "document-text";
      case "coach_hire":
        return "person";
      case "coach_fire":
        return "close-circle";
      default:
        return "document";
    }
  };

  const renderSeasonCard = (summary: SeasonSummary, index: number) => {
    const isExpanded = expandedSeasons.has(summary.season);

    return (
      <View key={index} className="mb-3">
        <Pressable
          onPress={() => toggleSeason(summary.season)}
          className="bg-gray-800 rounded-lg border border-gray-700 active:bg-gray-750"
        >
          <View className="p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-white font-bold text-lg mb-1">
                  {summary.season} Season
                </Text>
                <Text className="text-gray-400 text-sm">
                  {summary.finalRecord.wins}-{summary.finalRecord.losses} (
                  {(summary.finalRecord.winPercentage * 100).toFixed(1)}%)
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-gray-400 text-sm mb-1">{summary.playoffResult}</Text>
                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={24}
                  color="#9CA3AF"
                />
              </View>
            </View>

            {isExpanded && (
              <View className="mt-4 pt-4 border-t border-gray-700">
                {/* Team Rankings */}
                <View className="mb-4">
                  <Text className="text-gray-300 font-semibold mb-2">Rankings</Text>
                  <View className="flex-row justify-between">
                    <View className="flex-1">
                      <Text className="text-gray-400 text-xs mb-1">Overall</Text>
                      <Text className="text-white font-bold">#{summary.rankings.overallRank}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-gray-400 text-xs mb-1">Offense</Text>
                      <Text className="text-white font-bold">#{summary.rankings.offensiveRank}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-gray-400 text-xs mb-1">Defense</Text>
                      <Text className="text-white font-bold">#{summary.rankings.defensiveRank}</Text>
                    </View>
                  </View>
                </View>

                {/* Team Rating */}
                <View className="mb-4">
                  <Text className="text-gray-300 font-semibold mb-2">Team Rating</Text>
                  <View className="flex-row justify-between">
                    <View>
                      <Text className="text-gray-400 text-xs mb-1">Start</Text>
                      <Text className="text-white font-bold">
                        {summary.teamRating.startOfSeason.toFixed(0)}
                      </Text>
                    </View>
                    <View>
                      <Text className="text-gray-400 text-xs mb-1">End</Text>
                      <Text className="text-white font-bold">
                        {summary.teamRating.endOfSeason.toFixed(0)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Head Coach */}
                <View className="mb-4">
                  <Text className="text-gray-300 font-semibold mb-2">Head Coach</Text>
                  <Text className="text-white">{summary.headCoach.name}</Text>
                  <Text className="text-gray-400 text-sm">
                    Overall: {summary.headCoach.overall}
                  </Text>
                </View>

                {/* Top Players */}
                <View>
                  <Text className="text-gray-300 font-semibold mb-2">Top 3 Players</Text>
                  {summary.topPlayers.map((player, idx) => (
                    <View key={idx} className="flex-row justify-between mb-2">
                      <Text className="text-white">
                        {player.name} ({player.position})
                      </Text>
                      <Text className="text-blue-400 font-bold">{player.overall}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        </Pressable>
      </View>
    );
  };

  const renderTransactionItem = (transaction: Transaction, index: number) => {
    return (
      <View key={index} className="bg-gray-800 rounded-lg p-4 mb-3 border border-gray-700">
        <View className="flex-row items-start">
          <View className="bg-gray-700 rounded-full p-2 mr-3">
            <Ionicons name={getTransactionIcon(transaction.type)} size={20} color="#60A5FA" />
          </View>
          <View className="flex-1">
            <Text className="text-white font-semibold mb-1">
              {getTransactionDescription(transaction)}
            </Text>
            <Text className="text-gray-400 text-sm">
              {formatDate(transaction.timestamp)} • Season {transaction.season}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderCareerStats = () => {
    const stats = history.gmCareerStats;
    return (
      <View className="p-4">
        {/* Overview Cards */}
        <View className="flex-row mb-4">
          <View className="flex-1 bg-gray-800 rounded-lg p-4 mr-2 border border-gray-700">
            <Text className="text-gray-400 text-sm mb-1">Seasons</Text>
            <Text className="text-white font-bold text-2xl">{stats.totalSeasons}</Text>
          </View>
          <View className="flex-1 bg-gray-800 rounded-lg p-4 ml-2 border border-gray-700">
            <Text className="text-gray-400 text-sm mb-1">Championships</Text>
            <Text className="text-yellow-400 font-bold text-2xl">{stats.championships}</Text>
          </View>
        </View>

        {/* Win/Loss Record */}
        <View className="bg-gray-800 rounded-lg p-4 mb-4 border border-gray-700">
          <Text className="text-gray-300 font-semibold mb-3">Career Record</Text>
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-400">Wins</Text>
            <Text className="text-green-400 font-bold">{stats.lifetimeWins}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-400">Losses</Text>
            <Text className="text-red-400 font-bold">{stats.lifetimeLosses}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-gray-400">Win %</Text>
            <Text className="text-white font-bold">
              {(stats.winPercentage * 100).toFixed(1)}%
            </Text>
          </View>
        </View>

        {/* Activity Stats */}
        <View className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <Text className="text-gray-300 font-semibold mb-3">Activity</Text>
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-400">Playoff Appearances</Text>
            <Text className="text-white font-bold">{stats.playoffAppearances}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-400">Total Trades</Text>
            <Text className="text-white font-bold">{stats.totalTrades}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-400">Free Agent Signs</Text>
            <Text className="text-white font-bold">{stats.totalFreeAgentSigns}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-gray-400">Draft Picks</Text>
            <Text className="text-white font-bold">{stats.totalDraftPicks}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderRivalries = () => {
    if (!userTeam) return null;

    // Get all rivalries involving the user's team
    const userRivalries = rivalries
      .filter((r) => r.teamAId === userTeamId || r.teamBId === userTeamId)
      .map((r) => {
        const opponentId = r.teamAId === userTeamId ? r.teamBId : r.teamAId;
        const opponent = teams.find((t) => t.id === opponentId);
        return { ...r, opponent };
      })
      .filter((r) => r.opponent)
      .sort((a, b) => b.points - a.points); // Sort by rivalry intensity

    // Top 3 rivalries
    const topRivalries = userRivalries.slice(0, 3);

    // Calculate head-to-head record
    const getHeadToHead = (opponentId: string) => {
      const games = season.games.filter(
        (g) =>
          g.played &&
          ((g.homeTeamId === userTeamId && g.awayTeamId === opponentId) ||
            (g.awayTeamId === userTeamId && g.homeTeamId === opponentId))
      );

      const wins = games.filter((g) => {
        const userIsHome = g.homeTeamId === userTeamId;
        const userScore = userIsHome ? g.homeScore : g.awayScore;
        const oppScore = userIsHome ? g.awayScore : g.homeScore;
        return userScore > oppScore;
      }).length;

      const losses = games.length - wins;
      return { wins, losses, total: games.length };
    };

    if (userRivalries.length === 0) {
      return (
        <View className="flex-1 items-center justify-center p-8">
          <Ionicons name="flame-outline" size={64} color="#4B5563" />
          <Text className="text-gray-400 text-center mt-4 text-base">
            No rivalries yet. Play games and make trades to develop rivalries with other teams.
          </Text>
        </View>
      );
    }

    return (
      <ScrollView className="flex-1 p-4">
        {/* Top 3 Rivalries */}
        <Text className="text-white font-bold text-xl mb-4">Top Current Rivals</Text>

        {topRivalries.map((rivalry, index) => {
          const record = getHeadToHead(rivalry.opponent!.id);
          const winPct = record.total > 0 ? (record.wins / record.total) * 100 : 0;

          return (
            <View
              key={rivalry.opponent!.id}
              className="bg-gray-800 rounded-lg p-4 mb-3 border border-gray-700"
            >
              {/* Rank Badge */}
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center flex-1">
                  <View
                    className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
                      index === 0 ? "bg-yellow-600" : index === 1 ? "bg-gray-500" : "bg-amber-700"
                    }`}
                  >
                    <Text className="text-white font-bold">{index + 1}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-bold text-lg">
                      {rivalry.opponent!.logo} {rivalry.opponent!.city} {rivalry.opponent!.name}
                    </Text>
                    <Text className="text-gray-400 text-sm">
                      {rivalry.opponent!.wins}-{rivalry.opponent!.losses}
                    </Text>
                  </View>
                </View>
                <View className="items-end">
                  <View className={`px-3 py-1 rounded-full ${getRivalryColor(rivalry.level)}`}>
                    <Text className="text-white font-bold text-xs">
                      {getRivalryDisplayText(rivalry.level).toUpperCase()}
                    </Text>
                  </View>
                  <Text className="text-gray-400 text-xs mt-1">{rivalry.points}/100</Text>
                </View>
              </View>

              {/* Head-to-Head Record */}
              <View className="bg-gray-900 rounded-lg p-3 mb-3">
                <Text className="text-gray-300 font-semibold mb-2 text-sm">
                  Lifetime Record vs {rivalry.opponent!.city}
                </Text>
                <View className="flex-row justify-between items-center">
                  <Text className="text-white font-bold text-lg">
                    {record.wins}-{record.losses}
                  </Text>
                  <Text
                    className={`font-bold ${
                      winPct > 50 ? "text-green-400" : winPct < 50 ? "text-red-400" : "text-gray-400"
                    }`}
                  >
                    {winPct.toFixed(0)}% Win Rate
                  </Text>
                </View>
              </View>

              {/* Rivalry Factors */}
              <View className="bg-gray-900 rounded-lg p-3">
                <Text className="text-gray-300 font-semibold mb-2 text-sm">Rivalry Factors</Text>
                <View className="flex-row flex-wrap">
                  {rivalry.factors.closeGames > 0 && (
                    <View className="bg-gray-800 px-2 py-1 rounded mr-2 mb-2">
                      <Text className="text-gray-300 text-xs">
                        🔥 {rivalry.factors.closeGames} close game{rivalry.factors.closeGames > 1 ? "s" : ""}
                      </Text>
                    </View>
                  )}
                  {rivalry.factors.playoffMeetings > 0 && (
                    <View className="bg-purple-900 px-2 py-1 rounded mr-2 mb-2">
                      <Text className="text-white text-xs">
                        🏆 {rivalry.factors.playoffMeetings} playoff series
                      </Text>
                    </View>
                  )}
                  {rivalry.factors.trades > 0 && (
                    <View className="bg-blue-900 px-2 py-1 rounded mr-2 mb-2">
                      <Text className="text-white text-xs">
                        🔄 {rivalry.factors.trades} trade{rivalry.factors.trades > 1 ? "s" : ""}
                      </Text>
                    </View>
                  )}
                  {rivalry.factors.physicalGames > 0 && (
                    <View className="bg-red-900 px-2 py-1 rounded mr-2 mb-2">
                      <Text className="text-white text-xs">
                        💥 {rivalry.factors.physicalGames} physical game{rivalry.factors.physicalGames > 1 ? "s" : ""}
                      </Text>
                    </View>
                  )}
                  {rivalry.factors.bigPerformances > 0 && (
                    <View className="bg-orange-900 px-2 py-1 rounded mr-2 mb-2">
                      <Text className="text-white text-xs">
                        ⭐ {rivalry.factors.bigPerformances} 50+ pt game{rivalry.factors.bigPerformances > 1 ? "s" : ""}
                      </Text>
                    </View>
                  )}
                </View>
                {rivalry.factors.closeGames === 0 &&
                  rivalry.factors.playoffMeetings === 0 &&
                  rivalry.factors.trades === 0 &&
                  rivalry.factors.physicalGames === 0 &&
                  rivalry.factors.bigPerformances === 0 && (
                    <Text className="text-gray-500 text-xs italic">No significant moments yet</Text>
                  )}
              </View>
            </View>
          );
        })}

        {/* All Other Rivalries */}
        {userRivalries.length > 3 && (
          <>
            <Text className="text-white font-bold text-xl mb-4 mt-6">Other Rivalries</Text>
            {userRivalries.slice(3).map((rivalry) => {
              const record = getHeadToHead(rivalry.opponent!.id);
              return (
                <View
                  key={rivalry.opponent!.id}
                  className="bg-gray-800 rounded-lg p-4 mb-3 border border-gray-700"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-white font-semibold">
                        {rivalry.opponent!.logo} {rivalry.opponent!.city} {rivalry.opponent!.name}
                      </Text>
                      <Text className="text-gray-400 text-sm mt-1">
                        {record.wins}-{record.losses} ({getRivalryDisplayText(rivalry.level)})
                      </Text>
                    </View>
                    <View className="items-end">
                      <View className={`px-2 py-1 rounded ${getRivalryColor(rivalry.level)}`}>
                        <Text className="text-white text-xs font-bold">{rivalry.points}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    );
  };

  const renderNewsArchive = () => {
    // Get all news stories sorted by season and timestamp
    const archivedStories = [...newsFeed.stories]
      .filter((story: NewsStory) => story.season < season.year)
      .sort((a: NewsStory, b: NewsStory) => {
        // Sort by season first (most recent first), then by timestamp
        if (a.season !== b.season) return b.season - a.season;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

    if (archivedStories.length === 0) {
      return (
        <View className="flex-1 items-center justify-center p-8">
          <Ionicons name="newspaper-outline" size={64} color="#4B5563" />
          <Text className="text-gray-400 text-center mt-4 text-base">
            No archived news yet. Stories from completed seasons will appear here.
          </Text>
        </View>
      );
    }

    // Group stories by season
    const storiesBySeason = archivedStories.reduce((acc: any, story: NewsStory) => {
      if (!acc[story.season]) {
        acc[story.season] = [];
      }
      acc[story.season].push(story);
      return {};
    }, {});

    const seasons = Object.keys(storiesBySeason).sort((a: any, b: any) => b - a);

    return (
      <ScrollView className="flex-1 p-4">
        {archivedStories.map((story: NewsStory) => (
          <View key={story.id} className="bg-gray-800 rounded-lg border border-gray-700 p-4 mb-3">
            <View className="flex-row items-start">
              <View className={`${getCategoryColor(story.category)} rounded-full p-2 mr-3`}>
                <Ionicons
                  name={getCategoryIcon(story.category) as any}
                  size={20}
                  color="white"
                />
              </View>

              <View className="flex-1">
                <View className="flex-row items-center mb-2">
                  <View className={`${getCategoryColor(story.category)} px-2 py-1 rounded mr-2`}>
                    <Text className="text-white font-bold text-xs">
                      {getCategoryLabel(story.category).toUpperCase()}
                    </Text>
                  </View>
                  <Text className="text-gray-400 text-xs">Season {story.season}</Text>
                </View>

                <Text className="text-white font-bold text-base mb-1">{story.headline}</Text>
                <Text className="text-gray-300 text-sm">{story.description}</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case "seasons":
        if (history.seasonSummaries.length === 0) {
          return (
            <View className="flex-1 items-center justify-center p-8">
              <Ionicons name="calendar-outline" size={64} color="#4B5563" />
              <Text className="text-gray-400 text-center mt-4 text-base">
                No completed seasons yet. Complete a season to view history.
              </Text>
            </View>
          );
        }
        return (
          <ScrollView className="flex-1 p-4">
            {history.seasonSummaries
              .slice()
              .reverse()
              .map((summary, index) => renderSeasonCard(summary, index))}
          </ScrollView>
        );

      case "transactions":
        if (history.transactions.length === 0) {
          return (
            <View className="flex-1 items-center justify-center p-8">
              <Ionicons name="swap-horizontal-outline" size={64} color="#4B5563" />
              <Text className="text-gray-400 text-center mt-4 text-base">
                No transactions yet. Make trades and sign players to build your history.
              </Text>
            </View>
          );
        }
        return (
          <ScrollView className="flex-1 p-4">
            {history.transactions
              .slice()
              .reverse()
              .map((transaction, index) => renderTransactionItem(transaction, index))}
          </ScrollView>
        );

      case "awards":
        return (
          <View className="flex-1 items-center justify-center p-8">
            <Ionicons name="trophy-outline" size={64} color="#4B5563" />
            <Text className="text-gray-400 text-center mt-4 text-base">
              Awards system coming soon. Track MVP, DPOY, and All-Star selections.
            </Text>
          </View>
        );

      case "records":
        return (
          <View className="flex-1 items-center justify-center p-8">
            <Ionicons name="star-outline" size={64} color="#4B5563" />
            <Text className="text-gray-400 text-center mt-4 text-base">
              Franchise records coming soon. Track all-time team achievements.
            </Text>
          </View>
        );

      case "career":
        return <ScrollView className="flex-1">{renderCareerStats()}</ScrollView>;

      case "rivalries":
        return renderRivalries();

      case "news":
        return renderNewsArchive();

      default:
        return null;
    }
  };

  return (
    <View className="flex-1 bg-gray-950">
      {/* Header */}
      <View
        className="bg-gray-900 border-b border-gray-800 px-4 pb-4"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Text className="text-white font-bold text-2xl mb-1">History</Text>
        <Text className="text-gray-400">
          {userTeam?.city} {userTeam?.name}
        </Text>
      </View>

      {/* Tab Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="bg-gray-900 border-b border-gray-800"
      >
        <View className="flex-row px-2 py-2">
          {[
            { id: "seasons", label: "Seasons", icon: "calendar" },
            { id: "transactions", label: "Transactions", icon: "swap-horizontal" },
            { id: "rivalries", label: "Rivalries", icon: "flame" },
            { id: "news", label: "News Archive", icon: "newspaper" },
            { id: "awards", label: "Awards", icon: "trophy" },
            { id: "records", label: "Records", icon: "star" },
            { id: "career", label: "GM Career", icon: "briefcase" },
          ].map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2 rounded-lg mr-2 flex-row items-center ${
                activeTab === tab.id ? "bg-blue-600" : "bg-gray-800"
              }`}
            >
              <Ionicons
                name={tab.icon as any}
                size={18}
                color={activeTab === tab.id ? "white" : "#9CA3AF"}
              />
              <Text
                className={`ml-2 font-semibold ${
                  activeTab === tab.id ? "text-white" : "text-gray-400"
                }`}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Content */}
      {renderContent()}
    </View>
  );
}
