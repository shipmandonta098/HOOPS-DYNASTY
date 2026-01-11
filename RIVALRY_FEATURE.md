# Rivalry System Feature

## Overview
The Rivalry System tracks the competitive intensity between every pair of teams in your league. Rivalries grow through exciting games and decay over time, creating a dynamic narrative layer to your basketball dynasty.

## Rivalry Scale
Rivalries are scored from 0-100 and mapped to intensity labels:
- **0-19**: Ice Cold ❄️ (Gray)
- **20-39**: Cold 🧊 (Light Blue)
- **40-59**: Warm 🔥 (Yellow)
- **60-79**: Hot 🌡️ (Orange)
- **80-100**: Very Hot 🔥🔥 (Red)

## How Rivalries Grow

### Base Gain
Every completed game adds +3 points to the rivalry between the two teams.

### Bonus Points
Additional points are awarded for:
- **Close Games**:
  - Margin ≤ 3 points: +8
  - Margin 4-5 points: +5
  - Margin 6-10 points: +2
- **Playoffs**: +12
- **Overtime**: +6
- **Upset** (winner had ≥5 lower team OVR): +6
- **Division Matchup**: +3
- **Recent Matchup** (within last 10 days): +3

### Example
A playoff game decided by 2 points between division rivals who just played each other:
- Base: 3
- Close game: 8
- Playoffs: 12
- Division: 3
- Recent matchup: 3
- **Total**: +29 points!

## Rivalry Decay
At the start of each new season, all rivalry scores are reduced by **-15 points** (minimum 0). This ensures:
- Hot rivalries stay relevant if teams keep meeting
- Old rivalries fade if teams don't play
- New storylines can emerge

## Data Storage

### Database
Created new IndexedDB store `teamRivalries`:
```javascript
{
  key: "${minTid}-${maxTid}",  // e.g., "1-5"
  tidA: 1,                      // Lower team ID
  tidB: 5,                      // Higher team ID
  score: 67,                    // Current rivalry score (0-100)
  lastUpdatedSeason: 2026,      // Season of last update
  lastUpdatedDay: 45,           // Day of last update
  history: []                   // Optional: notable events
}
```

### Key Features
- Unique key ensures no duplicates (always sorted: smaller ID first)
- Indexed by `tidA`, `tidB`, and `score` for fast queries
- Stores last update info for "recent matchup" bonus calculation

## Implementation Details

### Core Functions (db.js)
1. **`getRivalryKey(tid1, tid2)`**
   - Returns sorted key string for two teams
   - Ensures consistent lookup regardless of parameter order

2. **`getRivalryLabel(score)`**
   - Converts numeric score to text label
   - Used for UI displays

3. **`getRivalry(tid1, tid2)`**
   - Async function to fetch rivalry score from IndexedDB
   - Returns 0 if no rivalry exists

4. **`getTeamRivalries(tid)`**
   - Returns all rivalries for a specific team
   - Sorted by score (highest first)
   - Used for "Top Rivals" card

5. **`updateRivalryFromGame(game)`**
   - Called after each game completes
   - Calculates gain based on game metadata
   - Updates/creates rivalry record in IndexedDB

6. **`decayRivalriesForNewSeason(season)`**
   - Called at start of each new season
   - Reduces all rivalry scores by 15
   - Returns count of rivalries decayed

### Integration Points (engine.js)
1. **Game Completion** (simGameInstant):
   - Added metadata to game object:
     - `isDivisionGame`
     - `isPlayoffs`
     - `upset`
   - Calls `updateRivalryFromGame(game)` after each game

2. **Season Advancement** (draft completion):
   - Calls `decayRivalriesForNewSeason(league.season)` when new season starts

### UI Components (app.js)

#### 1. Top Rivals Card
Displays team's top 5 rivalries with:
- Opponent name and record
- Visual meter bar showing intensity
- Color-coded label

