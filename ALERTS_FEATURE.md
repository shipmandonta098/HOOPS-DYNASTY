# Dashboard Alerts System

## Overview
Added a comprehensive alerts system to the Dashboard tab that dynamically monitors team status and provides actionable warnings and notifications.

## Features Implemented

### Alert Types (8 Total)

1. **Over Hard Cap** (Danger - Priority 100)
   - Triggers when payroll > $172M
   - Shows amount over cap
   - Links to Finances tab

2. **Over Salary Cap** (Danger - Priority 90)
   - Triggers when payroll > $120M
   - Shows amount over cap
   - Links to Finances tab

3. **Contracts Expiring** (Warning - Priority 70)
   - Counts players with contracts ending this season or next
   - Shows player names (first 2)
   - Links to Finances tab

4. **Low Roster Size** (Danger/Warning)
   - Danger if < 12 players (Priority 95)
   - Warning if 12-14 players (Priority 60)
   - Links to Free Agents tab

5. **Player Injuries** (Warning - Priority 65)
   - Shows injured player count
   - Lists injured players with games remaining
   - Links to Team/Roster tab

6. **Morale Problems** (Warning - Priority 55)
   - Triggers when players have morale < 40
   - Shows unhappy player count
   - Links to Team/Roster tab

7. **Draft Status** (Info)
   - "Draft approaching" during offseason (Priority 40)
   - "Draft in progress" during draft (Priority 85)
   - Links to Draft tab

8. **Rotation Issues** (Warning - Priority 50)
   - Detects empty position rotations
   - Lists missing positions
   - Links to Rotations tab

## UI Design

### Alert Card Styling
- **Danger**: Red border with glow (#ef4444)
- **Warning**: Amber border with glow (#f59e0b)
- **Info**: Blue border with glow (#3b82f6)
- Rounded corners (12px)
- Hover effects (translateX + enhanced glow)
- Dark semi-transparent background
- Left-aligned icon (⚠️/⚡/ℹ️)

### Dashboard Display
- Shows top 4 most critical alerts
- Sorted by severity (danger > warning > info) then priority
- "View all X alerts →" link if more than 4 exist
- Empty state: "No alerts. Everything looks stable." with checkmark

### Alerts Modal
- Full list of all alerts
- Click any alert to navigate and auto-close modal
- Scrollable if many alerts
- Consistent styling with dashboard cards

## Navigation
All alerts are clickable and use the existing `switchTab()` function to navigate to:
- `finances` - Salary cap and contract issues
- `freeagents` - Roster size problems
- `team` - Injuries and morale
- `draft` - Draft notifications
- `rotations` - Lineup issues

## Code Structure

### Files Modified

1. **engine.js**
   - Added `computeDashboardAlerts(userTeamId)` function
   - Returns sorted array of alert objects
   - Safe handling of missing data (no breaking changes)

2. **app.js**
   - Added `renderDashboardAlerts()` - Main rendering function
   - Added `handleAlertClick(type, target)` - Navigation handler
   - Added `openAlertsModal()` - Modal display
   - Added `closeAlertsModal()` - Modal cleanup
   - Integrated into `renderDashboard()` after Top Players card

3. **draft-styles.css**
   - Alert container styles
   - Card styles with severity variants
   - Icon and content layout
   - Hover animations and glows
   - Modal styling
   - Empty state styling

## Alert Object Schema

```javascript
{
  id: string,              // Unique identifier
  severity: string,        // 'danger' | 'warning' | 'info'
  message: string,         // Main text (e.g., "Over salary cap!")
  subtext: string?,        // Optional details (e.g., "Over by $5.2M")
  action: {
    type: string,          // 'NAVIGATE' (future: 'MODAL')
    target: string         // Tab name to navigate to
  },
  priority: number         // Higher = more important (0-100)
}
```

## Testing Checklist

- [ ] Alert shows when team is over salary cap
- [ ] Alert shows when team is over hard cap
- [ ] Contract expiration alert shows correct count
- [ ] Roster size alerts trigger at correct thresholds
- [ ] Injury alert shows when players are injured
- [ ] Morale alert triggers for unhappy players
- [ ] Draft alerts show in correct phases
- [ ] Rotation alert detects empty positions
- [ ] Clicking alerts navigates to correct tab
- [ ] "View all" modal opens with full list
- [ ] No alerts shows stable state message
- [ ] Alerts sort correctly by severity/priority

## Future Enhancements

- Trade deadline approaching
- Upcoming free agents of interest
- Playoff clinching scenarios
- Award watch (MVP, ROY, etc.)
- Hot/cold streak notifications
- Budget warnings (going into luxury tax)
- Draft pick value alerts
