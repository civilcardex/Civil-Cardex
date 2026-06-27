import { useState, useEffect } from "react";
import { loadFromStorage, saveToStorage } from "../services/storageService";

export function usePersistedState<T>(
  key: string,
  defaults: T,
  recover?: (saved: unknown) => T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    const saved = loadFromStorage(key, null);
    if (saved != null) {
      return recover ? recover(saved) : (saved as T);
    }
    return defaults;
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      saveToStorage(key, state);
    }, 300);
    return () => clearTimeout(timer);
  }, [key, state]);

  return [state, setState];
}
