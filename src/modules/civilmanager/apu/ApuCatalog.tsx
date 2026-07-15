import { useMemo, useState } from 'react';
import { useCivilManager } from '../context';
import { fmt } from '../calc';
import { genCodeFor } from '../codeGen';
import { askConfirm } from '../shared/ConfirmDialog';
import { showToast } from '../shared/Toast';
import { CrudFooter } from '../shared/CrudFooter';
import { ActionIcon } from '../shared/icons';
import { XlAct, XlRowNum, XlScroll, XlWrap } from '../shared/XlTable';
import { ApuEditor } from './ApuEditor';
import { exportApuExcel, exportApuPdf } from './apuExport';
import type { Apu } from '../types';

export function ApuCatalog() {
  const { state, patch, cargosCalc, esHora, apuCalcMap, apusBasicoCalc } = useCivilManager();
  const [selId, setSelId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return state.apus;
    const s = search.toLowerCase();
    return state.apus.filter(a => a.codigo.toLowerCase().includes(s) || a.nombre.toLowerCase().includes(s) || a.categoria.toLowerCase().includes(s));
  }, [state.apus, search]);

  const sel = selId ? state.apus.find(a => a.id === selId) ?? null : null;

  function addApu() {
    const nuevo: Apu = {
      id: crypto.randomUUID(),
      codigo: genCodeFor(state.apus, 'APU'),
      nombre: 'Nuevo APU',
      categoria: state.categorias_apu[0]?.categoria ?? '',
      unidad: state.config_listas.unidades[0]?.abreviatura ?? 'un',
      fecha_creacion: new Date().toISOString().slice(0, 10),
      es_basico: false,
      recursos_mo: [],
      recursos_eq: [],
      recursos_ins: [],
      recursos_transporte: [],
    };
    patch({ apus: [...state.apus, nuevo] });
    setSelId(nuevo.id);
  }

  function updateApu(id: string, p: Partial<Apu>) {
    patch({ apus: state.apus.map(a => (a.id === id ? { ...a, ...p } : a)) });
  }

  async function delApu(id: string) {
    const usadoEnPresupuestos = state.presupuestos.some(p => p.items.some(it => it.apu_id === id));
    const usadoComoBasico = state.insumos.some(x => x.apu_basico_id === id);
    if (usadoEnPresupuestos || usadoComoBasico) {
      showToast('No se puede eliminar: el APU está referenciado en presupuestos o insumos', { type: 'err' });
      return;
    }
    if (!(await askConfirm('¿Eliminar este APU?'))) return;
    patch({ apus: state.apus.filter(a => a.id !== id) });
    if (selId === id) setSelId(null);
  }

  function exportCtx() {
    return {
      cargosCalc,
      equipos: state.equipos,
      insumos: state.insumos,
      usarFP: state.config.usar_fp_en_apu,
      esHora,
      apuCalcMap,
      abMap: new Map(apusBasicoCalc.map(a => [a.id, a])),
    };
  }

  return (
    <div>
      <XlWrap>
        <XlScroll>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Código</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Unidad</th>
                <th>Costo Unitario</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={7} className="cm-empty-row">Sin APU</td></tr>}
              {filtered.map((a, i) => (
                <tr key={a.id} style={{ background: selId === a.id ? 'rgba(37,99,235,.1)' : undefined, cursor: 'pointer' }} onClick={() => setSelId(a.id)}>
                  <XlRowNum n={i + 1} />
                  <td>{a.codigo}</td>
                  <td>{a.nombre}</td>
                  <td>{a.categoria}</td>
                  <td>{a.unidad}</td>
                  <td>{fmt(apuCalcMap.get(a.id)?.totalDirecto ?? 0)}</td>
                  <XlAct onEdit={() => setSelId(a.id)} onDelete={() => delApu(a.id)} />
                </tr>
              ))}
            </tbody>
          </table>
        </XlScroll>
        <CrudFooter onAdd={addApu} addLabel="Nuevo APU" search={{ value: search, onChange: setSearch, placeholder: 'Buscar…' }} countLabel="Total:" count={filtered.length} />
      </XlWrap>

      {sel && (
        <div>
          <div style={{ display: 'flex', gap: 8, margin: '10px 0' }}>
            <button type="button" className="cm-btn cm-btn-warn" onClick={() => exportApuExcel(sel, exportCtx())}>
              <ActionIcon name="download" label="" /> Exportar Excel
            </button>
            <button type="button" className="cm-btn cm-btn-warn" onClick={() => exportApuPdf(sel, exportCtx())}>
              <ActionIcon name="picture_as_pdf" label="" /> Exportar PDF
            </button>
          </div>
          <ApuEditor apu={sel} onUpdate={p => updateApu(sel.id, p)} />
        </div>
      )}
    </div>
  );
}
