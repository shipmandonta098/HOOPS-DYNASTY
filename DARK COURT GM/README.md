# Basketball GM Simulator

A comprehensive basketball general manager simulation app built with React Native and Expo. Manage your team, make trades, sign free agents, and simulate seasons with a sleek dark interface.

## Features

### League Management
- **Create Custom Leagues**: Set up new leagues with custom name, season year, and select your team to manage
- **In-League Settings**: Comprehensive settings screen accessible from the side menu during gameplay (all settings take effect immediately):
  - **League Rules**:
    - Toggle salary cap on/off (when disabled, no cap restrictions apply to signings/trades)
    - Hard cap enforcement (None/Soft Cap with warnings/Strict Cap blocks transactions)
    - Luxury tax severity slider (1-5 scale multiplies tax penalties)
    - Roster size minimum and maximum (8-18 players, enforced on all transactions)
    - Expansion team toggle with protected player count (3/5/7/10)
    - Player gender settings (Male/Female/Mixed) with customizable ratio
  - **Simulation**:
    - Difficulty dropdown (Casual/Normal/Sim Hardcore) affects AI behavior
    - Game simulation detail level (Fast/Standard/Deep) controls calculation depth
    - Injuries frequency slider (1-5 scale, 1=rare, 5=frequent)
    - Player development speed slider (1-5 scale affects progression/regression)
    - Trade frequency slider (1-5 scale controls AI trade attempts)
    - Chemistry & morale impact slider (1-5 scale multiplies satisfaction effects)
  - **Presentation & News**:
    - News feed volume slider (1-5 scale controls story generation)
    - Rumor intensity slider (1-5 scale controls rumor frequency)
    - Toggle award races panel (shows/hides MVP tracking on Dashboard)
    - Toggle odds panel (shows/hides championship odds on Dashboard)
    - Notification settings for trades, contracts, milestones, injuries
    - Auto-save toggle (when off, only manual saves occur)
  - **Accessibility & Misc**:
    - Text size options (Small/Medium/Large)
    - Colorblind-friendly mode toggle
    - Reset to defaults button (restores all settings to default values)
  - All settings are stored per-league and persist in save data
  - Settings changes take effect immediately (e.g., disabling salary cap instantly removes cap restrictions)
  - Real-time visual feedback with sliders, toggles, and dropdown pickers
  - **Advanced League Settings**: Comprehensive customization options accessible via the Settings tab during league creation:
  - **League Structure**:
    - Enable/disable conferences and divisions
    - Customize games per season (10-82 games, default: 82)
    - Set number of playoff teams (4-20 teams)
  - **Gameplay Difficulty**:
    - Choose difficulty level: Easy, Medium, Hard, or Realistic
    - Adjust AI skill level (1-10 scale)
    - Control trade AI aggression (1-10 scale)
  - **Realism Settings**:
    - Toggle injuries with adjustable frequency (low/medium/high)
    - Enable/disable player fatigue effects
    - Control player morale impact on performance
    - Turn on/off contract negotiations
  - **Financial Rules**:
    - Set custom salary cap ($M)
    - Enable luxury tax with custom threshold
    - Configure minimum salary requirements
    - Adjust maximum contract lengths (years)
  - **Draft Settings**:
    - Choose number of draft rounds
    - Enable/disable draft lottery system
    - Set rookie contract length
    - Select draft class quality (poor/average/strong/legendary)
  - **Simulation Settings**:
    - Adjust progression speed (slow/normal/fast)
    - Control player development rate (realistic/accelerated)
    - Set retirement age for players
    - Configure trade deadline week
  - **Player Generation**:
    - Control skill variance (low/medium/high)
    - Adjust superstar frequency (rare/normal/common)
    - Set international player percentage (0-100%)
  - **Gender Options**:
    - Choose player gender (Male/Female/Mixed)
    - Choose coach gender (Male/Female/Mixed)
    - Choose owner gender (Male/Female/Mixed)
    - "Mixed" option provides 50/50 gender distribution
    - Gender-appropriate names from 10+ nationalities for each gender
  - One-tap "Reset to Defaults" button to restore standard settings
- **Customizable Team Details**: Edit team appearance and identity before creating the league
  - Team name and city name editing
  - Primary and secondary logo selection (emoji-based)
  - Primary and secondary team colors (hex codes with live preview)
  - View conference, division, and market size for each team
  - All 30 teams organized by conference and division:
    - **Eastern Conference**: Atlantic, Southeast, Central divisions
    - **Western Conference**: Pacific, Northwest, Southwest divisions
  - Market sizes: Large, Medium, or Small (affects future features)
- **Welcome Message**: New league owners receive a personalized welcome message from the League Commissioner when first accessing their team dashboard
- **Multiple Saved Leagues**: Create and manage multiple leagues simultaneously, each with independent progress
- **Continue Previous Leagues**: Resume any saved league from where you left off
- **League Actions**:
  - **Rename**: Update league names at any time
  - **Export**: Generate a downloadable JSON save file containing all league data (teams, players, coaches, contracts, history, standings, stats, awards, rivalries, draft data, and more). The file can be saved to Files, shared via AirDrop, or sent elsewhere using the iOS share sheet.
  - **Import**: Restore a previously exported league by selecting the JSON file. All league data is recreated exactly as it was, including full history and progress.
  - **Delete**: Remove leagues you no longer want to keep
- **Auto-Save**: All league progress automatically saves after each week simulation
- **League Expansion**: Add new teams to your existing league through an expansion draft
  - **City Selection**: Choose from 10 expansion cities (Las Vegas, Seattle, Vancouver, Louisville, Mexico City, Pittsburgh, Baltimore, San Diego, Kansas City, Tampa)
    - Each city displays market size, tax level, fan passion, and potential rivalries
    - City descriptions highlight unique characteristics and appeal
  - **Team Identity Design**: Customize your expansion team
    - Team name and mascot
    - Primary and secondary logos (emoji-based)
    - Team colors with live preview
    - Custom arena name
    - Brand preview showing complete team identity
  - **Expansion Draft Rules**: Clear explanation of expansion mechanics
    - Existing teams protect their top 8 players (by overall rating)
    - Select exactly 1 player from each existing team
    - Must meet league salary floor
    - Expansion teams receive special benefits (high fan interest, low expectations, improved draft odds)
  - **Interactive Draft Board**: Select players team-by-team
    - View unprotected players from each team
    - Horizontal scrollable player cards with ratings and contracts
    - Real-time salary tracking
    - Visual progress indicator showing players selected
  - **Finalization Screen**: Review all selections before confirming
    - Complete roster summary with player ratings
    - Total salary calculation
    - Expansion benefits recap
    - Team branding preview
  - **Automatic League Updates**: System handles all integration
    - Schedule regenerated to include new team
    - Coach staff auto-generated
    - Agent relationships initialized
    - Transaction history updated
    - Rivalries system expanded

