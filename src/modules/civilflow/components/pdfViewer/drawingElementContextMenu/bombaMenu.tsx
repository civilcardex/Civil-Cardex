import {
  bajantesImmediateUpperFloor,
  asociarBomba,
  quitarBomba,
} from '../../../utils/bombaAssociation';
import type { BajanteSuperiorRow } from '../../../utils/bombaAssociation';
import { buildBajanteVisualLabel, pisoLbl } from '../../../constants';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine';
import type { PlanoBajante } from '../../../lib/PlanoEngine/PlanoState';
import type { PlanItem } from '../../../context/PlansContext';
import { MENU_CHECK_ROW_STYLE, MENU_SECTION_LABEL_ROW_STYLE } from './context';

/** Lista de checkboxes "Asociar bajantes del piso superior" DESDE LA BOMBA (orig. usuario):
 *  bajantes de la red de la bomba en el piso inmediatamente superior; marcado = ese bajante
 *  tiene bombaEnId apuntando aquí. Toggle → asociarBomba/quitarBomba con el MISMO aviso de
 *  desalineación de la asociación entre pisos. Compartida entre el menú contextual y el panel
 *  derecho de la bomba. */
export function BombaAsociarBajantesSection({
  engineRef,
  plans,
  bomba,
  triggerConfirm,
  onChanged,
}: {
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  plans: PlanItem[];
  bomba: PlanoBajante;
  triggerConfirm: (title: string, msg: string, onOk: () => void, okLabel?: string) => void;
  onChanged?: () => void;
}) {
  const eng = engineRef.current;
  const currentPlanId = String(eng?._loadedPlanId ?? '');
  const net = bomba.net || 'san';
  const bajantes = bajantesImmediateUpperFloor(plans, currentPlanId).filter((b) => b.net === net);
  // PUNTO 4: el code de la bomba ya trae el piso (BOMAN1-S1) — sin sufijo duplicado.
  const bombaLbl = buildBajanteVisualLabel({ code: bomba.code || bomba.id });

  const toggleBajante = (row: BajanteSuperiorRow, checked: boolean) => {
    if (!eng) return;
    const commit = () => {
      if (checked) {
        asociarBomba(
          eng,
          {
            id: row.id,
            net: row.net,
            dNominal: row.dNominal,
            bombaEnId: row.bombaEnId,
            x: row.x,
            y: row.y,
          },
          currentPlanId,
          {
            planId: currentPlanId,
            id: bomba.id,
            code: bomba.code || bomba.id,
            caja: bomba.cajaOrigenId || '—',
            nivel: bomba.pisoBase || '—',
            nivelN:
              plans.find((pl) => String(pl.id) === currentPlanId)?.nivel != null
                ? Number(plans.find((pl) => String(pl.id) === currentPlanId)?.nivel)
                : 0,
            x: bomba.x,
            y: bomba.y,
            net,
          },
          plans,
          row.planId,
        );
      } else {
        quitarBomba(
          eng,
          {
            id: row.id,
            net: row.net,
            bombaEnId: row.bombaEnId,
          } as PlanoBajante,
          currentPlanId,
          plans,
          row.planId,
        );
      }
      onChanged?.();
    };
    const aligned = Math.abs(row.x - bomba.x) < 0.5 && Math.abs(row.y - bomba.y) < 0.5;
    if (aligned || !checked) {
      commit();
      return;
    }
    const bajLbl = buildBajanteVisualLabel(
      { code: row.code },
      row.nivelN != null ? pisoLbl(row.nivelN) : undefined,
    );
    triggerConfirm(
      'Crear fantasma de asociación',
      `${bajLbl} y ${bombaLbl} no están alineados. Se creará un ramal de desvío en el piso de la bomba, desde la posición de ${bombaLbl}. ¿Continuar?`,
      commit,
      'Aceptar',
    );
  };

  return (
    <div style={{ padding: '4px 8px', borderTop: '1px solid #3a494a' }}>
      <div style={MENU_SECTION_LABEL_ROW_STYLE}>Asociar bajantes del piso superior</div>
      {bajantes.length === 0 && (
        <div style={{ fontSize: 12, color: '#6b8cae', fontFamily: "'Geist',monospace" }}>
          Sin bajantes en el piso inmediatamente superior
        </div>
      )}
      {bajantes.map((row) => {
        const checked = row.bombaEnId === `${currentPlanId}|${bomba.id}`;
        return (
          <label key={row.planId + '|' + row.id} style={MENU_CHECK_ROW_STYLE}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => toggleBajante(row, e.target.checked)}
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
