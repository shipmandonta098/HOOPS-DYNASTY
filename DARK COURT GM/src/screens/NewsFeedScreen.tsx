import React, { useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useBasketballStore } from "../state/basketballStore";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NewsStory, NewsCategory } from "../types/basketball";
import { getCategoryIcon, getCategoryColor, getCategoryLabel } from "../utils/newsGenerator";

export default function NewsFeedScreen() {
  const insets = useSafeAreaInsets();
  const newsFeed = useBasketballStore((s) => s.newsFeed);
  const teams = useBasketballStore((s) => s.teams);
  const players = useBasketballStore((s) => s.players);
  const coaches = useBasketballStore((s) => s.coaches);
  const markNewsAsRead = useBasketballStore((s) => s.markNewsAsRead);

  const [selectedCategory, setSelectedCategory] = useState<NewsCategory | "all">("all");
  const [expandedStories, setExpandedStories] = useState<Set<string>>(new Set());

  // Filter stories by category
  const filteredStories = useMemo(() => {
    let stories = [...newsFeed.stories].sort((a: NewsStory, b: NewsStory) => {
      // Sort by priority first, then by timestamp
      if (a.priority !== b.priority) return b.priority - a.priority;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    if (selectedCategory !== "all") {
      stories = stories.filter((s: NewsStory) => s.category === selectedCategory);
    }

    return stories;
  }, [newsFeed.stories, selectedCategory]);

  // Get unread count per category
  const getCategoryCount = (category: NewsCategory | "all"): number => {
    if (category === "all") return newsFeed.stories.length;
    return newsFeed.stories.filter((s) => s.category === category).length;
  };

  const toggleExpanded = (storyId: string) => {
    const newExpanded = new Set(expandedStories);
    if (newExpanded.has(storyId)) {
      newExpanded.delete(storyId);
    } else {
      newExpanded.add(storyId);
      markNewsAsRead(storyId);
    }
    setExpandedStories(newExpanded);
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getEntityName = (story: NewsStory): string => {
    if (story.playerId) {
      const player = players.find((p) => p.id === story.playerId);
      if (player) return player.name;
    }
    if (story.teamId) {
      const team = teams.find((t) => t.id === story.teamId);
      if (team) return `${team.logo} ${team.city}`;
    }
    if (story.coachId) {
      const coach = coaches.find((c) => c.id === story.coachId);
      if (coach) return coach.name;
    }
    return "";
  };

  const renderStoryCard = (story: NewsStory) => {
    const isExpanded = expandedStories.has(story.id);
    const hasDetailedContent = !!story.detailedContent;

    return (
      <View key={story.id} className="mb-3">
        <Pressable
          onPress={() => hasDetailedContent && toggleExpanded(story.id)}
          className="bg-gray-800 rounded-lg border border-gray-700 active:bg-gray-750"
        >
          {story.isBreaking && (
            <View className="bg-red-600 px-3 py-1 rounded-t-lg">
              <Text className="text-white font-bold text-xs tracking-wider">🚨 BREAKING NEWS</Text>
            </View>
          )}

          <View className="p-4">
            {/* Header */}
            <View className="flex-row items-start mb-2">
              <View className={`${getCategoryColor(story.category)} rounded-full p-2 mr-3`}>
                <Ionicons
                  name={getCategoryIcon(story.category) as any}
                  size={20}
                  color="white"
                />
              </View>

              <View className="flex-1">
                <View className="flex-row items-center mb-1">
                  <View className={`${getCategoryColor(story.category)} px-2 py-1 rounded mr-2`}>
                    <Text className="text-white font-bold text-xs">
                      {getCategoryLabel(story.category).toUpperCase()}
                    </Text>
                  </View>
                  <Text className="text-gray-400 text-xs">{formatTimestamp(story.timestamp)}</Text>
                </View>

                {/* Headline */}
                <Text className="text-white font-bold text-base mb-1">{story.headline}</Text>

                {/* Description */}
                <Text className="text-gray-300 text-sm leading-5">{story.description}</Text>

                {/* Entity tag */}
                {getEntityName(story) && (
                  <View className="mt-2">
                    <Text className="text-blue-400 text-xs">{getEntityName(story)}</Text>
                  </View>
                )}
              </View>

              {hasDetailedContent && (
                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#9CA3AF"
                />
              )}
            </View>

            {/* Expanded Content */}
            {isExpanded && hasDetailedContent && (
              <View className="mt-3 pt-3 border-t border-gray-700">
                <Text className="text-gray-300 text-sm leading-5">{story.detailedContent}</Text>
              </View>
            )}
          </View>
        </Pressable>
      </View>
    );
  };

  const categories: Array<{ id: NewsCategory | "all"; label: string; icon: string }> = [
    { id: "all", label: "All", icon: "newspaper" },
    { id: "official_announcement", label: "Official", icon: "megaphone" },
    { id: "rumor", label: "Rumors", icon: "chatbubbles" },
    { id: "player_mood", label: "Player Mood", icon: "person" },
    { id: "trade_request", label: "Trade Requests", icon: "alert-circle" },
    { id: "league_buzz", label: "League Buzz", icon: "trending-up" },
    { id: "rivalry_update", label: "Rivalries", icon: "flame" },
  ];

  return (
    <View className="flex-1 bg-gray-950">
      {/* Header */}
      <View
        className="bg-gray-900 border-b border-gray-800 px-4 pb-4"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Text className="text-white font-bold text-2xl mb-1">News Feed</Text>
        <Text className="text-gray-400">{filteredStories.length} stories</Text>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="bg-gray-900 border-b border-gray-800"
      >
        <View className="flex-row px-2 py-3">
          {categories.map((cat) => {
            const count = getCategoryCount(cat.id);
            const isSelected = selectedCategory === cat.id;

            return (
              <Pressable
                key={cat.id}
                onPress={() => setSelectedCategory(cat.id)}
                className={`px-3 py-2 rounded-lg mr-2 flex-row items-center ${
                  isSelected ? "bg-blue-600" : "bg-gray-800"
                }`}
              >
                <Ionicons name={cat.icon as any} size={16} color={isSelected ? "white" : "#9CA3AF"} />
                <Text
                  className={`ml-2 font-semibold text-sm ${
                    isSelected ? "text-white" : "text-gray-400"
                  }`}
                >
                  {cat.label}
                </Text>
                {count > 0 && (
                  <View
                    className={`ml-2 px-2 py-0.5 rounded-full ${
                      isSelected ? "bg-blue-800" : "bg-gray-700"
                    }`}
                  >
                    <Text className="text-white text-xs font-bold">{count}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Stories List */}
      {filteredStories.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <Ionicons name="newspaper-outline" size={64} color="#4B5563" />
          <Text className="text-gray-400 text-center mt-4 text-base">
            No news stories yet. Simulate games and make moves to generate league stories.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1 p-4">
          {filteredStories.map((story) => renderStoryCard(story))}
        </ScrollView>
      )}
    </View>
  );
}
