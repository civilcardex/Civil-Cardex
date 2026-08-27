import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { REDES } from '../../../constants';
import { NETS } from '../../../lib/PlanoEngine/PlanoState';
import EditButton from '../../shared/EditButton';
import { devError } from '../../../../../utils/devError';
import { saveNetColor } from '../../../services/netColorsService';
import {
  loadFromStorage,
  saveToStorage,
  getActiveProyectoId,
} from '../../../services/storageService';

const AF_ALIMENTACION_KEY = 'civilflow_af_alimentacion';
type AfAlim = 'ep' | 'tanque' | 'red';
const AF_ALIM_ICONS: Record<AfAlim, string> = {
  ep: '/iconos_civilflow/diseno_redes/equipos/red_equipo_presion.webp',
  tanque: '/tanque_alto_de_alimentacion.webp',
  red: '/red_de_agua_directa.webp',
};

const ActiveNetsCard_netBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  background: 'var(--bg3)',
  borderTop: '1px solid var(--line)',
  borderRight: '1px solid var(--line)',
  borderBottom: '1px solid var(--line)',
  borderLeft: '1px solid var(--line)',
  borderRadius: 'var(--r)',
  transition: 'all .15s',
  font: 'inherit',
  color: 'inherit',
  textAlign: 'left',
};

