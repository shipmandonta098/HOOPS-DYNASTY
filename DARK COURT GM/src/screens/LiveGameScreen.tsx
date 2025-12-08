import React, { useState, useEffect, useRef } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useBasketballStore } from "../state/basketballStore";
import { generateNextPlay, Play } from "../utils/playByPlay";
import type { Player } from "../types/basketball";

type LiveGameRouteProp = RouteProp<RootStackParamList, "LiveGame">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type TabType = "play-by-play" | "box-score" | "team-comparison";

interface QuarterScore {
  quarter: number;
  homeScore: number;
  awayScore: number;
}

interface TeamStats {
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointMade: number;
  threePointAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  rebounds: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  pointsInPaint: number;
  secondChancePoints: number;
  fastBreakPoints: number;
  benchPoints: number;
}

// Player box score stats
interface PlayerBoxScore {
  playerId: string;
  fullName: string;
  position: string;
  minutesPlayed: number; // In actual minutes (decimal)
  isOnCourt: boolean;
  stats: {
    points: number;
    fgMade: number;
    fgAtt: number;
    threeMade: number;
    threeAtt: number;
    ftMade: number;
    ftAtt: number;
    rebounds: number;
    offRebounds: number;
    defRebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    turnovers: number;
    fouls: number;
  };
}

// Game state with complete player tracking
interface GameState {
  homeTeamId: string;
  awayTeamId: string;
  homePlayers: PlayerBoxScore[];
  awayPlayers: PlayerBoxScore[];
  onCourtHome: string[]; // Player IDs currently on court
  onCourtAway: string[]; // Player IDs currently on court
  quarter: number;
  time: number;
  homeScore: number;
  awayScore: number;
  possession: "home" | "away";
}

