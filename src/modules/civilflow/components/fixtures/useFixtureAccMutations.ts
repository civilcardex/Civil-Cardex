import { useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  loadHidroData,
  saveHidroData,
  loadGasAcc,
  saveGasAcc,
  type HidroDataMap,
  type GasAccMap,
} from '../fixturesStorage';

const HIDRO_VACIA = { accesorios: {}, Lh: 0, nSalidas: 0 };

/** Σ/−1 de un accesorio hidráulico sobre el mapa (pura — pinnable con store real). */
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

/** Σ/−1 de un accesorio gas sobre el mapa (pura): la clave sin unidades SE BORRA. */
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

/** Mutaciones de accesorios hidráulicos y gas del panel (rediseño FixturesPanel): disk-first
 *  con fallback al estado cuando el storage no está disponible. Los handlers incAcc/decAcc/
 *  incAccGas/decAccGas de FixturesPanel movidos aquí — la lógica pura vive en mutarHidroAcc/
 *  mutarGasAcc (pinnable con stores reales sin harness de React). */
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
