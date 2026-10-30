import { useMemo } from 'react';
import { useCivilManager } from '../context.tsx';
import { genCodeFor } from '../codeGen.ts';
import { fmtMoneda } from '../calc.ts';
import { fmtDate, isCotOld } from '../excelImport.tsx';
import { CrudFooter } from '../shared/CrudFooter.tsx';
import { ExcelPreviewModal } from '../shared/ExcelPreviewModal.tsx';
import { NumInput } from '../shared/NumInput.tsx';
import { useCrudTable } from '../shared/useCrudTable.ts';
import { DimEnLectura, EditableSection, TableHeader } from '../shared/EditLock.tsx';

import { useReferentialDelete } from '../shared/useReferentialDelete.ts';
import { XlAct, XlRowNum, XlScroll, XlWrap } from '../shared/XlTable.tsx';
import type { Equipo } from '../types.ts';

/** Tab de equipos (máquinas con costo_hora): edita precio y proveedor, y marca en rojo la fecha de cotización con más de 180 días (isCotOld). */
export function EquiposTab() {
  const { state, patch } = useCivilManager();

  const countUsage = useMemo(() => {
    return (id: string) =>
      state.apus.reduce(
        (n, a) =>
          n +
          a.recursos_eq.filter((r) => r.equipo_id === id).length +
          a.recursos_transporte.filter((r) => r.equipo_id === id).length,
        0,
      );
  }, [state.apus]);
  const tryDelete = useReferentialDelete(countUsage, 'APU(s)');

  const { filtered, editIdx, setEditIdx, search, setSearch, upd, add, handleKeyDown, excel } =
    useCrudTable<Equipo>({
      items: state.equipos,
      onChange: (equipos) => patch({ equipos }),
      prefix: 'EQ',
      defaultItem: () => ({
        id: crypto.randomUUID(),
        codigo: genCodeFor(state.equipos, 'EQ'),
        nombre: 'Nuevo equipo',
        tipo: state.config_listas.tipos_equipo[0]?.nombre ?? '',
        unidad: 'hr',
        costo_hora: 0,
        fecha_cotizacion: '',
        proveedor_id: '',
      }),
      searchKeys: ['codigo', 'nombre', 'tipo'],
      confirmDel: '¿Eliminar este equipo?',
      excelConfig: {
        title: 'Equipos',
        sheetName: 'Equipos',
        filename: 'equipos_civilmanager.xlsx',
        headers: ['Código', 'Nombre', 'Tipo', 'Costo/Hora', 'Fecha Cotización'],
        colWidths: [{ wch: 12 }, { wch: 32 }, { wch: 20 }, { wch: 14 }, { wch: 16 }],
        mapRow: (e) => [e.codigo, e.nombre, e.tipo, e.costo_hora, e.fecha_cotizacion],
        parseRow: (row) => row,
        buildItem: (row, idx, existing, nextCode) => ({
          id: idx >= 0 ? existing[idx].id : crypto.randomUUID(),
          codigo: String(row[0] || nextCode()),
          nombre: String(row[1] || ''),
          tipo: String(row[2] || ''),
          unidad: 'hr',
          costo_hora: Number(row[3]) || 0,
          fecha_cotizacion: String(row[4] || ''),
          proveedor_id: idx >= 0 ? existing[idx].proveedor_id : '',
        }),
      },
    });

  function del(i: number) {
    const item = filtered[i];
    const realIdx = state.equipos.findIndex((e) => e.id === item.id);
    tryDelete(
      item.id,
      () => patch({ equipos: state.equipos.filter((_, j) => j !== realIdx) }),
      '¿Eliminar este equipo?',
    );
  }

  return (
    <EditableSection dim={false}>
      <XlWrap>
        <TableHeader title="Equipos" icon="equipos_tabla" />
        <DimEnLectura>
          <XlScroll>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th title="Código único del equipo (EQ-xxx), generado automáticamente.">
                    Código
                  </th>
                  <th title="Nombre descriptivo del equipo.">Nombre</th>
                  <th title="Clasificación: maquinaria pesada, equipo menor, transporte… (lista editable en Configuración).">
                    Tipo
                  </th>
                  <th title="Tarifa por hora que el APU multiplica por el rendimiento del equipo.">
                    Costo/Hora
                  </th>
                  <th title="Fecha de la última cotización; se resalta cuando está desactualizada.">
                    Cotizado
                  </th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="cm-empty-row">
                      Sin equipos
                    </td>
                  </tr>
                )}
                {filtered.map((e, i) => {
                  const editing = editIdx === i;
                  const old = isCotOld(e.fecha_cotizacion);
                  return (
                    <tr key={e.id}>
                      <XlRowNum n={i + 1} />
                      <td>{e.codigo}</td>
                      <td>
                        {editing ? (
                          <input
                            className="cm-ni"
                            aria-label="Nombre"
                            value={e.nombre}
                            onChange={(ev) => upd(e.id, 'nombre', ev.target.value)}
                            onKeyDown={(ev) => handleKeyDown(i, ev)}
                          />
                        ) : (
                          <span onDoubleClick={() => setEditIdx(i)}>{e.nombre}</span>
                        )}
                      </td>
                      <td>
                        {editing ? (
                          <select
                            className="cm-sel"
                            aria-label="Tipo"
                            value={e.tipo}
                            onChange={(ev) => upd(e.id, 'tipo', ev.target.value)}
                          >
                            {state.config_listas.tipos_equipo.map((t) => (
                              <option key={t.codigo} value={t.nombre}>
                                {t.nombre}
                              </option>
                            ))}
                          </select>
                        ) : (
                          e.tipo
                        )}
                      </td>
                      <td>
                        {editing ? (
                          <NumInput
                            value={e.costo_hora}
                            format
                            moneda
                            onChange={(v) => upd(e.id, 'costo_hora', v)}
                          />
                        ) : (
                          <span onDoubleClick={() => setEditIdx(i)}>{fmtMoneda(e.costo_hora)}</span>
                        )}
                      </td>
                      <td style={{ color: old ? 'var(--warn)' : undefined }}>
                        {fmtDate(e.fecha_cotizacion)}
                      </td>
                      <XlAct onDelete={() => del(i)} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </XlScroll>
          <CrudFooter
            onAdd={add}
            addLabel="Nuevo Equipo"
            excel={excel}
            exportLabel="Exportar"
            search={{ value: search, onChange: setSearch, placeholder: 'Buscar…' }}
            countLabel="Total:"
            count={filtered.length}
          />
        </DimEnLectura>
      </XlWrap>
      <ExcelPreviewModal excel={excel} />
    </EditableSection>
  );
}
