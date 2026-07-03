import { memo } from "react";
import { pisoLbl } from "../../constants";

interface BajanteDirectionSelectorProps {
  bajante: any;
  isGhostClick?: boolean;
  selectedNivel: number | null;
  pisos: any[];
  engineRef: React.MutableRefObject<any>;
  selElement: Record<string, any> | null;
  setSelElement: (el: Record<string, any> | null) => void;
  setContextMenuState: React.Dispatch<React.SetStateAction<any>>;
}

function BajanteDirectionSelector({
  bajante,
  isGhostClick = false,
  selectedNivel,
  pisos,
  engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
}: BajanteDirectionSelectorProps) {
  const currentGhostLabel = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
  const gd = bajante.ghostData?.[currentGhostLabel];
  const ghostDir = isGhostClick ? (gd && gd.direccion !== undefined ? gd.direccion : bajante.direccion) : bajante.direccion;

  const updateGhostField = (field: string, val: string) => {
    if (!engineRef.current) return;
    const gd2 = { ...(bajante.ghostData || {}) };
    const cd = { ...(gd2[currentGhostLabel] || {}) };
    (cd as any)[field] = val;
    gd2[currentGhostLabel] = cd;
    engineRef.current?.updateElementById(bajante.id, { ghostData: gd2 });
    const fresh = engineRef.current?.bajantes.find((b: any) => b.id === bajante.id);
    if (fresh) {
      setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...fresh } } : null);
      if (selElement?.id === bajante.id) {
        setSelElement({ ...selElement, ghostData: gd2 });
      }
    }
  };

  return (
    <>
      <div style={{ fontSize: 9, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Dirección de flujo
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: '0 8px 4px' }}>
        {(isGhostClick ? ['Sube', 'Baja', 'Continua'] : ['Sube', 'Baja', 'Continua', 'Desplazamiento']).map(opt => {
          const isActive = opt === 'Desplazamiento'
            ? (!ghostDir && !!(bajante.desplazamientos && bajante.desplazamientos[currentGhostLabel]))
            : (ghostDir === opt.toLowerCase());
          return (
            <button
              key={opt}
              onClick={() => {
                if (engineRef.current) {
                  if (isGhostClick && opt !== 'Desplazamiento') {
                    updateGhostField('direccion', opt.toLowerCase());
                    engineRef.current?.render();
                    return;
                  }
                  const currentNpt = pisos.find(p => p.n === selectedNivel)?.npt || 0;
                  const allNpts = pisos.map(p => p.npt).sort((a, b) => a - b);
                  const maxNpt = allNpts[allNpts.length - 1] || 0;
                  const minNpt = allNpts[0] || 0;
                  let updates: any = {};

                  if (opt === 'Sube') {
                    const currentDesp = { ...(bajante.desplazamientos || {}) };
                    updates = { direccion: 'sube', nptBase: currentNpt, nptCima: maxNpt, desplazamientos: currentDesp };
                  } else if (opt === 'Baja') {
                    const currentDesp = { ...(bajante.desplazamientos || {}) };
                    updates = { direccion: 'baja', nptBase: minNpt, nptCima: currentNpt, desplazamientos: currentDesp };
                  } else if (opt === 'Continua') {
                    const currentDesp = { ...(bajante.desplazamientos || {}) };
                    updates = { direccion: 'continua', desplazamientos: currentDesp };
                  } else if (opt === 'Desplazamiento') {
                    const lvl = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
                    if (lvl) {
                      const currentDesp = bajante.desplazamientos || {};
                      updates = {
                        direccion: undefined,
                        desplazamientos: {
                          ...currentDesp,
                          [lvl]: {
                            dx: currentDesp[lvl]?.dx ?? 2,
                            dy: currentDesp[lvl]?.dy ?? 0,
                            Ldesvio: currentDesp[lvl]?.Ldesvio
                          }
                        }
                      };
                    }
                  }
                  if (Object.keys(updates).length > 0) {
                    engineRef.current?.updateElementById(bajante.id, updates);
                    const fresh = engineRef.current?.bajantes.find((b: any) => b.id === bajante.id);
                    if (fresh) {
                      setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...fresh } } : null);
                    }
                    if (selElement?.id === bajante.id) {
                      setSelElement({ ...selElement, ...updates });
                    }
                  }
                }
              }}
              style={{
                background: isActive ? 'rgba(37,99,235,0.15)' : '#1e2024',
                border: `1px solid ${isActive ? '#2563eb' : '#3a494a'}`,
                color: isActive ? '#3b82f6' : '#e2e2e8',
                padding: '6px 8px',
                textAlign: 'left', fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer',
                borderRadius: 3, display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = '#2563eb33';
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = '#1e2024';
              }}
            >
              <div style={{ color: opt === 'Sube' ? '#00dce5' : opt === 'Baja' ? '#F04545' : '#FFEB3B' }}>
                {opt === 'Sube' ? '\u2B06' : opt === 'Baja' ? '\u2B07' : opt === 'Continua' ? '\u279C' : '\u27A1'}
              </div>
              {opt}
            </button>
          );
        })}
      </div>

      {!isGhostClick && (
        <button
          onClick={() => {
            if (engineRef.current) {
              const lvl = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
              const isFantasma = bajante.isFantasma;
              const updates: any = { isFantasma: !isFantasma };
              if (!isFantasma && lvl) {
                const currentDesp = { ...(bajante.desplazamientos || {}) };
                if (!currentDesp[lvl]) {
                  currentDesp[lvl] = { dx: 2, dy: 0 };
                  updates.desplazamientos = currentDesp;
                }
              }
              engineRef.current?.updateElementById(bajante.id, updates);
              const fresh = engineRef.current?.bajantes.find((b: any) => b.id === bajante.id);
              if (fresh) {
                setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...fresh } } : null);
              }
              engineRef.current?.render();
            }
          }}
          style={{
            background: 'transparent', border: 'none', color: '#e2e2e8', padding: '6px 8px',
            textAlign: 'left', fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer',
            borderRadius: 3, display: 'flex', alignItems: 'center', gap: 6,
            marginTop: 4, borderTop: '1px solid #3a494a'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#2563eb33'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {bajante.isFantasma ? 'Desactivar desplazamiento del bajante' : 'Activar desplazamiento del bajante'}
        </button>
      )}
    </>
  );
}

export default memo(BajanteDirectionSelector);
