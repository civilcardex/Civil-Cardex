import { loadFromStorage } from '../../services/almacenamientoServicio.ts';
import { TRAZOS_PREFIX } from '../../constants/almacenamientoClaves.ts';
import { isLdesvioRamalId } from '../associateBajanteAcrossFloors';
import type { PlanItem } from '../../context/PlanosContexto.tsx';

/** Ramal dibujado (del trazo guardado del plano). */
export type RamalDibujo = {
  id: string;
  label: string;
  diametro: string;
  pts: number[][];
  accMed?: Record<string, string>;
  accesorioInicio?: string;
  accesorioFin?: string;
  aparatoInicio?: string;
  aparatoFin?: string;
  planId: string;
};
/** Ramal de ventilación (san/ll): se une al san para el resumen. */
export type VentDibujo = {
  id: string;
  label: string;
  diametro: string;
  pts: number[][];
  planId: string;
};
/** Tributario del dibujo: sirve como "hijo" para derivar el diámetro del brazo de una tee/yee. */
export type TribDibujo = {
  id: string;
  label: string;
  diametro: string;
  pts: number[][];
  accesorioInicio?: string;
  accesorioFin?: string;
  aparatoInicio?: string;
  aparatoFin?: string;
  accMed?: Record<string, string>;
  planId: string;
};
/** Bajante/montante del dibujo (para el conteo de bushing). */
export type BajanteDibujo = {
  id: string;
  diametro: string;
  x: number;
  y: number;
  net?: string;
  tipo?: string;
  recibeDeIds?: string[];
  planId?: string;
};

/** Recolecta las piezas dibujadas de los planos confirmados (ramales, ventilación, tributarios y bajantes). */
export function coleccionarPiezas(
  net: 'san' | 'll' | 'af' | 'ac' | 'gas',
  plans: PlanItem[],
): {
  drawingRamales: RamalDibujo[];
  ventRamales: VentDibujo[];
  tribDrawing: TribDibujo[];
  bajanteDrawing: BajanteDibujo[];
} {
  const drawingRamales: Array<{
    id: string;
    label: string;
    diametro: string;
    pts: number[][];
    accMed?: Record<string, string>;
    accesorioInicio?: string;
    accesorioFin?: string;
    aparatoInicio?: string;
    aparatoFin?: string;
    planId: string;
  }> = [];
  // Item 7: para san, también se leen los ramales de ventilación — la unión vent↔san se muestra
  // con el diámetro de ambos ramales (san×vent) en el resumen.
  const ventRamales: Array<{
    id: string;
    label: string;
    diametro: string;
    pts: number[][];
    planId: string;
  }> = [];
  // Los tributarios del dibujo sirven como "hijos" para derivar el diámetro del brazo de una
  // tee/yee (en AF/AC el brazo es casi siempre un tributario, que no está en drawingRamales).
  const tribDrawing: Array<{
    id: string;
    label: string;
    diametro: string;
    pts: number[][];
    accesorioInicio?: string;
    accesorioFin?: string;
    aparatoInicio?: string;
    aparatoFin?: string;
    accMed?: Record<string, string>;
    planId: string;
  }> = [];
  // Bajantes/montantes del dibujo (para conteo de bushing: un ramal menor que conecta a un
  // bajante de mayor diámetro necesita reducción).
  const bajanteDrawing: Array<{
    id: string;
    diametro: string;
    x: number;
    y: number;
    net?: string;
    tipo?: string;
    recibeDeIds?: string[];
    planId?: string;
  }> = [];
  for (const plan of plans || []) {
    if (plan.status !== 'confirmed') continue;
    const raw = loadFromStorage<unknown>(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    let data = raw as
      | {
          ramales?: Array<{
            id: string;
            label?: string;
            diametro?: string;
            pts?: number[][];
            tipo?: string;
            net?: string;
            accMed?: Record<string, string>;
            accesorioInicio?: string;
            accesorioFin?: string;
          }>;
          bajantes?: Array<{
            id?: string;
            x?: number;
            y?: number;
            dNominal?: string;
            diametro?: string;
          }>;
        }
      | string;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        continue;
      }
    }
    const bajantes =
      (
        data as {
          bajantes?: Array<{
            id?: string;
            x?: number;
            y?: number;
            dNominal?: string;
            diametro?: string;
            net?: string;
            tipo?: string;
            recibeDeIds?: string[];
          }>;
        }
      ).bajantes || [];
    for (const b of bajantes) {
      if (b.x == null || b.y == null) continue;
      bajanteDrawing.push({
        id: String(b.id || ''),
        diametro: b.dNominal || b.diametro || '',
        x: b.x,
        y: b.y,
        net: b.net || net,
        tipo: b.tipo || '',
        recibeDeIds: b.recibeDeIds || [],
        planId: String(plan.id),
      });
    }
    const ramales = (
      (
        data as {
          ramales?: Array<{
            id: string;
            label?: string;
            diametro?: string;
            pts?: number[][];
            tipo?: string;
            net?: string;
            accMed?: Record<string, string>;
            accesorioInicio?: string;
            accesorioFin?: string;
            aparatoInicio?: string;
            aparatoFin?: string;
          }>;
        }
      ).ramales || []
    ).filter(
      (r) => (r.net === net || (net === 'san' && r.net === 'vent')) && !isLdesvioRamalId(r.id),
    );
    for (const r of ramales) {
      if (!r.pts || r.pts.length < 2) continue;
      if (r.net === 'vent') {
        ventRamales.push({
          id: r.id,
          label: r.label || r.id,
          diametro: r.diametro || '',
          pts: r.pts,
          planId: String(plan.id),
        });
      } else if (r.tipo === 'tributario') {
        tribDrawing.push({
          id: r.id,
          label: r.label || r.id,
          diametro: r.diametro || '',
          pts: r.pts,
          accesorioInicio: r.accesorioInicio || '',
          accesorioFin: r.accesorioFin || '',
          aparatoInicio: r.aparatoInicio || '',
          aparatoFin: r.aparatoFin || '',
          accMed: r.accMed,
          planId: String(plan.id),
        });
      } else {
        drawingRamales.push({
          id: r.id,
          label: r.label || r.id,
          diametro: r.diametro || '',
          pts: r.pts,
          accMed: r.accMed,
          accesorioInicio: r.accesorioInicio || '',
          accesorioFin: r.accesorioFin || '',
          aparatoInicio: r.aparatoInicio || '',
          aparatoFin: r.aparatoFin || '',
          planId: String(plan.id),
        });
      }
    }
  }

  // Yees sanitarias: detección por VÉRTICE replicando calcSanitaryAccessories — en cada punto
  // donde se cruzan 3-4 brazos sanitarios con aproximación en Y (|cos| ∈ [0.4, 0.85]) hay UNA
  // yee (no una por par de ramales: cuando la tubería principal está dibujada como dos ramales
  // unidos en el mismo punto, el enfoque por pares contaba la misma unión dos veces — M1→M2 y
  // M2→M1 — y luego la emparejaba como yee doble). Cada brazo lleva el diámetro de su ramal:
  // Principal₁×Principal₂×Derivación.
  return { drawingRamales, ventRamales, tribDrawing, bajanteDrawing };
}
