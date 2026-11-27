/* ==========================================================================
   HOOPS DYNASTY — player morale
   Morale (0–100) is evaluated from the save itself, so it always reflects
   the league as it stands:

     playing time & role     actual role (lineup / depth) vs the role the
                             player believes he has earned
     team success & hype     record once games are played; until then the
                             roster's strength relative to the league
     roster & trade moves    morale events recorded by future transactions
     focus & development     young players with upside want real minutes
     market & facilities     market size + ownership investment (the owner's
                             spending trait stands in for facilities)
     locker room             captain and personalities buffer / amplify
     off-court events        morale events (none are generated yet)
     temperament             a seeded personal baseline

   Stored in the save:
     player.personality       one of PERSONALITIES (seeded, never changes)
     save.morale = { captains: { teamId: playerId }, events: [event] }
       event = { id, playerId, teamId?, kind: 'roster'|'off-court', delta,
                 reason, date, expires? }   (published by future systems)

   Effects for systems that don't exist yet are exposed as functions:
     performanceModifiers()  confidence / consistency in games, incl. blowouts
     contractOutlook()       re-sign willingness, asking price, FA / trade risk
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var node = typeof module === 'object' && module.exports;
  var api = factory(node ? require('./random.js') : root.HDRandom, node ? require('./season.js') : root.HDSeason);
  if (node) module.exports = api;
  else root.HDMorale = api;
})(typeof self !== 'undefined' ? self : this, function (R, Season) {
  'use strict';

  var CONFIG = Object.freeze({
    BASE: 60,
    MIN: 3, MAX: 98,
    MOODS: [ // highest first
      { id: 'high', min: 70, label: 'Happy' },
      { id: 'mid',  min: 45, label: 'Content' },
      { id: 'low',  min: 0,  label: 'Unhappy' }
    ],
    TEMPERAMENT_SD: 7,
    ROTATION_SLOTS: 9,            // 5 starters + 4 regular rotation players
    VETERAN_AGE: 31
  });

  // sens: multipliers on factor groups; buffer < 1 calms swings, > 1 amplifies
  var PERSONALITIES = Object.freeze({
    'leader':       { label: 'Leader',       share: 8,  role: 0.85, team: 1.1, market: 0.7, dev: 1,   swing: 0.8,
      summary: 'Steadies the locker room; takes setbacks in stride.' },
    'professional': { label: 'Professional', share: 25, role: 0.7,  team: 1,   market: 0.6, dev: 0.9, swing: 0.8,
      summary: 'Accepts his role and prepares the same way every day.' },
    'competitor':   { label: 'Competitor',   share: 20, role: 1.1,  team: 1.5, market: 0.8, dev: 1,   swing: 1,
      summary: 'Lives and dies with winning.' },
    'easygoing':    { label: 'Easygoing',    share: 20, role: 0.8,  team: 0.8, market: 0.5, dev: 0.8, swing: 0.75,
      summary: 'Hard to rattle; happy almost anywhere.' },
    'spotlight':    { label: 'Spotlight',    share: 15, role: 1.3,  team: 1,   market: 2,   dev: 1.1, swing: 1.15,
      summary: 'Wants a featured role and a big stage.' },
    'volatile':     { label: 'Volatile',     share: 12, role: 1.3,  team: 1.2, market: 1,   dev: 1.2, swing: 1.35,
      summary: 'Big highs, bigger lows — and he lets everyone know.' }
  });
  var PERSONALITY_IDS = Object.keys(PERSONALITIES);

  var ROLES = ['reserve', 'bench', 'rotation', 'starter'];
  var ROLE_LABELS = { reserve: 'Reserve', bench: 'Bench', rotation: 'Rotation', starter: 'Starter' };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* --- personalities & captains ------------------------------------------- */

  function personalityFor(seed, playerId) {
    var r = R.rng('personality:' + seed + ':' + playerId);
    var total = PERSONALITY_IDS.reduce(function (s, k) { return s + PERSONALITIES[k].share; }, 0);
    var x = r.next() * total;
    for (var i = 0; i < PERSONALITY_IDS.length; i++) { x -= PERSONALITIES[PERSONALITY_IDS[i]].share; if (x <= 0) return PERSONALITY_IDS[i]; }
    return 'professional';
  }

  // Adds a personality to any player without one (never changes existing)
  function addPersonalities(players, seed) {
    (players || []).forEach(function (p) { if (!PERSONALITIES[p.personality]) p.personality = personalityFor(seed, p.id); });
    return players;
  }

  function captainScore(p) {
    var bonus = { leader: 30, professional: 12, competitor: 6, easygoing: 0, spotlight: -4, volatile: -30 }[p.personality] || 0;
    return bonus + p.overall * 0.5 + Math.min(p.experience || 0, 12) * 1.5;
  }

  function pickCaptain(players) {
    return players.slice().sort(function (a, b) { return captainScore(b) - captainScore(a) || a.id.localeCompare(b.id); })[0] || null;
  }

  function ensure(save) {
    if (!save.morale || typeof save.morale !== 'object') save.morale = { captains: {}, events: [] };
    if (!save.morale.captains) save.morale.captains = {};
    if (!Array.isArray(save.morale.events)) save.morale.events = [];
    addPersonalities(save.players, save.id);
    save.teams.forEach(function (t) {
      var roster = save.players.filter(function (p) { return p.teamId === t.id; });
      var cur = save.morale.captains[t.id];
      if (!cur || !roster.some(function (p) { return p.id === cur; })) {
        var c = pickCaptain(roster);
        if (c) save.morale.captains[t.id] = c.id; else delete save.morale.captains[t.id];
      }
    });
    return save.morale;
  }

  function setCaptain(save, teamId, playerId) {
    ensure(save);
    var p = save.players.filter(function (x) { return x.id === playerId && x.teamId === teamId; })[0];
    if (!p) return false;
    save.morale.captains[teamId] = playerId;
    return true;
  }

  /* --- roles -------------------------------------------------------------- */

  // What the player believes he has earned
  function expectedRole(p) {
    var i = p.overall >= 79 ? 3 : p.overall >= 72 ? 2 : p.overall >= 62 ? 1 : 0;
    if (p.age <= 23 && p.potential - p.overall >= 8 && i < 2) i = 2;            // wants development minutes
    if (p.personality === 'spotlight' && i < 3 && p.overall >= 74) i++;          // overrates his role
    if (p.personality === 'professional' && p.age >= CONFIG.VETERAN_AGE && i > 1 && p.overall < 76) i--;  // accepts a smaller role
    return ROLES[i];
  }

  // Role he actually has: lineup, then depth order by overall
  function actualRoles(save, teamId) {
    var roster = save.players.filter(function (p) { return p.teamId === teamId; });
    var lineup = (save.lineups || {})[teamId] || {};
    var starters = {};
    Object.keys(lineup).forEach(function (pos) { starters[lineup[pos]] = true; });
    var bench = roster.filter(function (p) { return !starters[p.id]; })
      .sort(function (a, b) { return b.overall - a.overall || a.id.localeCompare(b.id); });
    var out = {};
    roster.forEach(function (p) { if (starters[p.id]) out[p.id] = 'starter'; });
    var rotationSpots = CONFIG.ROTATION_SLOTS - Object.keys(starters).length;
    bench.forEach(function (p, i) { out[p.id] = i < rotationSpots ? 'rotation' : i < rotationSpots + 4 ? 'bench' : 'reserve'; });
    return out;
  }

  /* --- context shared by a team ------------------------------------------- */

  function teamContext(save, teamId) {
    ensure(save);
    var team = save.teams.filter(function (t) { return t.id === teamId; })[0];
    var roster = save.players.filter(function (p) { return p.teamId === teamId; });
    var st = save.standings && save.standings[teamId];
    var gp = st ? st.wins + st.losses : 0;
    var sorted = save.teams.map(function (t) { return t.overall; }).sort(function (a, b) { return b - a; });
    var rank = sorted.indexOf(team.overall);
    var percentile = save.teams.length > 1 ? 1 - rank / (save.teams.length - 1) : 0.5;
    var owner = (save.owners || []).filter(function (o) { return o.teamId === teamId; })[0];
    var captainId = save.morale.captains[teamId];
    var captain = roster.filter(function (p) { return p.id === captainId; })[0] || null;
    var volatileCount = roster.filter(function (p) { return p.personality === 'volatile'; }).length;
    return {
      team: team, roster: roster, roles: actualRoles(save, teamId),
      winPct: gp ? st.wins / gp : null, gamesPlayed: gp, percentile: percentile, rank: rank + 1,
      owner: owner, captain: captain, volatileCount: volatileCount
    };
  }

  /* --- evaluation ----------------------------------------------------------- */

  function moodFor(value) {
    if (typeof value !== 'number' || !isFinite(value)) return null;
    for (var i = 0; i < CONFIG.MOODS.length; i++) if (value >= CONFIG.MOODS[i].min) return CONFIG.MOODS[i];
    return CONFIG.MOODS[CONFIG.MOODS.length - 1];
  }

  /**
   * @returns { value, mood{id,label}, personality, expectedRole, role,
   *            captain(bool), factors: [{ id, label, impact, detail }] }
   */
  function evaluate(save, player, ctx) {
    ensure(save);
    ctx = ctx || teamContext(save, player.teamId);
    var P = PERSONALITIES[player.personality] || PERSONALITIES.professional;
    var factors = [];
    function add(id, label, impact, detail) { factors.push({ id: id, label: label, impact: impact, detail: detail }); }

    // Playing time & role
    var exp = expectedRole(player), act = ctx.roles[player.id] || 'reserve';
    var diff = ROLES.indexOf(act) - ROLES.indexOf(exp);
    var roleImpact = diff < 0 ? diff * 8 * P.role : diff > 0 ? Math.min(8, diff * 4) : 4;
    // Stars take a demotion much harder than fringe starters do
    if (diff < 0 && exp === 'starter') roleImpact -= Math.max(0, player.overall - 78) * 0.7 * P.role;
    add('role', 'Playing time & role', roleImpact,
      diff < 0 ? 'Expects a ' + ROLE_LABELS[exp].toLowerCase() + ' role; currently ' + ROLE_LABELS[act].toLowerCase() + '.'
        : diff > 0 ? 'Getting more than he expected: ' + ROLE_LABELS[act].toLowerCase() + '.'
        : 'Role matches expectations (' + ROLE_LABELS[act].toLowerCase() + ').');

    // Team success & hype
    var teamImpact, teamDetail;
    if (ctx.gamesPlayed > 0) {
      teamImpact = (ctx.winPct - 0.5) * 30;
      teamDetail = 'Team record ' + Math.round(ctx.winPct * 1000) / 1000 + ' win pct.';
    } else {
      teamImpact = ctx.percentile >= 0.85 ? 7 : ctx.percentile >= 0.6 ? 3 : ctx.percentile >= 0.3 ? 0 : -5;
      teamDetail = ctx.percentile >= 0.85 ? 'Preseason contender buzz.' : ctx.percentile >= 0.6 ? 'Expected playoff team.' : ctx.percentile >= 0.3 ? 'Middle-of-the-pack expectations.' : 'Low expectations this season.';
    }
    if (teamImpact < 0) teamImpact *= player.age >= 30 ? 1.5 : player.age <= 23 ? 0.5 : 1;
    add('team', 'Team success & hype', teamImpact * P.team, teamDetail);

    // Focus & development (young players with upside)
    if (player.age <= 24 && player.potential - player.overall >= 5) {
      var dev = ROLES.indexOf(act) >= 2;
      add('development', 'Focus & development', (dev ? 4 : -6) * P.dev, dev ? 'Developing with real minutes.' : 'Wants minutes to develop.');
    }

    // Market & facilities
    var mk = ctx.team.marketSize === 'large' ? 3 : ctx.team.marketSize === 'medium' ? 1 : -1;
    if (player.personality === 'easygoing' && mk < 0) mk = 1;
    var spend = ctx.owner && ctx.owner.traits ? (ctx.owner.traits.spending - 55) / 10 : 0;
    add('market', 'Market & facilities', mk * P.market + clamp(spend, -3, 3),
      (ctx.team.marketSize === 'large' ? 'Big market' : ctx.team.marketSize === 'medium' ? 'Mid-size market' : 'Small market') +
      '; ' + (spend >= 1 ? 'ownership invests heavily in facilities.' : spend <= -1 ? 'ownership is frugal with facilities.' : 'solid facilities.'));

    // Roster & trade moves, off-court events (recorded by future systems)
    var today = save.calendar.currentDate;
    var active = save.morale.events.filter(function (e) {
      return e.playerId === player.id && (!e.expires || Season.compareDates(e.expires, today) >= 0);
    });
    var roster = active.filter(function (e) { return e.kind === 'roster'; }).reduce(function (s, e) { return s + e.delta; }, 0);
    add('moves', 'Roster & trade moves', roster, roster ? 'Reacting to recent roster moves.' : 'No recent roster moves affecting him.');
    var off = active.filter(function (e) { return e.kind === 'off-court'; });
    if (off.length) add('off-court', 'Off-court events', off.reduce(function (s, e) { return s + e.delta; }, 0), off.map(function (e) { return e.reason; }).join(' '));

    // Locker room: captain and personalities buffer or amplify swings
    var swing = P.swing;
    var isCaptain = ctx.captain && ctx.captain.id === player.id;
    var lockerImpact = 0, lockerDetail = [];
    if (isCaptain) { lockerImpact += 3; lockerDetail.push('Proud to wear the captain’s armband.'); }
    else if (ctx.captain) {
      var cp = ctx.captain.personality;
      if (cp === 'leader') { swing *= 0.8; lockerImpact += 2; lockerDetail.push('Captain ' + ctx.captain.lastName + ' keeps the room steady.'); }
      else if (cp === 'professional') { swing *= 0.9; lockerDetail.push('Captain ' + ctx.captain.lastName + ' sets a professional tone.'); }
      else if (cp === 'volatile') { swing *= 1.15; lockerImpact -= 2; lockerDetail.push('Captain ' + ctx.captain.lastName + '’s moods ripple through the room.'); }
    }
    if (ctx.volatileCount >= 3) { swing *= 1.12; lockerImpact -= 2; lockerDetail.push(ctx.volatileCount + ' volatile personalities make the room tense.'); }
    add('locker', 'Locker room', lockerImpact, lockerDetail.join(' ') || 'A quiet locker room.');

    // Temperament (seeded)
    var temper = R.rng('temper:' + save.id + ':' + player.id).normal() * CONFIG.TEMPERAMENT_SD;

    // Swings: personality / room amplify or buffer every factor's distance from neutral
    var total = factors.reduce(function (s, f) { return s + f.impact; }, 0);
    var value = Math.round(clamp(CONFIG.BASE + temper + total * swing, CONFIG.MIN, CONFIG.MAX));
    factors.forEach(function (f) { f.impact = Math.round(f.impact * swing * 10) / 10; });
    return {
      value: value, mood: moodFor(value), personality: player.personality, expectedRole: exp, role: act,
      captain: !!isCaptain, swing: Math.round(swing * 100) / 100, factors: factors
    };
  }

  function evaluateTeam(save, teamId) {
    var ctx = teamContext(save, teamId);
    var out = {};
    ctx.roster.forEach(function (p) { out[p.id] = evaluate(save, p, ctx); });
    return { players: out, context: ctx };
  }

  /* --- rotation health ----------------------------------------------------- */

  /**
   * Overcrowded rotations, key contributors without minutes, excess
   * veterans — with concrete suggestions.
   * @returns { average, counts{high,mid,low}, captain, issues: [{ level, text }] }
   */
  function lockerRoomReport(save, teamId) {
    var ev = evaluateTeam(save, teamId);
    var ctx = ev.context;
    var list = ctx.roster.map(function (p) { return { p: p, m: ev.players[p.id] }; });
    var counts = { high: 0, mid: 0, low: 0 };
    list.forEach(function (x) { counts[x.m.mood.id]++; });
    var avg = list.length ? Math.round(list.reduce(function (s, x) { return s + x.m.value; }, 0) / list.length) : null;
    var issues = [];
    // Players whose own level earns regular minutes (development wishes are a separate factor)
    var wantMinutes = list.filter(function (x) { return x.p.overall >= 72; });
    if (wantMinutes.length > CONFIG.ROTATION_SLOTS) {
      var over = wantMinutes.length - CONFIG.ROTATION_SLOTS;
      var excessVets = wantMinutes.filter(function (x) { return x.p.age >= CONFIG.VETERAN_AGE && ROLES.indexOf(x.m.role) < 2; })
        .sort(function (a, b) { return a.p.overall - b.p.overall; });
      var name = function (x) { return x.p.firstName + ' ' + x.p.lastName + ' (' + x.p.age + ', ' + x.p.overall + ' OVR)'; };
      var squeezed = wantMinutes.filter(function (x) { return ROLES.indexOf(x.m.role) < 2; })
        .sort(function (a, b) { return a.p.overall - b.p.overall; });
      var advice = excessVets.length
        ? ' Consider moving ' + excessVets.slice(0, over).map(name).join(', ') + ' so key contributors keep consistent minutes.'
        : squeezed.length
          ? ' Squeezed out: ' + squeezed.slice(0, 3).map(name).join(', ') + '. Trim the rotation or move one of them before their morale slips.'
          : '';
      issues.push({ level: 'warn', text: 'Crowded rotation: ' + wantMinutes.length + ' players expect regular minutes, but only ' + CONFIG.ROTATION_SLOTS + ' rotation spots exist.' + advice });
    }
    var topSeven = list.slice().sort(function (a, b) { return b.p.overall - a.p.overall; }).slice(0, 7);
    topSeven.filter(function (x) { return ROLES.indexOf(x.m.role) < 2; }).forEach(function (x) {
      issues.push({ level: 'warn', text: x.p.firstName + ' ' + x.p.lastName + ' (' + x.p.overall + ' OVR) is one of the team’s best players but is outside the rotation.' });
    });
    var unhappyBench = list.filter(function (x) { return x.m.mood.id === 'low' && x.m.role !== 'starter'; });
    if (unhappyBench.length >= 3) issues.push({ level: 'warn', text: unhappyBench.length + ' bench players are unhappy with their role.' });
    list.filter(function (x) { return contractOutlook(x.m.value, x.p.personality).tradeRequestRisk >= 0.35; }).forEach(function (x) {
      issues.push({ level: 'risk', text: x.p.firstName + ' ' + x.p.lastName + ' is unhappy enough that he may ask out.' });
    });
    if (!issues.length) issues.push({ level: 'ok', text: 'Minutes line up with expectations — no rotation crunch.' });
    return { average: avg, counts: counts, captain: ctx.captain, issues: issues, players: ev.players };
  }

  /* --- effects for future systems ---------------------------------------- */

  /**
   * In-game effect of morale (for the game simulation).
   * @param ctx { margin }  current score margin from the player's team view
   * @returns { offense, defense, consistency }  multipliers around 1.0;
   *          consistency scales performance variance (>1 = streakier)
   */
  function performanceModifiers(morale, ctx) {
    var m = clamp(typeof morale === 'number' ? morale : 60, 0, 100);
    var conf = (m - 60) / 40;                       // -1.5 .. +0.95
    var off = 1 + 0.03 * conf, def = 1 + 0.025 * conf;
    var consistency = 1 + Math.max(0, (60 - m) / 100);
    var margin = ctx && typeof ctx.margin === 'number' ? ctx.margin : 0;
    if (margin <= -15) {                            // trailing big: low morale folds, high morale keeps fighting
      off += m < 45 ? -0.02 : m >= 70 ? 0.01 : 0;
      def += m < 45 ? -0.025 : m >= 70 ? 0.01 : 0;
    } else if (margin >= 15) {                      // leading big: low morale coasts on defense
      def += m < 45 ? -0.02 : 0;
      consistency += m < 45 ? 0.1 : 0;
    }
    return { offense: Math.round(off * 1000) / 1000, defense: Math.round(def * 1000) / 1000, consistency: Math.round(consistency * 100) / 100 };
  }

  /**
   * Contract & roster consequences (for future contracts / free agency).
   * @returns { resignWillingness 0..1, askingPriceFactor (x market value),
   *            freeAgencyLeaveRisk 0..1, tradeRequestRisk 0..1, summary }
   */
  function contractOutlook(morale, personality) {
    var m = clamp(typeof morale === 'number' ? morale : 60, 0, 100);
    var P = PERSONALITIES[personality] || PERSONALITIES.professional;
    var willing = clamp((m - 25) / 60, 0, 1);
    var price = Math.round((1.12 - 0.2 * willing) * 100) / 100;   // happy: takes a reasonable deal
    var leave = clamp((70 - m) / 70 * (P.swing), 0, 1);
    var request = m >= 40 ? 0 : clamp((40 - m) / 40 * P.swing * (personality === 'volatile' || personality === 'spotlight' ? 1.3 : 0.8), 0, 1);
    var summary = m >= 70 ? 'Open to re-signing and willing to take a reasonable deal.'
      : m >= 45 ? 'Would listen to an extension at full market value.'
      : request >= 0.35 ? 'Unhappy — a real risk to walk in free agency or demand a trade.'
      : 'Unhappy — likely to test free agency.';
    return { resignWillingness: Math.round(willing * 100) / 100, askingPriceFactor: price,
      freeAgencyLeaveRisk: Math.round(leave * 100) / 100, tradeRequestRisk: Math.round(request * 100) / 100, summary: summary };
  }

  /**
   * Record a morale event (roster moves, off-court events). For future
   * systems; deduplicated by id.
   */
  function recordEvent(save, event) {
    ensure(save);
    if (save.morale.events.some(function (e) { return e.id === event.id; })) return null;
    save.morale.events.push(event);
    return event;
  }

  function isValid(save) {
    var m = save.morale;
    if (m === undefined) return true;
    if (!m || typeof m.captains !== 'object' || !Array.isArray(m.events) || m.events.length > 5000) return false;
    var ids = {};
    save.players.forEach(function (p) { ids[p.id] = p; });
    return Object.keys(m.captains).every(function (t) { var p = ids[m.captains[t]]; return p && p.teamId === t; }) &&
      m.events.every(function (e) { return e && typeof e.id === 'string' && ids[e.playerId] && (e.kind === 'roster' || e.kind === 'off-court') && typeof e.delta === 'number' && Math.abs(e.delta) <= 40 && typeof e.reason === 'string'; }) &&
      save.players.every(function (p) { return p.personality === undefined || PERSONALITIES[p.personality]; });
  }

  return {
    CONFIG: CONFIG,
    PERSONALITIES: PERSONALITIES,
    ROLE_LABELS: ROLE_LABELS,
    personalityFor: personalityFor,
    addPersonalities: addPersonalities,
    ensure: ensure,
    pickCaptain: pickCaptain,
    setCaptain: setCaptain,
    expectedRole: expectedRole,
    actualRoles: actualRoles,
    moodFor: moodFor,
    evaluate: evaluate,
    evaluateTeam: evaluateTeam,
    lockerRoomReport: lockerRoomReport,
    performanceModifiers: performanceModifiers,
    contractOutlook: contractOutlook,
    recordEvent: recordEvent,
    isValid: isValid
  };
});
