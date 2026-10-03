import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlans } from '../context/PlansContext';
import { loadFromStorage, saveToStorage } from '../services/storageService';
import {
  ACTIVE_PROYECTO_ID_KEY,
  APARATOS_BY_TRAMO_KEY,
  TRAZOS_PREFIX,
} from '../constants/storage-keys';
import { loadRejillasProyecto, saveRejillasProyecto } from '../services/projectDataService';
import type { DrawingData } from '../utils/drawingSync';
import type { PlanoArea } from '../lib/PlanoEngine/PlanoState';
import {
  CATALOGO_BASE,
  KW_DEFAULT,
  SOL,
  TIPO_DEFAULT,
  type GrupoGasod,
} from '../constants/rejillasNTC3631';
import {
  calcular,
  clasifRecinto,
  memoriaRecinto,
  solucionAplicada,
  type RejArtefacto,
  type RejResultado,
} from '../utils/rejillasCalc';
import EditButton from './shared/EditButton';
import { stableStringify } from './fixturesStorage';
import { devError } from '../../../utils/devError';
import { pisoLbl } from '../constants/helpers';
import { APARATOS_DEF } from '../constants/engineeringDataFixtures';

// Módulo Rejillas de ventilación (NTC 3631, 3ª actualización) — tabla Tipologías por sector.
// Los sectores SOLO nacen de áreas dibujadas en el visor con la pestaña Gas activa (sin
// "+ Sector" ni "Duplicar"): Sector = etiqueta del área, Área = área del polígono (m²),
// Alto = altura libre capturada en el panel derecho, Gasodomésticos = conteos de aparatos
// del área (FixturesPanel, clave gas_<areaId>_<planId>). El resto de columnas son fórmulas
// o desplegables del motor NTC 3631. Incluye el alzado del muro con las aberturas a escala.

const OVERRIDES_KEY = 'rejillas_overrides_v1';
const GAS_KEY = 'rejillas_gas';

/** Override editable por sector (lo que no viene del dibujo ni del catálogo). */
interface RejOverride {
  sector?: string;
  apto?: string;
  piso?: string;
  mono?: boolean;
  altoM?: number;
  sol?: string;
  vadj?: number;
  padj?: number;
  aconec?: number;
  /** Columnas de aparato: kW y Tipo por id, y slots vacíos extra (＋ del título). */
  kwById?: Record<string, number>;
  tipoById?: Record<string, 'A' | 'B' | 'C'>;
  slotsExtra?: number;
}
type OverridesMap = Record<string, RejOverride>;

const loadOverrides = (): OverridesMap => loadFromStorage<OverridesMap>(OVERRIDES_KEY, {});
const saveOverrides = (o: OverridesMap) => saveToStorage(OVERRIDES_KEY, o);

const num = (x: number | undefined | null, d = 1) =>
  (+(x ?? 0) || 0).toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Fila de la tabla Tipologías: sector del dibujo + overrides + columnas de aparato. */
interface RejFila {
  key: string;
  areaId: string;
  planId: string;
  planLbl: string;
  sector: string;
  apto: string;
  piso: string;
  areaM2: number;
  altoM: number;
  mono: boolean;
  sol: string;
  vadj: number;
  padj: number;
  aconec: number;
  /** Columnas de aparato: uno por id asignado + slots vacíos extra (＋ del título). */
  aparatos: Array<{
    id: string;
    cant: number;
    kw: number;
    tipo: 'A' | 'B' | 'C';
    clave: string;
    vacio: boolean;
  }>;
}

/** Cambia el aparato de una columna: consume el slot si estaba vacío o reemplaza el id
 *  en su clave de origen conservando la cantidad (bidireccional con el visor). */
function onAparatoCol(
  f: RejFila,
  colIdx: number,
  nuevoId: string,
  setOv: (key: string, patch: RejOverride) => void,
): void {
  const col = f.aparatos[colIdx];
  if (!col || col.id === nuevoId) return;
  try {
    const disk = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
    const cur = { ...(disk[col.clave] || {}) };
    // No pisar un aparato ya presente en el sector: alerta y fuera, sin tocar disco.
    if (nuevoId && cur[nuevoId] !== undefined) {
      window.alert('Ese aparato ya existe en este sector');
      return;
    }
    if (col.vacio) {
      setOv(f.areaId, {
        slotsExtra: Math.max(0, (f.aparatos.filter((a) => a.vacio).length || 1) - 1),
      });
    }
    delete cur[col.id];
    // Vaciar la columna (— etc —): solo borra el id en su clave, nunca escribe la clave ''.
    if (nuevoId) cur[nuevoId] = col.cant;
    saveToStorage(APARATOS_BY_TRAMO_KEY, { ...disk, [col.clave]: cur });
    window.dispatchEvent(new Event('aparatos-clear'));
  } catch (e) {
    devError('RejillasVentilacion.onAparatoCol:', e);
  }
}

