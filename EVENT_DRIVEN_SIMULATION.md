# Event-Driven Season Simulation System

## Overview

The simulation system is **event-driven**, not date-driven. Time advances only by games and league events. Simulation **never skips user decisions** and pauses only when player action is required.

### Core Principles

✅ **No Calendar Dates** - Time measured in game numbers, not days  
✅ **Event Queue** - Season is a sequence of events processed in order  
✅ **User Agency** - Simulation pauses for all user decisions  
✅ **Clear Control** - Buttons define simulation scope (1 game, week, month, season)  
✅ **Predictable Pauses** - Known events trigger pauses (trades, phases, votes)

---

## Simulation Controls

### UI Buttons

| Button | Scope | Description |
|--------|-------|-------------|
| **⏩ Game** | 1 game | Simulate exactly one game |
| **⏭️ Until Event** | Until pause | Simulate until next event requiring decision (**PRIMARY**) |
| **📅 Week** | 3-5 games | Simulate one week (~3-5 games) |
| **📆 Month** | 12-15 games | Simulate one month (~12-15 games) |
| **🏀 Season** | All games | Simulate entire season (with pauses) |
| **▶️ Resume** | Continue | Resume from paused state |

**Recommended Button:** ⏭️ **Until Event** (green) - simulates efficiently while ensuring no decisions are missed.

---

## Event Types

### Events That **PAUSE** Simulation

| Event | Always Pause? | Condition |
|-------|---------------|-----------|
| **TRADE_OFFER** | Conditional | User team is target |
| **TRADE_DEADLINE** | ✅ Always | - |
| **PHASE_TRANSITION** | Conditional | Setting: autoPauseOnPhaseChanges |
| **ALL_STAR_VOTING** | ✅ Always | - |
| **ALL_STAR_GAME** | ❌ Never | (Simulated automatically) |
| **CONTRACT_OPTION** | Conditional | User team owns player |
| **CONTRACT_EXTENSION** | Conditional | User team owns player |
| **INJURY** | Conditional | Major injury + setting enabled |
| **PLAYOFF_CLINCH** | Conditional | User team + setting enabled |
| **PLAYOFF_ELIMINATION** | Conditional | User team + setting enabled |

### Events That **DO NOT PAUSE** Simulation

| Event | Why No Pause? |
|-------|---------------|
| **GAME** | Simulated automatically |
| AI-only trades | No user decision |
| Minor injuries | Informational only |
| Background news | No action needed |
| Award results | Voting pauses, results don't |

---

## Event Queue System

### Queue Structure

Events are generated at season start and stored in `league.simulation.eventQueue`:

```javascript
{
  id: "event_1",
  type: "PHASE_TRANSITION",
  fromPhase: "PRESEASON",
  toPhase: "REGULAR_SEASON",
  gameNumber: 0,
  description: "Season begins"
}

{
  id: "event_2",
  type: "GAME",
  gameId: "game_2026_1",
  gameNumber: 1,
  dayNumber: 1,
  homeTeamId: 1,
  awayTeamId: 5,
  description: "Game 1"
}
```

### Queue Processing

1. **Build Queue** - `buildEventQueue()` creates full season schedule
2. **Process Sequentially** - Events processed in order from `currentEventIndex`
3. **Check Pause** - Before each event, `checkShouldPause()` evaluates conditions
4. **Execute Event** - `processEvent()` routes to appropriate handler
5. **Check Limit** - Simulation stops if limit reached (games, event type)
6. **Repeat** - Continue until pause, limit, or queue end

---

## Simulation State

### State Object: `league.simulation`

```javascript
{
  eventQueue: [],              // Array of all season events
  currentEventIndex: 0,        // Current position in queue
  isPaused: false,             // Whether simulation is paused
  pauseReason: null,           // Event type that caused pause
  pauseEventData: null,        // Data for the paused event
  simLimit: null,              // Current simulation limit
  gamesSimulated: 0,           // Games simulated in current run
  settings: {
    autoPauseOnInjuries: true,
    autoPauseOnTradeOffers: true,
    autoPauseOnPlayoffClinch: false,
    autoPauseOnPhaseChanges: true,
    simSpeed: 'normal'         // 'fast', 'normal', 'slow'
  }
}
```

### Simulation Limits

Limits control how far simulation runs before stopping:

```javascript
// Sim 1 Game
simLimit: { type: 'games', count: 1 }

// Sim Week (3-5 games)
simLimit: { type: 'games', count: rand(3, 5) }

// Sim Until Next Event
simLimit: { type: 'untilEvent', stopOnNonGame: true }

// Sim Season (no limit)
simLimit: null
```

