import React, { useState, useMemo, useEffect, useRef } from 'react';
import EditButton from './shared/EditButton';
import { useStickyThead2Offset } from './shared/useStickyThead2Offset';
import { LE_K, pisoCorto, GAS_DN_LABELS } from '../constants';
import { GAS, CAT_GAS } from '../constants/engineeringDataGas';
import { fmt } from '../utils/formatUtils';
import { CONTADORES as CONTADORES_CAT } from '../pages/catalog/catalogData';
import { usePlans } from '../context/PlansContext';
import { useProyecto } from '../context/ProjectContext';
import {
  writeDiametroToDrawing,
  writeMaterialToDrawing,
  clearDiametroToDrawing,
  writeContadorDiamToDrawing,
  writeBajantePropToDrawing,
} from '../utils/writeDiameterToDrawing';
import { loadFromStorage, saveToStorage, getActiveProyectoId } from '../services/storageService';
import { loadGasDatos, saveGasDatos } from '../services/projectDataService';
import GasCalcUC from './GasCalcUC';
import type { DrawingData, RawElement } from '../utils/drawingSync';

import {
  TRAZOS_PREFIX,
  GAS_ACC_KEY,
  APARATOS_BY_TRAMO_KEY,
  GAS_DATOS_KEY,
} from '../constants/storage-keys';
import { renouardByType, factoresGas, qDisenoGas } from '../utils/gasUtils';
import { mapaPadresGas, acumuladosGas, claveGas } from '../utils/gasNetwork';
import { compareTramosPisoDesc } from '../utils/componentHelpers';
import { gasTxt } from '../constants/normasPais';
import { GAS_DATOS_DEFAULT, lookupDn } from '../utils/gasRows';
import { avisarDiametroInvalido } from '../utils/diametroValidation';

type GasAccMap = Record<string, Record<string, number>>;
interface GasRamalRaw extends RawElement {
  Lh?: number;
}
interface GasBajanteRaw extends RawElement {
  capacidad?: string;
}
import { SI, SD, TH as _TH, TD as _TD } from '../styles/sharedTableStyles';
const TH = { ..._TH, fontSize: 10.5, padding: '2px 3px' };
const TD = { ..._TD, fontSize: 10.5, padding: '1px 2px' };

const ALL_DN: { mat: string; K: number; dn: string; d: number }[] = [];
const SR_ONLY = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;
const EMPTY_ROW = {
  padding: '24px 0',
  textAlign: 'center',
  color: 'var(--txt3)',
  fontSize: 10.5,
  border: 'none',
} as const;
GAS.forEach((g) => {
  g.rows.forEach((r) => {
    ALL_DN.push({ mat: g.mat, K: g.K, dn: r.dn, d: r.d });
  });
});
const ACC_KEYS = [
  'codos_90_std',
  'codos_90_std_sube',
  'codos_90_std_baja',
  'codos_90_rl',
  'codos_90_rl_sube',
  'codos_90_rl_baja',
  'te_linea',
  'te_ramal',
  'teeTapon',
  'valvula_bola',
];
// Columnas MOSTRADAS en la tabla (ped. usuario): las variantes sube/baja y el tapón
// cuentan en Le pero no aparecen como columnas.
const ACC_COLS = ['codos_90_std', 'codos_90_rl', 'te_linea', 'te_ramal', 'valvula_bola'];
// Notas descriptivas por columna del diseño de gas (tooltip en el encabezado). Material y
// diámetro son columnas separadas con desplegables propios (orig. usuario).
const GasDesign_TIPS = [
  'Tramo de la red de gas según el dibujo.',
  'Punto de inicio del tramo.',
  'Punto donde termina el tramo.',
  'Material de la tubería: define el diámetro interior y el coeficiente K. Se escribe al dibujo.',
  'Diámetro nominal del tramo según el material elegido (validado con accesorios y tramos conectados).',
  'Diámetro interior del tubo (mm), según material y diámetro.',
  'Coeficiente K del material para el cálculo.',
  'Longitud desarrollada del tramo (m).',
];

const GasDesign_COLS = [
  'Tramo',
  'Inicio',
  'Fin',
  'Material',
  'Diámetro',
  'Diámetro\ninterno',
  'Coeficiente\nK',
  'Longitud',
];

/** Los writes al trazo esperan la clave canónica "id-planId" (parten por '-', igual que
 *  writeDiametroToDrawing); la tabla usa "planId:id" (tramoKey) como clave de estado.
 *  Sin conversión, writeMaterial/writeDiametro/clear no hallan el ramal: no-op silencioso. */
function writeKeyDe(tramoId: string): string {
  const i = tramoId.indexOf(':');
  return i > 0 ? `${tramoId.slice(i + 1)}-${tramoId.slice(0, i)}` : tramoId;
}

