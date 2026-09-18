export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Núcleo común de los 3 visores 3D (aparatos/epc/rci): recorre las claves con progreso
 *  20→95 % y pausa de 150 ms entre modelos para no congelar la UI. cargarPieza loguea sus
 *  propios errores y devuelve false si la pieza falló; abort() corta el recorrido (desmonte).
 *  El finish/encuadre de cada visor queda afuera. Devuelve cuántas piezas fallaron. */
export async function cargarModelosSecuencial(
  claves: readonly string[],
  onProgress: (pct: number, texto: string) => void,
  cargarPieza: (clave: string) => Promise<boolean>,
  abort?: () => boolean,
): Promise<number> {
  let fallas = 0;
  for (let i = 0; i < claves.length; i++) {
    if (abort?.()) break;
    onProgress(20 + (i / claves.length) * 75, `Cargando ${claves[i]}… (${i + 1}/${claves.length})`);
    if (!(await cargarPieza(claves[i]))) fallas++;
    if (i < claves.length - 1) await sleep(150);
  }
  return fallas;
}