**Location**: Standings tab (for user's selected team)

**Function**: `renderTopRivalsCard(teamId)`

#### 2. Schedule Game Badges
Shows rivalry badge on game cards when rivalry ≥ 40 (Warm or higher):
- 🔥 emoji + intensity label
- Color-coded based on temperature
- Only appears for meaningful rivalries

**Location**: Schedule tab game cards

**Function**: `renderRivalryBadge(score, label)`

#### 3. Game View Rivalry Meter
Displays rivalry meter in game header when viewing a game:
- Full horizontal meter bar
- Intensity label
- Only shows for rivalries ≥ 40

**Location**: Game drawer/gamecast modal

**Loaded asynchronously** after game data loads

### Styling (styles.css)
Added rivalry-specific CSS classes:
- `.rivals-card` - Container for Top Rivals section
- `.rival-item` - Individual rival entry with hover effect
- `.rivalry-meter-container` - Meter bar wrapper
- `.rivalry-meter-fill` - Animated fill bar
- `.rivalry-badge` - Badge for schedule/game displays
- Responsive design for mobile devices

## User Experience

### Discovering Rivalries
1. **Play games** - Each matchup contributes to rivalry growth
2. **Check Standings** - See your team's top rivals
3. **View Schedule** - Rivalry badges highlight important games
4. **Game Details** - Rivalry meter shows intensity in game view

### Strategic Considerations
- **Playoff rematches** add significant rivalry points
- **Division games** naturally build higher rivalries
- **Back-to-back matchups** (within 10 days) intensify rivalries
- **Upsets** create rivalry spikes when underdogs win

### Narrative Depth
The rivalry system adds storylines:
- "Heated playoff rivalry continues from last season"
- "Former division rivals now in different conferences"
- "Underdog team's upset victory sparks new rivalry"
- "Longtime rivals meeting for the 5th time this season"

## Performance Considerations

### Optimizations
1. **Async Loading**: Rivalry data loads after main UI renders
2. **Cached Reads**: Uses IndexedDB's indexed queries
3. **Minimal Writes**: Only updates after game completion
4. **Batch Decay**: All rivalries decayed in single transaction

### Scalability
- 30 teams = maximum 435 unique rivalries (30 choose 2)
- Each rivalry record is small (~150 bytes)
- Total storage: ~65 KB for full league
- Queries are indexed for O(log n) lookups

## Testing Checklist

### Database
- [x] IndexedDB migration creates `teamRivalries` store
- [x] Rivalry keys always use sorted team IDs
- [x] No duplicate rivalries can be created
- [x] Score clamped to 0-100 range

### Game Updates
- [x] Rivalry updates after instant sim
- [x] Playoff games add +12 bonus
- [x] Close games add appropriate bonuses
- [x] Division games add +3 bonus
- [x] Upset detection works correctly

### Season Rollover
- [x] All rivalries decay by 15 at new season
- [x] Rivalries never go below 0
- [x] Decay happens before first game of season

### UI Display
- [x] Top Rivals card shows on Standings tab
- [x] Rivalry badges appear on Schedule games (≥40)
- [x] Game view shows rivalry meter (≥40)
- [x] Colors match intensity levels
- [x] Responsive design works on mobile

## Future Enhancements

### Potential Features
1. **Rivalry History**
   - Track memorable games in rivalry.history array
   - "Rivalry Timeline" view showing key moments
   - Season-by-season rivalry score chart

2. **Special Events**
   - "Rivalry Week" with boosted fan attendance
   - Rivalry game alerts/notifications
   - Championship rematch bonuses

3. **Broadcasting**
   - Rivalry games get special commentary
   - Play-by-play mentions rivalry intensity
   - Post-game rivalry updates shown to user

4. **Coach/Player Factors**
   - Coaches who beat former teams boost rivalry
   - Star players traded to rivals increase intensity
   - Historic playoff series bonuses

5. **Settings**
   - User-configurable decay rate
   - Adjust bonus multipliers
   - Disable/enable rivalry system

## Conclusion
The Rivalry System adds a dynamic, emergent narrative layer to your basketball dynasty simulation. It rewards exciting games, tracks historical matchups, and creates meaningful context for every game on the schedule.
