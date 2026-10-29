import { useCallback, useMemo } from 'react';
import { useSanTables } from './useSanTables.ts';
import { useLlTables } from './useLlTables.ts';
import { useAfTables } from './useAfTables.ts';
import { useAcTables } from './useAcTables.ts';
import type { MemoriaTable } from '../../utils/exportReportFinal.ts';
import { pisoLbl, pisoCorto, AF_UC_IDS, AC_UC_IDS } from '../../constants';
import { isAC2 } from '../../utils/waterRowsShared.ts';
import { useRainwater } from '../../context/RainwaterContext.tsx';
import { DIAMETROS_AF, DIAMETROS_AC } from '../../constants/hydraulicsData.ts';
import { computeDesignRow, hunterQ } from '../waterNetworkDesign/rowPhysics.ts';
import { useWaterNetworkGraph } from '../waterNetworkDesign/useWaterNetworkGraph.ts';
import { loadFromStorage } from '../../services/storageService.ts';
import { CHEQUEOS_PRESION_KEY } from '../../constants/storage-keys.ts';
import { computeAcometidaSummary } from '../../utils/waterNetworkRows.ts';
import { lookupInterno, lookupInternoAC } from '../../utils/fittingsUtils.ts';
import { computeBombaTables, computeEpTables } from '../../utils/equipmentRows.ts';
import { computeGasRows } from '../../utils/gasRows.ts';
import { epAlertas, bombaAlertas } from '../../utils/equipmentRows.ts';
import {
  chequeoCanalLluvia,
  BORDE_LIBRE_CANAL_CM,
  chequeoBajanteLluvia,
} from '../../utils/calcRainwater.ts';
import { nDeCanal, cDeCubierta } from '../../constants/engineeringDataMaterials.ts';
import { perfilDe } from '../../constants/countryStandards';
import type { Tramo } from '../../context/tramosReducer';
import type { useWorkAreaState } from '../useWorkAreaState.ts';

type WorkAreaState = ReturnType<typeof useWorkAreaState>;

