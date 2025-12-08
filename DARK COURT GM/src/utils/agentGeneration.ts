import { Agent } from "../types/basketball";

// Real-world inspired agency names
const AGENCIES = [
  "CAA Sports",
  "Excel Sports Management",
  "Klutch Sports Group",
  "Wasserman Media Group",
  "Priority Sports",
  "BDA Sports Management",
  "Octagon",
  "Roc Nation Sports",
  "Independent Sports & Entertainment",
  "Creative Artists Agency",
  "Lagardère Sports",
  "ASM Sports",
  "Tandem Sports + Entertainment",
  "MVP Sports Group",
  "Young Money APAA Sports",
];

// Agent first names
const AGENT_FIRST_NAMES = [
  "Michael", "David", "Robert", "James", "Daniel", "Aaron", "Jeff", "Mark",
  "Rich", "Leon", "Bill", "Sam", "Austin", "Bernie", "Joel", "Andy",
  "Marc", "Raymond", "Todd", "Jason", "Greg", "Steve", "Brian", "Chris",
  "Nicole", "Jessica", "Lindsay", "Pamela", "Sarah", "Jennifer", "Michelle",
];

// Agent last names
const AGENT_LAST_NAMES = [
  "Rose", "Falk", "Duffy", "Tellem", "Paul", "Lee", "Austin", "Bartelstein",
  "Goodwin", "Mills", "Duffy", "Goldfeder", "Brown", "Koby", "Embiid",
  "Miller", "Stein", "Brothers", "Rapoport", "Turner", "Lawrence", "Kauffman",
  "Monroe", "Tannenbaum", "Casey", "Schwartz", "Wallace", "Montgomery",
];

export function generateAgents(count: number = 50): Agent[] {
  const agents: Agent[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < count; i++) {
    let name: string;
    do {
      const firstName =
        AGENT_FIRST_NAMES[Math.floor(Math.random() * AGENT_FIRST_NAMES.length)];
      const lastName =
        AGENT_LAST_NAMES[Math.floor(Math.random() * AGENT_LAST_NAMES.length)];
      name = `${firstName} ${lastName}`;
    } while (usedNames.has(name));

    usedNames.add(name);

    const agency = AGENCIES[Math.floor(Math.random() * AGENCIES.length)];

    // Generate attributes with some correlation
    const toughness = 40 + Math.floor(Math.random() * 60); // 40-100
    const riskTolerance = 30 + Math.floor(Math.random() * 70); // 30-100

    // Priorities should sum to ~100 but with variation
    const basePriorities = [
      Math.random() * 40 + 10, // 10-50
      Math.random() * 40 + 10, // 10-50
      Math.random() * 30 + 5, // 5-35
      Math.random() * 30 + 5, // 5-35
    ];
    const sum = basePriorities.reduce((a, b) => a + b, 0);
    const normalized = basePriorities.map((p) => Math.round((p / sum) * 100));

    agents.push({
      id: `agent-${i + 1}`,
      name,
      agency,
      toughness,
      riskTolerance,
      priorities: {
        money: normalized[0],
        role: normalized[1],
        market: normalized[2],
        contender: normalized[3],
      },
      clientIds: [],
      relationshipByTeam: {}, // Will be initialized as players get teams
      negotiationHistory: [],
      reputation: 50 + Math.floor(Math.random() * 40), // 50-90
    });
  }

  return agents;
}

export function assignAgentsToPlayers(
  players: any[],
  agents: Agent[]
): { updatedPlayers: any[]; updatedAgents: Agent[] } {
  const updatedPlayers = [...players];
  const updatedAgents = agents.map((agent) => ({
    ...agent,
    clientIds: [] as string[],
    relationshipByTeam: {} as { [teamId: string]: number },
    negotiationHistory: [] as any[]
  }));

  // Distribute players across agents
  // Star players (85+) tend to go to top agencies/agents
  // Role players distributed more evenly

  const starPlayers = updatedPlayers.filter((p) => p.overall >= 85);
  const goodPlayers = updatedPlayers.filter(
    (p) => p.overall >= 75 && p.overall < 85
  );
  const rolePlayers = updatedPlayers.filter(
    (p) => p.overall >= 65 && p.overall < 75
  );
  const benchPlayers = updatedPlayers.filter((p) => p.overall < 65);

  // Top agents get star players
  const topAgents = [...updatedAgents]
    .sort((a, b) => b.reputation - a.reputation)
    .slice(0, 15);
  const midAgents = [...updatedAgents]
    .sort((a, b) => b.reputation - a.reputation)
    .slice(15, 35);
  const allAgents = updatedAgents;

  // Assign stars to top agents (2-4 stars per top agent)
  starPlayers.forEach((player) => {
    const agent = topAgents[Math.floor(Math.random() * topAgents.length)];
    if (agent) {
      agent.clientIds.push(player.id);
      player.agentId = agent.id;
    }
  });

  // Assign good players to top/mid agents (3-6 per agent)
  goodPlayers.forEach((player) => {
    const pool = Math.random() < 0.6 ? topAgents : midAgents;
    const agent = pool[Math.floor(Math.random() * pool.length)];
    if (agent) {
      agent.clientIds.push(player.id);
      player.agentId = agent.id;
    }
  });

  // Assign role players to mid/all agents
  rolePlayers.forEach((player) => {
    const pool = Math.random() < 0.5 ? midAgents : allAgents;
    const agent = pool[Math.floor(Math.random() * pool.length)];
    if (agent) {
      agent.clientIds.push(player.id);
      player.agentId = agent.id;
    }
  });

  // Assign bench players to any agent
  benchPlayers.forEach((player) => {
    const agent = allAgents[Math.floor(Math.random() * allAgents.length)];
    if (agent) {
      agent.clientIds.push(player.id);
      player.agentId = agent.id;
    }
  });

  return { updatedPlayers, updatedAgents };
}

