import type { Tramo } from '../../context/tramosReducer';
import type { PlanItem } from '../../context/PlanosContexto.tsx';
import { catalogoDeRed, resumenCatalogo } from './catalogo.ts';
import { coleccionarPiezas } from './collection';
import { detectarYees } from './yees';
import { contarAccesorios } from './conteo.ts';
import { calcularBushing } from './bushing';
import { armarTabla } from './filas.ts';
import type { MemoriaTable } from '../exportaMemoryFinal.ts';

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
