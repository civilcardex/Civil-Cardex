/**
 * Dibuja sobre la lámina las marcas de calibración: origen, línea de referencia X/Y y la distancia en vivo.
 * Ej: modoCalX con preview de 10 m -> línea punteada y "10.00 m" junto al cursor.
 */

/** Punto en coordenadas de plano (px de la lámina). */
export interface PuntoPlano {
  x: number;
  y: number;
}

/** Punto con la misma base pero nombrado como el motor (x_px/y_px). */
export interface PuntoPlanoPx {
  x_px: number;
  y_px: number;
}

/** Origen marcado: el punto (0,0) del plano. */
export interface OrigenMarcado {
  x_px: number;
  y_px: number;
}

/** Estado que el overlay necesita para pintarse. */
export interface EstadoOverlay {
  origen: OrigenMarcado | null;
  calStart: PuntoPlanoPx | null;
  calPreview: PuntoPlano | null;
  modoOrigen: boolean;
  modoCalX: boolean;
  modoCalY: boolean;
  cursorPos: PuntoPlano | null;
  /** Ancho de la lámina en px de plano. */
  pageW: number;
  /** Alto de la lámina en px de plano. */
  pageH: number;
  /** Escala calibrada (metros por píxel). */
  scaleM: number | null;
  /** Factor del eje X (metros por píxel). */
  factorX: number | null;
  /** Factor del eje Y (metros por píxel). */
  factorY: number | null;
  /** Longitud de referencia del eje X, en metros. */
  lenX: string;
  /** Longitud de referencia del eje Y, en metros. */
  lenY: string;
  /** Escala previa (1:N) mientras no hay calibración. */
  preScaleM: number | null;
  /** La lámina es un PDF (72 dpi) y no una imagen (96 dpi). */
  isPdf: boolean;
}

/**
 * Pinta el overlay de calibración sobre la lámina (ctx ya con transform dpr). Ej: origen
 * marcado -> cruz naranja y etiqueta (0,0).
 */
