import { useCivilManager } from '../context';
import { NumInput } from '../shared/NumInput';
import { XlRowNum, XlScroll, XlWrap } from '../shared/XlTable';
import { DimEnLectura, TableHeader } from '../shared/EditLock';
import { useEditable } from '../shared/EditLock';
import type { PerfilPais } from '../types';

export function PerfilPaisPanel() {
  const { state, patch } = useCivilManager();
  const editable = useEditable();
  const items = state.config_listas.perfiles_pais;

  function upd(i: number, k: keyof PerfilPais, v: string | number) {
    const n = [...items];
    n[i] = { ...n[i], [k]: v };
    patch({ config_listas: { ...state.config_listas, perfiles_pais: n } });
  }

  return (
    <XlWrap>
      <TableHeader title="Perfiles de país" icon="perfiles_de_pais" />
      <DimEnLectura>
        <XlScroll>
          <fieldset disabled={!editable} style={{ margin: 0, padding: 0, border: 0, minWidth: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th title="Código ISO del país (CO, PA…).">Código</th>
                  <th title="Nombre del país.">País</th>
                  <th title="Moneda oficial para mostrar valores.">Moneda</th>
                  <th title="Salario mínimo mensual legal vigente.">SMMLV</th>
                  <th title="Auxilio de transporte legal mensual.">Aux. Transporte</th>
                  <th title="Días laborales por mes; divide el salario en jornales.">Días/mes</th>
                  <th title="Horas laborales por mes; base del costo hora.">Horas/mes</th>
                  <th title="Si el salario se define por mes o por hora (jornal).">
                    Unidad Salario
                  </th>
                  <th title="País en uso; Usar cambia salario, moneda y jornadas de todo el módulo.">
                    Activo
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((p, i) => {
                  const activo = p.codigo === state.config.pais;
                  return (
                    <tr
                      key={p.codigo}
                      style={{ background: activo ? 'rgba(37,99,235,.1)' : undefined }}
                    >
                      <XlRowNum n={i + 1} />
                      <td>{p.codigo}</td>
                      <td>{p.nombre}</td>
                      <td>{p.moneda}</td>
                      <td>
                        <NumInput
                          value={p.smmlv}
                          format
                          moneda
                          onChange={(v) => upd(i, 'smmlv', v)}
                        />
                      </td>
                      <td>
                        <NumInput
                          value={p.auxilio_transporte}
                          format
                          moneda
                          onChange={(v) => upd(i, 'auxilio_transporte', v)}
                        />
                      </td>
                      <td>
                        <NumInput
                          value={p.dias_mes}
                          decimals={0}
                          onChange={(v) => upd(i, 'dias_mes', v)}
                        />
                      </td>
                      <td>
                        <NumInput
                          value={p.horas_mes}
                          decimals={0}
                          onChange={(v) => upd(i, 'horas_mes', v)}
                        />
                      </td>
                      <td>
                        <select
                          className="cm-sel"
                          aria-label="Unidad"
                          value={p.unidad}
                          onChange={(e) => upd(i, 'unidad', e.target.value)}
                        >
                          <option value="mes">Mes</option>
                          <option value="hora">Hora</option>
                        </select>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className={`cm-btn ${activo ? 'cm-btn-primary' : ''}`}
                          onClick={() =>
                            patch({
                              config: {
                                ...state.config,
                                pais: p.codigo,
                                salario_base: p.smmlv,
                                auxilio_transporte: p.auxilio_transporte,
                                dias_mes: p.dias_mes,
                                horas_mes: p.horas_mes,
                                unidad: p.unidad,
                              },
                            })
                          }
                        >
                          {activo ? 'Activo' : 'Usar'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </fieldset>
        </XlScroll>
      </DimEnLectura>
    </XlWrap>
  );
}
