import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBasketballStore } from "../state/basketballStore";
import { calculateStandings, formatWinPercentage, formatGamesBack, TeamStandings } from "../utils/standings";
import { getSOSColor } from "../utils/strengthOfSchedule";
import { getMomentumColor } from "../utils/powerRankings";

export default function StandingsScreen() {
  const insets = useSafeAreaInsets();
  const teams = useBasketballStore((s) => s.teams);
  const games = useBasketballStore((s) => s.season.games);
  const userTeamId = useBasketballStore((s) => s.userTeamId);
  const getAllTeamsSOS = useBasketballStore((s) => s.getAllTeamsSOS);
  const getPowerRankings = useBasketballStore((s) => s.getPowerRankings);

  const [viewMode, setViewMode] = useState<"record" | "power">("record");

  const standings = useMemo(() => {
    return calculateStandings(teams, games);
  }, [teams, games]);

  const allSOS = useMemo(() => {
    return getAllTeamsSOS();
  }, [teams, games, getAllTeamsSOS]);

  const powerRankings = useMemo(() => {
    return getPowerRankings();
  }, [getPowerRankings]);

  const getTeamSOS = (teamId: string) => {
    return allSOS.find((sos: any) => sos.teamId === teamId);
  };

  const renderStandingsTable = (conferenceStandings: TeamStandings[], conferenceName: string) => {
    return (
      <View className="mb-6">
        {/* Conference Header */}
        <View className="bg-gray-800 px-4 py-3 rounded-t-lg">
          <Text className="text-white text-lg font-bold">{conferenceName} Conference</Text>
        </View>

        {/* Table Header */}
        <View className="bg-gray-900 border-b border-l border-r border-gray-800 px-3 py-3">
          <View className="flex-row items-center">
            <Text className="text-gray-400 text-xs font-semibold w-8 text-center">#</Text>
            <Text className="text-gray-400 text-xs font-semibold flex-1 ml-2">Team</Text>
            <Text className="text-gray-400 text-xs font-semibold w-12 text-center">W</Text>
            <Text className="text-gray-400 text-xs font-semibold w-12 text-center">L</Text>
            <Text className="text-gray-400 text-xs font-semibold w-14 text-center">WIN%</Text>
            <Text className="text-gray-400 text-xs font-semibold w-12 text-center">GB</Text>
          </View>
        </View>

        {/* Table Rows */}
        {conferenceStandings.map((team, index) => {
          const isUserTeam = team.teamId === userTeamId;
          return (
            <View
              key={team.teamId}
              className={`border-b border-l border-r border-gray-800 px-3 py-4 ${
                isUserTeam ? "bg-blue-950/30" : "bg-gray-900/50"
              } ${index === conferenceStandings.length - 1 ? "rounded-b-lg" : ""}`}
            >
              {/* Main Row */}
              <View className="flex-row items-center mb-2">
                <Text
                  className={`w-8 text-center font-bold ${
                    isUserTeam ? "text-blue-400" : "text-gray-500"
                  }`}
                >
                  {index + 1}
                </Text>
                <View className="flex-row items-center flex-1 ml-2">
                  <Text className="text-2xl mr-2">{team.logo}</Text>
                  <View className="flex-1">
                    <Text
                      className={`font-bold ${
                        isUserTeam ? "text-blue-400" : "text-white"
                      }`}
                      numberOfLines={1}
                    >
                      {team.city}
                    </Text>
                    <Text className="text-gray-500 text-xs" numberOfLines={1}>
                      {team.name}
                    </Text>
                  </View>
                </View>
                <Text className="text-white font-semibold w-12 text-center">
                  {team.wins}
                </Text>
                <Text className="text-white font-semibold w-12 text-center">
                  {team.losses}
                </Text>
                <Text className="text-white font-mono text-sm w-14 text-center">
                  {formatWinPercentage(team.winPercentage)}
                </Text>
                <Text className="text-gray-400 text-sm w-12 text-center">
                  {formatGamesBack(team.gamesBack)}
                </Text>
              </View>

              {/* Secondary Stats Row */}
              <View className="flex-row items-center" style={{ marginLeft: 44 }}>
                <View className="flex-row items-center mr-4">
                  <Text className="text-gray-500 text-xs">CONF: </Text>
                  <Text className="text-gray-300 text-xs font-medium">
                    {team.conferenceRecord}
                  </Text>
                </View>
                <View className="flex-row items-center mr-4">
                  <Text className="text-gray-500 text-xs">HOME: </Text>
                  <Text className="text-gray-300 text-xs font-medium">
                    {team.homeRecord}
                  </Text>
                </View>
                <View className="flex-row items-center mr-4">
                  <Text className="text-gray-500 text-xs">AWAY: </Text>
                  <Text className="text-gray-300 text-xs font-medium">
                    {team.awayRecord}
                  </Text>
                </View>
                <View className="flex-row items-center mr-4">
                  <Text className="text-gray-500 text-xs">L10: </Text>
                  <Text className="text-gray-300 text-xs font-medium">
                    {team.lastTen}
                  </Text>
                </View>
                <View className="flex-row items-center mr-4">
                  <Text className="text-gray-500 text-xs">STRK: </Text>
                  <Text
                    className={`text-xs font-bold ${
                      team.streak.startsWith("W")
                        ? "text-green-400"
                        : team.streak.startsWith("L")
                        ? "text-red-400"
                        : "text-gray-400"
                    }`}
                  >
                    {team.streak}
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <Text className="text-gray-500 text-xs">SOS: </Text>
                  {(() => {
                    const teamSOS = getTeamSOS(team.teamId);
                    if (!teamSOS) return <Text className="text-gray-400 text-xs">N/A</Text>;

                    return (
                      <View className="flex-row items-center">
                        <Text
                          className="text-xs font-bold"
                          style={{ color: getSOSColor(teamSOS.label) }}
                        >
                          {teamSOS.label}
                        </Text>
                        <Text className="text-gray-500 text-xs ml-1">
                          (#{teamSOS.rank})
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderPowerRankingsTable = () => {
    // Single combined league table (not split by conference)
    const allRankings = powerRankings
      .map((ranking) => {
        const team = teams.find((t) => t.id === ranking.teamId);
        return { ...ranking, team };
      })
      .filter((r) => r.team !== undefined);

    return (
      <View className="mb-6">
        {/* Table Header */}
        <View className="bg-gray-900 border-b border-l border-r border-gray-800 px-3 py-3 rounded-t-lg">
          <View className="flex-row items-center">
            <Text className="text-gray-400 text-xs font-semibold w-8 text-center">#</Text>
            <Text className="text-gray-400 text-xs font-semibold flex-1 ml-2">Team</Text>
            <Text className="text-gray-400 text-xs font-semibold w-16 text-center">Record</Text>
            <Text className="text-gray-400 text-xs font-semibold w-20 text-center">Status</Text>
          </View>
        </View>

        {/* Table Rows */}
        {allRankings.map((ranking, index) => {
          if (!ranking.team) return null;
          const isUserTeam = ranking.teamId === userTeamId;
          return (
            <View
              key={ranking.teamId}
              className={`border-b border-l border-r border-gray-800 px-3 py-4 ${
                isUserTeam ? "bg-blue-950/30" : "bg-gray-900/50"
              } ${index === allRankings.length - 1 ? "rounded-b-lg" : ""}`}
            >
              <View className="flex-row items-center">
                <Text
                  className={`w-8 text-center font-bold ${
                    isUserTeam ? "text-blue-400" : "text-gray-500"
                  }`}
                >
                  {ranking.rank}
                </Text>
                <View className="flex-row items-center flex-1 ml-2">
                  <Text className="text-2xl mr-2">{ranking.team.logo}</Text>
                  <View className="flex-1">
                    <Text
                      className={`font-bold ${
                        isUserTeam ? "text-blue-400" : "text-white"
                      }`}
                      numberOfLines={1}
                    >
                      {ranking.team.city}
                    </Text>
                    <Text className="text-gray-500 text-xs" numberOfLines={1}>
                      {ranking.team.name} • {ranking.team.conference}
                    </Text>
                  </View>
                </View>
                <Text className="text-white text-sm w-16 text-center">
                  {ranking.team.wins}-{ranking.team.losses}
                </Text>
                <View className="w-20 items-center">
                  <View
                    className="px-2 py-1 rounded"
                    style={{ backgroundColor: getMomentumColor(ranking.momentum) + "20" }}
                  >
                    <Text
                      className="text-xs font-bold"
                      style={{ color: getMomentumColor(ranking.momentum) }}
                    >
                      {ranking.momentum}
                    </Text>
                  </View>
                  {ranking.trend !== 0 && (
                    <Text
                      className="text-xs font-semibold mt-1"
                      style={{
                        color: ranking.trend > 0 ? "#10B981" : "#EF4444",
                      }}
                    >
                      {ranking.trend > 0 ? `▲${ranking.trend}` : `▼${Math.abs(ranking.trend)}`}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          );
        })}
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
          <Text className="text-white text-2xl font-bold">Standings</Text>
          <Text className="text-gray-400 text-sm mt-1">League Rankings</Text>

          {/* Toggle */}
          <View className="flex-row bg-gray-800 rounded-lg p-1 mt-3">
            <Pressable
              onPress={() => setViewMode("record")}
              className={`flex-1 py-2 rounded-md ${
                viewMode === "record" ? "bg-blue-600" : "bg-transparent"
              }`}
            >
              <Text
                className={`text-center text-sm font-semibold ${
                  viewMode === "record" ? "text-white" : "text-gray-400"
                }`}
              >
                Record
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setViewMode("power")}
              className={`flex-1 py-2 rounded-md ${
                viewMode === "power" ? "bg-blue-600" : "bg-transparent"
              }`}
            >
              <Text
                className={`text-center text-sm font-semibold ${
                  viewMode === "power" ? "text-white" : "text-gray-400"
                }`}
              >
                Power Rankings
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Standings Tables */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <View className="px-4 py-4">
          {viewMode === "record" ? (
            <>
              {/* Eastern Conference */}
              {renderStandingsTable(standings.East, "Eastern")}

              {/* Western Conference */}
              {renderStandingsTable(standings.West, "Western")}

              {/* Legend */}
              <View className="px-2 mt-2">
                <Text className="text-gray-500 text-xs font-semibold mb-2">Legend</Text>
                <View className="flex-row flex-wrap">
                  <View className="mr-4 mb-2">
                    <Text className="text-gray-400 text-xs">
                      <Text className="font-semibold">GB</Text> - Games Back
                    </Text>
                  </View>
                  <View className="mr-4 mb-2">
                    <Text className="text-gray-400 text-xs">
                      <Text className="font-semibold">CONF</Text> - Conference Record
                    </Text>
                  </View>
                  <View className="mr-4 mb-2">
                    <Text className="text-gray-400 text-xs">
                      <Text className="font-semibold">L10</Text> - Last 10 Games
                    </Text>
                  </View>
                  <View className="mr-4 mb-2">
                    <Text className="text-gray-400 text-xs">
                      <Text className="font-semibold">STRK</Text> - Current Streak
                    </Text>
                  </View>
                  <View className="mr-4 mb-2">
                    <Text className="text-gray-400 text-xs">
                      <Text className="font-semibold">SOS</Text> - Strength of Schedule
                    </Text>
                  </View>
                </View>
              </View>
            </>
          ) : (
            <>
              {/* Power Rankings */}
              {renderPowerRankingsTable()}

              {/* Legend */}
              <View className="px-2 mt-2">
                <Text className="text-gray-500 text-xs font-semibold mb-2">Status Legend</Text>
                <View className="flex-row flex-wrap">
                  <View className="mr-4 mb-2">
                    <View className="flex-row items-center">
                      <View
                        className="w-3 h-3 rounded mr-1"
                        style={{ backgroundColor: getMomentumColor("Hot") }}
                      />
                      <Text className="text-gray-400 text-xs">Hot - High win%, improving</Text>
                    </View>
                  </View>
                  <View className="mr-4 mb-2">
                    <View className="flex-row items-center">
                      <View
                        className="w-3 h-3 rounded mr-1"
                        style={{ backgroundColor: getMomentumColor("Surging") }}
                      />
                      <Text className="text-gray-400 text-xs">Surging - Rapidly improving</Text>
                    </View>
                  </View>
                  <View className="mr-4 mb-2">
                    <View className="flex-row items-center">
                      <View
                        className="w-3 h-3 rounded mr-1"
                        style={{ backgroundColor: getMomentumColor("Steady") }}
                      />
                      <Text className="text-gray-400 text-xs">Steady - Consistent</Text>
                    </View>
                  </View>
                  <View className="mr-4 mb-2">
                    <View className="flex-row items-center">
                      <View
                        className="w-3 h-3 rounded mr-1"
                        style={{ backgroundColor: getMomentumColor("Cold") }}
                      />
                      <Text className="text-gray-400 text-xs">Cold - Struggling</Text>
                    </View>
                  </View>
                  <View className="mr-4 mb-2">
                    <View className="flex-row items-center">
                      <View
                        className="w-3 h-3 rounded mr-1"
                        style={{ backgroundColor: getMomentumColor("Falling") }}
                      />
                      <Text className="text-gray-400 text-xs">Falling - Rapidly declining</Text>
                    </View>
                  </View>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
