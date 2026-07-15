import { useRef, useState } from 'react';
import { parseCantidad } from '../excelImport';
import { showToast } from '../shared/Toast';
import { autoDetectarFilaInicio, detectarFilaCapitulo, type ColumnMapping } from './formularioImport';
import type { Presupuesto, PresupuestoItem } from '../types';

interface Props {
  pres: Presupuesto;
  onUpdate: (patch: Partial<Presupuesto>) => void;
}

const DEFAULT_MAPPING: ColumnMapping = { col_item: 0, col_descripcion: 1, col_unidad: 2, col_cantidad: 3 };

export function FormularioImportPanel({ pres, onUpdate }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rawRows, setRawRows] = useState<(string | number)[][] | null>(null);
  const [startRow, setStartRow] = useState(3);
  const [mapping, setMapping] = useState<ColumnMapping>(DEFAULT_MAPPING);

  async function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.xlsx?$/i)) {
      showToast('Solo se permiten archivos .xlsx o .xls', { type: 'err' });
      e.target.value = '';
      return;
    }
    const XLSX = await import('xlsx-js-style');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '', blankrows: false });
    setRawRows(json);
    setStartRow(autoDetectarFilaInicio(json));
    e.target.value = '';
  }

  function buildPreview(): { item: PresupuestoItem; esCap: boolean }[] {
    if (!rawRows) return [];
    return rawRows.slice(startRow).map((fila, i) => {
      const esCap = detectarFilaCapitulo(fila, mapping);
      const item: PresupuestoItem = {
        id: crypto.randomUUID(),
        num_item: String(fila[mapping.col_item] ?? i + 1),
        capitulo: '',
        descripcion: String(fila[mapping.col_descripcion] ?? ''),
        unidad: String(fila[mapping.col_unidad] ?? ''),
        cantidad: parseCantidad(fila[mapping.col_cantidad]),
        apu_id: '',
        tiene_apu: false,
        alerta_sin_apu: !esCap,
        es_capitulo: esCap,
        es_capitulo_manual: null,
      };
      return { item, esCap };
    }).filter(({ item }) => item.descripcion.trim() !== '');
  }

  const preview = rawRows ? buildPreview() : [];

  function confirmarImport() {
    if (preview.length === 0) return;
    onUpdate({ items: [...pres.items, ...preview.map(p => p.item)] });
    showToast(`${preview.length} filas importadas`, { type: 'ok', dur: 3000 });
    setRawRows(null);
  }

  return (
    <div className="cm-xl-wrap" style={{ padding: 14 }}>
      <p style={{ fontSize: 11, color: 'var(--txt2)', marginBottom: 10 }}>
        Importa un formulario de presupuesto existente en Excel. Detecta automáticamente la fila de inicio de datos y las filas de capítulo.
      </p>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={onFileSelect} aria-hidden="true" />
      <button type="button" className="cm-btn cm-btn-ac" onClick={() => fileRef.current?.click()}>Seleccionar archivo Excel</button>

      {rawRows && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            <label style={{ fontSize: 11 }}>
              Fila de inicio: <input className="cm-ni" style={{ width: 60 }} type="number" min={0} value={startRow} onChange={e => setStartRow(Number(e.target.value) || 0)} />
            </label>
            <label style={{ fontSize: 11 }}>
              Col. Ítem: <input className="cm-ni" style={{ width: 50 }} type="number" min={0} value={mapping.col_item} onChange={e => setMapping({ ...mapping, col_item: Number(e.target.value) || 0 })} />
            </label>
            <label style={{ fontSize: 11 }}>
              Col. Descripción: <input className="cm-ni" style={{ width: 50 }} type="number" min={0} value={mapping.col_descripcion} onChange={e => setMapping({ ...mapping, col_descripcion: Number(e.target.value) || 0 })} />
            </label>
            <label style={{ fontSize: 11 }}>
              Col. Unidad: <input className="cm-ni" style={{ width: 50 }} type="number" min={0} value={mapping.col_unidad} onChange={e => setMapping({ ...mapping, col_unidad: Number(e.target.value) || 0 })} />
            </label>
            <label style={{ fontSize: 11 }}>
              Col. Cantidad: <input className="cm-ni" style={{ width: 50 }} type="number" min={0} value={mapping.col_cantidad} onChange={e => setMapping({ ...mapping, col_cantidad: Number(e.target.value) || 0 })} />
            </label>
          </div>

          <div className="cm-modal-scroll" style={{ maxHeight: 320, border: '1px solid var(--line)', borderRadius: 'var(--r)' }}>
            <table className="cm-tbl">
              <thead>
                <tr><th>#</th><th>Ítem</th><th>Descripción</th><th>Unidad</th><th>Cantidad</th><th>Capítulo</th></tr>
              </thead>
              <tbody>
                {preview.map(({ item, esCap }, i) => (
                  <tr key={item.id} style={esCap ? { fontWeight: 700, background: 'var(--bg3)' } : undefined}>
                    <td>{i + 1}</td>
                    <td>{item.num_item}</td>
                    <td>{item.descripcion}</td>
                    <td>{item.unidad}</td>
                    <td>{item.cantidad}</td>
                    <td>{esCap ? 'Sí' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <button type="button" className="cm-btn cm-btn-ok" onClick={confirmarImport}>Importar {preview.length} filas</button>
            <button type="button" className="cm-btn" onClick={() => setRawRows(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