/** Cantidad exacta de una columna: escribe en su clave de origen (área o ramal). */
function setCantCol(f: RejFila, colIdx: number, cant: number): void {
  const col = f.aparatos[colIdx];
  if (!col || col.vacio || cant < 0) return;
  try {
    const disk = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
    const cur = { ...(disk[col.clave] || {}) };
    if (cant === 0) delete cur[col.id];
    else cur[col.id] = cant;
    saveToStorage(APARATOS_BY_TRAMO_KEY, { ...disk, [col.clave]: cur });
    window.dispatchEvent(new Event('aparatos-clear'));
  } catch (e) {
    devError('RejillasVentilacion.setCantCol:', e);
  }
}

/** Elimina una columna de aparato: resta todo lo suyo (y libera el slot si estaba vacío). */
function quitarColumna(
  f: RejFila,
  colIdx: number,
  setOv: (key: string, patch: RejOverride) => void,
): void {
  const col = f.aparatos[colIdx];
  if (!col) return;
  if (col.vacio) {
    setOv(f.areaId, {
      slotsExtra: Math.max(0, (f.aparatos.filter((a) => a.vacio).length || 1) - 1),
    });
    return;
  }
  quitarAparato(col.clave, col.id);
}

/** Quita la columna SOLO en la clave de origen del sector (el sweep del plano entero
 *  borraba la misma columna en otros sectores: pérdida silenciosa). */
function quitarAparato(clave: string, id: string): void {
  try {
    const disk = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
    const cur = { ...(disk[clave] || {}) };
    if (cur[id] === undefined) return;
    delete cur[id];
    const next = { ...disk };
    if (Object.keys(cur).length === 0) delete next[clave];
    else next[clave] = cur;
    saveToStorage(APARATOS_BY_TRAMO_KEY, next);
    window.dispatchEvent(new Event('aparatos-clear'));
  } catch (e) {
    devError('RejillasVentilacion.quitarAparato:', e);
  }
}

/** Gasodomésticos por grupo según el aparato (ids de APARATOS_DEF grupo 'g'). */
function grupoDe(apId: string): GrupoGasod | null {
  if (/^est/.test(apId)) return 'estufa';
  if (/^cal/.test(apId)) return 'calent';
  return 'otros';
}

/** Estado + datos derivados del módulo (compartido por la tabla y la página de alzado). */
function useRejillasData() {
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
  const bdPendiente = useRef<{ pid: number; ovr: OverridesMap; g: 'natural' | 'glp' } | null>(null);
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
  const proyectoIdActivo = (): number => {
    const raw = localStorage.getItem(ACTIVE_PROYECTO_ID_KEY);
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
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
    const pid = proyectoIdActivo();
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
          window.dispatchEvent(new Event('aparatos-clear'));
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
    const pid = proyectoIdActivo();
    if (!pid) return;
    if (bdTimer.current) window.clearTimeout(bdTimer.current);
    bdPendiente.current = { pid, ovr, g };
    bdTimer.current = window.setTimeout(() => {
      bdTimer.current = null;
      bdPendiente.current = null;
      // Cambio de proyecto a mitad del debounce: el push stale se descarta.
      if (proyectoIdActivo() !== pid) return;
      const ts = Date.now();
      tsRef.current = ts;
      void saveRejillasProyecto(pid, { overrides: ovr, gas: g, gasod: leerGasod(), ts });
    }, 800);
  }, []);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    // Los conteos de gasodomésticos cambian FUERA de este hook (FixturesPanel:
    // write-through + evento 'aparatos-clear'): cada cambio reagenda el push al blob de BD.
    const pushGasod = () => {
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
            .map((id) => ({
              id,
              cant: counts[id] || 1,
              kw: ov.kwById?.[id] ?? KW_DEFAULT[grupoDe(id) || 'otros'],
              tipo: ov.tipoById?.[id] ?? TIPO_DEFAULT[grupoDe(id) || 'otros'],
              clave: key,
              vacio: false,
            })),
          ...Array.from({ length: ov.slotsExtra || 0 }, () => ({
            id: '',
            cant: 1,
            kw: KW_DEFAULT.otros,
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
  }, [plans, overrides, tick]);

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
                kw: a.kw,
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

const REJILLAS = React.memo(function RejillasVentilacion() {
  const { filas, resultados, gas, setOv, overrides, cambiarGas } = useRejillasData();
  const [selIdx, setSelIdx] = useState(0);
  const [edit, setEdit] = useState(false);
  const hayM2 = resultados.some((r) => r.metodoAplicado === '2');
  const sel = Math.min(selIdx, filas.length - 1);

  return (
    <>
      {/* Selector de tipo de gas FUERA y encima de la tarjeta (orig. usuario). */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '2px 2px 8px',
          fontSize: 12,
          color: 'var(--txt2)',
        }}
      >
        <span>Tipo de gas</span>
        <select
          value={gas}
          aria-label="Tipo de gas del proyecto"
          onChange={(e) => {
            cambiarGas(e.target.value as 'natural' | 'glp');
          }}
          style={{
            fontSize: 12,
            padding: '4px 8px',
            background: 'var(--bg3)',
            color: 'var(--txt)',
            border: '1px solid var(--line)',
            borderRadius: 4,
          }}
        >
          <option value="natural">Natural</option>
          <option value="glp">GLP (más denso que el aire)</option>
        </select>
        <span style={{ fontSize: 11, color: 'var(--txt3)' }}>
          Sectores: áreas dibujadas con la red Gas activa en el visor (etiqueta = sector).
        </span>
      </div>
      <section className="card" aria-label="Rejillas de ventilación">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <img
            src="/iconos_civilflow/diseno_redes/gas/rejilla_ventilacion.webp"
            alt=""
            width={24}
            height={24}
            style={{ width: 24, height: 24, objectFit: 'contain' }}
            loading="lazy"
          />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--txt)' }}>
            Rejillas de ventilación
          </h3>
          <span
            style={{
              fontSize: 11,
              fontFamily: 'var(--mono)',
              color: 'var(--txt2)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: '1px 8px',
            }}
          >
            {filas.length} {filas.length === 1 ? 'sector' : 'sectores'}
          </span>
          <div style={{ marginLeft: 'auto' }}>
            <EditButton edit={edit} setEdit={setEdit} />
          </div>
        </div>
        <div style={{ padding: '8px 10px' }}>
          <TablaTipologias
            filas={filas}
            resultados={resultados}
            gas={gas}
            edit={edit}
            sel={sel < 0 ? 0 : sel}
            onSelect={setSelIdx}
            onOv={setOv}
            overrides={overrides}
          />

          {filas.length > 0 && (
            <>
              <AlertasResumen
                filas={filas}
                resultados={resultados}
                gas={gas}
                hayM2={hayM2}
                sel={sel < 0 ? 0 : sel}
              />
              <DetalleSector res={resultados[sel < 0 ? 0 : sel]} />
            </>
          )}
        </div>
      </section>
    </>
  );
});

