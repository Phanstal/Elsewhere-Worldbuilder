import {
  ELEMENT_ICONS,
  NODE_TYPE_META,
  isNodeType,
  type ElementIcon,
  type NodeType,
  type Relation,
  type World,
  type WorldNode,
  type WorldSnapshot,
} from './types';
import { MAX_SNAPSHOTS, clampZoom, syncActiveSnapshot } from './world';

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

function asElementIcon(value: unknown): ElementIcon | undefined {
  return typeof value === 'string' && (ELEMENT_ICONS as readonly string[]).includes(value)
    ? (value as ElementIcon)
    : undefined;
}

function asTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const tags = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim().replace(/^#/, '').slice(0, 30))
    .filter(Boolean)
    .slice(0, 12);
  return tags.length > 0 ? tags : undefined;
}

function asImageSource(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith('data:image/')) return undefined;
  if (value.length > 6_000_000) return undefined;
  return value;
}

function asBackgroundColor(value: unknown): string | undefined {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;
}

function serializeNode(node: WorldNode): Record<string, unknown> {
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
  if (node.icon !== undefined) serialized.icon = node.icon;
  if (node.parentId !== undefined) serialized.parentId = node.parentId;
  if (node.layer !== undefined) serialized.layer = node.layer;
  if (node.backgroundColor !== undefined) serialized.backgroundColor = node.backgroundColor;
  if (node.tags !== undefined && node.tags.length > 0) serialized.tags = node.tags;
  if (node.imageSrc !== undefined) serialized.imageSrc = node.imageSrc;
  return serialized;
}

function serializeRelations(relations: Relation[]): Record<string, unknown>[] {
  return relations.map((relation) => ({
    id: relation.id,
    from: relation.from,
    to: relation.to,
    name: relation.name,
  }));
}

export function serializeElsew(source: World): string {
  const world = syncActiveSnapshot(source);
  const snapshots = world.snapshots ?? [];
  return JSON.stringify(
    {
      format: 'elsew',
      version: 1,
      id: world.id,
      name: world.name,
      updatedAt: world.updatedAt,
      activeSnapshotId: world.activeSnapshotId,
      nodes: world.nodes.map(serializeNode),
      relations: serializeRelations(world.relations),
      snapshots: snapshots.map((snapshot) => ({
        id: snapshot.id,
        label: snapshot.label,
        nodes: snapshot.nodes.map(serializeNode),
        relations: serializeRelations(snapshot.relations),
      })),
    },
    null,
    2,
  );
}

interface ParsedGraph {
  nodes: WorldNode[];
  relations: Relation[];
  nodeIds: Set<number>;
}

function parseGraph(source: Record<string, unknown>, now: number, startIndex = 0): ParsedGraph {
  if (!Array.isArray(source.nodes) || !Array.isArray(source.relations ?? [])) {
    throw new ElsewhereFileError('This world file is missing its nodes or relations.');
  }
  if (source.nodes.length > 5000) {
    throw new ElsewhereFileError('This world is too large to import.');
  }

  const usedIds = new Set<number>();
  const nodes: WorldNode[] = [];

  source.nodes.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const node = entry as Record<string, unknown>;
    const type = asNodeType(node.type);
    if (!type) {
      throw new ElsewhereFileError(`Node ${startIndex + index + 1} has an unknown type.`);
    }
    let id = Math.round(asFiniteNumber(node.id, now + index));
    while (usedIds.has(id)) id += 1;
    usedIds.add(id);
    const fallback = NODE_TYPE_META[type];
    const parsed: WorldNode = {
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
      parsed.sourceId = Math.round(node.sourceId);
    }
    const icon = asElementIcon(node.icon);
    if (icon) parsed.icon = icon;
    const tags = asTags(node.tags);
    if (tags) parsed.tags = tags;
    const imageSrc = asImageSource(node.imageSrc);
    if (imageSrc) parsed.imageSrc = imageSrc;
    const backgroundColor = asBackgroundColor(node.backgroundColor);
    if (backgroundColor) parsed.backgroundColor = backgroundColor;
    if (typeof node.parentId === 'number' && Number.isFinite(node.parentId)) {
      parsed.parentId = Math.round(node.parentId);
    }
    if (typeof node.layer === 'number' && Number.isFinite(node.layer)) {
      parsed.layer = Math.min(100_000, Math.max(-100_000, Math.round(node.layer)));
    }
    nodes.push(parsed);
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  for (const node of nodes) {
    if (node.sourceId !== undefined && !nodeIds.has(node.sourceId)) delete node.sourceId;
    if (node.parentId !== undefined && !nodeIds.has(node.parentId)) delete node.parentId;
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
    let id = Math.round(asFiniteNumber(relation.id, now + startIndex + index));
    while (usedRelationIds.has(id) || usedIds.has(id)) id += 1;
    usedRelationIds.add(id);
    relations.push({
      id,
      from,
      to,
      name: truncate(asString(relation.name).trim() || 'Relation', 80),
    });
  });

  return { nodes, relations, nodeIds };
}

function parseSnapshots(
  source: Record<string, unknown>,
  topLevel: ParsedGraph,
  now: number,
): WorldSnapshot[] {
  if (!Array.isArray(source.snapshots)) {
    return [
      {
        id: crypto.randomUUID(),
        label: 'Origin',
        nodes: structuredClone(topLevel.nodes),
        relations: structuredClone(topLevel.relations),
      },
    ];
  }

  const snapshots: WorldSnapshot[] = [];
  source.snapshots.slice(0, MAX_SNAPSHOTS).forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const snapshot = entry as Record<string, unknown>;
    const graph = parseGraph(snapshot, now, index * 10000);
    const label = truncate(asString(snapshot.label).trim(), 40);
    snapshots.push({
      id:
        typeof snapshot.id === 'string' && snapshot.id.length > 0
          ? snapshot.id
          : crypto.randomUUID(),
      label: label || (index === 0 ? 'Origin' : `Time ${index + 1}`),
      nodes: graph.nodes,
      relations: graph.relations,
    });
  });

  if (snapshots.length === 0) {
    snapshots.push({
      id: crypto.randomUUID(),
      label: 'Origin',
      nodes: structuredClone(topLevel.nodes),
      relations: structuredClone(topLevel.relations),
    });
  }
  return snapshots;
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

  const now = Date.now();
  const graph = parseGraph(source, now);
  const snapshots = parseSnapshots(source, graph, now);
  const name = truncate(asString(source.name).trim() || 'Imported World', 80);
  const updatedAt =
    typeof source.updatedAt === 'string' && !Number.isNaN(Date.parse(source.updatedAt))
      ? new Date(source.updatedAt).toISOString()
      : new Date().toISOString();
  const activeSnapshotId =
    typeof source.activeSnapshotId === 'string' &&
    snapshots.some((snapshot) => snapshot.id === source.activeSnapshotId)
      ? source.activeSnapshotId
      : snapshots[0].id;
  const activeSnapshot = snapshots.find((snapshot) => snapshot.id === activeSnapshotId)!;

  return {
    format: 'elsew',
    version: 1,
    id: typeof source.id === 'string' && source.id.length > 0 ? source.id : crypto.randomUUID(),
    name,
    updatedAt,
    nodes: activeSnapshot.nodes,
    relations: activeSnapshot.relations,
    snapshots,
    activeSnapshotId,
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
