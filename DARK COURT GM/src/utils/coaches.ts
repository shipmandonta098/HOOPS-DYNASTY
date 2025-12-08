import { Coach } from "../types/basketball";

/**
 * Generate a coach with realistic attributes, bio, and personality
 */
export function generateCoach(teamId: string, gender: "male" | "female" | "mixed" = "male"): Coach {
  const nationalities = [
    {
      name: "USA",
      flag: "🇺🇸",
      weight: 80,
      maleFirstNames: [
        "Mike", "Steve", "Greg", "Erik", "Rick", "Doc", "Phil", "Larry", "Pat",
        "Gregg", "Brad", "Nick", "Tom", "Monty", "Ty", "Ime", "Darvin", "Michael",
        "Chris", "Scott", "Mark", "Willie", "JB", "Quinn", "Adrian", "Jamahl"
      ],
      femaleFirstNames: [
        "Dawn", "Geno", "Kim", "Tara", "Cheryl", "Pat", "Becky", "Nikki", "Lisa",
        "Cori", "Stephanie", "Brenda", "Suzie", "Jenny", "Niele", "Kara", "Nell"
      ],
      lastNames: [
        "Brown", "Kerr", "Popovich", "Stevens", "Nurse", "Rivers", "Jackson",
        "Spoelstra", "Malone", "Thibodeau", "Budenholzer", "Williams", "Snyder",
        "Udoka", "Ham", "Finch", "Vogel", "Jenkins", "Clifford", "Green"
      ],
      hometowns: [
        "Chicago, IL", "Los Angeles, CA", "New York, NY", "Boston, MA",
        "San Antonio, TX", "Oakland, CA", "Philadelphia, PA", "Detroit, MI"
      ],
    },
    {
      name: "Canada",
      flag: "🇨🇦",
      weight: 8,
      maleFirstNames: ["Nick", "Dwane", "Jay", "Mike"],
      femaleFirstNames: ["Lisa", "Allison", "Michele", "Kathy"],
      lastNames: ["Nurse", "Casey", "Triano", "Hopkins"],
      hometowns: ["Toronto, ON", "Montreal, QC", "Vancouver, BC"],
    },
    {
      name: "Serbia",
      flag: "🇷🇸",
      weight: 5,
      maleFirstNames: ["Igor", "Aleksandar", "Željko", "Dejan"],
      femaleFirstNames: ["Marina", "Jelena", "Sonja", "Ana"],
      lastNames: ["Kokoškov", "Đorđević", "Obradović", "Radonjić"],
      hometowns: ["Belgrade", "Novi Sad"],
    },
    {
      name: "France",
      flag: "🇫🇷",
      weight: 4,
      maleFirstNames: ["Vincent", "Jean", "Pierre"],
      femaleFirstNames: ["Valerie", "Celine", "Isabelle"],
      lastNames: ["Collet", "Poirier", "Dupont"],
      hometowns: ["Paris", "Lyon"],
    },
    {
      name: "Australia",
      flag: "🇦🇺",
      weight: 3,
      maleFirstNames: ["Brett", "Brian", "Andrew"],
      femaleFirstNames: ["Sandy", "Carrie", "Lauren"],
      lastNames: ["Brown", "Goorjian", "Bogut"],
      hometowns: ["Melbourne, VIC", "Sydney, NSW"],
    },
  ];

  // Create weighted array
  const weightedNationalities: typeof nationalities[0][] = [];
  nationalities.forEach((nat) => {
    for (let i = 0; i < nat.weight; i++) {
      weightedNationalities.push(nat);
    }
  });

  const nationality = weightedNationalities[Math.floor(Math.random() * weightedNationalities.length)];

  // Determine coach gender
  let coachGender: "male" | "female";
  if (gender === "mixed") {
    coachGender = Math.random() < 0.5 ? "male" : "female";
  } else {
    coachGender = gender;
  }

  // Generate name based on gender
  const firstNameArray = coachGender === "male" ? nationality.maleFirstNames : nationality.femaleFirstNames;
  const firstName = firstNameArray[Math.floor(Math.random() * firstNameArray.length)];
  const lastName = nationality.lastNames[Math.floor(Math.random() * nationality.lastNames.length)];
  const hometown = nationality.hometowns[Math.floor(Math.random() * nationality.hometowns.length)];

  // Age between 35-70
  const age = Math.floor(Math.random() * 36) + 35;

  // Experience correlates somewhat with age
  const experience = Math.max(1, Math.floor((age - 35) / 3) + Math.floor(Math.random() * 8));

  // Former player (60% chance)
  const formerPlayer = Math.random() < 0.6;

  // Coaching styles
  const coachingStyles = [
    "Defensive Minded",
    "Offensive Guru",
    "Player Development Focused",
    "Tactical Mastermind",
    "Players Coach",
    "Disciplinarian",
    "Analytics-Driven",
    "Old School"
  ];
  const coachingStyle = coachingStyles[Math.floor(Math.random() * coachingStyles.length)];

  // Generate playing career description if former player
  const playingCareerDescriptions = [
    "Former NBA role player with 8-year career",
    "Ex-All-Star point guard",
    "Championship-winning forward",
    "Journeyman guard who played for 5 teams",
    "Overseas star before brief NBA stint",
    "College basketball legend",
    "Former defensive specialist",
    "Retired after injury-shortened career"
  ];

  const playingCareer = formerPlayer
    ? playingCareerDescriptions[Math.floor(Math.random() * playingCareerDescriptions.length)]
    : undefined;

  // Generate attributes based on coaching style and experience
  const generateAttr = (base: number = 70, variance: number = 15) => {
    const value = base + Math.floor(Math.random() * variance * 2) - variance;
    return Math.max(50, Math.min(99, value));
  };

  let attributes = {
    offense: generateAttr(70),
    defense: generateAttr(70),
    playerDevelopment: generateAttr(68),
    management: generateAttr(72),
    motivation: generateAttr(70),
    clutch: generateAttr(68),
    adaptability: generateAttr(70),
  };

  // Adjust attributes based on coaching style
  switch (coachingStyle) {
    case "Defensive Minded":
      attributes.defense += 10;
      attributes.offense -= 5;
      break;
    case "Offensive Guru":
      attributes.offense += 10;
      attributes.defense -= 5;
      break;
    case "Player Development Focused":
      attributes.playerDevelopment += 12;
      attributes.clutch -= 3;
      break;
    case "Tactical Mastermind":
      attributes.adaptability += 8;
      attributes.motivation -= 3;
      break;
    case "Players Coach":
      attributes.management += 10;
      attributes.motivation += 5;
      break;
    case "Disciplinarian":
      attributes.management += 5;
      attributes.motivation -= 5;
      break;
    case "Analytics-Driven":
      attributes.adaptability += 8;
      attributes.offense += 5;
      break;
  }

  // Boost attributes slightly with experience
  const expBonus = Math.floor(experience / 5);
  Object.keys(attributes).forEach((key) => {
    attributes[key as keyof typeof attributes] = Math.min(
      99,
      attributes[key as keyof typeof attributes] + expBonus
    );
  });

  // Calculate overall from attributes
  const overall = Math.floor(
    (attributes.offense +
      attributes.defense +
      attributes.playerDevelopment +
      attributes.management +
      attributes.motivation +
      attributes.clutch +
      attributes.adaptability) /
      7
  );

  // Generate personality traits
  const generatePersonalityTrait = () => Math.floor(Math.random() * 60) + 20;

  const personality = {
    patience: generatePersonalityTrait(),
    intensity: generatePersonalityTrait(),
    loyalty: generatePersonalityTrait(),
    innovation: generatePersonalityTrait(),
    communication: generatePersonalityTrait(),
    discipline: generatePersonalityTrait(),
    confidence: generatePersonalityTrait(),
  };

  // Adjust personality based on coaching style
  switch (coachingStyle) {
    case "Defensive Minded":
      personality.intensity += 15;
      personality.discipline += 10;
      break;
    case "Player Development Focused":
      personality.patience += 20;
      personality.intensity -= 10;
      break;
    case "Disciplinarian":
      personality.discipline += 20;
      personality.patience -= 15;
      personality.intensity += 10;
      break;
    case "Players Coach":
      personality.communication += 15;
      personality.patience += 10;
      break;
    case "Analytics-Driven":
      personality.innovation += 20;
      break;
  }

  // Cap personality traits at 100
  Object.keys(personality).forEach((key) => {
    personality[key as keyof typeof personality] = Math.min(
      100,
      Math.max(0, personality[key as keyof typeof personality])
    );
  });

  // Generate contract (3-5 years, 3-8M per year based on overall)
  const contractYears = Math.floor(Math.random() * 3) + 3;
  const contractSalary = 3 + (overall / 99) * 5 + Math.random() * 2;

  // Career record (rough estimation based on experience)
  const gamesCoached = experience * 82;
  const winPercentage = 0.35 + (overall / 99) * 0.3; // 35-65% win rate
  const careerWins = Math.floor(gamesCoached * winPercentage);
  const careerLosses = gamesCoached - careerWins;

  // Championships (rare, higher chance for better coaches)
  let championships = 0;
  if (overall >= 85 && Math.random() < 0.3) championships = Math.floor(Math.random() * 3) + 1;
  else if (overall >= 80 && Math.random() < 0.15) championships = 1;

  return {
    id: `coach-${teamId}`,
    name: `${firstName} ${lastName}`,
    age,
    overall,
    experience,
    gender: coachGender,
    attributes,
    bio: {
      hometown,
      country: nationality.name,
      countryFlag: nationality.flag,
      formerPlayer,
      playingCareer,
      coachingStyle,
    },
    personality,
    contract: {
      years: contractYears,
      salary: Math.round(contractSalary * 10) / 10,
    },
    teamId,
    championships,
    careerWins,
    careerLosses,
  };
}

/**
 * Generate coaches for all teams
 */
export function generateCoaches(teamIds: string[], gender: "male" | "female" | "mixed" = "male"): Coach[] {
  return teamIds.map((teamId) => generateCoach(teamId, gender));
}
