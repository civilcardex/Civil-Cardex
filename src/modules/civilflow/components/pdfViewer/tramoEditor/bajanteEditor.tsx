/** Editor en panel derecho del bajante/montante real seleccionado: diámetro, altura H de montante, llenado/área en ll (Lluvias), dirección y ramales asociados; delega en el editor fantasma si la selección es XFG. */
import { DIAM_VENT } from '../../../constants';
import { opcionesDiametroElemento } from '../drawingElementContextMenu/diameterSelector.tsx';
import { MATERIALES_CUBIERTA_LL } from '../../../constants/engineeringDataMaterials.ts';
import { useMaterialesLl } from '../../../context/RainwaterContext.tsx';
import { OpcionesMaterial } from '../drawingElementContextMenu/associatedChannels';
import { usePlans } from '../../../context/PlansContext.tsx';
import { direccionBajaPermitida } from '../../../lib/PlanoEngine/directionRules.ts';
import { normalizeDnLabel } from '../../../utils/formatUtils.ts';
import { diamPulgFromLabel } from '../../../utils/diamInchesFromLabel.ts';
import { entradaPor } from '../../../utils/diamLookup';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine.ts';
import type { PlanoElement, PlanoBajante } from '../../../lib/PlanoEngine/PlanoState.ts';
import { SELECT_STYLE, INPUT_CENTER_STYLE, READONLY_CENTER_STYLE } from './context.ts';
import { useCaudalLl } from './useFlowLl';
import { BajanteGhostEditor } from './bajanteGhostEditor.tsx';
import { RamalesAsociadosGrid } from './AssociatedRamalesGrid.tsx';
import { DireccionFlowButtons } from './DirectionFlowButtons.tsx';

