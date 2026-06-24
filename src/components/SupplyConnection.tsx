import React from "react";
import { COEF_HAZEN } from "../utils/calcHydraulics";

const C = COEF_HAZEN;
const fmt = (v: unknown, d = 2) => v == null || Number.isNaN(Number(v)) ? "—" : Number(v).toFixed(d);

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

function Acometida({
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
  
  const inputBg = "rgba(59,130,246,0.12)"; // Azul claro
  const calcBg = "rgba(234,179,8,0.12)";   // Amarillo claro
  const resBg = "rgba(34,197,94,0.15)";    // Verde claro
  
  return (
    <div className="card">
      <div className="card-h">
        <h3 className="card-t"><img src="/iconos_diseno_redes/general/Acometida.webp" alt="" width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}} loading="lazy" /> Acometida</h3>
      </div>
      <div className="scroll-top" style={{ padding: "16px" }}>
        <div className="scroll-inner" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", alignItems: "stretch", minWidth: "900px" }}>
          
          {/* SECTION 1: Esquema de Flujo Hidráulico & Tabla Tramos */}
          <div style={{ display: "flex", flexDirection: "column", border: "1px solid var(--line)", borderRadius: "var(--r)", overflow: "hidden", background: "var(--bg)" }}>
            <div className="card-h" style={{ padding: "8px 12px", borderBottom: "1px solid var(--line)", background: "var(--bg2)" }}>
              <h4 style={{ fontSize: 11, fontWeight: 700, color: "var(--txt)", margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>1. Flujo Hidráulico y Tramos</h4>
            </div>
            
            <div style={{ padding: "12px", borderBottom: "1px solid var(--line)" }}>
              {/* Text Diagram */}
              <div style={{fontFamily: "monospace", fontSize: 9, lineHeight: 1.4, color: "var(--txt2)", background: "var(--bg3)", padding: "8px", borderRadius: "4px", border: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                <span style={{fontWeight: 700, color: "var(--txt)"}}>RED PÚBLICA</span>
                <span style={{color: "var(--txt3)"}}>→</span>
                <span style={{fontWeight: 700, color: "var(--txt)"}}>CONTADOR</span>
                <span style={{color: "var(--txt3)"}}>→</span>
                <span style={{fontWeight: 700, color: "var(--txt)"}}>MONTANTE</span>
                <span style={{color: "var(--txt3)"}}>→</span>
                <span style={{fontWeight: 700, color: "var(--txt)"}}>RED INTERNA</span>
              </div>
            </div>

            {/* Tramos Table */}
            <table className="tbl" style={{ fontSize: 10, width: "100%", tableLayout: "auto", borderBottom: "none" }}>
              <thead>
                <tr>
                  <th className="col-h" style={{textAlign:"center", padding: "4px"}}>Tramo</th>
                  <th className="col-h" style={{textAlign:"center", padding: "4px"}}>Desde</th>
                  <th className="col-h" style={{textAlign:"center", padding: "4px"}}>Hasta</th>
                  <th className="col-h" style={{textAlign:"center", padding: "4px", width: 35}}>L.H</th>
                  <th className="col-h" style={{textAlign:"center", padding: "4px", width: 35}}>L.V</th>
                  <th className="col-h" style={{textAlign:"center", padding: "4px", width: 35}}>L.Eq</th>
                  <th className="col-h" style={{textAlign:"center", padding: "4px"}}>Ø</th>
                  <th className="col-h" style={{textAlign:"center", padding: "4px"}}>Q</th>
                  <th className="col-h" style={{textAlign:"center", padding: "4px"}}>Hf</th>
                </tr>
              </thead>
              <tbody>
                {/* ACOM-01 */}
                <tr>
                  <td className="c" style={{fontWeight: 600, padding: "2px 4px"}}>AC-01</td>
                  <td className="c" style={{padding: "2px 4px"}}>Red Pública</td>
                  <td className="c" style={{padding: "2px 4px"}}>Contador</td>
                  <td className="c" style={{padding: "1px"}}><input type="number" step={0.01} aria-label="Longitud horizontal ACOM-01" value={acoL1.h} onChange={e=>setAcoL1(s=>({...s,h:parseFloat(e.target.value)||0}))} className="ni" style={{width: "100%", textAlign: "center", fontSize: 10, padding: 2}} /></td>
                  <td className="c" style={{padding: "1px"}}><input type="number" step={0.01} aria-label="Longitud vertical ACOM-01" value={acoL1.v} onChange={e=>setAcoL1(s=>({...s,v:parseFloat(e.target.value)||0}))} className="ni" style={{width: "100%", textAlign: "center", fontSize: 10, padding: 2}} /></td>
                  <td className="c" style={{padding: "1px"}}><input type="number" step={0.01} aria-label="Longitud equivalente ACOM-01" value={acoL1.le} onChange={e=>setAcoL1(s=>({...s,le:parseFloat(e.target.value)||0}))} className="ni" style={{width: "100%", textAlign: "center", fontSize: 10, padding: 2}} /></td>
                  <td className="c" style={{padding: "1px"}}>
                    <select aria-label="Diámetro ACOM-01" value={acoRedContDiam || ''} onChange={e => setAcoRedContDiam(parseFloat(e.target.value) || 0)} style={{fontSize: 10, padding: "1px", background: "transparent", border: "1px solid var(--line)", borderRadius: 2, width: "100%", cursor: "pointer"}}>
                      <option value="">—</option>
                      {AF_DIAM_OPTS.map(o => <option key={o.pulg} value={o.pulg}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className="c" style={{fontWeight: 600, padding: "2px 4px", textAlign: "center", color: "var(--txt2)"}}>{fmt(Qaco)}</td>
                  <td className="c" style={{fontWeight: 600, padding: "2px 4px", textAlign: "center", color: "var(--txt2)"}}>{fmt(f1.hfM)}</td>
                </tr>
                {/* ACOM-02 */}
                <tr>
                  <td className="c" style={{fontWeight: 600, padding: "2px 4px"}}>AC-02</td>
                  <td className="c" style={{padding: "2px 4px"}}>Contador</td>
                  <td className="c" style={{padding: "1px"}}>
                    <input aria-label="Nombre montante" value={acoMonName} onChange={e=>setAcoMonName(e.target.value)} className="ni" style={{fontSize: 10, padding: "2px"}} placeholder="Mont..." />
                  </td>
                  <td className="c" style={{padding: "1px"}}><input type="number" step={0.01} aria-label="Longitud horizontal ACOM-02" value={acoL2.h} onChange={e=>setAcoL2(s=>({...s,h:parseFloat(e.target.value)||0}))} className="ni" style={{width: "100%", textAlign: "center", fontSize: 10, padding: 2}} /></td>
                  <td className="c" style={{padding: "1px"}}><input type="number" step={0.01} aria-label="Longitud vertical ACOM-02" value={acoL2.v} onChange={e=>setAcoL2(s=>({...s,v:parseFloat(e.target.value)||0}))} className="ni" style={{width: "100%", textAlign: "center", fontSize: 10, padding: 2}} /></td>
                  <td className="c" style={{padding: "1px"}}><input type="number" step={0.01} aria-label="Longitud equivalente ACOM-02" value={acoL2.le} onChange={e=>setAcoL2(s=>({...s,le:parseFloat(e.target.value)||0}))} className="ni" style={{width: "100%", textAlign: "center", fontSize: 10, padding: 2}} /></td>
                  <td className="c" style={{padding: "1px"}}>
                    <select aria-label="Diámetro ACOM-02" value={acoContMonDiam || ''} onChange={e => setAcoContMonDiam(parseFloat(e.target.value) || 0)} style={{fontSize: 10, padding: "1px", background: "transparent", border: "1px solid var(--line)", borderRadius: 2, width: "100%", cursor: "pointer"}}>
                      <option value="">—</option>
                      {AF_DIAM_OPTS.map(o => <option key={o.pulg} value={o.pulg}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className="c" style={{fontWeight: 600, padding: "2px 4px", textAlign: "center", color: "var(--txt2)"}}>{fmt(Qaco)}</td>
                  <td className="c" style={{fontWeight: 600, padding: "2px 4px", textAlign: "center", color: "var(--txt2)"}}>{fmt(f2.hfM)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* SECTION 2: Tabla Resumen Acometida */}
          <div style={{ display: "flex", flexDirection: "column", border: "1px solid var(--line)", borderRadius: "var(--r)", overflow: "hidden", background: "var(--bg)" }}>
            <div className="card-h" style={{ padding: "8px 12px", borderBottom: "1px solid var(--line)", background: "var(--bg2)" }}>
              <h4 style={{ fontSize: 11, fontWeight: 700, color: "var(--txt)", margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>2. Resumen de Parámetros</h4>
            </div>
            
            <table className="tbl" style={{ fontSize: 10, width: "100%", borderBottom: "none" }}>
              <thead>
                <tr>
                  <th className="col-h" style={{textAlign:"center", padding: "4px"}}>Parámetro</th>
                  <th className="col-h" style={{textAlign:"center", padding: "4px"}}>AC-01</th>
                  <th className="col-h" style={{textAlign:"center", padding: "4px"}}>AC-02</th>
                  <th className="col-h" style={{textAlign:"center", padding: "4px"}}>Unidad</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{padding: "4px", textAlign: "left", fontWeight: 600}}>Caudal (Q)</td>
                  <td className="c" colSpan={2} style={{textAlign: "center", color: "var(--txt2)", fontWeight: 600, padding: "4px"}}>{fmt(Qaco)}</td>
                  <td className="c" style={{textAlign: "center", color: "var(--txt3)", padding: "4px"}}>l/s</td>
                </tr>
                <tr>
                  <td style={{padding: "4px", textAlign: "left", fontWeight: 600}}>Diámetro int.</td>
                  <td className="c" style={{textAlign: "center", color: "var(--txt2)", fontWeight: 600, padding: "4px"}}>{fmt(f1.dInt)}</td>
                  <td className="c" style={{textAlign: "center", color: "var(--txt2)", fontWeight: 600, padding: "4px"}}>{fmt(f2.dInt)}</td>
                  <td className="c" style={{textAlign: "center", color: "var(--txt3)", padding: "4px"}}>mm</td>
                </tr>
                <tr>
                  <td style={{padding: "4px", textAlign: "left", fontWeight: 600}}>Velocidad</td>
                  <td className="c" style={{textAlign: "center", fontWeight: 600, padding: "4px", color: f1.V > 2.5 ? "var(--err)" : "var(--txt2)"}}>{fmt(f1.V)}</td>
                  <td className="c" style={{textAlign: "center", fontWeight: 600, padding: "4px", color: f2.V > 2.5 ? "var(--err)" : "var(--txt2)"}}>{fmt(f2.V)}</td>
                  <td className="c" style={{textAlign: "center", color: "var(--txt3)", padding: "4px"}}>m/s</td>
                </tr>
                <tr>
                  <td style={{padding: "4px", textAlign: "left", fontWeight: 600}}>L. total eq.</td>
                  <td className="c" style={{textAlign: "center", color: "var(--txt2)", fontWeight: 600, padding: "4px"}}>{fmt(f1.Lt)}</td>
                  <td className="c" style={{textAlign: "center", color: "var(--txt2)", fontWeight: 600, padding: "4px"}}>{fmt(f2.Lt)}</td>
                  <td className="c" style={{textAlign: "center", color: "var(--txt3)", padding: "4px"}}>m</td>
                </tr>
                <tr>
                  <td style={{padding: "4px", textAlign: "left", fontWeight: 600}}>Hf (C={C})</td>
                  <td className="c" style={{textAlign: "center", color: "var(--txt2)", fontWeight: 600, padding: "4px"}}>{fmt(f1.hfM)}</td>
                  <td className="c" style={{textAlign: "center", color: "var(--txt2)", fontWeight: 600, padding: "4px"}}>{fmt(f2.hfM)}</td>
                  <td className="c" style={{textAlign: "center", color: "var(--txt3)", padding: "4px"}}>mca</td>
                </tr>
                <tr>
                  <td style={{padding: "4px", textAlign: "left", fontWeight: 600}}>P. disponible</td>
                  <td className="c" colSpan={2} style={{textAlign: "center", padding: "1px"}}>
                    <input aria-label="Presión disponible de red" type="number" step={0.1} value={acoPini} onChange={e=>setAcoPini(parseFloat(e.target.value)||0)} className="ni" style={{width: "100%", textAlign: "center", fontSize: 10, fontWeight: 700, padding: 2}} />
                  </td>
                  <td className="c" style={{textAlign: "center", color: "var(--txt3)", padding: "4px"}}>mca</td>
                </tr>
                <tr>
                  <td style={{padding: "4px", textAlign: "left", fontWeight: 600}}>P. final tramo</td>
                  <td className="c" style={{textAlign: "center", color: "var(--txt2)", fontWeight: 700, padding: "4px"}}>{fmt(f1.Pfin)}</td>
                  <td className="c" style={{textAlign: "center", color: "var(--txt2)", fontWeight: 700, padding: "4px"}}>{fmt(f2.Pfin)}</td>
                  <td className="c" style={{textAlign: "center", color: "var(--txt3)", padding: "4px"}}>mca</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* SECTION 3: Verificación Final */}
          <div style={{ display: "flex", flexDirection: "column", border: "1px solid var(--line)", borderRadius: "var(--r)", overflow: "hidden", background: "var(--bg)" }}>
            <div className="card-h" style={{ padding: "8px 12px", borderBottom: "1px solid var(--line)", background: "var(--bg2)" }}>
              <h4 style={{ fontSize: 11, fontWeight: 700, color: "var(--txt)", margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>3. Verificación</h4>
            </div>
            
            <table className="tbl" style={{ fontSize: 10, width: "100%", borderBottom: "none" }}>
              <thead>
                <tr>
                  <th className="col-h" style={{textAlign:"center", padding: "4px"}}>Parámetro</th>
                  <th className="col-h" style={{textAlign:"center", padding: "4px"}}>Valor / Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{fontWeight: 600, padding: "6px 8px", textAlign: "left"}}>P. disponible</td>
                  <td style={{textAlign: "right", padding: "6px 8px", color: "var(--txt2)", fontFamily: "var(--mono)"}}>{fmt(acoPini)} <span style={{fontSize: 8, color: "var(--txt3)"}}>mca</span></td>
                </tr>
                <tr>
                  <td style={{fontWeight: 600, padding: "6px 8px", textAlign: "left"}}>P. requerida</td>
                  <td style={{textAlign: "right", color: "var(--txt3)", padding: "6px 8px", fontFamily: "var(--mono)"}}>— <span style={{fontSize: 8}}>(Pte)</span></td>
                </tr>
                <tr>
                  <td style={{fontWeight: 600, padding: "6px 8px", textAlign: "left"}}>P. residual final</td>
                  <td style={{textAlign: "right", fontWeight: 700, padding: "6px 8px", color: "var(--txt2)", fontFamily: "var(--mono)"}}>{fmt(pResidual)} <span style={{fontSize: 8, color: "var(--txt3)"}}>mca</span></td>
                </tr>
                <tr>
                  <td style={{fontWeight: 700, padding: "8px", textAlign: "left"}}>ESTADO</td>
                  <td style={{textAlign: "center", fontWeight: 800, background: okPresion ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: okPresion ? "var(--succ)" : "var(--err)", padding: "8px", letterSpacing: 0.5}}>
                    {okPresion ? "O.K." : "NO CUMPLE"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
}
export default React.memo(Acometida);