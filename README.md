# 🏀 Hoops Dynasty

A **prompt-driven, multi-year basketball GM simulator** built around a single JSON
save file. Run seasons, develop players, hold drafts, make trades, manage contracts,
and build a league history that spans decades — either by running the code directly or
by driving it with Claude using the prompt templates in [`/prompts`](./prompts).

Everything is **deterministic** (seeded RNG), **modular** (each module is a pure
`league → league` function), and **AI-friendly** (one readable JSON file that Claude
can read, reason about, and rewrite).

---

## The one big idea: a single source of truth

The **entire league** — teams, every player, the draft class, free agents, and the
full history — lives in one JSON file (`saves/example_league.json`). There's no
database, no hidden state. Every module reads that object and returns an updated copy.

```
saves/example_league.json   ← the whole world, in one file
        │
        ▼
   engine module (pure function: league → league)
        │
        ▼
saves/example_league.json   ← rewritten, pretty-printed
```

Because the state is just JSON, **Claude can operate on it directly**: read it, explain
it, simulate against it, and hand you back a clean updated file.

---

## Repository layout

```
hoops-dynasty/
├── schemas/                 JSON Schemas (the contract for the save file)
│   ├── league.schema.json      top-level state (references the others)
│   ├── team.schema.json
│   ├── player.schema.json      also used for prospects & free agents
│   ├── draft.schema.json
│   └── history.schema.json
├── saves/
│   └── example_league.json  a ready-to-play league: 5 teams, 50 players, a draft class
├── engine/                  modular simulation logic (Node, plain CommonJS)
│   ├── lib/
│   │   ├── rng.js              seeded deterministic RNG (the backbone)
│   │   ├── ratings.js          overall / team strength / trade value
│   │   └── names.js            name pools for generated players
│   ├── saveLoad.js          read/write + validate the JSON
│   ├── simulateSeason.js    regular season + playoffs + history
│   ├── playerDevelopment.js aging, growth, decline, retirement
│   ├── generateDraftClass.js create a prospect pool
│   ├── tradeAI.js           value, propose, evaluate, execute trades
│   └── updateContracts.js   age contracts, expirations, free agency, cap
├── prompts/                 templates for driving the sim with Claude
├── scripts/
│   └── buildExampleLeague.js  regenerate saves/example_league.json from scratch
└── package.json             npm script shortcuts
```

---

## Requirements

- **Node.js 17+** (uses `structuredClone`; tested on Node 22). No external
  dependencies — nothing to `npm install`.

---

## Quick start

```bash
# 1. (Optional) regenerate the example league from scratch — deterministic.
node scripts/buildExampleLeague.js

# 2. See what's in the league.
node engine/saveLoad.js saves/example_league.json

# 3. Play a season (dry run prints results; add --save to commit them).
node engine/simulateSeason.js saves/example_league.json
node engine/simulateSeason.js saves/example_league.json --save
```

Every module follows the same CLI pattern:

```bash
node engine/<module>.js <path-to-save.json> [--save]
```

Without `--save` it's a **dry run** — it prints what *would* happen and touches
nothing. With `--save` it writes the updated league back to the file.

There are also npm shortcuts (see `package.json`): `npm run sim`, `npm run develop`,
`npm run draft-class`, `npm run contracts`, `npm run trade`, `npm run new-league`.

---

## The yearly cycle

A single season of a dynasty is these steps, **in order**:

| # | Step | Module | What changes |
|---|------|--------|--------------|
| 1 | Play the season | `simulateSeason.js` | standings, champion, MVP, player stats, `history`; advances the clock to `offseason` |
| 2 | Develop players | `playerDevelopment.js` | ages everyone 1 year; ratings rise/fall; retirements |
| 3 | Update contracts | `updateContracts.js` | decrements deals; expired players → free agents; cap report |
| 4 | Free agency *(prompt)* | — | sign free agents (`signFreeAgent`) — a strategy step, so it's prompt-driven |
| 5 | Generate draft class | `generateDraftClass.js` | new prospect pool in `league.draft` |
| 6 | Run the draft *(prompt)* | — | assign prospects to teams (reverse-standings order) |

Run one full loop and you've advanced the league a year. Run it ten times and you've
got a decade of history, aging stars, and rookies who became legends.

```bash
node engine/simulateSeason.js     saves/example_league.json --save
node engine/playerDevelopment.js  saves/example_league.json --save
node engine/updateContracts.js    saves/example_league.json --save
node engine/generateDraftClass.js saves/example_league.json --save
# then use the prompts to run free agency + the draft
```

---

## How each module works

### `engine/lib/rng.js` — determinism
The master seed lives in `meta.rngSeed`. Every module derives its **own** sub-stream
via `RNG.forStream(seed, label)`, so the draft generator and the season simulator never
step on each other's numbers. **Nothing in the engine calls `Math.random()`** — same
seed + same actions ⇒ identical league, every time. That's what makes results
reproducible and debuggable.

