import type { ReactNode, CSSProperties } from 'react';

/** Celda de RegTable que se desvía del default. Ej: {t:'1½"', c:true} centra la primera celda. */
export interface RegCelda {
  /** Contenido de la celda. Ej: el uso 'Vivienda estrato 1–2' o el valor 0.5. */
  t: ReactNode;
  /** Clase "c" (centrado). Default: primera celda no, resto sí. */
  c?: boolean;
  /** fontWeight (solo importa en la primera celda). Default 500; false = sin style. */
  w?: 500 | 600 | false;
  /** Envuelve el contenido en <span className="sigla">. Ej: la sigla 'Lvm' del lavamanos. */
  sigla?: boolean;
}

/** Tabla normativa con el andamiaje común de la página Normativa: caption oculto, thead y filas
 *  con primera celda en bold (500) y resto centrado. Ej:
 *  <RegTable caption="Dotaciones NTC 1500" headers={['Uso','Min','Max']} rows={NTC1500_DOTACIONES} /> */
export function RegTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: readonly string[];
  rows: ReadonlyArray<ReadonlyArray<string | number | RegCelda>>;
}) {
  return (
    <table className="tbl" style={{ fontSize: 12 }}>
      <caption className="visually-hidden">{caption}</caption>
      <thead>
        <tr>
          {headers.map((h, hi) => (
            <th key={hi} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, ri) => (
          <tr key={ri}>
            {cells.map((cell, ci) => {
              // ponytail: shorthand string/number = default (primera bold, resto centrada)
              const o = cell !== null && typeof cell === 'object' ? cell : { t: cell };
              const primera = ci === 0;
              const cn = (o.c ?? !primera) ? 'c' : undefined;
              const style = primera && o.w !== false ? { fontWeight: o.w ?? 500 } : undefined;
              const contenido = o.sigla ? <span className="sigla">{o.t}</span> : o.t;
              return (
                <td key={ci} className={cn} style={style}>
                  {contenido}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Subtítulo de sección normativa (h4 visual). Ej: «Dotaciones por estrato» sobre la tabla RAS. */
export const subHeadingStyle = {
  fontFamily: 'var(--mono)',
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--txt)',
  margin: '16px 0 10px 0',
  letterSpacing: '0.3px',
};

const tabBtnBaseStyle: CSSProperties = {
  flex: 1,
  padding: '14px 18px',
  borderRadius: 'var(--r)',
  border: '1px solid',
  cursor: 'pointer',
  fontSize: 15,
  fontFamily: 'var(--body)',
  transition: 'all .15s',
};

/** Botón de pestaña de la página Normativa (rol tab, aria-selected): resalta la activa.
 *  Ej: clic en «NTC 1500» -> su sección abre y el botón queda con borde azul. */
export function TabBtn({
  active,
  onClick,
  children,
  id,
}: {
  active: boolean;
  onClick: () => void;
  children?: ReactNode;
  id?: string;
}) {
  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      role="tab"
      aria-selected={active}
      style={{
        ...tabBtnBaseStyle,
        fontWeight: active ? 700 : 400,
        borderColor: active ? 'var(--acc2)' : 'var(--line)',
        background: active ? 'var(--bg3)' : 'transparent',
      }}
    >
      {children}
    </button>
  );
}

/** Botón de filtro por red dentro de una sección normativa: resalta la red activa.
 *  Ej: filtrar «Sanitaria» -> solo se ven sus tablas. */
export function FilterBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '12px 16px',
        borderRadius: 'var(--r)',
        border: '1px solid',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: active ? 600 : 400,
        borderColor: active ? 'var(--acc2)' : 'var(--line)',
        background: active ? 'rgba(27,110,243,.08)' : 'transparent',
        transition: 'background-color .15s, border-color .15s',
      }}
    >
      {children}
    </button>
  );
}
