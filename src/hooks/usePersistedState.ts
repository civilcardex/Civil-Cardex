import { useState } from 'react';
import { loadFromStorage, saveToStorage } from '../modules/civilflow/services/storageService';
import { useDebouncedEffect } from './useDebouncedEffect';

export function usePersistedState<T>(
  key: string,
  defaults: T,
  recover?: (saved: unknown) => T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    const saved = loadFromStorage(key, null);
    if (saved != null) {
      return recover ? recover(saved) : (saved as T);
    }
    return defaults;
  });

  useDebouncedEffect(() => saveToStorage(key, state), 300, [key, state]);

  return [state, setState];
}
