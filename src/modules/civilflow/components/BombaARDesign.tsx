import React, { useState, useEffect, useRef } from 'react';
import { dec } from '../utils/parseDecimal';
import { loadFromStorage, saveToStorage, getActiveProyectoId } from '../services/storageService';
import { loadBombaDatos, saveBombaDatos } from '../services/bombaService';
import { matHazenC } from '../constants/engineeringDataMaterials';
import { equiposBombaDesdeTrazos } from '../utils/bombaAssociation';
import PageNav from './PageNav';
import { SI, TH, TD } from '../styles/sharedTableStyles';
import Tbl from './shared/Tbl';
import { APS_STORAGE_KEY } from '../constants/storage-keys';

// CÁLCULOS POR BOMBA (orig. usuario): cada bomba tiene SUS inputs y SUS resultados; las
// tablas son horizontales — filas = bombas, columnas = parámetros. Sin columnas
// Símbolo/Equivalencia/Fuente. Persistencia: cf_bomba_datos_proyecto.bombas (jsonb).

const Fmt2 = (v: string | number, u = '') => {
  if (v === '' || v === null || v === undefined)
    return <span style={{ color: 'var(--txt3)', fontSize: 12 }}>—</span>;
  const val = typeof v === 'number' ? v.toFixed(2) : v;
  return (
    <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
      {val}
      {u ? ` ${u}` : ''}
    </span>
  );
};

const SI2 = { ...SI, fontSize: 13, padding: '4px 6px' };
const TH2 = { ...TH, fontSize: 12 };
const TDBom: React.CSSProperties = { ...TD, background: '#1a1c20' };
const TD2 = { ...TDBom, fontSize: 13 };

