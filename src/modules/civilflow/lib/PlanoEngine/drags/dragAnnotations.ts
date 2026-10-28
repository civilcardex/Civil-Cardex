import type { IPlanoEngineCore, PlanoRamal, PlanoBajante, PlanoArea } from '../PlanoState.ts';
import { isBajante } from '../PlanoState.ts';
import { snapGuidePoint } from '../PlanoEngineDrawing.ts';
import { angleAtPosition } from '../drawingAngles.ts';
import {
  oppositeTextCorner,
  textLocalCorner,
  rotateLocalPoint,
} from '../textAnnotationGeometry.ts';
import { normalizarCanal, pxPerCmDe } from '../channelAssociation';
import { _calcPolyArea } from '../drawingUtils.ts';
import { gapAnclaACaja } from '../labelDeclutter.ts';

/** Arrastre de una GUÍA: mueve ESE vértice (con el snap del dibujo de guías) o la entidad
 *  completa — la guía es una sola pieza con varios vértices. */
export function dragGuide(engine: IPlanoEngineCore, x: number, y: number): void {
  const g = engine.guideLines.find((gg) => gg.id === engine.guideDrag!.id);
  if (g) {
    const tp = engine.toPlane(x, y);
    if (engine.guideDrag!.endIdx !== undefined && g.pts.length >= 2) {
      // Ítem 2: mover ESE vértice (cualquiera, no solo extremos), con el mismo snap que el
      // dibujo de guías — el ángulo se mide contra el vecino adyacente.
      const idx = engine.guideDrag!.endIdx;
      const other =
        idx > 0 ? engine.guideDrag!.origPts[idx - 1] : engine.guideDrag!.origPts[idx + 1];
      let px = tp.x;
      let py = tp.y;
      if (engine.snapMode) {
        const snapped = snapGuidePoint(engine, { x: other[0], y: other[1] }, px, py);
        px = snapped.x;
        py = snapped.y;
      }
      g.pts[idx] = [px, py];
    } else {
      const dx = tp.x - engine.guideDrag!.startX;
      const dy = tp.y - engine.guideDrag!.startY;
      g.pts = engine.guideDrag!.origPts.map((pt) => [pt[0] + dx, pt[1] + dy] as [number, number]);
    }
    engine.render();
  }
}

/** Arrastre de una ETIQUETA (ramal/bajante/área): etiqueta del padre → labelX/labelY;
 *  etiqueta fantasma de bajante → ghostData[lbl]; sifón con slot → sifonLabelIni/Fin. */
export function dragLabel(engine: IPlanoEngineCore, x: number, y: number): void {
  const el =
    engine.ramales.find((r) => r.id === engine.lblDrag!.id) ||
    engine.bajantes.find((b) => b.id === engine.lblDrag!.id) ||
    engine.areas.find((a) => a.id === engine.lblDrag!.id);
  if (el) {
    // Primer agarre de una etiqueta NUNCA movida: la caja agarrada puede estar DESPLAZADA
    // del ancla (el des-tapado mueve lo pintado sin tocar labelX/labelY). Re-anclar el ancla
    // al "centro agarrado menos gap" y corregir el offset del gesto en el mismo paso — sin
    // esto, al encenderse labelMoved abajo el declutter se apaga y la etiqueta TELEPORTA el
    // desplazamiento completo (orig. usuario: la primera vez no sigue bien el cursor).
    // SOLO ramales sin slot: son los únicos con declutter. Bajantes (offset constante
    // propio), áreas, etiquetas fantasma (escriben ghostData) y sifón (escribe
    // sifonLabelIni/Fin) NO declutteran — la fórmula de gap de ramal les desplazaría el
    // ancla (y en fantasma/sifón corrompería un drag que ni toca labelX).
    const tipoEl = (el as PlanoRamal).tipo;
    const caja = (el as PlanoRamal)._labelBox;
    if (
      (tipoEl === 'ramal' || tipoEl === 'tributario') &&
      !engine.lblDrag!.slot &&
      !el.labelMoved &&
      caja &&
      el.labelX != null
    ) {
      const anclaCvs = engine.toCvs(el.labelX, el.labelY!);
      const gap = gapAnclaACaja(caja.h, caja.angle, engine.mm2cvs.bind(engine), engine.zoom);
      const dAncla = { x: caja.cx - gap.x - anclaCvs.x, y: caja.cy - gap.y - anclaCvs.y };
      engine.lblDrag!.offX -= dAncla.x;
      engine.lblDrag!.offY -= dAncla.y;
      const anclaNueva = engine.toPlane(caja.cx - gap.x, caja.cy - gap.y);
      el.labelX = anclaNueva.x;
      el.labelY = anclaNueva.y;
    }
    const p = engine.toPlane(x - engine.lblDrag!.offX, y - engine.lblDrag!.offY);
    // Solo un bajante tiene posiciones de etiqueta "fantasma" entre pisos (ghostData, una por
    // piso) — los ramales/áreas nunca. Se usa la bandera _lblDragIsParent: si el arrastre
    // empezó en la etiqueta del padre se actualiza labelX/labelY; si no (etiqueta fantasma),
    // se actualiza ghostData. Además se condiciona con isBajante(el), para que un arrastre de
    // etiqueta de ramal/área siempre escriba labelX/labelY directo — sin eso, cada arrastre de
    // etiqueta de ramal/área caía en la rama fantasma (isParentDrag nunca se fija true para
    // ellos) y escribía en una propiedad ghostData inexistente, así que la etiqueta nunca se
    // movía de verdad.
    const isParentDrag = !!engine._lblDragIsParent;
    if (engine.lblDrag!.slot && !isBajante(el)) {
      const ramal = el as PlanoRamal;
      if (engine.lblDrag!.slot === 'ini') ramal.sifonLabelIni = [p.x, p.y];
      else ramal.sifonLabelFin = [p.x, p.y];
    } else if (!isParentDrag && engine.nivelActual && isBajante(el)) {
      const baj = el;
      const lbl = engine.nivelActual.label ?? '';
      if (!baj.ghostData) baj.ghostData = {};
      if (!baj.ghostData[lbl]) baj.ghostData[lbl] = {};
      baj.ghostData[lbl].labelX = p.x;
      baj.ghostData[lbl].labelY = p.y;
    } else {
      const moved = el as PlanoRamal | PlanoBajante | PlanoArea;
      moved.labelX = p.x;
      moved.labelY = p.y;
      // El usuario movió la etiqueta a mano: el auto-orden ya no la toca.
      moved.labelMoved = true;
      // Etiqueta de ramal: actualizar también su ángulo para que la flecha siga
      // el segmento donde cae la etiqueta, manteniendo el mismo sentido
      if ('pts' in el && Array.isArray((el as PlanoRamal).pts)) {
        const ramal = el as PlanoRamal;
        if (ramal.pts && ramal.pts.length >= 2) {
          ramal.labelAngle = angleAtPosition(ramal.pts, p.x, p.y);
        }
      }
    }
    engine.scheduleRender();
  }
}

