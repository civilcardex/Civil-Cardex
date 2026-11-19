/**
 * Una fila de la tabla de diseño de aguas lluvias, memoizada. Se extrae de RainwaterDesign para
 * que editar la pendiente de un tramo no repinte las demás filas: la tabla pasa el borrador de
 * ESA fila (`draft`) en vez del objeto completo.
 * Ej: escribir 2% en LL1 no re-renderiza LL2…LL20.
 */
import { memo, type Dispatch, type SetStateAction } from 'react';
import ChipList from './shared/ChipList.tsx';
import { renderStatus } from '../utils/componentHelpers.tsx';
import { pisoCorto, DIAM_OPTIONS_LL } from '../constants';
import { writePendienteToDrawing } from '../utils/writeDiameterToDrawing.ts';
import { avisarDiametroInvalido } from '../utils/diameterValidation.ts';
import { fmt } from '../utils/formatUtils.ts';
import { dec } from '../utils/parseDecimal.ts';
import type { LlRow } from '../utils/rainwaterRows.ts';
import type { PlanItem } from '../context/PlansContext.tsx';

export interface RainwaterTableRowProps {
  row: LlRow;
  /** Código de bajante → piso, para etiquetar los chips «Bajantes asociados». */
  pisoByBajCode: Record<string, number>;
  edit: boolean;
  draft: string | undefined;
  setEditingPend: Dispatch<SetStateAction<Record<string, string>>>;
  handleDiamChange: (tramoKey: string, tramoId: string, newPulg: number) => void;
  updTramoLL: (key: string, field: string, val: string | number | boolean) => void;
  plans: PlanItem[];
}

function RainwaterTableRow_({
  row,
  pisoByBajCode,
  edit,
  draft,
  setEditingPend,
  handleDiamChange,
  updTramoLL,
  plans,
}: RainwaterTableRowProps) {
  const {
    tKey,
    id,
    piso,
    desde,
    hasta,
    bajantesAsociadas,
    Q,
    n,
    sVal,
    DcalcPulg,
    DdisPulg,
    chequeoD,
    DintMm,
    Qo,
    Vo,
    qqo,
    Vreal,
    chequeoV,
    Yc,
    Yn,
    Froude,
    tipoFlujo,
    Ymax,
    chequeoYn,
    fuerzaTractiva,
    chequeoFT,
  } = row;
  const associatedBajantes = bajantesAsociadas.map((c) =>
    pisoByBajCode[c] != null ? `${c}-${pisoCorto(pisoByBajCode[c])}` : c,
  );
  return (
    <tr key={tKey}>
      <td className="ll-pad-3 c">
        <span className="sigla ll-fs">
          {id || tKey}
          {piso != null ? `-${pisoCorto(piso)}` : ''}
        </span>
      </td>

      <td className="ll-pad-3 c">
        <span className="ll-mono-dim">{desde || '—'}</span>
      </td>
      <td className="ll-pad-3 c">
        <span className="ll-mono-dim">{hasta || '—'}</span>
      </td>
      <td className="ll-minmax c">
        <ChipList items={associatedBajantes} />
      </td>
      <td className="ll-td-mono c">{Q > 0 ? Q.toFixed(2) : '—'}</td>
      <td className="ll-td-mono c">{n > 0 ? n.toFixed(3) : '—'}</td>
      <td className="ll-pad-2 c">
        {edit ? (
          <input
            type="text"
            inputMode="decimal"
            aria-label="Pendiente (%)"
            value={draft ?? (sVal > 0 ? fmt(sVal, 2) : '')}
            placeholder="—"
            onFocus={() => {
              if (draft === undefined && sVal > 0) {
                setEditingPend((prev) => ({ ...prev, [tKey]: fmt(sVal, 2) }));
              }
            }}
            onChange={(e) => {
              const raw = e.target.value
                .replace(/,/g, '.')
                .replace(/[^0-9.]/g, '')
                .replace(/(\..*)\./g, '$1');
              setEditingPend((prev) => ({ ...prev, [tKey]: raw }));
            }}
            onBlur={(e) => {
              const raw = draft !== undefined ? draft : e.target.value;
              // Coma o punto como separador decimal.
              const v = dec(String(raw));
              setEditingPend((prev) => {
                const next = { ...prev };
                delete next[tKey];
                return next;
              });
              // Rango físico (manning/PVC): ≤0 drena mal, >15% es basura de tipeo.
              if (v <= 0 || v > 15) {
                if (
                  avisarDiametroInvalido(
                    `La pendiente debe ser mayor que 0 % y hasta 15 % (${v} % no es válido).`,
                    'Pendiente fuera de rango',
                  )
                )
                  return;
              }
              writePendienteToDrawing(tKey, 'll', v, plans);
              updTramoLL(tKey, 'sPercent', v);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            className="ll-input ll-input-w50"
          />
        ) : (
          <span className="ll-mono">{sVal > 0 ? fmt(sVal, 2) : '—'}</span>
        )}
      </td>
      <td className="ll-td-mono c">{DcalcPulg > 0 ? DcalcPulg.toFixed(2) + '"' : '—'}</td>
      <td className="ll-pad-2 c">
        <select
          aria-label="Seleccionar diámetro"
          value={DdisPulg || ''}
          disabled={!edit}
          onChange={(e) => handleDiamChange(tKey, id, parseFloat(e.target.value) || 0)}
          className="ll-input"
        >
          <option value="">—</option>
          {DIAM_OPTIONS_LL.map((o) => (
            <option key={o.pulg} value={o.pulg}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td className="ll-td-num c">{DintMm > 0 ? fmt(DintMm, 2) : '—'}</td>
      <td className="ll-td-num c">{renderStatus(chequeoD)}</td>
      <td className="ll-td-mono c">{Qo > 0 ? Qo.toFixed(2) : '—'}</td>
      <td className="ll-td-mono c">{Vo > 0 ? Vo.toFixed(2) : '—'}</td>
      <td className="ll-td-mono c">{qqo > 0 ? qqo.toFixed(2) : '—'}</td>
      <td className="ll-td-mono c">{Vreal > 0 ? Vreal.toFixed(2) : '—'}</td>
      <td className="ll-td-num c">{renderStatus(chequeoV)}</td>
      <td className="ll-td-mono c">{Yc > 0 ? Yc.toFixed(2) : '—'}</td>
      <td className="ll-td-mono c">{Yn > 0 ? Yn.toFixed(2) : '—'}</td>
      <td className="ll-td-mono c">{Froude > 0 ? Froude.toFixed(2) : '—'}</td>
      <td className="ll-td-num c">{tipoFlujo}</td>
      <td className="ll-td-num c">{Ymax > 0 ? Ymax.toFixed(2) : '—'}</td>
      <td className="ll-td-num c">{renderStatus(chequeoYn)}</td>
      <td className="ll-td-num c">{fuerzaTractiva > 0 ? fuerzaTractiva.toFixed(2) : '—'}</td>
      <td className="ll-td-num c">{renderStatus(chequeoFT)}</td>
    </tr>
  );
}

export const RainwaterTableRow = memo(RainwaterTableRow_);
