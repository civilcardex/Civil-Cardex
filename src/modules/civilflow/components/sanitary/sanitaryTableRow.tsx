/**
 * Una fila de la tabla de diseño sanitario, memoizada. Se extrae de SanitaryTables para que
 * escribir la pendiente de un ramal no vuelva a renderizar las demás filas: la tabla pasa el
 * borrador de ESA fila (`draft`) en vez del objeto completo de borradores.
 * Ej: editar RS1 no repinta RS2…RS20.
 */
import { memo, type Dispatch, type SetStateAction } from 'react';
import { renderStatus } from '../../utils/componentHelpers.tsx';
import { pisoCorto, DIAM_OPTIONS_SAN } from '../../constants';
import { writePendienteToDrawing } from '../../utils/writeDiameterToDrawing.ts';
import { fmt, sectorDe } from '../../utils/formatUtils.ts';
import { dec } from '../../utils/parseDecimal.ts';
import type { SanRow } from '../../utils/sanitaryRows.ts';
import type { PlanItem } from '../../context/PlansContext.tsx';

export interface SanitaryTableRowProps {
  row: SanRow;
  connectedKeys: string[];
  componentTotalMap: Record<string, number>;
  keyToLabel: Map<string, string>;
  edit: boolean;
  /** Borrador de pendiente SOLO de esta fila (undefined = mostrar la pendiente calculada). */
  draft: string | undefined;
  /** Setter de useState: estable, seguro pasarlo a una fila memoizada. */
  setEditingPend: Dispatch<SetStateAction<Record<string, string>>>;
  handleDiamChange: (tramoId: string, newPulg: number) => void;
  plans: PlanItem[];
}

