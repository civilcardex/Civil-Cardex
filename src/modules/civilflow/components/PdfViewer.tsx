/* eslint-disable no-empty */
import { memo, useState, useRef, useEffect, useCallback, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import PlanoEngine, {
  type ElementItem,
  type ToolType,
  type TramoType,
} from '../lib/PlanoEngine/PlanoEngine';
import { NETS } from '../lib/PlanoEngine/PlanoState';
import type { PlanoElement } from '../lib/PlanoEngine/PlanoState';
import { aparatoEnExtremoInvalido } from '../lib/PlanoEngine/PlanoEngineDrawing';
import type { Piso } from '../lib/shared/projectTypes';
import type { PlanItem } from '../context/PlansContext';
import { matLongName, pisoLbl, DEFAULT_PENDIENTE_PCT } from '../constants';
import { useProject } from '../context/ProjectContext';
import { usePlans } from '../context/PlansContext';
import {
  writeSanDrawingSync,
  writeHydroDrawingSync,
  setSyncLoadedLiveIds,
} from '../utils/drawingSync';
import { isPlanKeyFor } from '../lib/PlanoEngine/networkRenumber';
import { loadFromStorage, saveToStorage, type PlanTrazos } from '../services/storageService';
import {
  GAS_ACC_KEY,
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
  ACTIVE_NETS_KEY,
  PDF_HIDDEN_NETS_KEY,
  PDF_LOCKED_NETS_KEY,
  TRAZOS_PREFIX,
} from '../constants/storage-keys';
import PdfViewerToolbar, { STATUS } from './pdfViewer/PdfViewerToolbar';

import { persistTrazosSnapshot, claveDeBorrado } from './pdfViewer/persistTrazos';
import { sleep } from './shared/sequentialLoad';
import PdfCanvas from './pdfViewer/PdfCanvas';
import PdfViewerNetworkBar from './pdfViewer/PdfViewerNetworkBar';
import { usePdfAutoSave } from './pdfViewer/usePdfAutoSave';
import { usePdfViewerEngine } from './pdfViewer/PdfViewerEngineInit';
import TextInputOverlay from './pdfViewer/TextInputOverlay';
import DrawingElementContextMenu from './pdfViewer/drawingElementContextMenu';
import type { ContextMenuState } from './pdfViewer/drawingElementContextMenu/context';
import ConfirmDialog from './pdfViewer/ConfirmDialog';
import AccesorioModal from './pdfViewer/FittingModal';
import TramoEditor from './pdfViewer/tramoEditor';
import BajanteAsociacion from './pdfViewer/BajanteAssociation';
import PdfViewerDrawnElements from './pdfViewer/PdfViewerDrawnElements';
import { CopyFromPlanPanel } from './pdfViewer/CopyFromPlanPanel';
import AparatosPanel from './FixturesPanel';
import { prefetchAllTrazos } from '../utils/prefetchTrazos';
import { applyAccesorioPlacement } from './pdfViewer/fittingPlacement';
import { useSessionVisorPrefs } from './pdfViewer/useSessionViewerPrefs';
import { useNetColorsInit } from './pdfViewer/useNetColorsInit';
import { useActiveNetsVisibility } from './pdfViewer/useActiveNetsVisibility';
import { useFloorRamales } from './pdfViewer/useFloorRamales';
import { useTrazosLoader } from './pdfViewer/useTrazosLoader';
import { useKeyboardShortcuts } from './pdfViewer/useKeyboardShortcuts';
import { distToPolyline } from '../lib/shared/geometry';
import { diamPulgFromLabel } from '../utils/diamPulgFromLabel';
import { devError } from '../../../utils/devError';
import { cargarMallas } from '../lib/PlanoEngine/nudos';
import { useIsMobile, useMediaQuery } from '../../../hooks/useMediaQuery';
const PdfViewer_SR_ONLY: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};
const PdfViewer_S4: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  background: '#1e2024',
  border: '1px solid #3a494a',
  borderRadius: 3,
  color: '#e2e2e8',
  fontSize: 12,
  fontFamily: "'Geist',monospace",
  cursor: 'pointer',
};
const PdfViewer_S5: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: 40,
  width: 16,
  height: 24,
  background: '#14161a',
  border: '1px solid #3a494a',
  color: '#22c55e',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  fontSize: 12,
} as const;
const PdfViewer_EMPTY_PISOS: Piso[] = [];
// Barra izquierda colapsada conserva una franja estrecha de iconos (herramientas + snap +
// acciones) en vez de desaparecer a 0 — coherente con el render colapsado de la propia
// toolbar en PdfViewerToolbar.tsx.
const LEFT_COLLAPSED_WIDTH = 44;

// Sonda estructural de la unión PlanoElement: permite leer `tipo`/`net`/`diametro`/`pendiente`
// (presentes en unos tipos de elemento, ausentes en otros) sin repetir narrowing con los
// type guards exportados en cada punto de acceso.
type ProbedElement = PlanoElement & {
  tipo?: string;
  net?: string;
  diametro?: string;
  pendiente?: number;
};

// Validación de cierre del visor: se ejecuta al pulsar "Cerrar dibujo" en la barra de redes.
// Bloquea el cierre (con alerta) mientras haya ramales sin UC/UD, elementos sin diámetro o
// bajantes con diámetro inferior al del ramal conectado. Devuelve true si el dibujo puede
// guardarse y cerrarse, false si se levantó alguna alerta.
type RevisarRamalInput = {
  net?: string;
  id?: string;
  label?: string;
  tipo?: string;
  uc?: number;
  aparatoInicio?: string;
  aparatoFin?: string;
  accesorioInicio?: string;
  accesorioFin?: string;
  fixtures?: Record<string, number>;
  pts?: number[][];
  ini?: string;
  _tribReversed?: boolean;
  mergesFrom?: unknown;
};

type BajanteAIndexar = {
  net?: string;
  id?: string;
  code?: string;
  alimentaIds?: string[];
  ucAplicado?: Record<string, unknown>;
};

/** Validación de cierre del visor: alerta si hay ramales sin UC/UD, elementos sin diámetro o
 *  bajantes con diámetro menor al del ramal conectado. Devuelve true si el dibujo puede
 *  guardarse y cerrarse. */
