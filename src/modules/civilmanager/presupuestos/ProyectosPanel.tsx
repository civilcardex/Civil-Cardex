import { useCivilManager } from '../context';
import { flattenPresupuestos, getTipoProyecto } from '../calc';
import { genCodeFor } from '../codeGen';
import { askConfirm } from '../shared/ConfirmDialog';
import { CrudFooter } from '../shared/CrudFooter';
import { XlAct, XlRowNum, XlScroll, XlWrap } from '../shared/XlTable';
import type { EstadoPresupuesto, Presupuesto } from '../types';

const ESTADO_LABEL: Record<EstadoPresupuesto, string> = { borrador: 'Borrador', en_revision: 'En Revisión', cerrado: 'Cerrado' };

interface Props {
  selId: string | null;
  onSelect: (id: string) => void;
}

export function ProyectosPanel({ selId, onSelect }: Props) {
  const { state, patch } = useCivilManager();
  const flat = flattenPresupuestos(state.presupuestos);

  function crear() {
    const nuevo: Presupuesto = {
      id: crypto.randomUUID(),
      codigo: genCodeFor(state.presupuestos, 'PPT'),
      nombre: 'Nuevo presupuesto',
      entidad: '',
      contrato: '',
      objeto: '',
      plazo: '',
      fecha_creacion: new Date().toISOString().slice(0, 10),
      ciudad: '',
      departamento: '',
      elaborado_por: '',
      activo: true,
      con_sub_proyectos: false,
      parent_id: null,
      estado: 'borrador',
      fecha_cierre: '',
      observaciones: '',
      items: [],
      aiu_override: { activo: false, pct_a: state.config.pct_administracion, pct_i: state.config.pct_imprevistos, pct_u: state.config.pct_utilidad, iva_pct: 19 },
      factores_snap: state.factoresPrestaciones,
      cargos_snap: state.cargos,
      apus_snap: state.apus,
    };
    patch({ presupuestos: [...state.presupuestos, nuevo] });
    onSelect(nuevo.id);
  }

  async function eliminar(id: string) {
    const tieneHijos = state.presupuestos.some(p => p.parent_id === id);
    if (tieneHijos) {
      if (!(await askConfirm('Este presupuesto tiene sub-proyectos. ¿Eliminar de todas formas? (los sub-proyectos quedarán huérfanos)'))) return;
    } else if (!(await askConfirm('¿Eliminar este presupuesto?'))) {
      return;
    }
    patch({ presupuestos: state.presupuestos.filter(p => p.id !== id) });
  }

  function upd(id: string, k: keyof Presupuesto, v: string | boolean) {
    patch({ presupuestos: state.presupuestos.map(p => (p.id === id ? { ...p, [k]: v } : p)) });
  }

  return (
    <XlWrap>
      <XlScroll>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Código</th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Ítems</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {flat.length === 0 && <tr><td colSpan={7} className="cm-empty-row">Sin presupuestos</td></tr>}
            {flat.map(({ pres, level }, i) => (
              <tr key={pres.id} style={{ background: selId === pres.id ? 'rgba(37,99,235,.1)' : undefined, cursor: 'pointer' }} onClick={() => onSelect(pres.id)}>
                <XlRowNum n={i + 1} />
                <td>{pres.codigo}</td>
                <td style={{ paddingLeft: level ? 24 : undefined }}>{level > 0 ? '↳ ' : ''}{pres.nombre}</td>
                <td>{getTipoProyecto(pres, state.presupuestos)}</td>
                <td>
                  <select className="cm-sel" value={pres.estado} onClick={e => e.stopPropagation()} onChange={e => upd(pres.id, 'estado', e.target.value)}>
                    {Object.entries(ESTADO_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </td>
                <td>{pres.items.length}</td>
                <XlAct onEdit={() => onSelect(pres.id)} onDelete={() => eliminar(pres.id)} />
              </tr>
            ))}
          </tbody>
        </table>
      </XlScroll>
      <CrudFooter onAdd={crear} addLabel="Nuevo Presupuesto" countLabel="Total:" count={state.presupuestos.length} />
    </XlWrap>
  );
}
