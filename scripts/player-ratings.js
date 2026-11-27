/* ==========================================================================
   HOOPS DYNASTY — player rating generation (attributes → overall)
   Configuration: data/rating-config.js. Attribute list: player-attributes.js.

   How a player is built
   1. A target overall is drawn from the league distribution (or a draft-class
      distribution), and the league's values are handed out unevenly across
      teams (contenders, star-led teams, deep teams, rebuilders...).
   2. The player gets an archetype (sometimes a hybrid), and an attribute
      SHAPE: position tendency + archetype + personal strengths/weakness +
      occasional surprise skill + height + age effects + noise.
   3. One skill LEVEL is solved (bisection) so that the overall computed
      from the attributes by overallFromAttributes() lands on the target.
      The stored overall is ALWAYS the formula's result — never assigned.
   4. Potential = overall + age-based growth with wide variation.

   Reusable for initial rosters, draft classes, free agents and expansion
   (generatePlayer / generateDraftClass). Seeded: same seed, same players.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var node = typeof module === 'object' && module.exports;
  var api = factory(
    node ? require('./random.js') : root.HDRandom,
    node ? require('../data/rating-config.js') : root.HDRatingConfig,
    node ? require('./player-attributes.js') : root.HDPlayerAttributes
  );
  if (node) module.exports = api;
  else root.HDPlayerRatings = api;
})(typeof self !== 'undefined' ? self : this, function (R, C, A) {
  'use strict';

  var KEYS = A.KEYS;
  var SKILLS = KEYS.filter(function (k) { return k !== 'durability' && k !== 'stamina'; });
  var POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
  var ARCH_BY_ID = {};
  C.ARCHETYPES.forEach(function (a) { ARCH_BY_ID[a.id] = a; });

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* --- overall formula ---------------------------------------------------- */

  /**
   * Position-aware overall from attributes (centralized formula).
   * raw = BASE_SHARE x weighted mean + PEAK_SHARE x mean of the best
   *       PEAK_COUNT position-relevant attributes; overall = STRETCH x raw + OFFSET
   */
  function overallFromAttributes(attrs, position) {
    var w = C.POSITION_WEIGHTS[position] || C.POSITION_WEIGHTS.SF;
    var F = C.FORMULA;
    var sum = 0, total = 0, peaks = [];
    Object.keys(w).forEach(function (k) {
      var v = attrs[k];
      if (typeof v !== 'number') return;
      sum += v * w[k];
      total += w[k];
      if (w[k] >= F.PEAK_MIN_WEIGHT) peaks.push(v);
    });
    if (!total) return null;
    peaks.sort(function (a, b) { return b - a; });
    var top = peaks.slice(0, F.PEAK_COUNT);
    var peak = top.reduce(function (s, v) { return s + v; }, 0) / top.length;
    var raw = F.BASE_SHARE * (sum / total) + F.PEAK_SHARE * peak;
    return Math.round(clamp(F.STRETCH * raw + F.OFFSET, 1, C.MAX_GENERATED_OVERALL));
  }

  /* --- archetypes ----------------------------------------------------------- */

  function weightedPick(rng, entries) {     // [[value, weight], ...]
    var total = entries.reduce(function (s, e) { return s + e[1]; }, 0);
    var r = rng.next() * total;
    for (var i = 0; i < entries.length; i++) { r -= entries[i][1]; if (r <= 0) return entries[i][0]; }
    return entries[entries.length - 1][0];
  }

  function pickArchetype(rng, position) {
    var fits = C.ARCHETYPES.filter(function (a) { return a.fit[position]; }).map(function (a) { return [a, a.fit[position]]; });
    var primary = weightedPick(rng, fits);
    var secondary = null;
    if (rng.chance(C.HYBRID_CHANCE)) {
      var others = fits.filter(function (e) { return e[0] !== primary; });
      if (others.length) secondary = weightedPick(rng, others);
    }
    return { primary: primary, secondary: secondary };
  }

  /* --- attribute shape --------------------------------------------------- */

  function buildShape(rng, p, arch) {
    var prof = C.POSITION_PROFILE[p.position];
    var shape = {};
    var hb = arch.secondary ? C.HYBRID_BLEND : 0;
    SKILLS.forEach(function (k) {
      var a1 = arch.primary.offsets[k] || 0;
      var a2 = arch.secondary ? (arch.secondary.offsets[k] || 0) : 0;
      shape[k] = (prof[k] || 0) * C.POSITION_SHAPE + a1 * (1 - hb) + a2 * hb + rng.normal() * C.ATTRIBUTE_NOISE;
    });
    // Personal signature: a couple of strengths and a weakness of his own
    var order = rng.shuffle(SKILLS);
    var S = C.SIGNATURE;
    for (var i = 0; i < S.strengths; i++) shape[order[i]] += rng.int(S.strengthMin, S.strengthMax);
    for (var j = 0; j < S.weaknesses; j++) shape[order[S.strengths + j]] -= rng.int(S.weaknessMin, S.weaknessMax);
    // Occasional skill outside the position's stereotype
    if (rng.chance(C.SURPRISE_CHANCE)) {
      var weakest = SKILLS.slice().sort(function (a, b) { return shape[a] - shape[b]; }).slice(0, 8);
      shape[rng.pick(weakest)] = rng.int(C.SURPRISE_MIN, C.SURPRISE_MAX);   // well above his level
    }
    // Physical profile
    var dh = Number.isFinite(p.heightIn) ? p.heightIn - C.HEIGHT_MID[p.position] : 0;
    Object.keys(C.HEIGHT_EFFECT).forEach(function (k) { shape[k] += C.HEIGHT_EFFECT[k] * dh; });
    // Age: athleticism fades, craft grows — not every attribute declines
    var G = C.AGING;
    var athletic = Math.max(0, p.age - G.ATHLETIC_FROM) * G.ATHLETIC_PER_YEAR;
    G.ATHLETIC.forEach(function (k) { shape[k] -= athletic; });
    var craft = Math.min(G.SKILL_MAX, Math.max(0, p.age - G.SKILL_FROM) * G.SKILL_PER_YEAR);
    G.SKILL.forEach(function (k) { shape[k] += craft; });
    // Center the shape so LEVEL means the same thing for every archetype
    var mean = SKILLS.reduce(function (s, k) { return s + shape[k]; }, 0) / SKILLS.length;
    SKILLS.forEach(function (k) { shape[k] -= mean; });
    shape.$stamina = rng.normal() * 7 - Math.max(0, p.age - G.STAMINA_FROM) * G.STAMINA_PER_YEAR;
    return shape;
  }

  // Attributes for a skill level. Stamina tracks the level loosely (its own
  // offset in shape.$stamina) so the solver sees every weighted attribute.
  function attributesAt(shape, level) {
    var out = {};
    SKILLS.forEach(function (k) { out[k] = Math.round(clamp(level + shape[k], C.ATTRIBUTE_MIN, C.ATTRIBUTE_MAX)); });
    out.stamina = Math.round(clamp(62 + (level - 70) * 0.4 + shape.$stamina, 35, 99));
    return out;
  }

  // Find the skill level whose attributes compute to the target overall
  function solveLevel(shape, position, target) {
    var lo = 0, hi = 160;
    for (var i = 0; i < 30; i++) {
      var mid = (lo + hi) / 2;
      if (overallFromAttributes(attributesAt(shape, mid), position) < target) lo = mid; else hi = mid;
    }
    // pick the closer of the two neighbours
    var a = attributesAt(shape, lo), b = attributesAt(shape, hi);
    var oa = overallFromAttributes(a, position), ob = overallFromAttributes(b, position);
    return Math.abs(ob - target) <= Math.abs(oa - target) ? { level: hi, attrs: b } : { level: lo, attrs: a };
  }

  /* --- potential --------------------------------------------------------- */

  function growthFor(age) {
    var g = C.GROWTH_BY_AGE;
    if (g[age] != null) return g[age];
    return age < 18 ? g[18] : 0;
  }

  function potentialFor(rng, overall, age, opts) {
    opts = opts || {};
    var base = opts.growthMean != null ? opts.growthMean : growthFor(age);
    var growth = 0;
    var H = C.HEADROOM;
    base *= clamp((99 - overall) / H.SCALE, H.MIN, H.MAX);   // development slows near the top
    if (base > 0) {
      growth = base * Math.exp(rng.normal() * C.GROWTH_SPREAD - C.GROWTH_SPREAD * C.GROWTH_SPREAD / 2) + rng.normal() * C.GROWTH_NOISE;
      if (age <= 22 && rng.chance(opts.generationalChance != null ? opts.generationalChance : C.GENERATIONAL_CHANCE)) growth += rng.int(12, 22);
    } else if (age >= 24 && age <= 27 && rng.chance(C.LATE_BLOOMER_CHANCE)) {
      growth = rng.int(3, 8);                                  // late bloomer
    }
    return Math.round(clamp(overall + Math.max(0, growth), overall, 99));
  }

  /* --- one player ---------------------------------------------------------- */

  /**
   * @param rng   seeded generator
   * @param p     { position, age, heightIn, targetOverall }
   * @param opts  { potential: {growthMean, generationalChance} }
   * @returns { archetype, archetypeSecondary, attributes, overall, potential }
   */
  function generatePlayer(rng, p, opts) {
    var arch = pickArchetype(rng, p.position);
    var shape = buildShape(rng, p, arch);
    var solved = solveLevel(shape, p.position, p.targetOverall);
    var attrs = solved.attrs;
    var G = C.AGING;
    attrs.durability = Math.round(clamp(78 + rng.normal() * 10 - Math.max(0, p.age - G.DURABILITY_FROM) * G.DURABILITY_PER_YEAR, 30, 99));
    var ordered = {};
    KEYS.forEach(function (k) { ordered[k] = attrs[k]; });
    var overall = overallFromAttributes(ordered, p.position);     // never assigned: computed
    return {
      archetype: arch.primary.id,
      archetypeSecondary: arch.secondary ? arch.secondary.id : null,
      attributes: ordered,
      overall: overall,
      potential: potentialFor(rng, overall, p.age, opts && opts.potential)
    };
  }

  /* --- league talent pool -------------------------------------------------- */

  function bandProbabilities() {
    var total = C.OVERALL_BANDS.reduce(function (s, b) { return s + b.count; }, 0);
    return C.OVERALL_BANDS.map(function (b) { return { band: b, p: b.count / total }; });
  }

  // n target overalls following the league distribution (with natural variation)
  function drawOveralls(rng, n) {
    var probs = bandProbabilities().slice().reverse();          // low -> high
    var out = [];
    for (var i = 0; i < n; i++) {
      // jittered stratified sampling: close to the targets, never identical
      var u = clamp((i + rng.next() * 3 - 1) / n, 0, 0.999999);
      var acc = 0, band = probs[probs.length - 1].band;
      for (var j = 0; j < probs.length; j++) { acc += probs[j].p; if (u < acc) { band = probs[j].band; break; } }
      var span = band.max - band.min + 1;
      out.push(band.min + Math.min(span - 1, Math.floor(span * Math.pow(rng.next(), C.BAND_SKEW))));
    }
    return rng.shuffle(out);
  }

  var TYPE_IDS = Object.keys(C.TEAMS.TYPES);

  // Competitive outlook from franchise strength (+ chance), never market size
  function teamProfile(rng, team) {
    var T = C.TEAMS;
    var strength = ((team.overall != null ? team.overall : T.STRENGTH_CENTER) - T.STRENGTH_CENTER) / T.STRENGTH_SCALE + rng.normal() * T.STRENGTH_NOISE;
    var type;
    if (strength > 1.1) type = weightedPick(rng, [['contender', 3], ['star-led', 2], ['deep', 1.5], ['veteran', 1.5]]);
    else if (strength > 0.2) type = weightedPick(rng, [['star-led', 2], ['deep', 2], ['middle', 2], ['veteran', 1.5], ['contender', 0.8]]);
    else if (strength > -0.8) type = weightedPick(rng, [['middle', 3], ['deep', 1], ['star-led', 1], ['veteran', 1], ['rebuilding', 1.2]]);
    else type = weightedPick(rng, [['rebuilding', 3], ['poor', 2], ['middle', 1], ['star-led', 0.5]]);
    return { strength: strength, type: type };
  }

  /**
   * Hands the league's overall values to teams: best values first, each to
   * a team chosen with probability by strength x type x open slots.
   * @returns { teamId: [overall, ...] }
   */
  function allocate(rng, teams, sizes, profiles) {
    var T = C.TEAMS;
    var total = teams.reduce(function (s, t) { return s + sizes[t.id]; }, 0);
    var values = drawOveralls(rng, total).sort(function (a, b) { return b - a; });
    var rosters = {}, open = {}, elite = {};
    teams.forEach(function (t) { rosters[t.id] = []; open[t.id] = sizes[t.id]; elite[t.id] = 0; });
    values.forEach(function (v) {
      var pull = T.LOW_PULL + (T.HIGH_PULL - T.LOW_PULL) * clamp((v - T.PULL_FROM) / (T.PULL_TO - T.PULL_FROM), 0, 1);
      var entries = teams.filter(function (t) {
        return open[t.id] > 0 && !(v >= T.ELITE && elite[t.id] >= T.MAX_ELITE_PER_TEAM);
      }).map(function (t) {
        var pr = profiles[t.id];
        var ty = T.TYPES[pr.type];
        var w = Math.exp(pull * pr.strength) * Math.sqrt(open[t.id]);
        if (v >= T.ELITE) w *= (ty.firstEliteOnly && elite[t.id] > 0) ? 0.5 : ty.elite;
        else if (v >= 78) w *= ty.good;
        return [t.id, w];
      });
      if (!entries.length) entries = teams.filter(function (t) { return open[t.id] > 0; }).map(function (t) { return [t.id, open[t.id]]; });
      var id = weightedPick(rng, entries);
      rosters[id].push(v);
      open[id]--;
      if (v >= T.ELITE) elite[id]++;
    });
    return rosters;
  }

  function ageFor(rng, overall, type) {
    var G = C.AGE;
    var shift = G.TEAM_SHIFT[type] || 0;
    var age;
    if (overall >= G.STAR.minOverall) age = G.STAR.mean + rng.normal() * G.STAR.sd;
    else if (overall >= G.STARTER.minOverall) age = G.STARTER.mean + rng.normal() * G.STARTER.sd;
    else if (overall >= G.ROTATION.minOverall) age = G.ROTATION.mean + rng.normal() * G.ROTATION.sd;
    else age = rng.chance(G.BENCH_YOUNG.share) ? G.BENCH_YOUNG.mean + rng.normal() * G.BENCH_YOUNG.sd : G.BENCH_VETERAN.mean + rng.normal() * G.BENCH_VETERAN.sd;
    return Math.round(clamp(age + shift, G.MIN, G.MAX));
  }

  /* --- draft classes ------------------------------------------------------ */

  /**
   * A class of incoming prospects with its own distribution (far below
   * established pros), varying in quality from year to year.
   * @returns [{ position, age, heightIn, archetype, attributes, overall, potential }]
   */
  function generateDraftClass(seed, opts) {
    opts = opts || {};
    var D = C.DRAFT;
    var rng = R.rng('draft-class:' + seed);
    var size = opts.size || D.SIZE;
    var quality = rng.normal() * D.QUALITY_SD;
    var heights = { PG: [72, 77], SG: [75, 79], SF: [78, 81], PF: [80, 83], C: [82, 86] };
    var ages = Object.keys(D.AGE_WEIGHTS).map(function (a) { return [Number(a), D.AGE_WEIGHTS[a]]; });
    var out = [];
    for (var i = 0; i < size; i++) {
      var position = POSITIONS[i % POSITIONS.length];
      var age = weightedPick(rng, ages);
      var target = D.OVERALL_MEAN + quality + rng.normal() * D.OVERALL_SD + (age - 20) * 1.2;
      if (rng.chance(D.NBA_READY_CHANCE)) target = rng.int(72, 80);
      target = Math.round(clamp(target, 35, 82));
      var heightIn = rng.int(heights[position][0], heights[position][1]);
      var pl = generatePlayer(rng, { position: position, age: age, heightIn: heightIn, targetOverall: target },
        { potential: { growthMean: Math.max(4, D.POTENTIAL_GROWTH_MEAN - (age - 19) * 2.5), generationalChance: D.GENERATIONAL_CHANCE } });
      pl.position = position; pl.age = age; pl.heightIn = heightIn;
      out.push(pl);
    }
    return out;
  }

  function archetypeLabel(id) { return ARCH_BY_ID[id] ? ARCH_BY_ID[id].label : null; }

  return {
    SKILLS: SKILLS,
    overallFromAttributes: overallFromAttributes,
    pickArchetype: pickArchetype,
    generatePlayer: generatePlayer,
    potentialFor: potentialFor,
    drawOveralls: drawOveralls,
    teamProfile: teamProfile,
    allocate: allocate,
    ageFor: ageFor,
    generateDraftClass: generateDraftClass,
    archetypeLabel: archetypeLabel,
    TYPE_IDS: TYPE_IDS
  };
});
