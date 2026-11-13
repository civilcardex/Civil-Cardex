/**
 * Secciones de ASOCIACIÓN del menú de un ramal: ramal de canal (con su bajante asociado),
 * "Bajantes asociados" y "Cajas asociadas" — escribe el mismo estado que el panel de
 * aparatos (camposAsocManual). Extraídas verbatim de ramalMenu; los estilos son los
 * compartidos de las secciones de asociación (dcm-section/dcm-grid-2col-tall/…).
 */
import type { PlanoRamal } from '../../../lib/PlanoEngine/PlanoState.ts';
import { puedeConectarRamalABajante, esCaja } from '../../../lib/PlanoEngine/bajanteRules.ts';
import { moverAsociacionCanal } from '../../../lib/PlanoEngine/channelAssociation';
import { camposAsocManual } from '../../../lib/PlanoEngine/PlanoEngineSelectionEdit.ts';
import { bajanteLabel } from '../../../utils/accessoryAbbreviations.ts';
import type { DrawingElementContextMenuContextValue } from './context.ts';
import { refrescarMenu } from './associatedChannels';

/** Lo que estas secciones tocan del menú contextual: motor, selección activa,
 *  cierre/refresco del menú y la red activa (san/ll gatea las asociaciones). */
type RamalAsocCtx = Pick<
  DrawingElementContextMenuContextValue,
  'engineRef' | 'setContextMenuState' | 'selElement' | 'setSelElement' | 'activeNet'
>;

/** Sección "Ramal de canal": un ramal que ES segmento de canal (esCanalId) muestra el canal
 *  dueño y un desplegable para elegir a qué bajante ll (Lluvias) descarga — moverAsociacionCanal
 *  mueve la asociación sin romper la anterior. Ej: elegir "BAN3" añade el ramal a recibeDeIds. */
export function RamalChannelSection({ ctx, ramal }: { ctx: RamalAsocCtx; ramal: PlanoRamal }) {
  if (!ramal.esCanalId) return null;
  return (
    <div className="dcm-sep">
      <div className="dcm-section-label-row">Ramal de canal</div>
      <div className="dcm-mono">
        Canal:{' '}
        {ctx.engineRef.current?.bajantes.find((c) => c.id === ramal.esCanalId)?.code ||
          ramal.esCanalId}
      </div>
      <select
        value={
          (ctx.engineRef.current?.bajantes || []).find((b) => b.recibeDeIds?.includes(ramal.id))
            ?.id || ''
        }
        aria-label="Bajante asociado"
        onChange={(e) => {
          const eng = ctx.engineRef.current;
          if (!eng) return;
          moverAsociacionCanal(eng, ramal.id, e.target.value || null);
          ctx.setContextMenuState((prev) => (prev ? { ...prev } : null));
          ctx.engineRef.current?.render();
        }}
        className="dcm-select"
      >
        <option value="">— Sin bajante —</option>
        {(ctx.engineRef.current?.bajantes || [])
          .filter((b) => b.net === 'll' && b.tipo === 'bajante')
          .map((b) => (
            <option key={b.id} value={b.id}>
              {b.code || b.id}
            </option>
          ))}
      </select>
    </div>
  );
}

/** Sección "Bajantes asociados" (san (sanitaria)/ll (Lluvias)): casillas por bajante de la
 *  misma red — el checkbox refleja AMBAS direcciones (llega recibeDeIds o sale por
 *  alimentaIds) y el desmarque limpia la que esté; al marcar manda el tope de asociaciones
 *  (puedeConectarRamalABajante). Ej: marcar BAN2 con un ramal de lavamanos. */
export function BajantesAsociadosSection({ ctx, ramal }: { ctx: RamalAsocCtx; ramal: PlanoRamal }) {
  if (!['san', 'll'].includes(ctx.activeNet)) return null;
  return (
    <div className="dcm-section">
      <div className="dcm-section-label-row">Bajantes asociados</div>
      <div className="dcm-grid-2col-tall">
        {(() => {
          const currentId = ramal.id;
          const netBajantes = (ctx.engineRef.current?.bajantes || []).filter(
            (b) =>
              b.net === ramal.net &&
              b.id !== ramal.id &&
              b.tipo !== 'tributario' &&
              // Los canales no se asocian a ramales (orig. usuario): la conexión vive en
              // los ramales de canal — y las cajas tienen su sección "Cajas asociadas".
              b.tipo !== 'canal' &&
              !esCaja(b),
          );
          if (netBajantes.length === 0) return <div className="dcm-span4">Sin bajantes</div>;
          return netBajantes.map((b) => {
            // Igual que "Cajas asociadas": el checkbox refleja AMBAS direcciones —
            // llegada (recibeDeIds) O salida (alimentaIds) — y el desmarque limpia la
            // que esté. Antes solo miraba recibeDeIds y la salida nunca se marcaba.
            const isRecibe = (b.recibeDeIds || []).includes(currentId);
            const isAlimenta = (b.alimentaIds || []).includes(currentId);
            const isAssociated = isRecibe || isAlimenta;
            return (
              <label key={b.id} className="dcm-check-row dcm-check-row-assoc">
                <input
                  type="checkbox"
                  checked={isAssociated}
                  onChange={(e) => {
                    // Regla central (ítem 1.2): tope de asociaciones validado ANTES de escribir.
                    if (e.target.checked) {
                      const check = puedeConectarRamalABajante(b, ramal);
                      if (!check.ok) {
                        if (check.title && check.msg)
                          ctx.engineRef.current?.triggerAlert(check.title, check.msg);
                        e.preventDefault();
                        return;
                      }
                    }
                    const extraFields: Record<string, unknown> = camposAsocManual(
                      b,
                      currentId,
                      e.target.checked,
                    );
                    if (e.target.checked) {
                      extraFields.descargaEnId = currentId;
                    } else if (
                      b.descargaEnId === currentId ||
                      b.descargaEnId?.endsWith('|' + currentId)
                    ) {
                      extraFields.descargaEnId = null;
                    }
                    ctx.engineRef.current?.updateElementById(b.id, extraFields);
                    if (!e.target.checked) {
                      // Desmarcar una salida también limpia el ini/fin del ramal si apunta
                      // al código del bajante (igual que "Cajas asociadas").
                      const code = b.code || b.id;
                      const ramalUpdates: Record<string, unknown> = {};
                      if (ramal.fin === code) ramalUpdates.fin = '';
                      if ((ramal as unknown as { ini?: string }).ini === code)
                        ramalUpdates.ini = '';
                      if (Object.keys(ramalUpdates).length)
                        ctx.engineRef.current?.updateElementById(ramal.id, ramalUpdates);
                      if (ctx.selElement?.id === ramal.id) {
                        ctx.setSelElement({ ...ctx.selElement, ...ramalUpdates });
                      }
                    } else if (ctx.selElement?.id === b.id) {
                      ctx.setSelElement({ ...ctx.selElement, ...extraFields });
                    }
                    refrescarMenu(ctx.setContextMenuState);
                  }}
                  className="dcm-assoc-checkbox"
                />
                <span className="dcm-cell-span">
                  {bajanteLabel(b, ctx.engineRef.current?.nivelActual?.label)}
                </span>
              </label>
            );
          });
        })()}
      </div>
    </div>
  );
}

