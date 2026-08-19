import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  APARATOS_DEF,
  UD_BASE_INIT,
  ACCESORIOS_HIDRO,
  GAS_ACCESORIOS,
  AF_UC_IDS,
  AC_UC_IDS,
} from '../constants';
import { NETS } from '../lib/PlanoEngine/PlanoState';
import { usePlans } from '../context/PlansContext';
import { useApparatus } from '../context/ApparatusContext';
import { writeSanDrawingSync, writeHydroDrawingSync } from '../utils/drawingSync';
import type { DrawingData } from '../utils/drawingSync';
import { loadFromStorage, saveToStorage } from '../services/storageService';
import FixtureGrid from './fixtures/FixtureGrid';
import AccesoriosSection from './fixtures/AccessoriesSection';
import { devError } from '../../../utils/devError';
import { resolveJunctionEntrant } from '../utils/flowDirection';
import { extremoEntrelazado, flowEndsAt } from '../lib/PlanoEngine/PlanoEngineDrawing';
import type PlanoEngine from '../lib/PlanoEngine/PlanoEngine';

const HIDROSAN_IDS = new Set(['af', 'ac', 'san']);
const GAS_ID = 'gas';

import {
  TRAZOS_PREFIX,
  GAS_ACC_KEY,
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
} from '../constants/storage-keys';
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

const UNIDAD = {
  uc: 'UC',
  ud: 'UD',
  qgas: 'm³/h',
};

const SAN_UD_IDS = new Set(UD_BASE_INIT.map((d) => d.id));

type CountsMap = Record<string, Record<string, number>>;
interface HidroDataEntry {
  accesorios: Record<string, number>;
  Lh: number;
  nSalidas: number;
}
type HidroDataMap = Record<string, HidroDataEntry>;
type GasAccMap = Record<string, Record<string, number>>;

function loadAll(): CountsMap {
  return loadFromStorage(APARATOS_BY_TRAMO_KEY, {}) as CountsMap;
}

function saveAll(map: CountsMap) {
  saveToStorage(APARATOS_BY_TRAMO_KEY, map);
}

function loadHidroData(): HidroDataMap {
  return loadFromStorage(HYDRO_DATA_STORAGE_KEY, {});
}

function saveHidroData(map: HidroDataMap) {
  saveToStorage(HYDRO_DATA_STORAGE_KEY, map);
}

function loadGasAcc(): GasAccMap {
  const raw = loadFromStorage<GasAccMap>(GAS_ACC_KEY, {});
  const next: GasAccMap = { ...raw };
  for (const [tramoId, map] of Object.entries(next)) {
    if (!map || typeof map !== 'object') continue;
    const vals = Object.values(map).filter((v) => typeof v === 'number');
    if (vals.length === 0 || vals.every((v) => v <= 0)) {
      delete next[tramoId];
    }
  }
  return next;
}

function saveGasAcc(map: GasAccMap) {
  saveToStorage(GAS_ACC_KEY, map);
}

type ApUnitKey = 'qgas' | 'uc_ac' | 'uc_af' | 'ud';

function unitFor(netId: string): ApUnitKey | null {
  const net = NETS.find((n) => n.id === netId);
  if (!net) return null;
  if (netId === GAS_ID) return 'qgas';
  if (net.ucType === 'uc') return netId === 'ac' ? 'uc_ac' : 'uc_af';
  if (net.ucType === 'ud') return 'ud';
  return null;
}

function esAplicable(ap: (typeof APARATOS_DEF)[number], netId: string, unitKey: ApUnitKey | null) {
  if (netId === GAS_ID) return ap.grupo === 'g' && (ap.qgas || 0) > 0;
  if (unitKey === 'ud') return SAN_UD_IDS.has(ap.id);
  if (unitKey === 'uc_af') return AF_UC_IDS.includes(ap.id);
  if (unitKey === 'uc_ac') return AC_UC_IDS.includes(ap.id);
  return false;
}

interface SelectableTarget {
  id?: string;
  tipo?: string;
  label?: string;
  code?: string;
  mergesFrom?: [string, string];
  net?: string;
  pts?: number[][];
  _tribReversed?: boolean;
}

function isCountableTarget(el: SelectableTarget | null): boolean {
  if (!el) return false;
  return (
    el.id?.startsWith('R') ||
    el.id?.startsWith('B') ||
    el.id?.startsWith('T') ||
    el.tipo === 'calentador'
  );
}

