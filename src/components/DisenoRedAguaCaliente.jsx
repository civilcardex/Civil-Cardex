import { useState, useMemo, useCallback } from "react";
import { useSanitario } from "../context/SanitarioContext";
import { usePlanos } from "../context/PlanosContext";
import { AC_UC_IDS, APARATOS_DEF, pisoCorto } from "./constants";
import { calcUCparcial } from "./utils";
import { DIAMETROS_AF, COEF_HAZEN_PVC } from "../utils/calcHidraulica";
import { writeDiametroToDrawing, deleteRamalFromDrawing } from "../utils/writeDiametroToDrawing";

const C = COEF_HAZEN_PVC;

const LE_ACC_DEF = [
  { id: "codo90rc", n: "Codo radio corto 90", a: 0.76, b: 0.17 },
  { id: "codo45rc", n: "Codo radio corto 45", a: 0.38, b: 0.02 },
  { id: "codo90rm", n: "Codo radio medio 90", a: 0.67, b: 0.09 },
  { id: "codo90rl", n: "Codo radio largo 90", a: 0.52, b: 0.04 },
  { id: "teeDirecto", n: "Tee paso Directo normal", a: 0.53, b: 0.04 },
  { id: "teeReduccion", n: "Tee paso directo con red.", a: 0.56, b: 0.33 },
  { id: "teeLado", n: "Tee paso Lado", a: 1.56, b: 0.37 },
  { id: "teeBilateral", n: "Tee salida bilateral", a: 1.56, b: 0.37 },
  { id: "valvGlobo", n: "Válvula de globo abierta", a: 8.44, b: 0.50 },
  { id: "valvCompuerta", n: "Válvula de compuerta abierta", a: 0.17, b: 0.03 },
  { id: "valvCheque", n: "Válvula cheque", a: 3.20, b: 0.03 },
  { id: "valvPie", n: "Válvula de pie con coladera", a: 6.38, b: 0.40 },
  { id: "valvAngulo", n: "Válvula de ángulo abierta", a: 4.27, b: 0.25 },
  { id: "reduccion", n: "Reducción", a: 0.15, b: 0.01 },
  { id: "ampliacion", n: "Ampliación", a: 0.31, b: 0.01 },
  { id: "otros", n: "Otros (definir la Le)", a: 0, b: 0 },
];

function lookupInterno(pulg) {
  if (!pulg || pulg <= 0) return null;
  const matches = DIAMETROS_AF.filter((d) => Math.abs(d.pulg - pulg) < 0.01);
  if (matches.length === 0) return null;
  return matches[matches.length - 1].dInt;
}

function calcLeAcces(accesorios, diamPulg, c) {
  if (!accesorios || !diamPulg || diamPulg <= 0) return 0;
  const D = diamPulg;
  const k = Math.pow(120 / c, 1.85);
  let sum = 0;
  let otrosCount = 0;
  for (const def of LE_ACC_DEF) {
    const cnt = accesorios[def.id] || 0;
    if (def.id === "otros") {
      otrosCount = cnt;
      continue;
    }
    if (cnt > 0) sum += cnt * (def.a * D + def.b);
  }
  return k * sum + otrosCount;
}

const fmt = (v, d = 2) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : Number(v).toFixed(d);

const FRAC = { 0.5: '½', 0.75: '¾', 0.25: '¼', 0.125: '⅛', 0.375: '⅜', 0.625: '⅝', 0.875: '⅞' };
function fmtPulg(v) {
  if (!v || v <= 0) return "—";
  const ent = Math.floor(v);
  const dec = Math.round((v - ent) * 100) / 100;
  const frac = FRAC[dec];
  if (frac) return ent > 0 ? `${ent}${frac}"` : `${frac}"`;
  if (dec === 0) return `${ent}"`;
  return `${v.toFixed(2)}"`;
}

