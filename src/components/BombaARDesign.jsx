import { useState } from "react";
import { parseDecimalInput } from "../utils/parseDecimal";

function PageNav({page,setPage,total,labels,color}){
  return(
    <div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'center',padding:'6px 0',flexShrink:0}}>
      <button onClick={()=>setPage(Math.max(1,page-1))} disabled={page<=1}
        style={{padding:'4px 10px',border:'1px solid var(--line)',borderRadius:'var(--r)',background:'var(--bg3)',color:page<=1?'var(--txt3)':'var(--txt)',cursor:page<=1?'not-allowed':'pointer',fontSize:12,fontWeight:600,lineHeight:1}}>◀</button>
      {Array.from({length:total},(_,i)=>i+1).map(p=>(
        <button key={p} onClick={()=>setPage(p)}
          style={{padding:'4px 12px',border:`1.5px solid ${p===page?color||'var(--acc)':'var(--line)'}`,borderRadius:'var(--r)',
          background:p===page?`${color||'var(--acc)'}18`:'var(--bg3)',color:p===page?color||'var(--acc)':'var(--txt2)',
          cursor:'pointer',fontSize:11,fontFamily:'var(--body)',fontWeight:p===page?700:500,textAlign:'center',whiteSpace:'nowrap'}}>{labels?.[p-1]||`Pág ${p}`}</button>
      ))}
      <button onClick={()=>setPage(Math.min(total,page+1))} disabled={page>=total}
        style={{padding:'4px 10px',border:'1px solid var(--line)',borderRadius:'var(--r)',background:'var(--bg3)',color:page>=total?'var(--txt3)':'var(--txt)',cursor:page>=total?'not-allowed':'pointer',fontSize:12,fontWeight:600,lineHeight:1}}>▶</button>
    </div>
  );
}

const dec=(s)=>parseDecimalInput(s)||0;
const nv=(s)=>s===''?'':/^[\d]*\.?[\d]*$/.test(s)?s:false;
const oc=(set)=>(e)=>{const v=nv(e.target.value);if(v!==false)set(v)};

const SI={border:'1px solid var(--line)',borderRadius:3,background:'var(--bg4)',fontFamily:'var(--mono)',fontSize:11,color:'var(--txt)',width:'100%',boxSizing:'border-box',textAlign:'center',outline:'none',padding:'3px 5px'};
const TH={fontSize:10,fontWeight:600,color:'var(--txt3)',fontFamily:'var(--mono)',textAlign:'center',padding:'5px 6px',borderBottom:'1px solid var(--line)',borderRight:'1px solid var(--line2)',whiteSpace:'nowrap',textTransform:'uppercase',letterSpacing:'0.4px',background:'var(--bg3)'};
const TD={fontSize:11,fontFamily:'var(--mono)',padding:'4px 6px',borderBottom:'1px solid var(--line)',borderRight:'1px solid var(--line2)',color:'var(--txt2)',textAlign:'center',verticalAlign:'middle'};
const TDL={...TD,textAlign:'left',fontFamily:'var(--body)'};
const Fmt=(v,u='')=>{
  if(v===''||v===null||v===undefined)return <span style={{color:'var(--txt3)',fontSize:10}}>—</span>;
  const val=typeof v==='number'?v.toFixed(2):v;
  return <span style={{fontFamily:'var(--mono)'}}>{val}{u?` ${u}`:''}</span>;
};

const SI2={...SI,fontSize:13,padding:'4px 6px'};
const TH2={...TH,fontSize:11};
const TD2={...TD,fontSize:13};
const TDL2={...TDL,fontSize:13};
const Fmt2=(v,u='')=>{
  if(v===''||v===null||v===undefined)return <span style={{color:'var(--txt3)',fontSize:12}}>—</span>;
  const val=typeof v==='number'?v.toFixed(2):v;
  return <span style={{fontFamily:'var(--mono)',fontSize:13}}>{val}{u?` ${u}`:''}</span>;
};

