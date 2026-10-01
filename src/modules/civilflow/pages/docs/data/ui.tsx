import { Fragment } from 'react';
import type { JSX, ReactNode } from 'react';

// Clases EXACTAS de los <td>/<th> de las tablas de la documentación (markup idéntico al actual).
const TD_CLS = 'px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap';
const TH_CLS =
  'text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap';

/** Tabla compacta de la documentación: reemplaza el wrapper + <td>/<th> repetidos
 *  generando el MISMO DOM actual (div.overflow-x-auto > table > tbody con fila de <th>).
 *  Las celdas aceptan ReactNode para enlaces (NormaLink) o sub/sup; el texto plano
 *  alimenta la búsqueda de DocsPage (nodeText). `foot` es contenido hermano de la
 *  <table> DENTRO del wrapper (nota al pie que scrollea junto con la tabla). */
export function Tabla({
  head,
  rows,
  foot,
}: {
  head: ReactNode[];
  rows: ReactNode[][];
  foot?: ReactNode;
}): JSX.Element {
  return (
    <div className="overflow-x-auto my-2">
      <table className="w-full text-[12px] font-mono border-collapse">
        <tbody>
          <tr>
            {head.map((h, i) => (
              <th key={i} className={TH_CLS}>
                {h}
              </th>
            ))}
          </tr>
          {rows.map((cells, i) => (
            <tr key={i}>
              {cells.map((c, j) => (
                <td key={j} className={TD_CLS}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {foot}
    </div>
  );
}

/** Caja de fórmula destacada (solo texto plano: las fórmulas con sub/sup/br
 *  se quedan escritas a mano). `compacto=true` para las cajas sin my-2/leading-relaxed. */
export function fx(texto: string, compacto = false): JSX.Element {
  return (
    <div
      className={
        compacto
          ? 'bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide'
          : 'bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed'
      }
    >
      {texto}
    </div>
  );
}

/** Grid "Donde:" de definiciones var → descripción (solo variables sin sub/sup;
 *  los grids con JSX en la variable se quedan escritos a mano). */
export function donde(pares: Record<string, ReactNode>): JSX.Element {
  return (
    <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
      {Object.entries(pares).map(([variable, desc]) => (
        <Fragment key={variable}>
          <span className="font-semibold text-primary">{variable}</span>
          <span>{desc}</span>
        </Fragment>
      ))}
    </div>
  );
}
