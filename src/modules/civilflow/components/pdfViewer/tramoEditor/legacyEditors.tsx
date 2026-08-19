import { DIAM_BY_MAT, DIAM_BAN, DIAM_VENT } from '../../../constants';
import { VENTILACION, NETS_WITH_MULTIPLE_MATERIALS } from '../../../pages/catalog/catalogData';
import { DIAMETROS_AF } from '../../../constants/hydraulicData';
import { CAT_GAS, GAS_DN_LABELS, GAS } from '../../../constants/engineeringDataGas';
import { normalizeDnLabel } from '../../../utils/formatUtils';
import { diamPulgFromLabel } from '../../../utils/diamPulgFromLabel';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine';
import type { PlanoElement, PlanoRamal, PlanoBajante } from '../../../lib/PlanoEngine/PlanoState';
import {
  SELECT_STYLE,
  INPUT_CENTER_STYLE,
  CHECK_GRID_STYLE,
  CHECK_ROW_STYLE,
  READONLY_CENTER_STYLE,
  SELECT_CENTER_STYLE,
  MAT_ROW_STYLE,
  MAT_NAME_STYLE,
  ramalHasCodoReventilado,
} from './context';

export function ContadorEditor({
  selElement,
  activeNet,
  handleUpdateSel,
}: {
  selElement: PlanoBajante;
  activeNet: string;
  handleUpdateSel: (field: string, value: unknown) => void;
}) {
  return (
    <>
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <div
            style={{
              fontFamily: "'Geist',monospace",
              fontSize: 12,
              color: '#9BA8AA',
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            Datos del Contador
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#b9caca',
              fontFamily: "'Geist',monospace",
              padding: '2px 0',
            }}
          >
            {selElement.code || selElement.id}
          </div>
        </div>
      </div>

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
          Conexión
        </div>
        <select
          value={selElement.diametro ?? ''}
          aria-label="Conexión"
          onChange={(e) => {
            handleUpdateSel('diametro', e.target.value);
          }}
          style={SELECT_STYLE}
        >
          <option value="">— Seleccionar —</option>
          {activeNet === 'gas'
            ? GAS_DN_LABELS.map((d) => (
                <option key={d} value={d}>
                  {normalizeDnLabel(d)}
                </option>
              ))
            : DIAMETROS_AF.map((d) => (
                <option key={d.nominal} value={d.nominal}>
                  {normalizeDnLabel(d.nominal)}
                </option>
              ))}
        </select>
      </div>
    </>
  );
}

