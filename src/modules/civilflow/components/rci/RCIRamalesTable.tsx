/** Tabla de RAMALES del piso (sub Hidráulica): 23 columnas del HTML — recorrido del ramal,
 *  rociadores (dibujados/fluyen), tubería (Ø/material/S/L/cota), resultados del cálculo
 *  (n.º de rociadores, brazo, Ø usado, pérdidas, Pe, Q, P req, Keq, Vmax, Q/P equilibrados,
 *  estado) y los botones de orden. Extraída de RCIHydraulics por el guard de líneas (F9).
 *  El estado y los handlers viven en el padre; esta tabla es markup + handlers recibidos.
 *  Ej: <RciRamalesTable rams={rams} fijosR={fijosR} ... /> pinta «Ramales del piso». */
import { useState, type CSSProperties } from 'react';
import { anchoValor, celdaEditable, TDC, CELDA } from './RCIEditableCell.tsx';
import { TH } from '../../styles/sharedTableStyles.ts';
import { DIAMETROS, MATERIALES } from '../../utils/rci/RCIRowsModel.ts';
import type { FilaRamalRci } from '../../utils/rci/RCIRowsModel.ts';
import { ChipEstado } from './RCIUI.tsx';
import { fmt } from '../../utils/rci/RCIRowsModel2.ts';
import type { Criterios } from '../../lib/rci/types.ts';
import type { RedResult } from '../../lib/rci/types.ts';
import type { Red } from '../../lib/rci/types.ts';
import { RciHelpModal } from './RCIHelpModal.tsx';

