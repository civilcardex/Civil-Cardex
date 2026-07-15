import React, { useState } from "react";
import { dec } from "../utils/parseDecimal";
import PageNav from './PageNav';
import { SI, TH, TD } from "../styles/sharedTableStyles";
import EditButton from "./shared/EditButton";
const BombaARDesign_S1: React.CSSProperties = { position:'absolute',width:'1px',height:'1px',padding:0,margin:'-1px',overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0 };
const BombaARDesign_S2: React.CSSProperties = { position:'absolute',width:'1px',height:'1px',padding:0,margin:'-1px',overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0 };
const BombaARDesign_S3: React.CSSProperties = { position:'absolute',width:'1px',height:'1px',padding:0,margin:'-1px',overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0 };
const BombaARDesign_S4: React.CSSProperties = { position:'absolute',width:'1px',height:'1px',padding:0,margin:'-1px',overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0 };
const BombaARDesign_S5: React.CSSProperties = { position:'absolute',width:'1px',height:'1px',padding:0,margin:'-1px',overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0 };


const nv=(s: string)=>s===''?'':/^[\d]*\.?[\d]*$/.test(s)?s:false;
const oc=(set: (v: any) => void)=>(e: React.ChangeEvent<HTMLInputElement>)=>{const v=nv(e.target.value);if(v!==false)set(v)};

const TDBom: React.CSSProperties = {...TD,background:'#1a1c20'};
const TDL: React.CSSProperties={...TDBom,textAlign:'left',fontFamily:'var(--body)'};
const Fmt=(v: any,u='')=>{
  if(v===''||v===null||v===undefined)return <span style={{color:'var(--txt3)',fontSize: 12}}>—</span>;
  const val=typeof v==='number'?v.toFixed(2):v;
  return <span style={{fontFamily:'var(--mono)'}}>{val}{u?` ${u}`:''}</span>;
};

const SI2={...SI,fontSize:13,padding:'4px 6px'};
const TH2={...TH,fontSize: 12};
const TD2={...TDBom,fontSize:13};
const TDL2={...TDL,fontSize:13,fontWeight:700,color:'var(--txt)'};
const Fmt2=(v: any,u='')=>{
  if(v===''||v===null||v===undefined)return <span style={{color:'var(--txt3)',fontSize:12}}>—</span>;
  const val=typeof v==='number'?v.toFixed(2):v;
  return <span style={{fontFamily:'var(--mono)',fontSize:13}}>{val}{u?` ${u}`:''}</span>;
};

function Inp({v,set,style,disabled,ariaLabel}: {v: any; set: (v: any) => void; style?: React.CSSProperties; disabled?: boolean; ariaLabel?: string}){return <input type="text" inputMode="decimal" aria-label={ariaLabel} value={v} onChange={oc(set)} disabled={disabled} style={{...(style||SI), opacity: disabled ? 0.6 : 1, cursor: disabled ? 'default' : 'text'}}/>;}
function Tbl({cols,rows,th,td,tdl,fontSize,center,valueCol,caption}: {cols: string[]; rows: any[][]; th?: any; td?: any; tdl?: any; fontSize?: number; center?: boolean; valueCol?: number; caption?: string}){
  const h=th||TH,d=td||TDBom,dl=tdl||TDL;
  const vc = valueCol ?? 2;
  return <table className="tbl" style={{fontSize:fontSize||11,width:center?'90%':'100%',maxWidth:900,borderCollapse:'collapse',margin:center?'0 auto':0}}>
    {caption && <caption style={BombaARDesign_S1}>{caption}</caption>}
    <thead><tr>{cols.map((c,i)=><th scope="col" key={i} style={h}>{c}</th>)}</tr></thead>
    <tbody>{rows.map((r,i)=><tr key={i}>{r.map((c,j)=>{
      const s = j===0 ? dl : j===vc ? {...d,width:'1%',whiteSpace:'nowrap'} : d;
      return <td key={j} style={s}>{c}</td>;
    })}</tr>)}</tbody>
  </table>;
}


const BombaARDesign_COLS1=['Parámetro','Símbolo','Valor','Unidad','Equivalencia','Fuente / norma'];
const BombaARDesign_COLS2=['Componente','Símbolo','Valor','Unidad','Equivalencia','Observación'];