const ActiveNetsCard = React.memo(function ActiveNetsCard({
  redes,
  setRedes,
  netColors,
  setNetColors,
}: {
  redes: Set<string>;
  setRedes: Dispatch<SetStateAction<Set<string>>>;
  netColors: Record<string, string>;
  setNetColors: Dispatch<SetStateAction<Record<string, string>>>;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [afAlim, setAfAlim] = React.useState<AfAlim>(() => {
    const v = loadFromStorage<AfAlim | null>(AF_ALIMENTACION_KEY, null);
    return v === 'tanque' || v === 'red' ? v : 'ep';
  });
  const [tanqueNpt, setTanqueNpt] = React.useState<string>(() => {
    const v = loadFromStorage<string | null>('civilflow_tanque_npt', null);
    return v ?? '';
  });
  React.useEffect(() => {
    const pid = getActiveProyectoId();
    if (!pid) return;
    void (async () => {
      const { loadAfAlimentacion, loadTanqueNpt } =
        await import('../../../services/proyectoDataService');
      const [afDb, nptDb] = await Promise.all([loadAfAlimentacion(pid), loadTanqueNpt(pid)]);
      if (afDb && (afDb === 'ep' || afDb === 'tanque' || afDb === 'red')) {
        setAfAlim(afDb as AfAlim);
        saveToStorage(AF_ALIMENTACION_KEY, afDb);
      }
      if (nptDb != null) {
        setTanqueNpt(nptDb);
        saveToStorage('civilflow_tanque_npt', nptDb);
      }
    })();
  }, []);
  const afOn = redes.has('af');
  const afAlimEff: AfAlim = afOn && afAlim === 'ep' && !redes.has('ep') ? 'red' : afAlim;
  const setAfAlimAndSync = (v: AfAlim) => {
    setAfAlim(v);
    saveToStorage(AF_ALIMENTACION_KEY, v);
    const pid = getActiveProyectoId();
    if (pid)
      void import('../../../services/proyectoDataService').then(
        ({ saveAfAlimentacion }) => void saveAfAlimentacion(pid, v),
      );
    const n = new Set(redes);
    if (v === 'ep') n.add('ep');
    else n.delete('ep');
    setRedes(n);
  };
  return (
    <section className="card" style={{ flex: '0 1 auto', minWidth: 190 }}>
      <div className="card-h" style={{ padding: '4px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <h3 className="card-t" style={{ fontSize: 13, display: 'flex', alignItems: 'center' }}>
            <img
              src="/iconos_civilflow/info_general/redes_activas.webp"
              alt="Redes activas"
              width={22}
              height={22}
              style={{ width: 22, height: 22, verticalAlign: 'middle', marginRight: 2 }}
              loading="lazy"
            />
            Redes activas
            <EditButton edit={isEditing} setEdit={setIsEditing} />
          </h3>
          <span className="card-s" style={{ fontSize: 11 }}>
            {
              [...redes].filter(
                (id) => id !== 'ep' && id !== 'bom' && id !== 'vent' && id !== 'recolectora',
              ).length
            }{' '}
            de{' '}
            {
              REDES.filter(
                (r) => r.id !== 'ep' && r.id !== 'bom' && r.id !== 'vent' && r.id !== 'recolectora',
              ).length
            }
          </span>
        </div>
      </div>
      <div style={{ padding: '4px 6px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2 }}>
          {(() => {
            const mainNets = REDES.filter(
              (r) =>
                r.id !== 'ep' &&
                r.id !== 'bom' &&
                r.id !== 'san' &&
                r.id !== 'vent' &&
                r.id !== 'recolectora',
            );
            const sanRede = REDES.find((x) => x.id === 'san');
            const ventRede = REDES.find((x) => x.id === 'vent');
            const llRede = REDES.find((x) => x.id === 'll');
            const recolectoraRede = REDES.find((x) => x.id === 'recolectora');
            const ordered = [...mainNets];
            if (sanRede) ordered.push(sanRede);
            if (ventRede) ordered.push(ventRede);
            if (llRede && recolectoraRede) {
              const llIdx = ordered.indexOf(llRede);
              if (llIdx >= 0) ordered.splice(llIdx + 1, 0, recolectoraRede);
            }

            return ordered.map((r) => {
              const isVent = r.id === 'vent';
              const isRecolectora = r.id === 'recolectora';
              const isSub = isVent || isRecolectora;
              const on = redes.has(r.id);
              const sanOn = redes.has('san');
              const llOn = redes.has('ll');
              const parentOn = isVent ? sanOn : isRecolectora ? llOn : true;
              if (isSub && !parentOn) return null;
              const cssVar = `--${r.id === 'recolectora' ? 'll' : r.id}`;
              const currentColor =
                r.id === 'recolectora' ? netColors['ll'] || '#8B5CF6' : netColors[r.id] || '#666';
              return (
                <div key={r.id} style={{ display: 'contents' }}>
                  <button
                    type="button"
                    key={r.id}
                    disabled={!isEditing || (isSub && !parentOn)}
                    onClick={() => {
                      if (isSub && !parentOn) return;
                      const n = new Set(redes);
                      if (isRecolectora && !llOn && !on) {
                        n.add('ll');
                        n.add(r.id);
                      } else if (isVent && !sanOn && !on) {
                        n.add(r.id);
                      } else {
                        if (on) n.delete(r.id);
                        else n.add(r.id);
                        // La ventilación siempre acompaña a la sanitaria: activar san activa
                        // vent, desactivar san la apaga también.
                        if (r.id === 'san') {
                          if (on) n.delete('vent');
                          else n.add('vent');
                        }
                      }
                      setRedes(n);
                    }}
                    style={{
                      ...ActiveNetsCard_netBtn,
                      padding: isSub ? '2px 5px 2px 12px' : '3px 5px',
                      marginLeft: isSub ? 10 : 0,
                      cursor: isEditing && (!isSub || parentOn) ? 'pointer' : 'default',
                      width: isSub ? 'calc(100% - 10px)' : '100%',
                      opacity: isEditing && (!isSub || parentOn) ? 1 : 0.5,
                    }}
                  >
                    {r.icoImg ? (
                      <img
                        src={r.icoImg}
                        alt=""
                        width={22}
                        height={22}
                        style={{ width: 22, height: 22, verticalAlign: 'middle' }}
                        loading="lazy"
                      />
                    ) : (
                      <span style={{ fontSize: 13 }}>{r.ico}</span>
                    )}
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: 12,
                        color: on ? currentColor : 'var(--txt2)',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                    >
                      {r.lbl}
                    </span>
                    {!isRecolectora && (
                      <input
                        type="color"
                        value={currentColor}
                        disabled={!isEditing || (isSub && !parentOn)}
                        aria-label="Color de red"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const c = e.target.value;
                          setNetColors((prev) => ({ ...prev, [r.id]: c }));
                          document.documentElement.style.setProperty(cssVar, c);
                          try {
                            const net = NETS.find((n) => n.id === r.id);
                            if (net) net.col = c;
                          } catch (e) {
                            devError(e);
                          }
                          void saveNetColor(r.id, c);
                        }}
                        style={{
                          width: 14,
                          height: 14,
                          border: 'none',
                          padding: 0,
                          cursor: isEditing && (!isSub || parentOn) ? 'pointer' : 'default',
                          background: 'none',
                          flexShrink: 0,
                          opacity: isEditing && (!isSub || parentOn) ? 1 : 0.5,
                        }}
                      />
                    )}
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: on ? currentColor : 'transparent',
                        border: '1.5px solid ' + (on ? currentColor : 'var(--txt3)'),
                      }}
                    />
                    <span className="visually-hidden">{on ? 'Activa' : 'Inactiva'}</span>
                  </button>
                  {r.id === 'af' && afOn && (
                    <div
                      style={{
                        marginLeft: 10,
                        marginTop: 2,
                        paddingLeft: 8,
                        borderLeft: '2px solid var(--line)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)' }}>
                        ¿Cómo se alimenta la red?
                      </span>
                      {(
                        [
                          { id: 'ep' as const, lbl: 'Equipo de presión' },
                          { id: 'tanque' as const, lbl: 'Tanque alto' },
                          { id: 'red' as const, lbl: 'Red' },
                        ] as const
                      ).map((o) => {
                        const oOn = afAlimEff === o.id;
                        return (
                          <React.Fragment key={o.id}>
                            <button
                              type="button"
                              role="radio"
                              aria-checked={oOn}
                              disabled={!isEditing}
                              onClick={() => isEditing && setAfAlimAndSync(o.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '3px 6px',
                                background: 'var(--bg3)',
                                border: `1px solid ${oOn ? 'var(--acc)' : 'var(--line)'}`,
                                borderRadius: 'var(--r)',
                                width: '100%',
                                font: 'inherit',
                                color: 'inherit',
                                textAlign: 'left',
                                cursor: isEditing ? 'pointer' : 'default',
                                opacity: isEditing ? 1 : 0.75,
                              }}
                            >
                              <img
                                src={AF_ALIM_ICONS[o.id]}
                                alt=""
                                width={18}
                                height={18}
                                style={{
                                  width: 18,
                                  height: 18,
                                  objectFit: 'contain',
                                  flexShrink: 0,
                                }}
                                loading="lazy"
                              />
                              <span
                                style={{
                                  fontSize: 12,
                                  flex: 1,
                                  color: oOn ? '#fff' : 'var(--txt2)',
                                }}
                              >
                                {o.lbl}
                              </span>
                              <span
                                aria-hidden="true"
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: '50%',
                                  flexShrink: 0,
                                  background: oOn ? 'var(--acc)' : 'transparent',
                                  border: `1.5px solid ${oOn ? 'var(--acc)' : 'var(--txt3)'}`,
                                }}
                              />
                            </button>
                            {o.id === 'tanque' && oOn && (
                              <div
                                style={{
                                  marginTop: 2,
                                  marginLeft: 22,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 4,
                                  paddingLeft: 8,
                                  borderLeft: '2px solid var(--line)',
                                }}
                              >
                                <label
                                  htmlFor="tanque-npt-input"
                                  style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)' }}
                                >
                                  NPT salida tanque (m)
                                </label>
                                <input
                                  id="tanque-npt-input"
                                  type="text"
                                  inputMode="decimal"
                                  value={tanqueNpt}
                                  disabled={!isEditing}
                                  onChange={(e) => {
                                    const v = e.target.value.replace(',', '.');
                                    setTanqueNpt(v);
                                    saveToStorage('civilflow_tanque_npt', v);
                                  }}
                                  onBlur={async (e: React.FocusEvent<HTMLInputElement>) => {
                                    const v = e.currentTarget.value;
                                    const pid = getActiveProyectoId();
                                    if (pid) {
                                      const { saveTanqueNpt } =
                                        await import('../../../services/proyectoDataService');
                                      void saveTanqueNpt(pid, v);
                                    }
                                  }}
                                  placeholder="0.00"
                                  style={{
                                    padding: '4px 6px',
                                    borderRadius: 'var(--r)',
                                    border: '1px solid var(--line)',
                                    background: 'var(--bg)',
                                    fontSize: 12,
                                    opacity: isEditing ? 1 : 0.7,
                                  }}
                                />
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      </div>
    </section>
  );
});

export default ActiveNetsCard;
