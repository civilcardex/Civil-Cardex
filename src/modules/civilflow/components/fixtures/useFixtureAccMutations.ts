import { useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  loadHidroData,
  saveHidroData,
  loadGasAcc,
  saveGasAcc,
  type HidroDataMap,
  type GasAccMap,
} from '../fixturesStorage.ts';

const HIDRO_VACIA = { accesorios: {}, Lh: 0, nSalidas: 0 };

/** Suma o resta 1 a un accesorio hidráulico (codos, tees) sobre el mapa (función pura:
 *  se prueba con un store de mentiras). */
export function mutarHidroAcc(
  map: HidroDataMap,
  storageKey: string,
  accId: string,
  delta: 1 | -1,
): HidroDataMap {
  const cur = { ...(map[storageKey] || HIDRO_VACIA) };
  const acc = { ...(cur.accesorios || {}) };
  if (delta === 1) {
    acc[accId] = (acc[accId] || 0) + 1;
  } else {
    const v = (acc[accId] || 0) - 1;
    if (v <= 0) delete acc[accId];
    else acc[accId] = v;
  }
  return { ...map, [storageKey]: { ...cur, accesorios: acc } };
}

/** Suma o resta 1 a un accesorio de gas (Gas) sobre el mapa (pura): si el accesorio
 *  queda en cero, su clave se borra para no dejar basura. */
export function mutarGasAcc(
  map: GasAccMap,
  gasTargetKey: string,
  accId: string,
  delta: 1 | -1,
): GasAccMap {
  const cur = { ...(map[gasTargetKey] || {}) };
  if (delta === 1) {
    cur[accId] = (cur[accId] || 0) + 1;
  } else {
    const v = (cur[accId] || 0) - 1;
    if (v <= 0) delete cur[accId];
    else cur[accId] = v;
  }
  const next = { ...map };
  if (Object.keys(cur).length === 0) delete next[gasTargetKey];
  else next[gasTargetKey] = cur;
  return next;
}

/** Suma/resta de accesorios hidráulicos y de gas (Gas) del panel: escribe primero en
 *  disco (lo que sobrevive a la recarga) y usa el estado de React solo si el disco no
 *  está disponible. */
export function useFixtureAccMutations(args: {
  storageKey: string | null;
  gasTargetKey: string | null;
  setHidroData: Dispatch<SetStateAction<HidroDataMap>>;
  setGasAcc: Dispatch<SetStateAction<GasAccMap>>;
}): {
  incAcc: (accId: string) => void;
  decAcc: (accId: string) => void;
  incAccGas: (accId: string) => void;
  decAccGas: (accId: string) => void;
} {
  const { storageKey, gasTargetKey, setHidroData, setGasAcc } = args;

  const incAcc = useCallback(
    (accId: string) => {
      if (!storageKey) return;
      try {
        const next = mutarHidroAcc(loadHidroData(), storageKey, accId, 1);
        saveHidroData(next);
        setHidroData(next);
      } catch (_e) {
        void _e;
        setHidroData((prev) => mutarHidroAcc(prev, storageKey, accId, 1));
      }
    },
    [storageKey, setHidroData],
  );

  const decAcc = useCallback(
    (accId: string) => {
      if (!storageKey) return;
      try {
        const next = mutarHidroAcc(loadHidroData(), storageKey, accId, -1);
        saveHidroData(next);
        setHidroData(next);
      } catch (_e) {
        void _e;
        setHidroData((prev) => mutarHidroAcc(prev, storageKey, accId, -1));
      }
    },
    [storageKey, setHidroData],
  );

  const incAccGas = useCallback(
    (accId: string) => {
      if (!gasTargetKey) return;
      try {
        const next = mutarGasAcc(loadGasAcc(), gasTargetKey, accId, 1);
        saveGasAcc(next);
        setGasAcc(next);
      } catch (_e) {
        void _e;
        setGasAcc((prev) => mutarGasAcc(prev, gasTargetKey, accId, 1));
      }
    },
    [gasTargetKey, setGasAcc],
  );

  const decAccGas = useCallback(
    (accId: string) => {
      if (!gasTargetKey) return;
      try {
        const next = mutarGasAcc(loadGasAcc(), gasTargetKey, accId, -1);
        saveGasAcc(next);
        setGasAcc(next);
      } catch (_e) {
        void _e;
        setGasAcc((prev) => mutarGasAcc(prev, gasTargetKey, accId, -1));
      }
    },
    [gasTargetKey, setGasAcc],
  );

  return { incAcc, decAcc, incAccGas, decAccGas };
}