export default function LiveGameScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<LiveGameRouteProp>();
  const scrollViewRef = useRef<ScrollView>(null);

  const { gameId } = route.params;

  const teams = useBasketballStore((s) => s.teams);
  const players = useBasketballStore((s) => s.players);
  const season = useBasketballStore((s) => s.season);
  const simulateGame = useBasketballStore((s) => s.simulateGame);

  const game = season.games.find((g) => g.id === gameId);
  const homeTeam = teams.find((t) => t.id === game?.homeTeamId);
  const awayTeam = teams.find((t) => t.id === game?.awayTeamId);

  const [activeTab, setActiveTab] = useState<TabType>("play-by-play");
  const [plays, setPlays] = useState<Play[]>([]);
  const [isSimulating, setIsSimulating] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState<"slow" | "normal" | "fast">("normal");
  const [quarterScores, setQuarterScores] = useState<QuarterScore[]>([]);

  // Get all players for both teams
  const homeRosterPlayers = homeTeam ? players.filter((p) => homeTeam.playerIds.includes(p.id)) : [];
  const awayRosterPlayers = awayTeam ? players.filter((p) => awayTeam.playerIds.includes(p.id)) : [];

  // Initialize game state with proper player tracking
  const [gameState, setGameState] = useState<GameState>(() => {
    if (!homeTeam || !awayTeam) {
      return {
        homeTeamId: "",
        awayTeamId: "",
        homePlayers: [],
        awayPlayers: [],
        onCourtHome: [],
        onCourtAway: [],
        quarter: 1,
        time: 12 * 60,
        homeScore: 0,
        awayScore: 0,
        possession: Math.random() < 0.5 ? "home" : "away",
      };
    }

    // Determine starters (top 5 players by overall rating)
    const homeStarters = [...homeRosterPlayers]
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 5)
      .map((p) => p.id);

    const awayStarters = [...awayRosterPlayers]
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 5)
      .map((p) => p.id);

    // Create player box score entries for ALL players on roster
    const createPlayerBoxScore = (player: Player, isStarter: boolean): PlayerBoxScore => ({
      playerId: player.id,
      fullName: player.name,
      position: player.position,
      minutesPlayed: 0,
      isOnCourt: isStarter,
      stats: {
        points: 0,
        fgMade: 0,
        fgAtt: 0,
        threeMade: 0,
        threeAtt: 0,
        ftMade: 0,
        ftAtt: 0,
        rebounds: 0,
        offRebounds: 0,
        defRebounds: 0,
        assists: 0,
        steals: 0,
        blocks: 0,
        turnovers: 0,
        fouls: 0,
      },
    });

    const homePlayers = homeRosterPlayers.map((p) =>
      createPlayerBoxScore(p, homeStarters.includes(p.id))
    );
    const awayPlayers = awayRosterPlayers.map((p) =>
      createPlayerBoxScore(p, awayStarters.includes(p.id))
    );

    return {
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      homePlayers,
      awayPlayers,
      onCourtHome: homeStarters,
      onCourtAway: awayStarters,
      quarter: 1,
      time: 12 * 60,
      homeScore: 0,
      awayScore: 0,
      possession: Math.random() < 0.5 ? "home" : "away",
    };
  });

  // Update player stats and minutes based on play
  const updateGameStateFromPlay = (play: Play, timeElapsed: number) => {
    setGameState((prevState) => {
      const newState = { ...prevState };

      // Update minutes for all players currently on court
      newState.homePlayers = prevState.homePlayers.map((player) => {
        if (prevState.onCourtHome.includes(player.playerId)) {
          return {
            ...player,
            minutesPlayed: player.minutesPlayed + timeElapsed / 60, // Convert seconds to minutes
          };
        }
        return player;
      });

      newState.awayPlayers = prevState.awayPlayers.map((player) => {
        if (prevState.onCourtAway.includes(player.playerId)) {
          return {
            ...player,
            minutesPlayed: player.minutesPlayed + timeElapsed / 60, // Convert seconds to minutes
          };
        }
        return player;
      });

      // Update stats based on play
      const updatePlayerStats = (playerId: string, teamPlayers: PlayerBoxScore[], statUpdate: (stats: PlayerBoxScore["stats"]) => void) => {
        return teamPlayers.map((p) => {
          if (p.playerId === playerId) {
            const updatedStats = { ...p.stats };
            statUpdate(updatedStats);
            return { ...p, stats: updatedStats };
          }
          return p;
        });
      };

      const isHomePlay = play.team.id === homeTeam?.id;
      const isAwayPlay = play.team.id === awayTeam?.id;

      // Update stats for main player in play
      if (play.player) {
        const playerId = play.player.id;

        switch (play.playType) {
          case "shot_made":
            if (isHomePlay) {
              newState.homePlayers = updatePlayerStats(playerId, newState.homePlayers, (stats) => {
                stats.points += 2;
                stats.fgMade += 1;
                stats.fgAtt += 1;
              });
            } else if (isAwayPlay) {
              newState.awayPlayers = updatePlayerStats(playerId, newState.awayPlayers, (stats) => {
                stats.points += 2;
                stats.fgMade += 1;
                stats.fgAtt += 1;
              });
            }
            break;

          case "shot_missed":
            if (isHomePlay) {
              newState.homePlayers = updatePlayerStats(playerId, newState.homePlayers, (stats) => {
                stats.fgAtt += 1;
              });
            } else if (isAwayPlay) {
              newState.awayPlayers = updatePlayerStats(playerId, newState.awayPlayers, (stats) => {
                stats.fgAtt += 1;
              });
            }
            break;

          case "three_made":
            if (isHomePlay) {
              newState.homePlayers = updatePlayerStats(playerId, newState.homePlayers, (stats) => {
                stats.points += 3;
                stats.fgMade += 1;
                stats.fgAtt += 1;
                stats.threeMade += 1;
                stats.threeAtt += 1;
              });
            } else if (isAwayPlay) {
              newState.awayPlayers = updatePlayerStats(playerId, newState.awayPlayers, (stats) => {
                stats.points += 3;
                stats.fgMade += 1;
                stats.fgAtt += 1;
                stats.threeMade += 1;
                stats.threeAtt += 1;
              });
            }
            break;

          case "three_missed":
            if (isHomePlay) {
              newState.homePlayers = updatePlayerStats(playerId, newState.homePlayers, (stats) => {
                stats.fgAtt += 1;
                stats.threeAtt += 1;
              });
            } else if (isAwayPlay) {
              newState.awayPlayers = updatePlayerStats(playerId, newState.awayPlayers, (stats) => {
                stats.fgAtt += 1;
                stats.threeAtt += 1;
              });
            }
            break;

          case "turnover":
            if (isHomePlay) {
              newState.homePlayers = updatePlayerStats(playerId, newState.homePlayers, (stats) => {
                stats.turnovers += 1;
              });
            } else if (isAwayPlay) {
              newState.awayPlayers = updatePlayerStats(playerId, newState.awayPlayers, (stats) => {
                stats.turnovers += 1;
              });
            }
            break;

          case "foul":
            if (isHomePlay) {
              newState.homePlayers = updatePlayerStats(playerId, newState.homePlayers, (stats) => {
                stats.fouls += 1;
              });
            } else if (isAwayPlay) {
              newState.awayPlayers = updatePlayerStats(playerId, newState.awayPlayers, (stats) => {
                stats.fouls += 1;
              });
            }
            break;
        }
      }

      // Update assist
      if (play.assistPlayer) {
        const assistId = play.assistPlayer.id;
        if (isHomePlay) {
          newState.homePlayers = updatePlayerStats(assistId, newState.homePlayers, (stats) => {
            stats.assists += 1;
          });
        } else if (isAwayPlay) {
          newState.awayPlayers = updatePlayerStats(assistId, newState.awayPlayers, (stats) => {
            stats.assists += 1;
          });
        }
      }

      // Note: Rebounds, blocks, steals would need to be tracked in the Play interface
      // For now, this basic implementation handles scoring stats

      return newState;
    });
  };

  // Calculate team stats from plays
  const calculateTeamStats = (teamId: string): TeamStats => {
    const teamPlays = plays.filter((p) => p.team.id === teamId);

    const stats: TeamStats = {
      fieldGoalsMade: 0,
      fieldGoalsAttempted: 0,
      threePointMade: 0,
      threePointAttempted: 0,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
      rebounds: 0,
      offensiveRebounds: 0,
      defensiveRebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      fouls: 0,
      pointsInPaint: 0,
      secondChancePoints: 0,
      fastBreakPoints: 0,
      benchPoints: 0,
    };

    teamPlays.forEach((play) => {
      switch (play.playType) {
        case "shot_made":
          stats.fieldGoalsMade++;
          stats.fieldGoalsAttempted++;
          break;
        case "shot_missed":
          stats.fieldGoalsAttempted++;
          break;
        case "three_made":
          stats.threePointMade++;
          stats.threePointAttempted++;
          stats.fieldGoalsMade++;
          stats.fieldGoalsAttempted++;
          break;
        case "three_missed":
          stats.threePointAttempted++;
          stats.fieldGoalsAttempted++;
          break;
        case "free_throw_made":
          stats.freeThrowsMade++;
          stats.freeThrowsAttempted++;
          break;
        case "free_throw_missed":
          stats.freeThrowsAttempted++;
          break;
        case "turnover":
          stats.turnovers++;
          break;
      }
    });

    // Count assists
    stats.assists = teamPlays.filter((p) => p.assistPlayer).length;

    return stats;
  };

  const homeStats = calculateTeamStats(homeTeam?.id || "");
  const awayStats = calculateTeamStats(awayTeam?.id || "");

  // Speed settings
  const getSpeedDelay = () => {
    switch (speed) {
      case "slow":
        return 2000;
      case "normal":
        return 1000;
      case "fast":
        return 300;
      default:
        return 1000;
    }
  };

  // Track quarter scores when quarter ends
  useEffect(() => {
    const quarterEndPlays = plays.filter((p) => p.playType === "quarter_end");
    const newQuarterScores: QuarterScore[] = quarterEndPlays.map((play) => ({
      quarter: play.quarter,
      homeScore: play.homeScore,
      awayScore: play.awayScore,
    }));
    setQuarterScores(newQuarterScores);
  }, [plays]);

  // Simulate play by play
  useEffect(() => {
    if (!homeTeam || !awayTeam || !game || isFinished || isPaused) return;

    const interval = setInterval(() => {
      const { play, newState, quarterEnded, gameEnded, timeElapsed } = generateNextPlay(
        homeTeam,
        awayTeam,
        homeRosterPlayers,
        awayRosterPlayers,
        {
          quarter: gameState.quarter,
          time: gameState.time,
          homeScore: gameState.homeScore,
          awayScore: gameState.awayScore,
          possession: gameState.possession,
        }
      );

      setPlays((prev) => [...prev, play]);

      // Update game state
      setGameState((prev) => ({
        ...prev,
        quarter: newState.quarter,
        time: newState.time,
        homeScore: newState.homeScore,
        awayScore: newState.awayScore,
        possession: newState.possession,
      }));

      // Update player stats and minutes (skip for quarter/game end)
      if (play.playType !== "quarter_end" && play.playType !== "game_end") {
        updateGameStateFromPlay(play, timeElapsed);
      }

      if (gameEnded) {
        setIsFinished(true);
        setIsSimulating(false);

        // Update game in store
        setTimeout(() => {
          simulateGame(gameId);
        }, 100);

        clearInterval(interval);
      }

      // Auto-scroll to bottom on play-by-play tab
      if (activeTab === "play-by-play") {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    }, getSpeedDelay());

    return () => clearInterval(interval);
  }, [
    homeTeam,
    awayTeam,
    game,
    gameState.quarter,
    gameState.time,
    gameState.homeScore,
    gameState.awayScore,
    gameState.possession,
    isFinished,
    isPaused,
    speed,
    gameId,
    simulateGame,
    activeTab,
  ]);

  const handleSpeedChange = () => {
    if (speed === "slow") setSpeed("normal");
    else if (speed === "normal") setSpeed("fast");
    else setSpeed("slow");
  };

  const handleFinish = () => {
    if (!isFinished) {
      setSpeed("fast");
    } else {
      navigation.goBack();
    }
  };

  if (!game || !homeTeam || !awayTeam) {
    return (
      <View className="flex-1 bg-gray-950 items-center justify-center">
        <Text className="text-white">Game not found</Text>
      </View>
    );
  }

  const getPlayIcon = (play: Play) => {
    switch (play.playType) {
      case "shot_made":
      case "three_made":
        return "basketball";
      case "shot_missed":
      case "three_missed":
        return "close-circle";
      case "rebound":
        return "hand-right";
      case "steal":
        return "flash";
      case "block":
        return "hand-left";
      case "turnover":
        return "warning";
      case "foul":
        return "alert-circle";
      case "quarter_end":
        return "time";
      case "game_end":
        return "trophy";
      default:
        return "ellipse";
    }
  };

  const getPlayColor = (play: Play) => {
    switch (play.playType) {
      case "shot_made":
      case "three_made":
        return "text-green-400";
      case "shot_missed":
      case "three_missed":
        return "text-red-400";
      case "steal":
      case "block":
        return "text-blue-400";
      case "turnover":
      case "foul":
        return "text-yellow-400";
      case "quarter_end":
      case "game_end":
        return "text-purple-400";
      default:
        return "text-gray-400";
    }
  };

  // Helper to render stat comparison row
  const renderStatRow = (
    label: string,
    awayStat: string | number,
    homeStat: string | number,
    isLast?: boolean
  ) => {
    const awayValue = typeof awayStat === "string" ? parseFloat(awayStat) : awayStat;
    const homeValue = typeof homeStat === "string" ? parseFloat(homeStat) : homeStat;
    const awayLeading = awayValue > homeValue;
    const homeLeading = homeValue > awayValue;

    return (
      <View
        className={`flex-row items-center py-3 ${!isLast ? "border-b border-gray-700" : ""}`}
      >
        <View className="flex-1 items-end pr-4">
          <Text
            className={`text-base ${awayLeading ? "text-white font-bold" : "text-gray-400"}`}
          >
            {awayStat}
          </Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-gray-300 text-sm">{label}</Text>
        </View>
        <View className="flex-1 items-start pl-4">
          <Text
            className={`text-base ${homeLeading ? "text-white font-bold" : "text-gray-400"}`}
          >
            {homeStat}
          </Text>
        </View>
      </View>
    );
  };

  // Calculate quarter-by-quarter scores
  const getQuarterByQuarterScores = () => {
    const quarters: { quarter: number; awayPoints: number; homePoints: number }[] = [];

    let prevAwayScore = 0;
    let prevHomeScore = 0;

    quarterScores.forEach((qs) => {
      quarters.push({
        quarter: qs.quarter,
        awayPoints: qs.awayScore - prevAwayScore,
        homePoints: qs.homeScore - prevHomeScore,
      });
      prevAwayScore = qs.awayScore;
      prevHomeScore = qs.homeScore;
    });

    // Add current quarter if game is ongoing
    if (!isFinished && gameState.quarter > quarters.length) {
      const lastQuarterAwayScore = quarters.length > 0 ? quarterScores[quarters.length - 1]?.awayScore || 0 : 0;
      const lastQuarterHomeScore = quarters.length > 0 ? quarterScores[quarters.length - 1]?.homeScore || 0 : 0;

      quarters.push({
        quarter: gameState.quarter,
        awayPoints: gameState.awayScore - lastQuarterAwayScore,
        homePoints: gameState.homeScore - lastQuarterHomeScore,
      });
    }

    return quarters;
  };

  const quarterByQuarter = getQuarterByQuarterScores();

  // Split players into active (with minutes) and bench (no minutes)
  const getPlayersWithMinutes = (playersList: PlayerBoxScore[]) => {
    return [...playersList]
      .filter((p) => p.minutesPlayed > 0)
      .sort((a, b) => b.minutesPlayed - a.minutesPlayed);
  };

  const getBenchPlayers = (playersList: PlayerBoxScore[]) => {
    return [...playersList].filter((p) => p.minutesPlayed === 0);
  };

  return (
    <View className="flex-1 bg-gray-950">
      {/* Header */}
      <View
        className="bg-gray-900 border-b border-gray-800"
        style={{ paddingTop: insets.top + 12 }}
      >
        <View className="px-4 pb-4">
          {/* Back Button */}
          <Pressable
            onPress={() => navigation.goBack()}
            className="flex-row items-center gap-2 mb-4 active:opacity-70"
          >
            <Ionicons name="arrow-back" size={24} color="#60A5FA" />
            <Text className="text-blue-400 text-base">Back</Text>
          </Pressable>

          {/* Scoreboard */}
          <View className="bg-gray-800 rounded-lg p-4">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-1 items-center">
                <Text className="text-gray-400 text-xs mb-1">AWAY</Text>
                <Text className="text-white text-lg font-bold text-center">
                  {awayTeam.city}
                </Text>
                <Text className="text-white text-lg font-bold text-center">
                  {awayTeam.name}
                </Text>
                <Text className="text-green-400 text-3xl font-bold mt-2">
                  {gameState.awayScore}
                </Text>
              </View>

              <View className="items-center px-4">
                <Text className="text-gray-500 text-xl font-bold">@</Text>
              </View>

              <View className="flex-1 items-center">
                <Text className="text-gray-400 text-xs mb-1">HOME</Text>
                <Text className="text-white text-lg font-bold text-center">
                  {homeTeam.city}
                </Text>
                <Text className="text-white text-lg font-bold text-center">
                  {homeTeam.name}
                </Text>
                <Text className="text-green-400 text-3xl font-bold mt-2">
                  {gameState.homeScore}
                </Text>
              </View>
            </View>

            {/* Game Status */}
            <View className="border-t border-gray-700 pt-3 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Text className="text-white font-bold">Q{gameState.quarter}</Text>
                <Text className="text-gray-400">
                  {Math.floor(gameState.time / 60)}:
                  {(gameState.time % 60).toString().padStart(2, "0")}
                </Text>
              </View>

              {isSimulating && !isFinished && (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator size="small" color="#60A5FA" />
                  <Text className="text-blue-400 text-sm">Live</Text>
                </View>
              )}

              {isFinished && (
                <View className="bg-purple-900/30 border border-purple-700 rounded px-2 py-1">
                  <Text className="text-purple-400 text-xs font-bold">FINAL</Text>
                </View>
              )}
            </View>
          </View>

          {/* Controls */}
          <View className="flex-row items-center gap-2 mt-3">
            {!isFinished && (
              <>
                <Pressable
                  onPress={() => setIsPaused(!isPaused)}
                  className="flex-1 bg-blue-600 rounded-lg p-3 active:bg-blue-700 flex-row items-center justify-center gap-2"
                >
                  <Ionicons name={isPaused ? "play" : "pause"} size={20} color="white" />
                  <Text className="text-white font-semibold">
                    {isPaused ? "Resume" : "Pause"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleSpeedChange}
                  className="bg-gray-700 rounded-lg p-3 active:bg-gray-600 flex-row items-center gap-2"
                >
                  <Ionicons name="speedometer" size={20} color="white" />
                  <Text className="text-white font-semibold capitalize">{speed}</Text>
                </Pressable>
              </>
            )}

            <Pressable
              onPress={handleFinish}
              className="flex-1 bg-gray-700 rounded-lg p-3 active:bg-gray-600"
            >
              <Text className="text-white font-semibold text-center">
                {isFinished ? "Done" : "Skip to End"}
              </Text>
            </Pressable>
          </View>

          {/* Tabs */}
          <View className="flex-row bg-gray-800 rounded-lg p-1 mt-3">
            <Pressable
              onPress={() => setActiveTab("play-by-play")}
              className={`flex-1 py-2 rounded-md ${
                activeTab === "play-by-play" ? "bg-blue-600" : "bg-transparent"
              }`}
            >
              <Text
                className={`text-center text-sm font-semibold ${
                  activeTab === "play-by-play" ? "text-white" : "text-gray-400"
                }`}
              >
                Play-by-Play
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("box-score")}
              className={`flex-1 py-2 rounded-md ${
                activeTab === "box-score" ? "bg-blue-600" : "bg-transparent"
              }`}
            >
              <Text
                className={`text-center text-sm font-semibold ${
                  activeTab === "box-score" ? "text-white" : "text-gray-400"
                }`}
              >
                Box Score
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("team-comparison")}
              className={`flex-1 py-2 rounded-md ${
                activeTab === "team-comparison" ? "bg-blue-600" : "bg-transparent"
              }`}
            >
              <Text
                className={`text-center text-sm font-semibold ${
                  activeTab === "team-comparison" ? "text-white" : "text-gray-400"
                }`}
              >
                Comparison
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Tab Content */}
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Play by Play Tab */}
        {activeTab === "play-by-play" && (
          <View className="px-4 py-4">
            {plays.length === 0 && (
              <View className="items-center justify-center py-8">
                <ActivityIndicator size="large" color="#60A5FA" />
                <Text className="text-gray-400 mt-4">Starting game...</Text>
              </View>
            )}

            {plays.map((play, index) => {
              const isQuarterEnd = play.playType === "quarter_end";
              const isGameEnd = play.playType === "game_end";

              if (isQuarterEnd || isGameEnd) {
                return (
                  <View
                    key={play.id}
                    className="bg-purple-900/20 border border-purple-700 rounded-lg p-4 mb-3"
                  >
                    <View className="flex-row items-center justify-center gap-2">
                      <Ionicons name={getPlayIcon(play)} size={24} color="#C084FC" />
                      <Text className="text-purple-400 font-bold text-lg">
                        {play.description}
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-center gap-4 mt-2">
                      <Text className="text-gray-300">
                        {awayTeam.name}: {play.awayScore}
                      </Text>
                      <Text className="text-gray-500">•</Text>
                      <Text className="text-gray-300">
                        {homeTeam.name}: {play.homeScore}
                      </Text>
                    </View>
                  </View>
                );
              }

              return (
                <View
                  key={play.id}
                  className="bg-gray-800 rounded-lg p-3 mb-2 flex-row items-start gap-3"
                >
                  <View className="items-center" style={{ width: 60 }}>
                    <Text className="text-gray-500 text-xs font-bold">Q{play.quarter}</Text>
                    <Text className="text-gray-400 text-xs">{play.time}</Text>
                  </View>

                  <View className="flex-1">
                    <View className="flex-row items-start gap-2">
                      <Ionicons
                        name={getPlayIcon(play)}
                        size={18}
                        color={
                          play.playType === "shot_made" || play.playType === "three_made"
                            ? "#4ADE80"
                            : play.playType === "shot_missed" || play.playType === "three_missed"
                            ? "#F87171"
                            : "#9CA3AF"
                        }
                      />
                      <Text className={`flex-1 text-sm ${getPlayColor(play)}`}>
                        {play.description}
                      </Text>
                    </View>
                  </View>

                  <View className="items-end" style={{ width: 60 }}>
                    <Text className="text-white text-sm font-bold">
                      {play.awayScore}-{play.homeScore}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Box Score Tab */}
        {activeTab === "box-score" && (
          <View className="px-4 py-4">
            {/* Away Team */}
            <View className="mb-6">
              <View className="flex-row items-center gap-2 mb-3">
                <Text className="text-xl">{awayTeam.logo}</Text>
                <Text className="text-white text-lg font-bold">
                  {awayTeam.city} {awayTeam.name}
                </Text>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="bg-gray-800 rounded-lg overflow-hidden">
                  {/* Header */}
                  <View className="flex-row bg-gray-900 p-2 border-b border-gray-700">
                    <Text className="text-gray-400 text-xs font-bold" style={{ width: 120 }}>PLAYER</Text>
                    <Text className="text-gray-400 text-xs font-bold w-12 text-center">MIN</Text>
                    <Text className="text-gray-400 text-xs font-bold w-10 text-center">PTS</Text>
                    <Text className="text-gray-400 text-xs font-bold w-16 text-center">FG</Text>
                    <Text className="text-gray-400 text-xs font-bold w-16 text-center">3PT</Text>
                    <Text className="text-gray-400 text-xs font-bold w-16 text-center">FT</Text>
                    <Text className="text-gray-400 text-xs font-bold w-10 text-center">REB</Text>
                    <Text className="text-gray-400 text-xs font-bold w-10 text-center">AST</Text>
                    <Text className="text-gray-400 text-xs font-bold w-10 text-center">STL</Text>
                    <Text className="text-gray-400 text-xs font-bold w-10 text-center">BLK</Text>
                    <Text className="text-gray-400 text-xs font-bold w-10 text-center">TO</Text>
                  </View>

                  {/* Active Players (with minutes) */}
                  {getPlayersWithMinutes(gameState.awayPlayers).map((player, idx) => (
                    <View
                      key={player.playerId}
                      className={`flex-row p-2 ${
                        idx % 2 === 0 ? "bg-gray-800" : "bg-gray-850"
                      }`}
                    >
                      <View style={{ width: 120 }}>
                        <Text className="text-white text-xs" numberOfLines={1}>
                          {player.fullName}
                        </Text>
                        <Text className="text-gray-500 text-xs">{player.position}</Text>
                      </View>
                      <Text className="text-white text-xs w-12 text-center">
                        {player.minutesPlayed.toFixed(1)}
                      </Text>
                      <Text className="text-white text-xs w-10 text-center font-bold">
                        {player.stats.points}
                      </Text>
                      <Text className="text-gray-300 text-xs w-16 text-center">
                        {player.stats.fgMade}-{player.stats.fgAtt}
                      </Text>
                      <Text className="text-gray-300 text-xs w-16 text-center">
                        {player.stats.threeMade}-{player.stats.threeAtt}
                      </Text>
                      <Text className="text-gray-300 text-xs w-16 text-center">
                        {player.stats.ftMade}-{player.stats.ftAtt}
                      </Text>
                      <Text className="text-white text-xs w-10 text-center">
                        {player.stats.rebounds}
                      </Text>
                      <Text className="text-white text-xs w-10 text-center">
                        {player.stats.assists}
                      </Text>
                      <Text className="text-white text-xs w-10 text-center">
                        {player.stats.steals}
                      </Text>
                      <Text className="text-white text-xs w-10 text-center">
                        {player.stats.blocks}
                      </Text>
                      <Text className="text-white text-xs w-10 text-center">
                        {player.stats.turnovers}
                      </Text>
                    </View>
                  ))}

                  {/* Bench Section Divider */}
                  {getBenchPlayers(gameState.awayPlayers).length > 0 && (
                    <View className="bg-gray-700 p-2 border-t border-gray-600">
                      <Text className="text-gray-300 text-xs font-bold">BENCH</Text>
                    </View>
                  )}

                  {/* Bench Players (no minutes) */}
                  {getBenchPlayers(gameState.awayPlayers).map((player, idx) => (
                    <View
                      key={player.playerId}
                      className={`flex-row p-2 ${
                        idx % 2 === 0 ? "bg-gray-800/50" : "bg-gray-850/50"
                      }`}
                    >
                      <View style={{ width: 120 }}>
                        <Text className="text-gray-400 text-xs" numberOfLines={1}>
                          {player.fullName}
                        </Text>
                        <Text className="text-gray-600 text-xs">{player.position}</Text>
                      </View>
                      <Text className="text-gray-500 text-xs w-12 text-center">
                        {player.minutesPlayed.toFixed(1)}
                      </Text>
                      <Text className="text-gray-500 text-xs w-10 text-center">
                        {player.stats.points}
                      </Text>
                      <Text className="text-gray-600 text-xs w-16 text-center">
                        {player.stats.fgMade}-{player.stats.fgAtt}
                      </Text>
                      <Text className="text-gray-600 text-xs w-16 text-center">
                        {player.stats.threeMade}-{player.stats.threeAtt}
                      </Text>
                      <Text className="text-gray-600 text-xs w-16 text-center">
                        {player.stats.ftMade}-{player.stats.ftAtt}
                      </Text>
                      <Text className="text-gray-500 text-xs w-10 text-center">
                        {player.stats.rebounds}
                      </Text>
                      <Text className="text-gray-500 text-xs w-10 text-center">
                        {player.stats.assists}
                      </Text>
                      <Text className="text-gray-500 text-xs w-10 text-center">
                        {player.stats.steals}
                      </Text>
                      <Text className="text-gray-500 text-xs w-10 text-center">
                        {player.stats.blocks}
                      </Text>
                      <Text className="text-gray-500 text-xs w-10 text-center">
                        {player.stats.turnovers}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Home Team */}
            <View className="mb-6">
              <View className="flex-row items-center gap-2 mb-3">
                <Text className="text-xl">{homeTeam.logo}</Text>
                <Text className="text-white text-lg font-bold">
                  {homeTeam.city} {homeTeam.name}
                </Text>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="bg-gray-800 rounded-lg overflow-hidden">
                  {/* Header */}
                  <View className="flex-row bg-gray-900 p-2 border-b border-gray-700">
                    <Text className="text-gray-400 text-xs font-bold" style={{ width: 120 }}>PLAYER</Text>
                    <Text className="text-gray-400 text-xs font-bold w-12 text-center">MIN</Text>
                    <Text className="text-gray-400 text-xs font-bold w-10 text-center">PTS</Text>
                    <Text className="text-gray-400 text-xs font-bold w-16 text-center">FG</Text>
                    <Text className="text-gray-400 text-xs font-bold w-16 text-center">3PT</Text>
                    <Text className="text-gray-400 text-xs font-bold w-16 text-center">FT</Text>
                    <Text className="text-gray-400 text-xs font-bold w-10 text-center">REB</Text>
                    <Text className="text-gray-400 text-xs font-bold w-10 text-center">AST</Text>
                    <Text className="text-gray-400 text-xs font-bold w-10 text-center">STL</Text>
                    <Text className="text-gray-400 text-xs font-bold w-10 text-center">BLK</Text>
                    <Text className="text-gray-400 text-xs font-bold w-10 text-center">TO</Text>
                  </View>

                  {/* Active Players (with minutes) */}
                  {getPlayersWithMinutes(gameState.homePlayers).map((player, idx) => (
                    <View
                      key={player.playerId}
                      className={`flex-row p-2 ${
                        idx % 2 === 0 ? "bg-gray-800" : "bg-gray-850"
                      }`}
                    >
                      <View style={{ width: 120 }}>
                        <Text className="text-white text-xs" numberOfLines={1}>
                          {player.fullName}
                        </Text>
                        <Text className="text-gray-500 text-xs">{player.position}</Text>
                      </View>
                      <Text className="text-white text-xs w-12 text-center">
                        {player.minutesPlayed.toFixed(1)}
                      </Text>
                      <Text className="text-white text-xs w-10 text-center font-bold">
                        {player.stats.points}
                      </Text>
                      <Text className="text-gray-300 text-xs w-16 text-center">
                        {player.stats.fgMade}-{player.stats.fgAtt}
                      </Text>
                      <Text className="text-gray-300 text-xs w-16 text-center">
                        {player.stats.threeMade}-{player.stats.threeAtt}
                      </Text>
                      <Text className="text-gray-300 text-xs w-16 text-center">
                        {player.stats.ftMade}-{player.stats.ftAtt}
                      </Text>
                      <Text className="text-white text-xs w-10 text-center">
                        {player.stats.rebounds}
                      </Text>
                      <Text className="text-white text-xs w-10 text-center">
                        {player.stats.assists}
                      </Text>
                      <Text className="text-white text-xs w-10 text-center">
                        {player.stats.steals}
                      </Text>
                      <Text className="text-white text-xs w-10 text-center">
                        {player.stats.blocks}
                      </Text>
                      <Text className="text-white text-xs w-10 text-center">
                        {player.stats.turnovers}
                      </Text>
                    </View>
                  ))}

                  {/* Bench Section Divider */}
                  {getBenchPlayers(gameState.homePlayers).length > 0 && (
                    <View className="bg-gray-700 p-2 border-t border-gray-600">
                      <Text className="text-gray-300 text-xs font-bold">BENCH</Text>
                    </View>
                  )}

                  {/* Bench Players (no minutes) */}
                  {getBenchPlayers(gameState.homePlayers).map((player, idx) => (
                    <View
                      key={player.playerId}
                      className={`flex-row p-2 ${
                        idx % 2 === 0 ? "bg-gray-800/50" : "bg-gray-850/50"
                      }`}
                    >
                      <View style={{ width: 120 }}>
                        <Text className="text-gray-400 text-xs" numberOfLines={1}>
                          {player.fullName}
                        </Text>
                        <Text className="text-gray-600 text-xs">{player.position}</Text>
                      </View>
                      <Text className="text-gray-500 text-xs w-12 text-center">
                        {player.minutesPlayed.toFixed(1)}
                      </Text>
                      <Text className="text-gray-500 text-xs w-10 text-center">
                        {player.stats.points}
                      </Text>
                      <Text className="text-gray-600 text-xs w-16 text-center">
                        {player.stats.fgMade}-{player.stats.fgAtt}
                      </Text>
                      <Text className="text-gray-600 text-xs w-16 text-center">
                        {player.stats.threeMade}-{player.stats.threeAtt}
                      </Text>
                      <Text className="text-gray-600 text-xs w-16 text-center">
                        {player.stats.ftMade}-{player.stats.ftAtt}
                      </Text>
                      <Text className="text-gray-500 text-xs w-10 text-center">
                        {player.stats.rebounds}
                      </Text>
                      <Text className="text-gray-500 text-xs w-10 text-center">
                        {player.stats.assists}
                      </Text>
                      <Text className="text-gray-500 text-xs w-10 text-center">
                        {player.stats.steals}
                      </Text>
                      <Text className="text-gray-500 text-xs w-10 text-center">
                        {player.stats.blocks}
                      </Text>
                      <Text className="text-gray-500 text-xs w-10 text-center">
                        {player.stats.turnovers}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        )}

        {/* Team Comparison Tab */}
        {activeTab === "team-comparison" && (
          <View className="px-4 py-4">
            {/* Header with team names and scores */}
            <View className="bg-gray-800 rounded-lg p-4 mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-1 items-center">
                  <Text className="text-xl mb-1">{awayTeam.logo}</Text>
                  <Text className="text-white text-base font-bold text-center">
                    {awayTeam.city} {awayTeam.name}
                  </Text>
                  <Text className="text-green-400 text-2xl font-bold mt-1">
                    {gameState.awayScore}
                  </Text>
                </View>
                <View className="px-4">
                  <Text className="text-gray-500 text-lg">vs</Text>
                </View>
                <View className="flex-1 items-center">
                  <Text className="text-xl mb-1">{homeTeam.logo}</Text>
                  <Text className="text-white text-base font-bold text-center">
                    {homeTeam.city} {homeTeam.name}
                  </Text>
                  <Text className="text-green-400 text-2xl font-bold mt-1">
                    {gameState.homeScore}
                  </Text>
                </View>
              </View>
              <Text className="text-gray-400 text-xs text-center mt-2">Team Comparison</Text>
            </View>

            {/* Score by Period */}
            {quarterByQuarter.length > 0 && (
              <View className="bg-gray-800 rounded-lg p-4 mb-4">
                <Text className="text-white text-base font-bold mb-3">Score by Period</Text>
                <View className="border border-gray-700 rounded-lg overflow-hidden">
                  {/* Header Row */}
                  <View className="flex-row bg-gray-900">
                    <View className="flex-1 p-2 border-r border-gray-700">
                      <Text className="text-gray-400 text-xs text-center">Team</Text>
                    </View>
                    {quarterByQuarter.map((q) => (
                      <View key={q.quarter} className="w-12 p-2 border-r border-gray-700">
                        <Text className="text-gray-400 text-xs text-center">
                          {q.quarter <= 4 ? q.quarter : `OT${q.quarter - 4}`}
                        </Text>
                      </View>
                    ))}
                    <View className="w-14 p-2">
                      <Text className="text-gray-400 text-xs text-center font-bold">TOT</Text>
                    </View>
                  </View>

                  {/* Away Team Row */}
                  <View className="flex-row border-t border-gray-700">
                    <View className="flex-1 p-2 border-r border-gray-700 justify-center">
                      <Text className="text-white text-xs">{awayTeam.name}</Text>
                    </View>
                    {quarterByQuarter.map((q) => (
                      <View key={q.quarter} className="w-12 p-2 border-r border-gray-700 justify-center">
                        <Text className="text-white text-xs text-center">{q.awayPoints}</Text>
                      </View>
                    ))}
                    <View className="w-14 p-2 justify-center">
                      <Text className="text-white text-xs text-center font-bold">
                        {gameState.awayScore}
                      </Text>
                    </View>
                  </View>

                  {/* Home Team Row */}
                  <View className="flex-row border-t border-gray-700">
                    <View className="flex-1 p-2 border-r border-gray-700 justify-center">
                      <Text className="text-white text-xs">{homeTeam.name}</Text>
                    </View>
                    {quarterByQuarter.map((q) => (
                      <View key={q.quarter} className="w-12 p-2 border-r border-gray-700 justify-center">
                        <Text className="text-white text-xs text-center">{q.homePoints}</Text>
                      </View>
                    ))}
                    <View className="w-14 p-2 justify-center">
                      <Text className="text-white text-xs text-center font-bold">
                        {gameState.homeScore}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Team Stats */}
            <View className="bg-gray-800 rounded-lg p-4">
              <Text className="text-white text-base font-bold mb-4 text-center">
                Team Statistics
              </Text>

              {/* Field Goals */}
              {renderStatRow(
                "Field Goals",
                `${awayStats.fieldGoalsMade}-${awayStats.fieldGoalsAttempted}`,
                `${homeStats.fieldGoalsMade}-${homeStats.fieldGoalsAttempted}`
              )}
              {renderStatRow(
                "FG%",
                awayStats.fieldGoalsAttempted > 0
                  ? `${((awayStats.fieldGoalsMade / awayStats.fieldGoalsAttempted) * 100).toFixed(1)}%`
                  : "0.0%",
                homeStats.fieldGoalsAttempted > 0
                  ? `${((homeStats.fieldGoalsMade / homeStats.fieldGoalsAttempted) * 100).toFixed(1)}%`
                  : "0.0%"
              )}

              {/* 3-Pointers */}
              {renderStatRow(
                "3-Point",
                `${awayStats.threePointMade}-${awayStats.threePointAttempted}`,
                `${homeStats.threePointMade}-${homeStats.threePointAttempted}`
              )}
              {renderStatRow(
                "3P%",
                awayStats.threePointAttempted > 0
                  ? `${((awayStats.threePointMade / awayStats.threePointAttempted) * 100).toFixed(1)}%`
                  : "0.0%",
                homeStats.threePointAttempted > 0
                  ? `${((homeStats.threePointMade / homeStats.threePointAttempted) * 100).toFixed(1)}%`
                  : "0.0%"
              )}

              {/* Free Throws */}
              {renderStatRow(
                "Free Throws",
                `${awayStats.freeThrowsMade}-${awayStats.freeThrowsAttempted}`,
                `${homeStats.freeThrowsMade}-${homeStats.freeThrowsAttempted}`
              )}
              {renderStatRow(
                "FT%",
                awayStats.freeThrowsAttempted > 0
                  ? `${((awayStats.freeThrowsMade / awayStats.freeThrowsAttempted) * 100).toFixed(1)}%`
                  : "0.0%",
                homeStats.freeThrowsAttempted > 0
                  ? `${((homeStats.freeThrowsMade / homeStats.freeThrowsAttempted) * 100).toFixed(1)}%`
                  : "0.0%"
              )}

              {/* Other Stats */}
              {renderStatRow("Assists", awayStats.assists, homeStats.assists)}
              {renderStatRow("Turnovers", awayStats.turnovers, homeStats.turnovers, true)}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
