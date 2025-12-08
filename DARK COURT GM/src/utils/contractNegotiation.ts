import {
  Agent,
  Player,
  Team,
  ContractOffer,
  ContractTarget,
  NegotiationResponse,
} from "../types/basketball";
import { getAgentDialogue } from "./agentGeneration";

/**
 * Calculate the target contract range for a player based on their attributes,
 * personality, agent characteristics, and team relationship
 * Uses 2025 NBA-style salary tiers
 */
export function calculateContractTarget(
  player: Player,
  agent: Agent,
  team: Team,
  teamWinPercentage: number
): ContractTarget {
  const { overall, age, potential, personality } = player;

  // Base salary calculation using 2025 NBA salary tiers
  let baseSalary = 1.0; // Minimum

  if (overall >= 92) baseSalary = 46; // Superstar (40-52M range)
  else if (overall >= 88) baseSalary = 33; // All-Star (28-38M range)
  else if (overall >= 82) baseSalary = 20; // Starter (15-25M range)
  else if (overall >= 78) baseSalary = 12.5; // Role player (10-15M range)
  else if (overall >= 74) baseSalary = 6.5; // Bench (4-9M range)
  else if (overall >= 70) baseSalary = 2.9; // Deep bench (1.8-4M range)
  else baseSalary = 1.4; // Minimum (1-1.8M range)

  // Adjust for age (younger players with potential get more)
  if (age < 25 && potential > overall + 5) {
    baseSalary *= 1.15;
  } else if (age > 32) {
    baseSalary *= 0.85;
  }

  // Agent toughness increases ask
  const toughnessMultiplier = 1 + (agent.toughness - 50) / 200; // 0.75 to 1.25
  baseSalary *= toughnessMultiplier;

  // Player greed increases ask
  const greedMultiplier = 1 + (personality.greed - 50) / 200; // 0.75 to 1.25
  baseSalary *= greedMultiplier;

  // Agent relationship with team affects flexibility
  const relationship = agent.relationshipByTeam[team.id] || 0;
  const relationshipDiscount = relationship > 50 ? 0.95 : relationship < -30 ? 1.1 : 1.0;
  baseSalary *= relationshipDiscount;

  // Calculate salary range
  const minAnnualSalary = Math.max(1.0, baseSalary * 0.85);
  const maxAnnualSalary = baseSalary * 1.15;
  const idealAnnualSalary = baseSalary;

  // Years calculation based on overall and age (2025 NBA style)
  let idealYears = 3;
  if (overall >= 92) idealYears = 5; // Superstars want max deals
  else if (overall >= 85) idealYears = 4; // Stars want long deals
  else if (age < 26) idealYears = 3; // Young players want security
  else if (age > 30) idealYears = 2; // Older players shorter deals
  else if (age > 33) idealYears = 1; // Veterans get 1-year deals

  const minYears = Math.max(1, idealYears - 1);
  const maxYears = Math.min(5, idealYears + 1);

  // Role requirements
  const mustHaveStarterRole = overall >= 75 && personality.playTime > 60;

  // Market preference (agent priority)
  const preferredMarketSize =
    agent.priorities.market > 60 ? "Large" : agent.priorities.market > 30 ? "Medium" : undefined;

  // Winning requirement (player personality + agent priority)
  const mustBeContender =
    (personality.winning > 75 && teamWinPercentage < 0.45) ||
    (agent.priorities.contender > 70 && teamWinPercentage < 0.5);

  return {
    minYears,
    maxYears,
    minAnnualSalary: parseFloat(minAnnualSalary.toFixed(1)),
    maxAnnualSalary: parseFloat(maxAnnualSalary.toFixed(1)),
    idealYears,
    idealAnnualSalary: parseFloat(idealAnnualSalary.toFixed(1)),
    mustHaveStarterRole,
    preferredMarketSize,
    mustBeContender,
  };
}

/**
 * Score an offer against the target contract
 * Returns a score from -100 (terrible) to 100 (excellent)
 */
