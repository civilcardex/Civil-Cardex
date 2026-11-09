/** Catálogo de accesorios especiales de la pestaña ENTRADAS RCI (extraído de RCIInputs por el
 *  guard de líneas): filas con código/nombre/modo/valor editables, alta y borrado. Estado local
 *  (edit); estado y editar llegan por props.
 *  Ej: 'VA' (válvula de alarma) con modo LD y valor 50 aparece en el panel de accesorios. */
import { EditTablaBtn, useEditarTabla } from './RCIUI.tsx';
import { celdaEditable } from './RCIEditableCell.tsx';
import { BTN, INC, NOTAC, TDCC, TH10C, type EditarRci } from './RCICmatTable.tsx';
import type { EspAcc } from '../../lib/rci/tables.ts';
import type { RciState } from '../../lib/rci/types.ts';
/* ---------------- Catálogo de accesorios especiales ---------------- */

/** Modos de pérdida de un accesorio especial (select del HTML). */
const MODOS_ESP: [string, string][] = [
  ['LD', 'L/D (× Ø interior)'],
  ['Leq', 'Leq fija (m)'],
  ['dp', 'Δp (psi) a Q ref.'],
];

/** Catálogo de accesorios especiales (st.esp): el código aparece en el panel de accesorios de
 *  cada ramal/tramo. Ej: 'VA' (válvula de alarma) con modo LD y valor 50. */
function TablaEsp({ estado, editar }: { estado: RciState; editar: EditarRci }) {
  const [edit, toggleEdit] = useEditarTabla();
  const esp = estado.esp || [];
  const setE =
    (i: number, k: keyof EspAcc, esNum = false) =>
    (v: string) =>
      editar((e) => ({
        ...e,
        esp: e.esp.map((r, j) => (j === i ? { ...r, [k]: esNum && v !== '' ? Number(v) : v } : r)),
      }));
  const del = (i: number) => editar((e) => ({ ...e, esp: e.esp.filter((_, j) => j !== i) }));
  const add = () =>
    editar((e) => ({
      ...e,
      esp: [...e.esp, { cod: '', nombre: '', modo: 'Leq', valor: '', qref: '' }],
    }));
  return (
    <section className="card" style={{ width: 'fit-content', maxWidth: '100%' }}>
      <div className="card-h" style={{ padding: '4px 10px' }}>
        <h3
          className="card-t"
          style={{
            fontSize: 15,
            color: 'var(--txt2)',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <img
            src="/iconos/accesorios_especiales.webp"
            alt=""
            style={{ width: 22, height: 22, objectFit: 'contain' }}
          />
          Catálogo de accesorios especiales
        </h3>
        <div style={{ marginLeft: 'auto' }}>
          <EditTablaBtn on={edit} onToggle={toggleEdit} />
        </div>
      </div>
      <div style={{ padding: 6 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH10C}>Código</th>
                <th style={TH10C}>Accesorio</th>
                <th style={TH10C}>Cómo se da la pérdida</th>
                <th style={TH10C}>Valor</th>
                <th style={TH10C}>Q ref. (gpm)</th>
                <th style={TH10C} />
              </tr>
            </thead>
            <tbody>
              {esp.map((a, i) => (
                <tr key={i}>
                  <td style={TDCC}>
                    {celdaEditable(
                      edit,
                      <input
                        type="text"
                        value={String(a.cod ?? '')}
                        aria-label={`Código del accesorio ${i + 1}`}
                        onChange={(e) => setE(i, 'cod')(e.target.value)}
                        style={{ ...INC, width: 54 }}
                      />,
                    )}
                  </td>
                  <td style={TDCC}>
                    {celdaEditable(
                      edit,
                      <input
                        type="text"
                        value={String(a.nombre ?? '')}
                        aria-label={`Nombre del accesorio ${i + 1}`}
                        onChange={(e) => setE(i, 'nombre')(e.target.value)}
                        style={{ ...INC, width: 230 }}
                      />,
                    )}
                  </td>
                  <td style={TDCC}>
                    {celdaEditable(
                      edit,
                      <select
                        value={a.modo}
                        aria-label={`Modo del accesorio ${i + 1}`}
                        onChange={(e) => setE(i, 'modo')(e.target.value)}
                        style={{ ...INC, width: 180 }}
                      >
                        {MODOS_ESP.map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>,
                    )}
                  </td>
                  <td style={TDCC}>
                    {celdaEditable(
                      edit,
                      <input
                        type="number"
                        step="any"
                        value={String(a.valor ?? '')}
                        aria-label={`Valor del accesorio ${i + 1}`}
                        onChange={(e) => setE(i, 'valor', true)(e.target.value)}
                        style={{ ...INC, width: 50, WebkitAppearance: 'textfield' }}
                      />,
                    )}
                  </td>
                  <td style={TDCC}>
                    {a.modo === 'dp' ? (
                      celdaEditable(
                        edit,
                        <input
                          type="number"
                          step="any"
                          value={String(a.qref ?? '')}
                          aria-label={`Caudal de referencia del accesorio ${i + 1}`}
                          onChange={(e) => setE(i, 'qref', true)(e.target.value)}
                          style={{ ...INC, width: 50, WebkitAppearance: 'textfield' }}
                        />,
                      )
                    ) : (
                      <span style={{ color: 'var(--txt3)' }}>—</span>
                    )}
                  </td>
                  <td style={TDCC}>
                    <button
                      type="button"
                      title="Eliminar"
                      aria-label={`Eliminar accesorio ${i + 1}`}
                      disabled={!edit}
                      onClick={() => del(i)}
                      style={{ ...BTN, padding: '0 6px' }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 4 }}>
          <button type="button" disabled={!edit} onClick={add} style={BTN}>
            + Añadir accesorio
          </button>
        </div>
        <p style={NOTAC}>
          L/D: la longitud equivalente es L/D × diámetro interior del tramo. Δp: pérdida del
          fabricante a un caudal de referencia, escalada con (Q/Qref)^1,85.
        </p>
      </div>
    </section>
  );
}
export { TablaEsp };
