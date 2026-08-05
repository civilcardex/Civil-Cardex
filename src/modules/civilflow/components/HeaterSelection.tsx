import { useState, useMemo } from 'react';
import { useTramos } from '../context/TramosContext';
import { APARATOS_DEF } from '../constants';
import { CAT_APS } from '../constants/engineeringDataFixtures';
import { CAT_GAS } from '../constants/engineeringDataGas';
import { fmt } from '../utils/formatUtils';
import { usePlans } from '../context/PlansContext';
import { writeBajantePropToDrawing } from '../utils/writeDiameterToDrawing';
import { computeHeaterNetworkTotal } from '../utils/waterNetworkRows';
import { TRAZOS_PREFIX } from '../constants/storage-keys';
import { loadFromStorage } from '../services/storageService';
const HeaterSelection_S1: React.CSSProperties = {
  width: '100%',
  minWidth: 150,
  textAlign: 'center',
  background: 'var(--bg2)',
  padding: '6px 10px',
  border: '1px solid var(--bd)',
  borderRadius: 4,
};

export default function HeaterSelection() {
  const { tramosAc } = useTramos();
  const { plans } = usePlans();

  const selectedHeaterTram = useMemo(
    () => tramosAc.find((t) => t.calCapacidad !== undefined),
    [tramosAc],
  );

  // Factor de simultaneidad persistido en el bajante CALENTn (storage + DB) — restaurar cuando
  // el calentador cambia, no arrancar siempre en 50. Ajuste de estado durante el render (patrón
  // documentado de React para sincronizar estado con un prop que cambia) — evita el setState
  // síncrono dentro de un effect.
  const [factorSim, setFactorSim] = useState(50);
  const [factorSimLoadedKey, setFactorSimLoadedKey] = useState<string | null>(null);
  const heaterKey = selectedHeaterTram
    ? `${String(selectedHeaterTram.fin)}-${String(selectedHeaterTram.planId)}`
    : null;
  if (heaterKey && heaterKey !== factorSimLoadedKey) {
    const raw = loadFromStorage<{
      bajantes?: Array<{ id: string; net?: string; factorSim?: number }>;
    } | null>(TRAZOS_PREFIX + selectedHeaterTram!.planId, null);
    const baj = (raw?.bajantes || []).find(
      (b) => b.id === selectedHeaterTram!.fin && b.net === 'ac',
    );
    setFactorSim(baj?.factorSim ?? 50);
    setFactorSimLoadedKey(heaterKey);
  }
  const selectedHeaterId = selectedHeaterTram ? selectedHeaterTram.calCapacidad : '';
  const selectedHeater = useMemo(
    () => CAT_GAS.find((g) => g.id === selectedHeaterId),
    [selectedHeaterId],
  );

  // Agrupar aparatos de TODA la red AC (el calentador alimenta cada ramal aguas abajo, no solo
  // el ramal-stub AC-01-{calId}) y tomar el total UC real del nodo raíz tal como lo calcula la
  // tabla de diseño — antes solo sumaba los aparatos asignados directamente al stub.
  const { summary, totalUC } = useMemo(() => {
    const counts: Record<string, { cant: number; uc: number }> = {};
    for (const t of tramosAc) {
      if (!t.fixtures) continue;
      for (const [k, v] of Object.entries(t.fixtures)) {
        if (v && v > 0) {
          const apCat = CAT_APS.find((a) => a.id === k);
          if (!counts[k]) counts[k] = { cant: 0, uc: apCat ? apCat.ac : 0 };
          counts[k].cant += v;
        }
      }
    }

    const summary = Object.keys(counts)
      .map((k) => {
        const apCat = CAT_APS.find((a) => a.id === k);
        const nombre = apCat
          ? apCat.n
          : (APARATOS_DEF as unknown as Record<string, { nombre?: string }>)[k]?.nombre || k;
        const cant = counts[k].cant;
        const uc = counts[k].uc;
        return { id: k, nombre, cant, uc, total: cant * uc };
      })
      .filter((x) => x.cant > 0);

    const sumRows = summary.reduce((sum, item) => sum + item.total, 0);
    const { udTotal } = computeHeaterNetworkTotal(tramosAc, plans);
    const totalUC = udTotal > 0 ? udTotal : sumRows;

    return { summary, totalUC };
  }, [tramosAc, plans]);

  // Caudal probable por Hunter
  const caudalProbableLps = totalUC > 0 ? 0.1163 * Math.pow(totalUC, 0.6875) : 0;
  const caudalProbableGpm = caudalProbableLps * 15.8503;
  const caudalProbableLpm = caudalProbableLps * 60.0;

  const caudalAjustado = caudalProbableLpm * (factorSim / 100);

  const heaterRecommendation = useMemo(() => {
    const heaters = CAT_GAS.filter((g) => g.id.startsWith('cal')); // cal6, cal11, cal21
    const parsedHeaters = heaters
      .map((h) => {
        const match = h.id.match(/\d+/);
        const cap = match ? parseInt(match[0]) : 0;
        return { ...h, cap };
      })
      .sort((a, b) => a.cap - b.cap);

    const selectedHeaterTram = tramosAc.find((t) => t.calCapacidad);
    const selectedHeaterId = selectedHeaterTram ? selectedHeaterTram.calCapacidad : '';
    const selectedHeater = CAT_GAS.find((g) => g.id === selectedHeaterId);

    let recText = '';
    const suitable = parsedHeaters.find((h) => h.cap >= caudalAjustado);
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
            El equipo seleccionado ({selectedHeater.n}){' '}
            <span style={{ color: 'var(--ok)', fontWeight: 'bold' }}>CUMPLE</span> con el caudal
            ajustado.
          </span>
        );
      } else {
        return (
          <span style={{ color: '#fff', fontWeight: 'normal' }}>
            El equipo seleccionado ({selectedHeater.n}){' '}
            <span style={{ color: 'var(--err)', fontWeight: 'bold' }}>NO CUMPLE</span>. {recText}
          </span>
        );
      }
    }

    return <span style={{ color: '#fff', fontWeight: 'normal' }}>{recText}</span>;
  }, [caudalAjustado, tramosAc]);

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
            {summary.map((item) => (
              <tr key={item.id}>
                <td>{item.nombre}</td>
                <td className="c">{item.cant}</td>
                <td className="c">{fmt(item.uc, 2)}</td>
                <td className="c">{fmt(item.total, 2)}</td>
              </tr>
            ))}
            {summary.length === 0 && (
              <tr>
                <td colSpan={4} className="c" style={{ color: 'var(--txt2)', padding: 10 }}>
                  No hay aparatos en la red de agua caliente
                </td>
              </tr>
            )}
            {summary.length > 0 && (
              <tr style={{ background: 'var(--bg3)', fontWeight: 'bold' }}>
                <td colSpan={3} style={{ textAlign: 'right', paddingRight: 10 }}>
                  Total UC
                </td>
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
              <td className="c" style={{ width: '50%' }}>
                Caudal probable
              </td>
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
                  aria-label="Factor de simultaneidad (%)"
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setFactorSim(val);
                    if (selectedHeaterTram) {
                      const calId = selectedHeaterTram.fin;
                      const planId = selectedHeaterTram.planId;
                      const bajanteKey = `${calId}-${planId}`;
                      writeBajantePropToDrawing(bajanteKey, 'ac', 'factorSim', val, plans);
                    }
                  }}
                  min="0"
                  max="100"
                />
              </td>
            </tr>
            <tr>
              <td className="c">Caudal ajustado</td>
              <td className="c" style={{ fontWeight: 'bold' }}>
                {fmt(caudalAjustado, 2)} LPM
              </td>
            </tr>
            <tr>
              <td className="c">Calentador seleccionado</td>
              <td className="c" style={{ fontWeight: 'bold' }}>
                <select
                  className="ni"
                  style={{
                    ...HeaterSelection_S1,
                    color: selectedHeater ? 'var(--fg1)' : 'var(--txt2)',
                    cursor: selectedHeaterTram ? 'pointer' : 'not-allowed',
                  }}
                  aria-label="Calentador seleccionado"
                  value={selectedHeaterId || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (selectedHeaterTram) {
                      const calId = selectedHeaterTram.fin;
                      const planId = selectedHeaterTram.planId;
                      const bajanteKey = `${calId}-${planId}`;
                      writeBajantePropToDrawing(bajanteKey, 'ac', 'capacidad', val, plans);
                    }
                  }}
                  disabled={!selectedHeaterTram}
                >
                  <option value="">Ninguno</option>
                  {CAT_GAS.filter((g) => g.id.startsWith('cal')).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.n}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
            <tr style={{ background: 'var(--bg3)' }}>
              <td
                colSpan={2}
                className="c"
                style={{ fontStyle: 'italic', fontWeight: 'bold', color: 'var(--acc)' }}
              >
                {heaterRecommendation}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
