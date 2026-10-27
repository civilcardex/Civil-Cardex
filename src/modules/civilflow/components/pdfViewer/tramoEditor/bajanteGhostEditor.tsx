// Editor del bajante FANTASMA (proyección de un bajante de otro piso, id XFG_): caudal ll
// (solo lectura), diámetro y dirección — escribe en ghostData[lvl] del elemento.
import { DIAM_BAN, DIAM_BAN_LL, DIAM_BAN_SAN, DIAM_VENT } from '../../../constants';
import { normalizeDnLabel } from '../../../utils/formatUtils.ts';
import { diamPulgFromLabel } from '../../../utils/diamInchesFromLabel.ts';
import type { PlanoElement, PlanoBajante } from '../../../lib/PlanoEngine/PlanoState.ts';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine.ts';
import { SELECT_STYLE, READONLY_CENTER_STYLE } from './context.ts';
import { DireccionFlowButtons } from './DirectionFlowButtons.tsx';

interface Props {
  selElement: PlanoBajante;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  setSelElement: React.Dispatch<React.SetStateAction<PlanoElement | null>>;
  lvl: string;
  caudalLl: number | null;
}

/**
 * Editor del fantasma entre pisos (marcador XFG de la proyección del bajante del piso
 * vecino): sus datos viven POR NIVEL en `ghostData[lvl]`, no en el elemento real.
 */
export function BajanteGhostEditor({ selElement, engineRef, setSelElement, lvl, caudalLl }: Props) {
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
        {selElement.net === 'll' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
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
            Diámetro
          </div>
          <select
            value={currentGhostDiam}
            aria-label="Diámetro"
            onChange={(e) => {
              const val = e.target.value;
              // Regla ll bajante≥ramal en el GHOST también: sin esto, el fantasma aceptaba
              // un diámetro menor que sus ramales sin alerta y sin espejar al real.
              if (val && engineRef.current) {
                const bajIn = diamPulgFromLabel(val.replace(/-/g, ' '));
                if (bajIn > 0) {
                  const fuenteId = selElement.id.startsWith('XFG_') ? undefined : selElement.id;
                  const idsRamales = fuenteId
                    ? (selElement.recibeDeIds ?? [])
                    : (
                        engineRef.current.ramales as Array<{
                          id?: string;
                          net?: string;
                          diametro?: string;
                        }>
                      )
                        .filter((r) => r.net === selElement.net && r.diametro)
                        .map((r) => r.id || '');
                  for (const rid of idsRamales) {
                    const ram = engineRef.current.ramales.find((r) => r.id === rid);
                    if (!ram || !ram.diametro) continue;
                    const ramIn = diamPulgFromLabel(ram.diametro.replace(/-/g, ' '));
                    if (ramIn > 0 && ramIn > bajIn) {
                      engineRef.current.triggerAlert(
                        'Diámetro no permitido',
                        `Diámetro del fantasma no puede ser menor al del ramal conectado (${ram.diametro})`,
                      );
                      e.target.value = currentGhostDiam;
                      return;
                    }
                  }
                }
              }
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
                : selElement.net === 'll'
                  ? DIAM_BAN_LL
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
          <DireccionFlowButtons
            current={currentGhostDir}
            onPick={(val) => {
              updateGhostField((cd) => {
                const newDir = cd.direccion === val ? undefined : val;
                if (newDir) {
                  cd.direccion = newDir;
                } else {
                  delete cd.direccion;
                }
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}
