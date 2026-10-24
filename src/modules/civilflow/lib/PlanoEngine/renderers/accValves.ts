import type { AccSimboloArgs } from './renderAccessorySymbols.ts';

export function drawValveSymbols(a: AccSimboloArgs): boolean {
  const { ctx, engine, accType, c, dx, dy, px, py, outX, outY, rad } = a;
  if (accType === 'valvCompuerta') {
    const triH = rad * 0.9;
    const triW = rad * 0.7;
    const stem = rad * 1.5;
    const capW = rad * 0.7;

    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.35 * engine.zoom * (engine.lineWidthScale || 1);
    ctx.lineCap = 'butt';
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
    return true;
  }
  if (accType === 'valvGlobo') {
    const circR = rad * 0.55;
    const stem = rad * 1.5;
    const capW = rad * 0.7;

    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.35 * engine.zoom * (engine.lineWidthScale || 1);
    ctx.lineCap = 'butt';
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
    return true;
  }
  if (accType === 'valvCheque') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.35 * engine.zoom * (engine.lineWidthScale || 1);
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
    return true;
  }
  if (accType === 'valvAngulo') {
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
    ctx.lineWidth = 0.35 * engine.zoom * (engine.lineWidthScale || 1);
    ctx.lineCap = 'butt';
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
    return true;
  }
  if (accType === 'llaveTerminal') {
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
    ctx.lineWidth = 0.35 * engine.zoom * (engine.lineWidthScale || 1);
    ctx.lineCap = 'butt';
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
    return true;
  }
  return false;
}
