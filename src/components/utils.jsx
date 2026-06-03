export function calcUDparcial(tramo,udB){
  return udB.reduce((s,d)=>s+((tramo.fixtures[d.id]||0)*d.ud),0);
}

export function calcUDacumulado(tramos,udB){
  const resueltos={};
  const maxIter=tramos.length*2;
  for(let iter=0;iter<maxIter;iter++){
    let changed=false;
    for(const t of tramos){
      if(resueltos[t.id]!==undefined) continue;
      const parcial=calcUDparcial(t,udB);
      if((t.recibeDe||[]).length===0){
        resueltos[t.id]=parcial;
        changed=true;
      }else{
        const deps=t.recibeDe||[];
        if(deps.every(d=>resueltos[d]!==undefined)){
          const otros=deps.reduce((s,d)=>s+(resueltos[d]||0),0);
          resueltos[t.id]=parcial+otros;
          changed=true;
        }
      }
    }
    if(!changed) break;
  }
  for(const t of tramos){
    if(resueltos[t.id]===undefined) resueltos[t.id]=calcUDparcial(t,udB);
  }
  return resueltos;
}

export function calcUCparcial(tramo, baseArr, field) {
  return baseArr.reduce((s,d)=>s+((tramo.fixtures[d.id]||0)*(d[field]||0)),0);
}

export function calcUCacumulado(tramos, baseArr, field) {
  const resueltos={};
  const maxIter=tramos.length*2;
  for(let iter=0;iter<maxIter;iter++){
    let changed=false;
    for(const t of tramos){
      if(resueltos[t.id]!==undefined) continue;
      const parcial=calcUCparcial(t, baseArr, field);
      if((t.recibeDe||[]).length===0){
        resueltos[t.id]=parcial;
        changed=true;
      }else{
        const deps=t.recibeDe||[];
        if(deps.every(d=>resueltos[d]!==undefined)){
          const otros=deps.reduce((s,d)=>s+(resueltos[d]||0),0);
          resueltos[t.id]=parcial+otros;
          changed=true;
        }
      }
    }
    if(!changed) break;
  }
  for(const t of tramos){
    if(resueltos[t.id]===undefined) resueltos[t.id]=calcUCparcial(t, baseArr, field);
  }
  return resueltos;
}

export function NumIn({val,onChange,cls='',w=52,step=0.01,min=0,inputStyle}){
  return <input type="number" className={`ni ${cls}`} style={{width:w,...inputStyle}}
    value={val === 0 ? '' : val} step={step} min={min}
    onChange={e => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}/>;
}
