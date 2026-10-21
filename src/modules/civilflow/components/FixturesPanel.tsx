import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { itemsDelPanel } from './fixtures/panelItems.ts';
import { calcularMergeKeys } from './fixtures/mergeKeys.ts';
import { TRAZOS_PREFIX } from '../constants/storage-keys.ts';
import { useRainwater } from '../context/RainwaterContext.tsx';
import { leerHeredadosPresion, leerFoldTribPresion } from '../utils/propagation';
import {
  EV_APARATOS_CLEAR,
  EV_SAN_SYNC,
  EV_HIDRO_SYNC,
  EV_PLAN_LOADED,
  EV_STORAGE,
} from '../utils/fixtureEvents.ts';
import { ACCESORIOS_HIDRO, GAS_ACCESORIOS } from '../constants';
import { NETS } from '../lib/PlanoEngine/PlanoState.ts';
import { usePlans } from '../context/PlansContext.tsx';
import { useApparatus } from '../context/ApparatusContext.tsx';
import {
  writeSanDrawingSync,
  writeHydroDrawingSync,
  setSyncLoadedLiveIds,
} from '../utils/drawingSync.ts';
import type { DrawingData } from '../utils/drawingSync.ts';
import FixtureGrid from './fixtures/FixtureGrid.tsx';
import { SecMontantes } from './fixtures/SecMontantes';
import AccesoriosSection from './fixtures/AccessoriesSection.tsx';
import { startRejillasGasodSync, hidratarRejillasGasod } from './rejillasGasodSync';
import { devError } from '../../../utils/devError.ts';
import { loadFromStorage, saveToStorage } from '../services/storageService.ts';
import {
  UNIDAD,
  loadAll,
  loadHidroData,
  loadGasAcc,
  unitFor,
  isCountableTarget,
  type CountsMap,
  type HidroDataMap,
  type GasAccMap,
  type SelectableTarget,
  stableStringify,
  salidasDeBajante,
} from './fixturesStorage.ts';
import { hidroDeClave, totalDeUnidades, ownTotalDe, esPropioDe } from './fixturesStorage.ts';
import { podarGasAccPorPlanos } from '../utils/drawingSyncGc.ts';
import { useFixtureAccMutations } from './fixtures/useFixtureAccMutations.ts';
import { useFixtureMirrors } from './fixtures/useFixtureMirrors.ts';
import { useFixtureMutations } from './fixtures/useFixtureMutations.ts';
import { useFixtureTarget } from './fixtures/useFixtureTarget.ts';
import { agregarCargaDeBajante } from './fixtures/bajanteAggregate.ts';

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

const HIDROSAN_IDS = new Set(['af', 'ac', 'san']);
const GAS_ID = 'gas';
import { LlAssociationsPanel } from './fixtures/LlAssociationsPanel';
import { bajanteLabel, ramalLabel } from '../utils/accessoryAbbreviations.ts';

