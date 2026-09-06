'use strict';

/**
 * gameSettings.js — the Players & Rosters rules a league is created with.
 *
 * One definition table drives everything: the settings screen renders from it,
 * defaults come from it, validation clamps against it, and presets round-trip
 * through it. Adding a setting means adding a row here and nothing else.
 *
 * `applied` is deliberately part of the data. Some of these rules take effect
 * the moment a league is generated; others describe behaviour that belongs to
 * a season simulator that does not exist yet. The screen says which is which
 * rather than presenting a switch that quietly does nothing.
 *
 * THE SEPARATION THESE SETTINGS MUST NOT BREAK
 *   Basketball attributes -> how good he is       -> the ONLY input to overall
 *   Mental attributes     -> how he handles it    -> never touches overall
 *   Personality/priorities-> what he's like to manage -> never touches overall
 * Turning mental or personality off removes those layers from the save. It
 * does not, and cannot, change anybody's rating.
 */

import { saveData, loadData, deleteData, getAllData } from './db.js';

const PRESET_STORE = 'presets';
const PRESET_PREFIX = 'rules:';

/** Every setting, grouped exactly as the screen lays them out. */
export const GROUPS = [
  {
    id: 'roster', label: 'Roster',
    settings: [
      { key: 'minRosterSize', label: 'Minimum Roster Size', type: 'number',
        def: 10, min: 5, max: 20, applied: true,
        help: 'The fewest players a team may carry. Enforced when signing and releasing.' },
      { key: 'maxRosterSize', label: 'Maximum Roster Size', type: 'number',
        def: 15, min: 8, max: 25, applied: true,
        help: 'The most standard players a team may carry. Generated rosters fill to one below this, leaving a spot open.' },
    ],
  },
  {
    id: 'generation', label: 'Player Generation',
    settings: [
      { key: 'playerGender', label: 'Player Gender', type: 'choice',
        options: ['Male', 'Female', 'Mixed'], def: 'Male', applied: true,
        help: 'Which player pool the league draws from. Gender changes the physical distributions — height, weight, strength, vertical, explosiveness — and nothing else. It is never a talent penalty: a 90 in a women\u2019s league is a 90, an elite player in that league\u2019s own competitive context. Shooting, playmaking, IQ, defence and rebounding are generated identically.' },
      { key: 'genderSplit', label: 'Male Share (Mixed)', type: 'number',
        min: 0, max: 100, step: 5, def: 50, unit: '%', applied: true,
        dependsOn: { key: 'playerGender', value: 'Mixed' },
        help: 'In a Mixed league, the share of generated players who are male. Applied as a probability across the whole population, so individual rosters and draft classes vary around it rather than each matching it exactly.' },
      { key: 'talentLevel', label: 'Player Talent Level', type: 'choice',
        options: ['Low', 'Normal', 'High', 'Custom'], def: 'Normal', applied: true,
        help: 'Shifts the whole league up or down the rating scale. The scale itself never changes — 95+ stays generational, 70-74 stays rotation. Custom leaves the curve alone and lets Variance and Generational Frequency do the work.' },
      { key: 'talentVariance', label: 'Talent Variance', type: 'choice',
        options: ['Low', 'Normal', 'High'], def: 'Normal', applied: true,
        help: 'How far apart players are. Low bunches the league around its average; High opens up real gaps between weak, average, good and elite.' },
      { key: 'generationalFrequency', label: 'Generational Talent Frequency', type: 'choice',
        options: ['Extremely Rare', 'Rare', 'Occasional'], def: 'Extremely Rare', applied: true,
        help: 'How often a player capable of roughly 95+ appears. Even on Occasional nothing guarantees one exists — these are probabilities, not quotas, and most leagues on Extremely Rare have none at all.' },
    ],
  },
  {
    id: 'schedSeason', label: 'Schedule — Season Structure',
    settings: [
      { key: 'regularSeasonGames', label: 'Regular Season Games', type: 'number',
        min: 4, max: 120, step: 1, def: 82, applied: true,
        help: 'How many games each team plays. The generator works to this as a TARGET: the matchup maths for your league\u2019s shape rarely lands on a round number, so it gets as close as it can and the preview tells you what it actually produced.' },
      { key: 'seasonStart', label: 'Season Start', type: 'monthday', def: '10-20', applied: true,
        help: 'When the regular season begins. A season that crosses New Year simply runs into the next calendar year.' },
      { key: 'seasonEnd', label: 'Season End', type: 'monthday', def: '04-12', applied: true,
        after: 'seasonStart',
        help: 'The target end of the regular season. Validation checks that enough calendar sits between the two dates for the games and rest you have asked for.' },
      { key: 'gamesPerWeek', label: 'Games Per Week', type: 'choice',
        options: ['Light', 'Normal', 'Heavy', 'Custom'], def: 'Normal', applied: true,
        help: 'A scheduling TARGET, not a rule: Light is 2\u20133 a week, Normal 3\u20134, Heavy 4\u20135. Individual weeks vary around it, which is what real schedules do.' },
      // Games per week is a TEAM's workload; this is the LEAGUE's night. The two
      // are different axes and both matter: a team can play three games in a
      // week whether the league stages four games that Monday or twelve.
      { key: 'dayOfWeekVariation', label: 'Games Per Day Variation', type: 'choice',
        options: ['Off', 'Low', 'Normal', 'High'], def: 'Normal', applied: true,
        help: 'How much the size of a night\u2019s card depends on the day of the week. Normal makes Friday and Saturday the heavy nights and Monday and Thursday the light ones, the way a real season runs. Off spreads games evenly across every day, which is flatter than any real schedule.' },
      { key: 'gamesPerWeekCustom', label: 'Games Per Week (Custom)', type: 'number',
        min: 1, max: 7, step: 1, def: 4, applied: true,
        dependsOn: { key: 'gamesPerWeek', value: 'Custom' },
        help: 'Your own weekly target, used when Games Per Week is Custom.' },
    ],
  },
  {
    id: 'schedOpponents', label: 'Schedule — Opponent Scheduling',
    settings: [
      { key: 'autoBalanceSchedule', label: 'Auto Balance Schedule', type: 'toggle',
        def: true, applied: true,
        help: 'Works out how often each kind of opponent should meet from your league\u2019s actual shape \u2014 team count, conferences, divisions \u2014 and the season length, so division rivals meet most and non-conference opponents least. Nothing about it assumes a 30-team league. Switch it off to set any of the three counts yourself; each one you leave blank is still worked out for you.' },
      { key: 'divisionGames', label: 'Games vs. Each Division Opponent', type: 'optnum',
        min: 0, max: 12, step: 1, def: '', applied: true,
        dependsOn: { key: 'autoBalanceSchedule', value: false },
        help: 'Number of games played against each team in the same division. Leave blank to give no special scheduling treatment to division opponents \u2014 blank is NOT zero, it hands those opponents to the general generator.' },
      { key: 'conferenceGames', label: 'Games vs. Each Non-Division Conference Opponent',
        type: 'optnum', min: 0, max: 12, step: 1, def: '', applied: true,
        dependsOn: { key: 'autoBalanceSchedule', value: false },
        help: 'Number of games versus other teams in the same conference but a different division. Leave blank to give no special scheduling treatment to conference games; blank is not zero.' },
      { key: 'nonConferenceGames', label: 'Games vs. Each Non-Conference Opponent',
        type: 'optnum', min: 0, max: 12, step: 1, def: '', applied: true,
        dependsOn: { key: 'autoBalanceSchedule', value: false },
        help: 'Number of games played against each team outside your conference. Leave blank to let the schedule generator determine these matchups automatically.' },
    ],
  },
  {
    id: 'schedHomeAway', label: 'Schedule — Home & Away',
    settings: [
      { key: 'homeAwayBalance', label: 'Home/Away Balance', type: 'choice',
        options: ['Balanced', 'Mostly Balanced', 'Random'], def: 'Balanced', applied: true,
        help: 'Balanced splits every team\u2019s games as evenly as the arithmetic allows \u2014 with an odd number of games the best possible is a one-game difference. Random lets the split fall where it falls.' },
      { key: 'maxConsecutiveHome', label: 'Max Consecutive Home Games', type: 'number',
        min: 1, max: 15, step: 1, def: 6, applied: true,
        help: 'The longest homestand the generator will build.' },
      { key: 'maxConsecutiveAway', label: 'Max Consecutive Road Games', type: 'number',
        min: 1, max: 15, step: 1, def: 6, applied: true,
        help: 'The longest road trip the generator will build. This is what stops a league producing a fifteen-game road trip.' },
      { key: 'roadTripFrequency', label: 'Road Trip Frequency', type: 'choice',
        options: ['Rare', 'Normal', 'Frequent'], def: 'Normal', applied: true,
        help: 'How willingly the generator strings road games together rather than alternating. Frequent produces recognisable trips and homestands; Rare keeps games alternating.' },
    ],
  },
  {
    id: 'schedRest', label: 'Schedule — Rest & Back-to-Backs',
    settings: [
      // A back-to-back is a SET, not a pair of games: Monday plus Tuesday is
      // one back-to-back, and a team on 14 plays on consecutive days about
      // fourteen times. The old Rare/Normal/Frequent dropdown could not say
      // that, and could not be checked against a finished schedule; a number
      // can be, and the summary under the preview does exactly that.
      { key: 'b2bTarget', label: 'Average Back-to-Backs Per Team', type: 'number',
        min: 0, max: 60, step: 1, def: 14, applied: true,
        help: 'Target average number of back-to-back sets each team will play during the regular season. Individual teams may finish above or below this number.' },
      { key: 'b2bVariance', label: 'Back-to-Back Variance', type: 'number',
        min: 0, max: 20, step: 1, def: 2, applied: true,
        help: 'Controls how far individual teams may vary from the league\u2019s target number of back-to-backs. A target of 14 with a variance of 2 asks for every team between 12 and 16.' },
      { key: 'b2bScaleWithSeason', label: 'Scale With Season Length', type: 'toggle',
        def: true, applied: true,
        help: 'Scales the target with the number of regular-season games, taking 14 in an 82-game season as the reference. A 41-game season then targets about 7. Turn this off to hold the number you typed whatever the season length.' },
      { key: 'allowThreeInThree', label: 'Allow 3 Games in 3 Days', type: 'toggle',
        def: false, applied: true,
        help: 'Three consecutive game days is a harder ask than a back-to-back, so it is governed separately. Off means a team is never scheduled on three days running, however many back-to-backs the target allows.' },
      { key: 'minRestDays', label: 'Minimum Rest Between Games', type: 'choice',
        options: ['No Minimum', '1 Day', '2 Days', 'Custom'], def: 'No Minimum', applied: true,
        help: 'Days off a team is guaranteed between games. Anything above No Minimum rules back-to-backs out entirely, and needs a long enough season to fit.' },
      { key: 'minRestCustom', label: 'Minimum Rest (Custom)', type: 'number',
        min: 0, max: 7, step: 1, def: 2, applied: true,
        dependsOn: { key: 'minRestDays', value: 'Custom' },
        help: 'Your own minimum, in days off between games.' },
      { key: 'maxDaysWithoutGame', label: 'Maximum Days Without a Game', type: 'number',
        min: 2, max: 30, step: 1, def: 7, applied: true,
        help: 'Stops a team disappearing from the schedule for weeks. The generator favours whoever has been idle longest, so this is a ceiling it works to rather than a guarantee it can always meet.' },
    ],
  },
  {
    id: 'gameRules', label: 'Game Rules',
    settings: [
      // The Rotations screen hands out five players' worth of this, so a
      // forty-minute league has 200 minutes to give rather than 240. Nothing
      // assumes the number.
      { key: 'gameMinutes', label: 'Game Length (Minutes)', type: 'number',
        min: 20, max: 60, step: 1, def: 48, applied: true,
        help: 'How long a game runs. Rotations allocate five players\u2019 worth of this \u2014 48 minutes gives 240 to distribute, 40 gives 200.' },
    ],
  },
  {
    id: 'postseason', label: 'Playoffs',
    settings: [
      // The standings screen draws two lines with these, and both are clamped
      // to the size of the group they are drawn in — a six-team conference
      // cannot send eight clubs to the playoffs.
      { key: 'playoffBerths', label: 'Guaranteed Playoff Seeds', type: 'number',
        min: 0, max: 16, step: 1, def: 6, applied: true,
        help: 'How many seeds in each group qualify outright. On the Standings screen these are the teams above the green line.' },
      { key: 'playInSlots', label: 'Play-In Seeds', type: 'number',
        min: 0, max: 8, step: 1, def: 4, applied: true,
        help: 'How many seeds below the guaranteed ones compete for the remaining places. Set it to zero for a league with no play-in.' },
    ],
  },
  {
    id: 'schedPreseason', label: 'Schedule — Preseason',
    settings: [
      { key: 'preseason', label: 'Preseason', type: 'toggle', def: true, applied: true,
        help: 'Exhibition games in the weeks before opening night. They appear on their own tab in the Schedule screen and never count towards records, standings or any rating \u2014 they are kept in a separate fixture list precisely so they cannot.' },
      { key: 'preseasonGamesPerTeam', label: 'Preseason Games Per Team', type: 'number',
        min: 4, max: 8, step: 1, def: 4, applied: true,
        dependsOn: { key: 'preseason', value: true },
        help: 'The usual number of exhibition games a club plays. Four is the common case; four is also the floor and eight the ceiling. The league-wide total follows from this and the size of the league rather than being set separately.' },
      { key: 'preseasonVariance', label: 'Preseason Variance', type: 'number',
        min: 0, max: 4, step: 1, def: 1, applied: true,
        dependsOn: { key: 'preseason', value: true },
        help: 'How far individual clubs vary from that number. Zero gives every club the same slate, which no real preseason has.' },
      { key: 'preseasonWindow', label: 'Preseason Length (Days)', type: 'number',
        min: 3, max: 45, step: 1, def: 14, applied: true,
        dependsOn: { key: 'preseason', value: true },
        help: 'How many days the exhibition window runs for, counting back from the day before opening night. The window always ends a clear day before the season starts, so nobody opens the season on no rest.' },
    ],
  },
  {
    id: 'schedSpecial', label: 'Schedule — Special Dates',
    settings: [
      { key: 'allStarBreak', label: 'All-Star Break', type: 'toggle', def: true, applied: true,
        help: 'Blocks out a mid-season stretch with no regular-season games on it.' },
      { key: 'allStarBreakDate', label: 'All-Star Break Date', type: 'monthday',
        def: '02-14', applied: true, after: 'seasonStart',
        dependsOn: { key: 'allStarBreak', value: true },
        help: 'The day the break starts.' },
      { key: 'allStarBreakLength', label: 'Break Length (Days)', type: 'number',
        min: 1, max: 14, step: 1, def: 5, applied: true,
        dependsOn: { key: 'allStarBreak', value: true },
        help: 'How many days the break runs. Those dates carry no games at all.' },
      { key: 'openingNight', label: 'Opening Night', type: 'toggle', def: true, applied: true,
        help: 'Marks the season\u2019s first date as opening night. Nothing yet treats it differently on the ice, but the schedule records it.' },
      { key: 'holidayGames', label: 'Holiday Games', type: 'toggle', def: true, applied: true,
        help: 'Guarantees games are scheduled on the calendar\u2019s notable dates inside the season window rather than leaving them empty.' },
      { key: 'rivalryGames', label: 'Rivalry Games', type: 'toggle', def: true, applied: false,
        help: 'Would place division rivals on marquee dates. There is no rivalry system in the save yet, so this is recorded and not acted on.' },
      { key: 'seasonFinale', label: 'Season Finale', type: 'toggle', def: true, applied: true,
        help: 'Marks the season\u2019s last date as the finale.' },
    ],
  },
  {
    id: 'schedAdvanced', label: 'Schedule — Advanced',
    settings: [
      { key: 'scheduleStyle', label: 'Schedule Style', type: 'choice',
        options: ['Balanced', 'Realistic', 'Compressed', 'Relaxed', 'Custom'],
        def: 'Balanced', applied: true,
        help: 'A shortcut that sets the rest, back-to-back and road-trip rules together. Balanced spaces games evenly; Realistic allows back-to-backs, trips and homestands; Compressed packs a season into a short calendar; Relaxed adds rest. Custom leaves every rule exactly as you set it.' },
      // Blank means Auto — derived from the target and variance. An explicit
      // number overrides that, which is the whole point of putting them here
      // rather than beside the target: they are the escape hatch, not the dial.
      { key: 'b2bMin', label: 'Minimum Back-to-Backs Per Team', type: 'optnum',
        min: 0, max: 60, step: 1, def: '', applied: true,
        help: 'Leave blank for Auto, which is the target minus the variance. Set a number to pin the floor yourself.' },
      { key: 'b2bMax', label: 'Maximum Back-to-Backs Per Team', type: 'optnum',
        min: 0, max: 60, step: 1, def: '', applied: true,
        help: 'Leave blank for Auto, which is the target plus the variance. Set a number to pin the ceiling yourself.' },
      { key: 'scheduleVariation', label: 'Schedule Variation', type: 'choice',
        options: ['Low', 'Normal', 'High'], def: 'Normal', applied: true,
        help: 'How much the generator shuffles dates, opponent order and trips. Every season regenerates regardless, so no two are identical; this controls how far apart they are.' },
      { key: 'scheduleSeed', label: 'Schedule Seed', type: 'text', def: '', applied: true,
        help: 'Leave blank to derive the seed from the league. Enter your own and the same seed with the same league and settings reproduces exactly the same schedule.' },
    ],
  },
  {
    id: 'development', label: 'Development',
    settings: [
      { key: 'dynamicDevelopment', label: 'Dynamic Player Development', type: 'toggle',
        def: true, applied: false,
        help: 'Development varies player to player instead of following a fixed curve. Takes effect once seasons are simulated.' },
      { key: 'developmentVariance', label: 'Development Variance', type: 'choice',
        options: ['Low', 'Normal', 'High'], def: 'Normal', applied: true,
        help: 'How unpredictable growth is. High produces more breakouts, more stalled prospects and more late bloomers. Applied now to how far potential can sit above current ability.' },
      { key: 'ageDecline', label: 'Age-Based Decline', type: 'toggle',
        def: true, applied: false,
        help: 'Players decline with age, at different rates rather than identically. Takes effect once seasons are simulated.' },
      { key: 'potentialVisibility', label: 'Potential Visibility', type: 'choice',
        options: ['Exact', 'Range', 'Scouted'], def: 'Range', applied: true,
        help: 'How potential is shown. Exact: 84. Range: 80-87. Scouted: a star rating. Potential is a plausible ceiling, never a promise — Range and Scouted show it honestly as an estimate.' },
    ],
  },
  {
    id: 'mental', label: 'Mental & Personality',
    settings: [
      { key: 'mentalAttributes', label: 'Mental Attributes', type: 'toggle',
        def: true, applied: true,
        help: 'Resilience, Concentration, Confidence, Composure and Coachability. They govern how a player handles pressure, mistakes and coaching. They never affect Overall — switching them off removes the layer, it does not change anyone’s rating.' },
      { key: 'personalityTraits', label: 'Personality Traits', type: 'toggle',
        def: true, applied: true,
        help: 'Loyal, Ambitious, Ego-Driven, Mentor and twenty others. Personality governs off-court behaviour and how difficult a player is to manage. It never affects Overall.' },
      { key: 'dynamicPriorities', label: 'Dynamic Career Priorities', type: 'toggle',
        def: true, applied: true,
        help: 'What a player currently wants — minutes, money, a ring, stability — recomputed from their traits, age and standing, so it moves as their career does. Requires Personality Traits.' },
    ],
  },
  {
    id: 'behavior', label: 'Player Behavior',
    settings: [
      { key: 'playerMorale', label: 'Player Morale', type: 'toggle', def: true, applied: true,
        help: 'Players carry a morale rating that responds to their situation.' },
      { key: 'playerRelationships', label: 'Player Relationships', type: 'toggle', def: true, applied: false,
        help: 'Bonds with teammates, coaches and the organisation, built through what actually happens. Needs an event system; nothing populates them yet.' },
      { key: 'tradeRequests', label: 'Trade Requests', type: 'toggle', def: true, applied: false,
        help: 'A persistently unhappy player may ask to be moved. Dissatisfaction raises the probability — it never triggers a request on its own. Needs a season simulator.' },
      { key: 'canRefuseNegotiations', label: 'Players Can Refuse Negotiations', type: 'toggle',
        def: true, applied: false,
        help: 'An unhappy player may decline to extend or may test free agency. Again a probability, never automatic. Needs contract negotiation, which is not built.' },
    ],
  },
  {
    id: 'finances', label: 'Finances',
    settings: [
      { key: 'salaryCapType', label: 'Salary Cap Type', type: 'choice',
        options: ['Soft', 'Hard', 'None'], def: 'Soft', applied: true,
        help: 'Soft: teams may exceed the cap, with restrictions on what they can do while over. Hard: the cap cannot be crossed at all. None: no cap. Generated payrolls respect the choice — under Hard nobody starts over the line.' },
      { key: 'salaryCap', label: 'Salary Cap ($M)', type: 'number',
        def: 140, min: 20, max: 500, step: 1, applied: true,
        help: 'The team payroll limit. Generated rosters are priced against it, so raising it makes contracts larger across the league rather than just moving a line on a chart.' },
      { key: 'minPayroll', label: 'Minimum Payroll ($M)', type: 'number',
        def: 126, min: 0, max: 500, step: 1, applied: true,
        help: 'The least a team may spend. Generated payrolls are held at or above it, so no club starts the league below the floor.' },
      { key: 'luxuryTaxThreshold', label: 'Luxury Tax Threshold ($M)', type: 'number',
        def: 170, min: 0, max: 800, step: 1, applied: false,
        help: 'Payroll above this line is taxed. Stored now; the bill is charged once seasons are simulated and finances run.' },
      { key: 'luxuryTaxRate', label: 'Luxury Tax Rate ($ per $1 over)', type: 'number',
        def: 1.5, min: 0, max: 10, step: 0.1, applied: false,
        help: 'What each dollar above the threshold costs the owner. 1.5 means $1.50 of tax per $1 over. Needs season finances.' },
      { key: 'teamBudgets', label: 'Team Budgets', type: 'toggle', def: true, applied: true,
        help: 'Owners set a spending budget separate from the cap, so a wealthy small-market owner can outspend a frugal large-market one. Off removes budgets entirely.' },
      { key: 'tradeSalaryMatch', label: 'Trade Salary Match (%)', type: 'number',
        def: 125, min: 100, max: 300, step: 5, applied: false,
        dependsOn: { key: 'salaryCapType', value: 'Soft' },
        help: 'Soft cap only. A team already over the cap cannot take back more than this share of the salary it sends out — 125% means $10M out can bring at most $12.5M back. It stops clubs already over the cap from going much further over. Meaningless under a Hard cap (which cannot be crossed) or None (which has no line), and needs the trade system.' },
    ],
  },
  {
    id: 'contracts', label: 'Contracts',
    settings: [
      { key: 'minSalary', label: 'Minimum Salary ($M)', type: 'number',
        def: 1.2, min: 0.2, max: 10, step: 0.1, applied: true,
        help: 'The least a standard contract can pay.' },
      { key: 'maxSalary', label: 'Maximum Player Salary ($M)', type: 'number',
        def: 50, min: 10, max: 150, step: 0.5, applied: true,
        help: 'What a 99-overall player commands. Salaries scale superlinearly toward this, so the gap between 85 and 90 costs far more than 65 to 70.' },
      { key: 'minContractLength', label: 'Minimum Contract Length (years)', type: 'number',
        def: 1, min: 1, max: 8, applied: true,
        help: 'The shortest deal that can be signed. Contracts shorter than a season are not supported, so 1 is the floor. Raising it forces longer commitments across the league.' },
      { key: 'maxContractLength', label: 'Maximum Contract Length (years)', type: 'number',
        def: 5, min: 1, max: 8, applied: true,
        help: 'The longest deal that can be signed.' },
    ],
  },
  {
    id: 'rookies', label: 'Rookie Contracts',
    settings: [
      { key: 'rookieScale', label: 'Rookie Salary Scale', type: 'toggle', def: true, applied: false,
        help: 'Drafted players sign a fixed scale by pick rather than negotiating. Applies when the draft is played.' },
      { key: 'firstPickPercent', label: '#1 Pick Salary — % of Maximum', type: 'number',
        def: 25, min: 5, max: 100, applied: false,
        help: 'What the first pick earns as a share of the maximum salary. Later picks slide down from here.' },
      { key: 'scaledRounds', label: 'Rounds Paid Above Minimum', type: 'number',
        def: 1, min: 0, max: 2, applied: false,
        help: 'How many draft rounds get scale money. Picks in later rounds sign for the minimum.' },
      { key: 'round1Years', label: 'Round 1 Contract Length (years)', type: 'number',
        def: 3, min: 1, max: 5, applied: false,
        help: 'How long a first-round rookie deal runs.' },
      { key: 'round2Years', label: 'Round 2 Contract Length (years)', type: 'number',
        def: 2, min: 1, max: 5, applied: false,
        help: 'How long a second-round rookie deal runs.' },
      { key: 'refuseAfterRookie', label: 'Can Refuse After Rookie Contract', type: 'toggle',
        def: true, applied: false,
        help: 'A player finishing a rookie deal may decline to re-sign. Needs contract negotiation.' },
    ],
  },
];