// ── Tabla Tipologías ─────────────────────────────────────────────────────────
const TD: React.CSSProperties = {
  border: '1px solid var(--line)',
  padding: '2px 5px',
  fontSize: 12.5,
  fontFamily: 'var(--mono)',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  color: 'var(--txt)',
};
const TH: React.CSSProperties = {
  ...TD,
  background: 'var(--bg3)',
  fontWeight: 600,
  fontSize: 11.5,
  color: 'var(--txt3)',
  fontFamily: 'var(--mono)',
  textTransform: 'uppercase',
  verticalAlign: 'middle',
  whiteSpace: 'normal',
  lineHeight: 1.15,
};
/** Sub-título bajo un grupo (fila 2 del encabezado). */
const THS: React.CSSProperties = { ...TH, fontSize: 11 };
const INP: React.CSSProperties = {
  width: '100%',
  minWidth: 44,
  background: 'transparent',
  border: 'none',
  color: 'var(--acc2)',
  fontFamily: 'var(--mono)',
  fontSize: 12.5,
  textAlign: 'center',
  padding: '2px',
};
const SEL: React.CSSProperties = { ...INP, minWidth: 60 };
const THG: React.CSSProperties = {
  ...TH,
  fontSize: 12,
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
  textAlign: 'center',
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  borderBottom: '2px solid var(--line)',
};

