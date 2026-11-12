// Reporte ADVISORY de tamaños: lista los archivos src/** que superan 700 líneas.
// NO falla (exit 0) — es la versión informativa del guard de arquitectura que se
// eliminó: si la lista crece ronda tras ronda, el archivo candidato a split está
// volviendo a engordar. Se invoca al final del job de CI.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(process.cwd(), 'src');
const TOPE = 700;

function recorrer(dir, acc) {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) recorrer(ruta, acc);
    else if (/\.(ts|tsx)$/.test(nombre) && !/__tests__|\.test\./.test(nombre)) {
      const lineas = readFileSync(ruta, 'utf8').split('\n').length;
      if (lineas > TOPE) acc.push({ ruta: ruta.slice(RAIZ.length + 1), lineas });
    }
  }
}

const archivos = [];
recorrer(RAIZ, archivos);
archivos.sort((a, b) => b.lineas - a.lineas);
if (archivos.length === 0) {
  console.log('[sizeReport] Sin archivos por encima de', TOPE, 'líneas. Lean.');
} else {
  console.log(`[sizeReport] ${archivos.length} archivo(s) > ${TOPE} l (advisory, no falla):`);
  for (const a of archivos) console.log(`  ${a.lineas}\t${a.ruta}`);
}