function BombaARDesign(){
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

  const [editP1, setEditP1] = useState(false);
  const [editP3, setEditP3] = useState(false);
  const [editP4, setEditP4] = useState(false);

  const sal=dec(salSim); const ud=dec(udTot); const li=dec(lImp);
  const di=dec(dImp); const ch=dec(cHW)||150; const pd=dec(pDesc);
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

  const Nota=<div style={{fontSize: 12,color:'var(--txt3)',lineHeight:1.6,padding:'8px 12px',marginTop:6,borderRadius:'var(--r)',background:'var(--bg2)'}}>
    <b style={{color:'var(--txt)'}}>Nota normativa</b> — Diseño conforme <b style={{color:'var(--txt)'}}>NTC 1500 §8</b> y <b style={{color:'var(--txt)'}}>RAS 2000 Título D</b>. La bomba trituradora es obligatoria para sólidos fecales. Verificar caudal con empresa de servicios (EMAB/AMB) antes de definir acometida.
  </div>;

  const COLS1=BombaARDesign_COLS1;
  const COLS2=BombaARDesign_COLS2;

  const page1=(
    <Tbl th={TH2} td={TD2} tdl={TDL2} fontSize={13} valueCol={2} caption="Datos de entrada" cols={COLS1} rows={[
        ['Número de salidas simultáneas','Sal sim',<Inp disabled={!editP1} v={salSim} set={setSalSim} ariaLabel="Número de salidas simultáneas" style={SI2}/>,'und','—','Probabilidad de trabajar al máximo'],
        ['UD acumuladas en sótano','UD tot',<Inp disabled={!editP1} v={udTot} set={setUdTot} ariaLabel="UD acumuladas en sótano" style={SI2}/>,'UD','—','NTC 1500'],
        ['Coeficiente K simultaneidad Hunter','K',Fmt2(K),'—','—','K = 1/√(n−1)'],
        ['Caudal de diseño Q = UD × K','Q dis',Fmt2(Qd),'lps',Fmt2((Qd*15.8503).toFixed(2),'GPM'),'Método Hunter NTC 1500'],
        ['Caudal bombeo Qb (reserva 25%)','Q b',Fmt2(Qb),'lps',Fmt2((Qb*15.8503).toFixed(2),'GPM'),'Factor seguridad sobre Q diseño'],
        ['Altura geométrica sótano → piso 1','Hz',<Inp disabled={!editP1} v={hz} set={setHz} ariaLabel="Altura geométrica" style={SI2}/>,'m','—','Diferencia de nivel'],
        ['Longitud total tubería impulsión','L imp',<Inp disabled={!editP1} v={lImp} set={setLImp} ariaLabel="Longitud tubería impulsión" style={SI2}/>,'m','—','Tramos verticales + horizontales'],
        ['Diámetro tubería impulsión','D imp',<Inp disabled={!editP1} v={dImp} set={setDImp} ariaLabel="Diámetro tubería impulsión" style={SI2}/>,'pulg',di?Fmt2((di*25).toFixed(2),'mm'):<span style={{color:'var(--txt3)',fontSize:12}}>—</span>,'Mínimo 2" NTC 1500 §8'],
        ['Coeficiente C Hazen-Williams (PVC)','C HW',<Inp disabled={!editP1} v={cHW} set={setCHW} ariaLabel="Coeficiente C Hazen-Williams" style={SI2}/>,'—','—','RAS 2000 §B.6.4.2 — PVC liso nuevo'],
        ['Presión mínima en descarga','P desc',<Inp disabled={!editP1} v={pDesc} set={setPDesc} ariaLabel="Presión mínima en descarga" style={SI2}/>,'m.c.a.',pd?Fmt2((pd*1.42).toFixed(2),'psi'):<span style={{color:'var(--txt3)',fontSize:12}}>—</span>,'Presión en punto entrega piso 1'],
        ['Eficiencia bomba η','eta b',<Inp disabled={!editP1} v={etaB} set={setEtaB} ariaLabel="Eficiencia bomba" style={SI2}/>,'—','—','Bomba sumergible trituradora típica: 60–70%'],
        ['Factor de servicio motor','f srv',<Inp disabled={!editP1} v={fSrv} set={setFSrv} ariaLabel="Factor de servicio motor" style={SI2}/>,'—','—','NEMA MG1: reserva 25% sobre P calculada'],
      ]}/>
  );

  const page2=<Tbl th={TH2} td={TD2} tdl={TDL2} fontSize={13} caption="Cálculo de pérdidas de carga" cols={COLS2} rows={[
    ['Velocidad en tubería impulsión','V imp',Fmt2(Vi),'m/s','—','0.6 < V < 3.5 m/s para residuales'],
    ['Pérdida fricción (Hazen-Williams)','Hf',Fmt2(Hf),'m.c.a.','—','hf = 10.67·L·Q^1.852 / (C^1.852·D^4.87)'],
    ['Pérdida en accesorios (25% de Hf)','H ac',Fmt2(Hac),'m.c.a.','—','Estimación conservadora'],
    ['Pérdida total por fricción','H fri',Fmt2(Hfri),'m.c.a.','—','Hf tubería + accesorios'],
    ['Altura estática total','H est',Fmt2(Hest),'m.c.a.','—','Hz geométrica + presión mínima descarga'],
    ['Altura manométrica total Hm','H m',Fmt2(Hm),'m.c.a.',Hm?Fmt2((Hm*1.42).toFixed(2),'psi'):<span style={{color:'var(--txt3)',fontSize:12}}>—</span>,'Hm = H fri + H est'],
    ['Chequeo velocidad','V chk',<span style={{color:Vch==='O.K.'?'#22c55e':'#ef5350',fontWeight:700,fontFamily:'var(--mono)',fontSize:13}}>{Vch}</span>,'—','—','Verificación automática'],
  ]}/>;

  const page3=<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%', alignItems: 'start' }}>
    <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--line)', borderRadius: 'var(--r)', overflow: 'hidden', background: 'var(--bg)' }}>
      <div className="card-h" style={{padding:'8px 8px', display: 'flex', alignItems: 'center'}}>
        <h3 className="card-t"><img src="/iconos_civilflow/diseno_redes/equipos/bomba_sumergible_trituradora.webp" alt="Bomba sumergible trituradora"  width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}}  loading="lazy" />Parámetros de diseño bomba sumergible</h3>
        <EditButton edit={editP3} setEdit={setEditP3} />
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <caption style={BombaARDesign_S2}>Parámetros de diseño bomba sumergible</caption>
        <thead><tr>{COLS1.map((c,i)=><th scope="col" key={i} style={TH2}>{c}</th>)}</tr></thead>
        <tbody>{[
          ['Caudal nominal bomba','Q b',Fmt(Qb),'lps',Fmt((Qb*15.8503).toFixed(2),'GPM'),'Incluye reserva 25%'],
          ['Altura manométrica Hm','H m',Fmt(Hm),'m.c.a.',Hm?Fmt((Hm*1.42).toFixed(2),'psi'):<span style={{color:'var(--txt3)',fontSize: 12}}>—</span>,'Tomado de bloque 2'],
          ['Potencia hidráulica','P hid',Fmt(Ph),'W',Ph?Fmt((Ph/746).toFixed(2),'HP'):<span style={{color:'var(--txt3)',fontSize: 12}}>—</span>,'Ph = ρ·g·Q·Hm / 1000'],
          ['Potencia en el eje','P eje',Fmt(Peje),'W',Peje?Fmt((Peje/746).toFixed(2),'HP'):<span style={{color:'var(--txt3)',fontSize: 12}}>—</span>,'P eje = Ph / η bomba'],
          ['Potencia comercial (×f srv)','P com',Fmt(Pcom),'W',Pcom?Fmt(php.toFixed(2),'HP'):<span style={{color:'var(--txt3)',fontSize: 12}}>—</span>,'Motor seleccionar ≥ este valor'],
          ['Selección comercial automática','Sel',<span style={{color:'var(--acc2)',fontWeight:700,fontFamily:'var(--mono)'}}>{Sel}</span>,'HP','—','Estándar: 0.5 / 1 / 2 / 3 / 5 HP'],
          ['Tipo de bomba','Tipo','Sumergible trituradora','—','—','NTC 1500 §8.5 — residuales con sólidos'],
          ['NPSH disponible mínimo','NPSH',<Inp disabled={!editP3} v={npsh} set={setNpsh} ariaLabel="NPSH disponible mínimo" style={{...SI, width: 35, fontSize: 12, padding: '2px 3px'}}/>,'m','—','Verificar con curva del fabricante'],
        ].map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j} style={j===0?{...TDL2, color: '#fff'}:j===2?{...TDBom,fontSize: 12,width:'35px',whiteSpace:'nowrap'}:j===5?{...TD2, width: '30%'}:TD2}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
    
    <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--line)', borderRadius: 'var(--r)', overflow: 'hidden', background: 'var(--bg)' }}>
      <div className="card-h" style={{padding:'8px 8px'}}>
        <h3 className="card-t"><img src="/iconos_civilflow/diseno_redes/equipos/especificacion_camara_trituradora.webp" alt="Especificación cámara trituradora"  width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}}  loading="lazy" />Especificación — Bomba sumergible trituradora</h3>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <caption style={BombaARDesign_S3}>Especificación — Bomba sumergible trituradora</caption>
        <thead><tr>{['Ítem','Valor'].map((c,i)=><th scope="col" key={i} style={TH2}>{c}</th>)}</tr></thead>
        <tbody>{[
          ['Caudal nominal',Fmt((Qb*15.8503).toFixed(2),'GPM')],
          ['Altura manométrica total (Hm)',Fmt(Hm,'m.c.a.')],
          ['Potencia motor',<span style={{color:'var(--acc2)',fontWeight:700,fontFamily:'var(--mono)'}}>{Sel}</span>],
          ['Tipo','Bomba sumergible trituradora, impeler monocanal'],
          ['Tensión','110V o 220V monofásica — confirmar con proveedor'],
        ].map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j} style={j===0?{...TDL2, color: '#fff'}:TD2}>{c}</td>)}</tr>)}</tbody>
      </table>
      {Nota}
    </div>
  </div>;

  const page4=<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%', alignItems: 'start' }}>
    <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--line)', borderRadius: 'var(--r)', overflow: 'hidden', background: 'var(--bg)' }}>
      <div className="card-h" style={{padding:'8px 8px', display: 'flex', alignItems: 'center'}}>
        <h3 className="card-t"><img src="/iconos_civilflow/diseno_redes/equipos/camara_bombeo.webp" alt="Cámara de bombeo"  width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}}  loading="lazy" />Parámetros de diseño cámara de bombeo</h3>
        <EditButton edit={editP4} setEdit={setEditP4} />
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <caption style={BombaARDesign_S4}>Parámetros de diseño cámara de bombeo</caption>
        <thead><tr>{COLS1.map((c,i)=><th scope="col" key={i} style={TH2}>{c}</th>)}</tr></thead>
        <tbody>{[
          ['Tiempo mínimo ciclo arranque','t cic',<Inp disabled={!editP4} v={tCic} set={setTCic} ariaLabel="Tiempo mínimo ciclo arranque" style={SI}/>,'min','—','Mínimo 5 min entre arranques'],
          ['Volumen útil cámara mínimo','V cam',Fmt(Vcam),'lts',Vcam?Fmt((Vcam/1000).toFixed(2),'m³'):<span style={{color:'var(--txt3)',fontSize: 12}}>—</span>,'V = Qb(lps) × t(s)'],
          ['Tirante mínimo sobre bomba','h min',<Inp disabled={!editP4} v={hMin} set={setHMin} ariaLabel="Tirante mínimo sobre bomba" style={SI}/>,'m','—','Evita cavitación'],
          ['Tirante máximo antes de arrancar','h max',<Inp disabled={!editP4} v={hMax} set={setHMax} ariaLabel="Tirante máximo" style={SI}/>,'m','—','Nivel activación flotador'],
          ['Ancho mínimo cámara','b cam',<Inp disabled={!editP4} v={bCam} set={setBCam} ariaLabel="Ancho mínimo cámara" style={SI}/>,'m','—','NTC 1500 §8.5 — mínimo 60 cm'],
          ['Largo mínimo cámara','l cam',<Inp disabled={!editP4} v={lCam} set={setLCam} ariaLabel="Largo mínimo cámara" style={SI}/>,'m','—','Verificar con dimensiones bomba'],
          ['Volumen geométrico disponible','V geo',Fmt(Vgeo),'m³',Vgeo?Fmt((Vgeo*1000).toFixed(2),'lts'):<span style={{color:'var(--txt3)',fontSize: 12}}>—</span>,'b×l×(h max−h min)'],
          ['Chequeo volumen','V chk',<span style={{color:Vchk==='O.K.'?'#22c55e':'#ef5350',fontWeight:700,fontFamily:'var(--mono)'}}>{Vchk||'—'}</span>,'—','—','V geo ≥ V cam requerido'],
        ].map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j} style={j===0?{...TDL2, color: '#fff'}:j===2?{...TD2,width:'1%',whiteSpace:'nowrap'}:TD2}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
    
    <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--line)', borderRadius: 'var(--r)', overflow: 'hidden', background: 'var(--bg)' }}>
      <div className="card-h" style={{padding:'8px 8px'}}>
        <h3 className="card-t"><img src="/iconos_civilflow/diseno_redes/equipos/especificacion_camara_bombeo.webp" alt="Especificación cámara de bombeo"  width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}}  loading="lazy" />Especificación — Cámara de bombeo</h3>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <caption style={BombaARDesign_S5}>Especificación — Cámara de bombeo</caption>
        <thead><tr>{['Ítem','Valor'].map((c,i)=><th scope="col" key={i} style={TH2}>{c}</th>)}</tr></thead>
        <tbody>{[
          ['Volumen útil requerido',Fmt(Vcam,'lts')],
          ['Dimensiones mínimas (m)',bc&&lc&&(hmx-hmn)?<span style={{fontFamily:'var(--mono)'}}>{`${bc} x ${lc} x ${(hmx-hmn).toFixed(2)}`}</span>:<span style={{color:'var(--txt3)',fontSize: 12}}>—</span>],
          ['Material','Concreto impermeabilizado o polietileno PEAD'],
          ['Accesorios obligatorios','Rejilla aguas arriba + ventilación Ø2" + alarma nivel alto'],
        ].map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j} style={j===0?{...TDL2, color: '#fff'}:TD2}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  </div>;

  const pages=[
    {t:'Datos de entrada',icon:'/iconos_civilflow/diseno_redes/general/datos_de_entrada.webp',c:page1},
    {t:'Cálculo de pérdidas de carga',icon:'/iconos_civilflow/diseno_redes/general/calculo_perdidas_de_carga.webp',c:page2},
    {t:'Bomba sumergible trituradora',icon:'/iconos_civilflow/diseno_redes/equipos/bomba_sumergible_trituradora.webp',c:page3, noWrap: true},
    {t:'Cámara de bombeo (pozo húmedo)',icon:'/iconos_civilflow/diseno_redes/equipos/camara_bombeo.webp',c:page4, noWrap: true},
  ];

  return(
    <div className="fu" style={{display:'flex',flexDirection:'column',gap:6,flex:1,minHeight:0}}>
      <PageNav page={bp} setPage={setBp} total={4} color="var(--bom)"
        labels={['Datos de entrada','Pérdidas de carga','Bomba sumergible','Cámara bombeo']} />
      <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0,alignItems:'center'}}>
        {pages[bp-1].noWrap ? (
          <div style={{width:'100%', display:'flex', flexDirection:'column', flex:1, padding: '0 10px', boxSizing: 'border-box', overflowY: 'auto'}}>
            {pages[bp-1].c}
          </div>
        ) : (
          <div style={{width:'90%',maxWidth:900,overflow:'hidden',borderRadius:'var(--r)',border:'1px solid var(--line)'}}>
            <div className="card-h" style={{padding:'8px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
              <h3 className="card-t"><img src={pages[bp-1].icon} alt=""  width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}}  loading="lazy" />{pages[bp-1].t}</h3>
              {bp === 1 && <EditButton edit={editP1} setEdit={setEditP1} />}
            </div>
            <div style={{flex:1,padding:0,overflow:'auto'}}>
              {pages[bp-1].c}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default React.memo(BombaARDesign);