function TablaTipologias({
  filas,
  resultados,
  gas,
  edit,
  sel,
  onSelect,
  onOv,
  overrides,
}: {
  filas: RejFila[];
  resultados: RejResultado[];
  gas: 'natural' | 'glp';
  edit: boolean;
  sel: number;
  onSelect: (i: number) => void;
  onOv: (key: string, patch: RejOverride) => void;
  overrides: OverridesMap;
}) {
  // Encabezado de 2 filas como la tabla de referencia: grupos arriba, subcolumnas abajo.
  // El conteo de columnas es el MÁXIMO entre filas: usar filas[0] desalineaba el encabezado
  // cuando la primera fila tenía menos columnas de aparato que el resto.
  const nCols = Math.max(0, ...filas.map((f) => f.aparatos.length)) || 1;
  // Sub-campo apilado: etiqueta mini + control.
  const Sub = ({ k, children }: { k: string; children: React.ReactNode }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '34px 1fr', gap: 3, alignItems: 'center' }}>
      <span style={{ fontSize: 9, color: 'var(--txt3)', fontFamily: 'var(--mono)' }}>{k}</span>
      {children}
    </div>
  );
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th rowSpan={2} style={TH}>
              #
            </th>
            <th rowSpan={2} style={TH}>
              Apto
            </th>
            <th rowSpan={2} style={TH}>
              Piso
            </th>
            <th style={THG} colSpan={4}>
              Recinto
            </th>
            <th style={{ ...THG }} colSpan={Math.max(nCols, 1)}>
              Gasodomésticos
              <button
                type="button"
                aria-label="Añadir una columna de aparato al sector seleccionado"
                title="Añadir una columna de aparato (— etc —) al sector seleccionado"
                onClick={(e) => {
                  e.stopPropagation();
                  const f = filas[sel < 0 ? 0 : sel];
                  if (f)
                    onOv(f.areaId, {
                      slotsExtra: (f.aparatos.filter((a) => a.vacio).length || 0) + 1,
                    });
                }}
                style={{
                  display: 'inline-block',
                  marginLeft: 6,
                  border: '1px solid var(--line)',
                  borderRadius: 4,
                  background: 'var(--bg2)',
                  color: 'var(--txt2)',
                  fontSize: 11,
                  cursor: filas.length ? 'pointer' : 'default',
                }}
              >
                ＋
              </button>
            </th>
            <th style={THG} colSpan={3}>
              Verificación
            </th>
            <th style={THG} colSpan={4}>
              Solución
            </th>
            <th style={THG} colSpan={3}>
              Cálculo
            </th>
            <th style={THG} colSpan={2}>
              Rejillas sugeridas
            </th>
            <th rowSpan={2} style={TH}>
              Estado
            </th>
          </tr>
          <tr>
            <th style={THS} title="Nombre del sector (etiqueta del área dibujada)">
              Sector
            </th>
            <th style={THS} title="Área en planta del sector (m²) — del polígono dibujado">
              Área
            </th>
            <th style={THS} title="Altura libre del sector (m)">
              Alto
            </th>
            <th
              style={THS}
              title="Mono espacio: una sola planta, sin muros internos; ambientes divididos solo por muebles (Anexo B)"
            >
              Mono Espacio
            </th>
            {Array.from({ length: nCols }, (_, ci) => (
              <th
                key={ci}
                style={THS}
                title="Gasodoméstico asignado — desplegable con todo el catálogo de gas"
              >
                Aparato {ci + 1}
              </th>
            ))}
            <th style={THS} title="Suma de UN × P sin artefactos Tipo C (kW)">
              Total P
            </th>
            <th style={THS} title="Volumen requerido (m³) = 3,4 m³ por kW, sin Tipo C (num. 4.1.1)">
              Volumen Requerido
            </th>
            <th style={THS} title="Clasificación del recinto según su volumen (num. 4.1)">
              Chequeo Volumen / Clasificación del Recinto
            </th>
            <th style={THS} title="Estrategia de ventilación del sector (num. 4.1.2, 4.2, 4.3)">
              Tipo de Ventilación
            </th>
            <th
              style={THS}
              title="Volumen (m³) del espacio adjunto comunicado por aberturas interiores (solo Interior/Combinación)"
            >
              Volumen Recinto Adjunto m³
            </th>
            <th
              style={THS}
              title="Potencia (kW) de los gasodomésticos del espacio adjunto (sin Tipo C)"
            >
              Potencia Recinto Adjunto kW
            </th>
            <th
              style={THS}
              title="Suma de las áreas de sección de los conectores de evacuación en cm², π·D²/4 (solo Método 2)"
            >
              Área Conectores Evacuación cm²
            </th>
            <th style={THS} title="Solución que resulta del cálculo">
              Solución aplicada
            </th>
            <th style={THS} title="Área libre mínima por abertura en cm² (redondeo por arriba)">
              Área Libre Requerida por Abertura
            </th>
            <th style={THS} title="Coeficiente en cm²/kW según la solución aplicada">
              Coeficiente de Área
            </th>
            <th
              style={THS}
              title="Rejillas del catálogo sugeridas por área efectiva del fabricante: superior/única (método 1 o 2) e inferior (método 1)"
            >
              Rejillas Sugeridas
            </th>
            <th style={THS} title="Área efectiva instalada en cm²: la menor entre las aberturas">
              Área Efectiva Instalada
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 && (
            <tr>
              <td
                colSpan={21 + Math.max(nCols - 1, 0)}
                style={{
                  ...TD,
                  padding: 16,
                  fontSize: 13,
                  color: 'var(--txt2)',
                  whiteSpace: 'normal',
                }}
              >
                Sin sectores: dibuja en el visor un <strong>Área</strong> con la pestaña{' '}
                <strong>Gas</strong> activa (y la subred Rejillas de ventilación encendida en Redes
                activas), nómbrala y asígnale gasodomésticos desde el panel derecho.
              </td>
            </tr>
          )}
          {filas.map((f, i) => {
            const res = resultados[i];
            const [cl, ccol] = clasifRecinto(res);
            const insuficiente =
              !f.mono && res.estado !== 'vacio' && res.modo !== 'estanco' && res.V < res.Vreq;
            const usaAdj = insuficiente && (f.sol.startsWith('int') || f.sol.startsWith('comb'));
            const usaCon = insuficiente && f.sol === 'ext-m2' && gas !== 'glp';
            const hayAb = res.aberturas.length > 0;
            const sup = res.aberturas.find((a) => a.pos === 'sup' || a.pos === 'int');
            const inf = res.aberturas.find((a) => a.pos === 'inf');
            const ef = hayAb ? Math.min(...res.aberturas.map((a) => a.libreReal)) : null;
            const nE = res.alertas.filter((a) => a.e).length;
            const nW = res.alertas.length - nE;
            const est =
              res.estado === 'vacio'
                ? 'Sin datos'
                : nE
                  ? `${nE} crítica${nE > 1 ? 's' : ''}`
                  : nW
                    ? `Cumple · ${nW} obs.`
                    : 'Cumple';
            const estCol =
              res.estado === 'vacio' ? 'var(--txt3)' : nE ? '#E7786B' : nW ? '#E3A24F' : '#5DBB83';
            const rejLarga = (a: NonNullable<(typeof res.aberturas)[number]>) =>
              a.ref
                ? `${a.n > 1 ? `${a.n} × ` : ''}${a.ref.marca} ${a.ref.ref} — ${a.ref.ext} cm`
                : `Especial ${a.w} × ${a.h} cm (definir con fabricante)`;
            return (
              <tr
                key={f.key}
                onClick={() => onSelect(i)}
                style={{
                  cursor: 'pointer',
                  background: i === sel ? 'rgba(37,99,235,.08)' : undefined,
                }}
              >
                <td style={TD}>{i + 1}</td>
                <td style={TD}>
                  <input
                    aria-label={`Apto sector ${i + 1}`}
                    value={f.apto}
                    readOnly={!edit}
                    onChange={(e) => onOv(f.areaId, { apto: e.target.value })}
                    style={INP}
                  />
                </td>
                <td style={TD}>
                  <input
                    aria-label={`Piso sector ${i + 1}`}
                    value={f.piso}
                    readOnly={!edit}
                    onChange={(e) => onOv(f.areaId, { piso: e.target.value })}
                    style={INP}
                  />
                </td>
                <td style={{ ...TD, overflow: 'hidden' }}>
                  <input
                    aria-label={`Nombre del sector ${i + 1}`}
                    value={f.sector}
                    readOnly={!edit}
                    onChange={(e) => onOv(f.areaId, { sector: e.target.value })}
                    style={INP}
                  />
                </td>
                <td style={TD}>{num(f.areaM2, 2)}</td>
                <td style={TD}>
                  <input
                    aria-label={`Alto del sector ${i + 1}`}
                    type="number"
                    step="0.01"
                    value={f.altoM}
                    readOnly={!edit}
                    onChange={(e) =>
                      onOv(f.areaId, { altoM: Math.max(0, parseFloat(e.target.value) || 0) })
                    }
                    style={INP}
                  />
                </td>
                <td style={TD}>
                  <select
                    aria-label={`Mono espacio sector ${i + 1}`}
                    value={f.mono ? 'si' : 'no'}
                    onChange={(e) => onOv(f.areaId, { mono: e.target.value === 'si' })}
                    style={SEL}
                  >
                    <option value="no">No</option>
                    <option value="si">Sí</option>
                  </select>
                </td>
                {f.aparatos.map((ap, ci) => (
                  <td key={ci} style={{ ...TD, minWidth: 118, whiteSpace: 'normal' }}>
                    <div style={{ display: 'grid', gap: 2 }}>
                      <select
                        aria-label={`Gasodoméstico col ${ci + 1} sector ${i + 1}`}
                        value={ap.id}
                        disabled={!edit}
                        onChange={(e) => onAparatoCol(f, ci, e.target.value, onOv)}
                        style={{ ...SEL, background: 'var(--bg2)' }}
                      >
                        <option value="">— etc —</option>
                        {APARATOS_DEF.filter(
                          (a) =>
                            a.grupo === 'g' &&
                            // Sin opción fantasma: ids ya usados por OTRAS columnas de esta fila.
                            !f.aparatos.some((o) => o !== ap && o.id === a.id),
                        ).map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nombre}
                          </option>
                        ))}
                      </select>
                      <Sub k="UN">
                        <input
                          aria-label={`UN col ${ci + 1} sector ${i + 1}`}
                          type="number"
                          min="0"
                          value={ap.cant}
                          readOnly={!edit || ap.vacio}
                          onChange={(e) =>
                            setCantCol(f, ci, Math.max(0, parseInt(e.target.value) || 0))
                          }
                          style={INP}
                        />
                      </Sub>
                      <Sub k="P kW">
                        <input
                          aria-label={`P kW col ${ci + 1} sector ${i + 1}`}
                          type="number"
                          step="0.1"
                          value={ap.kw}
                          readOnly={!edit || ap.vacio}
                          onChange={(e) =>
                            onOv(f.areaId, {
                              kwById: {
                                ...(overrides[f.areaId]?.kwById || {}),
                                ...(ap.id
                                  ? { [ap.id]: Math.max(0, parseFloat(e.target.value) || 0) }
                                  : {}),
                              },
                            })
                          }
                          style={INP}
                        />
                      </Sub>
                      <Sub k="Tipo">
                        <select
                          aria-label={`Tipo col ${ci + 1} sector ${i + 1}`}
                          value={ap.tipo}
                          disabled={!edit || ap.vacio}
                          onChange={(e) =>
                            onOv(f.areaId, {
                              tipoById: {
                                ...(overrides[f.areaId]?.tipoById || {}),
                                ...(ap.id ? { [ap.id]: e.target.value as 'A' | 'B' | 'C' } : {}),
                              },
                            })
                          }
                          style={SEL}
                        >
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                        </select>
                      </Sub>
                      <button
                        type="button"
                        aria-label={`Eliminar la columna de aparato ${ci + 1}`}
                        title="− Eliminar esta columna (resta todo lo del aparato)"
                        disabled={!edit}
                        onClick={(e) => {
                          e.stopPropagation();
                          quitarColumna(f, ci, onOv);
                        }}
                        style={{
                          border: '1px solid var(--line)',
                          borderRadius: 4,
                          background: 'var(--bg2)',
                          color: edit ? '#E7786B' : 'var(--txt3)',
                          cursor: edit ? 'pointer' : 'default',
                          fontSize: 11,
                        }}
                      >
                        −
                      </button>
                    </div>
                  </td>
                ))}
                <td style={{ ...TD, fontWeight: 700 }}>{num(res.P)}</td>
                <td style={TD}>
                  {f.mono || res.modo === 'estanco' || res.estado === 'vacio'
                    ? 'N.A.'
                    : num(res.Vreq, 1)}
                </td>
                <td
                  style={{
                    ...TD,
                    fontSize: 11,
                    whiteSpace: 'normal',
                    color:
                      ccol === 'e'
                        ? '#E7786B'
                        : ccol === 'w'
                          ? '#E3A24F'
                          : ccol === 'ok'
                            ? '#5DBB83'
                            : undefined,
                  }}
                >
                  {cl}
                </td>
                <td style={{ ...TD, minWidth: 110 }}>
                  <select
                    aria-label={`Solución de ventilación del sector ${i + 1}`}
                    value={f.sol}
                    onChange={(e) => onOv(f.areaId, { sol: e.target.value })}
                    style={{ ...SEL, minWidth: 108, background: 'var(--bg2)' }}
                  >
                    {Object.entries(SOL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.t}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={TD}>
                  {usaAdj ? (
                    <input
                      aria-label={`Volumen recinto adjunto ${i + 1}`}
                      type="number"
                      step="0.1"
                      value={f.vadj}
                      readOnly={!edit}
                      onChange={(e) =>
                        onOv(f.areaId, { vadj: Math.max(0, parseFloat(e.target.value) || 0) })
                      }
                      style={INP}
                    />
                  ) : (
                    'N.A.'
                  )}
                </td>
                <td style={TD}>
                  {usaAdj ? (
                    <input
                      aria-label={`Potencia recinto adjunto ${i + 1}`}
                      type="number"
                      step="0.1"
                      value={f.padj}
                      readOnly={!edit}
                      onChange={(e) =>
                        onOv(f.areaId, { padj: Math.max(0, parseFloat(e.target.value) || 0) })
                      }
                      style={INP}
                    />
                  ) : (
                    'N.A.'
                  )}
                </td>
                <td style={TD}>
                  {usaCon ? (
                    <input
                      aria-label={`Área conectores ${i + 1}`}
                      type="number"
                      value={f.aconec}
                      readOnly={!edit}
                      onChange={(e) =>
                        onOv(f.areaId, { aconec: Math.max(0, parseFloat(e.target.value) || 0) })
                      }
                      style={INP}
                    />
                  ) : (
                    'N.A.'
                  )}
                </td>
                <td style={{ ...TD, fontSize: 11, whiteSpace: 'normal', maxWidth: 130 }}>
                  {solucionAplicada(res)}
                </td>
                <td style={TD}>{hayAb ? num(res.aberturas[0].libre, 0) : 'N.A.'}</td>
                <td style={TD}>{hayAb ? (res.coef ?? '—') : 'N.A.'}</td>
                <td style={{ ...TD, fontSize: 11, whiteSpace: 'normal', textAlign: 'left' }}>
                  <div
                    title={
                      sup
                        ? `REJILLA SUPERIOR/ÚNICA: área libre requerida ${num(sup.libre, 0)} cm². ${sup.ubic}. ${sup.ref ? `Ref. ${sup.ref.marca} ${sup.ref.ref} (${sup.ref.tipo}, área efectiva ${sup.n > 1 ? sup.n + ' × ' : ''}${sup.libreReal} cm²).` : 'Medida especial: definir con el fabricante.'}`
                        : 'Sin rejilla superior requerida.'
                    }
                  >
                    <b style={{ color: 'var(--txt2)' }}>Sup:</b>{' '}
                    {sup ? rejLarga(sup) : <span style={{ color: 'var(--txt3)' }}>N.A.</span>}
                  </div>
                  <div
                    title={
                      inf
                        ? `REJILLA INFERIOR: área libre requerida ${num(inf.libre, 0)} cm². ${inf.ubic}. ${inf.ref ? `Ref. ${inf.ref.marca} ${inf.ref.ref} (${inf.ref.tipo}, área efectiva ${inf.n > 1 ? inf.n + ' × ' : ''}${inf.libreReal} cm²).` : 'Medida especial: definir con el fabricante.'}`
                        : 'Sin rejilla inferior requerida.'
                    }
                  >
                    <b style={{ color: 'var(--txt2)' }}>Inf:</b>{' '}
                    {inf ? rejLarga(inf) : <span style={{ color: 'var(--txt3)' }}>N.A.</span>}
                  </div>
                </td>
                <td style={TD}>{ef !== null ? num(ef, 0) : 'N.A.'}</td>
                <td style={{ ...TD, color: estCol, fontWeight: 600, fontSize: 11 }}>{est}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Alertas del sector seleccionado + notas generales ───────────────────────
function AlertasResumen({
  filas,
  resultados,
  gas,
  hayM2,
  sel,
}: {
  filas: RejFila[];
  resultados: RejResultado[];
  gas: 'natural' | 'glp';
  hayM2: boolean;
  sel: number;
}) {
  const f = filas[sel];
  const res = resultados[sel];
  if (!f || !res) return null;
  return (
    <div style={{ marginTop: 10 }}>
      {res.estado === 'vacio'
        ? null
        : res.alertas.map((a, i) => (
            <div
              key={i}
              style={{
                fontSize: 12,
                padding: '5px 8px',
                borderTop: '1px solid var(--line)',
                color: a.e ? '#E7786B' : '#E3A24F',
              }}
            >
              {a.e ? 'Crítica' : 'Observación'}: {a.t}
            </div>
          ))}
      {gas === 'glp' && (
        <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 6 }}>
          GLP (gas más denso que el aire): solo Método 1; sin artefactos en sótanos (3.2, 4.2.1).
        </div>
      )}
      {hayM2 && (
        <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 6 }}>
          Método 2: separación de los artefactos ≥ 2,5 cm a lados y atrás y 16 cm al frente (4.2.2).
        </div>
      )}
    </div>
  );
}

