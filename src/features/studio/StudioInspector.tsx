import { useEffect, useRef, useState } from 'react';
import {
  CREATE_TYPES,
  ELEMENT_ICONS,
  type NodeType,
  type Relation,
  type World,
  type WorldNode,
} from '../../domain/types';
import {
  aliasesOf,
  changeNodeType,
  isContainerNode,
  renameRelation,
  updateNode,
} from '../../domain/world';
import { Icon, TypeIcon } from '../../components/Icon';

interface StudioInspectorProps {
  world: World;
  node: WorldNode | null;
  relation: Relation | null;
  selectionCount: number;
  onBeginTransaction: () => void;
  onEndTransaction: () => void;
  onReplace: (updater: (world: World) => World) => void;
  onCommit: (updater: (world: World) => World) => void;
  onCreateAlias: () => void;
  onDeleteNode: () => void;
  onDeleteRelation: () => void;
  onFocusNode: (id: number) => void;
  onSetImage: (file: File) => void;
  onClose: () => void;
}

export function StudioInspector({
  world,
  node,
  relation,
  selectionCount,
  onBeginTransaction,
  onEndTransaction,
  onReplace,
  onCommit,
  onCreateAlias,
  onDeleteNode,
  onDeleteRelation,
  onFocusNode,
  onSetImage,
  onClose,
}: StudioInspectorProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState(node?.description ?? '');
  const [tagsDraft, setTagsDraft] = useState((node?.tags ?? []).join(', '));
  const [menuOpen, setMenuOpen] = useState(false);
  const [relationDraft, setRelationDraft] = useState(relation?.name ?? '');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const descriptionEditingRef = useRef(false);
  const pendingDescriptionRef = useRef<string | null>(null);
  const nodeRef = useRef(node);

  useEffect(() => {
    nodeRef.current = node;
  }, [node]);

  // If a selection change unmounts the inspector before the textarea's blur
  // handler runs, flush the draft here so "click outside" always persists.
  useEffect(() => {
    return () => {
      const current = nodeRef.current;
      const pending = pendingDescriptionRef.current;
      if (current && pending !== null && pending !== current.description) {
        onReplace((world) =>
          updateNode(world, current.id, (entry) => ({
            ...entry,
            description: pending.slice(0, 20000),
          })),
        );
      }
      pendingDescriptionRef.current = null;
      if (descriptionEditingRef.current) {
        descriptionEditingRef.current = false;
        onEndTransaction();
      }
    };
  }, [onEndTransaction, onReplace]);

  if (relation) {
    const from = world.nodes.find((entry) => entry.id === relation.from);
    const to = world.nodes.find((entry) => entry.id === relation.to);
    return (
      <aside className="inspector" aria-label="Relation details">
        <div className="inspector-heading">
          <div>
            <span className="eyebrow">Relation</span>
            <h2>Connection</h2>
          </div>
          <button
            type="button"
            className="inspector-close"
            onClick={onClose}
            aria-label="Close details"
          >
            <Icon name="close" size={14} />
          </button>
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
            if (name === relation.name) return;
            onCommit((current) => renameRelation(current, relation.id, name));
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

  if (!node) {
    return (
      <aside className="inspector" aria-label="Selection details">
        <div className="inspector-empty">
          <span>
            <Icon name="nodes" size={22} />
          </span>
          <h3>No selection</h3>
          <p>Select a node on the canvas to view and edit its details.</p>
        </div>
      </aside>
    );
  }

  const alias = node.sourceId !== undefined;
  const source = alias ? world.nodes.find((entry) => entry.id === node.sourceId) : null;
  const instances = alias && node.sourceId ? aliasesOf(world, node.sourceId).length + 1 : 1;
  const containers = world.nodes.filter((entry) => entry.id !== node.id && isContainerNode(entry));
  const children = world.nodes.filter((entry) => entry.parentId === node.id);
  const typeOptions: NodeType[] = [
    ...((CREATE_TYPES as readonly string[]).includes(node.type) ? [] : [node.type]),
    ...CREATE_TYPES,
  ];

  const commitTitle = () => {
    setEditingTitle(false);
    const title = titleDraft.trim().slice(0, 120) || 'Untitled';
    if (title === node.title) return;
    onCommit((current) => updateNode(current, node.id, (entry) => ({ ...entry, title })));
  };

  const commitDescription = () => {
    if (descriptionDraft === node.description) return;
    // The textarea is wrapped in a focus/blur transaction, so replace keeps
    // the whole edit as a single undo step.
    onReplace((current) =>
      updateNode(current, node.id, (entry) => ({
        ...entry,
        description: descriptionDraft.slice(0, 20000),
      })),
    );
  };

  const commitTags = () => {
    const tags = tagsDraft
      .split(',')
      .map((tag) => tag.trim().replace(/^#/, '').slice(0, 30))
      .filter(Boolean)
      .slice(0, 12);
    const currentTags = node.tags ?? [];
    if (tags.join('|') === currentTags.join('|')) return;
    onCommit((current) =>
      updateNode(current, node.id, (entry) => ({
        ...entry,
        tags: tags.length > 0 ? tags : undefined,
      })),
    );
  };

  return (
    <aside className="inspector" aria-label="Selection details">
      <div className="inspector-heading">
        <div>
          <span className="eyebrow">
            {node.type}
            {alias ? ' · Alias' : ''}
          </span>
          {editingTitle ? (
            <input
              className="inspector-title-input"
              autoFocus
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={commitTitle}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') {
                  setTitleDraft(node.title);
                  setEditingTitle(false);
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
                setTitleDraft(node.title);
                setEditingTitle(true);
              }}
            >
              {node.title}
            </button>
          )}
        </div>
        <div className="inspector-more">
          <button
            type="button"
            className="more"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="More actions"
            aria-expanded={menuOpen}
          >
            •••
          </button>
          {menuOpen && (
            <div className="more-menu" role="menu">
              {!alias && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onCreateAlias();
                    setMenuOpen(false);
                  }}
                >
                  <Icon name="alias" size={13} /> Create alias
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onFocusNode(node.id);
                  setMenuOpen(false);
                }}
              >
                <Icon name="fit" size={13} /> Center on canvas
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          className="inspector-close"
          onClick={onClose}
          aria-label="Close details"
        >
          <Icon name="close" size={14} />
        </button>
      </div>

      {selectionCount > 1 && (
        <div className="multi-selection-note">
          {selectionCount} elements selected. Drag any selected node to move the group.
        </div>
      )}

      <label className="field-label" htmlFor="node-type">
        Type
      </label>
      <select
        id="node-type"
        value={node.type}
        onChange={(event) =>
          onCommit((current) => changeNodeType(current, node.id, event.target.value as NodeType))
        }
      >
        {typeOptions.map((type) => (
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
        value={descriptionDraft}
        onChange={(event) => {
          setDescriptionDraft(event.target.value);
          pendingDescriptionRef.current = event.target.value;
        }}
        onFocus={() => {
          descriptionEditingRef.current = true;
          onBeginTransaction();
        }}
        onBlur={() => {
          commitDescription();
          pendingDescriptionRef.current = null;
          descriptionEditingRef.current = false;
          onEndTransaction();
        }}
        placeholder="Add a quiet note about this part of your world…"
      />

      {node.type === 'Element' && (
        <>
          <label className="field-label detail-label">Icon</label>
          <div className="icon-picker">
            {ELEMENT_ICONS.map((icon) => (
              <button
                type="button"
                key={icon}
                className={(node.icon ?? 'character') === icon ? 'active' : ''}
                onClick={() =>
                  onCommit((current) =>
                    updateNode(current, node.id, (entry) => ({ ...entry, icon })),
                  )
                }
                title={icon}
                aria-label={icon}
                aria-pressed={(node.icon ?? 'character') === icon}
              >
                <Icon name={icon} size={16} />
              </button>
            ))}
          </div>

          <label className="field-label detail-label" htmlFor="node-space">
            Space
          </label>
          <select
            id="node-space"
            value={node.parentId ?? ''}
            onChange={(event) =>
              onCommit((current) =>
                updateNode(current, node.id, (entry) => ({
                  ...entry,
                  parentId: event.target.value ? Number(event.target.value) : undefined,
                })),
              )
            }
          >
            <option value="">No space</option>
            {containers.map((space) => (
              <option key={space.id} value={space.id}>
                {space.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="image-action"
            onClick={() => imageInputRef.current?.click()}
          >
            <Icon name="imagePlus" size={15} />
            {node.imageSrc ? 'Replace image' : 'Add image'}
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onSetImage(file);
              event.target.value = '';
            }}
          />

          <label className="field-label detail-label" htmlFor="node-tags">
            Tags
          </label>
          <input
            id="node-tags"
            className="tags-input"
            value={tagsDraft}
            onChange={(event) => setTagsDraft(event.target.value)}
            onFocus={onBeginTransaction}
            onBlur={() => {
              commitTags();
              onEndTransaction();
            }}
            placeholder="#NPC, #villain, #dead"
          />

          {node.imageSrc && (
            <button
              type="button"
              className="image-remove"
              onClick={() =>
                onCommit((current) =>
                  updateNode(current, node.id, (entry) => {
                    const next = { ...entry };
                    delete next.imageSrc;
                    return next;
                  }),
                )
              }
            >
              Remove image
            </button>
          )}
        </>
      )}

      {node.type === 'Space' && (
        <>
          <label className="field-label detail-label" htmlFor="node-background">
            Background
          </label>
          <input
            id="node-background"
            className="color-input"
            type="color"
            value={node.backgroundColor ?? '#E8EEF1'}
            onFocus={onBeginTransaction}
            onChange={(event) =>
              onReplace((current) =>
                updateNode(current, node.id, (entry) => ({
                  ...entry,
                  backgroundColor: event.target.value,
                })),
              )
            }
            onBlur={onEndTransaction}
          />
          <label className="field-label detail-label">Inside this space</label>
          <div className="contained-list">
            {children.map((child) => (
              <button type="button" key={child.id} onClick={() => onFocusNode(child.id)}>
                <TypeIcon type={child.type} size={12} />
                {child.title}
                <span>→</span>
              </button>
            ))}
            {children.length === 0 && <p>Drag elements or spaces into this area.</p>}
          </div>
        </>
      )}

      {alias && (
        <p className="alias-note">
          <Icon name="alias" size={14} />
          Alias of {source?.title ?? 'another node'}
          {instances > 1 ? ` · ${instances} instances` : ''}
        </p>
      )}

      <div className="inspector-bottom">
        <button type="button" className="delete" onClick={onDeleteNode}>
          <Icon name="trash" size={16} />
          {selectionCount > 1
            ? `Delete ${selectionCount} elements`
            : alias
              ? 'Delete alias'
              : 'Delete node'}
        </button>
      </div>
    </aside>
  );
}