---

## Implementation Details

### Core Functions (engine.js)

#### `buildEventQueue()`
Generates all events for the season:
- Phase transitions (preseason → regular → playoffs → offseason)
- All scheduled games
- Trade deadline (67% through season)
- All-Star voting & game (50% through season)
- Contract decisions (team-specific)

Returns sorted array of events by game number.

#### `runSimulation()`
Main simulation loop:
```javascript
while (currentEventIndex < eventQueue.length) {
  const event = eventQueue[currentEventIndex];
  
  // Check if we should pause BEFORE processing
  if (checkShouldPause(event)) {
    return { paused: true, reason: event.type };
  }
  
  // Process the event
  const result = processEvent(event);
  
  // Check if event requested pause
  if (result.pause) {
    return { paused: true, reason: event.type, data: result.data };
  }
  
  currentEventIndex++;
  
  // Check simulation limit
  if (simLimitReached()) {
    return { complete: true };
  }
}
```

#### `checkShouldPause(event)`
Evaluates pause conditions:
- Event type (trade offer, voting, etc.)
- User team involvement
- Auto-pause settings
- Event severity (injury level)

Returns `true` if simulation should pause, `false` to continue.

#### `processEvent(event)`
Routes event to handler:
```javascript
switch (event.type) {
  case 'GAME': return processGameEvent(event);
  case 'PHASE_TRANSITION': return processPhaseTransition(event);
  case 'TRADE_OFFER': return processTradeOffer(event);
  case 'TRADE_DEADLINE': return processTradeDeadline(event);
  // ... etc
}
```

Returns:
```javascript
{
  success: boolean,       // Whether processing succeeded
  pause: boolean,         // Whether to pause simulation
  message: string,        // User-facing message
  data: object           // Event-specific data
}
```

#### `resumeSimulation()`
Continues from paused state:
- Moves past paused event (`currentEventIndex++`)
- Clears pause state
- Calls `runSimulation()` to continue

---

## UI Integration

### Status Label

Shows current state in compact format:

```
2026 Regular Season · Game 45/82 · Idle
⏸️ PAUSED: Trade Offer
2026 Playoffs · Game 5/16 · Simulating...
```

Format: `{season} {phase} · Game {current}/{total} · {status}`

**Pause States:**
- Orange text: `⏸️ PAUSED: {reason}`
- Color codes: Trade Offer, Trade Deadline, Phase Change, All-Star Voting, etc.

### Button States

**Active Buttons:**
- All sim buttons enabled
- Resume button hidden
- Normal colors

**Simulating:**
- All sim buttons disabled
- Status shows "Simulating..."
- Gray out buttons

**Paused:**
- Sim buttons enabled
- **Resume button visible** (pulsing orange)
- Pause indicator in status

### Notifications

Toast notifications appear top-right for:
- Simulation pauses (blue info toast)
- Trade deadline (orange warning toast)
- Phase transitions (blue info toast)
- Errors (red error toast)
- Completion (green success toast)

Auto-dismiss after 4 seconds with fade animation.

---

## Event Handlers

### Game Events

```javascript
function processGameEvent(event) {
  const game = league.schedule.games[event.gameId];
  simGameInstant(event.gameId);  // Simulate game
  league.simulation.gamesSimulated++;
  return { success: true };
}
```

**No pause** - games are always simulated automatically.

### Phase Transitions

```javascript
function processPhaseTransition(event) {
  league.phase = event.toPhase;
  updateLeaguePhase();
  
  return {
    success: true,
    message: `${event.fromPhase} has ended. ${event.toPhase} begins.`
  };
}
```

**Pause if** `settings.autoPauseOnPhaseChanges === true`

### Trade Deadline

```javascript
function processTradeDeadline(event) {
  league.tradeDeadlinePassed = true;
  
  return {
    success: true,
    message: 'Trade deadline has passed. No more trades allowed this season.'
  };
}
```

**Always pauses** - important season milestone.

### Trade Offers

```javascript
function processTradeOffer(event) {
  return {
    success: true,
    pause: true,  // Always pause for user decision
    message: `Trade offer from ${event.fromTeamName}`,
    data: event.tradeOffer
  };
}
```

**Always pauses** if user team is involved. Shows modal with:
- Accept
- Counter
- Reject
- Ignore (resumes simulation)

### All-Star Voting

```javascript
function processAllStarVoting(event) {
  return {
    success: true,
    message: 'All-Star voting is open. Select your starters!'
  };
}
```