// ── Detalle: memoria paso a paso (izq) + alzado del muro (der) ──────────────
function DetalleSector({ res }: { res: RejResultado | undefined }) {
  if (!res || res.estado === 'vacio') return null;
  const memoria = memoriaRecinto(res);
  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--txt2)',
          fontFamily: 'var(--mono)',
          marginBottom: 6,
        }}
      >
        Memoria del sector · {res.entrada.nombre}
      </div>
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          fontSize: 11,
          lineHeight: 1.5,
          background: 'var(--bg2)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          padding: 10,
          margin: 0,
          maxHeight: 320,
          overflow: 'auto',
          fontFamily: 'ui-monospace, Consolas, monospace',
        }}
      >
        {memoria}
      </pre>
    </div>
  );
}

/** Alzado del muro a escala real — port del alzado() del prototipo a SVG React. */
function AlzadoMuro({ res }: { res: RejResultado }) {
  const e = res.entrada;
  const vis = res.aberturas.filter((a) => a.pos !== 'int');
  const anchos = vis.map((a) => (a.n || 1) * a.w + ((a.n || 1) - 1) * 8);
  const L = Math.max(150, ...anchos.map((w) => w + 60));
  const H = Math.max(e.altoM, 2) * 100;
  const W = 360;
  const Hs = 250;
  const mL = 46;
  const mR = 16;
  const mT = 16;
  const mB = 30;
  const sc = Math.min((W - mL - mR) / L, (Hs - mT - mB) / H);
  const X = (x: number) => mL + x * sc;
  const Y = (y: number) => Hs - mB - y * sc;
  return (
    <svg
      viewBox={`0 0 ${W} ${Hs}`}
      role="img"
      aria-label="Alzado del muro con rejillas"
      style={{
        width: '100%',
        maxWidth: 520,
        display: 'block',
        background: 'var(--bg2)',
        border: '1px solid var(--line)',
        borderRadius: 6,
      }}
    >
      <rect
        x={X(0)}
        y={Y(H)}
        width={L * sc}
        height={H * sc}
        fill="var(--bg)"
        stroke="var(--line)"
        strokeWidth={3}
      />
      <line x1={X(0) - 8} x2={X(L) + 8} y1={Y(0)} y2={Y(0)} stroke="var(--txt)" strokeWidth={2} />
      {[
        [0, '0,00'],
        [30, '0,30'],
        [180, '1,80'],
        [H, 'Techo'],
      ].map(([y, t]) => (
        <g key={t as string}>
          <line
            x1={X(0) - 6}
            x2={X(0)}
            y1={Y(y as number)}
            y2={Y(y as number)}
            stroke="var(--txt3)"
          />
          <text
            x={X(0) - 9}
            y={(Y(y as number) ?? 0) + 4}
            textAnchor="end"
            fontSize={10}
            fill="var(--txt3)"
          >
            {t as string}
          </text>
        </g>
      ))}
      {[30, 180].map((y) => (
        <line
          key={y}
          x1={X(0)}
          x2={X(L)}
          y1={Y(y)}
          y2={Y(y)}
          stroke="var(--acc2)"
          strokeDasharray="4 4"
          opacity={0.6}
        />
      ))}
      {vis.map((a, k) => {
        const nU = a.n || 1;
        const tw = anchos[k];
        const y0 = a.pos === 'sup' ? (a.alt ? H - 5 - a.h : 180) : 4;
        const x00 = (L - tw) / 2;
        return (
          <g key={k}>
            {Array.from({ length: nU }, (_, u) => {
              const x0 = x00 + u * (a.w + 8);
              const nl = Math.max(2, Math.floor((a.h * sc) / 4));
              return (
                <g key={u}>
                  <rect
                    x={X(x0)}
                    y={Y(y0 + a.h)}
                    width={a.w * sc}
                    height={a.h * sc}
                    fill="rgba(37,99,235,.12)"
                    stroke="var(--acc2)"
                    strokeWidth={1.5}
                  />
                  {Array.from({ length: nl - 1 }, (_, q) => (
                    <line
                      key={q}
                      x1={X(x0) + 2}
                      x2={X(x0 + a.w) - 2}
                      y1={Y(y0) - (q + 1) * ((a.h * sc) / nl)}
                      y2={Y(y0) - (q + 1) * ((a.h * sc) / nl)}
                      stroke="var(--acc2)"
                      strokeWidth={0.8}
                    />
                  ))}
                </g>
              );
            })}
            <text
              x={X(L / 2)}
              y={Y(y0 + a.h) - 6}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill="var(--txt)"
            >
              {nU > 1 ? `${nU} × ` : ''}
              {a.ref ? `${a.ref.marca} ${a.ref.ext}` : `${a.w} × ${a.h} cm`}
            </text>
          </g>
        );
      })}
      {!vis.length && (
        <text x={X(L / 2)} y={Y(H / 2)} textAnchor="middle" fontSize={12} fill="var(--txt3)">
          {res.aberturas.length ? 'Abertura en puerta o piso' : 'Sin rejillas requeridas'}
        </text>
      )}
      <text x={X(L / 2)} y={Hs - 8} textAnchor="middle" fontSize={10} fill="var(--txt3)">
        Esquema · alturas y rejillas a escala
      </text>
    </svg>
  );
}

