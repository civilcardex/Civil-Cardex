import type { RefObject, Dispatch, SetStateAction } from "react";
import type { PlanoNet } from "../../lib/PlanoEngine/PlanoState";

const IsometriaToolbar_S2: React.CSSProperties = { padding: '3px 8px', fontSize: 12, fontFamily: 'Geist,monospace', borderRadius: 3, border: '1px solid #3a494a', cursor: 'pointer', background: '#1e2024', color: '#b9caca' };
const IsometriaToolbar_S3: React.CSSProperties = { padding: '3px 8px', fontSize: 12, fontFamily: 'Geist,monospace', borderRadius: 3, border: '1px solid #3a494a', cursor: 'pointer', background: '#1e2024', color: '#b9caca' };
const IsometriaToolbar_S4: React.CSSProperties = { position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#1e2024', border: '1px solid #3a494a', borderRadius: 3, display: 'flex', flexDirection: 'column', minWidth: 80 };
const IsometriaToolbar_S5: React.CSSProperties = { padding: '4px 8px', fontSize: 12, fontFamily: 'Geist,monospace', border: 'none', background: 'transparent', color: '#b9caca', cursor: 'pointer', textAlign: 'left' };
const IsometriaToolbar_S6: React.CSSProperties = { padding: '4px 8px', fontSize: 12, fontFamily: 'Geist,monospace', border: 'none', background: 'transparent', color: '#b9caca', cursor: 'pointer', textAlign: 'left' };
const IsometriaToolbar_planosLabel: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#849495', fontFamily: 'Geist,monospace', cursor: 'pointer', marginLeft: 8, padding: '3px 8px', borderRadius: 3 };

interface IsometriaToolbarProps {
  nets: PlanoNet[];
  activeNets: Set<string>;
  toggleNet: (netId: string) => void;
  showPlanos: boolean;
  setShowPlanos: (v: boolean) => void;
  planosCount: string;
  rotX: number;
  setRotX: (v: number) => void;
  rotZ: number;
  setRotZ: (v: number) => void;
  scaleZ: number;
  setScaleZ: (v: number) => void;
  zoom: number;
  setZoom: (v: number) => void;
  fitView: () => void;
  showExportMenu: boolean;
  setShowExportMenu: Dispatch<SetStateAction<boolean>>;
  exportRef: RefObject<HTMLDivElement | null>;
  exportPdf: () => void;
  exportPng: () => void;
}

export default function IsometriaToolbar({
  nets, activeNets, toggleNet, showPlanos, setShowPlanos, planosCount,
  rotX, setRotX, rotZ, setRotZ, scaleZ, setScaleZ, zoom, setZoom,
  fitView, showExportMenu, setShowExportMenu, exportRef, exportPdf, exportPng,
}: IsometriaToolbarProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#0d0f12', borderBottom: '1px solid #3a494a', flexWrap: 'wrap' }}>

      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {nets.map(n => {
          const isOn = activeNets.has(n.id);
          return (
            <button type="button" key={n.id} onClick={() => toggleNet(n.id)} aria-pressed={isOn} style={{
              padding: '3px 8px', fontSize: 12, fontFamily: 'Geist,monospace', borderRadius: 3, border: '1px solid', cursor: 'pointer',
              background: isOn ? n.col + '33' : '#1e2024',
              borderColor: isOn ? n.col : '#3a494a',
              color: isOn ? n.col : '#849495',
              fontWeight: isOn ? 600 : 400,
            }}>{n.emoji} {n.lbl}</button>
          );
        })}
      </div>

      <label style={{ ...IsometriaToolbar_planosLabel, border: `1px solid ${showPlanos ? '#4D8FF7' : '#3a494a'}`, background: showPlanos ? 'rgba(77,143,247,.15)' : 'transparent' }}>
        <input type="checkbox" checked={showPlanos} onChange={e => setShowPlanos(e.target.checked)} style={{ accentColor: '#4D8FF7', margin: 0 }} />
        Planos ({planosCount})
      </label>

      <div style={{ flex: 1 }} />

      <label style={{ fontSize: 12, color: '#849495', fontFamily: 'Geist,monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
        Giro vertical
        <button type="button" onClick={() => setRotX(-30)} style={{ padding: '2px 4px', fontSize: 12, borderRadius: 2, border: '1px solid #3a494a', cursor: 'pointer', background: rotX === -30 ? '#4D8FF7' : '#1e2024', color: rotX === -30 ? '#fff' : '#b9caca' }}>-30°</button>
        <button type="button" onClick={() => setRotX(-45)} style={{ padding: '2px 4px', fontSize: 12, borderRadius: 2, border: '1px solid #3a494a', cursor: 'pointer', background: rotX === -45 ? '#4D8FF7' : '#1e2024', color: rotX === -45 ? '#fff' : '#b9caca' }}>-45°</button>
        <input type="range" min={-90} max={90} value={rotX} onChange={e => setRotX(Number(e.target.value))} style={{ width: 60 }} />
        <span style={{ width: 28, textAlign: 'right' }}>{rotX}°</span>
      </label>
      <label style={{ fontSize: 12, color: '#849495', fontFamily: 'Geist,monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
        Giro horizontal
        <button type="button" onClick={() => setRotZ(30)} style={{ padding: '2px 4px', fontSize: 12, borderRadius: 2, border: '1px solid #3a494a', cursor: 'pointer', background: rotZ === 30 ? '#4D8FF7' : '#1e2024', color: rotZ === 30 ? '#fff' : '#b9caca' }}>30°</button>
        <button type="button" onClick={() => setRotZ(45)} style={{ padding: '2px 4px', fontSize: 12, borderRadius: 2, border: '1px solid #3a494a', cursor: 'pointer', background: rotZ === 45 ? '#4D8FF7' : '#1e2024', color: rotZ === 45 ? '#fff' : '#b9caca' }}>45°</button>
        <input type="range" min={0} max={360} value={rotZ} onChange={e => setRotZ(Number(e.target.value))} style={{ width: 60 }} />
        <span style={{ width: 32, textAlign: 'right' }}>{rotZ}°</span>
      </label>
      <label style={{ fontSize: 12, color: '#849495', fontFamily: 'Geist,monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
        Distancia entre pisos <input type="range" min={0.1} max={5} step={0.1} value={scaleZ} onChange={e => setScaleZ(Number(e.target.value))} style={{ width: 50 }} />
        <span style={{ width: 24, textAlign: 'right' }}>{scaleZ.toFixed(1)}</span>
      </label>
      <label style={{ fontSize: 12, color: '#849495', fontFamily: 'Geist,monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
        Zoom <input type="range" min={5} max={200} value={Math.round(zoom * 100)} onChange={e => setZoom(Number(e.target.value) / 100)} style={{ width: 50 }} />
        <span style={{ width: 36, textAlign: 'right' }}>{Math.round(zoom * 100)}%</span>
      </label>

      <button type="button" onClick={fitView} title="Encuadrar todo" style={IsometriaToolbar_S2}>⊞</button>
      <div ref={exportRef} style={{ position: 'relative', display: 'inline-block' }}>
        <button type="button" onClick={() => setShowExportMenu(p => !p)} title="Descargar" style={IsometriaToolbar_S3}>⬇ Descargar</button>
        {showExportMenu && (
          <div style={IsometriaToolbar_S4}>
            <button type="button" onClick={() => { setShowExportMenu(false); exportPdf(); }} style={IsometriaToolbar_S5}>PDF</button>
            <button type="button" onClick={() => { setShowExportMenu(false); exportPng(); }} style={IsometriaToolbar_S6}>PNG</button>
          </div>
        )}
      </div>
    </div>
  );
}
