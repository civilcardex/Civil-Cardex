/**
 * Secciones de configuración del tramo en el menú de un ramal: bloqueo de
 * movimiento/longitud y qué información muestra la etiqueta del tramo. Ambas escriben
 * banderas booleanas del elemento (bloqueado, showFlowDir, showLength…). Extraídas
 * verbatim de ramalMenu.
 */
import type { PlanoRamal } from '../../../lib/PlanoEngine/PlanoState.ts';
import type { DrawingElementContextMenuContextValue } from './context.ts';

/** Lo que estas secciones tocan del menú contextual: motor (escritura + render) y
 *  selección activa (para refrescar el panel lateral si el tramo está abierto). */
type RamalTramoCtx = Pick<
  DrawingElementContextMenuContextValue,
  'engineRef' | 'selElement' | 'setSelElement'
>;

/** Fila "Bloquear Movimiento-Longitud": impide arrastrar o recortar el tramo desde el
 *  plano. Ej: marcarla sobre RAF1 fija bloqueado=true y el motor ignora sus drags. */
export function RamalLockSection({ ctx, ramal }: { ctx: RamalTramoCtx; ramal: PlanoRamal }) {
  return (
    <div className="dcm-sep-row">
      <span className="dcm-paso">Bloquear Movimiento-Longitud</span>
      <input
        type="checkbox"
        checked={!!ramal.bloqueado}
        aria-label="Bloquear movimiento"
        onChange={(e) => {
          const val = e.target.checked;
          if (ctx.engineRef.current) {
            ctx.engineRef.current?.updateElementById(ramal.id, { bloqueado: val });
            if (ctx.selElement?.id === ramal.id) {
              ctx.setSelElement({ ...ctx.selElement, bloqueado: val });
            }
            ctx.engineRef.current?.render();
          }
        }}
        className="dcm-check-amber"
      />
    </div>
  );
}

/** Sección "Modificar etiqueta": casillas de qué información dibuja el tramo (dirección de
 *  flujo, material/Ø/pendiente, longitud, nombre, guía). Ej: desmarcar "Longitud" quita los
 *  metros de la etiqueta del tramo sin borrar el dato. */
export function RamalLabelSection({ ctx, ramal }: { ctx: RamalTramoCtx; ramal: PlanoRamal }) {
  return (
    <div className="dcm-sep">
      <div className="dcm-section-label-row">Modificar etiqueta</div>
      <div className="dcm-nota-tramo">Elige qué información mostrar en la etiqueta del tramo</div>
      <div className="dcm-grid-2col">
        {[
          {
            key: 'showFlowDir' as const,
            label: 'Dirección de flujo',
            checked: (ramal as unknown as Record<string, unknown>).showFlowDir !== false,
          },
          {
            key: 'showMatDiamPend' as const,
            label: 'Material, diámetro y pendiente',
            checked: (ramal as unknown as Record<string, unknown>).showMatDiamPend !== false,
          },
          {
            key: 'showLength' as const,
            label: 'Longitud',
            checked: ramal.showLength !== false,
          },
          { key: 'showName' as const, label: 'Nombre', checked: ramal.showName !== false },
          { key: 'showGuide' as const, label: 'Guía', checked: ramal.showGuide !== false },
        ].map(({ key, label, checked }) => (
          <label key={key} className="dcm-check-row dcm-check-row-assoc">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                const val = e.target.checked;
                if (ctx.engineRef.current) {
                  ctx.engineRef.current.updateElementById(ramal.id, { [key]: val });
                  if (ctx.selElement?.id === ramal.id) {
                    ctx.setSelElement({ ...ctx.selElement, [key]: val } as unknown as PlanoRamal);
                  }
                  ctx.engineRef.current.render();
                  ctx.engineRef.current._markDirty();
                }
              }}
              className="dcm-assoc-checkbox"
            />
            <span className="dcm-cell-span">{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
