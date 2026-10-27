import React, { useState, useMemo, useEffect, useRef } from 'react';
import EditButton from './shared/EditButton.tsx';
import { useStickyThead2Offset } from './shared/useStickyThead2Offset';
import EmptyRow from './shared/EmptyRow.tsx';
import { useTramos } from '../context/TramosContext.tsx';
import { useProyecto } from '../context/ProjectContext.tsx';
import { usePlans } from '../context/PlansContext.tsx';
import { AF_UC_IDS, AC_UC_IDS, matHazenC } from '../constants';
import { calcUCparcial, compareTramosPisoDesc } from '../utils/componentHelpers.tsx';
import { CONTADORES as CONTADORES_CAT } from '../pages/catalog/catalogData.ts';
import {
  writeDiametroToDrawing,
  writeContadorDiamToDrawing,
  findContadorBajante,
} from '../utils/writeDiameterToDrawing.ts';

import { isAf, isAC1, isAC2, isContador } from '../utils/waterNetworkRows.ts';
import { calcLeAcces } from '../utils/fittingsUtils.ts';
import { chequeoPresionAparato } from '../utils/waterRowsShared.ts';
import { perfilDe } from '../constants/countryStandards';
import { fracAscii } from '../utils/formatUtils.ts';
import { leerLibrosPresion, propagarAparatosPresion } from '../utils/propagation';
import { avisarDiametroInvalido } from '../utils/diameterValidation.ts';
import Acometida from './SupplyConnection.tsx';
import { useWaterNetworkGraph } from './waterNetworkDesign/useWaterNetworkGraph.ts';
import { calcFila } from './waterNetworkDesign/acometidaCalc.ts';
import { resolvePressures } from './waterNetworkDesign/pressureResolver.ts';
import { hunterQ, computeDesignRow } from './waterNetworkDesign/rowPhysics.ts';
import { DesignTableHeader } from './waterNetworkDesign/designTableHeader.tsx';
import { DesignTableRow } from './waterNetworkDesign/designTableRow.tsx';
import { EV_STORAGE } from '../utils/fixtureEvents.ts';
import { loadFromStorage, saveToStorage } from '../services/storageService.ts';
import { CHEQUEOS_PRESION_KEY } from '../constants/storage-keys.ts';