const THW: CSSProperties = {
  ...TH,
  fontSize: 12,
  whiteSpace: 'normal',
  verticalAlign: 'bottom',
  padding: '4px 3px',
  lineHeight: 1.15,
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

/** Tipos de rociador del ramal (v1.7.80) y su abreviatura en la celda. */
const TROC = ['Colgante', 'Montante', 'Oculto', 'Colgante seco'] as const;
const TROC_C: Record<string, string> = {
  Colgante: 'Colg.',
  Montante: 'Mont.',
  Oculto: 'Oculto',
  'Colgante seco': 'C. seco',
};

/** Panel «Ver ayuda» de la columna Fin (el PHELP.con del HTML, con su SVG): qué es un nudo
 *  y dónde cortar el trazo. */
const FIN_AYUDA = (
  <>
    <p>
      Es el <b>nudo donde el ramal entrega su caudal</b>. Use las letras del plano (A, B, C…).
    </p>
    <svg
      viewBox="0 0 420 150"
      style={{ width: '100%', height: 'auto', display: 'block', margin: '4px 0 8px' }}
      role="img"
      aria-label="Ejemplo: R1 y R2 entregan en A, R3 en B; tramos A a B y B a la derivación"
    >
      <g stroke="var(--line)" strokeWidth="6" strokeLinecap="round" fill="none">
        <path d="M20 30H250V75" />
        <path d="M20 75H330" />
        <path d="M20 120H330V75" />
        <path d="M330 75V20" />
      </g>
      <g fill="var(--steel)">
        <circle cx="250" cy="75" r="7" />
        <circle cx="330" cy="75" r="7" />
        <circle cx="330" cy="20" r="7" />
      </g>
      <g fontSize="12" fill="var(--txt)">
        <text x="22" y="22">
          R1
        </text>
        <text x="22" y="67">
          R2
        </text>
        <text x="22" y="140">
          R3
        </text>
        <text x="240" y="98">
          A
        </text>
        <text x="340" y="98">
          B
        </text>
        <text x="342" y="24">
          C (derivación)
        </text>
        <text x="262" y="68" fill="var(--txt3)">
          tramo A → B
        </text>
        <text x="342" y="52" fill="var(--txt3)">
          tramo B → C
        </text>
      </g>
    </svg>
    <ul style={{ margin: '0 0 8px', paddingLeft: 18 }}>
      <li>
        Un <b>ramal</b> arranca en un rociador de punta y termina en su nudo de conexión: R1 y R2
        conectan en <b>A</b>, R3 en <b>B</b>.
      </li>
      <li>
        Si un ramal entra en otro antes de la distribución, ese punto es un <b>nudo propio</b> (A) y
        la tubería que sigue (A → B) es un <b>tramo</b>: lleva el caudal de los dos.
      </li>
      <li>
        Los tramos van de nudo a nudo hasta la <b>derivación del montante</b>, que se elige en la
        sección Tramos.
      </li>
    </ul>
    <p
      style={{
        margin: 0,
        padding: '6px 8px',
        background: 'var(--bg3)',
        borderLeft: '3px solid var(--rci)',
        borderRadius: '0 4px 4px 0',
      }}
    >
      Regla para el plano: corte el trazo donde otro se une. Cada unión es un nudo, y en cada nudo
      el aplicativo equilibra presiones.
    </p>
  </>
);

/** Props de la tabla de ramales: los handlers (setRamal/moverRamal) escriben en el estado
 *  del padre vía ctx.editar; los fijos vienen de la red GRIS (candados 🔒 de dibujo). */
export function RciRamalesTable({
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
  setRamal: (i: number, k: 'fluyen' | 'dn' | 'mat' | 'S' | 'zr' | 'troc') => (v: string) => void;
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
  const [finAyuda, setFinAyuda] = useState(false);
  return (
    <>
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
              <th scope="col" colSpan={3} style={THW}>
                Recorrido
              </th>
              <th scope="col" colSpan={3} style={THW}>
                Rociadores
              </th>
              <th scope="col" colSpan={4} style={THW}>
                Tubería del ramal (Ø único)
              </th>
              <th scope="col" style={THW}>
                Cota
              </th>
              <th scope="col" colSpan={12} style={THW}>
                Resultados
              </th>
              <th scope="col" style={THW} />
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
                <button
                  type="button"
                  onClick={() => setFinAyuda(true)}
                  aria-expanded={finAyuda}
                  title="Ver ayuda"
                  style={{
                    display: 'block',
                    margin: '1px auto 0',
                    border: 0,
                    background: 'none',
                    padding: 0,
                    font: 'inherit',
                    fontSize: 10,
                    fontWeight: 500,
                    color: 'var(--acc)',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                  }}
                >
                  Ver ayuda
                </button>
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
                title="Tipo de rociador del ramal: colgante (por defecto), montante, oculto o colgante seco. No cambia el cálculo: define el símbolo en PLANO y se verifica contra el tipo de sistema (en sistema seco solo montante o colgante seco)"
              >
                Tipo
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
                      editRam,
                      <select
                        value={f.troc}
                        onChange={(e) => setRamal(i, 'troc')(e.target.value)}
                        aria-label={`Tipo de rociador de ${f.nombre}`}
                        style={{ ...CELDA, width: 66 }}
                      >
                        {TROC.map((n) => (
                          <option key={n} value={n}>
                            {TROC_C[n]}
                          </option>
                        ))}
                      </select>,
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
                <td colSpan={24} style={TDC}>
                  Sin ramales extraídos: dibuje trazos en el plano y confírmelo.
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
              <td colSpan={19} className="c" style={{ ...TDC, color: 'var(--txt2)' }}>
                {rd ? (
                  <>
                    <ChipEstado
                      st={okN ? 'CUMPLE' : rd.flTot < roc.Nreq ? 'NO CUMPLE' : 'REVISAR'}
                    />{' '}
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
      {/* Panel «Ver ayuda» de Fin (el PHELP.con del HTML): tarjeta compartida con nudo SVG y reglas. */}
      {finAyuda ? (
        <RciHelpModal titulo="Conecta en: nudos y tramos" onClose={() => setFinAyuda(false)}>
          {FIN_AYUDA}
        </RciHelpModal>
      ) : null}
    </>
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

export default RciRamalesTable;
