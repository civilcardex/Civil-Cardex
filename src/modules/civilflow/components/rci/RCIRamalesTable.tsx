/** Tabla de RAMALES del piso (sub Hidráulica): recorrido (ramal+cota, inicio, fin), rociadores
 *  (dibujados/fluyen), tubería (Ø/S/L), resultados del cálculo (n.º de rociadores, brazo,
 *  pérdidas, Pe, Q, P req, Keq, Vmax, Q/P equilibrados, estado) y los botones de orden.
 *  Extraída de RCIHydraulics por el guard de líneas (F9).
 *  El estado y los handlers viven en el padre; esta tabla es markup + handlers recibidos.
 *  Ej: <RciRamalesTable rams={rams} ... /> pinta «Ramales del piso». */
import { useState, type CSSProperties } from 'react';
import { TDC } from './RCIEditableCell.tsx';
import { RciRamalRow } from './rciRamalRow.tsx';
import { TH } from '../../styles/sharedTableStyles.ts';
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
  piso,
  red,
  rd,
  editRam,
  setRamal,
  sProyecto,
  zRamTxt,
  okN,
  roc,
}: {
  /** Filas ya calculadas (filasRamales del padre). */
  rams: FilaRamalRci[];
  /** Etiqueta del piso activo (P1…): sufijo de la columna Ramal (ped. usuario 2026-11-20). */
  piso: string;
  /** Red mezclada del piso (de ahí salen la S digitada y la cota por ramal). */
  red: Red | undefined;
  /** Resultado de la red (totales del footer); null = red sin calcular. */
  rd: RedResult | null;
  editRam: boolean;
  setRamal: (i: number, k: 'dn' | 'mat' | 'S' | 'zr' | 'troc') => (v: string) => void;
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
          className="tbl tbl-sep tbl-hline"
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
              <th scope="col" colSpan={4} style={THW}>
                Recorrido
              </th>
              <th scope="col" colSpan={3} style={THW}>
                Rociadores
              </th>
              <th scope="col" colSpan={3} style={THW}>
                Tubería del ramal (Ø único)
              </th>
              <th scope="col" style={THW}>
                Cota
              </th>
              <th scope="col" colSpan={11} style={THW}>
                Resultados
              </th>
            </tr>
            <tr>
              <th scope="col" style={THW}>
                Ramal
              </th>
              <th
                scope="col"
                style={THW}
                title="Altura del ramal sobre el NPT. Vacío = la cota de los ramales"
              >
                Cota (m)
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
              <th
                scope="col"
                style={THW}
                title="Separación entre rociadores del ramal (vacío = la del proyecto). Si el ramal trae geometría dibujada, la separación hidráulica sale del dibujo y este campo queda informativo."
              >
                S (m)
              </th>
              <th scope="col" style={THW} title="Longitud del ramal punta → conexión, del dibujo">
                L ramal (m)
              </th>
              <th scope="col" style={THW} title="Numeración global de rociadores del ramal">
                Rociadores n.º
              </th>
              <th
                scope="col"
                style={THW}
                title="Distancia real del dibujo desde el último rociador que fluye hasta la conexión. Sin geometría dibujada = L ramal − (fluyen − 1) × S"
              >
                Brazo (m)
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
            </tr>
          </thead>
          <tbody>
            {rams.map((f, i) => (
              <RciRamalRow
                key={f.id || i}
                f={f}
                i={i}
                piso={piso}
                red={red}
                editRam={editRam}
                setRamal={setRamal}
                sProyecto={sProyecto}
                zRamTxt={zRamTxt}
              />
            ))}
            {rams.length === 0 && (
              <tr>
                {/* 22 columnas: 3+2+3+1+13 del grupo (sin Orden ni Material, ped. usuario). */}
                <td colSpan={22} style={TDC}>
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
              <td colSpan={17} className="c" style={{ ...TDC, color: 'var(--txt2)' }}>
                {rd ? (
                  <>
                    <ChipEstado
                      st={okN ? 'CUMPLE' : rd.flTot < roc.Nreq ? 'NO CUMPLE' : 'REVISAR'}
                    />{' '}
                    {okN
                      ? `Fluyen ${rd.flTot} de ${roc.Nreq} requeridos ✓`
                      : `Fluyen ${rd.flTot} de ${roc.Nreq} requeridos`}{' '}
                    <span style={{ color: 'var(--txt3)' }}>
                      · {roc.Nramal} por ramal (lado largo {fmt(roc.Llargo)} m)
                    </span>
                  </>
                ) : null}
              </td>
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

export default RciRamalesTable;
