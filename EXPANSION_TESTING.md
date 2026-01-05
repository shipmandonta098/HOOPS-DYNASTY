# Expansion Tab - Testing Guide

## Pre-Testing Setup
1. Open `index_new.html` in your browser
2. Load an existing league OR create a new league
3. Navigate through the game until you reach **Offseason** phase
   - Expansion can only be started during offseason

## Test Plan

### ✅ Test 1: Tab Navigation
**Steps:**
1. Click the hamburger menu (☰)
2. Verify "🌟 Expansion" appears in the sidebar
3. Click on "Expansion" tab
4. **Expected:** Expansion tab opens with overview card showing current season, phase, and "Expansion Active: ❌ No"

---

### ✅ Test 2: Step 1 - Configure Settings
**Steps:**
1. In Expansion tab, verify you're on Step 1 (blue highlight)
2. Change "Number of Expansion Teams" to 2
3. Set "Protected Players per Team" to 8
4. Toggle "Can Protect Rookies" checkbox
5. Click "Start Expansion Process"

**Expected:**
- If not in offseason: Alert "Expansion can only start during offseason"
- If in offseason:
  - Settings save
  - "Expansion Active" changes to ✅ Yes
  - Auto-advances to Step 2
  - Step 1 shows ✓ (completed)

---

### ✅ Test 3: Step 2 - Create Teams (Manual)
**Steps:**
1. For Team 1:
   - Enter City: "Seattle"
   - Enter Team Name: "Supersonics"
   - Enter ABV: "SEA"
   - Select Conference: "Western"
   - Enter Division: "Northwest"
   - Pick colors (optional)
   - Select Market: "Large"
2. For Team 2:
   - Enter City: "Las Vegas"
   - Enter Team Name: "Aces"
   - Enter ABV: "LVA"
   - Select Conference: "Western"
   - Enter Division: "Pacific"
3. Click "Validate & Continue"

**Expected:**
- Teams added to league.teams array
- Step advances to Step 3
- No validation errors
- Teams appear in league

**Test Validation Errors:**
- Try duplicate abbreviation → Should show error
- Leave city blank → Should show error
- Leave conference blank → Should show error

---

### ✅ Test 4: Step 2 - Generate Random Teams
**Steps:**
1. Go back to Step 2 (click Step 2 in stepper)
2. Click "Generate Random Teams"

**Expected:**
- All team fields auto-populate
- Teams have random colors
- Abbreviations are unique
- Conferences alternate (Eastern/Western)

---

### ✅ Test 5: Step 3 - Protection Lists (User Team)
**Steps:**
1. Verify your team name appears
2. Click "Unprotected" button for 8 players
3. **Expected:** 
   - Button changes to "✓ Protected" (green)
   - Counter updates: "Protected: 8/8"
   - Can't protect more (button disabled)
4. Click "✓ Protected" on one player to unprotect
5. **Expected:**
   - Button changes back to "Unprotected"
   - Counter: "Protected: 7/8"
   - Can protect again

**Test Search:**
1. Type player name in search box
2. **Expected:** Only matching players show

---

### ✅ Test 6: Step 3 - CPU Protection Lists
**Steps:**
1. Click "Auto-Generate All CPU Lists"
2. **Expected:** Message appears or page updates
3. Click "View" button on any CPU team
4. **Expected:**
   - Modal opens
   - Shows protected players (with OVR ratings)
   - Shows unprotected players
5. Close modal (click X or outside)

**Test Finalize:**
1. Click "Finalize Protection Lists"
2. **Expected:**
   - Advances to Step 4
   - Step 3 shows ✓ (completed)

---

### ✅ Test 7: Step 4 - Expansion Draft (Manual Pick)
**Steps:**
1. Verify 3-panel layout appears:
   - Left: Draft Results (empty at first)
   - Center: Available Players (unprotected only)
   - Right: Expansion Teams (Seattle, Las Vegas)
2. Scroll through available players
3. Click "Select" on a good player (high OVR)
4. **Expected:**
   - Player disappears from available pool
   - Appears in expansion team roster (right panel)
   - Draft Results shows: "#1 | Player Name | from Team Name"
5. Click "Select" on another player
6. **Expected:** Pick #2 added

**Test Search:**
1. Type player name in pool search
2. **Expected:** Filters to matching names only

---

### ✅ Test 8: Step 4 - Auto-Complete Draft
**Steps:**
1. Click "Auto-Complete Draft"
2. Confirm the prompt
3. **Expected:**
   - All expansion team rosters fill to 15 players
   - Draft Results list grows (should have ~30 picks for 2 teams)
   - Available player pool shrinks
   - Each original team loses max 1 player (per settings)

