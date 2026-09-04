'use strict';

/**
 * nameCultures.js — names that belong to where a player is from.
 *
 * The old generator drew a first name and a surname from two flat pools with
 * no connection to birthplace, so a player born in Bamako was as likely to be
 * called Trey Hayes as Amadou Traoré. Here the order is reversed: a player
 * gets a birthplace first, the birthplace suggests a naming culture, and the
 * name comes from that culture's pools.
 *
 * BIRTHPLACE INFLUENCES, IT DOES NOT DICTATE.
 * Every country maps to a WEIGHTED MIX of cultures, not to one. Immigration,
 * diaspora, mixed families and players raised somewhere other than where they
 * were born are all normal, so a player born in London can be Anglo, Nigerian,
 * Jamaican, South Asian or Polish, and a player born in Paris can be French,
 * Maghrebi, West African or Caribbean. The weights make the common cases
 * common without making the others impossible.
 *
 * NOT A RACE MODEL. `namingOrigin` records which pool a name came from. It is
 * a naming tradition, nothing else: it does not describe a player's
 * appearance, ancestry or identity, and nothing in the game should read it as
 * though it did. Portraits, if they ever exist, need their own variable.
 *
 * Word lists are ordered roughly commonest first and drawn with a Zipf-like
 * bias, so frequent names recur and rare ones stay rare without every entry
 * needing a hand-tuned weight.
 *
 * PLAUSIBLE, NOT PICTURESQUE. Every pool is ordinary common names from the
 * place, ASCII-transliterated for consistency across the UI. Where a pool is
 * thin (indigenousCanadian) it is left thin and weighted low, because a short
 * accurate list is better than a long invented one. Surnames identifiable with
 * one specific real athlete are deliberately absent — the pools should sound
 * like the country, not like people who exist.
 */

const w = (s) => s.trim().split(/\s+/);

/* ===========================================================================
 * NAMING CULTURES
 * ---------------------------------------------------------------------------
 * `first` and `last` are ordered commonest-first. `build` assembles the final
 * string where a culture's structure is not simply "given surname" — Spanish
 * double surnames, Dutch and Portuguese particles, hyphenated French given
 * names, Arabic Al-/Ben- constructions.
 * ======================================================================== */