const AparatosPanel = memo(function AparatosPanel_({
  activeNet,
  selElement,
  planId,
  engineRef,
}: {
  activeNet: string;
  selElement: SelectableTarget | null;
  planId?: string | number;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
}) {
  const { plans } = usePlans();
  const { aps } = useApparatus();
  const [counts, setCounts] = useState<CountsMap>(loadAll);
  const [hidroData, setHidroData] = useState<HidroDataMap>(loadHidroData);
  const [gasAcc, setGasAcc] = useState<GasAccMap>(loadGasAcc);
  const [open, setOpen] = useState(true);
  const [pulse, setPulse] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastTargetRef = useRef<string | null>(null);

  useEffect(() => {
    const existingIds = new Set<string>();
    for (const plano of plans) {
      if (!plano || plano.status !== 'confirmed') continue;
      try {
        const data = loadFromStorage<DrawingData | null>(TRAZOS_PREFIX + plano.id, null);
        if (!data) continue;
        for (const r of data.ramales || []) {
          if (r.net === 'gas' && r.tipo !== 'tributario') existingIds.add(r.id);
        }
      } catch {
        // ignorar
      }
    }
    setGasAcc((prev) => {
      let changed = false;
      const next: GasAccMap = {};
      for (const id of existingIds) {
        if (prev[id]) next[id] = prev[id];
      }
      if (Object.keys(next).length !== Object.keys(prev).length) changed = true;
      return changed ? next : prev;
    });
  }, [plans]);

  useEffect(() => {
    const reloadAll = () => {
      setCounts(loadAll());
      setHidroData(loadHidroData());
      setGasAcc(loadGasAcc());
    };
    window.addEventListener('storage', reloadAll);
    window.addEventListener('aparatos-clear', reloadAll);
    return () => {
      window.removeEventListener('storage', reloadAll);
      window.removeEventListener('aparatos-clear', reloadAll);
    };
  }, []);

  useEffect(() => {
    saveAll(counts);
    saveHidroData(hidroData);
    saveGasAcc(gasAcc);
  }, [counts, hidroData, gasAcc]);

  useEffect(() => {
    try {
      writeSanDrawingSync(plans);
    } catch (e) {
      devError('AparatosPanel:', e);
    }
    try {
      writeHydroDrawingSync(plans);
    } catch (e) {
      devError('AparatosPanel:', e);
    }
  }, [counts, hidroData, plans]);

  // Un bajante de calentador es siempre elemento AC (net 'ac') aunque el usuario lo ancle estando
  // en la red AF — sus aparatos deben caer en `ac_<id>_<planId>` para que el ramal sintético
  // AC-01-{id} (buildTramos) los tome en la tabla de selección de calentador. Usar activeNet aquí
  // los escribiría bajo `af_<id>_<planId>` y la tabla del calentador no leería nada.
  const netId = selElement?.tipo === 'calentador' ? selElement.net || 'ac' : activeNet;
  const isGas = netId === GAS_ID;
  const isHidro = HIDROSAN_IDS.has(netId);
  const isAfAc = netId === 'af' || netId === 'ac';
  const visible = isHidro || isGas;

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

  const target = useMemo(
    () =>
      isCountableTarget(selElement)
        ? selElement
        : selElement?.tipo === 'contador'
          ? { ...selElement, id: 'CNT1' }
          : null,
    [selElement],
  );
  const targetId = target?.id || null;
  const targetLbl = target?.label || target?.code || target?.id || '';
  const storageKey = targetId
    ? planId
      ? `${netId}_${targetId}_${planId}`
      : `${netId}_${targetId}`
    : null;

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
  const allRamalesForPlan = planId
    ? loadFromStorage<DrawingData | null>(TRAZOS_PREFIX + planId, null)?.ramales || []
    : [];

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
    // Si target es el ramal auto-creado, su propio mergesFrom es el par de fuentes; si no,
    // hallar el ramal auto-creado que lista a target como una de sus dos fuentes.
    const isAutoCreated = !!target.mergesFrom;
    const hostR = isAutoCreated
      ? target
      : allRamalesForPlan.find((r) => r.net === netId && r.mergesFrom?.includes(target.id!));
    if (!hostR?.mergesFrom) return null;
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
    const jc = hostR.pts[0];
    const existingObj = allRamalesForPlan.find((r) => r.id === aId);
    const incomingObj = allRamalesForPlan.find((r) => r.id === bId);
    const entrantId = existingObj
      ? resolveJunctionEntrant(
          jc,
          existingObj,
          { id: hostR.id, pts: hostR.pts, _tribReversed: Boolean(hostR._tribReversed) },
          incomingObj,
        )
      : aId;
    if (entrantId !== target.id) return null;
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
    return allKeys;
  })();

  const currentMap = useMemo(() => {
    if (!storageKey) return {};
    const own = counts[storageKey] || {};
    if (!mergeKeys) return own;
    const merged: Record<string, number> = { ...own };
    for (const k of mergeKeys) {
      for (const [apId, v] of Object.entries(counts[k] || {})) {
        merged[apId] = (merged[apId] || 0) + v;
      }
    }
    return merged;
  }, [counts, storageKey, mergeKeys]);

  const curHidro = useMemo(() => {
    if (!storageKey) return { accesorios: {}, Lh: 0, nSalidas: 0 };
    return hidroData[storageKey] || { accesorios: {}, Lh: 0, nSalidas: 0 };
  }, [hidroData, storageKey]);

  const total = useMemo(() => {
    if (!storageKey) return 0;
    let s = 0;
    for (const ap of items) {
      const u = (unitKey ? ap[unitKey] : undefined) || 0;
      s += (currentMap[ap.id] || 0) * u;
    }
    return s;
  }, [items, currentMap, unitKey, storageKey]);

  // Total de unidades MANUALES propias de este tramo (sin sumas combinadas de fuentes) — el
  // cap del ítem 6 (máximo 1 aparato) aplica solo sobre lo que el usuario asigna aquí.
  const ownTotal = useMemo(() => {
    if (!storageKey) return 0;
    return Object.values(counts[storageKey] || {}).reduce((s, v) => s + v, 0);
  }, [counts, storageKey]);

  const totalStr = useMemo(() => {
    if (Number.isInteger(total)) return String(total);
    return total.toFixed(2);
  }, [total]);

  const inc = (apId: string) => {
    if (!storageKey) return;
    // Punto de suma combinada (ramal que MUESTRA el total de sus fuentes de empalme): la
    // grilla queda en solo-lectura — el usuario nunca edita aquí, edita en las fuentes.
    if (mergeKeys) return;
    // Ítem 6: máximo UN aparato por ramal (manual). Los ramales que reciben sumas de otros
    // tramos sí pueden mostrar más, pero eso llega solo por suma — nunca por conteo manual.
    if (ownTotal >= 1) {
      engineRef.current?.triggerAlert(
        'Máximo 1 aparato por ramal',
        'Un ramal admite máximo un aparato asignado manualmente. Si necesitas más unidades, crea otro ramal (o tributario) desde el cuerpo de este.',
      );
      return;
    }
    // Ítem 2/3 (rev 4): el aparato SOLO va en el extremo LIBRE hacia el que apunta el flujo del
    // ramal — el glifo del codo (af/ac) y el símbolo del aparato se derivan de
    // aparatoInicio/Fin, y no deben aparecer en conexiones de T/Y. Si el extremo de entrega
    // está ocupado o el flujo va en contra del libre, bloqueado con alerta. Solo la primera
    // unidad escribe el campo; si ya hay un aparato (del menú contextual), solo suma el conteo.
    const eng = engineRef.current;
    const live = eng?.ramales.find((r) => r.id === targetId);
    const firstUnit = !(counts[storageKey] || {})[apId];
    if (
      eng &&
      live &&
      live.pts &&
      live.pts.length >= 2 &&
      (live.net === 'af' || live.net === 'ac' || live.net === 'gas')
    ) {
      const head = live.pts[live.pts.length - 1];
      const tail = live.pts[0];
      const headOcc = extremoEntrelazado(eng.ramales, eng.bajantes || [], live, head);
      const tailOcc = extremoEntrelazado(eng.ramales, eng.bajantes || [], live, tail);
      const headOk = !headOcc && flowEndsAt(live, head, 0.5);
      const tailOk = !tailOcc && flowEndsAt(live, tail, 0.5);
      if (headOcc && tailOcc) {
        eng.triggerAlert(
          'Aparato no permitido',
          'El ramal está conectado por ambos extremos (ramal de paso): el aparato solo puede ir en un extremo libre. Crea un ramal nuevo desde el cuerpo de este para el aparato.',
        );
        return;
      }
      if (!headOk && !tailOk) {
        eng.triggerAlert(
          'Aparato no permitido',
          'El flujo del ramal apunta a la conexión (va en contra del extremo libre): el aparato solo se dibuja en el extremo libre hacia el que apunta el flujo. Invierte la dirección del ramal antes de asignar el aparato.',
        );
        return;
      }
      const endPt = headOk ? head : tail;
      const field: 'aparatoInicio' | 'aparatoFin' = endPt === head ? 'aparatoFin' : 'aparatoInicio';
      const accField = field === 'aparatoInicio' ? 'accesorioInicio' : 'accesorioFin';
      const hasBajante = (eng.bajantes || []).some(
        (b) =>
          Math.abs(b.x - endPt[0]) < 0.5 && Math.abs(b.y - endPt[1]) < 0.5 && b.net === live.net,
      );
      if (live[accField] || hasBajante) {
        eng.triggerAlert(
          'Extremo ocupado',
          'El extremo libre del ramal ya tiene accesorio o bajante. Elimínalo antes de asignar el aparato desde la sidebar.',
        );
        return;
      }
      if (firstUnit && !live.aparatoInicio && !live.aparatoFin) {
        eng.updateElementById(live.id, { [field]: apId });
        eng.render();
      }
    }
    setCounts((prev) => {
      const cur = prev[storageKey] || {};
      return { ...prev, [storageKey]: { ...cur, [apId]: (cur[apId] || 0) + 1 } };
    });
  };

  const dec = (apId: string) => {
    if (!storageKey) return;
    const curBefore = { ...(counts[storageKey] || {}) };
    const vBefore = (curBefore[apId] || 0) - 1;
    if (vBefore <= 0 && targetId) {
      // Ítem 11: el último contador de este aparato se eliminó — si el ramal VIVO del motor lo
      // tiene asignado como aparatoInicio/Fin, limpiarlo para que el glifo desaparezca del
      // canvas (el contador del panel es la fuente de verdad; el campo del ramal solo lo
      // refleja mientras haya unidades asignadas).
      const eng = engineRef.current;
      const live = eng?.ramales.find((r) => r.id === targetId);
      if (eng && live && (live.aparatoInicio === apId || live.aparatoFin === apId)) {
        const updates: Record<string, unknown> = {};
        if (live.aparatoInicio === apId) updates.aparatoInicio = null;
        if (live.aparatoFin === apId) updates.aparatoFin = null;
        eng.updateElementById(targetId, updates);
        eng.render();
        eng._markDirty();
      }
    }
    setCounts((prev) => {
      const cur = { ...(prev[storageKey] || {}) };
      const v = (cur[apId] || 0) - 1;
      if (v <= 0) delete cur[apId];
      else cur[apId] = v;
      const next = { ...prev, [storageKey]: cur };
      if (Object.keys(cur).length === 0) delete next[storageKey];
      return next;
    });
  };

  const incAcc = (accId: string) => {
    if (!storageKey) return;
    setHidroData((prev) => {
      const cur = { ...(prev[storageKey] || { accesorios: {}, Lh: 0, nSalidas: 0 }) };
      const acc = { ...(cur.accesorios || {}) };
      acc[accId] = (acc[accId] || 0) + 1;
      const next = { ...prev, [storageKey]: { ...cur, accesorios: acc } };
      return next;
    });
  };

  const decAcc = (accId: string) => {
    if (!storageKey) return;
    setHidroData((prev) => {
      const cur = { ...(prev[storageKey] || { accesorios: {}, Lh: 0, nSalidas: 0 }) };
      const acc = { ...(cur.accesorios || {}) };
      const v = (acc[accId] || 0) - 1;
      if (v <= 0) delete acc[accId];
      else acc[accId] = v;
      return { ...prev, [storageKey]: { ...cur, accesorios: acc } };
    });
  };

  const gasAccMap = useMemo(() => {
    if (!targetId) return {};
    return gasAcc[targetId] || {};
  }, [gasAcc, targetId]);

  const incAccGas = (accId: string) => {
    if (!targetId) return;
    setGasAcc((prev) => {
      const cur = { ...(prev[targetId] || {}) };
      cur[accId] = (cur[accId] || 0) + 1;
      return { ...prev, [targetId]: cur };
    });
  };

  const decAccGas = (accId: string) => {
    if (!targetId) return;
    setGasAcc((prev) => {
      const cur = { ...(prev[targetId] || {}) };
      const v = (cur[accId] || 0) - 1;
      if (v <= 0) delete cur[accId];
      else cur[accId] = v;
      const next = { ...prev };
      if (Object.keys(cur).length === 0) delete next[targetId];
      else next[targetId] = cur;
      return next;
    });
  };

  // Ítem: las orientaciones del codo 90° medio se fusionan en UNA sola fila de la sidebar —
  // el contador suma horizontal + sube + baja, independiente de la orientación pedida. La fila
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
      ).map((a) => (a.id === 'codo90rm' ? { ...a, nombre: 'Codo 90° horizontal' } : a)),
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
    <div ref={containerRef} style={containerStyle}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={FixturesPanel_S1}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 }}>
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
              {isGas ? 'Selecciona un tramo de gas' : 'Selecciona un ramal/bajante en el dibujo'}
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
                  disabled={!!mergeKeys}
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
      {isGas && (
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
  );
});
export default AparatosPanel;
