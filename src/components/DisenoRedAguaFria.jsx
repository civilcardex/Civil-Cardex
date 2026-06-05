import { useState, useMemo, useCallback } from "react";
import { useSanitario } from "../context/SanitarioContext";
import { usePlanos } from "../context/PlanosContext";
import { AF_UC_IDS, APARATOS_DEF, ACCESORIOS_HIDRO, pisoCorto } from "./constants";
import { calcUCparcial } from "./utils";
import { DIAMETROS_AF, COEF_HAZEN_PVC, CONTADORES } from "../utils/calcHidraulica";
import { writeDiametroToDrawing, deleteRamalFromDrawing } from "../utils/writeDiametroToDrawing";

const C = COEF_HAZEN_PVC;

const LE_ACC_DEF = [
  { id: "codo90rc",     n: "Codo radio corto 90",          a: 0.76, b: 0.17 },
  { id: "codo45rc",     n: "Codo radio corto 45",          a: 0.38, b: 0.02 },
  { id: "codo90rm",     n: "Codo radio medio 90",          a: 0.67, b: 0.09 },
  { id: "codo90rl",     n: "Codo radio largo 90",          a: 0.52, b: 0.04 },
  { id: "teeDirecto",   n: "Tee paso Directo normal",      a: 0.53, b: 0.04 },
  { id: "teeReduccion", n: "Tee paso directo con red.",    a: 0.56, b: 0.33 },
  { id: "teeLado",      n: "Tee paso Lado",                a: 1.56, b: 0.37 },
  { id: "teeBilateral", n: "Tee salida bilateral",         a: 1.56, b: 0.37 },
  { id: "valvGlobo",    n: "Válvula de globo abierta",     a: 8.44, b: 0.50 },
  { id: "valvCompuerta",n: "Válvula de compuerta abierta", a: 0.17, b: 0.03 },
  { id: "valvCheque",   n: "Válvula cheque",               a: 3.20, b: 0.03 },
  { id: "valvPie",      n: "Válvula de pie con coladera",  a: 6.38, b: 0.40 },
  { id: "valvAngulo",   n: "Válvula de ángulo abierta",    a: 4.27, b: 0.25 },
  { id: "reduccion",    n: "Reducción",                    a: 0.15, b: 0.01 },
  { id: "ampliacion",   n: "Ampliación",                   a: 0.31, b: 0.01 },
  { id: "otros",        n: "Otros (definir la Le)",        a: 0,    b: 0    },
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

function Acometida({
  ucTotal, Qaco, sqrtQaco,
  contadorSel, acoContIx, setAcoContIx,
  acoMonName, setAcoMonName,
  acoRedContDiam, setAcoRedContDiam,
  acoContMonDiam, setAcoContMonDiam,
  acoL1, setAcoL1,
  acoL2, setAcoL2,
  acoPini, setAcoPini,
  acoLeMed, setAcoLeMed,
  f1, f2, hfContador,
  pResidual, okPresion,
  AF_DIAM_OPTS,
}) {
  return (
    <div className="card">
      <div className="card-h">
        <span className="card-t">🚰 Acometida</span>
      </div>
      <div className="scroll-top" style={{ padding: "6px" }}>
        <div className="scroll-inner" style={{ minWidth: "max-content" }}>
          <table className="tbl" style={{ fontSize: 10, tableLayout: "auto", width: "100%" }}>
            <colgroup>
              <col style={{width:"4%"}}/>
              <col style={{width:"6.5%"}}/>
              <col style={{width:"4%"}}/>
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
                <th colSpan={3} className="col-h" style={{textAlign:"center",padding:"3px 4px",fontSize:11,fontWeight:700,background:"var(--af)",color:"#fff",letterSpacing:.5}}>🚰 ACOMETIDA</th>
                <th className="col-h" style={{textAlign:"center",padding:"2px 1px",fontSize:9,fontWeight:600}}>Q (l/s)</th>
                <th className="col-h" style={{textAlign:"center",padding:"2px 1px",fontSize:9,fontWeight:600}}>diametro estimado</th>
                <th className="col-h" style={{textAlign:"center",padding:"2px 1px",fontSize:9,fontWeight:600}}>contador</th>
                <th className="col-h" style={{textAlign:"center",padding:"2px 1px",fontSize:9,fontWeight:600}}>diam. contador</th>
                <th className="col-h" style={{textAlign:"center",padding:"2px 1px",fontSize:9,fontWeight:600}}>material</th>
                <th className="col-h" style={{textAlign:"center",padding:"2px 1px",fontSize:9,fontWeight:600}}>coeficiente C</th>
                <th className="col-h" style={{textAlign:"center",padding:"2px 1px",fontSize:9,fontWeight:600}}>Qn (l/s)</th>
                <th colSpan={9} className="col-h" style={{padding:"2px 1px",fontSize:8,fontWeight:500,color:"var(--txt3)"}}></th>
              </tr>
            </thead>
            <tbody>


              {/* Fila RED → CONT */}
              <tr>
                <td className="c" style={{padding:"2px 1px",background:"var(--bg4)",fontWeight:700,fontSize:9,color:"var(--txt2)"}}>RED</td>
                <td className="c" style={{padding:"2px 1px",fontSize:11,color:"var(--txt2)",textAlign:"center",fontWeight:700}}>→</td>
                <td className="c" style={{padding:"2px 1px",background:"var(--bg4)",fontWeight:700,fontSize:9,color:"var(--txt2)"}}>CONTADOR</td>
                <td className="c" style={{padding:"2px 1px",fontSize:11,fontFamily:"var(--mono)",fontWeight:600}}>
                  {Qaco > 0 ? fmt(Qaco, 2) : "—"}
                </td>
                <td className="c" style={{padding:"2px 1px",fontSize:11,fontFamily:"var(--mono)"}}>
                  {sqrtQaco > 0 ? fmt(sqrtQaco, 2) : "—"}
                </td>
                <td className="c" style={{padding:"2px 1px"}}>
                  <select value={acoRedContDiam || ''} onChange={e => setAcoRedContDiam(parseFloat(e.target.value) || 0)}
                    style={{fontFamily:"var(--mono)",fontSize:11,padding:"0 1px",border:"1px solid var(--line)",borderRadius:1,background:"var(--bg2)",color:"var(--txt)",cursor:"pointer",maxWidth:54}}>
                    <option value="">—</option>
                    {AF_DIAM_OPTS.map(o => <option key={o.pulg} value={o.pulg}>{o.label}</option>)}
                  </select>
                </td>
                <td className="c" style={{padding:"2px 1px",fontFamily:"var(--mono)",fontSize:11}}>{f1.dInt > 0 ? fmt(f1.dInt, 2) : "—"}</td>
                <td className="c" style={{padding:"2px 1px",fontFamily:"var(--mono)",fontSize:11}}>PVC</td>
                <td className="c" style={{padding:"2px 1px",fontFamily:"var(--mono)",fontSize:11}}>{C}</td>
                <td className="c" style={{padding:"2px 1px",fontFamily:"var(--mono)",fontWeight:600,fontSize:11,background:f1.V>0&&f1.V>=500&&f1.V<=2500?"rgba(34,197,94,.25)":f1.V>0?"rgba(239,68,68,.25)":"transparent"}}>{f1.V > 0 ? fmt(f1.V, 2) : "—"}</td>
                <td className="c" style={{padding:"0 1px"}}><input type="number" step={0.01} className="ni" style={{width:42,textAlign:"center",padding:0,fontSize:11,fontFamily:"var(--mono)"}} value={acoL1.h} onChange={e=>setAcoL1(s=>({...s,h:parseFloat(e.target.value)||0}))}/></td>
                <td className="c" style={{padding:"0 1px"}}><input type="number" step={0.01} className="ni" style={{width:42,textAlign:"center",padding:0,fontSize:11,fontFamily:"var(--mono)"}} value={acoL1.v} onChange={e=>setAcoL1(s=>({...s,v:parseFloat(e.target.value)||0}))}/></td>
                <td className="c" style={{padding:"0 1px"}}><input type="number" step={0.01} className="ni" style={{width:42,textAlign:"center",padding:0,fontSize:11,fontFamily:"var(--mono)"}} value={acoL1.le} onChange={e=>setAcoL1(s=>({...s,le:parseFloat(e.target.value)||0}))}/></td>
                <td className="c" style={{padding:"2px 1px",fontFamily:"var(--mono)",fontWeight:600,fontSize:11}}>{f1.Lt > 0 ? fmt(f1.Lt, 2) : "—"}</td>
                <td className="c" style={{padding:"2px 1px",fontFamily:"var(--mono)",fontSize:11}}>{f1.hfPct > 0 ? fmt(f1.hfPct, 2) : "—"}</td>
                <td className="c" style={{padding:"2px 1px",fontFamily:"var(--mono)",fontWeight:600,fontSize:11}}>{f1.hfM > 0 ? fmt(f1.hfM, 2) : "—"}</td>
                <td className="c" style={{padding:"2px 1px",fontFamily:"var(--mono)",fontSize:11}}>{acoL1.v > 0 ? fmt(acoL1.v, 2) : "—"}</td>
                <td className="c" style={{padding:"0 1px"}}><input type="number" step={0.1} className="ni" style={{width:44,textAlign:"center",padding:0,fontSize:11,fontFamily:"var(--mono)"}} value={acoPini} onChange={e=>setAcoPini(parseFloat(e.target.value)||0)}/></td>
                <td className="c" style={{padding:"2px 1px",fontFamily:"var(--mono)",fontWeight:600,fontSize:11,color:f1.Pfin>=1?"var(--ok)":"var(--err)"}}>{f1.Pfin > 0 ? fmt(f1.Pfin, 2) : "—"}</td>
              </tr>

              {/* Fila CONT → Mon (editable) */}
              <tr>
                <td className="c" style={{padding:"2px 1px",background:"var(--bg4)",fontWeight:700,fontSize:9,color:"var(--txt2)"}}>CONTADOR</td>
                <td className="c" style={{padding:"2px 1px",fontSize:11,color:"var(--txt2)",textAlign:"center",fontWeight:700}}>→</td>
                <td className="c" style={{padding:"0",background:"var(--bg4)"}}>
                  <input value={acoMonName} onChange={e=>setAcoMonName(e.target.value)}
                    style={{width:"100%",border:"none",background:"transparent",textAlign:"center",fontSize:11,fontWeight:700,color:"var(--txt2)",fontFamily:"var(--mono)",padding:"2px 1px"}}/>
                </td>
                <td className="c" style={{padding:"2px 1px",fontSize:11,fontFamily:"var(--mono)",fontWeight:600}}>
                  {Qaco > 0 ? fmt(Qaco, 2) : "—"}
                </td>
                <td className="c" style={{padding:"2px 1px",fontSize:11,fontFamily:"var(--mono)"}}>
                  {sqrtQaco > 0 ? fmt(sqrtQaco, 2) : "—"}
                </td>
                <td className="c" style={{padding:"2px 1px"}}>
                  <select value={acoContMonDiam || ''} onChange={e => setAcoContMonDiam(parseFloat(e.target.value) || 0)}
                    style={{fontFamily:"var(--mono)",fontSize:11,padding:"0 1px",border:"1px solid var(--line)",borderRadius:1,background:"var(--bg2)",color:"var(--txt)",cursor:"pointer",maxWidth:54}}>
                    <option value="">—</option>
                    {AF_DIAM_OPTS.map(o => <option key={o.pulg} value={o.pulg}>{o.label}</option>)}
                  </select>
                </td>
                <td className="c" style={{padding:"2px 1px",fontFamily:"var(--mono)",fontSize:11}}>{f2.dInt > 0 ? fmt(f2.dInt, 2) : "—"}</td>
                <td className="c" style={{padding:"2px 1px",fontFamily:"var(--mono)",fontSize:11}}>PVC</td>
                <td className="c" style={{padding:"2px 1px",fontFamily:"var(--mono)",fontSize:11}}>{C}</td>
                <td className="c" style={{padding:"2px 1px",fontFamily:"var(--mono)",fontWeight:600,fontSize:11,background:f2.V>0&&f2.V>=500&&f2.V<=2500?"rgba(34,197,94,.25)":f2.V>0?"rgba(239,68,68,.25)":"transparent"}}>{f2.V > 0 ? fmt(f2.V, 2) : "—"}</td>
                <td className="c" style={{padding:"0 1px"}}><input type="number" step={0.01} className="ni" style={{width:42,textAlign:"center",padding:0,fontSize:11,fontFamily:"var(--mono)"}} value={acoL2.h} onChange={e=>setAcoL2(s=>({...s,h:parseFloat(e.target.value)||0}))}/></td>
                <td className="c" style={{padding:"0 1px"}}><input type="number" step={0.01} className="ni" style={{width:42,textAlign:"center",padding:0,fontSize:11,fontFamily:"var(--mono)"}} value={acoL2.v} onChange={e=>setAcoL2(s=>({...s,v:parseFloat(e.target.value)||0}))}/></td>
                <td className="c" style={{padding:"0 1px"}}><input type="number" step={0.01} className="ni" style={{width:42,textAlign:"center",padding:0,fontSize:11,fontFamily:"var(--mono)"}} value={acoL2.le} onChange={e=>setAcoL2(s=>({...s,le:parseFloat(e.target.value)||0}))}/></td>
                <td className="c" style={{padding:"2px 1px",fontFamily:"var(--mono)",fontWeight:600,fontSize:11}}>{f2.Lt > 0 ? fmt(f2.Lt, 2) : "—"}</td>
                <td className="c" style={{padding:"2px 1px",fontFamily:"var(--mono)",fontSize:11}}>{f2.hfPct > 0 ? fmt(f2.hfPct, 2) : "—"}</td>
                <td className="c" style={{padding:"2px 1px",fontFamily:"var(--mono)",fontWeight:600,fontSize:11}}>{f2.hfM > 0 ? fmt(f2.hfM, 2) : "—"}</td>
                <td className="c" style={{padding:"2px 1px",fontFamily:"var(--mono)",fontSize:11}}>{acoL2.v > 0 ? fmt(acoL2.v, 2) : "—"}</td>
                <td className="c" style={{padding:"2px 1px",fontFamily:"var(--mono)",fontSize:11,color:"var(--txt3)"}}>—</td>
                <td className="c" style={{padding:"2px 1px",fontFamily:"var(--mono)",fontWeight:600,fontSize:11,color:f2.Pfin>=1?"var(--ok)":"var(--err)"}}>{f2.Pfin > 0 ? fmt(f2.Pfin, 2) : "—"}</td>
              </tr>

              {/* Fila Chequeo */}
              <tr>
                <td colSpan={12} className="c" style={{padding:"2px 1px",fontSize:9,color:"var(--txt3)",textAlign:"right",fontFamily:"var(--mono)"}}>
                  Chequeo
                </td>
                <td colSpan={6} className="c" style={{padding:"2px 1px",fontSize:9,fontFamily:"var(--mono)"}}>
                  <span style={{color:"var(--txt2)"}}>P CONT: {fmt(f1.Pfin,2)}</span> &nbsp;·&nbsp;
                  <span style={{color:"var(--txt2)"}}>P Mon: {fmt(f2.Pfin,2)}</span> &nbsp;·&nbsp;
                  <span style={{background:okPresion?"rgba(34,197,94,.2)":"rgba(239,68,68,.2)",padding:"0 4px",borderRadius:2,fontWeight:700,color:okPresion?"var(--ok)":"var(--err)"}}>
                    {okPresion ? "O.K." : "No Cumple"}
                  </span>
                </td>
                <td colSpan={2} style={{padding:"2px 1px",fontFamily:"var(--mono)",fontSize:9,color:"var(--txt3)",textAlign:"right"}}>
                  P residual:
                </td>
                <td style={{padding:"2px 1px",fontFamily:"var(--mono)",fontSize:11,fontWeight:600,textAlign:"center",background:okPresion?"rgba(34,197,94,.15)":"rgba(239,68,68,.15)"}}>
                  {fmt(pResidual, 2)}
                </td>
                <td colSpan={2} className="c" style={{padding:"2px 1px",fontSize:9,color:"var(--txt2)",fontFamily:"var(--mono)"}}>
                  m.c.a.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
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

export default function DisenoRedAguaFria() {
  const { tramosAf, proy, updTramoAf, delTramoAf } = useSanitario();
  const { planos } = usePlanos();

  const AF_DIAM_OPTS = useMemo(() => {
    const seen = new Set();
    return DIAMETROS_AF.filter(d => {
      const k = d.pulg;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).map(d => ({ pulg: d.pulg, label: fmtPulg(d.pulg), dInt: d.dInt }));
  }, []);

  const handleDiamChange = useCallback((tramoId, newPulg) => {
    updTramoAf(tramoId, 'diamDisPulg', newPulg);
    const opt = AF_DIAM_OPTS.find(o => o.pulg === newPulg);
    if (opt) {
      writeDiametroToDrawing(tramoId, 'af', opt.label, planos);
    }
  }, [updTramoAf, AF_DIAM_OPTS, planos]);

  const handleDelete = useCallback((tramoId) => {
    delTramoAf(tramoId);
    deleteRamalFromDrawing(tramoId, 'af', planos);
  }, [delTramoAf, planos]);

  const AP = useMemo(
    () =>
      AF_UC_IDS.map((id) => {
        const a = APARATOS_DEF.find((x) => x.id === id);
        return a ? { id: a.id, uc: a.uc_af } : null;
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
    for (const t of tramosAf) m[t.id] = calcUCparcial(t, AP, "uc");
    return m;
  }, [tramosAf, AP]);

  const pRed = parseFloat(proy.p_red) || 20;

  const tramosOrden = useMemo(
    () => [...tramosAf].sort((a, b) => (b.piso || 0) - (a.piso || 0)),
    [tramosAf]
  );

  // ─── ACOMETIDA state ───
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
    for (const t of tramosAf) s += propiaMap[t.id] || 0;
    return s;
  }, [tramosAf, propiaMap]);

  const Qaco = ucTotal > 0
    ? Math.round((0.1163 * Math.pow(ucTotal, 0.6875)) * 1000) / 1000
    : 0;
  const sqrtQaco = Qaco > 0 ? Math.round(Math.sqrt(Qaco) * 100) / 100 : 0;

  const calcFila = (pulg, h, v, le, pIn) => {
    const dInt = pulg > 0 ? (DIAMETROS_AF.find(d => Math.abs(d.pulg - pulg) < 0.01) || {}).dInt : 0;
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
          <span className="card-t">💧 Diseño de red agua fria</span>
          <span className="card-s">{tramosAf.length} tramos</span>
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
                  <th className="col-h af" colSpan={3} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>UND consumo</th>
                  <th className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>#Desc</th>
                  <th className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>K</th>
                  <th className="col-h af" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>Q (l/s)</th>
                  <th className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>√Q</th>
                  <th className="col-h ok" colSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>DIAMETRO</th>
                  <th className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>C</th>
                  <th className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>V mm/s</th>
                  <th className="col-h" colSpan={4} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>LONG (m)</th>
                  <th className="col-h" colSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>Hf</th>
                  <th className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>ΔZ (m)</th>
                  <th className="col-h af" colSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>P final (mca)</th>
                  <th className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9, width:14 }}></th>
                </tr>
                <tr>
                  <th className="col-h af" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Prop</th>
                  <th className="col-h af" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Otr</th>
                  <th className="col-h af" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Tot</th>
                  <th className="col-h ok" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Diseño</th>
                  <th className="col-h ok" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Int mm</th>
                  <th className="col-h" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>H</th>
                  <th className="col-h" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>V</th>
                  <th className="col-h" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Le</th>
                  <th className="col-h" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Tot</th>
                  <th className="col-h" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>%</th>
                  <th className="col-h" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>m</th>
                  <th className="col-h af" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>INI</th>
                  <th className="col-h af" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>FIN</th>
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
                {tramosOrden.map((t) => {
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
                  const Le = calcLeAcces(t.accesorios, disPulg, C);
                  const Lt = H + Vvert + Le;
                  const hfPct = Vmms > 0 && C > 0 && internoMm > 0 ? Math.round(((60.1 * Math.pow(Vmms, 1.852)) / (Math.pow(C, 1.852) * Math.pow(internoMm, 1.167))) / 100 * 10000) / 10000 : 0;
                  const hfM = Lt > 0 && hfPct > 0 ? Math.round((Lt * hfPct) / 10 * 100) / 100 : 0;
                  const dZ = Vvert;
                  const PinCalc = pRed;
                  const PfinCalc = PinCalc + dZ - hfM;
                  const Pin = presIniEdit.has(t.id) ? presIniEdit.get(t.id) : PinCalc;
                  const Pfin = presFinEdit.has(t.id) ? presFinEdit.get(t.id) : PfinCalc;
                  const vCumple = Vmms >= 500 && Vmms <= 2500;
                  const otherTramos = tramosAf.filter((o) => o.id !== t.id);
                  return (
                    <tr key={t.id}>
                      <td className="c" style={{ padding: "0 1px"}}><span className="sigla" style={{fontSize:11, padding:"1px 4px"}}>{t.id}</span></td>
                      <td className="c" style={{fontFamily:"var(--mono)",padding:"0 1px",color:"var(--txt2)",fontSize:11}}>{pisoCorto(t.piso)}</td>
                      <td className="c" style={{fontFamily:"var(--mono)",padding:"0 1px",fontSize:11}}>{fmt(propia,2)}</td>
                      <td className="c" style={{padding:"0 1px",minWidth:40}}>
                        <div style={{display:"flex",flexWrap:"nowrap",gap:0,justifyContent:"center",alignItems:"center"}}>
                          {otherTramos.length===0?<span style={{fontSize:9,color:"var(--txt3)"}}>—</span>:otherTramos.map(o=>
                            <button key={o.id} onClick={()=>toggleOtro(t.id,o.id)}
                              style={{fontSize:8,padding:"0 1px",border:"1px solid",borderRadius:1,cursor:"pointer",background:selected.has(o.id)?"var(--af)":"transparent",color:selected.has(o.id)?"#fff":"var(--txt3)",borderColor:selected.has(o.id)?"var(--af)":"var(--line)",fontFamily:"var(--mono)",lineHeight:1.5}}>{o.id}</button>
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
                          {AF_DIAM_OPTS.map(o=><option key={o.pulg} value={o.pulg}>{o.label}</option>)}
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
        f1={f1} f2={f2} hfContador={hfContador}
        pResidual={pResidual} okPresion={okPresion}
        AF_DIAM_OPTS={AF_DIAM_OPTS}
      />

  {/* ── TABLA INTERNA DE LE: Longitud equivalente por accesorios (oculta visualmente, calculos internos) ── */}
  <div style={{ display: "none" }}>
        <div className="card-h">
          <span className="card-t">🔩 Longitud equivalente por accesorios (m)</span>
          <span className="card-s">Cálculo interno de Le por ramal · PVC-PR C=150</span>
        </div>
        <div style={{ padding: "4px" }}>
          <table className="tbl" style={{ width: "100%", fontSize: 10, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "6%" }} />
              <col style={{ width: "6%" }} />
              {LE_ACC_DEF.map((a) => (
                <col key={a.id} style={{ width: `${88 / LE_ACC_DEF.length}%` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "4px 2px" }}>Le</th>
                <th className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "4px 2px" }}>D</th>
                {LE_ACC_DEF.map((a) => (
                  <th
                    key={a.id}
                    className="col-h"
                    style={{
                      textAlign: "center",
                      padding: "4px 2px",
                      fontSize: 9,
                      writingMode: "vertical-rl",
                      transform: "rotate(180deg)",
                      whiteSpace: "nowrap",
                      height: 100,
                    }}
                    title={a.n}
                  >
                    {a.id === "codo90rc" ? "Codo 90° RC" :
                     a.id === "teeDirecto" ? "Tee Dir" :
                     a.id === "teeReduccion" ? "Tee Red" :
                     a.id === "teeLado" ? "Tee Lado" :
                     a.id === "teeBilateral" ? "Tee Bil" :
                     a.id === "valvGlobo" ? "V. Globo" :
                     a.id === "valvCompuerta" ? "V. Comp" :
                     a.id === "reduccion" ? "Reduc" :
                     a.id === "ampliacion" ? "Ampl" :
                     a.id === "codo45rc" ? "Codo 45° RC" :
                     a.id === "valvCheque" ? "V. Cheq" :
                     a.id === "valvPie" ? "V. Pie" :
                     a.id === "codo90rm" ? "Codo 90° RM" :
                     a.id === "codo90rl" ? "Codo 90° RL" :
                     a.id === "valvAngulo" ? "V. Áng" :
                     a.id === "otros" ? "Otros" : a.n}
                  </th>
                ))}
              </tr>
              <tr>
                <th colSpan={2 + LE_ACC_DEF.length} style={{ background: "var(--bg3)", border: "1px solid var(--line)", textAlign: "center", padding: "4px", fontSize: 10, color: "var(--txt2)" }}>
                  Longitud equivalente por accesorios (m)
                </th>
              </tr>
            </thead>
            <tbody>
              {tramosOrden.length === 0 && (
                <tr>
                  <td colSpan={2 + LE_ACC_DEF.length} style={{ padding: "16px", textAlign: "center", color: "var(--txt3)", fontSize: 10 }}>
                    No hay tramos.
                  </td>
                </tr>
              )}
              {tramosOrden.map((t) => {
                const disPulg = t.diamDisPulg || 0;
                const Le = calcLeAcces(t.accesorios, disPulg, C);
                return (
                  <tr key={t.id}>
                    <td className="c" style={{ fontFamily: "var(--mono)", fontWeight: 700, padding: "4px 2px", textAlign: "center", background: Le > 0 ? "rgba(59,130,246,.12)" : "transparent" }}>
                      {Le > 0 ? fmt(Le, 2) : "—"}
                    </td>
                  <td className="c" style={{ padding: "4px 2px", textAlign: "center", color: "var(--txt2)" }}>
                    <select
                      value={disPulg || ''}
                      onChange={e => handleDiamChange(t.id, parseFloat(e.target.value) || 0)}
                      style={{ fontFamily: "var(--mono)", fontSize: 10, padding: "1px 2px", border: "1px solid var(--line)", borderRadius: 2, background: "var(--bg2)", color: "var(--txt)", cursor: "pointer" }}
                    >
                      <option value="">—</option>
                      {AF_DIAM_OPTS.map(o => (
                        <option key={o.pulg} value={o.pulg}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                    {LE_ACC_DEF.map((a) => {
                      const v = t.accesorios?.[a.id] || 0;
                      return (
                        <td
                          key={a.id}
                          className="c"
                          style={{
                            fontFamily: "var(--mono)",
                            padding: "4px 2px",
                            textAlign: "center",
                            background: v > 0 ? "rgba(59,130,246,.15)" : "transparent",
                            color: v > 0 ? "var(--txt)" : "var(--txt3)",
                          }}
                        >
                          {v > 0 ? v : ""}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
