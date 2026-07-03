import { DIAM_BY_MAT } from '../../constants'
import { GAS } from '../../constants/engineeringDataGas'
import { VENTILACION } from '../../pages/catalog/catalogData'

interface RamalEditorProps {
  selElement: any;
  activeNet: string;
  engineRef: any;
  setSelElement: React.Dispatch<React.SetStateAction<any>>;
  isSelActiveNet: boolean;
  diamSel: Record<string, string>;
  gasMatSel: Record<string, string>;
  pendSel: Record<string, number>;
  pendInput: string;
  mats: Record<string, Array<{ val: string }>> | null;
  matLongName: (short: string) => string;
  setDiamSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setGasMatSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setPendSel: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setPendInput: React.Dispatch<React.SetStateAction<string>>;
}

export default function RamalEditor({
  selElement, activeNet, engineRef, setSelElement,
  isSelActiveNet, diamSel, gasMatSel, pendSel, pendInput,
  mats, matLongName,
  setDiamSel, setGasMatSel, setPendSel, setPendInput,
}: RamalEditorProps) {
  const isGas = activeNet === 'gas';
  const isVen = activeNet === 'vent';
  const matList = mats?.[activeNet] || [];
  const matShort = matList[0]?.val || '—';
  const matName = matLongName(matShort);
  let diamList: any[] = [];
  if (isVen) {
    diamList = VENTILACION[0]?.rows.map((r: any) => ({ n: r.dn })) || [];
  } else {
    diamList = DIAM_BY_MAT[matShort] || [];
  }
  let currentDiam: string = '', currentMat: any = '';
  if (isGas) {
    const selMat = (isSelActiveNet && selElement.material) || gasMatSel[activeNet] || '';
    const selDn = (isSelActiveNet && selElement.diametro !== undefined && selElement.diametro !== '')
      ? selElement.diametro : (diamSel[activeNet] || '');
    currentMat = selMat || GAS[0]?.mat || '';
    currentDiam = selDn || GAS[0]?.rows[0]?.dn || '';
  } else {
    currentDiam = (isSelActiveNet && selElement.diametro !== undefined && selElement.diametro !== '')
      ? selElement.diametro.split(' — ')[0].trim()
      : (diamSel[activeNet] || '');
  }
  const showPend = activeNet === 'san' || activeNet === 'll';
  const showDeltaZ = activeNet === 'af' || activeNet === 'ac' || activeNet === 'gas';
  const showDescargas = activeNet === 'af' || activeNet === 'ac' || activeNet === 'san';
  return (
    <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
      <div style={{ fontFamily: "'Geist',monospace", fontSize: 10, color: "#9BA8AA", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Datos específicos</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

        {isGas ? (
          <div>
            <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Material</div>
            <select value={currentMat} aria-label="Material"
              onChange={e => {
                const mat = e.target.value;
                const g = GAS.find(x => x.mat === mat);
                const dn = g ? g.rows[0]?.dn || '' : '';
                setGasMatSel(prev => ({ ...prev, [activeNet]: mat }));
                setDiamSel(prev => ({ ...prev, [activeNet]: dn }));
                if (engineRef.current && selElement) {
                  engineRef.current.updateSelected({ material: mat, diametro: dn });
                  setSelElement({ ...selElement, material: mat, diametro: dn });
                }
              }}
              style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer', textAlign: 'center' }}>
              {GAS.map(g => (
                <option key={g.mat} value={g.mat}>{g.mat}</option>
              ))}
            </select>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '3px 8px', background: '#1a1c20', border: '1px solid #282a2e', borderRadius: 3 }}>
            <span style={{ fontSize: 9, color: '#8AB4D6', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 1, flexShrink: 0 }}>Material</span>
            <span style={{ fontSize: 10, color: '#b9caca', fontFamily: "'Geist',monospace", fontWeight: 600, textAlign: 'right', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={matName}>{matName}</span>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: showPend ? '1fr 1fr' : '1fr', gap: 6 }}>
          <div>
            <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Diámetro</div>
    {isGas ? (
      <select value={currentDiam} aria-label="Diámetro"
      onChange={e => {
        const dn = e.target.value;
        setDiamSel(prev => ({ ...prev, [activeNet]: dn }));
        if (engineRef.current && selElement) {
          const fields = { diametro: dn };
          engineRef.current.updateSelected(fields);
          setSelElement({ ...selElement, diametro: fields.diametro });
        } else if (engineRef.current && !selElement) {
          const eng = engineRef.current;
          const lastRamal = [...eng.ramales].reverse().find((r: any) => r.net === activeNet);
          if (lastRamal) {
            eng.selId = lastRamal.id;
            eng.updateSelected({ diametro: dn });
            const { _circ, _ghost, _box, _polyBox, _labelBox, ...rest } = lastRamal;
            setSelElement({ ...rest, diametro: dn });
          }
        }
      }}
      style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer', textAlign: 'center' }}>
        {(() => {
          const gasMat = GAS.find(g => g.mat === currentMat);
          return gasMat ? gasMat.rows.map((r: any) => (
            <option key={r.dn} value={r.dn}>{r.dn}"</option>
          )) : <option value="">—</option>;
        })()}
      </select>
    ) : diamList.length > 0 ? (
      <select value={currentDiam} aria-label="Diámetro"
      onChange={e => {
        const v = e.target.value;
        setDiamSel(prev => ({ ...prev, [activeNet]: v }));
        if (engineRef.current && selElement) {
          const fields = { diametro: v };
          engineRef.current.updateSelected(fields);
          setSelElement({ ...selElement, diametro: fields.diametro });
        } else if (engineRef.current && !selElement) {
          const eng = engineRef.current;
          const lastRamal = [...eng.ramales].reverse().find((r: any) => r.net === activeNet);
          if (lastRamal) {
            eng.selId = lastRamal.id;
            eng.updateSelected({ diametro: v });
            const { _circ, _ghost, _box, _polyBox, _labelBox, ...rest } = lastRamal;
            setSelElement({ ...rest, diametro: v });
          }
        }
      }}
      style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer', textAlign: 'center' }}>
      <option value="">Sin diámetro</option>
      {diamList.map((d: any) => {
        const valClean = d.n.split(' — ')[0].trim();
        return <option key={d.n} value={valClean}>{valClean}</option>;
      })}
      </select>
                ) : (
                  <div style={{ padding: '4px 6px', background: '#1e2024', border: '1px solid #3a494a', borderRadius: 3, color: '#8AB4D6', fontSize: 11, fontFamily: "'Geist',monospace" }}>— Sin opciones —</div>
                )}
            </div>
    {showPend ? (
      <div>
        <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Pendiente %</div>
        <input type="text" inputMode="decimal" value={pendInput} aria-label="Pendiente (%)"
          onChange={e => {
            const raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
            setPendInput(raw);
          }}
          onBlur={e => {
            const v = parseFloat(e.target.value.replace(/,/g, '.')) || 0;
            setPendInput(v > 0 ? String(v) : '');
            setPendSel(prev => ({ ...prev, [activeNet]: v }));
            if (engineRef.current && selElement) {
              engineRef.current.updateSelected({ pendiente: v });
              setSelElement({ ...selElement, pendiente: v });
            } else if (engineRef.current && !selElement) {
              const eng = engineRef.current;
              const lastRamal = [...eng.ramales].reverse().find((r: any) => r.net === activeNet);
              if (lastRamal) {
                eng.selId = lastRamal.id;
                eng.updateSelected({ pendiente: v });
                const { _circ, _ghost, _box, _polyBox, _labelBox, ...rest } = lastRamal;
                setSelElement({ ...rest, pendiente: v });
              }
            }
          }}
          onFocus={() => {
            const current = (isSelActiveNet && selElement?.pendiente !== undefined)
              ? selElement.pendiente
              : (pendSel[activeNet] !== undefined ? pendSel[activeNet] : 2.0);
            setPendInput(current > 0 ? String(current) : '');
          }}
        style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", textAlign: 'center' }}
        />
            </div>
            ) : null}
          </div>
          {showDeltaZ && !isGas && (
            <div style={{ display: 'grid', gridTemplateColumns: showDescargas ? '1fr 1fr' : '1fr', gap: 6 }}>
              <div>
                <div style={{ fontSize: 8.5, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0, whiteSpace: 'nowrap' }}>Altura (m)</div>
                <input type="number" step="0.01" value={selElement?.dz ?? ''} placeholder="0.00" aria-label="Delta Z o longitud vertical (m)"
                  onChange={e=>{if(engineRef.current){const v=e.target.value;engineRef.current.updateSelected({dz:v,lvert:v});setSelElement({...selElement,dz:v,lvert:v})}}}
                  style={{width:'100%',padding:"4px 6px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize:11,fontFamily:"'Geist',monospace",textAlign:'center'}}/>
              </div>
              {showDescargas && (
                <div>
                  <div style={{ fontSize: 8.5, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0, whiteSpace: 'nowrap' }}>No. de descargas</div>
                  <input type="number" step="1" min="0" value={selElement?.nSalidas ?? ''} placeholder="0" aria-label="Número de descargas"
                    onChange={e=>{if(engineRef.current){const v=parseInt(e.target.value)||0;engineRef.current.updateSelected({nSalidas:v});setSelElement({...selElement,nSalidas:v})}}}
                    style={{width:'100%',padding:"4px 6px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize:11,fontFamily:"'Geist',monospace",textAlign:'center'}}/>
                </div>
              )}
            </div>
          )}
          {!showDeltaZ && showDescargas && (
            <div>
              <div style={{ fontSize: 8.5, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0, whiteSpace: 'nowrap' }}>No. de descargas</div>
              <input type="number" step="1" min="0" value={selElement?.nSalidas ?? ''} placeholder="0" aria-label="Número de descargas"
                onChange={e=>{if(engineRef.current){const v=parseInt(e.target.value)||0;engineRef.current.updateSelected({nSalidas:v});setSelElement({...selElement,nSalidas:v})}}}
                style={{width:'100%',padding:"4px 6px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize:11,fontFamily:"'Geist',monospace",textAlign:'center'}}/>
            </div>
          )}
    </div>
  </div>
  );
}
