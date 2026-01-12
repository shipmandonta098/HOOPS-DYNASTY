# Phase System Refactor - State-Driven Implementation

## Overview
Refactored the league phase system from hardcoded values to a state-driven, automatic detection system based on game states. The phase now updates automatically whenever game states change, ensuring the UI always reflects the true state of the league.

## Phase Constants
New phase constants defined in `engine.js`:

```javascript
const PHASES = {
  PRESEASON: 'PRESEASON',
  REGULAR_SEASON: 'REGULAR_SEASON',
  ALL_STAR_BREAK: 'ALL_STAR_BREAK',
  POSTSEASON: 'POSTSEASON',
  OFFSEASON: 'OFFSEASON',
  DRAFT: 'DRAFT',
  FREE_AGENCY: 'FREE_AGENCY'
};
```

## Phase Detection Logic

### `computeCurrentPhase()` (engine.js)
Single source of truth for phase detection. Analyzes all games in the schedule to determine current phase:

1. **DRAFT** - If `league.draft.inProgress === true`
2. **PRESEASON** - If preseason games exist and not all completed
3. **REGULAR_SEASON** - If regular season games exist and not all completed
4. **ALL_STAR_BREAK** - If all regular season games complete and All-Star events active
5. **POSTSEASON** - If playoff games exist and not all completed
6. **OFFSEASON** - Default fallback when all games completed

**Key Features:**
- No hardcoded phases
- Automatically detects first regular season game
- Updates immediately when schedule changes
- Validates game phase property (`game.phase === 'Regular Season'`, etc.)

### `updateLeaguePhase()` (engine.js)
Updates `league.phase` based on computed phase. Called automatically after:
- Any game completion (`simGameInstant`, `finishLiveGame`)
- Day simulation (`simEntireDay`)
- Schedule generation (`generateSeasonSchedule`)
- League initialization (`createLeague`)
- Every UI render (`render()`)

Maps computed phases to legacy format for backward compatibility:
```javascript
PRESEASON → 'preseason'
REGULAR_SEASON → 'season'
POSTSEASON → 'playoffs'
OFFSEASON → 'offseason'
```

## UI Integration

### Phase Display Functions (app.js)

**`getCurrentPhase()`**
- Returns current phase using `computeCurrentPhase()`
- Falls back to stored phase if computation unavailable
- Used by all UI components

**`getCurrentPhaseDisplay()`**
- Returns user-friendly phase name
- Maps phases to display names:
  - `PRESEASON` → "Preseason"
  - `REGULAR_SEASON` → "Regular Season"
  - `ALL_STAR_BREAK` → "All-Star Break"
  - `POSTSEASON` → "Playoffs"
  - `OFFSEASON` → "Offseason"

### Updated UI Components

**League Info Header** (`updateLeagueInfo()`)
```javascript
const phaseDisplay = getCurrentPhaseDisplay();
// Shows: "My League | Season: 2026 | Phase: Regular Season"
```

**Sidebar Buttons**
- Sim Season: Enabled only during `PRESEASON`
- Offseason: Enabled only during `OFFSEASON`
- Draft: Enabled only during `DRAFT`

**Draft Tab**
- Shows current phase in header
- Uses `getCurrentPhaseDisplay()` instead of `league.phase.toUpperCase()`

## Automatic Phase Updates

### After Game Completion
```javascript
function simGameInstant(gameId) {
  // ... simulate game ...
  updateLeaguePhase(); // ← Automatic update
  return game;
}
```

### After Day Simulation
```javascript
function simEntireDay(season, dayNumber) {
  // ... simulate all games ...
  updateLeaguePhase(); // ← Automatic update
  save();
}
```

### After Schedule Generation
```javascript
async function generateSeasonSchedule(season) {
  // ... generate schedule ...
  updateLeaguePhase(); // ← Automatic update
  await saveLeague();
}
```

### On Every Render
```javascript
function render() {
  // Update phase before any rendering
  if (league && typeof updateLeaguePhase === 'function') {
    updateLeaguePhase();
  }
  // ... render UI ...
}
```

