import { useMemo, useState, useEffect } from 'react';
import { SAN_ACCESORIOS } from '../constants';
import { HYDRO_DATA_STORAGE_KEY, TRAZOS_PREFIX } from '../constants/storage-keys';
import { loadFromStorage } from '../services/storageService';
import { useTramos } from '../context/TramosContext';
import { diamPulgFromLabel } from '../utils/diamPulgFromLabel';
import { usePlans } from '../context/PlansContext';

function loadHidro(): Record<string, any> {
  return loadFromStorage(HYDRO_DATA_STORAGE_KEY, {});
}

function formatDiamPulg(diam: string, diamPulg?: number): string {
  const dVal = diamPulg || diamPulgFromLabel(diam);
  if (!dVal) return '—';
  if (dVal === 0.5) return '½"';
  if (dVal === 0.75) return '¾"';
  if (dVal === 1) return '1"';
  if (dVal === 1.25) return '1 ¼"';
  if (dVal === 1.5) return '1 ½"';
  if (dVal === 2) return '2"';
  if (dVal === 2.5) return '2 ½"';
  if (dVal === 3) return '3"';
  if (dVal === 4) return '4"';
  if (dVal === 6) return '6"';
  const str = String(dVal);
  return str.endsWith('"') ? str : `${str}"`;
}

function formatDiamFromLabel(label: string): string {
  if (!label) return '—';
  const p = diamPulgFromLabel(label);
  return formatDiamPulg(label, p);
}

function formatYeeDiam(mainDiam: string, branchDiam: string): string {
  const m = formatDiamFromLabel(mainDiam);
  const b = formatDiamFromLabel(branchDiam);
  if (m === '—' || b === '—') return m;
  return `${m}×${b}`;
}

