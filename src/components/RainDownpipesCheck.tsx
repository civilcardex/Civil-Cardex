import { useMemo } from "react";
import { useRainwater } from "../context/RainwaterContext";
import { useTramos } from "../context/TramosContext";
import { usePlans } from "../context/PlansContext";
import { TRAZOS_PREFIX } from "../constants/storage-keys";
import { loadFromStorage } from "../services/storageService";
import { chequeoBajanteLluvia } from "../utils/calcRainwater";
import { parseDecimalInput } from "../utils/parseDecimal";

const renderStatus = (val: string) => {
  if (val === 'O.K.' || val === 'Ok' || val === 'OK') {
    return (
      <span style={{
        color: 'var(--ok)',
        background: 'rgba(47, 248, 1, 0.08)',
        border: '1px solid rgba(47, 248, 1, 0.15)',
        padding: '1px 5px',
        borderRadius: '3px',
        fontWeight: 600,
        fontSize: '9px',
        fontFamily: 'var(--mono)',
        display: 'inline-block'
      }}>
        {val}
      </span>
    );
  }
  if (val === 'NO CUMPLE' || val === 'No cumple' || val === 'NO') {
    return (
      <span style={{
        color: 'var(--err)',
        background: 'rgba(255, 180, 171, 0.08)',
        border: '1px solid rgba(255, 180, 171, 0.15)',
        padding: '1px 5px',
        borderRadius: '3px',
        fontWeight: 600,
        fontSize: '9px',
        fontFamily: 'var(--mono)',
        display: 'inline-block',
        whiteSpace: 'nowrap'
      }}>
        {val}
      </span>
    );
  }
  return <span style={{ color: 'var(--txt3)' }}>{val}</span>;
};

