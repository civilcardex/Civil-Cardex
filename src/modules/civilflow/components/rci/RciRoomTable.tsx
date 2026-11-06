/** Tubería del cuarto de bombas de la pestaña ENTRADAS RCI (extraída de RCIInputs por el guard
 *  de líneas): de la base del montante a la brida de descarga (CB) — una fila con longitud,
 *  accesorios y desnivel, con el esquema PumpSvg en modal. Estado local (edit/esquema); estado
 *  y editar llegan por props.
 *  Ej: L = 2,80 m con 2 codos calcula sus pérdidas en la pestaña Bomba y tanque. */
import { useState } from 'react';
import { EditTablaBtn, useEditarTabla } from './RCIUI.tsx';
import { useEscapeKey } from '../../../../components/shared/ModalShell.tsx';
import { celdaEditable } from './RCIEditableCell.tsx';
import { BTN, IN, NOTA, TDC12, type EditarRci } from './RciCmatTable.tsx';
import { TH10 } from '../../styles/sharedTableStyles.ts';
import { MATERIALES } from '../../utils/rci/RCIRowsModel.ts';
import { NOM } from '../../lib/rci/tables.ts';
import { PumpSvg } from './RCISvgSchemas.tsx';
import type { RciState } from '../../lib/rci/types.ts';
import { ModalOverlay } from '../../../../components/shared/ModalShell.tsx';
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
  const [esquema, setEsquema] = useState(false);
  /* Escape cierra el esquema (patrón HelpPanel). */
  useEscapeKey(() => setEsquema(false), esquema);
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
            fontSize: 16,
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
          <button
            type="button"
            onClick={() => setEsquema(true)}
            aria-label="Ver esquema del cuarto de bombas"
            style={{
              ...BTN,
              border: 0,
              background: 'none',
              color: 'var(--steel)',
              textDecoration: 'underline',
              padding: 0,
              marginLeft: 8,
              fontSize: 11,
            }}
          >
            Ver esquema
          </button>
        </h3>
        <div style={{ marginLeft: 'auto' }}>
          <EditTablaBtn on={edit} onToggle={toggleEdit} />
        </div>
      </div>
      <div style={{ padding: 6 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ fontSize: 12, borderCollapse: 'collapse' }}>
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
                          style={{ ...IN, width: 118 }}
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
      {/* Modal del esquema (el data-esqopen="desc" del HTML): cuarto de bombas resaltado en
       *  descarga. Click fuera o Escape cierra. */}
      {esquema ? (
        <ModalOverlay onClose={() => setEsquema(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Esquema del cuarto de bombas"
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              width: 'min(920px, 100%)',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 14,
              boxShadow: '0 12px 30px rgba(0,0,0,.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 14, color: 'var(--txt)' }}>
                Esquema del cuarto de bombas
              </h3>
              <span style={{ fontSize: 11, color: 'var(--txt3)' }}>
                Resaltado: descarga (tubería del cuarto)
              </span>
              <button
                type="button"
                onClick={() => setEsquema(false)}
                aria-label="Cerrar esquema"
                style={{ ...BTN, marginLeft: 'auto', fontSize: 13, padding: '2px 8px' }}
              >
                ✕
              </button>
            </div>
            <PumpSvg modo="desc" />
          </div>
        </ModalOverlay>
      ) : null}
    </section>
  );
}
export { TablaCuarto };
