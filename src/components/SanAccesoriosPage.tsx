import { useMemo, useState, useEffect } from 'react';
import { SAN_ACCESORIOS } from '../constants';
import { HYDRO_DATA_STORAGE_KEY } from '../constants/storage-keys';
import { loadFromStorage } from '../services/storageService';

function loadHidro(): Record<string, any> {
  return loadFromStorage(HYDRO_DATA_STORAGE_KEY, {});
}

export default function SanAccesoriosPage() {
  const [tick, setTick] = useState(0);

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
    for (const [key, entry] of Object.entries(hidroData) as [string, Record<string, any>][]) {
      if (!key.startsWith('san_')) continue;
      const tramoId = key.slice(4);
      if (!tramoId) continue;
      const srcAcc = entry?.accesorios || {};
      const acc: Record<string, number> = {};
      for (const a of SAN_ACCESORIOS) {
        acc[a.id] = srcAcc[a.id] || 0;
      }
      result.push({ id: tramoId, accesorios: acc });
    }
    return result;
  }, [tick]);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div className="card-h">
        <span className="card-t">
          <img src="/iconos_diseno_redes/Accesorios.webp" alt="" style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }} />
          Accesorios por ramal
        </span>
        <span className="card-s">{tramos.length} tramos · Red sanitaria</span>
      </div>
      <div className="scroll-top" style={{ padding: '12px', flex: 1, minHeight: 0 }}>
        <div className="scroll-inner" style={{ minWidth: 'max-content' }}>
          <table className="tbl" style={{ minWidth: 700, fontSize: 13 }}>
            <thead>
              <tr>
                <th className="col-h" style={{ minWidth: 64, textAlign: 'center', position: 'sticky', left: 0, zIndex: 2, background: 'var(--bg2)', fontSize: 11, padding: '5px 4px' }}>Tramo</th>
                {SAN_ACCESORIOS.map(a => (
                  <th key={a.id} className="col-h" style={{ minWidth: 56, fontSize: 10, textAlign: 'center', whiteSpace: 'nowrap', padding: '5px 2px' }}>
                    <img src={a.icono} alt={a.nombre} style={{ width: 24, height: 24, objectFit: 'contain', display: 'block', margin: '0 auto 2px' }} />
                    <span style={{ fontSize: 9, fontWeight: 500 }}>{a.nombre}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tramos.map((t, i) => (
                <tr key={i}>
                  <td className="c" style={{ fontSize: 13, textAlign: 'center', fontWeight: 600, position: 'sticky', left: 0, background: 'var(--bg2)', zIndex: 1, padding: '4px 4px' }}>{t.id}</td>
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
                  <td className="c" colSpan={1 + SAN_ACCESORIOS.length} style={{ fontSize: 11, color: 'var(--txt3)', padding: '24px 0', textAlign: 'center' }}>
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
