import type { CSSProperties } from 'react';
import type { Tramo } from '../../context/tramosReducer';
import type { FilaBajante } from '../../utils/bajanteRowModel.ts';
import type { DrawingData } from '../../utils/drawingSync.ts';
import type { SyncPlanInput } from '../../utils/drawingSyncTypes.ts';
import { avisarDiametroInvalido } from '../../utils/diameterValidation.ts';
import { renderStatus } from '../../utils/componentHelpers.tsx';
import { DIAM_BAN, DIAM_BAN_SAN, DIAM_VENT } from '../../constants';
import { fmt, planIdDeKey } from '../../utils/formatUtils.ts';
import { entradaPor } from '../../utils/diamLookup';
import { clavesRamalesVentDeBajantes } from '../../utils/ventDiameterFanout.ts';
import {
  writeBajantePropToDrawing,
  writeDiametroToDrawing,
  writeDiametroToDrawingBatch,
} from '../../utils/writeDiameterToDrawing.ts';

const DownpipesTable_S1: CSSProperties = {
  width: 40,
  padding: 2,
  textAlign: 'center',
  fontFamily: 'var(--mono)',
  fontSize: 11,
  background: 'var(--bg2)',
  border: '1px solid var(--line)',
  color: 'var(--txt)',
};

interface DownpipesRowProps {
  t: Tramo;
  fila: FilaBajante;
  edit: boolean;
  plans: SyncPlanInput[];
  updTramoSan: (key: string, campo: string, val: string | number | boolean) => void;
  storageByPlan: Record<string, DrawingData>;
}

/** Fila de un bajante (23 celdas): cálculo ya resuelto en `fila` (bajanteRowModel), aquí
 *  solo se pinta y se manejan los 4 editores (llenado, D san, longitud, D vent).
 *  Extraída verbatim de DownpipesTable — mismo markup, mismos handlers. */
