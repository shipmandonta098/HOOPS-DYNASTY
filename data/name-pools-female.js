/* ==========================================================================
   HOOPS DYNASTY — women's names for each naming background
   Paired with data/name-pools.js (same background ids).

   first          women's given names
   lastFemale     for traditions whose surnames change for women, the
                  female form of each surname in the SAME ORDER as the
                  background's `last` list (Kowalski -> Kowalska,
                  Novák -> Nováková, Papadopoulos -> Papadopoulou,
                  Kazlauskas -> Kazlauskaitė, Bērziņš -> Bērziņa).
                  Traditions not listed keep the same surname.

   BLOCKED_NAMES  real professional women's players' names that must never
                  be generated.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HDNamePoolsFemale = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function w(s) { return s.trim().split(/\s+/).map(function (x) { return x.replace(/_/g, ' '); }); }

  var EN = w('Emily Sarah Jessica Ashley Megan Lauren Hannah Rachel Samantha Taylor Morgan Kelsey Brooke Madison Kayla ' +
    'Allison Haley Abigail Olivia Emma Grace Natalie Paige Courtney Chloe Avery Riley Jordan Mackenzie Sydney Lindsey ' +
    'Caroline Erin Katie Molly Shannon Jenna Kendall Sierra Jillian Brianna Cassidy');

  var FIRST = {
    'african-american': w('Aaliyah Jasmine Imani Destiny Ebony Kiara Tiana Jada Aniyah Nia Keisha Tamika Shanice Brianna ' +
      'Jordyn Kennedy Taylor Morgan Jalisa Monique Raven Tierra Zaria Amari Kayla Asia Diamond Essence Janae Dominique ' +
      'Chanel Simone Danielle Alexis Gabrielle Jazmine Kamiyah Laila Makayla Naomi Precious Sanaa Tasia Yasmin Zoey'),
    'european-american': EN,
    'hispanic-latino': w('María Sofía Valentina Camila Isabella Lucía Gabriela Daniela Mariana Ana Natalia Paola Andrea ' +
      'Alejandra Victoria Ximena Fernanda Adriana Carolina Elena Luisa Paulina Renata Itzel Guadalupe Marisol Yesenia'),
    'asian-american': EN.slice(0, 30).concat(w('Mei Jin Hana Yuna Mina Kaitlyn Lily Grace')),
    'nigerian': w('Chiamaka Adaeze Ngozi Ifeoma Chinonso Amarachi Oluwaseun Funmilayo Folake Temitope Adaora Nkechi ' +
      'Chidinma Uchechi Ebere Kelechi Yetunde Abimbola Morenike Ifeoluwa Ogechi Tolulope Ezinne Onyinye'),
    'caribbean-anglo': w('Shanique Kimoya Tanisha Alicia Shanelle Kerry-Ann Natalie Danielle Tamara Monique Shantel ' +
      'Rochelle Sherika Kadian Tiffany Ashley Sasha Elaine Simone Janelle Keisha Marsha'),
    'west-african-francophone': w('Aminata Fatou Mariama Awa Aïssatou Khadija Fatoumata Ndeye Astou Coumba Rokhaya ' +
      'Mame Binta Seynabou Aïda Oumou Kadiatou Ramatoulaye Adama Sokhna'),
    'central-african': w('Christelle Grâce Esther Divine Ruth Merveille Patience Gloria Sandrine Nadège Laetitia ' +
      'Prisca Ornella Bénédicte Joëlle Chancelle Diane Flore Josiane Marlène'),
    'east-african': w('Nyakim Achol Aluel Ayen Abuk Nyandeng Adut Akuol Nyibol Ajok Atong Akech Nyanchiew Awut Yar Ajak'),
    'arab': w('Layla Mariam Noor Yasmin Rania Lina Dana Hala Salma Reem Nour Aya Farah Sara Huda Amira Leen Jana Zeina'),
    'anglo': w('Olivia Amelia Isla Ava Emily Sophie Grace Lily Ella Charlotte Chloe Jessica Hannah Lucy Holly ' +
      'Georgia Freya Phoebe Megan Eleanor Zara Isabel'),
    'french-canadian': w('Camille Léa Gabrielle Florence Rosalie Juliette Laurence Noémie Mégane Audrey Catherine ' +
      'Marie-Pier Ève Sarah-Maude Justine Émilie Valérie Mélanie'),
    'chinese': w('Li Na Mei Xin Yu Jing Hui Fang Yan Ting Lan Qing Xiao Wen Ying Rui Jia Yue Hong Lin Yun'),
    'french': w('Manon Léa Chloé Camille Inès Jade Lina Emma Clara Juliette Sarah Marine Pauline Anaïs Océane ' +
      'Mathilde Romane Margaux Élodie Alix'),
    'maghrebi': w('Yasmine Inès Sarah Lina Nour Amira Imane Leïla Samira Nadia Kenza Rania Myriam Salma Hanane Soraya Malak'),
    'caribbean-french': w('Ketty Laura Johanna Cindy Mélissa Sandra Gaëlle Nadège Kelly Marie-Laure Cynthia Laurie Rose Océane'),
    'greek': w('Maria Eleni Katerina Georgia Dimitra Sofia Ioanna Vasiliki Anastasia Christina Despina Evangelia ' +
      'Konstantina Panagiota Athina Angeliki Fotini Paraskevi'),
    'maori-pasifika': w('Aroha Mere Ana Kiri Hine Moana Leilani Malia Sina Talia Tiare Ngaio Tui Losa Mele Ariana'),
    'italian': w('Giulia Chiara Francesca Sara Martina Alessia Federica Valentina Elisa Giorgia Silvia Beatrice ' +
      'Alice Laura Cecilia Matilde Ilaria Ludovica Arianna'),
    'german': w('Lena Laura Anna Lea Hannah Sophie Johanna Marie Lisa Julia Leonie Clara Luisa Charlotte Emma Nele Greta Svenja'),
    'turkish': w('Zeynep Elif Ayşe Merve Büşra Ecem Esra Selin Defne Gizem Damla Özge Tuğba Melis Irem Cansu Ebru Nazlı'),
    'serbian': w('Jelena Milica Ana Marija Jovana Teodora Sara Ivana Kristina Nevena Katarina Dragana Tamara ' +
      'Snežana Sofija Milena Aleksandra Nataša'),
    'croatian': w('Ana Lucija Ivana Petra Marija Lana Ema Nika Tea Antonija Iva Mia Katarina Martina Josipa Matea Dora'),
    'bosnian': w('Amina Lejla Ajla Selma Emina Aida Merima Belma Dženana Sara Adna Nejra Hana Lamija Melisa Ena'),
    'slovenian': w('Nika Eva Ana Maja Teja Tina Špela Urška Nina Lara Sara Zala Tjaša Neža Katja Pia Živa'),
    'lithuanian': w('Gabija Austėja Ugnė Emilija Kamilė Justina Rūta Eglė Indrė Gintarė Lina Aistė Monika Ieva Agnė Vaida'),
    'latvian': w('Anna Elīza Laura Marta Elza Sandra Ieva Kristīne Līga Dace Santa Aiga Zane Agnese Una Evija'),
    'spanish': w('Lucía Laura Marta Paula Alba Sara Andrea Carla Nerea Irene Claudia Elena Cristina Raquel ' +
      'Alicia Leticia Silvia Natalia Ainhoa'),
    'brazilian': w('Ana Beatriz Júlia Mariana Larissa Gabriela Fernanda Camila Letícia Bruna Isabela Thaís ' +
      'Vitória Raíssa Luana Débora Tainá Érika Damiris'),
    'argentine': w('Sofía Martina Florencia Agustina Camila Valentina Lucía Micaela Milagros Rocío Julieta ' +
      'Antonella Belén Delfina Candela Ludmila Macarena'),
    'finnish': w('Aino Emma Venla Ella Siiri Iida Helmi Aada Sanni Noora Laura Elina Minna Riikka Tiia Jenni Henna'),
    'swedish': w('Elsa Alice Maja Ebba Wilma Ella Saga Klara Freja Linnea Moa Agnes Ida Hanna Frida Matilda Elin'),
    'belgian': w('Emma Louise Marie Elise Lotte Julie Noor Lien Femke Hanne Laura Justine Ann Kim Sofie Charlotte Ine'),
    'swiss': w('Mia Lena Lea Elena Alina Nina Anna Laura Lara Sara Noemi Chiara Céline Jana Selina Andrina'),
    'georgian': w('Nino Mariam Ana Tamar Salome Elene Natia Teona Mariami Ketevan Eka Khatia Sopio Tinatin Nana'),
    'angolan': w('Ana Maria Joana Luísa Teresa Esperança Isabel Fátima Domingas Albertina Nádia Sónia Ngueve Felícia'),
    'japanese': w('Yuki Sakura Hina Yui Aoi Haruka Miyu Nanami Rin Saki Mio Kana Ayaka Misaki Moeka Rui Asami Nako Maki'),
    'filipino': w('Maria Angela Kristine Patricia Jasmine Andrea Nicole Camille Bea Mikaela Janine Danica Trisha Jessa Afril'),
    'israeli': w('Noa Maya Tamar Shira Yael Michal Noga Roni Hila Adi Lior Neta Shani Avital Dana Hadar'),
    'ukrainian': w('Olena Iryna Kateryna Anastasiia Yuliia Oksana Natalia Tetiana Viktoriia Mariia Alina Daryna Sofiia Khrystyna'),
    'polish': w('Julia Zuzanna Maja Natalia Aleksandra Weronika Martyna Agnieszka Katarzyna Magdalena Joanna Karolina Paulina Ewelina'),
    'czech': w('Tereza Eliška Anna Kateřina Lucie Veronika Barbora Klára Adéla Kristýna Petra Michaela Markéta Zuzana')
  };

  // Female surname forms (same order as name-pools.js `last`)
  var LAST_FEMALE = {
    'polish': w('Kowalska Nowak Wiśniewska Wójcik Kamińska Lewandowska Zielińska Szymańska Woźniak Dąbrowska Kozłowska ' +
      'Mazur Krawczyk Piotrowska Grabowska'),
    'czech': w('Nováková Svobodová Novotná Dvořáková Černá Procházková Kučerová Veselá Horáková Němcová Pokorná Marková ' +
      'Pospíšilová Hájková Jelínková'),
    'greek': w('Papadopoulou Georgiou Dimitriou Nikolaidou Konstantinou Papadaki Vlachou Karagianni Athanasiou Pappa ' +
      'Oikonomou Christodoulou Antoniou Ioannidou Makri Petridou Stavropoulou Kyriakou Alexiou Tsakalidou Galani Michailidou'),
    'lithuanian': w('Kazlauskaitė Petrauskaitė Vaitkutė Jankauskaitė Stankevičiūtė Žukauskaitė Butkutė Paulauskaitė ' +
      'Urbonaitė Kavaliauskaitė Navickaitė Ramanauskaitė Savickaitė Žilinskaitė Mockutė Lukoševičiūtė Bernotaitė Kairytė ' +
      'Gudaitytė Juškevičiūtė Venckutė Tamulytė Rimkutė'),
    'latvian': w('Bērziņa Kalniņa Ozoliņa Liepiņa Krūmiņa Zariņa Kļaviņa Jansone Vītola Šmite Lāce Zvirbule Grīnberga Pētersone')
  };

  // Real professional women's players (never generated)
  var BLOCKED_NAMES = [
    'Diana Taurasi', 'Sue Bird', 'Candace Parker', 'Maya Moore', 'Breanna Stewart', "A'ja Wilson", 'Caitlin Clark',
    'Sabrina Ionescu', 'Lisa Leslie', 'Sheryl Swoopes', 'Lauren Jackson', 'Tamika Catchings', 'Angel Reese',
    'Paige Bueckers', 'Brittney Griner', 'Elena Delle Donne', 'Nneka Ogwumike', 'Chiney Ogwumike', 'Kelsey Plum',
    'Jewell Loyd', 'Arike Ogunbowale', 'Napheesa Collier', 'Skylar Diggins', 'Jonquel Jones', 'Alyssa Thomas',
    'Courtney Vandersloot', 'Kahleah Copper', 'Aliyah Boston', 'Cameron Brink', 'Kelsey Mitchell', 'Chelsea Gray',
    'Lindsay Whalen', 'Seimone Augustus', 'Cynthia Cooper', 'Tina Thompson', 'Becky Hammon', 'Teresa Weatherspoon',
    'Dawn Staley', 'Rebecca Lobo', 'Ticha Penicheiro', 'Yolanda Griffith', 'Katie Smith', 'Swin Cash',
    'Sylvia Fowles', 'Kayla McBride', 'DeWanna Bonner', 'Satou Sabally', 'Rhyne Howard', 'JuJu Watkins',
    'Kiki Iriafen', 'Natasha Howard', 'Erica Wheeler', 'Ezi Magbegor', 'Emma Meesseman', 'Julie Allemand',
    'Marine Johannès', 'Gabby Williams', 'Kia Nurse', 'Bridget Carleton', 'Natalie Achonwa', 'Han Xu', 'Li Meng',
    'Kamilla Cardoso', 'Damiris Dantas', 'Erica de Souza', 'Astou Ndour', 'Alba Torrens', 'Laia Palau',
    'Lauren Betts', 'Hailey Van Lith', 'Olivia Miles', 'Azzi Fudd', 'Sarah Strong', 'Hannah Hidalgo',
    'Cheryl Miller', 'Nancy Lieberman', 'Ann Meyers', 'Kim Mulkey', 'Teresa Edwards', 'Lynette Woodard'
  ];

  return { FIRST: FIRST, LAST_FEMALE: LAST_FEMALE, BLOCKED_NAMES: BLOCKED_NAMES };
});
