import { memo } from "react";
import { NETS } from "../../lib/PlanoEngine/PlanoState";
import { DIAM_BY_MAT } from "../../constants";
import { syncExtremeAccessoryToHidroData } from "../../utils/syncExtremeAccessory";
import { ACC_ABBR, bajanteLabel } from "../../utils/accessoryAbbreviations";

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
  planosCtx?: { plans: any[] };
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
  planosCtx,
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
                return bajRamales.map((r: any) => {
                  const isAssociated = recibidos.includes(r.id);
                  const rStart = r.pts?.[0];
                  const rEnd = r.pts?.[r.pts.length - 1];
                  const distStart = rStart ? Math.hypot(rStart[0] - bajante.x, rStart[1] - bajante.y) : Infinity;
                  const distEnd = rEnd ? Math.hypot(rEnd[0] - bajante.x, rEnd[1] - bajante.y) : Infinity;
                  const isAtStart = distStart <= distEnd;
                  const isAtEnd = distEnd < distStart;
                  return (
                    <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 9, color: '#b9caca', fontFamily: "'Geist',monospace", minWidth: 0 }}>
                      <input type="checkbox" checked={isAssociated}
                        onChange={e => {
                          const checked = e.target.checked;
                          const newRecibe = checked
                            ? [...recibidos, r.id]
                            : recibidos.filter((id: string) => id !== r.id);
                          engineRef.current?.updateElementById(bajante.id, { recibeDeIds: newRecibe });
                          setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...prev.bajante, recibeDeIds: newRecibe } } : null);
                          if (selElement?.id === bajante.id) {
                            setSelElement({ ...selElement, recibeDeIds: newRecibe });
                          }
                          const bajCode = bajante.code || bajante.id;
                          const currentIni = r.ini || '';
                          const currentFin = r.fin || '';
                          if (isAtStart) {
                            const newIni = checked ? bajCode : (currentIni === bajCode ? '' : currentIni);
                            engineRef.current?.updateElementById(r.id, { ini: newIni });
                          }
                          if (isAtEnd) {
                            const newFin = checked ? bajCode : (currentFin === bajCode ? '' : currentFin);
                            engineRef.current?.updateElementById(r.id, { fin: newFin });
                          }
                          engineRef.current?.render();
                          engineRef.current?._markDirty();
                        }}
                        style={{ accentColor: '#F5A623', margin: 0, flexShrink: 0 }} />
                      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label || r.id}</span>
                    </label>
                  );
                });
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
                  const isAssociated = (bajante.recibeDeIds || []).includes(b.id)
                    || (b.recibeDeIds || []).includes(currentId);
                  return (
                    <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 9, color: '#b9caca', fontFamily: "'Geist',monospace", minWidth: 0 }}>
                      <input type="checkbox" checked={isAssociated}
                        onChange={e => {
                          const checked = e.target.checked;
                          const bajFresh = bajante.recibeDeIds || [];
                          const otherFresh = b.recibeDeIds || [];

                          let newBajRecibe: string[];
                          let newOtherRecibe: string[];
                          if (checked) {
                            newBajRecibe = bajFresh.includes(b.id) ? bajFresh : [...bajFresh, b.id];
                            newOtherRecibe = otherFresh.includes(currentId) ? otherFresh : [...otherFresh, currentId];
                          } else {
                            newBajRecibe = bajFresh.filter((id: string) => id !== b.id);
                            newOtherRecibe = otherFresh.filter((id: string) => id !== currentId);
                          }

                          engineRef.current?.updateElementById(currentId, { recibeDeIds: newBajRecibe });
                          engineRef.current?.updateElementById(b.id, { recibeDeIds: newOtherRecibe });
                          const refreshed = engineRef.current?.bajantes.find((x: any) => x.id === currentId);
                          if (refreshed) setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...refreshed } } : null);
                          if (selElement?.id === currentId) {
                            setSelElement({ ...selElement, recibeDeIds: newBajRecibe });
                          }
                          if (selElement?.id === b.id) {
                            setSelElement({ ...selElement, recibeDeIds: newOtherRecibe });
                          }
                          engineRef.current?.render();
                        }}
                        style={{ accentColor: '#2563eb', margin: 0, flexShrink: 0 }} />
                      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={bajanteLabel(b, engineRef.current?.nivelActual?.label)}>{bajanteLabel(b, engineRef.current?.nivelActual?.label)}</span>
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

        const netDef = NETS.find((n: any) => n.id === bajante.net);
        const bmLabel = netDef?.bmType === 'bajante' ? 'bajante' : 'montante';

        return (
          <>
            {(bajante.tipo === 'tributario' || bajante.tipo === 'ramal') && ['san', 'af', 'ac'].includes(bajante.net) && (() => {
              const isStart = ep.idx === 0;
              const fieldAcc = isStart ? 'accesorioInicio' : 'accesorioFin';
              const fieldDiam = isStart ? 'diametroInicio' : 'diametroFin';

              const currentAcc = bajante[fieldAcc] || '';
              const currentDiam = bajante[fieldDiam] || bajante.diametro || '';

              const matList = mats?.[bajante.net] || [];
              const matShort = bajante.material || matList[0]?.val || '';
              const diamList = DIAM_BY_MAT[matShort] || [];

              const accOptions = bajante.net === 'san'
                ? [
                    { value: 'sifon', label: 'Sifón' },
                    { value: 'codoSube', label: 'Codo Sube' },
                    { value: 'codoBaja', label: 'Codo Baja' },
                    { value: 'codoReventilado', label: 'Codo reventilado' },
                  ]
                : [
                    { value: 'valvCompuerta', label: 'Válvula compuerta' },
                    { value: 'valvGlobo', label: 'Válvula globo' },
                    { value: 'valvCheque', label: 'Válvula cheque' },
                    { value: 'valvAngulo', label: 'Válvula ángulo' },
                  ];

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
                          const oldVal = bajante[fieldAcc] || '';
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
                          if (val !== oldVal && planosCtx?.plans) {
                            syncExtremeAccessoryToHidroData(bajante.id, fieldAcc, oldVal, val, planosCtx.plans);
                          }
                        }
                      }}
                      style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}
                    >
                      <option value="">Ninguno</option>
                      {accOptions.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
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
                        {(currentAcc === 'sifon'
                          ? diamList.filter((d: any) => { const v = parseFloat(d.n); return v === 2 || v === 3 || v === 4; })
                          : diamList
                        ).map((d: any) => {
                          const valClean = d.n.split(' — ')[0].trim();
                          return <option key={d.n} value={valClean}>{valClean}</option>;
                        })}
                      </select>
                    </div>
                  )}
                </div>
              );
            })()}

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
          </>
        );
})()}

    </>
  );
}

export default memo(BajanteConnectionPanel);
