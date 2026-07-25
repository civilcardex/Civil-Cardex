import type { CrossFloorGhost } from '../../utils/associateBajanteAcrossFloors';
import { updateCrossFloorGhostDiameter } from '../../utils/associateBajanteAcrossFloors';
import { DIAM_BAN, DIAM_VENT } from '../../constants';
import { normalizeDnLabel } from '../../utils/formatUtils';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';

// No full-viewport backdrop here on purpose — a ghost is a lightweight reference marker, not a
// blocking dialog. A backdrop covering the whole canvas swallowed every click meant for the
// canvas underneath (e.g. clicking a REAL bajante's label right next to the ghost never reached
// the canvas at all — it just closed this panel instead), so selecting anything else while the
// ghost panel was open silently did nothing. This floats in a fixed corner instead, pointer-events
// scoped to just the panel itself, so the rest of the canvas stays fully interactive.
const CrossFloorGhostPanel_S1: React.CSSProperties = {
  position: 'absolute',
  bottom: 16,
  right: 16,
  zIndex: 100,
  pointerEvents: 'none',
};
const CrossFloorGhostPanel_S2: React.CSSProperties = {
  background: '#1a1c20',
  border: '2px dashed #849495',
  borderRadius: 8,
  padding: '16px 20px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  minWidth: 260,
  pointerEvents: 'auto',
};
const CrossFloorGhostPanel_S3: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  background: '#1e2024',
  border: '1px solid #3a494a',
  borderRadius: 3,
  color: '#e2e2e8',
  fontSize: 12,
  fontFamily: "'Geist',monospace",
};
const CrossFloorGhostPanel_S4: React.CSSProperties = {
  padding: '5px 14px',
  background: 'transparent',
  border: '1px solid #3a494a',
  borderRadius: 4,
  color: '#849495',
  fontSize: 12,
  fontFamily: "'Geist',monospace",
  cursor: 'pointer',
};

interface CrossFloorGhostPanelProps {
  ghost: CrossFloorGhost | null;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  onClose: () => void;
}

export default function CrossFloorGhostPanel({
  ghost,
  engineRef,
  onClose,
}: CrossFloorGhostPanelProps) {
  if (!ghost) return null;
  const diamList = ghost.net === 'vent' ? DIAM_VENT : DIAM_BAN;

  return (
    <div style={CrossFloorGhostPanel_S1}>
      <div style={CrossFloorGhostPanel_S2}>
        <div
          style={{
            fontSize: 12,
            color: '#849495',
            fontFamily: "'Geist',monospace",
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Fantasma de asociación — {ghost.code}
        </div>
        <div style={{ fontSize: 11, color: '#6b8cae', fontFamily: "'Geist',monospace" }}>
          Marca de referencia: aquí conecta el bajante {ghost.code} de otro piso. No es un bajante
          real de este piso.
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#849495', marginBottom: 4 }}>Diámetro</div>
          <select
            value={ghost.dNominal || ''}
            aria-label="Diámetro del fantasma"
            onChange={(e) => {
              const val = e.target.value;
              updateCrossFloorGhostDiameter(engineRef.current?._loadedPlanId ?? '', ghost.id, val);
              const eng = engineRef.current;
              if (eng) {
                const idx = eng.crossFloorGhosts.findIndex((g) => g.id === ghost.id);
                if (idx !== -1)
                  eng.crossFloorGhosts[idx] = { ...eng.crossFloorGhosts[idx], dNominal: val };
                eng.render();
              }
            }}
            style={CrossFloorGhostPanel_S3}
          >
            <option value="">—</option>
            {diamList.map((d) => (
              <option key={d.pulg} value={d.nom}>
                {normalizeDnLabel(d.nom)}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={CrossFloorGhostPanel_S4}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
