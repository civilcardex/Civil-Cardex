/** Tablas de los equipos del Informe: bom (Bomba) y ep (Equipo de Presion). computeBombaTables/
 *  computeEpTables (equipmentRows.ts) reconstruyen cada tabla desde todas las páginas de la
 *  pantalla en fresco al momento de descargar — mismo patrón de "sin dependencia de visitar
 *  pantallas, sin useMemo obsoleto" que buildAcometidaTables, y una tabla por tarjeta en vez
 *  de un resumen único aplanado (coincide con lo que las pantallas reales
 *  BombaARDesign/EPInputPage/EPVerificationPage muestran en sus páginas). */
import { useCallback, useMemo } from 'react';
import type { MemoriaTable } from '../../../utils/exportReportFinal.ts';
import { computeBombaTables, computeEpTables, bombaAlertas } from '../../../utils/equipmentRows.ts';
import type { useWorkAreaState } from '../../useWorkAreaState.ts';

type WorkAreaState = ReturnType<typeof useWorkAreaState>;

/** Builders de tablas bom/ep + alertas de bomba para el resumen. */
export function useEquiposInforme(args: {
  hasBom: boolean;
  hasEp: boolean;
  pais: WorkAreaState['proy']['pais'];
}) {
  const { hasBom, hasEp, pais } = args;
  // Bomba AR: hoy sin filas cumple/no cumple — gate por presencia de memoria calculada.
  const alertasBomba = useMemo(() => (hasBom ? bombaAlertas() : null), [hasBom]);
  const buildBombaTables = (): MemoriaTable[] => (hasBom ? computeBombaTables() : []);
  const buildEpTables = useCallback(
    (): MemoriaTable[] => (hasEp ? computeEpTables(pais) : []),
    [hasEp, pais],
  );
  return { alertasBomba, buildBombaTables, buildEpTables };
}
