import { useState, useRef, useMemo, useEffect } from "react";
import { useSanitario } from "../context/SanitarioContext";
import { usePlanos } from "../context/PlanosContext";
import { useAnalysis } from "../hooks/useAnalysis";
import AccesoriosTable from "./AccesoriosTable";
import { REDES, USOS, EMPRES, NAV_TABS, REQ_ITEMS, pisoLbl } from "./constants";
import { parseDecimalInput, parseIntInput } from "../utils/parseDecimal";
import { validateTramo } from "../utils/validateTramo";
import CalculoUD from "./UdCalculation";
import DisenosSanitarios from "./SanitaryDesign";
import BajantesTable from "./DownpipesTable";
import DisenoLluvias from "./RainwaterDesign";
import ChequeoBajantesLluvias from "./RainDownpipesCheck";
import ChequeoCanalesLluvias from "./RainChannelsCheck";
import CalculoHidraulicoLluvias from "./RainwaterHydraulicCalc";
import CalculoHidraulicoSanitario from "./SanitaryHydraulicCalc";
import CalculoUCAF from "./CalculoUCAF";
import CalculoUCAC from "./CalculoUCAC";
import DisenoRedAguaFria from "./DisenoRedAguaFria";
import DisenoRedAguaCaliente from "./DisenoRedAguaCaliente";

import DisenoUDPanel from "./UdDesignPanel";
import PanelValoresUD from "./UdValuesPanel";
import PanelBajantesLluvias from "./RainDownpipesPanel";
import PanelCanalesLluvias from "./RainChannelsPanel";
import BaseDatos from "./DesignParameters";
import Normativa from "./Normativa";

function CIVILFLOWInner(){
const { tramosSan, tramosLl, tramosAf, tramosAc, udBase, pisos, proy, setP, setPisos, updTramoAfAcc, updTramoAcAcc } = useSanitario();
const { planos, addPlanos, removePlano, updatePlano, confirmPlano } = usePlanos();

  const [tab,setTab]=useState('info');

  useEffect(() => {
    const openTab = sessionStorage.getItem('openTab');
    if (openTab) {
      setTab(openTab);
      sessionStorage.removeItem('openTab');
    }
  }, []);

const [redes,setRedes]=useState(()=>{
try {
const saved = localStorage.getItem('civilflow_active_nets');
if (saved) return new Set(JSON.parse(saved));
} catch (_) {}
return new Set(['san','ll']);
});
const redesActivas=useMemo(()=>REDES.filter(r=>redes.has(r.id)),[redes]);

  useEffect(() => {
    try {
      localStorage.setItem('civilflow_active_nets', JSON.stringify([...redes]));
      window.dispatchEvent(new CustomEvent('civilflow_nets_changed', { detail: [...redes] }));
    } catch (_) {}
  }, [redes]);
  const [redActiva,setRedActiva]=useState('san');
  const [sanPage, setSanPage] = useState(1);
  const [llPage, setLlPage] = useState(1);
  const [afPage, setAfPage] = useState(1);
  const [acPage, setAcPage] = useState(1);
const [netColors, setNetColors] = useState(() => {
  const init = {};
  REDES.forEach(r => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(`--${r.id}`).trim();
    init[r.id] = v || '#666';
  });
  return init;
});
const [planDrag,setPlanDrag]=useState(false);
const [selectedPlanId,setSelectedPlanId]=useState(null);
const selectedPlan=useMemo(()=>planos.find(p=>p.id===selectedPlanId)||null,[planos,selectedPlanId]);
const [selectedPlanUrl,setSelectedPlanUrl]=useState(null);
const pendingPlanos=useMemo(()=>planos.filter(p=>p.status==='pending'),[planos]);
const confirmedPlanos=useMemo(()=>planos.filter(p=>p.status==='confirmed'),[planos]);

const [nSotanos,setNSotanos]=useState('');
const [nPisos,setNPisos]=useState('');
const [altPiso,setAltPiso]=useState('');
const [altSotano,setAltSotano]=useState('');
const [nptPiso1,setNptPiso1]=useState('');
const [conCubierta,setConCubierta]=useState(false);

const generarPisos=()=>{
  const MAX=50;
  const nSot=Math.min(parseIntInput(nSotanos)||0,MAX);
  const nPis=Math.min(parseIntInput(nPisos)||0,MAX);
  const hPis=parseDecimalInput(altPiso)||0;
  const hSot=parseDecimalInput(altSotano)||0;
  const npt1=parseDecimalInput(nptPiso1)||0;
  const l=[];
  for(let i=nSot;i>=1;i--)
    l.push({id:'s'+i,n:-i,npt:+((npt1-(i*hSot)).toFixed(2)),ok:false,tipo:'sotano'});
  for(let i=1;i<=nPis;i++)
    l.push({id:'p'+i,n:i,npt:+((npt1+((i-1)*hPis)).toFixed(2)),ok:false,tipo:'piso'});
  if(conCubierta)
    l.push({id:'cub',n:99,npt:+((npt1+(nPis*hPis)).toFixed(2)),ok:false,tipo:'cubierta'});
  setPisos(l);
};

const onIntChange=(setter)=>(e)=>{
  const onlyDigits=e.target.value.replace(/[^\d]/g,'');
  setter(onlyDigits);
};
const onIntBlur=(setter)=>(e)=>{
  const v=parseIntInput(e.target.value);
  if(v!==null)setter(String(v));
};
const onDecChange=(setter)=>(e)=>{
  const normalized=e.target.value.replace(/,/g,'.');
  setter(normalized);
};
const onDecBlur=(setter)=>(e)=>{
  const v=parseDecimalInput(e.target.value);
  if(v!==null){
    const s=String(v);
    setter(s);
  }
};

const delPiso=(id)=>setPisos(prev=>prev.filter(p=>p.id!==id));

