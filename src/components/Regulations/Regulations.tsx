import { useState, type ReactNode } from "react";
import { useProject } from "../../context/ProjectContext";
import { FILTROS_NORM, CRIT0 } from "../../constants";
import NormaCard from "./RegulationCard";
import {
  SECCIONES,
  NTC1500_DOTACIONES, NTC1500_UC, NTC1500_HAZEN_C, NTC1500_VELOCIDADES,
  NTC1500_UD, NTC1500_PENDIENTES, NTC1500_CAPACIDAD, NTC1500_VENTILACION,
  RAS2000_DOTACIONES, RAS2000_VELOCIDADES, RAS2000_LLENADO, RAS2000_ESCORRENTIA, RAS2000_TR,
  NTC3728_PRESIONES, NTC3728_SIMULTANEIDAD, NTC3728_CAUDALES,
  NSR10_CLASIFICACION, NSR10_ALTURA,
  NFPA13_RIESGOS, NFPA13_DENSIDADES, NFPA13_ROCIADORES,
  NTC3096_PARAMS,
  TABLAS_PRESION, TABLAS_CAUDALES, TABLAS_CRITERIOS, TABLAS_ALTITUDES,
} from "./regulationsData";

export default function Normativa() {
  const [filtro, setFiltro] = useState("todos");
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});
  const [vista, setVista] = useState("referencias");

  const { crits, setCrits } = useProject();
  const [critFil, setCritFil] = useState('todos');

  const secFiltradas = SECCIONES.filter((s) => {
    if (filtro === "todos") return true;
    return (s.redes as readonly string[]).includes(filtro);
  });

  const toggleSeccion = (id: string) => {
    setAbiertas(prev => ({...prev, [id]: !prev[id]}));
  };

  const localCSS = `.norm-tab{overflow-y:auto!important;flex:1!important;min-height:0!important;gap:0!important}.norm-tab>.card{flex:none!important;overflow:visible!important;min-height:auto!important}.norm-tab>.card.sec-open>.card-body-wrap{overflow:visible!important}`;

  const tabsRow = (
    <div style={{ display: "flex", gap: 8, paddingBottom: 4, borderBottom: "1px solid var(--line)" }}>
      <TabBtn active={vista === "referencias"} onClick={() => setVista("referencias")}>Referencias normativas</TabBtn>
      <TabBtn active={vista === "criterios"} onClick={() => setVista("criterios")}>Criterios de diseño</TabBtn>
    </div>
  );

  if (vista === "criterios") {
    const critVisibles = critFil === 'todos' ? crits : crits.filter(x => x.red === critFil);
    return (
      <div className="fu norm-tab" style={{ display:"flex", flexDirection:"column", gap:8, flex:1, minHeight:0 }}>
        <style>{localCSS}</style>
        {tabsRow}

        <div className="card" style={{ flexShrink: 0 }}>
          <div className="ch" style={{ padding: "12px 16px" }}>
            <span className="ct-t" style={{ fontSize: 14 }}>§ Criterios de diseño — tabla editable</span>
            <span className="ct-s" style={{ fontSize: 10 }}>NTC 1500:2020 · RAS 2000 · NTC 3728 · NFPA 13:2022</span>
          </div>
          <div className="cb" style={{ padding: "10px 14px" }}>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', paddingBottom:10 }}>
              {FILTROS_NORM.map(f => (
                <FilterBtn key={f.k} active={critFil === f.k} onClick={() => setCritFil(f.k)}>{f.l}</FilterBtn>
              ))}
              <div style={{ flex:1, minWidth:8 }} />
              <button className="btn-ok" style={{ padding:'5px 12px', fontSize:11 }}
                onClick={() => setCrits(p => [...p, {
                  id:'c'+Date.now(), red: critFil === 'todos' ? 'af' : critFil,
                  param:'Nuevo criterio', val:'0', uni:'—', norma:'Norma', art:'§',
                  cumple:'Descripción', nota:'Observación',
                }])}
              >+ Agregar</button>
              <button className="btn-g" style={{ padding:'5px 12px', fontSize:11 }}
                onClick={() => { if (window.confirm('¿Restaurar valores por defecto?')) setCrits(CRIT0); }}
              >↺ Restaurar</button>
            </div>
          </div>
        </div>

        {critVisibles.length === 0 && (
          <div className="ib info"><span>ℹ</span><span>No hay criterios para esta red.</span></div>
        )}
        <div style={{ flex:1, minHeight:0, overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
          {critVisibles.map(cr => (
            <div key={cr.id} className="card" style={{ flexShrink: 0 }}>
              <div className="card-b" style={{
                display:'grid', gridTemplateColumns:'1fr auto auto auto',
                gap:8, padding:'10px 14px',
                alignItems:'center', borderBottom:'1px solid var(--line)',
              }}>
                <input className="ni" style={{ width:'100%', textAlign:'left', fontWeight:600, fontSize:12 }}
                  value={cr.param}
                  onChange={e => { const v=e.target.value; setCrits(p => p.map(x => x.id===cr.id ? {...x, param:v} : x)); }} />
                <input className="ni" style={{ width:75, fontWeight:700, fontSize:12 }}
                  value={cr.val}
                  onChange={e => { const v=e.target.value; setCrits(p => p.map(x => x.id===cr.id ? {...x, val:v} : x)); }} />
                <input className="ni" style={{ width:56, fontSize:10 }}
                  value={cr.uni}
                  onChange={e => { const v=e.target.value; setCrits(p => p.map(x => x.id===cr.id ? {...x, uni:v} : x)); }} />
                <button className="btn-del" style={{ padding:'3px 10px', fontSize:11 }} onClick={() => setCrits(p => p.filter(x => x.id !== cr.id))}>✕</button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, padding:'10px 14px' }}>
                <div style={{ marginBottom:0 }}>
                  <label style={{ display:'block', fontSize:11, fontWeight:500, marginBottom:2 }}>Norma · Artículo</label>
                  <div style={{ display:'flex', gap:5 }}>
                    <input className="ni" style={{ flex:1, textAlign:'left', fontSize:10 }}
                      value={cr.norma}
                      onChange={e => { const v=e.target.value; setCrits(p => p.map(x => x.id===cr.id ? {...x, norma:v} : x)); }} />
                    <input className="ni" style={{ width:75, textAlign:'center', fontSize:10 }}
                      value={cr.art}
                      onChange={e => { const v=e.target.value; setCrits(p => p.map(x => x.id===cr.id ? {...x, art:v} : x)); }} />
                  </div>
                </div>
                <div style={{ marginBottom:0 }}>
                  <label style={{ display:'block', fontSize:11, fontWeight:500, marginBottom:2 }}>Evidencia de cumplimiento</label>
                  <input className="ni" style={{ width:'100%', textAlign:'left', fontSize:11 }}
                    value={cr.cumple}
                    onChange={e => { const v=e.target.value; setCrits(p => p.map(x => x.id===cr.id ? {...x, cumple:v} : x)); }} />
                </div>
                <div style={{ marginBottom:0, gridColumn:'1 / -1' }}>
                  <label style={{ display:'block', fontSize:11, fontWeight:500, marginBottom:2 }}>Observación técnica</label>
                  <input className="ni" style={{ width:'100%', textAlign:'left', fontSize:11, fontStyle:'italic' }}
                    value={cr.nota}
                    onChange={e => { const v=e.target.value; setCrits(p => p.map(x => x.id===cr.id ? {...x, nota:v} : x)); }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fu norm-tab" style={{ display:"flex", flexDirection:"column", gap:0, flex:1, minHeight:0 }}>
      <style>{localCSS}</style>
      {tabsRow}

      <div style={{
        display: "flex", gap: 6, flexWrap: "wrap", padding: "12px 14px",
        background: "var(--bg2)", border: "1px solid var(--line)", borderRadius: "var(--r2)",
        marginBottom: 2, flexShrink: 0,
      }}>
        {FILTROS_NORM.map(f => (
          <FilterBtn key={f.k} active={filtro === f.k} onClick={() => setFiltro(f.k)}>{f.l}</FilterBtn>
        ))}
      </div>

      {secFiltradas.length === 0 && (
        <div className="ib info"><span>ℹ</span><span>Seleccione una red para ver su normativa aplicable.</span></div>
      )}

      {secFiltradas.map((sec) => (
        <NormaCard
          key={sec.id}
          id={sec.id}
          titulo={sec.titulo}
          subt={sec.subt}
          isOpen={!!abiertas[sec.id]}
          onToggle={toggleSeccion}
        >
          <ContenidoSeccion id={sec.id} />
        </NormaCard>
      ))}
    </div>
  );
}

function ContenidoSeccion({ id }: { id: string }) {
  switch (id) {
    case "ntc1500":
      return <NTC1500 />;
    case "ras2000":
      return <RAS2000 />;
    case "ntc3728":
      return <NTC3728 />;
    case "nsr10":
      return <NSR10 />;
    case "nfpa13":
      return <NFPA13 />;
    case "ntc3096":
      return <NTC3096 />;
    case "tablas":
      return <TablasRef />;
    default:
      return null;
  }
}

const h4 = {
  fontFamily: "var(--mono)",
  fontSize: 15,
  fontWeight: 600,
  color: "var(--txt)",
  margin: "16px 0 10px 0",
  letterSpacing: "0.3px",
};

function NTC1500() {
  return (
    <div className="card-b" style={{ padding: "18px" }}>
      <h4 style={h4}>1.1 Dotaciones de diseño (§4)</h4>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Uso</th>
            <th>Dotación mínima</th>
            <th>Dotación máxima</th>
          </tr>
        </thead>
        <tbody>
          {NTC1500_DOTACIONES.map(([uso, min, max]) => (
            <tr key={uso}>
              <td style={{ fontWeight: 500 }}>{uso}</td>
              <td className="c">{min}</td>
              <td className="c">{max}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={h4}>1.2 Unidades de consumo UC (Tabla 1 — §5)</h4>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Aparato</th>
            <th>Sigla</th>
            <th>UC AF</th>
            <th>UC AC</th>
            <th>P mín (mca)</th>
            <th>P máx (mca)</th>
          </tr>
        </thead>
        <tbody>
          {NTC1500_UC.map(([nom, sig, uca, ucac, pmin, pmax]) => (
            <tr key={nom}>
              <td style={{ fontWeight: 500 }}>{nom}</td>
              <td><span className="sigla">{sig}</span></td>
              <td className="c">{uca}</td>
              <td className="c">{ucac}</td>
              <td className="c">{pmin}</td>
              <td className="c">{pmax}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={h4}>1.4 Cálculo hidráulico — Hazen-Williams (§5.4)</h4>
      <div className="ib info" style={{ fontSize: 14, padding: "10px 14px", color: "var(--txt)" }}>
        <span>∑</span>
        <span><b>Hf = 10.67 × L × Q¹·⁸⁵² / (C¹·⁸⁵² × D⁴·⁸⁷)</b></span>
      </div>

      <h4 style={h4}>Coeficientes C de Hazen-Williams</h4>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Material</th>
            <th>C</th>
          </tr>
        </thead>
        <tbody>
          {NTC1500_HAZEN_C.map(([m, c]) => (
            <tr key={m}>
              <td style={{ fontWeight: 500 }}>{m}</td>
              <td className="c">{c}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={h4}>Velocidades permisibles</h4>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Condición</th>
            <th>Velocidad</th>
          </tr>
        </thead>
        <tbody>
          {NTC1500_VELOCIDADES.map(([c, v]) => (
            <tr key={c}>
              <td style={{ fontWeight: 500 }}>{c}</td>
              <td className="c">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={h4}>1.7 Unidades de Desagüe UD (Tabla 2 — §8)</h4>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Aparato</th>
            <th>UD</th>
            <th>D mín ramal</th>
            <th>D mín bajante</th>
          </tr>
        </thead>
        <tbody>
          {NTC1500_UD.map(([nom, ud, ramal, baj]) => (
            <tr key={nom}>
              <td style={{ fontWeight: 500 }}>{nom}</td>
              <td className="c">{ud}</td>
              <td className="c">{ramal}</td>
              <td className="c">{baj}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={h4}>1.8 Pendientes mínimas (§8.3)</h4>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Diámetro</th>
            <th>Pendiente mínima</th>
            <th>Pendiente recomendada</th>
          </tr>
        </thead>
        <tbody>
          {NTC1500_PENDIENTES.map(([d, min, rec]) => (
            <tr key={d}>
              <td className="c" style={{ fontWeight: 500 }}>{d}</td>
              <td className="c">{min}</td>
              <td className="c">{rec}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ib warn" style={{ fontSize: 11, padding: "8px 12px", marginTop: 6 }}>
        <span>⚠</span>
        <span>NTC 1500 permite S = 1% para D ≥ 2" con justificación hidráulica.</span>
      </div>

      <h4 style={h4}>1.9 Capacidad máxima de desagüe por diámetro (Tabla 3 — §8.4)</h4>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>D (pulg)</th>
            <th>UD máx ramal horizontal</th>
            <th>UD máx bajante 1 piso</th>
            <th>UD máx bajante ≥ 3 pisos</th>
          </tr>
        </thead>
        <tbody>
          {NTC1500_CAPACIDAD.map(([d, rh, b1, b3]) => (
            <tr key={d}>
              <td className="c" style={{ fontWeight: 500 }}>{d}"</td>
              <td className="c">{rh}</td>
              <td className="c">{b1}</td>
              <td className="c">{b3}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={h4}>1.10 Ventilación (§9)</h4>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Parámetro</th>
            <th>Valor</th>
            <th>Artículo</th>
          </tr>
        </thead>
        <tbody>
          {NTC1500_VENTILACION.map(([p, v, a]) => (
            <tr key={p}>
              <td style={{ fontWeight: 500 }}>{p}</td>
              <td className="c">{v}</td>
              <td className="c">{a}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RAS2000() {
  return (
    <div className="card-b" style={{ padding: "18px" }}>
      <h4 style={h4}>2.1 Dotaciones por nivel de complejidad (Tabla B.2.1)</h4>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Nivel de complejidad</th>
            <th>Dotación neta mínima</th>
            <th>Dotación neta máxima</th>
          </tr>
        </thead>
        <tbody>
          {RAS2000_DOTACIONES.map(([n, min, max]) => (
            <tr key={n}>
              <td style={{ fontWeight: 500 }}>{n}</td>
              <td className="c">{min}</td>
              <td className="c">{max}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={h4}>2.3 Ecuación de Manning (§D.4.3)</h4>
      <div className="ib info" style={{ fontSize: 14, padding: "10px 14px", color: "var(--txt)" }}>
        <span>∑</span>
        <span><b>V = (1/n) × R²⸍³ × S¹⸍² &nbsp;·&nbsp; Q = V × A</b></span>
      </div>

      <h4 style={h4}>Velocidades en tuberías sanitarias</h4>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Condición</th>
            <th>Velocidad</th>
          </tr>
        </thead>
        <tbody>
          {RAS2000_VELOCIDADES.map(([c, v]) => (
            <tr key={c}>
              <td style={{ fontWeight: 500 }}>{c}</td>
              <td className="c">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={h4}>Llenado máximo de la sección</h4>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Condición</th>
            <th>y/D</th>
          </tr>
        </thead>
        <tbody>
          {RAS2000_LLENADO.map(([c, v]) => (
            <tr key={c}>
              <td style={{ fontWeight: 500 }}>{c}</td>
              <td className="c">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={h4}>2.5 Aguas lluvias — Método Racional (§D.2)</h4>
      <div className="ib info" style={{ fontSize: 14, padding: "10px 14px", color: "var(--txt)" }}>
        <span>∑</span>
        <span><b>Q = C × I × A / 360.000</b> &nbsp;—&nbsp; Válido para A &lt; 2 km²</span>
      </div>

      <h4 style={h4}>Coeficientes de escorrentía C (Tabla D.2.1)</h4>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Superficie</th>
            <th>C mínimo</th>
            <th>C máximo</th>
          </tr>
        </thead>
        <tbody>
          {RAS2000_ESCORRENTIA.map(([sup, cmin, cmax]) => (
            <tr key={sup}>
              <td style={{ fontWeight: 500 }}>{sup}</td>
              <td className="c">{cmin}</td>
              <td className="c">{cmax}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={h4}>Períodos de retorno Tr (Tabla D.2.2)</h4>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Tipo de proyecto</th>
            <th>Tr (años)</th>
          </tr>
        </thead>
        <tbody>
          {RAS2000_TR.map(([t, tr]) => (
            <tr key={t}>
              <td style={{ fontWeight: 500 }}>{t}</td>
              <td className="c">{tr}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NTC3728() {
  return (
    <div className="card-b" style={{ padding: "18px" }}>
      <h4 style={h4}>3.1 Presiones de diseño (§4)</h4>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Tipo de red</th>
            <th>Presión mínima</th>
            <th>Presión máxima</th>
          </tr>
        </thead>
        <tbody>
          {NTC3728_PRESIONES.map(([t, min, max]) => (
            <tr key={t}>
              <td style={{ fontWeight: 500 }}>{t}</td>
              <td className="c">{min}</td>
              <td className="c">{max}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={h4}>3.2 Ecuación de Renouard (§6.2)</h4>
      <div className="ib info" style={{ fontSize: 14, padding: "10px 14px", color: "var(--txt)" }}>
        <span>∑</span>
        <span><b>ΔP = 48620 × K × L × Q¹·⁸² / (P_at × Di⁴·⁸²)</b></span>
      </div>

      <h4 style={h4}>Velocidad máxima: V ≤ 10 m/s</h4>

      <h4 style={h4}>3.5 Factores de simultaneidad fs (§5.3)</h4>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>N° aparatos (n)</th>
            <th>fs</th>
          </tr>
        </thead>
        <tbody>
          {NTC3728_SIMULTANEIDAD.map(([n, fs]) => (
            <tr key={n}>
              <td className="c">{n}</td>
              <td className="c">{fs}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ib info" style={{ fontSize: 13, padding: "8px 12px", marginTop: 6, color: "var(--txt)" }}>
        <span>ℹ</span>
        <span>Q_diseño = Q_instalado × fs</span>
      </div>

      <h4 style={h4}>3.6 Caudales de aparatos a gas (Tabla 1 — §5.2)</h4>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Aparato</th>
            <th>Q (m³/hr)</th>
          </tr>
        </thead>
        <tbody>
          {NTC3728_CAUDALES.map(([a, q]) => (
            <tr key={a}>
              <td style={{ fontWeight: 500 }}>{a}</td>
              <td className="c">{q}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NSR10() {
  return (
    <div className="card-b" style={{ padding: "18px" }}>
      <h4 style={h4}>4.1 Clasificación por tipo de ocupación (J.2)</h4>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Clasificación</th>
            <th>Ejemplos</th>
          </tr>
        </thead>
        <tbody>
          {NSR10_CLASIFICACION.map(([t, c, e]) => (
            <tr key={t}>
              <td className="c" style={{ fontWeight: 600 }}>{t}</td>
              <td>{c}</td>
              <td>{e}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={h4}>4.2 Requisitos según altura y ocupación (J.4)</h4>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Altura edificación</th>
            <th>Tipo A</th>
            <th>Tipo B</th>
            <th>Tipo C</th>
          </tr>
        </thead>
        <tbody>
          {NSR10_ALTURA.map(([h, a, b, c]) => (
            <tr key={h}>
              <td style={{ fontWeight: 500 }}>{h}</td>
              <td className="c">{a}</td>
              <td className="c">{b}</td>
              <td className="c">{c}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NFPA13() {
  return (
    <div className="card-b" style={{ padding: "18px" }}>
      <h4 style={h4}>5.1 Clasificación de riesgos (§5.2)</h4>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Grupo</th>
            <th>Descripción</th>
            <th>Ejemplos</th>
          </tr>
        </thead>
        <tbody>
          {NFPA13_RIESGOS.map(([g, d, e]) => (
            <tr key={g}>
              <td style={{ fontWeight: 500 }}>{g}</td>
              <td>{d}</td>
              <td>{e}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={h4}>5.2 Densidades y áreas de operación (§11.2.3)</h4>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Clasificación</th>
            <th>Densidad (gpm/pie²)</th>
            <th>Área operación (m²)</th>
          </tr>
        </thead>
        <tbody>
          {NFPA13_DENSIDADES.map(([c, d, a]) => (
            <tr key={c}>
              <td style={{ fontWeight: 500 }}>{c}</td>
              <td className="c">{d}</td>
              <td className="c">{a}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={h4}>5.3 Rociadores (§7)</h4>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Parámetro</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          {NFPA13_ROCIADORES.map(([p, v]) => (
            <tr key={p}>
              <td style={{ fontWeight: 500 }}>{p}</td>
              <td className="c">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NTC3096() {
  return (
    <div className="card-b" style={{ padding: "18px" }}>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Parámetro</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          {NTC3096_PARAMS.map(([p, v]) => (
            <tr key={p}>
              <td style={{ fontWeight: 500 }}>{p}</td>
              <td className="c">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ib info" style={{ fontSize: 13, padding: "8px 12px", marginTop: 8, color: "var(--txt)" }}>
        <span>ℹ</span>
        <span>CPVC RDE 11: relación D externo / espesor = 11</span>
      </div>
    </div>
  );
}

function TablasRef() {
  return (
    <div className="card-b" style={{ padding: "18px" }}>
      <h4 style={h4}>7.1 Conversión de unidades de presión</h4>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Unidad</th>
            <th>mca</th>
            <th>bar</th>
            <th>PSI</th>
            <th>kPa</th>
            <th>mbar</th>
          </tr>
        </thead>
        <tbody>
          {TABLAS_PRESION.map(([u, mca, bar, psi, kpa, mbar]) => (
            <tr key={u}>
              <td style={{ fontWeight: 600 }}>{u}</td>
              <td className="c">{mca}</td>
              <td className="c">{bar}</td>
              <td className="c">{psi}</td>
              <td className="c">{kpa}</td>
              <td className="c">{mbar}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={h4}>7.2 Conversión de caudales</h4>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Unidad</th>
            <th>lps</th>
            <th>lpm</th>
            <th>m³/hr</th>
            <th>gpm</th>
          </tr>
        </thead>
        <tbody>
          {TABLAS_CAUDALES.map(([u, lps, lpm, m3h, gpm]) => (
            <tr key={u}>
              <td style={{ fontWeight: 600 }}>{u}</td>
              <td className="c">{lps}</td>
              <td className="c">{lpm}</td>
              <td className="c">{m3h}</td>
              <td className="c">{gpm}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={h4}>7.3 Resumen de criterios críticos por red</h4>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Red</th>
            <th>Parámetro</th>
            <th>Criterio</th>
            <th>Norma</th>
          </tr>
        </thead>
        <tbody>
          {TABLAS_CRITERIOS.map(([red, param, crit, norm], i) => {
            const col =
              red === "AF / AC"
                ? "var(--acc2)"
                : red === "SAN"
                ? "var(--san)"
                : red === "LL"
                ? "var(--ll)"
                : red === "GAS"
                ? "var(--gas)"
                : red === "VEN"
                ? "var(--txt3)"
                : "#F87171";
            return (
              <tr key={i}>
                <td>
                  <span
                    className="td-mono"
                    style={{
                      color: col,
                      fontWeight: 600,
                      fontSize: 10,
                    }}
                  >
                    {red}
                  </span>
                </td>
                <td style={{ fontWeight: 500 }}>{param}</td>
                <td className="c">{crit}</td>
                <td className="c td-mono" style={{ fontSize: 10 }}>
                  {norm}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h4 style={h4}>7.4 Altitudes y presiones atmosféricas</h4>
      <table className="tbl" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Ciudad</th>
            <th>Altitud (msnm)</th>
            <th>P atm (kPa)</th>
            <th>Densidad GN (kg/m³)</th>
          </tr>
        </thead>
        <tbody>
          {TABLAS_ALTITUDES.map(([ciudad, alt, patm, den]) => (
            <tr key={ciudad}>
              <td style={{ fontWeight: 500 }}>{ciudad}</td>
              <td className="c">{alt}</td>
              <td className="c">{patm}</td>
              <td className="c">{den}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children?: ReactNode; key?: any }) {
  return (
    <button onClick={onClick}
      style={{
        flex: 1, padding: "14px 18px", borderRadius: "var(--r)",
        border: "1px solid", cursor: "pointer", fontSize: 15,
        fontFamily: "var(--body)", fontWeight: active ? 700 : 400,
        borderColor: active ? "var(--acc2)" : "var(--line)",
        background: active ? "var(--bg3)" : "transparent", transition: "all .15s",
      }}
    >{children}</button>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children?: ReactNode; key?: any }) {
  return (
    <button onClick={onClick}
      style={{
        flex: 1, padding: "12px 16px", borderRadius: "var(--r)",
        border: "1px solid", cursor: "pointer", fontSize: 14,
        fontWeight: active ? 600 : 400,
        borderColor: active ? "var(--acc2)" : "var(--line)",
        background: active ? "rgba(27,110,243,.08)" : "transparent",
        transition: "all .15s",
      }}
    >{children}</button>
  );
}
