import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';
import type { CountsMap, HidroDataMap, PropioSnapMap } from '../fixturesStorage.ts';

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

/** Motor del piso cargado (non-null: el orquestador ya validó que existe). */
export type EngVivo = NonNullable<EspejosArgs['engineRef']['current']>;

/** Estado mutable compartido de UN pase de espejos: los bloques (salidas, herencia
 *  cross-floor, bomba, montantes) mutan `disk`/`hdisk`/`propioSnap` y alzan su flag —
 *  el orquestador persiste todo al final. Así cada bloque es testeable solo y el pase
 *  sigue siendo UNA escritura por almacén. */
export interface PaseEspejos {
  eng: EngVivo;
  netId: string;
  planId: string | number;
  /** Claves de conteos (aparatos) del mapa global — se muta in situ. */
  disk: CountsMap;
  /** Accesorios hidráulicos — se muta in situ. */
  hdisk: HidroDataMap;
  /** Foto de lo propio de cada clave espejo (suelo de la desasociación). */
  propioSnap: PropioSnapMap;
  dirty: boolean;
  hdirty: boolean;
  snapDirty: boolean;
  /** ¿El bajante es del piso cargado? (las proyecciones de otros pisos no son titulares). */
  esDeEstePiso: (b: { pisoBase?: string }) => boolean;
  /** Clave de conteo de un ramal del piso cargado. */
  pkey: (rid: string) => string;
  agregadoBajante: (bajId: string) => Record<string, number>;
  exitsDeBajante: (bajId: string) => Set<string>;
}
