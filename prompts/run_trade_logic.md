# Prompt: Run Trade Logic

Use this to have Claude propose, evaluate, and (optionally) execute trades —
either for one team or across the league.

---

## Context Claude needs

- Trade valuation lives in `engine/tradeAI.js` + `engine/lib/ratings.js`.
  - `tradeValue(player)` blends current ability, upside (young + high potential),
    and contract friendliness.
  - `teamMode(league, teamId)` classifies a team as `contender` / `balanced` /
    `rebuilding`, which shifts what it values.
  - `evaluateTrade` / `executeTrade` / `suggestTrade` are the callable functions.
- A trade only goes through if **both** sides come out fair-or-better *by their own
  preferences* (tolerance 90%).

## Instructions to Claude

> Read `saves/example_league.json`. I want to explore trades for **<TEAM_ID>**.
>
> 1. Run `node engine/tradeAI.js saves/example_league.json <TEAM_ID>` to get an
>    engine-suggested deal, OR reason about a specific proposal I give you.
> 2. For any proposal, report each side's value given/received, each team's mode,
>    and whether both accept.
> 3. If I approve a deal, execute it (re-run with `--save`, or update the JSON):
>    - set `teamId` on every traded player to their new team,
>    - append a `{ "type": "trade", ... }` entry to `history.transactions`.
> 4. Never move a player without updating BOTH `teamId` and the transaction log.

## Evaluating a proposal by hand (no code)

Tell Claude:

> For each player in the deal, estimate trade value from overall, age (younger is
> worth more when there's unrealized potential), and salary (cheap = bonus,
> overpaid = penalty). A team accepts if what it receives is >= 90% of what it gives
> up, weighted by its mode (rebuilders love youth, contenders love proven stars).
> Show your math per side before concluding.

## Output format

- First: a plain-English verdict (who accepts, why, fairness).
- Then, if executing: the updated JSON as a single ```json block, 2-space indent,
  changes limited to the affected players' `teamId` and the new transaction entry.

## Guardrails

- Respect `settings.maxRosterSize` — don't leave a team illegally large/small.
- Don't invent players or ids. Only trade players that exist in `players`.
