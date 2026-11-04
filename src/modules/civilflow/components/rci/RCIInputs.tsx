/** Pestaña ENTRADAS del diseño RCI (Red Contra Incendio): el formulario del HTML de referencia
 *  en 9 sub-pestañas verticales (SubTabsRci), cada grupo de campos en SU tarjeta GrupoTabla
 *  (section.card con tabla tbl y botón EDITAR propio arriba a la derecha — cada tabla se edita
 *  sola, sin EDITAR global). Cada fila: etiqueta (con la ayuda al pasar el mouse), control con
 *  data-campo para «Ir al dato», unidad, chip de naturaleza (TAGS_RCI del HTML) y la OBSERVACIÓN
 *  siempre visible (la ayuda del campo; los defs viven en RCIInputDefs.ts). Las deps (p. ej.
 *  local.exigeSP) siguen deshabilitando campos encima del flag de edición. Ej: la sub 'tuberia'
 *  muestra los 5 campos de tubería/mangueras junto a la tabla de C por material, con el catálogo
 *  de accesorios especiales debajo. */
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  EditTablaBtn,
  SubTabsRci,
  useEditarTabla,
  useNavRci,
  type RciCtx,
  type SubItemRci,
} from './RCIUI.tsx';
import { celdaEditable, IN_CELDA } from './RCIEditableCell.tsx';
import { GrupoTabla } from './RCIGroupTable.tsx';
import { FILAS_CLASE, GRUPOS, ICONO_SUB, NOTA_SUB } from './RCIInputDefs.ts';
import { SUBS_POR_TAB } from '../../utils/rci/RCIRowsModelExtras.ts';
import { MATERIALES } from '../../utils/rci/RCIRowsModel.ts';
import { TD, TH } from '../../styles/sharedTableStyles.ts';
import { CDEF, NOM, type EspAcc } from '../../lib/rci/tables.ts';
import type { RciState } from '../../lib/rci/types.ts';

const SUB_POR_ID = new Map(SUBS_POR_TAB.entradas.map((s) => [s.id, s]));

/* ---------------- Estilos locales ---------------- */
const NOTA: CSSProperties = { margin: '4px 0 0', fontSize: 12, color: 'var(--txt3)' };
const TH10: CSSProperties = { ...TH, fontSize: 11 };
const TDC: CSSProperties = { ...TD, fontSize: 13, padding: '1px 4px' };
const TDC12: CSSProperties = { ...TDC, fontSize: 12, padding: '1px 2px' }; // TablaEsp y TablaCuarto compactas
/** Control activo de las celdas: caja tipo sanitario a 12 px (las tablas compactas); C-mat sube a 13 inline. */
const IN: CSSProperties = { ...IN_CELDA, fontSize: 13 };
const BTN: CSSProperties = {
  border: '1px solid var(--line)',
  background: 'var(--bg3)',
  color: 'var(--txt2)',
  borderRadius: 4,
  padding: '2px 8px',
  fontSize: 11,
  cursor: 'pointer',
};

type EditarRci = RciCtx['editar'];

/* ---------------- Tabla C por material ---------------- */

/** Tabla «Coeficiente C de Hazen-Williams por material» (st.cmat): vacío usa el valor de NFPA 13
 *  cap. 28; un valor distinto queda «Por revisar» y debe justificarse. Ej: vacío en 'Acero SCH
 *  40' calcula con C = 120 en húmedo y 100 en seco. */
