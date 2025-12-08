import React, { useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useBasketballStore } from "../state/basketballStore";
import {
  calculateFinancialSummary,
  getCapSheet,
  projectPayroll,
  getAvailableExceptions,
  formatCurrency,
  getCapStatusColor,
  SALARY_CAP,
  LUXURY_TAX_LINE,
  HARD_CAP,
} from "../utils/finances";

export default function FinancesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const teams = useBasketballStore((s) => s.teams);
  const players = useBasketballStore((s) => s.players);
  const userTeamId = useBasketballStore((s) => s.userTeamId);
  const getSettings = useBasketballStore((s) => s.getSettings);
  const settings = getSettings();

  const userTeam = teams.find((t) => t.id === userTeamId);

  const financials = useMemo(() => {
    if (!userTeam) return null;
    return calculateFinancialSummary(userTeam, players);
  }, [userTeam, players]);

  const capSheet = useMemo(() => {
    if (!userTeam) return [];
    return getCapSheet(userTeam, players);
  }, [userTeam, players]);

  const projections = useMemo(() => {
    if (!userTeam) return [];
    return projectPayroll(userTeam, players, 4);
  }, [userTeam, players]);

  const exceptions = useMemo(() => {
    if (!userTeam || !financials) return null;
    return getAvailableExceptions(userTeam, financials.isOverCap);
  }, [userTeam, financials]);

  if (!userTeam || !financials) {
    return (
      <View className="flex-1 bg-gray-950 items-center justify-center">
        <Text className="text-white text-lg">No team data available</Text>
      </View>
    );
  }

  const capStatusColor = getCapStatusColor(financials.totalSalary);

  return (
    <View className="flex-1 bg-gray-950">
      {/* Header */}
      <View
        className="bg-gray-900 border-b border-gray-800"
        style={{ paddingTop: insets.top + 60 }}
      >
        <View className="px-6 pb-4">
          <Text className="text-white text-2xl font-bold">Team Finances</Text>
          <Text className="text-gray-400 text-sm mt-1">
            {userTeam.city} {userTeam.name}
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <View className="px-4 py-4">
          {/* Salary Cap Overview - Only show if salary cap is enabled */}
          {settings?.salaryCapEnabled && (
            <View className="bg-gray-900 rounded-lg border border-gray-800 p-4 mb-4">
              <Text className="text-white text-lg font-bold mb-4">Salary Cap Overview</Text>

              {/* Total Salary */}
              <View className="mb-3">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="text-gray-400 text-sm">Total Salary</Text>
                  <Text className="text-white font-bold text-lg">
                    {formatCurrency(financials.totalSalary)}
                  </Text>
                </View>
                <View className="bg-gray-800 h-2 rounded-full overflow-hidden">
                  <View
                    className={`h-full ${
                      capStatusColor === "green"
                        ? "bg-green-500"
                        : capStatusColor === "yellow"
                        ? "bg-yellow-500"
                        : capStatusColor === "orange"
                        ? "bg-orange-500"
                        : "bg-red-500"
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (financials.totalSalary / HARD_CAP) * 100
                      )}%`,
                    }}
                  />
                </View>
              </View>

              {/* Cap Space */}
              <View className="flex-row justify-between py-2 border-b border-gray-800">
                <Text className="text-gray-400">Cap Space</Text>
                <Text
                  className={`font-semibold ${
                    financials.capSpace > 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {formatCurrency(financials.capSpace)}
                </Text>
              </View>

              {/* Salary Cap */}
              <View className="flex-row justify-between py-2 border-b border-gray-800">
                <Text className="text-gray-400">Salary Cap</Text>
                <Text className="text-white font-semibold">
                  {formatCurrency(SALARY_CAP)}
                </Text>
              </View>

              {/* Luxury Tax Line */}
              <View className="flex-row justify-between py-2 border-b border-gray-800">
                <Text className="text-gray-400">Luxury Tax Line</Text>
                <Text className="text-white font-semibold">
                  {formatCurrency(LUXURY_TAX_LINE)}
                </Text>
              </View>

              {/* Hard Cap */}
              <View className="flex-row justify-between py-2 border-b border-gray-800">
                <Text className="text-gray-400">Hard Cap (Apron)</Text>
                <Text className="text-white font-semibold">
                  {formatCurrency(HARD_CAP)}
                </Text>
              </View>

              {/* Luxury Tax Amount */}
              {financials.isOverLuxuryTax && (
                <View className="flex-row justify-between py-2 border-b border-gray-800">
                  <Text className="text-orange-400">Luxury Tax Bill</Text>
                  <Text className="text-orange-400 font-bold">
                    {formatCurrency(financials.luxuryTaxAmount)}
                  </Text>
                </View>
              )}

              {/* Status Badges */}
              <View className="flex-row flex-wrap gap-2 mt-3">
                {financials.isOverHardCap && (
                  <View className="bg-red-500/20 px-3 py-1 rounded-full">
                    <Text className="text-red-400 text-xs font-semibold">
                      Over Hard Cap
                    </Text>
                  </View>
                )}
                {financials.isOverLuxuryTax && !financials.isOverHardCap && (
                  <View className="bg-orange-500/20 px-3 py-1 rounded-full">
                    <Text className="text-orange-400 text-xs font-semibold">
                      In Luxury Tax
                    </Text>
                  </View>
                )}
                {financials.isOverCap && !financials.isOverLuxuryTax && (
                  <View className="bg-yellow-500/20 px-3 py-1 rounded-full">
                    <Text className="text-yellow-400 text-xs font-semibold">
                      Over Cap
                    </Text>
                  </View>
                )}
                {!financials.isOverCap && (
                  <View className="bg-green-500/20 px-3 py-1 rounded-full">
                    <Text className="text-green-400 text-xs font-semibold">
                      Under Cap
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* No Cap Mode Message */}
          {!settings?.salaryCapEnabled && (
            <View className="bg-blue-900/20 rounded-lg border border-blue-700 p-4 mb-4">
              <View className="flex-row items-center gap-3">
                <Ionicons name="information-circle" size={24} color="#60A5FA" />
                <View className="flex-1">
                  <Text className="text-blue-400 font-bold text-base mb-1">
                    Salary Cap Disabled
                  </Text>
                  <Text className="text-blue-300 text-sm">
                    All cap restrictions are off. You can sign any player without cap limits.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Available Exceptions */}
          {exceptions && (
            <View className="bg-gray-900 rounded-lg border border-gray-800 p-4 mb-4">
              <Text className="text-white text-lg font-bold mb-3">
                Available Exceptions
              </Text>

              {exceptions.midLevelException > 0 && (
                <View className="flex-row justify-between py-2">
                  <Text className="text-gray-400">Mid-Level Exception (MLE)</Text>
                  <Text className="text-white font-semibold">
                    {formatCurrency(exceptions.midLevelException)}
                  </Text>
                </View>
              )}

              {exceptions.biAnnualException > 0 && (
                <View className="flex-row justify-between py-2">
                  <Text className="text-gray-400">Bi-Annual Exception (BAE)</Text>
                  <Text className="text-white font-semibold">
                    {formatCurrency(exceptions.biAnnualException)}
                  </Text>
                </View>
              )}

              {exceptions.taxpayerMidLevel > 0 && (
                <View className="flex-row justify-between py-2">
                  <Text className="text-gray-400">Taxpayer Mid-Level (TMLE)</Text>
                  <Text className="text-white font-semibold">
                    {formatCurrency(exceptions.taxpayerMidLevel)}
                  </Text>
                </View>
              )}

              {exceptions.roomException > 0 && (
                <View className="flex-row justify-between py-2">
                  <Text className="text-gray-400">Room Exception</Text>
                  <Text className="text-white font-semibold">
                    {formatCurrency(exceptions.roomException)}
                  </Text>
                </View>
              )}

              {exceptions.midLevelException === 0 &&
                exceptions.biAnnualException === 0 &&
                exceptions.taxpayerMidLevel === 0 &&
                exceptions.roomException === 0 && (
                  <Text className="text-gray-500 text-sm italic">
                    No exceptions available (under cap)
                  </Text>
                )}
            </View>
          )}

          {/* Cap Sheet */}
          <View className="bg-gray-900 rounded-lg border border-gray-800 p-4 mb-4">
            <Text className="text-white text-lg font-bold mb-3">
              Player Salaries ({capSheet.length})
            </Text>

            {/* Header */}
            <View className="flex-row py-2 border-b border-gray-800">
              <Text className="text-gray-400 text-xs font-semibold flex-1">
                Player
              </Text>
              <Text className="text-gray-400 text-xs font-semibold w-20 text-center">
                Salary
              </Text>
              <Text className="text-gray-400 text-xs font-semibold w-16 text-center">
                Years
              </Text>
            </View>

            {/* Players */}
            {capSheet.map((player, index) => (
              <View
                key={player.id}
                className={`flex-row py-3 ${
                  index < capSheet.length - 1 ? "border-b border-gray-800/50" : ""
                }`}
              >
                <View className="flex-1">
                  <Text className="text-white font-medium">{player.name}</Text>
                  <Text className="text-gray-500 text-xs">{player.position}</Text>
                </View>
                <Text className="text-white font-semibold w-20 text-center">
                  {formatCurrency(player.salary)}
                </Text>
                <Text className="text-gray-400 w-16 text-center">
                  {player.yearsRemaining} yr{player.yearsRemaining !== 1 ? "s" : ""}
                </Text>
              </View>
            ))}

            {capSheet.length === 0 && (
              <Text className="text-gray-500 text-sm italic py-4 text-center">
                No players on roster
              </Text>
            )}
          </View>

          {/* Payroll Projections */}
          <View className="bg-gray-900 rounded-lg border border-gray-800 p-4 mb-4">
            <Text className="text-white text-lg font-bold mb-3">
              Payroll Projections
            </Text>

            {projections.map((proj, index) => (
              <View
                key={proj.year}
                className={`py-3 ${
                  index < projections.length - 1 ? "border-b border-gray-800" : ""
                }`}
              >
                <View className="flex-row justify-between mb-2">
                  <Text className="text-white font-semibold">{proj.year}</Text>
                  <Text
                    className={`font-bold ${
                      proj.overCap ? "text-red-400" : "text-green-400"
                    }`}
                  >
                    {formatCurrency(proj.totalSalary)}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-gray-400 text-sm">
                    Projected Cap: {formatCurrency(proj.projectedCap)}
                  </Text>
                  <Text className="text-gray-400 text-sm">
                    Space: {formatCurrency(proj.capSpace)}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Dead Money */}
          <View className="bg-gray-900 rounded-lg border border-gray-800 p-4 mb-4">
            <Text className="text-white text-lg font-bold mb-3">Dead Money</Text>

            {userTeam.deadMoney && userTeam.deadMoney.length > 0 ? (
              userTeam.deadMoney.map((contract, index) => (
                <View
                  key={index}
                  className={`py-3 ${
                    index < userTeam.deadMoney!.length - 1
                      ? "border-b border-gray-800"
                      : ""
                  }`}
                >
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-white font-medium">
                      {contract.playerName}
                    </Text>
                    <Text className="text-red-400 font-semibold">
                      {formatCurrency(contract.amountPerYear)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-gray-500 text-xs capitalize">
                      {contract.reason}
                    </Text>
                    <Text className="text-gray-400 text-xs">
                      {contract.yearsRemaining} yr
                      {contract.yearsRemaining !== 1 ? "s" : ""} remaining
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text className="text-gray-500 text-sm italic text-center py-3">
                No dead money contracts
              </Text>
            )}
          </View>

          {/* Quick Links */}
          <View className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <Text className="text-white text-lg font-bold mb-3">Quick Actions</Text>

            <Pressable
              className="bg-blue-600 rounded-lg p-4 mb-3 active:bg-blue-700"
              onPress={() => navigation.navigate("Trades")}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Ionicons name="swap-horizontal" size={24} color="white" />
                  <Text className="text-white font-semibold ml-3">
                    Trade Calculator
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="white" />
              </View>
            </Pressable>

            <Pressable
              className="bg-blue-600 rounded-lg p-4 mb-3 active:bg-blue-700"
              onPress={() => navigation.navigate("FreeAgents")}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Ionicons name="person-add" size={24} color="white" />
                  <Text className="text-white font-semibold ml-3">
                    Free Agents
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="white" />
              </View>
            </Pressable>

            <Pressable
              className="bg-gray-800 rounded-lg p-4 active:bg-gray-700"
              disabled
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Ionicons name="document-text" size={24} color="#9CA3AF" />
                  <Text className="text-gray-400 font-semibold ml-3">
                    Contract Extensions
                  </Text>
                </View>
                <Text className="text-gray-600 text-xs">Coming Soon</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
