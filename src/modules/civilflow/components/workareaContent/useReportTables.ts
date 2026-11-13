/** Tablas y estado del Informe (pestaña Informe): agrega las tablas de todas las redes (san/ll/af/ac/gas/bom/ep), los items de resumen y el estado global de cumplimiento. Ej: allOk=true solo si toda red activa pasó sus chequeos. */
import { useMemo } from 'react';
import { useSanTables } from './useSanTables.ts';
import { useLlTables } from './useLlTables.ts';
import { useAfTables } from './useAfTables.ts';
import { useAcTables } from './useAcTables.ts';
import { useRciInforme } from './useRCIReport.ts';
import { pisoLbl } from '../../constants';
import { useRainwater } from '../../context/RainwaterContext.tsx';
import { perfilDe } from '../../constants/countryStandards';
import { epAlertas } from '../../utils/equipmentRows.ts';
import {
  useSanCumple,
  useLlCumple,
  usePresionAfAc,
  useGasInforme,
  useEquiposInforme,
  etiq,
  fallosDeTabla,
} from './reportTables/index.ts';
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
  const hasRci = redesActivas.some((r) => r.id === 'rci');
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

  // Bloque RCI del informe: estado guardado en BD + motor corrido en fresco (useRciInforme).
  const rciInf = useRciInforme(hasRci);

  // ── Cumplimiento por red ──
  // El juicio de cada red (fallos, sin verificar, OK) vive en reportTables/: este hook los
  // ensambla en el candado de descarga (allOk) y en las filas del resumen.
  const { conDatosSan, fallosSanLabs } = useSanCumple({ sanRowsCalc, bajVentSanTable, perfil });
  const {
    conDatosLl,
    fallosLl,
    fallosBajLl,
    pisoDeBajLl,
    fallosCanalLl,
    fallosCanalSinVerificar,
    fallosBajSinVerificar,
    canalSinVerificarHay,
    bajSinVerificarHay,
  } = useLlCumple({
    llRowsCalc,
    tramosLl,
    bajantesLl,
    canalesLl,
    plans,
    pisos,
    perfil,
  });
  const {
    tramosAfJ,
    tramosAcJ,
    okAF,
    okAC,
    fallosAf,
    fallosAc,
    sinVerificarAf,
    sinVerificarAc,
    acometidaOk,
  } = usePresionAfAc({ plans, tramosAf, tramosAc, pais: proy.pais, perfil });
  const { gasRowsCalc, gasTable, fallosGas } = useGasInforme({ hasGas, plans, pais: proy.pais });
  const { alertasBomba, buildBombaTables, buildEpTables } = useEquiposInforme({
    hasBom,
    hasEp,
    pais: proy.pais,
  });

  const hasCheckedNet = hasSan || hasLl || hasAf || hasAc || hasGas || hasEp || hasBom || hasRci;
  // Gate ÚNICO: derivado de los mismos labs que alimentan el resumen (auditoría F-4).
  // Sin verificar (materiales sin elegir): la tabla no chequea, pero no es OK. Los chips se
  // calculan UNA vez — son insumo del gate Y de la lista del resumen (antes vivían 2 veces).
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
    (!hasBom || alertasBomba === null || alertasBomba.length === 0) &&
    // RCI: sin datos guardados no bloquea (paralelo a gas con 0 filas); con datos, alguna
    // verificación NO CUMPLE sí bloquea la descarga.
    (!hasRci || rciInf === null || rciInf.fallos.length === 0);

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
    if (hasRci)
      rows.push([
        'CONTRA INCENDIO',
        rciInf === null ? '◌ Sin calcular' : rciInf.fallos.length === 0 ? '✓ OK' : '✗ Revisar',
        rciInf?.fallos ?? [],
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
    hasRci,
    rciInf,
    sinVerificarAf,
    sinVerificarAc,
  ]);
  const estadoLabel = !hasCheckedNet
    ? '—'
    : allOk
      ? '✓ Listo para descargar'
      : '✗ Revisar redes con errores';
  const estadoColor = !hasCheckedNet ? 'var(--txt3)' : allOk ? 'var(--ok)' : 'var(--err)';

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
    hasRci,
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
    rciTable: rciInf?.tabla ?? null,
    hasCheckedNet,
    allOk,
    items,
    estadoLabel,
    estadoColor,
    buildBombaTables,
    buildEpTables,
  };
}
