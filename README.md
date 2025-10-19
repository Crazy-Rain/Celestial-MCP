# Celestial-MCP
MCP for use with Sillytavern. Might or mightnot work. For use with Celestial Forge scenarios.


Short answer: yes—this is a great fit for an MCP server. You can build a small MCP-compliant service that’s the **source of truth** for a player’s Forge state (perks, CP, response count, achievements), expose a tiny web UI for manual edits, and wire it into SillyTavern so the LLM always sees the up-to-date sheet.

Here’s a concrete plan you can implement.

# What this MCP server does

* **Stores**: character sheet (CP, response counter, tier, notes), unlocked perks, inventory/crafted items, achievements.
* **Serves**: read-only “context packets” sized for prompts, plus full JSON for tools/UI.
* **Updates**: endpoints/tool calls to add/remove perks, grant CP, advance response count, record achievements/crafting.
* **Survives**: restarts (SQLite/Postgres), multi-session, and manual edits via web panel.
* **Optionally**: preloads a perks catalog (your `perks-database.json`) so the AI/UI can search/validate perks.

# Minimal architecture

* **Backend (MCP server)**: TypeScript (Express/fastify) or Python (FastAPI) with an MCP adapter layer.
* **DB**: SQLite for easy local deploy; Postgres if multi-user.
* **UI**: small React/Vite admin at `/ui` (list/filter perks, edit sheet, undo).
* **Auth**: API key or localhost-only during development; token per “world/save”.
* **Schema**: JSON Schema for validation + migrations.

# Data model (lean but complete)

```ts
// characters
Character {
  id: string,               // UUID or short slug
  name: string,
  world: string,            // optional campaign label
  cp_total: number,
  cp_spent: number,
  response_count: number,   // 0..9 (award CP at 10)
  tier: string,             // computed from CP or set manually
  notes: string,
  created_at: datetime,
  updated_at: datetime
}

// unlocked perks (1:n with Character)
UnlockedPerk {
  id: string,
  character_id: string,
  perk_id?: string,         // from catalog, if known
  name: string,             // denormalized for custom perks
  category: string,         // Assistants / Breeding / Crafting:Artisan / ...
  source: string,           // origin universe or "homebrew"
  cost_cp?: number,
  description?: string,
  acquired_at: datetime,
  tags: string[]
}

// catalog (optional, loaded from perks-database.json)
PerkCatalog {
  id: string,
  name: string,
  category: string,
  source: string,
  cost_cp: number,
  description: string,
  tags: string[]
}

// achievements / crafting logs (optional)
EventLog {
  id: string,
  character_id: string,
  kind: "achievement" | "craft" | "award" | "spend" | "note",
  payload: JSON,            // freeform details
  delta_cp?: number,        // positive/negative for ledger
  created_at: datetime
}
```

# MCP tools (what the LLM can call)

Define these MCP “tools” so SillyTavern/AI can **query + mutate** state deterministically.

**Read tools**

* `forge.get_sheet({character_id})` → trimmed sheet for prompts:

  * `{ cp_total, cp_spent, response_count, tier, top_perks:[..5], recent_events:[..5] }`
* `forge.list_perks({character_id, q?, category?, limit?})`
* `forge.search_catalog({q, category?, limit})` (optional, for suggestions)

**Write tools**

* `forge.add_perk({character_id, perk_id? | name, category, source, cost_cp?, description?})`
* `forge.remove_perk({character_id, unlocked_perk_id})`
* `forge.award_cp({character_id, amount, reason})`
* `forge.spend_cp({character_id, amount, reason})`
* `forge.tick_response({character_id})`

  * Server increments `response_count`; if it hits 10 → reset to 0, `award_cp(base_award)` and append an `EventLog`.
* `forge.set_tier({character_id, tier})` (or compute tier from CP server-side)

**Idempotency & safety**

* Every mutating tool accepts an optional `request_id` so retries don’t double-apply.
* Server validates: cannot spend more CP than available; cannot remove nonexistent perk; catalog cross-check if provided.

# Prompt wiring (so it never “forgets”)

In SillyTavern:

1. **On message start**: call `forge.get_sheet` and inject a compact block into the system/context:

   ```
   [FORGE STATE]
   CP: 450 (Spent 300) | Tier: Forge Adept | Responses: 7/10
   Perks (sample): A.I. Chip (Assistants, 600), Artisan (Crafting:Artisan, 100), Constructor Drone (Assistants, 200)
   Recent: +50 CP (Spark cycle), Crafted "Silver Relic"
   ```
2. **At end of AI reply**: call `forge.tick_response` (server enforces award on 10/10).

   * The server returns the updated counter and, if triggered, a `cp_awarded` field.
3. **When the player buys/unlocks**: the AI/tool calls `forge.add_perk` and `forge.spend_cp`.
4. **Optional**: if the AI proposes new perks, it can call `forge.search_catalog` to suggest valid entries.

> Because the **server** is the source of truth and the **AI only mirrors** it in the prompt, you avoid drift or loss.

# Web UI features (for you/GM)

* Select character (or create).
* Live sheet: CP, responses, tier, notes.
* Perk manager: add (from catalog or custom), edit, remove.
* Ledger: undo/redo for last N events.
* Catalog browser: import/update `perks-database.json`, filter by category/source/cost.
* Export/Import: full JSON save, per-character.

# CP/Response logic (server-side)

* Config file:

  ```json
  {
    "spark_cycle_size": 10,
    "cp_award_per_cycle": 50,
    "tiers": [
      {"name":"Spark Initiate","min_cp":0},
      {"name":"Forge Adept","min_cp":500},
      {"name":"Celestial Artisan","min_cp":1500},
      {"name":"Architect of Realities","min_cp":3000}
    ]
  }
  ```
* `tick_response`:

  * `response_count = (response_count + 1) % 10`
  * if rollover → `award_cp(cp_award_per_cycle)` and write an `EventLog`.

# Keeping prompts lean

* `forge.get_sheet` should return **two variants**:

  * `summary_for_prompt` (≤ 800–1200 chars).
  * `full_sheet` (for the UI or deep inspection).
* Perks list for the prompt: top N by **recency** or **synergy relevance** (server can compute a small set).

# Handling multiple chats/saves

* Use `character_id` + optional `session_id` so different ST chats can reference the same character.
* You can also clone a character to a new “world/save”.

# Security & stability

* Local-first deployment (`localhost:8787`), CORS only for SillyTavern host.
* Simple API token in headers for ST, separate admin token for the web UI.
* Daily JSON exports for backup.

# Nice-to-haves

* **Crafting tiers**: let `forge.craft_item({tier,...})` auto-award CP by tier.
* **Synergy helper**: server suggests complementary perks when a new one is added (via catalog tags).
* **Conflict checks**: optional rules to prevent mutually exclusive perks.
