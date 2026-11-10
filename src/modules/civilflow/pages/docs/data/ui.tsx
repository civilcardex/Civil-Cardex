import { Fragment } from 'react';
import type { JSX, ReactNode } from 'react';

/** Dibuja una tabla chica de la ayuda con el mismo aspecto de siempre. Acepta texto o enlaces y alimenta el buscador. Ej: head + rows + foot opcional. Con `envolver=true` las celdas parten el texto (sin nowrap) — para tablas anchas de textos largos que no deben hacer scroll horizontal. */
export function Tabla({
  head,
  rows,
  foot,
  envolver = false,
}: {
  head: ReactNode[];
  rows: ReactNode[][];
  foot?: ReactNode;
  envolver?: boolean;
}): JSX.Element {
  const wrap = envolver ? ' ' : ' whitespace-nowrap';
  const tdCls = 'px-3 py-1.5 border border-outline-variant text-on-surface' + wrap;
  const thCls =
    'text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant' +
    wrap;
  return (
    <div className={envolver ? 'my-2' : 'overflow-x-auto my-2'}>
      <table className="w-full text-[12px] font-mono border-collapse">
        <tbody>
          <tr>
            {head.map((h, i) => (
              <th key={i} className={thCls}>
                {h}
              </th>
            ))}
          </tr>
          {rows.map((cells, i) => (
            <tr key={i}>
              {cells.map((c, j) => (
                <td key={j} className={tdCls}>
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
 *  dentro de listas o tablas, sin los márgenes de la caja normal. Fórmula en BLANCO BOLD
 *  (ped. usuario: antes azul). */
export function fx(contenido: ReactNode, compacto = false): JSX.Element {
  return (
    <div
      className={
        compacto
          ? 'bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-on-surface font-bold tracking-wide'
          : 'bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-on-surface font-bold tracking-wide my-2 leading-relaxed'
      }
    >
      {contenido}
    </div>
  );
}

/** Definiciones "Donde:" de var → descripción EN UNA SOLA LÍNEA (ped. usuario: antes grid
 *  vertical que estiraba la sección). Variable en bold blanco, descripción a continuación,
 *  pares separados por «;». Variable y descripción aceptan ReactNode (sub/sup/entidades). */
export function donde(pares: ReadonlyArray<readonly [ReactNode, ReactNode]>): JSX.Element {
  return (
    <p className="text-[13px] leading-relaxed ml-4">
      {pares.map(([variable, desc], i) => (
        <Fragment key={i}>
          {i > 0 && <span className="text-on-surface-variant"> · </span>}
          <span className="font-bold text-on-surface">{variable}</span>
          <span> = {desc}</span>
        </Fragment>
      ))}
    </p>
  );
}
