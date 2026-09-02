# Prompt: Player Development (offseason aging)

Use this in the offseason to age every player one year, adjust ratings along a
realistic career arc, and process retirements.

---

## Context Claude needs

- Logic lives in `engine/playerDevelopment.js`. The career curve:
  - **19–24**: growth toward `potential` (high basketball IQ develops faster;
    occasional breakouts).
  - **25–28**: prime — small drift either way.
  - **29+**: decline — athletic attributes fade first, skill/IQ hang on.
  - **32+**: rising retirement risk (stars hang on longer than scrubs).
- `overall` is **derived** from `attributes`. If you change attributes by hand,
  recompute overall (see `engine/lib/ratings.js` → `computeOverall`).

## Instructions to Claude

> Read `saves/example_league.json`. Run
> `node engine/playerDevelopment.js saves/example_league.json --save`.
> Then read it back and report:
>
> 1. The biggest **risers** (largest positive `overallChange`) — the young breakouts.
> 2. The biggest **decliners** — the aging vets slipping.
> 3. Any **retirements** (they were removed from `players` and added to
>    `history.retirements`).
>
> Confirm the player count dropped by exactly the number of retirements.

## Doing it by hand (no code)

Tell Claude:

> For each player: increment `age`. If age <= 24, nudge attributes UP toward
> `potential` (bigger jumps the further below the ceiling, extra for high
> basketballIQ). If 25–28, tiny random drift. If 29+, reduce attributes
> (athleticism/insideScoring fastest; passing/IQ slowest). Recompute `overall` from
> the new attributes. Roll retirement for players 32+ (more likely when older and
> lower-rated); remove retirees from `players` and append them to
> `history.retirements`. Keep everything else untouched.

## Output format

Human summary first (risers / decliners / retirements), then the updated JSON as one
```json block, 2-space indent. Only `attributes`, `age`, `overall`, and the
`history.retirements` list should change.

## Ordering reminder

Run development **after** simulating the season and **before** updating contracts and
generating the next draft class.
