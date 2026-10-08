import type { PlanoBajante } from '../../../lib/PlanoEngine/PlanoState';
// Secciones del menú de bajante para cajas (CajaBombaSection) y asociación de bomba
// (AsociarBombaSection). Extraídas verbatim de bajanteMenu.
import { pisoLbl, buildBajanteVisualLabel } from '../../../constants';
import { loadFromStorage } from '../../../services/storageService';
import { APARATOS_BY_TRAMO_KEY } from '../../../constants/storage-keys';
import { handleCreateBomba } from '../../../lib/PlanoEngine/drawingCreations';
import {
  asociarBomba,
  quitarBomba,
  bombsImmediateLowerFloor,
} from '../../../utils/bombaAssociation';
import { TRAZOS_PREFIX } from '../../../constants/storage-keys';
import {
  useDrawingElementContextMenu,
  MENU_SECTION_LABEL_ROW_STYLE,
  MENU_ACTION_BTN_STYLE,
  MENU_CHECK_ROW_STYLE,
} from './context';

/** Sección BOMBA para cajas AN/LL: "Crear bomba" (una por caja) o, si ya existe,
 *  "Bomba asociada" con nomenclatura, nivel, caja de origen, UDs y bajante asociado. */
export function CajaBombaSection({
  ctx,
  caja,
}: {
  ctx: ReturnType<typeof useDrawingElementContextMenu>;
  caja: PlanoBajante;
}) {
  const eng = ctx.engineRef.current;
  const bomba = eng?.bajantes.find((b) => b.tipo === 'bomba' && b.cajaOrigenId === caja.id);
  if (!bomba) {
    return (
      <div style={{ padding: '4px 8px', borderTop: '1px solid #3a494a' }}>
        <div style={MENU_SECTION_LABEL_ROW_STYLE}>Bomba</div>
        <button
          type="button"
          style={MENU_ACTION_BTN_STYLE}
          onClick={() => {
            if (!eng) return;
            handleCreateBomba(eng, caja);
            ctx.setContextMenuState((prev) =>
              prev ? { ...prev, element: { ...prev.element } } : null,
            );
          }}
        >
          + Crear bomba
        </button>
      </div>
    );
  }
  // Checkbox con la bomba asociada (orig. usuario): marcada = existe; desmarcar elimina la
  // bomba (con confirmación — es destructivo: desasocia su bajante).
  // Bomba asociada: info de solo lectura.
  const planId = String(eng?._loadedPlanId ?? '');
  const counts = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
  const udMap = counts[`${bomba.net}_${bomba.id}_${planId}`] || {};
  const uds = Object.values(udMap).reduce((a, b) => a + b, 0);
  // Bajante asociado: algún piso tiene un bajante con bombaEnId → "<este plan>|<esta bomba>".
  let bajInfo = '—';
  for (const pl of ctx.planosCtx?.plans || []) {
    if (pl.status !== 'confirmed') continue;
    const t = loadFromStorage<{
      bajantes?: Array<{ id: string; code?: string; bombaEnId?: string | null }>;
    } | null>(TRAZOS_PREFIX + String(pl.id), null);
    const dst = t?.bajantes?.find((b) => b.bombaEnId === `${planId}|${bomba.id}`);
    if (dst) {
      bajInfo = `${dst.code || dst.id} (${pl.nivel != null ? pisoLbl(Number(pl.nivel)) : pl.id})`;
      break;
    }
  }
  return (
    <div style={{ padding: '4px 8px', borderTop: '1px solid #3a494a' }}>
      <div style={MENU_SECTION_LABEL_ROW_STYLE}>Bomba asociada</div>
      <div
        style={{ fontSize: 12, color: '#b9caca', fontFamily: "'Geist',monospace", lineHeight: 1.5 }}
      >
        <div>
          Nomenclatura: <b>{bomba.code || bomba.id}</b>
        </div>
        <div>Nivel: {bomba.pisoBase || '—'}</div>
        <div>Caja de origen: {caja.code || caja.id}</div>
        <div>Unidades de descarga: {uds}</div>
        <div>Bajante asociado: {bajInfo}</div>
      </div>
      <label style={MENU_CHECK_ROW_STYLE}>
        <input
          type="checkbox"
          checked
          onChange={() => {
            if (!eng) return;
            ctx.triggerConfirm(
              'Eliminar bomba',
              `Se eliminará ${bomba.code || bomba.id} y se desasociará su bajante. ¿Continuar?`,
              () => {
                eng.deleteSelected([bomba.id]);
                ctx.setContextMenuState((prev) =>
                  prev ? { ...prev, element: { ...prev.element } } : null,
                );
              },
              'Eliminar',
            );
          }}
          style={{ accentColor: '#F5A623', margin: 0, flexShrink: 0 }}
        />
        <span style={{ flex: 1, whiteSpace: 'normal', wordBreak: 'break-word' }}>
          {bomba.code || bomba.id}
        </span>
      </label>
    </div>
  );
}

