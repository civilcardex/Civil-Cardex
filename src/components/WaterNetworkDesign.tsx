import { useState, useMemo, useCallback } from "react";
import { useTramos } from "../context/TramosContext";
import { useProject } from "../context/ProjectContext";
import { usePlans } from "../context/PlansContext";
import { AF_UC_IDS, AC_UC_IDS, APARATOS_DEF, pisoCorto } from "../constants";
import { calcUCparcial } from "../utils/componentHelpers";
import { COEF_HAZEN_PVC, COEF_HAZEN_CPVC, CONTADORES } from "../utils/calcHydraulics";
import { writeDiametroToDrawing, deleteRamalFromDrawing } from "../utils/writeDiameterToDrawing";
import { calcLeAcces } from "../utils/accesoriosUtils";
import { fmtPulg } from "../utils/formatUtils";
import { useToggleMap } from "../hooks/useToggleMap";
const fmt = (v: unknown, d = 2) => v == null || Number.isNaN(Number(v)) ? "—" : Number(v).toFixed(d);
import Acometida from "./SupplyConnection";

interface WaterNetworkDesignProps {
  networkType: 'af' | 'ac';
  diamTable: Array<{ pulg: number; nominal: string; label?: string; dInt: number }>;
  lookupFn: (pulg: number) => number;
}

const isAf = (t: string) => t === 'af';

