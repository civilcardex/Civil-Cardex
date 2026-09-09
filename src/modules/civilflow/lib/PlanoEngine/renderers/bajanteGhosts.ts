import { NETS, type IPlanoEngineCore } from '../PlanoState';
import { normalizeDnLabel } from '../../../utils/formatUtils';
import { pisoCortoLoose as getPisoCorto } from '../../../constants';
import { MONTANTE_NETS } from '../drawingCreations';
import { DIR_MAP, ventLabelLines, renderBajanteLabel, drawDireccionSymbol } from './bajanteLabels';

/** Dibuja los bajantes fantasma del piso cargado (desplazados o de dirección) en estilo punteado con su etiqueta. */
export function renderGhosts(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  const fg = engine.getBajantesFantasma();
  fg.forEach((b) => {
    const net = NETS.find((n) => n.id === b.net);
    const col = net ? net.col : '#e2e2e8';
    const disp = b.desplazamientos?.[engine.nivelActual?.label ?? ''];
    // Doble etiqueta (orig. usuario): un bajante que pertenece a ESTE piso y no tiene
    // desplazamiento en él ya dibuja su círculo y etiqueta reales en renderBajantes — su
    // "fantasma" es el mismo punto y solo duplica la etiqueta con la dirección contra.
    if (b.pisoBase === engine.nivelActual?.label && !disp) return;
    const gx = b.x + (disp ? disp.dx : 0);
    const gy = b.y + (disp ? disp.dy : 0);
    const c = engine.toCvs(gx, gy);
    // realMmToCanvasPx tiene un piso de 1mm de papel (ver PlanoEngine.ts) — en escalas
    // arquitectónicas comunes un radio real de 20mm o 10mm caen en ese piso y renderizan
    // idéntico, así que dividir a la mitad el argumento en mm solo es invisible. Se divide el
    // valor px resultante en su lugar.
    const r = engine.realMmToCanvasPx(20) * 0.6;
    b._ghost = { x: c.x, y: c.y, r };

    // La etiqueta del fantasma siempre horizontal
    const ghostAngle = 0;

    // Círculo del fantasma: mismo tamaño, color y opacidad completa que el círculo propio del
    // padre (por pedido explícito — el fantasma debe verse exactamente como su padre, tamaño e
    // intensidad por igual). Excepción: un fantasma sin desplazamiento real en el piso PROPIO
    // del padre queda en exactamente el mismo (x,y) que el padre, que ya dibuja ahí su propio
    // círculo sólido — se salta el anillo extra para que no parezca un halo sobredimensionado.
    // Un fantasma creado por arrastre (dx/dy fijados) es un punto distinto en el espacio incluso
    // en el piso propio del padre, así que igual debe dibujarse. Un marcador de asociación
    // entre pisos (entrada de desplazamientos que lleva un id de conector Ldesvio) siempre
    // dibuja su anillo — incluido el caso perfectamente alineado (dx/dy = 0) — porque ese
    // anillo es la única traza visible del enlace entre pisos en el piso origen.
    const hasDisplacement = !!disp && (Math.abs(disp.dx) >= 1 || Math.abs(disp.dy) >= 1);
    const isOwnFloorGhost =
      b.pisoBase === engine.nivelActual?.label && !hasDisplacement && !disp?.Ldesvio;
    if (!isOwnFloorGhost) {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = col;
      // Debe coincidir exactamente con el trazo del círculo no-seleccionado propio del padre
      // (0.6*zoom, fijado en la rama bajante/montante por defecto de arriba) — esto era 1.5,
      // 2.5x más grueso que el padre, que es exactamente la queja de "el fantasma se ve más
      // grueso".
      ctx.lineWidth = 0.6 * engine.zoom;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const gd = b.ghostData?.[engine.nivelActual?.label ?? ''];
    let ghostDir = b.direccion;
    if (gd && gd.direccion !== undefined) {
      ghostDir = gd.direccion;
    } else if (b.direccion === 'sube') {
      ghostDir = 'baja';
    } else if (b.direccion === 'baja') {
      ghostDir = 'sube';
    }
    // Mismo símbolo vectorial que el círculo propio del padre (drawDireccionSymbol), no el
    // renderizado viejo de glifos unicode — ese era el desajuste visual real con el padre.
    const skipSymbol = !ghostDir && !!b.desplazamientos?.[engine.nivelActual?.label ?? ''];
    if (!skipSymbol) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.translate(c.x, c.y);
      drawDireccionSymbol(ctx, b.tipo, r, ghostDir);
      ctx.restore();
    }

    // Item 4: Flecha amarilla de selección para selección de bajante fantasma
    const inMultiSel = (engine.multiSel || []).includes(b.id);
    const ghostSel = engine.selId === b.id && engine._isGhostSel;
    if (ghostSel || inMultiSel) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(ghostAngle);
      ctx.fillStyle = '#FFEB3B';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5 * engine.zoom;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6 * engine.zoom;
      const arrowR = 8 * engine.zoom;
      const ox = r + 14 * engine.zoom;
      ctx.beginPath();
      ctx.moveTo(ox - arrowR, 0);
      ctx.lineTo(ox, -arrowR * 0.5);
      ctx.lineTo(ox, arrowR * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Item 6: Etiqueta del fantasma — renderizar para todos los fantasmas
    if (b.code || b.code === '') {
      const gd = b.ghostData?.[engine.nivelActual?.label ?? ''];
      let ghostOffX = 0;
      let ghostOffY = 0;
      if (gd?.labelX != null && gd?.labelY != null) {
        ghostOffX = (gd.labelX - gx) * engine.zoom;
        ghostOffY = (gd.labelY - gy) * engine.zoom;
      } else {
        const distPx = engine.mm2cvs(15);
        ghostOffX = distPx * Math.cos(ghostAngle);
        ghostOffY = distPx * Math.sin(ghostAngle);
      }
      const offDx = ghostOffX;
      const offDy = ghostOffY;

      const pCorto = getPisoCorto(engine.nivelActual?.n);
      const lvlSuffix = pCorto ? `-${pCorto}` : '';
      const codeStr =
        (b.code ? b.code.replace(/#/g, '').toUpperCase() : '') + (b.code ? lvlSuffix : '');
      let ghostDir = b.direccion;
      if (gd?.direccion !== undefined) {
        ghostDir = gd.direccion;
      } else if (b.direccion === 'sube') {
        ghostDir = 'baja';
      } else if (b.direccion === 'baja') {
        ghostDir = 'sube';
      }
      const ghostDNom = gd?.dNominal || b.dNominal;
      let diamStr = '';
      if (b.diametro) {
        diamStr = normalizeDnLabel(b.diametro);
      } else if (ghostDNom && ghostDNom !== '0') {
        const v = String(ghostDNom).trim();
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
      }
      let line1 = codeStr || '—';
      const dirWord = DIR_MAP[ghostDir ?? ''] || '';
      let dirText = diamStr ? `D=${diamStr}${dirWord ? '  ' + dirWord : ''}` : dirWord;
      if (b.net === 'vent') {
        const v = ventLabelLines(line1, diamStr, dirWord);
        line1 = v.line1;
        dirText = v.dirText;
      }
      renderBajanteLabel(
        ctx,
        engine,
        b,
        c,
        r,
        ghostAngle,
        offDx,
        offDy,
        line1,
        dirText,
        '_ghostLabelBox',
        1,
      );
    }
  });
}

// Fantasmas de asociación entre pisos (associateBajanteAcrossFloors.ts) — marcadores de
// referencia posicionales puros escritos directamente en el array `crossFloorGhosts` propio de
// este piso. Círculo punteado + etiqueta completa de bajante arriba (code-Piso, D=, dir) en
// color de red, coincidiendo con el formato del bajante fuente.
function toShortPiso(label: string): string {
  if (!label) return '';
  if (label.includes('Cubierta')) return 'C';
  const m = label.match(/(\d+)/);
  if (label.includes('Sótano')) return `S${m?.[1] || ''}`;
  if (label.includes('Piso')) return `P${m?.[1] || ''}`;
  return label;
}

/** Dibuja los fantasmas entre pisos: bajantes de otros niveles que descargan o se alimentan en el actual, con su línea conectora. */
export function renderCrossFloorGhosts(
  ctx: CanvasRenderingContext2D,
  engine: IPlanoEngineCore,
): void {
  (engine.crossFloorGhosts || []).forEach((g) => {
    if (engine._hiddenNets.has(g.net)) return;
    // Asociación ALINEADA verticalmente (orig. usuario): el bajante real de este piso ocupa
    // la misma posición que el fantasma — marcador y etiqueta del piso superior sobran y no
    // se dibujan. Asociaciones desalineadas (fantasma desplazado) siguen mostrándose.
    const overlapReal = engine.bajantes.some(
      (b) =>
        b.pisoBase === (engine.nivelActual?.label ?? '') &&
        b.net === g.net &&
        Math.hypot(b.x - g.x, b.y - g.y) < 0.5,
    );
    if (overlapReal) return;
    const net = NETS.find((n) => n.id === g.net);
    const col = net ? net.col : '#e2e2e8';
    const c = engine.toCvs(g.x, g.y);
    const r = engine.realMmToCanvasPx(20) * 0.6;
    g._hitCircle = { x: c.x, y: c.y, r };

    // Línea punteada hacia el bajante destino en este piso — más tenue que el color de la red y
    // punteada, para que el conector entre pisos se lea como referencia (no como tubería real)
    // y quede visiblemente más claro que los ramales de este mismo piso.
    if (g.targetBajanteId) {
      const targetB = engine.bajantes.find((b) => b.id === g.targetBajanteId);
      if (targetB) {
        const tc = engine.toCvs(targetB.x, targetB.y);
        ctx.save();
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.5 * engine.zoom;
        ctx.setLineDash([4 * engine.zoom, 4 * engine.zoom]);
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(tc.x, tc.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }

    // Círculo punteado
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1 * engine.zoom;
    ctx.setLineDash([4 * engine.zoom, 3 * engine.zoom]);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Glifo de dirección dentro del círculo — misma forma vectorial que el bajante real,
    // leyendo la dirección del ORIGEN (padre) para que la flecha coincida con la etiqueta de
    // texto de arriba.
    const ghostTipo = MONTANTE_NETS.includes(g.net) ? 'montante' : 'bajante';
    ctx.save();
    ctx.translate(c.x, c.y);
    drawDireccionSymbol(ctx, ghostTipo, r, g.parentDireccion ?? g.direccion);
    ctx.restore();

    // Etiqueta: BAN2-P2 / D=4" Baja (piso corto, diámetro mostrado)
    const shortPiso = toShortPiso(g.piso || '');
    const codeStr = (g.code || '').replace(/#/g, '').toUpperCase();
    let line1 = codeStr ? `${codeStr}${shortPiso ? '-' + shortPiso : ''}` : shortPiso || '—';
    let diamStr = '';
    if (g.dNominal && g.dNominal !== '0') {
      const v = String(g.dNominal).trim();
      if (v.includes('"') || v.includes('mm')) {
        diamStr = normalizeDnLabel(v);
      } else {
        const numV = Number(v);
        diamStr = !isNaN(numV) ? (numV < 20 ? `${numV}"` : `${numV}mm`) : normalizeDnLabel(v);
      }
    }
    // Mostrar en la etiqueta la dirección del ORIGEN (padre del piso superior), no la
    // contra-dirección propia del fantasma. Cae a ghost.direccion para fantasmas legacy escritos
    // antes de que existiera este campo.
    const dirWord = DIR_MAP[g.parentDireccion ?? g.direccion ?? ''] || '';
    let dirText = diamStr ? `D=${diamStr}${dirWord ? '  ' + dirWord : ''}` : dirWord;
    if (g.net === 'vent') {
      const v = ventLabelLines(line1, diamStr, dirWord);
      line1 = v.line1;
      dirText = v.dirText;
    }

    // Etiqueta sobre el círculo, centrada, sin línea de guía, color de red. Desplazamiento más
    // ajustado que la etiqueta regular de un bajante — el fantasma queda junto a su línea
    // punteada y al símbolo del padre origen, así que 8 mm extra de aire solo lo empujarían
    // sobre anotaciones adyacentes.
    const offDy = -(r + engine.mm2cvs(3));
    renderBajanteLabel(
      ctx,
      engine,
      g,
      c,
      r,
      0,
      0,
      offDy,
      line1,
      dirText,
      '_crossFloorLabelBox',
      1,
      {
        skipLeader: true,
        textColor: col,
      },
    );
  });
}
