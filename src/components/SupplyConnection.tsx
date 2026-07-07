import React from "react";
import { COEF_HAZEN } from "../constants/hydraulicData";
import { fmt } from "../utils/formatUtils";
import { CONTADORES as CONTADORES_CAT } from "../pages/catalog/catalogData";

const C = COEF_HAZEN;

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
  dn?: string;
  q?: number;
}

interface DiamOpt {
  pulg: number;
  label: string;
  dInt: number;
  nominal?: string;
}

interface AcometidaProps {
  Qaco: number;
  contadorSel: ContadorSel;
  acoContIx: number;
  setAcoContIx: (ix: number) => void;
  acoMonName: string;
  setAcoMonName: (name: string) => void;
  acoRedContDiam: string;
  acoContMonDiam: string;
  acoL1: LData;
  setAcoL1: (fn: (s: LData) => LData) => void;
  acoL2: LData;
  setAcoL2: (fn: (s: LData) => LData) => void;
  acoPini: number;
  setAcoPini: (p: number) => void;
  acoHfMax: number;
  setAcoHfMax: (v: number) => void;
  acoLeMed: number;
  setAcoLeMed: (le: number) => void;
  f1: FilaResult;
  f2: FilaResult;
  hfContador: number;
  pResidual: number;
  okPresion: boolean;
  AF_DIAM_OPTS: DiamOpt[];
  isTr1Drawn?: boolean;
  isTr2Drawn?: boolean;
  onContDiamChange?: (val: string) => void;
}

const SECTION_COL: React.CSSProperties = { display: "flex", flexDirection: "column", border: "1px solid var(--line)", borderRadius: "var(--r)", overflow: "hidden", background: "var(--bg)" };
const SECTION_HDR: React.CSSProperties = { padding: "8px 12px", borderBottom: "1px solid var(--line)", background: "var(--bg2)" };
const SECTION_H4: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--txt)", margin: 0, textTransform: "uppercase", letterSpacing: 0.5 };
const TH_CENTER: React.CSSProperties = { textAlign: "center", padding: "4px" };
const TD_PARAM_LABEL: React.CSSProperties = { padding: "4px", textAlign: "left", fontWeight: 600 };
const TD_PARAM_VALUE: React.CSSProperties = { textAlign: "center", color: "var(--txt2)", fontWeight: 600, padding: "4px" };
const TD_PARAM_UNIT: React.CSSProperties = { textAlign: "center", color: "var(--txt3)", padding: "4px" };
const SCROLL_INNER: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "stretch", paddingBottom: "16px" };

function LazyNum({ value, onChange, ariaLabel, style, className }: any) {
  const [val, setVal] = React.useState(value?.toString() || "");
  const [prevValue, setPrevValue] = React.useState(value);

  if (value !== prevValue) {
    setPrevValue(value);
    if (parseFloat(val) !== value && !(val === "" && value === 0)) {
      setVal(value?.toString() || "0");
    }
  }
  return (
    <input 
      type="number" 
      step={0.01} 
      aria-label={ariaLabel} 
      className={className} 
      style={style} 
      value={val} 
      onChange={e => setVal(e.target.value)} 
      onBlur={() => { 
        const p = parseFloat(val); 
        if (isNaN(p)) {
          setVal("0");
          onChange(0);
        } else {
          onChange(p);
        }
      }} 
    />
  );
}

