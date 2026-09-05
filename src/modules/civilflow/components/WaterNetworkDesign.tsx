import React, { useState, useMemo, useEffect } from 'react';
import EditButton from './shared/EditButton';
import { useTramos } from '../context/TramosContext';
import { useProyecto } from '../context/ProjectContext';
import { usePlans } from '../context/PlansContext';
import { AF_UC_IDS, AC_UC_IDS, matHazenC } from '../constants';
import { calcUCparcial, compareTramosPisoDesc } from '../utils/componentHelpers';
import { CONTADORES as CONTADORES_CAT } from '../pages/catalog/catalogData';
import {
  writeDiametroToDrawing,
  writeContadorDiamToDrawing,
  findContadorBajante,
} from '../utils/writeDiameterToDrawing';
import { saveToStorage } from '../services/storageService';
import { isAf, isAC1 } from '../utils/waterNetworkRows';
import Acometida from './SupplyConnection';
import { useWaterNetworkGraph } from './waterNetworkDesign/useWaterNetworkGraph';
import { useAcometidaParams, calcFila } from './waterNetworkDesign/acometidaCalc';
import { resolvePressures } from './waterNetworkDesign/pressureResolver';
import { hunterK, hunterQ, computeDesignRow } from './waterNetworkDesign/rowPhysics';
import { DesignTableHeader } from './waterNetworkDesign/designTableHeader';
import { DesignTableRow } from './waterNetworkDesign/designTableRow';

const WaterNetworkDesign_S1: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};

interface WaterNetworkDesignProps {
  networkType: 'af' | 'ac';
  diamTable: Array<{ pulg: number; nominal: string; label?: string; dInt: number }>;
  lookupFn: (pulg: number) => number;
  showOnlyAcometida?: boolean;
  hideAcometida?: boolean;
}