function SanitaryTableRow_({
  row,
  connectedKeys,
  componentTotalMap,
  keyToLabel,
  edit,
  draft,
  setEditingPend,
  handleDiamChange,
  plans,
}: SanitaryTableRowProps) {
  const tKey = row.tKey;
  const {
    udPropias,
    udAcum,
    Q,
    n,
    sVal,
    DcalcPulg,
    DdisPulg,
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
    nivelFT,
    chequeoS,
  } = row;
  return (
    <tr key={tKey}>
      <td className="c san-pad">
        <span className="sigla san-fs">
          {/* Tramo + piso (orig. usuario): etiqueta tipo row-P1. */}
          {row.id}
          {row.piso != null ? `-${pisoCorto(row.piso)}` : ''}
        </span>
      </td>

      <td className="c san-pad san-mono">{udPropias}</td>
      <td className="c san-td-minmax">
        {connectedKeys.length === 0 ? (
          <span className="san-muted">—</span>
        ) : (
          <div className="san-connected">
            {connectedKeys.map((childKey) => {
              const rId = keyToLabel.get(childKey) || sectorDe(childKey);
              const childTotalUd = componentTotalMap[childKey] ?? 0;
              return (
                <span key={childKey} title={`${rId} (${childTotalUd} UD)`} className="san-badge">
                  {rId}
                </span>
              );
            })}
          </div>
        )}
      </td>
      <td className="san-mono-700 c">{udAcum}</td>
      <td className="san-mono-600 c">{Q != null && Q > 0 ? Q.toFixed(2) : '—'}</td>
      <td className="c san-pad san-mono">{n > 0 ? n.toFixed(3) : '—'}</td>
      <td className="c san-pad">
        {edit ? (
          <input
            type="text"
            inputMode="decimal"
            value={draft !== undefined ? draft : sVal > 0 ? fmt(sVal, 2) : ''}
            placeholder="—"
            onFocus={() => {
              if (draft === undefined && sVal > 0) {
                setEditingPend((prev) => ({
                  ...prev,
                  [tKey]: fmt(sVal, 2),
                }));
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
              const v = dec(String(raw));
              setEditingPend((prev) => {
                const next = { ...prev };
                delete next[tKey];
                return next;
              });
              writePendienteToDrawing(tKey, 'san', v, plans);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            className="san-input san-input-w50"
          />
        ) : sVal > 0 ? (
          <span style={chequeoS !== 'O.K.' ? { color: '#ef5350', fontWeight: 700 } : undefined}>
            {fmt(sVal, 2)}
          </span>
        ) : (
          '—'
        )}
        {chequeoS !== 'O.K.' && sVal > 0 ? (
          <div style={{ fontSize: 10, color: '#ef5350', lineHeight: 1.2 }}>{chequeoS}</div>
        ) : null}
      </td>
      <td className="san-pad san-mono san-fs c">
        {DcalcPulg > 0 ? DcalcPulg.toFixed(2) + '"' : '--'}
      </td>
      <td className="c san-pad">
        <select
          aria-label="Diámetro diseño"
          value={DdisPulg || ''}
          disabled={!edit}
          onChange={(e) => handleDiamChange(tKey, parseFloat(e.target.value) || 0)}
          className="san-input"
        >
          <option value="">—</option>
          {DIAM_OPTIONS_SAN.map((o) => (
            <option key={o.pulg} value={o.pulg}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td className="c san-pad">{DdisPulg > 0 && DintMm > 0 ? fmt(DintMm, 2) : '--'}</td>
      <td className="c san-pad">
        {DdisPulg > 0
          ? DcalcPulg > 0
            ? renderStatus(DcalcPulg <= DdisPulg ? 'Ok' : 'No cumple')
            : renderStatus('No cumple')
          : renderStatus('No cumple')}
      </td>
      <td className="c san-pad san-mono">{DdisPulg > 0 && Qo > 0 ? Qo.toFixed(2) : '--'}</td>
      <td className="c san-pad san-mono">{DdisPulg > 0 && Vo > 0 ? Vo.toFixed(2) : '--'}</td>
      <td className="c san-pad san-mono">{DdisPulg > 0 && qqo > 0 ? qqo.toFixed(2) : '--'}</td>
      <td className="c san-pad san-mono">{DdisPulg > 0 && Vreal > 0 ? Vreal.toFixed(2) : '--'}</td>
      <td className="c san-pad">{DdisPulg > 0 ? renderStatus(chequeoV) : 'No cumple'}</td>
      <td className="c san-pad san-mono">{DdisPulg > 0 && Yc > 0 ? Yc.toFixed(2) : '--'}</td>
      <td className="c san-pad san-mono">{DdisPulg > 0 && Yn > 0 ? Yn.toFixed(2) : '--'}</td>
      <td className="c san-pad san-mono">
        {DdisPulg > 0 && Froude > 0 ? Froude.toFixed(2) : '--'}
      </td>
      <td className="c san-pad san-fs">{DdisPulg > 0 ? tipoFlujo : '--'}</td>
      <td className="c san-pad san-mono">{DdisPulg > 0 && Ymax > 0 ? Ymax.toFixed(2) : '--'}</td>
      <td className="c san-pad">{DdisPulg > 0 ? renderStatus(chequeoYn) : 'No cumple'}</td>
      <td className="c san-pad san-mono">
        {DdisPulg > 0 && fuerzaTractiva > 0 ? fuerzaTractiva.toFixed(2) : '--'}
      </td>
      <td className="c san-pad">
        {DdisPulg > 0 && nivelFT === 'NO CUMPLE' ? (
          renderStatus('NO CUMPLE')
        ) : DdisPulg > 0 && nivelFT === 'RECOMENDADO' ? (
          <span
            style={{ color: '#fbbf24', fontWeight: 600, fontSize: 11 }}
            title="Sobre el mínimo normativo (NIVEL 1); por debajo del recomendado de diseño (NIVEL 2)"
          >
            REC.
          </span>
        ) : DdisPulg > 0 ? (
          nivelFT === 'RECOMENDADO' ? (
            <span
              style={{ color: '#fbbf24', fontWeight: 600, fontSize: 11 }}
              title="Sobre el mínimo normativo, pero por debajo del recomendado de diseño"
            >
              REC.
            </span>
          ) : (
            renderStatus(chequeoFT)
          )
        ) : (
          'No cumple'
        )}
      </td>
    </tr>
  );
}

export const SanitaryTableRow = memo(SanitaryTableRow_);
