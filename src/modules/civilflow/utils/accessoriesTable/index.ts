import type { Tramo } from '../../context/tramosReducer';
import type { PlanItem } from '../../context/PlansContext.tsx';
import { catalogoDeRed, resumenCatalogo } from './catalog.ts';
import { coleccionarPiezas } from './collection';
import { detectarYees } from './yees';
import { contarAccesorios } from './counting.ts';
import { calcularBushing } from './bushing';
import { armarTabla } from './rows.ts';
import { diamPulgFromLabel } from '../diamInchesFromLabel.ts';
import { fracAscii, fmtPulg } from '../formatUtils.ts';
import type { MemoriaTable } from '../exportReportFinal.ts';

/**
 * Tabla de accesorios de tubería (san/ll/af/ac/gas): cuenta codons, uniones, yees y
 * bushings por diámetro. La implementación vive en módulos por bloque (catalogo, coleccion,
 * yees, conteo, bushing, filas); este archivo solo los encadena.
 */
export function computeAccesoriosTable(
  net: 'san' | 'll' | 'af' | 'ac' | 'gas',
  tramos: Tramo[],
  plans: PlanItem[],
): MemoriaTable | null {
  const { catalog, title } = catalogoDeRed(net);
  const { drawingRamales, ventRamales, tribDrawing, bajanteDrawing } = coleccionarPiezas(
    net,
    plans,
  );
  const { yeeJunctions, yeeDiams, ventYeeCombos, ventCodoCombos } = detectarYees(
    net,
    drawingRamales,
    tribDrawing,
    ventRamales,
    tramos,
  );
  const { summaryCatalog, hidroData } = resumenCatalogo(
    net,
    catalog,
    drawingRamales,
    tribDrawing,
    ventRamales,
    bajanteDrawing,
  );
  const { totals, pulgById, addAcc } = contarAccesorios(
    net,
    catalog,
    summaryCatalog,
    drawingRamales,
    tribDrawing,
    yeeDiams,
    ventCodoCombos,
    hidroData,
    tramos,
  );
  const { bajanteBushing } = calcularBushing(
    net,
    bajanteDrawing,
    drawingRamales,
    tribDrawing,
    ventRamales,
    yeeJunctions,
    ventYeeCombos,
    hidroData,
    catalog,
    pulgById,
    addAcc,
  );
  return armarTabla(
    net,
    title,
    summaryCatalog,
    totals,
    bajanteBushing,
    pulgById,
    drawingRamales,
    tribDrawing,
    bajanteDrawing,
  );
}

/**
 * La MISMA tabla en formato LARGO (Diámetro | Accesorio | Cantidad), igual que la versión de
 * la pantalla (FittingsDiamPage): una fila por accesorio presente, filas bushing incluidas,
 * ordenado por diámetro desc. Consumida por las memorias finales — la matriz de ~20 columnas
 * era ilegible en el PDF. La pantalla sigue leyendo la matriz (computeAccesoriosTable).
 */
export function computeAccesoriosTableLarga(
  net: 'san' | 'll' | 'af' | 'ac' | 'gas',
  tramos: Tramo[],
  plans: PlanItem[],
): MemoriaTable | null {
  const matriz = computeAccesoriosTable(net, tramos, plans);
  if (!matriz) return null;
  const out: Array<[string, string, number]> = [];
  const headers = matriz.headers;
  for (const row of matriz.rows) {
    const diam = fracAscii(String(row[0] ?? ''));
    // headers[0]='Diámetro', último='Total'; el resto son accesorios — por NOMBRE, porque
    // dropAllZeroColumns ya eliminó columnas en cero y los índices no coinciden con el catálogo.
    for (let i = 1; i < headers.length - 1; i++) {
      const v = Number(row[i] || 0);
      if (v > 0) out.push([diam, String(headers[i]), v]);
    }
  }
  // Filas pseudo de bushing (pares mayor×menor con conexiones reales), como en la pantalla.
  for (const [k, count] of Object.entries(matriz.bushingCounts ?? {})) {
    const [mayor, menor] = k.split('_').map(Number);
    if (!Number.isFinite(mayor) || !Number.isFinite(menor) || !(count > 0)) continue;
    out.push([`${fracAscii(`${fmtPulg(mayor)} × ${fmtPulg(menor)}`)}`, 'Bushing', count]);
  }
  out.sort((a, b) => diamPulgDe(a[0]) - diamPulgDe(b[0]) || a[1].localeCompare(b[1]));
  if (out.length === 0) return null;
  return {
    title: matriz.title,
    headers: ['Diámetro', 'Accesorio', 'Cantidad'],
    rows: out,
  };
}

/** Pulgadas a número para ordenar (ignora el lado "× menor" de los bushings). */
function diamPulgDe(label: string): number {
  return diamPulgFromLabel(label.split('×')[0].trim());
}