function WaterNetworkDesign({
  networkType,
  diamTable,
  lookupFn,
  showOnlyAcometida,
  hideAcometida,
}: WaterNetworkDesignProps) {
  const [edit, setEdit] = useState(false);
  const { tramosAf, tramosAc, updTramoAf, updTramoAc } = useTramos();
  const { proy } = useProyecto();
  const { plans } = usePlans();

  const tramos = isAf(networkType) ? tramosAf : tramosAc;
  const updTramo = isAf(networkType) ? updTramoAf : updTramoAc;

  const ucIds = isAf(networkType) ? AF_UC_IDS : AC_UC_IDS;
  const cssClass = networkType;
  const colorVar = `var(--${networkType})`;
  const ucField = isAf(networkType) ? 'uc_af' : 'uc_ac';
  const title = isAf(networkType) ? 'agua fr\u00EDa' : 'agua caliente';
  const icon = isAf(networkType) ? 'hidraulica/RAF_Diseno.webp' : 'hidraulica/RAC_Diseno.webp';

  const DIAM_OPTS = useMemo(
    () =>
      diamTable.map((d) => ({
        pulg: d.pulg,
        nominal: d.nominal,
        label: d.nominal,
        dInt: d.dInt,
      })),
    [diamTable],
  );

  const [diamIntMap, setDiamIntMap] = useState<Record<string, number>>({});
  const [diamNomMap, setDiamNomMap] = useState<Record<string, string>>({});

  const handleDiamChange = (tramoId: string, nominal: string) => {
    const opt = DIAM_OPTS.find((o) => o.nominal === nominal);
    if (!opt) return;
    const pulg = opt.pulg;
    const res = writeDiametroToDrawing(tramoId, networkType, opt.label, plans);
    if (!res.ok && res.reason === 'accessory-larger') {
      // Mostrar el mismo AlertDialog de la app que el flujo del motor (espejo de
      // ExtremeAccessoryEditor.tsx:110-117, que valida la dirección inversa). Sin esto la escritura
      // de la tabla de diseño tendría éxito en silencio y un accesorio más ancho terminaría dibujado
      // alrededor de un tubo más delgado — físicamente absurdo.
      window.dispatchEvent(
        new CustomEvent('civilflow_diametro_validation', {
          detail: {
            title: 'Diámetro no permitido',
            message: `El diámetro del ramal no puede ser menor al del accesorio conectado en el extremo ${res.accessoryEnd} (${res.accessoryDiam}). Reduce el diámetro del accesorio o selecciona un ramal mayor.`,
          },
        }),
      );
      return;
    }
    if (!res.ok && (res as unknown as { reason?: string }).reason === 'parent-smaller') {
      window.dispatchEvent(
        new CustomEvent('civilflow_diametro_validation', {
          detail: {
            title: 'Diámetro no permitido',
            message: `El diámetro de salida no puede ser mayor que el de entrada (${(res as unknown as { parentDiam?: string }).parentDiam}). Selecciona un diámetro menor o igual al del tramo aguas arriba.`,
          },
        }),
      );
      return;
    }
    if (!res.ok && (res as unknown as { reason?: string }).reason === 'child-larger') {
      window.dispatchEvent(
        new CustomEvent('civilflow_diametro_validation', {
          detail: {
            title: 'Diámetro no permitido',
            message: `El diámetro de entrada no puede ser menor que el de salida (${(res as unknown as { parentDiam?: string }).parentDiam}) ya asignado aguas abajo. Selecciona un diámetro mayor o reduce primero la salida.`,
          },
        }),
      );
      return;
    }
    updTramo(tramoId, 'diamDisPulg', pulg);
    setDiamIntMap((prev) => ({ ...prev, [tramoId]: opt.dInt }));
    setDiamNomMap((prev) => ({ ...prev, [tramoId]: opt.nominal }));
  };

  const [presIniEdit, setPresIniEdit] = useState(() => new Map());
  const [presFinEdit, setPresFinEdit] = useState(() => new Map());

  const setPresIni = (tramoId: string, v: number | undefined) => {
    setPresIniEdit((prev) => {
      const next = new Map(prev);
      if (v === undefined) next.delete(tramoId);
      else next.set(tramoId, v);
      return next;
    });
  };

  const setPresFin = (tramoId: string, v: number | undefined) => {
    setPresFinEdit((prev) => {
      const next = new Map(prev);
      if (v === undefined) next.delete(tramoId);
      else next.set(tramoId, v);
      return next;
    });
  };

  const { AP, conexionesDisplay, componentTotalMap, tramoParentOf, pressureRootKey, qpropMap } =
    useWaterNetworkGraph({ plans, tramos, networkType, ucIds, ucField });

  // mergeBranches ahora se indexa directamente por el ramal que debe MOSTRAR el total combinado
  // (existing, el tronco estructural) en lugar del ramal auto-creado — así componentTotalMap ya
  // tiene el valor correcto en la key correcta sin paso de reetiquetado aparte. Se mantiene como
  // alias nombrado porque los puntos de llamada de abajo ya leen `displayTotalMap`.
  const displayTotalMap = componentTotalMap;

  const propiaMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tramos) {
      const key = t._key || t.id;
      m[key] = calcUCparcial(t, AP, 'uc');
    }
    return m;
  }, [tramos, AP]);

  const pRed = parseFloat(proy.p_red) || 20;

  const tramosOrden = useMemo(
    () =>
      tramos
        .filter((t) => t.tipo !== 'tributario' && !t.esBajante && !isAC1(t))
        .sort(compareTramosPisoDesc),
    [tramos],
  );

  const [acoContIx, setAcoContIx] = useState(2);
  const contIxDeps = networkType === 'af' ? String(plans?.length ?? 0) + '|' + networkType : '';
  const detectedContIx = useMemo(() => {
    if (networkType !== 'af') return null;
    const found = findContadorBajante(plans, networkType);
    if (!found?.bajante.dNominal) return null;
    const dNom = found.bajante.dNominal.replace('½', '1/2').replace('¾', '3/4');
    const idx = CONTADORES_CAT.findIndex((c) => `${c.dn}"` === dNom);
    return idx === -1 ? null : idx;
  }, [plans, networkType]);
  const [previousContIxDeps, setPreviousContIxDeps] = useState(contIxDeps);
  if (contIxDeps !== previousContIxDeps) {
    setPreviousContIxDeps(contIxDeps);
    if (detectedContIx !== null) setAcoContIx(detectedContIx);
  }
  const [acoMonName, setAcoMonName] = useState('Mon');
  const acoContMonDiam = 1.25;
  const [acoL1, setAcoL1] = useState({ h: 10.0, v: 0.0, le: 0.47 });
  const [acoL2, setAcoL2] = useState({ h: 7.54, v: 0.0, le: 0.0 });
  const [acoPini, setAcoPini] = useState(20.0);
  const [acoLeMed, setAcoLeMed] = useState(0);
  const [acoHfMax, setAcoHfMax] = useState(5.0);

  const handleContDiamChange = React.useCallback(
    (dNom: string) => {
      writeContadorDiamToDrawing(dNom, plans, networkType);
    },
    [plans, networkType],
  );

  const {
    tr1,
    tr2,
    resolvedMonName,
    resolvedContMonDiam,
    resolvedRedContDiam,
    resolvedL1,
    resolvedL2,
  } = useAcometidaParams({
    networkType,
    tramos,
    acoMonName,
    diamNomMap,
    diamTable,
    acoContMonDiam,
    acoL1,
    acoL2,
  });
  const isTr1Drawn = !!tr1;
  const isTr2Drawn = !!tr2;

  const contadorSel = CONTADORES_CAT[acoContIx] || CONTADORES_CAT[0];

  const ucTotal = useMemo(() => {
    let s = 0;
    for (const t of tramos) {
      const key = t._key || t.id;
      s += propiaMap[key] || 0;
    }
    return s;
  }, [tramos, propiaMap]);

  const Qaco = useMemo(() => {
    if (tr2) {
      const ownKey = tr2._key || tr2.id;
      const total = componentTotalMap[ownKey] || 0;
      const nDesc = tr2.nSalidas || 0;
      const K =
        nDesc > 0 ? Math.round((nDesc === 1 ? 1 : 1 / Math.sqrt(nDesc - 1)) * 100) / 100 : 0;
      if (total > 0 && K > 0) {
        return (
          Math.round(
            K *
              (total < 240 ? 0.1163 * Math.pow(total, 0.6875) : 0.074 * Math.pow(total, 0.7504)) *
              1000,
          ) / 1000
        );
      }
    }
    return ucTotal > 0 ? Math.round(0.1163 * Math.pow(ucTotal, 0.6875) * 1000) / 1000 : 0;
  }, [ucTotal, tr2, componentTotalMap]);

  const cHW1 = matHazenC(tr1?.material || '') ?? 150;
  const cHW2 = matHazenC(tr2?.material || '') ?? 150;
  const acoL1LeTotal = resolvedL1.le + acoLeMed;
  const f1 = calcFila(
    resolvedRedContDiam || '',
    resolvedL1.h,
    resolvedL1.v,
    acoL1LeTotal,
    acoPini,
    cHW1,
    diamTable,
    Qaco,
  );
  const f2 = calcFila(
    resolvedContMonDiam || '',
    resolvedL2.h,
    resolvedL2.v,
    resolvedL2.le,
    f1.Pfin,
    cHW2,
    diamTable,
    Qaco,
  );
  const hfContador =
    Qaco > 0 && contadorSel.q > 0
      ? Math.round(10 * Math.pow(Qaco / contadorSel.q, 2) * 100) / 100
      : 0;
  const pResidual = +(f1.Pfin - f2.Pfin).toFixed(2);
  const okPresion = f1.Pfin > f2.Pfin;

  // AC no tiene acometida propia — se alimenta del calentador de agua, que a su vez se alimenta
  // de AF. Leer la presión resuelta de AF en ese nodo calentador compartido (persistida abajo)
  // para que el tramo raíz de AC arranque desde ella en lugar del pRed plano de respaldo.
  const afHeaterPfin = useMemo(() => {
    if (isAf(networkType)) return null;
    const heaterTramo = tramosAf.find(
      (t) => String(t.ini || '').startsWith('CALENT') || String(t.fin || '').startsWith('CALENT'),
    );
    return heaterTramo?.pFin ?? null;
  }, [networkType, tramosAf]);

  // Propagación de presión real basada en árbol, resuelta una vez por render (recursiva, memoizada
  // sobre la marcha) en lugar de que cada tramo lea planamente la presión de acometida:
  //   1. La raíz de la red (tr2 para AF, el tramo del calentador para AC) arranca de su propia fuente.
  //   2. Un tramo que comienza en un aparato (t.ini coincide con una sigla de aparato) arranca del
  //      Pmax de ese aparato — misma regla que usa la hoja de cálculo de referencia.
  //   3. Todo lo demás hereda Pinicial del Pfinal de su tramo aguas arriba real (tramoParentOf,
  //      la versión dirigida del mismo grafo de conectividad usado para totales UD).
  //   4. Los tramos huérfanos/desconectados caen a pRed, igual que hoy.
  const pressureByKey = useMemo(
    () =>
      resolvePressures({
        tramosOrden,
        tr2,
        componentTotalMap,
        Qaco,
        diamNomMap,
        diamIntMap,
        diamOpts: DIAM_OPTS,
        lookupFn,
        tramoParentOf,
        pressureRootKey,
        networkType,
        f1Pfin: f1.Pfin,
        afHeaterPfin,
        pRed,
        presIniEdit,
        presFinEdit,
      }),
    [
      tramosOrden,
      tr2,
      componentTotalMap,
      Qaco,
      diamNomMap,
      diamIntMap,
      DIAM_OPTS,
      lookupFn,
      tramoParentOf,
      pressureRootKey,
      networkType,
      f1.Pfin,
      afHeaterPfin,
      pRed,
      presIniEdit,
      presFinEdit,
    ],
  );

  // Persistir el Pfinal resuelto de cada tramo para que la instancia AC de este mismo componente
  // pueda leer la presión de AF en el nodo calentador compartido (ver afHeaterPfin arriba).
  useEffect(() => {
    for (const t of tramosOrden) {
      const ownKey = t._key || t.id;
      const resolved = pressureByKey[ownKey];
      if (resolved && t.pFin !== resolved.Pfin) updTramo(ownKey, 'pFin', resolved.Pfin);
    }
  }, [tramosOrden, pressureByKey, updTramo]);

  // Persistir los datos completos de fila para las tablas de memoria final
  useEffect(() => {
    const rows = tramosOrden.map((t) => {
      const ownKey = t._key || t.id;
      const isTr2 = t === tr2;
      const total = displayTotalMap[ownKey] || 0;
      const nDesc = t.nSalidas || 0;
      const Qprob2 = isTr2 ? Qaco : hunterQ(total, nDesc);
      const raizQ = Qprob2 > 0 ? Math.round(Math.sqrt(Qprob2) * 100) / 100 : 0;
      const c = computeDesignRow(t, {
        qprob: Qprob2,
        diamOpts: DIAM_OPTS,
        diamNomMap,
        diamIntMap,
        lookupFn,
      });
      const { Pin, Pfin } = pressureByKey[ownKey] ?? { Pin: pRed, Pfin: pRed };
      return {
        id: t.id,
        ini: typeof t.ini === 'string' ? t.ini : '—',
        fin: typeof t.fin === 'string' ? t.fin : '—',
        piso: t.piso,
        udPropia: propiaMap[ownKey] || 0,
        udTotal: total,
        nDesc,
        K: hunterK(nDesc),
        Qprob: Qprob2,
        diamEst: raizQ,
        diamDis: c.matchedOpt?.nominal || '—',
        dInt: c.internoMm,
        cHW: c.cHW,
        Vmms: c.Vmms,
        Lh: c.H,
        Lv: c.Vvert,
        Le: c.Le,
        Lt: c.Lt,
        hfPct: c.hfPct,
        hfM: c.hfM,
        Pin,
        Pfin,
      };
    });
    saveToStorage(`civilflow_memoria_${networkType}_rows`, rows);
  }, [
    tramosOrden,
    displayTotalMap,
    diamNomMap,
    diamIntMap,
    Qaco,
    DIAM_OPTS,
    lookupFn,
    propiaMap,
    tramos,
    pRed,
    pressureByKey,
    networkType,
    tr2,
  ]);

  // Persistir el checkpoint de velocidad (y, para AF, el de presión de acometida) en cada Tramo
  // para que InfTab muestre una insignia real OK/Revisar en lugar de nada.
  useEffect(() => {
    for (const t of tramosOrden) {
      const ownKey = t._key || t.id;
      const isTr2 = t === tr2;
      const total = componentTotalMap[ownKey] || 0;
      const Qprob = isTr2 ? Qaco : hunterQ(total, t.nSalidas || 0);
      const c = computeDesignRow(t, {
        qprob: Qprob,
        diamOpts: DIAM_OPTS,
        diamNomMap,
        diamIntMap,
        lookupFn,
      });
      const velCumple = c.Vmms > 0 ? c.Vmms >= 500 && c.Vmms <= 2500 : true;
      if (t.velCumple !== velCumple) updTramo(ownKey, 'velCumple', velCumple);
      if (isAf(networkType) && t.presionOk !== okPresion) updTramo(ownKey, 'presionOk', okPresion);
      if (t.qLps !== Qprob) updTramo(ownKey, 'qLps', Qprob);
    }
  }, [
    tramosOrden,
    tr2,
    componentTotalMap,
    diamNomMap,
    diamIntMap,
    Qaco,
    DIAM_OPTS,
    lookupFn,
    okPresion,
    networkType,
    updTramo,
  ]);

  const acometidaEl = isAf(networkType) && !hideAcometida && (
    <Acometida
      Qaco={Qaco}
      contadorSel={contadorSel}
      acoContIx={acoContIx}
      setAcoContIx={setAcoContIx}
      acoMonName={resolvedMonName}
      setAcoMonName={setAcoMonName}
      acoRedContDiam={resolvedRedContDiam || ''}
      acoContMonDiam={resolvedContMonDiam || ''}
      acoL1={resolvedL1}
      setAcoL1={setAcoL1}
      acoL2={resolvedL2}
      setAcoL2={setAcoL2}
      acoPini={acoPini}
      setAcoPini={setAcoPini}
      acoLeMed={acoLeMed}
      setAcoLeMed={setAcoLeMed}
      acoHfMax={acoHfMax}
      setAcoHfMax={setAcoHfMax}
      f1={f1}
      f2={f2}
      hfContador={hfContador}
      pResidual={pResidual}
      okPresion={okPresion}
      cHW1={cHW1}
      cHW2={cHW2}
      AF_DIAM_OPTS={DIAM_OPTS}
      isTr1Drawn={isTr1Drawn}
      isTr2Drawn={isTr2Drawn}
      onContDiamChange={handleContDiamChange}
    />
  );

  if (showOnlyAcometida) {
    return <>{acometidaEl}</>;
  }

  return (
    <>
      <section
        className="card"
        style={{ display: 'flex', flexDirection: 'column', maxHeight: '70vh', overflow: 'hidden' }}
      >
        <div className="card-h">
          <h3 className="card-t">
            <img
              src={`/iconos_civilflow/diseno_redes/${icon}`}
              alt={`${title}`}
              width={24}
              height={24}
              style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }}
              loading="lazy"
            />{' '}
            Diseño de red {title}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <span className="card-s">{tramosOrden.length} tramos</span>
            <EditButton edit={edit} setEdit={setEdit} />
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div className="scroll-top" style={{ padding: '6px' }}>
            <div className="scroll-inner" style={{ minWidth: 'max-content' }}>
              <table className="tbl" style={{ fontSize: 9, tableLayout: 'auto', width: '100%' }}>
                <caption style={WaterNetworkDesign_S1}>{`Diseño de red ${title}`}</caption>

                <DesignTableHeader cssClass={cssClass} />
                <tbody>
                  {tramosOrden.length === 0 && (
                    <tr>
                      <td
                        colSpan={23}
                        style={{
                          padding: '24px 0',
                          textAlign: 'center',
                          color: 'var(--txt3)',
                          fontSize: 9,
                        }}
                      >
                        No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                      </td>
                    </tr>
                  )}
                  {tramosOrden.map((t) => (
                    <DesignTableRow
                      key={t._key || t.id}
                      t={t}
                      tr2={tr2}
                      Qaco={Qaco}
                      qprobMap={qpropMap}
                      propia={propiaMap[t._key || t.id] || 0}
                      displayTotalMap={displayTotalMap}
                      conexionesDisplay={conexionesDisplay}
                      tramos={tramos}
                      colorVar={colorVar}
                      diamOpts={DIAM_OPTS}
                      diamNomMap={diamNomMap}
                      diamIntMap={diamIntMap}
                      lookupFn={lookupFn}
                      edit={edit}
                      handleDiamChange={handleDiamChange}
                      setPresIni={setPresIni}
                      setPresFin={setPresFin}
                      pRed={pRed}
                      pressureByKey={pressureByKey}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {acometidaEl}
    </>
  );
}
export default React.memo(WaterNetworkDesign);