/** Tarjeta de tabla con icono + título (mismo estilo que las otras pestañas de diseño). */
function Card({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r)',
        overflow: 'hidden',
        background: 'var(--bg)',
      }}
    >
      <div style={{ padding: '8px 8px', display: 'flex', alignItems: 'center' }}>
        <img
          src={icon}
          alt=""
          style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }}
        />
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--txt)' }}>{title}</h3>
      </div>
      <div style={{ padding: '0 2px 2px' }}>{children}</div>
    </div>
  );
}

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
  const li = dec(inp.lImp);
  const di = dec(inp.dImp);
  const ch = cHazenDe(inp.tipoTuberia);
  const fs = dec(inp.fSrv) || 1.25;
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
  const Vi = Qd > 0 && Dm > 0 ? +((Qd * 0.001) / (3.14159 * Math.pow(Dm / 2, 2))).toFixed(2) : 0;
  const Hf =
    Qb > 0 && li > 0 && Dm > 0
      ? +(
          (10.67 * li * Math.pow(Qb / 1000, 1.852)) /
          (Math.pow(ch, 1.852) * Math.pow(Dm, 4.87))
        ).toFixed(2)
      : 0;
  const Hac = +(Hf * 0.25).toFixed(2);
  const Hfri = +(Hf + Hac).toFixed(2);
  const Hest = +(li + Hfri).toFixed(2);
  const Hm = +(Hfri + Hest).toFixed(2);
  const Vch = Vi >= 0.6 && Vi <= 3.5 ? 'O.K.' : 'REVISAR DIÁMETRO';
  const Ph = Qb > 0 ? +((Qb * 1000 * 9.81 * Hm) / 1000).toFixed(2) : 0;
  const Peje = +(Ph / fs).toFixed(2);
  const Pcom = +(Peje * fs).toFixed(2);
  const php = Pcom / 746;
  const Sel =
    php <= 0.5 ? '0.5 HP' : php <= 1 ? '1 HP' : php <= 2 ? '2 HP' : php <= 3 ? '3 HP' : '≥ 5 HP';
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

  // Celda editable compacta (inputs siempre habilitados — sin modo EDITAR por página).
  const CellInp = ({
    code,
    k,
    aria,
    w = 84,
  }: {
    code: string;
    k: keyof BombaInputs;
    aria: string;
    w?: number;
  }) => (
    <input
      value={inpOf(code)[k]}
      aria-label={aria}
      onChange={(e) => setIn(code, k, e.target.value)}
      style={{ ...SI2, width: w }}
    />
  );
  const CellSel = ({ code, aria, w = 150 }: { code: string; aria: string; w?: number }) => (
    <select
      value={inpOf(code).tipoTuberia}
      aria-label={aria}
      onChange={(e) => setIn(code, 'tipoTuberia', e.target.value)}
      style={{ ...SI2, width: w }}
    >
      <option value="PVC-PR">PVC-PR</option>
      <option value="Acero galvanizado">Acero galvanizado</option>
      <option value="Acero al carbón">Acero al carbón</option>
    </select>
  );

  const sinBombas = rowsView.length === 0;
  const bombCell = (code: string) => (
    <span style={{ fontWeight: 700, fontFamily: 'var(--mono)' }}>{code}</span>
  );
  // ---- Página 1: Datos de entrada (transpuesta: filas = bombas) ----
  const page1 = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <Card
        icon="/iconos_civilflow/diseno_redes/general/datos_de_entrada.webp"
        title="Datos de entrada"
      >
        <Tbl
          thStyle={TH2}
          tdStyle={TD2}
          fontSize={13}
          cols={[
            'Bomba',
            'Nivel',
            'UD sótano',
            'Salidas simult.',
            'K',
            'Qd (lps)',
            'Qb (lps)',
            'Alt. geom. (m)',
            'Long. imp. (m)',
            'Diám. imp. (pulg)',
            'Tipo de tubería',
            'C HW',
            'P desc. (m.c.a.)',
            'η',
            'F. servicio',
          ]}
          rows={rowsView.map((r) => [
            bombCell(r.code),
            r.nivel,
            String(r.uds),
            <CellInp code={r.code} k="sal" aria="Salidas simultáneas" w={70} />,
            Fmt2(r.c.K),
            Fmt2(r.c.Qd),
            Fmt2(r.c.Qb),
            <CellInp code={r.code} k="hz" aria="Altura geométrica" w={70} />,
            <CellInp code={r.code} k="lImp" aria="Longitud impulsión" w={70} />,
            <CellInp code={r.code} k="dImp" aria="Diámetro impulsión" w={70} />,
            <CellSel code={r.code} aria="Tipo de tubería" />,
            String(cHazenDe(r.inp.tipoTuberia)),
            <CellInp code={r.code} k="pDesc" aria="Presión mínima descarga" w={70} />,
            <CellInp code={r.code} k="etaB" aria="Eficiencia bomba" w={60} />,
            <CellInp code={r.code} k="fSrv" aria="Factor de servicio" w={60} />,
          ])}
        />
      </Card>
      {sinBombas && (
        <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
          Sin bombas creadas. Crea una bomba desde el menú contextual de una caja en el visor.
        </div>
      )}
    </div>
  );

  // ---- Página 2: Pérdidas de carga (transpuesta) ----
  const page2 = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <Card
        icon="/iconos_civilflow/diseno_redes/equipos/perdidas_de_carga.webp"
        title="Cálculo de pérdidas de carga"
      >
        <Tbl
          thStyle={TH2}
          tdStyle={TD2}
          fontSize={13}
          cols={[
            'Bomba',
            'Nivel',
            'V imp (m/s)',
            'Hf (m.c.a.)',
            'H ac (m.c.a.)',
            'H fri (m.c.a.)',
            'H est (m.c.a.)',
            'Hm (m.c.a.)',
            'Chequeo V',
          ]}
          rows={rowsView.map((r) => [
            bombCell(r.code),
            r.nivel,
            Fmt2(r.c.Vi),
            Fmt2(r.c.Hf),
            Fmt2(r.c.Hac),
            Fmt2(r.c.Hfri),
            Fmt2(r.c.Hest),
            Fmt2(r.c.Hm),
            <span
              style={{
                color: r.c.Vch === 'O.K.' ? '#22c55e' : '#ef5350',
                fontWeight: 700,
                fontFamily: 'var(--mono)',
                fontSize: 13,
              }}
            >
              {r.c.Vch}
            </span>,
          ])}
        />
      </Card>
      {sinBombas && <div style={{ fontSize: 12, color: 'var(--txt3)' }}>Sin bombas creadas.</div>}
    </div>
  );

  // ---- Página 3: Bomba sumergible (transpuesta) ----
  const page3 = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <Card
        icon="/iconos_civilflow/diseno_redes/equipos/bomba_sumergible_trituradora.webp"
        title="Parámetros de diseño bomba sumergible"
      >
        <Tbl
          thStyle={TH2}
          tdStyle={TD2}
          fontSize={13}
          cols={['Bomba', 'Nivel', 'NPSH disp (m)']}
          rows={rowsView.map((r) => [
            bombCell(r.code),
            r.nivel,
            <CellInp code={r.code} k="npsh" aria="NPSH disponible" w={70} />,
          ])}
        />
      </Card>
      <Card
        icon="/iconos_civilflow/diseno_redes/equipos/especificacion_camara_trituradora.webp"
        title="Especificación — Bomba sumergible trituradora"
      >
        <Tbl
          thStyle={TH2}
          tdStyle={TD2}
          fontSize={13}
          cols={[
            'Bomba',
            'Nivel',
            'Qb (lps)',
            'Hm (m.c.a.)',
            'P hid (W)',
            'P eje (W)',
            'P com (W)',
            'Potencia (HP)',
            'Selección',
          ]}
          rows={rowsView.map((r) => [
            bombCell(r.code),
            r.nivel,
            Fmt2(r.c.Qb),
            Fmt2(r.c.Hm),
            Fmt2(r.c.Ph),
            Fmt2(r.c.Peje),
            Fmt2(r.c.Pcom),
            Fmt2(r.c.php, 'HP'),
            <span style={{ fontWeight: 700, fontFamily: 'var(--mono)' }}>{r.c.Sel}</span>,
          ])}
        />
      </Card>
      {sinBombas && <div style={{ fontSize: 12, color: 'var(--txt3)' }}>Sin bombas creadas.</div>}
    </div>
  );

  const page4 = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <Card
        icon="/iconos_civilflow/diseno_redes/equipos/camara_bombeo.webp"
        title="Parámetros de diseño cámara de bombeo"
      >
        <Tbl
          thStyle={TH2}
          tdStyle={TD2}
          fontSize={13}
          cols={[
            'Bomba',
            'Nivel',
            'T. ciclo (min)',
            'Tirante min (m)',
            'Tirante max (m)',
            'Ancho (m)',
            'Largo (m)',
          ]}
          rows={rowsView.map((r) => [
            bombCell(r.code),
            r.nivel,
            <CellInp code={r.code} k="tCic" aria="Tiempo ciclo" w={70} />,
            <CellInp code={r.code} k="hMin" aria="Tirante mínimo" w={70} />,
            <CellInp code={r.code} k="hMax" aria="Tirante máximo" w={70} />,
            <CellInp code={r.code} k="bCam" aria="Ancho cámara" w={70} />,
            <CellInp code={r.code} k="lCam" aria="Largo cámara" w={70} />,
          ])}
        />
      </Card>
      <Card
        icon="/iconos_civilflow/diseno_redes/equipos/especificacion_camara_bombeo.webp"
        title="Especificación — Cámara de bombeo"
      >
        <Tbl
          thStyle={TH2}
          tdStyle={TD2}
          fontSize={13}
          cols={['Bomba', 'Nivel', 'V útil (lts)', 'V geom (lts)', 'Chequeo']}
          rows={rowsView.map((r) => [
            bombCell(r.code),
            r.nivel,
            Fmt2(r.c.Vcam),
            Fmt2(r.c.Vgeo),
            <span
              style={{
                color: r.c.Vchk === 'O.K.' ? '#22c55e' : '#ef5350',
                fontWeight: 700,
                fontFamily: 'var(--mono)',
                fontSize: 13,
              }}
            >
              {r.c.Vchk}
            </span>,
          ])}
        />
        <div style={{ fontSize: 12, color: 'var(--txt3)', padding: '6px 8px' }}>
          Material: concreto impermeabilizado o polietileno PEAD. Accesorios obligatorios: rejilla
          aguas arriba + ventilación Ø2" + alarma de nivel alto.
        </div>
      </Card>
      {sinBombas && <div style={{ fontSize: 12, color: 'var(--txt3)' }}>Sin bombas creadas.</div>}
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
        labels={['Datos de entrada', 'Pérdidas de carga', 'Bomba sumergible', 'Cámara de bombeo']}
      />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            overflowY: 'auto',
            borderRadius: 'var(--r)',
            border: '1px solid var(--line)',
            padding: '0 10px',
            boxSizing: 'border-box',
          }}
        >
          {pages[bp - 1].c}
        </div>
      </div>
    </div>
  );
}

export default BombaARDesign;