export function dibujaOverlayCalibracion(ctx: CanvasRenderingContext2D, st: EstadoOverlay): void {
  const {
    origen,
    calStart,
    calPreview,
    modoOrigen,
    modoCalX,
    modoCalY,
    cursorPos,
    pageW,
    pageH,
    scaleM,
    factorX,
    factorY,
    lenX,
    lenY,
    preScaleM,
    isPdf,
  } = st;

  if (origen) {
    const { x_px, y_px } = origen;
    ctx.save();
    // Ejes punteados (gris, sobre todo el lienzo en coordenadas de plano)
    ctx.strokeStyle = 'rgba(170,175,185,0.4)';
    ctx.lineWidth = 0.7;
    ctx.setLineDash([6, 10]);
    ctx.beginPath();
    ctx.moveTo(0, y_px);
    ctx.lineTo(pageW, y_px);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x_px, 0);
    ctx.lineTo(x_px, pageH);
    ctx.stroke();
    ctx.setLineDash([]);
    // Marcador de cruz sólido (naranja, tamaño en coordenadas de plano, escala con el zoom)
    const sz = 14;
    ctx.strokeStyle = '#F5A623';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#F5A623';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(x_px - sz, y_px);
    ctx.lineTo(x_px + sz, y_px);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x_px, y_px - sz);
    ctx.lineTo(x_px, y_px + sz);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Etiqueta (0,0) con fondo
    ctx.font = '700 11px monospace';
    const labelW = ctx.measureText('(0,0)').width + 10;
    const labelH = 18;
    ctx.fillStyle = 'rgba(17,19,23,0.85)';
    ctx.beginPath();
    ctx.roundRect(x_px + 8, y_px - labelH - 4, labelW, labelH, 4);
    ctx.fill();
    ctx.fillStyle = '#F5A623';
    ctx.fillText('(0,0)', x_px + 13, y_px - 6);
    ctx.restore();
  }

  if (calStart) {
    const csColor = modoCalX ? '#4D8FF7' : '#0ECC7A';
    ctx.strokeStyle = csColor;
    ctx.lineWidth = 1.5;
    const cs = 5;
    ctx.beginPath();
    ctx.moveTo(calStart.x_px - cs, calStart.y_px);
    ctx.lineTo(calStart.x_px + cs, calStart.y_px);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(calStart.x_px, calStart.y_px - cs);
    ctx.lineTo(calStart.x_px, calStart.y_px + cs);
    ctx.stroke();
  }

  if (calPreview && calStart) {
    const color = modoCalX ? '#4D8FF7' : '#0ECC7A';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(calStart.x_px, calStart.y_px);
    ctx.lineTo(calPreview.x, calPreview.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const dx = modoCalX ? calPreview.x - calStart.x_px : 0;
    const dy = modoCalY ? calPreview.y - calStart.y_px : 0;
    const distPx = Math.hypot(dx, dy);
    const internalDistCm = (distPx / 96) * 2.54;
    const displayDistCm = (distPx / (isPdf ? 72 : 96)) * 2.54;

    const baseFactor = modoCalX ? factorY || scaleM || preScaleM : factorX || scaleM || preScaleM;
    const isFirstCalib = !baseFactor;
    const refVal = modoCalX ? parseFloat(lenX) : parseFloat(lenY);

    let txt = '';
    let refTxt = '';

    if (isFirstCalib) {
      txt = `${displayDistCm.toFixed(2)} cm`;
    } else {
      txt = `${(internalDistCm * baseFactor).toFixed(2)} m`;
      if (!isNaN(refVal) && refVal > 0) {
        refTxt = `→ ref: ${refVal.toFixed(2)} m`;
      }
    }

    ctx.font = '600 11px monospace';
    ctx.fillStyle = color;
    const tx = calPreview.x + (calPreview.x > calStart.x_px ? 8 : -8 - ctx.measureText(txt).width);
    const ty = calPreview.y + (calPreview.y > calStart.y_px ? 18 : -4);
    ctx.fillText(txt, tx, ty);

    if (refTxt) {
      ctx.font = '600 10px monospace';
      ctx.fillStyle = color + 'aa';
      const refTx =
        calPreview.x + (calPreview.x > calStart.x_px ? 8 : -8 - ctx.measureText(refTxt).width);
      ctx.fillText(refTxt, refTx, ty + 14);
    }

    if (modoCalX || modoCalY) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(calPreview.x, calPreview.y - 10);
      ctx.lineTo(calPreview.x, calPreview.y + 10);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      const ps = 5;
      ctx.beginPath();
      ctx.moveTo(calPreview.x - ps, calPreview.y);
      ctx.lineTo(calPreview.x + ps, calPreview.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(calPreview.x, calPreview.y - ps);
      ctx.lineTo(calPreview.x, calPreview.y + ps);
      ctx.stroke();
    }
  }

  const showCrosshair = (modoOrigen || modoCalX || modoCalY) && !calStart && cursorPos;
  if (showCrosshair && cursorPos) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,220,229,0.4)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(0, cursorPos.y);
    ctx.lineTo(pageW, cursorPos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cursorPos.x, 0);
    ctx.lineTo(cursorPos.x, pageH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(0,220,229,0.9)';
    ctx.lineWidth = 1.5;
    const xs = 6;
    ctx.beginPath();
    ctx.moveTo(cursorPos.x - xs, cursorPos.y);
    ctx.lineTo(cursorPos.x + xs, cursorPos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cursorPos.x, cursorPos.y - xs);
    ctx.lineTo(cursorPos.x, cursorPos.y + xs);
    ctx.stroke();
    ctx.restore();
  }

  if (modoOrigen || modoCalX || modoCalY) {
    let txt = '';
    if (modoOrigen) txt = '📍 Clic en la intersección de ejes';
    else if (modoCalX && !calStart) txt = 'Clic en el primer extremo de la línea horizontal';
    else if (modoCalX && calStart) txt = 'Clic en el segundo extremo de la línea X';
    else if (modoCalY && !calStart) txt = 'Clic en el primer extremo de la línea vertical';
    else if (modoCalY && calStart) txt = 'Clic en el segundo extremo de la línea Y';
    if (txt) {
      ctx.font = '600 12px monospace';
      const m = ctx.measureText(txt);
      const pw = m.width + 20;
      const ph = 24;
      ctx.fillStyle = 'rgba(17,19,23,0.85)';
      ctx.beginPath();
      ctx.roundRect(12, 12, pw, ph, 6);
      ctx.fill();
      ctx.fillStyle = '#e2e2e8';
      ctx.fillText(txt, 22, 30);
    }
  }
}