### Team Management
- **View Any Team Roster**: Switch between all 30 teams to scout players and analyze rosters
- **Team Selector**: Dropdown menu showing all teams sorted by your team first, then by wins
- **Team Ownership**: Every team has an owner with unique background and personality
  - Owners have diverse business backgrounds (Tech Entrepreneur, Real Estate Mogul, Investment Banker, Entertainment Mogul, etc.)
  - Net worth ranging from $1.5B to $50B
  - Personality traits influence team management: Patience, Loyalty, Wealth Display, Meddling, Publicity
  - Track years owned and championships won as owner
  - Owners from multiple countries: USA, Canada, UK, China, Russia
- **Coaching Staff**: Every team has a head coach with unique attributes, bio, and personality
  - Coach name displayed on Dashboard and Roster screens (clickable)
  - **Tap coach name** to view complete coach details modal:
    - Overall coaching rating (50-99) with tier classification
    - Full bio: Age, experience, hometown, country, coaching style
    - Former player background with playing career description
    - Career statistics: Win-loss record, win percentage, championships
    - Full coaching attributes: Offense, Defense, Player Development, Management, Motivation, Clutch, Adaptability
    - Personality traits with visual bars: Patience, Intensity, Loyalty, Innovation, Communication, Discipline, Confidence
    - Contract details: Years remaining and annual salary
  - Color-coded attributes (purple/blue/green/yellow for high ratings)
  - Coaching style influences attribute strengths (e.g., Defensive Minded coaches have higher defense ratings)
- View and manage your team roster organized by position (PG, SG, SF, PF, C)
- Track player stats, ratings (0-99 overall), age, and contracts
- View comprehensive player bios including height, weight, wingspan, hometown, country (with flag emoji), college, and draft information (year, round, pick, team)
- **Detailed Player Attributes** organized into four categories:
  - **Athletic Attributes**: Speed, Acceleration, Strength, Vertical, Lateral Quickness, Stamina, Hustle
  - **Offensive Attributes**:
    - *Scoring Skills*: Finishing, Mid-Range Shooting, Three-Point Shooting, Free Throw Shooting, Post Scoring, Shot Creation
    - *Playmaking Skills*: Ball Handling, Passing Vision, Passing Accuracy, Off-Ball Movement
  - **Defensive Attributes**: Perimeter Defense, Interior Defense, Block Rating, Steal Rating, Defensive Rebounding, Offensive Rebounding, Defensive Awareness
  - **Mental Attributes**: Basketball IQ, Consistency, Work Ethic, Leadership, Composure, Discipline, Clutch
- All 34 attributes rated on a 0-100 scale with visual bars and color coding
- View player personality traits and current satisfaction levels
- Tap any player to see their full details in a modal
- Monitor salary cap and available cap space for any team
- Release players (only available for your own team)
- Full 15-player rosters per team

### Rotations & GM-Coach Dynamics
- **Rotations Tab**: Manage player minutes and roles with realistic coach-GM interactions
  - **Coach Sets Rotations by Default**: The head coach determines starting lineups, bench rotations, and playing time
  - **GM Influence System**: As GM, you can suggest changes but the coach may reject them based on:
    - Coach personality traits (confidence, communication, discipline)
    - GM-Coach relationship (trust, authority, tension)
    - Team success and win percentage
    - Star player status (suggestions for 85+ OVR players more likely accepted)
    - Coach job security
  - **Four Action Types**:
    1. **Suggest Minutes**: Recommend specific minutes per game for a player
    2. **Suggest Starter**: Request a player be moved to starting lineup
    3. **Suggest Benching**: Request a player get fewer minutes or bench role
    4. **Manual Override**: Force a change (guaranteed but damages relationship)
  - **GM-Coach Relationship Tracking**:
    - Trust level (0-100): How much coach trusts your basketball decisions
    - Authority level (0-100): Your power to influence basketball decisions
    - Tension level (0-100): Current conflict level with coach
    - Acceptance rate: Percentage of suggestions historically followed
    - Relationship status: Excellent, Good, Neutral, Strained, or Hostile
  - **Realistic Tension**: Manual overrides guarantee changes but:
    - Reduce trust (-5 relationship impact)
    - Increase tension
    - Damage coach morale
    - Can strain the working relationship
  - **View Rotations**: See all players organized by role (Starters, Bench, Reserves, Inactive)
  - **Minutes Display**: Clear MPG (minutes per game) for each player
  - **Recent Actions Log**: Track your last 5 GM actions and coach responses
  - **Coach Reasoning**: See why the coach accepted or rejected each suggestion
  - **Dynamic Depth Chart**: Automatically updates when coach accepts changes

### Trading System
- Trade players with any of the other 29 teams in the league
- Select players from your roster and other teams to complete trades
- Real-time roster updates after trades

### Free Agency
- Browse and sign available free agents
- Tap any free agent to view their detailed attributes
- Filter players by position
- Search for specific players by name
- View player ratings, stats, and contract details
- Sign players within your salary cap limits

### Season Simulation
- Simulate games week by week across the 30-team league
- View league standings with win/loss records and win percentages
- Track recent game results
- See upcoming matchups
- Realistic game simulation based on team strength
- Player satisfaction updates automatically after each week based on team performance and individual circumstances

