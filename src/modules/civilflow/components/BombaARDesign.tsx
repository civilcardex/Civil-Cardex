import { useState, useEffect, useRef } from 'react';
import { dec } from '../utils/parseDecimal';
import { loadFromStorage, saveToStorage, getActiveProyectoId } from '../services/storageService';
import { loadBombaDatos, saveBombaDatos } from '../services/bombaService';
import { matHazenC } from '../constants/engineeringDataMaterials';
import { equiposBombaDesdeTrazos } from '../utils/bombaAssociation';
import PageNav from './PageNav';
import EditButton from './shared/EditButton';
import { SI } from '../styles/sharedTableStyles';
import Tbl from './shared/Tbl';
import Card from './shared/Card';
import { APS_STORAGE_KEY } from '../constants/storage-keys';

// Diseño VERTICAL (orig. usuario): filas = parámetros, columnas Parámetro/Símbolo/Valor/
// Unidad/Equivalencia/Fuente (entrada) y Componente/Símbolo/Valor/Unidad/Equivalencia/
// Observación (cálculo). Los datos son POR BOMBA: un filtro arriba-izquierda elige la bomba
// (las reales del diseño vía equiposBombaDesdeTrazos) y todas las tablas muestran esa bomba.
// Persistencia: cf_bomba_datos_proyecto.bombas (jsonb, mapa por código) + espejo plano de la
// primera bomba para compat con informes.

const Fmt3 = (v: string | number, u = '') => {
  if (v === '' || v === null || v === undefined)
    return <span style={{ color: 'var(--txt3)', fontSize: 13 }}>—</span>;
  const val = typeof v === 'number' ? v.toFixed(3) : v;
  return (
    <span style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>
      {val}
      {u ? ` ${u}` : ''}
    </span>
  );
};

const Fmt2 = (v: string | number, u = '') => {
  if (v === '' || v === null || v === undefined)
    return <span style={{ color: 'var(--txt3)', fontSize: 13 }}>—</span>;
  const val = typeof v === 'number' ? v.toFixed(2) : v;
  return (
    <span style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>
      {val}
      {u ? ` ${u}` : ''}
    </span>
  );
};

// Mismos estilos que las tablas de Equipo de Presión (EPVerificationPage) — orig. usuario.
const TH_R = { fontSize: 12.5, padding: '3px 4px' };
const TD_R = { fontSize: 12.5, padding: '2px 4px' };
// Compacto: la columna Parámetro/Componente sin el ancho grande por defecto de Tbl.
const TDL_R = { minWidth: 0, fontSize: 13.5, fontWeight: 600 };
// Equivalencia/Fuente: columna de notas — texto que sí puede partir en varias líneas.
const NOTE_COL = { whiteSpace: 'normal' as const, minWidth: 130, fontSize: 12 };
// Bordes EXTERIORES en las celdas extremas (orig. usuario: al ras del contenido — el borde
// del elemento <table> quedaba separado de la grilla por el reparto de columnas).
const EDGE_L = { borderLeft: '1px solid var(--line)' };
const EDGE_R = { ...NOTE_COL, borderRight: '1px solid var(--line)' };
const COLS_IN = ['Parámetro', 'Símbolo', 'Valor', 'Unidad', 'Equivalencia', 'Fuente / norma'];
const COLS_OUT = ['Componente', 'Símbolo', 'Valor', 'Unidad', 'Equivalencia', 'Observación'];
const COL_STYLES = [EDGE_L, undefined, undefined, undefined, NOTE_COL, EDGE_R];

/** Valor equivalente REAL (orig. usuario): muestra `valor × factor + unidad` de la propia
 *  celda — p.ej. Qd 12 lps → "190.20 GPM". Sin valor → "—". */
const Eq = (raw: string | number | undefined, f: number, u: string) => {
  const v = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').replace(',', '.'));
  if (!v || !isFinite(v)) return '—';
  return `${(v * f).toFixed(2)} ${u}`;
};

