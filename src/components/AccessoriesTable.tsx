import { memo } from 'react';
import { ACCESORIOS_HIDRO } from "../constants";
import { pisoCorto } from "../constants";
const cBg2 = '#1e293b';
const AccessoriesTable_S1: React.CSSProperties = { minWidth:36,textAlign:'center',position:'sticky',left:0,zIndex:2,background:cBg2,fontSize: 9,padding:'2px 2px' };
const AccessoriesTable_S2: React.CSSProperties = { minWidth:36,textAlign:'center',position:'sticky',left:64,zIndex:2,background:cBg2,fontSize: 9,padding:'2px 2px' };
const AccessoriesTable_S3: React.CSSProperties = { fontSize: 9,textAlign:'center',fontWeight:600,position:'sticky',left:0,background:cBg2,zIndex:1,padding:'2px 2px',whiteSpace:'nowrap' };
const AccessoriesTable_S4: React.CSSProperties = { fontSize: 9,textAlign:'center',position:'sticky',left:64,background:cBg2,zIndex:1,padding:'2px 2px',color:'var(--txt2)' };


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
  return (
    <section className="card">
      <div className="card-h">
        <h3 className="card-t"><img src="/iconos_diseno_redes/general/Accesorios.svg" alt="Accesorios"  width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}}  loading="lazy" /> Accesorios por ramal</h3>
        <span className="card-s">{tramos.length} tramos</span>
      </div>
      <div className="scroll-top" style={{padding:'12px'}}>
        <div className="scroll-inner" style={{minWidth:'max-content'}}>
          <table className="tbl" style={{minWidth:520,fontSize: 9}}>
            <thead>
              <tr>
                <th scope="col" className="col-h" style={AccessoriesTable_S1}>Tramo</th>
                <th scope="col" className="col-h" style={AccessoriesTable_S2}>Nivel</th>
                {ACCESORIOS_HIDRO.map(a => (
                  <th scope="col" key={a.id} className="col-h" style={{minWidth:40,fontSize: 9,textAlign:'center',whiteSpace:'nowrap',padding:'2px 1px'}}>
                    <img src={a.icono} alt={a.nombre}  width={24} height={24} style={{width:24,height:24,objectFit:'contain',display:'block',margin:'0 auto 2px'}}  loading="lazy" />
                    <span style={{fontSize: 9,fontWeight:500}}>{a.nombre}</span>
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
                    <td className="c" style={AccessoriesTable_S3}>{lbl}</td>
                    <td className="c" style={AccessoriesTable_S4}>{nivelLbl}</td>
                    {ACCESORIOS_HIDRO.map(a => {
                      const v = t.accesorios?.[a.id] || 0;
                      return (
                        <td key={a.id} className="c" style={{padding:'4px 2px'}}>
                          <span style={{fontSize: 9,fontFamily:cMono,color:v>0?'var(--txt)':'var(--txt3)'}}>{v || '\u2014'}</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {tramos.length === 0 && (
                <tr>
                  <td className="c" colSpan={2 + ACCESORIOS_HIDRO.length} style={{fontSize: 9,color:'var(--txt3)',padding:'24px 0',textAlign:'center'}}>
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
