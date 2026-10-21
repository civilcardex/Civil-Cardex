/** Formatea números de la tabla de memoria (dos decimales; guion si es 0). */
export const f2 = (n: number): string => (n > 0 ? n.toFixed(2) : '-');
