// Grid "Ramales asociados" del editor de bajante: checkboxes de asociación manual por
// ramal de la red. Sección extraída de bajanteEditor (era el dueño de sus 10 focos G8 —
// el onChange tenía .find dentro de condicionales dentro del map de ramales).
import { diamPulgFromLabel } from '../../../utils/diamInchesFromLabel.ts';
import type {
  PlanoBajante,
  PlanoElement,
  PlanoRamal,
} from '../../../lib/PlanoEngine/PlanoState.ts';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine.ts';
import { puedeConectarRamalABajante } from '../../../lib/PlanoEngine/bajanteRules.ts';
import { camposAsocManual } from '../../../lib/PlanoEngine/PlanoEngineSelectionEdit.ts';
import { bajanteLocalDe } from '../../../utils/bajanteLocal.ts';
import { CHECK_GRID_STYLE, CHECK_ROW_STYLE } from './context.ts';

interface Props {
  selElement: PlanoBajante;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  setSelElement: React.Dispatch<React.SetStateAction<PlanoElement | null>>;
}

/**
 * Checkboxes de ramales asociados a mano (asocManual): la asociación no se poda por
 * geometría y el menú contextual usa la MISMA función de escritura (camposAsocManual)
 * — los dos sitios muestran el mismo estado. Bloquea: tope de asociaciones (ítem 1.2)
 * y diámetros incompatibles en la Y doble.
 */
export function RamalesAsociadosGrid({ selElement, engineRef, setSelElement }: Props) {
  const bajRamales = (engineRef.current?.ramales || []).filter(
    (r: PlanoRamal) => r.net === selElement.net && r.tipo !== 'tributario',
  );
  return (
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
          const alimentan = selElement.alimentaIds || [];
          const bajCode = selElement.code || selElement.id;
          return bajRamales.map((r) => (
            <label key={r.id} style={CHECK_ROW_STYLE}>
              <input
                type="checkbox"
                checked={
                  recibidos.includes(r.id) ||
                  alimentan.includes(r.id) ||
                  r.ini === bajCode ||
                  r.fin === bajCode
                }
                onChange={(e) => {
                  // Regla central (ítem 1.2): tope de asociaciones ANTES de escribir.
                  if (e.target.checked && !recibidos.includes(r.id)) {
                    const check = puedeConectarRamalABajante(selElement, r);
                    if (!check.ok) {
                      if (check.title && check.msg)
                        engineRef.current?.triggerAlert(check.title, check.msg);
                      e.preventDefault();
                      return;
                    }
                  }
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
                  // Estado REAL: se escribe sobre el bajante VIVO del motor (no la copia
                  // de la selección) y con `camposAsocManual` → recibeDeIds + asocManual
                  // (la asociación a mano no se poda por geometría). El menú contextual
                  // usa la MISMA función → los dos sitios muestran el mismo estado.
                  // bajanteLocalDe (no `find` plano): el motor guarda la PROYECCIÓN del
                  // piso vecino con el MISMO id — leerla fabricaba checkboxes con las
                  // listas del piso equivocado (familia 15.5-vs-4.5).
                  const vivo = engineRef.current
                    ? bajanteLocalDe(engineRef.current, selElement.id)
                    : undefined;
                  const campos = vivo
                    ? camposAsocManual(vivo as never, r.id, e.target.checked)
                    : {
                        recibeDeIds: e.target.checked
                          ? [...recibidos, r.id]
                          : recibidos.filter((id: string) => id !== r.id),
                        alimentaIds: e.target.checked
                          ? alimentan
                          : alimentan.filter((id: string) => id !== r.id),
                        asocManual: selElement.asocManual || [],
                      };
                  engineRef.current?.updateElementById(selElement.id, campos);
                  if (!e.target.checked) {
                    const ramalUpdates: Record<string, unknown> = {};
                    if (r.ini === bajCode) ramalUpdates.ini = '';
                    if (r.fin === bajCode) ramalUpdates.fin = '';
                    if (Object.keys(ramalUpdates).length)
                      engineRef.current?.updateElementById(r.id, ramalUpdates);
                  }
                  const fresh = engineRef.current
                    ? bajanteLocalDe(engineRef.current, selElement.id)
                    : undefined;
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
  );
}
