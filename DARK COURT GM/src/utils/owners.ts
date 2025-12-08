import { Owner } from "../types/basketball";

/**
 * Generate an owner with realistic attributes, bio, and personality
 */
export function generateOwner(teamId: string, gender: "male" | "female" | "mixed" = "male"): Owner {
  const nationalities = [
    {
      name: "USA",
      flag: "🇺🇸",
      weight: 85,
      maleFirstNames: [
        "James", "Michael", "Robert", "David", "Richard", "Charles", "Daniel", "Steven",
        "Mark", "Paul", "Donald", "George", "Kenneth", "Anthony", "William", "Kevin",
        "Brian", "Edward", "Ronald", "Timothy", "Jason", "Jeffrey", "Ryan", "Jacob"
      ],
      femaleFirstNames: [
        "Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica",
        "Sarah", "Karen", "Nancy", "Betty", "Margaret", "Sandra", "Ashley", "Kimberly",
        "Emily", "Donna", "Michelle", "Carol", "Amanda", "Melissa", "Deborah", "Stephanie"
      ],
      lastNames: [
        "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
        "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
        "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Thompson", "White", "Harris"
      ],
      hometowns: [
        "New York, NY", "Los Angeles, CA", "Chicago, IL", "Houston, TX", "Phoenix, AZ",
        "San Francisco, CA", "Boston, MA", "Seattle, WA", "Dallas, TX", "Miami, FL"
      ],
    },
    {
      name: "Canada",
      flag: "🇨🇦",
      weight: 5,
      maleFirstNames: ["Robert", "David", "James", "Michael", "John", "William", "Stephen"],
      femaleFirstNames: ["Mary", "Linda", "Patricia", "Susan", "Margaret", "Karen", "Jennifer"],
      lastNames: ["Smith", "Brown", "Wilson", "Martin", "Roy", "Campbell", "Anderson"],
      hometowns: ["Toronto, ON", "Montreal, QC", "Vancouver, BC"],
    },
    {
      name: "UK",
      flag: "🇬🇧",
      weight: 5,
      maleFirstNames: ["James", "Oliver", "George", "William", "Charles", "Edward", "Henry"],
      femaleFirstNames: ["Elizabeth", "Margaret", "Victoria", "Catherine", "Emma", "Charlotte", "Sophie"],
      lastNames: ["Smith", "Jones", "Williams", "Brown", "Taylor", "Davies", "Wilson"],
      hometowns: ["London", "Manchester", "Birmingham"],
    },
    {
      name: "China",
      flag: "🇨🇳",
      weight: 3,
      maleFirstNames: ["Wei", "Ming", "Jun", "Li", "Chen", "Yang"],
      femaleFirstNames: ["Li", "Mei", "Xiu", "Yan", "Ying", "Fang"],
      lastNames: ["Wang", "Li", "Zhang", "Liu", "Chen", "Yang"],
      hometowns: ["Beijing", "Shanghai", "Shenzhen"],
    },
    {
      name: "Russia",
      flag: "🇷🇺",
      weight: 2,
      maleFirstNames: ["Dmitry", "Sergei", "Mikhail", "Alexander", "Vladimir"],
      femaleFirstNames: ["Olga", "Tatiana", "Elena", "Natalia", "Maria"],
      lastNames: ["Ivanov", "Petrov", "Sokolov", "Volkov", "Fedorov"],
      hometowns: ["Moscow", "St. Petersburg"],
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

  // Determine owner gender
  let ownerGender: "male" | "female";
  if (gender === "mixed") {
    ownerGender = Math.random() < 0.5 ? "male" : "female";
  } else {
    ownerGender = gender;
  }

  // Generate name based on gender
  const firstNameArray = ownerGender === "male" ? nationality.maleFirstNames : nationality.femaleFirstNames;
  const firstName = firstNameArray[Math.floor(Math.random() * firstNameArray.length)];
  const lastName = nationality.lastNames[Math.floor(Math.random() * nationality.lastNames.length)];
  const hometown = nationality.hometowns[Math.floor(Math.random() * nationality.hometowns.length)];

  // Age between 40-75
  const age = Math.floor(Math.random() * 36) + 40;

  // Net worth between 1.5B and 50B
  const netWorth = parseFloat((1.5 + Math.random() * 48.5).toFixed(1));

  // Business backgrounds
  const businessBackgrounds = [
    "Tech Entrepreneur",
    "Real Estate Mogul",
    "Investment Banker",
    "Entertainment Mogul",
    "Sports Franchise Investor",
    "Private Equity Investor",
    "Hedge Fund Manager",
    "Oil and Gas Executive",
    "Pharmaceutical CEO",
    "E-commerce Pioneer",
    "Manufacturing Magnate",
    "Media Tycoon",
    "Venture Capitalist",
    "Hotel and Casino Owner",
    "Automotive Industry Leader"
  ];
  const businessBackground = businessBackgrounds[Math.floor(Math.random() * businessBackgrounds.length)];

  // Generate personality traits
  const generatePersonalityTrait = () => Math.floor(Math.random() * 60) + 20;

  const personality = {
    patience: generatePersonalityTrait(),
    loyalty: generatePersonalityTrait(),
    wealthDisplay: generatePersonalityTrait(),
    meddling: generatePersonalityTrait(),
    publicity: generatePersonalityTrait(),
  };

  // Years owned: 1-20 years
  const yearsOwned = Math.floor(Math.random() * 20) + 1;

  // Championships (rare, based on years owned)
  let championships = 0;
  if (yearsOwned >= 15 && Math.random() < 0.3) championships = Math.floor(Math.random() * 3) + 1;
  else if (yearsOwned >= 10 && Math.random() < 0.2) championships = Math.floor(Math.random() * 2) + 1;
  else if (yearsOwned >= 5 && Math.random() < 0.1) championships = 1;

  return {
    id: `owner-${teamId}`,
    name: `${firstName} ${lastName}`,
    age,
    gender: ownerGender,
    netWorth,
    bio: {
      hometown,
      country: nationality.name,
      countryFlag: nationality.flag,
      businessBackground,
    },
    personality,
    teamId,
    yearsOwned,
    championships,
  };
}

/**
 * Generate owners for all teams
 */
export function generateOwners(teamIds: string[], gender: "male" | "female" | "mixed" = "male"): Owner[] {
  return teamIds.map((teamId) => generateOwner(teamId, gender));
}