---

### ✅ Test 9: Finalize Expansion
**Steps:**
1. Click "Finalize Expansion"
2. Confirm the prompt
3. **Expected:**
   - Alert: "Expansion completed! New teams added to league."
   - Expansion state resets:
     - active: false
     - currentStep: 1
     - newTeams: []
     - protectedLists: {}
     - draftResults: []
   - New teams remain in league.teams
   - league.expansion.history has new entry

---

### ✅ Test 10: Verify New Teams in League
**Steps:**
1. Navigate to "Standings" tab
2. **Expected:** See Seattle Supersonics and Las Vegas Aces
3. Navigate to "Roster" tab
4. Switch to one of the expansion teams (if you can)
5. **Expected:** See 15 players on roster (drafted players)

---

### ✅ Test 11: Check Player Transactions
**Steps:**
1. Find a player who was drafted in expansion
2. Open player modal/details
3. **Expected:** 
   - `player.currentTeamId` = expansion team ID
   - `player.draftedByTid` = ORIGINAL drafting team (NOT expansion team)
   - `player.transactionHistory` includes expansion entry:
     ```
     {
       type: 'expansion',
       season: [year],
       fromTeamId: [original team],
       toTeamId: [expansion team]
     }
     ```

---

### ✅ Test 12: Load Existing Save (Migration)
**Steps:**
1. Load a league created BEFORE expansion feature
2. Check browser console for migration message:
   - "Running migration to version 3: Adding expansion system"
3. Navigate to Expansion tab
4. **Expected:**
   - Tab loads without errors
   - league.expansion exists with defaults
   - active: false
   - All settings have default values

---

### ✅ Test 13: Cancel Expansion
**Steps:**
1. Start expansion (Step 1 → Click "Start Expansion")
2. Fill in team data (Step 2)
3. Click "Cancel Expansion" button
4. Confirm the prompt
5. **Expected:**
   - Resets to Step 1
   - Expansion Active: No
   - newTeams array cleared
   - Can start fresh

---

### ✅ Test 14: Edge Cases

**Test: No players to draft**
1. Set protected players to 15 (everyone protected)
2. Try to complete draft
3. **Expected:** No players available, draft can't proceed

**Test: Roster already full**
1. Manually pick 15 players for one expansion team
2. Try to pick another
3. **Expected:** Error: "Roster is full"

**Test: Max picks from one team**
1. Set "Max Players per Team" to 1
2. Try to pick 2 players from same team
3. **Expected:** Error: "Already taken max players from [Team Name]"

**Test: Start expansion in wrong phase**
1. Be in "season" or "preseason" phase
2. Click "Start Expansion Process"
3. **Expected:** Alert: "Expansion can only start during offseason"

---

## Common Issues & Fixes

### Issue: Expansion tab doesn't appear
**Fix:** Check index_new.html has the tab container and sidebar item

### Issue: "Expansion system not available"
**Fix:** Check league.expansion exists (migration should auto-create)

### Issue: Teams not added after validation
**Fix:** Check browser console for errors, verify makeTeam function works

### Issue: Players not transferring
**Fix:** Check pickExpansionPlayer logic, verify fromTeamId matching

### Issue: Protection lists not saving
**Fix:** Check save() is called after toggle, verify league.expansion.protectedLists structure

---

## Success Criteria

All tests pass if:
✅ Expansion tab loads without errors
✅ All 4 steps function correctly
✅ Settings save and persist
✅ Teams validate and add to league
✅ Protection lists work (user + CPU)
✅ Draft picks transfer players correctly
✅ Player data integrity maintained (contracts, draftedByTid)
✅ Finalize completes and adds history entry
✅ Old saves load with migration
✅ No console errors during any step

---

## Browser Console Commands (for debugging)

```javascript
// Check expansion state
console.log(league.expansion);

// Check new teams
console.log(league.teams.filter(t => t.players.length === 0));

// Check protected lists
console.log(league.expansion.protectedLists);

// Check draft results
console.log(league.expansion.draftResults);

// Check player pool
console.log(buildExpansionPlayerPool());

// Force migration
migrateLeague(league);
save();
```

---

## Performance Notes

- Expansion draft with 2 teams × 15 players = ~30 picks
- Expansion draft with 6 teams × 15 players = ~90 picks
- Auto-complete should finish in < 5 seconds for 6 teams
- Protection list generation for 30 teams should be instant

---

## Accessibility Notes

- All buttons have descriptive text
- Modals can be closed with X button or clicking outside
- Forms have labels
- Color pickers have default values
- Search boxes have placeholders
