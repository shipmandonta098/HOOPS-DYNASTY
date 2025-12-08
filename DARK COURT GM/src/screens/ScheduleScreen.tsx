import React, { useState, useEffect, useRef, useMemo } from "react";
import { View, Text, Pressable, ScrollView, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useBasketballStore } from "../state/basketballStore";
import { Game, Team } from "../types/basketball";
import {
  getRivalryBetweenTeams,
  getRivalryDisplayText,
  getRivalryColor,
} from "../utils/rivalry";
import {
  getGameDifficulty,
  findDangerStretches,
  calculateTeamOVR,
  getSOSColor,
} from "../utils/strengthOfSchedule";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScheduleView = "team" | "league";
type LeagueFilter = "all" | "myTeam" | "keyDates";

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const scrollViewRef = useRef<ScrollView>(null);

  const teams = useBasketballStore((s) => s.teams);
  const players = useBasketballStore((s) => s.players);
  const season = useBasketballStore((s) => s.season);
  const userTeamId = useBasketballStore((s) => s.userTeamId);
  const simulateGame = useBasketballStore((s) => s.simulateGame);
  const getSettings = useBasketballStore((s) => s.getSettings);
  const settings = getSettings();

  const [scheduleView, setScheduleView] = useState<ScheduleView>("team");
  const [leagueFilter, setLeagueFilter] = useState<LeagueFilter>("all");
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentDayPosition, setCurrentDayPosition] = useState(0);
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());

  const userTeam = teams.find((t) => t.id === userTeamId);
  const gamesPerSeason = settings?.gamesPerSeason || 82;
  const allStarDay = settings?.allStarWeekendDay || 90;
  const tradeDeadlineDay = settings?.tradeDeadlineDay || 110;

  // Calculate total season days
  const totalSeasonDays = useMemo(() => {
    const allGames = season.games;
    if (allGames.length === 0) return 0;
    return Math.max(...allGames.map((g) => g.dayNumber));
  }, [season.games]);

  // Calculate key event days
  const regularSeasonEndDay = useMemo(() => {
    const playedGames = season.games.filter((g) => g.played);
    const unplayedGames = season.games.filter((g) => !g.played);
    if (unplayedGames.length === 0 && playedGames.length > 0) {
      return Math.max(...playedGames.map((g) => g.dayNumber));
    }
    // Estimate based on total season length
    return Math.floor(totalSeasonDays * 0.85);
  }, [season.games, totalSeasonDays]);

  const playoffsBeginDay = regularSeasonEndDay + 1;

  // Calculate danger stretches for upcoming games (Team Schedule)
  const dangerStretches = useMemo(() => {
    return findDangerStretches(userTeamId, season.games, teams, players);
  }, [userTeamId, season.games, teams, players]);

  // Create a flat list of upcoming games for indexing (Team Schedule)
  const upcomingGamesFlat = useMemo(() => {
    return season.games
      .filter((g) => g.homeTeamId === userTeamId || g.awayTeamId === userTeamId)
      .filter((g) => !g.played)
      .sort((a, b) => a.dayNumber - b.dayNumber);
  }, [season.games, userTeamId]);

  // Helper to get the index of a game in the upcoming games list
  const getUpcomingGameIndex = (gameId: string): number => {
    return upcomingGamesFlat.findIndex((g) => g.id === gameId);
  };

  // Group games by day for TEAM SCHEDULE
  const teamGamesByDay = useMemo(() => {
    const userGames = season.games.filter(
      (g) => g.homeTeamId === userTeamId || g.awayTeamId === userTeamId
    );

    const grouped: { [day: number]: Game[] } = {};
    userGames.forEach((game) => {
      const day = game.dayNumber;
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(game);
    });

    return grouped;
  }, [season.games, userTeamId]);

  // Group ALL games by day for LEAGUE SCHEDULE
  const leagueGamesByDay = useMemo(() => {
    const grouped: { [day: number]: Game[] } = {};

    season.games.forEach((game) => {
      const day = game.dayNumber;
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(game);
    });

    return grouped;
  }, [season.games]);

  // Check if day is a special event (must be defined before filteredLeagueGamesByDay useMemo)
  const isSpecialEventDay = (day: number): boolean => {
    // All-Star Weekend (4 days)
    if (day >= allStarDay && day < allStarDay + 4) return true;
    // Trade Deadline
    if (day === tradeDeadlineDay) return true;
    // Regular Season End
    if (day === regularSeasonEndDay) return true;
    // Playoffs Begin
    if (day === playoffsBeginDay) return true;
    return false;
  };

  // Apply league filter
  const filteredLeagueGamesByDay = useMemo(() => {
    if (leagueFilter === "all") {
      return leagueGamesByDay;
    } else if (leagueFilter === "myTeam") {
      // Show only days where user team plays (but keep event days)
      const filtered: { [day: number]: Game[] } = {};
      Object.keys(leagueGamesByDay).forEach((dayStr) => {
        const day = Number(dayStr);
        const games = leagueGamesByDay[day];
        const userTeamGames = games.filter(
          (g) => g.homeTeamId === userTeamId || g.awayTeamId === userTeamId
        );

        // Include day if user team plays OR it's a special event day
        if (userTeamGames.length > 0 || isSpecialEventDay(day)) {
          filtered[day] = games;
        }
      });
      return filtered;
    } else {
      // keyDates only - show only special event days
      const filtered: { [day: number]: Game[] } = {};
      Object.keys(leagueGamesByDay).forEach((dayStr) => {
        const day = Number(dayStr);
        if (isSpecialEventDay(day)) {
          filtered[day] = leagueGamesByDay[day];
        }
      });
      return filtered;
    }
  }, [leagueGamesByDay, leagueFilter, userTeamId]);

  const totalTeamDays = Object.keys(teamGamesByDay).length;

  // Find current day (first day with unplayed games)
  const currentDay = useMemo(() => {
    const gamesByDay = scheduleView === "team" ? teamGamesByDay : leagueGamesByDay;
    const totalDays = Object.keys(gamesByDay).length;

    for (let day = 1; day <= totalDays; day++) {
      const games = gamesByDay[day] || [];
      if (games.some((g) => !g.played)) {
        return day;
      }
    }
    return totalDays;
  }, [teamGamesByDay, leagueGamesByDay, scheduleView]);

  // Check if team has back-to-back games
  const isBackToBack = (day: number): boolean => {
    const prevDayGames = teamGamesByDay[day - 1] || [];
    const currentDayGames = teamGamesByDay[day] || [];
    return prevDayGames.length > 0 && currentDayGames.length > 0;
  };

  const getOpponent = (game: Game): Team | undefined => {
    const opponentId = game.homeTeamId === userTeamId ? game.awayTeamId : game.homeTeamId;
    return teams.find((t) => t.id === opponentId);
  };

  const isHome = (game: Game): boolean => {
    return game.homeTeamId === userTeamId;
  };

  const getGameResult = (game: Game): { result: string; color: string } | null => {
    if (!game.played) return null;

    const userScore = isHome(game) ? game.homeScore : game.awayScore;
    const oppScore = isHome(game) ? game.awayScore : game.homeScore;

    if (userScore > oppScore) {
      return { result: `W ${userScore}-${oppScore}`, color: "text-green-400" };
    } else {
      return { result: `L ${userScore}-${oppScore}`, color: "text-red-400" };
    }
  };

  const handleGamePress = (game: Game) => {
    setSelectedGame(game);
    setModalVisible(true);
  };

  const handleSimGame = () => {
    if (selectedGame && !selectedGame.played) {
      simulateGame(selectedGame.id);
      setModalVisible(false);
    }
  };

  const toggleDayExpansion = (day: number) => {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(day)) {
      newExpanded.delete(day);
    } else {
      newExpanded.add(day);
    }
    setExpandedDays(newExpanded);
  };

  const scrollToKeyDate = (day: number) => {
    // Find the position and scroll to it
    setExpandedDays((prev) => {
      const newSet = new Set(prev);
      newSet.add(day);
      return newSet;
    });

    // Small delay to allow expand animation
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: day * 100, // Approximate, will need refinement
        animated: true,
      });
    }, 100);
  };

  const renderGameModal = () => {
    if (!selectedGame) return null;

    const opponent = getOpponent(selectedGame);
    const home = isHome(selectedGame);
    const result = getGameResult(selectedGame);
    const rivalry = getRivalryBetweenTeams(
      season.rivalries || [],
      selectedGame.homeTeamId,
      selectedGame.awayTeamId
    );

    const homeTeam = teams.find((t) => t.id === selectedGame.homeTeamId);
    const awayTeam = teams.find((t) => t.id === selectedGame.awayTeamId);

    return (
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/70 justify-center items-center px-6"
          onPress={() => setModalVisible(false)}
        >
          <Pressable
            className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View className="flex-row justify-between items-start mb-4">
              <Text className="text-white text-xl font-bold flex-1">Game Details</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </Pressable>
            </View>

            {/* Matchup */}
            <View className="bg-gray-800 rounded-lg p-4 mb-4">
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-1 items-center">
                  <Text className="text-gray-400 text-xs mb-1">AWAY</Text>
                  <Text className="text-white text-lg font-bold text-center">
                    {awayTeam?.city}
                  </Text>
                  <Text className="text-white text-lg font-bold text-center">
                    {awayTeam?.name}
                  </Text>
                  <Text className="text-gray-400 text-sm mt-1">
                    {awayTeam?.wins}-{awayTeam?.losses}
                  </Text>
                </View>

                <View className="items-center px-4">
                  <Text className="text-gray-500 text-2xl font-bold">@</Text>
                </View>

                <View className="flex-1 items-center">
                  <Text className="text-gray-400 text-xs mb-1">HOME</Text>
                  <Text className="text-white text-lg font-bold text-center">
                    {homeTeam?.city}
                  </Text>
                  <Text className="text-white text-lg font-bold text-center">
                    {homeTeam?.name}
                  </Text>
                  <Text className="text-gray-400 text-sm mt-1">
                    {homeTeam?.wins}-{homeTeam?.losses}
                  </Text>
                </View>
              </View>

              {rivalry && (
                <View
                  className={`${getRivalryColor(rivalry.level)} rounded-lg p-2 mt-2`}
                >
                  <Text className="text-white text-xs font-semibold text-center">
                    🔥 {getRivalryDisplayText(rivalry.level).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>

            {/* Box Score (if played) */}
            {selectedGame.played && (
              <View className="bg-gray-800 rounded-lg p-4 mb-4">
                <Text className="text-white font-bold mb-3">Final Score</Text>
                <View className="flex-row justify-between items-center">
                  <View className="flex-1">
                    <Text className="text-gray-400 text-sm mb-1">
                      {awayTeam?.city} {awayTeam?.name}
                    </Text>
                    <Text
                      className={`text-3xl font-bold ${
                        selectedGame.awayScore > selectedGame.homeScore
                          ? "text-green-400"
                          : "text-gray-500"
                      }`}
                    >
                      {selectedGame.awayScore}
                    </Text>
                  </View>

                  <View className="flex-1 items-end">
                    <Text className="text-gray-400 text-sm mb-1">
                      {homeTeam?.city} {homeTeam?.name}
                    </Text>
                    <Text
                      className={`text-3xl font-bold ${
                        selectedGame.homeScore > selectedGame.awayScore
                          ? "text-green-400"
                          : "text-gray-500"
                      }`}
                    >
                      {selectedGame.homeScore}
                    </Text>
                  </View>
                </View>

                {selectedGame.wasCloseGame && (
                  <View className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-2 mt-3">
                    <Text className="text-yellow-400 text-xs text-center">
                      ⚡ Close Game (≤5 pts)
                    </Text>
                  </View>
                )}

                {selectedGame.hadBigPerformance && (
                  <View className="bg-purple-900/30 border border-purple-700 rounded-lg p-2 mt-2">
                    <Text className="text-purple-400 text-xs text-center">
                      ⭐ 50+ Point Performance
                    </Text>
                  </View>
                )}

                {selectedGame.wasPhysical && (
                  <View className="bg-red-900/30 border border-red-700 rounded-lg p-2 mt-2">
                    <Text className="text-red-400 text-xs text-center">
                      💥 Physical/Intense Game
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Action Buttons (if upcoming) */}
            {!selectedGame.played && (
              <View className="gap-2">
                <Pressable
                  className="bg-purple-600 rounded-lg p-4 active:bg-purple-700"
                  onPress={() => {
                    setModalVisible(false);
                    navigation.navigate("LiveGame", { gameId: selectedGame.id });
                  }}
                >
                  <View className="flex-row items-center justify-center gap-2">
                    <Ionicons name="play-circle" size={24} color="white" />
                    <Text className="text-white font-bold text-center">
                      Watch Live
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  className="bg-blue-600 rounded-lg p-4 active:bg-blue-700"
                  onPress={handleSimGame}
                >
                  <View className="flex-row items-center justify-center gap-2">
                    <Ionicons name="flash" size={24} color="white" />
                    <Text className="text-white font-bold text-center">
                      Simulate Instantly
                    </Text>
                  </View>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  // TEAM SCHEDULE: Game Card
  const renderTeamGameCard = (game: Game, gameIndex: number) => {
    const opponent = getOpponent(game);
    const home = isHome(game);
    const result = getGameResult(game);
    const rivalry = getRivalryBetweenTeams(
      season.rivalries || [],
      game.homeTeamId,
      game.awayTeamId
    );

    if (!opponent) return null;

    const difficulty = getGameDifficulty(game, userTeamId, teams, players);
    const opponentOVR = calculateTeamOVR(opponent, players);

    const isInDangerStretch = dangerStretches.some(
      (stretch) => gameIndex >= stretch.startGame && gameIndex <= stretch.endGame
    );

    return (
      <Pressable
        key={game.id}
        className={`rounded-lg p-4 mb-2 active:bg-gray-700 ${
          isInDangerStretch && !game.played
            ? "bg-red-950 border-2 border-red-700"
            : "bg-gray-800"
        }`}
        onPress={() => handleGamePress(game)}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-1">
              <Text className="text-gray-400 text-xs font-semibold">
                {home ? "vs" : "@"}
              </Text>
              <Text className="text-white font-semibold text-base">
                {opponent.city} {opponent.name}
              </Text>
              {rivalry && (
                <View className={`${getRivalryColor(rivalry.level)} rounded px-2 py-0.5`}>
                  <Text className="text-white text-xs font-bold">🔥</Text>
                </View>
              )}
            </View>
            <View className="flex-row items-center gap-3">
              <Text className="text-gray-500 text-xs">
                {opponent.wins}-{opponent.losses}
              </Text>
              {!game.played && (
                <>
                  <Text className="text-gray-600 text-xs">•</Text>
                  <Text className="text-gray-400 text-xs font-medium">
                    OVR: {opponentOVR}
                  </Text>
                  <Text className="text-gray-600 text-xs">•</Text>
                  <Text
                    className="text-xs font-bold"
                    style={{ color: getSOSColor(difficulty.label) }}
                  >
                    {difficulty.label}
                  </Text>
                </>
              )}
            </View>
          </View>

          {result ? (
            <View className="items-end">
              <Text className={`${result.color} font-bold text-lg`}>{result.result}</Text>
            </View>
          ) : (
            <View className="bg-blue-900/30 border border-blue-700 rounded px-3 py-1">
              <Text className="text-blue-400 text-xs font-semibold">Upcoming</Text>
            </View>
          )}
        </View>
        {isInDangerStretch && !game.played && (
          <View className="mt-2 pt-2 border-t border-red-800">
            <View className="flex-row items-center gap-1">
              <Ionicons name="warning" size={12} color="#ef4444" />
              <Text className="text-red-400 text-xs font-medium">
                Part of difficult stretch
              </Text>
            </View>
          </View>
        )}
      </Pressable>
    );
  };

  // TEAM SCHEDULE: Day Render
  const renderTeamDay = (day: number) => {
    const games = teamGamesByDay[day] || [];
    const hasUnplayedGames = games.some((g) => !g.played);
    const isCurrentDay = day === currentDay;
    const backToBack = isBackToBack(day);

    return (
      <View
        key={day}
        className="mb-6"
        onLayout={(event) => {
          if (isCurrentDay && currentDayPosition === 0) {
            setCurrentDayPosition(event.nativeEvent.layout.y);
          }
        }}
      >
        {/* Day Header */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <Text
              className={`text-lg font-bold ${
                isCurrentDay ? "text-blue-400" : "text-white"
              }`}
            >
              Day {day}
            </Text>
            {isCurrentDay && (
              <View className="bg-blue-600 rounded-full px-2 py-0.5">
                <Text className="text-white text-xs font-bold">NOW</Text>
              </View>
            )}
            {backToBack && (
              <View className="bg-orange-900/30 border border-orange-700 rounded px-2 py-0.5">
                <Text className="text-orange-400 text-xs font-bold">B2B</Text>
              </View>
            )}
          </View>
          <Text className="text-gray-500 text-xs">
            {games.filter((g) => g.played).length}/{games.length} played
          </Text>
        </View>

        {/* Games */}
        <View>
          {games.map((game) => {
            const gameIndex = getUpcomingGameIndex(game.id);
            return renderTeamGameCard(game, gameIndex);
          })}
        </View>
      </View>
    );
  };

  // LEAGUE SCHEDULE: Single Game Row
  const renderLeagueGameRow = (game: Game) => {
    const homeTeam = teams.find((t) => t.id === game.homeTeamId);
    const awayTeam = teams.find((t) => t.id === game.awayTeamId);

    if (!homeTeam || !awayTeam) return null;

    const homeOVR = calculateTeamOVR(homeTeam, players);
    const awayOVR = calculateTeamOVR(awayTeam, players);
    const ovrDiff = Math.abs(homeOVR - awayOVR);

    let difficulty = "Normal";
    if (ovrDiff >= 10) difficulty = "Easy";
    else if (ovrDiff >= 5) difficulty = "Normal";
    else difficulty = "Hard";

    const isUserTeamGame = game.homeTeamId === userTeamId || game.awayTeamId === userTeamId;

    return (
      <Pressable
        key={game.id}
        className={`py-2 border-b border-gray-800 active:bg-gray-800 ${
          isUserTeamGame ? "bg-blue-950/30" : ""
        }`}
        onPress={() => handleGamePress(game)}
      >
        <View className="flex-row items-center justify-between px-2">
          <Text className="text-gray-300 text-sm flex-1">
            {awayTeam.city} {awayTeam.name}
          </Text>
          <Text className="text-gray-500 text-sm px-2">@</Text>
          <Text className="text-gray-300 text-sm flex-1 text-right">
            {homeTeam.city} {homeTeam.name}
          </Text>
        </View>
        <View className="flex-row items-center justify-between px-2 mt-1">
          <Text className="text-gray-500 text-xs">OVR {awayOVR} vs {homeOVR}</Text>
          <Text className="text-gray-600 text-xs">•</Text>
          <Text className="text-gray-400 text-xs">{difficulty}</Text>
        </View>
      </Pressable>
    );
  };

  // LEAGUE SCHEDULE: Special Event Banner
  const renderSpecialEventBanner = (day: number) => {
    // All-Star Weekend (4 days)
    if (day >= allStarDay && day < allStarDay + 4) {
      return (
        <View className="bg-yellow-900/30 border-2 border-yellow-600 rounded-lg p-4 mb-3">
          <View className="flex-row items-center gap-2 mb-2">
            <Ionicons name="star" size={20} color="#fbbf24" />
            <Text className="text-yellow-400 text-lg font-bold">ALL-STAR BREAK</Text>
          </View>
          <Text className="text-yellow-300 text-sm mb-2">
            Rising Stars • 3PT Contest • Dunk Contest • All-Star Game
          </Text>
          <Text className="text-yellow-500 text-xs">
            No regular season games scheduled
          </Text>
        </View>
      );
    }

    // Trade Deadline
    if (day === tradeDeadlineDay) {
      return (
        <View className="bg-red-900/30 border-2 border-red-600 rounded-lg p-4 mb-3">
          <View className="flex-row items-center gap-2 mb-1">
            <Ionicons name="alert-circle" size={20} color="#ef4444" />
            <Text className="text-red-400 text-lg font-bold">TRADE DEADLINE</Text>
          </View>
          <Text className="text-red-300 text-sm">
            Last day to make trades this season
          </Text>
        </View>
      );
    }

    // Regular Season End
    if (day === regularSeasonEndDay) {
      return (
        <View className="bg-purple-900/30 border-2 border-purple-600 rounded-lg p-4 mb-3">
          <View className="flex-row items-center gap-2 mb-1">
            <Ionicons name="calendar" size={20} color="#a855f7" />
            <Text className="text-purple-400 text-lg font-bold">END OF REGULAR SEASON</Text>
          </View>
          <Text className="text-purple-300 text-sm">
            Playoff seeding determined • Postseason begins next
          </Text>
        </View>
      );
    }

    // Playoffs Begin
    if (day === playoffsBeginDay) {
      return (
        <View className="bg-orange-900/30 border-2 border-orange-600 rounded-lg p-4 mb-3">
          <View className="flex-row items-center gap-2 mb-1">
            <Ionicons name="trending-up" size={20} color="#f97316" />
            <Text className="text-orange-400 text-lg font-bold">PLAYOFFS BEGIN</Text>
          </View>
          <Text className="text-orange-300 text-sm">
            The road to the championship starts now
          </Text>
        </View>
      );
    }

    return null;
  };

  // LEAGUE SCHEDULE: Day Render
  const renderLeagueDay = (day: number) => {
    const games = filteredLeagueGamesByDay[day] || [];
    const isExpanded = expandedDays.has(day);
    const isCurrentDay = day === currentDay;
    const hasSpecialEvent = isSpecialEventDay(day);

    // For All-Star days with no games, just show banner
    if (day >= allStarDay && day < allStarDay + 4 && games.length === 0) {
      return (
        <View key={day} className="mb-4">
          <View className="flex-row items-center justify-between mb-2">
            <Text className={`text-lg font-bold ${isCurrentDay ? "text-blue-400" : "text-white"}`}>
              Day {day}
            </Text>
          </View>
          {renderSpecialEventBanner(day)}
        </View>
      );
    }

    return (
      <View key={day} className="mb-4">
        {/* Day Header */}
        <Pressable
          className="flex-row items-center justify-between mb-2 active:opacity-70"
          onPress={() => toggleDayExpansion(day)}
        >
          <View className="flex-row items-center gap-2">
            <Text className={`text-lg font-bold ${isCurrentDay ? "text-blue-400" : "text-white"}`}>
              Day {day}
            </Text>
            {isCurrentDay && (
              <View className="bg-blue-600 rounded-full px-2 py-0.5">
                <Text className="text-white text-xs font-bold">NOW</Text>
              </View>
            )}
            {hasSpecialEvent && (
              <Ionicons name="star" size={16} color="#fbbf24" />
            )}
          </View>
          <View className="flex-row items-center gap-2">
            <Text className="text-gray-500 text-sm">{games.length} games</Text>
            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color="#6b7280"
            />
          </View>
        </Pressable>

        {/* Special Event Banner */}
        {hasSpecialEvent && renderSpecialEventBanner(day)}

        {/* Games List (Collapsible) */}
        {isExpanded && games.length > 0 && (
          <View className="bg-gray-800 rounded-lg overflow-hidden">
            {games.map((game) => renderLeagueGameRow(game))}
          </View>
        )}
      </View>
    );
  };

  // Auto-scroll to current day on mount
  useEffect(() => {
    if (currentDayPosition > 0 && scrollViewRef.current && scheduleView === "team") {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: currentDayPosition - 100,
          animated: true,
        });
      }, 300);
    }
  }, [currentDayPosition, scheduleView]);

  return (
    <View className="flex-1 bg-gray-950">
      {/* Header */}
      <View
        className="bg-gray-900 border-b border-gray-800"
        style={{ paddingTop: insets.top + 60 }}
      >
        <View className="px-6 pb-4">
          <Text className="text-white text-2xl font-bold">Schedule</Text>
          {scheduleView === "team" ? (
            <Text className="text-gray-400 text-sm mt-1">
              {userTeam?.city} {userTeam?.name} • {totalTeamDays} Game Days
            </Text>
          ) : (
            <View>
              <Text className="text-gray-400 text-sm mt-1">
                Season {season.year} • {totalSeasonDays} Days
              </Text>
              <View className="bg-blue-900/30 border border-blue-700 rounded px-2 py-1 mt-2 self-start">
                <Text className="text-blue-400 text-xs font-semibold">
                  {gamesPerSeason} Games Per Team
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Toggle Bar */}
        <View className="flex-row px-6 pb-3 gap-2">
          <Pressable
            className={`flex-1 py-3 rounded-lg ${
              scheduleView === "team" ? "bg-blue-600" : "bg-gray-800"
            }`}
            onPress={() => setScheduleView("team")}
          >
            <Text
              className={`text-center font-semibold ${
                scheduleView === "team" ? "text-white" : "text-gray-400"
              }`}
            >
              Team Schedule
            </Text>
          </Pressable>
          <Pressable
            className={`flex-1 py-3 rounded-lg ${
              scheduleView === "league" ? "bg-blue-600" : "bg-gray-800"
            }`}
            onPress={() => setScheduleView("league")}
          >
            <Text
              className={`text-center font-semibold ${
                scheduleView === "league" ? "text-white" : "text-gray-400"
              }`}
            >
              League Schedule
            </Text>
          </Pressable>
        </View>

        {/* League Schedule: Key Events Strip */}
        {scheduleView === "league" && (
          <View className="px-6 pb-3">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                <Pressable
                  className="bg-gray-800 rounded-lg px-3 py-2"
                  onPress={() => scrollToKeyDate(1)}
                >
                  <Text className="text-gray-300 text-xs font-semibold">
                    Opening Night (Day 1)
                  </Text>
                </Pressable>
                <Pressable
                  className="bg-yellow-900/30 border border-yellow-700 rounded-lg px-3 py-2"
                  onPress={() => scrollToKeyDate(allStarDay)}
                >
                  <Text className="text-yellow-400 text-xs font-semibold">
                    All-Star (Day {allStarDay})
                  </Text>
                </Pressable>
                <Pressable
                  className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2"
                  onPress={() => scrollToKeyDate(tradeDeadlineDay)}
                >
                  <Text className="text-red-400 text-xs font-semibold">
                    Trade Deadline (Day {tradeDeadlineDay})
                  </Text>
                </Pressable>
                <Pressable
                  className="bg-purple-900/30 border border-purple-700 rounded-lg px-3 py-2"
                  onPress={() => scrollToKeyDate(regularSeasonEndDay)}
                >
                  <Text className="text-purple-400 text-xs font-semibold">
                    Season Ends (Day {regularSeasonEndDay})
                  </Text>
                </Pressable>
                <Pressable
                  className="bg-orange-900/30 border border-orange-700 rounded-lg px-3 py-2"
                  onPress={() => scrollToKeyDate(playoffsBeginDay)}
                >
                  <Text className="text-orange-400 text-xs font-semibold">
                    Playoffs Begin (Day {playoffsBeginDay})
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        )}

        {/* League Schedule: Filter Options */}
        {scheduleView === "league" && (
          <View className="flex-row px-6 pb-3 gap-2">
            <Pressable
              className={`px-4 py-2 rounded-lg ${
                leagueFilter === "all" ? "bg-blue-600" : "bg-gray-800"
              }`}
              onPress={() => setLeagueFilter("all")}
            >
              <Text
                className={`text-xs font-semibold ${
                  leagueFilter === "all" ? "text-white" : "text-gray-400"
                }`}
              >
                All Games
              </Text>
            </Pressable>
            <Pressable
              className={`px-4 py-2 rounded-lg ${
                leagueFilter === "myTeam" ? "bg-blue-600" : "bg-gray-800"
              }`}
              onPress={() => setLeagueFilter("myTeam")}
            >
              <Text
                className={`text-xs font-semibold ${
                  leagueFilter === "myTeam" ? "text-white" : "text-gray-400"
                }`}
              >
                My Team Only
              </Text>
            </Pressable>
            <Pressable
              className={`px-4 py-2 rounded-lg ${
                leagueFilter === "keyDates" ? "bg-blue-600" : "bg-gray-800"
              }`}
              onPress={() => setLeagueFilter("keyDates")}
            >
              <Text
                className={`text-xs font-semibold ${
                  leagueFilter === "keyDates" ? "text-white" : "text-gray-400"
                }`}
              >
                Key Dates Only
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Schedule Content */}
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <View className="px-4 py-4">
          {scheduleView === "team"
            ? Object.keys(teamGamesByDay)
                .map(Number)
                .sort((a, b) => a - b)
                .map((day) => renderTeamDay(day))
            : Object.keys(filteredLeagueGamesByDay)
                .map(Number)
                .sort((a, b) => a - b)
                .map((day) => renderLeagueDay(day))}
        </View>
      </ScrollView>

      {/* Game Details Modal */}
      {renderGameModal()}
    </View>
  );
}
