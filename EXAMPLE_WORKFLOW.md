# Example Workflow - Using Celestial Forge MCP in SillyTavern

This guide shows a typical workflow for using the Celestial Forge MCP server in a SillyTavern chat session.

## Initial Setup

### 1. Start a New Campaign

First, create a character for your campaign:

```javascript
// Tool: forge.create_character
{
  "name": "Alex Mercer",
  "world": "Worm AU Campaign"
}
```

This returns a character with a unique `character_id`. Save this ID - you'll need it for all future operations.

### 2. Get Initial State

At the start of your chat, inject the character state into the prompt:

```javascript
// Tool: forge.get_sheet
{
  "character_id": "your-character-id-here"
}
```

Response includes:
```json
{
  "cp_total": 0,
  "cp_spent": 0,
  "cp_available": 0,
  "response_count": 0,
  "tier": "Spark Initiate",
  "top_perks": [],
  "recent_events": [],
  "summary_for_prompt": "[FORGE STATE]\nCP: 0 (Spent 0, Available 0) | Tier: Spark Initiate | Responses: 0/10\nPerks (recent): None\nRecent: No recent events"
}
```

Use the `summary_for_prompt` field in your system prompt or context.

## During Play

### 3. Track AI Responses

After each AI response in the chat, increment the counter:

```javascript
// Tool: forge.tick_response
{
  "character_id": "your-character-id-here"
}
```

Response:
```json
{
  "response_count": 1,
  "cp_awarded": 0,
  "cycle_complete": false
}
```

When `response_count` reaches 10:
```json
{
  "response_count": 0,
  "cp_awarded": 50,
  "cycle_complete": true
}
```

### 4. Browse Available Perks

When the character wants to acquire a new perk, search the catalog:

```javascript
// Tool: forge.search_catalog
{
  "q": "robot",
  "limit": 10
}
```

Or browse by category:
```javascript
// Tool: forge.search_catalog
{
  "category": "Assistants",
  "limit": 20
}
```

### 5. Acquire a Perk

When you find a perk to acquire:

```javascript
// Tool: forge.add_perk
{
  "character_id": "your-character-id-here",
  "name": "Constructor Drone and AI Kernel",
  "category": "Assistants",
  "source": "Warhammer 40k: T'au Empire",
  "cost_cp": 100,
  "description": "Automated constructor unit with AI kernel for specialized tasks"
}
```

Then spend the CP:

```javascript
// Tool: forge.spend_cp
{
  "character_id": "your-character-id-here",
  "amount": 100,
  "reason": "Purchased Constructor Drone perk"
}
```

### 6. Award CP for Achievements

When the character completes a major achievement:

```javascript
// Tool: forge.award_cp
{
  "character_id": "your-character-id-here",
  "amount": 100,
  "reason": "Defeated Lung and saved the city"
}
```

## Typical Chat Flow

Here's how a typical chat session might flow:

1. **Chat Start**: Call `forge.get_sheet` → Inject summary into system prompt
2. **After AI Reply**: Call `forge.tick_response` → Track progression
3. **Player Action**: "I want to look for a crafting perk"
   - Call `forge.search_catalog` with q="crafting"
   - Show results to player
4. **Player Decision**: "I'll take the Artisan perk"
   - Call `forge.add_perk` with perk details
   - Call `forge.spend_cp` with cost
5. **Achievement**: "I completed the boss fight"
   - Call `forge.award_cp` with bonus amount
6. **Next Message**: Call `forge.get_sheet` again → Update prompt context

## Advanced Usage

### List Character's Perks

See all perks a character has unlocked:

```javascript
// Tool: forge.list_perks
{
  "character_id": "your-character-id-here",
  "limit": 50
}
```

Filter by category:
```javascript
// Tool: forge.list_perks
{
  "character_id": "your-character-id-here",
  "category": "Crafting",
  "limit": 20
}
```

Search unlocked perks:
```javascript
// Tool: forge.list_perks
{
  "character_id": "your-character-id-here",
  "q": "AI",
  "limit": 10
}
```

### Remove a Perk

If you need to remove a perk (requires the unlocked perk ID from `list_perks`):

```javascript
// Tool: forge.remove_perk
{
  "character_id": "your-character-id-here",
  "unlocked_perk_id": "perk-uuid-here"
}
```

### Manual Tier Adjustment

Normally tiers update automatically, but you can set them manually:

```javascript
// Tool: forge.set_tier
{
  "character_id": "your-character-id-here",
  "tier": "Forge Adept"
}
```

Available tiers (from config.json):
- Spark Initiate (0+ CP)
- Forge Adept (500+ CP)
- Celestial Artisan (1500+ CP)
- Architect of Realities (3000+ CP)

### Managing Multiple Characters

List all characters in your campaigns:

```javascript
// Tool: forge.list_characters
{}
```

This returns all characters with their current stats.

## Tips for Best Results

1. **Always call `get_sheet` at message start** - Keeps the AI aware of current state
2. **Call `tick_response` after every AI reply** - Ensures progression tracking
3. **Use the `summary_for_prompt`** - Optimized for token efficiency
4. **Search before adding perks** - Check the catalog to find official perks
5. **Log reasons for CP changes** - Makes the event log more useful
6. **Backup `forge.db` regularly** - Preserves your campaign data

## Example Session

```
1. Chat Start
   → forge.get_sheet
   → Inject state: "CP: 250 (Available 250) | Tier: Spark Initiate | Responses: 3/10"

2. AI replies with story development
   → forge.tick_response
   → Response count now 4/10

3. Player: "I want to buy a perk to help with crafting"
   → forge.search_catalog(q="crafting", limit=10)
   → Show 10 crafting perks to player

4. Player: "I'll take the Artisan perk for 100 CP"
   → forge.add_perk(name="Artisan", category="Crafting:Artisan", cost_cp=100)
   → forge.spend_cp(amount=100, reason="Purchased Artisan perk")

5. Next message
   → forge.get_sheet
   → New state: "CP: 250 (Spent 100, Available 150) | Tier: Spark Initiate | Responses: 4/10"
```

## Troubleshooting

### "Character not found"
- Make sure you saved the `character_id` from `create_character`
- Use `list_characters` to find the correct ID

### "Insufficient CP"
- Check current balance with `get_sheet`
- Award more CP with `award_cp` if needed
- Remember: cycle awards happen automatically every 10 responses

### Perks not showing up
- Make sure the server loaded the catalog (check startup logs)
- Try searching with broader terms
- Check the category spelling

### Response counting not working
- Verify you're calling `tick_response` after each AI reply
- Check the return value - it shows current count
- Cycles reset to 0 after awarding CP