const addPiso=()=>setPisos(prev=>{
  const pisosPOS=prev.filter(p=>p.tipo==='piso').sort((a,b)=>b.n-a.n);
  const maxN=pisosPOS.length?Math.max(...pisosPOS.map(p=>p.n)):0;
  const hPis=parseFloat(altPiso)||0;
  const lastNpt=pisosPOS.length?parseFloat(pisosPOS[0].npt)||0:0;
  const newNpt=lastNpt>0?+((lastNpt+hPis).toFixed(2)):'';
  const newPiso={id:Date.now(),n:maxN+1,npt:newNpt,ok:false,tipo:'piso'};
  const cubIx=prev.findIndex(p=>p.tipo==='cubierta');
  const insertAt=cubIx>=0?cubIx+1:0;
  const copy=[...prev];
  copy.splice(insertAt,0,newPiso);
  return copy;
});

const addSotano=()=>setPisos(prev=>{
  const pisoNEG=prev.filter(p=>p.tipo==='sotano').sort((a,b)=>a.n-b.n);
  const minN=pisoNEG.length?Math.min(...pisoNEG.map(p=>p.n)):0;
  const hSot=parseFloat(altSotano)||0;
  const lastNpt=pisoNEG.length?parseFloat(pisoNEG[0].npt)||0:0;
  const newNpt=lastNpt<0?+((lastNpt-hSot).toFixed(2)):'';
  const newSotano={id:Date.now(),n:minN-1,npt:newNpt,ok:false,tipo:'sotano'};
  return[...prev,newSotano];
});
const { busy, meta, vals, analizar } = useAnalysis(setPisos);

useEffect(()=>{
  REDES.forEach(r=>{
    const saved = localStorage.getItem('civilflow_net_' + r.id);
    if (saved) {
      document.documentElement.style.setProperty('--' + r.id, saved);
      try {
        const nets = require('./PlanoEngine').NETS;
        const net = nets.find(n => n.id === r.id);
        if (net) net.col = saved;
      } catch(_) {}
    }
  });
},[]);

useEffect(()=>{
  if(selectedPlan){
    const url=URL.createObjectURL(selectedPlan.file);
    setSelectedPlanUrl(url);
    return ()=>{URL.revokeObjectURL(url);setSelectedPlanUrl(null)};
  }else{
    setSelectedPlanUrl(null);
  }
},[selectedPlan]);