### Schedule
- **Complete Game Schedule**: View all your team's games organized by in-game day
  - **Day-by-Day Organization**: Games grouped by "Day 1", "Day 2", etc. instead of calendar dates
  - **Realistic Scheduling**: Full 82-game season by default (customizable from 10-82 games during league creation)
    - Default season: 82 games total per team
    - Season spans dynamically: gamesPerSeason × 1.5 days (~123 days for 82 games)
    - **Advanced Conference/Division-Aware Scheduling**: When conferences and divisions are enabled:
      - **Division opponents**: 3-4 games each (high frequency for divisional rivalries)
      - **Same conference (non-division)**: 2-3 games each
      - **Cross-conference**: 2 games each
    - **Opponent Spacing Rules**: Prevents "opponent spam"
      - No same opponent more than twice in 10 days
      - Never more than once every 3 days
    - **Back-to-Back Prevention**:
      - No more than 2 consecutive days with games
      - Limited back-to-back sets per month
    - **Weekly Pacing**: Teams play 3-4 games per 7-day period
    - **Home/Away Balance**: Automatically balanced within ±2 games of 50/50 split
    - No duplicate matchups on the same day
    - **Schedule Validation**: Automatically ensures every team has exactly the configured number of games
      - Auto-regenerates with adjusted parameters if validation fails
  - **Dynamic Schedule Length**: Header displays actual game days (e.g., "123 Game Days" for 82-game season)
  - **Settings Protection**: Games per season cannot be changed after the first game is played
    - Input disabled with tooltip: "Cannot change after the season starts"
    - Schedule regeneration only available before season starts
  - **Game Information**:
    - Opponent name and record
    - Home (vs) or Away (@) indicator
    - Game result (W/L with score) if played
    - "Upcoming" badge for future games
  - **Rivalry Indicators**: Flame emoji (🔥) badge for rivalry games with color coding by intensity
  - **Back-to-Back Indicators**: Orange "B2B" badge when playing consecutive days
  - **Current Day Highlighting**: "NOW" badge and blue text for current game day
  - **Progress Tracking**: Shows X/Y games played for each day
  - **Auto-Scroll**: Automatically scrolls to current day when opening the tab
  - **Game Details Modal**: Tap any game to see:
    - Full matchup with team records
    - Rivalry status and intensity level
    - Box score with final scores (if played)
    - Game tags: Close Game (≤5 pts), 50+ Point Performance, Physical/Intense
    - **Two Game Simulation Options**:
      - **Watch Live**: Real-time play-by-play simulation with live scoreboard
      - **Simulate Instantly**: Quick simulation for immediate results
  - Total game days displayed in header

### Live Game Simulation
- **Watch Live Feature**: Experience games in real-time with play-by-play action
  - **Live Scoreboard**: Real-time score updates with quarter and time remaining
  - **Play-by-Play Feed**: Detailed game events including:
    - Field goals (2PT and 3PT) - made and missed
    - Free throws with accuracy tracking
    - Rebounds (offensive and defensive)
    - Assists on made baskets
    - Steals and turnovers
    - Blocks and physical plays
    - Quarter endings with score summaries
  - **Game Controls**:
    - Pause/Resume simulation
    - Speed controls: Slow (2s), Normal (1s), Fast (0.3s)
    - Skip to End for instant completion
  - **Visual Indicators**:
    - Color-coded plays (green for scores, red for misses, blue for defensive plays)
    - Quarter markers with score updates
    - "Live" badge during active simulation
    - "FINAL" badge when game completes
  - **Realistic Simulation**:
    - Player-specific actions based on position and skill
    - Shooting percentages influenced by player ratings
    - Assists, rebounds, steals, and blocks based on position roles
    - Turnover and foul probabilities
    - Home court advantage factored in
  - Auto-scrolling feed keeps latest plays visible
  - Back button to return to schedule

### Standings
- **Comprehensive League Standings**: View all 30 teams ranked by performance with full statistics, divided by conference:
  - **Dual View Modes**:
    - **Record Mode**: Traditional standings sorted by win-loss record
    - **Power Rankings Mode**: Teams ranked by comprehensive performance analysis (see Power Rankings System below)
  - **Team Logos**: Each team has a unique emoji logo displayed next to their name
  - **Eastern Conference**: 15 teams including Boston, New York, Philadelphia, Toronto, Brooklyn, Miami, Atlanta, Orlando, Charlotte, Chicago, Milwaukee, Detroit, Cleveland, Indianapolis, and Memphis
  - **Western Conference**: 15 teams including Los Angeles, Golden State, Phoenix, Sacramento, Portland, Seattle, Dallas, Houston, San Antonio, New Orleans, Oklahoma City, Denver, Utah, Minnesota, and Las Vegas
  - **Overall Record**: Wins, Losses, Win Percentage
  - **Games Back (GB)**: Distance from first place in each conference
  - **Conference Record**: Win-loss record against same-conference opponents only
  - **Home/Away Records**: Performance breakdown by location
  - **Last 10 Games (L10)**: Recent form showing wins and losses in last 10 games
  - **Current Streak**: Active winning or losing streak (e.g., W5 = 5-game win streak, L3 = 3-game losing streak)
  - **Strength of Schedule (SOS)**: Color-coded difficulty rating and league rank
- Color-coded streaks: Green for winning streaks, red for losing streaks
- Your managed team is highlighted in blue for easy identification
- Each conference sorted independently by win percentage with tiebreakers
- Real-time updates after each simulated week
- Automatic migration: Existing leagues automatically receive team logos when loaded

### Power Rankings System
- **Comprehensive Team Performance Analysis**: Advanced ranking system that goes beyond win-loss records:
  - **Ranking Factors** (weighted calculation):
    - **Team Overall Rating (20%)**: Top player talent and coach quality
    - **Recent Performance (25%)**: Last 10 games weighted toward most recent
    - **Point Differential (20%)**: Average margin of victory/defeat
    - **Offensive Efficiency (12%)**: Scoring ability and shot creation
    - **Defensive Efficiency (13%)**: Points allowed and defensive stops
    - **Strength of Schedule (10%)**: Quality of opponents faced
  - **Momentum Labels**: Dynamic status indicators based on recent trends:
    - **Hot** (Red): High win percentage (70%+) and improving/stable
    - **Surging** (Orange): Rapidly improving, moving up 4+ spots
    - **Steady** (Gray): Consistent performance, no major changes
    - **Cold** (Blue): Low win percentage (30% or below), not improving
    - **Falling** (Indigo): Rapidly declining, dropping 4+ spots
  - **Rank Movement Tracking**:
    - Shows change from previous ranking (+/-) with green/red arrows
    - Displays directional arrows (▲/▼) with number of spots moved
    - Helps identify which teams are trending up or down
  - **Dashboard Integration**:
    - Replaces generic "Standing" label with "Power Ranking"
    - Shows current power rank (e.g., "#3 in League")
    - Displays rank change indicator (+/- from last update)
  - **Standings Screen Toggle**:
    - Switch between "Record" and "Power Rankings" view modes
    - Power Rankings mode shows all teams sorted by power rank
    - Each team displays momentum label and rank trend
    - Includes legend explaining momentum status meanings
  - **Automatic Updates**: Recalculates after every simulated game day
  - **Pre-season Rankings**: Initial rankings based on team ratings before games are played
  - **Backward Compatibility**: Existing leagues automatically generate power rankings on load

