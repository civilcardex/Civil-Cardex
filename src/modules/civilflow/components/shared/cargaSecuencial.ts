export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Dispose de geometría/material de un grupo three ya parseado que ya no se usará (desmonte a
 *  mitad de carga: la escena vieja se disposeó y el grupo quedaría huérfano en memoria).
 *  THREE llega por parámetro para que el kernel no dependa del paquete three. */
export function disposeGrupo(
  THREE: { Mesh: new (...args: never[]) => unknown },
  grupo: { traverse(cb: (obj: unknown) => void): void },
): void {
  grupo.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const mesh = obj as {
      geometry?: { dispose(): void };
      material?: { dispose(): void } | Array<{ dispose(): void }>;
    };
    mesh.geometry?.dispose();
    if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
    else mesh.material?.dispose();
  });
}

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
