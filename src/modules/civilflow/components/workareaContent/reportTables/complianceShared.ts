/** Chequeos de cumplimiento compartidos por el resumen del Informe: dada una fila hidráulica o
 *  una tabla de memoria, decide si incumple y arma la etiqueta del chip de fallo. Ej:
 *  fallosDeTabla(bajVentSanTable) → ['BAN1-P2'] para cada fila que dice 'No cumple'. */
import { pisoCorto } from '../../../constants';
import type { MemoriaTable } from '../../../utils/exportReportFinal.ts';
import type { PerfNormas } from '../../../constants/countryStandards';

/** Revisa si una fila ya calculada cumple los rangos (velocidad, tirante, caudal lleno):
 *  la misma regla de rangos del país, aplicada AQUÍ en fresco sobre las filas de
 *  computeSanRows/computeLlRows — antes dependía de banderas que solo escribía la
 *  página de Diseño de redes. */
export const filaEnRangoSanLl = (
  r: { Vreal: number; Yc: number; Yn: number; DintMm: number; qqo: number },
  perfil: PerfNormas,
): boolean =>
  r.Vreal >= perfil.san.vMin &&
  r.Vreal <= perfil.san.vMax &&
  r.DintMm > 0 &&
  // yD de la página = max(Yc, Yn)/D (el tiro de DISEÑO manda en flujo supercrítico) —
  // usar solo Yn era más laxo exactamente donde importa.
  Math.max(r.Yc, r.Yn) / r.DintMm <= perfil.san.ydMax &&
  r.qqo <= 1.0;

/** El semáforo y los chips juzgan el MISMO conjunto (solo ramales — sin tributarios): si dice
 *  'Revisar', los chips de fallo aparecen al lado (ped. usuario). */
export const noTrib = (t: { tipo?: string }): boolean => t.tipo !== 'tributario';

/** Fallo de tabla: fila cuya verificación dice 'NO CUMPLE' (las '—' son filas sin datos, no fallos). */
export const filaFalla = (r: {
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
    Number(r.DdisPulg ?? 0) > 0);

/** Ubicación de fallos (ped. usuario): etiqueta `${id}-${piso}` de cada elemento que incumple. */
export const etiq = (id: unknown, piso: number | undefined): string => {
  const raw = String(id ?? '?');
  const corto = raw.length > 10 ? `${raw.slice(0, 4)}…` : raw;
  return `${corto}-${pisoCorto(Number(piso ?? 0))}`;
};

/** Fallos leídos de una MemoriaTable: filas donde una columna /chequeo/i dice 'No cumple'.
 *  sufijoDe: nivel del elemento (ej. row[1]='P2' en bajantes aguas negras) → chip `BAN1-P2`. */
export const fallosDeTabla = (
  tbl: MemoriaTable | null,
  sufijoDe?: (row: unknown[]) => string,
): string[] => {
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
};
