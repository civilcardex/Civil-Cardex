import React from 'react';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';
import type { ElementItem } from '../../lib/PlanoEngine/PlanoEngine';

const TIPOS_TRAMO = [
  { id: "ramal", label: "Ramal" },
  { id: "tributario", label: "Tributario" },
];

const TipoTramoSelector_btn: React.CSSProperties = {
  padding: "7px 10px", borderRadius: "3px", cursor: "pointer", width: "100%",
  display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start",
  transition: "all .12s",
};
const TipoTramoSelector_select: React.CSSProperties = { width: '100%', padding: '5px 8px', background: '#1a1c20', border: '1px solid #3a494a', borderRadius: 3, fontSize: 12, fontFamily: "'Geist',monospace", cursor: 'pointer' };

interface TipoTramoSelectorProps {
  tipoTramo: string;
  setTipoTramo: (v: string) => void;
  padreTributarioId: string | null;
  setPadreTributarioId: (v: string | null) => void;
  drawnElements: ElementItem[];
  engineRef: React.RefObject<PlanoEngine | null>;
}

export default function TipoTramoSelector({
  tipoTramo,
  setTipoTramo,
  padreTributarioId,
  setPadreTributarioId,
  drawnElements,
  engineRef,
}: TipoTramoSelectorProps) {
  return (
    <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
      <div style={{ fontFamily: "'Geist',monospace", fontSize: 12, color: "#849495", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>¿Qué voy a dibujar?</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {TIPOS_TRAMO.map(tp => (
          <button type="button" key={tp.id} onClick={() => setTipoTramo(tp.id)}
            style={{
              ...TipoTramoSelector_btn,
              background: tipoTramo === tp.id ? "#2563EB22" : "#1e2024",
              border: `1px solid ${tipoTramo === tp.id ? "#2563EB" : "#3a494a"}`,
            }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: tipoTramo === tp.id ? "#2563EB" : "#b9caca", fontFamily: "'Geist',monospace" }}>
              {tp.id === 'ramal' ? '📏 Ramal principal' : tp.id === 'tributario' ? '🔀 Tributario' : tp.label}
            </div>
            <div style={{ fontSize: 12, color: "#6b8cae", fontFamily: "'Geist',monospace", textAlign: "left" }}>
              {tp.id === 'ramal' ? 'Trazos principales de la red activa' : tp.id === 'tributario' ? 'Ramificaciones que conectan al ramal principal' : ''}
            </div>
          </button>
        ))}
      </div>
      {tipoTramo === 'tributario' && (
        <div style={{ marginTop: 8, padding: '8px 10px', background: padreTributarioId ? 'rgba(37,99,235,.12)' : '#1e2024', border: `1px solid ${padreTributarioId ? '#2563EB' : '#3a494a'}`, borderRadius: 3 }}>
          <div style={{ fontSize: 12, color: '#849495', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Padre (ramal asignado)</div>
          <select aria-label="Seleccionar ramal padre tributario" value={padreTributarioId || ''}
            onChange={e => {
              const v = e.target.value || null;
              setPadreTributarioId(v);
              if (engineRef.current) engineRef.current.setPadreTributario(v);
            }}
            style={{ ...TipoTramoSelector_select, color: padreTributarioId ? '#2563EB' : '#6b8cae' }}>
            <option value="">— Seleccionar ramal padre —</option>
            {drawnElements.filter(el => el.type === 'ramal' && el.tipo === 'ramal').map(el => (
              <option key={el.id} value={el.id}>{el.label}{el.totalL ? ` · ${typeof el.totalL === 'number' ? el.totalL.toFixed(2) : el.totalL}m` : ''}</option>
            ))}
          </select>
          {drawnElements.filter(el => el.type === 'ramal' && el.tipo === 'ramal').length === 0 && (
            <div style={{ fontSize: 12, color: '#ffb4ab', fontFamily: "'Geist',monospace", marginTop: 6, lineHeight: 1.4 }}>
              No hay ramales principales en esta red. Dibuja primero un ramal antes de crear tributarios.
            </div>
          )}
          {padreTributarioId && (
            <div style={{ fontSize: 12, color: '#6b8cae', fontFamily: "'Geist',monospace", marginTop: 4, lineHeight: 1.4 }}>
              El primer punto se conectará automáticamente al ramal seleccionado.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
