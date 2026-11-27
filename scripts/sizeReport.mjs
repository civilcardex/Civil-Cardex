// Reporte ADVISORY de tamaños: lista los archivos src/** que superan 700 líneas.
// NO falla (exit 0) — es la versión informativa del guard de arquitectura que se
// eliminó: si la lista crece ronda tras ronda, el archivo candidato a split está
// volviendo a engordar. Se invoca al final del job de CI.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(process.cwd(), 'src');
const TOPE = 700;

// readdirSync recursivo nativo (Node 20+): la recursividad la hace el propio Node.
function recorrer(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(
      (e) => e.isFile() && /\.(ts|tsx)$/.test(e.name) && !/__tests__|\.test\./.test(e.parentPath),
    )
    .map((e) => {
      const ruta = e.parentPath.startsWith(dir)
        ? join(e.parentPath, e.name)
        : join(dir, e.parentPath, e.name);
      const lineas = readFileSync(ruta, 'utf8').split('\n').length;
      return { ruta: ruta.slice(RAIZ.length + 1), lineas };
    })
    .filter((a) => a.lineas > TOPE);
}

const archivos = recorrer(RAIZ);
archivos.sort((a, b) => b.lineas - a.lineas);
if (archivos.length === 0) {
  console.log('[sizeReport] Sin archivos por encima de', TOPE, 'líneas. Lean.');
} else {
  console.log(`[sizeReport] ${archivos.length} archivo(s) > ${TOPE} l (advisory, no falla):`);
  for (const a of archivos) console.log(`  ${a.lineas}\t${a.ruta}`);
}
