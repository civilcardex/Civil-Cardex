/**
 * Mensaje de error de Supabase Auth listo para UI, sin enumeración de usuarios:
 * "Email not confirmed" / "User already registered" confirman existencia de cuenta a
 * un atacante con el formulario de login/registro — los códigos se mapean a textos
 * genéricos y cualquier mensaje desconocido cae al fallback.
 * @param err excepción del SDK de Supabase (o cualquier valor del catch).
 * @param fallback texto por defecto si el error no es reconocido.
 */
export function mensajeAuthGenerico(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message.toLowerCase() : '';
  if (raw.includes('invalid login credentials') || raw.includes('email not confirmed')) {
    return 'Credenciales inválidas o cuenta sin confirmar. Revisa tu correo y contraseña.';
  }
  if (raw.includes('user already registered')) {
    return 'No se pudo crear la cuenta. Si ya tienes una, inicia sesión o recupera tu contraseña.';
  }
  if (raw.includes('password') && raw.includes('least')) {
    // Sin cifra: la política la fija el Dashboard (default Supabase = 6) y puede cambiar —
    // el mensaje no debe afirmar requisitos que el proyecto no tenga.
    return 'La contraseña no cumple la política de seguridad del proyecto: usa una más larga o más compleja.';
  }
  if (raw.includes('rate limit') || raw.includes('too many requests')) {
    return 'Demasiados intentos. Espera un momento y vuelve a intentar.';
  }
  return fallback;
}
