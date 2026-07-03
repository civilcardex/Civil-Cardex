import { useState, useMemo } from 'react';
import { useTramos } from '../context/TramosContext';
import { APARATOS_DEF } from '../constants';
import { CAT_APS } from '../constants/engineeringDataFixtures';
import { CAT_GAS } from '../constants/engineeringDataGas';
import { fmt } from '../utils/formatUtils';
import { usePlans } from '../context/PlansContext';
import { writeBajantePropToDrawing } from '../utils/writeDiameterToDrawing';

export default function HeaterSelection() {
  const { tramosAc } = useTramos();
  const { plans } = usePlans();
  const [factorSim, setFactorSim] = useState(50); // 50%

  const selectedHeaterTram = useMemo(() => tramosAc.find(t => (t as any).calCapacidad !== undefined), [tramosAc]);
  const selectedHeaterId = selectedHeaterTram ? (selectedHeaterTram as any).calCapacidad : '';
  const selectedHeater = useMemo(() => CAT_GAS.find(g => g.id === selectedHeaterId), [selectedHeaterId]);

  // Agrupar aparatos y calcular UC totales
  const { summary, totalUC } = useMemo(() => {
    const counts: Record<string, { cant: number; uc: number }> = {};
    if (selectedHeaterTram && selectedHeaterTram.fixtures) {
      for (const [k, v] of Object.entries(selectedHeaterTram.fixtures)) {
        if (v && v > 0) {
          const apCat = CAT_APS.find(a => a.id === k);
          if (!counts[k]) counts[k] = { cant: 0, uc: apCat ? apCat.ac : 0 };
          counts[k].cant += v;
        }
      }
    }

    const summary = Object.keys(counts).map(k => {
      const apCat = CAT_APS.find(a => a.id === k);
      const nombre = apCat ? apCat.n : ((APARATOS_DEF as any)[k]?.nombre || k);
      const cant = counts[k].cant;
      const uc = counts[k].uc;
      return { id: k, nombre, cant, uc, total: cant * uc };
    }).filter(x => x.cant > 0);

    const totalUC = summary.reduce((sum, item) => sum + item.total, 0);

    return { summary, totalUC };
  }, [selectedHeaterTram]);

  // Caudal probable por Hunter
  const caudalProbableLps = totalUC > 0 ? 0.1163 * Math.pow(totalUC, 0.6875) : 0;
  const caudalProbableGpm = caudalProbableLps * 15.8503;
  const caudalProbableLpm = caudalProbableLps * 60.0;

  const caudalAjustado = caudalProbableLpm * (factorSim / 100);

  // Seleccionar equipo del catálogo
  // Filter CAT_GAS for heaters (Calentador P.D.) which are cal6, cal11, cal21
  const heaterRecommendation = useMemo(() => {
    const heaters = CAT_GAS.filter(g => g.id.startsWith('cal')); // cal6, cal11, cal21
    // Parse LPM from name or ID
    const parsedHeaters = heaters.map(h => {
      const match = h.id.match(/\d+/);
      const cap = match ? parseInt(match[0]) : 0;
      return { ...h, cap };
    }).sort((a, b) => a.cap - b.cap);
    
    const selectedHeaterTram = tramosAc.find(t => (t as any).calCapacidad);
    const selectedHeaterId = selectedHeaterTram ? (selectedHeaterTram as any).calCapacidad : '';
    const selectedHeater = CAT_GAS.find(g => g.id === selectedHeaterId);

    let recText = '';
    const suitable = parsedHeaters.find(h => h.cap >= caudalAjustado);
    if (suitable) {
      recText = `Recomendado: Usar ${suitable.n}`;
    } else if (caudalAjustado > 0) {
      const max = parsedHeaters[parsedHeaters.length - 1];
      recText = `Recomendado: Usar equipo mayor a ${max?.cap || 21} LPM o múltiples unidades`;
    } else {
      recText = 'No requiere calentador';
    }

    if (selectedHeaterId && selectedHeater) {
      const match = selectedHeater.id.match(/\d+/);
      const cap = match ? parseInt(match[0]) : 0;
      if (cap >= caudalAjustado) {
        return (
          <span style={{ color: '#fff', fontWeight: 'normal' }}>
            El equipo seleccionado ({selectedHeater.n}) <span style={{ color: 'var(--ok)', fontWeight: 'bold' }}>CUMPLE</span> con el caudal ajustado.
          </span>
        );
      } else {
        return (
          <span style={{ color: '#fff', fontWeight: 'normal' }}>
            El equipo seleccionado ({selectedHeater.n}) <span style={{ color: 'var(--err)', fontWeight: 'bold' }}>NO CUMPLE</span>. {recText}
          </span>
        );
      }
    }

    return <span style={{ color: '#fff', fontWeight: 'normal' }}>{recText}</span>;
  }, [caudalAjustado, selectedHeaterId, selectedHeater, tramosAc]);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      <section className="card" style={{ width: '100%', maxWidth: 600, marginBottom: 20 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Aparato</th>
              <th className="c">Cantidad</th>
              <th className="c">UC</th>
              <th className="c">Total UC</th>
            </tr>
          </thead>
          <tbody>
            {summary.map(item => (
              <tr key={item.id}>
                <td>{item.nombre}</td>
                <td className="c">{item.cant}</td>
                <td className="c">{fmt(item.uc, 2)}</td>
                <td className="c">{fmt(item.total, 2)}</td>
              </tr>
            ))}
            {summary.length === 0 && (
              <tr>
                <td colSpan={4} className="c" style={{ color: 'var(--txt2)', padding: 10 }}>No hay aparatos en la red de agua caliente</td>
              </tr>
            )}
            {summary.length > 0 && (
              <tr style={{ background: 'var(--bg3)', fontWeight: 'bold' }}>
                <td colSpan={3} style={{ textAlign: 'right', paddingRight: 10 }}>Total UC</td>
                <td className="c">{fmt(totalUC, 2)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ maxWidth: 600 }}>
        <table className="tbl">
          <tbody>
            <tr>
              <td className="c" style={{ width: '50%' }}>Caudal probable</td>
              <td className="c">{fmt(caudalProbableLps, 3)} Lps</td>
            </tr>
            <tr>
              <td className="c"></td>
              <td className="c">{fmt(caudalProbableGpm, 2)} GPM</td>
            </tr>
            <tr>
              <td className="c"></td>
              <td className="c">{fmt(caudalProbableLpm, 2)} LPM</td>
            </tr>
            <tr>
              <td className="c">Factor de simultaneidad (%)</td>
              <td className="c">
                <input 
                  type="number" 
                  className="ni" 
                  style={{ width: 60, textAlign: 'center' }} 
                  value={factorSim}
                  onChange={e => setFactorSim(parseFloat(e.target.value) || 0)}
                  min="0" max="100"
                />
              </td>
            </tr>
            <tr>
              <td className="c">Caudal ajustado</td>
              <td className="c" style={{ fontWeight: 'bold' }}>{fmt(caudalAjustado, 2)} LPM</td>
            </tr>
            <tr>
              <td className="c">Calentador seleccionado</td>
              <td className="c" style={{ fontWeight: 'bold' }}>
                <select
                  className="ni"
                  style={{ 
                    width: '100%', 
                    minWidth: 150, 
                    textAlign: 'center', 
                    background: 'var(--bg2)', 
                    color: selectedHeater ? 'var(--fg1)' : 'var(--txt2)',
                    padding: '6px 10px',
                    border: '1px solid var(--bd)',
                    borderRadius: 4,
                    cursor: selectedHeaterTram ? 'pointer' : 'not-allowed',
                    outline: 'none',
                  }}
                  value={selectedHeaterId || ''}
                  onChange={e => {
                    const val = e.target.value;
                    if (selectedHeaterTram) {
                      const calId = selectedHeaterTram.fin;
                      const planId = (selectedHeaterTram as any).planId;
                      const bajanteKey = `${calId}-${planId}`;
                      writeBajantePropToDrawing(bajanteKey, 'ac', 'capacidad', val, plans);
                    }
                  }}
                  disabled={!selectedHeaterTram}
                >
                  <option value="">Ninguno</option>
                  {CAT_GAS.filter(g => g.id.startsWith('cal')).map(g => (
                    <option key={g.id} value={g.id}>
                      {g.n}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
            <tr style={{ background: 'var(--bg3)' }}>
              <td colSpan={2} className="c" style={{ fontStyle: 'italic', fontWeight: 'bold', color: 'var(--acc)' }}>
                {heaterRecommendation}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
