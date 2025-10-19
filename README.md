# Celestial Forge MCP Server

A local MCP (Model Context Protocol) server for managing Celestial Forge character progression in SillyTavern and other MCP-compatible AI clients.

## Features

- 🎮 **Character Management** - Track multiple characters with CP, tier, and progression
- ⭐ **5600+ Perks** - Complete Celestial Forge lorebook pre-loaded
- 🔄 **Automatic Progression** - CP awards every 10 responses (configurable)
- 📊 **Tier System** - Four tiers from Spark Initiate to Architect of Realities
- 💾 **SQLite Storage** - Simple, local database storage
- 🔧 **MCP Compatible** - Works with SillyTavern and other MCP clients

## Quick Start

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

## Usage

The server provides MCP tools for managing Celestial Forge characters:

- `forge.create_character` - Create a new character
- `forge.get_sheet` - Get character sheet with prompt-ready summary
- `forge.list_perks` - List character's unlocked perks
- `forge.search_catalog` - Search the 5600+ perk catalog
- `forge.add_perk` - Add a perk to a character
- `forge.award_cp` / `forge.spend_cp` - Manage Choice Points
- `forge.tick_response` - Increment response counter (auto-awards CP at 10)

See [SETUP.md](SETUP.md) for detailed documentation.

## What is this?

This MCP server acts as the **source of truth** for Celestial Forge character progression:

1. **Stores** character sheets, unlocked perks, CP totals, and event history
2. **Serves** context-optimized summaries for AI prompts
3. **Tracks** response counts and automatically awards CP every 10 responses
4. **Validates** CP spending and perk requirements
5. **Persists** all data across sessions in SQLite

Designed to integrate seamlessly with SillyTavern so the AI always has access to the current character state.

## Example Integration

In SillyTavern:

1. **Message Start**: Call `forge.get_sheet` to inject state into prompt
2. **After AI Reply**: Call `forge.tick_response` to track progression
3. **When Buying Perks**: 
   - `forge.search_catalog` to find perks
   - `forge.add_perk` to unlock
   - `forge.spend_cp` to pay cost

The server handles all state management, CP validation, and tier progression automatically.

## Configuration

Edit `config.json` to adjust game rules:

```json
{
  "spark_cycle_size": 10,       // Responses per CP award
  "cp_award_per_cycle": 50,     // CP awarded per cycle
  "tiers": [...]                // Tier thresholds
}
```

## Data Storage

All data stored in `forge.db` (SQLite):
- Character sheets and stats
- Unlocked perks per character  
- Complete perk catalog (5600+ entries)
- Full event log for auditing

Backup by copying `forge.db`.

## Requirements

- Node.js 18 or higher
- npm (included with Node.js)

## Documentation

- [SETUP.md](SETUP.md) - Detailed setup and usage guide
- [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md) - Original design spec

## License

ISC
