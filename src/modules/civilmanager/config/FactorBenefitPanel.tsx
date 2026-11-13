import { useState } from 'react';
import { useCivilManager } from '../context.tsx';
import { genCodeFor } from '../codeGen.ts';
import { askConfirm } from '../shared/ConfirmDialog.tsx';
import { NumInput } from '../shared/NumInput.tsx';
import { EditableCell } from '../shared/EditableCell.tsx';
import { handleTabKeyDown } from '../shared/useCrudTable.ts';
import { XlAct, XlRowNum, XlScroll, XlWrap } from '../shared/XlTable.tsx';
import { DimEnLectura, EditableSection, TableHeader, useEditable } from '../shared/EditLock.tsx';
import { FP_CAT_DESC_DEFAULTS } from '../seedData.ts';
import type { FactorPrestacional } from '../types.ts';

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

/** Una tabla por tipo — cada una con SU propio estado de edición (no global, pedido del cliente). */
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
  const handleKeyDown = handleTabKeyDown(setEditIdx);

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
                <th scope="col">#</th>
                <th scope="col" title="Código del factor (FP-xxx).">
                  Código
                </th>
                <th scope="col" title="Nombre del factor (cesantías, vacaciones, aportes…).">
                  Nombre
                </th>
                <th
                  scope="col"
                  title="Porcentaje que se suma al jornal; el subtotal de cada tipo aparece al pie."
                >
                  Factor %
                </th>
                <th scope="col" aria-label="Acciones" />
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
                return (
                  <tr key={f.id}>
                    <XlRowNum n={gi + 1} />
                    <td>{f.codigo}</td>
                    <td>
                      <EditableCell
                        editing={editIdx === i}
                        value={f.nombre}
                        onCommit={(v) => upd(i, 'nombre', v)}
                        onOpenEdit={() => setEditIdx(i)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        title="Nombre"
                      />
                    </td>
                    <td>
                      {/* Escape hatch: NumInput con decimals=2 y lectura con '%' — combo que EditableCell no cubre con 'numero'. */}
                      {editIdx === i ? (
                        <NumInput
                          value={f.factor}
                          decimals={2}
                          onChange={(v) => upd(i, 'factor', v)}
                          onKeyDown={(e) => handleKeyDown(i, e)}
                          aria-label="Factor %"
                          title="Factor %"
                        />
                      ) : (
                        <span onDoubleClick={() => setEditIdx(i)} title="Factor %">
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
        <span className="cm-label-11">
          Subtotal: <b>{subtotal.toFixed(2)}%</b>
        </span>
      </div>
    </XlWrap>
  );
}

/** Panel de FP (Factores Prestacionales): % que el empleador paga además del salario (prestaciones, seguridad social, parafiscales) con el subtotal al pie. Ej: 15 filas que suman ≈ 79 %. */
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
      <div className="cm-factor-total">
        Factor prestacional total: <span className="cm-acc">{factorPrest.toFixed(2)}%</span>
      </div>
    </div>
  );
}
