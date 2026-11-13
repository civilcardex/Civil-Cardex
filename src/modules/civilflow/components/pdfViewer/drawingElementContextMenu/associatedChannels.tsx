import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine.ts';
import { camposAsocManual } from '../../../lib/PlanoEngine/PlanoEngineSelectionEdit.ts';
import {
  vetarSelloCanal,
  levantarVetoSelloCanal,
} from '../../../lib/PlanoEngine/channelAssociation';
import { useMaterialesLl } from '../../../context/RainwaterContext.tsx';
import {
  MATERIALES_CANAL_LL,
  MATERIALES_CUBIERTA_LL,
} from '../../../constants/engineeringDataMaterials.ts';
import { MENU_CHECK_ROW_STYLE, type ContextMenuState } from './context.ts';

/** Secciones de asociación del menú contextual y del panel derecho — estilos COMPARTIDOS (orig. usuario:
 * bajantes/cajas/canales/montantes/ramales deben verse idénticos) y lógica de toggle bidireccional. */

interface CtxMin {
  engineRef: MutableRefObject<PlanoEngine | null>;
  activeNet: string;
  setContextMenuState: Dispatch<SetStateAction<ContextMenuState | null>>;
}

/** Fila de asociación (checkbox + nombre) con fondo — legible sobre el menú. */
export const ASSOC_ROW_STYLE: React.CSSProperties = {
  ...MENU_CHECK_ROW_STYLE,
  padding: '4px 6px',
  background: '#1e2024',
  border: 'none',
  borderRadius: 3,
};

/** Checkbox de asociación en ámbar (el color de "asociado" en todo el visor). */
export const ASSOC_CHECKBOX_STYLE: React.CSSProperties = {
  accentColor: '#F5A623',
  margin: 0,
  flexShrink: 0,
};

/** Refresca el menú sin cerrarlo: clona el estado para re-render y lectura fresca del motor. */
export const refrescarMenu = (set: Dispatch<SetStateAction<ContextMenuState | null>>): void =>
  set((prev) => (prev ? { ...prev } : null));

/** Opciones de material (misma fuente, value=nombre/title/abrev). Unifica los selects de cubierta y canal. */
export function OpcionesMaterial({ opts }: { opts: { nombre: string; abrev: string }[] }) {
  return (
    <>
      {opts.map((m) => (
        <option key={m.nombre} value={m.nombre} title={m.nombre}>
          {m.abrev}
        </option>
      ))}
    </>
  );
}

