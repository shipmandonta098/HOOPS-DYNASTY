# Prompt: Explain the League State

Use this any time you want Claude to read the save file and tell you what's going on —
no changes, just analysis. Great for orienting yourself before making decisions.

---

## Context Claude needs

- Everything is in `saves/example_league.json`. This prompt is **read-only** —
  Claude should NOT modify or write the file.
- Quick summary command: `node engine/saveLoad.js saves/example_league.json`.

## Instructions to Claude

> Read `saves/example_league.json` (do not modify it). Give me a briefing:
>
> 1. **Where we are**: `meta.currentSeason` and `meta.currentPhase`.
> 2. **Power rankings**: rank the teams by roster strength (average of each team's
>    top 8 players' overalls, starters weighted higher — same idea as
>    `engine/lib/ratings.js` → `teamStrength`). One line each with their best player.
> 3. **Stars to watch**: the top 5 players league-wide by overall, and the top 3
>    young players (age <= 23) by potential.
> 4. **Cap & roster health**: any team over `settings.salaryCap`, any team with an
>    unusually small/large roster vs `settings.maxRosterSize`, and the current free
>    agents (`freeAgents`).
> 5. **History**: last champion (from `history.champions`) and any notable
>    retirements.
>
> Keep it tight and skimmable — bullet points, not essays.

## Output format

Plain markdown. **No JSON block** — this prompt never rewrites the file. If the user
then asks to make a change, switch to the relevant action prompt
(simulate / trade / draft / development / contracts).

## Handy questions to answer on request

- "Who should team X target in free agency?" → cross-reference `freeAgents` with the
  team's positional needs and cap space.
- "Which contracts are bad?" → compare each player's `contract.salary` to a fair value
  for their overall (`engine/updateContracts.js` → `fairSalary`).
- "Who's most likely to be traded?" → high `tradeValue` players on teams whose `mode`
  doesn't match their timeline (old star on a rebuilder, project on a contender).
