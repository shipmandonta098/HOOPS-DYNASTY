import React, { ReactNode } from "react";
import { View, Pressable } from "react-native";
import { useSharedValue, withTiming, Easing } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import LeftSidebar from "./LeftSidebar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface SidebarLayoutProps {
  children: ReactNode;
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const sidebarTranslateX = useSharedValue(-250);
  const insets = useSafeAreaInsets();

  const toggleSidebar = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    sidebarTranslateX.value = withTiming(newState ? 0 : -250, {
      duration: 300,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  };

  const closeSidebar = () => {
    setIsOpen(false);
    sidebarTranslateX.value = withTiming(-250, {
      duration: 300,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  };

  return (
    <View className="flex-1 bg-gray-950">
      {/* Main Content - Full Width */}
      <View className="flex-1">{children}</View>

      {/* Menu Button - Fixed at top-left */}
      <View
        className="absolute left-0 z-50"
        style={{ top: insets.top + 12 }}
      >
        <Pressable
          className="bg-gray-800 rounded-r-xl p-3 active:bg-gray-700 border border-l-0 border-gray-700"
          onPress={toggleSidebar}
        >
          <Ionicons name="menu" size={24} color="white" />
        </Pressable>
      </View>

      {/* Overlay Background - Only visible when sidebar is open */}
      {isOpen && (
        <Pressable
          className="absolute inset-0 bg-black/50 z-40"
          onPress={closeSidebar}
        />
      )}

      {/* Sidebar - Slides in from left */}
      <LeftSidebar
        isOpen={isOpen}
        onClose={closeSidebar}
        sidebarTranslateX={sidebarTranslateX}
      />
    </View>
  );
}
