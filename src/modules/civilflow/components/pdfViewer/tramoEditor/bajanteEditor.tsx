import { DIAM_BAN, DIAM_BAN_SAN, DIAM_VENT } from '../../../constants';
import { normalizeDnLabel } from '../../../utils/formatUtils';
import { diamPulgFromLabel } from '../../../utils/diamPulgFromLabel';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine';
import type { PlanoElement, PlanoBajante } from '../../../lib/PlanoEngine/PlanoState';
import { SELECT_STYLE, INPUT_CENTER_STYLE, CHECK_GRID_STYLE, CHECK_ROW_STYLE } from './context';

/** Editor del bajante/montante seleccionado: diámetro, altura vertical, llenado (R) y área
 *  servida. */
export function BajanteEditor({
  selElement,
  engineRef,
  setSelElement,
  handleUpdateSel,
  isGhostSel,
  lvl,
}: {
  selElement: PlanoBajante;
  activeNet: string;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  setSelElement: React.Dispatch<React.SetStateAction<PlanoElement | null>>;
  handleUpdateSel: (field: string, value: unknown) => void;
  isGhostSel: boolean;
  lvl: string;
}) {
  if (isGhostSel) {
    const gd = selElement.ghostData?.[lvl] || {};
    const currentGhostDiam = gd.dNominal || '';
    const currentGhostDir = gd.direccion || '';

    const updateGhostField = (
      mutate: (cd: NonNullable<PlanoBajante['ghostData']>[string]) => void,
    ) => {
      const gdNew = { ...(selElement.ghostData || {}) };
      const cd = { ...(gdNew[lvl] || {}) };
      mutate(cd);
      gdNew[lvl] = cd;
      if (engineRef.current) {
        engineRef.current.updateSelected({ ghostData: gdNew });
        setSelElement({ ...selElement, ghostData: gdNew });
        engineRef.current.render();
      }
    };

    return (
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
        <div
          style={{
            fontFamily: "'Geist',monospace",
            fontSize: 12,
            color: '#9BA8AA',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Datos específicos (Fantasma)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div>
            <div
              style={{
                fontSize: 12,
                color: '#9BA8AA',
                fontFamily: "'Geist',monospace",
                marginBottom: 2,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Diámetro
            </div>
            <select
              value={currentGhostDiam}
              aria-label="Diámetro"
              onChange={(e) => {
                const val = e.target.value;
                updateGhostField((cd) => {
                  cd.dNominal = val;
                });
              }}
              style={SELECT_STYLE}
            >
              <option value="">—</option>
              {(selElement.net === 'vent'
                ? DIAM_VENT
                : selElement.net === 'san'
                  ? DIAM_BAN_SAN
                  : DIAM_BAN
              ).map((d) => (
                <option key={d.pulg} value={d.nom}>
                  {normalizeDnLabel(d.nom)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                color: '#9BA8AA',
                fontFamily: "'Geist',monospace",
                marginBottom: 2,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Dirección de flujo
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {(
                [
                  ['sube', '↑ Sube'],
                  ['baja', '↓ Baja'],
                  ['continua', '➜ Continua'],
                ] as const
              ).map(([val, lbl]) => {
                const isActive = currentGhostDir === val;
                return (
                  <button
                    type="button"
                    key={val}
                    onClick={() => {
                      updateGhostField((cd) => {
                        const newDir = cd.direccion === val ? undefined : val;
                        if (newDir) {
                          cd.direccion = newDir;
                        } else {
                          delete cd.direccion;
                        }
                      });
                    }}
                    style={{
                      flex: 1,
                      padding: '4px 6px',
                      fontSize: 12,
                      fontFamily: "'Geist',monospace",
                      borderRadius: 3,
                      border: `1px solid ${isActive ? '#F5A623' : '#3a494a'}`,
                      background: isActive ? 'rgba(245,166,35,.15)' : '#1e2024',
                      color: isActive ? '#F5A623' : '#9BA8AA',
                      cursor: 'pointer',
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
      <div
        style={{
          fontFamily: "'Geist',monospace",
          fontSize: 12,
          color: '#9BA8AA',
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        Datos específicos
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 12,
                color: '#9BA8AA',
                fontFamily: "'Geist',monospace",
                marginBottom: 2,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              H (m)
            </div>
            <input
              type="number"
              step="0.01"
              value={selElement.hVert ?? ''}
              placeholder="0.00"
              aria-label="Altura H (m)"
              onChange={(e) => {
                const v = e.target.value;
                handleUpdateSel('hVert', v ? parseFloat(v) : 0);
              }}
              style={INPUT_CENTER_STYLE}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 12,
                color: '#9BA8AA',
                fontFamily: "'Geist',monospace",
                marginBottom: 2,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Diámetro
            </div>
            <select
              value={
                selElement.dNominal !== undefined &&
                selElement.dNominal !== '0' &&
                selElement.dNominal !== ''
                  ? selElement.dNominal
                  : ''
              }
              aria-label="Diámetro"
              onChange={(e) => {
                const val = e.target.value;
                if (selElement.net === 'vent') {
                  const opt = DIAM_VENT.find((d) => d.nom === val);
                  if (opt && opt.pulg > 2) {
                    engineRef.current?.triggerAlert(
                      'Diámetro no permitido',
                      'Los ramales de ventilación no pueden superar 2" de diámetro.',
                    );
                    return;
                  }
                }
                handleUpdateSel('dNominal', val);
              }}
              style={SELECT_STYLE}
            >
              <option value="">—</option>
              {(selElement.net === 'vent'
                ? DIAM_VENT
                : selElement.net === 'san'
                  ? DIAM_BAN_SAN
                  : DIAM_BAN
              ).map((d) => (
                <option key={d.pulg} value={d.nom}>
                  {normalizeDnLabel(d.nom)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 12,
                color: '#9BA8AA',
                fontFamily: "'Geist',monospace",
                marginBottom: 2,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Llenado (R)
            </div>
            <select
              value={
                selElement.bajR != null
                  ? Math.abs(selElement.bajR - 7 / 24) < 0.001
                    ? '7/24'
                    : '1/4'
                  : '7/24'
              }
              aria-label="Llenado (R)"
              onChange={(e) => {
                const val = e.target.value;
                handleUpdateSel('bajR', val === '7/24' ? 7 / 24 : 0.25);
              }}
              style={SELECT_STYLE}
            >
              <option value="7/24">7/24</option>
              <option value="1/4">1/4</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 12,
                color: '#9BA8AA',
                fontFamily: "'Geist',monospace",
                marginBottom: 2,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Área
            </div>
            <select
              value={selElement.area_m2 ? String(selElement.area_m2) : ''}
              aria-label="Área"
              onChange={(e) => {
                handleUpdateSel('area_m2', parseFloat(e.target.value) || 0);
              }}
              style={SELECT_STYLE}
            >
              <option value="">— Sin área —</option>
              {(engineRef.current?.areas || [])
                .filter((a) => a.net === selElement.net)
                .map((a) => (
                  <option key={a.id} value={a.areaM2}>
                    {a.label} · {a.areaM2} m²
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 12,
              color: '#9BA8AA',
              fontFamily: "'Geist',monospace",
              marginBottom: 2,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            Dirección
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {(
              [
                ['sube', '↑ Sube'],
                ['baja', '↓ Baja'],
                ['continua', '➜ Continua'],
              ] as const
            ).map(([val, lbl]) => {
              const eng = engineRef.current;
              const isActive = selElement.direccion === val;

              return (
                <button
                  type="button"
                  key={val}
                  onClick={() => {
                    if (!eng) return;
                    const newDir = selElement.direccion === val ? undefined : val;
                    eng.updateSelected({
                      direccion: newDir,
                      desplazamientos: { ...(selElement.desplazamientos || {}) },
                    });
                    setSelElement({ ...selElement, direccion: newDir });
                    eng.render();
                  }}
                  style={{
                    flex: 1,
                    padding: '4px 6px',
                    fontSize: 12,
                    fontFamily: "'Geist',monospace",
                    borderRadius: 3,
                    border: `1px solid ${isActive ? '#F5A623' : '#3a494a'}`,
                    background: isActive ? 'rgba(245,166,35,.15)' : '#1e2024',
                    color: isActive ? '#F5A623' : '#9BA8AA',
                    cursor: 'pointer',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
        </div>
        {selElement.net === 'san' && (
          <div style={{ width: '100%' }}>
            <div
              style={{
                fontSize: 12,
                color: '#9BA8AA',
                fontFamily: "'Geist',monospace",
                marginBottom: 2,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Ramales asociados
            </div>
            <div style={CHECK_GRID_STYLE}>
              {(() => {
                const bajRamales = (engineRef.current?.ramales || []).filter(
                  (r) => r.net === 'san' && r.tipo !== 'tributario',
                );
                if (bajRamales.length === 0)
                  return (
                    <div
                      style={{
                        fontSize: 12,
                        color: '#8AB4D6',
                        fontFamily: "'Geist',monospace",
                        padding: '4px',
                        gridColumn: 'span 4',
                      }}
                    >
                      Sin ramales en esta red
                    </div>
                  );
                const recibidos = selElement.recibeDeIds || [];
                return bajRamales.map((r) => (
                  <label key={r.id} style={CHECK_ROW_STYLE}>
                    <input
                      type="checkbox"
                      checked={recibidos.includes(r.id)}
                      onChange={(e) => {
                        if (e.target.checked && recibidos.length === 1) {
                          const existing = (engineRef.current?.ramales || []).find(
                            (x) => x.id === recibidos[0],
                          ) as unknown as { diametro?: string } | undefined;
                          if (existing && existing.diametro && r.diametro) {
                            const p1 = diamPulgFromLabel(existing.diametro);
                            const p2 = diamPulgFromLabel(r.diametro);
                            if (p1 > 0 && p2 > 0 && Math.abs(p1 - p2) > 0.01) {
                              engineRef.current?.triggerAlert(
                                'Diámetros no compatibles',
                                'Los dos ramales que llegan a un mismo bajante (Y doble) deben tener el mismo diámetro en sus brazos laterales.',
                              );
                              e.preventDefault();
                              return;
                            }
                          }
                        }
                        const newRecibe = e.target.checked
                          ? [...recibidos, r.id]
                          : recibidos.filter((id: string) => id !== r.id);
                        engineRef.current?.updateElementById(selElement.id, {
                          recibeDeIds: newRecibe,
                        });
                        const fresh = engineRef.current?.bajantes.find(
                          (bb) => bb.id === selElement.id,
                        );
                        if (fresh) setSelElement({ ...fresh });
                        engineRef.current?.render();
                        engineRef.current?._markDirty();
                      }}
                      style={{ accentColor: '#F5A623', margin: 0, flexShrink: 0 }}
                    />
                    <span
                      style={{
                        flex: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {r.label || r.id}
                    </span>
                  </label>
                ));
              })()}
            </div>
          </div>
        )}
        {selElement.net === 'san' && (
          <div style={{ width: '100%' }}>
            <div
              style={{
                fontSize: 12,
                color: '#9BA8AA',
                fontFamily: "'Geist',monospace",
                marginBottom: 2,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Aparatos (ramales conectados)
            </div>
            <div style={{ fontSize: 12, color: '#8AB4D6', fontFamily: "'Geist',monospace" }}>
              {(() => {
                const eng = engineRef.current;
                if (!eng) return '—';
                const rIds: string[] = selElement.recibeDeIds || [];
                const parts: string[] = [];
                for (const rid of rIds) {
                  const rr = eng.ramales.find((x) => x.id === rid);
                  if (!rr) continue;
                  const aps = [rr.aparatoInicio, rr.aparatoFin].filter(Boolean) as string[];
                  parts.push(aps.length ? `${rr.label}: ${aps.join(', ')}` : `${rr.label}: —`);
                }
                return parts.length ? parts.join(' · ') : 'Sin aparatos';
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