/**
 * Is a setting relevant given the rest? Trade Salary Match only means anything
 * under a soft cap: a hard cap cannot be crossed, and None has no line to be
 * over. The screen disables an irrelevant setting and says why rather than
 * hiding it, so the reason is visible.
 */
export function isRelevant(setting, settings) {
  const dep = setting.dependsOn;
  if (!dep) return true;
  return settings[dep.key] === dep.value;
}

/** Flat lookup for validation. */
export const ALL_SETTINGS = GROUPS.flatMap((g) => g.settings);
const BY_KEY = Object.fromEntries(ALL_SETTINGS.map((s) => [s.key, s]));

/** Minimum days off between games, resolved from the choice plus its custom. */
export function restDaysOf(settings) {
  const map = { 'No Minimum': 0, '1 Day': 1, '2 Days': 2 };
  const v = settings && settings.minRestDays;
  if (v === 'Custom') return Number(settings.minRestCustom) || 0;
  return map[v] != null ? map[v] : 0;
}

/**
 * The back-to-back rules, resolved from the five settings that govern them.
 *
 * ONE RESOLVER, so the settings screen, the validator, the generator and the
 * summary under the preview cannot drift apart — every one of them reads this
 * rather than re-deriving the arithmetic and getting it slightly different.
 *
 * A back-to-back is a SET: Monday plus Tuesday is one. The target is a league
 * AVERAGE, never a quota — a league on 14 is expected to contain teams on 12
 * and teams on 16, and forcing every club onto the same number would be a
 * flatter, less believable season than the one asked for.
 *
 * @param {object} settings
 * @param {number} [gamesPerTeam]  the real per-team game count, when known;
 *   falls back to the regular-season setting.
 */
