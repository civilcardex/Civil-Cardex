import type {
  PlanoRamal,
  PlanoBajante,
  PlanoArea,
  PlanoTextAnnotation,
} from './PlanoState';
import type { IPlanoEngineCore } from './PlanoState';
import { _midpoint } from './PlanoEngineDrawing';
import { diamPulgFromLabel } from '../../utils/diamPulgFromLabel';

export { selectAt } from './selectAt';
export { deleteSelected } from './deleteSelected';
export { handleSelectDown } from './handleMouseDown';
export { handleDragMove } from './handleDragMove';
export { handleDragUp } from './handleDragUp';

export function selectById(engine: IPlanoEngineCore, id: string): void {
  engine._isGhostSel = false;
  const found = engine.ramales.find((r: any) => r.id === id)
    || engine.bajantes.find((b: any) => b.id === id)
    || engine.textAnnots.find((t: any) => t.id === id)
    || engine.areas.find((a: any) => a.id === id)
    || engine.dims.find((d: any) => d.id === id);
  if (found) { engine.selId = found.id; engine._emitSelect(found); engine.render(); }
}

export function getSelected(engine: IPlanoEngineCore): PlanoRamal | PlanoBajante | PlanoTextAnnotation | PlanoArea | null {
  if (!engine.selId) return null;
  return (engine.ramales.find((r: any) => r.id === engine.selId)
    || engine.bajantes.find((b: any) => b.id === engine.selId)
    || engine.textAnnots.find((t: any) => t.id === engine.selId)
    || engine.areas.find((a: any) => a.id === engine.selId)
    || null) as PlanoRamal | PlanoBajante | PlanoTextAnnotation | PlanoArea | null;
}

function checkVentDiameterLimits(engine: IPlanoEngineCore, el: any, fields: Record<string, unknown>): boolean {
  if (!el || !fields) return true;

  const getConnectedVentRamales = (b: any) => {
    const ventRamales = engine.ramales.filter((r: any) => r.net === 'vent');
    const connected: any[] = [];
    const disp = b.desplazamientos?.[engine.nivelActual?.label ?? ''];
    const bx = b.x + (disp ? disp.dx : 0);
    const by = b.y + (disp ? disp.dy : 0);
    for (const vr of ventRamales) {
      const isExplicit = b.recibeDeIds && (b.recibeDeIds.includes(vr.id) || (vr.label && b.recibeDeIds.includes(vr.label)));
      let isConnected = isExplicit;
      if (!isConnected && vr.pts && vr.pts.length >= 2) {
        const d1 = Math.hypot(vr.pts[0][0] - bx, vr.pts[0][1] - by);
        const d2 = Math.hypot(vr.pts[vr.pts.length - 1][0] - bx, vr.pts[vr.pts.length - 1][1] - by);
        if (d1 < 2.0 || d2 < 2.0) isConnected = true;
      }
      if (isConnected) connected.push(vr);
    }
    return connected;
  };

  const getConnectedVentBajantes = (r: any) => {
    const ventBajantes = engine.bajantes.filter((b: any) => b.net === 'vent');
    const connected: any[] = [];
    for (const vb of ventBajantes) {
      const disp = vb.desplazamientos?.[engine.nivelActual?.label ?? ''];
      const bx = vb.x + (disp ? disp.dx : 0);
      const by = vb.y + (disp ? disp.dy : 0);
      const isExplicit = vb.recibeDeIds && (vb.recibeDeIds.includes(r.id) || (r.label && vb.recibeDeIds.includes(r.label)));
      let isConnected = isExplicit;
      if (!isConnected && r.pts && r.pts.length >= 2) {
        const d1 = Math.hypot(r.pts[0][0] - bx, r.pts[0][1] - by);
        const d2 = Math.hypot(r.pts[r.pts.length - 1][0] - bx, r.pts[r.pts.length - 1][1] - by);
        if (d1 < 2.0 || d2 < 2.0) isConnected = true;
      }
      if (isConnected) connected.push(vb);
    }
    return connected;
  };

  const isVent = el.net === 'vent' || el._net === 'vent';
  if (isVent) {
    if (el.tipo === 'bajante' || el.tipo === 'montante') {
      let newDNom = '';
      if (fields.dNominal !== undefined) {
        newDNom = String(fields.dNominal || '');
      } else if (fields.ghostData !== undefined) {
        const lvl = engine.nivelActual?.label ?? '';
        const gd = (fields.ghostData as any)[lvl] || {};
        newDNom = String(gd.dNominal || gd.d_nominal || '');
      }
      if (newDNom) {
        const bDVal = diamPulgFromLabel(newDNom);
        if (bDVal > 0) {
          const connected = getConnectedVentRamales(el);
          for (const vr of connected) {
            const rDVal = vr.diamPulg || diamPulgFromLabel(vr.diametro);
            if (rDVal > 0 && bDVal < rDVal) {
              engine.triggerAlert(
                'Diámetro no válido',
                `El diámetro del bajante de ventilación (${newDNom}) no puede ser inferior al diámetro del ramal de ventilación al que está conectado (${vr.diametro || vr.id}).`
              );
              if (fields.dNominal !== undefined) {
                fields.dNominal = '';
              } else if (fields.ghostData !== undefined) {
                const lvl = engine.nivelActual?.label ?? '';
                const gd = (fields.ghostData as any)[lvl] || {};
                gd.dNominal = '';
                gd.d_nominal = '';
              }
              return true;
            }
          }
        }
      }
    } else if (el.id?.startsWith('R') && fields.diametro !== undefined) {
      const newDiam = String(fields.diametro || '');
      const rDVal = diamPulgFromLabel(newDiam);
      if (rDVal > 0) {
        const connected = getConnectedVentBajantes(el);
        for (const vb of connected) {
          const lvl = engine.nivelActual?.label ?? '';
          const gd = vb.ghostData?.[lvl];
          const bNominal = gd?.dNominal || gd?.d_nominal || vb.dNominal || '';
          const bDVal = vb.diamPulg || diamPulgFromLabel(bNominal);
          if (bDVal > 0 && bDVal < rDVal) {
            engine.triggerAlert(
              'Diámetro no válido',
              `El diámetro del bajante de ventilación (${bNominal || vb.id}) no puede ser inferior al diámetro del ramal de ventilación al que está conectado (${newDiam}).`
            );
            fields.diametro = '';
            return true;
          }
        }
      }
    }
  }
  return true;
}

