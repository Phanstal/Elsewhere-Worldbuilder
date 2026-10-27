import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import type { NodeType, Relation, World, WorldNode } from '../../domain/types';
import {
  clampZoom,
  nodeVisualSize,
  renameRelation,
  updateNode,
  type ViewTransform,
} from '../../domain/world';
import { TypeIcon } from '../../components/Icon';

type Mode = 'create' | 'explore';

interface CanvasSize {
  width: number;
  height: number;
}

interface CanvasProps {
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
  onCreateNode: (type: NodeType) => void;
  onAddRelation: (from: number, to: number) => void;
  worldRef: RefObject<HTMLDivElement | null>;
}

interface DragState {
  kind: 'pan' | 'node' | 'resize';
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startView: ViewTransform;
  nodeId?: number;
  startNodeX?: number;
  startNodeY?: number;
  startWidth?: number;
  startHeight?: number;
}

interface ConnectionState {
  fromId: number;
  side: 'left' | 'right';
  current: { x: number; y: number };
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

function connectionPoint(
  source: WorldNode,
  side: 'left' | 'right',
  target: { x: number; y: number },
): { path: string; point: { x: number; y: number } } {
  const size = nodeVisualSize(source);
  const startX = side === 'right' ? source.x + size.width / 2 : source.x - size.width / 2;
  const startY = source.y;
  const forward = target.x >= startX;
  const direction = side === 'right' ? 1 : -1;
  const handle = Math.max(45, Math.abs(target.x - startX) * 0.55);
  const c1 = startX + handle * direction;
  const c2 = target.x - handle * (forward ? 1 : -1);
  return {
    path: `M ${startX} ${startY} C ${c1} ${startY}, ${c2} ${target.y}, ${target.x} ${target.y}`,
    point: { x: startX, y: startY },
  };
}

export function Canvas({
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
  onCreateNode,
  onAddRelation,
  worldRef,
}: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  const worldRefInternal = useRef(world);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useEffect(() => {
    worldRefInternal.current = world;
  }, [world]);

  const dragRef = useRef<DragState | null>(null);
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const connectionRef = useRef<ConnectionState | null>(null);
  useEffect(() => {
    connectionRef.current = connection;
  }, [connection]);
  const [interacting, setInteracting] = useState(false);
  const [editingRelationId, setEditingRelationId] = useState<number | null>(null);
  const [relationDraft, setRelationDraft] = useState('');
  const [inlineTitleId, setInlineTitleId] = useState<number | null>(null);
  const [titleDraft, setTitleDraft] = useState('');

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      onViewportChange({
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [onViewportChange]);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const current = viewRef.current;
      const factor = Math.exp(-event.deltaY * 0.0014);
      const nextScale = clampZoom(current.scale * factor);
      if (nextScale === current.scale) return;
      const ratio = nextScale / current.scale;
      setView(() => ({
        scale: nextScale,
        x: pointerX - (pointerX - current.x) * ratio,
        y: pointerY - (pointerY - current.y) * ratio,
      }));
    };
    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, [setView]);

