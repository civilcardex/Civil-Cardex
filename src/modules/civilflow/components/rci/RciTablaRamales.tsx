/** Tabla de RAMALES del piso (sub Hidráulica): 23 columnas del HTML — recorrido del ramal,
 *  rociadores (dibujados/fluyen), tubería (Ø/material/S/L/cota), resultados del cálculo
 *  (n.º de rociadores, brazo, Ø usado, pérdidas, Pe, Q, P req, Keq, Vmax, Q/P equilibrados,
 *  estado) y los botones de orden. Extraída de RCIHydraulics por el guard de líneas (F9).
 *  El estado y los handlers viven en el padre; esta tabla es markup + handlers recibidos.
 *  Ej: <RciTablaRamales rams={rams} fijosR={fijosR} ... /> pinta «Ramales del piso». */
import type { CSSProperties } from 'react';
import { anchoValor, celdaEditable, IN_CELDA } from './RCIEditableCell.tsx';
import { TH, TD } from '../../styles/sharedTableStyles.ts';
import { DIAMETROS, MATERIALES } from '../../utils/rci/RCIRowsModel.ts';
import type { FilaRamalRci } from '../../utils/rci/RCIRowsModel.ts';
import { ChipEstado } from './RCIUI.tsx';
import { fmt } from '../../utils/rci/RCIRowsModel2.ts';
import type { Criterios } from '../../lib/rci/types.ts';
import type { RedResult } from '../../lib/rci/types.ts';
import type { Red } from '../../lib/rci/types.ts';

const THW: CSSProperties = {
  ...TH,
  fontSize: 12,
  whiteSpace: 'normal',
  verticalAlign: 'bottom',
  padding: '4px 3px',
  lineHeight: 1.15,
};
export const TDC = { ...TD, fontSize: 14, padding: '1px 3px' } as const;
export const CELDA: CSSProperties = {
  ...IN_CELDA,
  fontSize: 14,
  boxSizing: 'border-box',
  textAlign: 'center',
};
const BTN_MV: CSSProperties = {
  border: '1px solid var(--line)',
  background: 'var(--bg3)',
  color: 'var(--txt2)',
  borderRadius: 3,
  cursor: 'pointer',
  fontSize: 11,
  padding: '1px 6px',
};

/** Props de la tabla de ramales: los handlers (setRamal/moverRamal) escriben en el estado
 *  del padre vía ctx.editar; los fijos vienen de la red GRIS (candados 🔒 de dibujo). */
