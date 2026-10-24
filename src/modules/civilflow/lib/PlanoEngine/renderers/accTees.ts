import type { AccSimboloArgs } from './renderAccessorySymbols.ts';

export function drawTeeSymbols(a: AccSimboloArgs): boolean {
  const { ctx, engine, accType, c, dx, dy, px, py, outX, outY, rad, pipeToward } = a;
  if (accType === 'teeSube' || accType === 'teeBaja') {
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
    const tickLen = engine.mm2cvs(1.0);
    const armW = 1.2 * engine.zoom * (engine.lineWidthScale || 1); // mismo ancho de trazo que la tubería propia (no seleccionada) de drawRamalPath, para que el glifo se funda con la línea del ramal
    const arms: { x: number; y: number }[] = [
      { x: dx, y: dy },
      { x: -dx, y: -dy },
      { x: px, y: py },
    ];
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = armW; // el def YA incluye lineWidthScale — multiplicar de nuevo = escala² (auditoría r8 F-3)
    ctx.lineCap = 'butt';
    ctx.beginPath();
    for (const a of arms) {
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + a.x * juncRad, c.y + a.y * juncRad);
    }
    ctx.stroke();

    // N5: trazos transversales ligeramente más gruesos, extremos cuadrados, llegan a extremos
    ctx.lineWidth = 1 * engine.zoom * (engine.lineWidthScale || 1);
    ctx.lineCap = 'square';
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
    ctx.lineWidth = 0.35 * engine.zoom * (engine.lineWidthScale || 1);
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
      ctx.lineWidth = circR * 0.22 * (engine.lineWidthScale || 1);
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
    return true;
  }
  if (accType === 'teeReduccion' || accType === 'teeLado') {
    // Glifo de tee real (tres brazos + marcas de extremo), mismo lenguaje visual que la tee
    // geométrica (renderJunctions.ts) y teeSube/teeBaja. La rama
    // (px,py) se une perpendicular a la dirección de paso (dx,dy). teeReduccion dibuja el
    // brazo de la rama más angosto (diámetro reducido) con un collar corto de ancho completo en
    // la unión; teeLado mantiene la rama a ancho completo.
    const juncRad = engine.mm2cvs(2.0);
    const tickLen = engine.mm2cvs(1.0);
    const armW = 1.2 * engine.zoom * (engine.lineWidthScale || 1);
    const branchW = accType === 'teeReduccion' ? armW * 0.55 : armW;
    ctx.strokeStyle = '#000000';
    ctx.lineCap = 'butt';
    // Brazos de paso (ancho completo)
    ctx.lineWidth = armW; // el def YA incluye lineWidthScale — multiplicar de nuevo = escala² (auditoría r8 F-3)
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
      ctx.lineWidth = branchW; // el def YA incluye lineWidthScale — multiplicar de nuevo = escala² (auditoría r8 F-3)
      ctx.beginPath();
      ctx.moveTo(c.x + px * juncRad * 0.35, c.y + py * juncRad * 0.35);
      ctx.lineTo(c.x + px * juncRad, c.y + py * juncRad);
      ctx.stroke();
    } else {
      ctx.lineWidth = branchW; // el def YA incluye lineWidthScale — multiplicar de nuevo = escala² (auditoría r8 F-3)
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + px * juncRad, c.y + py * juncRad);
      ctx.stroke();
    }
    // N5: marcas de extremo ligeramente más gruesas, extremos cuadrados, llegan a extremos
    ctx.lineWidth = 1 * engine.zoom * (engine.lineWidthScale || 1);
    ctx.lineCap = 'square';
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
    return true;
  }
  if (accType === 'teeTapon') {
    // Tallo alto saliendo del punto de rama (outX,outY), rematado con una barra perpendicular
    // en el tope. Los dos extremos de la barra se doblan HACIA ABAJO hacia el tallo (un
    // corchete "⊓", no marcas abiertas apuntando más lejos) — más una marca corta justo sobre
    // el ramal mismo en el punto de unión, a lo largo de la dirección propia del ramal
    // (dx,dy), distinguiendo el punto de tee de la tubería simple a ambos lados. La línea real
    // del ramal ya pasa recta por este punto interior (dibujada por drawRamalPath); esto solo
    // agrega la rama, su tapa y la marca de unión.
    const armW = 0.9 * engine.zoom * (engine.lineWidthScale || 1);
    const ramalW = 2 * engine.zoom * (engine.lineWidthScale || 1); // mismo ancho de trazo que la tubería propia (no seleccionada) de drawRamalPath, para que el glifo se funda con la línea del ramal
    const stemLen = rad * 3.5;
    const capHalf = rad * 0.9;
    const capTick = rad * 1.1;
    const jointHalf = rad * 0.7;
    const stemEndX = c.x + outX * stemLen,
      stemEndY = c.y + outY * stemLen;
    ctx.strokeStyle = '#000000';
    ctx.lineCap = 'butt';
    // Marca de unión sobre el ramal mismo — mismo grosor que la tubería del ramal, no las líneas
    // (más finas) del símbolo de arriba.
    ctx.lineWidth = ramalW; // el def YA incluye lineWidthScale — multiplicar de nuevo = escala² (auditoría r8 F-3)
    ctx.beginPath();
    ctx.moveTo(c.x + dx * jointHalf, c.y + dy * jointHalf);
    ctx.lineTo(c.x - dx * jointHalf, c.y - dy * jointHalf);
    ctx.stroke();
    // Tallo
    ctx.lineWidth = armW; // el def YA incluye lineWidthScale — multiplicar de nuevo = escala² (auditoría r8 F-3)
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
    ctx.lineWidth = 0.35 * engine.zoom * (engine.lineWidthScale || 1);
    ctx.beginPath();
    ctx.moveTo(capLX, capLY);
    ctx.lineTo(capLX - outX * capTick, capLY - outY * capTick);
    ctx.moveTo(capRX, capRY);
    ctx.lineTo(capRX - outX * capTick, capRY - outY * capTick);
    ctx.stroke();
    return true;
  }
  if (accType === 'teeLlaveTerminal') {
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
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';

    // Barra tee sentada sobre el ramal — mismo grosor que la tubería del ramal misma.
    // (Sin marcas de extremo — el usuario pidió quitarlas para un look de teeLlaveTerminal más
    // limpio.)
    ctx.lineWidth = 2 * engine.zoom * (engine.lineWidthScale || 1);
    const barL = P(-1, 0),
      barR = P(1, 0);
    ctx.beginPath();
    ctx.moveTo(barL.x, barL.y);
    ctx.lineTo(barR.x, barR.y);
    ctx.stroke();

    // Todo lo de arriba del ramal — más fino que la barra del ramal misma.
    ctx.lineWidth = 0.35 * engine.zoom * (engine.lineWidthScale || 1);

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
    return true;
  }
  if (accType === 'tapon') {
    // Horquilla de extremo (orig. usuario, imagen de referencia): tallo LARGO hacia afuera
    // sobre el eje del brazo eliminado (outX,outY) y DOS brazos cortos paralelos al TRAZO
    // (dx,dy) unidos por una barra — forma de ⨅ abierta hacia la tubería.
    const stem = rad * 4.5;
    const arm = rad * 1.4;
    const gap = rad * 1.0;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = rad * 0.45 * (engine.lineWidthScale || 1);
    ctx.lineCap = 'butt';
    // Punta del tallo (donde nace la horquilla).
    const tx = c.x + outX * stem;
    const ty = c.y + outY * stem;
    // Tallo.
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    // Dos brazos paralelos al trazo, abiertos hacia la tubería (pipeToward = vector del cuerpo
    // del ramal; −out como fallback para el pase de extremos).
    const tdx = pipeToward ? pipeToward.x : -outX;
    const tdy = pipeToward ? pipeToward.y : -outY;
    const a1x = tx + px * gap,
      a1y = ty + py * gap;
    const a2x = tx - px * gap,
      a2y = ty - py * gap;
    ctx.beginPath();
    ctx.moveTo(a1x, a1y);
    ctx.lineTo(a1x + tdx * arm, a1y + tdy * arm);
    ctx.moveTo(a2x, a2y);
    ctx.lineTo(a2x + tdx * arm, a2y + tdy * arm);
    // Barra de cierre uniendo los inicios de ambos brazos.
    ctx.moveTo(a1x, a1y);
    ctx.lineTo(a2x, a2y);
    ctx.stroke();
    // Raya flotante encima del símbolo, paralela a la barra y del MISMO ancho que ella
    // (orig. usuario), despegada hacia afuera a lo largo del eje del tallo.
    const dashOff = rad * 0.9;
    ctx.beginPath();
    ctx.moveTo(a1x + outX * dashOff, a1y + outY * dashOff);
    ctx.lineTo(a2x + outX * dashOff, a2y + outY * dashOff);
    ctx.stroke();
    return true;
  }
  return false;
}