export function validateBeforeClose(
  eng: PlanoEngine,
  planos: PlanItem[] | undefined,
  onAlert: (title: string, msg: string) => void,
): boolean {
  // Ítem 10: antes de validar diámetros, todo ramal/tributario debe tener UC/UD o un
  // aparato/accesorio en sus extremos — un ramal sin carga aguas abajo produce una fila
  // vacía en las tablas de diseño. El UC/UD real se asigna en las tablas de diseño vía
  // los conteos de aparatos (fixtures en APARATOS_BY_TRAMO_KEY, clave
  // `${net}_${id}_${planId}`), no en el campo `uc` del motor (que nace en 0) — se lee
  // ese mapa para no marcar ramales que ya tienen UC asignado. Exclusiones confirmadas:
  // red vent (no lleva UC), los Ldesvio de bajante (auto LD_*) y los stubs automáticos
  // de tapón. Los tramos auto-creados por splits (mergesFrom) SÍ se validan: son la
  // continuación aguas abajo que acumula el UC de la cadena.
  const planId = eng._loadedPlanId;
  const aparatosMap = loadFromStorage<Record<string, Record<string, number>>>(
    APARATOS_BY_TRAMO_KEY,
    {},
  );
  // Ítem 10: las exclusiones confirmadas son vent, Ldesvio automáticos (LD_*) y stubs de
  // tapón — más las uniones tee en extremos (la tee conecta ramas que cargan su propio
  // UC/UD). Los tramos auto-creados por splits (mergesFrom) NO se excluyen: acumulan el
  // UC de la cadena y deben aparecer si nadie les asignó aparatos. Lo demás — un extremo
  // con codo, un tributario sin derivación visible, etc. — SÍ se lista si no tiene UC/UD.
  const TEE_END_IDS = new Set([
    'teeDirecto',
    'teeReduccion',
    'teeLado',
    'teeSube',
    'teeBaja',
    'teeTapon',
    'teeLlaveTerminal',
    'te_linea',
    'te_ramal',
  ]);
  const sinUc: { label: string; r: RevisarRamalInput; planFor: number | string | null }[] = [];
  // Tramos CON carga propia (uc/aparatos/fixtures/mapa): alimentadores potenciales del grafo.
  const conUd: { r: RevisarRamalInput; planFor: number | string | null }[] = [];
  const revisados = new Set<string>();
  // Espejos de salida y herencia (orig. usuario): un ramal/tributario SIN carga propia pero
  // que NACE de un bajante/caja (alimentaIds o ini = código) o figura en un libro de herencia
  // (ucAplicado) tiene sus UDs autoasignadas y su panel es de solo lectura — exigirle UD
  // propia bloquearía un cierre que el usuario no puede resolver. Pasan la validación.
  const salidasConDuenio = new Set<string>();
  const codigosBajante = new Set<string>();
  const conLibroHerencia = new Set<string>();
  const indexarBajantes = (bajantes: BajanteAIndexar[] | undefined) => {
    for (const b of bajantes || []) {
      if (!b || !b.id) continue;
      codigosBajante.add(`${b.net}_${b.code || b.id}`);
      for (const rid of b.alimentaIds || []) salidasConDuenio.add(`${b.net}_${rid}`);
      for (const k of Object.keys(b.ucAplicado || {})) conLibroHerencia.add(`${b.net}_${k}`);
    }
  };
  indexarBajantes(eng.bajantes);
  /** @returns true si el tramo queda CUBIERTO (con carga o no evaluable) — false si se flaggeó. */
  const revisarRamal = (r: RevisarRamalInput, planFor: number | string | null): boolean => {
    if (!r.net || !r.id) return true;
    // Los tramos auto-creados por suma de flujo (mergesFrom, continuación de una
    // bifurcación) ya llevan las UC/UD acumuladas según la dirección de flujo — no
    // deben disparar la alerta de pendientes.
    if (r.mergesFrom) return true;
    // La clave de dedupe INCLUYE el plan: el mismo id de ramal puede existir en
    // varios planos confirmados (pisos replicados), y uno con fixtures en un plano no
    // exime al mismo id en otro — sin el plan, el primer barrido marcaba "revisado" al
    // resto y la lista de UC/UD pendientes quedaba incompleta.
    const clave = `${r.net}_${r.id}_${planFor ?? 'engine'}`;
    if (revisados.has(clave)) return true;
    revisados.add(clave);
    if (r.net === 'vent') return true;
    // Aguas lluvias (orig. usuario): SIN chequeo de UC/UD — sus tramos no llevan unidades de
    // descarga. En ll el cierre valida solo diámetros.
    if (r.net === 'll') return true;
    if (r.id.startsWith('LD_')) return true;
    if (r.accesorioFin === 'tapon' || r.accesorioInicio === 'tapon') return true;
    const tipo = r.tipo || 'ramal';
    if (tipo !== 'ramal' && tipo !== 'tributario') return true;
    if ((r.uc || 0) > 0) {
      conUd.push({ r, planFor });
      return true;
    }
    if (r.aparatoInicio || r.aparatoFin) {
      conUd.push({ r, planFor });
      return true;
    }
    // Aparatos persistidos EN el elemento (PlanoRamal.fixtures — writeDiameterToDrawing/sync los
    // escriben): es carga asignada, igual que el mapa — sin esto, convertir ramal↔tributario
    // (o cualquier edición que recree el tramo) disparaba "UC/UD pendientes" con aparatos vivos
    // (orig. usuario).
    if (r.fixtures && Object.values(r.fixtures).some((v) => Number(v) > 0)) {
      conUd.push({ r, planFor });
      return true;
    }
    if (TEE_END_IDS.has(r.accesorioInicio || '') || TEE_END_IDS.has(r.accesorioFin || ''))
      return true;
    {
      // Cobertura por id Y por etiqueta: datos históricos podem keyear aparatos con la
      // etiqueta visible (T2RS7) mientras el id del engine es un uniq — sin esto el aviso
      // disparaba con aparatos visibles en el panel (orig. usuario).
      const prefixes = [`${r.net}_${r.id}`];
      if (r.label && r.label !== r.id) prefixes.push(`${r.net}_${r.label}`);
      const hasFixtures = Object.keys(aparatosMap).some(
        (k) =>
          prefixes.some((prefix) => k === prefix || k.startsWith(prefix + '_')) &&
          Object.keys(aparatosMap[k]).length > 0,
      );
      if (hasFixtures) {
        conUd.push({ r, planFor });
        return true;
      }
    }
    // Salida con dueño (espejo) o herencia por libro: UD autoasignada, panel solo lectura.
    if (salidasConDuenio.has(`${r.net}_${r.id}`)) {
      conUd.push({ r, planFor });
      return true;
    }
    if (r.ini && codigosBajante.has(`${r.net}_${r.ini}`)) {
      conUd.push({ r, planFor });
      return true;
    }
    if (conLibroHerencia.has(`${r.net}_${r.id}`)) {
      conUd.push({ r, planFor });
      return true;
    }
    sinUc.push({ label: r.label || r.id, r, planFor });
    return false;
  };
  // El nivel CARGADO es la autoridad para su net_id Y su ETIQUETA: los pisos replicados
  // guardan copias con ids uniq DISTINTOS pero la misma etiqueta (T3 en P1 y T3 en P2) — si el
  // T3 visible está cubierto, la copia sin aparatos de otro plano no dispara la alerta: el
  // usuario ve sus UDs asignadas y el aviso era un falso positivo por piso (orig. usuario:
  // T3 con 2 UD recibía el aviso tras borrar un segmento del brazo de la doble).
  const engineCovered = new Set<string>();
  const engineCoveredLabels = new Set<string>();
  for (const r of eng.ramales) {
    if (revisarRamal(r, planId)) {
      engineCovered.add(`${r.net}_${r.id}`);
      if (r.label) engineCoveredLabels.add(`${r.net}_${r.label}`);
    }
  }
  // El engine solo ve el NIVEL cargado — un nivel sin los planos confirmados restantes
  // dejaba la lista incompleta (ramales de otros planos sin UC/UD no salían). Se barren
  // los trazos guardados de cada plano confirmado con el mismo criterio, deduplicando
  // por red+id (el plano actual ya quedó cubierto por el engine).
  // Caché de parseo por cierre: el barrido UC/UD y el global de diámetros comparten una
  // única lectura/parseo por piso (el JSON de un plano se parseaba dos veces).
  const cacheTrazos = new Map<string, PlanTrazos | null>();
  const trazosDe = (id: string | number): PlanTrazos | null => {
    const key = String(id);
    if (!cacheTrazos.has(key)) cacheTrazos.set(key, leerTrazos(id));
    return cacheTrazos.get(key) ?? null;
  };
  for (const plan of (planos || []).filter((p) => p.status === 'confirmed')) {
    const data = trazosDe(plan.id);
    if (!data) continue;
    // El dueño de una salida vive en el mismo piso: indexar sus bajantes antes de revisar.
    indexarBajantes((data.bajantes || []) as BajanteAIndexar[]);
    for (const r of (data.ramales || []) as RevisarRamalInput[]) {
      if (engineCovered.has(`${r.net}_${r.id}`)) continue;
      if (r.label && engineCoveredLabels.has(`${r.net}_${r.label}`)) continue;
      const antes = sinUc.length;
      if (!revisarRamal(r, plan.id)) {
        sinUc[antes].label += ` (${plan.name || 'Plano ' + plan.id})`;
      }
    }
  }
  // Alineado con las tablas: un tramo sin carga PROPIA pero que RECIBE la descarga de otro
  // tramo CON UD no produce fila vacía (su UD llega por el grafo) — no se avisa. Sin esto,
  // receptores con UD visible agregada disparaban el aviso (orig. usuario). Dos refinamientos
  // del mismo reporte ("tramos con UD autosumada por flujo salían en la alerta"):
  // (1) la recepción se detecta por CUALQUIER extremo del alimentador — un ramal dibujado
  //     "al revés" descarga por pts[0] y el chequeo direccional (dest = último punto) nunca
  //     lo veía;
  // (2) cierre TRANSITIVO hasta punto fijo — en la cadena T(con aparatos)→RS1→RS2, RS1
  //     recibe de T y RS2 recibe de RS1; el pase único dejaba a RS2 marcado.
  const receptos = [...sinUc];
  const cargados = [...conUd];
  const extremoToca = (o: RevisarRamalInput, rPts: number[][]): boolean => {
    const oPts = o.pts;
    if (!oPts || oPts.length < 2) return false;
    return distToPolyline(oPts[0], rPts) < 2.0 || distToPolyline(oPts[oPts.length - 1], rPts) < 2.0;
  };
  let propagado = true;
  while (propagado) {
    propagado = false;
    for (let i = receptos.length - 1; i >= 0; i--) {
      const { r, planFor } = receptos[i];
      const rPts = r.pts;
      if (!rPts || rPts.length < 2) continue;
      const alimentado = cargados.some(
        ({ r: o }) => o.net === r.net && o.id !== r.id && extremoToca(o, rPts),
      );
      if (alimentado) {
        // El receptor queda cubierto y a su vez alimenta a los suyos en la próxima pasada.
        cargados.push({ r, planFor });
        receptos.splice(i, 1);
        propagado = true;
      }
    }
  }
  const vivos = receptos;
  if (vivos.length > 0) {
    // Lista COMPLETA — recortarla a 8 ocultaba elementos pendientes (reporte: "la
    // alerta no muestra todos los elementos con UC/UD pendientes").
    const lista = vivos.map((e) => e.label).join(', ');
    onAlert(
      'UC/UD pendientes',
      `${vivos.length} ramal(es) sin UC/UD asignado: ${lista}. Asigna unidades de descarga o aparatos antes de cerrar el dibujo.`,
    );
    return false;
  }
  // Todo elemento de tubería debe llevar diámetro antes de poder cerrar el dibujo — un
  // ramal/tributario con diametro vacío (o una bajante/montante sin dNominal)
  // produciría una tabla de diseño/memoria rota. Bloquear el cierre y listar los
  // elementos faltantes en lugar de guardar silenciosamente un dibujo incompleto.
  const { sinDiam, inferior } = revisarDiametros(eng.ramales, eng.bajantes);
  if (sinDiam.length > 0) {
    onAlert(
      'Diámetros pendientes',
      `${sinDiam.length} elemento(s) sin diámetro asignado: ${formatLista(sinDiam)}. Asigna los diámetros antes de cerrar el dibujo.`,
    );
    return false;
  }
  if (inferior.length > 0) {
    onAlert(
      'Diámetro no permitido',
      `Bajante(s)/montante(s) con diámetro inferior al del ramal conectado: ${formatLista(inferior)}. Ajusta los diámetros antes de cerrar el dibujo.`,
    );
    return false;
  }
  // Validación GLOBAL (orig. usuario): los pisos NO cargados también deben cumplir antes de
  // cerrar. Con el prefetch global de trazos cada plano confirmado tiene caché local en este
  // punto; sin ella, el piso se salta (comportamiento anterior: se podía cerrar igual).
  for (const plan of (planos || []).filter(
    (p) => p.status === 'confirmed' && String(p.id) !== String(planId ?? ''),
  )) {
    const data = trazosDe(plan.id);
    if (!data) continue;
    const piso = plan.nivel != null ? `${pisoLbl(Number(plan.nivel))}: ` : '';
    const otro = revisarDiametros(
      (data.ramales || []) as DiamRamales,
      (data.bajantes || []) as DiamBajantes,
    );
    if (otro.sinDiam.length > 0) {
      onAlert(
        'Diámetros pendientes',
        `${piso}${otro.sinDiam.length} elemento(s) sin diámetro asignado: ${formatLista(otro.sinDiam)}. Asigna los diámetros antes de cerrar el dibujo.`,
      );
      return false;
    }
    if (otro.inferior.length > 0) {
      onAlert(
        'Diámetro no permitido',
        `${piso}Bajante(s)/montante(s) con diámetro inferior al del ramal conectado: ${formatLista(otro.inferior)}. Ajusta los diámetros antes de cerrar el dibujo.`,
      );
      return false;
    }
  }
  return true;
}

