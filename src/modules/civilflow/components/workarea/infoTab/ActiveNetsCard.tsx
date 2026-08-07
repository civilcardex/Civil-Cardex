import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { REDES } from '../../../constants';
import { NETS } from '../../../lib/PlanoEngine/PlanoState';
import EditButton from '../../shared/EditButton';
import { devError } from '../../../../../utils/devError';
import { saveNetColor } from '../../../services/netColorsService';

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
              const cssVar = `--${r.id === 'recolectora' ? 'll' : r.id}`;
              const currentColor =
                r.id === 'recolectora' ? netColors['ll'] || '#8B5CF6' : netColors[r.id] || '#666';
              return (
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
              );
            });
          })()}
        </div>
      </div>
    </section>
  );
});

export default ActiveNetsCard;
