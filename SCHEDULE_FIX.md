# Schedule Display & Generation Fix

## Changes Made

### Part 1: UI Sorting & Validation (app.js)

#### Fixed Functions:
1. **`renderMyTeamSchedule()`**
   - Forces `game.day` to Number before sorting
   - Filters out games with invalid (NaN) day values
   - Logs warnings for invalid games
   - Ensures numeric sort: `Number(a.day) - Number(b.day)`

2. **`renderOtherTeamsSchedule()`**
   - Same fixes as My Team view
   - Validates day numbers before rendering

3. **`renderLeagueSchedule()`**
   - Forces `calendarDay` to Number
   - Logs invalid games with warnings
   - Adds debug output showing day range

4. **`renderTeamScheduleGames()`**
   - Always sorts games by day before rendering
   - Logs earliest/latest day for debugging
   - Prevents unsorted display

#### New Debug Function:
**`debugScheduleDistribution()`** - Call from console to see:
- Each team's first game day
- Total games per team (home/away split)
- Teams starting late (after day 5)
- Games per calendar day distribution
- Summary statistics

### Part 2: Schedule Generation - Opening Week Rule (schedule-generator.js)

#### Modified `assignGamesToCalendar()`:
1. **Opening Week Pass (Days 1-5)**:
   - Tracks teams needing opener in Set
   - Prioritizes scheduling games for unopened teams
   - Ensures every team plays by Day 5
   - If fails, retries with different shuffle

2. **Normal Scheduling (Days 6+)**:
   - Only schedules remaining games
   - More strict rest rules early (before day 15)
   - Continues until all games placed

3. **Validation After Placement**:
   - Checks every team's first game ≤ Day 5
   - If validation fails, retries entire placement
   - Max 5 retries with different shuffles

#### Key Variables:
- `openingDayLimit = 5` - Every team must play by this day
- `teamsNeedingOpener` - Set tracking teams without games yet
- Validation rejects schedules with late starters

### Part 3: Debug Output

Console logs now show:
```
[Schedule] Opening Week Pass: Scheduling games for days 1-5...
[Schedule] ✓ Opening Week Pass complete - all teams have games by day 5
[Schedule Generator] ✓ Validation passed: All teams start by day 5
```

## Testing

### Test 1: View Schedule UI
1. Load your league
2. Go to Schedule tab
3. Check "My Team" view - games should be in day order
4. Check "Other Teams" view - same
5. Check "League" view - calendar days should be sequential
6. Open browser console - should see debug logs

### Test 2: Debug Current Schedule
In browser console, run:
```javascript
debugScheduleDistribution()
```

This will show a table with each team's:
- First game day
- Total games
- Home/Away split

And a warning if any team starts after Day 5.

### Test 3: Generate New Schedule
1. Start a new league or new season
2. Watch console during schedule generation
3. Should see "Opening Week Pass" logs
4. Should see validation passed message
5. Run `debugScheduleDistribution()` to verify

### Expected Results
- ✅ All teams play their first game by Day 5
- ✅ Schedule views always sorted by day number
- ✅ No games show on Day 7/11 unless that's actually the day
- ✅ Console shows validation logs
- ✅ Debug function reveals distribution

## Known Constraints

1. **Opening Week Congestion**: Days 1-5 will have more games to accommodate all teams
2. **Retry Logic**: Schedule generation may take multiple attempts (max 5)
3. **Back-to-Backs**: More restrictive before Day 15 to prevent early season fatigue
4. **Max Games Per Day**: Still limited to 12 games league-wide

## Console Commands

```javascript
// View schedule distribution
debugScheduleDistribution()

// Check specific team's games
const teamId = 1; // Replace with team ID
const games = Object.values(league.schedule.games)
  .filter(g => g.homeTeamId === teamId || g.awayTeamId === teamId)
  .sort((a, b) => a.day - b.day);
console.table(games.map(g => ({
  day: g.day,
  opponent: g.homeTeamId === teamId ? g.awayTeamId : g.homeTeamId,
  location: g.homeTeamId === teamId ? 'Home' : 'Away'
})));

// Force regenerate schedule
generateSchedule()
debugScheduleDistribution()
```

## Troubleshooting

### Issue: Teams still starting late
**Solution**: 
- Check console for retry messages
- If maxRetries reached, increase `maxRetries` in schedule-generator.js
- Or adjust `openingDayLimit` to be more lenient (e.g., 7 instead of 5)

### Issue: Games not sorting properly in UI
**Solution**:
- Check browser console for "invalid day" warnings
- Verify `game.day` is a number in database
- Clear cache and reload

### Issue: Schedule generation fails
**Solution**:
- Check total games (30 teams × 82 games ÷ 2 = 1230 total)
- Verify `config.seasonDays` is sufficient (175 days)
- Reduce back-to-back constraints if needed

## Implementation Notes

- Opening week logic prioritizes matchups where both teams need openers
- Shuffle ensures variety in which teams play on opening day
- Validation runs after successful placement to catch edge cases
- Debug function is non-destructive (read-only)
- All fixes maintain backward compatibility with existing leagues
