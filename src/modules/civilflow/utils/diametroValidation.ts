/** Emite la alerta de validación de diámetro al ecosistema (evento `civilflow_diametro_validation`,
 *  consumido por GlobalAlertDialogProvider) y decide el return del caller: devuelve siempre true
 *  para que los sitios que bloquean hagan `if (avisarDiametroInvalido(...)) return;`. */
export function avisarDiametroInvalido(message: string, title = 'Diámetro no permitido'): boolean {
  window.dispatchEvent(
    new CustomEvent('civilflow_diametro_validation', {
      detail: { title, message },
    }),
  );
  return true;
}
