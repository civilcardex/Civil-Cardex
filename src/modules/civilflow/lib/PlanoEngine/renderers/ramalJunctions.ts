import type { IPlanoEngineCore } from '../PlanoState.ts';
import { drawExtremeAccessorySymbol, drawCornerCodoArc } from './renderAccessorySymbols.ts';
import { drawRamalPath } from './drawRamalPath.ts';
import { pickTeeBranchDir } from './teeUtils.ts';
import type { DeclutterFrame } from '../labelDeclutter.ts';

/** Glifos de EXTREMO de ramal (tee, codo, tapón, sifón...) en su propio pase DESPUÉS de los trazos — así la línea de un ramal posterior ya no tapa el símbolo de uno anterior. Ej: el teeTapon del fin de RS1 se estampa sobre el trazo ya pintado. */
export function pintaAccesoriosExtremos(
  ctx: CanvasRenderingContext2D,
  engine: IPlanoEngineCore,
  declutter: DeclutterFrame,
): void {
  engine.ramales.forEach((r) => {
    if (engine._hiddenNets.has(r.net)) return;
    if (!((r.tipo === 'tributario' || r.tipo === 'ramal') && r.pts.length >= 2)) return;

    [0, r.pts.length - 1].forEach((idx) => {
      let accType = idx === 0 ? r.accesorioInicio : r.accesorioFin;
      // Item 8: un aparato (distinto de nevera) en un extremo AF/AC implica un codo 90° sube —
      // se dibuja el glifo junto al aparato aunque el campo de accesorio esté libre.
      if (!accType && (r.net === 'af' || r.net === 'ac')) {
        const app = idx === 0 ? r.aparatoInicio : r.aparatoFin;
        if (app && app !== 'nev') accType = 'codo90rmSube';
      }
      // El codo/sifón solo se dibuja por el accesorio PERSISTIDO (accesorioInicio/Fin) o por un
      // aparato AF/AC implícito — nunca auto-generado por la presencia de un bajante en el otro
      // extremo (orig. usuario #4: crear un bajante no debe crear un codo 90° sube).
      if (!accType) return;

      const pt = r.pts[idx];
      const c = engine.toCvs(pt[0], pt[1]);

      let dx = 0,
        dy = 0;
      if (idx === 0) {
        dx = r.pts[1][0] - r.pts[0][0];
        dy = r.pts[1][1] - r.pts[0][1];
      } else {
        dx = r.pts[idx][0] - r.pts[idx - 1][0];
        dy = r.pts[idx][1] - r.pts[idx - 1][1];
      }
      const len = Math.hypot(dx, dy);
      if (len > 0.01) {
        dx /= len;
        dy /= len;
      } else {
        dx = 1;
        dy = 0;
      }
      let px = -dy,
        py = dx;
      const branchDir = pickTeeBranchDir(engine, r.id, r.net, pt, dx, dy, px, py);
      px = branchDir.px;
      py = branchDir.py;
      const outX = idx === 0 ? -dx : dx;
      const outY = idx === 0 ? -dy : dy;

      // realMmToCanvasPx piso en 1mm de papel (ver PlanoEngine.ts) — dividir a la mitad el
      // argumento en mm solo es invisible a escalas comunes, ya que ambos caen en ese piso.
      // Se divide el resultado en px.
      const rad = engine.realMmToCanvasPx(23) * 0.6;

      const diamLabel = idx === 0 ? r.diametroInicio : r.diametroFin;

      // Ítem 6: el codo de plano en una esquina L (dos tuberías compartiendo el extremo) usa el
      // símbolo de codo de segmentos — arco + marcas, igual que un quiebre interior — en vez del
      // disco de respaldo con el texto "C90". Los codos de montante (codo90rmSube/Baja,
      // codoSube/Baja) conservan su disco (verticales, sin esquina en planta).
      const isPlanCodo =
        accType === 'codo90rc' ||
        accType === 'codo90rm' ||
        accType === 'codo90rl' ||
        accType === 'codos_90_std' ||
        accType === 'codos_90_rl' ||
        accType === 'codo45' ||
        accType === 'codo45rc' ||
        accType === 'codos_45';
      if (isPlanCodo) {
        // El arco necesita la dirección de la tubería SALIENDO del extremo (away): en el último
        // vértice dx/dy es la dirección de LLEGADA y con ella el arco salía al lado contrario de
        // la esquina ("codo al revés").
        const awayX = idx === 0 ? dx : -dx;
        const awayY = idx === 0 ? dy : -dy;
        // ponytail: un codo de plano sin esquina real (extremo muerto tras borrar el tributario
        // de una unión de guía) no dibuja nada — ni arco ni el disco de respaldo "C90".
        drawCornerCodoArc(ctx, engine, pt, { x: awayX, y: awayY });
        return;
      }

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      drawExtremeAccessorySymbol({
        ctx,
        engine,
        accType,
        c,
        dx: accType === 'teeTapon' || accType === 'teeLlaveTerminal' ? px : dx,
        dy: accType === 'teeTapon' || accType === 'teeLlaveTerminal' ? py : dy,
        px,
        py,
        outX,
        outY,
        rad,
        diamLabel,
        ramal: r,
        slot: idx === 0 ? 'ini' : 'fin',
        declutter,
        // Hacia el cuerpo del ramal (los brazos de la horquilla del tapón abren al trazo).
        pipeToward: { x: -outX, y: -outY },
      });
      ctx.restore();
      // Los glifos de codo (codoSube/codoBaja/codo90rmSube/codo90rmBaja) son discos blancos
      // rellenos dibujados en este pase, DESPUÉS del path del ramal — si el extremo queda cerca
      // del quiebre interior (ramal corto de 2 segmentos), el disco tapa el arco del codo del
      // quiebre. Redibujar solo las marcas de codo (arco/inglete + marcas T_A/T_C, sin el cuerpo
      // de la tubería) para que el símbolo del quiebre interior siga visible.
      if (
        accType === 'codoSube' ||
        accType === 'codoBaja' ||
        accType === 'codo90rmSube' ||
        accType === 'codo90rmBaja'
      ) {
        drawRamalPath(ctx, r.pts, engine, '', { marksOnly: true });
      }
    });
  });
}