export function DownpipesRow({
  t,
  fila,
  edit,
  plans,
  updTramoSan,
  storageByPlan,
}: DownpipesRowProps) {
  const {
    rStr,
    origenVal,
    destinoVal,
    propiasUD,
    totalUD,
    n,
    Q,
    DcalcPulg,
    chequeo,
    QmaxB,
    Vt,
    Ltcalc,
    Ltmin,
    fDarcy,
    Vair,
    Qair,
    DventCalcPulg,
    DventPropPulg,
    maxSanConectDiam,
    sanDiamWarn,
    resolvedSanDprop,
    sanBajKey,
    resolvedVentDprop,
    ventBajKey,
    ventBajKeys,
    ventRamalDiamPulg,
    ventDiamWarn,
    clave: tKey,
    chequeoVent,
  } = fila;
  const planIdStr = t.planId || planIdDeKey(t._key);
  const ramalesAsocVal = fila.ramalesAsoc.length > 0 ? fila.ramalesAsoc.join(', ') : '—';
  return (
    <tr key={t._key || `${t.id}-${t.piso}`}>
      <td className="c">
        <span className="sigla" style={{ fontSize: 11 }}>
          {t.code || t.id}
        </span>
      </td>
      <td
        className="c"
        style={{
          padding: '1px 1px',
          fontSize: 11,
          fontFamily: 'var(--mono)',
          color: 'var(--txt)',
        }}
      >
        {origenVal}
      </td>
      <td
        className="c"
        style={{
          padding: '1px 1px',
          fontSize: 11,
          fontFamily: 'var(--mono)',
          color: 'var(--txt)',
        }}
      >
        {destinoVal}
      </td>
      <td
        className="c"
        style={{
          fontSize: 11,
          color: 'var(--txt2)',
          fontFamily: 'var(--mono)',
          padding: '1px 1px',
        }}
      >
        {/* Mismo estilo de chips que "Ramales asociados" de diseño de redes:
              borde y texto con el color de la red san. */}
        {ramalesAsocVal === '—' ? (
          <span style={{ fontSize: 11, color: 'var(--txt3)' }}>—</span>
        ) : (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {Array.from(new Set(ramalesAsocVal.split(', '))).map((rid) => (
              <span
                key={rid}
                style={{
                  fontSize: 10,
                  padding: '3px 6px',
                  border: '1px solid var(--san)',
                  borderRadius: 3,
                  color: 'var(--san)',
                  fontFamily: 'var(--mono)',
                  lineHeight: 1.3,
                }}
              >
                {rid}
              </span>
            ))}
          </div>
        )}
      </td>
      <td
        className="c"
        style={{
          fontFamily: 'var(--mono)',
          fontWeight: 700,
          fontSize: 11,
          padding: '1px 1px',
        }}
      >
        {propiasUD > 0 ? propiasUD : '—'}
      </td>
      <td
        className="c"
        style={{
          fontFamily: 'var(--mono)',
          fontWeight: 700,
          fontSize: 11,
          padding: '1px 1px',
        }}
      >
        {totalUD > 0 ? totalUD : '—'}
      </td>
      <td className="c" style={{ padding: '1px 1px' }}>
        <select
          value={rStr || '7/24'}
          aria-label="Llenado (R)"
          disabled={!edit}
          onChange={(e) => {
            const num = e.target.value === '1/4' ? 0.25 : 7 / 24;
            // Bidireccional (orig. usuario): escribe el bajante en el dibujo
            // (engine vivo o storage) y refleja el valor en el tramo.
            const targetKey = t._key || `${t.id}-${planIdStr}`;
            writeBajantePropToDrawing(targetKey, t.net || 'san', 'bajR', num, plans);
            updTramoSan(targetKey, 'bajR', num);
          }}
          style={{
            fontSize: 11,
            padding: '1px 2px',
            background: 'var(--bg2)',
            border: '1px solid var(--line)',
            borderRadius: 2,
            color: 'var(--txt)',
            fontFamily: 'var(--mono)',
            maxWidth: 64,
            opacity: edit ? 1 : 0.6,
          }}
        >
          <option value="7/24">7/24</option>
          <option value="1/4">1/4</option>
        </select>
      </td>
      <td
        className="c"
        style={{
          fontFamily: 'var(--mono)',
          fontWeight: 600,
          fontSize: 11,
          padding: '1px 1px',
        }}
      >
        {Q > 0 ? Q.toFixed(2) : '—'}
      </td>
      <td className="c" style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '1px 1px' }}>
        {n > 0 ? n.toFixed(3) : '—'}
      </td>
      <td className="c" style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '1px 1px' }}>
        {DcalcPulg > 0 ? DcalcPulg.toFixed(2) + '"' : '—'}
      </td>
      <td className="c" style={{ padding: '1px 1px' }}>
        <select
          aria-label="Diámetro Bajante Propuesto"
          value={resolvedSanDprop || ''}
          disabled={!edit}
          onChange={(e) => {
            const val = parseFloat(e.target.value) || 0;
            const matched = entradaPor(DIAM_BAN, 'pulg', val);
            let nom = matched ? matched.nom : '';
            if (val > 0 && maxSanConectDiam > 0 && val < maxSanConectDiam) {
              avisarDiametroInvalido(
                `El diámetro del bajante no puede ser inferior al del ramal sanitario (${maxSanConectDiam}")`,
              );
              nom = '';
            }
            if (!nom && val > 0) return;
            const targetKey = sanBajKey || tKey;
            // Regla entre pisos: si se bloquea, no avanzar optimista.
            if (writeBajantePropToDrawing(targetKey, 'san', 'dNominal', nom, plans) === false)
              return;
            // #6: immediate local state for real-time chequeo
            updTramoSan(targetKey, 'bajDprop', nom ? val : 0);
          }}
          style={{
            fontSize: 11,
            padding: '2px 4px',
            background: 'var(--bg2)',
            border: sanDiamWarn ? '1px solid var(--err)' : '1px solid var(--line)',
            color: sanDiamWarn ? 'var(--err)' : 'var(--txt)',
            fontWeight: sanDiamWarn ? 'bold' : 'normal',
            borderRadius: 2,
            width: '100%',
            textAlign: 'center',
            cursor: 'pointer',
          }}
        >
          <option value="">—</option>
          {DIAM_BAN_SAN.map((d) => (
            <option key={d.pulg} value={d.pulg}>
              {d.nom}
            </option>
          ))}
        </select>
        {sanDiamWarn && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--err)',
              marginTop: 2,
              lineHeight: 1.2,
            }}
          >
            Debe ser mayor o igual al &oslash; del ramal san. ({maxSanConectDiam}
            &quot;)
          </div>
        )}
      </td>
      <td className="c" style={{ fontSize: 11, padding: '1px 1px' }}>
        {renderStatus(chequeo)}
      </td>
      <td className="c" style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '1px 1px' }}>
        {QmaxB > 0 ? QmaxB.toFixed(2) : '—'}
      </td>
      <td className="c" style={{ fontSize: 11, padding: '1px 1px' }}>
        {Vt > 0 ? Vt.toFixed(2) : '—'}
      </td>
      <td className="c" style={{ fontSize: 11, padding: '1px 1px' }}>
        {Ltcalc > 0 ? Ltcalc.toFixed(2) : '—'}
      </td>
      <td className="c" style={{ fontSize: 11, padding: '1px 1px' }}>
        {Ltmin > 0 ? Ltmin.toFixed(2) : '—'}
      </td>
      <td className="c" style={{ fontSize: 11, padding: '1px 1px' }}>
        {Vair > 0 ? Vair.toFixed(2) : '—'}
      </td>
      <td className="c" style={{ padding: '1px 1px' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
          {fDarcy > 0 ? fDarcy.toFixed(3) : '—'}
        </span>
      </td>
      <td className="c" style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '1px 1px' }}>
        {Qair > 0 ? Qair.toFixed(2) : '—'}
      </td>
      <td className="c" style={{ padding: '1px 1px' }}>
        <input
          type="text"
          inputMode="decimal"
          aria-label="Longitud del bajante (m)"
          style={DownpipesTable_S1}
          disabled={!edit}
          value={t.bajLong != null ? (!edit ? fmt(Number(t.bajLong), 2) : String(t.bajLong)) : ''}
          placeholder="—"
          onChange={(e) => {
            const raw = e.target.value.replace(/,/g, '.');
            // Permitir vacío y solo números + punto
            if (raw === '') {
              const tk = t._key || `${t.id}-${planIdStr}`;
              writeBajantePropToDrawing(tk, t._net || t.net || 'san', 'bajLong', '', plans);
              updTramoSan(tk, 'bajLong', '');
              return;
            }
            if (!/^[0-9]*\.?[0-9]*$/.test(raw)) return;
            const tk = t._key || `${t.id}-${planIdStr}`;
            // Guardar como string para permitir "5." intermedio, convertir a número en blur
            writeBajantePropToDrawing(tk, t._net || t.net || 'san', 'bajLong', raw, plans);
            updTramoSan(tk, 'bajLong', raw as unknown as number);
          }}
          onBlur={(e) => {
            const raw = e.target.value.replace(/,/g, '.').trim();
            const tk = t._key || `${t.id}-${planIdStr}`;
            if (raw === '') {
              writeBajantePropToDrawing(tk, t._net || t.net || 'san', 'bajLong', '', plans);
              updTramoSan(tk, 'bajLong', '');
              return;
            }
            const val = parseFloat(raw);
            if (!isNaN(val)) {
              writeBajantePropToDrawing(tk, t._net || t.net || 'san', 'bajLong', val, plans);
              updTramoSan(tk, 'bajLong', val);
            }
          }}
        />
      </td>
      <td className="c" style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '1px 1px' }}>
        {DventPropPulg > 0 ? (DventCalcPulg > 0 ? DventCalcPulg.toFixed(2) + '"' : '--') : '--'}
      </td>
      <td className="c" style={{ padding: '1px 1px' }}>
        <select
          aria-label="Diámetro Ventilación Propuesto"
          value={resolvedVentDprop || ''}
          disabled={!edit}
          onChange={(e) => {
            const val = parseFloat(e.target.value) || 0;
            const matched = entradaPor(DIAM_VENT, 'pulg', val);
            let nom = matched ? matched.nom : '';
            if (val > 0 && ventRamalDiamPulg > 0 && val < ventRamalDiamPulg) {
              avisarDiametroInvalido(
                `El diámetro de la ventilación no puede ser inferior al del ramal de ventilación (${ventRamalDiamPulg}")`,
              );
              nom = '';
            }
            if (!nom && val > 0) return;
            if (ventBajKey) {
              // Item 1: cambiar el "D vent propuesto" debe actualizar
              // TODOS los bajantes de ventilación conectados al mismo
              // bajante sanitario (no solo uno).
              for (const vk of ventBajKeys.length ? ventBajKeys : [ventBajKey]) {
                // Bloqueado (regla entre pisos) = no avanzar optimista.
                if (writeBajantePropToDrawing(vk, 'vent', 'dNominal', nom, plans) === false)
                  continue;
                // #6: immediate local state for real-time chequeo
                updTramoSan(vk, 'bajDprop', nom ? val : 0);
              }
              // Bidireccional: TODO ramal de ventilación conectado a los
              // brevs (ini/fin/code) adopta el mismo diámetro — sin depender
              // de ventRamalKey (los extremos del ramal apuntan al brev).
              // Ramales vent conectados a los brevs → UN batch write
              // (antes: writeDiametroToDrawing por ramal = N parses + N RPCs).
              const ventRamalKeys = clavesRamalesVentDeBajantes(
                ventBajKeys,
                ventBajKey,
                storageByPlan,
              );
              writeDiametroToDrawingBatch(ventRamalKeys, 'vent', nom, plans);
            } else if (t.ventRamalKey) {
              const res = writeDiametroToDrawing(t.ventRamalKey, 'vent', nom, plans);
              if (!res.ok && res.reason === 'accessory-larger') {
                if (
                  avisarDiametroInvalido(
                    `El diámetro del ramal no puede ser menor al del accesorio conectado en el extremo ${res.accessoryEnd} (${res.accessoryDiam}). Reduce el diámetro del accesorio o selecciona un ramal mayor.`,
                  )
                )
                  return;
              }
            }
            writeBajantePropToDrawing(
              tKey,
              t._net || t.net || 'san',
              'ventDprop',
              nom ? val : 0,
              plans,
            );
            // #6: immediate local state for vent chequeo
            updTramoSan(tKey, 'ventDprop', nom ? val : 0);
          }}
          style={{
            fontSize: 11,
            padding: '2px 4px',
            background: 'var(--bg2)',
            border:
              DventPropPulg < DventCalcPulg || ventDiamWarn
                ? '1px solid var(--err)'
                : '1px solid var(--line)',
            color: DventPropPulg < DventCalcPulg || ventDiamWarn ? 'var(--err)' : 'var(--txt)',
            fontWeight: DventPropPulg < DventCalcPulg || ventDiamWarn ? 'bold' : 'normal',
            borderRadius: 2,
            width: '100%',
            textAlign: 'center',
            cursor: 'pointer',
          }}
        >
          <option value="">—</option>
          {DIAM_VENT.map((d) => (
            <option key={d.pulg} value={d.pulg}>
              {d.nom}
            </option>
          ))}
        </select>
        {ventDiamWarn && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--err)',
              marginTop: 2,
              lineHeight: 1.2,
            }}
          >
            Debe ser mayor o igual al &oslash; del ramal de vent. ({ventRamalDiamPulg}
            &quot;)
          </div>
        )}
      </td>
      <td
        className="c"
        style={{
          padding: '1px 1px',
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          minWidth: 60,
        }}
      >
        {renderStatus(chequeoVent)}
      </td>
    </tr>
  );
}
