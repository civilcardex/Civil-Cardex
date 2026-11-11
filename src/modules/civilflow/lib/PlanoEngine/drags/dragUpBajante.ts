/**
 * Soltar el arrastre de bajantes y del fantasma entrepisos: el ghost crea el ramal Ldesvio
 * (conector padre→fantasma) si el desplazamiento es real, y el bajante arrastrado valida
 * ángulos de sus ramales asociados (con rollback), propaga su nueva posición cross-floor
 * (Ldesvio y anillo del piso vecino van a storage). Extraído verbatim de handleDragUp.ts.
 * Ej: mover el bajante inferior del enlace re-ancla el ghost del piso superior vía storage.
 */
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';
import { NETS } from '../PlanoState.ts';
import { splitPtr } from '../../../utils/keys.ts';
import { angleAtHalfLength } from '../drawingAngles.ts';
import { checkRamalAnglesExcludingConnections } from '../PlanoEngineDrawing.ts';
import {
  updateCrossFloorGhostPositionBySource,
  updateCrossFloorLdesvioStartPoint,
  updateCrossFloorDesplazamientoAnchor,
  buildLdesvioRamal,
  ldesvioIdFor,
} from '../../../utils/associateBajanteAcrossFloors';

/** Contrato move→up: los backups `_bajDragBackupPts/_bajDragBackupXY` los escribe el MOVE
 *  (handleDragMove.ts / drags/dragBajante.ts) y SOLO aquí se consumen y limpian. Lo mismo
 *  vale para `_dragBackupPts/_dragLinkedBackupPts` con dragUpVertex.ts. */

/** Fantasma entrepisos soltado: si el desplazamiento del piso es ~0 se borra; si no, crea el
 *  ramal conector "Ldesvio" entre el bajante padre y el fantasma (si aún no existe). */
export function dragUpGhost(engine: IPlanoEngineCore): void {
  if (!engine.ghostDrag) return;
  const b = engine.bajantes.find((bb) => bb.id === engine.ghostDrag!.id);
  if (b && engine.nivelActual && b.desplazamientos?.[engine.nivelActual.label ?? '']) {
    const d = b.desplazamientos[engine.nivelActual.label ?? ''];
    if (Math.abs(d.dx) < 1 && Math.abs(d.dy) < 1) {
      delete b.desplazamientos[engine.nivelActual.label ?? ''];
    } else {
      // Crear el ramal "Ldesvio" entre el padre (b.x, b.y) y el fantasma (b.x + d.dx, b.y + d.dy)
      // si todavía no existe — es el conector visual entre el padre y el fantasma.
      const oldLdesvio = d.Ldesvio;
      if (!oldLdesvio) {
        const net = NETS.find((n) => n.id === b.net);
        const pfx = net ? net.lbl : 'R';
        const cnt = ++engine._netCounts[b.net].ramal;
        const ramId = pfx + cnt;
        const ldesvioPts = [
          [b.x, b.y],
          [b.x + d.dx, b.y + d.dy],
        ];
        const ramal: PlanoRamal = {
          id: ramId,
          net: b.net,
          tipo: 'ramal',
          padre: null,
          pts: ldesvioPts,
          totalL: +engine.pxToM(Math.hypot(d.dx, d.dy)).toFixed(3),
          label: pfx + cnt,
          ini: '',
          fin: '',
          piso: String(engine.nivelActual?.n ?? ''),
          dz: '',
          uc: 0,
          labelX: (b.x + b.x + d.dx) / 2,
          labelY: (b.y + b.y + d.dy) / 2,
          labelAngle: angleAtHalfLength(ldesvioPts),
          material: '',
          diametro: '',
          pendiente: 2,
          bloqueado: true,
        };
        engine.ramales.push(ramal);
        d.Ldesvio = ramId;
        engine._emitStatus(`Desplazamiento conectado: ${ramId}`);
      }
    }
  }
  engine.ghostDrag = null;
  engine.render();
  engine._markDirty();
}