export default function ChequeoBajantesLluvias() {
  const { bajantesLl, updBajanteLL } = useRainwater();
  const { tramosLl } = useTramos();
  const { plans } = usePlans();

  const drawingBajantes = useMemo(() => {
    return tramosLl.filter((t: any) => t.esBajante);
  }, [tramosLl]);

  const areaDibujoMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const plan of plans || []) {
      if (plan.nivel == null) continue;
      const raw = loadFromStorage(TRAZOS_PREFIX + plan.id, null);
      if (!raw) continue;
      let data = raw as Record<string, any>;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch (_) { continue; } }
      for (const b of (data.bajantes || [])) {
        if (b.net === 'll' && b.area_m2) {
          map[b.code || b.id] = b.area_m2;
          map[b.id] = b.area_m2;
        }
      }
    }
    return map;
  }, [plans]);

  const areaAcumMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const plan of plans || []) {
      if (plan.nivel == null) continue;
      const raw = loadFromStorage(TRAZOS_PREFIX + plan.id, null);
      if (!raw) continue;
      let data = raw as Record<string, any>;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch (_) { continue; } }
      const totalArea = (data.areas || []).reduce((s: number, a: any) => s + (a.areaM2 || 0), 0);
      map[String(plan.nivel)] = totalArea;
    }
    return map;
  }, [plans]);

  const rows = useMemo(() => {
    const manualMap = new Map<string, any>();
    for (const m of bajantesLl) {
      const key = m.bajante || m.id;
      manualMap.set(key, m);
    }

    const usedManual = new Set<string>();
    const out: any[] = [];

    for (const d of drawingBajantes) {
      const code = d.code || d.id;
      const manual = manualMap.get(code) || manualMap.get(d.id);
      if (manual) usedManual.add(manual.bajante || manual.id);
      const areaDib = areaDibujoMap[code] || areaDibujoMap[d.id] || 0;
      const areaParcial = areaDib || d.area_m2 || manual?.areaParcial || 0;
      const areaAcum = areaAcumMap[String(d.piso)] || manual?.areaAcumulada || 0;
      const rVal = d.bajR != null ? (Math.abs(d.bajR - 0.25) < 0.001 ? '1/4' : '7/24') : '7/24';
      out.push({
        key: 'd_' + d.id + '_' + d.piso,
        bajante: code,
        areaParcial,
        areaAcum,
        intensidad: manual?.intensidad ?? 100,
        coeficienteC: 0.0278,
        R: rVal,
        manning: 0.009,
        diamPropuesto: d.diamDisPulg || 0,
      });
    }

    for (const m of bajantesLl) {
      const key = m.bajante || m.id;
      if (usedManual.has(key)) continue;
      const bajDib = drawingBajantes.find((d: any) => d.code === m.bajante || d.id === m.bajante);
      const areaDib = areaDibujoMap[m.bajante] || 0;
      const areaParcial = areaDib || bajDib?.area_m2 || m.areaParcial || 0;
      const areaAcum = areaAcumMap[String(bajDib?.piso)] || m.areaAcumulada || 0;
      out.push({
        key: 'm_' + m.id,
        bajante: m.bajante || m.id,
        areaParcial,
        areaAcum,
        intensidad: m.intensidad ?? 100,
        coeficienteC: 0.0278,
        R: m.R,
        manning: 0.009,
        diamPropuesto: m.diamPropuesto,
      });
    }

    return out;
  }, [drawingBajantes, bajantesLl, areaDibujoMap, areaAcumMap]);

  return (
    <div className="card">
      <div className="card-h">
        <h3 className="card-t"><img src="/iconos_diseno_redes/aguas_lluvias/RALL_Chequeo_bajantes.svg" alt="Chequeo bajantes"  width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}}  loading="lazy" /> Chequeo capacidad bajantes aguas lluvias</h3>
      </div>
      <div className="scroll-top" style={{padding:'16px'}}>
        <div className="scroll-inner" style={{minWidth:'max-content'}}>
        <table className="tbl" style={{fontSize:10, tableLayout:'auto', width:'100%', borderCollapse:'collapse'}}>
          <thead>
            <tr>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'3px 2px'}}>Bajante</th>
              <th scope="col" className="col-h ll" colSpan={2} style={{textAlign:'center',fontSize:9,padding:'3px 2px'}}>Área (m²)</th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'3px 2px'}}>Intensidad (I)<br/><small>mm/hr</small></th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'3px 2px'}}>Coeficiente<br/>Escorrentía</th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'3px 2px'}}>Llenado<br/></th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'3px 2px'}}>Q = C×I×A<br/><small>(LPS)</small></th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'3px 2px'}}>Manning<br/></th>
              <th scope="col" className="col-h ok" colSpan={2} style={{textAlign:'center',fontSize:9,padding:'3px 2px'}}>Diámetro (")</th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'3px 2px'}}>Chequeo<br/>Dcal &lt; Dprop</th>
            </tr>
            <tr>
              <th scope="col" className="col-h ll" style={{fontSize:8,textAlign:'center',padding:'2px 2px'}}>Parcial</th>
              <th scope="col" className="col-h ll" style={{fontSize:8,textAlign:'center',padding:'2px 2px'}}>Acumulada</th>
              <th scope="col" className="col-h ok" style={{fontSize:8,textAlign:'center',padding:'2px 2px'}}>Calculado</th>
              <th scope="col" className="col-h ok" style={{fontSize:8,textAlign:'center',padding:'2px 2px'}}>Propuesto</th>
            </tr>
          </thead>
          <tbody>
{rows.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ padding: "24px 0", textAlign: "center", color: "var(--txt3)", fontSize: 11 }}>
                  No hay bajantes de lluvias definidos. Dibuje bajantes en el plano o agréguelos en el panel de entrada.
                </td>
              </tr>
) : rows.map(row=>{
const { Q, dCalc: diamCalc, chequeo } = chequeoBajanteLluvia({ ...row, coeficienteC: 0.0278, areaAcumulada: row.areaAcum || 0 });
return(
                <tr key={row.key}>
                  <td className="c"><span className="sigla" style={{fontSize:11}}>{row.bajante || '—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{row.areaParcial > 0 ? row.areaParcial.toFixed(2) : '—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{row.areaAcum > 0 ? row.areaAcum.toFixed(2) : '—'}</span></td>
                  <td className="c">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.intensidad ?? 100}
                      key={row.key + '_in'}
                      onChange={() => {}}
                      onBlur={e => {
                        const v = parseDecimalInput(e.target.value) ?? 100;
                        if (v !== null && row.bajante) {
                          updBajanteLL(row.bajante, 'intensidad', v);
                        }
                      }}
                      style={{
                        width: 56,
                        padding: '2px 4px',
                        background: 'var(--bg2)',
                        border: '1px solid var(--line)',
                        borderRadius: 2,
                        color: 'var(--txt)',
                        fontFamily: 'var(--mono)',
                        fontSize: 11,
                        textAlign: 'center',
                      }}
                    />
                  </td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>0.0278</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{row.R||'—'}</span></td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:13}}>{Q>0?Q.toFixed(2):'—'}</td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{row.manning||'—'}</span></td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:600,fontSize:12}}>{diamCalc > 0 ? diamCalc.toFixed(2) : '—'}</td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{row.diamPropuesto ? row.diamPropuesto+'"' : '—'}</span></td>
                  <td className="c" style={{fontSize:11}}>{renderStatus(chequeo)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}