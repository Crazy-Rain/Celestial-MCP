import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { Character, UnlockedPerk, EventLog } from './database.js';

export class CharacterOperations {
  constructor(private db: Database.Database) {}

  createCharacter(name: string, world: string = ''): Character {
    const id = randomUUID();
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO characters (id, name, world, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, name, world, now, now);
    
    return this.getCharacter(id)!;
  }

  getCharacter(characterId: string): Character | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM characters WHERE id = ?
    `);
    
    return stmt.get(characterId) as Character | undefined;
  }

  listCharacters(): Character[] {
    const stmt = this.db.prepare(`
      SELECT * FROM characters ORDER BY updated_at DESC
    `);
    
    return stmt.all() as Character[];
  }

  updateCharacter(characterId: string, updates: Partial<Character>): void {
    const fields: string[] = [];
    const values: any[] = [];
    
    const allowedFields = ['name', 'world', 'cp_total', 'cp_spent', 'response_count', 'tier', 'notes'];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    if (fields.length === 0) return;
    
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(characterId);
    
    const stmt = this.db.prepare(`
      UPDATE characters SET ${fields.join(', ')} WHERE id = ?
    `);
    
    stmt.run(...values);
  }

  deleteCharacter(characterId: string): void {
    const stmt = this.db.prepare(`DELETE FROM characters WHERE id = ?`);
    stmt.run(characterId);
  }

  getCharacterSheet(characterId: string): any {
    const character = this.getCharacter(characterId);
    if (!character) {
      throw new Error(`Character ${characterId} not found`);
    }

    // Get top 5 most recent perks
    const perksStmt = this.db.prepare(`
      SELECT name, category, source, cost_cp
      FROM unlocked_perks
      WHERE character_id = ?
      ORDER BY acquired_at DESC
      LIMIT 5
    `);
    const topPerks = perksStmt.all(characterId);

    // Get recent 5 events
    const eventsStmt = this.db.prepare(`
      SELECT kind, payload, delta_cp, created_at
      FROM event_logs
      WHERE character_id = ?
      ORDER BY created_at DESC
      LIMIT 5
    `);
    const recentEvents = eventsStmt.all(characterId).map((e: any) => ({
      ...e,
      payload: JSON.parse(e.payload)
    }));

    return {
      cp_total: character.cp_total,
      cp_spent: character.cp_spent,
      cp_available: character.cp_total - character.cp_spent,
      response_count: character.response_count,
      tier: character.tier,
      top_perks: topPerks,
      recent_events: recentEvents,
      summary_for_prompt: this.generatePromptSummary(character, topPerks, recentEvents)
    };
  }

  private generatePromptSummary(character: Character, perks: any[], events: any[]): string {
    const cpAvailable = character.cp_total - character.cp_spent;
    const perksList = perks.map(p => `${p.name} (${p.category}, ${p.cost_cp || 0} CP)`).join(', ');
    const eventsList = events.map(e => {
      if (e.kind === 'award') return `+${e.delta_cp} CP (${e.payload.reason || 'awarded'})`;
      if (e.kind === 'spend') return `-${Math.abs(e.delta_cp || 0)} CP (${e.payload.reason || 'spent'})`;
      return e.kind;
    }).join(', ');

    return `[FORGE STATE]
CP: ${character.cp_total} (Spent ${character.cp_spent}, Available ${cpAvailable}) | Tier: ${character.tier} | Responses: ${character.response_count}/10
Perks (recent): ${perksList || 'None'}
Recent: ${eventsList || 'No recent events'}`;
  }
}
