/** Tabla «Coeficiente C de Hazen-Williams por material» de la pestaña ENTRADAS RCI (extraída de
 *  RCIInputs por el guard de líneas) + los estilos compactos compartidos por sus tablas hermanas
 *  (TablaEsp/ModalClases/TablaCuarto los importan de aquí). Estado local (edit); estado y
 *  editar llegan por props.
 *  Ej: vacío en 'Acero SCH 40' calcula con C = 120 en húmedo y 100 en seco. */
import type { CSSProperties } from 'react';
import { EditTablaBtn, useEditarTabla, type RciCtx } from './RCIUI.tsx';
import { celdaEditable, IN_CELDA } from './RCIEditableCell.tsx';
import { TD, TH } from '../../styles/sharedTableStyles.ts';
import { MATERIALES } from '../../utils/rci/RCIRowsModel.ts';
import { CDEF } from '../../lib/rci/tables.ts';
import type { RciState } from '../../lib/rci/types.ts';
/* ---------------- Estilos locales ---------------- */
/** Nota al pie de tabla (12 px, gris): la línea de aclaración bajo la tabla. Ej: la usan RciClassesModal y RciRoomTable. */
const NOTA: CSSProperties = { margin: '4px 0 0', fontSize: 12, color: 'var(--txt3)' };
/** Cabecera de tabla a 12 px (TH global reducido). Ej: las cabeceras de RciRoomTable y RciClassesModal. */
/** Celda de tabla a 14 px: el look estándar de las tablas del motor RCI. Ej: las filas de clase de riesgo en RciClassesModal. */
const TDCB: CSSProperties = { ...TD, fontSize: 14, padding: '1px 4px' };
/** Celda compacta (13 px) para tablas apretadas. Ej: las columnas NFPA de esta tabla C-mat y las celdas de RciRoomTable. */
const TDC12: CSSProperties = { ...TDCB, fontSize: 13, padding: '1px 2px' };
/** Control activo de las celdas: caja tipo sanitario a 13 px (las tablas compactas); C-mat sube a 14 inline. */
const IN: CSSProperties = { ...IN_CELDA, fontSize: 14 };
/* Compacto EXTRA de la sub Tubería y mangueras (ped. usuario: sin scroll vertical con las 3
 * tablas): Tubería (GrupoTabla compacta) + C-mat + accesorios especiales un paso menores. */
/** Cabecera compacta extra (10.5 px), un paso menor que TH10. Ej: las cabeceras de esta tabla C-mat y de RciSpecialAccTable. */
const TH10C: CSSProperties = { ...TH, fontSize: 10.5 };
/** Celda compacta extra (11.5 px). Ej: material y C adoptado en RciSpecialAccTable; las celdas de esta tabla C-mat. */
const TDCC: CSSProperties = { ...TD, fontSize: 11.5, padding: '1px 2px' };
/** Control activo compacto (12 px) de las celdas editables. Ej: los inputs de C adoptado (húmedo/seco) de esta tabla. */
const INC: CSSProperties = { ...IN_CELDA, fontSize: 12 };
/** Nota compacta (11 px) para tablas sin espacio. Ej: la nota de Hazen-Williams al pie de esta tabla y de RciSpecialAccTable. */
const NOTAC: CSSProperties = { ...NOTA, fontSize: 11 };
/** Botón pequeño de modal (11 px) que comparten las tablas hermanas. Ej: el botón de añadir fila en RciSpecialAccTable. */
const BTN: CSSProperties = {
  border: '1px solid var(--line)',
  background: 'var(--bg3)',
  color: 'var(--txt2)',
  borderRadius: 4,
  padding: '2px 8px',
  fontSize: 11,
  cursor: 'pointer',
};

export type EditarRci = RciCtx['editar'];

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
    <td style={TDCC}>
      {celdaEditable(
        edit,
        <input
          type="number"
          min={60}
          max={160}
          step={1}
          value={String(cm[m]?.[k] ?? '')}
          /* Placeholder SOLO en PVC C900 (ped. usuario): ahí el C de NFPA 13·seco sí aplica
           * como referencia (150); en el resto de materiales la celda queda limpia. */
          placeholder={m.startsWith('PVC C900') ? String(CDEF(m, modo)) : undefined}
          aria-label={`C adoptado ${modo} de ${m}`}
          onChange={(e) => setC(m, k)(e.target.value)}
          style={{ ...INC, width: 44 }}
        />,
      )}
    </td>
  );
  return (
    <section className="card" style={{ width: 'fit-content', maxWidth: '100%' }}>
      <div className="card-h" style={{ padding: '4px 10px' }}>
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
                <th scope="col" style={TH10C} title="Material de la tubería">
                  Material
                </th>
                <th
                  scope="col"
                  style={{ ...TH10C, fontSize: 10 }}
                  title="C de NFPA 13 en sistema húmedo"
                >
                  NFPA 13·húm.
                </th>
                <th
                  scope="col"
                  style={{ ...TH10C, fontSize: 10 }}
                  title="C de NFPA 13 en sistema seco"
                >
                  NFPA 13·seco
                </th>
                <th
                  scope="col"
                  style={{ ...TH10C, fontSize: 10 }}
                  title="C adoptado · húmedo (editable)"
                >
                  Adoptado húmedo
                </th>
                <th
                  scope="col"
                  style={{ ...TH10C, fontSize: 10 }}
                  title="C adoptado · seco (editable)"
                >
                  Adoptado seco
                </th>
              </tr>
            </thead>
            <tbody>
              {MATERIALES.map((m) => (
                <tr key={m}>
                  <td style={TDCC}>{m}</td>
                  <td style={{ ...TDC12, fontFamily: 'var(--mono)' }}>{CDEF(m, 'Húmedo')}</td>
                  <td style={{ ...TDC12, fontFamily: 'var(--mono)' }}>{CDEF(m, 'Seco')}</td>
                  {inC(m, 'h', 'Húmedo')}
                  {inC(m, 's', 'Seco')}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={NOTAC}>
          El C se aplica a la fricción de la tubería y corrige las longitudes equivalentes de los
          accesorios (la tabla de NFPA 13 está hecha para C = 120). La succión de la bomba usa el
          valor de sistema húmedo.
        </p>
      </div>
    </section>
  );
}
export { NOTA, TDCB, TDC12, IN, TH10C, TDCC, INC, NOTAC, BTN, TablaCmat };
