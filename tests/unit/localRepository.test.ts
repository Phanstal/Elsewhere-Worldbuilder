import { beforeEach, describe, expect, it } from 'vitest';
import { LocalWorldRepository } from '../../src/infra/storage/localWorldRepository';
import { addNode, createWorld } from '../../src/domain/world';

describe('local world repository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves, lists, loads and removes worlds', async () => {
    const repository = new LocalWorldRepository();
    const world = addNode(createWorld('Stored World'), 'Place').world;
    await repository.save(world);

    const list = await repository.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: world.id, name: 'Stored World', nodeCount: 1 });

    const loaded = await repository.get(world.id);
    expect(loaded?.name).toBe('Stored World');
    expect(loaded?.nodes).toHaveLength(1);

    await repository.remove(world.id);
    expect(await repository.list()).toEqual([]);
    expect(await repository.get(world.id)).toBeNull();
  });

  it('returns null for an unknown world', async () => {
    const repository = new LocalWorldRepository();
    expect(await repository.get('missing')).toBeNull();
  });
});
