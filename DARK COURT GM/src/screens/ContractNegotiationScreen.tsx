import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import { useBasketballStore } from "../state/basketballStore";
import { Player, Agent, ContractOffer, ContractTarget } from "../types/basketball";
import {
  calculateContractTarget,
  processNegotiation,
  checkPlayerOverride,
} from "../utils/contractNegotiation";
import { getAgentDialogue } from "../utils/agentGeneration";

type Props = NativeStackScreenProps<RootStackParamList, "ContractNegotiation">;

export default function ContractNegotiationScreen({ route, navigation }: Props) {
  const { playerId, isExtension } = route.params;
  const insets = useSafeAreaInsets();

  const players = useBasketballStore((s) => s.players);
  const agents = useBasketballStore((s) => s.agents);
  const teams = useBasketballStore((s) => s.teams);
  const userTeamId = useBasketballStore((s) => s.userTeamId);
  const updateAgentRelationship = useBasketballStore((s) => s.updateAgentRelationship);
  const signPlayer = useBasketballStore((s) => s.signPlayer);
  const extendPlayer = useBasketballStore((s) => s.extendPlayer);

  const player = players.find((p) => p.id === playerId);
  const agent = player?.agentId ? agents.find((a) => a.id === player.agentId) : null;
  const userTeam = teams.find((t) => t.id === userTeamId);

  const [years, setYears] = useState("3");
  const [annualSalary, setAnnualSalary] = useState("10.0");
  const [roleGuarantee, setRoleGuarantee] = useState<"starter" | "rotation" | "bench" | undefined>();
  const [incentives, setIncentives] = useState("0");

  const [conversationHistory, setConversationHistory] = useState<Array<{ from: "gm" | "agent" | "player"; message: string }>>([]);
  const [target, setTarget] = useState<ContractTarget | null>(null);
  const [negotiationEnded, setNegotiationEnded] = useState(false);

  useEffect(() => {
    if (player && agent && userTeam) {
      // Calculate target contract
      const teamWinPct = (userTeam.wins + userTeam.losses) > 0
        ? userTeam.wins / (userTeam.wins + userTeam.losses)
        : 0.5;
      const contractTarget = calculateContractTarget(player, agent, userTeam, teamWinPct);
      setTarget(contractTarget);

      // Set initial offer based on player rating
      setAnnualSalary(Math.max(6, player.overall * 0.3).toFixed(1));

      // Agent greeting
      const relationship = agent.relationshipByTeam[userTeamId] || 0;
      const dialogue = getAgentDialogue(agent, agent.toughness, relationship);

      setConversationHistory([
        {
          from: "agent",
          message: dialogue.greeting,
        },
      ]);
    }
  }, [player, agent, userTeam, userTeamId]);

  if (!player || !agent || !userTeam || !target) {
    return (
      <View className="flex-1 bg-gray-950 items-center justify-center">
        <Text className="text-white text-lg">Loading negotiation...</Text>
      </View>
    );
  }

  const handleMakeOffer = () => {
    const offer: ContractOffer = {
      years: parseInt(years) || 1,
      annualSalary: parseFloat(annualSalary) || 6,
      totalValue: (parseInt(years) || 1) * (parseFloat(annualSalary) || 6),
      roleGuarantee,
      incentives: parseFloat(incentives) || 0,
    };

    // Add GM offer to conversation
    const offerMessage = `Offering ${offer.years} year${offer.years > 1 ? "s" : ""} at $${offer.annualSalary}M per year${
      offer.roleGuarantee ? ` with ${offer.roleGuarantee} role guarantee` : ""
    }${offer.incentives && offer.incentives > 0 ? ` plus $${offer.incentives}M in incentives` : ""}.`;

    setConversationHistory((prev) => [...prev, { from: "gm", message: offerMessage }]);

    // Check for player override
    const override = checkPlayerOverride(player, offer, target, userTeam, isExtension);
    if (override.override) {
      setConversationHistory((prev) => [
        ...prev,
        { from: "player", message: override.message! },
      ]);

      if (override.decision === "accept") {
        handleAccept(offer);
      } else {
        setNegotiationEnded(true);
      }
      return;
    }

    // Process normal negotiation
    const response = processNegotiation(offer, target, agent, player, userTeam);

    if (response.type === "accept") {
      setConversationHistory((prev) => [...prev, { from: "agent", message: response.message }]);
      handleAccept(offer);
    } else if (response.type === "counter") {
      const counterMsg = `${response.message} We're looking at ${response.counterOffer.years} years at $${response.counterOffer.annualSalary}M annually${
        response.counterOffer.roleGuarantee
          ? ` with ${response.counterOffer.roleGuarantee} minutes`
          : ""
      }.`;
      setConversationHistory((prev) => [...prev, { from: "agent", message: counterMsg }]);

      // Update fields with counter
      setYears(response.counterOffer.years.toString());
      setAnnualSalary(response.counterOffer.annualSalary.toString());
      if (response.counterOffer.roleGuarantee) {
        setRoleGuarantee(response.counterOffer.roleGuarantee);
      }
    } else if (response.type === "reject") {
      setConversationHistory((prev) => [...prev, { from: "agent", message: response.message }]);
    } else if (response.type === "end_talks") {
      setConversationHistory((prev) => [
        ...prev,
        { from: "agent", message: response.message },
      ]);
      updateAgentRelationship(agent.id, userTeamId, response.relationshipDamage);
      setNegotiationEnded(true);
    }
  };

  const handleAccept = (offer: ContractOffer) => {
    if (isExtension) {
      extendPlayer(playerId, offer.years, offer.annualSalary);
    } else {
      signPlayer(playerId, userTeamId, offer.years, offer.annualSalary);
    }

    // Update agent relationship positively
    updateAgentRelationship(agent.id, userTeamId, 5);

    Alert.alert(
      "Deal Agreed!",
      `${player.name} has signed a ${offer.years}-year contract worth $${offer.totalValue.toFixed(1)}M.`,
      [
        {
          text: "OK",
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-gray-950">
      {/* Header */}
      <View
        className="bg-gradient-to-r from-purple-900 to-indigo-900 px-4 pb-3 border-b border-gray-800"
        style={{ paddingTop: insets.top + 12 }}
      >
        <View className="flex-row items-center justify-between mb-2">
          <Pressable onPress={() => navigation.goBack()} className="p-2 -ml-2">
            <Ionicons name="arrow-back" size={24} color="white" />
          </Pressable>
          <Text className="text-white text-lg font-bold">Contract Negotiation</Text>
          <View className="w-10" />
        </View>

        <View className="bg-gray-900/50 rounded-lg p-3 mt-2">
          <Text className="text-white text-xl font-bold">{player.name}</Text>
          <Text className="text-gray-300 text-sm">
            {player.position} • {player.overall} OVR • Age {player.age}
          </Text>
          <View className="mt-2 pt-2 border-t border-gray-700">
            <Text className="text-gray-400 text-xs">Negotiating with:</Text>
            <Text className="text-blue-400 font-semibold">
              {agent.name} ({agent.agency})
            </Text>
          </View>
        </View>
      </View>

      {/* Conversation History */}
      <ScrollView className="flex-1 px-4 py-4">
        {conversationHistory.map((item, index) => (
          <View
            key={index}
            className={`mb-4 ${
              item.from === "gm"
                ? "items-end"
                : item.from === "player"
                ? "items-center"
                : "items-start"
            }`}
          >
            <View
              className={`max-w-[85%] rounded-2xl p-4 ${
                item.from === "gm"
                  ? "bg-blue-600"
                  : item.from === "player"
                  ? "bg-green-900/60 border border-green-700"
                  : "bg-gray-800"
              }`}
            >
              <Text className="text-xs text-gray-400 mb-1">
                {item.from === "gm" ? "You (GM)" : item.from === "player" ? player.name : agent.name}
              </Text>
              <Text className="text-white">{item.message}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Offer Input Section */}
      {!negotiationEnded && (
        <View className="bg-gray-900 border-t border-gray-800 p-4" style={{ paddingBottom: insets.bottom + 16 }}>
          <Text className="text-white font-semibold mb-3">Make an Offer</Text>

          <View className="flex-row gap-3 mb-3">
            <View className="flex-1">
              <Text className="text-gray-400 text-xs mb-1">Years</Text>
              <TextInput
                className="bg-gray-800 text-white rounded-lg px-4 py-3"
                value={years}
                onChangeText={setYears}
                keyboardType="number-pad"
                placeholder="3"
                placeholderTextColor="#6B7280"
              />
            </View>

            <View className="flex-1">
              <Text className="text-gray-400 text-xs mb-1">Annual Salary ($M)</Text>
              <TextInput
                className="bg-gray-800 text-white rounded-lg px-4 py-3"
                value={annualSalary}
                onChangeText={setAnnualSalary}
                keyboardType="decimal-pad"
                placeholder="10.0"
                placeholderTextColor="#6B7280"
              />
            </View>
          </View>

          <View className="flex-row gap-3 mb-3">
            <View className="flex-1">
              <Text className="text-gray-400 text-xs mb-1">Role Guarantee</Text>
              <View className="flex-row gap-2">
                {(["starter", "rotation", "bench"] as const).map((role) => (
                  <Pressable
                    key={role}
                    onPress={() => setRoleGuarantee(role === roleGuarantee ? undefined : role)}
                    className={`flex-1 py-2 rounded-lg ${
                      roleGuarantee === role ? "bg-purple-600" : "bg-gray-800"
                    }`}
                  >
                    <Text className={`text-center text-xs ${roleGuarantee === role ? "text-white font-bold" : "text-gray-400"}`}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <Pressable
            onPress={handleMakeOffer}
            className="bg-blue-600 rounded-lg py-4 items-center active:bg-blue-700"
          >
            <Text className="text-white font-bold text-base">Submit Offer</Text>
          </Pressable>
        </View>
      )}

      {negotiationEnded && (
        <View className="bg-gray-900 border-t border-gray-800 p-4" style={{ paddingBottom: insets.bottom + 16 }}>
          <Text className="text-gray-400 text-center mb-3">Negotiation has ended</Text>
          <Pressable
            onPress={() => navigation.goBack()}
            className="bg-gray-700 rounded-lg py-4 items-center active:bg-gray-600"
          >
            <Text className="text-white font-bold text-base">Close</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
