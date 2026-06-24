import { useState, type ReactNode, type Key } from "react";
import { useProject } from "../../context/ProjectContext";
import { FILTROS_NORM, CRIT0 } from "../../constants";
import { TabBtn, FilterBtn } from "./shared";
import { SECCIONES } from "./regulationsData";
import { NTC1500 } from "./sections/NTC1500";
import { RAS2000 } from "./sections/RAS2000";
import { NTC3728 } from "./sections/NTC3728";
import { NSR10 } from "./sections/NSR10";
import { NFPA13 } from "./sections/NFPA13";
import { NTC3096 } from "./sections/NTC3096";
import { TablasRef } from "./sections/TablasRef";

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
    <div role="tablist" style={{ display: "flex", gap: 8, paddingBottom: 4, borderBottom: "1px solid var(--line)" }}>
      <TabBtn id="tab-referencias" active={vista === "referencias"} onClick={() => setVista("referencias")}>Referencias normativas</TabBtn>
      <TabBtn id="tab-criterios" active={vista === "criterios"} onClick={() => setVista("criterios")}>Criterios de diseño</TabBtn>
    </div>
  );

  if (vista === "criterios") {
    const critVisibles = critFil === 'todos' ? crits : crits.filter(x => x.red === critFil);
    return (
      <div className="fu norm-tab" role="tabpanel" aria-labelledby="tab-criterios" style={{ display:"flex", flexDirection:"column", gap:8, flex:1, minHeight:0 }}>
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
                <input className="ni" aria-label="Nombre del parámetro" style={{ width:'100%', textAlign:'left', fontWeight:600, fontSize:12 }}
                  value={cr.param}
                  onChange={e => { const v=e.target.value; setCrits(p => p.map(x => x.id===cr.id ? {...x, param:v} : x)); }} />
                <input className="ni" aria-label="Valor del parámetro" style={{ width:75, fontWeight:700, fontSize:12 }}
                  value={cr.val}
                  onChange={e => { const v=e.target.value; setCrits(p => p.map(x => x.id===cr.id ? {...x, val:v} : x)); }} />
                <input className="ni" aria-label="Unidad del parámetro" style={{ width:56, fontSize:10 }}
                  value={cr.uni}
                  onChange={e => { const v=e.target.value; setCrits(p => p.map(x => x.id===cr.id ? {...x, uni:v} : x)); }} />
                <button className="btn-del" style={{ padding:'3px 10px', fontSize:11 }} onClick={() => setCrits(p => p.filter(x => x.id !== cr.id))}>✕</button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, padding:'10px 14px' }}>
                <div style={{ marginBottom:0 }}>
                  <label style={{ display:'block', fontSize:11, fontWeight:500, marginBottom:2 }}>Norma · Artículo</label>
                  <div style={{ display:'flex', gap:5 }}>
                    <input className="ni" aria-label="Norma" style={{ flex:1, textAlign:'left', fontSize:10 }}
                      value={cr.norma}
                      onChange={e => { const v=e.target.value; setCrits(p => p.map(x => x.id===cr.id ? {...x, norma:v} : x)); }} />
                    <input className="ni" aria-label="Artículo" style={{ width:75, textAlign:'center', fontSize:10 }}
                      value={cr.art}
                      onChange={e => { const v=e.target.value; setCrits(p => p.map(x => x.id===cr.id ? {...x, art:v} : x)); }} />
                  </div>
                </div>
                <div style={{ marginBottom:0 }}>
                  <label style={{ display:'block', fontSize:11, fontWeight:500, marginBottom:2 }}>Evidencia de cumplimiento</label>
                  <input className="ni" aria-label="Evidencia de cumplimiento" style={{ width:'100%', textAlign:'left', fontSize:11 }}
                    value={cr.cumple}
                    onChange={e => { const v=e.target.value; setCrits(p => p.map(x => x.id===cr.id ? {...x, cumple:v} : x)); }} />
                </div>
                <div style={{ marginBottom:0, gridColumn:'1 / -1' }}>
                  <label style={{ display:'block', fontSize:11, fontWeight:500, marginBottom:2 }}>Observación técnica</label>
                  <input className="ni" aria-label="Observación técnica" style={{ width:'100%', textAlign:'left', fontSize:11, fontStyle:'italic' }}
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
    <div className="fu norm-tab" role="tabpanel" aria-labelledby="tab-referencias" style={{ display:"flex", flexDirection:"column", gap:0, flex:1, minHeight:0 }}>
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

interface NormaCardProps {
  key?: Key;
  id: string;
  titulo: string;
  subt: string;
  isOpen: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
}

function NormaCard({ id, titulo, subt, isOpen, onToggle, children }: NormaCardProps) {
  return (
    <div className={`card${isOpen ? ' sec-open' : ''}`}
      style={{ borderTop: '1px solid var(--line)', borderRadius: 0 }}>
      <button className="card-h" onClick={() => onToggle(id)}
        aria-expanded={isOpen} aria-controls={`reg-card-content-${id}`}
        style={{
          cursor: "pointer", userSelect: "none", width: '100%',
          border: 'none', background: 'transparent', font: 'inherit', color: 'inherit',
          textAlign: 'inherit',
        }}>
        <div>
          <h3 className="card-t" style={{ fontSize: 15, color: 'var(--txt)' }}>{titulo}</h3>
          <span className="td-mono" style={{ display:"block", fontSize:11, marginTop:2 }}>{subt}</span>
        </div>
        <span style={{ fontSize:14 }}>{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className="card-body-wrap" id={`reg-card-content-${id}`}>
          {children}
        </div>
      )}
    </div>
  );
}