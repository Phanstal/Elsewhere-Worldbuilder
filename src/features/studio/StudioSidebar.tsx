import { useEffect } from 'react';
import { CREATE_TYPES, type CreateType, type WorldNode } from '../../domain/types';
import { Icon, TypeIcon } from '../../components/Icon';

interface StudioSidebarProps {
  nodes: WorldNode[];
  selectedNodeId: number | null;
  allNodesOpen: boolean;
  search: string;
  onSearch: (value: string) => void;
  onToggleAllNodes: () => void;
  onAdd: (type: CreateType) => void;
  onSelectNode: (id: number) => void;
}

const CREATE_COPY: Record<CreateType, { subtitle: string; icon: 'space' | 'element' | 'event' }> = {
  Space: { subtitle: 'Container or region', icon: 'space' },
  Element: { subtitle: 'Person, object, faction…', icon: 'element' },
  Event: { subtitle: 'Moment in time', icon: 'event' },
};

export function StudioSidebar({
  nodes,
  selectedNodeId,
  allNodesOpen,
  search,
  onSearch,
  onToggleAllNodes,
  onAdd,
  onSelectNode,
}: StudioSidebarProps) {
  const query = search.trim().toLowerCase();
  const entries = nodes
    .filter((node) => node.sourceId === undefined)
    .filter((node) => !query || node.title.toLowerCase().includes(query));

  useEffect(() => {
    if (!allNodesOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onToggleAllNodes();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [allNodesOpen, onToggleAllNodes]);

  return (
    <aside className="sidebar" aria-label="World creation">
      <section className="create-section">
        <p className="section-label">Create</p>
        {CREATE_TYPES.map((type) => (
          <button
            type="button"
            className="create-large"
            key={type}
            onClick={() => onAdd(type)}
            title={`Add ${type}`}
          >
            <span className={`type-icon ${type.toLowerCase()}`}>
              <Icon name={CREATE_COPY[type].icon} size={17} />
            </span>
            <span>
              <strong>{type}</strong>
              <small>{CREATE_COPY[type].subtitle}</small>
            </span>
            <b aria-hidden="true">+</b>
          </button>
        ))}
      </section>

      {allNodesOpen && (
        <div className="outline-drawer" role="dialog" aria-label="All elements">
          <div className="outline-heading">
            <span>All elements</span>
            <small>{entries.length}</small>
          </div>
          <div className="outline-list">
            {entries.length === 0 && <p className="outline-empty">No matching elements.</p>}
            {entries.map((node) => (
              <button
                type="button"
                key={node.id}
                className={`outline-row ${selectedNodeId === node.id ? 'selected' : ''}`}
                onClick={() => onSelectNode(node.id)}
              >
                <span className={`type-icon ${node.type.toLowerCase()}`}>
                  {node.type === 'Element' && node.icon ? (
                    <Icon name={node.icon} size={13} />
                  ) : (
                    <TypeIcon type={node.type} size={13} />
                  )}
                </span>
                <span>{node.title}</span>
                <small>{node.type}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="sidebar-bottom">
        <label className="global-search">
          <Icon name="search" size={13} />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search world…"
            aria-label="Search world"
          />
        </label>
        <button
          type="button"
          className={`outline-trigger ${allNodesOpen ? 'active' : ''}`}
          onClick={onToggleAllNodes}
          aria-expanded={allNodesOpen}
        >
          <Icon name="nodes" size={15} />
          <span>All Elements</span>
          <small>{nodes.filter((node) => node.sourceId === undefined).length}</small>
        </button>
      </div>
    </aside>
  );
}