export function useInfTablas(state: WorkAreaState) {
  const {
    proy,
    redesActivas,
    pisos,
    plans,
    confirmedPlanos,
    tramosSan,
    tramosLl,
    tramosAf,
    tramosAc,
    aps,
    udBase,
  } = state;
  const { bajantesLl, canalesLl, conRecolectora } = useRainwater();
  const hasSan = redesActivas.some((r) => r.id === 'san');
  const hasLl = redesActivas.some((r) => r.id === 'll');
  const hasAf = redesActivas.some((r) => r.id === 'af');
  const hasAc = redesActivas.some((r) => r.id === 'ac');
  const hasGas = redesActivas.some((r) => r.id === 'gas');
  const hasBom = redesActivas.some((r) => r.id === 'bom');
  const hasEp = redesActivas.some((r) => r.id === 'ep');
  // Rangos por país (normasPais) — identificación del proyecto.
  const perfil = perfilDe(proy.pais);

  const f2 = (n: number) => (n > 0 ? n.toFixed(2) : '—');

  // ── SAN ──
  // Las tablas de cada red viven en su propio hook (useSanTables/useLlTables/useAfTables/
  // useAcTables): este hook las compone con las de gas y la lista final.
  const san = useSanTables({
    pisos,
    plans,
    tramosSan,
    aps,
    udBase,
    hasSan,
    hasLl,
    hasAf,
    hasAc,
  });
  const {
    sanMergedBase,
    ucSanTable,
    bajVentSanTable,
    sanAccTable,
    tuberiasSanTable,
    tuberiasLlTable,
    tuberiasAfTable,
    tuberiasAcTable,
    sanRowsCalc,
    sanTable,
  } = san;
  const ll = useLlTables({
    plans,
    tramosLl,
    bajantesLl,
    canalesLl,
    conRecolectora,
    hasLl,
  });
  const { llRowsCalc, llTable, llBajTable, llCanalTable } = ll;
  const af = useAfTables({ proy, plans, tramosAf, aps, hasAf });
  const { buildAcometidaTables, ucAfTable, accAfTable, accAfDiamTable, afTable } = af;
  const ac = useAcTables({ proy, plans, tramosAf, tramosAc, aps, hasAc });
  const { ucAcTable, heaterTables, accAcTable, accAcDiamTable, acTable } = ac;

  const gasRowsCalc = useMemo(
    () => (hasGas ? computeGasRows(plans, proy.pais) : []),
    [hasGas, plans, proy.pais],
  );

  const gasTable = useMemo<MemoriaTable | null>(() => {
    if (!hasGas) return null;
    const rows = gasRowsCalc;
    if (rows.length === 0) return null;
    return {
      title: 'Diseño de red de gas',
      headers: [
        'Tramo',
        'Nivel',
        'Inicio',
        'Final',
        'Material',
        'DN',
        'D int (mm)',
        'K',
        'Long (m)',
        'Q consumo (m³/h)',
        'F. altitud',
        'F. temperatura',
        'F. densidad rel.',
        'Q diseño (m³/h)',
        'Le (m)',
        'ΔP (mbar)',
        'ΔP acum (mbar)',
        'Vel (m/s)',
        'Pres. ini (mbar)',
        'Pres. fin (mbar)',
        'Chequeo',
      ],
      rows: rows.map((r) => [
        r.id,
        pisoCorto(r.piso),
        r.ini,
        r.fin,
        r.material || '—',
        r.dn || '—',
        r.dInt > 0 ? r.dInt.toFixed(2) : '—',
        r.K > 0 ? String(r.K) : '—',
        r.longitud > 0 ? r.longitud.toFixed(2) : '—',
        r.qConsumo.toFixed(2),
        r.fAlt.toFixed(2),
        r.fTemp.toFixed(2),
        r.fDens.toFixed(2),
        r.qDiseno.toFixed(2),
        r.le.toFixed(2),
        r.dP.toFixed(2),
        r.dPAcum.toFixed(2),
        r.vel.toFixed(2),
        r.pIni.toFixed(2),
        r.pFin.toFixed(2),
        r.chequeo,
      ]),
    };
  }, [hasGas, gasRowsCalc]);

  /** Revisa si una fila ya calculada cumple los rangos (velocidad, tirante, caudal lleno):
   *  la misma regla de rangos del país, aplicada AQUÍ en fresco sobre las filas de
   *  computeSanRows/computeLlRows — antes dependía de banderas que solo escribía la
   *  página de Diseño de redes. */
  const filaEnRangoSanLl = useCallback(
    (r: { Vreal: number; Yc: number; Yn: number; DintMm: number; qqo: number }): boolean =>
      r.Vreal >= perfil.san.vMin &&
      r.Vreal <= perfil.san.vMax &&
      r.DintMm > 0 &&
      // yD de la página = max(Yc, Yn)/D (el tiro de DISEÑO manda en flujo supercrítico) —
      // usar solo Yn era más laxo exactamente donde importa.
      Math.max(r.Yc, r.Yn) / r.DintMm <= perfil.san.ydMax &&
      r.qqo <= 1.0,
    [perfil],
  );
  // Filas CON dato hidráulico (Vreal>0 ⇒ hubo Q, pendiente, Manning y diámetro): los flags
  // v_real de la página ya no intervienen en el gate ni en el semáforo.
  const conDatosSan = (sanRowsCalc ?? []).filter((r) => r.Vreal > 0);
  const conDatosLl = (llRowsCalc ?? []).filter((r) => r.Vreal > 0);
  const noTrib = useCallback((t: { tipo?: string }) => t.tipo !== 'tributario', []);
  /** Fallo de tabla: fila cuya verificación dice 'NO CUMPLE' (las '—' son filas sin datos, no fallos). */
  const filaFalla = useCallback(
    (r: {
      chequeoV: string;
      chequeoYn: string;
      chequeoFT: string;
      chequeoD?: string;
      Q?: number | null;
      DcalcPulg?: number;
      DdisPulg?: number;
    }): boolean =>
      r.chequeoV === 'NO CUMPLE' ||
      r.chequeoYn === 'NO CUMPLE' ||
      r.chequeoFT === 'NO CUMPLE' ||
      // Chequeo de diámetro de LLUVIAS (title-case): solo con datos completos.
      (r.chequeoD === 'No cumple' &&
        Number(r.Q ?? 0) > 0 &&
        Number(r.DcalcPulg ?? 0) > 0 &&
        Number(r.DdisPulg ?? 0) > 0),
    [],
  );
  // Ubicación de fallos (ped. usuario): etiqueta `${id}-${piso}` de cada elemento que incumple.
  const etiq = (id: unknown, piso: number | undefined): string => {
    const raw = String(id ?? '?');
    const corto = raw.length > 10 ? `${raw.slice(0, 4)}…` : raw;
    return `${corto}-${pisoCorto(Number(piso ?? 0))}`;
  };
  /** Fallos leídos de una MemoriaTable: filas donde una columna /chequeo/i dice 'No cumple'.
   *  sufijoDe: nivel del elemento (ej. row[1]='P2' en bajantes aguas negras) → chip `BAN1-P2`. */
  const fallosDeTabla = useCallback(
    (tbl: MemoriaTable | null, sufijoDe?: (row: unknown[]) => string): string[] => {
      if (!tbl) return [];
      const idxCh: number[] = [];
      tbl.headers.forEach((h, i) => {
        if (/chequeo/i.test(String(h))) idxCh.push(i);
      });
      if (idxCh.length === 0) return [];
      const out: string[] = [];
      for (const row of tbl.rows) {
        if (idxCh.some((i) => /^no cumple$/i.test(String(row[i] ?? '').trim()))) {
          const suf = sufijoDe?.(row) ?? '';
          out.push(suf ? `${String(row[0] ?? '—')}-${suf}` : String(row[0] ?? '—'));
        }
      }
      return out;
    },
    [],
  );
  // SAN: rango (V/Yn/D, q/Q0) + chequeos de la tabla (velocidad, tiro Yn, fuerza tractiva).
  // Las filas de computeSanRows ya excluyen tributarios y bajantes.

  const fallosSan = useMemo(
    () => [
      ...conDatosSan.filter((r) => !filaEnRangoSanLl(r)).map((r) => ({ id: r.id, piso: r.piso })),
      ...(sanRowsCalc ?? []).filter(filaFalla).map((r) => ({ id: r.id, piso: r.piso })),
    ],
    [conDatosSan, sanRowsCalc, filaEnRangoSanLl, filaFalla],
  );
  /** Chips SAN (Sanitaria) = fallos de tramos + filas 'No cumple' de la tabla de bajantes
   *  aguas negras/vent (Ventilacion). Se calcula una vez y lo usan tanto el candado de
   *  descargas (allOk) como la fila SAN del resumen. */
  const fallosSanLabs = useMemo(
    () => [
      ...fallosSan.map((t) => etiq(t.id, t.piso)),
      ...fallosDeTabla(bajVentSanTable, (row) => (row[1] && row[1] !== '—' ? String(row[1]) : '')),
    ],
    [fallosSan, fallosDeTabla, bajVentSanTable],
  );
  // LL: rango + chequeos de tabla + bajantes + canales. Filas ya sin tributarios/bajantes.
  const fallosLl = useMemo(
    () => [
      ...conDatosLl.filter((r) => !filaEnRangoSanLl(r)).map((r) => ({ id: r.id, piso: r.piso })),
      ...(llRowsCalc ?? []).filter(filaFalla).map((r) => ({ id: r.id, piso: r.piso })),
    ],
    [conDatosLl, llRowsCalc, filaEnRangoSanLl, filaFalla],
  );
  // Semáforo y chips juzgan el MISMO conjunto (solo ramales — sin tributarios): si dice
  // 'Revisar', los chips de fallo aparecen al lado (ped. usuario).
  const tramosAfJ = useMemo(() => tramosAf.filter(noTrib), [tramosAf, noTrib]);
  const tramosAcJ = useMemo(() => tramosAc.filter(noTrib), [tramosAc, noTrib]);
  // Chequeos de presión SIN depender de visitar Diseño de redes: la página persiste sus
  // resultados en CHEQUEOS_PRESION_KEY; Informes hidrata de ahí y RECALCULA la velocidad
  // en frío (qLps persistido es flujo — no depende del diámetro — y el diámetro efectivo
  // sale del tramo actual). presionOk = último chequeo persistido (cadena de acometida).
  const chequeosPresion = loadFromStorage<
    Record<string, Record<string, { velCumple?: boolean; presionOk?: boolean; qLps?: number }>>
  >(CHEQUEOS_PRESION_KEY, {});
  const afOpts = useMemo(
    () => DIAMETROS_AF.map((d) => ({ pulg: d.pulg, nominal: d.nominal, dInt: d.dInt })),
    [],
  );
  const acOpts = useMemo(
    () => DIAMETROS_AC.map((d) => ({ pulg: d.pulg, nominal: d.nominal, dInt: d.dInt })),
    [],
  );
  // Grafo de conectividad AF/AC en frío: Informes calcula su PROPIO qLps (hunterQ sobre los
  // UC acumulados) — la velocidad no depende de haber visitado Diseño de redes, ni del store
  // (los aparatos cambian desde el panel sin pasar por la página).
  const graphAf = useWaterNetworkGraph({
    plans,
    tramos: tramosAf,
    networkType: 'af',
    ucIds: AF_UC_IDS,
    ucField: 'uc_af',
  });
  const graphAc = useWaterNetworkGraph({
    plans,
    tramos: tramosAc,
    networkType: 'ac',
    ucIds: AC_UC_IDS,
    ucField: 'uc_ac',
  });
  const tr2Af = useMemo(() => tramosAf.find((t) => isAC2(t)) ?? null, [tramosAf]);
  const qacoAf = useMemo(() => {
    if (tr2Af) {
      const key = tr2Af._key || tr2Af.id;
      const q = hunterQ(graphAf.componentTotalMap[key] || 0, tr2Af.nSalidas || 0);
      if (q > 0) return q;
    }
    return 0;
  }, [tr2Af, graphAf.componentTotalMap]);
  /** Velocidad (recalculada con el diámetro actual) y presión (guardada del último cálculo)
   *  de un tramo de presión (af/ac). null = sin dato → chip "(sin verificar)" y la fila
   *  queda en Revisar. */
  const chequeoDe = useCallback(
    (t: Tramo, net: 'af' | 'ac'): { vel: boolean | null; pres: boolean | null } => {
      const key = t._key || t.id;
      const stored = chequeosPresion[net]?.[key];
      // Caudal fresco del grafo (tr2 usa el Qaco de la red); el store solo como red de
      // seguridad si el grafo no alcanza a calcularlo.
      const totalAcum = (net === 'af' ? graphAf : graphAc).componentTotalMap[key] || 0;
      const qFresco =
        net === 'af' && tr2Af && (tr2Af._key || tr2Af.id) === key
          ? qacoAf
          : hunterQ(totalAcum, t.nSalidas || 0);
      const qLps = qFresco > 0 ? qFresco : (stored?.qLps ?? t.qLps ?? 0);
      let vel: boolean | null = null;
      if (qLps > 0) {
        const c = computeDesignRow(t, {
          qprob: qLps,
          diamOpts: net === 'af' ? afOpts : acOpts,
          diamNomMap: {},
          diamIntMap: {},
          lookupFn: (net === 'af' ? lookupInterno : lookupInternoAC) as (pulg: number) => number,
        });
        const vMinMms = perfil.af.vMin * 1000;
        const vMaxMms = perfil.af.vMax * 1000;
        vel = c.Vmms > 0 ? c.Vmms >= vMinMms && c.Vmms <= vMaxMms : null;
      }
      const pres =
        typeof stored?.presionOk === 'boolean'
          ? stored.presionOk
          : typeof t.presionOk === 'boolean'
            ? t.presionOk
            : null;
      return { vel, pres };
    },
    [chequeosPresion, afOpts, acOpts, perfil, graphAf, graphAc, tr2Af, qacoAf],
  );
  const estadoPresionDe = useCallback(
    (tramos: typeof tramosAfJ, net: 'af' | 'ac') => {
      const conFallos: typeof tramos = [];
      const sinVerificar: typeof tramos = [];
      for (const t of tramos) {
        // Montante fuera (orig. usuario): sin verificación propia, bloqueaba la descarga como "MAC1_ac-P2 (sin verificar)".
        if (t.tipo === 'montante') continue;
        const c = chequeoDe(t, net);
        if (c.vel === false || c.pres === false) conFallos.push(t);
        else if (c.vel === null || c.pres === null) sinVerificar.push(t);
      }
      return { conFallos, sinVerificar };
    },
    [chequeoDe],
  );
  const cheqAf = useMemo(() => estadoPresionDe(tramosAfJ, 'af'), [estadoPresionDe, tramosAfJ]);
  const cheqAc = useMemo(() => estadoPresionDe(tramosAcJ, 'ac'), [estadoPresionDe, tramosAcJ]);
  const sinVerificarAf = cheqAf.sinVerificar;
  const sinVerificarAc = cheqAc.sinVerificar;
  const okAF =
    tramosAfJ.length > 0 && cheqAf.conFallos.length === 0 && cheqAf.sinVerificar.length === 0;
  const okAC =
    tramosAcJ.length > 0 && cheqAc.conFallos.length === 0 && cheqAc.sinVerificar.length === 0;
  const fallosAf = cheqAf.conFallos;
  const fallosAc = cheqAc.conFallos;
  // Mismos insumos que la MemoriaTable (rainDownpipesRows): C derivado del material y
  // manning con default 0.009 — sin esto el resumen juzga con otra fórmula que la tabla.
  // Sin filtro de área: con área 0 el chequeo ya sale '' (Q=0 → dCalc=0), el filtro sobra.
  const fallosBajLl = useMemo(
    () =>
      bajantesLl.filter(
        (b) =>
          chequeoBajanteLluvia({
            ...b,
            areaAcumulada: b.areaAcumulada || 0,
            coeficienteC: cDeCubierta(b.materialCubierta ?? '') ?? 0,
            manning: b.manning || 0.009,
          }).chequeo === 'No cumple',
      ),
    [bajantesLl],
  );
  // Nivel de cada bajante ll desde sus tramos esBajante (BajanteLl no trae piso).
  // Key por CODE visible (la tabla usa row[0]=code): ids internos de dibujo no matchean.
  const pisoDeBajLl = useMemo(
    () => new Map(tramosLl.filter((t) => t.esBajante).map((t) => [String(t.code || t.id), t.piso])),
    [tramosLl],
  );
  // Canales: misma fórmula de la tabla (C del material, n del material — sin material no hay chequeo).
  const fallosCanalLl = useMemo(
    () =>
      (canalesLl ?? [])
        .filter((c) => {
          const Cder = cDeCubierta(c.materialCubierta ?? '') ?? 0;
          const nd = nDeCanal(c.materialCanal ?? '');
          if (Cder <= 0 || nd == null) return false;
          return (
            chequeoCanalLluvia({
              ...c,
              coeficienteC: Cder,
              manning: nd,
              muroVertical: c.muroVertical ?? 0,
              bordeLibreCm: c.bordeLibreCm ?? BORDE_LIBRE_CANAL_CM,
            }).chequeo === 'No cumple'
          );
        })
        .map((c) => {
          const piso = plans.find(
            (p) => String(p.id) === String((c as { planId?: unknown }).planId),
          )?.nivel;
          return `${c.sector || 'Canal'}-${pisoCorto(Number(piso ?? 0))}`;
        }),
    [canalesLl, plans],
  );
  // AF: acometida (computeAcometidaSummary estadoOk) — la tabla la marca, el resumen la lista.
  const acometidaOk =
    computeAcometidaSummary(tramosAf, plans, DIAMETROS_AF, proy.pais)?.estadoOk !== false;
  const fallosGas = (gasRowsCalc ?? []).filter((r) => r.chequeo === 'NO');
  // Bomba AR: hoy sin filas cumple/no cumple — gate por presencia de memoria calculada.
  const alertasBomba = useMemo(() => (hasBom ? bombaAlertas() : null), [hasBom]);
  const hasCheckedNet = hasSan || hasLl || hasAf || hasAc || hasGas || hasEp || hasBom;
  // Gate ÚNICO: derivado de los mismos labs que alimentan el resumen (auditoría F-4).
  // Sin verificar (materiales sin elegir): la tabla no chequea, pero no es OK. Los chips se
  // calculan UNA vez — son insumo del gate Y de la lista del resumen (antes vivían 2 veces).
  const nivelCubierta = pisos.find((p) => p.n === 99)?.n ?? 99;
  const fallosCanalSinVerificar = useMemo(
    () =>
      (canalesLl ?? [])
        .filter((c) => {
          const Cder = cDeCubierta(c.materialCubierta ?? '') ?? 0;
          const nd = nDeCanal(c.materialCanal ?? '');
          return Cder <= 0 || nd == null;
        })
        .map((c) => {
          // El canal es de CUBIERTA por definición: nivel = c.piso (glifo) o el piso cubierta.
          return `${c.sector || 'Canal'}-${pisoCorto(Number(c.piso ?? nivelCubierta))} (sin verificar)`;
        }),
    [canalesLl, nivelCubierta],
  );
  // Bajante LL SIN material elegido: la tabla no lo chequea, pero no es OK (paralelo al canal).
  const fallosBajSinVerificar = useMemo(
    () =>
      bajantesLl
        .filter((b) => !b.materialCubierta)
        .map((b) => {
          const code = String(b.bajante || b.id);
          const pid = pisoDeBajLl.get(code);
          return `${code}${pid != null ? '-' + pisoCorto(Number(pid)) : ''} (sin verificar)`;
        }),
    [bajantesLl, pisoDeBajLl],
  );
  const canalSinVerificarHay = fallosCanalSinVerificar.length > 0;
  const bajSinVerificarHay = fallosBajSinVerificar.length > 0;
  // Sin calcular ≠ OK: una red activa sin elementos calculados bloquea la descarga igual que
  // un fallo (mismos umbrales que producen '◌ Sin calcular' en las filas del resumen).
  const allOk =
    hasCheckedNet &&
    (!hasSan || conDatosSan.length > 0) &&
    fallosSanLabs.length === 0 &&
    // Términos de lluvias TODOS bajo hasLl: bajantesLl/canalesLl vienen del espejo del
    // RainwaterContext (persiste en localStorage aunque el proyecto no tenga la red activa)
    // — sin el gate, datos stale de otra red bloqueaban la descarga con todas las filas
    // visibles en verde (reporte: "redes ok pero no deja descargar").
    (!hasLl || conDatosLl.length + bajantesLl.length + (canalesLl?.length ?? 0) > 0) &&
    (!hasLl || fallosLl.length === 0) &&
    (!hasLl || fallosBajLl.length === 0) &&
    (!hasLl || fallosCanalLl.length === 0) &&
    (!hasLl || !canalSinVerificarHay) &&
    (!hasLl || !bajSinVerificarHay) &&
    (!hasAf || okAF) &&
    acometidaOk &&
    (!hasAc || okAC) &&
    (!hasGas || fallosGas.length === 0) &&
    (!hasEp || (epAlertas() ?? []).length === 0) &&
    (!hasBom || alertasBomba === null || alertasBomba.length === 0);

  const items = useMemo<[string, string, string[]?][]>(() => {
    const rows: [string, string, string[]?][] = [
      ['PROYECTO', proy.nombre],
      ['DIRECCIÓN', proy.dir || '—'],
      ['USO', proy.uso],
      ['REDES', redesActivas.map((r) => r.lbl).join(' · ')],
      [
        'NIVELES',
        pisos
          .toSorted((a, b) => a.n - b.n)
          .map((p) => pisoLbl(p.n))
          .join(' · '),
      ],
    ];
    const labs = (fs: { id: unknown; piso?: number }[]) => fs.map((t) => etiq(t.id, t.piso));
    // SAN: chips memoizados (fallos de tramos + filas 'No cumple' de la tabla de bajantes).
    const estadoSan = fallosSanLabs.length
      ? '✗ Revisar'
      : conDatosSan.length > 0
        ? '✓ OK'
        : '◌ Sin calcular';
    const fallosLlLabs2 = [
      ...fallosLl.map((t) => etiq(t.id, t.piso)),
      ...fallosBajLl.map((b) =>
        etiq(b.bajante || b.id, pisoDeBajLl.get(String(b.bajante || b.id))),
      ),
      ...fallosCanalLl,
      ...fallosDeTabla(llBajTable),
      ...fallosCanalSinVerificar,
      ...fallosBajSinVerificar,
    ];
    const estadoLl = fallosLlLabs2.length
      ? '✗ Revisar'
      : conDatosLl.length === 0 && bajantesLl.length === 0 && (canalesLl?.length ?? 0) === 0
        ? '◌ Sin calcular'
        : '✓ OK';
    const fallosDe = (ok: boolean, labs2: string[]): string[] => (ok ? [] : labs2);
    if (hasSan) rows.push(['SANITARIA', estadoSan, fallosSanLabs]);
    if (hasLl)
      rows.push(['AGUAS LLUVIAS', estadoLl, estadoLl === '✗ Revisar' ? fallosLlLabs2 : []]);
    const sinVerificarLabs = (ts: typeof tramosAfJ) =>
      ts.map((t) => `${etiq(t.id, t.piso)} (sin verificar)`);
    const fallosAfLabs = [
      ...labs(fallosAf),
      ...sinVerificarLabs(sinVerificarAf),
      ...(acometidaOk ? [] : ['ACOMETIDA']),
    ];
    if (hasAf)
      rows.push([
        'AGUA FRÍA',
        tramosAfJ.length === 0 ? '◌ Sin calcular' : okAF && acometidaOk ? '✓ OK' : '✗ Revisar',
        fallosDe(okAF && acometidaOk, fallosAfLabs),
      ]);
    const fallosAcLabs = [...labs(fallosAc), ...sinVerificarLabs(sinVerificarAc)];
    if (hasAc)
      rows.push([
        'AGUA CALIENTE',
        tramosAcJ.length === 0 ? '◌ Sin calcular' : okAC ? '✓ OK' : '✗ Revisar',
        fallosDe(okAC, fallosAcLabs),
      ]);
    if (hasGas)
      rows.push([
        'GAS',
        (gasRowsCalc ?? []).length === 0
          ? '◌ Sin calcular'
          : fallosGas.length === 0
            ? '✓ OK'
            : '✗ Revisar',
        fallosGas.map((r) => etiq(r.id, r.piso)),
      ]);
    if (hasEp) {
      const alertasEp = epAlertas();
      rows.push([
        'EQUIPO PRESIÓN',
        alertasEp === null ? '◌ Sin calcular' : alertasEp.length === 0 ? '✓ OK' : '✗ Revisar',
        alertasEp ?? [],
      ]);
    }
    if (hasBom)
      rows.push([
        'BOMBA AR',
        alertasBomba === null ? '◌ Sin calcular' : alertasBomba.length === 0 ? '✓ OK' : '✗ Revisar',
        alertasBomba ?? [],
      ]);
    return rows;
  }, [
    proy,
    redesActivas,
    pisos,
    okAF,
    okAC,
    hasSan,
    hasLl,
    hasAf,
    hasAc,
    hasGas,
    hasEp,
    fallosSanLabs,
    fallosLl,
    fallosAf,
    fallosAc,
    fallosBajLl,
    fallosCanalLl,
    fallosCanalSinVerificar,
    fallosBajSinVerificar,
    fallosGas,
    pisoDeBajLl,
    fallosDeTabla,
    tramosAfJ,
    tramosAcJ,
    llBajTable,
    conDatosSan.length,
    conDatosLl.length,
    bajantesLl,
    canalesLl,
    gasRowsCalc,
    acometidaOk,
    hasBom,
    alertasBomba,
    sinVerificarAf,
    sinVerificarAc,
  ]);
  const estadoLabel = !hasCheckedNet
    ? '—'
    : allOk
      ? '✓ Listo para descargar'
      : '✗ Revisar redes con errores';
  const estadoColor = !hasCheckedNet ? 'var(--txt3)' : allOk ? 'var(--ok)' : 'var(--err)';

  // ── BOMBA / EP ── computeBombaTables/computeEpTables (equipmentRows.ts) reconstruyen cada tabla
  // desde todas las páginas de la pantalla en fresco al momento de descargar — mismo patrón de
  // "sin dependencia de visitar pantallas, sin useMemo obsoleto" que buildAcometidaTables de
  // arriba, y una tabla por tarjeta en vez de un resumen único aplanado (coincide con lo que las
  // pantallas reales BombaARDesign/EPInputPage/EPVerificationPage muestran en sus páginas).
  const buildBombaTables = (): MemoriaTable[] => (hasBom ? computeBombaTables() : []);
  const buildEpTables = useCallback(
    (): MemoriaTable[] => (hasEp ? computeEpTables(proy.pais) : []),
    [hasEp, proy.pais],
  );

  return {
    proy,
    redesActivas,
    pisos,
    tramosSan,
    tramosLl,
    tramosAf,
    tramosAc,
    plans,
    aps,
    udBase,
    confirmedPlanos,
    bajantesLl,
    canalesLl,
    conRecolectora,
    perfil,
    f2,
    sanMergedBase,
    sanRowsCalc,
    llRowsCalc,
    hasSan,
    hasLl,
    hasAf,
    hasAc,
    hasGas,
    hasBom,
    hasEp,
    ucSanTable,
    bajVentSanTable,
    sanAccTable,
    tuberiasSanTable,
    tuberiasLlTable,
    tuberiasAfTable,
    tuberiasAcTable,
    sanTable,
    llTable,
    llBajTable,
    llCanalTable,
    ucAfTable,
    accAfTable,
    accAfDiamTable,
    afTable,
    buildAcometidaTables,
    ucAcTable,
    heaterTables,
    accAcTable,
    accAcDiamTable,
    acTable,
    gasTable,
    hasCheckedNet,
    allOk,
    items,
    estadoLabel,
    estadoColor,
    buildBombaTables,
    buildEpTables,
  };
}
