'use strict';

/**
 * ownerLetter.js — the welcome letter, written from the save.
 *
 * WHAT MAKES THIS NOT BOILERPLATE. Every specific claim in the letter is read
 * off the league that was just created: how many championships the franchise
 * has, how interested its city is, how much money it has to spend relative to
 * everyone else, which division it plays in, how many players are under
 * contract. A club with three banners and a packed building is addressed
 * differently from an expansion side nobody has heard of, because those are
 * different jobs and the save already knows which one this is.
 *
 * The alternative — one letter with the club's name pasted in — would read the
 * same for every career, and would say things that are false about most of
 * them. "Restoring this proud franchise to the top" is a lie to a team that has
 * never won anything.
 *
 * WHAT IS NOT CLAIMED. The save has no owner, so nothing is signed by a named
 * person; the letter comes from the ownership group, which is a role rather
 * than an invented individual. There is no arena, no attendance figure, no
 * history beyond the championship count, and no promise about a season that
 * has not been played. Nothing here reports a result.
 *
 * Deterministic: the same career always gets the same letter.
 */

import { makeRNG, hashString } from './leagueConfig.js';

/** Champion-count bands, and how an owner talks about each. */
const HISTORY = [
  {
    when: (n) => n === 0,
    tag: 'No championships yet',
    line: (t) => `This franchise has never won a title. That is the plain fact of it, `
      + `and it is the reason the job exists. Nobody here is asking you to protect a `
      + `legacy — we are asking you to start one.`,
  },
  {
    when: (n) => n === 1,
    tag: 'One championship',
    line: (t) => `We have won once. One banner is enough to know what it feels like and `
      + `not nearly enough to be satisfied by it. The city remembers that season better `
      + `than it remembers most of what has happened since.`,
  },
  {
    when: (n) => n >= 2 && n <= 3,
    tag: (n) => `${n} championships`,
    line: (t, n) => `${n} championships sit in this building. That history is an asset `
      + `and a standard at the same time: it means people here know what a real team `
      + `looks like, and they will tell you when they are not watching one.`,
  },
  {
    when: (n) => n >= 4,
    tag: (n) => `${n} championships`,
    line: (t, n) => `${n} championships is a lot of history to be handed. You inherit `
      + `every expectation that comes with it. Around here a good season is not an `
      + `achievement, it is the minimum, and the room will let you know if you forget.`,
  },
];

/** How the city behaves, from the club's own fan interest. */
const FANS = {
  High: {
    tag: 'High fan interest',
    line: (city) => `${city} cares, loudly. That works for you and against you — the `
      + `building will carry a team that is trying, and it will turn on one that is not. `
      + `You will not have to manufacture urgency here. It arrives on its own.`,
  },
  Medium: {
    tag: 'Steady support',
    line: (city) => `${city} supports this team steadily rather than fanatically. That `
      + `buys you a little patience early, and it means winning is how you fill the `
      + `place rather than the other way round.`,
  },
  Low: {
    tag: 'Quiet building',
    line: (city) => `Attention in ${city} has thinned out. That is a problem and it is `
      + `also room to work: fewer people are watching the mistakes, and a team worth `
      + `watching brings them back faster than any campaign we could run.`,
  },
};

/** What the budget says, relative to the rest of the league. */
function moneyLine(rank, total, budget) {
  const top = rank <= Math.ceil(total / 3);
  const bottom = rank > total - Math.ceil(total / 3);
  const money = `$${Number(budget).toFixed(1)}M`;
  if (top) {
    return `You will be working with ${money}, which is among the healthier budgets in `
      + `the league. Money is not a plan, though — it removes an excuse rather than `
      + `supplying an answer, and we would rather you spent it late and well than early `
      + `and loudly.`;
  }
  if (bottom) {
    return `Our budget is ${money}, which is towards the bottom of the league. We are `
      + `not going to pretend otherwise. It means the margin for a bad contract is thin `
      + `and the draft matters more here than it does elsewhere.`;
  }
  return `Our budget is ${money}, which puts us in the middle of the league. Enough to `
    + `compete for the right player, not enough to buy your way out of a mistake.`;
}

