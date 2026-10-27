import { describe, expect, it } from 'vitest';
import {
  ElsewhereFileError,
  importAsNewWorld,
  parseElsew,
  serializeElsew,
} from '../../src/domain/elsew';
import { addNode, createAlias, createWorld } from '../../src/domain/world';

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