type DiamRamales = Array<{
  id?: string;
  label?: string;
  diametro?: string;
  esCanalId?: string | null;
}>;
type DiamBajantes = Array<{
  id?: string;
  code?: string;
  tipo?: string;
  dNominal?: string;
  recibeDeIds?: string[];
}>;

/** Lista recortada a 8 elementos con sufijo "y N más" — mismo formato en piso local y global. */
function formatLista(items: string[]): string {
  return `${items.slice(0, 8).join(', ')}${items.length > 8 ? ` y ${items.length - 8} más` : ''}`;
}

/** Lee la caché local de trazos de un piso (acepta JSON en crudo); null si no hay o está rota. */
function leerTrazos(id: string | number): PlanTrazos | null {
  const raw = loadFromStorage<PlanTrazos | string | null>(TRAZOS_PREFIX + String(id), null);
  if (!raw) return null;
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw) as PlanTrazos;
  } catch {
    return null;
  }
}

/** Revisión de diámetros de un conjunto de trazos: elementos sin diámetro y bajantes/montantes
 *  con diámetro inferior al del ramal conectado. Los Ldesvio (LD_) se excluyen de "sin
 *  diámetro": espejan el dNominal de su bajante y lo duplicarían en la alerta. Los ramales de
 *  canal (esCanalId) también: su diámetro espeja al bajante asociado — sin asociado aún no hay
 *  diámetro que revisar. */
function revisarDiametros(ramales: DiamRamales, bajantes: DiamBajantes) {
  const sinDiam = [
    ...ramales
      .filter((r) => !r.diametro && !r.id?.startsWith('LD_') && !r.esCanalId)
      .map((r) => r.label || r.id || ''),
    ...bajantes
      .filter((b) => (b.tipo === 'bajante' || b.tipo === 'montante') && !b.dNominal)
      .map((b) => b.code || b.id || ''),
  ].filter(Boolean);
  const inferior: string[] = [];
  for (const b of bajantes) {
    if (b.tipo !== 'bajante' && b.tipo !== 'montante') continue;
    if (!b.dNominal) continue;
    const bIn = diamPulgFromLabel(String(b.dNominal).replace(/-/g, ' '));
    if (bIn <= 0) continue;
    for (const rid of b.recibeDeIds || []) {
      const ram = ramales.find((r) => r.id === rid);
      if (!ram || !ram.diametro) continue;
      const ramIn = diamPulgFromLabel(String(ram.diametro).replace(/-/g, ' '));
      if (ramIn > 0 && ramIn > bIn) {
        inferior.push(`${b.code || b.id} (${ram.label || ram.id} ${ram.diametro})`);
        break;
      }
    }
  }
  return { sinDiam, inferior };
}

interface UsePlanoLoadSwitchParams {
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  engineReady: boolean;
  currentId: number | undefined;
  currentIdRef: React.RefObject<string | number | null | undefined>;
  loadTrazosForPlan: (eng: PlanoEngine, resolvedId: string | number) => Promise<boolean>;
  syncDrawings: () => void;
  autoSaveTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  loadingPlanRef: React.MutableRefObject<boolean>;
  activeNetRef: React.RefObject<string>;
  activeNetworksRef: React.RefObject<Set<string>>;
  setActiveNet: React.Dispatch<React.SetStateAction<string>>;
  setScaleM: React.Dispatch<React.SetStateAction<string>>;
}

/** Guardado y carga al cambiar de plano: persiste el trabajo pendiente del plano anterior y
 *  carga los trazos del entrante, o resetea el motor si el plano no tiene nada guardado. */
function usePlanoLoadSwitch({
  engineRef,
  engineReady,
  currentId,
  currentIdRef,
  loadTrazosForPlan,
  syncDrawings,
  autoSaveTimerRef,
  loadingPlanRef,
  activeNetRef,
  activeNetworksRef,
  setActiveNet,
  setScaleM,
}: UsePlanoLoadSwitchParams): void {
  useEffect(() => {
    if (!engineRef.current || !engineReady) return;
    const eng = engineRef.current;
    const prevId = eng._loadedPlanId;
    if (prevId && prevId !== currentId) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      if (!loadingPlanRef.current && eng._dirty) {
        const work = eng.saveWork();
        work.ts = Date.now();
        saveToStorage(`trazos_${prevId}`, work);
        eng._dirty = false;
      }
    }
    const resolvedId = currentIdRef.current || currentId || '';
    if (!resolvedId) {
      loadingPlanRef.current = false;
      return;
    }
    const finCarga = (): void => {
      loadingPlanRef.current = false;
      try {
        window.dispatchEvent(new Event('civilflow_plan_loaded'));
      } catch {
        /* ignore */
      }
    };
    eng._loadedPlanId = resolvedId;
    eng.mallasDeclaradas = cargarMallas(eng._loadedPlanId);
    loadingPlanRef.current = true;
    (async () => {
      try {
        const loaded = await loadTrazosForPlan(eng, resolvedId);
        const currentRefId = currentIdRef.current || 'work';
        if (resolvedId !== currentRefId) {
          finCarga();
          return;
        }
        if (loaded) {
          const fallbackNet =
            activeNetworksRef.current &&
            activeNetworksRef.current.size > 0 &&
            !activeNetworksRef.current.has('af')
              ? Array.from(activeNetworksRef.current)[0]
              : activeNetRef.current || 'af';
          const loadedNet = eng.activeNet || fallbackNet;
          const sm = eng.scaleM;
          setActiveNet(loadedNet);
          if (sm != null) setScaleM(String(sm));
          requestAnimationFrame(() => {
            finCarga();
            if (engineRef.current) engineRef.current.render();
          });
        } else if (currentId) {
          eng.ramales = [];
          eng.bajantes = [];
          eng.areas = [];
          eng.dims = [];
          eng.textAnnots = [];
          eng.selId = null;
          eng.activeRamal = null;
          eng.activeArea = null;
          eng.setActiveNet(activeNetRef.current);
          eng.render();
          finCarga();
        }
      } catch (e) {
        devError('[LOAD] error', e);
        finCarga();
      }
    })();
    syncDrawings();
  }, [
    currentId,
    engineReady,
    loadTrazosForPlan,
    syncDrawings,
    autoSaveTimerRef,
    engineRef,
    currentIdRef,
    loadingPlanRef,
    activeNetRef,
    activeNetworksRef,
    setActiveNet,
    setScaleM,
  ]);
}

// Chrome móvil del visor: banner "modo consulta", nombre del plano y cluster de zoom táctil
// (⤢ ajustar / + / −). Solo se monta bajo los breakpoints que corresponden — cero lógica de
// dibujo; el zoom delega en el engine via onZoomStep.

interface ViewerMobileChromeProps {
  isMobile: boolean;
  isNarrow: boolean;
  currentFile: File | null;
  onFit: () => void;
  onZoomStep: (factor: number) => void;
}

const BOTON_ZOOM_STYLE = {
  width: 44,
  height: 44,
  borderRadius: '50%',
  border: '1px solid #3a494a',
  background: 'rgba(14,20,28,0.92)',
  color: '#e2e2e8',
  fontSize: 22,
  lineHeight: 1,
  cursor: 'pointer',
} as const;

