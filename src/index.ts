#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ForgeDatabase } from './database.js';
import { CharacterOperations } from './character-ops.js';
import { PerkOperations } from './perk-ops.js';
import { CPOperations } from './cp-ops.js';
import * as fs from 'fs';
import * as path from 'path';

// Initialize database and operations
const db = new ForgeDatabase('forge.db');
const characterOps = new CharacterOperations(db.getDatabase());
const perkOps = new PerkOperations(db.getDatabase());
const cpOps = new CPOperations(db.getDatabase(), 'config.json');

// Load perks catalog on startup
function loadPerksCatalog() {
  try {
    const perksData = JSON.parse(fs.readFileSync('perks.json', 'utf-8'));
    const allPerks: any[] = [];
    
    // Flatten the categorized perks
    for (const [category, perks] of Object.entries(perksData)) {
      if (Array.isArray(perks)) {
        for (const perk of perks) {
          allPerks.push({
            ...perk,
            category
          });
        }
      }
    }
    
    console.error(`Loading ${allPerks.length} perks into catalog...`);
    perkOps.loadCatalog(allPerks);
    console.error('Perks catalog loaded successfully');
  } catch (error) {
    console.error('Error loading perks catalog:', error);
  }
}

// Load catalog on startup
loadPerksCatalog();

// Create MCP server
const server = new Server(
  {
    name: 'celestial-forge-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define MCP tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'forge.create_character',
        description: 'Create a new character',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Character name' },
            world: { type: 'string', description: 'World/campaign name' },
          },
          required: ['name'],
        },
      },
      {
        name: 'forge.get_sheet',
        description: 'Get a character sheet with summary for prompts',
        inputSchema: {
          type: 'object',
          properties: {
            character_id: { type: 'string', description: 'Character ID' },
          },
          required: ['character_id'],
        },
      },
      {
        name: 'forge.list_characters',
        description: 'List all characters',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'forge.list_perks',
        description: 'List perks for a character',
        inputSchema: {
          type: 'object',
          properties: {
            character_id: { type: 'string', description: 'Character ID' },
            q: { type: 'string', description: 'Search query' },
            category: { type: 'string', description: 'Filter by category' },
            limit: { type: 'number', description: 'Maximum results' },
          },
          required: ['character_id'],
        },
      },
      {
        name: 'forge.search_catalog',
        description: 'Search the perks catalog',
        inputSchema: {
          type: 'object',
          properties: {
            q: { type: 'string', description: 'Search query' },
            category: { type: 'string', description: 'Filter by category' },
            limit: { type: 'number', description: 'Maximum results' },
          },
        },
      },
      {
        name: 'forge.add_perk',
        description: 'Add a perk to a character',
        inputSchema: {
          type: 'object',
          properties: {
            character_id: { type: 'string', description: 'Character ID' },
            perk_id: { type: 'string', description: 'Perk ID from catalog (optional)' },
            name: { type: 'string', description: 'Perk name' },
            category: { type: 'string', description: 'Perk category' },
            source: { type: 'string', description: 'Perk source/origin' },
            cost_cp: { type: 'number', description: 'CP cost' },
            description: { type: 'string', description: 'Perk description' },
          },
          required: ['character_id', 'name', 'category', 'source'],
        },
      },
      {
        name: 'forge.remove_perk',
        description: 'Remove a perk from a character',
        inputSchema: {
          type: 'object',
          properties: {
            character_id: { type: 'string', description: 'Character ID' },
            unlocked_perk_id: { type: 'string', description: 'Unlocked perk ID to remove' },
          },
          required: ['character_id', 'unlocked_perk_id'],
        },
      },
      {
        name: 'forge.award_cp',
        description: 'Award CP to a character',
        inputSchema: {
          type: 'object',
          properties: {
            character_id: { type: 'string', description: 'Character ID' },
            amount: { type: 'number', description: 'CP amount to award' },
            reason: { type: 'string', description: 'Reason for award' },
          },
          required: ['character_id', 'amount', 'reason'],
        },
      },
      {
        name: 'forge.spend_cp',
        description: 'Spend CP from a character',
        inputSchema: {
          type: 'object',
          properties: {
            character_id: { type: 'string', description: 'Character ID' },
            amount: { type: 'number', description: 'CP amount to spend' },
            reason: { type: 'string', description: 'Reason for spending' },
          },
          required: ['character_id', 'amount', 'reason'],
        },
      },
      {
        name: 'forge.tick_response',
        description: 'Increment response counter and award CP if cycle completes',
        inputSchema: {
          type: 'object',
          properties: {
            character_id: { type: 'string', description: 'Character ID' },
          },
          required: ['character_id'],
        },
      },
      {
        name: 'forge.set_tier',
        description: 'Manually set character tier',
        inputSchema: {
          type: 'object',
          properties: {
            character_id: { type: 'string', description: 'Character ID' },
            tier: { type: 'string', description: 'Tier name' },
          },
          required: ['character_id', 'tier'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (!args) {
      throw new Error('Missing arguments');
    }

    switch (name) {
      case 'forge.create_character': {
        const character = characterOps.createCharacter(
          args.name as string,
          args.world as string || ''
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(character, null, 2),
            },
          ],
        };
      }

      case 'forge.get_sheet': {
        const sheet = characterOps.getCharacterSheet(args.character_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(sheet, null, 2),
            },
          ],
        };
      }

      case 'forge.list_characters': {
        const characters = characterOps.listCharacters();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(characters, null, 2),
            },
          ],
        };
      }

      case 'forge.list_perks': {
        const perks = perkOps.listPerks(args.character_id as string, {
          q: args.q as string,
          category: args.category as string,
          limit: args.limit as number,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(perks, null, 2),
            },
          ],
        };
      }

      case 'forge.search_catalog': {
        const results = perkOps.searchCatalog({
          q: args.q as string,
          category: args.category as string,
          limit: args.limit as number,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'forge.add_perk': {
        const perk = perkOps.addPerk(
          args.character_id as string,
          args.name as string,
          args.category as string,
          args.source as string,
          args.cost_cp as number,
          args.description as string,
          args.perk_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(perk, null, 2),
            },
          ],
        };
      }

      case 'forge.remove_perk': {
        perkOps.removePerk(args.unlocked_perk_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, removed: args.unlocked_perk_id }),
            },
          ],
        };
      }

      case 'forge.award_cp': {
        const event = cpOps.awardCP(
          args.character_id as string,
          args.amount as number,
          args.reason as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(event, null, 2),
            },
          ],
        };
      }

      case 'forge.spend_cp': {
        const event = cpOps.spendCP(
          args.character_id as string,
          args.amount as number,
          args.reason as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(event, null, 2),
            },
          ],
        };
      }

      case 'forge.tick_response': {
        const result = cpOps.tickResponse(args.character_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'forge.set_tier': {
        cpOps.setTier(args.character_id as string, args.tier as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, tier: args.tier }),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: String(error) }),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Celestial Forge MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