### `engine/lib/ratings.js` — how good is a player?
`overall` is **derived** from a player's `attributes`, weighted by position (a center's
overall leans on interior scoring/D/rebounding; a point guard's on playmaking + perimeter
skill). This file also computes **team strength** (minutes-weighted top-8) and
**trade value** (ability + youth/upside + contract friendliness). Change an attribute and
everything downstream updates automatically.

### `engine/simulateSeason.js`
Builds a balanced schedule, simulates each game from team strength plus a seeded nightly
swing, computes standings, runs a best-of-7 playoff bracket, crowns a champion, records
per-player stat lines, and appends a full summary to `history`. Then advances
`meta.currentSeason` and sets the phase to `offseason`.

### `engine/playerDevelopment.js`
Applies a realistic career arc: growth toward `potential` for the young, a stable prime,
decline for the aging (athletic tools fade first, IQ last), and retirement risk for vets.
Retirees leave `players` and are remembered in `history.retirements`.

### `engine/generateDraftClass.js`
Produces a pool of raw 18–22-year-olds with a **current** ability and a **potential**
ceiling. Talent depth is controlled by a `TIERS` table (a few franchise players, some
stars, lots of role players). Prospects are just `Player` objects with `teamId: null`.

### `engine/tradeAI.js`
Values players, classifies each team's window (`contender` / `balanced` / `rebuilding`),
and only lets a trade through when **both** sides come out fair-or-better *by their own
preferences*. `suggestTrade` scans the league for a deal that helps a given team.

### `engine/updateContracts.js`
Ages every contract a year, sends expired players to free agency, and produces a per-team
**cap report**. Actually *signing* free agents (`signFreeAgent`) is exposed but left for a
strategy/prompt step — who to sign is a decision, not bookkeeping.

### `engine/saveLoad.js`
The only file that touches disk. Loads + validates the JSON (fail fast with a clear
message), writes it back pretty-printed (clean diffs), and offers lookup helpers
(`playersByTeam`, `getPlayer`, `getTeam`).

---

## Using Claude with the prompts

The [`/prompts`](./prompts) folder has a template for each major action. Each one tells
Claude exactly **how to read** the JSON, **how to update** it, and **how to output** the
result cleanly (a human recap, then the updated file as a single fenced ```json block).

| Prompt | Use it to… |
|--------|-----------|
| [`simulate_season.md`](./prompts/simulate_season.md) | play a season and get a recap |
| [`player_development.md`](./prompts/player_development.md) | age players + process retirements |
| [`generate_draft_class.md`](./prompts/generate_draft_class.md) | create prospects and run the draft |
| [`run_trade_logic.md`](./prompts/run_trade_logic.md) | propose / evaluate / execute trades |
| [`explain_league_state.md`](./prompts/explain_league_state.md) | read-only briefing: power rankings, stars, cap health |

**Recommended workflow:** let Claude *run the engine* (`node engine/...`) for anything
mechanical — it's deterministic and correct — and use Claude's judgment for the
*decisions* (who to draft, which trades to make, who to sign). The prompts also include
"do it by hand (no code)" fallbacks for when you can't run Node.

> Tip: when Claude rewrites the save, have it output **only** the JSON in a single
> ```json block with 2-space indentation, so you can drop it straight back into
> `saves/`.

---

## Expanding the project

The whole thing is designed to grow. A few natural next steps, easiest first:

- **Free agency** — turn `signFreeAgent` into a full market: each free agent weighs
  offers (money, team quality, role) and picks. Prompt-drive the negotiation.
- **Injuries** — add an `injury` field to players; roll injuries during
  `simulateSeason` that reduce availability/effectiveness; recover over the offseason.
- **Scouting** — give prospects *hidden* true potential and a *visible* scouted range
  that narrows as you spend scouting resources. Reward good drafting.
- **Morale** — a per-player `morale` (0–100) driven by winning, role, and minutes;
  feeds back into development and free-agency decisions.
- **Chemistry** — a per-team modifier from roster continuity and fit; nudges team
  strength up or down in `simulateSeason`.

**How to add a field safely:** the schemas use `additionalProperties: true`, and modules
ignore fields they don't know about, so you can add data without breaking older code.
When you make a *breaking* change to the shape, bump `schemaVersion` and write a small
migration.

**How to add a whole module:** copy the pattern — export a pure `myModule(league) →
league` function that derives randomness via `RNG.forStream(league.meta.rngSeed, 'label')`,
never mutates its input (use `cloneLeague`), and appends to `history` when something
noteworthy happens. Add a `require.main === module` CLI block so it runs standalone.

---

## Design principles (why it's built this way)

1. **One JSON file = the whole league.** Easy to read, diff, back up, and hand to an AI.
2. **Pure functions.** Every module is `league → league`; only `saveLoad.js` does I/O.
3. **Determinism by default.** All randomness flows through one seeded RNG.
4. **Derived over stored.** `overall` comes from `attributes`; a roster comes from
   filtering `players`. Fewer things to keep in sync.
5. **Expandable by construction.** Extra fields are welcome; schemas are versioned.

---

## License

MIT — do whatever you want with it. Build your dynasty.
