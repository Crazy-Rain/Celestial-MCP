# Celestial Forge MCP Server - Setup Guide

This is a local MCP (Model Context Protocol) server for managing Celestial Forge character progression in SillyTavern or other MCP-compatible AI clients.

## Features

- **Character Management**: Create and manage multiple characters with CP tracking
- **Perk System**: 5600+ perks from the Celestial Forge system loaded from lorebook
- **Response Counting**: Automatic CP awards every 10 responses (configurable)
- **Tier Progression**: Automatic tier advancement based on CP totals
- **Event Logging**: Complete history of CP awards, spends, and perk acquisitions
- **SQLite Storage**: All data stored locally in a simple database file
- **MCP Compatible**: Works with SillyTavern and other MCP clients

## Prerequisites

- Node.js 18 or higher
- npm (comes with Node.js)

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

## Configuration

The server uses `config.json` for game rules:

```json
{
  "spark_cycle_size": 10,       // Responses per cycle
  "cp_award_per_cycle": 50,     // CP awarded per cycle
  "tiers": [
    {"name": "Spark Initiate", "min_cp": 0},
    {"name": "Forge Adept", "min_cp": 500},
    {"name": "Celestial Artisan", "min_cp": 1500},
    {"name": "Architect of Realities", "min_cp": 3000}
  ]
}
```

You can modify these values to adjust game balance.

## Running the Server

Start the MCP server:
```bash
npm start
```

The server runs on stdio and communicates via the MCP protocol.

## Connecting to SillyTavern

To use this MCP server with SillyTavern:

1. Add the server to your SillyTavern MCP configuration
2. Point to the server executable: `node /path/to/Celestial-MCP/dist/index.js`
3. The server will be available for tool calls in your chats

## Available MCP Tools

### Character Management

#### `forge.create_character`
Create a new character.
```json
{
  "name": "Hero Name",
  "world": "Campaign Name"
}
```

#### `forge.get_sheet`
Get a character's full sheet with summary for prompts.
```json
{
  "character_id": "uuid"
}
```

#### `forge.list_characters`
List all characters.
```json
{}
```

### Perk Management

#### `forge.list_perks`
List a character's unlocked perks.
```json
{
  "character_id": "uuid",
  "q": "search query",      // optional
  "category": "Assistants",  // optional
  "limit": 10               // optional
}
```

#### `forge.search_catalog`
Search the perks catalog (5600+ perks).
```json
{
  "q": "search query",      // optional
  "category": "Crafting",   // optional
  "limit": 20              // optional
}
```

#### `forge.add_perk`
Add a perk to a character.
```json
{
  "character_id": "uuid",
  "name": "Perk Name",
  "category": "Assistants",
  "source": "Origin World",
  "cost_cp": 100,           // optional
  "description": "...",     // optional
  "perk_id": "catalog_id"   // optional
}
```

#### `forge.remove_perk`
Remove a perk from a character.
```json
{
  "character_id": "uuid",
  "unlocked_perk_id": "perk_uuid"
}
```

### CP (Choice Points) Management

#### `forge.award_cp`
Award CP to a character.
```json
{
  "character_id": "uuid",
  "amount": 50,
  "reason": "Quest completion"
}
```

#### `forge.spend_cp`
Spend CP (validates sufficient balance).
```json
{
  "character_id": "uuid",
  "amount": 100,
  "reason": "Purchasing perk"
}
```

#### `forge.tick_response`
Increment response counter (awards CP on cycle completion).
```json
{
  "character_id": "uuid"
}
```

Returns:
```json
{
  "response_count": 3,
  "cp_awarded": 0,
  "cycle_complete": false
}
```

When cycle completes (10/10):
```json
{
  "response_count": 0,
  "cp_awarded": 50,
  "cycle_complete": true
}
```

#### `forge.set_tier`
Manually set character tier.
```json
{
  "character_id": "uuid",
  "tier": "Forge Adept"
}
```

## Integration with SillyTavern

### Recommended Setup

1. **On Message Start**: Call `forge.get_sheet` to inject current state
   - Returns a `summary_for_prompt` field optimized for context

2. **After AI Response**: Call `forge.tick_response`
   - Automatically tracks progression
   - Awards CP every 10 responses

3. **When Buying Perks**: 
   - Call `forge.search_catalog` to find perks
   - Call `forge.add_perk` to add the perk
   - Call `forge.spend_cp` to deduct the cost

### Example Prompt Context

The `forge.get_sheet` tool returns a summary like:
```
[FORGE STATE]
CP: 450 (Spent 300, Available 150) | Tier: Forge Adept | Responses: 7/10
Perks (recent): A.I. Chip (Assistants, 600 CP), Artisan (Crafting, 100 CP)
Recent: +50 CP (Spark cycle), Crafted "Silver Relic"
```

## Data Storage

All data is stored in `forge.db` (SQLite database):
- Characters and their stats
- Unlocked perks per character
- Perk catalog (5600+ entries)
- Event logs for auditing

To backup your data, simply copy the `forge.db` file.

## Troubleshooting

### Server won't start
- Ensure you've run `npm install` and `npm run build`
- Check Node.js version: `node --version` (must be 18+)

### Perks not loading
- Ensure `perks.json` is in the same directory as the server
- Check console for error messages

### Database errors
- Delete `forge.db` to reset (WARNING: loses all data)
- Make backup copies regularly

## Development

To rebuild after making changes:
```bash
npm run build
```

To run in development mode:
```bash
npm run dev
```

## File Structure

```
Celestial-MCP/
├── src/
│   ├── index.ts           # MCP server implementation
│   ├── database.ts        # Database schema and initialization
│   ├── character-ops.ts   # Character management operations
│   ├── perk-ops.ts        # Perk management operations
│   └── cp-ops.ts          # CP and event operations
├── dist/                  # Compiled JavaScript (generated)
├── config.json           # Game rules configuration
├── perks.json            # Perks lorebook (5600+ entries)
├── forge.db              # SQLite database (generated)
├── package.json          # Node.js dependencies
└── tsconfig.json         # TypeScript configuration
```

## License

ISC
