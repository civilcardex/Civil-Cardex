/**
 * Reasignación de referencias internas de los elementos copiados: ini/fin/padre y los arrays
 * recibeDeIds/alimentaIds se traducen a los ids nuevos (y se filtran a lo que existirá), los
 * mergesFrom se remapean o se sueltan, los libros de herencia (ucAplicado) re-keyean sus claves
 * y se borran cachés de render y punteros entre pisos. Ej: un bajante que recibía de RS2 viejo
 * pasa a recibir de RS5 nuevo, o pierde la referencia si RS2 no viajó.
 */
import type { CopyElement, ExtendedEngine } from './types.ts';

/** Remapea ini/fin/padre, recibeDeIds/alimentaIds (filtrados a lo que existirá) y descargaEnId. */
export function remapearReferencias(
  srcAll: CopyElement[],
  oldToNew: Record<string, string>,
  engine: { ramales: Array<{ id: string }>; bajantes: Array<{ id: string }> },
): void {
  /* ── Reasignar referencias internas ── */
  // El ramal/bajante referenciado puede ser uno que se copia en ESTE MISMO lote — todavía no
  // existirá en engine.ramales/engine.bajantes (ese push ocurre más abajo), así que el chequeo
  // de existencia también debe aceptar todo lo que oldToNew está por introducir. Sin esto, los
  // recibeDeIds de un bajante apuntando a un ramal copiado junto a él siempre fallaban el
  // chequeo de array en vivo y se quitaban en silencio — el símbolo del bajante se copiaba, pero
  // su conexión hidráulica no.
  const willExist = new Set(Object.values(oldToNew));
  // Ids que YA existen en el piso destino: el .some por cada referencia era O(n) por
  // referencia (y hay referencias por cada elemento copiado).
  const idsDelDestino = new Set<string>([
    ...engine.ramales.map((r) => r.id),
    ...engine.bajantes.map((b) => b.id),
  ]);
  for (const el of srcAll) {
    if (el.ini && oldToNew[el.ini]) el.ini = oldToNew[el.ini];
    if (el.fin && oldToNew[el.fin]) el.fin = oldToNew[el.fin];
    if (el.padre && oldToNew[el.padre]) el.padre = oldToNew[el.padre];
    if (el.recibeDeIds) {
      el.recibeDeIds = el.recibeDeIds
        .map((id: string) => oldToNew[id] || id)
        .filter((id: string) => willExist.has(id) || idsDelDestino.has(id));
    }
    if (el.alimentaIds) {
      el.alimentaIds = el.alimentaIds
        .map((id: string) => oldToNew[id] || id)
        .filter((id: string) => willExist.has(id) || idsDelDestino.has(id));
    }
    if (el.descargaEnId && oldToNew[el.descargaEnId]) {
      el.descargaEnId = oldToNew[el.descargaEnId];
    }
  }
}

/** Suelta las cachés de render y marcadores de fantasma: la copia nace limpia en el piso destino. */
export function limpiarCachesRender(srcAll: CopyElement[]): void {
  for (const el of srcAll) {
    delete el._labelBox;
    delete el._circ;
    delete el._ghost;
    delete el._ghostLabelBox;
    delete el._net;
    delete el.isFantasma;
    delete el.ghostData;
    delete el.desplazamientos;
    delete (el as CopyElement).pisoBase;
  }
}

/** Remapea mergesFrom y los libros ucAplicado/ucAplicadoHidro; lo que no viaja completo, se suelta. */
export function remapearMergesYLibros(
  srcRamales: CopyElement[],
  srcBajantes: CopyElement[],
  srcGlobals: CopyElement[],
  oldToNew: Record<string, string>,
): void {
  // mergesFrom: remapear a los ids nuevos; sin sus piezas, se suelta (colgaría un
  // downstream de un upstream que no existe en el destino).
  for (const r of srcRamales as unknown as { mergesFrom?: unknown }[]) {
    if (!Array.isArray(r.mergesFrom)) continue;
    const m = (r.mergesFrom as string[]).map((id) => oldToNew[id]).filter(Boolean);
    if (m.length) r.mergesFrom = m;
    else delete r.mergesFrom;
  }
  // Libros de herencia (ucAplicado/ucAplicadoHidro): sus claves son ids de ramales
  // destino — remapear los copiados, soltar el resto (acreditarían UDs de trazos que no
  // existen en el destino).
  for (const b of [...srcBajantes, ...srcGlobals] as unknown as Record<string, unknown>[]) {
    for (const k of ['ucAplicado', 'ucAplicadoHidro'] as const) {
      const book = b[k] as Record<string, Record<string, number>> | undefined;
      if (!book || typeof book !== 'object') continue;
      const nb: Record<string, Record<string, number>> = {};
      for (const [dk, dv] of Object.entries(book)) {
        if (oldToNew[dk]) nb[oldToNew[dk]] = dv;
      }
      if (Object.keys(nb).length) b[k] = nb;
      else delete b[k];
    }
  }
}

/** Suelta punteros de asociación entre pisos y el área captada; estampa pisoBase del piso destino. */
export function limpiarPunterosEntrePisos(
  srcBajantes: CopyElement[],
  srcGlobals: CopyElement[],
  engine: ExtendedEngine,
): void {
  // Los punteros de asociación entre pisos (descargaEnId/origenId) referencian un bajante
  // específico en OTRO piso específico — copiar el elemento a un piso nuevo bajo un id nuevo
  // vuelve obsoleto cualquier puntero así (o apunta a la nada, o peor, a algún bajante no
  // relacionado que ahora resulta compartir el id viejo). Ni esta herramienta ni su caller
  // tienen forma de saber cuál debería ser la asociación del elemento copiado en el piso nuevo,
  // así que se descarta por completo en vez de arrastrar un enlace que ya no significa nada.
  for (const b of [...srcBajantes, ...srcGlobals] as unknown as {
    descargaEnId?: string | null;
    origenId?: string | null;
    desplazamientos?: unknown;
    pisoBase?: string;
    isFantasma?: boolean;
    area_m2?: number;
  }[]) {
    b.descargaEnId = null;
    b.origenId = null;
    // Área NO viaja (orig. usuario): la captación pertenece al bajante original — la copia
    // arranca sin área hasta que se le asigne la suya.
    delete b.area_m2;
    delete b.desplazamientos;
    // pisoBase registra el piso al que "pertenece" un bajante/montante/global — renderBajantes.ts
    // nunca dibuja el círculo propio del elemento cuando difiere de la etiqueta del piso
    // cargado actualmente (esa discrepancia es cómo un fantasma entre pisos permanece invisible
    // salvo como marcador de fantasma). Dejado en la etiqueta del piso FUENTE, cada elemento
    // copiado fallaba en silencio al renderizarse por completo en el piso destino aunque existiera
    // en engine.bajantes. Debe estamparse con la etiqueta del piso destino, que es cualquier piso
    // cargado actualmente (el copy siempre corre hacia el plano abierto).
    b.pisoBase = engine.nivelActual?.label ?? '';
  }
}
