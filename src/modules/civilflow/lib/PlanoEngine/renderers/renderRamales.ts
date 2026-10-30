import { NETS } from '../PlanoState.ts';
import { snapTributaryToPadre45Deg } from '../PlanoEngineDrawing.ts';
import { segmentAtPosition } from '../drawingAngles.ts';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';
import { renderEndpointFlowArrows } from './renderFlowArrows.ts';
import { renderAparatoSymbols } from './renderAparatoSymbols.ts';
import { drawRamalPath } from './drawRamalPath.ts';
import { renderJunctions } from './renderJunctions.ts';
import { beginDeclutterFrame, desTapadoDelMotor } from '../labelDeclutter.ts';
import { indiceFrame } from './frameIndex.ts';
import { pickTeeBranchDir } from './teeUtils.ts';
import { drawExtremeAccessorySymbol } from './renderAccessorySymbols.ts';
import { dibujaCuerpoRamal, dibujaEtiquetaRamal } from './ramalBody.ts';
import { pintaAccesoriosExtremos } from './ramalJunctions.ts';

export { pickTeeBranchDir };

/** Índice red→config: evita buscar en NETS por cada ramal dibujado (antes O(ramales×redes)). */
const NET_POR_ID = new Map(NETS.map((n) => [n.id, n]));

/** Memo de snapCandidates del trazo activo (un dibujo a la vez): lista cacheada por firma.
 *  WeakMap por MOTOR (no singleton de módulo): dos visores vivos no se pisan el cache. */
const snapMemo = new WeakMap<object, { firma: number; net: string; lista: PlanoRamal[] }>();

/**
 * Pinta TODOS los ramales del plano, en este orden de capas (no cambiar): cuerpo+etiqueta de
 * cada ramal → flechas de flujo de extremos → accesorios de extremo (tee/codo) → símbolos de
 * aparato → accesorios de mitad de ramal → uniones (tee/yee vent↔san). Los pedazos pesados
 * viven en ramalBody.ts (trazo+cotas+etiquetas) y ramalJunctions.ts (glifos de extremo).
 * Ej: al mover un ramal, este frame re-pinta su trazo, re-coloca su etiqueta con el des-tapado
 * y re-estampa sus accesorios encima.
 */
