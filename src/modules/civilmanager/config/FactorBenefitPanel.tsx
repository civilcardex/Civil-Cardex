import { useState } from 'react';
import { useCivilManager } from '../context';
import { genCodeFor } from '../codeGen';
import { askConfirm } from '../shared/ConfirmDialog';
import { NumInput } from '../shared/NumInput';
import { XlAct, XlRowNum, XlScroll, XlWrap } from '../shared/XlTable';
import { DimEnLectura, EditableSection, TableHeader, useEditable } from '../shared/EditLock';
import { FP_CAT_DESC_DEFAULTS } from '../seedData';
import type { FactorPrestacional } from '../types';

const TIPOS: FactorPrestacional['tipo'][] = [
  'prestaciones',
  'seguridad_social',
  'parafiscales',
  'otros',
];
const ICONO_POR_TIPO: Record<string, string> = {
  prestaciones: 'prestaciones_sociales',
  seguridad_social: 'seguridad_social',
  parafiscales: 'parafiscales',
  otros: 'otros',
};

const TIPO_LABEL: Record<FactorPrestacional['tipo'], string> = {
  prestaciones: 'Prestaciones sociales',
  seguridad_social: 'Seguridad social',
  parafiscales: 'Parafiscales',
  otros: 'Otros',
};

interface TipoProps {
  tipo: FactorPrestacional['tipo'];
  grupo: Array<{ f: FactorPrestacional; i: number }>;
  subtotal: number;
  add: () => void;
  upd: (i: number, k: keyof FactorPrestacional, v: string | number) => void;
  del: (i: number) => void;
}

/** Una tabla por tipo — cada una con SU propio estado de edición (no global, orig. usuario). */
function FactorTipoTabla(props: TipoProps) {
  return (
    <EditableSection dim={false}>
      {/*
        El cuerpo va en componente hijo: useEditable() en este body resolvería el provider
        EXTERIOR (ConfigTab), no el interno que aquí se renderiza.
      */}
      <FactorTipoCuerpo {...props} />
    </EditableSection>
  );
}

function FactorTipoCuerpo({ tipo, grupo, subtotal, add, upd, del }: TipoProps) {
  const [editIdx, setEditIdxState] = useState<number | null>(null);
  const editable = useEditable();
  const setEditIdx = (i: number | null) => setEditIdxState(editable ? i : null);

  return (
    <XlWrap>
      <TableHeader
        title={TIPO_LABEL[tipo] + ' — ' + FP_CAT_DESC_DEFAULTS[tipo]}
        icon={ICONO_POR_TIPO[tipo]}
      />
      <DimEnLectura>
        <XlScroll>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th title="Código del factor (FP-xxx).">Código</th>
                <th title="Nombre del factor (cesantías, vacaciones, aportes…).">Nombre</th>
                <th title="Porcentaje que se suma al jornal; el subtotal de cada tipo aparece al pie.">
                  Factor %
                </th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {grupo.length === 0 && (
                <tr>
                  <td colSpan={5} className="cm-empty-row">
                    Sin registros
                  </td>
                </tr>
              )}
              {grupo.map(({ f, i }, gi) => {
                const editing = editIdx === i;
                return (
                  <tr key={f.id}>
                    <XlRowNum n={gi + 1} />
                    <td>{f.codigo}</td>
                    <td>
                      {editing ? (
                        <input
                          className="cm-ni"
                          aria-label="Nombre"
                          value={f.nombre}
                          onChange={(e) => upd(i, 'nombre', e.target.value)}
                        />
                      ) : (
                        <span onDoubleClick={() => setEditIdx(i)}>{f.nombre}</span>
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <NumInput
                          value={f.factor}
                          decimals={2}
                          onChange={(v) => upd(i, 'factor', v)}
                        />
                      ) : (
                        <span onDoubleClick={() => setEditIdx(i)}>
                          {Number(f.factor).toFixed(2)}%
                        </span>
                      )}
                    </td>
                    <XlAct onDelete={() => del(i)} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </XlScroll>
      </DimEnLectura>
      <div className="cm-xl-foot">
        {editable && (
          <button type="button" className="cm-btn cm-btn-ok" onClick={add}>
            Agregar
          </button>
        )}
        <span className="cm-flex-1" />
        <span style={{ fontSize: 11 }}>
          Subtotal: <b>{subtotal.toFixed(2)}%</b>
        </span>
      </div>
    </XlWrap>
  );
}

export function FactorPrestacionalPanel() {
  const { state, patch, factorPrest } = useCivilManager();
  const items = state.factoresPrestaciones;

  function setItems(next: FactorPrestacional[]) {
    patch({ factoresPrestaciones: next });
  }

  function add(tipo: FactorPrestacional['tipo']) {
    const nuevo: FactorPrestacional = {
      id: crypto.randomUUID(),
      codigo: genCodeFor(items, 'FP'),
      nombre: 'Nuevo factor',
      factor: 0,
      tipo,
    };
    setItems([...items, nuevo]);
  }

  function upd(i: number, k: keyof FactorPrestacional, v: string | number) {
    const n = [...items];
    n[i] = { ...n[i], [k]: v };
    setItems(n);
  }

  async function del(i: number) {
    if (!(await askConfirm(`¿Eliminar "${items[i].nombre}"?`))) return;
    setItems(items.filter((_, j) => j !== i));
  }

  return (
    <div>
      {TIPOS.map((tipo) => {
        const grupo = items.map((f, i) => ({ f, i })).filter(({ f }) => f.tipo === tipo);
        const subtotal = grupo.reduce((s, { f }) => s + (Number(f.factor) || 0), 0);
        return (
          <FactorTipoTabla
            key={tipo}
            tipo={tipo}
            grupo={grupo}
            subtotal={subtotal}
            add={() => add(tipo)}
            upd={upd}
            del={del}
          />
        );
      })}
      <div style={{ fontSize: 13, fontWeight: 700, padding: '8px 4px' }}>
        Factor prestacional total:{' '}
        <span style={{ color: 'var(--acc)' }}>{factorPrest.toFixed(2)}%</span>
      </div>
    </div>
  );
}
