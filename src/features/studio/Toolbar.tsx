import { useEffect, useRef, useState } from 'react';
import type { World } from '../../domain/types';
import type { SaveStatus } from './types';
import { Icon } from '../../components/Icon';

interface ToolbarProps {
  world: World;
  mode: 'create' | 'explore';
  zoom: number;
  saveStatus: SaveStatus;
  saveError: string | null;
  canUndo: boolean;
  canRedo: boolean;
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onModeChange: (mode: 'create' | 'explore') => void;
  onRenameWorld: (name: string) => void;
  onSaveElsew: () => void;
  onExportPng: () => void;
  onQuickAdd: () => void;
}

export function Toolbar({
  world,
  mode,
  zoom,
  saveStatus,
  saveError,
  canUndo,
  canRedo,
  onBack,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onFit,
  onModeChange,
  onRenameWorld,
  onSaveElsew,
  onExportPng,
  onQuickAdd,
}: ToolbarProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(world.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTitle) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingTitle]);

  const startTitleEdit = () => {
    setTitleDraft(world.name);
    setEditingTitle(true);
  };

  const commitTitle = () => {
    if (!editingTitle) return;
    setEditingTitle(false);
    const name = titleDraft.trim().slice(0, 80) || 'Untitled World';
    if (name !== world.name) onRenameWorld(name);
  };

  return (
    <header className="toolbar" data-tauri-drag-region>
      <button type="button" className="brand" onClick={onBack} title="Back to archive">
        <span className="brand-mark">E</span>
        <span className="brand-word">Elsewhere</span>
      </button>

      <div className="project" data-tauri-drag-region>
        {editingTitle ? (
          <input
            ref={inputRef}
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitTitle();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                setEditingTitle(false);
              }
            }}
            maxLength={80}
            aria-label="World name"
          />
        ) : (
          <button
            type="button"
            className="project-title"
            onDoubleClick={startTitleEdit}
            title="Click to rename this world"
          >
            {world.name}
          </button>
        )}
        <button
          type="button"
          className="chevron"
          onClick={startTitleEdit}
          aria-label="Rename world"
          title="Rename world"
        >
          <Icon name="chevronDown" size={12} />
        </button>
      </div>

      <div className="toolbar-center">
        <div className="icon-pair">
          <button type="button" onClick={onUndo} disabled={!canUndo} title="Undo" aria-label="Undo">
            <Icon name="undo" size={15} />
          </button>
          <button type="button" onClick={onRedo} disabled={!canRedo} title="Redo" aria-label="Redo">
            <Icon name="redo" size={15} />
          </button>
        </div>
        <div className="zoom-control">
          <button type="button" onClick={onZoomOut} title="Zoom out" aria-label="Zoom out">
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={onZoomIn} title="Zoom in" aria-label="Zoom in">
            +
          </button>
        </div>
        <button
          type="button"
          className="quiet-button fit-button"
          onClick={onFit}
          title="Fit canvas to world"
        >
          <Icon name="fit" size={14} />
          <span>Fit</span>
        </button>
      </div>

      <div className="toolbar-right">
        <span
          className={`saved ${saveStatus === 'error' ? 'saved-error' : ''}`}
          title={saveError ?? (saveStatus === 'saved' ? 'Saved locally' : 'Saving locally')}
        >
          <i />
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : 'Saved'}
        </span>
        <button
          type="button"
          className="mobile-quick-add"
          onClick={onQuickAdd}
          aria-label="Quick add node"
          title="Quick add node"
        >
          <Icon name="plus" size={16} />
        </button>
        <div className="mode-switch" role="group" aria-label="Studio mode">
          <button
            type="button"
            className={mode === 'create' ? 'active' : ''}
            onClick={() => onModeChange('create')}
            aria-pressed={mode === 'create'}
          >
            Create
          </button>
          <button
            type="button"
            className={mode === 'explore' ? 'active' : ''}
            onClick={() => onModeChange('explore')}
            aria-pressed={mode === 'explore'}
          >
            Explore
          </button>
        </div>
        <button
          type="button"
          className="quiet-button save-elsew"
          onClick={onSaveElsew}
          title="Save .elsew file"
        >
          <Icon name="save" size={14} />
          <span>Save .elsew</span>
        </button>
        <button
          type="button"
          className="export-button"
          onClick={onExportPng}
          title="Export world as PNG"
        >
          Export PNG
        </button>
      </div>
    </header>
  );
}
