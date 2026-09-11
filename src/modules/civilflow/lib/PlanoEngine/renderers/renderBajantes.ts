import { NETS, type IPlanoEngineCore } from '../PlanoState';
import { normalizeDnLabel } from '../../../utils/formatUtils';
import { parseDescargaEnId } from '../../../utils/parseDescargaEnId';
import { pisoCortoLoose as getPisoCorto } from '../../../constants';
import { DIR_MAP, ventLabelLines, renderBajanteLabel, drawDireccionSymbol } from './bajanteLabels';
import { renderCanalGlyph } from './renderCanal';

export { renderCanalGhost } from './renderCanal';
export { renderGhosts, renderCrossFloorGhosts } from './bajanteGhosts';

export function renderBajantes(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  engine.bajantes.forEach((b) => {
    if (engine._hiddenNets.has(b.net)) return;

    // El canal es un rectángulo de esquina+tamaño, no un símbolo de punto+radio como todo otro
    // tipo de este array — nunca rota (labelAngle solo afecta la posición de su etiqueta, no la
    // forma) y tiene su propia caja de hit-test (_canalBox) en vez del pipeline genérico de
    // glifo con ctx.rotate de abajo, así que se maneja completamente aparte.
    if (b.tipo === 'canal') {
      renderCanalGlyph(ctx, engine, b);
      return;
    }

    // Un bajante solo recibe su círculo sólido en SU PROPIO piso (pisoBase). Una entrada de
    // desplazamiento para el nivel actual no dice nada sobre a qué piso pertenece — además es
    // así como se posicionan los fantasmas en pisos remotos — así que nunca debe suprimir el
    // chequeo de fantasma.
    const isDirectionGhost = b.pisoBase !== engine.nivelActual?.label;

    const c = engine.toCvs(b.x, b.y);
    // Cuando este bajante es un fantasma de piso remoto, nunca dibujar el borde amarillo grueso
    // de selección.
    const sel = b.id === engine.selId && !engine._isGhostSel && !isDirectionGhost;
    // realMmToCanvasPx tiene un piso de 1mm de papel (ver PlanoEngine.ts) — en escalas
    // arquitectónicas comunes un radio real de 20mm o 10mm caen en ese piso y renderizan
    // idéntico, así que dividir a la mitad el argumento en mm solo es invisible. Se divide el
    // valor px resultante en su lugar.
    const r = engine.realMmToCanvasPx(20) * 0.6;

    // Item 2: Ángulo de etiqueta + restricción de snap (auto-rotación removida por pedido)
    const angle = ((b.labelAngle || 0) * Math.PI) / 180;

    // Las cajas dibujan a escala real (100×100cm exterior): el hit del menú
    // contextual (_circ.r) cubre la media diagonal para alcanzar las esquinas.
    const cajaHalf =
      b.tipo === 'caja_san' || b.tipo === 'caja_ll' ? engine.realMmToCanvasPx(1000) / 2 : 0;
    const bombaR = b.tipo === 'bomba' ? (engine.realMmToCanvasPx(350) / 4) * 1.5 : 0;
    b._circ = {
      x: c.x,
      y: c.y,
      r: cajaHalf > 0 ? cajaHalf * Math.SQRT2 : bombaR > 0 ? bombaR : r,
    };
    if (isDirectionGhost) return;

    // Dibujar líneas verdes punteadas desde los ramales que alimentan este bajante
    // (recibeDeIds) — es una guía para cuando el bajante queda LEJOS del ramal (p.ej. una
    // posición desplazada/fantasma), así que se salta siempre que el punto propio del
    // bajante/montante ya coincida con CUALQUIER punto del ramal (no solo sus dos extremos):
    // un montante creado a mitad de cuerpo (createMontanteMidBody) queda en un vértice
    // INTERIOR, no un extremo, así que comparar solo contra el extremo más cercano nunca
    // coincidía y siempre dibujaba una línea sin sentido desde dondequiera que estuviera ese
    // extremo; el mismo fix también cubre un ramal llegando a la posición fantasma/desplazada
    // de este bajante en este piso.
    if (b.recibeDeIds?.length) {
      const ghostDisp = b.desplazamientos?.[engine.nivelActual?.label ?? ''];
      const bPos = ghostDisp
        ? { x: b.x + ghostDisp.dx, y: b.y + ghostDisp.dy }
        : { x: b.x, y: b.y };
      b.recibeDeIds.forEach((rid: string) => {
        const ram = engine.ramales.find((rr) => rr.id === rid);
        if (ram && ram.pts.length) {
          const touchesDirectly = ram.pts.some(
            ([px, py]) => Math.hypot(px - bPos.x, py - bPos.y) < 1.5,
          );
          if (touchesDirectly) return;
          const pStart = ram.pts[0];
          const pEnd = ram.pts[ram.pts.length - 1];
          const distStart = Math.hypot(pStart[0] - b.x, pStart[1] - b.y);
          const distEnd = Math.hypot(pEnd[0] - b.x, pEnd[1] - b.y);
          const bestPt = distStart < distEnd ? pStart : pEnd;
          const rc = engine.toCvs(bestPt[0], bestPt[1]);
          ctx.save();
          ctx.strokeStyle = '#0ECC7A';
          ctx.lineWidth = 2 * engine.zoom * (engine.lineWidthScale || 1);
          ctx.setLineDash([4 * engine.zoom, 4 * engine.zoom]);
          ctx.beginPath();
          ctx.moveTo(rc.x, rc.y);
          ctx.lineTo(c.x, c.y);
          ctx.stroke();
          ctx.restore();
        }
      });
    }

    if (b.descargaEnId) {
      const parts = parseDescargaEnId(b.descargaEnId, engine._loadedPlanId);
      const targetPlanId = parts[0];
      const targetId = parts[1];

      // Solo dibujar la línea si el destino está en el piso ACTUAL
      if (String(targetPlanId) === String(engine._loadedPlanId)) {
        // Dibujar línea al RAMAL destino
        const ram = engine.ramales.find((rr) => rr.id === targetId);
        if (ram && ram.pts.length) {
          const pStart = ram.pts[0];
          const pEnd = ram.pts[ram.pts.length - 1];
          const distStart = Math.hypot(pStart[0] - b.x, pStart[1] - b.y);
          const distEnd = Math.hypot(pEnd[0] - b.x, pEnd[1] - b.y);
          const bestPt = distStart < distEnd ? pStart : pEnd;
          const rc = engine.toCvs(bestPt[0], bestPt[1]);
          ctx.save();
          ctx.strokeStyle = '#0ECC7A';
          ctx.lineWidth = 2 * engine.zoom * (engine.lineWidthScale || 1);
          ctx.setLineDash([4 * engine.zoom, 4 * engine.zoom]);
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(rc.x, rc.y);
          ctx.stroke();
          ctx.restore();
        }
        // Dibujar línea al BAJANTE destino del mismo piso
        const targetBaj = engine.bajantes.find((bb) => bb.id === targetId);
        if (targetBaj) {
          const tc = engine.toCvs(targetBaj.x, targetBaj.y);
          ctx.save();
          ctx.strokeStyle = '#0ECC7A';
          ctx.lineWidth = 2 * engine.zoom * (engine.lineWidthScale || 1);
          ctx.setLineDash([4 * engine.zoom, 4 * engine.zoom]);
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(tc.x, tc.y);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(angle);

    ctx.fillStyle = '#ffffff';
    if (b.tipo === 'red_publica') {
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.rect(-r, -r, r * 2, r * 2);
      ctx.fill();
      ctx.strokeStyle = sel ? '#FFEB3B' : '#475569';
      ctx.lineWidth = (sel ? 2.5 : 1.2) * engine.zoom * (engine.lineWidthScale || 1);
      ctx.beginPath();
      ctx.rect(-r, -r, r * 2, r * 2);
      ctx.stroke();
    } else if (b.tipo === 'contador' && b.net === 'gas') {
      ctx.fillStyle = '#A855F7';
      const devW = r * 2;
      const devH = r * 2.4;
      ctx.beginPath();
      ctx.rect(-devW / 2, -devH / 2, devW, devH);
      ctx.fill();
      ctx.strokeStyle = sel ? '#FFEB3B' : '#A855F7';
      ctx.lineWidth = (sel ? 2.5 : 1.2) * engine.zoom * (engine.lineWidthScale || 1);
      ctx.beginPath();
      ctx.rect(-devW / 2, -devH / 2, devW, devH);
      ctx.stroke();
      const dispW = devW * 0.6;
      const dispH = devH * 0.12;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(-dispW / 2, -devH / 2 + devH * 0.12, dispW, dispH, 1 * engine.zoom);
      ctx.fill();
    } else if (b.tipo === 'contador') {
      const netObj = NETS.find((n) => n.id === (b.net === 'gas' ? 'gas' : 'af'));
      const col = netObj ? netObj.col : '#4D8FF7';
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = sel ? '#FFEB3B' : col;
      ctx.lineWidth = (sel ? 2.5 : 1.2) * engine.zoom * (engine.lineWidthScale || 1);
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
      ctx.stroke();
    } else if (b.tipo === 'calentador') {
      const netObj = NETS.find((n) => n.id === (b.net === 'gas' ? 'gas' : 'ac'));
      const col = netObj ? netObj.col : b.net === 'gas' ? '#A855F7' : '#F04545';
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.rect(-r, -r, r * 2, r * 2);
      ctx.fill();
      ctx.strokeStyle = sel ? '#FFEB3B' : col;
      ctx.lineWidth = (sel ? 2.5 : 1.2) * engine.zoom * (engine.lineWidthScale || 1);
      ctx.beginPath();
      ctx.rect(-r, -r, r * 2, r * 2);
      ctx.stroke();
    } else if (b.tipo === 'bomba') {
      // Bomba centrífuga (BOMAN-nivel, orig. usuario, imagen de referencia): volute + centro
      // + DOS boquillas VERTICALES con brida — arriba-IZQUIERDA (sube) y abajo-DERECHA (baja),
      // como el ícono. R = 1/4 del tamaño original (35cm → ~8.75cm de radio de volute).
      const netObj = NETS.find((n) => n.id === b.net);
      const col = netObj ? netObj.col : '#e2e2e8';
      const R = engine.realMmToCanvasPx(350) / 4;
      const lw = (sel ? 2.5 : 1.4) * engine.zoom * (engine.lineWidthScale || 1);
      ctx.strokeStyle = sel ? '#FFEB3B' : col;
      ctx.lineWidth = lw;
      // Volute + centro.
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      // Boquilla VERTICAL: dos líneas paralelas desde el cuadro de la volute hacia afuera +
      // brida rectangular (outline) en la boca. x0 = ±0.45R (izq arriba / der abajo).
      const w = R * 0.5;
      const fh = R * 0.22;
      const fw = w * 1.7;
      const nozzleV = (x0: number, dir: number) => {
        const yA = dir * R * 0.72; // altura del arranque (sobre el cuadro de la volute)
        const yEnd = dir * (R * 0.72 + R * 0.55);
        ctx.beginPath();
        ctx.moveTo(x0 - w / 2, yA);
        ctx.lineTo(x0 - w / 2, yEnd);
        ctx.moveTo(x0 + w / 2, yA);
        ctx.lineTo(x0 + w / 2, yEnd);
        ctx.stroke();
        // Brida: rectángulo outline cruzando la boca (fuera del extremo de las líneas).
        const fy = dir < 0 ? yEnd - fh : yEnd;
        ctx.strokeRect(x0 - fw / 2, fy, fw, fh);
      };
      nozzleV(-R * 0.45, -1); // arriba-izquierda
      nozzleV(R * 0.45, 1); // abajo-derecha
    } else if (b.tipo === 'caja_san' || b.tipo === 'caja_ll') {
      // Caja de recolección (CAN/CALL): CUADRADOS concéntricos a escala real — exterior
      // 100×100cm, interior 70×70cm — solo trazo (el plano se ve a través). Mismas medidas
      // que el símbolo isométrico. La etiqueta la dibuja el pipeline de b.code.
      const netObj = NETS.find((n) => n.id === b.net);
      const col = netObj ? netObj.col : '#e2e2e8';
      const side = engine.realMmToCanvasPx(1000);
      const inSide = engine.realMmToCanvasPx(700);
      ctx.strokeStyle = sel ? '#FFEB3B' : col;
      ctx.lineWidth = (sel ? 2.5 : 1.2) * engine.zoom * (engine.lineWidthScale || 1);
      ctx.beginPath();
      ctx.rect(-side / 2, -side / 2, side, side);
      ctx.stroke();
      ctx.beginPath();
      ctx.rect(-inSide / 2, -inSide / 2, inSide, inSide);
      ctx.stroke();
    } else {
      const netObj = NETS.find((n) => n.id === b.net);
      const col = netObj ? netObj.col : '#e2e2e8';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = sel ? '#FFEB3B' : col;
      ctx.lineWidth = (sel ? 1.2 : 0.6) * engine.zoom * (engine.lineWidthScale || 1);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    if (b.tipo === 'red_publica') {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${r * 0.9}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('RP', 0, 0);
    } else if (b.tipo === 'contador' && b.net === 'gas') {
      // Medidor de gas: sin letra, sin segmentos de tubería
    } else if (b.tipo === 'contador') {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${r * 0.9}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('M', 0, 0);
    } else if (b.tipo === 'calentador') {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${r * 0.9}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('C', 0, 0);
    } else if (b.tipo === 'caja_san' || b.tipo === 'caja_ll') {
      // Interior del símbolo de caja: solo el cuadrado interior, sin letra ni símbolo de
      // dirección (la etiqueta CAN/CALL vive debajo, dibujada por el pipeline de b.code).
    } else if (b.tipo === 'bomba') {
      // Sin glifo interno ni flecha de dirección — la etiqueta BOMAN-nivel la dibuja el pipeline.
    } else {
      drawDireccionSymbol(ctx, b.tipo, r, b.direccion);
    }

    // Flecha amarilla de selección (mismo estilo que los ramales)
    const inMultiSel = (engine.multiSel || []).includes(b.id);
    if ((sel || inMultiSel) && !engine._isGhostSel) {
      const arrowR = 8 * engine.zoom;
      const ox = r + 14 * engine.zoom;
      ctx.save();
      ctx.fillStyle = '#FFEB3B';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5 * engine.zoom * (engine.lineWidthScale || 1);
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6 * engine.zoom;
      ctx.beginPath();
      ctx.moveTo(ox - arrowR, 0);
      ctx.lineTo(ox, -arrowR * 0.5);
      ctx.lineTo(ox, arrowR * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // La etiqueta del padre se dibuja EXCEPTO cuando esto es un fantasma direccional en un piso
    // remoto (pisoBase !== nivel actual significa que el bajante pertenece a otro piso) —
    // isDirectionGhost calculado arriba; todo este bloque es inalcanzable para ese caso de todos
    // modos (retorno temprano arriba).
    if (!isDirectionGhost && (b.code || b.code === '')) {
      const lx = b.labelX ?? b.x;
      const ly = b.labelY ?? b.y + 20;
      const offDx = (lx - b.x) * engine.zoom;
      let offDy = (ly - b.y) * engine.zoom;

      // Item 2: Aplicar desplazamiento perpendicular mínimo para que la etiqueta no quede sobre
      // el ramal
      const minPerpPx = engine.mm2cvs(3);
      if (Math.abs(offDy) < minPerpPx) {
        offDy = offDy >= 0 ? minPerpPx : -minPerpPx;
      }

      const pCorto = getPisoCorto(engine.nivelActual?.n);
      // Bomba: el nivel ya va DENTRO del código (BOMAN-S1) — sin sufijo doble.
      const lvlSuffix = b.tipo === 'bomba' ? '' : pCorto ? `-${pCorto}` : '';
      const codeStr =
        (b.code ? b.code.replace(/#/g, '').toUpperCase() : '') + (b.code ? lvlSuffix : '');
      let diamStr = '';
      if (b.dNominal && b.dNominal !== '0') {
        const v = String(b.dNominal).trim();
        if (v.includes('"') || v.includes('mm')) {
          diamStr = normalizeDnLabel(v);
        } else {
          const numV = Number(v);
          if (!isNaN(numV)) {
            diamStr = numV < 20 ? `${numV}"` : `${numV}mm`;
          } else {
            diamStr = normalizeDnLabel(v);
          }
        }
      } else if (b.diametro) {
        diamStr = normalizeDnLabel(b.diametro);
      }
      // La línea grande en negrita es solo el código — espeja la etiqueta propia de un ramal,
      // que mantiene su línea de nombre en negrita con el código corto solo y empuja el
      // diámetro a la línea de info más pequeña debajo.
      let line1 = codeStr || '—';
      const dirWord = DIR_MAP[b.direccion ?? ''] || '';
      let dirText = diamStr ? `D=${diamStr}${dirWord ? '  ' + dirWord : ''}` : dirWord;
      if (b.net === 'vent') {
        // Las reventilaciones se identifican como REV[N] [diámetro] + dirección, en vez del
        // código BREV{n}-Piso con D= de los bajantes de aguas negras.
        const v = ventLabelLines(line1, diamStr, dirWord);
        line1 = v.line1;
        dirText = v.dirText;
      }
      renderBajanteLabel(ctx, engine, b, c, r, angle, offDx, offDy, line1, dirText, '_labelBox', 1);
    } else {
      b._labelBox = undefined;
    }
  });
}