export function CalentadorEditor({
  selElement,
  handleUpdateSel,
}: {
  selElement: PlanoBajante;
  handleUpdateSel: (field: string, value: unknown) => void;
}) {
  return (
    <>
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <div
            style={{
              fontFamily: "'Geist',monospace",
              fontSize: 12,
              color: '#9BA8AA',
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            Datos del Calentador
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#b9caca',
              fontFamily: "'Geist',monospace",
              padding: '2px 0',
            }}
          >
            {selElement.code || selElement.id}
          </div>
        </div>
      </div>

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
          Capacidad
        </div>
        <select
          value={selElement.capacidad ?? ''}
          aria-label="Capacidad"
          onChange={(e) => {
            handleUpdateSel('capacidad', e.target.value);
          }}
          style={SELECT_STYLE}
        >
          <option value="">— Seleccionar —</option>
          {CAT_GAS.filter((g) => g.id.startsWith('cal')).map((g) => (
            <option key={g.id} value={g.id}>
              {g.n}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

export function BajanteEditor({
  selElement,
  activeNet,
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
              {(selElement.net === 'vent' ? DIAM_VENT : DIAM_BAN).map((d) => (
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
              {(selElement.net === 'vent' ? DIAM_VENT : DIAM_BAN).map((d) => (
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
        {activeNet === 'san' && (
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
      </div>
    </div>
  );
}

function CaudalField({ selElement }: { selElement: PlanoRamal | null }) {
  const extVal = selElement?.caudal;
  const display =
    extVal != null && (extVal as unknown as string) !== '' && !isNaN(Number(extVal))
      ? Number(extVal).toFixed(2)
      : '—';
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          color: '#9BA8AA',
          fontFamily: "'Geist',monospace",
          marginBottom: 2,
          textTransform: 'uppercase',
          letterSpacing: 0,
          whiteSpace: 'nowrap',
        }}
      >
        Caudal (LPS)
      </div>
      <div style={{ ...READONLY_CENTER_STYLE, display: 'flex', alignItems: 'center' }}>
        {display}
      </div>
    </div>
  );
}

export function RamalEditor({
  selElement,
  activeNet,
  engineRef,
  setSelElement,
  isSelActiveNet,
  diamSel,
  gasMatSel,
  pendSel,
  pendInput,
  mats,
  matLongName,
  setDiamSel,
  setGasMatSel,
  setPendSel,
  setPendInput,
}: {
  selElement: PlanoRamal | null;
  activeNet: string;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  setSelElement: React.Dispatch<React.SetStateAction<PlanoElement | null>>;
  isSelActiveNet: boolean | null;
  diamSel: Record<string, string>;
  gasMatSel: Record<string, string>;
  pendSel: Record<string, number>;
  pendInput: string;
  mats: Record<string, Array<{ val: string }>> | null;
  matLongName: (short: string) => string;
  setDiamSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setGasMatSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setPendSel: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setPendInput: React.Dispatch<React.SetStateAction<string>>;
}) {
  const isGas = activeNet === 'gas';
  const isVen = activeNet === 'vent';
  // El ramal seleccionado puede pertenecer legítimamente a una red distinta de la activa en la barra
  // (p. ej. sigue seleccionado tras cambiar de pestaña de red) — su material debe tomarse siempre
  // del catálogo de SU propia red, no de la red que la barra esté mostrando en ese momento.
  const matNet = selElement?.net || activeNet;
  const matList = mats?.[matNet] || [];
  const matShort = matList[0]?.val || '—';
  const matName = matLongName(matShort);
  let diamList: Array<{ n: string }> = [];
  if (isVen) {
    diamList = VENTILACION[0]?.rows.map((r) => ({ n: r.dn })) || [];
  } else {
    diamList = DIAM_BY_MAT[matShort] || [];
  }
  let currentDiam: string = '',
    currentMat: string = '';
  if (isGas) {
    // Gas tiene varias opciones reales de material — no debe asumir silenciosamente GAS[0]; el usuario
    // elige explícitamente, igual que en cualquier otra red con varios materiales.
    currentMat = (isSelActiveNet && selElement?.material) || gasMatSel[activeNet] || '';
    currentDiam =
      isSelActiveNet && selElement?.diametro !== undefined && selElement?.diametro !== ''
        ? selElement!.diametro
        : diamSel[activeNet] || '';
  } else {
    currentDiam =
      isSelActiveNet && selElement?.diametro !== undefined && selElement?.diametro !== ''
        ? selElement!.diametro.split(' — ')[0].trim()
        : diamSel[activeNet] || '';
  }
  const showPend = activeNet === 'san' || activeNet === 'll';
  const showDeltaZ = activeNet === 'af' || activeNet === 'ac' || activeNet === 'gas';
  const showDescargas = activeNet === 'af' || activeNet === 'ac' || activeNet === 'san';
  const showCaudal = activeNet === 'll';
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
        {isGas ? (
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
              Material
            </div>
            <select
              value={currentMat}
              aria-label="Material"
              onChange={(e) => {
                const mat = e.target.value;
                const g = GAS.find((x) => x.mat === mat);
                const dn = g ? g.rows[0]?.dn || '' : '';
                setGasMatSel((prev) => ({ ...prev, [activeNet]: mat }));
                setDiamSel((prev) => ({ ...prev, [activeNet]: dn }));
                if (engineRef.current && selElement) {
                  engineRef.current.updateSelected({ material: mat, diametro: dn });
                  setSelElement({ ...selElement, material: mat, diametro: dn });
                }
              }}
              style={SELECT_CENTER_STYLE}
            >
              <option value="">— Sin material —</option>
              {GAS.map((g) => (
                <option key={g.mat} value={g.mat}>
                  {g.mat}
                </option>
              ))}
            </select>
          </div>
        ) : NETS_WITH_MULTIPLE_MATERIALS.has(matNet) ? (
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
              Material
            </div>
            <select
              value={(isSelActiveNet && selElement?.material) || matShort}
              aria-label="Material"
              onChange={(e) => {
                const mat = e.target.value;
                if (!engineRef.current || !selElement) return;
                const updates: Record<string, unknown> = { material: mat };
                const nd = DIAM_BY_MAT[mat] || [];
                const curD = selElement.diametro ? selElement.diametro.split(' — ')[0].trim() : '';
                if (curD && !nd.some((d) => d.n.split(' — ')[0].trim() === curD)) {
                  updates.diametro = '';
                  updates.diametroInicio = '';
                  updates.diametroFin = '';
                }
                engineRef.current.updateSelected(updates);
                setSelElement({ ...selElement, ...updates });
                setDiamSel((prev) => ({ ...prev, [activeNet]: '' }));
              }}
              style={SELECT_CENTER_STYLE}
            >
              {matList.map((m) => (
                <option key={m.val} value={m.val}>
                  {matLongName(m.val)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div style={MAT_ROW_STYLE}>
            <span
              style={{
                fontSize: 12,
                color: '#8AB4D6',
                fontFamily: "'Geist',monospace",
                textTransform: 'uppercase',
                letterSpacing: 1,
                flexShrink: 0,
              }}
            >
              Material
            </span>
            <span style={MAT_NAME_STYLE} title={matName}>
              {matName}
            </span>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: showPend ? '1fr 1fr' : '1fr', gap: 6 }}>
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
            {isGas ? (
              <select
                value={currentDiam}
                aria-label="Diámetro"
                onChange={(e) => {
                  const dn = e.target.value;
                  // Invariante: ramal.diam >= accesorio.diam, igual que en el menú contextual.
                  const inchFrom = (d: string) => {
                    const q = d.indexOf('"');
                    return q > 0 ? d.slice(0, q) : d;
                  };
                  // Leer datos frescos del engine — el snapshot selElement puede estar stale
                  // si el usuario cambió el diámetro desde otro componente.
                  const fresh = engineRef.current
                    ? selElement
                      ? engineRef.current.ramales.find((r) => r.id === selElement.id)
                      : [...engineRef.current.ramales]
                          .reverse()
                          .find((r) => r.net === activeNet && !r.mergesFrom)
                    : null;
                  const aI = (fresh?.diametroInicio as string) || '';
                  const aF = (fresh?.diametroFin as string) || '';
                  const aNum = Math.max(
                    aI ? diamPulgFromLabel(inchFrom(aI)) : 0,
                    aF ? diamPulgFromLabel(inchFrom(aF)) : 0,
                  );
                  if (dn && aNum > 0 && diamPulgFromLabel(inchFrom(dn)) < aNum) {
                    const aINum = aI ? diamPulgFromLabel(inchFrom(aI)) : 0;
                    const aFNum = aF ? diamPulgFromLabel(inchFrom(aF)) : 0;
                    const blockEnd = aINum >= aFNum ? 'INICIO' : 'FIN';
                    const blockDiam = aINum >= aFNum ? aI : aF;
                    engineRef.current?.triggerAlert(
                      'Diámetro no permitido',
                      `El diámetro del ramal no puede ser menor al del accesorio conectado en el extremo ${blockEnd} (${blockDiam}). Reduce el diámetro del accesorio o selecciona un ramal mayor.`,
                    );
                    return;
                  }
                  setDiamSel((prev) => ({ ...prev, [activeNet]: dn }));
                  // NO sobrescribir diametroInicio/Fin: el accesorio tiene su propio selector de
                  // diámetro (ExtremeAccessoryEditor) y la invariante ramal >= accesorio permite
                  // accesorios más angostos que el ramal. Forzarlos al diámetro del ramal hacía
                  // que el segundo cambio de diámetro alertara siempre: el accesorio quedaba con
                  // el valor anterior del ramal y bloqueaba cualquier reducción posterior.
                  if (engineRef.current && selElement) {
                    engineRef.current.updateSelected({ diametro: dn });
                    setSelElement({ ...selElement, diametro: dn });
                  } else if (engineRef.current && !selElement) {
                    const eng = engineRef.current;
                    const lastRamal = [...eng.ramales]
                      .reverse()
                      .find((r) => r.net === activeNet && !r.mergesFrom);
                    if (lastRamal) {
                      eng.selId = lastRamal.id;
                      eng.updateSelected({ diametro: dn });
                      const { _labelBox, ...rest } = lastRamal;
                      setSelElement({ ...rest, diametro: dn });
                    }
                  }
                }}
                style={SELECT_CENTER_STYLE}
              >
                {(() => {
                  const gasMat = GAS.find((g) => g.mat === currentMat);
                  return gasMat ? (
                    gasMat.rows.map((r) => (
                      <option key={r.dn} value={r.dn}>
                        {normalizeDnLabel(r.dn)}
                      </option>
                    ))
                  ) : (
                    <option value="">—</option>
                  );
                })()}
              </select>
            ) : diamList.length > 0 ? (
              <select
                value={currentDiam}
                aria-label="Diámetro"
                onChange={(e) => {
                  const v = e.target.value;
                  const targetRamal =
                    selElement ||
                    (engineRef.current &&
                      [...engineRef.current.ramales]
                        .reverse()
                        .find((r) => r.net === activeNet && !r.mergesFrom));
                  if (
                    activeNet === 'san' &&
                    (diamPulgFromLabel(v) < 3 || diamPulgFromLabel(v) > 4) &&
                    targetRamal?.tipo === 'ramal' &&
                    ramalHasCodoReventilado(targetRamal)
                  ) {
                    engineRef.current?.triggerAlert(
                      'Diámetro no permitido',
                      'La tubería principal sanitaria con codo reventilado solo admite diámetro de 3" o 4".',
                    );
                    return;
                  }
                  // Invariante: ramal.diam >= accesorio.diam, igual que en el menú contextual.
                  {
                    const inchFrom = (d: string) => {
                      const q = d.indexOf('"');
                      return q > 0 ? d.slice(0, q) : d;
                    };
                    // Leer datos frescos del engine — el snapshot selElement puede estar stale.
                    const fresh = engineRef.current
                      ? selElement
                        ? engineRef.current.ramales.find((r) => r.id === selElement.id)
                        : [...engineRef.current.ramales]
                            .reverse()
                            .find((r) => r.net === activeNet && !r.mergesFrom)
                      : null;
                    const aI = (fresh?.diametroInicio as string) || '';
                    const aF = (fresh?.diametroFin as string) || '';
                    const aNum = Math.max(
                      aI ? diamPulgFromLabel(inchFrom(aI)) : 0,
                      aF ? diamPulgFromLabel(inchFrom(aF)) : 0,
                    );
                    if (v && aNum > 0 && diamPulgFromLabel(inchFrom(v)) < aNum) {
                      const aINum = aI ? diamPulgFromLabel(inchFrom(aI)) : 0;
                      const aFNum = aF ? diamPulgFromLabel(inchFrom(aF)) : 0;
                      const blockEnd = aINum >= aFNum ? 'INICIO' : 'FIN';
                      const blockDiam = aINum >= aFNum ? aI : aF;
                      engineRef.current?.triggerAlert(
                        'Diámetro no permitido',
                        `El diámetro del ramal no puede ser menor al del accesorio conectado en el extremo ${blockEnd} (${blockDiam}). Reduce el diámetro del accesorio o selecciona un ramal mayor.`,
                      );
                      return;
                    }
                  }
                  setDiamSel((prev) => ({ ...prev, [activeNet]: v }));
                  // NO sobrescribir diametroInicio/Fin — ver comentario en la rama GAS.
                  if (engineRef.current && selElement) {
                    engineRef.current.updateSelected({ diametro: v });
                    setSelElement({ ...selElement, diametro: v });
                  } else if (engineRef.current && !selElement) {
                    const eng = engineRef.current;
                    const lastRamal = [...eng.ramales]
                      .reverse()
                      .find((r) => r.net === activeNet && !r.mergesFrom);
                    if (lastRamal) {
                      eng.selId = lastRamal.id;
                      eng.updateSelected({ diametro: v });
                      const { _labelBox, ...rest } = lastRamal;
                      setSelElement({ ...rest, diametro: v });
                    }
                  }
                }}
                style={SELECT_CENTER_STYLE}
              >
                <option value="">Sin diámetro</option>
                {diamList.map((d) => {
                  const valClean = d.n.split(' — ')[0].trim();
                  return (
                    <option key={d.n} value={valClean}>
                      {normalizeDnLabel(valClean)}
                    </option>
                  );
                })}
              </select>
            ) : (
              <div
                style={{
                  padding: '4px 6px',
                  background: '#1e2024',
                  border: '1px solid #3a494a',
                  borderRadius: 3,
                  color: '#8AB4D6',
                  fontSize: 12,
                  fontFamily: "'Geist',monospace",
                }}
              >
                — Sin opciones —
              </div>
            )}
          </div>
          {showPend ? (
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: '#9BA8AA',
                  fontFamily: "'Geist',monospace",
                  marginBottom: 2,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                Pendiente %
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={pendInput}
                aria-label="Pendiente (%)"
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                  setPendInput(raw);
                }}
                onBlur={(e) => {
                  const v = parseFloat(e.target.value.replace(/,/g, '.')) || 0;
                  setPendInput(v > 0 ? String(v) : '');
                  setPendSel((prev) => ({ ...prev, [activeNet]: v }));
                  if (engineRef.current && selElement) {
                    engineRef.current.updateSelected({ pendiente: v });
                    setSelElement({ ...selElement, pendiente: v });
                  } else if (engineRef.current && !selElement) {
                    const eng = engineRef.current;
                    const lastRamal = [...eng.ramales]
                      .reverse()
                      .find((r) => r.net === activeNet && !r.mergesFrom);
                    if (lastRamal) {
                      eng.selId = lastRamal.id;
                      eng.updateSelected({ pendiente: v });
                      const { _labelBox, ...rest } = lastRamal;
                      setSelElement({ ...rest, pendiente: v });
                    }
                  }
                }}
                onFocus={() => {
                  const current =
                    isSelActiveNet && selElement?.pendiente !== undefined
                      ? selElement.pendiente
                      : pendSel[activeNet] !== undefined
                        ? pendSel[activeNet]
                        : 2.0;
                  setPendInput(current > 0 ? String(current) : '');
                }}
                style={INPUT_CENTER_STYLE}
              />
            </div>
          ) : null}
        </div>
        {showCaudal && <CaudalField selElement={selElement} />}
        {(showDeltaZ || showDescargas) && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: showDeltaZ || showDescargas ? '1fr 1fr' : '1fr',
              gap: 6,
            }}
          >
            {showDeltaZ && (
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#9BA8AA',
                    fontFamily: "'Geist',monospace",
                    marginBottom: 2,
                    textTransform: 'uppercase',
                    letterSpacing: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Altura (m)
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={selElement?.dz ?? ''}
                  placeholder="0.00"
                  aria-label="Delta Z o longitud vertical (m)"
                  onChange={(e) => {
                    if (engineRef.current) {
                      const v = e.target.value;
                      engineRef.current.updateSelected({ dz: v, lvert: v });
                      setSelElement({ ...selElement, dz: v, lvert: v } as PlanoRamal);
                    }
                  }}
                  style={READONLY_CENTER_STYLE}
                />
              </div>
            )}
            {showDescargas && (
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#9BA8AA',
                    fontFamily: "'Geist',monospace",
                    marginBottom: 2,
                    textTransform: 'uppercase',
                    letterSpacing: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Descargas
                </div>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={selElement?.nSalidas ?? 1}
                  placeholder="1"
                  aria-label="Número de descargas en simultáneo"
                  onChange={(e) => {
                    if (engineRef.current) {
                      const v = parseInt(e.target.value) || 1;
                      engineRef.current.updateSelected({ nSalidas: v });
                      setSelElement({ ...selElement, nSalidas: v } as PlanoRamal);
                    }
                  }}
                  style={READONLY_CENTER_STYLE}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
