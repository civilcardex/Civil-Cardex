import { useMemo, useState, useEffect } from 'react';
import { SAN_ACCESORIOS } from '../constants';
import { HYDRO_DATA_STORAGE_KEY } from '../constants/storage-keys';
import { loadFromStorage } from '../services/storageService';
import { useTramos } from '../context/TramosContext';
import { diamPulgFromLabel } from '../utils/diamPulgFromLabel';

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

export default function SanAccesoriosPage() {
  const [tick, setTick] = useState(0);
  const { tramosSan } = useTramos();

  useEffect(() => {
    const handler = () => setTick(t => t + 1);
    window.addEventListener('storage', handler);
    const iv = setInterval(handler, 10000);
    return () => { window.removeEventListener('storage', handler); clearInterval(iv); };
  }, []);

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

      if (t.tipo === 'tributario') {
        const accIni = (t as any).accesorioInicio;
        if (accIni) {
          const dIni = (t as any).diametroInicio || (t as any).diametro || '';
          const dP = diamPulgFromLabel(dIni);
          const dStr = formatDiamPulg(dIni, dP);
          const accId = accIni === 'codoSube' ? 'codo90rmSube' : (accIni === 'codoBaja' ? 'codo90rmBaja' : accIni);
          addAcc(dStr, accId, 1);
        }
        const accFin = (t as any).accesorioFin;
        if (accFin) {
          const dFin = (t as any).diametroFin || (t as any).diametro || '';
          const dP = diamPulgFromLabel(dFin);
          const dStr = formatDiamPulg(dFin, dP);
          const accId = accFin === 'codoSube' ? 'codo90rmSube' : (accFin === 'codoBaja' ? 'codo90rmBaja' : accFin);
          addAcc(dStr, accId, 1);
        }
      } else {
        const key = `san_${t.id}_${t.planId}`;
        const srcAcc = hidroData[key]?.accesorios || {};
        const dStr = formatDiamPulg((t as any).diametro || '', (t as any).diamPulg);
        for (const a of SAN_ACCESORIOS) {
          const v = srcAcc[a.id] || 0;
          if (v > 0) {
            addAcc(dStr, a.id, v);
          }
        }
      }
    });

    return Object.entries(totals)
      .map(([diametro, accesorios]) => ({ diametro, accesorios }))
      .filter(row => Object.values(row.accesorios).some(count => count > 0))
      .sort((a, b) => {
        const valA = diamPulgFromLabel(a.diametro);
        const valB = diamPulgFromLabel(b.diametro);
        return valB - valA;
      });
  }, [tick, tramosSan]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1, paddingBottom: '24px' }}>
      
      {/* Card 1: Accesorios por ramal */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div className="card-h">
          <h3 className="card-t">
            <img src="/iconos_diseno_redes/general/Accesorios.svg" alt="Accesorios" width={24} height={24} style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }} loading="lazy" />
            Accesorios por ramal
          </h3>
          <span className="card-s">{tramos.length} tramos · Red sanitaria</span>
        </div>
        <div className="scroll-top" style={{ padding: '12px', flex: 1, minHeight: 0 }}>
          <div className="scroll-inner" style={{ minWidth: 'max-content' }}>
            <table className="tbl" style={{ minWidth: 760, fontSize: 13 }}>
              <thead>
                <tr>
                  <th scope="col" className="col-h" style={{ minWidth: 64, textAlign: 'center', position: 'sticky', left: 0, zIndex: 2, background: 'var(--bg2)', fontSize: 11, padding: '5px 4px' }}>Tramo</th>
                  <th scope="col" className="col-h" style={{ minWidth: 40, textAlign: 'center', position: 'sticky', left: 64, zIndex: 2, background: 'var(--bg2)', fontSize: 10, padding: '5px 4px' }}>Nivel</th>
                  <th scope="col" className="col-h" style={{ minWidth: 60, textAlign: 'center', position: 'sticky', left: 104, zIndex: 2, background: 'var(--bg2)', fontSize: 10, padding: '5px 4px' }}>Diámetro</th>
                  {SAN_ACCESORIOS.map(a => (
                    <th scope="col" key={a.id} className="col-h" style={{ minWidth: 56, fontSize: 10, textAlign: 'center', whiteSpace: 'nowrap', padding: '5px 2px' }}>
                      <img src={a.icono} alt={a.nombre} width={24} height={24} style={{ width: 24, height: 24, objectFit: 'contain', display: 'block', margin: '0 auto 2px' }} loading="lazy" />
                      <span style={{ fontSize: 9, fontWeight: 500 }}>{a.nombre}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tramos.map((t, i) => (
                  <tr key={i}>
                    <td className="c" style={{ fontSize: 13, textAlign: 'center', fontWeight: 600, position: 'sticky', left: 0, background: 'var(--bg2)', zIndex: 1, padding: '4px 4px' }}>
                      {t.label || t.id}
                    </td>
                    <td className="c" style={{ fontSize: 11, textAlign: 'center', position: 'sticky', left: 64, background: 'var(--bg2)', zIndex: 1, padding: '4px 4px', color: 'var(--txt2)' }}>
                      {t._nivelLabel || (t.piso != null ? (t.piso === 99 ? 'C' : t.piso < 0 ? `S${-t.piso}` : `P${t.piso}`) : '')}
                    </td>
                    <td className="c" style={{ fontSize: 12, textAlign: 'center', position: 'sticky', left: 104, background: 'var(--bg2)', zIndex: 1, padding: '4px 4px', color: 'var(--txt)', fontWeight: 600 }}>
                      {formatDiamPulg(t.diametro, t.diamPulg)}
                    </td>
                    {SAN_ACCESORIOS.map(a => {
                      const v = t.accesorios?.[a.id] || 0;
                      return (
                        <td key={a.id} className="c" style={{ padding: '4px 2px' }}>
                          <span style={{ fontSize: 13, fontFamily: "'Courier New',Courier,monospace", color: v > 0 ? 'var(--txt)' : 'var(--txt3)' }}>{v || '\u2014'}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {tramos.length === 0 && (
                  <tr>
                    <td className="c" colSpan={3 + SAN_ACCESORIOS.length} style={{ fontSize: 11, color: 'var(--txt3)', padding: '24px 0', textAlign: 'center' }}>
                      No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Card 2: Resumen de accesorios por diámetro */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div className="card-h">
          <h3 className="card-t">
            <img src="/iconos_diseno_redes/general/Accesorios.svg" alt="Totales" width={24} height={24} style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }} loading="lazy" />
            Resumen de accesorios por diámetro
          </h3>
          <span className="card-s">Totales acumulados</span>
        </div>
        <div className="scroll-top" style={{ padding: '12px', flex: 1, minHeight: 0 }}>
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
                </tr>
              </thead>
              <tbody>
                {totalsByDiameter.map((row, i) => (
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
                  </tr>
                ))}
                {totalsByDiameter.length === 0 && (
                  <tr>
                    <td className="c" colSpan={1 + SAN_ACCESORIOS.length} style={{ fontSize: 11, color: 'var(--txt3)', padding: '24px 0', textAlign: 'center' }}>
                      No hay accesorios.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
    </div>
  );
}