/**
 * The letter for one career.
 *
 * @param {object} league  the freshly created save
 * @returns {null|object} null when the league has no user team to write to.
 */
export function ownerLetter(league) {
  const meta = (league && league.meta) || {};
  const team = (league.teams || []).find((t) => t.id === meta.userTeamId);
  if (!team) return null;

  const city = team.city || '';
  const nick = team.name || '';
  const full = `${city} ${nick}`.trim();
  const rng = makeRNG(hashString(`owner|${meta.rngSeed}|${team.id}`));

  const titles = Number(team.championships) || 0;
  const history = HISTORY.find((h) => h.when(titles)) || HISTORY[0];
  const fans = FANS[team.fanInterest] || FANS.Medium;

  // Budget rank across the league, so "well funded" is a comparison rather than
  // an assertion about a number nobody can place.
  const budgets = (league.teams || [])
    .map((t) => Number(t.budget) || 0).sort((a, b) => b - a);
  const rank = budgets.indexOf(Number(team.budget) || 0) + 1;

  // Where the club sits, read from the league's own structure — which may have
  // no conferences, no divisions, or eight of each.
  const structure = league.structure || {};
  const division = (structure.divisions || []).find((d) => d.id === team.divisionId) || null;
  const conference = division
    ? (structure.conferences || []).find((c) => c.id === division.conferenceId) || null
    : null;
  const place = division && conference ? `${division.name} Division of the ${conference.name}`
    : division ? `${division.name} Division`
      : conference ? String(conference.name) : null;
  // The chip sits in a narrow column, so it gets the short form. The letter
  // itself keeps the full phrase, where there is room to read it.
  const placeShort = division && conference ? `${division.name} \u00b7 ${conference.name}`
    : division ? String(division.name)
      : conference ? String(conference.name) : null;

  const roster = (league.players || []).filter((p) => p.teamId === team.id).length;

  const paragraphs = [
    `On behalf of everyone at the ${nick}, welcome to ${city}. You have basketball `
      + `operations from today — the roster, the staff, the draft, the cap sheet, all of `
      + `it. We hired you to make those calls, not to bring them to us.`,
    history.line(full, titles),
    fans.line(city),
    moneyLine(rank, budgets.length, team.budget),
    `You inherit ${roster} player${roster === 1 ? '' : 's'} under contract`
      + `${place ? ` and a schedule in the ${place}` : ''}. What you do with that is `
      + `yours. We will not be picking your lineup, and we will not be leaking to anyone `
      + `about it.`,
    rng.pick([
      `Build something that lasts longer than one good year. That is the whole brief.`,
      `We are not asking for a quick season. We are asking for a team worth keeping.`,
      `Take the long view. We will judge the plan before we judge the record.`,
    ]),
  ];

  return {
    team,
    eyebrow: 'A message from the ownership group',
    kicker: `Welcome to the`,
    headline: { city, nick },
    salutation: 'Dear General Manager,',
    paragraphs,
    signoff: `The ${nick} Ownership Group`,
    // Small factual chips for the chrome, so the panel around the letter
    // carries information instead of invented marketing copy.
    facts: [
      { label: 'Season', value: String(meta.currentSeason || '—') },
      { label: 'League', value: meta.leagueName || '—' },
      placeShort ? { label: 'Division', value: placeShort } : null,
      { label: 'Titles', value: typeof history.tag === 'function' ? history.tag(titles) : history.tag },
      { label: 'Support', value: fans.tag },
      { label: 'Budget', value: `$${Number(team.budget || 0).toFixed(1)}M · ${rank} of ${budgets.length}` },
      { label: 'Roster', value: `${roster} under contract` },
    ].filter(Boolean),
  };
}
