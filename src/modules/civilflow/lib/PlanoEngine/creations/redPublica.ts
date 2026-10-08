// Creación de red pública y contadores.
import { NETS } from '../PlanoState';
import type { IPlanoEngineCore } from '../PlanoState';
import { _statusMsg } from '../ramalMeasure';

// El bajante solo pertenece a san/vent/ll, el montante solo a gas/ac/af — misma regla que
// aplican la barra de herramientas (isToolDisabledForNet en PdfViewerToolbar.tsx) y los atajos
// de teclado (PlanoEngine.ts _onKeyDownHandler); se re-chequea aquí como defensa en
// profundidad por si algún otro caller llega a estas funciones sin pasar por ninguna de esas
// compuertas.
/** Crea un símbolo de red pública (acometida) nuevo en las coordenadas dadas. @param engine
 *  Instancia del motor. @param px Coordenada X de plano. @param py Coordenada Y de plano. */
export function handleRedPublicaDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (engine.snapMode) {
    const sp = engine.snapToExisting(px, py);
    if (sp) {
      px = sp.x;
      py = sp.y;
    }
  }
  const cnt = engine.bajantes.filter((b) => b.tipo === 'red_publica').length + 1;
  const rpId = 'RP' + cnt;
  engine.bajantes.push({
    id: rpId,
    net: engine.activeNet,
    tipo: 'red_publica',
    code: 'RP' + cnt,
    x: px,
    y: py,
    pisoBase: engine.nivelActual?.label ?? '',
    pisoCima: engine.nivelActual?.label ?? '',
    nptBase: engine.nivelActual?.npt ?? 0,
    nptCima: engine.nivelActual?.npt ?? 0,
    hVert: 0,
    dNominal: '',
    recibeDeIds: [],
    alimentaIds: [],
    descargaEnId: null,
    ucAcum: 0,
    ucExtra: 0,
    area_m2: 0,
    desplazamientos: {},
    lblOffX: 0,
    lblOffY: 0,
    labelAngle: 0,
    labelX: px,
    labelY: py + 20,
    bajR: 7 / 24,
  });
  engine.selId = rpId;
  engine._isGhostSel = false;
  engine._emitSelect(engine.bajantes[engine.bajantes.length - 1]);
  engine.render();
  engine._markDirty();
}

/** Crea un contador (medidor) en las coordenadas dadas y lo conecta automáticamente a la
 *  red pública más cercana con un ramal, si existe alguna. @param engine Núcleo del motor.
 *  @param px Coordenada X de plano. @param py Coordenada Y de plano. */
/** Crea un contador (medidor) en las coordenadas dadas y lo conecta automáticamente a la
 *  red pública más cercana con un ramal, si existe alguna. @param engine Núcleo del motor.
 *  @param px Coordenada X de plano. @param py Coordenada Y de plano. */
export function handleContadorDown(engine: IPlanoEngineCore, px: number, py: number): void {
  // Guard de red (defensa en profundidad — el atajo/botón ya filtran): un contador insertado
  // en san/ll/vent contaminaba las tablas hidráulicas con CNTAF fantasma.
  if (!['af', 'gas'].includes(engine.activeNet)) return;
  if (engine.snapMode) {
    const sp = engine.snapToExisting(px, py);
    if (sp) {
      px = sp.x;
      py = sp.y;
    }
  }
  const cntPfx = engine.activeNet === 'gas' ? 'CTNG' : 'CNTAF';
  const cnt = engine.bajantes.filter((b) => b.tipo === 'contador').length + 1;
  const cntId = cntPfx + cnt;
  engine.bajantes.push({
    id: cntId,
    net: engine.activeNet,
    tipo: 'contador',
    code: cntPfx + cnt,
    x: px,
    y: py,
    pisoBase: engine.nivelActual?.label ?? '',
    pisoCima: engine.nivelActual?.label ?? '',
    nptBase: engine.nivelActual?.npt ?? 0,
    nptCima: engine.nivelActual?.npt ?? 0,
    hVert: 0,
    dNominal: '',
    recibeDeIds: [],
    alimentaIds: [],
    descargaEnId: null,
    ucAcum: 0,
    ucExtra: 0,
    area_m2: 0,
    desplazamientos: {},
    lblOffX: 0,
    lblOffY: 0,
    labelAngle: 0,
    labelX: px - 25,
    labelY: py,
    bajR: 7 / 24,
  });
  engine.selId = cntId;
  engine._isGhostSel = false;
  engine._emitSelect(engine.bajantes[engine.bajantes.length - 1]);

  const rps = engine.bajantes.filter((b) => b.tipo === 'red_publica' && b.net === engine.activeNet);
  if (rps.length > 0) {
    let nearestRP = rps[0];
    let minDist = Infinity;
    for (const rp of rps) {
      const d = Math.hypot(rp.x - px, rp.y - py);
      if (d < minDist) {
        minDist = d;
        nearestRP = rp;
      }
    }
    const rpId = nearestRP.code || nearestRP.id;
    const alreadyConnected = engine.ramales.some(
      (r) =>
        r.net === engine.activeNet &&
        ((r.ini === rpId && r.fin === cntId) || (r.ini === cntId && r.fin === rpId)),
    );
    if (!alreadyConnected) {
      const net = NETS.find((n) => n.id === engine.activeNet);
      const pfx = net ? net.lbl : 'R';
      if (!engine._netCounts[engine.activeNet])
        engine._netCounts[engine.activeNet] = { ramal: 0, tributario: 0 };
      const ramCnt = ++engine._netCounts[engine.activeNet].ramal;
      const ramId = pfx + ramCnt;
      engine.ramales.push({
        id: ramId,
        net: engine.activeNet,
        _net: engine.activeNet,
        tipo: 'ramal',
        padre: null,
        pts: [
          [nearestRP.x, nearestRP.y],
          [px, py],
        ],
        totalL: +engine.pxToM(Math.hypot(px - nearestRP.x, py - nearestRP.y)).toFixed(3),
        label: pfx + ramCnt,
        ini: rpId,
        fin: cntId,
        piso: String(engine.nivelActual?.n ?? ''),
        dz: '',
        uc: 0,
        labelX: (nearestRP.x + px) / 2,
        labelY: (nearestRP.y + py) / 2,
        labelAngle: 0,
        material: '',
        diametro: '',
        pendiente: 1.5,
        bloqueado: true,
      });
    }
  }

  engine.render();
  engine._markDirty();
}
