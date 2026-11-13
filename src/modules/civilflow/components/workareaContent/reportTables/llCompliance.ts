/** Cumplimiento de la red ll (Lluvias) para el resumen del Informe: ramales fuera de rango,
 *  bajantes y canales que no cumplen, y los "sin verificar" (material sin elegir — la tabla no
 *  los chequea pero no son OK). Ej: un canal sin material de canal sale como 'Canal-P99 (sin verificar)'. */
import { useMemo } from 'react';
import type { PerfNormas } from '../../../constants/countryStandards';
import { pisoCorto } from '../../../constants';
import type { LlRow } from '../../../utils/rainwaterRows.ts';
import {
  chequeoCanalLluvia,
  chequeoBajanteLluvia,
  BORDE_LIBRE_CANAL_CM,
} from '../../../utils/calcRainwater.ts';
import { nDeCanal, cDeCubierta } from '../../../constants/engineeringDataMaterials.ts';
import type { useWorkAreaState } from '../../useWorkAreaState.ts';
import { useRainwater } from '../../../context/RainwaterContext.tsx';
import { filaEnRangoSanLl, filaFalla } from './complianceShared.ts';

type WorkAreaState = ReturnType<typeof useWorkAreaState>;
type RainwaterState = ReturnType<typeof useRainwater>;

/** Fallos y estado de la red ll; lo consumen el candado de descarga (allOk) y la fila
 *  AGUAS LLUVIAS del resumen. */
export function useLlCumple(args: {
  llRowsCalc: LlRow[] | null;
  tramosLl: WorkAreaState['tramosLl'];
  bajantesLl: RainwaterState['bajantesLl'];
  canalesLl: RainwaterState['canalesLl'];
  plans: WorkAreaState['plans'];
  pisos: WorkAreaState['pisos'];
  perfil: PerfNormas;
}) {
  const { llRowsCalc, tramosLl, bajantesLl, canalesLl, plans, pisos, perfil } = args;
  // Filas CON dato hidráulico (Vreal>0 ⇒ hubo Q, pendiente, Manning y diámetro).
  const conDatosLl = (llRowsCalc ?? []).filter((r) => r.Vreal > 0);
  // LL: rango + chequeos de tabla + bajantes + canales. Filas ya sin tributarios/bajantes.
  const fallosLl = useMemo(
    () => [
      ...conDatosLl
        .filter((r) => !filaEnRangoSanLl(r, perfil))
        .map((r) => ({ id: r.id, piso: r.piso })),
      ...(llRowsCalc ?? []).filter(filaFalla).map((r) => ({ id: r.id, piso: r.piso })),
    ],
    [conDatosLl, llRowsCalc, perfil],
  );
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
  return {
    conDatosLl,
    fallosLl,
    fallosBajLl,
    pisoDeBajLl,
    fallosCanalLl,
    fallosCanalSinVerificar,
    fallosBajSinVerificar,
    canalSinVerificarHay,
    bajSinVerificarHay,
  };
}
