import { useCivilManager } from '../context';
import { NumInput } from '../shared/NumInput';
import { XlRowNum, XlScroll, XlWrap } from '../shared/XlTable';
import type { PerfilPais } from '../types';

export function PerfilPaisPanel() {
  const { state, patch } = useCivilManager();
  const items = state.config_listas.perfiles_pais;

  function upd(i: number, k: keyof PerfilPais, v: string | number) {
    const n = [...items];
    n[i] = { ...n[i], [k]: v };
    patch({ config_listas: { ...state.config_listas, perfiles_pais: n } });
  }

  return (
    <XlWrap>
      <div className="cm-modal-head">Perfiles de País</div>
      <XlScroll>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Código</th>
              <th>País</th>
              <th>Moneda</th>
              <th>SMMLV</th>
              <th>Aux. Transporte</th>
              <th>Días/mes</th>
              <th>Horas/mes</th>
              <th>Unidad Salario</th>
              <th>Activo</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p, i) => {
              const activo = p.codigo === state.config.pais;
              return (
                <tr key={p.codigo} style={{ background: activo ? 'rgba(37,99,235,.1)' : undefined }}>
                  <XlRowNum n={i + 1} />
                  <td>{p.codigo}</td>
                  <td>{p.nombre}</td>
                  <td>{p.moneda}</td>
                  <td><NumInput value={p.smmlv} format onChange={v => upd(i, 'smmlv', v)} /></td>
                  <td><NumInput value={p.auxilio_transporte} format onChange={v => upd(i, 'auxilio_transporte', v)} /></td>
                  <td><NumInput value={p.dias_mes} decimals={0} onChange={v => upd(i, 'dias_mes', v)} /></td>
                  <td><NumInput value={p.horas_mes} decimals={0} onChange={v => upd(i, 'horas_mes', v)} /></td>
                  <td>
                    <select className="cm-sel" aria-label="Unidad" value={p.unidad} onChange={e => upd(i, 'unidad', e.target.value)}>
                      <option value="mes">Mes</option>
                      <option value="hora">Hora</option>
                    </select>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className={`cm-btn ${activo ? 'cm-btn-primary' : ''}`}
                      onClick={() => patch({ config: { ...state.config, pais: p.codigo, moneda: p.moneda, salario_base: p.smmlv, auxilio_transporte: p.auxilio_transporte, dias_mes: p.dias_mes, horas_mes: p.horas_mes, unidad: p.unidad } })}
                    >
                      {activo ? 'Activo' : 'Usar'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </XlScroll>
    </XlWrap>
  );
}
