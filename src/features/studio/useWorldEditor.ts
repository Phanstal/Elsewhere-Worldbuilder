import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorldRepository } from '../../domain/repository';
import type { World } from '../../domain/types';
import { touchWorld } from '../../domain/world';

type SaveStatus = 'saved' | 'saving' | 'error';

interface EditorState {
  present: World;
  past: World[];
  future: World[];
}

const HISTORY_LIMIT = 80;

export function useWorldEditor(initialWorld: World, repository: WorldRepository) {
  const [state, setState] = useState<EditorState>({
    present: initialWorld,
    past: [],
    future: [],
  });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const presentRef = useRef(initialWorld);
  const baselineRef = useRef<World | null>(null);
  const firstSaveRef = useRef(true);
  const saveTokenRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    presentRef.current = state.present;
  }, [state.present]);

  const pushHistory = useCallback((baseline: World) => {
    setState((current) => {
      if (baseline === current.present) return current;
      return {
        present: current.present,
        past: [...current.past, baseline].slice(-HISTORY_LIMIT),
        future: [],
      };
    });
  }, []);

  const commit = useCallback((updater: (world: World) => World) => {
    setState((current) => {
      const next = updater(current.present);
      if (next === current.present) return current;
      return {
        present: touchWorld(next),
        past: [...current.past, current.present].slice(-HISTORY_LIMIT),
        future: [],
      };
    });
  }, []);

  const replace = useCallback((updater: (world: World) => World) => {
    setState((current) => {
      const next = updater(current.present);
      if (next === current.present) return current;
      return { ...current, present: touchWorld(next) };
    });
  }, []);

  const beginTransaction = useCallback(() => {
    baselineRef.current = presentRef.current;
  }, []);

  const endTransaction = useCallback(() => {
    const baseline = baselineRef.current;
    baselineRef.current = null;
    if (baseline) pushHistory(baseline);
  }, [pushHistory]);

  const cancelTransaction = useCallback(() => {
    const baseline = baselineRef.current;
    baselineRef.current = null;
    if (baseline) {
      setState((current) => ({ ...current, present: baseline }));
    }
  }, []);

  const undo = useCallback(() => {
    setState((current) => {
      if (current.past.length === 0) return current;
      const previous = current.past[current.past.length - 1];
      return {
        present: previous,
        past: current.past.slice(0, -1),
        future: [current.present, ...current.future].slice(0, HISTORY_LIMIT),
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((current) => {
      if (current.future.length === 0) return current;
      const [next, ...rest] = current.future;
      return {
        present: next,
        past: [...current.past, current.present].slice(-HISTORY_LIMIT),
        future: rest,
      };
    });
  }, []);

  const save = useCallback(
    async (world: World): Promise<boolean> => {
      const token = ++saveTokenRef.current;
      setSaveStatus('saving');
      try {
        await repository.save(world);
        if (token === saveTokenRef.current) {
          setSaveStatus('saved');
          setSaveError(null);
        }
        return true;
      } catch (error) {
        if (token === saveTokenRef.current) {
          setSaveStatus('error');
          setSaveError(error instanceof Error ? error.message : 'The world could not be saved.');
        }
        return false;
      }
    },
    [repository],
  );

  const flush = useCallback(async (): Promise<boolean> => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return save(presentRef.current);
  }, [save]);

  useEffect(() => {
    if (firstSaveRef.current) {
      firstSaveRef.current = false;
      return;
    }
    setSaveStatus('saving');
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void save(presentRef.current);
    }, 420);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state.present, save]);

  return {
    world: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    saveStatus,
    saveError,
    commit,
    replace,
    beginTransaction,
    endTransaction,
    cancelTransaction,
    undo,
    redo,
    flush,
  };
}
