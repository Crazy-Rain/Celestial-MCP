import Database from 'better-sqlite3';

export interface Character {
  id: string;
  name: string;
  world: string;
  cp_total: number;
  cp_spent: number;
  response_count: number;
  tier: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface UnlockedPerk {
  id: string;
  character_id: string;
  perk_id: string | null;
  name: string;
  category: string;
  source: string;
  cost_cp: number | null;
  description: string | null;
  acquired_at: string;
  tags: string; // JSON string
}

export interface PerkCatalog {
  id: string;
  name: string;
  category: string;
  source: string;
  cost_cp: number;
  description: string;
  tags: string; // JSON string
}

export interface EventLog {
  id: string;
  character_id: string;
  kind: string;
  payload: string; // JSON string
  delta_cp: number | null;
  created_at: string;
}

export class ForgeDatabase {
  private db: Database.Database;

  constructor(dbPath: string = 'forge.db') {
    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS characters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        world TEXT NOT NULL DEFAULT '',
        cp_total INTEGER NOT NULL DEFAULT 0,
        cp_spent INTEGER NOT NULL DEFAULT 0,
        response_count INTEGER NOT NULL DEFAULT 0,
        tier TEXT NOT NULL DEFAULT 'Spark Initiate',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS unlocked_perks (
        id TEXT PRIMARY KEY,
        character_id TEXT NOT NULL,
        perk_id TEXT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        source TEXT NOT NULL,
        cost_cp INTEGER,
        description TEXT,
        acquired_at TEXT NOT NULL DEFAULT (datetime('now')),
        tags TEXT NOT NULL DEFAULT '[]',
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS perk_catalog (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        source TEXT NOT NULL,
        cost_cp INTEGER NOT NULL DEFAULT 0,
        description TEXT NOT NULL DEFAULT '',
        tags TEXT NOT NULL DEFAULT '[]',
        UNIQUE(name, source)
      );

      CREATE TABLE IF NOT EXISTS event_logs (
        id TEXT PRIMARY KEY,
        character_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        payload TEXT NOT NULL DEFAULT '{}',
        delta_cp INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_unlocked_perks_character ON unlocked_perks(character_id);
      CREATE INDEX IF NOT EXISTS idx_event_logs_character ON event_logs(character_id);
      CREATE INDEX IF NOT EXISTS idx_perk_catalog_category ON perk_catalog(category);
    `);
  }

  getDatabase(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}
