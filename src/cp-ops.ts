import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { EventLog } from './database.js';
import * as fs from 'fs';

interface Config {
  spark_cycle_size: number;
  cp_award_per_cycle: number;
  tiers: Array<{ name: string; min_cp: number }>;
}

export class CPOperations {
  private config: Config;

  constructor(private db: Database.Database, configPath: string = 'config.json') {
    this.config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  awardCP(characterId: string, amount: number, reason: string): EventLog {
    const character = this.getCharacter(characterId);
    if (!character) {
      throw new Error(`Character ${characterId} not found`);
    }

    const newTotal = character.cp_total + amount;
    this.updateCharacterCP(characterId, newTotal, character.cp_spent);
    this.updateTier(characterId);

    return this.logEvent(characterId, 'award', { reason }, amount);
  }

  spendCP(characterId: string, amount: number, reason: string): EventLog {
    const character = this.getCharacter(characterId);
    if (!character) {
      throw new Error(`Character ${characterId} not found`);
    }

    const available = character.cp_total - character.cp_spent;
    if (available < amount) {
      throw new Error(`Insufficient CP. Available: ${available}, Requested: ${amount}`);
    }

    const newSpent = character.cp_spent + amount;
    this.updateCharacterCP(characterId, character.cp_total, newSpent);
    this.updateTier(characterId);

    return this.logEvent(characterId, 'spend', { reason }, -amount);
  }

  tickResponse(characterId: string): {
    response_count: number;
    cp_awarded: number;
    cycle_complete: boolean;
  } {
    const character = this.getCharacter(characterId);
    if (!character) {
      throw new Error(`Character ${characterId} not found`);
    }

    const newCount = (character.response_count + 1) % this.config.spark_cycle_size;
    const cycleComplete = newCount === 0;
    let cpAwarded = 0;

    if (cycleComplete) {
      // Award CP for completing the cycle
      cpAwarded = this.config.cp_award_per_cycle;
      const newTotal = character.cp_total + cpAwarded;
      this.updateCharacterCP(characterId, newTotal, character.cp_spent);
      this.logEvent(characterId, 'award', { reason: 'Spark cycle complete' }, cpAwarded);
    }

    // Update response count
    const stmt = this.db.prepare(`
      UPDATE characters SET response_count = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(newCount, new Date().toISOString(), characterId);

    // Update tier if needed
    if (cycleComplete) {
      this.updateTier(characterId);
    }

    return {
      response_count: newCount,
      cp_awarded: cpAwarded,
      cycle_complete: cycleComplete
    };
  }

  setTier(characterId: string, tier: string): void {
    const stmt = this.db.prepare(`
      UPDATE characters SET tier = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(tier, new Date().toISOString(), characterId);
  }

  private updateTier(characterId: string): void {
    const character = this.getCharacter(characterId);
    if (!character) return;

    const tier = this.calculateTier(character.cp_total);
    if (tier !== character.tier) {
      this.setTier(characterId, tier);
      this.logEvent(characterId, 'note', { message: `Advanced to tier: ${tier}` }, null);
    }
  }

  private calculateTier(cpTotal: number): string {
    let tier = this.config.tiers[0].name;
    for (const t of this.config.tiers) {
      if (cpTotal >= t.min_cp) {
        tier = t.name;
      }
    }
    return tier;
  }

  private logEvent(
    characterId: string,
    kind: string,
    payload: any,
    deltaCp: number | null
  ): EventLog {
    const id = randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO event_logs (id, character_id, kind, payload, delta_cp, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, characterId, kind, JSON.stringify(payload), deltaCp, now);

    return {
      id,
      character_id: characterId,
      kind,
      payload: JSON.stringify(payload),
      delta_cp: deltaCp,
      created_at: now
    };
  }

  private getCharacter(characterId: string): any {
    const stmt = this.db.prepare(`SELECT * FROM characters WHERE id = ?`);
    return stmt.get(characterId);
  }

  private updateCharacterCP(characterId: string, cpTotal: number, cpSpent: number): void {
    const stmt = this.db.prepare(`
      UPDATE characters SET cp_total = ?, cp_spent = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(cpTotal, cpSpent, new Date().toISOString(), characterId);
  }

  getEventLogs(characterId: string, limit: number = 50): EventLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM event_logs WHERE character_id = ? ORDER BY created_at DESC LIMIT ?
    `);
    return stmt.all(characterId, limit) as EventLog[];
  }
}