import { SR_ONLY_STYLE } from '../../../components/shared/sharedStyles.ts';
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
  const tablaRef = useStickyThead2Offset();
  const { tramosAf, tramosAc, updTramoAf, updTramoAc } = useTramos();
  const { proy } = useProyecto();
  const { plans } = usePlans();

  const tramos = isAf(networkType) ? tramosAf : tramosAc;
  // Asegura claves = carga (propia + heredada) antes de leer totales; idempotente. El
  // listener re-corre cuando otra superficie escribe conteos (auditoría #5: la primera
  // pintura pre-propagación mostraba solo-propios y quedaba congelada hasta remontar).
  // Guarda anti-loop: la propagación despacha EV_STORAGE siempre (aunque no cambie nada);
  // solo se re-corre si la firma del disco cambió desde la última corrida.
  const firmaRef = useRef('');
  const [propTick, setPropTick] = useState(0);
  useEffect(() => {
    const correr = (): void => {
      let firma = '';
      try {
        firma = localStorage.getItem('civilflow_aparatos_by_tramo_v2') || '';
      } catch {
        return;
      }
      if (firma === firmaRef.current && firmaRef.current !== '') return;
      firmaRef.current = firma;
      propagarAparatosPresion(networkType);
      try {
        firmaRef.current = localStorage.getItem('civilflow_aparatos_by_tramo_v2') || '';
      } catch {
        /* ignorar */
      }
    };
    // El listener se registra ANTES de la corrida inicial: la propagación despacha
    // EV_STORAGE, y sin listener en ese instante nadie invalida los memos que leen los
    // libros de herencia (el montaje quedaba con el libro viejo).
    const h = (): void => setPropTick((x) => x + 1);
    window.addEventListener(EV_STORAGE, h);
    correr();
    return () => window.removeEventListener(EV_STORAGE, h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkType]);
  useEffect(() => {
    if (propTick === 0) return;
    let firma = '';
    try {
      firma = localStorage.getItem('civilflow_aparatos_by_tramo_v2') || '';
    } catch {
      return;
    }
    if (firma === firmaRef.current) return;
    firmaRef.current = firma;
    propagarAparatosPresion(networkType);
    try {
      firmaRef.current = localStorage.getItem('civilflow_aparatos_by_tramo_v2') || '';
    } catch {
      /* ignorar */
    }
  }, [propTick, networkType]);
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
        label: fracAscii(d.nominal),
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
      if (
        avisarDiametroInvalido(
          `El diámetro del ramal no puede ser menor al del accesorio conectado en el extremo ${res.accessoryEnd} (${res.accessoryDiam}). Reduce el diámetro del accesorio o selecciona un ramal mayor.`,
        )
      )
        return;
    }
    // Redes de presión: sin bloqueo salida/entrada (retirado — orig. usuario); la tabla
    // converge los vecinos al mayor vía writeDiametroToDrawing.
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

  // Libros de propagación (heredados/fold) leídos con UNA sola parseada por store: antes
  // eran N (una por tramo). Depende de propTick porque la propagación escribe desde el
  // efecto de arriba — sin esto, el primer render tras reingresar queda con el libro viejo
  // (el montante suma un aparato de más y cada tramo muestra el del vecino) hasta que una
  // selección cambia la identidad de `tramos` y el memo se recalcula por casualidad.
  const librosProp = useMemo(() => {
    const { her, fold } = leerLibrosPresion();
    const hm: Record<string, Record<string, number>> = {};
    const fm: Record<string, Record<string, number>> = {};
    for (const t of tramos) {
      if (!t._aparatosKey) continue;
      const k = t._aparatosKey;
      const own = t._key || t.id;
      hm[own] = her[k] || {};
      fm[own] = fold[k] || {};
    }
    return { hm, fm };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tramos, propTick]);

  // UD propia = carga − heredada del libro: lo nacido en el tramo más lo plegado por
  // sus tributarios (orig. usuario: lo propagado por tributarios cuenta en propia).
  // El plegado vive DENTRO de la carga, así que no se resta aparte.
  const propiaMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tramos) {
      const key = t._key || t.id;
      const hered = librosProp.hm[key] || {};
      let hUc = 0;
      for (const d of AP) hUc += (hered[d.id] || 0) * (Number(d.uc) || 0);
      m[key] = Math.max(0, calcUCparcial(t, AP, 'uc') - hUc);
    }
    return m;
  }, [tramos, AP, librosProp]);

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
  // Presión residual mínima exigida al final de la acometida (montante): la del aparato más
  // desfavorable del país (pMinAparato) — editable por el usuario.
  const [acoPResMin, setAcoPResMin] = useState(() => perfilDe(proy?.pais).af.pMinAparato);
  // Al cambiar de país se retoma el mínimo normativo (no se pisan ediciones manuales del mismo país).
  const paisVisto = useRef(proy?.pais);
  useEffect(() => {
    if (paisVisto.current !== proy?.pais) {
      paisVisto.current = proy?.pais;
      setAcoPResMin(perfilDe(proy?.pais).af.pMinAparato);
    }
  }, [proy?.pais]);

  const handleContDiamChange = React.useCallback(
    (dNom: string) => {
      writeContadorDiamToDrawing(dNom, plans, networkType);
    },
    [plans, networkType],
  );

  // Tramos reales dibujados (tr1 red→contador, tr2 contador→montante) con fallback a
  // manuales; antes en useAcometidaParams de un solo uso — inline aquí (ponytail).
  const tr1 = useMemo(
    () => (isAf(networkType) ? (tramos.find((t) => isAC1(t)) ?? null) : null),
    [tramos, networkType],
  );
  const tr2 = useMemo(
    () => (isAf(networkType) ? (tramos.find((t) => isAC2(t)) ?? null) : null),
    [tramos, networkType],
  );
  const resolvedMonName = useMemo(() => {
    if (tr2) {
      const iniStr = typeof tr2.ini === 'string' ? tr2.ini : '';
      const finStr = typeof tr2.fin === 'string' ? tr2.fin : '';
      if (isContador(iniStr)) return finStr || acoMonName;
      if (isContador(finStr)) return iniStr || acoMonName;
      return iniStr || finStr || acoMonName;
    }
    return acoMonName;
  }, [tr2, acoMonName]);
  const resolvedContMonDiam = useMemo(() => {
    if (tr2) {
      const ownKey = tr2._key || tr2.id;
      if (diamNomMap[ownKey]) return diamNomMap[ownKey];
      if (tr2.diametroOriginal) {
        const match = diamTable.find((o) => tr2.diametroOriginal?.startsWith(o.nominal));
        if (match) return match.nominal;
      }
      const match = diamTable.find((o) => Math.abs(o.pulg - (tr2.diamDisPulg ?? 0)) < 0.01);
      if (match) return match.nominal;
    }
    const fallbackPulg = acoContMonDiam || 0.75;
    const match = diamTable.find((o) => Math.abs(o.pulg - fallbackPulg) < 0.01);
    return match ? match.nominal : '3/4" RDE 11';
  }, [tr2, diamNomMap, acoContMonDiam, diamTable]);
  const resolvedRedContDiam = resolvedContMonDiam;
  const resolvedL1 = useMemo(() => {
    if (tr1) {
      const opt = resolvedRedContDiam
        ? diamTable.find((d) => d.nominal === resolvedRedContDiam)
        : null;
      const realPulg = opt ? opt.pulg : tr1.diamDisPulg || 0;
      const cHW = matHazenC(tr1.material || '') ?? 150;
      const le = calcLeAcces(tr1.accesorios ?? {}, realPulg, cHW);
      return { h: tr1.totalL || tr1.Lh || 0, v: 0.0, le };
    }
    return acoL1;
  }, [tr1, acoL1, resolvedRedContDiam, diamTable]);
  const resolvedL2 = useMemo(() => {
    if (tr2) {
      const opt = resolvedContMonDiam
        ? diamTable.find((d) => d.nominal === resolvedContMonDiam)
        : null;
      const realPulg = opt ? opt.pulg : tr2.diamDisPulg || 0;
      const cHW = matHazenC(tr2.material || '') ?? 150;
      const le = calcLeAcces(tr2.accesorios ?? {}, realPulg, cHW);
      return { h: tr2.totalL || tr2.Lh || 0, v: 0.0, le };
    }
    return acoL2;
  }, [tr2, acoL2, resolvedContMonDiam, diamTable]);
  const isTr1Drawn = !!tr1;
  const isTr2Drawn = !!tr2;

  const contadorSel = CONTADORES_CAT[acoContIx] || CONTADORES_CAT[0];

  // Solo filas no-tributarias: el tributario no tiene fila y su carga ya vive plegada
  // en la propia del padre (sumarlo duplicaría).
  const ucTotal = useMemo(() => {
    let s = 0;
    for (const t of tramos) {
      if (t.tipo === 'tributario') continue;
      const key = t._key || t.id;
      s += propiaMap[key] || 0;
    }
    return s;
  }, [tramos, propiaMap]);

  const Qaco = useMemo(() => {
    if (tr2) {
      const ownKey = tr2._key || tr2.id;
      const qTr2 = hunterQ(componentTotalMap[ownKey] || 0, tr2.nSalidas || 0);
      if (qTr2 > 0) {
        return qTr2;
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
  const pResidual = f2.Pfin;
  const okPresion = f2.Pfin >= acoPResMin;

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

  // Persistir el checkpoint de velocidad (y, para AF, el de presión de acometida) en cada Tramo
  // para que InfTab muestre una insignia real OK/Revisar en lugar de nada.
  useEffect(() => {
    // Chequeos del pase actual → store plano que Informes lee SIN visitar esta página
    // (gate global de informes; writeDiametroToDrawing lo invalida por red al editar).
    const chequeos: Record<string, { velCumple: boolean; presionOk: boolean; qLps: number }> = {};
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
      const vMinMms = perfilDe(proy.pais).af.vMin * 1000;
      const vMaxMms = perfilDe(proy.pais).af.vMax * 1000;
      const velCumple = c.Vmms > 0 ? c.Vmms >= vMinMms && c.Vmms <= vMaxMms : true;
      if (t.velCumple !== velCumple) updTramo(ownKey, 'velCumple', velCumple);
      let presionOkT: boolean;
      if (isAf(networkType)) {
        presionOkT = okPresion;
        if (t.presionOk !== okPresion) updTramo(ownKey, 'presionOk', okPresion);
      } else {
        // AC: presionOk = chequeo de presión del aparato conectado (sin aparato o sin
        // presión resuelta → chequeo vacío → true, no penaliza la insignia).
        const resuelto = pressureByKey[ownKey];
        // Mismo fallback que DesignTableRow (pRed, no 0): una sola semántica de chequeo.
        const chkP = chequeoPresionAparato(
          t.ini,
          t.fin,
          resuelto?.Pin ?? pRed,
          resuelto?.Pfin ?? pRed,
        );
        presionOkT = chkP !== 'NO';
        if (t.presionOk !== presionOkT) updTramo(ownKey, 'presionOk', presionOkT);
      }
      if (t.qLps !== Qprob) updTramo(ownKey, 'qLps', Qprob);
      chequeos[ownKey] = { velCumple, presionOk: presionOkT, qLps: Qprob };
    }
    const prevChequeos = loadFromStorage<Record<string, typeof chequeos>>(CHEQUEOS_PRESION_KEY, {});
    saveToStorage(CHEQUEOS_PRESION_KEY, { ...prevChequeos, [networkType]: chequeos });
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
    proy.pais,
    pressureByKey,
    updTramo,
    pRed,
  ]);

  // Edición POR TABLA de la acometida (ped. usuario): cada sección, su EDITAR/LISTO.
  const [edit1, setEdit1] = useState(false);
  const [edit2, setEdit2] = useState(false);
  const [edit3, setEdit3] = useState(false);
  const acometidaEl = isAf(networkType) && !hideAcometida && (
    <Acometida
      edit1={edit1}
      setEdit1={setEdit1}
      edit2={edit2}
      setEdit2={setEdit2}
      edit3={edit3}
      setEdit3={setEdit3}
      onTr1DiamChange={(nominal) => {
        if (tr1) handleDiamChange(tr1._key || tr1.id, nominal);
      }}
      onTr2DiamChange={(nominal) => {
        if (tr2) handleDiamChange(tr2._key || tr2.id, nominal);
      }}
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
      acoPResMin={acoPResMin}
      setAcoPResMin={setAcoPResMin}
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
              <table
                ref={tablaRef}
                className="tbl"
                style={{ fontSize: 10.5, tableLayout: 'auto', width: '100%' }}
              >
                <caption style={SR_ONLY_STYLE}>{`Diseño de red ${title}`}</caption>

                <DesignTableHeader cssClass={cssClass} pais={proy.pais} />
                <tbody>
                  {tramosOrden.length === 0 && <EmptyRow colSpan={23} fontSize={10.5} />}
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
                      velLim={[
                        perfilDe(proy.pais).af.vMin * 1000,
                        perfilDe(proy.pais).af.vMax * 1000,
                      ]}
                      plans={plans}
                      updTramo={updTramo}
                      net={networkType}
                      pais={proy.pais}
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
