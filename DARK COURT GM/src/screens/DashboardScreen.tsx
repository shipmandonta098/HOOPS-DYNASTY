import React, { useState, useEffect, useMemo } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useBasketballStore } from "../state/basketballStore";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CoachDetailsModal from "../components/CoachDetailsModal";
import WelcomeModal from "../components/WelcomeModal";
import {
  getRivalryBetweenTeams,
  getRivalryDisplayText,
  getRivalryColor,
  getRivalryTextColor,
} from "../utils/rivalry";
import { getSOSColor, calculateTeamOVR } from "../utils/strengthOfSchedule";
import { getMomentumColor } from "../utils/powerRankings";

type Props = NativeStackScreenProps<RootStackParamList, "Dashboard">;

export default function DashboardScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [coachModalVisible, setCoachModalVisible] = useState(false);
  const [welcomeModalVisible, setWelcomeModalVisible] = useState(false);

  const teams = useBasketballStore((s) => s.teams);
  const players = useBasketballStore((s) => s.players);
  const coaches = useBasketballStore((s) => s.coaches);
  const season = useBasketballStore((s) => s.season);
  const userTeamId = useBasketballStore((s) => s.userTeamId);
  const simulateWeek = useBasketballStore((s) => s.simulateWeek);
  const savedLeagues = useBasketballStore((s) => s.savedLeagues);
  const currentLeagueId = useBasketballStore((s) => s.currentLeagueId);
  const markWelcomeSeen = useBasketballStore((s) => s.markWelcomeSeen);
  const getTeamSOS = useBasketballStore((s) => s.getTeamSOS);
  const getTeamOdds = useBasketballStore((s) => s.getTeamOdds);

  const userTeam = teams.find((t) => t.id === userTeamId);
  const userRoster = players.filter((p) => userTeam?.playerIds.includes(p.id));
  const userCoach = coaches.find((c) => c.id === userTeam?.coachId);
  const currentLeague = savedLeagues.find((l) => l.id === currentLeagueId);
  const getSettings = useBasketballStore((s) => s.getSettings);
  const settings = getSettings();

  // Get SOS data for user team
  const userTeamSOS = useMemo(() => {
    return getTeamSOS(userTeamId);
  }, [userTeamId, teams, season.games, getTeamSOS]);

  // Get odds for user team
  const userTeamOdds = useMemo(() => {
    const odds = getTeamOdds(userTeamId);
    return odds && typeof odds === "object" && "championshipOdds" in odds ? odds : null;
  }, [userTeamId, getTeamOdds]);

  // Get power ranking for user team
  const getTeamPowerRanking = useBasketballStore((s) => s.getTeamPowerRanking);
  const userPowerRanking = useMemo(() => {
    return getTeamPowerRanking(userTeamId);
  }, [userTeamId, getTeamPowerRanking]);

  // Check if this is a new league and show welcome message
  useEffect(() => {
    if (currentLeague && !currentLeague.hasSeenWelcome) {
      setWelcomeModalVisible(true);
    }
  }, [currentLeague]);

  const handleCloseWelcome = () => {
    setWelcomeModalVisible(false);
    markWelcomeSeen();
  };

  // Calculate team ratings
  const calculateTeamRatings = () => {
    if (!userRoster.length) return { offense: 0, defense: 0, overall: 0 };

    const topPlayers = [...userRoster].sort((a, b) => b.overall - a.overall).slice(0, 8);

    const offense = Math.round(
      topPlayers.reduce((sum, p) => {
        return sum + (p.attributes.threePointShooting + p.attributes.freeThrowShooting + p.attributes.clutch + p.attributes.finishing + p.attributes.shotCreation) / 5;
      }, 0) / topPlayers.length
    );

    const defense = Math.round(
      topPlayers.reduce((sum, p) => sum + (p.attributes.perimeterDefense + p.attributes.interiorDefense + p.attributes.defensiveAwareness) / 3, 0) / topPlayers.length
    );

    const overall = Math.round(
      topPlayers.reduce((sum, p) => sum + p.overall, 0) / topPlayers.length
    );

    return { offense, defense, overall };
  };

  const teamRatings = calculateTeamRatings();

  // Calculate efficiency metrics
  const calculateEfficiencyMetrics = () => {
    if (!userRoster.length) {
      return { eFG: 0, tov: 0, orb: 0, ftRate: 0 };
    }

    const topPlayers = [...userRoster].sort((a, b) => b.overall - a.overall).slice(0, 8);

    // eFG% - Effective Field Goal Percentage
    // Higher three-point shooting and overall offense = better eFG%
    // Formula: Base 45% + modifiers from shooting attributes
    const avgThreePoint = topPlayers.reduce((sum, p) => sum + p.attributes.threePointShooting, 0) / topPlayers.length;
    const avgOffense = topPlayers.reduce((sum, p) => sum + (p.attributes.threePointShooting + p.attributes.freeThrowShooting) / 2, 0) / topPlayers.length;
    const eFG = 45 + (avgOffense - 70) * 0.15 + (avgThreePoint - 70) * 0.1;

    // TOV% - Turnover Percentage (lower is better, but we display as is)
    // Higher basketball IQ and better guards = lower turnovers
    // Formula: Base 14% - modifiers from IQ
    const avgIQ = topPlayers.reduce((sum, p) => sum + p.attributes.basketballIQ, 0) / topPlayers.length;
    const guardCount = topPlayers.filter((p) => p.position === "PG" || p.position === "SG").length;
    const tov = Math.max(8, 14 - (avgIQ - 70) * 0.08 - guardCount * 0.3);

    // ORB% - Offensive Rebound Percentage
    // Higher strength and more big men = better offensive rebounding
    // Formula: Base 25% + modifiers from strength and position
    const avgStrength = topPlayers.reduce((sum, p) => sum + p.attributes.strength, 0) / topPlayers.length;
    const bigManCount = topPlayers.filter((p) => p.position === "PF" || p.position === "C").length;
    const orb = 25 + (avgStrength - 70) * 0.12 + bigManCount * 0.8;

    // FT Rate - Free Throws per Field Goal Attempt
    // Higher aggression, strength, and free throw rating = more trips to the line
    // Formula: Base 0.20 + modifiers
    const avgFT = topPlayers.reduce((sum, p) => sum + p.attributes.freeThrowShooting, 0) / topPlayers.length;
    const avgClutch = topPlayers.reduce((sum, p) => sum + p.attributes.clutch, 0) / topPlayers.length;
    const ftRate = 0.20 + (avgFT - 70) * 0.0035 + (avgClutch - 70) * 0.002 + (avgStrength - 70) * 0.0015;

    return {
      eFG: Math.max(40, Math.min(60, eFG)),
      tov: Math.max(8, Math.min(18, tov)),
      orb: Math.max(20, Math.min(35, orb)),
      ftRate: Math.max(0.15, Math.min(0.35, ftRate)),
    };
  };

  const efficiencyMetrics = calculateEfficiencyMetrics();

  // Get top 3 players
  const topPlayers = [...userRoster].sort((a, b) => b.overall - a.overall).slice(0, 3);

  // Calculate salary info
  const totalSalary = userRoster.reduce((sum, p) => sum + p.contract.salary, 0);
  const capRoom = userTeam ? userTeam.budget - totalSalary : 0;

  // Get standings position
  const sortedTeams = [...teams].sort((a, b) => {
    const aWinPct = a.wins / (a.wins + a.losses || 1);
    const bWinPct = b.wins / (b.wins + b.losses || 1);
    return bWinPct - aWinPct;
  });
  const userStanding = sortedTeams.findIndex((t) => t.id === userTeamId) + 1;

  // Calculate conference and division standings
  const getTeamPositions = () => {
    if (!userTeam || !settings) return null;

    const conferencesEnabled = settings.conferencesEnabled;
    const divisionsEnabled = settings.divisionsEnabled;

    if (!conferencesEnabled) {
      // Show only league position
      return {
        league: userStanding,
        displayText: `${getOrdinal(userStanding)} in League`,
      };
    }

    // Get conference position
    const conferenceTeams = teams.filter((t) => t.conference === userTeam.conference);
    const sortedConference = [...conferenceTeams].sort((a, b) => {
      const aWinPct = a.wins / (a.wins + a.losses || 1);
      const bWinPct = b.wins / (b.wins + b.losses || 1);
      return bWinPct - aWinPct;
    });
    const conferencePosition = sortedConference.findIndex((t) => t.id === userTeamId) + 1;

    if (!divisionsEnabled || !userTeam.division) {
      // Show only conference position
      return {
        conference: conferencePosition,
        displayText: `${getOrdinal(conferencePosition)} in ${userTeam.conference}ern Conference`,
      };
    }

    // Get division position
    const divisionTeams = teams.filter(
      (t) => t.conference === userTeam.conference && t.division === userTeam.division
    );
    const sortedDivision = [...divisionTeams].sort((a, b) => {
      const aWinPct = a.wins / (a.wins + a.losses || 1);
      const bWinPct = b.wins / (b.wins + b.losses || 1);
      return bWinPct - aWinPct;
    });
    const divisionPosition = sortedDivision.findIndex((t) => t.id === userTeamId) + 1;

    return {
      conference: conferencePosition,
      division: divisionPosition,
      displayText: `${getOrdinal(conferencePosition)} in ${userTeam.conference}ern · ${getOrdinal(divisionPosition)} in ${userTeam.division}`,
    };
  };

  const getOrdinal = (n: number): string => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const teamPositions = getTeamPositions();

  // Get next game
  const nextGame = season.games.find((g) => !g.played && (g.homeTeamId === userTeamId || g.awayTeamId === userTeamId));
  const nextOpponent = nextGame
    ? teams.find((t) => t.id === (nextGame.homeTeamId === userTeamId ? nextGame.awayTeamId : nextGame.homeTeamId))
    : null;
  const isHomeGame = nextGame?.homeTeamId === userTeamId;

  // Get rivalry with next opponent
  const nextGameRivalry = nextOpponent
    ? getRivalryBetweenTeams(season.rivalries, userTeamId, nextOpponent.id)
    : null;

  // Get last game result
  const userGames = season.games.filter((g) => g.played && (g.homeTeamId === userTeamId || g.awayTeamId === userTeamId));
  const lastGame = userGames.length > 0 ? userGames[userGames.length - 1] : null;
  const lastOpponent = lastGame
    ? teams.find((t) => t.id === (lastGame.homeTeamId === userTeamId ? lastGame.awayTeamId : lastGame.homeTeamId))
    : null;

  const userWonLast = lastGame
    ? (lastGame.homeTeamId === userTeamId && lastGame.homeScore > lastGame.awayScore) ||
      (lastGame.awayTeamId === userTeamId && lastGame.awayScore > lastGame.homeScore)
    : false;

  // Get alerts (expiring contracts, low satisfaction)
  const alerts = [];

  // Expiring contracts (1 year left)
  const expiringPlayers = userRoster.filter((p) => p.contract.years === 1 && p.overall >= 75);
  if (expiringPlayers.length > 0) {
    alerts.push({
      type: "warning",
      message: `${expiringPlayers.length} contract${expiringPlayers.length > 1 ? "s" : ""} expiring soon`,
    });
  }

  // Low satisfaction
  const unhappyPlayers = userRoster.filter((p) => p.satisfaction !== undefined && p.satisfaction < 40);
  if (unhappyPlayers.length > 0) {
    alerts.push({
      type: "danger",
      message: `${unhappyPlayers.length} unhappy player${unhappyPlayers.length > 1 ? "s" : ""}`,
    });
  }

  // Cap space warning (only if cap is enabled)
  if (settings?.salaryCapEnabled) {
    if (capRoom < 5 && capRoom > 0) {
      alerts.push({
        type: "warning",
        message: "Low cap space remaining",
      });
    } else if (capRoom < 0) {
      alerts.push({
        type: "danger",
        message: "Over salary cap!",
      });
    }
  }

  const getOverallColor = (overall: number) => {
    if (overall >= 90) return "text-purple-400";
    if (overall >= 85) return "text-blue-400";
    if (overall >= 80) return "text-green-400";
    if (overall >= 75) return "text-yellow-400";
    if (overall >= 70) return "text-orange-400";
    return "text-gray-400";
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 85) return "bg-green-600";
    if (rating >= 75) return "bg-blue-600";
    if (rating >= 65) return "bg-yellow-600";
    return "bg-orange-600";
  };

  if (!userTeam) {
    return (
      <View className="flex-1 bg-gray-950 items-center justify-center">
        <Text className="text-white text-lg">Loading...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-950" style={{ paddingTop: insets.top }}>
      <ScrollView className="flex-1">
        {/* Header - Team Info */}
        <View className="px-6 py-6 bg-gradient-to-b from-gray-900 to-gray-950">
          <View className="flex-row items-center mb-4">
            {/* Team Logo/Icon */}
            <View className="w-20 h-20 bg-blue-600 rounded-full items-center justify-center mr-4">
              <Ionicons name="basketball" size={40} color="white" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-400 text-xs uppercase tracking-wider mb-1">Your Team</Text>
              <Text className="text-white text-2xl font-bold">
                {userTeam.city}
              </Text>
              <Text className="text-white text-2xl font-bold">
                {userTeam.name}
              </Text>
              {userCoach && (
                <Pressable
                  onPress={() => setCoachModalVisible(true)}
                  className="flex-row items-center gap-1 mt-1"
                >
                  <Text className="text-gray-400 text-sm">Coach:</Text>
                  <Text className="text-blue-400 text-sm underline">{userCoach.name}</Text>
                  <Ionicons name="information-circle" size={14} color="#60A5FA" />
                </Pressable>
              )}
              {teamPositions && (
                <Text className="text-gray-400 text-sm mt-1">
                  {teamPositions.displayText}
                </Text>
              )}
            </View>
          </View>

          {/* Record and Standing */}
          <View className="flex-row items-center gap-6 mb-4">
            <View>
              <Text className="text-gray-400 text-xs uppercase mb-1">Record</Text>
              <View className="flex-row items-center">
                <Text className="text-green-400 text-3xl font-bold">{userTeam.wins}</Text>
                <Text className="text-gray-500 text-2xl mx-2">-</Text>
                <Text className="text-red-400 text-3xl font-bold">{userTeam.losses}</Text>
              </View>
            </View>
            <View>
              <Text className="text-gray-400 text-xs uppercase mb-1">Power Ranking</Text>
              {userPowerRanking ? (
                <View className="flex-row items-center">
                  <Text className="text-blue-400 text-2xl font-bold">
                    #{userPowerRanking.rank}
                  </Text>
                  <Text className="text-gray-500 text-lg ml-2">in League</Text>
                  {userPowerRanking.trend !== 0 && (
                    <View className="ml-2">
                      <Text
                        className="text-xs font-bold"
                        style={{
                          color: userPowerRanking.trend > 0 ? "#10B981" : "#EF4444",
                        }}
                      >
                        {userPowerRanking.trend > 0 ? `+${userPowerRanking.trend}` : userPowerRanking.trend}
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <Text className="text-blue-400 text-2xl font-bold">
                  #{userStanding} <Text className="text-gray-500 text-lg">in League</Text>
                </Text>
              )}
            </View>
          </View>

          {/* Team Ratings */}
          <View className="bg-gray-800 rounded-xl p-4 mb-3">
            <Text className="text-gray-400 text-xs uppercase tracking-wider mb-3">Team Ratings</Text>
            <View className="flex-row justify-between">
              <View className="items-center">
                <Text className="text-gray-400 text-xs mb-2">Offense</Text>
                <View className={`w-16 h-16 rounded-full ${getRatingColor(teamRatings.offense)} items-center justify-center`}>
                  <Text className="text-white text-xl font-bold">{teamRatings.offense}</Text>
                </View>
              </View>
              <View className="items-center">
                <Text className="text-gray-400 text-xs mb-2">Defense</Text>
                <View className={`w-16 h-16 rounded-full ${getRatingColor(teamRatings.defense)} items-center justify-center`}>
                  <Text className="text-white text-xl font-bold">{teamRatings.defense}</Text>
                </View>
              </View>
              <View className="items-center">
                <Text className="text-gray-400 text-xs mb-2">Overall</Text>
                <View className={`w-16 h-16 rounded-full ${getRatingColor(teamRatings.overall)} items-center justify-center`}>
                  <Text className="text-white text-xl font-bold">{teamRatings.overall}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Efficiency Metrics */}
          <View className="bg-gray-800 rounded-xl p-4 mb-3">
            <Text className="text-gray-400 text-xs uppercase tracking-wider mb-3">Efficiency</Text>
            <View className="flex-row flex-wrap">
              {/* eFG% */}
              <View className="w-1/2 items-center mb-3">
                <Text className="text-white text-2xl font-bold">{efficiencyMetrics.eFG.toFixed(1)}%</Text>
                <Text className="text-gray-400 text-xs mt-1">eFG%</Text>
              </View>

              {/* TOV% */}
              <View className="w-1/2 items-center mb-3">
                <Text className="text-white text-2xl font-bold">{efficiencyMetrics.tov.toFixed(1)}%</Text>
                <Text className="text-gray-400 text-xs mt-1">TOV%</Text>
              </View>

              {/* ORB% */}
              <View className="w-1/2 items-center">
                <Text className="text-white text-2xl font-bold">{efficiencyMetrics.orb.toFixed(1)}%</Text>
                <Text className="text-gray-400 text-xs mt-1">ORB%</Text>
              </View>

              {/* FT Rate */}
              <View className="w-1/2 items-center">
                <Text className="text-white text-2xl font-bold">{efficiencyMetrics.ftRate.toFixed(2)}</Text>
                <Text className="text-gray-400 text-xs mt-1">FT Rate</Text>
              </View>
            </View>
          </View>

          {/* Strength of Schedule */}
          {userTeamSOS && (
            <View className="bg-gray-800 rounded-xl p-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-gray-400 text-xs uppercase tracking-wider">Strength of Schedule</Text>
                <View className="flex-row items-center gap-1">
                  <Text
                    className="text-sm font-bold"
                    style={{ color: getSOSColor(userTeamSOS.label) }}
                  >
                    {userTeamSOS.label}
                  </Text>
                  <Text className="text-gray-500 text-xs">
                    (#{userTeamSOS.rank} toughest)
                  </Text>
                </View>
              </View>

              <View className="flex-row justify-between">
                <View className="flex-1 mr-2">
                  <Text className="text-gray-500 text-xs mb-1">Last 10 Opponents</Text>
                  <View className="bg-gray-900 rounded-lg px-3 py-2">
                    <Text className="text-white text-xl font-bold text-center">
                      {userTeamSOS.last10OpponentsAvgOVR || "N/A"}
                    </Text>
                    <Text className="text-gray-400 text-xs text-center mt-1">Avg OVR</Text>
                  </View>
                </View>

                <View className="flex-1 ml-2">
                  <Text className="text-gray-500 text-xs mb-1">Next 10 Opponents</Text>
                  <View className="bg-gray-900 rounded-lg px-3 py-2">
                    <Text className="text-blue-400 text-xl font-bold text-center">
                      {userTeamSOS.next10OpponentsAvgOVR || "N/A"}
                    </Text>
                    <Text className="text-gray-400 text-xs text-center mt-1">Avg OVR</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Finals Odds */}
        {settings?.showOddsPanel && userTeamOdds && (
          <View className="px-6 py-4">
            <Text className="text-gray-400 text-xs uppercase tracking-wider mb-3">Finals Odds</Text>
            <View className="bg-gray-800 rounded-xl p-4">
              <View className="flex-row flex-wrap">
                {/* Championship Odds */}
                <View className="w-1/2 items-center mb-4">
                  <Text className="text-white text-2xl font-bold">{userTeamOdds.championshipOdds.betting}</Text>
                  <Text className="text-gray-400 text-xs mt-1">Championship</Text>
                  <Text className="text-gray-500 text-xs">({userTeamOdds.championshipOdds.percentage})</Text>
                </View>

                {/* Conference Title Odds */}
                <View className="w-1/2 items-center mb-4">
                  <Text className="text-white text-2xl font-bold">{userTeamOdds.conferenceTitleOdds.betting}</Text>
                  <Text className="text-gray-400 text-xs mt-1">Conference Title</Text>
                  <Text className="text-gray-500 text-xs">({userTeamOdds.conferenceTitleOdds.percentage})</Text>
                </View>

                {/* Playoff Odds */}
                <View className="w-1/2 items-center">
                  <Text className="text-white text-2xl font-bold">{userTeamOdds.playoffOdds.betting}</Text>
                  <Text className="text-gray-400 text-xs mt-1">Playoffs</Text>
                  <Text className="text-gray-500 text-xs">({userTeamOdds.playoffOdds.percentage})</Text>
                </View>

                {/* Division Odds */}
                <View className="w-1/2 items-center">
                  <Text className="text-white text-2xl font-bold">{userTeamOdds.divisionOdds.betting}</Text>
                  <Text className="text-gray-400 text-xs mt-1">Division</Text>
                  <Text className="text-gray-500 text-xs">({userTeamOdds.divisionOdds.percentage})</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Games Section */}
        <View className="px-6 py-4">
          <View className="flex-row gap-3">
            {/* Last Game */}
            {lastGame && lastOpponent ? (
              <View className="flex-1 bg-gray-800 rounded-xl p-4 border-2 border-gray-700">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-gray-400 text-xs uppercase">Last Game</Text>
                  <View className={`px-2 py-1 rounded ${userWonLast ? "bg-green-900" : "bg-red-900"}`}>
                    <Text className={`text-xs font-bold ${userWonLast ? "text-green-400" : "text-red-400"}`}>
                      {userWonLast ? "W" : "L"}
                    </Text>
                  </View>
                </View>
                <Text className="text-white font-semibold text-sm mb-1">
                  vs {lastOpponent.city}
                </Text>
                <Text className="text-gray-400 text-xs mb-2">{lastOpponent.name}</Text>
                <Text className="text-blue-400 text-2xl font-bold">
                  {lastGame.homeTeamId === userTeamId ? lastGame.homeScore : lastGame.awayScore}
                  <Text className="text-gray-500 text-lg"> - </Text>
                  {lastGame.homeTeamId === userTeamId ? lastGame.awayScore : lastGame.homeScore}
                </Text>
              </View>
            ) : (
              <View className="flex-1 bg-gray-800 rounded-xl p-4 border-2 border-gray-700 items-center justify-center">
                <Text className="text-gray-500 text-xs">No games played yet</Text>
              </View>
            )}

            {/* Next Game */}
            {nextGame && nextOpponent ? (
              <View className="flex-1 bg-gray-800 rounded-xl p-4 border-2 border-blue-700">
                <Text className="text-gray-400 text-xs uppercase mb-2">Next Game</Text>
                <Text className="text-white font-semibold text-sm mb-1">
                  {isHomeGame ? "vs" : "@"} {nextOpponent.city}
                </Text>
                <Text className="text-gray-400 text-xs mb-2">{nextOpponent.name}</Text>
                <View className="flex-row items-center gap-2 mb-2">
                  <Ionicons name={isHomeGame ? "home" : "airplane"} size={16} color="#60A5FA" />
                  <Text className="text-blue-400 text-xs">
                    {isHomeGame ? "Home" : "Away"}
                  </Text>
                </View>
                {/* Rivalry Badge */}
                {nextGameRivalry && nextGameRivalry.level !== "ice-cold" && (
                  <View className="flex-row items-center gap-2 mt-1">
                    <View className={`${getRivalryColor(nextGameRivalry.level)} rounded-full px-2 py-1`}>
                      <Text className="text-white text-xs font-bold">
                        {getRivalryDisplayText(nextGameRivalry.level).toUpperCase()}
                      </Text>
                    </View>
                    <Ionicons name="flame" size={14} color="#F59E0B" />
                  </View>
                )}
              </View>
            ) : (
              <View className="flex-1 bg-gray-800 rounded-xl p-4 border-2 border-blue-700 items-center justify-center">
                <Text className="text-gray-500 text-xs">No upcoming games</Text>
              </View>
            )}
          </View>
        </View>

        {/* Top Players */}
        <View className="px-6 py-4">
          <Text className="text-gray-400 text-xs uppercase tracking-wider mb-3">Top Players</Text>
          <View className="bg-gray-800 rounded-xl overflow-hidden">
            {topPlayers.map((player, index) => (
              <View
                key={player.id}
                className="flex-row items-center p-4 border-b border-gray-700"
              >
                <View className="w-10 h-10 bg-gray-700 rounded-full items-center justify-center mr-3">
                  <Text className="text-white font-bold">{index + 1}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-white font-semibold text-base">{player.name}</Text>
                  <Text className="text-gray-400 text-xs">
                    {player.position} • {player.stats.points} PPG
                  </Text>
                </View>
                <View className="items-end">
                  <Text className={`text-3xl font-bold ${getOverallColor(player.overall)}`}>
                    {player.overall}
                  </Text>
                  <Text className="text-gray-500 text-xs">OVR</Text>
                </View>
              </View>
            ))}
            {topPlayers.length === 0 && (
              <View className="p-4 items-center">
                <Text className="text-gray-500">No players on roster</Text>
              </View>
            )}
          </View>
        </View>

        {/* Salary Cap */}
        <View className="px-6 py-4">
          <View className="bg-gray-800 rounded-xl p-4">
            <Text className="text-gray-400 text-xs uppercase tracking-wider mb-3">Salary Cap</Text>
            <View className="flex-row justify-between mb-3">
              <View>
                <Text className="text-gray-400 text-xs mb-1">Total Salary</Text>
                <Text className="text-white text-2xl font-bold">${totalSalary.toFixed(1)}M</Text>
              </View>
              <View className="items-end">
                <Text className="text-gray-400 text-xs mb-1">Cap Room</Text>
                <Text className={`text-2xl font-bold ${capRoom >= 0 ? "text-green-400" : "text-red-400"}`}>
                  ${capRoom.toFixed(1)}M
                </Text>
              </View>
            </View>
            {/* Cap Bar */}
            <View className="bg-gray-700 h-3 rounded-full overflow-hidden">
              <View
                className={`h-full ${totalSalary > userTeam.budget ? "bg-red-500" : "bg-blue-500"}`}
                style={{ width: `${Math.min((totalSalary / userTeam.budget) * 100, 100)}%` }}
              />
            </View>
            <Text className="text-gray-500 text-xs mt-2 text-right">
              Cap: ${userTeam.budget.toFixed(1)}M
            </Text>
          </View>
        </View>

        {/* Alerts */}
        {alerts.length > 0 && (
          <View className="px-6 py-4">
            <Text className="text-gray-400 text-xs uppercase tracking-wider mb-3">Alerts</Text>
            {alerts.map((alert, index) => (
              <View
                key={index}
                className={`flex-row items-center p-3 rounded-xl mb-2 ${
                  alert.type === "danger" ? "bg-red-900/30 border border-red-700" : "bg-yellow-900/30 border border-yellow-700"
                }`}
              >
                <Ionicons
                  name={alert.type === "danger" ? "warning" : "alert-circle"}
                  size={20}
                  color={alert.type === "danger" ? "#EF4444" : "#F59E0B"}
                />
                <Text
                  className={`ml-3 flex-1 ${
                    alert.type === "danger" ? "text-red-400" : "text-yellow-400"
                  }`}
                >
                  {alert.message}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Main Action Buttons */}
        <View className="px-6 py-6 pb-24">
          <View className="gap-3">
            <Pressable
              className="bg-blue-600 rounded-2xl p-5 flex-row items-center justify-center active:bg-blue-700"
              onPress={simulateWeek}
            >
              <Ionicons name="play-circle" size={28} color="white" />
              <Text className="text-white font-bold text-lg ml-3">Simulate Week</Text>
            </Pressable>

            <Pressable
              className="bg-gray-800 rounded-2xl p-4 flex-row items-center justify-center active:bg-gray-700"
              onPress={() => {}}
            >
              <Ionicons name="list" size={24} color="#9CA3AF" />
              <Text className="text-gray-400 font-semibold ml-2">Depth Chart</Text>
              <View className="bg-gray-700 rounded px-2 py-1 ml-2">
                <Text className="text-gray-500 text-xs">Coming Soon</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Coach Details Modal */}
      <CoachDetailsModal
        coach={userCoach || null}
        visible={coachModalVisible}
        onClose={() => setCoachModalVisible(false)}
      />

      {/* Welcome Modal */}
      <WelcomeModal
        visible={welcomeModalVisible}
        onClose={handleCloseWelcome}
        teamName={`${userTeam?.city} ${userTeam?.name}`}
        leagueName={currentLeague?.name || "the League"}
      />
    </View>
  );
}
