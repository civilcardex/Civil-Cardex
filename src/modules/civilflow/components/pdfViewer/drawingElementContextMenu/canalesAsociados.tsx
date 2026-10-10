import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine';
import { camposAsocManual } from '../../../lib/PlanoEngine/PlanoEngineSelectionEdit';
import { useMaterialesLl } from '../../../context/RainwaterContext';
import {
  MATERIALES_CANAL_LL,
  MATERIALES_CUBIERTA_LL,
} from '../../../constants/engineeringDataMaterials';
import {
  MENU_CHECK_LABEL_STYLE,
  MENU_CHECK_ROW_STYLE,
  MENU_GRID_2COL_STYLE,
  MENU_SELECT_STYLE,
  MENU_SECTION_LABEL_ROW_STYLE,
  type ContextMenuState,
} from './context';

/** Secciones de asociación del menú contextual y del panel derecho — estilos COMPARTIDOS
 *  (orig. usuario: bajantes/cajas/canales/montantes/ramales deben verse idénticos) y lógica
 *  de toggle bidireccional. El menú NO se cierra al marcar: se refresca in place. */

interface CtxMin {
  engineRef: MutableRefObject<PlanoEngine | null>;
  activeNet: string;
  setContextMenuState: Dispatch<SetStateAction<ContextMenuState | null>>;
}

/** Etiqueta de sección igual a las demás del menú contextual (uppercase, gris). */
export const ASSOC_LABEL_STYLE = MENU_SECTION_LABEL_ROW_STYLE;

/** Fila de asociación — la MISMA en todas las secciones (criterio "Bajantes asociados" san). */
export const ASSOC_ROW_STYLE: React.CSSProperties = {
  ...MENU_CHECK_ROW_STYLE,
  padding: '4px 6px',
  background: '#1e2024',
  border: 'none',
  borderRadius: 3,
};

/** Contenedor de sección — el MISMO de "Ramales asociados"/"Bajantes asociados" (borderTop). */
export const ASSOC_SECTION_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '4px 8px',
  borderTop: '1px solid #3a494a',
  marginTop: 4,
};

/** Grid 2 col con borde — el contenedor de filas de las secciones del menú. */
export const ASSOC_GRID_STYLE = MENU_GRID_2COL_STYLE;

/** Celda de fila dentro del grid (sin caja propia — la caja es el grid). */
export const ASSOC_CELL_STYLE = MENU_CHECK_LABEL_STYLE;

/** Texto de sección vacía (idéntico al de "Ramales asociados"). */
export const ASSOC_EMPTY_STYLE: React.CSSProperties = {
  fontSize: 12,
  color: '#6b8cae',
  fontFamily: "'Geist',monospace",
  gridColumn: 'span 2',
};

/** Checkbox de asociación (ámbar como el resto del menú). */
export const ASSOC_CHECKBOX_STYLE: React.CSSProperties = {
  accentColor: '#F5A623',
  margin: 0,
  flexShrink: 0,
};

/** Span del label de la celda (igual que en bajanteConnectionPanel). */
const CELL_SPAN_STYLE: React.CSSProperties = {
  flex: 1,
  whiteSpace: 'normal',
  wordBreak: 'break-word',
};

/** Refresca el menú sin cerrarlo: clona el estado para re-render y lectura fresca del motor. */
export const refrescarMenu = (set: Dispatch<SetStateAction<ContextMenuState | null>>): void =>
  set((prev) => (prev ? { ...prev } : null));

/** Sección "Canales asociados" — bajante ll (single-select, escribe canalId). Re-lee el canal
 *  actual del MOTOR en cada render para que el checkbox refleje cambios hechos desde el
 *  canal u otro lado (bidireccional). */
