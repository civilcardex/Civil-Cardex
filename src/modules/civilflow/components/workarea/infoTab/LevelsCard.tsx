import React from 'react';
import { pisoLbl } from '../../../constants';
import EditButton from '../../shared/EditButton';
import type { Piso } from '../../useWorkAreaState';

const LevelsCard_S1: React.CSSProperties = {
  padding: '3px 6px',
  background: 'transparent',
  border: '1px solid var(--line)',
  borderRadius: 2,
  color: 'var(--txt3)',
  cursor: 'pointer',
  fontSize: 11,
  lineHeight: 1,
  flexShrink: 0,
  marginLeft: 2,
};
const LevelsCard_pisoLi: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  padding: '2px 4px',
  background: 'var(--bg3)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r)',
  marginBottom: 2,
};

const LevelsCard = React.memo(function LevelsCard({
  pisos,
  delPiso,
  addPiso,
  addSotano,
  setPisos,
}: {
  pisos: Piso[];
  delPiso: (id: string | number) => void;
  addPiso: () => void;
  addSotano: () => void;
  setPisos: (p: Piso[] | ((prev: Piso[]) => Piso[])) => void;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  return (
    <section
      className="card"
      style={{ flex: '1 1 auto', minWidth: 220, display: 'flex', flexDirection: 'column' }}
    >
      <div className="card-h" style={{ padding: '4px 8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <h3 className="card-t" style={{ fontSize: 13, display: 'flex', alignItems: 'center' }}>
            <img
              src="/iconos_civilflow/info_general/niveles_generados.webp"
              alt="Niveles generados"
              width={22}
              height={22}
              style={{ width: 22, height: 22, verticalAlign: 'middle', marginRight: 2 }}
              loading="lazy"
            />
            Niveles generados
            <EditButton edit={isEditing} setEdit={setIsEditing} />
          </h3>
          <span className="card-s" style={{ fontSize: 11 }}>
            {pisos.length} niveles
          </span>
        </div>
      </div>
      <div
        style={{
          padding: '4px 6px',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
        }}
      >
        {pisos.length === 0 && (
          <div
            style={{ fontSize: 12, color: 'var(--txt3)', textAlign: 'center', padding: '12px 0' }}
          >
            Presione "Generar niveles"
          </div>
        )}
        {pisos.length > 0 && (
          <>
            <ul
              role="list"
              style={{
                flex: 1,
                overflowY: 'auto',
                minHeight: 0,
                listStyle: 'none',
                margin: 0,
                padding: 0,
              }}
            >
              {pisos
                .toSorted(
                  (a, b) =>
                    (b.tipo === 'cubierta' ? 999 : b.n) - (a.tipo === 'cubierta' ? 999 : a.n),
                )
                .map((p) => (
                  <li
                    key={p.id}
                    style={{
                      ...LevelsCard_pisoLi,
                      borderLeft:
                        '3px solid ' +
                        (p.tipo === 'cubierta'
                          ? '#ffffff'
                          : p.n < 0
                            ? 'var(--txt3)'
                            : 'var(--acc2)'),
                    }}
                  >
                    <span
                      className={
                        p.tipo === 'cubierta'
                          ? 'piso-tag cub'
                          : p.n < 0
                            ? 'piso-tag sot'
                            : 'piso-tag'
                      }
                      style={{ fontSize: 11, padding: '2px 5px', minWidth: 48 }}
                    >
                      {pisoLbl(p.n)}
                    </span>
                    <input
                      type="text"
                      disabled={!isEditing}
                      inputMode="decimal"
                      value={p.npt ?? ''}
                      key={p.id + 'npt'}
                      className="npt-in"
                      aria-label={`NPT para ${pisoLbl(p.n)}`}
                      style={{
                        fontSize: 12,
                        width: 52,
                        padding: '2px 4px',
                        opacity: isEditing ? 1 : 0.7,
                      }}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/,/g, '.');
                        if (raw === '' || raw === '-' || raw === '.' || /^-?\d*\.?\d*$/.test(raw)) {
                          setPisos((prev) =>
                            prev.map((x) => (x.id === p.id ? { ...x, npt: raw } : x)),
                          );
                        }
                      }}
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) {
                          // Store as a real number, not the string toFixed(2) returns — anything
                          // that compares npt across floors (e.g. the cross-floor "Destino"
                          // dropdown) does a numeric `<=`, which silently becomes lexicographic
                          // string comparison the moment npt is a string, breaking floor ordering
                          // at any digit-count boundary (e.g. "9.00" > "30.00" as strings).
                          setPisos((prev) =>
                            prev.map((x) =>
                              x.id === p.id ? { ...x, npt: Number(v.toFixed(2)) } : x,
                            ),
                          );
                        }
                      }}
                    />
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: 20,
                      }}
                    >
                      <span style={{ fontSize: 11, color: 'var(--txt3)' }}>m</span>
                    </div>
                    <div className={`pdot ${p.ok ? 'ok' : ''}`} />
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => delPiso(p.id)}
                        title="Eliminar nivel"
                        style={LevelsCard_S1}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#ef5350';
                          e.currentTarget.style.borderColor = 'rgba(211,47,47,.5)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--txt3)';
                          e.currentTarget.style.borderColor = 'var(--line)';
                        }}
                      >
                        &#x2715;
                      </button>
                    )}
                  </li>
                ))}
            </ul>
            {isEditing && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 3,
                  marginTop: 2,
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  className="btn-xs"
                  onClick={addSotano}
                  style={{ padding: '3px 6px', fontSize: 10 }}
                >
                  + Sótano
                </button>
                <button
                  type="button"
                  className="btn-xs"
                  onClick={addPiso}
                  style={{ padding: '3px 6px', fontSize: 10 }}
                >
                  + Piso
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
});

export default LevelsCard;