/** Arrastre de una anotación de texto: posición desde el origen del gesto. */
export function dragText(engine: IPlanoEngineCore, x: number, y: number): void {
  const t = engine.textAnnots.find((tt) => tt.id === engine.txtDrag!.id);
  if (t) {
    const p = engine.toPlane(x, y);
    t.x = engine.txtDrag!.origX + (p.x - engine.txtDrag!.startX);
    t.y = engine.txtDrag!.origY + (p.y - engine.txtDrag!.startY);
    engine.scheduleRender();
  }
}

/** Resize de una anotación de texto (por esquina): fuente y caja escalan con la distancia
 *  al ancla, y la esquina OPUESTA queda clavada en su posición original de canvas. */
export function dragTextResize(engine: IPlanoEngineCore, x: number, y: number): void {
  const t = engine.textAnnots.find((tt) => tt.id === engine.txtResize!.id);
  if (t) {
    const { corner, anchorX, anchorY, startDist, origFontMm, origBoxWpx } = engine.txtResize!;
    const dist = Math.hypot(x - anchorX, y - anchorY);
    const scale = startDist > 0.01 ? Math.max(0.2, Math.min(6, dist / startDist)) : 1;
    const newFontMm = Math.max(1, Math.min(40, origFontMm * scale));
    const pad = 5 * engine.zoom;
    const newBoxWFull = Math.max(pad * 2 + 4, origBoxWpx * scale);
    t.fontMm = newFontMm;
    t.boxW = (newBoxWFull - pad * 2) / engine.zoom;

    // Mantener la esquina ancla (la opuesta a la que se arrastra) clavada en su posición
    // original de canvas — recalcular dónde debe quedar el origen de traslación de la caja
    // (t.x/t.y) para que la esquina ancla de la caja NUEVA (redimensionada) caiga exactamente
    // ahí.
    const fs2 = engine.mm2cvs(newFontMm);
    const boxHFull2 = fs2 + pad * 2;
    const angle = ((t.textAngle || 0) * Math.PI) / 180;
    const anchorCorner = oppositeTextCorner(corner);
    const local = textLocalCorner(anchorCorner, fs2, pad, newBoxWFull, boxHFull2);
    const rot = rotateLocalPoint(local.lx, local.ly, angle);
    const newC = engine.toPlane(anchorX - rot.x, anchorY - rot.y);
    t.x = newC.x - (t.lblOffX || 0);
    t.y = newC.y - (t.lblOffY || 0);
    engine.scheduleRender();
  }
}

/** Resize de un CANAL por su esquina, en el marco local del inicio del gesto (la esquina
 *  opuesta no se mueva aunque el canal esté en diagonal). Dims en cm + normalizarCanal. */