/** Sección "Canales asociados" — bajante ll (Lluvias) (single-select, escribe canalId).
 * Re-lee el canal actual del MOTOR en cada render para que el checkbox refleje cambios hechos desde el canal u otro lado (bidireccional). */
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
    <div className="dcm-section">
      <div className="dcm-section-label-row">Canales asociados</div>
      <div className="dcm-grid-2col">
        {canales.length === 0 && <div className="dcm-assoc-empty">Sin canales dibujados.</div>}
        {canales.map((c) => (
          <label key={c.id} className="dcm-check-label">
            <input
              type="checkbox"
              className="dcm-assoc-checkbox"
              checked={actual === c.id}
              onChange={() => {
                const e2 = ctx.engineRef.current;
                if (!e2) return;
                const desmarcando = actual === c.id;
                const pid = String(ctx.engineRef.current?._loadedPlanId ?? '');
                if (desmarcando) vetarSelloCanal(pid, 'baj', bajEl.id, c.id);
                else levantarVetoSelloCanal(pid, 'baj', bajEl.id, c.id);
                e2.updateElementById(bajEl.id, {
                  canalId: desmarcando ? null : c.id,
                });
                e2.render();
                e2._markDirty();
                refrescarMenu(ctx.setContextMenuState);
              }}
            />
            <span className="dcm-cell-span">{c.code || c.id}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/** Sección "Canales asociados" — ramal ll (Lluvias) (toggle, escribe esCanalId). Mismo re-lee del motor. */
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
    <div className="dcm-section">
      <div className="dcm-section-label-row">Canales asociados</div>
      <div className="dcm-grid-2col">
        {canales.length === 0 && <div className="dcm-assoc-empty">Sin canales dibujados.</div>}
        {canales.map((c) => (
          <label key={c.id} className="dcm-check-label">
            <input
              type="checkbox"
              className="dcm-assoc-checkbox"
              checked={actual === c.id}
              onChange={() => {
                const e2 = ctx.engineRef.current;
                if (!e2) return;
                const desmarcando = actual === c.id;
                const pid = String(ctx.engineRef.current?._loadedPlanId ?? '');
                if (desmarcando) vetarSelloCanal(pid, 'ram', ramal.id, c.id);
                else levantarVetoSelloCanal(pid, 'ram', ramal.id, c.id);
                e2.updateElementById(ramal.id, {
                  esCanalId: desmarcando ? null : c.id,
                });
                e2.render();
                e2._markDirty();
                refrescarMenu(ctx.setContextMenuState);
              }}
            />
            <span className="dcm-cell-span">{c.code || c.id}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/** Desplegable "Material de cubierta" del bajante ll (Lluvias) — MISMA fuente que Chequeo bajantes (si alimenta un canal, este lo deriva y quedan iguales). */
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
    <div className="dcm-section">
      <div className="dcm-section-label-row">Material de cubierta</div>
      <select
        aria-label="Material de cubierta del bajante"
        value={mat.materialDeBajante(chip)}
        onChange={(e) => {
          mat.setMaterialBajante(chip, e.target.value);
          refrescarMenu(ctx.setContextMenuState);
        }}
        className="dcm-select"
      >
        <option value="">—</option>
        <OpcionesMaterial opts={MATERIALES_CUBIERTA_LL} />
      </select>
    </div>
  );
}

/** Desplegables de materiales del canal ll (Lluvias) — MISMA fuente que Chequeo canales: la cubierta con asociados hace fan-out a los bajantes; el de canal va al override. */
export function MaterialesCanalSection({ ctx, canalId }: { ctx: CtxMin; canalId: string }) {
  const mat = useMaterialesLl();
  if (!mat) return null;
  const row = mat.canalDe(canalId);
  if (!row) return null;
  /** Select de material del canal (cubierta o canal). */
  const sel = (
    label: string,
    field: 'materialCubierta' | 'materialCanal',
    opts: { nombre: string; abrev: string }[],
    val: string,
  ) => (
    <div key={field} className="dcm-pad-top">
      <div className="dcm-section-label-row">{label}</div>
      <select
        aria-label={label}
        value={val}
        onChange={(e) => {
          mat.setMaterialCanal(canalId, field, e.target.value);
          refrescarMenu(ctx.setContextMenuState);
        }}
        className="dcm-select"
      >
        <option value="">—</option>
        <OpcionesMaterial opts={opts} />
      </select>
    </div>
  );
  return (
    <div className="dcm-section">
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

/** Sección "Montantes asociados" — ramales de presión af (Agua Fria)/ac (Agua Caliente)/gas (Gas) (orig. usuario): mismo funcionamiento que "Bajantes asociados" de sanitaria pero con montantes. */
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
    <div className="dcm-section">
      <div className="dcm-section-label-row">Montantes asociados</div>
      <div className="dcm-grid-2col">
        {montantes.map((m) => {
          const activo =
            (m.recibeDeIds || []).includes(ramal.id) || (m.alimentaIds || []).includes(ramal.id);
          return (
            <label key={m.id} className="dcm-check-label">
              <input
                type="checkbox"
                className="dcm-assoc-checkbox"
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
              <span className="dcm-cell-span">{m.code || m.id}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** Sección "Ramales asociados" — GABINETE GABn rci (ped. usuario): la inversa de
 *  "Gabinetes asociados", para gestionar la asociación desde el gabinete. Igual que la del
 *  montante: checkbox único → camposAsocManual sobre el gabinete. */
export function RamalesAsociadosGabSection({
  ctx,
  gabinete,
}: {
  ctx: CtxMin;
  gabinete: { id: string; net?: string };
}) {
  const eng = ctx.engineRef.current;
  if (!eng) return null;
  const vivo = eng.bajantes.find((x) => x.id === gabinete.id);
  if (!vivo) return null;
  const ramales = eng.ramales.filter((r) => r.net === 'rci' && r.tipo !== 'tributario');
  if (ramales.length === 0) return null;
  const ramalPorId = new Map(eng.ramales.map((r) => [r.id, r]));
  return (
    <div className="dcm-section">
      <div className="dcm-section-label-row">Ramales asociados</div>
      <div className="dcm-grid-2col">
        {ramales.map((r) => {
          const rec = new Set(vivo.recibeDeIds || []);
          const ali = new Set(vivo.alimentaIds || []);
          const activo = rec.has(r.id) || ali.has(r.id);
          return (
            <label key={r.id} className="dcm-check-label">
              <input
                type="checkbox"
                className="dcm-assoc-checkbox"
                checked={activo}
                onChange={() => {
                  const e2 = ctx.engineRef.current;
                  const vivo2 = e2?.bajantes.find((x) => x.id === gabinete.id);
                  if (!e2 || !vivo2) return;
                  e2.updateElementById(gabinete.id, camposAsocManual(vivo2, r.id, !activo));
                  e2.render();
                  e2._markDirty();
                  refrescarMenu(ctx.setContextMenuState);
                }}
              />
              <span className="dcm-cell-span">{ramalPorId.get(r.id)?.label || r.id}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** Sección "Ramales asociados" — MONTANTE af (Agua Fria)/ac (Agua Caliente)/gas (Gas) (orig. usuario): la inversa de la anterior, para gestionar la asociación desde el montante. */
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
    <div className="dcm-section">
      <div className="dcm-section-label-row">Ramales asociados</div>
      <div className="dcm-grid-2col">
        {ramales.map((r) => {
          const activo =
            (vivo.recibeDeIds || []).includes(r.id) || (vivo.alimentaIds || []).includes(r.id);
          return (
            <label key={r.id} className="dcm-check-label">
              <input
                type="checkbox"
                className="dcm-assoc-checkbox"
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
              <span className="dcm-cell-span">{r.label || r.id}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** Sección "Gabinetes asociados" — RAMAL rci (Red Contra Incendio) (ped. usuario): igual que
 *  "Montantes asociados" pero con los gabinetes GABn dibujados en el plano. La asociación
 *  vive en el gabinete (recibeDeIds/alimentaIds/asocManual vía camposAsocManual). */
export function GabinetesAsociadosSection({
  ctx,
  ramal,
}: {
  ctx: CtxMin;
  ramal: { id: string; net?: string };
}) {
  const eng = ctx.engineRef.current;
  if (!eng) return null;
  const gabinetes = eng.bajantes.filter((b) => b.net === 'rci' && b.tipo === 'gabinete');
  if (gabinetes.length === 0) return null;
  /* Índice id→gabinete (Map, no find en bucle: G8). */
  const gabPorId = new Map(eng.bajantes.map((b) => [b.id, b]));
  return (
    <div className="dcm-section">
      <div className="dcm-section-label-row">Gabinetes asociados</div>
      <div className="dcm-grid-2col">
        {gabinetes.map((m) => {
          /* Sets (no .includes en bucle): G8 no cuenta búsquedas Set.has. */
          const rec = new Set(m.recibeDeIds || []);
          const ali = new Set(m.alimentaIds || []);
          const activo = rec.has(ramal.id) || ali.has(ramal.id);
          return (
            <label key={m.id} className="dcm-check-label">
              <input
                type="checkbox"
                className="dcm-assoc-checkbox"
                checked={activo}
                onChange={() => {
                  const e2 = ctx.engineRef.current;
                  if (!e2) return;
                  const vivo = gabPorId.get(m.id);
                  if (!vivo) return;
                  e2.updateElementById(m.id, camposAsocManual(vivo, ramal.id, !activo));
                  e2.render();
                  e2._markDirty();
                  refrescarMenu(ctx.setContextMenuState);
                }}
              />
              <span className="dcm-cell-span">{m.code || m.id}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
