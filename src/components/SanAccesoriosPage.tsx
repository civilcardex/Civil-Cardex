import { useMemo, useState, useEffect } from 'react';
import { SAN_ACCESORIOS } from '../constants';
import { HYDRO_DATA_STORAGE_KEY } from '../constants/storage-keys';
import { loadFromStorage } from '../services/storageService';
import { useTramos } from '../context/TramosContext';

function loadHidro(): Record<string, any> {
  return loadFromStorage(HYDRO_DATA_STORAGE_KEY, {});
}

export default function SanAccesoriosPage() {
  const [tick, setTick] = useState(0);
  const { tramosSan } = useTramos();

  useEffect(() => {
    const handler = () => setTick(t => t + 1);
    // Listen for localStorage changes from other tabs (cross-tab sync)
    window.addEventListener('storage', handler);
    // Fallback polling for same-tab writes (storage event only fires in other tabs)
    const iv = setInterval(handler, 10000);
    return () => { window.removeEventListener('storage', handler); clearInterval(iv); };
  }, []);

  const tramos = useMemo(() => {
    const hidroData = loadHidro();
    const result = [];
    const filtered = tramosSan.filter(t => t.tipo === 'ramal' && !t.esBajante);
    for (const t of filtered) {
      const key = `san_${t.id}_${t.planId}`;
      const srcAcc = hidroData[key]?.accesorios || {};
      const acc: Record<string, number> = {};
      for (const a of SAN_ACCESORIOS) {
        acc[a.id] = srcAcc[a.id] || 0;
      }
      result.push({ id: t.id, piso: t.piso, _nivelLabel: (t as any)._nivelLabel, accesorios: acc });
    }
    return result;
  }, [tick, tramosSan]);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div className="card-h">
        <h3 className="card-t">
          <img src="/iconos_diseno_redes/general/Accesorios.svg" alt="Accesorios"  width={24} height={24} style={{width:24,height:24, verticalAlign: 'middle', marginRight: 4 }}  loading="lazy" />
          Accesorios por ramal
        </h3>
        <span className="card-s">{tramos.length} tramos · Red sanitaria</span>
      </div>
      <div className="scroll-top" style={{ padding: '12px', flex: 1, minHeight: 0 }}>
        <div className="scroll-inner" style={{ minWidth: 'max-content' }}>
          <table className="tbl" style={{ minWidth: 700, fontSize: 13 }}>
            <thead>
              <tr>
                <th scope="col" className="col-h" style={{ minWidth: 64, textAlign: 'center', position: 'sticky', left: 0, zIndex: 2, background: 'var(--bg2)', fontSize: 11, padding: '5px 4px' }}>Tramo</th>
                <th scope="col" className="col-h" style={{ minWidth: 40, textAlign: 'center', position: 'sticky', left: 64, zIndex: 2, background: 'var(--bg2)', fontSize: 10, padding: '5px 4px' }}>Nivel</th>
                {SAN_ACCESORIOS.map(a => (
                  <th scope="col" key={a.id} className="col-h" style={{ minWidth: 56, fontSize: 10, textAlign: 'center', whiteSpace: 'nowrap', padding: '5px 2px' }}>
                    <img src={a.icono} alt={a.nombre}  width={24} height={24} style={{width:24,height:24, objectFit: 'contain', display: 'block', margin: '0 auto 2px' }}  loading="lazy" />
                    <span style={{ fontSize: 9, fontWeight: 500 }}>{a.nombre}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tramos.map((t, i) => (
                <tr key={i}>
                  <td className="c" style={{ fontSize: 13, textAlign: 'center', fontWeight: 600, position: 'sticky', left: 0, background: 'var(--bg2)', zIndex: 1, padding: '4px 4px' }}>{t.id}</td>
                  <td className="c" style={{ fontSize: 11, textAlign: 'center', position: 'sticky', left: 64, background: 'var(--bg2)', zIndex: 1, padding: '4px 4px', color: 'var(--txt2)' }}>{(t as any)._nivelLabel || (t.piso != null ? (t.piso === 99 ? 'C' : t.piso < 0 ? `S${-t.piso}` : `P${t.piso}`) : '')}</td>
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
                  <td className="c" colSpan={2 + SAN_ACCESORIOS.length} style={{ fontSize: 11, color: 'var(--txt3)', padding: '24px 0', textAlign: 'center' }}>
                    No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