function GasDesign({ pagina = 1 }: { pagina?: number }) {
  const [edit, setEdit] = useState(false);
  const tablaRef = useStickyThead2Offset();
  const datosGeneralesInit = loadFromStorage(GAS_DATOS_KEY, GAS_DATOS_DEFAULT);
  const [alt, setAlt] = useState(datosGeneralesInit.alt);
  // Presión atmosférica CALCULADA desde la altitud (Excel F11: 101.325*(1-alt/44330)^5.256,
  // 2 decimales) — no es un campo editable.
  const patm = useMemo(
    () => String(Math.round(101.325 * Math.pow(1 - (Number(alt) || 0) / 44330, 5.256) * 100) / 100),
    [alt],
  );
  const [temp, setTemp] = useState(datosGeneralesInit.temp);
  const [pmin, setPmin] = useState(datosGeneralesInit.pmin);
  const [densRel, setDensRel] = useState(datosGeneralesInit.densRel);
  const { plans } = usePlans();
  const { proy } = useProyecto();

  useEffect(() => {
    saveToStorage(GAS_DATOS_KEY, { alt, patm, temp, pmin, densRel });
  }, [alt, patm, temp, pmin, densRel]);

  // Hidratar desde la fuente de verdad (gas_datos_proyecto, 1:1 con el proyecto) al montar —
  // gana sobre el caché de localStorage; si no hay fila, se usan los defaults de la caché.
  useEffect(() => {
    const proyectoId = getActiveProyectoId();
    if (!proyectoId) return;
    let cancelled = false;
    void loadGasDatos(proyectoId).then((d) => {
      if (cancelled || !d) return;
      setAlt(d.alt);
      setTemp(d.temp);
      setPmin(d.pmin);
      setDensRel(d.densRel);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persistir a la BD debounced (600 ms) — localStorage sigue siendo la caché en vivo que
  // leen los cálculos (gasRows.ts) durante la sesión.
  const gasSaveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    const proyectoId = getActiveProyectoId();
    if (!proyectoId) return;
    if (gasSaveTimerRef.current) window.clearTimeout(gasSaveTimerRef.current);
    gasSaveTimerRef.current = window.setTimeout(() => {
      gasSaveTimerRef.current = null;
      void saveGasDatos(proyectoId, { alt, patm, temp, pmin, densRel });
    }, 600);
    return () => {
      if (gasSaveTimerRef.current) window.clearTimeout(gasSaveTimerRef.current);
      gasSaveTimerRef.current = null;
    };
  }, [alt, patm, temp, pmin, densRel]);

  const [gasRefreshKey] = useState(0);
  const [diamMat, setDiamMat] = useState<Record<string, string>>(() => ({}));
  const [diamDn, setDiamDn] = useState<Record<string, string>>(() => ({}));
  const [diamInt, setDiamInt] = useState<Record<string, number>>(() => ({}));
  const [diamK, setDiamK] = useState<Record<string, number>>(() => ({}));

  const [gasAcc, setGasAcc] = useState<GasAccMap>(() => {
    return loadFromStorage(GAS_ACC_KEY, {});
  });

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
        // se ignora: datos de trazado ausentes o corruptos; el recálculo sigue con lo demás.
      }
    }
    // Depura gasAcc contra los datos de plano que vienen de localStorage (una fuente externa que
    // React no puede observar de forma reactiva) — este es el uso legítimo de un efecto para
    // "sincronizar con un sistema externo", no un estado derivado de props/state ya disponibles
    // durante el renderizado.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Clave compuesta por plano: los ids de ramal se REPITEN entre pisos (RS1 en P1 y P2 son
  // tramos distintos) — indexar diámetros/resultados solo por id hacía colisiones entre pisos
  // y claves React duplicadas.
  const tramoKey = (t: { planId: string | number; id: string }): string => `${t.planId}:${t.id}`;

  const gasTramos = useMemo(() => {
    const tramos = [];
    for (const plano of plans) {
      if (!plano || plano.status !== 'confirmed' || plano.nivel == null) continue;
      const data = loadFromStorage<DrawingData | null>(TRAZOS_PREFIX + plano.id, null);
      if (!data) continue;
      for (const r of (data.ramales || []) as GasRamalRaw[]) {
        if (r.net !== 'gas') continue;
        if (r.tipo === 'tributario') continue;

        tramos.push({
          id: r.id,
          planId: plano.id,
          piso: Number(r.piso ?? plano.nivel) || 0,
          ini: r.ini || '',
          fin: r.fin || '',
          longitud: r.totalL || r.Lh || 0,
          tipo: r.tipo,
          pts: r.pts || [],
          _tribReversed: r._tribReversed,
        });
      }
    }
    return tramos.sort(compareTramosPisoDesc);
  }, [plans]);

  const gasContBajantes = useMemo(() => {
    const items: (GasBajanteRaw & { planId: string | number })[] = [];
    for (const plano of plans) {
      if (!plano || plano.status !== 'confirmed') continue;
      const data = loadFromStorage<DrawingData | null>(TRAZOS_PREFIX + plano.id, null);
      if (!data) continue;
      for (const b of (data.bajantes || []) as GasBajanteRaw[]) {
        if (b.net !== 'gas') continue;
        if (b.tipo === 'contador' || b.tipo === 'calentador') {
          items.push({ ...b, planId: plano.id });
        }
      }
    }
    return items;
  }, [plans]);

  useEffect(() => {
    const toSetMat: Record<string, string> = {};
    const toSetDn: Record<string, string> = {};
    const toSetInt: Record<string, number> = {};
    const toSetK: Record<string, number> = {};
    for (const plano of plans) {
      if (!plano || plano.status !== 'confirmed' || plano.nivel == null) continue;
      const data = loadFromStorage<DrawingData | null>(TRAZOS_PREFIX + plano.id, null);
      if (!data) continue;
      for (const r of data.ramales || []) {
        if (r.net !== 'gas') continue;
        if (r.tipo === 'tributario') continue;
        const mat = r.material || '';
        const dn = r.diametro || '';
        const opt = lookupDn(mat, dn);
        if (opt) {
          const tk = `${plano.id}:${r.id}`;
          toSetMat[tk] = mat;
          toSetDn[tk] = opt.dn;
          toSetInt[tk] = opt.d;
          toSetK[tk] = opt.K;
        }
      }
    }
    // Misma lógica de sincronización externa que gasAcc arriba.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDiamMat((prev) => {
      let n = prev;
      for (const [id, v] of Object.entries(toSetMat)) if (!(id in prev)) n = { ...n, [id]: v };
      return n;
    });
    setDiamDn((prev) => {
      let n = prev;
      for (const [id, v] of Object.entries(toSetDn)) if (!(id in prev)) n = { ...n, [id]: v };
      return n;
    });
    setDiamInt((prev) => {
      let n = prev;
      for (const [id, v] of Object.entries(toSetInt)) if (!(id in prev)) n = { ...n, [id]: v };
      return n;
    });
    setDiamK((prev) => {
      let n = prev;
      for (const [id, v] of Object.entries(toSetK)) if (!(id in prev)) n = { ...n, [id]: v };
      return n;
    });
  }, [plans, gasRefreshKey]);

  const handleDiamChange = (tramoId: string, mat: string, dn: string) => {
    const opt = lookupDn(mat, dn);
    if (opt) {
      const res = writeDiametroToDrawing(writeKeyDe(tramoId), 'gas', dn, plans);
      if (!res.ok && res.reason === 'accessory-larger') {
        if (
          avisarDiametroInvalido(
            `El diámetro del ramal no puede ser menor al del accesorio conectado en el extremo ${res.accessoryEnd} (${res.accessoryDiam}). Reduce el diámetro del accesorio o selecciona un ramal mayor.`,
          )
        )
          return;
      }
      if (!res.ok && (res as unknown as { reason?: string }).reason === 'parent-smaller') {
        if (
          avisarDiametroInvalido(
            `El diámetro de salida no puede ser mayor que el de entrada (${(res as unknown as { parentDiam?: string }).parentDiam}). Selecciona un diámetro menor o igual al del tramo aguas arriba.`,
          )
        )
          return;
      }
      if (!res.ok && (res as unknown as { reason?: string }).reason === 'child-larger') {
        if (
          avisarDiametroInvalido(
            `El diámetro de entrada no puede ser menor que el de salida (${(res as unknown as { parentDiam?: string }).parentDiam}) ya asignado aguas abajo. Selecciona un diámetro mayor o reduce primero la salida.`,
          )
        )
          return;
      }
    }
    setDiamMat((prev) => ({ ...prev, [tramoId]: mat }));
    setDiamDn((prev) => ({ ...prev, [tramoId]: dn }));
    setDiamInt((prev) => ({ ...prev, [tramoId]: opt ? opt.d : 0 }));
    setDiamK((prev) => ({ ...prev, [tramoId]: opt ? opt.K : 0 }));
  };

  /** Cambio SOLO de material: persiste y, si el diámetro actual no existe en el nuevo
   *  material, limpia el trazo (clearDiametroToDrawing) y el estado — el usuario
   *  re-selecciona en el desplegable de diámetro. */
  const handleMatChange = (tramoId: string, mat: string) => {
    writeMaterialToDrawing(writeKeyDe(tramoId), 'gas', mat, plans);
    setDiamMat((prev) => ({ ...prev, [tramoId]: mat }));
    const dn = diamDn[tramoId] || '';
    if (dn && !lookupDn(mat, dn)) {
      clearDiametroToDrawing(writeKeyDe(tramoId), 'gas', plans);
      handleDiamChange(tramoId, mat, '');
    }
  };

  const getAcc = (tramoId: string) => (gasAcc[tramoId] || {}) as Record<string, number>;

  const checkRows = useMemo(() => {
    const pMin = Number(pmin) || 17;
    const { pAtm, DR, fAlt, fTemp, fDens } = factoresGas({ patm, temp, densRel });
    const aparatos: Record<string, Record<string, number>> = loadFromStorage(
      APARATOS_BY_TRAMO_KEY,
      {},
    );
    // Árbol de red + aparatos acumulados (docx flujo de nudos): el tronco lleva la
    // demanda de toda su red descendente; presión y ΔP acumulada POR RAMA.
    const tramosNeto = gasTramos.map((t) => ({
      id: t.id,
      planId: t.planId,
      pts: t.pts,
      _tribReversed: t._tribReversed,
    }));
    const esTribDe = new Map<string, boolean>(
      gasTramos.map((t) => [claveGas(t.planId, t.id), t.tipo === 'tributario'] as const),
    );
    const padres = mapaPadresGas(
      tramosNeto,
      (t) => esTribDe.get(claveGas(t.planId, t.id)) === true,
    );
    const prof = new Map<string, number>();
    const depth = (k: string, g = 0): number => {
      if (prof.has(k)) return prof.get(k)!;
      if (g > gasTramos.length) return 0;
      const pa = padres.get(k);
      const d = pa ? depth(pa, g + 1) + 1 : 0;
      prof.set(k, d);
      return d;
    };
    for (const t of gasTramos) depth(claveGas(t.planId, t.id));
    const orden = [...gasTramos].sort(
      (a, b) =>
        (prof.get(claveGas(a.planId, a.id)) ?? 0) - (prof.get(claveGas(b.planId, b.id)) ?? 0),
    );
    const acumulados = acumuladosGas(
      tramosNeto,
      padres,
      new Map(
        gasTramos.map((t) => {
          const appPid = t.planId ? `_${String(t.planId)}` : '';
          return [
            claveGas(t.planId, t.id),
            aparatos[`gas_${t.id}${appPid}`] || aparatos[`gas_${t.id}`] || {},
          ] as const;
        }),
      ),
    );
    const result = [];
    const pFinPorClave = new Map<string, number>();
    const dPAcumPorClave = new Map<string, number>();
    for (const t of orden) {
      const dInt = diamInt[tramoKey(t)] || 0;

      const acc: Record<string, number> = gasAcc[t.id] || {};
      let sumLe = 0;
      for (const k of ACC_KEYS) sumLe += (acc[k] || 0) * ((LE_K as Record<string, number>)[k] || 0);
      const le = dInt > 0 ? (dInt * sumLe) / 1000 : 0;
      const qRenouard = renouardByType(acumulados.get(claveGas(t.planId, t.id)) || {});
      const qDiseno = qDisenoGas(qRenouard, { pAtm, DR, fAlt, fTemp, fDens });
      const dP =
        dInt > 0
          ? ((23200 * (le + (t.longitud || 0)) * Math.pow(qDiseno, 1.82)) / Math.pow(dInt, 4.82)) *
            Math.pow(DR, 0.82)
          : 0;
      const vel = dInt > 0 ? (354 * qDiseno * 101.325) / (dInt * dInt) / pAtm : 0;
      const clave = claveGas(t.planId, t.id);
      const padre = padres.get(clave);
      const pIni = (padre && pFinPorClave.get(padre)) || pMin;
      const pFin = pIni - dP;
      pFinPorClave.set(clave, pFin);
      const dPAcum = (padre ? (dPAcumPorClave.get(padre) ?? 0) : 0) + dP;
      dPAcumPorClave.set(clave, dPAcum);
      // Chequeo NTC 3728: V ≤ 10 m/s y pérdida acumulada ≤ 9.81 mbar (mismo criterio de gasRows).
      const ok =
        vel > 0 && vel <= 10 && dP > 0 ? (dPAcum <= 9.81 ? 'O.K.' : 'NO') : dP > 0 ? 'NO' : '—';
      result.push({
        id: t.id,
        le,
        qConsumo: qRenouard,
        fAlt,
        fTemp,
        fDens,
        qDiseno,
        dP,
        dPAcum,
        vel,
        pIni,
        pFin,
        chequeo: ok,
      });
    }
    return result;
  }, [gasTramos, diamInt, gasAcc, pmin, temp, densRel, patm]);

  const COLS = GasDesign_COLS;

  const page1 = (() => {
    const fGas = factoresGas({ patm, temp, densRel });
    // Q de diseño global = Renouard sobre TODA la carga instalada (cada aparato contado UNA vez).
    // Sumar los qConsumo de las filas doble-contaba: el tronco ya carga la demanda de sus hojas
    // (acumulados del árbol). Con 2 aparatos en hojas distintas daba 2× el caudal.
    const totalAparatos: Record<string, number> = {};
    for (const t of gasTramos) {
      const propios = gasAcc[t.id] || {};
      for (const [ap, n] of Object.entries(propios)) {
        totalAparatos[ap] = (totalAparatos[ap] || 0) + (Number(n) || 0);
      }
    }
    const qGlobal = renouardByType(totalAparatos);
    // Estilo sanitaria: texto plano hasta activar EDITAR (mono, sin borde de input).
    const TXT_VAL: React.CSSProperties = {
      fontFamily: 'var(--mono)',
      fontWeight: 600,
      fontSize: 13,
      textAlign: 'right',
      display: 'block',
      width: 100,
      padding: '5px 8px',
    };
    const filas: {
      lbl: string;
      val: string;
      setVal?: (v: string) => void;
      uni: string;
    }[] = [
      { lbl: 'Altitud de la ciudad del proyecto', val: alt, setVal: setAlt, uni: 'msnm' },
      { lbl: 'Presión atmosférica de la ciudad de diseño', val: patm, uni: 'kPa' },
      { lbl: 'Temperatura promedio de la ciudad', val: temp, setVal: setTemp, uni: '°C' },
      { lbl: 'Presión mínima de la red según operador', val: pmin, setVal: setPmin, uni: 'mbar' },
      { lbl: 'Densidad relativa del gas a utilizar', val: densRel, setVal: setDensRel, uni: '' },
    ];
    const factores: [string, React.ReactNode][] = [
      [
        'Altitud',
        <>
          f<sub>alt</sub> = 101.325 / {fGas.pAtm.toFixed(2)} ={' '}
          <b style={{ color: 'var(--gas)' }}>{fGas.fAlt.toFixed(2)}</b>
        </>,
      ],
      [
        'Temperatura',
        <>
          f<sub>temp</sub> = &radic;(288 / (273 + {Number(temp) || 23})) ={' '}
          <b style={{ color: 'var(--gas)' }}>{fGas.fTemp.toFixed(2)}</b>
        </>,
      ],
      [
        'Densidad relativa',
        <>
          f<sub>dens</sub> = &radic;(0.67 / {fGas.DR.toFixed(2)}) ={' '}
          <b style={{ color: 'var(--gas)' }}>{fGas.fDens.toFixed(2)}</b>
        </>,
      ],
      [
        'Caudal de diseño',
        <>
          Q<sub>d</sub> = max(&Sigma;Q&middot;f, 2.7) ={' '}
          <b style={{ color: 'var(--gas)' }}>{qDisenoGas(qGlobal, fGas).toFixed(2)} m&sup3;/h</b>
        </>,
      ],
    ];
    return (
      <>
        {/* ancho común: ambas cards estiran al ancho del contenido más ancho */}
        <div
          style={{
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 10,
            alignSelf: 'center',
            maxWidth: '100%',
          }}
        >
          <section className="card" style={{ flexShrink: 0 }}>
            <div className="card-h" style={{ padding: '6px 12px' }}>
              <h3 className="card-t">
                <img
                  src="/iconos_civilflow/diseno_redes/gas/datos_generales_red_gas.webp"
                  alt="Datos generales red de gas"
                  width={24}
                  height={24}
                  style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }}
                  loading="lazy"
                />
                Datos generales
              </h3>
              <EditButton edit={edit} setEdit={setEdit} />
            </div>
            <div
              style={{
                padding: '8px 12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <table className="tbl" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                <caption style={SR_ONLY}>Datos generales</caption>
                <tbody>
                  {filas.map((row, i, arr) => (
                    <tr key={row.lbl}>
                      <td
                        style={{
                          padding: '6px 10px',
                          fontWeight: 600,
                          color: 'var(--txt)',
                          fontSize: 13,
                          borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none',
                          borderRight: '1px solid var(--line)',
                        }}
                      >
                        {row.lbl}
                      </td>
                      <td
                        style={{
                          padding: '6px 10px',
                          borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none',
                          borderRight: '1px solid var(--line)',
                        }}
                      >
                        {row.setVal && edit ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            aria-label={row.lbl}
                            value={row.val}
                            onChange={(e) => row.setVal!(e.target.value)}
                            style={{
                              ...SI,
                              textAlign: 'right',
                              fontSize: 13,
                              padding: '5px 8px',
                              width: 100,
                            }}
                          />
                        ) : (
                          <span style={TXT_VAL}>{row.val}</span>
                        )}
                      </td>
                      <td
                        style={{
                          padding: '6px 10px',
                          color: 'var(--txt2)',
                          fontSize: 13,
                          fontWeight: 500,
                          borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none',
                        }}
                      >
                        {row.uni}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card" style={{ flexShrink: 0 }}>
            <div className="card-h" style={{ padding: '6px 12px' }}>
              <h3 className="card-t">
                <img
                  src="/iconos_civilflow/diseno_redes/general/calculo_perdidas_de_carga.webp"
                  alt="Factores de corrección"
                  width={20}
                  height={20}
                  style={{ width: 20, height: 20, verticalAlign: 'middle', marginRight: 4 }}
                  loading="lazy"
                />
                Factores de correcci&oacute;n
              </h3>
            </div>
            <div style={{ padding: '10px 16px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px 32px',
                }}
              >
                {factores.map(([lbl, node]) => (
                  <div key={lbl} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ color: 'var(--txt3)', fontSize: 13 }}>{lbl}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 15.5 }}>
                      {node}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </>
    );
  })();

  const page2 = <GasCalcUC />;

  const page3 = (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
        <section className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-h" style={{ justifyContent: 'space-between' }}>
            <h3 className="card-t">
              <img
                src="/iconos_civilflow/diseno_redes/gas/diseno_red_gas.webp"
                alt="Diseño red de gas"
                width={20}
                height={20}
                style={{ width: 20, height: 20, verticalAlign: 'middle', marginRight: 4 }}
                loading="lazy"
              />
              Diseño de red de gas
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              <span className="card-s">{gasTramos.length} tramos</span>
              <EditButton edit={edit} setEdit={setEdit} />
            </div>
          </div>
          <div style={{ padding: 6 }}>
            <table
              ref={tablaRef}
              className="tbl"
              style={{
                fontSize: 10.5,
                tableLayout: 'auto',
                width: '100%',
                borderCollapse: 'collapse',
              }}
            >
              <caption style={SR_ONLY}>Diseño de red</caption>
              <thead>
                <tr>
                  {COLS.map((c, i) => (
                    <th
                      scope="col"
                      key={i}
                      title={GasDesign_TIPS[i]}
                      style={{ ...TH, whiteSpace: 'pre-line' }}
                      rowSpan={2}
                    >
                      {c}
                    </th>
                  ))}
                  <th
                    scope="col"
                    title="Factores de corrección por condiciones de la ciudad y del gas (celdas AB/AC/AD del método Renouard)."
                    style={{ ...TH, borderBottom: '2px solid var(--line)' }}
                    colSpan={3}
                  >
                    Correcciones por
                  </th>
                  <th
                    scope="col"
                    style={{ ...TH, borderBottom: '2px solid var(--line)' }}
                    colSpan={2}
                  >
                    Consumo
                  </th>
                  <th
                    scope="col"
                    title="Accesorios instalados en el tramo (cantidad por tipo)."
                    style={{ ...TH, borderBottom: '2px solid var(--line)' }}
                    colSpan={ACC_COLS.length}
                  >
                    Accesorios
                  </th>
                  <th
                    scope="col"
                    title="Suma de longitudes equivalentes de los accesorios (m)."
                    style={TH}
                    rowSpan={2}
                  >
                    Longitud
                    <br />
                    equivalente
                  </th>
                  <th
                    scope="col"
                    title="Pérdida de presión del tramo (mbar)."
                    style={TH}
                    rowSpan={2}
                  >
                    {'Δ'}P
                  </th>
                  <th
                    scope="col"
                    title={`Pérdida de presión acumulada desde el inicio de la red, en mbar. Límite: ${gasTxt(proy.pais)}.`}
                    style={TH}
                    rowSpan={2}
                  >
                    {'Δ'}P
                    <br />
                    acum
                  </th>
                  <th
                    scope="col"
                    title="Velocidad del gas en el tramo (m/s)."
                    style={TH}
                    rowSpan={2}
                  >
                    Velocidad
                  </th>
                  <th
                    scope="col"
                    title="Presión disponible al inicio y al final del tramo (mbar)."
                    style={{ ...TH, borderBottom: '2px solid var(--line)' }}
                    colSpan={2}
                  >
                    Presión
                  </th>
                  <th scope="col" title={`O.K. según ${gasTxt(proy.pais)}.`} style={TH} rowSpan={2}>
                    Chequeo
                  </th>
                </tr>
                <tr>
                  <th
                    scope="col"
                    title="Factor por altitud: 101.325 / presión atmosférica."
                    style={TH}
                  >
                    Altitud
                  </th>
                  <th scope="col" title="Factor por temperatura: √(288 / (273 + T °C))." style={TH}>
                    Temperatura
                  </th>
                  <th
                    scope="col"
                    title="Factor por densidad relativa del gas: √(0.67 / DR)."
                    style={TH}
                  >
                    Densidad
                    <br />
                    relativa
                  </th>
                  <th
                    scope="col"
                    title="Consumo total del tramo por criterio Renouard (m³/h)."
                    style={TH}
                  >
                    Total Q
                    <br />
                    consumo
                  </th>
                  <th
                    scope="col"
                    title="Q de diseño en m³/h: consumo corregido por los tres factores (m³/hr > 2.70 — el piso aplica a cualquier tramo)."
                    style={TH}
                  >
                    Q de diseño
                  </th>
                  {[
                    'Codos 90° std',
                    'Codos 90° rl',
                    'Te en línea',
                    'Te ramal',
                    'Válvula de bola',
                  ].map((lbl) => (
                    <th key={lbl} scope="col" style={{ ...TH, fontSize: 10 }}>
                      {lbl}
                    </th>
                  ))}
                  <th scope="col" title="Presión al inicio del tramo (mbar)." style={TH}>
                    Inicio
                  </th>
                  <th scope="col" title="Presión al final del tramo (mbar)." style={TH}>
                    Fin
                  </th>
                </tr>
              </thead>
              <tbody>
                {gasTramos.length === 0 && (
                  <tr>
                    <td colSpan={8 + 2 + 3 + ACC_COLS.length + 7} style={EMPTY_ROW}>
                      No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                    </td>
                  </tr>
                )}
                {gasTramos.map((t) => {
                  const chk = checkRows.find((r) => r.id === t.id);
                  const mat = diamMat[tramoKey(t)] || '';
                  const dn = diamDn[tramoKey(t)] || '';
                  const kVal = diamK[tramoKey(t)] || 0;
                  const dInt = diamInt[tramoKey(t)] || 0;
                  return (
                    <tr key={tramoKey(t)}>
                      <td className="c" style={{ padding: '0 1px' }}>
                        <span className="sigla" style={{ fontSize: 10.5, padding: '1px 4px' }}>
                          {t.id}
                          {t.piso != null ? `-${pisoCorto(t.piso)}` : ''}
                        </span>
                      </td>

                      <td className="c" style={{ ...TD, padding: '1px 2px' }}>
                        {t.ini || '—'}
                      </td>
                      <td className="c" style={{ ...TD, padding: '1px 2px', minWidth: 78 }}>
                        {t.fin || '—'}
                      </td>
                      <td className="c" style={{ padding: '0 1px' }}>
                        {/* Material y diámetro separados: cada uno con su desplegable. */}
                        <select
                          aria-label="Material del tramo"
                          value={mat}
                          disabled={!edit}
                          onChange={(e) => handleMatChange(tramoKey(t), e.target.value)}
                          style={{
                            ...SD,
                            width: '100%',
                            maxWidth: 104,
                            fontSize: 10.5,
                            textAlign: 'center',
                          }}
                        >
                          <option value="">—</option>
                          {[...new Set(ALL_DN.map((r) => r.mat))]
                            .sort((a, b) => a.localeCompare(b))
                            .map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="c" style={{ padding: '0 1px' }}>
                        <select
                          aria-label="Diámetro diseño"
                          value={dn}
                          disabled={!edit || !mat}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) {
                              handleDiamChange(tramoKey(t), mat, '');
                              return;
                            }
                            handleDiamChange(tramoKey(t), mat, v);
                          }}
                          style={{ ...SD, width: '100%', fontSize: 10.5, textAlign: 'center' }}
                        >
                          <option value="">—</option>
                          {ALL_DN.filter((r) => r.mat === mat).map((r) => (
                            <option key={r.dn} value={r.dn}>
                              {r.dn}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td
                        className="c"
                        style={{
                          ...TD,
                          padding: '1px 2px',
                          color: dInt ? 'var(--txt)' : 'var(--txt3)',
                        }}
                      >
                        {dInt ? dInt.toFixed(2) : '—'}
                      </td>
                      <td
                        className="c"
                        style={{
                          ...TD,
                          padding: '1px 2px',
                          color: kVal ? 'var(--txt)' : 'var(--txt3)',
                        }}
                      >
                        {kVal ? fmt(kVal, 2) : '—'}
                      </td>
                      <td className="c" style={{ ...TD, padding: '1px 2px' }}>
                        {t.longitud > 0 ? t.longitud.toFixed(2) : '—'}
                      </td>
                      {(['qConsumo', 'fAlt', 'fTemp', 'fDens', 'qDiseno'] as const).map((k) => (
                        <td
                          key={k}
                          className="c"
                          style={{
                            ...TD,
                            padding: '1px 2px',
                            fontWeight: k === 'qDiseno' ? 600 : undefined,
                            color: (chk?.[k] ?? 0) > 0 ? 'var(--txt)' : 'var(--txt3)',
                          }}
                        >
                          {(chk?.[k] ?? 0) > 0 ? (chk![k] as number).toFixed(2) : '—'}
                        </td>
                      ))}
                      {ACC_COLS.map((k) => (
                        <td key={k} className="c" style={{ padding: '1px 2px' }}>
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 600,
                              fontFamily: 'var(--mono)',
                              color: (getAcc(t.id)[k] || 0) > 0 ? 'var(--txt)' : 'var(--txt3)',
                            }}
                          >
                            {getAcc(t.id)[k] || 0}
                          </span>
                        </td>
                      ))}
                      <td
                        className="c"
                        style={{
                          ...TD,
                          padding: '1px 2px',
                          fontWeight: 600,
                          borderLeft: '2px solid var(--line)',
                        }}
                      >
                        {(chk?.le ?? 0).toFixed(2)}
                      </td>
                      <td className="c" style={{ ...TD, padding: '1px 2px' }}>
                        {(chk?.dP ?? 0).toFixed(2)}
                      </td>
                      <td
                        className="c"
                        style={{
                          ...TD,
                          padding: '1px 2px',
                          fontWeight: 600,
                          color: (chk?.dPAcum ?? 0) > 9.81 ? 'var(--err, #F04545)' : 'var(--txt)',
                        }}
                      >
                        {(chk?.dPAcum ?? 0).toFixed(2)}
                      </td>
                      <td className="c" style={{ ...TD, padding: '1px 2px' }}>
                        {(chk?.vel ?? 0).toFixed(2)}
                      </td>
                      <td className="c" style={{ ...TD, padding: '1px 2px' }}>
                        {(chk?.pIni ?? 0).toFixed(2)}
                      </td>
                      <td className="c" style={{ ...TD, padding: '1px 2px' }}>
                        {(chk?.pFin ?? 0).toFixed(2)}
                      </td>
                      <td
                        className="c"
                        style={{
                          padding: '1px 2px',
                          fontWeight: 700,
                          fontSize: 10.5,
                          color:
                            chk?.chequeo === 'O.K.'
                              ? 'var(--succ, #5DBB83)'
                              : chk?.chequeo === 'NO'
                                ? 'var(--err, #F04545)'
                                : 'var(--txt3)',
                        }}
                      >
                        {chk?.chequeo ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        {gasContBajantes.length > 0 && (
          <section className="card" style={{ flexShrink: 0 }}>
            <div className="card-h" style={{ justifyContent: 'space-between' }}>
              <h3 className="card-t">
                <img
                  src="/iconos_civilflow/diseno_redes/hidraulica/red_agua_fria.webp"
                  alt="Contador / Calentador"
                  width={20}
                  height={20}
                  style={{ width: 20, height: 20, verticalAlign: 'middle', marginRight: 4 }}
                  loading="lazy"
                />
                Contador / Calentador
              </h3>
              <span className="card-s">{gasContBajantes.length} equipos</span>
              <EditButton edit={edit} setEdit={setEdit} />
            </div>
            <div style={{ padding: 6 }}>
              <table className="tbl" style={{ fontSize: 10.5 }}>
                <thead>
                  <tr>
                    <th title="Identificador del equipo en el dibujo." scope="col" style={TH}>
                      ID
                    </th>
                    <th title="Tipo de equipo: contador o calentador." scope="col" style={TH}>
                      Tipo
                    </th>
                    <th title="Diámetro de la conexión del equipo." scope="col" style={TH}>
                      Diámetro
                    </th>
                    <th title="Tipo de conexión del equipo." scope="col" style={TH}>
                      Conexión
                    </th>
                    <th title="Capacidad del equipo." scope="col" style={TH}>
                      Capacidad
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gasContBajantes.map((b) => (
                    <tr key={b.id}>
                      <td className="c" style={TD}>
                        {b.code || b.id}
                      </td>
                      <td className="c" style={TD}>
                        {b.tipo === 'contador' ? 'Contador' : 'Calentador'}
                      </td>
                      <td className="c" style={{ padding: '1px 2px' }}>
                        {b.tipo === 'contador' ? (
                          <select
                            value={b.dNominal ? b.dNominal.replace(/"/g, '').trim() : ''}
                            aria-label="Diámetro"
                            disabled={!edit}
                            onChange={(e) => {
                              const dNom = e.target.value ? `${e.target.value}"` : '';
                              writeContadorDiamToDrawing(dNom, plans, 'gas', {
                                planId: b.planId,
                                id: b.id,
                              });
                            }}
                            style={{ ...SD, fontSize: 10.5 }}
                          >
                            <option value="">—</option>
                            {CONTADORES_CAT.map((c) => (
                              <option key={c.dn} value={c.dn}>
                                {c.dn}"
                              </option>
                            ))}
                          </select>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="c" style={{ padding: '1px 2px' }}>
                        <select
                          value={b.acoDiam || ''}
                          aria-label="Conexión"
                          disabled={!edit}
                          onChange={(e) => {
                            const val = e.target.value;
                            const bajKey = `${b.id}-${b.planId}`;
                            writeBajantePropToDrawing(bajKey, 'gas', 'acoDiam', val, plans);
                          }}
                          style={{ ...SD, fontSize: 10.5 }}
                        >
                          <option value="">—</option>
                          {GAS_DN_LABELS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="c" style={{ padding: '1px 2px' }}>
                        {b.tipo === 'calentador' ? (
                          <select
                            value={b.capacidad || ''}
                            aria-label="Capacidad"
                            disabled={!edit}
                            onChange={(e) => {
                              const val = e.target.value;
                              const bajKey = `${b.id}-${b.planId}`;
                              writeBajantePropToDrawing(bajKey, 'gas', 'capacidad', val, plans);
                            }}
                            style={{ ...SD, fontSize: 10.5 }}
                          >
                            <option value="">—</option>
                            {CAT_GAS.filter((g) => g.id.startsWith('cal')).map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.n}
                              </option>
                            ))}
                          </select>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </>
  );

  return (
    <div
      className="fu"
      style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}
    >
      <div
        style={{
          padding: 6,
          overflow: 'auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {pagina === 1 ? page1 : pagina === 2 ? page2 : page3}
      </div>
    </div>
  );
}
export default React.memo(GasDesign);