function Inp({v,set,style}){return <input type="text" inputMode="decimal" value={v} onChange={oc(set)} style={style||SI}/>;}
function Tbl({cols,rows,th,td,tdl,fontSize}){
  const h=th||TH,d=td||TD,dl=tdl||TDL;
  return <table className="tbl" style={{fontSize:fontSize||11,width:'100%',borderCollapse:'collapse'}}>
    <thead><tr>{cols.map((c,i)=><th key={i} style={h}>{c}</th>)}</tr></thead>
    <tbody>{rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j} style={j===0?dl:d}>{c}</td>)}</tr>)}</tbody>
  </table>;
}


export default function BombaARDesign(){
  const [bp,setBp]=useState(1);
  const [salSim,setSalSim]=useState('');
  const [udTot,setUdTot]=useState('');
  const [hz,setHz]=useState('');
  const [lImp,setLImp]=useState('');
  const [dImp,setDImp]=useState('');
  const [cHW,setCHW]=useState('');
  const [pDesc,setPDesc]=useState('');
  const [etaB,setEtaB]=useState('');
  const [fSrv,setFSrv]=useState('');
  const [tCic,setTCic]=useState('');
  const [hMin,setHMin]=useState('');
  const [hMax,setHMax]=useState('');
  const [bCam,setBCam]=useState('');
  const [lCam,setLCam]=useState('');
  const [npsh,setNpsh]=useState('');

  const sal=dec(salSim); const ud=dec(udTot); const hzg=dec(hz); const li=dec(lImp);
  const di=dec(dImp); const ch=dec(cHW)||150; const pd=dec(pDesc); const eb=dec(etaB)||0.65;
  const fs=dec(fSrv)||1.25; const tc=dec(tCic); const hmn=dec(hMin); const hmx=dec(hMax);
  const bc=dec(bCam); const lc=dec(lCam);
  const Dm=di*0.0254;

  const K=sal<=1?1:+(1/Math.sqrt(sal-1)).toFixed(2);
  const Qd=+(K*((ud<240?0.1163*Math.pow(ud,0.6875):0.074*Math.pow(ud,0.7504)))).toFixed(2);
  const Qb=+(Qd*1.25).toFixed(2);
  const Vi=Qd>0&&Dm>0?+(Qd*0.001/(3.14159*Math.pow(Dm/2,2))).toFixed(2):0;
  const Hf=Qb>0&&li>0&&Dm>0?+(10.67*li*Math.pow(Qb/1000,1.852)/(Math.pow(ch,1.852)*Math.pow(Dm,4.87))).toFixed(2):0;
  const Hac=+(Hf*0.25).toFixed(2);
  const Hfri=+(Hf+Hac).toFixed(2);
  const Hest=+(li+Hfri).toFixed(2);
  const Hm=+(Hfri+Hest).toFixed(2);
  const Vch=Vi>=0.6&&Vi<=3.5?'O.K.':'REVISAR DIÁMETRO';
  const Ph=Qb>0?+(Qb*1000*9.81*Hm/1000).toFixed(2):0;
  const Peje=+(Ph/fs).toFixed(2);
  const Pcom=+(Peje*fs).toFixed(2);
  const php=Pcom/746;
  const Sel=php<=0.5?'0.5 HP':php<=1?'1 HP':php<=2?'2 HP':php<=3?'3 HP':'≥ 5 HP';
  const Vcam=Qb>0&&tc>0?+(Qb*tc*60).toFixed(2):0;
  const Vgeo=bc>0&&lc>0&&(hmx-hmn)>0?+(bc*lc*(hmx-hmn)).toFixed(2):0;
  const Vchk=Vgeo>0&&Vcam>0?Vgeo>=(Vcam/1000)?'O.K.':'AMPLIAR CÁMARA':'';

  const Nota=<div style={{fontSize:11,color:'var(--txt3)',lineHeight:1.6,padding:'8px 12px',marginTop:6,borderRadius:'var(--r)',background:'var(--bg2)'}}>
    <b style={{color:'var(--txt)'}}>Nota normativa</b> — Diseño conforme <b style={{color:'var(--txt)'}}>NTC 1500 §8</b> y <b style={{color:'var(--txt)'}}>RAS 2000 Título D</b>. La bomba trituradora es obligatoria para sólidos fecales. Verificar caudal con empresa de servicios (EMAB/AMB) antes de definir acometida.
  </div>;

  const COLS1=['Parámetro','Símbolo','Valor','Unidad','Equivalencia','Fuente / Norma'];
  const COLS2=['Componente','Símbolo','Valor','Unidad','Equivalencia','Observación'];

  const page1=<Tbl th={TH2} td={TD2} tdl={TDL2} fontSize={13} cols={COLS1} rows={[
    ['Número de Salidas Simultáneas','Sal sim',<Inp v={salSim} set={setSalSim} style={SI2}/>,'und','—','Probabilidad de trabajar al máximo'],
    ['UD acumuladas en sótano','UD tot',<Inp v={udTot} set={setUdTot} style={SI2}/>,'UD','—','NTC 1500'],
    ['Coeficiente K simultaneidad Hunter','K',Fmt2(K),'—','—','K = 1/√(n−1)'],
    ['Caudal de diseño Q = UD × K','Q dis',Fmt2(Qd),'lps',Fmt2((Qd*15.8503).toFixed(2),'GPM'),'Método Hunter NTC 1500'],
    ['Caudal bombeo Qb (reserva 25%)','Q b',Fmt2(Qb),'lps',Fmt2((Qb*15.8503).toFixed(2),'GPM'),'Factor seguridad sobre Q diseño'],
    ['Altura geométrica sótano → piso 1','Hz',<Inp v={hz} set={setHz} style={SI2}/>,'m','—','Diferencia de nivel'],
    ['Longitud total tubería impulsión','L imp',<Inp v={lImp} set={setLImp} style={SI2}/>,'m','—','Tramos verticales + horizontales'],
    ['Diámetro tubería impulsión','D imp',<Inp v={dImp} set={setDImp} style={SI2}/>,'pulg',di?Fmt2((di*25).toFixed(2),'mm'):<span style={{color:'var(--txt3)',fontSize:12}}>—</span>,'Mínimo 2" NTC 1500 §8'],
    ['Coeficiente C Hazen-Williams (PVC)','C HW',<Inp v={cHW} set={setCHW} style={SI2}/>,'—','—','RAS 2000 §B.6.4.2 — PVC liso nuevo'],
    ['Presión mínima en descarga','P desc',<Inp v={pDesc} set={setPDesc} style={SI2}/>,'m.c.a.',pd?Fmt2((pd*1.42).toFixed(2),'psi'):<span style={{color:'var(--txt3)',fontSize:12}}>—</span>,'Presión en punto entrega piso 1'],
    ['Eficiencia bomba η','eta b',<Inp v={etaB} set={setEtaB} style={SI2}/>,'—','—','Bomba sumergible trituradora típica: 60–70%'],
    ['Factor de servicio motor','f srv',<Inp v={fSrv} set={setFSrv} style={SI2}/>,'—','—','NEMA MG1: reserva 25% sobre P calculada'],
  ]}/>;

  const page2=<Tbl th={TH2} td={TD2} tdl={TDL2} fontSize={13} cols={COLS2} rows={[
    ['Velocidad en tubería impulsión','V imp',Fmt2(Vi),'m/s','—','0.6 < V < 3.5 m/s para residuales'],
    ['Pérdida fricción (Hazen-Williams)','Hf',Fmt2(Hf),'m.c.a.','—','hf = 10.67·L·Q^1.852 / (C^1.852·D^4.87)'],
    ['Pérdida en accesorios (25% de Hf)','H ac',Fmt2(Hac),'m.c.a.','—','Estimación conservadora'],
    ['Pérdida total por fricción','H fri',Fmt2(Hfri),'m.c.a.','—','Hf tubería + accesorios'],
    ['Altura estática total','H est',Fmt2(Hest),'m.c.a.','—','Hz geométrica + presión mínima descarga'],
    ['Altura manométrica total Hm','H m',Fmt2(Hm),'m.c.a.',Hm?Fmt2((Hm*1.42).toFixed(2),'psi'):<span style={{color:'var(--txt3)',fontSize:12}}>—</span>,'Hm = H fri + H est'],
    ['Chequeo velocidad','V chk',<span style={{color:Vch==='O.K.'?'#22c55e':'#ef5350',fontWeight:700,fontFamily:'var(--mono)',fontSize:13}}>{Vch}</span>,'—','—','Verificación automática'],
  ]}/>;

  const page3=<>
    <Tbl cols={COLS1} rows={[
      ['Caudal nominal bomba','Q b',Fmt(Qb),'lps',Fmt((Qb*15.8503).toFixed(2),'GPM'),'Incluye reserva 25%'],
      ['Altura manométrica Hm','H m',Fmt(Hm),'m.c.a.',Hm?Fmt((Hm*1.42).toFixed(2),'psi'):<span style={{color:'var(--txt3)',fontSize:10}}>—</span>,'Tomado de bloque 2'],
      ['Potencia hidráulica','P hid',Fmt(Ph),'W',Ph?Fmt((Ph/746).toFixed(2),'HP'):<span style={{color:'var(--txt3)',fontSize:10}}>—</span>,'Ph = ρ·g·Q·Hm / 1000'],
      ['Potencia en el eje','P eje',Fmt(Peje),'W',Peje?Fmt((Peje/746).toFixed(2),'HP'):<span style={{color:'var(--txt3)',fontSize:10}}>—</span>,'P eje = Ph / η bomba'],
      ['Potencia comercial (×f srv)','P com',Fmt(Pcom),'W',Pcom?Fmt(php.toFixed(2),'HP'):<span style={{color:'var(--txt3)',fontSize:10}}>—</span>,'Motor seleccionar ≥ este valor'],
      ['Selección comercial automática','Sel',<span style={{color:'var(--acc2)',fontWeight:700,fontFamily:'var(--mono)'}}>{Sel}</span>,'HP','—','Estándar: 0.5 / 1 / 2 / 3 / 5 HP'],
      ['Tipo de bomba','Tipo','Sumergible trituradora','—','—','NTC 1500 §8.5 — residuales con sólidos'],
      ['NPSH disponible mínimo','NPSH',<Inp v={npsh} set={setNpsh} style={SI}/>,'m','—','Verificar con curva del fabricante'],
    ]}/>
    <div className="card-t" style={{padding:'8px 8px',borderTop:'1px solid var(--line)',borderBottom:'1px solid var(--line)',background:'var(--bg4)',margin:'8px 0 4px',fontSize:15}}>
      <img src="/iconos_diseno_redes/especificacion_camara_trituradora.webp" alt="" style={{width:22,height:22}} />Especificación — Bomba sumergible trituradora
    </div>
    <Tbl cols={['Ítem','Valor']} rows={[
      ['Caudal nominal',Fmt((Qb*15.8503).toFixed(2),'GPM')],
      ['Altura manométrica total (Hm)',Fmt(Hm,'m.c.a.')],
      ['Potencia motor',<span style={{color:'var(--acc2)',fontWeight:700,fontFamily:'var(--mono)'}}>{Sel}</span>],
      ['Tipo','Bomba sumergible trituradora, impeler monocanal'],
      ['Tensión','110V o 220V monofásica — confirmar con proveedor'],
    ]}/>
    {Nota}
  </>;

  const page4=<>
    <Tbl cols={COLS1} rows={[
      ['Tiempo mínimo ciclo arranque','t cic',<Inp v={tCic} set={setTCic} style={SI}/>,'min','—','Mínimo 5 min entre arranques'],
      ['Volumen útil cámara mínimo','V cam',Fmt(Vcam),'lts',Vcam?Fmt((Vcam/1000).toFixed(2),'m³'):<span style={{color:'var(--txt3)',fontSize:10}}>—</span>,'V = Qb(lps) × t(s)'],
      ['Tirante mínimo sobre bomba','h min',<Inp v={hMin} set={setHMin} style={SI}/>,'m','—','Evita cavitación'],
      ['Tirante máximo antes de arrancar','h max',<Inp v={hMax} set={setHMax} style={SI}/>,'m','—','Nivel activación flotador'],
      ['Ancho mínimo cámara','b cam',<Inp v={bCam} set={setBCam} style={SI}/>,'m','—','NTC 1500 §8.5 — mínimo 60 cm'],
      ['Largo mínimo cámara','l cam',<Inp v={lCam} set={setLCam} style={SI}/>,'m','—','Verificar con dimensiones bomba'],
      ['Volumen geométrico disponible','V geo',Fmt(Vgeo),'m³',Vgeo?Fmt((Vgeo*1000).toFixed(2),'lts'):<span style={{color:'var(--txt3)',fontSize:10}}>—</span>,'b×l×(h max−h min)'],
      ['Chequeo volumen','V chk',<span style={{color:Vchk==='O.K.'?'#22c55e':'#ef5350',fontWeight:700,fontFamily:'var(--mono)'}}>{Vchk||'—'}</span>,'—','—','V geo ≥ V cam requerido'],
    ]}/>
    <div className="card-t" style={{padding:'8px 8px',borderTop:'1px solid var(--line)',borderBottom:'1px solid var(--line)',background:'var(--bg4)',margin:'8px 0 4px',fontSize:15}}>
      <img src="/iconos_diseno_redes/especificacion_camara_bombeo.webp" alt="" style={{width:22,height:22}} />Especificación — Cámara de bombeo
    </div>
    <Tbl cols={['Ítem','Valor']} rows={[
      ['Volumen útil requerido',Fmt(Vcam,'lts')],
      ['Dimensiones mínimas (m)',bc&&lc&&(hmx-hmn)?<span style={{fontFamily:'var(--mono)'}}>{`${bc} x ${lc} x ${(hmx-hmn).toFixed(2)}`}</span>:<span style={{color:'var(--txt3)',fontSize:10}}>—</span>],
      ['Material','Concreto impermeabilizado o polietileno PEAD'],
      ['Accesorios obligatorios','Rejilla aguas arriba + ventilación Ø2" + alarma nivel alto'],
    ]}/>
  </>;

  const pages=[
    {t:'Datos de entrada',icon:'/iconos_diseno_redes/datos_de_entrada.webp',c:page1},
    {t:'Cálculo de pérdidas de carga',icon:'/iconos_diseno_redes/calculo_perdidas_de_carga.webp',c:page2},
    {t:'Bomba sumergible trituradora',icon:'/iconos_diseno_redes/bomba_sumergible_trituradora.webp',c:page3},
    {t:'Cámara de bombeo (pozo húmedo)',icon:'/iconos_diseno_redes/camara_bombeo.webp',c:page4},
  ];

  return(
    <div className="fu" style={{display:'flex',flexDirection:'column',gap:6,flex:1,minHeight:0}}>
      <PageNav page={bp} setPage={setBp} total={4} color="var(--bom)"
        labels={['Datos de entrada','Pérdidas de carga','Bomba sumergible','Cámara bombeo']} />
      <div className="card" style={{flex:1,display:'flex',flexDirection:'column',minHeight:0}}>
        <div className="card-h">
          <span className="card-t"><img src={pages[bp-1].icon} alt="" style={{width:24,height:24,verticalAlign:'middle',marginRight:4}} />{pages[bp-1].t}</span>
        </div>
        <div style={{flex:1,padding:6,overflow:'hidden'}}>
          {pages[bp-1].c}
        </div>
      </div>
    </div>
  );
}
