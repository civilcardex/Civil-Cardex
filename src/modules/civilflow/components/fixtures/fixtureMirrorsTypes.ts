import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';
import type { CountsMap, HidroDataMap } from '../fixturesStorage.ts';

/** Argumentos del paso de espejos (carga, herencia y bomba). */
export interface EspejosArgs {
  engineRef: MutableRefObject<PlanoEngine | null>;
  loadingPlanRef?: MutableRefObject<boolean> | null;
  netId: string;
  planId?: string | number;
  /** Planos del proyecto: el `nivel` de cada uno es el npt (nivel de piso topografico)
   *  que dice si la herencia de UDs baja o sube de piso. */
  plans: Array<{ id: string | number; nivel?: number | null; status?: string }>;
  planLoadedTick: number;
  targetId: string | null;
  counts: CountsMap;
  setCounts: Dispatch<SetStateAction<CountsMap>>;
  hidroData: HidroDataMap;
  setHidroData: Dispatch<SetStateAction<HidroDataMap>>;
  agregadoBajante: (bajId: string) => Record<string, number>;
  exitsDeBajante: (bajId: string) => Set<string>;
  /** Tick para lecturas directas de libros en render (heredados/fold): se bumpnea tras cada
   *  propagación aunque los conteos no cambien, para que el panel no quede rancio. */
  onLibrosChange?: () => void;
}
