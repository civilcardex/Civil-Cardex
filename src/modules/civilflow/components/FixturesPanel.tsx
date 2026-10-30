import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { itemsDelPanel } from './fixtures/panelItems.ts';
import { calcularMergeKeys } from './fixtures/mergeKeys.ts';
import { useRainwater } from '../context/RainwaterContext.tsx';
import { EV_PLAN_LOADED } from '../utils/fixtureEvents.ts';
import { NETS } from '../lib/PlanoEngine/PlanoState.ts';
import { usePlans } from '../context/PlansContext.tsx';
import { useApparatus } from '../context/ApparatusContext.tsx';
import FixtureGrid from './fixtures/FixtureGrid.tsx';
import { SecMontantes } from './fixtures/montantesSection';
import { usePanelStorageSync } from './fixtures/usePanelStorageSync.ts';
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
  salidasDeBajante,
} from './fixturesStorage.ts';
import { hidroDeClave, totalDeUnidades, ownTotalDe, esPropioDe } from './fixturesStorage.ts';
import { useFixtureAccMutations } from './fixtures/useFixtureAccMutations.ts';
import { useFixtureMirrors } from './fixtures/useFixtureMirrors.ts';
import { useFixtureMutations } from './fixtures/useFixtureMutations.ts';
import { useFixtureTarget } from './fixtures/useFixtureTarget.ts';
import { LlAssociationsPanel } from './fixtures/LlAssociationsPanel';
import { FIXTURES_NOTA, containerStyle, gridWrapperStyle } from './fixtures/panelStyles.ts';
import {
  PanelAccesoriosAfAc,
  PanelAccesoriosGas,
  PanelAsignadoA,
  PanelCuerpo,
  PanelHeader,
  PanelNoCuantifica,
  PanelSinSeleccion,
} from './fixtures/FixtureRows.tsx';
import {
  agregadoBajanteDe,
  esEspejoDeBajante,
  esTramoPropagado,
  etiquetaDelTarget,
  leerRamalesDePlan,
} from './fixtures/useFixturePanelModel.ts';

import type PlanoEngine from '../lib/PlanoEngine/PlanoEngine.ts';
import { useTramos } from '../context/TramosContext.tsx';
import { buildSanConnectivity } from '../utils/sanitaryRows.ts';
import type { ProbedElement } from './pdfViewer/drawingElementContextMenu/context.ts';

const HIDROSAN_IDS = new Set(['af', 'ac', 'san']);
const GAS_ID = 'gas';

