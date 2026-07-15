import { NETS } from '../lib/PlanoEngine/PlanoState';

export function createConnectingRamalIfNeeded(
  engine: any,
  sourceX: number,
  sourceY: number,
  sourceNet: string,
  destValue: string,
  lowerFloorsRamales: any[],
) {
  const oParts = destValue.split('|');
  const oPlanId = oParts[0];
  const oTgtId = oParts[1];
  const lowerPl = lowerFloorsRamales.find((g: any) => String(g.planId) === String(oPlanId));
  const targetBaj = lowerPl?.bajantes?.find((b: any) => String(b.id) === String(oTgtId));
  if (!targetBaj) return;

  const dist = Math.hypot(sourceX - targetBaj.x, sourceY - targetBaj.y);
  if (dist <= 0.05) return;

  const exists = engine.ramales.some((r: any) =>
    (Math.hypot(r.pts[0][0] - sourceX, r.pts[0][1] - sourceY) < 0.5 &&
     Math.hypot(r.pts[r.pts.length - 1][0] - targetBaj.x, r.pts[r.pts.length - 1][1] - targetBaj.y) < 0.5) ||
    (Math.hypot(r.pts[0][0] - targetBaj.x, r.pts[0][1] - targetBaj.y) < 0.5 &&
     Math.hypot(r.pts[r.pts.length - 1][0] - sourceX, r.pts[r.pts.length - 1][1] - sourceY) < 0.5)
  );
  if (exists) return;

  const net = sourceNet || 'san';
  const cnt = ++(engine._netCounts[net]['ramal']);
  const newRamalId = 'R' + Date.now();
  const netPfx = NETS.find((n: any) => n.id === net)?.lbl || 'R';
  const newRamal: any = {
    id: newRamalId,
    net,
    tipo: 'ramal',
    padre: null,
    pts: [[sourceX, sourceY], [targetBaj.x, targetBaj.y]],
    totalL: +(engine.pxToM(dist)).toFixed(3),
    label: netPfx + cnt,
    ini: '', fin: '',
    piso: engine.nivelActual?.n ?? '',
    dz: '', uc: 0,
    labelX: (sourceX + targetBaj.x) / 2,
    labelY: (sourceY + targetBaj.y) / 2,
    labelAngle: 0,
    material: '',
    diametro: '',
    pendiente: 1.5,
    bloqueado: true,
  };
  engine.ramales.push(newRamal);
  engine._markDirty();
  engine.render();
}
