import { useEffect, useRef, useState } from 'react';
import {
  NODE_TYPES,
  NODE_TYPE_META,
  type Relation,
  type World,
  type WorldNode,
} from '../../domain/types';
import { aliasesOf, nodeVisualSize, renameRelation, updateNode } from '../../domain/world';
import { Icon } from '../../components/Icon';

interface InspectorProps {
  world: World;
  selectedNode: WorldNode | null;
  selectedRelation: Relation | null;
  onBeginTransaction: () => void;
  onEndTransaction: () => void;
  onReplace: (updater: (world: World) => World) => void;
  onCommit: (updater: (world: World) => World) => void;
  onCreateAlias: () => void;
  onDeleteNode: () => void;
  onDeleteRelation: () => void;
  onFocusNode: (id: number) => void;
}

export function Inspector({
  world,
  selectedNode,
  selectedRelation,
  onBeginTransaction,
  onEndTransaction,
  onReplace,
  onCommit,
  onCreateAlias,
  onDeleteNode,
  onDeleteRelation,
  onFocusNode,
}: InspectorProps) {
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [relationDraft, setRelationDraft] = useState(selectedRelation?.name ?? '');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [menuOpen]);

  if (selectedRelation) {
    const from = world.nodes.find((node) => node.id === selectedRelation.from);
    const to = world.nodes.find((node) => node.id === selectedRelation.to);
    return (
      <aside className="inspector" aria-label="Relation details">
        <div className="inspector-heading">
          <div>
            <span className="eyebrow">Relation</span>
            <h2>Connection</h2>
          </div>
        </div>
        <label className="field-label" htmlFor="relation-name">
          Name
        </label>
        <input
          id="relation-name"
          className="relation-inspector-input"
          value={relationDraft}
          onChange={(event) => setRelationDraft(event.target.value)}
          onBlur={() => {
            const name = relationDraft.trim().slice(0, 80) || 'Relation';
            if (name === selectedRelation.name) return;
            onCommit((current) => renameRelation(current, selectedRelation.id, name));
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          maxLength={80}
        />
        <div className="relation-path">
          <span>{from ? `${from.title} · ${from.type}` : 'Unknown node'}</span>
          <Icon name="arrowRight" size={13} />
          <span>{to ? `${to.title} · ${to.type}` : 'Unknown node'}</span>
        </div>
        <p className="inspector-note">
          Relations are drawn between two nodes. Drag a node to reshape the line.
        </p>
        <div className="inspector-bottom">
          <button type="button" className="delete" onClick={onDeleteRelation}>
            <Icon name="trash" size={16} />
            Delete relation
          </button>
        </div>
      </aside>
    );
  }

  if (!selectedNode) {
    return (
      <aside className="inspector" aria-label="Selection details">
        <div className="inspector-empty">
          <div className="empty-orbit" aria-hidden="true">
            <i />
          </div>
          <h2>No selection</h2>
          <p>Select a node on the canvas to view and edit its details.</p>
        </div>
      </aside>
    );
  }

  const meta = NODE_TYPE_META[selectedNode.type];
  const size = nodeVisualSize(selectedNode);
  const alias = selectedNode.sourceId !== undefined;
  const instances = alias ? aliasesOf(world, selectedNode.sourceId!).length + 1 : 1;

  const commitTitle = () => {
    if (!titleEditing) return;
    setTitleEditing(false);
    const title = titleDraft.trim().slice(0, 120) || selectedNode.type;
    if (title === selectedNode.title) return;
    onCommit((current) => updateNode(current, selectedNode.id, (node) => ({ ...node, title })));
  };

  return (
    <aside className="inspector" aria-label="Node details">
      <div className="inspector-heading">
        <div>
          <span className="eyebrow">
            {selectedNode.type}
            {alias ? ' · Alias' : ''}
          </span>
          {titleEditing ? (
            <input
              className="inspector-title-input"
              value={titleDraft}
              autoFocus
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={commitTitle}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitTitle();
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setTitleEditing(false);
                }
              }}
              maxLength={120}
              aria-label="Node title"
            />
          ) : (
            <button
              type="button"
              className="inspector-title-display"
              title="Click to rename"
              onClick={() => {
                setTitleDraft(selectedNode.title);
                setTitleEditing(true);
              }}
            >
              {selectedNode.title}
            </button>
          )}
        </div>
        <div className="more-wrap" ref={menuRef}>
          <button
            type="button"
            className="more"
            aria-label="More node options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            •••
          </button>
          {menuOpen && (
            <div className="more-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onFocusNode(selectedNode.id);
                  setMenuOpen(false);
                }}
              >
                Focus on canvas
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onCreateAlias();
                  setMenuOpen(false);
                }}
              >
                Create alias
              </button>
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => {
                  onDeleteNode();
                  setMenuOpen(false);
                }}
              >
                {alias ? 'Delete alias' : 'Delete node'}
              </button>
            </div>
          )}
        </div>
      </div>

      <label className="field-label" htmlFor="node-type">
        Type
      </label>
      <select
        id="node-type"
        value={selectedNode.type}
        onChange={(event) => {
          const type = event.target.value as WorldNode['type'];
          const nextMeta = NODE_TYPE_META[type];
          onCommit((current) =>
            updateNode(current, selectedNode.id, (node) => ({
              ...node,
              type,
              ...(nextMeta.resizable
                ? { width: nextMeta.defaultWidth, height: nextMeta.defaultHeight }
                : { width: undefined, height: undefined }),
            })),
          );
        }}
      >
        {NODE_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>

      <label className="field-label description-label" htmlFor="node-description">
        Description
      </label>
      <textarea
        id="node-description"
        placeholder="Add a quiet note about this part of your world…"
        value={selectedNode.description}
        maxLength={20000}
        onFocus={onBeginTransaction}
        onChange={(event) => {
          const description = event.target.value;
          onReplace((current) =>
            updateNode(current, selectedNode.id, (node) => ({ ...node, description })),
          );
        }}
        onBlur={onEndTransaction}
      />

      {meta.resizable && (
        <p className="place-size-note">
          Resize from the lower-right corner. The top-left stays anchored.
          <span>
            {size.width} × {size.height}
          </span>
        </p>
      )}
      {!meta.resizable && <p className="place-size-note">This shape has a fixed footprint.</p>}

      {alias && (
        <p className="alias-note">
          <Icon name="alias" size={14} />
          Alias of{' '}
          {world.nodes.find((node) => node.id === selectedNode.sourceId)?.title ?? 'another node'}
          {instances > 1 ? ` · ${instances} instances` : ''}
        </p>
      )}

      <div className="inspector-bottom">
        <button type="button" onClick={onCreateAlias}>
          <Icon name="alias" size={16} />
          Create alias
        </button>
        <button type="button" className="delete" onClick={onDeleteNode}>
          <Icon name="trash" size={16} />
          {alias ? 'Delete alias' : 'Delete node'}
        </button>
      </div>
    </aside>
  );
}
