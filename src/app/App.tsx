import { useCallback, useEffect, useRef, useState } from 'react';
import { createWorldRepository } from '../infra/storage';
import type { WorldRepository } from '../domain/repository';
import type { World, WorldSummary } from '../domain/types';
import { createWorld, sortWorlds } from '../domain/world';
import { importAsNewWorld, parseElsew } from '../domain/elsew';
import { listenForMenuCommands } from '../platform/tauri';
import { HomeView } from '../features/home/HomeView';
import { WorldStudio } from '../features/studio/WorldStudio';

type Route = { name: 'home' } | { name: 'studio'; world: World };

function nextUntitledName(existing: WorldSummary[]): string {
  const names = new Set(existing.map((world) => world.name.toLowerCase()));
  if (!names.has('untitled world')) return 'Untitled World';
  let index = 2;
  while (names.has(`untitled world ${index}`)) index += 1;
  return `Untitled World ${index}`;
}

export function App() {
  const [repository, setRepository] = useState<WorldRepository | null>(null);
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const routeRef = useRef(route);
  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  const refresh = useCallback(
    async (repo: WorldRepository = repository!) => {
      if (!repo) return;
      const list = await repo.list();
      setWorlds(sortWorlds(list));
    },
    [repository],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const repo = await createWorldRepository();
      if (cancelled) return;
      setRepository(repo);
      try {
        const list = await repo.list();
        if (!cancelled) setWorlds(sortWorlds(list));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openWorld = useCallback(
    async (id: string) => {
      if (!repository) return;
      const world = await repository.get(id);
      if (!world) {
        setWorlds((current) => current.filter((entry) => entry.id !== id));
        return;
      }
      setRoute({ name: 'studio', world });
    },
    [repository],
  );

  const createNewWorld = useCallback(async (): Promise<void> => {
    if (!repository) return;
    const world = createWorld(nextUntitledName(worlds));
    await repository.save(world);
    await refresh();
    setRoute({ name: 'studio', world });
  }, [repository, worlds, refresh]);

  const deleteWorld = useCallback(
    async (id: string) => {
      if (!repository) return;
      const world = worlds.find((entry) => entry.id === id);
      if (!world) return;
      const confirmed = window.confirm(
        `Delete “${world.name}”?\n\nThis removes the world from this device. Exported .elsew files are not affected.`,
      );
      if (!confirmed) return;
      await repository.remove(id);
      await refresh();
    },
    [repository, worlds, refresh],
  );

  const importWorld = useCallback(
    async (text: string): Promise<void> => {
      if (!repository) throw new Error('The local world library is still opening.');
      const parsed = parseElsew(text);
      const imported = importAsNewWorld(
        parsed,
        worlds.map((world) => world.name),
      );
      await repository.save(imported);
      await refresh();
      setRoute({ name: 'studio', world: imported });
    },
    [repository, worlds, refresh],
  );

  const handleBack = useCallback(async () => {
    if (repository) {
      const list = await repository.list();
      setWorlds(sortWorlds(list));
    }
    setRoute({ name: 'home' });
  }, [repository]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listenForMenuCommands((command) => {
      if (command === 'new-world' && routeRef.current.name === 'home') {
        void createNewWorld();
        return;
      }
      window.dispatchEvent(new CustomEvent<string>('elsewhere:command', { detail: command }));
    }).then((stop) => {
      unlisten = stop;
    });
    return () => unlisten?.();
  }, [createNewWorld]);

  if (!repository) {
    return (
      <div className="boot-screen">
        <span className="brand-mark">E</span>
        <p>Opening Elsewhere…</p>
      </div>
    );
  }

  if (route.name === 'studio') {
    return (
      <WorldStudio
        key={route.world.id}
        initialWorld={route.world}
        repository={repository}
        onBack={() => void handleBack()}
        onNewWorld={() => void createNewWorld()}
      />
    );
  }

  return (
    <HomeView
      worlds={worlds}
      loading={loading}
      onCreate={() => void createNewWorld()}
      onOpen={(id) => void openWorld(id)}
      onDelete={(id) => void deleteWorld(id)}
      onImport={importWorld}
    />
  );
}
