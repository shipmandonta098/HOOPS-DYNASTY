# NBA-Style Gamecast Features

## Overview
The Watch Live modal has been redesigned to look like an NBA.com live game interface with a modern, mobile-first design.

## Layout Structure

### 1. **Sticky Header**
- Displays both teams with logos, names, and records
- Large centered score display (e.g., "125 — 115")
- Live status indicator (Q1 11:28 or FINAL)
- Always visible when scrolling

### 2. **Sticky Tab Bar**
Four tabs for different views:
- **Matchup**: Team overview and comparison
- **Forecast**: Win probability and predictions
- **Plays**: Live play-by-play feed (default for live games)
- **Stats**: Box scores and team statistics

### 3. **Scrollable Content Area**
Content changes based on active tab while simulation continues running.

### 4. **Sticky Bottom Controls**
- **Live games**: Pause/Resume, Sim to End, Speed selector (1x/2x/5x)
- **Final games**: Close button
- **Scheduled games**: Sim Instant and Watch Live buttons

## Tab Details

### Plays Tab (Default for Live Games)
- Scrollable play-by-play feed with latest plays at the top
- Each play shows:
  - Timestamp (e.g., "0:58.40")
  - Team icon (2-letter abbreviation)
  - Play description
  - Running score (if scoring play)
- Quarter section headers (1st Quarter, 2nd Quarter, etc.)
- Scoring plays highlighted with blue border
- "Tip-off coming soon..." placeholder if no plays yet
- Controls:
  - Auto-scroll toggle checkbox
  - "Jump to latest" button
- Event counter showing total number of plays

### Stats Tab
Three-segment toggle: **[AWAY] [Game] [HOME]**

#### Game View:
- Team totals comparison
- Stats include: Points, FG%, 3P%, FT%, Rebounds, Assists, Turnovers
- Leader indicators (▶/◀) showing which team is ahead
- Color-coded (green for leader, gray for trailing)

#### Team View (Away/Home):
- Full box score table
- Columns: PLAYER, MIN, PTS, REB, AST
- All players from selected team
- Scrollable for large rosters

### Matchup Tab
- Side-by-side team comparison cards
- Shows for each team:
  - Team name and logo
  - Win-loss record (large display)
  - Offensive Rating
  - Defensive Rating
  - Pace
- Game information at bottom (Day X, Season)

### Forecast Tab
- Win probability visualization
- Visual progress bars for each team
- Color-coded (blue for away, green for home)
- Percentage display
- Projected total points

## Technical Details

### State Management
- `activeGamecastTab`: Current tab ('plays', 'stats', 'matchup', 'odds')
- `activeStatsView`: Stats tab segment ('away', 'game', 'home')
- `autoScrollPlays`: Whether to auto-scroll play feed to latest

### Key Functions
- `switchGamecastTab(tab)`: Change active tab
- `switchStatsView(view)`: Switch stats segment
- `updateGamecastContent()`: Refresh current tab content
- `updateLiveGameDisplay(gameId)`: Update scores and status during simulation

### Design Principles
- Mobile-first responsive design
- Dark background (#1a1a2e) with high contrast text
- Blue accent color (#2196F3) for active elements
- Sticky positioning for header, tabs, and controls
- Smooth transitions and updates
- Simulation continues during all tab switches
- No unnecessary DOM recreation (efficient updates)

## User Actions

### During Scheduled Game
- Click "Sim Instant" to simulate immediately
- Click "Watch Live" to start live simulation

### During Live Game
- Switch between tabs without interrupting simulation
- Pause/Resume simulation
- Change speed (1x, 2x, or 5x)
- Sim to End to finish instantly
- Toggle auto-scroll in Plays tab
- Switch between team stats in Stats tab

### After Game Ends
- Review all tabs with final stats
- Click "Close" to return to schedule

## Color Scheme
- Background: #1a1a2e (dark blue-gray)
- Secondary BG: #0f1624 (darker)
- Borders: #2a2a40 (muted blue-gray)
- Primary Accent: #2196F3 (blue)
- Success: #4CAF50 (green)
- Warning: #ff9800 (orange)
- Error/Live: #f44336 (red)
- Text: #ccc (light gray), #888 (muted), #666 (very muted)

## Browser Compatibility
- Works in all modern browsers
- No external dependencies required
- Pure vanilla JavaScript
