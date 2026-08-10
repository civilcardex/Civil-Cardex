import { NETS } from '../PlanoState';
import { snapTributaryToPadre45Deg } from '../PlanoEngineDrawing';
import { rotatedRectCorners, pointToSegmentDist } from '../HitTester';
import type { IPlanoEngineCore, PlanoBajante, PlanoRamal } from '../PlanoState';
import { normalizeDnLabel } from '../../../utils/formatUtils';
import { pisoCortoLoose as getPisoCorto, matDrawingLabel, APARATO_IMG } from '../../../constants';
import { drawRamalPath } from './drawRamalPath';
import { renderJunctions } from './renderJunctions';

// Cache de nivel de módulo para los símbolos de aparato (drawRamalPath + pase de aparato
// abajo). DEBE vivir aquí, no dentro de renderRamales: un cache por-render se borra en cada
// engine.render(), así que la imagen reiniciaría su carga en cada pase, nunca se dibujaría, y
// cada onload dispararía otro render (bucle infinito de recargas). Con un cache de nivel de
// módulo el primer render arranca la carga, onload guarda la imagen y re-renderiza una vez, y
// el siguiente pase la dibuja síncronamente desde el cache.
const aparatoImgCache = new Map<string, HTMLImageElement | null>();

/**
 * Elige el lado de rama (perpendicular) para un glifo teeReduccion/teeLado en una unión.
 * `throughDx/throughDy` es la dirección propia del ramal en el punto (para un extremo: el
 * rumbo del segmento adyacente; para un vértice de medio cuerpo: la bisectriz). El brazo de
 * rama del glifo debe apuntar hacia el ramal que realmente cruza/se ramifica — no ciegamente
 * hacia arriba de pantalla.
 * Estrategia: buscar el segmento de la misma red cerca de `pt` que sea MÁS PERPENDICULAR a la
 * dirección de paso (|dot| mínimo). Un segmento colineal (p. ej. el tope dividido de esta
 * misma unión, u otros segmentos del propio ramal) también toca el punto pero da |dot| ~ 1 y
 * pierde ante el tributario realmente perpendicular (|dot| ~ 0). Si no se encuentra ninguno
 * (accesorio aislado, sin cruce), cae a la convención clásica "arriba de pantalla para
 * horizontal, derecha para vertical".
 */
export function pickTeeBranchDir(
  engine: IPlanoEngineCore,
  ownId: string,
  net: string,
  pt: number[],
  throughDx: number,
  throughDy: number,
  fallbackPx: number,
  fallbackPy: number,
): { px: number; py: number } {
  const px = fallbackPx;
  const py = fallbackPy;
  const pxAlt = -fallbackPx;
  const pyAlt = -fallbackPy;
  const CROSS_TOL = 0.5;
  let crossDir: { x: number; y: number } | null = null;
  let bestPerp = 2;
  for (const cr of engine.ramales) {
    if (cr.net !== net || cr.id === ownId) continue;
    if (!cr.pts || cr.pts.length < 2) continue;
    for (let ci = 0; ci < cr.pts.length - 1; ci++) {
      if (
        pointToSegmentDist(
          pt[0],
          pt[1],
          cr.pts[ci][0],
          cr.pts[ci][1],
          cr.pts[ci + 1][0],
          cr.pts[ci + 1][1],
        ) < CROSS_TOL
      ) {
        // Debe apuntar DESDE la unión HACIA el cuerpo real del ramal rama — la dirección cruda
        // del segmento ci->ci+1 depende del orden arbitrario de puntos de ese ramal (p. ej. si
        // `pt` es el propio punto final de ese segmento, ci->ci+1 apunta hacia adelante pasando
        // el punto final hacia la nada, al revés de donde está el material real de la tubería),
        // lo que elegía el lado equivocado abajo cuando el ramal cruzado quedaba dibujado
        // "lejos-y-vuelta". Anclar en el que sea de los dos extremos del segmento que queda MÁS
        // LEJOS de `pt` es independiente del orden.
        const dToCi = Math.hypot(cr.pts[ci][0] - pt[0], cr.pts[ci][1] - pt[1]);
        const dToCiNext = Math.hypot(cr.pts[ci + 1][0] - pt[0], cr.pts[ci + 1][1] - pt[1]);
        const farPt = dToCi >= dToCiNext ? cr.pts[ci] : cr.pts[ci + 1];
        const cdx = farPt[0] - pt[0];
        const cdy = farPt[1] - pt[1];
        const clen = Math.hypot(cdx, cdy);
        if (clen <= 0.01) continue;
        const ux = cdx / clen;
        const uy = cdy / clen;
        const d = Math.abs(ux * throughDx + uy * throughDy);
        if (d < bestPerp) {
          bestPerp = d;
          crossDir = { x: ux, y: uy };
        }
      }
    }
  }
  if (crossDir) {
    const dotP = px * crossDir.x + py * crossDir.y;
    const dotA = pxAlt * crossDir.x + pyAlt * crossDir.y;
    if (dotA > dotP) {
      return { px: pxAlt, py: pyAlt };
    }
    return { px, py };
  }
  // Respaldo: normalizar hacia arriba de pantalla si la perpendicular es casi horizontal, o
  // hacia la derecha si es casi vertical (convención clásica de dibujo).
  const PERP_EPS = 0.1;
  if (py > PERP_EPS) {
    return { px: -px, py: -py };
  }
  if (Math.abs(py) <= PERP_EPS && px < 0) {
    return { px: -px, py: -py };
  }
  return { px, py };
}