### Strength of Schedule (SOS) System
- **Comprehensive schedule difficulty tracking**: Analyze the toughness of each team's opponents throughout the season
  - **SOS Calculation** (0-100 scale):
    - Based on opponent average OVR (team strength)
    - Factors in opponent win percentage
    - Accounts for road vs home games (+15 difficulty for road)
    - Includes rivalry intensity bonus (up to +10 points)
    - All factors weighted and normalized to 0-100 scale
  - **Difficulty Classifications**:
    - **Very Easy** (0-20): Green indicator - Weakest opponents in league
    - **Easy** (21-40): Lime indicator - Below average difficulty
    - **Average** (41-60): Yellow indicator - Typical schedule
    - **Hard** (61-80): Orange indicator - Tough opponents
    - **Very Hard** (81-100): Red indicator - Most challenging schedule in league
  - **League-Wide Rankings**:
    - Teams ranked #1-30 by schedule difficulty (1 = hardest)
    - Rankings displayed in Standings tab with color coding
    - Updates dynamically as season progresses
  - **Dashboard SOS Card**:
    - Current SOS label with rank (e.g., "Hard (#6 toughest)")
    - Last 10 opponents average OVR
    - Next 10 opponents average OVR
    - Quick visual comparison of recent vs upcoming difficulty
  - **Schedule Tab Enhancements**:
    - Each upcoming game shows opponent OVR rating
    - Game difficulty indicator (Very Easy → Very Hard) with color coding
    - **Danger Stretch Detection**: Highlights 3+ consecutive Hard/Very Hard games
    - Danger stretches marked with red border and warning icon
    - "Part of difficult stretch" notification on affected games
  - **Gameplay Effects**:
    - **Coach Respect System**: Coaches gain +1 to +3 overall rating for outperforming with Hard/Very Hard SOS
      - +3 OVR: Win 60%+ games with difficult schedule (exceeded expectations)
      - +2 OVR: Win 50-59% with difficult schedule (met expectations)
      - +1 OVR: Win 40-49% with difficult schedule (decent performance)
      - Coach rating capped at 99 maximum
    - **Fan Expectations**: Teams with harder schedules start with lower pressure (future feature)
  - **Historical Tracking**:
    - Season-end summaries include SOS rank and label
    - Tracks hardest stretch of games during season
    - Records wins/losses vs top-10 SOS teams
    - Full historical data in History tab
- Real-time calculations update after every simulated week
- SOS factors into team evaluation and season performance context

### Statistics Hub
- **Comprehensive Stats Tab**: View detailed player, team, and league statistics throughout the season
  - **Player Statistics**:
    - Sortable leaderboards by category: PPG, RPG, APG, SPG, BPG, Overall Rating
    - Per-game averages calculated from season totals
    - Top 3 players highlighted with medal badges
    - Full player details accessible by tapping any player
    - View all active players with their team affiliations
    - Secondary stats displayed: Steals and blocks
    - Color-coded overall ratings (purple for elite, blue for all-stars, etc.)
  - **Team Statistics**:
    - Compare all 30 teams across multiple categories
    - Points Per Game (PPG) - Offensive firepower rankings
    - Opponent Points Per Game (OPPG) - Defensive strength
    - Pace - Possessions per game estimates
    - Offensive Rating - Points per 100 possessions
    - Defensive Rating - Points allowed per 100 possessions
    - Net Rating - Offensive minus defensive rating
    - Advanced metrics based on roster composition
    - User team highlighted for easy tracking
    - Top 3 teams in each category get medal badges
  - **League Statistics**:
    - Season overview: Total games played, average points per game
    - Game insights: Close games percentage, blowouts, home win rate
    - Scoring records: Highest and lowest scoring games
    - Player statistics: Total active players, average rating
    - Position distribution with visual bars
    - Team statistics: Average wins, roster sizes, team salaries
    - Current season phase indicator
  - **Material Top Tabs**: Smooth navigation between Players, Teams, and League tabs
  - **Category Filters**: Quick-select buttons to sort by different statistical categories
  - Real-time updates as season progresses

### History Tab
- **Comprehensive franchise history tracking**: View past seasons, achievements, transactions, and career progress
  - **Season-by-Season Summary**:
    - Final win-loss record and win percentage
    - Playoff result (qualification status)
    - Team rankings: Overall, Offensive, and Defensive
    - Team rating at start and end of season
    - Head coach name and overall rating
    - Top 3 players with overall ratings and positions
    - Expandable/collapsible cards for detailed view
    - Most recent seasons displayed first
  - **Transaction History**:
    - Chronological list of all team transactions
    - Transaction types tracked:
      - Trades between teams
      - Free agent signings with contract details
      - Waivers and player releases
      - Draft picks
      - Contract extensions
      - Coach hires and fires
    - Each entry shows date, season, and full description
    - Color-coded icons for each transaction type
  - **News Archive**:
    - Complete archive of all league stories from past seasons
    - Stories organized by season and date
    - Category badges for easy identification
    - Quick reference to historical events and storylines
  - **Rivalries Tab**:
    - **Dynamic Rivalry System**: Track intense matchups that develop naturally through gameplay
    - **5-Level Rivalry Meter**: Ice Cold (0-19) → Cold (20-39) → Warm (40-59) → Hot (60-79) → Red Hot (80-100)
    - **Rivalry Score (0-100)**: Calculated based on league events and interactions
    - **Top 3 Current Rivals**: Featured display with detailed stats
      - Rivalry level badge with color coding
      - Lifetime head-to-head record and win percentage
      - Medal badges for top 3 rivals (gold, silver, bronze)
      - Rivalry factors breakdown showing:
        - Close games (≤5 points)
        - Playoff series meetings
        - Trades between teams
        - Physical/intense games
        - 50+ point performances
    - **All Rivalries List**: Complete overview of all team rivalries sorted by intensity
    - **Rivalry Building Factors**:
      - **Regular Season**: Close games (+3), blowouts (+5), 50+ pt games (+4), physical games (+3), game-winners (+5)
      - **Playoffs**: Series meetings (+15), 7-game series (+25), major upsets (+30), consecutive years (+10)
      - **Player Drama**: Star moves (+10), trade requests (+10), conflicts (+5), dirty fouls (+10)
      - **Trades & GM**: Trades between teams (+10), failed negotiations (+5)
    - **Rivalry Cooling**: Rivalries naturally decrease over time
      - -10 points after 3 seasons without playoff meeting
      - -5 points per season when both teams are non-contenders
      - Floor is always 0 (Ice Cold)
    - **Gameplay Effects**:
      - **Game Simulation**: Rivalry games have increased intensity (+15%), more fouls (+25%), volatile clutch moments (+30%), stronger home court (+10%)
      - **Trade Difficulty**: Red Hot rivals refuse trades unless heavily in their favor (70% harder to accept)
      - **Morale Impact**: Winning/losing rivalry games affects team morale (±2 to ±8 based on intensity)
  - **Awards & Achievements** (Coming Soon):
    - MVP, DPOY, ROY tracking
    - All-Star selections
    - All-League teams
    - Player/Coach/GM awards
  - **Franchise Records** (Coming Soon):
    - Most points/rebounds/assists in a game
    - Best seasons by wins and ratings
    - Longest win/loss streaks
    - All-time team records
  - **GM Career Summary**:
    - Total seasons played
    - Lifetime wins and losses with win percentage
    - Championships won
    - Playoff appearances
    - Total trades made
    - Total free agents signed
    - Total draft picks
    - Contract negotiations won/lost (Coming Soon)
    - Visual stat cards with color-coded metrics
  - **Notable Moments** (Coming Soon):
    - Major upsets
    - Award-winning seasons
    - Star player breakouts
    - High-impact trades
  - **Seven Tab Navigation**: Seasons, Transactions, Rivalries, News Archive, Awards, Records, GM Career
  - **Clean Scrollable UI**: Smooth scrolling with expandable sections
  - **Real-time Updates**: Automatically tracks all league activities

