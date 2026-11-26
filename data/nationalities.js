/* ==========================================================================
   HOOPS DYNASTY — nationality configuration (single source of truth)

   Everything about where players come from lives here, so distributions can
   be tuned without touching generation code:

   LEAGUE_MIX       share of American players per league (varied per dynasty)
   COUNTRIES[code]  {
     name, region,
     weight          relative weight among INTERNATIONAL players (US = 0),
                     informed by modern professional league representation
     collegeRate     share who play U.S. college basketball
     pathways        weights for non-college development routes
     backgrounds     cultural naming backgrounds { id: weight } (data/name-pools.js)
                     A nationality is never a single ethnicity.
     cities          birth cities (US entries are "City|State")
   }

   Add a country: add an entry here, a flag in scripts/flags.js and (if
   needed) a naming background in data/name-pools.js.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HDNationalities = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // American share of each generated league: 73% target, varying per
  // dynasty between 70% and 76% (international 24–30%).
  var LEAGUE_MIX = Object.freeze({ usShareTarget: 0.73, usShareVariation: 0.03 });

  var REGIONS = {
    'north-america': 'North America',
    'latin-america': 'Latin America & Caribbean',
    'europe': 'Europe',
    'africa': 'Africa',
    'oceania': 'Oceania',
    'asia': 'Asia & Middle East'
  };

  // Development routes for players who did not play U.S. college basketball
  var PATHWAYS = {
    'ncaa': 'NCAA college basketball',
    'domestic-club': 'Professional club (home country)',
    'foreign-club': 'Professional club (abroad)',
    'academy': 'International basketball academy',
    'pro-development': 'Professional development program',
    'prep': 'Prep school'
  };

  // Typical league entry ages per route (college: 1–5 seasons after 18)
  var ENTRY_AGES = {
    'ncaa': [19, 19, 20, 20, 21, 22, 22, 23],
    'domestic-club': [19, 20, 20, 21, 21, 22],
    'foreign-club': [19, 20, 21, 21, 22],
    'academy': [19, 19, 20],
    'pro-development': [19, 19, 20],
    'prep': [19]
  };

  // Countries whose clubs commonly develop foreign players
  var CLUB_HUBS = ['ES', 'FR', 'DE', 'IT', 'GR', 'TR', 'LT', 'RS', 'AU', 'IL'];

  var EUROPE_PATH = { 'domestic-club': 75, 'foreign-club': 20, 'academy': 5 };
  var AFRICA_PATH = { 'academy': 45, 'foreign-club': 40, 'domestic-club': 15 };
  var LATAM_PATH = { 'domestic-club': 40, 'foreign-club': 40, 'academy': 20 };
  var ASIA_PATH = { 'domestic-club': 70, 'foreign-club': 20, 'academy': 10 };
  var OCEANIA_PATH = { 'pro-development': 50, 'domestic-club': 40, 'academy': 10 };

  function c(name, region, weight, collegeRate, pathways, backgrounds, cities) {
    return { name: name, region: region, weight: weight, collegeRate: collegeRate, pathways: pathways, backgrounds: backgrounds, cities: cities };
  }

  var COUNTRIES = {
    US: c('United States', 'north-america', 0, 0.9,
      { 'pro-development': 60, 'foreign-club': 30, 'prep': 10 },
      { 'african-american': 54, 'european-american': 26, 'hispanic-latino': 7, 'asian-american': 3, 'nigerian': 3,
        'caribbean-anglo': 3, 'west-african-francophone': 1, 'south-slavic': 1, 'east-african': 1, 'arab': 1 },
      ['Atlanta|Georgia', 'Chicago|Illinois', 'Los Angeles|California', 'Oakland|California', 'Philadelphia|Pennsylvania',
        'New York|New York', 'Brooklyn|New York', 'Baltimore|Maryland', 'Washington|D.C.', 'Detroit|Michigan',
        'Houston|Texas', 'Dallas|Texas', 'San Antonio|Texas', 'Memphis|Tennessee', 'Nashville|Tennessee',
        'Indianapolis|Indiana', 'Gary|Indiana', 'Louisville|Kentucky', 'Charlotte|North Carolina', 'Raleigh|North Carolina',
        'Durham|North Carolina', 'Greensboro|North Carolina', 'Richmond|Virginia', 'Norfolk|Virginia', 'Miami|Florida',
        'Orlando|Florida', 'Jacksonville|Florida', 'Tampa|Florida', 'New Orleans|Louisiana', 'Baton Rouge|Louisiana',
        'Jackson|Mississippi', 'Birmingham|Alabama', 'Mobile|Alabama', 'St. Louis|Missouri', 'Kansas City|Missouri',
        'Milwaukee|Wisconsin', 'Minneapolis|Minnesota', 'Cleveland|Ohio', 'Columbus|Ohio', 'Cincinnati|Ohio',
        'Pittsburgh|Pennsylvania', 'Boston|Massachusetts', 'Newark|New Jersey', 'Seattle|Washington', 'Portland|Oregon',
        'Phoenix|Arizona', 'Las Vegas|Nevada', 'Denver|Colorado', 'Salt Lake City|Utah', 'Oklahoma City|Oklahoma',
        'Tulsa|Oklahoma', 'Little Rock|Arkansas', 'Omaha|Nebraska', 'Sacramento|California', 'San Diego|California',
        'Compton|California', 'Fresno|California', 'Albuquerque|New Mexico', 'Hartford|Connecticut', 'Buffalo|New York']),

    CA: c('Canada', 'north-america', 20, 0.8, { 'pro-development': 40, 'foreign-club': 35, 'prep': 25 },
      { 'anglo': 40, 'french-canadian': 10, 'caribbean-anglo': 14, 'nigerian': 10, 'east-african': 8, 'west-african-francophone': 4,
        'chinese': 3, 'south-slavic': 4, 'arab': 3, 'european-american': 4 },
      ['Toronto', 'Montreal', 'Vancouver', 'Mississauga', 'Brampton', 'Ottawa', 'Hamilton', 'Calgary', 'Edmonton', 'Winnipeg', 'Scarborough', 'Pickering']),
    FR: c('France', 'europe', 13, 0.15, EUROPE_PATH,
      { 'french': 42, 'west-african-francophone': 30, 'central-african': 10, 'maghrebi': 10, 'caribbean-french': 8 },
      ['Paris', 'Lyon', 'Marseille', 'Lille', 'Strasbourg', 'Nantes', 'Bordeaux', 'Toulouse', 'Le Mans', 'Saint-Denis', 'Évry', 'Nanterre']),
    AU: c('Australia', 'oceania', 10, 0.55, OCEANIA_PATH,
      { 'anglo': 58, 'south-slavic': 10, 'greek': 7, 'east-african': 10, 'maori-pasifika': 7, 'italian': 8 },
      ['Melbourne', 'Sydney', 'Brisbane', 'Perth', 'Adelaide', 'Canberra', 'Gold Coast', 'Newcastle', 'Hobart', 'Cairns']),
    DE: c('Germany', 'europe', 7, 0.25, EUROPE_PATH,
      { 'german': 64, 'turkish': 12, 'nigerian': 8, 'south-slavic': 8, 'west-african-francophone': 4, 'arab': 4 },
      ['Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Bamberg', 'Ulm', 'Würzburg', 'Göttingen', 'Bonn', 'Oldenburg']),
    RS: c('Serbia', 'europe', 6, 0.08, EUROPE_PATH, { 'serbian': 100 },
      ['Belgrade', 'Novi Sad', 'Niš', 'Kragujevac', 'Subotica', 'Čačak', 'Kraljevo', 'Zrenjanin', 'Sombor', 'Užice']),
    NG: c('Nigeria', 'africa', 6, 0.7, AFRICA_PATH, { 'nigerian': 100 },
      ['Lagos', 'Abuja', 'Ibadan', 'Enugu', 'Port Harcourt', 'Benin City', 'Kano', 'Owerri', 'Onitsha', 'Kaduna']),
    ES: c('Spain', 'europe', 4, 0.12, EUROPE_PATH, { 'spanish': 86, 'west-african-francophone': 7, 'hispanic-latino': 7 },
      ['Madrid', 'Barcelona', 'Valencia', 'Málaga', 'Bilbao', 'Zaragoza', 'Seville', 'Vitoria-Gasteiz', 'Badalona', 'Gran Canaria']),
    LT: c('Lithuania', 'europe', 4, 0.1, EUROPE_PATH, { 'lithuanian': 100 },
      ['Vilnius', 'Kaunas', 'Klaipėda', 'Šiauliai', 'Panevėžys', 'Alytus', 'Marijampolė', 'Utena']),
    LV: c('Latvia', 'europe', 3, 0.15, EUROPE_PATH, { 'latvian': 100 },
      ['Riga', 'Daugavpils', 'Liepāja', 'Jelgava', 'Jūrmala', 'Ventspils', 'Valmiera']),
    SI: c('Slovenia', 'europe', 3, 0.08, EUROPE_PATH, { 'slovenian': 88, 'south-slavic': 12 },
      ['Ljubljana', 'Maribor', 'Celje', 'Kranj', 'Koper', 'Novo Mesto', 'Velenje']),
    HR: c('Croatia', 'europe', 3, 0.1, EUROPE_PATH, { 'croatian': 100 },
      ['Zagreb', 'Split', 'Rijeka', 'Osijek', 'Zadar', 'Šibenik', 'Dubrovnik', 'Pula']),
    TR: c('Türkiye', 'europe', 3, 0.1, EUROPE_PATH, { 'turkish': 100 },
      ['Istanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Eskişehir', 'Mersin', 'Konya']),
    GR: c('Greece', 'europe', 3, 0.1, EUROPE_PATH, { 'greek': 88, 'nigerian': 12 },
      ['Athens', 'Thessaloniki', 'Piraeus', 'Patras', 'Heraklion', 'Larissa', 'Volos']),
    CM: c('Cameroon', 'africa', 4, 0.55, AFRICA_PATH, { 'central-african': 100 },
      ['Yaoundé', 'Douala', 'Bafoussam', 'Garoua', 'Bamenda', 'Limbe', 'Kribi']),
    DO: c('Dominican Republic', 'latin-america', 3, 0.5, LATAM_PATH, { 'hispanic-latino': 100 },
      ['Santo Domingo', 'Santiago de los Caballeros', 'La Romana', 'San Pedro de Macorís', 'Puerto Plata', 'San Cristóbal']),
    BS: c('Bahamas', 'latin-america', 3, 0.85, LATAM_PATH, { 'caribbean-anglo': 100 },
      ['Nassau', 'Freeport', 'Marsh Harbour', 'West End', 'Andros Town']),
    BR: c('Brazil', 'latin-america', 3, 0.15, LATAM_PATH, { 'brazilian': 100 },
      ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Belo Horizonte', 'Franca', 'Fortaleza', 'Curitiba', 'Salvador', 'Recife']),
    GB: c('United Kingdom', 'europe', 3, 0.5, EUROPE_PATH, { 'anglo': 55, 'nigerian': 15, 'caribbean-anglo': 15, 'east-african': 5, 'south-slavic': 5, 'arab': 5 },
      ['London', 'Manchester', 'Birmingham', 'Leeds', 'Sheffield', 'Glasgow', 'Bristol', 'Leicester', 'Newcastle upon Tyne', 'Cardiff']),

    AR: c('Argentina', 'latin-america', 1.5, 0.1, LATAM_PATH, { 'argentine': 100 },
      ['Buenos Aires', 'Córdoba', 'Rosario', 'Bahía Blanca', 'Mar del Plata', 'Santa Fe', 'Mendoza']),
    IT: c('Italy', 'europe', 1.5, 0.15, EUROPE_PATH, { 'italian': 82, 'west-african-francophone': 8, 'nigerian': 10 },
      ['Rome', 'Milan', 'Bologna', 'Treviso', 'Venice', 'Naples', 'Turin', 'Pesaro', 'Varese', 'Sassari']),
    FI: c('Finland', 'europe', 1.5, 0.35, EUROPE_PATH, { 'finnish': 85, 'east-african': 15 },
      ['Helsinki', 'Espoo', 'Tampere', 'Turku', 'Oulu', 'Vantaa', 'Jyväskylä']),
    SE: c('Sweden', 'europe', 1, 0.3, EUROPE_PATH, { 'swedish': 70, 'east-african': 15, 'south-slavic': 10, 'arab': 5 },
      ['Stockholm', 'Gothenburg', 'Malmö', 'Uppsala', 'Södertälje', 'Norrköping', 'Borås']),
    BE: c('Belgium', 'europe', 1, 0.2, EUROPE_PATH, { 'belgian': 70, 'central-african': 22, 'maghrebi': 8 },
      ['Brussels', 'Antwerp', 'Ghent', 'Liège', 'Charleroi', 'Ostend', 'Mechelen']),
    CH: c('Switzerland', 'europe', 1.5, 0.2, EUROPE_PATH, { 'swiss': 55, 'west-african-francophone': 15, 'central-african': 12, 'south-slavic': 18 },
      ['Geneva', 'Zürich', 'Lausanne', 'Fribourg', 'Basel', 'Lugano', 'Bern']),
    AT: c('Austria', 'europe', 1.5, 0.2, EUROPE_PATH, { 'german': 70, 'south-slavic': 20, 'turkish': 10 },
      ['Vienna', 'Graz', 'Linz', 'Salzburg', 'Innsbruck', 'Klagenfurt']),
    ME: c('Montenegro', 'europe', 1.5, 0.08, EUROPE_PATH, { 'serbian': 100 },
      ['Podgorica', 'Nikšić', 'Bar', 'Herceg Novi', 'Budva', 'Pljevlja']),
    BA: c('Bosnia and Herzegovina', 'europe', 1.5, 0.12, EUROPE_PATH, { 'bosnian': 70, 'croatian': 15, 'serbian': 15 },
      ['Sarajevo', 'Banja Luka', 'Tuzla', 'Mostar', 'Zenica', 'Bijeljina']),
    GE: c('Georgia', 'europe', 1, 0.1, EUROPE_PATH, { 'georgian': 100 },
      ['Tbilisi', 'Batumi', 'Kutaisi', 'Rustavi', 'Zugdidi']),
    SN: c('Senegal', 'africa', 1.5, 0.45, AFRICA_PATH, { 'west-african-francophone': 100 },
      ['Dakar', 'Thiès', 'Saint-Louis', 'Kaolack', 'Ziguinchor', 'Rufisque']),
    SS: c('South Sudan', 'africa', 1.5, 0.65, AFRICA_PATH, { 'east-african': 100 },
      ['Juba', 'Wau', 'Malakal', 'Bor', 'Yei', 'Rumbek']),
    CD: c('DR Congo', 'africa', 1.5, 0.5, AFRICA_PATH, { 'central-african': 100 },
      ['Kinshasa', 'Lubumbashi', 'Kisangani', 'Mbuji-Mayi', 'Goma', 'Bukavu']),
    AO: c('Angola', 'africa', 1, 0.4, AFRICA_PATH, { 'angolan': 100 },
      ['Luanda', 'Huambo', 'Lobito', 'Benguela', 'Lubango', 'Cabinda']),
    JP: c('Japan', 'asia', 1.5, 0.4, ASIA_PATH, { 'japanese': 88, 'nigerian': 6, 'west-african-francophone': 6 },
      ['Tokyo', 'Osaka', 'Yokohama', 'Nagoya', 'Sapporo', 'Fukuoka', 'Kobe', 'Toyama', 'Sendai']),
    CN: c('China', 'asia', 1, 0.1, ASIA_PATH, { 'chinese': 100 },
      ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen', 'Shenyang', 'Qingdao', 'Dongguan', 'Nanjing']),
    PH: c('Philippines', 'asia', 1, 0.35, ASIA_PATH, { 'filipino': 100 },
      ['Manila', 'Quezon City', 'Cebu City', 'Davao City', 'Pasig', 'Bacolod']),
    IL: c('Israel', 'asia', 1.5, 0.25, EUROPE_PATH, { 'israeli': 100 },
      ['Tel Aviv', 'Jerusalem', 'Haifa', 'Holon', 'Rishon LeZion', 'Netanya', 'Be’er Sheva']),
    NZ: c('New Zealand', 'oceania', 1.5, 0.5, OCEANIA_PATH, { 'anglo': 55, 'maori-pasifika': 45 },
      ['Auckland', 'Wellington', 'Christchurch', 'Hamilton', 'Tauranga', 'Dunedin']),
    MX: c('Mexico', 'latin-america', 1, 0.35, LATAM_PATH, { 'hispanic-latino': 100 },
      ['Mexico City', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'Chihuahua', 'Hermosillo']),
    PR: c('Puerto Rico', 'latin-america', 1, 0.6, LATAM_PATH, { 'hispanic-latino': 100 },
      ['San Juan', 'Bayamón', 'Carolina', 'Ponce', 'Caguas', 'Mayagüez']),
    JM: c('Jamaica', 'latin-america', 1, 0.75, LATAM_PATH, { 'caribbean-anglo': 100 },
      ['Kingston', 'Montego Bay', 'Spanish Town', 'Portmore', 'Mandeville']),
    UA: c('Ukraine', 'europe', 0.8, 0.15, EUROPE_PATH, { 'ukrainian': 100 },
      ['Kyiv', 'Kharkiv', 'Dnipro', 'Odesa', 'Lviv', 'Zaporizhzhia']),
    PL: c('Poland', 'europe', 0.8, 0.15, EUROPE_PATH, { 'polish': 100 },
      ['Warsaw', 'Kraków', 'Wrocław', 'Gdańsk', 'Poznań', 'Łódź', 'Szczecin']),
    CZ: c('Czechia', 'europe', 0.8, 0.15, EUROPE_PATH, { 'czech': 100 },
      ['Prague', 'Brno', 'Ostrava', 'Plzeň', 'Pardubice', 'Nymburk'])
  };

  Object.keys(COUNTRIES).forEach(function (k) { Object.freeze(COUNTRIES[k]); });

  function country(code) { return COUNTRIES[code] || null; }
  function countryName(code) { return COUNTRIES[code] ? COUNTRIES[code].name : (code || '—'); }
  function isValidCode(code) { return Object.prototype.hasOwnProperty.call(COUNTRIES, code); }

  // "City|State" -> { city, region }
  function parseCity(entry) {
    var parts = String(entry).split('|');
    return { city: parts[0], region: parts[1] || null };
  }

  function cityList(code) {
    var c2 = COUNTRIES[code];
    return c2 ? c2.cities.map(parseCity) : [];
  }

  return {
    LEAGUE_MIX: LEAGUE_MIX,
    REGIONS: REGIONS,
    PATHWAYS: PATHWAYS,
    ENTRY_AGES: ENTRY_AGES,
    CLUB_HUBS: CLUB_HUBS,
    COUNTRIES: COUNTRIES,
    country: country,
    countryName: countryName,
    isValidCode: isValidCode,
    cityList: cityList,
    parseCity: parseCity
  };
});
