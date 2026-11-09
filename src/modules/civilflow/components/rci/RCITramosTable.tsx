/** Tabla de TRAMOS del piso (sub Hidráulica): 18 columnas del HTML — recorrido De→A, tubería
 *  (material/Ø/L con desglose planta+bajada), cotas por nudo (inicio/fin, editables — una cota
 *  por nudo se refleja en todas sus filas) y resultados (Ø usado, Q propio/de otros/total,
 *  pérdidas, Pe, P inicio/fin, V, estado). Extraída de RCIHydraulics por el guard de líneas
 *  (F9, mismo criterio que RciRamalesTable). Ej: <RciTramosTable trams={trams} ... />. */
import type { CSSProperties } from 'react';
import { anchoValor, celdaEditable } from './RCIEditableCell.tsx';
import { TH10 } from '../../styles/sharedTableStyles.ts';
import { DIAMETROS, MATERIALES } from '../../utils/rci/RCIRowsModel.ts';
import type { FilaTramoRci } from '../../utils/rci/RCIRowsModel.ts';
import { TDC, CELDA } from './RCIEditableCell.tsx';
import { fmt } from '../../utils/rci/RCIRowsModel2.ts';
import type { Red } from '../../lib/rci/types.ts';

const CELDA_COTA: CSSProperties = { padding: '1px 2px' };

/** Props de la tabla de tramos: los handlers escriben en el estado del padre vía ctx.editar
 *  (setZNudo crea la entrada del nudo si aún no existe). */
