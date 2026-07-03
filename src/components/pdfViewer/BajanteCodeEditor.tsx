import { memo } from "react";
import { DIAM_BY_MAT, GAS_DN_LABELS } from "../../constants";
import { GAS, CAT_GAS } from "../../constants/engineeringDataGas";
import { VENTILACION, CONTADORES as CONTADORES_CAT } from "../../pages/catalog/catalogData";
import { DIAMETROS_AF } from "../../constants/hydraulicData";
import { writeAcoDiamToDrawing, writeContadorDiamToDrawing } from "../../utils/writeDiameterToDrawing";

interface BajanteCodeEditorProps {
  bajante: any;
  engineRef: React.MutableRefObject<any>;
  selElement: Record<string, any> | null;
  setSelElement: (el: Record<string, any> | null) => void;
  setContextMenuState: React.Dispatch<React.SetStateAction<any>>;
  mats: Record<string, any[]>;
  activeNet: string;
  setDiamSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  planosCtx: { plans: any[] };
}

function BajanteCodeEditor({
  bajante,
  engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
  mats,
  activeNet,
  setDiamSel,
  planosCtx,
}: BajanteCodeEditorProps) {
  const isArea = bajante.id?.startsWith('AR');
  const hasPts = !!bajante.pts;
  const tipo = bajante.tipo;

  if (isArea) {
    return (
      <>
        <div style={{ fontSize: 9, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Asociar Bajante
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          <select
            value={(engineRef.current?.bajantes || []).find((b: any) => b.area_m2 === bajante.areaM2)?.id || ''}
            onChange={e => {
              const bajanteId = e.target.value;
              (engineRef.current?.bajantes || []).forEach((b: any) => {
                if (b.area_m2 === bajante.areaM2) {
                  engineRef.current?.updateElementById(b.id, { area_m2: 0 });
                }
              });
              if (bajanteId) {
                engineRef.current?.updateElementById(bajanteId, { area_m2: bajante.areaM2 });
              }
              engineRef.current?.render();
              setContextMenuState(null);
            }}
            style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
            <option value="">— Sin bajante —</option>
            {(engineRef.current?.bajantes || []).filter((b: any) => b.net === bajante.net).map((b: any) => (
              <option key={b.id} value={b.id}>{b.code || b.id}</option>
            ))}
          </select>
        </div>
      </>
    );
  }

  if (hasPts) {
    const isGas = bajante.net === 'gas';
    const isVen = bajante.net === 'vent';
    const matList = mats?.[bajante.net] || [];
    const matShort = bajante.material || matList[0]?.val || '—';
    let diamList: any[] = [];
    if (isVen) {
      diamList = VENTILACION[0]?.rows.map((r: any) => ({ n: r.dn })) || [];
    } else if (isGas) {
      diamList = GAS[0]?.rows.map(r => ({ n: r.dn })) || [];
    } else {
      diamList = DIAM_BY_MAT[matShort] || [];
    }

    return (
      <>
        <div style={{ fontSize: 9, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Diámetro de ramal
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          <select
            value={bajante.diametro ? bajante.diametro.split(' — ')[0].trim() : ''}
            onChange={(e) => {
              const val = e.target.value;
              if (engineRef.current) {
                engineRef.current?.updateElementById(bajante.id, { diametro: val });
                setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...prev.bajante, diametro: val } } : null);
                if (selElement?.id === bajante.id) {
                  setSelElement({ ...selElement, diametro: val });
                }
                if (activeNet === bajante.net) {
                  setDiamSel((prev: any) => ({ ...prev, [activeNet]: val }));
                }
                engineRef.current?.render();
              }
            }}
            style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}
          >
            <option value="">— Sin diámetro —</option>
            {diamList.map((d: any) => {
              const valClean = d.n.split(' — ')[0].trim();
              return <option key={d.n} value={valClean}>{valClean}{isGas ? '"' : ''}</option>;
            })}
          </select>
        </div>
      </>
    );
  }

  if (tipo === 'contador') {
    return (
      <>
        <div style={{ fontSize: 9, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Contador: {bajante.code || bajante.id}
        </div>
        <div style={{ fontSize: 9, color: '#849495', padding: '4px 8px 0', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Diámetro del Contador
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          <select
            value={bajante.dNominal ? bajante.dNominal.replace(/"/g, '').trim() : ''}
            onChange={(e) => {
              const val = e.target.value;
              const dNom = val ? `${val}"` : '';
              if (engineRef.current) {
                const fields = { dNominal: dNom };
                engineRef.current?.updateElementById(bajante.id, fields);
                const fresh = engineRef.current?.bajantes.find((b: any) => b.id === bajante.id);
                if (fresh) {
                  setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...fresh } } : null);
                  if (selElement?.id === bajante.id) {
                    setSelElement({ ...selElement, dNominal: fields.dNominal });
                  }
                }
                engineRef.current?.render();
                writeContadorDiamToDrawing(dNom, planosCtx.plans, bajante.net || 'af');
              }
            }}
            style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}
          >
            <option value="">— Sin diámetro —</option>
            {CONTADORES_CAT.map((c: any) => (
              <option key={c.dn} value={c.dn}>{c.dn}"</option>
            ))}
          </select>
        </div>
        {(bajante.net === 'af' || bajante.net === 'gas') && (
          <div style={{ borderTop: '1px solid #3a494a', marginTop: 4 }}>
            <div style={{ fontSize: 9, color: '#22D3EE', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {bajante.net === 'gas' ? 'Conexión (Red → Contador)' : 'AC-01 (Red Pública → Contador)'}
            </div>
            <div style={{ padding: '0 8px 8px' }}>
              <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4 }}>Diámetro</div>
              <select
                value={bajante.acoDiam || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (engineRef.current) {
                    engineRef.current?.updateElementById(bajante.id, { acoDiam: val });
                    const fresh = engineRef.current?.bajantes.find((b: any) => b.id === bajante.id);
                    if (fresh) {
                      setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...fresh } } : null);
                    }
                    engineRef.current?.render();
                    writeAcoDiamToDrawing(val, planosCtx.plans, bajante.net || 'af');
                  }
                }}
                style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}
              >
                <option value="">— Sin diámetro —</option>
                {(bajante.net === 'gas' ? GAS_DN_LABELS : DIAMETROS_AF.map(d => d.nominal)).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </>
    );
  }

  if (tipo === 'calentador') {
    return (
      <>
        <div style={{ fontSize: 9, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Calentador: {bajante.code || bajante.id}
        </div>
        <div style={{ fontSize: 9, color: '#849495', padding: '4px 8px 0', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Equipo (Capacidad)
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          <select
            value={bajante.capacidad || ''}
            onChange={(e) => {
              const val = e.target.value;
              if (engineRef.current) {
                const fields = { capacidad: val };
                engineRef.current?.updateElementById(bajante.id, fields);
                const fresh = engineRef.current?.bajantes.find((b: any) => b.id === bajante.id);
                if (fresh) {
                  setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...fresh } } : null);
                  if (selElement?.id === bajante.id) {
                    setSelElement({ ...selElement, capacidad: val });
                  }
                }
                engineRef.current?.render();
              }
            }}
            style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}
          >
            <option value="">— Seleccionar —</option>
            {CAT_GAS.filter(g => g.id.startsWith('cal')).map(g => (
              <option key={g.id} value={g.id}>{g.n}</option>
            ))}
          </select>
        </div>
      </>
    );
  }

  return null;
}

export default memo(BajanteCodeEditor);
