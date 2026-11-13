/**
 * Calibración de la copia entre láminas: cada piso calibra su propio PDF (scaleM = metros por
 * pixel), así que las coordenadas se escalan por escala_origen/escala_destino y se trasladan por
 * el delta de orígenes de alineación (p_dst = p_src × f + offset). Con escala única y mismos
 * orígenes, la geometría viaja BIT-EXACTA — sin tocar un solo píxel.
 * Ej: origen_src (10,20) y origen_dst (30,40) trasladan cada punto 20 px a la derecha y 20 abajo.
 */
import type { CopyAlineacion, CopyElement, ExtendedEngine } from './types.ts';

/** Resultado de la calibración: factor de escala, traslación y si hace falta transformar. */
export interface Calibracion {
  calibFactor: number;
  offX: number;
  offY: number;
  sinTransform: boolean;
}

/** Calcula factor y offsets de calibración desde la escala del plano origen, la del motor y la alineación. */
export function calibrarCopiado(
  sourceScaleM: number | undefined,
  engine: ExtendedEngine,
  alineacion?: CopyAlineacion,
): Calibracion {
  // PUNTO (orig. usuario: 3.99 vs 3.92 a la misma referencia): cada piso calibra su propio
  // PDF (scaleM = metros por pixel). Copiar coordenadas en crudo arrastra la diferencia de
  // calibración — el mismo trazo mide distinto en cada piso. Normalizar: escalar las
  // coordenadas copiadas por escala_origen/escala_destino. Con la escala única del proyecto
  // (calGlobal) el factor es EXACTAMENTE 1 y la geometría viaja BIT-EXACTA — sin el toFixed
  // que reescribía cada coordenada aunque nada cambiara (causa raíz de cotas distintas
  // entre pisos tras copiar: ver incidente 2026-09-21).
  const srcScale = Number(sourceScaleM) || 0.5;
  const dstScale = (engine as { scaleM?: number }).scaleM || srcScale;
  const calibFactor = dstScale > 0 ? srcScale / dstScale : 1;
  // Alineación por origen de calibración (láminas de AutoCAD desalineadas entre pisos):
  // p_dst = (p_src − origen_src) × f + origen_dst  ⇔  p_src × f + offset. Con orígenes
  // iguales y f = 1 la transformación es la identidad EXACTA y la geometría viaja sin tocar.
  const oS = alineacion?.origenSrc ?? null;
  const oD = alineacion?.origenDst ?? null;
  const usaOrigen = !!(oS && oD);
  const offX = usaOrigen ? oD!.x_px - oS!.x_px * calibFactor : 0;
  const offY = usaOrigen ? oD!.y_px - oS!.y_px * calibFactor : 0;
  const mismoEscala = Math.abs(calibFactor - 1) < 1e-9;
  const mismoOrigen = !usaOrigen || (Math.abs(offX) < 1e-9 && Math.abs(offY) < 1e-9);
  const sinTransform = mismoEscala && mismoOrigen;
  return { calibFactor, offX, offY, sinTransform };
}

/** Aplica la transformación de calibración a pts/labels y recalcula totalL con la escala del destino. */
export function transformarGeometria(
  srcRamales: CopyElement[],
  srcBajantes: CopyElement[],
  calibFactor: number,
  offX: number,
  offY: number,
  engine: ExtendedEngine,
): void {
  // Normalización de calibración SOLO si hay algo que corregir: mismo escala y mismos
  // orígenes ⇒ geometría bit-exacta (posiciones idénticas ⇒ cotas idénticas en todos los
  // pisos). Con láminas desalineadas, el delta de orígenes traslada la copia al mismo
  // punto físico de la lámina destino.
  const escalaPt = (pt: number[]): number[] => [
    +(pt[0] * calibFactor + offX).toFixed(3),
    +(pt[1] * calibFactor + offY).toFixed(3),
  ];
  for (const r of srcRamales) {
    if (r.pts) r.pts = r.pts.map((pt) => escalaPt(pt));
    if (r.labelX != null) r.labelX = +(r.labelX * calibFactor + offX).toFixed(3);
    if (r.labelY != null) r.labelY = +(r.labelY * calibFactor + offY).toFixed(3);
  }
  for (const b of srcBajantes as unknown as Array<{
    x?: number;
    y?: number;
    labelX?: number;
    labelY?: number;
  }>) {
    if (b.x != null) b.x = +(b.x * calibFactor + offX).toFixed(3);
    if (b.y != null) b.y = +(b.y * calibFactor + offY).toFixed(3);
    if (b.labelX != null) b.labelX = +(b.labelX * calibFactor + offX).toFixed(3);
    if (b.labelY != null) b.labelY = +(b.labelY * calibFactor + offY).toFixed(3);
  }
  // PUNTO 13: totalL recalculado con la ESCALA DEL PISO DESTINO (la copia heredaba el total
  // del origen — con escalas distintas las distancias no coincidían). La traslación no
  // afecta longitudes.
  const scaleDestino = (engine as { scaleM?: number }).scaleM || 0.5;
  for (const r of srcRamales) {
    if (!r.pts || r.pts.length < 2) continue;
    let px = 0;
    for (let i = 0; i + 1 < r.pts.length; i++)
      px += Math.hypot(r.pts[i + 1][0] - r.pts[i][0], r.pts[i + 1][1] - r.pts[i][1]);
    r.totalL = +((px / 96) * 2.54 * scaleDestino).toFixed(3);
  }
}
