import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import type { CreateType, Relation, World, WorldNode } from '../../domain/types';
import {
  containingSpace,
  isContainerNode,
  moveNodesTo,
  nodeLayer,
  nodeVisualSize,
  nodesMovedWith,
  renameRelation,
  updateNode,
  type LayerAction,
  type ViewTransform,
} from '../../domain/world';
import { Icon, TypeIcon } from '../../components/Icon';

type Mode = 'create' | 'explore';

interface CanvasSize {
  width: number;
  height: number;
}

interface StudioCanvasProps {
  world: World;
  mode: Mode;
  view: ViewTransform;
  setView: (updater: (view: ViewTransform) => ViewTransform) => void;
  onViewportChange: (size: CanvasSize) => void;
  selectedNodeIds: number[];
  selectedRelationId: number | null;
  onSelectNode: (id: number | null) => void;
  onSelectNodes: (ids: number[], primary?: number | null) => void;
  onSelectRelation: (id: number | null) => void;
  onChangeLayer: (id: number, action: LayerAction) => void;
  onBeginTransaction: () => void;
  onEndTransaction: () => void;
  onCancelTransaction: () => void;
  onReplace: (updater: (world: World) => World) => void;
  onCommit: (updater: (world: World) => World) => void;
  onAddNode: (type: CreateType, x?: number, y?: number) => void;
  onAddImage: (file: File, x: number, y: number) => void;
  onAddRelation: (from: number, to: number) => void;
  onOpenNode: (id: number) => void;
  worldRef: RefObject<HTMLDivElement | null>;
  timeline?: ReactNode;
}

type DragState =
  | {
      kind: 'pan';
      pointerId: number;
      clientX: number;
      clientY: number;
      viewX: number;
      viewY: number;
      moved: boolean;
    }
  | {
      kind: 'node';
      pointerId: number;
      clientX: number;
      clientY: number;
      primaryId: number;
      ids: number[];
      startPositions: Map<number, { x: number; y: number }>;
      startScale: number;
      moved: boolean;
    }
  | {
      kind: 'resize';
      pointerId: number;
      clientX: number;
      clientY: number;
      nodeId: number;
      corner: 'tl' | 'tr' | 'bl' | 'br';
      startWidth: number;
      startHeight: number;
      startLeft: number;
      startTop: number;
      startScale: number;
    }
  | {
      kind: 'marquee';
      pointerId: number;
      startX: number;
      startY: number;
      moved: boolean;
    };

interface ConnectionState {
  fromId: number;
  side: 'left' | 'right';
  current: { x: number; y: number };
}

interface CreateMenuState {
  x: number;
  y: number;
  worldX: number;
  worldY: number;
}

interface NodeMenuState {
  id: number;
  x: number;
  y: number;
}

interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ZoomAnchor {
  screenX: number;
  screenY: number;
  worldX: number;
  worldY: number;
}

const ZOOM_DAMPING = 0.14;
const ZOOM_EPSILON = 0.0005;
const ZOOM_WHEEL_GAIN = 0.0012;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.8;

function normalizeWheelDelta(event: WheelEvent): { x: number; y: number } {
  const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1;
  return { x: event.deltaX * multiplier, y: event.deltaY * multiplier };
}

function sameView(a: ViewTransform, b: ViewTransform): boolean {
  return a.x === b.x && a.y === b.y && a.scale === b.scale;
}

interface RelationGeometry {
  path: string;
  labelX: number;
  labelY: number;
}

function relationGeometry(source: WorldNode, target: WorldNode): RelationGeometry {
  const sourceSize = nodeVisualSize(source);
  const targetSize = nodeVisualSize(target);
  const forward = target.x >= source.x;
  const startX = forward ? source.x + sourceSize.width / 2 : source.x - sourceSize.width / 2;
  const endX = forward ? target.x - targetSize.width / 2 : target.x + targetSize.width / 2;
  const startY = source.y;
  const endY = target.y;
  const distance = Math.abs(endX - startX);
  const handle = Math.max(45, Math.min(240, distance * 0.55 + 30));
  const c1 = forward ? startX + handle : startX - handle;
  const c2 = forward ? endX - handle : endX + handle;
  return {
    path: `M ${startX} ${startY} C ${c1} ${startY}, ${c2} ${endY}, ${endX} ${endY}`,
    labelX: (startX + endX) / 2,
    labelY: (startY + endY) / 2,
  };
}

