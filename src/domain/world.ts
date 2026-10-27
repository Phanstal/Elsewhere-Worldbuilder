import {
  NODE_TYPE_META,
  type NodeType,
  type Relation,
  type World,
  type WorldNode,
  type WorldSummary,
} from './types';

export const WORLD_WIDTH = 1100;
export const WORLD_HEIGHT = 680;
export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 2;

let fallbackId = 0;

function uniqueNumericId(world: World): number {
  let id = Date.now();
  const existing = new Set<number>([
    ...world.nodes.map((node) => node.id),
    ...world.relations.map((relation) => relation.id),
  ]);
  while (existing.has(id)) id += 1;
  if (!Number.isFinite(id)) {
    fallbackId += 1;
    id = Date.now() + fallbackId;
  }
  return id;
}

export function createWorld(name = 'Untitled World'): World {
  return {
    format: 'elsew',
    version: 1,
    id: crypto.randomUUID(),
    name,
    updatedAt: new Date().toISOString(),
    nodes: [],
    relations: [],
  };
}

export function touchWorld(world: World): World {
  return { ...world, updatedAt: new Date().toISOString() };
}

export function nodeVisualSize(node: WorldNode): { width: number; height: number } {
  const meta = NODE_TYPE_META[node.type];
  return {
    width: meta.resizable ? (node.width ?? meta.defaultWidth) : meta.defaultWidth,
    height: meta.resizable ? (node.height ?? meta.defaultHeight) : meta.defaultHeight,
  };
}

export function nextNodePosition(world: World): { x: number; y: number } {
  const centerX = WORLD_WIDTH / 2;
  const centerY = WORLD_HEIGHT / 2;
  const offset = world.nodes.length % 8;
  const dx = offset > 0 && offset % 2 === 0 ? (offset / 2) * 26 : 0;
  const dy = offset > 0 && offset % 2 === 1 ? ((offset + 1) / 2) * 22 : 0;
  return { x: centerX + dx, y: centerY + dy };
}

export function createNode(
  world: World,
  type: NodeType,
  position?: { x: number; y: number },
  title?: string,
): WorldNode {
  const meta = NODE_TYPE_META[type];
  const pos = position ?? nextNodePosition(world);
  return {
    id: uniqueNumericId(world),
    title: title ?? type,
    type,
    x: Math.round(pos.x),
    y: Math.round(pos.y),
    description: '',
    ...(meta.resizable ? { width: meta.defaultWidth, height: meta.defaultHeight } : {}),
  };
}

export function addNode(
  world: World,
  type: NodeType,
  position?: { x: number; y: number },
): { world: World; node: WorldNode } {
  const node = createNode(world, type, position);
  return {
    world: touchWorld({ ...world, nodes: [...world.nodes, node] }),
    node,
  };
}

export function createAlias(
  world: World,
  source: WorldNode,
  position?: { x: number; y: number },
): { world: World; node: WorldNode } {
  const node: WorldNode = {
    ...source,
    id: uniqueNumericId(world),
    x: Math.round(position?.x ?? source.x + 130),
    y: Math.round(position?.y ?? source.y + 80),
    sourceId: source.sourceId ?? source.id,
  };
  return {
    world: touchWorld({ ...world, nodes: [...world.nodes, node] }),
    node,
  };
}

export function updateNode(
  world: World,
  id: number,
  updater: (node: WorldNode) => WorldNode,
): World {
  let changed = false;
  const nodes = world.nodes.map((node) => {
    if (node.id !== id) return node;
    const next = updater(node);
    if (next !== node) changed = true;
    return next;
  });
  return changed ? touchWorld({ ...world, nodes }) : world;
}

export function removeNode(world: World, id: number): World {
  const targets = new Set<number>([id]);
  for (const node of world.nodes) {
    if (node.sourceId === id) targets.add(node.id);
  }
  return touchWorld({
    ...world,
    nodes: world.nodes.filter((node) => !targets.has(node.id)),
    relations: world.relations.filter(
      (relation) => !targets.has(relation.from) && !targets.has(relation.to),
    ),
  });
}

export function addRelation(world: World, from: number, to: number): World | null {
  if (from === to) return null;
  if (!world.nodes.some((node) => node.id === from)) return null;
  if (!world.nodes.some((node) => node.id === to)) return null;
  const exists = world.relations.some(
    (relation) =>
      (relation.from === from && relation.to === to) ||
      (relation.from === to && relation.to === from),
  );
  if (exists) return null;
  const relation: Relation = {
    id: uniqueNumericId(world),
    from,
    to,
    name: 'Relation',
  };
  return touchWorld({ ...world, relations: [...world.relations, relation] });
}

export function removeRelation(world: World, id: number): World {
  return touchWorld({
    ...world,
    relations: world.relations.filter((relation) => relation.id !== id),
  });
}

export function renameRelation(world: World, id: number, name: string): World {
  return touchWorld({
    ...world,
    relations: world.relations.map((relation) =>
      relation.id === id ? { ...relation, name } : relation,
    ),
  });
}

export function baseNodeCount(world: World): number {
  return world.nodes.filter((node) => node.sourceId === undefined).length;
}

export function aliasesOf(world: World, nodeId: number): WorldNode[] {
  return world.nodes.filter((node) => node.sourceId === nodeId);
}

export function summarize(world: World): WorldSummary {
  return {
    id: world.id,
    name: world.name,
    updatedAt: world.updatedAt,
    nodeCount: baseNodeCount(world),
  };
}

export function sortWorlds(worlds: WorldSummary[]): WorldSummary[] {
  return [...worlds].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export interface WorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export function worldBounds(world: World, padding = 0): WorldBounds {
  if (world.nodes.length === 0) {
    return {
      minX: -padding,
      minY: -padding,
      maxX: WORLD_WIDTH + padding,
      maxY: WORLD_HEIGHT + padding,
      width: WORLD_WIDTH + padding * 2,
      height: WORLD_HEIGHT + padding * 2,
    };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of world.nodes) {
    const size = nodeVisualSize(node);
    minX = Math.min(minX, node.x - size.width / 2);
    minY = Math.min(minY, node.y - size.height / 2);
    maxX = Math.max(maxX, node.x + size.width / 2);
    maxY = Math.max(maxY, node.y + size.height / 2);
  }
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

export function fitView(
  viewportWidth: number,
  viewportHeight: number,
  bounds: WorldBounds,
  maxFitScale = 1,
): ViewTransform {
  if (viewportWidth <= 0 || viewportHeight <= 0) return { x: 0, y: 0, scale: 0.9 };
  const scale = Math.max(
    MIN_ZOOM,
    Math.min(maxFitScale, viewportWidth / bounds.width, viewportHeight / bounds.height),
  );
  return {
    scale,
    x: (viewportWidth - bounds.width * scale) / 2 - bounds.minX * scale,
    y: (viewportHeight - bounds.height * scale) / 2 - bounds.minY * scale,
  };
}

export function clampZoom(scale: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

export function formatEdited(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Edited recently';
  return `Edited ${new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)}`;
}

export function formatCount(count: number, noun = 'nodes'): string {
  return `${count} ${count === 1 ? noun.slice(0, -1) : noun}`;
}

export function filenameForWorld(name: string, extension: string): string {
  const base =
    name
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .slice(0, 80) || 'Elsewhere World';
  return `${base}.${extension}`;
}
