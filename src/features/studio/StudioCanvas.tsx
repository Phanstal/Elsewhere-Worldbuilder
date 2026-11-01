import {
  useEffect,
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
  moveNode,
  nodeVisualSize,
  renameRelation,
  updateNode,
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
  selectedNodeId: number | null;
  selectedRelationId: number | null;
  onSelectNode: (id: number | null) => void;
  onSelectRelation: (id: number | null) => void;
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
      nodeId: number;
      nodeX: number;
      nodeY: number;
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
  selectedNodeId,
  selectedRelationId,
  onSelectNode,
  onSelectRelation,
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
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [menu, setMenu] = useState<CreateMenuState | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<number | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingRelationId, setEditingRelationId] = useState<number | null>(null);
  const [relationDraft, setRelationDraft] = useState('');

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

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
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

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
    const currentView = viewRef.current;
    return {
      x: (clientX - (rect?.left ?? 0) - currentView.x) / currentView.scale,
      y: (clientY - (rect?.top ?? 0) - currentView.y) / currentView.scale,
    };
  };

  const beginNodeDrag = (event: ReactPointerEvent<HTMLDivElement>, node: WorldNode) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    setMenu(null);
    onSelectNode(node.id);
    onSelectRelation(null);
    if (mode === 'explore') return;
    onBeginTransaction();
    dragRef.current = {
      kind: 'node',
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      nodeId: node.id,
      nodeX: node.x,
      nodeY: node.y,
      moved: false,
    };
    setDragging(true);
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
    const size = nodeVisualSize(node);
    onSelectNode(node.id);
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
    };
    setDragging(true);
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
    onSelectNode(node.id);
    onSelectRelation(null);
    setConnection({ fromId: node.id, side, current: { x: node.x, y: node.y } });
    canvasRef.current?.setPointerCapture(event.pointerId);
  };

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (
      (event.target as HTMLElement).closest(
        '.world-node, .relation-hit, .relation-name, .relation-name-input, .canvas-create-menu, .empty-state, .bottom-timeline, .canvas-help',
      )
    ) {
      return;
    }
    setMenu(null);
    onSelectNode(null);
    onSelectRelation(null);
    dragRef.current = {
      kind: 'pan',
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      viewX: viewRef.current.x,
      viewY: viewRef.current.y,
      moved: false,
    };
    setDragging(true);
    canvasRef.current?.setPointerCapture(event.pointerId);
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
      setView((current) => ({
        ...current,
        x: drag.viewX + dx,
        y: drag.viewY + dy,
      }));
      return;
    }
    if (drag.kind === 'node') {
      const dx = (event.clientX - drag.clientX) / viewRef.current.scale;
      const dy = (event.clientY - drag.clientY) / viewRef.current.scale;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) drag.moved = true;
      onReplace((current) => moveNode(current, drag.nodeId, drag.nodeX + dx, drag.nodeY + dy));
      return;
    }
    const dx = (event.clientX - drag.clientX) / viewRef.current.scale;
    const dy = (event.clientY - drag.clientY) / viewRef.current.scale;
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
    setDragging(false);
    releaseCapture(event.pointerId);
    if (drag.kind === 'node') {
      onReplace((current) => {
        const node = current.nodes.find((entry) => entry.id === drag.nodeId);
        if (!node || node.type === 'Space') return current;
        const space = containingSpace(current, node);
        return updateNode(current, node.id, (entry) => ({
          ...entry,
          parentId: space?.id,
        }));
      });
      onEndTransaction();
    } else if (drag.kind === 'resize') {
      onEndTransaction();
    }
  };

  const releaseCapture = (pointerId: number) => {
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  };

  const handlePointerCancel = () => {
    dragRef.current = null;
    setDragging(false);
    setConnection(null);
    onCancelTransaction();
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const currentView = viewRef.current;
    const nextScale = Math.min(
      1.8,
      Math.max(0.4, currentView.scale * Math.exp(-event.deltaY * 0.0012)),
    );
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    setView(() => ({
      scale: nextScale,
      x: px - (px - currentView.x) * (nextScale / currentView.scale),
      y: py - (py - currentView.y) * (nextScale / currentView.scale),
    }));
  };

  useEffect(() => {
    if (!menu) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menu]);

  const openMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'create') return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(event.clientX - rect.left, rect.width - 200);
    const y = Math.min(event.clientY - rect.top, rect.height - 220);
    setMenu({
      x,
      y,
      worldX: (x - viewRef.current.x) / viewRef.current.scale,
      worldY: (y - viewRef.current.y) / viewRef.current.scale,
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
    const container = node.type === 'Space' || node.type === 'Place' || node.type === 'Category';
    const selected = selectedNodeId === node.id;
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
      className={`canvas ${mode} ${dragging ? 'is-panning' : ''}`}
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
      onWheel={handleWheel}
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

      <div
        ref={worldRef}
        className="world"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
        }}
      >
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
        <span>Drag to pan</span>
        <span>Scroll to zoom</span>
        {mode === 'create' && <span>Right-click to add</span>}
      </div>
    </div>
  );
}
