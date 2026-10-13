import { ramalLabel } from '../../../utils/accessoryAbbreviations';
import { puedeConectarRamalABajante } from '../../../lib/PlanoEngine/bajanteRules';
import { diamPulgFromLabel } from '../../../utils/diamPulgFromLabel';
import {
  MENU_GRID_2COL_STYLE,
  MENU_CHECK_LABEL_STYLE,
  MENU_SECTION_LABEL_ROW_STYLE,
  type ContextMenuState,
} from './context';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine';
import type { PlanoBajante, PlanoElement, PlanoRamal } from '../../../lib/PlanoEngine/PlanoState';
import type { PlanItem } from '../../../context/PlansContext';

export function RamalesAsociadosGrid({
  element,
  isGhostClick = false,
  ramalEndpoint,
  engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
  activeNet,
  planosCtx,
}: {
  element: PlanoBajante | PlanoRamal;
  isGhostClick?: boolean;
  ramalEndpoint?: { idx: number; x: number; y: number } | null;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: PlanoElement | null;
  setSelElement: (el: PlanoElement | null) => void;
  setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | null>>;
  activeNet: string;
  planosCtx?: { plans: PlanItem[] };
}) {
  const hasPts = !!(element as Partial<PlanoRamal>).pts;
  const bajEl = element as PlanoBajante;
  void ramalEndpoint;
  void planosCtx;
  if (hasPts || isGhostClick || !['san', 'll'].includes(activeNet)) return null;
  return (
    <>
      <>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: '4px 8px',
            borderTop: '1px solid #3a494a',
            marginTop: 4,
          }}
        >
          <div style={MENU_SECTION_LABEL_ROW_STYLE}>Ramales asociados</div>
          <div style={MENU_GRID_2COL_STYLE}>
            {(() => {
              const bajRamales = (engineRef.current?.ramales || []).filter(
                (r) => r.net === activeNet && r.tipo !== 'tributario',
              );
              if (bajRamales.length === 0)
                return (
                  <div
                    style={{
                      fontSize: 12,
                      color: '#6b8cae',
                      fontFamily: "'Geist',monospace",
                      gridColumn: 'span 2',
                    }}
                  >
                    Sin ramales
                  </div>
                );
              const recibidos = bajEl.recibeDeIds || [];
              const alimentados = bajEl.alimentaIds || [];
              const bajCode = bajEl.code || bajEl.id;
              return bajRamales.map((r) => {
                // Ítem: marcar como asociado TODO ramal conectado, entre o salga
                // (recibeDeIds, alimentaIds o ini/fin al código), además de los que tocan
                // geométricamente — para que aparezcan checkeados todos aunque alguna
                // referencia esté incompleta o stale.
                const touchesBaj =
                  !!r.pts && r.pts.some((p) => Math.hypot(p[0] - bajEl.x, p[1] - bajEl.y) < 0.5);
                const isAssociated =
                  recibidos.includes(r.id) ||
                  alimentados.includes(r.id) ||
                  r.ini === bajCode ||
                  r.fin === bajCode ||
                  touchesBaj;
                const rStart = r.pts?.[0];
                const rEnd = r.pts?.[r.pts.length - 1];
                const distStart = rStart
                  ? Math.hypot(rStart[0] - bajEl.x, rStart[1] - bajEl.y)
                  : Infinity;
                const distEnd = rEnd ? Math.hypot(rEnd[0] - bajEl.x, rEnd[1] - bajEl.y) : Infinity;
                const isAtStart = distStart <= distEnd;
                return (
                  <label key={r.id} style={MENU_CHECK_LABEL_STYLE}>
                    <input
                      type="checkbox"
                      checked={isAssociated}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        // Se lee recibeDeIds en vivo del objeto bajante del engine en lugar
                        // de la copia `recibidos` capturada en el closure — si se alternan dos
                        // checkboxes antes de que React re-renderice entre ellos, cada uno
                        // calcularía newRecibe desde el mismo array obsoleto y pisaría el
                        // cambio del otro.
                        const liveBaj = engineRef.current?.bajantes.find(
                          (bb) => bb.id === bajEl.id,
                        );
                        const liveRecibe: string[] = liveBaj?.recibeDeIds || recibidos;
                        // Regla central (ítem 1.2): el tope de asociaciones se valida ANTES de
                        // escribir cualquier campo — recibeDeIds, ini/fin o estado del panel.
                        if (checked && liveBaj) {
                          const check = puedeConectarRamalABajante(liveBaj, r);
                          if (!check.ok) {
                            if (check.title && check.msg)
                              engineRef.current?.triggerAlert(check.title, check.msg);
                            e.preventDefault();
                            return;
                          }
                        }
                        if (checked && liveRecibe.length === 1) {
                          const existing = engineRef.current?.ramales.find(
                            (x) => x.id === liveRecibe[0],
                          );
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
                        const newRecibe = checked
                          ? [...liveRecibe, r.id]
                          : liveRecibe.filter((id: string) => id !== r.id);
                        const liveAlimenta: string[] =
                          (liveBaj?.alimentaIds as string[] | undefined) || alimentados;
                        // Desmarcar una salida también la saca de alimentaIds (si no, el
                        // checkbox seguiría marcado por la referencia explícita).
                        const newAlimenta = checked
                          ? liveAlimenta
                          : liveAlimenta.filter((id: string) => id !== r.id);
                        engineRef.current?.updateElementById(bajEl.id, {
                          recibeDeIds: newRecibe,
                          alimentaIds: newAlimenta,
                        });
                        setContextMenuState((prev) =>
                          prev
                            ? {
                                ...prev,
                                element: {
                                  ...prev.element,
                                  recibeDeIds: newRecibe,
                                  alimentaIds: newAlimenta,
                                },
                              }
                            : null,
                        );
                        if (selElement?.id === bajEl.id) {
                          setSelElement({
                            ...selElement,
                            recibeDeIds: newRecibe,
                            alimentaIds: newAlimenta,
                          });
                        }
                        const bajCode = bajEl.code || bajEl.id;
                        const currentIni = r.ini || '';
                        const currentFin = r.fin || '';
                        // Desmarcar limpia ini/fin por VALOR (si apuntan a este bajante),
                        // no por proximidad — el trazo pudo moverse y el extremo cercano ya
                        // no ser el asociado (igual que "Cajas asociadas").
                        const ramalUpdates: Record<string, unknown> = {};
                        if (!checked) {
                          if (currentIni === bajCode) ramalUpdates.ini = '';
                          if (currentFin === bajCode) ramalUpdates.fin = '';
                        } else if (isAtStart) {
                          ramalUpdates.ini = bajCode;
                        } else {
                          ramalUpdates.fin = bajCode;
                        }
                        if (Object.keys(ramalUpdates).length)
                          engineRef.current?.updateElementById(r.id, ramalUpdates);
                        engineRef.current?.render();
                        engineRef.current?._markDirty();
                      }}
                      style={{ accentColor: '#F5A623', margin: 0, flexShrink: 0 }}
                    />
                    <span style={{ flex: 1, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                      {ramalLabel(r, engineRef.current?.nivelActual?.label)}
                    </span>
                  </label>
                );
              });
            })()}
          </div>
        </div>
      </>
    </>
  );
}
