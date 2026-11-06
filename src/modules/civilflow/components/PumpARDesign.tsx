/**
 * Diseño de equipos bom (Bomba)/ep (Equipo de Presión) tipo AR: lee las bombas dibujadas en los trazos de TODOS los pisos, calcula Q (Caudal)/altura/potencia del sistema con Hazen-Williams y muestra las tablas de entrada y verificación (succión/impulsión, tanque, NPSSH).
 * Persiste por bomba (pumpService) y reacciona a los eventos de sincronización de aparatos/trazos.
 * Ej: 120 UD en el edificio -> calcsDe da Qd y Hm, y la tabla sugiere la HP comercial que las cubre.
 */
import { useState, useEffect, useRef } from 'react';
import { loadFromStorage, saveToStorage, getActiveProyectoId } from '../services/storageService.ts';
import { loadBombaDatos, saveBombaDatos } from '../services/pumpService.ts';
import { guardaConReintento } from '../../../utils/saveToCloud.ts';
import { equiposBombaDesdeTrazos } from '../utils/pumpAssociation';
import PageNav from './PageNav.tsx';
import { SI } from '../styles/sharedTableStyles.ts';
import { APS_STORAGE_KEY } from '../constants/storage-keys.ts';
import { calcsDe, INPUTS_DEFAULT, type BombaInputs } from './pumpARCalcs';
import {
  EV_APARATOS_CLEAR,
  EV_SAN_SYNC,
  EV_HIDRO_SYNC,
  EV_STORAGE,
} from '../utils/fixtureEvents.ts';
import {
  pageEntrada,
  pagePerdidas,
  pageBomba,
  pageCamara,
  type PumpPageCtx,
} from './pumpARPages.tsx';

// Diseño VERTICAL (orig. usuario): filas = parámetros, columnas Parámetro/Símbolo/Valor/
// Unidad/Equivalencia/Fuente (entrada) y Componente/Símbolo/Valor/Unidad/Equivalencia/
// Observación (cálculo). Los datos son POR BOMBA: un filtro arriba-izquierda elige la bomba
// (las reales del diseño vía equiposBombaDesdeTrazos) y todas las tablas muestran esa bomba.
// Persistencia: cf_bomba_datos_proyecto.bombas (jsonb, mapa por código) + espejo plano de la
// primera bomba para compat con informes.