/** Inputs editables por bomba. */
export interface BombaInputs {
  sal: string;
  hz: string;
  lImp: string;
  dImp: string;
  pDesc: string;
  etaB: string;
  fSrv: string;
  tCic: string;
  hMin: string;
  hMax: string;
  bCam: string;
  lCam: string;
  npsh: string;
  tipoTuberia: string;
}

const INPUTS_DEFAULT: BombaInputs = {
  sal: '',
  hz: '',
  lImp: '',
  dImp: '',
  pDesc: '',
  etaB: '',
  fSrv: '1.25',
  tCic: '',
  hMin: '',
  hMax: '',
  bCam: '',
  lCam: '',
  npsh: '',
  tipoTuberia: 'PVC-PR',
};

const MAT_POR_TIPO: Record<string, string> = {
  'PVC-PR': 'PVC-PR',
  'Acero galvanizado': 'Acero HG',
  'Acero al carbón': 'A.C.',
};

/** C de Hazen-Williams: Catálogo Maestro según tipo de tubería — solo lectura. */
function cHazenDe(tipoTuberia: string): number {
  return matHazenC(MAT_POR_TIPO[tipoTuberia] ?? 'PVC-PR') ?? 150;
}

/** Todos los cálculos de la bomba a partir de SUS inputs y SUS UDs (mismas fórmulas que la
 *  versión plana anterior). */