### News Feed
- **Dynamic League Stories**: Real-time news generation based on league events, player moods, and team performance
  - **Story Categories**:
    - **Rumors**: Whispers about player interest, trade explorations, and coaching changes
    - **Official Announcements**: Signings, trades, firings, hirings, injuries, and extensions
    - **Player Mood & Drama**: Players unhappy with roles, frustrated with team performance, or thrilled with success
    - **Trade Requests**: Players officially requesting or withdrawing trade demands
    - **League Buzz**: Winning/losing streaks, award race updates, power rankings, and finals odds
    - **Analytics**: Statistical insights and performance trends
    - **Rivalry Updates**: Intensity changes between heated rivals
  - **Story Triggers**:
    - Significant player morale changes (low satisfaction generates drama stories)
    - Winning streaks (5+ consecutive wins highlighted)
    - Losing streaks (5+ consecutive losses reported)
    - Rivalry developments (hot and red-hot rivalries get coverage)
    - Team performance changes
    - Random league rumors for added realism
  - **News Feed UI**:
    - Stories sorted by priority and recency
    - Color-coded category badges (purple for rumors, blue for official, orange for moods, red for trade requests, etc.)
    - Category icons for quick visual identification
    - Timestamp display (e.g., "2h ago", "Yesterday")
    - Expandable stories with detailed content
    - Breaking news banners for major events
    - Filter by category to focus on specific story types
  - **Frequency Control**:
    - 2-5 stories generated per simulated day maximum
    - Breaking news for major events (trades, coaching changes, trade requests)
    - Smart generation prevents story spam
  - **News Archive Integration**:
    - All stories automatically archived in History tab
    - Stories organized by season for historical reference
    - Complete searchable archive of past league events
  - **Real-time Generation**: News stories appear as you simulate games and make moves
  - **Seven Category Filters**: All, Official, Rumors, Player Mood, Trade Requests, League Buzz, Rivalries
  - Adds immersion and narrative depth to league progression

### Award Races
- **Comprehensive Award Tracking**: Monitor season-long award races across six major categories
  - **Award Types Tracked**:
    - **MVP Race**: Most Valuable Player - Best overall player performance
    - **DPOY Race**: Defensive Player of the Year - Elite defensive impact
    - **ROY Race**: Rookie of the Year - Best first-year player
    - **Sixth Man**: Best player coming off the bench
    - **Most Improved Player (MIP)**: Biggest year-over-year improvement
    - **Coach of the Year (COTY)**: Best coaching performance
  - **Top 10 Leaderboards**: Each award displays the top 10 candidates
  - **Detailed Candidate Information**:
    - Player/Coach name and team
    - Current rank with medal badges for top 3 (gold, silver, bronze)
    - Complete stat line (PPG, RPG, APG, etc.)
    - Team record showing wins-losses
    - Momentum indicator (Up, Down, Steady) with visual arrows
    - Short explanation of why they're ranked where they are
  - **Weekly Updates**: Award races automatically update after each simulated week
  - **Dynamic Momentum Tracking**: See which candidates are rising or falling in the race
  - **Accessible from Sidebar**: Dedicated Award Races tab for easy access

### Finals Odds System
- **Comprehensive Odds Calculations**: Advanced statistical model predicting playoff and championship outcomes
  - **Four Odds Categories Displayed on Dashboard**:
    - **Championship Odds**: Probability of winning the title
    - **Conference Title Odds**: Chance to win your conference
    - **Playoff Qualification Odds**: Likelihood of making playoffs
    - **Division Odds**: Probability of winning your division
  - **Dual Format Display**:
    - **Betting Odds Format**: e.g., +450, +1200, -150 (American odds)
    - **Percentage Format**: e.g., 12.0%, 4.5%, 67.8%
  - **Sophisticated Calculation Model** based on:
    - Team Overall Rating (40% weight for championships)
    - Point Differential per game (15% weight)
    - Strength of Schedule (5% weight)
    - Recent 10-game performance (15% weight)
    - Top 3 player OVR weighted average (20% weight for star power)
    - Coach rating impact (5% weight)
    - Injury impact (if applicable)
    - Current standings and games remaining
  - **Real-time Updates**: Odds recalculate weekly after simulations
  - **Context-Aware**: Accounts for conference competition and division standings
  - **Dashboard Integration**: Prominently displayed on team dashboard for easy tracking

### Dynamic Media Headlines
- **Automated Headline Generation**: System creates engaging headlines based on league events
  - **Headline Types**:
    - **Award Race Movement**: Leaders and rising candidates in award races
    - **Odds Shifts**: Championship favorites and underdogs
    - **Hot Streaks**: Teams winning 5+ consecutive games
    - **Cold Streaks**: Teams losing 5+ consecutive games
    - **Upsets**: Major surprises in games and standings
    - **Rivalry Developments**: Updates on heated team rivalries
  - **Priority System**: Most important headlines featured prominently
  - **Automatic Refresh**: Headlines update with each week simulation
  - **Limited Display**: Top 10 most recent/important headlines shown
  - **Contextual Content**: Headlines reference specific players, teams, and statistics

