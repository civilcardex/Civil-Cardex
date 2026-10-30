/**
 * Logging de errores solo en dev (no-op en producción): los objetos (ej: PostgREST error de
 * supabase-js) se aplanan a JSON de una línea para ver code/message/details que el 400 necesita.
 * Ej: devError('upsert cm_apus:', error).
 */
export function devError(...args: unknown[]): void {
  if (!import.meta.env.DEV) return;
  console.error(
    ...args.map((a) => {
      if (a instanceof Error) return a.message;
      if (a && typeof a === 'object') {
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      }
      return a;
    }),
  );
}

/** Log de diagnóstico DEV (canal info, no error): trazas de ingeniería como [CF-COTA] que
 *  sirven para depurar pero no son fallos — como error envenenan el panel de consola. */
export function devLog(...args: unknown[]): void {
  if (!import.meta.env.DEV) return;
  // eslint-disable-next-line no-console
  console.info(...args);
}
