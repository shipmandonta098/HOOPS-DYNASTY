# Rivalry System - Testing Guide

## Quick Start Testing

### 1. Load Your League
- Open the game and load your existing league
- The database will automatically upgrade to version 3 (adds teamRivalries store)

### 2. Simulate Some Games
- Navigate to Schedule tab
- Click "⚡ Sim Game" on any matchup
- OR use the global sim controls to advance days

### 3. Check for Rivalries

#### Method A: Standings Tab
1. Go to **Standings** tab
2. Look for the "🔥 Top Rivals" card at the top
3. You should see your team's developing rivalries
4. Each rival shows:
   - Team name and record
   - Colored meter bar
   - Intensity label (Ice Cold → Very Hot)

#### Method B: Schedule Tab
1. Go to **Schedule** tab
2. Look for colored rivalry badges on game cards
3. Badges only appear when rivalry ≥ 40 (Warm or higher)
4. Format: "🔥 [Label]" (e.g., "🔥 Hot")

#### Method C: Game View
1. Click **"📊 View Details"** on any completed game
2. OR click **"👁️ Watch Live"** to start a game
3. Look for rivalry meter below the score
4. Meter shows horizontal bar + intensity label

## Testing Specific Features

### Test Rivalry Growth

#### Close Game Bonus
1. Sim or watch a game
2. If final margin ≤ 3 points: +8 rivalry points
3. Check rivalry increased significantly

#### Division Game Bonus
1. Find two teams in same division
2. Sim their game
3. Check rivalry increased by extra +3

#### Playoff Bonus
1. Advance to playoffs phase
2. Sim a playoff game
3. Check rivalry increased by +12

#### Upset Bonus
1. Find a game where teams have very different OVRs (≥5 difference)
2. If the weaker team wins (can try multiple times)
3. Check rivalry increased by extra +6

#### Recent Matchup Bonus
1. Find two teams playing each other
2. Note the calendar day
3. Advance the schedule until they play again within 10 days
4. Check rivalry increased by extra +3

### Test Rivalry Decay

1. Note current season number
2. Note some rivalry scores (check Standings > Top Rivals)
3. Complete the draft (advances to new season)
4. Check rivalry scores decreased by 15
5. Verify no rivalries went below 0

### Test UI Components

#### Top Rivals Card
- Should show top 5 rivalries
- Sorted by score (highest first)
- Empty state if no rivalries
- Hover effects on rival items

#### Schedule Badges
- Only show for rivalries ≥ 40
- Color matches intensity (Yellow/Orange/Red)
- Positioned above team matchup info

#### Game View Meter
- Shows in gamecast modal header
- Horizontal bar fills based on score (0-100%)
- Color matches intensity
- Only displays for rivalries ≥ 40

## Manual Verification

### Check Database
Open browser DevTools console and run:
```javascript
// Get all rivalries
openDB().then(db => {
  const tx = db.transaction('teamRivalries', 'readonly');
  const req = tx.objectStore('teamRivalries').getAll();
  req.onsuccess = () => {
    console.table(req.result);
  };
});

// Get rivalry between teams 1 and 5
getRivalry(1, 5).then(score => {
  console.log('Rivalry score:', score);
  console.log('Label:', getRivalryLabel(score));
});

// Get all rivalries for team 1
getTeamRivalries(1).then(rivalries => {
  console.log('Team 1 rivalries:', rivalries);
});
```

### Check Calculations
After simulating a game:
```javascript
// Check if game has rivalry metadata
const game = league.schedule.games['game_2026_123'];
console.log({
  isDivisionGame: game.isDivisionGame,
  isPlayoffs: game.isPlayoffs,
  upset: game.upset
});
```

## Common Issues & Solutions

### Issue: No rivalries showing
**Possible causes:**
- Haven't simulated enough games yet
- Rivalries might be below 40 (won't show badges/meters)
- Database migration didn't run

**Solution:**
- Sim at least 10-20 games
- Check browser console for errors
- Reload page to trigger DB migration

### Issue: Rivalry not updating after game
**Possible causes:**
- Game status not 'final'
- UpdateRivalryFromGame function error

**Solution:**
- Check browser console for errors
- Verify game has score data
- Try simulating another game

### Issue: Top Rivals card not showing
**Possible causes:**
- No team selected (selectedTeamId is null)
- Async loading not completing
- No rivalries for this team yet

**Solution:**
- Ensure you have a team selected
- Wait a moment for async load
- Sim more games involving your team

### Issue: Colors not showing correctly
**Possible causes:**
- CSS not loaded
- Inline styles overriding classes

**Solution:**
- Hard refresh page (Ctrl+F5)
- Check styles.css loaded
- Verify rivalry score is correct

## Regression Testing

After making any changes, verify:
1. ✅ Games still simulate correctly
2. ✅ Schedule still renders
3. ✅ Season advancement works
4. ✅ Draft completes successfully
5. ✅ Save/load league works
6. ✅ No console errors

## Performance Testing

### Large League Test
1. Create/load league with 30 teams
2. Sim full season (82 games per team)
3. Check for lag or slowdown
4. Verify rivalry updates are fast

### Expected Performance
- Rivalry lookup: <10ms
- Rivalry update after game: <50ms
- Season decay (all rivalries): <100ms
- UI rendering with rivalries: +50-100ms

## Browser Compatibility

Test in:
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari

IndexedDB is supported in all modern browsers.

## Success Criteria

✅ **Feature is working correctly if:**
1. Rivalries appear in Top Rivals card after several games
2. Rivalry scores increase after games (especially close/playoff games)
3. Rivalry badges appear on schedule for Warm+ rivalries
4. Rivalry meters display in game view for Warm+ rivalries
5. Rivalries decay by 15 at start of new season
6. No console errors related to rivalries
7. Page loads/renders without significant slowdown

## Reporting Issues

If you find bugs, note:
1. What were you doing?
2. What did you expect?
3. What actually happened?
4. Browser console errors?
5. Steps to reproduce?

Happy testing! 🏀🔥