/**
 * Panel de cuantificación de aparatos (UC en agua fría/caliente/gas, UD en sanitaria/lluvias):
 * lista la red activa, suma +/- por aparato sobre el tramo seleccionado y refleja herencias
 * (espejos/propagación) en solo lectura.
 * Ej: selecciono el ramal RAF1 en el visor -> el panel muestra sus lavamanos con sus UC.
 */
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

  // Sincronización con storage/BD (poda gas, rejillas, recarga por eventos, blobs san/hidro):
  // los 4 efectos viven en fixtures/usePanelStorageSync.ts, en el mismo orden.
  usePanelStorageSync({
    plans,
    setCounts,
    setHidroData,
    setGasAcc,
    counts,
    hidroData,
    engineRef,
    loadingPlanRef,
  });

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
  // (orig. usuario pt. 2). Reactiva: selElement se re-deriva en cada dirty del engine.
  const targetLbl = etiquetaDelTarget(target, {
    rejillasArea,
    nivelLbl: engineRef.current?.nivelActual?.label || undefined,
  });
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

  // Keys de las fuentes de fusión — un ramal auto-creado (por corte en medio de un empalme)
  // arranca sin aparatos propios; el ramal que MUESTRA la UC combinada (que puede ser el
  // auto-creado o una de sus dos fuentes — la que su flujo entre al empalme) debe en cambio
  // reflejar los conteos combinados de los OTROS dos participantes, de solo lectura, para que el
  // usuario no se quede mirando ceros/parciales en un tramo que visiblemente los lleva todos.
  // Se recalcula plano en cada render (no useMemo) porque depende de allRamalesForPlan, que a su
  // vez se re-lee fresco en cada render (leerRamalesDePlan).
  const allRamalesForPlan = leerRamalesDePlan(planId, engineRef);
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

  // Tramo con herencia propagada (RAF3): panel en SOLO LECTURA — el criterio completo (por
  // red) vive en useFixturePanelModel.esTramoPropagado.
  const esPropagado = useMemo(() => {
    return esTramoPropagado({
      storageKey,
      targetId,
      netId,
      planId,
      counts,
      engineRef,
      exitsDeBajante,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- librosTick fuerza relectura del libro tras propagar
  }, [storageKey, netId, planId, librosTick, targetId, engineRef, exitsDeBajante, counts]);

  // Agregado de UDs del bajante: clave propia + UDs de todos sus descendientes en el árbol
  // sanitario (ramales y tributarios que drenan en él, transitivo), excepto los ramales de
  // SALIDA (espejos) con su subárbol — jamás son fuente, para evitar el eco espejo→agregado
  // →espejo. Compartido entre el display (currentMap) y la asignación automática (efecto):
  // el número del panel del bajante y el copiado al ramal siempre coinciden.
  const agregadoBajante = useCallback(
    (bajId: string): Record<string, number> =>
      agregadoBajanteDe({
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
  // opaco/solo lectura, igual que el panel de bajante. Criterio completo (montantes
  // asociados, LD_, origenId/bombaEnId, salidas) en useFixturePanelModel.esEspejoDeBajante.
  const esEspejoBajante = useMemo(
    () =>
      esEspejoDeBajante({
        targetId,
        netId,
        selElement,
        engineRef,
        exitsDeBajante,
      }),
    [targetId, netId, selElement, exitsDeBajante, engineRef],
  );

  // Mutaciones de aparatos (en fixtures/useFixtureMutations.ts): el ctx viaja como objeto;
  // mutarInc/mutarDec son pinnables sin harness de React.
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
  // única se llama igual que el id base; +/− escriben sobre ids REALES vivos (los criterios
  // de decremento viven en useFixturePanelModel y los bloques JSX en FixtureRows).

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
    return <PanelNoCuantifica />;
  }

  const netObj = NETS.find((n) => n.id === netId);
  const accent = netObj?.col || '#2563EB';

  const headerLbl = ' Aparatos';
  const isActive = !!targetId;

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
      <div ref={containerRef} style={containerStyle(pulse, accent)}>
        <PanelHeader
          open={open}
          onToggle={() => setOpen((o) => !o)}
          isActive={isActive}
          accent={accent}
          headerLbl={headerLbl}
          totalStr={totalStr}
          unidadLbl={unidadLbl}
        />

        {open && (
          <PanelCuerpo>
            {targetId ? (
              <PanelAsignadoA targetLbl={targetLbl} accent={accent} />
            ) : (
              <PanelSinSeleccion rejillasArea={rejillasArea} isGas={isGas} />
            )}

            <div style={gridWrapperStyle(!!targetId, esPropagado)}>
              {selElement?.tipo === 'contador' ? (
                <div style={FIXTURES_NOTA}>La sección de aparatos no aplica para el contador.</div>
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
                    <div style={FIXTURES_NOTA}>
                      No hay aparatos en esta red. Dibuje ramales en el visor para agregarlos.
                    </div>
                  )}
                </>
              )}
            </div>
          </PanelCuerpo>
        )}

        {isAfAc && selElement?.tipo !== 'calentador' && (
          <PanelAccesoriosAfAc
            targetId={targetId}
            curHidro={curHidro}
            incAcc={incAcc}
            decAcc={decAcc}
            accent={accent}
          />
        )}
        {isGas && !rejillasArea && (
          <PanelAccesoriosGas
            targetId={targetId}
            gasAccMap={gasAccMap}
            incAccGas={incAccGas}
            decAccGas={decAccGas}
            accent={accent}
          />
        )}
      </div>
    </>
  );
});
export default AparatosPanel;
