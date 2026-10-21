/** Alerta modal de diámetro inválido (siempre devuelve true para `if (...) return;`). */
export function avisarDiametroInvalido(message: string, title = 'Diámetro no permitido'): boolean {
  window.dispatchEvent(
    new CustomEvent('civilflow_diametro_validation', {
      detail: { title, message },
    }),
  );
  return true;
}