export function dragCanalResize(engine: IPlanoEngineCore, x: number, y: number): void {
  // Resize en el MARCO LOCAL del inicio del gesto (origen+ángulo fijos): la esquina opuesta
  // no se mueve aunque el canal esté en diagonal. Dims en cm + normalizarCanal por si el
  // marco se invierte al cruzar la diagonal.
  const { id, anchorLX, anchorLY, oX, oY, ang } = engine.canalResizeDrag!;
  const canal = engine.bajantes.find((b) => b.id === id);
  if (canal) {
    const p = engine.toPlane(x, y);
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const plx = (p.x - oX) * c + (p.y - oY) * s;
    const ply = -(p.x - oX) * s + (p.y - oY) * c;
    const minLX = Math.min(anchorLX, plx);
    const maxLX = Math.max(anchorLX, plx);
    const minLY = Math.min(anchorLY, ply);
    const maxLY = Math.max(anchorLY, ply);
    canal.x = oX + minLX * c - minLY * s;
    canal.y = oY + minLX * s + minLY * c;
    const cmPorUnidad = 1 / pxPerCmDe(engine);
    canal.longitud = Math.max(1, +((maxLX - minLX) * cmPorUnidad).toFixed(1));
    canal.base = Math.max(1, +((maxLY - minLY) * cmPorUnidad).toFixed(1));
    canal.angulo = (ang * 180) / Math.PI;
    normalizarCanal(1 / cmPorUnidad, canal);
    engine.scheduleRender();
  }
}

/** Arrastre de la etiqueta de una COTA. */
export function dragDimLabel(engine: IPlanoEngineCore, x: number, y: number): void {
  const d = engine.dims.find((dd) => dd.id === engine.dimLblDrag!.id);
  if (d) {
    const p = engine.toPlane(x - engine.dimLblDrag!.offX, y - engine.dimLblDrag!.offY);
    d.lblX = p.x;
    d.lblY = p.y;
    engine.scheduleRender();
  }
}

/** Arrastre de una COTA completa: extremos y etiqueta se desplazan juntos. */
export function dragDim(engine: IPlanoEngineCore, x: number, y: number): void {
  const d = engine.dims.find((dd) => dd.id === engine.dimDrag!.id);
  if (d) {
    const p = engine.toPlane(x, y);
    const dx = p.x - engine.dimDrag!.startX;
    const dy = p.y - engine.dimDrag!.startY;
    d.x1 += dx;
    d.y1 += dy;
    d.x2 += dx;
    d.y2 += dy;
    if (d.lblX != null && d.lblY != null) {
      d.lblX += dx;
      d.lblY += dy;
    }
    engine.dimDrag!.startX = p.x;
    engine.dimDrag!.startY = p.y;
    engine.scheduleRender();
  }
}

/** PUNTO 5: arrastre de VÉRTICE de área — redimensionar moviendo esa esquina, con límite
 *  anti-degenerado contra sus DOS vértices adyacentes (área mínima). */
export function dragAreaVertex(engine: IPlanoEngineCore, x: number, y: number): void {
  const a = engine.areas.find((aa) => aa.id === engine.areaPtDrag!.id);
  if (a && a.pts[engine.areaPtDrag!.idx]) {
    const p = engine.toPlane(x, y);
    const drag = engine.areaPtDrag!;
    // PUNTO 5: offset agarre→vértice — sin salto inicial; el vértice sigue al puntero
    // manteniendo su agarre relativo.
    let nx = p.x + drag.offX;
    let ny = p.y + drag.offY;
    // Límite anti-degenerado: el vértice no puede acercarse a sus DOS vértices adyacentes
    // menos de MIN (antes lo confinaba al bbox de los demás — eso lo pegaba a esos ejes y
    // lo hacía saltar al borde de la caja al agarrar, orig. usuario).
    const n = a.pts.length;
    const prev = a.pts[(drag.idx - 1 + n) % n];
    const next = a.pts[(drag.idx + 1) % n];
    const MIN = 10;
    const pushOut = (ax: number, ay: number) => {
      const dx = nx - ax;
      const dy = ny - ay;
      const d = Math.hypot(dx, dy);
      if (d < MIN) {
        if (d < 0.001) {
          nx = ax + MIN;
          ny = ay;
        } else {
          nx = ax + (dx / d) * MIN;
          ny = ay + (dy / d) * MIN;
        }
      }
    };
    pushOut(prev[0], prev[1]);
    pushOut(next[0], next[1]);
    a.pts[drag.idx] = [nx, ny];
    a.areaM2 = _calcPolyArea(engine, a.pts);
    engine.scheduleRender();
  }
}

/** Arrastre de un ÁREA completa: vértices + etiqueta absoluta se desplazan juntos. */
export function dragArea(engine: IPlanoEngineCore, x: number, y: number): void {
  const a = engine.areas.find((aa) => aa.id === engine.areaDrag!.id);
  if (a) {
    const p = engine.toPlane(x, y);
    const dx = p.x - engine.areaDrag!.startX;
    const dy = p.y - engine.areaDrag!.startY;
    a.pts.forEach((pt) => {
      pt[0] += dx;
      pt[1] += dy;
    });
    if (a.labelX !== undefined) {
      a.labelX += dx;
      a.labelY += dy;
    }
    engine.areaDrag!.startX = p.x;
    engine.areaDrag!.startY = p.y;
    engine.scheduleRender();
  }
}