### Team Finances
- **Comprehensive Salary Cap Management**: Track and manage your team's financial situation
  - **2025 NBA-Style Salary Tiers**: Realistic player contracts based on overall rating
    - **92-99 OVR**: $40M-$52M (Superstar / Max Contract)
    - **88-91 OVR**: $28M-$38M (All-Star)
    - **82-87 OVR**: $15M-$25M (Starter)
    - **78-81 OVR**: $10M-$15M (Role Player)
    - **74-77 OVR**: $4M-$9M (Bench)
    - **70-73 OVR**: $1.8M-$4M (Deep Bench)
    - **Under 70 OVR**: $1M-$1.8M (Minimum)
  - **Contract Length Scaling**: Years scale with player overall and age
    - Superstars (92+ OVR): 4-5 year contracts
    - All-Stars (85-91 OVR): 3-4 year contracts
    - Starters (82-87 OVR): 2-3 year contracts
    - Bench players: 1-2 year contracts
    - Veterans (33+) receive shorter deals
  - **2025 Salary Cap**: ~$149M league-wide salary cap
  - **Salary Cap Overview**:
    - Total team salary with visual progress bar
    - Available cap space
    - Salary cap limit ($149M)
    - Luxury tax line ($169M)
    - Hard cap/apron ($180M)
    - Luxury tax bill calculation for teams over the tax line
    - Status badges (Under Cap, Over Cap, In Luxury Tax, Over Hard Cap)
  - **Available Exceptions**:
    - Mid-Level Exception (MLE) - $12.4M
    - Bi-Annual Exception (BAE) - $4.5M
    - Taxpayer Mid-Level (TMLE) - $5.2M
    - Room Exception (for under-cap teams)
  - **Full Cap Sheet**:
    - Complete roster salary breakdown
    - Sorted by highest to lowest salary
    - Shows player position, salary, and years remaining
  - **Payroll Projections**:
    - 4-year salary projections
    - Projected salary cap increases (3% per year)
    - Future cap space calculations
    - Visual indicators for over/under cap status
  - **Dead Money Section**:
    - Tracks waived and buyout contracts
    - Shows amount per year and years remaining
    - Impacts total team payroll
  - **Quick Action Links**:
    - Direct access to Trade Calculator
    - Link to Free Agents page
    - Contract Extensions (coming soon)
  - **Automatic Migration**: Existing leagues automatically update to new contract system when loaded
- Color-coded cap status: Green (healthy), Yellow (near cap), Orange (over cap), Red (luxury tax)
- Real-time calculations based on current roster

### Draft System
- **Complete NBA Draft Experience**: Draft young talent with realistic lottery and scouting system
  - **Draft Class Scouting**:
    - Draft class of 100 prospects generated immediately when league is created
    - Scout prospects throughout the entire season from day 1
    - View complete prospect list at any time, regardless of season phase
    - Top 30 prospects shown by default with option to view full class
    - "Scouting prospects" indicator during regular season/playoffs
  - **Draft Lottery Odds**:
    - Always-visible lottery odds tracker with prominent design
    - Live tracking showing your position and record
    - Up/down arrows indicating lottery movement potential
    - Detailed odds percentages (14% for top 3, decreasing to 0.5% for 14th)
    - Bottom 14 teams eligible for lottery
    - Realistic ping-pong ball simulation
    - Results show which teams moved up or down
  - **Draft Class Generation**:
    - 100 prospects per draft with depth tiers:
      - **Lottery-Caliber** (1-14): Elite and high-level prospects (OVR 72-88)
      - **First Round** (15-30): Solid NBA-ready players (OVR 65-75)
      - **Second Round Early** (31-40): Role players and projects (OVR 62-68)
      - **Sleepers** (41-50): High upside developmental players (OVR 58-65)
      - **Long-shots** (51-70): Raw talent with potential (OVR 55-62)
      - **International Stash** (71-100): Overseas prospects (OVR 52-60)
    - Positional balance: 20 PG, 20 SG, 20 SF, 20 PF, 20 C
    - Complete player bio (height, weight, wingspan, hometown, country, college)
    - Full personality traits (loyalty, work ethic, ego, etc.)
    - Detailed attributes (speed, strength, shooting, defense, IQ, clutch)
    - Overall rating varies by tier (52-88)
    - Potential rating increases for later picks (sleepers and stashes have highest upside)
    - AI-generated scouting reports highlighting strengths and weaknesses
  - **Draft Board**:
    - View top 30 prospects by default
    - Expand to view full 100-player class with one tap
    - "On the Clock" notification when it's your pick
    - One-tap drafting when your pick arrives
    - Track draft progress (pick X/100)
    - See drafted vs available prospects
  - **Season Phases**:
    - Regular Season → Playoffs → Draft Lottery → Draft → Offseason
    - Draft becomes available after playoffs
    - Lottery executes before draft begins
- Prospects become rookies with 4-year contracts on rookie scale salaries
- International and college prospects with realistic nationality distribution

### Player Personality & Satisfaction System
- **8 Unique Personality Traits** (0-100 scale) that shape player behavior:
  - **Loyalty**: How likely to stay with their team long-term (affects free agency decisions and trade reactions)
  - **Money Focus**: How important salary is in their decisions (affects contract negotiations)
  - **Winning Drive**: Desire to win championships (affects interest in good teams, satisfaction with losing teams)
  - **Playing Time Desire**: Importance of minutes and starting role (affects satisfaction with bench role)
  - **Team Player**: How well they work with teammates (affects team chemistry)
  - **Work Ethic**: Dedication to improvement (affects development speed - future feature)
  - **Ego**: Self-importance and pride (affects reactions to trades and criticism)
  - **Temperament**: Emotional stability (100 = calm, 0 = volatile, affects team chemistry)

