// Borradores de dibujo en curso (extraídos de PlanoState para el techo G1): los tipos del
// elemento A MEDIAS que el motor mantiene mientras el usuario dibuja. Solo tipos, sin imports —
// PlanoState.ts los re-exporta para que los ~consumidores no cambien.

/** La tubería que se está dibujando ahora mismo, todavía sin confirmar: sus puntos y la longitud
 *  que lleva. Mientras exista, un clic añade un punto y Enter la guarda como ramal.
 *  Ej: RAF3 con 2 pts -> al Enter, finishRamal la convierte en PlanoRamal. */
export interface PlanoActiveRamal {
  id?: string;
  net: string;
  tipo: string;
  padre: string | null;
  pts: number[][];
  totalL: number;
}

/** El área que se está delimitando ahora, todavía sin cerrar (los puntos y el color con que se
 *  pintará al confirmar). Ej: el polígono del sector de gas mientras arrastras el 3er vértice. */
export interface PlanoActiveArea {
  pts: number[][];
  color: string;
}

/** Lo que se le pone a una tubería nueva cuando el usuario no elige nada: el material, el diámetro
 *  y la pendiente que heredan las siguientes. Ej: material 'PVC-PR' -> RAF4 nace con él. */
export interface PlanoRamalDefaults {
  material: string;
  diametro: string;
  pendiente: number;
}