**Always pauses** - user must vote for starters.

### Contract Options

```javascript
function processContractOption(event) {
  return {
    success: true,
    pause: true,
    message: `Contract option decision for ${event.playerName}`,
    data: event
  };
}
```

**Pause if** user team owns the player.

### Injuries

```javascript
function processInjury(event) {
  return {
    success: true,
    message: `${event.playerName} injured (${event.severity})`
  };
}
```

**Pause if** major injury AND `settings.autoPauseOnInjuries === true`

---

## Simulation Settings

### Auto-Pause Toggles

Users can customize when simulation pauses:

```javascript
league.simulation.settings = {
  autoPauseOnInjuries: true,        // Pause for major injuries
  autoPauseOnTradeOffers: true,     // Pause for trade offers (user team)
  autoPauseOnPlayoffClinch: false,  // Pause when playoffs clinched/eliminated
  autoPauseOnPhaseChanges: true,    // Pause at phase transitions
  simSpeed: 'normal'                // Simulation speed multiplier
}
```

**Settings UI** (future enhancement):
- Settings tab → Simulation section
- Toggle switches for each setting
- Dropdown for sim speed

---

## Trade Offer System

### Push vs Pull

**Old System (Pull):**
- User checks "Trade Offers" tab
- Offers may accumulate unseen
- Easy to miss important offers

**New System (Push):**
- AI generates trade offer event
- Added to event queue
- Simulation pauses when event processed
- Modal appears with offer details
- User must respond to continue

### Trade Offer Modal

When `TRADE_OFFER` event triggers:

1. Simulation pauses
2. Modal appears with:
   - Proposed trade details
   - Team ovr impact
   - Salary cap impact
   - Player value analysis
3. User options:
   - **Accept** - Execute trade, resume sim
   - **Counter** - Open negotiation UI
   - **Reject** - Decline offer, resume sim
   - **Ignore** - Skip for now, resume sim (offer stays in queue)

**Ignore vs Reject:**
- **Ignore** - Offer may return later
- **Reject** - Permanently declined

---

## Phase System Integration

### Phase Transitions

Phases are explicit events in the queue:

```javascript
// Event at game 0
{ type: 'PHASE_TRANSITION', fromPhase: 'PRESEASON', toPhase: 'REGULAR_SEASON' }

// Event at game 82
{ type: 'PHASE_TRANSITION', fromPhase: 'REGULAR_SEASON', toPhase: 'PLAYOFFS' }

// Event after playoffs
{ type: 'PHASE_TRANSITION', fromPhase: 'PLAYOFFS', toPhase: 'OFFSEASON' }
```

### Phase-Locked Actions

Phase rules still apply (see `PHASE_RULES.md`):
- **PRESEASON**: No trades (optional)
- **REGULAR_SEASON**: Trades allowed until deadline
- **PLAYOFFS**: Trades disabled
- **OFFSEASON**: Free agency, draft

Simulation respects phase locks - user can't execute blocked actions even when paused.

---

## Season Structure

### 30 Teams, 82 Games

**Total Games:** 1,230 (30 teams × 82 games ÷ 2)

**Schedule Generation:**
- Balanced matchups (teams play each other equal times)
- No calendar constraints (no back-to-backs needed)
- Games stored as sequential events

**Progress Tracking:**
```
Game 1/82   → Early season
Game 41/82  → Midseason (All-Star break)
Game 55/82  → Trade deadline passed
Game 82/82  → Regular season complete
```

---

## Migration & Compatibility

### Initialization

On league load:
```javascript
if (!league.simulation) {
  league.simulation = initSimulationState();
}
```

### Event Queue Rebuild

Event queue rebuilt when:
- New season starts
- Schedule regenerated (commissioner mode)
- Queue is empty

Queue persists in league save state (not regenerated on load).

### Backwards Compatibility

Old leagues work seamlessly:
- `initSimulationState()` creates default state
- Old sim functions redirect to new system
- Settings default to recommended values

**No schema version bump** - fully backwards compatible.

---

## Future Enhancements

### Planned Features

1. **AI Trade Offer Generation**
   - AI teams evaluate roster needs
   - Generate realistic offers
   - Push to user via event queue

2. **Contract Extensions**
   - Events before contract expires
   - User chooses to extend or let expire
   - AI negotiation logic

3. **Playoff Clinch/Elimination**
   - Calculate magic numbers
   - Generate events when clinched/eliminated
   - Optional pause for user team

