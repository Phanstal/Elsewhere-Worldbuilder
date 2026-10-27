import type { World, WorldSummary } from './types';

export interface WorldRepository {
  list(): Promise<WorldSummary[]>;
  get(id: string): Promise<World | null>;
  save(world: World): Promise<void>;
  remove(id: string): Promise<void>;
}
