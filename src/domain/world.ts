import {
  NODE_TYPE_META,
  type NodeType,
  type Relation,
  type World,
  type WorldNode,
  type WorldSnapshot,
  type WorldSummary,
} from './types';

export const WORLD_WIDTH = 1100;
export const WORLD_HEIGHT = 680;
export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 2;
export const MAX_SNAPSHOTS = 3;

let fallbackId = 0;

function uniqueNumericId(world: World): number {
  let id = Date.now();
  const snapshotNodes = (world.snapshots ?? []).flatMap((snapshot) => snapshot.nodes);
  const snapshotRelations = (world.snapshots ?? []).flatMap((snapshot) => snapshot.relations);
  const existing = new Set<number>([
    ...world.nodes.map((node) => node.id),
    ...world.relations.map((relation) => relation.id),
    ...snapshotNodes.map((node) => node.id),
    ...snapshotRelations.map((relation) => relation.id),
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
    snapshots: [
      {
        id: crypto.randomUUID(),
        label: 'Origin',
        nodes: [],
        relations: [],
      },
    ],
  };
}

export function snapshotIndex(world: World): number {
  const snapshots = world.snapshots ?? [];
  if (snapshots.length === 0) return 0;
  const index = snapshots.findIndex((snapshot) => snapshot.id === world.activeSnapshotId);
  return index === -1 ? 0 : index;
}

export function normalizeWorldSnapshots(world: World): World {
  const source = Array.isArray(world.snapshots) ? world.snapshots : [];
  const snapshots: WorldSnapshot[] =
    source.length > 0
      ? source.slice(0, MAX_SNAPSHOTS).map((snapshot, index) => ({
          id:
            typeof snapshot?.id === 'string' && snapshot.id.length > 0
              ? snapshot.id
              : crypto.randomUUID(),
          label:
            typeof snapshot?.label === 'string' && snapshot.label.trim().length > 0
              ? snapshot.label.slice(0, 40)
              : index === 0
                ? 'Origin'
                : `Time ${index + 1}`,
          nodes: Array.isArray(snapshot?.nodes) ? snapshot.nodes : [],
          relations: Array.isArray(snapshot?.relations) ? snapshot.relations : [],
        }))
      : [
          {
            id: crypto.randomUUID(),
            label: 'Origin',
            nodes: world.nodes,
            relations: world.relations,
          },
        ];

  const index = Math.max(
    0,
    snapshots.findIndex((snapshot) => snapshot.id === world.activeSnapshotId),
  );
  snapshots[index] = {
    ...snapshots[index],
    nodes: world.nodes,
    relations: world.relations,
  };
  return {
    ...world,
    snapshots,
    activeSnapshotId: snapshots[index].id,
  };
}

export function syncActiveSnapshot(world: World, index = snapshotIndex(world)): World {
  const normalized = normalizeWorldSnapshots(world);
  const snapshots = (normalized.snapshots ?? []).map((snapshot, entryIndex) =>
    entryIndex === index
      ? { ...snapshot, nodes: world.nodes, relations: world.relations }
      : snapshot,
  );
  return {
    ...world,
    snapshots,
    activeSnapshotId: snapshots[index]?.id ?? world.activeSnapshotId,
  };
}

export function activateSnapshot(world: World, index: number): World {
  const synced = syncActiveSnapshot(world);
  const snapshots = synced.snapshots ?? [];
  const target = snapshots[index];
  if (!target) return synced;
  return touchWorld({
    ...synced,
    nodes: structuredClone(target.nodes),
    relations: structuredClone(target.relations),
    activeSnapshotId: target.id,
  });
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
    ...(type === 'Space' ? { backgroundColor: '#E8EEF1' } : {}),
    ...(type === 'Element' ? { icon: 'character' as const } : {}),
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

export function changeNodeType(world: World, id: number, type: NodeType): World {
  const meta = NODE_TYPE_META[type];
  return updateNode(world, id, (node) => ({
    ...node,
    type,
    ...(meta.resizable
      ? { width: node.width ?? meta.defaultWidth, height: node.height ?? meta.defaultHeight }
      : {}),
    ...(type === 'Space' ? { backgroundColor: node.backgroundColor ?? '#E8EEF1' } : {}),
    ...(type === 'Element' ? { icon: node.icon ?? 'character' } : {}),
  }));
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

export function nodesMovedWith(world: World, ids: readonly number[]): Set<number> {
  const moving = new Set<number>(ids);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const entry of world.nodes) {
      const parent = entry.sourceId ?? entry.parentId;
      if (parent !== undefined && moving.has(parent) && !moving.has(entry.id)) {
        moving.add(entry.id);
        expanded = true;
      }
    }
  }
  return moving;
}

export function moveNode(world: World, id: number, x: number, y: number): World {
  const node = world.nodes.find((entry) => entry.id === id);
  if (!node) return world;
  const dx = Math.round(x - node.x);
  const dy = Math.round(y - node.y);
  if (dx === 0 && dy === 0) return world;

  const moving = nodesMovedWith(world, [id]);
  let changed = false;
  const nodes = world.nodes.map((entry) => {
    if (!moving.has(entry.id)) return entry;
    changed = true;
    return { ...entry, x: entry.x + dx, y: entry.y + dy };
  });
  return changed ? touchWorld({ ...world, nodes }) : world;
}

/**
 * Moves every node with an explicit target position. Used by group drags so the
 * whole selection keeps its relative geometry and only one undo entry is made.
 */
export function moveNodesTo(
  world: World,
  positions: ReadonlyMap<number, { x: number; y: number }>,
): World {
  let changed = false;
  const nodes = world.nodes.map((entry) => {
    const target = positions.get(entry.id);
    if (!target) return entry;
    const x = Math.round(target.x);
    const y = Math.round(target.y);
    if (x === entry.x && y === entry.y) return entry;
    changed = true;
    return { ...entry, x, y };
  });
  return changed ? touchWorld({ ...world, nodes }) : world;
}

export function nodeLayer(node: WorldNode): number {
  return node.layer ?? (isContainerNode(node) ? 0 : 3);
}

export type LayerAction = 'up' | 'down' | 'top' | 'bottom';

export function changeNodeLayer(world: World, id: number, action: LayerAction): World {
  const node = world.nodes.find((entry) => entry.id === id);
  if (!node) return world;
  const layers = world.nodes.map(nodeLayer);
  const current = nodeLayer(node);
  const next =
    action === 'up'
      ? current + 1
      : action === 'down'
        ? current - 1
        : action === 'top'
          ? Math.max(...layers) + 1
          : Math.min(...layers) - 1;
  if (next === current) return world;
  return updateNode(world, id, (entry) => ({ ...entry, layer: next }));
}

export interface PasteResult {
  world: World;
  nodes: WorldNode[];
}

export function pasteNodes(world: World, sources: readonly WorldNode[], offset = 32): PasteResult {
  if (sources.length === 0) return { world, nodes: [] };
  const taken = new Set<number>(world.nodes.map((node) => node.id));
  let candidate = Date.now();
  const idMap = new Map<number, number>();
  for (const source of sources) {
    while (taken.has(candidate)) candidate += 1;
    idMap.set(source.id, candidate);
    taken.add(candidate);
    candidate += 1;
  }
  const nodes = sources.map((source) => ({
    ...structuredClone(source),
    id: idMap.get(source.id)!,
    x: Math.round(source.x + offset),
    y: Math.round(source.y + offset),
    ...(source.parentId !== undefined
      ? { parentId: idMap.get(source.parentId) ?? source.parentId }
      : {}),
    ...(source.sourceId !== undefined
      ? { sourceId: idMap.get(source.sourceId) ?? source.sourceId }
      : {}),
  }));
  return {
    world: touchWorld({ ...world, nodes: [...world.nodes, ...nodes] }),
    nodes,
  };
}

export function removeNodes(world: World, ids: readonly number[]): World {
  return ids.reduce((current, id) => removeNode(current, id), world);
}

export function removeNode(world: World, id: number): World {
  const targets = new Set<number>([id]);
  for (const node of world.nodes) {
    if (node.sourceId === id || node.parentId === id) targets.add(node.id);
  }
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const node of world.nodes) {
      if (node.sourceId !== undefined && targets.has(node.sourceId) && !targets.has(node.id)) {
        targets.add(node.id);
        expanded = true;
      }
    }
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

export function isContainerNode(node: WorldNode): boolean {
  return node.type === 'Space' || node.type === 'Place' || node.type === 'Category';
}

export function containingSpace(world: World, node: WorldNode): WorldNode | undefined {
  const candidates = world.nodes
    .filter((candidate) => candidate.id !== node.id && isContainerNode(candidate))
    .filter((space) => {
      const size = nodeVisualSize(space);
      return (
        node.x > space.x - size.width / 2 &&
        node.x < space.x + size.width / 2 &&
        node.y > space.y - size.height / 2 &&
        node.y < space.y + size.height / 2
      );
    })
    .sort((a, b) => {
      const aSize = nodeVisualSize(a);
      const bSize = nodeVisualSize(b);
      return aSize.width * aSize.height - bSize.width * bSize.height;
    });
  return candidates[0];
}

export function nodesInside(world: World, spaceId: number): WorldNode[] {
  return world.nodes.filter((node) => node.parentId === spaceId);
}