function Acometida({
  Qaco,
  contadorSel,
  hfContador,
  acoMonName, setAcoMonName,
  acoRedContDiam,
  acoContMonDiam,
  acoL1, setAcoL1,
  acoL2, setAcoL2,
  acoPini, setAcoPini,
  acoHfMax, setAcoHfMax,
  f1, f2,
  pResidual, okPresion,
  AF_DIAM_OPTS,
  isTr1Drawn = false,
  isTr2Drawn = false,
  onContDiamChange,
  acoContIx,
  setAcoContIx,
}: AcometidaProps) {

  return (
    <section className="card">
      <div className="card-h">
        <h3 className="card-t"><img src="/iconos_diseno_redes/general/Acometida.svg" alt="Acometida" width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}} loading="lazy" /> Acometida</h3>
      </div>
      <div className="scroll-top" style={{ padding: "16px" }}>
        <div className="scroll-inner" style={SCROLL_INNER}>
          
          {/* SECTION 1: Esquema de Flujo Hidráulico & Tabla Tramos */}
          <div style={{...SECTION_COL, flex: "16 1 440px"}}>
            <div className="card-h" style={SECTION_HDR}>
              <h4 style={SECTION_H4}>1. Flujo Hidráulico y Tramos</h4>
            </div>
            
            <div style={{ padding: "12px", borderBottom: "1px solid var(--line)" }}>
              {/* Text Diagram */}
              <div style={{fontFamily: "monospace", fontSize: 9, lineHeight: 1.4, color: "var(--txt2)", background: "var(--bg3)", padding: "8px", borderRadius: "4px", border: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                <span style={{fontWeight: 700, color: "var(--txt)"}}>RED PÚBLICA</span>
                <span style={{color: "var(--txt3)"}}>→</span>
                <span style={{fontWeight: 700, color: "var(--txt)"}}>CONTADOR</span>
                <span style={{color: "var(--txt3)"}}>→</span>
                <span style={{fontWeight: 700, color: "var(--txt)"}}>RED INTERNA</span>
              </div>
            </div>

            {/* Tramos Table */}
            <table className="tbl" style={{ fontSize: 11, width: "100%", tableLayout: "fixed", borderBottom: "none" }}>
              <thead>
                <tr>
                  <th scope="col" className="col-h" rowSpan={2} style={{...TH_CENTER, width: "10%"}}>Tramo</th>
                  <th scope="col" className="col-h" rowSpan={2} style={{...TH_CENTER, width: "16%"}}>Desde</th>
                  <th scope="col" className="col-h" rowSpan={2} style={{...TH_CENTER, width: "16%"}}>Hasta</th>
                  <th scope="colgroup" className="col-h" colSpan={2} style={{...TH_CENTER, fontSize: 10, width: "26%"}}>Longitud (m)</th>
                  <th scope="col" className="col-h" rowSpan={2} style={{...TH_CENTER, width: "16%"}}>Diámetro<br/>Estimado</th>
                  <th scope="col" className="col-h" rowSpan={2} style={{...TH_CENTER, width: "16%"}}>Diámetro<br/>Propuesto</th>
                </tr>
                <tr>
                  <th scope="col" className="col-h" style={{...TH_CENTER, fontSize: 9, fontWeight: 405, width: "13%"}}>Horizontal</th>
                  <th scope="col" className="col-h" style={{...TH_CENTER, fontSize: 9, fontWeight: 405, width: "13%"}}>Eq. Accesorios</th>
                </tr> 
              </thead>
              <tbody>
                {/* ACOM-01 */}
                <tr>
                  <td className="c" style={{fontWeight: 600, padding: "2px 4px"}}>AC-01</td>
                  <td className="c" style={{padding: "2px 4px"}}>Red Pública</td>
                  <td className="c" style={{padding: "2px 4px"}}>Contador</td>
                  <td className="c" style={{padding: "1px"}}>
                    <LazyNum ariaLabel="Longitud horizontal ACOM-01" value={acoL1.h} onChange={(v: number)=>setAcoL1(s=>({...s,h:v}))} className="ni" style={{width: "100%", textAlign: "center", fontSize: 11, padding: 2}} />
                  </td>
                  <td className="c" style={{padding: "1px"}}>
                    {isTr1Drawn ? (
                      <span style={{fontFamily: "var(--mono)", fontSize: 11, color: "var(--txt2)"}}>{fmt(acoL1.le, 2)}</span>
                    ) : (
                      <LazyNum ariaLabel="Longitud equivalente ACOM-01" value={acoL1.le} onChange={(v: number)=>setAcoL1(s=>({...s,le:v}))} className="ni" style={{width: "100%", textAlign: "center", fontSize: 11, padding: 2}} />
                    )}
                  </td>
                  <td className="c" style={{fontFamily: "var(--mono)", fontSize: 11, color: "var(--txt2)"}}>{Qaco > 0 ? fmt(Math.sqrt(Qaco), 2) : "—"}</td>
                  <td className="c" style={{padding: "4px 8px", fontFamily: "var(--mono)", fontSize: 11, color: "var(--txt2)"}}>
                    {AF_DIAM_OPTS.find(o => o.nominal === acoRedContDiam)?.label || acoRedContDiam || "—"}
                  </td>
                </tr>
                {/* ACOM-02 */}
                <tr>
                  <td className="c" style={{fontWeight: 600, padding: "2px 4px", borderBottom: "1px solid var(--line)"}}>AC-02</td>
                  <td className="c" style={{padding: "2px 4px", borderBottom: "1px solid var(--line)"}}>Contador</td>
                  <td className="c" style={{padding: "1px", borderBottom: "1px solid var(--line)"}}>
                    {isTr2Drawn ? (
                      <span style={{fontFamily: "var(--mono)", fontSize: 11, color: "var(--txt2)"}}>{acoMonName || '—'}</span>
                    ) : (
                      <input aria-label="Nombre montante" value={acoMonName} onChange={e=>setAcoMonName(e.target.value)} className="ni" style={{fontSize: 11, padding: "2px"}} placeholder="Mont..." />
                    )}
                  </td>
                  <td className="c" style={{padding: "1px", borderBottom: "1px solid var(--line)"}}>
                    {isTr2Drawn ? (
                      <span style={{fontFamily: "var(--mono)", fontSize: 11, color: "var(--txt2)"}}>{fmt(acoL2.h, 2)}</span>
                    ) : (
                      <LazyNum ariaLabel="Longitud horizontal ACOM-02" value={acoL2.h} onChange={(v: number)=>setAcoL2(s=>({...s,h:v}))} className="ni" style={{width: "100%", textAlign: "center", fontSize: 11, padding: 2}} />
                    )}
                  </td>
                  <td className="c" style={{padding: "1px", borderBottom: "1px solid var(--line)"}}>
                    {isTr2Drawn ? (
                      <span style={{fontFamily: "var(--mono)", fontSize: 11, color: "var(--txt2)"}}>{fmt(acoL2.le, 2)}</span>
                    ) : (
                      <LazyNum ariaLabel="Longitud equivalente ACOM-02" value={acoL2.le} onChange={(v: number)=>setAcoL2(s=>({...s,le:v}))} className="ni" style={{width: "100%", textAlign: "center", fontSize: 11, padding: 2}} />
                    )}
                  </td>
                  <td className="c" style={{fontFamily: "var(--mono)", fontSize: 11, color: "var(--txt2)", borderBottom: "1px solid var(--line)"}}>{Qaco > 0 ? fmt(Math.sqrt(Qaco), 2) : "—"}</td>
                  <td className="c" style={{padding: "4px 8px", fontFamily: "var(--mono)", fontSize: 11, color: "var(--txt2)", borderBottom: "1px solid var(--line)"}}>
                    {AF_DIAM_OPTS.find(o => o.nominal === acoContMonDiam)?.label || acoContMonDiam || "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* SECTION 2: Parámetros y Constantes */}
          <div style={{...SECTION_COL, flex: "8 1 240px"}}>
            <div className="card-h" style={SECTION_HDR}>
              <h4 style={SECTION_H4}>2. Resumen de Parámetros</h4>
            </div>
            
            <table className="tbl" style={{ fontSize: 11, width: "100%", tableLayout: "fixed", borderBottom: "none" }}>
              <thead>
                <tr>
                  <th scope="col" className="col-h" style={{ ...TH_CENTER, width: "45%" }}>Parámetro</th>
                  <th scope="col" className="col-h" style={{ ...TH_CENTER, width: "20%" }}>AC-01</th>
                  <th scope="col" className="col-h" style={{ ...TH_CENTER, width: "20%" }}>AC-02</th>
                  <th scope="col" className="col-h" style={{ ...TH_CENTER, width: "15%" }}>Unidad</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={TD_PARAM_LABEL}>Caudal (Q)</td>
                  <td className="c" style={TD_PARAM_VALUE}>{fmt(Qaco)}</td>
                  <td className="c" style={TD_PARAM_VALUE}>{fmt(Qaco)}</td>
                  <td className="c" style={TD_PARAM_UNIT}>l/s</td>
                </tr>
                <tr>
                  <td style={TD_PARAM_LABEL}>Diámetro interior</td>
                  <td className="c" style={TD_PARAM_VALUE}>{fmt(f1.dInt)}</td>
                  <td className="c" style={TD_PARAM_VALUE}>{fmt(f2.dInt)}</td>
                  <td className="c" style={TD_PARAM_UNIT}>mm</td>
                </tr>
                <tr>
                  <td style={TD_PARAM_LABEL}>Velocidad</td>
                  <td className="c" style={{textAlign: "center", fontWeight: 600, padding: "4px", color: f1.V > 2500 ? "var(--err)" : "var(--txt2)"}}>{fmt(f1.V, 1)}</td>
                  <td className="c" style={{textAlign: "center", fontWeight: 600, padding: "4px", color: f2.V > 2500 ? "var(--err)" : "var(--txt2)"}}>{fmt(f2.V, 1)}</td>
                  <td className="c" style={TD_PARAM_UNIT}>mm/s</td>
                </tr>
                <tr>
                  <td style={TD_PARAM_LABEL}>Longitud total</td>
                  <td className="c" style={TD_PARAM_VALUE}>{fmt(f1.Lt)}</td>
                  <td className="c" style={TD_PARAM_VALUE}>{fmt(f2.Lt)}</td>
                  <td className="c" style={TD_PARAM_UNIT}>m</td>
                </tr>
                <tr>
                  <td style={TD_PARAM_LABEL}>Pérdidas por fricción (%)</td>
                  <td className="c" style={TD_PARAM_VALUE}>{fmt(f1.hfPct)}</td>
                  <td className="c" style={TD_PARAM_VALUE}>{fmt(f2.hfPct)}</td>
                  <td className="c" style={TD_PARAM_UNIT}>%</td>
                </tr>
                <tr>
                  <td style={TD_PARAM_LABEL}>Pérdidas por fricción (m)</td>
                  <td className="c" style={TD_PARAM_VALUE}>{fmt(f1.hfM)}</td>
                  <td className="c" style={TD_PARAM_VALUE}>{fmt(f2.hfM)}</td>
                  <td className="c" style={TD_PARAM_UNIT}>mca</td>
                </tr>
                <tr>
                  <td style={TD_PARAM_LABEL}>Coeficiente C</td>
                  <td className="c" colSpan={2} style={{textAlign: "center", fontWeight: 600, padding: "4px", color: "var(--txt2)"}}>{C}</td>
                  <td className="c" style={TD_PARAM_UNIT}>—</td>
                </tr>
                <tr>
                  <td style={TD_PARAM_LABEL}>Diámetro del contador</td>
                  <td className="c" colSpan={2} style={{textAlign: "center", padding: "2px"}}>
                    <select value={acoContIx} onChange={e => {
                      const i = parseInt(e.target.value);
                      setAcoContIx(i);
                      if (onContDiamChange && CONTADORES_CAT[i]) {
                        onContDiamChange(`${CONTADORES_CAT[i].dn}"`);
                      }
                    }}
                      style={{width:"100%",padding:"3px 4px",border:"1px solid #3a494a",borderRadius:3,background:"#1e2024",color:"#e2e2e8",fontSize:11,fontFamily:"'Geist',monospace",cursor:"pointer",textAlign:"center",textAlignLast:"center"}}>
                      {CONTADORES_CAT.map((c, i) => (
                        <option key={i} value={i}>{c.dn}</option>
                      ))}
                    </select>
                  </td>
                  <td className="c" style={TD_PARAM_UNIT}>pulg</td>
                </tr>
                <tr>
                  <td style={{...TD_PARAM_LABEL, borderBottom: "1px solid var(--line)"}}>Caudal nominal (Qn)</td>
                  <td className="c" colSpan={2} style={{textAlign: "center", fontWeight: 600, padding: "4px", color: "var(--txt2)", borderBottom: "1px solid var(--line)"}}>{fmt(contadorSel.q || 0)}</td>
                  <td className="c" style={{...TD_PARAM_UNIT, borderBottom: "1px solid var(--line)"}}>L/s</td>
                </tr>

              </tbody>
            </table>
          </div>

          {/* SECTION 3: Verificación Final */}
          <div style={{...SECTION_COL, flex: "8 1 240px"}}>
            <div className="card-h" style={SECTION_HDR}>
              <h4 style={SECTION_H4}>3. Verificación</h4>
            </div>
            
            <table className="tbl" style={{ fontSize: 10, width: "100%", tableLayout: "fixed", borderBottom: "none" }}>
              <thead>
                <tr>
                  <th scope="col" className="col-h" style={{ ...TH_CENTER, width: "55%" }}>Parámetro</th>
                  <th scope="col" className="col-h" style={{ ...TH_CENTER, width: "45%" }}>Valor / Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{fontWeight: 600, padding: "6px 8px", textAlign: "left"}}>AC-01 Presión Inicial</td>
                  <td style={{textAlign: "right", padding: "4px 8px"}}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", justifyContent: "flex-end", width: "100%" }}>
                      <LazyNum 
                        ariaLabel="AC-01 Presión Inicial" 
                        value={acoPini} 
                        onChange={(v: number)=>setAcoPini(v)} 
                        className="ni" 
                        style={{width: "60px", textAlign: "center", fontSize: 11, fontWeight: 700, padding: "2px 4px"}} 
                      />
                      <span style={{fontSize: 9, color: "var(--txt3)", fontFamily: "var(--mono)"}}>mca</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style={{fontWeight: 600, padding: "6px 8px", textAlign: "left"}}>AC-01 Presión Final</td>
                  <td style={{textAlign: "right", fontWeight: 700, padding: "6px 8px", color: "var(--txt2)", fontFamily: "var(--mono)"}}>{fmt(f1.Pfin)} <span style={{fontSize: 9, color: "var(--txt3)"}}>mca</span></td>
                </tr>
                <tr>
                  <td style={{fontWeight: 600, padding: "6px 8px", textAlign: "left"}}>AC-02 Presión Inicial</td>
                  <td style={{textAlign: "right", fontWeight: 700, padding: "6px 8px", color: "var(--txt2)", fontFamily: "var(--mono)"}}>{fmt(f1.Pfin)} <span style={{fontSize: 9, color: "var(--txt3)"}}>mca</span></td>
                </tr>
                <tr>
                  <td style={{fontWeight: 600, padding: "6px 8px", textAlign: "left"}}>AC-02 Presión Final</td>
                  <td style={{textAlign: "right", fontWeight: 700, padding: "6px 8px", color: "var(--txt2)", fontFamily: "var(--mono)"}}>{fmt(f2.Pfin)} <span style={{fontSize: 9, color: "var(--txt3)"}}>mca</span></td>
                </tr>
                <tr>
                  <td style={{fontWeight: 600, padding: "6px 8px", textAlign: "left"}}>Pérdidas en contador &le; Pérdidas máximas</td>
                  <td style={{textAlign: "right", padding: "4px 8px"}}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", justifyContent: "flex-end", width: "100%" }}>
                      <span style={{fontFamily: "var(--mono)", fontWeight: 700, color: hfContador <= acoHfMax ? "var(--succ)" : "var(--err)"}}>{fmt(hfContador)}</span>
                      <span style={{fontSize: 11, color: "var(--txt3)"}}>&le;</span>
                      <LazyNum 
                        ariaLabel="Hf max permitida contador" 
                        value={acoHfMax} 
                        onChange={(v: number)=>setAcoHfMax(v)} 
                        className="ni" 
                        style={{width: "44px", textAlign: "center", fontSize: 11, fontWeight: 700, padding: "2px"}} 
                      />
                      <span style={{fontSize: 9, color: "var(--txt3)", fontFamily: "var(--mono)"}}>mca</span>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style={{fontWeight: 600, padding: "6px 8px", textAlign: "left"}}>Diámetro acometida vs Contador</td>
                  <td style={{textAlign: "right", padding: "6px 8px", fontWeight: 700, fontFamily: "var(--mono)"}}>
                    {(() => {
                      const getDiamVal = (valStr: string) => {
                        if (!valStr) return 0;
                        if (valStr.includes('1/2')) return 0.5;
                        if (valStr.includes('3/4')) return 0.75;
                        if (valStr.includes('1 1/4')) return 1.25;
                        if (valStr.includes('1 1/2')) return 1.5;
                        const match = valStr.match(/(\d+)\/(\d+)/);
                        if (match) return parseInt(match[1]) / parseInt(match[2]);
                        const num = parseFloat(valStr.replace(/[^0-9.]/g, ''));
                        return isNaN(num) ? 0 : num;
                      };
                      const dValAco = getDiamVal(acoRedContDiam);
                      const dValCont = getDiamVal(contadorSel.dn || '0');
                      const diff = dValAco - dValCont;
                      const ok = diff <= 0.5;
                      return (
                        <span style={{ color: ok ? "var(--succ)" : "var(--warn)" }}>
                          {ok ? "✓ Conforme" : `⚠️ +${diff.toFixed(2)}"`}
                        </span>
                      );
                    })()}
                  </td>
                </tr>

                <tr>
                  <td style={{fontWeight: 600, padding: "6px 8px", textAlign: "left"}}>Presión residual final</td>
                  <td style={{textAlign: "right", fontWeight: 700, padding: "6px 8px", color: "var(--txt2)", fontFamily: "var(--mono)"}}>{fmt(pResidual)} <span style={{fontSize: 9, color: "var(--txt3)"}}>mca</span></td>
                </tr>
                <tr>
                  <td style={{fontWeight: 700, padding: "4px 8px", textAlign: "left", borderBottom: "1px solid var(--line)"}}>ESTADO</td>
                  <td style={{textAlign: "center", fontWeight: 800, background: okPresion && hfContador <= acoHfMax ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: okPresion && hfContador <= acoHfMax ? "var(--succ)" : "var(--err)", padding: "4px", letterSpacing: 0.5, borderBottom: "1px solid var(--line)"}}>
                    {okPresion && hfContador <= acoHfMax ? "O.K." : "NO CUMPLE"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </section>
  );
}
export default React.memo(Acometida);