export function RciTablaRamales({
  rams,
  fijosR,
  red,
  rd,
  editRam,
  setRamal,
  moverRamal,
  sProyecto,
  zRamTxt,
  okN,
  roc,
}: {
  /** Filas ya calculadas (filasRamales del padre). */
  rams: FilaRamalRci[];
  /** Candados de dibujo por id de ramal: dn/mat true = celda gris de solo lectura. */
  fijosR: Map<string, { dn: boolean; mat: boolean }>;
  /** Red mezclada del piso (de ahí salen la S digitada y la cota por ramal). */
  red: Red | undefined;
  /** Resultado de la red (totales del footer); null = red sin calcular. */
  rd: RedResult | null;
  editRam: boolean;
  setRamal: (i: number, k: 'fluyen' | 'dn' | 'mat' | 'S' | 'zr') => (v: string) => void;
  moverRamal: (i: number, dir: -1 | 1) => void;
  /** Separación S del proyecto (placeholder de la celda S). */
  sProyecto: string;
  /** Cota de los ramales (placeholder de la cota por ramal). */
  zRamTxt: string;
  /** ¿Los rociadores con flujo igualan lo que exige el área? (color del chip). */
  okN: boolean;
  /** Criterios del área de diseño (Nreq/Nramal/Llargo del footer). */
  roc: Criterios;
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        className="tbl"
        style={{ fontSize: 12, borderCollapse: 'collapse', minWidth: 0, width: '100%' }}
      >
        <caption
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
          }}
        >
          Ramales del piso
        </caption>
        <thead>
          {/* Grupos del HTML (tr.grp): Recorrido / Rociadores / Tubería del ramal (Ø único) /
              Cota / Resultados / Orden. */}
          <tr>
            <th colSpan={3} style={THW}>
              Recorrido
            </th>
            <th colSpan={2} style={THW}>
              Rociadores
            </th>
            <th colSpan={4} style={THW}>
              Tubería del ramal (Ø único)
            </th>
            <th style={THW}>Cota</th>
            <th colSpan={12} style={THW}>
              Resultados
            </th>
            <th style={THW} />
          </tr>
          <tr>
            <th scope="col" style={THW}>
              Ramal
            </th>
            <th
              scope="col"
              style={THW}
              title="Rociador de la punta del ramal (el más remoto del ramal), con su número en el cálculo"
            >
              Inicio
            </th>
            <th
              scope="col"
              style={THW}
              title="Nudo donde conecta el ramal (la última letra es la derivación del montante)"
            >
              Fin
            </th>
            <th scope="col" style={THW} title="Rociadores dibujados en el plano (del dibujo)">
              Dibujados
            </th>
            <th
              scope="col"
              style={THW}
              title="Rociadores con flujo. Vacío = reparto automático desde el más remoto hasta cubrir el área"
            >
              Fluyen
            </th>
            <th
              scope="col"
              style={THW}
              title="Diámetro único del ramal. Auto: el menor que cumple la velocidad máxima"
            >
              Ø
            </th>
            <th scope="col" style={THW} title="Material del ramal. Gris = lo trae el dibujo">
              Material
            </th>
            <th
              scope="col"
              style={THW}
              title="Separación entre rociadores del ramal (vacío = la del proyecto)"
            >
              S (m)
            </th>
            <th scope="col" style={THW} title="Longitud del ramal punta → conexión, del dibujo">
              L ramal (m)
            </th>
            <th
              scope="col"
              style={THW}
              title="Altura del ramal sobre el NPT. Vacío = la cota de los ramales"
            >
              Cota (m)
            </th>
            <th scope="col" style={THW} title="Numeración global de rociadores del ramal">
              Rociadores n.º
            </th>
            <th
              scope="col"
              style={THW}
              title="L ramal − (fluyen − 1) × S: desde el último rociador que fluye hasta la conexión"
            >
              Brazo (m)
            </th>
            <th scope="col" style={THW} title="Diámetro con el que se calculó">
              Ø usado
            </th>
            <th
              scope="col"
              style={THW}
              title="Fricción en la tubería del ramal + accesorios del brazo"
            >
              Pérdidas (psi)
            </th>
            <th
              scope="col"
              style={THW}
              title="Presión por diferencia de cota entre el ramal y su nudo"
            >
              Pe (psi)
            </th>
            <th scope="col" style={THW} title="Caudal del ramal en su conexión">
              Q ramal (gpm)
            </th>
            <th scope="col" style={THW} title="Presión que pide el ramal en su conexión">
              P req. (psi)
            </th>
            <th scope="col" style={THW} title="Q / √P del ramal visto desde su nudo">
              K eq
            </th>
            <th scope="col" style={THW} title="Velocidad máxima dentro del ramal">
              V máx (m/s)
            </th>
            <th scope="col" style={THW} title="Caudal con la presión real del nudo">
              Q equil. (gpm)
            </th>
            <th scope="col" style={THW} title="Presión real del nudo">
              P equil. (psi)
            </th>
            <th scope="col" style={THW} title="Cálculo completo y dentro de límites">
              Estado
            </th>
            <th
              scope="col"
              style={THW}
              title="Subir (más remoto) o bajar el ramal en el orden del cálculo"
            >
              Orden
            </th>
          </tr>
        </thead>
        <tbody>
          {rams.map((f, i) => {
            const fij = fijosR.get(f.id) || { dn: false, mat: false };
            const zrTxt = zrDeRamal(red, i);
            return (
              <tr key={f.id || i}>
                <td
                  className="c"
                  style={{ ...TDC, background: 'var(--bg3)', color: 'var(--txt3)' }}
                >
                  🔒 {f.nombre}
                </td>
                <td
                  className="c"
                  style={{ ...TDC, background: 'var(--bg3)', color: 'var(--txt3)' }}
                >
                  {f.rocIni !== null ? `Roc ${f.rocIni}` : '—'}
                </td>
                <td
                  className="c"
                  style={{ ...TDC, background: 'var(--bg3)', color: 'var(--txt3)' }}
                >
                  {f.con || '—'}
                </td>
                <td
                  className="c"
                  style={{ ...TDC, background: 'var(--bg3)', color: 'var(--txt3)' }}
                >
                  {f.dib ?? '—'}
                </td>
                <td className="c" style={{ padding: '1px 2px' }}>
                  {celdaEditable(
                    editRam,
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={f.auto ? '' : String(f.fluyen ?? '')}
                      placeholder={f.fluyen !== null ? String(f.fluyen) : ''}
                      onChange={(e) => setRamal(i, 'fluyen')(e.target.value)}
                      aria-label={`Rociadores con flujo de ${f.nombre}`}
                      style={{ ...CELDA, width: 46 }}
                    />,
                  )}
                </td>
                <td className="c" style={{ padding: '1px 2px' }}>
                  {celdaEditable(
                    editRam && !fij.dn,
                    <select
                      value={f.dn}
                      onChange={(e) => setRamal(i, 'dn')(e.target.value)}
                      style={{ ...CELDA, width: anchoValor(f.dn) }}
                    >
                      {DIAMETROS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>,
                  )}
                </td>
                <td className="c" style={{ padding: '1px 2px' }}>
                  {celdaEditable(
                    editRam && !fij.mat,
                    <select
                      value={f.mat}
                      onChange={(e) => setRamal(i, 'mat')(e.target.value)}
                      style={{ ...CELDA, width: anchoValor(f.mat) }}
                    >
                      <option value="">—</option>
                      {MATERIALES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>,
                  )}
                </td>
                <td className="c" style={{ padding: '1px 2px' }}>
                  {celdaEditable(
                    editRam,
                    <input
                      type="number"
                      step="any"
                      value={sDeRamal(red, i)}
                      placeholder={sProyecto}
                      onChange={(e) => setRamal(i, 'S')(e.target.value)}
                      aria-label={`Separación S de ${f.nombre}`}
                      style={{ ...CELDA, width: 52 }}
                    />,
                  )}
                </td>
                <td
                  className="c"
                  style={{ ...TDC, background: 'var(--bg3)', color: 'var(--txt3)' }}
                  title="Del dibujo (con la bajada si llega a la derivación)"
                >
                  {f.Lr !== null ? f.Lr.toFixed(2) : '—'}
                </td>
                <td className="c" style={{ padding: '1px 2px' }}>
                  {celdaEditable(
                    editRam,
                    <input
                      type="number"
                      step="any"
                      value={zrTxt}
                      placeholder={zRamTxt || '0'}
                      onChange={(e) => setRamal(i, 'zr')(e.target.value)}
                      aria-label={`Cota de ${f.nombre}`}
                      style={{ ...CELDA, width: 56 }}
                    />,
                  )}
                </td>
                <td className="c" style={TDC}>
                  {f.rocIni !== null
                    ? f.rocIni === f.rocFin
                      ? `${f.rocIni}`
                      : `${f.rocIni}–${f.rocFin}`
                    : '—'}
                </td>
                <td className="c" style={TDC}>
                  {f.brazo !== null ? f.brazo.toFixed(2) : '—'}
                </td>
                <td className="c" style={TDC}>
                  {f.dnUsado || '—'}
                </td>
                <td className="c" style={TDC}>
                  {f.Pf !== null ? f.Pf.toFixed(2) : '—'}
                </td>
                <td className="c" style={TDC}>
                  {f.Pe !== null ? f.Pe.toFixed(2) : '—'}
                </td>
                <td className="c" style={{ ...TDC, fontWeight: 600 }}>
                  {f.Q !== null ? f.Q.toFixed(2) : '—'}
                </td>
                <td className="c" style={{ ...TDC, fontWeight: 600 }}>
                  {f.P !== null ? f.P.toFixed(2) : '—'}
                </td>
                <td className="c" style={TDC}>
                  {f.Keq !== null ? f.Keq.toFixed(3) : '—'}
                </td>
                <td className="c" style={TDC}>
                  {f.Vmax !== null ? f.Vmax.toFixed(2) : '—'}
                </td>
                <td className="c" style={TDC}>
                  {f.Qeq !== undefined && f.Qeq !== null ? f.Qeq.toFixed(2) : '—'}
                </td>
                <td className="c" style={TDC}>
                  {f.Peq !== undefined && f.Peq !== null ? f.Peq.toFixed(2) : '—'}
                </td>
                <td
                  className="c"
                  style={{
                    ...TDC,
                    color: f.ok ? 'var(--succ, #5DBB83)' : 'var(--err, #F04545)',
                    fontWeight: 700,
                  }}
                >
                  {f.ok ? 'OK' : 'revisar'}
                </td>
                <td className="c" style={{ padding: '1px 2px', whiteSpace: 'nowrap' }}>
                  <button
                    type="button"
                    title="Subir (más remoto)"
                    aria-label={`Subir ${f.nombre}`}
                    disabled={!editRam || i === 0}
                    onClick={() => moverRamal(i, -1)}
                    style={BTN_MV}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    title="Bajar"
                    aria-label={`Bajar ${f.nombre}`}
                    disabled={!editRam || i === rams.length - 1}
                    onClick={() => moverRamal(i, 1)}
                    style={{ ...BTN_MV, marginLeft: 2 }}
                  >
                    ↓
                  </button>
                </td>
              </tr>
            );
          })}
          {rams.length === 0 && (
            <tr>
              {/* 23 columnas: 3+2+4+1+12 del grupo + la de orden. */}
              <td colSpan={23} style={TDC}>
                Sin ramales extraídos: dibuje rci en el plano y confírmelo.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ ...TDC, fontWeight: 700 }}>Totales</td>
            <td colSpan={2} style={TDC} />
            <td className="c" style={{ ...TDC, fontWeight: 700 }}>
              {rd ? rd.dibTot || '—' : '—'}
            </td>
            <td className="c" style={{ ...TDC, fontWeight: 700 }}>
              {rd ? rd.flTot : '—'}
            </td>
            <td colSpan={18} className="c" style={{ ...TDC, color: 'var(--txt2)' }}>
              {rd ? (
                <>
                  <ChipEstado st={okN ? 'CUMPLE' : rd.flTot < roc.Nreq ? 'NO CUMPLE' : 'REVISAR'} />{' '}
                  {okN
                    ? `${rd.flTot} = ${roc.Nreq} requeridos ✓`
                    : `${rd.flTot} con flujo · el área exige ${roc.Nreq}`}{' '}
                  <span style={{ color: 'var(--txt3)' }}>
                    {roc.Nramal} por ramal (lado largo {fmt(roc.Llargo)} m)
                  </span>
                </>
              ) : null}
            </td>
            <td style={TDC} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** S digitada del ramal (vacío = usa la del proyecto). */
function sDeRamal(red: Red | undefined, i: number): string {
  const r = red?.ramales[i];
  return r && r.S !== undefined && r.S !== null ? String(r.S) : '';
}

/** Cota propia digitada del ramal (vacío = la cota de los ramales). */
function zrDeRamal(red: Red | undefined, i: number): string {
  const r = red?.ramales[i];
  return r && r.zr !== undefined && r.zr !== null ? String(r.zr) : '';
}

export default RciTablaRamales;
