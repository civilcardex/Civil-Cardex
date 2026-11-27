import type { ReactNode } from 'react';
import TableScroll from '../shared/TableScroll.tsx';

/** Lleva al dato indicado por una verificación. Si solo se puede leer, enfoca su fila. */
export function focusRciInput(field: string): boolean {
  const control = document.querySelector<HTMLElement>(`[data-campo="${field}"]`);
  if (!control) return false;
  const target =
    control.tabIndex < 0 || control.matches(':disabled')
      ? (control.closest('tr[tabindex="-1"]') as HTMLElement | null)
      : control;
  (target ?? control).scrollIntoView({ block: 'center', behavior: 'smooth' });
  target?.focus({ preventScroll: true });
  return true;
}

/** Da a cada tabla su propia zona de desplazamiento. Ej.: recorrer los accesorios con el teclado. */
export function RciInputTableScroll({ label, children }: { label: string; children: ReactNode }) {
  return <TableScroll label={label}>{children}</TableScroll>;
}
