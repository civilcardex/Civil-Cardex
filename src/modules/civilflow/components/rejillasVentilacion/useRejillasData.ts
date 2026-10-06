import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
// useRejillasData: filas (sectores desde áreas gas del visor), resultados NTC 3631, estado
// de overrides/gas, hidratación desde BD y push con debounce. Extraído verbatim del hub.
import { pisoLbl } from '../../constants/helpers';
import { CATALOGO_BASE, TIPO_DEFAULT } from '../../constants/rejillasNTC3631';
import { APARATOS_BY_TRAMO_KEY, TRAZOS_PREFIX } from '../../constants/storage-keys';
import { usePlans } from '../../context/PlansContext';
import type { PlanoArea } from '../../lib/PlanoEngine/PlanoState';
import { loadRejillasProyecto, saveRejillasProyecto } from '../../services/projectDataService';
import { getActiveProyectoId, loadFromStorage, saveToStorage } from '../../services/storageService';
import type { DrawingData } from '../../utils/drawingSync';
import { calcular } from '../../utils/rejillasCalc';
import type { RejArtefacto } from '../../utils/rejillasCalc';
import { stableStringify } from '../fixturesStorage';
import { ALIAS_CAT_GAS, CAT_GAS_BY_ID, grupoDe } from './rejillasShared';
import type { RejFila } from './rejillasShared';
import { GAS_KEY, loadOverrides, purgarKwById, saveOverrides } from './rejillasStorage';
import type { OverridesMap, RejOverride } from './rejillasStorage';

