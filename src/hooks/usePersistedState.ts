import { useState, useRef, useEffect } from 'react';
import { loadFromStorage, saveToStorage } from '../modules/civilflow/services/storageService';
import { useDebouncedEffect } from './useDebouncedEffect';

const PERSIST_DEBOUNCE_MS = 300;

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

  // Flush en pagehide: cerrar/recargar dentro de la ventana del debounce (300ms) perdía la
  // última edición en localStorage — el cleanup del debounce CANCELA en vez de volcar.
  const pendienteRef = useRef(false);
  useDebouncedEffect(
    () => {
      pendienteRef.current = false;
      saveToStorage(key, state);
    },
    PERSIST_DEBOUNCE_MS,
    [key, state],
  );
  useEffect(() => {
    pendienteRef.current = true; // hay un save agendado tras cada cambio de state
  });
  useEffect(() => {
    const flush = () => {
      if (pendienteRef.current) saveToStorage(key, state);
      pendienteRef.current = false;
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
    };
    // state queda capturado por corrida; el listener se re-registra en cada cambio (barato).
  });

  return [state, setState];
}
