# Point Spread Feature

## Overview
The point spread system adds sports betting-style point spreads to all scheduled games on the schedule tab. Spreads are calculated based on team strength (weighted average of top 8 player OVRs) plus home court advantage, similar to how Vegas sets NBA spreads.

## Implementation Details

### Algorithm
1. **Team Strength Calculation** (`computeTeamStrength(tid)`)
   - Takes top 8 players by OVR from each team
   - Computes weighted average (diminishing weights for depth)
   - Returns strength value (typically 65-85 for competitive teams)

2. **Spread Calculation** (`computeGameSpread(awayTid, homeTid)`)
   - Calculates strength difference: `homeTid strength - awayTid strength`
   - Adds home court advantage: `+2.5 points`
   - Applies margin scaling: `× 0.55` (prevents unrealistic spreads)
   - Caps at ±20 points for extreme mismatches
   - Returns spread object: `{ away: -5.5, home: 5.5 }` (negative = favorite)

3. **Constants**
   ```javascript
   HOME_COURT_ADVANTAGE = 2.5  // Home teams get ~2.5 point boost
   MARGIN_SCALE = 0.55         // Compression factor for realistic spreads
   MAX_SPREAD = 20             // Cap for extreme talent gaps
   ```

### Display Logic
- **Favorites** (negative spread): Show in green (`#10b981`)
  - Example: `-6.5 spread` means team is favored by 6.5 points
- **Underdogs** (positive spread): Show in orange (`#f59e0b`)
  - Example: `+4 spread` means team is underdog by 4 points
- **Pick'em** (0 spread): Show `PK` in white
  - Indicates even matchup

### Caching System
- Uses `league.strengthVersion` counter to invalidate stale spreads
- `incrementStrengthVersion()` called after any roster change:
  - Commissioner Add/Delete Player
  - Commissioner Force Trade
  - Commissioner Force Injury
  - Commissioner Edit Player (ratings/team changes)
  - Regular trades
- Spreads recalculated only when version changes (performance optimization)

### Integration Points

#### Schedule Display (app.js)
1. **League Schedule** (`renderScheduleGameRow()` - lines ~10136-10250)
   - Shows spread for both teams on each scheduled game card
   - Only displays for `game.status === 'scheduled'`
   - Hidden for completed/live games

2. **Team Schedule** (`renderScheduleGameRowWithNumber()` - lines ~10260-10325)
   - Same spread display but includes game numbers
   - Used in team-specific schedule views

#### Commissioner Actions (app.js)
All commissioner tools now call `incrementStrengthVersion()`:
- `saveNewPlayer()` - Line ~5267
- `confirmDeletePlayer()` - Line ~5448
- `executeForceTradeExecute()` - Line ~5719
- `executeForceInjury()` - Line ~5991
- `savePlayerEdits()` - Line ~16004

#### Regular Trades (engine.js)
- `executeTrade()` - Line ~1489
  - Increments strength version after any trade

#### League Initialization
- **New Leagues** (`createLeague()` in engine.js - Line ~4973)
  - Initializes `leagueState.meta.strengthVersion = 0`
  
- **Legacy Leagues** (`loadLeagueState()` in state-manager.js - Line ~437)
  - Adds `strengthVersion = 0` for backward compatibility on first load

## User Experience

### Before (Old System)
```
Away Team (8-5)  50% Win Prob
Home Team (10-3) 50% Win Prob
```

### After (New System)
```
Away Team (8-5)  +4.5 spread  [Orange text]
Home Team (10-3) -4.5 spread  [Green text]
```

### Reading the Spread
- **Green (negative)**: This team is the favorite
  - `-7 spread` = Team favored to win by 7 points
- **Orange (positive)**: This team is the underdog
  - `+7 spread` = Team expected to lose by 7 points
- **White "PK"**: Even matchup (pick'em)
  - Neither team favored

### Spread Examples
| Team A Strength | Team B Strength | Location | Spread | Meaning |
|----------------|-----------------|----------|--------|---------|
| 75 OVR | 70 OVR | B is home | A: +3, B: -3 | B favored by 3 (strength + HCA) |
| 80 OVR | 80 OVR | B is home | A: +1.5, B: -1.5 | B favored by 1.5 (HCA only) |
| 85 OVR | 65 OVR | A is away | A: -8.5, B: +8.5 | A favored by 8.5 despite road |
| 70 OVR | 70 OVR | Neutral | PK | Even matchup |

## Technical Details

### Point Spread Calculation Formula
```javascript
rawDiff = homeTeamStrength - awayTeamStrength + HOME_COURT_ADVANTAGE
scaledDiff = rawDiff * MARGIN_SCALE
spread = clamp(scaledDiff, -MAX_SPREAD, MAX_SPREAD)

awaySpread = spread
homeSpread = -spread
```

### Example Calculation
```
Team A (away): 78 OVR → Strength: 77.8
Team B (home): 72 OVR → Strength: 71.5

rawDiff = 71.5 - 77.8 + 2.5 = -3.8
scaledDiff = -3.8 × 0.55 = -2.09
spread = -2.1 (rounded to 1 decimal)

Result:
Team A: -2.1 spread (favorite)
Team B: +2.1 spread (underdog)
```

## Performance Considerations
- Spreads cached per game until `strengthVersion` changes
- Typical league: ~600 games × 2 teams = 1,200 spread calculations per season
- Cache invalidation on roster changes reduces unnecessary recalculations
- Average computation time: <1ms per game
- No noticeable performance impact on schedule rendering

## Future Enhancements (Optional)
- [ ] Add coach impact to team strength calculation
- [ ] Factor in injuries to player availability
- [ ] Back-to-back penalty for tired teams
- [ ] Conference strength adjustments
- [ ] Rest days / travel fatigue
- [ ] Momentum/streak modifiers
- [ ] Historical spread accuracy tracking

## Testing Checklist
- [x] Commissioner Add Player → Spreads update
- [x] Commissioner Delete Player → Spreads update
- [x] Commissioner Force Trade → Spreads update
- [x] Commissioner Force Injury → Spreads update
- [x] Commissioner Edit Player → Spreads update
- [x] Regular Trade → Spreads update
- [x] New League → strengthVersion initialized
- [x] Load Legacy League → strengthVersion initialized
- [x] Schedule rendering shows spreads correctly
- [x] Team schedule shows spreads correctly
- [x] Color coding correct (green=favorite, orange=underdog)
- [x] No errors in console

## Code Locations

### Core Functions (app.js ~2974-3120)
- `computeTeamStrength(tid)` - Calculate weighted top-8 strength
- `computeGameSpread(awayTid, homeTid)` - Calculate spread with HCA
- `getGameSpread(game)` - Cached spread retrieval
- `formatSpread(spreadValue)` - Display formatting
- `incrementStrengthVersion()` - Cache invalidation

### Schedule Rendering (app.js)
- `renderScheduleGameRow()` - League schedule (lines ~10136-10250)
- `renderScheduleGameRowWithNumber()` - Team schedule (lines ~10260-10325)

### Cache Invalidation Integration
- Commissioner tools: app.js lines 5267, 5448, 5719, 5991, 16004
- Regular trades: engine.js line 1489
- New leagues: engine.js line 4973
- Legacy loads: state-manager.js line 437
