import { rotatedRectCorners } from '../HitTester.ts';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';
import { findFreeLabelCenter } from '../labelDeclutter.ts';
import type { DeclutterFrame } from '../labelDeclutter.ts';
import { normalizeDnLabel } from '../../../utils/formatUtils.ts';
import { anchoTexto } from './medidaTexto.ts';

export function drawSifonSymbol(
  ctx: CanvasRenderingContext2D,
  engine: IPlanoEngineCore,
  accType: string,
  c: { x: number; y: number },
  _dx: number,
  _dy: number,
  _px: number,
  _py: number,
  outX: number,
  outY: number,
  rad: number,
  diamLabel?: string,
  ramal?: PlanoRamal,
  slot?: 'ini' | 'fin',
  declutter?: DeclutterFrame,
  _pipeToward?: { x: number; y: number },
): boolean {
  if (accType === 'sifon') {
    // Esto es una vista en PLANTA (mirando desde arriba) — la "caída" 2D de la trampa no tiene
    // relación real con la gravedad (que aquí es perpendicular a la página, ni siquiera se
    // dibuja); es una forma puramente convencional. La caída DEBE mantenerse perpendicular a la
    // dirección de entrada (snap) — una caída fija hacia abajo de pantalla degenera en línea
    // recta para un ramal vertical (caída paralela a la entrada) y se sesga en un paralelogramo
    // para uno diagonal. De las dos opciones perpendiculares, se elige la que más se incline
    // hacia abajo de pantalla para que una entrada casi horizontal igual se lea como "cayendo
    // hacia abajo" de un vistazo, sin distorsionar la forma a ningún ángulo.
    const dirLen = Math.hypot(outX, outY) || 1;
    const snapX = outX / dirLen;
    const snapY = outY / dirLen;
    const perX = -snapY;
    const perY = snapX;
    const dnX = perY >= 0 ? perX : -perX;
    const dnY = perY >= 0 ? perY : -perY;

    const L1 = rad * 1.6;
    const tickL = rad * 0.45;
    const H1 = rad * 0.4;
    const R = rad * 0.6;
    const H2 = rad * 1.0;
    const capW = rad * 0.35;

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.35 * engine.zoom * (engine.lineWidthScale || 1);
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';

    // 1. Segmento largo: de c a pt_corner1
    const pt_corner1X = c.x + snapX * L1;
    const pt_corner1Y = c.y + snapY * L1;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(pt_corner1X, pt_corner1Y);
    ctx.stroke();

    // 2. Línea de marca cruzando el segmento largo
    const pt_tickX = c.x + snapX * (rad * 0.9);
    const pt_tickY = c.y + snapY * (rad * 0.9);
    ctx.beginPath();
    ctx.moveTo(pt_tickX + perX * tickL, pt_tickY + perY * tickL);
    ctx.lineTo(pt_tickX - perX * tickL, pt_tickY - perY * tickL);
    ctx.stroke();

    // 3. Giro hacia abajo (siempre abajo de pantalla): de pt_corner1 a pt_corner2
    const pt_corner2X = pt_corner1X + dnX * H1;
    const pt_corner2Y = pt_corner1Y + dnY * H1;
    ctx.beginPath();
    ctx.moveTo(pt_corner1X, pt_corner1Y);
    ctx.lineTo(pt_corner2X, pt_corner2Y);
    ctx.stroke();

    // 4. Giro semicircular en U centrado en cArc, siempre cayendo más abajo de pantalla
    const cArcX = pt_corner2X + snapX * R;
    const cArcY = pt_corner2Y + snapY * R;
    ctx.beginPath();
    for (let step = 0; step <= 16; step++) {
      const angleVal = Math.PI + (step / 16) * Math.PI;
      const cosA = Math.cos(angleVal);
      const sinA = Math.sin(angleVal);
      const px_arc = cArcX + snapX * R * cosA - dnX * R * sinA;
      const py_arc = cArcY + snapY * R * cosA - dnY * R * sinA;
      if (step === 0) ctx.moveTo(px_arc, py_arc);
      else ctx.lineTo(px_arc, py_arc);
    }
    ctx.stroke();

    // 5. Tubería subiendo de nuevo (siempre arriba de pantalla) desde el final del arco
    const pt_end_arcX = pt_corner2X + snapX * (2 * R);
    const pt_end_arcY = pt_corner2Y + snapY * (2 * R);
    const pt_riser_topX = pt_end_arcX - dnX * H2;
    const pt_riser_topY = pt_end_arcY - dnY * H2;
    ctx.beginPath();
    ctx.moveTo(pt_end_arcX, pt_end_arcY);
    ctx.lineTo(pt_riser_topX, pt_riser_topY);
    ctx.stroke();

    // 6. Línea de tapa en el tope de la tubería
    ctx.beginPath();
    ctx.moveTo(pt_riser_topX + snapX * capW, pt_riser_topY + snapY * capW);
    ctx.lineTo(pt_riser_topX - snapX * capW, pt_riser_topY - snapY * capW);
    ctx.stroke();

    // 7. Etiqueta "S  D=<diametro>" junto a la tapa — arrastrable: usa la posición de plano
    // guardada una vez que el usuario la movió (sifonLabelIni/Fin), si no la posición calculada
    // por defecto. Ítem usuario: el default NUNCA movido a mano pasa por el declutter (igual
    // que la etiqueta principal) para no nacer superpuesto; la posición custom se respeta
    // siempre. Moverla no toca geometría (handleDragMove solo escribe sifonLabelIni/Fin).
    if (diamLabel) {
      const fs = engine.mm2cvs(engine.MM.lblInfo * engine.labelScaleM);
      ctx.font = `bold ${fs}px Geist, monospace`;
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const labelOff = H2 * 0.9 + fs * 0.6;
      const text = `S  D=${normalizeDnLabel(String(diamLabel).replace(/["″”]+$/, ''))}"`;
      const tw = anchoTexto(ctx, text);
      const boxW = tw + engine.mm2cvs(2);
      const boxH = fs + engine.mm2cvs(1);
      const storedPlane =
        ramal && slot ? (slot === 'ini' ? ramal.sifonLabelIni : ramal.sifonLabelFin) : undefined;
      let labelCvs = storedPlane
        ? engine.toCvs(storedPlane[0], storedPlane[1])
        : { x: pt_riser_topX - dnX * labelOff, y: pt_riser_topY - dnY * labelOff };
      if (!storedPlane && ramal && slot && declutter) {
        const spot = findFreeLabelCenter(
          `${ramal.id}:sifon${slot === 'ini' ? 'Ini' : 'Fin'}`,
          boxW,
          boxH,
          0,
          labelCvs.x,
          labelCvs.y,
          declutter.placed,
          declutter.segs,
        );
        if (spot) labelCvs = spot;
      }
      ctx.fillText(text, labelCvs.x, labelCvs.y);

      if (ramal && slot) {
        const { corners, minX, minY, maxX, maxY } = rotatedRectCorners(
          labelCvs.x,
          labelCvs.y,
          boxW,
          boxH,
          0,
        );
        const box = {
          cx: labelCvs.x,
          cy: labelCvs.y,
          w: boxW,
          h: boxH,
          angle: 0,
          minX,
          minY,
          maxX,
          maxY,
          corners,
        };
        if (slot === 'ini') ramal._sifonLabelBoxIni = box;
        else ramal._sifonLabelBoxFin = box;
        // La caja de este frame también ordena a las etiquetas que se dibujan después.
        if (declutter)
          declutter.placed.push({
            id: `${ramal.id}:sifon${slot === 'ini' ? 'Ini' : 'Fin'}`,
            minX,
            minY,
            maxX,
            maxY,
          });
      }
    }
    return true;
  }
  return false;
}
