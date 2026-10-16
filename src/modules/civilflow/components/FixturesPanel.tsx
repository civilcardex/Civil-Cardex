import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APARATOS_DEF, UD_BASE_INIT, ACCESORIOS_HIDRO, GAS_ACCESORIOS } from '../constants';
import { NETS } from '../lib/PlanoEngine/PlanoState';
import { usePlans } from '../context/PlansContext';
import { useApparatus } from '../context/ApparatusContext';
import {
  writeSanDrawingSync,
  writeHydroDrawingSync,
  setSyncLoadedLiveIds,
} from '../utils/drawingSync';
import type { DrawingData } from '../utils/drawingSync';
import FixtureGrid from './fixtures/FixtureGrid';
import { SecMontantes } from './fixtures/SecMontantes';
import AccesoriosSection from './fixtures/AccessoriesSection';
import { startRejillasGasodSync, hidratarRejillasGasod } from './rejillasGasodSync';
import { devError } from '../../../utils/devError';
import { loadFromStorage, saveToStorage } from '../services/storageService';
import {
  UNIDAD,
  loadAll,
  loadHidroData,
  loadGasAcc,
  unitFor,
  esAplicable,
  isCountableTarget,
  type CountsMap,
  type HidroDataMap,
  type GasAccMap,
  type SelectableTarget,
  stableStringify,
  salidasDeBajante,
} from './fixturesStorage';
import { hidroDeClave, totalDeUnidades, ownTotalDe, esPropioDe } from './fixturesStorage';
import { podarGasAccPorPlanos } from '../utils/drawingSyncGc';
import { useFixtureAccMutations } from './fixtures/useFixtureAccMutations';
import { useFixtureMirrors } from './fixtures/useFixtureMirrors';
import { useFixtureMutations } from './fixtures/useFixtureMutations';
import { useFixtureTarget } from './fixtures/useFixtureTarget';
import { LlAssociationsPanel } from './fixtures/LlAssociationsPanel';
import { resolveJunctionEntrant } from '../utils/flowDirection';
import { countKey } from '../utils/keys';
import { bajanteLabel, ramalLabel } from '../utils/accessoryAbbreviations';

import { distToPolyline } from '../lib/shared/geometry';
import type PlanoEngine from '../lib/PlanoEngine/PlanoEngine';
import { useTramos } from '../context/TramosContext';
import { buildSanConnectivity } from '../utils/sanitaryRows';

const HIDROSAN_IDS = new Set(['af', 'ac', 'san']);
const GAS_ID = 'gas';

import { TRAZOS_PREFIX } from '../constants/storage-keys';
const FixturesPanel_S1: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 12px 8px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  overflow: 'hidden',
};
const FixturesPanel_S2: React.CSSProperties = {
  fontFamily: "'Geist',monospace",
  fontSize: 12,
  color: 'var(--txt3)',
  textTransform: 'uppercase',
  letterSpacing: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
const FixturesPanel_S3: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: 12,
  color: 'var(--txt2)',
  fontFamily: "'Geist',monospace",
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 6,
  padding: '0 2px',
};

import type { ProbedElement } from './pdfViewer/tramoEditor/context';
import { useRainwater } from '../context/RainwaterContext';
import { leerHeredadosPresion } from '../utils/aparatosPresion';
import {
  EV_APARATOS_CLEAR,
  EV_SAN_SYNC,
  EV_HIDRO_SYNC,
  EV_PLAN_LOADED,
  EV_STORAGE,
} from '../utils/fixtureEvents';

