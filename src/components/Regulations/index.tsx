import { useState, type ReactNode } from "react";
import { useProject } from "../../context/ProjectContext";
import { FILTROS_NORM, CRIT0 } from "../../constants";
import NormaCard from "./RegulationCard";

const SECCIONES = [
  {
    id: "ntc1500",
    titulo: "1. NTC 1500:2020",
    subt: "Código Colombiano de Fontanería",
    redes: ["af", "ac", "san"],
  },
  {
    id: "ras2000",
    titulo: "2. RAS 2000",
    subt: "Reglamento Técnico del Sector de Agua Potable y Saneamiento Básico — Título D",
    redes: ["san", "ll"],
  },
  {
    id: "ntc3728",
    titulo: "3. NTC 3728:2014",
    subt: "Instalaciones para suministro de gas domiciliario — Baja presión",
    redes: ["gas"],
  },
  {
    id: "nsr10",
    titulo: "4. NSR-10 Título J",
    subt: "Requisitos de Protección Contra Incendio en Edificaciones",
    redes: ["rci"],
  },
  {
    id: "nfpa13",
    titulo: "5. NFPA 13:2022",
    subt: "Standard for the Installation of Sprinkler Systems",
    redes: ["rci"],
  },
  {
    id: "ntc3096",
    titulo: "6. NTC 3096",
    subt: "Sistemas de tuberías plásticas — CPVC para conducción de fluidos a presión",
    redes: ["af", "ac"],
  },
  {
    id: "tablas",
    titulo: "7. Tablas de Referencia Rápida",
    subt: "Conversiones · Criterios críticos · Altitudes",
    redes: ["todos"],
  },
];

