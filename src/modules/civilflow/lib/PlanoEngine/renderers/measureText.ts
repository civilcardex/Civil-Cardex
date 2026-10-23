/**
 * Ancho de texto con MEMORIA por contexto de dibujo.
 *
 * Por qué: `measureText` obliga al navegador a medir la cadena con la fuente y el tamaño
 * actuales, y el render lo llamaba varias veces por ramal en CADA frame (los frames se
 * agendan por rAF durante el arrastre, el paneo y el zoom): el mismo texto con la misma
 * fuente se volvía a medir decenas de veces por segundo sin cambiar nunca.
 *
 * Ej: 160 ramales × ~5 medidas = 800 llamadas por frame; con memoria quedan en 800 la
 * primera vez y en lecturas de `Map` después (≈0.05 µs cada una).
 *
 * La clave lleva la fuente porque el ancho depende de ella; el tope de entradas evita que
 * un plano con mucho texto suelto haga crecer el mapa sin fin (se vacía y vuelve a medir).
 */
const memorias = new WeakMap<CanvasRenderingContext2D, Map<string, number>>();

/** Tope de medidas memorizadas por contexto (≈200 KB en el peor caso: se vacía y sigue). */
const TOPE_ENTRADAS = 4000;

/**
 * Devuelve el ancho (px de canvas) de `texto` con la fuente actual del contexto, reutilizando
 * la medida anterior si ya se calculó.
 * @param ctx - contexto 2D cuyo `font` define la medida.
 * @param texto - cadena a medir.
 * @returns ancho en px, igual al de `ctx.measureText(texto).width`.
 */
export function anchoTexto(ctx: CanvasRenderingContext2D, texto: string): number {
  let memo = memorias.get(ctx);
  if (!memo) {
    memo = new Map();
    memorias.set(ctx, memo);
  }
  const clave = `${ctx.font}\u0000${texto}`;
  const previo = memo.get(clave);
  if (previo !== undefined) return previo;
  const ancho = ctx.measureText(texto).width;
  if (memo.size >= TOPE_ENTRADAS) memo.clear();
  memo.set(clave, ancho);
  return ancho;
}