export default function DisenoRedAguaCaliente() {
  const { tramosAc, proy, updTramoAc, delTramoAc } = useSanitario();
  const { planos } = usePlanos();

  const AC_DIAM_OPTS = useMemo(() => {
    const seen = new Set();
    return DIAMETROS_AF.filter(d => {
      const k = d.pulg;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).map(d => ({ pulg: d.pulg, label: fmtPulg(d.pulg), dInt: d.dInt }));
  }, []);

  const handleDiamChange = useCallback((tramoId, newPulg) => {
    updTramoAc(tramoId, 'diamDisPulg', newPulg);
    const opt = AC_DIAM_OPTS.find(o => o.pulg === newPulg);
    if (opt) {
      writeDiametroToDrawing(tramoId, 'ac', opt.label, planos);
    }
  }, [updTramoAc, AC_DIAM_OPTS, planos]);

  const handleDelete = useCallback((tramoId) => {
    delTramoAc(tramoId);
    deleteRamalFromDrawing(tramoId, 'ac', planos);
  }, [delTramoAc, planos]);

  const AP = useMemo(
    () =>
      AC_UC_IDS.map((id) => {
        const a = APARATOS_DEF.find((x) => x.id === id);
        return a ? { id: a.id, uc: a.uc_ac } : null;
      }).filter(Boolean),
    []
  );

  const [otrosSel, setOtrosSel] = useState(() => new Map());
  const [presIniEdit, setPresIniEdit] = useState(() => new Map());
  const [presFinEdit, setPresFinEdit] = useState(() => new Map());

  const toggleOtro = useCallback((tramoId, otroId) => {
    setOtrosSel((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(tramoId) || []);
      if (set.has(otroId)) set.delete(otroId);
      else set.add(otroId);
      next.set(tramoId, set);
      return next;
    });
  }, []);

  const setPresIni = useCallback((tramoId, v) => {
    setPresIniEdit((prev) => {
      const next = new Map(prev);
      next.set(tramoId, v);
      return next;
    });
  }, []);

  const setPresFin = useCallback((tramoId, v) => {
    setPresFinEdit((prev) => {
      const next = new Map(prev);
      next.set(tramoId, v);
      return next;
    });
  }, []);

  const propiaMap = useMemo(() => {
    const m = {};
    for (const t of tramosAc) m[t.id] = calcUCparcial(t, AP, "uc");
    return m;
  }, [tramosAc, AP]);

  const pRed = parseFloat(proy.p_red) || 20;

  const tramosOrden = useMemo(
    () => [...tramosAc].sort((a, b) => (b.piso || 0) - (a.piso || 0)),
    [tramosAc]
  );

  const leData = useMemo(() => {
    return tramosOrden.map(t => {
      const disPulg = t.diamDisPulg || 0;
      const Le = calcLeAcces(t.accesorios, disPulg, C);
      return { id: t.id, disPulg, Le, accesorios: t.accesorios || {} };
    });
  }, [tramosOrden]);

  return (
    <>
      <div className="card">
        <div className="card-h">
          <span className="card-t"><img src="/iconos_diseno_redes/RAC_Diseno.webp" alt="" style={{width:20,height:20,verticalAlign:'middle',marginRight:4}} /> Diseño de red agua caliente</span>
          <span className="card-s">{tramosAc.length} tramos</span>
        </div>
        <div className="scroll-top" style={{ padding: "6px" }}>
          <div className="scroll-inner" style={{ minWidth: "max-content" }}>
            <table className="tbl" style={{ fontSize: 11, tableLayout: "auto", width: "100%" }}>
              <colgroup>
                <col style={{width:"7%"}}/>
                <col style={{width:"3.5%"}}/>
                <col style={{width:"4%"}}/>
                <col style={{width:"8%"}}/>
                <col style={{width:"4%"}}/>
                <col style={{width:"3.5%"}}/>
                <col style={{width:"3.5%"}}/>
                <col style={{width:"4%"}}/>
                <col style={{width:"3.5%"}}/>
                <col style={{width:"7%"}}/>
                <col style={{width:"4%"}}/>
                <col style={{width:"2.5%"}}/>
                <col style={{width:"4.5%"}}/>
                <col style={{width:"4.5%"}}/>
                <col style={{width:"4.5%"}}/>
                <col style={{width:"4.5%"}}/>
                <col style={{width:"4.5%"}}/>
                <col style={{width:"3.5%"}}/>
                <col style={{width:"3.5%"}}/>
                <col style={{width:"3.5%"}}/>
                <col style={{width:"6%"}}/>
                <col style={{width:"6%"}}/>
                <col style={{width:"2%"}}/>
              </colgroup>
              <thead>
                <tr>
                  <th className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>Tramo</th>
                  <th className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>PISO</th>
                  <th className="col-h ac" colSpan={3} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>UND consumo</th>
                  <th className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>#Desc</th>
                  <th className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>K</th>
                  <th className="col-h ac" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>Q (l/s)</th>
                  <th className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>√Q</th>
                  <th className="col-h ok" colSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>DIAMETRO</th>
                  <th className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>C</th>
                  <th className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>V mm/s</th>
                  <th className="col-h" colSpan={4} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>LONG (m)</th>
                  <th className="col-h" colSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>Hf</th>
                  <th className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>ΔZ (m)</th>
                  <th className="col-h ac" colSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>P final (mca)</th>
                  <th className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9, width:14 }}></th>
                </tr>
                <tr>
                  <th className="col-h ac" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Prop</th>
                  <th className="col-h ac" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Otr</th>
                  <th className="col-h ac" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Tot</th>
                  <th className="col-h ok" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Diseño</th>
                  <th className="col-h ok" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Int mm</th>
                  <th className="col-h" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>H</th>
                  <th className="col-h" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>V</th>
                  <th className="col-h" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Le</th>
                  <th className="col-h" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Tot</th>
                  <th className="col-h" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>%</th>
                  <th className="col-h" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>m</th>
                  <th className="col-h ac" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>INI</th>
                  <th className="col-h ac" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>FIN</th>
                </tr>
              </thead>
              <tbody>
                {tramosOrden.length === 0 && (
                  <tr>
                    <td colSpan={23} style={{ padding: "8px 8px", textAlign: "center", color: "var(--txt3)", fontSize: 9 }}>
                      No hay tramos. Dibuja ramales en el visor para que aparezcan aqui.
                    </td>
                  </tr>
                )}
                {tramosOrden.map((t, idx) => {
                  const propia = propiaMap[t.id] || 0;
                  const selected = otrosSel.get(t.id) || new Set();
                  let totalExtra = 0;
                  for (const oId of selected) totalExtra += propiaMap[oId] || 0;
                  const total = propia + totalExtra;
                  const nDesc = t.nSalidas || 0;
                  const K = nDesc > 0 ? Math.round((nDesc === 1 ? 1 : 1 / Math.sqrt(nDesc - 1)) * 100) / 100 : 0;
                  const Qprob = total > 0 && K > 0 ? Math.round(K * (total < 240 ? 0.1163 * Math.pow(total, 0.6875) : 0.074 * Math.pow(total, 0.7504)) * 1000) / 1000 : 0;
                  const raizQ = Qprob > 0 ? Math.round(Math.sqrt(Qprob) * 100) / 100 : 0;
                  const disPulg = t.diamDisPulg || 0;
                  const internoMm = lookupInterno(disPulg) || 0;
                  const Vmms = Qprob > 0 && internoMm > 0 ? Math.round((1000000 * Qprob) / ((Math.PI / 4) * internoMm * internoMm) * 10) / 10 : 0;
                  const H = t.Lh || 0;
                  const Vvert = t.Lv || t.deltaZ || 0;
                  const leInfo = leData[idx] || {};
                  const Le = leInfo.Le || 0;
                  const Lt = H + Vvert + Le;
                  const hfPct = Vmms > 0 && C > 0 && internoMm > 0 ? Math.round(((60.1 * Math.pow(Vmms, 1.852)) / (Math.pow(C, 1.852) * Math.pow(internoMm, 1.167))) / 100 * 10000) / 10000 : 0;
                  const hfM = Lt > 0 && hfPct > 0 ? Math.round((Lt * hfPct) / 10 * 100) / 100 : 0;
                  const dZ = Vvert;
                  const PinCalc = pRed;
                  const PfinCalc = PinCalc + dZ - hfM;
                  const Pin = presIniEdit.has(t.id) ? presIniEdit.get(t.id) : PinCalc;
                  const Pfin = presFinEdit.has(t.id) ? presFinEdit.get(t.id) : PfinCalc;
                  const vCumple = Vmms >= 500 && Vmms <= 2500;
                  const otherTramos = tramosAc.filter((o) => o.id !== t.id);
                  return (
                    <tr key={t.id}>
                      <td className="c" style={{ padding: "0 1px"}}><span className="sigla" style={{fontSize:11, padding:"1px 4px"}}>{t.id}</span></td>
                      <td className="c" style={{fontFamily:"var(--mono)",padding:"0 1px",color:"var(--txt2)",fontSize:11}}>{pisoCorto(t.piso)}</td>
                      <td className="c" style={{fontFamily:"var(--mono)",padding:"0 1px",fontSize:11}}>{fmt(propia,2)}</td>
                      <td className="c" style={{padding:"0 1px",minWidth:40}}>
                        <div style={{display:"flex",flexWrap:"nowrap",gap:0,justifyContent:"center",alignItems:"center"}}>
                          {otherTramos.length===0?<span style={{fontSize:9,color:"var(--txt3)"}}>—</span>:otherTramos.map(o=>
                            <button key={o.id} onClick={()=>toggleOtro(t.id,o.id)}
                              style={{fontSize:8,padding:"0 1px",border:"1px solid",borderRadius:1,cursor:"pointer",background:selected.has(o.id)?"var(--ac)":"transparent",color:selected.has(o.id)?"#fff":"var(--txt3)",borderColor:selected.has(o.id)?"var(--ac)":"var(--line)",fontFamily:"var(--mono)",lineHeight:1.5}}>{o.id}</button>
                          )}
                        </div>
                      </td>
                      <td className="c" style={{fontFamily:"var(--mono)",fontWeight:700,padding:"0 1px",fontSize:11}}>{fmt(total,2)}</td>
                      <td className="c" style={{fontFamily:"var(--mono)",padding:"0 1px",fontSize:11}}>{nDesc>0?nDesc:"—"}</td>
                      <td className="c" style={{fontFamily:"var(--mono)",fontWeight:600,padding:"0 1px",fontSize:11}}>{K>0?fmt(K,2):"—"}</td>
                      <td className="c" style={{fontFamily:"var(--mono)",fontWeight:600,padding:"0 1px",fontSize:11}}>{Qprob>0?fmt(Qprob,2):"—"}</td>
                      <td className="c" style={{fontFamily:"var(--mono)",padding:"0 1px",fontSize:11}}>{raizQ>0?fmt(raizQ,2):"—"}</td>
                      <td className="c" style={{padding:"0 1px"}}>
                        <select value={disPulg||''} onChange={e=>handleDiamChange(t.id,parseFloat(e.target.value)||0)}
                          style={{fontFamily:"var(--mono)",fontSize:11,padding:"0 1px",border:"1px solid var(--line)",borderRadius:1,background:"var(--bg2)",color:"var(--txt)",cursor:"pointer",maxWidth:54}}>
                          <option value="">—</option>
                          {AC_DIAM_OPTS.map(o=><option key={o.pulg} value={o.pulg}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="c" style={{fontFamily:"var(--mono)",padding:"0 1px",fontSize:11}}>{internoMm>0?fmt(internoMm,2):"—"}</td>
                      <td className="c" style={{fontFamily:"var(--mono)",padding:"0 1px",fontSize:11}}>{C}</td>
                      <td className="c" style={{fontFamily:"var(--mono)",fontWeight:600,padding:"0 1px",fontSize:11,background:Vmms>0&&vCumple?"rgba(34,197,94,.25)":Vmms>0?"rgba(239,68,68,.25)":"transparent"}}>{Vmms>0?fmt(Vmms,2):"—"}</td>
                      <td className="c" style={{fontFamily:"var(--mono)",padding:"0 1px",fontSize:11}}>{H>0?fmt(H,2):"—"}</td>
                      <td className="c" style={{fontFamily:"var(--mono)",padding:"0 1px",fontSize:11}}>{Vvert>0?fmt(Vvert,2):"—"}</td>
                      <td className="c" style={{fontFamily:"var(--mono)",padding:"0 1px",fontSize:11}}>{Le>0?fmt(Le,2):"—"}</td>
                      <td className="c" style={{fontFamily:"var(--mono)",fontWeight:600,padding:"0 1px",fontSize:11}}>{Lt>0?fmt(Lt,2):"—"}</td>
                      <td className="c" style={{fontFamily:"var(--mono)",padding:"0 1px",fontSize:11}}>{hfPct>0?fmt(hfPct,2):"—"}</td>
                      <td className="c" style={{fontFamily:"var(--mono)",fontWeight:600,padding:"0 1px",fontSize:11}}>{hfM>0?fmt(hfM,2):"—"}</td>
                      <td className="c" style={{fontFamily:"var(--mono)",padding:"0 1px",fontSize:11}}>{dZ>0?fmt(dZ,2):"—"}</td>
                      <td className="c" style={{padding:"0 1px"}}><input type="number" className="ni" style={{width:44,textAlign:"center",padding:0,fontSize:11,fontFamily:"var(--mono)"}} value={Pin} step={0.1} onChange={e=>setPresIni(t.id,parseFloat(e.target.value)||0)}/></td>
                      <td className="c" style={{padding:"0 1px"}}><input type="number" className="ni" style={{width:44,textAlign:"center",padding:0,fontSize:11,fontFamily:"var(--mono)"}} value={Pfin} step={0.1} onChange={e=>setPresFin(t.id,parseFloat(e.target.value)||0)}/></td>
                      <td className="c" style={{padding:"0 1px"}}><button onClick={()=>handleDelete(t.id)} title="Eliminar" style={{border:"none",background:"transparent",color:"var(--txt3)",cursor:"pointer",fontSize:11,padding:"2px 6px",lineHeight:1}}>&#x2715;</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ display: "none" }}>
        {tramosOrden.map((t, idx) => {
          const leInfo = leData[idx] || {};
          const Le = leInfo.Le || 0;
          return <span key={t.id} data-le={Le} />;
        })}
      </div>
    </>
  );
}
