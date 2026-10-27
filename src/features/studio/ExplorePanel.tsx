import type { World, WorldNode } from '../../domain/types';
import { aliasesOf } from '../../domain/world';
import { Icon, TypeIcon } from '../../components/Icon';

interface ExplorePanelProps {
  world: World;
  node: WorldNode;
  onClose: () => void;
}

export function ExplorePanel({ world, node, onClose }: ExplorePanelProps) {
  const alias = node.sourceId !== undefined;
  const source = alias ? world.nodes.find((entry) => entry.id === node.sourceId) : null;
  const instances = alias && node.sourceId ? aliasesOf(world, node.sourceId).length + 1 : 1;
  return (
    <aside className="explore-panel" aria-label="Node details">
      <button
        type="button"
        className="explore-panel-close"
        onClick={onClose}
        aria-label="Close panel"
      >
        <Icon name="close" size={15} />
      </button>
      <div className="explore-visual">
        <span className={`node-symbol ${node.type.toLowerCase()}`}>
          <TypeIcon type={node.type} size={26} />
        </span>
      </div>
      <span className="eyebrow">
        {node.type}
        {alias ? ' · Alias' : ''}
      </span>
      <h2>{node.title}</h2>
      <p>{node.description.trim() || 'No note has been written for this part of the world yet.'}</p>
      {source && (
        <small className="explore-source">
          Alias of {source.title}
          {instances > 1 ? ` · ${instances} instances` : ''}
        </small>
      )}
      <div className="explore-coordinates">
        {Math.round(node.x)}, {Math.round(node.y)}
      </div>
    </aside>
  );
}
