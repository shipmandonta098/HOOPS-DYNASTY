# Commissioner Mode Feature

## Overview
Commissioner Mode is an optional feature that gives you powerful player editing capabilities for advanced league management and customization.

## ⚙️ How to Enable

1. Open **Settings** (gear icon in header)
2. Toggle **"Commissioner Mode"** to ON
3. A blue badge will appear in the header confirming it's active

## ✏️ Editing Players

When Commissioner Mode is enabled, you'll see **Edit** buttons in three places:

### 1. Player Modal (Quick Access)
- Click any player's name to open their profile
- Click the **"✏️ Edit"** button in the top-right corner

### 2. Player Action Menu
- Click the **⋮** menu next to any player
- Select **"✏️ Edit Player"** from the dropdown

### 3. Players Tab
- Browse the league-wide player database
- Click **"✏️ Edit"** button in each player's row

## 📋 Editable Fields

The comprehensive edit form includes:

### Player Identity
- **Full Name** - Change player's display name
- **Age** - Set age (18-45 years)
- **Position** - PG, SG, SF, PF, C
- **Country** - Birth country (default: USA)
- **College** - College/university attended
- **Team Assignment** - Move player to any team or Free Agency

### Physical Attributes
- **Height** - Player height (e.g., "6-6")
- **Weight** - Body weight in pounds (150-350)
- **Wingspan** - Arm span measurement

### Ratings & Skills
- **Overall (OVR)** - Current overall rating (0-99)
- **Potential (POT)** - Future ceiling (0-99)
- **Shooting** - Jump shot rating (0-99)
- **Defense** - Defensive ability (0-99)
- **Rebounding** - Board crashing (0-99)
- **Passing** - Playmaking skill (0-99)

### Contract Details
- **Annual Salary** - Contract value ($0-50M/year)
- **Years Remaining** - Contract duration (0-7 years)
- **Player Option** - Toggle player option year
- **Team Option** - Toggle team option year
- **Guaranteed %** - Contract guarantee (0-100%)
  - 0% = Non-guaranteed (Training Camp contract)
  - 100% = Fully guaranteed

### Draft Information
- **Draft Year** - Year selected (1950-2050)
- **Round** - Draft round (1-5)
- **Pick** - Selection number (1-60)
- **Drafted By Team** - Original team that drafted player
  - ⚠️ Must be a valid league team (never "Unknown Team" or "Free Agent")

## ✅ Validation Rules

The editor enforces data integrity:

- **Name**: Minimum 2 characters
- **Age**: Between 18 and 45
- **OVR/POT**: Must be 0-99 integers
- **Guaranteed %**: Must be 0-100
- **Draft Info**: Either complete (Year + Round + Pick) or all empty for undrafted
- **Drafted By Team**: Must be a valid team ID from your league

## 🔄 Team Changes

When you reassign a player to a different team:
- ✅ Player is removed from old roster
- ✅ Player is added to new roster
- ✅ Team payrolls are automatically recalculated
- ✅ Free agents can be signed to teams
- ✅ Rostered players can be moved to Free Agency

## 💾 Saving Changes

1. Make your edits in the form
2. Click **"💾 Save Changes"**
3. Changes are validated
4. Data is saved to IndexedDB
5. Success notification appears
6. UI refreshes automatically

## 🛡️ Security Features

- **Toggle Protection**: Edit buttons are hidden when mode is OFF
- **Function Guards**: Save operations check Commissioner Mode status
- **Action Logging**: All edits are logged for accountability
- **Validation**: Prevents invalid data from being saved

## 🎯 Use Cases

### Fixing Draft Errors
- Correct "Unknown Team" draft issues
- Update draft positions for imported players

### League Customization
- Create historical players
- Balance rosters for competitive play
- Adjust ratings for realism

### Testing & Development
- Create superstar prospects
- Test contract scenarios
- Balance difficulty

### Storyline Creation
- Rename players for immersion
- Adjust ratings to match narratives
- Move players for storyline trades

## ⚠️ Important Notes

- **Cache Invalidation**: The UI refreshes after edits to show changes
- **Persistence**: All changes are saved permanently to IndexedDB
- **No Undo**: Changes are immediate - edit carefully!
- **Team Limits**: No roster size enforcement - manage responsibly

## 🔍 Troubleshooting

### Edit Button Not Showing
- ✅ Verify Commissioner Mode is ON in Settings
- ✅ Check the blue badge appears in header
- ✅ Refresh the page if needed

### Save Not Working
- ⚠️ Check validation errors in alert message
- ⚠️ Ensure all required fields are filled
- ⚠️ Verify draft info is complete or empty

### Player Not Found
- 🔄 Refresh the page
- 🔄 Check if player was moved to different team

## 🎨 UI Indicators

- **Blue "Commissioner Mode" Badge** - Appears in header when active
- **✏️ Edit Buttons** - Show only when mode is ON
- **Success Toast** - Green notification on successful save
- **Form Validation** - Red alerts for invalid data

## 📊 Technical Details

- **Storage**: IndexedDB persistence
- **Validation**: Client-side form validation
- **Logging**: Commissioner actions logged with timestamp
- **Performance**: Instant saves with immediate UI updates

---

**Pro Tip**: Use Commissioner Mode to create custom draft classes, fix import errors, or build historically accurate rosters!
