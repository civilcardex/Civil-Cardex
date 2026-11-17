import { useCivilManager } from '../context.tsx';
import { NumInput } from '../shared/NumInput.tsx';
import { XlRowNum, XlScroll, XlWrap } from '../shared/XlTable.tsx';
import { DimEnLectura, TableHeader } from '../shared/EditLock.tsx';
import { useEditable } from '../shared/EditLock.tsx';
import { showToast } from '../shared/Toast.tsx';
import { FP_POR_PAIS, perfilesPaisDefault } from '../seedData.ts';
import type { CivilManagerState, FactorPrestacional, PerfilPais } from '../types.ts';

/** ¿El usuario EDITÓ a mano sus FP (Factores Prestacionales)? Compara contra TODAS las semillas por país: si matchea alguna, son semilla (sin editar); si no, son suyos. */
function fpEditados(state: CivilManagerState): boolean {
  const actual = state.factoresPrestaciones
    .map((f) => `${f.codigo}|${f.nombre}|${f.factor}|${f.tipo}`)
    .sort()
    .join('||');
  const semillas = Object.values(FP_POR_PAIS).map((lista) =>
    lista
      .map((f) => `${f.codigo}|${f.nombre}|${f.factor}|${f.tipo}`)
      .sort()
      .join('||'),
  );
  return !semillas.includes(actual);
}

/** Reemplaza los FP por los semilla del país (ids nuevos, igual que en el arranque). */
function fpDePais(codigo: string): FactorPrestacional[] {
  return (FP_POR_PAIS[codigo] ?? FP_POR_PAIS.CO).map((f) => ({ ...f, id: crypto.randomUUID() }));
}

/** Panel de perfiles por país: salario mínimo, IVA, moneda, días/horas del mes y si se cotiza por hora. Ej: Colombia mes/30 días; jornal sobre 25 días. "Usar" copia salario/moneda/jornadas/IVA y, si los FP siguen semilla (sin editar a mano), siembra los FP del país. */
export function PerfilPaisPanel() {
  const { state, patch } = useCivilManager();
  const editable = useEditable();
  const items = state.config_listas.perfiles_pais;
  // Vista alfabética; conserva el índice real para upd(i) sobre el estado sin ordenar.
  const vista = items
    .map((p, i) => ({ p, i }))
    .sort((a, b) => a.p.nombre.localeCompare(b.p.nombre, 'es'));

  function upd(i: number, k: keyof PerfilPais, v: string | number) {
    const n = [...items];
    n[i] = { ...n[i], [k]: v };
    patch({ config_listas: { ...state.config_listas, perfiles_pais: n } });
  }

  function usar(p: PerfilPais) {
    const editados = fpEditados(state);
    patch({
      config: {
        ...state.config,
        pais: p.codigo,
        salario_base: p.smmlv,
        moneda: p.moneda,
        iva_pct: p.iva_pct,
        dias_mes: p.dias_mes,
        horas_mes: p.horas_mes,
        unidad: p.unidad,
      },
      // FP sin editar a mano → semilla del país nuevo; editados → conservados con aviso.
      ...(editados ? {} : { factoresPrestaciones: fpDePais(p.codigo) }),
    });
    if (editados) {
      showToast('FP actuales conservados (editados a mano)');
    }
  }

  return (
    <XlWrap>
      <TableHeader title="Perfiles de país" icon="perfiles_de_pais" />
      <DimEnLectura>
        <XlScroll>
          <fieldset disabled={!editable} className="cm-fieldset-flush">
            <table>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col" title="Código ISO del país (CO, PE…).">
                    Código
                  </th>
                  <th scope="col" title="Nombre del país.">
                    País
                  </th>
                  <th scope="col" title="Moneda oficial para mostrar valores.">
                    Moneda
                  </th>
                  <th scope="col" title="Salario mínimo mensual legal vigente (año de referencia).">
                    SMMLV
                  </th>
                  <th
                    scope="col"
                    title="Tasa general del impuesto al valor agregado (IVA/IGV) del país."
                  >
                    IVA %
                  </th>
                  <th scope="col" title="Días laborales por mes; divide el salario en jornales.">
                    Días/mes
                  </th>
                  <th scope="col" title="Horas laborales por mes; base del costo hora.">
                    Horas/mes
                  </th>
                  <th scope="col" title="Si el salario se define por mes o por hora (jornal).">
                    Unidad salario
                  </th>
                  <th
                    scope="col"
                    title="País en uso; Usar cambia salario, moneda, IVA y jornadas de todo el módulo (y siembra los FP del país si no los editaste a mano)."
                  >
                    Activo
                  </th>
                </tr>
              </thead>
              <tbody>
                {vista.map(({ p, i }, d) => {
                  const activo = p.codigo === state.config.pais;
                  return (
                    <tr key={p.codigo} className={activo ? 'cm-row-activo' : undefined}>
                      {/* # consecutivo en la VISTA (alfabética); el índice real (i) es solo
                          para upd() sobre el estado sin ordenar. */}
                      <XlRowNum n={d + 1} />
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
                          value={p.iva_pct}
                          decimals={0}
                          onChange={(v) => upd(i, 'iva_pct', v)}
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
                      <td className="cm-td-center">
                        <select
                          className="cm-sel cm-sel-center"
                          aria-label="Unidad"
                          value={p.unidad}
                          onChange={(e) => upd(i, 'unidad', e.target.value as 'mes' | 'hora')}
                        >
                          <option value="mes">Mes</option>
                          <option value="hora">Hora</option>
                        </select>
                      </td>
                      <td className="cm-td-center">
                        <button
                          type="button"
                          className={`cm-btn ${activo ? 'cm-btn-primary' : ''}`}
                          onClick={() => usar(p)}
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
      <p className="cm-txt2 cm-field-help">
        Vigencia de los valores semilla: {perfilesPaisDefault()[0]?.vigencia ?? '—'} — salarios
        mínimos e IVA se actualizan cada año; edita la fila si tu año fiscal trae nuevos valores.
      </p>
    </XlWrap>
  );
}
