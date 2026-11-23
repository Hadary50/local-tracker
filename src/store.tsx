import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData } from './types';
import { emptyData, sanitizeData, type Result } from './lib/logic';

const KEY = 'brand-stock-tracker:v1';

function load(): AppData {
  try {
    const text = localStorage.getItem(KEY);
    if (text) {
      const d = sanitizeData(JSON.parse(text));
      if (d) return d;
    }
  } catch {
    /* corrupted or unavailable storage: start fresh */
  }
  return emptyData();
}

function save(data: AppData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

interface Store {
  data: AppData;
  /** Runs a change; saves it only if it succeeds. Returns the result so the UI can show errors. */
  mutate: <E>(fn: (d: AppData) => Result<E>) => Result<E>;
  replaceAll: (d: AppData) => void;
  saveFailed: boolean;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load);
  const [saveFailed, setSaveFailed] = useState(false);
  const ref = useRef(data); // always the latest data, even between renders

  const commit = useCallback((next: AppData) => {
    ref.current = next;
    setData(next);
    setSaveFailed(!save(next));
  }, []);

  const mutate = useCallback(
    <E,>(fn: (d: AppData) => Result<E>): Result<E> => {
      const r = fn(ref.current);
      if (r.ok) commit(r.data);
      return r;
    },
    [commit],
  );

  const value = useMemo<Store>(() => ({ data, mutate, replaceAll: commit, saveFailed }), [data, mutate, commit, saveFailed]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