import type PlanoEngine from '../lib/PlanoEngine/PlanoEngine.ts';
import { useTramos } from '../context/TramosContext.tsx';
import { buildSanConnectivity } from '../utils/sanitaryRows.ts';
import type { ProbedElement } from './pdfViewer/drawingElementContextMenu/context.ts';

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
  // Tick de libros de propagación (heredados/fold se leen directo en render): se bumpnea
  // tras cada corrida aunque los conteos no cambien, para no pintar rancio.
  const [librosTick, setLibrosTick] = useState(0);
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

  const items = useMemo(() => itemsDelPanel(netId, unitKey, aps as never), [netId, unitKey, aps]);

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
      items as unknown as import('../utils/sanitaryRows.ts').MergedApBase[],
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
  const mergeKeys = useMemo(
    () =>
      target?.id && netId
        ? calcularMergeKeys({
            target: target as never,
            netId,
            planId,
            allRamalesForPlan: allRamalesForPlan as never,
            bajantes: (engineRef.current?.bajantes ?? []) as never,
          })
        : null,
    [target, netId, planId, allRamalesForPlan, engineRef],
  );

  // Ramales que SALEN de un bajante: la COLA de la flecha de flujo queda del lado del bajante
  // (criterio del usuario). Vive en fixturesStorage (salidasDeBajante); el wrapper conserva la
  // firma que usan agregadoBajante/currentMap/esEspejoBajante.
  const exitsDeBajante = useCallback(
    (bajId: string): Set<string> => salidasDeBajante(engineRef.current, bajId),
    [engineRef],
  );

  // Tramo con herencia propagada (RAF3, orig. usuario): sus UDs las trae aguas arriba — el
  // panel se vuelve SOLO LECTURA (opaco); la edición es en los ramales/montante fuente.
  // Criterio POR RED (orig. usuario: igual en todas): presión (af/ac/gas) lee los DOS libros
  // del propagador — heredados (uniones/montante) y plegado de TRIBUTARIOS (el padre es
  // receptor de lo que sus tributarios conectados traen); san/ll son receptores si (a) su
  // clave aparece como DESTINO en el libro ucAplicado de algún bajante del piso, (b) son
  // SALIDA de un bajante (el espejo reescribe su clave completa), o (c) tienen TRIBUTARIOS
  // conectados que traen aparatos (DFS por `padre` — el plegado sanitario sube al ramal).
  const esPropagado = useMemo(() => {
    if (!storageKey || !targetId) return false;
    if (netId === 'af' || netId === 'ac' || netId === 'gas') {
      const her = leerHeredadosPresion(storageKey);
      const fold = leerFoldTribPresion(storageKey);
      return (
        Object.values(her).some((v: number) => v > 0) ||
        Object.values(fold).some((v: number) => v > 0)
      );
    }
    if (netId === 'san' || netId === 'll') {
      try {
        const d = loadFromStorage<{
          bajantes?: Array<{ ucAplicado?: Record<string, Record<string, number>> }>;
        } | null>(TRAZOS_PREFIX + String(planId ?? ''), null);
        for (const b of d?.bajantes || []) {
          const e = (b.ucAplicado || {})[storageKey];
          if (e && Object.keys(e).some((k) => (e[k] || 0) > 0)) return true;
        }
      } catch {
        /* sin storage: no bloquear */
      }
      const eng = engineRef.current;
      if (eng) {
        // (b) Salida de un bajante: el espejo reescribe su clave en cada pase.
        for (const b of eng.bajantes || []) {
          if (b.net !== netId) continue;
          if (exitsDeBajante(b.id).has(targetId)) return true;
        }
        // (c) Tributarios conectados: cualquier descendiente por `padre` con aparatos propios
        // bloquea — su carga sube al ramal por plegado (el ramal no es fuente).
        const vistas = new Set<string>([targetId]);
        const cola: string[] = [targetId];
        while (cola.length > 0) {
          const actual = cola.pop() as string;
          for (const r of eng.ramales || []) {
            if (r.net !== netId || r.padre !== actual || vistas.has(r.id)) continue;
            vistas.add(r.id);
            const m = counts[`${netId}_${r.id}_${planId}`] || {};
            if (Object.values(m).some((v: number) => v > 0)) return true;
            cola.push(r.id);
          }
        }
      }
    }
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- librosTick fuerza relectura del libro tras propagar
  }, [storageKey, netId, planId, librosTick, targetId, engineRef, exitsDeBajante, counts]);

  // Agregado de UDs del bajante: clave propia + UDs de todos sus descendientes en el árbol
  // sanitario (ramales y tributarios que drenan en él, transitivo), excepto los ramales de
  // SALIDA (espejos) con su subárbol — jamás son fuente, para evitar el eco espejo→agregado
  // →espejo. Compartido entre el display (currentMap) y la asignación automática (efecto):
  // el número del panel del bajante y el copiado al ramal siempre coinciden.
  const agregadoBajante = useCallback(
    (bajId: string): Record<string, number> =>
      agregarCargaDeBajante({
        bajId,
        counts,
        netId,
        planId,
        sanConnectivity,
        tramosPiso: tramosPiso as never,
        exits: exitsDeBajante(bajId),
        engineRef: engineRef as never,
      }),
    [counts, netId, planId, sanConnectivity, tramosPiso, exitsDeBajante, engineRef],
  );

  // Cluster de espejos/herencia (rediseño): sanado de sifones + propagación + espejos
  // cross-floor — ver aparatos/useAparatoEspejos.ts.
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
    onLibrosChange: () => setLibrosTick((t) => t + 1),
  });

  const currentMap = useFixtureTarget({
    netId,
    librosTick,
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

  // Mutaciones de aparatos (movidas a aparatos/useAparatoMutaciones.ts — Oleada rediseño):
  // el ctx viaja como objeto; mutarInc/mutarDec son pinnables sin harness de React.
  const { inc, dec } = useFixtureMutations({
    netId,
    storageKey,
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

  // AGUAS LLUVIAS (rediseño): panel propio — ver aparatos/LlAssociationsPanel.tsx.
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

  const headerLbl = ' Aparatos';
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
                opacity: !targetId ? 0.45 : esPropagado ? 0.55 : 1,
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
