// Logging de errores solo en dev. Los objetos (p. ej. PostgREST error de supabase-js) se
// aplanan a JSON de una línea: colapsados en consola escondían el code/message/details que
// diagnostica el 400. El stringify va blindado: un objeto circular no debe tumbar la
// cadena que estaba reportando el error.
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
