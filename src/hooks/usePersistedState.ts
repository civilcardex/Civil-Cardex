import { useState, useRef, useEffect } from 'react';
import { loadFromStorage, saveToStorage } from '../modules/civilflow/services/storageService.ts';
import { useDebouncedEffect } from './useDebouncedEffect.ts';

const PERSIST_DEBOUNCE_MS = 300;

/**
 * useState que persiste en localStorage con debounce de 300 ms y flush en pagehide (cerrar
 * la pestaña dentro del debounce ya no pierde la última edición). Ej: usePersistedState('mi_filtro', '') conserva el filtro entre sesiones.
 *
 * @param key clave de localStorage (prefijo civilflow_ del servicio).
 * @param defaults valor inicial si no hay guardado.
 * @param recover opcional: convierte el crudo guardado al tipo T (validar aquí, el storage no confía).
 * @returns [valor, setter] idéntico a useState.
 */
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
  // Los efectos SIN deps se ejecutaban en CADA render: marcaban "pendiente" sin que
  // hubiera cambio (el flush de pagehide escribía en localStorage sin motivo) y
  // re-registraban el listener de pagehide (remove+add) en cada render.
  useEffect(() => {
    pendienteRef.current = true; // hay un save agendado tras cada cambio de state
  }, [state]);
  useEffect(() => {
    const flush = () => {
      if (pendienteRef.current) saveToStorage(key, state);
      pendienteRef.current = false;
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
    };
  }, [key, state]);

  return [state, setState];
}