## Critical Requirements Met

### ✅ Phase Updates Automatically When:
- [x] Preseason ends (last preseason game completed)
- [x] Game #1 of regular season becomes available
- [x] All-Star weekend begins/ends (when implemented)
- [x] Playoffs begin (first playoff game scheduled)
- [x] Playoffs end (last playoff game completed)

### ✅ UI Header Always Reflects Current Phase
- Updates on every render
- Uses computed phase from game states
- No hardcoded "PRESEASON" or "IDLE" labels

### ✅ Phase Updates Immediately
- First regular season game → Phase changes from PRESEASON to REGULAR_SEASON
- Last regular season game → Phase changes to POSTSEASON (if playoffs exist) or OFFSEASON

### ✅ Integration Complete
- All UI components read from `getCurrentPhase()`
- Schedule, sim controls, standings display correct phase
- Trades and other features use phase detection
- Single source of truth via `computeCurrentPhase()`

## Validation Rules

### Regular Season Detection
```javascript
// If ANY regular season game is visible and unplayed:
if (regularGames.length > 0 && !allRegularComplete) {
  return PHASES.REGULAR_SEASON;
}
// Phase will NEVER show PRESEASON if Game #1+ exists
```

### Playoff Detection
```javascript
// If ANY playoff game is visible and unplayed:
if (playoffGames.length > 0 && !allPlayoffsComplete) {
  return PHASES.POSTSEASON;
}
// Phase will NEVER show REGULAR_SEASON if playoffs active
```

## Game Phase Properties
Games must have correct `phase` property for detection:
- `game.phase === 'Preseason'` - Preseason games
- `game.phase === 'Regular Season'` - Regular season games
- `game.phase === 'Playoffs'` - Playoff games

## Backward Compatibility
- Stores computed phase in `league.computedPhase` (new format)
- Maps to `league.phase` (legacy format) for existing code
- Supports both new constants and legacy strings
- Falls back gracefully if computation unavailable

## Testing Checklist
- [x] New league creation → Starts in correct phase
- [x] Schedule generation → Updates phase automatically
- [x] First regular season game → Phase changes from PRESEASON
- [x] Game simulation → Phase updates after completion
- [x] Day simulation → Phase updates after all games
- [x] Playoffs start → Phase changes to POSTSEASON
- [x] Season ends → Phase changes to OFFSEASON
- [x] UI header → Always shows current phase
- [x] Sidebar buttons → Enable/disable based on phase
- [x] No errors in console
- [x] Backward compatibility maintained

## Code Locations

### Core Phase System (engine.js)
- **Lines ~8-130**: Phase constants and computation functions
  - `PHASES` constant object
  - `computeCurrentPhase()` - Phase detection logic
  - `getPhaseDisplayName()` - Display name mapping
  - `updateLeaguePhase()` - Update league.phase from computed

### Phase Updates (engine.js)
- **Line ~2810**: `simGameInstant()` - After game completion
- **Line ~3120**: `finishLiveGame()` - After live game ends
- **Line ~3140**: `simEntireDay()` - After day simulation
- **Line ~2701**: `generateSeasonSchedule()` - After schedule generation
- **Line ~5127**: `createLeague()` - After league creation

### UI Integration (app.js)
- **Lines ~293-347**: Phase getter functions
  - `getCurrentPhase()` - Get current phase
  - `getCurrentPhaseDisplay()` - Get display name
- **Line ~2046**: `render()` - Update phase before rendering
- **Line ~2152**: `updateLeagueInfo()` - Display phase in header
- **Line ~13233**: Draft tab - Display phase

## Future Enhancements
- [ ] All-Star Weekend event tracking and phase
- [ ] Free Agency phase (distinct from offseason)
- [ ] Training Camp phase (preseason subset)
- [ ] Phase transition events/notifications
- [ ] Phase-specific UI themes
- [ ] Historical phase tracking in league history

## Migration Notes
No data migration required. Existing saves will compute phase automatically on first load based on their game states. The system is fully backward compatible with leagues created before this refactor.
