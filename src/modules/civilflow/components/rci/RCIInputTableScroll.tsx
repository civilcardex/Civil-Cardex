import type { ReactNode } from 'react';

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
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- permite desplazar la región con teclado */
export function RciInputTableScroll({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      style={{ maxWidth: '100%', overflowX: 'auto' }}
    >
      {children}
    </div>
  );
}
/* eslint-enable jsx-a11y/no-noninteractive-tabindex */
