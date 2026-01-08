# Fan Hype System

## Overview
The Fan Hype system represents public excitement, expectations, and pressure surrounding each team in your basketball league. Hype ranges from 0-100 and dynamically changes based on team performance.

## How Hype is Calculated

### Base Factors (0-100 scale)
1. **Win Percentage** (±25 points)
   - Teams above .500 gain hype
   - Teams below .500 lose hype
   - Scales linearly: .750 win% = +12.5 hype

2. **Recent Streaks** (±15 points)
   - Win streaks boost hype (+1.5 per game)
   - Losing streaks damage hype (-1.5 per game)
   - Capped at ±15 points

3. **Star Power** (±10 points)
   - Based on best player's OVR
   - 90+ OVR superstar = +10 hype
   - Below 60 OVR = -5 hype

4. **Championship History** (+5 per title)
   - Winning tradition builds lasting hype
   - Capped at +25 from championships

5. **Performance vs Expectations** (±10 points)
   - Overperforming teams gain bonus hype
   - Underperforming teams lose hype
   - Calculated after 10+ games

### Immediate Reactions
After each game, hype gets an instant boost/penalty:
- **Blowout Win** (+20 pts): +2 hype
- **Close Win** (+5 pts): +1.25 hype
- **Close Loss** (-5 pts): -1.25 hype
- **Blowout Loss** (-20 pts): -2 hype
- **Hot Streak** (6+ wins): +1 extra hype per win
- **Cold Streak** (6+ losses): -1 extra hype per loss

## Effects on Team Operations

### Attendance Multiplier
- **0-29 Hype** (Crisis): 0.6x attendance (empty arena)
- **30-49 Hype** (Low): 0.8x attendance
- **50-69 Hype** (Neutral): 1.0-1.2x attendance
- **70-84 Hype** (High): 1.3x attendance
- **85-100 Hype** (Euphoria): 1.4x attendance (sellouts)

### Revenue Multiplier
- **0-29 Hype**: 0.5x revenue
- **30-49 Hype**: 0.75x revenue
- **50-69 Hype**: 1.0-1.25x revenue
- **70-100 Hype**: 1.5x revenue

### Morale Effects
- **Below 20 Hype**: -10 morale (fan apathy damages team spirit)
- **20-79 Hype**: Gradual morale changes (±5 range)
- **Above 80 Hype**: -3 morale (pressure/anxiety from expectations)

### Front Office Pressure
- **0-69 Hype**: No pressure (0)
- **70-79 Hype**: Mild Expectations (0-20 pressure)
- **80-89 Hype**: Moderate Pressure (20-40)
- **90-94 Hype**: High Pressure (40-50)
- **95-100 Hype**: Championship or Bust (50-60 pressure)

### Media Tone
- **0-29 Hype**: 🔴 Critical (harsh coverage)
- **30-49 Hype**: 🟡 Skeptical (doubting narrative)
- **50-69 Hype**: 🟢 Optimistic (positive coverage)
- **70-100 Hype**: 🌟 Euphoric (championship buzz)

## Financial Impact

### Attendance Calculation
```
Base Attendance = 18,000 (arena capacity)
Market Multiplier = Large (1.2x) | Medium (1.0x) | Small (0.8x)
Hype Multiplier = 0.6x to 1.4x

Final Attendance = Base × Market × Hype
```

### Revenue per Game
```
Revenue per Fan = $85 (tickets + concessions + merchandise)
Game Revenue = Attendance × $85 × Hype Revenue Multiplier

Example:
- Large market, 90 hype, winning team
- Attendance: 18,000 × 1.2 × 1.35 = 29,160 fans
- Revenue: 29,160 × $85 × 1.45 = $3.59M per game
```

### Season Financials
Teams track:
- **Season Revenue**: Total $ earned from home games
- **Season Attendance**: Total fans across all home games
- **Games Played**: Number of home games
- **Avg Attendance**: Season attendance ÷ games played
- **Revenue per Game**: Season revenue ÷ games played

## UI Displays

### Dashboard - Fan Hype Card
Shows:
- Large hype number (0-100) with color coding
- Trend indicator 📈/📉 (last 5 games vs previous 5)
- Gradient meter bar (red → yellow → green)
- Effects grid: Attendance %, Revenue %, Pressure level
- Media tone message
- Average attendance (if games played)

### Standings Page
Each team shows:
- Hype icon + number
- Color-coded: 🔴 (0-29) | 🟡 (30-49) | 🟢 (50-69) | 🔥 (70-100)
- Appears in detail row alongside W/L, streaks, etc.

## Examples

### Struggling Small Market Team
- Record: 12-28 (.300 win%)
- 5-game losing streak
- Best player: 68 OVR
- No championships

**Calculated Hype**: ~25
- Win%: -10 hype
- Streak: -7.5 hype
- Star: -1 hype
- Base 50 → Final 25

**Effects**:
- Attendance: 60% (lots of empty seats)
- Revenue: 50% (low merchandise sales)
- Morale: -10 (team feels unloved)
- Media: Critical coverage
- Pressure: None (low expectations)

### Championship Contender
- Record: 52-18 (.743 win%)
- 8-game win streak
- Best player: 94 OVR superstar
- 2 recent championships

**Calculated Hype**: ~88
- Win%: +12 hype
- Streak: +12 hype (capped at +15)
- Star: +10 hype
- Championships: +10 hype
- Base 50 → Final 88

**Effects**:
- Attendance: 138% (sellouts every night)
- Revenue: 145% (huge merchandise sales)
- Morale: -3 (slight pressure to perform)
- Media: Euphoric (championship buzz)
- Pressure: 36 (Moderate - must win it all)

## Notes

- Hype does NOT directly affect player ratings (as requested)
- Old saves initialize all teams at neutral 50 hype
- Hype history tracks last 30 data points for trend analysis
- System is fully backward compatible
- Morale effects apply gradually to prevent wild swings
- Extreme hype (95+) creates pulse/glow effects in UI

## Future Enhancements (Potential)

- Draft picks affect hype (lottery pick = hype boost)
- Trade deadline moves impact hype
- Injury to star player = hype drop
- Playoff performance creates massive hype swings
- Free agent signings affect hype
- Social media events/scandals
- Rivalry games have 2x hype impact
- Home court advantage scales with hype
