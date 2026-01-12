# Commissioner Tools - Complete Guide

## Overview
Commissioner Mode has been expanded with four powerful new tools to give you complete control over your league:

1. **Add Player** - Create custom players
2. **Delete Player** - Remove players from the league
3. **Force Trade** - Execute trades between any teams
4. **Force Injury** - Assign injuries to players

All actions are logged and appear in the news feed to maintain transparency.

---

## 🔓 Enabling Commissioner Mode

### First Time Setup
1. Navigate to **Settings** tab
2. Scroll to **Commissioner Mode** section (red border)
3. Read the warning carefully
4. Click **"🔓 Enable Commissioner Mode"**
5. Confirm the warning dialog

### Visual Indicators
When enabled, you'll see:
- Red **"Commissioner Mode"** badge in top-right corner
- Red border around Commissioner Mode settings section
- Commissioner Tools buttons throughout the app

---

## 🎯 Accessing Commissioner Tools

### Method 1: Commissioner Panel (Quick Access)
1. Click the **Commissioner Mode badge** in top-right corner
2. Panel opens with global tools
3. Click:
   - **"➕ Add Player"** - Open player creation modal
   - **"🔄 Force Trade"** - Open trade execution modal

### Method 2: Player Page (Individual Actions)
1. Navigate to any player's detail page
2. Click **"👑 Commissioner Tools"** dropdown button (red)
3. Select from menu:
   - **✏️ Edit Player** - Modify player attributes
   - **🗑️ Delete Player** - Remove player from league
   - **🏥 Force Injury** - Assign injury to player

### Method 3: Settings Panel
1. Go to **Settings** tab
2. Scroll to **Commissioner Mode** section
3. Access all global tools and configuration

---

## ➕ ADD PLAYER

### Purpose
Create a new custom player with full control over all attributes and assignment.

### How to Use
1. Click **"➕ Add Player"** from Commissioner Panel
2. Fill out the form sections:

#### Section 1: Identity
- **First Name** (required)
- **Last Name** (required)
- **Position**: PG, SG, SF, PF, C
- **Age**: 18-45 years old
- **Gender**: Male or Female