- **Dynamic Satisfaction System** (0-100%):
  - Updates automatically after each simulated week
  - Influenced by team win/loss record (based on player's winning drive)
  - Affected by playing time/role (starters vs bench players)
  - Impacted by contract value relative to skill level (based on money focus)
  - Team chemistry bonuses for high team player trait
  - Satisfaction changes when traded (high loyalty/ego players react negatively)
  - Visual indicators: Very Happy (80+), Content (60-79), Neutral (40-59), Unhappy (20-39), Very Unhappy (0-19)

- **Star Player Traits**:
  - Players rated 85+ overall tend to have lower loyalty (more likely to leave)
  - Stars demand higher salaries (higher money focus)
  - Elite players (80+ overall) have stronger winning drive
  - Star players typically have bigger egos

### Dark Interface
- Modern dark theme throughout the app
- Color-coded player ratings:
  - Purple (90+): Elite players
  - Blue (85-89): All-Stars
  - Green (80-84): Starters
  - Yellow (75-79): Role players
  - Orange (70-74): Bench players
  - Gray (<70): Developing players

## App Structure

### Screens
- **Home** (`/src/screens/HomeScreen.tsx`): Entry point with options to create new league or continue existing leagues
- **Create League** (`/src/screens/CreateLeagueScreen.tsx`): Form to set up a new league with:
  - **Teams Tab**: Custom name, year, and team selection with team customization options
  - **Settings Tab**: Comprehensive league customization including league structure, gameplay difficulty, realism settings, financial rules, draft settings, simulation settings, and player generation options
- **Continue League** (`/src/screens/ContinueLeagueScreen.tsx`): View and manage all saved leagues with rename, export, and delete options
- **Dashboard** (`/src/screens/DashboardScreen.tsx`): Main team hub featuring:
  - **Welcome Message Modal**: Personalized greeting from the League Commissioner shown once when first creating a new league
  - Team logo, name, and record
  - **Coach Information**: Clickable coach name with info icon (opens detailed modal)
  - **Conference & Division Position**: Dynamic position display showing:
    - "Xth in [Conference] · Yth in [Division]" when divisions enabled
    - "Xth in [Conference]" when only conferences enabled
    - "Xth in League" when conferences/divisions disabled
    - Updates automatically based on current standings
  - Current league standing
  - Last game result with W/L indicator
  - Next upcoming game (home/away)
  - Top 3 players with overall ratings
  - Team ratings (Offense, Defense, Overall)
  - **Efficiency metrics** (2×2 grid):
    - **eFG%**: Effective Field Goal Percentage (measures shooting efficiency with 3-pointers weighted more)
    - **TOV%**: Turnover Percentage (lower is better)
    - **ORB%**: Offensive Rebound Percentage
    - **FT Rate**: Free Throws per Field Goal Attempt
  - Salary cap information with visual progress bar
  - Alerts for expiring contracts, unhappy players, and cap issues
  - Quick action buttons: Simulate Week, Depth Chart
  - **Collapsible Sidebar** with tabs for:
    - **Roster**: View and manage any team's roster (switch teams, view players by position, release players)
    - **Standings**: View comprehensive league standings with records, win percentages, games back, home/away splits, last 10 games, and current streaks
    - **Stats**: Comprehensive statistics hub with player leaderboards, team comparisons, and league analytics
    - **Finances**: Comprehensive salary cap management with cap overview, exceptions, payroll projections, and dead money tracking
    - **Draft**: Scout prospects year-round, track lottery odds, and execute draft picks
    - **Schedule**: View all games organized by day with rivalry indicators and back-to-back markers
    - **History**: Track franchise history, past seasons, transactions, awards, records, and GM career statistics
    - **Trades**: Execute trades with other teams directly from the dashboard
- **Roster** (`/src/screens/RosterScreen.tsx`): Team roster management organized by position with ability to view any team
- **Standings** (`/src/screens/StandingsScreen.tsx`): Comprehensive league standings table with detailed statistics for all 30 teams
- **Stats** (`/src/screens/StatsScreen.tsx`): Statistics hub with three tabs for analyzing player, team, and league performance throughout the season
- **Finances** (`/src/screens/FinancesScreen.tsx`): Complete financial management hub with salary cap overview, player salaries, payroll projections, dead money, and quick action links
- **Draft** (`/src/screens/DraftScreen.tsx`): Complete draft interface with lottery odds display, draft class scouting, and one-tap drafting during draft phase
- **Schedule** (`/src/screens/ScheduleScreen.tsx`): Day-by-day game schedule with rivalry badges, back-to-back indicators, auto-scroll to current day, and game details modal with Watch Live and Simulate options
- **Live Game** (`/src/screens/LiveGameScreen.tsx`): Real-time play-by-play game simulation with live scoreboard, speed controls, and scrolling event feed
- **History** (`/src/screens/HistoryScreen.tsx`): Comprehensive franchise history with season summaries, transaction logs, awards, franchise records, and GM career statistics tracking
- **Trades** (`/src/screens/TradesScreen.tsx`): Player trading interface
- **Free Agents** (`/src/screens/FreeAgentsScreen.tsx`): Browse and sign available players

### State Management
The app uses Zustand with AsyncStorage persistence for state management:
- **Basketball Store** (`/src/state/basketballStore.ts`): Manages all game data including:
  - Multiple saved leagues with independent progress
  - Current active league state
  - Players, teams, season info for each league
  - League management actions (create, load, delete, rename, export)
- Persisted data includes: all saved leagues, player rosters, team records, game results, contract info

### Data Models
- **SavedLeague**: Complete league state with name, creation date, last played date, and all game data
- **Player**: Individual player stats, ratings, contracts, and team assignments
- **Team**: Team info, win/loss records, salary cap, roster
- **Game**: Match results, scores, scheduling
- **Season**: Season progress, game schedule

## Game Mechanics

### Salary Cap
- Each team has a $149M salary cap (2025 NBA standard)
- Player salaries are based on 2025 NBA-style tiers:
  - Superstars (92-99 OVR): $40M-$52M annually for 4-5 years
  - All-Stars (88-91 OVR): $28M-$38M annually for 3-4 years
  - Starters (82-87 OVR): $15M-$25M annually for 2-3 years
  - Role Players (78-81 OVR): $10M-$15M annually for 2-3 years
  - Bench (74-77 OVR): $4M-$9M annually for 1-2 years
  - Deep Bench (70-73 OVR): $1.8M-$4M annually for 1-2 years
  - Minimum (Under 70 OVR): $1M-$1.8M annually for 1-2 years
- Contract length scales with age (veterans get shorter deals)
- Must stay under cap when signing free agents
- Cap space displayed in roster and free agent screens
- Existing leagues automatically migrate to new contract system

### Roster Limits
- Maximum 15 players per team
- Players organized by 5 positions: PG, SG, SF, PF, C
- Can release players to create roster space

### Game Simulation
- Games simulated based on team strength (average player overall rating)
- Home court advantage included in simulation
- Scores typically range 90-130 points
- Results update team win/loss records
- **Two simulation modes**:
  - **Simulate Instantly**: Quick simulation for immediate results without animation
  - **Watch Live**: Real-time play-by-play with adjustable speed (slow/normal/fast)

### Player Generation
- 480 total players generated at game start
- 450 players distributed across 30 teams (15 per team)
- 30 free agents available for signing
- Overall ratings range from 60-99
- **34 unique attributes per player** organized into four categories:
  - **Athletic Attributes** (7): Speed, Acceleration, Strength, Vertical, Lateral Quickness, Stamina, Hustle
  - **Offensive Attributes** (10):
    - *Scoring Skills* (6): Finishing, Mid-Range Shooting, Three-Point Shooting, Free Throw Shooting, Post Scoring, Shot Creation
    - *Playmaking Skills* (4): Ball Handling, Passing Vision, Passing Accuracy, Off-Ball Movement
  - **Defensive Attributes** (7): Perimeter Defense, Interior Defense, Block Rating, Steal Rating, Defensive Rebounding, Offensive Rebounding, Defensive Awareness
  - **Mental Attributes** (7): Basketball IQ, Consistency, Work Ethic, Leadership, Composure, Discipline, Clutch
- Attributes vary based on position:
  - Point Guards excel in: Speed, Acceleration, Ball Handling, Passing Vision, Passing Accuracy, Basketball IQ
  - Shooting Guards excel in: Mid-Range Shooting, Three-Point Shooting, Shot Creation, Off-Ball Movement
  - Small Forwards have balanced attributes across all categories
  - Power Forwards excel in: Strength, Finishing, Post Scoring, Interior Defense, Rebounding
  - Centers excel in: Strength, Vertical, Post Scoring, Interior Defense, Block Rating, Rebounding
- 8 unique personality traits per player: Loyalty, Money Focus, Winning Drive, Playing Time Desire, Team Player, Work Ethic, Ego, and Temperament
- Personality traits influence player behavior, satisfaction, and future decisions (free agency, trades, development)
- All players start with 75% satisfaction that evolves based on team performance and personal circumstances
- Comprehensive player bios with physical measurements (height, weight, wingspan)
- Diverse player backgrounds including hometown, country (with flag emojis from USA, Canada, France, Greece, Serbia, Slovenia, Spain, Germany, Australia, Argentina)
- College background or international designation
- Draft history including draft year, round (1 or 2), pick number, and drafting team
- Heights range from approximately 6'0" to 7'1" based on position
- Weights range from approximately 175-265 lbs based on position and height
- Wingspans typically 2-6 inches longer than height
- Potential ratings factor in player development
- **Realistic 2025 NBA Contracts**: Contract years and salaries generated based on overall rating and age
  - Superstars (92-99 OVR): 4-5 year deals at $40M-$52M per year
  - All-Stars (88-91 OVR): 3-4 year deals at $28M-$38M per year
  - Starters (82-87 OVR): 2-3 year deals at $15M-$25M per year
  - Role Players (78-81 OVR): 2-3 year deals at $10M-$15M per year
  - Bench players (74-77 OVR): 1-2 year deals at $4M-$9M per year
  - Deep bench (70-73 OVR): 1-2 year deals at $1.8M-$4M per year
  - Minimum contracts (Under 70 OVR): 1-2 year deals at $1M-$1.8M per year
  - Rookies receive 4-year rookie scale contracts based on draft position
  - Veterans (33+) receive shorter contract lengths regardless of rating

## All 30 Teams

Each team has a unique emoji logo for easy visual identification throughout the app.

### Eastern Conference (15 teams)
1. Boston Titans ⚡
2. New York Empire 🏛️
3. Philadelphia Knights ⚔️
4. Toronto Guardians 🛡️
5. Brooklyn Royals 👑
6. Miami Inferno 🔥
7. Atlanta Raptors 🦖
8. Orlando Rebellion ⭐
9. Charlotte Panthers 🐆
10. Chicago Legends 📜
11. Milwaukee Hunters 🎯
12. Detroit Ironmen 🔧
13. Cleveland Cobras 🐍
14. Indianapolis Flames 🔥
15. Memphis Warriors ⚔️

### Western Conference (15 teams)
16. Los Angeles Thunder ⚡
17. Golden State Storm 🌪️
18. Phoenix Blaze ☀️
19. Sacramento Dragons 🐉
20. Portland Surge 🌊
21. Seattle Vipers 🐍
22. Dallas Outlaws 🤠
23. Houston Cyclones 🌪️
24. San Antonio Sentinels 🗼
25. New Orleans Voyagers ⛵
26. Oklahoma City Mustangs 🐎
27. Denver Avalanche ⛰️
28. Utah Pioneers 🏔️
29. Minnesota Wolves 🐺
30. Las Vegas Aces 🎰

## Technical Stack

- **Framework**: Expo SDK 53, React Native 0.76.7
- **Navigation**: React Navigation (Native Stack)
- **State**: Zustand with AsyncStorage persistence
- **Styling**: NativeWind (TailwindCSS for React Native)
- **Icons**: Expo Vector Icons (Ionicons)
- **TypeScript**: Fully typed application

## Quick Start

1. **Launch the App**: Start at the home screen
2. **Create Your First League**:
   - Tap "Create New League"
   - Enter a league name (e.g., "My First Dynasty")
   - Set the season year (default: 2025)
   - Choose which team you want to manage from all 30 teams
   - Tap "Create League"
3. **Start Managing**:
   - View your roster to assess your team
   - Simulate weeks to play games
   - Trade players to improve your team
   - Sign free agents to fill gaps
4. **Multiple Leagues**:
   - Create additional leagues with different teams
   - Switch between leagues from the "Continue" screen
   - Each league maintains independent progress

The app automatically initializes each new league with:
- 30 teams with fictional names across various cities
- 480 players (450 distributed across teams at 15 per team, 30 free agents)
- A full season schedule with each team playing every other team 4 times
- Your selected team to manage

## Future Enhancements

Potential features for expansion:
- Player development and aging system
- Draft system for new players
- Playoff bracket and championship
- Advanced stats and analytics
- Team chemistry and morale
- Injury system
- Multiple seasons with offseason management
- AI-controlled team trades
- Player contract negotiations
