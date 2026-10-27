import type { WorldRepository } from '../../domain/repository';
import type { World, WorldSummary } from '../../domain/types';
import { baseNodeCount, sortWorlds } from '../../domain/world';

const STORAGE_KEY = 'elsewhere.worlds.v1';

function read(): World[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (world): world is World =>
        Boolean(world) &&
        typeof world === 'object' &&
        world.format === 'elsew' &&
        Array.isArray(world.nodes) &&
        Array.isArray(world.relations),
    );
  } catch {
    return [];
  }
}

function write(worlds: World[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(worlds));
}

export class LocalWorldRepository implements WorldRepository {
  async list(): Promise<WorldSummary[]> {
    return sortWorlds(
      read().map((world) => ({
        id: world.id,
        name: world.name,
        updatedAt: world.updatedAt,
        nodeCount: baseNodeCount(world),
      })),
    );
  }

  async get(id: string): Promise<World | null> {
    return read().find((world) => world.id === id) ?? null;
  }

  async save(world: World): Promise<void> {
    const worlds = read();
    const index = worlds.findIndex((entry) => entry.id === world.id);
    if (index === -1) worlds.push(world);
    else worlds[index] = world;
    write(worlds);
  }

  async remove(id: string): Promise<void> {
    write(read().filter((world) => world.id !== id));
  }
}