// Compartido por el renderizado de accesorios de extremo (accesorioInicio/Fin) y de mitad de
// ramal (accMed*). `outX,outY` es la dirección "apuntando lejos de la tubería" — para un
// extremo es alejándose del propio cuerpo del ramal; para un vértice de mitad de ramal es la
// normal perpendicular (px,py) porque ahí no hay un solo lado "hacia afuera". El caller es
// responsable de ctx.save()/restore().
function drawExtremeAccessorySymbol(
  ctx: CanvasRenderingContext2D,
  engine: IPlanoEngineCore,
  accType: string,
  c: { x: number; y: number },
  dx: number,
  dy: number,
  px: number,
  py: number,
  outX: number,
  outY: number,
  rad: number,
  diamLabel?: string,
  ramal?: PlanoRamal,
  slot?: 'ini' | 'fin',
): void {
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
    ctx.lineWidth = 0.6 * engine.zoom;
    ctx.lineCap = 'round';
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
    // por defecto.
    if (diamLabel) {
      const fs = engine.mm2cvs(engine.MM.lblInfo * engine.labelScaleM);
      ctx.font = `bold ${fs}px Geist, monospace`;
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const labelOff = H2 * 0.9 + fs * 0.6;
      const defaultLabelX = pt_riser_topX - dnX * labelOff;
      const defaultLabelY = pt_riser_topY - dnY * labelOff;
      const storedPlane =
        ramal && slot ? (slot === 'ini' ? ramal.sifonLabelIni : ramal.sifonLabelFin) : undefined;
      const labelCvs = storedPlane
        ? engine.toCvs(storedPlane[0], storedPlane[1])
        : { x: defaultLabelX, y: defaultLabelY };
      const text = `S  D=${normalizeDnLabel(diamLabel.split(' — ')[0])}"`;
      ctx.fillText(text, labelCvs.x, labelCvs.y);

      if (ramal && slot) {
        const tw = ctx.measureText(text).width;
        const boxW = tw + engine.mm2cvs(2);
        const boxH = fs + engine.mm2cvs(1);
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
      }
    }
  } else if (accType === 'codoSube') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.6 * engine.zoom;
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad * 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (accType === 'codoBaja') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.6 * engine.zoom;
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    const offset = rad * Math.SQRT1_2;
    ctx.moveTo(c.x - offset, c.y - offset);
    ctx.lineTo(c.x + offset, c.y + offset);
    ctx.moveTo(c.x + offset, c.y - offset);
    ctx.lineTo(c.x - offset, c.y + offset);
    ctx.stroke();
  } else if (accType === 'codo90rmSube') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.6 * engine.zoom;
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad * 0.25, 0, Math.PI * 2);
    ctx.fill();
  } else if (accType === 'codo90rmBaja') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.6 * engine.zoom;
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const aS = rad * 0.7;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = rad * 0.15;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - aS * 0.9);
    ctx.lineTo(c.x, c.y + aS * 0.5);
    ctx.stroke();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y + aS * 0.9);
    ctx.lineTo(c.x - aS * 0.4, c.y + aS * 0.3);
    ctx.lineTo(c.x + aS * 0.4, c.y + aS * 0.3);
    ctx.closePath();
    ctx.fill();
  } else if (accType === 'teeSube' || accType === 'teeBaja') {
    // teeDirecto NO dibuja nada aquí a propósito — una tee recta simple siempre es detectable
    // geométricamente (3 segmentos compartiendo este vértice exacto), así que el pase
    // puramente geométrico de renderJunctions.ts ya la dibuja, sin dependencia de datos que
    // pueda quedarse vieja. Duplicarla aquí (como esta rama solía hacer, para los tres tipos de
    // tee) dibujaba un segundo símbolo encima. teeSube/teeBaja se quedan aquí porque cargan
    // info de DIRECCIÓN (sube/baja) que el detector geométrico no tiene forma de saber — eso
    // necesita un glifo respaldado por datos reales, no solo topología.
    // Mismo lenguaje visual que el glifo tee/yee auto-detectado geométricamente
    // (renderJunctions.ts): tres brazos finos irradiando del punto con una marca perpendicular
    // pequeña al final de cada brazo — sin disco blanco/anillo negro de fondo (ese es el estilo
    // de los OTROS glifos de accesorio — codo, etc — y era lo que hacía que esto se viera
    // sobredimensionado/inconsistente). Dos brazos siguen la dirección recta propia del ramal
    // (dx,dy); el tercero (px,py) marca la rama que se une aquí. Mismas constantes mm2cvs(2.0)
    // / mm2cvs(0.8) que usa renderJunctions.ts, así que la escala coincide exactamente.
    const juncRad = engine.mm2cvs(2.0);
    const tickLen = engine.mm2cvs(0.8);
    const armW = 2 * engine.zoom; // mismo ancho de trazo que la tubería propia (no seleccionada) de drawRamalPath, para que el glifo se funda con la línea del ramal
    const arms: { x: number; y: number }[] = [
      { x: dx, y: dy },
      { x: -dx, y: -dy },
      { x: px, y: py },
    ];
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = armW;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const a of arms) {
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + a.x * juncRad, c.y + a.y * juncRad);
    }
    ctx.stroke();

    ctx.lineWidth = armW;
    ctx.beginPath();
    for (const a of arms) {
      const ex = c.x + a.x * juncRad,
        ey = c.y + a.y * juncRad;
      const perpX = -a.y,
        perpY = a.x;
      ctx.moveTo(ex - (perpX * tickLen) / 2, ey - (perpY * tickLen) / 2);
      ctx.lineTo(ex + (perpX * tickLen) / 2, ey + (perpY * tickLen) / 2);
    }
    ctx.stroke();

    // Un círculo en la unión — misma convención codoSube/codoBaja (disco blanco, anillo negro) —
    // con la marca de dirección DENTRO (punto para sube, flecha para baja), según la imagen de
    // referencia.
    const circR = juncRad * 0.45;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.6 * engine.zoom;
    ctx.beginPath();
    ctx.arc(c.x, c.y, circR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (accType === 'teeSube') {
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(c.x, c.y, circR * 0.35, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Flecha hacia abajo (línea + triángulo relleno) dimensionada para caber dentro del
      // círculo, coincidiendo con el símbolo "baja" propio de un bajante/montante en vez de la
      // cruz diagonal de codoBaja.
      const aS = circR * 0.85;
      ctx.fillStyle = '#000000';
      ctx.lineWidth = circR * 0.22;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - aS * 0.8);
      ctx.lineTo(c.x, c.y + aS * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(c.x, c.y + aS * 0.8);
      ctx.lineTo(c.x - aS * 0.35, c.y + aS * 0.2);
      ctx.lineTo(c.x + aS * 0.35, c.y + aS * 0.2);
      ctx.closePath();
      ctx.fill();
    }
  } else if (accType === 'teeReduccion' || accType === 'teeLado') {
    // Glifo de tee real (tres brazos + marcas de extremo), mismo lenguaje visual que la tee
    // geométrica (renderJunctions.ts) y teeSube/teeBaja. La rama
    // (px,py) se une perpendicular a la dirección de paso (dx,dy). teeReduccion dibuja el
    // brazo de la rama más angosto (diámetro reducido) con un collar corto de ancho completo en
    // la unión; teeLado mantiene la rama a ancho completo.
    const juncRad = engine.mm2cvs(2.0);
    const tickLen = engine.mm2cvs(0.8);
    const armW = 2 * engine.zoom;
    const branchW = accType === 'teeReduccion' ? armW * 0.55 : armW;
    ctx.strokeStyle = '#000000';
    ctx.lineCap = 'round';
    // Brazos de paso (ancho completo)
    ctx.lineWidth = armW;
    ctx.beginPath();
    ctx.moveTo(c.x + dx * juncRad, c.y + dy * juncRad);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(c.x - dx * juncRad, c.y - dy * juncRad);
    ctx.stroke();
    if (accType === 'teeReduccion') {
      // Collar de reducción: tope de ancho completo justo en la unión, después el brazo de la
      // rama delgado.
      ctx.beginPath();
      ctx.moveTo(c.x + px * juncRad * 0.35, c.y + py * juncRad * 0.35);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
      ctx.lineWidth = branchW;
      ctx.beginPath();
      ctx.moveTo(c.x + px * juncRad * 0.35, c.y + py * juncRad * 0.35);
      ctx.lineTo(c.x + px * juncRad, c.y + py * juncRad);
      ctx.stroke();
    } else {
      ctx.lineWidth = branchW;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + px * juncRad, c.y + py * juncRad);
      ctx.stroke();
    }
    // Marcas de extremo en los tres brazos
    ctx.lineWidth = armW * 0.8;
    ctx.beginPath();
    for (const a of [
      { x: dx, y: dy },
      { x: -dx, y: -dy },
      { x: px, y: py },
    ]) {
      const ex = c.x + a.x * juncRad,
        ey = c.y + a.y * juncRad;
      const perpX = -a.y,
        perpY = a.x;
      ctx.moveTo(ex - (perpX * tickLen) / 2, ey - (perpY * tickLen) / 2);
      ctx.lineTo(ex + (perpX * tickLen) / 2, ey + (perpY * tickLen) / 2);
    }
    ctx.stroke();
  } else if (accType === 'teeTapon') {
    // Tallo alto saliendo del punto de rama (outX,outY), rematado con una barra perpendicular
    // en el tope. Los dos extremos de la barra se doblan HACIA ABAJO hacia el tallo (un
    // corchete "⊓", no marcas abiertas apuntando más lejos) — más una marca corta justo sobre
    // el ramal mismo en el punto de unión, a lo largo de la dirección propia del ramal
    // (dx,dy), distinguiendo el punto de tee de la tubería simple a ambos lados. La línea real
    // del ramal ya pasa recta por este punto interior (dibujada por drawRamalPath); esto solo
    // agrega la rama, su tapa y la marca de unión.
    const armW = 0.9 * engine.zoom;
    const ramalW = 2 * engine.zoom; // mismo ancho de trazo que la tubería propia (no seleccionada) de drawRamalPath, para que el glifo se funda con la línea del ramal
    const stemLen = rad * 3.5;
    const capHalf = rad * 0.9;
    const capTick = rad * 1.1;
    const jointHalf = rad * 0.7;
    const stemEndX = c.x + outX * stemLen,
      stemEndY = c.y + outY * stemLen;
    ctx.strokeStyle = '#000000';
    ctx.lineCap = 'round';
    // Marca de unión sobre el ramal mismo — mismo grosor que la tubería del ramal, no las líneas
    // (más finas) del símbolo de arriba.
    ctx.lineWidth = ramalW;
    ctx.beginPath();
    ctx.moveTo(c.x + dx * jointHalf, c.y + dy * jointHalf);
    ctx.lineTo(c.x - dx * jointHalf, c.y - dy * jointHalf);
    ctx.stroke();
    // Tallo
    ctx.lineWidth = armW;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(stemEndX, stemEndY);
    ctx.stroke();
    // Barra de tapa
    const capLX = stemEndX + dx * capHalf,
      capLY = stemEndY + dy * capHalf;
    const capRX = stemEndX - dx * capHalf,
      capRY = stemEndY - dy * capHalf;
    ctx.beginPath();
    ctx.moveTo(capLX, capLY);
    ctx.lineTo(capRX, capRY);
    ctx.stroke();
    // Pies del corchete — se doblan hacia el tallo/ramal (-outX,-outY), no alejándose
    ctx.lineWidth = 0.6 * engine.zoom;
    ctx.beginPath();
    ctx.moveTo(capLX, capLY);
    ctx.lineTo(capLX - outX * capTick, capLY - outY * capTick);
    ctx.moveTo(capRX, capRY);
    ctx.lineTo(capRX - outX * capTick, capRY - outY * capTick);
    ctx.stroke();
  } else if (accType === 'teeLlaveTerminal') {
    // Silueta trazada directamente del dibujo de referencia, expresada en un marco local para
    // que rote con el ramal: `a` corre a lo largo del ramal (dx,dy), `b` sale a lo largo de la
    // rama (outX,outY). El origen es el punto de unión `c` sobre el ramal. Todas las
    // coordenadas de abajo están en unidades de H, medidas de esa referencia:
    //
    //   b=4.07  ·                    ╱  punta del pitorro
    //   b=3.06  ·  ⊢────codo  ← barra del mango + marca de extremo, el pitorro hace S por aquí
    //   b=2.00  ·      ──┼──         barra transversal
    //   b=0.00  ·  ├─────┴─────┤     barra tee sobre el ramal, marcas en ambos extremos
    //
    // Un solo grosor de trazo uniforme en todo el símbolo, tapas y uniones redondas — un pase
    // vectorial/logo limpio sobre la misma silueta, sin contraste de grosor entre la barra del
    // ramal y el resto, según la referencia.
    const H = rad;
    const P = (a: number, b: number) => ({
      x: c.x + dx * a * H + outX * b * H,
      y: c.y + dy * a * H + outY * b * H,
    });

    ctx.strokeStyle = '#000000';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Barra tee sentada sobre el ramal — mismo grosor que la tubería del ramal misma.
    // (Sin marcas de extremo — el usuario pidió quitarlas para un look de teeLlaveTerminal más
    // limpio.)
    ctx.lineWidth = 2 * engine.zoom;
    const barL = P(-1, 0),
      barR = P(1, 0);
    ctx.beginPath();
    ctx.moveTo(barL.x, barL.y);
    ctx.lineTo(barR.x, barR.y);
    ctx.stroke();

    // Todo lo de arriba del ramal — más fino que la barra del ramal misma.
    ctx.lineWidth = 0.6 * engine.zoom;

    // Tallo subiendo del ramal a una sola barra transversal a media altura — tallo más largo
    // que el brazo de una tee simple para que el cuerpo de la llave quede visiblemente
    // despejado de la tee, unido todavía por esta única línea.
    const crossB = 3.0;
    const cross = P(0, crossB);
    const crossL = P(-0.3, crossB),
      crossR = P(0.3, crossB);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(cross.x, cross.y);
    ctx.moveTo(crossL.x, crossL.y);
    ctx.lineTo(crossR.x, crossR.y);
    ctx.stroke();

    // Cuerpo + pitorro como UNA curva continua, muestreada como polilínea en el marco local
    // (a,b) vía P() para que sea un arco circular real sin importar la orientación propia del
    // ramal (el parámetro de ángulo de ctx.arc es espacio absoluto de canvas y no rota con
    // dx,dy/outX,outY). Se barre más allá de un simple semicírculo para que la cola siga
    // curvándose naturalmente hacia la punta en vez de doblarse en un segmento recto separado.
    const domeR = 0.64;
    const centerB = crossB + domeR; // el arco arranca exactamente en `cross` — sin hueco entre tallo y curva, para que el perfil se lea como un solo trazo continuo
    const startT = -Math.PI / 2;
    const sweep = 1.2 * Math.PI;
    ctx.beginPath();
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const t = startT - (i / steps) * sweep;
      const pt = P(domeR * Math.cos(t), centerB + domeR * Math.sin(t));
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    // Mango ramificándose del punto más a la izquierda de la curva (t=-π), rematado con su
    // propia marca de extremo.
    const apex = P(-domeR, centerB);
    const handleEnd = P(-domeR * 1.9, centerB);
    const handleTickA = P(-domeR * 1.9, centerB - 0.32),
      handleTickB = P(-domeR * 1.9, centerB + 0.32);
    ctx.beginPath();
    ctx.moveTo(apex.x, apex.y);
    ctx.lineTo(handleEnd.x, handleEnd.y);
    ctx.moveTo(handleTickA.x, handleTickA.y);
    ctx.lineTo(handleTickB.x, handleTickB.y);
    ctx.stroke();
  } else if (accType === 'tapon') {
    // Tapa simple: una barra perpendicular cerrando el extremo de la tubería.
    const capW = rad * 0.7;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = rad * 0.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(c.x + px * capW, c.y + py * capW);
    ctx.lineTo(c.x - px * capW, c.y - py * capW);
    ctx.stroke();
  } else if (accType === 'codoReventilado') {
    // Proporcionado a `rad` (tamaño real del accesorio) en vez de una constante fija de mm de
    // papel, para que escale junto con el fix de ajuste a pared como todo otro símbolo de
    // accesorio.
    const rf = rad / 1.6;
    const rRad = 1.2 * rf;
    const vLen = 1.6 * rf;
    const offset = rRad + 0.5 * rf;
    const cx1 = c.x - dx * offset,
      cy1 = c.y - dy * offset;
    const cx2 = c.x + dx * offset,
      cy2 = c.y + dy * offset;

    // Rellenar el disco ANTES de trazar nada encima — la línea del ramal debajo se dibuja
    // primero (pase separado anterior) y sin este fondo se transparenta por el anillo sin
    // relleno, dando la impresión de que la tubería "entra" al símbolo. Mismo radio que el
    // trazo del anillo mismo (sin margen de halo extra), así que enmascara la línea sin
    // reintroducir el look de borde blanco grueso.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(c.x, c.y, rRad, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.6 * engine.zoom;
    ctx.beginPath();
    ctx.moveTo(cx1 - px * vLen, cy1 - py * vLen);
    ctx.lineTo(cx1 + px * vLen, cy1 + py * vLen);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx2 - px * vLen, cy2 - py * vLen);
    ctx.lineTo(cx2 + px * vLen, cy2 + py * vLen);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(c.x, c.y, rRad, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 0.35 * rf, 0, Math.PI * 2);
    ctx.fill();
  } else if (accType === 'valvCompuerta') {
    const triH = rad * 0.9;
    const triW = rad * 0.7;
    const stem = rad * 1.5;
    const capW = rad * 0.7;

    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.6 * engine.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Triángulo relleno apuntando perpendicular al ramal (a lo largo de px,py)
    ctx.beginPath();
    ctx.moveTo(c.x + px * triH, c.y + py * triH);
    ctx.lineTo(c.x + dx * triW, c.y + dy * triW);
    ctx.lineTo(c.x - dx * triW, c.y - dy * triW);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Tallo desde el centro, perpendicular al ramal
    const stemEndX = c.x + px * stem;
    const stemEndY = c.y + py * stem;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(stemEndX, stemEndY);
    ctx.stroke();

    // Tapa en T al final del tallo
    ctx.beginPath();
    ctx.moveTo(stemEndX - dx * capW, stemEndY - dy * capW);
    ctx.lineTo(stemEndX + dx * capW, stemEndY + dy * capW);
    ctx.stroke();
  } else if (accType === 'valvGlobo') {
    const circR = rad * 0.55;
    const stem = rad * 1.5;
    const capW = rad * 0.7;

    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.6 * engine.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Círculo relleno centrado en el punto final
    ctx.beginPath();
    ctx.arc(c.x, c.y, circR, 0, Math.PI * 2);
    ctx.fill();

    // Tallo desde el centro, perpendicular al ramal
    const stemEndX = c.x + px * stem;
    const stemEndY = c.y + py * stem;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(stemEndX, stemEndY);
    ctx.stroke();

    // Tapa en T al final del tallo
    ctx.beginPath();
    ctx.moveTo(stemEndX - dx * capW, stemEndY - dy * capW);
    ctx.lineTo(stemEndX + dx * capW, stemEndY + dy * capW);
    ctx.stroke();
  } else if (accType === 'valvCheque') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.6 * engine.zoom;
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    const tipX = c.x + dx * rad * 0.65;
    const tipY = c.y + dy * rad * 0.65;
    const baseX = c.x - dx * rad * 0.4;
    const baseY = c.y - dy * rad * 0.4;
    const perpX = px * rad * 0.3;
    const perpY = py * rad * 0.3;
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(baseX - perpX, baseY - perpY);
    ctx.lineTo(baseX + perpX, baseY + perpY);
    ctx.closePath();
    ctx.fill();
  } else if (accType === 'valvAngulo') {
    const perX = -outY;
    const perY = outX;

    const vRad = rad * 1.35;
    const capW = vRad * 0.4;
    const L1 = vRad * 0.55;
    const triH = vRad * 0.65;
    const triW = vRad * 0.35;
    const L2 = vRad * 0.65;
    const L3 = vRad * 0.8;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.6 * engine.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Tapa en T en el punto de conexión c
    ctx.beginPath();
    ctx.moveTo(c.x + perX * capW, c.y + perY * capW);
    ctx.lineTo(c.x - perX * capW, c.y - perY * capW);
    ctx.stroke();

    // 2. Línea vertical de c a la unión P
    const pX = c.x + outX * L1;
    const pY = c.y + outY * L1;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(pX, pY);
    ctx.stroke();

    // 3. Triángulo vertical (apuntando abajo a lo largo de out)
    const v1X = pX + outX * triH + perX * triW;
    const v1Y = pY + outY * triH + perY * triW;
    const v2X = pX + outX * triH - perX * triW;
    const v2Y = pY + outY * triH - perY * triW;

    ctx.beginPath();
    ctx.moveTo(pX, pY);
    ctx.lineTo(v1X, v1Y);
    ctx.lineTo(v2X, v2Y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 4. Línea debajo del triángulo vertical
    const baseVertX = pX + outX * triH;
    const baseVertY = pY + outY * triH;
    ctx.beginPath();
    ctx.moveTo(baseVertX, baseVertY);
    ctx.lineTo(baseVertX + outX * L2, baseVertY + outY * L2);
    ctx.stroke();

    // 5. Triángulo horizontal (apuntando a la derecha a lo largo de per)
    const h1X = pX + perX * triH + outX * triW;
    const h1Y = pY + perY * triH + outY * triW;
    const h2X = pX + perX * triH - outX * triW;
    const h2Y = pY + perY * triH - outY * triW;

    ctx.beginPath();
    ctx.moveTo(pX, pY);
    ctx.lineTo(h1X, h1Y);
    ctx.lineTo(h2X, h2Y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 6. Línea extendiéndose del triángulo horizontal
    const baseHorizX = pX + perX * triH;
    const baseHorizY = pY + perY * triH;
    ctx.beginPath();
    ctx.moveTo(baseHorizX, baseHorizY);
    ctx.lineTo(baseHorizX + perX * L3, baseHorizY + perY * L3);
    ctx.stroke();
  } else if (accType === 'llaveTerminal') {
    // Referencia: un arco semicircular ANCHO y SIMÉTRICO — ambos pies al mismo alto de línea
    // base — con un tallo corto rematado en T subiendo de su ápice. Un pie es el punto de
    // conexión `c` mismo (la línea real del ramal, dibujada en otro lado, termina exactamente
    // ahí — ese es el "segmento más largo" que debe tocar el ramal); el otro pie es libre, el
    // arco solo termina ahí sin nada más allá.
    const domeR = rad * 0.9;
    const stemLen = rad * 0.5;
    const capHalf = rad * 0.5;
    const capTick = rad * 0.12;

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.6 * engine.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Tope recto largo empezando exactamente donde termina el ramal (c) y continuando hacia
    // adelante, alejándose del ramal (`out`) — hacia espacio vacío, nunca de vuelta sobre el
    // propio trazo del ramal. Dibujado explícitamente como parte del símbolo (según la imagen
    // de referencia) en vez de asumir que la polilínea del ramal subyacente ya alcanza lo
    // suficiente para leerse como conectada.
    const stubLen = domeR * 1.6;
    const stubEndX = c.x + outX * stubLen;
    const stubEndY = c.y + outY * stubLen;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(stubEndX, stubEndY);
    ctx.stroke();

    // El centro del domo queda un radio más afuera del final del tope, así su pie cercano
    // aterriza exactamente ahí, y el pie lejano (2*domeR más adelante a lo largo de `out`)
    // flota libre.
    const domeCX = stubEndX + outX * domeR;
    const domeCY = stubEndY + outY * domeR;

    // Domo (semicírculo) a horcajadas sobre la dirección del ramal, abultando hacia el tallo
    const domeAngle = Math.atan2(py, px);
    ctx.beginPath();
    ctx.arc(domeCX, domeCY, domeR, domeAngle - Math.PI / 2, domeAngle + Math.PI / 2);
    ctx.stroke();

    // Tallo desde el ápice del domo hacia afuera
    const apexX = domeCX + px * domeR;
    const apexY = domeCY + py * domeR;
    const stemEndX = apexX + px * stemLen;
    const stemEndY = apexY + py * stemLen;
    ctx.beginPath();
    ctx.moveTo(apexX, apexY);
    ctx.lineTo(stemEndX, stemEndY);
    ctx.stroke();

    // Tapa en T, con una marca pequeña en cada extremo (marcas de manija).
    const capLX = stemEndX - outX * capHalf,
      capLY = stemEndY - outY * capHalf;
    const capRX = stemEndX + outX * capHalf,
      capRY = stemEndY + outY * capHalf;
    ctx.beginPath();
    ctx.moveTo(capLX, capLY);
    ctx.lineTo(capRX, capRY);
    ctx.moveTo(capLX, capLY);
    ctx.lineTo(capLX + px * capTick, capLY + py * capTick);
    ctx.moveTo(capRX, capRY);
    ctx.lineTo(capRX + px * capTick, capRY + py * capTick);
    ctx.stroke();
  } else {
    if (
      accType.startsWith('tee') ||
      accType === 'te_linea' ||
      accType === 'te_ramal' ||
      accType.startsWith('yee')
    ) {
      return;
    }
    // Símbolo de texto de respaldo para cualquier otro accesorio
    let label = accType.substring(0, 3).toUpperCase();
    if (accType.startsWith('codo90')) label = 'C90';
    else if (accType.startsWith('codo45')) label = 'C45';
    else if (accType === 'codos_90_std' || accType === 'codos_90_rl') label = 'C90';
    else if (accType === 'valvula_bola') label = 'VB';
    else if (accType === 'valvPie') label = 'VP';
    else if (accType === 'reduccion') label = 'RED';
    else if (accType === 'ampliacion') label = 'AMP';

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.5 * engine.zoom;
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#000000';
    // Dimensionado al radio propio del círculo (como todo otro glifo de accesorio) — un mínimo
    // fijo basado en zoom aquí se desbordaría del círculo cuando este se encoge a un tamaño
    // realista.
    ctx.font = `bold ${rad * 0.6}px 'Geist', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, c.x, c.y);
  }
}

export function renderRamales(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  const isTributarioMode = engine.tipoTramo === 'tributario' && engine.tool === 'line';
  const padreId = engine.padreTributario;
  engine.ramales.forEach((r) => {
    if (engine._hiddenNets.has(r.net)) return;
    const net = NETS.find((n) => n.id === r.net);
    const col = net ? net.col : '#e2e2e8';
    const sel = r.id === engine.selId;
    const isPadre = r.id === padreId;
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = (sel ? 3 : 2) * engine.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (r.pts.length > 1) {
      if (isPadre && isTributarioMode) {
        ctx.save();
        ctx.setLineDash([6 * engine.zoom, 4 * engine.zoom]);
        ctx.lineWidth = 3 * engine.zoom;
        ctx.strokeStyle = col;
        drawRamalPath(ctx, r.pts, engine, col);
        ctx.restore();
      } else if (r.tipo === 'tributario') {
        ctx.save();
        ctx.setLineDash([6 * engine.zoom, 4 * engine.zoom]);
        drawRamalPath(ctx, r.pts, engine, col);
        ctx.restore();
      } else {
        drawRamalPath(ctx, r.pts, engine, col);
      }
    }

    if (sel) {
      r.pts.forEach(([px, py], idx: number) => {
        if (idx > 0 && idx < r.pts.length - 1) {
          const cvsA = engine.toCvs(r.pts[idx - 1][0], r.pts[idx - 1][1]);
          const cvsB = engine.toCvs(px, py);
          const cvsC = engine.toCvs(r.pts[idx + 1][0], r.pts[idx + 1][1]);
          const ax = cvsB.x - cvsA.x,
            ay = cvsB.y - cvsA.y;
          const bx = cvsC.x - cvsB.x,
            by = cvsC.y - cvsB.y;
          const lenA = Math.hypot(ax, ay),
            lenB = Math.hypot(bx, by);
          if (lenA > 0 && lenB > 0) {
            const ux = -ax / lenA,
              uy = -ay / lenA;
            const vx = bx / lenB,
              vy = by / lenB;
            const cosAngle = ux * vx + uy * vy;
            // Ocultar puntos de selección intermedios colineales (tramo recto): si el ángulo es
            // casi 180°, el vértice es decorativo y su punto estorba la lectura de la línea.
            if (cosAngle < -0.95) {
              return;
            }
          }
        }
        const c = engine.toCvs(px, py);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 3 * engine.zoom, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    if (isPadre && isTributarioMode && !engine.activeRamal && r.pts.length >= 2) {
      const mp = engine.snapPreviewToPadre(engine.mouseX, engine.mouseY);
      if (mp) {
        const c = engine.toCvs(mp.x, mp.y);
        ctx.save();
        ctx.fillStyle = col;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 * engine.zoom;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 5 * engine.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    if (r.label || r.totalL || r.material || r.diametro || r.pendiente) {
      const lc = engine.toCvs(r.labelX, r.labelY);
      const FLOW_NETS = ['san', 'll', 'af', 'ac', 'gas'];
      const showFlow = FLOW_NETS.includes(r.net) && r.pts.length >= 2;
      let flowDx = 0,
        flowDy = 0,
        flowLen = 0;
      if (showFlow) {
        let flowFromIdx = 0;
        let flowToIdx = r.pts.length - 1;
        if (r._tribReversed && (r.tipo === 'tributario' || ['af', 'ac', 'gas'].includes(r.net))) {
          flowFromIdx = flowToIdx;
          flowToIdx = 0;
        }
        // Ldesvio (id `LD_<sourceBajanteId>`, pts[0] es siempre el origen según
        // associateBajanteAcrossFloors.ts) debe apuntar al que sea 'baja' de los dos bajantes
        // enlazados — no siempre el mismo extremo, porque el origen mismo puede ser 'sube' o
        // 'baja' según el piso donde esté el destino. pts[0] ya coincide con el destino
        // (el 'baja') siempre que el origen sea 'sube', así que solo el caso origen-'baja'
        // necesita el default invertido.
        if (r.id.startsWith('LD_')) {
          const srcBaj = engine.bajantes.find((b) => b.id === r.id.slice(3));
          if (srcBaj?.direccion === 'baja') {
            flowFromIdx = r.pts.length - 1;
            flowToIdx = 0;
          }
        }
        const fc = engine.toCvs(r.pts[flowFromIdx][0], r.pts[flowFromIdx][1]);
        const lastc = engine.toCvs(r.pts[flowToIdx][0], r.pts[flowToIdx][1]);
        flowDx = lastc.x - fc.x;
        flowDy = lastc.y - fc.y;
        flowLen = Math.hypot(flowDx, flowDy);
      }

      const pCorto = getPisoCorto(engine.nivelActual?.n);
      const lvlSuffix = pCorto ? `-${pCorto}` : '';
      const lbl = r.label ? `${r.label}${lvlSuffix}` : '';
      const matPart = matDrawingLabel(r.material) || (r.net === 'vent' ? 'PVC-V' : '');
      const dPart = r.diametro ? `D=${normalizeDnLabel(r.diametro.split(' — ')[0])}` : '';
      const pPart = r.pendiente ? `S=${r.pendiente}%` : '';
      const showPend = r.net === 'san' || r.net === 'll';
      const pendPart = showPend && pPart ? pPart : '';
      const lblPart = r.totalL ? `L=${r.totalL.toFixed(2)}m` : '';

      const fsName = engine.mm2cvs(engine.MM.lblName * engine.labelScaleM);
      const fsInfo = engine.mm2cvs(engine.MM.lblInfo * engine.labelScaleM);
      const lineHName = fsName + 2;
      const lineHInfo = fsName + 4;
      const boxPadX = engine.mm2cvs(1.0);
      const boxPadY = engine.mm2cvs(0.6);

      const infoSegs: Array<{ text: string; bold: boolean; w: number } | null> = [
        matPart ? { text: matPart, bold: false, w: 0 } : null,
        dPart ? { text: dPart, bold: true, w: 0 } : null,
        pendPart ? { text: pendPart, bold: false, w: 0 } : null,
        lblPart ? { text: lblPart, bold: false, w: 0 } : null,
      ].filter(Boolean) as Array<{ text: string; bold: boolean; w: number }>;
      const segSep = ' · ';
      let sepW = 0;
      ctx.font = `600 ${fsInfo}px Geist, monospace`;
      if (infoSegs.length > 1) sepW = ctx.measureText(segSep).width;
      for (const s of infoSegs) {
        ctx.font = s!.bold
          ? `bold ${fsInfo}px Geist, monospace`
          : `600 ${fsInfo}px Geist, monospace`;
        s!.w = ctx.measureText(s!.text).width;
      }
      const totalInfoW = infoSegs.reduce(
        (sum: number, s, i) => sum + s!.w + (i < infoSegs.length - 1 ? sepW : 0),
        0,
      );

      ctx.font = `bold ${fsName}px Geist, monospace`;
      const nameW = lbl ? ctx.measureText(lbl).width : 0;
      const contentW = Math.max(nameW, totalInfoW);
      const boxW = contentW + boxPadX * 2;
      const boxH = (lbl ? lineHName : 0) + (infoSegs.length > 0 ? lineHInfo : 0) + boxPadY * 2;
      const drawX = lc.x;
      const drawY = lc.y;
      let labelAngleDeg = r.labelAngle != null ? r.labelAngle : 0;
      if ((r.labelAngle == null || r.labelAngle === 0) && r.pts && r.pts.length >= 2) {
        const dx = r.pts[1][0] - r.pts[0][0];
        const dy = r.pts[1][1] - r.pts[0][1];
        if (Math.abs(dy) > Math.abs(dx)) {
          labelAngleDeg = 90;
        }
      }
      const labelAngle = (labelAngleDeg * Math.PI) / 180;
      const cosA = Math.cos(labelAngle),
        sinA = Math.sin(labelAngle);
      const labelGap = -engine.mm2cvs(5);
      const gapOffX = -labelGap * sinA;
      const gapOffY = labelGap * cosA;
      const adjCx = drawX + gapOffX;
      const adjCy = drawY + gapOffY;

      const { corners, minX, minY, maxX, maxY } = rotatedRectCorners(
        adjCx,
        adjCy,
        boxW,
        boxH,
        labelAngle,
      );
      r._labelBox = {
        cx: adjCx,
        cy: adjCy,
        w: boxW,
        h: boxH,
        angle: labelAngle,
        minX,
        minY,
        maxX,
        maxY,
        corners,
      };

      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(labelAngle);
      ctx.translate(0, labelGap);
      // Deliberadamente ya no se pinta fondo — las etiquetas antes se apoyaban sobre una placa
      // blanca casi opaca; ahora se leen directamente sobre lo que haya debajo, según petición
      // explícita.
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (lbl) {
        ctx.font = `bold ${fsName}px Geist, monospace`;
        ctx.fillStyle = col;
        ctx.fillText(lbl, 0, -boxH / 2 + boxPadY + lineHName / 2);
      }
      if (infoSegs.length > 0) {
        const yInfo = boxH / 2 - boxPadY - lineHInfo / 2;
        let xCursor = -totalInfoW / 2;
        for (let i = 0; i < infoSegs.length; i++) {
          const s = infoSegs[i];
          ctx.font = s!.bold
            ? `bold ${fsInfo}px Geist, monospace`
            : `600 ${fsInfo}px Geist, monospace`;
          ctx.fillStyle = s!.bold ? '#000000' : '#1a1a1a';
          ctx.textAlign = 'left';
          ctx.fillText(s!.text, xCursor, yInfo);
          xCursor += s!.w;
          if (i < infoSegs.length - 1) {
            ctx.font = `600 ${fsInfo}px Geist, monospace`;
            ctx.fillStyle = '#1a1a1a';
            ctx.fillText(segSep, xCursor, yInfo);
            xCursor += sepW;
          }
        }
        ctx.textAlign = 'center';
      }

      if (showFlow && flowLen > 12 * engine.zoom) {
        const arrowY = boxH / 2 + 2 * engine.zoom;
        ctx.save();
        ctx.translate(0, arrowY);
        const dot = flowDx * cosA + flowDy * sinA;
        const dir = dot >= 0 ? 1 : -1;
        const halfSize = nameW ? nameW / 2 : 12 * engine.zoom;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1 * engine.zoom;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-halfSize * dir, 0);
        ctx.lineTo(halfSize * dir, 0);
        ctx.stroke();
        const aSize = Math.min(6 * engine.zoom, halfSize * 0.6);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(halfSize * dir, 0);
        ctx.lineTo(halfSize * dir - dir * aSize, -aSize * 0.4);
        ctx.lineTo(halfSize * dir - dir * aSize, aSize * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    } else {
      r._labelBox = undefined;
    }

    ctx.restore();

    if (r.pts.length >= 2 && (r.id === engine.selId || (engine.multiSel || []).includes(r.id))) {
      let desvioBajante: PlanoBajante | null = null;
      const isDesvio = engine.bajantes.some((b) => {
        const disp = b.desplazamientos?.[engine.nivelActual?.label ?? ''];
        if (!disp || disp.Ldesvio !== r.id) return false;
        const gx = b.x + (disp.dx || 0),
          gy = b.y + (disp.dy || 0);
        const firstPt = r.pts[0],
          lastPt = r.pts[r.pts.length - 1];
        const nearParent = Math.hypot(firstPt[0] - b.x, firstPt[1] - b.y) < 0.5;
        const nearGhost = Math.hypot(lastPt[0] - gx, lastPt[1] - gy) < 0.5;
        if (nearParent && nearGhost) {
          desvioBajante = b;
          return true;
        }
        return false;
      });

      if (isDesvio && desvioBajante) {
        const baj: PlanoBajante = desvioBajante;
        const firstPt = r.pts[0];

        let startIdx = 0,
          nextIdx = 1;

        const firstIsParent = Math.hypot(firstPt[0] - baj.x, firstPt[1] - baj.y) < 0.5;
        // La punta de flecha va SIEMPRE sobre el extremo cuyo bajante tiene dirección 'baja' — no
        // siempre el mismo lado, porque el bajante padre (source) puede ser 'sube' o 'baja' según
        // en qué piso quede el otro extremo de la asociación (ver applyBajanteAssociation). Mismo
        // criterio que el indicador de flujo permanente más arriba.
        const parentIdx = firstIsParent ? 0 : r.pts.length - 1;
        const otherIdx = firstIsParent ? r.pts.length - 1 : 0;
        if (baj.direccion === 'baja') {
          startIdx = parentIdx;
          nextIdx = otherIdx;
        } else {
          startIdx = otherIdx;
          nextIdx = parentIdx;
        }

        const firstC = engine.toCvs(r.pts[startIdx][0], r.pts[startIdx][1]);
        const secondC = engine.toCvs(r.pts[nextIdx][0], r.pts[nextIdx][1]);
        const adx = secondC.x - firstC.x,
          ady = secondC.y - firstC.y;
        const alen = Math.hypot(adx, ady);

        if (alen > 2) {
          const unx = adx / alen,
            uny = ady / alen;
          const arrowR = 10 * engine.zoom;
          const cx = firstC.x;
          const cy = firstC.y;
          ctx.save();
          ctx.fillStyle = '#FFEB3B';
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1.5 * engine.zoom;
          ctx.shadowColor = '#000';
          ctx.shadowBlur = 6 * engine.zoom;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(
            cx - unx * arrowR + uny * arrowR * 0.4,
            cy - uny * arrowR - unx * arrowR * 0.4,
          );
          ctx.lineTo(
            cx - unx * arrowR - uny * arrowR * 0.4,
            cy - uny * arrowR + unx * arrowR * 0.4,
          );
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      } else {
        let startIdx = 0;
        let nextIdx = 1;

        if (r._tribReversed && (r.tipo === 'tributario' || ['af', 'ac', 'gas'].includes(r.net))) {
          startIdx = r.pts.length - 1;
          nextIdx = r.pts.length - 2;
        }

        let isCodoReventiladoConnection = false;
        let codoEndIdx = -1;

        if (r.net === 'vent' || r.net === 'san') {
          const ventRamales = engine.ramales.filter((rm) => rm.net === 'vent');
          const sanRamales = engine.ramales.filter((rm) => rm.net === 'san');

          for (const vr of ventRamales) {
            for (const idx of [0, vr.pts.length - 1]) {
              const pt = vr.pts[idx];
              const connectsToSan = sanRamales.some((sr) =>
                sr.pts.some((sPt: number[]) => Math.hypot(pt[0] - sPt[0], pt[1] - sPt[1]) < 0.5),
              );
              if (connectsToSan) {
                const rEndIdx = [0, r.pts.length - 1].find(
                  (eIdx) => Math.hypot(r.pts[eIdx][0] - pt[0], r.pts[eIdx][1] - pt[1]) < 0.5,
                );
                if (rEndIdx !== undefined) {
                  isCodoReventiladoConnection = true;
                  codoEndIdx = rEndIdx;
                  break;
                }
              }
            }
            if (isCodoReventiladoConnection) break;
          }
        }

        if (r.net === 'san' && !isCodoReventiladoConnection) {
          for (const b of engine.bajantes || []) {
            if (b.net !== 'san') continue;
            if (!b.recibeDeIds?.includes(r.id)) continue;
            const firstPt = r.pts[0];
            const lastPt = r.pts[r.pts.length - 1];
            const bajanteNearFirst = Math.hypot(firstPt[0] - b.x, firstPt[1] - b.y) < 0.5;
            const bajanteNearLast = Math.hypot(lastPt[0] - b.x, lastPt[1] - b.y) < 0.5;
            if (bajanteNearFirst) {
              startIdx = r.pts.length - 1;
              nextIdx = r.pts.length - 2;
            } else if (bajanteNearLast) {
              startIdx = 0;
              nextIdx = 1;
            }
            break;
          }
        }

        if (isCodoReventiladoConnection && codoEndIdx !== -1) {
          startIdx = codoEndIdx === 0 ? r.pts.length - 1 : 0;
          nextIdx = startIdx === 0 ? 1 : r.pts.length - 2;
        } else if (r.net === 'vent' && r.pts[r.pts.length - 1][0] < r.pts[0][0]) {
          startIdx = r.pts.length - 1;
          nextIdx = r.pts.length - 2;
        }

        const firstC = engine.toCvs(r.pts[startIdx][0], r.pts[startIdx][1]);
        const secondC = engine.toCvs(r.pts[nextIdx][0], r.pts[nextIdx][1]);
        const adx = secondC.x - firstC.x,
          ady = secondC.y - firstC.y;
        const alen = Math.hypot(adx, ady);
        if (alen > 2) {
          const unx = adx / alen,
            uny = ady / alen;
          const arrowR = 10 * engine.zoom;
          const cx = firstC.x;
          const cy = firstC.y;
          ctx.save();
          ctx.fillStyle = '#FFEB3B';
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1.5 * engine.zoom;
          ctx.shadowColor = '#000';
          ctx.shadowBlur = 6 * engine.zoom;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(
            cx - unx * arrowR + uny * arrowR * 0.4,
            cy - uny * arrowR - unx * arrowR * 0.4,
          );
          ctx.lineTo(
            cx - unx * arrowR - uny * arrowR * 0.4,
            cy - uny * arrowR + unx * arrowR * 0.4,
          );
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  });

  // Dibujar accesorios de extremo (accesorioInicio/Fin) en su propio pase, después de que el
  // trazo del path de cada ramal ya se pintó — si no, la línea de un ramal iterado después
  // (p. ej. un ramal vent que comparte el punto final de un ramal san) pinta encima del
  // símbolo de accesorio de un ramal anterior en ese mismo punto.
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

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      drawExtremeAccessorySymbol(
        ctx,
        engine,
        accType,
        c,
        accType === 'teeTapon' || accType === 'teeLlaveTerminal' ? px : dx,
        accType === 'teeTapon' || accType === 'teeLlaveTerminal' ? py : dy,
        px,
        py,
        outX,
        outY,
        rad,
        diamLabel,
        r,
        idx === 0 ? 'ini' : 'fin',
      );
      ctx.restore();
    });
  });

  // Dibujar símbolos de aparato (fixture) en los extremos de ramal. aparatoInicio/aparatoFin
  // guardan un id de fixture (id de APARATOS_DEF como 'lvm'/'duc') asignado vía el dropdown
  // "Seleccionar Aparato". Los fixtures son imágenes webp (APARATO_IMG), no paths vectoriales
  // como los accesorios, así que se renderizan con ctx.drawImage y un cache de nivel de módulo
  // con carga asíncrona (ver aparatoImgCache arriba) — cuando una imagen por fin carga, el
  // engine re-renderiza para que el símbolo aparezca sin interacción del usuario.
  const getAparatoImg = (src: string): HTMLImageElement | null => {
    if (aparatoImgCache.has(src)) return aparatoImgCache.get(src) || null;
    aparatoImgCache.set(src, null);
    const img = new Image();
    img.onload = () => {
      aparatoImgCache.set(src, img);
      engine.render();
    };
    img.onerror = () => {
      aparatoImgCache.set(src, null);
    };
    img.src = src;
    return null;
  };
  engine.ramales.forEach((r) => {
    if (engine._hiddenNets.has(r.net)) return;
    if (!((r.tipo === 'tributario' || r.tipo === 'ramal') && r.pts.length >= 2)) return;
    // En AF/AC el símbolo del aparato no se dibuja: el glifo de accesorio implícito (codo 90°
    // sube junto al aparato, arriba) ya marca el extremo y la imagen del fixture solo ensucia
    // el plano. En san se mantiene.
    if (r.net === 'af' || r.net === 'ac') return;

    [0, r.pts.length - 1].forEach((idx) => {
      const appType = idx === 0 ? r.aparatoInicio : r.aparatoFin;
      if (!appType) return;
      const imgSrc = (APARATO_IMG as Record<string, string>)[appType];
      if (!imgSrc) return;
      const img = getAparatoImg(imgSrc);
      if (!img) return; // todavía cargando — onload re-renderiza este pase

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
      const outX = idx === 0 ? -dx : dx;
      const outY = idx === 0 ? -dy : dy;

      const rad = engine.realMmToCanvasPx(23) * 0.9;
      const size = rad * 2;
      ctx.save();
      // Quedar apenas al lado exterior de la tubería para que la línea del ramal siga visible
      // bajo el símbolo.
      ctx.translate(c.x + outX * rad * 0.3, c.y + outY * rad * 0.3);
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();
    });
  });

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
      // En AF/AC/gas los glifos de codo ya no se dibujan (codo90rc/rm/rl, sube/baja, codo45rc,
      // codos_90_std): el arco que dibuja drawRamalPath en cada quiebre ES el codo — el círculo
      // "C90"/"C45" al lado solo reduce.
      if (
        (accType.startsWith('codo90') ||
          accType.startsWith('codo45') ||
          accType.startsWith('codos_90')) &&
        (r.net === 'af' || r.net === 'ac' || r.net === 'gas')
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

      // realMmToCanvasPx piso en 1mm de papel (ver PlanoEngine.ts) — dividir a la mitad el
      // argumento en mm solo es invisible a escalas comunes, ya que ambos caen en ese piso.
      // Se divide el resultado en px.
      const rad = engine.realMmToCanvasPx(23) * 0.6;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      drawExtremeAccessorySymbol(ctx, engine, accType, c, dx, dy, px, py, px, py, rad);
      ctx.restore();
    }
  });

  // Las uniones vent↔san ahora se manejan geométricamente por renderJunctions (vent agrupado en
  // el pase sanitaria), produciendo el glifo tee/yee correcto según la geometría — no más codo
  // reventilado forzado en cada contacto vent-san, que es por lo que el pase viejo de
  // renderVentCodos ya no existe.
  renderJunctions(ctx, engine);
}

export function renderActiveRamal(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  if (!engine.activeRamal) return;
  const ar = engine.activeRamal;
  const net = NETS.find((n) => n.id === ar.net);
  const col = net ? net.col : '#e2e2e8';

  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = 2 * engine.zoom;
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

  const activeRamales = engine.ramales.filter((r) => r.net === engine.activeNet);
  for (const r of activeRamales) {
    if (r.id === ar.id) continue;
    let segSp = null;
    if (engine.snapMode) {
      segSp = snapTributaryToPadre45Deg(mp.x, mp.y, last[0], last[1], r.pts, 20 / engine.zoom);
    } else {
      segSp = engine._snapToSegment(mp.x, mp.y, r.pts, 20 / engine.zoom);
    }
    if (segSp) {
      mp = segSp;
      snapped = true;
      break;
    }
  }

  if (!snapped) {
    const sp = engine.snapToExisting(mp.x, mp.y);
    if (sp) mp = sp;
  }

  const bajThresh = 20 / engine.zoom;
  const nearBaj = engine.bajantes.find((b) => {
    if (engine._hiddenNets.has(b.net) || b.net !== ar.net) return false;
    return Math.hypot(origMp.x - b.x, origMp.y - b.y) < bajThresh;
  });
  if (nearBaj) {
    mp = { x: nearBaj.x, y: nearBaj.y };
    snapped = true;
    const bc = engine.toCvs(nearBaj.x, nearBaj.y);
    ctx.save();
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 2 * engine.zoom;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(bc.x, bc.y, 12 * engine.zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(34,211,238,0.15)';
    ctx.beginPath();
    ctx.arc(bc.x, bc.y, 12 * engine.zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const distFirst = Math.hypot(mp.x - first[0], mp.y - first[1]);
  const SNAP_CLOSE = 12 / engine.zoom;
  if (ar.pts.length >= 3 && distFirst < SNAP_CLOSE) {
    const fc = engine.toCvs(first[0], first[1]);
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 2 * engine.zoom;
    ctx.beginPath();
    ctx.arc(fc.x, fc.y, 10 * engine.zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(34,211,238,0.25)';
    ctx.beginPath();
    ctx.arc(fc.x, fc.y, 10 * engine.zoom, 0, Math.PI * 2);
    ctx.fill();
    mp = { x: first[0], y: first[1] };
  }

  const lc = engine.toCvs(last[0], last[1]);
  const mc = engine.toCvs(mp.x, mp.y);

  ctx.strokeStyle = col + '88';
  ctx.lineWidth = 2 * engine.zoom;
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
