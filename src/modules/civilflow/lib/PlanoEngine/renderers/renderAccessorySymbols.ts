import { rotatedRectCorners } from '../HitTester';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';
import { normalizeDnLabel } from '../../../utils/formatUtils';

// Compartido por el renderizado de accesorios de extremo (accesorioInicio/Fin) y de mitad de
// ramal (accMed*). `outX,outY` es la dirección "apuntando lejos de la tubería" — para un
// extremo es alejándose del propio cuerpo del ramal; para un vértice de mitad de ramal es la
// normal perpendicular (px,py) porque ahí no hay un solo lado "hacia afuera". El caller es
// responsable de ctx.save()/restore().
export function drawExtremeAccessorySymbol(
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
    else if (accType.startsWith('codos_90')) label = 'C90';
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

// Ítem 6: el codo de PLANO (codo90rm/codos_90_std/codo45/codos_45) en una esquina L — dos
// tuberías que comparten un extremo con direcciones distintas — se dibuja con el mismo símbolo
// de segmentos que los quiebres interiores de drawRamalPath: arco de 90° (o inglete a 45°) +
// marcas perpendiculares en los extremos. Antes caía en el disco de respaldo con el texto
// "C90". Devuelve false si no hay esquina (extremo muerto), para que el llamador use el glifo
// de respaldo.
export function drawCornerCodoArc(
  ctx: CanvasRenderingContext2D,
  engine: IPlanoEngineCore,
  pt: number[],
  u: { x: number; y: number },
): boolean {
  const TOL = 0.5;
  const dirs: { x: number; y: number }[] = [];
  for (const other of engine.ramales) {
    if (engine._hiddenNets.has(other.net)) continue;
    if (!other.pts || other.pts.length < 2) continue;
    for (let i = 0; i < other.pts.length; i++) {
      if (Math.hypot(other.pts[i][0] - pt[0], other.pts[i][1] - pt[1]) > TOL) continue;
      if (i > 0) {
        // Dirección de SALIDA del extremo (hacia el cuerpo del ramal): con la de llegada el
        // arco salía al lado contrario de la esquina ("codo al revés").
        const ddx = other.pts[i - 1][0] - other.pts[i][0];
        const ddy = other.pts[i - 1][1] - other.pts[i][1];
        const l = Math.hypot(ddx, ddy);
        if (l > 0.1) dirs.push({ x: ddx / l, y: ddy / l });
      }
      if (i < other.pts.length - 1) {
        const ddx = other.pts[i + 1][0] - other.pts[i][0];
        const ddy = other.pts[i + 1][1] - other.pts[i][1];
        const l = Math.hypot(ddx, ddy);
        if (l > 0.1) dirs.push({ x: ddx / l, y: ddy / l });
      }
    }
  }
  const unique: { x: number; y: number }[] = [];
  for (const d of dirs) {
    if (!unique.some((x) => x.x * d.x + x.y * d.y > 0.99)) unique.push(d);
  }
  // El otro brazo de la esquina: una dirección distinta y no colineal con la propia del host.
  // Si hay más de una (una T real), no es un codo — el llamador usa el glifo de respaldo.
  const arms = unique.filter((d) => Math.abs(d.x * u.x + d.y * u.y) < 0.98);
  if (arms.length !== 1) return false;
  const v = arms[0];
  const c = engine.toCvs(pt[0], pt[1]);
  const rad = engine.mm2cvs(1.5);
  const cosA = u.x * v.x + u.y * v.y;
  const is45 = Math.abs(cosA + Math.cos(Math.PI / 4)) < 0.05;
  const T_A = { x: c.x + rad * u.x, y: c.y + rad * u.y };
  const T_C = { x: c.x + rad * v.x, y: c.y + rad * v.y };
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2 * engine.zoom;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Hay que reiniciar el dash explícitamente — el cuerpo del ramal puede estar discontinuo
  // (tributario) y el símbolo no debe heredar el dash.
  ctx.setLineDash([]);
  ctx.beginPath();
  if (is45) {
    ctx.moveTo(T_A.x, T_A.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(T_C.x, T_C.y);
  } else {
    const ccx = c.x + (u.x + v.x) * rad;
    const ccy = c.y + (u.y + v.y) * rad;
    const angle_TA = Math.atan2(-v.y, -v.x);
    const angle_TC = Math.atan2(-u.y, -u.x);
    const cross = u.x * v.y - u.y * v.x;
    ctx.arc(ccx, ccy, rad, angle_TA, angle_TC, cross > 0);
  }
  ctx.stroke();
  const tickLen = engine.mm2cvs(1.0);
  const perp_u = { x: -u.y, y: u.x };
  const perp_v = { x: -v.y, y: v.x };
  ctx.beginPath();
  ctx.moveTo(T_A.x - (perp_u.x * tickLen) / 2, T_A.y - (perp_u.y * tickLen) / 2);
  ctx.lineTo(T_A.x + (perp_u.x * tickLen) / 2, T_A.y + (perp_u.y * tickLen) / 2);
  ctx.moveTo(T_C.x - (perp_v.x * tickLen) / 2, T_C.y - (perp_v.y * tickLen) / 2);
  ctx.lineTo(T_C.x + (perp_v.x * tickLen) / 2, T_C.y + (perp_v.y * tickLen) / 2);
  ctx.stroke();
  ctx.restore();
  return true;
}
