import {
  NODE_TYPE_META,
  isNodeType,
  type NodeType,
  type Relation,
  type World,
  type WorldNode,
} from './types';
import { clampZoom } from './world';

export class ElsewhereFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ElsewhereFileError';
  }
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asNodeType(value: unknown): NodeType | null {
  return typeof value === 'string' && isNodeType(value) ? value : null;
}

function clampDimension(value: unknown, fallback: number): number {
  return Math.min(2400, Math.max(80, Math.round(asFiniteNumber(value, fallback))));
}

export function serializeElsew(world: World): string {
  return JSON.stringify(
    {
      format: 'elsew',
      version: 1,
      id: world.id,
      name: world.name,
      updatedAt: world.updatedAt,
      nodes: world.nodes.map((node) => {
        const serialized: Record<string, unknown> = {
          id: node.id,
          title: node.title,
          type: node.type,
          x: Number(node.x.toFixed(4)),
          y: Number(node.y.toFixed(4)),
          description: node.description,
        };
        if (node.width !== undefined) serialized.width = node.width;
        if (node.height !== undefined) serialized.height = node.height;
        if (node.sourceId !== undefined) serialized.sourceId = node.sourceId;
        return serialized;
      }),
      relations: world.relations.map((relation) => ({
        id: relation.id,
        from: relation.from,
        to: relation.to,
        name: relation.name,
      })),
    },
    null,
    2,
  );
}

interface ParsedNodeInput {
  id: number;
  title: string;
  type: NodeType;
  x: number;
  y: number;
  description: string;
  width?: number;
  height?: number;
  sourceId?: number;
}

export function parseElsew(text: string): World {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ElsewhereFileError('This file is not valid JSON.');
  }
  if (!raw || typeof raw !== 'object') {
    throw new ElsewhereFileError('This file does not contain an Elsewhere world.');
  }
  const source = raw as Record<string, unknown>;
  if (source.format !== 'elsew') {
    throw new ElsewhereFileError('This is not a .elsew world file.');
  }
  if (source.version !== 1) {
    throw new ElsewhereFileError(
      `This world uses format version ${String(source.version)}, which this app cannot open.`,
    );
  }
  if (!Array.isArray(source.nodes) || !Array.isArray(source.relations ?? [])) {
    throw new ElsewhereFileError('This world file is missing its nodes or relations.');
  }
  if (source.nodes.length > 5000) {
    throw new ElsewhereFileError('This world is too large to import.');
  }

  const usedIds = new Set<number>();
  const nodes: ParsedNodeInput[] = [];
  const now = Date.now();

  source.nodes.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const node = entry as Record<string, unknown>;
    const type = asNodeType(node.type);
    if (!type) {
      throw new ElsewhereFileError(`Node ${index + 1} has an unknown type.`);
    }
    let id = Math.round(asFiniteNumber(node.id, now + index));
    while (usedIds.has(id)) id += 1;
    usedIds.add(id);
    const fallback = NODE_TYPE_META[type];
    const parsed: ParsedNodeInput = {
      id,
      title: truncate(asString(node.title).trim() || type, 120),
      type,
      x: Math.round(asFiniteNumber(node.x, 550)),
      y: Math.round(asFiniteNumber(node.y, 340)),
      description: truncate(asString(node.description), 20000),
    };
    if (fallback.resizable) {
      parsed.width = clampDimension(node.width, fallback.defaultWidth);
      parsed.height = clampDimension(node.height, fallback.defaultHeight);
    } else if (node.width !== undefined || node.height !== undefined) {
      parsed.width = clampDimension(node.width, fallback.defaultWidth);
      parsed.height = clampDimension(node.height, fallback.defaultHeight);
    }
    if (typeof node.sourceId === 'number' && Number.isFinite(node.sourceId)) {
      parsed.sourceId = node.sourceId;
    }
    nodes.push(parsed);
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  for (const node of nodes) {
    if (node.sourceId !== undefined && !nodeIds.has(node.sourceId)) delete node.sourceId;
  }

  const relationsSource = Array.isArray(source.relations) ? source.relations : [];
  const relations: Relation[] = [];
  const usedRelationIds = new Set<number>();
  relationsSource.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const relation = entry as Record<string, unknown>;
    const from = Math.round(asFiniteNumber(relation.from, NaN));
    const to = Math.round(asFiniteNumber(relation.to, NaN));
    if (!nodeIds.has(from) || !nodeIds.has(to) || from === to) return;
    let id = Math.round(asFiniteNumber(relation.id, now + index));
    while (usedRelationIds.has(id) || usedIds.has(id)) id += 1;
    usedRelationIds.add(id);
    relations.push({
      id,
      from,
      to,
      name: truncate(asString(relation.name).trim() || 'Relation', 80),
    });
  });

  const name = truncate(asString(source.name).trim() || 'Imported World', 80);
  const updatedAt =
    typeof source.updatedAt === 'string' && !Number.isNaN(Date.parse(source.updatedAt))
      ? new Date(source.updatedAt).toISOString()
      : new Date().toISOString();

  return {
    format: 'elsew',
    version: 1,
    id: typeof source.id === 'string' && source.id.length > 0 ? source.id : crypto.randomUUID(),
    name,
    updatedAt,
    nodes: nodes.map((node) => node as WorldNode),
    relations,
  };
}

export function importAsNewWorld(world: World, existingNames: string[]): World {
  const baseName = world.name.trim() || 'Imported World';
  let name = baseName;
  if (existingNames.some((existing) => existing.toLowerCase() === name.toLowerCase())) {
    name = `${baseName} (imported)`;
    let suffix = 2;
    while (existingNames.some((existing) => existing.toLowerCase() === name.toLowerCase())) {
      name = `${baseName} (imported ${suffix})`;
      suffix += 1;
    }
  }
  return {
    ...world,
    id: crypto.randomUUID(),
    name: name.slice(0, 80),
    updatedAt: new Date().toISOString(),
  };
}

export function clampViewScale(scale: number): number {
  return clampZoom(scale);
}