const AparatosPanel = memo(function AparatosPanel_({
  activeNet,
  selElement,
  setSelElement,
  planId,
  engineRef,
  loadingPlanRef,
  rejillasArea,
}: {
  activeNet: string;
  selElement: SelectableTarget | null;
  setSelElement?: React.Dispatch<React.SetStateAction<ProbedElement | null>>;
  planId?: string | number;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  loadingPlanRef?: React.MutableRefObject<boolean>;
  /** Área de sector (módulo Rejillas de ventilación): conteos libres por gasodoméstico. */
  rejillasArea?: boolean;
}) {
  const { plans } = usePlans();
  const { tramosSan } = useTramos();
  const { aps } = useApparatus();
  const [counts, setCounts] = useState<CountsMap>(loadAll);

  const [hidroData, setHidroData] = useState<HidroDataMap>(loadHidroData);
  const [gasAcc, setGasAcc] = useState<GasAccMap>(loadGasAcc);
  // Señal de fin de carga de un piso (usePlanoLoadSwitch dispara EV_PLAN_LOADED): el
  // efecto de espejos/herencia se SALTA mientras carga (anti-carrera) y con este tick vuelve a
  // correr justo después — sin él, la herencia bomba→bajante no se reescribía al abrir el piso
  // y el bajante quedaba con el valor viejo (orig. usuario).
  const [planLoadedTick, setPlanLoadedTick] = useState(0);
  useEffect(() => {
    const h = (): void => setPlanLoadedTick((t) => t + 1);
    window.addEventListener(EV_PLAN_LOADED, h);
    return () => window.removeEventListener(EV_PLAN_LOADED, h);
  }, []);
  // Sanado de sifones fantasma (orig. usuario: "crea un sifón de más"): el conteo 'sif' se
  // acumulaba sin guard en caminos viejos (re-selección del accesorio en el dropdown, pisado
  // del glifo al asignar otro aparato). Se reconcilia con los glifos vivos del piso cargado
  // al abrir/cargar — el contador nunca puede diferir de los glifos dibujados.
  const [open, setOpen] = useState(true);
  const [pulse, setPulse] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastTargetRef = useRef<string | null>(null);

  useEffect(() => {
    const { idsVivos, porDisco } = podarGasAccPorPlanos(plans);
    if (porDisco) {
      setGasAcc(porDisco);
      return;
    }
    setGasAcc((prev) => {
      let changed = false;
      const next: GasAccMap = {};
      for (const id of idsVivos) {
        if (prev[id]) next[id] = prev[id];
      }
      if (Object.keys(next).length !== Object.keys(prev).length) changed = true;
      return changed ? next : prev;
    });
  }, [plans]);

  useEffect(() => {
    // Conteos de áreas rejillas vivos sin la tabla: arranca el push global del blob
    // (asignar/borrar desde el panel llega a BD) e hidrata el fill-missing al montar el
    // visor — antes el panel arrancaba vacío hasta entrar a la tabla de Rejillas.
    startRejillasGasodSync();
    void hidratarRejillasGasod();
  }, []);

  useEffect(() => {
    // Recarga guardada: solo setea si el CONTENIDO cambió (misma ref = bail, sin re-render).
    // Sin esto, escuchar los syncs entraría en loop sync→reload→sync (cada sync dispara
    // evento y cada reload crea refs nuevas). Con esto el panel se entera del re-anclaje
    // de claves (orig. usuario piso 2: montaba con el store vacío y nunca refrescaba).
    const reloadAll = () => {
      setCounts((prev) => {
        const next = loadAll();
        return stableStringify(prev) === stableStringify(next) ? prev : next;
      });
      setHidroData((prev) => {
        const next = loadHidroData();
        return stableStringify(prev) === stableStringify(next) ? prev : next;
      });
      setGasAcc((prev) => {
        const next = loadGasAcc();
        return stableStringify(prev) === stableStringify(next) ? prev : next;
      });
    };
    window.addEventListener(EV_STORAGE, reloadAll);
    window.addEventListener(EV_APARATOS_CLEAR, reloadAll);
    window.addEventListener(EV_SAN_SYNC, reloadAll);
    window.addEventListener(EV_HIDRO_SYNC, reloadAll);
    return () => {
      window.removeEventListener(EV_STORAGE, reloadAll);
      window.removeEventListener(EV_APARATOS_CLEAR, reloadAll);
      window.removeEventListener(EV_SAN_SYNC, reloadAll);
      window.removeEventListener(EV_HIDRO_SYNC, reloadAll);
    };
  }, []);

  useEffect(() => {
    try {
      // Los trazos deben estar FRESCOS antes del sync: writeSanDrawingSync corre la GC de
      // claves aparatos/hidro contra los trazos GUARDADOS — con trazos stale (elementos
      // recién dibujados que el autosave aún no persistía) borraba las claves de aparatos
      // recién asignadas: el panel las seguía mostrando (estado vivo) pero la validación de
      // cierre las leía vacías y disparaba "UC/UD pendientes" (orig. usuario).
      const eng = engineRef.current;
      // Carga en vuelo: el engine aún tiene el piso anterior (o nada) bajo el id del piso
      // entrante — snapshot aquí persistía trabajo vacío/ajeno con ts fresco sobre la caché
      // buena del piso entrante (orig. usuario: pisos vaciados al reabrir).
      if (eng && eng._loadedPlanId != null && !loadingPlanRef?.current) {
        const work = eng.saveWork();
        work.ts = Date.now();
        saveToStorage(`${TRAZOS_PREFIX}${String(eng._loadedPlanId)}`, work);
      }
      // Registrar los ids VIVOS del piso cargado ANTES de sincronizar (el GC los consulta):
      // sincronizar sin ellos permitía borrar claves de ramales recientes (guard del GC).
      if (eng && eng._loadedPlanId != null) {
        setSyncLoadedLiveIds(String(eng._loadedPlanId), [
          ...eng.ramales.flatMap((r) => [r.id, r.label].filter(Boolean) as string[]),
          ...eng.bajantes.flatMap((b) => [b.id, b.code].filter(Boolean) as string[]),
          ...eng.areas.flatMap((a) => [a.id, a.label].filter(Boolean) as string[]),
        ]);
      }
      writeSanDrawingSync(plans);
    } catch (e) {
      devError('AparatosPanel:', e);
    }
    try {
      writeHydroDrawingSync(plans);
    } catch (e) {
      devError('AparatosPanel:', e);
    }
  }, [counts, hidroData, plans, engineRef, loadingPlanRef]);

  // Un bajante de calentador es siempre elemento AC (net 'ac') aunque el usuario lo ancle estando
  // en la red AF — sus aparatos deben caer en `ac_<id>_<planId>` para que el ramal sintético
  // AC-01-{id} (buildTramos) los tome en la tabla de selección de calentador. Usar activeNet aquí
  // los escribiría bajo `af_<id>_<planId>` y la tabla del calentador no leería nada.
  const netId = rejillasArea
    ? 'gas' // el área de sector siempre cuanta gasodomésticos, sea cual sea la pestaña activa
    : selElement?.tipo === 'calentador'
      ? selElement.net || 'ac'
      : activeNet;
  const isGas = netId === GAS_ID;
  const isHidro = HIDROSAN_IDS.has(netId);
  const isAfAc = netId === 'af' || netId === 'ac';
  const visible = isHidro || isGas;

  const { bajantesLl } = useRainwater();
  const unitKey = useMemo(() => unitFor(netId), [netId]);
  const unidadLbl = unitKey ? (UNIDAD as Record<string, string>)[unitKey] : '';

  const items = useMemo(() => {
    if (!unitKey) return [];
    const filtered = APARATOS_DEF.filter((ap) => esAplicable(ap, netId, unitKey));
    const APS_FIELD: Record<string, 'ud' | 'ucaf' | 'ucac'> = {
      ud: 'ud',
      uc_af: 'ucaf',
      uc_ac: 'ucac',
    };
    const apsField = APS_FIELD[unitKey || ''] || null;
    let result = filtered;
    if (apsField && unitKey) {
      result = filtered.map((ap) => {
        const fromAps = aps.find((p) => p.id === ap.id);
        return fromAps ? { ...ap, [unitKey]: fromAps[apsField] || ap[unitKey] } : ap;
      });
    }
    if (unitKey === 'ud') {
      const order = UD_BASE_INIT.map((d) => d.id);
      return result.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    }
    return result.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [netId, unitKey, aps]);

  // Bajantes y CAJAS (AN/LL) muestran el agregado de UDs de sus trazos de entrada.
  // Elemento "agregable" en el panel: bajantes/cajas/bomba en redes de bajante + MONTANTES
  // (orig. usuario: asociación entre pisos aplica igual) en cualquier red de suministro.
  const esBajSanOLl =
    selElement?.tipo === 'bajante' ||
    selElement?.tipo === 'caja_san' ||
    selElement?.tipo === 'caja_ll' ||
    selElement?.tipo === 'bomba';
  const isBajanteSan =
    selElement?.tipo === 'montante' || (esBajSanOLl && (netId === 'san' || netId === 'll'));
  // Discriminación por piso (orig. usuario): BAN1 existe en P1 y en P2 con el MISMO id —
  // todo lookup en tramosSan debe limitarse al piso actual o el panel agrega UDs del otro.
  const samePlan = useCallback(
    (t: { planId?: string | number }) =>
      planId == null || t.planId == null || String(t.planId) === String(planId),
    [planId],
  );
  const tramosPiso = useMemo(() => tramosSan.filter((t) => samePlan(t)), [tramosSan, samePlan]);
  // Conectividad del árbol sanitario SOLO del piso actual — la geométrica conectaba tramos de
  // pisos distintos (mismas coordenadas de plano) y mezclaba UDs entre BAN1-P1 y BAN1-P2.
  const sanConnectivity = useMemo(() => {
    if (netId !== 'san' && netId !== 'll') return null;
    return buildSanConnectivity(
      tramosPiso,
      plans,
      items as unknown as import('../utils/sanitaryRows').MergedApBase[],
    );
  }, [netId, tramosPiso, plans, items]);

  const target = useMemo(
    () =>
      isCountableTarget(selElement) || (rejillasArea && selElement?.id?.startsWith('AR'))
        ? selElement
        : selElement?.tipo === 'contador'
          ? { ...selElement, id: 'CNT1' }
          : null,
    [selElement, rejillasArea],
  );
  const targetId = target?.id || null;
  // Clave GAS_ACC compuesta por plano (los ids REPITEN entre pisos): sin esto, RS1 en P1 y P2
  // sumaban accesorios en la MISMA entrada y ΔP inflada en ambas (auditoría F-3).
  const gasTargetKey = target
    ? `gas_${target.id}_${(target as { planId?: string | number }).planId ?? 'x'}`
    : null;
  // Etiqueta COMPLETA con sufijo de piso (p. ej. "RS1-P1"/"BAN2-P1") — la misma del canvas
  // (orig. usuario pt. 2). Ramales llevan el piso ACTUAL; bajantes/cajas/bomba/montantes su
  // pisoBase. Reactiva: selElement se re-deriva en cada dirty del engine.
  const targetLbl = (() => {
    const t = target as {
      tipo?: string;
      label?: string;
      code?: string;
      id?: string;
      pisoBase?: string;
    } | null;
    if (!t) return '';
    if (t.tipo === 'bajante' || t.tipo === 'caja_san' || t.tipo === 'caja_ll' || t.tipo === 'bomba')
      return bajanteLabel(t, t.pisoBase);
    if (t.tipo === 'montante') return bajanteLabel(t, t.pisoBase);
    if (rejillasArea && t.id?.startsWith('AR')) return t.label || t.id;
    return ramalLabel(t, engineRef.current?.nivelActual?.label || undefined) || t.id || '';
  })();
  const storageKey = targetId
    ? planId
      ? `${netId}_${targetId}_${planId}`
      : `${netId}_${targetId}`
    : null;
  // Tramo con herencia propagada (RAF3, orig. usuario): sus UDs las trae aguas arriba — el
  // panel se vuelve SOLO LECTURA (opaco); la edición es en los ramales/montante fuente.
  // Solo-lectura por HEREDADOS (orig. usuario: RAC5 que recibe la carga de RAC1/T1RAC5
  // debe aparecer bloqueado — cualquier pieza con unidades heredadas es de solo lectura;
  // la asignación va en las piezas alimentadoras puras, sin heredados).
  const esPropagado =
    !!storageKey &&
    (netId === 'af' || netId === 'ac') &&
    Object.values(leerHeredadosPresion(storageKey)).some((v: number) => v > 0);

  // Auto-limpieza (orig. usuario): la propagación es idempotente — re-correrla aplica el
  // delta y retira herencias que la dirección de flujo ya no justifica. Corre AL MONTAR y en
  // cada cambio de selección, pero ASÍNCRONA (debounce 250 ms): el clic derecho selecciona y
  // abre el menú SIN esperar el cálculo — correrlo síncrono en el ciclo de selección rompía
  // la apertura de los menús contextuales (regresión 2026-10-09). Errores atrapados: nunca
  // deben tumbar el panel.
  useEffect(() => {
    if (targetId && targetId !== lastTargetRef.current) {
      lastTargetRef.current = targetId;
      setOpen(true);
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1400);
      requestAnimationFrame(() => {
        if (containerRef.current) {
          let el = containerRef.current.parentElement;
          while (el) {
            const s = window.getComputedStyle(el);
            if (s.overflowY === 'auto' || s.overflowY === 'scroll') {
              el.scrollTop = 0;
              break;
            }
            el = el.parentElement;
          }
        }
      });
      return () => clearTimeout(t);
    }
    if (!targetId) {
      lastTargetRef.current = null;
    }
  }, [targetId]);

  // Todos los ramales del plano actual (almacenamiento crudo, no el motor en vivo) — necesario
  // para hallar, en AF/AC/gas, qué ramal acumula de verdad la UC combinada de un empalme. Ya no es
  // siempre el ramal auto-creado (mergesFrom solo vive en él) — es aquel de los tres participantes
  // cuya dirección de flujo entra de verdad al empalme (ver waterNetworkRows.ts).
  // Deliberadamente NO memoizado solo por planId — el dibujo (un nuevo corte, una dirección
  // invertida) cambia constantemente mientras este panel queda abierto sobre el mismo plano, y no
  // hay evento dedicado de "geometría cambiada" contra el cual invalidar un caché. Una lectura
  // simple de localStorage es barata de repetir en cada render, así que se re-lee fresco en vez de
  // quedar obsoleto a mitad de sesión.
  const allRamalesForPlan = (() => {
    const fromStorage = planId
      ? loadFromStorage<DrawingData | null>(TRAZOS_PREFIX + planId, null)?.ramales || []
      : [];
    if (fromStorage.length > 0) return fromStorage;
    // Fallback al motor vivo (planId puede ser string vs number, o storage aún no volcado)
    return (engineRef.current?.ramales || []).filter((r) => {
      // Filtrar por planId si existe; si no, tomar todos de la red activa
      const pid = (r as unknown as { planId?: string | number }).planId;
      return planId == null || pid == null || String(pid) === String(planId);
    }) as unknown as typeof fromStorage;
  })();

  // Keys de las fuentes de fusión — un ramal auto-creado (por corte en medio de un empalme)
  // arranca sin aparatos propios; el ramal que MUESTRA la UC combinada (que puede ser el
  // auto-creado o una de sus dos fuentes — la que su flujo entre al empalme) debe en cambio
  // reflejar los conteos combinados de los OTROS dos participantes, de solo lectura, para que el
  // usuario no se quede mirando ceros/parciales en un tramo que visiblemente los lleva todos.
  // Se recalcula plano en cada render (no useMemo) porque depende de allRamalesForPlan, que a su
  // vez se re-lee fresco en cada render.
  const mergeKeys = (() => {
    if (!target?.id || !netId) return null;
    const keyFor = (id: string) => (planId ? `${netId}_${id}_${planId}` : `${netId}_${id}`);
    // Unir AMBAS fuentes de verdad de flujo: mergesFrom (auto-split) + geometría
    // (extremo-a-extremo). RS3 suele ser extremo-a-extremo (sin mergesFrom) pero RS5 es
    // auto-split (con mergesFrom); el subárbol completo de RS3 debe incluir ambos.
    // Antes solo se usaba mergesFrom y RS3 dibujado a mano quedaba en 0 ("muestra de menos").
    const mergeSiblingPairs = new Set<string>();
    for (const r of allRamalesForPlan) {
      if (r.mergesFrom) mergeSiblingPairs.add(r.mergesFrom.toSorted().join('|'));
    }
    const geomKeysForSan = (): string[] => {
      if (netId !== 'san' || !target?.id) return [];
      const visited = new Set<string>([target.id]);
      const keys: string[] = [];
      const collect = (id: string) => {
        const t = allRamalesForPlan.find((r) => r.id === id);
        if (!t || !t.pts || t.pts.length < 2) return;
        const tDownstream = t._tribReversed ? t.pts[0] : t.pts[t.pts.length - 1];
        for (const f of allRamalesForPlan) {
          if (f.id === id || f.net !== netId || visited.has(f.id)) continue;
          if (!f.pts || f.pts.length < 2) continue;
          if (f.tipo === 'bajante' || f.tipo === 'montante') continue;
          if (mergeSiblingPairs.has([f.id, t.id].sort().join('|'))) continue;
          // Dos ramales que desembocan en el mismo bajante no se consideran que drenan entre sí
          const fFinCheck = (f as unknown as { fin?: string }).fin || '';
          const tFinCheck = (t as unknown as { fin?: string }).fin || '';
          if (tFinCheck && fFinCheck && tFinCheck === fFinCheck) {
            const isBajanteFin = (fid: string) => {
              if (
                /^B[A-Z]+/.test(fid) ||
                fid.startsWith('BAN') ||
                fid.startsWith('BALL') ||
                fid.startsWith('BREV')
              )
                return true;
              // fallback: buscar en bajantes reales
              if (engineRef.current?.bajantes?.some((b) => b.code === fid || b.id === fid))
                return true;
              return false;
            };
            if (isBajanteFin(tFinCheck)) continue;
          }
          const fEnd = f._tribReversed ? f.pts[0] : f.pts[f.pts.length - 1];
          if (distToPolyline(fEnd, t.pts) >= 2.0) continue;
          // Si ambos terminan en el mismo bajante geométricamente, no agregar
          if (engineRef.current?.bajantes) {
            const bajAtTDown = engineRef.current.bajantes.find(
              (b) => Math.hypot(b.x - tDownstream[0], b.y - tDownstream[1]) < 2.0,
            );
            const bajAtFEnd = engineRef.current.bajantes.find(
              (b) => Math.hypot(b.x - fEnd[0], b.y - fEnd[1]) < 2.0,
            );
            if (bajAtTDown && bajAtFEnd && bajAtTDown.id === bajAtFEnd.id) continue;
          }
          const touchesTDownstream =
            Math.hypot(fEnd[0] - tDownstream[0], fEnd[1] - tDownstream[1]) < 2.0;
          if (touchesTDownstream) {
            const tFin = (t as unknown as { fin?: string }).fin || '';
            if (!tFin) continue;
            const finIsRamalAtPt = allRamalesForPlan.some(
              (o) =>
                (o.id === tFin || (o as unknown as { label?: string }).label === tFin) &&
                o.pts &&
                o.pts.length >= 2 &&
                distToPolyline(fEnd, o.pts) < 2.0,
            );
            if (finIsRamalAtPt) continue;
          }
          visited.add(f.id);
          keys.push(keyFor(f.id));
          collect(f.id);
        }
      };
      collect(target.id);
      return keys;
    };
    // Si target es el ramal auto-creado, su propio mergesFrom es el par de fuentes; si no,
    // hallar el ramal auto-creado que lista a target como una de sus dos fuentes.
    const isAutoCreated = !!target.mergesFrom;
    const hostR = isAutoCreated
      ? target
      : allRamalesForPlan.find((r) => r.net === netId && r.mergesFrom?.includes(target.id!));
    if (!hostR?.mergesFrom) {
      const g = geomKeysForSan();
      return g.length > 0 ? g : null;
    }
    const [aId, bId] = hostR.mergesFrom;
    if (!aId || !bId) return null;
    // `hostR.mergesFrom` es siempre [existing.id, incoming.id] por construcción
    // (PlanoEngineDrawing.ts, autoSplitJunctionAndSumFlow). Cuál de los tres ramales de este
    // empalme (existing, hostR=downstream, incoming) MUESTRA el total combinado se decide solo por
    // la dirección actual del flujo — no está fijo a "existing" ni al "auto-creado":
    // junctionHasOutgoingFlow ya garantiza al menos uno de los tres flujos FUERA del empalme, así
    // que con tres ramales la división es siempre 2-vs-1, y el único disidente (el que discrepa de
    // los otros dos) es el entrante. Coincide con waterNetworkRows.ts / WaterNetworkDesign.tsx.
    if (!hostR.id || !hostR.pts || hostR.pts.length === 0) return null;
    // Para la sidebar de aparatos mostrar el combinado en CUALQUIERA de los participantes
    // (auto o fuente), no solo en el entrante — el usuario espera ver en RS3 (auto) el total
    // RS5+RS2 (+ RS1,RS4 transitivos), igual que la tabla TOTAL. Antes solo el entrante
    // (tributario) veía el combinado y RS3 quedaba en 0 ("muestra de menos").
    const targetIsInMerge = hostR.mergesFrom.includes(target.id!);
    if (!targetIsInMerge && hostR.id !== target.id) return null;
    const jc = hostR.pts[0];
    const existingObj = allRamalesForPlan.find((r) => r.id === aId);
    const incomingObj = allRamalesForPlan.find((r) => r.id === bId);
    // `resolveJunctionEntrant` = la pata MINORITARIA por rol de flujo del empalme: 2 salidas +
    // 1 entrada → la ENTRADA; 2 entradas + 1 salida → la SALIDA (orig. usuario AF/AC/gas).
    const entrantId = existingObj
      ? resolveJunctionEntrant(
          jc,
          existingObj,
          { id: hostR.id, pts: hostR.pts, _tribReversed: Boolean(hostR._tribReversed) },
          incomingObj,
        )
      : aId;
    // AF/AC/gas (orig. usuario): SOLO la pata única muestra el combinado y es de solo lectura;
    // las otras dos patas muestran sus UDs propias y quedan asignables manualmente. San/ll
    // conserva el comportamiento anterior (combinado en cualquiera de los participantes).
    const esRedAgua = netId === 'af' || netId === 'ac' || netId === 'gas';
    if (esRedAgua ? entrantId !== target.id : hostR.id !== target.id && entrantId !== target.id)
      return null;
    // TRANSITIVIDAD: un ramal auto-creado puede ser a su vez fuente de un empalme aguas arriba
    // (cadena RS1+T1RS1→RS2, RS2+T2RS2→RS3). Las fuentes directas de RS3 incluyen a RS2, que
    // es también un merge point sin aparatos propios — sus conteos viven en RS1/T1RS1. Sumar
    // solo un nivel dejaba el panel de RS3 con los aparatos del tributario directo pero sin la
    // cadena acumulada (la tabla de diseño sí muestra el total transitivo). Recolectar todo el
    // subárbol aguas arriba (cada ramal aparece una sola vez).
    const seen = new Set<string>();
    const allKeys: string[] = [];
    const collect = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      if (id !== target.id) allKeys.push(keyFor(id));
      const r = allRamalesForPlan.find((x) => x.id === id);
      if (r?.mergesFrom) for (const src of r.mergesFrom) collect(src);
    };
    collect(hostR.id);
    // Unión con geom para robustez (cubre extremo-a-extremo donde mergesFrom no registra un
    // alimentador pero geométricamente sí existe).
    const geomExtra = geomKeysForSan().filter((k) => !allKeys.includes(k));
    return geomExtra.length > 0 ? [...allKeys, ...geomExtra] : allKeys;
  })();

  // Ramales que SALEN de un bajante: la COLA de la flecha de flujo queda del lado del bajante
  // (criterio del usuario). Vive en fixturesStorage (salidasDeBajante); el wrapper conserva la
  // firma que usan agregadoBajante/currentMap/esEspejoBajante.
  const exitsDeBajante = useCallback(
    (bajId: string): Set<string> => salidasDeBajante(engineRef.current, bajId),
    [engineRef],
  );

  // Agregado de UDs del bajante: clave propia + UDs de todos sus descendientes en el árbol
  // sanitario (ramales y tributarios que drenan en él, transitivo), excepto los ramales de
  // SALIDA (espejos) con su subárbol — jamás son fuente, para evitar el eco espejo→agregado
  // →espejo. Compartido entre el display (currentMap) y la asignación automática (efecto):
  // el número del panel del bajante y el copiado al ramal siempre coinciden.
  const agregadoBajante = useCallback(
    (bajId: string): Record<string, number> => {
      const agg: Record<string, number> = {};
      const ownKey = planId ? countKey(netId, bajId, planId) : `${netId}_${bajId}`;
      for (const [k, v] of Object.entries(counts[ownKey] || {}))
        agg[k] = (agg[k] || 0) + (v as number);
      const exits = exitsDeBajante(bajId);
      // Suma el storageKey de un tramo; sin counts propios usa sus fixtures directos.
      const sumCounts = (ck: string, fixtures?: Record<string, number>) => {
        const m = counts[ck] || {};
        if (Object.keys(m).length > 0) {
          for (const [k, v] of Object.entries(m)) agg[k] = (agg[k] || 0) + (v as number);
        } else if (fixtures) {
          for (const [k, v] of Object.entries(fixtures)) agg[k] = (agg[k] || 0) + (v as number);
        }
      };
      const visited = new Set<string>();
      const walkKey = (tKey: string) => {
        if (visited.has(tKey)) return;
        visited.add(tKey);
        const ct = tramosPiso.find((x) => x._key === tKey);
        if (!ct) return;
        if (!ct.esBajante) {
          // Espejo (salida): no suma NI recorre su subárbol. Doble guard: referencia
          // explícita (alimentaIds / ini = código) ADEMÁS del set geométrico — una salida
          // que la geometría no detecta (ramal corto junto a una caja) no puede volver al
          // walk, o su clave (que ya contiene el agregado) crecería en cada pasada.
          const bajRef = engineRef.current?.bajantes.find((b) => b.id === bajId);
          if (
            exits.has(ct.id) ||
            (bajRef &&
              ((bajRef.alimentaIds || []).includes(ct.id) || ct.ini === (bajRef.code || bajRef.id)))
          )
            return;
          // Cada tramo aporta con SU propia clave (su planId): los hijos pueden ser de otro
          // piso (enlace de asociación entre pisos) y sus UDs viven bajo el plan de origen.
          if (ct.tipo === 'ramal' || ct.tipo === 'tributario')
            sumCounts(
              planId ? `${netId}_${ct.id}_${planId}` : `${netId}_${ct.id}`,
              ct.fixtures as Record<string, number> | undefined,
            );
        }
        for (const child of sanConnectivity?.fullChildrenMap[tKey] || []) walkKey(child);
      };
      const bajT = tramosPiso.find((t) => t.esBajante && t.id === bajId);
      // El árbol sanitario solo existe en san/ll — para montantes/suministro (af/ac/gas) o sin
      // conectividad, el agregado va por el FALLBACK (recibeDeIds + tributarios por padre): es
      // donde viven los ramales que el montante alimenta. Con `bajT` pero conectividad null el
      // walk sumaba CERO (orig. usuario: "no aparecen las uds del ramal conectado").
      if (sanConnectivity && bajT?._key) {
        for (const child of sanConnectivity?.fullChildrenMap[bajT._key] || []) walkKey(child);
      } else {
        // Fallback sin árbol sanitario: ramales asociados (recibeDeIds) + cadenas de
        // tributarios colgantes. `seen` incluye las salidas EXPLÍCITAS (alimentaIds), no solo
        // las geométricas: sin engine (o con geometría ambigua) una salida con la clave ya
        // espejada volvería al walk y re-fusionaría el agregado en su propia clave en cada
        // pasada (misma familia que el dup de caja AN / suma infinita de bomba).
        // MONTANTES (orig. usuario): sus ramales nacen EN él (la dirección de flujo los hace
        // parecer "salidas") pero son sus ALIMENTADOS — se suman, jamás se excluyen.
        const eng = engineRef.current;
        const baj = eng?.bajantes.find((b) => b.id === bajId);
        const esMontante = baj?.tipo === 'montante';
        const seen = new Set<string>([
          bajId,
          ...(esMontante ? [] : exits),
          ...(baj?.alimentaIds || []),
        ]);
        const sum = (rid: string) => {
          if (seen.has(rid)) return;
          seen.add(rid);
          sumCounts(planId ? `${netId}_${rid}_${planId}` : `${netId}_${rid}`);
          for (const trib of eng?.ramales || [])
            if (trib.tipo === 'tributario' && (trib.net ?? netId) === netId && trib.padre === rid)
              sum(trib.id);
        };
        for (const rid of baj?.recibeDeIds || []) sum(rid);
      }
      return agg;
    },
    [counts, netId, planId, sanConnectivity, tramosPiso, exitsDeBajante, engineRef],
  );

  // Cluster de espejos/herencia (rediseño): sanado de sifones + propagación + espejos
  // cross-floor — ver fixtures/useFixtureMirrors.ts.
  useFixtureMirrors({
    engineRef,
    loadingPlanRef,
    netId,
    planId,
    plans,
    planLoadedTick,
    targetId,
    counts,
    setCounts,
    hidroData,
    setHidroData,
    agregadoBajante,
    exitsDeBajante,
  });

  const currentMap = useFixtureTarget({
    netId,
    storageKey,
    targetId,
    mergeKeys,
    isBajanteSan,
    planId,
    selElement,
    counts,
    hidroData,
    plans,
    engineRef,
    agregadoBajante,
    exitsDeBajante,
  });

  const curHidro = useMemo(() => hidroDeClave(hidroData, storageKey), [hidroData, storageKey]);

  const total = useMemo(
    () => totalDeUnidades(items, currentMap, unitKey, storageKey),
    [items, currentMap, unitKey, storageKey],
  );

  // Total de unidades MANUALES propias de este tramo: carga de la clave MENOS el libro
  // de herencia (auditoría #4 — antes sumaba la carga completa y un tramo con solo
  // heredado bloqueaba su primer manual). El cap del ítem 6 aplica solo sobre lo propio.
  const ownTotal = useMemo(() => ownTotalDe(counts, storageKey), [counts, storageKey]);
  const esPropio = (apId: string): boolean => esPropioDe(counts, storageKey, apId);

  const totalStr = useMemo(() => {
    if (Number.isInteger(total)) return String(total);
    return total.toFixed(2);
  }, [total]);

  // Asignación automática (orig. usuario): los ramales que SALEN de un bajante deben tener
  // las MISMAS UDs que el bajante. "Sale" = cola de la flecha de flujo del lado del bajante
  // (exitsDeBajante, geométrico); el valor copiado es el MISMO agregado que muestra el panel
  // del bajante (agregadoBajante, compartido con currentMap). Recorre TODOS los bajantes de
  // la red activa en cada cambio de conteos o selección: editar un ramal que drena en BAN1
  // actualiza su ramal de salida al momento, sin depender de qué tramo está seleccionado.

  // Ramal de salida de un bajante (espejo): sus UDs las manda el bajante — panel en modo
  // opaco/solo lectura, igual que el panel de bajante. Sin chequeo de target.tipo: el elemento
  // seleccionado puede llegar sin tipo (por eso isCountableTarget usa prefijos del id) y el
  // conjunto de salidas ya solo contiene ramales por construcción.
  const esEspejoBajante = useMemo(() => {
    if (!targetId) return false;
    // MONTANTES asociados entre pisos (orig. usuario): mismo solo-lectura que bajantes, en su
    // red (af/ac/gas/vent). El resto de gates de espejos quedan en san/ll como estaban.
    const esRedAsociable =
      netId === 'san' ||
      netId === 'll' ||
      netId === 'af' ||
      netId === 'ac' ||
      netId === 'gas' ||
      netId === 'vent';
    if (!esRedAsociable) return false;
    if (selElement?.tipo === 'montante') {
      const origenM = selElement as { origenId?: string };
      if (origenM.origenId) return true;
    }
    if (netId !== 'san' && netId !== 'll') return false;
    // Todo Ldesvio es el espejo del bajante superior — siempre solo lectura.
    if (targetId.startsWith('LD_')) return true;
    // Bajante asociado desde arriba (origenId) o a una bomba (bombaEnId): UDs del grupo.
    const origen = selElement as { origenId?: string; bombaEnId?: string } | null;
    if (origen?.origenId || origen?.bombaEnId) return true;
    const eng = engineRef.current;
    if (!eng) return false;
    for (const baj of eng.bajantes) {
      if (baj.net !== netId) continue;
      if (exitsDeBajante(baj.id).has(targetId)) return true;
    }
    return false;
  }, [targetId, netId, selElement, exitsDeBajante, engineRef]);

  // Mutaciones de aparatos (movidas a fixtures/useFixtureMutations.ts — Oleada rediseño):
  // el ctx viaja como objeto; mutarInc/mutarDec son pinnables sin harness de React.
  const { inc, dec } = useFixtureMutations({
    netId,
    storageKey,
    targetId,
    target,
    mergeKeys,
    esEspejoBajante,
    esPropagado,
    rejillasArea,
    ownTotal,
    counts,
    setCounts,
    engineRef,
    selElement,
    setSelElement,
    esPropio,
  });

  // Escritura directa (write-through): cada handler guarda en disco al mutar. El antiguo
  // efecto de re-guardado ciego (`saveAll(counts)` ante cualquier cambio) pisaba escrituras
  // externas del menú contextual con estado React viejo entre el save y el reload del evento
  // → el primer clic "no hacía nada" de forma intermitente. Ya no existe ese efecto.
  const gasAccMap = useMemo(() => {
    if (!targetId) return {};
    return gasAcc[targetId] || {};
  }, [gasAcc, targetId]);

  const { incAcc, decAcc, incAccGas, decAccGas } = useFixtureAccMutations({
    storageKey,
    gasTargetKey,
    setHidroData,
    setGasAcc,
  });

  // Ítem: las orientaciones del codo 90° medio se fusionan en UNA sola fila de la sidebar —
  // el contador suma medio + sube + baja, independiente de la orientación pedida. La fila
  // única se llama igual que el id base; +/− escriben sobre ids REALES vivos (para AF/AC un
  // codo manual en 'codo90rm' sería borrado por calcHydroAccessories al re-sincronizar desde
  // los campos del ramal, así que el + escribe 'codo90rmSube'; el − quita de la orientación
  // que tenga unidades primero).
  const AFAC_CODO_MERGE: Record<string, string[]> = {
    codo90rm: ['codo90rm', 'codo90rmSube', 'codo90rmBaja'],
  };
  const GAS_CODO_MERGE: Record<string, string[]> = {
    codos_90_std: ['codos_90_std', 'codos_90_std_sube', 'codos_90_std_baja'],
    codos_90_rl: ['codos_90_rl', 'codos_90_rl_sube', 'codos_90_rl_baja'],
  };

  const afAcAccItems = useMemo(
    () =>
      ACCESORIOS_HIDRO.filter(
        (a) =>
          ![
            'teeDirecto',
            'teeSube',
            'teeBaja',
            'teeTapon',
            'teeLlaveTerminal',
            'tapon',
            'llaveTerminal',
          ].includes(a.id) &&
          a.id !== 'codo90rmSube' &&
          a.id !== 'codo90rmBaja',
      ).map((a) => (a.id === 'codo90rm' ? { ...a, nombre: 'Codo medio 90°' } : a)),
    [],
  );
  const gasAccItems = useMemo(
    () => GAS_ACCESORIOS.filter((a) => !a.id.endsWith('_sube') && !a.id.endsWith('_baja')),
    [],
  );

  const accCodoInc = (accId: string) => incAcc(accId === 'codo90rm' ? 'codo90rmSube' : accId);
  const accCodoDec = (accId: string) => {
    if (accId !== 'codo90rm') return decAcc(accId);
    const acc = curHidro.accesorios || {};
    const target = ['codo90rmSube', 'codo90rmBaja', 'codo90rm'].find((k) => (acc[k] || 0) > 0);
    if (target) decAcc(target);
  };
  const gasCodoDec = (accId: string) => {
    const acc = gasAccMap;
    const target = [accId, `${accId}_sube`, `${accId}_baja`].find((k) => (acc[k] || 0) > 0);
    if (target) decAccGas(target);
  };

  // AGUAS LLUVIAS (rediseño): panel propio — ver fixtures/LlAssociationsPanel.tsx.
  if (netId === 'll') {
    return (
      <LlAssociationsPanel
        netId={netId}
        selElement={selElement}
        setSelElement={setSelElement}
        engineRef={engineRef}
        bajantesLl={bajantesLl}
      />
    );
  }
  if (!visible) {
    return (
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
        <div
          style={{
            fontFamily: "'Geist',monospace",
            fontSize: 12,
            color: 'var(--txt3)',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Cuantificación de aparatos
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--txt2)',
            fontFamily: "'Geist',monospace",
            padding: '4px 0',
            lineHeight: 1.5,
          }}
        >
          Esta red no cuantifica aparatos sanitarios.
        </div>
      </div>
    );
  }

  const netObj = NETS.find((n) => n.id === netId);
  const accent = netObj?.col || '#2563EB';

  const headerLbl = isGas ? ' Aparatos' : ' Aparatos';
  const isActive = !!targetId;
  const containerStyle = {
    borderBottom: '1px solid #3a494a',
    background: pulse ? 'rgba(37,99,235,.10)' : 'transparent',
    transition: 'background .8s ease',
    boxShadow: pulse ? `inset 0 0 0 1px ${accent}` : 'none',
  };

  return (
    <>
      <SecMontantes
        netId={netId}
        engineRef={engineRef}
        targetId={targetId}
        targetLbl={targetLbl}
        accent={accent}
        selElement={selElement}
        setSelElement={setSelElement}
      />
      <div ref={containerRef} style={containerStyle}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          style={FixturesPanel_S1}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: isActive ? accent : 'transparent',
                border: isActive ? 'none' : '1px solid #3a494a',
                flexShrink: 0,
                boxShadow: isActive ? `0 0 8px ${accent}` : 'none',
              }}
            />
            <span style={FixturesPanel_S2}>{headerLbl}</span>
          </div>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: accent,
                fontFamily: "'Geist',monospace",
                background: 'rgba(37,99,235,.1)',
                border: `1px solid ${accent}55`,
                borderRadius: 3,
                padding: '1px 7px',
                whiteSpace: 'nowrap',
              }}
            >
              {totalStr} {unidadLbl}
            </span>
            <span
              style={{
                fontSize: 12,
                color: 'var(--txt2)',
                fontFamily: "'Geist',monospace",
                flexShrink: 0,
              }}
            >
              {open ? '▾' : '▸'}
            </span>
          </div>
        </button>

        {open && (
          <div style={{ padding: '0 10px 10px' }}>
            {targetId ? (
              <div style={FixturesPanel_S3}>
                <span>
                  Asignado a <span style={{ color: accent, fontWeight: 700 }}>{targetLbl}</span>
                </span>
              </div>
            ) : (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--txt2)',
                  fontFamily: "'Geist',monospace",
                  textAlign: 'center',
                  marginBottom: 6,
                  padding: '2px 0',
                }}
              >
                {rejillasArea
                  ? 'Selecciona un área de sector en el dibujo'
                  : isGas
                    ? 'Selecciona un tramo de gas'
                    : 'Selecciona un ramal/bajante en el dibujo'}
              </div>
            )}

            <div
              style={{
                opacity: targetId ? 1 : 0.45,
                pointerEvents: targetId ? 'auto' : 'none',
                transition: 'opacity .25s',
                filter: targetId ? 'none' : 'grayscale(.6)',
              }}
            >
              {selElement?.tipo === 'contador' ? (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--txt3)',
                    padding: '24px 0',
                    textAlign: 'center',
                  }}
                >
                  La sección de aparatos no aplica para el contador.
                </div>
              ) : (
                <>
                  <FixtureGrid
                    items={items}
                    currentMap={currentMap}
                    unitKey={unitKey}
                    unidadLbl={unidadLbl}
                    inc={inc}
                    dec={dec}
                    targetId={targetId}
                    accent={accent}
                    disabled={
                      isBajanteSan || esEspejoBajante || esPropagado
                        ? true
                        : !!mergeKeys && netId === 'gas' && ownTotal <= 0
                    }
                  />

                  {items.length === 0 && (
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--txt3)',
                        padding: '24px 0',
                        textAlign: 'center',
                      }}
                    >
                      No hay aparatos en esta red. Dibuje ramales en el visor para agregarlos.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {isAfAc && selElement?.tipo !== 'calentador' && (
          <AccesoriosSection
            targetId={targetId}
            curHidro={curHidro}
            incAcc={accCodoInc}
            decAcc={accCodoDec}
            accent={accent}
            items={afAcAccItems}
            merge={AFAC_CODO_MERGE}
          />
        )}
        {isGas && !rejillasArea && (
          <AccesoriosSection
            targetId={targetId}
            curHidro={{ accesorios: gasAccMap }}
            incAcc={incAccGas}
            decAcc={gasCodoDec}
            accent={accent}
            items={gasAccItems}
            merge={GAS_CODO_MERGE}
          />
        )}
      </div>
    </>
  );
});
export default AparatosPanel;