export function scoreOffer(
  offer: ContractOffer,
  target: ContractTarget,
  agent: Agent,
  player: Player,
  team: Team
): number {
  let score = 0;

  // Salary scoring (most important)
  const salaryWeight = agent.priorities.money / 100;
  const salaryDiff = offer.annualSalary - target.idealAnnualSalary;
  const salaryRange = target.maxAnnualSalary - target.minAnnualSalary;

  if (offer.annualSalary >= target.maxAnnualSalary) {
    score += 40 * salaryWeight; // Exceeds expectations
  } else if (offer.annualSalary >= target.idealAnnualSalary) {
    const percentage = (salaryDiff / salaryRange) * 20;
    score += (20 + percentage) * salaryWeight;
  } else if (offer.annualSalary >= target.minAnnualSalary) {
    const percentage = ((offer.annualSalary - target.minAnnualSalary) / salaryRange) * 20;
    score += percentage * salaryWeight;
  } else {
    // Below minimum - very bad
    const belowBy = ((target.minAnnualSalary - offer.annualSalary) / target.minAnnualSalary) * 40;
    score -= belowBy * salaryWeight;
  }

  // Years scoring
  const yearWeight = 0.3;
  if (offer.years >= target.minYears && offer.years <= target.maxYears) {
    const yearDiff = Math.abs(offer.years - target.idealYears);
    score += (15 - yearDiff * 5) * yearWeight;
  } else if (offer.years < target.minYears) {
    score -= 15 * yearWeight;
  } else {
    score -= 10 * yearWeight; // Too many years is less bad
  }

  // Role guarantee scoring
  const roleWeight = agent.priorities.role / 100;
  if (target.mustHaveStarterRole) {
    if (offer.roleGuarantee === "starter") {
      score += 20 * roleWeight;
    } else if (offer.roleGuarantee === "rotation") {
      score += 5 * roleWeight;
    } else {
      score -= 25 * roleWeight; // Deal breaker
    }
  } else if (offer.roleGuarantee === "starter") {
    score += 10 * roleWeight; // Nice bonus
  } else if (offer.roleGuarantee === "rotation") {
    score += 5 * roleWeight;
  }

  // Market size scoring
  const marketWeight = agent.priorities.market / 100;
  if (target.preferredMarketSize && team.marketSize !== target.preferredMarketSize) {
    score -= 10 * marketWeight;
  }

  // Contender requirement
  const contenderWeight = agent.priorities.contender / 100;
  if (target.mustBeContender) {
    score -= 30 * contenderWeight; // Can't be overcome
  }

  // Incentives boost
  if (offer.incentives && offer.incentives > 0) {
    score += Math.min(10, offer.incentives / 2);
  }

  // Agent relationship bonus/penalty
  const relationship = agent.relationshipByTeam[team.id] || 0;
  if (relationship > 50) {
    score += 5; // Give benefit of doubt
  } else if (relationship < -30) {
    score -= 10; // Skeptical of offers
  }

  return Math.round(score);
}

/**
 * Process an offer and generate agent response
 */
