/** Paso 7 «¿Listo para dibujar?» de la Guía de diseño RCI: el checklist de los 6 criterios de
 *  rociadores con su chip de estado y el botón «Corregir» que salta al dato pendiente.
 *  Ej: <PasoListo ctx={ctx} chk={chk} chkMap={chkMap} irGo={irGo} /> pinta
 *  "Riesgo clasificado y compatible con el uso · CUMPLE". */
import { ChipEstado } from '../RCIUI.tsx';
import { BTN_CHICO, GST, TXT, type PrefijoChk, type PropsPasoGuia } from './shared.ts';

/* 7 · ¿Listo para dibujar? */
export function PasoListo({ chk, chkMap, irGo }: PropsPasoGuia) {
  const items: [string, PrefijoChk, string[]][] = [
    [
      'Riesgo clasificado y compatible con el uso',
      'Riesgo NFPA 13 compatible',
      ['entradas', 'clas.riesgo'],
    ],
    [
      'Altura de arrume definida (si hay almacenamiento)',
      'Altura de arrume',
      ['entradas', 'clas.arrumeH'],
    ],
    ['Separación S dentro de límites', 'Separación entre rociadores', ['tipologias', 'pisos']],
    ['Separación L dentro de límites', 'Separación entre ramales', ['tipologias', 'pisos']],
    ['Área por rociador ≤ cobertura máxima', 'Área por rociador', ['tipologias', 'pisos']],
    ['Distancia a muro dentro de límites', 'Distancia a muro', ['tipologias', 'pisos']],
  ];
  const listo = items.every((it) => chk(it[1]) === 'CUMPLE');
  return (
    <>
      <p style={TXT}>
        Antes de pasar al módulo de dibujo, los criterios de rociadores deben cumplir. Así el trazo
        se hace una sola vez.
      </p>
      <table className="tbl" style={{ fontSize: 11, borderCollapse: 'collapse' }}>
        <tbody>
          {items.map(([t, pre, go]) => (
            <tr key={pre}>
              <th
                scope="row"
                style={{
                  textAlign: 'left',
                  textTransform: 'none',
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: 'var(--txt)',
                  whiteSpace: 'normal',
                }}
              >
                {t}
              </th>
              <td style={{ textAlign: 'center' }}>
                <ChipEstado st={chk(pre)} />
              </td>
              <td style={{ textAlign: 'right' }}>
                {chk(pre) === 'CUMPLE' ? null : (
                  <button
                    type="button"
                    style={BTN_CHICO}
                    onClick={() => irGo(chkMap.get(pre)?.go ?? go)}
                  >
                    Corregir
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={GST}>
        {listo ? (
          <span>
            <b>Todo listo.</b> Ten a mano el PDF del plano con la distribución de rociadores.
          </span>
        ) : (
          <span>
            <b>Resuelve los puntos pendientes antes de dibujar.</b> Puedes abrir el módulo
            igualmente, pero tendrás que volver a ajustar el trazo.
          </span>
        )}
      </div>
      {/* El botón "Pasar al módulo de dibujo" del HTML (data-gplano) no existe en este módulo. */}
    </>
  );
}