export const CULTURES = {
  anglo: {
    label: 'Anglo-American',
    first: w(`James Michael William John Ryan Matthew Andrew Jack Luke Cole Brady Cooper
      Tyler Connor Blake Grant Wyatt Hunter Chase Owen Reid Bennett Miles Spencer Carter
      Preston Landon Colton Beckett Graham Hayden Nolan Tanner Trevor Dalton Garrett
      Brooks Sawyer Emmett Weston Harrison Griffin Sullivan Porter Tucker Ellis Rhett`),
    last: w(`Smith Johnson Williams Brown Jones Miller Davis Wilson Anderson Taylor Thomas
      Moore Jackson White Harris Martin Thompson Robinson Clark Walker Hall Allen Young
      King Wright Scott Green Baker Adams Nelson Carter Mitchell Turner Phillips Campbell
      Parker Evans Edwards Collins Stewart Morris Rogers Reed Cook Bell Murphy Bailey
      Cooper Richardson Cox Howard Ward Brooks Sanders Price Bennett Wood Barnes Ross
      Henderson Coleman Jenkins Perry Powell Long Patterson Hughes Foster Simmons`),
  },

  africanAmerican: {
    label: 'African American',
    first: w(`Jalen Marcus Malik Isaiah DeAndre Tyrese Darius Xavier Jamal Terrence Devin
      Amari Kobe Trevon Damari Jaylen Elijah Zion Keon Rashad Donovan Kendrick Antoine
      Terrell Cedric Darnell Lamont Deion Tyrone Jermaine Andre Demetrius Julius Marquis
      Khalil Jabari Kwame Omari Tariq Rasheed Nasir Zaire Amir Caleb Micah Josiah`),
    last: w(`Williams Johnson Jackson Harris Robinson Coleman Brooks Freeman Hayes Bryant
      Ellison Nowell Reeves Wallace Vincent Sharpe Duren Sanders Prosper Whitfield Barnett
      Everett Dunlap Cross Hayward Ashford Rhodes Baldwin Gaines Pryor Stallworth Grayson
      Lyles Booker Rivers Chandler Copeland Fielder Holloway Sinclair Waverly Beckham`),
  },

  usLatino: {
    label: 'US Latino',
    first: w(`Carlos Miguel Diego Andres Mateo Julian Adrian Emiliano Rafael Alejandro
      Gabriel Marco Antonio Javier Ricardo Fernando Sergio Eduardo Cristian Ivan Ramon
      Alonso Hector Esteban Rodrigo Leonel Nestor Salvador Ignacio Bruno`),
    last: w(`Garcia Rodriguez Martinez Hernandez Lopez Gonzalez Perez Sanchez Ramirez
      Torres Flores Rivera Gomez Diaz Reyes Morales Cruz Ortiz Gutierrez Chavez Ramos
      Vargas Castillo Jimenez Mendoza Herrera Medina Aguilar Vega Rojas Salazar Ibarra
      Quintero Vasquez Delgado Cardenas Escobar Montoya Solis Padilla`),
  },

  usAsian: {
    label: 'Asian American',
    first: w(`Kevin Justin Brandon Eric Jason Daniel Steven Nathan Aaron Alan Derek Vincent
      Ronnie Wesley Simon Curtis Marvin Nolan Warren Elliot`),
    last: w(`Nguyen Kim Lee Park Chen Wang Tran Patel Singh Choi Yang Liu Huang Vu Pham
      Shah Rao Cho Sato Reyes Villanueva Bautista Ocampo Mercado`),
  },

  caribbeanAmerican: {
    label: 'Caribbean',
    first: w(`Andre Shawn Kemar Devon Rohan Damion Orville Nikolai Delano Junior Tyrell
      Ricardo Everton Dwayne Shane Romario Akeem Jerome Wendell Clifton`),
    last: w(`Campbell Brown Clarke Reid Bailey Grant Powell Sinclair Bennett McKenzie
      Gordon Foster Nelson Hylton Blake Ellington Beckford Dixon Fraser Chambers Salmon
      Wint Palmer Whyte`),
  },

  frenchEuro: {
    label: 'French',
    first: w(`Lucas Hugo Theo Nathan Louis Antoine Maxime Julien Baptiste Clement Romain
      Guillaume Florian Quentin Adrien Mathis Corentin Bastien Aurelien Sylvain Fabien
      Cedric Damien Vincent Olivier Thibault Loic Yann Gaetan Armand`),
    last: w(`Martin Bernard Dubois Thomas Robert Richard Petit Durand Leroy Moreau Simon
      Laurent Lefebvre Michel Garcia Roux Fournier Girard Bonnet Dupont Lambert Fontaine
      Rousseau Vincent Muller Faure Andre Mercier Blanc Guerin Boyer Chevalier Lemaire
      Duval Gauthier Marchand Dumont Renard Perrin Colin`),
    // "Le" does not attach to any surname going: Le Blanc and Le Gall are
    // names, "Le Michel" is not. Particles get their own pool for that reason,
    // here and in every other culture that has them.
    particleLast: w(`Blanc Roux Gall Goff Guen Bihan Corre Moal Clerc Maire Fevre Roy
      Coz Meur Bris Floch Gouil Bras Hir Nen`),
    build: (rng, first, last, pick) => {
      // Compound given names (Jean-Baptiste) and the occasional particle.
      if (rng.next() < 0.14) {
        const heads = ['Jean', 'Pierre', 'Marc', 'Paul', 'Louis'];
        first = `${heads[Math.floor(rng.next() * heads.length)]}-${first}`;
      }
      if (rng.next() < 0.07) last = `Le ${pick('particleLast')}`;
      return `${first} ${last}`;
    },
  },

  spanish: {
    label: 'Spanish',
    first: w(`Alejandro Pablo Javier Sergio Alvaro Adrian Marcos Ruben Iker Unai Aitor
      Jorge Raul Ismael Guillermo Nicolas Joaquin Borja Gonzalo Hector Ignacio Mario`),
    last: w(`Garcia Fernandez Gonzalez Rodriguez Lopez Martinez Sanchez Perez Gomez Martin
      Jimenez Ruiz Hernandez Diaz Moreno Alvarez Romero Alonso Gutierrez Navarro Torres
      Dominguez Vazquez Ramos Gil Serrano Blanco Molina Morales Suarez Ortega Castro
      Delgado Ortiz Rubio Marin Sanz Iglesias Medina Cortes`),
    build: (rng, first, last, pick) => {
      // Two surnames, paternal then maternal, as Spanish names are formed.
      // The maternal one has to differ — "Lopez Lopez" happens in life, but
      // often enough from a 40-name pool that it reads as a bug.
      if (rng.next() < 0.55) {
        for (let i = 0; i < 8; i++) {
          const second = pick('last');
          if (second !== last) return `${first} ${last} ${second}`;
        }
      }
      return `${first} ${last}`;
    },
  },

  argentine: {
    label: 'Rioplatense',
    // Argentina is not Spain with different cities. A century of Italian
    // immigration means the SURNAME is often Italian while the given name is
    // Spanish — the pattern the previous spanish/italian split could not
    // produce, because picking the Italian pool also picked Italian given
    // names.
    first: w(`Santiago Nicolas Facundo Tomas Matias Agustin Juan Franco Lucas Gonzalo
      Martin Joaquin Bruno Ignacio Federico Julian Luciano Emiliano Lautaro Manuel
      Rodrigo Sebastian Nahuel Ramiro`),
    last: w(`Gonzalez Rodriguez Fernandez Lopez Martinez Garcia Perez Romero Sosa Diaz
      Alvarez Torres Ruiz Ramirez Benitez Acosta Medina Rossi Ferrari Bianchi Russo
      Esposito Colombo Ricci Moretti Gallo Conti Marino Rizzo Bruno Ferrero Pagani
      Aguirre Cabrera Ojeda Peralta Quiroga Vera Rios Bustos`),
  },

  portugueseBr: {
    label: 'Brazilian',
    first: w(`Lucas Gabriel Rafael Bruno Thiago Matheus Felipe Gustavo Vinicius Leonardo
      Rodrigo Eduardo Caio Diego Marcelo Andre Renato Fabio Igor Murilo Vitor Danilo
      Wesley Alisson Everton Douglas Rogerio Jefferson`),
    last: w(`Silva Santos Oliveira Souza Lima Pereira Ferreira Almeida Costa Gomes Ribeiro
      Martins Carvalho Rocha Barbosa Araujo Nascimento Cardoso Correia Teixeira Moreira
      Mendes Ramos Cavalcanti Batista Freitas Monteiro Azevedo Machado Vieira`),
    // "da" and "dos" are not interchangeable, and neither attaches to any
    // surname: da Silva and dos Santos are names, "dos Silva" is not.
    daLast: w(`Silva Costa Rocha Cruz Cunha Mata Luz Paz Conceicao Fonseca Gama Veiga`),
    dosLast: w(`Santos Reis Anjos Passos Prazeres`),
    build: (rng, first, last, pick) => {
      const r = rng.next();
      if (r < 0.30) {
        for (let i = 0; i < 8; i++) {
          const second = pick('last');
          if (second !== last) return `${first} ${last} ${second}`;
        }
      }
      if (r < 0.40) {
        return rng.next() < 0.5
          ? `${first} da ${pick('daLast')}`
          : `${first} dos ${pick('dosLast')}`;
      }
      return `${first} ${last}`;
    },
  },

  italian: {
    label: 'Italian',
    first: w(`Marco Luca Andrea Matteo Alessandro Davide Simone Federico Riccardo Stefano
      Giovanni Lorenzo Gabriele Nicolo Tommaso Filippo Emanuele Dario Fabio Cristian`),
    last: w(`Rossi Russo Ferrari Esposito Bianchi Romano Colombo Ricci Marino Greco Bruno
      Gallo Conti Costa Giordano Mancini Rizzo Lombardi Moretti Barbieri Fontana Santoro
      Mariani Rinaldi Caruso Ferrara Galli Martini Leone Longo`),
    // De Luca and Di Stefano are names; "De Esposito" is not.
    particleLast: w(`Luca Santis Angelis Rosa Marco Simone Filippi Giorgi Martino Palma
      Nardo Stefano Vito Matteo Cesare`),
    build: (rng, first, last, pick) => (rng.next() < 0.06
      ? `${first} ${rng.next() < 0.6 ? 'De' : 'Di'} ${pick('particleLast')}`
      : `${first} ${last}`),
  },

  germanic: {
    label: 'German',
    first: w(`Lukas Jonas Felix Maximilian Leon Paul Elias Moritz Julian Niklas Tobias
      Sebastian Fabian Florian Dominik Marcel Philipp Jannik Tim Simon Bastian Kilian`),
    last: w(`Muller Schmidt Schneider Fischer Weber Meyer Wagner Becker Schulz Hoffmann
      Schafer Koch Bauer Richter Klein Wolf Schroder Neumann Schwarz Zimmermann Braun
      Kruger Hofmann Hartmann Lange Werner Krause Lehmann Kohler Herrmann Walter Konig`),
    // "von" takes a place, not an occupational surname: von Hagen, not
    // von Schneider.
    particleLast: w(`Berg Stein Hagen Braun Sydow Hohenberg Lichtenau Falkenstein
      Wettin Moltke Bergen Ostheim Rothenburg`),
    build: (rng, first, last, pick) =>
      (rng.next() < 0.05 ? `${first} von ${pick('particleLast')}` : `${first} ${last}`),
  },

  dutch: {
    label: 'Dutch',
    first: w(`Daan Sem Lars Thijs Jesse Bram Ruben Stijn Jorrit Niels Sander Joris Mees
      Teun Rick Koen Pim Wessel Hidde Guus`),
    last: w(`Jansen Vries Bakker Visser Smit Meijer Boer Mulder Bos Vos Peters Hendriks
      Dekker Brouwer Willems Kuipers Linden Maas Verhoeven Koster Prins Blom Wolters`),
    // Each Dutch particle takes its own kind of surname — "de Vries", "van
    // Dijk", "van der Berg" — and none of them take a patronymic like
    // Hendriks. Three pools, because one would produce "de Hendriks".
    deLast: w(`Vries Jong Boer Groot Graaf Wit Bruin Haan Ruiter Koning Leeuw Bie Lange
      Hoop Vos Waal Rooij`),
    vanLast: w(`Dijk Dam Beek Loon Rijn Es Wijk Leeuwen Duin Bergen Houten Vliet Dongen
      Straaten Riet Kempen Hoek`),
    vanDerLast: w(`Berg Meer Wal Veen Laan Heijden Linden Velde Molen Weide Horst Pol
      Waals Zanden Sluis Kolk`),
    build: (rng, first, last, pick) => {
      const r = rng.next();
      if (r < 0.22) return `${first} van ${pick('vanLast')}`;
      if (r < 0.32) return `${first} van der ${pick('vanDerLast')}`;
      if (r < 0.38) return `${first} de ${pick('deLast')}`;
      return `${first} ${last}`;
    },
  },

  nordic: {
    label: 'Nordic',
    first: w(`Emil Oscar Viktor Elias Anton Filip Hugo Axel Alfred Melvin Rasmus Mikkel
      Kasper Jonas Henrik Sondre Magnus Sigurd Eirik Aleksander Joakim Tobias`),
    last: w(`Johansson Andersson Karlsson Nilsson Larsson Olsson Persson Svensson Gustafsson
      Pettersson Hansen Nielsen Jensen Pedersen Kristiansen Larsen Berg Lindqvist Sandberg
      Holm Dahl Aune Bakken Haugen Nygaard Virtanen Korhonen Makinen`),
  },

  southSlavic: {
    label: 'South Slavic',
    first: w(`Nikola Marko Stefan Luka Filip Milos Nemanja Aleksandar Vladimir Dusan Bojan
      Uros Ivan Petar Goran Zoran Dejan Bogdan Ognjen Vuk Andrija Matej Jure Rok Ziga`),
    last: w(`Jovanovic Petrovic Nikolic Markovic Djordjevic Stojanovic Ilic Pavlovic
      Milosevic Popovic Stankovic Lukic Kovacevic Simic Todorovic Ristic Savic Vasic
      Horvat Novak Kovacic Maric Babic Juric Vukovic Zupan Kranjc Potocnik Golob Zajc`),
  },

  eastSlavic: {
    label: 'East Slavic',
    first: w(`Ivan Dmitri Alexei Sergei Andrei Maxim Nikita Artem Roman Pavel Egor Kirill
      Denis Oleg Yaroslav Bohdan Taras Mykola Vadym Ruslan`),
    last: w(`Ivanov Smirnov Kuznetsov Popov Sokolov Lebedev Novikov Morozov Petrov Volkov
      Vasiliev Zaytsev Pavlov Semenov Golubev Shevchenko Kovalenko Bondarenko Tkachenko
      Kravchenko Melnyk Boyko Moroz Lysenko`),
  },

  polish: {
    label: 'Polish',
    first: w(`Jakub Kacper Filip Szymon Mateusz Bartosz Michal Piotr Tomasz Marcin Wojciech
      Damian Adrian Krzysztof Rafal Dawid Igor Oskar Maciej Przemyslaw`),
    last: w(`Nowak Kowalski Wisniewski Wojcik Kowalczyk Kaminski Lewandowski Zielinski
      Szymanski Wozniak Dabrowski Kozlowski Jankowski Mazur Kwiatkowski Krawczyk Piotrowski
      Grabowski Zajac Pawlowski Michalski Adamczyk Dudek Nowicki Majewski`),
  },

  // Lithuanian, Latvian and Estonian were one "Baltic" pool, which put Estonian
  // surnames on Lithuanian players. Estonian is not even a Baltic language, and
  // the two that are still do not share a surname morphology (-as/-is against
  // -ins/-s), so they are three pools.
  lithuanian: {
    label: 'Lithuanian',
    first: w(`Tomas Mantas Lukas Dovydas Rokas Nerijus Karolis Justas Arvydas Gediminas
      Marius Donatas Paulius Ignas Deividas Vytautas Aurimas Simonas Edvinas`),
    last: w(`Kazlauskas Petrauskas Jankauskas Stankevicius Vasiliauskas Butkus Paulauskas
      Urbonas Zukauskas Balciunas Navickas Rimkus Adomaitis Vaitkus Grigas Simkus
      Baranauskas Sereika Norkus Dapkus`),
  },

  latvian: {
    label: 'Latvian',
    first: w(`Janis Kristaps Rihards Martins Toms Andris Roberts Davis Edgars Kaspars
      Arturs Gatis Normunds Ainars`),
    last: w(`Berzins Kalnins Ozols Liepins Krumins Jansons Zarins Balodis Vitols Klavins
      Skujins Purins Cers Strautins Lacis`),
  },

  estonian: {
    label: 'Estonian',
    first: w(`Marten Rasmus Kaspar Siim Kristjan Martin Henri Karl Sander Rauno Tanel
      Mihkel Priit Indrek`),
    last: w(`Tamm Saar Kask Sepp Raud Mets Kukk Rebane Ilves Koppel Vaher Parn Lepik
      Kivi Toom`),
  },

  greek: {
    label: 'Greek',
    first: w(`Giannis Nikos Dimitris Kostas Georgios Vasilis Christos Panagiotis Thanasis
      Stelios Alexandros Michalis Petros Andreas Ilias`),
    last: w(`Papadopoulos Papadakis Georgiou Nikolaou Vlachos Antoniou Karagiannis Makris
      Economou Pappas Christou Dimitriou Ioannou Katsaros Samaras Sideris Fotiadis`),
  },

  turkish: {
    label: 'Turkish',
    first: w(`Mehmet Mustafa Ahmet Emre Burak Cem Kerem Furkan Baris Onur Berk Serkan
      Ozan Tolga Yigit Deniz Kaan Alper Umut Efe`),
    last: w(`Yilmaz Kaya Demir Sahin Celik Yildiz Yildirim Ozturk Aydin Ozdemir Arslan
      Dogan Kilic Aslan Cetin Kara Koc Kurt Ozkan Simsek Polat Korkmaz Erdogan`),
  },

  arabMaghreb: {
    label: 'Maghrebi',
    first: w(`Mohamed Youssef Karim Bilal Rachid Samir Hicham Nabil Yassine Anis Sofiane
      Adel Walid Amine Zakaria Ilyes Mehdi Riad Tarek Farid`),
    last: w(`Benali Bouzid Haddad Cherif Mansouri Zerrouki Belkacem Ouali Saidi Tahiri
      Aissa Kaddour Meziane Boukhari Ferhat Slimani Hamidi Bencheikh Lahlou Naciri`),
    build: (rng, first, last) => {
      // Benali and Bencheikh already carry the particle; "Ben Benali" is not
      // a name.
      if (/^(Ben|El)/.test(last)) return `${first} ${last}`;
      const r = rng.next();
      if (r < 0.14) return `${first} El ${last}`;
      if (r < 0.22) return `${first} Ben ${last}`;
      return `${first} ${last}`;
    },
  },

  arabLevant: {
    label: 'Levantine',
    first: w(`Omar Khalil Tariq Rami Sami Hassan Hussein Ziad Fadi Nader Bassel Marwan
      Ayman Jamil Wael Ghassan Imad`),
    last: w(`Haddad Khoury Nassar Sayegh Hamdan Aziz Rahman Farah Salloum Dabbagh Mansour
      Sabbagh Karam Zayed Barakat Jaber Halabi`),
    build: (rng, first, last) => (rng.next() < 0.18 ? `${first} Al-${last}` : `${first} ${last}`),
  },

  mande: {
    label: 'Mande',
    first: w(`Amadou Ibrahima Moussa Ousmane Cheick Modibo Bakary Seydou Lassana Adama
      Mamadou Boubacar Salif Drissa Souleymane Yacouba Abdoulaye Sekou Fousseni Alpha
      Sidiki Karim Bourama Aliou`),
    last: w(`Traore Keita Diarra Coulibaly Diallo Sissoko Doumbia Konate Camara Fofana
      Toure Cisse Sanogo Dembele Kone Bagayoko Samake Diakite Sylla Kanoute Berthe Maiga
      Sidibe Tangara`),
  },

  wolofSerer: {
    label: 'Senegalese',
    first: w(`Cheikh Mamadou Ibrahima Pape Moussa Alioune Abdou Serigne Babacar Ousmane
      Modou Saliou Malick Assane Lamine Mbaye`),
    last: w(`Diop Ndiaye Fall Gueye Sow Ba Sarr Faye Seck Diagne Thiam Mbaye Dieng Niang
      Sy Wade Diouf Badji Gaye`),
  },

  yoruba: {
    label: 'Yoruba',
    first: w(`Tunde Segun Femi Kunle Bola Wale Dele Yemi Ayo Sola Bayo Kola Niyi Tayo
      Gbenga Rotimi Damilola Olumide Seyi Bode`),
    last: w(`Adeyemi Okonkwo Adebayo Ogunleye Balogun Afolabi Oyelaran Adesina Ajayi
      Oladipo Olawale Bankole Ogundipe Adewale Fashola Oyekan Sanusi Akindele Babatunde
      Olaniyan`),
  },

  hausaFulani: {
    label: 'Hausa-Fulani',
    // Northern Nigeria and the Sahel. These were previously being served by the
    // Levantine pool, which shares a religion with the region and nothing else.
    first: w(`Abubakar Musa Ibrahim Sani Yakubu Aliyu Umar Bello Nasir Suleiman Aminu
      Kabiru Danladi Shehu Usman Garba Hamza Idris Lawal Auwal Salisu Nuhu`),
    last: w(`Abubakar Musa Bello Sani Aliyu Yusuf Danjuma Gambo Tijjani Adamu Lawal
      Mohammed Shehu Garba Ahmadu Dikko Zubairu Bala Isah Maikano Jibrin Sulaiman`),
  },

  igbo: {
    label: 'Igbo',
    first: w(`Chidi Emeka Obinna Ikenna Chuka Nnamdi Uche Kelechi Ifeanyi Chinedu Somto
      Ebuka Okey Arinze Chukwuma Ugonna`),
    last: w(`Okafor Nwosu Eze Okeke Nwachukwu Obi Anyanwu Chukwu Onyeka Madu Nnaji Ezeh
      Uzo Iheanacho Okorie Ugwu`),
  },

  akan: {
    label: 'Akan',
    first: w(`Kwame Kofi Kwaku Yaw Kojo Kwabena Kwasi Nana Fiifi Ekow Kudjo Selorm Elikem`),
    last: w(`Mensah Boateng Asante Owusu Osei Appiah Agyeman Darko Adjei Amoah Frimpong
      Antwi Baffour Nyarko Gyasi Sarpong`),
  },

  cameroonian: {
    label: 'Cameroonian',
    first: w(`Joel Landry Yannick Christian Serge Bertrand Arnaud Nfor Bruno Herve Franck
      Aurelien Cedric`),
    last: w(`Nkemdirim Mbappe Etoo Njoya Fotso Nkoulou Ateba Ekambi Bikoi Ondoa Njie Tchami
      Menye Ngando`),
  },

  centralAfrican: {
    label: 'Central African',
    first: w(`Emmanuel Christian Blaise Patrick Serge Gaston Didier Jonas Elie Bienvenu
      Trésor Merveille`),
    last: w(`Mbala Kabongo Tshimanga Mukendi Ilunga Lokonda Mputu Nzuzi Kalonji Bakala
      Ngoma Mavungu Luyindula`),
  },

  hornAfrican: {
    label: 'Horn of Africa',
    // Somali, Ethiopian and Eritrean. South Sudanese names used to be mixed in
    // here; they are a different region and a different language family, so
    // they have their own pool below.
    first: w(`Abdi Hassan Ahmed Mohamed Yonas Dawit Bereket Tewodros Samuel Nuredin Kaleb
      Abdirahman Yohannes Mesfin Girmay Elias Robel Filmon`),
    last: w(`Farah Warsame Osman Hersi Jama Tesfaye Girma Haile Bekele Mekonnen Abdullahi
      Gebre Tekle Hagos Yusuf Ali Aden Weldu`),
  },

  nilotic: {
    label: 'South Sudanese',
    // Dinka and Nuer. In these traditions the same name can serve as a given
    // name or a father's name, so the two pools deliberately overlap — that is
    // how the names actually work, not an oversight.
    first: w(`Deng Bol Garang Majok Thon Kuol Chol Mading Akol Lual Duop Gai Ajak Manute
      Ater Anei Wenyin Ring Nyal Buay Malith Peter Samuel`),
    last: w(`Deng Bol Garang Majok Ajak Mading Malual Kuol Chol Akot Nyang Wol Athian
      Aleer Gatluak Manyang Riak Thiong Awuol Lual Machar Yak Dut Reath`),
  },

  southernAfrican: {
    label: 'Southern African',
    first: w(`Thabo Sipho Lunga Kagiso Mpho Tebogo Bongani Sifiso Lungelo Katlego Tumelo`),
    last: w(`Nkosi Dlamini Mokoena Ndlovu Khumalo Mabaso Sithole Zulu Molefe Mahlangu
      Radebe Tshabalala`),
  },

  chinese: {
    label: 'Chinese',
    first: w(`Wei Hao Jun Ming Lei Yong Peng Kai Tao Bo Jian Feng Cheng Xiang Zhen Long
      Yang Shuai Dong Rui`),
    last: w(`Wang Li Zhang Liu Chen Yang Huang Zhao Wu Zhou Xu Sun Ma Zhu Hu Guo Lin He
      Gao Luo Zheng Liang Song Tang`),
  },

  japanese: {
    label: 'Japanese',
    first: w(`Yuto Sota Ren Haruto Riku Kaito Yuki Sora Hinata Takumi Daiki Shota Kenta
      Ryo Naoki Kazuki`),
    last: w(`Sato Suzuki Takahashi Tanaka Watanabe Ito Yamamoto Nakamura Kobayashi Kato
      Yoshida Yamada Sasaki Matsumoto Inoue Kimura Hayashi Shimizu`),
  },

  korean: {
    label: 'Korean',
    first: w(`Minjun Seojun Doyun Jiho Haneul Junseo Yunho Sungmin Jaewon Hyunwoo Taeyang
      Donghyun Kyungho Sangwoo`),
    last: w(`Kim Lee Park Choi Jung Kang Cho Yoon Jang Lim Han Oh Seo Shin Kwon Hwang Ahn
      Song`),
  },

  filipino: {
    label: 'Filipino',
    first: w(`Jose Angelo Mark Paolo Carlo Miguel Rafael Kiefer Jio Dwight Christian Jaymar
      Arvin Reymart`),
    last: w(`Santos Reyes Cruz Bautista Ocampo Garcia Mendoza Torres Ramos Aquino Villanueva
      Castro Dela Rosa Aguilar Fajardo Pascual Manalo Salvador`),
  },

  southAsian: {
    label: 'South Asian',
    first: w(`Arjun Rohan Aditya Rahul Vikram Sanjay Nikhil Karan Ravi Ankit Imran Bilal
      Hamza Zain Faisal Usman Rizwan Amrit Gurpreet Jasdeep`),
    last: w(`Patel Sharma Singh Kumar Reddy Nair Iyer Gupta Mehta Chopra Bhatt Desai Rao
      Khan Ahmed Malik Hussain Chaudhry Sandhu Grewal`),
  },

  persian: {
    label: 'Persian',
    first: w(`Arash Reza Kaveh Babak Farhad Siavash Navid Behrouz Kamran Peyman Sina Omid`),
    last: w(`Hosseini Rezaei Mohammadi Ahmadi Karimi Sadeghi Jafari Nazari Shirazi Farhadi
      Bahrami Ansari`),
  },

  hebrew: {
    label: 'Israeli',
    first: w(`Omri Itay Yonatan Guy Noam Amit Roi Eitan Tomer Shai Lior Nadav Ori Gilad`),
    last: w(`Cohen Levi Mizrahi Peretz Biton Avraham Friedman Katz Shapira Segal Barkan
      Aviv Zohar Gal`),
  },

  // A deliberately small, conservative pool of surnames documented as common in
  // Canadian First Nations and Métis communities. Kept modest and weighted low
  // rather than padded out with invented entries — a thin authentic list is
  // better than a long speculative one.
  indigenousCanadian: {
    label: 'Indigenous Canadian',
    first: w(`Ethan Dakota Kyle Jordan Tyler Shane Dallas Cody Devon Marcus`),
    last: w(`Cardinal Sinclair Beaulieu Morin Whitebear Bearpaw Nepinak Meechas Lameman
      Desjarlais Bruyere Flett`),
  },
};