/** Bajante/montante soltado: si algún ramal asociado quedó con ángulo inválido, revierte todo
 *  (x/y del bajante y pts de sus ramales) con la alerta; luego propaga la posición final
 *  cross-floor según si el bajante es lado superior (descargaEnId) o inferior (origenId). */
export function dragUpBajante(engine: IPlanoEngineCore): void {
  if (!engine.bajDrag) return;
  const bId = engine.bajDrag.id;
  engine.bajDrag = null;
  engine._markDirty();
  const b = engine.bajantes.find((bb) => bb.id === bId);
  const backupPts = engine._bajDragBackupPts;
  const backupXY = engine._bajDragBackupXY;
  engine._bajDragBackupPts = null;
  engine._bajDragBackupXY = null;
  if (b && backupPts) {
    const assocIds = Object.keys(backupPts);
    const assocRamales = assocIds
      .map((rid) => engine.ramales.find((r) => r.id === rid))
      .filter((r): r is PlanoRamal => !!r);
    const allOk = assocRamales.every((r) => checkRamalAnglesExcludingConnections(engine, r));
    if (!allOk) {
      const bad = assocRamales.find((r) => !checkRamalAnglesExcludingConnections(engine, r))!;
      engine.triggerAlert(
        'Ángulo no recomendado',
        bad.net === 'san' || bad.net === 'll'
          ? 'Las redes sanitarias y de lluvias solo permiten ángulos de 45°. Usar línea guía para ajustar ángulo.'
          : 'Esta red debe diseñarse con ángulos de 45° o 90°. Usar línea guía para ajustar ángulo.',
      );
      if (backupXY) {
        b.x = backupXY.x;
        b.y = backupXY.y;
        if (backupXY.labelX !== undefined) b.labelX = backupXY.labelX;
        if (backupXY.labelY !== undefined) b.labelY = backupXY.labelY;
      }
      for (const r of assocRamales) {
        if (backupPts[r.id]) r.pts = backupPts[r.id];
      }
      engine._markDirty();
      engine.render();
    }
  }
  // Sea cual sea la posición final x/y (incluida la posterior al rollback), propagarla según
  // el layout nuevo: este bajante SUPERIOR (descargaEnId) no mueve el ghost-marcador — ese
  // vive en ESTE piso anclado a las coords del inferior y la línea punteada se redibuja sola
  // desde posiciones vivas — pero sí el inicio de su Ldesvio y su anillo, que viven en el
  // piso INFERIOR (no cargado): escritura directa a storage.
  if (b && b.descargaEnId) {
    const [targetPlanId, targetBajanteId] = splitPtr(b.descargaEnId, '');
    if (targetPlanId && targetBajanteId) {
      updateCrossFloorLdesvioStartPoint(targetPlanId, b.id, b.x, b.y);
      updateCrossFloorDesplazamientoAnchor(
        targetPlanId,
        targetBajanteId,
        ldesvioIdFor(b.id),
        b.x,
        b.y,
      );
      engine.render();
    }
  }
  // Este bajante es el lado INFERIOR del enlace (origenId) y su piso SÍ está cargado: el
  // Ldesvio y el anillo viven aquí (arrays vivos — el arrastre ya los siguió) y el
  // ghost-marcador del piso superior se re-ancla a las nuevas coords vía storage.
  if (b && b.origenId) {
    const [originPlanId, originBajanteId] = splitPtr(b.origenId, '');
    if (originPlanId && originBajanteId) {
      const ldId = ldesvioIdFor(originBajanteId);
      const ld = engine.ramales.find((r) => r.id === ldId);
      if (ld && ld.pts?.length === 2) {
        const [start] = ld.pts;
        const updated = buildLdesvioRamal(
          ldId,
          ld.label || ldId,
          ld.net,
          start[0],
          start[1],
          b.x,
          b.y,
          ld.diametro || '',
          Number(ld.piso) || 0,
          engine.scaleM || 0.5,
          ld.bloqueado,
        );
        Object.assign(ld, updated);
      }
      updateCrossFloorGhostPositionBySource(String(engine._loadedPlanId ?? ''), b.id, b.x, b.y);
      engine.render();
    }
  }
}