export function useRejillasData() {
  const { plans } = usePlans();
  const [tick, setTick] = useState(0);
  const [overrides, setOverrides] = useState<OverridesMap>(loadOverrides);
  const [gas, setGas] = useState<'natural' | 'glp'>(() =>
    loadFromStorage<'natural' | 'glp'>(GAS_KEY, 'natural'),
  );
  // Respaldo BD (cf_proyecto_general.rejillas): hidrata del proyecto al montar (si BD tiene
  // datos, gana sobre la caché local) y empuja cada cambio con debounce. Sin proyecto
  // activo queda solo-local, como siempre. localStorage sigue siendo la caché viva.
  // El blob incluye TAMBIÉN los conteos de gasodomésticos por sector (claves gas_<areaId>_
  // <planId> del mapa de aparatos): saveToSupabase solo adjunta claves de ramal/bajante,
  // así que sin esto se pierden al recargar desde BD (orig. usuario).
  const bdTimer = useRef<number | null>(null);
  /** Push agendado y aún no disparado (el cleanup del montaje lo guarda con flush). */
  const bdPendiente = useRef<{ pid: string; ovr: OverridesMap; g: 'natural' | 'glp' } | null>(null);
  /** ts del último push/hidratación aceptado: un blob BD más viejo no gana sobre lo local. */
  const tsRef = useRef<number>(0);
  /** true = el usuario ya editó en esta instancia: la hidratación no pisa nada. */
  const editadoRef = useRef(false);
  const ovRef = useRef(overrides);
  const gasRef = useRef(gas);
  useEffect(() => {
    ovRef.current = overrides;
  }, [overrides]);
  useEffect(() => {
    gasRef.current = gas;
  }, [gas]);
  /** Claves gas_* del mapa de aparatos (gasodomésticos por sector/área). */
  const leerGasod = (): Record<string, Record<string, number>> => {
    const disk = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
    const out: Record<string, Record<string, number>> = {};
    for (const [k, v] of Object.entries(disk)) {
      // Solo claves de ÁREA (gas_AR…): las de ramal ya las persiste saveToSupabase y
      // duplicarlas aquí resucitaba conteos borrados al hidratar desde BD.
      if (/^gas_AR/.test(k) && v && Object.keys(v).length) out[k] = v;
    }
    return out;
  };
  useEffect(() => {
    const pid = getActiveProyectoId();
    if (!pid) return;
    let ignore = false;
    void loadRejillasProyecto(pid).then((blob) => {
      // Lo local manda si el usuario ya editó (hidratación no pisa la primera edición).
      if (ignore || editadoRef.current || !blob || typeof blob !== 'object') return;
      const b = blob as {
        overrides?: OverridesMap;
        gas?: 'natural' | 'glp';
        gasod?: Record<string, Record<string, number>>;
        ts?: number;
      };
      // Frescura: un blob más viejo que el último push/hidratación local no gana.
      if (typeof b.ts === 'number' && b.ts < tsRef.current) return;
      if (b.overrides && typeof b.overrides === 'object' && Object.keys(b.overrides).length) {
        // Purga kwById del blob (potencias personalizadas deprecadas — el catálogo manda).
        purgarKwById(b.overrides);
        setOverrides(b.overrides);
        saveOverrides(b.overrides);
      }
      if (b.gas === 'natural' || b.gas === 'glp') {
        setGas(b.gas);
        saveToStorage(GAS_KEY, b.gas);
      }
      tsRef.current = b.ts ?? Date.now();
      // Gasodomésticos: solo llena huecos — no pisa claves que ya existen en disco con
      // valores locales frescos (compare estable, sin falsos positivos por orden).
      const gasod = b.gasod;
      if (gasod && typeof gasod === 'object') {
        const disk = loadFromStorage<Record<string, Record<string, number>>>(
          APARATOS_BY_TRAMO_KEY,
          {},
        );
        let changed = false;
        for (const [k, v] of Object.entries(gasod)) {
          if (
            k.startsWith('gas_') &&
            v &&
            typeof v === 'object' &&
            !disk[k] &&
            stableStringify(disk[k]) !== stableStringify(v)
          ) {
            disk[k] = v;
            changed = true;
          }
        }
        if (changed) {
          saveToStorage(APARATOS_BY_TRAMO_KEY, disk);
          // detail.origen = 'hidratacion': fill PROGRAMÁTICO — pushGasod no debe marcar
          // editadoRef ni agendar push (el guard de más abajo lo filtra).
          window.dispatchEvent(
            new CustomEvent('aparatos-clear', { detail: { origen: 'hidratacion' } }),
          );
        }
      }
    });
    const timer = bdTimer;
    return () => {
      ignore = true;
      if (timer.current) {
        window.clearTimeout(timer.current);
        // Flush fire-and-forget del push pendiente: sin esto el debounce moría al
        // desmontar y el último cambio no llegaba nunca a BD.
        const p = bdPendiente.current;
        if (p)
          void saveRejillasProyecto(p.pid, {
            overrides: p.ovr,
            gas: p.g,
            gasod: leerGasod(),
            ts: Date.now(),
          });
        timer.current = null;
        bdPendiente.current = null;
      }
    };
  }, []);
  /** Agenda el push al blob (estable: solo lee refs + localStorage). */
  const pushBd = useCallback((ovr: OverridesMap, g: 'natural' | 'glp') => {
    const pid = getActiveProyectoId();
    if (!pid) return;
    if (bdTimer.current) window.clearTimeout(bdTimer.current);
    bdPendiente.current = { pid, ovr, g };
    bdTimer.current = window.setTimeout(() => {
      bdTimer.current = null;
      bdPendiente.current = null;
      // Cambio de proyecto a mitad del debounce: el push stale se descarta.
      if (getActiveProyectoId() !== pid) return;
      const ts = Date.now();
      tsRef.current = ts;
      void saveRejillasProyecto(pid, { overrides: ovr, gas: g, gasod: leerGasod(), ts });
    }, 800);
  }, []);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    // Los conteos de gasodomésticos cambian FUERA de este hook (FixturesPanel:
    // write-through + evento 'aparatos-clear'): cada cambio reagenda el push al blob de BD.
    const pushGasod = (e: Event) => {
      // El fill de hidratación (sync o este hook) dispara el evento programáticamente:
      // NO es edición del usuario — marcar editadoRef aquí abortaba la hidratación de
      // BD y agendaba un push con estado default sobre el blob recién leído.
      if ((e as CustomEvent).detail?.origen === 'hidratacion') return;
      editadoRef.current = true;
      pushBd(ovRef.current, gasRef.current);
    };
    const evs = [
      'storage',
      'aparatos-clear',
      'civilflow_san_sync_changed',
      'civilflow_hidro_sync_changed',
      'civilflow_nets_changed',
      'civilflow_plan_loaded',
    ] as const;
    evs.forEach((e) => window.addEventListener(e, bump));
    window.addEventListener('aparatos-clear', pushGasod);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, bump));
      window.removeEventListener('aparatos-clear', pushGasod);
    };
  }, [pushBd]);

  const filas = useMemo((): RejFila[] => {
    void tick;
    const out: RejFila[] = [];
    for (const plan of plans) {
      if (plan.nivel == null) continue;
      const raw = loadFromStorage<DrawingData | null>(TRAZOS_PREFIX + plan.id, null);
      if (!raw) continue;
      const areas = (raw.areas || []) as PlanoArea[];
      for (const a of areas) {
        if (a.net !== 'gas') continue;
        const key = `gas_${a.id}_${plan.id}`;
        // FUENTE ÚNICA = la clave del área (gas_AR_plan): la escribe el panel derecho del
        // visor (área seleccionada) y la tabla — sin copias de ramales que resuciten
        // conteos borrados (orig. usuario: "se resetean a los anteriores").
        const store = loadFromStorage<Record<string, Record<string, number>>>(
          APARATOS_BY_TRAMO_KEY,
          {},
        );
        const counts: Record<string, number> = { ...(store[key] || {}) };
        const ov = overrides[a.id] || {};
        // Columnas de aparato: los ids asignados + slots vacíos extra (＋ del título).
        const aparatos = [
          ...Object.keys(counts)
            .filter((id) => (counts[id] || 0) > 0)
            .map((id) => {
              // La potencia ya NO es editable: la fija el catálogo NTC 3728 según el tipo
              // de gas del proyecto (tabla GLP o gas natural); id sin entrada → 0 kW.
              const c = CAT_GAS_BY_ID.get(ALIAS_CAT_GAS[id] ?? id);
              return {
                id,
                cant: counts[id] || 1,
                kw: c ? (gas === 'glp' ? (c.kwglp ?? c.kw ?? 0) : (c.kw ?? 0)) : 0,
                tipo: ov.tipoById?.[id] ?? TIPO_DEFAULT[grupoDe(id) || 'otros'],
                clave: key,
                vacio: false,
              };
            }),
          ...Array.from({ length: ov.slotsExtra || 0 }, () => ({
            id: '',
            cant: 1,
            kw: 0,
            tipo: TIPO_DEFAULT.otros as 'A' | 'B' | 'C',
            clave: key,
            vacio: true,
          })),
        ];
        out.push({
          key,
          areaId: a.id,
          planId: String(plan.id),
          planLbl: plan.name || `Plano ${plan.id}`,
          sector: ov.sector ?? a.label ?? a.id,
          apto: ov.apto ?? 'A',
          piso: ov.piso ?? pisoLbl(plan.nivel ?? 0),
          areaM2: a.areaM2 || 0,
          altoM: ov.altoM ?? a.alturaM ?? 2.4,
          mono: ov.mono ?? false,
          sol: ov.sol ?? 'ext-dir',
          vadj: ov.vadj ?? 0,
          padj: ov.padj ?? 0,
          aconec: ov.aconec ?? 0,
          aparatos,
        });
      }
    }
    return out;
  }, [plans, overrides, tick, gas]);

  const resultados = useMemo(
    () =>
      filas.map((f) =>
        calcular({
          nombre: `Apto ${f.apto} · ${f.piso} · ${f.sector}`,
          areaM2: f.areaM2,
          altoM: f.altoM,
          mono: f.mono,
          piso: f.piso,
          artefactos: f.aparatos
            .map<RejArtefacto>((a) => {
              const g = grupoDe(a.id) || 'otros';
              return {
                tipo: g === 'estufa' ? 'Estufa' : g === 'calent' ? 'Calentador' : 'Otros',
                clase: a.tipo,
                kw: a.kw, // fija el catálogo NTC 3728 (0 = sin entrada, no aporta)
                cant: a.id ? a.cant : 0,
              };
            })
            .filter((a) => a.cant > 0),
          sol: f.sol,
          vadj: f.vadj,
          padj: f.padj,
          aconec: f.aconec,
          gas,
          catalogo: CATALOGO_BASE,
          importadas: false,
        }),
      ),
    [filas, gas],
  );

  // Ponytail: updater puro — StrictMode invoca los updaters 2× (doble save/push); efectos fuera.
  const setOv = (key: string, patch: RejOverride) => {
    const next = { ...overrides, [key]: { ...overrides[key], ...patch } };
    setOverrides(next);
    saveOverrides(next);
    editadoRef.current = true;
    pushBd(next, gas);
  };

  /** Cambia el tipo de gas: estado + caché local + blob BD (un solo camino). */
  const cambiarGas = (v: 'natural' | 'glp') => {
    setGas(v);
    saveToStorage(GAS_KEY, v);
    editadoRef.current = true;
    pushBd(overrides, v);
  };

  return { filas, resultados, gas, setGas, setOv, overrides, cambiarGas };
}