/* ===========================================================================
 * PLACES
 * ---------------------------------------------------------------------------
 * `cultures` is a weighted mix, never a single answer. The weights encode who
 * actually plays basketball where, including diaspora and immigrant families,
 * so a London-born player can plausibly be Anglo, Nigerian, Caribbean, South
 * Asian or Polish.
 * ======================================================================== */
const P = (city, region) => ({ city, region });

export const COUNTRIES = {
  USA: {
    weight: 68, nationality: 'USA',
    cities: [P('Chicago', 'IL'), P('Los Angeles', 'CA'), P('Houston', 'TX'), P('Atlanta', 'GA'),
      P('Philadelphia', 'PA'), P('Detroit', 'MI'), P('Baltimore', 'MD'), P('Memphis', 'TN'),
      P('Oakland', 'CA'), P('Brooklyn', 'NY'), P('The Bronx', 'NY'), P('Newark', 'NJ'),
      P('Dallas', 'TX'), P('Phoenix', 'AZ'), P('Seattle', 'WA'), P('Portland', 'OR'),
      P('Miami', 'FL'), P('Orlando', 'FL'), P('Charlotte', 'NC'), P('Indianapolis', 'IN'),
      P('Columbus', 'OH'), P('Milwaukee', 'WI'), P('Kansas City', 'MO'), P('St. Louis', 'MO'),
      P('New Orleans', 'LA'), P('Birmingham', 'AL'), P('Norwalk', 'CT'), P('Akron', 'OH'),
      P('Fresno', 'CA'), P('Tacoma', 'WA'), P('Tulsa', 'OK'), P('Flint', 'MI'),
      P('Camden', 'NJ'), P('Waco', 'TX'), P('Provo', 'UT'), P('Boise', 'ID')],
    cultures: [['africanAmerican', 40], ['anglo', 33], ['usLatino', 14],
      ['usAsian', 4], ['caribbeanAmerican', 4], ['mande', 1.5], ['yoruba', 1.5],
      ['southAsian', 1], ['arabLevant', 1]],
  },
  Canada: {
    weight: 5, nationality: 'Canada',
    cities: [P('Toronto', 'ON'), P('Montreal', 'QC'), P('Vancouver', 'BC'), P('Ottawa', 'ON'),
      P('Calgary', 'AB'), P('Edmonton', 'AB'), P('Winnipeg', 'MB'), P('Hamilton', 'ON'),
      P('Mississauga', 'ON'), P('Brampton', 'ON'), P('Halifax', 'NS')],
    cultures: [['anglo', 34], ['caribbeanAmerican', 16], ['frenchEuro', 14],
      ['africanAmerican', 6], ['southAsian', 9], ['chinese', 5], ['filipino', 3],
      ['yoruba', 3], ['nilotic', 2], ['indigenousCanadian', 4], ['polish', 2],
      ['portugueseBr', 2]],
  },
  France: {
    weight: 3.2, nationality: 'France',
    cities: [P('Paris', null), P('Marseille', null), P('Lyon', null), P('Toulouse', null),
      P('Villeurbanne', null), P('Nanterre', null), P('Le Havre', null), P('Strasbourg', null)],
    cultures: [['frenchEuro', 46], ['arabMaghreb', 20], ['mande', 12], ['wolofSerer', 6],
      ['centralAfrican', 6], ['caribbeanAmerican', 6], ['cameroonian', 4]],
  },
  Spain: { weight: 1.6, nationality: 'Spain',
    cities: [P('Madrid', null), P('Barcelona', null), P('Valencia', null), P('Seville', null),
      P('Malaga', null), P('Zaragoza', null)],
    cultures: [['spanish', 82], ['arabMaghreb', 8], ['wolofSerer', 5], ['portugueseBr', 5]] },
  Serbia: { weight: 1.5, nationality: 'Serbia',
    cities: [P('Belgrade', null), P('Novi Sad', null), P('Nis', null), P('Kragujevac', null)],
    cultures: [['southSlavic', 96], ['eastSlavic', 4]] },
  Croatia: { weight: 1.0, nationality: 'Croatia',
    cities: [P('Zagreb', null), P('Split', null), P('Zadar', null), P('Rijeka', null)],
    cultures: [['southSlavic', 97], ['italian', 3]] },
  Slovenia: { weight: 0.9, nationality: 'Slovenia',
    cities: [P('Ljubljana', null), P('Maribor', null), P('Celje', null)],
    cultures: [['southSlavic', 94], ['germanic', 6]] },
  'Bosnia and Herzegovina': { weight: 0.7, nationality: 'Bosnia and Herzegovina',
    cities: [P('Sarajevo', null), P('Banja Luka', null), P('Mostar', null)],
    cultures: [['southSlavic', 96], ['turkish', 4]] },
  Montenegro: { weight: 0.6, nationality: 'Montenegro',
    cities: [P('Podgorica', null), P('Niksic', null)], cultures: [['southSlavic', 100]] },
  Lithuania: { weight: 0.9, nationality: 'Lithuania',
    cities: [P('Vilnius', null), P('Kaunas', null), P('Klaipeda', null)],
    cultures: [['lithuanian', 96], ['eastSlavic', 4]] },
  Estonia: { weight: 0.3, nationality: 'Estonia',
    cities: [P('Tallinn', null), P('Tartu', null)],
    cultures: [['estonian', 82], ['eastSlavic', 18]] },
  Latvia: { weight: 0.6, nationality: 'Latvia',
    cities: [P('Riga', null), P('Liepaja', null)], cultures: [['latvian', 88], ['eastSlavic', 12]] },
  Germany: { weight: 1.6, nationality: 'Germany',
    cities: [P('Berlin', null), P('Munich', null), P('Hamburg', null), P('Cologne', null),
      P('Bamberg', null), P('Wurzburg', null)],
    cultures: [['germanic', 64], ['turkish', 15], ['polish', 8], ['southSlavic', 6],
      ['arabLevant', 4], ['centralAfrican', 3]] },
  Italy: { weight: 1.1, nationality: 'Italy',
    cities: [P('Milan', null), P('Rome', null), P('Bologna', null), P('Naples', null),
      P('Reggio Emilia', null)],
    cultures: [['italian', 82], ['wolofSerer', 6], ['arabMaghreb', 5], ['centralAfrican', 4],
      ['southSlavic', 3]] },
  Greece: { weight: 0.9, nationality: 'Greece',
    cities: [P('Athens', null), P('Thessaloniki', null), P('Piraeus', null)],
    cultures: [['greek', 84], ['yoruba', 6], ['arabLevant', 4], ['southSlavic', 6]] },
  Turkey: { weight: 0.9, nationality: 'Turkey',
    cities: [P('Istanbul', null), P('Ankara', null), P('Izmir', null), P('Bursa', null)],
    cultures: [['turkish', 94], ['arabLevant', 6]] },
  Netherlands: { weight: 0.6, nationality: 'Netherlands',
    cities: [P('Amsterdam', null), P('Rotterdam', null), P('The Hague', null)],
    cultures: [['dutch', 72], ['arabMaghreb', 10], ['turkish', 8],
      ['caribbeanAmerican', 6], ['southAsian', 4]] },
  Poland: { weight: 0.7, nationality: 'Poland',
    cities: [P('Warsaw', null), P('Krakow', null), P('Gdansk', null), P('Wroclaw', null)],
    cultures: [['polish', 97], ['eastSlavic', 3]] },
  Ukraine: { weight: 0.5, nationality: 'Ukraine',
    cities: [P('Kyiv', null), P('Kharkiv', null), P('Odesa', null), P('Lviv', null)],
    cultures: [['eastSlavic', 100]] },
  Sweden: { weight: 0.5, nationality: 'Sweden',
    cities: [P('Stockholm', null), P('Gothenburg', null), P('Malmo', null)],
    cultures: [['nordic', 76], ['hornAfrican', 10], ['arabLevant', 8], ['southSlavic', 6]] },
  Finland: { weight: 0.3, nationality: 'Finland',
    cities: [P('Helsinki', null), P('Tampere', null)], cultures: [['nordic', 94], ['hornAfrican', 6]] },
  Nigeria: { weight: 1.4, nationality: 'Nigeria',
    cities: [P('Lagos', null), P('Abuja', null), P('Port Harcourt', null), P('Kano', null),
      P('Ibadan', null), P('Enugu', null)],
    cultures: [['yoruba', 42], ['igbo', 32], ['hausaFulani', 16], ['anglo', 6],
      ['akan', 4]] },
  Senegal: { weight: 1.0, nationality: 'Senegal',
    cities: [P('Dakar', null), P('Thies', null), P('Saint-Louis', null)],
    cultures: [['wolofSerer', 82], ['mande', 14], ['frenchEuro', 4]] },
  Mali: { weight: 0.7, nationality: 'Mali',
    cities: [P('Bamako', null), P('Sikasso', null), P('Segou', null)],
    cultures: [['mande', 92], ['wolofSerer', 4], ['frenchEuro', 4]] },
  Cameroon: { weight: 0.8, nationality: 'Cameroon',
    cities: [P('Yaounde', null), P('Douala', null), P('Bafoussam', null)],
    cultures: [['cameroonian', 72], ['frenchEuro', 12], ['centralAfrican', 10], ['anglo', 6]] },
  Ghana: { weight: 0.6, nationality: 'Ghana',
    cities: [P('Accra', null), P('Kumasi', null), P('Tamale', null)],
    cultures: [['akan', 80], ['anglo', 10], ['yoruba', 10]] },
  'DR Congo': { weight: 0.6, nationality: 'DR Congo',
    cities: [P('Kinshasa', null), P('Lubumbashi', null), P('Goma', null)],
    cultures: [['centralAfrican', 88], ['frenchEuro', 12]] },
  'South Sudan': { weight: 0.5, nationality: 'South Sudan',
    cities: [P('Juba', null), P('Wau', null)], cultures: [['hornAfrican', 100]] },
  'South Africa': { weight: 0.4, nationality: 'South Africa',
    cities: [P('Johannesburg', null), P('Cape Town', null), P('Durban', null)],
    cultures: [['southernAfrican', 66], ['anglo', 22], ['southAsian', 12]] },
  Brazil: { weight: 0.9, nationality: 'Brazil',
    cities: [P('Sao Paulo', null), P('Rio de Janeiro', null), P('Belo Horizonte', null),
      P('Curitiba', null), P('Salvador', null)],
    cultures: [['portugueseBr', 92], ['italian', 4], ['japanese', 4]] },
  Argentina: { weight: 0.7, nationality: 'Argentina',
    cities: [P('Buenos Aires', null), P('Cordoba', null), P('Rosario', null), P('Bahia Blanca', null)],
    cultures: [['argentine', 92], ['spanish', 4], ['germanic', 2], ['eastSlavic', 2]] },
  'Dominican Republic': { weight: 0.6, nationality: 'Dominican Republic',
    cities: [P('Santo Domingo', null), P('Santiago', null)],
    cultures: [['usLatino', 88], ['caribbeanAmerican', 12]] },
  'Puerto Rico': { weight: 0.4, nationality: 'Puerto Rico',
    cities: [P('San Juan', null), P('Bayamon', null)], cultures: [['usLatino', 96], ['anglo', 4]] },
  Mexico: { weight: 0.5, nationality: 'Mexico',
    cities: [P('Mexico City', null), P('Guadalajara', null), P('Monterrey', null)],
    cultures: [['usLatino', 96], ['spanish', 4]] },
  Jamaica: { weight: 0.4, nationality: 'Jamaica',
    cities: [P('Kingston', null), P('Montego Bay', null)],
    cultures: [['caribbeanAmerican', 94], ['southAsian', 6]] },
  Australia: { weight: 1.0, nationality: 'Australia',
    cities: [P('Melbourne', 'VIC'), P('Sydney', 'NSW'), P('Perth', 'WA'), P('Brisbane', 'QLD'),
      P('Adelaide', 'SA'), P('Canberra', 'ACT')],
    cultures: [['anglo', 70], ['nilotic', 8], ['southSlavic', 7], ['greek', 5],
      ['italian', 5], ['hornAfrican', 2], ['chinese', 3]] },
  'South Sudan': { weight: 0.3, nationality: 'South Sudan',
    cities: [P('Juba', null), P('Wau', null), P('Malakal', null), P('Bor', null),
      P('Rumbek', null)],
    cultures: [['nilotic', 94], ['hornAfrican', 6]] },
  'United Kingdom': { weight: 0.8, nationality: 'United Kingdom',
    cities: [P('London', null), P('Manchester', null), P('Birmingham', null), P('Leeds', null),
      P('Newcastle', null)],
    cultures: [['anglo', 52], ['caribbeanAmerican', 14], ['yoruba', 10], ['southAsian', 10],
      ['akan', 6], ['polish', 4], ['igbo', 4]] },
  China: { weight: 0.5, nationality: 'China',
    cities: [P('Beijing', null), P('Shanghai', null), P('Guangzhou', null), P('Liaoning', null)],
    cultures: [['chinese', 100]] },
  Japan: { weight: 0.4, nationality: 'Japan',
    cities: [P('Tokyo', null), P('Osaka', null), P('Nagoya', null), P('Sendai', null)],
    cultures: [['japanese', 94], ['filipino', 3], ['korean', 3]] },
  'South Korea': { weight: 0.3, nationality: 'South Korea',
    cities: [P('Seoul', null), P('Busan', null), P('Incheon', null)], cultures: [['korean', 100]] },
  Philippines: { weight: 0.3, nationality: 'Philippines',
    cities: [P('Manila', null), P('Cebu', null), P('Quezon City', null)],
    cultures: [['filipino', 94], ['chinese', 6]] },
  India: { weight: 0.3, nationality: 'India',
    cities: [P('Mumbai', null), P('Delhi', null), P('Chennai', null), P('Ludhiana', null)],
    cultures: [['southAsian', 100]] },
  Israel: { weight: 0.4, nationality: 'Israel',
    cities: [P('Tel Aviv', null), P('Jerusalem', null), P('Haifa', null)],
    cultures: [['hebrew', 82], ['eastSlavic', 10], ['arabLevant', 8]] },
  Iran: { weight: 0.2, nationality: 'Iran',
    cities: [P('Tehran', null), P('Isfahan', null)], cultures: [['persian', 100]] },
};

