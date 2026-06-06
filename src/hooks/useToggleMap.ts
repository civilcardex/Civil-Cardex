import { useState, useCallback } from 'react';

export function useToggleMap(): [Map<string, Set<string>>, (key: string, id: string) => void] {
  const [map, setMap] = useState<Map<string, Set<string>>>(() => new Map());

  const toggle = useCallback((key: string, id: string) => {
    setMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(key);
      const set = existing != null ? new Set<string>(existing as Set<string>) : new Set<string>();
      if (set.has(id)) set.delete(id);
      else set.add(id);
      next.set(key, set);
      return next;
    });
  }, []);

  return [map, toggle];
}