export function RciTramosTable({
  trams,
  fijosT,
  red,
  editTram,
  setTramo,
  setZNudo,
  zRamTxt,
  raiz,
  altDeriv,
}: {
  /** Filas ya calculadas (filasTramos del padre). */
  trams: FilaTramoRci[];
  /** Candados de dibujo por id de tramo: dn/mat true = celda gris de solo lectura. */
  fijosT: Map<string, { dn: boolean; mat: boolean }>;
  /** Red mezclada del piso (de ahí salen las cotas digitadas por nudo). */
  red: Red | undefined;
  editTram: boolean;
  setTramo: (i: number, k: 'dn' | 'mat') => (v: string) => void;
  setZNudo: (nodo: string) => (v: string) => void;
  /** Cota de los ramales (placeholder de las cotas de nudo). */
  zRamTxt: string;
  /** Nudo raíz de la red (la derivación del montante — su placeholder es altDeriv). */
  raiz: string;
  /** Altura de la derivación por defecto (placeholder del nudo raíz). */
  altDeriv: number;
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tbl" style={{ fontSize: 12, borderCollapse: 'collapse', minWidth: 860 }}>
        <caption
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
          }}
        >
          Tramos del piso
        </caption>
        <thead>
          {/* Grupos del HTML (tr.grp): Recorrido / Tubería / Accesorios y cotas / Resultados. */}
          <tr>
            <th colSpan={3} style={TH10}>
              Recorrido
            </th>
            <th colSpan={3} style={TH10}>
              Tubería
            </th>
            <th colSpan={2} style={TH10}>
              Accesorios y cotas
            </th>
            <th colSpan={10} style={TH10}>
              Resultados
            </th>
          </tr>
          <tr>
            <th scope="col" style={TH10}>
              Tramo
            </th>
            <th
              scope="col"
              style={TH10}
              title="Nudo donde empieza el tramo: donde llegan los ramales o el tramo anterior"
            >
              Inicio
            </th>
            <th
              scope="col"
              style={TH10}
              title="Nudo donde termina el tramo, hacia la derivación del montante"
            >
              Fin
            </th>
            <th scope="col" style={TH10} title="Material del tramo. Gris = lo trae el dibujo">
              Material
            </th>
            <th scope="col" style={TH10} title="Diámetro. Auto: lo elige el motor por velocidad">
              Ø
            </th>
            <th
              scope="col"
              style={TH10}
              title="Longitud total con desglose: planta + bajada a la derivación (del dibujo)"
            >
              L (m)
            </th>
            <th
              scope="col"
              style={TH10}
              title="Altura del nudo inicial sobre el NPT. Una cota por nudo: si el nudo aparece en otra fila, cambia en las dos. Vacío = la cota de los ramales"
            >
              Cota inicio (m)
            </th>
            <th
              scope="col"
              style={TH10}
              title="Altura del nudo final sobre el NPT. En la derivación: altura de la derivación del montante"
            >
              Cota fin (m)
            </th>
            <th scope="col" style={TH10} title="Diámetro con el que se calculó">
              Ø usado
            </th>
            <th
              scope="col"
              style={TH10}
              title="Caudal de los ramales que este tramo alimenta en su nudo de inicio (equilibrado: Q = K·√P)"
            >
              Q propio (gpm)
            </th>
            <th
              scope="col"
              style={TH10}
              title="Caudal de los tramos que este tramo alimenta (los anteriores en el orden del dibujo)"
            >
              Q de otros (gpm)
            </th>
            <th scope="col" style={TH10} title="Q propio + Q de otros">
              Q total (gpm)
            </th>
            <th scope="col" style={TH10} title="Pérdida por fricción y accesorios">
              Pérdidas (psi)
            </th>
            <th scope="col" style={TH10} title="Presión por desnivel">
              Pe (psi)
            </th>
            <th scope="col" style={TH10} title="Presión al inicio del tramo">
              P inicio (psi)
            </th>
            <th
              scope="col"
              style={TH10}
              title="Presión al final del tramo (P inicio + pérdidas + Pe)"
            >
              P fin (psi)
            </th>
            <th scope="col" style={TH10} title="Velocidad del agua">
              V (m/s)
            </th>
            <th scope="col" style={TH10} title="Cálculo completo y dentro de límites">
              Estado
            </th>
          </tr>
        </thead>
        <tbody>
          {trams.map((f, i) => {
            const fij = fijosT.get(f.id) || { dn: false, mat: false };
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
                  {f.de || '—'}
                </td>
                <td
                  className="c"
                  style={{ ...TDC, background: 'var(--bg3)', color: 'var(--txt3)' }}
                >
                  {f.a || '—'}
                </td>
                <td className="c" style={{ padding: '1px 2px' }}>
                  {celdaEditable(
                    editTram && !fij.mat,
                    <select
                      value={f.mat}
                      onChange={(e) => setTramo(i, 'mat')(e.target.value)}
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
                    editTram && !fij.dn,
                    <select
                      value={f.dn}
                      onChange={(e) => setTramo(i, 'dn')(e.target.value)}
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
                <td
                  className="c"
                  style={{ ...TDC, background: 'var(--bg3)', color: 'var(--txt3)' }}
                  title="Planta + bajada (del dibujo)"
                >
                  {f.L !== null ? f.L.toFixed(2) : '—'}
                  {f.desgBajada !== null && f.desgBajada > 0 ? (
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--txt3)' }}>
                      {f.desgPlanta !== null ? f.desgPlanta.toFixed(2) : '—'} planta +{' '}
                      {f.desgBajada.toFixed(2)} bajada
                    </span>
                  ) : null}
                </td>
                <td className="c" style={CELDA_COTA}>
                  {celdaEditable(
                    editTram,
                    <input
                      type="number"
                      step="any"
                      value={zDeNudo(red, f.de)}
                      placeholder={zRamTxt || '0'}
                      onChange={(e) => setZNudo(f.de)(e.target.value)}
                      aria-label={`Cota del nudo ${f.de}`}
                      style={{ ...CELDA, width: 56 }}
                    />,
                  )}
                </td>
                <td className="c" style={CELDA_COTA}>
                  {celdaEditable(
                    editTram,
                    <input
                      type="number"
                      step="any"
                      value={zDeNudo(red, f.a)}
                      placeholder={f.a === raiz ? fmt(altDeriv) : zRamTxt || '0'}
                      onChange={(e) => setZNudo(f.a)(e.target.value)}
                      aria-label={`Cota del nudo ${f.a}`}
                      style={{ ...CELDA, width: 56 }}
                    />,
                  )}
                </td>
                <td className="c" style={TDC}>
                  {f.dnUsado || '—'}
                </td>
                <td className="c" style={TDC}>
                  {f.Qpropio !== null ? f.Qpropio.toFixed(2) : '—'}
                </td>
                <td className="c" style={TDC}>
                  {f.Qotros !== null && f.Qotros !== 0 ? f.Qotros.toFixed(2) : '—'}
                </td>
                <td className="c" style={{ ...TDC, fontWeight: 600 }}>
                  {f.Q !== null ? f.Q.toFixed(2) : '—'}
                </td>
                <td className="c" style={TDC}>
                  {f.Pf !== null ? f.Pf.toFixed(2) : '—'}
                </td>
                <td className="c" style={TDC}>
                  {f.Pe !== null ? f.Pe.toFixed(2) : '—'}
                </td>
                <td className="c" style={TDC}>
                  {f.Pini !== null ? f.Pini.toFixed(2) : '—'}
                </td>
                <td className="c" style={{ ...TDC, fontWeight: 600 }}>
                  {f.Pfin !== null ? f.Pfin.toFixed(2) : '—'}
                </td>
                <td className="c" style={TDC}>
                  {f.V !== null ? f.V.toFixed(2) : '—'}
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
              </tr>
            );
          })}
          {trams.length === 0 && (
            <tr>
              <td colSpan={18} style={TDC}>
                Sin tramos extraídos.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Cota digitada de un nudo (vacío = placeholder). */
function zDeNudo(red: Red | undefined, nudo: string): string {
  const n = red?.nodos?.[nudo];
  return n && n.z !== undefined && n.z !== null && n.z !== '' ? String(n.z) : '';
}

export default RciTramosTable;
