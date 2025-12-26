# 🏀 HOOPS DYNASTY - Basketball GM Simulator

A comprehensive basketball franchise management simulator built with React and IndexedDB. Manage your team, draft players, simulate seasons, and build a dynasty!

## Features

### 🎮 Game Modes
- **Create New League** - Start fresh with customizable teams and settings
- **Continue League** - Resume your saved franchise
- **Custom Team Editor** - Unlimited team customization with no restrictions

### 🏆 League Management
- **Home Screen** - Landing page with league options
- **Team Selection** - Choose from 30 fictional teams or create custom ones
- **League Settings** - Comprehensive customization options

### ⚙️ Comprehensive League Settings
- **Season Structure**: Regular season games (50-82), playoff teams (4-16), series length
- **Player Development**: Progression speed, injury frequency, retirement variance
- **Draft Settings**: Draft rounds (1-5), lottery odds, rookie class quality
- **Financial**: Custom salary cap, luxury tax, team budgets, revenue difficulty
- **Simulation**: Auto-save frequency, simulation speed, stat tracking
- **League Structure**: Divisions, conferences, playoff seeding
- **Realism Options**: Player morale, coach ratings, team chemistry

### 👥 Team Customization
- Edit/Add/Remove unlimited teams
- Customize: Team name, city, abbreviation, conference, division
- Stadium capacity configuration
- Primary & secondary team colors with color picker
- Logo URLs (primary and secondary)
- Real-time team preview

### 📊 Game Features
- **Dashboard**: Season overview, team stats, quick actions
- **Roster Management**: View and manage your players
- **League Standings**: Track all teams' performance
- **Finances**: Detailed salary cap management
- **Season Simulation**: Simulate games and playoffs
- **Player Development**: Watch players grow and develop
- **Draft System**: Annual rookie draft with prospect ratings
- **Championships**: Track dynasty success

## Tech Stack

- **Frontend**: React 18 (via CDN)
- **Database**: IndexedDB with Dexie.js
- **Styling**: Tailwind CSS
- **Build**: Single HTML file (no build process needed)

## Getting Started

1. Open `bbgm-html-full.html` in a modern web browser
2. Click "Create New League" to start
3. Customize your teams (optional)
4. Select your team to manage
5. Configure league settings
6. Start your dynasty!

## Game Flow

1. **Home Screen** → Create or Continue League
2. **Team Editor** (Optional) → Customize all teams
3. **Team Selection** → Choose your franchise
4. **League Settings** → Configure game rules
5. **Main Game** → Navigate through seasons, manage roster, simulate games

## Navigation

### Sidebar Menu
- 🏠 Dashboard - Season overview and quick actions
- 👥 Roster - Manage your players
- 📊 League Standings - View all teams
- 🎯 Draft (Coming Soon)
- 🔄 Trades (Coming Soon)
- ✍️ Free Agency (Coming Soon)
- 💰 Finances - Salary cap management
- 📜 History (Coming Soon)

## Features in Detail

### Player System
- Dynamic player generation with realistic attributes
- Age progression and skill development
- Contract management
- Performance statistics (PPG, RPG, APG)
- Overall rating and potential rating

### Financial System
- Salary cap management ($140M default)
- Luxury tax threshold ($165M default)
- Custom cap amounts
- Team budgets
- Player salaries based on ratings

### Simulation
- Full season simulation
- Playoff simulation
- Player stat generation
- Team standings
- Championship tracking

## Browser Compatibility

Works in all modern browsers with IndexedDB support:
- Chrome/Edge (Recommended)
- Firefox
- Safari

## Data Storage

All game data is stored locally in your browser using IndexedDB:
- Player data
- Team data
- Season history
- Game state
- Custom team configurations
- League settings

## Development

This is a single-file application. To modify:
1. Edit `bbgm-html-full.html`
2. Refresh browser to see changes
3. Clear IndexedDB if you need to reset data

## Future Features (Placeholders)
- Interactive Draft
- Trade System
- Free Agency Market
- Historical Statistics
- Coach System
- Player Morale
- Team Chemistry

## License

Open source project - feel free to modify and share!

## Credits

Built with ❤️ for basketball and simulation game fans.

---

**Note**: All team names are fictional. No affiliation with actual NBA teams or organizations.