/* ============================== drawing ================================== */

/**
 * Zipf-ish pick from an ordered list: entry i is chosen with probability
 * proportional to 1/(i + k). Lists are written commonest-first, so common
 * names recur and rare ones stay rare without hand-weighting every entry.
 */
function pickRanked(rng, list, k = 6) {
  let total = 0;
  for (let i = 0; i < list.length; i++) total += 1 / (i + k);
  let r = rng.next() * total;
  for (let i = 0; i < list.length; i++) {
    r -= 1 / (i + k);
    if (r <= 0) return list[i];
  }
  return list[list.length - 1];
}

function pickWeightedPairs(rng, pairs) {
  const total = pairs.reduce((s, [, wt]) => s + wt, 0);
  let r = rng.next() * total;
  for (const [k, wt] of pairs) { r -= wt; if (r <= 0) return k; }
  return pairs[pairs.length - 1][0];
}

const COUNTRY_PAIRS = Object.entries(COUNTRIES).map(([k, v]) => [k, v.weight]);

/**
 * culture id -> the countries that draw on it, weighted by how much of that
 * country's mix it is and how big a source of players the country is. Used for
 * dual nationality, so the second passport belongs to a country the player's
 * naming tradition actually connects him to.
 */
const COUNTRIES_BY_CULTURE = (() => {
  const idx = {};
  for (const [key, entry] of Object.entries(COUNTRIES)) {
    for (const [culture, share] of entry.cultures) {
      (idx[culture] ||= []).push([key, entry.weight * share]);
    }
  }
  return idx;
})();

