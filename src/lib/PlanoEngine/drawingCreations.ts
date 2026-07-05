import { NETS } from './PlanoState';
import type { IPlanoEngineCore } from './PlanoState';

export function handleBajanteDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (engine.snapMode) {
    const sp = engine.snapToExisting(px, py);
    if (sp) { px = sp.x; py = sp.y; }
  }
  const ASSOC_THRESH = 20 / engine.zoom;
  const assocRamales: string[] = [];
  for (const r of engine.ramales) {
    if (r.net !== engine.activeNet || !r.pts?.length) continue;
    const startDist = Math.hypot(px - r.pts[0][0], py - r.pts[0][1]);
    const li = r.pts.length - 1;
    const endDist = Math.hypot(px - r.pts[li][0], py - r.pts[li][1]);
    if (startDist < ASSOC_THRESH && startDist <= endDist) {
      px = r.pts[0][0]; py = r.pts[0][1];
      assocRamales.push(r.id);
    } else if (endDist < ASSOC_THRESH) {
      px = r.pts[li][0]; py = r.pts[li][1];
      assocRamales.push(r.id);
    }
  }
  const net = NETS.find(n => n.id === engine.activeNet);
  const netPfx = net ? net.bmPfx : 'BAJ';
  const cnt = engine.bajantes.filter(b => b.tipo === 'bajante' && b.net === engine.activeNet).length + 1;
  const bajId = netPfx + cnt;
  engine.bajantes.push({
    id: bajId,
    net: engine.activeNet,
    tipo: 'bajante',
    code: bajId,
    x: px, y: py,
    pisoBase: engine.nivelActual?.label ?? '',
    pisoCima: engine.nivelActual?.label ?? '',
    nptBase: engine.nivelActual?.npt ?? 0,
    nptCima: engine.nivelActual?.npt ?? 0,
    hVert: 0, dNominal: '0',
    recibeDeIds: assocRamales, alimentaIds: [], descargaEnId: null,
    ucAcum: 0, ucExtra: 0, area_m2: 0,
    desplazamientos: {},
    lblOffX: 0, lblOffY: 0,
    labelAngle: 0,
    labelX: px, labelY: py + 20,
    bajR: 7/24,
  });
  engine.selId = bajId;
  engine._isGhostSel = false;
  engine._emitSelect(engine.bajantes[engine.bajantes.length - 1]);
  engine.render();
  engine._markDirty();
}

export function handleMontanteDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (engine.snapMode) {
    const sp = engine.snapToExisting(px, py);
    if (sp) { px = sp.x; py = sp.y; }
  }
  const netDef = NETS.find(n => n.id === engine.activeNet);
  const pfx = netDef?.bmPfx || 'MON';
  const cnt = engine.bajantes.filter(b => b.tipo === 'montante' && b.net === engine.activeNet).length + 1;
  const monId = `${pfx}${cnt}_${engine.activeNet}`;
  const code = `${pfx}${cnt}`;
  engine.bajantes.push({
    id: monId,
    net: engine.activeNet,
    tipo: 'montante',
    code: code,
    x: px, y: py,
    pisoBase: engine.nivelActual?.label ?? '',
    pisoCima: engine.nivelActual?.label ?? '',
    nptBase: engine.nivelActual?.npt ?? 0,
    nptCima: engine.nivelActual?.npt ?? 0,
    hVert: 0, dNominal: '0',
    recibeDeIds: [], alimentaIds: [], descargaEnId: null,
    ucAcum: 0, ucExtra: 0, area_m2: 0,
    desplazamientos: {},
    lblOffX: 0, lblOffY: 0,
    labelAngle: 0,
    labelX: px, labelY: py + 20,
    bajR: 7/24,
  });
  engine._renumberMontantes();
  const newlyCreated = engine.bajantes.find(b => b.tipo === 'montante' && b.x === px && b.y === py);
  if (newlyCreated) {
    engine.selId = newlyCreated.id;
    engine._emitSelect(newlyCreated);
  }
  engine._isGhostSel = false;
  engine.render();
  engine._markDirty();
}

export function handleCalentadorDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (engine.snapMode) {
    const sp = engine.snapToExisting(px, py);
    if (sp) { px = sp.x; py = sp.y; }
  }
  const calent = engine.bajantes.filter(b => b.tipo === 'calentador').length + 1;
  const calentId = 'CALENT' + calent;
  engine.bajantes.push({
    id: calentId,
    net: engine.activeNet,
    tipo: 'calentador',
    code: 'CALENT' + calent,
    x: px, y: py,
    pisoBase: engine.nivelActual?.label ?? '',
    pisoCima: engine.nivelActual?.label ?? '',
    nptBase: engine.nivelActual?.npt ?? 0,
    nptCima: engine.nivelActual?.npt ?? 0,
    hVert: 0, dNominal: '0',
    recibeDeIds: [], alimentaIds: [], descargaEnId: null,
    ucAcum: 0, ucExtra: 0, area_m2: 0,
    desplazamientos: {},
    lblOffX: 0, lblOffY: 0,
    labelAngle: 0,
    labelX: px - 25, labelY: py,
    bajR: 7/24,
  });
  engine.selId = calentId;
  engine.render();
  engine._markDirty();
}

