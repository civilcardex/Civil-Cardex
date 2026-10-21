import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useStickyThead2Offset } from './shared/useStickyThead2Offset';
import { usePlans } from '../context/PlansContext.tsx';
import { useProyecto } from '../context/ProjectContext.tsx';
import {
  writeDiametroToDrawing,
  writeMaterialToDrawing,
  clearDiametroToDrawing,
} from '../utils/writeDiameterToDrawing.ts';
import { loadFromStorage, saveToStorage, getActiveProyectoId } from '../services/storageService.ts';
import { loadGasDatos, saveGasDatos } from '../services/projectDataService.ts';
import GasCalcUC from './GasCalcUC.tsx';
import { GasDatosGenerales } from './gas/GasGeneralData.tsx';
import { GasTablaRed } from './gas/GasNetworkTable.tsx';
import { GasContadores } from './gas/GasMeters.tsx';
import type { DrawingData, RawElement } from '../utils/drawingSync.ts';

import {
  TRAZOS_PREFIX,
  GAS_ACC_KEY,
  APARATOS_BY_TRAMO_KEY,
  GAS_DATOS_KEY,
} from '../constants/storage-keys.ts';
import { factoresGas, patmDeAltitud } from '../utils/gasUtils.ts';
import { claveGas } from '../utils/gasNetwork.ts';
import { calculaFilasGas, propiosDeTramo } from '../utils/gasCalcRows.ts';
import { compareTramosPisoDesc } from '../utils/componentHelpers.tsx';
import { GAS_DATOS_DEFAULT, lookupDn } from '../utils/gasRows.ts';
import { avisarDiametroInvalido } from '../utils/diameterValidation.ts';

type GasAccMap = Record<string, Record<string, number>>;
interface GasRamalRaw extends RawElement {
  Lh?: number;
}
interface GasBajanteRaw extends RawElement {
  capacidad?: string;
}

/** Convierte la clave de estado de la tabla ("planId:id") al formato que esperan los writes
 *  al trazo ("id-planId", igual que writeDiametroToDrawing). Sin esta conversión,
 *  writeMaterial/writeDiametro/clear no encuentran el ramal y no escriben nada. */
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
  const patm = useMemo(() => patmDeAltitud(alt), [alt]);
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
      // Redes de presión: sin bloqueo salida/entrada (retirado — orig. usuario); la tabla
      // converge los vecinos al mayor vía writeDiametroToDrawing.
    }
    setDiamMat((prev) => ({ ...prev, [tramoId]: mat }));
    setDiamDn((prev) => ({ ...prev, [tramoId]: dn }));
    setDiamInt((prev) => ({ ...prev, [tramoId]: opt ? opt.d : 0 }));
    setDiamK((prev) => ({ ...prev, [tramoId]: opt ? opt.K : 0 }));
  };

  /** Cambio SOLO de material: persiste y, si el diámetro actual no existe en el nuevo material, limpia el trazo (clearDiametroToDrawing) y el
   * estado — el usuario re-selecciona en el desplegable de diámetro. */
  const handleMatChange = (tramoId: string, mat: string) => {
    writeMaterialToDrawing(writeKeyDe(tramoId), 'gas', mat, plans);
    setDiamMat((prev) => ({ ...prev, [tramoId]: mat }));
    const dn = diamDn[tramoId] || '';
    if (dn && !lookupDn(mat, dn)) {
      clearDiametroToDrawing(writeKeyDe(tramoId), 'gas', plans);
      handleDiamChange(tramoId, mat, '');
    }
  };

  // Clave compuesta por plano (los ids REPITEN entre pisos); fallback lectura al formato viejo.
  const getAcc = useCallback(
    (t: { id: string; planId?: string | number }): Record<string, number> =>
      (gasAcc[`gas_${t.id}_${t.planId}`] || gasAcc[t.id] || {}) as Record<string, number>,
    [gasAcc],
  );

  const checkRows = useMemo(() => {
    const pMin = Number(pmin) || 17;
    const { pAtm, DR, fAlt, fTemp, fDens } = factoresGas({ patm, temp, densRel });
    const aparatos: Record<string, Record<string, number>> = loadFromStorage(
      APARATOS_BY_TRAMO_KEY,
      {},
    );
    // Árbol de red + aparatos acumulados (docx flujo de nodos): el tronco lleva la
    // demanda de toda su red descendente; presión y ΔP acumulada POR RAMA.
    // El cálculo vive en utils/gasCalcRows.ts (compartido con la tabla resumen).
    const propios = new Map<string, Record<string, number>>();
    for (const t of gasTramos) {
      propios.set(
        claveGas(t.planId, t.id),
        propiosDeTramo(aparatos, { id: t.id, planId: t.planId }),
      );
    }
    return calculaFilasGas({
      tramos: gasTramos.map((t) => ({
        id: t.id,
        planId: t.planId,
        piso: t.piso,
        longitud: t.longitud,
        esTrib: false,
        pts: t.pts,
        _tribReversed: t._tribReversed,
      })),
      dIntDe: (t) => diamInt[`${t.planId}:${t.id}`] || 0,
      accDe: (t) => getAcc({ id: t.id, planId: t.planId }),
      propios,
      pMin,
      factores: { pAtm, DR, fAlt, fTemp, fDens },
      pais: proy.pais,
    });
  }, [gasTramos, diamInt, getAcc, pmin, temp, densRel, patm, proy.pais]);

  // Índice por clave: el render busca la fila de cada tramo (antes era un .find por fila,
  // O(n²) en una tabla que puede traer cientos de tramos).
  const checkPorClave = useMemo(() => new Map(checkRows.map((r) => [r.clave, r])), [checkRows]);

  const page1 = (
    <GasDatosGenerales
      alt={alt}
      setAlt={setAlt}
      patm={patm}
      temp={temp}
      setTemp={setTemp}
      pmin={pmin}
      setPmin={setPmin}
      densRel={densRel}
      setDensRel={setDensRel}
      edit={edit}
      setEdit={setEdit}
      tramos={gasTramos}
    />
  );

  const page2 = <GasCalcUC />;

  const page3 = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
      <GasTablaRed
        tramos={gasTramos}
        checkPorClave={checkPorClave}
        diamMat={diamMat}
        diamDn={diamDn}
        diamK={diamK}
        diamInt={diamInt}
        edit={edit}
        setEdit={setEdit}
        handleMatChange={handleMatChange}
        handleDiamChange={handleDiamChange}
        getAcc={getAcc}
        tablaRef={tablaRef}
        pais={proy.pais}
      />
      <GasContadores equipos={gasContBajantes} edit={edit} setEdit={setEdit} plans={plans} />
    </div>
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