function calcsDe(inp: BombaInputs, uds: number) {
  const sal = dec(inp.sal);
  const hz = dec(inp.hz);
  const li = dec(inp.lImp);
  const di = dec(inp.dImp);
  const eta = dec(inp.etaB);
  const ch = cHazenDe(inp.tipoTuberia);
  const fs = dec(inp.fSrv) || 1.25;
  const pd = dec(inp.pDesc);
  const tc = dec(inp.tCic);
  const hmn = dec(inp.hMin);
  const hmx = dec(inp.hMax);
  const bc = dec(inp.bCam);
  const lc = dec(inp.lCam);
  const Dm = di * 0.0254;
  const ud = uds;

  const K = sal <= 1 ? 1 : +(1 / Math.sqrt(sal - 1)).toFixed(2);
  const Qd = +(
    K * (ud < 240 ? 0.1163 * Math.pow(ud, 0.6875) : 0.074 * Math.pow(ud, 0.7504))
  ).toFixed(2);
  const Qb = +(Qd * 1.25).toFixed(2);
  // V con Qd (caudal de diseño — metodología del Excel maestro, D27).
  const Vi = Qd > 0 && Dm > 0 ? +((Qd * 0.001) / (3.14159 * Math.pow(Dm / 2, 2))).toFixed(3) : 0;
  const Hf =
    Qb > 0 && li > 0 && Dm > 0
      ? +(
          (10.67 * li * Math.pow(Qb / 1000, 1.852)) /
          (Math.pow(ch, 1.852) * Math.pow(Dm, 4.87))
        ).toFixed(3)
      : 0;
  const Hac = +(Hf * 0.25).toFixed(3);
  const Hfri = +(Hf + Hac).toFixed(3);
  // Altura estática = Hz geométrica + presión mínima en descarga; Hm = fricción + estática.
  const Hest = +(hz + pd).toFixed(3);
  const Hm = +(Hfri + Hest).toFixed(3);
  const Vch = Vi >= 0.6 && Vi <= 3.5 ? 'O.K.' : 'REVISAR DIÁMETRO';
  const Ph = Qb > 0 ? +((Qb * 1000 * 9.81 * Hm) / 1000).toFixed(2) : 0;
  // η bomba: se LEE del campo "Eficiencia bomba η" (Datos de entrada) — sin default. P eje =
  // P hid / η. Tolerante a fracción (0.65) o porcentaje (65); ≤1 es fracción. Campo vacío ⇒
  // P eje/P com/HP/selección sin valor (—), nunca inventar η.
  const etaFrac = eta > 0 ? (eta <= 1 ? eta : eta / 100) : 0;
  const Peje: number | '' = etaFrac > 0 ? +(Ph / etaFrac).toFixed(2) : '';
  const Pcom: number | '' = Peje !== '' ? +(Peje * fs).toFixed(2) : '';
  const php: number | '' = Pcom !== '' ? +(Pcom / 746).toFixed(2) : '';
  const Sel: string =
    php === ''
      ? ''
      : php <= 0.5
        ? '0.5 HP'
        : php <= 1
          ? '1 HP'
          : php <= 2
            ? '2 HP'
            : php <= 3
              ? '3 HP'
              : '≥ 5 HP';
  const Vcam = Qb > 0 && tc > 0 ? +(Qb * tc * 60).toFixed(2) : 0;
  const Vgeo = bc > 0 && lc > 0 && hmx - hmn > 0 ? +(bc * lc * (hmx - hmn)).toFixed(2) : 0;
  const Vchk = Vgeo > 0 && Vcam > 0 ? (Vgeo >= Vcam / 1000 ? 'O.K.' : 'AMPLIAR CÁMARA') : '';
  return {
    K,
    Qd,
    Qb,
    Vi,
    Hf,
    Hac,
    Hfri,
    Hest,
    Hm,
    Vch,
    Ph,
    Peje,
    Pcom,
    php,
    Sel,
    Vcam,
    Vgeo,
    Vchk,
  };
}

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
    window.addEventListener('storage', bump);
    window.addEventListener('aparatos-clear', bump as EventListener);
    window.addEventListener('civilflow_san_sync_changed', bump as EventListener);
    window.addEventListener('civilflow_hidro_sync_changed', bump as EventListener);
    return () => {
      window.removeEventListener('storage', bump);
      window.removeEventListener('aparatos-clear', bump as EventListener);
      window.removeEventListener('civilflow_san_sync_changed', bump as EventListener);
      window.removeEventListener('civilflow_hidro_sync_changed', bump as EventListener);
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
      void saveBombaDatos(proyectoId, {
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
      });
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

  // ---- Página 1: Datos de entrada (vertical: filas = parámetros de LA bomba elegida) ----
  const page1 = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      {filtroBombas}
      {!sinBombas && sel && c && (
        <Card
          style={{ width: '50%', margin: '0 auto', alignSelf: 'center' }}
          iconImg="/iconos_civilflow/diseno_redes/general/datos_de_entrada.webp"
          iconImgStyle={{ width: 22, height: 22 }}
          title={`1. Datos de entrada — ${selCode}`}
          headerRight={<EditButton edit={edit} setEdit={setEdit} />}
        >
          <Tbl
            tableStyle={{ width: '100%' }}
            tdlStyle={TDL_R}
            thStyle={TH_R}
            tdStyle={TD_R}
            cols={COLS_IN}
            colStyles={COL_STYLES}
            rows={[
              [
                'Número de salidas simultáneas',
                'Sal sim',
                cellInp(selCode, 'sal', 'Salidas simultáneas'),
                '—',
                '—',
                'Método Hunter (NTC 1500)',
              ],
              [
                'Unidades de descarga acumuladas en sótano',
                'UD tot',
                Fmt2(sel.uds),
                'UD',
                '—',
                'Aparatos conectados a la bomba (trazos del diseño)',
              ],
              ['Coeficiente de simultaneidad', 'K', Fmt2(c.K), '—', '—', 'K = 1/√(n − 1)'],
              [
                'Caudal de diseño',
                'Q dis',
                Fmt2(c.Qd),
                'lps',
                Eq(c.Qd, 15.8503, 'GPM'),
                'Q = UD × K (Hunter)',
              ],
              [
                'Caudal de bombeo (reserva 25%)',
                'Q b',
                Fmt2(c.Qb),
                'lps',
                Eq(c.Qb, 15.8503, 'GPM'),
                'Qb = 1.25 × Qd',
              ],
              [
                'Altura geométrica',
                'Hz',
                cellInp(selCode, 'hz', 'Altura geométrica'),
                'm',
                Eq(sel.inp.hz, 3.28084, 'ft'),
                'Sótano → punto de descarga',
              ],
              [
                'Longitud total tubería de impulsión',
                'L imp',
                cellInp(selCode, 'lImp', 'Longitud impulsión'),
                'm',
                Eq(sel.inp.lImp, 3.28084, 'ft'),
                '—',
              ],
              [
                'Diámetro tubería de impulsión',
                'D imp',
                cellInp(selCode, 'dImp', 'Diámetro impulsión'),
                'pulg',
                Eq(sel.inp.dImp, 25.4, 'mm'),
                'Mínimo 2" (NTC 1500)',
              ],
              ['Tipo de tubería', '—', cellSel(selCode, 'Tipo de tubería'), '—', '—', 'Catálogo'],
              [
                'Coeficiente Hazen-Williams',
                'C HW',
                Fmt2(cHazenDe(sel.inp.tipoTuberia)),
                '—',
                '—',
                'Catálogo Maestro — no editable',
              ],
              [
                'Presión mínima en descarga',
                'P desc',
                cellInp(selCode, 'pDesc', 'Presión mínima descarga'),
                'm.c.a.',
                Eq(sel.inp.pDesc, 1.42233, 'psi'),
                '—',
              ],
              [
                'Eficiencia de bomba',
                'eta b',
                cellInp(selCode, 'etaB', 'Eficiencia bomba', 90),
                '%',
                '—',
                'Sumergible trituradora típica: 60–70%',
              ],
              [
                'Factor de servicio del motor',
                'f srv',
                cellInp(selCode, 'fSrv', 'Factor de servicio', 90),
                '—',
                '—',
                'NEMA MG-1: reserva 25% sobre P calculada',
              ],
            ]}
          />
        </Card>
      )}
      {sinBombasNote}
    </div>
  );

  // ---- Página 2: Pérdidas de carga (vertical, bomba elegida) ----
  const page2 = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      {!sinBombas && c && (
        <Card
          style={{ width: '50%', margin: '0 auto', alignSelf: 'center' }}
          iconImg="/iconos_civilflow/diseno_redes/equipos/perdidas_de_carga.webp"
          iconImgStyle={{ width: 22, height: 22 }}
          title={`2.Cálculo de pérdidas de carga — ${selCode}`}
        >
          <Tbl
            tableStyle={{ width: '100%' }}
            tdlStyle={TDL_R}
            thStyle={TH_R}
            tdStyle={TD_R}
            cols={COLS_OUT}
            colStyles={COL_STYLES}
            rows={[
              [
                'Velocidad en tubería de impulsión',
                'V imp',
                Fmt3(c.Vi),
                'm/s',
                '—',
                '0.6 < V < 3.5 m/s (residuales)',
              ],
              [
                'Pérdida por fricción',
                'Hf',
                Fmt3(c.Hf),
                'm.c.a.',
                '—',
                'Hazen-Williams: 10.67·L·Q^1.852 / (C^1.852·D^4.87)',
              ],
              ['Pérdida en accesorios', 'H ac', Fmt3(c.Hac), 'm.c.a.', '—', '25% de Hf'],
              ['Pérdida total por fricción', 'H fri', Fmt3(c.Hfri), 'm.c.a.', '—', 'Hf + H ac'],
              [
                'Altura estática total',
                'H est',
                Fmt3(c.Hest),
                'm.c.a.',
                Eq(c.Hest, 1.42233, 'psi'),
                'Hz + P desc',
              ],
              [
                'Altura manométrica total',
                'H m',
                Fmt3(c.Hm),
                'm.c.a.',
                Eq(c.Hm, 1.42233, 'psi'),
                'H fri + H est',
              ],
              [
                'Chequeo velocidad',
                'V chk',
                <span
                  style={{
                    color: c.Vch === 'O.K.' ? '#22c55e' : '#ef5350',
                    fontWeight: 700,
                    fontFamily: 'var(--mono)',
                    fontSize: 13,
                  }}
                >
                  {c.Vch}
                </span>,
                '—',
                '—',
                'O.K. si 0.6 ≤ V ≤ 3.5 m/s',
              ],
            ]}
          />
        </Card>
      )}
      {sinBombasNote}
    </div>
  );

  // ---- Página 3: Bomba sumergible (vertical, bomba elegida) ----
  const page3 = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      {!sinBombas && sel && c && (
        <>
          <Card
            style={{ width: '50%', margin: '0 auto', alignSelf: 'center' }}
            iconImg="/iconos_civilflow/diseno_redes/equipos/bomba_sumergible_trituradora.webp"
            iconImgStyle={{ width: 22, height: 22 }}
            title={`3.Parámetros de diseño bomba sumergible — ${selCode}`}
            headerRight={<EditButton edit={edit} setEdit={setEdit} />}
          >
            <Tbl
              tableStyle={{ width: '100%' }}
              tdlStyle={TDL_R}
              thStyle={TH_R}
              tdStyle={TD_R}
              cols={COLS_IN}
              colStyles={COL_STYLES}
              rows={[
                [
                  'NPSH disponible',
                  'NPSH',
                  cellInp(selCode, 'npsh', 'NPSH disponible'),
                  'm',
                  Eq(sel.inp.npsh, 3.28084, 'ft'),
                  'Bomba sumergible: no requiere cebado',
                ],
                ['Tipo de bomba', '—', 'Sumergible trituradora', '—', '—', 'NTC 1500'],
              ]}
            />
          </Card>
          <Card
            style={{ width: '50%', margin: '0 auto', alignSelf: 'center' }}
            iconImg="/iconos_civilflow/diseno_redes/equipos/especificacion_camara_trituradora.webp"
            iconImgStyle={{ width: 22, height: 22 }}
            title={`4.Especificación — Bomba sumergible trituradora — ${selCode}`}
          >
            <Tbl
              tableStyle={{ width: '100%' }}
              tdlStyle={TDL_R}
              thStyle={TH_R}
              tdStyle={TD_R}
              cols={COLS_OUT}
              colStyles={COL_STYLES}
              rows={[
                ['Caudal nominal', 'Q b', Fmt2(c.Qb), 'lps', Eq(c.Qb, 15.8503, 'GPM'), '—'],
                ['Altura manométrica', 'H m', Fmt2(c.Hm), 'm.c.a.', Eq(c.Hm, 1.42233, 'psi'), '—'],
                [
                  'Potencia hidráulica',
                  'P hid',
                  Fmt2(c.Ph),
                  'W',
                  Eq(c.Ph, 0.00134102, 'HP'),
                  'P = ρ·g·Q·H',
                ],
                [
                  'Potencia de eje',
                  'P eje',
                  Fmt2(c.Peje),
                  'W',
                  Eq(c.Peje, 0.00134102, 'HP'),
                  'P eje = P hid / η bomba',
                ],
                ['Potencia comercial', 'P com', Fmt2(c.Pcom), 'W', '—', 'P eje × f servicio'],
                ['Potencia motor', 'P', Fmt2(c.php, 'HP'), 'HP', '—', 'P com / 746'],
                [
                  'Selección comercial',
                  '—',
                  <span style={{ fontWeight: 700, fontFamily: 'var(--mono)' }}>{c.Sel}</span>,
                  '—',
                  '—',
                  'HP comercial siguiente',
                ],
              ]}
            />
          </Card>
        </>
      )}
      {sinBombasNote}
    </div>
  );

  // ---- Página 4: Cámara de bombeo (vertical, bomba elegida) ----
  const page4 = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      {!sinBombas && c && (
        <>
          <Card
            style={{ width: '50%', margin: '0 auto', alignSelf: 'center' }}
            iconImg="/iconos_civilflow/diseno_redes/equipos/camara_bombeo.webp"
            iconImgStyle={{ width: 22, height: 22 }}
            title={`5.Parámetros de diseño cámara de bombeo — ${selCode}`}
            headerRight={<EditButton edit={edit} setEdit={setEdit} />}
          >
            <Tbl
              tableStyle={{ width: '100%' }}
              tdlStyle={TDL_R}
              thStyle={TH_R}
              tdStyle={TD_R}
              cols={COLS_IN}
              colStyles={COL_STYLES}
              rows={[
                [
                  'Tiempo de ciclo',
                  't cic',
                  cellInp(selCode, 'tCic', 'Tiempo ciclo'),
                  'min',
                  '—',
                  'Mínimo 5 min entre arranques',
                ],
                [
                  'Tirante mínimo',
                  'h min',
                  cellInp(selCode, 'hMin', 'Tirante mínimo'),
                  'm',
                  Eq(sel.inp.hMin, 3.28084, 'ft'),
                  'Evita cavitación',
                ],
                [
                  'Tirante máximo',
                  'h max',
                  cellInp(selCode, 'hMax', 'Tirante máximo'),
                  'm',
                  Eq(sel.inp.hMax, 3.28084, 'ft'),
                  'Nivel de activación del flotador',
                ],
                [
                  'Ancho de cámara',
                  'b cam',
                  cellInp(selCode, 'bCam', 'Ancho cámara'),
                  'm',
                  Eq(sel.inp.bCam, 3.28084, 'ft'),
                  '—',
                ],
                [
                  'Largo de cámara',
                  'l cam',
                  cellInp(selCode, 'lCam', 'Largo cámara'),
                  'm',
                  Eq(sel.inp.lCam, 3.28084, 'ft'),
                  '—',
                ],
              ]}
            />
          </Card>
          <Card
            style={{ width: '50%', margin: '0 auto', alignSelf: 'center' }}
            iconImg="/iconos_civilflow/diseno_redes/equipos/especificacion_camara_bombeo.webp"
            iconImgStyle={{ width: 22, height: 22 }}
            title={`6.Especificación — Cámara de bombeo — ${selCode}`}
          >
            <Tbl
              tableStyle={{ width: '100%' }}
              tdlStyle={TDL_R}
              thStyle={TH_R}
              tdStyle={TD_R}
              cols={COLS_OUT}
              colStyles={COL_STYLES}
              rows={[
                [
                  'Volumen útil',
                  'V cam',
                  Fmt2(c.Vcam),
                  'lts',
                  Eq(c.Vcam, 0.001, 'm³'),
                  'V = Qb(lps) × t(min) × 60',
                ],
                [
                  'Volumen geométrico',
                  'V geo',
                  Fmt2(c.Vgeo),
                  'lts',
                  Eq(c.Vgeo, 0.001, 'm³'),
                  'b × l × (h max − h min)',
                ],
                [
                  'Chequeo',
                  '—',
                  <span
                    style={{
                      color: c.Vchk === 'O.K.' ? '#22c55e' : '#ef5350',
                      fontWeight: 700,
                      fontFamily: 'var(--mono)',
                      fontSize: 13,
                    }}
                  >
                    {c.Vchk}
                  </span>,
                  '—',
                  '—',
                  'V geom ≥ V útil',
                ],
              ]}
            />
            <div style={{ fontSize: 12, color: 'var(--txt3)', padding: '6px 8px' }}>
              Material: concreto impermeabilizado o polietileno PEAD. Accesorios obligatorios:
              rejilla aguas arriba + ventilación Ø2" + alarma de nivel alto.
            </div>
          </Card>
        </>
      )}
      {sinBombasNote}
    </div>
  );

  const pages = [
    {
      t: 'Datos de entrada',
      icon: '/iconos_civilflow/diseno_redes/general/datos_de_entrada.webp',
      c: page1,
    },
    {
      t: 'Cálculo de pérdidas de carga',
      icon: '/iconos_civilflow/diseno_redes/general/calculo_perdidas_de_carga.webp',
      c: page2,
    },
    {
      t: 'Bomba sumergible trituradora',
      icon: '/iconos_civilflow/diseno_redes/equipos/bomba_sumergible_trituradora.webp',
      c: page3,
    },
    {
      t: 'Cámara de bombeo (pozo húmedo)',
      icon: '/iconos_civilflow/diseno_redes/equipos/camara_bombeo.webp',
      c: page4,
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