function previewGeometry(
  source: WorldNode,
  side: 'left' | 'right',
  target: { x: number; y: number },
): string {
  const size = nodeVisualSize(source);
  const startX = side === 'right' ? source.x + size.width / 2 : source.x - size.width / 2;
  const startY = source.y;
  const direction = side === 'right' ? 1 : -1;
  const handle = Math.max(45, Math.abs(target.x - startX) * 0.55);
  const c1 = startX + handle * direction;
  const c2 = target.x - handle * (target.x >= startX ? 1 : -1);
  return `M ${startX} ${startY} C ${c1} ${startY}, ${c2} ${target.y}, ${target.x} ${target.y}`;
}

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The image could not be read.'));
    reader.readAsDataURL(file);
  });
}

export function StudioCanvas({
  world,
  mode,
  view,
  setView,
  onViewportChange,
  selectedNodeIds,
  selectedRelationId,
  onSelectNode,
  onSelectNodes,
  onSelectRelation,
  onChangeLayer,
  onBeginTransaction,
  onEndTransaction,
  onCancelTransaction,
  onReplace,
  onCommit,
  onAddNode,
  onAddImage,
  onAddRelation,
  onOpenNode,
  worldRef,
  timeline,
}: StudioCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  const liveViewRef = useRef(view);
  const zoomTargetRef = useRef(view.scale);
  const zoomAnchorRef = useRef<ZoomAnchor>({ screenX: 0, screenY: 0, worldX: 0, worldY: 0 });
  const zoomFrameRef = useRef<number | null>(null);
  const panIdleTimerRef = useRef<number | null>(null);
  const spacePressedRef = useRef(false);
  const dragRef = useRef<DragState | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [menu, setMenu] = useState<CreateMenuState | null>(null);
  const [nodeMenu, setNodeMenu] = useState<NodeMenuState | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<number | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingRelationId, setEditingRelationId] = useState<number | null>(null);
  const [relationDraft, setRelationDraft] = useState('');

  const applyLiveView = useCallback(
    (next: ViewTransform) => {
      liveViewRef.current = next;
      const element = worldRef.current;
      if (element) {
        element.style.transform = `translate3d(${next.x}px, ${next.y}px, 0) scale(${next.scale})`;
      }
    },
    [worldRef],
  );

  const commitLiveView = useCallback(() => {
    const live = liveViewRef.current;
    if (sameView(live, viewRef.current)) return;
    setView(() => ({ ...live }));
  }, [setView]);

  const stopZoomAnimation = useCallback(() => {
    if (zoomFrameRef.current !== null) {
      cancelAnimationFrame(zoomFrameRef.current);
      zoomFrameRef.current = null;
    }
    zoomTargetRef.current = liveViewRef.current.scale;
  }, []);

  // Any external viewport change (toolbar zoom, fit, focus, undo layout) is
  // applied once here. During a wheel zoom the world transform is updated
  // directly by requestAnimationFrame and React is only notified at the end.
  useLayoutEffect(() => {
    if (zoomFrameRef.current !== null) {
      cancelAnimationFrame(zoomFrameRef.current);
      zoomFrameRef.current = null;
    }
    liveViewRef.current = view;
    viewRef.current = view;
    zoomTargetRef.current = view.scale;
    applyLiveView(view);
  }, [applyLiveView, view]);

  useEffect(() => {
    return () => {
      if (zoomFrameRef.current !== null) cancelAnimationFrame(zoomFrameRef.current);
      if (panIdleTimerRef.current !== null) window.clearTimeout(panIdleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const report = () => {
      const rect = canvas.getBoundingClientRect();
      onViewportChange({ width: rect.width, height: rect.height });
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [onViewportChange]);

  useEffect(() => {
    if (!menu && !nodeMenu) return;
    const close = () => {
      setMenu(null);
      setNodeMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu, nodeMenu]);

  useEffect(() => {
    const isEditing = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    const down = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isEditing(event.target)) spacePressedRef.current = true;
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Space') spacePressedRef.current = false;
    };
    const blur = () => {
      spacePressedRef.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  const relations = useMemo(
    () =>
      world.relations.flatMap((relation) => {
        const from = world.nodes.find((node) => node.id === relation.from);
        const to = world.nodes.find((node) => node.id === relation.to);
        if (!from || !to) return [];
        return [{ relation, geometry: relationGeometry(from, to) }];
      }),
    [world.nodes, world.relations],
  );

  const canvasPoint = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const currentView = liveViewRef.current;
    return {
      x: (clientX - (rect?.left ?? 0) - currentView.x) / currentView.scale,
      y: (clientY - (rect?.top ?? 0) - currentView.y) / currentView.scale,
    };
  };

  const stopZoomBeforeInteraction = () => {
    const wasZooming = zoomFrameRef.current !== null;
    if (wasZooming) stopZoomAnimation();
    const wasPanning = panIdleTimerRef.current !== null;
    if (wasPanning) {
      window.clearTimeout(panIdleTimerRef.current!);
      panIdleTimerRef.current = null;
      setIsPanning(false);
    }
    if (wasZooming || wasPanning) commitLiveView();
  };

  const beginCanvasPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    stopZoomBeforeInteraction();
    const live = liveViewRef.current;
    dragRef.current = {
      kind: 'pan',
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      viewX: live.x,
      viewY: live.y,
      moved: false,
    };
    setIsPanning(true);
    canvasRef.current?.setPointerCapture(event.pointerId);
  };

  const beginNodeDrag = (event: ReactPointerEvent<HTMLDivElement>, node: WorldNode) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    setMenu(null);
    setNodeMenu(null);
    stopZoomBeforeInteraction();
    const alreadySelected = selectedNodeIds.includes(node.id);
    const ids = alreadySelected ? selectedNodeIds : [node.id];
    if (!alreadySelected) onSelectNodes([node.id], node.id);
    onSelectRelation(null);
    if (mode === 'explore') return;
    const startPositions = new Map<number, { x: number; y: number }>();
    for (const id of nodesMovedWith(world, ids)) {
      const entry = world.nodes.find((candidate) => candidate.id === id);
      if (entry) startPositions.set(id, { x: entry.x, y: entry.y });
    }
    dragRef.current = {
      kind: 'node',
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      primaryId: node.id,
      ids,
      startPositions,
      startScale: liveViewRef.current.scale,
      moved: false,
    };
    canvasRef.current?.setPointerCapture(event.pointerId);
  };

  const beginResize = (
    event: ReactPointerEvent<HTMLSpanElement>,
    node: WorldNode,
    corner: 'tl' | 'tr' | 'bl' | 'br',
  ) => {
    if (event.button !== 0 || mode === 'explore') return;
    event.stopPropagation();
    event.preventDefault();
    stopZoomBeforeInteraction();
    const size = nodeVisualSize(node);
    onSelectNodes([node.id], node.id);
    onBeginTransaction();
    dragRef.current = {
      kind: 'resize',
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      nodeId: node.id,
      corner,
      startWidth: size.width,
      startHeight: size.height,
      startLeft: node.x - size.width / 2,
      startTop: node.y - size.height / 2,
      startScale: liveViewRef.current.scale,
    };
    canvasRef.current?.setPointerCapture(event.pointerId);
  };

  const beginConnection = (
    event: ReactPointerEvent<HTMLSpanElement>,
    node: WorldNode,
    side: 'left' | 'right',
  ) => {
    if (event.button !== 0 || mode === 'explore') return;
    event.preventDefault();
    event.stopPropagation();
    stopZoomBeforeInteraction();
    onSelectNode(node.id);
    onSelectRelation(null);
    setConnection({ fromId: node.id, side, current: { x: node.x, y: node.y } });
    canvasRef.current?.setPointerCapture(event.pointerId);
  };

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    if (
      (event.target as HTMLElement).closest(
        '.world-node, .relation-hit, .relation-name, .relation-name-input, .canvas-create-menu, .node-layer-menu, .empty-state, .bottom-timeline, .canvas-help',
      )
    ) {
      return;
    }
    setMenu(null);
    setNodeMenu(null);
    stopZoomBeforeInteraction();
    if (mode === 'explore' || event.button === 1 || spacePressedRef.current) {
      event.preventDefault();
      beginCanvasPan(event);
      return;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    onSelectRelation(null);
    dragRef.current = {
      kind: 'marquee',
      pointerId: event.pointerId,
      startX: x,
      startY: y,
      moved: false,
    };
    setSelectionBox({ x, y, width: 0, height: 0 });
    canvasRef.current?.setPointerCapture(event.pointerId);
  };

  const nodesInsideBox = (box: SelectionBox): number[] => {
    const currentView = liveViewRef.current;
    const left = Math.min(box.x, box.x + box.width);
    const top = Math.min(box.y, box.y + box.height);
    const right = Math.max(box.x, box.x + box.width);
    const bottom = Math.max(box.y, box.y + box.height);
    return world.nodes
      .filter((node) => !isContainerNode(node))
      .filter((node) => {
        const size = nodeVisualSize(node);
        const nodeLeft = currentView.x + (node.x - size.width / 2) * currentView.scale;
        const nodeTop = currentView.y + (node.y - size.height / 2) * currentView.scale;
        const nodeRight = nodeLeft + size.width * currentView.scale;
        const nodeBottom = nodeTop + size.height * currentView.scale;
        return nodeRight >= left && nodeLeft <= right && nodeBottom >= top && nodeTop <= bottom;
      })
      .map((node) => node.id);
  };

  const finishMarquee = (box: SelectionBox) => {
    const width = Math.abs(box.width);
    const height = Math.abs(box.height);
    if (width < 3 && height < 3) {
      onSelectNodes([], null);
    } else {
      const ids = nodesInsideBox(box);
      onSelectNodes(ids, ids[0] ?? null);
    }
    setSelectionBox(null);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (connection) {
      setConnection({ ...connection, current: canvasPoint(event.clientX, event.clientY) });
      return;
    }
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === 'pan') {
      const dx = event.clientX - drag.clientX;
      const dy = event.clientY - drag.clientY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
      applyLiveView({
        ...liveViewRef.current,
        x: drag.viewX + dx,
        y: drag.viewY + dy,
      });
      return;
    }
    if (drag.kind === 'marquee') {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const currentX = event.clientX - rect.left;
      const currentY = event.clientY - rect.top;
      if (Math.abs(currentX - drag.startX) > 3 || Math.abs(currentY - drag.startY) > 3) {
        drag.moved = true;
      }
      setSelectionBox({
        x: Math.min(drag.startX, currentX),
        y: Math.min(drag.startY, currentY),
        width: Math.abs(currentX - drag.startX),
        height: Math.abs(currentY - drag.startY),
      });
      return;
    }
    if (drag.kind === 'node') {
      const dx = (event.clientX - drag.clientX) / drag.startScale;
      const dy = (event.clientY - drag.clientY) / drag.startScale;
      if (!drag.moved && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
        drag.moved = true;
        // Start the undo transaction on the first real movement so a plain
        // click (for example, after editing Description) never adds history.
        onBeginTransaction();
      }
      if (!drag.moved) return;
      const targets = new Map<number, { x: number; y: number }>();
      for (const [id, position] of drag.startPositions) {
        targets.set(id, { x: position.x + dx, y: position.y + dy });
      }
      onReplace((current) => moveNodesTo(current, targets));
      return;
    }
    const dx = (event.clientX - drag.clientX) / drag.startScale;
    const dy = (event.clientY - drag.clientY) / drag.startScale;
    const left = drag.corner.includes('l') ? drag.startLeft + dx : drag.startLeft;
    const top = drag.corner.includes('t') ? drag.startTop + dy : drag.startTop;
    const width = drag.corner.includes('l') ? drag.startWidth - dx : drag.startWidth + dx;
    const height = drag.corner.includes('t') ? drag.startHeight - dy : drag.startHeight + dy;
    const clampedWidth = Math.round(Math.min(1800, Math.max(240, width)));
    const clampedHeight = Math.round(Math.min(1200, Math.max(170, height)));
    const finalLeft = drag.corner.includes('l')
      ? drag.startLeft + drag.startWidth - clampedWidth
      : left;
    const finalTop = drag.corner.includes('t')
      ? drag.startTop + drag.startHeight - clampedHeight
      : top;
    onReplace((current) =>
      updateNode(current, drag.nodeId, (node) => ({
        ...node,
        width: clampedWidth,
        height: clampedHeight,
        x: Math.round(finalLeft + clampedWidth / 2),
        y: Math.round(finalTop + clampedHeight / 2),
      })),
    );
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (connection) {
      const target = document
        .elementsFromPoint(event.clientX, event.clientY)
        .map((element) => element.closest<HTMLElement>('.world-node'))
        .find((element) => element && Number(element.dataset.nodeId) !== connection.fromId);
      if (target) {
        const targetId = Number(target.dataset.nodeId);
        if (Number.isFinite(targetId)) onAddRelation(connection.fromId, targetId);
      }
      setConnection(null);
      releaseCapture(event.pointerId);
      return;
    }
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    releaseCapture(event.pointerId);
    if (drag.kind === 'pan') {
      setIsPanning(false);
      commitLiveView();
      return;
    }
    if (drag.kind === 'marquee') {
      const rect = canvasRef.current?.getBoundingClientRect();
      const currentX = rect ? event.clientX - rect.left : drag.startX;
      const currentY = rect ? event.clientY - rect.top : drag.startY;
      finishMarquee({
        x: Math.min(drag.startX, currentX),
        y: Math.min(drag.startY, currentY),
        width: Math.abs(currentX - drag.startX),
        height: Math.abs(currentY - drag.startY),
      });
      return;
    }
    if (drag.kind === 'node') {
      if (drag.moved) {
        onReplace((current) => {
          let next = current;
          for (const id of drag.ids) {
            const node = next.nodes.find((entry) => entry.id === id);
            if (!node || isContainerNode(node)) continue;
            const space = containingSpace(next, node);
            next = updateNode(next, id, (entry) => ({ ...entry, parentId: space?.id }));
          }
          return next;
        });
      }
      onEndTransaction();
      return;
    }
    onEndTransaction();
  };

  const releaseCapture = (pointerId: number) => {
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  };

  const handlePointerCancel = () => {
    const drag = dragRef.current;
    if (drag?.kind === 'pan') {
      applyLiveView({ ...liveViewRef.current, x: drag.viewX, y: drag.viewY });
      commitLiveView();
    }
    dragRef.current = null;
    setIsPanning(false);
    setSelectionBox(null);
    setConnection(null);
    onCancelTransaction();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const animateZoom = () => {
      const target = zoomTargetRef.current;
      const current = liveViewRef.current;
      const anchor = zoomAnchorRef.current;
      let scale = current.scale + (target - current.scale) * ZOOM_DAMPING;
      const done = Math.abs(target - scale) <= ZOOM_EPSILON;
      if (done) scale = target;
      const next = {
        scale,
        x: anchor.screenX - anchor.worldX * scale,
        y: anchor.screenY - anchor.worldY * scale,
      };
      applyLiveView(next);
      if (!done) {
        zoomFrameRef.current = requestAnimationFrame(animateZoom);
        return;
      }
      zoomFrameRef.current = null;
      setView(() => ({ ...next }));
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const delta = normalizeWheelDelta(event);
      const isZoom = event.ctrlKey || event.metaKey;
      if (!isZoom) {
        if (zoomFrameRef.current !== null) {
          stopZoomAnimation();
        }
        if (panIdleTimerRef.current !== null) window.clearTimeout(panIdleTimerRef.current);
        const live = liveViewRef.current;
        applyLiveView({ ...live, x: live.x - delta.x, y: live.y - delta.y });
        setIsPanning(true);
        panIdleTimerRef.current = window.setTimeout(() => {
          panIdleTimerRef.current = null;
          setIsPanning(false);
          commitLiveView();
        }, 140);
        return;
      }
      if (panIdleTimerRef.current !== null) {
        window.clearTimeout(panIdleTimerRef.current);
        panIdleTimerRef.current = null;
        setIsPanning(false);
      }
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const live = liveViewRef.current;
      zoomAnchorRef.current = {
        screenX: px,
        screenY: py,
        worldX: (px - live.x) / live.scale,
        worldY: (py - live.y) / live.scale,
      };
      zoomTargetRef.current = Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, zoomTargetRef.current - delta.y * ZOOM_WHEEL_GAIN),
      );
      if (zoomFrameRef.current === null) {
        zoomFrameRef.current = requestAnimationFrame(animateZoom);
      }
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [applyLiveView, commitLiveView, setView, stopZoomAnimation]);

  const openMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'create') return;
    event.preventDefault();
    setMenu(null);
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width - 200));
    const y = Math.max(0, Math.min(event.clientY - rect.top, rect.height - 220));
    const nodeElement = (event.target as HTMLElement).closest<HTMLElement>('.world-node');
    const nodeId = Number(nodeElement?.dataset.nodeId);
    if (nodeElement && Number.isFinite(nodeId)) {
      if (!selectedNodeIds.includes(nodeId)) onSelectNodes([nodeId], nodeId);
      setNodeMenu({
        id: nodeId,
        x: Math.max(0, Math.min(event.clientX - rect.left, rect.width - 176)),
        y: Math.max(0, Math.min(event.clientY - rect.top, rect.height - 170)),
      });
      return;
    }
    const currentView = liveViewRef.current;
    setMenu({
      x,
      y,
      worldX: (x - currentView.x) / currentView.scale,
      worldY: (y - currentView.y) / currentView.scale,
    });
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (mode !== 'create') return;
    const file = [...event.dataTransfer.files].find((entry) => entry.type.startsWith('image/'));
    if (!file) return;
    event.preventDefault();
    const point = canvasPoint(event.clientX, event.clientY);
    onAddImage(file, point.x, point.y);
  };

  const handleImageFile = async (file: File, nodeId: number) => {
    try {
      const source = await readImageFile(file);
      onCommit((current) => updateNode(current, nodeId, (node) => ({ ...node, imageSrc: source })));
    } catch {
      // The file input simply resets when the image cannot be read.
    }
  };

  const commitTitle = (nodeId: number) => {
    const title = titleDraft.trim().slice(0, 120) || 'Untitled';
    setEditingNodeId(null);
    onCommit((current) => updateNode(current, nodeId, (node) => ({ ...node, title })));
  };

  const commitRelation = (relation: Relation) => {
    const name = relationDraft.trim().slice(0, 80) || 'Relation';
    setEditingRelationId(null);
    if (name === relation.name) return;
    onCommit((current) => renameRelation(current, relation.id, name));
  };

  const renderNode = (node: WorldNode) => {
    const size = nodeVisualSize(node);
    const container = isContainerNode(node);
    const selected = selectedNodeIds.includes(node.id);
    return (
      <div
        key={node.id}
        role="button"
        tabIndex={0}
        data-node-id={node.id}
        className={`world-node shape-${node.type.toLowerCase()} ${selected ? 'selected' : ''} ${
          mode === 'explore' ? 'explore-node' : ''
        }`}
        style={{
          left: node.x,
          top: node.y,
          // Semantic defaults match the Make source: frames sit at 0 and
          // ordinary nodes at 3, with relation lines at 2 between them.
          zIndex: nodeLayer(node),
          ...(container
            ? {
                width: size.width,
                height: size.height,
                backgroundColor: node.backgroundColor ?? '#E8EEF1',
              }
            : {}),
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          if (mode === 'explore') {
            onOpenNode(node.id);
            return;
          }
          if (node.type === 'Image') return;
          setTitleDraft(node.title);
          setEditingNodeId(node.id);
        }}
        onPointerDown={(event) => beginNodeDrag(event, node)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelectNode(node.id);
          }
        }}
        aria-label={`${node.type}: ${node.title}`}
      >
        {node.type === 'Image' ? (
          <button
            type="button"
            className="image-node-media"
            title="Choose an image"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              const input = event.currentTarget.querySelector<HTMLInputElement>('input');
              input?.click();
            }}
          >
            {node.imageSrc ? (
              <img src={node.imageSrc} alt="" draggable={false} />
            ) : (
              <span className="image-node-placeholder">
                <Icon name="imagePlus" size={23} />
                <small>Choose image</small>
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImageFile(file, node.id);
                event.target.value = '';
              }}
            />
          </button>
        ) : (
          <span className="node-content">
            <span className={`node-symbol ${node.type.toLowerCase()}`}>
              {node.type === 'Element' ? (
                <Icon name={node.icon ?? 'character'} size={18} />
              ) : (
                <TypeIcon type={node.type} size={18} />
              )}
            </span>
            <span className="node-copy">
              {editingNodeId === node.id ? (
                <input
                  className="node-title-input"
                  autoFocus
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onBlur={() => commitTitle(node.id)}
                  onPointerDown={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setEditingNodeId(null);
                    }
                  }}
                  aria-label="Node title"
                />
              ) : (
                <strong>{node.title}</strong>
              )}
              <small>{node.type}</small>
            </span>
          </span>
        )}

        {container && mode === 'create' && (
          <>
            {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
              <span
                key={corner}
                className={`resize-handle ${corner}`}
                onPointerDown={(event) => beginResize(event, node, corner)}
              />
            ))}
          </>
        )}

        {node.sourceId !== undefined && (
          <span className="alias-mark" title="Alias">
            <i />
            <i />
          </span>
        )}

        {mode === 'create' && node.type !== 'Image' && (
          <>
            <span
              className="relation-port left"
              onPointerDown={(event) => beginConnection(event, node, 'left')}
            />
            <span
              className="relation-port right"
              onPointerDown={(event) => beginConnection(event, node, 'right')}
            />
          </>
        )}
      </div>
    );
  };

  return (
    <div
      ref={canvasRef}
      className={`canvas ${mode} ${isPanning ? 'is-panning' : ''} ${
        selectionBox ? 'is-selecting' : ''
      }`}
      onPointerDownCapture={() => {
        // Commit an open inspector textarea before a node/blank press changes
        // the selection. The native mousedown blur normally fires after
        // pointerdown, when the inspector may already be unmounting.
        const active = document.activeElement;
        if (
          active instanceof HTMLElement &&
          (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')
        ) {
          active.blur();
        }
      }}
      onContextMenu={openMenu}
      onDragOver={(event) => {
        if (
          mode === 'create' &&
          [...event.dataTransfer.items].some((item) => item.type.startsWith('image/'))
        ) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={handleDrop}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <div className="canvas-label">
        <strong>{mode === 'create' ? 'World' : 'Exploring World'}</strong>
        <span>{world.nodes.length} nodes</span>
      </div>

      {menu && (
        <div
          className="canvas-create-menu"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(event) => event.stopPropagation()}
          role="menu"
          aria-label="Create node"
        >
          <div className="context-title">
            <span>Create node</span>
            <small>at this position</small>
          </div>
          <div className="context-group">
            {(['Space', 'Element', 'Event'] as const).map((type) => (
              <button
                type="button"
                key={type}
                role="menuitem"
                onClick={() => {
                  onAddNode(type, menu.worldX, menu.worldY);
                  setMenu(null);
                }}
              >
                <span className={`type-icon ${type.toLowerCase()}`}>
                  <Icon
                    name={type === 'Space' ? 'space' : type === 'Element' ? 'element' : 'event'}
                    size={14}
                  />
                </span>
                {type}
              </button>
            ))}
          </div>
          <div className="context-divider" />
          <button
            type="button"
            className="context-wide"
            role="menuitem"
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = () => {
                const file = input.files?.[0];
                if (file) onAddImage(file, menu.worldX, menu.worldY);
              };
              input.click();
              setMenu(null);
            }}
          >
            <Icon name="imagePlus" size={14} />
            Image
          </button>
        </div>
      )}

      {nodeMenu && (
        <div
          className="node-layer-menu"
          style={{ left: nodeMenu.x, top: nodeMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
          role="menu"
          aria-label="Node layer"
        >
          <div className="context-title">
            <span>Layer</span>
            <small>order</small>
          </div>
          {(
            [
              ['up', 'Bring forward'],
              ['down', 'Send backward'],
              ['top', 'Bring to front'],
              ['bottom', 'Send to back'],
            ] as const
          ).map(([action, label]) => (
            <button
              type="button"
              key={action}
              role="menuitem"
              onClick={() => {
                onChangeLayer(nodeMenu.id, action);
                setNodeMenu(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div ref={worldRef} className="world">
        <svg className="relation-layer" aria-hidden="true">
          {relations.map(({ relation, geometry }) => (
            <g key={relation.id} className={selectedRelationId === relation.id ? 'active' : ''}>
              <path
                className="relation-line"
                d={geometry.path}
                fill="none"
                stroke="#9ca9a7"
                strokeWidth={1.2}
                strokeDasharray="5 5"
              />
              <path
                className="relation-hit"
                d={geometry.path}
                fill="none"
                stroke="transparent"
                strokeWidth={14}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectNode(null);
                  onSelectRelation(relation.id);
                  setRelationDraft(relation.name);
                  setEditingRelationId(relation.id);
                }}
              />
            </g>
          ))}
          {connection &&
            (() => {
              const from = world.nodes.find((node) => node.id === connection.fromId);
              if (!from) return null;
              return (
                <path
                  className="relation-preview"
                  d={previewGeometry(from, connection.side, connection.current)}
                  fill="none"
                  stroke="#6f8fa8"
                  strokeWidth={1.2}
                  strokeDasharray="4 4"
                />
              );
            })()}
        </svg>

        {relations.map(({ relation, geometry }) => (
          <div
            key={`label-${relation.id}`}
            className={`relation-name ${selectedRelationId === relation.id ? 'selected' : ''}`}
            style={{ left: geometry.labelX, top: geometry.labelY }}
          >
            {editingRelationId === relation.id ? (
              <input
                className="relation-name-input"
                autoFocus
                value={relationDraft}
                onChange={(event) => setRelationDraft(event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
                onBlur={() => commitRelation(relation)}
                onPointerDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitRelation(relation);
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setEditingRelationId(null);
                  }
                }}
                aria-label="Relation name"
              />
            ) : (
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectNode(null);
                  onSelectRelation(relation.id);
                }}
              >
                {relation.name}
              </button>
            )}
          </div>
        ))}

        {world.nodes.map(renderNode)}
      </div>

      {selectionBox && (
        <div
          className="selection-marquee"
          style={{
            left: selectionBox.x,
            top: selectionBox.y,
            width: selectionBox.width,
            height: selectionBox.height,
          }}
        />
      )}

      {world.nodes.length === 0 && (
        <div className="empty-state">
          <span className="empty-orbit" aria-hidden="true">
            <i />
          </span>
          <h2>Every world begins somewhere.</h2>
          <p>
            Start with a place, a character, or an idea.
            <br />
            Give it room to grow.
          </p>
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onAddNode('Element')}
          >
            Create your first node
          </button>
        </div>
      )}

      {timeline}

      <div className="canvas-help">
        <span>Two-finger scroll to pan</span>
        <span>Pinch to zoom</span>
        {mode === 'create' && <span>Drag empty canvas to select</span>}
        {mode === 'create' && <span>Right-click to add</span>}
      </div>
    </div>
  );
}