#### Section 2: Physical Attributes
- **Height**: Enter in inches (e.g., 78 = 6'6")
- **Weight**: In pounds (120-350)
- **Wingspan**: In inches

💡 *Tip: Reference guide - 6'0" = 72", 6'6" = 78", 7'0" = 84"*

#### Section 3: Ratings
- **Overall (OVR)**: 0-99, determines current ability
- **Potential (POT)**: 0-99, determines development ceiling

*All detailed attributes are auto-generated based on OVR*

#### Section 4: Contract
- **Salary**: In millions (e.g., 5.5 = $5.5M)
- **Years**: 0-6 (0 = no contract, free agent)
- **Contract Type**:
  - Guaranteed
  - Partially Guaranteed
  - Non-Guaranteed

#### Section 5: Team Assignment
- **Destination**: Select any team OR "Free Agent"

#### Section 6: Draft Info (Optional)
- **Draft Year**: Leave blank if undrafted
- **Round**: 1-2
- **Pick**: 1-60

3. Click **"✅ Create Player"**

### What Happens
- Player is created with unique ID
- Added to selected team's roster or free agent pool
- All attributes auto-filled based on OVR if not specified
- Action logged in Commissioner Log
- News item added: "Commissioner Added Player"
- League saved automatically

### Validation & Safety
- All numeric values are clamped to safe ranges
- Missing attributes are auto-filled with reasonable defaults
- No duplicate player IDs possible
- Cannot break team rosters

---

## 🗑️ DELETE PLAYER

### Purpose
Permanently remove a player from the league.

### How to Use
1. Navigate to player's detail page
2. Click **"👑 Commissioner Tools"** dropdown
3. Select **"🗑️ Delete Player"**
4. Modal displays:
   - Player name, position, age, OVR
   - Current team assignment
   - ⚠️ Warning message
5. Check **"I understand this player will be permanently deleted"**
6. Click **"🗑️ Delete Player"**

### What Happens
- Player record removed from team roster or free agents
- Removed from all depth charts and rotations
- Action logged in Commissioner Log
- News item added: "Commissioner Deleted Player"
- League saved automatically

### Important Notes
⚠️ **This action CANNOT be undone!**

**Historical Data:**
- Player's past game stats remain in history (if tracked)
- Stats queries will gracefully skip missing players
- No database corruption from deletion

**Safety Checks:**
- Requires explicit checkbox confirmation
- Cannot accidentally delete multiple players
- Clear visual warnings before action

---

## 🔄 FORCE TRADE

### Purpose
Execute instant trades between any two teams, bypassing all trade logic and salary cap rules.

### How to Use
1. Click **"🔄 Force Trade"** from Commissioner Panel
2. **Select Teams:**
   - Choose **Team A** from dropdown
   - Choose **Team B** from dropdown
   - Player lists populate automatically

3. **Select Assets:**
   - Check players in **Team A Assets** to send to Team B
   - Check players in **Team B Assets** to send to Team A
   - You can select 0 players from one side (one-way trades allowed)

4. **Options:**
   - ☑️ **Ignore salary cap and trade rules** (recommended ON)
   - ☑️ **Automatically update team needs and rotations** (recommended ON)

5. Click **"✅ Execute Trade"**
6. Confirm the trade summary

### What Happens
- Selected players instantly swap teams
- Player rosters updated immediately
- Action logged with full trade details
- News item added: "Commissioner Forced Trade"
- League saved automatically

### Trade Examples

**Example 1: Star Player Swap**
- Team A sends: LeBron James (90 OVR)
- Team B sends: Kevin Durant (89 OVR)

**Example 2: Salary Dump**
- Team A sends: Max contract player ($45M)
- Team B sends: (nothing - one-way trade)

**Example 3: Multi-Player Deal**
- Team A sends: 3 role players
- Team B sends: 1 star player + 1 prospect

### Validation
- Cannot trade with same team
- Must select at least 1 player total
- Confirmation required before execution

### Safety Features
- No salary cap checks (commissioner override)
- No trade logic restrictions
- All trades reversible (just execute reverse trade)

---

## 🏥 FORCE INJURY

### Purpose
Assign an injury to any player, controlling type, severity, and duration.

### How to Use
1. Navigate to player's detail page
2. Click **"👑 Commissioner Tools"** dropdown
3. Select **"🏥 Force Injury"**
4. Modal displays player info
5. Configure injury:

#### Injury Type
Select from preset types or custom:
- Ankle Sprain
- Knee Strain
- Hamstring Strain
- Shoulder Injury
- Back Spasms
- Concussion
- Fracture
- Torn Ligament
- Illness
- **Custom** (enter your own)

#### Severity
Auto-suggests duration:
- **Minor**: 1-2 weeks (~5 games)
- **Moderate**: 2-6 weeks (~15 games)
- **Severe**: 6-12 weeks (~30 games)
- **Season Ending**: Rest of season (~82 games)

#### Duration
- **Games Out**: Manual entry (1-100 games)
- Auto-filled based on severity selection
- Can override after selecting severity

6. Click **"🏥 Apply Injury"**

### What Happens
- Player receives injury status
- Injury details stored:
  - Type (e.g., "Ankle Sprain")
  - Games remaining
  - Severity level
  - Start game index
- Player becomes **unavailable for games** during injury
- Injury counter decrements each game simulated
- Action logged in Commissioner Log
- News item added: "Player Injury - [Name] has been placed on injury report"
- League saved automatically

### Injury Management
**During Injury:**
- Player appears with 🏥 indicator on rosters
- Cannot be selected for rotations
- Shows "X games remaining" in UI
- Stats tracking continues (DNP - Injury)

**Recovery:**
- Games remaining decrements automatically during simulation
- When gamesRemaining = 0, injury clears automatically
- Player returns to available pool

**Manual Healing:**
- Use **Edit Player** tool to manually clear injury if needed

### Use Cases

**Realism Scenarios:**
- Simulate ACL tear for offseason surgery
- Add injury to match real-world news
- Create storyline challenges

**Balance Adjustments:**
- Temporarily remove overpowered player
- Create opportunity for bench players
- Test roster depth

**Season Challenges:**
- Injury crisis mode (injure 3+ starters)
- Playoff adversity testing

---

## 📊 Transaction Logging

### Commissioner Log
Every commissioner action is automatically logged with:
- **Action Type**: ADD_PLAYER, DELETE_PLAYER, FORCE_TRADE, FORCE_INJURY, etc.
- **Description**: Human-readable details
- **Entities Affected**: Player IDs, team IDs involved
- **Timestamp**: Exact date/time of action
- **Season/Day**: League context when action occurred

### Accessing Logs
Currently logs are stored in league data structure:
```javascript
league.commissionerLog = [
  {
    id: 1,
    season: 1,
    day: 45,
    actionType: "ADD_PLAYER",
    description: "Created John Doe (PG, 85 OVR) → New York Comets",
    entitiesAffected: { playerId: 301, teamId: 0 },
    timestamp: 1736726400000
  },
  // ...
]
```

### News Feed Integration
All commissioner actions also create news items visible in the News tab:
- **"Commissioner Added Player"** - Player creation
- **"Commissioner Deleted Player"** - Player removal
- **"Commissioner Forced Trade"** - Trade execution
- **"Player Injury"** - Injury assignments

This provides league-wide visibility and historical record.

---

## ⚠️ Important Warnings & Best Practices

### Data Integrity
✅ **DO:**
- Test changes in a backup league first
- Use reasonable attribute values (0-99 for ratings)
- Keep player counts balanced across teams
- Document major changes in external notes

❌ **DON'T:**
- Create 100+ players at once (performance impact)
- Use extreme values (999 OVR, negative ages)
- Delete players mid-game (wait for offseason)
- Force trades during playoffs (may affect results)

### League Balance
- Adding high-OVR players affects competitive balance
- Deleting key players can break team strategies
- Forced trades should maintain roster minimums (5+ players per team)
- Injuries should be used sparingly for realism

### Performance Considerations
- Each action triggers full league save
- Large commissioner logs (1000+ entries) may slow down saves
- Consider clearing old log entries if performance degrades

### Backup Recommendations
Before major commissioner actions:
1. Go to **Settings** → **Data Management**
2. Click **"📥 Export League"** to create backup
3. Perform commissioner actions
4. Test league stability
5. If issues arise, import backup to restore

---

## 🔒 Security & Access Control

### Guardrails
All commissioner functions check:
```javascript
if (!isCommissionerMode()) {
  alert('⚠️ Commissioner Mode must be enabled');
  return;
}
```

This ensures:
- No accidental commissioner actions
- Clear visual warnings before execution
- Actions only available when explicitly enabled

### Disabling Commissioner Mode
To disable and lock tools:
1. Open Commissioner Panel (click badge)
2. Scroll to bottom
3. Click **"🔒 Disable Commissioner Mode"**
4. Confirm dialog

**What happens:**
- Badge disappears
- All commissioner tools hidden in UI
- Functions still hard-blocked in code
- League flagged as "Modified" permanently

### League Flags
Leagues with commissioner actions are flagged:
- `league.meta.commissionerEnabled = true`
- Enables leaderboards to filter "clean" vs "modified" leagues
- No performance impact, just metadata

---

## 🎮 Advanced Use Cases

### Scenario 1: Create a Super Team
```
Goal: Build Dream Team for exhibition games

Steps:
1. Add Player: Michael Jordan (99 OVR, PG)
2. Add Player: LeBron James (98 OVR, SF)
3. Add Player: Shaquille O'Neal (97 OVR, C)
4. Add Player: Stephen Curry (96 OVR, SG)
5. Add Player: Tim Duncan (95 OVR, PF)
6. Force Trade: Send all to one team
```

### Scenario 2: Injury Crisis Challenge
```
Goal: Test roster depth management

Steps:
1. Select your team's top 3 scorers
2. Force Injury: Moderate (15 games each)
3. Simulate 20 games
4. See if bench players step up
```

### Scenario 3: League Rebalancing
```
Goal: Redistribute talent for parity

Steps:
1. Export league backup
2. Force Trade: Move stars from top teams to bottom teams
3. Simulate season
4. Compare standings vs original
```

### Scenario 4: Historical Recreation
```
Goal: Recreate real draft class

Steps:
1. Add Player: Victor Wembanyama (85 OVR, 20 yrs old, C)
   - Height: 90 inches (7'6")
   - Draft: 2023, Round 1, Pick 1
2. Add Player: Brandon Miller (78 OVR, 21 yrs old, SF)
   - Draft: 2023, Round 1, Pick 2
3. Continue for full draft class...
```

---

## 🐛 Troubleshooting

### Problem: "Player not found" when deleting
**Solution:** Player may have already been deleted or moved. Refresh page and check rosters.

### Problem: Trade modal shows no players
**Solution:** Selected team may have 0 players. Check team roster first or try different team.

### Problem: Injury doesn't appear in game
**Solution:** Check that `league.rules.enableInjuries = true` in settings. Force Injury works regardless, but display requires injuries enabled.

### Problem: Added player not showing in roster
**Solution:** 
- Check if assigned to correct team (not Free Agents by mistake)
- Refresh the page to reload league data
- Verify player was actually created (check Commissioner Log)

### Problem: Commissioner Tools dropdown won't close
**Solution:** Click anywhere outside the dropdown, or refresh the page.

### Problem: News feed not showing commissioner actions
**Solution:** Ensure `league.news` array exists. If migrating old league, initialize it:
```javascript
if (!league.news) league.news = [];
```

---

## 📝 Technical Details

### Player ID Generation
```javascript
function generatePlayerId() {
  // Scans all team rosters and free agents
  // Finds maximum existing ID
  // Returns maxId + 1 (guaranteed unique)
}
```

### Default Attribute Generation
When creating a player with only OVR specified, all detailed attributes are auto-filled:
- Athletic attributes = OVR ± 5 variance
- Offensive/defensive skills = OVR-based calculations
- Mental attributes = OVR with slight randomization
- Personality traits = Default moderate values (60-75 range)

### Injury Structure
```javascript
player.injury = {
  type: "Ankle Sprain",
  gamesRemaining: 15,
  severity: "moderate",
  startGameIndex: 45,
  isActive: true
}
```

### Trade Execution Logic
```javascript
// Move players from Team A to Team B
teamA.players.splice(index, 1) → player removed
teamB.players.push(player) → player added

// No salary cap checks
// No roster minimum checks (commissioner override)
```

---

## 🚀 Future Enhancements (Potential)

Ideas for future development:
- **Batch Operations**: Add/delete multiple players at once
- **Template Players**: Save player templates for quick creation
- **Trade Packages**: Save common trade scenarios
- **Injury Presets**: League-wide injury wave simulation
- **Undo Last Action**: Rollback most recent commissioner action
- **Commissioner Log Viewer**: Dedicated UI to browse all actions
- **Export/Import Players**: Share custom players between leagues
- **Player Attributes Editor**: More granular control over individual skills

---

## 📚 Related Documentation

- [COMMISSIONER_MODE.md](COMMISSIONER_MODE.md) - Original commissioner mode features
- [SCHEDULE_FIX.md](SCHEDULE_FIX.md) - Schedule regeneration details
- [RIVALRY_FEATURE.md](RIVALRY_FEATURE.md) - Rivalry system

---

## ✅ Quick Reference Checklist

### Before Using Commissioner Tools:
- [ ] Commissioner Mode is enabled (red badge visible)
- [ ] League backup created (optional but recommended)
- [ ] Clear goal for what you want to achieve

### After Each Action:
- [ ] Action completed successfully (confirmation message shown)
- [ ] League saved automatically (check last saved timestamp)
- [ ] News item appears in News tab (if applicable)
- [ ] Roster/standings updated correctly

### When Done:
- [ ] Test simulation to ensure no crashes
- [ ] Review Commissioner Log for accuracy
- [ ] Consider disabling Commissioner Mode if finished
- [ ] Document major changes for future reference

---

## 💬 Support

If you encounter issues or have questions:
1. Check Troubleshooting section above
2. Review browser console for error messages (F12)
3. Verify league data integrity with export/import test
4. Report bugs with detailed steps to reproduce

---

**Last Updated:** January 12, 2026  
**Version:** 1.0.0  
**Compatible With:** Hoops Dynasty v1.0.0+