export const B2B_REFERENCE = { games: 82, target: 14 };

export function backToBackRules(settings, gamesPerTeam) {
  const s = settings || {};
  const rest = restDaysOf(s);
  const games = Number(gamesPerTeam) > 0
    ? Number(gamesPerTeam)
    : (Number(s.regularSeasonGames) || B2B_REFERENCE.games);

  // Scaling takes 14 in 82 games as the reference, so a half-length season
  // targets about half as many. Rounding is to the nearest whole set, because
  // half a back-to-back is not a thing a schedule can contain.
  const typed = Math.max(0, Number(s.b2bTarget) || 0);
  const scaled = s.b2bScaleWithSeason === false
    ? typed
    : Math.round(typed * (games / B2B_REFERENCE.games));
  // A guaranteed rest day means no consecutive games at all, whatever was typed.
  const target = rest >= 1 ? 0 : scaled;
  const variance = rest >= 1 ? 0 : Math.max(0, Number(s.b2bVariance) || 0);

  // Blank means Auto: the band is the target either side of the variance.
  const autoMin = Math.max(0, target - variance);
  const autoMax = target + variance;
  const minSet = s.b2bMin !== '' && s.b2bMin != null && Number.isFinite(Number(s.b2bMin));
  const maxSet = s.b2bMax !== '' && s.b2bMax != null && Number.isFinite(Number(s.b2bMax));
  let min = minSet ? Math.max(0, Number(s.b2bMin)) : autoMin;
  let max = maxSet ? Math.max(0, Number(s.b2bMax)) : autoMax;
  if (min > max) min = max;

  return {
    target, variance, min, max, games,
    // Three in three is its own rule. Off caps a run at two games — one
    // back-to-back — and on allows a third night. A guaranteed rest day caps
    // it at one game, which is what "no back-to-backs" means.
    maxConsecutiveGames: rest >= 1 ? 1 : (s.allowThreeInThree ? 3 : 2),
    allowThreeInThree: rest >= 1 ? false : !!s.allowThreeInThree,
    minRestDays: rest,
    scaled: s.b2bScaleWithSeason !== false && games !== B2B_REFERENCE.games,
    typed,
    autoMin: minSet ? null : autoMin,
    autoMax: maxSet ? null : autoMax,
  };
}