export function updateSelected(engine: IPlanoEngineCore, fields: Record<string, unknown>): void {
  const el = getSelected(engine);
  if (el) {
    checkVentDiameterLimits(engine, el, fields);
    Object.assign(el, fields);
    if ((el as PlanoRamal).pts && el.id?.startsWith('R') && fields.pts) {
      const [mx, my] = _midpoint((el as PlanoRamal).pts);
      (el as PlanoRamal).labelX = mx;
      (el as PlanoRamal).labelY = my;
    }
  } else {
    return;
  }
  engine.render();
  engine._markDirty();
}

export function updateElementById(engine: IPlanoEngineCore, id: string, fields: Record<string, unknown>): void {
  let el: PlanoRamal | PlanoBajante | PlanoTextAnnotation | PlanoArea | undefined =
    (engine.ramales.find((r: any) => r.id === id)
      || engine.bajantes.find((b: any) => b.id === id)
      || engine.textAnnots.find((t: any) => t.id === id)
      || engine.areas.find((a: any) => a.id === id)) as any;
  if (el) {
    checkVentDiameterLimits(engine, el, fields);
    Object.assign(el, fields);
    if ((el as PlanoRamal).pts && el.id?.startsWith('R') && fields.pts) {
      const [mx, my] = _midpoint((el as PlanoRamal).pts);
      (el as PlanoRamal).labelX = mx;
      (el as PlanoRamal).labelY = my;
    }
    engine.selId = id;
  }
  engine.render();
  engine._markDirty();
}

export function rotateLabelSnap(engine: IPlanoEngineCore): void {
  const el = getSelected(engine);
  if (!el) return;
  const ANGLES = [0, 45, 90, -90, -45];
  if (el.id?.startsWith('T') && (el as PlanoTextAnnotation).text !== undefined) {
    const cur = (el as PlanoTextAnnotation).textAngle || 0;
    const idx = ANGLES.reduce((b, a, i) => Math.abs(cur - a) < Math.abs(cur - ANGLES[b]) ? i : b, 0);
    (el as PlanoTextAnnotation).textAngle = ANGLES[(idx + 1) % ANGLES.length];
  } else {
    const cur = (el as any).labelAngle || 0;
    const idx = ANGLES.reduce((b, a, i) => Math.abs(cur - a) < Math.abs(cur - ANGLES[b]) ? i : b, 0);
    (el as any).labelAngle = ANGLES[(idx + 1) % ANGLES.length];
  }
  engine._emitSelect(el);
  engine.render();
}

export function resetLabel(engine: IPlanoEngineCore): void {
  const el = getSelected(engine);
  if (!el) return;
  if ((el as PlanoRamal).pts) {
    const [mx, my] = _midpoint((el as PlanoRamal).pts);
    (el as any).labelX = mx;
    (el as any).labelY = my;
    (el as any).labelAngle = 0;
  } else {
    (el as any).labelX = (el as any).x;
    (el as any).labelY = (el as any).y;
    (el as any).labelAngle = 0;
  }
  engine.render();
}
