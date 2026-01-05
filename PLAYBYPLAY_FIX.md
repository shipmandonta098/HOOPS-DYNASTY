# Play-by-Play Persistence Fix

## Problem
The play-by-play feed was disappearing or not showing during live game simulation.

## Root Causes Identified
1. **Array Replacement**: `startLiveGame()` was replacing `game.log = [...]` instead of preserving existing entries
2. **Missing Safety Checks**: Multiple functions accessed `game.log` without checking if it existed
3. **No Initialization**: `game.log` could be `undefined` or `null` in certain edge cases
4. **Tab Switching**: Potential for log to be lost during view switches

## Fixes Implemented

### 1. Persistent Log Storage (`engine.js`)

**startLiveGame()** - Line 2012
```javascript
// BEFORE:
game.log = [{ quarter: 1, time: '12:00', text: 'Tip-off!' }];

// AFTER:
if (!game.log) {
  game.log = [];
}
// Only add tip-off if log is empty (avoid duplicates)
if (game.log.length === 0) {
  game.log.push({ quarter: 1, time: '12:00', text: 'Tip-off!', scored: false, score: null });
}
```

**stepLiveGame()** - Line 2027
```javascript
// Added at start of function:
if (!game.log || !Array.isArray(game.log)) {
  game.log = [];
}

// Existing push remains the same:
game.log.push({
  quarter: game.quarter,
  time: game.timeRemaining,
  text: logText,
  scored: scored,
  score: scored ? { home: game.score.home, away: game.score.away } : null
});
```

### 2. Safety Utility Function (`app.js`)

**ensureGameLog()** - Line 224
```javascript
function ensureGameLog(game) {
  if (!game) return;
  if (!game.log || !Array.isArray(game.log)) {
    game.log = [];
    if (DEBUG_PLAYS) {
      console.log(`[PLAYS] ensureGameLog: Initialized log for game ${game.id}`);
    }
  }
}
```

### 3. Rendering Functions Updated

All play-by-play rendering functions now call `ensureGameLog()`:

- **renderGameDrawer()** - Ensures log exists when drawer opens
- **renderPlaysTab()** - Checks log before rendering plays tab
- **renderPlayByPlayFeed()** - Validates log before generating HTML
- **updateLiveGameDisplay()** - Ensures log exists during live updates

### 4. Improved Placeholder Messaging

**renderPlaysTab()** - Line 3078
```javascript
if (game.log.length === 0) {
  return `
    <div style="padding: 80px 20px; text-align: center; color: #888;">
      <div style="font-size: 2.5em; margin-bottom: 15px;">⏳</div>
      <div style="font-size: 1.1em;">Waiting for first event...</div>
      <div style="font-size: 0.9em; margin-top: 8px;">Play-by-play will appear here</div>
    </div>
  `;
}
```

### 5. Debug Logging System

**Debug Flag** - Line 211
```javascript
let DEBUG_PLAYS = false; // Global flag

window.togglePlayDebug = function() {
  DEBUG_PLAYS = !DEBUG_PLAYS;
  console.log(`[PLAYS] Debug logging ${DEBUG_PLAYS ? 'ENABLED' : 'DISABLED'}`);
  return DEBUG_PLAYS;
};
```

**Debug Points Added:**
- `startLiveGame()`: Logs when log is initialized
- `stepLiveGame()`: Logs after each play is added
- `ensureGameLog()`: Logs when log is created/initialized
- `renderPlaysTab()`: Logs current log count
- `renderPlayByPlayFeed()`: Logs rendering play count
- `updateLiveGameDisplay()`: Logs during live updates

## How to Use Debug Mode

1. **Enable Debug Logging**
   ```javascript
   // In browser console (F12)
   togglePlayDebug()
   // Returns: true (enabled)
   ```

2. **Start a Live Game**
   - Navigate to Schedule tab
   - Click any game
   - Click "Watch Live"
   - Open console to see logs

3. **Example Debug Output**
   ```
   [PLAYS] startLiveGame: game_2026_1, log initialized with 1 entries
   [PLAYS] stepLiveGame: game_2026_1, log now has 2 entries
   [PLAYS] stepLiveGame: game_2026_1, log now has 3 entries
   [PLAYS] updateLiveGameDisplay: game_2026_1, log has 3 entries
   [PLAYS] renderPlaysTab: game game_2026_1, log has 3 entries
   [PLAYS] renderPlayByPlayFeed: rendering 3 plays
   ```

4. **Disable Debug Logging**
   ```javascript
   togglePlayDebug()
   // Returns: false (disabled)
   ```

## Files Modified

### `engine.js`
- `startLiveGame()`: Preserve existing log, don't replace
- `stepLiveGame()`: Add safety check for log existence
- Debug logging with `typeof DEBUG_PLAYS !== 'undefined'` check

### `app.js`
- Added `DEBUG_PLAYS` global variable
- Added `togglePlayDebug()` console command
- Added `ensureGameLog()` utility function
- Updated `renderGameDrawer()` to call `ensureGameLog()`
- Updated `renderPlaysTab()` to call `ensureGameLog()` and show placeholder
- Updated `renderPlayByPlayFeed()` to call `ensureGameLog()`
- Updated `updateLiveGameDisplay()` to call `ensureGameLog()`

## Testing Checklist

- [x] Log persists across tab switches
- [x] Log persists when pausing/resuming
- [x] Placeholder shows when log is empty
- [x] Plays appear immediately when simulation starts
- [x] No duplicate "Tip-off!" entries
- [x] Debug logging can be toggled on/off
- [x] No console errors during simulation
- [x] Speed changes don't affect log

## Edge Cases Handled

1. **Game log is undefined**: `ensureGameLog()` creates empty array
2. **Game log is null**: `ensureGameLog()` creates empty array
3. **Game log is not an array**: `ensureGameLog()` replaces with empty array
4. **Starting live game twice**: Only adds Tip-off if log is empty
5. **Tab switching during simulation**: Log is never cleared or reset
6. **Simulation at different speeds**: Log accumulates correctly

## Future Improvements

- [ ] Store quarter-by-quarter logs in separate arrays for better organization
- [ ] Add play-by-play export/download feature
- [ ] Implement play-by-play filtering (scoring plays only, turnovers only, etc.)
- [ ] Add play-by-play search functionality
- [ ] Store logs in IndexedDB for persistence across browser sessions
