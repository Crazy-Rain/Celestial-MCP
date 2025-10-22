import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { UnlockedPerk, PerkCatalog } from './database.js';

export class PerkOperations {
  constructor(private db: Database.Database) {}

  addPerk(
    characterId: string,
    name: string,
    category: string,
    source: string,
    costCp?: number,
    description?: string,
    perkId?: string
  ): UnlockedPerk {
    const id = randomUUID();
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO unlocked_perks (id, character_id, perk_id, name, category, source, cost_cp, description, acquired_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, characterId, perkId || null, name, category, source, costCp || null, description || null, now);
    
    return this.getPerk(id)!;
  }

  getPerk(perkId: string): UnlockedPerk | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM unlocked_perks WHERE id = ?
    `);
    
    return stmt.get(perkId) as UnlockedPerk | undefined;
  }

  listPerks(
    characterId: string,
    options: {
      q?: string;
      category?: string;
      limit?: number;
    } = {}
  ): UnlockedPerk[] {
    let query = `SELECT * FROM unlocked_perks WHERE character_id = ?`;
    const params: any[] = [characterId];
    
    if (options.category) {
      query += ` AND category = ?`;
      params.push(options.category);
    }
    
    if (options.q) {
      query += ` AND (name LIKE ? OR description LIKE ?)`;
      params.push(`%${options.q}%`, `%${options.q}%`);
    }
    
    query += ` ORDER BY acquired_at DESC`;
    
    if (options.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }
    
    const stmt = this.db.prepare(query);
    return stmt.all(...params) as UnlockedPerk[];
  }

  removePerk(perkId: string, characterId: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM unlocked_perks WHERE id = ? AND character_id = ?`);
    const result = stmt.run(perkId, characterId);
    return result.changes > 0;
  }

  // Catalog operations
  loadCatalog(perks: any[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO perk_catalog (id, name, category, source, cost_cp, description, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(name, source) DO UPDATE SET
        category = excluded.category,
        cost_cp = excluded.cost_cp,
        description = excluded.description,
        tags = excluded.tags
    `);
    
    const insertMany = this.db.transaction((perks: any[]) => {
      for (const perk of perks) {
        const id = randomUUID();
        stmt.run(
          id,
          perk.name,
          perk.category || 'Uncategorized',
          perk.origin || 'Unknown',
          perk.cost || 0,
          perk.description || '',
          JSON.stringify([])
        );
      }
    });
    
    insertMany(perks);
  }

  searchCatalog(
    options: {
      q?: string;
      category?: string;
      limit?: number;
    } = {}
  ): PerkCatalog[] {
    let query = `SELECT * FROM perk_catalog WHERE 1=1`;
    const params: any[] = [];
    
    if (options.category) {
      query += ` AND category = ?`;
      params.push(options.category);
    }
    
    if (options.q) {
      query += ` AND (name LIKE ? OR description LIKE ?)`;
      params.push(`%${options.q}%`, `%${options.q}%`);
    }
    
    query += ` ORDER BY cost_cp ASC`;
    
    if (options.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }
    
    const stmt = this.db.prepare(query);
    return stmt.all(...params) as PerkCatalog[];
  }

  getCatalogCategories(): string[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT category FROM perk_catalog ORDER BY category
    `);
    
    return stmt.all().map((row: any) => row.category);
  }
}
