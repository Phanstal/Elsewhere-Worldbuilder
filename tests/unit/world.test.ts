import { beforeEach, describe, expect, it } from 'vitest';
import {
  addNode,
  addRelation,
  baseNodeCount,
  createAlias,
  createWorld,
  filenameForWorld,
  fitView,
  formatCount,
  removeNode,
  renameRelation,
  updateNode,
  worldBounds,
} from '../../src/domain/world';
import { NODE_TYPE_META } from '../../src/domain/types';

describe('world model', () => {
  let world = createWorld('Test World');

  beforeEach(() => {
    world = createWorld('Test World');
  });

  it('creates an empty world in the elsew format', () => {
    expect(world).toMatchObject({ format: 'elsew', version: 1, name: 'Test World' });
    expect(world.nodes).toEqual([]);
    expect(world.relations).toEqual([]);
    expect(world.id).toMatch(/[0-9a-f-]{36}/);
  });

  it('adds a node at the centre and uses type defaults', () => {
    const result = addNode(world, 'Character');
    expect(result.node).toMatchObject({ title: 'Character', type: 'Character', x: 550, y: 340 });
    expect(baseNodeCount(result.world)).toBe(1);
    const place = addNode(world, 'Place');
    expect(place.node.width).toBe(NODE_TYPE_META.Place.defaultWidth);
    expect(place.node.height).toBe(NODE_TYPE_META.Place.defaultHeight);
  });

  it('updates a node without mutating the previous world', () => {
    const { world: withNode, node } = addNode(world, 'Character');
    const next = updateNode(withNode, node.id, (entry) => ({
      ...entry,
      title: 'Mira',
      description: 'A cartographer.',
    }));
    expect(next.nodes[0]).toMatchObject({ title: 'Mira', description: 'A cartographer.' });
    expect(withNode.nodes[0].title).toBe('Character');
    expect(world.nodes).toHaveLength(0);
  });

  it('creates aliases that point at the original node', () => {
    const { world: withNode, node } = addNode(world, 'Character');
    const result = createAlias(withNode, node);
    expect(result.node.sourceId).toBe(node.id);
    expect(result.node).toMatchObject({ title: node.title, type: node.type });
    expect(result.node.x).toBe(node.x + 130);
    expect(result.node.y).toBe(node.y + 80);
    expect(baseNodeCount(result.world)).toBe(1);
  });

  it('removes a node, its aliases and attached relations', () => {
    const first = addNode(world, 'Character');
    const second = addNode(first.world, 'Faction');
    const sourced = addRelation(second.world, first.node.id, second.node.id);
    expect(sourced).not.toBeNull();
    const alias = createAlias(sourced!, first.node);
    const pruned = removeNode(alias.world, first.node.id);
    expect(pruned.nodes).toHaveLength(1);
    expect(pruned.nodes[0].id).toBe(second.node.id);
    expect(pruned.relations).toHaveLength(0);
  });

  it('rejects duplicate or self relations', () => {
    const first = addNode(world, 'Character');
    const second = addNode(first.world, 'Faction');
    expect(addRelation(second.world, first.node.id, first.node.id)).toBeNull();
    const linked = addRelation(second.world, first.node.id, second.node.id);
    expect(linked).not.toBeNull();
    expect(addRelation(linked!, second.node.id, first.node.id)).toBeNull();
    expect(addRelation(linked!, first.node.id, 999999)).toBeNull();
  });

  it('renames and removes relations', () => {
    const first = addNode(world, 'Character');
    const second = addNode(first.world, 'Faction');
    const linked = addRelation(second.world, first.node.id, second.node.id)!;
    const relation = linked.relations[0];
    const renamed = renameRelation(linked, relation.id, 'Founded');
    expect(renamed.relations[0].name).toBe('Founded');
  });

  it('calculates padded bounds and a fitted view', () => {
    const result = addNode(world, 'Character', { x: 400, y: 300 });
    const bounds = worldBounds(result.world, 72);
    expect(bounds.width).toBe(104 + 144);
    expect(bounds.height).toBe(104 + 144);
    const view = fitView(200, 150, bounds);
    expect(view.scale).toBeGreaterThan(0);
    expect(view.x).toBeLessThan(0);
  });

  it('formats counts, filenames and edits', () => {
    expect(formatCount(0)).toBe('0 nodes');
    expect(formatCount(1)).toBe('1 node');
    expect(filenameForWorld('A / World: One', 'elsew')).toBe('A - World- One.elsew');
    expect(filenameForWorld('   ', 'png')).toBe('Elsewhere World.png');
  });
});
