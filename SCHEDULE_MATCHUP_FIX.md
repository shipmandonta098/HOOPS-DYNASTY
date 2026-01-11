# Schedule Matchup Generation Fix

## Problem
Schedule generation was producing incorrect game counts:
- Total games: 1226 instead of 1230
- Some teams had 80-81 games instead of 82
- Home/away balance not guaranteed to be 41/41

## Root Cause
The previous round-robin approach didn't respect NBA-style matchup distribution rules and wasn't enforcing symmetry in the matchup matrix.

## Solution
Complete rewrite of matchup generation with proper NBA distribution and validation.

### Hard Requirements Met

1. **Exactly 82 games per team**
   - Division opponents (4 teams): 4 games each = 16 games
   - Same conference non-division (10 teams): 6 opponents × 4 games + 4 opponents × 3 games = 36 games
   - Other conference (15 teams): 2 games each = 30 games
   - Total: 16 + 36 + 30 = **82 games**

2. **Exactly 1230 total games**
   - (30 teams × 82 games) / 2 = 1230

3. **Balanced home/away: 41 home, 41 away per team**
   - Even matchups (2x, 4x): Split evenly
   - Odd matchups (3x): Extra home game goes to team with fewer home games
   - Balancing pass flips games if needed to reach exactly 41/41

4. **Symmetric matchup matrix**
   - If Team A plays Team B 4 times, Team B plays Team A 4 times
   - 4x/3x assignments for same-conference games done symmetrically

### Implementation

#### Step 1: Build Symmetric Matchup Matrix
```javascript
buildMatchupMatrix(teams) {
  // Create numTeams × numTeams matrix
  
  // Set division games: 4 each
  // Set inter-conference games: 2 each
  // Set same-conference non-division:
  //   - 6 opponents get 4 games
  //   - 4 opponents get 3 games
  //   - Maintain symmetry during assignment
  
  return gamesVs matrix
}
```

#### Step 2: Validate Matrix
```javascript
validateMatchupMatrix(gamesVs, teams, 82) {
  // Check symmetry: gamesVs[i][j] === gamesVs[j][i]
  // Check each team total: sum(gamesVs[i]) === 82
  // Check total games: sum(all) / 2 === 1230
  
  return { valid, errors }
}
```

#### Step 3: Convert Matrix to Games
```javascript
convertMatrixToGames(gamesVs, teams, season) {
  // For each team pair (i, j):
  //   - Get numGames from matrix
  //   - Determine home/away split:
  //       * Even: split evenly
  //       * Odd: extra home to team with fewer home games
  //   - Create game objects
  
  return allGames
}
```

#### Step 4: Balance Home/Away
```javascript
balanceHomeAway(allGames, teams, homeCount, awayCount) {
  // Find teams needing more home games
  // Find teams needing more away games
  // Flip games between matching teams to reach 41/41
}
```

#### Step 5: Final Validation
```javascript
validateFinalSchedule(allGames, teams, 82, 1230) {
  // Check total games === 1230
  // Check each team:
  //   - total games === 82
  //   - home games === 41
  //   - away games === 41
  // Check no duplicates
  // Check no team plays itself
  
  return { valid, errors }
}
```

### Retry Logic

- Up to 100 attempts to generate valid schedule
- Each attempt uses different random shuffle for 4x/3x assignments
- If validation fails, detailed error logging shows which invariant failed
- Never persists partial/invalid schedules

### Console Logging

```
[Schedule] Attempt 1: Matrix validation failed: ["Team 5 (Thunder): 81 games (expected 82)"]
[Schedule] Attempt 2: Final validation failed: ["Total games: 1227 (expected 1230)"]
[Schedule] ✓ Valid schedule generated on attempt 3
[Schedule] ✓ Total games: 1230, Games per team: 82
```

### Testing

To verify the fix works:

1. **Create new league** or **advance to next season**
2. **Open browser console** before schedule generation
3. **Watch for validation logs** - should succeed quickly (1-5 attempts)
4. **After generation**, verify:
   - No errors in console
   - All teams have exactly 82 games
   - Total games = 1230
   - Home/away split = 41/41 for all teams

### Manual Verification

Run this in console after league loads:
```javascript
// Count games per team
const teamGames = {};
Object.values(league.schedule.games).forEach(game => {
  teamGames[game.homeTeamId] = (teamGames[game.homeTeamId] || 0) + 1;
  teamGames[game.awayTeamId] = (teamGames[game.awayTeamId] || 0) + 1;
});

console.log('Games per team:', teamGames);
console.log('Total games:', Object.keys(league.schedule.games).length);
console.log('All teams have 82?', Object.values(teamGames).every(c => c === 82));
```

### Files Modified

- `schedule-generator.js`:
  - `generateAllMatchupsWithHomeAway()` - Complete rewrite with retry logic
  - `buildMatchupMatrix()` - New function for NBA-style distribution
  - `validateMatchupMatrix()` - New validation function
  - `convertMatrixToGames()` - New conversion with home/away balancing
  - `balanceHomeAway()` - New balancing pass
  - `validateFinalSchedule()` - New final validation

### Expected Behavior

**Every generated schedule will now have:**
- ✓ Exactly 1230 games
- ✓ Exactly 82 games per team
- ✓ Exactly 41 home / 41 away per team
- ✓ Proper division/conference distribution
- ✓ Symmetric matchups

**If generation fails:**
- Error thrown after 100 attempts
- Console shows which validation failed
- User sees error message (schedule not created)