/** Editor del bajante/montante seleccionado: diámetro, altura vertical, llenado (R) y área
 *  servida. */
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
  // Caudal calculado (mismo qMap que Diseño de red lluvias) para bajantes ll.
  const caudalLl = useCaudalLl(selElement, activeNet, engineRef.current?._loadedPlanId);
  // Material de cubierta (misma fuente que Chequeo bajantes ll).
  const matLl = useMaterialesLl();
  const { plans: planesLl } = usePlans();
  const nivelLl = planesLl?.find(
    (p) => String(p.id) === String(engineRef.current?._loadedPlanId ?? ''),
  )?.nivel;
  const chipLl =
    selElement.net === 'll' && nivelLl != null
      ? matLl?.chipDeBajante(selElement.code || selElement.id, nivelLl)
      : null;
  // H (m) solo en montantes AF/AC/gas (orig. usuario) — el resto de redes no lo usa.
  const mostrarH = activeNet === 'af' || activeNet === 'ac' || activeNet === 'gas';
  const mostrarArea = (engineRef.current?.areas || []).some((a) => a.net === selElement.net);
  if (isGhostSel) {
    return (
      <BajanteGhostEditor
        selElement={selElement}
        engineRef={engineRef}
        setSelElement={setSelElement}
        lvl={lvl}
        caudalLl={caudalLl}
      />
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
        {/* Fila 1: H | Diámetro en montantes; Diámetro | Llenado en el resto (sin H). */}
        <div style={{ display: 'flex', gap: 6 }}>
          {mostrarH && (
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
          )}
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
                  const opt = entradaPor(DIAM_VENT, 'nom', val);
                  if (opt && opt.pulg > 2) {
                    engineRef.current?.triggerAlert(
                      'Diámetro no permitido',
                      'Los ramales de ventilación no pueden superar 2" de diámetro.',
                    );
                    return;
                  }
                }
                // Regla montante≥ramal (orig. usuario, espejo de la san/ll): el montante
                // nunca queda con menor diámetro que sus ramales conectados — alerta modal
                // y no se permite (se revierte al valor previo).
                if (
                  val &&
                  selElement.tipo === 'montante' &&
                  (selElement.net === 'af' || selElement.net === 'ac') &&
                  engineRef.current
                ) {
                  const monIn = diamPulgFromLabel(val.replace(/-/g, ' '));
                  if (monIn > 0) {
                    const idsRamales = [
                      ...(selElement.recibeDeIds ?? []),
                      ...(selElement.alimentaIds ?? []),
                    ];
                    for (const rid of idsRamales) {
                      const ram = engineRef.current.ramales.find((r) => r.id === rid);
                      if (!ram || !ram.diametro) continue;
                      const ramIn = diamPulgFromLabel(ram.diametro.replace(/-/g, ' '));
                      if (ramIn > 0 && ramIn > monIn) {
                        engineRef.current.triggerAlert(
                          'Diámetro no permitido',
                          `Diámetro del montante no puede ser menor al del ramal conectado (${ram.diametro})`,
                        );
                        e.target.value =
                          selElement.dNominal !== undefined &&
                          selElement.dNominal !== '0' &&
                          selElement.dNominal !== ''
                            ? selElement.dNominal
                            : '';
                        return;
                      }
                    }
                  }
                }
                handleUpdateSel('dNominal', val);
              }}
              style={SELECT_STYLE}
            >
              <option value="">—</option>
              {(() => {
                // El valor legacy (formato viejo) se conserva visible para no perder el
                // dato ya guardado.
                const lista = opcionesDiametroElemento(selElement);
                const cur =
                  selElement.dNominal !== undefined &&
                  selElement.dNominal !== '0' &&
                  selElement.dNominal !== ''
                    ? selElement.dNominal
                    : '';
                const sinCur =
                  cur !== '' && !lista.some((d) => d.nom === cur) ? (
                    <option key="cur" value={cur}>
                      {normalizeDnLabel(cur)}
                    </option>
                  ) : null;
                return (
                  <>
                    {sinCur}
                    {lista.map((d) => (
                      <option key={`${d.pulg}-${d.nom}`} value={d.nom}>
                        {normalizeDnLabel(d.nom)}
                      </option>
                    ))}
                  </>
                );
              })()}
            </select>
          </div>
          {!mostrarH && (
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
          )}
        </div>
        {/* Material de cubierta (ll): arriba de Área/Caudal, misma fuente que la tabla. */}
        {selElement.net === 'll' && chipLl && (
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
              Material de cubierta
            </div>
            <select
              value={matLl?.materialDeBajante(chipLl) ?? ''}
              aria-label="Material de cubierta del bajante"
              onChange={(e) => matLl?.setMaterialBajante(chipLl, e.target.value)}
              style={SELECT_STYLE}
            >
              <option value="">—</option>
              <OpcionesMaterial opts={MATERIALES_CUBIERTA_LL} />
            </select>
          </div>
        )}
        {/* Fila 2: Llenado | Área en montantes; Área sola en san/vent (ll va abajo con Caudal). */}
        {mostrarArea && selElement.net !== 'll' && (
          <div style={{ display: 'flex', gap: 8 }}>
            {mostrarH && (
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
            )}
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
        )}
        {selElement.net === 'll' && !mostrarH && (
          <div style={{ display: 'flex', gap: 8 }}>
            {mostrarArea && (
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
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
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
                Caudal (LPS)
              </div>
              <div
                style={{
                  ...READONLY_CENTER_STYLE,
                  display: 'flex',
                  alignItems: 'center',
                  whiteSpace: 'nowrap',
                }}
              >
                {caudalLl != null ? caudalLl.toFixed(2) : '—'}
              </div>
            </div>
          </div>
        )}
        {selElement.net === 'll' && mostrarH && (
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
              Caudal (LPS)
            </div>
            <div
              style={{
                ...READONLY_CENTER_STYLE,
                display: 'flex',
                alignItems: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              {caudalLl != null ? caudalLl.toFixed(2) : '—'}
            </div>
          </div>
        )}
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
          <DireccionFlowButtons
            current={selElement.direccion || ''}
            onPick={(val) => {
              const eng = engineRef.current;
              if (!eng) return;
              // PUNTO 8: original de asociación (origenId) → solo baja/continua.
              if (val === 'sube' && selElement.origenId) {
                eng.triggerAlert(
                  'Dirección no permitida',
                  'Este bajante es el original de una asociación entre pisos: solo admite "Baja" o "Continua".',
                );
                return;
              }
              const newDir = selElement.direccion === val ? undefined : val;
              // PUNTO 9: 'baja' sin piso debajo → coerces a 'continua' con alerta.
              let dirFinal = newDir;
              if (newDir === 'baja' && !direccionBajaPermitida(eng, selElement)) {
                dirFinal = 'continua';
                eng.triggerAlert(
                  'Dirección no permitida',
                  'Este es el último nivel del proyecto: no hay un piso inferior hacia el cual continuar el flujo. Se aplicó "Continua".',
                );
              }
              eng.updateSelected({
                direccion: dirFinal,
                desplazamientos: { ...(selElement.desplazamientos || {}) },
              });
              setSelElement({ ...selElement, direccion: dirFinal });
              eng.render();
            }}
          />
        </div>
        {['san', 'll', 'af', 'ac', 'gas'].includes(selElement.net || '') && (
          <RamalesAsociadosGrid
            selElement={selElement}
            engineRef={engineRef}
            setSelElement={setSelElement}
          />
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