/** Weekly game target, resolved from the choice plus its custom. */
export function gamesPerWeekOf(settings) {
  const map = { Light: 2.5, Normal: 3.5, Heavy: 4.5 };
  const v = settings && settings.gamesPerWeek;
  if (v === 'Custom') return Number(settings.gamesPerWeekCustom) || 3.5;
  return map[v] != null ? map[v] : 3.5;
}

/** A fresh set of defaults. */
export function defaults() {
  return Object.fromEntries(ALL_SETTINGS.map((s) => [s.key, s.def]));
}

/**
 * Coerce anything into a valid settings object: unknown keys dropped, numbers
 * clamped, choices checked, missing keys defaulted. Everything that reads
 * settings goes through this, so a hand-edited or older preset cannot put the
 * generator into an impossible state.
 */
export function normalize(raw) {
  const out = defaults();
  for (const [k, v] of Object.entries(raw || {})) {
    const def = BY_KEY[k];
    if (!def) continue;
    if (def.type === 'toggle') out[k] = Boolean(v);
    else if (def.type === 'choice') out[k] = def.options.includes(v) ? v : def.def;
    else if (def.type === 'number') {
      const n = Number(v);
      out[k] = Number.isFinite(n) ? Math.max(def.min, Math.min(def.max, n)) : def.def;
    } else if (def.type === 'optnum') {
      // Blank is a real value here and must survive: it means "no special
      // treatment", which is a different instruction from zero games.
      if (v === '' || v == null) out[k] = '';
      else {
        const n = Number(v);
        out[k] = Number.isFinite(n) ? Math.max(def.min, Math.min(def.max, Math.round(n))) : '';
      }
    } else if (def.type === 'monthday') {
      // MM-DD, and a real day of a real month. Anything else falls back rather
      // than reaching the generator as a date that does not exist.
      const m = /^(\d{2})-(\d{2})$/.exec(String(v || ''));
      const mo = m && Number(m[1]), da = m && Number(m[2]);
      const ok = m && mo >= 1 && mo <= 12 && da >= 1
        && da <= new Date(Date.UTC(2001, mo, 0)).getUTCDate();
      out[k] = ok ? v : def.def;
    } else if (def.type === 'text') {
      out[k] = String(v == null ? '' : v).slice(0, 64);
    }
  }
  // Cross-setting rules that a per-field clamp cannot express.
  if (out.minRosterSize > out.maxRosterSize) out.minRosterSize = out.maxRosterSize;
  if (out.minSalary > out.maxSalary) out.minSalary = Math.min(out.minSalary, out.maxSalary);
  if (out.minContractLength > out.maxContractLength) out.minContractLength = out.maxContractLength;
  // A floor above the cap, or a tax line below it, would be incoherent.
  if (out.minPayroll > out.salaryCap) out.minPayroll = out.salaryCap;
  if (out.luxuryTaxThreshold < out.salaryCap) out.luxuryTaxThreshold = out.salaryCap;
  // Priorities are derived from traits, so they cannot outlive them.
  if (!out.personalityTraits) out.dynamicPriorities = false;
  // A minimum rest of a day or more rules out back-to-backs by definition, so
  // the target cannot disagree with it on screen.
  if (restDaysOf(out) >= 1) {
    out.b2bTarget = 0;
    out.b2bVariance = 0;
    out.allowThreeInThree = false;
  }
  // An explicit floor above an explicit ceiling is incoherent; the floor gives.
  if (out.b2bMin !== '' && out.b2bMax !== '' && out.b2bMin > out.b2bMax) {
    out.b2bMin = out.b2bMax;
  }
  // A ceiling below the floor is incoherent.
  if (out.maxDaysWithoutGame <= restDaysOf(out)) {
    out.maxDaysWithoutGame = restDaysOf(out) + 2;
  }
  return out;
}

