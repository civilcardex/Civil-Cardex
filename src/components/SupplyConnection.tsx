import { COEF_HAZEN_PVC } from "../utils/calcHydraulics";

const C = COEF_HAZEN_PVC;

import { fmt } from "../utils/fmt";

interface FilaResult {
  dInt: number;
  V: number;
  Lt: number;
  hfPct: number;
  hfM: number;
  Pfin: number;
}

interface LData {
  h: number;
  v: number;
  le: number;
}

interface ContadorSel {
  qn_lps: number;
}

interface DiamOpt {
  pulg: number;
  label: string;
  dInt: number;
}

interface AcometidaProps {
  ucTotal: number;
  Qaco: number;
  sqrtQaco: number;
  contadorSel: ContadorSel;
  acoContIx: number;
  setAcoContIx: (ix: number) => void;
  acoMonName: string;
  setAcoMonName: (name: string) => void;
  acoRedContDiam: number;
  setAcoRedContDiam: (d: number) => void;
  acoContMonDiam: number;
  setAcoContMonDiam: (d: number) => void;
  acoL1: LData;
  setAcoL1: (fn: (s: LData) => LData) => void;
  acoL2: LData;
  setAcoL2: (fn: (s: LData) => LData) => void;
  acoPini: number;
  setAcoPini: (p: number) => void;
  acoLeMed: number;
  setAcoLeMed: (le: number) => void;
  f1: FilaResult;
  f2: FilaResult;
  hfContador: number;
  pResidual: number;
  okPresion: boolean;
  AF_DIAM_OPTS: DiamOpt[];
}