export default function SanAccesoriosPage() {
  const [tick, setTick] = useState(0);
  const { tramosSan } = useTramos();
  const { plans } = usePlans();

  useEffect(() => {
    const handler = () => setTick(t => t + 1);
    window.addEventListener('storage', handler);
    const iv = setInterval(handler, 10000);
    return () => { window.removeEventListener('storage', handler); clearInterval(iv); };
  }, []);

  const yeeDiams = useMemo(() => {
    const result: Record<string, { simple: string[]; doble: string[] }> = {};
    
    // Helper: distance from point P to segment AB
    const distToSegment = (P: number[], A: number[], B: number[]) => {
      const dx = B[0] - A[0], dy = B[1] - A[1];
      if (dx === 0 && dy === 0) return Math.hypot(P[0] - A[0], P[1] - A[1]);
      let t = ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / (dx * dx + dy * dy);
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(P[0] - (A[0] + t * dx), P[1] - (A[1] + t * dy));
    };
    
    // Load full drawing data with pts from localStorage
    const drawingRamales: Array<{ id: string; label: string; diametro: string; pts: number[][]; tipo: string; planId: string }> = [];
    if (plans) {
      for (const plan of plans) {
        if (plan.status !== 'confirmed') continue;
        const raw = loadFromStorage<any>(TRAZOS_PREFIX + plan.id, null);
        if (!raw) continue;
        let data = raw;
        if (typeof data === 'string') { try { data = JSON.parse(data); } catch { continue; } }
        const ramales = (data.ramales || []).filter((r: any) => r.net === 'san' && r.tipo !== 'tributario');
        for (const r of ramales) {
          if (r.pts && r.pts.length >= 2) {
            drawingRamales.push({
              id: r.id,
              label: r.label || r.id,
              diametro: r.diametro || '',
              pts: r.pts,
              tipo: r.tipo || 'ramal',
              planId: plan.id
            });
          }
        }
      }
    }
    
    // Find all connections: tributarios (via padreTributarioLabel/padre) AND ramales (via geometric proximity)
    const allConnections: { parentLabel: string; diamStr: string }[] = [];
    
    // Case 1: tributarios from tramosSan
    for (const child of tramosSan) {
      if (child.esBajante) continue;
      const childDiam = (child as any).diametro || '';
      const childDiamStr = formatDiamFromLabel(childDiam);
      if (!childDiamStr || childDiamStr === '—') continue;
      
      const parentLabel = (child as any).padreTributarioLabel || (child as any).padre;
      if (parentLabel) {
        allConnections.push({ parentLabel, diamStr: childDiamStr });
      }
    }
    
    // Case 2: ramal-to-ramal geometric connections from drawing data
    for (const child of drawingRamales) {
      const childDiamStr = formatDiamFromLabel(child.diametro);
      if (!childDiamStr || childDiamStr === '—') continue;
      
      const childEndpoints = [child.pts[0], child.pts[child.pts.length - 1]];
      
      for (const parent of drawingRamales) {
        if (parent.id === child.id) continue;
        
        for (const ep of childEndpoints) {
          let nearSegment = false;
          for (let i = 0; i < parent.pts.length - 1; i++) {
            const dist = distToSegment(ep, parent.pts[i], parent.pts[i + 1]);
            if (dist < 0.5) {
              nearSegment = true;
              break;
            }
          }
          if (nearSegment) {
            allConnections.push({ parentLabel: parent.label, diamStr: childDiamStr });
            break; // Only count once per child-parent pair
          }
        }
      }
    }
    
    // Group connections by parent
    const byParent: Record<string, { diamStr: string }[]> = {};
    for (const conn of allConnections) {
      if (!byParent[conn.parentLabel]) byParent[conn.parentLabel] = [];
      byParent[conn.parentLabel].push({ diamStr: conn.diamStr });
    }
    
    // Build result
    for (const t of tramosSan) {
      if (t.esBajante || t.tipo === 'tributario') continue;
      const parentLabel = (t as any).label || t.id;
      const mainDiam = (t as any).diametro || '';
      const mainDiamStr = formatDiamFromLabel(mainDiam);
      
      const myConnections = byParent[parentLabel] || [];
      if (myConnections.length === 0) continue;
      
      // Group by diameter
      const byDiam: Record<string, number> = {};
      myConnections.forEach(c => { byDiam[c.diamStr] = (byDiam[c.diamStr] || 0) + 1; });
      
      if (!result[parentLabel]) result[parentLabel] = { simple: [], doble: [] };
      
      // Pairs form dobles, remainder forms simples
      for (const [diamStr, count] of Object.entries(byDiam)) {
        const dobleCount = Math.floor(count / 2);
        const simpleCount = count % 2;
        for (let i = 0; i < dobleCount; i++) {
          result[parentLabel].doble.push(`${mainDiamStr}×${diamStr}`);
        }
        if (simpleCount > 0) {
          result[parentLabel].simple.push(`${mainDiamStr}×${diamStr}`);
        }
      }
    }
    return result;
  }, [tick, tramosSan, plans]);

  const tramos = useMemo(() => {
    const hidroData = loadHidro();
    const result = [];
    const filtered = tramosSan.filter(t => (t.tipo === 'ramal' || t.tipo === 'tributario') && !t.esBajante);
    for (const t of filtered) {
      const key = `san_${t.id}_${t.planId}`;
      const srcAcc = hidroData[key]?.accesorios || {};
      const acc: Record<string, number> = {};
      for (const a of SAN_ACCESORIOS) {
        acc[a.id] = srcAcc[a.id] || 0;
      }
      result.push({
        id: t.id,
        label: (t as any).label || t.id,
        tipo: t.tipo,
        piso: t.piso,
        _nivelLabel: (t as any)._nivelLabel,
        diametro: (t as any).diametro || '',
        diamPulg: (t as any).diamPulg,
        accesorios: acc,
        accesorioInicio: (t as any).accesorioInicio,
        accesorioFin: (t as any).accesorioFin,
        diametroInicio: (t as any).diametroInicio,
        diametroFin: (t as any).diametroFin,
        padreTributarioLabel: (t as any).padreTributarioLabel
      });
    }
    return result;
  }, [tick, tramosSan]);

  const totalsByDiameter = useMemo(() => {
    const hidroData = loadHidro();
    const totals: Record<string, Record<string, number>> = {};

    const addAcc = (diam: string, accId: string, count: number) => {
      if (!totals[diam]) {
        totals[diam] = {};
        for (const a of SAN_ACCESORIOS) {
          totals[diam][a.id] = 0;
        }
      }
      totals[diam][accId] += count;
    };

    tramosSan.forEach(t => {
      if (t.esBajante) return;

      const mainDiam = (t as any).diametro || '';
      const mainDiamStr = formatDiamFromLabel(mainDiam);

      if (t.tipo === 'tributario') {
        const accIni = (t as any).accesorioInicio;
        if (accIni) {
          const dIni = (t as any).diametroInicio || mainDiam;
          const dStr = formatDiamFromLabel(dIni);
          const accId = accIni === 'codoSube' ? 'codo90rmSube' : (accIni === 'codoBaja' ? 'codo90rmBaja' : accIni);
          addAcc(dStr, accId, 1);
        }
        const accFin = (t as any).accesorioFin;
        if (accFin) {
          const dFin = (t as any).diametroFin || mainDiam;
          const dStr = formatDiamFromLabel(dFin);
          const accId = accFin === 'codoSube' ? 'codo90rmSube' : (accFin === 'codoBaja' ? 'codo90rmBaja' : accFin);
          addAcc(dStr, accId, 1);
        }
      } else {
        const key = `san_${t.id}_${t.planId}`;
        const srcAcc = hidroData[key]?.accesorios || {};
        const yd = yeeDiams[(t as any).label || t.id] || { simple: [], doble: [] };
        for (const a of SAN_ACCESORIOS) {
          const v = srcAcc[a.id] || 0;
          if (v <= 0) continue;
          if (a.id === 'yeeSimple') {
            if (yd.simple.length > 0) {
              yd.simple.forEach(diamCombo => addAcc(diamCombo, a.id, 1));
              void v;
            } else {
              addAcc(mainDiamStr, a.id, v);
            }
          } else if (a.id === 'yeeDoble') {
            if (yd.doble.length > 0) {
              yd.doble.forEach(diamCombo => addAcc(diamCombo, a.id, 1));
            } else {
              addAcc(mainDiamStr, a.id, v);
            }
          } else {
            addAcc(mainDiamStr, a.id, v);
          }
        }
      }
    });

    return Object.entries(totals)
      .map(([diametro, accesorios]) => ({ diametro, accesorios }))
      .filter(row => Object.values(row.accesorios).some(count => count > 0))
      .sort((a, b) => {
        const aMain = a.diametro.split('×')[0].trim();
        const bMain = b.diametro.split('×')[0].trim();
        const valA = diamPulgFromLabel(aMain);
        const valB = diamPulgFromLabel(bMain);
        return valB - valA;
      });
  }, [tick, tramosSan]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1, paddingBottom: '24px' }}>
      
      {/* Card: Resumen de accesorios por diámetro */}
      <section className="card" style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, maxHeight: '100%', overflow: 'hidden' }}>
        <div className="card-h">
          <h3 className="card-t">
            <img src="/iconos_diseno_redes/general/Accesorios.svg" alt="Totales" width={24} height={24} style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }} loading="lazy" />
            Resumen de accesorios por diámetro
          </h3>
          <span className="card-s">Totales acumulados</span>
        </div>
        <div className="scroll-top" style={{ padding: '12px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div className="scroll-inner" style={{ minWidth: 'max-content' }}>
            <table className="tbl" style={{ minWidth: 760, fontSize: 13 }}>
              <thead>
                <tr>
                  <th scope="col" className="col-h" style={{ minWidth: 168, textAlign: 'center', background: 'var(--bg2)', fontSize: 11, padding: '5px 4px' }}>Diámetro</th>
                  {SAN_ACCESORIOS.map(a => (
                    <th scope="col" key={a.id} className="col-h" style={{ minWidth: 56, fontSize: 10, textAlign: 'center', whiteSpace: 'nowrap', padding: '5px 2px' }}>
                      <img src={a.icono} alt={a.nombre} width={24} height={24} style={{ width: 24, height: 24, objectFit: 'contain', display: 'block', margin: '0 auto 2px' }} loading="lazy" />
                      <span style={{ fontSize: 9, fontWeight: 500 }}>{a.nombre}</span>
                    </th>
                  ))}
                  <th scope="col" className="col-h" style={{ minWidth: 64, fontSize: 10, textAlign: 'center', background: 'var(--bg2)', padding: '5px 4px', fontWeight: 600 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {totalsByDiameter.map((row, i) => {
                  const total = Object.values(row.accesorios).reduce((s, n) => s + n, 0);
                  return (
                    <tr key={i}>
                      <td className="c" style={{ fontSize: 13, textAlign: 'center', fontWeight: 700, background: 'var(--bg2)', padding: '6px 4px' }}>{row.diametro}</td>
                      {SAN_ACCESORIOS.map(a => {
                        const v = row.accesorios[a.id] || 0;
                        return (
                          <td key={a.id} className="c" style={{ padding: '6px 2px' }}>
                            <span style={{ fontSize: 13, fontFamily: "'Courier New',Courier,monospace", fontWeight: v > 0 ? 600 : 400, color: v > 0 ? 'var(--txt)' : 'var(--txt3)' }}>{v || '\u2014'}</span>
                          </td>
                        );
                      })}
                      <td className="c" style={{ fontSize: 13, textAlign: 'center', fontWeight: 700, background: 'var(--bg2)', padding: '6px 4px', color: 'var(--txt)' }}>{total || '\u2014'}</td>
                    </tr>
                  );
                })}
                {totalsByDiameter.length === 0 && (
                  <tr>
                    <td className="c" colSpan={2 + SAN_ACCESORIOS.length} style={{ fontSize: 11, color: 'var(--txt3)', padding: '24px 0', textAlign: 'center' }}>
                      No hay accesorios.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      
    </div>
  );
}
