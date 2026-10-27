import { useEffect, useRef, useState } from 'react';
import { NODE_GROUPS, NODE_TYPES, type NodeType, type World } from '../../domain/types';
import { aliasesOf, baseNodeCount } from '../../domain/world';
import { Icon, TypeIcon } from '../../components/Icon';

interface SidebarProps {
  world: World;
  selectedNodeId: number | null;
  allNodesOpen: boolean;
  onToggleAllNodes: () => void;
  onSelectWorld: () => void;
  onSelectNode: (id: number) => void;
  onCreateNode: (type: NodeType) => void;
}

export function Sidebar({
  world,
  selectedNodeId,
  allNodesOpen,
  onToggleAllNodes,
  onSelectWorld,
  onSelectNode,
  onCreateNode,
}: SidebarProps) {
  const [quickOpen, setQuickOpen] = useState(false);
  const quickRef = useRef<HTMLDivElement>(null);
  const count = baseNodeCount(world);

  useEffect(() => {
    if (!quickOpen) return;
    const close = (event: MouseEvent) => {
      if (!quickRef.current?.contains(event.target as Node)) setQuickOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setQuickOpen(false);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', escape);
    };
  }, [quickOpen]);

  return (
    <aside className="sidebar" aria-label="World navigation and creation">
      <section>
        <p className="section-label">Navigate</p>
        <button
          type="button"
          className={`side-row ${!allNodesOpen ? 'selected' : ''}`}
          onClick={onSelectWorld}
        >
          <Icon name="world" size={16} />
          <span>World</span>
        </button>
        <button
          type="button"
          className={`side-row ${allNodesOpen ? 'selected' : ''}`}
          onClick={onToggleAllNodes}
          aria-expanded={allNodesOpen}
        >
          <Icon name="nodes" size={16} />
          <span>All Nodes</span>
          <span className="node-count">{count}</span>
          <b className={`tree-chevron ${allNodesOpen ? 'open' : ''}`} aria-hidden="true">
            ›
          </b>
        </button>
        {allNodesOpen && (
          <div className="node-tree">
            {NODE_GROUPS.flatMap((group) => group.types).map((type) => {
              const nodes = world.nodes.filter(
                (node) => node.type === type && node.sourceId === undefined,
              );
              return (
                <div className="tree-group" key={type}>
                  <div className="tree-type-header">
                    <span className={`tree-icon ${type.toLowerCase()}`}>
                      <TypeIcon type={type} size={11} />
                    </span>
                    <span>{type}</span>
                    <small>{nodes.length}</small>
                  </div>
                  {nodes.length > 0 && (
                    <div className="tree-type-nodes">
                      {nodes.map((node) => {
                        const instances = aliasesOf(world, node.id).length + 1;
                        return (
                          <button
                            type="button"
                            key={node.id}
                            className={`tree-entity ${selectedNodeId === node.id ? 'selected' : ''}`}
                            onClick={() => onSelectNode(node.id)}
                          >
                            <span>{node.title}</span>
                            {instances > 1 && <small>{instances} instances</small>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <p className="section-label">Create</p>
        {NODE_GROUPS.map((group) => (
          <div className="create-group" key={group.id}>
            <p>{group.label}</p>
            {group.types.map((type) => (
              <button
                type="button"
                className="side-row create-row"
                key={type}
                onClick={() => onCreateNode(type)}
                title={`Add ${type}`}
              >
                <span className={`type-icon ${type.toLowerCase()}`}>
                  <TypeIcon type={type} size={16} />
                </span>
                <span>{type}</span>
                <span className="add-hint">+</span>
              </button>
            ))}
          </div>
        ))}
      </section>

      <div className="sidebar-footer" ref={quickRef}>
        {quickOpen && (
          <div className="quick-add-menu" role="menu" aria-label="Quick add node">
            <p className="quick-add-title">Add a node</p>
            <div className="quick-add-grid">
              {NODE_TYPES.map((type) => (
                <button
                  type="button"
                  key={type}
                  role="menuitem"
                  onClick={() => {
                    onCreateNode(type);
                    setQuickOpen(false);
                  }}
                >
                  <span className={`type-icon ${type.toLowerCase()}`}>
                    <TypeIcon type={type} size={15} />
                  </span>
                  {type}
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          type="button"
          className="quick-add-trigger"
          onClick={() => setQuickOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={quickOpen}
        >
          <kbd className="key">N</kbd>
          <span>Quick add node</span>
        </button>
      </div>
    </aside>
  );
}
