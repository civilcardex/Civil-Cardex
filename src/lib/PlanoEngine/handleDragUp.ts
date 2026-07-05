import type { IPlanoEngineCore } from './PlanoState';
import type { PlanoRamal } from './PlanoState';
import { NETS } from './PlanoState';
import { checkRamalAngles } from './drawingAngles';

export function handleDragUp(engine: IPlanoEngineCore, isCtrl: boolean = false): void {
  if (engine.marqueeRect) {
    const { x1, y1, x2, y2 } = engine.marqueeRect;
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    const w = maxX - minX, h = maxY - minY;
    engine.marqueeRect = null;
    if (w >= 3 || h >= 3) {
      if (!isCtrl) {
        engine.multiSel = [];
      }
      engine.ramales.forEach(r => {
        let inside = false;
        const lc = engine.toCvs(r.labelX || 0, r.labelY || 0);
        if (lc.x >= minX && lc.x <= maxX && lc.y >= minY && lc.y <= maxY) inside = true;
        if (!inside) {
          for (const pt of r.pts) {
            const c = engine.toCvs(pt[0], pt[1]);
            if (c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY) { inside = true; break; }
          }
        }
        if (!inside && r.pts.length >= 2) {
          for (let i = 0; i < r.pts.length - 1; i++) {
            const p1 = engine.toCvs(r.pts[i][0], r.pts[i][1]);
            const p2 = engine.toCvs(r.pts[i+1][0], r.pts[i+1][1]);
            let t0 = 0, t1 = 1;
            const dx = p2.x - p1.x, dy = p2.y - p1.y;
            const p = [-dx, dx, -dy, dy];
            const q = [p1.x - minX, maxX - p1.x, p1.y - minY, maxY - p1.y];
            let ok = true;
            for (let k = 0; k < 4; k++) {
              if (p[k] === 0) { if (q[k] < 0) { ok = false; break; } }
              else { const t = q[k] / p[k]; if (p[k] < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t); if (t0 > t1) { ok = false; break; } }
            }
            if (ok) { inside = true; break; }
          }
        }
        if (inside && !engine.multiSel.includes(r.id)) engine.multiSel.push(r.id);
      });
      engine.bajantes.forEach(b => {
        const c = engine.toCvs(b.x, b.y);
        if (c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY) {
          if (!engine.multiSel.includes(b.id)) engine.multiSel.push(b.id);
        }
      });
      engine.textAnnots.forEach(t => {
        const c = engine.toCvs(t.x, t.y);
        if (c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY) {
          if (!engine.multiSel.includes(t.id)) engine.multiSel.push(t.id);
        }
      });
      engine.selId = null;
      engine._emitSelect(null);
    }
    engine.render();
    return;
  }
  if (engine.multiDrag) { engine.multiDrag = null; engine._markDirty(); engine.render(); }
  if (engine.ghostDrag) {
    const b = engine.bajantes.find((bb: any) => bb.id === engine.ghostDrag!.id);
    if (b && engine.nivelActual && (b as any).desplazamientos?.[engine.nivelActual.label ?? '']) {
      const d = (b as any).desplazamientos[engine.nivelActual.label ?? ''];
      if (Math.abs(d.dx) < 1 && Math.abs(d.dy) < 1) {
        delete (b as any).desplazamientos[engine.nivelActual.label ?? ''];
      } else {
        const oldLdesvio = d.Ldesvio;
        if (!oldLdesvio) {
          const net = NETS.find(n => n.id === (b as any).net);
          const pfx = net ? net.lbl : 'R';
          const cnt = ++(engine._netCounts[(b as any).net].ramal);
          const ramId = pfx + cnt;
          const diam = (b as any).dNominal || '0';
          const ramal: PlanoRamal = {
            id: ramId,
            net: (b as any).net,
            tipo: 'ramal',
            padre: null,
            pts: [[b.x, b.y], [b.x + d.dx, b.y + d.dy]],
            totalL: +(engine.pxToM(Math.hypot(d.dx, d.dy))).toFixed(3),
            label: pfx + cnt,
            ini: '',
            fin: '',
            piso: engine.nivelActual?.n ?? '',
            dz: '',
            uc: 0,
            labelX: (b.x + b.x + d.dx) / 2,
            labelY: (b.y + b.y + d.dy) / 2,
            labelAngle: 0,
            material: '',
            diametro: diam !== '0' ? diam : '',
            pendiente: 1.5,
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
  if (engine.lblDrag) { engine._markDirty(); engine.lblDrag = null; }
  if (engine.txtDrag) engine.txtDrag = null;
  if (engine.bajDrag) engine.bajDrag = null;
  if (engine.areaDrag) engine.areaDrag = null;
  if (engine.ptDrag) {
    const rId = engine.ptDrag.id;
    engine.ptDrag = null;
    engine._markDirty();
    const ram = engine.ramales.find((r: any) => r.id === rId);
    if (ram && !checkRamalAngles(ram.pts, ram.net)) {
      engine.triggerAlert(
        'Ángulo no recomendado',
        (ram.net === 'san' || ram.net === 'll')
          ? 'Las redes sanitarias y de lluvias solo permiten ángulos de 45°.'
          : 'Esta red debe diseñarse con ángulos de 45° o 90°.'
      );
      if ((engine as any)._dragBackupPts) {
        ram.pts = (engine as any)._dragBackupPts;
        (engine as any)._dragBackupPts = null;
        engine._markDirty();
        engine.render();
      }
    }
  }
  if (engine.ramalDrag) {
    const rId = engine.ramalDrag.id;
    const origPts = engine.ramalDrag.origPts;
    engine.ramalDrag = null;
    engine._markDirty();
    const ram = engine.ramales.find((r: any) => r.id === rId);
    if (ram && !checkRamalAngles(ram.pts, ram.net)) {
      engine.triggerAlert(
        'Ángulo no recomendado',
        (ram.net === 'san' || ram.net === 'll')
          ? 'Las redes sanitarias y de lluvias solo permiten ángulos de 45°.'
          : 'Esta red debe diseñarse con ángulos de 45° o 90°.'
      );
      if (origPts) {
        ram.pts = origPts;
        engine._markDirty();
        engine.render();
      }
    }
  }
}