export function renderRamales(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  const isTributarioMode = engine.tipoTramo === 'tributario' && engine.tool === 'line';
  const padreId = engine.padreTributario;
  // Foto de obstáculos para el auto-orden de etiquetas (solo mueve las nunca tocadas a mano).
  const declutter = beginDeclutterFrame(engine);
  let declutterNeedsSeed = false;
  // Índice del frame compartido: además de tocan/cruzan expone ventRamales/sanRamales/
  // bajantesSan/hayPuntoSan construidos UNA vez por cambio de geometría — antes estos 4
  // (filters + flatMap + Map de ~4000 claves) se reconstruían en CADA render, pan/zoom incluido.
  const indiceF = indiceFrame(engine);
  const firmaFrame = indiceF.firma;
  // Memoria del des-tapado: con la misma geometría y el mismo zoom el sitio elegido por cada
  // etiqueta no cambia (se guarda como desplazamiento desde su centro, que el paneo no mueve),
  // así que mover la cámara no repite la espiral por etiqueta. Se desactiva mientras alguna
  // etiqueta movida a mano todavía no tenga caja: el frame siguiente debe re-converger.
  const puedeMemorizar = !engine.ramales.some((rm) => rm.labelMoved && !rm._labelBox);
  const memoria = puedeMemorizar ? desTapadoDelMotor(engine, firmaFrame) : null;
  engine.ramales.forEach((r) => {
    if (engine._hiddenNets.has(r.net)) return;
    const net = NET_POR_ID.get(r.net);
    const col = net ? net.col : '#e2e2e8';
    const sel = r.id === engine.selId;
    const isPadre = r.id === padreId;
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = (sel ? 3 : 2) * engine.zoom * (engine.lineWidthScale || 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Trazo + puntos de selección + vista previa de conexión (ramalBody.ts).
    dibujaCuerpoRamal(ctx, engine, r, col, sel, isPadre, isTributarioMode);

    if (r.label || r.totalL || r.material || r.diametro || r.pendiente) {
      const FLOW_NETS = ['san', 'll', 'af', 'ac', 'gas'];
      const showFlow = FLOW_NETS.includes(r.net) && r.pts.length >= 2;
      let flowDx = 0,
        flowDy = 0,
        flowLen = 0;
      if (showFlow) {
        // La dirección del flujo se define por el PRIMER segmento creado (pts[0]→pts[1]) — no
        // por el vector extremo-a-extremo, que en ramales multipunto cambia de orientación
        // visual al rotar/editar segmentos posteriores. Al ser un vector geométrico del propio
        // trazo, rota rígidamente con él y nunca se reinvierte por cambios de orientación.
        // Solo _tribReversed (decisión explícita del usuario) lo invierte. El Ldesvio (LD_)
        // usa la misma regla: sus pts nacen [anillo fantasma → bajante original], flecha hacia
        // el original.
        const seg = segmentAtPosition(r.pts, r.labelX, r.labelY);
        const useIdx = seg ? seg.idx : 0;
        const a = engine.toCvs(r.pts[useIdx][0], r.pts[useIdx][1]);
        const b = engine.toCvs(r.pts[useIdx + 1][0], r.pts[useIdx + 1][1]);
        const flip =
          r._tribReversed && (r.tipo === 'tributario' || ['af', 'ac', 'gas'].includes(r.net))
            ? -1
            : 1;
        flowDx = (b.x - a.x) * flip;
        flowDy = (b.y - a.y) * flip;
        flowLen = Math.hypot(flowDx, flowDy);
      }

      // Caja + des-tapado + guía + texto de la etiqueta (ramalBody.ts).
      declutterNeedsSeed =
        dibujaEtiquetaRamal(ctx, engine, r, col, declutter, memoria, {
          showFlow,
          flowDx,
          flowDy,
          flowLen,
        }) || declutterNeedsSeed;
    } else {
      r._labelBox = undefined;
    }

    ctx.restore();

    renderEndpointFlowArrows(ctx, engine, r, {
      ventRamales: indiceF.ventRamales,
      hayPuntoSanCercano: indiceF.hayPuntoSan,
      bajantesSan: indiceF.bajantesSan,
    });
  });

  // Primer frame tras cargar (cajas manuales aún sin calcular): el declutter trabajó sin
  // ellas; un solo pase extra converge. scheduleRender coalesca, no hay recursión.
  if (declutterNeedsSeed) engine.scheduleRender();

  // Dibujar accesorios de extremo (accesorioInicio/Fin) en su propio pase, después de que el
  // trazo del path de cada ramal ya se pintó — si no, la línea de un ramal iterado después
  // (p. ej. un ramal vent que comparte el punto final de un ramal san) pinta encima del
  // símbolo de accesorio de un ramal anterior en ese mismo punto. (ramalJunctions.ts)
  pintaAccesoriosExtremos(ctx, engine, declutter);

  // Símbolos de aparato (fixture) en los extremos — pase extraído a renderAparatoSymbols.ts
  // (con su cache de imágenes de nivel de módulo).
  renderAparatoSymbols(ctx, engine);

  // Dibujar accesorios de mitad de ramal (accMed*) — accesorios asignados a vértices interiores
  // con clic derecho sobre el cuerpo de un ramal, en vez de un extremo. La dirección es la
  // bisectriz de los dos segmentos adyacentes (un vértice interior tiene un segmento "entrante"
  // y uno "saliente", a diferencia de un extremo).
  engine.ramales.forEach((r) => {
    if (engine._hiddenNets.has(r.net)) return;
    if (!r.accMed || !r.pts || r.pts.length < 3) return;

    for (const key of Object.keys(r.accMed)) {
      const m = key.match(/^accMed(\d+)$/);
      if (!m) continue;
      const idx = parseInt(m[1], 10);
      if (idx <= 0 || idx >= r.pts.length - 1) continue;
      const accType = r.accMed[key];
      if (!accType) continue;
      // En AF/AC/gas/vent los glifos de codo ya no se dibujan (codo90rc/rm/rl, sube/baja,
      // codo45rc, codos_90_std): el arco que dibuja drawRamalPath en cada quiebre ES el codo — el
      // círculo "C90"/"C45" al lado solo reduce (REV se dibujaba mal: arco + disco encima = mancha).
      if (
        // codo90rm (orig. usuario) SÍ dibuja glifo: en línea recta no hay quiebre que lo
        // represente y el usuario espera ver el símbolo. Los demás codos de presión siguen
        // sin disco (el arco del quiebre es el codo).
        accType !== 'codo90rm' &&
        (accType.startsWith('codo90') ||
          accType.startsWith('codo45') ||
          accType.startsWith('codos_90')) &&
        (r.net === 'af' || r.net === 'ac' || r.net === 'gas' || r.net === 'vent')
      ) {
        continue;
      }

      const pt = r.pts[idx];

      // Un montante creado a mitad de cuerpo (createMontanteMidBody) auto-escribe este mismo
      // accMed como su contabilidad "implica una tee", pero el círculo+símbolo de dirección del
      // propio montante ya se renderiza justo encima de este mismo punto — dibujar el glifo de
      // tee completo además solo se veía como una línea gruesa estampada sobre el montante. Se
      // salta el glifo dondequiera que haya un bajante.
      const hasBajanteHere = engine.bajantes.some(
        (b) => Math.hypot(b.x - pt[0], b.y - pt[1]) < 0.5,
      );
      if (hasBajanteHere) continue;

      const c = engine.toCvs(pt[0], pt[1]);

      const dxIn = pt[0] - r.pts[idx - 1][0],
        dyIn = pt[1] - r.pts[idx - 1][1];
      const lenIn = Math.hypot(dxIn, dyIn);
      const dxOut = r.pts[idx + 1][0] - pt[0],
        dyOut = r.pts[idx + 1][1] - pt[1];
      const lenOut = Math.hypot(dxOut, dyOut);
      const uxIn = lenIn > 0.01 ? dxIn / lenIn : 1,
        uyIn = lenIn > 0.01 ? dyIn / lenIn : 0;
      const uxOut = lenOut > 0.01 ? dxOut / lenOut : uxIn,
        uyOut = lenOut > 0.01 ? dyOut / lenOut : uyIn;

      let dx = uxIn + uxOut,
        dy = uyIn + uyOut;
      const bisLen = Math.hypot(dx, dy);
      if (bisLen > 0.01) {
        dx /= bisLen;
        dy /= bisLen;
      } else {
        dx = uxIn;
        dy = uyIn;
      }
      // Calcular dos direcciones perpendiculares desde la bisectriz (dirección de paso). Para
      // teeReduccion y teeLado, el brazo de la rama apunta hacia la dirección REAL del ramal
      // que cruza — no ciegamente hacia arriba de pantalla. Cae a la convención "arriba de
      // pantalla" cuando no se encuentra ningún ramal cruzando (accesorio aislado).
      let px = -dy,
        py = dx;
      const branchDir = pickTeeBranchDir(engine, r.id, r.net, pt, dx, dy, px, py);
      px = branchDir.px;
      py = branchDir.py;

      // Tamaño UNIFORME de los glifos de cuerpo (orig. usuario 2026-10-29): todos igual de
      // grandes que teeSube/teeBaja (brazos mm2cvs(1.4), mismas tees geométricas). Todos escalan
      // un rad acorde (antes realMmToCanvasPx(23)*0.6, visiblemente más chico que la tee).
      const rad = accType.startsWith('tee')
        ? engine.realMmToCanvasPx(23) * 0.6
        : engine.mm2cvs(1.4) * 0.4;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      drawExtremeAccessorySymbol({
        ctx,
        engine,
        accType,
        c,
        dx,
        dy,
        px,
        py,
        outX: px,
        outY: py,
        rad,
        declutter,
        // Horquilla del tapón a mitad de ramal: abierta a lo largo del eje del trazo.
        pipeToward: { x: dx, y: dy },
      });
      ctx.restore();
    }
  });

  // Las uniones vent↔san ahora se manejan geométricamente por renderJunctions (vent agrupado en
  // el pase sanitaria), produciendo el glifo tee/yee correcto según la geometría — no más codo
  // reventilado forzado en cada contacto vent-san, que es por lo que el pase viejo de
  // renderVentCodos ya no existe.
  // Tiempo de las uniones (tee/yee): va dentro de `capas.ramales`, se separa para saber si el
  // costo del frame está en el trazo o en las uniones (lo lee `__cfPerf` en DEV).
  const tJun = performance.now();
  renderJunctions(ctx, engine);
  const perf = (engine as { _perf?: { capas: Record<string, number> } })._perf;
  if (perf) perf.capas.junctions = performance.now() - tJun;
}

export function renderActiveRamal(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  if (!engine.activeRamal) return;
  const ar = engine.activeRamal;
  const net = NETS.find((n) => n.id === ar.net);
  const col = net ? net.col : '#e2e2e8';

  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = 2 * engine.zoom * (engine.lineWidthScale || 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (ar.pts.length > 1) {
    drawRamalPath(ctx, ar.pts, engine, col);
  }

  ar.pts.forEach((pt: number[], idx: number) => {
    const px = pt[0],
      py = pt[1];
    const c = engine.toCvs(px, py);
    ctx.save();
    ctx.fillStyle = idx === 0 ? '#fff' : col;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 4 * engine.zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  const first = ar.pts[0];
  const last = ar.pts[ar.pts.length - 1];
  let mp = engine.toPlane(engine.mouseX, engine.mouseY);
  const origMp = { x: mp.x, y: mp.y };

  let snapped = false;

  if (engine.snapMode) {
    mp = engine.snapAngle(last[0], last[1], mp.x, mp.y, ar.net, ar.tipo);
  }

  // Indicador de conexión (ítem 16): círculo cyan punteado cuando el cursor está lo bastante
  // cerca de un elemento existente para conectarse — ramales/tributarios (vértice o cuerpo,
  // vía snapToExisting o el snap 45° al padre) o bajantes. Mismo estilo que el indicador que
  // ya existía para bajantes, ahora unificado para toda conexión posible.
  const connCircle = (cx: number, cy: number, r: number) => {
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 2 * engine.zoom * (engine.lineWidthScale || 1);
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(34,211,238,0.15)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  };

  // snapCandidates constante por (geometría, red): los 2 filters eran O(2n) por mousemove
  // durante todo el dibujo. El memo vive a nivel módulo (un solo trazo activo a la vez).
  const indiceF = indiceFrame(engine);
  let snapCache = snapMemo.get(engine as object);
  if (!snapCache || snapCache.firma !== indiceF.firma || snapCache.net !== ar.net) {
    snapCache = {
      firma: indiceF.firma,
      net: ar.net,
      lista: engine.ramales.filter(
        (r) => r.net === ar.net || (ar.net === 'vent' && r.net === 'san'),
      ),
    };
    snapMemo.set(engine as object, snapCache);
  }
  const snapCandidates = snapCache.lista;
  for (const r of snapCandidates) {
    if (r.id === ar.id) continue;
    // Igual que el trazo real: un ramal no pega a tributarios (evita el círculo
    // cyan de conexión sobre un tributario que luego finishRamal rechaza).
    if (ar.tipo === 'ramal' && r.tipo === 'tributario') continue;
    let segSp = null;
    if (engine.snapMode) {
      segSp = snapTributaryToPadre45Deg(mp.x, mp.y, last[0], last[1], r.pts, 20 / engine.zoom);
    } else {
      segSp = engine._snapToSegment(mp.x, mp.y, r.pts, 20 / engine.zoom);
    }
    if (segSp) {
      mp = segSp;
      snapped = true;
      const sc = engine.toCvs(mp.x, mp.y);
      connCircle(sc.x, sc.y, 4 * engine.zoom);
      break;
    }
  }

  if (!snapped) {
    const sp = engine.snapToExisting(mp.x, mp.y, ar.net, ar.tipo);
    if (sp) {
      mp = sp;
      const sc = engine.toCvs(mp.x, mp.y);
      connCircle(sc.x, sc.y, 4 * engine.zoom);
    }
  }

  const bajThresh = 20 / engine.zoom;
  const nearBaj = engine.bajantes.find((b) => {
    if (engine._hiddenNets.has(b.net) || b.net !== ar.net) return false;
    const disp = b.desplazamientos?.[engine.nivelActual?.label ?? ''] || {};
    return (
      Math.hypot(origMp.x - (b.x + (disp.dx || 0)), origMp.y - (b.y + (disp.dy || 0))) < bajThresh
    );
  });
  if (nearBaj) {
    const disp = nearBaj.desplazamientos?.[engine.nivelActual?.label ?? ''] || {};
    const bx = nearBaj.x + (disp.dx || 0);
    const by = nearBaj.y + (disp.dy || 0);
    mp = { x: bx, y: by };
    snapped = true;
    const bc = engine.toCvs(bx, by);
    connCircle(bc.x, bc.y, 5 * engine.zoom);
  }

  const distFirst = Math.hypot(mp.x - first[0], mp.y - first[1]);
  const SNAP_CLOSE = 12 / engine.zoom;
  if (ar.pts.length >= 3 && distFirst < SNAP_CLOSE) {
    const fc = engine.toCvs(first[0], first[1]);
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 2 * engine.zoom * (engine.lineWidthScale || 1);
    ctx.beginPath();
    ctx.arc(fc.x, fc.y, 4 * engine.zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(34,211,238,0.25)';
    ctx.beginPath();
    ctx.arc(fc.x, fc.y, 4 * engine.zoom, 0, Math.PI * 2);
    ctx.fill();
    mp = { x: first[0], y: first[1] };
  }

  const lc = engine.toCvs(last[0], last[1]);
  const mc = engine.toCvs(mp.x, mp.y);

  ctx.strokeStyle = col + '88';
  ctx.lineWidth = 2 * engine.zoom * (engine.lineWidthScale || 1);
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(lc.x, lc.y);
  ctx.lineTo(mc.x, mc.y);
  ctx.stroke();
  ctx.setLineDash([]);

  const segPx = Math.hypot(mp.x - last[0], mp.y - last[1]);
  const segM = +engine.pxToM(segPx).toFixed(2);
  const deg = (Math.atan2(mp.y - last[1], mp.x - last[0]) * 180) / Math.PI;
  const cursorLabel = `${segM} m  ${Math.round(((deg % 360) + 360) % 360)}°`;
  ctx.font = `${engine.mm2cvs(engine.MM.coord * engine.labelScaleM)}px Geist, monospace`;
  const tw = ctx.measureText(cursorLabel).width;
  ctx.fillStyle = 'rgba(17,19,23,0.82)';
  ctx.fillRect(mc.x + 12, mc.y - 18, tw + 8, 16);
  ctx.fillStyle = '#e2e2e8';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(cursorLabel, mc.x + 16, mc.y - 10);

  ctx.restore();
}