/** Banner + nombre de plano (solo móvil) y botones flotantes de zoom (móvil y tablet). */
function ViewerMobileChrome({
  isMobile,
  isNarrow,
  currentFile,
  onFit,
  onZoomStep,
}: ViewerMobileChromeProps): React.JSX.Element | null {
  if (!isMobile && !isNarrow) return null;
  return (
    <>
      {isMobile && (
        <div
          role="status"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            padding: '6px 12px',
            background: 'rgba(14,20,28,0.92)',
            borderBottom: '1px solid #3a494a',
            color: '#849495',
            fontSize: 11,
            fontFamily: 'var(--body)',
          }}
        >
          Modo consulta — el dibujo requiere tablet o PC.
        </div>
      )}
      {isMobile && currentFile && (
        <div
          style={{
            position: 'absolute',
            top: 30,
            left: 0,
            right: 0,
            zIndex: 10,
            textAlign: 'center',
            color: '#849495',
            fontSize: 10,
            fontFamily: 'var(--body)',
            pointerEvents: 'none',
            padding: '0 12px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {currentFile.name}
        </div>
      )}
      {/* Zoom táctil: también en tablet (768-1023), donde no hay botones de la toolbar de
          escritorio a mano y el pinch es el único zoom alternativo. */}
      {isNarrow && (
        <div
          style={{
            position: 'absolute',
            right: 12,
            bottom: 18,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {[
            { label: '⤢', aria: 'Ajustar a pantalla', run: onFit },
            { label: '+', aria: 'Acercar', run: () => onZoomStep(1.2) },
            { label: '−', aria: 'Alejar', run: () => onZoomStep(1 / 1.2) },
          ].map((z) => (
            <button
              key={z.label}
              type="button"
              aria-label={z.aria}
              onClick={z.run}
              style={BOTON_ZOOM_STYLE}
            >
              {z.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// Estado responsive del visor en UN solo lugar: móvil <768 (modo consulta: sin toolbar de
// dibujo), angosto <1024 (colapsar sidebars SOLO al cruzar el breakpoint — un listener crudo
// de resize re-cerraba los paneles en cada resize, p. ej. el teclado del SO en tablet pisaba
// la re-expansión manual). Dentro de la franja el usuario puede re-abrir.

/** Estado de sidebars colapsadas + flags isMobile/isNarrow del visor. */
function useViewerResponsive() {
  const [leftCollapsed, setLeftCollapsed] = useState(() => window.innerWidth < 1024);
  const [rightCollapsed, setRightCollapsed] = useState(() => window.innerWidth < 1024);
  const isMobile = useIsMobile();
  const isNarrow = useMediaQuery('(max-width: 1023px)');
  useEffect(() => {
    if (isNarrow) {
      setLeftCollapsed(true);
      setRightCollapsed(true);
    }
  }, [isNarrow]);
  return { isMobile, isNarrow, leftCollapsed, setLeftCollapsed, rightCollapsed, setRightCollapsed };
}

interface PdfViewerProps {
  files: Array<{ id: number; file: File }>;
  activeIndex: number;
  onSelectPlan: (idx: number) => void;
  onAddPlan: () => void;
  onRemovePlan: (idx: number) => void;
  pisos?: Piso[];
  planos?: PlanItem[];
  activeNetworks: Set<string>;
  onReady?: () => void;
}

const mainContainerStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  background: '#111317',
  border: '1px solid #3a494a',
  overflow: 'hidden',
};
const leftSidebarStyle: CSSProperties = {
  width: 180,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  background: '#14161a',
  borderRight: '1px solid #3a494a',
  overflowY: 'auto',
  overflowX: 'hidden',
};
const rightSidebarStyle: CSSProperties = {
  width: 210,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  background: '#14161a',
  borderLeft: '1px solid #3a494a',
  overflowY: 'auto',
  overflowX: 'hidden',
  transition: 'opacity 0.2s',
};

function PdfViewer_({
  files,
  activeIndex,
  onSelectPlan,
  pisos = PdfViewer_EMPTY_PISOS,
  planos = [],
  activeNetworks,
  onReady,
}: PdfViewerProps) {
  const navigate = useNavigate();
  const { mats } = useProject();
  const planosCtx = usePlans();
  const plansRef = useRef(planosCtx.plans);
  useEffect(() => {
    plansRef.current = planosCtx.plans;
  }, [planosCtx.plans]);
  const syncDrawings = useCallback(() => {
    // Guard del GC: los ids VIVOS del engine del piso cargado — sin esto, una caché local
    // vieja del piso activo hacía que el GC borrara claves de aparatos/hidro existentes
    // (orig. usuario: recargar reseteaba las UDs del piso 2 a 0).
    const eng = engineRef.current;
    if (eng?._loadedPlanId) {
      setSyncLoadedLiveIds(String(eng._loadedPlanId), [
        ...eng.ramales.flatMap((r) => [r.id, r.label].filter(Boolean) as string[]),
        ...eng.bajantes.flatMap((b) => [b.id, b.code].filter(Boolean) as string[]),
        ...eng.areas.flatMap((a) => [a.id, a.label].filter(Boolean) as string[]),
      ]);
    }
    try {
      writeSanDrawingSync(plansRef.current);
    } catch {}
    try {
      writeHydroDrawingSync(plansRef.current);
    } catch {}
  }, []);
  const [scale, setScale] = useState(1);
  // Estado responsive del visor centralizado (umbrales 768/1024 + colapso al cruzar 1024).
  const { isMobile, isNarrow, leftCollapsed, setLeftCollapsed, rightCollapsed, setRightCollapsed } =
    useViewerResponsive();

  const dynamicLeftStyle: CSSProperties = useMemo(
    () => ({
      ...leftSidebarStyle,
      width: leftCollapsed ? LEFT_COLLAPSED_WIDTH : 180,
      borderRight: '1px solid #3a494a',
      overflowX: 'hidden',
      overflowY: 'auto',
      scrollbarGutter: 'stable',
      transition: 'width 0.2s ease, border-right 0.2s ease',
    }),
    [leftCollapsed],
  );

  const dynamicRightStyle: CSSProperties = useMemo(
    () => ({
      ...rightSidebarStyle,
      width: rightCollapsed ? 0 : 210,
      borderLeft: rightCollapsed ? 'none' : '1px solid #3a494a',
      overflow: rightCollapsed ? 'hidden' : 'auto',
      transition: 'width 0.2s ease, border-left 0.2s ease',
    }),
    [rightCollapsed],
  );

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { tool, setTool, tipoTramo, setTipoTramo, snapOn, setSnapOn, gridOn, setGridOn } =
    useSessionVisorPrefs();
  const [activeNet, setActiveNet] = useState(() => {
    if (activeNetworks && activeNetworks.size > 0) {
      if (activeNetworks.has('af')) return 'af';
      return Array.from(activeNetworks)[0];
    }
    try {
      const parsed = loadFromStorage<string[] | null>(ACTIVE_NETS_KEY, null);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter((id) => id !== 'ep' && id !== 'bom');
        if (valid.length > 0) {
          if (parsed.includes('af')) return 'af';
          return valid[0];
        }
      }
    } catch {}
    return 'af';
  });

  useEffect(() => {
    if (activeNetworks && activeNetworks.size > 0 && !activeNetworks.has(activeNet)) {
      setActiveNet(Array.from(activeNetworks)[0]);
    }
  }, [activeNetworks, activeNet]);

  const [scaleM, setScaleM] = useState('0.5');
  // Escala única del proyecto: scale/100 del plan calibrado con calGlobal (fuente de verdad
  // para el re-base de pisos que calibraron a mano — incidente cotas distintas por piso).
  const escalaGlobalRef = useRef<number | null>(null);
  useEffect(() => {
    const g = planos.find((p) => p.calGlobal === true && p.origen && p.scale);
    escalaGlobalRef.current = g ? g.scale / 100 : null;
  }, [planos]);
  const [selectedNivel, setSelectedNivel] = useState<number | null>(null);
  const syncedNivelForIdRef = useRef<string | number | null>(null);
  const [hiddenNets, setHiddenNets] = useState<Set<string>>(() => {
    try {
      const saved = loadFromStorage<string[] | null>(PDF_HIDDEN_NETS_KEY, null);
      if (saved) return new Set(saved);
    } catch {
      /* ignore */
    }
    return new Set();
  });
  const [lockedNets, setLockedNets] = useState<Set<string>>(() => {
    try {
      const saved = loadFromStorage<string[] | null>(PDF_LOCKED_NETS_KEY, null);
      if (saved) return new Set(saved);
    } catch {
      /* ignore */
    }
    return new Set();
  });

  const [selElement, setSelElement] = useState<ProbedElement | null>(null);
  const [drawnElements, setDrawnElements] = useState<ElementItem[]>([]);
  const [diamSel, setDiamSel] = useState<Record<string, string>>({});
  const [gasMatSel, setGasMatSel] = useState<Record<string, string>>({});
  const [pendSel, setPendSel] = useState<Record<string, number>>({});
  const [pendInput, setPendInput] = useState('');
  const [textOverlay, setTextOverlay] = useState<{
    x: number;
    y: number;
    value: string;
    cb: (text: string) => void;
  } | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const activeNetRef = useRef(activeNet);
  useEffect(() => {
    activeNetRef.current = activeNet;
  }, [activeNet]);
  const activeNetworksRef = useRef(activeNetworks);
  useEffect(() => {
    activeNetworksRef.current = activeNetworks;
  }, [activeNetworks]);

  const currentFile = files[activeIndex]?.file;
  const currentId = files[activeIndex]?.id;
  const currentIdRef = useRef(currentId);
  useEffect(() => {
    currentIdRef.current = currentId;
  }, [currentId]);

  const engineRef = useRef<PlanoEngine | null>(null);
  const cerrandoRef = useRef(false);
  const loadingPlanRef = useRef(false);
  const cwRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const { lowerFloorsRamales, upperFloorGroup } = useFloorRamales({
    selElement,
    selectedNivel,
    pisos,
    plans: planosCtx.plans,
    activeNet,
    engineRef,
    currentIdRef,
  });

  useEffect(() => {
    if (selectedNivel !== null) {
      const plano = planos.find((p) => p.nivel === selectedNivel && p.status === 'confirmed');
      // Solo pisos SIN calibración: el set estándar pisaba el scaleM calibrado que vino en
      // los trazos (y el autosave lo persistía pisado — normalización de copias corrupta).
      if (plano && plano.scale && !plano.origen) {
        const derived = String(plano.scale / 100);
        if (['0.5', '0.75', '1', '1.25', '2'].includes(derived)) {
          setScaleM(derived);
          if (engineRef.current) engineRef.current.setScaleM(derived);
        }
      }
      const dScale = plano && plano.definedScale ? plano.definedScale : 0;
      if (engineRef.current) engineRef.current.setDefinedScaleM(dScale);
    }
  }, [selectedNivel, planos]);

  useEffect(() => {
    if (selElement?.net) setActiveNet(selElement.net);
    if (selElement?.id) {
      // Seleccionar la propia línea guía (para su menú contextual de rotar/crear-ramal) no debe
      // sacar al usuario del modo guía — de lo contrario la barra lateral bloqueada reaparece en
      // cuanto interactúa con algo mientras la herramienta está activa.
      if (
        engineRef.current &&
        engineRef.current.tool !== 'sel' &&
        engineRef.current.tool !== 'guide'
      )
        engineRef.current.setTool('sel');
      if (tool !== 'sel' && tool !== 'guide') setTool('sel');
    }
  }, [selElement, tool, setTool]);

  useEffect(() => {
    if (currentId == null) return;
    if (syncedNivelForIdRef.current === currentId) return;
    syncedNivelForIdRef.current = currentId;
    const pl = planos.find((p) => p.id === currentId);
    if (pl && (pl.nivel ?? null) !== (selectedNivel ?? null)) {
      setSelectedNivel(pl.nivel ?? null);
    }
  }, [currentId, planos, selectedNivel]);

  const loadTrazosForPlan = useTrazosLoader({
    activeNetRef,
    setActiveNet,
    setScaleM,
    escalaGlobalRef,
  });

  const markDirtyRef = useRef<() => void>(() => {});

  // Ítem 2 (rev 2): dedupe de la alerta de estado inviable — el ramal se alerta UNA vez por
  // sesión mientras siga inválido (se rehabilita al corregirse).
  const aparatoFlowAlertedRef = useRef<Set<string>>(new Set());

  const { saveStatus, setSaveStatus, doSave, autoSaveTimerRef, markDirty } = usePdfAutoSave(
    engineRef,
    currentIdRef,
    planosCtx.plans,
    loadingPlanRef,
  );
  useEffect(() => {
    markDirtyRef.current = markDirty;
  }, [markDirty]);

  const onDirtyHandler = useCallback(
    (eng: PlanoEngine) => {
      markDirtyRef.current();
      setDrawnElements(eng.getElementsByNet(activeNetRef.current || 'af'));
      if (eng.selId) {
        const sel = eng.getSelected();
        if (sel) {
          const { _circ, _ghost, _box, _polyBox, _labelBox, ...rest } = sel as unknown as Record<
            string,
            unknown
          >;
          setSelElement(rest as unknown as ProbedElement);
          // ponytail: single source of truth — sync diamSel immediately so panel & menu dropdowns reflect new diametro without reselection
          const d = (rest as unknown as { diametro?: string }).diametro;
          if (d)
            setDiamSel((prev) => ({
              ...prev,
              [(eng.activeNet || activeNetRef.current || 'af') as string]: d,
            }));
        }
      }
      if (loadingPlanRef.current) return;
      // Ítem 2 (rev 5): un aparato es inviable si su extremo está conectado a la red (T/Y/bajante)
      // o si el flujo va en contra de ese extremo (apunta a la conexión, no al extremo libre).
      // Llega por datos persistidos o por empalmes posteriores al asignar. Se alerta una vez
      // por ramal; al corregirse el estado, el ramal se rehabilita.
      for (const r of eng.ramales) {
        if (aparatoEnExtremoInvalido(eng.ramales, eng.bajantes || [], r)) {
          if (!aparatoFlowAlertedRef.current.has(r.id)) {
            aparatoFlowAlertedRef.current.add(r.id);
            eng.triggerAlert(
              'Aparato no permitido',
              `El ramal ${r.label || r.id} tiene un aparato en un extremo inválido: está conectado a la red (T/Y/bajante) o el flujo va en su contra. El aparato solo va en el extremo libre hacia el que apunta el flujo. Quita el aparato, invierte la dirección del ramal o muévelo al extremo correcto.`,
            );
          }
        } else {
          aparatoFlowAlertedRef.current.delete(r.id);
        }
      }
      try {
        const id = eng._loadedPlanId || currentIdRef.current || 'work';
        if (id) persistTrazosSnapshot(eng, id);
      } catch {}
      syncDrawings();
    },
    [syncDrawings],
  );

  const onDeleteHandler = useCallback(
    (ids: string[]) => {
      const cleanStore = (key: string) => {
        const store = loadFromStorage(key, {}) as Record<string, unknown>;
        let changed = false;
        // Solo claves del piso cargado: borrar RS4 aquí no debe borrar `san_RS4_<otroPlano>`
        // (cada piso numera por su cuenta; sin este filtro, borrar en un piso vaciaba las
        // UDs del mismo id en los demás).
        const loadedPid = engineRef.current?._loadedPlanId ?? null;
        // Ids actuales tras el borrado+renumerado (el nuevo RS1 ya existe en engine)
        const currentIds = new Set([
          ...(engineRef.current?.ramales.map((r) => r.id) ?? []),
          ...(engineRef.current?.bajantes.map((b) => b.id) ?? []),
          ...(engineRef.current?.ramales.map((r) => r.label) ?? []),
        ]);
        for (const k of Object.keys(store)) {
          if (!isPlanKeyFor(k, loadedPid)) continue;
          // No borrar si el nuevo ramal renumerado ocupa ese mismo id (ej. RS2→RS1):
          // currentIds contiene el nuevo RS1, así que no se borra.
          if (claveDeBorrado(k, ids, currentIds)) {
            delete store[k];
            changed = true;
          }
        }
        if (changed) saveToStorage(key, store);
      };
      cleanStore(GAS_ACC_KEY);
      cleanStore(APARATOS_BY_TRAMO_KEY);
      cleanStore(HYDRO_DATA_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('aparatos-clear', { detail: { ids } }));
      syncDrawings();
    },
    [syncDrawings],
  );

  const onRequestTextCb = useCallback((x: number, y: number, cb: (text: string) => void) => {
    setTextOverlay({ x, y, value: '', cb });
    const t = setTimeout(() => textInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  // ── Estado de diálogos ──
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState | null>(null);
  // ponytail: keep context menu snapshot in sync with engine source of truth for diametro/material etc.
  useEffect(() => {
    if (!contextMenuState?.visible || !contextMenuState.element) return;
    const eng = engineRef.current;
    if (!eng) return;
    const eid = (contextMenuState.element as { id?: string }).id;
    if (!eid) return;
    const fresh =
      eng.ramales.find((r) => r.id === eid) ||
      eng.bajantes.find((b) => b.id === eid) ||
      eng.textAnnots.find((t) => t.id === eid) ||
      eng.areas.find((a) => a.id === eid) ||
      eng.guideLines.find((g) => g.id === eid);
    if (!fresh) return;
    const snap = contextMenuState.element as unknown as Record<string, unknown>;
    const live = fresh as unknown as Record<string, unknown>;
    if (
      snap.diametro !== live.diametro ||
      snap.material !== live.material ||
      snap.accesorioInicio !== live.accesorioInicio ||
      snap.accesorioFin !== live.accesorioFin ||
      snap.aparatoInicio !== live.aparatoInicio ||
      snap.aparatoFin !== live.aparatoFin
    ) {
      setContextMenuState((prev) =>
        prev ? { ...prev, element: { ...fresh } as unknown as typeof prev.element } : null,
      );
    }
  }, [selElement, contextMenuState?.visible, contextMenuState?.element]);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmLabel?: string;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [accesorioModal, setAccesorioModal] = useState<{
    isOpen: boolean;
    ramalId: string;
    ramalLabel: string;
    angleDeg: number;
    junctionIndex: number;
    point: number[];
    net: string;
    isTee?: boolean;
  }>({
    isOpen: false,
    ramalId: '',
    ramalLabel: '',
    angleDeg: 0,
    junctionIndex: 0,
    point: [],
    net: '',
    isTee: false,
  });

  const contextMenuCbRef = useRef<
    | ((
        bajante: PlanoElement,
        x: number,
        y: number,
        isGhostClick?: boolean,
        ramalEndpoint?: { idx: number; x: number; y: number } | null,
        midRamalHit?: { segmentIdx: number; x: number; y: number } | null,
      ) => void)
    | null
  >(null);
  const onContextMenuCb = useCallback(
    (
      bajante: PlanoElement,
      x: number,
      y: number,
      isGhostClick?: boolean,
      ramalEndpoint?: { idx: number; x: number; y: number } | null,
      midRamalHit?: { segmentIdx: number; x: number; y: number } | null,
    ) => {
      setContextMenuState({
        visible: true,
        x,
        y,
        element: bajante,
        isGhostClick,
        ramalEndpoint,
        midRamalHit,
      });
    },
    [],
  );
  useEffect(() => {
    contextMenuCbRef.current = onContextMenuCb;
  }, [onContextMenuCb]);

  // ── Inicialización del motor ──
  const noopStatus = useCallback(() => {}, []);
  const onSelectHandler = useCallback((el: Record<string, unknown> | null) => {
    setSelElement(el as ProbedElement | null);
  }, []);
  const onAlertHandler = useCallback((title: string, msg: string) => {
    window.dispatchEvent(
      new CustomEvent('civilflow_diametro_validation', { detail: { title, message: msg } }),
    );
  }, []);
  const onAccesorioModalHandler = useCallback(
    (data: {
      ramalId: string;
      angleDeg: number;
      junctionIndex: number;
      point: number[];
      net: string;
      isTee?: boolean;
    }) => {
      // `ramalId` es el id interno crudo (p. ej. el `T${Date.now()}` de un tributario) — nunca
      // pensado para mostrarse. El modal debe mostrar la etiqueta real del ramal (RAF1, T3, ...),
      // igual que en el resto de la UI.
      const target = engineRef.current?.ramales.find((r) => r.id === data.ramalId);
      setAccesorioModal({
        isOpen: true,
        ramalId: data.ramalId,
        ramalLabel: target?.label || data.ramalId,
        angleDeg: data.angleDeg,
        junctionIndex: data.junctionIndex,
        point: data.point,
        net: data.net,
        isTee: data.isTee,
      });
    },
    [],
  );
  // Grosor de líneas (slider bajo la barra de redes): factor multiplicador de todos los
  // lineWidth del dibujo, persistido por plano (cf_planos.line_width vía serializeWork).
  const [lineWidthScale, setLineWidthScale] = useState(1);
  const { engineReady } = usePdfViewerEngine({
    currentFile,
    currentId,
    currentIdRef,
    activeNetRef,
    cwRef,
    drawCanvasRef,
    pdfCanvasRef,
    onStatus: noopStatus,
    onDirty: onDirtyHandler,
    onSelect: onSelectHandler,
    onDelete: onDeleteHandler,
    onToolChange: setTool,
    onRequestText: onRequestTextCb,
    onAlert: onAlertHandler,
    onAccesorioModal: onAccesorioModalHandler,
    loadTrazosForPlan,
    setActiveNet,
    setScaleM,
    setLoading,
    setError,
    onReady,
    scale,
    engineRef: engineRef as React.MutableRefObject<PlanoEngine | null>,
    loadingPlanRef,
  });

  // Handler de la selección en el modal de accesorios — actualiza el accesorio del ramal en el
  // motor + hidroData
  const onAccesorioSelected = useCallback(
    (ramalId: string, point: number[], _net: string, accId: string) => {
      const eng = engineRef.current;
      if (!eng) return;
      const updated = applyAccesorioPlacement(eng, ramalId, point, accId, onAlertHandler);
      if (updated && typeof window !== 'undefined') {
        // Refrescar la barra lateral
        window.dispatchEvent(new CustomEvent('aparatos-clear'));
        setSelElement({ ...updated });
      }
    },
    [onAlertHandler],
  );

  useEffect(() => {
    const v = engineRef.current?.lineWidthScale;
    if (v && v > 0) setLineWidthScale(v);
  }, [engineReady, engineRef]);
  useEffect(() => {
    if (engineRef.current && engineReady && contextMenuCbRef.current)
      engineRef.current.onContextMenu(contextMenuCbRef.current);
  }, [engineReady, engineRef]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.activeNetworks = activeNetworks;
  }, [activeNetworks, engineReady]);

  useNetColorsInit();

  usePlanoLoadSwitch({
    engineRef,
    engineReady,
    currentId,
    currentIdRef,
    loadTrazosForPlan,
    syncDrawings,
    autoSaveTimerRef,
    loadingPlanRef,
    activeNetRef,
    activeNetworksRef,
    setActiveNet,
    setScaleM,
  });

  const prevActiveNetForSel = useRef(activeNet);
  useEffect(() => {
    if (activeNet === prevActiveNetForSel.current) return;
    prevActiveNetForSel.current = activeNet;
    if (engineRef.current && !loadingPlanRef.current) {
      // Al cambiar de red, una selección de OTRA red se limpia — nunca se auto-selecciona un
      // elemento de la red nueva (antes se precargaba el ÚLTIMO ramal de la red, que en AF era
      // el tramo auto-creado por el split de la tee: el sidebar mostraba ese ramal "seleccionado"
      // sin que el usuario tocara nada, y volvía a aparecer tras deseleccionar).
      const eng = engineRef.current;
      const sel = eng.getSelected() as { net?: string } | null;
      if (sel && sel.net !== activeNet) {
        eng.selId = null;
        eng._emitSelect(null);
        eng.render();
      }
    }
  }, [activeNet]);

  useEffect(() => {
    syncDrawings();
  }, [planosCtx.plans, currentId, activeNet, syncDrawings]);
  useEffect(() => {
    window.addEventListener('storage', syncDrawings);
    return () => window.removeEventListener('storage', syncDrawings);
  }, [syncDrawings]);
  // Nota: el listener `civilflow_diametro_validation` vive en GlobalAlertDialogProvider en la
  // raíz de la app — permanece montado entre cambios de ruta para que las ediciones de la tabla
  // de diseño siempre muestren su alerta, no solo cuando el visor de PDF está en pantalla.

  const { finalVisibleNets, recolectoraActive, rejillasActive } =
    useActiveNetsVisibility(activeNetworks);

  // ── Acciones en línea ──
  const syncEngine = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.setTool(tool as ToolType);
    eng.setActiveNet(activeNet);
    eng.setTipoTramo(tipoTramo as TramoType);
    eng.setSnap(snapOn);
    eng.setGridMode(gridOn);
    eng.setScaleM(scaleM);
    const floorObj = pisos.find((p) => p.n === selectedNivel);
    eng.nivelActual = floorObj
      ? { ...floorObj, label: pisoLbl(floorObj.n), npt: Number(floorObj.npt) }
      : null;
    eng.nptLevels = pisos.map((p) => ({ label: pisoLbl(p.n), npt: Number(p.npt) }));
    // Gas tiene varias opciones reales de material (según MATERIALES_POR_RED) — a diferencia de
    // las redes de un solo material, NO debe pre-rellenar un default silenciosamente; el usuario
    // tiene que elegir uno activamente, igual que haría cualquier otra red multimaterial si
    // tuviera más de una opción canónica.
    const matName =
      activeNet === 'gas'
        ? gasMatSel[activeNet] || ''
        : (mats?.[activeNet] && mats[activeNet][0]?.val) || '';
    // Fix issue #3: tributario no hereda diámetro 4" por defecto — solo inodoro lo requiere
    const dRaw = activeNet === 'gas' ? diamSel[activeNet] || '' : diamSel[activeNet] || '';
    const d = tipoTramo === 'tributario' ? '' : dRaw;
    const p = activeNet === 'san' || activeNet === 'll' ? DEFAULT_PENDIENTE_PCT : 0;
    eng.setRamalDefaults({ material: matName, diametro: d, pendiente: p });
  }, [
    tool,
    activeNet,
    tipoTramo,
    snapOn,
    gridOn,
    scaleM,
    mats,
    diamSel,
    selectedNivel,
    pisos,
    gasMatSel,
    engineRef,
  ]);

  // El Ctrl+Z de teclado lo maneja el propio engine (keydown en document) — este listener
  // limpia las copias congeladas de la UI (menú contextual/panel) tras cada undo/redo.
  useEffect(() => {
    const clearFrozenUi = () => {
      setSelElement(null);
      setContextMenuState(null);
    };
    window.addEventListener('civilflow_undone', clearFrozenUi);
    return () => window.removeEventListener('civilflow_undone', clearFrozenUi);
  }, []);

  const handleUndo = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.undoLast();
      // El menú contextual y el panel muestran COPIAS congeladas del elemento — tras revertir
      // hay que cerrarlas o el usuario sigue viendo el aparato/accesorio que el undo ya quitó.
      setSelElement(null);
      setContextMenuState(null);
    }
  }, [engineRef]);
  const handleRedo = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.redoLast();
      setSelElement(null);
      setContextMenuState(null);
    }
  }, [engineRef]);
  const handleFit = useCallback(() => {
    const eng = engineRef.current;
    const cw = cwRef.current;
    if (!eng || !cw || !eng.pageW || !eng.pageH) return;
    const pad = 16;
    const availW = cw.clientWidth - pad * 2;
    const availH = cw.clientHeight - pad * 2;
    const sc = Math.min(availW / eng.pageW, availH / eng.pageH);
    eng.zoom = sc;
    eng.offX = (eng.pageW * (1 - sc)) / 2;
    eng.offY = (cw.clientHeight - eng.pageH * sc) / 2;
    eng.render();
    const newScale = Math.max(1, Math.ceil(sc));
    if (newScale !== scale) setScale(newScale);
  }, [engineRef, cwRef, scale, setScale]);

  const handleClear = useCallback(() => {
    if (!engineRef.current) return;
    const netId = activeNet;
    const netName = NETS.find((n) => n.id === netId)?.name || netId;
    setConfirmState({
      isOpen: true,
      title: 'Limpiar red',
      message: `¿Deseas eliminar todo el trazado de la red activa (${netName})? Puedes revertirlo con Ctrl + Z.`,
      onConfirm: () => {
        engineRef.current?.clearNet(netId);
        setSelElement(null);
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
      },
    });
  }, [engineRef, activeNet, setSelElement]);

  const handleClearGuides = useCallback(() => {
    if (!engineRef.current) return;
    setConfirmState({
      isOpen: true,
      title: 'Borrar líneas guía',
      message:
        '¿Deseas eliminar todas las líneas guía de todos los pisos? Puedes revertirlo con Ctrl + Z.',
      onConfirm: () => {
        const eng = engineRef.current;
        if (eng) {
          eng.guideLines = [];
          eng.selId = null;
          eng.render();
          eng._markDirty();
        }
        setSelElement(null);
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
      },
    });
  }, [engineRef, setSelElement]);

  const handleSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    doSave();
  }, [autoSaveTimerRef, doSave]);
  const handleSnapToggle = useCallback(() => setSnapOn((prev) => !prev), [setSnapOn]);
  const handleGridToggle = useCallback(() => setGridOn((prev) => !prev), [setGridOn]);
  const handleRotateLabel = useCallback(() => {
    if (engineRef.current) engineRef.current.rotateLabelSnap();
  }, [engineRef]);
  const handleUpdateSel = useCallback(
    (field: string, value: unknown) => {
      if (!engineRef.current || !selElement) return;
      const fields = { [field]: value };
      engineRef.current.updateSelected(fields);
      setSelElement({ ...selElement, [field]: fields[field] });
      engineRef.current.render();
    },
    [engineRef, selElement, setSelElement],
  );

  const handleToggleHidden = useCallback(
    (id: string) => {
      const next = new Set(hiddenNets);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setHiddenNets(next);
      saveToStorage(PDF_HIDDEN_NETS_KEY, [...next]);
      if (engineRef.current) engineRef.current.setNetHidden(id, next.has(id));
    },
    [hiddenNets, setHiddenNets, engineRef],
  );

  const handleToggleLocked = useCallback(
    (id: string) => {
      const next = new Set(lockedNets);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setLockedNets(next);
      saveToStorage(PDF_LOCKED_NETS_KEY, [...next]);
      if (engineRef.current) engineRef.current.setNetLocked(id, next.has(id));
    },
    [lockedNets, setLockedNets, engineRef],
  );

  useEffect(() => {
    syncEngine();
  }, [syncEngine]);

  useEffect(() => {
    if (finalVisibleNets.length === 0) return;
    if (!finalVisibleNets.some((n) => n.id === activeNet)) setActiveNet(finalVisibleNets[0].id);
    setHiddenNets((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of [...next]) {
        if (!finalVisibleNets.some((n) => n.id === id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [finalVisibleNets, activeNet]);

  const prevResetKey = useRef('');
  // Error de guardado a BD (evento de storageService.saveTrazosToDB): franja en rojo + motivo
  // en el botón Guardar — el fallo ya no es silencioso (orig. usuario).
  const [bdError, setBdError] = useState<string | null>(null);
  useEffect(() => {
    const onBdError = (e: Event) => {
      const detail = (e as CustomEvent<{ reason: string; message: string }>).detail;
      setBdError(
        detail?.message ? `${detail.reason}: ${detail.message}` : detail?.reason || 'error',
      );
      // El texto del botón Guardar usa saveStatus (que doSave pone en 'saved' sin mirar el
      // resultado del push a BD): sin esto, la franja quedaba roja mientras abajo decía
      // "✔ Guardado" (orig. usuario).
      setSaveStatus('error');
    };
    window.addEventListener('civilflow_bd_save_error', onBdError);
    const onBdOk = () => setBdError(null);
    window.addEventListener('civilflow_bd_save_ok', onBdOk);
    // Cuota local llena (evento de saveToStorage): misma franja roja — un guardado local
    // fallido congelaba la caché del piso y el GC borraba sus UDs (orig. usuario piso 2).
    const onQuota = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string }>).detail;
      setBdError(
        `almacenamiento local lleno (clave ${detail?.key || '?'}): libera espacio del navegador`,
      );
      setSaveStatus('error');
    };
    window.addEventListener('civilflow_local_quota', onQuota);
    const onQuotaOk = () => setBdError(null);
    window.addEventListener('civilflow_local_quota_ok', onQuotaOk);
    return () => {
      window.removeEventListener('civilflow_bd_save_error', onBdError);
      window.removeEventListener('civilflow_bd_save_ok', onBdOk);
      window.removeEventListener('civilflow_local_quota', onQuota);
      window.removeEventListener('civilflow_local_quota_ok', onQuotaOk);
    };
  }, [setSaveStatus]);

  const resetKey = activeNet + '|' + tipoTramo;
  useEffect(() => {
    if (resetKey === prevResetKey.current) return;
    prevResetKey.current = resetKey;
    if (engineRef.current) engineRef.current.setPadreTributario(null);
  }, [resetKey]);

  useKeyboardShortcuts({ setSnapOn, setTool, setTipoTramo, setGridOn, engineRef });

  const prevSelId = useRef(selElement?.id);
  const prevActiveNetForDiam = useRef(activeNet);
  useEffect(() => {
    if (selElement?.id === prevSelId.current && activeNet === prevActiveNetForDiam.current) return;
    prevSelId.current = selElement?.id;
    prevActiveNetForDiam.current = activeNet;
    if (engineRef.current && selElement && selElement.net === activeNet) {
      const diametro = selElement.diametro;
      if (diametro) setDiamSel((prev) => ({ ...prev, [activeNet]: diametro }));
      const pendiente = selElement.pendiente;
      if (pendiente !== undefined) {
        // Ítem 4 (fix): solo reflejar la pendiente del ramal seleccionado en el INPUT de
        // display — NO la copiamos a pendSel, porque pendSel es el default que DEFAULT_PENDIENTE_PCT
        // (2%) quiere para ramales nuevos, y llevarla aquí hacía que un ramal viejo con 3%
        // contaminara el default de los siguientes. El default de creación es siempre 2% salvo
        // que el usuario escriba otra en el input.
        setPendInput(pendiente > 0 ? String(pendiente) : '');
      }
    } else if (!selElement) {
      setDiamSel((prev) => (prev[activeNet] ? { ...prev, [activeNet]: '' } : prev));
      // Espejo del default real usado al crear el ramal (setRamalDefaults / syncEngine) para que
      // el campo no aparezca vacío cuando un ramal san/ll nuevo se dibujaría de hecho al 2%.
      const fallback =
        activeNet === 'san' || activeNet === 'll' ? DEFAULT_PENDIENTE_PCT : undefined;
      const p = pendSel[activeNet] !== undefined ? pendSel[activeNet] : fallback;
      setPendInput(p !== undefined && p > 0 ? String(p) : '');
    }
  }, [activeNet, pendSel, selElement]);
  const prevSelIdForRender = useRef(selElement?.id);
  useEffect(() => {
    if (selElement?.id === prevSelIdForRender.current) return;
    prevSelIdForRender.current = selElement?.id;
    engineRef.current?.render();
  }, [selElement?.id]);
  const prevSelForDrawn = useRef(selElement);
  const prevActiveForDrawn = useRef(activeNet);
  useEffect(() => {
    if (selElement === prevSelForDrawn.current && activeNet === prevActiveForDrawn.current) return;
    prevSelForDrawn.current = selElement;
    prevActiveForDrawn.current = activeNet;
    if (engineRef.current) setDrawnElements(engineRef.current.getElementsByNet(activeNet));
  }, [activeNet, selElement]);
  useEffect(() => {
    const c = drawCanvasRef.current;
    if (c) c.style.cursor = tool === 'pan' ? 'grab' : tool === 'sel' ? 'default' : 'crosshair';
  }, [tool]);

  // COTA seleccionada (orig. usuario): sin paneles — la cota no tiene datos hidráulicos
  // ni aparatos; se ocultan TramoEditor y AparatosPanel.
  const esCotaSel = (() => {
    const sel = selElement as { id?: string; tipo?: string } | null;
    return !!sel && !sel.tipo && String(sel.id ?? '').startsWith('D');
  })();
  // Área de sector del módulo Rejillas (NTC 3631): rejillas activa + área dibujada con la
  // pestaña Gas — habilita aparatos de gasodomésticos en el panel derecho.
  const esAreaRejillas =
    !!selElement &&
    rejillasActive &&
    !!selElement.id?.startsWith('AR') &&
    (selElement as { net?: string }).net === 'gas';
  const rightSidebarOpacity = useMemo(
    () => ({
      opacity: !selElement ? 0.35 : 1,
      pointerEvents: !selElement ? ('none' as const) : ('auto' as const),
      transition: 'opacity 0.2s',
    }),
    [selElement],
  );
  const scaleText = useMemo(() => {
    const planoAsoc = planos.find((p) => p.nivel === selectedNivel && p.status === 'confirmed');
    if (planoAsoc && planoAsoc.scale) return <span>1:{Math.round(planoAsoc.scale)}</span>;
    const map: Record<string, string> = {
      '0.5': '1:50',
      '0.75': '1:75',
      '1.0': '1:100',
      '1.25': '1:125',
      '2.0': '1:200',
    };
    return <span>{map[scaleM] || '1:100'}</span>;
  }, [selectedNivel, planos, scaleM]);

  const planoAsocInfo = useMemo(() => {
    if (selectedNivel === null) return null;
    const planoAsoc = planos.find((p) => p.nivel === selectedNivel && p.status === 'confirmed');
    if (!planoAsoc) return null;
    return (
      <div
        style={{
          marginTop: 8,
          padding: '6px 10px',
          background: '#1e2024',
          borderRadius: 3,
          border: '1px solid rgba(0,220,229,.2)',
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: '#00dce5',
            fontFamily: "'Geist',monospace",
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          📄 {planoAsoc.name}
        </div>
        <div
          style={{ fontSize: 12, color: '#6b8cae', fontFamily: "'Geist',monospace", marginTop: 2 }}
        >
          Escala 1:{Math.round(planoAsoc.scale)}
        </div>
      </div>
    );
  }, [selectedNivel, planos]);

  return (
    <div style={mainContainerStyle}>
      <PdfViewerNetworkBar
        nets={finalVisibleNets}
        activeNet={activeNet}
        hiddenNets={hiddenNets}
        lockedNets={lockedNets}
        onSelectNet={setActiveNet}
        onToggleHidden={handleToggleHidden}
        onToggleLocked={handleToggleLocked}
        scaleText={scaleText}
        onClose={() => {
          // Idempotente: el doble click no re-dispara el flujo. El prefetch que asegura la
          // caché de TODOS los pisos tiene tope de 4s — una red colgada no bloquea el cierre
          // para siempre (valida con la caché que haya, igual que si el prefetch fallara).
          if (cerrandoRef.current) return;
          cerrandoRef.current = true;
          void (async () => {
            try {
              await Promise.race([prefetchAllTrazos(planos), sleep(4000)]);
            } catch {
              /* validar con la caché que haya */
            }
            const eng = engineRef.current;
            if (eng && !validateBeforeClose(eng, planos, onAlertHandler)) {
              cerrandoRef.current = false;
              return;
            }
            handleSave();
            navigate('/civilflowareatrabajo');
          })();
        }}
      />

      {/* Grosor de líneas: deslizador que define el grosor de TODAS las líneas y elementos de la
          zona de dibujo (orig. usuario). Persistido por plano vía serializeWork → cf_planos. */}
      <div
        style={{
          height: 30,
          flexShrink: 0,
          background: '#14161a',
          borderBottom: '1px solid #2a3435',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
        }}
      >
        <div
          style={{
            fontFamily: "'Geist',monospace",
            fontSize: 12,
            color: '#6b8cae',
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Grosor:
        </div>
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.1}
          value={lineWidthScale}
          aria-label="Grosor de líneas"
          onChange={(e) => {
            const v = Number(e.target.value);
            setLineWidthScale(v);
            const eng = engineRef.current;
            if (eng) {
              eng.lineWidthScale = v;
              eng.render();
              eng._markDirty();
            }
          }}
          style={{ width: 140, accentColor: '#F5A623' }}
        />
        <div
          style={{
            padding: '2px 8px',
            background: '#1e2024',
            border: '1px solid #2a3435',
            color: '#8AB4D6',
            fontSize: 12,
            fontFamily: "'Geist',monospace",
          }}
        >
          {lineWidthScale.toFixed(1)}×
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative', minWidth: 0 }}>
        <div className="visor-sidebar" style={dynamicLeftStyle}>
          <h2 style={PdfViewer_SR_ONLY}>Panel de capas</h2>
          <div
            style={{
              height: 3,
              flexShrink: 0,
              transition: 'background .3s',
              background: bdError ? '#ef4444' : STATUS[saveStatus]?.color || STATUS.error.color,
            }}
          />
          {!isMobile && (
            <PdfViewerToolbar
              tool={tool}
              tipoTramo={tipoTramo}
              onTipoTramoSelect={(t) => setTipoTramo(t)}
              snapOn={snapOn}
              gridOn={gridOn}
              activeNet={activeNet}
              currentFile={currentFile}
              saveStatus={saveStatus}
              bdError={bdError}
              collapsed={leftCollapsed}
              recolectoraActive={recolectoraActive}
              onSelectTool={setTool}
              onSnapToggle={handleSnapToggle}
              onGridToggle={handleGridToggle}
              onFit={handleFit}
              onSave={handleSave}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onClear={handleClear}
              onClearGuides={handleClearGuides}
            />
          )}
        </div>

        <div style={{ position: 'relative', flex: 1, display: 'flex', minHeight: 0, minWidth: 0 }}>
          <h2 style={PdfViewer_SR_ONLY}>Visor de planos</h2>
          <ViewerMobileChrome
            isMobile={isMobile}
            isNarrow={isNarrow}
            currentFile={currentFile ?? null}
            onFit={handleFit}
            onZoomStep={(f) => engineRef.current?.zoomStep(f)}
          />

          <PdfCanvas
            cwRef={cwRef}
            containerRef={containerRef}
            pdfCanvasRef={pdfCanvasRef}
            drawCanvasRef={drawCanvasRef}
            currentFile={currentFile}
            error={error}
            loading={loading}
            selectedNivel={selectedNivel}
            pisos={pisos}
            planos={planos}
            tool={tool}
            snapOn={snapOn}
          />
        </div>

        {/* Diálogos */}
        <TextInputOverlay
          textOverlay={textOverlay}
          setTextOverlay={setTextOverlay}
          textInputRef={textInputRef}
        />
        <DrawingElementContextMenu
          contextMenuState={contextMenuState}
          setContextMenuState={setContextMenuState}
          selectedNivel={selectedNivel}
          pisos={pisos}
          engineRef={engineRef}
          selElement={selElement as PlanoElement | null}
          setSelElement={setSelElement}
          lowerFloorsRamales={lowerFloorsRamales}
          upperFloorGroup={upperFloorGroup}
          planosCtx={planosCtx}
          mats={mats}
          activeNet={activeNet}
          setDiamSel={setDiamSel}
          triggerConfirm={(title, message, onConfirm, confirmLabel) => {
            setConfirmState({
              isOpen: true,
              title,
              message,
              confirmLabel,
              onConfirm: () => {
                onConfirm();
                setConfirmState((prev) => ({ ...prev, isOpen: false }));
              },
            });
          }}
        />
        <ConfirmDialog confirmState={confirmState} setConfirmState={setConfirmState} />
        <AccesorioModal
          modalState={accesorioModal}
          onClose={() => setAccesorioModal((prev) => ({ ...prev, isOpen: false }))}
          onSelect={onAccesorioSelected}
        />

        {/* Barra lateral derecha */}
        <div className="visor-sidebar-right" style={dynamicRightStyle}>
          <h2 style={PdfViewer_SR_ONLY}>Panel de edición</h2>
          <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
            <div
              style={{
                fontFamily: "'Geist',monospace",
                fontSize: 12,
                color: '#849495',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Nivel
            </div>
            <select
              aria-label="Seleccionar nivel"
              value={selectedNivel ?? ''}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : null;
                const idx =
                  v !== null
                    ? planos.findIndex((p) => p.nivel === v && p.status === 'confirmed')
                    : -1;
                setSelectedNivel(v);
                if (idx >= 0 && onSelectPlan) onSelectPlan(idx);
              }}
              style={PdfViewer_S4}
            >
              <option value="">— Seleccionar piso —</option>
              {pisos
                .toSorted((a, b) => b.n - a.n)
                .map((s) => {
                  const tienePlano = planos.some(
                    (p) => p.nivel === s.n && p.status === 'confirmed',
                  );
                  return (
                    <option key={s.id} value={s.n}>
                      {tienePlano ? '🟢 ' : ''}
                      {pisoLbl(s.n)} ({s.npt} m)
                    </option>
                  );
                })}
            </select>
            {planoAsocInfo}
          </div>

          <CopyFromPlanPanel
            engineRef={engineRef}
            currentId={currentId}
            currentIdRef={currentIdRef}
            planosCtx={planosCtx}
            pisos={pisos}
            visibleNets={finalVisibleNets}
          />

          {tool !== 'guide' && (
            <div style={rightSidebarOpacity}>
              {!esCotaSel && (
                <TramoEditor
                  selElement={selElement as PlanoElement | null}
                  activeNet={activeNet}
                  rejillasActive={rejillasActive}
                  engineRef={engineRef}
                  diamSel={diamSel}
                  gasMatSel={gasMatSel}
                  pendSel={pendSel}
                  pendInput={pendInput}
                  mats={mats}
                  matLongName={matLongName}
                  setDiamSel={setDiamSel}
                  setGasMatSel={setGasMatSel}
                  setPendSel={setPendSel}
                  setPendInput={setPendInput}
                  setSelElement={setSelElement}
                  handleUpdateSel={handleUpdateSel}
                  handleRotateLabel={handleRotateLabel}
                  plans={planosCtx.plans}
                  pisos={pisos}
                  triggerConfirm={(title, message, onConfirm, confirmLabel) => {
                    setConfirmState({
                      isOpen: true,
                      title,
                      message,
                      confirmLabel,
                      onConfirm: () => {
                        onConfirm();
                        setConfirmState((prev) => ({ ...prev, isOpen: false }));
                      },
                    });
                  }}
                />
              )}

              <BajanteAsociacion
                selElement={selElement}
                setSelElement={setSelElement}
                selectedNivel={selectedNivel}
                pisoLbl={pisoLbl}
                lowerFloorsRamales={lowerFloorsRamales}
                upperFloorGroup={upperFloorGroup}
                planosCtx={planosCtx}
                engineRef={engineRef}
                triggerConfirm={(title, message, onConfirm, confirmLabel) => {
                  setConfirmState({
                    isOpen: true,
                    title,
                    message,
                    confirmLabel,
                    onConfirm: () => {
                      onConfirm();
                      setConfirmState((prev) => ({ ...prev, isOpen: false }));
                    },
                  });
                }}
              />

              {/* MONTANTES SÍ tienen panel de aparatos (orig. usuario): UDs propagadas/asignadas
                  como bajantes. Solo áreas y guías lo excluyen — EXCEPCIÓN: área de sector del
                  módulo Rejillas de ventilación (rejillas activa + área gas), que cuenta
                  gasodomésticos con conteos libres por aparato. */}
              {!(
                selElement &&
                (esCotaSel ||
                  selElement.id?.startsWith('GL') ||
                  (selElement.id?.startsWith('AR') && !esAreaRejillas))
              ) && (
                <AparatosPanel
                  activeNet={activeNet}
                  selElement={selElement}
                  setSelElement={setSelElement}
                  planId={currentId}
                  engineRef={engineRef}
                  loadingPlanRef={loadingPlanRef}
                  rejillasArea={esAreaRejillas}
                />
              )}

              {!esCotaSel && (
                <PdfViewerDrawnElements
                  drawnElements={drawnElements}
                  activeNet={activeNet}
                  selElement={selElement}
                  engineRef={engineRef}
                />
              )}

              <div style={{ flex: 1 }} />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setLeftCollapsed(!leftCollapsed)}
          style={{
            ...PdfViewer_S5,
            left: leftCollapsed ? LEFT_COLLAPSED_WIDTH : 180,
            borderLeft: '1px solid #3a494a',
            borderRadius: 3,
            transition: 'left 0.2s ease',
          }}
          title={leftCollapsed ? 'Expandir barra izquierda' : 'Colapsar barra izquierda'}
          aria-label={leftCollapsed ? 'Expandir barra izquierda' : 'Colapsar barra izquierda'}
        >
          {leftCollapsed ? '▶' : '◀'}
        </button>

        <button
          type="button"
          onClick={() => setRightCollapsed(!rightCollapsed)}
          style={{
            ...PdfViewer_S5,
            right: rightCollapsed ? 0 : 210,
            borderRight: rightCollapsed ? '1px solid #3a494a' : 'none',
            borderRadius: 3,
            transition: 'right 0.2s ease',
          }}
          title={rightCollapsed ? 'Expandir barra derecha' : 'Colapsar barra derecha'}
          aria-label={rightCollapsed ? 'Expandir barra derecha' : 'Colapsar barra derecha'}
        >
          {rightCollapsed ? '◀' : '▶'}
        </button>
      </div>
    </div>
  );
}

const PdfViewer = memo(PdfViewer_);
export default PdfViewer;
