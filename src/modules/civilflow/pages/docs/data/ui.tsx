import { Fragment } from 'react';
import type { JSX, ReactNode } from 'react';

// Clases EXACTAS de los <td>/<th> de las tablas de la documentación (markup idéntico al actual).
const TD_CLS = 'px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap';
const TH_CLS =
  'text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap';

/** Dibuja una tabla chica de la ayuda con el mismo aspecto de siempre. Acepta texto o enlaces y alimenta el buscador. Ej: head + rows + foot opcional. */
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

/** Caja de fórmula destacada (fondo oscuro, letra mono). `contenido` acepta texto plano
 *  o JSX (sub/sup/br/entidades); `compacto=true` la hace más ajustada para usarla
 *  dentro de listas o tablas, sin los márgenes de la caja normal. */
export function fx(contenido: ReactNode, compacto = false): JSX.Element {
  return (
    <div
      className={
        compacto
          ? 'bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide'
          : 'bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed'
      }
    >
      {contenido}
    </div>
  );
}

/** Grid "Donde:" de definiciones var → descripción; variable y descripción aceptan
 *  ReactNode (sub/sup/entidades en la variable incluidos). */
export function donde(pares: ReadonlyArray<readonly [ReactNode, ReactNode]>): JSX.Element {
  return (
    <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
      {pares.map(([variable, desc], i) => (
        <Fragment key={i}>
          <span className="font-semibold text-primary">{variable}</span>
          <span>{desc}</span>
        </Fragment>
      ))}
    </div>
  );
}
