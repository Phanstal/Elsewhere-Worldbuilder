import { useState } from 'react';
import type { WorldSnapshot } from '../../domain/types';
import { MAX_SNAPSHOTS } from '../../domain/world';
import { Icon } from '../../components/Icon';

interface StudioTimelineProps {
  snapshots: WorldSnapshot[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDelete: () => void;
  onRename: (label: string) => void;
}

export function StudioTimeline({
  snapshots,
  activeIndex,
  onSelect,
  onAdd,
  onDelete,
  onRename,
}: StudioTimelineProps) {
  const active = snapshots[activeIndex];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(active?.label ?? 'Origin');

  const commit = () => {
    setEditing(false);
    const label = draft.trim().slice(0, 40);
    if (!label || label === active?.label) {
      setDraft(active?.label ?? 'Origin');
      return;
    }
    onRename(label);
  };

  return (
    <div
      className="bottom-timeline"
      onPointerDown={(event) => event.stopPropagation()}
      role="group"
      aria-label="World timeline"
    >
      <span className="time-caption">
        World time {activeIndex + 1}/{MAX_SNAPSHOTS}
      </span>
      <div
        className="time-track"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, snapshots.length)}, minmax(0, 1fr))` }}
      >
        {snapshots.map((snapshot, index) => (
          <button
            type="button"
            key={snapshot.id}
            className={activeIndex === index ? 'active' : ''}
            onClick={() => onSelect(index)}
            aria-pressed={activeIndex === index}
          >
            <i />
            <span>{snapshot.label}</span>
          </button>
        ))}
      </div>
      <input
        className="time-name"
        value={editing ? draft : (active?.label ?? 'Origin')}
        onFocus={() => {
          setDraft(active?.label ?? 'Origin');
          setEditing(true);
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setDraft(active?.label ?? 'Origin');
            setEditing(false);
            event.currentTarget.blur();
          }
        }}
        maxLength={40}
        aria-label="Time node name"
      />
      <button
        type="button"
        className="delete-time"
        onClick={onDelete}
        disabled={snapshots.length <= 1}
        title={snapshots.length <= 1 ? 'Keep at least one time node' : 'Delete current time node'}
        aria-label="Delete current time node"
      >
        <Icon name="trash" size={13} />
      </button>
      <button
        type="button"
        className="add-time"
        onClick={onAdd}
        disabled={snapshots.length >= 3}
        title={snapshots.length >= 3 ? 'Maximum 3 time nodes' : 'Add time node'}
        aria-label="Add time node"
      >
        +
      </button>
    </div>
  );
}
