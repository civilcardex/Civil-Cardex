/** Ancho de texto con MEMORIA por contexto de dibujo: `measureText` medía lo mismo decenas de veces por frame (160 ramales × ~5 medidas = 800 llamadas); con memoria, lecturas de Map. */
const memorias = new WeakMap<CanvasRenderingContext2D, Map<string, number>>();

/** Tope de medidas memorizadas por contexto (≈200 KB en el peor caso: se vacía y sigue). */
const TOPE_ENTRADAS = 4000;

/** Ancho (px de canvas) de `texto` con la fuente actual del contexto, reutilizando la medida anterior si ya se calculó. @returns ancho en px, igual al de `ctx.measureText(texto).width`. */
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
