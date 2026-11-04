import { describe, expect, it } from 'vitest';
import {
  ElsewhereFileError,
  importAsNewWorld,
  parseElsew,
  serializeElsew,
} from '../../src/domain/elsew';
import {
  addNode,
  createAlias,
  createWorld,
  syncActiveSnapshot,
  updateNode,
} from '../../src/domain/world';

function prototypeFile() {
  return JSON.stringify({
    format: 'elsew',
    version: 1,
    id: '11111111-1111-4111-8111-111111111111',
    name: 'The Hollow Reach',
    updatedAt: '2026-01-02T03:04:05.000Z',
    nodes: [
      {
        id: 1793081363425,
        title: 'The Hollow Reach',
        type: 'Character',
        x: 555.5555555555555,
        y: 467.77777777777777,
        description: 'A quiet frontier.',
        width: 560,
        height: 360,
      },
      {
        id: 1793081870084,
        title: 'The Hollow Reach',
        type: 'Character',
        x: 685.5555555555555,
        y: 547.7777777777778,
        description: 'A quiet frontier.',
        width: 560,
        height: 360,
        sourceId: 1793081363425,
      },
    ],
    relations: [
      {
        id: 1793081916153,
        from: 1793081870084,
        to: 1793081363425,
        name: 'Relation',
      },
    ],
  });
}

describe('elsew file format', () => {
  it('round-trips a world through serialization', () => {
    const world = createWorld('Round Trip');
    const added = addNode(world, 'Character');
    const next = createAlias(added.world, added.node, { x: 100, y: 200 });
    const text = serializeElsew(next.world);
    const parsed = parseElsew(text);
    expect(parsed.name).toBe('Round Trip');
    expect(parsed.nodes).toHaveLength(2);
    expect(parsed.nodes[1].sourceId).toBe(added.node.id);
    expect(serializeElsew(parsed)).toContain('"format": "elsew"');
  });

  it('round-trips v2 nodes, tags, parents and time snapshots', () => {
    let world = addNode(createWorld('Many Times'), 'Space', { x: 500, y: 340 }).world;
    const spaceId = world.nodes[0].id;
    world = updateNode(world, spaceId, (node) => ({
      ...node,
      backgroundColor: '#e6edf0',
      description: 'A valley at the edge of the map.',
    }));
    const element = addNode(world, 'Element', { x: 480, y: 320 });
    world = updateNode(element.world, element.node.id, (node) => ({
      ...node,
      icon: 'faction',
      parentId: spaceId,
      layer: 7,
      tags: ['old-roads', 'keepers'],
    }));
    world = syncActiveSnapshot(world);
    const origin = world.snapshots![0];
    world = {
      ...world,
      snapshots: [
        origin,
        {
          id: 'time-2',
          label: 'Later',
          nodes: structuredClone(world.nodes),
          relations: [],
        },
      ],
      activeSnapshotId: 'time-2',
    };
    world = syncActiveSnapshot(world);

    const parsed = parseElsew(serializeElsew(world));
    expect(parsed.nodes).toHaveLength(2);
    expect(parsed.nodes[0]).toMatchObject({
      type: 'Space',
      backgroundColor: '#e6edf0',
    });
    expect(parsed.nodes[1]).toMatchObject({
      type: 'Element',
      icon: 'faction',
      parentId: spaceId,
      layer: 7,
      tags: ['old-roads', 'keepers'],
    });
    expect(parsed.activeSnapshotId).toBe('time-2');
    expect(parsed.snapshots?.map((snapshot) => snapshot.label)).toEqual(['Origin', 'Later']);
    expect(parsed.snapshots?.[1].nodes).toHaveLength(2);
  });

  it('gives legacy files an Origin snapshot on import', () => {
    const parsed = parseElsew(prototypeFile());
    expect(parsed.snapshots).toHaveLength(1);
    expect(parsed.snapshots?.[0].label).toBe('Origin');
    expect(parsed.snapshots?.[0].nodes).toHaveLength(2);
    expect(parsed.activeSnapshotId).toBe(parsed.snapshots?.[0].id);
  });

  it('reads the prototype file, including aliases and relations', () => {
    const world = parseElsew(prototypeFile());
    expect(world.name).toBe('The Hollow Reach');
    expect(world.nodes).toHaveLength(2);
    expect(world.nodes[0].x).toBe(556);
    expect(world.nodes[1].sourceId).toBe(1793081363425);
    expect(world.relations).toEqual([
      { id: 1793081916153, from: 1793081870084, to: 1793081363425, name: 'Relation' },
    ]);
  });

  it('fills defaults and drops invalid relations and aliases', () => {
    const world = parseElsew(
      JSON.stringify({
        format: 'elsew',
        version: 1,
        nodes: [
          { id: 1, type: 'Place' },
          { id: 2, type: 'Character', sourceId: 99 },
        ],
        relations: [
          { id: 9, from: 1, to: 42 },
          { id: 10, from: 1, to: 2, name: '' },
        ],
      }),
    );
    expect(world.name).toBe('Imported World');
    expect(world.nodes[0]).toMatchObject({ title: 'Place', x: 550, y: 340 });
    expect(world.nodes[1].sourceId).toBeUndefined();
    expect(world.relations).toHaveLength(1);
    expect(world.relations[0].name).toBe('Relation');
  });

  it('rejects malformed or unsupported files with clear errors', () => {
    expect(() => parseElsew('nope')).toThrow(ElsewhereFileError);
    expect(() => parseElsew('{"format":"other"}')).toThrow('not a .elsew');
    expect(() => parseElsew('{"format":"elsew","version":2}')).toThrow('format version 2');
    expect(() => parseElsew('{"format":"elsew","version":1,"nodes":{}}')).toThrow('missing');
    expect(() => parseElsew('{"format":"elsew","version":1,"nodes":[{"type":"Unknown"}]}')).toThrow(
      'unknown type',
    );
  });

  it('renames imported worlds when the name is already used', () => {
    const parsed = parseElsew(prototypeFile());
    const renamed = importAsNewWorld(parsed, ['The Hollow Reach']);
    expect(renamed.name).toBe('The Hollow Reach (imported)');
    expect(renamed.id).not.toBe(parsed.id);
    expect(renamed.nodes).toHaveLength(2);
  });
});
