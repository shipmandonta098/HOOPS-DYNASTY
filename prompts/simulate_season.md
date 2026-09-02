# Prompt: Simulate a Season

Use this when you want Claude to advance the league by one full season
(regular season + playoffs) and record the results.

---

## Context Claude needs

- The save file lives at `saves/<your_league>.json` (default: `saves/example_league.json`).
- The canonical logic already exists in `engine/simulateSeason.js`. **Prefer running
  the code** — it is deterministic and correct. Ask Claude to *narrate* results, not
  to invent them.

## Instructions to Claude

> Read `saves/example_league.json`. Run `node engine/simulateSeason.js saves/example_league.json --save`
> to simulate season `meta.currentSeason`. Then:
>
> 1. Read the updated file back.
> 2. Summarize the final standings, the champion, the runner-up, and the MVP in a
>    short, readable recap (like a sports-page wrap-up).
> 3. Confirm that `meta.currentSeason` advanced by one and `meta.currentPhase` is now
>    `"offseason"`.
> 4. Do **not** hand-edit game results — the engine is the source of truth.

## If you want Claude to simulate WITHOUT running code

Only do this if you can't run Node. Tell Claude:

> Read the league JSON. For each pair of teams, estimate a win probability from each
> team's roster strength (average of the top 8 players' overalls, starters weighted
> higher). Produce a plausible win/loss record, sort into standings, simulate a
> 4-team bracket, and pick a champion. Then **append** a season summary to
> `history.seasons` and `history.champions` using the exact shape already present in
> the file, increment the champion's `championships`, set `meta.currentPhase` to
> `"offseason"`, and increment `meta.currentSeason`.

## Output format

Return **only** the updated JSON when writing back, as a single fenced ```json block,
with 2-space indentation, no commentary inside the block. Put the human recap
*before* the block.

## After simulating

Remind the user of the yearly cycle: next run **player development**, then
**contracts**, then **generate the next draft class**, then run the **draft** and
**free agency** — see the other prompt files.