/** Sección "Cajas asociadas" (san/ll): casillas por caja de la red — marcar asocia el ramal
 *  como LLEGADA (recibeDeIds + fin del ramal = código de la caja) y desmarcar quita la
 *  relación que tenga (llegada y/o salida). Ej: desmarcar "CAJ1" borra fin='CAJ1' del ramal. */
export function CajasAsociadasSection({ ctx, ramal }: { ctx: RamalAsocCtx; ramal: PlanoRamal }) {
  if (!['san', 'll'].includes(ctx.activeNet)) return null;
  return (
    <div className="dcm-section">
      <div className="dcm-section-label-row">Cajas asociadas</div>
      <div className="dcm-grid-2col-tall">
        {(() => {
          const currentId = ramal.id;
          const cajas = (ctx.engineRef.current?.bajantes || []).filter(
            (b) => b.net === ramal.net && esCaja(b),
          );
          if (cajas.length === 0) return <div className="dcm-span4">Sin cajas</div>;
          return cajas.map((c) => {
            // Asociación lógica = la que crea finishRamal: llegada (recibeDeIds + fin del
            // ramal = código de la caja) O salida (alimentaIds + ini del ramal) — el
            // checkbox refleja AMBAS y el desmarque limpia la que esté.
            const isRecibe = (c.recibeDeIds || []).includes(currentId);
            const isAlimenta = (c.alimentaIds || []).includes(currentId);
            const isAssociated = isRecibe || isAlimenta;
            return (
              <label key={c.id} className="dcm-check-row dcm-check-row-assoc">
                <input
                  type="checkbox"
                  checked={isAssociated}
                  onChange={(e) => {
                    // Regla central: la caja admite N entradas de ramales/tributarios —
                    // la guard valida red y dirección antes de escribir.
                    if (e.target.checked) {
                      const check = puedeConectarRamalABajante(c, ramal, 'recibe');
                      if (!check.ok) {
                        if (check.title && check.msg)
                          ctx.engineRef.current?.triggerAlert(check.title, check.msg);
                        e.preventDefault();
                        return;
                      }
                    }
                    const code = c.code || c.id;
                    if (e.target.checked) {
                      // Marcar = asociar como LLEGADA (nueva asociación, manual: la poda
                      // de stale no la toca).
                      const updates: Record<string, unknown> = {
                        ...camposAsocManual(c, currentId, true),
                      };
                      ctx.engineRef.current?.updateElementById(c.id, updates);
                      ctx.engineRef.current?.updateElementById(ramal.id, { fin: code });
                      if (ctx.selElement?.id === ramal.id) {
                        ctx.setSelElement({
                          ...ctx.selElement,
                          fin: code,
                        } as unknown as PlanoRamal);
                      }
                    } else {
                      // Desmarcar = quitar la relación que tenga: llegada y/o salida.
                      const updates: Record<string, unknown> = camposAsocManual(
                        c,
                        currentId,
                        false,
                      );
                      ctx.engineRef.current?.updateElementById(c.id, updates);
                      const ramalUpdates: Record<string, unknown> = {};
                      if (ramal.fin === code) ramalUpdates.fin = '';
                      if ((ramal as unknown as { ini?: string }).ini === code)
                        ramalUpdates.ini = '';
                      if (Object.keys(ramalUpdates).length)
                        ctx.engineRef.current?.updateElementById(ramal.id, ramalUpdates);
                      if (ctx.selElement?.id === ramal.id) {
                        ctx.setSelElement({
                          ...ctx.selElement,
                          ...ramalUpdates,
                        } as unknown as PlanoRamal);
                      }
                    }
                    ctx.engineRef.current?.render();
                    ctx.engineRef.current?._markDirty();
                    refrescarMenu(ctx.setContextMenuState);
                  }}
                  className="dcm-assoc-checkbox"
                />
                <span className="dcm-cell-span">
                  {bajanteLabel(c, ctx.engineRef.current?.nivelActual?.label)}
                </span>
              </label>
            );
          });
        })()}
      </div>
    </div>
  );
}
