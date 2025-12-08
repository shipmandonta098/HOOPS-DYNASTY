import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
} from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBasketballStore } from "../state/basketballStore";

interface LeftSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sidebarTranslateX: Animated.SharedValue<number>;
}

type NavItem = {
  id: keyof RootStackParamList;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const navItems: NavItem[] = [
  { id: "Dashboard", label: "Dashboard", icon: "grid" },
  { id: "Roster", label: "Roster", icon: "people" },
  { id: "Rotations", label: "Rotations", icon: "list" },
  { id: "Standings", label: "Standings", icon: "trophy" },
  { id: "Stats", label: "Stats", icon: "stats-chart" },
  { id: "Finances", label: "Finances", icon: "cash" },
  { id: "Draft", label: "Draft", icon: "school" },
  { id: "Schedule", label: "Schedule", icon: "calendar" },
  { id: "History", label: "History", icon: "time" },
  { id: "NewsFeed", label: "News Feed", icon: "newspaper" },
  { id: "Expansion", label: "Expansion", icon: "add-circle" },
  { id: "Trades", label: "Trades", icon: "swap-horizontal" },
  { id: "FreeAgents", label: "Free Agents", icon: "person-add" },
  { id: "Settings", label: "Settings", icon: "settings" },
];

export default function LeftSidebar({
  isOpen,
  onClose,
  sidebarTranslateX,
}: LeftSidebarProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [activeRoute, setActiveRoute] = React.useState<string>("Dashboard");
  const insets = useSafeAreaInsets();
  const getSettings = useBasketballStore((s) => s.getSettings);
  const settings = getSettings();

  React.useEffect(() => {
    const unsubscribe = navigation.addListener("state", () => {
      const state = navigation.getState();
      const currentRoute = state.routes[state.index]?.name;
      if (currentRoute) {
        setActiveRoute(currentRoute);
      }
    });

    return unsubscribe;
  }, [navigation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sidebarTranslateX.value }],
  }));

  const handleNavigation = (screen: keyof RootStackParamList) => {
    setActiveRoute(screen);
    // TypeScript type narrowing for navigate
    if (screen === "LiveGame") {
      // LiveGame requires params, skip navigation from sidebar
      return;
    }
    // @ts-ignore - TypeScript struggles with dynamic navigation
    navigation.navigate(screen);
    onClose(); // Close sidebar after selecting a tab
  };

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 250,
          zIndex: 50,
        },
      ]}
      className="bg-gray-900 border-r border-gray-800"
    >
      <View className="flex-1" style={{ paddingTop: insets.top }}>
        {/* Header with Close Button */}
        <View className="px-4 py-4 border-b border-gray-800 flex-row items-center justify-between">
          <Text className="text-white font-bold text-lg">Menu</Text>
          <Pressable
            className="bg-gray-800 rounded-lg p-2 active:bg-gray-700"
            onPress={onClose}
          >
            <Ionicons name="close" size={24} color="white" />
          </Pressable>
        </View>

        {/* Navigation Items - Scrollable */}
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={true}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        >
          <View className="px-3 pt-4">
            {navItems.map((item) => {
              // Check if Expansion should be disabled
              const isExpansionDisabled = item.id === "Expansion" && !settings?.expansionEnabled;

              return (
                <Pressable
                  key={item.id}
                  className={`rounded-lg mb-2 ${
                    isExpansionDisabled
                      ? "opacity-40"
                      : "active:bg-gray-700"
                  } ${
                    activeRoute === item.id ? "bg-blue-600" : "bg-transparent"
                  }`}
                  onPress={() => {
                    if (!isExpansionDisabled) {
                      handleNavigation(item.id);
                    }
                  }}
                  disabled={isExpansionDisabled}
                >
                  <View className="flex-row items-center px-4 py-4">
                    <Ionicons
                      name={item.icon}
                      size={24}
                      color={
                        isExpansionDisabled
                          ? "#6B7280"
                          : activeRoute === item.id
                            ? "white"
                            : "#9CA3AF"
                      }
                    />
                    <Text
                      className={`ml-4 font-semibold text-base ${
                        isExpansionDisabled
                          ? "text-gray-600"
                          : activeRoute === item.id
                            ? "text-white"
                            : "text-gray-400"
                      }`}
                    >
                      {item.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            {/* Main Menu Button */}
            <View className="mt-4 pt-4 border-t border-gray-800">
              <Pressable
                className="rounded-lg mb-2 active:bg-gray-700 bg-transparent"
                onPress={() => handleNavigation("Home")}
              >
                <View className="flex-row items-center px-4 py-4">
                  <Ionicons
                    name="home"
                    size={24}
                    color="#9CA3AF"
                  />
                  <Text className="ml-4 font-semibold text-base text-gray-400">
                    Main Menu
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </Animated.View>
  );
}
