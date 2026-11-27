import type { CSSProperties, ReactNode } from 'react';

/** Región de tabla desplazable con toque y teclado. Ej.: recorrer los tramos de sanitaria sin mover el pie. */
export default function TableScroll({
  label,
  className,
  style,
  children,
}: {
  label: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- desplaza la tabla con teclado
      tabIndex={0}
      className={className ? `cf-table-scroll ${className}` : 'cf-table-scroll'}
      style={style}
    >
      {children}
    </div>
  );
}