export function processNegotiation(
  offer: ContractOffer,
  target: ContractTarget,
  agent: Agent,
  player: Player,
  team: Team
): NegotiationResponse {
  const score = scoreOffer(offer, target, agent, player, team);
  const relationship = agent.relationshipByTeam[team.id] || 0;
  const dialogue = getAgentDialogue(agent, agent.toughness, relationship);

  // Deal breakers
  if (target.mustBeContender) {
    return {
      type: "end_talks",
      message: dialogue.endTalksMessages[0] + " My client wants to compete for a championship, and frankly, this roster isn't there yet.",
      relationshipDamage: -10,
    };
  }

  if (target.mustHaveStarterRole && offer.roleGuarantee !== "starter") {
    return {
      type: "reject",
      message: `${dialogue.rejectMessages[0]} My client needs guaranteed starter minutes. That's non-negotiable.`,
    };
  }

  // Score-based responses
  if (score >= 75) {
    // Excellent offer - accept
    return {
      type: "accept",
      message: dialogue.acceptMessages[Math.floor(Math.random() * dialogue.acceptMessages.length)],
    };
  } else if (score >= 50) {
    // Good offer - accept with positive tone
    return {
      type: "accept",
      message: dialogue.fairOfferMessages[Math.floor(Math.random() * dialogue.fairOfferMessages.length)] + " We accept this deal.",
    };
  } else if (score >= 20) {
    // Mediocre offer - counter
    const counterOffer = generateCounterOffer(offer, target, agent);
    return {
      type: "counter",
      message: dialogue.counterMessages[Math.floor(Math.random() * dialogue.counterMessages.length)],
      counterOffer,
    };
  } else if (score >= -20) {
    // Poor offer - reject firmly
    return {
      type: "reject",
      message: dialogue.rejectMessages[Math.floor(Math.random() * dialogue.rejectMessages.length)],
    };
  } else {
    // Terrible offer - end talks and damage relationship
    const damage = Math.min(-5, Math.floor(score / 10));
    return {
      type: "end_talks",
      message: dialogue.lowballMessages[Math.floor(Math.random() * dialogue.lowballMessages.length)],
      relationshipDamage: damage,
    };
  }
}

/**
 * Generate a counteroffer based on the original offer and target
 */
function generateCounterOffer(
  offer: ContractOffer,
  target: ContractTarget,
  agent: Agent
): ContractOffer {
  // Start from ideal and meet them partway
  let counterSalary: number;
  let counterYears: number;

  if (offer.annualSalary < target.minAnnualSalary) {
    // Way too low, counter with min
    counterSalary = target.minAnnualSalary;
  } else {
    // Meet them somewhere between their offer and ideal
    const gap = target.idealAnnualSalary - offer.annualSalary;
    counterSalary = offer.annualSalary + gap * 0.6;
  }

  // Years counter
  if (offer.years < target.minYears) {
    counterYears = target.minYears;
  } else if (offer.years > target.maxYears) {
    counterYears = target.maxYears;
  } else {
    counterYears = target.idealYears;
  }

  return {
    years: counterYears,
    annualSalary: parseFloat(counterSalary.toFixed(1)),
    totalValue: parseFloat((counterSalary * counterYears).toFixed(1)),
    roleGuarantee: target.mustHaveStarterRole ? "starter" : offer.roleGuarantee,
    incentives: offer.incentives,
  };
}

/**
 * Check for rare player-driven override events
 */
export function checkPlayerOverride(
  player: Player,
  offer: ContractOffer,
  target: ContractTarget,
  team: Team,
  isExtension: boolean
): { override: boolean; message?: string; decision?: "accept" | "reject" } {
  const { personality, teamId } = player;

  // Very loyal player taking hometown discount (extension only)
  if (
    isExtension &&
    personality.loyalty > 85 &&
    teamId === team.id &&
    offer.annualSalary >= target.minAnnualSalary * 0.9
  ) {
    if (Math.random() < 0.15) {
      // 15% chance
      return {
        override: true,
        decision: "accept",
        message: `"I love this city and this team. Let's make it happen. I'm not about the money - I want to retire here."`,
      };
    }
  }

  // Very ambitious young player refusing extension to test free agency
  if (
    isExtension &&
    player.age < 27 &&
    player.overall >= 80 &&
    personality.greed > 75 &&
    personality.loyalty < 40
  ) {
    if (Math.random() < 0.2) {
      // 20% chance
      return {
        override: true,
        decision: "reject",
        message: `"With all due respect, I want to see what I'm worth on the open market. I'm betting on myself."`,
      };
    }
  }

  // Ring-chasing veteran (low salary, must be contender)
  if (
    player.age > 32 &&
    player.overall >= 75 &&
    personality.winning > 80 &&
    team.wins / (team.wins + team.losses) > 0.6
  ) {
    if (Math.random() < 0.1) {
      // 10% chance
      return {
        override: true,
        decision: "accept",
        message: `"I want a championship. That's all that matters at this stage. Let's get it done."`,
      };
    }
  }

  return { override: false };
}