  const beginDrag = useCallback(
    (
      event: ReactPointerEvent,
      state: Omit<DragState, 'pointerId' | 'startClientX' | 'startClientY' | 'startView'>,
    ) => {
      if (event.button !== 0) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture(event.pointerId);
      dragRef.current = {
        ...state,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startView: viewRef.current,
      };
      setInteracting(true);
    },
    [],
  );

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (mode === 'explore') {
      onSelectNode(null);
      onSelectRelation(null);
      beginDrag(event, { kind: 'pan' });
      return;
    }
    onSelectNode(null);
    onSelectRelation(null);
    setEditingRelationId(null);
    beginDrag(event, { kind: 'pan' });
  };

  const handleNodePointerDown = (event: ReactPointerEvent<HTMLDivElement>, node: WorldNode) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (mode === 'explore') {
      onSelectNode(node.id);
      return;
    }
    if (
      (event.target as HTMLElement).closest('.relation-port, .resize-handle, .node-title-input')
    ) {
      return;
    }
    onSelectNode(node.id);
    onSelectRelation(null);
    onBeginTransaction();
    beginDrag(event, {
      kind: 'node',
      nodeId: node.id,
      startNodeX: node.x,
      startNodeY: node.y,
    });
  };

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLSpanElement>, node: WorldNode) => {
    if (event.button !== 0 || mode === 'explore') return;
    event.stopPropagation();
    const size = nodeVisualSize(node);
    onSelectNode(node.id);
    onBeginTransaction();
    beginDrag(event, {
      kind: 'resize',
      nodeId: node.id,
      startWidth: size.width,
      startHeight: size.height,
    });
  };

  const handlePortPointerDown = (
    event: ReactPointerEvent<HTMLSpanElement>,
    node: WorldNode,
    side: 'left' | 'right',
  ) => {
    if (event.button !== 0 || mode === 'explore') return;
    event.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    const rect = canvas.getBoundingClientRect();
    const currentView = viewRef.current;
    const worldPoint = {
      x: (event.clientX - rect.left - currentView.x) / currentView.scale,
      y: (event.clientY - rect.top - currentView.y) / currentView.scale,
    };
    setConnection({ fromId: node.id, side, current: worldPoint });
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const currentView = viewRef.current;

    if (connection) {
      const rect = canvas.getBoundingClientRect();
      setConnection({
        ...connection,
        current: {
          x: (event.clientX - rect.left - currentView.x) / currentView.scale,
          y: (event.clientY - rect.top - currentView.y) / currentView.scale,
        },
      });
      return;
    }

    if (!drag) return;
    if (drag.kind === 'pan') {
      setView(() => ({
        scale: drag.startView.scale,
        x: drag.startView.x + event.clientX - drag.startClientX,
        y: drag.startView.y + event.clientY - drag.startClientY,
      }));
      return;
    }
    if (drag.nodeId === undefined) return;
    const dx = (event.clientX - drag.startClientX) / currentView.scale;
    const dy = (event.clientY - drag.startClientY) / currentView.scale;
    if (drag.kind === 'node') {
      const x = Math.round((drag.startNodeX ?? 0) + dx);
      const y = Math.round((drag.startNodeY ?? 0) + dy);
      onReplace((current) => updateNode(current, drag.nodeId!, (node) => ({ ...node, x, y })));
    } else if (drag.kind === 'resize') {
      const width = Math.min(2400, Math.max(120, Math.round((drag.startWidth ?? 120) + dx)));
      const height = Math.min(1800, Math.max(90, Math.round((drag.startHeight ?? 90) + dy)));
      onReplace((current) =>
        updateNode(current, drag.nodeId!, (node) => ({ ...node, width, height })),
      );
    }
  };

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
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
      if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      return;
    }
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    setInteracting(false);
    if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (drag.kind === 'node' || drag.kind === 'resize') onEndTransaction();
  };

  const cancelPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setInteracting(false);
    setConnection(null);
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (drag && (drag.kind === 'node' || drag.kind === 'resize')) onCancelTransaction();
  };

  const handleNodeDoubleClick = (node: WorldNode) => {
    if (mode === 'explore') return;
    onSelectNode(node.id);
    onSelectRelation(null);
    if (node.type !== 'Image') {
      setInlineTitleId(node.id);
      setTitleDraft(node.title);
    }
  };

  const commitInlineTitle = () => {
    if (inlineTitleId === null) return;
    const id = inlineTitleId;
    const nextTitle = titleDraft.trim().slice(0, 120) || 'Untitled';
    setInlineTitleId(null);
    onCommit((current) =>
      updateNode(current, id, (node) =>
        node.title === nextTitle ? node : { ...node, title: nextTitle },
      ),
    );
  };

  const startRelationEdit = (relation: Relation) => {
    onSelectRelation(relation.id);
    onSelectNode(null);
    setEditingRelationId(relation.id);
    setRelationDraft(relation.name);
  };

  const commitRelationEdit = () => {
    if (editingRelationId === null) return;
    const id = editingRelationId;
    const name = relationDraft.trim().slice(0, 80) || 'Relation';
    setEditingRelationId(null);
    onCommit((current) =>
      current.relations.some((relation) => relation.id === id && relation.name === name)
        ? current
        : renameRelation(current, id, name),
    );
  };

  const nodeById = useMemo(
    () => new Map(world.nodes.map((node) => [node.id, node])),
    [world.nodes],
  );

  const relationLabel = useMemo(() => {
    if (editingRelationId === null) return null;
    const relation = world.relations.find((entry) => entry.id === editingRelationId);
    if (!relation) return null;
    const source = nodeById.get(relation.from);
    const target = nodeById.get(relation.to);
    if (!source || !target) return null;
    const geometry = relationGeometry(source, target);
    return {
      left: view.x + geometry.labelX * view.scale,
      top: view.y + geometry.labelY * view.scale,
    };
  }, [editingRelationId, world.relations, nodeById, view]);

  return (
    <div
      ref={canvasRef}
      className={`canvas ${mode} ${world.nodes.length === 0 && mode === 'create' ? 'is-empty' : ''}`}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={cancelPointer}
      data-testid="canvas"
    >
      <div className="canvas-label">
        <strong>{mode === 'explore' ? 'Exploring World' : 'World'}</strong>
        <span>
          {world.nodes.length} {world.nodes.length === 1 ? 'node' : 'nodes'}
        </span>
      </div>

      <div className="canvas-viewport">
        <div
          className="world"
          ref={worldRef}
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transition: interacting || connection ? 'none' : undefined,
          }}
        >
          <svg className="relation-lines" viewBox="0 0 1100 680" aria-hidden="true">
            {world.relations.map((relation) => {
              const source = nodeById.get(relation.from);
              const target = nodeById.get(relation.to);
              if (!source || !target) return null;
              const geometry = relationGeometry(source, target);
              return (
                <g
                  key={relation.id}
                  className={selectedRelationId === relation.id ? 'active' : undefined}
                >
                  <path d={geometry.path} />
                  <path
                    className="relation-hit"
                    d={geometry.path}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      onSelectRelation(relation.id);
                      onSelectNode(null);
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      startRelationEdit(relation);
                    }}
                  />
                  <text
                    className="relation-name"
                    x={geometry.labelX}
                    y={geometry.labelY}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      onSelectRelation(relation.id);
                      onSelectNode(null);
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      startRelationEdit(relation);
                    }}
                  >
                    {relation.name}
                  </text>
                </g>
              );
            })}
            {connection &&
              (() => {
                const source = nodeById.get(connection.fromId);
                if (!source) return null;
                const preview = connectionPoint(source, connection.side, connection.current);
                return <path className="relation-preview" d={preview.path} />;
              })()}
          </svg>

          {world.nodes.map((node) => {
            const meta = node.type;
            const isContainer = node.type === 'Place' || node.type === 'Category';
            const isSelected = selectedNodeId === node.id;
            const size = nodeVisualSize(node);
            return (
              <div
                key={node.id}
                role="button"
                tabIndex={0}
                data-node-id={node.id}
                className={`world-node shape-${meta.toLowerCase()} ${isSelected ? 'selected' : ''} ${
                  mode === 'explore' ? 'explore-node' : ''
                }`}
                style={{
                  left: node.x,
                  top: node.y,
                  ...(isContainer ? { width: size.width, height: size.height } : {}),
                }}
                onPointerDown={(event) => handleNodePointerDown(event, node)}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  handleNodeDoubleClick(node);
                }}
                aria-label={`${node.title}, ${node.type}`}
              >
                {node.type === 'Image' ? (
                  <div className="image-node-placeholder">
                    <TypeIcon type="Image" size={24} />
                    <small>IMAGE</small>
                  </div>
                ) : (
                  <span className="node-content">
                    <span className={`node-symbol ${meta.toLowerCase()}`}>
                      <TypeIcon type={meta} size={18} />
                    </span>
                    <span className="node-copy">
                      {inlineTitleId === node.id ? (
                        <input
                          className="node-title-input"
                          value={titleDraft}
                          autoFocus
                          onFocus={(event) => event.currentTarget.select()}
                          onChange={(event) => setTitleDraft(event.target.value)}
                          onBlur={commitInlineTitle}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              commitInlineTitle();
                            }
                            if (event.key === 'Escape') {
                              event.preventDefault();
                              setInlineTitleId(null);
                            }
                          }}
                          onPointerDown={(event) => event.stopPropagation()}
                          aria-label="Node title"
                        />
                      ) : (
                        <strong>{node.title}</strong>
                      )}
                      <small>{meta}</small>
                    </span>
                  </span>
                )}
                {node.sourceId !== undefined && (
                  <span className="alias-mark" title="Alias" aria-hidden="true">
                    <i />
                    <i />
                  </span>
                )}
                {mode === 'create' && (
                  <>
                    <span
                      className="relation-port left"
                      onPointerDown={(event) => handlePortPointerDown(event, node, 'left')}
                      title="Drag to connect"
                    />
                    <span
                      className="relation-port right"
                      onPointerDown={(event) => handlePortPointerDown(event, node, 'right')}
                      title="Drag to connect"
                    />
                    {isContainer && (
                      <span
                        className="resize-handle"
                        onPointerDown={(event) => handleResizePointerDown(event, node)}
                        title="Resize"
                      />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {world.nodes.length === 0 && (
        <div
          className={`empty-state ${mode === 'explore' ? 'explore-empty' : ''}`}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="empty-orbit" aria-hidden="true">
            <i />
          </div>
          <h2>
            {mode === 'explore' ? 'Nothing to explore yet.' : 'Every world begins somewhere.'}
          </h2>
          <p>
            {mode === 'explore'
              ? 'Switch to Create and place a first node.'
              : 'Start with a place, a character, or an idea.\nGive it room to grow.'}
          </p>
          {mode === 'create' && (
            <button type="button" onClick={() => onCreateNode('Place')}>
              Create your first node
            </button>
          )}
        </div>
      )}

      {connection && (
        <div className="connection-hint" aria-hidden="true">
          Drop on a node to connect
        </div>
      )}

      {relationLabel && (
        <input
          className="relation-name-input"
          style={{ left: relationLabel.left, top: relationLabel.top }}
          value={relationDraft}
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setRelationDraft(event.target.value)}
          onBlur={commitRelationEdit}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitRelationEdit();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              setEditingRelationId(null);
            }
          }}
          aria-label="Relation name"
        />
      )}

      <div className="canvas-help">
        <span>Drag to pan</span>
        <span>Scroll to zoom</span>
      </div>
    </div>
  );
}
