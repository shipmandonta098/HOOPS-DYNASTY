import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SidebarLayout from "../components/SidebarLayout";

export type RootStackParamList = {
  Home: undefined;
  CreateLeague: undefined;
  ContinueLeague: undefined;
  Dashboard: undefined;
  Roster: undefined;
  Standings: undefined;
  Finances: undefined;
  Draft: undefined;
  Schedule: undefined;
  Trades: undefined;
  FreeAgents: undefined;
  Rotations: undefined;
  Stats: undefined;
  History: undefined;
  NewsFeed: undefined;
  Expansion: undefined;
  AwardRaces: undefined;
  Settings: undefined;
  ContractNegotiation: { playerId: string; isExtension: boolean };
  LiveGame: { gameId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Screens that should have sidebar
const DashboardScreen = require("../screens/DashboardScreen").default;
const RosterScreen = require("../screens/RosterScreen").default;
const StandingsScreen = require("../screens/StandingsScreen").default;
const FinancesScreen = require("../screens/FinancesScreen").default;
const DraftScreen = require("../screens/DraftScreen").default;
const ScheduleScreen = require("../screens/ScheduleScreen").default;
const TradesScreen = require("../screens/TradesScreen").default;
const FreeAgentsScreen = require("../screens/FreeAgentsScreen").default;
const RotationsScreen = require("../screens/RotationsScreen").default;
const StatsScreen = require("../screens/StatsScreen").default;
const HistoryScreen = require("../screens/HistoryScreen").default;
const NewsFeedScreen = require("../screens/NewsFeedScreen").default;
const ExpansionScreen = require("../screens/ExpansionScreen").default;
const AwardRacesScreen = require("../screens/AwardRacesScreen").default;
const SettingsScreen = require("../screens/SettingsScreen").default;

// Screens without sidebar
const HomeScreen = require("../screens/HomeScreen").default;
const CreateLeagueScreen = require("../screens/CreateLeagueScreen").default;
const ContinueLeagueScreen = require("../screens/ContinueLeagueScreen").default;
const LiveGameScreen = require("../screens/LiveGameScreen").default;
const ContractNegotiationScreen = require("../screens/ContractNegotiationScreen").default;

// Wrapper for screens with sidebar
function withSidebar(Component: React.ComponentType<any>) {
  const WrappedComponent = (props: any) => (
    <SidebarLayout>
      <Component {...props} />
    </SidebarLayout>
  );
  WrappedComponent.displayName = `withSidebar(${Component.displayName || Component.name || "Component"})`;
  return WrappedComponent;
}

export default function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#030712" },
      }}
      initialRouteName="Home"
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="CreateLeague" component={CreateLeagueScreen} />
      <Stack.Screen name="ContinueLeague" component={ContinueLeagueScreen} />
      <Stack.Screen name="Dashboard" component={withSidebar(DashboardScreen)} />
      <Stack.Screen name="Roster" component={withSidebar(RosterScreen)} />
      <Stack.Screen name="Standings" component={withSidebar(StandingsScreen)} />
      <Stack.Screen name="Finances" component={withSidebar(FinancesScreen)} />
      <Stack.Screen name="Draft" component={withSidebar(DraftScreen)} />
      <Stack.Screen name="Schedule" component={withSidebar(ScheduleScreen)} />
      <Stack.Screen name="Trades" component={withSidebar(TradesScreen)} />
      <Stack.Screen name="FreeAgents" component={withSidebar(FreeAgentsScreen)} />
      <Stack.Screen name="Rotations" component={withSidebar(RotationsScreen)} />
      <Stack.Screen name="Stats" component={withSidebar(StatsScreen)} />
      <Stack.Screen name="History" component={withSidebar(HistoryScreen)} />
      <Stack.Screen name="NewsFeed" component={withSidebar(NewsFeedScreen)} />
      <Stack.Screen name="Expansion" component={withSidebar(ExpansionScreen)} />
      <Stack.Screen name="AwardRaces" component={withSidebar(AwardRacesScreen)} />
      <Stack.Screen name="Settings" component={withSidebar(SettingsScreen)} />
      <Stack.Screen name="ContractNegotiation" component={ContractNegotiationScreen} />
      <Stack.Screen name="LiveGame" component={LiveGameScreen} />
    </Stack.Navigator>
  );
}