function TablaCmat({ estado, editar }: { estado: RciState; editar: EditarRci }) {
  const [edit, toggleEdit] = useEditarTabla();
  const cm = estado.cmat || {};
  const setC = (m: string, k: 'h' | 's') => (v: string) =>
    editar((e) => ({
      ...e,
      cmat: { ...(e.cmat || {}), [m]: { ...(e.cmat || {})[m], [k]: v === '' ? '' : Number(v) } },
    }));
  const inC = (m: string, k: 'h' | 's', modo: string) => (
    <td style={TDC12}>
      {celdaEditable(
        edit,
        <input
          type="number"
          min={60}
          max={160}
          step={1}
          value={String(cm[m]?.[k] ?? '')}
          placeholder={String(CDEF(m, modo))}
          aria-label={`C adoptado ${modo} de ${m}`}
          onChange={(e) => setC(m, k)(e.target.value)}
          style={{ ...IN, width: 48 }}
        />,
      )}
    </td>
  );
  return (
    <section className="card" style={{ width: 'fit-content', maxWidth: '100%' }}>
      <div className="card-h" style={{ padding: '6px 12px' }}>
        <h3
          className="card-t"
          style={{
            fontSize: 15,
            color: 'var(--txt2)',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <img
            src="/iconos/coeficiente_c.webp"
            alt=""
            style={{ width: 22, height: 22, objectFit: 'contain' }}
          />
          Coeficiente C de Hazen-Williams por material
        </h3>
        <div style={{ marginLeft: 'auto' }}>
          <EditTablaBtn on={edit} onToggle={toggleEdit} />
        </div>
      </div>
      <div style={{ padding: 6 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH10} title="Material de la tubería">
                  Material
                </th>
                <th style={{ ...TH10, fontSize: 10 }} title="C de NFPA 13 en sistema húmedo">
                  NFPA 13·húm.
                </th>
                <th style={{ ...TH10, fontSize: 10 }} title="C de NFPA 13 en sistema seco">
                  NFPA 13·seco
                </th>
                <th style={{ ...TH10, fontSize: 10 }} title="C adoptado · húmedo (editable)">
                  Adopt.·húm.
                </th>
                <th style={{ ...TH10, fontSize: 10 }} title="C adoptado · seco (editable)">
                  Adopt.·seco
                </th>
              </tr>
            </thead>
            <tbody>
              {MATERIALES.map((m) => (
                <tr key={m}>
                  <td style={TDC12}>{m}</td>
                  <td style={{ ...TDC12, fontFamily: 'var(--mono)' }}>{CDEF(m, 'Húmedo')}</td>
                  <td style={{ ...TDC12, fontFamily: 'var(--mono)' }}>{CDEF(m, 'Seco')}</td>
                  {inC(m, 'h', 'Húmedo')}
                  {inC(m, 's', 'Seco')}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={NOTA}>
          El C se aplica a la fricción de la tubería y corrige las longitudes equivalentes de los
          accesorios (la tabla de NFPA 13 está hecha para C = 120). La succión de la bomba usa el
          valor de sistema húmedo.
        </p>
      </div>
    </section>
  );
}

/* ---------------- Catálogo de accesorios especiales ---------------- */

/** Modos de pérdida de un accesorio especial (select del HTML). */
const MODOS_ESP: [string, string][] = [
  ['LD', 'L/D (× Ø interior)'],
  ['Leq', 'Leq fija (m)'],
  ['dp', 'Δp (psi) a Q ref.'],
];

/** Catálogo de accesorios especiales (st.esp): el código aparece en el panel de accesorios de
 *  cada ramal/tramo. Ej: 'VA' (válvula de alarma) con modo LD y valor 50. */
function TablaEsp({ estado, editar }: { estado: RciState; editar: EditarRci }) {
  const [edit, toggleEdit] = useEditarTabla();
  const esp = estado.esp || [];
  const setE =
    (i: number, k: keyof EspAcc, esNum = false) =>
    (v: string) =>
      editar((e) => ({
        ...e,
        esp: e.esp.map((r, j) => (j === i ? { ...r, [k]: esNum && v !== '' ? Number(v) : v } : r)),
      }));
  const del = (i: number) => editar((e) => ({ ...e, esp: e.esp.filter((_, j) => j !== i) }));
  const add = () =>
    editar((e) => ({
      ...e,
      esp: [...e.esp, { cod: '', nombre: '', modo: 'Leq', valor: '', qref: '' }],
    }));
  return (
    <section className="card" style={{ width: 'fit-content', maxWidth: '100%' }}>
      <div className="card-h" style={{ padding: '6px 12px' }}>
        <h3
          className="card-t"
          style={{
            fontSize: 15,
            color: 'var(--txt2)',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <img
            src="/iconos/accesorios_especiales.webp"
            alt=""
            style={{ width: 22, height: 22, objectFit: 'contain' }}
          />
          Catálogo de accesorios especiales
        </h3>
        <div style={{ marginLeft: 'auto' }}>
          <EditTablaBtn on={edit} onToggle={toggleEdit} />
        </div>
      </div>
      <div style={{ padding: 6 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH10}>Código</th>
                <th style={TH10}>Accesorio</th>
                <th style={TH10}>Cómo se da la pérdida</th>
                <th style={TH10}>Valor</th>
                <th style={TH10}>Q ref. (gpm)</th>
                <th style={TH10} />
              </tr>
            </thead>
            <tbody>
              {esp.map((a, i) => (
                <tr key={i}>
                  <td style={TDC12}>
                    {celdaEditable(
                      edit,
                      <input
                        type="text"
                        value={String(a.cod ?? '')}
                        aria-label={`Código del accesorio ${i + 1}`}
                        onChange={(e) => setE(i, 'cod')(e.target.value)}
                        style={{ ...IN, width: 54 }}
                      />,
                    )}
                  </td>
                  <td style={TDC12}>
                    {celdaEditable(
                      edit,
                      <input
                        type="text"
                        value={String(a.nombre ?? '')}
                        aria-label={`Nombre del accesorio ${i + 1}`}
                        onChange={(e) => setE(i, 'nombre')(e.target.value)}
                        style={{ ...IN, width: 230 }}
                      />,
                    )}
                  </td>
                  <td style={TDC12}>
                    {celdaEditable(
                      edit,
                      <select
                        value={a.modo}
                        aria-label={`Modo del accesorio ${i + 1}`}
                        onChange={(e) => setE(i, 'modo')(e.target.value)}
                        style={{ ...IN, width: 104 }}
                      >
                        {MODOS_ESP.map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>,
                    )}
                  </td>
                  <td style={TDC12}>
                    {celdaEditable(
                      edit,
                      <input
                        type="number"
                        step="any"
                        value={String(a.valor ?? '')}
                        aria-label={`Valor del accesorio ${i + 1}`}
                        onChange={(e) => setE(i, 'valor', true)(e.target.value)}
                        style={{ ...IN, width: 50, WebkitAppearance: 'textfield' }}
                      />,
                    )}
                  </td>
                  <td style={TDC12}>
                    {a.modo === 'dp' ? (
                      celdaEditable(
                        edit,
                        <input
                          type="number"
                          step="any"
                          value={String(a.qref ?? '')}
                          aria-label={`Caudal de referencia del accesorio ${i + 1}`}
                          onChange={(e) => setE(i, 'qref', true)(e.target.value)}
                          style={{ ...IN, width: 50, WebkitAppearance: 'textfield' }}
                        />,
                      )
                    ) : (
                      <span style={{ color: 'var(--txt3)' }}>—</span>
                    )}
                  </td>
                  <td style={TDC12}>
                    <button
                      type="button"
                      title="Eliminar"
                      aria-label={`Eliminar accesorio ${i + 1}`}
                      disabled={!edit}
                      onClick={() => del(i)}
                      style={{ ...BTN, padding: '0 6px' }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 4 }}>
          <button type="button" disabled={!edit} onClick={add} style={BTN}>
            + Añadir accesorio
          </button>
        </div>
        <p style={NOTA}>
          L/D: la longitud equivalente es L/D × diámetro interior del tramo. Δp: pérdida del
          fabricante a un caudal de referencia, escalada con (Q/Qref)^1,85.
        </p>
      </div>
    </section>
  );
}

/* ---------------- Modal «¿Qué clase elegir?» ---------------- */

/** Modal con la ayuda «¿Qué clase elegir?» (CLASE_HELP del HTML): la abre el botón de la celda
 *  Observación de la fila «Clase de sistema» (d.abreModal = 'clases' en GrupoTabla) y se cierra
 *  con el botón o Escape — la clase la fija el código, no el diseñador. */
function ModalClases({ cerrar }: { cerrar: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,.6)',
        padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="¿Qué clase elegir?"
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          width: 'fit-content',
          maxWidth: 'min(880px, 100%)',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 12px 30px rgba(0,0,0,.5)',
        }}
      >
        <div className="card-h" style={{ padding: '6px 12px' }}>
          <h3
            className="card-t"
            style={{
              fontSize: 15,
              color: 'var(--txt2)',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
            }}
          >
            <img
              src="/iconos/montantes_nfpa14.webp"
              alt=""
              style={{ width: 22, height: 22, objectFit: 'contain' }}
            />
            ¿Qué clase elegir?
          </h3>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar ¿Qué clase elegir?"
            style={{ ...BTN, marginLeft: 'auto' }}
          >
            Cerrar ✕
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH10}>Clase</th>
                <th style={TH10}>Salida en cada punto</th>
                <th style={TH10}>Quién la usa</th>
                <th style={TH10}>Presión mín. remota</th>
                <th style={TH10}>Caudal</th>
                <th style={TH10}>Elíjala cuando el código pide…</th>
              </tr>
            </thead>
            <tbody>
              {FILAS_CLASE.map(([cl, salida, quien, p, q, cuando]) => (
                <tr key={cl}>
                  <td style={{ ...TDC, fontWeight: 700 }}>{cl}</td>
                  <td style={TDC}>{salida}</td>
                  <td style={TDC}>{quien}</td>
                  <td style={{ ...TDC, fontFamily: 'var(--mono)' }}>{p}</td>
                  <td style={TDC}>{q}</td>
                  <td style={TDC}>{cuando}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={NOTA}>
          Válvula de 2½" sola = Clase I; manguera de 1½" sola = Clase II; las dos = Clase III. Las
          Clases I y III suelen gobernar la bomba (500 gpm a 100 psi en la salida más alta).
        </p>
      </div>
    </div>
  );
}

/* ---------------- Cuarto de bombas ---------------- */

const FC_CUARTO: [string, string][] = [
  // accesorios estándar del cuarto, orden FIT del motor
  ['c45', '45°'],
  ['c90', '90°'],
  ['clr', '90° RL'],
  ['tee', 'Tee giro'],
  ['mar', 'Marip.'],
  ['comp', 'Comp.'],
  ['ret', 'Ret.'],
];

/** Tubería del cuarto de bombas (st.mont.cuarto): de la base del montante a la brida de
 *  descarga (CB). Una fila con la longitud total, sus accesorios y el desnivel; los resultados
 *  (pérdidas y presión en la brida) viven en la pestaña Bomba y tanque. */
function TablaCuarto({ estado, editar }: { estado: RciState; editar: EditarRci }) {
  const [edit, toggleEdit] = useEditarTabla();
  const filas = estado.mont.cuarto || [];
  const setC =
    (i: number, k: string, esNum = false) =>
    (v: string) =>
      editar((e) => ({
        ...e,
        mont: {
          ...e.mont,
          cuarto: e.mont.cuarto.map((r, j) =>
            j === i ? { ...r, [k]: esNum && v !== '' ? Number(v) : v } : r,
          ),
        },
      }));
  return (
    <section className="card" style={{ width: 'fit-content', maxWidth: '100%' }}>
      <div className="card-h" style={{ padding: '6px 12px' }}>
        <h3
          className="card-t"
          style={{
            fontSize: 15,
            color: 'var(--txt2)',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <img
            src="/iconos/tuberia_cuarto_bombas.webp"
            alt=""
            style={{ width: 22, height: 22, objectFit: 'contain' }}
          />
          Tubería del cuarto de bombas: de la base del montante a la brida de descarga (CB)
        </h3>
        <div style={{ marginLeft: 'auto' }}>
          <EditTablaBtn on={edit} onToggle={toggleEdit} />
        </div>
      </div>
      <div style={{ padding: 6 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th colSpan={2} style={TH10}>
                  Recorrido
                </th>
                <th colSpan={3} style={TH10}>
                  Tubería
                </th>
                <th colSpan={9} style={TH10}>
                  Accesorios (un)
                </th>
                <th colSpan={2} style={TH10}>
                  Cotas (m)
                </th>
              </tr>
              <tr>
                <th style={TH10}>Desde</th>
                <th style={TH10}>Hasta</th>
                <th style={TH10}>Material</th>
                <th style={TH10}>Ø</th>
                <th style={TH10}>L (m)</th>
                {FC_CUARTO.map(([k, t]) => (
                  <th key={k} style={TH10}>
                    {t}
                  </th>
                ))}
                <th
                  style={TH10}
                  title="Códigos del catálogo de accesorios especiales (Tubería y mangueras), p. ej. VA+DF"
                >
                  Especiales
                </th>
                <th style={TH10}>Leq otros (m)</th>
                <th style={TH10}>Inicio</th>
                <th style={TH10}>Fin</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((r, i) => {
                const numTd = (k: string, v: unknown, w = 40) => (
                  <td style={TDC12}>
                    {celdaEditable(
                      edit,
                      <input
                        type="number"
                        step="any"
                        value={String(v ?? '')}
                        aria-label={`${k} de la fila ${i + 1} del cuarto`}
                        onChange={(e) => setC(i, k, true)(e.target.value)}
                        style={{ ...IN, width: w }}
                      />,
                    )}
                  </td>
                );
                return (
                  <tr key={i}>
                    <td style={{ ...TDC12, fontWeight: 700 }}>{String(r.ni || 'Base')}</td>
                    <td style={{ ...TDC12, fontWeight: 700 }}>{String(r.nf || 'CB')}</td>
                    <td style={TDC12}>
                      {celdaEditable(
                        edit,
                        <select
                          value={String(r.mat || '')}
                          aria-label={`Material de la fila ${i + 1} del cuarto`}
                          onChange={(e) => setC(i, 'mat')(e.target.value)}
                          style={{ ...IN, width: 92 }}
                        >
                          {MATERIALES.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>,
                      )}
                    </td>
                    <td style={TDC12}>
                      {celdaEditable(
                        edit,
                        <select
                          value={String(r.dn || '')}
                          aria-label={`Diámetro de la fila ${i + 1} del cuarto`}
                          onChange={(e) => setC(i, 'dn')(e.target.value)}
                          style={{ ...IN, width: 56 }}
                        >
                          {NOM.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>,
                      )}
                    </td>
                    {numTd('L', r.L, 44)}
                    {FC_CUARTO.map(([k]) => (
                      <td key={k} style={TDC12}>
                        {celdaEditable(
                          edit,
                          <input
                            type="number"
                            step="any"
                            value={String(r[k] ?? '')}
                            aria-label={`${k} de la fila ${i + 1} del cuarto`}
                            onChange={(e) => setC(i, k, true)(e.target.value)}
                            style={{ ...IN, width: 38 }}
                          />,
                        )}
                      </td>
                    ))}
                    <td style={TDC12}>
                      {celdaEditable(
                        edit,
                        <input
                          type="text"
                          value={String(r.esp ?? '')}
                          placeholder="p. ej. VA"
                          aria-label={`Accesorios especiales de la fila ${i + 1} del cuarto`}
                          onChange={(e) => setC(i, 'esp')(e.target.value)}
                          style={{ ...IN, width: 80 }}
                        />,
                      )}
                    </td>
                    {numTd('leqOtros', r.leqOtros, 44)}
                    {numTd('zi', r.zi)}
                    {numTd('zf', r.zf)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={NOTA}>
          Una fila con la longitud total, sus accesorios y el desnivel. Los resultados (pérdidas y
          presión en la brida) están en la pestaña Bomba y tanque.
        </p>
      </div>
    </section>
  );
}

/* ---------------- La pestaña ---------------- */

/** Pestaña ENTRADAS: sub-pestañas verticales (SUBS_POR_TAB['entradas']) + el grupo de campos
 *  activo; los badges de cada sub cuentan las verificaciones que apuntan a ese grupo. El modal
 *  «¿Qué clase elegir?» vive aquí y lo abre el botón de la celda Observación de la fila clase. */
export default function RciInputs({ ctx }: { ctx: RciCtx }) {
  const { estado, R, editar } = ctx;
  const nav = useNavRci();
  /** Preferencia local; la sub efectiva es la del contexto de navegación si «Ir al dato» o la
   *  guía la fijaron (nav.sub manda), y si no, la última que el usuario abrió aquí. */
  const [preferida, setPreferida] = useState('normativa');
  const sub = nav.sub && SUB_POR_ID.has(nav.sub) ? nav.sub : preferida;
  const elegir = (id: string) => {
    setPreferida(id);
    nav.irA('entradas', id);
  };

  const [clasesAbiertas, setClasesAbiertas] = useState(false);
  /* Escape cierra el modal (listener a nivel documento, patrón HelpPanel). */
  useEffect(() => {
    if (!clasesAbiertas) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setClasesAbiertas(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [clasesAbiertas]);
  /** Abre el modal pedido por la celda Observación de un campo (la clave d.abreModal). */
  const abrirModal = (clave: string): void => {
    if (clave === 'clases') setClasesAbiertas(true);
  };

  const items: SubItemRci[] = SUBS_POR_TAB.entradas.map((s) => ({ id: s.id, titulo: s.l }));

  return (
    <>
      <SubTabsRci subs={items} sub={sub} setSub={elegir}>
        <section style={{ padding: '2px 0 8px' }}>
          {sub === 'tuberia' ? (
            /* Tubería y mangueras AL LADO del coeficiente C de Hazen-Williams; el catálogo de
             * accesorios especiales, debajo. */
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(340px, max-content))',
                  gap: 12,
                  alignItems: 'start',
                }}
              >
                <GrupoTabla
                  titulo={SUB_POR_ID.get(sub)?.l || sub}
                  nota={NOTA_SUB[sub]}
                  icono={ICONO_SUB[sub]}
                  campos={GRUPOS[sub] || []}
                  estado={estado}
                  R={R}
                  editar={editar}
                  onAbrirModal={abrirModal}
                />
                <TablaCmat estado={estado} editar={editar} />
              </div>
              <div style={{ marginTop: 16 }}>
                <TablaEsp estado={estado} editar={editar} />
              </div>
            </>
          ) : sub === 'montantes' ? (
            /* Montantes NFPA 14 solo: la ayuda «¿Qué clase elegir?» salió de la tarjeta y vive
             * en el MODAL que abre la celda Observación de la fila Clase de sistema. */
            <GrupoTabla
              titulo={SUB_POR_ID.get(sub)?.l || sub}
              nota={NOTA_SUB[sub]}
              icono={ICONO_SUB[sub]}
              campos={GRUPOS[sub] || []}
              estado={estado}
              R={R}
              editar={editar}
              onAbrirModal={abrirModal}
            />
          ) : sub === 'seleccion' ? null : (
            <GrupoTabla
              minAncho={sub === 'clasificacion' ? 720 : undefined}
              titulo={SUB_POR_ID.get(sub)?.l || sub}
              nota={NOTA_SUB[sub]}
              icono={ICONO_SUB[sub]}
              campos={GRUPOS[sub] || []}
              estado={estado}
              R={R}
              editar={editar}
              onAbrirModal={abrirModal}
            />
          )}
          {sub === 'seleccion' ? (
            /* Bomba: selección, y la tubería del cuarto de bombas DEBAJO. */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                alignItems: 'start',
              }}
            >
              <GrupoTabla
                titulo={SUB_POR_ID.get(sub)?.l || sub}
                nota={NOTA_SUB[sub]}
                icono={ICONO_SUB[sub]}
                campos={GRUPOS[sub] || []}
                estado={estado}
                R={R}
                editar={editar}
                onAbrirModal={abrirModal}
              />
              <div style={{ marginTop: 16 }}>
                <TablaCuarto estado={estado} editar={editar} />
              </div>
            </div>
          ) : null}
        </section>
      </SubTabsRci>
      {clasesAbiertas ? <ModalClases cerrar={() => setClasesAbiertas(false)} /> : null}
    </>
  );
}
