import { useMemo, useState } from 'react';
import { useCivilManager } from '../context.tsx';
import { calcItemValue, calcMapParaPres, esCapituloFinal, fmtMoneda } from '../calc.ts';
import { NumInput } from '../shared/NumInput.tsx';
import { ActionIcon } from '../shared/icons.tsx';
import { XlRowNum, XlScroll, XlWrap } from '../shared/XlTable.tsx';
import { DimEnLectura, TableHeader, useEditable } from '../shared/EditLock.tsx';
import PageNav from '../../civilflow/components/PageNav.tsx';
import type { Presupuesto, PresupuestoItem } from '../types.ts';

interface Props {
  pres: Presupuesto;
  onUpdate: (patch: Partial<Presupuesto>) => void;
}

/** Grilla de ítems del presupuesto: cantidad editable, asignación de APU (Análisis de Precios Unitarios) por fila, filas capítulo que agrupan, y valor total por ítem con AIU (Administración, Imprevistos, Utilidad). El importador acepta hasta 5000 filas → el render pagina de a 50 (cada fila renderiza un select con TODOS los APU: sin página, O(items×apus) nodos tumban el tab). */
const FILAS_POR_PAG = 50;

export function ItemsPanel({ pres, onUpdate }: Props) {
  const { state, apuCalcMap } = useCivilManager();
  const editable = useEditable();
  // Cerrado → snaps congeladas; borrador/en revisión → catálogos vivos.
  const mapa = useMemo(() => calcMapParaPres(pres, state, apuCalcMap), [pres, state, apuCalcMap]);
  const [pagePedida, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(pres.items.length / FILAS_POR_PAG));
  // Clamped en render (sin effect): cambiar de presupuesto o importar menos filas puede
  // dejar la página pedida fuera de rango — cae a la última válida.
  const page = Math.min(pagePedida, totalPages - 1);
  const desde = page * FILAS_POR_PAG;
  const itemsPagina = pres.items.slice(desde, desde + FILAS_POR_PAG);

  function setItems(items: PresupuestoItem[]) {
    onUpdate({ items });
  }

  function add() {
    const nuevo: PresupuestoItem = {
      id: crypto.randomUUID(),
      num_item: String(pres.items.length + 1),
      capitulo: '',
      descripcion: 'Nuevo ítem',
      unidad: 'un',
      cantidad: 0,
      apu_id: '',
      tiene_apu: false,
      alerta_sin_apu: true,
      es_capitulo: false,
      es_capitulo_manual: null,
    };
    setItems([...pres.items, nuevo]);
    // El ítem nuevo cae al final: saltar a su página para que "Agregar Ítem" se vea.
    setPage(Math.ceil((pres.items.length + 1) / FILAS_POR_PAG) - 1);
  }

  function upd(i: number, k: keyof PresupuestoItem, v: string | number | boolean | null) {
    const n = [...pres.items];
    const item = { ...n[i], [k]: v } as PresupuestoItem;
    if (k === 'apu_id') {
      item.tiene_apu = Boolean(v);
      item.alerta_sin_apu = !v;
    }
    n[i] = item;
    setItems(n);
  }

  function del(i: number) {
    setItems(pres.items.filter((_, j) => j !== i));
  }

  return (
    <XlWrap>
      <TableHeader title="Ítems del presupuesto" icon="items" />
      <DimEnLectura>
        <XlScroll>
          <fieldset disabled={!editable} className="cm-fieldset-flush">
            <table>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col" title="Número o código del ítem dentro del presupuesto.">
                    Ítem
                  </th>
                  <th scope="col" title="Descripción de la actividad o material presupuestado.">
                    Descripción
                  </th>
                  <th scope="col" title="Unidad de medida de la obra (m2, m3, und…).">
                    Unidad
                  </th>
                  <th
                    scope="col"
                    title="Cantidad de obra a ejecutar; multiplica el valor unitario."
                  >
                    Cantidad
                  </th>
                  <th
                    scope="col"
                    title="Análisis de precios unitarios que le pone precio al ítem; rojo si falta asignarlo."
                  >
                    APU
                  </th>
                  <th scope="col" title="Precio unitario resultante del APU (con AIU si aplica).">
                    Vr. Unitario
                  </th>
                  <th scope="col" title="Cantidad × valor unitario.">
                    Vr. Total
                  </th>
                  <th scope="col" aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {pres.items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="cm-empty-row">
                      Sin ítems
                    </td>
                  </tr>
                )}
                {itemsPagina.map((it, i) => {
                  const idx = desde + i; // índice REAL para upd()/del() sobre pres.items
                  const esCap = esCapituloFinal(it);
                  const calc = calcItemValue(
                    it,
                    mapa.get(it.apu_id),
                    pres.aiu_override,
                    state.config,
                  );
                  return (
                    <tr key={it.id} className={esCap ? 'cm-row-cap' : undefined}>
                      <XlRowNum n={idx + 1} />
                      <td>
                        <input
                          className="cm-ni"
                          aria-label="Ítem"
                          value={it.num_item}
                          onChange={(e) => upd(idx, 'num_item', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="cm-ni"
                          aria-label="Descripción"
                          value={it.descripcion}
                          onChange={(e) => upd(idx, 'descripcion', e.target.value)}
                        />
                      </td>
                      <td>
                        {!esCap && (
                          <select
                            className="cm-sel"
                            aria-label="Unidad"
                            value={it.unidad}
                            onChange={(e) => upd(idx, 'unidad', e.target.value)}
                          >
                            {state.config_listas.unidades.map((u) => (
                              <option key={u.abreviatura} value={u.abreviatura}>
                                {u.abreviatura}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>
                        {!esCap && (
                          <NumInput
                            value={it.cantidad}
                            decimals={2}
                            onChange={(v) => upd(idx, 'cantidad', v)}
                          />
                        )}
                      </td>
                      <td>
                        {!esCap && (
                          <select
                            className={`cm-sel${it.alerta_sin_apu ? ' cm-sel-alert' : ''}`}
                            aria-label="APU"
                            value={it.apu_id}
                            onChange={(e) => upd(idx, 'apu_id', e.target.value)}
                          >
                            <option value="">— sin APU —</option>
                            {state.apus.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.codigo} — {a.nombre}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>{!esCap && fmtMoneda(calc.vrUnitario)}</td>
                      <td>{fmtMoneda(calc.valorTotal)}</td>
                      <td className="cm-col-act">
                        <label className="cm-mini-label">
                          <input
                            type="checkbox"
                            checked={esCap}
                            onChange={(e) => upd(idx, 'es_capitulo_manual', e.target.checked)}
                            title="Marcar como capítulo"
                            aria-label="Marcar como capítulo"
                          />
                        </label>
                        <button
                          type="button"
                          className="cm-btn-icon"
                          onClick={() => del(idx)}
                          aria-label="Eliminar ítem"
                        >
                          <ActionIcon name="delete" label="Eliminar ítem" color="var(--err)" />
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
      <div className="cm-xl-foot">
        {editable && (
          <button type="button" className="cm-btn cm-btn-ok" onClick={add}>
            Agregar Ítem
          </button>
        )}
        <span className="cm-flex-1" />
        {totalPages > 1 && (
          <PageNav page={page + 1} setPage={(p) => setPage(p - 1)} total={totalPages} />
        )}
        <span className="cm-flex-1" />
        <span className="cm-label-11">
          Total ítems: <b>{pres.items.length}</b>
        </span>
      </div>
    </XlWrap>
  );
}
