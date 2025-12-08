import React from "react";
import { View, Text, Modal, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface WelcomeModalProps {
  visible: boolean;
  onClose: () => void;
  teamName: string;
  leagueName: string;
}

export default function WelcomeModal({ visible, onClose, teamName, leagueName }: WelcomeModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/80 justify-center items-center px-6">
        <View
          className="bg-gray-900 rounded-3xl w-full max-w-lg border-2 border-blue-600/30"
          style={{ paddingTop: 24, paddingBottom: Math.max(24, insets.bottom) }}
        >
          <ScrollView className="max-h-[600px]">
            {/* Header with Icon */}
            <View className="items-center mb-6 px-6">
              <View className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full items-center justify-center mb-4 shadow-xl">
                <Ionicons name="trophy" size={40} color="white" />
              </View>
              <Text className="text-white text-3xl font-bold text-center mb-2">
                Welcome to {leagueName}!
              </Text>
              <Text className="text-gray-400 text-sm text-center">
                From the Office of the League Commissioner
              </Text>
            </View>

            {/* Divider */}
            <View className="h-px bg-gray-700 mx-6 mb-6" />

            {/* Message Content */}
            <View className="px-6 mb-6">
              <Text className="text-white text-lg leading-7 mb-4">
                Congratulations on taking control of the{" "}
                <Text className="text-blue-400 font-bold">{teamName}</Text>!
              </Text>

              <Text className="text-gray-300 text-base leading-6 mb-4">
                As the new General Manager, you hold the future of this franchise in your hands. Your decisions will shape the destiny of this team and determine whether we see championship banners hanging from the rafters or years of rebuilding ahead.
              </Text>

              <Text className="text-gray-300 text-base leading-6 mb-4">
                The front office has complete faith in your abilities. Build your roster wisely, manage the salary cap, and make the tough calls when needed. Every trade, every draft pick, and every contract negotiation will be scrutinized by our passionate fanbase.
              </Text>

              <Text className="text-gray-300 text-base leading-6 mb-4">
                Remember: winning cures everything, but chemistry and culture are what sustain dynasties. Take care of your players, build rivalries on the court, and never stop pushing for excellence.
              </Text>

              <Text className="text-white text-base leading-6 mb-4 italic">
                The city is counting on you. Let&apos;s bring a championship home.
              </Text>

              {/* Signature */}
              <View className="mt-4 pt-4 border-t border-gray-700">
                <Text className="text-gray-400 text-sm">
                  Best regards,
                </Text>
                <Text className="text-white text-base font-semibold mt-1">
                  Commissioner&apos;s Office
                </Text>
                <Text className="text-gray-500 text-xs mt-1">
                  {leagueName} • Season {new Date().getFullYear()}
                </Text>
              </View>
            </View>

            {/* Action Button */}
            <View className="px-6 pt-2">
              <Pressable
                onPress={onClose}
                className="bg-blue-600 rounded-2xl p-5 items-center active:bg-blue-700 shadow-lg"
              >
                <View className="flex-row items-center gap-2">
                  <Text className="text-white text-lg font-bold">
                    Let&apos;s Get Started
                  </Text>
                  <Ionicons name="arrow-forward" size={24} color="white" />
                </View>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
