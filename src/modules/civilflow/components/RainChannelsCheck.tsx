import React from 'react';
import EditButton from './shared/EditButton';
import { renderStatus } from '../utils/componentHelpers';
import { pisoCorto } from '../constants';
import { useRainwater } from '../context/RainwaterContext';
import { chequeoCanalLluvia, BORDE_LIBRE_CANAL_CM } from '../utils/calcRainwater';
import { trunc2 } from '../utils/formatUtils';

const CANAL_FIELD_LABELS: Record<'b' | 'h' | 'pendiente' | 'longitud' | 'areaOtras', string> = {
  b: 'Base (cm)',
  h: 'Altura (cm)',
  pendiente: 'Pendiente (%)',
  longitud: 'Longitud (cm)',
  areaOtras: 'Área otras',
};

const CanalDimField = React.memo(function CanalDimField({
  id,
  field,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  field: 'b' | 'h' | 'pendiente' | 'longitud' | 'areaOtras';
  value: number;
  onChange: (id: string, field: string, val: number) => void;
  /** Edición gated por el botón EDITAR de la tabla. */
  disabled?: boolean;
}) {
  const [text, setText] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  // Otras (orig. usuario): nunca vacía — muestra 0 cuando el valor es 0.
  const display =
    field === 'areaOtras'
      ? editing
        ? text
        : String(value ?? 0)
      : editing
        ? text
        : value > 0
          ? String(value)
          : '';
  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      placeholder="0"
      aria-label={CANAL_FIELD_LABELS[field]}
      disabled={disabled}
      onFocus={() => {
        setEditing(true);
        // Otras en 0 arranca VACÍA al enfocar (orig. usuario: no había que "quitar el 0").
        const vaciar = field === 'areaOtras' && !(value > 0);
        setText(vaciar ? '' : display);
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
        setText(raw);
      }}
      onKeyDown={(e) => {
        // Enter commitea el cambio (mismo comportamiento que el resto de campos numéricos)
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      onBlur={() => {
        setEditing(false);
        // Dimensión física (b/h/longitud/pendiente): negativo = basura de tipeo, no dato.
        const v = Math.max(0, parseFloat(text) || 0);
        onChange(id, field, text === '' ? 0 : v);
      }}
      style={{
        textAlign: 'center',
        fontSize: 10.5,
        opacity: disabled ? 0.6 : 1,
        padding: '2px 4px',
        width: 42,
        fontFamily: 'var(--mono)',
        background: 'var(--bg2)',
        border: '1px solid var(--line)',
        borderRadius: 2,
        color: 'var(--txt)',
      }}
    />
  );
});

export default function ChequeoCanalesLluvias() {
  const [edit, setEdit] = React.useState(false);
  const { canalesLl, updCanalLL, conRecolectora } = useRainwater();

  return (
    <section className="card">
      <div
        className="card-h"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
      >
        <h3 className="card-t">
          <img
            src="/iconos_civilflow/diseno_redes/aguas_lluvias/RALL_Chequeo_canal_cubierta.webp"
            alt="Chequeo canal cubierta"
            width={24}
            height={24}
            style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }}
            loading="lazy"
          />{' '}
          Chequeo capacidad canal recolectora cubierta aguas lluvias
        </h3>
      </div>
      <EditButton edit={edit} setEdit={setEdit} />
      {!conRecolectora ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--txt3)', fontSize: 12 }}>
          Activa el canal recolectora para ver este chequeo.
        </div>
      ) : (
        <div className="scroll-top" style={{ padding: '16px' }}>
          <div className="scroll-inner" style={{ minWidth: 'max-content' }}>
            <table
              className="tbl"
              style={{
                fontSize: 10.5,
                tableLayout: 'auto',
                width: '100%',
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={{ fontSize: 10.5, textAlign: 'center', padding: '3px 5px' }}
                  >
                    Canal
                  </th>
                  <th
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={{ fontSize: 10.5, textAlign: 'center', padding: '3px 5px' }}
                  >
                    Nivel
                  </th>
                  <th
                    scope="col"
                    className="col-h ll"
                    colSpan={3}
                    style={{ textAlign: 'center', fontSize: 10.5, padding: '3px 5px' }}
                  >
                    Área (m²)
                  </th>
                  <th
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={{ fontSize: 10.5, textAlign: 'center', padding: '3px 5px' }}
                  >
                    Intensidad (I)
                    <br />
                    <small>mm/hr</small>
                  </th>
                  <th
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={{ fontSize: 10.5, textAlign: 'center', padding: '3px 5px' }}
                  >
                    Coeficiente
                    <br />
                    Escorrentía
                  </th>
                  <th
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={{ fontSize: 10.5, textAlign: 'center', padding: '3px 5px' }}
                  >
                    Caudal real
                    <br />
                    <small>(LPS)</small>
                  </th>
                  <th
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={{ fontSize: 10.5, textAlign: 'center', padding: '3px 5px' }}
                  >
                    Manning
                  </th>
                  <th
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={{ fontSize: 10.5, textAlign: 'center', padding: '3px 5px' }}
                  >
                    Pendiente
                    <br />
                    <small>(%)</small>
                  </th>
                  <th
                    scope="col"
                    className="col-h ok"
                    colSpan={5}
                    style={{ textAlign: 'center', fontSize: 10.5, padding: '3px 5px' }}
                  >
                    Sección propuesta (cm)
                  </th>
                  <th
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={{ fontSize: 10.5, textAlign: 'center', padding: '3px 5px' }}
                  >
                    Caudal máximo
                    <br />
                    <small>(LPS)</small>
                  </th>
                  <th
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={{ fontSize: 10.5, textAlign: 'center', padding: '3px 5px' }}
                  >
                    Chequeo
                    <br />
                    Qreal &lt; Qmax
                  </th>
                </tr>
                <tr>
                  <th
                    scope="col"
                    className="col-h ll"
                    style={{ fontSize: 10.5, textAlign: 'center', padding: '3px 5px' }}
                  >
                    Parcial
                  </th>
                  <th
                    scope="col"
                    className="col-h ll"
                    style={{ fontSize: 10.5, textAlign: 'center', padding: '3px 5px' }}
                  >
                    Otras
                  </th>
                  <th
                    scope="col"
                    className="col-h ll"
                    style={{ fontSize: 10.5, textAlign: 'center', padding: '3px 5px' }}
                  >
                    Total
                  </th>
                  <th
                    scope="col"
                    className="col-h ok"
                    style={{ fontSize: 10.5, textAlign: 'center', padding: '3px 5px' }}
                  >
                    Base
                  </th>
                  <th
                    scope="col"
                    className="col-h ok"
                    style={{ fontSize: 10.5, textAlign: 'center', padding: '3px 5px' }}
                  >
                    Altura
                  </th>
                  <th
                    scope="col"
                    className="col-h ok"
                    style={{ fontSize: 10.5, textAlign: 'center', padding: '3px 5px' }}
                  >
                    Longitud
                  </th>
                  <th
                    scope="col"
                    className="col-h ok"
                    style={{ fontSize: 10.5, textAlign: 'center', padding: '3px 5px' }}
                  >
                    Borde libre
                  </th>
                  <th
                    scope="col"
                    className="col-h ok"
                    style={{ fontSize: 10.5, textAlign: 'center', padding: '3px 5px' }}
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {canalesLl.length === 0 ? (
                  <tr>
                    <td
                      colSpan={17}
                      style={{
                        padding: '24px 0',
                        textAlign: 'center',
                        color: 'var(--txt3)',
                        fontSize: 10.5,
                      }}
                    >
                      No hay canales. Dibuja canales recolectores en el visor para que aparezcan
                      aquí.
                    </td>
                  </tr>
                ) : (
                  canalesLl.map((c) => {
                    const { Qreal, Qmax, chequeo, totalStr } = chequeoCanalLluvia(c);
                    return (
                      <tr key={c.id}>
                        <td className="c">
                          <span className="sigla" style={{ fontSize: 10.5 }}>
                            {c.sector || '—'}
                          </span>
                        </td>
                        <td className="c">
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>
                            {c.piso != null ? pisoCorto(c.piso) : '—'}
                          </span>
                        </td>
                        <td className="c">
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>
                            {c.areaParcial ? Number(c.areaParcial).toFixed(2) : '—'}
                          </span>
                        </td>
                        <td className="c">
                          {/* Otras (orig. usuario): editable, default 0 — nunca vacía. */}
                          <CanalDimField
                            id={c.id}
                            field="areaOtras"
                            value={c.areaOtras ?? 0}
                            onChange={updCanalLL}
                            disabled={!edit}
                          />
                        </td>
                        <td className="c">
                          <span
                            style={{
                              fontFamily: 'var(--mono)',
                              fontSize: 10.5,
                              fontWeight: 600,
                            }}
                          >
                            {c.areaAcumulada ? Number(c.areaAcumulada).toFixed(2) : '—'}
                          </span>
                        </td>
                        <td className="c">
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>
                            {c.intensidad || '—'}
                          </span>
                        </td>
                        <td className="c">
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>
                            {c.coeficienteC || '—'}
                          </span>
                        </td>
                        <td
                          className="c"
                          style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 10.5 }}
                        >
                          {Qreal > 0 ? trunc2(Qreal) : '—'}
                        </td>
                        <td className="c">
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>
                            {c.manning || '—'}
                          </span>
                        </td>
                        <td className="c">
                          {/* Pendiente del canal fija en 2% (S=2%) — por diseño, no editable. */}
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>2</span>
                        </td>
                        <td className="c">
                          {c.fromCanal ? (
                            <span
                              style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}
                              title="Configurado desde el canal dibujado en el plano"
                            >
                              {c.b || '—'}
                            </span>
                          ) : (
                            <CanalDimField
                              id={c.id}
                              field="b"
                              value={c.b}
                              onChange={updCanalLL}
                              disabled={!edit}
                            />
                          )}
                        </td>
                        <td className="c">
                          {c.fromCanal ? (
                            <span
                              style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}
                              title="Configurado desde el canal dibujado en el plano"
                            >
                              {c.h || '—'}
                            </span>
                          ) : (
                            <CanalDimField
                              id={c.id}
                              field="h"
                              value={c.h}
                              onChange={updCanalLL}
                              disabled={!edit}
                            />
                          )}
                        </td>
                        <td className="c">
                          {c.fromCanal ? (
                            <span
                              style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}
                              title="Configurado desde el canal dibujado en el plano"
                            >
                              {c.longitud || '—'}
                            </span>
                          ) : (
                            <CanalDimField
                              id={c.id}
                              field="longitud"
                              value={c.longitud ?? 0}
                              onChange={updCanalLL}
                              disabled={!edit}
                            />
                          )}
                        </td>
                        <td className="c">
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>
                            {BORDE_LIBRE_CANAL_CM}
                          </span>
                        </td>
                        <td
                          className="c"
                          style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 10.5 }}
                        >
                          {totalStr}
                        </td>
                        <td
                          className="c"
                          style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 10.5 }}
                        >
                          {Qmax > 0 ? trunc2(Qmax) : '—'}
                        </td>
                        <td className="c" style={{ fontSize: 10.5 }}>
                          {renderStatus(chequeo)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
