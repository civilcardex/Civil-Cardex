/** Cumplimiento de la red san (Sanitaria) para el resumen del Informe: filas con dato
 *  hidráulico y chips de fallo (tramos fuera de rango + filas 'No cumple' de la tabla de
 *  bajantes aguas negras/vent). Ej: BAN1 con velocidad 5 m/s → fallosSanLabs incluye 'BAN1-P2'. */
import { useMemo } from 'react';
import type { MemoriaTable } from '../../../utils/exportReportFinal.ts';
import type { PerfNormas } from '../../../constants/countryStandards';
import type { SanRow } from '../../../utils/sanitaryRows.ts';
import { etiq, fallosDeTabla, filaEnRangoSanLl, filaFalla } from './complianceShared.ts';

/** Fallos y estado de la red san; lo consumen el candado de descarga (allOk) y la fila
 *  SANITARIA del resumen. */
export function useSanCumple(args: {
  sanRowsCalc: SanRow[] | null;
  bajVentSanTable: MemoriaTable | null;
  perfil: PerfNormas;
}) {
  const { sanRowsCalc, bajVentSanTable, perfil } = args;
  // Filas CON dato hidráulico (Vreal>0 ⇒ hubo Q, pendiente, Manning y diámetro): los flags
  // v_real de la página ya no intervienen en el gate ni en el semáforo.
  const conDatosSan = (sanRowsCalc ?? []).filter((r) => r.Vreal > 0);
  // SAN: rango (V/Yn/D, q/Q0) + chequeos de la tabla (velocidad, tiro Yn, fuerza tractiva).
  // Las filas de computeSanRows ya excluyen tributarios y bajantes.
  const fallosSan = useMemo(
    () => [
      ...conDatosSan
        .filter((r) => !filaEnRangoSanLl(r, perfil))
        .map((r) => ({ id: r.id, piso: r.piso })),
      ...(sanRowsCalc ?? []).filter(filaFalla).map((r) => ({ id: r.id, piso: r.piso })),
    ],
    [conDatosSan, sanRowsCalc, perfil],
  );
  /** Chips SAN (Sanitaria) = fallos de tramos + filas 'No cumple' de la tabla de bajantes
   *  aguas negras/vent (Ventilacion). Se calcula una vez y lo usan tanto el candado de
   *  descargas (allOk) como la fila SAN del resumen. */
  const fallosSanLabs = useMemo(
    () => [
      ...fallosSan.map((t) => etiq(t.id, t.piso)),
      ...fallosDeTabla(bajVentSanTable, (row) => (row[1] && row[1] !== '—' ? String(row[1]) : '')),
    ],
    [fallosSan, bajVentSanTable],
  );
  return { conDatosSan, fallosSanLabs };
}