export default function WaterNetworkDesign({ networkType, diamTable, lookupFn }: WaterNetworkDesignProps) {
  const { tramosAf, tramosAc, updTramoAf, updTramoAc, delTramoAf, delTramoAc } = useTramos();
  const { proy } = useProject();
  const { plans } = usePlans();

  const tramos = isAf(networkType) ? tramosAf : tramosAc;
  const updTramo = isAf(networkType) ? updTramoAf : updTramoAc;
  const delTramo = isAf(networkType) ? delTramoAf : delTramoAc;
  const ucIds = isAf(networkType) ? AF_UC_IDS : AC_UC_IDS;
  const C = isAf(networkType) ? COEF_HAZEN_PVC : COEF_HAZEN_CPVC;
  const cssClass = networkType;
  const colorVar = `var(--${networkType})`;
  const ucField = isAf(networkType) ? 'uc_af' : 'uc_ac';
  const title = isAf(networkType) ? 'agua fr\u00EDa' : 'agua caliente';
  const icon = isAf(networkType) ? 'hidraulica/RAF_Diseno.webp' : 'hidraulica/RAC_Diseno.webp';

  const DIAM_OPTS = useMemo(() => {
    return diamTable.map(d => ({ pulg: d.pulg, nominal: d.nominal, label: d.nominal, dInt: d.dInt }));
  }, [diamTable]);

  const [diamIntMap, setDiamIntMap] = useState<Record<string, number>>({});
  const [diamNomMap, setDiamNomMap] = useState<Record<string, string>>({});

  const handleDiamChange = useCallback((tramoId: string, nominal: string) => {
    const opt = DIAM_OPTS.find(o => o.nominal === nominal);
    if (!opt) return;
    const pulg = opt.pulg;
    updTramo(tramoId, 'diamDisPulg', pulg);
    setDiamIntMap(prev => ({ ...prev, [tramoId]: opt.dInt }));
    setDiamNomMap(prev => ({ ...prev, [tramoId]: opt.nominal }));
    writeDiametroToDrawing(tramoId, networkType, opt.label, plans);
  }, [updTramo, DIAM_OPTS, plans, networkType]);

  const handleDelete = useCallback((tramoId: string) => {
    delTramo(tramoId);
    deleteRamalFromDrawing(tramoId, networkType, plans);
  }, [delTramo, plans, networkType]);

  const AP = useMemo(
    () =>
      ucIds.map((id) => {
        const a = APARATOS_DEF.find((x) => x.id === id);
        return a ? { id: a.id, uc: a[ucField] } : null;
      }).filter(Boolean),
    [ucIds, ucField]
  );

  const [otrosSel, toggleOtro] = useToggleMap();
  const [presIniEdit, setPresIniEdit] = useState(() => new Map());
  const [presFinEdit, setPresFinEdit] = useState(() => new Map());

  const setPresIni = useCallback((tramoId: string, v: number) => {
    setPresIniEdit((prev) => {
      const next = new Map(prev);
      next.set(tramoId, v);
      return next;
    });
  }, []);

  const setPresFin = useCallback((tramoId: string, v: number) => {
    setPresFinEdit((prev) => {
      const next = new Map(prev);
      next.set(tramoId, v);
      return next;
    });
  }, []);

  const propiaMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tramos) m[t.id] = calcUCparcial(t, AP as any, "uc");
    return m;
  }, [tramos, AP]);

  const pRed = parseFloat(proy.p_red) || 20;

  const tramosOrden = useMemo(
    () => [...tramos].sort((a, b) => (b.piso || 0) - (a.piso || 0)),
    [tramos]
  );

  const [acoContIx, setAcoContIx] = useState(2);
  const [acoMonName, setAcoMonName] = useState('Mon');
  const [acoRedContDiam, setAcoRedContDiam] = useState(0.75);
  const [acoContMonDiam, setAcoContMonDiam] = useState(1.25);
  const [acoL1, setAcoL1] = useState({ h: 10.00, v: 0.00, le: 0.47 });
  const [acoL2, setAcoL2] = useState({ h: 7.54, v: 0.00, le: 0.00 });
  const [acoPini, setAcoPini] = useState(20.00);
  const [acoLeMed, setAcoLeMed] = useState(0);

  const contadorSel = CONTADORES[acoContIx] || CONTADORES[0];

  const ucTotal = useMemo(() => {
    let s = 0;
    for (const t of tramos) s += (propiaMap[t.id] || 0) as number;
    return s;
  }, [tramos, propiaMap]);

  const Qaco = ucTotal > 0
    ? Math.round((0.1163 * Math.pow(ucTotal, 0.6875)) * 1000) / 1000
    : 0;
  const sqrtQaco = Qaco > 0 ? Math.round(Math.sqrt(Qaco) * 100) / 100 : 0;

  const calcFila = (pulg: number, h: number, v: number, le: number, pIn: number) => {
    const dInt: number = pulg > 0 ? ((diamTable.find(d => Math.abs(d.pulg - pulg) < 0.01) || {}).dInt || 0) : 0;
    const V = Qaco > 0 && dInt > 0
      ? Math.round((1000000 * Qaco) / ((Math.PI / 4) * dInt * dInt) * 10) / 10
      : 0;
    const Lt = (h || 0) + (v || 0) + (le || 0);
    const hfPct = V > 0 && dInt > 0
      ? Math.round(((60.1 * Math.pow(V, 1.852)) / (Math.pow(C, 1.852) * Math.pow(dInt, 1.167))) / 100 * 10000) / 10000
      : 0;
    const hfM = Lt > 0 && hfPct > 0 ? Math.round((Lt * hfPct) / 10 * 100) / 100 : 0;
    const Pfin = +(pIn + (v || 0) - hfM).toFixed(2);
    return { dInt, V, Lt, hfPct, hfM, Pfin };
  };

  const acoL1LeTotal = acoL1.le + acoLeMed;
  const f1 = calcFila(acoRedContDiam, acoL1.h, acoL1.v, acoL1LeTotal, acoPini);
  const f2 = calcFila(acoContMonDiam, acoL2.h, acoL2.v, acoL2.le, f1.Pfin);
  const hfContador = Qaco > 0 && contadorSel.qn_lps > 0
    ? Math.round(10 * Math.pow(Qaco / contadorSel.qn_lps, 2) * 100) / 100
    : 0;
  const pResidual = +((f1.Pfin - f2.Pfin).toFixed(2));
  const okPresion = f1.Pfin > f2.Pfin;

  return (
    <>
      <div className="card">
        <div className="card-h">
          <span className="card-t"><img src={`/iconos_diseno_redes/${icon}`} alt=""  width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}}  loading="lazy" /> Diseño de red {title}</span>
          <span className="card-s">{tramos.length} tramos</span>
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
                  <th className={`col-h ${cssClass}`} colSpan={3} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>UND consumo</th>
                  <th className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>#Desc</th>
                  <th className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>K</th>
                  <th className={`col-h ${cssClass}`} rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>Q (l/s)</th>
                  <th className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>√Q</th>
                  <th className="col-h ok" colSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>DIAMETRO</th>
                  <th className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>C</th>
                  <th className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>V mm/s</th>
                  <th className="col-h" colSpan={4} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>LONG (m)</th>
                  <th className="col-h" colSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>Hf</th>
                  <th className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>ΔZ (m)</th>
                  <th className={`col-h ${cssClass}`} colSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>P final (mca)</th>
                  <th className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9, width:14 }}></th>
                </tr>
                <tr>
                  <th className={`col-h ${cssClass}`} style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Prop</th>
                  <th className={`col-h ${cssClass}`} style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Otr</th>
                  <th className={`col-h ${cssClass}`} style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Tot</th>
                  <th className="col-h ok" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Diseño</th>
                  <th className="col-h ok" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Int mm</th>
                  <th className="col-h" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Horizontal</th>
                  <th className="col-h" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>V</th>
                  <th className="col-h" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Le</th>
                  <th className="col-h" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Tot</th>
                  <th className="col-h" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>%</th>
                  <th className="col-h" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>m</th>
                  <th className={`col-h ${cssClass}`} style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>INI</th>
                  <th className={`col-h ${cssClass}`} style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>FIN</th>
                </tr>
              </thead>
              <tbody>
                {tramosOrden.length === 0 && (
                  <tr>
                    <td colSpan={23} style={{ padding: "24px 0", textAlign: "center", color: "var(--txt3)", fontSize: 11 }}>
                      No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                    </td>
                  </tr>
                )}
                {tramosOrden.map((t) => {
                  const propia = (propiaMap[t.id] || 0) as number;
                  const selected = otrosSel.get(t.id) || new Set();
                  let totalExtra = 0;
                  for (const oId of selected) totalExtra += (propiaMap[oId] || 0) as number;
                  const total = propia + totalExtra;
                  const nDesc = t.nSalidas || 0;
                  const K = nDesc > 0 ? Math.round((nDesc === 1 ? 1 : 1 / Math.sqrt(nDesc - 1)) * 100) / 100 : 0;
                  const Qprob = total > 0 && K > 0 ? Math.round(K * (total < 240 ? 0.1163 * Math.pow(total, 0.6875) : 0.074 * Math.pow(total, 0.7504)) * 1000) / 1000 : 0;
                  const raizQ = Qprob > 0 ? Math.round(Math.sqrt(Qprob) * 100) / 100 : 0;
                  const disPulg = t.diamDisPulg || 0;
                  const internoMm = diamIntMap[t.id] || lookupFn(disPulg) || 0;
                  const Vmms = Qprob > 0 && internoMm > 0 ? Math.round((1000000 * Qprob) / ((Math.PI / 4) * internoMm * internoMm) * 10) / 10 : 0;
                  const H = t.totalL || t.Lh || 0;
                  const Vvert = t.Lv || t.deltaZ || 0;
                  const Le = calcLeAcces(t.accesorios ?? {}, disPulg, C);
                  const Lt = H + Vvert + Le;
                  const hfPct = Vmms > 0 && C > 0 && internoMm > 0 ? Math.round(((60.1 * Math.pow(Vmms, 1.852)) / (Math.pow(C, 1.852) * Math.pow(internoMm, 1.167))) / 100 * 10000) / 10000 : 0;
                  const hfM = Lt > 0 && hfPct > 0 ? Math.round((Lt * hfPct) / 10 * 100) / 100 : 0;
                  const dZ = Vvert;
                  const PinCalc = pRed;
                  const PfinCalc = PinCalc + dZ - hfM;
                  const Pin = presIniEdit.has(t.id) ? presIniEdit.get(t.id) : PinCalc;
                  const Pfin = presFinEdit.has(t.id) ? presFinEdit.get(t.id) : PfinCalc;
                  const vCumple = Vmms >= 500 && Vmms <= 2500;
                  const otherTramos = tramos.filter((o) => o.id !== t.id);
                  return (
                    <tr key={t.id}>
                      <td className="c" style={{ padding: "0 1px"}}><span className="sigla" style={{fontSize:11, padding:"1px 4px"}}>{t.id}</span></td>
                      <td className="c" style={{padding:"0 1px",color:"var(--txt2)",fontSize:11}}>{pisoCorto(t.piso)}</td>
                      <td className="c td-mono">{fmt(propia,2)}</td>
                      <td className="c" style={{padding:"0 1px",minWidth:40}}>
                        <div style={{display:"flex",flexWrap:"nowrap",gap:0,justifyContent:"center",alignItems:"center"}}>
                          {otherTramos.length===0?<span style={{fontSize:9,color:"var(--txt3)"}}>—</span>:otherTramos.map(o=>
                            <button key={o.id} onClick={()=>toggleOtro(t.id,o.id)}
                              style={{fontSize:8,padding:"0 1px",border:"1px solid",borderRadius:1,cursor:"pointer",background:selected.has(o.id)?colorVar:"transparent",color:selected.has(o.id)?"#fff":"var(--txt3)",borderColor:selected.has(o.id)?colorVar:"var(--line)",lineHeight:1.5}}>{o.id}</button>
                          )}
                        </div>
                      </td>
                      <td className="c td-mono-b">{fmt(total,2)}</td>
                      <td className="c td-mono">{nDesc>0?nDesc:"—"}</td>
                      <td className="c td-mono-b">{K>0?fmt(K,2):"—"}</td>
                      <td className="c td-mono-b">{Qprob>0?fmt(Qprob,2):"—"}</td>
                      <td className="c td-mono">{raizQ>0?fmt(raizQ,2):"—"}</td>
                       <td className="c" style={{padding:"0 1px"}}>
                        <select value={diamNomMap[t.id] || ''} onChange={e=>handleDiamChange(t.id, e.target.value)}
                          style={{fontSize:10,padding:"0 1px",border:"1px solid var(--line)",borderRadius:1,background:"var(--bg2)",color:"var(--txt)",cursor:"pointer",maxWidth:120}}>
                          <option value="">—</option>
                          {DIAM_OPTS.map(o=><option key={o.nominal} value={o.nominal}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="c td-mono">{internoMm>0?fmt(internoMm,2):"—"}</td>
                      <td className="c td-mono">{C}</td>
                      <td className="c" style={{fontWeight:600,padding:"0 1px",fontSize:11,background:Vmms>0&&vCumple?"rgba(34,197,94,.25)":Vmms>0?"rgba(239,68,68,.25)":"transparent"}}>{Vmms>0?fmt(Vmms,2):"—"}</td>
                      <td className="c td-mono">{H>0?fmt(H,2):"—"}</td>
                      <td className="c td-mono">{Vvert>0?fmt(Vvert,2):"—"}</td>
                      <td className="c td-mono">{Le>0?fmt(Le,2):"—"}</td>
                      <td className="c td-mono-b">{Lt>0?fmt(Lt,2):"—"}</td>
                      <td className="c td-mono">{hfPct>0?fmt(hfPct,2):"—"}</td>
                      <td className="c td-mono-b">{hfM>0?fmt(hfM,2):"—"}</td>
                      <td className="c td-mono">{dZ>0?fmt(dZ,2):"—"}</td>
                      <td className="c" style={{padding:"0 1px"}}><input type="number" className="ni" style={{width:44,textAlign:"center",padding:0,fontSize:11}} value={Pin} step={0.1} onChange={e=>setPresIni(t.id,parseFloat(e.target.value)||0)}/></td>
                      <td className="c" style={{padding:"0 1px"}}><input type="number" className="ni" style={{width:44,textAlign:"center",padding:0,fontSize:11}} value={Pfin} step={0.1} onChange={e=>setPresFin(t.id,parseFloat(e.target.value)||0)}/></td>
                      <td className="c" style={{padding:"0 1px"}}><button onClick={()=>handleDelete(t.id)} title="Eliminar" style={{border:"none",background:"transparent",color:"var(--txt3)",cursor:"pointer",fontSize:11,padding:"2px 6px",lineHeight:1}}>&#x2715;</button></td>
                    </tr>
                  );
                })}


              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isAf(networkType) && (
        <Acometida
          ucTotal={ucTotal} Qaco={Qaco} sqrtQaco={sqrtQaco}
          contadorSel={contadorSel} acoContIx={acoContIx} setAcoContIx={setAcoContIx}
          acoMonName={acoMonName} setAcoMonName={setAcoMonName}
          acoRedContDiam={acoRedContDiam} setAcoRedContDiam={setAcoRedContDiam}
          acoContMonDiam={acoContMonDiam} setAcoContMonDiam={setAcoContMonDiam}
          acoL1={acoL1} setAcoL1={setAcoL1}
          acoL2={acoL2} setAcoL2={setAcoL2}
          acoPini={acoPini} setAcoPini={setAcoPini}
          acoLeMed={acoLeMed} setAcoLeMed={setAcoLeMed}
          f1={f1 as any} f2={f2 as any} hfContador={hfContador}
          pResidual={pResidual} okPresion={okPresion}
          AF_DIAM_OPTS={DIAM_OPTS}
        />
      )}

    </>
  );
}
