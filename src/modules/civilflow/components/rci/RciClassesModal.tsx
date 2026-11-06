/** Modal «¿Qué clase elegir?» de la pestaña ENTRADAS RCI (extraído de RCIInputs por el guard de
 *  líneas): la tabla de clases NFPA 14 que abre el botón de la celda Observación de la fila
 *  «Clase de sistema». Solo recibe cerrar — la clase la fija el código, no el diseñador.
 *  Ej: <RciClassesModal cerrar={() => setClasesAbiertas(false)} />. */
import { FILAS_CLASE } from './RCIInputDefs.ts';
import { BTN, NOTA, TDCB } from './RciCmatTable.tsx';
import { TH10 } from '../../styles/sharedTableStyles.ts';
import { ModalOverlay } from '../../../../components/shared/ModalShell.tsx';
/* ---------------- Modal «¿Qué clase elegir?» ---------------- */

/** Modal con la ayuda «¿Qué clase elegir?» (CLASE_HELP del HTML): la abre el botón de la celda
 *  Observación de la fila «Clase de sistema» (d.abreModal = 'clases' en GrupoTabla) y se cierra
 *  con el botón o Escape — la clase la fija el código, no el diseñador. */
function ModalClases({ cerrar }: { cerrar: () => void }) {
  return (
    <ModalOverlay zIndex={60}>
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
          <table className="tbl" style={{ fontSize: 12, borderCollapse: 'collapse' }}>
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
                  <td style={{ ...TDCB, fontWeight: 700 }}>{cl}</td>
                  <td style={TDCB}>{salida}</td>
                  <td style={TDCB}>{quien}</td>
                  <td style={{ ...TDCB, fontFamily: 'var(--mono)' }}>{p}</td>
                  <td style={TDCB}>{q}</td>
                  <td style={TDCB}>{cuando}</td>
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
    </ModalOverlay>
  );
}
export { ModalClases };
