/** Fecha corta es-CO para la tarjeta (dd mmm aa). */
export function fechaCorta(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' });
}
