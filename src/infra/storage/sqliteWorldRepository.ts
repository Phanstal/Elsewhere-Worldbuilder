import type { WorldRepository } from '../../domain/repository';
import type { World, WorldSummary } from '../../domain/types';
import { baseNodeCount, sortWorlds } from '../../domain/world';

interface WorldRow {
  id: string;
  name: string;
  updated_at: string;
  node_count: number;
  data: string;
}

export class SqliteWorldRepository implements WorldRepository {
  private ready: Promise<void>;

  constructor() {
    this.ready = this.initialize();
  }

  private async initialize(): Promise<void> {
    const { default: Database } = await import('@tauri-apps/plugin-sql');
    const db = await Database.load('sqlite:elsewhere.db');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS worlds (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        node_count INTEGER NOT NULL DEFAULT 0,
        data TEXT NOT NULL
      )
    `);
    this.database = db;
  }

  private database: Awaited<
    ReturnType<typeof import('@tauri-apps/plugin-sql').default.load>
  > | null = null;

  private async db() {
    await this.ready;
    if (!this.database) throw new Error('The local world library is unavailable.');
    return this.database;
  }

  async list(): Promise<WorldSummary[]> {
    const db = await this.db();
    const rows = await db.select<WorldRow[]>(
      'SELECT id, name, updated_at, node_count FROM worlds ORDER BY updated_at DESC',
    );
    return sortWorlds(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        updatedAt: row.updated_at,
        nodeCount: Number(row.node_count) || 0,
      })),
    );
  }

  async get(id: string): Promise<World | null> {
    const db = await this.db();
    const rows = await db.select<WorldRow[]>('SELECT data FROM worlds WHERE id = $1 LIMIT 1', [id]);
    const raw = rows[0]?.data;
    if (!raw) return null;
    try {
      return JSON.parse(raw) as World;
    } catch {
      return null;
    }
  }

  async save(world: World): Promise<void> {
    const db = await this.db();
    await db.execute(
      `INSERT INTO worlds (id, name, updated_at, node_count, data)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         updated_at = excluded.updated_at,
         node_count = excluded.node_count,
         data = excluded.data`,
      [world.id, world.name, world.updatedAt, baseNodeCount(world), JSON.stringify(world)],
    );
  }

  async remove(id: string): Promise<void> {
    const db = await this.db();
    await db.execute('DELETE FROM worlds WHERE id = $1', [id]);
  }
}
