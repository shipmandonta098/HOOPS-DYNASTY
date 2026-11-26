/* ==========================================================================
   HOOPS DYNASTY — cultural naming backgrounds (single source of truth)

   A player's NATIONALITY is chosen first (data/nationalities.js); each
   country then lists the naming backgrounds found among its players
   (immigrant families, multicultural families...). A background here is a
   naming tradition, not an ethnicity, and never implies appearance.

   Background fields
     first, last     name pools (underscore = space, e.g. "Van_den")
     origin          countries this tradition comes from (used for plausible
                     dual nationality / birthplace); empty = none
     compound        { rate, join }   two surnames ("García López")
     particles       { rate, values } surname prefixes ("dos", "Van")
     suffix          { rate, values } generational suffixes ("Jr.")
     order           'surname-first' for traditions written family name
                     first (display only; data keeps given/family fields)

   BLOCKED_NAMES lists real professional players' full names that must
   never be generated (checked case- and accent-insensitively).
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HDNamePools = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function w(s) { return s.trim().split(/\s+/).map(function (x) { return x.replace(/_/g, ' '); }); }

  var EN_FIRST = w('James Michael David Daniel Christopher Matthew Andrew Joshua Ryan Tyler Brandon Justin Kevin Jason Eric ' +
    'Anthony Nicholas Jacob Ethan Logan Connor Austin Cole Blake Grant Chase Trent Brett Derek Kyle Sean Patrick Shane ' +
    'Luke Jake Zach Max Owen Liam Noah Caleb Garrett Colby Reid Hunter Wyatt Bryce Carson Drew Mason Parker Brady Tanner Nolan');

  var B = {
    'african-american': {
      label: 'African American', origin: [],
      first: w('Jamal Malik Darius DeShawn Tyrese Marcus Isaiah Jalen Terrell Andre Darnell Jerome Cedric Marquis Rashad ' +
        'Kendrick Dante Antoine Lamar Tremaine Devonte Javon Keon Kameron Jaylen Trevon Darian Kobe Jordan Cameron Elijah ' +
        'Xavier Quentin Damon Reggie Maurice Desmond Terrence Dwayne Corey Brandon Derrick Lorenzo Damian Trey Zion Amari ' +
        'Jabari Khalil Rasheed Kareem Ahmad Tariq Quincy Demetrius Cornelius Alonzo Otis Booker Langston Jaxon Kendall Bryson ' +
        'Kyrell Ja\'Quan DaQuan Jahmir Taj Omari Nasir Kenyon Treveon Dorian Montez Sincere Messiah Josiah Aaron Christian'),
      last: w('Washington Jefferson Jackson Johnson Williams Robinson Harris Thompson Coleman Brooks Jenkins Bryant Gaines ' +
        'Simmons Hayes Freeman Bell Banks Holloway Whitfield Cunningham Toussaint Pettiford Dawkins Battle Mobley Gillespie ' +
        'Lattimore Merriweather Strickland Boykins Ellerbe Fulton McCray Pruitt Spivey Mayweather Booker Rollins ' +
        'Dandridge Kearse Ransom Bivens Odom Lyles Moultrie Gadson Fair Wingate Peoples Burrell Leaks Grier Hairston Sledge ' +
        'Nesbitt Outlaw Staton Sharpe Barksdale Haywood Exum Tolbert Wimbush McNair Witherspoon Ruffin Faison Pinckney Cheatham ' +
        'Daye Chaney Augustine Calloway Mitchell Sanders Greene Daniels Graves Pryor Lockett'),
      suffix: { rate: 0.07, values: ['Jr.', 'II', 'III'] }
    },
    'european-american': {
      label: 'European American', origin: [],
      first: EN_FIRST,
      last: w('Sullivan Murphy Kowalski Schneider Lindqvist Petersen Brennan Callahan Gallagher Kessler Hartman Albrecht ' +
        'Novak Lombardi Russo Esposito Marchetti Donnelly Fitzgerald Riordan Halvorsen Olson Erickson Larson Becker Koenig ' +
        'Weber Hoffmann Zimmerman Fischer Dempsey Doyle Keane McGuire Walsh Byrne Kowal Mazur Wozniak Dvorak Cerny Horvath ' +
        'Kovach Petrakis Stavros Caruso Rinaldi DeLuca Bianco Ferraro Sorensen Nygaard Thorsen Ackerman Brandt Lowery Keller ' +
        'Whitaker Pemberton Ashby Holt Prescott Langley Merritt Ellison Fairbanks Kincaid Radford Winslow Sheffield Hawthorne'),
      suffix: { rate: 0.04, values: ['Jr.', 'II', 'III'] }
    },
    'hispanic-latino': {
      label: 'Hispanic & Latino', origin: ['MX', 'DO', 'PR'],
      first: w('José Luis Carlos Miguel Juan Alejandro Javier Diego Andrés Mateo Santiago Rafael Ángel Gabriel Adrián Héctor ' +
        'Emilio Joaquín Julián Nicolás Ricardo Fernando Eduardo Esteban Manuel Raúl Ramón Iván Óscar Pedro Felipe Tomás Víctor ' +
        'Christian Anthony Kevin Jonathan Brandon Isaac Elías Marco Ezequiel Yandel Joel Frankie Richie Neftalí Jean_Carlos'),
      last: w('García Rodríguez Martínez Hernández López González Pérez Sánchez Ramírez Torres Flores Rivera Gómez Díaz Cruz ' +
        'Morales Reyes Gutiérrez Ortiz Castillo Jiménez Vargas Romero Herrera Medina Aguilar Vega Castro Mendoza Ruiz Álvarez ' +
        'Delgado Peña Rosario Batista Almonte Feliz Santana Montás Colón Figueroa Quiñones Ocasio Báez Vázquez Pagán Marrero ' +
        'Carrasquillo Arroyo Benítez Cabrera Espinal Guerrero Nuñez Polanco Tejada Valdez Zapata'),
      compound: { rate: 0.12, join: ' ' }
    },
    'asian-american': {
      label: 'Asian American', origin: ['JP', 'CN', 'PH'],
      first: EN_FIRST.slice(0, 40).concat(w('Kenji Daniel Kai Jin Ryo Minh Hiro Tae Sung Wei')),
      last: w('Nakamura Tanaka Yamada Matsumoto Fujimoto Okada Takeda Mori Chen Wang Li Lin Huang Wu Liu Zhang Kim Park Lee ' +
        'Choi Jung Kang Nguyen Tran Pham Le Vu Hoang Santos Reyes Bautista Villanueva Aquino Mendoza Patel Shah Singh')
    },
    'nigerian': {
      label: 'Nigerian', origin: ['NG'],
      first: w('Chinedu Emeka Obinna Chukwuemeka Ikenna Uchenna Nnamdi Chidi Kelechi Ebuka Tochukwu Somto Chibuzor Olumide ' +
        'Oluwaseun Ayodeji Babatunde Adebayo Tunde Femi Kayode Segun Damilola Olamide Kehinde Taiwo Emmanuel Samuel Daniel ' +
        'Victor Michael Godwin Precious Favour Ifeanyi Osinachi Chiamaka Ugochukwu Onyeka Nonso Jide Wale Dapo Biodun Musa ' +
        'Ibrahim Abubakar Usman Sadiq'),
      last: w('Adeyemi Okonkwo Eze Nwosu Okeke Obi Nwankwo Chukwu Okafor Onyeka Ogunleye Adebayo Afolabi Balogun Bello ' +
        'Oyelaran Adeniyi Akinwale Ogunbiyi Oladipo Ojo Olatunji Okoro Uzoma Ibekwe Anyanwu Ezeh Nnadi Odum Okpara Ugwu ' +
        'Agu Achebe Iheanacho Mbah Ndukwe Nwachukwu Oduya Ofor Onuoha Osuji Ugochukwu Umeh Yusuf Abdullahi Danjuma ' +
        'Adewale Fashola Oyedeji Alabi Ajayi Akande Lawal')
    },
    'caribbean-anglo': {
      label: 'Anglo-Caribbean', origin: ['JM', 'BS'],
      first: w('Deandre Kemar Shavar Rohan Kirk Andre Tavares Darrion Leon Kemoy Romario Tajay Akeem Jermaine Omar ' +
        'Dwight Clive Garfield Devon Marlon Ricardo Shamar Travis Kirkland Nathaniel Craig Sheldon Tyrone Valentino Jamar'),
      last: w('Rolle Knowles Ferguson Pinder Bethel Cartwright Munroe Sweeting Saunders Moss Gibson Johnson Thompson ' +
        'Campbell Brown Clarke Francis Gordon Grant Henry Lewis McKenzie Morgan Powell Reid Richards Robinson Simpson ' +
        'Stewart Taylor Wright Bailey Barrett Blackwood Chambers Dacosta Ebanks Forbes Gayle Hylton Lindo McLean Palmer')
    },
    'west-african-francophone': {
      label: 'West African (Francophone)', origin: ['SN'],
      first: w('Moussa Mamadou Ousmane Ibrahima Cheikh Abdoulaye Amadou Babacar Lamine Modou Pape Seydou Souleymane ' +
        'Boubacar Aliou Mouhamed Assane Djibril Khadim Malick Samba Yacine Idrissa Bakary Sékou Fodé Adama Issa Oumar Alioune'),
      last: w('Diallo Ndiaye Diop Fall Sow Ba Sy Gueye Sarr Faye Thiam Cissé Traoré Koné Camara Touré Keita Sylla Diakité ' +
        'Doumbia Konaté Coulibaly Sissoko Kanté Badji Mendy Diatta Sagna Seck Mbaye Niang Kouyaté Tall Wade Ly')
    },
    'central-african': {
      label: 'Central African', origin: ['CM', 'CD'],
      first: w('Christian Junior Patrick Serge Landry Arnaud Hervé Steve Brice Jean-Pierre Jean-Claude Joël Yannick Rodrigue ' +
        'Franck Cédric Stéphane Ulrich Willy Fabrice Guy Merveille Glody Destin Prince Exaucé Ruben Blaise'),
      last: w('Ngando Mbemba Kalala Tshimanga Mukendi Kabongo Ilunga Kasongo Mbuyi Nzeyimana Mbarga Ndongo ' +
        'Essomba Ondoa Atangana Mvondo Nkoulou Fotso Kamga Tchoupo Ekambi Biyik Owona Ebang Moukoko Bokundu Mbenza Lokwa Banza')
    },
    'east-african': {
      label: 'East African', origin: ['SS'],
      first: w('Deng Garang Majok Ajak Bol Kuol Mawien Akech Chol Makur Atem Dut Manyang Thon Mading Malual Agok Lual ' +
        'Kuany Arop Wol Nyang Riak Mayen Machar Jok Ater Gai Aguer'),
      last: w('Deng Garang Majok Ajak Bol Kuol Mawien Akech Chol Makur Atem Dut Manyang Thon Mading Malual Agok Lual Kuany ' +
        'Arop Wol Nyang Riak Mayen Machar Ayuen Mabior Lueth Nyok Akot Alier Biar'),
      noRepeatSame: true
    },
    'arab': {
      label: 'Arab', origin: [],
      first: w('Omar Karim Yousef Tariq Hassan Khalid Samir Rami Ziad Nabil Amir Fadi Bilal Hamza Adnan Jamal Walid Sami'),
      last: w('Haddad Khoury Mansour Nasser Saleh Hamdan Darwish Aziz Qasim Hakim Farah Shaheen Jaber Rahal Sabbagh Zaher')
    },
    'anglo': {
      label: 'English-speaking', origin: [],
      first: w('Jack Oliver Harry George Thomas William Charlie Lachlan Cooper Jai Mitchell Dyson Josh Callum Lewis Jordan ' +
        'Ben Sam Tom Riley Hamish Angus Fergus Rory Declan Finn Archie Toby Brody Kieran Harrison Corey Brodie Lucas Ethan ' +
        'Nathan Aiden Zac Kyle Bailey Jesse Joel Will Matt'),
      last: w('Smith Jones Taylor Brown Wilson Thompson White Walker Harris Martin Clarke Hughes Wood Edwards Morris Kelly ' +
        'Robertson Campbell Stewart Murray Fraser Duncan Macdonald Hamilton Kerr Bennett Fletcher Barnes Hunt Holmes Webster ' +
        'Mills Spencer Lawson Atkinson Gibbons Dawson Cooke Hardy Booth Nicholls Rowe Marshall Gill Reeves Pearce Ashworth')
    },
    'french-canadian': {
      label: 'French Canadian', origin: [],
      first: w('Jean-Philippe Olivier Mathieu Gabriel Félix Samuel Alexandre Maxime Étienne Antoine Guillaume Simon Vincent ' +
        'Nicolas Raphaël Thomas Benoît Luc Marc-André Jérémie Zacharie'),
      last: w('Tremblay Gagnon Roy Côté Bouchard Gauthier Morin Lavoie Fortin Gagné Ouellet Pelletier Bélanger Lévesque ' +
        'Bergeron Leblanc Paquette Girard Simard Boucher Caron Beaulieu Cloutier Dubé Poirier')
    },
    'chinese': {
      label: 'Chinese', origin: ['CN'], order: 'surname-first',
      first: w('Wei Hao Jun Lei Tao Bo Peng Chen Yang Hui Kai Long Jie Ming Rui Xin Feng Qiang Zhen Hongyu Zhihao Jiahao ' +
        'Yuxuan Haoran Zihan Tianyu Junjie Mingze Shuai Yifan'),
      last: w('Wang Li Zhang Liu Chen Yang Zhao Huang Zhou Wu Xu Sun Hu Zhu Gao Lin He Guo Ma Luo Liang Song Zheng Xie Han Tang Feng Deng Cao')
    },
    'french': {
      label: 'French', origin: [],
      first: w('Mathis Antoine Enzo Lucas Hugo Théo Louis Nathan Maxime Baptiste Clément Thomas Alexandre Quentin Romain ' +
        'Julien Adrien Paul Victor Arthur Gabin Jules Raphaël Léo Tom Valentin Corentin Yohan Killian Mathéo Florian Bastien'),
      last: w('Laurent Moreau Dubois Martin Bernard Petit Durand Leroy Lefebvre Girard Bonnet Dupont Lambert Fontaine Rousseau ' +
        'Vincent Muller Faure André Mercier Blanc Guérin Boyer Garnier Chevalier François Legrand Gauthier Perrin Robin Clément ' +
        'Morin Nicolas Henry Roussel Mathieu Gautier Masson Marchand Duval Denis Lemaire Joly Roger Roche Colin Vidal Caron')
    },
    'maghrebi': {
      label: 'North African', origin: [],
      first: w('Karim Yacine Mehdi Sofiane Bilal Nassim Rayan Ilyes Samir Amine Walid Ismaël Adam Anis Riyad Nabil Yanis Zakaria'),
      last: w('Benali Haddad Belkacem Bouzid Mansouri Cherif Kaci Brahimi Hamidi Boukhari Amrani Saadi Rahmani Benyahia Djebbar Ouali Zerrouki')
    },
    'caribbean-french': {
      label: 'French Caribbean', origin: [],
      first: w('Jérémy Kévin Wilfried Steeve Loïc Johan Fabrice Dimitri Ludovic Teddy Rudy Jordan Mickaël Ronny'),
      last: w('Jean-Baptiste Desir Pierre-Louis Marie-Sainte Lubin Valentin Laguerre Celestin Jean-Louis Augustin Florentin Etienne Bellance Toussaint')
    },
    'greek': {
      label: 'Greek', origin: ['GR'],
      first: w('Giorgos Nikos Kostas Dimitris Giannis Panagiotis Vasilis Christos Thanasis Stavros Michalis Alexandros ' +
        'Spyros Lefteris Ioannis Stelios Manolis Andreas Theodoros Konstantinos Antonis Charalampos'),
      last: w('Papadopoulos Georgiou Dimitriou Nikolaidis Konstantinou Papadakis Vlachos Karagiannis Athanasiou Pappas ' +
        'Oikonomou Christodoulou Antoniou Ioannidis Makris Petridis Stavropoulos Kyriakou Alexiou Tsakalidis Galanis Michailidis')
    },
    'maori-pasifika': {
      label: 'Māori & Pasifika', origin: [],
      first: w('Tane Wiremu Rawiri Tama Manaia Nikau Hemi Mikaere Ihaia Kauri Tevita Sione Viliami Losa Malakai Isileli'),
      last: w('Ngata Parata Tamihana Te_Aho Waititi Kereama Paewai Whaanga Rangi Tuilagi Fifita Taufa Faleolo Vainikolo Havili Leota')
    },
    'italian': {
      label: 'Italian', origin: ['IT'],
      first: w('Alessandro Lorenzo Matteo Andrea Francesco Luca Marco Davide Simone Riccardo Federico Tommaso Giovanni ' +
        'Gabriele Stefano Niccolò Pietro Filippo Edoardo Michele Leonardo Mattia Giacomo'),
      last: w('Rossi Bianchi Ferrari Esposito Romano Colombo Ricci Marino Greco Bruno Gallo Conti De_Luca Mancini Costa ' +
        'Giordano Rizzo Lombardi Moretti Barbieri Fontana Santoro Mariani Rinaldi Caruso Ferrara Galli Martini Leone Longo')
    },
    'german': {
      label: 'German', origin: ['DE'],
      first: w('Lukas Jonas Leon Felix Maximilian Paul Niklas Tim Jan Moritz Fabian Florian Julian Tobias Jannik Philipp ' +
        'Malte Johannes Henrik Lennart Till Konstantin Benedikt Kilian Ole Mats Nils Joscha Linus Bennet Elias'),
      last: w('Müller Schmidt Schneider Fischer Weber Meyer Wagner Becker Schulz Hoffmann Koch Bauer Richter Klein Wolf ' +
        'Schröter Neumann Schwarz Zimmermann Braun Krüger Hofmann Hartmann Lange Werner Krause Lehmann Köhler Herrmann ' +
        'König Walter Mayer Huber Kaiser Fuchs Peters Lang Scholz Möller Weiß Jung Hahn Vogel Friedrich Keller Günther')
    },
    'turkish': {
      label: 'Turkish', origin: ['TR'],
      first: w('Emre Burak Mert Can Kerem Arda Yusuf Ömer Efe Oğuz Barış Cem Furkan Serkan Tolga Onur Doğuş Berk Alperen ' +
        'Sinan Ertuğrul Kaan Batuhan Hakan Deniz Selim'),
      last: w('Yılmaz Kaya Demir Şahin Çelik Yıldız Yıldırım Öztürk Aydın Özdemir Arslan Doğan Kılıç Aslan Çetin Kara ' +
        'Koç Kurt Özkan Şimşek Polat Erdem Tekin Ünal Güler Korkmaz Aksoy Bozkurt Turan')
    },
    'serbian': {
      label: 'Serbian & Montenegrin', origin: ['RS'],
      first: w('Nikola Stefan Marko Luka Miloš Nemanja Vladimir Aleksa Uroš Filip Lazar Dušan Đorđe Vuk Strahinja Ognjen ' +
        'Dragan Bogdan Mihajlo Vasilije Petar Dimitrije Andrija Branko Zoran Novak Danilo Jovan Igor Miljan Vukašin'),
      last: w('Petrović Jovanović Stojanović Nikolić Marković Đorđević Popović Stanković Pavlović Milošević Ilić Kostić ' +
        'Radović Simić Lazić Vasić Todorović Mitrović Savić Tomić Obradović Ristić Mladenović Živković Vučković Perović ' +
        'Bulatović Vujošević Raičević Đukanović Šćepanović Vukčević Božović Lalić Stević')
    },
    'croatian': {
      label: 'Croatian', origin: ['HR'],
      first: w('Ivan Luka Marko Josip Ante Mario Matej Filip Karlo Dario Tomislav Krešimir Domagoj Hrvoje Mislav Bruno Roko Toni Vedran Zvonimir'),
      last: w('Horvat Kovačević Babić Marić Jurić Novak Knežević Vuković Matić Petrović Pavlović Grgić Šarić Lovrić ' +
        'Perić Bašić Tomić Barišić Žanić Ćosić Prskalo Mlinar')
    },
    'bosnian': {
      label: 'Bosnian', origin: ['BA'],
      first: w('Amar Adnan Emir Haris Kenan Mirza Tarik Edin Dženan Almir Armin Benjamin Damir Elvir Jasmin Senad Nedim'),
      last: w('Hodžić Hadžić Delić Begić Mehmedović Hasanović Ibrahimović Omerović Kovačević Salihović Husić Muratović Alić Šehić Halilović Kurtović')
    },
    'slovenian': {
      label: 'Slovenian', origin: ['SI'],
      first: w('Luka Jaka Žiga Gašper Matic Rok Jure Klemen Aljaž Blaž Tadej Miha Anže Nejc Urban Žan Domen Tilen'),
      last: w('Novak Horvat Kovačič Krajnc Zupančič Potočnik Kos Vidmar Golob Turk Kralj Zupan Bizjak Hribar Kavčič ' +
        'Rozman Oblak Petek Žagar Kolar Mlakar Pirc Hočevar Zorko')
    },
    'lithuanian': {
      label: 'Lithuanian', origin: ['LT'],
      first: w('Mantas Rokas Domantas Lukas Matas Jonas Tomas Paulius Mindaugas Arnas Ignas Deividas Edgaras Gytis ' +
        'Justas Karolis Marius Povilas Tadas Vytautas Žygimantas Šarūnas Ąžuolas Dovydas Kęstutis'),
      last: w('Kazlauskas Petrauskas Vaitkus Jankauskas Stankevičius Žukauskas Butkus Paulauskas Urbonas Kavaliauskas ' +
        'Navickas Ramanauskas Savickas Žilinskas Mockus Lukoševičius Bernotas Kairys Gudaitis Juškevičius ' +
        'Venckus Tamulis Rimkus')
    },
    'latvian': {
      label: 'Latvian', origin: ['LV'],
      first: w('Kristaps Dāvis Rihards Artūrs Mārtiņš Roberts Jānis Kārlis Andrejs Edgars Toms Rolands Aigars Kristiāns Ernests Reinis'),
      last: w('Bērziņš Kalniņš Ozoliņš Liepiņš Krūmiņš Zariņš Kļaviņš Jansons Vītols Šmits Lācis Zvirbulis Grīnbergs Pētersons')
    },
    'spanish': {
      label: 'Spanish', origin: [],
      first: w('Pablo Sergio Álvaro Alberto Jaime Rubén Iker Unai Hugo Adrián Marcos Gonzalo Íñigo Xabier Jordi Pau Oriol ' +
        'Guillem Carlos Javier Darío Alejandro Daniel Mario Rodrigo Aitor Nacho Víctor Álex'),
      last: w('García Fernández González Rodríguez López Martínez Sánchez Pérez Gómez Martín Jiménez Ruiz Hernández Díaz ' +
        'Moreno Muñoz Álvarez Romero Alonso Gutiérrez Navarro Torres Domínguez Vázquez Ramos Gil Serrano Blanco Molina ' +
        'Castro Ortega Rubio Marín Sanz Iglesias Garrido Cortés Lozano Prieto Arroyo'),
      compound: { rate: 0.18, join: ' ' }
    },
    'brazilian': {
      label: 'Brazilian', origin: ['BR'],
      first: w('Gabriel Lucas Rafael Matheus Pedro Guilherme Vinícius Thiago Felipe Caio Bruno Leonardo Gustavo Diego ' +
        'Henrique João Murilo Eduardo Renan Igor Douglas Wesley Anderson Marcelo Rodrigo'),
      last: w('Silva Santos Oliveira Souza Lima Pereira Ferreira Costa Rodrigues Almeida Nascimento Araújo Carvalho Gomes ' +
        'Martins Rocha Ribeiro Alves Monteiro Moreira Barbosa Cardoso Teixeira Correia Pinto Moura Cavalcanti Nogueira Freitas'),
      particles: { rate: 0.15, values: ['dos', 'da', 'de'] },
      compound: { rate: 0.15, join: ' ' }
    },
    'argentine': {
      label: 'Argentine', origin: ['AR'],
      first: w('Facundo Nicolás Agustín Juan_Pablo Matías Tomás Franco Lautaro Santiago Joaquín Gonzalo Leandro Patricio Ignacio Federico Bautista'),
      last: w('Fernández Gómez Romero Sosa Álvarez Acosta Benítez Medina Herrera Suárez Aguirre Pereyra Giménez Molina ' +
        'Rossi Ferraro Bianchi Cabrera Peralta Villalba Quiroga Ledesma Ojeda Funes Correa')
    },
    'finnish': {
      label: 'Finnish', origin: ['FI'],
      first: w('Mikko Antti Juha Lauri Elias Onni Aleksi Eetu Joonas Sami Ville Tuomas Olli Niko Petteri Severi Väinö Aatu'),
      last: w('Korhonen Virtanen Mäkinen Nieminen Mäkelä Hämäläinen Laine Heikkinen Koskinen Järvinen Lehtonen Saarinen ' +
        'Salminen Heinonen Niemi Kinnunen Salonen Turunen Lindholm Hirvonen')
    },
    'swedish': {
      label: 'Swedish', origin: [],
      first: w('Erik Oskar Viktor Axel Gustav Filip Hugo Ludvig Anton Isak Elias Albin Emil Simon Oliver Melvin Jonatan'),
      last: w('Andersson Johansson Karlsson Nilsson Eriksson Larsson Olsson Persson Svensson Gustafsson Pettersson ' +
        'Jonsson Lindberg Lindström Lundqvist Bergström Sandberg Forsberg Holm Ekström')
    },
    'belgian': {
      label: 'Belgian', origin: [],
      first: w('Thibaut Wout Arne Jens Kobe Sander Ruben Jarne Pieter Maxime Loïc Quentin Florian Bram Senne Lander Cédric Kevin'),
      last: w('Peeters Janssens Maes Jacobs Mertens Willems Claes Goossens Wouters De_Smet Dubois Lambert Dupont Desmet Lemmens Verhoeven Hermans Coppens Michiels Pauwels'),
      particles: { rate: 0.15, values: ['Van', 'De', 'Van den', 'Vanden'] }
    },
    'swiss': {
      label: 'Swiss', origin: [],
      first: w('Luca Noah Nico Jonas Robin Yannick Dominik Cédric Fabio Gian Andrin Mathias Lionel Joël Kilian Ruben'),
      last: w('Müller Meier Schmid Keller Weber Huber Brunner Baumann Fischer Gerber Frei Moser Zürcher Bianchi Rochat Favre Monnier Bühler Steiner Wyss')
    },
    'georgian': {
      label: 'Georgian', origin: ['GE'],
      first: w('Giorgi Levan Davit Nika Luka Irakli Zurab Lasha Otar Saba Tornike Beka Goga Sandro Vakhtang Archil'),
      last: w('Beridze Kapanadze Gelashvili Maisuradze Giorgadze Tsiklauri Lomidze Kiknadze Nozadze Gogoladze Bakuradze Abashidze Dolidze Khutsishvili Mchedlishvili Japaridze')
    },
    'angolan': {
      label: 'Angolan', origin: ['AO'],
      first: w('Edson João Paulo Manuel António Carlos Domingos Gerson Hélder Mário Nelson Valdelício Yanick Jaime Evandro Délcio'),
      last: w('Lopes Costa Kiala Fernandes Baptista Sebastião Domingos Mendes Gaspar Neto Cardoso Tavares Miguel Morais Correia Bunga')
    },
    'japanese': {
      label: 'Japanese', origin: ['JP'],
      first: w('Kaito Ren Yuto Haruto Sota Riku Hayato Daiki Takumi Kenta Shota Ryota Yuki Kazuki Tatsuya Naoki Kohei ' +
        'Shun Taiga Hiroki Makoto Keisuke Ryusei Sho Tomoya'),
      last: w('Nakamura Takahashi Watanabe Tanaka Suzuki Sato Ito Yamamoto Kobayashi Kato Yoshida Yamada Sasaki Matsumoto ' +
        'Inoue Kimura Hayashi Shimizu Yamaguchi Mori Ikeda Hashimoto Ishikawa Ogawa Okada Fujita Endo Aoki Murakami Nishimura')
    },
    'filipino': {
      label: 'Filipino', origin: ['PH'],
      first: w('Juan Miguel Paolo Carlo Rafael Jericho Kiefer Mark Joshua Christian Marco Gabriel Lorenzo Jerome Ramon Dwight Arvin Japeth Bobby Kai'),
      last: w('Santos Reyes Cruz Bautista Garcia Mendoza Torres Villanueva Ramos Aquino Navarro Castillo Lim Tan Co Sy ' +
        'Fernandez Abueva Rivero Tolentino Pascual Manalo Lacson Sotto'),
      particles: { rate: 0.08, values: ['dela', 'de'] }
    },
    'israeli': {
      label: 'Israeli', origin: [],
      first: w('Yonatan Itay Omri Noam Ariel Eitan Daniel Yuval Guy Tomer Amit Roee Ido Nadav Oren Lior Shahar Gal'),
      last: w('Cohen Levi Mizrahi Peretz Biton Friedman Avraham Katz Azoulay Dahan Shapira Ben-David Goldberg Rosen Hadad Ohayon Malka Segal')
    },
    'ukrainian': {
      label: 'Ukrainian', origin: ['UA'],
      first: w('Oleksandr Andriy Dmytro Mykola Bohdan Vladyslav Maksym Yaroslav Taras Ivan Artem Denys Serhiy Viacheslav'),
      last: w('Shevchenko Kovalenko Bondarenko Tkachenko Kravchenko Oliynyk Shevchuk Polishchuk Lysenko Moroz Marchenko Savchenko Rudenko Bilyk')
    },
    'polish': {
      label: 'Polish', origin: ['PL'],
      first: w('Jakub Kacper Mateusz Michał Łukasz Bartosz Piotr Paweł Tomasz Szymon Wojciech Kamil Adrian Przemysław'),
      last: w('Kowalski Nowak Wiśniewski Wójcik Kamiński Lewandowski Zieliński Szymański Woźniak Dąbrowski Kozłowski Mazur Krawczyk Piotrowski Grabowski')
    },
    'czech': {
      label: 'Czech', origin: ['CZ'],
      first: w('Jakub Tomáš Lukáš Ondřej Vojtěch Matěj Adam Martin Jan Filip Patrik Jiří Štěpán Šimon'),
      last: w('Novák Svoboda Novotný Dvořák Černý Procházka Kučera Veselý Horák Němec Pokorný Marek Pospíšil Hájek Jelínek')
    },
    // Diaspora traditions that span several countries
    'south-slavic': { label: 'South Slavic', origin: ['RS', 'HR', 'BA'], mixOf: ['serbian', 'croatian', 'bosnian'] }
  };

  // Real professional players (current and historical) whose full names must
  // never be produced. Compared without case or accents.
  var BLOCKED_NAMES = [
    'Nikola Jokic', 'Luka Doncic', 'Giannis Antetokounmpo', 'Victor Wembanyama', 'Rudy Gobert', 'Joel Embiid',
    'Pascal Siakam', 'Domantas Sabonis', 'Jonas Valanciunas', 'Kristaps Porzingis', 'Alperen Sengun', 'Jusuf Nurkic',
    'Bogdan Bogdanovic', 'Bojan Bogdanovic', 'Nikola Vucevic', 'Nikola Jovic', 'Vasilije Micic', 'Aleksej Pokusevski',
    'Rui Hachimura', 'Yuta Watanabe', 'Yuki Kawamura', 'Yao Ming', 'Zhou Qi', 'Yi Jianlian', 'Manu Ginobili', 'Luis Scola',
    'Facundo Campazzo', 'Dirk Nowitzki', 'Dennis Schroder', 'Franz Wagner', 'Moritz Wagner', 'Daniel Theis',
    'Isaiah Hartenstein', 'Maxi Kleber', 'Josh Giddey', 'Patty Mills', 'Joe Ingles', 'Dyson Daniels', 'Ben Simmons',
    'Jock Landale', 'Matisse Thybulle', 'Shai Gilgeous-Alexander', 'Jamal Murray', 'RJ Barrett', 'Andrew Wiggins',
    'Dillon Brooks', 'Lu Dort', 'Bennedict Mathurin', 'Kelly Olynyk', 'Zach Edey', 'Dwight Powell', 'Chris Boucher',
    'Tony Parker', 'Nicolas Batum', 'Evan Fournier', 'Frank Ntilikina', 'Killian Hayes', 'Sekou Doumbouya',
    'Alexandre Sarr', 'Zaccharie Risacher', 'Bilal Coulibaly', 'Guerschon Yabusele', 'Rayan Rupert', 'Ousmane Dieng',
    'Hakeem Olajuwon', 'Dikembe Mutombo', 'Serge Ibaka', 'Bismack Biyombo', 'Jonathan Kuminga', 'Christian Koloko',
    'Precious Achiuwa', 'Josh Okogie', 'Chimezie Metu', 'Jordan Nwora', 'Al Horford', 'Karl-Anthony Towns',
    'Deandre Ayton', 'Buddy Hield', 'Eric Gordon', 'Klay Thompson', 'Lauri Markkanen', 'Jonas Jerebko', 'Kevin Durant',
    'LeBron James', 'Stephen Curry', 'Jayson Tatum', 'Jaylen Brown', 'Anthony Davis', 'Devin Booker', 'Kawhi Leonard',
    'Paul George', 'James Harden', 'Kyrie Irving', 'Damian Lillard', 'Donovan Mitchell', 'Trae Young', 'Ja Morant',
    'Zion Williamson', 'Jimmy Butler', 'Bam Adebayo', 'Tyrese Haliburton', 'Tyrese Maxey', 'Jalen Brunson',
    'Jalen Williams', 'Jalen Green', 'Jalen Suggs', 'Jalen Johnson', 'Jalen Duren', 'Jalen Smith', 'Jalen Hood-Schifino',
    'Anthony Edwards', 'Cade Cunningham', 'Paolo Banchero', 'Chet Holmgren', 'Scottie Barnes', 'Evan Mobley',
    'Darius Garland', 'Jarrett Allen', 'De\'Aaron Fox', 'DeMar DeRozan', 'Zach LaVine', 'Brandon Ingram',
    'Julius Randle', 'Mikal Bridges', 'Jaren Jackson Jr.', 'Desmond Bane', 'Marcus Smart', 'Derrick White',
    'Jrue Holiday', 'Khris Middleton', 'Brook Lopez', 'Robin Lopez', 'Myles Turner', 'Aaron Gordon', 'Michael Porter Jr.',
    'Kevin Love', 'Kyle Lowry', 'Fred VanVleet', 'Chris Paul', 'Russell Westbrook', 'Dwyane Wade', 'Kobe Bryant',
    'Michael Jordan', 'Magic Johnson', 'Larry Bird', 'Shaquille O\'Neal', 'Tim Duncan', 'Kevin Garnett', 'Allen Iverson',
    'Tracy McGrady', 'Vince Carter', 'Carmelo Anthony', 'Dwight Howard', 'Chris Bosh', 'Paul Pierce', 'Ray Allen',
    'Jason Kidd', 'Steve Nash', 'Pau Gasol', 'Marc Gasol', 'Ricky Rubio', 'Juancho Hernangomez', 'Willy Hernangomez',
    'Santi Aldama', 'Usman Garuba', 'Rudy Fernandez', 'Sergio Llull', 'Nikola Mirotic', 'Goran Dragic', 'Zoran Dragic',
    'Dario Saric', 'Ivica Zubac', 'Mario Hezonja', 'Dragan Bender', 'Davis Bertans', 'Rodions Kurucs', 'Arturas Karnisovas',
    'Arvydas Sabonis', 'Sarunas Marciulionis', 'Zydrunas Ilgauskas', 'Mindaugas Kuzminskas', 'Deni Avdija', 'Omri Casspi',
    'Jordan Clarkson', 'Kai Sotto', 'Kevin Porter Jr.', 'Kenrich Williams', 'Gabe Vincent', 'Kobe Bufkin',
    'Kyle Kuzma', 'Josh Hart', 'OG Anunoby', 'Nikola Pekovic', 'Nikola Milutinov', 'Marko Simonovic', 'Filip Petrusev',
    'Luka Samanic', 'Vlatko Cancar', 'Matthew Dellavedova', 'Andrew Bogut', 'Thon Maker', 'Wenyen Gabriel',
    'Luol Deng', 'Manute Bol', 'Bol Bol', 'Majok Deng', 'Clint Capela', 'Thabo Sefolosha', 'Jakob Poeltl',
    'Goga Bitadze', 'Zaza Pachulia', 'Sandro Mamukelashvili', 'Furkan Korkmaz', 'Cedi Osman', 'Hedo Turkoglu',
    'Ersan Ilyasova', 'Mehmet Okur', 'Enes Kanter', 'Kostas Antetokounmpo', 'Thanasis Antetokounmpo', 'Alex Antetokounmpo',
    'Tyler Herro', 'Kel\'el Ware', 'Jaime Jaquez Jr.', 'Juan Toscano-Anderson', 'Jose Alvarado', 'Eduardo Najera',
    'Andre Miller', 'Andre Drummond', 'Andre Iguodala', 'Marcus Morris', 'Markieff Morris', 'Isaiah Thomas',
    'Isaiah Stewart', 'Isaiah Jackson', 'Darius Bazley', 'Cameron Johnson', 'Cameron Thomas', 'Jordan Poole',
    'Elijah Harkless', 'Xavier Tillman', 'Kevin Huerter', 'Dante Exum', 'Malik Monk', 'Malik Beasley', 'Jamal Crawford',
    'Terrence Ross', 'Dwayne Bacon', 'Corey Kispert', 'Derrick Rose', 'Lorenzo Brown', 'Damian Jones', 'Amari Bailey',
    'Jabari Smith Jr.', 'Jabari Parker', 'Jabari Walker', 'Khalil Whitney', 'Kareem Abdul-Jabbar', 'Quentin Grimes',
    'Reggie Jackson', 'Reggie Miller', 'Reggie Bullock', 'Maurice Harkless', 'Terrence Shannon Jr.', 'Brandon Miller',
    'Brandon Clarke', 'Christian Braun', 'Christian Wood', 'Aaron Nesmith', 'Aaron Wiggins', 'Bryce McGowens', 'Jaylen Clark',
    'Kendrick Nunn', 'Josiah-Jordan James', 'Omari Spellman', 'Taj Gibson', 'Nasir Little', 'Messiah Jones'
  ];

  return { BACKGROUNDS: B, BLOCKED_NAMES: BLOCKED_NAMES };
});
