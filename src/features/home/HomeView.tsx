import { useRef, useState } from 'react';
import type { WorldSummary } from '../../domain/types';
import { formatCount, formatEdited } from '../../domain/world';
import { Icon } from '../../components/Icon';

interface HomeViewProps {
  worlds: WorldSummary[];
  loading: boolean;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onImport: (text: string) => Promise<void>;
}

export function HomeView({ worlds, loading, onCreate, onOpen, onDelete, onImport }: HomeViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      await onImport(text);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This world could not be imported.');
    }
  };

  return (
    <div className="home-screen">
      <header className="home-header">
        <div className="brand">
          <span className="brand-mark">E</span>
          <span className="brand-word">Elsewhere</span>
        </div>
        <span className="home-tagline">Build worlds spatially. Explore them visually.</span>
      </header>

      <main className="home-content">
        <section className="home-intro">
          <span className="eyebrow">Your archive</span>
          <h1>
            Worlds take shape
            <br />
            in quiet spaces.
          </h1>
          <p>Create a new world, or return to one already in progress.</p>
          <div className="home-actions">
            <button type="button" className="home-primary" onClick={onCreate}>
              <Icon name="plus" size={14} />
              Create new world
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              <Icon name="download" size={14} />
              Import .elsew
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".elsew,application/json,.json"
              hidden
              onChange={(event) => {
                void handleFile(event.target.files?.[0]);
                event.target.value = '';
              }}
              data-testid="import-input"
            />
          </div>
          {error && (
            <p className="home-error" role="alert">
              {error}
            </p>
          )}
        </section>

        <section className="world-library" aria-label="Recent worlds">
          <div className="library-heading">
            <h2>Recent worlds</h2>
            <span>{worlds.length} local</span>
          </div>

          {loading ? (
            <div className="library-empty">
              <div className="empty-orbit" aria-hidden="true">
                <i />
              </div>
              <p>Opening the archive…</p>
            </div>
          ) : worlds.length === 0 ? (
            <div className="library-empty">
              <div className="empty-orbit" aria-hidden="true">
                <i />
              </div>
              <p>No saved worlds yet.</p>
              <small>Your worlds are stored locally on this device.</small>
            </div>
          ) : (
            <div className="world-list">
              {worlds.map((world) => (
                <div
                  className={`world-row ${menuOpenId === world.id ? 'menu-open' : ''}`}
                  key={world.id}
                >
                  <button
                    type="button"
                    className="world-open"
                    onClick={() => onOpen(world.id)}
                    aria-label={`Open ${world.name}`}
                  >
                    <span className="world-thumbnail" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span className="world-meta">
                      <strong>{world.name}</strong>
                      <small>
                        {formatCount(world.nodeCount)} · {formatEdited(world.updatedAt)}
                      </small>
                    </span>
                    <span className="world-arrow" aria-hidden="true">
                      →
                    </span>
                  </button>
                  <div className="world-menu-wrap">
                    <button
                      type="button"
                      className="world-more"
                      aria-label={`Options for ${world.name}`}
                      aria-haspopup="menu"
                      aria-expanded={menuOpenId === world.id}
                      onClick={() => setMenuOpenId((open) => (open === world.id ? null : world.id))}
                    >
                      <Icon name="more" size={16} />
                    </button>
                    {menuOpenId === world.id && (
                      <div className="world-menu" role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMenuOpenId(null);
                            onOpen(world.id);
                          }}
                        >
                          Open world
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="danger"
                          onClick={() => {
                            setMenuOpenId(null);
                            onDelete(world.id);
                          }}
                        >
                          Delete world
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="home-footer">
        Elsewhere local archive <span>·</span> .elsew format v1
      </footer>
    </div>
  );
}