/** Sección "Asociar bomba del piso inferior": CHECKBOX con las bombas del piso
 *  inmediatamente inferior (orig. usuario) — marcada refleja la asociación vía `bombaEnId`;
 *  al marcar, el bajante recibe las MISMAS UDs de la bomba (herencia hacia arriba del efecto
 *  de FixturesPanel) y la dirección pasa a SUBE. */
export function AsociarBombaSection({
  ctx,
  bajEl,
}: {
  ctx: ReturnType<typeof useDrawingElementContextMenu>;
  bajEl: PlanoBajante;
}) {
  const eng = ctx.engineRef.current;
  const plans = ctx.planosCtx?.plans || [];
  const currentPlanId = String(eng?._loadedPlanId ?? '');
  const bombas = bombsImmediateLowerFloor(plans, currentPlanId);

  return (
    <div style={{ padding: '4px 8px', borderTop: '1px solid #3a494a' }}>
      <div style={MENU_SECTION_LABEL_ROW_STYLE}>Asociar bomba del piso inferior</div>
      {bombas.length === 0 && (
        <div style={{ fontSize: 12, color: '#6b8cae', fontFamily: "'Geist',monospace" }}>
          Sin bombas en el piso inmediatamente inferior
        </div>
      )}
      {bombas.map((row) => {
        const checked = bajEl.bombaEnId === `${row.planId}|${row.id}`;
        return (
          <label key={row.planId + '|' + row.id} style={MENU_CHECK_ROW_STYLE}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                if (!eng) return;
                // Capturar el booleano YA: el checkbox es controlado — al abrir el modal React
                // lo re-renderiza a `checked` (bombaEnId aún no cambió) y un `e.target.checked`
                // leído DIFERIDO (en Aceptar) vuelve false → llamaba quitarBomba y "no pasaba
                // nada" (orig. usuario).
                const checked = e.target.checked;
                const commit = () => {
                  if (checked) asociarBomba(eng, bajEl, currentPlanId, row, plans);
                  else quitarBomba(eng, bajEl, currentPlanId, plans);
                  ctx.setContextMenuState((st) =>
                    st ? { ...st, element: { ...st.element } } : null,
                  );
                };
                // Mismo aviso que la asociación entre pisos (ids correctos): al marcar con la
                // bomba desalineada se creará un ramal de desvío en el piso de la bomba.
                const aligned =
                  Math.abs((bajEl.x ?? 0) - row.x) < 0.5 && Math.abs((bajEl.y ?? 0) - row.y) < 0.5;
                if (aligned || !checked) {
                  commit();
                  return;
                }
                const bajLbl = buildBajanteVisualLabel(
                  { code: bajEl.code || bajEl.id },
                  bajEl.pisoBase || undefined,
                );
                // PUNTO 4: el code de la bomba ya trae el piso — sin sufijo duplicado.
                const bombaLbl = buildBajanteVisualLabel({ code: row.code });
                ctx.triggerConfirm(
                  'Crear fantasma de asociación',
                  `${bajLbl} y ${bombaLbl} no están alineados. Se creará un ramal de desvío en el piso de la bomba, desde la posición de ${bombaLbl}. ¿Continuar?`,
                  commit,
                  'Aceptar',
                );
              }}
              style={{ accentColor: '#F5A623', margin: 0, flexShrink: 0 }}
            />
            <span style={{ flex: 1, whiteSpace: 'normal', wordBreak: 'break-word' }}>
              {row.code}
            </span>
          </label>
        );
      })}
    </div>
  );
}
