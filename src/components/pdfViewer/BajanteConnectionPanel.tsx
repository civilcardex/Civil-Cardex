import { memo } from "react";
import { NETS } from "../../lib/PlanoEngine/PlanoState";
import { DIAM_BY_MAT } from "../../constants";

interface BajanteConnectionPanelProps {
  bajante: any;
  isGhostClick?: boolean;
  ramalEndpoint?: { idx: number; x: number; y: number } | null;
engineRef: React.MutableRefObject<any>;
  selElement: Record<string, any> | null;
  setSelElement: (el: Record<string, any> | null) => void;
  setContextMenuState: React.Dispatch<React.SetStateAction<any>>;
  mats: Record<string, any[]>;
  activeNet: string;
}

function BajanteConnectionPanel({
  bajante,
  isGhostClick = false,
  ramalEndpoint,
engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
  mats,
  activeNet,
}: BajanteConnectionPanelProps) {
  const hasPts = !!bajante.pts;

  return (
    <>
      {!hasPts && !isGhostClick && ["san", "ll"].includes(activeNet) && (
        <>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 8px',
            borderTop: '1px solid #3a494a', marginTop: 4
          }}>
            <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ramales asociados</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px 8px', maxHeight: 120, overflowY: 'auto', background: '#1e2024', border: '1px solid #3a494a', borderRadius: 3, padding: 4 }}>
              {(() => {
                const bajRamales = (engineRef.current?.ramales || []).filter((r: any) => r.net === activeNet && r.tipo !== 'tributario');
                if (bajRamales.length === 0) return <div style={{ fontSize: 9, color: '#6b8cae', fontFamily: "'Geist',monospace", gridColumn: 'span 4' }}>Sin ramales</div>;
                const recibidos = (bajante.recibeDeIds || []);
                return bajRamales.map((r: any) => (
                  <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 9, color: '#b9caca', fontFamily: "'Geist',monospace", minWidth: 0 }}>
                    <input type="checkbox" checked={recibidos.includes(r.id)}
                      onChange={e => {
                        const newRecibe = e.target.checked
                          ? [...recibidos, r.id]
                          : recibidos.filter((id: string) => id !== r.id);
                        engineRef.current?.updateElementById(bajante.id, { recibeDeIds: newRecibe });
setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...prev.bajante, recibeDeIds: newRecibe } } : null);
                        if (selElement?.id === bajante.id) {
                          setSelElement({ ...selElement, recibeDeIds: newRecibe });
                        }
                      }}
                      style={{ accentColor: '#F5A623', margin: 0, flexShrink: 0 }} />
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label || r.id}</span>
                  </label>
                ));
              })()}
            </div>
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4
          }}>
            <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Bajantes asociadas</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px 8px', maxHeight: 120, overflowY: 'auto', background: '#1e2024', border: '1px solid #3a494a', borderRadius: 3, padding: 4 }}>
              {(() => {
                const netBajantes = (engineRef.current?.bajantes || []).filter((b: any) => b.net === bajante.net && b.id !== bajante.id && b.tipo !== 'tributario');
                if (netBajantes.length === 0) return <div style={{ fontSize: 9, color: '#6b8cae', fontFamily: "'Geist',monospace", gridColumn: 'span 4' }}>Sin bajantes</div>;
                const currentId = bajante.id;
                return netBajantes.map((b: any) => {
                  const isAssociated = (bajante.recibeDeIds || []).includes(b.id);
                  return (
                    <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 9, color: '#b9caca', fontFamily: "'Geist',monospace", minWidth: 0 }}>
                      <input type="checkbox" checked={isAssociated}
                        onChange={e => {
                          const recibidos = bajante.recibeDeIds || [];
                          const newRecibe = e.target.checked
                            ? [...recibidos, b.id]
                            : recibidos.filter((id: string) => id !== b.id);
                          engineRef.current?.updateElementById(currentId, { recibeDeIds: newRecibe });
                          const fresh = engineRef.current?.bajantes.find((x: any) => x.id === currentId);
if (fresh) setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...fresh } } : null);
                          if (selElement?.id === currentId) {
                            setSelElement({ ...selElement, recibeDeIds: newRecibe });
                          }
                          engineRef.current?.render();
                        }}
                        style={{ accentColor: '#2563eb', margin: 0, flexShrink: 0 }} />
                      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={b.code || b.id}>{b.code || b.id}</span>
                    </label>
                  );
                });
              })()}
            </div>
          </div>
        </>
      )}

      {hasPts && ramalEndpoint && (() => {
        const supNets = ['san', 'll', 'vent', 'af', 'ac', 'gas', 'rci', 'rec'];
        if (!supNets.includes(bajante.net)) return null;
        const ep = ramalEndpoint;

        if (bajante.tipo === 'tributario' && bajante.net === 'san') {
          const isStart = ep.idx === 0;
          const fieldAcc = isStart ? 'accesorioInicio' : 'accesorioFin';
          const fieldDiam = isStart ? 'diametroInicio' : 'diametroFin';

          const currentAcc = bajante[fieldAcc] || '';
          const currentDiam = bajante[fieldDiam] || bajante.diametro || '';

          const matList = mats?.[bajante.net] || [];
          const matShort = bajante.material || matList[0]?.val || '';
          const diamList = DIAM_BY_MAT[matShort] || [];

          return (
            <div style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 6, borderBottom: '1px solid #3a494a', marginBottom: 4 }}>
              <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Extremo {isStart ? 'Inicio (Aparato)' : 'Fin (Ramal)'}
              </div>

              <div>
                <div style={{ fontSize: 9, color: '#849495', marginBottom: 2 }}>Seleccionar Accesorio</div>
                <select
                  value={currentAcc}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (engineRef.current) {
                      const updates: any = { [fieldAcc]: val };
                      if (val && !bajante[fieldDiam]) {
                        updates[fieldDiam] = bajante.diametro || '';
                      }
engineRef.current.updateElementById(bajante.id, updates);
                      setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...prev.bajante, ...updates } } : null);
                      if (selElement?.id === bajante.id) {
                        setSelElement({ ...selElement, ...updates });
                      }
                      engineRef.current.render();
                      engineRef.current._markDirty();
                    }
                  }}
                  style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}
                >
                  <option value="">Ninguno</option>
                  <option value="sifon">Sifon</option>
                  <option value="codoSube">Codo Sube</option>
                  <option value="codoBaja">Codo Baja</option>
                  <option value="codoReventilado">Codo reventilado</option>
                </select>
              </div>

              {currentAcc && (
                <div>
                  <div style={{ fontSize: 9, color: '#849495', marginBottom: 2 }}>Diametro de Accesorio</div>
                  <select
                    value={currentDiam ? currentDiam.split(' — ')[0].trim() : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (engineRef.current) {
                        const updates = { [fieldDiam]: val };
                        engineRef.current.updateElementById(bajante.id, updates);
                        setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...prev.bajante, ...updates } } : null);
                        if (selElement?.id === bajante.id) {
                          setSelElement({ ...selElement, ...updates });
                        }
                        engineRef.current.render();
                        engineRef.current._markDirty();
                      }
                    }}
                    style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}
                  >
                    <option value="">Usar diametro de red</option>
                    {diamList.map((d: any) => {
const valClean = d.n.split(' — ')[0].trim();
                      return <option key={d.n} value={valClean}>{valClean}</option>;
                    })}
                  </select>
                </div>
              )}
            </div>
          );
        }

        const netDef = NETS.find((n: any) => n.id === bajante.net);
        const bmLabel = netDef?.bmType === 'bajante' ? 'bajante' : 'montante';
        return (
          <div style={{ padding: '4px 8px' }}>
            <button onClick={() => {
              const eng = engineRef.current;
              if (!eng) return;
              const isMon = bmLabel === 'montante';
              const pfx = netDef?.bmPfx || (isMon ? 'MON' : 'B');
              const cnt = eng.bajantes.filter((b: any) => b.tipo === bmLabel && (!isMon || b.net === bajante.net)).length + 1;
              const id = isMon ? pfx + cnt + '_' + bajante.net : (pfx + cnt);
              const code = isMon ? pfx + cnt : id;
              const nl = eng.nivelActual;
              eng.bajantes.push({
                id, net: bajante.net,
                tipo: bmLabel,
                code: code,
                direccion: bmLabel === 'bajante' ? 'baja' : 'sube',
                x: ep.x, y: ep.y,
                pisoBase: nl?.label ?? '',
                pisoCima: nl?.label ?? '',
                nptBase: nl?.npt ?? 0,
                nptCima: nl?.npt ?? 0,
                hVert: 0,
                dNominal: '0', recibeDeIds: [bajante.id], alimentaIds: [], descargaEnId: null,
                ucAcum: 0, ucExtra: 0, area_m2: 0,
                desplazamientos: {},
                lblOffX: 0, lblOffY: 0, labelAngle: 0,
                labelX: ep.x, labelY: ep.y + 20,
                bajR: 7 / 24,
              });
              if (bmLabel === 'montante') {
                eng._renumberMontantes();
              } else {
                eng._renumberBajantes(bajante.net);
              }
              const newlyCreated = eng.bajantes.find((b: any) => b.tipo === bmLabel && b.x === ep.x && b.y === ep.y);
              if (newlyCreated) {
                eng.selId = newlyCreated.id;
                eng._emitSelect(newlyCreated);
              }
              eng._isGhostSel = false;
              eng.render();
              eng._markDirty();
              setContextMenuState(null);
            }} style={{
              width: '100%', padding: '6px 8px', cursor: 'pointer',
              background: '#1e2024', border: '1px dashed #00dce5', borderRadius: 4,
              color: '#00dce5', fontSize: 11, fontFamily: "'Geist',monospace",
              textAlign: 'center', fontWeight: 600,
            }}>+ Crear {bmLabel}</button>
          </div>
        );
      })()}

      {hasPts && (
        <div style={{
          padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: 10, color: '#e2e2e8', fontFamily: "'Geist',monospace" }}> Bloquear movimiento</span>
          <input type="checkbox" checked={!!bajante.bloqueado}
            onChange={e => {
              const val = e.target.checked;
              if (engineRef.current) {
                engineRef.current?.updateElementById(bajante.id, { bloqueado: val });
                setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...prev.bajante, bloqueado: val } } : null);
                if (selElement?.id === bajante.id) {
                  setSelElement({ ...selElement, bloqueado: val });
                }
                engineRef.current?.render();
              }
            }}
            style={{ accentColor: '#F5A623', cursor: 'pointer', margin: 0 }} />
        </div>
      )}

      {hasPts && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4
        }}>
          <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Bajantes asociadas</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px 8px', maxHeight: 120, overflowY: 'auto', background: '#1e2024', border: '1px solid #3a494a', borderRadius: 3, padding: 4 }}>
            {(() => {
              const netBajantes = (engineRef.current?.bajantes || []).filter((b: any) => b.net === bajante.net && b.id !== bajante.id && b.tipo !== 'tributario');
              if (netBajantes.length === 0) return <div style={{ fontSize: 9, color: '#6b8cae', fontFamily: "'Geist',monospace", gridColumn: 'span 4' }}>Sin bajantes</div>;
              const currentId = bajante.id;
              return netBajantes.map((b: any) => {
                const isAssociated = (b.recibeDeIds || []).includes(currentId);
                return (
                  <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 9, color: '#b9caca', fontFamily: "'Geist',monospace", minWidth: 0 }}>
                    <input type="checkbox" checked={isAssociated}
                      onChange={e => {
                        const recibidos = b.recibeDeIds || [];
                        const newRecibe = e.target.checked
                          ? [...recibidos, currentId]
                          : recibidos.filter((id: string) => id !== currentId);
                        const extraFields: Record<string, any> = { recibeDeIds: newRecibe };
                        if (e.target.checked) {
                          extraFields.descargaEnId = currentId;
                        } else if (b.descargaEnId === currentId || b.descargaEnId?.endsWith('|' + currentId)) {
                          extraFields.descargaEnId = null;
                        }
engineRef.current?.updateElementById(b.id, extraFields);
                        setContextMenuState((prev: any) => prev ? { ...prev } : null);
                        if (selElement?.id === b.id) {
                          setSelElement({ ...selElement, ...extraFields });
                        }
                      }}
                      style={{ accentColor: '#F5A623', margin: 0, flexShrink: 0 }} />
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.code || b.label || b.id}</span>
                  </label>
                );
              });
            })()}
          </div>
        </div>
      )}
    </>
  );
}

export default memo(BajanteConnectionPanel);