export default function Normativa() {
  const [filtro, setFiltro] = useState("todos");
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});
  const [vista, setVista] = useState("referencias");

  const { crits, setCrits } = useProject();
  const [critFil, setCritFil] = useState('todos');

  const secFiltradas = SECCIONES.filter((s) => {
    if (filtro === "todos") return true;
    return s.redes.includes(filtro);
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

        {/* Cabecera con filtros de criterios */}
        <div className="card" style={{ flexShrink: 0 }}>
          <div className="ch" style={{ padding: "12px 16px" }}>
            <span className="ct-t" style={{ fontSize: 14 }}>§ Criterios de diseño — tabla editable</span>
            <span className="ct-s" style={{ fontSize: 10 }}>NTC 1500:2020 · RAS 2000 · NTC 3728 · NFPA 13:2022</span>
          </div>
          <div className="cb" style={{ padding: "10px 14px" }}>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'stretch', paddingBottom:10 }}>
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

        {/* Tarjetas de criterio */}
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

      {/* Filtro */}
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

      {/* Secciones */}
      {secFiltradas.map((sec) => (
        // @ts-expect-error TSX parser limitation in large file
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
          {[
            ["Vivienda estrato 1–2", "200 L/hab/día", "250 L/hab/día"],
            ["Vivienda estrato 3–4", "220 L/hab/día", "280 L/hab/día"],
            ["Vivienda estrato 5–6", "250 L/hab/día", "350 L/hab/día"],
            ["Comercial oficinas", "20 L/m²/día", "30 L/m²/día"],
            ["Comercial restaurante", "80 L/puesto/día", "120 L/puesto/día"],
            ["Industria ligera", "30 L/m²/día", "50 L/m²/día"],
            ["Educativo", "40 L/alumno/día", "60 L/alumno/día"],
            ["Hospitalario", "600 L/cama/día", "1200 L/cama/día"],
            ["Hoteles", "300 L/habitación/día", "500 L/habitación/día"],
          ].map(([uso, min, max]) => (
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
          {[
            ["Lavamanos", "Lvm", 0.5, 0.5, 0.51, 5.63],
            ["Inodoro", "San", 2.2, "—", 0.71, 14.1],
            ["Sanitario fluxómetro", "San-F", 5.0, "—", 1.05, 14.1],
            ["Ducha", "Duc", 1.0, 1.0, 1.02, 5.63],
            ["Tina / bañera", "Tin", 1.0, 1.0, 0.51, 14.1],
            ["Lavaplatos doméstico", "Lvp", 1.0, 1.0, 0.51, 5.63],
            ["Lavadero", "Lvro", 0.75, 0.75, 0.51, 5.63],
            ["Lavadora doméstica", "Lvra", 1.0, "—", 0.51, 5.63],
            ["Orinal (sifón)", "Or", 0.5, "—", 0.51, 5.63],
            ["Orinal (fluxómetro)", "Or-F", 3.0, "—", 1.05, 14.1],
            ["Vertedero", "Vert", 0.5, "—", 0.51, 5.63],
            ["Bebedero", "Beb", 0.5, "—", 0.51, 5.63],
          ].map(([nom, sig, uca, ucac, pmin, pmax]) => (
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
      <div className="ib info" style={{ fontSize: 12, padding: "10px 14px" }}>
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
          {[
            ["PVC presión (nuevo)", 150],
            ["CPVC RDE 11 (nuevo)", 150],
            ["Cobre rígido (nuevo)", 140],
            ["PP-R (nuevo)", 140],
            ["Hierro galvanizado", 120],
            ["Acero comercial", 120],
            ["Fierro fundido", 100],
          ].map(([m, c]) => (
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
          {[
            ["Mínima (evitar sedimentación)", "0,50 m/s"],
            ["Máxima recomendada", "2,50 m/s"],
            ["Máxima absoluta", "3,00 m/s"],
          ].map(([c, v]) => (
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
          {[
            ["Lavamanos", 2, "1½\"", "2\""],
            ["Sanitario con sifón", 4, "3\"", "3\""],
            ["Sanitario fluxómetro", 6, "3\"", "3\""],
            ["Ducha", 2, "1½\"", "2\""],
            ["Tina / bañera", 2, "1½\"", "2\""],
            ["Lavaplatos", 2, "1½\"", "2\""],
            ["Lavadero", 2, "1½\"", "2\""],
            ["Lavadora", 4, "2\"", "2\""],
            ["Orinal sifón", 2, "1½\"", "2\""],
            ["Vertedero", 3, "2\"", "2\""],
            ["Piso-sumidero 2\"", 1, "2\"", "2\""],
            ["Piso-sumidero 3\"", 2, "3\"", "3\""],
            ["Piso-sumidero 4\"", 3, "4\"", "4\""],
          ].map(([nom, ud, ramal, baj]) => (
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
          {[
            ["1½\" y 2\"", "2,0%", "2,5%"],
            ["3\"", "1,0%", "2,0%"],
            ["4\"", "1,0%", "1,5%"],
            ["6\"", "0,5%", "1,0%"],
            ["≥ 8\"", "0,3%", "0,5%"],
          ].map(([d, min, rec]) => (
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
          {[
            ["1½", 3, 4, 8],
            ["2", 6, 10, 24],
            ["2½", 12, 20, 42],
            ["3", 20, 30, 60],
            ["4", 160, 240, 500],
            ["6", 620, 960, 1900],
            ["8", 1400, 2200, 3600],
          ].map(([d, rh, b1, b3]) => (
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
          {[
            ["Diámetro mínimo tubería ventilación", "1½\"", "§9.2"],
            ["D mín no menor que", "Mitad del D ramal", "§9.2"],
            ["Prolongación sobre cubierta", "≥ 0,30 m", "§9.4"],
            ["Cuello de ganso obligatorio", "Sí", "§9.4"],
            ["Re-ventilación máx 1½\"", "1,20 m", "§9.5"],
            ["Re-ventilación máx 2\"", "1,80 m", "§9.5"],
            ["Re-ventilación máx 3\"", "3,00 m", "§9.5"],
            ["Re-ventilación máx 4\"", "3,60 m", "§9.5"],
          ].map(([p, v, a]) => (
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
          {[
            ["Bajo", "100 L/hab/día", "150 L/hab/día"],
            ["Medio", "120 L/hab/día", "175 L/hab/día"],
            ["Medio alto", "150 L/hab/día", "200 L/hab/día"],
            ["Alto", "170 L/hab/día", "280 L/hab/día"],
          ].map(([n, min, max]) => (
            <tr key={n}>
              <td style={{ fontWeight: 500 }}>{n}</td>
              <td className="c">{min}</td>
              <td className="c">{max}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={h4}>2.3 Ecuación de Manning (§D.4.3)</h4>
      <div className="ib info" style={{ fontSize: 12, padding: "10px 14px" }}>
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
          {[
            ["Mínima (auto-limpieza)", "0,45 m/s"],
            ["Máxima (evitar erosión)", "4,00 m/s"],
          ].map(([c, v]) => (
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
          {[
            ["Máximo a Q diseño", "0,75"],
            ["Condición óptima", "0,60–0,70"],
          ].map(([c, v]) => (
            <tr key={c}>
              <td style={{ fontWeight: 500 }}>{c}</td>
              <td className="c">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={h4}>2.5 Aguas lluvias — Método Racional (§D.2)</h4>
      <div className="ib info" style={{ fontSize: 12, padding: "10px 14px" }}>
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
          {[
            ["Teja metálica / zinc", 0.85, 0.95],
            ["Losa concreto impermeable", 0.85, 0.95],
            ["Teja de barro / cerámica", 0.75, 0.85],
            ["Membrana asfáltica", 0.8, 0.9],
            ["Pavimento asfalto", 0.7, 0.85],
            ["Pavimento concreto", 0.7, 0.9],
            ["Grava / balasto", 0.35, 0.7],
            ["Cubierta verde extensiva", 0.2, 0.4],
            ["Jardín / zona verde", 0.1, 0.35],
            ["Piscina / espejo de agua", 1.0, 1.0],
          ].map(([sup, cmin, cmax]) => (
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
          {[
            ["Cubierta residencial", 5],
            ["Cubierta comercial", 10],
            ["Cubierta industrial", 10],
            ["Vías urbanas menores", 5],
            ["Vías urbanas principales", "10–25"],
            ["Obras de infraestructura", "25–100"],
          ].map(([t, tr]) => (
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
          {[
            ["Red baja presión (domiciliaria)", "17 mbar", "100 mbar"],
            ["Presión de operación típica", "20–25 mbar", "—"],
            ["Pérdida máxima admisible", "—", "9,81 mbar"],
          ].map(([t, min, max]) => (
            <tr key={t}>
              <td style={{ fontWeight: 500 }}>{t}</td>
              <td className="c">{min}</td>
              <td className="c">{max}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={h4}>3.2 Ecuación de Renouard (§6.2)</h4>
      <div className="ib info" style={{ fontSize: 12, padding: "10px 14px" }}>
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
          {[
            ["1–2", 1.0],
            ["3–5", 0.8],
            ["6–10", 0.7],
            ["11–20", 0.6],
            ["> 20", 0.5],
          ].map(([n, fs]) => (
            <tr key={n}>
              <td className="c">{n}</td>
              <td className="c">{fs}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ib info" style={{ fontSize: 11, padding: "8px 12px", marginTop: 6 }}>
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
          {[
            ["Quemador cocina (1 hornilla)", 0.34],
            ["Estufa 4 quemadores", 1.35],
            ["Estufa 6 quemadores", 1.8],
            ["Calentador 6 LPM", 1.11],
            ["Calentador 8 LPM", 1.4],
            ["Calentador 10 LPM", 1.98],
            ["Calentador 12 LPM", 2.32],
            ["Calentador 16 LPM", 3.0],
            ["Calentador 21 LPM", 4.35],
            ["Horno convencional", 1.15],
            ["Secadora de ropa", 1.4],
            ["Caldera residencial pequeña", 2.5],
          ].map(([a, q]) => (
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
          {[
            ["A", "Vivienda unifamiliar / bifamiliar", "Casas, apartamentos"],
            ["B", "Vivienda multifamiliar", "Edificios residenciales ≥ 3 unidades"],
            ["C", "Comercio y servicios", "Tiendas, oficinas, bancos"],
            ["D", "Industrial", "Bodegas, fábricas"],
            ["E", "Educación", "Colegios, universidades"],
            ["F", "Institucional", "Hospitales, cárceles"],
            ["G", "Alta concentración", "Estadios, teatros, culto"],
          ].map(([t, c, e]) => (
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
          {[
            ["≤ 3 pisos", "Extintor portátil", "Extintor portátil", "Red húmeda"],
            ["4–9 pisos", "Extintor", "Red húmeda", "Red húmeda + RCI"],
            ["≥ 10 pisos", "Red húmeda + RCI", "RCI completo", "RCI completo"],
          ].map(([h, a, b, c]) => (
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
          {[
            ["Riesgo leve (RL)", "Baja combustibilidad", "Vivienda, oficinas, salas, iglesias"],
            ["Riesgo ordinario G1 (RO1)", "Combustibilidad media-baja", "Parking, salas mecánicas"],
            ["Riesgo ordinario G2 (RO2)", "Combustibilidad media", "Almacenes, manufactura ligera"],
            ["Riesgo extra G1 (RE1)", "Alta combustibilidad", "Pintura, carpintería"],
            ["Riesgo extra G2 (RE2)", "Muy alta combustibilidad", "Químicos, almacenaje palets"],
          ].map(([g, d, e]) => (
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
          {[
            ["Riesgo leve", 0.1, 139.4],
            ["Riesgo ordinario G1", 0.15, 139.4],
            ["Riesgo ordinario G2", 0.2, 139.4],
            ["Riesgo extra G1", 0.3, 232.3],
            ["Riesgo extra G2", "0,40–0,60", 232.3],
          ].map(([c, d, a]) => (
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
          {[
            ["Presión mínima de operación", "7,0 PSI (4,92 mca)"],
            ["Presión máxima de operación", "175 PSI (123 mca)"],
            ["K-factor rociador QR estándar", "5,6 gpm/√PSI"],
            ["K-factor rociador QR ampliada", "8,0 gpm/√PSI"],
            ["Temperatura nominal estándar", "68°C (color rojo)"],
            ["Separación mínima entre rociadores", "1,80 m"],
            ["Separación máxima entre rociadores", "4,60 m (RL) · 4,00 m (RO)"],
            ["Distancia máxima a pared", "2,30 m (RL)"],
          ].map(([p, v]) => (
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
          {[
            ["Temperatura máxima de servicio", "93°C"],
            ["Presión máxima de servicio", "100 PSI (70 mca) a 23°C"],
            ["Coeficiente de expansión térmica", "6,3 × 10⁻⁵ m/m·°C"],
            ["C Hazen-Williams", "150"],
            ["Aislamiento térmico obligatorio", "Sí, en trayectos expuestos"],
            ["Tipo de unión", "Solvente (cemento CPVC)"],
          ].map(([p, v]) => (
            <tr key={p}>
              <td style={{ fontWeight: 500 }}>{p}</td>
              <td className="c">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ib info" style={{ fontSize: 11, padding: "8px 12px", marginTop: 8 }}>
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
          {[
            ["1 m.c.a.", 1.0, 0.0981, 1.4223, 9.807, 98.07],
            ["1 bar", 10.2, 1.0, 14.504, 100.0, 1000],
            ["1 PSI", 0.7031, 0.06895, 1.0, 6.895, 68.95],
            ["1 kPa", 0.102, 0.01, 0.145, 1.0, 10.0],
            ["1 mbar", 0.0102, 0.001, 0.0145, 0.1, 1.0],
          ].map(([u, mca, bar, psi, kpa, mbar]) => (
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
          {[
            ["1 lps", 1.0, 60.0, 3.6, 15.85],
            ["1 lpm", 0.01667, 1.0, 0.06, 0.2642],
            ["1 m³/hr", 0.2778, 16.67, 1.0, 4.403],
            ["1 gpm", 0.06309, 3.785, 0.2271, 1.0],
          ].map(([u, lps, lpm, m3h, gpm]) => (
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
          {[
            ["AF / AC", "V mínima", "≥ 0,50 m/s", "NTC 1500 §5.4"],
            ["AF / AC", "V máxima", "≤ 2,50 m/s", "NTC 1500 §5.4"],
            ["AF / AC", "P mínima inodoro", "≥ 0,71 mca", "NTC 1500 Tabla 3"],
            ["AF / AC", "P mínima ducha", "≥ 1,02 mca", "NTC 1500 Tabla 3"],
            ["AF / AC", "P mínima lavamanos", "≥ 0,51 mca", "NTC 1500 Tabla 3"],
            ["AF / AC", "P máxima cualquier punto", "≤ 14,10 mca", "NTC 1500 Tabla 3"],
            ["SAN", "V mínima (auto-limpieza)", "≥ 0,45 m/s", "RAS 2000 §D.4.3"],
            ["SAN", "V máxima", "≤ 4,00 m/s", "RAS 2000 §D.4.3"],
            ["SAN", "Llenado máximo y/D", "≤ 0,75", "RAS 2000 §D.4.3"],
            ["SAN", "Pendiente mínima D ≥ 2\"", "≥ 2,0%", "NTC 1500 §8.3"],
            ["LL", "Método", "Q = C×I×A/360.000", "RAS 2000 §D.2"],
            ["LL", "Período retorno cubierta", "Tr = 5 años", "RAS 2000 Tab. D.2.2"],
            ["GAS", "ΔP máximo acumulado", "≤ 9,81 mbar", "NTC 3728 §6.2"],
            ["GAS", "Velocidad máxima", "≤ 10 m/s", "NTC 3728 §6.3"],
            ["VEN", "D mínimo", "≥ 1½\"", "NTC 1500 §9.2"],
            ["VEN", "Prolongación sobre cubierta", "≥ 0,30 m", "NTC 1500 §9.4"],
            ["RCI", "P mínima rociador", "≥ 7,0 PSI", "NFPA 13 §7.2.1.1"],
            ["RCI", "V máxima tubería", "≤ 8,0 m/s", "NFPA 13 §28.2"],
            ["RCI", "C HW acero SCH 40", "120", "NFPA 13 §28.2.1"],
            ["RCI", "Densidad Riesgo leve", "0,10 gpm/pie²", "NFPA 13 §11.2.3.1.1"],
            ["RCI", "Duración suministro RL", "30 min", "NFPA 13 §11.2.3.1.3"],
          ].map(([red, param, crit, norm], i) => {
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
                <td className="c td-mono" style={{  fontSize: 10 }}>
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
          {[
            ["Bogotá D.C.", 2600, 74.7, 0.793],
            ["Medellín", 1495, 85.58, 0.905],
            ["Cali", 995, 90.49, 0.958],
            ["Bucaramanga", 959, 90.32, 0.956],
            ["Floridablanca", 924, 90.67, 0.96],
            ["Barranquilla", 18, 101.15, 1.071],
            ["Cúcuta", 320, 98.0, 1.038],
            ["Manizales", 2153, 79.32, 0.84],
            ["Pereira", 1411, 86.4, 0.915],
            ["Ibagué", 1285, 87.63, 0.928],
            ["Pasto", 2527, 75.43, 0.799],
            ["Cartagena", 3, 101.2, 1.072],
          ].map(([ciudad, alt, patm, den]) => (
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
        borderColor: active ? "var(--acc2)" : "var(--line2)",
        background: active ? "rgba(27,110,243,.08)" : "transparent",
        transition: "all .15s",
      }}
    >{children}</button>
  );
}

const h4 = {
  fontFamily: "var(--mono)",
  fontSize: 15,
  fontWeight: 600,
  color: "var(--acc2)",
  margin: "16px 0 10px 0",
  letterSpacing: "0.3px",
};
