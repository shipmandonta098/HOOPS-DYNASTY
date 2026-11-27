/* ==========================================================================
   HOOPS DYNASTY — player contracts (the single source of salary data)
   Everything that needs money for a player — the profile's Finances
   section, the roster, team payroll / cap / tax, and future trades, free
   agency and negotiation — reads from save.contracts:

     save.contracts = {
       version: 1,
       contracts:    { [contractId]: Contract },
       byPlayer:     { [playerId]: [contractId, ...] }    oldest first
       transactions: [ Transaction ]                      contract history
       earnings:     { [playerId]: [ { seasonYear, teamId, teamName, amount, kind } ] }
     }

     Contract = {
       id, playerId, type, status,                  // 'active' | 'expired' | 'waived' | 'bought-out' | 'terminated' | 'retired'
       signingTeamId, signingTeamName,              // franchise that signed it (name as of signing)
       teamId,                                      // franchise currently responsible
       signedDate,                                  // in-game ISO date, or null when unknown (before the league)
       startSeason, endSeason,                      // season START years (2025 = 2025–26)
       preDynasty,                                  // on file when the league began
       years: [ Year ],                             // one per season
       clauses: { tradeBonusPct, noTrade, incentives: [], signingBonus },
       extensions: [ { date, fromSeason, toSeason, total } ],
       dead: [ { seasonYear, teamId, amount } ]     // waived / bought-out money on a team's cap
     }
     Year = {
       seasonYear, salary, capHit,                  // integers (whole dollars); salary != cap hit != guaranteed
       guarantee: 'full' | 'partial' | 'none',      // guarantee status (stored separately from options)
       guaranteedAmount,                            // the guaranteed part when 'partial'
       guaranteeDate,                               // ISO: a 'none' / 'partial' year becomes full after this date
       option: null | 'player' | 'team',            // option status (separate from guarantee)
       optionStatus: null | 'pending' | 'exercised' | 'declined',
       optionDeadline,                              // ISO
       extension,                                   // true for years added by an extension
       paid, paydays                                // earned so far this season, paychecks processed
     }

   Rules live in data/contract-rules.js. Salaries are whole dollars.

   History is never invented: a dynasty starts with every player's CURRENT
   contract (generated once from league rules, with past signing dates
   only as far back as the deal itself), and salary EARNINGS are recorded
   only for paychecks actually processed in the dynasty. Projected,
   unexercised or future money never counts as earnings.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var node = typeof module === 'object' && module.exports;
  var api = factory(
    node ? require('./random.js') : root.HDRandom,
    node ? require('./season.js') : root.HDSeason,
    node ? require('../data/contract-rules.js') : root.HDContractRules
  );
  if (node) module.exports = api;
  else root.HDContracts = api;
})(typeof self !== 'undefined' ? self : this, function (R, Season, Rules) {
  'use strict';

  var STORE_VERSION = 1;
  var STATUSES = ['active', 'expired', 'waived', 'bought-out', 'terminated', 'retired'];

  /* --- small helpers -------------------------------------------------------- */

  function cmp(a, b) { return Season.compareDates(a, b); }
  function iso(y, m, d) { return Season.isoDate(y, m, d); }
  function cap(save) {
    var c = save.finances && save.finances.config && save.finances.config.salaryCap;
    return typeof c === 'number' && c > 0 ? c : ((save.league && save.league.rules && save.league.rules.salaryCap) || 141000000);
  }
  function teamById(save, id) { return (save.teams || []).filter(function (t) { return t.id === id; })[0] || null; }
  function teamName(save, id) { var t = teamById(save, id); return t ? t.fullName : null; }
  function playerById(save, id) { return (save.players || []).filter(function (p) { return p.id === id; })[0] || null; }

  // Twelve semi-monthly paydays for the season starting in `startYear`
  function paydays(startYear) {
    var out = [];
    [[startYear, 11], [startYear, 12], [startYear + 1, 1], [startYear + 1, 2], [startYear + 1, 3], [startYear + 1, 4]].forEach(function (ym) {
      var last = new Date(Date.UTC(ym[0], ym[1], 0)).getUTCDate();
      out.push(iso(ym[0], ym[1], 15), iso(ym[0], ym[1], last));
    });
    return out;
  }

  /* --- store ---------------------------------------------------------------- */

  function emptyStore() { return { version: STORE_VERSION, contracts: {}, byPlayer: {}, transactions: [], earnings: {} }; }
  function store(save) { if (!save.contracts) save.contracts = emptyStore(); return save.contracts; }

  function contractsOf(save, playerId) {
    var s = save.contracts;
    if (!s) return [];
    return (s.byPlayer[playerId] || []).map(function (id) { return s.contracts[id]; }).filter(Boolean);
  }
  function activeContract(save, playerId) {
    var list = contractsOf(save, playerId).filter(function (c) { return c.status === 'active'; });
    return list.length ? list[list.length - 1] : null;
  }
  function latestContract(save, playerId) {
    var list = contractsOf(save, playerId);
    return list.length ? list[list.length - 1] : null;
  }

  function addContract(save, c) {
    var s = store(save);
    if (s.contracts[c.id]) return s.contracts[c.id];          // never duplicate
    s.contracts[c.id] = c;
    (s.byPlayer[c.playerId] = s.byPlayer[c.playerId] || []).push(c.id);
    return c;
  }

  // Deterministic ids keep re-runs from duplicating history entries.
  function record(save, entry) {
    var s = store(save);
    var id = 'tx-' + [entry.kind, entry.contractId || entry.playerId, entry.seasonYear == null ? '' : entry.seasonYear, entry.date || 'pre', entry.key || ''].join(':');
    if (s.transactions.some(function (t) { return t.id === id; })) return null;
    var t = {
      id: id,
      date: entry.date || null,
      seasonYear: entry.seasonYear == null ? null : entry.seasonYear,
      playerId: entry.playerId,
      contractId: entry.contractId || null,
      teamId: entry.teamId || null,
      teamName: entry.teamName || (entry.teamId ? teamName(save, entry.teamId) : null),
      kind: entry.kind,
      details: entry.details || '',
      amount: entry.amount == null ? null : entry.amount,
      preDynasty: !!entry.preDynasty
    };
    s.transactions.push(t);
    return t;
  }

  /* --- contract math --------------------------------------------------------- */

  function isLive(y) { return y.optionStatus !== 'declined'; }
  function liveYears(c) { return c.years.filter(isLive); }

  // Money the player is guaranteed for one season (as the contract stands)
  function guaranteedFor(y) {
    if (!isLive(y)) return 0;
    if (y.option === 'team' && y.optionStatus === 'pending') return 0;      // team can still walk away
    if (y.guarantee === 'none') return 0;
    if (y.guarantee === 'partial') return Math.min(y.salary, y.guaranteedAmount || 0);
    return y.salary;                                                         // full (a pending PLAYER option is the player's call)
  }

  function totalValue(c) { return liveYears(c).reduce(function (s, y) { return s + y.salary; }, 0); }
  function guaranteedValue(c) { return c.years.reduce(function (s, y) { return s + guaranteedFor(y); }, 0); }
  function remainingGuaranteed(c, seasonYear) {
    if (c.status !== 'active') return 0;
    return c.years.reduce(function (s, y) {
      return y.seasonYear < seasonYear ? s : s + Math.max(0, guaranteedFor(y) - (y.paid || 0));
    }, 0);
  }
  function aav(c) { var live = liveYears(c); return live.length ? Math.round(totalValue(c) / live.length) : 0; }
  function yearFor(c, seasonYear) { return c.years.filter(function (y) { return y.seasonYear === seasonYear; })[0] || null; }
  function yearsRemaining(c, seasonYear) { return liveYears(c).filter(function (y) { return y.seasonYear >= seasonYear; }).length; }
  function lastLive(c) { var live = liveYears(c); return live.length ? live[live.length - 1].seasonYear : c.startSeason; }

  /**
   * Free agency outlook for a contract. A player becomes a free agent the
   * summer after the last live season (start year + 1). Pending options make
   * that conditional: { year, status, conditional: [{ year, option, ifDeclined }] }
   */
  function freeAgency(c) {
    var end = lastLive(c);
    var cond = c.years.filter(function (y) { return y.option && y.optionStatus === 'pending'; }).map(function (y) {
      return { seasonYear: y.seasonYear, option: y.option, year: y.seasonYear, deadline: y.optionDeadline };
    });
    return { year: end + 1, status: Rules.freeAgencyStatus(c), conditional: cond };
  }

  /* --- generation (opening day of a new dynasty, or the v15 migration) ----- */

  // Market salary (share of cap) for a player's overall at signing
  var CURVE = [[55, 0], [60, 0.0082], [65, 0.016], [70, 0.042], [75, 0.085], [80, 0.15], [85, 0.24], [90, 0.33], [94, 0.40]];
  function marketShare(ovr) {
    if (ovr <= CURVE[0][0]) return 0;
    for (var i = 1; i < CURVE.length; i++) {
      if (ovr <= CURVE[i][0]) {
        var a = CURVE[i - 1], b = CURVE[i];
        return a[1] + (b[1] - a[1]) * (ovr - a[0]) / (b[0] - a[0]);
      }
    }
    return CURVE[CURVE.length - 1][1];
  }
  // Rough yearly overall change by age, to estimate a player's level when
  // a multi-year deal was signed (the deal reflects THAT player, not today's)
  function yearlyChange(age) { return age < 24 ? 3 : age < 27 ? 1.5 : age < 30 ? 0 : -1.5; }

  function makeYear(seasonYear, salary) {
    return {
      seasonYear: seasonYear, salary: salary, capHit: salary,
      guarantee: 'full', guaranteedAmount: null, guaranteeDate: null,
      option: null, optionStatus: null, optionDeadline: null,
      extension: false, paid: 0, paydays: 0
    };
  }

  // The current contract of one player at the start of the dynasty
  function generateFor(save, p, ctx) {
    var r = R.rng('contract:' + save.id + ':' + p.id);
    var S = ctx.seasonYear, C = ctx.cap, start = ctx.startDate;
    var exp = Number.isInteger(p.experience) ? p.experience : 0;
    var dr = p.draft || { year: S - exp, undrafted: true };
    var firstRound = !dr.undrafted && dr.round === 1;
    var c = {
      id: 'ctr-' + p.id + '-1', playerId: p.id, type: null, status: 'active',
      signingTeamId: p.teamId, signingTeamName: teamName(save, p.teamId), teamId: p.teamId,
      signedDate: null, startSeason: S, endSeason: S, preDynasty: true, years: [],
      clauses: { tradeBonusPct: null, noTrade: false, incentives: [], signingBonus: null },
      extensions: [], dead: []
    };

    if (firstRound && exp <= Rules.ROOKIE.YEARS - 1) {
      // Rookie scale, signed with the drafting franchise the summer of the draft
      c.type = 'rookie-scale';
      c.startSeason = dr.year;
      c.signedDate = iso(dr.year, 7, 8);
      if (dr.teamId && teamById(save, dr.teamId)) { c.signingTeamId = dr.teamId; c.signingTeamName = dr.teamName || teamName(save, dr.teamId); }
      var base = Rules.rookieScale(dr.pick, C), sal = base;
      for (var i = 0; i < Rules.ROOKIE.YEARS; i++) {
        sal = i === 0 ? base : Math.round(sal * Rules.ROOKIE.RAISES[i]);
        var y = makeYear(dr.year + i, sal);
        if (Rules.ROOKIE.TEAM_OPTION_YEARS.indexOf(i + 1) !== -1) {
          y.option = 'team'; y.optionStatus = 'pending';
          y.optionDeadline = iso(y.seasonYear - 1, 10, 31);     // decided a year ahead
        }
        c.years.push(y);
      }
    } else if (exp === 0) {
      // Second-round / undrafted rookie: two-year minimum, second year non-guaranteed
      c.type = 'minimum';
      c.signedDate = iso(S, 7, 15);
      c.years.push(makeYear(S, Rules.minimumFor(0, C)));
      var y2 = makeYear(S + 1, Rules.minimumFor(1, C));
      y2.guarantee = 'none'; y2.guaranteeDate = iso(S + 2, 1, 10);
      c.years.push(y2);
    } else {
      // Veteran deal signed `k` seasons ago (never before the player's career,
      // and for first-round picks, never during the rookie-scale years)
      var age = p.age;
      var L = age <= 26 ? r.int(3, 5) : age <= 30 ? r.int(2, 4) : age <= 33 ? r.int(1, 3) : r.int(1, 2);
      var maxK = Math.min(L - 1, firstRound ? exp - Rules.ROOKIE.YEARS : exp);
      var k = maxK > 0 ? r.int(0, maxK) : 0;
      var ovrAtSign = p.overall, ageAtSign = age;
      for (var j = 0; j < k; j++) { ageAtSign -= 1; ovrAtSign -= yearlyChange(ageAtSign); }
      var expAtSign = exp - k;
      var minS = Rules.minimumFor(expAtSign, C), maxS = Rules.maximumFor(expAtSign, C);
      var market = C * marketShare(ovrAtSign) * Math.exp(r.normal() * 0.12);
      var first = Math.round(market);
      var startSeason = S - k;
      if (first >= maxS) { c.type = 'maximum'; first = maxS; }
      else if (first <= minS) {
        c.type = 'minimum'; first = minS;
        L = Math.min(L, k + r.int(1, 2));                       // minimum deals are short
      } else c.type = 'veteran';
      c.startSeason = startSeason;
      c.signedDate = iso(startSeason, 7, r.int(6, 28));
      for (var n = 0; n < L; n++) {
        var amount = c.type === 'minimum' ? Rules.minimumFor(expAtSign + n, C) : Math.round(first * Math.pow(1 + Rules.RAISE, n));
        c.years.push(makeYear(startSeason + n, amount));
      }
      var last = c.years[c.years.length - 1];
      if (c.years.length >= 2 && c.type !== 'minimum') {
        if (r.chance(ovrAtSign >= 85 ? 0.35 : 0.12)) { last.option = 'player'; last.optionStatus = 'pending'; last.optionDeadline = iso(last.seasonYear, 6, 29); }
        else if (r.chance(ovrAtSign < 75 ? 0.12 : 0.04)) { last.option = 'team'; last.optionStatus = 'pending'; last.optionDeadline = iso(last.seasonYear, 6, 29); }
        else if (ovrAtSign < 70 && r.chance(0.4)) {
          if (r.chance(0.5)) { last.guarantee = 'partial'; last.guaranteedAmount = Math.round(last.salary * 0.5); }
          else last.guarantee = 'none';
          last.guaranteeDate = iso(last.seasonYear + 1, 1, 10);
        }
      }
      if (ovrAtSign >= 82 && c.type !== 'minimum' && r.chance(0.25)) c.clauses.tradeBonusPct = 15;
      c._gen = { expAtSign: expAtSign, first: first, market: market };       // for team balancing; removed after
      // A deal signed elsewhere and since traded: the signing franchise is unknown
      // to the league's records, so the current team is shown as responsible only.
    }

    c.endSeason = c.years[c.years.length - 1].seasonYear;
    // Decisions whose deadline passed before the league began: the player is
    // still under this contract, so they were exercised / guarantees vested.
    c.years.forEach(function (y) {
      if (y.option && y.optionStatus === 'pending' && cmp(y.optionDeadline, start) < 0) { y.optionStatus = 'exercised'; y.decidedBeforeDynasty = true; }
      if (y.guaranteeDate && y.guarantee !== 'full' && cmp(y.guaranteeDate, start) < 0) { y.guarantee = 'full'; y.guaranteedAmount = null; y.decidedBeforeDynasty = true; }
    });
    return c;
  }

  /**
   * Team payrolls land in a realistic band (cap floor 90% of the cap to a
   * little over the tax line): veteran / max deals on each team are scaled
   * together, still clamped to each player's minimum and maximum.
   */
  function balanceTeams(save, list, ctx) {
    var C = ctx.cap;
    var tax = (save.finances && save.finances.config && save.finances.config.luxuryTax) || C * 1.215;
    var byTeam = {};
    list.forEach(function (c) { (byTeam[c.teamId] = byTeam[c.teamId] || []).push(c); });
    Object.keys(byTeam).forEach(function (teamId) {
      var team = byTeam[teamId];
      var target = null;
      // Each veteran deal may move within [0.5x, 1.8x] of what the player's
      // level was worth at signing (and always within the rule minimum /
      // maximum). A team that still can't reach the band stays outside it.
      function bounds(c) {
        var g = c._gen;
        var minS = Rules.minimumFor(g.expAtSign, C), maxS = Rules.maximumFor(g.expAtSign, C);
        return [Math.max(minS, Math.min(maxS, g.market * 0.5)), Math.max(minS, Math.min(maxS, g.market * 1.8)), minS, maxS];
      }
      for (var pass = 0; pass < 8; pass++) {
        var raw = team.reduce(function (sum, c) { var y = yearFor(c, ctx.seasonYear); return sum + (y ? y.salary : 0); }, 0);
        if (target == null) target = Math.max(0.88 * C, Math.min(1.06 * tax, 1.1 * C + (raw - 1.1 * C) * 0.35));
        if (Math.abs(raw - target) < C * 0.01) break;
        var up = raw < target;
        var scalable = team.filter(function (c) {
          if (!c._gen) return false;
          var b = bounds(c);
          return up ? c._gen.first < b[1] : c._gen.first > b[0];
        });
        var base = scalable.reduce(function (sum, c) { return sum + yearFor(c, ctx.seasonYear).salary; }, 0);
        if (!base) break;
        var f = Math.max(0.5, Math.min(1.8, 1 + (target - raw) / base));
        scalable.forEach(function (c) {
          var g = c._gen, b = bounds(c);
          var first = Math.round(Math.max(b[0], Math.min(b[1], g.first * f)));
          g.first = first;
          c.type = first >= b[3] ? 'maximum' : first <= b[2] ? 'minimum' : 'veteran';
          c.years.forEach(function (y, n) {
            y.salary = c.type === 'minimum' ? Rules.minimumFor(g.expAtSign + n, C) : Math.round(first * Math.pow(1 + Rules.RAISE, n));
            y.capHit = y.salary;
            if (y.guarantee === 'partial') y.guaranteedAmount = Math.round(y.salary * 0.5);
          });
        });
      }
    });
  }

  /**
   * Gives every player a contract, once. Safe to call repeatedly: players
   * who already have contract records are never regenerated or overwritten.
   */
  function generateLeague(save) {
    var s = store(save);
    var ctx = { seasonYear: save.calendar.seasonYear, cap: cap(save), startDate: save.calendar.currentDate };
    var fresh = (save.players || []).filter(function (p) { return !(s.byPlayer[p.id] || []).length; })
      .map(function (p) { return generateFor(save, p, ctx); });
    balanceTeams(save, fresh, ctx);
    fresh.forEach(function (gen) {
      delete gen._gen;
      var c = addContract(save, gen), p = { id: c.playerId };
      record(save, {
        kind: c.type === 'rookie-scale' ? 'rookie-scale' : 'signed', playerId: p.id, contractId: c.id,
        teamId: c.signingTeamId, teamName: c.signingTeamName, date: c.signedDate, seasonYear: c.startSeason,
        amount: totalValue(c), preDynasty: true,
        details: c.years.length + '-year ' + Rules.TYPES[c.type].label.toLowerCase() + ' contract (on file when the league began)'
      });
      c.years.forEach(function (y) {
        if (y.decidedBeforeDynasty && y.option) record(save, {
          kind: y.option === 'team' ? 'team-option-exercised' : 'player-option-exercised', playerId: p.id, contractId: c.id,
          teamId: c.teamId, date: y.optionDeadline, seasonYear: y.seasonYear, amount: y.salary, preDynasty: true,
          details: Season.label(y.seasonYear) + ' option exercised before the league began'
        });
      });
      if (c.signingTeamId !== c.teamId) record(save, {
        kind: 'acquired-trade', playerId: p.id, contractId: c.id, teamId: c.teamId, date: null, seasonYear: null, preDynasty: true,
        details: 'Contract acquired from the ' + c.signingTeamName + ' before the league began'
      });
    });
    return save;
  }

  /* --- earnings (accrual) ---------------------------------------------------- */

  function addEarning(save, playerId, seasonYear, teamId, amount, kind) {
    if (!amount) return;
    var s = store(save);
    var list = s.earnings[playerId] = s.earnings[playerId] || [];
    var name = teamName(save, teamId);
    var row = list.filter(function (e) { return e.seasonYear === seasonYear && e.teamId === teamId && e.kind === kind; })[0];
    if (row) row.amount += amount;
    else list.push({ seasonYear: seasonYear, teamId: teamId, teamName: name, amount: amount, kind: kind });
  }

  // Money owed for a season year (what paychecks pay out)
  function payableFor(c, y) {
    if (!isLive(y)) return 0;
    if (c.status === 'active') return y.salary;
    if (c.status === 'waived' || c.status === 'bought-out') return y.payable || 0;
    return y.paid || 0;   // terminated / retired / expired: nothing more
  }

  /**
   * Processes every payday up to and including `date` (idempotent: each
   * season year remembers how many paychecks it has paid). Paychecks go to
   * the franchise responsible on that date, so trades split earnings.
   */
  function accrueTo(save, date) {
    var s = save.contracts;
    if (!s) return save;
    syncTeams(save, date);
    Object.keys(s.contracts).forEach(function (id) {
      var c = s.contracts[id];
      c.years.forEach(function (y) {
        // Seasons before the league began were paid outside its records: never invented
        if (y.seasonYear < save.calendar.startYear) return;
        var days = paydays(y.seasonYear);
        var due = days.filter(function (d) { return cmp(d, date) <= 0; }).length;
        if (due <= (y.paydays || 0)) return;
        var total = payableFor(c, y);
        var target = Math.round(total * due / Rules.PAYDAYS);
        var pay = Math.max(0, target - (y.paid || 0));
        var payer = c.status === 'active' ? c.teamId : (c.waivedBy || c.teamId);
        addEarning(save, c.playerId, y.seasonYear, payer, pay, 'salary');
        y.paid = (y.paid || 0) + pay;
        y.paydays = due;
      });
    });
    return save;
  }

  /* --- operations (record history; never duplicate) --------------------------- */

  function findYear(c, seasonYear) { var y = yearFor(c, seasonYear); if (!y) throw new Error('No ' + seasonYear + ' season on contract ' + c.id); return y; }
  function get(save, contractId) { var c = save.contracts && save.contracts.contracts[contractId]; if (!c) throw new Error('Unknown contract ' + contractId); return c; }

  function exerciseOption(save, contractId, seasonYear, date) {
    var c = get(save, contractId), y = findYear(c, seasonYear);
    if (!y.option || y.optionStatus !== 'pending') return false;
    y.optionStatus = 'exercised';             // keeps its PO / TO designation
    record(save, { kind: y.option === 'team' ? 'team-option-exercised' : 'player-option-exercised', playerId: c.playerId, contractId: c.id,
      teamId: c.teamId, date: date, seasonYear: seasonYear, amount: y.salary, details: Season.label(seasonYear) + ' ' + y.option + ' option exercised' });
    return true;
  }

  function declineOption(save, contractId, seasonYear, date) {
    var c = get(save, contractId), y = findYear(c, seasonYear);
    if (!y.option || y.optionStatus !== 'pending') return false;
    // Declining ends the deal before that season: later years go with it
    c.years.forEach(function (o) { if (o.seasonYear >= seasonYear) o.optionStatus = 'declined'; });
    c.endSeason = lastLive(c);
    record(save, { kind: y.option === 'team' ? 'team-option-declined' : 'player-option-declined', playerId: c.playerId, contractId: c.id,
      teamId: c.teamId, date: date, seasonYear: seasonYear, amount: y.salary,
      details: Season.label(seasonYear) + ' ' + y.option + ' option declined · free agent in ' + (c.endSeason + 1) + ' (' + Rules.freeAgencyStatus(c) + ')' });
    return true;
  }

  // A non- or partially-guaranteed season vests in full (guarantee date passed)
  function activateGuarantee(save, contractId, seasonYear, date) {
    var c = get(save, contractId), y = findYear(c, seasonYear);
    if (y.guarantee === 'full' || !isLive(y)) return false;
    y.guarantee = 'full'; y.guaranteedAmount = null;
    record(save, { kind: 'guarantee-activated', playerId: c.playerId, contractId: c.id, teamId: c.teamId, date: date,
      seasonYear: seasonYear, amount: y.salary, details: Season.label(seasonYear) + ' salary now fully guaranteed' });
    return true;
  }

  /**
   * Trade: the acquiring franchise takes over the remaining obligations.
   * Signing date, signing franchise and the year structure are preserved;
   * this is not a new signing. A trade bonus (if any) is paid by the
   * trading team and charged to the acquiring team's cap over the
   * remaining guaranteed seasons.
   */
  function transfer(save, playerId, toTeamId, date) {
    var c = activeContract(save, playerId);
    if (!c || c.teamId === toTeamId) return false;
    var from = c.teamId;
    var season = save.calendar.seasonYear;
    var bonus = 0;
    if (c.clauses.tradeBonusPct) {
      var remaining = c.years.filter(function (y) { return y.seasonYear >= season; });
      var owed = remaining.reduce(function (s, y) { return s + Math.max(0, guaranteedFor(y) - (y.paid || 0)); }, 0);
      bonus = Math.round(owed * c.clauses.tradeBonusPct / 100);
      var spread = remaining.filter(function (y) { return guaranteedFor(y) > 0; });
      if (bonus && spread.length) {
        var each = Math.floor(bonus / spread.length);
        spread.forEach(function (y, i) { y.capHit += i === spread.length - 1 ? bonus - each * (spread.length - 1) : each; });
        addEarning(save, playerId, season, from, bonus, 'trade-bonus');
      }
    }
    c.teamId = toTeamId;
    record(save, { kind: 'acquired-trade', playerId: playerId, contractId: c.id, teamId: toTeamId, date: date, seasonYear: season,
      amount: remainingGuaranteed(c, season), key: toTeamId,
      details: 'Acquired from the ' + (teamName(save, from) || 'previous team') + ' · contract unchanged' + (bonus ? ' · trade bonus paid' : '') });
    return true;
  }

  // Keeps contracts in line with rosters if another system moved a player
  function syncTeams(save, date) {
    (save.players || []).forEach(function (p) {
      var c = activeContract(save, p.id);
      if (c && c.teamId !== p.teamId) transfer(save, p.id, p.teamId, date || save.calendar.currentDate);
    });
  }

  /**
   * Extension: adds seasons after the current end. years: [salary, ...]
   * opts: { date, options: { [index]: 'player'|'team' } }
   */
  function extend(save, contractId, salaries, opts) {
    opts = opts || {};
    var c = get(save, contractId);
    if (c.status !== 'active' || !salaries.length) return false;
    var from = c.endSeason + 1;
    salaries.forEach(function (amount, i) {
      var y = makeYear(from + i, Math.round(amount));
      y.extension = true;
      var opt = opts.options && opts.options[i];
      if (opt) { y.option = opt; y.optionStatus = 'pending'; y.optionDeadline = iso(y.seasonYear, 6, 29); }
      c.years.push(y);
    });
    c.endSeason = c.years[c.years.length - 1].seasonYear;
    var total = salaries.reduce(function (s, v) { return s + Math.round(v); }, 0);
    c.extensions.push({ date: opts.date || save.calendar.currentDate, fromSeason: from, toSeason: c.endSeason, total: total });
    record(save, { kind: 'extension', playerId: c.playerId, contractId: c.id, teamId: c.teamId, date: opts.date || save.calendar.currentDate,
      seasonYear: from, amount: total, details: salaries.length + '-year extension through ' + Season.label(c.endSeason) });
    return true;
  }

  // Waived: guaranteed money still owed stays on the waiving team's cap (dead money)
  function waive(save, contractId, date, opts) {
    var c = get(save, contractId);
    if (c.status !== 'active') return false;
    var season = save.calendar.seasonYear;
    var buyout = opts && typeof opts.buyout === 'number' ? Math.round(opts.buyout) : null;
    var owed = remainingGuaranteed(c, season);
    var scale = buyout == null || owed === 0 ? 1 : Math.min(1, buyout / owed);
    c.status = buyout == null ? 'waived' : 'bought-out';
    c.waivedBy = c.teamId;
    c.years.forEach(function (y) {
      if (y.seasonYear < season) return;
      var g = Math.max(0, guaranteedFor(y) - (y.paid || 0));
      y.payable = (y.paid || 0) + Math.round(g * scale);
      var deadAmt = Math.round(g * scale) + (y.paid || 0);
      if (deadAmt > 0) c.dead.push({ seasonYear: y.seasonYear, teamId: c.teamId, amount: deadAmt });
    });
    record(save, { kind: buyout == null ? 'waived' : 'buyout', playerId: c.playerId, contractId: c.id, teamId: c.teamId, date: date,
      seasonYear: season, amount: buyout == null ? owed : buyout,
      details: buyout == null ? 'Waived · remaining guaranteed money stays on the cap' : 'Contract bought out' });
    return true;
  }

  function terminate(save, contractId, date, reason) {
    var c = get(save, contractId);
    if (c.status !== 'active') return false;
    c.status = reason === 'retired' ? 'retired' : 'terminated';
    record(save, { kind: reason === 'retired' ? 'retired' : 'terminated', playerId: c.playerId, contractId: c.id, teamId: c.teamId,
      date: date, seasonYear: save.calendar.seasonYear, details: reason === 'retired' ? 'Retired · remaining salary forfeited' : 'Contract terminated' });
    return true;
  }
  function retire(save, playerId, date) {
    var c = activeContract(save, playerId);
    if (c) return terminate(save, c.id, date, 'retired');
    record(save, { kind: 'retired', playerId: playerId, date: date, seasonYear: save.calendar.seasonYear, details: 'Retired' });
    store(save).retired = store(save).retired || {};
    store(save).retired[playerId] = date;
    return true;
  }

  // New league season: deals whose last live season has ended expire
  function onNewSeason(save, seasonYear, date) {
    var s = save.contracts;
    if (!s) return save;
    Object.keys(s.contracts).forEach(function (id) {
      var c = s.contracts[id];
      if (c.status === 'active' && lastLive(c) < seasonYear) {
        c.status = 'expired';
        record(save, { kind: 'expired', playerId: c.playerId, contractId: c.id, teamId: c.teamId, date: date || iso(seasonYear, 7, 1),
          seasonYear: seasonYear, details: 'Contract expired · ' + (Rules.freeAgencyStatus(c) === 'RFA' ? 'restricted' : 'unrestricted') + ' free agent' });
      }
    });
    return save;
  }

  /* --- league queries --------------------------------------------------------- */

  // Cap charges for a team in a season: active contracts + dead money
  function teamPayroll(save, teamId, seasonYear) {
    var s = save.contracts;
    if (!s) return null;
    var season = seasonYear == null ? save.calendar.seasonYear : seasonYear;
    var total = 0;
    Object.keys(s.contracts).forEach(function (id) {
      var c = s.contracts[id];
      if (c.status === 'active' && c.teamId === teamId) {
        var y = yearFor(c, season);
        if (y && isLive(y)) total += y.capHit;
      }
      (c.dead || []).forEach(function (d) { if (d.teamId === teamId && d.seasonYear === season) total += d.amount; });
    });
    return total;
  }

  function careerEarnings(save, playerId) {
    var list = (save.contracts && save.contracts.earnings[playerId]) || [];
    return list.reduce(function (s, e) { return s + e.amount; }, 0);
  }

  /**
   * Salary table rows for the profile. Earnings come only from processed
   * paychecks; the current season's contract salary and cap hit are shown
   * alongside but never added to career earnings.
   * -> { rows: [{ seasonYear, teamId, teamName, salary, capHit, earned, split, combined, inProgress }], career, incomplete }
   */
  function salaryRows(save, playerId) {
    var earnings = (save.contracts && save.contracts.earnings[playerId]) || [];
    var seasons = {};
    earnings.forEach(function (e) { (seasons[e.seasonYear] = seasons[e.seasonYear] || []).push(e); });
    var current = save.calendar.seasonYear;
    var active = activeContract(save, playerId);
    if (active && yearFor(active, current) && !seasons[current]) seasons[current] = [];
    var contractSalary = function (season) {
      var hit = null, sal = null;
      contractsOf(save, playerId).forEach(function (c) {
        var y = yearFor(c, season);
        if (y && isLive(y)) { sal = (sal || 0) + y.salary; hit = (hit || 0) + y.capHit; }
      });
      return { salary: sal, capHit: hit };
    };
    var rows = [];
    Object.keys(seasons).map(Number).sort(function (a, b) { return a - b; }).forEach(function (season) {
      var list = seasons[season];
      var byTeam = {}, order = [];
      list.forEach(function (e) {
        if (!byTeam[e.teamId]) { byTeam[e.teamId] = { teamId: e.teamId, teamName: e.teamName, earned: 0 }; order.push(e.teamId); }
        byTeam[e.teamId].earned += e.amount;
      });
      var money = contractSalary(season);
      var inProgress = season === current;
      var earned = list.reduce(function (s, e) { return s + e.amount; }, 0);
      if (order.length > 1) {
        rows.push({ seasonYear: season, combined: true, teams: order.length, salary: money.salary, capHit: money.capHit, earned: earned, inProgress: inProgress });
        order.forEach(function (id) { rows.push({ seasonYear: season, split: true, teamId: id, teamName: byTeam[id].teamName, salary: null, capHit: null, earned: byTeam[id].earned, inProgress: inProgress }); });
      } else {
        var tid = order[0] || (active ? active.teamId : null);
        rows.push({ seasonYear: season, teamId: tid, teamName: order[0] ? byTeam[order[0]].teamName : teamName(save, tid),
          salary: money.salary, capHit: money.capHit, earned: earned, inProgress: inProgress });
      }
    });
    var p = playerById(save, playerId);
    var startYear = save.calendar.startYear;
    var firstSeason = p ? save.calendar.seasonYear - (p.experience || 0) : startYear;
    return { rows: rows, career: careerEarnings(save, playerId), incomplete: firstSeason < startYear };
  }

  // 'under-contract' | 'UFA' | 'RFA' | 'unsigned-rookie' | 'retired'
  function playerStatus(save, playerId) {
    var s = save.contracts;
    if (s && s.retired && s.retired[playerId]) return 'retired';
    var c = latestContract(save, playerId);
    if (!c) return 'unsigned-rookie';
    if (c.status === 'active') return 'under-contract';
    if (c.status === 'retired') return 'retired';
    return Rules.freeAgencyStatus(c);
  }

  function history(save, playerId) {
    var list = ((save.contracts && save.contracts.transactions) || []).filter(function (t) { return t.playerId === playerId; });
    // Undated pre-league entries (e.g. a trade before the league began) sit
    // just before the league's first day: after any dated pre-league signing.
    var eve = iso(save.calendar.startYear, 9, 30);
    return list.slice().sort(function (a, b) {
      var d = cmp(b.date || eve, a.date || eve);
      return d || list.indexOf(b) - list.indexOf(a);
    });
  }

  /* --- lifecycle -------------------------------------------------------------- */

  /** Creates the store and generates every missing contract (once). */
  function ensure(save) {
    if (!save.contracts) { save.contracts = emptyStore(); generateLeague(save); }
    return save;
  }

  function isInt(v) { return Number.isInteger(v) && v >= 0 && v <= 2e9; }
  function isValid(save) {
    var s = save.contracts;
    if (s === undefined) return true;
    if (!s || typeof s !== 'object' || !s.contracts || !s.byPlayer || !Array.isArray(s.transactions) || !s.earnings) return false;
    var ok = Object.keys(s.contracts).every(function (id) {
      var c = s.contracts[id];
      return c && c.id === id && typeof c.playerId === 'string' && STATUSES.indexOf(c.status) !== -1 && Rules.TYPES[c.type] &&
        Number.isInteger(c.startSeason) && Number.isInteger(c.endSeason) && Array.isArray(c.years) && c.years.length > 0 && c.years.length <= 15 &&
        c.years.every(function (y) {
          return Number.isInteger(y.seasonYear) && isInt(y.salary) && isInt(y.capHit) && ['full', 'partial', 'none'].indexOf(y.guarantee) !== -1 &&
            (y.option === null || y.option === 'player' || y.option === 'team') &&
            (y.optionStatus === null || ['pending', 'exercised', 'declined'].indexOf(y.optionStatus) !== -1) && isInt(y.paid || 0);
        });
    });
    if (!ok) return false;
    // byPlayer only references existing contracts, no duplicates
    var seen = {};
    return Object.keys(s.byPlayer).every(function (pid) {
      return Array.isArray(s.byPlayer[pid]) && s.byPlayer[pid].every(function (id) {
        if (seen[id] || !s.contracts[id] || s.contracts[id].playerId !== pid) return false;
        seen[id] = true; return true;
      });
    }) && Object.keys(s.earnings).every(function (pid) {
      return Array.isArray(s.earnings[pid]) && s.earnings[pid].every(function (e) { return e && Number.isInteger(e.seasonYear) && isInt(e.amount); });
    });
  }

  return {
    STORE_VERSION: STORE_VERSION,
    paydays: paydays,
    ensure: ensure,
    generateLeague: generateLeague,
    marketShare: marketShare,
    contractsOf: contractsOf,
    activeContract: activeContract,
    latestContract: latestContract,
    yearFor: yearFor,
    guaranteedFor: guaranteedFor,
    totalValue: totalValue,
    guaranteedValue: guaranteedValue,
    remainingGuaranteed: remainingGuaranteed,
    aav: aav,
    yearsRemaining: yearsRemaining,
    freeAgency: freeAgency,
    accrueTo: accrueTo,
    exerciseOption: exerciseOption,
    declineOption: declineOption,
    activateGuarantee: activateGuarantee,
    transfer: transfer,
    syncTeams: syncTeams,
    extend: extend,
    waive: waive,
    terminate: terminate,
    retire: retire,
    onNewSeason: onNewSeason,
    teamPayroll: teamPayroll,
    careerEarnings: careerEarnings,
    salaryRows: salaryRows,
    playerStatus: playerStatus,
    history: history,
    isValid: isValid
  };
});
