# Expansion Tab Feature

## Overview
Complete expansion draft system allowing leagues to add 1-6 new teams through a 4-step wizard process.

## Features

### Step 1: Configure Expansion Settings
**Configurable Options:**
- Number of expansion teams (1-6)
- Expansion year (default: next offseason)
- Roster size limit per expansion team (default: 15)
- Protected players per existing team (default: 8)
- Min/max players taken from each team (default: 1/1)
- Draft order (Snake, Random, Worst Record First)
- Rookie protection toggle
- Cap space handling for expansion teams
- Contract inheritance toggle

**Actions:**
- Start Expansion Process
- Cancel Expansion Plan

### Step 2: Create Expansion Teams
**Team Configuration:**
- City
- Team Name
- Abbreviation (unique, validated)
- Conference (Eastern/Western)
- Division
- Primary/Secondary Colors (color picker)
- Market Size (Small/Medium/Large)

**Features:**
- Manual team entry
- "Generate Random Teams" button
- Validation before proceeding
- Auto-assignment of team IDs
- Prevents duplicate abbreviations

**Random Team Options:**
- Seattle Supersonics
- Las Vegas Aces
- Vancouver Grizzlies
- Louisville Cardinals
- Pittsburgh Riveters
- Kansas City Monarchs

### Step 3: Protection Lists
**User Team (Interactive):**
- Full roster display with toggle buttons
- Protection counter (e.g., "Protected: 5/8")
- Search/filter by player name
- Visual indicators (protected = green highlight)
- Real-time validation (can't exceed limit)

**CPU Teams (Automated):**
- Auto-generate protection lists using scoring formula:
  ```
  score = (OVR × 2) + POT + ageBonus - salaryPenalty
  - ageBonus: +10 if age < 24, -10 if age > 30
  - salaryPenalty: contract.amount / 10 (max 10)
  ```
- View any team's protection list (read-only modal)
- Bulk "Auto-Generate All CPU Lists" button

**Actions:**
- Finalize Protection Lists (locks them in)
- Regenerate CPU protections

### Step 4: Expansion Draft
**Layout:**
- **Left Panel:** Draft results log (pick number, player, original team)
- **Center Panel:** Available player pool (unprotected players only)
  - Search by player name
  - Shows: name, position, age, OVR, POT, original team
  - "Select" button per player
- **Right Panel:** Expansion team rosters
  - Shows current roster count (X/15)
  - Lists all drafted players

**Draft Logic:**
- Respects min/max players per team limits
- Prevents double-drafting
- Validates roster size limits
- Tracks picks in order

**AI Drafting:**
AI teams score players based on:
```
value = OVR + (POT × 0.5) + positionalNeedBonus - salaryPenalty - injuryPenalty
- positionalNeedBonus: +15 if <2 at position, +5 if <3
- salaryPenalty: contract.amount / 5 (max 15)
- injuryPenalty: -20 if currently injured
- ageBonu: +8 if <25, -10 if >32
```

**Player Transfer:**
- Moves player from original team to expansion team
- Updates `player.currentTeamId` (preserves `draftedByTid`)
- Inherits existing contract
- Adds transaction history entry:
  ```javascript
  {
    type: 'expansion',
    season: currentSeason,
    fromTeamId: originalTeamId,
    toTeamId: expansionTeamId,
    date: ISO timestamp
  }
  ```

**Actions:**
- Manual player selection (user picks for first expansion team with space)
- Auto-Complete Draft (AI fills all rosters)
- Finalize Expansion (adds to history, resets state)

## Data Structure

### league.expansion
```javascript
{
  active: false,              // Is expansion currently in progress?
  currentStep: 1,             // Which step (1-4)
  year: null,                 // Expansion year
  
  settings: {
    numTeams: 1,
    expansionYear: null,
    rosterSizeLimit: 15,
    minPlayersPerTeam: 1,
    maxPlayersPerTeam: 1,
    protectedPlayersPerTeam: 8,
    canProtectRookies: true,
    canProtectTwoWay: true,
    draftOrder: 'snake',      // 'snake' | 'random' | 'worst-first'
    expandedCap: true,
    inheritContracts: true,
    expansionRelief: false
  },
  
  newTeams: [
    {
      city: 'Seattle',
      name: 'Supersonics',
      abbreviation: 'SEA',
      conference: 'Western',
      division: 'Pacific',
      primaryColor: '#005C32',
      secondaryColor: '#F7B500',
      market: 'large'
    }
    // ... more teams
  ],
  
  protectedLists: {
    [teamId]: [playerId1, playerId2, ...],  // Per-team protection lists
    // ...
  },
  
  draftResults: [
    {
      playerId: 123,
      playerName: 'John Doe',
      fromTeamId: 5,
      fromTeamName: 'Lakers',
      toTeamId: 31,
      pick: 1
    }
    // ... ordered by pick number
  ],
  
  history: [
    {
      season: 2026,
      teams: ['Seattle Supersonics', 'Las Vegas Aces'],
      picks: 30,
      date: '2025-01-04T...'
    }
  ]
}
```

## Backend Functions (engine.js)

### Core Functions
- `initExpansionState()` - Creates default expansion state
- `validateExpansionTeams(newTeams, existingTeams)` - Validates team data
- `generateCpuProtectionLists(settings)` - Auto-generates protection lists for AI
- `buildExpansionPlayerPool()` - Returns unprotected players
- `pickExpansionPlayer(expansionTeamId, playerId)` - Transfers player
- `aiPickExpansionPlayer(expansionTeamId)` - AI pick logic
- `finalizeExpansion()` - Completes expansion, adds to history

### Validation Rules
1. No duplicate abbreviations
2. Valid conference (Eastern/Western)
3. Division must be set
4. City and name required
5. Roster limits respected
6. Min/max picks per team enforced

## UI Functions (app.js)

### Rendering
- `renderExpansion()` - Main tab render
- `renderExpansionStep(step)` - Step router
- `renderExpansionSettings()` - Step 1
- `renderExpansionTeams()` - Step 2
- `renderExpansionProtection()` - Step 3
- `renderExpansionDraft()` - Step 4

### Interactions
- `switchExpansionStep(step)` - Navigate steps
- `updateExpansionSetting(key, value)` - Update settings
- `startExpansion()` - Begin process (validates phase)
- `cancelExpansion()` - Reset expansion state
- `updateExpansionTeam(idx, field, value)` - Update team data
- `generateRandomExpansionTeams()` - Auto-generate teams
- `validateExpansionTeams()` - Validate and add teams to league
- `togglePlayerProtection(playerId)` - Toggle protection
- `viewTeamProtection(teamId)` - View modal
- `autoGenerateAllProtectionLists()` - Generate all CPU lists
- `finalizeProtectionLists()` - Lock and proceed
- `selectExpansionPlayer(playerId)` - Manual pick
- `autoCompleteDraft()` - AI complete all picks
- `finalizeExpansionDraft()` - Finish expansion

## Migration System

### Migration #3 (Schema Version 3)
Adds `league.expansion` to existing leagues:
```javascript
3: function(league) {
  if (!league.expansion) {
    league.expansion = initExpansionState();
  }
  // Ensures all required fields exist
}
```

**Backward Compatibility:**
- Old saves auto-migrate on load
- No data loss
- Expansion inactive by default
- All settings use safe defaults

## Styling (draft-styles.css)

### Key Classes
- `.expansion-container` - Main wrapper
- `.expansion-stepper` - Step indicator
- `.expansion-step` - Individual step (active/completed states)
- `.expansion-settings-grid` - Settings layout
- `.expansion-teams-grid` - Team cards grid
- `.protection-list` - Player protection list
- `.protection-toggle` - Protect/Unprotect button
- `.expansion-draft-container` - 3-column draft layout
- `.player-pool-list` - Available players
- `.expansion-team-roster` - Expansion team roster display

### Color Scheme
- Active step: Blue gradient (#3b82f6)
- Completed step: Green (#10b981)
- Protected player: Green highlight
- Unprotected: Gray border
- Danger actions: Red accents

## User Flow

1. **Navigate to Expansion tab** (🌟 in sidebar)
2. **Step 1:** Configure settings → Click "Start Expansion"
3. **Step 2:** Fill in team details OR click "Generate Random" → Validate
4. **Step 3:** Toggle protection for your team → View CPU lists → Finalize
5. **Step 4:** 
   - Review available player pool
   - Click "Select" on players OR "Auto-Complete Draft"
   - Monitor draft results panel
   - Click "Finalize Expansion" when done
6. **Result:** New teams added to league, ready for next season

## Constraints & Rules

- Expansion only starts during **offseason** phase
- Cannot exceed protection limit
- Cannot draft same player twice
- Cannot take more than max players from one team
- Roster size limit enforced
- All validations show error alerts
- Original team's `draftedByTid` preserved (expansion doesn't change draft history)

## Testing Checklist

- [ ] Tab appears in sidebar
- [ ] Step 1: Settings save correctly
- [ ] Step 2: Team validation works
- [ ] Step 2: Random generation works
- [ ] Step 3: User protection toggle works
- [ ] Step 3: CPU lists auto-generate
- [ ] Step 3: View team modal opens
- [ ] Step 4: Player pool displays correctly
- [ ] Step 4: Manual selection works
- [ ] Step 4: Auto-complete works
- [ ] Step 4: Draft results log updates
- [ ] Finalize adds teams to league
- [ ] Old saves load without errors
- [ ] Migration runs successfully
- [ ] Expansion history tracked

## Future Enhancements

- Expansion draft lottery system
- Compensatory picks for original teams
- Two-way contract special handling
- Custom expansion draft rules (Vegas Golden Knights style)
- Multi-year expansion planning
- Relocation vs expansion toggle
- Conference/division rebalancing wizard
- Expansion team budget/revenue projections
