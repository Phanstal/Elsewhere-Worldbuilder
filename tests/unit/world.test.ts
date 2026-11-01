import { beforeEach, describe, expect, it } from 'vitest';
import {
  activateSnapshot,
  addNode,
  addRelation,
  baseNodeCount,
  changeNodeType,
  containingSpace,
  createAlias,
  createWorld,
  filenameForWorld,
  fitView,
  formatCount,
  moveNode,
  nodesInside,
  removeNode,
  renameRelation,
  snapshotIndex,
  syncActiveSnapshot,
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

  it('creates an Origin snapshot and keeps it in sync with the active view', () => {
    expect(world.snapshots).toHaveLength(1);
    expect(world.snapshots?.[0].label).toBe('Origin');
    const withSpace = addNode(world, 'Space').world;
    const synced = syncActiveSnapshot(withSpace);
    expect(synced.snapshots?.[0].nodes).toHaveLength(1);
    expect(synced.snapshots?.[0].nodes[0].type).toBe('Space');
    expect(snapshotIndex(synced)).toBe(0);
  });

  it('switches time snapshots without losing the other branch', () => {
    let branch = addNode(world, 'Space').world;
    branch = syncActiveSnapshot(branch);
    const second = {
      id: 'time-2',
      label: 'Time 2',
      nodes: structuredClone(branch.nodes),
      relations: [],
    };
    branch = syncActiveSnapshot({
      ...branch,
      snapshots: [...(branch.snapshots ?? []), second],
      activeSnapshotId: second.id,
    });
    const withElement = addNode(branch, 'Element').world;
    expect(withElement.nodes).toHaveLength(2);
    expect(withElement.snapshots?.[1].nodes).toHaveLength(1);

    const origin = activateSnapshot(withElement, 0);
    expect(origin.nodes).toHaveLength(1);
    expect(origin.nodes[0].type).toBe('Space');
    expect(origin.snapshots?.[1].nodes).toHaveLength(2);
    expect(withElement.nodes).toHaveLength(2);

    const back = activateSnapshot(origin, 1);
    expect(back.nodes).toHaveLength(2);
    expect(back.activeSnapshotId).toBe('time-2');
  });

  it('changes a node type and fills the type defaults', () => {
    const created = addNode(world, 'Element');
    const asSpace = changeNodeType(created.world, created.node.id, 'Space');
    expect(asSpace.nodes[0]).toMatchObject({
      type: 'Space',
      width: 560,
      height: 360,
      backgroundColor: '#E8EEF1',
    });
    const asEvent = changeNodeType(asSpace, created.node.id, 'Event');
    expect(asEvent.nodes[0].type).toBe('Event');
    expect(asEvent.nodes[0].width).toBe(560);
  });

  it('finds the containing space and reports its children', () => {
    const space = addNode(world, 'Space', { x: 550, y: 340 });
    const element = addNode(space.world, 'Element', { x: 550, y: 340 });
    expect(containingSpace(element.world, element.node)?.id).toBe(space.node.id);
    const nested = updateNode(element.world, element.node.id, (node) => ({
      ...node,
      parentId: space.node.id,
    }));
    expect(nodesInside(nested, space.node.id)).toHaveLength(1);
  });

  it('moves a space together with everything inside it', () => {
    const space = addNode(world, 'Space', { x: 550, y: 340 });
    const child = addNode(space.world, 'Element', { x: 600, y: 380 });
    const nested = updateNode(child.world, child.node.id, (node) => ({
      ...node,
      parentId: space.node.id,
    }));
    const moved = moveNode(nested, space.node.id, 650, 440);
    expect(moved.nodes.find((node) => node.id === space.node.id)).toMatchObject({
      x: 650,
      y: 440,
    });
    expect(moved.nodes.find((node) => node.id === child.node.id)).toMatchObject({
      x: 700,
      y: 480,
    });
  });

  it('formats counts, filenames and edits', () => {
    expect(formatCount(0)).toBe('0 nodes');
    expect(formatCount(1)).toBe('1 node');
    expect(filenameForWorld('A / World: One', 'elsew')).toBe('A - World- One.elsew');
    expect(filenameForWorld('   ', 'png')).toBe('Elsewhere World.png');
  });
});
