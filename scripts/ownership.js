/* ==========================================================================
   HOOPS DYNASTY — ownership (structured, deterministic generation)

   buildOwner(base, team, context) turns an entry from data/owners.js into
   the owner record stored in a dynasty save: personality, traits,
   confidence in the GM (starts at 75), season / financial / long-term
   objectives and a personalized welcome message. Everything is template
   driven: team tier × personality × spending × market. No external AI.

   Objectives carry optional `metric` targets so a future evaluation system
   can score them; nothing evaluates or fires anyone yet.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var node = typeof module === 'object' && module.exports;
  var api = factory(node ? require('./random.js') : root.HDRandom);
  if (node) module.exports = api;
  else root.HDOwnership = api;
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';

  var INITIAL_CONFIDENCE = 75;

  var TIERS = {
    contender:  { label: 'Championship Contender', min: 86, targetWins: 55 },
    playoff:    { label: 'Playoff-Caliber Team',   min: 79, targetWins: 46 },
    middle:     { label: 'Middle of the Pack',     min: 71, targetWins: 38 },
    rebuilding: { label: 'Rebuilding Team',        min: 0,  targetWins: 28 }
  };

  function tierFor(overall) {
    if (overall >= TIERS.contender.min) return 'contender';
    if (overall >= TIERS.playoff.min) return 'playoff';
    if (overall >= TIERS.middle.min) return 'middle';
    return 'rebuilding';
  }

  function confidenceLabel(value) {
    if (value >= 85) return 'Very Confident';
    if (value >= 70) return 'Confident';
    if (value >= 50) return 'Uncertain';
    if (value >= 25) return 'Concerned';
    return 'Losing Faith';
  }

  function spendingLabel(value) {
    if (value >= 75) return 'High';
    if (value >= 50) return 'Moderate';
    if (value >= 35) return 'Cautious';
    return 'Conservative';
  }

  function o(id, text, metric) {
    var obj = { id: id, text: text };
    if (metric) obj.metric = metric;
    return obj;
  }

  /* --- Season objectives ---------------------------------------------- */
  // Win targets are written for 82 games; scale to the league's season.
  function winTarget(tier, ctx, bonus) {
    return Math.round((TIERS[tier].targetWins + (bonus || 0)) * (ctx.seasonGames || 82) / 82);
  }

  function seasonObjectives(tier, personality, ctx) {
    var conf = ctx.conferenceName;
    var base = {
      contender: [
        o('compete-title', 'Compete for a championship.', { type: 'playoff-round', reach: 'finals' }),
        o('top-seed', 'Finish among the top two seeds in the ' + conf + '.', { type: 'conference-seed', max: 2 }),
        o('stay-competitive', 'Maintain a competitive roster all season.')
      ],
      playoff: [
        o('make-playoffs', 'Qualify for the playoffs.', { type: 'playoffs', made: true }),
        o('improve-roster', 'Improve roster competitiveness.'),
        o('home-court', 'Push for home-court advantage in the first round.', { type: 'conference-seed', max: 4 })
      ],
      middle: [
        o('reach-play-in', 'Reach at least the play-in tournament.', { type: 'conference-seed', max: 10 }),
        o('winning-record', 'Finish with a winning record.', { type: 'win-pct', min: 0.5 }),
        o('identify-core', 'Identify which players belong in the long-term core.')
      ],
      rebuilding: [
        o('develop-players', 'Prioritize player development.'),
        o('acquire-young-talent', 'Acquire promising young talent.'),
        o('compete-nightly', 'Establish a competitive identity, even in losses.')
      ]
    }[tier].slice();

    // Personality adjustments make the same tier read differently.
    if (personality === 'demanding') {
      base[2] = o('win-target', 'Win at least ' + winTarget(tier, ctx) + ' games.', { type: 'wins', min: winTarget(tier, ctx) });
    } else if (personality === 'championship-driven' && tier !== 'contender') {
      base[2] = tier === 'rebuilding'
        ? o('show-progress', 'Show clear, measurable progress toward contention.', { type: 'wins', min: winTarget(tier, ctx, 6) })
        : o('win-series', 'Win a playoff series.', { type: 'playoff-round', reach: 'second-round' });
    } else if (personality === 'patient-builder' && tier !== 'rebuilding') {
      base[2] = o('develop-while-winning', 'Keep developing young players while competing.');
    } else if (personality === 'business-oriented') {
      base[2] = o('efficient-roster', 'Compete efficiently without overspending to do it.');
    }
    return base;
  }

  /* --- Financial expectations ----------------------------------------- */
  function financialExpectations(tier, personality, spending, ctx) {
    var list = [];
    if (spending >= 75) {
      list.push(tier === 'contender' || tier === 'playoff'
        ? o('tax-ok', 'Ownership will pay the luxury tax for a genuine contender.', { type: 'tax-allowed', value: true })
        : o('spend-smart', 'Spend aggressively when a move clearly improves the team.'));
    } else if (spending >= 50) {
      list.push(o('tax-justified', 'Stay below the luxury tax unless a move makes us a contender.', { type: 'tax-allowed', value: 'justified' }));
    } else {
      list.push(o('below-tax', 'Remain below the luxury tax threshold.', { type: 'tax-allowed', value: false }));
    }

    list.push({
      contender: o('no-waste', 'Avoid unnecessary financial commitments.'),
      playoff: o('flexibility', 'Maintain financial flexibility.'),
      middle: o('no-overpay', 'Don’t overpay to chase a middling playoff seed.'),
      rebuilding: o('efficient-payroll', 'Keep payroll efficient while the roster develops.')
    }[tier]);

    if (personality === 'business-oriented') list.push(o('profit', 'Operate at a profit and grow revenue in the ' + ctx.marketLabel.toLowerCase() + ' market.', { type: 'profit', min: 0 }));
    else if (personality === 'patient-builder') list.push(o('long-contracts', 'Avoid long contracts for declining veterans.'));
    else if (personality === 'demanding') list.push(o('return-on-spend', 'Every major contract must deliver on the floor.'));
    else if (personality === 'championship-driven') list.push(o('spend-to-win', 'Resources are available when they help win now.'));
    else list.push(o('balanced-books', 'Balance competitiveness with financial stability.'));
    return list;
  }

  /* --- Long-term objectives ------------------------------------------- */
  function longTermObjectives(tier, personality, ctx) {
    var byPersonality = {
      'championship-driven': [o('perennial-contender', 'Build a perennial championship contender.'), o('bring-title', 'Bring a championship to ' + ctx.city + '.', { type: 'championships', min: 1 })],
      'patient-builder': [o('draft-foundation', 'Build a sustainable foundation through the draft.'), o('homegrown-stars', 'Develop homegrown stars.')],
      'business-oriented': [o('sustainable-business', 'Build a financially sustainable franchise.'), o('grow-brand', 'Grow the franchise brand and fan base.')],
      'balanced': [o('consistent-playoffs', 'Become a consistent playoff team.', { type: 'playoff-streak', min: 3 }), o('healthy-books', 'Balance winning with long-term financial health.')],
      'demanding': [o('title-window', 'Win a championship within the next three seasons.', { type: 'championships', min: 1, withinSeasons: 3 }), o('winning-culture', 'Never accept a losing culture.')]
    }[personality];
    var byTier = {
      contender: o('sustain-window', 'Sustain contention as the core ages.'),
      playoff: o('next-tier', 'Turn a good team into a true contender.'),
      middle: o('clear-direction', 'Commit to a clear direction: contend or rebuild.'),
      rebuilding: o('sustainable-foundation', 'Build a sustainable foundation.')
    }[tier];
    var list = byPersonality.slice();
    if (!list.some(function (x) { return x.id === byTier.id; })) list.push(byTier);
    return list;
  }

  /* --- Welcome message -------------------------------------------------- */
  function welcomeMessage(base, team, tier, ctx, rng) {
    var gm = ctx.gmName;
    var p = base.personality;
    var opening = {
      'championship-driven': 'Welcome to the organization, ' + gm + '. You’re taking over the ' + team.fullName + ' at a moment that matters.',
      'patient-builder': 'Welcome to the organization, ' + gm + '. We’ve entrusted you with the responsibility of leading the ' + team.fullName + ' into a new chapter.',
      'business-oriented': 'Welcome aboard, ' + gm + '. The ' + team.fullName + ' are one of ' + team.city + '’s great institutions, on the court and off it.',
      'balanced': 'Welcome to the organization, ' + gm + '. We’ve entrusted you with the responsibility of leading the ' + team.fullName + ' into a new chapter.',
      'demanding': gm + ', welcome to the ' + team.fullName + '. I’ll be direct: I hired you to win.'
    }[p];
    var circumstance = {
      contender: rng.pick([
        'This roster is ready to compete for a title right now, and the rest of the ' + ctx.conferenceName + ' will measure itself against us.',
        'We have the talent to win a championship this season. The window is open, and windows don’t stay open forever.'
      ]),
      playoff: rng.pick([
        'We’re a playoff-caliber team, but being good isn’t the goal. I want to see us take the next step.',
        'The foundation for a winner is here. Your job is to turn a good team into a dangerous one.'
      ]),
      middle: rng.pick([
        'Right now we’re in the middle: good enough to beat anyone on a given night, not good enough to fool anyone over a season.',
        'This team has pieces, but not yet an identity. I need you to decide what we’re building toward.'
      ]),
      rebuilding: rng.pick([
        'I won’t pretend the roster is where it needs to be. What matters to me is the direction we’re heading.',
        'We’re early in this process. The decisions you make now will define this franchise for years.'
      ])
    }[tier];
    var authority = 'You will have the authority to make basketball decisions, but you will also be accountable for the direction of this organization.';
    var closing = {
      'championship-driven': 'I expect us to be playing deep into June.',
      'patient-builder': 'Take the time to do this right. I would rather build something that lasts than chase a quick fix.',
      'business-oriented': 'Spend wisely. Every dollar we commit should make us better on the floor or stronger as a business.',
      'balanced': 'I look forward to seeing what you can accomplish.',
      'demanding': 'Results matter here, and I’ll be watching closely.'
    }[p];
    return [opening, circumstance, authority, closing].join(' ');
  }

  /**
   * @param base     entry from data/owners.js
   * @param team     dynasty team record (id, city, fullName, overall, conference, marketSize)
   * @param context  { gmName, conferenceName, marketLabel, seed, isUserTeam }
   */
  function buildOwner(base, team, context) {
    var tier = tierFor(team.overall);
    var rng = R.rng('owner:' + context.seed + ':' + base.id);
    var ctx = {
      gmName: context.gmName,
      conferenceName: context.conferenceName,
      seasonGames: context.seasonGames,
      marketLabel: context.marketLabel,
      city: team.city
    };
    return {
      id: base.id,
      franchiseId: base.franchiseId,
      teamId: team.id,
      name: base.name,
      title: base.title,
      personality: base.personality,
      traits: { ambition: base.traits.ambition, patience: base.traits.patience, spending: base.traits.spending },
      portrait: { skin: base.portrait.skin, hair: base.portrait.hair, hairColor: base.portrait.hairColor, attire: base.portrait.attire },
      confidence: INITIAL_CONFIDENCE,
      // Hooks for future evaluation (season reviews, hot seat, firings).
      confidenceHistory: [],
      expectations: {
        tier: tier,
        season: seasonObjectives(tier, base.personality, ctx),
        financial: financialExpectations(tier, base.personality, base.traits.spending, ctx),
        longTerm: longTermObjectives(tier, base.personality, ctx)
      },
      // Only the user's owner addresses the user; CPU-team owners get null.
      welcomeMessage: context.isUserTeam ? welcomeMessage(base, team, tier, ctx, rng) : null
    };
  }

  /**
   * Season length changed: rescale the owner's win-count objectives to the
   * new number of games (other objectives and confidence are unchanged).
   */
  function rescaleWinTargets(owner, seasonGames) {
    var tier = owner.expectations && owner.expectations.tier;
    if (!TIERS[tier]) return owner;
    var ctx = { seasonGames: seasonGames };
    (owner.expectations.season || []).forEach(function (obj) {
      if (!obj.metric || obj.metric.type !== 'wins') return;
      if (obj.id === 'win-target') {
        obj.metric.min = winTarget(tier, ctx);
        obj.text = 'Win at least ' + obj.metric.min + ' games.';
      } else if (obj.id === 'show-progress') {
        obj.metric.min = winTarget(tier, ctx, 6);
      }
    });
    return owner;
  }

  return {
    rescaleWinTargets: rescaleWinTargets,
    INITIAL_CONFIDENCE: INITIAL_CONFIDENCE,
    TIERS: TIERS,
    tierFor: tierFor,
    confidenceLabel: confidenceLabel,
    spendingLabel: spendingLabel,
    buildOwner: buildOwner
  };
});
