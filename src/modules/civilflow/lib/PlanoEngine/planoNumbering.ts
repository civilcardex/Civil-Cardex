// Numeración de ids/etiquetas de ramales y tributarios. Extraído de PlanoState (que
// re-exporta todo). Funciones puras sobre arrays estructurales — sin imports del motor.

/** Id unico de ramal (milisegundo mas azar, evita choques en splits). */
export function uniqRamalId(): string {
  return 'T' + Date.now() + Math.random().toString(36).slice(2, 7);
}

/** Siguiente numero libre T{n} del padre (numeracion por padre desde 1: los ramales que cuelgan de
 *  RS1 se llaman T1RS1, T2RS1...). Ej: con T1RS1 ocupado devuelve 2.
 *  @param suffix etiqueta del ramal raíz (p.ej. 'RS1'); @returns numero libre. */
export function allocTributaryNumber(
  target: { ramales: Array<{ label?: string }> },
  suffix: string,
): number {
  const used = new Set(target.ramales.map((r) => r.label));
  let n = 1;
  while (used.has(`T${n}${suffix}`)) n++;
  return n;
}

/** Primer id libre pfx{n} para volver un tributario a ramal (ignora el propio que se convierte).
 *  Ej: pfx 'RS' con RS1 y RS2 tomados -> 'RS3'.
 *  @param pfx prefijo de la red ('RS', 'RAF'...); @returns id libre. */
export function nextFreeRamalId(
  ramales: Array<{ id: string; label?: string }>,
  pfx: string,
  excludeId?: string,
): string {
  const ids = new Set(ramales.filter((r) => r.id !== excludeId).map((r) => r.id));
  const labels = new Set(ramales.filter((r) => r.id !== excludeId).map((r) => r.label || ''));
  let n = 1;
  while (ids.has(`${pfx}${n}`) || labels.has(`${pfx}${n}`)) n++;
  return `${pfx}${n}`;
}

/** Re-etiqueta en cascada un tributario y todo lo que cuelga de él, para que su etiqueta nombre
 *  al ramal raíz actual (máx 20 niveles de fondo, para no loopear con datos corruptos). */
export function relabelTribChain(
  ramales: Array<{ id: string; label?: string; tipo?: string; padre: string | null }>,
  id: string,
  alloc: (suffix: string) => number,
  depth = 0,
): void {
  if (depth > 20) return;
  const r = ramales.find((x) => x.id === id);
  if (!r || r.tipo !== 'tributario') return;
  // Raíz = caminar la cadena de padres hasta el primer NO tributario (el tronco receptor).
  let root = '';
  let cur: string | null = r.padre;
  let guard = 0;
  while (cur && guard++ < 20) {
    const p_ = ramales.find((x) => x.id === cur);
    if (!p_) break;
    if (p_.tipo !== 'tributario') {
      root = p_.label || p_.id;
      break;
    }
    cur = p_.padre;
  }
  if (root) {
    const endsOk = !!r.label && r.label.endsWith(root);
    if (!endsOk) {
      r.label = `T${alloc(root)}${root}`;
    }
  }
  for (const child of ramales) {
    if (child.padre === id && child.tipo === 'tributario') {
      relabelTribChain(ramales, child.id, alloc, depth + 1);
    }
  }
}

/** Etiqueta del ramal raíz de un tributario (el primer no-tributario subiendo por `padre`, sin
 *  mergesFrom (genealogía del split: anfitrión + entrantes)). Sirve para que T2RS1 sepa a qué
 *  tronco pertenece.
 *  @param ramalId id del tributario; @returns etiqueta del raíz ('' si no existe). */
export function rootTributarioLabel(
  ramales: Array<{
    id: string;
    label?: string;
    tipo?: string;
    padre: string | null;
    mergesFrom?: [string, string];
  }>,
  ramalId: string | null | undefined,
): string {
  if (!ramalId) return '';
  let cur = ramales.find((r) => r.id === ramalId) as
    | {
        id: string;
        label?: string;
        tipo?: string;
        padre: string | null;
        mergesFrom?: [string, string];
      }
    | undefined;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    // La raíz es el PRIMER no-tributario de la cadena de padres (el padre inmediato del
    // tributario). NO se sigue mergesFrom hacia el tronco original: un tributario cuyo padre
    // es el downstream autocreado de un split (RS2) debe etiquetarse contra RS2, no contra el
    // tronco original (RS1) — regla usuario: el label nombra al padre inmediato.
    if (cur.tipo === 'tributario' && cur.padre) {
      cur = ramales.find((r) => r.id === cur!.padre) as typeof cur;
    } else {
      break;
    }
  }
  // Cadena corrupta (ciclo): devolver vacío
  if (cur && seen.has(cur.id) && cur.tipo === 'tributario') return '';
  return cur ? cur.label || cur.id || '' : '';
}