useEffect(()=>{
  if(planos.length>0&&!planos.some(p=>p.id===selectedPlanId)){
    setSelectedPlanId(planos[0].id);
  }else if(planos.length===0){
    setSelectedPlanId(null);
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
},[planos.length]);

const fileRef=useRef();

return(
    <div style={{height:'100%',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div className="app">
        <div className="nav">{NAV_TABS.map(t=>(
          <div key={t.id} className={`ntab ${t.id==='visor'?'':tab===t.id?'on':''}`} onClick={()=>{if(t.id==='visor')window.location.href='#/visor';else setTab(t.id)}}>
            <span className="ntab-ico">{t.icoImg ? <img src={t.icoImg} alt="" style={{width:24,height:24,verticalAlign:'middle',marginRight:2}} /> : t.ico}</span>{t.l}
          </div>
        ))}</div>
        <div className="layout"><div className="content">

{/* ── Información general ── */}
{tab==='info'&&(
<div className="fu info-gral" style={{display:'flex',flexDirection:'column',gap:10,flex:1,minHeight:0,overflow:'hidden'}}>

  <div style={{display:'flex',flexDirection:'row',flexWrap:'nowrap',gap:6,flex:1,minHeight:0,overflowY:'hidden',overflowX:'auto',alignItems:'stretch'}}>

    {/* ── Project ID ── */}
    <div className="card" style={{flex:'0 1 auto',minWidth:200}}>
      <div className="card-h" style={{padding:'4px 8px'}}>
        <div style={{display:'flex',flexDirection:'column'}}>
          <span className="card-t" style={{fontSize:13}}><img src="/iconos_info_general/identificacion_del_proyecto.webp" alt="" style={{width:22,height:22,verticalAlign:'middle',marginRight:2}} />Identificación del proyecto</span>
          <span className="card-s" style={{fontSize:11}}>Datos para memorias de cálculo</span>
        </div>
      </div>
      <div style={{padding:'4px 6px'}}>
        <div className="f" style={{marginBottom:3}}><label style={{fontSize:12}}>Nombre del proyecto</label><input value={proy.nombre} onChange={e=>setP('nombre',e.target.value)} style={{fontSize:12,padding:'3px 6px'}}/></div>
        <div className="f" style={{marginBottom:3}}><label style={{fontSize:12}}>Dirección / Sector</label><input value={proy.dir} onChange={e=>setP('dir',e.target.value)} style={{fontSize:12,padding:'3px 6px'}}/></div>
        <div className="f" style={{marginBottom:3}}><label style={{fontSize:12}}>Municipio</label><input value={proy.mun} onChange={e=>setP('mun',e.target.value)} style={{fontSize:12,padding:'3px 6px'}}/></div>
        <div className="f" style={{marginBottom:3}}><label style={{fontSize:12}}>Departamento</label><input value={proy.dep} onChange={e=>setP('dep',e.target.value)} style={{fontSize:12,padding:'3px 6px'}}/></div>
        <div className="f" style={{marginBottom:3}}><label style={{fontSize:12}}>Uso</label>
          <select value={proy.uso} onChange={e=>setP('uso',e.target.value)} style={{fontSize:12,padding:'3px 6px',width:'100%'}}><option value="">—</option>{USOS.map(u=><option key={u}>{u}</option>)}</select></div>
        <div className="f" style={{marginBottom:0}}><label style={{fontSize:12}}>Empresa</label>
          <select value={proy.empresa} onChange={e=>setP('empresa',e.target.value)} style={{fontSize:12,padding:'3px 6px',width:'100%'}}><option value="">—</option>{EMPRES.map(u=><option key={u}>{u}</option>)}</select></div>
      </div>
    </div>

    {/* ── Redes activas ── */}
    <div className="card" style={{flex:'0 1 auto',minWidth:190}}>
      <div className="card-h" style={{padding:'4px 8px'}}>
        <div style={{display:'flex',flexDirection:'column'}}>
          <span className="card-t" style={{fontSize:13}}><img src="/iconos_info_general/redes_activas.webp" alt="" style={{width:22,height:22,verticalAlign:'middle',marginRight:2}} />Redes activas</span>
          <span className="card-s" style={{fontSize:11}}>{[...redes].length} de {REDES.length}</span>
        </div>
      </div>
      <div style={{padding:'4px 6px'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr',gap:2}}>
          {REDES.map(r=>{
            const on=redes.has(r.id);
            const cssVar = `--${r.id}`;
            const currentColor = netColors[r.id] || '#666';
            return(
              <div key={r.id} onClick={()=>{const n=new Set(redes);on?n.delete(r.id):n.add(r.id);setRedes(n);}}
                style={{display:'flex',alignItems:'center',gap:3,padding:'3px 5px',cursor:'pointer',
                background:on?'rgba(27,110,243,.06)':'var(--bg3)',
                border:'1px solid '+(on?'rgba(27,110,243,.35)':'var(--line)'),borderRadius:'var(--r)',transition:'all .15s'}}>
                {r.icoImg ? <img src={r.icoImg} alt="" style={{width:22,height:22,verticalAlign:'middle'}} /> : <span style={{fontSize:13}}>{r.ico}</span>}
                <span style={{fontWeight:600,fontSize:12,color:on?'var(--acc2)':'var(--txt2)',whiteSpace:'nowrap',flex:1}}>{r.lbl}</span>
                <input type="color" value={currentColor}
                  onClick={e=>e.stopPropagation()}
                  onChange={e=>{
                    const c = e.target.value;
                    setNetColors(prev => ({ ...prev, [r.id]: c }));
                    document.documentElement.style.setProperty(cssVar, c);
                    try {
                      const nets = require('./PlanoEngine').NETS;
                      const net = nets.find(n => n.id === r.id);
                      if (net) net.col = c;
                    } catch(_) {}
                    try { localStorage.setItem('civilflow_net_' + r.id, c); } catch(_) {}
                  }}
                  style={{width:14,height:14,border:'none',padding:0,cursor:'pointer',background:'none',flexShrink:0}} />
                <div style={{width:8,height:8,borderRadius:'50%',flexShrink:0,
                  background:on?currentColor:'transparent',
                  border:'1.5px solid '+(on?currentColor:'var(--txt3)')}} />
              </div>
            );
          })}
        </div>
      </div>
    </div>

    {/* ── Generador de pisos ── */}
    <div className="card" style={{flex:'0 0 auto',minWidth:0}}>
      <div className="card-h" style={{padding:'4px 8px'}}>
        <div style={{display:'flex',flexDirection:'column'}}>
          <span className="card-t" style={{fontSize:13}}><img src="/iconos_info_general/generador_de_pisos.webp" alt="" style={{width:22,height:22,verticalAlign:'middle',marginRight:2}} />Generador de pisos</span>
          <span className="card-s" style={{fontSize:11}}>Generación automática de pisos y sótanos</span>
        </div>
      </div>
      <div style={{padding:'4px 6px'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:3,alignItems:'end'}}>
          <div className="f" style={{marginBottom:0}}><label style={{fontSize:12}}>Sótanos</label><input type="text" inputMode="numeric" value={nSotanos} style={{textAlign:'center',fontSize:12,padding:'3px 5px'}} onChange={onIntChange(setNSotanos)} onBlur={onIntBlur(setNSotanos)}/></div>
          <div className="f" style={{marginBottom:0}}><label style={{fontSize:12}}>Pisos</label><input type="text" inputMode="numeric" value={nPisos} style={{textAlign:'center',fontSize:12,padding:'3px 5px'}} onChange={onIntChange(setNPisos)} onBlur={onIntBlur(setNPisos)}/></div>
          <div className="f" style={{marginBottom:0}}><label style={{fontSize:12}}>Altura entrepiso</label><input type="text" inputMode="decimal" value={altPiso} style={{textAlign:'center',fontSize:12,padding:'3px 5px'}} onChange={onDecChange(setAltPiso)} onBlur={onDecBlur(setAltPiso)}/></div>
          <div className="f" style={{marginBottom:0}}><label style={{fontSize:12}}>Altura sótano</label><input type="text" inputMode="decimal" value={altSotano} style={{textAlign:'center',fontSize:12,padding:'3px 5px'}} onChange={onDecChange(setAltSotano)} onBlur={onDecBlur(setAltSotano)}/></div>
          <div className="f" style={{marginBottom:0}}><label style={{fontSize:12}}>NPT P1</label><input type="text" inputMode="decimal" value={nptPiso1} style={{textAlign:'center',fontSize:12,padding:'3px 5px'}} onChange={onDecChange(setNptPiso1)} onBlur={onDecBlur(setNptPiso1)}/></div>
          <div style={{display:'flex',alignItems:'flex-end',justifyContent:'flex-end',paddingRight:24,paddingBottom:2}}>
            <div onClick={()=>setConCubierta(!conCubierta)} title="Incluir cubierta" style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',userSelect:'none',padding:'4px 8px',borderRadius:4,flexShrink:0}}>
              <div style={{width:28,height:15,borderRadius:8,background:conCubierta?'var(--ll)':'var(--line2)',position:'relative',transition:'background .2s',flexShrink:0}}>
                <div style={{width:11,height:11,borderRadius:'50%',background:'#fff',position:'absolute',top:2,left:conCubierta?15:2,transition:'left .2s'}} />
              </div>
              <span style={{fontFamily:'var(--mono)',fontSize:10,fontWeight:600,color:'var(--txt2)'}}>Incluir cubierta</span>
            </div>
          </div>
        </div>
        <button onClick={generarPisos} style={{width:'100%',padding:'6px',marginTop:6,background:'var(--acc)',border:'none',borderRadius:'var(--r)',color:'#fff',fontWeight:600,fontSize:12,cursor:'pointer'}}>Generar niveles automáticamente</button>
      </div>
    </div>

    {/* ── Niveles generados ── */}
    <div className="card" style={{flex:'1 1 auto',minWidth:220,display:'flex',flexDirection:'column'}}>
      <div className="card-h" style={{padding:'4px 8px',flexShrink:0}}>
        <div style={{display:'flex',flexDirection:'column'}}>
          <span className="card-t" style={{fontSize:13}}><img src="/iconos_info_general/niveles_generados.webp" alt="" style={{width:22,height:22,verticalAlign:'middle',marginRight:2}} />Niveles generados</span>
          <span className="card-s" style={{fontSize:11}}>{pisos.length} niveles</span>
        </div>
      </div>
      <div style={{padding:'4px 6px',display:'flex',flexDirection:'column',flex:1,minHeight:0}}>
        {pisos.length===0&&(
          <div style={{fontSize:12,color:'var(--txt3)',textAlign:'center',padding:'12px 0',fontFamily:'var(--mono)'}}>Presione "Generar niveles"</div>
        )}
        {pisos.length>0&&(
        <>
          <div style={{flex:1,overflowY:'auto',minHeight:0}}>
            {[...pisos].sort((a,b)=>
              (b.tipo==='cubierta'?999:b.n) - (a.tipo==='cubierta'?999:a.n)
            ).map(p=>(
              <div key={p.id} style={{display:'flex',alignItems:'center',gap:3,padding:'2px 4px',background:'var(--bg3)',border:'1px solid var(--line)',borderRadius:'var(--r)',borderLeft:'3px solid '+(p.tipo==='cubierta'?'var(--ll)':p.n<0?'var(--txt3)':'var(--acc2)'),marginBottom:2}}>
                <span className={p.tipo==='cubierta'?'piso-tag cub':p.n<0?'piso-tag sot':'piso-tag'} style={{fontSize:11,padding:'2px 5px',minWidth:48}}>{pisoLbl(p.n)}</span>
                <input type="text" inputMode="decimal" defaultValue={p.npt ?? ''} key={p.id+'npt'} className="npt-in" style={{fontSize:12,width:52,padding:'2px 4px'}} onBlur={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)setPisos(prev=>prev.map(x=>x.id===p.id?{...x,npt:v}:x));}}/>
                <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',height:20}}><span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--txt3)'}}>m</span></div>
                <div className={`pdot ${p.ok?'ok':''}`}/>
                <button onClick={()=>delPiso(p.id)} title="Eliminar nivel" style={{padding:'1px 5px',background:'transparent',border:'1px solid var(--line)',borderRadius:2,color:'var(--txt3)',cursor:'pointer',fontSize:10,fontFamily:'var(--mono)',lineHeight:1,flexShrink:0,marginLeft:2}} onMouseEnter={e=>{e.currentTarget.style.color='#ef5350';e.currentTarget.style.borderColor='rgba(211,47,47,.5)';}} onMouseLeave={e=>{e.currentTarget.style.color='var(--txt3)';e.currentTarget.style.borderColor='var(--line)';}}>✕</button>
              </div>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:3,marginTop:2,flexShrink:0}}>
            <button className="btn-xs" onClick={addSotano} style={{padding:'3px 6px',fontSize:10}}>+ Sótano</button>
            <button className="btn-xs" onClick={addPiso} style={{padding:'3px 6px',fontSize:10}}>+ Piso</button>
          </div>
        </>)}
      </div>
    </div>

    {/* ── Guía de uso ── */}
    <div className="card" style={{flex:'0 1 auto',minWidth:0}}>
      <div className="card-h" style={{padding:'4px 8px'}}>
        <div style={{display:'flex',flexDirection:'column'}}>
          <span className="card-t" style={{fontSize:13}}><img src="/iconos_info_general/guia_de_uso.webp" alt="" style={{width:22,height:22,verticalAlign:'middle',marginRight:2}} />Guía de uso</span>
          <span className="card-s" style={{fontSize:11}}>Recomendaciones</span>
        </div>
      </div>
      <div style={{padding:'4px 8px',fontSize:11,lineHeight:1.6,color:'var(--txt2)'}}>
        <ol style={{margin:0,paddingLeft:22,listStyle:'decimal',fontWeight:600}}>
          <li style={{marginBottom:5,fontWeight:400,paddingLeft:3}}>Complete los datos del proyecto con la información de la memoria de cálculo.</li>
          <li style={{marginBottom:5,fontWeight:400,paddingLeft:3}}>Active las redes que requiere el diseño según el uso del edificio.</li>
          <li style={{marginBottom:5,fontWeight:400,paddingLeft:3}}>Configure la cantidad de pisos y sótanos, luego pulse <strong>"Generar niveles automáticamente"</strong>.</li>
          <li style={{marginBottom:5,fontWeight:400,paddingLeft:3}}>Verifique los NPT generados y ajústelos si es necesario.</li>
          <li style={{marginBottom:5,fontWeight:400,paddingLeft:3}}>Vaya a la pestaña <strong>Diseño de Redes</strong> para iniciar el cálculo hidráulico de cada red activa.</li>
        </ol>
      </div>
    </div>

  </div>
</div>
)}

{tab==='planos'&&(
<div className="fu" style={{flex:1,minHeight:0,display:'flex',flexDirection:'row',overflow:'hidden',padding:0}}>

  {/* ── LEFT SIDEBAR: Requisitos ── */}
  <div style={{width:170,flexShrink:0,display:'flex',flexDirection:'column',borderRight:'1px solid var(--line)',borderRadius:'var(--r2)'}}>
    <div className="card-h" style={{padding:'8px 10px',borderBottom:'1px solid var(--line)',flexShrink:0,background:'none'}}>
      <span className="card-t" style={{fontSize:13}}><img src="/iconos_carga_planos/requisitos_del_plano.webp" alt="" style={{width:24,height:24,verticalAlign:'middle',marginRight:4}} />Requisitos del plano</span>
    </div>
    <div style={{flex:1,overflowY:'auto',padding:'8px 10px',display:'flex',flexDirection:'column',gap:8}}>
      {REQ_ITEMS.map(({ico,icoImg,t,s})=>(
        <div key={t} style={{display:'flex',gap:10,alignItems:'flex-start',padding:'10px 12px',background:'var(--bg3)',borderRadius:'var(--r)',border:'1px solid var(--line)'}}>
          <span style={{fontSize:16,flexShrink:0}}>{icoImg ? <img src={icoImg} alt="" style={{width:24,height:24,verticalAlign:'middle'}} /> : ico}</span>
          <div><div style={{fontSize:12,fontWeight:500}}>{t}</div><div style={{fontSize:10,color:'var(--txt3)',marginTop:2,lineHeight:1.4}}>{s}</div></div>
        </div>
      ))}
    </div>
  </div>

  {/* ── CENTER: PDF Viewer ── */}
  <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,position:'relative'}}
    onDragOver={e=>{e.preventDefault();setPlanDrag(true)}}
    onDragLeave={()=>setPlanDrag(false)}
    onDrop={e=>{e.preventDefault();setPlanDrag(false);const fl=e.dataTransfer?.files;if(fl&&fl.length>0)addPlanos(fl);}}>
    <input ref={fileRef} type="file" accept=".pdf" multiple style={{display:'none'}} onChange={e=>{addPlanos(e.target.files);e.target.value='';}}/>

    {/* Header bar */}
    <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 12px',borderBottom:'1px solid var(--line)',flexShrink:0,background:'var(--bg)',minHeight:36}}>
      {selectedPlan ? (
        <>
          <span style={{fontSize:14,flexShrink:0}}>📄</span>
          <span style={{fontSize:12,fontWeight:600,fontFamily:'var(--mono)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{selectedPlan.name}</span>
          {selectedPlan.nivel!==null&&<span style={{fontSize:9,padding:'1px 6px',background:'var(--bg3)',borderRadius:'var(--r)',color:'var(--txt3)',fontFamily:'var(--mono)',flexShrink:0}}>{pisoLbl(selectedPlan.nivel)}</span>}
          <span style={{fontSize:9,color:'var(--txt3)',fontFamily:'var(--mono)',flexShrink:0}}>1:{selectedPlan.scale}</span>
          <div style={{flex:1}}/>
          <button onClick={()=>setSelectedPlanId(null)}
            style={{padding:'4px 12px',background:'rgba(211,47,47,0.15)',border:'1px solid rgba(211,47,47,0.35)',borderRadius:'var(--r)',color:'#ef5350',cursor:'pointer',fontSize:12,fontFamily:'var(--mono)',fontWeight:600,flexShrink:0,lineHeight:1.2,display:'flex',alignItems:'center',gap:4,transition:'all .15s'}}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(211,47,47,0.3)';e.currentTarget.style.borderColor='rgba(211,47,47,0.6)'}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(211,47,47,0.15)';e.currentTarget.style.borderColor='rgba(211,47,47,0.35)'}} title="Cerrar vista">✕ Cerrar</button>
          {confirmedPlanos.length>0&&(
            <a href="#/visor" style={{padding:'3px 10px',background:'rgba(0,220,229,0.08)',border:'1px solid rgba(0,220,229,0.3)',borderRadius:'var(--r)',color:'#00dce5',fontWeight:600,fontSize:9,textDecoration:'none',fontFamily:'var(--mono)',whiteSpace:'nowrap'}}>
              IR A DIBUJO DE REDES →
            </a>
          )}
        </>
      ) : (
        <span style={{fontSize:11,color:'var(--txt3)'}}>Vista previa del plano</span>
      )}
    </div>

    {/* PDF embed or placeholder */}
    {selectedPlan&&selectedPlanUrl ? (
      <div style={{flex:1,background:'#141416',position:'relative'}}>
        {planDrag&&(
          <div style={{position:'absolute',inset:0,zIndex:10,background:'rgba(0,220,229,.12)',border:'3px dashed rgba(0,220,229,.5)',display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
            <span style={{fontSize:14,fontWeight:600,color:'#00dce5',fontFamily:'var(--mono)'}}>📐 SOLTAR PARA SUBIR</span>
          </div>
        )}
        <embed key={selectedPlanUrl} src={selectedPlanUrl} type="application/pdf" style={{width:'100%',height:'100%'}}/>
      </div>
    ) : (
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,background:'var(--bg)',cursor:'pointer',position:'relative'}}
        onClick={()=>fileRef.current?.click()}>
        {planDrag ? (
          <div style={{position:'absolute',inset:0,background:'rgba(0,220,229,.08)',border:'3px dashed rgba(0,220,229,.4)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{fontSize:14,fontWeight:600,color:'#00dce5',fontFamily:'var(--mono)'}}>📐 SOLTAR PARA SUBIR</span>
          </div>
        ) : (
          <>
            <div style={{fontSize:40,opacity:.25}}>📐</div>
            <div style={{fontSize:13,fontWeight:600,color:'var(--txt3)'}}>Vista previa del plano</div>
            <div style={{fontSize:10,color:'var(--txt4)',textAlign:'center',maxWidth:260,lineHeight:1.5}}>
              Sube un plano desde el panel derecho o arrastra un PDF aquí
            </div>
          </>
        )}
      </div>
    )}
  </div>

  {/* ── RIGHT PANEL: Pending + Confirmed ── */}
  <div style={{width:300,flexShrink:0,display:'flex',flexDirection:'column',borderLeft:'1px solid var(--line)',background:'var(--bg)'}}>

    {/* Subir button */}
    <div style={{padding:'10px 10px',borderBottom:'1px solid var(--line)',flexShrink:0}}>
      <button onClick={()=>fileRef.current?.click()}
        style={{width:'100%',padding:'10px',background:'rgba(0,220,229,0.06)',border:'1.5px dashed rgba(0,220,229,0.3)',borderRadius:'var(--r)',color:'#00dce5',fontWeight:600,fontSize:12,cursor:'pointer',fontFamily:'var(--mono)',display:'flex',alignItems:'center',justifyContent:'center',gap:5,transition:'all .15s'}}
        onMouseEnter={e=>{e.currentTarget.style.background='rgba(0,220,229,0.12)';e.currentTarget.style.borderColor='rgba(0,220,229,0.5)'}}
        onMouseLeave={e=>{e.currentTarget.style.background='rgba(0,220,229,0.06)';e.currentTarget.style.borderColor='rgba(0,220,229,0.3)'}}>
        <img src="/iconos_carga_planos/subir_plano.webp" alt="" style={{width:24,height:24,verticalAlign:'middle',marginRight:4}} /> SUBIR PLANO
      </button>
    </div>

    {/* Pending section */}
    <div style={{flex:'1 1 50%',minHeight:0,display:'flex',flexDirection:'column',overflow:'hidden',borderBottom:'1px solid var(--line)'}}
      onDragOver={e=>{e.preventDefault();setPlanDrag(true)}}
      onDragLeave={()=>setPlanDrag(false)}
      onDrop={e=>{e.preventDefault();setPlanDrag(false);const fl=e.dataTransfer?.files;if(fl&&fl.length>0)addPlanos(fl);}}>
      <div style={{padding:'7px 10px',fontSize:11,fontWeight:700,color:'var(--txt3)',fontFamily:'var(--mono)',borderBottom:'1px solid var(--line)',flexShrink:0,display:'flex',alignItems:'center',gap:5,textTransform:'uppercase',letterSpacing:.5}}>
        <img src="/iconos_carga_planos/pendientes.webp" alt="" style={{width:24,height:24,verticalAlign:'middle'}} />
        Pendientes {pendingPlanos.length>0&&`(${pendingPlanos.length})`}
      </div>
      {pendingPlanos.length===0 ? (
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:20,gap:8,cursor:'pointer',fontSize:11,color:'var(--txt4)',fontFamily:'var(--mono)',textAlign:'center',lineHeight:1.6}}
          onClick={()=>fileRef.current?.click()}>
          {planDrag ? (
            <div style={{fontSize:13,fontWeight:600,color:'#00dce5'}}>📐 SOLTAR PARA SUBIR</div>
          ) : (
            <>
              <div style={{fontSize:24,opacity:.3}}>📐</div>
              <span>Arrastra PDFs aquí o haz clic para subir varios planos</span>
            </>
          )}
        </div>
      ) : (
        <div style={{flex:1,overflowY:'auto'}}>
          {pendingPlanos.map(p=>(
            <div key={p.id} onClick={()=>setSelectedPlanId(p.id)}
              style={{cursor:'pointer',padding:'8px 10px',borderBottom:'1px solid var(--line)',background:selectedPlanId===p.id?'rgba(27,110,243,.08)':'transparent',display:'flex',flexDirection:'column',gap:4,transition:'background .1s'}}>
              <div style={{display:'flex',alignItems:'center',gap:4}}>
                <span style={{fontSize:13,flexShrink:0}}>📄</span>
                <span style={{fontSize:12,fontWeight:500,fontFamily:'var(--mono)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',flex:1}}>{p.name}</span>
                <button onClick={e=>{e.stopPropagation();removePlano(p.id)}}
                  style={{padding:'2px 8px',background:'var(--bg3)',border:'1px solid var(--line)',borderRadius:'var(--r)',color:'var(--txt3)',cursor:'pointer',fontSize:10,fontFamily:'var(--mono)',flexShrink:0}} title="Cancelar">Cancelar</button>
              </div>
              <div style={{display:'flex',gap:5,alignItems:'center'}}>
                <select value={p.nivel??''} onClick={e=>e.stopPropagation()} onChange={e=>updatePlano(p.id,{nivel:e.target.value?Number(e.target.value):null})}
                  style={{flex:1,fontSize:11,padding:'3px 5px',background:'var(--bg3)',border:'1px solid var(--line)',borderRadius:'var(--r)',color:'var(--txt2)',cursor:'pointer',minWidth:0}}>
                  <option value="">— Nivel —</option>
                  {[...pisos].sort((a,b)=>b.n-a.n).map(s=>{
                    const ocupado=planos.some(x=>x.id!==p.id&&x.status==='confirmed'&&x.nivel===s.n);
                    return <option key={s.id} value={s.n} disabled={ocupado}>{pisoLbl(s.n)} ({s.npt} m){ocupado?' (ocup)':''}</option>;
                  })}
                </select>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:3}}>
                <label style={{fontSize:10,fontWeight:600,color:'var(--txt3)',fontFamily:'var(--mono)'}}>Escala</label>
                <select value={p.scale||''} onClick={e=>e.stopPropagation()} onChange={e=>updatePlano(p.id,{scale:Number(e.target.value)||100})}
                  style={{width:'100%',fontSize:11,padding:'3px 5px',background:'var(--bg3)',border:'1px solid var(--line)',borderRadius:'var(--r)',color:'var(--txt2)',cursor:'pointer'}}>
                  <option value="">— Escala —</option>
                  <option value="50">1:50</option>
                  <option value="75">1:75</option>
                  <option value="100">1:100</option>
                  <option value="125">1:125</option>
                  <option value="200">1:200</option>
                </select>
              </div>
              <div style={{display:'flex',justifyContent:'flex-end',gap:4}}>
                {p.nivel!==null&&p.nivel!==undefined&&(
                  <button onClick={e=>{
                    e.stopPropagation();
                    if(planos.some(x=>x.id!==p.id&&x.status==='confirmed'&&x.nivel===p.nivel)){
                      alert('Este nivel ya tiene un plano asociado.');
                      return;
                    }
                    confirmPlano(p.id);
                  }} style={{padding:'3px 10px',background:'rgba(0,220,229,.1)',border:'1px solid rgba(0,220,229,.25)',borderRadius:'var(--r)',color:'#00dce5',cursor:'pointer',fontSize:10,fontFamily:'var(--mono)',fontWeight:600}}>✓ Confirmar</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* Confirmed section */}
    <div style={{flex:'1 1 50%',minHeight:0,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{padding:'7px 10px',fontSize:11,fontWeight:700,color:'var(--txt3)',fontFamily:'var(--mono)',borderBottom:'1px solid var(--line)',flexShrink:0,display:'flex',alignItems:'center',gap:5,textTransform:'uppercase',letterSpacing:.5}}>
        <img src="/iconos_carga_planos/cargados.webp" alt="" style={{width:24,height:24,verticalAlign:'middle'}} />
        Cargados {confirmedPlanos.length>0&&`(${confirmedPlanos.length})`}
      </div>
      {confirmedPlanos.length===0 ? (
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:20,fontSize:11,color:'var(--txt4)',fontFamily:'var(--mono)',textAlign:'center',lineHeight:1.6}}>
          Aún no hay planos cargados
        </div>
      ) : (
        <div style={{flex:1,overflowY:'auto'}}>
          {confirmedPlanos.map(p=>(
            <div key={p.id} onClick={()=>setSelectedPlanId(p.id)}
              style={{cursor:'pointer',display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderBottom:'1px solid var(--line)',background:selectedPlanId===p.id?'rgba(27,110,243,.08)':'transparent',transition:'background .1s'}}>
              <span style={{fontSize:13,flexShrink:0}}>📄</span>
              <div style={{minWidth:0,flex:1}}>
                <div style={{fontSize:12,fontWeight:500,fontFamily:'var(--mono)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.name}</div>
                <div style={{fontSize:10,color:'var(--txt3)',fontFamily:'var(--mono)',display:'flex',gap:5}}>
                  {p.nivel!==null&&<span>{pisoLbl(p.nivel)}</span>}
                  <span>1:{p.scale}</span>
                </div>
              </div>
              <button onClick={e=>{e.stopPropagation();setSelectedPlanId(p.id)}}
                style={{padding:'3px 7px',background:'var(--bg2)',border:'1px solid var(--line)',borderRadius:'var(--r)',color:'var(--acc2)',cursor:'pointer',fontSize:10,fontFamily:'var(--mono)',flexShrink:0}} title="Vista previa">👁</button>
              <button onClick={e=>{e.stopPropagation();removePlano(p.id)}}
                style={{padding:'3px 7px',background:'var(--bg3)',border:'1px solid var(--line)',borderRadius:'var(--r)',color:'var(--txt3)',cursor:'pointer',fontSize:10,fontFamily:'var(--mono)',flexShrink:0}} title="Eliminar">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
</div>
)}

{/* ── Redes a diseñar ── */}
{tab==='redes'&&redesActivas.length>0&&(
  <div className="fu" style={{display:'flex',flexDirection:'column',gap:12,flex:1,minHeight:0}}>
    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{redesActivas.map(r=>(<button key={r.id} onClick={()=>setRedActiva(r.id)} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',borderRadius:'var(--r)',border:'1px solid',cursor:'pointer',fontSize:13,fontFamily:'var(--body)',flex:1,justifyContent:'center',borderColor:redActiva===r.id?r.col:'var(--line)',color:redActiva===r.id?r.col:'var(--txt3)',background:redActiva===r.id?'rgba(0,0,0,.15)':'transparent',fontWeight:redActiva===r.id?700:400}}>{r.icoImg ? <img src={r.icoImg} alt="" style={{width:24,height:24,verticalAlign:'middle'}} /> : <span style={{fontSize:18}}>{r.ico}</span>}<span>{r.lbl}</span></button>))}</div>
  {redActiva==='san'&&redes.has('san')&&(
    <div className="fu" style={{display:'flex',flexDirection:'column',gap:8}}>
      <PageNav page={sanPage} setPage={setSanPage} total={3} color="var(--san)"
        labels={['Cálculo UD','Diseño sanitario','Bajantes y ventilación']} />
      {sanPage===1&&<CalculoUD />}
      {sanPage===2&&<DisenosSanitarios />}
      {sanPage===3&&<BajantesTable />}
      <div style={{display:'none'}}><CalculoHidraulicoSanitario /></div>
    </div>
  )}
  {redActiva==='ll'&&redes.has('ll')&&(
    <div className="fu" style={{display:'flex',flexDirection:'column',gap:8}}>
      <PageNav page={llPage} setPage={setLlPage} total={3} color="var(--ll)"
        labels={['Chequeo bajantes','Chequeo canales','Diseño lluvias']} />
      {llPage===1&&<ChequeoBajantesLluvias />}
      {llPage===2&&<ChequeoCanalesLluvias />}
      {llPage===3&&<DisenoLluvias />}
      <div style={{display:'none'}}><CalculoHidraulicoLluvias /></div>
    </div>
  )}
  {redActiva==='af'&&redes.has('af')&&(
    <div className="fu" style={{display:'flex',flexDirection:'column',gap:8}}>
      <PageNav page={afPage} setPage={setAfPage} total={3} color="var(--af)"
        labels={['Cálculo UC','Accesorios','Diseño de red agua fria']} />
      {afPage===1&&<CalculoUCAF />}
      {afPage===2&&<AccesoriosTable tramos={tramosAf} updAcc={updTramoAfAcc} net="af" readOnly />}
      {afPage===3&&<DisenoRedAguaFria />}
    </div>
  )}
  {redActiva==='ac'&&redes.has('ac')&&(
    <div className="fu" style={{display:'flex',flexDirection:'column',gap:8}}>
              <PageNav page={acPage} setPage={setAcPage} total={3} color="var(--ac)"
              labels={['Cálculo UC','Accesorios','Diseño de red agua caliente']} />
              {acPage===1&&<CalculoUCAC />}
              {acPage===2&&<AccesoriosTable tramos={tramosAc} updAcc={updTramoAcAcc} net="ac" readOnly />}
              {acPage===3&&<DisenoRedAguaCaliente />}
    </div>
  )}
  {redesActivas.filter(r=>r.id!=='san'&&r.id!=='ll'&&r.id!=='af'&&r.id!=='ac').map(r=>redActiva===r.id&&redes.has(r.id)&&(
    <div key={r.id} className="fu" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,flex:1,minHeight:250}}>
      <div style={{fontSize:48,opacity:.5}}>🚧</div>
      <div style={{fontSize:18,fontWeight:600,color:'var(--txt2)'}}>{r.lbl}</div>
      <div style={{fontSize:13,color:'var(--txt3)',textAlign:'center',maxWidth:380,lineHeight:1.6}}>
        El módulo de <strong>{r.lbl}</strong> está en desarrollo.<br/>Pronto estará disponible para uso en CIVILFLOW.</div>
    </div>
  ))}</div>
)}

{/* ── Base de datos ── */}
{tab==='datos'&&(
<BaseDatos redes={redes} />
)}

{/* ── NORMATIVA ── */}
{tab==='crit'&&(
  <Normativa />
)}

{/* ── INFORME ── */}
{tab==='inf'&&(
<div className="fu" style={{display:'flex',flexDirection:'column',gap:12,flex:1,minHeight:0}}>
  {(()=>{
const okSAN=tramosSan.length>0&&tramosSan.every(validateTramo);
const okLL=tramosLl.length>0&&tramosLl.every(validateTramo);
    const items=[
      ['PROYECTO',proy.nombre],['UBICACIÓN',[proy.mun,proy.dep].filter(Boolean).join(', ')],
      ['USO',proy.uso],['EMPRESA',proy.empresa],
      ['P RED',proy.p_red+' mca'],['DOTACIÓN',proy.dot+' L/hab/d'],
      ['REDES',[...redes].join(' · ')],
      ['NIVELES',[...pisos].sort((a,b)=>a.n-b.n).map(p=>pisoLbl(p.n)).join(' · ')],
      ['SANITARIA',okSAN?'✓ OK':'✗ Revisar'],['Aguas lluvias',okLL?'✓ OK':'✗ Revisar'],
    ];
    return(
      <div className="card">
        <div className="card-h"><span className="card-t">📊 Resumen del proyecto</span><span className="card-s">CIVILFLOW KML 2026 · Ing. Camilo Cárdenas</span></div>
        <div className="card-b">
          {items.map(([k,v])=>(
            <div key={k} style={{display:'flex',gap:10,alignItems:'baseline',padding:'5px 8px',background:'var(--bg3)',borderRadius:'var(--r)',border:'1px solid var(--line)',marginBottom:4}}>
              <span style={{fontFamily:'var(--mono)',fontSize:8,color:'var(--txt3)',minWidth:120,flexShrink:0,textTransform:'uppercase'}}>{k}</span>
              <span style={{fontSize:11,fontWeight:500,color:String(v).includes('✗')?'var(--err)':String(v).includes('✓')?'var(--ok)':'var(--txt)'}}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    );
  })()}
</div>
)}

          </div>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:5,padding:'7px 12px',background:'var(--bg2)',borderTop:'1px solid var(--line)',flexShrink:0,overflowX:'auto'}}>
  {redesActivas.map(r=>(
    <button key={r.id} onClick={()=>{setTab('redes');setRedActiva(r.id);}}
      style={{display:'flex',alignItems:'center',gap:5,padding:'6px 11px',borderRadius:'var(--r)',border:'1px solid',flexShrink:0,cursor:'pointer',fontSize:11,fontFamily:'var(--body)',fontWeight:600,
      borderColor:tab==='redes'&&redActiva===r.id?r.col:'var(--line2)',
      color:tab==='redes'&&redActiva===r.id?r.col:'var(--txt3)',
      background:tab==='redes'&&redActiva===r.id?'rgba(0,0,0,.15)':'transparent'}}>
       {r.icoImg ? <img src={r.icoImg} alt="" style={{width:22,height:22,verticalAlign:'middle'}} /> : <span style={{fontSize:16}}>{r.ico}</span>}<span>{r.lbl}</span>
    </button>
  ))}
<div style={{flex:1}}/>
      </div>
      </div>
    </div>
  );
}

function PageNav({page, setPage, total, labels, color}) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center',padding:'6px 0',flexShrink:0}}>
      <button onClick={()=>setPage(Math.max(1, page-1))} disabled={page<=1}
        style={{padding:'6px 14px',border:'1px solid var(--line)',borderRadius:'var(--r)',background:'var(--bg3)',color:page<=1?'var(--txt3)':'var(--txt)',cursor:page<=1?'not-allowed':'pointer',fontSize:14,fontFamily:'var(--mono)',fontWeight:600,lineHeight:1}}>◀</button>
      {Array.from({length:total},(_,i)=>i+1).map(p=>(
        <button key={p} onClick={()=>setPage(p)}
          style={{padding:'6px 16px',border:`1.5px solid ${p===page?color||'var(--acc)':'var(--line)'}`,borderRadius:'var(--r)',
          background:p===page?`${color||'var(--acc)'}18`:'var(--bg3)',color:p===page?color||'var(--acc)':'var(--txt2)',
          cursor:'pointer',fontSize:12,fontFamily:'var(--body)',fontWeight:p===page?700:500,
          textAlign:'center',whiteSpace:'nowrap'}}>{labels?.[p-1]||`Pág ${p}`}</button>
      ))}
      <button onClick={()=>setPage(Math.min(total, page+1))} disabled={page>=total}
        style={{padding:'6px 14px',border:'1px solid var(--line)',borderRadius:'var(--r)',background:'var(--bg3)',color:page>=total?'var(--txt3)':'var(--txt)',cursor:page>=total?'not-allowed':'pointer',fontSize:14,fontFamily:'var(--mono)',fontWeight:600,lineHeight:1}}>▶</button>
    </div>
  );
}

function MiniBtn({onClick,children}){
  return <button onClick={onClick}
    style={{padding:'5px 10px',background:'rgba(24,26,30,0.92)',border:'1px solid #3a494a',borderRadius:6,color:'#e2e2e8',fontSize:11,cursor:'pointer',fontFamily:"'Hanken Grotesk',sans-serif",fontWeight:600,display:'flex',alignItems:'center',gap:4,boxShadow:'0 4px 16px rgba(0,0,0,.4)'}}>{children}</button>;
}

export default function CIVILFLOW(){
  return <CIVILFLOWInner />;
}
