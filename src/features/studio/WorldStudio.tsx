import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CREATE_TYPES, type CreateType, type World, type WorldNode } from '../../domain/types';
import {
  activateSnapshot,
  addRelation,
  containingSpace,
  createAlias,
  createNode,
  filenameForWorld,
  fitView,
  normalizeWorldSnapshots,
  removeNode,
  removeRelation,
  snapshotIndex,
  syncActiveSnapshot,
  updateNode,
  worldBounds,
  type ViewTransform,
} from '../../domain/world';
import { serializeElsew } from '../../domain/elsew';
import { saveTextFile } from '../../infra/export/save';
import { exportWorldPng } from '../../infra/export/png';
import { Icon, TypeIcon } from '../../components/Icon';
import { ExplorePanel } from './ExplorePanel';
import { StudioCanvas } from './StudioCanvas';
import { StudioInspector } from './StudioInspector';
import { StudioSidebar } from './StudioSidebar';
import { StudioTimeline } from './StudioTimeline';
import { StudioToolbar } from './StudioToolbar';
import { useWorldEditor } from './useWorldEditor';
import type { StudioMode } from './types';
import type { WorldRepository } from '../../domain/repository';

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

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The image could not be read.'));
    reader.readAsDataURL(file);
  });
}

export function WorldStudio({ initialWorld, repository, onBack, onNewWorld }: WorldStudioProps) {
  const preparedWorld = useMemo(
    () => syncActiveSnapshot(normalizeWorldSnapshots(initialWorld)),
    [initialWorld],
  );
  const editor = useWorldEditor(preparedWorld, repository);
  const { world, commit: pushCommit, replace: pushReplace } = editor;
  const [mode, setMode] = useState<StudioMode>('create');
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [selectedRelationId, setSelectedRelationId] = useState<number | null>(null);
  const [allNodesOpen, setAllNodesOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [viewport, setViewport] = useState<CanvasSize>({ width: 0, height: 0 });
  const [view, setView] = useState<ViewTransform>({ x: 0, y: 0, scale: 0.9 });
  const [toast, setToast] = useState<string | null>(null);
  const [activeTimeIndex, setActiveTimeIndex] = useState(() => snapshotIndex(preparedWorld));
  const worldRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(snapshotIndex(preparedWorld));
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

  useEffect(() => {
    const index = snapshotIndex(world);
    if (index !== activeIndexRef.current) {
      activeIndexRef.current = index;
      setActiveTimeIndex(index);
    }
  }, [world, world.activeSnapshotId, world.snapshots]);

  const commit = useCallback(
    (updater: (current: World) => World) => {
      pushCommit((current) => {
        const next = updater(current);
        if (next === current) return current;
        return syncActiveSnapshot(next, activeIndexRef.current);
      });
    },
    [pushCommit],
  );

  const replace = useCallback(
    (updater: (current: World) => World) => {
      pushReplace((current) => {
        const next = updater(current);
        if (next === current) return current;
        return syncActiveSnapshot(next, activeIndexRef.current);
      });
    },
    [pushReplace],
  );

  const handleViewportChange = useCallback((size: CanvasSize) => {
    setViewport((current) =>
      current.width === size.width && current.height === size.height ? current : size,
    );
  }, []);

  useEffect(() => {
    if (fittedRef.current || viewport.width === 0 || viewport.height === 0) return;
    fittedRef.current = true;
    const bounds = worldBounds(world, world.nodes.length > 0 ? 72 : 0);
    setView(fitView(viewport.width, viewport.height, bounds, 0.9));
  }, [viewport.width, viewport.height, world]);

  const selectedNode = world.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedRelation =
    world.relations.find((relation) => relation.id === selectedRelationId) ?? null;
  const snapshots = world.snapshots ?? [];

  const fitCanvas = useCallback(() => {
    if (viewport.width === 0) return;
    setView(
      fitView(
        viewport.width,
        viewport.height,
        worldBounds(world, world.nodes.length > 0 ? 72 : 0),
        1,
      ),
    );
  }, [viewport, world]);

  const zoomBy = useCallback(
    (factor: number) => {
      setView((current) => {
        const nextScale = Math.min(1.8, Math.max(0.4, current.scale * factor));
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

  const viewportCenter = useCallback(() => {
    if (viewport.width === 0) return { x: 550, y: 340 };
    return {
      x: (viewport.width / 2 - view.x) / view.scale,
      y: (viewport.height / 2 - view.y) / view.scale,
    };
  }, [viewport, view]);

  const handleAddNode = useCallback(
    (type: CreateType, x?: number, y?: number) => {
      const center = viewportCenter();
      const count = world.nodes.length;
      const placements = [
        { x: 0, y: 0 },
        { x: 130, y: 70 },
        { x: -130, y: -70 },
        { x: 250, y: 140 },
        { x: -250, y: -140 },
        { x: 0, y: 150 },
        { x: 0, y: -150 },
        { x: 260, y: 0 },
        { x: -260, y: 0 },
      ];
      const offset = x === undefined ? placements[count % placements.length] : { x: 0, y: 0 };
      const position = {
        x: x ?? center.x + offset.x,
        y: y ?? center.y + offset.y,
      };
      const node = createNode(world, type, position);
      const space = type === 'Space' ? undefined : containingSpace(world, node);
      const nextNode = space ? { ...node, parentId: space.id } : node;
      commit((current) => ({ ...current, nodes: [...current.nodes, nextNode] }));
      setSelectedNodeId(nextNode.id);
      setSelectedRelationId(null);
      setMode('create');
      setAllNodesOpen(false);
      setQuickAddOpen(false);
    },
    [commit, viewportCenter, world],
  );

  const handleAddImage = useCallback(
    async (file: File, x: number, y: number) => {
      try {
        const source = await readImageFile(file);
        const node = createNode(world, 'Image', { x, y });
        const space = containingSpace(world, node);
        const imageNode: WorldNode = { ...node, imageSrc: source, parentId: space?.id };
        commit((current) => ({ ...current, nodes: [...current.nodes, imageNode] }));
        setSelectedNodeId(imageNode.id);
        setSelectedRelationId(null);
        showToast('Image added');
      } catch {
        showToast('The image could not be read.');
      }
    },
    [commit, showToast, world],
  );

  const handleSetImage = useCallback(
    async (file: File) => {
      if (!selectedNodeId) return;
      try {
        const source = await readImageFile(file);
        commit((current) =>
          updateNode(current, selectedNodeId, (node) => ({ ...node, imageSrc: source })),
        );
        showToast('Image updated');
      } catch {
        showToast('The image could not be read.');
      }
    },
    [commit, selectedNodeId, showToast],
  );

  const handleCreateAlias = useCallback(() => {
    const node = selectedNode;
    if (!node) return;
    const source =
      node.sourceId !== undefined
        ? (world.nodes.find((entry) => entry.id === node.sourceId) ?? node)
        : node;
    const alias = createAlias(world, source, {
      x: source.x + 150 + (world.nodes.length % 3) * 24,
      y: source.y + 90,
    });
    commit((current) => ({ ...current, nodes: [...current.nodes, alias.node] }));
    setSelectedNodeId(alias.node.id);
    showToast('Alias created');
  }, [commit, selectedNode, showToast, world]);

  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId) return;
    commit((current) => removeNode(current, selectedNodeId));
    setSelectedNodeId(null);
    showToast('Node removed');
  }, [commit, selectedNodeId, showToast]);

  const handleDeleteRelation = useCallback(() => {
    if (!selectedRelationId) return;
    commit((current) => removeRelation(current, selectedRelationId));
    setSelectedRelationId(null);
    showToast('Relation removed');
  }, [commit, selectedRelationId, showToast]);

  const handleAddRelation = useCallback(
    (from: number, to: number) => {
      const next = addRelation(world, from, to);
      if (!next) {
        showToast('Those nodes are already connected');
        return;
      }
      commit(() => next);
      const created = next.relations[next.relations.length - 1];
      setSelectedRelationId(created.id);
      setSelectedNodeId(null);
      showToast('Nodes connected');
    },
    [commit, showToast, world],
  );

  const handleTimeSelect = useCallback(
    (index: number) => {
      if (index === activeIndexRef.current) return;
      const next = activateSnapshot(world, index);
      activeIndexRef.current = index;
      setActiveTimeIndex(index);
      setSelectedNodeId(null);
      setSelectedRelationId(null);
      editor.commit(() => next);
    },
    [editor, world],
  );

  const handleTimeAdd = useCallback(() => {
    const currentSnapshots = world.snapshots ?? [];
    if (currentSnapshots.length >= 3) return;
    const synced = syncActiveSnapshot(world, activeIndexRef.current);
    const syncedSnapshots = synced.snapshots ?? [];
    const snapshotId = crypto.randomUUID();
    const label = `Time ${Math.min(3, syncedSnapshots.length + 1)}`;
    const nextSnapshots = [
      ...syncedSnapshots,
      {
        id: snapshotId,
        label,
        nodes: structuredClone(synced.nodes),
        relations: structuredClone(synced.relations),
      },
    ];
    const next: World = {
      ...synced,
      snapshots: nextSnapshots,
      activeSnapshotId: snapshotId,
      nodes: structuredClone(synced.nodes),
      relations: structuredClone(synced.relations),
    };
    const index = nextSnapshots.length - 1;
    activeIndexRef.current = index;
    setActiveTimeIndex(index);
    setSelectedNodeId(null);
    setSelectedRelationId(null);
    editor.commit(() => next);
  }, [editor, world]);

  const handleTimeDelete = useCallback(() => {
    const currentSnapshots = world.snapshots ?? [];
    if (currentSnapshots.length <= 1) return;
    const synced = syncActiveSnapshot(world, activeIndexRef.current);
    const syncedSnapshots = synced.snapshots ?? [];
    const deleteIndex = activeIndexRef.current;
    const nextSnapshots = syncedSnapshots.filter((_, index) => index !== deleteIndex);
    if (nextSnapshots.length === 0) return;
    const nextIndex = Math.max(0, Math.min(deleteIndex - 1, nextSnapshots.length - 1));
    const target = nextSnapshots[nextIndex];
    const next: World = {
      ...synced,
      snapshots: nextSnapshots,
      activeSnapshotId: target.id,
      nodes: structuredClone(target.nodes),
      relations: structuredClone(target.relations),
    };
    activeIndexRef.current = nextIndex;
    setActiveTimeIndex(nextIndex);
    setSelectedNodeId(null);
    setSelectedRelationId(null);
    editor.commit(() => next);
    showToast('Time node removed');
  }, [editor, showToast, world]);

  const handleTimeRename = useCallback(
    (label: string) => {
      const clean = label.trim().slice(0, 40) || 'Time';
      commit((current) => ({
        ...current,
        snapshots: (current.snapshots ?? []).map((snapshot, index) =>
          index === activeIndexRef.current ? { ...snapshot, label: clean } : snapshot,
        ),
      }));
    },
    [commit],
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
    setAllNodesOpen(false);
    setSelectedRelationId(null);
    if (next === 'create') setSelectedNodeId(null);
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
        if (allNodesOpen) {
          setAllNodesOpen(false);
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
      if (command && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        handleCreateAlias();
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
      if (!command && !editingText && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setQuickAddOpen(true);
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
      if (event.key === 'Enter' && selectedNodeId && !event.shiftKey) {
        const node = world.nodes.find((entry) => entry.id === selectedNodeId);
        if (node && node.sourceId === undefined) {
          event.preventDefault();
          handleCreateAlias();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    allNodesOpen,
    editor,
    fitCanvas,
    handleCreateAlias,
    handleDeleteNode,
    handleDeleteRelation,
    onNewWorld,
    quickAddOpen,
    saveElsew,
    savePng,
    selectedNodeId,
    selectedRelationId,
    showToast,
    world.nodes,
    zoomBy,
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
    <div className={`app-shell studio studio-v2 ${mode}`}>
      <StudioToolbar
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
          commit((current) => (current.name === name ? current : { ...current, name }))
        }
        onSaveElsew={() => void saveElsew()}
        onExportPng={() => void savePng()}
        onQuickAdd={() => setQuickAddOpen(true)}
      />
      <div
        className={`workspace ${mode} ${selectedNode || selectedRelation ? 'has-selection' : ''}`}
      >
        {mode === 'create' && (
          <StudioSidebar
            nodes={world.nodes}
            selectedNodeId={selectedNodeId}
            allNodesOpen={allNodesOpen}
            search={search}
            onSearch={setSearch}
            onToggleAllNodes={() => setAllNodesOpen((open) => !open)}
            onAdd={handleAddNode}
            onSelectNode={(id) => {
              setSelectedNodeId(id);
              setSelectedRelationId(null);
              setMode('create');
              focusNode(id);
            }}
          />
        )}
        <StudioCanvas
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
          onReplace={replace}
          onCommit={commit}
          onAddNode={handleAddNode}
          onAddImage={(file, x, y) => void handleAddImage(file, x, y)}
          onAddRelation={handleAddRelation}
          onOpenNode={(id) => {
            setSelectedNodeId(id);
            setSelectedRelationId(null);
          }}
          worldRef={worldRef}
          timeline={
            <StudioTimeline
              snapshots={snapshots}
              activeIndex={activeTimeIndex}
              onSelect={handleTimeSelect}
              onAdd={handleTimeAdd}
              onDelete={handleTimeDelete}
              onRename={handleTimeRename}
            />
          }
        />
        {mode === 'create' && (
          <StudioInspector
            key={
              selectedRelation
                ? `relation-${selectedRelation.id}`
                : selectedNode
                  ? `node-${selectedNode.id}`
                  : 'none'
            }
            world={world}
            node={selectedNode}
            relation={selectedRelation}
            onBeginTransaction={editor.beginTransaction}
            onEndTransaction={editor.endTransaction}
            onReplace={replace}
            onCommit={commit}
            onCreateAlias={handleCreateAlias}
            onDeleteNode={handleDeleteNode}
            onDeleteRelation={handleDeleteRelation}
            onFocusNode={focusNode}
            onSetImage={(file) => void handleSetImage(file)}
            onClose={() => {
              setSelectedNodeId(null);
              setSelectedRelationId(null);
            }}
          />
        )}
      </div>

      {mode === 'explore' && selectedNode && (
        <ExplorePanel world={world} node={selectedNode} onClose={() => setSelectedNodeId(null)} />
      )}

      {quickAddOpen && (
        <div
          className="quick-palette-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setQuickAddOpen(false);
          }}
        >
          <div className="quick-palette" role="dialog" aria-label="Quick add node">
            <div className="quick-palette-heading">
              <h2>Create</h2>
              <button
                type="button"
                onClick={() => setQuickAddOpen(false)}
                aria-label="Close quick add"
              >
                <Icon name="close" />
              </button>
            </div>
            <p className="quick-palette-label">Add to this world</p>
            <div className="quick-palette-grid">
              {CREATE_TYPES.map((type) => (
                <button type="button" key={type} onClick={() => handleAddNode(type)}>
                  <span className={`type-icon ${type.toLowerCase()}`}>
                    <TypeIcon type={type} size={17} />
                  </span>
                  {type}
                </button>
              ))}
            </div>
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
