import type { WorldRepository } from '../../domain/repository';
import { isTauri } from '../../platform/tauri';
import { LocalWorldRepository } from './localWorldRepository';

export async function createWorldRepository(): Promise<WorldRepository> {
  if (isTauri()) {
    try {
      const { SqliteWorldRepository } = await import('./sqliteWorldRepository');
      return new SqliteWorldRepository();
    } catch (error) {
      console.error('Falling back to browser storage', error);
    }
  }
  return new LocalWorldRepository();
}
