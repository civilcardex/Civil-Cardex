import { memo } from 'react';
import { ACCESORIOS_HIDRO } from "../constants";
import { pisoCorto } from "../constants";

const isContador = (s: string) => s.startsWith('CNT') || s.startsWith('cntAF');

const isAC1 = (ini: string, fin: string) => {
  if (ini.startsWith('RP') || fin.startsWith('RP')) return true;
  if (isContador(fin) && !isContador(ini) && !ini.startsWith('M') && !ini.startsWith('B')) return true;
  return false;
};
const isAC2 = (ini: string, fin: string) => {
  if (ini.startsWith('RP') || fin.startsWith('RP')) return false;
  if (isContador(ini)) return true;
  if (isContador(fin) && (ini.startsWith('M') || ini.startsWith('B'))) return true;
  return false;
};

const AccesoriosTable = memo(function AccesoriosTable({ tramos }: { tramos: any[] }) {
  const cMono = "'Courier New',Courier,monospace";
  const cBg2 = '#1e293b';
  return (
    <section className="card">
      <div className="card-h">
        <h3 className="card-t"><img src="/iconos_diseno_redes/general/Accesorios.svg" alt="Accesorios"  width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}}  loading="lazy" /> Accesorios por ramal</h3>
        <span className="card-s">{tramos.length} tramos</span>
      </div>
      <div className="scroll-top" style={{padding:'12px'}}>
        <div className="scroll-inner" style={{minWidth:'max-content'}}>
          <table className="tbl" style={{minWidth:700,fontSize:13}}>
            <thead>
              <tr>
                <th scope="col" className="col-h" style={{minWidth:64,textAlign:'center',position:'sticky',left:0,zIndex:2,background:cBg2,fontSize:11,padding:'5px 4px'}}>Tramo</th>
                <th scope="col" className="col-h" style={{minWidth:48,textAlign:'center',position:'sticky',left:64,zIndex:2,background:cBg2,fontSize:10,padding:'5px 4px'}}>Nivel</th>
                {ACCESORIOS_HIDRO.map(a => (
                  <th scope="col" key={a.id} className="col-h" style={{minWidth:56,fontSize:10,textAlign:'center',whiteSpace:'nowrap',padding:'5px 2px'}}>
                    <img src={a.icono} alt={a.nombre}  width={24} height={24} style={{width:24,height:24,objectFit:'contain',display:'block',margin:'0 auto 2px'}}  loading="lazy" />
                    <span style={{fontSize:9,fontWeight:500}}>{a.nombre}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tramos.map((t, i) => {
                const iniStr = String(t.ini || '');
                const finStr = String(t.fin || '');
                const lbl = isAC1(iniStr, finStr) ? `AC-01` : isAC2(iniStr, finStr) ? `AC-02 (${t.label || t.id})` : t.label || t.id;
                const nivelLbl = t._nivelLabel || (t.piso != null ? pisoCorto(t.piso) : '—');
                return (
                  <tr key={i}>
                    <td className="c" style={{fontSize:12,textAlign:'center',fontWeight:600,position:'sticky',left:0,background:cBg2,zIndex:1,padding:'4px 4px',whiteSpace:'nowrap'}}>{lbl}</td>
                    <td className="c" style={{fontSize:10,textAlign:'center',position:'sticky',left:64,background:cBg2,zIndex:1,padding:'4px 4px',color:'var(--txt2)'}}>{nivelLbl}</td>
                    {ACCESORIOS_HIDRO.map(a => {
                      const v = t.accesorios?.[a.id] || 0;
                      return (
                        <td key={a.id} className="c" style={{padding:'4px 2px'}}>
                          <span style={{fontSize:13,fontFamily:cMono,color:v>0?'var(--txt)':'var(--txt3)'}}>{v || '\u2014'}</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {tramos.length === 0 && (
                <tr>
                  <td className="c" colSpan={2 + ACCESORIOS_HIDRO.length} style={{fontSize:11,color:'var(--txt3)',padding:'24px 0',textAlign:'center'}}>
                    No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
});

export default AccesoriosTable;