/* --------------------------- working copy (localStorage) ------------------ */
const KEY = 'hd.gameSettings';

export function loadSettings() {
  try { return normalize(JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch (_) { return defaults(); }
}

export function saveSettings(settings) {
  try { localStorage.setItem(KEY, JSON.stringify(normalize(settings))); return true; }
  catch (err) { console.warn('Could not store settings:', err); return false; }
}

/* ------------------------------- presets --------------------------------- */
/* Stored in the same IndexedDB store as League Presets but under a distinct
   id prefix, so rules presets and league presets never collide. */

export async function listRulePresets() {
  const rows = await getAllData(PRESET_STORE);
  return rows
    .filter((r) => String(r.key).startsWith(PRESET_PREFIX))
    .map((r) => ({ id: r.key, name: r.value.name, savedAt: r.value.savedAt }))
    .sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
}

export async function saveRulePreset(name, settings, existingId) {
  const id = existingId || PRESET_PREFIX + Date.now().toString(36);
  await saveData(PRESET_STORE, id, {
    name: String(name || 'Untitled rules').slice(0, 48),
    settings: normalize(settings),
    savedAt: new Date().toISOString(),
  });
  return id;
}

export async function getRulePreset(id) {
  const row = await loadData(PRESET_STORE, id);
  return row ? { ...row, settings: normalize(row.settings) } : null;
}

export async function deleteRulePreset(id) { await deleteData(PRESET_STORE, id); }

/* ------------------------ turning settings into numbers ------------------- */

/**
 * How the generation settings translate into the talent curve. Kept here so
 * the settings screen and the generator agree by construction.
 */
export function generationTuning(settings) {
  const s = normalize(settings);
  const level = { Low: -3.2, Normal: 0, High: +3.2, Custom: 0 }[s.talentLevel] ?? 0;
  const variance = { Low: 0.72, Normal: 1, High: 1.38 }[s.talentVariance] ?? 1;
  const generational = { 'Extremely Rare': 1, Rare: 3.5, Occasional: 9 }[s.generationalFrequency] ?? 1;
  const devVariance = { Low: 0.65, Normal: 1, High: 1.5 }[s.developmentVariance] ?? 1;
  return {
    meanShift: level, spreadScale: variance, generationalScale: generational, devVariance,
    // Passed straight through: the generator draws each player's gender from
    // these, and nothing about them reaches the talent curve.
    playerGender: s.playerGender, genderSplit: s.genderSplit,
  };
}

/** Format a potential for display, honouring Potential Visibility. */
export function formatPotential(potential, overall, mode) {
  if (typeof potential !== 'number') return { text: '—', title: '' };
  if (mode === 'Exact') return { text: String(potential), title: 'Exact potential' };
  if (mode === 'Scouted') {
    // Stars describe the ceiling, not the current player.
    const stars = potential >= 88 ? 5 : potential >= 80 ? 4 : potential >= 72 ? 3 : potential >= 64 ? 2 : 1;
    return {
      text: '★'.repeat(stars) + '☆'.repeat(5 - stars),
      title: `Scouted ceiling: ${stars} of 5 stars`,
    };
  }
  // Range: widen with the distance still to travel, because a ceiling far off
  // is a worse guess than one a player is nearly at.
  const gap = Math.max(0, potential - (overall || potential));
  const pad = Math.max(2, Math.round(2 + gap * 0.35));
  const lo = Math.max(overall || 0, potential - pad);
  const hi = Math.min(99, potential + pad);
  return { text: `${lo}–${hi}`, title: 'Estimated ceiling, not a guarantee' };
}