export function handleRedPublicaDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (engine.snapMode) {
    const sp = engine.snapToExisting(px, py);
    if (sp) { px = sp.x; py = sp.y; }
  }
  const cnt = engine.bajantes.filter(b => b.tipo === 'red_publica').length + 1;
  const rpId = 'RP' + cnt;
  engine.bajantes.push({
    id: rpId,
    net: engine.activeNet,
    tipo: 'red_publica',
    code: 'RP' + cnt,
    x: px, y: py,
    pisoBase: engine.nivelActual?.label ?? '',
    pisoCima: engine.nivelActual?.label ?? '',
    nptBase: engine.nivelActual?.npt ?? 0,
    nptCima: engine.nivelActual?.npt ?? 0,
    hVert: 0, dNominal: '0',
    recibeDeIds: [], alimentaIds: [], descargaEnId: null,
    ucAcum: 0, ucExtra: 0, area_m2: 0,
    desplazamientos: {},
    lblOffX: 0, lblOffY: 0,
    labelAngle: 0,
    labelX: px, labelY: py + 20,
    bajR: 7/24,
  });
  engine.selId = rpId;
  engine._isGhostSel = false;
  engine._emitSelect(engine.bajantes[engine.bajantes.length - 1]);
  engine.render();
  engine._markDirty();
}

export function handleContadorDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (engine.snapMode) {
    const sp = engine.snapToExisting(px, py);
    if (sp) { px = sp.x; py = sp.y; }
  }
  const cntPfx = engine.activeNet === 'gas' ? 'CTNG' : 'CNTAF';
  const cnt = engine.bajantes.filter(b => b.tipo === 'contador').length + 1;
  const cntId = cntPfx + cnt;
  engine.bajantes.push({
    id: cntId,
    net: engine.activeNet,
    tipo: 'contador',
    code: cntPfx + cnt,
    x: px, y: py,
    pisoBase: engine.nivelActual?.label ?? '',
    pisoCima: engine.nivelActual?.label ?? '',
    nptBase: engine.nivelActual?.npt ?? 0,
    nptCima: engine.nivelActual?.npt ?? 0,
    hVert: 0, dNominal: '0',
    recibeDeIds: [], alimentaIds: [], descargaEnId: null,
    ucAcum: 0, ucExtra: 0, area_m2: 0,
    desplazamientos: {},
    lblOffX: 0, lblOffY: 0,
    labelAngle: 0,
    labelX: px - 25, labelY: py,
    bajR: 7/24,
  });
  engine.selId = cntId;
  engine._isGhostSel = false;
  engine._emitSelect(engine.bajantes[engine.bajantes.length - 1]);

  const rps = engine.bajantes.filter(b => b.tipo === 'red_publica' && b.net === engine.activeNet);
  if (rps.length > 0) {
    let nearestRP = rps[0];
    let minDist = Infinity;
    for (const rp of rps) {
      const d = Math.hypot(rp.x - px, rp.y - py);
      if (d < minDist) { minDist = d; nearestRP = rp; }
    }
    const rpId = nearestRP.code || nearestRP.id;
    const alreadyConnected = engine.ramales.some((r: any) =>
      r.net === engine.activeNet && ((r.ini === rpId && r.fin === cntId) || (r.ini === cntId && r.fin === rpId))
    );
    if (!alreadyConnected) {
      const net = NETS.find(n => n.id === engine.activeNet);
      const pfx = net ? net.lbl : 'R';
      if (!engine._netCounts[engine.activeNet]) engine._netCounts[engine.activeNet] = { ramal: 0, tributario: 0 };
      const ramCnt = ++(engine._netCounts[engine.activeNet].ramal);
      const ramId = pfx + ramCnt;
      engine.ramales.push({
        id: ramId,
        net: engine.activeNet,
        _net: engine.activeNet,
        tipo: 'ramal',
        padre: null,
        pts: [[nearestRP.x, nearestRP.y], [px, py]],
        totalL: +(engine.pxToM(Math.hypot(px - nearestRP.x, py - nearestRP.y))).toFixed(3),
        label: pfx + ramCnt,
        ini: rpId,
        fin: cntId,
        piso: engine.nivelActual?.n ?? '',
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
