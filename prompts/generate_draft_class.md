# Prompt: Generate a Draft Class (and run the draft)

Use this to create a new class of prospects and/or to conduct the draft.

---

## Context Claude needs

- `engine/generateDraftClass.js` creates the prospect pool and writes it to
  `league.draft`. Prospects are just `Player` objects with `teamId: null` and
  `contract: null`, sorted best-first with a `projectedPick`.
- Talent spread is controlled by the `TIERS` table in that module
  (franchise / star / starter / rotation / fringe).

## Instructions to Claude — generate the class

> Read `saves/example_league.json`. Run
> `node engine/generateDraftClass.js saves/example_league.json --save`
> to generate the draft class for `meta.currentSeason`. Then read it back and give me
> a short scouting report on the top 5 prospects (name, position, overall, potential,
> tier, a one-line comp).

## Instructions to Claude — run the draft

> Build `draft.order` in **reverse standings order** from the most recent
> `history.seasons` entry (worst team picks first). Then, pick by pick:
>
> 1. For each team on the clock, pick the best available prospect that fits its needs
>    (position gaps on its roster, best-player-available if no clear need).
> 2. When a prospect is drafted:
>    - set the prospect's `teamId` to the drafting team,
>    - give it a rookie contract: `{ "salary": <2–6 based on pick>, "yearsRemaining": 3,
>      "type": "rookie", "playerOption": false, "teamOption": true }`,
>    - **move** it from `draft.prospects` into the top-level `players` array,
>    - set that slot's `playerId` in `draft.order`,
>    - append a `{ "type": "draft_pick", "season": <year>, "playerId", "teamId", "pick" }`
>      entry to `history.transactions`.
> 3. When every pick is made, set `draft.completed` to `true`.

## Output format

Return the updated JSON as one ```json block (2-space indent). Before it, print a
readable draft board: `Pick N — TEAM selects NAME (POS, OVR/POT)`.

## Notes for expansion

- Add draft-pick trading by putting future picks as tradeable assets in
  `history.transactions` / a new `assets` array.
- Add a lottery by weighting the top of `draft.order` by inverse record instead of
  strict reverse order.