function BombaARDesign() {
  const [bp, setBp] = useState(1);
  // Modo edición (mismo patrón EDITAR/LISTO de las otras tablas de diseño).
  const [edit, setEdit] = useState(false);
  const memoriaInit = loadFromStorage<{
    inputs?: Partial<Record<string, string>>;
    bombas?: Record<string, Partial<BombaInputs>>;
  } | null>('civilflow_memoria_bomba_data', null);

  // Inputs POR BOMBA (mapa código → valores). Semilla: snapshot de memoria por bomba; el
  // legado plano del caché (una bomba histórica) se aplica a la primera bomba real.
  const [bombInputs, setBombInputs] = useState<Record<string, BombaInputs>>(() => {
    const seed: Record<string, BombaInputs> = {};
    for (const [code, vals] of Object.entries(memoriaInit?.bombas ?? {}))
      seed[code] = { ...INPUTS_DEFAULT, ...vals } as BombaInputs;
    const flat = memoriaInit?.inputs ?? {};
    if (flat.salSim !== undefined) {
      seed['__legacy__'] = {
        sal: flat.salSim ?? '',
        hz: flat.hz ?? '',
        lImp: flat.lImp ?? '',
        dImp: flat.dImp ?? '',
        pDesc: flat.pDesc ?? '',
        etaB: flat.etaB ?? '',
        fSrv: flat.fSrv ?? '1.25',
        tCic: flat.tCic ?? '',
        hMin: flat.hMin ?? '',
        hMax: flat.hMax ?? '',
        bCam: flat.bCam ?? '',
        lCam: flat.lCam ?? '',
        npsh: flat.npsh ?? '',
        tipoTuberia: flat.tipoTuberia ?? 'PVC-PR',
      };
    }
    return seed;
  });

  // Bombas = elementos tipo 'bomba' de TODOS los pisos (trazos locales) + UDs desde trazos.
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    const bump = () => setRefreshTick((n) => n + 1);
    window.addEventListener(EV_STORAGE, bump);
    window.addEventListener(EV_APARATOS_CLEAR, bump as EventListener);
    window.addEventListener(EV_SAN_SYNC, bump as EventListener);
    window.addEventListener(EV_HIDRO_SYNC, bump as EventListener);
    return () => {
      window.removeEventListener(EV_STORAGE, bump);
      window.removeEventListener(EV_APARATOS_CLEAR, bump as EventListener);
      window.removeEventListener(EV_SAN_SYNC, bump as EventListener);
      window.removeEventListener(EV_HIDRO_SYNC, bump as EventListener);
    };
  }, []);
  void refreshTick;

  const udOverride = (() => {
    try {
      const arr = loadFromStorage<Array<{ id?: unknown; ud?: unknown }> | null>(
        APS_STORAGE_KEY,
        null,
      );
      if (!Array.isArray(arr)) return undefined;
      const m: Record<string, number> = {};
      for (const a of arr) {
        if (typeof a?.id === 'string' && typeof a?.ud === 'number') m[a.id] = a.ud;
      }
      return Object.keys(m).length ? m : undefined;
    } catch {
      return undefined;
    }
  })();
  const equipos = equiposBombaDesdeTrazos(udOverride);
  const setIn = (code: string, key: keyof BombaInputs, val: string) => {
    setBombInputs((prev) => ({
      ...prev,
      [code]: { ...INPUTS_DEFAULT, ...(prev[code] || {}), [key]: val },
    }));
  };
  const inpOf = (code: string): BombaInputs => ({
    ...INPUTS_DEFAULT,
    ...(bombInputs[code] || {}),
    // Legado sin código: la primera bomba hereda los valores viejos mientras no tenga propios.
    ...((bombInputs['__legacy__'] && !bombInputs[code]
      ? bombInputs['__legacy__']
      : {}) as Partial<BombaInputs>),
  });

  // Vista modelo: por bomba, inputs + cálculos.
  const rowsView = equipos.map((e) => {
    const inp = inpOf(e.code);
    return { ...e, inp, c: calcsDe(inp, e.uds) };
  });
  const first = rowsView[0];

  // FILTRO (orig. usuario): la bomba elegida en el desplegable; si se borró del diseño o
  // aún no hay selección, queda la primera. Todas las páginas muestran ESTA bomba.
  const [selBomba, setSelBomba] = useState('');
  const selCode = equipos.some((e) => e.code === selBomba) ? selBomba : equipos[0]?.code || '';
  const sel = rowsView.find((r) => r.code === selCode);

  // Legado plano del caché → primera bomba real (una sola vez). Ajuste en render-phase
  // (patrón oficial para estado derivado — un useEffect con setState disparaba cascadas).
  if (bombInputs['__legacy__'] && equipos.length > 0) {
    const code = equipos[0].code;
    const cur = bombInputs[code];
    if (!cur || !Object.values(cur).some((v) => v)) {
      const next = { ...bombInputs, [code]: { ...INPUTS_DEFAULT, ...bombInputs['__legacy__'] } };
      delete next['__legacy__'];
      setBombInputs(next);
    }
  }

  // Hidratar desde BD (bombas jsonb + legado plano → primera bomba sin inputs propios).
  const hydratedRef = useRef(false);
  useEffect(() => {
    const proyectoId = getActiveProyectoId();
    if (!proyectoId) return;
    let cancelled = false;
    void loadBombaDatos(proyectoId).then((d) => {
      if (cancelled) return;
      if (d) {
        setBombInputs((prev) => {
          const next: Record<string, BombaInputs> = { ...prev };
          for (const [code, vals] of Object.entries(d.bombas ?? {}))
            next[code] = { ...INPUTS_DEFAULT, ...vals } as BombaInputs;
          if (d.salSim !== undefined && d.salSim !== '') {
            const firstCode = equipos.map((e) => e.code)[0] || equipos.length.toString();
            const cur = next[firstCode];
            if (!cur || !Object.values(cur).some((v) => v))
              next[firstCode] = {
                sal: d.salSim,
                hz: d.hz,
                lImp: d.lImp,
                dImp: d.dImp,
                pDesc: d.pDesc,
                etaB: d.etaB,
                fSrv: d.fSrv || '1.25',
                tCic: d.tCic,
                hMin: d.hMin,
                hMax: d.hMax,
                bCam: d.bCam,
                lCam: d.lCam,
                npsh: d.npsh,
                tipoTuberia: d.tipoTuberia || 'PVC-PR',
              };
          }
          return next;
        });
      }
      hydratedRef.current = true;
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistencia debounced a BD: bombas jsonb + legado plano de la PRIMERA bomba.
  const bombaSaveTimerRef = useRef<number | null>(null);
  const viewKey = rowsView.map((r) => `${r.code}:${r.uds}`).join('|');
  useEffect(() => {
    if (!hydratedRef.current) return;
    const proyectoId = getActiveProyectoId();
    if (!proyectoId) return;
    if (bombaSaveTimerRef.current) window.clearTimeout(bombaSaveTimerRef.current);
    bombaSaveTimerRef.current = window.setTimeout(() => {
      bombaSaveTimerRef.current = null;
      const f = first;
      void guardaConReintento('bomba', () =>
        saveBombaDatos(proyectoId, {
          salSim: f ? f.inp.sal : '',
          udTot: f ? String(f.uds) : '0',
          hz: f ? f.inp.hz : '',
          lImp: f ? f.inp.lImp : '',
          dImp: f ? f.inp.dImp : '',
          cHW: '',
          pDesc: f ? f.inp.pDesc : '',
          etaB: f ? f.inp.etaB : '',
          fSrv: f ? f.inp.fSrv : '1.25',
          tCic: f ? f.inp.tCic : '',
          hMin: f ? f.inp.hMin : '',
          hMax: f ? f.inp.hMax : '',
          bCam: f ? f.inp.bCam : '',
          lCam: f ? f.inp.lCam : '',
          npsh: f ? f.inp.npsh : '',
          tipoTuberia: f ? f.inp.tipoTuberia : 'PVC-PR',
          bombas: bombInputs as unknown as Record<string, Record<string, string>>,
        }),
      );
    }, 1200);
    return () => {
      if (bombaSaveTimerRef.current) window.clearTimeout(bombaSaveTimerRef.current);
      bombaSaveTimerRef.current = null;
    };
  }, [bombInputs, viewKey, hydratedRef, first]);

  // Snapshot de memoria (compat con informes): primera bomba plana + mapa por bomba.
  useEffect(() => {
    const f = first;
    saveToStorage('civilflow_memoria_bomba_data', {
      inputs: f
        ? {
            salSim: f.inp.sal,
            udTot: String(f.uds),
            hz: f.inp.hz,
            lImp: f.inp.lImp,
            dImp: f.inp.dImp,
            pDesc: f.inp.pDesc,
            etaB: f.inp.etaB,
            fSrv: f.inp.fSrv,
            tCic: f.inp.tCic,
            hMin: f.inp.hMin,
            hMax: f.inp.hMax,
            bCam: f.inp.bCam,
            lCam: f.inp.lCam,
            npsh: f.inp.npsh,
            tipoTuberia: f.inp.tipoTuberia,
          }
        : {},
      bombas: bombInputs,
    });
  }, [bombInputs, viewKey, first]);

  // Funciones de render (NO componentes: react-hooks/static-components) — celda editable
  // compacta, gated por el botón EDITAR/LISTO (mismo patrón que las demás tablas).
  const cellInp = (code: string, k: keyof BombaInputs, aria: string, w = 110) => (
    <input
      value={inpOf(code)[k]}
      aria-label={aria}
      disabled={!edit}
      onChange={(e) => setIn(code, k, e.target.value)}
      style={{ ...SI, width: w, opacity: edit ? 1 : 0.6 }}
    />
  );
  const cellSel = (code: string, aria: string, w = 160) => (
    <select
      value={inpOf(code).tipoTuberia}
      aria-label={aria}
      disabled={!edit}
      onChange={(e) => setIn(code, 'tipoTuberia', e.target.value)}
      style={{ ...SI, width: w, opacity: edit ? 1 : 0.6 }}
    >
      <option value="PVC-PR">PVC-PR</option>
      <option value="Acero galvanizado">Acero galvanizado</option>
      <option value="Acero al carbón">Acero al carbón</option>
    </select>
  );

  const sinBombas = rowsView.length === 0;
  const c = sel?.c;

  // Desplegable de selección de bomba (página 1, arriba a la izquierda) — solo con bombas.
  const filtroBombas = !sinBombas && (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 700 }}>Bomba seleccionada:</span>
      <select
        value={selCode}
        onChange={(e) => setSelBomba(e.target.value)}
        aria-label="Bomba seleccionada"
        style={{ ...SI, width: 170 }}
      >
        {equipos.map((e) => (
          <option key={e.code} value={e.code}>
            {e.code}
          </option>
        ))}
      </select>
    </div>
  );
  const sinBombasNote = sinBombas && (
    <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
      Sin bombas creadas. Crea una bomba desde el menú contextual de una caja en el visor.
    </div>
  );

  // El ctx de las páginas (pumpARPages.tsx): la bomba elegida + handlers de edición. Se
  // evalúan las 4 en cada render (igual que antes, JSX sin montar) y la activa se muestra.
  const pagesCtx: PumpPageCtx = {
    filtroBombas,
    sinBombas,
    sel,
    c,
    selCode,
    edit,
    setEdit,
    cellInp,
    cellSel,
    sinBombasNote,
  };
  const pages = [
    {
      t: 'Datos de entrada',
      icon: '/iconos_civilflow/diseno_redes/general/datos_de_entrada.webp',
      c: pageEntrada(pagesCtx),
    },
    {
      t: 'Cálculo de pérdidas de carga',
      icon: '/iconos_civilflow/diseno_redes/general/calculo_perdidas_de_carga.webp',
      c: pagePerdidas(pagesCtx),
    },
    {
      t: 'Bomba sumergible trituradora',
      icon: '/iconos_civilflow/diseno_redes/equipos/bomba_sumergible_trituradora.webp',
      c: pageBomba(pagesCtx),
    },
    {
      t: 'Cámara de bombeo (pozo húmedo)',
      icon: '/iconos_civilflow/diseno_redes/equipos/camara_bombeo.webp',
      c: pageCamara(pagesCtx),
    },
  ];

  return (
    <div
      className="fu"
      style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}
    >
      <PageNav
        page={bp}
        setPage={setBp}
        total={4}
        color="var(--bom)"
        labels={[
          '1. Datos de entrada',
          '2. Pérdidas de carga',
          '3.Bomba sumergible trituradora',
          '4.Cámara de bombeo',
        ]}
      />
      {/* Contenedor plano como EP (sin marco extra: las Cards ya traen su borde) */}
      <div style={{ flex: 1, padding: 6, overflowY: 'auto', overflowX: 'hidden', display: 'flex' }}>
        {pages[bp - 1].c}
      </div>
    </div>
  );
}

export default BombaARDesign;