/**
 * Where a player is from, and which naming tradition his name comes from.
 *
 * `namingOrigin` is the culture the name was drawn from. It is a naming
 * tradition and nothing more — not ancestry, not appearance, not identity.
 *
 * A small share of players were born in one country and raised in another,
 * which is how a second nationality arises.
 */
export function makeOrigin(rng) {
  const countryKey = pickWeightedPairs(rng, COUNTRY_PAIRS);
  const country = COUNTRIES[countryKey];
  const place = country.cities[Math.floor(rng.next() * country.cities.length)];
  const namingOrigin = pickWeightedPairs(rng, country.cultures);

  // Raised somewhere other than his birthplace: a real and common story, and
  // the only thing that produces a second nationality. The second country is
  // drawn from the countries that actually share his naming tradition, not
  // from the whole world — a Bamako-born player holding a French passport is
  // a story, one holding a Finnish passport is a dice roll.
  let secondaryNationality = null;
  if (rng.next() < 0.09) {
    const linked = (COUNTRIES_BY_CULTURE[namingOrigin] || []).filter(([k]) => k !== countryKey);
    const other = linked.length ? pickWeightedPairs(rng, linked) : null;
    if (other) secondaryNationality = COUNTRIES[other].nationality;
  }

  return {
    birthCity: place.city,
    birthRegion: place.region || null,
    birthCountry: countryKey,
    nationality: country.nationality,
    secondaryNationality,
    namingOrigin,
    // The league is a men's league, so given names come from male pools.
    // A women's league would add a `firstFemale` pool per culture and read
    // this field to choose between them.
    gender: 'male',
  };
}

/** Build a name in the style of `origin.namingOrigin`. */
export function makeName(rng, origin) {
  const culture = CULTURES[(origin && origin.namingOrigin)] || CULTURES.anglo;
  const first = pickRanked(rng, culture.first);
  const last = pickRanked(rng, culture.last);
  const pick = (which) => pickRanked(rng, culture[which]);
  return culture.build ? culture.build(rng, first, last, pick) : `${first} ${last}`;
}

/**
 * Which naming tradition a name from `country` would come from — the same
 * weighted draw makeOrigin() uses, exposed for the save-upgrade path, which
 * knows a player's birth country but not (a name already written years ago
 * cannot be classified backwards) his naming tradition.
 *
 * Returns null for a country the table does not know, which the caller should
 * treat as "unknown" rather than substituting a default tradition.
 */
export function cultureForCountry(rng, country) {
  const entry = COUNTRIES[country];
  return entry ? pickWeightedPairs(rng, entry.cultures) : null;
}

/** Rough count of distinct full names the pools can produce, for sanity checks. */
export function poolSize() {
  return Object.values(CULTURES).reduce((s, c) => s + c.first.length * c.last.length, 0);
}