/** Página "Alzado de muro": desplegable de sector (apto · piso · sector) + esquema a escala. */
export const RejillasAlzadoPage = React.memo(function RejillasAlzadoPage() {
  const { filas, resultados } = useRejillasData();
  const [idx, setIdx] = useState(0);
  // Auto-selección: si el sector apuntado no tiene potencia, salta al primero que sí
  // (el desplegable no debe abrirse "vacío" cuando hay sectores calculables).
  const primeroConDatos = filas.findIndex((_, j) => resultados[j]?.estado !== 'vacio');
  const i = Math.min(Math.max(idx, 0), Math.max(filas.length - 1, 0));
  const efectivo = resultados[i]?.estado === 'vacio' && primeroConDatos >= 0 ? primeroConDatos : i;
  const res = filas.length ? resultados[efectivo] : undefined;
  return (
    <section className="card" aria-label="Alzado de muro · Rejillas de ventilación">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <img
          src="/iconos_civilflow/diseno_redes/gas/rejilla_ventilacion.webp"
          alt=""
          width={24}
          height={24}
          style={{ width: 24, height: 24, objectFit: 'contain' }}
          loading="lazy"
        />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--txt)' }}>
          Alzado de muro
        </h3>
        {filas.length > 0 && (
          <select
            value={efectivo}
            aria-label="Seleccionar sector para el alzado"
            onChange={(e) => setIdx(Number(e.target.value))}
            style={{
              marginLeft: 'auto',
              fontSize: 12,
              padding: '4px 8px',
              background: 'var(--bg3)',
              color: 'var(--txt)',
              border: '1px solid var(--line)',
              borderRadius: 4,
              maxWidth: 320,
            }}
          >
            {filas.map((f, j) => (
              <option key={f.key} value={j}>
                Apto {f.apto} · {f.piso} · {f.sector}
              </option>
            ))}
          </select>
        )}
      </div>
      <div style={{ padding: '12px' }}>
        {filas.length === 0 || !res ? (
          <div
            style={{ fontSize: 13, color: 'var(--txt2)', padding: '14px 0', textAlign: 'center' }}
          >
            Sin sectores: dibuja en el visor un <strong>Área</strong> con la pestaña{' '}
            <strong>Gas</strong> activa y la subred Rejillas de ventilación encendida.
          </div>
        ) : res.estado === 'vacio' ? (
          <div
            style={{ fontSize: 13, color: 'var(--txt2)', padding: '14px 0', textAlign: 'center' }}
          >
            Este sector no tiene gasodomésticos con potencia: sin aberturas que esquematizar.
          </div>
        ) : (
          <>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--txt2)',
                fontFamily: 'var(--mono)',
                marginBottom: 8,
              }}
            >
              Apto {filas[efectivo].apto} · {filas[efectivo].piso} · {filas[efectivo].sector}
            </div>
            <AlzadoMuro res={res} />
            {res.alertas.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {res.alertas.map((a, k) => (
                  <div
                    key={k}
                    style={{
                      fontSize: 12,
                      padding: '4px 8px',
                      borderTop: '1px solid var(--line)',
                      color: a.e ? '#E7786B' : '#E3A24F',
                    }}
                  >
                    {a.e ? 'Crítica' : 'Observación'}: {a.t}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
});

export default REJILLAS;