export default function Acometida({
  Qaco, sqrtQaco,
  acoMonName, setAcoMonName,
  acoRedContDiam, setAcoRedContDiam,
  acoContMonDiam, setAcoContMonDiam,
  acoL1, setAcoL1,
  acoL2, setAcoL2,
  acoPini, setAcoPini,
  f1, f2,
  pResidual, okPresion,
  AF_DIAM_OPTS,
}: AcometidaProps) {
  return (
    <div className="card">
      <div className="card-h">
        <span className="card-t"><img src="/iconos_diseno_redes/Acometida.webp" alt="" style={{width:24,height:24,verticalAlign:'middle',marginRight:4}} /> Acometida</span>
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
                <th colSpan={3} className="col-h" style={{textAlign:"center",padding:"3px 4px",fontSize:11,fontWeight:700,background:"var(--af)",color:"#fff",letterSpacing:.5}}>ACOMETIDA</th>
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
                <td className="c" style={{padding:"2px 1px",fontSize:11,fontWeight:600}}>
                  {Qaco > 0 ? fmt(Qaco, 2) : "—"}
                </td>
                <td className="c" style={{padding:"2px 1px",fontSize:11}}>
                  {sqrtQaco > 0 ? fmt(sqrtQaco, 2) : "—"}
                </td>
                <td className="c" style={{padding:"2px 1px"}}>
                  <select value={acoRedContDiam || ''} onChange={e => setAcoRedContDiam(parseFloat(e.target.value) || 0)}
                    style={{fontSize:11,padding:"0 1px",border:"1px solid var(--line)",borderRadius:1,background:"var(--bg2)",color:"var(--txt)",cursor:"pointer",maxWidth:54}}>
                    <option value="">—</option>
                    {AF_DIAM_OPTS.map(o => <option key={o.pulg} value={o.pulg}>{o.label}</option>)}
                  </select>
                </td>
                <td className="c" style={{padding:"2px 1px",fontSize:11}}>{f1.dInt > 0 ? fmt(f1.dInt, 2) : "—"}</td>
                <td className="c" style={{padding:"2px 1px",fontSize:11}}>PVC</td>
                <td className="c" style={{padding:"2px 1px",fontSize:11}}>{C}</td>
                <td className="c" style={{padding:"2px 1px",fontWeight:600,fontSize:11,background:f1.V>0&&f1.V>=500&&f1.V<=2500?"rgba(34,197,94,.25)":f1.V>0?"rgba(239,68,68,.25)":"transparent"}}>{f1.V > 0 ? fmt(f1.V, 2) : "—"}</td>
                <td className="c" style={{padding:"0 1px"}}><input type="number" step={0.01} className="ni" style={{width:42,textAlign:"center",padding:0,fontSize:11}} value={acoL1.h} onChange={e=>setAcoL1(s=>({...s,h:parseFloat(e.target.value)||0}))}/></td>
                <td className="c" style={{padding:"0 1px"}}><input type="number" step={0.01} className="ni" style={{width:42,textAlign:"center",padding:0,fontSize:11}} value={acoL1.v} onChange={e=>setAcoL1(s=>({...s,v:parseFloat(e.target.value)||0}))}/></td>
                <td className="c" style={{padding:"0 1px"}}><input type="number" step={0.01} className="ni" style={{width:42,textAlign:"center",padding:0,fontSize:11}} value={acoL1.le} onChange={e=>setAcoL1(s=>({...s,le:parseFloat(e.target.value)||0}))}/></td>
                <td className="c" style={{padding:"2px 1px",fontWeight:600,fontSize:11}}>{f1.Lt > 0 ? fmt(f1.Lt, 2) : "—"}</td>
                <td className="c" style={{padding:"2px 1px",fontSize:11}}>{f1.hfPct > 0 ? fmt(f1.hfPct, 2) : "—"}</td>
                <td className="c" style={{padding:"2px 1px",fontWeight:600,fontSize:11}}>{f1.hfM > 0 ? fmt(f1.hfM, 2) : "—"}</td>
                <td className="c" style={{padding:"2px 1px",fontSize:11}}>{acoL1.v > 0 ? fmt(acoL1.v, 2) : "—"}</td>
                <td className="c" style={{padding:"0 1px"}}><input type="number" step={0.1} className="ni" style={{width:44,textAlign:"center",padding:0,fontSize:11}} value={acoPini} onChange={e=>setAcoPini(parseFloat(e.target.value)||0)}/></td>
                <td className="c" style={{padding:"2px 1px",fontWeight:600,fontSize:11,color:f1.Pfin>=1?"var(--ok)":"var(--err)"}}>{f1.Pfin > 0 ? fmt(f1.Pfin, 2) : "—"}</td>
              </tr>

              {/* Fila CONT → Mon (editable) */}
              <tr>
                <td className="c" style={{padding:"2px 1px",background:"var(--bg4)",fontWeight:700,fontSize:9,color:"var(--txt2)"}}>CONTADOR</td>
                <td className="c" style={{padding:"2px 1px",fontSize:11,color:"var(--txt2)",textAlign:"center",fontWeight:700}}>→</td>
                <td className="c" style={{padding:"0",background:"var(--bg4)"}}>
                  <input value={acoMonName} onChange={e=>setAcoMonName(e.target.value)}
                    style={{width:"100%",border:"none",background:"transparent",textAlign:"center",fontSize:11,fontWeight:700,color:"var(--txt2)",padding:"2px 1px"}}/>
                </td>
                <td className="c" style={{padding:"2px 1px",fontSize:11,fontWeight:600}}>
                  {Qaco > 0 ? fmt(Qaco, 2) : "—"}
                </td>
                <td className="c" style={{padding:"2px 1px",fontSize:11}}>
                  {sqrtQaco > 0 ? fmt(sqrtQaco, 2) : "—"}
                </td>
                <td className="c" style={{padding:"2px 1px"}}>
                  <select value={acoContMonDiam || ''} onChange={e => setAcoContMonDiam(parseFloat(e.target.value) || 0)}
                    style={{fontSize:11,padding:"0 1px",border:"1px solid var(--line)",borderRadius:1,background:"var(--bg2)",color:"var(--txt)",cursor:"pointer",maxWidth:54}}>
                    <option value="">—</option>
                    {AF_DIAM_OPTS.map(o => <option key={o.pulg} value={o.pulg}>{o.label}</option>)}
                  </select>
                </td>
                <td className="c" style={{padding:"2px 1px",fontSize:11}}>{f2.dInt > 0 ? fmt(f2.dInt, 2) : "—"}</td>
                <td className="c" style={{padding:"2px 1px",fontSize:11}}>PVC</td>
                <td className="c" style={{padding:"2px 1px",fontSize:11}}>{C}</td>
                <td className="c" style={{padding:"2px 1px",fontWeight:600,fontSize:11,background:f2.V>0&&f2.V>=500&&f2.V<=2500?"rgba(34,197,94,.25)":f2.V>0?"rgba(239,68,68,.25)":"transparent"}}>{f2.V > 0 ? fmt(f2.V, 2) : "—"}</td>
                <td className="c" style={{padding:"0 1px"}}><input type="number" step={0.01} className="ni" style={{width:42,textAlign:"center",padding:0,fontSize:11}} value={acoL2.h} onChange={e=>setAcoL2(s=>({...s,h:parseFloat(e.target.value)||0}))}/></td>
                <td className="c" style={{padding:"0 1px"}}><input type="number" step={0.01} className="ni" style={{width:42,textAlign:"center",padding:0,fontSize:11}} value={acoL2.v} onChange={e=>setAcoL2(s=>({...s,v:parseFloat(e.target.value)||0}))}/></td>
                <td className="c" style={{padding:"0 1px"}}><input type="number" step={0.01} className="ni" style={{width:42,textAlign:"center",padding:0,fontSize:11}} value={acoL2.le} onChange={e=>setAcoL2(s=>({...s,le:parseFloat(e.target.value)||0}))}/></td>
                <td className="c" style={{padding:"2px 1px",fontWeight:600,fontSize:11}}>{f2.Lt > 0 ? fmt(f2.Lt, 2) : "—"}</td>
                <td className="c" style={{padding:"2px 1px",fontSize:11}}>{f2.hfPct > 0 ? fmt(f2.hfPct, 2) : "—"}</td>
                <td className="c" style={{padding:"2px 1px",fontWeight:600,fontSize:11}}>{f2.hfM > 0 ? fmt(f2.hfM, 2) : "—"}</td>
                <td className="c" style={{padding:"2px 1px",fontSize:11}}>{acoL2.v > 0 ? fmt(acoL2.v, 2) : "—"}</td>
                <td className="c" style={{padding:"2px 1px",fontSize:11,color:"var(--txt3)"}}>—</td>
                <td className="c" style={{padding:"2px 1px",fontWeight:600,fontSize:11,color:f2.Pfin>=1?"var(--ok)":"var(--err)"}}>{f2.Pfin > 0 ? fmt(f2.Pfin, 2) : "—"}</td>
              </tr>

              {/* Fila Chequeo */}
              <tr>
                <td colSpan={12} className="c" style={{padding:"2px 1px",fontSize:9,color:"var(--txt3)",textAlign:"right"}}>
                  Chequeo
                </td>
                <td colSpan={6} className="c" style={{padding:"2px 1px",fontSize:9}}>
                  <span style={{color:"var(--txt2)"}}>P CONT: {fmt(f1.Pfin,2)}</span> &nbsp;·&nbsp;
                  <span style={{color:"var(--txt2)"}}>P Mon: {fmt(f2.Pfin,2)}</span> &nbsp;·&nbsp;
                  <span style={{background:okPresion?"rgba(34,197,94,.2)":"rgba(239,68,68,.2)",padding:"0 4px",borderRadius:2,fontWeight:700,color:okPresion?"var(--ok)":"var(--err)"}}>
                    {okPresion ? "O.K." : "No Cumple"}
                  </span>
                </td>
                <td colSpan={2} style={{padding:"2px 1px",fontSize:9,color:"var(--txt3)",textAlign:"right"}}>
                  P residual:
                </td>
                <td style={{padding:"2px 1px",fontSize:11,fontWeight:600,textAlign:"center",background:okPresion?"rgba(34,197,94,.15)":"rgba(239,68,68,.15)"}}>
                  {fmt(pResidual, 2)}
                </td>
                <td colSpan={2} className="c" style={{padding:"2px 1px",fontSize:9,color:"var(--txt2)"}}>
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
