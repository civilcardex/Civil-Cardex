import type { ReactNode, CSSProperties } from 'react';

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
