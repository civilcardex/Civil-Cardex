import { useMemo } from "react";
import { useRainwater } from "../context/RainwaterContext";
import { useTramos } from "../context/TramosContext";
import { usePlans } from "../context/PlansContext";
import { TRAZOS_PREFIX } from "../constants/storage-keys";
import { loadFromStorage } from "../services/storageService";
import { chequeoBajanteLluvia } from "../utils/calcSanitary";

export default function ChequeoBajantesLluvias() {
  const { bajantesLl } = useRainwater();
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
      out.push({
        key: 'd_' + d.id + '_' + d.piso,
        bajante: code,
        areaParcial,
        areaAcum,
        intensidad: manual?.intensidad,
        coeficienteC: manual?.coeficienteC,
        R: manual?.R,
        manning: manual?.manning,
        diamPropuesto: manual?.diamPropuesto,
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
        intensidad: m.intensidad,
        coeficienteC: m.coeficienteC,
        R: m.R,
        manning: m.manning,
        diamPropuesto: m.diamPropuesto,
      });
    }

    return out;
  }, [drawingBajantes, bajantesLl, areaDibujoMap, areaAcumMap]);

  return (
    <div className="card">
      <div className="card-h">
        <span className="card-t"><img src="/iconos_diseno_redes/aguas_lluvias/RALL_Chequeo_bajantes.webp" alt=""  width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}}  loading="lazy" /> Chequeo capacidad bajantes aguas lluvias</span>
      </div>
      <div className="scroll-top" style={{padding:'16px'}}>
        <div className="scroll-inner" style={{minWidth:'max-content'}}>
        <table className="tbl" style={{fontSize:13}}>
          <thead>
            <tr>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Bajante #</th>
              <th className="col-h ll" colSpan={2} style={{textAlign:'center',fontSize:11}}>Área</th>
<th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Intensidad promedio<br/>mm/hr/m²</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Coeficiente de<br/>Escorrentía C</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>R</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Q = C×I×A<br/>LPS</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Manning</th>
              <th className="col-h ok" colSpan={2} style={{textAlign:'center',fontSize:11}}>Diámetro</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Chequeo<br/>Dcal&lt;Dprop</th>
            </tr>
            <tr>
              <th className="col-h ll" style={{fontSize:10,textAlign:'center'}}>Parcial<br/>m²</th>
              <th className="col-h ll" style={{fontSize:10,textAlign:'center'}}>Acumulada<br/>m²</th>
              <th className="col-h ok" style={{fontSize:10,textAlign:'center'}}>Calculado<br/>(")</th>
              <th className="col-h ok" style={{fontSize:10,textAlign:'center'}}>Propuesto<br/>(")</th>
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
const { Q, dCalc: diamCalc, chequeo } = chequeoBajanteLluvia({ ...row, areaAcumulada: row.areaAcum || 0 });
return(
                <tr key={row.key}>
                  <td className="c"><span className="sigla" style={{fontSize:11}}>{row.bajante || '—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{row.areaParcial > 0 ? row.areaParcial.toFixed(2) : '—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{row.areaAcum > 0 ? row.areaAcum.toFixed(2) : '—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{row.intensidad||'—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{row.coeficienteC||'—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{row.R||'—'}</span></td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:13}}>{Q>0?Q.toFixed(2):'—'}</td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{row.manning||'—'}</span></td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:600,fontSize:12}}>{diamCalc > 0 ? diamCalc.toFixed(2) : '—'}</td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{row.diamPropuesto ? row.diamPropuesto+'"' : '—'}</span></td>
                  <td className="c" style={{fontWeight:700}}>{chequeo}</td>
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