export function CanalesAsociadosBajSection({
  ctx,
  bajEl,
}: {
  ctx: CtxMin;
  bajEl: { id: string; canalId?: string | null };
}) {
  const eng = ctx.engineRef.current;
  const canales = eng?.bajantes.filter((b) => b.tipo === 'canal' && b.net === 'll') || [];
  const vivo = eng?.bajantes.find((x) => x.id === bajEl.id);
  const actual = vivo?.canalId || '';
  return (
    <div style={ASSOC_SECTION_STYLE}>
      <div style={ASSOC_LABEL_STYLE}>Canales asociados</div>
      <div style={ASSOC_GRID_STYLE}>
        {canales.length === 0 && <div style={ASSOC_EMPTY_STYLE}>Sin canales dibujados.</div>}
        {canales.map((c) => (
          <label key={c.id} style={ASSOC_CELL_STYLE}>
            <input
              type="checkbox"
              style={ASSOC_CHECKBOX_STYLE}
              checked={actual === c.id}
              onChange={() => {
                const e2 = ctx.engineRef.current;
                if (!e2) return;
                e2.updateElementById(bajEl.id, {
                  canalId: actual === c.id ? null : c.id,
                });
                e2.render();
                e2._markDirty();
                refrescarMenu(ctx.setContextMenuState);
              }}
            />
            <span style={CELL_SPAN_STYLE}>{c.code || c.id}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/** Sección "Canales asociados" — ramal ll (toggle, escribe esCanalId). Mismo re-lee del motor. */
export function CanalesAsociadosRamalSection({
  ctx,
  ramal,
}: {
  ctx: CtxMin;
  ramal: { id: string; esCanalId?: string | null };
}) {
  const eng = ctx.engineRef.current;
  const canales = eng?.bajantes.filter((b) => b.tipo === 'canal' && b.net === 'll') || [];
  const vivo = eng?.ramales.find((x) => x.id === ramal.id);
  const actual = vivo?.esCanalId || '';
  return (
    <div style={ASSOC_SECTION_STYLE}>
      <div style={ASSOC_LABEL_STYLE}>Canales asociados</div>
      <div style={ASSOC_GRID_STYLE}>
        {canales.length === 0 && <div style={ASSOC_EMPTY_STYLE}>Sin canales dibujados.</div>}
        {canales.map((c) => (
          <label key={c.id} style={ASSOC_CELL_STYLE}>
            <input
              type="checkbox"
              style={ASSOC_CHECKBOX_STYLE}
              checked={actual === c.id}
              onChange={() => {
                const e2 = ctx.engineRef.current;
                if (!e2) return;
                e2.updateElementById(ramal.id, {
                  esCanalId: actual === c.id ? null : c.id,
                });
                e2.render();
                e2._markDirty();
                refrescarMenu(ctx.setContextMenuState);
              }}
            />
            <span style={CELL_SPAN_STYLE}>{c.code || c.id}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/** Desplegable "Material de cubierta" del bajante ll — MISMA fuente que Chequeo
 *  bajantes (si alimenta un canal, este lo deriva y quedan iguales). Null-safe: sin
 *  provider o sin nivel del plano no se muestra. */
export function MaterialCubiertaBajSection({
  ctx,
  bajEl,
  planNivel,
}: {
  ctx: CtxMin;
  bajEl: { id: string; code?: string };
  planNivel: unknown;
}) {
  const mat = useMaterialesLl();
  if (!mat || planNivel == null) return null;
  const chip = mat.chipDeBajante(bajEl.code || bajEl.id, planNivel);
  return (
    <div style={ASSOC_SECTION_STYLE}>
      <div style={ASSOC_LABEL_STYLE}>Material de cubierta</div>
      <select
        aria-label="Material de cubierta del bajante"
        value={mat.materialDeBajante(chip)}
        onChange={(e) => {
          mat.setMaterialBajante(chip, e.target.value);
          refrescarMenu(ctx.setContextMenuState);
        }}
        style={MENU_SELECT_STYLE}
      >
        <option value="">—</option>
        {MATERIALES_CUBIERTA_LL.map((m) => (
          <option key={m.nombre} value={m.nombre} title={m.nombre}>
            {m.abrev}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Desplegables de materiales del canal ll — MISMA fuente que Chequeo canales: la
 *  cubierta con asociados hace fan-out a los bajantes; el de canal va al override. */
export function MaterialesCanalSection({ ctx, canalId }: { ctx: CtxMin; canalId: string }) {
  const mat = useMaterialesLl();
  if (!mat) return null;
  const row = mat.canalDe(canalId);
  if (!row) return null;
  const sel = (
    label: string,
    field: 'materialCubierta' | 'materialCanal',
    opts: { nombre: string; abrev: string }[],
    val: string,
  ) => (
    <div key={field} style={{ paddingTop: 4 }}>
      <div style={ASSOC_LABEL_STYLE}>{label}</div>
      <select
        aria-label={label}
        value={val}
        onChange={(e) => {
          mat.setMaterialCanal(canalId, field, e.target.value);
          refrescarMenu(ctx.setContextMenuState);
        }}
        style={MENU_SELECT_STYLE}
      >
        <option value="">—</option>
        {opts.map((m) => (
          <option key={m.nombre} value={m.nombre} title={m.nombre}>
            {m.abrev}
          </option>
        ))}
      </select>
    </div>
  );
  return (
    <div style={ASSOC_SECTION_STYLE}>
      {sel(
        'Material de cubierta',
        'materialCubierta',
        MATERIALES_CUBIERTA_LL,
        row.materialCubierta ?? '',
      )}
      {sel('Material del canal', 'materialCanal', MATERIALES_CANAL_LL, row.materialCanal ?? '')}
    </div>
  );
}

/** Sección "Montantes asociados" — tramo af/ac (orig. usuario): mismo funcionamiento que
 *  "Bajantes asociados" de sanitaria pero con montantes. El checkbox refleja ambas direcciones
 *  (recibeDeIds/alimentaIds del montante) y el desmarque limpia la que esté. */
export function MontantesAsociadosSection({
  ctx,
  ramal,
}: {
  ctx: CtxMin;
  ramal: { id: string; net?: string };
}) {
  const eng = ctx.engineRef.current;
  const montantes = eng?.bajantes.filter((b) => b.net === ramal.net && b.tipo === 'montante') || [];
  if (montantes.length === 0) return null;
  return (
    <div style={ASSOC_SECTION_STYLE}>
      <div style={ASSOC_LABEL_STYLE}>Montantes asociados</div>
      <div style={ASSOC_GRID_STYLE}>
        {montantes.map((m) => {
          const activo =
            (m.recibeDeIds || []).includes(ramal.id) || (m.alimentaIds || []).includes(ramal.id);
          return (
            <label key={m.id} style={ASSOC_CELL_STYLE}>
              <input
                type="checkbox"
                style={ASSOC_CHECKBOX_STYLE}
                checked={activo}
                onChange={() => {
                  const e2 = ctx.engineRef.current;
                  if (!e2) return;
                  const vivo = e2.bajantes.find((x) => x.id === m.id);
                  if (!vivo) return;
                  e2.updateElementById(m.id, camposAsocManual(vivo, ramal.id, !activo));
                  e2.render();
                  e2._markDirty();
                  refrescarMenu(ctx.setContextMenuState);
                }}
              />
              <span style={CELL_SPAN_STYLE}>{m.code || m.id}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** Sección "Ramales asociados" — MONTANTE af/ac (orig. usuario): la inversa de la anterior,
 *  para gestionar la asociación desde el montante. Mismo bidireccionalismo y estilo. */
export function RamalesAsociadosMontSection({
  ctx,
  montante,
}: {
  ctx: CtxMin;
  montante: { id: string; net?: string };
}) {
  const eng = ctx.engineRef.current;
  const vivo = eng?.bajantes.find((x) => x.id === montante.id);
  if (!vivo) return null;
  const ramales =
    eng?.ramales.filter((r) => r.net === montante.net && r.tipo !== 'tributario') || [];
  if (ramales.length === 0) return null;
  return (
    <div style={ASSOC_SECTION_STYLE}>
      <div style={ASSOC_LABEL_STYLE}>Ramales asociados</div>
      <div style={ASSOC_GRID_STYLE}>
        {ramales.map((r) => {
          const activo =
            (vivo.recibeDeIds || []).includes(r.id) || (vivo.alimentaIds || []).includes(r.id);
          return (
            <label key={r.id} style={ASSOC_CELL_STYLE}>
              <input
                type="checkbox"
                style={ASSOC_CHECKBOX_STYLE}
                checked={activo}
                onChange={() => {
                  const e2 = ctx.engineRef.current;
                  const vivo2 = e2?.bajantes.find((x) => x.id === montante.id);
                  if (!e2 || !vivo2) return;
                  e2.updateElementById(montante.id, camposAsocManual(vivo2, r.id, !activo));
                  e2.render();
                  e2._markDirty();
                  refrescarMenu(ctx.setContextMenuState);
                }}
              />
              <span style={CELL_SPAN_STYLE}>{r.label || r.id}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
