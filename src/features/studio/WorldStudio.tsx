import { useCallback, useEffect, useRef, useState } from 'react';
import type { NodeType, World } from '../../domain/types';
import { NODE_GROUPS } from '../../domain/types';
import {
  addRelation,
  createAlias,
  createNode,
  fitView,
  filenameForWorld,
  removeNode,
  removeRelation,
  worldBounds,
  type ViewTransform,
} from '../../domain/world';
import { serializeElsew } from '../../domain/elsew';
import { saveTextFile } from '../../infra/export/save';
import { exportWorldPng } from '../../infra/export/png';
import { Canvas } from './Canvas';
import { ExplorePanel } from './ExplorePanel';
import { Inspector } from './Inspector';
import { Sidebar } from './Sidebar';
import { Toolbar } from './Toolbar';
import { useWorldEditor } from './useWorldEditor';
import type { StudioMode } from './types';
import type { WorldRepository } from '../../domain/repository';
import { TypeIcon } from '../../components/Icon';

interface WorldStudioProps {
  initialWorld: World;
  repository: WorldRepository;
  onBack: () => void;
  onNewWorld: () => void;
}

interface CanvasSize {
  width: number;
  height: number;
}

export function WorldStudio({ initialWorld, repository, onBack, onNewWorld }: WorldStudioProps) {
  const editor = useWorldEditor(initialWorld, repository);
  const { world } = editor;
  const [mode, setMode] = useState<StudioMode>('create');
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [selectedRelationId, setSelectedRelationId] = useState<number | null>(null);
  const [allNodesOpen, setAllNodesOpen] = useState(false);
  const [viewport, setViewport] = useState<CanvasSize>({ width: 0, height: 0 });
  const [view, setView] = useState<ViewTransform>({ x: 0, y: 0, scale: 0.9 });
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const fittedRef = useRef(false);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleViewportChange = useCallback((size: CanvasSize) => {
    setViewport((current) =>
      current.width === size.width && current.height === size.height ? current : size,
    );
  }, []);

  useEffect(() => {
    if (fittedRef.current || viewport.width === 0 || viewport.height === 0) return;
    fittedRef.current = true;
    const bounds = worldBounds(world, world.nodes.length > 0 ? 64 : 0);
    setView(fitView(viewport.width, viewport.height, bounds, 0.9));
  }, [viewport.width, viewport.height, world]);

  const selectedNode = world.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedRelation =
    world.relations.find((relation) => relation.id === selectedRelationId) ?? null;

  const fitCanvas = useCallback(() => {
    if (viewport.width === 0) return;
    setView(
      fitView(
        viewport.width,
        viewport.height,
        worldBounds(world, world.nodes.length > 0 ? 64 : 0),
        1,
      ),
    );
  }, [viewport, world]);

  const zoomBy = useCallback(
    (factor: number) => {
      setView((current) => {
        const nextScale = Math.min(2, Math.max(0.3, current.scale * factor));
        if (nextScale === current.scale) return current;
        const ratio = nextScale / current.scale;
        const centerX = viewport.width / 2;
        const centerY = viewport.height / 2;
        return {
          scale: nextScale,
          x: centerX - (centerX - current.x) * ratio,
          y: centerY - (centerY - current.y) * ratio,
        };
      });
    },
    [viewport],
  );

  const focusNode = useCallback(
    (id: number) => {
      const node = world.nodes.find((entry) => entry.id === id);
      if (!node) return;
      const scale = Math.max(view.scale, 0.9);
      setView({
        scale,
        x: viewport.width / 2 - node.x * scale,
        y: viewport.height / 2 - node.y * scale,
      });
    },
    [world.nodes, view.scale, viewport],
  );

  const handleCreateNode = useCallback(
    (type: NodeType) => {
      const position =
        viewport.width > 0
          ? {
              x: (viewport.width / 2 - view.x) / view.scale,
              y: (viewport.height / 2 - view.y) / view.scale,
            }
          : undefined;
      const node = createNode(world, type, position);
      editor.commit((current) => ({ ...current, nodes: [...current.nodes, node] }));
      setSelectedNodeId(node.id);
      setSelectedRelationId(null);
      setMode('create');
      setQuickAddOpen(false);
    },
    [editor, viewport, view, world],
  );

  const handleCreateAlias = useCallback(() => {
    const node = selectedNode;
    if (!node) return;
    const source =
      node.sourceId !== undefined
        ? (world.nodes.find((entry) => entry.id === node.sourceId) ?? node)
        : node;
    const alias = createAlias(world, source);
    editor.commit((current) => ({ ...current, nodes: [...current.nodes, alias.node] }));
    setSelectedNodeId(alias.node.id);
  }, [editor, selectedNode, world]);

  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId) return;
    editor.commit((current) => removeNode(current, selectedNodeId));
    setSelectedNodeId(null);
    showToast('Node removed');
  }, [editor, selectedNodeId, showToast]);

  const handleDeleteRelation = useCallback(() => {
    if (!selectedRelationId) return;
    editor.commit((current) => removeRelation(current, selectedRelationId));
    setSelectedRelationId(null);
    showToast('Relation removed');
  }, [editor, selectedRelationId, showToast]);

  const handleAddRelation = useCallback(
    (from: number, to: number) => {
      const next = addRelation(world, from, to);
      if (!next) {
        showToast('Those nodes are already connected');
        return;
      }
      editor.commit(() => next);
      const created = next.relations[next.relations.length - 1];
      setSelectedRelationId(created.id);
      setSelectedNodeId(null);
      showToast('Nodes connected');
    },
    [editor, showToast, world],
  );

  const saveElsew = useCallback(async () => {
    try {
      const text = serializeElsew(world);
      const saved = await saveTextFile(text, filenameForWorld(world.name, 'elsew'), {
        title: 'Save Elsewhere World',
        defaultPath: filenameForWorld(world.name, 'elsew'),
        filters: [{ name: 'Elsewhere world', extensions: ['elsew'] }],
      });
      if (saved) showToast('World saved as .elsew');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The .elsew file could not be saved.');
    }
  }, [showToast, world]);

  const savePng = useCallback(async () => {
    if (!worldRef.current || world.nodes.length === 0) {
      showToast('Add a node before exporting an image.');
      return;
    }
    try {
      const saved = await exportWorldPng(worldRef.current, world);
      if (saved) showToast('World exported as PNG');
    } catch (error) {
      console.error(error);
      showToast('The PNG could not be created.');
    }
  }, [showToast, world]);

  const handleBack = useCallback(async () => {
    const saved = await editor.flush();
    if (saved) onBack();
    else showToast('This world could not be saved. Try again.');
  }, [editor, onBack, showToast]);

  const handleModeChange = useCallback((next: StudioMode) => {
    setMode(next);
    setQuickAddOpen(false);
    if (next === 'explore') setSelectedRelationId(null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editingText =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;

      if (event.key === 'Escape') {
        if (quickAddOpen) {
          setQuickAddOpen(false);
          return;
        }
        setSelectedNodeId(null);
        setSelectedRelationId(null);
        return;
      }

      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        void editor.flush().then((saved) => {
          if (saved) onNewWorld();
          else showToast('This world could not be saved. Try again.');
        });
        return;
      }
      if (command && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (event.shiftKey) void saveElsew();
        else
          void editor.flush().then((saved) => showToast(saved ? 'Saved locally' : 'Save failed'));
        return;
      }
      if (command && event.shiftKey && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        void saveElsew();
        return;
      }
      if (command && event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        void savePng();
        return;
      }
      if (command && event.shiftKey && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        setMode((current) => (current === 'create' ? 'explore' : 'create'));
        return;
      }
      if (command && (event.key === '=' || event.key === '+')) {
        event.preventDefault();
        zoomBy(1.2);
        return;
      }
      if (command && event.key === '-') {
        event.preventDefault();
        zoomBy(1 / 1.2);
        return;
      }
      if (command && event.key === '0') {
        event.preventDefault();
        fitCanvas();
        return;
      }
      if (command && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        const active = document.activeElement;
        const editingValue =
          active instanceof HTMLElement &&
          (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
        if (editingValue) {
          document.execCommand(event.shiftKey ? 'redo' : 'undo');
        } else if (event.shiftKey) {
          editor.redo();
        } else {
          editor.undo();
        }
        return;
      }

      if (editingText) return;

      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setQuickAddOpen(true);
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNodeId) {
        event.preventDefault();
        handleDeleteNode();
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedRelationId) {
        event.preventDefault();
        handleDeleteRelation();
        return;
      }
      if (event.key === 'Enter' && selectedNodeId) {
        const node = world.nodes.find((entry) => entry.id === selectedNodeId);
        if (node && node.sourceId === undefined && !event.shiftKey) {
          event.preventDefault();
          handleCreateAlias();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    editor,
    fitCanvas,
    handleCreateAlias,
    handleDeleteNode,
    handleDeleteRelation,
    quickAddOpen,
    saveElsew,
    savePng,
    selectedNodeId,
    selectedRelationId,
    showToast,
    world.nodes,
    zoomBy,
    onNewWorld,
  ]);

  useEffect(() => {
    const handler = (event: Event) => {
      const command = (event as CustomEvent<string>).detail;
      if (command === 'new-world') {
        void editor.flush().then((saved) => {
          if (saved) onNewWorld();
          else showToast('This world could not be saved. Try again.');
        });
        return;
      }
      if (command === 'save') {
        void editor.flush().then((saved) => showToast(saved ? 'Saved locally' : 'Save failed'));
      }
      if (command === 'export-elsew') void saveElsew();
      if (command === 'export-png') void savePng();
      if (command === 'undo' || command === 'redo') {
        const active = document.activeElement;
        const editingValue =
          active instanceof HTMLElement &&
          (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
        if (editingValue) {
          document.execCommand(command);
        } else if (command === 'undo') {
          editor.undo();
        } else {
          editor.redo();
        }
      }
      if (command === 'zoom-in') zoomBy(1.2);
      if (command === 'zoom-out') zoomBy(1 / 1.2);
      if (command === 'fit') fitCanvas();
      if (command === 'toggle-explore')
        setMode((current) => (current === 'create' ? 'explore' : 'create'));
    };
    window.addEventListener('elsewhere:command', handler);
    return () => window.removeEventListener('elsewhere:command', handler);
  }, [editor, fitCanvas, onNewWorld, saveElsew, savePng, showToast, zoomBy]);

  return (
    <div className={`app-shell studio ${mode}`}>
      <Toolbar
        world={world}
        mode={mode}
        zoom={view.scale}
        saveStatus={editor.saveStatus}
        saveError={editor.saveError}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onBack={() => void handleBack()}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onZoomIn={() => zoomBy(1.2)}
        onZoomOut={() => zoomBy(1 / 1.2)}
        onFit={fitCanvas}
        onModeChange={handleModeChange}
        onRenameWorld={(name) =>
          editor.commit((current) => (current.name === name ? current : { ...current, name }))
        }
        onSaveElsew={() => void saveElsew()}
        onExportPng={() => void savePng()}
        onQuickAdd={() => setQuickAddOpen(true)}
      />
      <div
        className={`workspace ${mode} ${selectedNode || selectedRelation ? 'has-selection' : ''}`}
      >
        {mode === 'create' && (
          <Sidebar
            world={world}
            selectedNodeId={selectedNodeId}
            allNodesOpen={allNodesOpen}
            onToggleAllNodes={() => setAllNodesOpen((open) => !open)}
            onSelectWorld={() => setAllNodesOpen(false)}
            onSelectNode={(id) => {
              setSelectedNodeId(id);
              setSelectedRelationId(null);
              focusNode(id);
            }}
            onCreateNode={handleCreateNode}
          />
        )}
        <Canvas
          world={world}
          mode={mode}
          view={view}
          setView={setView}
          onViewportChange={handleViewportChange}
          selectedNodeId={selectedNodeId}
          selectedRelationId={selectedRelationId}
          onSelectNode={(id) => {
            setSelectedNodeId(id);
            if (id !== null) setSelectedRelationId(null);
          }}
          onSelectRelation={(id) => {
            setSelectedRelationId(id);
            if (id !== null) setSelectedNodeId(null);
          }}
          onBeginTransaction={editor.beginTransaction}
          onEndTransaction={editor.endTransaction}
          onCancelTransaction={editor.cancelTransaction}
          onReplace={editor.replace}
          onCommit={editor.commit}
          onCreateNode={handleCreateNode}
          onAddRelation={handleAddRelation}
          worldRef={worldRef}
        />
        {mode === 'create' && (
          <Inspector
            key={
              selectedRelation
                ? `relation-${selectedRelation.id}`
                : selectedNode
                  ? `node-${selectedNode.id}`
                  : 'none'
            }
            world={world}
            selectedNode={selectedNode}
            selectedRelation={selectedRelation}
            onBeginTransaction={editor.beginTransaction}
            onEndTransaction={editor.endTransaction}
            onReplace={editor.replace}
            onCommit={editor.commit}
            onCreateAlias={handleCreateAlias}
            onDeleteNode={handleDeleteNode}
            onDeleteRelation={handleDeleteRelation}
            onFocusNode={focusNode}
          />
        )}
      </div>

      {mode === 'explore' && selectedNode && (
        <ExplorePanel world={world} node={selectedNode} onClose={() => setSelectedNodeId(null)} />
      )}

      {quickAddOpen && (
        <div
          className="quick-palette-backdrop"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setQuickAddOpen(false);
          }}
        >
          <div className="quick-palette" role="dialog" aria-label="Quick add node">
            <div className="quick-palette-heading">
              <span className="eyebrow">Quick add</span>
              <h2>What takes shape?</h2>
              <button
                type="button"
                onClick={() => setQuickAddOpen(false)}
                aria-label="Close quick add"
              >
                ✕
              </button>
            </div>
            <div className="quick-palette-groups">
              {NODE_GROUPS.map((group) => (
                <div key={group.id}>
                  <p className="quick-palette-label">{group.label}</p>
                  <div className="quick-palette-grid">
                    {group.types.map((type) => (
                      <button type="button" key={type} onClick={() => handleCreateNode(type)}>
                        <span className={`type-icon ${type.toLowerCase()}`}>
                          <TypeIcon type={type} size={16} />
                        </span>
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="quick-palette-foot">
              <kbd>N</kbd> opens this palette · <kbd>Esc</kbd> closes it
            </p>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