export function getAgentDialogue(
  agent: Agent,
  toughness: number,
  relationship: number
): {
  greeting: string;
  acceptMessages: string[];
  rejectMessages: string[];
  counterMessages: string[];
  endTalksMessages: string[];
  fairOfferMessages: string[];
  lowballMessages: string[];
} {
  const isAggressive = toughness > 70;
  const isFriendly = relationship > 40;
  const isHostile = relationship < -20;

  const greetings = isHostile
    ? [
        `Let's get straight to business. Given our history, I hope you're serious this time.`,
        `I'm here for my client. Let's see if you can make a real offer.`,
        `We're giving you another chance. Don't waste our time.`,
      ]
    : isFriendly
    ? [
        `Always a pleasure working with your organization. Let's make something happen.`,
        `Good to see you. I think we can find common ground here.`,
        `I appreciate the professionalism your team has shown. Let's talk numbers.`,
      ]
    : [
        `Thanks for sitting down with us. My client is excited about the possibilities.`,
        `I represent my client's best interests. Let's see what you're thinking.`,
        `Let's have a productive conversation. What are you offering?`,
      ];

  const acceptMessages = isAggressive
    ? [
        `You know what? That works. My client is happy. We have a deal.`,
        `Finally, a serious offer. We'll sign that.`,
        `That's what we wanted to see. Deal.`,
      ]
    : [
        `I think that's fair for everyone. My client will accept that offer.`,
        `We can work with those numbers. Let's get the paperwork started.`,
        `That's a good faith offer. We accept.`,
      ];

  const rejectMessages = isAggressive
    ? [
        `That's insulting. My client is worth way more than that.`,
        `Come on, we both know that's not even close. Do better.`,
        `Is this a joke? We're not entertaining lowball offers.`,
      ]
    : [
        `I appreciate the offer, but that's not in the ballpark for my client.`,
        `Unfortunately, that doesn't meet our expectations. Can you do better?`,
        `We were hoping for something more competitive. That won't work.`,
      ];

  const counterMessages = isAggressive
    ? [
        `Here's what we need to make this happen. This is our bottom line.`,
        `We'll meet you partway, but not at those numbers. Here's our counter.`,
        `You're getting closer. Let me throw out a number that actually works.`,
      ]
    : [
        `Let me propose something that might work for both sides.`,
        `What if we adjusted the terms a bit? Here's what I'm thinking.`,
        `We're interested, but the numbers need to change. Consider this counter.`,
      ];

  const endTalksMessages = [
    `We're done here. This isn't going anywhere. Good luck finding another option.`,
    `My client isn't interested in continuing these talks. We'll explore other opportunities.`,
    `I think we're too far apart. Let's revisit this another time. Maybe.`,
  ];

  const fairOfferMessages = [
    `That's a competitive offer. Let me discuss this with my client.`,
    `Now we're in the right range. This is closer to what we're looking for.`,
    `I respect that offer. We're taking this seriously now.`,
  ];

  const lowballMessages = isAggressive
    ? [
        `Are you kidding me with this? My client is a proven player, not a rookie minimum guy.`,
        `That's disrespectful. We're not even going to counter that joke of an offer.`,
        `This is exactly why we have trust issues. Stop wasting everyone's time.`,
      ]
    : [
        `I'm disappointed. I thought we could have a more serious negotiation than this.`,
        `That offer suggests you don't value my client's contributions. We expected better.`,
        `This isn't a productive starting point. Let's reset and try again.`,
      ];

  return {
    greeting: greetings[Math.floor(Math.random() * greetings.length)],
    acceptMessages,
    rejectMessages,
    counterMessages,
    endTalksMessages,
    fairOfferMessages,
    lowballMessages,
  };
}