4. **Injury Events**
   - Severity levels (minor, moderate, major, career)
   - Pause for major+ injuries
   - Return timelines (games, not weeks)

5. **Award Ceremonies**
   - Events for award announcements
   - MVP, DPOY, ROY, All-NBA, etc.
   - Optional pause to view results

6. **Draft Lottery**
   - Event after regular season
   - Pause to show lottery results
   - Draft order determined

7. **Free Agency Period**
   - Events for signing periods
   - Pause when user team gets offers
   - AI teams make signings

---

## Testing

### Test Scenarios

**1. Sim One Game**
- ✅ Exactly 1 game simulated
- ✅ No pauses (unless event on that game)
- ✅ Status updates correctly

**2. Sim Until Event**
- ✅ Games simulated continuously
- ✅ Pauses at first non-game event
- ✅ Resume button appears

**3. Sim Week**
- ✅ 3-5 games simulated
- ✅ Stops after count reached
- ✅ Pauses if event encountered

**4. Sim Season**
- ✅ All games simulated
- ✅ Pauses at every user decision
- ✅ Can resume multiple times
- ✅ Season completes successfully

**5. Trade Deadline**
- ✅ Simulation pauses at deadline
- ✅ Message displayed
- ✅ No trades allowed after

**6. Phase Transition**
- ✅ Pauses when setting enabled
- ✅ Phase updated correctly
- ✅ Phase rules enforced

**7. Trade Offer**
- ✅ Pauses for user team offers
- ✅ Modal appears
- ✅ Accept/Counter/Reject/Ignore work
- ✅ Resume continues simulation

---

## Troubleshooting

### Simulation Stuck

**Symptom:** Simulation doesn't progress  
**Cause:** Event queue empty or corrupted  
**Fix:** Rebuild queue via `buildEventQueue()` or regenerate schedule

### Pauses Too Often

**Symptom:** Simulation pauses every game  
**Cause:** Auto-pause settings too aggressive  
**Fix:** Disable `autoPauseOnPhaseChanges` and `autoPauseOnPlayoffClinch`

### Resume Button Not Appearing

**Symptom:** Paused but no resume button  
**Cause:** UI state desync  
**Fix:** Check `league.simulation.isPaused` and call `showResumeButton()`

### Events Not Triggering

**Symptom:** Trade deadline doesn't pause  
**Cause:** Event not in queue or already processed  
**Fix:** Check `eventQueue` and `currentEventIndex`

---

## API Reference

### Engine Functions

```javascript
// Initialization
initSimulationState() → { eventQueue, currentEventIndex, isPaused, ... }

// Queue Management
buildEventQueue() → Event[]
getNextEvent() → Event | null

// Simulation Control
simOneGame() → { success, paused, complete, message }
simUntilNextEvent() → Result
simWeek() → Result
simMonth() → Result
simSeason() → Result
resumeSimulation() → Result

// Event Processing
processEvent(event) → { success, pause, message, data }
checkShouldPause(event) → boolean
```

### UI Functions (app.js)

```javascript
// Button Handlers
executeSimGame() → Promise<void>
executeSimUntilEvent() → Promise<void>
executeSimWeek() → Promise<void>
executeSimMonth() → Promise<void>
executeSimSeason() → Promise<void>
executeResumeSimulation() → Promise<void>

// State Management
handleSimulationResult(result) → void
showPauseIndicator(result) → void
showResumeButton() → void
hideResumeButton() → void

// UI Updates
updateSimStatusLabel(customText?) → void
disableSimButtons() → void
enableSimButtons() → void
showNotification(message, type) → void
```

---

## Credits

**Designed for:** HOOPS DYNASTY Basketball Simulation  
**Architecture:** Event-driven, user-centric simulation  
**Key Principle:** Never skip user decisions

**Implementation Date:** January 2026  
**Commit:** 6dbd0ca  

---

## Summary

The event-driven simulation system provides:

✅ **Full Control** - Choose simulation scope (game, week, month, season)  
✅ **No Missed Decisions** - Pauses for all user actions  
✅ **Clear Progress** - Game numbers instead of dates  
✅ **Predictable Pauses** - Known events trigger stops  
✅ **Easy Resume** - One-click continue from pauses  
✅ **Flexible Settings** - Customize auto-pause behavior  
✅ **Event Queue** - Ordered, sequential processing  
✅ **Phase Integration** - Respects league phase rules  

**Recommended Usage:**  
Use ⏭️ **"Until Event"** button for most simulation - it efficiently processes games while ensuring you never miss important decisions.
